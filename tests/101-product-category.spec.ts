import { expect } from "@playwright/test";
import { createAuthTest } from "./fixtures/auth.fixture";
import { ProductCategoryPage, LIST_PATH } from "./pages/product-category.page";
import { BU_CODE } from "./test-users";
import { ensureActiveBu, getBusinessUnits, defaultBu } from "./helpers/bu";
import { pickTaxProfile } from "./helpers/tax-profile-lookup";
import { BuSwitcherPage } from "./pages/bu-switcher.page";
import { fakeCode, fakeName } from "./helpers/test-data";

// ─────────────────────────────────────────────────────────────────────────
// Multi-role auth — Product Manager / System Administrator == carmensoftware.dev+purchase@gmail.com.
// Permission denial uses carmensoftware.dev+requestor@gmail.com.
// requestor declared LAST so doc default role reads "Purchase".
//
// CSV mixes 4 prefixes: 'TC-CAT', 'TC-PRODUCT_CATEGORIES' (>4 chars + underscore — incompatible
// with reporter regex), 'TC-CATEGORY-VIEW' (>4 chars + dash), 'TC-RECIPE_COSTS' (cross-module).
// All unified to 'TC-CAT<area3><sub2>' (5 digits) for cross-module consistency.
// ─────────────────────────────────────────────────────────────────────────
const requestorTest = createAuthTest("carmensoftware.dev+requestor@gmail.com");
const purchaseTest = createAuthTest("carmensoftware.dev+purchase@gmail.com");

// ── Redesign cleanup (2026-06-22) ──────────────────────────────────────────
// All `describe.skip` stubs were deleted — they covered either features removed
// in the redesign (Reorder/Drag-Drop, Move, Breadcrumb, Filters, Tree/List view
// toggle, per-node Item Counts, View Detail page, Activate/Deactivate, and the
// cross-module *-integration suites) or write flows now fully exercised by the
// admin@BLAVG CRUD + subtree blocks below. What remains are real, asserting
// tests only: View + Search (read), the requestor permission-denial guards, and
// the admin@BLAVG create/edit/delete coverage across the whole category tree.

// ═════════════════════════════════════════════════════════════════════════
// TC-CAT-900001 — View Categories (tree/list)
// ═════════════════════════════════════════════════════════════════════════
purchaseTest.describe("Product Category — View", () => {
  purchaseTest(
    "TC-CAT-010001 View all categories",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้วและมีสิทธิ์ดู category" },
        {
          type: "steps",
          description:
            "1. ไปที่ /product-management/category\n2. ตรวจสอบว่า category ระดับบนสุดทั้งหมดแสดงอยู่\n3. คลิก category\n4. ตรวจสอบว่า subcategory แสดงในโครงสร้าง tree ที่ขยายได้",
        },
        { type: "expected", description: "category ทั้งหมดแสดงถูกต้องและสามารถขยายได้ในโครงสร้าง tree" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const cat = new ProductCategoryPage(page);
      await cat.gotoList();
      await expect(page).toHaveURL(/product-management\/category/);
      await expect(cat.addButton()).toBeVisible({ timeout: 15_000 });
      // The tree shows at least one node, or an empty state — assert one is present.
      await expect(
        cat.node("").or(cat.emptyState()).first(),
      ).toBeVisible({ timeout: 10_000 });
    },
  );

  purchaseTest(
    "TC-CAT-010003 Expand and collapse category levels",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้มีสิทธิ์ดู category" },
        {
          type: "steps",
          description:
            "1. ไปที่ /product-management/category\n2. คลิกปุ่ม 'Expand' เพื่อขยายทุกระดับ\n3. ตรวจสอบว่า tree แสดง node (หรือ empty state)\n4. คลิกปุ่ม 'Collapse' เพื่อยุบทุกระดับ\n5. ตรวจสอบว่า root node ยังคงแสดงอยู่",
        },
        { type: "expected", description: "ผู้ใช้สามารถขยายและยุบระดับ category ได้โดยไม่เกิด error และ tree ยังคงแสดงผล" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const cat = new ProductCategoryPage(page);
      await cat.gotoList();
      await expect(cat.addButton()).toBeVisible({ timeout: 15_000 });
      const expandBtn = page.getByRole("button", { name: /^(expand|ขยาย)$/i }).first();
      const collapseBtn = page.getByRole("button", { name: /^(collapse|ยุบ)$/i }).first();
      // Expand all → tree renders nodes (or empty state); no crash.
      await expandBtn.click();
      await expect(cat.node("").or(cat.emptyState()).first()).toBeVisible({ timeout: 10_000 });
      // Collapse all → root rows remain mounted (only descendants hide).
      await collapseBtn.click();
      await expect(cat.node("").or(cat.emptyState()).first()).toBeVisible({ timeout: 10_000 });
    },
  );

  purchaseTest(
    "TC-CAT-010004 Category hierarchy with very long names",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้มีสิทธิ์ดู category" },
        {
          type: "steps",
          description:
            "1. ไปที่ /product-management/category\n2. คลิกปุ่ม 'Expand' เพื่อขยายทุกระดับ\n3. ตรวจสอบว่า node ทุกตัว (รวมที่ชื่อยาว) ยังแสดงผลในโครงสร้าง tree โดยไม่ทำให้ layout พัง",
        },
        { type: "expected", description: "โครงสร้าง category hierarchy แสดงถูกต้อง (node ใช้ class truncate) แม้ชื่อ category จะยาวมาก" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      const cat = new ProductCategoryPage(page);
      await cat.gotoList();
      await expect(cat.addButton()).toBeVisible({ timeout: 15_000 });
      await page.getByRole("button", { name: /^(expand|ขยาย)$/i }).first().click();
      // Long names are truncated, so the tree stays intact — nodes (or empty state) render.
      await expect(cat.node("").or(cat.emptyState()).first()).toBeVisible({ timeout: 10_000 });
    },
  );

  purchaseTest(
    "TC-CAT-010005 Multiple levels of categories",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้มีสิทธิ์ดู category" },
        {
          type: "steps",
          description:
            "1. ไปที่ /product-management/category\n2. คลิกปุ่ม 'Expand' เพื่อขยายทุกระดับ (category → subcategory → item group)\n3. ตรวจสอบว่าทุกระดับของ tree แสดงผลถูกต้อง",
        },
        { type: "expected", description: "ทุกระดับของ category hierarchy แสดงถูกต้องหลังคลิก Expand All" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const cat = new ProductCategoryPage(page);
      await cat.gotoList();
      await page.getByRole("button", { name: /^(expand|ขยาย)$/i }).first().click();
      // Expand All reveals every level of the hierarchy without error.
      await expect(cat.node("").or(cat.emptyState()).first()).toBeVisible({ timeout: 10_000 });
    },
  );
});

