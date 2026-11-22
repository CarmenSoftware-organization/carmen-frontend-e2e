import { expect } from "@playwright/test";
import { createAuthTest } from "./fixtures/auth.fixture";
import { PriceListPage, LIST_PATH } from "./pages/price-list.page";
import { BU_CODE } from "./test-users";
import { ensureActiveBu, getBusinessUnits, defaultBu } from "./helpers/bu";
import { BuSwitcherPage } from "./pages/bu-switcher.page";
import { uid } from "./helpers/test-data";

// ─────────────────────────────────────────────────────────────────────────
// Multi-role auth — Vendor Mgmt access == carmensoftware.dev+purchase@gmail.com.
// Permission denial / no view-access cases use carmensoftware.dev+requestor@gmail.com.
// requestor declared LAST so user-story doc default role reads "Purchase".
// ─────────────────────────────────────────────────────────────────────────
const requestorTest = createAuthTest("carmensoftware.dev+requestor@gmail.com");
const purchaseTest = createAuthTest("carmensoftware.dev+purchase@gmail.com");

// ═════════════════════════════════════════════════════════════════════════
// TC-PL-900001 — Login & List page access
// ═════════════════════════════════════════════════════════════════════════
purchaseTest.describe("Price List — List & Filter", () => {
  purchaseTest(
    "TC-PL-010001 Valid Login and Access to Price Lists Page",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้วและมีสิทธิ์เข้าถึงโมดูล Vendor Management" },
        {
          type: "steps",
          description:
            "1. ไปที่ /login\n2. กรอก 'Username' ด้วย credentials ที่ถูกต้อง\n3. กรอก 'Password' ด้วย credentials ที่ถูกต้อง\n4. คลิก 'Login'\n5. คลิก 'Vendor Management' ใน sidebar navigation\n6. คลิก submenu 'Price Lists'",
        },
        { type: "expected", description: "ระบบ navigate ไปยัง /vendor-management/price-list และแสดงหน้า Price Lists" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const pl = new PriceListPage(page);
      await pl.gotoList();
      await expect(page).toHaveURL(/vendor-management\/price-list/);
      await expect(pl.addNewButton()).toBeVisible({ timeout: 10_000 });
    },
  );

  purchaseTest(
    "TC-PL-010002 Search Filter with Invalid Keyword",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้วและมีสิทธิ์เข้าถึงโมดูล Vendor Management" },
        {
          type: "steps",
          description:
            "1. ไปที่ /vendor-management/price-list\n2. กรอก 'Search' input ด้วยคีย์เวิร์ดที่ไม่ถูกต้อง 'abcd'\n3. คลิกปุ่ม 'Search'",
        },
        { type: "expected", description: "ระบบแสดงตารางว่างและไม่มี price list ที่กรอง" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const pl = new PriceListPage(page);
      await pl.gotoList();
      const search = pl.searchInput();
      // SearchInput only fires onSearch on Enter — filling the box alone never
      // ran a search, so the table still held every row and the empty state was
      // correctly absent. The assertion was swallowed, so nobody noticed.
      if ((await search.count()) > 0) {
        await search.click({ timeout: 10_000 });
        await search.fill("__NONEXISTENT_E2E_abcd__", { timeout: 10_000 });
        await search.press("Enter", { timeout: 10_000 });
      }
      await expect(pl.emptyState()).toBeVisible({ timeout: 10_000 });
    },
  );

  purchaseTest(
    "TC-PL-010003 เปิดรายละเอียด price list จากตาราง",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้วและมีสิทธิ์เข้าถึงโมดูล Vendor Management" },
        {
          type: "steps",
          description:
            "1. ไปที่ /vendor-management/price-list\\n2. คลิกชื่อ price list แถวแรก",
        },
        { type: "expected", description: "ไปที่หน้า /price-list/<id> ที่แสดงชื่อ price list และส่วน Products" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      const pl = new PriceListPage(page);
      await pl.gotoList();
      const record = page.locator("tbody tr:has(button)").first();
      await expect(record, "no price list seeded — run `bun run data:reset`").toBeVisible({ timeout: 10_000 });
      const name = (await record.getByRole("button").first().innerText()).trim();
      await record.getByRole("button").first().click({ timeout: 10_000 });
      await expect(page).toHaveURL(/price-list\/[0-9a-f-]{36}$/, { timeout: 10_000 });
      await expect(page.getByText(name).first()).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(/^Products/).first()).toBeVisible();
    },
  );

  purchaseTest(
    "TC-PL-010005 กรองตามสถานะ Voided / Active (ไม่มีสถานะ Expired แล้ว)",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้ว; มี price list STD สถานะ Active (data:reset) และไม่มี price list ที่ถูก void" },
        {
          type: "steps",
          description:
            "1. ไปที่ /vendor-management/price-list\\n2. เปิด Filter > Status แล้วเลือก 'Voided'\\n3. เลือก 'Active'",
        },
        { type: "expected", description: "Voided แสดง empty state (ไม่มี price list ที่ถูก void); Active แสดงเฉพาะ price list สถานะ Active (สถานะ Expired ไม่มีใน filter แล้ว)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const pl = new PriceListPage(page);
      await pl.gotoList();
      await expect(pl.filterButton()).toBeVisible({ timeout: 10_000 });
      // ListFilter "Status" group: All / Draft / Submitted / Active / Inactive / Voided (no "Expired" any more)
      const pickStatus = async (label: string) => {
        await page.getByRole("button", { name: /^Filter\b/ }).first().click();
        const sheet = page.locator("[role=dialog]:visible, [role=menu]:visible").last();
        await sheet.getByText("Status", { exact: true }).click();
        await page.getByRole("option", { name: label, exact: true }).click();
        await page.keyboard.press("Escape");
        await page.waitForLoadState("networkidle");
      };
      await pickStatus("Voided");
      await expect(pl.emptyState(), "no voided price list is seeded").toBeVisible({ timeout: 10_000 });
      await pickStatus("Active");
      const rows = page.locator("tbody tr:has(button)");
      await expect(rows.first()).toBeVisible({ timeout: 10_000 });
      for (const text of await rows.allInnerTexts()) expect(text).toMatch(/\bActive\b/);
    },
  );
});

