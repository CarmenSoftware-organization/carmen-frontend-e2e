import type { Page } from "@playwright/test";
import {
  test,
  expect,
  gotoInBu,
  BU,
  SCHEMA,
  requireScenario,
  shot,
  record,
  prevRecord,
  currentPeriod,
  review,
  getDoc,
  putDoc,
  sql, gatePhase
} from "./helpers/period-close/context";
import { btn, field } from "./helpers/movement/ui";
import {
  createGrn,
  createAdjustment,
  voidGrn,
  deleteGrnDraft,
  voidAdjustment,
  deleteAdjustment,
  adjustmentUrl,
  type CreatedDoc,
} from "./helpers/period-close/docs";
import { startExpectingBlocked } from "./helpers/period-close/period-end";
import { P, PX, SCN, PERIOD } from "./helpers/period-close/scenarios";

/**
 * Period close · phase 912 — Case 1 ด่าน Start (section 42).
 *
 * เอกสารค้างในงวดของ scenario ต้องทำให้กด Start Period Close ไม่ผ่าน (422 + dialog รายการ)
 * ทุก sub-case: สร้างเอกสารผ่าน UI → กด Start → เก็บภาพ dialog → void/delete → ยืนยันว่าหลังบ้านไม่เหลือตัวขวาง
 * ปลอดภัยรันซ้ำ: การกด Start ถูกดักไว้ ถ้าไม่มีเอกสารค้างจริงจะตัด request ทิ้ง (ดู startExpectingBlocked)
 *
 * Irreversible? ไม่ — Start ถูกปฏิเสธ 422 ไม่เปลี่ยนสถานะงวด (แต่สร้างแล้ว void/ลบเอกสารจริงในงวด)
 * Prerequisites: 910 ผ่านแล้ว (admin ผูกกับคลัง L) · งวดปัจจุบันของ BU = งวดของ scenario · รอบนับยังไม่เริ่ม
 *   · ไม่มีเอกสารค้างอื่นในงวด (start_blocking.total = 0 — แต่ละ sub-case ตรวจเอง)
 * Run:  E2E_PERIOD_BU=<BU> bun run test:period-close -- tests/912-period-close-start-gate.spec.ts
 *
 * ไม่ตั้ง serial โดยตั้งใจ: แต่ละ sub-case สร้างและเคลียร์เอกสารของตัวเอง แล้วตรวจเองว่าเริ่มจากสถานะสะอาด
 * — ข้อหนึ่งล้มด้วยผลตรวจ ข้อถัดไปยังทดสอบชนิดเอกสารอื่นได้ตามเดิม (เหมือนต้นฉบับ)
 * Origin: _movement_play/eop_bf/e2e/specs/10-case1-start.spec.ts (sub-case 1.1–1.5, 1.N1–1.N3, 1.F1–1.F2)
 */
const CASE = "Case 1 · ด่าน Start";

type Module = "grn" | "stock_in" | "stock_out";

interface Blocker {
  key: string; // key ใน state.json
  module: Module;
  label: string; // ใช้ในขั้นตอน/ชื่อรูป
  create: (page: Page, onCreated: (d: CreatedDoc) => void) => Promise<unknown>;
  clear: (page: Page, doc: CreatedDoc) => Promise<unknown>;
  clearLabel: string;
  docUrl: (doc: CreatedDoc) => string;
}

const grnUrl = (d: CreatedDoc) => `/procurement/goods-receive-note/${d.id}`;
const reason = (id: string) => `E2E ${id} เคลียร์เอกสารค้างก่อนเริ่มนับ`;

