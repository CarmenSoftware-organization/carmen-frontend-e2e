import { expect } from "@playwright/test";
import { createAuthTest } from "./fixtures/auth.fixture";
import { PageFormCrudHelper } from "./pages/page-form-crud.helper";
import { addPageFormSecurityCases } from "./helpers/security-cases";
import { BU_CODE } from "./test-users";
import { ensureActiveBu, getBusinessUnits, defaultBu } from "./helpers/bu";
import { BuSwitcherPage } from "./pages/bu-switcher.page";
import { uid, fakeCode, fakeName, buildEntity } from "./helpers/test-data";

const test = createAuthTest("carmensoftware.dev+admin@gmail.com");
const PATH = "/config/location";
const { code: CODE, name: NAME, nameUpdated: NAME_UPDATED } = buildEntity({ codePrefix: "E2E", tag: "LOC" });
const CODE_DIRECT = fakeCode("E2ED");
const NAME_DIRECT = fakeName({ tag: "LOC Direct" });
const CODE_CONSIGN = fakeCode("E2EC");
const NAME_CONSIGN = fakeName({ tag: "LOC Consign" });

const opts = {
  listPath: PATH,
  codeInputId: "location-code",
  nameInputId: "location-name",
  activeSwitchId: "location-is-active",
};

test.describe("Location — Smoke & CRUD", () => {
  test.beforeEach(async ({ page }) => {
    await ensureActiveBu(page, BU_CODE);
  });

  test(
    "TC-LOC-010005 active BU = BLAVG",
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

  const createLOC = async (h: PageFormCrudHelper, page: import("@playwright/test").Page, code: string, name: string, active = true) => {
    await h.gotoNew();
    await h.codeInput().fill(code);
    await h.nameInput().fill(name);
    const locationTypeGroup = page.getByRole("group").filter({ hasText: "Location Type" });
    await locationTypeGroup.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "Inventory" }).click();
    const physicalCountGroup = page.getByRole("group").filter({ hasText: "Physical Count" });
    await physicalCountGroup.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "Yes" }).click();
    await page.getByRole("button", { name: /Select Delivery Point/i }).click();
    await page.getByRole("dialog").locator("button[data-value]").first().click();
    if (!active) await h.setActive(false);
    await h.saveButton().click();
    await expect(page.getByText(/created|success|สำเร็จ/i).first()).toBeVisible({ timeout: 10_000 });
  };
  const deleteLOC = async (h: PageFormCrudHelper, page: import("@playwright/test").Page, name: string) => {
    await h.list.goto();
    await h.list.search(name);
    await h.clickRowName(name);
    await h.editButton().click();
    await h.deleteButton().click();
    await h.deleteConfirmButton().click();
    await expect(page.getByText(/deleted|success|สำเร็จ/i).first()).toBeVisible({ timeout: 10_000 });
  };

  test(
    "TC-LOC-010001 หน้า list โหลดสำเร็จ",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com ผ่าน auth fixture" },
        { type: "steps", description: "1. ไปที่ /config/location" },
        { type: "expected", description: "URL matches /config/location; หน้า list render สำเร็จโดยไม่มี error" },
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
    "TC-LOC-010002 ปุ่ม Add แสดง",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; on /config/location" },
        { type: "steps", description: "1. ไปที่ /config/location" },
        { type: "expected", description: "ปุ่ม Add visible บนหน้า list" },
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
    "TC-LOC-010003 ช่องค้นหาใช้งานได้",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; on /config/location" },
        { type: "steps", description: "1. ไปที่ /config/location\n2. พิมพ์ 'test' ในช่องค้นหา" },
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
    "TC-LOC-010004 ค้นหาคำที่ไม่มีต้องแสดง empty state",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; on /config/location" },
        { type: "steps", description: "1. ไปที่ /config/location\n2. ค้นหาด้วยคำที่ไม่มี (`__NOPE__<UID>`)" },
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
    "TC-LOC-200001 บันทึกโดยไม่กรอก code/name ต้องแสดง error",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; on /config/location/new" },
        { type: "steps", description: "1. เปิดฟอร์ม new\n2. กด Save โดยไม่กรอก code/name" },
        { type: "expected", description: "URL ยังคงอยู่ที่ /new (ฟอร์ม block submit ด้วย client-side validation)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Validation" },
      ],
    },
    async ({ page }) => {
    const h = new PageFormCrudHelper(page, opts);
    await h.gotoNew();
    await h.saveButton().click();
    await expect(page).toHaveURL(/\/new/);
  });

  test(
    "TC-LOC-030001 สร้างรายการใหม่และปรากฏในตาราง",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; record CODE/NAME ยังไม่มีอยู่ใน DB" },
        { type: "steps", description: "1. เปิด new form\n2. กรอก code + name\n3. เลือก Location Type = Inventory\n4. เลือก Physical Count = Yes\n5. เปิด dialog Select Delivery Point และเลือกตัวเลือกแรก\n6. กด Save\n7. กลับ list และค้นหาด้วย NAME" },
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
    const locationTypeGroup = page.getByRole("group").filter({ hasText: "Location Type" });
    await locationTypeGroup.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "Inventory" }).click();
    await expect(locationTypeGroup).toContainText("Inventory");
    const physicalCountGroup = page.getByRole("group").filter({ hasText: "Physical Count" });
    await physicalCountGroup.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "Yes" }).click();
    await expect(physicalCountGroup).toContainText("Yes");
    await page.getByRole("button", { name: /Select Delivery Point/i }).click();
    await page.getByRole("dialog").locator("button[data-value]").first().click();
    await h.saveButton().click();
    await expect(page.getByText(/created|success|สำเร็จ/i).first()).toBeVisible({
      timeout: 10_000,
    });
    await h.list.goto();
    await h.list.search(NAME);
    await expect(page.getByRole("cell", { name: NAME })).toBeVisible();
  });

  test(
    "TC-LOC-040001 แก้ไขชื่อและบันทึก",
    {
      annotation: [
        { type: "preconditions", description: "TC-LOC-030001 ผ่านแล้ว → record CODE/NAME มีอยู่ใน DB" },
        { type: "steps", description: "1. ค้นหา NAME ใน list\n2. คลิกแถวเพื่อเปิด detail\n3. กด Edit\n4. clear name แล้วใส่ NAME_UPDATED\n5. กด Save" },
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
    "TC-LOC-200002 แก้ไข: clear code/name แล้วบันทึก ต้องแสดง error",
    {
      annotation: [
        { type: "preconditions", description: "TC-LOC-040001 ผ่านแล้ว → record มี name = NAME_UPDATED" },
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
    await expect(h.saveButton()).toBeVisible();
  });

  test(
    "TC-LOC-050001 ลบรายการ",
    {
      annotation: [
        { type: "preconditions", description: "TC-LOC-200002 ผ่านแล้ว → record NAME_UPDATED ยังคงมีอยู่ใน DB" },
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

  test(
    "TC-LOC-030002 สร้าง location_type = Direct และลบ",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; record CODE_DIRECT/NAME_DIRECT ยังไม่มีอยู่ใน DB" },
        { type: "steps", description: "1. เปิด new form\n2. กรอก code_direct + name_direct\n3. เลือก Location Type = Direct\n4. เลือก Physical Count = Yes\n5. เลือก Delivery Point\n6. กด Save\n7. กลับ list ค้นหา NAME_DIRECT\n8. เปิด detail → Edit → Delete → ยืนยัน" },
        { type: "expected", description: "Created toast → แถวปรากฏใน list → Deleted toast หลังลบ (วงจร CRUD ครบสำหรับ type Direct)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
    const h = new PageFormCrudHelper(page, opts);
    await h.gotoNew();
    await h.codeInput().fill(CODE_DIRECT);
    await h.nameInput().fill(NAME_DIRECT);
    const locationTypeGroup = page.getByRole("group").filter({ hasText: "Location Type" });
    await locationTypeGroup.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "Direct" }).click();
    await expect(locationTypeGroup).toContainText("Direct");
    const physicalCountGroup = page.getByRole("group").filter({ hasText: "Physical Count" });
    await physicalCountGroup.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "Yes" }).click();
    await expect(physicalCountGroup).toContainText("Yes");
    await page.getByRole("button", { name: /Select Delivery Point/i }).click();
    await page.getByRole("dialog").locator("button[data-value]").first().click();
    await h.saveButton().click();
    await expect(page.getByText(/created|success|สำเร็จ/i).first()).toBeVisible({
      timeout: 10_000,
    });
    await h.list.goto();
    await h.list.search(NAME_DIRECT);
    await expect(page.getByRole("cell", { name: NAME_DIRECT })).toBeVisible();
    await h.clickRowName(NAME_DIRECT);
    await h.editButton().click();
    await h.deleteButton().click();
    await h.deleteConfirmButton().click();
    await expect(page.getByText(/deleted|success|สำเร็จ/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test(
    "TC-LOC-030003 สร้าง location_type = Consignment และลบ",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; record CODE_CONSIGN/NAME_CONSIGN ยังไม่มีอยู่ใน DB" },
        { type: "steps", description: "1. เปิด new form\n2. กรอก code_consign + name_consign\n3. เลือก Location Type = Consignment\n4. เลือก Physical Count = Yes\n5. เลือก Delivery Point\n6. กด Save\n7. กลับ list ค้นหา NAME_CONSIGN\n8. เปิด detail → Edit → Delete → ยืนยัน" },
        { type: "expected", description: "Created toast → แถวปรากฏใน list → Deleted toast หลังลบ (วงจร CRUD ครบสำหรับ type Consignment)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
    const h = new PageFormCrudHelper(page, opts);
    await h.gotoNew();
    await h.codeInput().fill(CODE_CONSIGN);
    await h.nameInput().fill(NAME_CONSIGN);
    const locationTypeGroup = page.getByRole("group").filter({ hasText: "Location Type" });
    await locationTypeGroup.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "Consignment" }).click();
    await expect(locationTypeGroup).toContainText("Consignment");
    const physicalCountGroup = page.getByRole("group").filter({ hasText: "Physical Count" });
    await physicalCountGroup.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "Yes" }).click();
    await expect(physicalCountGroup).toContainText("Yes");
    await page.getByRole("button", { name: /Select Delivery Point/i }).click();
    await page.getByRole("dialog").locator("button[data-value]").first().click();
    await h.saveButton().click();
    await expect(page.getByText(/created|success|สำเร็จ/i).first()).toBeVisible({
      timeout: 10_000,
    });
    await h.list.goto();
    await h.list.search(NAME_CONSIGN);
    await expect(page.getByRole("cell", { name: NAME_CONSIGN })).toBeVisible();
    await h.clickRowName(NAME_CONSIGN);
    await h.editButton().click();
    await h.deleteButton().click();
    await h.deleteConfirmButton().click();
    await expect(page.getByText(/deleted|success|สำเร็จ/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test(
    "TC-LOC-040002 toggle is_active แล้ว persist",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG; มี delivery point อย่างน้อย 1 รายการใน BLAVG" },
        { type: "steps", description: "1. สร้าง location ผ่าน new form โดยปิด switch is_active\n2. กลับ list ค้นหา name แล้วเปิด detail\n3. อ่านสถานะ switch is_active\n4. ลบ record (cleanup)" },
        { type: "expected", description: "หลังเปิด detail ใหม่ switch is_active มี aria-checked = false (ค่าถูก persist)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const h = new PageFormCrudHelper(page, opts);
      const c2 = fakeCode("E2EB");
      const name = fakeName({ tag: "LOC042" });
      await createLOC(h, page, c2, name, false);

      await h.list.goto();
      await h.list.search(name);
      await h.clickRowName(name);
      // Detail opens in view mode: the status shows as a badge, not the switch.
      await expect(page.getByText("Inactive", { exact: true }).first()).toBeVisible({ timeout: 5_000 });

      await deleteLOC(h, page, name);
    },
  );

  test(
    "TC-LOC-040003 แก้ไขชื่อแล้ว persist",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG; มี delivery point อย่างน้อย 1 รายการใน BLAVG" },
        { type: "steps", description: "1. สร้าง location ผ่าน new form\n2. เปิด detail จาก list กด Edit แก้ name แล้ว Save\n3. กลับ list ค้นหา name ใหม่ เปิด detail ยืนยันค่า\n4. ลบ record (cleanup)" },
        { type: "expected", description: "Updated/success toast; หลังเปิด detail ใหม่ nameInput มีค่าเป็น name ที่แก้ไข (ค่าถูก persist จริง)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const h = new PageFormCrudHelper(page, opts);
      const c3 = fakeCode("E2EH");
      const name3 = fakeName({ tag: "LOC043" });
      const renamed3 = fakeName({ tag: "LOC043 Upd" });
      await createLOC(h, page, c3, name3);

      await h.list.goto();
      await h.list.search(name3);
      await h.clickRowName(name3);
      // detail page opens in VIEW mode (name rendered as text, not input) → click Edit first
      await h.editButton().click();
      await expect(h.nameInput()).toBeEnabled({ timeout: 5_000 });
      await expect(h.nameInput()).toHaveValue(name3, { timeout: 10_000 });
      await h.nameInput().fill(renamed3);
      await h.saveButton().click();
      await expect(page.getByText(/updated|success|สำเร็จ/i).first()).toBeVisible({ timeout: 10_000 });

      await h.list.goto();
      await h.list.search(renamed3);
      await h.clickRowName(renamed3);
      // verify persist via view-mode heading + Edit-mode input value
      await expect(page.getByRole("heading", { name: renamed3 })).toBeVisible({ timeout: 10_000 });
      await h.editButton().click();
      await expect(h.nameInput()).toHaveValue(renamed3, { timeout: 10_000 });

      await deleteLOC(h, page, renamed3);
    },
  );

  test(
    "TC-LOC-040004 ยกเลิกการแก้ไข ค่าต้องไม่ถูกบันทึก",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG; มี delivery point อย่างน้อย 1 รายการใน BLAVG" },
        { type: "steps", description: "1. สร้าง location ผ่าน new form\n2. เปิด detail กด Edit แก้ name เป็นค่าใหม่\n3. กด Cancel\n4. เปิด detail เดิมอีกครั้งเช็ค name\n5. ลบ record (cleanup)" },
        { type: "expected", description: "หลัง Cancel แล้วเปิดใหม่ nameInput ยังเป็นค่าเดิม (การแก้ไขไม่ถูกบันทึก)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const h = new PageFormCrudHelper(page, opts);
      const c4 = fakeCode("E2EI");
      const name4 = fakeName({ tag: "LOC044" });
      await createLOC(h, page, c4, name4);

      await h.list.goto();
      await h.list.search(name4);
      await h.clickRowName(name4);
      await h.editButton().click();
      await expect(h.nameInput()).toBeEnabled({ timeout: 5_000 });
      await h.nameInput().fill(`${name4} DIRTY`);
      await h.cancelButton().click();

      await h.list.goto();
      await h.list.search(name4);
      await h.clickRowName(name4);
      // detail opens in VIEW mode → verify name via heading, then confirm via Edit-mode input
      await expect(page.getByRole("heading", { name: name4 })).toBeVisible({ timeout: 10_000 });
      await h.editButton().click();
      await expect(h.nameInput()).toHaveValue(name4, { timeout: 10_000 });

      await deleteLOC(h, page, name4);
    },
  );

  test(
    "TC-LOC-200003 สร้าง code ซ้ำ ต้องถูก reject",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG; มี delivery point อย่างน้อย 1 รายการใน BLAVG" },
        { type: "steps", description: "1. สร้าง location ด้วย code X\n2. เปิด new form อีกครั้งกรอก code X เดิม (name ต่าง) กด Save" },
        { type: "expected", description: "รายการที่สองไม่ถูกสร้าง: URL ยังคงอยู่ที่ /new (backend reject code ซ้ำ)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const h = new PageFormCrudHelper(page, opts);
      const cdup = fakeCode("E2EF");
      const name = fakeName({ tag: "LOC200" });
      await createLOC(h, page, cdup, name);

      // attempt duplicate code with a different name; do NOT assert success toast
      await h.gotoNew();
      await h.codeInput().fill(cdup);
      await h.nameInput().fill(fakeName({ tag: "LOC200b" }));
      const locationTypeGroup = page.getByRole("group").filter({ hasText: "Location Type" });
      await locationTypeGroup.getByRole("combobox").first().click();
      await page.getByRole("option", { name: "Inventory" }).click();
      const physicalCountGroup = page.getByRole("group").filter({ hasText: "Physical Count" });
      await physicalCountGroup.getByRole("combobox").first().click();
      await page.getByRole("option", { name: "Yes" }).click();
      await page.getByRole("button", { name: /Select Delivery Point/i }).click();
      await page.getByRole("dialog").locator("button[data-value]").first().click();
      await h.saveButton().click();
      await expect(page).toHaveURL(/\/new/, { timeout: 10_000 });

      await deleteLOC(h, page, name);
    },
  );

  test(
    "TC-LOC-050002 ยกเลิกการลบ record ต้องยังอยู่",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG; มี delivery point อย่างน้อย 1 รายการใน BLAVG" },
        { type: "steps", description: "1. สร้าง location ผ่าน new form\n2. เปิด detail กด Edit กด Delete\n3. ใน confirm dialog กด Cancel\n4. กลับ list ค้นหายืนยัน record ยังอยู่\n5. ลบ record (cleanup)" },
        { type: "expected", description: "Confirm dialog ปิดโดยไม่ลบ; record ยังปรากฏใน list" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const h = new PageFormCrudHelper(page, opts);
      const c5 = fakeCode("E2EG");
      const name5 = fakeName({ tag: "LOC050" });
      await createLOC(h, page, c5, name5);

      await h.list.goto();
      await h.list.search(name5);
      await h.clickRowName(name5);
      await h.editButton().click();
      await h.deleteButton().click();
      const dlg = page.getByRole("alertdialog");
      await expect(dlg).toBeVisible({ timeout: 5_000 });
      await dlg.getByRole("button", { name: /^(Cancel|ยกเลิก)$/i }).click();
      await expect(dlg).toBeHidden({ timeout: 5_000 });

      await h.list.goto();
      await h.list.search(name5);
      await expect(page.getByRole("cell", { name: name5 })).toBeVisible({ timeout: 10_000 });

      await deleteLOC(h, page, name5);
    },
  );

  addPageFormSecurityCases(test, {
    prefix: "LOC",
    listPath: PATH,
    makeHelper: (page) => new PageFormCrudHelper(page, opts),
    skipAuth: true,
  });
});
