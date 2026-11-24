import {
  test,
  expect,
  gotoInBu,
  BU,
  requireScenario,
  irreversibleAllowed,
  irreversibleSkip,
  shot,
  record,
  currentPeriod,
  review,
  getDoc,
} from "./helpers/period-close/context";
import { btn, lastToast } from "./helpers/movement/ui";
import { PERIOD, SCN } from "./helpers/period-close/scenarios";

/**
 * Period close · phase 918 — presses Start Period Close for real (count round
 * draft → counting) while the out-of-period documents and CN drafts of the earlier
 * phases are still open: they are the proof that those documents do not block the
 * start, observed through the real screen rather than inferred from the API.
 *
 * IRREVERSIBLE: opens the count round of the scenario's current period. Runs only
 * on a TEST BU whose active period is the scenario's (irreversibleAllowed — data:reset --with-history puts it there), and only when
 * the backend reports nothing blocking (start_blocking.total = 0). If the round is
 * already counting (an earlier run started it), the case ends without pressing again.
 * Prerequisites: phases 910–917 (origin 00-prestep … 24-new-rules) done for the same
 * scenario — the documents listed in state.json are the ones left open on purpose.
 *
 * Run: E2E_PERIOD_BU=<BU> bun run test:period-close -- tests/918-period-close-start.spec.ts
 *
 * Origin: _movement_play/eop_bf/e2e/specs/25-start.spec.ts
 */
// ⚠️ ย้อนกลับไม่ได้ — กด Start Period Close ของ TEST BU (E2E_PERIOD_BU) งวดปัจจุบันจริง (รอบนับ draft → counting)
// รันได้เฉพาะเมื่อ BU เป็น TEST BU และงวด active ตรงกับ scenario (irreversibleAllowed) และ precheck ผ่านครบ · ถ้าเริ่มไปแล้วจะไม่กดซ้ำ
// (TEST BU รีเซ็ตกลับได้ด้วย data:reset --bu <BU> --with-history จึงไม่ต้องขอสิทธิ์รายรอบเหมือนเดิม)
// เอกสารที่เปิดค้างตอนกด = หลักฐานว่าไม่ขวางการเริ่มนับจริง (ไม่ใช่แค่ดูจาก API)

const CASE = "Case 2 · เอกสารนอกงวด";

test.beforeAll(() => requireScenario());

