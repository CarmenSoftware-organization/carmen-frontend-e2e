import { test, expect, BU, requireScenario, gatePhase, irreversibleAllowed, irreversibleSkip, record, currentPeriod, review } from "./helpers/period-close/context";
import { countLocation, reviewOnHand, countDetails } from "./helpers/period-close/count";
import { L, P, PERIOD } from "./helpers/period-close/scenarios";

/**
 * Period close · Case 2 · count every location + compensation — section 51 of PE.
 *
 * Counts every location of the count round through the real screens (location card
 * on the review page → entry → Submit for Review → Submit):
 *  - the price-test location L (1AG01): P1/P2/P3 counted +2 over, P4 counted −2 short,
 *    everything else equal to the system quantity — this produces the compensation
 *    Stock In / Stock Out that TC-PE-520001 / 520002 check
 *  - every other location: counted equal to the quantity the sheet compares against
 *    (later-period rows included — accepted by the user, so no fake compensation)
 *
 * IRREVERSIBLE: a submitted count sheet is `completed` and cannot be reopened. The
 * source suite did not gate this phase; here it is gated like Start / Close — the
 * test is skipped unless E2E_ALLOW_IRREVERSIBLE=<BU>:<period> names this scenario's
 * BU and period. A rerun skips locations already completed.
 *
 * Prerequisites: count round started (status `counting`); TC-PE-500001 ran (its
 * documents must still be open while L is counted — they are price traps for 2.9).
 * E2E_PERIOD_LOC=code1,code2 limits the run to those locations.
 * Run: E2E_PERIOD_SCENARIO=<scenario> E2E_ALLOW_IRREVERSIBLE=<BU>:<period> bun run test:period-close -- tests/921-period-close-count.spec.ts
 * Origin: _movement_play/eop_bf/e2e/specs/40-count.spec.ts
 */
// Case 2 · นับ + ชดเชย — นับครบ 13 คลังผ่านหน้าจอ (ย้อนกลับไม่ได้ต่อคลัง: submit แล้ว = completed)
// คลัง L (1AG01): P1/P2/P3 นับเกิน +2 · P4 นับขาด −2 · Chicken frame เท่ายอดระบบ
// คลังอื่น: นับเท่ายอดที่ระบบใช้เทียบ (รวมรายการงวดหลังที่ปนมา — ผู้ใช้รับทราบ ไม่ให้เกิดใบชดเชยปลอม)
// LOC=code1,code2 = จำกัดคลังที่จะนับรอบนี้ (ที่นี่ใช้ E2E_PERIOD_LOC)

const CASE = "Case 2 · นับ + ชดเชย";
const ONLY = process.env.E2E_PERIOD_LOC?.split(",").map((s) => s.trim()).filter(Boolean);

test.beforeAll(() => requireScenario());
gatePhase({ counting: true });
test.beforeAll(async () => {
  expect(await currentPeriod(BU)).toBe(PERIOD);
});

/**
 * คลังที่จะนับ — ต้นฉบับ hardcode 13 คลัง:
 *   "1AG02", "1BQ01", "1EG01", "1FB01", "1FB03", "1FO01", "1FO02", "1HK01", "1HR01", // ว่าง
 *   "1FB02", "1SR01", "TEST-MOVE", // มีสินค้า นับเท่ายอดระบบ
 *   L.code, // คลังทดสอบราคา — นับขาด/เกิน
 * ที่นี่อ่านจากรายการคลังที่ต้องนับใน review (physical_count_type = yes) แล้วเอาคลังทดสอบราคาไว้ท้ายสุดเหมือนเดิม
 */
async function countTargets(): Promise<string[]> {
  const all = ((await review(BU)).details.physical_count as { code: string }[]).map((l) => l.code);
  return [...all.filter((c) => c !== L.code), ...all.filter((c) => c === L.code)].filter((c) => !ONLY || ONLY.includes(c));
}

