import { buGet, buSend } from "./bu-api";

/**
 * PR template seeding through the backend (purchase role). The UI creates templates
 * too (TC-PRT-010001 does), but every other case needs one it may freely edit or delete,
 * and building lookups row by row in each case is slow and not what those cases test.
 * Lines are copied from the seeded "STD PR template" so location / product / unit ids
 * are ones the TEST BU really has.
 */
const BASE = "/purchase-request-templates";

export interface PrtLine {
  location_id: string;
  delivery_point_id: string;
  product_id: string;
  product_name: string;
  requested_unit_id: string;
  requested_unit_name: string;
  currency_id: string;
  requested_qty: number;
}

export interface PrtRecord {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  doc_version: number;
  workflow?: { id: string; name: string };
  purchase_request_template_detail: Array<{
    id: string;
    requested_qty: number;
    product?: { id: string; name: string; code: string };
    location?: { id: string; code: string; name: string };
  }>;
}

export async function listTemplates(search = ""): Promise<PrtRecord[]> {
  const q = search ? `&search=${encodeURIComponent(search)}` : "";
  const r = await buGet("Purchase", `${BASE}?perpage=100${q}`);
  if (r.status !== 200) throw new Error(`list templates -> ${r.status}`);
  return r.body.data as PrtRecord[];
}

export async function getTemplate(id: string): Promise<{ status: number; data?: PrtRecord }> {
  const r = await buGet("Purchase", `${BASE}/${id}`);
  return { status: r.status, data: r.body?.data };
}

/** The seeded template every run of `data:reset` guarantees (verify-dataset min 1). */
export async function seededTemplate(): Promise<PrtRecord> {
  const all = await listTemplates();
  const std = all.find((t) => t.name === "STD PR template") ?? all.find((t) => (t.purchase_request_template_detail ?? []).length >= 2);
  if (!std) throw new Error("no seeded PR template with >= 2 lines - run `bun run data:reset --yes`");
  return std;
}

async function sourceLines(): Promise<{ workflowId: string; lines: any[] }> {
  const std = await seededTemplate();
  const full = await buGet("Purchase", `${BASE}/${std.id}`);
  const d = full.body.data;
  return { workflowId: d.workflow.id, lines: d.purchase_request_template_detail };
}

function linePayload(l: any, qty?: number) {
  const q = qty ?? l.requested_qty;
  return {
    location_id: l.location.id,
    delivery_point_id: l.delivery_point.id,
    product_id: l.product.id,
    product_name: l.product.name,
    inventory_unit_id: null,
    inventory_unit_name: "",
    requested_qty: q,
    requested_unit_id: l.requested_unit.id,
    requested_unit_name: l.requested_unit.name,
    requested_unit_conversion_factor: 1,
    requested_base_qty: q,
    currency_id: l.currency.id,
  };
}

/** Create a template as the purchase role. `lines: 0` makes one with no items. */
export async function createTemplate(
  name: string,
  opts: { description?: string; active?: boolean; lines?: number; qty?: number } = {},
): Promise<PrtRecord> {
  const { workflowId, lines } = await sourceLines();
  const n = opts.lines ?? 2;
  const r = await buSend("Purchase", "POST", BASE, {
    name,
    description: opts.description ?? "",
    workflow_id: workflowId,
    is_active: opts.active ?? true,
    purchase_request_template_detail: { add: lines.slice(0, n).map((l) => linePayload(l, opts.qty)), update: [], delete: [] },
  });
  if (r.status >= 300) throw new Error(`create template -> ${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
  const id = r.body.data.id as string;
  const got = await getTemplate(id);
  return got.data!;
}

export async function deleteTemplate(id: string): Promise<number> {
  return (await buSend("Purchase", "DELETE", `${BASE}/${id}`)).status;
}

/** Remove every template whose name starts with `prefix` (leftovers of a failed run). */
export async function deleteTemplatesByPrefix(prefix: string): Promise<number> {
  const all = await listTemplates(prefix);
  let n = 0;
  for (const t of all) if (t.name.startsWith(prefix)) n += (await deleteTemplate(t.id)) < 300 ? 1 : 0;
  return n;
}