const grnDraft = (key: string, invoice: string): Omit<Blocker, "clear" | "clearLabel"> => ({
  key, module: "grn", label: "GRN draft", docUrl: grnUrl,
  create: (page, onCreated) =>
    createGrn(page, {
      date: SCN.case1Date, invoiceNo: invoice, status: "draft", onCreated,
      lines: [{ product: PX.code, qty: 1, price: 10 }],
    }),
});
const grnSaved = (key: string, invoice: string, product: string, price: number, date: string): Omit<Blocker, "clear" | "clearLabel"> => ({
  key, module: "grn", label: "GRN saved", docUrl: grnUrl,
  create: (page, onCreated) =>
    createGrn(page, { date, invoiceNo: invoice, status: "saved", onCreated, lines: [{ product, qty: 10, price }] }),
});
const siDraft = (key: string): Omit<Blocker, "clear" | "clearLabel"> => ({
  key, module: "stock_in", label: "SI draft", docUrl: (d) => adjustmentUrl("stock-in", d.id),
  create: (page, onCreated) =>
    createAdjustment(page, {
      type: "stock-in", date: SCN.case1Date, reason: "E2E IA stock in", status: "draft", onCreated,
      lines: [{ product: PX.code, qty: 1, price: 10 }],
    }),
});
const soDraft = (key: string): Omit<Blocker, "clear" | "clearLabel"> => ({
  key, module: "stock_out", label: "SO draft", docUrl: (d) => adjustmentUrl("stock-out", d.id),
  create: (page, onCreated) =>
    createAdjustment(page, {
      type: "stock-out", date: SCN.case1Date, reason: "E2E IA stock out", status: "draft", onCreated,
      lines: [{ product: P.P4.code, qty: 1 }],
    }),
});

/** Returns the sub-case verdict (recorded as PASS/FAIL) — each test asserts it, so the case's assertion sits in its own body. */
async function runBlockerCase(page: Page, id: string, title: string, blockers: Blocker[]): Promise<boolean> {
  const prev = prevRecord(id);
  // ผ่านแล้วในรอบก่อน — ไม่สร้างเอกสารซ้ำ (ต้นฉบับ return เงียบ ๆ ซึ่งรายงานเป็นผ่านโดยไม่ได้ตรวจอะไร)
  test.skip(prev?.status === "PASS", `${id} ผ่านแล้วเมื่อ ${prev?.at} — ไม่สร้างเอกสารซ้ำ`);
  const images: string[] = [];
  const before = await review(BU);
  const reused = blockers.every((b) => getDoc(b.key));
  expect(before.start_blocking.total, "ก่อนเริ่ม sub-case ต้องไม่มีเอกสารค้างอื่นปน (ไม่งั้นแยกไม่ออกว่าอะไรขวาง)").toBe(
    reused ? before.start_blocking.total : 0,
  );

  // 1) สร้างเอกสารค้าง
  const docs: CreatedDoc[] = [];
  for (const b of blockers) {
    let doc = getDoc(b.key) as CreatedDoc | undefined;
    if (!doc) {
      await b.create(page, (d) => putDoc(b.key, { ...d }));
      doc = getDoc(b.key) as CreatedDoc;
    }
    docs.push(doc);
    await gotoInBu(page, b.docUrl(doc));
    images.push(await shot(page, id, `a-สร้าง-${b.label}-${doc.no}`));
  }

  // 2) หลังบ้านต้องเห็นเป็นตัวขวาง
  const mid = await review(BU);
  const expectedCounts: Record<string, number> = {};
  for (const b of blockers) expectedCounts[b.module] = (expectedCounts[b.module] ?? 0) + 1;

  // 3) กด Start → ต้องได้ 422 + dialog ที่ลิสต์ทุกใบ
  const dialog = await startExpectingBlocked(page);
  const dialogText = (await dialog.innerText()).replace(/\s+/g, " ");
  images.push(await shot(page, id, "b-กด-Start-ถูกบล็อก"));
  await btn(dialog, "Close").last().click(); // มี Close สองปุ่ม (X มุมขวาบน + ปุ่มล่าง)
  const listed = docs.map((d) => ({ no: d.no, shown: dialogText.includes(d.no) }));

  // 4) เคลียร์เอกสารแล้วยืนยันว่าไม่เหลือตัวขวาง (ห้ามกด Start ซ้ำ — ถ้าผ่านคือเปิดรอบนับจริง)
  const clearNotes: string[] = [];
  for (const [i, b] of blockers.entries()) {
    const res = (await b.clear(page, docs[i])) as { payload?: string } | undefined;
    if (res?.payload) clearNotes.push(`${docs[i].no} void payload=${res.payload}`);
    putDoc(b.key, { ...docs[i], status: b.clearLabel === "Delete" ? "deleted" : "voided" });
    if (b.clearLabel === "Delete") images.push(await shot(page, id, `c-${b.clearLabel}-${b.label}-${docs[i].no}`));
    else {
      await gotoInBu(page, b.docUrl(docs[i]));
      images.push(await shot(page, id, `c-${b.clearLabel}-${b.label}-${docs[i].no}`));
    }
  }
  const after = await review(BU);

  const countsOk = Object.entries(expectedCounts).every(([m, n]) => (mid.start_blocking.counts[m] ?? 0) === n);
  const pass = countsOk && listed.every((l) => l.shown) && after.start_blocking.total === 0;
  record({
    id, case: CASE, title,
    steps: [
      ...blockers.map((b) => `สร้าง ${b.label} ลงวันที่ในงวด ${PERIOD} ผ่าน UI`),
      "Period End → Start Period Close → ยืนยัน",
      ...blockers.map((b) => `${b.clearLabel} ${b.label}`),
    ],
    expected: `Start ถูกปฏิเสธ (422) · dialog "Finish these documents first" ลิสต์ ${docs.map((d) => d.no).join(", ")} · start_blocking=${JSON.stringify(expectedCounts)} · หลังเคลียร์ total=0`,
    actual:
      `start_blocking ก่อนกด=${JSON.stringify(mid.start_blocking.counts)} total=${mid.start_blocking.total}; ` +
      `dialog: ${listed.map((l) => `${l.no}${l.shown ? "✓" : "✗ไม่แสดง"}`).join(", ")}; ` +
      `หลังเคลียร์ total=${after.start_blocking.total}` +
      (clearNotes.length ? `; ${clearNotes.join("; ")}` : ""),
    status: pass ? "PASS" : "FAIL",
    docs: docs.map((d) => d.no),
    images,
  });
  return pass;
}