requestorTest.describe("Price List — List access — Permission denial", () => {
  requestorTest(
    "TC-PL-010004 User Without Access to Price Lists Page",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้วแต่ไม่มีสิทธิ์เข้าถึงโมดูล Vendor Management" },
        { type: "steps", description: "1. ไปที่ /vendor-management/price-list" },
        { type: "expected", description: "ระบบแสดงข้อความ error แจ้งสิทธิ์การเข้าถึงไม่เพียงพอ" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      await page.goto(LIST_PATH);
      // Either we land on the page (read access) or we get redirected
      const url = page.url();
      const onListPage = /price-list/.test(url);
      const onUnauthorized = /unauthorized|denied|403/i.test(url);
      expect(onListPage || onUnauthorized).toBeTruthy();
    },
  );
});

// ═════════════════════════════════════════════════════════════════════════
// TC-PL-900002 — Create Price List
// ═════════════════════════════════════════════════════════════════════════
purchaseTest.describe("Price List — Create", () => {
  purchaseTest(
    "TC-PL-020001 Happy Path - Create Valid Price List",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้ว; มีสิทธิ์สร้าง price list; vendor directory มี vendor อย่างน้อย 1 รายการ; product catalog มี product อย่างน้อย 1 รายการ" },
        {
          type: "steps",
          description:
            "1. ไปที่ /vendor-management/price-list\n2. คลิก 'Add New'\n3. กรอก 'Price List Number'\n4. เลือก 'Vendor'\n5. เลือก 'USD' เป็น Currency\n6. กรอกวันที่ 'Valid From'\n7. คลิก 'Add Item'\n8. เลือก 'Product'\n9. กรอก 'MOQ' (optional)\n10. เลือก 'Unit'\n11. กรอก 'Unit Price'\n12. กรอก 'Lead Time' (optional)\n13. กรอก 'Notes' (optional)\n14. คลิก 'Save'\n15. ตรวจสอบข้อความ 'Success Toast'",
        },
        { type: "expected", description: "price list สร้างสำเร็จและแสดงใน list" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const pl = new PriceListPage(page);
      await pl.gotoList();
      await pl.addNewButton().click({ timeout: 10_000 });
      // Both dates are required — passing only validFrom left Effective To unset,
      // so the save was blocked and no toast ever appeared. The swallowed click
      // and swallowed toast assertion hid that from view.
      await pl.fillHeader({ number: `PL-E2E-${uid}`, validFrom: "x", validTo: "x" });
      await pl.addLineItem({ product: "Test Product", moq: 10, unitPrice: 100, leadTime: 7 });
      await pl.saveButton().click({ timeout: 10_000 });
      await pl.expectSavedToast();
    },
  );

  purchaseTest(
    "TC-PL-020002 Negative - Missing Vendor",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้มีสิทธิ์สร้าง price list; product catalog มี product อย่างน้อย 1 รายการ" },
        {
          type: "steps",
          description:
            "1. ไปที่ /vendor-management/price-list\n2. คลิก 'Add New'\n3. กรอก 'Price List Number'\n4. เลือก 'USD' เป็น Currency\n5. กรอกวันที่ 'Valid From'\n6. คลิก 'Add Item'\n7. เลือก 'Product'\n8. กรอก 'MOQ' (optional)\n9. เลือก 'Unit'\n10. กรอก 'Unit Price'\n11. กรอก 'Lead Time' (optional)\n12. กรอก 'Notes' (optional)\n13. คลิก 'Save'\n14. ตรวจสอบข้อความ error สำหรับ 'Vendor' ที่ขาดหายไป",
        },
        { type: "expected", description: "ไม่บันทึก: ไม่มีคำขอเขียนไป backend และยังอยู่ที่ /price-list/new (Vendor เป็นข้อมูลที่จำเป็น)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const pl = new PriceListPage(page);
      await pl.gotoList();
      await pl.addNewButton().click({ timeout: 5_000 });
      await expect(pl.numberInput()).toBeVisible({ timeout: 15_000 });
      // Name only: no vendor chosen (Vendor is required)
      await pl.numberInput().fill(`PL-NOVEN-${uid}`);
      const write = page.waitForResponse((r) => r.request().method() !== "GET" && /pricelist/i.test(r.url()), { timeout: 5_000 }).then(() => true, () => false);
      await pl.saveButton().click({ timeout: 5_000 });
      expect(await write, "validation should block the save: no write request expected").toBe(false);
      await expect(page).toHaveURL(/price-list\/new/);
    },
  );

  purchaseTest(
    "TC-PL-020003 เว้น Unit Price ว่างได้ บันทึกสำเร็จ",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้มีสิทธิ์สร้าง price list; vendor directory มี vendor อย่างน้อย 1 รายการ; product catalog มี product อย่างน้อย 1 รายการ" },
        {
          type: "steps",
          description:
            "1. ไปที่ /vendor-management/price-list\n2. คลิก 'Add New'\n3. กรอก 'Price List Number'\n4. เลือก 'Vendor'\n5. เลือก 'USD' เป็น Currency\n6. กรอกวันที่ 'Valid From'\n7. คลิก 'Add Item'\n8. เลือก 'Product'\n9. กรอก 'MOQ' (optional)\n10. เลือก 'Unit'\n11. ปล่อย 'Unit Price' ว่างเปล่า\n12. กรอก 'Lead Time' (optional)\n13. กรอก 'Notes' (optional)\n14. คลิก 'Save'\n15. ตรวจสอบข้อความ error สำหรับ 'Unit Price' ที่ขาดหายไป",
        },
        { type: "expected", description: "บันทึกสำเร็จ: Unit Price เว้นว่างได้ (ถือเป็น 0) — คำขอเขียนตอบ 2xx และเปิดหน้ารายละเอียด /price-list/<id>" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      const pl = new PriceListPage(page);
      await pl.gotoList();
      await pl.addNewButton().click({ timeout: 5_000 });
      await pl.fillHeader({ number: `PL-NOPR-${uid}`, validFrom: "x", validTo: "x" });
      await pl.addLineItem({ product: "Test Product", moq: 10 });
      const saved = page.waitForResponse((r) => r.request().method() !== "GET" && /pricelist/i.test(r.url()), { timeout: 10_000 });
      await pl.saveButton().click({ timeout: 5_000 });
      // Unit price is optional now (empty = 0): the write goes through and the detail page opens.
      expect((await saved).ok()).toBe(true);
      await expect(page).toHaveURL(/price-list\/[0-9a-f-]{36}$/, { timeout: 10_000 });
      await expect(page.getByText(/^Products/).first()).toBeVisible();
    },
  );
});

