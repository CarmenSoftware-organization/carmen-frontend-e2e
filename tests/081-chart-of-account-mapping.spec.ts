import { expect, type Page } from "@playwright/test";
import { createAuthTest } from "./fixtures/auth.fixture";
import { authFile } from "./fixtures/auth.paths";
import { ConfigListPage } from "./pages/config-list.page";
import { BU_CODE } from "./test-users";
import { ensureActiveBu } from "./helpers/bu";
import { uid } from "./helpers/test-data";

/**
 * Chart of Accounts Mapping (ACMAP) — List / Search / Tabs / Status filter.
 *
 * หน้านี้อ่าน API จริงแล้ว (`/api/:bu_code/account-mapping`) — แท็บ Post to AP /
 * Post to GL, status chips (Incomplete / Unreviewed / Overridden / Default),
 * ตารางแบ่งหน้า, เลือกหลายแถวเพื่อ Edit / Mark as reviewed และปุ่ม Generate
 * mapping rows. ไม่มีปุ่ม Import หรือดินสอรายแถวแล้ว (แก้รายแถวด้วยการคลิก Location)
 *
 * ตัวเคสอ่านอย่างเดียว — ไม่กด Save / Mark as reviewed เพราะเขียนลง DB ที่ใช้ร่วมกัน
 * ข้อยกเว้นเดียวคือ beforeAll: ถ้า BU ทดสอบยังไม่มีแถว mapping เลย จะกด Generate
 * mapping rows (โหมด Everything in advance, แท็บ AP) หนึ่งครั้งเพื่อสร้างแถว default
 * — idempotent: รอบถัดไปตารางไม่ว่างแล้วจึงไม่กดซ้ำ
 */

const ADMIN = "carmensoftware.dev+admin@gmail.com";
const test = createAuthTest(ADMIN);
const PATH = "/config/chart-of-account-mapping";

// context ที่ไม่มี session จริง ๆ — browser.newContext() ใน test ที่ใช้
// createAuthTest สืบทอด storageState ของ admin มาด้วย ต้องล้างทิ้งเอง
const NO_SESSION = { storageState: { cookies: [], origins: [] } };

// แถวข้อมูลจริงมี checkbox — แถว "No data found" ของตารางว่างไม่มี
const dataRows = (page: Page) =>
  page.locator("table tbody tr").filter({ has: page.getByRole("checkbox") });

const NO_DATA_REASON =
  "BU ทดสอบไม่มีแถว account mapping และ Generate (Everything in advance) สร้างไม่ได้ — BU ไม่มี location/item group";

// ตั้งใน beforeAll — เคสที่ต้องมีข้อมูลจะ skip พร้อมเหตุผลแทนการแดงแบบอ่านไม่ออก
let hasData = false;

async function gotoLoaded(page: Page) {
  await page.goto(PATH);
  await page.waitForLoadState("networkidle");
  await expect(
    dataRows(page).first().or(page.getByText(/no data found/i).first()),
  ).toBeVisible({ timeout: 15_000 });
}

/** จำนวนรวมจากแถบ pagination ("Showing 1–10 of 686") */
async function paginationTotal(page: Page): Promise<number> {
  const text = await page.locator("p", { hasText: /^Showing\b/ }).first().innerText();
  const m = text.match(/of\s+([\d,]+)/);
  if (!m) throw new Error(`pagination text not recognised: ${text}`);
  return Number(m[1].replace(/,/g, ""));
}

