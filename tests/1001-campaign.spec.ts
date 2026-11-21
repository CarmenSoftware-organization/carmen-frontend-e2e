import { expect, type Page } from "@playwright/test";
import { createAuthTest } from "./fixtures/auth.fixture";
import { CampaignPage, LIST_PATH } from "./pages/campaign.page";
import { BU_CODE } from "./test-users";
import { ensureActiveBu, getBusinessUnits, defaultBu } from "./helpers/bu";
import { BuSwitcherPage } from "./pages/bu-switcher.page";
import { uid } from "./helpers/test-data";
import { field, pickDate, pickLookup } from "./helpers/movement/ui";

// ─────────────────────────────────────────────────────────────────────────
// Request for Pricing (a.k.a. "Campaign") — master-data group, Task 2.
//
// FE reality (carmen-frontend routes/vendor-management/request-price-list, 70be9b6e / 73556698):
//   - list: search, template/date filter, rows open the record; Export / Print / New Price Request
//   - /new and /:id are ONE single-page form (name, template, start/end date, vendors, custom
//     message). The old 4-step wizard (priority → template → vendors → launch) is gone.
//   - there is no status filter, priority, duplicate, reminder, mark-as-expired or per-week quota.
//     The "status" is derived from the request window (Upcoming / N days left / Closed).
//   - Seeded by `bun run data:reset` (STD campaign.draft / .active / .expired, one vendor each).
//
// Purchase = carmensoftware.dev+purchase@gmail.com (full vendor_management.request_price_list.*).
// Permission seed on dev (checked via /api/user/profile): EVERY role holds ...request_price_list.view, and
// only purchase@ and requestor@ hold create/update/delete. So "denied view" cannot be exercised with this
// data (env-data) — the permission cases use hod@ (view-only) to check what a view-only role sees. FE
// does not hide Edit / Delete / New for a view-only role: that is the pinned suspected bug.
// ─────────────────────────────────────────────────────────────────────────
const viewOnlyTest = createAuthTest("carmensoftware.dev+hod@gmail.com"); // request_price_list.view only
const purchaseTest = createAuthTest("carmensoftware.dev+purchase@gmail.com");

const SEED_ACTIVE = "STD campaign.active";
const SEED_DRAFT = "STD campaign.draft";
const SEED_TEMPLATE = "STD campaign template";

