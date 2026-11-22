import type { Page } from "@playwright/test";
import {
  test,
  expect,
  gotoInBu,
  BU,
  requireScenario,
  shot,
  record as recordRow,
  type CaseRow,
  currentPeriod,
  review,
  getDoc,
  putDoc,
  layers, gatePhase
} from "./helpers/period-close/context";
import { field, btn, pickDate } from "./helpers/movement/ui";
import { createGrn, grnById, createCreditNote, cnById, type CreatedDoc } from "./helpers/period-close/docs";
import { L, PX, SCN, PERIOD, NEXT } from "./helpers/period-close/scenarios";

/**
 * Period close · phase 914 — Case 2 เอกสารนอกงวด (section 44).
 *
 * เอกสารชนิดเดียวกับ Case 1 (ชนิดที่ถ้าอยู่ในงวดจะขวาง) แต่ลงวันที่งวดถัดไป ต้องไม่ขวางการเริ่มนับของงวดนี้
 * spec นี้ "ไม่กด Start" — หยุดที่การตรวจความพร้อม (2.6-ready); การกด Start จริงอยู่ใน phase ถัดไป
 * ตาข่าย: ทุก test ตัด POST start-counting ทิ้ง กันเผลอเปิดรอบนับ (ย้อนกลับไม่ได้)
 *
 * Irreversible? ไม่แตะสถานะงวด — แต่สร้างเอกสารจริงที่ phase ถัดไปใช้ต่อ (GRN งวดหน้า, CN ร่าง) จำไว้ใน state.json
 * Prerequisites: 910 ผ่านแล้ว (GRN ฐาน grnA สำหรับใบลดหนี้) · 912 ผ่านแล้ว (ไม่มีเอกสารค้างในงวด) · งวดถัดไปเปิดอยู่
 *   · รอบนับยังไม่เริ่ม (ยกเว้น E2E_PERIOD_AFTER_START=1)
 * Run:  E2E_PERIOD_SCENARIO=<s> bun run test:period-close -- tests/914-period-close-out-of-period-docs.spec.ts
 *   E2E_PERIOD_AFTER_START=1: รันซ้ำบางข้อหลังกด Start ไปแล้ว — ทุกแถวที่บันทึกมีหมายเหตุว่ารันระหว่างนับ
 *
 * Serial: TC-PE-440007 (2.6-ready) ตรวจเอกสารที่ 440001 / 440002 / 440006 สร้างไว้
 * Origin: _movement_play/eop_bf/e2e/specs/20-case2.spec.ts (sub-case 2.1, 2.1b, 2.2, 2.3, 2.4, 2.5, 2.5-PRPO, 2.6-ready)
 */
const CASE = "Case 2 · เอกสารนอกงวด";

// E2E_PERIOD_AFTER_START=1: รันซ้ำบางข้อหลังกด Start ไปแล้ว (FIFO 2608: 2.4/2.5 พังเพราะ lookup GRN ของฟอร์ม CN ค้นแล้ว 400
// — แก้ใน #710 — แต่ Start ถูกกดไปก่อน) ทุกแถวที่บันทึกจะมีหมายเหตุบอกว่ารันระหว่างนับ ไม่ใช่ก่อน Start
const AFTER_START = process.env.E2E_PERIOD_AFTER_START === "1";
const AFTER_NOTE = " · ⚠ รันซ้ำระหว่างนับ (หลังกด Start) — รอบแรกก่อน Start พังเพราะ lookup GRN ของฟอร์ม CN ค้นแล้ว 400 (แก้ใน #710)";
const record = (row: CaseRow) => recordRow(AFTER_START ? { ...row, actual: row.actual + AFTER_NOTE } : row);

test.describe.configure({ mode: "serial" });

test.beforeAll(() => requireScenario());
gatePhase({ dates: true });
test.beforeAll(async () => {
  expect(await currentPeriod(BU)).toBe(PERIOD);
  if (!AFTER_START) expect((await review(BU)).physical_count_period?.status).not.toBe("counting");
});

test.beforeEach(async ({ page }) => {
  await page.route(/\/period-ends\/start-counting/, (route) => route.abort());
});

/**
 * สร้างครั้งเดียว (จำใน state) — state ที่จดตอน onCreated เป็นสถานะตอน "เพิ่งสร้าง" (เช่น draft ก่อน Submit)
 * จึงต้องอ่านสถานะสดจาก API ทุกครั้งก่อนใช้ ไม่งั้นได้ค่าเก่า
 */