test.beforeAll(() => requireScenario());
gatePhase({ dates: true });
test.beforeAll(async () => {
  expect(await currentPeriod(BU)).toBe(PERIOD);
  const r = await review(BU);
  expect(r.physical_count_period?.status, "รอบนับต้องยังไม่เริ่ม (ถ้า counting แล้ว spec นี้ไม่มีความหมาย)").not.toBe("counting");
});

test(
  "TC-PE-420001 GRN ร่าง (เลข draft-…) ลงวันที่ในงวดขวาง Start Period Close แล้ว Void ได้",
  {
    annotation: [
      { type: "preconditions", description: "Login เป็น Admin (gmail); งวดปัจจุบันของ BU = งวดของ scenario; รอบนับยังไม่เริ่ม; ไม่มีเอกสารค้างอื่นในงวด (start_blocking.total = 0); 910 ผ่านแล้ว (admin ผูกกับคลัง L)" },
      { type: "steps", description: "1. สร้าง GRN manual ลงวันที่ case1Date ของ scenario (E2E-PC-X qty 1 @10 ที่คลัง L) → Save Draft\n2. GET period-ends/review\n3. Period End → Start Period Close → ยืนยัน\n4. อ่าน dialog \"Finish these documents first\" → Close\n5. เปิด GRN → Void (กรอกเหตุผล)\n6. GET period-ends/review" },
      { type: "expected", description: "start_blocking.grn = 1 ก่อนกด; Start ถูกปฏิเสธ 422 และ dialog ลิสต์เลข draft-… ของใบนั้น; หลัง Void start_blocking.total = 0" },
      { type: "priority", description: "High" },
      { type: "testType", description: "Negative" },
      { type: "note", description: "เดิม 1.1 (_movement_play specs/10-case1-start) · ทับซ้อน TC-PE-310002 (GRN ที่ยังไม่ post ขวางการปิด — ข้อนั้น skip เพราะเป็น backend only) · ผ่านแล้วในรอบก่อน → test.skip ไม่สร้างใบซ้ำ" },
    ],
  },
  async ({ page }) => {
    const pass = await runBlockerCase(page, "1.1", "GRN ร่าง (เลข draft-…) ในงวดขวางการเริ่มนับ", [
      { ...grnDraft("c1.1-grn", `E2E-${PERIOD}-1.1`), clearLabel: "Void", clear: (p, d) => voidGrn(p, d.id, reason("1.1")) },
    ]);
    expect(pass, "ดู actual ใน results.json").toBe(true);
  },
);