const iso = (offsetDays: number) => {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const RFP_NAME = `E2E RFP ${uid}`;
const RFP_NAME_EDITED = `E2E RFP edited ${uid}`;

/** Open the detail page of the seeded campaign called `name`. */
async function openSeeded(page: Page, name: string) {
  const cam = new CampaignPage(page);
  await cam.gotoList();
  await page.getByRole("button", { name, exact: true }).click({ timeout: 10_000 });
  await expect(page).toHaveURL(/request-price-list\/[0-9a-f-]{36}/, { timeout: 10_000 });
  await page.waitForLoadState("networkidle");
  // Wait for the record itself — "button is absent" assertions pass on a half-rendered page.
  await expect(page.getByText(SEED_TEMPLATE).first()).toBeVisible({ timeout: 15_000 });
}

/** Fill the single-page create form (no vendors) and press Create. */
async function createRfp(page: Page, name: string) {
  const cam = new CampaignPage(page);
  await cam.gotoNew();
  await page.locator("#rfp-name").fill(name);
  await pickLookup(page, field(page, "Template").locator("button").first(), "STD campaign");
  expect(await pickDate(page, field(page, "Start Date").locator("button").first(), iso(10))).toBe(true);
  expect(await pickDate(page, field(page, "End Date").locator("button").first(), iso(40))).toBe(true);
  await page.getByRole("button", { name: /^Create$/ }).click();
}

/**
 * Make sure the E2E record named `name` exists (the worker may have restarted, so `uid` can differ)
 * and leave the page on the list filtered to it.
 */
async function ensureRfp(page: Page, name: string) {
  const cam = new CampaignPage(page);
  const row = () => page.getByRole("button", { name, exact: true }).first();
  const filterToName = async () => {
    await cam.gotoList();
    await cam.searchInput().fill(name);
    await cam.searchInput().press("Enter");
    await page.waitForLoadState("networkidle");
  };
  await filterToName();
  const found = await row()
    .waitFor({ state: "visible", timeout: 5_000 })
    .then(() => true)
    .catch(() => false);
  if (found) return;
  await createRfp(page, name);
  await expect(page.getByText(/created successfully/i).first()).toBeVisible({ timeout: 15_000 });
  await filterToName();
  await expect(row()).toBeVisible({ timeout: 10_000 });
}

// ═════════════════════════════════════════════════════════════════════════
// List
// ═════════════════════════════════════════════════════════════════════════
purchaseTest.describe("Campaign — List", () => {
  purchaseTest(
    "TC-CAM-010001 View Campaign List - Happy Path",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+purchase@gmail.com; BU มี campaign STD ที่ data:reset สร้างไว้ 3 รายการ (draft / active / expired)" },
        { type: "steps", description: "1. ไปที่ /vendor-management/request-price-list\n2. ตรวจสอบตารางแสดง campaign ที่ seed ไว้\n3. คลิกชื่อ 'STD campaign.active'" },
        { type: "expected", description: "ตารางแสดงแถว STD campaign.draft / .active / .expired; คลิกชื่อแล้วไปหน้า /request-price-list/<id> ที่แสดงชื่อ campaign และสถานะรอบ 'days left'" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const cam = new CampaignPage(page);
      await cam.gotoList();
      await expect(page).toHaveURL(/request-price-list/);
      for (const name of [SEED_DRAFT, SEED_ACTIVE, "STD campaign.expired"]) {
        await expect(page.getByRole("button", { name, exact: true }), `seeded row ${name} (bun run data:reset)`).toBeVisible({ timeout: 15_000 });
      }
      await page.getByRole("button", { name: SEED_ACTIVE, exact: true }).click();
      await expect(page).toHaveURL(/request-price-list\/[0-9a-f-]{36}/, { timeout: 10_000 });
      await expect(page.getByText(SEED_ACTIVE).first()).toBeVisible();
      await expect(page.getByText(/days? left/i).first()).toBeVisible();
    },
  );
});

purchaseTest.describe("Campaign — List — empty search", () => {
  purchaseTest(
    "TC-CAM-010003 View Campaign List - Empty Campaign List",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+purchase@gmail.com; BU มี campaign STD (ใช้การค้นหาที่ไม่มีผลลัพธ์แทนรายการว่างจริง เพื่อไม่ลบ campaign ที่ seed ไว้)" },
        { type: "steps", description: "1. ไปที่ /vendor-management/request-price-list\n2. พิมพ์คำค้นที่ไม่ตรงกับ campaign ใดแล้วกด Enter" },
        { type: "expected", description: "ตารางไม่มี campaign (ไม่มีแถวที่เปิดได้) และแสดงข้อความ empty state 'No data found'" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      const cam = new CampaignPage(page);
      await cam.gotoList();
      await expect(page.getByRole("button", { name: SEED_ACTIVE, exact: true })).toBeVisible({ timeout: 15_000 });
      await cam.searchInput().fill(`__EMPTY_${uid}__`);
      await cam.searchInput().press("Enter");
      await expect(page.getByText(/no data found/i).first()).toBeVisible({ timeout: 10_000 });
      await expect(page.locator("tbody tr:has(button)")).toHaveCount(0);
    },
  );
});

viewOnlyTest.describe("Campaign — List — view-only role", () => {
  viewOnlyTest(
    "TC-CAM-010002 role ที่มีสิทธิ์ view อย่างเดียวเห็นรายการ Campaign",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+hod@gmail.com ซึ่งมีเฉพาะ vendor_management.request_price_list.view (ทุก role ใน seed มีสิทธิ์ view จึงทดสอบ 'ไม่มีสิทธิ์ดู' ไม่ได้)" },
        { type: "steps", description: "1. ไปที่ /vendor-management/request-price-list" },
        { type: "expected", description: "role ที่มีสิทธิ์ view อย่างเดียวเห็นรายการ campaign (แถว STD campaign.active)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Authorization" },
      ],
    },
    async ({ page }) => {
      await page.goto(LIST_PATH);
      await page.waitForLoadState("networkidle");
      await expect(page.getByRole("button", { name: SEED_ACTIVE, exact: true })).toBeVisible({ timeout: 15_000 });
    },
  );
});

