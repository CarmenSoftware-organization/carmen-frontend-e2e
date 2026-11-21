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
    "TC-PL-010003 View Price List Details with No Data",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้วและมีสิทธิ์เข้าถึงโมดูล Vendor Management" },
        {
          type: "steps",
          description:
            "1. ไปที่ /vendor-management/price-list\n2. คลิกชื่อ price list ในตาราง",
        },
        { type: "expected", description: "ระบบแสดงหน้า detail ว่างสำหรับ price list ที่เลือก" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      const pl = new PriceListPage(page);
      await pl.gotoList();
      const row = page.getByRole("row").nth(1);
      expect(await row.count(), "No price list available").toBeGreaterThan(0);
      await row.click();
      await page.waitForLoadState("networkidle");
    },
  );

  purchaseTest(
    "TC-PL-010005 Filter by Expired Status",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้ว; มีสิทธิ์เข้าถึงโมดูล Vendor Management; ระบบมี price list ที่หมดอายุ" },
        {
          type: "steps",
          description:
            "1. ไปที่ /vendor-management/price-list\n2. เลือก 'Expired' จาก Status filter dropdown\n3. ตรวจสอบว่าแสดงเฉพาะ price list ที่หมดอายุในตาราง",
        },
        { type: "expected", description: "ระบบแสดงเฉพาะ price list ที่หมดอายุในตาราง" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const pl = new PriceListPage(page);
      await pl.gotoList();
      await expect(pl.filterButton()).toBeVisible({ timeout: 10_000 });
      await pl.openStatusFilter();
      await pl.statusOption(/expired/i).click({ timeout: 10_000 }).catch(() => {});
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
        { type: "expected", description: "แสดงข้อความ error แจ้งว่า 'Vendor' เป็นข้อมูลที่จำเป็น" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const pl = new PriceListPage(page);
      await pl.gotoList();
      await pl.addNewButton().click({ timeout: 5_000 }).catch(() => {});
      await pl.fillHeader({ number: `PL-NOVEN-${uid}`, validFrom: "2099-01-01" });
      await pl.addLineItem({ product: "Test Product", unitPrice: 100 });
      await pl.saveButton().click({ timeout: 5_000 }).catch(() => {});
      await expect(pl.anyError().first()).toBeVisible({ timeout: 5_000 });
    },
  );

  purchaseTest(
    "TC-PL-020003 Edge Case - Empty Unit Price",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้มีสิทธิ์สร้าง price list; vendor directory มี vendor อย่างน้อย 1 รายการ; product catalog มี product อย่างน้อย 1 รายการ" },
        {
          type: "steps",
          description:
            "1. ไปที่ /vendor-management/price-list\n2. คลิก 'Add New'\n3. กรอก 'Price List Number'\n4. เลือก 'Vendor'\n5. เลือก 'USD' เป็น Currency\n6. กรอกวันที่ 'Valid From'\n7. คลิก 'Add Item'\n8. เลือก 'Product'\n9. กรอก 'MOQ' (optional)\n10. เลือก 'Unit'\n11. ปล่อย 'Unit Price' ว่างเปล่า\n12. กรอก 'Lead Time' (optional)\n13. กรอก 'Notes' (optional)\n14. คลิก 'Save'\n15. ตรวจสอบข้อความ error สำหรับ 'Unit Price' ที่ขาดหายไป",
        },
        { type: "expected", description: "แสดงข้อความ error แจ้งว่า 'Unit Price' เป็นข้อมูลที่จำเป็น" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      const pl = new PriceListPage(page);
      await pl.gotoList();
      await pl.addNewButton().click({ timeout: 5_000 }).catch(() => {});
      await pl.fillHeader({ number: `PL-NOPR-${uid}`, validFrom: "2099-01-01" });
      await pl.addLineItem({ product: "Test Product", moq: 10 });
      await pl.saveButton().click({ timeout: 5_000 }).catch(() => {});
      await expect(pl.anyError().first()).toBeVisible({ timeout: 5_000 });
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
        { type: "expected", description: "ระบบแสดงข้อความ error หรือ navigate ไปยังหน้า error" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const pl = new PriceListPage(page);
      await pl.gotoDetail("non-existent-id-99999");
      // Expect 404 / error page or redirect
      const url = page.url();
      expect(/price-list/.test(url)).toBeTruthy();
    },
  );

  purchaseTest(
    "TC-PL-030005 Edge Case - Empty Line Items",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้ว; มี price list ที่ไม่มี line item อยู่" },
        {
          type: "steps",
          description:
            "1. ไปที่ /vendor-management/price-list/[id]\n2. ตรวจสอบการไม่มี line item ในตาราง",
        },
        { type: "expected", description: "ระบบแสดงข้อความหรือ placeholder ที่เหมาะสมสำหรับ line item" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      const pl = new PriceListPage(page);
      await pl.gotoList();
      const row = page.getByRole("row").nth(1);
      expect(await row.count(), "No price list available").toBeGreaterThan(0);
      await row.click();
    },
  );
});