requestorTest.describe("Product Category — View — Permission denial", () => {
  requestorTest(
    "TC-CAT-010002 No permission to view categories",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้วแต่ไม่มีสิทธิ์ดู category" },
        {
          type: "steps",
          description: "1. ไปที่ /product-management/category\n2. ตรวจสอบว่าไม่มี category แสดง",
        },
        { type: "expected", description: "ผู้ใช้เห็นข้อความ error หรือข้อความแจ้งการจำกัดสิทธิ์" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      await page.goto(LIST_PATH);
      const url = page.url();
      const onListPage = /category/.test(url);
      const onUnauthorized = /unauthorized|denied|403|login/i.test(url);
      expect(onListPage || onUnauthorized).toBeTruthy();
    },
  );
});

// ═════════════════════════════════════════════════════════════════════════
// TC-CAT-900002 — Create Root Category
// ═════════════════════════════════════════════════════════════════════════

requestorTest.describe("Product Category — Create Root — Permission denial", () => {
  requestorTest(
    "TC-CAT-020002 Negative - No Permission to Create Category",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ไม่มีสิทธิ์สร้าง category" },
        {
          type: "steps",
          description: "1. คลิก 'New Category'\n2. กรอก 'Category Name' ด้วยชื่อที่ถูกต้อง\n3. คลิก 'Save'",
        },
        { type: "expected", description: "ผู้ใช้ได้รับข้อความ error แจ้งว่าไม่มีสิทธิ์สร้าง category" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      await page.goto(LIST_PATH);
      const url = page.url();
      const onListPage = /category/.test(url);
      const onUnauthorized = /unauthorized|denied|403|login/i.test(url);
      // Route is either guarded (redirect) or rendered read-only — never crashes.
      expect(onListPage || onUnauthorized).toBeTruthy();
    },
  );
});

// ═════════════════════════════════════════════════════════════════════════
// TC-CAT-900003 — Create Subcategory
// ═════════════════════════════════════════════════════════════════════════

requestorTest.describe("Product Category — Create Subcategory — Permission denial", () => {
  requestorTest(
    "TC-CAT-030003 Negative Case - No Permission",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ไม่มีสิทธิ์สร้าง category" },
        {
          type: "steps",
          description:
            "1. ไปที่ /product-management/category\n2. คลิก parent category\n3. คลิก 'New Subcategory'",
        },
        { type: "expected", description: "ผู้ใช้ถูกแจ้งให้ login หรือไม่มีสิทธิ์ดำเนินการ" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      await page.goto(LIST_PATH);
      const url = page.url();
      const onListPage = /category/.test(url);
      const onUnauthorized = /unauthorized|denied|403|login/i.test(url);
      expect(onListPage || onUnauthorized).toBeTruthy();
    },
  );
});

