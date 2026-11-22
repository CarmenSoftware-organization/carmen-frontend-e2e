import {
  test, expect, gotoInBu, BU, SCHEMA, requireScenario, sql, shot, record, prevRecord, currentPeriod, review, getDoc, putDoc, gatePhase
} from "./helpers/period-close/context";
import { adjustmentUrl, voidGrn, deleteGrnDraft, deleteAdjustment, grnById, adjustmentById, commitGrn } from "./helpers/period-close/docs";
import { L, SCN, PERIOD } from "./helpers/period-close/scenarios";

/**
 * Period close · Case 2 · verify after counting — section 52 of PE.
 *
 *  - 2.8        the compensation documents the count created (EOP-IN Stock In / EOP-OUT
 *               Stock Out): one per location with a difference, completed, dated on the
 *               period's last day, numbers not reused
 *  - 2.9        the unit cost on those documents vs. the rule the user confirmed for the
 *               scenario's si.cost-from (and the posted cost for the Stock Out side)
 *  - 2.7-onhand the system quantity the count sheet compared against = the balance at
 *               the end of the counted period
 *  - 2.10-ready clear the documents TC-PE-500001 left open (void / delete / commit per
 *               the scenario's closeGate), then the period must be ready to close
 *
 * Does NOT press Close Period: every POST /period-ends of this file is aborted. Not
 * irreversible at the period level, but 2.10-ready voids / deletes the closeGate
 * documents for real (they exist only for this flow; a rerun skips what is done).
 *
 * Not serial on purpose: a finding in 2.9 / 2.7-onhand must not stop 2.10-ready (past
 * rounds closed the period with 2.9 failing). Order is still file order — the
 * period-close project runs with fullyParallel: false and one worker.
 *
 * Prerequisites: TC-PE-510001 counted every location; the period under test is still current.
 * Run: E2E_PERIOD_SCENARIO=<scenario> bun run test:period-close -- tests/922-period-close-verify.spec.ts
 * Origin: _movement_play/eop_bf/e2e/specs/45-verify.spec.ts
 */
// ตรวจผลหลังนับครบ: 2.8 ใบชดเชย (เลข/ชนิด/วันที่) · 2.9 ราคา SI ชดเชย vs กติกาที่ผู้ใช้เคาะ · ข้อค้นพบ on-hand ของใบนับ
// แล้วเคลียร์เอกสารที่ขวาง/ค้างก่อนปิด (ตาม SCN.closeGate) — spec นี้ไม่กด Close Period (ตัด POST ทิ้งกันพลาด)

const CASE = "Case 2 · นับ + ชดเชย";
const DESC = `Physical Count Adjustment - Period ${SCN.descPeriod}`;

test.beforeAll(() => requireScenario());
gatePhase({ counting: true, db: true });
test.beforeAll(async () => {
  expect(await currentPeriod(BU)).toBe(PERIOD);
});
test.beforeEach(async ({ page }) => {
  // กันกด Close โดยไม่ตั้งใจ — POST /period-ends (ปิดงวด) ถูกตัดทิ้งทั้ง spec
  await page.route(/\/period-ends\/?(\?|$)/, (route, req) => (req.method() === "POST" ? route.abort() : route.fallback()));
});

function eopDocs() {
  return sql<{ kind: string; id: string; no: string; doc_status: string; dt: string; adj: string; loc: string }>(`
    select 'stock-in' kind, s.id, s.si_no no, s.doc_status, s.si_date::text dt, a.code adj, s.location_code loc from ${SCHEMA}.tb_stock_in s
      join ${SCHEMA}.tb_adjustment_type a on a.id = s.adjustment_type_id where s.description = '${DESC}' and s.deleted_at is null
    union all
    select 'stock-out', s.id, s.so_no, s.doc_status, s.so_date::text, a.code, s.location_code from ${SCHEMA}.tb_stock_out s
      join ${SCHEMA}.tb_adjustment_type a on a.id = s.adjustment_type_id where s.description = '${DESC}' and s.deleted_at is null`);
}

