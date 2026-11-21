import { expect } from "@playwright/test";
import { createAuthTest } from "./fixtures/auth.fixture";
import { CertificationPage } from "./pages/certification.page";
import { DialogCrudHelper } from "./pages/dialog-crud.helper";
import { addDialogSecurityCases } from "./helpers/security-cases";
import { BU_CODE } from "./test-users";
import { ensureActiveBu, getBusinessUnits, defaultBu } from "./helpers/bu";
import { BuSwitcherPage } from "./pages/bu-switcher.page";
import { uid, fakeCode, fakeName, buildEntity } from "./helpers/test-data";

const test = createAuthTest("carmensoftware.dev+admin@gmail.com");
const PATH = "/vendor-management/certification";
const { code: CODE, name: NAME, nameUpdated: NAME_UPDATED } = buildEntity({ codePrefix: "EC", tag: "CERT" });

// Security cases only exercise name/list/dialog — reuse the proven shared
// helper there (code field is irrelevant to those cases). Our own tests use
// the dedicated CertificationPage.
const secOpts = {
  listPath: PATH,
  nameInputId: "certification-name",
  activeSwitchId: "certification-is-active",
};

// BLOCKED (writes only): the backend rejects every create/update/delete on
// `/api/config/{bu}/vendor-master-certificates` with 400 "metadata field is
// required" — certification-dialog.tsx still posts a flat body
// (`{code, name, description, is_active}`) instead of wrapping it the way the
// other migrated config modules do (see eco-dialog.tsx:67,
// `metadata: { ...fields, doc_version }`). Verified 2026-09-18 against the
// local backend on :4000.
//
// The note that used to live here blamed RBAC ("Permission Denied for BU(s):
// BLAVG"). That was a misdiagnosis caused by a stale route: the spec pointed at
// `/config/certification`, but the module had moved to
// `/vendor-management/certification`. With the correct path the list, search,
// BU-assert and validation cases all pass as carmensoftware.dev+admin@gmail.com — only the
// writes fail, and they fail on the payload contract, not on permissions.
//
// The 9 write cases below are `test.fail(true, "suspected bug: ...")`: certification-dialog.tsx posts
// without `metadata`, so the backend answers 400 "metadata field is required" (verified live on dev,
// 2026-11-21). They flip red ("expected to fail but passed") when the payload is fixed — then drop the marker.
// (that change also supplies doc_version, which TC-CERT-040003 needs on PATCH).
test.describe("Certification — Smoke & CRUD", () => {
  test.beforeEach(async ({ page }) => {
    await ensureActiveBu(page, BU_CODE);
  });

  test(
    "TC-CERT-010001 หน้า list โหลดสำเร็จ",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com ผ่าน auth fixture" },
        { type: "steps", description: "1. ไปที่ /vendor-management/certification" },
        { type: "expected", description: "URL ตรงกับ /vendor-management/certification; หน้า list render สำเร็จ" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page }) => {
      const cert = new CertificationPage(page);
      await cert.list.goto();
      await expect(page).toHaveURL(new RegExp(PATH));
    },
  );

  test(
    "TC-CERT-010002 ปุ่ม Add แสดง",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; อยู่ที่ /vendor-management/certification" },
        { type: "steps", description: "1. ไปที่ /vendor-management/certification" },
        { type: "expected", description: "ปุ่ม Add visible บนหน้า list" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page }) => {
      const cert = new CertificationPage(page);
      await cert.list.goto();
      await expect(cert.list.addButton()).toBeVisible();
    },
  );

  test(
    "TC-CERT-010003 ช่องค้นหาใช้งานได้",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; อยู่ที่ /vendor-management/certification" },
        { type: "steps", description: "1. ไปที่ /vendor-management/certification\n2. พิมพ์ 'test' ในช่องค้นหา" },
        { type: "expected", description: "ช่องค้นหา visible และรับค่า input ได้โดยไม่ error" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page }) => {
      const cert = new CertificationPage(page);
      await cert.list.goto();
      await expect(cert.list.searchInput()).toBeVisible();
      await cert.list.search("test");
    },
  );

  test(
    "TC-CERT-010004 ค้นหาคำที่ไม่มีต้องแสดง empty state",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; อยู่ที่ /vendor-management/certification" },
        { type: "steps", description: "1. ไปที่ /vendor-management/certification\n2. ค้นหาด้วยคำที่ไม่มี (`__NOPE__<UID>`)" },
        { type: "expected", description: "Empty-state placeholder ปรากฏภายใน 10s (ไม่มีแถวที่ตรงกับคำค้น)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const cert = new CertificationPage(page);
      await cert.list.goto();
      await cert.list.search(`__NOPE__${uid}`);
      await expect(cert.list.emptyState().first()).toBeVisible({ timeout: 10_000 });
    },
  );

  test(
    "TC-CERT-010005 active BU = BLAVG",
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
    "TC-CERT-200001 บันทึกโดยไม่กรอก code/name ต้องแสดง error",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; อยู่ที่ /vendor-management/certification" },
        { type: "steps", description: "1. เปิด Add dialog\n2. กด Save โดยไม่กรอก code/name" },
        { type: "expected", description: "Error message แสดงใน dialog (required validation); dialog ยังเปิดอยู่" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Validation" },
      ],
    },
    async ({ page }) => {
      const cert = new CertificationPage(page);
      await cert.list.goto();
      await cert.openAddDialog();
      await cert.saveButton().click();
      await expect(cert.errorMessage().first()).toBeVisible();
      await cert.cancelButton().click();
    },
  );

  test(
    "TC-CERT-030001 สร้างรายการใหม่และปรากฏในตาราง",
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
      test.fail(true, "suspected bug: POST /vendor-master-certificates answers 400 \"metadata field is required\" — certification-dialog.tsx sends {code,name,description,is_active} without metadata, so no certification can be created");
      const cert = new CertificationPage(page);
      await cert.list.goto();
      await cert.createCertification(CODE, NAME);
      await cert.list.search(CODE);
      // CODE column may render as a cell or a clickable button (CellAction)
      const codeCell = page.getByRole("cell", { name: CODE });
      const codeButton = page.getByRole("button", { name: CODE, exact: true });
      await expect(codeCell.or(codeButton).first()).toBeVisible({ timeout: 10_000 });
    },
  );

  test(
    "TC-CERT-040001 แก้ไขชื่อและบันทึก",
    {
      annotation: [
        { type: "preconditions", description: "TC-CERT-030001 ผ่านแล้ว → record CODE/NAME มีอยู่ใน DB" },
        { type: "steps", description: "1. ค้นหา CODE ใน list\n2. คลิกแถวเพื่อเปิด edit dialog\n3. clear ชื่อและกรอก NAME_UPDATED\n4. กด Save" },
        { type: "expected", description: "Updated/success toast ปรากฏ (updated/success/สำเร็จ)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      test.fail(true, "suspected bug: POST /vendor-master-certificates answers 400 \"metadata field is required\" — certification-dialog.tsx sends {code,name,description,is_active} without metadata, so no certification can be created");
      const cert = new CertificationPage(page);
      await cert.list.goto();
      await cert.list.search(CODE);
      await cert.clickRow(CODE);
      await cert.nameInput().clear();
      await cert.nameInput().fill(NAME_UPDATED);
      await cert.saveButton().click();
      await expect(page.getByText(/updated|success|สำเร็จ/i).first()).toBeVisible({
        timeout: 10_000,
      });
    },
  );

  test(
    "TC-CERT-200002 แก้ไข: clear name แล้วบันทึก ต้องแสดง error",
    {
      annotation: [
        { type: "preconditions", description: "TC-CERT-040001 ผ่านแล้ว → record มี name = NAME_UPDATED" },
        { type: "steps", description: "1. ค้นหา CODE ใน list\n2. เปิด edit dialog\n3. clear name\n4. กด Save" },
        { type: "expected", description: "Error message แสดงใน dialog (required validation); dialog ยังเปิดอยู่" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Validation" },
      ],
    },
    async ({ page }) => {
      test.fail(true, "suspected bug: POST /vendor-master-certificates answers 400 \"metadata field is required\" — certification-dialog.tsx sends {code,name,description,is_active} without metadata, so no certification can be created");
      const cert = new CertificationPage(page);
      await cert.list.goto();
      await cert.list.search(CODE);
      await cert.clickRow(CODE);
      await cert.nameInput().clear();
      await cert.saveButton().click();
      await expect(cert.errorMessage().first()).toBeVisible();
      await cert.cancelButton().click();
    },
  );

  test(
    "TC-CERT-050001 ลบรายการ",
    {
      annotation: [
        { type: "preconditions", description: "TC-CERT-200002 ผ่านแล้ว → record CODE ยังคงมีอยู่ใน DB" },
        { type: "steps", description: "1. ค้นหา CODE ใน list\n2. กด Delete ที่แถว\n3. ยืนยัน Delete" },
        { type: "expected", description: "Deleted/success toast ปรากฏ (deleted/success/สำเร็จ)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      test.fail(true, "suspected bug: POST /vendor-master-certificates answers 400 \"metadata field is required\" — certification-dialog.tsx sends {code,name,description,is_active} without metadata, so no certification can be created");
      const cert = new CertificationPage(page);
      await cert.list.goto();
      await cert.list.search(CODE);
      // fail fast when TC-CERT-030001's record is missing (a bare timeout is not an "expected failure")
      await expect(page.getByRole("row", { name: new RegExp(CODE) }).first()).toBeVisible({ timeout: 5_000 });
      await cert.deleteRow(CODE);
      await cert.deleteConfirmButton().click();
      await expect(page.getByText(/deleted|success|สำเร็จ/i).first()).toBeVisible({
        timeout: 10_000,
      });
    },
  );

  test(
    "TC-CERT-040002 toggle is_active แล้ว persist",
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
      test.fail(true, "suspected bug: POST /vendor-master-certificates answers 400 \"metadata field is required\" — certification-dialog.tsx sends {code,name,description,is_active} without metadata, so no certification can be created");
      const cert = new CertificationPage(page);
      const code = fakeCode("EC42");
      const name = fakeName({ tag: "CERT042" });
      await cert.list.goto();
      await cert.createCertification(code, name, { active: false });

      await cert.list.search(code);
      await cert.clickRow(code);
      await expect(cert.activeSwitch()).toHaveAttribute("aria-checked", "false", { timeout: 5_000 });
      await cert.cancelButton().click();

      await cert.list.goto();
      await cert.list.search(code);
      await cert.deleteRow(code);
      await cert.deleteConfirmButton().click();
      await expect(page.getByText(/deleted|success|สำเร็จ/i).first()).toBeVisible({ timeout: 10_000 });
    },
  );

  test(
    "TC-CERT-040003 แก้ไขชื่อแล้ว persist",
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
      test.fail(true, "suspected bug: POST /vendor-master-certificates answers 400 \"metadata field is required\" — certification-dialog.tsx sends {code,name,description,is_active} without metadata, so no certification can be created");
      const cert = new CertificationPage(page);
      const code = fakeCode("EC43");
      const name = fakeName({ tag: "CERT043" });
      const renamed = fakeName({ tag: "CERT043 Upd" });
      await cert.list.goto();
      await cert.createCertification(code, name);

      await cert.list.search(code);
      await cert.clickRow(code);
      await expect(cert.nameInput()).toBeEnabled({ timeout: 5_000 });
      await cert.nameInput().clear();
      await cert.nameInput().fill(renamed);
      await cert.saveButton().click();
      await expect(cert.dialog()).toBeHidden({ timeout: 10_000 });

      await cert.list.goto();
      await cert.list.search(code);
      await cert.clickRow(code);
      await expect(cert.nameInput()).toHaveValue(renamed, { timeout: 5_000 });
      await cert.cancelButton().click();

      await cert.list.goto();
      await cert.list.search(code);
      await cert.deleteRow(code);
      await cert.deleteConfirmButton().click();
      await expect(page.getByText(/deleted|success|สำเร็จ/i).first()).toBeVisible({ timeout: 10_000 });
    },
  );

  test(
    "TC-CERT-040004 ยกเลิกการแก้ไข ค่าต้องไม่ถูกบันทึก",
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
      test.fail(true, "suspected bug: POST /vendor-master-certificates answers 400 \"metadata field is required\" — certification-dialog.tsx sends {code,name,description,is_active} without metadata, so no certification can be created");
      const cert = new CertificationPage(page);
      const code = fakeCode("EC44");
      const name = fakeName({ tag: "CERT044" });
      await cert.list.goto();
      await cert.createCertification(code, name);

      await cert.list.search(code);
      await cert.clickRow(code);
      await expect(cert.nameInput()).toBeEnabled({ timeout: 5_000 });
      await cert.nameInput().fill(`${name} DIRTY`);
      await cert.cancelButton().click();
      await expect(cert.dialog()).toBeHidden({ timeout: 5_000 });

      await cert.list.goto();
      await cert.list.search(code);
      await cert.clickRow(code);
      await expect(cert.nameInput()).toHaveValue(name, { timeout: 5_000 });
      await cert.cancelButton().click();

      await cert.list.goto();
      await cert.list.search(code);
      await cert.deleteRow(code);
      await cert.deleteConfirmButton().click();
      await expect(page.getByText(/deleted|success|สำเร็จ/i).first()).toBeVisible({ timeout: 10_000 });
    },
  );

  test(
    "TC-CERT-200003 สร้าง code ซ้ำ ต้องถูก reject",
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
      test.fail(true, "suspected bug: POST /vendor-master-certificates answers 400 \"metadata field is required\" — certification-dialog.tsx sends {code,name,description,is_active} without metadata, so no certification can be created");
      const cert = new CertificationPage(page);
      const code = fakeCode("EC20");
      const name = fakeName({ tag: "CERT200" });
      const name2 = fakeName({ tag: "CERT200 Dup" });
      await cert.list.goto();
      await cert.createCertification(code, name);

      await cert.list.goto();
      await cert.openAddDialog();
      await cert.codeInput().fill(code);
      await cert.nameInput().fill(name2);
      await cert.saveButton().click();

      // Expected: backend rejects duplicate code → dialog stays open.
      const dialogStillOpen = await cert.dialog().isVisible({ timeout: 10_000 }).catch(() => false);
      if (dialogStillOpen) {
        await expect(cert.dialog()).toBeVisible();
        await cert.cancelButton().click();
      }

      // Cleanup: delete the original (and any dup that slipped through).
      await cert.list.goto();
      await cert.list.search(code);
      await cert.deleteRow(code);
      await cert.deleteConfirmButton().click();
      await expect(page.getByText(/deleted|success|สำเร็จ/i).first()).toBeVisible({ timeout: 10_000 });

      // If the dialog closed, the dup was accepted — assert it was reject-only.
      expect(dialogStillOpen).toBe(true);
    },
  );

  test(
    "TC-CERT-050002 ยกเลิกการลบ record ต้องยังอยู่",
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
      test.fail(true, "suspected bug: POST /vendor-master-certificates answers 400 \"metadata field is required\" — certification-dialog.tsx sends {code,name,description,is_active} without metadata, so no certification can be created");
      const cert = new CertificationPage(page);
      const code = fakeCode("EC50");
      const name = fakeName({ tag: "CERT050" });
      await cert.list.goto();
      await cert.createCertification(code, name);

      await cert.list.goto();
      await cert.list.search(code);
      await cert.deleteRow(code);
      await expect(cert.deleteConfirm()).toBeVisible({ timeout: 5_000 });
      await cert.deleteCancelButton().click();
      await expect(cert.deleteConfirm()).toBeHidden({ timeout: 5_000 });

      await cert.list.goto();
      await cert.list.search(code);
      const codeCell = page.getByRole("cell", { name: code });
      const codeButton = page.getByRole("button", { name: code, exact: true });
      await expect(codeCell.or(codeButton).first()).toBeVisible({ timeout: 10_000 });

      await cert.deleteRow(code);
      await cert.deleteConfirmButton().click();
      await expect(page.getByText(/deleted|success|สำเร็จ/i).first()).toBeVisible({ timeout: 10_000 });
    },
  );

  addDialogSecurityCases(test, {
    prefix: "CERT",
    listPath: PATH,
    makeHelper: (page) => new DialogCrudHelper(page, secOpts),
    skipAuth: true,
  });
});
