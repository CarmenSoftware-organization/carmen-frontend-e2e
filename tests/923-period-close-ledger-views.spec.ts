import { test, expect, gotoInBu, BU, SCHEMA, requireScenario, sql, record, shot, gatePhase, apiGet } from "./helpers/period-close/context";
import { createAdjustment } from "./helpers/period-close/docs";
import { currentPeriod, expectedIssueCost, voidedLotCosts } from "./helpers/period-close/estimate";
import { L, P, PERIOD } from "./helpers/period-close/scenarios";

/**
 * Period close · Case 3 · screens that read the ledger (AVG 2601–2603 findings → PR #708) — section 53 of PE.
 *
 *  - 3.1  the cost CostProbe fills on a new Stock In / Stock Out form = the cost posting
 *         the issue would use (not a voided GRN's lot, no stray decimals, AVG uses the
 *         average, not a lot price) — dry-run forms, nothing is saved
 *  - 3.2  Inventory → Transaction: open (brought forward) in Qty In, close in Qty Out as a
 *         positive number, matching the ledger
 *  - 3.3  inventory-info (movements of a product at a location) has no row of a voided
 *         document — no frontend screen shows this list, so it is checked on the API
 *
 * Read-only, rerunnable at any time.
 * Prerequisites: the scenario's pre-step documents exist (3.1 / 3.3 read location L's
 * lots); 3.2 needs at least one closed period to have open/close rows to check — on the
 * first period after a reset it records N/A and checks the list is empty.
 * Run: E2E_PERIOD_BU=<BU> bun run test:period-close -- tests/923-period-close-ledger-views.spec.ts
 * Origin: _movement_play/eop_bf/e2e/specs/47-ledger-views.spec.ts
 */
/**
 * Case 3 · หน้าจอที่อ่านจากบัญชี (ข้อค้นพบ AVG 2601–2603 → PR #708)
 * 3.1 ราคาที่ CostProbe เติมบนฟอร์ม SI/SO = ราคาที่การโพสต์ใบจ่ายจะคิด (ไม่ใช่ล็อตของ GRN ที่ void, ไม่มีทศนิยมเพี้ยน,
 *     AVG ใช้ค่าเฉลี่ย ไม่ใช่ราคาล็อต) — ฟอร์ม dry-run ไม่สร้างเอกสาร
 * 3.2 หน้า Inventory → Transaction: open (ยกเข้า) อยู่ช่อง Qty In, close อยู่ช่อง Qty Out เป็นเลขบวก
 * 3.3 inventory-info (รายการเคลื่อนไหวของสินค้าที่คลัง) ไม่มีแถวของใบที่ void — FE ไม่มีหน้าแสดงรายการนี้ จึงตรวจผ่าน API
 * อ่านอย่างเดียวทั้งหมด รันซ้ำได้ทุกเมื่อ
 */
const CASE = "Case 3 · หน้าจอที่อ่านจากบัญชี (PR #708)";
const PRODUCTS = [P.P1, P.P2, P.P3, P.P4];
const PROBE_QTY = 3;

test.beforeAll(() => requireScenario());
// ทุกเคสอ่าน cost layer / ledger ผ่าน SQL (E2E_DB_URL)
gatePhase({ db: true });