test(
  "TC-PE-420002 GRN บันทึกแล้ว (saved) ของสินค้า P1 ลงวันที่ในงวดขวาง Start Period Close แล้ว Void ได้",
  {
    annotation: [
      { type: "preconditions", description: "Login เป็น Admin (gmail); งวดปัจจุบันของ BU = งวดของ scenario; รอบนับยังไม่เริ่ม; ไม่มีเอกสารค้างอื่นในงวด (start_blocking.total = 0); 910 ผ่านแล้ว" },
      { type: "steps", description: "1. สร้าง GRN manual ตาม voidTrap ของ scenario (E2E-PC-1 qty 10 ราคากับดัก วันที่ในงวด ที่คลัง L) → Create (saved)\n2. GET period-ends/review\n3. Period End → Start Period Close → ยืนยัน\n4. อ่าน dialog \"Finish these documents first\" → Close\n5. เปิด GRN → Void\n6. GET period-ends/review" },
      { type: "expected", description: "start_blocking.grn = 1 ก่อนกด; Start ถูกปฏิเสธ 422 และ dialog ลิสต์เลข GRN ของใบนั้น; หลัง Void สถานะใบ = voided และ start_blocking.total = 0" },
      { type: "priority", description: "High" },
      { type: "testType", description: "Negative" },
      { type: "note", description: "เดิม 1.2 (_movement_play specs/10-case1-start) · ใบ void นี้ (state key = voidTrap.key) ใช้ต่อในข้อ 2.9 เป็นกับดักต้นทุน (GRN void ต้องไม่นับ) — ห้ามเปลี่ยน key · ทับซ้อน TC-PE-310002 · ผ่านแล้วในรอบก่อน → test.skip" },
    ],
  },
  async ({ page }) => {
    const t = SCN.voidTrap;
    const pass = await runBlockerCase(page, "1.2", `GRN บันทึกแล้ว (${t.product.name} @${t.price} วันที่ ${t.date}) ขวางการเริ่มนับ — ใบ void นี้ใช้ต่อในข้อ 2.9`, [
      {
        ...grnSaved(t.key, `E2E-${PERIOD}-void`, t.product.code, t.price, t.date),
        clearLabel: "Void", clear: (p, d) => voidGrn(p, d.id, reason("1.2")),
      },
    ]);
    expect(pass, "ดู actual ใน results.json").toBe(true);
  },
);

test(
  "TC-PE-420003 Stock In ร่างลงวันที่ในงวดขวาง Start Period Close แล้ว Void ได้",
  {
    annotation: [
      { type: "preconditions", description: "Login เป็น Admin (gmail); งวดปัจจุบันของ BU = งวดของ scenario; รอบนับยังไม่เริ่ม; ไม่มีเอกสารค้างอื่นในงวด (start_blocking.total = 0); 910 ผ่านแล้ว" },
      { type: "steps", description: "1. Inventory Adjustment → Add Stock In · Date = case1Date ของ scenario · Reason E2E IA stock in · คลัง L · E2E-PC-X qty 1 @10 → Save (draft)\n2. GET period-ends/review\n3. Period End → Start Period Close → ยืนยัน\n4. อ่าน dialog → Close\n5. เปิดใบ → Edit → Void (กรอก Void Reason)\n6. GET period-ends/review" },
      { type: "expected", description: "start_blocking.stock_in = 1 ก่อนกด; Start ถูกปฏิเสธ 422 และ dialog ลิสต์เลข SI ของใบนั้น; หลัง Void start_blocking.total = 0; payload void ที่ FE ส่งถูกเก็บไว้ใช้ในข้อ 1.F2" },
      { type: "priority", description: "High" },
      { type: "testType", description: "Negative" },
      { type: "note", description: "เดิม 1.3 (_movement_play specs/10-case1-start) · actual ต้องมีข้อความ \"void payload={…}\" — TC-PE-420007 (1.F2) อ่านจาก results.json · ผ่านแล้วในรอบก่อน → test.skip" },
    ],
  },
  async ({ page }) => {
    const pass = await runBlockerCase(page, "1.3", "Stock In ร่างในงวดขวางการเริ่มนับ", [
      { ...siDraft("c1.3-si"), clearLabel: "Void", clear: (p, d) => voidAdjustment(p, "stock-in", d.id, reason("1.3")) },
    ]);
    expect(pass, "ดู actual ใน results.json").toBe(true);
  },
);