// ═════════════════════════════════════════════════════════════════════════
// Create / Edit / Delete — one serial chain on a record this spec creates itself
// ═════════════════════════════════════════════════════════════════════════
purchaseTest.describe("Campaign — Create", () => {
  purchaseTest(
    "TC-CAM-020001 Happy Path - Create Campaign with All Valid Inputs",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+purchase@gmail.com; มี template 'STD campaign template'" },
        { type: "steps", description: "1. ไปที่ /vendor-management/request-price-list แล้วกด 'New Price Request'\n2. กรอก Name\n3. เลือก Template\n4. เลือก Start Date (อีก 10 วัน) และ End Date (อีก 40 วัน)\n5. กด 'Create'" },
        { type: "expected", description: "แสดง toast 'created successfully'; campaign ใหม่ค้นเจอในตารางหน้า list พร้อมสถานะรอบ 'Upcoming'" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const cam = new CampaignPage(page);
      await cam.gotoList();
      await cam.newCampaignButton().click();
      await expect(page).toHaveURL(/request-price-list\/new/);
      await createRfp(page, RFP_NAME);
      await expect(page.getByText(/created successfully/i).first()).toBeVisible({ timeout: 15_000 });
      await cam.gotoList();
      await cam.searchInput().fill(RFP_NAME);
      await cam.searchInput().press("Enter");
      await page.waitForLoadState("networkidle");
      const row = page.getByRole("row").filter({ hasText: RFP_NAME }).first();
      await expect(row).toBeVisible({ timeout: 10_000 });
      await expect(row).toContainText(/upcoming/i);
    },
  );

  purchaseTest(
    "TC-CAM-020002 Negative Path - Missing Required Fields",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+purchase@gmail.com; อยู่ที่ /vendor-management/request-price-list/new" },
        { type: "steps", description: "1. กรอกเฉพาะ Name\n2. กด 'Create' โดยไม่เลือก Template / Start Date / End Date" },
        { type: "expected", description: "ฟอร์มไม่ถูกบันทึก: ยังอยู่ที่ /new และ Template / Start Date / End Date แสดง error required" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const cam = new CampaignPage(page);
      await cam.gotoNew();
      await page.locator("#rfp-name").fill("Partial Campaign");
      await page.getByRole("button", { name: /^Create$/ }).click();
      await expect(page).toHaveURL(/request-price-list\/new/);
      await expect(cam.anyError().first()).toBeVisible({ timeout: 5_000 });
      await expect(page.getByText(/created successfully/i)).toHaveCount(0);
    },
  );
});

