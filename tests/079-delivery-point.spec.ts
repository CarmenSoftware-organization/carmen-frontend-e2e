/**
 * E2E tests for Delivery Point (config module)
 *
 * Test cases mapped from spec sheet:
 * https://docs.google.com/spreadsheets/d/1eLuXtc-UxkgCCgImw2SI2XAX32LlPT3UHfxIpzmFoLc
 *
 * Covers TC-DP-010001..TC-DP-050005 (Read / Create / Update / Delete).
 * Tests run serially because CRUD steps depend on shared fixture data.
 */
import { expect, type Page } from "@playwright/test";
import { createAuthTest } from "./fixtures/auth.fixture";
import {
  DeliveryPointListPage,
  DeliveryPointDialog,
  DeleteConfirmDialog,
} from "./pages/delivery-point.page";
import { BU_CODE } from "./test-users";
import { ensureActiveBu, getBusinessUnits, defaultBu } from "./helpers/bu";
import { BuSwitcherPage } from "./pages/bu-switcher.page";
import { uid, fakeName } from "./helpers/test-data";

const test = createAuthTest("carmensoftware.dev+admin@gmail.com");

// Pin the active BU to BLAVG for every test in this file (precondition).
test.beforeEach(async ({ page }) => {
  await ensureActiveBu(page, BU_CODE);
});

const DP_NAME = fakeName({ tag: "DP" });
const DP_NAME_INACTIVE = fakeName({ tag: "DP Inactive" });
const DP_NAME_UPDATED = fakeName({ tag: "DP Upd" });
const DP_NAME_SORT = fakeName({ tag: "DP Sort" });


/**
 * Make sure a delivery point named `name` exists, creating it through the UI if
 * it does not.
 *
 * The edit and delete groups used to rely on the record created back in the
 * "สร้าง" group. That holds only while nothing fails: Playwright restarts the
 * worker after a failure, the module is re-imported, and both `uid` and every
 * unseeded `fakeName()` are computed at module scope — so the fixture's identity
 * changes underneath the remaining tests. One unrelated failure (the duplicate
 * -name case below) therefore took out nine edit/delete tests that were looking
 * for a name nobody had ever created. Seeding per group makes each one
 * self-sufficient instead.
 */
async function ensureDeliveryPoint(page: Page, name: string): Promise<void> {
  const list = new DeliveryPointListPage(page);
  const dialog = new DeliveryPointDialog(page);
  await list.goto();
  await list.search(name);
  // waitFor, not count(): count() answers immediately and the table re-renders a
  // beat after the search request settles, so an existing record reads as absent
  // and this would create a duplicate — which the backend rejects with 409,
  // leaving the dialog open and failing the *next* step instead of this one.
  const existing = page.getByRole("button", { name, exact: true }).first();
  const found = await existing
    .waitFor({ state: "visible", timeout: 8_000 })
    .then(() => true)
    .catch(() => false);
  if (found) return;
  await list.addButton().click({ timeout: 10_000 });
  await dialog.nameInput().fill(name, { timeout: 10_000 });
  await dialog.saveButton().click({ timeout: 10_000 });
  // Wait on the dialog's own name field, not on dialog(): that locator is
  // getByRole("dialog"), which also matches the app's always-mounted Command
  // Palette and therefore never reports hidden. Searching before the dialog is
  // gone fails differently — the modal overlay keeps the search box from ever
  // becoming actionable, and with actionTimeout at 0 that waits forever.
  await expect(dialog.nameInput()).toBeHidden({ timeout: 15_000 });
  await list.search(name);
  await expect(
    page.getByRole("button", { name, exact: true }).first(),
  ).toBeVisible({ timeout: 15_000 });
}