test(
  "TC-PE-420004 Stock Out ร่างลงวันที่ในงวดขวาง Start Period Close แล้ว Void ได้",
  {
    annotation: [
      { type: "preconditions", description: "Login เป็น Admin (gmail); งวดปัจจุบันของ BU = งวดของ scenario; รอบนับยังไม่เริ่ม; ไม่มีเอกสารค้างอื่นในงวด (start_blocking.total = 0); 910 ผ่านแล้ว (มีสต๊อก Shredded pork skin ที่คลัง L)" },
      { type: "steps", description: "1. Inventory Adjustment → Add Stock Out · Date = case1Date ของ scenario · Reason E2E IA stock out · คลัง L · Shredded pork skin qty 1 → Save (draft)\n2. GET period-ends/review\n3. Period End → Start Period Close → ยืนยัน\n4. อ่าน dialog → Close\n5. เปิดใบ → Edit → Void (กรอก Void Reason)\n6. GET period-ends/review" },
      { type: "expected", description: "start_blocking.stock_out = 1 ก่อนกด; Start ถูกปฏิเสธ 422 และ dialog ลิสต์เลข SO ของใบนั้น; หลัง Void start_blocking.total = 0" },
      { type: "priority", description: "High" },
      { type: "testType", description: "Negative" },
      { type: "note", description: "เดิม 1.4 (_movement_play specs/10-case1-start) · actual ต้องมีข้อความ \"void payload={…}\" — TC-PE-420007 (1.F2) อ่านจาก results.json · ผ่านแล้วในรอบก่อน → test.skip" },
    ],
  },
  async ({ page }) => {
    const pass = await runBlockerCase(page, "1.4", "Stock Out ร่างในงวดขวางการเริ่มนับ", [
      { ...soDraft("c1.4-so"), clearLabel: "Void", clear: (p, d) => voidAdjustment(p, "stock-out", d.id, reason("1.4")) },
    ]);
    expect(pass, "ดู actual ใน results.json").toBe(true);
  },
);

test(
  "TC-PE-420005 GRN ร่าง + GRN saved + Stock In ร่าง + Stock Out ร่าง ค้างพร้อมกัน dialog ต้องลิสต์ครบแล้วเคลียร์ด้วย Delete/Void",
  {
    annotation: [
      { type: "preconditions", description: "Login เป็น Admin (gmail); งวดปัจจุบันของ BU = งวดของ scenario; รอบนับยังไม่เริ่ม; ไม่มีเอกสารค้างอื่นในงวด (start_blocking.total = 0); 910 ผ่านแล้ว" },
      { type: "steps", description: "1. สร้างผ่าน UI ลงวันที่ในงวด: GRN ร่าง (Save Draft), GRN saved (E2E-PC-X qty 10 @20), Stock In ร่าง, Stock Out ร่าง\n2. GET period-ends/review\n3. Period End → Start Period Close → ยืนยัน\n4. อ่าน dialog → Close\n5. Delete GRN ร่าง · Void GRN saved (ใบ saved ลบไม่ได้) · Delete SI ร่าง · Delete SO ร่าง\n6. GET period-ends/review" },
      { type: "expected", description: "start_blocking ก่อนกด = grn 2 / stock_in 1 / stock_out 1; Start ถูกปฏิเสธ 422 และ dialog ลิสต์เลขทั้งสี่ใบ; หลังเคลียร์ start_blocking.total = 0" },
      { type: "priority", description: "High" },
      { type: "testType", description: "Edge Case" },
      { type: "note", description: "เดิม 1.5 (_movement_play specs/10-case1-start) · ครอบเส้นทางลบ (Delete) ของ GRN/SI/SO ร่าง · SI/SO ใบใหม่ในข้อนี้เคยได้เลขซ้ำกับใบที่ void ในข้อ 1.3/1.4 (บั๊ก 1.F1 แก้แล้วใน PR #697) · ทับซ้อน TC-PE-310005 (pending หลายชนิด) · ผ่านแล้วในรอบก่อน → test.skip" },
    ],
  },
  async ({ page }) => {
    const pass = await runBlockerCase(page, "1.5", "GRN draft + GRN saved + SI draft + SO draft ค้างพร้อมกัน (เคลียร์ด้วย Delete ครอบเส้นทางลบ)", [
      { ...grnDraft("c1.5-grn-draft", `E2E-${PERIOD}-1.5a`), clearLabel: "Delete", clear: (p, d) => deleteGrnDraft(p, d.id) },
      {
        ...grnSaved("c1.5-grn-saved", `E2E-${PERIOD}-1.5b`, PX.code, 20, SCN.case1Date),
        clearLabel: "Void", clear: (p, d) => voidGrn(p, d.id, reason("1.5")), // ใบ saved ลบไม่ได้ ต้อง void
      },
      { ...siDraft("c1.5-si"), clearLabel: "Delete", clear: (p, d) => deleteAdjustment(p, "stock-in", d.id) },
      { ...soDraft("c1.5-so"), clearLabel: "Delete", clear: (p, d) => deleteAdjustment(p, "stock-out", d.id) },
    ]);
    expect(pass, "ดู actual ใน results.json").toBe(true);
  },
);