// ═════════════════════════════════════════════════════════════════════════
// Detail (read-only, against the seeded campaigns)
// ═════════════════════════════════════════════════════════════════════════
purchaseTest.describe("Campaign — Detail", () => {
  purchaseTest(
    "TC-CAM-030001 View active campaign detail",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+purchase@gmail.com; มี campaign 'STD campaign.active' (รอบรับราคากำลังเปิด)" },
        { type: "steps", description: "1. เปิดหน้า list แล้วคลิก 'STD campaign.active'" },
        { type: "expected", description: "หน้ารายละเอียดแสดงชื่อ, template 'STD campaign template', ช่วง Request Period, ป้าย 'N days left', ตาราง Vendors มี 1 แถว และปุ่ม Edit / Delete" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      await openSeeded(page, SEED_ACTIVE);
      await expect(page.getByText(SEED_TEMPLATE).first()).toBeVisible();
      await expect(page.getByText(/\d{4}-\d{2}-\d{2} - \d{4}-\d{2}-\d{2}/).first()).toBeVisible();
      await expect(page.getByText(/days? left/i).first()).toBeVisible();
      await expect(page.getByText(/0 of 1 vendor has submitted/i)).toBeVisible();
      await expect(page.getByRole("button", { name: /^Edit$/ })).toBeVisible();
      await expect(page.getByRole("button", { name: /^Delete$/ })).toBeVisible();
    },
  );

  purchaseTest(
    "TC-CAM-030003 Campaign detail with draft status",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+purchase@gmail.com; มี campaign 'STD campaign.draft' (รอบยังไม่เริ่ม)" },
        { type: "steps", description: "1. เปิดหน้า list แล้วคลิก 'STD campaign.draft'" },
        { type: "expected", description: "ป้ายสถานะรอบเป็น 'Upcoming' (ไม่ใช่ 'days left' หรือ 'Closed')" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Alternate Flow" },
      ],
    },
    async ({ page }) => {
      await openSeeded(page, SEED_DRAFT);
      await expect(page.getByText(/^upcoming$/i).first()).toBeVisible();
      await expect(page.getByText(/days? left/i)).toHaveCount(0);
    },
  );

  purchaseTest(
    "TC-CAM-030004 View campaign detail with empty performance summary",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+purchase@gmail.com; campaign STD ยังไม่มี vendor ตอบราคา" },
        { type: "steps", description: "1. เปิดรายละเอียด 'STD campaign.active'\n2. ดูสรุปส่วน Vendors" },
        { type: "expected", description: "สรุปแสดง '0 of 1 vendor has submitted prices' และคอลัมน์ Price List ของ vendor เป็น '—'" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      await openSeeded(page, SEED_ACTIVE);
      await expect(page.getByText(/0 of 1 vendor has submitted prices/i)).toBeVisible();
      await expect(page.getByRole("row").filter({ hasText: /pending/i }).first()).toContainText("—");
    },
  );

  purchaseTest(
    "TC-CAM-030005 Campaign detail with future start date",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+purchase@gmail.com; 'STD campaign.draft' เริ่มในอนาคต" },
        { type: "steps", description: "1. เปิดรายละเอียด 'STD campaign.draft'\n2. อ่านช่วง Request Period" },
        { type: "expected", description: "วันเริ่มต้นของ Request Period อยู่หลังวันนี้" },
        { type: "priority", description: "Low" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      await openSeeded(page, SEED_DRAFT);
      const text = await page.getByText(/\d{4}-\d{2}-\d{2} - \d{4}-\d{2}-\d{2}/).first().innerText();
      const start = text.match(/\d{4}-\d{2}-\d{2}/)![0];
      expect(start > iso(0), `start ${start} should be after today ${iso(0)}`).toBe(true);
    },
  );
});

viewOnlyTest.describe("Campaign — Detail — view-only role", () => {
  viewOnlyTest(
    "TC-CAM-030002 role ที่มีสิทธิ์ view อย่างเดียวเปิดรายละเอียด Campaign ได้",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+hod@gmail.com (view-only; ทุก role มีสิทธิ์ view)" },
        { type: "steps", description: "1. เปิดรายละเอียด 'STD campaign.active'" },
        { type: "expected", description: "role ที่มีสิทธิ์ view อย่างเดียวเปิดรายละเอียดและเห็นป้ายรอบ 'days left' กับสรุป vendor" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Authorization" },
      ],
    },
    async ({ page }) => {
      await openSeeded(page, SEED_ACTIVE);
      await expect(page.getByText(/days? left/i).first()).toBeVisible();
      await expect(page.getByText(/0 of 1 vendor has submitted/i)).toBeVisible();
    },
  );
});