test(
  "TC-PE-530001 ราคาที่ฟอร์ม Stock In และ Stock Out เติมให้ (CostProbe) ตรงกับราคาที่การโพสต์ใบจ่ายจะคิด",
  {
    annotation: [
      {
        type: "preconditions",
        description:
          "Login เป็น Admin (gmail) บน BU ของ scenario; E2E_PERIOD_BU และ E2E_DB_URL ตั้งไว้; คลัง L มีล็อตของ P1–P4 จาก pre-step (บางสินค้ามีล็อตของ GRN ที่ void เป็นตัวหลอก)",
      },
      {
        type: "steps",
        description:
          "1. เปิดฟอร์ม Stock In ใหม่ ลงวันที่สิ้นงวดปัจจุบัน คลัง L เพิ่ม P1–P4 อย่างละ 3 หน่วย อ่านราคาต่อหน่วยที่ฟอร์มเติมให้ (ไม่บันทึก)\n2. ทำแบบเดียวกันกับฟอร์ม Stock Out อ่านช่อง Total Cost (ไม่บันทึก)\n3. คิดราคาที่คาดจาก cost layer: FIFO ตัดล็อตเก่าก่อนจากงวดที่หยิบได้ · AVG ค่าเฉลี่ยสุทธิ · ของไม่พอ = ไม่เติมราคา",
      },
      {
        type: "expected",
        description:
          "ทุกสินค้า: ราคาต่อหน่วยบน SI = ราคาเฉลี่ยที่คาด และ Total Cost บน SO = ยอดรวมที่คาด ทศนิยมไม่เกิน 2 ตำแหน่ง ไม่ใช่ราคาล็อตของ GRN ที่ void · ถ้าของไม่พอ ช่องราคาต้องว่างหรือ 0",
      },
      { type: "priority", description: "Medium" },
      { type: "testType", description: "Functional" },
      {
        type: "note",
        description:
          "เดิม 3.1-P1..P4 (_movement_play specs/47-ledger-views) · ต้นฉบับไม่มี expect เลย (บันทึก FAIL ลง results.json แต่ test เขียว) — port assert ทุกสินค้าตาม verdict · ฟอร์ม dry-run ไม่สร้างเอกสาร · ข้อค้นพบเดิม AVG 2601–2603 แก้ด้วย PR #708 · รอบล่าสุด p11-r4 / avg2607-r4 (2026-10-02) PASS ทุกตัว",
      },
    ],
  },
  async ({ page }) => {
    const cur = currentPeriod();
    const auto: Record<"stock-in" | "stock-out", string[]> = { "stock-in": [], "stock-out": [] };
    const images: Record<string, string> = {};
    for (const type of ["stock-in", "stock-out"] as const) {
      await createAdjustment(page, {
        type, date: cur.end_at, reason: type === "stock-in" ? "E2E IA stock in" : "E2E IA stock out", status: "draft", dryRun: true,
        lines: PRODUCTS.map((p) => ({ product: p.code, qty: PROBE_QTY })),
        onAutoCost: (c) => (auto[type] = c),
      });
      images[type] = await shot(page, "3.1", `${type === "stock-in" ? "SI" : "SO"}-form-CostProbe`);
    }
    expect(auto["stock-in"], "ฟอร์ม SI ต้องอ่านราคาได้ครบทุกแถว").toHaveLength(PRODUCTS.length);
    expect(auto["stock-out"], "ฟอร์ม SO ต้องอ่านราคาได้ครบทุกแถว").toHaveLength(PRODUCTS.length);
    const failed: string[] = [];
    // autoCost เรียงตามลำดับที่เพิ่มแถว (อ่านจากแถวที่เพิ่งเพิ่มทุกครั้ง) จึงจับคู่กับ PRODUCTS ได้ตรง
    for (const [i, p] of PRODUCTS.entries()) {
      const want = expectedIssueCost(p.code, PROBE_QTY, cur.period);
      const si = auto["stock-in"][i];
      const so = auto["stock-out"][i];
      const traps = voidedLotCosts(p.code);
      const noisy = [si, so].some((v) => /\.\d{3,}/.test(v));
      // SI อ่านราคาต่อหน่วยจากช่องราคา · SO ฟอร์มมีแต่ Total Cost จึงเทียบยอดรวม
      const pass = want.ok
        ? Number(si) === want.avg && Number(so) === want.total && !noisy
        : [si, so].every((v) => v === "" || Number(v) === 0);
      record({
        id: `3.1-P${i + 1}`, case: CASE,
        title: `CostProbe ${p.name} (${p.code}) ${PROBE_QTY} หน่วยที่ ${L.code} — งวด ${cur.period}`,
        steps: [
          `เปิดฟอร์ม SI และ SO ใหม่ (ไม่บันทึก) ลงวันที่ ${cur.end_at} คลัง ${L.code}`,
          `เพิ่ม ${p.code} จำนวน ${PROBE_QTY} → อ่านราคาที่ฟอร์มเติมให้`,
        ],
        expected: want.ok
          ? `SI ราคาต่อหน่วย ${want.avg} · SO Total Cost ${want.total} (= ${want.how}) · ทศนิยมไม่เกิน 2 ตำแหน่ง · ไม่ใช่ราคาล็อตของ GRN ที่ void${traps.length ? ` (${traps.join(", ")})` : ""}`
          : `ไม่เติมราคา — ของไม่พอ (${want.how})`,
        actual: `SI ราคาต่อหน่วย ${si || "(ว่าง)"} · SO Total Cost ${so || "(ว่าง)"}${noisy ? " · ทศนิยมเพี้ยน" : ""}`,
        status: pass ? "PASS" : "FAIL",
        images: [images["stock-in"], images["stock-out"]],
      });
      if (!pass) {
        failed.push(`3.1-P${i + 1} ${p.code}: SI ${si || "(ว่าง)"} / SO ${so || "(ว่าง)"} คาด ${want.ok ? `${want.avg} / ${want.total}` : "ว่าง (ของไม่พอ)"}`);
      }
    }
    // verdict ที่บันทึกไว้ (ต้นฉบับไม่มี expect)
    expect(failed, "ราคาที่ CostProbe เติมไม่ตรงราคาที่การโพสต์จะคิด").toEqual([]);
  },
);

