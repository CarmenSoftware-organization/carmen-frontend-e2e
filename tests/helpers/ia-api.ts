import { buConfigSend, buSend, type ApiResult, type Role } from "./bu-api";

/**
 * Inventory Adjustment (Stock In / Stock Out) through the API, TEST BU only, as Admin
 * (StoreManager has only stock_out.view). Specs 731/732 build state, read live figures and clean up here.
 * ใช้ Admin เพราะ StoreManager มีแค่ stock_out.view
 */
const ROLE: Role = "Admin";
export type IaType = "stock-in" | "stock-out";
export const IA_TAG = "E2E-IA";
const PRODUCT_A = "E2E-IA-A";
const PRODUCT_B = "E2E-IA-B";

const PATH: Record<IaType, string> = { "stock-in": "/stock-ins", "stock-out": "/stock-outs" };
const DATE_KEY: Record<IaType, string> = { "stock-in": "si_date", "stock-out": "so_date" };
const LINES_KEY: Record<IaType, string> = { "stock-in": "stock_in_detail", "stock-out": "stock_out_detail" };

function must<T>(what: string, r: ApiResult<T>): ApiResult<T> {
  if (r.status < 200 || r.status > 299) throw new Error(`ia-api: ${what} -> ${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
  return r;
}

const rows = (body: any): any[] => (Array.isArray(body?.data) ? body.data : Array.isArray(body?.data?.items) ? body.data.items : []);

export interface IaLine {
  productId: string;
  qty: number;
  /** cost_per_unit; defaults to 0 (Stock Out ignores it - cost comes from the layers). */
  cost?: number;
}
export interface IaBody {
  date: string;
  locationId: string;
  adjustmentTypeId: string;
  description: string;
  lines: IaLine[];
}

/** POST a draft. Field names follow the gateway DTO (si_date / so_date, stock_in_detail / stock_out_detail). */
export function createIa(type: IaType, body: IaBody): Promise<ApiResult> {
  return buSend(ROLE, "POST", PATH[type], {
    [DATE_KEY[type]]: body.date,
    description: body.description,
    adjustment_type_id: body.adjustmentTypeId,
    location_id: body.locationId,
    [LINES_KEY[type]]: {
      add: body.lines.map((l) => ({
        product_id: l.productId,
        qty: l.qty,
        cost_per_unit: l.cost ?? 0,
        total_cost: l.qty * (l.cost ?? 0),
      })),
    },
  });
}

/**
 * PATCH /:id/commit. The DTO requires an integer `doc_version`; when omitted the body is sent empty on
 * purpose (Task 4/5 probe what the backend does with a commit that has no version).
 */
export const commitIa = (type: IaType, id: string, docVersion?: number) =>
  buSend(ROLE, "PATCH", `${PATH[type]}/${id}/commit`, docVersion === undefined ? {} : { doc_version: docVersion });

/** DELETE /:id/void with `void_reason` (what the FE sends); `docVersion` is optional. */
export const voidIa = (type: IaType, id: string, reason: string, docVersion?: number) =>
  buSend(ROLE, "DELETE", `${PATH[type]}/${id}/void`, { void_reason: reason, ...(docVersion === undefined ? {} : { doc_version: docVersion }) });

export const deleteIa = (type: IaType, id: string) => buSend(ROLE, "DELETE", `${PATH[type]}/${id}`);

/** PATCH /:id/save. `body` is the raw update DTO: `{ doc_version, description?, <si|so>_date?, stock_*_detail: { add/update/remove } }`. */
export const updateIa = (type: IaType, id: string, body: Record<string, unknown>) =>
  buSend(ROLE, "PATCH", `${PATH[type]}/${id}/save`, body);

export const getIa = (type: IaType, id: string) => buSend(ROLE, "GET", `${PATH[type]}/${id}`);
export const movementsOf = (type: IaType, id: string) => buSend(ROLE, "GET", `${PATH[type]}/${id}/stock-movements`);

/** Every page of the list (perpage 100), optionally narrowed by `doc_status` and a description/number search. */
export async function listIa(type: IaType, opts: { status?: string; search?: string } = {}): Promise<any[]> {
  const out: any[] = [];
  for (let page = 1; ; page++) {
    const q = `?page=${page}&perpage=100${opts.search ? `&search=${encodeURIComponent(opts.search)}` : ""}`;
    const r = must(`list ${type}`, await buSend(ROLE, "GET", `${PATH[type]}${q}`));
    out.push(...rows(r.body));
    if (page >= Number((r.body as any)?.paginate?.pages ?? 1)) break;
  }
  return opts.status ? out.filter((d) => d.doc_status === opts.status) : out;
}

/**
 * Live stock of a product at a location as of a day, from `GET /inventory-info/:product/:location?at_date=`.
 * `qty` = on_hand_qty. The endpoint exposes no total value, so `value` = sum(balance_qty x cost_per_unit)
 * over its `cost_layers` ledger (in rows positive, out rows negative balance_qty, so it nets to the stock value).
 */
export async function stockAt(productId: string, locationId: string, atDate: string): Promise<{ qty: number; value: number }> {
  const d = must("inventory-info", await buSend(ROLE, "GET", `/inventory-info/${productId}/${locationId}?at_date=${atDate}`)).body?.data;
  const layers: any[] = d?.cost_layers ?? [];
  const value = layers.reduce((n, l) => n + Number(l.balance_qty ?? 0) * Number(l.cost_per_unit ?? 0), 0);
  return { qty: Number(d?.on_hand_qty ?? 0), value };
}

/**
 * What an issue draws from, as `{qty, cost}` layers, as of `atDate`.
 * `cost_layers` of `GET /inventory-info/...` is NOT a list of remaining lots: it is a ledger of every lot ever posted
 * (adjustment_in rows keep their full balance_qty even after an issue or a void, adjustment_out rows carry a negative one),
 * so only its signed sum is meaningful (see `stockAt`). For the "average" method the BE prices an issue at the pooled
 * average, so one pooled layer (on-hand qty at value / on-hand) is the correct oracle input. Per-lot remaining qty for "fifo"
 * cannot be derived from that ledger: it throws instead of returning a wrong oracle.
 */
export async function costLayers(productId: string, locationId: string, atDate: string): Promise<Array<{ qty: number; cost: number }>> {
  const method = await calcMethod();
  if (method !== "average") throw new Error(`ia-api: costLayers cannot read per-lot remaining qty for the ${method} method from inventory-info (ledger, not lots)`);
  const s = await stockAt(productId, locationId, atDate);
  return s.qty > 0 ? [{ qty: s.qty, cost: s.value / s.qty }] : [];
}

/** The BU's cost method, from `GET /inventory-transactions/calculation-method` -> `data.calculation_method`. */
export async function calcMethod(): Promise<"average" | "fifo"> {
  const m = must("calculation-method", await buSend(ROLE, "GET", "/inventory-transactions/calculation-method")).body?.data?.calculation_method;
  if (m === "average" || m === "fifo") return m;
  throw new Error(`ia-api: unsupported calculation_method ${JSON.stringify(m)} (oracle knows average / fifo)`);
}

/**
 * Undo everything one spec left. Lists both types by description tag (`${IA_TAG} <spec>`, filtered
 * client-side over every page, so it does not depend on what the search matches), voids the completed
 * ones (stock-outs first so a Stock In void is not refused for missing stock), then deletes the drafts.
 * Throws on any failure.
 */
export async function cleanupIaRun(spec: "731" | "732"): Promise<void> {
  const prefix = `${IA_TAG} ${spec}`;
  const mine = async (type: IaType) => (await listIa(type)).filter((d) => String(d.description ?? "").startsWith(prefix));
  for (const type of ["stock-out", "stock-in"] as const) {
    for (const d of await mine(type)) {
      if (d.doc_status !== "completed") continue;
      // "accepted-bad": a wrongly accepted bad document (spec 732) whose commit had no stock effect; a void would only drift stock (R11).
      if (String(d.description ?? "").includes("accepted-bad")) continue;
      const v = must(`read ${type} ${d.id}`, await getIa(type, d.id)).body?.data;
      must(`void ${type} ${d.id}`, await voidIa(type, d.id, "e2e cleanup", Number(v?.doc_version)));
    }
  }
  for (const type of ["stock-out", "stock-in"] as const) {
    for (const d of await mine(type)) {
      if (d.doc_status === "draft") must(`delete ${type} ${d.id}`, await deleteIa(type, d.id));
    }
  }
}

export interface IaReady {
  productA: { id: string; code: string };
  productB: { id: string; code: string };
  locationId: string;
  /** Name of that location, what the form's Location lookup is searched with. */
  locationName: string;
  adjustmentTypeIn: string;
  adjustmentTypeOut: string;
  today: string;
}

/**
 * Preconditions of 731/732, each failing with a named reason: the two `ia` products exist and are linked to
 * exactly the same single location; Admin may read Stock In / Out (first GET not 403); the data-reset types
 * `E2E-IA-IN` (stock_in) and `E2E-IA-OUT` (stock_out) exist and are active (never SALE / EOP-*); an open period contains today.
 */
export async function assertIaReady(): Promise<IaReady> {
  const fail = (why: string): never => {
    throw new Error(`Inventory Adjustment not ready on TEST BU: ${why}`);
  };
  const first = await buSend(ROLE, "GET", `${PATH["stock-in"]}?perpage=1`);
  if (first.status === 403) fail("Admin lacks permission (GET /stock-ins -> 403)");
  if (first.status !== 200) fail(`GET /stock-ins -> ${first.status}`);

  const found = async (code: string) => {
    const r = await buConfigSend(ROLE, "GET", `/products?search=${code}&perpage=50`);
    const hit = rows(r.body).find((p) => p.code === code);
    if (!hit) return fail(`product ${code} is missing - run data:reset`);
    const d = must(`product ${code}`, await buConfigSend(ROLE, "GET", `/products/${hit.id}`)).body?.data;
    const active = ((d?.locations ?? []) as any[]).filter((l) => l.is_active !== false);
    const locs = active.map((l) => l.location?.id as string);
    return { id: hit.id as string, code, locs, locName: String(active[0]?.location?.name ?? "") };
  };
  const [a, b] = [await found(PRODUCT_A), await found(PRODUCT_B)];
  if (a.locs.length !== 1 || b.locs.length !== 1 || a.locs[0] !== b.locs[0]) {
    fail(`${PRODUCT_A}/${PRODUCT_B} must be linked to exactly the same single location (A: ${a.locs.join(",") || "none"}, B: ${b.locs.join(",") || "none"})`);
  }

  const types = rows(must("adjustment-types", await buConfigSend(ROLE, "GET", "/adjustment-types?perpage=100")).body);
  const pick = (code: string, kind: "stock_in" | "stock_out") =>
    types.find((t) => t.code === code && t.type === kind && t.is_active)?.id as string | undefined;
  const adjustmentTypeIn = pick("E2E-IA-IN", "stock_in") ?? fail("adjustment type E2E-IA-IN (active, stock_in) is missing - run data:reset");
  const adjustmentTypeOut = pick("E2E-IA-OUT", "stock_out") ?? fail("adjustment type E2E-IA-OUT (active, stock_out) is missing - run data:reset");

  const p = await buSend(ROLE, "GET", "/period-ends/current");
  if (p.status !== 200 || !p.body?.data?.start_at) fail(`current period -> ${p.status}`);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  const day = (iso: string) => String(iso).slice(0, 10);
  if (today < day(p.body.data.start_at) || today > day(p.body.data.end_at)) fail(`no open period contains today (${today})`);

  return { productA: { id: a.id, code: a.code }, productB: { id: b.id, code: b.code }, locationId: a.locs[0], locationName: a.locName, adjustmentTypeIn, adjustmentTypeOut, today };
}