async function once(
  key: string,
  create: (onCreated: (d: CreatedDoc) => void) => Promise<unknown>,
  fetchFresh: (id: string) => Promise<CreatedDoc>,
) {
  if (!getDoc(key)) await create((d) => putDoc(key, { ...d }));
  const fresh = await fetchFresh(getDoc(key)!.id);
  putDoc(key, { ...fresh });
  return fresh;
}

const NG = SCN.nextGrn;
test(
  "TC-PE-440001 GRN บันทึกแล้ว (saved) ลงวันที่งวดถัดไปสร้างได้ เพื่อใช้ตรวจว่าไม่ขวาง Start ของงวดนี้",
  {
    annotation: [
      { type: "preconditions", description: "Login เป็น admin@carmen.com; งวดปัจจุบันของ BU = งวดของ scenario และงวดถัดไปเปิดอยู่; รอบนับยังไม่เริ่ม; admin ผูกกับคลัง L (910)" },
      { type: "steps", description: "1. Goods Receive Note → New (Manual) · Vendor C010 · GRN Date = วันที่ในงวดถัดไปตาม scenario (nextGrn.date)\n2. คลัง L · สินค้า nextGrn ของ scenario qty 10 ราคาตาม scenario\n3. กด Create (saved)\n4. อ่านสถานะใบสดจาก API แล้วเปิดใบ" },
      { type: "expected", description: "GRN มีสถานะ saved (งวดถัดไปเปิดอยู่จึงสร้างได้) — ใบนี้ต้องไม่ขวาง Start ของงวดนี้ (ตรวจใน TC-PE-440007)" },
      { type: "priority", description: "High" },
      { type: "testType", description: "Functional" },
      { type: "note", description: "เดิม 2.1 (_movement_play specs/20-case2) · ชนิดเดียวกับ 1.2 แต่อยู่งวดหน้า · ใช้เป็น \"GRN งวดหน้า\" ในการตรวจต้นทุนข้อ 2.9 · ต้นฉบับบันทึก PASS/FAIL โดยไม่ assert — พอร์ต assert สถานะ saved · idempotent: จำใน state.json" },
    ],
  },
  async ({ page }) => {
    const d = await once(SCN.keys.nextGrn, (onCreated) =>
      createGrn(page, {
        date: NG.date, invoiceNo: `E2E-${NEXT}-next`, status: "saved", onCreated,
        lines: [{ product: NG.product.code, qty: 10, price: NG.price }],
      }),
      grnById,
    );
    await gotoInBu(page, `/procurement/goods-receive-note/${d.id}`);
    const img = await shot(page, "2.1", `GRN-saved-${d.no}`);
    record({
      id: "2.1", case: CASE, title: `GRN บันทึกแล้ว (saved) ลงวันที่ ${NG.date} — ชนิดเดียวกับ 1.2 แต่อยู่งวด ${NEXT}`,
      steps: [`GRN manual · GRN Date ${NG.date} · ${NG.product.name} qty 10 @${NG.price} ที่ ${L.code}`, "Create (saved)"],
      expected: `สร้างได้ (งวด ${NEXT} เปิดอยู่) · ต้องไม่ขวาง Start ของ ${PERIOD} (ตรวจใน 2.6-ready) · ${NG.note}`,
      actual: `${d.no} = ${d.status}`,
      status: d.status === "saved" ? "PASS" : "FAIL", docs: [d.no], images: [img],
    });
    expect(d.status, `${d.no}`).toBe("saved");
  },
);

