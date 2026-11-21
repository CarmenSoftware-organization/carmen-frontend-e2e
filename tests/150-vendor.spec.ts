import { expect } from "@playwright/test";
import { createAuthTest } from "./fixtures/auth.fixture";
import { VendorPage } from "./pages/vendor.page";
import { BU_CODE } from "./test-users";
import { ensureActiveBu, getBusinessUnits, defaultBu } from "./helpers/bu";
import { BuSwitcherPage } from "./pages/bu-switcher.page";
import { uid, buildEntity } from "./helpers/test-data";

const test = createAuthTest("carmensoftware.dev+purchase@gmail.com");

const { code: CODE, name: NAME, nameUpdated: NAME_UPDATED } = buildEntity({
  codePrefix: "V",
  tag: "VEN",
});

test.describe("Vendor — List smoke", () => {
  test(
    "TC-VEN-010001 หน้า list โหลดสำเร็จ",
    {
      annotation: [
        { type: "preconditions", description: "Logged in as carmensoftware.dev+purchase@gmail.com via createAuthTest fixture; ผู้ใช้มีสิทธิ์เข้าถึง vendor-management" },
        { type: "steps", description: "1. ไปที่ /vendor-management/vendor" },
        { type: "expected", description: "URL ตรงกับ /vendor-management/vendor และปุ่ม Add visible ภายใน 10s" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page }) => {
    const vendor = new VendorPage(page);
    await vendor.list.goto();
    await expect(page).toHaveURL(/vendor-management\/vendor/);
    await expect(vendor.list.addButton()).toBeVisible({ timeout: 10_000 });
  });

  test(
    "TC-VEN-010002 ปุ่ม Add แสดง",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+purchase@gmail.com; on /vendor-management/vendor" },
        { type: "steps", description: "1. ไปที่ /vendor-management/vendor" },
        { type: "expected", description: "ปุ่ม Add visible บนหน้า list" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page }) => {
    const vendor = new VendorPage(page);
    await vendor.list.goto();
    await expect(vendor.list.addButton()).toBeVisible();
  });

  test(
    "TC-VEN-010003 ช่องค้นหาใช้งานได้",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+purchase@gmail.com; on /vendor-management/vendor" },
        { type: "steps", description: "1. ไปที่ /vendor-management/vendor\n2. พิมพ์ 'test' ในช่องค้นหา" },
        { type: "expected", description: "ช่องค้นหา visible และรับค่า input ได้โดยไม่ error" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page }) => {
    const vendor = new VendorPage(page);
    await vendor.list.goto();
    await expect(vendor.list.searchInput()).toBeVisible();
    await vendor.list.search("test");
  });

  test(
    "TC-VEN-010004 ค้นหาคำที่ไม่มีต้องแสดง empty state",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+purchase@gmail.com; on /vendor-management/vendor" },
        { type: "steps", description: "1. ไปที่ /vendor-management/vendor\n2. ค้นหาด้วยคำที่ไม่มี (`__NOPE__<UID>`)" },
        { type: "expected", description: "Empty-state placeholder ปรากฏภายใน 10s (ไม่มีแถวที่ตรงกับคำค้น)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
    const vendor = new VendorPage(page);
    await vendor.list.goto();
    await vendor.list.search(`__NOPE__${uid}`);
    await expect(vendor.list.emptyState().first()).toBeVisible({ timeout: 10_000 });
  });

  test(
    "TC-VEN-010005 Filter status (active/inactive) ใช้งานได้",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+purchase@gmail.com; on /vendor-management/vendor" },
        { type: "steps", description: "1. ไปที่ /vendor-management/vendor\n2. คลิกปุ่ม Filter แล้วเปิดกลุ่ม Status\n3. ตรวจว่ามีตัวเลือก All / Active / Inactive\n4. เลือก Active แล้วปิดแผง" },
        { type: "expected", description: "มีตัวเลือก All / Active / Inactive; หลังเลือก Active ตารางเหลือเฉพาะ vendor ที่ไม่ใช่ Inactive และปุ่ม Add ยัง visible" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
    const vendor = new VendorPage(page);
    await vendor.list.goto();
    // ListFilter sheet (FE components/list-filter, ListToolbar): "Status" group with All / Active / Inactive.
    await vendor.filterButton().click();
    const sheet = page.locator("[role=dialog]:visible").last();
    await sheet.getByRole("button", { name: "Status" }).click();
    for (const label of ["All", "Active", "Inactive"]) {
      await expect(sheet.getByText(label, { exact: true }).first()).toBeVisible({ timeout: 5_000 });
    }
    await sheet.getByText("Active", { exact: true }).click();
    await page.keyboard.press("Escape");
    await page.waitForLoadState("networkidle");
    const rows = await vendor.list.tableRows().allInnerTexts();
    expect(rows.length, "filter by Active should leave at least one vendor").toBeGreaterThan(0);
    for (const row of rows) expect(row, "no Inactive vendor remains").not.toMatch(/\bInactive\b/);
    await expect(vendor.list.addButton()).toBeVisible();
  });
});

