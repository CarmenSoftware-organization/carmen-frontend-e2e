import { test, expect, gotoInBu, BU, requireScenario, shot, record, currentPeriod, review, getDoc, putDoc, gatePhase } from "./helpers/period-close/context";
import { createGrn, grnById, createAdjustment, adjustmentById, adjustmentUrl, type CreatedDoc } from "./helpers/period-close/docs";
import { SCN, PERIOD, type CloseGateDoc } from "./helpers/period-close/scenarios";

/**
 * Period close · Case 1 · the Close gate — section 50 of PE.
 *
 * While the count round is open (status `counting`), create the documents listed in
 * the scenario's `closeGate` (a GRN saved, a GRN draft, a Stock In draft — all dated
 * inside the period) and check what blocks Close Period:
 *  - 1.6  a GRN saved inside the period blocks the close (close_blocking.grn, button disabled)
 *  - 1.7  locations not counted yet block the close (close_blocking.physical_count)
 *  - 1.8  drafts dated inside the period do NOT block (finding — they would be left
 *         behind in a closed period; TC-PE-520004 voids/deletes them before closing)
 *
 * Reversible at the period level (no Start / Close is pressed), but it creates real
 * documents. They are remembered in state.json (a rerun reuses them) and must stay
 * open until the count of the test location is submitted — some of them are price
 * traps for 2.9 (TC-PE-520002).
 *
 * Prerequisites: the count round was started (Start Period Close phase); the period
 * under test is still the current one.
 * Run: E2E_PERIOD_BU=<BU> bun run test:period-close -- tests/920-period-close-close-gate.spec.ts
 * Origin: _movement_play/eop_bf/e2e/specs/30-case1-close.spec.ts
 */
// Case 1 · ด่าน Close — ระหว่างช่วงนับ (รอบนับ = counting) สร้างเอกสารในงวดตาม SCN.closeGate แล้วดูว่าอะไรขวางการปิด
// GRN saved ต้องขวาง · GRN draft และ SI ร่าง: ตามโค้ดไม่ขวาง (บันทึกผลจริง)
// เอกสารพวกนี้ต้องค้างไว้จนกว่าจะ submit ใบนับของ L (บางตัวเป็นกับดักราคาในข้อ 2.9) — void/ลบทีหลังใน 45-verify

const CASE = "Case 1 · ด่าน Close";

test.beforeAll(() => requireScenario());
gatePhase({ counting: true, dates: true });
test.beforeAll(async () => {
  expect(await currentPeriod(BU)).toBe(PERIOD);
});

async function once(key: string, create: (onCreated: (d: CreatedDoc) => void) => Promise<unknown>, fresh: (id: string) => Promise<CreatedDoc>) {
  if (!getDoc(key)) await create((d) => putDoc(key, { ...d }));
  const d = await fresh(getDoc(key)!.id);
  putDoc(key, { ...d });
  return d;
}

const label = (c: CloseGateDoc) => ({ "grn-saved": "GRN saved", "grn-draft": "GRN draft", "si-draft": "SI ร่าง" })[c.kind];

