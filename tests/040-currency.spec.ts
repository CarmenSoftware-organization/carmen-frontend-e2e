import { expect } from "@playwright/test";
import { createAuthTest } from "./fixtures/auth.fixture";
import { DialogCrudHelper } from "./pages/dialog-crud.helper";
import { addDialogSecurityCases } from "./helpers/security-cases";
import { BU_CODE } from "./test-users";
import { ensureActiveBu, getBusinessUnits, defaultBu } from "./helpers/bu";
import { BuSwitcherPage } from "./pages/bu-switcher.page";
import { uid, fakeName } from "./helpers/test-data";

const test = createAuthTest("carmensoftware.dev+admin@gmail.com");
const PATH = "/config/currency";
const NAME = fakeName({ tag: "CUR" });
const NAME_UPDATED = fakeName({ tag: "CUR Upd" });

const opts = {
  listPath: PATH,
  nameInputId: "currency-name",
  activeSwitchId: "currency-is-active",
};

/**
 * Give the required exchange rate a positive value.
 *
 * Picking an ISO code fills the symbol but leaves the rate at 0, and the schema
 * requires a positive number (currency-form-schema.ts:13-15) — the app has no
 * sensible default for a rate on purpose. Leaving it at 0 makes Save a no-op:
 * zod blocks it, no request goes out, and the create toast never arrives.
 */
const fillExchangeRate = async (page: import("@playwright/test").Page, rate = "1.5") => {
  const input = page.locator("#currency-exchange-rate");
  if ((await input.count()) === 0) return;
  if (await input.isDisabled().catch(() => false)) return;
  await input.fill(rate);
};