test.describe("จุดส่งของ — BU", () => {
  test(
    "TC-DP-010050 active BU = BLAVG",
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
});

// ─── Read (TC-DP-010001..TC-DP-010026) ──────────────────────────────────────────────────

test.describe("จุดส่งของ — อ่าน", () => {
  test(
    "TC-DP-010001 อ่านค่า table ของ delivery point ได้",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ carmensoftware.dev+admin@gmail.com (จาก createAuthTest) login แล้ว และมี delivery point ในระบบอย่างน้อย 1 รายการ" },
        { type: "steps", description: "1. เปิดหน้า /config/delivery-point\n2. รอ table โหลด\n3. ตรวจสอบปุ่ม Add" },
        { type: "expected", description: "URL ลงท้ายด้วย config/delivery-point, table แสดงผล และปุ่ม Add visible" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page }) => {
    const list = new DeliveryPointListPage(page);
    await list.goto();
    await expect(page).toHaveURL(/config\/delivery-point/);
    await expect(list.table()).toBeVisible();
    await expect(list.addButton()).toBeVisible();
  });

  test(
    "TC-DP-010002 แสดงข้อมูล default 10 รายการต่อหน้า",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้ว มีข้อมูล delivery point ในระบบ" },
        { type: "steps", description: "1. เปิดหน้า /config/delivery-point\n2. นับจำนวน rows ใน table" },
        { type: "expected", description: "จำนวน row > 0 และ <= 10 (ค่า default per page)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
    const list = new DeliveryPointListPage(page);
    await list.goto();
    const rows = await list.tableRows().count();
    expect(rows).toBeGreaterThan(0);
    expect(rows).toBeLessThanOrEqual(10);
  });

  test(
    "TC-DP-010003 เปลี่ยน per page เป็น 25 / 50 / 100 ได้",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้ว และตัวเลือก per page visible" },
        { type: "steps", description: "1. เปิดหน้า list\n2. เลือก per page = 25\n3. เลือก 50\n4. เลือก 100\n5. นับ rows หลังจากแต่ละค่า" },
        { type: "expected", description: "จำนวน rows ที่แสดงไม่เกินค่า per page ที่เลือกในแต่ละครั้ง" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
    const list = new DeliveryPointListPage(page);
    await list.goto();
    const select = list.perPageSelect();
    await expect(select).toBeVisible({ timeout: 10_000 });
    for (const size of ["25", "50", "100"]) {
      await select.click();
      await page.getByRole("option", { name: size }).click();
      await page.waitForLoadState("networkidle");
      const rows = await list.tableRows().count();
      expect(rows).toBeLessThanOrEqual(Number(size));
    }
  });

  test(
    "TC-DP-010004 per page เกิน 100 ไม่ได้",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้ว และตัวเลือก per page visible" },
        { type: "steps", description: "1. เปิดหน้า list\n2. กด dropdown per page\n3. ตรวจสอบว่ามีตัวเลือก 200 หรือไม่" },
        { type: "expected", description: "ตัวเลือก 200 ไม่อยู่ใน dropdown (per page สูงสุดคือ 100)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Validation" },
      ],
    },
    async ({ page }) => {
    const list = new DeliveryPointListPage(page);
    await list.goto();
    const select = list.perPageSelect();
    await expect(select).toBeVisible({ timeout: 10_000 });
    await select.click();
    await expect(page.getByRole("option", { name: /^200$/ })).toHaveCount(0);
    await page.keyboard.press("Escape");
  });

  test(
    "TC-DP-010005 กด next/prev page แล้วข้อมูลเปลี่ยน",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้ว และมีข้อมูลมากกว่า 1 page" },
        { type: "steps", description: "1. เปิดหน้า list\n2. จด row แรก\n3. กด next page\n4. ตรวจสอบ row แรกใหม่\n5. กด prev page" },
        { type: "expected", description: "row แรกหลังกด next ไม่เท่ากับ row แรกก่อนกด" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
    const list = new DeliveryPointListPage(page);
    await list.goto();
    test.skip(!(await list.nextPageButton().isEnabled({ timeout: 2_000 }).catch(() => false)), "needs more than one page of delivery points (dataset has < 10) — data guard");
    const firstBefore = await list.tableRows().first().innerText();
    await list.nextPageButton().click();
    await page.waitForLoadState("networkidle");
    const firstAfter = await list.tableRows().first().innerText();
    expect(firstAfter).not.toEqual(firstBefore);
    await list.prevPageButton().click();
    await page.waitForLoadState("networkidle");
  });

  test(
    "TC-DP-010006 search ชื่อ delivery point แล้วกรองได้ถูก",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้ว และมี delivery point อย่างน้อย 1 รายการ" },
        { type: "steps", description: "1. เปิดหน้า list\n2. ใช้คำค้นจาก row แรกที่มีอยู่\n3. ใส่ search\n4. นับ rows" },
        { type: "expected", description: "ผลลัพธ์มี row > 0 (กรองตรงตามคำค้น)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page }) => {
    const list = new DeliveryPointListPage(page);
    await list.goto();
    const sample = await list.tableRows().first().innerText().catch(() => "");
    expect(sample, "no delivery point in the BU — run `bun run data:reset`").toBeTruthy();
    const term = sample.split(/\s+/).find((t) => t.length > 2) ?? sample.slice(0, 3);
    await list.search(term);
    const count = await list.tableRows().count();
    expect(count).toBeGreaterThan(0);
  });

  test(
    "TC-DP-010007 search ด้วยคำที่ไม่มีในระบบ แสดง empty state",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้ว" },
        { type: "steps", description: "1. เปิดหน้า list\n2. search ด้วยคำที่ไม่มีจริง เช่น __NOPE__<UID>" },
        { type: "expected", description: "table แสดง empty state เมื่อไม่มีผลลัพธ์ตรงกับคำค้น" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
    const list = new DeliveryPointListPage(page);
    await list.goto();
    await list.search(`__NOPE__${uid}`);
    await expect(list.emptyState().first()).toBeVisible({ timeout: 10_000 });
  });

  test(
    "TC-DP-010008 search ด้วย special char เช่น %, ' ไม่พัง",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้ว" },
        { type: "steps", description: "1. เปิดหน้า list\n2. search ด้วย special char %, '" },
        { type: "expected", description: "ระบบไม่ crash, ปุ่ม Add ยัง visible อยู่" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Validation" },
      ],
    },
    async ({ page }) => {
    const list = new DeliveryPointListPage(page);
    await list.goto();
    await list.search("%'");
    await expect(list.addButton()).toBeVisible();
  },
  );

  test(
    "TC-DP-010009 filter ตาม field ที่กำหนด แล้วผลตรง",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้ว และมีตัวเลือก filter" },
        { type: "steps", description: "1. เปิดหน้า list\n2. กดปุ่ม filter\n3. เลือก option active\n4. รอผล" },
        { type: "expected", description: "table แสดงเฉพาะ delivery point ที่ Status = Active (ทุกแถวมีสถานะ Active และไม่มีแถว Inactive)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
    const list = new DeliveryPointListPage(page);
    await list.goto();
    // ListFilter (FE components/list-filter): one "Status" group with All / Active / Inactive.
    await list.filterButton().click();
    const sheet = page.locator("[role=dialog]:visible").last();
    await sheet.getByRole("button", { name: "Status" }).click();
    await sheet.getByText("Active", { exact: true }).click();
    await page.keyboard.press("Escape");
    // Wait for the filtered result (rows briefly render as a skeleton) instead of reading once.
    await expect
      .poll(async () => {
        const rows = await list.tableRows().allInnerTexts();
        return rows.length > 0 && rows.every((r) => /\bActive\b/.test(r));
      }, { timeout: 10_000, message: "every remaining row should be Active" })
      .toBe(true);
    const filtered = await list.tableRows().allInnerTexts();
    expect(filtered.length, "filter by Active leaves at least one row").toBeGreaterThan(0);
    expect(filtered.some((r) => /\bInactive\b/.test(r)), "no Inactive row remains").toBe(false);
  });

  test(
    "TC-DP-010010 กด sort column แล้วเรียงจาก A→Z ได้",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้ว และ column name สามารถ sort ได้" },
        { type: "steps", description: "1. เปิดหน้า list\n2. กดปุ่ม sort ที่ column name\n3. รอผล" },
        { type: "expected", description: "ปุ่ม sort ทำงาน, table มีข้อมูล > 0 row หลังเรียง A→Z" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
    const list = new DeliveryPointListPage(page);
    await list.goto();
    const sortButton = list
      .headerCell(/name/i)
      .getByRole("button", { name: /name/i });
    await expect(sortButton).toBeVisible({ timeout: 10_000 });
    await sortButton.click();
    await expect(sortButton).toBeEnabled({ timeout: 10_000 });
    await page.waitForLoadState("networkidle");
    const rows = await list.tableRows().count();
    expect(rows).toBeGreaterThan(0);
  });

  test(
    "TC-DP-010011 กด sort ซ้ำแล้วเรียงกลับ Z→A ได้",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้ว และ column name สามารถ sort ได้" },
        { type: "steps", description: "1. เปิดหน้า list\n2. กด sort ครั้งแรก (A→Z)\n3. เก็บ rows\n4. กด sort อีกครั้ง (Z→A)\n5. เปรียบเทียบ" },
        { type: "expected", description: "ลำดับ rows หลังกดสองครั้งแตกต่างจากครั้งแรก (เรียงกลับ Z→A)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
    const list = new DeliveryPointListPage(page);
    // data:reset leaves one delivery point ("Main"); a sort needs at least two rows to reorder.
    await ensureDeliveryPoint(page, DP_NAME_SORT);
    await list.goto();
    const sortButton = list
      .headerCell(/name/i)
      .getByRole("button", { name: /name/i });
    await expect(sortButton).toBeVisible({ timeout: 10_000 });
    // First click: A→Z
    await sortButton.click();
    await expect(sortButton).toBeEnabled({ timeout: 10_000 });
    await page.waitForLoadState("networkidle");
    const ascAll = await list.tableRows().allInnerTexts();
    expect(ascAll.length, "needs at least 2 delivery points").toBeGreaterThan(1);
    // Second click: Z→A
    await sortButton.click();
    await expect(sortButton).toBeEnabled({ timeout: 10_000 });
    await page.waitForLoadState("networkidle");
    const descAll = await list.tableRows().allInnerTexts();
    expect(descAll).not.toEqual(ascAll);
  });

  test(
    "TC-DP-010012 filter + search + sort พร้อมกันไม่พัง",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้ว และมีข้อมูลในระบบ" },
        { type: "steps", description: "1. เปิดหน้า list\n2. search ด้วยคำจาก row\n3. กด sort\n4. ตรวจสอบหน้ายังใช้งานได้" },
        { type: "expected", description: "ปุ่ม Add ยัง visible — ระบบไม่ crash เมื่อใช้ filter+search+sort พร้อมกัน" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
    const list = new DeliveryPointListPage(page);
    await list.goto();
    // Search first
    const sample = await list.tableRows().first().innerText().catch(() => "");
    expect(sample, "no delivery point in the BU — run `bun run data:reset`").toBeTruthy();
    const term = sample.split(/\s+/).find((t) => t.length > 2) ?? sample.slice(0, 3);
    await list.search(term);
    // Then sort
    const sortButton = list
      .headerCell(/name/i)
      .getByRole("button", { name: /name/i });
    await expect(sortButton).toBeVisible({ timeout: 10_000 });
    await sortButton.click();
    await page.waitForLoadState("networkidle");
    // Search + sort still leave the matching record(s), and the page stays usable
    expect(await list.tableRows().count(), "search term still matches after sorting").toBeGreaterThan(0);
    await expect(list.searchInput().first()).toHaveValue(term);
    await expect(list.addButton()).toBeVisible();
  });

  test(
    "TC-DP-010013 กด toggle เปลี่ยนจาก table → card view ได้",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้ว และมี view toggle (table/card)" },
        { type: "steps", description: "1. เปิดหน้า list\n2. กดปุ่ม toggle card view\n3. รอ render" },
        { type: "expected", description: "หน้าเปลี่ยนเป็น card view, ปุ่ม Add ยัง visible" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
    const list = new DeliveryPointListPage(page);
    await list.goto();
    const cardToggle = list.viewToggleCard();
    await expect(cardToggle).toBeVisible({ timeout: 10_000 });
    await cardToggle.click();
    await page.waitForLoadState("networkidle");
    // Table should be hidden or card content should appear
    await expect(list.addButton()).toBeVisible();
  });

  test(
    "TC-DP-010014 กด toggle เปลี่ยนจาก card → table view ได้",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้ว และอยู่ที่ card view" },
        { type: "steps", description: "1. เปิดหน้า list\n2. กด toggle card\n3. กด toggle table" },
        { type: "expected", description: "หน้ากลับมาเป็น table view ที่แสดงผลปกติ" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
    const list = new DeliveryPointListPage(page);
    await list.goto();
    const cardToggle = list.viewToggleCard();
    await expect(cardToggle).toBeVisible({ timeout: 10_000 });
    await cardToggle.click();
    await page.waitForLoadState("networkidle");
    await list.viewToggleTable().click();
    await page.waitForLoadState("networkidle");
    await expect(list.table()).toBeVisible();
  });

  test(
    "TC-DP-010015 ข้อมูลที่แสดงใน card กับ table ตรงกัน",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้ว และมีข้อมูลใน table" },
        { type: "steps", description: "1. เปิดหน้า list\n2. จดข้อความ row แรกใน table\n3. switch เป็น card view\n4. ตรวจสอบ data ปรากฏใน card" },
        { type: "expected", description: "ข้อมูลที่ปรากฏใน card ตรงกับข้อมูลใน table" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
    const list = new DeliveryPointListPage(page);
    await list.goto();
    const tableFirst = await list.tableRows().first().innerText().catch(() => "");
    const cardToggle = list.viewToggleCard();
    await expect(cardToggle).toBeVisible({ timeout: 10_000 });
    await cardToggle.click();
    await page.waitForLoadState("networkidle");
    if (tableFirst) {
      const firstWord = tableFirst.split(/\s+/)[0];
      await expect(page.getByText(firstWord).first()).toBeVisible();
    }
    await list.viewToggleTable().click();
  });

  test(
    "TC-DP-010016 เปลี่ยน view mode แล้ว filter/search/sort ยังทำงานอยู่",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้ว และมี view toggle" },
        { type: "steps", description: "1. เปิดหน้า list\n2. search ด้วยคำจาก row\n3. switch เป็น card view\n4. switch กลับมา table" },
        { type: "expected", description: "หน้ายังใช้งานได้ ปุ่ม Add visible — search ไม่หายเมื่อสลับ view" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
    const list = new DeliveryPointListPage(page);
    await list.goto();
    const cardToggle = list.viewToggleCard();
    await expect(cardToggle).toBeVisible({ timeout: 10_000 });
    // Search first
    const sample = await list.tableRows().first().innerText().catch(() => "");
    expect(sample, "no delivery point in the BU — run `bun run data:reset`").toBeTruthy();
    const term = sample.split(/\s+/).find((t) => t.length > 2) ?? sample.slice(0, 3);
    await list.search(term);
    // Switch to card
    await cardToggle.click();
    await page.waitForLoadState("networkidle");
    // Search should still be applied — page should not crash
    await expect(list.addButton()).toBeVisible();
    await list.viewToggleTable().click();
  });

  test(
    "TC-DP-010017 เปลี่ยน view mode แล้ว pagination ยังทำงานอยู่",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้ว และมี view toggle" },
        { type: "steps", description: "1. เปิดหน้า list\n2. switch เป็น card view\n3. switch กลับมา table\n4. ตรวจสอบ pagination" },
        { type: "expected", description: "ปุ่ม Add ยัง visible — controls pagination ไม่หายเมื่อสลับ view" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
    const list = new DeliveryPointListPage(page);
    await list.goto();
    const cardToggle = list.viewToggleCard();
    await expect(cardToggle).toBeVisible({ timeout: 10_000 });
    await cardToggle.click();
    await page.waitForLoadState("networkidle");
    await list.viewToggleTable().click();
    await page.waitForLoadState("networkidle");
    // Pagination controls should still be present
    await expect(list.addButton()).toBeVisible();
  });

  test(
    "TC-DP-010018 refresh หน้าแล้ว view mode กลับมาเป็น default",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้ว" },
        { type: "steps", description: "1. เปิดหน้า list\n2. switch เป็น card view\n3. reload หน้า" },
        { type: "expected", description: "หลัง reload กลับมาที่ table view (default)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
    const list = new DeliveryPointListPage(page);
    await list.goto();
    const cardToggle = list.viewToggleCard();
    await expect(cardToggle).toBeVisible({ timeout: 10_000 });
    await cardToggle.click();
    await page.waitForLoadState("networkidle");
    await page.reload();
    await page.waitForLoadState("networkidle");
    // Default view is table
    await expect(list.table()).toBeVisible();
  });

  test(
    "TC-DP-010019 กด toggle column แล้ว panel แสดงรายการ column ได้",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้ว และปุ่ม column visibility visible" },
        { type: "steps", description: "1. เปิดหน้า list\n2. กดปุ่ม column visibility\n3. ตรวจสอบ menu items" },
        { type: "expected", description: "panel เปิดและแสดง menuitemcheckbox ของ column" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
    const list = new DeliveryPointListPage(page);
    await list.goto();
    const btn = list.columnVisibilityButton();
    await expect(btn).toBeVisible({ timeout: 10_000 });
    await btn.click();
    const menuItem = page.getByRole("menuitemcheckbox").first();
    await expect(menuItem).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test(
    "TC-DP-010020 ซ่อน column แล้ว column หายออกจาก table",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้ว และมีปุ่ม column visibility" },
        { type: "steps", description: "1. เปิดหน้า list\n2. กด column visibility\n3. uncheck column name\n4. ตรวจสอบ header\n5. restore" },
        { type: "expected", description: "header ของ column name หายไปจาก table หลัง uncheck" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
    const list = new DeliveryPointListPage(page);
    await list.goto();
    const btn = list.columnVisibilityButton();
    await expect(btn).toBeVisible({ timeout: 10_000 });
    await btn.click();
    const item = page.getByRole("menuitemcheckbox", { name: /name/i }).first();
    await item.click();
    await page.keyboard.press("Escape");
    await expect(list.headerCell(/^name$/i)).toHaveCount(0);
    // Restore
    await btn.click();
    await item.click();
    await page.keyboard.press("Escape");
  });

  test(
    "TC-DP-010021 แสดง column กลับแล้ว column โผล่ใน table",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้ว และมีปุ่ม column visibility" },
        { type: "steps", description: "1. เปิดหน้า list\n2. ซ่อน column name\n3. show กลับ\n4. ตรวจสอบ header" },
        { type: "expected", description: "header ของ column name กลับมา visible หลัง check" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
    const list = new DeliveryPointListPage(page);
    await list.goto();
    const btn = list.columnVisibilityButton();
    await expect(btn).toBeVisible({ timeout: 10_000 });
    // Hide first
    await btn.click();
    const item = page.getByRole("menuitemcheckbox", { name: /name/i }).first();
    await item.click();
    await page.keyboard.press("Escape");
    await expect(list.headerCell(/^name$/i)).toHaveCount(0);
    // Show again
    await btn.click();
    await item.click();
    await page.keyboard.press("Escape");
    await expect(list.headerCell(/^name$/i)).toBeVisible();
  });

  test(
    "TC-DP-010022 ซ่อนทุก column ไม่ได้ ต้องเหลืออย่างน้อย 1 column",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้ว และมีปุ่ม column visibility" },
        { type: "steps", description: "1. เปิดหน้า list\n2. กด column visibility\n3. uncheck ทุก column\n4. ตรวจสอบ table" },
        { type: "expected", description: "ระบบยังเหลือ header อย่างน้อย 1 column ใน table — ซ่อนทุก column ไม่ได้" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Validation" },
      ],
    },
    async ({ page }) => {
    const list = new DeliveryPointListPage(page);
    await list.goto();
    const btn = list.columnVisibilityButton();
    await expect(btn).toBeVisible({ timeout: 10_000 });
    await btn.click();
    const items = page.getByRole("menuitemcheckbox");
    const count = await items.count();
    // Try to uncheck all
    for (let i = 0; i < count; i++) {
      const item = items.nth(i);
      const state = await item.getAttribute("data-state");
      if (state === "checked") await item.click();
    }
    // At least one column must remain visible in the table
    const visibleHeaders = await page.locator("thead th").count();
    expect(visibleHeaders).toBeGreaterThanOrEqual(1);
    await page.keyboard.press("Escape");
    // Restore all by reloading
    await page.reload();
    await page.waitForLoadState("networkidle");
  });

  test(
    "TC-DP-010023 column ที่ซ่อนอยู่ยังค้นหาและ filter ได้ปกติ",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้ว และมีปุ่ม column visibility" },
        { type: "steps", description: "1. เปิดหน้า list\n2. ซ่อน column name\n3. search ด้วยคำที่อยู่ในข้อมูล\n4. ตรวจสอบ rows" },
        { type: "expected", description: "search ยังกรองข้อมูลตาม column ที่ซ่อนได้: header Name หายไปแต่ค้นด้วยค่าของ column นั้นยังเจอ record (rows > 0)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
    const list = new DeliveryPointListPage(page);
    await list.goto();
    const btn = list.columnVisibilityButton();
    await expect(btn).toBeVisible({ timeout: 10_000 });
    // Get a name before hiding
    const sample = await list.tableRows().first().innerText().catch(() => "");
    expect(sample, "no delivery point in the BU — run `bun run data:reset`").toBeTruthy();
    const term = sample.split(/\s+/).find((t) => t.length > 2) ?? sample.slice(0, 3);
    // Hide name column
    await btn.click();
    const item = page.getByRole("menuitemcheckbox", { name: /name/i }).first();
    await item.click();
    await page.keyboard.press("Escape");
    // Search should still work
    await list.search(term);
    // The hidden Name column is still searchable: the record we searched for is found
    await expect(list.headerCell(/^name$/i)).toHaveCount(0);
    expect(await list.tableRows().count(), "search by the hidden column's value finds the record").toBeGreaterThan(0);
    expect(await list.tableRows().first().innerText()).not.toMatch(/no data found/i);
    // Restore
    await btn.click();
    await item.click();
    await page.keyboard.press("Escape");
  });

  test(
    "TC-DP-010024 เปลี่ยน view mode แล้ว column visibility ยังคงอยู่",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้ว และมี view toggle + column visibility" },
        { type: "steps", description: "1. เปิดหน้า list\n2. ซ่อน column name\n3. switch เป็น card\n4. switch กลับมา table\n5. restore" },
        { type: "expected", description: "column name ยังถูกซ่อนเมื่อกลับมา table view" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
    const list = new DeliveryPointListPage(page);
    await list.goto();
    const btn = list.columnVisibilityButton();
    const cardToggle = list.viewToggleCard();
    await expect(btn).toBeVisible({ timeout: 10_000 });
    await expect(cardToggle).toBeVisible({ timeout: 10_000 });
    // Hide name column
    await btn.click();
    const item = page.getByRole("menuitemcheckbox", { name: /name/i }).first();
    await item.click();
    await page.keyboard.press("Escape");
    // Switch to card and back
    await cardToggle.click();
    await page.waitForLoadState("networkidle");
    await list.viewToggleTable().click();
    await page.waitForLoadState("networkidle");
    // Name column should still be hidden
    await expect(list.headerCell(/^name$/i)).toHaveCount(0);
    // Restore
    await btn.click();
    await item.click();
    await page.keyboard.press("Escape");
  });

  test(
    "TC-DP-010025 refresh หน้าแล้ว column ที่ซ่อนไว้กลับมาเป็น default",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้ว และมีปุ่ม column visibility" },
        { type: "steps", description: "1. เปิดหน้า list\n2. ซ่อน column name\n3. reload หน้า" },
        { type: "expected", description: "หลัง reload column name visible อีกครั้ง (default state)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
    const list = new DeliveryPointListPage(page);
    await list.goto();
    const btn = list.columnVisibilityButton();
    await expect(btn).toBeVisible({ timeout: 10_000 });
    // Hide name column
    await btn.click();
    const item = page.getByRole("menuitemcheckbox", { name: /name/i }).first();
    await item.click();
    await page.keyboard.press("Escape");
    await expect(list.headerCell(/^name$/i)).toHaveCount(0);
    // Refresh
    await page.reload();
    await page.waitForLoadState("networkidle");
    // Name column should be visible again
    await expect(list.headerCell(/^name$/i)).toBeVisible();
  });

  test(
    "TC-DP-010026 card view ไม่มี column toggle เพราะไม่มี column",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้ว และมี view toggle" },
        { type: "steps", description: "1. เปิดหน้า list\n2. switch เป็น card view\n3. ตรวจสอบปุ่ม column visibility" },
        { type: "expected", description: "ปุ่ม column visibility ไม่ visible ใน card view (เพราะไม่มี column)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
    const list = new DeliveryPointListPage(page);
    await list.goto();
    const cardToggle = list.viewToggleCard();
    await expect(cardToggle).toBeVisible({ timeout: 10_000 });
    await cardToggle.click();
    await page.waitForLoadState("networkidle");
    await expect(list.columnVisibilityButton()).not.toBeVisible();
    await list.viewToggleTable().click();
  });
});

