import { expect, type Page } from "@playwright/test";
import { createAuthTest } from "./fixtures/auth.fixture";
import { rawSend } from "./helpers/bu-api";
import { TEST_BUS } from "./test-users";
import { PeriodEndPage, LIST_PATH } from "./pages/period-end.page";

// ─────────────────────────────────────────────────────────────────────────
// Multi-role auth — Inventory Manager == carmensoftware.dev+purchase@gmail.com.
// Permission denial uses carmensoftware.dev+requestor@gmail.com.
// requestor declared LAST so doc default role reads "Purchase".
// ─────────────────────────────────────────────────────────────────────────
const requestorTest = createAuthTest("carmensoftware.dev+requestor@gmail.com");
const purchaseTest = createAuthTest("carmensoftware.dev+purchase@gmail.com");
const adminTest = createAuthTest("carmensoftware.dev+admin@gmail.com");

const REVIEW_PATH = `${LIST_PATH}/review`;

type Review = {
  can_close: boolean;
  close_blocking: Record<"sr" | "grn" | "cn" | "stock_in" | "stock_out" | "physical_count", number>;
  details: { transaction: Record<string, { count: number; complete_count: number; incomplete_count: number }>; physical_count: Record<string, unknown>[] };
};

/**
 * Review page with the backend's /period-ends/review answer patched. The states under test (everything complete, a closed-out
 * count round, a failing Close) cannot be reached on dev without the irreversible Start / Close, so the real answer is fetched and
 * only the fields of the scenario are overridden; the FE is what is asserted.
 */
async function mockReview(page: Page, patch: (d: Review) => void) {
  await page.route(/\/period-ends\/review$/, async (route) => {
    const real = await (await route.fetch()).json();
    patch(real.data);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(real) });
  });
}

const allClear = (d: Review) => {
  d.can_close = true;
  d.close_blocking = { sr: 0, grn: 0, cn: 0, stock_in: 0, stock_out: 0, physical_count: 0 };
  for (const t of Object.values(d.details.transaction)) Object.assign(t, { count: 4, complete_count: 4, incomplete_count: 0 });
};

const location = (i: number, done: boolean) => ({
  id: `loc-${i}`, code: `L${i}`, name: `Location ${i}`, location_type: "inventory", physical_count_type: "yes",
  product_counted: done ? 5 : 0, product_total: 5, physical_count_status: done ? "completed" : "pending",
  physical_count_id: null, start_counting_at: null, completed_at: null,
});

/** Opens the review page and waits until the backend's answer is rendered (the Close button is disabled while it loads). */
async function openReview(page: Page) {
  await page.goto(REVIEW_PATH);
  await expect(page.getByText(/block closing|Nothing here blocks closing/).first()).toBeVisible();
}

const closeButton = (page: Page) => page.getByRole("button", { name: "Close Period", exact: true });
const txRow = (page: Page, module: string) => page.getByRole("button", { name: new RegExp(module) });

/** Close Period pressed against a mocked answer — nothing reaches the real POST /period-ends (no irreversible close). */
async function closeRefusedBy(page: Page, status: number, message: string) {
  await mockReview(page, allClear);
  await page.route(/\/period-ends$/, (route) =>
    route.request().method() === "POST"
      ? route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ status, success: false, message }) })
      : route.fallback(),
  );
  await openReview(page);
  await closeButton(page).click();
  const refused = page.waitForResponse((r) => /\/period-ends$/.test(r.url()) && r.request().method() === "POST");
  await page.locator('[role="alertdialog"]').getByRole("button", { name: "Close Period", exact: true }).click();
  expect((await refused).status(), "the mocked refusal reached the FE").toBe(status);
  await expect(page.getByText("Period closed successfully.")).toHaveCount(0);
  await expect(page).toHaveURL(/period-end\/review$/);
  await page.unrouteAll({ behavior: "ignoreErrors" }); // a refetch of the mocked review may still be in flight
}

const emptyHistory = () => ({
  status: 200,
  contentType: "application/json",
  body: JSON.stringify({ data: [], status: 200, success: true, message: "Success", paginate: { total: 0, page: 1, perpage: 10, pages: 1 } }),
});

