import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  test, expect, gotoInBu, BU, SCHEMA, requireScenario, irreversibleAllowed, irreversibleSkip, sql, shot, record, EVIDENCE_DIR, currentPeriod, review, getDoc,
} from "./helpers/period-close/context";
import { toasts } from "./helpers/movement/ui";
import { L, SCN, PERIOD, NEXT } from "./helpers/period-close/scenarios";

/**
 * Period close · Case 2 · Close Period — section 54 of PE.
 *
 *  - 2.10  press Close Period of the current period for real; the current period must
 *          move to the next one
 *  - 2.11  the balance brought forward (open_period layers of the next period) = the
 *          balance at the end of the closed period, per location/product (quantity +
 *          value; AVG also the unit cost = the period average). The expected balance is
 *          snapshot BEFORE pressing Close (afterwards close_period layers zero the period)
 *          into <EVIDENCE_DIR>/bf-before-close.json, so a rerun after the close still compares
 *  - 5.5   (AVG only, #719) a GRN / Stock In dated next period that was held back posts
 *          its stock when this period closes, after the brought-forward rows
 *
 * IRREVERSIBLE: closing a period cannot be undone. 2.10/2.11 are skipped unless
 * E2E_ALLOW_IRREVERSIBLE=<BU>:<period> names this scenario's BU and period; a rerun after
 * the close does not press it again (it only re-checks). 5.5 is read-only and skips
 * itself until the period is closed.
 *
 * Not serial: 5.5 guards its own precondition (current period = next), and a 2.11
 * mismatch must not hide the 5.5 result.
 *
 * Prerequisites: TC-PE-520004 passed (can_close = true, the Close Period button enabled).
 * Run: E2E_PERIOD_SCENARIO=<scenario> E2E_ALLOW_IRREVERSIBLE=<BU>:<period> bun run test:period-close -- tests/924-period-close-close.spec.ts
 * Origin: _movement_play/eop_bf/e2e/specs/50-close.spec.ts
 */
// ⚠️ ย้อนกลับไม่ได้ — กด Close Period ของ CARMEN-FIFO งวดปัจจุบันจริง แล้วตรวจยอดยกไป (BF) ของงวดถัดไป
// ผู้ใช้อนุมัติ: 2603 ("เอาเลย" 2026-09-30) · 2604 (อนุมัติแผน last_cost) · 2605 (ยืนยัน PR #702) · รันได้เฉพาะเมื่อ ALLOW_IRREVERSIBLE=CARMEN-FIFO:<งวด>
// ก่อนกด: เก็บยอดคงเหลือต่อล็อต ณ สิ้น 2603 · หลังกด: เทียบกับ layer open_period ของ 2604 ทีละคลัง/สินค้า (จำนวน + มูลค่า)

const SNAP = join(EVIDENCE_DIR, "bf-before-close.json");

interface Bal { loc: string; prod: string; qty: number; value: number; cost?: number }

test.beforeAll(() => requireScenario());

/**
 * ยอดคงเหลือต่อคลัง/สินค้า ณ สิ้นงวด (layer ทุกตัวที่ at_period <= งวด)
 * รายการจ่ายออกมี lot_no ของตัวเองแล้วชี้ล็อตที่ตัดผ่าน parent_lot_no พร้อมต้นทุนของล็อตนั้น
 * มูลค่าจึงคิดระดับ layer: SUM((in − out) × cost_per_unit) — ไม่ใช่จับกลุ่มตาม lot_no
 */
function balancesUpTo(period: string): Bal[] {
  return sql<{ loc: string; prod: string; qty: string; value: string }>(`
    select l.code loc, p.code prod, sum(cl.in_qty - cl.out_qty) qty, sum((cl.in_qty - cl.out_qty) * cl.cost_per_unit) value
    from ${SCHEMA}.tb_inventory_transaction_cost_layer cl
    join ${SCHEMA}.tb_location l on l.id = cl.location_id join ${SCHEMA}.tb_product p on p.id = cl.product_id
    where cl.deleted_at is null and cl.at_period <= '${period}'
    group by 1,2 having sum(cl.in_qty - cl.out_qty) <> 0 order by 1,2`).map((r) => ({ loc: r.loc, prod: r.prod, qty: Number(r.qty), value: Number(r.value) }));
}