test(
  "TC-PE-420006 เคสด่าน Start ที่ทำให้เกิดบนงวดของ scenario ไม่ได้ บันทึกเป็น N/A พร้อมเหตุผลและตรวจข้อเท็จจริงที่รองรับ",
  {
    annotation: [
      { type: "preconditions", description: "Login เป็น Admin (gmail); งวดปัจจุบันของ BU = งวดของ scenario; รอบนับยังไม่เริ่ม; E2E_DB_URL ตั้งไว้" },
      { type: "steps", description: "1. DB: นับ SI / SO / CN ที่ doc_status = in_progress → บันทึก 1.N2 = N/A\n2. GET period-ends/review: ดูชนิดเอกสารใน start_blocking → บันทึก 1.N3 = INFO" },
      { type: "expected", description: "ไม่มี SI/SO/CN ที่สถานะ in_progress ใน BU; start_blocking ไม่มีชนิด cn / pr / po" },
      { type: "priority", description: "Low" },
      { type: "testType", description: "Edge Case" },
      { type: "note", description: "เดิม 1.N1 / 1.N2 / 1.N3 (_movement_play specs/10-case1-start ชื่อ \"1.N เคสที่ทำให้เกิดบน BU ไม่ได้\") · ต้นฉบับบันทึก N/A / INFO อย่างเดียวไม่ assert — พอร์ตเพิ่มการตรวจข้อเท็จจริงที่ทำให้เป็น N/A/INFO · 1.N1 ทดสอบของจริงใน TC-PE-410001 (911 สร้างใบค้างเองผ่าน API) จึงไม่มีแถว N/A ของ 1.N1 อีกแล้ว · 1.N3 ยืนยันด้วยการใช้งานจริงใน TC-PE-440006/440007" },
    ],
  },
  async ({ page }) => {
    // 1.N2: ไม่มีโค้ดตั้ง in_progress ให้ SI/SO/CN — ยืนยันจากข้อมูลจริงว่าไม่มีแถวสถานะนี้เลย
    const inProgress = sql<{ t: string; n: string }>(`
      select 'SI' t, count(*) n from ${SCHEMA}.tb_stock_in where doc_status::text = 'in_progress'
      union all select 'SO', count(*) from ${SCHEMA}.tb_stock_out where doc_status::text = 'in_progress'
      union all select 'CN', count(*) from ${SCHEMA}.tb_credit_note where doc_status::text = 'in_progress'`);
    record({
      id: "1.N2", case: CASE, title: "SI / SO / CN สถานะ in_progress",
      steps: ["ไล่โค้ด micro-business: stock-in, stock-out, credit-note"],
      expected: "เอกสาร in_progress ขวางด่าน Close",
      actual:
        "ทำไม่ได้: ไม่มีโค้ดส่วนไหนตั้งสถานะ in_progress ให้ SI/SO/CN (grep แล้ว) — validateStockIn/StockOut/CreditNote ฝั่ง Close จึงนับได้ 0 เสมอ " +
        "(ข้อค้นพบ: validator สามตัวนี้เป็นโค้ดตาย) · SI/SO ร่างขวางแค่ด่าน Start (ข้อ 1.3/1.4)",
      status: "N/A",
    });
    // 1.N3: CN ร่าง / PR / PO ไม่อยู่ในตัวขวาง Start (ตามโค้ด) — ชนิดที่ review นับต้องไม่มีสามตัวนี้
    const rv = await review(BU);
    record({
      id: "1.N3", case: CASE, title: "CN draft · PR / PO ค้าง",
      steps: ["ไล่ listStartCountingBlockers / validatePeriodEnd"],
      expected: "ไม่ขวางทั้งสองด่าน (ตามโค้ด)",
      actual: "ยืนยันด้วยการใช้งานจริงในข้อ 2.5–2.6: เปิด CN draft + PR/PO ค้างทิ้งไว้แล้วกด Start ต้องผ่าน",
      status: "INFO",
    });
    expect(
      inProgress.filter((r) => Number(r.n) > 0).map((r) => `${r.t}×${r.n}`),
      "มี SI/SO/CN สถานะ in_progress — เหตุผล N/A ของ 1.N2 ไม่จริงแล้ว",
    ).toEqual([]);
    expect(
      Object.keys(rv.start_blocking.counts).filter((k) => ["cn", "pr", "po"].includes(k)),
      "start_blocking ไม่ควรนับ CN / PR / PO",
    ).toEqual([]);
  },
);