// ═════════════════════════════════════════════════════════════════════════
// TC-PE-900001 — View Period List (UI runnable)
// ═════════════════════════════════════════════════════════════════════════
purchaseTest.describe("Period End — List page", () => {
  purchaseTest(
    "TC-PE-010001 Happy Path - View Current Period",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+purchase@gmail.com และมี period view permission" },
        {
          type: "steps",
          description:
            "1. ไปที่ /inventory-management/period-end\n2. กด 'View Details'",
        },
        { type: "expected", description: "ผู้ใช้ถูกนำทางไปยังหน้า period detail" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const pe = new PeriodEndPage(page);
      const current = page.waitForResponse((r) => /\/period-ends\/current$/.test(r.url()) && r.status() === 200);
      await pe.gotoList();
      const period = (await (await current).json()).data;
      // หน้า list เป็นหน้าเดียวของโมดูล (ไม่มีปุ่ม View Details / route รายละเอียด — routes/router.tsx มีแค่ period-end กับ period-end/review)
      // การ์ด "Current Period" ต้องแสดงงวดจริงจากหลังบ้าน พร้อมสถานะ
      await expect(page.getByRole("heading", { level: 2, name: period.period })).toBeVisible();
      await expect(page.getByText("Current Period", { exact: true })).toBeVisible();
      await expect(pe.statusBadge()).toHaveText(new RegExp(`^${period.status}$`, "i"));
      await expect(pe.startPeriodCloseButton()).toBeVisible();
    },
  );

  purchaseTest(
    "TC-PE-010003 Edge Case - Empty Period History",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้มี period view permission และไม่มี periods ใน history" },
        { type: "steps", description: "1. จำลองหลังบ้านตอบรายการ period history ว่าง (page.route)\n2. ไปที่ /inventory-management/period-end" },
        { type: "expected", description: "ส่วน History แสดง 'No closed periods yet.' และ current period card ยังคง visible" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      const pe = new PeriodEndPage(page);
      // จำลองเฉพาะรายการประวัติ — ไม่แตะ /current กับ /review (path ลงท้าย period-ends ตรง ๆ)
      await page.route(/\/period-ends(\?.*)?$/, (route) => route.fulfill(emptyHistory()));
      await pe.gotoList();
      await expect(page.getByText("No closed periods yet.")).toBeVisible();
      await expect(page.locator("#pe-current-period")).toBeVisible();
      await expect(pe.startPeriodCloseButton()).toBeVisible();
    },
  );

  purchaseTest(
    "TC-PE-010004 Negative - No Current Period",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้มี period view permission และไม่มี current period" },
        { type: "steps", description: "1. จำลองหลังบ้านตอบ /period-ends/current เป็น 404 (page.route)\n2. ไปที่ /inventory-management/period-end" },
        { type: "expected", description: "แสดงข้อความ 'No current period end found.' ไม่มี current period card และไม่มีปุ่ม Start Period Close ส่วน History ยังแสดง" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const pe = new PeriodEndPage(page);
      await page.route(/\/period-ends\/current$/, (route) =>
        route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ status: 404, success: false, message: "Not found" }) }),
      );
      await pe.gotoList();
      await expect(page.getByText("No current period end found.")).toBeVisible();
      await expect(page.locator("#pe-current-period")).toHaveCount(0);
      await expect(pe.startPeriodCloseButton()).toHaveCount(0);
      // ส่วน History ยังโหลดแยกจาก current — หัวข้อต้องยังอยู่
      await expect(page.getByRole("heading", { level: 2, name: "History" })).toBeVisible();
    },
  );

  purchaseTest(
    "TC-PE-010005 Edge Case - Closed Current Period",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้มี period view permission และ current period ถูกปิดแล้ว" },
        { type: "steps", description: "1. จำลองหลังบ้านตอบ current period สถานะ closed (page.route)\n2. ไปที่ /inventory-management/period-end" },
        { type: "expected", description: "Current period card แสดงสถานะ Closed และปุ่ม Start Period Close ถูก disable" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      const pe = new PeriodEndPage(page);
      // fixture: งวดปัจจุบันที่ปิดแล้ว (หลังบ้านจริงของ TEST BU ไม่มีงวดปิด และห้ามปิดงวดจริงในเทสต์นี้)
      await page.route(/\/period-ends\/current$/, async (route) => {
        const real = await (await route.fetch()).json();
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...real, data: { ...real.data, status: "closed" } }) });
      });
      await pe.gotoList();
      await expect(pe.statusBadge()).toHaveText("Closed");
      await expect(pe.startPeriodCloseButton()).toBeDisabled();
    },
  );
});