// ═════════════════════════════════════════════════════════════════════════
// Edit — on the record TC-CAM-020001 creates
// ═════════════════════════════════════════════════════════════════════════
purchaseTest.describe("Campaign — Edit", () => {
  purchaseTest(
    "TC-CAM-040001 Edit Existing Campaign with Valid Data",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+purchase@gmail.com; มี campaign E2E ที่ TC-CAM-020001 สร้าง (สร้างให้ถ้ายังไม่มี)" },
        { type: "steps", description: "1. เปิดรายละเอียด campaign E2E\n2. กด 'Edit'\n3. เปลี่ยน Name\n4. กด 'Save'" },
        { type: "expected", description: "แสดง toast 'updated successfully' และชื่อใหม่ปรากฏในตารางหน้า list" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const cam = new CampaignPage(page);
      await ensureRfp(page, RFP_NAME);
      await page.getByRole("button", { name: RFP_NAME, exact: true }).first().click();
      await expect(page).toHaveURL(/request-price-list\/[0-9a-f-]{36}/, { timeout: 10_000 });
      await page.getByRole("button", { name: /^Edit$/ }).click();
      await page.locator("#rfp-name").fill(RFP_NAME_EDITED);
      await page.getByRole("button", { name: /^Save$/ }).click();
      await expect(page.getByText(/updated successfully/i).first()).toBeVisible({ timeout: 15_000 });
      await cam.gotoList();
      await cam.searchInput().fill(RFP_NAME_EDITED);
      await cam.searchInput().press("Enter");
      await expect(page.getByRole("button", { name: RFP_NAME_EDITED, exact: true })).toBeVisible({ timeout: 10_000 });
    },
  );

  purchaseTest(
    "TC-CAM-040002 Edit Campaign with Invalid Priority Value",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+purchase@gmail.com; อยู่ที่ฟอร์มสร้าง campaign (ไม่มีช่อง priority แล้ว — ใช้วันที่สิ้นสุดก่อนวันเริ่มแทน)" },
        { type: "steps", description: "1. ไปที่ /vendor-management/request-price-list/new\n2. กรอก Name และเลือก Template\n3. เลือก Start Date อีก 40 วัน แล้วเลือก End Date ก่อนหน้านั้น\n4. กด 'Create'" },
        { type: "expected", description: "ไม่บันทึก: ยังอยู่ที่ /new และช่อง End Date ถูกเลือกไม่ได้ย้อนก่อนวันเริ่ม (ปฏิทินปิดวันก่อน Start Date)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const cam = new CampaignPage(page);
      await cam.gotoNew();
      await page.locator("#rfp-name").fill(`E2E bad dates ${uid}`);
      await pickLookup(page, field(page, "Template").locator("button").first(), "STD campaign");
      expect(await pickDate(page, field(page, "Start Date").locator("button").first(), iso(40))).toBe(true);
      // End Date calendar starts at Start Date (fromDate) — an earlier day cannot be picked.
      expect(await pickDate(page, field(page, "End Date").locator("button").first(), iso(10))).toBe(false);
      await page.getByRole("button", { name: /^Create$/ }).click();
      await expect(page).toHaveURL(/request-price-list\/new/);
      await expect(page.getByText(/created successfully/i)).toHaveCount(0);
    },
  );

  purchaseTest(
    "TC-CAM-040004 Edit Campaign with No Data Changes",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+purchase@gmail.com; เปิดรายละเอียด 'STD campaign.active'" },
        { type: "steps", description: "1. กด 'Edit'\n2. ไม่แก้ไขอะไร\n3. กด 'Cancel'" },
        { type: "expected", description: "กลับสู่โหมดดู (มีปุ่ม Edit) โดยไม่มี dialog ยืนยันทิ้งการแก้ไข และไม่มี toast บันทึก" },
        { type: "priority", description: "Low" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      await openSeeded(page, SEED_ACTIVE);
      await page.getByRole("button", { name: /^Edit$/ }).click();
      await page.getByRole("button", { name: /^Cancel$/ }).click();
      await expect(page.getByRole("button", { name: /^Edit$/ })).toBeVisible({ timeout: 5_000 });
      await expect(page.getByRole("alertdialog")).toHaveCount(0);
      await expect(page.getByText(/updated successfully/i)).toHaveCount(0);
    },
  );
});

viewOnlyTest.describe("Campaign — Edit — view-only role", () => {
  viewOnlyTest(
    "TC-CAM-040003 Edit Campaign with No Permission",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+hod@gmail.com ซึ่งมีสิทธิ์ view แต่ไม่มี request_price_list.update" },
        { type: "steps", description: "1. เปิดรายละเอียด 'STD campaign.active'" },
        { type: "expected", description: "ไม่มีปุ่ม Edit (บั๊ก: ปัจจุบันปุ่ม Edit ยังแสดงและกดได้)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Authorization" },
      ],
    },
    async ({ page }) => {
      await openSeeded(page, SEED_ACTIVE);
      // The toolbar is rendered (Activity is there) — only then is "no Edit button" meaningful.
      await expect(page.getByRole("button", { name: /^Activity$/ })).toBeVisible();
      // Bug site: hod@ holds request_price_list.view only, yet the FE offers Edit.
      viewOnlyTest.fail(true, "suspected bug: a view-only role (hod@: request_price_list.view, no .update) sees an enabled Edit button on a Request for Pricing");
      await expect(page.getByRole("button", { name: /^Edit$/ })).toHaveCount(0);
    },
  );
});

