import { sql, SCHEMA } from "./context";
import { L, SCN } from "./scenarios";

/**
 * ตัวคาดราคาที่ CostProbe (ช่องราคาบนฟอร์ม SI/SO) ควรเติม — คิดเองจาก SQL ไม่เรียกโค้ด backend
 * กติกา = ราคาที่การโพสต์ใบจ่ายจะคิด (PR #708):
 *  - FIFO: ล็อตจาก cost layer ที่ยังไม่ถูกลบ ที่คลังนั้น รับเข้าในงวดปัจจุบันหรือก่อนหน้า หักที่ถูกตัดไปแล้ว ตัดเก่าก่อน
 *    เก่า = ตามลำดับที่ล็อตเกิด (lot_seq_no) — lot_at_date ของ Stock In คือวันที่โพสต์ ไม่ใช่วันที่เอกสาร และ backend
 *    ห้ามรับเข้าย้อนหลังก่อนใบรับล่าสุดของ FIFO (…_BEFORE_LATEST_RECEIPT) ลำดับสร้างจึงตรงกับลำดับวันที่เสมอ
 *  - AVG: ค่าเฉลี่ยสุทธิของ layer ที่ยังไม่ถูกลบ (average = ทั้ง BU, average_per_location = คลังนั้น)
 *    ตรวจของพอด้วย รับเข้า (งวดที่หยิบได้) − จ่ายออก (ทุกงวด) ที่คลังนั้น
 * งวดปัจจุบัน = งวดเปิด/ล็อกที่เก่าที่สุด (แบบเดียวกับการโพสต์ที่ไม่ส่งวันที่เอกสาร)
 */
const r2 = (n: number) => Math.round(n * 100) / 100;

export function currentPeriod(): { period: string; end_at: string } {
  const [p] = sql<{ period: string; end_at: string }>(`
    select period, (end_at at time zone 'UTC')::date::text end_at from ${SCHEMA}.tb_inventory_period
    where status::text in ('open','locked') and deleted_at is null order by fiscal_year, fiscal_month limit 1`);
  return p;
}

function drawableIn(period: string): string {
  return `(cl.at_period is null or cl.at_period in (select period from ${SCHEMA}.tb_inventory_period
    where deleted_at is null and end_at <= (select end_at from ${SCHEMA}.tb_inventory_period where period = '${period}' and deleted_at is null)))`;
}

export type Expected =
  | { ok: true; avg: number; total: number; how: string }
  | { ok: false; available: number; how: string };

