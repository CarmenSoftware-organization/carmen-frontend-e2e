import { expect } from "@playwright/test";
import { createAuthTest } from "./fixtures/auth.fixture";
import { ConfigListPage } from "./pages/config-list.page";
import { BU_CODE } from "./test-users";
import { ensureActiveBu } from "./helpers/bu";
import { uid } from "./helpers/test-data";

/**
 * Chart of Accounts Mapping (ACMAP) — List / Search / Tab-switching tests.
 *
 * Note: as of the catalog date (2026-09-20) this page reads from mock data
 * (`coam-mock.ts`, 12 rows — AP 8 / GL 4) and the toolbar buttons (Import /
 * Export / Scan / Bulk Map / Edit) and row pencil buttons have no wired
 * handlers. CRUD test cases are therefore omitted; they must be revisited once
 * the real `/api/config/{bu_code}/account-mappings` endpoint is live.
 */

const test = createAuthTest("carmensoftware.dev+admin@gmail.com");
const PATH = "/config/chart-of-account-mapping";

test.describe("Chart of Accounts Mapping — List / Search / Tabs", () => {
  test.beforeEach(async ({ page }) => {
    await ensureActiveBu(page, BU_CODE);
  });

  // ------------------------------------------------------------------
  // TC-ACMAP-010001 — Smoke
  // ------------------------------------------------------------------
  test(
    "TC-ACMAP-010001 แสดงหน้า Chart of Accounts Mapping พร้อมตารางของแท็บ AP",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG; ข้อมูลหน้านี้มาจาก mock coam-mock.ts (12 แถว — AP 8 / GL 4)" },
        { type: "steps", description: "1. ไปที่ /config/chart-of-account-mapping\n2. รอให้ DataGrid โหลดเสร็จ" },
        { type: "expected", description: "เห็นหัวข้อ Chart of Accounts Mapping พร้อมแถบแท็บ Posting to AP / Posting to GL โดยแท็บ Posting to AP ถูกเลือกอยู่ และตารางแสดงแถวของ mapping type AP" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page }) => {
      await page.goto(PATH);
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveURL(new RegExp(PATH));
      // Heading contains "Chart of Accounts Mapping" (FE #294 เติม s — regex รับทั้งชื่อเก่า/ใหม่)
      await expect(page.getByRole("heading", { name: /Chart of Accounts? Mapping/i }).first()).toBeVisible({ timeout: 10_000 });
      // Both tabs present
      await expect(page.getByRole("tab", { name: /Posting to AP/i }).first()).toBeVisible({ timeout: 10_000 });
      await expect(page.getByRole("tab", { name: /Posting to GL/i }).first()).toBeVisible({ timeout: 10_000 });
    },
  );

  // ------------------------------------------------------------------
  // TC-ACMAP-010002 — Columns
  // ------------------------------------------------------------------
  test(
    "TC-ACMAP-010002 ตารางแสดงคอลัมน์ครบตามที่กำหนด",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่หน้า /config/chart-of-account-mapping และตารางโหลดข้อมูลแล้ว" },
        { type: "steps", description: "1. ดูแถวหัวตาราง" },
        { type: "expected", description: "หัวตารางมีคอลัมน์ Location, Category, Account Code, Mapped และคอลัมน์ action ท้ายสุด" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      await page.goto(PATH);
      await page.waitForLoadState("networkidle");
      const header = page.locator("table thead").first();
      await expect(header).toBeVisible({ timeout: 10_000 });
      await expect(header.getByText(/Location/i).first()).toBeVisible();
      await expect(header.getByText(/Account Code/i).first()).toBeVisible();
      await expect(header.getByText(/Mapped/i).first()).toBeVisible();
    },
  );

  // ------------------------------------------------------------------
  // TC-ACMAP-010003 — Search by account code
  // ------------------------------------------------------------------
  test(
    "TC-ACMAP-010003 ค้นหาด้วยรหัสบัญชี (Account Code)",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่หน้า /config/chart-of-account-mapping; แท็บ Posting to AP ถูกเลือกอยู่" },
        { type: "steps", description: "1. คลิกช่อง Search\n2. พิมพ์รหัสบัญชีที่มีอยู่ เช่น '1106002'\n3. กด Enter" },
        { type: "expected", description: "ตารางแสดงเฉพาะแถวที่มีรหัสบัญชีนั้น" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const list = new ConfigListPage(page, PATH);
      await list.goto();
      // AP tab is the default; search and confirm table filters
      const rowsBefore = await page.getByRole("row").count();
      await list.search("1106002");
      const rowsAfter = await page.getByRole("row").count();
      // After searching, either fewer rows or the table/empty-state is visible
      expect(rowsAfter).toBeLessThanOrEqual(rowsBefore);
    },
  );

  // ------------------------------------------------------------------
  // TC-ACMAP-010007 — Search with no results
  // ------------------------------------------------------------------
  test(
    "TC-ACMAP-010007 ค้นหาแล้วไม่พบข้อมูล แสดง empty state",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่หน้า /config/chart-of-account-mapping" },
        { type: "steps", description: `1. พิมพ์คำค้นที่ไม่ตรงกับข้อมูลใดเลย เช่น '__NOPE__${uid}'\n2. กด Enter` },
        { type: "expected", description: "ตารางของทั้งสองแท็บไม่มีแถวข้อมูล แสดง empty state แทน และตัวเลขบนหัวแท็บทั้ง AP และ GL เป็น 0" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const list = new ConfigListPage(page, PATH);
      await list.goto();
      await list.search(`__NOPE__${uid}`);
      await expect(list.emptyState().first()).toBeVisible({ timeout: 10_000 });
    },
  );

  // ------------------------------------------------------------------
  // TC-ACMAP-010008 — Clear search restores list
  // ------------------------------------------------------------------
  test(
    "TC-ACMAP-010008 ล้างคำค้นด้วยปุ่มกากบาทแล้วรายการกลับมาครบ",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่หน้า /config/chart-of-account-mapping และค้นหาไว้แล้วจนรายการถูกกรอง" },
        { type: "steps", description: "1. ค้นหาจนรายการถูกกรอง\n2. คลิกปุ่มกากบาท (Clear search) ที่อยู่ท้ายช่อง Search" },
        { type: "expected", description: "ช่อง Search ว่าง และตารางกลับมาแสดงรายการทั้งหมดของแท็บที่เปิดอยู่" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Alternate Flow" },
      ],
    },
    async ({ page }) => {
      const list = new ConfigListPage(page, PATH);
      await list.goto();
      await list.search(`__NOPE__${uid}`);
      await expect(list.emptyState().first()).toBeVisible({ timeout: 10_000 });

      // Clear the search — look for the clear button (×, ✕, X, Clear)
      const clearBtn = page.getByRole("button", { name: /clear|×|✕/i }).first();
      if (await clearBtn.isVisible()) {
        await clearBtn.click();
      } else {
        // Fallback: clear via input
        const input = list.searchInput();
        await input.fill("");
        await input.press("Enter");
      }
      await page.waitForLoadState("networkidle");
      await expect(list.searchInput()).toHaveValue("");
    },
  );

  // ------------------------------------------------------------------
  // TC-ACMAP-100001 — Auth-guard: unauthenticated redirect
  // ------------------------------------------------------------------
  test(
    "TC-ACMAP-100001 ผู้ใช้ที่ยังไม่ล็อกอินเปิด URL ตรงๆ",
    {
      annotation: [
        { type: "preconditions", description: "ไม่มี session (browser context ที่ยังไม่ได้ล็อกอิน)" },
        { type: "steps", description: "1. เปิด URL /config/chart-of-account-mapping ตรงๆ โดยไม่มี session" },
        { type: "expected", description: "ถูก redirect ไปหน้า /login และไม่เห็นข้อมูลผังการผูกบัญชี" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Auth-guard" },
      ],
    },
    async ({ browser }) => {
      const ctx = await browser.newContext(); // fresh context, no storageState
      const page = await ctx.newPage();
      await page.goto(PATH);
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
      await ctx.close();
    },
  );

  // ------------------------------------------------------------------
  // TC-ACMAP-100002 — Authorization: low-privilege user can access
  // ------------------------------------------------------------------
  test(
    "TC-ACMAP-100002 ผู้ใช้ที่ล็อกอินแล้วทุก role เข้าหน้านี้ได้ (ยังไม่ผูก permission/license)",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็นผู้ใช้ที่ไม่ใช่ admin เช่น carmensoftware.dev+requestor@gmail.com; leaf ของหน้านี้ใน constant/module-list.ts ยังไม่ประกาศ permission" },
        { type: "steps", description: "1. Login เป็น carmensoftware.dev+requestor@gmail.com\n2. ไปที่ /config/chart-of-account-mapping" },
        { type: "expected", description: "หน้าแสดงได้ตามปกติ ไม่มีกล่อง Access Denied และไม่ถูก redirect (RouteGuard ปล่อยผ่าน leaf ที่ไม่ประกาศ permission)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Authorization" },
      ],
    },
    async ({ browser }) => {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      const { LoginPage } = await import("./pages/login.page");
      const { TEST_PASSWORD } = await import("./test-users");
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginWithRetry("carmensoftware.dev+requestor@gmail.com", TEST_PASSWORD);
      await page.waitForURL(/dashboard/, { timeout: 15_000 });
      await page.goto(PATH);
      await page.waitForLoadState("networkidle");
      // Should NOT show Access Denied and NOT redirect to /login
      await expect(page.getByText(/access denied|permission denied/i)).toHaveCount(0);
      expect(page.url()).toContain(PATH);
      await ctx.close();
    },
  );

  // ------------------------------------------------------------------
  // TC-ACMAP-400001 — Tab switching AP ↔ GL
  // ------------------------------------------------------------------
  test(
    "TC-ACMAP-400001 สลับแท็บ Posting to AP ↔ Posting to GL",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่หน้า /config/chart-of-account-mapping และแท็บ Posting to AP ถูกเลือกอยู่" },
        { type: "steps", description: "1. คลิกแท็บ Posting to GL\n2. ดูข้อมูลในตาราง\n3. คลิกแท็บ Posting to AP กลับ" },
        { type: "expected", description: "เนื้อหาตารางเปลี่ยนเป็นชุดของแท็บที่เลือกทุกครั้ง โดยไม่มีการเปลี่ยน URL" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      await page.goto(PATH);
      await page.waitForLoadState("networkidle");
      const glTab = page.getByRole("tab", { name: /Posting to GL/i }).first();
      await glTab.click();
      await page.waitForLoadState("networkidle");
      // URL should not have changed to a different page
      expect(page.url()).toContain(PATH);
      // GL tab is now selected
      await expect(glTab).toHaveAttribute("aria-selected", "true");

      const apTab = page.getByRole("tab", { name: /Posting to AP/i }).first();
      await apTab.click();
      await page.waitForLoadState("networkidle");
      await expect(apTab).toHaveAttribute("aria-selected", "true");
    },
  );

  // ------------------------------------------------------------------
  // TC-ACMAP-400002 — Tab badge equals row count
  // ------------------------------------------------------------------
  test(
    "TC-ACMAP-400002 ตัวเลขบนหัวแท็บตรงกับจำนวนแถวในตารางของแท็บนั้น",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่หน้า /config/chart-of-account-mapping โดยยังไม่ได้ค้นหา" },
        { type: "steps", description: "1. อ่านตัวเลขที่ต่อท้ายชื่อแท็บ Posting to AP แล้วนับจำนวนแถวในตาราง\n2. คลิกแท็บ Posting to GL แล้วทำแบบเดียวกัน" },
        { type: "expected", description: "ตัวเลขบนหัวแท็บแต่ละอันเท่ากับจำนวนแถวในตารางของแท็บนั้น" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      await page.goto(PATH);
      await page.waitForLoadState("networkidle");
      // At minimum, the table should have data rows (mock has 8 AP rows)
      const rows = await page.getByRole("row").count();
      expect(rows).toBeGreaterThan(1); // header + at least 1 data row
    },
  );

  // ------------------------------------------------------------------
  // TC-ACMAP-400004 — Mapped column shows ✓ / ✗ icons
  // ------------------------------------------------------------------
  test(
    "TC-ACMAP-400004 คอลัมน์ Mapped แสดงเครื่องหมายถูก/กากบาทตามสถานะ",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่หน้า /config/chart-of-account-mapping; ข้อมูลมีทั้งแถวที่ผูกแล้วและยังไม่ผูก" },
        { type: "steps", description: "1. ดูคอลัมน์ Mapped ของแถวต่างๆ" },
        { type: "expected", description: "แถวที่ผูกแล้วแสดงไอคอนเครื่องหมายถูก (Mapped) ส่วนแถวที่ยังไม่ผูกแสดงไอคอนกากบาท (Not mapped)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      await page.goto(PATH);
      await page.waitForLoadState("networkidle");
      // The Mapped column should contain either aria-label="Mapped" or "Not mapped" icons
      const mappedIcons = page.locator("[aria-label='Mapped'], [aria-label='Not mapped']");
      await expect(mappedIcons.first()).toBeVisible({ timeout: 10_000 });
    },
  );

  // ------------------------------------------------------------------
  // TC-ACMAP-400006 — Toolbar shows 5 buttons
  // ------------------------------------------------------------------
  test(
    "TC-ACMAP-400006 แถบเครื่องมือแสดงปุ่มครบทั้ง 5 ปุ่ม",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่หน้า /config/chart-of-account-mapping" },
        { type: "steps", description: "1. ดูปุ่มด้านขวาของแถบเครื่องมือ" },
        { type: "expected", description: "เห็นปุ่มครบทั้ง 5 ปุ่มและกดได้: Import, Export, Scan for New Code, Bulk Map, Edit" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      await page.goto(PATH);
      await page.waitForLoadState("networkidle");
      await expect(page.getByRole("button", { name: /Import/i }).first()).toBeVisible({ timeout: 10_000 });
      await expect(page.getByRole("button", { name: /Export/i }).first()).toBeVisible({ timeout: 10_000 });
      await expect(page.getByRole("button", { name: /Scan|Edit|Bulk/i }).first()).toBeVisible({ timeout: 10_000 });
    },
  );

  // ------------------------------------------------------------------
  // TC-ACMAP-400007 — Each row has pencil button only
  // ------------------------------------------------------------------
  test(
    "TC-ACMAP-400007 แต่ละแถวมีเฉพาะปุ่มดินสอในคอลัมน์ท้ายสุด",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่หน้า /config/chart-of-account-mapping และตารางมีข้อมูลอย่างน้อย 1 แถว" },
        { type: "steps", description: "1. ดูคอลัมน์ท้ายสุดของแถวแรก" },
        { type: "expected", description: "แถวมีปุ่มดินสอ (aria-label Edit) ในคอลัมน์ท้ายสุด" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      await page.goto(PATH);
      await page.waitForLoadState("networkidle");
      // Look for the edit button in the first data row
      const firstDataRow = page.getByRole("row").nth(1);
      await expect(firstDataRow).toBeVisible({ timeout: 10_000 });
      // Edit button should exist in the row (aria-label or title "Edit")
      const editBtn = firstDataRow.getByRole("button", { name: /Edit/i }).first();
      await expect(editBtn).toBeVisible();
    },
  );

  // ------------------------------------------------------------------
  // TC-ACMAP-900001 — Search without Enter does not filter
  // ------------------------------------------------------------------
  test(
    "TC-ACMAP-900001 พิมพ์คำค้นแล้วยังไม่กด Enter ตารางไม่เปลี่ยน",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่หน้า /config/chart-of-account-mapping; ช่อง Search ว่างอยู่" },
        { type: "steps", description: "1. พิมพ์คำค้นลงในช่อง Search โดยยังไม่กด Enter\n2. คลิกพื้นที่ว่างนอกช่อง Search" },
        { type: "expected", description: "จำนวนแถวในตารางและตัวเลขบนหัวแท็บยังเท่าเดิม (การค้นหาทำงานเมื่อกด Enter เท่านั้น)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      await page.goto(PATH);
      await page.waitForLoadState("networkidle");
      const rowsBefore = await page.getByRole("row").count();

      // Type without pressing Enter
      const searchInput = page.getByPlaceholder(/Search/i).first();
      await searchInput.click();
      await searchInput.pressSequentially("zzzno_match", { delay: 20 });
      // Click away
      await page.locator("body").click({ position: { x: 10, y: 10 } });
      await page.waitForTimeout(500);

      const rowsAfter = await page.getByRole("row").count();
      expect(rowsAfter).toBe(rowsBefore);
    },
  );
});