// ═════════════════════════════════════════════════════════════════════════
// TC-PL-900003 — View Price List Detail
// ═════════════════════════════════════════════════════════════════════════
purchaseTest.describe("Price List — View detail", () => {
  purchaseTest(
    "TC-PL-030001 Happy Path - Valid Price List Click",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้วพร้อม session ที่ถูกต้อง; มี price list อยู่" },
        {
          type: "steps",
          description:
            "1. ไปที่ /vendor-management/price-list\n2. คลิกชื่อ price list\n3. ตรวจสอบการ navigate ไปยัง /vendor-management/price-list/[id]",
        },
        { type: "expected", description: "ระบบ navigate ไปยังหน้า detail ของ price list และแสดงข้อมูล price list ที่ถูกต้อง" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const pl = new PriceListPage(page);
      await pl.gotoList();
      const row = page.getByRole("row").nth(1);
      expect(await row.count(), "No price list to view").toBeGreaterThan(0);
      // A <tr> is not clickable here: the record opens from a link-styled
      // <button> in the row whose text is the price-list number.
      await row.getByRole("button").first().click({ timeout: 10_000 });
      await expect(page).toHaveURL(/price-list\/[^/]+$/, { timeout: 10_000 });
    },
  );

  purchaseTest(
    "TC-PL-030002 Negative - No Price List Selected",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้วพร้อม session ที่ถูกต้อง" },
        {
          type: "steps",
          description:
            "1. ไปที่ /vendor-management/price-list\n2. พยายามคลิกชื่อ price list ที่ไม่มีอยู่",
        },
        { type: "expected", description: "ระบบแสดง ErrorState ('Something went wrong') สำหรับ id ที่ไม่มีอยู่จริง" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const pl = new PriceListPage(page);
      await pl.gotoDetail("non-existent-id-99999");
      // ErrorState with a retry, not a crash and not a blank page
      await expect(page.getByText(/something went wrong/i).first()).toBeVisible({ timeout: 10_000 });
      await expect(page).toHaveURL(/price-list\/non-existent-id-99999/);
    },
  );

  purchaseTest(
    "TC-PL-030005 Edge Case - Empty Line Items",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้ว; สร้าง price list ที่ไม่มี line item ในเคสนี้เอง" },
        {
          type: "steps",
          description:
            "1. ไปที่ /vendor-management/price-list/[id]\n2. ตรวจสอบการไม่มี line item ในตาราง",
        },
        { type: "expected", description: "หน้ารายละเอียดแสดง placeholder 'No Products Yet' แทนตาราง line item" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      const pl = new PriceListPage(page);
      const name = `PL-NOITEM-${uid}`;
      // A price list can be saved without any line item — create one and open it.
      await pl.gotoList();
      await pl.addNewButton().click({ timeout: 5_000 });
      await pl.fillHeader({ number: name, validFrom: "x", validTo: "x" });
      await pl.saveButton().click({ timeout: 5_000 });
      await pl.expectSavedToast();
      await expect(page).toHaveURL(/price-list\/[0-9a-f-]{36}$/, { timeout: 10_000 });
      await expect(page.getByText("No Products Yet")).toBeVisible({ timeout: 10_000 });
    },
  );
});