test.describe("Vendor — Create happy path", () => {
  test(
    "TC-VEN-030001 เปิดหน้า new form สำเร็จ",
    {
      annotation: [
        { type: "preconditions", description: "Logged in as carmensoftware.dev+purchase@gmail.com; ผู้ใช้มีสิทธิ์สร้าง vendor" },
        { type: "steps", description: "1. ไปที่ /vendor-management/vendor/new" },
        { type: "expected", description: "URL ตรงกับ /vendor-management/vendor/new; code input, name input และปุ่ม Save visible" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page }) => {
    const vendor = new VendorPage(page);
    await vendor.gotoNew();
    await expect(page).toHaveURL(/vendor-management\/vendor\/new/);
    await expect(vendor.codeInput()).toBeVisible({ timeout: 10_000 });
    await expect(vendor.nameInput()).toBeVisible();
    await expect(vendor.saveButton()).toBeVisible();
  });

  test(
    "TC-VEN-030002 เลือก business type จาก dropdown ได้",
    {
      annotation: [
        { type: "preconditions", description: "Logged in as carmensoftware.dev+purchase@gmail.com; on /vendor-management/vendor/new; backend มีข้อมูล business types อย่างน้อย 1 รายการ" },
        { type: "steps", description: "1. เปิด new form\n2. ตรวจว่ามี business type option อย่างน้อย 1 รายการ\n3. เปิด business type dropdown\n4. เลือก option แรก" },
        { type: "expected", description: "มี option ให้เลือก (count > 0) และ trigger ของ business type แสดง label ของรายการที่เลือกภายใน 5s" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
    const vendor = new VendorPage(page);
    await vendor.gotoNew();
    const count = await vendor.businessTypeOptionCount();
    expect(count).toBeGreaterThan(0);
    const label = await vendor.pickBusinessType();
    expect(label.length).toBeGreaterThan(0);
    // Verify the selected badge appears on the trigger
    await expect(vendor.businessTypeTrigger()).toContainText(label, { timeout: 5_000 });
  });

  test(
    "TC-VEN-030003 สร้าง vendor ขั้นต่ำ (code + name + business type) สำเร็จ",
    {
      annotation: [
        { type: "preconditions", description: "Logged in as carmensoftware.dev+purchase@gmail.com; vendor CODE/NAME ยังไม่มีใน DB" },
        { type: "steps", description: "1. เปิด new form\n2. กรอก code + name ใน tab General\n3. เลือก business type (ถ้ามี option)\n4. กด Save\n5. กลับ list และค้นหาด้วย NAME" },
        { type: "expected", description: "Save toast/feedback ปรากฏ และ vendor ใหม่ค้นเจอใน list ภายใน 10s" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({
    page,
  }) => {
    const vendor = new VendorPage(page);
    await vendor.gotoNew();
    await vendor.fillGeneral({ code: CODE, name: NAME });
    const btCount = await vendor.businessTypeOptionCount();
    if (btCount > 0) {
      await vendor.pickBusinessType();
    }
    await vendor.saveButton().click();
    await vendor.expectSaved();

    // Verify it appears in the list
    await vendor.list.goto();
    await vendor.list.search(NAME);
    await expect(page.getByText(NAME).first()).toBeVisible({ timeout: 10_000 });
  });

  test(
    "TC-VEN-030004 สร้าง vendor พร้อม address 1 รายการ",
    {
      annotation: [
        { type: "preconditions", description: "Logged in as carmensoftware.dev+purchase@gmail.com; vendor CODE+'A' ยังไม่มีใน DB" },
        { type: "steps", description: "1. เปิด new form\n2. กรอก code + name\n3. เลือก business type (ถ้ามี)\n4. เพิ่ม address row 1 รายการ (mailing/international, line1, city, country)\n5. กด Save\n6. cleanup ลบ vendor (best-effort)" },
        { type: "expected", description: "Save toast/feedback ปรากฏ บ่งชี้ว่า vendor พร้อม address ถูกบันทึกสำเร็จ" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
    const vendor = new VendorPage(page);
    await vendor.gotoNew();
    const code = `${CODE}A`.slice(0, 10);
    const name = `${NAME} addr`;
    await vendor.fillGeneral({ code, name });
    if ((await vendor.businessTypeOptionCount()) > 0) await vendor.pickBusinessType();
    await vendor.addAddressRow();
    await vendor.fillAddress(0, {
      address_type: "mailing_address",
      mode: "international",
      address_line1: "123 Test Ave",
      city: "Testville",
      country: "USA",
    });
    await vendor.saveButton().click();
    await vendor.expectSaved();

    // Cleanup: delete this transient vendor so it doesn't pollute later tests.
    // Best-effort — if the row-actions dropdown or confirm dialog isn't matched,
    // swallow the error so the test still passes on the save assertion above.
    try {
      await vendor.gotoList();
      await vendor.list.search(name);
      const row = page.locator("tbody").getByRole("row").filter({ hasText: name }).first();
      await row.getByRole("button", { name: /row actions|actions|more/i }).first().click({ timeout: 5_000 });
      await page.getByRole("menuitem", { name: /delete|trash|ลบ/i }).first().click({ timeout: 5_000 });
      await page.getByRole("alertdialog").getByRole("button", { name: /confirm|delete|ลบ|ok/i }).first().click({ timeout: 5_000 });
    } catch {
      // Cleanup is best-effort; vendor may remain but test save succeeded.
    }
  });


// BLOCKED: ติ๊ก "Primary" บนการ์ด contact แล้วช่องไม่เปลี่ยนสถานะ — Playwright รายงาน
// "Clicking the checkbox did not change its state" (aria-checked ค้างที่ false)
// ต้นเหตุอยู่ที่ `vendor-contact.tsx:139` ซึ่งอ่านค่าด้วย `form.getValues(...)`
// (snapshot ที่ไม่ subscribe) การ์ดจึงไม่ re-render เมื่อ `handleSetPrimary` เรียก
// `form.setValue(...)` — ค่าใน form เปลี่ยนจริงแต่ UI ไม่ตาม ผู้ใช้จริงก็เจออาการ
// เดียวกัน ควรเปลี่ยนไปใช้ useWatch/Controller ตรวจกับแอป local 2026-09-18
  test(
    "TC-VEN-030005 สร้าง vendor พร้อม contact 1 รายการ (primary)",
    {
      annotation: [
        { type: "preconditions", description: "Logged in as carmensoftware.dev+purchase@gmail.com; vendor CODE+'C' ยังไม่มีใน DB" },
        { type: "steps", description: "1. เปิด new form\n2. กรอก code + name\n3. เลือก business type (ถ้ามี)\n4. เพิ่ม contact row 1 รายการ (name/email/phone/is_primary=true)\n5. กด Save\n6. กลับ list ค้นหาด้วย name" },
        { type: "expected", description: "Save toast/feedback ปรากฏ และ vendor ที่มี contact ค้นเจอใน list ภายใน 10s" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
    test.fail(true, "suspected bug: Primary checkbox on a vendor contact card does not re-render (vendor-contact.tsx:152 reads form.getValues, not useWatch)");
    const vendor = new VendorPage(page);
    await vendor.gotoNew();
    const code = `${CODE.slice(0, 9)}C`;
    const name = `${NAME} ctc`;
    await vendor.fillGeneral({ code, name });
    if ((await vendor.businessTypeOptionCount()) > 0) await vendor.pickBusinessType();
    await vendor.addContactRow();
    await vendor.fillContact(0, {
      name: "Primary Person",
      email: "primary@example.com",
      phone: "0123456789",
      is_primary: true,
    });
    await vendor.saveButton().click();
    await vendor.expectSaved();
    await vendor.gotoList();
    await vendor.list.search(name);
    await expect(page.getByText(name).first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Vendor — Tabs & dynamic arrays", () => {
  test(
    "TC-VEN-030007 เพิ่ม address row ได้หลาย row",
    {
      annotation: [
        { type: "preconditions", description: "Logged in as carmensoftware.dev+purchase@gmail.com; on /vendor-management/vendor/new ที่ tab address" },
        { type: "steps", description: "1. เปิด new form\n2. สลับไป tab address\n3. กดปุ่มเพิ่ม address 2 ครั้ง" },
        { type: "expected", description: "เริ่มจาก 0 row → เพิ่มได้เป็น 1 และ 2 row ตามลำดับ" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
    const vendor = new VendorPage(page);
    await vendor.gotoNew();
    await vendor.switchTab("address");
    expect(await vendor.addressCount()).toBe(0);
    await vendor.addAddressRow();
    expect(await vendor.addressCount()).toBe(1);
    await vendor.addAddressRow();
    expect(await vendor.addressCount()).toBe(2);
  });

  test(
    "TC-VEN-030008 ลบ address row ได้",
    {
      annotation: [
        { type: "preconditions", description: "Logged in as carmensoftware.dev+purchase@gmail.com; on /vendor-management/vendor/new ที่ tab address" },
        { type: "steps", description: "1. เปิด new form\n2. สลับไป tab address\n3. เพิ่ม 2 row\n4. ลบ row index 0" },
        { type: "expected", description: "หลังลบ จำนวน address row เหลือ 1" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
    const vendor = new VendorPage(page);
    await vendor.gotoNew();
    await vendor.switchTab("address");
    await vendor.addAddressRow();
    await vendor.addAddressRow();
    expect(await vendor.addressCount()).toBe(2);
    await vendor.removeAddressRow(0);
    expect(await vendor.addressCount()).toBe(1);
  });

  test(
    "TC-VEN-030009 เพิ่ม contact row ได้หลาย row",
    {
      annotation: [
        { type: "preconditions", description: "Logged in as carmensoftware.dev+purchase@gmail.com; on /vendor-management/vendor/new ที่ tab contact" },
        { type: "steps", description: "1. เปิด new form\n2. สลับไป tab contact\n3. กดปุ่มเพิ่ม contact 2 ครั้ง" },
        { type: "expected", description: "เริ่มจาก 0 row → เพิ่มได้เป็น 2 row" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
    const vendor = new VendorPage(page);
    await vendor.gotoNew();
    await vendor.switchTab("contact");
    expect(await vendor.contactCount()).toBe(0);
    await vendor.addContactRow();
    await vendor.addContactRow();
    expect(await vendor.contactCount()).toBe(2);
  });

  test(
    "TC-VEN-030010 ลบ contact row ได้",
    {
      annotation: [
        { type: "preconditions", description: "Logged in as carmensoftware.dev+purchase@gmail.com; on /vendor-management/vendor/new ที่ tab contact" },
        { type: "steps", description: "1. เปิด new form\n2. สลับไป tab contact\n3. เพิ่ม 2 row และกรอกชื่อ\n4. ลบ row index 0" },
        { type: "expected", description: "หลังลบ จำนวน contact row เหลือ 1" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
    const vendor = new VendorPage(page);
    await vendor.gotoNew();
    await vendor.switchTab("contact");
    await vendor.addContactRow();
    await vendor.addContactRow();
    await vendor.fillContact(0, { name: "Will Remove" });
    expect(await vendor.contactCount()).toBe(2);
    await vendor.removeContactRow(0);
    expect(await vendor.contactCount()).toBe(1);
  });


// BLOCKED: ติ๊ก "Primary" บนการ์ด contact แล้วช่องไม่เปลี่ยนสถานะ — Playwright รายงาน
// "Clicking the checkbox did not change its state" (aria-checked ค้างที่ false)
// ต้นเหตุอยู่ที่ `vendor-contact.tsx:139` ซึ่งอ่านค่าด้วย `form.getValues(...)`
// (snapshot ที่ไม่ subscribe) การ์ดจึงไม่ re-render เมื่อ `handleSetPrimary` เรียก
// `form.setValue(...)` — ค่าใน form เปลี่ยนจริงแต่ UI ไม่ตาม ผู้ใช้จริงก็เจออาการ
// เดียวกัน ควรเปลี่ยนไปใช้ useWatch/Controller ตรวจกับแอป local 2026-09-18
  test(
    "TC-VEN-030011 เปลี่ยน primary contact ได้ (radio exclusive)",
    {
      annotation: [
        { type: "preconditions", description: "Logged in as carmensoftware.dev+purchase@gmail.com; on /vendor-management/vendor/new ที่ tab contact" },
        { type: "steps", description: "1. เปิด new form\n2. สลับไป tab contact\n3. เพิ่ม 2 row และกรอกชื่อ A, B\n4. setPrimary index 0\n5. setPrimary index 1" },
        { type: "expected", description: "เมื่อเปลี่ยน primary เป็น index 1 แล้ว index 0 ต้อง not checked (radio-exclusive behavior)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
    test.fail(true, "suspected bug: Primary checkbox on a vendor contact card does not re-render (vendor-contact.tsx:152 reads form.getValues, not useWatch)");
    const vendor = new VendorPage(page);
    await vendor.gotoNew();
    await vendor.switchTab("contact");
    await vendor.addContactRow();
    await vendor.addContactRow();
    await vendor.fillContact(0, { name: "A" });
    await vendor.fillContact(1, { name: "B" });
    await vendor.setPrimaryContact(0);
    await expect(vendor.contactRow(0).getByRole("checkbox")).toBeChecked();
    await vendor.setPrimaryContact(1);
    await expect(vendor.contactRow(1).getByRole("checkbox")).toBeChecked();
    await expect(vendor.contactRow(0).getByRole("checkbox")).not.toBeChecked();
  });

  test(
    "TC-VEN-030012 เพิ่ม info row (label/value) ได้",
    {
      annotation: [
        { type: "preconditions", description: "Logged in as carmensoftware.dev+purchase@gmail.com; on /vendor-management/vendor/new ที่ tab info" },
        { type: "steps", description: "1. เปิด new form\n2. สลับไป tab info\n3. เพิ่ม info row 1 รายการ และกรอก label='Tax ID' / value='1234567890' / dataType='string'" },
        { type: "expected", description: "เริ่มจาก 0 row → หลังเพิ่มแล้วมี 1 row" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
    const vendor = new VendorPage(page);
    await vendor.gotoNew();
    await vendor.switchTab("info");
    expect(await vendor.infoCount()).toBe(0);
    await vendor.addInfoRow();
    await vendor.fillInfo(0, { label: "Tax ID", value: "1234567890", dataType: "string" });
    expect(await vendor.infoCount()).toBe(1);
  });

  test(
    "TC-VEN-030013 ลบ info row ได้",
    {
      annotation: [
        { type: "preconditions", description: "Logged in as carmensoftware.dev+purchase@gmail.com; on /vendor-management/vendor/new ที่ tab info" },
        { type: "steps", description: "1. เปิด new form\n2. สลับไป tab info\n3. เพิ่ม 2 row\n4. ลบ row index 0" },
        { type: "expected", description: "หลังลบ จำนวน info row เหลือ 1" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
    const vendor = new VendorPage(page);
    await vendor.gotoNew();
    await vendor.switchTab("info");
    await vendor.addInfoRow();
    await vendor.addInfoRow();
    expect(await vendor.infoCount()).toBe(2);
    await vendor.removeInfoRow(0);
    expect(await vendor.infoCount()).toBe(1);
  });
});

test.describe("Vendor — Validation", () => {
  test(
    "TC-VEN-200001 บันทึกโดยไม่กรอก code ต้องแสดง error",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+purchase@gmail.com; on /vendor-management/vendor/new" },
        { type: "steps", description: "1. เปิด new form ที่ tab general\n2. กรอกเฉพาะ name (เว้น code)\n3. กด Save" },
        { type: "expected", description: "Error indicator ปรากฏและ URL ยังคงอยู่ที่ /new (form block submit)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Validation" },
      ],
    },
    async ({ page }) => {
    const vendor = new VendorPage(page);
    await vendor.gotoNew();
    await vendor.switchTab("general");
    await vendor.nameInput().fill(`${NAME} v19`);
    await vendor.saveButton().click();
    // Redesigned form shows required-field errors via hover tooltips (no
    // aria-invalid / inline text), so assert the meaningful outcome: the missing
    // code blocks submit — still on /new, no success toast.
    await expect(page).toHaveURL(/\/new/, { timeout: 5_000 });
    await expect(
      page.locator('[data-sonner-toast], [role="status"]').filter({ hasText: /success|created|สำเร็จ/i }),
    ).toHaveCount(0, { timeout: 3_000 });
  });

  test(
    "TC-VEN-200002 บันทึกโดยไม่กรอก name ต้องแสดง error",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+purchase@gmail.com; on /vendor-management/vendor/new" },
        { type: "steps", description: "1. เปิด new form ที่ tab general\n2. กรอกเฉพาะ code (เว้น name)\n3. กด Save" },
        { type: "expected", description: "Error indicator ปรากฏและ URL ยังคงอยู่ที่ /new (form block submit)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Validation" },
      ],
    },
    async ({ page }) => {
    const vendor = new VendorPage(page);
    await vendor.gotoNew();
    await vendor.switchTab("general");
    await vendor.codeInput().fill(`V${uid.slice(0, 4)}`);
    await vendor.saveButton().click();
    // Missing name blocks submit (error shown via hover tooltip in the redesign).
    await expect(page).toHaveURL(/\/new/, { timeout: 5_000 });
    await expect(
      page.locator('[data-sonner-toast], [role="status"]').filter({ hasText: /success|created|สำเร็จ/i }),
    ).toHaveCount(0, { timeout: 3_000 });
  });

  test(
    "TC-VEN-200003 code เกิน 10 ตัวอักษรต้องถูก reject",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+purchase@gmail.com; on /vendor-management/vendor/new" },
        { type: "steps", description: "1. เปิด new form ที่ tab general\n2. พยายาม fill code 'X' ยาว 20 ตัวอักษร" },
        { type: "expected", description: "ค่าใน code input ต้องไม่เกิน 10 ตัวอักษร (input maxLength enforcement)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Validation" },
      ],
    },
    async ({ page }) => {
    const vendor = new VendorPage(page);
    await vendor.gotoNew();
    await vendor.switchTab("general");
    const long = "X".repeat(20);
    await vendor.codeInput().fill(long);
    const value = await vendor.codeInput().inputValue();
    expect(value.length).toBeLessThanOrEqual(10);
  });

  test(
    "TC-VEN-200004 name เกิน 100 ตัวอักษรต้องถูก reject",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+purchase@gmail.com; on /vendor-management/vendor/new" },
        { type: "steps", description: "1. เปิด new form\n2. กรอก code + business type ที่ถูกต้อง\n3. กรอก name ยาว 150 ตัวอักษร\n4. กด Save" },
        { type: "expected", description: "zod name.max(100) บล็อก submit — ยังอยู่ที่ /new และไม่มี success toast" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Validation" },
      ],
    },
    async ({ page }) => {
    const vendor = new VendorPage(page);
    await vendor.gotoNew();
    // The redesigned hero NameField does not client-cap length, so the 100-char
    // limit is enforced by zod on submit. Provide a valid code so the only
    // blocker is the over-long name.
    await vendor.codeInput().fill(`V${uid.slice(0, 4)}L`);
    if ((await vendor.businessTypeOptionCount()) > 0) await vendor.pickBusinessType();
    await vendor.nameInput().fill("N".repeat(150));
    await vendor.saveButton().click();
    await expect(page).toHaveURL(/\/new/, { timeout: 5_000 });
    await expect(
      page.locator('[data-sonner-toast], [role="status"]').filter({ hasText: /success|created|สำเร็จ/i }),
    ).toHaveCount(0, { timeout: 3_000 });
  });

  test(
    "TC-VEN-200006 contact email รูปแบบผิดต้องแสดง error",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+purchase@gmail.com; on /vendor-management/vendor/new" },
        { type: "steps", description: "1. เปิด new form\n2. กรอก code + name + business type\n3. เพิ่ม contact row และกรอก email = 'not-an-email'\n4. กด Save" },
        { type: "expected", description: "URL ยังคงอยู่ที่ /new (HTML5 native email validation block submit)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Validation" },
      ],
    },
    async ({ page }) => {
    const vendor = new VendorPage(page);
    await vendor.gotoNew();
    await vendor.fillGeneral({ code: `${CODE.slice(0, 9)}E`, name: `${NAME} v24` });
    if ((await vendor.businessTypeOptionCount()) > 0) await vendor.pickBusinessType();
    await vendor.addContactRow();
    await vendor.fillContact(0, { name: "Bad Email", email: "not-an-email" });
    await vendor.saveButton().click();
    // Note: contact email uses input[type="email"] → HTML5 native validation blocks
    // submit before React Hook Form's zod runs, so no aria-invalid / text-destructive
    // is painted. The best DOM signal remaining is that the form didn't navigate.
    await expect(page).toHaveURL(/\/new$/);
  });
});

test.describe("Vendor — Edit, delete, cleanup", () => {
  test(
    "TC-VEN-040001 แก้ name ของ vendor ที่สร้างแล้ว save สำเร็จ",
    {
      annotation: [
        { type: "preconditions", description: "TC-VEN-030003 ผ่านแล้ว → vendor ที่ NAME มีอยู่ใน DB; logged in as carmensoftware.dev+purchase@gmail.com" },
        { type: "steps", description: "1. ไปที่ list และเปิด detail ของ vendor ตาม NAME\n2. กด Edit\n3. สลับไป tab general\n4. แก้ name เป็น NAME_UPDATED\n5. กด Save\n6. กลับ list ค้นหาด้วย NAME_UPDATED" },
        { type: "expected", description: "Save toast/feedback ปรากฏ และ NAME_UPDATED ค้นเจอใน list ภายใน 10s" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
    const vendor = new VendorPage(page);
    await vendor.gotoList();
    await vendor.openDetailByName(NAME);
    await vendor.editButton().click();
    await vendor.switchTab("general");
    await vendor.nameInput().fill(NAME_UPDATED);
    await vendor.saveButton().click();
    await vendor.expectSaved();

    await vendor.gotoList();
    await vendor.list.search(NAME_UPDATED);
    await expect(page.getByText(NAME_UPDATED).first()).toBeVisible({ timeout: 10_000 });
  });

  test(
    "TC-VEN-050001 เปิด delete dialog ของ vendor แล้ว cancel — row ยังอยู่",
    {
      annotation: [
        { type: "preconditions", description: "TC-VEN-040001 ผ่านแล้ว → vendor ที่ NAME_UPDATED มีอยู่ใน DB" },
        { type: "steps", description: "1. ไปที่ list และค้นหาด้วย NAME_UPDATED\n2. เปิด row actions ของ row นั้น\n3. คลิก menuitem Delete\n4. ใน alertdialog กด Cancel" },
        { type: "expected", description: "Alertdialog ปิดและแถวของ NAME_UPDATED ยังคง visible (ไม่ถูกลบ)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
    const vendor = new VendorPage(page);
    await vendor.gotoList();
    await vendor.list.search(NAME_UPDATED);
    const row = page.locator("tbody").getByRole("row").filter({ hasText: NAME_UPDATED }).first();

    // Open row actions (dropdown)
    const actionsBtn = row.getByRole("button", { name: /row actions|actions|more/i }).first();
    await actionsBtn.click();
    await page.getByRole("menuitem", { name: /delete|ลบ/i }).first().click();

    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await dialog.getByRole("button", { name: /cancel|ยกเลิก/i }).click();
    await expect(dialog).not.toBeVisible({ timeout: 5_000 });

    // Row should still be there
    await expect(page.getByText(NAME_UPDATED).first()).toBeVisible();
  });

  test(
    "TC-VEN-050002 ลบ vendor ที่สร้างในชุด test สำเร็จ (cleanup หลัก)",
    {
      annotation: [
        { type: "preconditions", description: "TC-VEN-050001 ผ่านแล้ว → vendor ที่ NAME_UPDATED ยังคงอยู่ใน DB" },
        { type: "steps", description: "1. ไปที่ list และค้นหาด้วย NAME_UPDATED\n2. เปิด row actions\n3. คลิก menuitem Delete\n4. ใน alertdialog กดยืนยัน Delete/Confirm" },
        { type: "expected", description: "Success toast ('success/deleted/สำเร็จ') ปรากฏภายใน 10s" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
    const vendor = new VendorPage(page);
    await vendor.gotoList();
    await vendor.list.search(NAME_UPDATED);
    const row = page.locator("tbody").getByRole("row").filter({ hasText: NAME_UPDATED }).first();

    const actionsBtn = row.getByRole("button", { name: /row actions|actions|more/i }).first();
    await actionsBtn.click();
    await page.getByRole("menuitem", { name: /delete|ลบ/i }).first().click();

    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await dialog.getByRole("button", { name: /^(delete|confirm|ลบ|ok)$/i }).click();

    // Success toast
    await expect(
      page.locator('[data-sonner-toast], [role="status"]')
        .filter({ hasText: /success|deleted|ลบ.*สำเร็จ|สำเร็จ/i })
        .first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test(
    "TC-VEN-050003 หลังลบแล้วค้นหาไม่พบ row นั้นอีก",
    {
      annotation: [
        { type: "preconditions", description: "TC-VEN-050002 ผ่านแล้ว → vendor ที่ NAME_UPDATED ถูกลบจาก DB แล้ว" },
        { type: "steps", description: "1. ไปที่ list\n2. ค้นหาด้วย NAME_UPDATED" },
        { type: "expected", description: "Empty-state placeholder ปรากฏภายใน 10s (ยืนยันว่าลบได้สำเร็จจริง)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
    const vendor = new VendorPage(page);
    await vendor.gotoList();
    await vendor.list.search(NAME_UPDATED);
    await expect(vendor.list.emptyState().first()).toBeVisible({ timeout: 10_000 });
  });
});

// Mop-up: best-effort cleanup of any vendors this run created, matched by the
// run-scoped NAME prefix.
// Uses the same row-actions dropdown pattern as TC-VEN-050002. Silent on failure —
// the suite's actual assertions already ran; this is hygiene, not a check.
test.afterAll(async ({ browser }) => {
  const { authFile } = await import("./fixtures/auth.paths");
  const context = await browser.newContext({
    storageState: authFile("carmensoftware.dev+purchase@gmail.com"),
  });
  const page = await context.newPage();
  try {
    const vendor = new VendorPage(page);
    for (const suffix of ["addr", "ctc"]) {
      const name = `${NAME} ${suffix}`;
      try {
        await vendor.gotoList();
        await vendor.list.search(name);
        const row = page.locator("tbody").getByRole("row").filter({ hasText: name }).first();
        if ((await row.count()) === 0) continue;

        const actionsBtn = row
          .getByRole("button", { name: /row actions|actions|more/i })
          .first();
        await actionsBtn.click({ timeout: 3_000 });
        await page.getByRole("menuitem", { name: /delete|ลบ/i }).first().click({ timeout: 3_000 });
        await page
          .getByRole("alertdialog")
          .getByRole("button", { name: /^(delete|confirm|ลบ|ok)$/i })
          .click({ timeout: 3_000 });
        await page.waitForLoadState("networkidle").catch(() => null);
      } catch {
        // Ignore — best-effort only
      }
    }
  } finally {
    await context.close();
  }
});

// ── carmensoftware.dev+admin@gmail.com + BLAVG CRUD ─────────────────────────────────────
// The describes above run as carmensoftware.dev+purchase@gmail.com (authz coverage) and are
// left untouched. This block verifies an admin can CRUD vendors with the active
// BU pinned to BLAVG.
const adminTest = createAuthTest("carmensoftware.dev+admin@gmail.com");

adminTest.describe.serial("Vendor — admin@BLAVG CRUD", () => {
  const { code: ADMIN_CODE, name: ADMIN_NAME, nameUpdated: ADMIN_NAME_UPDATED } =
    buildEntity({ codePrefix: "VA", tag: "VA" });

  // The React vendor form is a single sectioned page (no Radix tabs), so the
  // tab-based VendorPage helpers (switchTab/fillGeneral) don't apply here.
  // These local helpers target the redesigned form directly:
  //   - code  → #vendor-code
  //   - name  → hero NameField <input> (placeholder "e.g. บริษัท ABC จำกัด")
  const nameInput = (page: import("@playwright/test").Page) =>
    page.getByPlaceholder(/บริษัท ABC|e\.g\. .*ABC/i).first();

  async function fillCodeAndName(
    page: import("@playwright/test").Page,
    code: string,
    name: string,
  ) {
    const codeField = page.locator("#vendor-code");
    await codeField.waitFor({ state: "visible", timeout: 15_000 });
    await codeField.fill(code);
    await nameInput(page).fill(name);
  }

  adminTest.beforeEach(async ({ page }) => {
    await ensureActiveBu(page, BU_CODE);
  });

  adminTest(
    "TC-VEN-010050 active BU = BLAVG",
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
    "TC-VEN-030050 สร้าง vendor (admin/BLAVG) สำเร็จ",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG; vendor ADMIN_CODE/ADMIN_NAME ยังไม่มีใน DB" },
        { type: "steps", description: "1. เปิด new form\n2. กรอก code + name ใน tab General\n3. เลือก business type (ถ้ามี option)\n4. กด Save\n5. กลับ list และค้นหาด้วย ADMIN_NAME" },
        { type: "expected", description: "Save toast/feedback ปรากฏ และ vendor ใหม่ค้นเจอใน list ภายใน 10s" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const vendor = new VendorPage(page);
      await vendor.gotoNew();
      await fillCodeAndName(page, ADMIN_CODE, ADMIN_NAME);
      await vendor.saveButton().click();
      await vendor.expectSaved();

      await vendor.gotoList();
      await vendor.list.search(ADMIN_NAME);
      await expect(page.getByText(ADMIN_NAME).first()).toBeVisible({ timeout: 10_000 });
    },
  );

  adminTest(
    "TC-VEN-040050 แก้ name ของ vendor แล้ว persist",
    {
      annotation: [
        { type: "preconditions", description: "TC-VEN-030050 ผ่านแล้ว → vendor ที่ ADMIN_NAME มีอยู่ใน DB; login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG" },
        { type: "steps", description: "1. ไปที่ list และเปิด detail ของ vendor ตาม ADMIN_NAME\n2. กด Edit\n3. สลับไป tab general\n4. แก้ name เป็น ADMIN_NAME_UPDATED\n5. กด Save\n6. กลับ list ค้นหาด้วย ADMIN_NAME_UPDATED" },
        { type: "expected", description: "Save toast/feedback ปรากฏ และ ADMIN_NAME_UPDATED ค้นเจอใน list ภายใน 10s (ค่าถูก persist)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const vendor = new VendorPage(page);
      await vendor.gotoList();
      await vendor.openDetailByName(ADMIN_NAME);
      await vendor.editButton().click();
      await nameInput(page).fill(ADMIN_NAME_UPDATED);
      await vendor.saveButton().click();
      await vendor.expectSaved();

      await vendor.gotoList();
      await vendor.list.search(ADMIN_NAME_UPDATED);
      await expect(page.getByText(ADMIN_NAME_UPDATED).first()).toBeVisible({ timeout: 10_000 });
    },
  );

  adminTest(
    "TC-VEN-200050 สร้าง vendor code ซ้ำ ต้องถูก reject",
    {
      annotation: [
        { type: "preconditions", description: "TC-VEN-040050 ผ่านแล้ว → vendor ที่ ADMIN_CODE มีอยู่ใน DB; login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG" },
        { type: "steps", description: "1. เปิด new form\n2. กรอก code = ADMIN_CODE (ซ้ำ) + name ใหม่\n3. เลือก business type (ถ้ามี)\n4. กด Save" },
        { type: "expected", description: "รายการที่สองไม่ถูกสร้าง: ยังอยู่ที่ form (/new) หรือมี error (backend reject duplicate code)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const vendor = new VendorPage(page);
      await vendor.gotoNew();
      await fillCodeAndName(page, ADMIN_CODE, `${ADMIN_NAME} dup`);
      await vendor.saveButton().click();

      // Duplicate code must be rejected: either the form stays on /new, or an
      // error toast/indicator surfaces. We assert it did NOT redirect to detail.
      await expect(page).toHaveURL(/\/new(\?|$|#)/, { timeout: 10_000 });
    },
  );

  adminTest(
    "TC-VEN-050050 ลบ vendor (admin/BLAVG) cleanup",
    {
      annotation: [
        { type: "preconditions", description: "TC-VEN-200050 ผ่านแล้ว → vendor ที่ ADMIN_NAME_UPDATED ยังคงอยู่ใน DB; login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG" },
        { type: "steps", description: "1. ไปที่ list และค้นหาด้วย ADMIN_NAME_UPDATED\n2. เปิด row actions\n3. คลิก menuitem Delete\n4. ใน alertdialog กดยืนยัน Delete/Confirm" },
        { type: "expected", description: "Success toast ('success/deleted/สำเร็จ') ปรากฏภายใน 10s" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const vendor = new VendorPage(page);
      await vendor.gotoList();
      await vendor.list.search(ADMIN_NAME_UPDATED);
      const row = page.locator("tbody").getByRole("row").filter({ hasText: ADMIN_NAME_UPDATED }).first();

      const actionsBtn = row.getByRole("button", { name: /row actions|actions|more/i }).first();
      await actionsBtn.click();
      await page.getByRole("menuitem", { name: /delete|ลบ/i }).first().click();

      const dialog = page.getByRole("alertdialog");
      await expect(dialog).toBeVisible({ timeout: 5_000 });
      await dialog.getByRole("button", { name: /^(delete|confirm|ลบ|ok)$/i }).click();

      await expect(
        page.locator('[data-sonner-toast], [role="status"]')
          .filter({ hasText: /success|deleted|ลบ.*สำเร็จ|สำเร็จ/i })
          .first(),
      ).toBeVisible({ timeout: 10_000 });
    },
  );
});