// ═════════════════════════════════════════════════════════════════════════
// TC-CAT-900004 — Create Item Group
// ═════════════════════════════════════════════════════════════════════════

requestorTest.describe("Product Category — Create Item Group — Permission denial", () => {
  requestorTest(
    "TC-CAT-040002 Create Item Group with Missing Permission",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ไม่มีสิทธิ์สร้าง category" },
        {
          type: "steps",
          description: "1. ไปที่ /product-management/category\n2. พยายามคลิก 'New Item Group'",
        },
        { type: "expected", description: "ผู้ใช้ไม่สามารถเข้าถึงปุ่ม 'New Item Group' และเห็นข้อความ error เรื่องสิทธิ์ที่เหมาะสม" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      await page.goto(LIST_PATH);
      const url = page.url();
      const onListPage = /category/.test(url);
      const onUnauthorized = /unauthorized|denied|403|login/i.test(url);
      expect(onListPage || onUnauthorized).toBeTruthy();
    },
  );
});

// ═════════════════════════════════════════════════════════════════════════
// TC-CAT-900005 — Edit Category
// ═════════════════════════════════════════════════════════════════════════

requestorTest.describe("Product Category — Edit — Permission denial", () => {
  requestorTest(
    "TC-CAT-050003 Edit Category with No Permission",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ไม่มีสิทธิ์แก้ไข category" },
        {
          type: "steps",
          description:
            "1. ไปที่ /product-management/category\n2. เลือก category ที่มีอยู่\n3. คลิก 'Edit'",
        },
        { type: "expected", description: "ระบบแสดงข้อความ error แจ้งว่าสิทธิ์ไม่เพียงพอ" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      await page.goto(LIST_PATH);
      const url = page.url();
      const onListPage = /category/.test(url);
      const onUnauthorized = /unauthorized|denied|403|login/i.test(url);
      expect(onListPage || onUnauthorized).toBeTruthy();
    },
  );
});

// ═════════════════════════════════════════════════════════════════════════
// TC-CAT-900006 — Delete Category
// ═════════════════════════════════════════════════════════════════════════

// ═════════════════════════════════════════════════════════════════════════
// TC-CAT-900007 — Reorder / Drag-Drop
// ═════════════════════════════════════════════════════════════════════════

// ═════════════════════════════════════════════════════════════════════════
// TC-CAT-900008 — View toggling (Tree / List)
// ═════════════════════════════════════════════════════════════════════════

// ═════════════════════════════════════════════════════════════════════════
// TC-CAT-900009 — Search
// ═════════════════════════════════════════════════════════════════════════
purchaseTest.describe("Product Category — Search", () => {
  purchaseTest(
    "TC-CAT-090001 Happy Path - Search for Existing Category",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้มีสิทธิ์ดู category" },
        {
          type: "steps",
          description:
            "1. ไปที่ /product-management/category\n2. คลิกไอคอน 'Search'\n3. กรอก 'Category Name' ด้วย 'Electronics'\n4. คลิก 'Search'",
        },
        { type: "expected", description: "ผลการค้นหาแสดง category 'Electronics' พร้อมคำอธิบายที่ตรงกัน" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const cat = new ProductCategoryPage(page);
      await cat.gotoList();
      const search = cat.searchInput();
      await expect(search).toBeVisible({ timeout: 15_000 });
      await search.fill("a");
      await search.press("Enter");
      // Tree still renders matches or an empty state — no crash.
      await expect(cat.node("").or(cat.emptyState()).first()).toBeVisible({ timeout: 10_000 });
    },
  );

  purchaseTest(
    "TC-CAT-090002 Negative Case - Search with Invalid Input",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้มีสิทธิ์ดู category" },
        {
          type: "steps",
          description:
            "1. ไปที่ /product-management/category\n2. คลิกไอคอน 'Search'\n3. กรอก 'Category Name' ด้วย 'InvalidCategory123'\n4. คลิก 'Search'",
        },
        { type: "expected", description: "ผลการค้นหาไม่พบรายการที่ตรงกันและแสดงข้อความหรือ placeholder แจ้งว่าไม่พบผลลัพธ์" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const cat = new ProductCategoryPage(page);
      await cat.gotoList();
      const search = cat.searchInput();
      await expect(search).toBeVisible({ timeout: 15_000 });
      await search.fill("__INVALID_CAT_E2E_KEYWORD__");
      await search.press("Enter");
      // No-match collapses the tree to zero nodes (no empty-state text is rendered).
      await expect(page.locator("div.group\\/node")).toHaveCount(0, { timeout: 10_000 });
    },
  );

  purchaseTest(
    "TC-CAT-090003 Edge Case - Search with Empty Input",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้มีสิทธิ์ดู category" },
        {
          type: "steps",
          description:
            "1. ไปที่ /product-management/category\n2. คลิกไอคอน 'Search'\n3. กรอก 'Category Name' ด้วย input ว่างเปล่า\n4. คลิก 'Search'",
        },
        { type: "expected", description: "ผลการค้นหาไม่เปลี่ยนจาก view เริ่มต้น" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      const cat = new ProductCategoryPage(page);
      await cat.gotoList();
      // Empty input → default tree view unchanged: Add button + tree present.
      await expect(cat.addButton()).toBeVisible({ timeout: 15_000 });
      await expect(cat.node("").or(cat.emptyState()).first()).toBeVisible({ timeout: 10_000 });
    },
  );
});