test(
  "TC-PE-530002 หน้า Inventory Transaction แสดงยกเข้า (open) ในช่อง Qty In และปิดงวด (close) ในช่อง Qty Out เป็นเลขบวก",
  {
    annotation: [
      {
        type: "preconditions",
        description:
          "Login เป็น Admin (gmail) บน BU ของ scenario; E2E_DB_URL ตั้งไว้; มีงวดที่ปิดแล้วอย่างน้อยหนึ่งงวดจึงจะมีแถว open/close ให้ตรวจ (งวดแรกหลังรีเซ็ตบันทึก N/A)",
      },
      {
        type: "steps",
        description:
          "1. เปิด /inventory-management/transaction?inventory_doc_type=open,close รอคำขอรายการที่มีตัวกรองชนิด\n2. นับแถว open/close ในบัญชี (tb_inventory_transaction) — ถ้าไม่มี บันทึก N/A\n3. อ่านช่อง Qty In / Qty Out ทุกแถวในหน้าแรก เทียบผลรวม qty บวก/ลบของรายการนั้นในบัญชี",
      },
      {
        type: "expected",
        description:
          "มีแถวในบัญชี: หน้าจอมีแถว และมีคอลัมน์ Qty In / Qty Out · open: Qty In = ยอดยกเข้า, Qty Out = - · close: Qty Out = ยอดที่ตัดเป็นเลขบวก, Qty In = - · ตัวเลขตรงบัญชีทุกแถว · ไม่มีแถวในบัญชี: รายการที่หน้าจอได้ต้องว่างด้วย",
      },
      { type: "priority", description: "Medium" },
      { type: "testType", description: "Functional" },
      {
        type: "note",
        description:
          "เดิม 3.2 (_movement_play specs/47-ledger-views) · ต้นฉบับ assert แค่ว่ามีแถว — port assert ทิศและจำนวนทุกแถวตาม verdict · กรณีไม่มีแถว open/close ในบัญชี ต้นฉบับบันทึก N/A แล้ว return เงียบ — port assert ว่าหน้าจอก็ไม่ได้แถวมาเช่นกัน (รอบ p10-r3 / avg2606-r3 เป็นแบบนี้: 0 แถว) · รอบล่าสุด p11-r4 / avg2607-r4 (2026-10-02) PASS · อ่านอย่างเดียว",
      },
    ],
  },
  async ({ page }) => {
    // รอเฉพาะคำขอที่มีตัวกรองชนิดแล้ว — หน้าอาจยิงรอบแรกก่อนอ่าน URL
    const listed = page.waitForResponse(
      (r) => /\/inventory-transactions\?/.test(r.url()) && decodeURIComponent(r.url()).includes("inventory_doc_type") && r.request().method() === "GET",
      { timeout: 60_000 },
    );
    await gotoInBu(page, "/inventory-management/transaction?inventory_doc_type=open,close");
    const body = await (await listed).json();
    const rows: { id: string; inventory_doc_type: string; parent_document_no: string | null; details: { qty_in: number; qty_out: number }[] }[] = body.data ?? [];
    // งวดแรกหลังรีเซ็ตยังไม่เคยปิดงวด จึงไม่มีแถวยกยอดให้ตรวจ — ตัดสินจากฐานข้อมูล ไม่ใช่จากหน้าจอ
    // (ถ้ามีแถวในบัญชีแต่หน้าจอไม่แสดง ต้องตกไปเป็น FAIL ด้านล่าง)
    const [{ n: bookedOpenClose }] = sql<{ n: string }>(`select count(*) n from ${SCHEMA}.tb_inventory_transaction
      where deleted_at is null and inventory_doc_type::text in ('open', 'close')`);
    if (Number(bookedOpenClose) === 0) {
      record({
        id: "3.2", case: CASE,
        title: "หน้า Inventory → Transaction แสดงยกเข้า (open) เป็นขาเข้า และปิดงวด (close) เป็นขาออกเลขบวก",
        steps: ["เปิดหน้า Inventory → Transaction กรองชนิด open, close"],
        expected: "มีแถว open/close ให้ตรวจ",
        actual: `ทดสอบไม่ได้ในงวดนี้: ยังไม่เคยปิดงวดเลย ในบัญชีไม่มีแถว open/close (หน้าจอแสดง ${rows.length} แถว) — ตรวจในรอบถัดไปหลังปิดงวด ${PERIOD}`,
        status: "N/A", images: [await shot(page, "3.2", "transaction-open-close-empty")],
      });
      // N/A — ข้อเท็จจริงที่ตรวจได้: บัญชีไม่มีแถว open/close รายการที่หน้าจอได้ก็ต้องว่าง
      expect(rows.map((r) => `${r.inventory_doc_type} ${r.parent_document_no}`), "บัญชีไม่มีแถว open/close แต่หน้าจอได้แถวมา").toEqual([]);
      return;
    }
    await expect(page.locator("tbody tr").first()).toBeVisible();
    const img = await shot(page, "3.2", "transaction-open-close");

    const headers = await page.locator("thead th").allInnerTexts();
    const inCol = headers.findIndex((h) => h.trim() === "Qty In");
    const outCol = headers.findIndex((h) => h.trim() === "Qty Out");
    const domRows = page.locator("tbody tr");
    const ids = rows.map((r) => `'${r.id}'`).join(",") || "null";
    const signed = Object.fromEntries(
      sql<{ id: string; qin: string; qout: string }>(`
        select t.id, coalesce(sum(d.qty) filter (where d.qty > 0), 0) qin, coalesce(-sum(d.qty) filter (where d.qty < 0), 0) qout
        from ${SCHEMA}.tb_inventory_transaction t join ${SCHEMA}.tb_inventory_transaction_detail d on d.inventory_transaction_id = t.id
        where t.id in (${ids}) group by t.id`).map((r) => [r.id, { qin: Number(r.qin), qout: Number(r.qout) }]),
    );
    const cell = (t: string) => (t.trim() === "-" ? 0 : Number(t.replace(/,/g, "")));
    const bad: string[] = [];
    const seen: string[] = [];
    for (const [i, r] of rows.entries()) {
      const cells = await domRows.nth(i).locator("td").allInnerTexts();
      const shownIn = cell(cells[inCol] ?? "");
      const shownOut = cell(cells[outCol] ?? "");
      const want = signed[r.id];
      const okSide = r.inventory_doc_type === "open" ? shownOut === 0 && shownIn > 0 : shownIn === 0 && shownOut > 0;
      const okQty = want && Math.abs(shownIn - want.qin) < 1e-6 && Math.abs(shownOut - want.qout) < 1e-6;
      seen.push(`${r.inventory_doc_type} ${r.parent_document_no}: In ${cells[inCol]?.trim()} / Out ${cells[outCol]?.trim()}`);
      if (!okSide || !okQty) bad.push(`${r.inventory_doc_type} ${r.parent_document_no}: In ${shownIn} Out ${shownOut} (บัญชี +${want?.qin} / −${want?.qout})`);
    }
    record({
      id: "3.2", case: CASE,
      title: "หน้า Inventory → Transaction แสดงยกเข้า (open) เป็นขาเข้า และปิดงวด (close) เป็นขาออกเลขบวก",
      steps: ["เปิดหน้า Inventory → Transaction กรองชนิด open, close", `อ่านช่อง Qty In / Qty Out ทุกแถวในหน้าแรก (${rows.length} แถว) เทียบผลรวม qty บวก/ลบในบัญชี`],
      expected: "open: Qty In = ยอดยกเข้า, Qty Out = - · close: Qty Out = ยอดที่ตัด (เลขบวก), Qty In = - · ตัวเลขตรงกับบัญชี",
      actual: bad.length ? `ผิด ${bad.length} แถว: ${bad.join(" · ")}` : `ถูกทุกแถว — ${seen.slice(0, 6).join(" · ")}${seen.length > 6 ? ` (+${seen.length - 6})` : ""}`,
      status: rows.length > 0 && inCol >= 0 && outCol >= 0 && bad.length === 0 ? "PASS" : "FAIL",
      images: [img],
    });
    expect(rows.length).toBeGreaterThan(0);
    // verdict ที่บันทึกไว้ (ต้นฉบับ assert แค่ว่ามีแถว)
    expect(inCol, `ไม่พบคอลัมน์ Qty In — หัวตาราง: ${headers.join(" | ")}`).toBeGreaterThanOrEqual(0);
    expect(outCol, `ไม่พบคอลัมน์ Qty Out — หัวตาราง: ${headers.join(" | ")}`).toBeGreaterThanOrEqual(0);
    expect(bad, "แถว open/close ที่ทิศหรือจำนวนไม่ตรงบัญชี").toEqual([]);
  },
);

