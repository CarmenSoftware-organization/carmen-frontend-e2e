import { buConfigSend, buSend, type ApiResult, type Role } from "./bu-api";
import { accountId, APPROVER, CREATOR, listAllRows, postAction, today } from "./gl-api";

/**
 * AR invoice seeding and reads through the backend on the TEST BU. Creates drafts the spec may freely submit or void;
 * the `E2E-AR-*` read set is looked up with `seededArDoc` and never mutated. Workflow actions return the raw result
 * (a spec may expect a refusal); creators throw on failure. Independent of `scripts/data-reset` on purpose.
 */
export type ArDocType = "invoice" | "debit_note" | "credit_note";

export interface ArLine {
  qty: number;
  price: number;
  /** Put the "Vat 7%" profile on the line; otherwise "None" (0%). */
  vat?: boolean;
  discountPct?: number;
}

export interface ArDocLine {
  id: string;
  net: number;
  vat: number;
  total: number;
  unpaid: number;
}

export interface ArDoc {
  id: string;
  no: string;
  docType: string;
  status: string;
  version: number;
  total: number;
  net: number;
  vat: number;
  outstanding: number;
  referenceApplied: number;
  taxInvoiceNo?: string;
  taxStatus?: string;
  glJvId?: string;
  voidGlJvId?: string;
  allowedActions: string[];
  lines: ArDocLine[];
}

type Row = Record<string, any>;

const ok = (r: ApiResult, what: string) => {
  if (r.status < 200 || r.status >= 300) {
    throw new Error(`${what} -> ${r.status} ${JSON.stringify(r.body?.message ?? r.body).slice(0, 300)}`);
  }
  return r;
};

function toDoc(d: Row): ArDoc {
  return {
    id: String(d.id),
    no: String(d.doc_no),
    docType: String(d.doc_type),
    status: String(d.doc_status),
    version: Number(d.doc_version),
    total: Number(d.total_amount),
    net: Number(d.net_amount),
    vat: Number(d.vat_amount),
    outstanding: Number(d.outstanding_amount),
    referenceApplied: Number(d.reference_applied_amount ?? 0),
    taxInvoiceNo: d.tax_invoice?.tax_invoice_no ?? d.tax_invoice_no ?? undefined,
    taxStatus: d.tax_invoice?.tax_status ?? d.tax_status ?? undefined,
    glJvId: d.gl_jv_id ?? undefined,
    voidGlJvId: d.void_gl_jv_id ?? undefined,
    allowedActions: Array.isArray(d.allowed_actions) ? d.allowed_actions.map(String) : [],
    lines: ((d.tb_ar_invoice_detail ?? []) as Row[]).map((l) => ({
      id: String(l.id),
      net: Number(l.net_amount),
      vat: Number(l.vat_amount),
      total: Number(l.total_amount),
      unpaid: Number(l.unpaid_amount),
    })),
  };
}

/** Totals, status, version and allowed actions of one document. */
export async function getArDoc(id: string): Promise<ArDoc> {
  return toDoc(ok(await buSend(CREATOR, "GET", `/ar-invoice/${id}`), `GET ar-invoice ${id}`).body.data);
}

/** A read-set document by its key (`E2E-AR-POSTED` ...), found by the list `search` on its description `STD ar.<row> <KEY>`. */
export async function seededArDoc(key: string): Promise<ArDoc> {
  const hit = (await listAllRows(CREATOR, `/ar-invoice?search=${encodeURIComponent(key)}`)).find((d) =>
    String(d.description ?? "").includes(key),
  );
  if (!hit) throw new Error(`${key} missing - run bun run data:reset --yes`);
  return getArDoc(String(hit.id));
}

let revenueId: Promise<string> | null = null;
let costCenterId: Promise<string> | null = null;
const customerIds = new Map<string, Promise<string>>();
const profileIds = new Map<string, Promise<string>>();

function byCode(path: string, code: string, what: string): Promise<string> {
  return listAllRows(CREATOR, path, true).then((rows) => {
    const hit = rows.find((r) => r.code === code);
    if (!hit) throw new Error(`no ${what} ${code} on the TEST BU - run \`bun run data:reset --yes\``);
    return String(hit.id);
  });
}

function customer(code: string): Promise<string> {
  if (!customerIds.has(code)) customerIds.set(code, byCode("/customers", code, "customer"));
  return customerIds.get(code)!;
}

function taxProfile(name: string): Promise<string> {
  if (!profileIds.has(name)) {
    profileIds.set(
      name,
      listAllRows(CREATOR, "/tax-profiles", true).then((rows) => {
        const hit = rows.find((t) => t.name === name);
        if (!hit) throw new Error(`no tax profile "${name}" on the TEST BU - run \`bun run data:reset --yes\``);
        return String(hit.id);
      }),
    );
  }
  return profileIds.get(name)!;
}

/**
 * A draft AR document on customer `E2E-CUST-1` unless `customer` says otherwise. Lines credit revenue 4100 on cost
 * center `E2E-CC-1`; the "Vat 7%" profile is used for `vat` lines, "None" for the rest. Lines never send
 * `vat_chart_of_accounts_id` (the output VAT account then comes from gl_setting). `tag` goes into the description,
 * so the document is findable. `references` (invoice only) apply posted credit notes: `{ id: <CN id>, amount }`.
 */