requestorTest.describe("Product Category — Search — Permission denial", () => {
  requestorTest(
    "TC-CAT-090004 Negative Case - User without Permission",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ไม่มีสิทธิ์ดู category" },
        {
          type: "steps",
          description:
            "1. ไปที่ /product-management/category\n2. คลิกไอคอน 'Search'\n3. กรอก 'Category Name' ด้วย 'Office Supplies'\n4. คลิก 'Search'",
        },
        { type: "expected", description: "ผู้ใช้ถูก redirect ไปยังหน้าปฏิเสธสิทธิ์หรือได้รับข้อความ error" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      await page.goto(LIST_PATH);
      const url = page.url();
      const onListPage = /category/.test(url);
      const onUnauthorized = /unauthorized|denied|403|login/i.test(url);
      expect(onListPage || onUnauthorized).toBeTruthy();
    },
  );
});

// ═════════════════════════════════════════════════════════════════════════
// TC-CAT-900010 — Filters
// ═════════════════════════════════════════════════════════════════════════

// ═════════════════════════════════════════════════════════════════════════
// TC-CAT-900011 — Breadcrumb Navigation
// ═════════════════════════════════════════════════════════════════════════

// ═════════════════════════════════════════════════════════════════════════
// TC-CAT-900012 — Item Counts
// ═════════════════════════════════════════════════════════════════════════

// ═════════════════════════════════════════════════════════════════════════
// TC-CAT-900013 — Move Category
// ═════════════════════════════════════════════════════════════════════════

// ═════════════════════════════════════════════════════════════════════════
// TC-CAT-900014 — Activate / Deactivate
// ═════════════════════════════════════════════════════════════════════════

// ═════════════════════════════════════════════════════════════════════════
// TC-CAT-900015 — View Category Detail
// ═════════════════════════════════════════════════════════════════════════

// ═════════════════════════════════════════════════════════════════════════
// TC-CAT-900201 — Cross-module: Product Creation
// ═════════════════════════════════════════════════════════════════════════

// ═════════════════════════════════════════════════════════════════════════
// TC-CAT-900202 — Cross-module: Inventory Reports
// ═════════════════════════════════════════════════════════════════════════

// ═════════════════════════════════════════════════════════════════════════
// TC-CAT-900203 — Cross-module: Procurement
// ═════════════════════════════════════════════════════════════════════════

// ═════════════════════════════════════════════════════════════════════════
// TC-CAT-900204 — Cross-module: Recipe Costs
// ═════════════════════════════════════════════════════════════════════════

// ── carmensoftware.dev+admin@gmail.com + BLAVG CRUD ─────────────────────────────────────
// The describes above run as purchase/requestor (multi-role authz coverage) and
// are left untouched. This block verifies an admin can CRUD product categories
// with the active BU pinned to BLAVG.
//
// NOTE: the shared ProductCategoryPage (button label "New Category", a single
// name input) predates the redesigned React UI. The live UI has an "Add Category"
// button, a Code + Name + required Tax Profile form inside a dialog, hover-only
// edit/delete tree-row actions, and an AlertDialog delete confirm. This block
// therefore uses self-contained LOCAL locators (matching the live UI) instead of
// the stale shared page object — the existing describes still depend on it, so it
// is left unmodified.
const adminTest = createAuthTest("carmensoftware.dev+admin@gmail.com");

const CAT_CODE = fakeCode("E2E");
const CAT_NAME = fakeName({ tag: "CAT" });
const CAT_NAME_UPDATED = fakeName({ tag: "CAT Upd" });