/**
 * AVG (calculation_method = average): ยอดที่ processAverageClose จะยกไป คิดจาก layer ของงวดที่ปิดเท่านั้น (ไม่รวม close_period)
 * final_avg ต่อสินค้า = round2(มูลค่ารับเข้าทุกคลัง / จำนวนรับเข้าทุกคลัง) · ต่อคลัง: closing_qty = รับเข้า (หัก adjustment_out) − จ่ายออก
 * มูลค่า = มูลค่ารับเข้า (หัก adjustment_out) − round2(จ่ายออก × final_avg) — ใบ open ของงวดถัดไปลง in=closing_qty @final_avg total=มูลค่านี้
 */
function avgExpected(period: string): Bal[] {
  return sql<{ loc: string; prod: string; qty: string; value: string; cost: string }>(`
    with l as (
      select cl.product_id, cl.location_id, cl.transaction_type::text tt,
        coalesce(cl.in_qty, 0) iq, coalesce(cl.out_qty, 0) oq, coalesce(cl.total_cost, 0) tc
      from ${SCHEMA}.tb_inventory_transaction_cost_layer cl
      where cl.at_period = '${period}' and cl.deleted_at is null and cl.transaction_type::text <> 'close_period'
        and cl.product_id is not null and cl.location_id is not null),
    pa as (
      select product_id, case when coalesce(sum(iq) filter (where iq > 0), 0) > 0
        then round(sum(tc) filter (where iq > 0) / sum(iq) filter (where iq > 0), 2) else 0 end final_avg
      from l group by 1),
    b as (
      select product_id, location_id,
        coalesce(sum(iq) filter (where iq > 0), 0) - coalesce(sum(oq) filter (where oq > 0 and tt = 'adjustment_out'), 0) tin_q,
        coalesce(sum(tc) filter (where iq > 0), 0) - coalesce(sum(tc) filter (where oq > 0 and tt = 'adjustment_out'), 0) tin_v,
        coalesce(sum(oq) filter (where oq > 0 and tt <> 'adjustment_out'), 0) iss_q
      from l group by 1,2)
    select loc.code loc, p.code prod, round(b.tin_q - b.iss_q, 2) qty, pa.final_avg cost,
      round(b.tin_v - round(b.iss_q * pa.final_avg, 2), 2) value
    from b join pa on pa.product_id = b.product_id
    join ${SCHEMA}.tb_location loc on loc.id = b.location_id join ${SCHEMA}.tb_product p on p.id = b.product_id
    where round(b.tin_q - b.iss_q, 2) > 0 order by 1,2`).map((r) => ({
    loc: r.loc, prod: r.prod, qty: Number(r.qty), value: Number(r.value), cost: Number(r.cost),
  }));
}

/** ยอดที่ถูกยกเข้างวดถัดไป = layer open_period ของงวดนั้น (AVG: มูลค่าอ่านจาก total_cost เพราะไม่เท่า qty × final_avg เสมอไป) */
function openedIn(period: string): Bal[] {
  const value = SCN.method === "average" ? "sum(cl.total_cost)" : "sum(cl.in_qty * cl.cost_per_unit)";
  return sql<{ loc: string; prod: string; qty: string; value: string; cost: string }>(`
    select l.code loc, p.code prod, sum(cl.in_qty) qty, ${value} value, max(cl.cost_per_unit) cost
    from ${SCHEMA}.tb_inventory_transaction_cost_layer cl
    join ${SCHEMA}.tb_location l on l.id = cl.location_id join ${SCHEMA}.tb_product p on p.id = cl.product_id
    where cl.deleted_at is null and cl.at_period = '${period}' and cl.transaction_type::text = 'open_period'
    group by 1,2 order by 1,2`).map((r) => ({ loc: r.loc, prod: r.prod, qty: Number(r.qty), value: Number(r.value), cost: Number(r.cost) }));
}