test(
  "TC-PE-520001 ใบชดเชยจากการนับ EOP-IN และ EOP-OUT เกิดครบต่อคลังที่มีผลต่าง ลงวันที่สิ้นงวดและเลขไม่ซ้ำ",
  {
    annotation: [
      {
        type: "preconditions",
        description:
          "Login เป็น admin@carmen.com บน BU ของ scenario; E2E_PERIOD_SCENARIO และ E2E_DB_URL ตั้งไว้; TC-PE-510001 นับครบทุกคลังแล้ว (คลัง 1AG01 มีทั้งนับเกินและนับขาด); งวดที่ทดสอบยังเป็นงวดปัจจุบัน",
      },
      {
        type: "steps",
        description:
          "1. หาใบ Stock In / Stock Out ที่ระบบสร้างจากการ submit ใบนับ (description \"Physical Count Adjustment - Period <ปี-เดือน>\")\n2. เปิดหน้า Inventory Adjustment ของแต่ละใบ ดูว่าเลขใบแสดงอยู่\n3. คิดใบที่ควรเกิดจากแถวใบนับที่ diff_qty ไม่เป็น 0: ต่อคลัง นับเกิน = SI หนึ่งใบ นับขาด = SO หนึ่งใบ\n4. ตรวจเลขใบซ้ำในตาราง (รวมใบที่ลบ)",
      },
      {
        type: "expected",
        description:
          "ชุดคลัง:ชนิดของใบที่เกิด = ชุดที่ควรเกิดพอดี · SI ใช้ adjustment type EOP-IN และ SO ใช้ EOP-OUT · ทุกใบสถานะ completed ลงวันที่สิ้นงวดที่นับ · เลขใบแต่ละเลขมีแถวเดียว",
      },
      { type: "priority", description: "High" },
      { type: "testType", description: "Functional" },
      {
        type: "note",
        description:
          "เดิม 2.8 (_movement_play specs/45-verify) · หลักฐาน 2.8 (ภาพใบชดเชยถูกใช้ต่อใน 2.9) · อ่านอย่างเดียว · รอบล่าสุด p11-r4 / avg2607-r4 (2026-10-02) PASS",
      },
    ],
  },
  async ({ page }) => {
    const docs = eopDocs();
    const images: string[] = [];
    for (const d of docs) {
      await gotoInBu(page, adjustmentUrl(d.kind as "stock-in" | "stock-out", d.id));
      await expect(page.getByText(d.no).first()).toBeVisible();
      images.push(await shot(page, "2.8", `${d.no}`));
    }
    const dup = sql(`
      select no, n from (
        select si_no no, count(*) n from ${SCHEMA}.tb_stock_in where si_no like 'SI${PERIOD}%' group by 1
        union all select so_no, count(*) from ${SCHEMA}.tb_stock_out where so_no like 'SO${PERIOD}%' group by 1) x
      where no in (${docs.map((d) => `'${d.no}'`).join(",") || "''"})`);
    // ใบที่ควรเกิด: ต่อคลัง — มีรายการนับเกิน = SI (EOP-IN) หนึ่งใบ · มีรายการนับขาด = SO (EOP-OUT) หนึ่งใบ
    const want = sql<{ loc: string; kind: string }>(`
      select distinct l.code loc, case when d.diff_qty > 0 then 'stock-in' else 'stock-out' end kind
      from ${SCHEMA}.tb_physical_count_detail d join ${SCHEMA}.tb_physical_count c on c.id = d.physical_count_id
      join ${SCHEMA}.tb_physical_count_period pp on pp.id = c.physical_count_period_id
      join ${SCHEMA}.tb_inventory_period ip on ip.id = pp.period_id and ip.period = '${PERIOD}'
      join ${SCHEMA}.tb_location l on l.id = c.location_id
      where d.deleted_at is null and c.deleted_at is null and d.diff_qty <> 0`);
    const key = (x: { loc: string; kind: string }) => `${x.loc}:${x.kind}`;
    const got = docs.map(key).sort();
    const wantKeys = want.map(key).sort();
    const ok =
      JSON.stringify(got) === JSON.stringify(wantKeys) &&
      docs.every((d) => d.adj === (d.kind === "stock-in" ? "EOP-IN" : "EOP-OUT")) &&
      docs.every((d) => d.doc_status === "completed" && d.dt.startsWith(SCN.periodEnd)) &&
      dup.every((r) => Number(r.n) === 1);
    record({
      id: "2.8", case: CASE, title: "ใบชดเชยที่เกิดจาก submit ใบนับ (ต่อคลังที่มีผลต่าง)",
      steps: [`Submit ใบนับทุกคลัง (${L.code}: P1/P2/P3 เกิน, P4 ขาด)`, "ดูใบที่ระบบสร้างใน Inventory Adjustment"],
      expected:
        `ต่อคลังที่มีผลต่าง: ${wantKeys.map((k) => k.replace(":stock-in", " SI (EOP-IN)").replace(":stock-out", " SO (EOP-OUT)")).join(", ")} · ` +
        `completed · ลงวันที่ ${SCN.periodEnd} · เลขเดินต่อ ไม่ซ้ำ (รวมใบที่ลบ)`,
      actual: `${docs.map((d) => `${d.no} ${d.loc} ${d.adj} ${d.doc_status} ${d.dt.slice(0, 10)}`).join(" · ")} · แถวต่อเลข: ${dup.map((r) => `${r.no}×${r.n}`).join(", ")}`,
      status: ok ? "PASS" : "FAIL", docs: docs.map((d) => d.no), images,
    });
    expect(ok).toBe(true);
  },
);