test(
  "TC-PE-510001 นับทุกคลังผ่านหน้าจอแล้ว submit ใบนับ คลังทดสอบราคานับเกินและขาดตามที่ตั้ง คลังอื่นนับเท่ายอดระบบ",
  {
    annotation: [
      {
        type: "preconditions",
        description:
          "Login เป็น admin@carmen.com บน BU ของ scenario; E2E_PERIOD_SCENARIO, E2E_DB_URL และ E2E_ALLOW_IRREVERSIBLE=<BU>:<งวด> ตั้งไว้; งวดที่ทดสอบยังเป็นงวดปัจจุบัน รอบนับอยู่สถานะ counting; TC-PE-500001 รันแล้วและเอกสารของมันยังค้างอยู่",
      },
      {
        type: "steps",
        description:
          "1. อ่านรายการคลังที่ต้องนับจาก /period-ends/review (คลังทดสอบราคา 1AG01 ไว้ท้ายสุด; E2E_PERIOD_LOC จำกัดได้)\n2. ต่อคลัง: คิดยอดที่ใบนับใช้เทียบ (cost layer ของงวดที่นับ) — คลัง 1AG01 ตั้ง P1/P2/P3 เกิน +2 และ P4 ขาด −2 คลังอื่นนับเท่ายอดระบบ (ยอดติดลบนับเป็น 0)\n3. Period End → Review → กดการ์ดคลัง → กรอกยอดทีละสินค้าผ่านช่องค้นหา\n4. กด Submit for Review แล้ว Submit\n5. อ่านแถวของใบนับ (ยอดระบบ / ยอดนับ / ส่วนต่าง) จากฐานข้อมูล",
      },
      {
        type: "expected",
        description:
          "ทุกคลังที่นับ: ใบนับสถานะ completed และ diff_qty ของทุกสินค้าตรงกับที่ตั้ง — 1AG01 ส่วนต่าง P1/P2/P3 = +2, P4 = −2 ตัวอื่น 0 · คลังอื่นส่วนต่าง 0 (ยกเว้นยอดระบบติดลบที่นับเป็น 0)",
      },
      { type: "priority", description: "High" },
      { type: "testType", description: "Functional" },
      {
        type: "note",
        description:
          "[IRREVERSIBLE] submit ใบนับแล้วเป็น completed ย้อนไม่ได้ — ต้นฉบับไม่ได้กั้น port นี้ skip ถ้าไม่ได้ตั้ง E2E_ALLOW_IRREVERSIBLE=<BU>:<งวด> · เดิม 2.7 (_movement_play specs/40-count) ซึ่งสร้างหนึ่ง test ต่อคลังด้วยชื่อแบบ dynamic — port รวมเป็น test เดียววน test.step ต่อคลัง หลักฐาน 2.7-<รหัสคลัง> เหมือนเดิม · ต้นฉบับ hardcode 13 คลัง (1AG02 1BQ01 1EG01 1FB01 1FB03 1FO01 1FO02 1HK01 1HR01 1FB02 1SR01 TEST-MOVE 1AG01) — port อ่านจาก review.details.physical_count · ส่วนต่างที่ผิดใช้ expect.soft เพื่อให้นับคลังที่เหลือต่อ (ต้นฉบับแยก test ต่อคลังจึงล้มทีละคลัง) รันซ้ำข้ามคลังที่ completed แล้ว · ซ้อนกับ TC-PE-330001 ใน 900-period-end ซึ่งเป็น skip ว่าง · รอบล่าสุด p11-r4 / avg2607-r4 (2026-10-02) PASS ทุกคลัง",
      },
    ],
  },
  async ({ page }) => {
    test.skip(!irreversibleAllowed(PERIOD), irreversibleSkip("a submitted count sheet cannot be reopened"));
    const LOCATIONS = await countTargets();
    expect(LOCATIONS.length, `ไม่มีคลังให้นับ${ONLY ? ` (E2E_PERIOD_LOC=${ONLY.join(",")} ไม่ตรงคลังไหนเลย)` : ""}`).toBeGreaterThan(0);
    if (!ONLY) expect(LOCATIONS, "คลังทดสอบราคาต้องอยู่ในรอบนับ").toContain(L.code);

    for (const code of LOCATIONS) {
      await test.step(`2.7 นับคลัง ${code}`, async () => {
        // ยอดที่จะนับ: เท่ายอดระบบ ยกเว้นคลังทดสอบราคา (P1/P2/P3 +2, P4 −2)
        // ยอดระบบติดลบ (AVG จ่ายออกโดยไม่เช็คของพอ) นับของจริงได้ต่ำสุด 0 และช่องนับก็ไม่รับค่าติดลบ
        const DELTA: Record<string, number> = code === L.code ? { [P.P1.code]: 2, [P.P2.code]: 2, [P.P3.code]: 2, [P.P4.code]: -2 } : {};
        const toCount = (prod: string, onHand: number) => Math.max(0, onHand) + (DELTA[prod] ?? 0);
        const system = reviewOnHand(code);
        const counts = Object.fromEntries(Object.entries(system).map(([k, q]) => [k, toCount(k, q)]));
        const id = `2.7-${code}`;
        const r = await countLocation(page, id, code, counts);
        const rows = countDetails(r.physicalCountId);
        const diffs = rows.map((x) => `${x.prod}: ระบบ ${Number(x.on_hand_qty)} นับ ${Number(x.actual_qty)} ต่าง ${Number(x.diff_qty)}`);
        // ตรวจกับยอดที่ใบนับบันทึกไว้ตอนนับ (on_hand_qty) ไม่ใช่ยอดวันนี้ — รันซ้ำหลัง submit ใบชดเชยเปลี่ยนยอดไปแล้ว
        const negative = rows.filter((x) => Number(x.on_hand_qty) < 0).map((x) => [x.prod, Number(x.on_hand_qty)] as const);
        const expectedDiff = Object.fromEntries(rows.map((x) => [x.prod, toCount(x.prod, Number(x.on_hand_qty)) - Number(x.on_hand_qty)]));
        const diffOk = rows.every((x) => Number(x.diff_qty) === (expectedDiff[x.prod] ?? 0));
        record({
          id, case: CASE,
          title: code === L.code
            ? `นับคลัง ${code} — P1/P2/P3 เกิน +2, P4 ขาด −2`
            : `นับคลัง ${code} เท่ายอดระบบ${rows.length ? "" : " (คลังว่าง)"}${negative.length ? " (ยอดติดลบนับเป็น 0)" : ""}`,
          steps: ["Period End → Review → การ์ดคลัง", rows.length ? "กรอกยอดทีละสินค้า (ค้นด้วยรหัส)" : "ไม่มีสินค้า", "Submit for Review → Submit"],
          expected: rows.length
            ? `ส่วนต่างตามที่ตั้ง: ${JSON.stringify(Object.fromEntries(Object.entries(expectedDiff).filter(([, v]) => v !== 0)))} (ตัวอื่น 0) · สถานะ completed`
            : "สถานะ completed",
          actual:
            `${r.skipped ? "(นับไว้แล้วจากรอบก่อน) " : ""}${diffs.join(" · ") || "ไม่มีรายการ"}` +
            (negative.length
              ? ` — ข้อค้นพบ: ยอดระบบติดลบ ${negative.map(([k, q]) => `${k} ${q}`).join(", ")} นับได้ 0 จึงเกิดใบชดเชยรับเข้าให้กลับเป็น 0`
              : ""),
          status: diffOk ? "PASS" : "FAIL",
          images: r.images,
        });
        // soft: คลังที่ส่วนต่างผิดถูก submit ไปแล้ว — ต้องนับคลังที่เหลือต่อ ไม่งั้นรันซ้ำก็ล้มที่คลังเดิมทุกรอบ
        expect.soft(diffOk, `${id}: ส่วนต่างไม่ตรงที่ตั้ง — ${diffs.join(" · ")}`).toBe(true);
      });
    }

    // ทุกคลังที่นับรอบนี้ต้องเป็น completed (ใบนับที่ submit แล้ว) — เงื่อนไขของ TC-PE-520001 / 520004
    const after = (await review(BU)).details.physical_count as { code: string; physical_count_status: string }[];
    const notDone = LOCATIONS.filter((c) => after.find((l) => l.code === c)?.physical_count_status !== "completed");
    expect(notDone, "คลังที่ยังไม่ completed หลังนับ").toEqual([]);
  },
);
