import { buConfigSend, buGet, buSend } from "./bu-api";
import { getGrn, listGrns } from "./grn-api";

/**
 * Credit-note seeding through the backend (purchase role): clones the seeded draft
 * (CN26110001, quantity return against GRN261100001, 1 line) so a case gets a draft it may
 * freely edit, submit or delete. The two seeded notes (draft / completed) are read-only fixtures.
 */
const BASE = "/credit-notes";

export interface CnRecord {
  id: string;
  cn_no: string;
  doc_status: string;
  credit_note_type: string;
  doc_version: number;
  tax_invoice_no: string | null;
  description: string | null;
  cn_reason?: { id: string; name: string } | null;
  grn?: { id: string; no: string; date: string } | null;
  credit_note_detail: Array<{ id: string; return_qty: number; price: number; cn_amount: number; product: { id: string; code: string; name: string } }>;
}

export async function getCn(id: string): Promise<{ status: number; data?: CnRecord }> {
  const r = await buGet("Purchase", `${BASE}/${id}`);
  return { status: r.status, data: r.body?.data };
}

export async function listCns(search = ""): Promise<Array<{ id: string; cn_no: string; doc_status: string; description: string | null }>> {
  const q = search ? `&search=${encodeURIComponent(search)}` : "";
  const r = await buGet("Purchase", `${BASE}?perpage=100${q}`);
  if (r.status !== 200) throw new Error(`list CN -> ${r.status}`);
  return r.body.data;
}

/** The seeded CN with the given status (draft = STD cn.draft, completed = STD cn.committed). */
export async function seededCn(status: "draft" | "completed"): Promise<{ id: string; cn_no: string }> {
  const marker = status === "draft" ? "STD cn.draft" : "STD cn.committed";
  const hit = (await listCns("STD cn")).find((c) => c.doc_status === status && c.description === marker);
  if (!hit) throw new Error(`no seeded CN "${marker}" - run \`bun run data:reset --yes\``);
  return hit;
}

export const REASON_NAME = "E2E-CN reason";

/**
 * The TEST BU dataset has no credit-note reason and the form requires one, so a describe creates
 * "E2E-CN reason" (reusing an existing one) in beforeAll and removes it in afterAll.
 */
export async function ensureReason(): Promise<{ id: string; name: string }> {
  const list = await buConfigSend("Purchase", "GET", "/credit-note-reasons?perpage=100");
  const hit = (list.body?.data ?? []).find((r: { name: string }) => r.name === REASON_NAME);
  if (hit) return hit;
  const r = await buConfigSend("Purchase", "POST", "/credit-note-reasons", { name: REASON_NAME, description: "e2e", is_active: true });
  if (r.status >= 300) throw new Error(`create CN reason -> ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
  return { id: r.body.data.id, name: REASON_NAME };
}

export async function deleteReason(): Promise<void> {
  const list = await buConfigSend("Purchase", "GET", "/credit-note-reasons?perpage=100");
  for (const r of list.body?.data ?? []) if (r.name === REASON_NAME) await buConfigSend("Purchase", "DELETE", `/credit-note-reasons/${r.id}`);
}

/**
 * A fresh draft CN (quantity return of 1 per line). One line: against the seeded committed GRN
 * "STD-grn.partial" (GRN261100002, Ground Beef). Two lines (`lines: 2`): against "STD-grn.received"
 * (GRN261100003, two products). Not against GRN261100001: the backend allows each product of a
 * receipt to be credited once, and the two seeded notes already use both products of that GRN.
 */
export async function createDraftCn(tag: string, opts: { lines?: number; grn?: "partial" | "received" } = {}): Promise<CnRecord> {
  const grn = (await listGrns("STD-grn")).find((g) => g.invoice_no === ((opts.grn ?? (opts.lines && opts.lines > 1 ? "received" : "partial")) === "received" ? "STD-grn.received" : "STD-grn.partial"));
  if (!grn) throw new Error("no seeded GRN STD-grn.partial - run `bun run data:reset --yes`");
  const g = (await getGrn(grn.id)).data as any;
  const reason = await ensureReason();
  const lines = g.good_received_note_detail.slice(0, opts.lines ?? 1).map((l: any) => {
    const it = l.items[0];
    const price = Number(it.received_price);
    return {
      location_id: l.location.id,
      location_name: l.location.name,
      product_id: l.product.id,
      product_name: l.product.name,
      requested_qty: 1,
      approved_qty: 1,
      return_qty: 1,
      return_unit_id: it.received_unit.id,
      return_unit_name: it.received_unit.name,
      currency_code: g.currency.code,
      price,
      net_amount: price,
      discount_rate: 0,
      discount_amount: 0,
      is_discount_adjustment: false,
      tax_profile_id: null,
      tax_rate: 0,
      tax_amount: 0,
      total_price: price,
      is_tax_adjustment: false,
      description: "",
    };
  });
  const body = {
    credit_note_type: "quantity_return",
    grn_id: g.id,
    grn_date: g.grn_date,
    vendor_id: g.vendor.id,
    cn_date: g.grn_date,
    cn_reason_id: reason.id,
    reference_number: g.grn_no,
    description: `E2E ${tag}`,
    currency_id: g.currency.id,
    exchange_rate: 1,
    tax_invoice_no: `E2E-CN-${tag}`,
    tax_invoice_date: g.grn_date,
    tax_amount: 0,
    discount_amount: 0,
    credit_note_detail: { add: lines },
  };
  const r = await buSend("Purchase", "POST", BASE, body);
  if (r.status >= 300) throw new Error(`create CN -> ${r.status} ${JSON.stringify(r.body).slice(0, 400)}`);
  return (await getCn(r.body.data.id)).data!;
}

export async function deleteCn(id: string): Promise<number> {
  return (await buSend("Purchase", "DELETE", `${BASE}/${id}`)).status;
}

/**
 * Delete every draft CN except the seeded "STD cn.draft" (leftovers of a failed run, and notes whose
 * description a case edited). A draft holds its products: the backend lets each product of a receipt
 * be credited once, so a stray draft makes the next case's seed fail with 005005.
 */
export async function deleteE2eCns(): Promise<number> {
  let n = 0;
  for (const c of await listCns()) {
    if (c.doc_status !== "draft" || c.description === "STD cn.draft") continue;
    n += (await deleteCn(c.id)) < 300 ? 1 : 0;
  }
  return n;
}