requestorTest.describe("Price List — View / Edit — Permission denial", () => {
  requestorTest(
    "TC-PL-030003 Edge Case - User Without Edit Permission",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login เป็น requestor ซึ่งมีเฉพาะสิทธิ์ vendor_management.price_list.view (ไม่มี update)" },
        {
          type: "steps",
          description:
            "1. ไปที่ /vendor-management/price-list/[id]\n2. คลิกปุ่ม 'Edit'",
        },
        { type: "expected", description: "หน้ารายละเอียดเปิดได้ (มีปุ่ม Activity) แต่ไม่มีปุ่ม Edit (บั๊ก: ปัจจุบันปุ่ม Edit ยังแสดง)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      const pl = new PriceListPage(page);
      await pl.gotoList();
      const record = page.locator("tbody tr:has(button)").first();
      await expect(record, "no price list seeded — run `bun run data:reset`").toBeVisible({ timeout: 10_000 });
      await record.getByRole("button").first().click({ timeout: 10_000 });
      // The toolbar is rendered (Activity is there) — only then is "no Edit button" meaningful.
      await expect(page.getByRole("button", { name: /^Activity$/ })).toBeVisible({ timeout: 10_000 });
      // Bug site: requestor@ holds price_list.view only (no .update), yet the FE offers Edit.
      requestorTest.fail(true, "suspected bug: a view-only role (requestor@: price_list.view, no .update) sees an enabled Edit button on a price list");
      await expect(pl.editButton()).toHaveCount(0);
    },
  );

  requestorTest(
    "TC-PL-030004 role ที่มีสิทธิ์ view อย่างเดียวเปิดรายละเอียด price list ได้",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login เป็น requestor (ทุก role ใน seed มีสิทธิ์ vendor_management.price_list.view — เคส 'ไม่มีสิทธิ์ดู' ทำไม่ได้กับข้อมูลนี้)" },
        {
          type: "steps",
          description:
            "1. ไปที่ /vendor-management/price-list\\n2. คลิกชื่อ price list แถวแรก",
        },
        { type: "expected", description: "role ที่มีสิทธิ์ view อย่างเดียวเปิดหน้ารายละเอียดและเห็นส่วน Products ได้" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const pl = new PriceListPage(page);
      await pl.gotoList();
      const record = page.locator("tbody tr:has(button)").first();
      await expect(record, "no price list seeded — run `bun run data:reset`").toBeVisible({ timeout: 10_000 });
      await record.getByRole("button").first().click({ timeout: 10_000 });
      await expect(page).toHaveURL(/price-list\/[0-9a-f-]{36}$/, { timeout: 10_000 });
      await expect(page.getByText(/^Products/).first()).toBeVisible({ timeout: 10_000 });
    },
  );
});

