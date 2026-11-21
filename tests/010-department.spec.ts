import { expect } from "@playwright/test";
import { createAuthTest } from "./fixtures/auth.fixture";
import { PageFormCrudHelper } from "./pages/page-form-crud.helper";
import { DepartmentMembersHelper } from "./pages/department-form.helper";
import { addPageFormSecurityCases } from "./helpers/security-cases";
import { BU_CODE } from "./test-users";
import { ensureActiveBu, getBusinessUnits, defaultBu } from "./helpers/bu";
import { BuSwitcherPage } from "./pages/bu-switcher.page";
import { uid, fakeCode, fakeName, fakeDescription, buildEntity } from "./helpers/test-data";

const test = createAuthTest("carmensoftware.dev+admin@gmail.com");
const PATH = "/config/department";
const { code: CODE, name: NAME, nameUpdated: NAME_UPDATED } = buildEntity({
  codePrefix: "E2E",
  tag: "DEP",
});

const opts = {
  listPath: PATH,
  codeInputId: "department-code",
  nameInputId: "department-name",
  activeSwitchId: "department-is-active",
  descriptionInputId: "department-description",
};

test.describe("Department — Smoke & CRUD", () => {
  test.beforeEach(async ({ page }) => {
    await ensureActiveBu(page, BU_CODE);
  });

  test(
    "TC-DEP-010001 หน้า list โหลดสำเร็จ",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com ผ่าน auth fixture" },
        { type: "steps", description: "1. ไปที่ /config/department" },
        { type: "expected", description: "URL ตรงกับ /config/department; หน้า list โหลดสำเร็จและพร้อมใช้งาน" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page }) => {
    const h = new PageFormCrudHelper(page, opts);
    await h.list.goto();
    await expect(page).toHaveURL(new RegExp(PATH));
  });

  test(
    "TC-DEP-010005 active BU = BLAVG",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com ผ่าน auth fixture; beforeEach เรียก ensureActiveBu(BLAVG) แล้ว" },
        { type: "steps", description: "1. อ่าน profile API (/api/proxy/api/user/profile)\n2. หา business unit ที่ is_default\n3. เปิดหน้าใดๆ ที่มี navbar แล้วอ่าน label ของ BU switcher" },
        { type: "expected", description: "default business unit มี code === 'BLAVG'; trigger ของ BU switcher ใน navbar แสดง label ของ BU นั้น" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page }) => {
      // getBusinessUnits navigates to /dashboard internally to capture the
      // profile response; the page is already on /dashboard when it returns.
      const units = await getBusinessUnits(page);
      const active = defaultBu(units);
      expect(active?.code).toBe(BU_CODE);

      const switcher = new BuSwitcherPage(page);
      await expect(switcher.trigger()).toContainText(active!.name, { timeout: 15_000 });
    },
  );

  test(
    "TC-DEP-010002 ปุ่ม Add แสดง",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; อยู่ที่ /config/department" },
        { type: "steps", description: "1. ไปที่ /config/department\n2. ตรวจสอบว่าปุ่ม Add ปรากฏ" },
        { type: "expected", description: "ปุ่ม Add visible บนหน้า list (พร้อมเข้าสู่ flow create)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page }) => {
    const h = new PageFormCrudHelper(page, opts);
    await h.list.goto();
    await expect(h.list.addButton()).toBeVisible();
  });

  test(
    "TC-DEP-010003 ช่องค้นหาใช้งานได้",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; อยู่ที่ /config/department" },
        { type: "steps", description: "1. ไปที่ /config/department\n2. พิมพ์ 'test' ในช่องค้นหา" },
        { type: "expected", description: "ช่องค้นหา visible และรับค่า input ได้โดยไม่ error" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page }) => {
    const h = new PageFormCrudHelper(page, opts);
    await h.list.goto();
    await expect(h.list.searchInput()).toBeVisible();
    await h.list.search("test");
  });

  test(
    "TC-DEP-010004 ค้นหาคำที่ไม่มีต้องแสดง empty state",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; อยู่ที่ /config/department" },
        { type: "steps", description: "1. ไปที่ /config/department\n2. ค้นหาด้วยคำที่ไม่มี (`__NOPE__<UID>`)" },
        { type: "expected", description: "Empty-state placeholder ปรากฏภายใน 10s (ไม่มีแถวที่ตรงกับคำค้น)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
    const h = new PageFormCrudHelper(page, opts);
    await h.list.goto();
    await h.list.search(`__NOPE__${uid}`);
    await expect(h.list.emptyState().first()).toBeVisible({ timeout: 10_000 });
  });

  test(
    "TC-DEP-200001 บันทึกโดยไม่กรอก code/name ต้องแสดง error",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; อยู่ที่ /config/department/new" },
        { type: "steps", description: "1. เปิดฟอร์ม new\n2. กด Save โดยไม่กรอก code/name (รวมถึง parent ถ้ามี)" },
        { type: "expected", description: "URL ยังคงอยู่ที่ /new (ฟอร์ม block submit ด้วย client-side validation)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Validation" },
      ],
    },
    async ({ page }) => {
    const h = new PageFormCrudHelper(page, opts);
    await h.gotoNew();
    await h.saveButton().click();
    // Stays on /new because validation fails
    await expect(page).toHaveURL(/\/new/);
  });

  // Ordered CRUD chain: create → edit → validate → delete, all operating on the
  // same record. Serial mode keeps them in one worker (stable module-level uid
  // from the faker factory) and skips the rest if one fails, instead of cascading
  // into fresh workers (a worker restart re-imports test-data and recomputes uid).
  test.describe.serial("CRUD chain — shares the TC-DEP-030001 record", () => {
  test(
    "TC-DEP-030001 สร้างรายการใหม่และปรากฏในตาราง",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; record CODE/NAME ยังไม่มีอยู่ใน DB" },
        { type: "steps", description: "1. เปิด new form\n2. กรอก code + name (ใช้ default parent/hierarchy ถ้ามี)\n3. กด Save\n4. กลับ list และค้นหาด้วย NAME" },
        { type: "expected", description: "Success toast (created/success/สำเร็จ); แถวใหม่ที่มี NAME ปรากฏใน list" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
    const h = new PageFormCrudHelper(page, opts);
    await h.gotoNew();
    await h.codeInput().fill(CODE);
    await h.nameInput().fill(NAME);
    await h.saveButton().click();
    await expect(page.getByText(/created|success|สำเร็จ/i).first()).toBeVisible({
      timeout: 10_000,
    });
    await h.list.goto();
    await h.list.search(NAME);
    await expect(page.getByRole("cell", { name: NAME })).toBeVisible();
  });

  test(
    "TC-DEP-040001 แก้ไขชื่อและบันทึก",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; TC-DEP-030001 ผ่านแล้ว → record CODE/NAME มีอยู่ใน DB" },
        { type: "steps", description: "1. ค้นหา NAME ใน list\n2. คลิกแถวเพื่อเปิด detail\n3. กดปุ่ม Edit\n4. clear name และกรอก NAME_UPDATED\n5. กด Save" },
        { type: "expected", description: "Updated/success toast ปรากฏ (updated/success/สำเร็จ)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
    const h = new PageFormCrudHelper(page, opts);
    await h.list.goto();
    await h.list.search(NAME);
    await h.clickRowName(NAME);
    await h.editButton().click();
    await h.nameInput().clear();
    await h.nameInput().fill(NAME_UPDATED);
    await h.saveButton().click();
    await expect(page.getByText(/updated|success|สำเร็จ/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test(
    "TC-DEP-200002 แก้ไข: clear code/name แล้วบันทึก ต้องแสดง error",
    {
      annotation: [
        { type: "preconditions", description: "TC-DEP-040001 ผ่านแล้ว → record มี name = NAME_UPDATED" },
        { type: "steps", description: "1. ค้นหา NAME_UPDATED ใน list\n2. เปิด detail\n3. กด Edit\n4. clear code + name\n5. กด Save" },
        { type: "expected", description: "Save button ยังคง visible (form ไม่ submit; ยังอยู่ใน edit mode)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Validation" },
      ],
    },
    async ({ page }) => {
    const h = new PageFormCrudHelper(page, opts);
    await h.list.goto();
    await h.list.search(NAME_UPDATED);
    await h.clickRowName(NAME_UPDATED);
    await h.editButton().click();
    await h.codeInput().clear();
    await h.nameInput().clear();
    await h.saveButton().click();
    // Validation must keep us on the form (Save button still visible)
    await expect(h.saveButton()).toBeVisible();
  });

  test(
    "TC-DEP-050001 ลบรายการ",
    {
      annotation: [
        { type: "preconditions", description: "TC-DEP-200002 ผ่านแล้ว → record NAME_UPDATED ยังคงมีอยู่ใน DB" },
        { type: "steps", description: "1. ค้นหา NAME_UPDATED ใน list\n2. เปิด detail\n3. กด Edit\n4. กด Delete\n5. ยืนยัน Delete" },
        { type: "expected", description: "Deleted/success toast ปรากฏ (deleted/success/สำเร็จ)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
    const h = new PageFormCrudHelper(page, opts);
    await h.list.goto();
    await h.list.search(NAME_UPDATED);
    await h.clickRowName(NAME_UPDATED);
    await h.editButton().click();
    await h.deleteButton().click();
    await h.deleteConfirmButton().click();
    await expect(page.getByText(/deleted|success|สำเร็จ/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });
  }); // end CRUD serial chain

  addPageFormSecurityCases(test, {
    prefix: "DEP",
    listPath: PATH,
    makeHelper: (page) => new PageFormCrudHelper(page, opts),
    skipAuth: true, // TCS-DEP00112 skipped
  });

  test(
    "TC-DEP-040002 แก้ไขแล้ว persist หลัง reload",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG" },
        { type: "steps", description: "1. สร้าง department (code+name)\n2. เปิด detail กด Edit เปลี่ยน name เป็นค่าใหม่ แล้ว Save\n3. reload หน้า detail\n4. กลับ list ค้นหา name ใหม่และ name เดิม" },
        { type: "expected", description: "หลัง reload ฟอร์มแสดง name ใหม่ (ค่าถูก persist จริง ไม่ใช่แค่ toast); list มีแถว name ใหม่ และไม่พบ name เดิม" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const h = new PageFormCrudHelper(page, opts);
      const code = fakeCode("D10");
      const name = fakeName({ tag: "DEP010010" });
      const renamed = fakeName({ tag: "DEP010010 Upd" });

      // create
      await h.gotoNew();
      await h.codeInput().fill(code);
      await h.nameInput().fill(name);
      await h.saveButton().click();
      await expect(page.getByText(/created|success|สำเร็จ/i).first()).toBeVisible({ timeout: 10_000 });

      // Open the record fresh from the list before editing. (Editing right after
      // create also persists; opening fresh avoids the create toast satisfying the
      // update-toast wait below, which could race the reload against the PATCH.)
      await h.list.goto();
      await h.list.search(name);
      await h.clickRowName(name);
      await h.editButton().click();
      await h.nameInput().clear();
      await h.nameInput().fill(renamed);
      await h.saveButton().click();
      await expect(page.getByText(/updated|success|สำเร็จ/i).first()).toBeVisible({ timeout: 10_000 });

      // reload: the persisted value must survive a fresh fetch. Reloading drops the
      // form back to view mode, which renders the value as plain text instead of an
      // input — so read it through viewValueFor, not `#<id>`.
      await page.reload();
      await page.waitForLoadState("networkidle");
      await expect(h.viewValueFor(opts.nameInputId)).toHaveText(renamed);

      // list reflects the rename
      await h.list.goto();
      await h.list.search(renamed);
      await expect(page.getByRole("cell", { name: renamed })).toBeVisible();
      await h.list.search(name);
      await expect(h.list.emptyState().first()).toBeVisible({ timeout: 10_000 });

      // cleanup — navigate to list fresh so empty-state from prior search doesn't linger
      await h.list.goto();
      await h.list.search(renamed);
      await expect(page.getByRole("cell", { name: renamed })).toBeVisible({ timeout: 10_000 });
      await h.clickRowName(renamed);
      await h.editButton().click();
      await h.deleteButton().click();
      await h.deleteConfirmButton().click();
      await expect(page.getByText(/deleted|success|สำเร็จ/i).first()).toBeVisible({ timeout: 10_000 });
    },
  );

  test(
    "TC-DEP-010006 ค้นหาด้วย code เจอรายการ",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG" },
        { type: "steps", description: "1. สร้าง department ด้วย code+name ที่รู้ค่า\n2. กลับ list แล้วค้นหาด้วย code\n3. ลบ record" },
        { type: "expected", description: "list แสดงแถวที่มี name ของ record เมื่อค้นด้วย code" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const h = new PageFormCrudHelper(page, opts);
      const code = fakeCode("D12");
      const name = fakeName({ tag: "DEP010012" });

      await h.gotoNew();
      await h.codeInput().fill(code);
      await h.nameInput().fill(name);
      await h.saveButton().click();
      await expect(page.getByText(/created|success|สำเร็จ/i).first()).toBeVisible({ timeout: 10_000 });

      await h.list.goto();
      await h.list.search(code);
      await expect(page.getByRole("cell", { name })).toBeVisible();

      await h.clickRowName(name);
      await h.editButton().click();
      await h.deleteButton().click();
      await h.deleteConfirmButton().click();
      await expect(page.getByText(/deleted|success|สำเร็จ/i).first()).toBeVisible({ timeout: 10_000 });
    },
  );

  test(
    "TC-DEP-200004 สร้าง code ซ้ำ ต้องถูก reject",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG" },
        { type: "steps", description: "1. สร้าง department ด้วย code X\n2. สร้างอีกรายการด้วย code X เดิม (name ต่าง)\n3. กด Save" },
        { type: "expected", description: "รายการที่สองไม่ถูกสร้าง: ยังอยู่ที่ฟอร์ม /new (ไม่ navigate ไป detail) — backend reject code ซ้ำ" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const h = new PageFormCrudHelper(page, opts);
      const code = fakeCode("D11");
      const name = fakeName({ tag: "DEP010011" });

      await h.gotoNew();
      await h.codeInput().fill(code);
      await h.nameInput().fill(name);
      await h.saveButton().click();
      await expect(page.getByText(/created|success|สำเร็จ/i).first()).toBeVisible({ timeout: 10_000 });

      await h.gotoNew();
      await h.codeInput().fill(code);
      await h.nameInput().fill(`${name} dup`);
      await h.saveButton().click();
      await expect(page).toHaveURL(/\/new/, { timeout: 10_000 });
      await expect(h.saveButton()).toBeVisible();

      // cleanup the first record
      await h.list.goto();
      await h.list.search(name);
      await h.clickRowName(name);
      await h.editButton().click();
      await h.deleteButton().click();
      await h.deleteConfirmButton().click();
      await expect(page.getByText(/deleted|success|สำเร็จ/i).first()).toBeVisible({ timeout: 10_000 });
    },
  );

  test(
    "TC-DEP-030003 toggle is_active แล้ว persist",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG" },
        { type: "steps", description: "1. เปิด new form\n2. ปิด switch is_active\n3. กรอก code+name แล้ว Save\n4. reload detail แล้วอ่านสถานะ switch" },
        { type: "expected", description: "หลัง save+reload switch is_active = false (ค่าถูก persist)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const h = new PageFormCrudHelper(page, opts);
      const code = fakeCode("D14");
      const name = fakeName({ tag: "DEP010014" });

      await h.gotoNew();
      await h.codeInput().fill(code);
      await h.nameInput().fill(name);
      await h.setActive(false);
      await h.saveButton().click();
      await expect(page.getByText(/created|success|สำเร็จ/i).first()).toBeVisible({ timeout: 10_000 });

      // Re-open from the list, not reload: a save leaves the browser on /new, so
      // reloading just re-renders the blank create form whose switch is back at
      // its default (true) — which is what this assertion used to read.
      await h.list.goto();
      await h.list.search(name);
      await h.clickRowName(name);
      // Detail opens in view mode: the status is a StatusBadge there, not the switch (FE department-form.tsx).
      await expect(page.getByText("Inactive", { exact: true }).first()).toBeVisible({ timeout: 5_000 });

      // cleanup
      await h.editButton().click();
      await h.deleteButton().click();
      await h.deleteConfirmButton().click();
      await expect(page.getByText(/deleted|success|สำเร็จ/i).first()).toBeVisible({ timeout: 10_000 });
    },
  );

  test(
    "TC-DEP-200003 code เกิน maxLength ต้องถูกจำกัดที่ 10",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; อยู่ที่ /config/department/new" },
        { type: "steps", description: "1. เปิด new form\n2. พิมพ์ code ยาว 15 ตัวอักษร" },
        { type: "expected", description: "ค่าใน input ถูกตัดที่ 10 ตัวอักษร (maxLength=10)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Validation" },
      ],
    },
    async ({ page }) => {
      const h = new PageFormCrudHelper(page, opts);
      await h.gotoNew();
      await h.codeInput().fill("ABCDEFGHIJ12345");
      await expect(h.codeInput()).toHaveValue("ABCDEFGHIJ");
    },
  );

  test(
    "TC-DEP-200005 บันทึกโดยกรอก field เดียว ต้องถูก block",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; อยู่ที่ /config/department/new" },
        { type: "steps", description: "1. เปิด new form กรอกเฉพาะ name (code ว่าง) กด Save\n2. เปิด new form ใหม่ กรอกเฉพาะ code (name ว่าง) กด Save" },
        { type: "expected", description: "ทั้งสองกรณีฟอร์ม block submit: ยังอยู่ที่ /new" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Validation" },
      ],
    },
    async ({ page }) => {
      const h = new PageFormCrudHelper(page, opts);

      await h.gotoNew();
      await h.nameInput().fill(fakeName({ tag: "DEP010021" }));
      await h.saveButton().click();
      await expect(page).toHaveURL(/\/new/);

      await h.gotoNew();
      await h.codeInput().fill(fakeCode("D21"));
      await h.saveButton().click();
      await expect(page).toHaveURL(/\/new/);
    },
  );

  test(
    "TC-DEP-030002 description สร้าง/แก้ไข + maxLength 256",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG" },
        { type: "steps", description: "1. สร้าง department พร้อม description\n2. reload เช็คค่า description\n3. ตรวจ maxLength: พิมพ์ description ยาว 300 ตัว\n4. ลบ record" },
        { type: "expected", description: "description ถูก persist หลัง reload; ช่อง description ถูกจำกัดที่ 256 ตัวอักษร" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const h = new PageFormCrudHelper(page, opts);
      const code = fakeCode("D15");
      const name = fakeName({ tag: "DEP010015" });
      const desc = fakeDescription();

      await h.gotoNew();
      await h.codeInput().fill(code);
      await h.nameInput().fill(name);
      await h.descriptionInput().fill(desc);
      await h.saveButton().click();
      await expect(page.getByText(/created|success|สำเร็จ/i).first()).toBeVisible({ timeout: 10_000 });

      // Saving does NOT navigate to the record — the app stays on /new (verified
      // 2026-09-19), so there is nothing to reload into a view. Open the record
      // from the list instead; that is the only path that yields view mode, where
      // the description is plain text rather than a textarea.
      await h.list.goto();
      await h.list.search(name);
      await h.clickRowName(name);
      await expect(h.viewValueFor(opts.descriptionInputId)).toHaveText(desc);

      await h.editButton().click();
      await h.descriptionInput().fill("x".repeat(300));
      await expect(h.descriptionInput()).toHaveValue("x".repeat(256));

      // cleanup
      await h.list.goto();
      await h.list.search(name);
      await h.clickRowName(name);
      await h.editButton().click();
      await h.deleteButton().click();
      await h.deleteConfirmButton().click();
      await expect(page.getByText(/deleted|success|สำเร็จ/i).first()).toBeVisible({ timeout: 10_000 });
    },
  );

  test(
    "TC-DEP-040003 Cancel ขณะ form dirty ต้องเด้ง Discard dialog",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG; มี record อยู่" },
        { type: "steps", description: "1. สร้าง record\n2. เปิด detail กด Edit เปลี่ยน name (form dirty)\n3. กด Cancel\n4. ยืนยัน Discard\n5. reload เช็ค name เดิม" },
        { type: "expected", description: "Discard dialog ปรากฏ; หลังยืนยันกลับ view mode และ name ยังเป็นค่าเดิม (ไม่ถูกบันทึก)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const h = new PageFormCrudHelper(page, opts);
      const code = fakeCode("D16");
      const name = fakeName({ tag: "DEP010016" });

      await h.gotoNew();
      await h.codeInput().fill(code);
      await h.nameInput().fill(name);
      await h.saveButton().click();
      await expect(page.getByText(/created|success|สำเร็จ/i).first()).toBeVisible({ timeout: 10_000 });

      await h.editButton().click();
      await h.nameInput().clear();
      await h.nameInput().fill(`${name} DIRTY`);
      await h.cancelButton().click();

      const discardConfirm = page.getByRole("alertdialog").getByRole("button", { name: /^(Discard|ละทิ้ง|ทิ้ง)$/i });
      await expect(discardConfirm).toBeVisible({ timeout: 5_000 });
      await discardConfirm.click();

      // Re-open from the list rather than reloading: the form stays on its own URL
      // after a save, so a reload lands on the same editable form, not a view.
      await h.list.goto();
      await h.list.search(name);
      await h.clickRowName(name);
      await expect(h.viewValueFor(opts.nameInputId)).toHaveText(name);

      // cleanup
      await h.editButton().click();
      await h.deleteButton().click();
      await h.deleteConfirmButton().click();
      await expect(page.getByText(/deleted|success|สำเร็จ/i).first()).toBeVisible({ timeout: 10_000 });
    },
  );

  test(
    "TC-DEP-050002 ยกเลิกการลบ record ต้องยังอยู่",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG; มี record อยู่" },
        { type: "steps", description: "1. สร้าง record\n2. เปิด detail กด Edit แล้วกด Delete\n3. ใน dialog กด Cancel\n4. กลับ list ค้นหา record" },
        { type: "expected", description: "Delete dialog ปิดโดยไม่ลบ; record ยังปรากฏใน list" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const h = new PageFormCrudHelper(page, opts);
      const code = fakeCode("D17");
      const name = fakeName({ tag: "DEP010017" });

      await h.gotoNew();
      await h.codeInput().fill(code);
      await h.nameInput().fill(name);
      await h.saveButton().click();
      await expect(page.getByText(/created|success|สำเร็จ/i).first()).toBeVisible({ timeout: 10_000 });

      // The create form does not navigate to the record on save, and it carries no
      // Edit/Delete affordance — open the record from the list before exercising
      // the delete dialog.
      await h.list.goto();
      await h.list.search(name);
      await h.clickRowName(name);
      await h.editButton().click();
      await h.deleteButton().click();
      const dialog = page.getByRole("alertdialog");
      await expect(dialog).toBeVisible({ timeout: 5_000 });
      await dialog.getByRole("button", { name: /^(Cancel|ยกเลิก)$/i }).click();
      await expect(dialog).toBeHidden({ timeout: 5_000 });

      await h.list.goto();
      await h.list.search(name);
      await expect(page.getByRole("cell", { name })).toBeVisible();

      // cleanup (actually delete)
      await h.clickRowName(name);
      await h.editButton().click();
      await h.deleteButton().click();
      await h.deleteConfirmButton().click();
      await expect(page.getByText(/deleted|success|สำเร็จ/i).first()).toBeVisible({ timeout: 10_000 });
    },
  );

  test(
    "TC-DEP-040004 ย้ายสมาชิกออก/กลับเข้า department members แล้วบันทึกคงอยู่",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; BU GR2VYNKQ; department แรกในรายการ (data:reset) มีสมาชิกครบทุก user" },
        { type: "steps", description: "1. เปิด department แรกจาก list แล้วกด Edit\n2. ย้ายสมาชิกคนแรกจาก Department Members กลับไป Available Users\n3. Save แล้ว reload เปิด Edit ดูว่ามี user ใน Available\n4. ย้าย user กลับเข้า Department Members แล้ว Save (คืนค่าเดิม)" },
        { type: "expected", description: "การย้ายสมาชิกถูกบันทึกจริง (user ปรากฏใน Available หลัง reload) และย้ายกลับแล้ว Available กลับเป็นว่างเหมือนเดิม" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const h = new PageFormCrudHelper(page, opts);
      const members = new DepartmentMembersHelper(page);
      // data:reset maps every user into a department, so the "available" list is empty on a new
      // department. Exercise the transfer on a seeded department instead: move a member out,
      // save, check it persisted, then move the same member back (restores the dataset).
      await h.list.goto();
      await page.locator("tbody tr").first().getByRole("button").first().click();
      await page.waitForLoadState("networkidle");
      await h.editButton().click();
      expect(await members.availableUsers("Department Members"), "dataset: available list is expected to start empty").toBe(0);
      const moved = await members.unassignFirstAssigned("Department Members");
      expect(moved, "seeded department should have at least one member").not.toBeNull();
      await h.saveButton().click();
      await expect(page.getByText(/updated|success|สำเร็จ/i).first()).toBeVisible({ timeout: 10_000 });
      await page.reload();
      await page.waitForLoadState("networkidle");
      await h.editButton().click();
      expect(await members.availableUsers("Department Members"), "the removed member is now available").toBe(1);

      // restore: assign the freed user again
      const back = await members.assignFirstAvailable("Department Members");
      expect(back).not.toBeNull();
      await h.saveButton().click();
      await expect(page.getByText(/updated|success|สำเร็จ/i).first()).toBeVisible({ timeout: 10_000 });
      await page.reload();
      await page.waitForLoadState("networkidle");
      await h.editButton().click();
      expect(await members.availableUsers("Department Members")).toBe(0);
    },
  );

  test(
    "TC-DEP-040005 assign user เป็น Head of Department",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; BU GR2VYNKQ; department แรกในรายการ (data:reset) มีสมาชิกครบทุก user" },
        { type: "steps", description: "1. เปิด department แรกจาก list แล้วกด Edit\n2. ใน section 'Head of Department' เลือก user ตัวแรกแล้วย้ายไปขวา\n3. Save\n4. reload เช็คว่า user ปรากฏใน HOD\n5. เปิด Edit ย้าย user กลับออกแล้ว Save (คืนค่าเดิม)" },
        { type: "expected", description: "user ที่ถูก assign แสดงใน section HOD หลัง reload และคืนค่าเดิมได้" },
        { type: "priority", description: "Low" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const h = new PageFormCrudHelper(page, opts);
      const members = new DepartmentMembersHelper(page);
      // A department's HOD candidates are its own members, so a new (member-less) department has
      // none. Use the seeded first department (data:reset puts every user in it): set an HOD, check
      // it persisted, then clear it again to restore the dataset.
      await h.list.goto();
      await page.locator("tbody tr").first().getByRole("button").first().click();
      await page.waitForLoadState("networkidle");
      await h.editButton().click();
      const hodBefore = await members.availableUsers("Head of Department");
      expect(hodBefore, "seeded department should offer members as HOD candidates — run `bun run data:reset`").toBeGreaterThan(0);

      const moved = await members.assignFirstAvailable("Head of Department");
      expect(moved).not.toBeNull();
      console.log("MOVED=", JSON.stringify(moved));
      await h.saveButton().click();
      await expect(page.getByText(/updated|success|สำเร็จ/i).first()).toBeVisible({ timeout: 10_000 });

      await page.reload();
      await page.waitForLoadState("networkidle");
      await expect(page.getByText(moved!.split("\n")[0].trim(), { exact: false }).first()).toBeVisible({ timeout: 10_000 });

      // restore: move the new HOD back out so the dataset keeps its original head
      await h.editButton().click();
      expect(await members.availableUsers("Head of Department")).toBe(hodBefore - 1);
      await members.unassignFirstAssigned("Head of Department");
      await h.saveButton().click();
      await expect(page.getByText(/updated|success|สำเร็จ/i).first()).toBeVisible({ timeout: 10_000 });
    },
  );
});