// ═════════════════════════════════════════════════════════════════════════
// Delete — on the record this spec created
// ═════════════════════════════════════════════════════════════════════════
purchaseTest.describe("Campaign — Delete", () => {
  purchaseTest(
    "TC-CAM-080001 Happy Path - Delete Campaign",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+purchase@gmail.com; มี campaign E2E ที่สร้างเองโดยสเปคนี้ (สร้างให้ถ้ายังไม่มี) — ไม่แตะ campaign STD" },
        { type: "steps", description: "1. เปิดรายละเอียด campaign E2E\n2. กด 'Delete'\n3. ยืนยัน 'Delete' ใน dialog" },
        { type: "expected", description: "แสดง toast 'deleted successfully'; กลับหน้า list และ campaign E2E ไม่อยู่ในตารางอีก" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const cam = new CampaignPage(page);
      const target = RFP_NAME_EDITED;
      await ensureRfp(page, target);
      await page.getByRole("button", { name: target, exact: true }).first().click();
      await expect(page).toHaveURL(/request-price-list\/[0-9a-f-]{36}/, { timeout: 10_000 });
      await page.getByRole("button", { name: /^Delete$/ }).first().click();
      await cam.confirmDialogButton(/^delete$/i).click();
      await expect(page.getByText(/deleted successfully/i).first()).toBeVisible({ timeout: 15_000 });
      await cam.gotoList();
      await cam.searchInput().fill(target);
      await cam.searchInput().press("Enter");
      await page.waitForLoadState("networkidle");
      await expect(page.getByRole("button", { name: target, exact: true })).toHaveCount(0);
    },
  );
});

viewOnlyTest.describe("Campaign — Delete — view-only role", () => {
  viewOnlyTest(
    "TC-CAM-080004 Negative - No Permission",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+hod@gmail.com ซึ่งมีสิทธิ์ view แต่ไม่มี request_price_list.delete" },
        { type: "steps", description: "1. เปิดรายละเอียด 'STD campaign.active'" },
        { type: "expected", description: "ไม่มีปุ่ม Delete (บั๊ก: ปัจจุบันปุ่ม Delete ยังแสดงและกดได้)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Authorization" },
      ],
    },
    async ({ page }) => {
      await openSeeded(page, SEED_ACTIVE);
      await expect(page.getByRole("button", { name: /^Activity$/ })).toBeVisible();
      viewOnlyTest.fail(true, "suspected bug: a view-only role (hod@: request_price_list.view, no .delete) sees an enabled Delete button on a Request for Pricing");
      await expect(page.getByRole("button", { name: /^Delete$/ })).toHaveCount(0);
    },
  );
});

// ═════════════════════════════════════════════════════════════════════════
// Export
// ═════════════════════════════════════════════════════════════════════════
purchaseTest.describe("Campaign — Export", () => {
  purchaseTest(
    "TC-CAM-090001 Export campaign data - happy path",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+purchase@gmail.com; มี campaign อย่างน้อย 1 รายการ" },
        { type: "steps", description: "1. ไปที่ /vendor-management/request-price-list\n2. กด 'Export'" },
        { type: "expected", description: "เบราว์เซอร์ดาวน์โหลดไฟล์ .xlsx และแสดง toast ส่งออกสำเร็จ" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const cam = new CampaignPage(page);
      await cam.gotoList();
      await expect(cam.exportButton()).toBeVisible({ timeout: 10_000 });
      const [download] = await Promise.all([page.waitForEvent("download", { timeout: 30_000 }), cam.exportButton().click()]);
      expect(download.suggestedFilename()).toMatch(/\.xlsx$/i);
    },
  );

  purchaseTest(
    "TC-CAM-090004 Export campaign data - multiple exports",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+purchase@gmail.com; มี campaign อย่างน้อย 1 รายการ" },
        { type: "steps", description: "1. ไปที่ /vendor-management/request-price-list\n2. กด 'Export' 3 ครั้งติดกัน รอดาวน์โหลดทุกครั้ง" },
        { type: "expected", description: "ทุกครั้งดาวน์โหลดไฟล์ .xlsx สำเร็จ (ปุ่ม Export กลับมากดได้อีกหลังแต่ละครั้ง)" },
        { type: "priority", description: "Low" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      const cam = new CampaignPage(page);
      await cam.gotoList();
      for (let i = 0; i < 3; i++) {
        await expect(cam.exportButton()).toBeEnabled({ timeout: 15_000 });
        const [download] = await Promise.all([page.waitForEvent("download", { timeout: 30_000 }), cam.exportButton().click()]);
        expect(download.suggestedFilename()).toMatch(/\.xlsx$/i);
      }
    },
  );
});