test(
  "TC-PE-440002 GRN ร่างลงวันที่งวดถัดไปสร้างได้ เพื่อใช้ตรวจว่าไม่ขวาง Start ของงวดนี้",
  {
    annotation: [
      { type: "preconditions", description: "Login เป็น admin@carmen.com; งวดปัจจุบันของ BU = งวดของ scenario และงวดถัดไปเปิดอยู่; รอบนับยังไม่เริ่ม" },
      { type: "steps", description: "1. Goods Receive Note → New (Manual) · Vendor C010 · GRN Date = วันที่ในงวดถัดไปตาม scenario (nextGrnDraftDate)\n2. คลัง L · Chicken frame qty 1 @10\n3. กด Save Draft\n4. อ่านสถานะใบสดจาก API แล้วเปิดใบ" },
      { type: "expected", description: "GRN มีสถานะ draft (เลข draft-…) — ใบนี้ต้องไม่ขวาง Start ของงวดนี้ (ตรวจใน TC-PE-440007)" },
      { type: "priority", description: "High" },
      { type: "testType", description: "Functional" },
      { type: "note", description: "เดิม 2.1b (_movement_play specs/20-case2) · ชนิดเดียวกับ 1.1 แต่อยู่งวดหน้า · ต้นฉบับบันทึก PASS/FAIL โดยไม่ assert — พอร์ต assert สถานะ draft · รอบถัดไป 910 (preCleanAuto) จะลบใบนี้ทิ้ง" },
    ],
  },
  async ({ page }) => {
    const d = await once(SCN.keys.nextGrnDraft, (onCreated) =>
      createGrn(page, {
        date: SCN.nextGrnDraftDate, invoiceNo: `E2E-${NEXT}-draft`, status: "draft", onCreated,
        lines: [{ product: PX.code, qty: 1, price: 10 }],
      }),
      grnById,
    );
    await gotoInBu(page, `/procurement/goods-receive-note/${d.id}`);
    const img = await shot(page, "2.1b", `GRN-draft-${d.no}`);
    record({
      id: "2.1b", case: CASE, title: `GRN ร่างลงวันที่ ${SCN.nextGrnDraftDate} — ชนิดเดียวกับ 1.1 แต่อยู่งวด ${NEXT}`,
      steps: [`GRN manual · GRN Date ${SCN.nextGrnDraftDate} · ${PX.name} qty 1`, "Save Draft"],
      expected: `ต้องไม่ขวาง Start ของ ${PERIOD} (ตรวจใน 2.6-ready)`,
      actual: `${d.no} = ${d.status}`,
      status: d.status === "draft" ? "PASS" : "FAIL", docs: [d.no], images: [img],
    });
    expect(d.status, `${d.no}`).toBe("draft");
  },
);

/** เปิดปฏิทินของฟอร์ม SI/SO แล้วลองไปเดือนของงวดหน้า — เก็บภาพเป็นหลักฐานว่าเลือกงวดหน้าไม่ได้ */
async function calendarLock(page: Page, type: "stock-in" | "stock-out", id: string) {
  await gotoInBu(page, `/inventory-management/inventory-adjustment/new?type=${type}`);
  await field(page, "Date").locator("button").first().click();
  const pop = page.locator("[data-slot=popover-content]:visible").last();
  await expect(pop).toBeVisible();
  const next = pop.locator(".rdp-button_next");
  const nextDisabled = await next.isDisabled();
  if (!nextDisabled) await next.click();
  const caption = (await pop.locator(".rdp-caption_label").first().innerText()).trim();
  const april10 = pop.locator(`button[data-day="${SCN.nextMonth.day}"]`);
  const aprilSelectable = (await april10.count()) > 0 && !(await april10.isDisabled());
  const img = await shot(page, id, "ปฏิทิน-เลือกงวดหน้าไม่ได้", { fullPage: false });
  await page.keyboard.press("Escape");
  // ปุ่มเดือนถัดไปกดได้ทีละเดือน (และ nextMonth.day ของ p10/p11 เคยสลับวัน/เดือน) — ลองเลือกวันในงวดหน้าจริงด้วย date picker อีกทาง
  // (เดินเดือนจนถึงเดือนเป้าหมาย) ให้ข้อนี้ไม่ผ่านแบบไม่ได้ตรวจอะไร
  const nextPeriodPickable = await pickDate(page, field(page, "Date").locator("button").first(), SCN.nextGrn.date);
  return { nextDisabled, caption, aprilSelectable, img, nextPeriodPickable };
}