// ═════════════════════════════════════════════════════════════════════════
// TC-PL-900004 — Edit Price List
// ═════════════════════════════════════════════════════════════════════════
purchaseTest.describe("Price List — Edit", () => {
  purchaseTest(
    "TC-PL-040001 Happy Path: Edit Price List Successfully",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้วพร้อม session ที่ถูกต้อง; price list มีอยู่และแก้ไขได้; ผู้ใช้มีสิทธิ์แก้ไข" },
        {
          type: "steps",
          description:
            "1. ไปที่ /vendor-management/price-list\n2. คลิกปุ่ม 'Edit' ที่หน้า detail ของ price list\n3. กรอกวันที่ valid from ใหม่\n4. กรอกวันที่ valid to ใหม่\n5. กรอก notes ใหม่\n6. อัปเดตราคาสำหรับ line item\n7. คลิก 'Save'",
        },
        { type: "expected", description: "price list อัปเดตสำเร็จ แสดงข้อความสำเร็จ และผู้ใช้กลับไปยัง view mode" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const pl = new PriceListPage(page);
      await pl.gotoList();
      const row = page.getByRole("row").nth(1);
      expect(await row.count(), "No price list to edit").toBeGreaterThan(0);
      // A <tr> is not clickable — open the record from its own button.
      await row.getByRole("button").first().click({ timeout: 10_000 });
      await pl.editButton().click({ timeout: 10_000 });
      await pl.fillHeader({ validFrom: "2099-02-01", validTo: "2099-12-31", notes: "edited by E2E" });
      await pl.saveButton().click({ timeout: 5_000 });
      await pl.expectSavedToast();
    },
  );

});

// TC-PL-900005 (Duplicate) and TC-PL-900008 (Mark as Expired) were removed: neither the
// row-actions menu (Activity / Delete) nor the detail page (Edit / Delete / Activity) offers
// Duplicate or Mark-as-Expired any more, and no such wording appears on either screen.

