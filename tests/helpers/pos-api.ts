import { buConfigSend, buSend, buSendForm, type ApiResult, type Role } from "./bu-api";

/**
 * POS import / Sales Consumption through the API (TEST BU only). Reads verify what the UI did;
 * writes seed days and undo them. Admin, not StoreManager: StoreManager's profile on the TEST BU
 * carries only `stock_out.view` (no create / delete), and posting or voiding an SC creates and
 * voids stock-outs.
 * ใช้ Admin เพราะ StoreManager มีแค่ stock_out.view แต่ post/void SC สร้างและยกเลิก stock-out
 */
const ROLE: Role = "Admin";
const RECIPE_A = "E2E-POS-A";

export type ScStatus = "pending" | "posted" | "voided";
export interface ScRow {
  id: string;
  sc_no: string;
  sale_date: string;
  status: ScStatus;
  [k: string]: unknown;
}

const qs = (q: Record<string, string | number | undefined | null>) => {
  const p = Object.entries(q).filter(([, v]) => v !== undefined && v !== null && v !== "");
  return p.length ? `?${p.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&")}` : "";
};

/** A list body is either `data: []` or `data: { items: [] }` depending on the endpoint. */
export function rowsOf<T = any>(body: any): T[] {
  const d = body?.data;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.items)) return d.items;
  return [];
}

function must<T>(what: string, r: ApiResult<T>): ApiResult<T> {
  if (r.status < 200 || r.status > 299) throw new Error(`pos-api: ${what} -> ${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
  return r;
}

const POS = "/pos-sales";

export function importSimphony(file: string, fileName: string): Promise<ApiResult> {
  const form = new FormData();
  form.append("file", new Blob([file], { type: "text/plain" }), fileName);
  return buSendForm(ROLE, `${POS}/imports/simphony`, form);
}
export const cancelImport = (id: string) => buSend(ROLE, "POST", `${POS}/imports/${id}/cancel`, {});
export const listImports = () => buSend(ROLE, "GET", `${POS}/imports?perpage=100`);
export const importDetail = (id: string) => buSend(ROLE, "GET", `${POS}/imports/${id}`);
export const listOutlets = (storeId?: string) => buSend(ROLE, "GET", `${POS}/outlets${qs({ store_id: storeId })}`);
export const listItems = (storeId?: string, status?: "unmapped" | "mapped" | "ignored") =>
  buSend(ROLE, "GET", `${POS}/items${qs({ perpage: 100, store_id: storeId, status })}`);
export const mapOutlet = (id: string, locationId: string | null) =>
  buSend(ROLE, "PATCH", `${POS}/outlets/${id}`, { location_id: locationId });
export const mapItem = (id: string, body: { recipe_id?: string | null; is_ignored?: boolean }) =>
  buSend(ROLE, "PATCH", `${POS}/items/${id}`, body);

export const scList = (q: { date_from: string; date_to: string; status?: ScStatus }) =>
  buSend(ROLE, "GET", `${POS}/sales-consumptions${qs({ perpage: 100, ...q })}`);
/** The non-voided SC of a sale day, or null. */
export async function scForDay(day: string): Promise<ScRow | null> {
  const r = must("list sales-consumptions", await scList({ date_from: day, date_to: day }));
  return rowsOf<ScRow>(r.body).find((s) => s.sale_date?.slice(0, 10) === day && s.status !== "voided") ?? null;
}
export const scDetail = (id: string) => buSend(ROLE, "GET", `${POS}/sales-consumptions/${id}`);
export const scUpdateLines = (
  id: string,
  body: { line_ids: string[]; location_id?: string | null; recipe_id?: string | null; is_ignored?: boolean | null; set_item_default?: boolean },
) => buSend(ROLE, "PATCH", `${POS}/sales-consumptions/${id}/lines`, body);
export const scVerify = (id: string) => buSend(ROLE, "POST", `${POS}/sales-consumptions/${id}/verify-onhand`, {});
export const scPost = (id: string, docVersion: number) =>
  buSend(ROLE, "POST", `${POS}/sales-consumptions/${id}/post`, { doc_version: docVersion });
export const scVoid = (id: string, reason: string, docVersion: number) =>
  buSend(ROLE, "POST", `${POS}/sales-consumptions/${id}/void`, { void_reason: reason, doc_version: docVersion });
export const scCalendar = (month: string) => buSend(ROLE, "GET", `${POS}/sales-consumptions/calendar?month=${month}`);

/** Live on-hand of a product at a location as of a day (the figure specs take deltas of). */
export async function onHand(productId: string, locationId: string, atDate: string): Promise<number> {
  const r = must("inventory-info", await buSend(ROLE, "GET", `/inventory-info/${productId}/${locationId}?at_date=${atDate}`));
  return Number(r.body?.data?.on_hand_qty);
}
export const voidStockOut = (id: string) => buSend(ROLE, "DELETE", `/stock-outs/${id}/void`);

export async function assertPosReady(): Promise<void> {
  const fail = (why: string): never => {
    throw new Error(`POS not ready on TEST BU: ${why}`);
  };
  const s = await buSend(ROLE, "GET", `${POS}/status`);
  if (s.status !== 200) fail(`/pos-sales/status -> ${s.status}`);
  const brands: unknown = s.body?.data?.enabled_brands;
  if (!Array.isArray(brands) || !brands.includes("simphony")) fail("Simphony is not enabled - run data:reset");
  const r = await buConfigSend(ROLE, "GET", `/recipes?search=${RECIPE_A}&perpage=50`);
  if (r.status !== 200 || !rowsOf(r.body).some((x: any) => x.code === RECIPE_A)) fail(`recipe ${RECIPE_A} is missing - run data:reset`);
}

/**
 * Undo everything a run left for one POS store: void its posted SCs, then cancel its imports.
 * Throws on any non-2xx so a leftover is never silent.
 */
export async function cleanupPosRun(storeKey: string): Promise<void> {
  const imports = rowsOf<any>(must("list imports", await listImports()).body);
  for (const imp of imports) {
    if (imp.status !== "success" || imp.cancelled_at) continue;
    const detail = must(`import ${imp.id}`, await importDetail(imp.id)).body?.data;
    if (detail?.store?.store_key !== storeKey) continue;
    const sc = imp.sales_consumption as { id: string; status: ScStatus } | null;
    if (sc?.status === "posted") {
      const d = must(`sc ${sc.id}`, await scDetail(sc.id)).body?.data;
      must(`void sc ${sc.id}`, await scVoid(sc.id, "e2e cleanup", Number(d.doc_version)));
    }
    must(`cancel import ${imp.id}`, await cancelImport(imp.id));
  }
}