test(
  "TC-PE-420007 ข้อค้นพบระหว่างเคลียร์เอกสาร: เลข SI/SO ต้องไม่ซ้ำหลัง void/delete และเหตุผล void ต้องถึง DB",
  {
    annotation: [
      { type: "preconditions", description: "TC-PE-420003 / 420004 / 420005 รันแล้วในงวดเดียวกัน (มี SI/SO ที่ถูก void และลบ และมี payload void ใน results.json); E2E_DB_URL ตั้งไว้" },
      { type: "steps", description: "1. DB: หา si_no / so_no ของงวด (ขึ้นต้น SI<งวด> / SO<งวด>) ที่มีมากกว่า 1 แถว รวมแถวที่ถูกลบ\n2. DB: อ่าน info.void_reason ของ SI/SO ที่ voided ในงวด\n3. เทียบกับ payload void ที่ FE ส่งในข้อ 1.3/1.4" },
      { type: "expected", description: "ไม่มีเลข SI/SO ซ้ำในงวด (ใบที่ void/ลบยังกันเลขไว้) และ SI/SO ที่ voided ทุกใบมี info.void_reason = ข้อความที่กรอก" },
      { type: "priority", description: "Medium" },
      { type: "testType", description: "Functional" },
      { type: "note", description: "เดิม 1.F1 / 1.F2 (_movement_play specs/10-case1-start) · บั๊กทั้งสองแก้แล้วใน PR #697 (period03 = FIXED, รอบล่าสุด p11-r4 / avg2607-r4 = PASS 2026-10-02) จึงไม่ใช่ test.fail · ต้นฉบับบันทึก FAIL โดยไม่ล้มเทส — พอร์ต assert ทั้งสองข้อ · scenario p03 จะล้มเสมอเพราะแถวเลขซ้ำ/void_reason ว่างที่เกิดก่อนแก้ยังค้างใน DB (ดู TC-PE-430003)" },
    ],
  },
  async () => {
    // SI/SO: void = soft delete ด้วย และตัวออกเลข (findLatestNumber) โดน Prisma extension ยัด deleted_at = null ให้
    // → มองไม่เห็นใบที่ถูกลบ → ออกเลขเดิมซ้ำ (unique index คือ (si_no, deleted_at) จึงไม่กัน)
    const dup = sql(`
      select 'SI' t, si_no no, count(*) n,
             string_agg(doc_status || case when deleted_at is null then '' else ' (deleted ' || to_char(deleted_at at time zone 'Asia/Bangkok', 'YYYY-MM-DD HH24:MI') || ')' end, ' | ' order by created_at) rows
      from ${SCHEMA}.tb_stock_in where si_no like 'SI${PERIOD}%' group by si_no having count(*) > 1
      union all
      select 'SO', so_no, count(*),
             string_agg(doc_status || case when deleted_at is null then '' else ' (deleted ' || to_char(deleted_at at time zone 'Asia/Bangkok', 'YYYY-MM-DD HH24:MI') || ')' end, ' | ' order by created_at)
      from ${SCHEMA}.tb_stock_out where so_no like 'SO${PERIOD}%' group by so_no having count(*) > 1
      order by 1, 2`);
    record({
      id: "1.F1", case: CASE, title: "เลขเอกสาร SI/SO ซ้ำหลัง void/delete (บั๊ก)",
      steps: [
        "1.3/1.4: สร้าง SI/SO ร่าง → Void (หลังบ้าน void + soft delete ในคราวเดียว)",
        "1.5: สร้าง SI/SO ร่างใบใหม่ → ได้เลขเดียวกับใบที่เพิ่ง void",
        `DB: หา si_no/so_no ของงวด ${PERIOD} ที่มีมากกว่า 1 แถว (รวมแถวที่ถูกลบ)`,
      ],
      expected: "เลขเอกสารไม่ซ้ำ — ใบที่ void/ลบไปแล้วยังต้องกันเลขไว้ (คอมเมนต์ใน stock-document-number.helper.ts ก็เขียนไว้แบบนั้น)",
      actual: dup.length
        ? dup.map((d) => `${d.no} ×${d.n}: ${d.rows}`).join(" ; ") +
          " — ต้นเหตุ: findLatestNumber (common/helpers/stock-document-number.helper.ts:136) ไม่ระบุ deleted_at " +
          "แล้ว tenant Prisma client (prisma-shared-schema-tenant/src/client.ts:421) ยัด deleted_at = null ให้ทุก read"
        : "ไม่พบเลขซ้ำ",
      status: dup.length ? "FAIL" : "PASS",
    });

    const reasons = sql(`
      select si_no no, info->>'void_reason' reason from ${SCHEMA}.tb_stock_in where doc_status = 'voided' and si_no like 'SI${PERIOD}%'
      union all
      select so_no, info->>'void_reason' from ${SCHEMA}.tb_stock_out where doc_status = 'voided' and so_no like 'SO${PERIOD}%'`);
    const sentFrom = ["1.3", "1.4"].map((k) => prevRecord(k)?.actual.match(/void payload=(\{.*?\})/)?.[1]).filter(Boolean);
    const lost = reasons.filter((r) => !r.reason);
    record({
      id: "1.F2", case: CASE, title: "เหตุผลที่กรอกตอน Void SI/SO ไม่ถูกเก็บ",
      steps: ["Void SI/SO ร่างพร้อมกรอก Void Reason", "ดู info.void_reason ใน DB"],
      expected: "info.void_reason = ข้อความที่กรอก",
      actual:
        `payload ที่ FE ส่ง: ${sentFrom.join(" / ") || "(ไม่ได้เก็บ)"} · DB: ${reasons.map((r) => `${r.no}="${r.reason ?? ""}"`).join(", ")}` +
        (lost.length
          ? " — ต้นเหตุ: micro-business อ่าน payload.data.info.void_reason (stock-in.controller.ts:182, stock-out ทำนองเดียวกัน) แต่ FE ส่ง data.void_reason ที่ชั้นบนสุด"
          : ""),
      status: lost.length ? "FAIL" : "PASS",
    });
    expect(dup.map((d) => `${d.no}×${d.n}`), `เลข SI/SO ของงวด ${PERIOD} ซ้ำ (รวมแถวที่ถูกลบ)`).toEqual([]);
    expect(lost.map((r) => r.no), "SI/SO ที่ voided แต่ info.void_reason ว่าง").toEqual([]);
  },
);