requestorTest.describe("Period End — List page — Permission denial", () => {
  requestorTest(
    "TC-PE-010002 Negative - User Without Permission",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+requestor@gmail.com แต่ไม่มี period view permission" },
        { type: "steps", description: "1. ไปที่ /inventory-management/period-end" },
        { type: "expected", description: "แสดง Permission Denied ทับหน้า (ไม่ redirect) และไม่มีปุ่ม Start Period Close" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      await page.goto(LIST_PATH);
      // FE ไม่ redirect — แสดงกล่อง Permission Denied ทับหน้า และต้องไม่มีปุ่มเริ่มปิดงวด
      await expect(page.getByText("Permission Denied")).toBeVisible();
      await expect(page.getByText("You don't have permission to view this page.")).toBeVisible();
      await expect(new PeriodEndPage(page).startPeriodCloseButton()).toHaveCount(0);
    },
  );
});

// ═════════════════════════════════════════════════════════════════════════
// Period Review page (/inventory-management/period-end/review) — the FE has no /[id] or /close/[id] routes
// (routes/router.tsx registers only period-end and period-end/review); detail, validation and Close live on the review page.
// Mocked states only override the one endpoint; the real Close is TC-PE-540001 (phase 924, irreversible, gated).
// ═════════════════════════════════════════════════════════════════════════
purchaseTest.describe("Period End — Review page", () => {
  purchaseTest(
    "TC-PE-020001 View period detail for open period",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+purchase@gmail.com และมี period view permission และมี open period อยู่" },
        { type: "steps", description: "1. ไปที่ /inventory-management/period-end/review" },
        { type: "expected", description: "หน้า Period Close Review แสดงหัวข้อ Transactions, Physical Count และปุ่ม Close Period" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
        { type: "note", description: "เดิมเป็นหน้า /period-end/[id] (ไม่มีใน FE) — ย้ายมาตรวจหน้า review ซึ่งเป็นหน้ารายละเอียดของงวดปัจจุบัน" },
      ],
    },
    async ({ page }) => {
      await openReview(page);
      await expect(page.getByRole("heading", { name: "Period Close Review" })).toBeVisible();
      await expect(page.getByRole("heading", { level: 2, name: "Transactions" })).toBeVisible();
      await expect(page.getByRole("heading", { level: 2, name: "Physical Count" })).toBeVisible();
      await expect(closeButton(page)).toBeVisible();
    },
  );

  purchaseTest(
    "TC-PE-020005 View period detail for period with incomplete validation",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+purchase@gmail.com และมี period view permission และมีเอกสาร GRN ค้าง (จำลองคำตอบ review)" },
        { type: "steps", description: "1. จำลอง /period-ends/review ให้ GRN ค้าง 3 ใบ\n2. ไปที่ /inventory-management/period-end/review" },
        { type: "expected", description: "แสดง '3 document(s) block closing' แถว Goods Receive Notes แสดง '3 pending' และปุ่ม Close Period ถูก disable" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      await mockReview(page, (d) => {
        allClear(d);
        d.can_close = false;
        d.close_blocking.grn = 3;
        Object.assign(d.details.transaction.grn, { count: 5, complete_count: 2, incomplete_count: 3 });
      });
      await openReview(page);
      await expect(page.getByText("3 document(s) block closing")).toBeVisible();
      await expect(txRow(page, "Goods Receive Notes")).toContainText("3 pending");
      await expect(closeButton(page)).toBeDisabled();
    },
  );

  purchaseTest(
    "TC-PE-030001 Happy Path - Close Period enabled when nothing blocks closing",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+purchase@gmail.com และมี period view permission และ backend รายงาน can_close = true (จำลองคำตอบ review)" },
        { type: "steps", description: "1. จำลอง /period-ends/review ให้ทุกโมดูลครบและ can_close = true\n2. ไปที่ /inventory-management/period-end/review" },
        { type: "expected", description: "แสดง 'Nothing here blocks closing' และปุ่ม Close Period ถูก enable" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
        { type: "note", description: "เดิม Validate All แล้วปุ่ม Close enable — FE ไม่มีปุ่ม Validate All ปุ่ม Close ขึ้นกับ can_close จาก backend" },
      ],
    },
    async ({ page }) => {
      await mockReview(page, allClear);
      await openReview(page);
      await expect(page.getByText("Nothing here blocks closing")).toBeVisible();
      await expect(closeButton(page)).toBeEnabled();
    },
  );

  purchaseTest(
    "TC-PE-030005 Edge Case - Close Period disabled while counts and documents are outstanding",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+purchase@gmail.com และมี period view permission" },
        { type: "steps", description: "1. จำลอง /period-ends/review ให้ can_close = false (GRN ค้าง, ยังไม่นับ)\n2. ไปที่ /inventory-management/period-end/review" },
        { type: "expected", description: "ปุ่ม Close Period ถูก disable และ tooltip บอกว่าต้องทำรายการและนับให้ครบก่อนปิด" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      await mockReview(page, (d) => {
        d.can_close = false;
        d.close_blocking = { sr: 0, grn: 2, cn: 0, stock_in: 0, stock_out: 0, physical_count: 13 };
      });
      await openReview(page);
      await expect(closeButton(page)).toBeDisabled();
      await expect(closeButton(page)).toHaveAttribute("title", "All transactions must be complete and all physical counts must be completed before closing.");
    },
  );

  purchaseTest(
    "TC-PE-040004 Close Period - Server Error",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+purchase@gmail.com และมี period view permission และ backend รายงาน can_close = true (จำลอง)" },
        { type: "steps", description: "1. จำลอง review ให้ปิดได้ และ POST /period-ends ตอบ 500\n2. ไปหน้า review กด Close Period แล้วยืนยัน" },
        { type: "expected", description: "ไม่แสดง 'Period closed successfully.' และยังอยู่หน้า review (ไม่ redirect)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      await closeRefusedBy(page, 500, "Internal server error");
      await expect(closeButton(page)).toBeVisible();
    },
  );

  purchaseTest(
    "TC-PE-040005 Close Period - Validation No Longer Passes",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+purchase@gmail.com และมี period view permission และ review รายงาน can_close = true แต่ POST ปฏิเสธ (จำลอง)" },
        { type: "steps", description: "1. จำลอง review ให้ปิดได้ แต่ POST /period-ends ตอบ 422\n2. ไปหน้า review กด Close Period แล้วยืนยัน" },
        { type: "expected", description: "ไม่แสดง 'Period closed successfully.' และยังอยู่หน้า review" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      await closeRefusedBy(page, 422, "Period is not ready to close");
      await expect(closeButton(page)).toBeVisible();
    },
  );

  purchaseTest(
    "TC-PE-310001 All transactions posted",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+purchase@gmail.com และมี period view permission และทุกโมดูลมีเอกสารครบ (จำลองคำตอบ review)" },
        { type: "steps", description: "1. จำลอง /period-ends/review ให้ทุกโมดูลเสร็จครบ\n2. ไปที่ /inventory-management/period-end/review" },
        { type: "expected", description: "แถว GRN, Stock In, Stock Out, SR, CN แสดง 'Complete' และสรุป 'Nothing here blocks closing'" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      await mockReview(page, allClear);
      await page.goto(REVIEW_PATH);
      for (const m of ["Goods Receive Notes", "Stock In", "Stock Out", "Store Requisitions", "Credit Notes"]) {
        await expect(txRow(page, m)).toContainText("Complete");
      }
      await expect(page.getByText("Nothing here blocks closing")).toBeVisible();
    },
  );

  purchaseTest(
    "TC-PE-310002 Missing GRN document",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+purchase@gmail.com และมี period view permission และมี GRN ค้าง 2 ใบ (จำลอง)" },
        { type: "steps", description: "1. จำลอง review ให้ GRN ค้าง 2 ใบ\n2. ไปที่ /inventory-management/period-end/review" },
        { type: "expected", description: "แถว Goods Receive Notes แสดง '2 pending' แถวอื่นยัง Complete และ Close Period ถูก disable" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      await mockReview(page, (d) => {
        allClear(d);
        d.can_close = false;
        d.close_blocking.grn = 2;
        Object.assign(d.details.transaction.grn, { count: 6, complete_count: 4, incomplete_count: 2 });
      });
      await page.goto(REVIEW_PATH);
      await expect(txRow(page, "Goods Receive Notes")).toContainText("2 pending");
      await expect(txRow(page, "Credit Notes")).toContainText("Complete");
      await expect(closeButton(page)).toBeDisabled();
    },
  );

  purchaseTest(
    "TC-PE-330001 All Physical Counts Finalized Successfully",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+purchase@gmail.com และมี period view permission และทุกคลังนับเสร็จ (จำลอง)" },
        { type: "steps", description: "1. จำลอง review ให้ 2 คลังนับเสร็จ\n2. ไปที่ /inventory-management/period-end/review" },
        { type: "expected", description: "ส่วน Physical Count แสดง '2 of 2 completed'" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      await mockReview(page, (d) => {
        allClear(d);
        d.details.physical_count = [location(1, true), location(2, true)];
      });
      await page.goto(REVIEW_PATH);
      await expect(page.getByText("2 of 2 completed")).toBeVisible();
    },
  );

  purchaseTest(
    "TC-PE-330002 Review with No Physical Counts",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+purchase@gmail.com และมี period view permission" },
        { type: "steps", description: "1. จำลอง review ให้ไม่มีคลังที่ต้องนับ\n2. ไปที่ /inventory-management/period-end/review" },
        { type: "expected", description: "แสดง 'No physical counts in this period.'" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      await mockReview(page, (d) => {
        d.details.physical_count = [];
      });
      await page.goto(REVIEW_PATH);
      await expect(page.getByText("No physical counts in this period.")).toBeVisible();
    },
  );

  purchaseTest(
    "TC-PE-330004 Physical Count Status Not Finalized",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+purchase@gmail.com และมี period view permission และมีคลังที่ยังนับไม่เสร็จ (จำลอง)" },
        { type: "steps", description: "1. จำลอง review ให้ 1 จาก 2 คลังนับเสร็จ\n2. ไปที่ /inventory-management/period-end/review" },
        { type: "expected", description: "แสดง '1 of 2 completed'" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      await mockReview(page, (d) => {
        d.details.physical_count = [location(1, true), location(2, false)];
      });
      await page.goto(REVIEW_PATH);
      await expect(page.getByText("1 of 2 completed")).toBeVisible();
    },
  );

});

