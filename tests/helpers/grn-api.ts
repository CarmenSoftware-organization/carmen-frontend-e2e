import { buConfigSend, buGet, buSend, type ApiResult } from "./bu-api";

/**
 * GRN seeding through the backend (purchase role): clones the seeded "STD grn.draft"
 * (manual GRN, 2 lines) so a case gets a document it may freely edit, commit or void.
 * The seeded rows themselves (STD-grn.draft / .received / .committed / .partial) are read-only
 * fixtures for list/view cases - never mutate them.
 */
const BASE = "/good-received-notes";

export interface GrnRecord {
  id: string;
  grn_no: string;
  doc_status: string;
  doc_type: string;
  invoice_no: string | null;
  description: string | null;
  total_amount: number;
  doc_version: number;
  vendor: { id: string; name: string };
  good_received_note_detail: Array<{
    id: string;
    product: { id: string; code: string; name: string };
    location: { id: string; code: string; name: string };
    items: Array<{ id: string; received_qty: number; received_price: number }>;
  }>;
  extra_cost: { extra_cost_detail?: unknown[] } | null;
}

export async function getGrn(id: string): Promise<{ status: number; data?: GrnRecord }> {
  const r = await buGet("Purchase", `${BASE}/${id}`);
  return { status: r.status, data: r.body?.data };
}

export async function listGrns(search = ""): Promise<Array<{ id: string; grn_no: string; doc_status: string; invoice_no: string }>> {
  const q = search ? `&search=${encodeURIComponent(search)}` : "";
  const r = await buGet("Purchase", `${BASE}?perpage=100${q}`);
  if (r.status !== 200) throw new Error(`list GRN -> ${r.status}`);
  return r.body.data;
}

/** The seeded GRN with the given `doc_status` (draft | saved | committed). */
export async function seededGrn(status: "draft" | "saved" | "committed"): Promise<{ id: string; grn_no: string; invoice_no: string }> {
  // data:reset seeds one document per invoice no.; the order of the list is not stable, so pick by invoice no.
  const invoice = { draft: "STD-grn.draft", saved: "STD-grn.received", committed: "STD-grn.committed" }[status];
  const hit = (await listGrns("STD-grn")).find((g) => g.invoice_no === invoice && g.doc_status === status);
  if (!hit) throw new Error(`no seeded GRN ${invoice} with status ${status} - run \`bun run data:reset --yes\``);
  return hit;
}

function line(l: any, qty?: number, price?: number) {
  const it = l.items[0];
  const q = qty ?? it.received_qty;
  const p = price ?? it.received_price;
  return {
    product_id: l.product.id,
    location_id: l.location.id,
    foc_qty: 0,
    foc_unit_conversion_factor: 1,
    approved_qty: 0,
    received_qty: q,
    received_unit_id: it.received_unit.id,
    received_base_qty: q,
    received_unit_conversion_factor: 1,
    received_price: p,
    tax_rate: 0,
    tax_amount: 0,
    is_tax_adjustment: false,
    is_tax_included: false,
    discount_rate: 0,
    discount_amount: 0,
    is_discount_adjustment: false,
    net_amount: q * p,
    total_price: q * p,
  };
}

/** A fresh draft manual GRN (2 lines x 5 @ 100 unless `lines`/`qty` say otherwise). */
export async function createDraftGrn(invoiceNo: string, opts: { lines?: number; qty?: number } = {}): Promise<GrnRecord> {
  const src = await seededGrn("draft");
  const full = (await buGet("Purchase", `${BASE}/${src.id}`)).body.data;
  const n = opts.lines ?? 2;
  const body = {
    grn_date: full.grn_date,
    invoice_no: invoiceNo,
    invoice_date: full.invoice_date,
    description: `E2E ${invoiceNo}`,
    doc_status: "draft",
    doc_type: "manual",
    post_type: full.post_type,
    received_by_id: full.received_by?.id ?? null,
    is_active: true,
    vendor_id: full.vendor.id,
    currency_id: full.currency.id,
    exchange_rate: 1,
    good_received_note_detail: { add: full.good_received_note_detail.slice(0, n).map((l: any) => line(l, opts.qty)) },
  };
  const r = await buSend("Purchase", "POST", BASE, body);
  if (r.status >= 300) throw new Error(`create GRN -> ${r.status} ${JSON.stringify(r.body).slice(0, 400)}`);
  const got = await getGrn(r.body.data.id);
  return got.data!;
}

export async function deleteGrn(id: string): Promise<number> {
  return (await buSend("Purchase", "DELETE", `${BASE}/${id}`)).status;
}

/** Delete every non-committed GRN whose invoice number starts with `prefix` (leftovers of a failed run). */
export async function deleteGrnsByPrefix(prefix: string): Promise<number> {
  let n = 0;
  for (const g of await listGrns(prefix)) {
    if (!String(g.invoice_no).startsWith(prefix)) continue;
    n += (await deleteGrn(g.id)) < 300 ? 1 : 0;
  }
  return n;
}

/** The TEST BU dataset has no extra-cost types; a case that needs one creates it and removes it again. */
export async function createExtraCostType(name: string): Promise<string> {
  const r = await buConfigSend("Purchase", "POST", "/extra-cost-types", { name, description: "e2e", is_active: true });
  if (r.status >= 300) throw new Error(`create extra-cost type -> ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
  return r.body.data.id as string;
}

export async function deleteExtraCostType(id: string): Promise<number> {
  return (await buConfigSend("Purchase", "DELETE", `/extra-cost-types/${id}`)).status;
}

/**
 * Save a draft GRN and commit it (purchase role): draft -> saved -> committed. Moves stock, so TEST BU only; a committed
 * GRN can no longer be deleted or voided. Returns the raw commit result (a refusal, e.g. a missing account mapping when
 * the BU raises AP invoices from GRN, comes back as a 4xx and leaves the GRN `saved`); a failing save throws.
 */
export async function commitGrn(id: string): Promise<ApiResult> {
  const draft = await getGrn(id);
  if (draft.status !== 200) throw new Error(`GET GRN ${id} -> ${draft.status}`);
  const saved = await buSend("Purchase", "PATCH", `${BASE}/${id}/save`, { doc_version: draft.data!.doc_version });
  if (saved.status >= 300) throw new Error(`save GRN -> ${saved.status} ${JSON.stringify(saved.body).slice(0, 300)}`);
  const cur = await getGrn(id);
  return buSend("Purchase", "PATCH", `${BASE}/${id}/commit`, { doc_version: cur.data!.doc_version });
}