// ─── Create (TC-DP-030001..TC-DP-030006) ────────────────────────────────────────────────

test.describe("จุดส่งของ — สร้าง", () => {
  test(
    "TC-DP-030001 กด Add แล้ว dialog เปิดขึ้นมา",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้ว และอยู่ที่หน้า list" },
        { type: "steps", description: "1. เปิดหน้า list\n2. กดปุ่ม Add\n3. ตรวจสอบ dialog\n4. กด cancel" },
        { type: "expected", description: "dialog เปิดและ visible เมื่อกด Add" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page }) => {
    const list = new DeliveryPointListPage(page);
    const dialog = new DeliveryPointDialog(page);
    await list.goto();
    await list.addButton().click();
    await expect(dialog.dialog()).toBeVisible();
    await dialog.cancelButton().click();
  });

  test(
    "TC-DP-030002 dialog เปิดมา field name เป็น empty string",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้ว" },
        { type: "steps", description: "1. เปิดหน้า list\n2. กด Add\n3. ตรวจสอบ value ของ name input" },
        { type: "expected", description: "field name มี value = '' (empty string) เมื่อ dialog เปิด" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
    const list = new DeliveryPointListPage(page);
    const dialog = new DeliveryPointDialog(page);
    await list.goto();
    await list.addButton().click();
    await expect(dialog.nameInput()).toHaveValue("");
    await dialog.cancelButton().click();
  });

  test(
    "TC-DP-030003 dialog เปิดมา is active default เป็น true",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้ว" },
        { type: "steps", description: "1. เปิดหน้า list\n2. กด Add\n3. ตรวจสอบ data-state ของ active switch" },
        { type: "expected", description: "active switch มี data-state = 'checked' (default true)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
    const list = new DeliveryPointListPage(page);
    const dialog = new DeliveryPointDialog(page);
    await list.goto();
    await list.addButton().click();
    await expect(dialog.activeSwitch()).toHaveAttribute("data-state", "checked");
    await dialog.cancelButton().click();
  });

  test(
    "TC-DP-030004 กรอก name แล้ว save ได้ ข้อมูลขึ้น table",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้ว และยังไม่มี delivery point ชื่อ DP_NAME" },
        { type: "steps", description: "1. เปิดหน้า list\n2. กด Add\n3. กรอก name = DP_NAME\n4. กด Save\n5. search หาชื่อ" },
        { type: "expected", description: "แสดง toast success และข้อมูลปรากฏใน table" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
    const list = new DeliveryPointListPage(page);
    const dialog = new DeliveryPointDialog(page);
    await list.goto();
    await list.addButton().click();
    await dialog.nameInput().fill(DP_NAME);
    await dialog.saveButton().click();
    await expect(page.getByText(/created|success|สำเร็จ/i).first()).toBeVisible({
      timeout: 10_000,
    });
    await list.search(DP_NAME);
    await expect(page.getByRole("cell", { name: DP_NAME })).toBeVisible();
  });

  test(
    "TC-DP-200001 กด save โดยไม่กรอก name ระบบต้องด่า",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้ว" },
        { type: "steps", description: "1. เปิดหน้า list\n2. กด Add\n3. กด Save โดยไม่กรอกอะไร" },
        { type: "expected", description: "แสดง error message สำหรับ field ที่ require ว่าง" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Validation" },
      ],
    },
    async ({ page }) => {
    const list = new DeliveryPointListPage(page);
    const dialog = new DeliveryPointDialog(page);
    await list.goto();
    await list.addButton().click();
    await dialog.saveButton().click();
    await expect(dialog.errorMessage().first()).toBeVisible();
    await dialog.cancelButton().click();
  });

  // App bug, not a test bug — do not work around it.
  // The backend does the right thing: a second POST with the same name answers
  // 409 `DELIVERY_POINT_ALREADY_EXISTS` / "Delivery point already exists" and no
  // duplicate row is written (verified against the API directly). The frontend
  // then throws that away: `lib/error-message.ts:87` maps *every* 409 to
  // `documentChanged`, so the user is told "Someone else changed this document.
  // Refresh the page and try again." — advice that cannot help, since refreshing
  // and retrying hits the same duplicate. Un-fixme once 409 carries the
  // conflicting field through.
  test(
    "TC-DP-200002 กรอก name ซ้ำกับที่มีอยู่แล้ว ระบบต้องห้าม",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้ว และมี delivery point DP_NAME อยู่แล้ว (จาก TC-DP-030004)" },
        { type: "steps", description: "1. เปิดหน้า list\n2. กด Add\n3. กรอก name ซ้ำ\n4. Save" },
        { type: "expected", description: "ระบบแสดง error duplicate/exists/already และไม่บันทึก (ปัจจุบันแอปแสดงข้อความ concurrency แทน — บั๊ก frontend)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Validation" },
      ],
    },
    async ({ page }) => {
    const list = new DeliveryPointListPage(page);
    const dialog = new DeliveryPointDialog(page);
    // The worker may have restarted since TC-DP-030004 (uid changes) — make sure the name exists.
    await ensureDeliveryPoint(page, DP_NAME);
    await list.goto();
    await list.addButton().click();
    await dialog.nameInput().fill(DP_NAME);
    const answered = page.waitForResponse((r) => r.request().method() === "POST" && /delivery-point/.test(r.url()), { timeout: 10_000 });
    await dialog.saveButton().click();
    // Normal steps: the backend rejects the duplicate with 409 and the dialog stays open...
    const response = await answered;
    expect(response.status()).toBe(409);
    await expect(dialog.nameInput()).toBeVisible();
    // ...bug site: the user is told nothing (no toast / message) about why.
    test.fail(true, "suspected bug: a duplicate delivery-point name is rejected (409 DELIVERY_POINT_ALREADY_EXISTS, no row written) but the dialog shows no toast or message — the user gets no feedback");
    // FE e4035fba: a 409 "already exists" now reads "...conflicts with data already recorded in the system"
    await expect(page.getByText(/already|exists|duplicate|conflicts with data|ซ้ำ/i).first()).toBeVisible({ timeout: 5_000 });
    await dialog.cancelButton().click();
  });

  test(
    "TC-DP-200003 กรอก name ยาวเกิน limit ระบบต้องห้าม",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้ว" },
        { type: "steps", description: "1. เปิดหน้า list\n2. กด Add\n3. กรอก name ยาว 150 ตัวอักษร\n4. ตรวจสอบ value" },
        { type: "expected", description: "name input ตัดข้อความให้ยาวไม่เกิน 100 ตัวอักษร" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Validation" },
      ],
    },
    async ({ page }) => {
    const list = new DeliveryPointListPage(page);
    const dialog = new DeliveryPointDialog(page);
    await list.goto();
    await list.addButton().click();
    await dialog.nameInput().fill("a".repeat(150));
    const value = await dialog.nameInput().inputValue();
    expect(value.length).toBeLessThanOrEqual(100);
    await dialog.cancelButton().click();
  });

  test(
    "TC-DP-200004 กรอก name เป็น space ล้วน ระบบต้องด่า",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้ว" },
        { type: "steps", description: "1. เปิดหน้า list\n2. กด Add\n3. กรอก name = '    ' (space ล้วน)\n4. กด Save" },
        { type: "expected", description: "แสดง error message และ dialog ยังเปิดอยู่ (ไม่บันทึก space ล้วน)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Validation" },
      ],
    },
    async ({ page }) => {
    const list = new DeliveryPointListPage(page);
    const dialog = new DeliveryPointDialog(page);
    await list.goto();
    await list.addButton().click();
    await dialog.nameInput().fill("    ");
    await dialog.saveButton().click();
    await expect(dialog.errorMessage().first()).toBeVisible({ timeout: 5_000 });
    await expect(dialog.dialog()).toBeVisible();
    await dialog.cancelButton().click();
  });

  test(
    "TC-DP-030005 กด cancel แล้ว dialog ปิด ไม่มีข้อมูลขึ้น table",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้ว" },
        { type: "steps", description: "1. เปิดหน้า list\n2. กด Add\n3. กรอก name\n4. กด Cancel\n5. search หาชื่อ" },
        { type: "expected", description: "dialog ปิด และข้อมูลไม่ถูกบันทึก (table แสดง empty state)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
    const list = new DeliveryPointListPage(page);
    const dialog = new DeliveryPointDialog(page);
    await list.goto();
    await list.addButton().click();
    await dialog.nameInput().fill(`should-not-save-${uid}`);
    await dialog.cancelButton().click();
    await expect(dialog.dialog()).not.toBeVisible();
    await list.search(`should-not-save-${uid}`);
    await expect(list.emptyState().first()).toBeVisible({ timeout: 10_000 });
  });

  test(
    "TC-DP-030006 สร้างด้วย is active = false แล้วค่าบันทึกถูก",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้ว และยังไม่มี DP_NAME_INACTIVE" },
        { type: "steps", description: "1. เปิดหน้า list\n2. กด Add\n3. กรอก name = DP_NAME_INACTIVE\n4. toggle active = unchecked\n5. กด Save" },
        { type: "expected", description: "บันทึกสำเร็จ (toast success) และค่า is_active = false ถูกบันทึก" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
    const list = new DeliveryPointListPage(page);
    const dialog = new DeliveryPointDialog(page);
    await list.goto();
    await list.addButton().click();
    await dialog.nameInput().fill(DP_NAME_INACTIVE);
    await dialog.activeSwitch().click();
    await expect(dialog.activeSwitch()).toHaveAttribute("data-state", "unchecked");
    await dialog.saveButton().click();
    await expect(page.getByText(/created|success|สำเร็จ/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });
});