test(
  "TC-PE-440003 ฟอร์ม Stock In เลือกวันที่ในงวดถัดไปไม่ได้ (ปฏิทินล็อกไว้ที่งวดปัจจุบัน)",
  {
    annotation: [
      { type: "preconditions", description: "Login เป็น admin@carmen.com; งวดปัจจุบันของ BU = งวดของ scenario" },
      { type: "steps", description: "1. Inventory Adjustment → Add Stock In\n2. เปิดปฏิทินช่อง Date → กดเดือนถัดไปหนึ่งครั้ง → ดูวันที่ของงวดหน้าตาม scenario (nextMonth.day)\n3. ปิดปฏิทิน แล้วใช้ date picker เดินเดือนไปเลือกวันที่ในงวดถัดไป (nextGrn.date)" },
      { type: "expected", description: "วันที่ของงวดถัดไปเลือกไม่ได้ทั้งสองทาง (ปุ่มวันถูกปิดหรือเดินเดือนไปไม่ถึง) — สร้าง Stock In ลงงวดหน้าผ่าน UI ไม่ได้ จึงบันทึกเป็น N/A" },
      { type: "priority", description: "Medium" },
      { type: "testType", description: "Validation" },
      { type: "note", description: "เดิม 2.2 (_movement_play specs/20-case2) · ปฏิทินล็อกตาม ia-form-schema.ts (Date must be within the current period) แม้หลังบ้านจะรับ SI ลงงวดที่เปิดอยู่ · ต้นฉบับบันทึก N/A/FAIL โดยไม่ assert — พอร์ต assert ว่าเลือกไม่ได้ และเพิ่มการลองด้วย pickDate อีกทาง เพราะ nextMonth.day ของ scenario p10/p11 เคยสลับวัน/เดือน (10/11/2026, 10/12/2026 — แก้ใน scenarios.ts แล้ว) ทำให้การตรวจเดิมผ่านเสมอ" },
    ],
  },
  async ({ page }) => {
    const r = await calendarLock(page, "stock-in", "2.2");
    record({
      id: "2.2", case: CASE, title: `Stock In ลงวันที่งวด ${NEXT}`,
      steps: ["Inventory Adjustment → Add Stock In", `เปิดปฏิทินช่อง Date แล้วลองไปเดือน ${SCN.nextMonth.caption}`],
      expected: `ถ้าสร้างได้ ต้องไม่ขวาง Start ของ ${PERIOD}`,
      actual:
        `ทำผ่าน UI ไม่ได้: ปุ่มเดือนถัดไป${r.nextDisabled ? "ถูกปิด" : "กดได้"} · หัวปฏิทิน="${r.caption}" · วันที่ ${SCN.nextMonth.day} ${r.aprilSelectable ? "เลือกได้" : "เลือกไม่ได้"} ` +
        `· date picker ไปวันที่ ${SCN.nextGrn.date} ${r.nextPeriodPickable ? "เลือกได้" : "เลือกไม่ได้"} ` +
        "— ปฏิทินล็อกไว้ในงวดปัจจุบัน (ia-form-schema.ts: Date must be within the current period) แม้หลังบ้านจะรับ SI ลงงวดที่เปิดอยู่ก็ตาม",
      status: r.aprilSelectable || r.nextPeriodPickable ? "FAIL" : "N/A", images: [r.img],
    });
    expect(r.aprilSelectable, `ปุ่มวันที่ ${SCN.nextMonth.day} ต้องเลือกไม่ได้`).toBe(false);
    expect(r.nextPeriodPickable, `วันที่ ${SCN.nextGrn.date} (งวด ${NEXT}) ต้องเลือกไม่ได้`).toBe(false);
  },
);