test(
  "TC-PE-500001 เอกสารที่เกิดระหว่างช่วงนับ: GRN saved และคลังที่ยังไม่นับขวางการปิดงวด ส่วนเอกสารร่างไม่ขวาง",
  {
    annotation: [
      {
        type: "preconditions",
        description:
          "Login เป็น Admin (gmail, project setup) บน BU ของ scenario; E2E_PERIOD_BU และ E2E_DB_URL ตั้งไว้; งวดที่ทดสอบยังเป็นงวดปัจจุบัน และรอบนับอยู่สถานะ counting (กด Start Period Close แล้ว); ยังนับไม่ครบทุกคลัง",
      },
      {
        type: "steps",
        description:
          "1. สร้างเอกสารตาม closeGate ของ scenario ผ่านหน้าจอ ลงวันที่ในงวด: GRN กด Create (saved), GRN กด Save Draft, Stock In กด Save (ร่าง) — รันซ้ำใช้ใบเดิมจาก state.json\n2. เปิดหน้าเอกสารแต่ละใบเก็บภาพ\n3. เปิด Period End → Review\n4. อ่าน close_blocking / can_close จาก /period-ends/review และดูปุ่ม Close Period",
      },
      {
        type: "expected",
        description:
          "1.6: close_blocking.grn = จำนวน GRN saved ที่สร้าง และปุ่ม Close Period กดไม่ได้ · 1.7: close_blocking.physical_count = จำนวนคลังที่ยังไม่ completed (มากกว่า 0) และ can_close = false · 1.8: GRN draft และ SI ร่างไม่ถูกนับ — close_blocking.grn มาจาก GRN saved เท่านั้น และ close_blocking.stock_in = 0",
      },
      { type: "priority", description: "High" },
      { type: "testType", description: "Functional" },
      {
        type: "note",
        description:
          "เดิม 1.6–1.8 (_movement_play specs/30-case1-close) · หลักฐาน 1.6 / 1.7 / 1.8 · สร้างเอกสารจริง ต้องค้างไว้ถึง TC-PE-520004 (void/ลบก่อนปิด) · ต้นฉบับ assert แค่ close_blocking.grn — port นี้ assert ครบตาม verdict ทั้งสามข้อ (ปุ่ม Close กดไม่ได้, จำนวนคลังที่ยังไม่นับ, ร่างไม่ขวาง) · ต้นฉบับใช้เลข 13 คลังตายตัวใน 1.7 — port นับจาก review.details.physical_count (คลังที่ physical_count_type = yes ที่ยังไม่ completed) · 1.8 เป็น INFO (ข้อค้นพบ: ร่างที่ลงวันที่ในงวดไม่ขวางการปิด) — assert ข้อเท็จจริงนั้นแทน · ซ้อนกับ TC-PE-310002 ใน 900-period-end ซึ่งเป็น skip ว่าง · รอบล่าสุด p11-r4 / avg2607-r4 (2026-10-02) 1.6 และ 1.7 PASS, 1.8 INFO",
      },
    ],
  },
  async ({ page }) => {
    const made: { c: CloseGateDoc; d: CreatedDoc; url: string }[] = [];
    for (const c of SCN.closeGate) {
      const lines = [{ product: c.product.code, qty: c.kind === "si-draft" ? 1 : 10, price: c.price }];
      if (c.kind === "si-draft") {
        const d = await once(c.key, (onCreated) => createAdjustment(page, {
          type: "stock-in", date: c.date, reason: "E2E IA stock in", status: "draft", onCreated, lines,
        }), (id) => adjustmentById("stock-in", id));
        made.push({ c, d, url: adjustmentUrl("stock-in", d.id) });
      } else {
        const d = await once(c.key, (onCreated) => createGrn(page, {
          date: c.date, invoiceNo: `E2E-${PERIOD}-${c.key}`, status: c.kind === "grn-saved" ? "saved" : "draft", onCreated, lines,
        }), (id) => grnById(id));
        made.push({ c, d, url: `/procurement/goods-receive-note/${d.id}` });
      }
    }

    const r = await review(BU);
    const images: string[] = [];
    for (const m of made) {
      await gotoInBu(page, m.url);
      images.push(await shot(page, "1.6-1.8", `a-${m.d.no}`));
    }
    await gotoInBu(page, "/inventory-management/period-end/review");
    await page.waitForTimeout(1500);
    const closeDisabled = await page.getByRole("button", { name: /close period/i }).isDisabled();
    const reviewImg = await shot(page, "1.6-1.8", "b-review-Close-กดไม่ได้");

    const saved = made.filter((m) => m.c.kind === "grn-saved");
    const drafts = made.filter((m) => m.c.kind !== "grn-saved");
    // คลังที่ยังไม่นับ — ต้นฉบับใช้ 13 ตายตัว · นับจากรายการคลังที่ต้องนับใน review แทน
    const uncounted = (r.details.physical_count as { code: string; physical_count_status: string }[])
      .filter((l) => l.physical_count_status !== "completed").length;
    const desc = (m: (typeof made)[number]) => `${label(m.c)} ${m.d.no} (${m.c.product.name} @${m.c.price} ${m.c.date})`;
    record({
      id: "1.6", case: CASE, title: `GRN saved ในงวด ขวางการปิดงวด`,
      steps: [...saved.map((m) => `ระหว่างช่วงนับ: ${desc(m)} · Create (saved)`), "Period End → Review"],
      expected: `close_blocking.grn = ${saved.length} · ปุ่ม Close Period กดไม่ได้`,
      actual: `${saved.map((m) => `${m.d.no}=${m.d.status}`).join(", ")} · close_blocking=${JSON.stringify(r.close_blocking)} · ปุ่ม Close ${closeDisabled ? "กดไม่ได้" : "กดได้"}`,
      status: r.close_blocking.grn === saved.length && closeDisabled ? "PASS" : "FAIL",
      docs: saved.map((m) => m.d.no), images: [...images.slice(0, saved.length), reviewImg],
    });
    record({
      id: "1.7", case: CASE, title: "ยังนับไม่ครบทุกคลัง ขวางการปิดงวด",
      steps: ["Period End → Review หลังกด Start"],
      expected: `close_blocking.physical_count = จำนวนคลังที่ยังไม่นับ (${uncounted})`,
      actual: `physical_count=${r.close_blocking.physical_count} · can_close=${r.can_close}`,
      status: r.close_blocking.physical_count === uncounted && uncounted > 0 && !r.can_close ? "PASS" : "FAIL", images: [reviewImg],
    });
    record({
      id: "1.8", case: CASE, title: `เอกสารร่างที่เกิดระหว่างนับ (${drafts.map((m) => m.d.no).join(", ")})`,
      steps: [...drafts.map((m) => `ระหว่างช่วงนับ: ${desc(m)}`), "Period End → Review"],
      expected: "ตามโค้ด validatePeriodEnd: GRN นับเฉพาะ saved · SI นับเฉพาะ in_progress → ร่างไม่ขวาง Close",
      actual:
        `close_blocking grn=${r.close_blocking.grn} (มาจาก GRN saved เท่านั้น) · stock_in=${r.close_blocking.stock_in} ` +
        "— ข้อค้นพบ: เอกสารร่างที่ลงวันที่ในงวดไม่ขวางการปิด ถ้าปิดไปทั้งที่ร่างยังค้าง ร่างนั้นจะค้างอยู่ในงวดที่ปิดแล้ว — ลบทิ้งก่อนปิดใน 45-verify",
      status: r.close_blocking.grn === saved.length && r.close_blocking.stock_in === 0 ? "INFO" : "FAIL",
      docs: drafts.map((m) => m.d.no), images: [...images.slice(saved.length), reviewImg],
    });

    // 1.6 GRN saved ขวาง และปุ่มกดไม่ได้
    expect(saved.length, "closeGate ของ scenario ต้องมี GRN saved อย่างน้อยหนึ่งใบ").toBeGreaterThan(0);
    expect(r.close_blocking.grn, "1.6: close_blocking.grn ต้องเท่าจำนวน GRN saved").toBe(saved.length);
    expect(closeDisabled, "1.6: ปุ่ม Close Period ต้องกดไม่ได้").toBe(true);
    // 1.7 คลังที่ยังไม่นับขวาง
    expect(uncounted, "1.7: ต้องยังมีคลังที่ยังไม่นับ (phase นี้รันก่อนนับ)").toBeGreaterThan(0);
    expect(r.close_blocking.physical_count, "1.7: close_blocking.physical_count = จำนวนคลังที่ยังไม่นับ").toBe(uncounted);
    expect(r.can_close, "1.7: can_close ต้องเป็น false").toBe(false);
    // 1.8 ร่างไม่ขวาง (ข้อค้นพบ — ข้อเท็จจริงที่บันทึกเป็น INFO)
    expect(r.close_blocking.stock_in, "1.8: SI ร่างต้องไม่ถูกนับใน close_blocking.stock_in").toBe(0);
  },
);
