import { buConfigSend, buSend, type ApiResult, type Role } from "./bu-api";
import { accountId, APPROVER, CREATOR, listAllRows, postAction, today } from "./gl-api";
import { round, whtOf } from "./money";

/**
 * AP seeding and reads through the backend on the TEST BU. Creates drafts the spec may freely submit, pay or void;
 * the `E2E-AP-*` read set is looked up with `seededApDoc` and never mutated.
 * Workflow actions return the raw result (a spec may expect a refusal); creators throw on failure.
 * Independent of `scripts/data-reset` on purpose.
 */
export type ApDocType = "invoice" | "debit_note" | "credit_note" | "deposit";

export interface ApLine {
  /** Detail id (what a payment allocates against). */
  id: string;
  total: number;
  unpaid: number;
  net: number;
  vat: number;
}

export interface ApDoc {
  id: string;
  no: string;
  type: string;
  status: string;
  invoiceNo: string;
  net: number;
  vat: number;
  total: number;
  /** Open balance (`outstanding_amount`). */
  open: number;
  glJvId: string | null;
  voidGlJvId: string | null;
  lines: ApLine[];
}

type Row = Record<string, any>;

const ok = (r: ApiResult, what: string) => {
  if (r.status < 200 || r.status >= 300) {
    throw new Error(`${what} -> ${r.status} ${JSON.stringify(r.body?.message ?? r.body).slice(0, 300)}`);
  }
  return r;
};

function toDoc(d: Row): ApDoc {
  return {
    id: String(d.id),
    no: String(d.doc_no),
    type: String(d.doc_type),
    status: String(d.doc_status),
    invoiceNo: String(d.vendor_invoice_no ?? ""),
    net: Number(d.net_amount),
    vat: Number(d.vat_amount),
    total: Number(d.total_amount),
    open: Number(d.outstanding_amount),
    glJvId: d.gl_jv_id ?? null,
    voidGlJvId: d.void_gl_jv_id ?? null,
    // The detail rows come back as `tb_ap_invoice_detail`, not `details`.
    lines: ((d.tb_ap_invoice_detail ?? []) as Row[]).map((l) => ({
      id: String(l.id),
      total: Number(l.total_amount),
      unpaid: Number(l.unpaid_amount),
      net: Number(l.net_amount),
      vat: Number(l.vat_amount),
    })),
  };
}

/** Totals, status and open balance of one document. */
export async function getApDoc(id: string): Promise<ApDoc> {
  return toDoc(ok(await buSend(CREATOR, "GET", `/ap-invoice/${id}`), `GET ap-invoice ${id}`).body.data);
}

/** A read-set document by its key (`E2E-AP-POSTED` ...), which sits in `vendor_invoice_no`. */
export async function seededApDoc(key: string): Promise<ApDoc> {
  const hit = (await listAllRows(CREATOR, `/ap-invoice?search=${encodeURIComponent(key)}`)).find((d) => d.vendor_invoice_no === key);
  if (!hit) throw new Error(`no seeded AP document ${key} on the TEST BU - run \`bun run data:reset --yes\``);
  return getApDoc(String(hit.id));
}

let vendorId: Promise<string> | null = null;
/** The first vendor of the BU; data:reset gives every vendor an AP control account. */
function firstVendor(): Promise<string> {
  vendorId ??= buConfigSend(CREATOR, "GET", "/vendors?perpage=1").then((r) => {
    const v = r.body?.data?.[0];
    if (r.status !== 200 || !v) throw new Error(`no vendor on the TEST BU (GET vendors -> ${r.status}) - run data:reset`);
    return String(v.id);
  });
  return vendorId;
}

let vatProfileId: Promise<string> | null = null;
function profileId(name: string): Promise<string> {
  const find = async () => {
    const hit = (await listAllRows(CREATOR, "/tax-profiles", true)).find((t) => t.name === name);
    if (!hit) throw new Error(`no tax profile "${name}" on the TEST BU - run data:reset`);
    return String(hit.id);
  };
  if (name === "Vat 7%") return (vatProfileId ??= find());
  return find();
}

/**
 * A draft AP document. Every line carries "Vat 7%" unless `vat: false`; `incVat` marks the price as VAT-inclusive.
 * Deposit lines debit the advance-deposit account, everything else the expense account (5300).
 * `tag` becomes `vendor_invoice_no`, so the document is findable.
 */