test(
  "TC-PE-440004 ฟอร์ม Stock Out เลือกวันที่ในงวดถัดไปไม่ได้ (ปฏิทินล็อกไว้ที่งวดปัจจุบัน)",
  {
    annotation: [
      { type: "preconditions", description: "Login เป็น admin@carmen.com; งวดปัจจุบันของ BU = งวดของ scenario" },
      { type: "steps", description: "1. Inventory Adjustment → Add Stock Out\n2. เปิดปฏิทินช่อง Date → กดเดือนถัดไปหนึ่งครั้ง → ดูวันที่ของงวดหน้าตาม scenario (nextMonth.day)\n3. ปิดปฏิทิน แล้วใช้ date picker เดินเดือนไปเลือกวันที่ในงวดถัดไป (nextGrn.date)" },
      { type: "expected", description: "วันที่ของงวดถัดไปเลือกไม่ได้ทั้งสองทาง — สร้าง Stock Out ลงงวดหน้าผ่าน UI ไม่ได้ จึงบันทึกเป็น N/A" },
      { type: "priority", description: "Medium" },
      { type: "testType", description: "Validation" },
      { type: "note", description: "เดิม 2.3 (_movement_play specs/20-case2) · หลังบ้านก็ปฏิเสธเองด้วย 422 STOCK_OUT_DATE_NOT_CURRENT_PERIOD (จ่ายออกต้องอยู่งวดปัจจุบันเท่านั้น) · ต้นฉบับบันทึก N/A/FAIL โดยไม่ assert — พอร์ต assert ว่าเลือกไม่ได้ (+ pickDate เหมือน TC-PE-440003)" },
    ],
  },
  async ({ page }) => {
    const r = await calendarLock(page, "stock-out", "2.3");
    record({
      id: "2.3", case: CASE, title: `Stock Out ลงวันที่งวด ${NEXT}`,
      steps: ["Inventory Adjustment → Add Stock Out", `เปิดปฏิทินช่อง Date แล้วลองไปเดือน ${SCN.nextMonth.caption}`],
      expected: `ถ้าสร้างได้ ต้องไม่ขวาง Start ของ ${PERIOD}`,
      actual:
        `ทำผ่าน UI ไม่ได้: ปุ่มเดือนถัดไป${r.nextDisabled ? "ถูกปิด" : "กดได้"} · หัวปฏิทิน="${r.caption}" · วันที่ ${SCN.nextMonth.day} ${r.aprilSelectable ? "เลือกได้" : "เลือกไม่ได้"} ` +
        `· date picker ไปวันที่ ${SCN.nextGrn.date} ${r.nextPeriodPickable ? "เลือกได้" : "เลือกไม่ได้"} ` +
        "— และหลังบ้านก็ปฏิเสธเองด้วย 422 STOCK_OUT_DATE_NOT_CURRENT_PERIOD (จ่ายออกต้องอยู่งวดปัจจุบันเท่านั้น, ยืนยันไว้ใน p2603_result.json)",
      status: r.aprilSelectable || r.nextPeriodPickable ? "FAIL" : "N/A", images: [r.img],
    });
    expect(r.aprilSelectable, `ปุ่มวันที่ ${SCN.nextMonth.day} ต้องเลือกไม่ได้`).toBe(false);
    expect(r.nextPeriodPickable, `วันที่ ${SCN.nextGrn.date} (งวด ${NEXT}) ต้องเลือกไม่ได้`).toBe(false);
  },
);

const CNN = SCN.cnNext;
// กติกา (ผู้ใช้ยืนยัน 2026-10-02 · PR #724): ใบลดหนี้ลงวันที่ได้เฉพาะงวด active — ก่อนหน้านี้ข้อนี้บันทึกเป็น INFO
// (ใบลงวันที่งวดหน้าแต่สต๊อกไปลดในงวดปัจจุบัน) ซึ่งตามกติกาคือบั๊ก
test(
  "TC-PE-440005 ใบลดหนี้ลงวันที่งวดถัดไปต้องถูกปฏิเสธ (CREDIT_NOTE_DATE_NOT_CURRENT_PERIOD)",
  {
    annotation: [
      { type: "preconditions", description: "Login เป็น admin@carmen.com; งวดปัจจุบันของ BU = งวดของ scenario; มี GRN ฐานที่ commit แล้ว (grnA จาก 910 หรือเลข GRN ที่ scenario ระบุ)" },
      { type: "steps", description: "1. Credit Note → New · Vendor C010 · GRN = GRN ฐานของ scenario · Reason ของ BU · Doc Date / Tax Invoice Date = วันที่ในงวดถัดไป (cnNext.date)\n2. Add Item → Select from GRN: สินค้า cnNext ของ scenario คืน 1\n3. กด Create (→ Submit ถ้าสร้างได้)\n4. ถ้ามีใบ: อ่านสถานะ และ cost layer ของใบลดหนี้ที่คลัง L" },
      { type: "expected", description: "หลังบ้านปฏิเสธด้วย 422 CREDIT_NOTE_DATE_NOT_CURRENT_PERIOD และไม่มีใบลดหนี้ที่ completed — ใบลดหนี้ลงวันที่ได้เฉพาะงวด active" },
      { type: "priority", description: "High" },
      { type: "testType", description: "Negative" },
      { type: "note", description: "เดิม 2.4 (_movement_play specs/20-case2) · กติกาตาม PR #724 (ผู้ใช้ยืนยัน 2026-10-02) — รอบก่อน #724 บันทึก INFO (ใบลงวันที่งวดหน้าแต่สต๊อกไปลดในงวดปัจจุบัน) · รอบล่าสุด p11-r4 / avg2607-r4 = PASS 2026-10-02 จึงไม่ใช่ test.fail" },
    ],
  },
  async ({ page }) => {
    const grnA = { no: CNN.grnNo ?? getDoc(CNN.grnKey!)!.no };
    let created: { id: string; no: string } | null = null;
    let error = "";
    try {
      await createCreditNote(page, {
        grnNo: grnA.no, docDate: CNN.date, taxInvoiceNo: `E2E-CN-${NEXT}`, status: "completed",
        onCreated: (doc) => { created = { id: doc.id, no: doc.no }; putDoc(SCN.keys.cnNext, { ...doc }); },
        lines: [{ productName: CNN.product.name, qty: 1 }],
      });
    } catch (e) {
      // การถูกปฏิเสธคือผลที่คาด — เก็บข้อความไว้ตรวจด้านล่าง (expect(refused))
      error = (e as Error).message.replace(/\s+/g, " ").slice(0, 300);
    }
    const img = await shot(page, "2.4", "CN-next");
    const c = created as { id: string; no: string } | null;
    const d = c ? await cnById(c.id) : null;
    const added = d
      ? layers(L.code, CNN.product.code).filter((x) => String(x.transaction_type).startsWith("credit_note") && x.at_period >= PERIOD)
      : [];
    const refused = /CREDIT_NOTE_DATE_NOT_CURRENT_PERIOD/.test(error) && d?.status !== "completed";
    record({
      id: "2.4", case: CASE, title: `ใบลดหนี้ (Quantity Return) ลงวันที่ ${CNN.date} (งวด ${NEXT}) อ้าง ${grnA.no}`,
      steps: [`Credit Note → New · Vendor C010 · GRN ${grnA.no} · Doc Date ${CNN.date}`, `Add Item: ${CNN.product.name} คืน 1`, "Create → Submit"],
      expected: `ถูกปฏิเสธ 422 CREDIT_NOTE_DATE_NOT_CURRENT_PERIOD — ใบลดหนี้ลงวันที่ได้เฉพาะงวด active ${PERIOD} ไม่มีทางที่ใบลงวันที่ ${NEXT} แต่สต๊อกไปลดใน ${PERIOD}`,
      actual: `${d ? `${d.no} = ${d.status} · layer: ${added.map((x) => `${x.transaction_type} at_period=${x.at_period}`).join(", ") || "-"}` : "ไม่มีใบ"}${error ? ` · ${error}` : ""}`,
      status: refused ? "PASS" : "FAIL", docs: d ? [d.no] : [], images: [img],
    });
    expect(refused, error || d?.status).toBe(true);
  },
);