purchaseTest.describe("Campaign — Export — large page", () => {
  purchaseTest(
    "TC-CAM-090003 Export campaign data - large dataset",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+purchase@gmail.com; มี campaign อย่างน้อย 1 รายการ" },
        { type: "steps", description: "1. ไปที่ /vendor-management/request-price-list\n2. ตั้ง Rows per page เป็น 100 (ขนาดหน้าสูงสุดของตาราง)\n3. กด 'Export'" },
        { type: "expected", description: "ดาวน์โหลดไฟล์ .xlsx ได้โดยไม่ crash และไฟล์มีขนาด > 0" },
        { type: "priority", description: "Low" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      const cam = new CampaignPage(page);
      await cam.gotoList();
      await page.getByRole("combobox", { name: /rows per page/i }).click();
      await page.getByRole("option", { name: "100", exact: true }).click();
      await page.waitForLoadState("networkidle");
      await expect(cam.exportButton()).toBeEnabled({ timeout: 10_000 });
      const [download] = await Promise.all([page.waitForEvent("download", { timeout: 30_000 }), cam.exportButton().click()]);
      expect(download.suggestedFilename()).toMatch(/\.xlsx$/i);
      const path = await download.path();
      expect(path, "downloaded file").toBeTruthy();
    },
  );
});

viewOnlyTest.describe("Campaign — Export — view-only role", () => {
  viewOnlyTest(
    "TC-CAM-090002 role ที่มีสิทธิ์ view อย่างเดียว export Campaign ได้ (ไม่มีสิทธิ์ export แยก)",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+hod@gmail.com (view-only; ไม่มีคีย์สิทธิ์ export แยก — export ตามสิทธิ์ view)" },
        { type: "steps", description: "1. ไปที่ /vendor-management/request-price-list\\n2. กด 'Export'" },
        { type: "expected", description: "role ที่มีสิทธิ์ view อย่างเดียว export ได้: ดาวน์โหลดไฟล์ .xlsx" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Authorization" },
      ],
    },
    async ({ page }) => {
      const cam = new CampaignPage(page);
      await cam.gotoList();
      await expect(cam.exportButton()).toBeEnabled({ timeout: 10_000 });
      const [download] = await Promise.all([page.waitForEvent("download", { timeout: 30_000 }), cam.exportButton().click()]);
      expect(download.suggestedFilename()).toMatch(/\.xlsx$/i);
    },
  );
});

// ═════════════════════════════════════════════════════════════════════════
// Search
// ═════════════════════════════════════════════════════════════════════════
purchaseTest.describe("Campaign — Search", () => {
  purchaseTest(
    "TC-CAM-100002 Search by Text - Valid Term",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+purchase@gmail.com; มี campaign STD 3 รายการ" },
        { type: "steps", description: "1. ไปที่ /vendor-management/request-price-list\n2. พิมพ์ 'STD campaign.active' ในช่อง Search แล้วกด Enter" },
        { type: "expected", description: "ตารางเหลือ 'STD campaign.active' และไม่แสดง .draft / .expired" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const cam = new CampaignPage(page);
      await cam.gotoList();
      await cam.searchInput().fill(SEED_ACTIVE);
      await cam.searchInput().press("Enter");
      await page.waitForLoadState("networkidle");
      await expect(page.getByRole("button", { name: SEED_ACTIVE, exact: true })).toBeVisible({ timeout: 10_000 });
      await expect(page.getByRole("button", { name: SEED_DRAFT, exact: true })).toHaveCount(0);
    },
  );

  purchaseTest(
    "TC-CAM-100004 Search by Text - No Matching Terms",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+purchase@gmail.com และอยู่ที่หน้า Campaigns" },
        { type: "steps", description: "1. พิมพ์ 'NonexistentTerm' ใน search input แล้วกด Enter\n2. ตรวจสอบว่าไม่มี campaign แสดง" },
        { type: "expected", description: "ไม่มี campaign แสดงและเห็น empty state" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const cam = new CampaignPage(page);
      await cam.gotoList();
      await cam.searchInput().fill("__NONEXISTENT_CAM_TERM__");
      await cam.searchInput().press("Enter");
      await expect(cam.emptyState()).toBeVisible({ timeout: 10_000 });
    },
  );
});