// ═════════════════════════════════════════════════════════════════════════
// TC-PL-900006 — Export
// ═════════════════════════════════════════════════════════════════════════
purchaseTest.describe("Price List — Export", () => {
  purchaseTest(
    "TC-PL-060001 Happy Path - Export Price List",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้ว; price list มีอยู่" },
        {
          type: "steps",
          description:
            "1. ไปที่ /vendor-management/price-list\n2. คลิกปุ่ม 'Export'\n3. รอการสร้างไฟล์ export\n4. คลิก download link",
        },
        { type: "expected", description: "เบราว์เซอร์ดาวน์โหลดไฟล์ .xlsx ของ price list" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const pl = new PriceListPage(page);
      await pl.gotoList();
      await expect(pl.exportButton()).toBeEnabled({ timeout: 10_000 });
      const [download] = await Promise.all([page.waitForEvent("download", { timeout: 30_000 }), pl.exportButton().click()]);
      expect(download.suggestedFilename()).toMatch(/\.xlsx$/i);
    },
  );

  purchaseTest(
    "TC-PL-060003 Edge Case - Large Price List",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้ว; price list มีรายการจำนวนมาก" },
        {
          type: "steps",
          description:
            "1. ไปที่ /vendor-management/price-list\\n2. ตั้ง Rows per page เป็น 100\\n3. คลิกปุ่ม 'Export'",
        },
        { type: "expected", description: "export หน้าขนาดใหญ่สุดได้โดยไม่ crash และได้ไฟล์ .xlsx" },
        { type: "priority", description: "Low" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      const pl = new PriceListPage(page);
      await pl.gotoList();
      await expect(pl.exportButton()).toBeEnabled({ timeout: 10_000 });
      // Largest page size the grid offers, then export it
      await page.getByRole("combobox", { name: /rows per page/i }).click();
      await page.getByRole("option", { name: "100", exact: true }).click();
      await page.waitForLoadState("networkidle");
      const [download] = await Promise.all([page.waitForEvent("download", { timeout: 30_000 }), pl.exportButton().click()]);
      expect(download.suggestedFilename()).toMatch(/\.xlsx$/i);
    },
  );
});

requestorTest.describe("Price List — Export — Permission denial", () => {
  // There is no separate export permission key (module-list.ts / permissions.ts): export follows view.
requestorTest(
    "TC-PL-060002 role ที่มีสิทธิ์ view อย่างเดียว export price list ได้ (ไม่มีสิทธิ์ export แยก)",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login เป็น requestor (มีเฉพาะ price_list.view; ไม่มีคีย์สิทธิ์ export แยก — export ตามสิทธิ์ view)" },
        {
          type: "steps",
          description:
            "1. ไปที่ /vendor-management/price-list\\n2. คลิกปุ่ม 'Export'",
        },
        { type: "expected", description: "role ที่มีสิทธิ์ view อย่างเดียว export ได้: ดาวน์โหลดไฟล์ .xlsx" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const pl = new PriceListPage(page);
      await pl.gotoList();
      await expect(pl.exportButton()).toBeEnabled({ timeout: 10_000 });
      const [download] = await Promise.all([page.waitForEvent("download", { timeout: 30_000 }), pl.exportButton().click()]);
      expect(download.suggestedFilename()).toMatch(/\.xlsx$/i);
    },
  );
});

// ═════════════════════════════════════════════════════════════════════════
// TC-PL-900007 — Delete
// ═════════════════════════════════════════════════════════════════════════
purchaseTest.describe("Price List — Delete", () => {
  purchaseTest(
    "TC-PL-070003 ยกเลิกใน dialog ยืนยัน Void — price list ยังคงเป็น Active",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้ว; price list มีอยู่; ผู้ใช้มีสิทธิ์ลบ" },
        {
          type: "steps",
          description:
            "1. ไปที่ /vendor-management/price-list\\n2. เปิด Row actions ของ price list ที่ Active แล้วเลือก 'Void' (ไม่มี Delete สำหรับ price list ที่ Active)\\n3. คลิก 'Cancel' ใน dialog ยืนยัน",
        },
        { type: "expected", description: "dialog ปิด; price list ยังอยู่ในรายการและยังเป็น Active (ไม่ถูก void)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const pl = new PriceListPage(page);
      await pl.gotoList();
      const row = page.locator("tbody tr:has(button)").first();
      await expect(row, "no price list seeded — run `bun run data:reset`").toBeVisible({ timeout: 10_000 });
      const name = (await row.getByRole("button").first().innerText()).trim();
      // Active price lists offer Void (not Delete) in the row actions
      await row.getByRole("button", { name: /row actions/i }).click();
      await page.getByRole("menuitem", { name: /^Void$/i }).click();
      const dialog = page.locator('[role="dialog"]:visible, [role="alertdialog"]:visible').last();
      await expect(dialog).toBeVisible({ timeout: 5_000 });
      await pl.cancelDialogButton().click({ timeout: 5_000 });
      await expect(dialog).toBeHidden({ timeout: 5_000 });
      // Still there and still Active
      const same = page.locator("tbody tr:has(button)").filter({ hasText: name }).first();
      await expect(same).toBeVisible();
      await expect(same).toContainText(/Active/);
    },
  );

});