const CND = SCN.cnDraftIn;
test(
  "TC-PE-440006 เปิดค้างไว้: ใบลดหนี้ร่างในงวดนี้ และตรวจว่า PR / PO ค้างไม่อยู่ในตัวขวาง Start",
  {
    annotation: [
      { type: "preconditions", description: "Login เป็น admin@carmen.com; งวดปัจจุบันของ BU = งวดของ scenario; มี GRN ฐาน grnA ที่ commit แล้ว (910); รอบนับยังไม่เริ่ม" },
      { type: "steps", description: "1. Credit Note → New · GRN = grnA · Doc Date = วันที่ในงวดนี้ (cnDraftIn.date) · สินค้า cnDraftIn คืน 1 → Create (ไม่ Submit)\n2. อ่านสถานะใบสดจาก API แล้วเปิดใบ\n3. GET period-ends/review: หา PR/PO ที่ค้างในงวดจาก details.transaction\n4. มี PR/PO ค้างจริง: เปิด Period End → Review ถ่ายภาพ · ไม่มี: เปิด Purchase Order → New และ Purchase Request → New ดูว่าสร้างได้ไหม" },
      { type: "expected", description: "CN มีสถานะ draft (เปิดค้างไว้ให้ TC-PE-440007 ตรวจว่าไม่ขวาง); start_blocking ไม่มีชนิด pr / po ไม่ว่าจะมี PR/PO ค้างอยู่จริงหรือไม่" },
      { type: "priority", description: "Medium" },
      { type: "testType", description: "Functional" },
      { type: "note", description: "เดิม 2.5 และ 2.5-PRPO (_movement_play specs/20-case2) · ตามโค้ด CN ร่างไม่ขวางทั้งสองด่าน และ validatePeriodEnd ตัด PR/PO ออกโดยตั้งใจ · 2.5-PRPO เป็น N/A เมื่อไม่มี PR/PO ค้าง (admin ไม่อยู่ใน approval flow ของ PR/PO → Permission Denied) — พอร์ต assert ข้อเท็จจริงว่า start_blocking ไม่นับ pr/po ในทั้งสองกรณี · CN ร่างนี้ phase ถัดไปใช้ต่อ (state key cnDraftIn)" },
    ],
  },
  async ({ page }) => {
    const grnA = getDoc(CND.grnKey);
    expect(grnA, `state ไม่มี ${CND.grnKey} (GRN ฐาน) — รัน 910-period-close-prestep ก่อน`).toBeDefined();
    const d = await once(SCN.keys.cnDraftIn, (onCreated) =>
      createCreditNote(page, {
        grnNo: grnA!.no, docDate: CND.date, taxInvoiceNo: `E2E-CN-${PERIOD}-draft`, status: "draft", onCreated,
        lines: [{ productName: CND.product.name, qty: 1 }],
      }),
      cnById,
    );
    await gotoInBu(page, `/procurement/credit-note/${d.id}`);
    const cnImg = await shot(page, "2.5", `CN-draft-${d.no}`);
    record({
      id: "2.5", case: CASE, title: `CN ร่างลงวันที่ ${CND.date} (ในงวด ${PERIOD}) เปิดค้างไว้`,
      steps: [`Credit Note → New · GRN ${grnA!.no} · Doc Date ${CND.date} · ${CND.product.name} คืน 1`, "Create (ไม่ Submit)"],
      expected: `ตามโค้ด CN ร่างไม่ขวางทั้งสองด่าน — ยืนยันใน 2.6-ready (และตอนกด Start จริง)`,
      actual: `${d.no} = ${d.status}`,
      status: d.status === "draft" ? "PASS" : "FAIL", docs: [d.no], images: [cnImg],
    });
    expect(d.status, `${d.no}`).toBe("draft");

    const images: string[] = [];
    // BU ที่มี PR/PO ค้างในงวดอยู่จริง (CARMEN-AVG: PO260900001 in_progress) — ใช้ของจริงยืนยันว่าไม่ขวาง Start
    const rv = await review(BU);
    const openPrPo = (["pr", "po"] as const).flatMap((k) =>
      ((rv.details.transaction[k]?.documents ?? []) as { no: string; status: string }[])
        .filter((x) => x.status !== "completed")
        .map((x) => `${k.toUpperCase()} ${x.no} (${x.status})`),
    );
    const counted = Object.keys(rv.start_blocking.counts).filter((k) => k === "pr" || k === "po");
    if (openPrPo.length) {
      await gotoInBu(page, "/inventory-management/period-end/review");
      await page.waitForTimeout(1500);
      images.push(await shot(page, "2.5-PRPO", "review-PR-PO-ค้างแต่ไม่ขวาง"));
      record({
        id: "2.5-PRPO", case: CASE, title: "PR / PO ค้างในงวด (ใบที่ค้างอยู่จริง)",
        steps: [`ใบที่ค้างอยู่แล้วบน ${BU}: ${openPrPo.join(", ")}`, "Period End → Review"],
        expected: "PR/PO ค้างไม่อยู่ในตัวขวาง Start (validatePeriodEnd ตัดออกโดยตั้งใจ) · start_blocking ไม่มี pr/po",
        actual: `review.details: ${openPrPo.join(", ")} · start_blocking=${JSON.stringify(rv.start_blocking.counts)} total=${rv.start_blocking.total}`,
        status: counted.length === 0 ? "PASS" : "FAIL", docs: openPrPo.map((t) => t.split(" ")[1]), images,
      });
      expect(counted, "start_blocking ต้องไม่นับ PR/PO ที่ค้างอยู่จริง").toEqual([]);
      return;
    }
    const denied: boolean[] = [];
    for (const [kind, path] of [["PO", "/procurement/purchase-order/new"], ["PR", "/procurement/purchase-request/new"]] as const) {
      await gotoInBu(page, path);
      await page.waitForTimeout(1500);
      denied.push(await page.getByText("Permission Denied").isVisible());
      images.push(await shot(page, "2.5-PRPO", `${kind}-new`));
    }
    record({
      id: "2.5-PRPO", case: CASE, title: "PR / PO ค้างในงวด",
      steps: ["Purchase Request → New", "Purchase Order → New"],
      expected: "เปิดค้างไว้เพื่อยืนยันว่าไม่ขวาง (ตามโค้ด PR/PO ไม่อยู่ในทั้งสองด่าน)",
      actual:
        (denied.every(Boolean)
          ? `ทำไม่ได้: admin@carmen.com ไม่อยู่ใน approval flow ใดของ PR/PO บน ${BU} → หน้า New ขึ้น Permission Denied `
          : `ไม่ได้สร้าง PR/PO ค้างในรอบนี้ (ต้องเดินผ่าน approval flow; ทดสอบด้วยใบจริงแล้วใน avg09 ข้อ 2.5-PRPO: PASS) `) +
        "(ต้องตั้ง workflow ก่อน) · PR ไม่มีช่องวันที่ในฟอร์มอยู่แล้ว (ลงวันที่ของวันนี้) · ตามโค้ด validatePeriodEnd ตัด PR/PO ออกโดยตั้งใจ",
      status: "N/A", images,
    });
    // N/A: สร้าง PR/PO ค้างไม่ได้ — ข้อเท็จจริงที่ยังตรวจได้คือ start_blocking ไม่มีชนิด pr/po เลย
    expect(counted, "start_blocking ไม่ควรมีชนิด pr/po").toEqual([]);
  },
);