export async function createApDoc(
  type: ApDocType,
  opts: { lines: { qty: number; price: number; incVat?: boolean; vat?: boolean }[]; tag: string },
): Promise<{ id: string; no: string }> {
  const dr = await accountId(type === "deposit" ? "1180" : "5300");
  const vat = await profileId("Vat 7%");
  const day = today();
  const r = ok(
    await buSend(CREATOR, "POST", "/ap-invoice", {
      doc_type: type,
      doc_date: day,
      vendor_id: await firstVendor(),
      vendor_invoice_no: opts.tag,
      invoice_date: day,
      description: `e2e ${opts.tag}`,
      details: {
        add: opts.lines.map((l, i) => ({
          sequence_no: i + 1,
          description: `${opts.tag} line ${i + 1}`,
          quantity: l.qty,
          unit_price: l.price,
          dr_chart_of_accounts_id: dr,
          ...(l.vat === false ? {} : { vat_tax_profile_id: vat }),
          ...(l.incVat ? { vat_is_included: true } : {}),
        })),
      },
    }),
    `POST ap-invoice (${type})`,
  );
  const id = String(r.body.data.id);
  return { id, no: (await getApDoc(id)).no };
}

/** Submit; with no workflow on AP invoices this posts. */
export const submitApDoc = (id: string, role: Role = CREATOR) => postAction(role, `/ap-invoice/${id}`, "submit");
export const approveApDoc = (id: string, role: Role = APPROVER) => postAction(role, `/ap-invoice/${id}`, "approve");
/** Void a draft, or reverse a posted document out of the ledger (needs `accounting.ap.void`). */
export const voidApDoc = (id: string, role: Role = CREATOR, reason = "e2e") => postAction(role, `/ap-invoice/${id}`, "void", { reason });

/**
 * A draft payment settling `invoiceIds` in full or in part, allocated across each invoice's lines in order.
 * With `whtProfile`, one WHT row on the "WHT 3%" profile is added at payment on the pre-VAT base
 * (the applied share of the invoice net), and the cash leg is reduced so `applied = cash + WHT` (ap-payment-save-rules.md:17).
 */
export async function createPayment(
  invoiceIds: { id: string; amount: number }[],
  opts: { whtProfile?: boolean } = {},
): Promise<{ id: string }> {
  const allocations: { ap_invoice_detail_id: string; applied_amount: number }[] = [];
  let applied = 0;
  let whtBase = 0;
  for (const inv of invoiceIds) {
    const doc = await getApDoc(inv.id);
    let left = inv.amount;
    for (const line of doc.lines) {
      if (left <= 0) break;
      const take = Math.min(left, line.unpaid);
      if (take <= 0) continue;
      allocations.push({ ap_invoice_detail_id: line.id, applied_amount: round(take, 2) });
      whtBase += line.total > 0 ? (line.net * take) / line.total : 0;
      left = round(left - take, 2);
    }
    if (left > 0) throw new Error(`payment: ${doc.no} has only ${round(inv.amount - left, 2)} open, ${inv.amount} asked`);
    applied = round(applied + inv.amount, 2);
  }
  const bank = (await listAllRows(CREATOR, "/bank-accounts", true)).find((b) => b.code === "E2E-BANK");
  const type = (await listAllRows(CREATOR, "/payment-types", true)).find((t) => t.code === "E2E-PT");
  if (!bank || !type) throw new Error("no E2E-BANK / E2E-PT on the TEST BU - run data:reset");
  let wht: unknown[] | undefined;
  let whtTotal = 0;
  if (opts.whtProfile) {
    const profile = (await listAllRows(CREATOR, "/tax-profiles", true)).find((t) => t.name === "WHT 3%");
    if (!profile) throw new Error('no tax profile "WHT 3%" on the TEST BU - run data:reset');
    const base = round(whtBase, 2);
    whtTotal = whtOf(base, Number(profile.rate), 2);
    wht = [{ wht_tax_profile_id: String(profile.id), base_amount: base, wht_amount: whtTotal }];
  }
  const doc = await getApDoc(invoiceIds[0].id);
  const vendor = ok(await buSend(CREATOR, "GET", `/ap-invoice/${doc.id}`), "GET ap-invoice").body.data.vendor_id;
  const r = ok(
    await buSend(CREATOR, "POST", "/ap-payment", {
      vendor_id: vendor,
      payment_date: today(),
      bank_account_id: String(bank.id),
      payment_type_id: String(type.id),
      payment_method: "bank_transfer",
      payment_amount: round(applied - whtTotal, 2),
      description: "e2e payment",
      allocations,
      ...(wht ? { wht } : {}),
    }),
    "POST ap-payment",
  );
  return { id: String(r.body.data.id) };
}

export const submitPayment = (id: string, role: Role = CREATOR) => postAction(role, `/ap-payment/${id}`, "submit");
export const approvePayment = (id: string, role: Role = APPROVER) => postAction(role, `/ap-payment/${id}`, "approve");
export const voidPayment = (id: string, role: Role = CREATOR, reason = "e2e") => postAction(role, `/ap-payment/${id}`, "void", { reason });