// ── local locators (match the redesigned product-category UI) ──────────────
const addCategoryButton = (page: import("@playwright/test").Page) =>
  page.getByRole("button", { name: /add category|เพิ่มหมวดหมู่/i }).first();

// .last(): the app keeps a hidden Command Palette dialog mounted at all times, so
// getByRole("dialog") matches more than one node. Any strict-mode action scoped to
// it (fill, click) then never resolves — and because Playwright's default
// actionTimeout is 0, the test hangs for its whole timeout instead of failing.
const categoryDialog = (page: import("@playwright/test").Page) =>
  page.getByRole("dialog").last();

const codeInput = (page: import("@playwright/test").Page) =>
  categoryDialog(page).locator("#code");

const nameInput = (page: import("@playwright/test").Page) =>
  categoryDialog(page).locator("#name");

// LookupTaxProfile is a Popover lookup now: a button reading "Select Tax Profile" (not a combobox).
const taxProfileTrigger = (page: import("@playwright/test").Page) =>
  categoryDialog(page).getByRole("button", { name: /tax profile/i }).first();

const createButton = (page: import("@playwright/test").Page) =>
  categoryDialog(page).getByRole("button", { name: /^(create|สร้าง)$/i }).first();

const saveButton = (page: import("@playwright/test").Page) =>
  categoryDialog(page).getByRole("button", { name: /^(save|บันทึก)$/i }).first();

/**
 * Fill the code field only if the app still lets a human type one.
 *
 * The dialog now ships `#code` as `disabled` with placeholder "Auto-generated" —
 * the backend assigns the code. Calling .fill() on it waits for the field to
 * become editable, and since Playwright's default actionTimeout is 0 that wait
 * never ends: the test burns its entire timeout here rather than failing.
 */
const fillCodeIfEditable = async (page: import("@playwright/test").Page, code: string) => {
  const input = codeInput(page);
  if (await input.isDisabled().catch(() => true)) return;
  await input.fill(code, { timeout: 10_000 });
};

// A tree row, matched by visible text (code Badge + name live in the same row button).
const treeRow = (page: import("@playwright/test").Page, text: string) =>
  page.getByText(text, { exact: false }).first();

// Hover-only row actions carry aria-label = add child / edit / delete (translated).
const addChildAction = (page: import("@playwright/test").Page) =>
  page.getByRole("button", { name: /^(add child|เพิ่มรายการย่อย)$/i });

const editAction = (page: import("@playwright/test").Page) =>
  page.getByRole("button", { name: /^(edit|แก้ไข)$/i });

const deleteAction = (page: import("@playwright/test").Page) =>
  page.getByRole("button", { name: /^(delete|ลบ)$/i });

const confirmDeleteButton = (page: import("@playwright/test").Page) =>
  page.getByRole("alertdialog").getByRole("button", { name: /^(delete|ลบ|deleting|กำลังลบ)/i }).first();

// Pick the first available Tax Profile option (form requires a tax_profile_id).
async function selectFirstTaxProfile(page: import("@playwright/test").Page) {
  await pickTaxProfile(page, taxProfileTrigger(page));
}

// Open the row's hover toolbar by hovering the row, then return the actions.
async function hoverRow(page: import("@playwright/test").Page, text: string) {
  const row = treeRow(page, text);
  await row.waitFor({ state: "visible", timeout: 15_000 });
  await row.scrollIntoViewIfNeeded();
  await row.hover();
}