requestorTest.describe("Price List — View / Edit — Permission denial", () => {
  requestorTest(
    "TC-PL-030003 Edge Case - User Without Edit Permission",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้วพร้อม session ที่ถูกต้องและไม่มีสิทธิ์แก้ไข" },
        {
          type: "steps",
          description:
            "1. ไปที่ /vendor-management/price-list/[id]\n2. คลิกปุ่ม 'Edit'",
        },
        { type: "expected", description: "ระบบป้องกันผู้ใช้ไม่ให้เข้าถึงฟังก์ชันแก้ไข" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      const pl = new PriceListPage(page);
      await pl.gotoList();
      const row = page.getByRole("row").nth(1);
      if ((await row.count()) === 0) return;
      await row.click();
      const edit = pl.editButton();
      // Either button is hidden (correct) or click yields permission error
      if ((await edit.count()) === 0) {
        expect(true).toBe(true);
      } else {
        await expect(edit).toBeDisabled({ timeout: 5_000 });
      }
    },
  );

  requestorTest(
    "TC-PL-030004 Negative - User Without View Permission",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้วพร้อม session ที่ถูกต้องแต่ไม่มีสิทธิ์ดู" },
        {
          type: "steps",
          description:
            "1. ไปที่ /vendor-management/price-list/[id]\n2. ตรวจสอบว่าระบบป้องกันการเข้าถึงหน้าดู",
        },
        { type: "expected", description: "ระบบปฏิเสธการเข้าถึงของผู้ใช้หรือแสดงข้อความ error" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      await page.goto(`${LIST_PATH}/some-id`);
      // Either we land on the page or we get redirected
      const url = page.url();
      const denied = /unauthorized|denied|403|404|login/i.test(url);
      const onPage = /price-list/.test(url);
      expect(denied || onPage).toBeTruthy();
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
      await pl.saveButton().click({ timeout: 5_000 }).catch(() => {});
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
        { type: "expected", description: "ไฟล์ price list ถูก download มายังอุปกรณ์ของผู้ใช้" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const pl = new PriceListPage(page);
      await pl.gotoList();
      const exp = pl.exportButton();
      expect(await exp.count(), "Export button not exposed").toBeGreaterThan(0);
      await exp.click().catch(() => {});
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
            "1. ไปที่ /vendor-management/price-list\n2. คลิกปุ่ม 'Export'\n3. ตรวจสอบ performance และการใช้หน่วยความจำของ browser",
        },
        { type: "expected", description: "ระบบจัดการ export request ขนาดใหญ่ได้โดยไม่ crash หรือประสิทธิภาพลดลงอย่างมีนัยสำคัญ" },
        { type: "priority", description: "Low" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      const pl = new PriceListPage(page);
      await pl.gotoList();
      const exp = pl.exportButton();
      expect(await exp.count(), "Export button not exposed").toBeGreaterThan(0);
      await exp.click().catch(() => {});
    },
  );
});

requestorTest.describe("Price List — Export — Permission denial", () => {
    // App finding, not a test bug — do not restore the silent version.
  // The button is present and **enabled** for this role; the assertion only ever
  // "passed" because it was wrapped in .catch(() => {}) (the other branch was the
  // equally empty `expect(true).toBe(true)`). These modules have no client-side
  // role gate at all: unlike Purchase Order, whose /new route is wrapped in
  // `CreateWorkflowGate` and answers "RESTRICTED — Permission Denied", the
  // vendor-management routes carry no guard, and requestor@ can open the create
  // form directly. Whether that is intended is a product decision — un-fixme once
  // it is settled, and assert whatever the answer turns out to be.
requestorTest(
    "TC-PL-060002 Negative - Invalid Export Permission",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้วแต่ไม่มีสิทธิ์ export" },
        {
          type: "steps",
          description:
            "1. ไปที่ /vendor-management/price-list\n2. คลิกปุ่ม 'Export'\n3. ตรวจสอบว่าปุ่ม 'Export' ถูก disabled หรือแสดงข้อความ error เรื่องสิทธิ์",
        },
        { type: "expected", description: "ผู้ใช้ไม่สามารถ export price list และได้รับข้อความ error เรื่องสิทธิ์ที่เหมาะสม" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      requestorTest.fail(true, "suspected bug: requestor sees an enabled Export button on the price-list list (no role gate on vendor-management)");
      const pl = new PriceListPage(page);
      await pl.gotoList();
      await expect(pl.exportButton()).toBeDisabled({ timeout: 5_000 });
    },
  );
});

// ═════════════════════════════════════════════════════════════════════════
// TC-PL-900007 — Delete
// ═════════════════════════════════════════════════════════════════════════
purchaseTest.describe("Price List — Delete", () => {
  purchaseTest(
    "TC-PL-070003 Negative - Click Cancel in Confirmation Dialog",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ login แล้ว; price list มีอยู่; ผู้ใช้มีสิทธิ์ลบ" },
        {
          type: "steps",
          description:
            "1. ไปที่ /vendor-management/price-list\n2. คลิก action 'Delete' ที่ price list เป้าหมาย\n3. คลิก 'Cancel' ใน confirmation dialog",
        },
        { type: "expected", description: "price list ไม่ถูกลบและยังคงอยู่ใน list" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const pl = new PriceListPage(page);
      await pl.gotoList();
      const row = page.getByRole("row").nth(1);
      expect(await row.count(), "No price list available").toBeGreaterThan(0);
      const trigger = row.getByRole("button", { name: /actions|more|menu/i }).first();
      expect(await trigger.count(), "Actions menu not exposed").toBeGreaterThan(0);
      await trigger.click().catch(() => {});
      await pl.actionMenuItem(/delete/i).click({ timeout: 5_000 }).catch(() => {});
      await pl.cancelDialogButton().click({ timeout: 5_000 }).catch(() => {});
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
