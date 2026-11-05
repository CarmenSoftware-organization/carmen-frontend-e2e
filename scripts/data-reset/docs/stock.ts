// scripts/data-reset/docs/stock.ts
// Stock on hand from committed stock-ins: two locations, reorder tiers for 711, an expired and a
// near-expiry lot. Stock comes from real documents, never written into balances directly.
// สต๊อกคงเหลือจากใบรับเข้าที่ commit แล้ว — ไม่เขียนยอดคงเหลือตรง ๆ
import type { ResetConfig } from "../config";
import type { Sessions } from "../sessions";
import type { StepResult } from "../step-result";
import type { SeedContext } from "./context";
import { addDays, isoDay } from "./dates";
import { refId } from "./refs";
import type { RowLedger } from "./row-ledger";
import { createDoc, transition, why } from "./transition";
import { localDate } from "../period";

const STOREMANAGER = "carmensoftware.dev+storemanager@gmail.com";
// ProductUpdateSchema location entries accept location_id, shelf_id, min/max/par — no re_order_qty.
const PAR = { par_qty: 100, min_qty: 10, max_qty: 150 };

interface StockLine { productId: string; qty: number; cost: number; expiredAt?: string }

export function planStock(ctx: SeedContext) {
  const p = (i: number) => ctx.products[i - 1].id;
  const l1 = ctx.locations.first.id;
  const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
  return {
    // Every product sits at both locations (the PR item picker lists products by location);
    // products 1–3 carry the par level that 711's tiers read at location 1.
    productLocations: ctx.products.map((product, i) => ({
      productId: product.id,
      entries: [{ location_id: l1, ...(i < 3 ? PAR : {}) }, { location_id: ctx.locations.second.id }] as Array<Record<string, unknown> & { location_id: string }>,
    })),
    stockIns: [
      { row: "stock.tiers", locationId: l1, lines: [[1, 20], [2, 40], [3, 80]].map(([i, qty]) => ({ productId: p(i), qty, cost: 10 })) },
      { row: "stock.on-hand.l1", locationId: l1, lines: range(4, 8).map((i) => ({ productId: p(i), qty: 200, cost: 10 })) },
      { row: "stock.on-hand.l2", locationId: ctx.locations.second.id, lines: range(4, 8).map((i) => ({ productId: p(i), qty: 100, cost: 10 })) },
      { row: "stock.expired", locationId: l1, lines: [{ productId: p(9), qty: 10, cost: 10, expiredAt: addDays(ctx.today, -30) }] },
      { row: "stock.near-expiry", locationId: l1, lines: [{ productId: p(9), qty: 10, cost: 10, expiredAt: addDays(ctx.today, 7) }] },
    ] as Array<{ row: string; locationId: string; lines: StockLine[] }>,
  };
}

async function periodCoversToday(sessions: Sessions, cfg: ResetConfig, today: string): Promise<boolean> {
  const admin = await sessions.client(cfg.adminEmail);
  const res = await admin.get(`/api/${cfg.buCode}/inventory-periods/current`);
  const p = res.body?.data;
  if (!res.ok || p?.status !== "open" || !p.start_at || !p.end_at) return false;
  const day = (iso: string) => localDate(new Date(iso)).day;
  return day(p.start_at) <= today && today <= day(p.end_at);
}

export async function seedStock(sessions: Sessions, cfg: ResetConfig, ctx: SeedContext, ledger: RowLedger): Promise<StepResult> {
  const result: StepResult = { step: "stock", created: 0, skipped: 0, failed: [] };
  if (!(await periodCoversToday(sessions, cfg, ctx.today))) {
    result.failed.push(`no open period covers ${ctx.today} — stock not posted`);
    return result;
  }
  const plan = planStock(ctx);
  const admin = await sessions.client(cfg.adminEmail);
  for (const { productId, entries } of plan.productLocations) {
    const path = `/api/config/${cfg.buCode}/products/${productId}`;
    const current = await admin.get(path);
    if (!current.ok) {
      result.failed.push(why(`read product ${productId}`, current));
      continue;
    }
    const doc = current.body?.data ?? {};
    const linked = new Set(
      (Array.isArray(doc.locations) ? doc.locations : []).map((l: any) => refId(l, "location")).filter(Boolean),
    );
    const update = entries.filter((e) => linked.has(e.location_id));
    const add = entries.filter((e) => !linked.has(e.location_id));
    const res = await admin.patch(path, {
      doc_version: Number(doc.doc_version ?? 0),
      locations: { ...(update.length ? { update } : {}), ...(add.length ? { add } : {}) },
    });
    if (res.ok) result.created += 1;
    else result.failed.push(why(`product locations ${productId}`, res));
  }
  const store = await sessions.client(STOREMANAGER);
  const base = `/api/${cfg.buCode}/stock-ins`;
  for (const si of plan.stockIns) {
    const created = await createDoc(store, base, {
      adjustment_type_id: ctx.adjustmentTypeId,
      location_id: si.locationId,
      si_date: isoDay(ctx.today),
      note: `STD ${si.row}`,
      stock_in_detail: {
        add: si.lines.map((l) => ({
          product_id: l.productId, qty: l.qty, cost_per_unit: l.cost, total_cost: l.qty * l.cost,
          ...(l.expiredAt ? { expired_at: isoDay(l.expiredAt) } : {}),
        })),
      },
    });
    if (!created.ok || !created.id) {
      const reason = why(`stock-in ${si.row}`, created);
      result.failed.push(reason);
      ledger.record(si.row, null, false, reason);
      continue;
    }
    const committed = await transition(store, `${base}/${created.id}`, "commit", (v) => ({ doc_version: v }));
    if (committed.ok) {
      result.created += 1;
      ledger.record(si.row, created.no ?? created.id, true);
    } else {
      const reason = why(`commit ${created.no ?? created.id}`, committed);
      result.failed.push(reason);
      ledger.record(si.row, null, false, reason);
    }
  }
  return result;
}