// ── carmensoftware.dev+admin@gmail.com + BLAVG ──────────────────────────────────────────
// The describes above run as purchase/requestor (authz coverage) and are left
// untouched. Campaign create is a multi-step wizard (name/desc/priority/date →
// template → vendors → launch), so this block is intentionally LIGHT: BU
// precondition + BU-assert + a couple of hardened list/filter cases (no wizard
// create chain). See the procurement-trio rollout spec.
const adminTest = createAuthTest("carmensoftware.dev+admin@gmail.com");

adminTest.describe("Campaign — admin@BLAVG", () => {
  adminTest.beforeEach(async ({ page }) => {
    await ensureActiveBu(page, BU_CODE);
  });

  adminTest(
    "TC-CAM-010050 active BU = BLAVG",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com ผ่าน auth fixture; beforeEach เรียก ensureActiveBu(BLAVG) แล้ว" },
        { type: "steps", description: "1. อ่าน profile API (/api/proxy/api/user/profile)\n2. หา business unit ที่ is_default\n3. เปิดหน้าที่มี navbar แล้วอ่าน label ของ BU switcher" },
        { type: "expected", description: "default business unit มี code === 'BLAVG'; trigger ของ BU switcher ใน navbar แสดง label ของ BU นั้น" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page }) => {
      const units = await getBusinessUnits(page);
      const active = defaultBu(units);
      expect(active?.code).toBe(BU_CODE);

      const switcher = new BuSwitcherPage(page);
      await expect(switcher.trigger()).toContainText(active!.name, { timeout: 15_000 });
    },
  );

  adminTest(
    "TC-CAM-010051 หน้า list โหลดสำเร็จ (admin/BLAVG) + ปุ่ม Add แสดง",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG; มีสิทธิ์เข้าถึง Vendor Management" },
        { type: "steps", description: "1. ไปที่ /vendor-management/request-price-list\n2. ตรวจสอบ URL และ heading 'Request for Pricing'\n3. ตรวจสอบว่าปุ่ม 'Add Request' แสดง" },
        { type: "expected", description: "URL เป็น /vendor-management/request-price-list, heading 'Request for Pricing' แสดง, และปุ่ม Add แสดง (hard assert)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page }) => {
      const cam = new CampaignPage(page);
      await cam.gotoList();
      await expect(page).toHaveURL(/vendor-management\/request-price-list/);
      await expect(
        page.getByRole("heading", { name: /request for pricing/i }).first(),
      ).toBeVisible({ timeout: 15_000 });
      await expect(
        page.getByRole("button", { name: /new price request|add request|create new campaign|^add$/i }).first(),
      ).toBeVisible({ timeout: 10_000 });
    },
  );

  adminTest(
    "TC-CAM-010052 ค้นหาคำที่ไม่มี → empty state",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG; มีสิทธิ์เข้าถึง Request for Pricing" },
        { type: "steps", description: "1. ไปที่ /vendor-management/request-price-list\n2. กรอกคำค้นหาที่ไม่มีอยู่จริงในช่อง Search แล้วกด Enter\n3. ตรวจสอบว่าแสดง empty state" },
        { type: "expected", description: "ตารางแสดง empty state ('No data found') สำหรับคำค้นที่ไม่ตรง (hard assert)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const cam = new CampaignPage(page);
      await cam.gotoList();
      const search = cam.searchInput();
      await expect(search).toBeVisible({ timeout: 10_000 });
      await search.fill("__NONEXISTENT_E2E_CAM_KEYWORD__");
      // SearchInput only fires onSearch on Enter — not on change.
      await search.press("Enter");
      await expect(cam.emptyState()).toBeVisible({ timeout: 10_000 });
    },
  );
});