test(
  "TC-PE-520002 ราคาต่อหน่วยในใบชดเชยตรงกับกติกาต้นทุนของ scenario",
  {
    annotation: [
      {
        type: "preconditions",
        description:
          "TC-PE-520001 รันแล้ว (ภาพใบชดเชย); ใบชดเชยของคลัง 1AG01 มีบรรทัดของสินค้าทุกตัวใน costCases ของ scenario; เอกสารรับเข้า/กับดักราคาของ pre-step และ TC-PE-500001 ยังอยู่; E2E_DB_URL ตั้งไว้",
      },
      {
        type: "steps",
        description:
          "1. อ่านราคาต่อหน่วยบนบรรทัด SI ชดเชย (สินค้าที่นับเกิน) และ SO ชดเชย (สินค้าที่นับขาด) พร้อมต้นทุนที่บัญชีโพสต์ของบรรทัด SO\n2. ต่อสินค้าใน costCases: คิดราคาที่คาด — ราคาตายตัวจากเอกสารรับเข้าที่กติกาเลือก, ค่าเฉลี่ยงวด (มูลค่า ÷ จำนวนรับเข้าทั้งงวดทุกคลัง รวมยอดยกมา ไม่รวมใบชดเชยรอบนี้) หรือ ต้นทุนที่บัญชีโพสต์\n3. หาเอกสารต้นทางที่ราคาตรงกับที่ระบบให้ และ cost layer ที่ใบชดเชยลงบัญชี (แสดงในหลักฐาน)",
      },
      {
        type: "expected",
        description:
          "ทุกสินค้าใน costCases: ราคาบนใบชดเชย = ราคาที่คาดตามกติกาของ scenario (เช่น ล็อตของ GRN ที่ void / GRN งวดหน้า / GRN draft ต้องไม่ถูกหยิบ) และมีบรรทัดครบทุกสินค้า",
      },
      { type: "priority", description: "High" },
      { type: "testType", description: "Functional" },
      {
        type: "note",
        description:
          "เดิม 2.9-P1..P4 (_movement_play specs/45-verify) · ต้นฉบับบันทึก FAIL ลง results.json แต่ assert แค่ว่ามีบรรทัดครบ — port assert ราคาเท่าที่คาดทุกสินค้า · เคย FAIL ใน period03 / period04 (lookupLastReceiving / lookupLast หยิบ GRN void, GRN งวดหน้า, SI ร่าง) แก้แล้วด้วย PR #702 / #706 / #708 / #709 (สถานะ FIXED) · รอบล่าสุด p11-r4 / avg2607-r4 (2026-10-02) PASS ทุกตัว จึงไม่ใช่บั๊กที่รู้อยู่",
      },
    ],
  },
  async () => {
    // ราคาต่อหน่วยบนใบชดเชยทั้งสองฝั่ง: SI (นับเกิน) และ SO (นับขาด) — ทั้งคู่ตีราคาจาก si.cost-from
    const docLines = (side: "in" | "out") => sql(side === "in" ? `
      select p.code, d.cost_per_unit from ${SCHEMA}.tb_stock_in_detail d
      join ${SCHEMA}.tb_stock_in s on s.id = d.stock_in_id join ${SCHEMA}.tb_product p on p.id = d.product_id
      where s.description = '${DESC}' and s.deleted_at is null and d.deleted_at is null` : `
      select p.code, d.cost_per_unit, abs(itd.cost_per_unit) posted from ${SCHEMA}.tb_stock_out_detail d
      join ${SCHEMA}.tb_stock_out s on s.id = d.stock_out_id join ${SCHEMA}.tb_product p on p.id = d.product_id
      left join ${SCHEMA}.tb_inventory_transaction_detail itd on itd.inventory_transaction_id = d.inventory_transaction_id
      where s.description = '${DESC}' and s.deleted_at is null and d.deleted_at is null`);
    const outLines = docLines("out");
    const costOf = {
      in: Object.fromEntries(docLines("in").map((l) => [l.code, Number(l.cost_per_unit)])),
      out: Object.fromEntries(outLines.map((l) => [l.code, Number(l.cost_per_unit)])),
    };
    // ต้นทุนที่บัญชีโพสต์ของบรรทัด SO (ใช้กับ want: "posted")
    const postedOf = Object.fromEntries(outLines.map((l) => [l.code, Number(l.posted)]));
    const cases = SCN.costCases;
    const codes = cases.map((c) => `'${c.p.code}'`).join(",");
    // layer ที่ใบชดเชยลงบัญชี — ผูกกับใบผ่าน transaction_detail → transaction.inventory_doc_no
    // (ฝั่ง out บน FIFO ตัดจากล็อตจริง ราคาอาจไม่เท่าบนใบ และอาจแตกหลายล็อต — แสดงไว้ดูเฉย ๆ)
    const layerRows = sql(`
      select p.code, cl.transaction_type::text tt, cl.at_period, cl.in_qty, cl.out_qty, cl.cost_per_unit from ${SCHEMA}.tb_inventory_transaction_cost_layer cl
      join ${SCHEMA}.tb_inventory_transaction_detail itd on itd.id = cl.inventory_transaction_detail_id
      join ${SCHEMA}.tb_inventory_transaction it on it.id = itd.inventory_transaction_id
      join ${SCHEMA}.tb_product p on p.id = cl.product_id
      where cl.deleted_at is null and p.code in (${codes}) and it.inventory_doc_no in (
        select id from ${SCHEMA}.tb_stock_in where description = '${DESC}' and deleted_at is null
        union all select id from ${SCHEMA}.tb_stock_out where description = '${DESC}' and deleted_at is null)
      order by cl.lot_seq_no`);
    const images = {
      in: (prevRecord("2.8")?.images ?? []).filter((i) => i.includes("_SI")),
      out: (prevRecord("2.8")?.images ?? []).filter((i) => i.includes("_SO")),
    };
    // ค่าเฉลี่ย ณ ปิดงวด (สูตร computePeriodAverages): มูลค่า/จำนวนรับเข้าทั้งงวดของสินค้า ทุกคลัง รวมยอดยกมา
    // ไม่รวม close_period และไม่รวมใบชดเชยของรอบนี้เอง (มันเกิดหลังตีราคา)
    const periodAverage = (code: string) => {
      const [r] = sql(`
        select round(sum(cl.total_cost) / nullif(sum(cl.in_qty), 0), 2) avg, sum(cl.in_qty) qty, sum(cl.total_cost) val
        from ${SCHEMA}.tb_inventory_transaction_cost_layer cl
        join ${SCHEMA}.tb_inventory_transaction_detail itd on itd.id = cl.inventory_transaction_detail_id
        join ${SCHEMA}.tb_inventory_transaction it on it.id = itd.inventory_transaction_id
        join ${SCHEMA}.tb_product p on p.id = cl.product_id
        where p.code = '${code}' and cl.at_period = '${PERIOD}' and cl.deleted_at is null and cl.in_qty > 0
          and cl.transaction_type::text <> 'close_period'
          and it.inventory_doc_no not in (
            select id from ${SCHEMA}.tb_stock_in where description = '${DESC}'
            union all select id from ${SCHEMA}.tb_stock_out where description = '${DESC}')`);
      return { avg: Number(r?.avg), qty: Number(r?.qty), val: Number(r?.val) };
    };
    const mismatched: string[] = [];
    for (const [i, c] of cases.entries()) {
      const side = c.side ?? "in";
      const doc = side === "in" ? "SI" : "SO";
      const got = costOf[side][c.p.code];
      const pa = c.want === "period-average" ? periodAverage(c.p.code) : null;
      const isPosted = c.want === "posted";
      const want = pa ? pa.avg : isPosted ? postedOf[c.p.code] : (c.want as number);
      const layers = layerRows.filter((r) => r.code === c.p.code && r.tt === `adjustment_${side}`);
      const layerText = layers.length
        ? layers.map((l) => `at_period=${l.at_period} ${side}=${Number(side === "in" ? l.in_qty : l.out_qty)}@${Number(l.cost_per_unit)}`).join(" + ")
        : "(ไม่พบ)";
      // เอกสารรับเข้าที่ราคาตรงกับที่ระบบให้ (GRN / SI ทุกสถานะ ทุกงวด) — บอกว่าระบบไปหยิบมาจากใบไหน
      const src = got === undefined ? [] : sql(`
        select 'GRN' t, g.grn_no no, g.doc_status::text st, (g.grn_date at time zone 'Asia/Bangkok')::date::text dt, null::text made from ${SCHEMA}.tb_good_received_note_detail_item i
          join ${SCHEMA}.tb_good_received_note_detail gd on gd.id = i.good_received_note_detail_id join ${SCHEMA}.tb_good_received_note g on g.id = gd.good_received_note_id
          join ${SCHEMA}.tb_product p on p.id = gd.product_id join ${SCHEMA}.tb_location l on l.id = gd.location_id
          where p.code = '${c.p.code}' and l.code = '${L.code}' and i.received_base_qty > 0 and round(i.net_amount / i.received_base_qty, 2) = ${got}
        union all
        select 'SI', s.si_no, s.doc_status::text || case when s.deleted_at is null then '' else ' (ลบภายหลังใน 2.10-ready)' end, (s.si_date at time zone 'Asia/Bangkok')::date::text, (d.created_at at time zone 'Asia/Bangkok')::date::text from ${SCHEMA}.tb_stock_in_detail d
          join ${SCHEMA}.tb_stock_in s on s.id = d.stock_in_id join ${SCHEMA}.tb_product p on p.id = d.product_id
          where p.code = '${c.p.code}' and s.location_id = (select id from ${SCHEMA}.tb_location where code = '${L.code}') and d.cost_per_unit = ${got} and s.description <> '${DESC}'`);
      // SI แสดงวันที่สร้างด้วย เพราะโค้ดก่อน PR #702 เทียบ SI ด้วย created_at (ไม่ใช่ si_date)
      // ใบที่กติกาเลือกจริง = ราคาตรง ลงวันที่ไม่เกินสิ้นงวด ใหม่สุด — ถ้าไม่มี (หยิบผิดงวด) แสดงทุกใบที่ราคาตรง
      const fmt = (r: Record<string, string>) => `${r.t} ${r.no} ${r.st} ลงวันที่ ${r.dt}${r.made ? ` สร้าง ${r.made}` : ""}`;
      const inScope = src.filter((r) => r.dt <= SCN.periodEnd).sort((x, y) => y.dt.localeCompare(x.dt));
      const srcText = inScope.length
        ? `${fmt(inScope[0])}${inScope.length > 1 ? ` (+${inScope.length - 1} ใบราคาเดียวกันที่เก่ากว่า)` : ""}`
        : src.map(fmt).join(", ");
      const pass = got === want;
      let note = "";
      if (pass && !SCN.fixedBy && src.some((r) => r.t === "SI" && r.made > SCN.periodEnd)) {
        note = `— หมายเหตุ: ราคาตรงเพราะ SI ถูกเทียบด้วยวันที่สร้าง (หลังสิ้นงวด) ซึ่งชนะ grn_date ของ GRN ทุกใบในงวดเสมอ — ตัวหลอก "${c.trap}" จึงไม่ได้ถูกทดสอบจริง`;
      } else if (!pass && SCN.fixedBy) {
        note = `— ยังผิดหลัง ${SCN.fixedBy}`;
      } else if (!pass) {
        note = SCN.costFrom.value === "last_cost"
          ? "— ต้นเหตุ: lookupLast (costing.service.ts) เลือกใบใหม่สุดระหว่าง GRN (เทียบ grn_date) กับ SI (เทียบ created_at) ไม่กรองสถานะ/งวด"
          : "— ต้นเหตุ: lookupLastReceiving (costing.service.ts) เรียงแค่ grn_date desc ไม่กรองสถานะ/งวด";
      }
      record({
        id: `2.9-P${i + 1}`, case: CASE,
        title: `ราคา ${c.p.name} (${c.p.code}) ใน ${doc} ชดเชย — ${c.topic}`,
        steps: [
          `si.cost-from = ${SCN.costFrom.value}${SCN.fixedBy ? ` · backend = ${SCN.fixedBy}` : ""}`,
          `ที่ ${L.code}: ${c.wantFrom} · ตัวหลอก: ${c.trap}`,
          `Submit ใบนับ → ดูราคาใน ${doc} ชดเชย`,
        ],
        expected: pa
          ? `${want} = ${pa.val} ÷ ${pa.qty} (มูลค่า ÷ จำนวนรับเข้าทั้งงวด รวมยอดยกมา) — กติกา: ${SCN.rule}`
          : isPosted
            ? `${want} = ต้นทุนที่บัญชีโพสต์ (ล็อตที่ตัดจริง / ค่าเฉลี่ย) — ของออกไม่ตีราคาด้วย si.cost-from`
            : `${want} (จาก ${c.wantFrom}) — กติกา: ${SCN.rule}`,
        actual: (pa || isPosted
          ? `${got} บนใบ · layer ที่ลงบัญชี: ${layerText} ${isPosted ? "" : note}`
          : `${got} ← ระบบหยิบจาก ${srcText || "(หาใบต้นทางไม่เจอ)"} · layer ที่ลงบัญชี: ${layerText} ${note}`).trim(),
        status: pass ? "PASS" : "FAIL",
        // ราคาที่ระบบให้อ่านได้จากภาพใบชดเชยของข้อ 2.8
        images: images[side],
      });
      if (!pass) mismatched.push(`2.9-P${i + 1} ${c.p.code} ${doc}: ได้ ${got} คาด ${want} (${c.topic})`);
    }
    expect(cases.filter((c) => costOf[c.side ?? "in"][c.p.code] === undefined).map((c) => c.p.code)).toEqual([]);
    // verdict ที่บันทึกไว้ (ต้นฉบับบันทึก FAIL แต่ test ไม่ล้ม)
    expect(mismatched, "ราคาบนใบชดเชยไม่ตรงกติกา").toEqual([]);
  },
);