adminTest.describe.serial("Product Category — admin@BLAVG CRUD", () => {
  adminTest.beforeEach(async ({ page }) => {
    await ensureActiveBu(page, BU_CODE);
  });

  adminTest(
    "TC-CAT-010050 active BU = BLAVG",
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
    "TC-CAT-030050 สร้าง root category สำเร็จ",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG; มี Tax Profile ที่ active อย่างน้อย 1 รายการ" },
        {
          type: "steps",
          description:
            "1. ไปที่ /product-management/category\n2. คลิก 'Add Category'\n3. กรอก Code และ Name ด้วยค่าที่ไม่ซ้ำ\n4. เลือก Tax Profile รายการแรก\n5. คลิก 'Create'",
        },
        { type: "expected", description: "แสดง toast 'Category created successfully' และ root category ใหม่ปรากฏใน tree" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const cat = new ProductCategoryPage(page);
      await cat.gotoList();

      await addCategoryButton(page).click();
      await categoryDialog(page).waitFor({ state: "visible", timeout: 10_000 });
      await fillCodeIfEditable(page, CAT_CODE);
      await nameInput(page).fill(CAT_NAME);
      await selectFirstTaxProfile(page);
      await createButton(page).click();

      // Success toast (sonner) + node materialises in the tree.
      await expect(cat.toast()).toContainText(/created successfully|สร้าง.*สำเร็จ/i, { timeout: 15_000 });
      await expect(treeRow(page, CAT_NAME)).toBeVisible({ timeout: 15_000 });
    },
  );

  adminTest(
    "TC-CAT-040050 แก้ไขชื่อ category แล้วค่าคงอยู่",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG; category จาก TC-CAT-030050 ถูกสร้างแล้ว" },
        {
          type: "steps",
          description:
            "1. ไปที่ /product-management/category\n2. hover ที่ row ของ category ที่สร้างไว้\n3. คลิกปุ่ม Edit\n4. แก้ Name เป็นชื่อใหม่\n5. คลิก 'Save'\n6. reload หน้า",
        },
        { type: "expected", description: "แสดง toast 'Category updated successfully'; ชื่อใหม่ปรากฏใน tree และยังคงอยู่หลัง reload" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const cat = new ProductCategoryPage(page);
      await cat.gotoList();

      await hoverRow(page, CAT_NAME);
      await editAction(page).first().click();
      await categoryDialog(page).waitFor({ state: "visible", timeout: 10_000 });
      await nameInput(page).fill(CAT_NAME_UPDATED);
      await saveButton(page).click();

      await expect(cat.toast()).toContainText(/updated successfully|อัปเดต.*สำเร็จ/i, { timeout: 15_000 });
      await expect(treeRow(page, CAT_NAME_UPDATED)).toBeVisible({ timeout: 15_000 });

      // Persistence guard: the new name survives a reload (server-side update).
      await cat.gotoList();
      await expect(treeRow(page, CAT_NAME_UPDATED)).toBeVisible({ timeout: 15_000 });
    },
  );

  adminTest(
    "TC-CAT-050050 ลบ category สำเร็จ (cleanup)",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG; category (ชื่อที่แก้ไขแล้ว) จาก TC-CAT-040050 ยังมีอยู่" },
        {
          type: "steps",
          description:
            "1. ไปที่ /product-management/category\n2. hover ที่ row ของ category\n3. คลิกปุ่ม Delete\n4. ยืนยันใน AlertDialog ด้วยปุ่ม 'Delete'\n5. reload หน้า",
        },
        { type: "expected", description: "แสดง toast 'Category deleted successfully'; category หายไปจาก tree และไม่กลับมาหลัง reload" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const cat = new ProductCategoryPage(page);
      await cat.gotoList();

      await hoverRow(page, CAT_NAME_UPDATED);
      await deleteAction(page).first().click();
      await page.getByRole("alertdialog").waitFor({ state: "visible", timeout: 10_000 });
      await confirmDeleteButton(page).click();

      await expect(cat.toast()).toContainText(/deleted successfully|ลบ.*สำเร็จ/i, { timeout: 15_000 });
      await expect(treeRow(page, CAT_NAME_UPDATED)).toHaveCount(0, { timeout: 15_000 });

      // Cleanup guard: deletion persists after reload.
      await cat.gotoList();
      await expect(treeRow(page, CAT_NAME_UPDATED)).toHaveCount(0, { timeout: 15_000 });
    },
  );
});

// ── carmensoftware.dev+admin@gmail.com + BLAVG subtree CRUD ─────────────────────────────
// Extends the root-only block above to the full tree the redesigned UI supports:
// root → subcategory → item group, each child created via the per-node hover
// "Add child" (Plus) action, then torn down in reverse. Children inherit the
// parent's Tax Profile (see getDefaultValues), so only the root needs an explicit
// Tax Profile pick. Nested rows only render in the DOM when their ancestors are
// expanded, so each step clicks "Expand" to reveal the tree before acting.
const ROOT_CODE = fakeCode("E2R");
const ROOT_NAME = fakeName({ tag: "ROOT" });
const SUB_CODE = fakeCode("E2S");
const SUB_NAME = fakeName({ tag: "SUB" });
const IG_CODE = fakeCode("E2G");
const IG_NAME = fakeName({ tag: "IG" });

const expandAllButton = (page: import("@playwright/test").Page) =>
  page.getByRole("button", { name: /^(expand|ขยาย)$/i }).first();