test(
  "TC-PE-480001 กด Start Period Close จริงขณะมีเอกสารนอกงวดและใบลดหนี้ร่างเปิดค้าง ต้องเริ่มนับได้",
  {
    annotation: [
      {
        type: "preconditions",
        description:
          "E2E_PERIOD_BU=<BU> เป็น TEST BU และงวด active ของ BU = งวดของ scenario (ไม่ใช่ = ข้าม); Login เป็น Admin (gmail, project setup); งวดปัจจุบันของ BU = งวดของ scenario; phase 910–917 ผ่านแล้ว (รวม TC-PE-440007 ตรวจความพร้อม) — review.start_blocking.total = 0 และรอบนับของงวดยังเป็น draft; เอกสารนอกงวด (GRN งวดหน้า saved/draft) และใบลดหนี้ร่างที่ phase ก่อนสร้างยังเปิดค้างอยู่ใน state.json",
      },
      {
        type: "steps",
        description:
          "1. ตรวจ GET /period-ends/current = งวดของ scenario และ GET /period-ends/review: รอบนับเป็น draft, start_blocking.total = 0 (ถ้ารอบนับเป็น counting แล้ว จบโดยไม่กดซ้ำ)\n2. เปิด /inventory-management/period-end\n3. กด Start Period Close\n4. กด Start Period Close ใน dialog ยืนยัน แล้วรอ POST /period-ends/start-counting\n5. อ่าน toast และดูว่าหน้าพาไป /inventory-management/period-end/review\n6. อ่าน review จาก API อีกครั้ง",
      },
      {
        type: "expected",
        description:
          "POST start-counting ตอบ 2xx, toast \"Counting started.\", หน้าพาไป /inventory-management/period-end/review และ review.physical_count_period.status เปลี่ยน draft → counting — เอกสารนอกงวดและใบลดหนี้ร่างไม่ขวางการเริ่มนับ",
      },
      { type: "priority", description: "High" },
      { type: "testType", description: "Happy Path" },
      {
        type: "note",
        description:
          "เดิม 2.6 (_movement_play specs/25-start) · ย้อนกลับไม่ได้: เปิดรอบนับของงวดจริง ทำได้เฉพาะบน TEST BU ที่รีเซ็ตด้วย data:reset ได้ · ผลล่าสุด PASS ทั้ง avg2607-r4 และ p11-r4 (2026-10-02) · เดิมรอหน้า review ด้วย .catch() — เปลี่ยนเป็น expect.soft บน URL เพื่อให้แถว 2.6 ใน results.json ยังถูกบันทึกหลังกดจริงแม้หน้าไม่พาไป review · กรณี Start ถูกขวาง (422) อยู่ใน 912 (เดิม 10-case1-start) · ตรวจความพร้อมแบบไม่กดอยู่ใน TC-PE-440007",
      },
    ],
  },
  async ({ page }) => {
    test.skip(!(await irreversibleAllowed(PERIOD)), irreversibleSkip("Start Period Close opens the count round"));
    expect(await currentPeriod(BU)).toBe(PERIOD);
    const before = await review(BU);
    if (before.physical_count_period?.status === "counting") {
      test.info().annotations.push({ type: "note", description: "รอบนับเริ่มไปแล้วจากรอบก่อน — ไม่กดซ้ำ" });
      return;
    }
    expect(before.physical_count_period?.status).toBe("draft");
    expect(before.start_blocking.total, "ต้องไม่มีเอกสารขวาง (ไม่งั้นจะได้ 422 แทน)").toBe(0);

    const open = [SCN.keys.nextGrn, SCN.keys.nextGrnDraft, SCN.keys.cnDraftIn, "cnRegress"].map((k) => getDoc(k)).filter((d) => !!d) as { no: string }[];
    const images: string[] = [];
    await gotoInBu(page, "/inventory-management/period-end");
    images.push(await shot(page, "2.6", "a-ก่อนกด-Start"));
    await btn(page, "Start Period Close").click();
    const confirm = page.locator("[role=alertdialog]").last();
    await expect(confirm).toBeVisible();
    images.push(await shot(page, "2.6", "b-ยืนยัน-Start"));
    const started = page.waitForResponse((r) => /\/period-ends\/start-counting/.test(r.url()) && r.request().method() === "POST");
    await confirm.getByRole("button", { name: "Start Period Close" }).click();
    const resp = await started;
    const toast = await lastToast(page);
    // หลังกดจริงแล้ว — soft เพื่อให้ยังถ่ายรูปและบันทึกแถว 2.6 ได้แม้หน้าไม่พาไป review (เคสยังล้มตอนจบ)
    await expect.soft(page, "หลังเริ่มนับ หน้าต้องพาไปหน้า review").toHaveURL(/\/period-end\/review/, { timeout: 30_000 });
    await page.waitForTimeout(1500);
    images.push(await shot(page, "2.6", "c-หลังกด-Start-หน้า-review"));

    const after = await review(BU);
    const ok = resp.ok() && after.physical_count_period?.status === "counting";
    record({
      id: "2.6",
      case: CASE,
      title: "กด Start Period Close จริง ขณะมีเอกสารนอกงวดและ CN ร่างเปิดค้าง",
      steps: [`เปิดค้าง: ${open.map((d) => d.no).join(", ")}`, "Period End → Start Period Close → ยืนยัน"],
      expected: "เริ่มนับได้ (200) · รอบนับ draft → counting · เอกสารนอกงวด / CN ร่างไม่ขวาง",
      actual: `HTTP ${resp.status()} · toast="${toast}" · รอบนับ ${before.physical_count_period?.status} → ${after.physical_count_period?.status} · can_close=${after.can_close} close_blocking=${JSON.stringify(after.close_blocking)}`,
      status: ok ? "PASS" : "FAIL",
      docs: open.map((d) => d.no),
      images,
    });
    // = ok ของแถว 2.6 แยกสองข้อให้เห็นว่าล้มตรงไหน
    expect(resp.ok(), `start-counting HTTP ${resp.status()} · toast="${toast}"`).toBe(true);
    expect(after.physical_count_period?.status, "รอบนับหลังกด Start").toBe("counting");
  },
);