test(
  "TC-PE-520003 ยอดระบบที่ใบนับใช้เทียบเท่ากับยอดคงเหลือ ณ สิ้นงวดที่นับทุกคลังและสินค้า",
  {
    annotation: [
      {
        type: "preconditions",
        description: "TC-PE-510001 นับครบแล้ว (ใบนับของงวดที่ทดสอบมี on_hand_qty ที่บันทึกตอนนับ); E2E_DB_URL ตั้งไว้",
      },
      {
        type: "steps",
        description:
          "1. อ่าน on_hand_qty ทุกแถวของใบนับงวดที่ทดสอบ\n2. คิดยอดคงเหลือ ณ สิ้นงวดจาก cost layer (at_period ไม่เกินงวดที่นับ ไม่รวมใบชดเชยของรอบนี้)\n3. แถวที่ไม่เท่า แยกสาเหตุ: รายการของใบที่ void/ลบ, รายการงวดหลัง, qty ของรายการไม่ตรง cost layer",
      },
      {
        type: "expected",
        description: "ไม่มีคลัง/สินค้าใดที่ยอดในใบนับต่างจากยอดคงเหลือ ณ สิ้นงวดที่นับ",
      },
      { type: "priority", description: "Medium" },
      { type: "testType", description: "Edge Case" },
      {
        type: "note",
        description:
          "เดิม 2.7-onhand (_movement_play specs/45-verify) · ต้นฉบับไม่มี expect เลย (บันทึก FAIL ลง results.json แต่ test เขียว) — port assert ว่าไม่มีแถวที่ยอดไม่ตรง · เคย FAIL ใน period03–05 และ avg09 (นับรายการของใบที่ void และรายการงวดหลัง) แก้แล้วด้วย PR #705 (สถานะ FIXED) · รอบล่าสุด p11-r4 / avg2607-r4 (2026-10-02) PASS จึงไม่ใช่บั๊กที่รู้อยู่ · อ่านอย่างเดียว",
      },
    ],
  },
  async () => {
    // ยอดที่ใบนับใช้ (on_hand_qty ตอน review) เทียบยอด ณ สิ้นงวดจาก cost layer (at_period <= งวด ไม่รวมใบชดเชยของรอบนี้)
    // แล้วแยกส่วนต่าง: รายการของใบที่ void/ลบ (detail ไม่มี deleted_at ของตัวเอง — service ไม่ join หัวรายการ) กับรายการงวดหลัง
    const rows = sql(`
      with eop as (
        select id from ${SCHEMA}.tb_stock_in where description = '${DESC}'
        union all select id from ${SCHEMA}.tb_stock_out where description = '${DESC}'),
      sheet as (
        select c.location_id, d.product_id, l.code loc, p.code prod, d.on_hand_qty sheet_q
        from ${SCHEMA}.tb_physical_count_detail d join ${SCHEMA}.tb_physical_count c on c.id = d.physical_count_id
        join ${SCHEMA}.tb_physical_count_period pp on pp.id = c.physical_count_period_id
        join ${SCHEMA}.tb_inventory_period ip on ip.id = pp.period_id and ip.period = '${PERIOD}'
        join ${SCHEMA}.tb_location l on l.id = c.location_id join ${SCHEMA}.tb_product p on p.id = d.product_id
        where d.deleted_at is null and c.deleted_at is null),
      lay as (
        select cl.location_id, cl.product_id, cl.at_period, cl.in_qty - cl.out_qty q, it.inventory_doc_no in (select id from eop) is_eop
        from ${SCHEMA}.tb_inventory_transaction_cost_layer cl
        join ${SCHEMA}.tb_inventory_transaction_detail itd on itd.id = cl.inventory_transaction_detail_id
        join ${SCHEMA}.tb_inventory_transaction it on it.id = itd.inventory_transaction_id
        where cl.deleted_at is null),
      agg as (
        select location_id, product_id,
          coalesce(sum(q) filter (where at_period <= '${PERIOD}' and not is_eop), 0) period_q,
          coalesce(sum(q) filter (where at_period > '${PERIOD}'), 0) later_q
        from lay group by 1,2),
      gone as (
        select itd.location_id, itd.product_id, sum(itd.qty) gone_q
        from ${SCHEMA}.tb_inventory_transaction_detail itd join ${SCHEMA}.tb_inventory_transaction it on it.id = itd.inventory_transaction_id
        where it.deleted_at is not null group by 1,2),
      bare as (
        -- รายการที่ qty ของตัวเองไม่เท่ายอดใน cost layer (เช่น CN คืนเกินสต๊อกก่อน #659: detail −30 แต่ layer ตัดได้ −10)
        select itd.location_id, itd.product_id,
          sum(itd.qty - coalesce((select sum(cl.in_qty - cl.out_qty) from ${SCHEMA}.tb_inventory_transaction_cost_layer cl
            where cl.inventory_transaction_detail_id = itd.id and cl.deleted_at is null), 0)) bare_q
        from ${SCHEMA}.tb_inventory_transaction_detail itd join ${SCHEMA}.tb_inventory_transaction it on it.id = itd.inventory_transaction_id
        where it.deleted_at is null and it.inventory_doc_no not in (select id from eop)
        group by 1,2)
      select sheet.loc, sheet.prod, sheet.sheet_q, coalesce(agg.period_q, 0) period_q, coalesce(agg.later_q, 0) later_q,
        coalesce(gone.gone_q, 0) gone_q, coalesce(bare.bare_q, 0) bare_q
      from sheet
      left join agg on agg.location_id = sheet.location_id and agg.product_id = sheet.product_id
      left join gone on gone.location_id = sheet.location_id and gone.product_id = sheet.product_id
      left join bare on bare.location_id = sheet.location_id and bare.product_id = sheet.product_id
      where sheet.sheet_q <> coalesce(agg.period_q, 0) order by 1,2`);
    const [{ n: sheetCount }] = sql(`
      select count(*) n from ${SCHEMA}.tb_physical_count_detail d join ${SCHEMA}.tb_physical_count c on c.id = d.physical_count_id
      join ${SCHEMA}.tb_physical_count_period pp on pp.id = c.physical_count_period_id
      join ${SCHEMA}.tb_inventory_period ip on ip.id = pp.period_id and ip.period = '${PERIOD}'
      where d.deleted_at is null and c.deleted_at is null`);
    const why = (r: Record<string, string>) =>
      [
        Number(r.gone_q) ? `ใบที่ void/ลบ ${Number(r.gone_q) > 0 ? "+" : ""}${Number(r.gone_q)}` : "",
        Number(r.later_q) ? `งวดหลัง ${Number(r.later_q) > 0 ? "+" : ""}${Number(r.later_q)}` : "",
        Number(r.bare_q) ? `qty ของรายการไม่ตรง cost layer ${Number(r.bare_q) > 0 ? "+" : ""}${Number(r.bare_q)}` : "",
      ]
        .filter(Boolean).join(", ") || "อื่น ๆ";
    const diffs = rows.map((r) => `${r.loc}/${r.prod}: ใบนับใช้ ${Number(r.sheet_q)} แต่ ณ สิ้น ${PERIOD} = ${Number(r.period_q)} (${why(r)})`);
    record({
      id: "2.7-onhand", case: CASE, title: "ยอดระบบที่ใบนับใช้เทียบ ไม่เท่ายอดคงเหลือ ณ สิ้นงวดที่กำลังนับ",
      steps: [
        `ใบนับงวด ${PERIOD} · ขั้น review คิด on-hand = SUM(tb_inventory_transaction_detail.qty) ต่อคลัง/สินค้า (physical-count.service reviewItems)`,
        "ไม่กรองงวด และไม่ join หัวรายการ (tb_inventory_transaction.deleted_at) — รายการของใบที่ void/ลบยังถูกนับ",
      ],
      expected: `ยอดระบบ = ยอดคงเหลือ ณ สิ้นงวดที่นับ (${PERIOD})`,
      actual: rows.length
        ? `${diffs.join(" · ")} ` +
          `— ถ้าคนนับตามของจริง ณ ${SCN.periodEnd} จะเกิดใบชดเชยผิดลงงวด ${PERIOD} · ชุดทดสอบนับเท่ายอดที่ระบบเทียบ (ไม่ให้เกิดใบชดเชยปลอม)`
        : `ยอดในใบนับเท่ายอด ณ สิ้น ${PERIOD} ทุกคลัง/สินค้า (${sheetCount} รายการในใบนับ)`,
      status: rows.length ? "FAIL" : "PASS",
    });
    expect(Number(sheetCount), "ไม่มีแถวใบนับของงวดนี้ — รัน TC-PE-510001 ก่อน").toBeGreaterThan(0);
    // verdict ที่บันทึกไว้ (ต้นฉบับบันทึก FAIL แต่ไม่มี expect)
    expect(diffs, "ยอดในใบนับไม่เท่ายอด ณ สิ้นงวด").toEqual([]);
  },
);