test.describe("Chart of Accounts Mapping — List / Search / Tabs", () => {
  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile(ADMIN) });
    const page = await ctx.newPage();
    await ensureActiveBu(page, BU_CODE);
    await gotoLoaded(page);
    if ((await dataRows(page).count()) === 0) {
      await page.getByRole("button", { name: /^Generate mapping rows$/i }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByRole("radio", { name: /Everything in advance/i }).click();
      await dialog.getByRole("button", { name: /^Generate mapping rows$/i }).click();
      await expect(page.getByText(/Created \d+ rows/i).first()).toBeVisible({ timeout: 30_000 });
      await gotoLoaded(page);
    }
    hasData = (await dataRows(page).count()) > 0;
    await ctx.close();
  });

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
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; active BU = GR2VYNKQ; BU มีแถว account mapping อย่างน้อย 1 แถว" },
        { type: "steps", description: "1. ไปที่ /config/chart-of-account-mapping\n2. รอให้ตารางโหลดเสร็จ" },
        { type: "expected", description: "เห็นหัวข้อ Chart of Accounts Mapping พร้อมแท็บ Post to AP / Post to GL โดยแท็บ Post to AP ถูกเลือกอยู่ และตารางมีข้อมูลอย่างน้อย 1 แถว" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page }) => {
      test.skip(!hasData, NO_DATA_REASON);
      await gotoLoaded(page);
      await expect(page).toHaveURL(new RegExp(PATH));
      // FE #294 เติม s — regex รับทั้งชื่อเก่า/ใหม่
      await expect(page.getByRole("heading", { name: /Chart of Accounts? Mapping/i }).first()).toBeVisible();
      const apTab = page.getByRole("tab", { name: /Post to AP/i }).first();
      await expect(apTab).toBeVisible();
      await expect(page.getByRole("tab", { name: /Post to GL/i }).first()).toBeVisible();
      await expect(apTab).toHaveAttribute("aria-selected", "true");
      await expect(dataRows(page).first()).toBeVisible();
    },
  );

  // ------------------------------------------------------------------
  // TC-ACMAP-010002 — Columns
  // ------------------------------------------------------------------
  test(
    "TC-ACMAP-010002 ตารางแสดงคอลัมน์ครบตามที่กำหนด",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่หน้า /config/chart-of-account-mapping แท็บ Post to AP และตารางโหลดข้อมูลแล้ว" },
        { type: "steps", description: "1. ดูแถวหัวตาราง" },
        { type: "expected", description: "หัวตารางมีคอลัมน์ Location, Location type, Category, Item Group, Movement, Cost center, Account และ Status" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      test.skip(!hasData, NO_DATA_REASON);
      await gotoLoaded(page);
      const header = page.locator("table thead").first();
      for (const name of [/^Location$/i, /Location type/i, /^Category$/i, /Item Group/i, /Movement/i, /Cost center/i, /^Account$/i, /^Status$/i]) {
        await expect(header.getByText(name).first(), `column ${name}`).toBeVisible();
      }
    },
  );

  // ------------------------------------------------------------------
  // TC-ACMAP-010003 — Search by location
  // ------------------------------------------------------------------
  test(
    "TC-ACMAP-010003 ค้นหาด้วยชื่อ Location",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่หน้า /config/chart-of-account-mapping แท็บ Post to AP และตารางมีข้อมูล" },
        { type: "steps", description: "1. อ่านชื่อ Location ของแถวแรก\n2. พิมพ์ชื่อนั้นในช่อง Search\n3. กด Enter" },
        { type: "expected", description: "จำนวนรวมในแถบ pagination ไม่เพิ่มขึ้น และทุกแถวในหน้าแรกเป็นของ Location นั้น" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      test.skip(!hasData, NO_DATA_REASON);
      await gotoLoaded(page);
      const totalBefore = await paginationTotal(page);
      const location = (await dataRows(page).first().getByRole("button").first().innerText()).trim();
      expect(location.length).toBeGreaterThan(0);

      const list = new ConfigListPage(page, PATH);
      await list.search(location);
      await expect(dataRows(page).first()).toBeVisible({ timeout: 10_000 });

      expect(await paginationTotal(page)).toBeLessThanOrEqual(totalBefore);
      const rows = await dataRows(page).all();
      for (const row of rows) {
        await expect(row).toContainText(location);
      }
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
        { type: "expected", description: "ตารางไม่มีแถวข้อมูล แสดง empty state แทน" },
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
      test.skip(!hasData, NO_DATA_REASON);
      const list = new ConfigListPage(page, PATH);
      await list.goto();
      await list.search(`__NOPE__${uid}`);
      await expect(list.emptyState().first()).toBeVisible({ timeout: 10_000 });

      const clearBtn = page.getByRole("button", { name: /clear|×|✕/i }).first();
      if (await clearBtn.isVisible()) {
        await clearBtn.click();
      } else {
        const input = list.searchInput();
        await input.fill("");
        await input.press("Enter");
      }
      await page.waitForLoadState("networkidle");
      await expect(list.searchInput()).toHaveValue("");
      await expect(dataRows(page).first()).toBeVisible({ timeout: 10_000 });
    },
  );

  // ------------------------------------------------------------------
  // TC-ACMAP-100001 — Auth-guard: unauthenticated redirect
  // ------------------------------------------------------------------
  test(
    "TC-ACMAP-100001 ผู้ใช้ที่ยังไม่ล็อกอินเปิด URL ตรงๆ",
    {
      annotation: [
        { type: "preconditions", description: "ไม่มี session (browser context ใหม่ที่ล้าง storageState ทิ้ง)" },
        { type: "steps", description: "1. เปิด URL /config/chart-of-account-mapping ตรงๆ โดยไม่มี session" },
        { type: "expected", description: "ถูก redirect ไปหน้า /login และไม่เห็นข้อมูลผังการผูกบัญชี" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Auth-guard" },
      ],
    },
    async ({ browser }) => {
      const ctx = await browser.newContext(NO_SESSION);
      const page = await ctx.newPage();
      await page.goto(PATH);
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
      await expect(page.locator("table tbody tr")).toHaveCount(0);
      await ctx.close();
    },
  );

  // ------------------------------------------------------------------
  // TC-ACMAP-100002 — Authorization: non-admin user
  // ------------------------------------------------------------------
  test(
    "TC-ACMAP-100002 ผู้ใช้ที่ไม่มีสิทธิ์ configuration.chart_of_account_mapping เห็น Permission Denied",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+requestor@gmail.com ซึ่ง role ไม่มีสิทธิ์ configuration.chart_of_account_mapping" },
        { type: "steps", description: "1. Login เป็น carmensoftware.dev+requestor@gmail.com\n2. ไปที่ /config/chart-of-account-mapping" },
        { type: "expected", description: "ยังอยู่ที่ URL /config/chart-of-account-mapping (ไม่ถูก redirect ไป /login) แต่หน้าขึ้น Permission Denied และไม่มีตารางผังการผูกบัญชี" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Authorization" },
      ],
    },
    async ({ browser }) => {
      const ctx = await browser.newContext(NO_SESSION);
      const page = await ctx.newPage();
      const { LoginPage } = await import("./pages/login.page");
      const { TEST_PASSWORD } = await import("./test-users");
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginWithRetry("carmensoftware.dev+requestor@gmail.com", TEST_PASSWORD);
      await page.waitForURL(/dashboard/, { timeout: 15_000 });
      await page.goto(PATH);
      await page.waitForLoadState("networkidle");
      expect(page.url()).toContain(PATH);
      await expect(page.getByText(/access denied|permission denied/i).first()).toBeVisible({ timeout: 10_000 });
      await expect(dataRows(page)).toHaveCount(0);
      await ctx.close();
    },
  );

  // ------------------------------------------------------------------
  // TC-ACMAP-400001 — Tab switching AP ↔ GL
  // ------------------------------------------------------------------
  test(
    "TC-ACMAP-400001 สลับแท็บ Post to AP ↔ Post to GL",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่หน้า /config/chart-of-account-mapping และแท็บ Post to AP ถูกเลือกอยู่" },
        { type: "steps", description: "1. คลิกแท็บ Post to GL\n2. ดูสถานะแท็บ\n3. คลิกแท็บ Post to AP กลับ" },
        { type: "expected", description: "แท็บที่คลิกถูกเลือก (aria-selected) ทุกครั้ง และยังอยู่ที่หน้า /config/chart-of-account-mapping" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      await gotoLoaded(page);
      const glTab = page.getByRole("tab", { name: /Post to GL/i }).first();
      await glTab.click();
      await page.waitForLoadState("networkidle");
      expect(page.url()).toContain(PATH);
      await expect(glTab).toHaveAttribute("aria-selected", "true");

      const apTab = page.getByRole("tab", { name: /Post to AP/i }).first();
      await apTab.click();
      await page.waitForLoadState("networkidle");
      await expect(apTab).toHaveAttribute("aria-selected", "true");
    },
  );

  // ------------------------------------------------------------------
  // TC-ACMAP-400002 — Heading count equals pagination total
  // ------------------------------------------------------------------
  test(
    "TC-ACMAP-400002 ตัวเลขข้างหัวข้อตรงกับจำนวนรวมในแถบ pagination",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่หน้า /config/chart-of-account-mapping โดยยังไม่ได้ค้นหาหรือกรอง" },
        { type: "steps", description: "1. อ่านตัวเลขที่อยู่ข้างหัวข้อหน้า\n2. อ่านจำนวนรวม (of N) ในแถบ pagination ใต้ตาราง" },
        { type: "expected", description: "ตัวเลขทั้งสองเท่ากัน" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      test.skip(!hasData, NO_DATA_REASON);
      await gotoLoaded(page);
      const heading = page.getByRole("heading", { name: /Chart of Accounts? Mapping/i }).first();
      const countText = await heading.locator("xpath=..").innerText();
      const m = countText.match(/([\d,]+)\s*$/);
      expect(m, `heading count not found in: ${countText}`).not.toBeNull();
      expect(Number(m![1].replace(/,/g, ""))).toBe(await paginationTotal(page));
    },
  );

  // ------------------------------------------------------------------
  // TC-ACMAP-400004 — Status chip filters rows
  // ------------------------------------------------------------------
  test(
    "TC-ACMAP-400004 กด chip สถานะ Incomplete แล้วตารางเหลือเฉพาะแถว Incomplete",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่หน้า /config/chart-of-account-mapping แท็บ Post to AP; ยังไม่ได้เลือก chip สถานะใด" },
        { type: "steps", description: "1. คลิก chip Incomplete ในกลุ่ม Filter by status\n2. ดูคอลัมน์ Status ของทุกแถวในหน้าแรก\n3. คลิก chip Incomplete อีกครั้ง" },
        { type: "expected", description: "chip Incomplete อยู่ในสถานะกด (aria-pressed=true) และทุกแถวที่เห็นมีป้าย Incomplete (หรือแสดง empty state ถ้าไม่มีแถว Incomplete); กดซ้ำแล้ว chip กลับเป็นไม่กด" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      test.skip(!hasData, NO_DATA_REASON);
      await gotoLoaded(page);
      const chip = page
        .getByRole("group", { name: /Filter by status/i })
        .getByRole("button", { name: /Incomplete/i });
      await expect(chip).toHaveAttribute("aria-pressed", "false");
      await chip.click();
      await page.waitForLoadState("networkidle");
      await expect(chip).toHaveAttribute("aria-pressed", "true");

      const list = new ConfigListPage(page, PATH);
      if (await list.emptyState().first().isVisible()) return;
      for (const row of await dataRows(page).all()) {
        await expect(row).toContainText(/Incomplete/);
      }

      await chip.click();
      await page.waitForLoadState("networkidle");
      await expect(chip).toHaveAttribute("aria-pressed", "false");
    },
  );

  // ------------------------------------------------------------------
  // TC-ACMAP-400006 — Toolbar actions
  // ------------------------------------------------------------------
  test(
    "TC-ACMAP-400006 ปุ่ม Generate แสดงเสมอ ส่วน Edit / Mark as reviewed แสดงเมื่อเลือกแถว",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่หน้า /config/chart-of-account-mapping และตารางมีข้อมูลอย่างน้อย 1 แถว" },
        { type: "steps", description: "1. ดูปุ่มด้านขวาของหัวหน้า\n2. ติ๊ก checkbox ของแถวแรก\n3. ดูปุ่มด้านขวาอีกครั้ง\n4. เอาติ๊กออก" },
        { type: "expected", description: "ก่อนเลือกเห็นปุ่ม Generate mapping rows แต่ไม่เห็นปุ่ม Edit / Mark as reviewed; หลังเลือก 1 แถวเห็นปุ่ม Edit (1) และ Mark as reviewed (1); เอาติ๊กออกแล้วสองปุ่มนั้นหายไป" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      test.skip(!hasData, NO_DATA_REASON);
      await gotoLoaded(page);
      await expect(page.getByRole("button", { name: /Generate mapping rows/i })).toBeVisible();
      const editSelected = page.getByRole("button", { name: /^Edit\s*\(1\)$/i });
      const markReviewed = page.getByRole("button", { name: /Mark as reviewed\s*\(1\)/i });
      await expect(markReviewed).toHaveCount(0);

      const rowCheckbox = dataRows(page).first().getByRole("checkbox");
      await rowCheckbox.click();
      await expect(editSelected).toBeVisible();
      await expect(markReviewed).toBeVisible();

      await rowCheckbox.click();
      await expect(markReviewed).toHaveCount(0);
    },
  );

  // ------------------------------------------------------------------
  // TC-ACMAP-400007 — Clicking Location opens the edit sheet
  // ------------------------------------------------------------------
  test(
    "TC-ACMAP-400007 คลิกชื่อ Location ในแถวแล้วเปิดหน้าต่าง Edit mapping",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่หน้า /config/chart-of-account-mapping และตารางมีข้อมูลอย่างน้อย 1 แถว" },
        { type: "steps", description: "1. คลิกชื่อ Location ของแถวแรก\n2. ดูหน้าต่างที่เปิดขึ้น\n3. กด Escape" },
        { type: "expected", description: "เปิด sheet หัวข้อ Edit mapping และปิดได้ด้วย Escape โดยไม่บันทึกอะไร" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      test.skip(!hasData, NO_DATA_REASON);
      await gotoLoaded(page);
      await dataRows(page).first().getByRole("button").first().click();
      const sheet = page.getByRole("dialog");
      await expect(sheet.getByText(/Edit mapping/i).first()).toBeVisible({ timeout: 10_000 });
      await page.keyboard.press("Escape");
      await expect(sheet).toHaveCount(0);
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
        { type: "expected", description: "จำนวนแถวในตารางและจำนวนรวมในแถบ pagination ยังเท่าเดิม (การค้นหาทำงานเมื่อกด Enter เท่านั้น)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      test.skip(!hasData, NO_DATA_REASON);
      await gotoLoaded(page);
      const rowsBefore = await dataRows(page).count();
      const totalBefore = await paginationTotal(page);

      const searchInput = page.getByPlaceholder(/Search/i).first();
      await searchInput.click();
      await searchInput.pressSequentially("zzzno_match", { delay: 20 });
      await page.locator("body").click({ position: { x: 10, y: 10 } });
      await page.waitForTimeout(500);

      expect(await dataRows(page).count()).toBe(rowsBefore);
      expect(await paginationTotal(page)).toBe(totalBefore);
    },
  );
});