export async function createArDoc(
  docType: ArDocType,
  opts: {
    tag: string;
    lines: ArLine[];
    customer?: "E2E-CUST-1" | "E2E-CUST-2";
    taxInvoice?: boolean;
    references?: { id: string; amount: number }[];
  },
): Promise<{ id: string; no: string }> {
  revenueId ??= accountId("4100");
  costCenterId ??= byCode("/cost-centers", "E2E-CC-1", "cost center");
  const [rev, cc, cust, vat, none] = await Promise.all([
    revenueId,
    costCenterId,
    customer(opts.customer ?? "E2E-CUST-1"),
    taxProfile("Vat 7%"),
    taxProfile("None"),
  ]);
  const r = ok(
    await buSend(CREATOR, "POST", "/ar-invoice", {
      doc_type: docType,
      doc_date: today(),
      customer_id: cust,
      description: `e2e ${opts.tag}`,
      ...(opts.taxInvoice ? { is_tax_invoice: true } : {}),
      ...(opts.references?.length
        ? { references: opts.references.map((x) => ({ ref_ar_invoice_id: x.id, applied_amount: x.amount })) }
        : {}),
      details: {
        add: opts.lines.map((l, i) => ({
          sequence_no: i + 1,
          description: `${opts.tag} line ${i + 1}`,
          quantity: l.qty,
          unit_price: l.price,
          ...(l.discountPct ? { discount_pct: l.discountPct } : {}),
          cr_chart_of_accounts_id: rev,
          cr_cost_center_id: cc,
          vat_tax_profile_id: l.vat ? vat : none,
        })),
      },
    }),
    `POST ar-invoice (${docType})`,
  );
  const id = String(r.body.data.id);
  return { id, no: String(r.body.data.doc_no ?? (await getArDoc(id)).no) };
}

/** Submit; with no `ar_invoice` workflow active this posts, otherwise the document goes into review. */
export const submitArDoc = (id: string, role: Role = CREATOR) => postAction(role, `/ar-invoice/${id}`, "submit");
export const approveArDoc = (id: string, role: Role = APPROVER) => postAction(role, `/ar-invoice/${id}`, "approve");
/** Reject needs a reason: with none the BE answers AR_INVOICE_REJECT_REASON_REQUIRED (422). */
export const rejectArDoc = (id: string, role: Role = APPROVER, reason?: string) =>
  postAction(role, `/ar-invoice/${id}`, "reject", reason === undefined ? {} : { reason });
/** Send back to `stage` (the stage name or id the detail page offers). */
export const reviewArDoc = (id: string, role: Role, stage: string) => postAction(role, `/ar-invoice/${id}`, "review", { stage });
/** Void a draft or reverse a posted document (needs `accounting.ar.void`); a missing reason is refused by the BE. */
export const voidArDoc = (id: string, role: Role = CREATOR, reason?: string) =>
  postAction(role, `/ar-invoice/${id}`, "void", reason === undefined ? {} : { reason });
/** Delete is draft-only and takes no body. */
export const deleteArDoc = (id: string, role: Role = CREATOR): Promise<ApiResult> => buSend(role, "DELETE", `/ar-invoice/${id}`);

/** Posted credit notes (same customer / currency) an invoice may still reference, with their open balance. */
export async function referenceCandidates(invoiceId: string): Promise<{ id: string; available: number }[]> {
  const r = ok(await buSend(CREATOR, "GET", `/ar-invoice/${invoiceId}/reference-candidates`), "GET reference-candidates");
  const rows: Row[] = Array.isArray(r.body?.data) ? r.body.data : [];
  return rows.map((c) => ({ id: String(c.id), available: Number(c.available_amount) }));
}

async function arWorkflow(): Promise<Row> {
  const list = ok(await buConfigSend(CREATOR, "GET", "/workflows/ar-invoice?perpage=100"), "GET workflows/ar-invoice").body?.data;
  const w = (Array.isArray(list) ? list : []).find((x: Row) => x.workflow_type === "ar_invoice") ?? (Array.isArray(list) ? list[0] : undefined);
  if (!w) throw new Error("no ar_invoice workflow on the TEST BU - run `bun run data:reset --yes`");
  return ok(await buConfigSend(CREATOR, "GET", `/workflows/${w.id}`), `GET workflow ${w.id}`).body.data;
}

export async function arWorkflowActive(): Promise<boolean> {
  return Boolean((await arWorkflow()).is_active);
}

/** Switch the `ar_invoice` workflow on or off (a no-op when it is already so). The caller restores it. */
export async function setArWorkflowActive(on: boolean): Promise<void> {
  const cur = await arWorkflow();
  if (Boolean(cur.is_active) === on) return;
  ok(
    await buConfigSend(CREATOR, "PUT", `/workflows/${cur.id}`, {
      name: cur.name,
      workflow_type: cur.workflow_type,
      description: cur.description,
      is_active: on,
      doc_version: cur.doc_version,
      data: cur.data,
    }),
    `PUT workflow is_active=${on}`,
  );
}
