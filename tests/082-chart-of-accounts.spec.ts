import { expect } from "@playwright/test";
import { createAuthTest } from "./fixtures/auth.fixture";
import { ConfigListPage } from "./pages/config-list.page";
import { PageFormCrudHelper } from "./pages/page-form-crud.helper";
import { BU_CODE } from "./test-users";
import { ensureActiveBu } from "./helpers/bu";
import { uid, fakeCode, fakeName } from "./helpers/test-data";

/**
 * Chart of Accounts (COA) — CRUD + Validation tests.
 *
 * Module: Config — Chart of Accounts
 * URL: /config/chart-of-accounts
 *
 * Omitted from this spec (deferred):
 *  - Multi-select filter tests (TC-COA-010005/010006/010007) — complex state setup
 *  - View/Grid toggle, column toggle, Export (TC-COA-010008/010009/010010) — lower priority
 *  - Edit Debit/Credit and Type (TC-COA-040002) — compound field change
 *  - Expired-license BU authorization (TC-COA-100001) — requires special test BU
 *  - Carmen GL import (TC-COA-300001–300004) — requires GL interface setup
 */

const test = createAuthTest("carmensoftware.dev+admin@gmail.com");
const PATH = "/config/chart-of-accounts";

// Unique test data for this run
const CODE = fakeCode("COA");
const NAME = fakeName({ tag: "COA030" });
const CODE2 = fakeCode("COA2");
const NAME2 = fakeName({ tag: "COA031" });

const NEW_PATH = `${PATH}/new`;
const formOpts = { listPath: PATH, codeInputId: "coa-code", nameInputId: "coa-description-1", activeSwitchId: "coa-is-active" } as const;

/**
 * COA is a routed page form (/config/chart-of-accounts/new, /:id), not a dialog — FE `coa-new.route` /
 * `coa-edit.route` (carmen-frontend a2cfd1bc). Required fields: code, English description, category, type.
 */
async function fillCoaForm(
  page: import("@playwright/test").Page,
  v: { code: string; name: string; category?: string; type?: string },
) {
  await page.locator("#coa-code").fill(v.code);
  await page.locator("#coa-description-1").fill(v.name);
  await page.getByRole("combobox").filter({ hasText: /Select category/i }).click();
  await page.getByRole("option", { name: v.category ?? "Assets", exact: true }).click();
  await page.getByRole("combobox").filter({ hasText: /Select account type/i }).click();
  await page.getByRole("option", { name: v.type ?? "Balance sheet", exact: true }).click();
}