test(
  "TC-PE-540001 กด Close Period จริงแล้วงวดปัจจุบันเลื่อนเป็นงวดถัดไป และยอดยกไปตรงกับยอดคงเหลือ ณ สิ้นงวดทุกคลังและสินค้า",
  {
    annotation: [
      {
        type: "preconditions",
        description:
          "Login เป็น admin@carmen.com บน BU ของ scenario; E2E_PERIOD_SCENARIO, E2E_DB_URL และ E2E_ALLOW_IRREVERSIBLE=<BU>:<งวด> ตั้งไว้; TC-PE-520004 ผ่านแล้ว (can_close = true, ปุ่ม Close Period กดได้) — หรือปิดงวดไปแล้วจากรอบก่อนและมี bf-before-close.json ในโฟลเดอร์หลักฐาน",
      },
      {
        type: "steps",
        description:
          "1. ถ้างวดที่ทดสอบยังเป็นงวดปัจจุบัน: ตรวจ can_close แล้วเก็บยอดที่คาดว่าจะยกไปลง bf-before-close.json (FIFO: ยอดคงเหลือ at_period ไม่เกินงวด · AVG: สูตร processAverageClose)\n2. Period End → Review → กด Close Period → ยืนยันใน dialog \"Close this period?\" รอ POST /period-ends\n3. อ่าน /period-ends/current และเปิดหน้า Period End\n4. เทียบยอดที่เก็บไว้กับ layer open_period ของงวดถัดไป ทีละคลัง/สินค้า",
      },
      {
        type: "expected",
        description:
          "2.10: POST /period-ends ตอบสำเร็จ และ /period-ends/current = งวดถัดไป · 2.11: มีรายการที่คาดอย่างน้อยหนึ่งรายการ ทุกคลัง/สินค้าจำนวนและมูลค่าตรงกัน (AVG ต้นทุนต่อหน่วย = ค่าเฉลี่ยงวดด้วย) และไม่มีรายการ open_period เกินมา",
      },
      { type: "priority", description: "High" },
      { type: "testType", description: "Happy Path" },
      {
        type: "note",
        description:
          "[IRREVERSIBLE] ปิดงวดจริง ย้อนไม่ได้ — skip ถ้าไม่ได้ตั้ง E2E_ALLOW_IRREVERSIBLE=<BU>:<งวด> · รันซ้ำหลังปิดแล้วไม่กดซ้ำ ตรวจอย่างเดียว · เดิม 2.10 + 2.11 (_movement_play specs/50-close) · snapshot bf-before-close.json อยู่ใต้ EVIDENCE_DIR เหมือนต้นฉบับ · ต้นฉบับ 2.11 บันทึก FAIL แต่ assert แค่ว่ามีรายการ — port assert ไม่มีรายการไม่ตรงและไม่มีรายการเกินมา · 2.11 เคย FAIL ใน period09 (2026-10-01, TEST-MOVE/T-03-F) — รอบ p10-r3 / p11-r4 / avg2607-r4 (2026-10-02) PASS จึงไม่ใช่บั๊กที่รู้อยู่ · ซ้อนกับ TC-PE-040001 ใน 900-period-end ซึ่งเป็น skip ว่าง · ขัดกับ gap TC-PE-040104 (docs/test-cases/gaps/900-period-end-gap.md) ที่คาดว่าหลังปิดการ์ดงวดแสดงป้าย Closed และปุ่มถูก disable — ต้นฉบับ assert ว่า /period-ends/current เลื่อนเป็นงวดถัดไป (หลักฐานทุกรอบ: งวดปัจจุบันเลื่อน หน้า Period End แสดงงวดใหม่) port คงตามต้นฉบับ ต้องตกลงว่าแบบไหนถูกแล้วแก้ฝั่งใดฝั่งหนึ่ง",
      },
    ],
  },
  async ({ page }) => {
    test.skip(!irreversibleAllowed(PERIOD), irreversibleSkip("Close Period locks the period"));
    const images: string[] = [];
    let closeStatus = "(ปิดไว้แล้วจากรอบก่อน)";

    if ((await currentPeriod(BU)) === PERIOD) {
      const r = await review(BU);
      expect(r.can_close, `ยังปิดไม่ได้: ${JSON.stringify(r.close_blocking)}`).toBe(true);
      // ต้องเก็บก่อนกด — หลังปิด layer ของงวดถูก close_period ตัดเป็น 0 (AVG ยัง restate average_cost_per_unit ด้วย)
      mkdirSync(EVIDENCE_DIR, { recursive: true });
      writeFileSync(SNAP, JSON.stringify(SCN.method === "average" ? avgExpected(PERIOD) : balancesUpTo(PERIOD), null, 2));

      await gotoInBu(page, "/inventory-management/period-end/review");
      await page.waitForTimeout(1500);
      images.push(await shot(page, "2.10", "a-review-ก่อนกด-Close"));
      await page.getByRole("button", { name: "Close Period", exact: true }).click();
      const dlg = page.locator("[role=alertdialog]").filter({ hasText: "Close this period?" });
      await expect(dlg).toBeVisible();
      images.push(await shot(page, "2.10", "b-ยืนยัน-Close"));
      const closed = page.waitForResponse((res) => /\/period-ends\/?(\?|$)/.test(res.url()) && res.request().method() === "POST", { timeout: 180_000 });
      await dlg.getByRole("button", { name: "Close Period" }).click();
      const resp = await closed;
      // toast เป็นหลักฐานประกอบเท่านั้น — ผลปิดงวดตัดสินจาก HTTP และ /period-ends/current
      // รอ toast สูงสุด ~15 วิ ไม่มีก็บันทึกว่าง (ไม่ให้การรอ toast ทำให้หลักฐานของขั้นที่ย้อนไม่ได้หาย)
      let toast = "";
      for (let i = 0; i < 30 && !toast; i++) {
        toast = (await toasts(page)).join(" / ");
        if (!toast) await page.waitForTimeout(500);
      }
      closeStatus = `HTTP ${resp.status()} · toast="${toast}"`;
      expect(resp.ok(), `close ${resp.status()} ${await resp.text()}`).toBe(true);
    }

    const now = await currentPeriod(BU);
    await gotoInBu(page, "/inventory-management/period-end");
    await page.waitForTimeout(1500);
    images.push(await shot(page, "2.10", "c-period-end-หลังปิด"));
    const cnDraft = getDoc(SCN.keys.cnDraftIn);
    const cnStatus = cnDraft ? sql(`select doc_status from ${SCHEMA}.tb_credit_note where id = '${cnDraft.id}'`)[0]?.doc_status : "";
    record({
      id: "2.10", case: "Case 2 · ปิดงวด", title: `กด Close Period ของงวด ${PERIOD}`,
      steps: ["Period End → Review → Close Period → ยืนยัน"],
      expected: `ปิดสำเร็จ · งวดปัจจุบันเป็น ${NEXT}`,
      actual: `${closeStatus} · งวดปัจจุบัน=${now}` + (cnDraft ? ` · สังเกต: ${cnDraft.no} (CN ร่างลงวันที่ ${SCN.cnDraftIn.date}) ยังเป็น ${cnStatus} ค้างอยู่ในงวดที่ปิดแล้ว` : ""),
      status: now === NEXT ? "PASS" : "FAIL", images,
    });
    expect(now).toBe(NEXT);

    // 2.11 ยอดยกไป
    const before: Bal[] = existsSync(SNAP) ? JSON.parse(readFileSync(SNAP, "utf8")) : [];
    const opened = openedIn(NEXT);
    const key = (b: Bal) => `${b.loc}/${b.prod}`;
    const openMap = new Map(opened.map((b) => [key(b), b]));
    const rows = before.map((b) => {
      const o = openMap.get(key(b));
      return { k: key(b), bq: b.qty, bv: b.value, bc: b.cost, oq: o?.qty ?? 0, ov: o?.value ?? 0, oc: o?.cost };
    });
    const extra = opened.filter((o) => !before.some((b) => key(b) === key(o)));
    const isAvg = SCN.method === "average";
    const mismatch = rows.filter(
      (r) => Math.abs(r.bq - r.oq) > 1e-6 || Math.abs(r.bv - r.ov) > 0.01 || (isAvg && Math.abs((r.bc ?? 0) - (r.oc ?? 0)) > 0.01),
    );
    const lag = rows.filter((r) => r.k.startsWith(`${L.code}/`));
    record({
      id: "2.11", case: "Case 2 · ปิดงวด", title: `ยอดยกไป (BF) งวด ${NEXT} = ยอดคงเหลือ ณ สิ้น ${PERIOD} ทุกคลัง/สินค้า`,
      steps: isAvg
        ? [`ก่อนกด Close: คิดยอดตามสูตร processAverageClose จาก layer at_period = ${PERIOD}`, `หลังปิด: layer open_period ของ ${NEXT}`]
        : [`ก่อนกด Close: เก็บยอดคงเหลือต่อล็อต at_period <= ${PERIOD}`, `หลังปิด: รวม layer open_period ของ ${NEXT}`],
      expected: isAvg
        ? "ทุกคลัง/สินค้า: จำนวน = closing_qty · ต้นทุน/หน่วย = final_avg ของสินค้าทั้งงวด · มูลค่า = closing_total_cost · ไม่มีรายการเกินมา"
        : "จำนวนและมูลค่าตรงกันทุกคลัง/สินค้า ไม่มีรายการเกินมา",
      actual:
        `${rows.length} รายการ · ไม่ตรง ${mismatch.length}${mismatch.length ? `: ${mismatch.map((m) => `${m.k} คาด ${m.bq}/${m.bv}${isAvg ? `@${m.bc}` : ""} ยก ${m.oq}/${m.ov}${isAvg ? `@${m.oc}` : ""}`).join(", ")}` : ""}` +
        `${extra.length ? ` · เกินมา: ${extra.map((e) => `${key(e)} ${e.qty}/${e.value}`).join(", ")}` : ""} · ` +
        `${L.code}: ${lag.map((r) => `${r.k.split("/")[1]} ${r.oq}${isAvg ? ` @${r.oc}` : ""} มูลค่า ${r.ov}`).join(" · ")}` +
        " (ต้นทุนของล็อตชดเชยจากข้อ 2.9 ถูกยกตามไปด้วย)",
      status: before.length && !mismatch.length && !extra.length ? "PASS" : "FAIL",
    });
    expect(before.length, `ไม่มียอดที่คาดใน ${SNAP} — snapshot ต้องเก็บก่อนกด Close`).toBeGreaterThan(0);
    // verdict ที่บันทึกไว้ (ต้นฉบับบันทึก FAIL แต่ assert แค่ว่ามีรายการ)
    expect(
      mismatch.map((m) => `${m.k} คาด ${m.bq}/${m.bv}${isAvg ? `@${m.bc}` : ""} ยก ${m.oq}/${m.ov}${isAvg ? `@${m.oc}` : ""}`),
      "ยอดยกไปไม่ตรงยอดคงเหลือ ณ สิ้นงวด",
    ).toEqual([]);
    expect(extra.map((e) => `${key(e)} ${e.qty}/${e.value}`), "มีรายการยกยอดเกินมา").toEqual([]);
  },
);