test(
  "TC-PE-530003 รายการเคลื่อนไหวของสินค้าที่คลัง (inventory-info) ไม่มีแถวของใบที่ void",
  {
    annotation: [
      {
        type: "preconditions",
        description:
          "BU ของ scenario; E2E_DB_URL ตั้งไว้; P1 (11110001) ที่คลัง L มีรายการเคลื่อนไหวจาก pre-step (บางรอบมี GRN ที่ void ของ P1 เป็นตัวหลอก)",
      },
      {
        type: "steps",
        description:
          "1. GET /api/<BU>/inventory-info/<P1>/<คลัง L> ในนาม admin (ไม่มีหน้าจอ FE แสดงรายการนี้)\n2. อ่านล็อตของรายการที่ยังไม่ void และล็อตของใบที่ void ของ P1 ที่คลัง L จากฐานข้อมูล\n3. เทียบรายการที่ API คืนกับทั้งสองชุด",
      },
      {
        type: "expected",
        description: "HTTP 200 · ไม่มีแถวที่ lot_no ตรงกับล็อตของใบที่ void · จำนวนแถวที่ API คืน = จำนวนรายการของใบที่ยังไม่ void",
      },
      { type: "priority", description: "Medium" },
      { type: "testType", description: "Edge Case" },
      {
        type: "note",
        description:
          "เดิม 3.3 (_movement_play specs/47-ledger-views) · ต้นฉบับไม่มี expect เลย (บันทึก FAIL ลง results.json แต่ test เขียว) — port assert ตาม verdict · ตรวจที่ API เพราะ FE ไม่มีหน้าแสดงรายการนี้ · รอบล่าสุด p11-r4 / avg2607-r4 (2026-10-02) PASS · อ่านอย่างเดียว",
      },
    ],
  },
  async () => {
    const [ids] = sql<{ loc: string; prod: string }>(`
      select (select id from ${SCHEMA}.tb_location where code = '${L.code}') loc,
             (select id from ${SCHEMA}.tb_product where code = '${P.P1.code}') prod`);
    const { status, body } = await apiGet(`/api/${BU}/inventory-info/${ids.prod}/${ids.loc}`);
    const shown: { lot_no: string }[] = body?.data?.transactions ?? [];
    const live = sql<{ lot: string }>(`
      select d.current_lot_no lot from ${SCHEMA}.tb_inventory_transaction_detail d
      join ${SCHEMA}.tb_inventory_transaction t on t.id = d.inventory_transaction_id
      where t.deleted_at is null and d.product_id = '${ids.prod}' and d.location_id = '${ids.loc}'`);
    const voided = sql<{ lot: string; cost: string }>(`
      select d.current_lot_no lot, d.cost_per_unit cost from ${SCHEMA}.tb_inventory_transaction_detail d
      join ${SCHEMA}.tb_inventory_transaction t on t.id = d.inventory_transaction_id
      where t.deleted_at is not null and d.product_id = '${ids.prod}' and d.location_id = '${ids.loc}'`);
    const leaked = shown.filter((t) => voided.some((v) => v.lot === t.lot_no));
    record({
      id: "3.3", case: CASE,
      title: `รายการเคลื่อนไหวของ ${P.P1.name} (${P.P1.code}) ที่ ${L.code} ไม่มีแถวของใบที่ void`,
      steps: [`GET /api/${BU}/inventory-info/<P1>/<${L.code}> (หน้าจอ FE ไม่ได้แสดงรายการนี้ จึงตรวจที่ API)`, "เทียบกับแถวในบัญชีของใบที่ยังไม่ void / ใบที่ void"],
      expected: `${live.length} แถว (ใบที่ยังไม่ void) · ไม่มีล็อตของใบที่ void${voided.length ? `: ${voided.map((v) => `${v.lot}@${Number(v.cost)}`).join(", ")}` : " (งวดนี้ไม่มีใบ void)"}`,
      actual: `HTTP ${status} · ${shown.length} แถว · แถวของใบที่ void ที่หลุดมา ${leaked.length}${leaked.length ? `: ${leaked.map((l) => l.lot_no).join(", ")}` : ""}`,
      status: status === 200 && leaked.length === 0 && shown.length === live.length ? "PASS" : "FAIL",
    });
    // verdict ที่บันทึกไว้ (ต้นฉบับไม่มี expect)
    expect(status, "GET inventory-info").toBe(200);
    expect(leaked.map((l) => l.lot_no), "แถวของใบที่ void หลุดมาใน inventory-info").toEqual([]);
    expect(shown.length, "จำนวนแถวต้องเท่ารายการของใบที่ยังไม่ void").toBe(live.length);
  },
);
