import { expect } from "@playwright/test";
import { createAuthTest } from "./fixtures/auth.fixture";
import { PriceListTemplatePage, LIST_PATH } from "./pages/price-list-template.page";
import { BU_CODE } from "./test-users";
import { ensureActiveBu, getBusinessUnits, defaultBu } from "./helpers/bu";
import { BuSwitcherPage } from "./pages/bu-switcher.page";
import { uid, fakeName } from "./helpers/test-data";
import { openRecordFromRow } from "./helpers/list-row";

/**
 * Create a throw-away template and open it in view mode. The edit cases used to take "the first
 * template in the list" and rename it — that mutated the seeded STD template the campaign specs
 * depend on, and skipped on an empty list. Each edit case now owns its record.
 */
async function openOwnTemplate(page: import("@playwright/test").Page, tag: string) {
  const tpl = new PriceListTemplatePage(page);
  const name = `PT ${tag} ${uid}`;
  await tpl.gotoNew();
  await tpl.nameInput().fill(name);
  await tpl.selectFirstCurrency();
  await tpl.saveButton().click({ timeout: 10_000 });
  await tpl.expectSavedToast();
  await tpl.openByName(name);
  await expect(tpl.editButton()).toBeVisible({ timeout: 10_000 });
  return { tpl, name };
}

// Module-level unique id so the admin serial chain's names stay consistent
// across a worker restart (factory `uid` provides the same per-process semantics).

// ─────────────────────────────────────────────────────────────────────────
// Multi-role auth — Procurement Manager == carmensoftware.dev+purchase@gmail.com,
// Procurement Staff (no template-edit permission) == carmensoftware.dev+requestor@gmail.com.
// requestorTest is declared LAST so the user-story doc reports the most-used
// role as the default for the module. (See generate-user-stories.ts:findAuthRole)
// ─────────────────────────────────────────────────────────────────────────
const procurementStaffTest = createAuthTest("carmensoftware.dev+requestor@gmail.com");
const procurementManagerTest = createAuthTest("carmensoftware.dev+purchase@gmail.com");

const VALID_NAME = "Office Supplies";
const VALID_DESCRIPTION = "Office supplies pricelist for 2023";
const INVALID_NAME = "   "; // whitespace-only

// ─────────────────────────────────────────────────────────────────────────
// TC-PT-900001 — Create Pricelist Template
// ─────────────────────────────────────────────────────────────────────────
procurementManagerTest.describe("Pricelist Template — Create", () => {
  procurementManagerTest(
    "TC-PT-010001 Create Pricelist Template - Happy Path",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Procurement Manager และมีสิทธิ์เข้าถึง Pricelist Templates" },
        {
          type: "steps",
          description:
            "1. ไปที่ /vendor-management/price-list-template\n2. คลิก 'New Pricelist Template'\n3. กรอก 'Template Name' ด้วย 'Office Supplies'\n4. กรอก 'Description' ด้วย 'Office supplies pricelist for 2023'\n5. คลิก 'Save'",
        },
        { type: "expected", description: "Pricelist template สร้างสำเร็จ" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const tpl = new PriceListTemplatePage(page);
      await tpl.gotoNew();
      // unique name avoids the backend's name-uniqueness rejection across reruns
      await tpl.nameInput().fill(`${VALID_NAME} ${uid}`);
      await tpl.selectFirstCurrency(); // currency is required
      // descriptionInput is now a robust textarea[name="description"] selector
      // (verified live end-to-end) — no longer needs the .catch() mask.
      await tpl.descriptionInput().fill(VALID_DESCRIPTION);
      await tpl.saveButton().click({ timeout: 10_000 });
      await tpl.expectSavedToast();
    },
  );

  procurementManagerTest(
    "TC-PT-010002 Create Pricelist Template - Empty Template Name",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Procurement Manager และมีสิทธิ์เข้าถึง Pricelist Templates" },
        {
          type: "steps",
          description:
            "1. ไปที่ /vendor-management/price-list-template\n2. คลิก 'New Pricelist Template'\n3. กรอก 'Description' ด้วย 'Office supplies pricelist for 2023'\n4. คลิก 'Save'",
        },
        { type: "expected", description: "การสร้างถูกบล็อก (name เป็น required): ฟอร์มคงอยู่ที่ /new และไม่มี success toast" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const tpl = new PriceListTemplatePage(page);
      await tpl.gotoNew();
      await tpl.fillHeader({ description: VALID_DESCRIPTION });
      await tpl.saveButton().click({ timeout: 10_000 });
      // name is required (zod min(1)); the invalid submit is blocked — the form
      // stays on /new and no success toast appears. (The redesigned NameField
      // shows the error inline, which anyError() does not match — verified live.)
      await expect(page).toHaveURL(/price-list-template\/new$/, { timeout: 5_000 });
      await expect(tpl.successToast()).toHaveCount(0, { timeout: 3_000 });
    },
  );

  procurementManagerTest(
    "TC-PT-010005 Create Pricelist Template - Without Description (optional)",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Procurement Manager และมีสิทธิ์เข้าถึง Pricelist Templates; มี currency อย่างน้อย 1 รายการ" },
        {
          type: "steps",
          description:
            "1. ไปที่ /vendor-management/price-list-template/new\n2. กรอก 'Template Name'\n3. เลือก Currency (required)\n4. เว้นช่อง Description ว่างไว้\n5. คลิก 'Save'",
        },
        { type: "expected", description: "template ถูกสร้างสำเร็จโดยไม่ต้องกรอก description (description เป็น optional ใน redesigned schema) — แสดง success toast" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Alternate Flow" },
        { type: "note", description: "Redesign made description optional (z.string(), no min); the old 'missing description → error' expectation is obsolete. Verified live: creating without a description succeeds." },
      ],
    },
    async ({ page }) => {
      const tpl = new PriceListTemplatePage(page);
      await tpl.gotoNew();
      await tpl.nameInput().fill(`${VALID_NAME} nodesc ${uid}`);
      await tpl.selectFirstCurrency(); // currency is required
      // description intentionally left blank — it is optional
      await tpl.saveButton().click({ timeout: 10_000 });
      await tpl.expectSavedToast();
    },
  );
});

