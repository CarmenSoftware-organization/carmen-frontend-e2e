import { BU_CODE, type CostMethod } from "../test-users";
import { buSend, type ApiResult, type Role } from "./bu-api";
import { round } from "./money";

export type { CostMethod } from "../test-users";

/**
 * Shared cost oracle for the TEST BUs (average / fifo / average_per_location). Reads go through the BU-explicit
 * `buSend` as Admin (StoreManager has only stock_out.view), so a case never lands on the default BU by accident.
 * oracle ต้นทุนกลางของ TEST BU ทั้งสาม อ่านผ่าน bu ที่ระบุชัดเสมอ
 */
const ROLE: Role = "Admin";

export interface CostLayer {
  qty: number;
  cost: number;
}

function must<T>(what: string, r: ApiResult<T>): ApiResult<T> {
  if (r.status < 200 || r.status > 299) throw new Error(`costing: ${what} -> ${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
  return r;
}

/**
 * Expected cost of issuing `issueQty` from `layers` (oldest first). Pure.
 * average / average_per_location: issueQty x (sum(qty x cost) / sum(qty)) over the layers passed in (the caller decides
 * the pool: BU-wide or one location); fifo: consume layers in the given order.
 * Rounded to 2 places once, at the end, so the oracle never hides the backend's own rounding.
 * Throws when the issue exceeds the layers' total.
 */
export function expectedIssueCost(layers: CostLayer[], issueQty: number, method: CostMethod): number {
  const totalQty = layers.reduce((n, l) => n + l.qty, 0);
  if (issueQty > totalQty) throw new Error(`expectedIssueCost: issue ${issueQty} exceeds layers total ${totalQty}`);
  if (method === "average" || method === "average_per_location") {
    const value = layers.reduce((n, l) => n + l.qty * l.cost, 0);
    return round((issueQty * value) / totalQty, 2);
  }
  let left = issueQty;
  let sum = 0;
  for (const l of layers) {
    if (left <= 0) break;
    const take = Math.min(left, l.qty);
    sum += take * l.cost;
    left -= take;
  }
  return round(sum, 2);
}

/** The BU's cost method, from `GET /inventory-transactions/calculation-method` -> `data.calculation_method`. */
export async function calcMethod(bu: string = BU_CODE): Promise<CostMethod> {
  const m = must("calculation-method", await buSend(ROLE, "GET", "/inventory-transactions/calculation-method", undefined, bu)).body?.data?.calculation_method;
  if (m === "average" || m === "fifo" || m === "average_per_location") return m;
  throw new Error(`costing: unsupported calculation_method ${JSON.stringify(m)} (oracle knows average / fifo / average_per_location)`);
}

/**
 * Live stock of a product at a location as of a day, from `GET /inventory-info/:product/:location?at_date=`.
 * `qty` = on_hand_qty. The endpoint exposes no total value, so `value` = sum(balance_qty x cost_per_unit)
 * over its `cost_layers` ledger (in rows positive, out rows negative balance_qty, so it nets to the stock value).
 */
export async function stockAt(productId: string, locationId: string, atDate: string, bu: string = BU_CODE): Promise<{ qty: number; value: number }> {
  const d = must("inventory-info", await buSend(ROLE, "GET", `/inventory-info/${productId}/${locationId}?at_date=${atDate}`, undefined, bu)).body?.data;
  const layers: any[] = d?.cost_layers ?? [];
  const value = layers.reduce((n, l) => n + Number(l.balance_qty ?? 0) * Number(l.cost_per_unit ?? 0), 0);
  return { qty: Number(d?.on_hand_qty ?? 0), value };
}

export interface LedgerRow {
  lot_at_date?: string;
  lot_index?: number;
  in_qty?: number | string | null;
  out_qty?: number | string | null;
  cost_per_unit?: number | string | null;
}

/**
 * Open FIFO lots from an inventory-info `cost_layers` LEDGER at one location, oldest first. Pure.
 * The ledger is not a list of remaining lots: an out row gets its own new lot_no that does not link to the lot it
 * consumed, so remaining qty cannot be grouped by lot_no. Replay instead: take the in rows (in_qty > 0) sorted by
 * (lot_at_date, lot_index), sum every out_qty, consume that total from the oldest in rows first; what is left is the
 * open lots. Zero-qty lots are dropped.
 * ASSUMPTION: earlier issues were themselves consumed FIFO. A backend that did not would leave different lots open,
 * and the earlier FIFO cases (their issue-cost assertions) would catch that before this oracle is trusted.
 * สมมติว่าการจ่ายก่อนหน้าตัดแบบ FIFO จริง ถ้า backend ไม่ทำเคสก่อนหน้าจะจับได้
 */
export function openFifoLots(ledger: LedgerRow[]): CostLayer[] {
  const ins = ledger
    .filter((r) => Number(r.in_qty ?? 0) > 0)
    .sort((a, b) => {
      const t = Date.parse(a.lot_at_date ?? "") - Date.parse(b.lot_at_date ?? "");
      return t !== 0 && !Number.isNaN(t) ? t : Number(a.lot_index ?? 0) - Number(b.lot_index ?? 0);
    });
  let out = ledger.reduce((n, r) => n + Number(r.out_qty ?? 0), 0);
  const lots: CostLayer[] = [];
  for (const r of ins) {
    const inQty = Number(r.in_qty);
    const take = Math.min(out, inQty);
    out -= take;
    const left = inQty - take;
    if (left > 0) lots.push({ qty: left, cost: Number(r.cost_per_unit ?? 0) });
  }
  return lots;
}

/**
 * What an issue draws from, as `{qty, cost}` layers, as of `atDate`.
 * average: one pooled layer over all `locationIds` (BU-wide); average_per_location: one pooled layer over
 * `sourceLocationId` only; fifo: the open lots at `sourceLocationId`, oldest first (see `openFifoLots`).
 */
export async function costLayers(args: { productId: string; locationIds: string[]; sourceLocationId: string; atDate: string; bu?: string }): Promise<CostLayer[]> {
  const { productId, locationIds, sourceLocationId, atDate, bu = BU_CODE } = args;
  const method = await calcMethod(bu);
  if (method === "fifo") {
    const d = must("inventory-info", await buSend(ROLE, "GET", `/inventory-info/${productId}/${sourceLocationId}?at_date=${atDate}`, undefined, bu)).body?.data;
    return openFifoLots(d?.cost_layers ?? []);
  }
  const pool = method === "average" ? locationIds : [sourceLocationId];
  let qty = 0;
  let value = 0;
  for (const loc of pool) {
    const s = await stockAt(productId, loc, atDate, bu);
    qty += s.qty;
    value += s.value;
  }
  return qty > 0 ? [{ qty, cost: value / qty }] : [];
}