requestorTest.describe("Period End — Review page — Permission denial", () => {
  requestorTest(
    "TC-PE-020003 View period detail with no permission",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+requestor@gmail.com แต่ไม่มี period view permission" },
        { type: "steps", description: "1. ไปที่ /inventory-management/period-end/review" },
        { type: "expected", description: "แสดง Permission Denied (ไม่ redirect) และไม่มีปุ่ม Close Period" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      await page.goto(REVIEW_PATH);
      await expect(page.getByText("Permission Denied")).toBeVisible();
      await expect(closeButton(page)).toHaveCount(0);
    },
  );

});

// ═════════════════════════════════════════════════════════════════════════
// Activity Monitor (/system-admin/activity-log) — Record Type filter "Period"
// ═════════════════════════════════════════════════════════════════════════
adminTest.describe("Period End — Activity log", () => {
  adminTest(
    "TC-PE-340006 Activity Monitor กรอง Record Type = Period ได้",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com ที่เปิด Activity Monitor ได้" },
        { type: "steps", description: "1. ไปที่ /system-admin/activity-log\n2. กด Filter แล้วเลือก Record Type = Period" },
        { type: "expected", description: "request ส่ง entity_type=inventory_period ตอบ 200 ได้อย่างน้อยหนึ่งแถว ทุกแถวเป็น entity_type inventory_period และตัวกรองแสดง Record Type = Period" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
        { type: "note", description: "ส่วนที่ย้อนกลับได้ของ TC-PE-340001 — อ่านอย่างเดียว ไม่ปิดงวด · backend บันทึกงวดเป็น entity_type = inventory_period (data:reset สร้างงวดไว้แล้วจึงมีแถวเสมอ) · ก่อน FE แก้ ตัวกรองส่ง entity_type=period ซึ่งไม่มีแถวเลย และเคสนี้เคยผ่านทั้งที่ได้ list ว่าง" },
      ],
    },
    async ({ page }) => {
      await page.goto("/system-admin/activity-log");
      await page.getByRole("button", { name: "Filter", exact: true }).click();
      const filtered = page.waitForResponse((r) => /\/activity-logs\?/.test(r.url()) && r.url().includes("entity_type=inventory_period"));
      await page.getByText("Record Type").last().click();
      await page.getByRole("option", { name: "Period", exact: true }).click();
      const resp = await filtered;
      expect(resp.status()).toBe(200);
      const rows = (await resp.json()).data as { entity_type: string }[];
      expect(rows.length, "the Period filter finds the BU's period entries").toBeGreaterThan(0);
      expect(rows.filter((r) => r.entity_type !== "inventory_period"), "every returned row is a period entry").toEqual([]);
      await expect(page.getByText("Filters:")).toBeVisible();
      await expect(page.locator("#main-content").getByRole("button", { name: "Record Type inventory period" })).toBeVisible();
    },
  );

  adminTest(
    "TC-PE-340001 Happy Path - Log Activity Entry",
    {
      annotation: [
        { type: "preconditions", description: "TEST BU อย่างน้อยหนึ่งตัวใน TEST_BUS มีงวดที่ปิดแล้ว (ปิดด้วย period-close phase 924 — TC-PE-540001); หลัง data:reset ทุก BU ไม่มีงวดปิด เคสนี้จึง skip" },
        { type: "steps", description: "1. ไล่ TEST_BUS หางวด status = closed ล่าสุดจาก /api/<BU>/inventory-periods\n2. อ่าน /api/<BU>/activity-logs?entity_type=inventory_period เรียงใหม่สุดก่อน\n3. หาแถวของงวดที่ปิด" },
        { type: "expected", description: "มี activity entry entity_type=inventory_period ของงวดนั้นที่ new_data.status = closed พร้อม actor_id" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
        { type: "note", description: "อ่านอย่างเดียว ไม่ปิดงวดเอง (ย้อนกลับไม่ได้) · backend บันทึกการปิดงวดเป็น entity_type = inventory_period (action update) ไม่ใช่ period · ตัวกรอง Period ตรวจใน TC-PE-340006" },
      ],
    },
    async () => {
      // The newest closed period of the first TEST BU that has one — period-close (910–924) leaves it behind; nothing is closed here.
      let found: { bu: string; period: string } | undefined;
      for (const { code } of TEST_BUS) {
        const r = await rawSend<{ data?: { period: string; status: string; start_at: string }[] }>("Admin", "GET", `/api/${code}/inventory-periods?perpage=100`);
        expect(r.status, `inventory-periods of ${code}`).toBe(200);
        const closed = (r.body.data ?? []).filter((p) => p.status === "closed").sort((a, b) => b.start_at.localeCompare(a.start_at));
        if (closed.length) {
          found = { bu: code, period: closed[0].period };
          break;
        }
      }
      adminTest.skip(!found, "no TEST BU has a closed period — run the period-close suite (924) on one first");
      const { bu, period } = found!;
      const r = await rawSend("Admin", "GET", `/api/${bu}/activity-logs?entity_type=inventory_period&sort=-created_at&perpage=100`);
      expect(r.status).toBe(200);
      const entry = (r.body.data as { new_data?: { period?: string; status?: string }; actor_id?: string }[]).find(
        (e) => e.new_data?.period === period && e.new_data?.status === "closed",
      );
      expect(entry, `period ${period} close entry in the activity log of ${bu}`).toBeTruthy();
      expect(entry?.actor_id).toBeTruthy();
    },
  );
});