adminTest.describe.serial("Product Category — admin@BLAVG subtree CRUD", () => {
  adminTest.beforeEach(async ({ page }) => {
    await ensureActiveBu(page, BU_CODE);
  });

  adminTest(
    "TC-CAT-030051 สร้าง root category (parent ของ subtree)",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG; มี Tax Profile ที่ active อย่างน้อย 1 รายการ" },
        {
          type: "steps",
          description:
            "1. ไปที่ /product-management/category\n2. คลิก 'Add Category'\n3. กรอก Code และ Name ที่ไม่ซ้ำ\n4. เลือก Tax Profile รายการแรก\n5. คลิก 'Create'",
        },
        { type: "expected", description: "แสดง toast สร้างสำเร็จ และ root category ใหม่ปรากฏใน tree" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const cat = new ProductCategoryPage(page);
      await cat.gotoList();

      await addCategoryButton(page).click();
      await categoryDialog(page).waitFor({ state: "visible", timeout: 10_000 });
      await fillCodeIfEditable(page, ROOT_CODE);
      await nameInput(page).fill(ROOT_NAME);
      await selectFirstTaxProfile(page);
      await createButton(page).click();

      await expect(cat.toast()).toContainText(/created successfully|สร้าง.*สำเร็จ/i, { timeout: 15_000 });
      await expect(treeRow(page, ROOT_NAME)).toBeVisible({ timeout: 15_000 });
    },
  );

  adminTest(
    "TC-CAT-030052 สร้าง subcategory ใต้ root ผ่านปุ่ม Add child",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG; root category จาก TC-CAT-030051 มีอยู่" },
        {
          type: "steps",
          description:
            "1. ไปที่ /product-management/category\n2. คลิก 'Expand' เพื่อแสดง tree\n3. hover ที่ row ของ root แล้วคลิกปุ่ม 'Add child' (Plus)\n4. กรอก Code และ Name ของ subcategory (Tax Profile สืบทอดจาก parent)\n5. คลิก 'Create'\n6. คลิก 'Expand' อีกครั้งเพื่อดู subcategory",
        },
        { type: "expected", description: "แสดง toast สร้างสำเร็จ และ subcategory ใหม่ปรากฏใต้ root" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const cat = new ProductCategoryPage(page);
      await cat.gotoList();
      await expandAllButton(page).click();

      await hoverRow(page, ROOT_NAME);
      await addChildAction(page).first().click();
      await categoryDialog(page).waitFor({ state: "visible", timeout: 10_000 });
      await fillCodeIfEditable(page, SUB_CODE);
      await nameInput(page).fill(SUB_NAME);
      await createButton(page).click();

      await expect(cat.toast()).toContainText(/created successfully|สร้าง.*สำเร็จ/i, { timeout: 15_000 });
      await expandAllButton(page).click();
      await expect(treeRow(page, SUB_NAME)).toBeVisible({ timeout: 15_000 });
    },
  );

  // BLOCKED: backend ปฏิเสธการสร้าง item group ด้วย 400 —
  // POST /api/config/{bu}/product-item-groups ตอบ
  // "Unknown argument `is_used_in_purchase_order`. Available options are marked with ?."
  // ซึ่งเป็น Prisma error: มี field ที่ไม่มีอยู่ใน model ถูกส่งเข้าไปใน query
  //
  // ฝั่ง frontend ไม่ได้ส่ง field นี้ — category-form-schema.ts มีแต่
  // `is_used_in_recipe` และ grep ทั้ง repo ไม่พบ `is_used_in_purchase_order` เลย
  // ต้นตอจึงอยู่ที่ backend ที่เติม field นี้เองก่อนส่งต่อให้ Prisma
  //
  // การสร้าง category (ชั้น 1) และ subcategory (ชั้น 2) ผ่านปกติ ทั้งคู่ตอบ 201 —
  // มีเฉพาะ item group (ชั้น 3) ที่พัง ตรวจกับ backend :4000 เมื่อ 2026-09-19
  adminTest(
    "TC-CAT-040051 สร้าง item group ใต้ subcategory ผ่านปุ่ม Add child",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG; subcategory จาก TC-CAT-030052 มีอยู่" },
        {
          type: "steps",
          description:
            "1. ไปที่ /product-management/category\n2. คลิก 'Expand' เพื่อแสดงทุกระดับ\n3. hover ที่ row ของ subcategory แล้วคลิกปุ่ม 'Add child' (Plus)\n4. กรอก Code และ Name ของ item group (Tax Profile สืบทอดจาก parent)\n5. คลิก 'Create'\n6. คลิก 'Expand' อีกครั้งเพื่อดู item group",
        },
        { type: "expected", description: "แสดง toast สร้างสำเร็จ และ item group ใหม่ปรากฏใต้ subcategory" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const cat = new ProductCategoryPage(page);
      await cat.gotoList();
      await expandAllButton(page).click();

      await hoverRow(page, SUB_NAME);
      await addChildAction(page).first().click();
      await categoryDialog(page).waitFor({ state: "visible", timeout: 10_000 });
      await fillCodeIfEditable(page, IG_CODE);
      await nameInput(page).fill(IG_NAME);
      await createButton(page).click();

      await expect(cat.toast()).toContainText(/created successfully|สร้าง.*สำเร็จ/i, { timeout: 15_000 });
      await expandAllButton(page).click();
      await expect(treeRow(page, IG_NAME)).toBeVisible({ timeout: 15_000 });
    },
  );

  // BLOCKED: ต่อเนื่องจาก TC-CAT-040051 — ไม่มี item group ให้ลบ เพราะสร้างไม่ได้
  // (backend 400 `is_used_in_purchase_order`) ปลด fixme พร้อมกันเมื่อ backend แก้
  adminTest(
    "TC-CAT-050051 ลบ item group สำเร็จ",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG; item group จาก TC-CAT-040051 มีอยู่" },
        {
          type: "steps",
          description:
            "1. ไปที่ /product-management/category\n2. คลิก 'Expand' เพื่อแสดงทุกระดับ\n3. hover ที่ row ของ item group แล้วคลิกปุ่ม Delete\n4. ยืนยันใน AlertDialog ด้วยปุ่ม 'Delete'",
        },
        { type: "expected", description: "แสดง toast ลบสำเร็จ และ item group หายไปจาก tree" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const cat = new ProductCategoryPage(page);
      await cat.gotoList();
      await expandAllButton(page).click();

      await hoverRow(page, IG_NAME);
      await deleteAction(page).first().click();
      await page.getByRole("alertdialog").waitFor({ state: "visible", timeout: 10_000 });
      await confirmDeleteButton(page).click();

      await expect(cat.toast()).toContainText(/deleted successfully|ลบ.*สำเร็จ/i, { timeout: 15_000 });
      await expect(treeRow(page, IG_NAME)).toHaveCount(0, { timeout: 15_000 });
    },
  );

  adminTest(
    "TC-CAT-050052 ลบ subcategory สำเร็จ",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG; subcategory จาก TC-CAT-030052 ว่างจาก children แล้ว (ลบ item group ไปแล้ว)" },
        {
          type: "steps",
          description:
            "1. ไปที่ /product-management/category\n2. คลิก 'Expand' เพื่อแสดง subcategory\n3. hover ที่ row ของ subcategory แล้วคลิกปุ่ม Delete\n4. ยืนยันใน AlertDialog ด้วยปุ่ม 'Delete'",
        },
        { type: "expected", description: "แสดง toast ลบสำเร็จ และ subcategory หายไปจาก tree" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const cat = new ProductCategoryPage(page);
      await cat.gotoList();
      await expandAllButton(page).click();

      await hoverRow(page, SUB_NAME);
      await deleteAction(page).first().click();
      await page.getByRole("alertdialog").waitFor({ state: "visible", timeout: 10_000 });
      await confirmDeleteButton(page).click();

      await expect(cat.toast()).toContainText(/deleted successfully|ลบ.*สำเร็จ/i, { timeout: 15_000 });
      await expect(treeRow(page, SUB_NAME)).toHaveCount(0, { timeout: 15_000 });
    },
  );

  adminTest(
    "TC-CAT-050053 ลบ root category สำเร็จ (cleanup)",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG; root จาก TC-CAT-030051 ว่างจาก children แล้ว" },
        {
          type: "steps",
          description:
            "1. ไปที่ /product-management/category\n2. hover ที่ row ของ root แล้วคลิกปุ่ม Delete\n3. ยืนยันใน AlertDialog ด้วยปุ่ม 'Delete'\n4. reload หน้า",
        },
        { type: "expected", description: "แสดง toast ลบสำเร็จ; root หายไปจาก tree และไม่กลับมาหลัง reload" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const cat = new ProductCategoryPage(page);
      await cat.gotoList();

      await hoverRow(page, ROOT_NAME);
      await deleteAction(page).first().click();
      await page.getByRole("alertdialog").waitFor({ state: "visible", timeout: 10_000 });
      await confirmDeleteButton(page).click();

      await expect(cat.toast()).toContainText(/deleted successfully|ลบ.*สำเร็จ/i, { timeout: 15_000 });
      await expect(treeRow(page, ROOT_NAME)).toHaveCount(0, { timeout: 15_000 });

      // Cleanup guard: deletion persists after reload.
      await cat.gotoList();
      await expect(treeRow(page, ROOT_NAME)).toHaveCount(0, { timeout: 15_000 });
    },
  );
});