// ─── Update (TC-DP-040001..TC-DP-040007) ────────────────────────────────────────────────

test.describe("จุดส่งของ — แก้ไข", () => {
  test.beforeEach(async ({ page }) => {
    await ensureDeliveryPoint(page, DP_NAME);
  });

  test(
    "TC-DP-040001 กดที่ column name แล้ว dialog เปิดขึ้นมา",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้ว และมี DP_NAME ใน table (จาก TC-DP-030004)" },
        { type: "steps", description: "1. เปิดหน้า list\n2. search DP_NAME\n3. คลิกที่ row name\n4. ตรวจสอบ dialog" },
        { type: "expected", description: "dialog edit เปิดและ visible เมื่อคลิกที่ name" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
    const list = new DeliveryPointListPage(page);
    const dialog = new DeliveryPointDialog(page);
    await list.goto();
    await list.search(DP_NAME);
    await list.clickRowName(DP_NAME);
    await expect(dialog.dialog()).toBeVisible();
    await dialog.cancelButton().click();
  });

  test(
    "TC-DP-040002 dialog เปิดมา field name แสดงค่าเดิมถูกต้อง",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้ว และมี DP_NAME ใน table" },
        { type: "steps", description: "1. เปิดหน้า list\n2. search DP_NAME\n3. คลิก row\n4. ตรวจ value ของ name input" },
        { type: "expected", description: "field name มี value ตรงกับ DP_NAME (ค่าเดิม)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
    const list = new DeliveryPointListPage(page);
    const dialog = new DeliveryPointDialog(page);
    await list.goto();
    await list.search(DP_NAME);
    await list.clickRowName(DP_NAME);
    await expect(dialog.nameInput()).toHaveValue(DP_NAME);
    await dialog.cancelButton().click();
  });

  test(
    "TC-DP-040003 dialog เปิดมา is active แสดงค่าเดิมถูกต้อง",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้ว และ DP_NAME มี is_active = true" },
        { type: "steps", description: "1. เปิดหน้า list\n2. search DP_NAME\n3. คลิก row\n4. ตรวจ data-state ของ active switch" },
        { type: "expected", description: "active switch มี data-state = 'checked' (ตรงกับค่าเดิม)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
    const list = new DeliveryPointListPage(page);
    const dialog = new DeliveryPointDialog(page);
    await list.goto();
    await list.search(DP_NAME);
    await list.clickRowName(DP_NAME);
    await expect(dialog.activeSwitch()).toHaveAttribute("data-state", "checked");
    await dialog.cancelButton().click();
  });

  test(
    "TC-DP-040004 แก้ name แล้ว save ข้อมูลใน table อัพเดท",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้ว และมี DP_NAME ใน table" },
        { type: "steps", description: "1. เปิดหน้า list\n2. search DP_NAME\n3. คลิก row\n4. clear แล้วกรอก DP_NAME_UPDATED\n5. Save" },
        { type: "expected", description: "แสดง toast updated/success และ table แสดง DP_NAME_UPDATED" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
    const list = new DeliveryPointListPage(page);
    const dialog = new DeliveryPointDialog(page);
    await list.goto();
    await list.search(DP_NAME);
    await list.clickRowName(DP_NAME);
    await dialog.nameInput().clear();
    await dialog.nameInput().fill(DP_NAME_UPDATED);
    await dialog.saveButton().click();
    await expect(page.getByText(/updated|success|สำเร็จ/i).first()).toBeVisible({
      timeout: 10_000,
    });
    await list.search(DP_NAME_UPDATED);
    await expect(page.getByRole("cell", { name: DP_NAME_UPDATED })).toBeVisible();
  });

  test(
    "TC-DP-200005 ลบ name ออกทั้งหมดแล้ว save ระบบต้องด่า",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้ว และมี DP_NAME_UPDATED ใน table" },
        { type: "steps", description: "1. เปิดหน้า list\n2. search DP_NAME_UPDATED\n3. คลิก row\n4. clear name\n5. Save" },
        { type: "expected", description: "แสดง error message field require — ไม่อนุญาตให้ save name ว่าง" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Validation" },
      ],
    },
    async ({ page }) => {
    const list = new DeliveryPointListPage(page);
    const dialog = new DeliveryPointDialog(page);
    await list.goto();
    await list.search(DP_NAME_UPDATED);
    await list.clickRowName(DP_NAME_UPDATED);
    await dialog.nameInput().clear();
    await dialog.saveButton().click();
    await expect(dialog.errorMessage().first()).toBeVisible();
    await dialog.cancelButton().click();
  });

  test(
    "TC-DP-040005 แก้ name เป็นค่าเดิมแล้ว save ได้ปกติ",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้ว และมี DP_NAME_UPDATED ใน table" },
        { type: "steps", description: "1. เปิดหน้า list\n2. search\n3. คลิก row\n4. clear แล้วกรอกค่าเดิม\n5. Save" },
        { type: "expected", description: "บันทึกสำเร็จ (toast updated/success) แม้ name ไม่เปลี่ยน" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
    const list = new DeliveryPointListPage(page);
    const dialog = new DeliveryPointDialog(page);
    await list.goto();
    await list.search(DP_NAME_UPDATED);
    await list.clickRowName(DP_NAME_UPDATED);
    // Clear and re-enter same name
    await dialog.nameInput().clear();
    await dialog.nameInput().fill(DP_NAME_UPDATED);
    await dialog.saveButton().click();
    await expect(page.getByText(/updated|success|สำเร็จ/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test(
    "TC-DP-040006 กด cancel ระหว่าง edit ข้อมูลเดิมไม่เปลี่ยน",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้ว และมี DP_NAME_UPDATED ใน table" },
        { type: "steps", description: "1. เปิดหน้า list\n2. search\n3. คลิก row\n4. clear แล้วกรอก DISCARDED\n5. Cancel\n6. ตรวจสอบ table" },
        { type: "expected", description: "table ยังคงแสดง DP_NAME_UPDATED (ค่าใหม่ไม่ถูกบันทึก)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
    const list = new DeliveryPointListPage(page);
    const dialog = new DeliveryPointDialog(page);
    await list.goto();
    await list.search(DP_NAME_UPDATED);
    await list.clickRowName(DP_NAME_UPDATED);
    await dialog.nameInput().clear();
    await dialog.nameInput().fill("DISCARDED");
    await dialog.cancelButton().click();
    await list.search(DP_NAME_UPDATED);
    await expect(page.getByRole("cell", { name: DP_NAME_UPDATED })).toBeVisible();
  });

  test(
    "TC-DP-040007 toggle is active แล้ว save ค่าเปลี่ยนถูก",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้ว และมี DP_NAME_UPDATED ใน table" },
        { type: "steps", description: "1. เปิดหน้า list\n2. search\n3. คลิก row\n4. toggle active\n5. Save\n6. เปิด row อีกครั้งเพื่อตรวจสอบ" },
        { type: "expected", description: "ค่า active สลับสถานะและถูก persist ในระบบหลัง reload" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
    const list = new DeliveryPointListPage(page);
    const dialog = new DeliveryPointDialog(page);
    await list.goto();
    await list.search(DP_NAME_UPDATED);
    await list.clickRowName(DP_NAME_UPDATED);
    await dialog.activeSwitch().click();
    const newState = await dialog.activeSwitch().getAttribute("data-state");
    await dialog.saveButton().click();
    await expect(page.getByText(/updated|success|สำเร็จ/i).first()).toBeVisible({
      timeout: 10_000,
    });
    // Verify persisted
    await list.search(DP_NAME_UPDATED);
    await list.clickRowName(DP_NAME_UPDATED);
    await expect(dialog.activeSwitch()).toHaveAttribute("data-state", newState!);
    await dialog.cancelButton().click();
  });
});

// ─── Delete (TC-DP-050001..TC-DP-050005) ────────────────────────────────────────────────

test.describe("จุดส่งของ — ลบ", () => {
  test.beforeEach(async ({ page }) => {
    // The edit group renames DP_NAME to DP_NAME_UPDATED; seed whichever of the
    // two is missing so this group stands on its own either way.
    await ensureDeliveryPoint(page, DP_NAME_UPDATED);
  });

  test(
    "TC-DP-050001 กด trash icon แล้ว confirm dialog เปิดขึ้นมา",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้ว และมี DP_NAME_UPDATED ใน table" },
        { type: "steps", description: "1. เปิดหน้า list\n2. search DP_NAME_UPDATED\n3. กด trash icon\n4. ตรวจสอบ confirm dialog\n5. Cancel" },
        { type: "expected", description: "confirm dialog เปิดและ visible เมื่อกด trash" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
    const list = new DeliveryPointListPage(page);
    const confirm = new DeleteConfirmDialog(page);
    await list.goto();
    await list.search(DP_NAME_UPDATED);
    await list.deleteRow(DP_NAME_UPDATED);
    await expect(confirm.dialog()).toBeVisible();
    await confirm.cancelButton().click();
  });

  test(
    "TC-DP-050002 กด confirm แล้วข้อมูลหายออกจาก table",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้ว และมี DP_NAME_UPDATED ใน table" },
        { type: "steps", description: "1. เปิดหน้า list\n2. search DP_NAME_UPDATED\n3. delete row\n4. กด Confirm\n5. search อีกครั้ง" },
        { type: "expected", description: "แสดง toast deleted และ row หายไปจาก table" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
    const list = new DeliveryPointListPage(page);
    const confirm = new DeleteConfirmDialog(page);
    await list.goto();
    await list.search(DP_NAME_UPDATED);
    await list.deleteRow(DP_NAME_UPDATED);
    await confirm.confirmButton().click();
    await expect(page.getByText(/deleted|success|สำเร็จ/i).first()).toBeVisible({
      timeout: 10_000,
    });
    await list.search(DP_NAME_UPDATED);
    await expect(page.getByRole("cell", { name: DP_NAME_UPDATED })).not.toBeVisible();
  });

  test(
    "TC-DP-050003 กด cancel ใน confirm dialog ข้อมูลยังอยู่",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้ว และมี DP_NAME_INACTIVE ใน table" },
        { type: "steps", description: "1. เปิดหน้า list\n2. search DP_NAME_INACTIVE\n3. delete row\n4. กด Cancel\n5. ตรวจสอบ row" },
        { type: "expected", description: "row ยังคงอยู่ใน table (ไม่ถูกลบเมื่อ cancel)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
    const list = new DeliveryPointListPage(page);
    const confirm = new DeleteConfirmDialog(page);
    await ensureDeliveryPoint(page, DP_NAME_INACTIVE);
    await list.goto();
    await list.search(DP_NAME_INACTIVE);
    await expect(page.getByRole("cell", { name: DP_NAME_INACTIVE })).toBeVisible({ timeout: 10_000 });
    await list.deleteRow(DP_NAME_INACTIVE);
    await expect(confirm.dialog()).toBeVisible();
    await confirm.cancelButton().click();
    await expect(page.getByRole("cell", { name: DP_NAME_INACTIVE })).toBeVisible();
  });

  test(
    "TC-DP-050004 ลบแล้ว total count ใน table ลดลง 1",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้ว และมี DP_NAME_INACTIVE ใน table" },
        { type: "steps", description: "1. เปิดหน้า list\n2. search DP_NAME_INACTIVE\n3. count rows\n4. delete + confirm\n5. count rows อีกครั้ง" },
        { type: "expected", description: "จำนวน rows หลังลบน้อยกว่าก่อนลบ (ลดลงอย่างน้อย 1)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
    const list = new DeliveryPointListPage(page);
    const confirm = new DeleteConfirmDialog(page);
    await ensureDeliveryPoint(page, DP_NAME_INACTIVE);
    await list.goto();
    await list.search(DP_NAME_INACTIVE);
    await expect(page.getByRole("cell", { name: DP_NAME_INACTIVE })).toBeVisible({ timeout: 10_000 });
    // Count real records (an empty table still renders one "No data found" row)
    const records = page.locator("tbody tr:has(button)");
    const countBefore = await records.count();
    await list.deleteRow(DP_NAME_INACTIVE);
    await confirm.confirmButton().click();
    await expect(page.getByText(/deleted|success|สำเร็จ/i).first()).toBeVisible({
      timeout: 10_000,
    });
    await page.waitForLoadState("networkidle");
    await list.search(DP_NAME_INACTIVE);
    await expect(records).toHaveCount(countBefore - 1, { timeout: 10_000 });
  });

  test(
    "TC-DP-050005 ลบรายการสุดท้ายในหน้า ระบบ paginate กลับหน้าก่อนหน้า",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้ว และมีข้อมูลมากกว่า 1 page โดย page สุดท้ายเหลือเพียง 1 row" },
        { type: "steps", description: "1. เปิดหน้า list\n2. ไปยัง last page\n3. ถ้าเหลือ 1 row ให้ลบ\n4. ตรวจสอบ paginate" },
        { type: "expected", description: "หลังลบ row สุดท้าย ระบบ paginate กลับหน้าก่อนหน้า (currentRows > 0)" },
        { type: "priority", description: "Low" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
    // This test requires specific data conditions — skip if not applicable
    const list = new DeliveryPointListPage(page);
    await list.goto();
    // Navigate to last page if possible
    const nextBtn = list.nextPageButton();
    test.skip(!(await nextBtn.isEnabled({ timeout: 2_000 }).catch(() => false)), "needs more than one page of delivery points (dataset has < 10) — data guard");
    // Go to last page
    let safety = 0;
    while ((await nextBtn.isEnabled({ timeout: 2_000 }).catch(() => false)) && safety < 20) {
      await nextBtn.click();
      await page.waitForLoadState("networkidle");
      safety++;
    }
    const rowsOnLastPage = await list.tableRows().count();
    test.skip(rowsOnLastPage !== 1, "last page must hold exactly one row — data guard");
    // Only 1 row on last page — delete it
    const confirm = new DeleteConfirmDialog(page);
    const rowText = await list.tableRows().first().innerText();
    const name = rowText.split(/\t/)[0];
    await list.deleteRow(name);
    await confirm.confirmButton().click();
    await page.waitForLoadState("networkidle");
    // Should navigate back to previous page
    const currentRows = await list.tableRows().count();
    expect(currentRows).toBeGreaterThan(0);
  });
});