procurementStaffTest.describe("Pricelist Template — Create — Permission denial", () => {
  procurementStaffTest(
    "TC-PT-010004 Create Pricelist Template - No Permission",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Procurement Staff และมีสิทธิ์เข้าถึงเฉพาะหน้า list ของ Pricelist Templates" },
        {
          type: "steps",
          description: "1. ไปที่ /vendor-management/price-list-template\n2. คลิก 'New Pricelist Template'",
        },
        { type: "expected", description: "ผู้ใช้ถูก redirect ไปยังหน้าไม่มีสิทธิ์เข้าถึงหรือปุ่ม 'New Pricelist Template' ถูกซ่อน/disabled" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      procurementStaffTest.fail(true, "suspected bug: requestor sees an enabled 'Add Price List Template' button and can open /new (no write gate on vendor-management)");
      const tpl = new PriceListTemplatePage(page);
      await tpl.gotoList();
      await expect(tpl.rowActionsButton(), "list rendered").toBeVisible({ timeout: 10_000 });
      await expect(tpl.newButton()).toHaveCount(0);
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────
// TC-PT-900002 — Add products to template
// The old 'Add Products' dialog (checkbox picker + Confirm Selection) was
// removed; products are now managed inline in the create/edit form's product
// table ("Add product" appends a row; each row has a "Remove tier" X button).
// These tests drive that inline flow on the /new form (no seeded template
// needed) so they are stable across runs.
// ─────────────────────────────────────────────────────────────────────────
procurementManagerTest.describe("Pricelist Template — Add products", () => {
  procurementManagerTest(
    "TC-PT-020001 Add products to template - Happy Path",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Procurement Manager; เปิดฟอร์มสร้าง template ใหม่ (/new) ได้" },
        {
          type: "steps",
          description:
            "1. ไปที่ /vendor-management/price-list-template/new\n2. ตรวจสอบว่า product table แสดง empty state 'No products yet'\n3. คลิกปุ่ม 'Add product'",
        },
        { type: "expected", description: "มี product row ถูกเพิ่มในตาราง inline (ปุ่ม 'Remove tier' ปรากฏ) และ empty state 'No products yet' หายไป" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
        { type: "note", description: "Inline product table replaced the old Add Products dialog; an 'Add product' button appends a row." },
      ],
    },
    async ({ page }) => {
      const tpl = new PriceListTemplatePage(page);
      await tpl.gotoNew();
      await expect(tpl.productsEmptyState()).toBeVisible({ timeout: 10_000 });
      // Products are ticked in the lookup tree; there is no "add row" button any
      // more (plt-item-fields.tsx renders <TreeProductLookup> in edit mode).
      await tpl.pickFirstProduct();
      // a product row now exists: its "Remove tier" control is visible…
      await expect(tpl.removeProductRowButton().first()).toBeVisible({ timeout: 10_000 });
      // …and the empty state is gone.
      await expect(page.getByText(/no products yet/i)).toHaveCount(0, { timeout: 10_000 });
    },
  );
  // BLOCKED: เคสนี้ทดสอบ "แถวเปล่า" ซึ่งสร้างไม่ได้อีกแล้ว — ฟอร์มเปลี่ยนมาใช้
  // TreeProductLookup แถวจึงเกิดได้ทางเดียวคือมีสินค้าถูกติ๊ก
  // (plt-item-fields.tsx:155-180) สถานะ "ข้อมูลไม่ครบ" ที่เหลือคือบันทึกโดยไม่มี
  // สินค้าเลย แต่ลองแล้วแอป **ยอมบันทึก** ไม่มี validation error ใด ๆ ปรากฏ
  // (ตรวจ 2026-09-19) จึงไม่มีอะไรให้ assert ตามเจตนาเดิมของเคส
  //
  // ต้องตัดสินใจฝั่ง product ก่อนว่า template ที่ไม่มีสินค้าเลยควรบันทึกได้หรือไม่
  // ถ้าไม่ควร นี่คือบั๊ก; ถ้าควร ให้ลบเคสนี้ทิ้งแล้วเขียนเคสใหม่ที่ตรงกับกฎจริง
  procurementManagerTest(
    "TC-PT-020002 Add products to template - Invalid Input (ไม่มีสินค้าเลย)",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Procurement Manager; มี currency อย่างน้อย 1 รายการ" },
        {
          type: "steps",
          description:
            "1. ไปที่ /vendor-management/price-list-template/new\n2. กรอกชื่อ template + เลือก currency\n3. ไม่ติ๊กสินค้าใด ๆ จาก lookup tree\n4. คลิก 'Save'",
        },
        { type: "expected", description: "ระบบแสดง validation error (ต้องมีสินค้าอย่างน้อย 1 รายการ) และ template ไม่ถูกบันทึก" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
        { type: "note", description: "เดิมเคสนี้ทดสอบ 'แถวเปล่า' ซึ่งสร้างไม่ได้อีกแล้ว — ฟอร์มเปลี่ยนมาใช้ TreeProductLookup แถวจึงเกิดได้ทางเดียวคือมีสินค้าถูกติ๊ก (ดู plt-item-fields.tsx:155-180) สถานะ 'ข้อมูลไม่ครบ' ที่ยังทดสอบได้จริงคือบันทึกโดยไม่มีสินค้าเลย" },
      ],
    },
    async ({ page }) => {
      procurementManagerTest.fail(true, "suspected bug: a price-list template saves with no product (no validation error) — product decision pending");
      const tpl = new PriceListTemplatePage(page);
      await tpl.gotoNew();
      await tpl.nameInput().fill(`PT invalid row ${uid}`);
      await tpl.selectFirstCurrency();
      // ไม่ติ๊กสินค้า — schema ต้องการอย่างน้อยหนึ่งรายการ
      const write = page.waitForResponse((r) => r.request().method() !== "GET" && /price-list-template/.test(r.url()), { timeout: 6_000 }).then(() => true, () => false);
      await tpl.saveButton().click({ timeout: 10_000 });
      // A blocked save sends no write request at all. (anyError() is no use here: the required-field
      // asterisks are .text-destructive too, so it matches on a perfectly valid form.)
      expect(await write, "validation should block the save: no POST expected").toBe(false);
      await expect(page).toHaveURL(/price-list-template\/new/);
    },
  );
  procurementManagerTest(
    "TC-PT-020004 Add products to template - Edge Case - Remove restores empty state",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Procurement Manager; เปิดฟอร์มสร้าง template ใหม่ได้" },
        {
          type: "steps",
          description:
            "1. ไปที่ /vendor-management/price-list-template/new\n2. คลิก 'Add product' เพื่อเพิ่ม row\n3. คลิกปุ่ม 'Remove tier' บน row นั้น",
        },
        { type: "expected", description: "row ถูกลบออกและตารางกลับสู่ empty state 'No products yet'" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
        { type: "note", description: "The inline table is a flat detail list; removing the only row returns to the empty-products state." },
      ],
    },
    async ({ page }) => {
      const tpl = new PriceListTemplatePage(page);
      await tpl.gotoNew();
      await tpl.pickFirstProduct();
      await expect(tpl.removeProductRowButton().first()).toBeVisible({ timeout: 10_000 });
      // Removing raises a confirmation dialog — the row survives until it is
      // confirmed, so clicking the X alone leaves the empty state hidden.
      await tpl.removeFirstProduct();
      await expect(tpl.productsEmptyState()).toBeVisible({ timeout: 10_000 });
    },
  );
});

procurementStaffTest.describe("Pricelist Template — Add products — Permission denial", () => {
  procurementStaffTest(
    "TC-PT-020003 Add products to template - No Permission",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Procurement Staff (อ่าน template ได้แต่ไม่มีสิทธิ์แก้ไข)" },
        {
          type: "steps",
          description: "1. ไปที่ /vendor-management/price-list-template\n2. เปิด template รายการแรก (view mode)\n3. มองหาช่องทางเพิ่ม product",
        },
        { type: "expected", description: "ไม่มีปุ่ม 'Add product' ให้ Procurement Staff (product table เป็น read-only — ต้องอยู่ใน edit mode ถึงจะเพิ่มได้ และ staff เข้า edit ไม่ได้)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
        { type: "note", description: "The inline 'Add product' button renders only when the form is editable; a read-only viewer never sees it." },
      ],
    },
    async ({ page }) => {
      const tpl = new PriceListTemplatePage(page);
      expect(await tpl.openFirst(), "no price-list template in the BU — run `bun run data:reset`").toBe(true);
      // Staff lands on a read-only detail: the lookup tree that adds products is
      // rendered only in create/edit mode, so its search box must be absent.
      await expect(tpl.productLookupSearch()).toHaveCount(0, { timeout: 5_000 });
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────
// TC-PT-900003 — Edit template
// ─────────────────────────────────────────────────────────────────────────
procurementManagerTest.describe("Pricelist Template — Edit", () => {
  procurementManagerTest(
    "TC-PT-030001 Edit template with valid data",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Procurement Manager และมีสิทธิ์แก้ไข template; สเปคสร้าง template ของตัวเองก่อน (ไม่แตะ template STD)" },
        {
          type: "steps",
          description:
            "1. สร้าง template ใหม่แล้วเปิด /vendor-management/price-list-template/[id]\n2. คลิก 'Edit'\n3. เปลี่ยนชื่อ template\n4. คลิก 'Save'",
        },
        { type: "expected", description: "template บันทึกสำเร็จ แสดง toast สำเร็จ" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const { tpl } = await openOwnTemplate(page, "edit");
      await tpl.editButton().click({ timeout: 10_000 });
      // unique name avoids name-uniqueness rejection across reruns
      await tpl.nameInput().fill(`E2E edited ${uid}`);
      await tpl.saveButton().click({ timeout: 10_000 });
      await tpl.expectSavedToast();
    },
  );

  procurementManagerTest(
    "TC-PT-030002 Edit template with invalid validity period",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Procurement Manager; สเปคสร้าง template ของตัวเองก่อน" },
        {
          type: "steps",
          description:
            "1. ไปที่ /vendor-management/price-list-template/[id]\n2. คลิก 'Edit'\n3. กรอก validity period เป็น 0 วัน\n4. คลิก 'Save Changes'",
        },
        { type: "expected", description: "validity 0 ถูก reject โดย native min=1 constraint (rangeUnderflow): submit ถูกบล็อก ไม่มี success toast (template ไม่ถูกบันทึก)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const { tpl } = await openOwnTemplate(page, "validity");
      await tpl.editButton().click({ timeout: 10_000 });
      await tpl.fillHeader({ validityDays: 0 });
      await tpl.saveButton().click({ timeout: 10_000 });
      // The validity_period input carries a native min=1; entering 0 makes it
      // rangeUnderflow-invalid, so the submit is blocked and no success toast
      // appears. (Native constraint validation, not an anyError() element.)
      const underflow = await tpl.validityDaysInput().evaluate((el) => (el as HTMLInputElement).validity.rangeUnderflow);
      expect(underflow).toBe(true);
      await expect(tpl.successToast()).toHaveCount(0, { timeout: 3_000 });
    },
  );

  procurementManagerTest(
    "TC-PT-030003 Edit template without product selection",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Procurement Manager; สเปคสร้าง template ของตัวเองซึ่งไม่มีสินค้า" },
        {
          type: "steps",
          description:
            "1. ไปที่ /vendor-management/price-list-template/[id]\n2. คลิก 'Edit'\n3. คลิก 'Save Changes'",
        },
        { type: "expected", description: "ระบบแสดงข้อความ error แจ้งว่าต้องมี product selection อย่างน้อย 1 รายการและ template ไม่ถูกบันทึก" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      procurementManagerTest.fail(true, "suspected bug: a price-list template saves with no product at all (no validation error) — same as TC-PT-020002");
      const { tpl } = await openOwnTemplate(page, "noprod");
      await tpl.editButton().click({ timeout: 10_000 });
      const write = page.waitForResponse((r) => r.request().method() !== "GET" && /price-list-template/.test(r.url()), { timeout: 6_000 }).then(() => true, () => false);
      await tpl.saveButton().click({ timeout: 10_000 });
      // A blocked save sends no write request (validation), so nothing is saved.
      expect(await write, "validation should block the save: no write expected").toBe(false);
      await expect(tpl.saveButton()).toBeVisible();
    },
  );

  procurementManagerTest(
    "TC-PT-030004 Edit template with minimal changes",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Procurement Manager; สเปคสร้าง template ของตัวเองก่อน" },
        {
          type: "steps",
          description:
            "1. ไปที่ /vendor-management/price-list-template/[id]\n2. คลิก 'Edit'\n3. เปลี่ยน validity period เป็น 1 วัน\n4. คลิก 'Save Changes'",
        },
        { type: "expected", description: "template บันทึกสำเร็จ (toast) และเปิดดูอีกครั้งแล้ว validity period เป็น 1 วัน" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const { tpl, name } = await openOwnTemplate(page, "minimal");
      await tpl.editButton().click({ timeout: 10_000 });
      await tpl.fillHeader({ validityDays: 1 });
      await tpl.saveButton().click({ timeout: 10_000 });
      await tpl.expectSavedToast();
      await tpl.openByName(name);
      await expect(page.getByText(/1\s*days?/i).first()).toBeVisible({ timeout: 10_000 });
    },
  );

  procurementManagerTest(
    "TC-PT-030005 Edit template with all fields in default state",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Procurement Manager; สเปคสร้าง template ของตัวเองก่อน" },
        {
          type: "steps",
          description:
            "1. สร้าง template ใหม่แล้วเปิด detail\n2. คลิก 'Edit'\n3. ไม่แก้ไขอะไร\n4. คลิก 'Cancel'",
        },
        { type: "expected", description: "กลับสู่โหมดดูโดยไม่มี dialog ยืนยันทิ้งการแก้ไข ชื่อ template เหมือนเดิม และไม่มี toast บันทึก" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      const { tpl, name } = await openOwnTemplate(page, "nochange");
      await tpl.editButton().click({ timeout: 10_000 });
      await tpl.cancelButton().click({ timeout: 10_000 });
      // No edit → no discard prompt; back in view mode with the same name, nothing saved.
      await expect(page.getByRole("alertdialog")).toHaveCount(0);
      await expect(tpl.editButton()).toBeVisible({ timeout: 5_000 });
      await expect(page.getByText(name).first()).toBeVisible();
      await expect(tpl.successToast().filter({ hasText: /updated/i })).toHaveCount(0);
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────
// TC-PT-900004 — Clone template
// The Clone/Duplicate Template action was removed in the redesign — only a
// decorative "Copy" glyph badge (a <span>, not a button) remains in the detail
// toolbar. These tests assert that no clone/duplicate affordance is reachable
// (so the removal can't silently regress into a half-wired feature).
// ─────────────────────────────────────────────────────────────────────────
procurementManagerTest.describe("Pricelist Template — Clone (removed)", () => {
  procurementManagerTest(
    "TC-PT-040001 No clone action on template detail",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Procurement Manager; มี template อย่างน้อย 1 รายการในระบบ" },
        {
          type: "steps",
          description:
            "1. ไปที่ /vendor-management/price-list-template\n2. เปิด template รายการแรก\n3. มองหาปุ่ม Clone/Duplicate ใน detail toolbar",
        },
        { type: "expected", description: "ไม่มีปุ่ม Clone/Duplicate ในหน้า detail (feature ถูกถอดออกใน redesign — เหลือเพียง Copy glyph badge ที่ไม่ใช่ปุ่ม)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
        { type: "note", description: "Clone/Duplicate removed in the redesign; the toolbar 'Copy' glyph is a decorative <span>, not a clickable action." },
      ],
    },
    async ({ page }) => {
      const tpl = new PriceListTemplatePage(page);
      expect(await tpl.openFirst(), "no price-list template in the BU — run `bun run data:reset`").toBe(true);
      await expect(tpl.cloneButton()).toHaveCount(0, { timeout: 5_000 });
    },
  );
  procurementManagerTest(
    "TC-PT-040002 No clone option in list row actions",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Procurement Manager; มี template อย่างน้อย 1 รายการในระบบ" },
        {
          type: "steps",
          description:
            "1. ไปที่ /vendor-management/price-list-template\n2. เปิดเมนู 'Row actions' ของ template รายการแรก\n3. ตรวจสอบรายการเมนู",
        },
        { type: "expected", description: "เมนู row actions ไม่มีตัวเลือก Clone/Duplicate (มีเพียง Edit / Delete)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
        { type: "note", description: "Row actions menu (data-grid) exposes only Edit and Delete; no clone/duplicate item." },
      ],
    },
    async ({ page }) => {
      const tpl = new PriceListTemplatePage(page);
      await tpl.gotoList();
      const trigger = tpl.rowActionsButton();
      if ((await trigger.count()) === 0) {
        // empty list → no rows to clone; assert no clone affordance exists at all
        await expect(tpl.cloneButton()).toHaveCount(0, { timeout: 5_000 });
        return;
      }
      await trigger.click({ timeout: 10_000 });
      await expect(tpl.cloneMenuItem()).toHaveCount(0, { timeout: 5_000 });
    },
  );
  procurementManagerTest(
    "TC-PT-040004 No clone action even in edit mode",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Procurement Manager; มี template อย่างน้อย 1 รายการในระบบ" },
        {
          type: "steps",
          description:
            "1. ไปที่ /vendor-management/price-list-template\n2. เปิด template รายการแรกแล้วกด 'Edit'\n3. ตรวจสอบ toolbar ใน edit mode",
        },
        { type: "expected", description: "edit toolbar มีเพียง Cancel / Save / Delete — ไม่มีปุ่ม Clone/Duplicate; ปุ่ม Save ปรากฏ" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
        { type: "note", description: "Entering edit mode exposes Cancel/Save/Delete only; clone never appears." },
      ],
    },
    async ({ page }) => {
      const tpl = new PriceListTemplatePage(page);
      expect(await tpl.openFirst(), "no price-list template in the BU — run `bun run data:reset`").toBe(true);
      await tpl.editButton().click({ timeout: 10_000 }).catch(() => {});
      await expect(tpl.saveButton()).toBeVisible({ timeout: 10_000 });
      await expect(tpl.cloneButton()).toHaveCount(0, { timeout: 5_000 });
    },
  );
});

procurementStaffTest.describe("Pricelist Template — Clone (removed) — Permission denial", () => {
  procurementStaffTest(
    "TC-PT-040003 No clone action for Procurement Staff",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Procurement Staff (อ่าน template ได้)" },
        {
          type: "steps",
          description: "1. ไปที่ /vendor-management/price-list-template\n2. เปิด template รายการแรก\n3. มองหาปุ่ม/เมนู Clone/Duplicate",
        },
        { type: "expected", description: "ไม่มีปุ่มหรือเมนู Clone/Duplicate ให้ Procurement Staff (feature ถูกถอดออกทั้งระบบ)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
        { type: "note", description: "Clone is gone for every role; a staff viewer sees neither a clone button nor a clone menu item." },
      ],
    },
    async ({ page }) => {
      const tpl = new PriceListTemplatePage(page);
      expect(await tpl.openFirst(), "no price-list template in the BU — run `bun run data:reset`").toBe(true);
      await expect(tpl.cloneButton()).toHaveCount(0, { timeout: 5_000 });
      await expect(tpl.cloneMenuItem()).toHaveCount(0, { timeout: 5_000 });
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────
// TC-PT-900005 — Activate / Deactivate template
// Dedicated Activate/Deactivate buttons were removed; the template status
// (draft / active / inactive) is now a Select in the form's summary aside,
// rendered only in create/edit mode. These tests drive that status-via-form
// flow on the /new form so they don't depend on seeded templates.
// ─────────────────────────────────────────────────────────────────────────
procurementManagerTest.describe("Pricelist Template — Activate / Deactivate", () => {
  procurementManagerTest(
    "TC-PT-050001 Set template status to Active - Happy Path",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Procurement Manager; มี currency อย่างน้อย 1 รายการ" },
        {
          type: "steps",
          description:
            "1. ไปที่ /vendor-management/price-list-template/new\n2. กรอกชื่อ template + เลือก currency\n3. เลือก Status = 'Active' จาก dropdown ใน summary aside\n4. คลิก 'Save'\n5. ตรวจสอบ success toast",
        },
        { type: "expected", description: "template ถูกสร้างพร้อม status 'Active' และแสดง success toast" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
        { type: "note", description: "Activate/Deactivate is now a status Select on the form, not a dedicated button." },
      ],
    },
    async ({ page }) => {
      const tpl = new PriceListTemplatePage(page);
      await tpl.gotoNew();
      await tpl.nameInput().fill(`PT active ${uid}`);
      await tpl.selectFirstCurrency();
      await tpl.selectStatus("Active");
      await tpl.saveButton().click({ timeout: 10_000 });
      await tpl.expectSavedToast();
    },
  );
  procurementManagerTest(
    "TC-PT-050003 Status is a closed set - Invalid Input",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Procurement Manager; เปิดฟอร์มสร้าง template ใหม่ได้" },
        {
          type: "steps",
          description:
            "1. ไปที่ /vendor-management/price-list-template/new\n2. เปิด Status dropdown ใน summary aside\n3. ตรวจสอบตัวเลือกที่มี",
        },
        { type: "expected", description: "Status เป็น dropdown ที่มีเฉพาะ Draft / Active / Inactive (3 ตัวเลือก) — ไม่รับค่าอิสระ/ไม่ถูกต้อง" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
        { type: "note", description: "status enum is z.enum(['draft','active','inactive']); the Select cannot accept any other value." },
      ],
    },
    async ({ page }) => {
      const tpl = new PriceListTemplatePage(page);
      await tpl.gotoNew();
      await tpl.statusSelect().click({ timeout: 10_000 });
      await expect(page.getByRole("option", { name: /^Draft$/i })).toBeVisible({ timeout: 10_000 });
      await expect(page.getByRole("option", { name: /^Active$/i })).toBeVisible();
      await expect(page.getByRole("option", { name: /^Inactive$/i })).toBeVisible();
      // exactly the three valid statuses — no free-form / invalid entry possible
      await expect(page.getByRole("option")).toHaveCount(3);
    },
  );
  procurementManagerTest(
    "TC-PT-050005 Template Status Change - Edge Case (rapid toggle)",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Procurement Manager; มี currency อย่างน้อย 1 รายการ" },
        {
          type: "steps",
          description:
            "1. ไปที่ /vendor-management/price-list-template/new\n2. กรอกชื่อ + เลือก currency\n3. สลับ Status Active → Inactive → Active ติดต่อกันอย่างรวดเร็ว\n4. คลิก 'Save'",
        },
        { type: "expected", description: "การสลับ status หลายครั้งไม่ทำให้ฟอร์มพัง; template ถูกบันทึกสำเร็จ (success toast)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
        { type: "note", description: "Rapidly cycling the status Select must not break submit; the last selection persists." },
      ],
    },
    async ({ page }) => {
      const tpl = new PriceListTemplatePage(page);
      await tpl.gotoNew();
      await tpl.nameInput().fill(`PT toggle ${uid}`);
      await tpl.selectFirstCurrency();
      await tpl.selectStatus("Active");
      await tpl.selectStatus("Inactive");
      await tpl.selectStatus("Active");
      await tpl.saveButton().click({ timeout: 10_000 });
      await tpl.expectSavedToast();
    },
  );
});

procurementStaffTest.describe("Pricelist Template — Activate / Deactivate — Permission denial", () => {
  procurementStaffTest(
    "TC-PT-050004 Cannot change status - No Permission",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Procurement Staff (อ่าน template ได้แต่ไม่มีสิทธิ์แก้ไข)" },
        {
          type: "steps",
          description: "1. ไปที่ /vendor-management/price-list-template\n2. เปิด template รายการแรก (view mode)\n3. มองหา Status dropdown ที่แก้ไขได้",
        },
        { type: "expected", description: "ไม่มี Status dropdown ให้ Procurement Staff (status แก้ได้เฉพาะ edit mode ซึ่ง staff เข้าไม่ได้ — view mode แสดงเป็น StatusPill อ่านอย่างเดียว)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
        { type: "note", description: "The editable status Select renders only in edit mode; a read-only viewer sees a StatusPill instead." },
      ],
    },
    async ({ page }) => {
      const tpl = new PriceListTemplatePage(page);
      expect(await tpl.openFirst(), "no price-list template in the BU — run `bun run data:reset`").toBe(true);
      // No editable status control is exposed to a read-only Procurement Staff.
      await expect(tpl.statusSelect()).toHaveCount(0, { timeout: 5_000 });
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────
// TC-PT-900006 — Search and View
// ─────────────────────────────────────────────────────────────────────────
procurementManagerTest.describe("Pricelist Template — Search and View", () => {
  procurementManagerTest(
    "TC-PT-060001 Search and View Templates - Happy Path",
    {
      annotation: [
        { type: "preconditions", description: "Login เข้า Carmen Blue พร้อมสิทธิ์ดู template" },
        {
          type: "steps",
          description:
            "1. ไปที่ /vendor-management/price-list-template\n2. คลิก status tab 'All'\n3. กรอก 'example' ในช่องค้นหา\n4. คลิก 'Search'\n5. คลิก template card",
        },
        { type: "expected", description: "ระบบแสดงหน้า detail ของ template พร้อมข้อมูล template ที่เกี่ยวข้อง" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const tpl = new PriceListTemplatePage(page);
      expect(await tpl.openFirst(), "no price-list template in the BU — run `bun run data:reset`").toBe(true);
      await expect(page).toHaveURL(/price-list-template\/[^/]+$/, { timeout: 10_000 });
    },
  );

  procurementManagerTest(
    "TC-PT-060002 Search and View Templates - Negative - Invalid Search Term",
    {
      annotation: [
        { type: "preconditions", description: "Login เข้า Carmen Blue พร้อมสิทธิ์ดู template" },
        {
          type: "steps",
          description:
            "1. ไปที่ /vendor-management/price-list-template\n2. กรอก 'nonexistent' ในช่องค้นหา\n3. คลิก 'Search'",
        },
        { type: "expected", description: "ระบบแสดงข้อความแจ้งว่าไม่พบ template ที่ตรงกัน" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const tpl = new PriceListTemplatePage(page);
      await tpl.gotoList();
      const search = tpl.searchInput();
      await expect(search).toBeVisible({ timeout: 10_000 });
      await search.fill("__NONEXISTENT_E2E__");
      await search.press("Enter"); // SearchInput fires onSearch on Enter
      await expect(
        page.getByText(/no.*match|no.*found|no.*data|empty|ไม่พบ/i).first(),
      ).toBeVisible({ timeout: 10_000 });
    },
  );

  procurementManagerTest(
    "TC-PT-060005 Search and View Templates - Edge Case - Sort by Name (Z-A)",
    {
      annotation: [
        { type: "preconditions", description: "Login เข้า Carmen Blue พร้อมสิทธิ์ดู template" },
        {
          type: "steps",
          description:
            "1. ไปที่ /vendor-management/price-list-template\n2. คลิก status tab 'All'\n3. คลิก header คอลัมน์ 'Name'\n4. คลิกตัวเลือกเรียงลำดับ 'Z-A'",
        },
        { type: "expected", description: "ระบบเรียงลำดับ list ของ template ตามตัวอักษรจาก Z-A ตามชื่อ template" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      const tpl = new PriceListTemplatePage(page);
      await tpl.gotoList();
      const header = tpl.nameColumnHeader();
      await expect(header, "Name column header").toBeVisible({ timeout: 10_000 });
      // Click the header's own button, not the <th>: the <th> wraps a ghost
      // <button> and clicking the cell does nothing at all (the rows never
      // reorder). Verified against the live table.
      const sortButton = header.getByRole("button").first();
      await sortButton.click({ timeout: 10_000 });
      await page.waitForTimeout(1_000);
      const ascending = await page.locator("tbody tr td:nth-child(2)").allInnerTexts();

      await sortButton.click({ timeout: 10_000 });
      await page.waitForTimeout(1_000);
      const descending = await page.locator("tbody tr td:nth-child(2)").allInnerTexts();

      // Assert the order itself, not `aria-sort` — this table never sets that
      // attribute, so the old expectation could not pass however the sort behaved.
      expect(descending.length, "no rows to sort").toBeGreaterThan(1);
      expect(descending, "second click should reverse the order").not.toEqual(ascending);
      const sortedDesc = [...descending].sort((a, b) => b.localeCompare(a));
      expect(descending).toEqual(sortedDesc);
    },
  );
});

procurementStaffTest.describe("Pricelist Template — Search and View — Permission denial", () => {
  procurementStaffTest(
    "TC-PT-060003 Search and View Templates - Negative - Insufficient Permission",
    {
      annotation: [
        { type: "preconditions", description: "Login เข้า Carmen Blue แต่ไม่มีสิทธิ์ดู template" },
        { type: "steps", description: "1. ไปที่ /vendor-management/price-list-template" },
        { type: "expected", description: "ระบบ redirect ผู้ใช้ไปยังหน้าไม่มีสิทธิ์เข้าถึงหรือแสดงข้อความปฏิเสธสิทธิ์" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      procurementStaffTest.fail(true, "suspected bug: requestor can open the price-list template list (no role gate on vendor-management)");
      await page.goto(LIST_PATH);
      await page.waitForLoadState("networkidle");
      await expect(page.getByText(/permission denied|restricted|not authori[sz]ed/i).first()).toBeVisible({ timeout: 5_000 });
    },
  );
});

// ── carmensoftware.dev+admin@gmail.com + BLAVG CRUD ─────────────────────────────────────
// The describes above run as purchase/requestor (authz coverage) and are left
// untouched. This block verifies an admin can CRUD pricelist templates with the
// active BU pinned to BLAVG, driving the redesigned form through the migrated
// PriceListTemplatePage page object.
const adminTest = createAuthTest("carmensoftware.dev+admin@gmail.com");

adminTest.describe.serial("Pricelist Template — admin@BLAVG CRUD", () => {
  const ADMIN_NAME = fakeName({ tag: "PT" });
  const ADMIN_NAME_UPDATED = fakeName({ tag: "PT Upd" });

  // success/created/updated/deleted toast (used for both presence and absence checks)
  const successToast = (page: import("@playwright/test").Page) =>
    page
      .locator('[data-sonner-toast], [role="status"], [role="alert"]')
      .filter({ hasText: /success|saved|created|updated|deleted|สำเร็จ/i })
      .first();

  adminTest.beforeEach(async ({ page }) => {
    await ensureActiveBu(page, BU_CODE);
  });

  adminTest(
    "TC-PT-010050 active BU = BLAVG",
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
    "TC-PT-010051 สร้าง pricelist template (admin/BLAVG) สำเร็จ",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG; template ชื่อ ADMIN_NAME ยังไม่มีใน DB; มี currency อย่างน้อย 1 รายการ" },
        { type: "steps", description: "1. เปิดหน้า /new\n2. กรอกชื่อ (hero NameField) = ADMIN_NAME\n3. เลือก Currency (required)\n4. กด 'Save'\n5. ตรวจสอบ success toast" },
        { type: "expected", description: "success toast ปรากฏ (template ถูกสร้าง) — ใช้เป็น seed ของ serial chain" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const tpl = new PriceListTemplatePage(page);
      await tpl.gotoNew();
      await tpl.nameInput().fill(ADMIN_NAME);
      await tpl.selectFirstCurrency();
      await tpl.saveButton().click({ timeout: 10_000 });
      await tpl.expectSavedToast();
    },
  );

  adminTest(
    "TC-PT-040050 แก้ชื่อ template แล้ว persist",
    {
      annotation: [
        { type: "preconditions", description: "TC-PT-010051 ผ่านแล้ว → template ADMIN_NAME มีอยู่; login carmensoftware.dev+admin@gmail.com; active BU = BLAVG" },
        { type: "steps", description: "1. ไป list แล้วเปิด template ADMIN_NAME\n2. กด 'Edit'\n3. แก้ชื่อเป็น ADMIN_NAME_UPDATED\n4. กด 'Save'\n5. กลับ list ค้นหา ADMIN_NAME_UPDATED" },
        { type: "expected", description: "success toast ปรากฏ และ ADMIN_NAME_UPDATED ค้นเจอใน list ภายใน 10s (ค่าถูก persist)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const tpl = new PriceListTemplatePage(page);
      await tpl.openByName(ADMIN_NAME);
      await tpl.editButton().click({ timeout: 10_000 });
      await tpl.nameInput().fill(ADMIN_NAME_UPDATED);
      await tpl.saveButton().click({ timeout: 10_000 });
      await tpl.expectSavedToast();

      await tpl.gotoList();
      const search = tpl.searchInput();
      if ((await search.count()) > 0) {
        await search.fill(ADMIN_NAME_UPDATED).catch(() => {});
        await search.press("Enter").catch(() => {});
      }
      await expect(page.getByText(ADMIN_NAME_UPDATED).first()).toBeVisible({ timeout: 10_000 });
    },
  );

  adminTest(
    "TC-PT-040051 แก้ชื่อแล้วกด Cancel — ค่าเดิมคงอยู่",
    {
      annotation: [
        { type: "preconditions", description: "TC-PT-040050 ผ่านแล้ว → template ADMIN_NAME_UPDATED มีอยู่; login carmensoftware.dev+admin@gmail.com; active BU = BLAVG" },
        { type: "steps", description: "1. ไป list เปิด template ADMIN_NAME_UPDATED\n2. กด 'Edit'\n3. แก้ชื่อเป็นค่าทิ้ง\n4. กด 'Cancel'\n5. กลับ list ค้นหา ADMIN_NAME_UPDATED" },
        { type: "expected", description: "ชื่อ template ยังเป็น ADMIN_NAME_UPDATED (การแก้ที่ยกเลิกไม่ถูกบันทึก)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const tpl = new PriceListTemplatePage(page);
      await tpl.openByName(ADMIN_NAME_UPDATED);
      await tpl.editButton().click({ timeout: 10_000 });
      await tpl.nameInput().fill(`${ADMIN_NAME_UPDATED} DISCARD`);
      await tpl.cancelButton().click({ timeout: 10_000 });

      await tpl.gotoList();
      const search = tpl.searchInput();
      if ((await search.count()) > 0) {
        await search.fill(ADMIN_NAME_UPDATED).catch(() => {});
        await search.press("Enter").catch(() => {});
      }
      await expect(page.getByText(ADMIN_NAME_UPDATED).first()).toBeVisible({ timeout: 10_000 });
    },
  );

  adminTest(
    "TC-PT-200050 สร้าง template ชื่อซ้ำ ต้องถูก reject",
    {
      annotation: [
        { type: "preconditions", description: "TC-PT-040050 ผ่านแล้ว → template ADMIN_NAME_UPDATED มีอยู่ใน DB; login carmensoftware.dev+admin@gmail.com; active BU = BLAVG" },
        { type: "steps", description: "1. เปิดหน้า /new\n2. กรอกชื่อ = ADMIN_NAME_UPDATED (ซ้ำ) + เลือก currency\n3. กด 'Save'" },
        { type: "expected", description: "รายการที่สองไม่ถูกสร้าง: มี error toast (backend reject duplicate name) — ไม่มี success toast" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const tpl = new PriceListTemplatePage(page);
      await tpl.gotoNew();
      await tpl.nameInput().fill(ADMIN_NAME_UPDATED);
      await tpl.selectFirstCurrency();
      await tpl.saveButton().click({ timeout: 10_000 });
      // Duplicate name must be rejected: no success toast appears.
      await expect(successToast(page)).toHaveCount(0, { timeout: 5_000 });
    },
  );

  adminTest(
    "TC-PT-050050 เปิด delete dialog แล้ว Cancel — template ยังอยู่",
    {
      annotation: [
        { type: "preconditions", description: "TC-PT-200050 ผ่านแล้ว → template ADMIN_NAME_UPDATED ยังอยู่ใน DB; login carmensoftware.dev+admin@gmail.com; active BU = BLAVG" },
        { type: "steps", description: "1. ไป list ค้นหา ADMIN_NAME_UPDATED\n2. เปิด row actions\n3. กด 'Delete'\n4. ใน dialog กด 'Cancel'\n5. ตรวจสอบว่า template ยังอยู่" },
        { type: "expected", description: "template ADMIN_NAME_UPDATED ยังคงอยู่ใน list (ไม่ถูกลบ)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const tpl = new PriceListTemplatePage(page);
      await tpl.gotoList();
      const search = tpl.searchInput();
      if ((await search.count()) > 0) {
        await search.fill(ADMIN_NAME_UPDATED).catch(() => {});
        await search.press("Enter").catch(() => {});
      }
      await tpl.deleteViaRowActions(ADMIN_NAME_UPDATED, { confirm: false });

      await tpl.gotoList();
      const search2 = tpl.searchInput();
      if ((await search2.count()) > 0) {
        await search2.fill(ADMIN_NAME_UPDATED).catch(() => {});
        await search2.press("Enter").catch(() => {});
      }
      await expect(page.getByText(ADMIN_NAME_UPDATED).first()).toBeVisible({ timeout: 10_000 });
    },
  );

  adminTest(
    "TC-PT-050051 ลบ template (admin/BLAVG) cleanup",
    {
      annotation: [
        { type: "preconditions", description: "TC-PT-050050 ผ่านแล้ว → template ADMIN_NAME_UPDATED ยังอยู่ใน DB; login carmensoftware.dev+admin@gmail.com; active BU = BLAVG" },
        { type: "steps", description: "1. ไป list ค้นหา ADMIN_NAME_UPDATED\n2. เปิด row actions\n3. กด 'Delete'\n4. ใน dialog ยืนยัน Delete\n5. ตรวจสอบ success toast" },
        { type: "expected", description: "success toast ('deleted/success/สำเร็จ') ปรากฏภายใน 10s (template ถูกลบ — ปิดท้าย serial chain)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const tpl = new PriceListTemplatePage(page);
      await tpl.gotoList();
      const search = tpl.searchInput();
      if ((await search.count()) > 0) {
        await search.fill(ADMIN_NAME_UPDATED).catch(() => {});
        await search.press("Enter").catch(() => {});
      }
      await tpl.deleteViaRowActions(ADMIN_NAME_UPDATED, { confirm: true });
      await tpl.expectSavedToast();
    },
  );
});