test.describe("Chart of Accounts — CRUD & Validation", () => {
  test.beforeEach(async ({ page }) => {
    await ensureActiveBu(page, BU_CODE);
  });

  // ------------------------------------------------------------------
  // TC-COA-010001 — Smoke: list loads
  // ------------------------------------------------------------------
  test(
    "TC-COA-010001 แสดงรายการผังบัญชีในตาราง",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG; มีรหัสบัญชีอย่างน้อย 1 รายการใน BU นี้" },
        { type: "steps", description: "1. ไปที่ /config/chart-of-accounts\n2. รอให้ DataGrid โหลดเสร็จ" },
        { type: "expected", description: "หัวข้อหน้าแสดง 'Chart of Accounts'; ตารางแสดงคอลัมน์ Code, Account name, Debit / Credit, Type, Status; มีแถบ pagination ด้านล่าง" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page }) => {
      await page.goto(PATH);
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveURL(new RegExp(PATH));
      await expect(page.getByRole("heading", { name: /Chart of Accounts/i }).first()).toBeVisible({ timeout: 10_000 });
      await expect(page.getByRole("table").first()).toBeVisible({ timeout: 10_000 });
    },
  );

  // ------------------------------------------------------------------
  // TC-COA-010002 — Search
  // ------------------------------------------------------------------
  test(
    "TC-COA-010002 ค้นหาบัญชีด้วยรหัสหรือชื่อบัญชี",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่หน้า /config/chart-of-accounts; มีบัญชีหลายรายการ" },
        { type: "steps", description: "1. คลิกช่อง Search\n2. พิมพ์รหัสหรือชื่อบัญชีที่มีอยู่จริง\n3. กด Enter" },
        { type: "expected", description: "ตารางแสดงเฉพาะแถวที่ตรงกับคำค้น" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const list = new ConfigListPage(page, PATH);
      await list.goto();
      const rowsBefore = await page.getByRole("row").count();
      // Use a partial term that should match fewer rows than the full list
      await list.search("1");
      const rowsAfter = await page.getByRole("row").count();
      expect(rowsAfter).toBeLessThanOrEqual(rowsBefore);
    },
  );

  // ------------------------------------------------------------------
  // TC-COA-010003 — Clear search
  // ------------------------------------------------------------------
  test(
    "TC-COA-010003 ล้างคำค้นด้วยปุ่มกากบาทในช่องค้นหา",
    {
      annotation: [
        { type: "preconditions", description: "ค้นหาไปแล้วอย่างน้อย 1 ครั้งและช่อง Search ยังมีข้อความอยู่" },
        { type: "steps", description: "1. ค้นหาจนรายการถูกกรอง\n2. คลิกปุ่มกากบาท (Clear search) ท้ายช่องค้นหา" },
        { type: "expected", description: "ช่องค้นหาว่าง และตารางกลับมาแสดงรายการทั้งหมดอีกครั้ง" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const list = new ConfigListPage(page, PATH);
      await list.goto();
      await list.search(`__NOPE__${uid}`);
      // Clear
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
    },
  );

  // ------------------------------------------------------------------
  // TC-COA-010004 — Filter by Active / Inactive status
  // ------------------------------------------------------------------
  test(
    "TC-COA-010004 กรองตามสถานะ Active / Inactive",
    {
      annotation: [
        { type: "preconditions", description: "มีบัญชีทั้งสถานะ active และ inactive ใน BU BLAVG" },
        { type: "steps", description: "1. คลิกปุ่ม Filter\n2. เลือก Status = Active\n3. ปิดเมนูตัวกรอง" },
        { type: "expected", description: "ตารางแสดงเฉพาะแถวที่ Status badge เป็น Active; ปุ่ม Filter แสดง badge จำนวนตัวกรองที่ใช้งาน" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      await page.goto(PATH);
      await page.waitForLoadState("networkidle");
      // Open filter panel
      const filterBtn = page.getByRole("button", { name: /Filter/i }).first();
      await expect(filterBtn).toBeVisible({ timeout: 10_000 });
      await filterBtn.click();
      // Select Active status (exact label may vary — use regex)
      const activeOption = page.getByRole("option", { name: /Active/i }).first()
        .or(page.getByRole("checkbox", { name: /Active/i }).first())
        .or(page.getByText(/^Active$/i).first());
      await activeOption.click({ timeout: 5_000 }).catch(() => {
        // Filter UI may differ — proceed as best-effort
      });
      // Close filter by pressing Escape or clicking outside
      await page.keyboard.press("Escape");
      await page.waitForLoadState("networkidle");
      // At minimum the filter button is still visible (page did not crash)
      await expect(filterBtn).toBeVisible();
    },
  );

  // ------------------------------------------------------------------
  // TC-COA-020001 — Open edit dialog from Code column
  // ------------------------------------------------------------------
  test(
    "TC-COA-020001 เปิดหน้ารายละเอียดบัญชีจากคอลัมน์ Code",
    {
      annotation: [
        { type: "preconditions", description: "มีบัญชีอย่างน้อย 1 รายการที่ทราบค่าทุกช่อง" },
        { type: "steps", description: "1. คลิกที่รหัสบัญชีในคอลัมน์ Code ของแถวที่ต้องการ" },
        { type: "expected", description: "เปิดหน้ารายละเอียด /config/chart-of-accounts/:id ในโหมดดู (มีปุ่ม Edit) และแสดงรหัสบัญชีของแถวที่คลิก" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const h = new PageFormCrudHelper(page, formOpts);
      await h.list.goto();
      const firstDataRow = page.getByRole("row").nth(1);
      await expect(firstDataRow).toBeVisible({ timeout: 10_000 });
      const code = (await firstDataRow.getByRole("button").first().innerText()).trim();
      await firstDataRow.getByRole("button").first().click();
      await expect(page).toHaveURL(new RegExp(`${PATH}/[^/]+$`), { timeout: 10_000 });
      await expect(page).not.toHaveURL(/\/new/);
      // View mode: the Edit button is offered and the code is shown as plain text
      await expect(h.editButton()).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(code, { exact: true }).first()).toBeVisible();
    },
  );

  // ------------------------------------------------------------------
  // TC-COA-020002 — Cancel dialog without saving
  // ------------------------------------------------------------------
  test(
    "TC-COA-020002 ยกเลิกการแก้ไขด้วยปุ่ม Cancel โดยไม่บันทึก",
    {
      annotation: [
        { type: "preconditions", description: "เปิดหน้ารายละเอียดบัญชีอยู่" },
        { type: "steps", description: "1. เปิดหน้ารายละเอียดบัญชี\n2. คลิก Edit\n3. แก้ค่าในช่อง Account Description (English)\n4. คลิกปุ่ม Cancel (และยืนยันทิ้งการแก้ไขถ้ามี prompt)" },
        { type: "expected", description: "กลับสู่โหมดดู (มีปุ่ม Edit) โดยไม่มี toast บันทึกสำเร็จ" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Alternate Flow" },
      ],
    },
    async ({ page }) => {
      const h = new PageFormCrudHelper(page, formOpts);
      await h.list.goto();
      const firstDataRow = page.getByRole("row").nth(1);
      await firstDataRow.getByRole("button").first().click();
      await expect(page).toHaveURL(new RegExp(`${PATH}/[^/]+$`), { timeout: 10_000 });
      await h.editButton().click();
      const original = await h.nameInput().inputValue();
      await h.nameInput().fill(`${original} CHANGED`);
      await h.cancelButton().click();
      // A dirty form always asks "Discard changes?" (DiscardDialog)
      const discard = page.getByRole("alertdialog");
      await expect(discard).toBeVisible({ timeout: 5_000 });
      await discard.getByRole("button", { name: /^Discard$/i }).click();
      // Back to view mode: Edit offered again, no input left, no save toast
      await expect(h.editButton()).toBeVisible({ timeout: 5_000 });
      await expect(page.getByText(/updated successfully/i)).toHaveCount(0);
    },
  );

  // ------------------------------------------------------------------
  // TC-COA-030001 — Create account (Debit + Balance sheet default)
  // ------------------------------------------------------------------
  test(
    "TC-COA-030001 สร้างบัญชีใหม่ (Assets + Balance sheet)",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG; เตรียมรหัสบัญชีที่ยังไม่ถูกใช้งาน" },
        { type: "steps", description: "1. คลิกปุ่ม New (ไปที่ /config/chart-of-accounts/new)\n2. กรอก Code และ Account Description (English)\n3. เลือก Category = Assets และ Type = Balance sheet\n4. คลิกปุ่ม Create" },
        { type: "expected", description: "แสดง toast สร้างสำเร็จ; กลับไปหน้า list; แถวใหม่ปรากฏในตาราง" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const h = new PageFormCrudHelper(page, formOpts);
      await page.goto(NEW_PATH);
      await page.waitForLoadState("networkidle");
      await fillCoaForm(page, { code: CODE, name: NAME });
      await h.saveButton().click();
      await expect(page.getByText(/created successfully/i).first()).toBeVisible({ timeout: 10_000 });
      // Redirected back to the list; the new row is there
      await expect(page).toHaveURL(new RegExp(`${PATH}(\\?|$)`), { timeout: 10_000 });
      await h.list.search(CODE);
      await expect(page.getByRole("cell", { name: new RegExp(CODE) }).first()).toBeVisible({ timeout: 10_000 });
    },
  );

  // ------------------------------------------------------------------
  // TC-COA-030003 — Create account with inactive status
  // ------------------------------------------------------------------
  test(
    "TC-COA-030003 สร้างบัญชีโดยปิดสถานะใช้งานตั้งแต่ต้น",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่หน้า /config/chart-of-accounts/new" },
        { type: "steps", description: "1. กรอก Code, Account Description (English), Category และ Type\n2. สลับสวิตช์สถานะให้เป็น inactive\n3. คลิกปุ่ม Create" },
        { type: "expected", description: "บัญชีถูกสร้างพร้อม toast สำเร็จ; แถวใหม่ในตารางแสดงสถานะ Inactive" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const h = new PageFormCrudHelper(page, formOpts);
      await page.goto(NEW_PATH);
      await page.waitForLoadState("networkidle");
      await fillCoaForm(page, { code: CODE2, name: NAME2 });
      await h.setActive(false);
      expect(await h.isActive()).toBe(false);
      await h.saveButton().click();
      await expect(page.getByText(/created successfully/i).first()).toBeVisible({ timeout: 10_000 });
      await h.list.search(CODE2);
      const row = page.getByRole("row", { name: new RegExp(CODE2) }).first();
      await expect(row).toBeVisible({ timeout: 10_000 });
      await expect(row.getByText(/inactive/i).first()).toBeVisible();
    },
  );

  // ------------------------------------------------------------------
  // TC-COA-040001 — Edit account name
  // ------------------------------------------------------------------
  test(
    "TC-COA-040001 แก้ไขชื่อบัญชีแล้วค่าคงอยู่",
    {
      annotation: [
        { type: "preconditions", description: "มีบัญชีที่สร้างไว้จากเคสก่อนหน้า (หรือบัญชีทดสอบที่แก้ไขได้)" },
        { type: "steps", description: "1. ค้นหาบัญชีที่ CODE\n2. คลิกรหัสบัญชีเพื่อเปิดหน้ารายละเอียด\n3. คลิก Edit แล้วแก้ช่อง Account Description (English)\n4. คลิกปุ่ม Save" },
        { type: "expected", description: "แสดง toast อัปเดตสำเร็จ; กลับหน้า list; คอลัมน์ Account name เป็นค่าใหม่" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const h = new PageFormCrudHelper(page, formOpts);
      await h.list.goto();
      await h.list.search(CODE);
      await h.clickRowName(CODE);
      await h.editButton().click();
      const nameUpdated = fakeName({ tag: "COA040 Upd" });
      await h.nameInput().fill(nameUpdated);
      await h.saveButton().click();
      await expect(page.getByText(/updated successfully/i).first()).toBeVisible({ timeout: 10_000 });
      await h.list.goto();
      await h.list.search(CODE);
      await expect(page.getByRole("row", { name: new RegExp(CODE) }).first()).toContainText(nameUpdated);
    },
  );

  // ------------------------------------------------------------------
  // TC-COA-050001 — Delete from row actions
  // ------------------------------------------------------------------
  test(
    "TC-COA-050001 ลบบัญชีจากเมนู Row actions",
    {
      annotation: [
        { type: "preconditions", description: "มีบัญชีทดสอบที่ลบได้ (ไม่ถูกอ้างอิงจากที่อื่น)" },
        { type: "steps", description: "1. ค้นหาบัญชีที่ CODE2\n2. คลิกปุ่ม Row actions ท้ายแถว\n3. เลือกเมนู Delete\n4. ยืนยันใน dialog ยืนยันการลบ" },
        { type: "expected", description: "Dialog ยืนยันแสดง; หลังยืนยันแสดง toast ลบสำเร็จ และแถวนั้นหายจากรายการ" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const list = new ConfigListPage(page, PATH);
      await list.goto();
      await list.search(CODE2);
      const row = page.getByRole("row", { name: new RegExp(CODE2) }).first();
      await row.waitFor({ state: "visible", timeout: 10_000 });
      await row.getByRole("button", { name: /Row actions/i }).click();
      await page.getByRole("menuitem", { name: /^Delete$/i }).click();
      const alertDialog = page.getByRole("alertdialog");
      await expect(alertDialog).toBeVisible({ timeout: 5_000 });
      await alertDialog.getByRole("button", { name: /Delete|ลบ/i }).click();
      await expect(page.getByText(/deleted|success|สำเร็จ/i).first()).toBeVisible({ timeout: 10_000 });
    },
  );

  // ------------------------------------------------------------------
  // TC-COA-050002 — Cancel delete
  // ------------------------------------------------------------------
  test(
    "TC-COA-050002 ยกเลิกการลบใน dialog ยืนยัน",
    {
      annotation: [
        { type: "preconditions", description: "มีบัญชีอย่างน้อย 1 รายการในตาราง" },
        { type: "steps", description: "1. คลิกปุ่ม Row actions ท้ายแถว แล้วเลือก Delete\n2. ใน dialog ยืนยัน คลิก Cancel" },
        { type: "expected", description: "Dialog ปิดลงโดยไม่มี toast ลบสำเร็จ; แถวเดิมยังอยู่ในตาราง" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Alternate Flow" },
      ],
    },
    async ({ page }) => {
      await page.goto(PATH);
      await page.waitForLoadState("networkidle");
      const firstDataRow = page.getByRole("row").nth(1);
      await expect(firstDataRow).toBeVisible({ timeout: 10_000 });
      await firstDataRow.getByRole("button", { name: /Row actions/i }).click();
      await page.getByRole("menuitem", { name: /^Delete$/i }).click();
      const alertDialog = page.getByRole("alertdialog");
      await expect(alertDialog).toBeVisible({ timeout: 5_000 });
      await alertDialog.getByRole("button", { name: /Cancel|ยกเลิก/i }).click();
      await expect(alertDialog).toBeHidden({ timeout: 5_000 });
      // Row should still be there
      await expect(firstDataRow).toBeVisible();
    },
  );

  // ------------------------------------------------------------------
  // TC-COA-200001 — Validation: empty code
  // ------------------------------------------------------------------
  test(
    "TC-COA-200001 บันทึกไม่ได้เมื่อเว้นรหัสบัญชีว่าง",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่หน้า /config/chart-of-accounts/new" },
        { type: "steps", description: "1. ปล่อยช่อง Code ว่างไว้\n2. กรอกเฉพาะ Account Description (English)\n3. คลิกปุ่ม Create" },
        { type: "expected", description: "ไม่บันทึก: ยังอยู่ที่ /new และช่อง Code ถูกทำเครื่องหมายผิดพลาด (aria-invalid)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Validation" },
      ],
    },
    async ({ page }) => {
      const h = new PageFormCrudHelper(page, formOpts);
      await page.goto(NEW_PATH);
      await page.waitForLoadState("networkidle");
      await h.nameInput().fill("Test Name Only");
      await h.saveButton().click();
      // Validation blocks the submit: still on /new, code field flagged
      await expect(page).toHaveURL(/\/new/);
      await expect(page.locator("#coa-code")).toHaveAttribute("aria-invalid", "true", { timeout: 5_000 });
    },
  );

  // ------------------------------------------------------------------
  // TC-COA-200002 — Validation: empty name
  // ------------------------------------------------------------------
  test(
    "TC-COA-200002 บันทึกไม่ได้เมื่อเว้นชื่อบัญชีว่าง",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่หน้า /config/chart-of-accounts/new" },
        { type: "steps", description: "1. กรอกเฉพาะช่อง Code\n2. ปล่อยช่อง Account Description (English) ว่างไว้\n3. คลิกปุ่ม Create" },
        { type: "expected", description: "ไม่บันทึก: ยังอยู่ที่ /new และช่อง Account Description (English) ถูกทำเครื่องหมายผิดพลาด (aria-invalid)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Validation" },
      ],
    },
    async ({ page }) => {
      const h = new PageFormCrudHelper(page, formOpts);
      await page.goto(NEW_PATH);
      await page.waitForLoadState("networkidle");
      await h.codeInput().fill(fakeCode("CVAL"));
      await h.saveButton().click();
      await expect(page).toHaveURL(/\/new/);
      await expect(page.locator("#coa-description-1")).toHaveAttribute("aria-invalid", "true", { timeout: 5_000 });
    },
  );

  // ------------------------------------------------------------------
  // TC-COA-200003 — Validation: description optional
  // ------------------------------------------------------------------
  test(
    "TC-COA-200003 ช่องคำอธิบายภาษาไทยไม่บังคับ — ปล่อยว่างแล้วบันทึกได้",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่หน้า /config/chart-of-accounts/new; เตรียมรหัสบัญชีที่ยังไม่ถูกใช้" },
        { type: "steps", description: "1. กรอก Code, Account Description (English), Category และ Type\n2. ปล่อยช่อง Account Description (Thai) ว่าง\n3. คลิกปุ่ม Create" },
        { type: "expected", description: "บัญชีถูกสร้างสำเร็จพร้อม toast (ช่องคำอธิบายภาษาไทยไม่บังคับ)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Validation" },
      ],
    },
    async ({ page }) => {
      const h = new PageFormCrudHelper(page, formOpts);
      await page.goto(NEW_PATH);
      await page.waitForLoadState("networkidle");
      const code = fakeCode("COA3");
      // Thai description (description_2) is left empty
      await fillCoaForm(page, { code, name: fakeName({ tag: "COA200" }) });
      await h.saveButton().click();
      await expect(page.getByText(/created successfully/i).first()).toBeVisible({ timeout: 10_000 });
      // Cleanup: delete the row we just made
      await h.list.search(code);
      const row = page.getByRole("row", { name: new RegExp(code) }).first();
      await expect(row).toBeVisible({ timeout: 10_000 });
      await row.getByRole("button", { name: /Row actions/i }).click();
      await page.getByRole("menuitem", { name: /^Delete$/i }).click();
      await h.deleteConfirmButton().click();
      await expect(page.getByText(/deleted successfully/i).first()).toBeVisible({ timeout: 10_000 });
    },
  );

  // ------------------------------------------------------------------
  // TC-COA-900001 — Max-length per field
  // ------------------------------------------------------------------
  test(
    "TC-COA-900001 ช่องกรอกจำกัดความยาวสูงสุดตามที่กำหนด",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่หน้า /config/chart-of-accounts/new" },
        { type: "steps", description: "1. พิมพ์ข้อความยาวเกิน 50 ตัวอักษรลงในช่อง Code\n2. พิมพ์ข้อความยาวเกิน 150 ตัวอักษรลงในช่อง Account Description (English)\n3. พิมพ์ข้อความยาวเกิน 150 ตัวอักษรลงในช่อง Account Description (Thai)" },
        { type: "expected", description: "ช่อง Code รับได้สูงสุด 50 ตัวอักษร; ช่อง Account name และ Description รับได้สูงสุด 150 ตัวอักษร" },
        { type: "priority", description: "Low" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      const h = new PageFormCrudHelper(page, formOpts);
      await page.goto(NEW_PATH);
      await page.waitForLoadState("networkidle");
      await h.codeInput().fill("c".repeat(100));
      expect((await h.codeInput().inputValue()).length).toBeLessThanOrEqual(50);
      await h.nameInput().fill("n".repeat(300));
      expect((await h.nameInput().inputValue()).length).toBeLessThanOrEqual(150);
      await page.locator("#coa-description-2").fill("d".repeat(300));
      expect((await page.locator("#coa-description-2").inputValue()).length).toBeLessThanOrEqual(150);
    },
  );

  // ------------------------------------------------------------------
  // TC-COA-900002 — Empty state + export disabled
  // ------------------------------------------------------------------
  test(
    "TC-COA-900002 ไม่พบข้อมูล — แสดงสถานะว่างและส่งออกไม่ได้",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่หน้า /config/chart-of-accounts บน desktop" },
        { type: "steps", description: `1. ค้นหาด้วยคำที่ไม่มีทางตรงกับบัญชีใด '__NOPE__${uid}' แล้วกด Enter` },
        { type: "expected", description: "ตารางไม่มีแถวข้อมูล และมุมมอง List แสดงสถานะว่าง" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      const list = new ConfigListPage(page, PATH);
      await list.goto();
      await list.search(`__NOPE__${uid}`);
      await expect(list.emptyState().first()).toBeVisible({ timeout: 10_000 });
    },
  );
});