export function expectedIssueCost(productCode: string, qty: number, period: string): Expected {
  const where = `cl.deleted_at is null and cl.product_id = (select id from ${SCHEMA}.tb_product where code = '${productCode}')`;
  const atLoc = `cl.location_id = (select id from ${SCHEMA}.tb_location where code = '${L.code}')`;
  if (SCN.method === "fifo") {
    const lots = sql<{ lot_no: string; tin: string; tcost: string; consumed: string }>(`
      with recv as (
        select cl.lot_no, sum(cl.in_qty) tin, sum(cl.total_cost) tcost, min(cl.lot_at_date) at, min(cl.lot_seq_no) seq
        from ${SCHEMA}.tb_inventory_transaction_cost_layer cl
        where ${where} and ${atLoc} and cl.in_qty > 0 and ${drawableIn(period)}
        group by cl.lot_no)
      select r.lot_no, r.tin, r.tcost,
        coalesce((select sum(o.out_qty) from ${SCHEMA}.tb_inventory_transaction_cost_layer o
                  where o.parent_lot_no = r.lot_no and o.out_qty > 0 and o.deleted_at is null), 0) consumed
      from recv r order by r.seq`);
    const avail = lots
      .map((l) => ({ lot: l.lot_no, left: Number(l.tin) - Number(l.consumed), cost: r2(Number(l.tcost) / Number(l.tin)) }))
      .filter((l) => l.left > 0);
    const available = avail.reduce((s, l) => s + l.left, 0);
    if (available <= 0 || qty > available) return { ok: false, available, how: `ของที่ตัดได้ ${available}` };
    let rem = qty;
    let total = 0;
    const used: string[] = [];
    for (const l of avail) {
      if (rem <= 0) break;
      const take = Math.min(rem, l.left);
      total = r2(total + take * l.cost);
      used.push(`${take}@${l.cost} (${l.lot})`);
      rem -= take;
    }
    return { ok: true, avg: r2(total / qty), total, how: `FIFO ${used.join(" + ")}` };
  }

  const [bal] = sql<{ rin: string; rout: string }>(`
    select coalesce(sum(cl.in_qty) filter (where cl.in_qty > 0 and ${drawableIn(period)}), 0) rin,
           coalesce(sum(cl.out_qty) filter (where cl.out_qty > 0), 0) rout
    from ${SCHEMA}.tb_inventory_transaction_cost_layer cl where ${where} and ${atLoc}`);
  const available = Number(bal.rin) - Number(bal.rout);
  if (available <= 0 || qty > available) return { ok: false, available, how: `ของที่ตัดได้ ${available}` };
  const scope = (SCN.method as string) === "average_per_location" ? `and ${atLoc}` : "";
  const [net] = sql<{ q: string; v: string }>(`
    select sum(cl.in_qty - cl.out_qty) q, sum((cl.in_qty - cl.out_qty) * cl.cost_per_unit) v
    from ${SCHEMA}.tb_inventory_transaction_cost_layer cl where ${where} ${scope}`);
  const q = r2(Number(net.q));
  const v = r2(Number(net.v));
  const avg = q > 0 ? r2(v / q) : 0;
  return { ok: true, avg, total: r2(qty * avg), how: `ค่าเฉลี่ยสุทธิ${scope ? "ของคลัง" : "ทั้ง BU"} ${v} ÷ ${q}` };
}

/**
 * Starting price the Stock In form prefills on an `average` BU (si.cost-from = average): the period receipt average the close
 * books, BU-wide — Σ total_cost ÷ Σ in_qty of the period's receipts (no close_period / transfer_in rows), dated up to the
 * document's day (the probe dates the form at the end of the period, so everything counts). null = nothing received in the
 * period yet (the backend then falls back to the net moving average). average_per_location and FIFO do not use this.
 * (micro-business getPeriodReceiptAverageAsOf)
 */
export function periodReceiptAverage(productCode: string, period: string): number | null {
  const [r] = sql<{ q: string | null; v: string | null }>(`
    select sum(cl.in_qty) q, sum(cl.total_cost) v
    from ${SCHEMA}.tb_inventory_transaction_cost_layer cl
    where cl.deleted_at is null and cl.in_qty > 0 and cl.at_period = '${period}'
      and cl.transaction_type::text not in ('close_period', 'transfer_in')
      and cl.product_id = (select id from ${SCHEMA}.tb_product where code = '${productCode}')`);
  const q = Number(r?.q ?? 0);
  return q > 0 ? r2(Number(r.v) / q) : null;
}

/** ราคาของล็อตจาก GRN ที่ void แล้วที่คลังนั้น — ตัวหลอกที่โค้ดก่อน #708 เคยเสนอ */
export function voidedLotCosts(productCode: string): number[] {
  return sql<{ c: string }>(`
    select distinct d.cost_per_unit c from ${SCHEMA}.tb_inventory_transaction_detail d
    join ${SCHEMA}.tb_inventory_transaction t on t.id = d.inventory_transaction_id
    where t.deleted_at is not null and d.qty > 0
      and d.product_id = (select id from ${SCHEMA}.tb_product where code = '${productCode}')
      and d.location_id = (select id from ${SCHEMA}.tb_location where code = '${L.code}')`).map((r) => Number(r.c));
}