// Case 5 · #719: ใบรับ / Stock In ของงวดหน้าที่พักไว้ ต้องลงสต๊อกตอนปิดงวดนี้ ต่อจากแถวยกยอดของงวดหน้า
test(
  "TC-PE-540002 ใบรับและ Stock In ของงวดหน้าที่พักไว้ลงสต๊อกหลังแถวยกยอดตอนปิดงวด (#719 · AVG)",
  {
    annotation: [
      {
        type: "preconditions",
        description:
          "scenario ต้นทุนเฉลี่ย (AVG) เท่านั้น; ปิดงวดที่ทดสอบแล้ว (TC-PE-540001) — งวดปัจจุบัน = งวดถัดไป; state.json มี GRN งวดหน้า (keys.nextGrn) และ siNextHeld ที่สร้างไว้ก่อนเริ่มนับ; E2E_DB_URL ตั้งไว้",
      },
      {
        type: "steps",
        description:
          "1. อ่านเวลาที่เกิดแถวยกยอด (open_period) ล่าสุดของงวดถัดไป\n2. ต่อเอกสารที่พักไว้ (GRN งวดหน้า และ Stock In งวดหน้า): อ่าน cost layer ของใบนั้น — จำนวนแถว งวด ราคา และเวลาที่เกิด",
      },
      {
        type: "expected",
        description:
          "พบเอกสารที่พักไว้ครบสองใบ · ทั้งสองใบมี cost layer แล้ว ลงงวดถัดไปเท่านั้น และเกิดไม่ก่อนแถวยกยอดล่าสุดของงวดถัดไป",
      },
      { type: "priority", description: "Medium" },
      { type: "testType", description: "Functional" },
      {
        type: "note",
        description:
          "เดิม 5.5 (_movement_play specs/50-close) · กติกา #719 (PR #715 · #718 · #719) · อ่านอย่างเดียว — skip เองถ้าไม่ใช่ AVG หรือยังไม่ได้ปิดงวด · รอบล่าสุด avg2607-r4 (2026-10-02) PASS",
      },
    ],
  },
  async () => {
    test.skip(SCN.method !== "average", "เฉพาะต้นทุนเฉลี่ย");
    test.skip((await currentPeriod(BU)) !== NEXT, irreversibleSkip("the period is not closed yet, so there is nothing carried forward to check"));
    const held = [getDoc(SCN.keys.nextGrn), getDoc("siNextHeld")].filter(Boolean) as { id: string; no: string }[];
    const [{ opened }] = sql<{ opened: string }>(`select max(cl.created_at)::text opened from ${SCHEMA}.tb_inventory_transaction_cost_layer cl
      where cl.deleted_at is null and cl.at_period = '${NEXT}' and cl.transaction_type::text = 'open_period'`);
    const rows = held.map((doc) => {
      const [r] = sql<{ n: string; periods: string; first: string; costs: string }>(`
        select count(*) n, string_agg(distinct cl.at_period, ',') periods, min(cl.created_at)::text first,
               string_agg(distinct cl.cost_per_unit::numeric(20,2)::text, ',') costs
        from ${SCHEMA}.tb_inventory_transaction_cost_layer cl
        join ${SCHEMA}.tb_inventory_transaction_detail d on d.id = cl.inventory_transaction_detail_id
        join ${SCHEMA}.tb_inventory_transaction t on t.id = d.inventory_transaction_id
        where t.inventory_doc_no = '${doc.id}' and cl.deleted_at is null and t.deleted_at is null`);
      const ok = Number(r.n) > 0 && r.periods === NEXT && !!opened && r.first >= opened;
      return { doc, r, ok };
    });
    const ok = held.length === 2 && rows.every((x) => x.ok);
    record({
      id: "5.5", case: "Case 5 · กติกาใหม่ (PR #715 · #718 · #719)",
      title: `ใบรับ / Stock In ลงวันที่งวด ${NEXT} ที่พักไว้ ลงสต๊อกตอนปิดงวด ${PERIOD} หลังยกยอด`,
      steps: [`ปิดงวด ${PERIOD} (ข้อ 2.10)`, `ดูรายการเคลื่อนไหวของ ${held.map((h) => h.no).join(" และ ")}`],
      expected: `ทั้งสองใบมีรายการเคลื่อนไหวในงวด ${NEXT} แล้ว และเกิดหลังแถวยกยอดเข้า ${NEXT}`,
      actual: rows.map((x) => `${x.doc.no}: ${x.r.n} แถว งวด ${x.r.periods ?? "-"} ราคา ${x.r.costs ?? "-"} เกิด ${x.r.first ?? "-"}`).join(" · ") +
        ` · แถวยกยอดล่าสุดของ ${NEXT} เกิด ${opened ?? "-"}`,
      status: ok ? "PASS" : "FAIL", docs: held.map((h) => h.no),
    });
    expect(ok).toBe(true);
  },
);