test(
  "TC-PE-520004 เคลียร์เอกสารที่ขวางหรือค้างแล้วงวดพร้อมปิด ปุ่ม Close Period กดได้โดยไม่กดปิดจริง",
  {
    annotation: [
      {
        type: "preconditions",
        description:
          "TC-PE-500001 สร้างเอกสาร closeGate ไว้ (จำใน state.json); TC-PE-510001 นับครบทุกคลังแล้ว; งวดที่ทดสอบยังเป็นงวดปัจจุบัน; POST /period-ends ถูกตัดทิ้งทั้งไฟล์",
      },
      {
        type: "steps",
        description:
          "1. ต่อเอกสารใน closeGate: GRN saved → Void (หรือ Commit เมื่อ scenario กำหนด clear = commit เช่น AVG ที่ลงสต๊อกตั้งแต่ save) · GRN draft → ลบ · SI ร่าง → ลบ (ข้ามใบที่ทำแล้ว)\n2. เปิด Period End → Review\n3. อ่าน can_close / close_blocking จาก /period-ends/review และดูปุ่ม Close Period (ไม่กด)",
      },
      {
        type: "expected",
        description: "close_blocking ทุกตัวเป็น 0 · can_close = true · ปุ่ม Close Period กดได้",
      },
      { type: "priority", description: "High" },
      { type: "testType", description: "Functional" },
      {
        type: "note",
        description:
          "เดิม 2.10-ready (_movement_play specs/45-verify) · void/ลบเอกสาร closeGate จริง (ทำซ้ำได้ — ข้ามที่ทำแล้ว) แต่ไม่กดปิดงวด · ต้นฉบับ assert แค่ can_close — port assert ปุ่ม Close Period กดได้ด้วยตาม verdict · ซ้อนกับ TC-PE-030001 ใน 900-period-end ซึ่งเป็น skip ว่าง · รอบล่าสุด p11-r4 / avg2607-r4 (2026-10-02) PASS",
      },
    ],
  },
  async ({ page }) => {
    const images: string[] = [];
    const steps: string[] = [];
    const docs: string[] = [];
    for (const [i, c] of SCN.closeGate.entries()) {
      const d = getDoc(c.key)!;
      expect(d, `state.json ไม่มี ${c.key} — รัน TC-PE-500001 ก่อน`).toBeTruthy();
      const tag = String.fromCharCode(97 + i); // a, b, c …
      if (c.kind === "grn-saved" && c.clear === "commit") {
        if ((await grnById(d.id)).status !== "committed") await commitGrn(page, d.id);
        putDoc(c.key, { ...(await grnById(d.id)) });
        images.push(await shot(page, "2.10-ready", `${tag}-commit-${d.no}`));
        steps.push(`Commit ${d.no} (GRN saved ${c.product.name} — AVG ลงสต๊อกตั้งแต่ save จึงปิดใบแทน void)`);
      } else if (c.kind === "grn-saved") {
        if ((await grnById(d.id)).status !== "voided") await voidGrn(page, d.id, `E2E เคลียร์ก่อนปิดงวด ${PERIOD}`);
        putDoc(c.key, { ...(await grnById(d.id)) });
        images.push(await shot(page, "2.10-ready", `${tag}-void-${d.no}`));
        steps.push(`Void ${d.no} (GRN saved ${c.product.name})`);
      } else if (c.kind === "grn-draft") {
        if (getDoc(c.key)!.status !== "deleted") {
          await deleteGrnDraft(page, d.id);
          putDoc(c.key, { ...d, status: "deleted" });
          images.push(await shot(page, "2.10-ready", `${tag}-delete-${d.no}`));
        }
        steps.push(`ลบ ${d.no} (GRN draft ${c.product.name})`);
      } else {
        if ((await adjustmentById("stock-in", d.id)).status !== "deleted") {
          await deleteAdjustment(page, "stock-in", d.id);
          putDoc(c.key, { ...d, status: "deleted" });
          images.push(await shot(page, "2.10-ready", `${tag}-delete-${d.no}`));
        }
        steps.push(`ลบ ${d.no} (SI ร่าง ${c.product.name})`);
      }
      docs.push(d.no);
    }

    const r = await review(BU);
    await gotoInBu(page, "/inventory-management/period-end/review");
    await page.waitForTimeout(1500);
    const enabled = await page.getByRole("button", { name: /close period/i }).isEnabled();
    images.push(await shot(page, "2.10-ready", "z-review-พร้อมปิด"));
    record({
      id: "2.10-ready", case: "Case 2 · ปิดงวด", title: "พร้อมกด Close Period",
      steps: [...steps, "Period End → Review"],
      expected: "close_blocking ทุกตัว = 0 · can_close = true · ปุ่ม Close Period กดได้",
      actual: `can_close=${r.can_close} · close_blocking=${JSON.stringify(r.close_blocking)} · ปุ่ม Close ${enabled ? "กดได้" : "กดไม่ได้"} · รอบนับ=${r.physical_count_period?.status}`,
      status: r.can_close && enabled ? "PASS" : "FAIL", docs, images,
    });
    expect(r.can_close, `ยังปิดไม่ได้: ${JSON.stringify(r.close_blocking)}`).toBe(true);
    expect(enabled, "ปุ่ม Close Period ต้องกดได้").toBe(true);
  },
);