test(
  "TC-PE-440007 ตรวจความพร้อมก่อนกด Start Period Close: เอกสารนอกงวดและ CN ร่างต้องไม่ขวาง (ไม่กด Start)",
  {
    annotation: [
      { type: "preconditions", description: "TC-PE-440001 / 440002 / 440006 ผ่านแล้ว (serial) — มี GRN saved และ GRN ร่างลงวันที่งวดถัดไป และ CN ร่างในงวดนี้; ไม่มีเอกสารค้างอื่นในงวด; รอบนับยังไม่เริ่ม" },
      { type: "steps", description: "1. GET period-ends/review\n2. เปิด Period End → Review ถ่ายภาพ\n3. เปิด Period End ดูปุ่ม Start Period Close (ไม่กด — POST start-counting ถูกตัดทิ้งทุก test)" },
      { type: "expected", description: "can_start_counting = true และ start_blocking.total = 0; ปุ่ม Start Period Close กดได้ (enabled)" },
      { type: "priority", description: "High" },
      { type: "testType", description: "Happy Path" },
      { type: "note", description: "เดิม 2.6-ready (_movement_play specs/20-case2) · หยุดก่อนกด Start — การกด Start จริง (ย้อนกลับไม่ได้) อยู่ใน phase ถัดไปและต้องตั้ง E2E_ALLOW_IRREVERSIBLE · ทับซ้อน TC-PE-310001 (ทุก transaction post แล้ว → ผ่านด่าน)" },
    ],
  },
  async ({ page }) => {
    const r = await review(BU);
    const docs = [SCN.keys.nextGrn, SCN.keys.nextGrnDraft, SCN.keys.cnDraftIn].map((k) => {
      const doc = getDoc(k);
      expect(doc, `state ไม่มี ${k} — รัน TC-PE-440001 / 440002 / 440006 ก่อน`).toBeDefined();
      return doc!;
    });
    await gotoInBu(page, "/inventory-management/period-end/review");
    await page.waitForTimeout(1500);
    const reviewImg = await shot(page, "2.6-ready", "review-ก่อนกด-Start");
    await gotoInBu(page, "/inventory-management/period-end");
    await expect(btn(page, "Start Period Close")).toBeEnabled();
    const peImg = await shot(page, "2.6-ready", "period-end-ปุ่ม-Start");
    const ok = r.can_start_counting && r.start_blocking.total === 0;
    record({
      id: "2.6-ready", case: CASE, title: "ความพร้อมก่อนกด Start Period Close (ยังไม่กด — รอผู้ใช้อนุมัติ)",
      steps: [
        `มีเอกสารค้างนอกงวด: ${docs[0].no} (GRN saved ${NG.date}), ${docs[1].no} (GRN draft ${SCN.nextGrnDraftDate})`,
        `มีเอกสารค้างในงวด: ${docs[2].no} (CN draft ${CND.date})`,
        "GET period-ends/review → start_blocking",
      ],
      expected: "start_blocking.total = 0 และ can_start_counting = true — เอกสารนอกงวดและ CN ร่างต้องไม่ขวาง",
      actual: `can_start_counting=${r.can_start_counting} · start_blocking=${JSON.stringify(r.start_blocking.counts)} total=${r.start_blocking.total} · รอบนับ=${r.physical_count_period?.status}`,
      status: ok ? "PASS" : "FAIL", docs: docs.map((x) => x.no), images: [reviewImg, peImg],
    });
    expect(ok, `can_start_counting=${r.can_start_counting} · start_blocking=${JSON.stringify(r.start_blocking.counts)}`).toBe(true);
  },
);
