import { expect, type Page } from "@playwright/test";
import { createAuthTest } from "./fixtures/auth.fixture";
import { BU_CODE } from "./test-users";
import { ensureActiveBu } from "./helpers/bu";

/**
 * Wastage Reporting (WAST) — E2E Test Suite.
 *
 * Route: /store-operation/wastage-reporting
 * Prefix: WAST
 *
 * Current page (FE 675563d8 segmented status filter, 6a1e7042 dropped View/Filter, a87998c2
 * list-style table): read-only list of expired / expiring stock lots. Toolbar = SearchInput only;
 * the status filter is the All / Expired / Expiring radio group above the table (state in
 * `?status=`); the API sorts by expiry itself (no `sort`). The TEST BU holds no expiring lots
 * after data:reset, so cases that need rows answer the list endpoint with a fixed fixture
 * (route-mocked, stated in each case's preconditions) and the empty-state cases hit the real API.
 */

const test = createAuthTest("carmensoftware.dev+admin@gmail.com");
const requestorTest = createAuthTest("carmensoftware.dev+requestor@gmail.com");
const PATH = "/store-operation/wastage-reporting";
const API = "**/api/*/wastage-reporting*";

const lot = (n: number, over: Record<string, unknown> = {}) => ({
  grn_detail_item_id: `gdi-${n}`,
  grn_detail_id: `gd-${n}`,
  grn_id: `00000000-0000-4000-8000-00000000000${n}`,
  grn_no: `GRN-E2E-0${n}`,
  grn_date: "2026-10-01T00:00:00.000Z",
  product_id: `p-${n}`,
  product_code: `E2E-P${n}`,
  product_name: `E2E Product ${n}`,
  product_local_name: null,
  product_sku: null,
  inventory_unit: { id: "u1", name: "KG" },
  location_id: "l1",
  location_code: "E2E-LOC",
  location_name: "E2E Location",
  lot_no: `LOT-${n}`,
  expired_at: "2026-11-10T00:00:00.000Z",
  days_to_expiry: -3,
  status: "expired",
  received_qty: 10,
  remaining_qty: 4,
  cost_per_unit: 25,
  remaining_value: 100,
  ...over,
});
const EXPIRED = lot(1);
const EXPIRING = lot(2, { days_to_expiry: 5, status: "expiring", expired_at: "2026-11-18T00:00:00.000Z" });

/** Answer the list endpoint with `items`, honouring `status`/`page`/`perpage`; returns the captured request URLs. */
async function mockWastage(page: Page, items: ReturnType<typeof lot>[]) {
  const urls: URL[] = [];
  await page.route(API, async (route) => {
    const u = new URL(route.request().url());
    urls.push(u);
    const status = u.searchParams.get("status");
    const rows = status ? items.filter((i) => i.status === status) : items;
    const perpage = Number(u.searchParams.get("perpage") ?? 10);
    const pg = Number(u.searchParams.get("page") ?? 1);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: rows.slice((pg - 1) * perpage, pg * perpage),
        paginate: { total: rows.length, page: pg, perpage, pages: Math.max(1, Math.ceil(rows.length / perpage)) },
        summary: {
          total_items: items.length,
          expired_count: items.filter((i) => i.status === "expired").length,
          expiring_count: items.filter((i) => i.status === "expiring").length,
          total_qty_at_risk: 0,
          total_value_at_risk: items.reduce((s, i) => s + i.remaining_value, 0),
        },
      }),
    });
  });
  return urls;
}

const statusGroup = (page: Page) => page.getByRole("radiogroup", { name: /expiry status/i });
const heading = (page: Page) => page.getByRole("heading", { name: /Wastage Reporting/i }).first();

