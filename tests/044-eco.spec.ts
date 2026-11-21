import { expect } from "@playwright/test";
import { createAuthTest } from "./fixtures/auth.fixture";
import { EcoPage } from "./pages/eco.page";
import { DialogCrudHelper } from "./pages/dialog-crud.helper";
import { addDialogSecurityCases } from "./helpers/security-cases";
import { BU_CODE } from "./test-users";
import { ensureActiveBu, getBusinessUnits, defaultBu } from "./helpers/bu";
import { BuSwitcherPage } from "./pages/bu-switcher.page";
import { uid, fakeCode, fakeName, buildEntity } from "./helpers/test-data";

const test = createAuthTest("carmensoftware.dev+admin@gmail.com");
const PATH = "/product-management/eco";
const { code: CODE, name: NAME, nameUpdated: NAME_UPDATED } = buildEntity({ codePrefix: "EE", tag: "ECO" });

// Security cases only exercise name/list/dialog — reuse the proven shared
// helper there (code field is irrelevant to those cases). Our own tests use
// the dedicated EcoPage.
const secOpts = {
  listPath: PATH,
  nameInputId: "eco-label-name",
  activeSwitchId: "eco-label-is-active",
};
test.describe("Eco — Smoke & CRUD", () => {
  test.beforeEach(async ({ page }) => {
    await ensureActiveBu(page, BU_CODE);
  });

  test(
    "TC-ECO-010001 หน้า list โหลดสำเร็จ",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com ผ่าน auth fixture" },
        { type: "steps", description: "1. ไปที่ /product-management/eco" },
        { type: "expected", description: "URL ตรงกับ /product-management/eco; หน้า list render สำเร็จ" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page }) => {
      const eco = new EcoPage(page);
      await eco.list.goto();
      await expect(page).toHaveURL(new RegExp(PATH));
    },
  );

  test(
    "TC-ECO-010002 ปุ่ม Add แสดง",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; อยู่ที่ /product-management/eco" },
        { type: "steps", description: "1. ไปที่ /product-management/eco" },
        { type: "expected", description: "ปุ่ม Add visible บนหน้า list" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page }) => {
      const eco = new EcoPage(page);
      await eco.list.goto();
      await expect(eco.list.addButton()).toBeVisible();
    },
  );

  test(
    "TC-ECO-010003 ช่องค้นหาใช้งานได้",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; อยู่ที่ /product-management/eco" },
        { type: "steps", description: "1. ไปที่ /product-management/eco\n2. พิมพ์ 'test' ในช่องค้นหา" },
        { type: "expected", description: "ช่องค้นหา visible และรับค่า input ได้โดยไม่ error" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page }) => {
      const eco = new EcoPage(page);
      await eco.list.goto();
      await expect(eco.list.searchInput()).toBeVisible();
      await eco.list.search("test");
    },
  );

  test(
    "TC-ECO-010004 ค้นหาคำที่ไม่มีต้องแสดง empty state",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; อยู่ที่ /product-management/eco" },
        { type: "steps", description: "1. ไปที่ /product-management/eco\n2. ค้นหาด้วยคำที่ไม่มี (`__NOPE__<UID>`)" },
        { type: "expected", description: "Empty-state placeholder ปรากฏภายใน 10s (ไม่มีแถวที่ตรงกับคำค้น)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const eco = new EcoPage(page);
      await eco.list.goto();
      await eco.list.search(`__NOPE__${uid}`);
      await expect(eco.list.emptyState().first()).toBeVisible({ timeout: 10_000 });
    },
  );

  test(
    "TC-ECO-010005 active BU = BLAVG",
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

  test(
    "TC-ECO-200001 บันทึกโดยไม่กรอก code/name ต้องแสดง error",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; อยู่ที่ /product-management/eco" },
        { type: "steps", description: "1. เปิด Add dialog\n2. กด Save โดยไม่กรอก code/name" },
        { type: "expected", description: "Error message แสดงใน dialog (required validation); dialog ยังเปิดอยู่" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Validation" },
      ],
    },
    async ({ page }) => {
      const eco = new EcoPage(page);
      await eco.list.goto();
      await eco.openAddDialog();
      await eco.saveButton().click();
      await expect(eco.errorMessage().first()).toBeVisible();
      await eco.cancelButton().click();
    },
  );

  test(
    "TC-ECO-030001 สร้างรายการใหม่และปรากฏในตาราง",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; record CODE ยังไม่มีอยู่ใน DB" },
        { type: "steps", description: "1. เปิด Add dialog\n2. กรอก code = CODE, name = NAME\n3. กด Save\n4. ค้นหาด้วย CODE" },
        { type: "expected", description: "Success toast (created/success/สำเร็จ); แถวใหม่ที่มี CODE ปรากฏใน list" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const eco = new EcoPage(page);
      await eco.list.goto();
      await eco.createEco(CODE, NAME);
      await eco.list.search(CODE);
      // CODE column may render as a cell or a clickable button (CellAction)
      const codeCell = page.getByRole("cell", { name: CODE });
      const codeButton = page.getByRole("button", { name: CODE, exact: true });
      await expect(codeCell.or(codeButton).first()).toBeVisible({ timeout: 10_000 });
    },
  );

  test(
    "TC-ECO-040001 แก้ไขชื่อและบันทึก",
    {
      annotation: [
        { type: "preconditions", description: "TC-ECO-030001 ผ่านแล้ว → record CODE/NAME มีอยู่ใน DB" },
        { type: "steps", description: "1. ค้นหา CODE ใน list\n2. คลิกแถวเพื่อเปิด edit dialog\n3. clear ชื่อและกรอก NAME_UPDATED\n4. กด Save" },
        { type: "expected", description: "Updated/success toast ปรากฏ (updated/success/สำเร็จ)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const eco = new EcoPage(page);
      await eco.list.goto();
      await eco.list.search(CODE);
      await eco.clickRow(CODE);
      await eco.nameInput().clear();
      await eco.nameInput().fill(NAME_UPDATED);
      await eco.saveButton().click();
      await expect(page.getByText(/updated|success|สำเร็จ/i).first()).toBeVisible({
        timeout: 10_000,
      });
    },
  );

  test(
    "TC-ECO-200002 แก้ไข: clear name แล้วบันทึก ต้องแสดง error",
    {
      annotation: [
        { type: "preconditions", description: "TC-ECO-040001 ผ่านแล้ว → record มี name = NAME_UPDATED" },
        { type: "steps", description: "1. ค้นหา CODE ใน list\n2. เปิด edit dialog\n3. clear name\n4. กด Save" },
        { type: "expected", description: "Error message แสดงใน dialog (required validation); dialog ยังเปิดอยู่" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Validation" },
      ],
    },
    async ({ page }) => {
      const eco = new EcoPage(page);
      await eco.list.goto();
      await eco.list.search(CODE);
      await eco.clickRow(CODE);
      await eco.nameInput().clear();
      await eco.saveButton().click();
      await expect(eco.errorMessage().first()).toBeVisible();
      await eco.cancelButton().click();
    },
  );

  test(
    "TC-ECO-050001 ลบรายการ",
    {
      annotation: [
        { type: "preconditions", description: "TC-ECO-200002 ผ่านแล้ว → record CODE ยังคงมีอยู่ใน DB" },
        { type: "steps", description: "1. ค้นหา CODE ใน list\n2. กด Delete ที่แถว\n3. ยืนยัน Delete" },
        { type: "expected", description: "Deleted/success toast ปรากฏ (deleted/success/สำเร็จ)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const eco = new EcoPage(page);
      await eco.list.goto();
      await eco.list.search(CODE);
      await eco.deleteRow(CODE);
      await eco.deleteConfirmButton().click();
      await expect(page.getByText(/deleted|success|สำเร็จ/i).first()).toBeVisible({
        timeout: 10_000,
      });
    },
  );

  test(
    "TC-ECO-040002 toggle is_active แล้ว persist",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG" },
        { type: "steps", description: "1. สร้าง record ด้วย is_active = false\n2. เปิดแถวอีกครั้งอ่านสถานะ switch\n3. ลบ record" },
        { type: "expected", description: "หลังเปิดแถวใหม่ switch is_active = false (ค่าถูก persist)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const eco = new EcoPage(page);
      const code = fakeCode("EC42");
      const name = fakeName({ tag: "ECO042" });
      await eco.list.goto();
      await eco.createEco(code, name, { active: false });

      await eco.list.search(code);
      await eco.clickRow(code);
      await expect(eco.activeSwitch()).toHaveAttribute("aria-checked", "false", { timeout: 5_000 });
      await eco.cancelButton().click();

      await eco.list.goto();
      await eco.list.search(code);
      await eco.deleteRow(code);
      await eco.deleteConfirmButton().click();
      await expect(page.getByText(/deleted|success|สำเร็จ/i).first()).toBeVisible({ timeout: 10_000 });
    },
  );

  test(
    "TC-ECO-040003 แก้ไขชื่อแล้ว persist",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG" },
        { type: "steps", description: "1. สร้าง record\n2. เปิดแถวจาก list แก้ name แล้ว Save\n3. ยืนยัน list มี name ใหม่\n4. ลบ record" },
        { type: "expected", description: "Updated; list มีแถว name ใหม่ (ค่าถูก persist จริง)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const eco = new EcoPage(page);
      const code = fakeCode("EC43");
      const name = fakeName({ tag: "ECO043" });
      const renamed = fakeName({ tag: "ECO043 Upd" });
      await eco.list.goto();
      await eco.createEco(code, name);

      await eco.list.search(code);
      await eco.clickRow(code);
      await expect(eco.nameInput()).toBeEnabled({ timeout: 5_000 });
      await eco.nameInput().clear();
      await eco.nameInput().fill(renamed);
      await eco.saveButton().click();
      await expect(eco.dialog()).toBeHidden({ timeout: 10_000 });

      await eco.list.goto();
      await eco.list.search(code);
      await eco.clickRow(code);
      await expect(eco.nameInput()).toHaveValue(renamed, { timeout: 5_000 });
      await eco.cancelButton().click();

      await eco.list.goto();
      await eco.list.search(code);
      await eco.deleteRow(code);
      await eco.deleteConfirmButton().click();
      await expect(page.getByText(/deleted|success|สำเร็จ/i).first()).toBeVisible({ timeout: 10_000 });
    },
  );

  test(
    "TC-ECO-040004 ยกเลิกการแก้ไข ค่าต้องไม่ถูกบันทึก",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG" },
        { type: "steps", description: "1. สร้าง record\n2. เปิดแถวแก้ name เป็นค่าใหม่\n3. กด Cancel (dialog ปิดโดยไม่ save)\n4. เปิดแถวเดิมอีกครั้งเช็ค name\n5. ลบ record" },
        { type: "expected", description: "หลัง Cancel แล้วเปิดใหม่ name ยังเป็นค่าเดิม (การแก้ไขไม่ถูกบันทึก)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const eco = new EcoPage(page);
      const code = fakeCode("EC44");
      const name = fakeName({ tag: "ECO044" });
      await eco.list.goto();
      await eco.createEco(code, name);

      await eco.list.search(code);
      await eco.clickRow(code);
      await expect(eco.nameInput()).toBeEnabled({ timeout: 5_000 });
      await eco.nameInput().fill(`${name} DIRTY`);
      await eco.cancelButton().click();
      await expect(eco.dialog()).toBeHidden({ timeout: 5_000 });

      await eco.list.goto();
      await eco.list.search(code);
      await eco.clickRow(code);
      await expect(eco.nameInput()).toHaveValue(name, { timeout: 5_000 });
      await eco.cancelButton().click();

      await eco.list.goto();
      await eco.list.search(code);
      await eco.deleteRow(code);
      await eco.deleteConfirmButton().click();
      await expect(page.getByText(/deleted|success|สำเร็จ/i).first()).toBeVisible({ timeout: 10_000 });
    },
  );

  test(
    "TC-ECO-200003 สร้าง code ซ้ำ ต้องถูก reject",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG" },
        { type: "steps", description: "1. สร้าง record ด้วย code X\n2. เปิด Add dialog กรอก code X เดิม + name อื่น กด Save\n3. ลบ record(s) (cleanup)" },
        { type: "expected", description: "รายการที่สองไม่ถูกสร้าง: dialog ยังเปิดอยู่ (backend reject code ซ้ำ)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const eco = new EcoPage(page);
      const code = fakeCode("EC20");
      const name = fakeName({ tag: "ECO200" });
      const name2 = fakeName({ tag: "ECO200 Dup" });
      await eco.list.goto();
      await eco.createEco(code, name);

      await eco.list.goto();
      await eco.openAddDialog();
      await eco.codeInput().fill(code);
      await eco.nameInput().fill(name2);
      await eco.saveButton().click();

      // Expected: backend rejects duplicate code → dialog stays open.
      await expect(eco.nameInput()).toBeVisible({ timeout: 10_000 });
      await eco.cancelButton().click();

      // Cleanup: delete the original (and any dup that slipped through).
      await eco.list.goto();
      await eco.list.search(code);
      await eco.deleteRow(code);
      await eco.deleteConfirmButton().click();
      await expect(page.getByText(/deleted|success|สำเร็จ/i).first()).toBeVisible({ timeout: 10_000 });

    },
  );

  test(
    "TC-ECO-050002 ยกเลิกการลบ record ต้องยังอยู่",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG" },
        { type: "steps", description: "1. สร้าง record\n2. เปิด delete dialog แล้วกด Cancel\n3. ค้นหา record ใน list\n4. ลบ record (cleanup)" },
        { type: "expected", description: "Delete dialog ปิดโดยไม่ลบ; record ยังปรากฏใน list" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const eco = new EcoPage(page);
      const code = fakeCode("EC50");
      const name = fakeName({ tag: "ECO050" });
      await eco.list.goto();
      await eco.createEco(code, name);

      await eco.list.goto();
      await eco.list.search(code);
      await eco.deleteRow(code);
      await expect(eco.deleteConfirm()).toBeVisible({ timeout: 5_000 });
      await eco.deleteCancelButton().click();
      await expect(eco.deleteConfirm()).toBeHidden({ timeout: 5_000 });

      await eco.list.goto();
      await eco.list.search(code);
      const codeCell = page.getByRole("cell", { name: code });
      const codeButton = page.getByRole("button", { name: code, exact: true });
      await expect(codeCell.or(codeButton).first()).toBeVisible({ timeout: 10_000 });

      await eco.deleteRow(code);
      await eco.deleteConfirmButton().click();
      await expect(page.getByText(/deleted|success|สำเร็จ/i).first()).toBeVisible({ timeout: 10_000 });
    },
  );

  addDialogSecurityCases(test, {
    prefix: "ECO",
    listPath: PATH,
    makeHelper: (page) => new DialogCrudHelper(page, secOpts),
    skipAuth: true,
  });
});