test.describe("Currency — Smoke & CRUD", () => {
  test.beforeEach(async ({ page }) => {
    await ensureActiveBu(page, BU_CODE);
  });

  test(
    "TC-CUR-010005 active BU = BLAVG",
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
    "TC-CUR-010001 หน้า list โหลดสำเร็จ",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com ผ่าน auth fixture" },
        { type: "steps", description: "1. ไปที่ /config/currency" },
        { type: "expected", description: "URL matches /config/currency; ปุ่ม Add และช่องค้นหา visible ภายใน 10s" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page }) => {
    const h = new DialogCrudHelper(page, opts);
    await h.list.goto();
    await expect(page).toHaveURL(new RegExp(PATH));
    await expect(h.list.addButton()).toBeVisible({ timeout: 10_000 });
    await expect(h.list.searchInput()).toBeVisible();
  });

  test(
    "TC-CUR-010002 ปุ่ม Add แสดง",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; อยู่ที่ /config/currency" },
        { type: "steps", description: "1. ไปที่ /config/currency" },
        { type: "expected", description: "ปุ่ม Add visible บนหน้า list" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page }) => {
    const h = new DialogCrudHelper(page, opts);
    await h.list.goto();
    await expect(h.list.addButton()).toBeVisible();
  });

  test(
    "TC-CUR-010003 ช่องค้นหาใช้งานได้",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; อยู่ที่ /config/currency" },
        { type: "steps", description: "1. ไปที่ /config/currency\n2. พิมพ์ 'test' ในช่องค้นหา" },
        { type: "expected", description: "ช่องค้นหา visible และรับค่า input ได้โดยไม่ error" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page }) => {
    const h = new DialogCrudHelper(page, opts);
    await h.list.goto();
    await expect(h.list.searchInput()).toBeVisible();
    await h.list.search("test");
  });

  test(
    "TC-CUR-010004 ค้นหาคำที่ไม่มีต้องแสดง empty state",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; อยู่ที่ /config/currency" },
        { type: "steps", description: "1. ไปที่ /config/currency\n2. ค้นหาด้วยคำที่ไม่มี (`__NOPE__<UID>`)" },
        { type: "expected", description: "Empty-state placeholder ปรากฏภายใน 10s (ไม่มีแถวที่ตรงกับคำค้น)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
    const h = new DialogCrudHelper(page, opts);
    await h.list.goto();
    await h.list.search(`__NOPE__${uid}`);
    await expect(h.list.emptyState().first()).toBeVisible({ timeout: 10_000 });
  });

  test(
    "TC-CUR-200001 บันทึกโดยไม่กรอกชื่อต้องแสดง error",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; เปิด add dialog ของ /config/currency" },
        { type: "steps", description: "1. ไปที่ /config/currency\n2. เปิด add dialog\n3. กด Save โดยไม่กรอก name (และไม่เลือก ISO code)\n4. ปิด dialog ด้วย Cancel" },
        { type: "expected", description: "Error message ปรากฏใน dialog (form block submit ด้วย client-side validation)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Validation" },
      ],
    },
    async ({ page }) => {
    const h = new DialogCrudHelper(page, opts);
    await h.list.goto();
    await h.openAddDialog();
    await h.saveButton().click();
    await expect(h.errorMessage().first()).toBeVisible();
    await h.cancelButton().click();
  });

  test(
    "TC-CUR-030001 สร้างรายการใหม่และปรากฏในตาราง",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; record NAME ยังไม่มีอยู่ใน DB; ISO code IDR เลือกได้จาก lookup" },
        { type: "steps", description: "1. ไปที่ /config/currency\n2. เปิด add dialog\n3. คลิกปุ่ม LookupCurrencyIso แล้วค้นหา 'IDR'\n4. เลือกแถว IDR (จะ auto-fill symbol และ exchange_rate)\n5. กรอก name = NAME\n6. กด Save\n7. ค้นหา NAME ใน list" },
        { type: "expected", description: "Success toast (created/success/สำเร็จ); แถวใหม่ที่มี Name = NAME ปรากฏใน list ภายใน 10s" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
    const h = new DialogCrudHelper(page, opts);
    await h.list.goto();
    await h.openAddDialog();
    // Code is a LookupCurrencyIso (Popover + cmdk) — open it, search the ISO
    // code, and click the matching item. That fills the symbol but leaves the
    // exchange rate at 0, which the schema rejects — see fillExchangeRate.
    await h.dialog()
      .getByRole("button", { expanded: false })
      .first()
      .click();
    const search = page.getByPlaceholder(/Search/i).last();
    await search.click();
    await search.pressSequentially("IDR", { delay: 30 });
    // VirtualCommandList renders items as <button> with data-value containing
    // "<code> <name> <country>". Wait for the IDR row, then click it.
    const idrOption = page.locator('button[data-value^="IDR "]').first();
    await idrOption.waitFor({ state: "visible", timeout: 5_000 });
    await idrOption.click();
    await fillExchangeRate(page);
    await h.nameInput().fill(NAME);
    await h.saveButton().click();
    await expect(page.getByText(/created|success|สำเร็จ/i).first()).toBeVisible({
      timeout: 10_000,
    });
    await h.list.search(NAME);
    // CellAction is on the Code column (IDR), not Name — assert the Name cell
    await expect(
      page.getByRole("cell", { name: NAME, exact: true }).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test(
    "TC-CUR-040001 แก้ไขชื่อและบันทึก",
    {
      annotation: [
        { type: "preconditions", description: "TC-CUR-030001 ผ่านแล้ว → record NAME มีอยู่ใน DB" },
        { type: "steps", description: "1. ไปที่ /config/currency\n2. ค้นหา NAME\n3. คลิกแถวเพื่อเปิด edit dialog\n4. clear name แล้วกรอก NAME_UPDATED\n5. กด Save\n6. ค้นหา NAME_UPDATED" },
        { type: "expected", description: "Updated/success toast ปรากฏ; แถวที่มี Name = NAME_UPDATED ปรากฏใน list" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
    const h = new DialogCrudHelper(page, opts);
    await h.list.goto();
    await h.list.search(NAME);
    await h.clickRow(NAME);
    await h.nameInput().clear();
    await h.nameInput().fill(NAME_UPDATED);
    await h.saveButton().click();
    await expect(page.getByText(/updated|success|สำเร็จ/i).first()).toBeVisible({
      timeout: 10_000,
    });
    await h.list.search(NAME_UPDATED);
    await expect(page.getByRole("cell", { name: NAME_UPDATED })).toBeVisible();
  });

  test(
    "TC-CUR-200002 แก้ไข: clear name แล้วบันทึก ต้องแสดง error",
    {
      annotation: [
        { type: "preconditions", description: "TC-CUR-040001 ผ่านแล้ว → record มี name = NAME_UPDATED" },
        { type: "steps", description: "1. ไปที่ /config/currency\n2. ค้นหา NAME_UPDATED\n3. คลิกแถวเพื่อเปิด edit dialog\n4. clear name\n5. กด Save\n6. ปิด dialog ด้วย Cancel" },
        { type: "expected", description: "Error message ปรากฏใน dialog (form block submit ด้วย client-side validation)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Validation" },
      ],
    },
    async ({ page }) => {
    const h = new DialogCrudHelper(page, opts);
    await h.list.goto();
    await h.list.search(NAME_UPDATED);
    await h.clickRow(NAME_UPDATED);
    await h.nameInput().clear();
    await h.saveButton().click();
    await expect(h.errorMessage().first()).toBeVisible();
    await h.cancelButton().click();
  });

  test(
    "TC-CUR-050001 ลบรายการ",
    {
      annotation: [
        { type: "preconditions", description: "TC-CUR-200002 ผ่านแล้ว → record NAME_UPDATED ยังคงมีอยู่ใน DB" },
        { type: "steps", description: "1. ไปที่ /config/currency\n2. ค้นหา NAME_UPDATED\n3. กด delete บนแถว\n4. ยืนยัน Delete" },
        { type: "expected", description: "Deleted/success toast ปรากฏ (deleted/success/สำเร็จ)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
    const h = new DialogCrudHelper(page, opts);
    await h.list.goto();
    await h.list.search(NAME_UPDATED);
    await h.deleteRow(NAME_UPDATED);
    await h.deleteConfirmButton().click();
    await expect(page.getByText(/deleted|success|สำเร็จ/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  // Currency create needs an ISO code picked from the LookupCurrencyIso popover
  // (Popover + cmdk) before the name, plus a positive exchange rate — see
  // fillExchangeRate.
  const selectIso = async (h: DialogCrudHelper, page: import("@playwright/test").Page, code: string) => {
    await h.dialog()
      .getByRole("button", { expanded: false })
      .first()
      .click();
    const search = page.getByPlaceholder(/Search/i).last();
    await search.click();
    await search.pressSequentially(code, { delay: 30 });
    const option = page.locator(`button[data-value^="${code} "]`).first();
    await option.waitFor({ state: "visible", timeout: 5_000 });
    await option.click();
    await fillExchangeRate(page);
  };


  test(
    "TC-CUR-040002 toggle is_active แล้ว persist",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG" },
        { type: "steps", description: "1. เปิด Add dialog กรอก name ปิด switch is_active กด Save\n2. เปิดแถวอีกครั้งอ่านสถานะ switch\n3. ลบ record" },
        { type: "expected", description: "หลังเปิดแถวใหม่ switch is_active = false (ค่าถูก persist)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const h = new DialogCrudHelper(page, opts);
      const name = fakeName({ tag: "CUR042" });
      await h.list.goto();
      await h.openAddDialog();
      await selectIso(h, page, "AED");
      await h.nameInput().fill(name);
      await h.setActive(false);
      await h.saveButton().click();
      await expect(page.getByText(/created|success|สำเร็จ/i).first()).toBeVisible({ timeout: 10_000 });

      await h.list.search(name);
      await h.clickRow(name);
      await expect(h.activeSwitch()!).toHaveAttribute("aria-checked", "false", { timeout: 5_000 });
      await h.cancelButton().click();

      await h.list.goto();
      await h.list.search(name);
      await h.deleteRow(name);
      await h.deleteConfirmButton().click();
      await expect(page.getByText(/deleted|success|สำเร็จ/i).first()).toBeVisible({ timeout: 10_000 });
    },
  );

  test(
    "TC-CUR-040003 แก้ไขชื่อแล้ว persist",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG" },
        { type: "steps", description: "1. สร้าง record\n2. เปิดแถวจาก list แก้ name แล้ว Save\n3. ยืนยัน list มี name ใหม่ ไม่พบ name เดิม\n4. ลบ record" },
        { type: "expected", description: "Updated; list มีแถว name ใหม่ และไม่พบ name เดิม (ค่าถูก persist จริง)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const h = new DialogCrudHelper(page, opts);
      const name = fakeName({ tag: "CUR043" });
      const renamed = fakeName({ tag: "CUR043 Upd" });
      await h.list.goto();
      await h.openAddDialog();
      await selectIso(h, page, "BHD");
      await h.nameInput().fill(name);
      await h.saveButton().click();
      await expect(page.getByText(/created|success|สำเร็จ/i).first()).toBeVisible({ timeout: 10_000 });

      await h.list.search(name);
      await h.clickRow(name);
      await expect(h.nameInput()).toBeEnabled({ timeout: 5_000 });
      await h.nameInput().fill(renamed);
      await h.saveButton().click();
      await expect(h.dialog()).toBeHidden({ timeout: 10_000 });

      await h.list.goto();
      await h.list.search(renamed);
      await expect(page.getByRole("cell", { name: renamed })).toBeVisible({ timeout: 10_000 });

      await h.deleteRow(renamed);
      await h.deleteConfirmButton().click();
      await expect(page.getByText(/deleted|success|สำเร็จ/i).first()).toBeVisible({ timeout: 10_000 });
    },
  );

  test(
    "TC-CUR-040004 ยกเลิกการแก้ไข ค่าต้องไม่ถูกบันทึก",
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
      const h = new DialogCrudHelper(page, opts);
      const name = fakeName({ tag: "CUR044" });
      await h.list.goto();
      await h.openAddDialog();
      await selectIso(h, page, "SGD");
      await h.nameInput().fill(name);
      await h.saveButton().click();
      await expect(page.getByText(/created|success|สำเร็จ/i).first()).toBeVisible({ timeout: 10_000 });

      await h.list.search(name);
      await h.clickRow(name);
      await expect(h.nameInput()).toBeEnabled({ timeout: 5_000 });
      await h.nameInput().fill(`${name} DIRTY`);
      await h.cancelButton().click();
      await expect(h.dialog()).toBeHidden({ timeout: 5_000 });

      await h.list.goto();
      await h.list.search(name);
      await h.clickRow(name);
      await expect(h.nameInput()).toHaveValue(name, { timeout: 5_000 });
      await h.cancelButton().click();

      await h.list.goto();
      await h.list.search(name);
      await h.deleteRow(name);
      await h.deleteConfirmButton().click();
      await expect(page.getByText(/deleted|success|สำเร็จ/i).first()).toBeVisible({ timeout: 10_000 });
    },
  );

  test(
    "TC-CUR-200003 สร้าง name ซ้ำ ต้องถูก reject",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG" },
        { type: "steps", description: "1. สร้าง record ด้วย name X\n2. เปิด Add dialog กรอก name X เดิม กด Save" },
        { type: "expected", description: "รายการที่สองไม่ถูกสร้าง: dialog (ช่อง name) ยังเปิดอยู่ (backend reject name ซ้ำ)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const h = new DialogCrudHelper(page, opts);
      const name = fakeName({ tag: "CUR200" });
      await h.list.goto();
      await h.openAddDialog();
      await selectIso(h, page, "OMR");
      await h.nameInput().fill(name);
      await h.saveButton().click();
      await expect(page.getByText(/created|success|สำเร็จ/i).first()).toBeVisible({ timeout: 10_000 });
      await expect(h.nameInput()).toBeHidden({ timeout: 10_000 });

      await h.list.goto();
      await h.openAddDialog();
      await selectIso(h, page, "QAR");
      await h.nameInput().fill(name);
      const answered = page.waitForResponse((r) => r.request().method() === "POST" && /currenc/i.test(r.url()), { timeout: 10_000 });
      await h.saveButton().click();
      const response = await answered; // the write is sent (normal step); its answer is the bug site
      test.fail(true, "suspected bug: backend accepts a second currency with the same name (POST answers 2xx, dialog closes, record is created) — cf. dept TC-DEP-010011");
      expect(response.ok(), `duplicate name should be rejected, POST → ${response.status()}`).toBe(false);
      await expect(h.nameInput()).toBeVisible({ timeout: 5_000 });
      await h.cancelButton().click();
    },
  );

  test(
    "TC-CUR-050002 ยกเลิกการลบ record ต้องยังอยู่",
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
      const h = new DialogCrudHelper(page, opts);
      const name = fakeName({ tag: "CUR050" });
      await h.list.goto();
      await h.openAddDialog();
      await selectIso(h, page, "KWD");
      await h.nameInput().fill(name);
      await h.saveButton().click();
      await expect(page.getByText(/created|success|สำเร็จ/i).first()).toBeVisible({ timeout: 10_000 });

      await h.list.goto();
      await h.list.search(name);
      await h.deleteRow(name);
      const dialog = page.getByRole("alertdialog");
      await expect(dialog).toBeVisible({ timeout: 5_000 });
      await dialog.getByRole("button", { name: /^(Cancel|ยกเลิก)$/i }).click();
      await expect(dialog).toBeHidden({ timeout: 5_000 });

      await h.list.goto();
      await h.list.search(name);
      await expect(page.getByRole("cell", { name })).toBeVisible();

      await h.deleteRow(name);
      await h.deleteConfirmButton().click();
      await expect(page.getByText(/deleted|success|สำเร็จ/i).first()).toBeVisible({ timeout: 10_000 });
    },
  );

  addDialogSecurityCases(test, {
    prefix: "CUR",
    listPath: PATH,
    makeHelper: (page) => new DialogCrudHelper(page, opts),
    skipAuth: true, // TCS-CUR00112 skipped
  });
});