test.describe("Wastage Reporting — Store Operations", () => {
  test.beforeEach(async ({ page }) => {
    await ensureActiveBu(page, BU_CODE);
  });

  test(
    "TC-WAST-010001 หน้า list Wastage Reporting โหลดสำเร็จ",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Admin; active BU = TEST BU (GR2VYNKQ); BU มี license store_operations.wastage_reporting" },
        { type: "steps", description: "1. ไปที่ /store-operation/wastage-reporting" },
        { type: "expected", description: "URL ตรงกับ path; หัวข้อ 'Wastage Reporting' และคำอธิบาย 'within 30 days' แสดง; toolbar มีช่องค้นหา; มีกลุ่มปุ่มสถานะ All / Expired / Expiring; ไม่มีปุ่ม Filter/View/Add" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page }) => {
      await page.goto(PATH);
      await expect(page).toHaveURL(new RegExp(PATH));
      await expect(heading(page)).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(/expire within 30 days/i).first()).toBeVisible();
      await expect(page.getByPlaceholder(/Search/i).first()).toBeVisible();
      const group = statusGroup(page);
      await expect(group).toBeVisible();
      await expect(group.getByRole("radio")).toHaveCount(3);
      await expect(group.getByRole("radio", { name: /^All/ })).toBeChecked();
      await expect(page.getByRole("button", { name: /^(Filter|View|Add)\b/i })).toHaveCount(0);
    },
  );

  test(
    "TC-WAST-010002 คอลัมน์ตาราง (วันหมดอายุ/สินค้า/สถานที่/lot/GRN/จำนวนคงเหลือ/ต้นทุน/มูลค่า) แสดงครบ",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Admin; active BU = TEST BU (GR2VYNKQ); endpoint wastage-reporting ถูก mock ด้วย fixture (TEST BU ไม่มี lot ที่ใกล้หมดอายุหลัง data:reset); viewport 1920x1080 (ตารางแสดงครบทุกคอลัมน์)" },
        { type: "steps", description: "1. ไปที่ /store-operation/wastage-reporting\n2. ตรวจหัวตารางและเซลล์ของ lot ตัวอย่าง" },
        { type: "expected", description: "หัวตารางมี Expiry Date, Product, Location, Lot No., GRN No., Remaining Qty, Cost/Unit, Remaining Value และแถวแสดงค่าของ lot" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await mockWastage(page, [EXPIRED]);
      await page.goto(PATH);
      for (const name of ["Expiry Date", "Product", "Location", "Lot No.", "GRN No.", "Remaining Qty", "Cost/Unit", "Remaining Value"]) {
        await expect(page.getByRole("columnheader", { name: new RegExp(name.replace(".", "\\."), "i") })).toBeVisible();
      }
      const row = page.locator("tbody tr").filter({ hasText: "GRN-E2E-01" });
      await expect(row).toContainText("E2E Product 1");
      await expect(row).toContainText("E2E Location");
      await expect(row).toContainText("LOT-1");
      await expect(row).toContainText("3 days overdue");
    },
  );

  test(
    "TC-WAST-010004 ค้นหาด้วยการกด Enter ในช่อง Search ส่งคำค้นไปกรองที่ API",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Admin; active BU = TEST BU (GR2VYNKQ); endpoint wastage-reporting ถูก mock ด้วย fixture (TEST BU ไม่มี lot ที่ใกล้หมดอายุหลัง data:reset)" },
        { type: "steps", description: "1. ไปที่ /store-operation/wastage-reporting\n2. พิมพ์ 'E2E Product 2' ลงช่อง Search\n3. กด Enter" },
        { type: "expected", description: "URL เพิ่ม search=<คำค้น>; ยิง request ใหม่พร้อม search=<คำค้น>" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const urls = await mockWastage(page, [EXPIRED, EXPIRING]);
      await page.goto(PATH);
      await expect(page.locator("tbody tr").filter({ hasText: "GRN-E2E-01" })).toBeVisible();
      const input = page.getByPlaceholder(/Search/i).first();
      await input.fill("E2E Product 2");
      await input.press("Enter");
      await expect(page).toHaveURL(/search=E2E(\+|%20)Product(\+|%20)2/);
      await expect.poll(() => urls.some((u) => u.searchParams.get("search") === "E2E Product 2")).toBe(true);
    },
  );

  test(
    "TC-WAST-010005 ค้นหาคำที่ไม่มีต้องแสดง empty state",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Admin; active BU = TEST BU (GR2VYNKQ); ใช้ API จริง" },
        { type: "steps", description: "1. ไปที่ /store-operation/wastage-reporting\n2. พิมพ์คำค้นที่ไม่มีในระบบแล้วกด Enter" },
        { type: "expected", description: "ตารางไม่มีแถว lot และแสดง empty state 'Nothing matches “<คำค้น>”' พร้อมปุ่ม Clear search" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      await page.goto(PATH);
      const input = page.getByPlaceholder(/Search/i).first();
      await input.fill("NONEXISTENT_WASTAGE_LOT_9999");
      await input.press("Enter");
      await expect(page.getByText(/Nothing matches/i)).toContainText("NONEXISTENT_WASTAGE_LOT_9999");
      await expect(page.locator("tbody").getByRole("button", { name: /clear search/i })).toBeVisible();
      await expect(page.locator("tbody tr")).toHaveCount(1); // only the empty-state row
    },
  );

  test(
    "TC-WAST-010006 ตัวกรองสถานะ (Expired / Expiring) แบบ segmented กรองรายการได้จริง",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Admin; active BU = TEST BU (GR2VYNKQ); endpoint wastage-reporting ถูก mock ด้วย fixture (TEST BU ไม่มี lot ที่ใกล้หมดอายุหลัง data:reset); fixture มี lot หมดอายุ 1 และใกล้หมด 1" },
        { type: "steps", description: "1. ไปที่ /store-operation/wastage-reporting\n2. กดปุ่ม Expired ในกลุ่มสถานะ" },
        { type: "expected", description: "URL เป็น ?status=expired; ยิง request พร้อม status=expired; ปุ่ม Expired ถูกเลือก; ตารางเหลือเฉพาะ lot ที่หมดอายุ" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const urls = await mockWastage(page, [EXPIRED, EXPIRING]);
      await page.goto(PATH);
      await expect(page.locator("tbody tr").filter({ hasText: "GRN-E2E-02" })).toBeVisible();
      await statusGroup(page).getByRole("radio", { name: /^Expired/ }).click();
      await expect(page).toHaveURL(/status=expired/);
      await expect(statusGroup(page).getByRole("radio", { name: /^Expired/ })).toBeChecked();
      await expect(page.locator("tbody tr").filter({ hasText: "GRN-E2E-01" })).toBeVisible();
      await expect(page.locator("tbody tr").filter({ hasText: "GRN-E2E-02" })).toHaveCount(0);
      expect(urls.some((u) => u.searchParams.get("status") === "expired")).toBe(true);
    },
  );

  test(
    "TC-WAST-010007 pagination เปลี่ยนหน้าได้และ request ส่งหน้าใหม่",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Admin; active BU = TEST BU (GR2VYNKQ); endpoint wastage-reporting ถูก mock ด้วย fixture (TEST BU ไม่มี lot ที่ใกล้หมดอายุหลัง data:reset); fixture 12 lot (perpage 10 → 2 หน้า)" },
        { type: "steps", description: "1. ไปที่ /store-operation/wastage-reporting\n2. กดปุ่มหน้าถัดไป" },
        { type: "expected", description: "URL เพิ่ม page=2; ยิง request page=2; ตารางแสดงเฉพาะ lot ลำดับที่ 11-12" },
        { type: "priority", description: "Low" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const many = Array.from({ length: 12 }, (_, i) => lot(i + 1, { grn_no: `GRN-E2E-${String(i + 1).padStart(2, "0")}`, grn_id: `00000000-0000-4000-8000-0000000000${String(i + 1).padStart(2, "0")}` }));
      const urls = await mockWastage(page, many);
      await page.goto(PATH);
      await expect(page.locator("tbody tr").filter({ hasText: "GRN-E2E-01" })).toBeVisible();
      await expect(page.locator("tbody tr:has(button)")).toHaveCount(10);
      await page.getByRole("button", { name: /next page/i }).click();
      await expect(page).toHaveURL(/page=2/);
      await expect(page.locator("tbody tr").filter({ hasText: "GRN-E2E-11" })).toBeVisible();
      await expect(page.locator("tbody tr:has(button)")).toHaveCount(2);
      expect(urls.some((u) => u.searchParams.get("page") === "2")).toBe(true);
    },
  );

  test(
    "TC-WAST-010008 summary bar แสดงจำนวน All/Expired/Expiring และมูลค่าที่เสี่ยง",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Admin; active BU = TEST BU (GR2VYNKQ); endpoint wastage-reporting ถูก mock ด้วย fixture (TEST BU ไม่มี lot ที่ใกล้หมดอายุหลัง data:reset); fixture หมดอายุ 1 ใกล้หมด 1 (มูลค่ารวม 200)" },
        { type: "steps", description: "1. ไปที่ /store-operation/wastage-reporting\n2. ตรวจแถบสถานะเหนือตาราง" },
        { type: "expected", description: "ปุ่ม All=2, Expired=1, Expiring=1 และ Value at risk แสดง 200" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      await mockWastage(page, [EXPIRED, EXPIRING]);
      await page.goto(PATH);
      const group = statusGroup(page);
      await expect(group.getByRole("radio", { name: /^All\s*2$/ })).toBeVisible();
      await expect(group.getByRole("radio", { name: /^Expired\s*1$/ })).toBeVisible();
      await expect(group.getByRole("radio", { name: /^Expiring.*1$/ })).toBeVisible();
      await expect(page.getByText(/Value at risk/i).locator("xpath=..")).toContainText("200");
    },
  );

  test(
    "TC-WAST-010009 กดปุ่ม All ล้างตัวกรองสถานะที่เลือกไว้",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Admin; active BU = TEST BU (GR2VYNKQ); endpoint wastage-reporting ถูก mock ด้วย fixture (TEST BU ไม่มี lot ที่ใกล้หมดอายุหลัง data:reset)" },
        { type: "steps", description: "1. เปิดหน้าพร้อม ?status=expired\n2. กดปุ่ม All" },
        { type: "expected", description: "URL ไม่มี status; ตารางกลับมาแสดงทุกสถานะ; request ถัดมาไม่มี status" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const urls = await mockWastage(page, [EXPIRED, EXPIRING]);
      await page.goto(`${PATH}?status=expired`);
      await expect(page.locator("tbody tr").filter({ hasText: "GRN-E2E-02" })).toHaveCount(0);
      await expect(statusGroup(page).getByRole("radio", { name: /^Expired/ })).toBeChecked();
      const before = urls.length;
      await statusGroup(page).getByRole("radio", { name: /^All/ }).click();
      await expect(page).not.toHaveURL(/status=/);
      await expect(page.locator("tbody tr").filter({ hasText: "GRN-E2E-02" })).toBeVisible();
      expect(urls.slice(before).some((u) => !u.searchParams.has("status"))).toBe(true);
    },
  );

  test(
    "TC-WAST-010010 ตารางเรียงตามวันหมดอายุตายตัว — ไม่มีปุ่ม sort และ API ไม่ได้รับ sort",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Admin; active BU = TEST BU (GR2VYNKQ); endpoint wastage-reporting ถูก mock ด้วย fixture (TEST BU ไม่มี lot ที่ใกล้หมดอายุหลัง data:reset)" },
        { type: "steps", description: "1. ไปที่ /store-operation/wastage-reporting?sort=expired_at:desc\n2. ตรวจหัวตารางและ request" },
        { type: "expected", description: "หัวคอลัมน์ไม่มีปุ่ม sort; request ไป API ไม่มีพารามิเตอร์ sort" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const urls = await mockWastage(page, [EXPIRED, EXPIRING]);
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto(`${PATH}?sort=expired_at:desc`);
      await expect(page.locator("tbody tr").filter({ hasText: "GRN-E2E-01" })).toBeVisible();
      await expect(page.locator("thead").getByRole("button")).toHaveCount(0);
      expect(urls.length).toBeGreaterThan(0);
      expect(urls.every((u) => !u.searchParams.has("sort"))).toBe(true);
    },
  );

  test(
    "TC-WAST-010012 ปุ่ม Clear search ใน empty state คืนรายการทั้งหมด",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Admin; active BU = TEST BU (GR2VYNKQ); ใช้ API จริง" },
        { type: "steps", description: "1. ไปที่ /store-operation/wastage-reporting?search=SAMPLE\n2. กดปุ่ม Clear search" },
        { type: "expected", description: "ช่องค้นหาว่าง และ search ถูกล้างจาก URL" },
        { type: "priority", description: "Low" },
        { type: "testType", description: "Alternate Flow" },
      ],
    },
    async ({ page }) => {
      await page.goto(`${PATH}?search=SAMPLE`);
      const input = page.getByPlaceholder(/Search/i).first();
      await expect(input).toHaveValue("SAMPLE");
      await page.locator("tbody").getByRole("button", { name: /clear search/i }).click();
      await expect(input).toHaveValue("");
      await expect(page).not.toHaveURL(/search=SAMPLE/);
    },
  );

  test(
    "TC-WAST-010050 request ของหน้านี้ไปที่ BU ที่ active (TEST BU)",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Admin; active BU = TEST BU (GR2VYNKQ); ผู้ใช้ผูกกับ TEST BU" },
        { type: "steps", description: "1. ไปที่ /store-operation/wastage-reporting\n2. ตรวจ URL ของ request รายการ lot" },
        { type: "expected", description: "ยิง GET /api/GR2VYNKQ/wastage-reporting สำเร็จ (200)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page }) => {
      const resp = page.waitForResponse((r) => /\/api\/[^/]+\/wastage-reporting/.test(r.url()) && r.request().method() === "GET");
      await page.goto(PATH);
      const r = await resp;
      expect(r.url()).toContain(`/api/${BU_CODE}/wastage-reporting`);
      expect(r.status()).toBe(200);
    },
  );

  test(
    "TC-WAST-020001 กด GRN No. เปิดใบ GRN ต้นทาง",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Admin; active BU = TEST BU (GR2VYNKQ); endpoint wastage-reporting ถูก mock ด้วย fixture (TEST BU ไม่มี lot ที่ใกล้หมดอายุหลัง data:reset)" },
        { type: "steps", description: "1. ไปที่ /store-operation/wastage-reporting\n2. กดที่ GRN No. ของ lot" },
        { type: "expected", description: "นำทางไปยัง /procurement/goods-receive-note/{grn_id} ของ lot นั้น" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page }) => {
      await mockWastage(page, [EXPIRED]);
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto(PATH);
      await page.locator("tbody tr").filter({ hasText: "GRN-E2E-01" }).getByRole("button", { name: "GRN-E2E-01" }).click();
      await expect(page).toHaveURL(new RegExp(`/procurement/goods-receive-note/${EXPIRED.grn_id}`));
    },
  );

  test(
    "TC-WAST-020003 คลิกเซลล์อื่นหรือตัวแถวไม่นำทางออกจากหน้า",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Admin; active BU = TEST BU (GR2VYNKQ); endpoint wastage-reporting ถูก mock ด้วย fixture (TEST BU ไม่มี lot ที่ใกล้หมดอายุหลัง data:reset)" },
        { type: "steps", description: "1. คลิกที่เซลล์ Product และ Location\n2. ตรวจสอบ URL" },
        { type: "expected", description: "URL ยังคงเป็น /store-operation/wastage-reporting" },
        { type: "priority", description: "Low" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      await mockWastage(page, [EXPIRED]);
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto(PATH);
      const row = page.locator("tbody tr").filter({ hasText: "GRN-E2E-01" });
      await row.getByText("E2E Product 1").click();
      await row.getByText("E2E Location").click();
      await expect(page).toHaveURL(new RegExp(`${PATH}$`));
      await expect(row).toBeVisible();
    },
  );

  requestorTest(
    "TC-WAST-100001 ผู้ใช้ไม่มีสิทธิ์ stock_out.view ต้องเห็นกล่องปฏิเสธสิทธิ์",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Requestor (ไม่มี inventory_management.stock_out ใน /api/user/profile)" },
        { type: "steps", description: "1. เปิด /store-operation/wastage-reporting โดยตรง" },
        { type: "expected", description: "แสดงกล่อง Permission Denied และไม่แสดงตาราง lot" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Authorization" },
      ],
    },
    async ({ page }) => {
      await page.goto(PATH);
      await expect(page.getByText(/permission denied/i).first()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole("radiogroup", { name: /expiry status/i })).toHaveCount(0);
    },
  );

  test(
    "TC-WAST-100002 ผู้ที่ไม่ได้ login เข้าหน้าตรง ๆ ต้องถูก redirect ไป /login",
    {
      annotation: [
        { type: "preconditions", description: "ไม่มี session (browser context ใหม่)" },
        { type: "steps", description: "1. เปิด /store-operation/wastage-reporting ใน context ที่ไม่มี session" },
        { type: "expected", description: "ถูก redirect ไปยัง /login และไม่มีข้อมูล lot บนจอ" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Auth-guard" },
      ],
    },
    async ({ browser }) => {
      const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
      const page = await ctx.newPage();
      await page.goto(PATH);
      await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
      await expect(page.getByRole("radiogroup", { name: /expiry status/i })).toHaveCount(0);
      await ctx.close();
    },
  );

  test(
    "TC-WAST-100003 BU ที่มี license wastage_reporting เข้าหน้าและโหลดข้อมูลได้",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Admin; active BU = TEST BU (GR2VYNKQ); license store_operations.wastage_reporting ของ TEST BU" },
        { type: "steps", description: "1. เข้า /store-operation/wastage-reporting" },
        { type: "expected", description: "หน้าเปิดตามปกติ (ไม่มีกล่องปฏิเสธ license) และ endpoint ตอบ 200" },
        { type: "priority", description: "Low" },
        { type: "testType", description: "Authorization" },
      ],
    },
    async ({ page }) => {
      const resp = page.waitForResponse((r) => /\/api\/[^/]+\/wastage-reporting/.test(r.url()) && r.request().method() === "GET");
      await page.goto(PATH);
      expect((await resp).status()).toBe(200);
      await expect(heading(page)).toBeVisible();
      await expect(page.getByText(/permission denied|not licensed|license/i)).toHaveCount(0);
    },
  );

  test(
    "TC-WAST-900001 mobile: ตารางเป็นการ์ดเซลล์เดียว (สินค้า+GRN) และหน้าไม่ล้นแนวนอน",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Admin; active BU = TEST BU (GR2VYNKQ); endpoint wastage-reporting ถูก mock ด้วย fixture (TEST BU ไม่มี lot ที่ใกล้หมดอายุหลัง data:reset); viewport 375x667" },
        { type: "steps", description: "1. เปิด /store-operation/wastage-reporting ด้วย viewport 375x667" },
        { type: "expected", description: "แถวแสดงสินค้า/คลัง/lot/GRN ในเซลล์เดียว; ไม่มีหัวตาราง Cost/Unit; scrollWidth ของหน้าไม่เกินความกว้างจอ" },
        { type: "priority", description: "Low" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await mockWastage(page, [EXPIRED]);
      await page.goto(PATH);
      const row = page.locator("tbody tr").filter({ hasText: "GRN-E2E-01" });
      await expect(row).toContainText("E2E Product 1");
      await expect(row).toContainText("E2E Location");
      await expect(row).toContainText("LOT-1");
      await expect(page.getByRole("columnheader", { name: /Cost\/Unit/i })).toHaveCount(0);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    },
  );

  test(
    "TC-WAST-900002 API ล้มเหลวต้องแสดง ErrorState พร้อมปุ่มลองใหม่",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Admin; active BU = TEST BU (GR2VYNKQ)" },
        { type: "steps", description: "1. ตั้ง route interception ให้ endpoint ตอบ 500\n2. เปิด /store-operation/wastage-reporting\n3. ปลด interception แล้วกดปุ่มลองใหม่" },
        { type: "expected", description: "แสดง ErrorState พร้อมปุ่ม Try again และกดลองใหม่แล้วหัวข้อหน้า+ตารางกลับมา" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      await page.route(API, (route) =>
        route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "Internal Server Error" }) }),
      );
      await page.goto(PATH);
      const retry = page.getByRole("button", { name: /Try again|Retry/i }).first();
      await expect(retry).toBeVisible({ timeout: 15_000 });
      await expect(statusGroup(page)).toHaveCount(0);
      await page.unroute(API);
      await retry.click();
      await expect(heading(page)).toBeVisible({ timeout: 15_000 });
      await expect(statusGroup(page)).toBeVisible();
    },
  );
});