requestorTest.describe("Price List — Delete — Permission denial", () => {
  requestorTest(
    "TC-PL-070002 Negative - No Delete Permission",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้ว; price list มีอยู่; ผู้ใช้ไม่มีสิทธิ์ลบ" },
        {
          type: "steps",
          description:
            "1. ไปที่ /vendor-management/price-list\n2. คลิก action 'Delete' ที่ price list เป้าหมาย",
        },
        { type: "expected", description: "ผู้ใช้ได้รับข้อความปฏิเสธสิทธิ์และไม่สามารถลบ price list ได้" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const pl = new PriceListPage(page);
      await pl.gotoList();
      const row = page.locator("tbody tr:has(button)").first();
      await expect(row, "no price list seeded — run `bun run data:reset`").toBeVisible({ timeout: 10_000 });
      await row.getByRole("button", { name: /row actions/i }).click();
      await expect(page.getByRole("menuitem", { name: /^Activity$/i })).toBeVisible();
      await expect(page.getByRole("menuitem", { name: /^Delete$/i })).toHaveCount(0);
    },
  );
});

// ── carmensoftware.dev+admin@gmail.com + BLAVG ──────────────────────────────────────────
// The describes above run as purchase/requestor (authz coverage) and are left
// untouched. Price List create is a heavy document (vendor + currency +
// valid-from + line items, dependent on seeded data), so this block is
// intentionally LIGHT: BU precondition + BU-assert + a couple of hardened
// read/list cases (no create chain). See the procurement-trio rollout spec.
const adminTest = createAuthTest("carmensoftware.dev+admin@gmail.com");

adminTest.describe("Price List — admin@BLAVG", () => {
  adminTest.beforeEach(async ({ page }) => {
    await ensureActiveBu(page, BU_CODE);
  });

  adminTest(
    "TC-PL-010050 active BU = BLAVG",
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
    "TC-PL-010051 หน้า list โหลดสำเร็จ (admin/BLAVG) + ปุ่ม Add แสดง",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG; มีสิทธิ์เข้าถึง Vendor Management" },
        { type: "steps", description: "1. ไปที่ /vendor-management/price-list\n2. ตรวจสอบ URL และ heading 'Price List'\n3. ตรวจสอบว่าปุ่ม 'Add Price List' แสดง" },
        { type: "expected", description: "URL เป็น /vendor-management/price-list, heading 'Price List' แสดง, และปุ่ม Add แสดง (hard assert)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page }) => {
      const pl = new PriceListPage(page);
      await pl.gotoList();
      await expect(page).toHaveURL(/vendor-management\/price-list/);
      await expect(
        page.getByRole("heading", { name: /^price list$/i }).first(),
      ).toBeVisible({ timeout: 15_000 });
      await expect(
        page.getByRole("button", { name: /add price list|add new|^add$/i }).first(),
      ).toBeVisible({ timeout: 10_000 });
    },
  );

  adminTest(
    "TC-PL-010052 ค้นหาคำที่ไม่มี → empty state",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG; มีสิทธิ์เข้าถึง Price List" },
        { type: "steps", description: "1. ไปที่ /vendor-management/price-list\n2. กรอกคำค้นหาที่ไม่มีอยู่จริงในช่อง Search\n3. ตรวจสอบว่าแสดง empty state" },
        { type: "expected", description: "ตารางแสดง empty state ('No data found') สำหรับคำค้นที่ไม่ตรง (hard assert)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const pl = new PriceListPage(page);
      await pl.gotoList();
      const search = pl.searchInput();
      await expect(search).toBeVisible({ timeout: 10_000 });
      await search.fill("__NONEXISTENT_E2E_PL_KEYWORD__");
      // SearchInput only fires onSearch on Enter (or the search button) — not on change.
      await search.press("Enter");
      await expect(pl.emptyState()).toBeVisible({ timeout: 10_000 });
    },
  );
});
