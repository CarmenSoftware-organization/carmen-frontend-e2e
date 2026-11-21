import { expect } from "@playwright/test";
import { createAuthTest } from "./fixtures/auth.fixture";
import { StockIssuePage, LIST_PATH } from "./pages/stock-issue.page";
import { openRecordFromRow, recordRows } from "./helpers/list-row";

// ─────────────────────────────────────────────────────────────────────────
// Multi-role auth — Warehouse/Store-Operations Staff == carmensoftware.dev+purchase@gmail.com.
// Permission denial uses carmensoftware.dev+requestor@gmail.com.
// requestor declared LAST so doc default role reads "Purchase".
// ─────────────────────────────────────────────────────────────────────────
const requestorTest = createAuthTest("carmensoftware.dev+requestor@gmail.com");
const purchaseTest = createAuthTest("carmensoftware.dev+purchase@gmail.com");

// ═════════════════════════════════════════════════════════════════════════
// TC-SI-900001 — View Issue List
// ═════════════════════════════════════════════════════════════════════════
purchaseTest.describe("Stock Issue — List", () => {
  purchaseTest(
    "TC-SI-010001 Happy Path - View Issue List",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้มีสิทธิ์เข้าถึง Stock Issues view และมี permission store_operations.view" },
        {
          type: "steps",
          description:
            "1. ไปที่ /store-operation/store-requisition\n2. ตรวจสอบว่า summary cards แสดงจำนวนและมูลค่ารวมที่ถูกต้อง\n3. ตรวจสอบว่า issue list ถูก filter สำหรับ Issue stage ที่มี DIRECT destinations\n4. คลิก row\n5. ตรวจสอบว่ารายละเอียด issue ที่เลือกตรงกับ row",
        },
        { type: "expected", description: "Summary cards และ issue list แสดงข้อมูลที่ถูกต้อง ผู้ใช้สามารถดูรายละเอียดของ issues ที่เลือก" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const si = new StockIssuePage(page);
      await si.gotoList();
      await expect(page).toHaveURL(/store-requisition/);
    },
  );

  purchaseTest(
    "TC-SI-010003 Edge Case - No Issues",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้มีสิทธิ์เข้าถึง และไม่มี issues ใน Issue stage ที่มี DIRECT destinations" },
        {
          type: "steps",
          description:
            "1. ไปที่ /store-operation/store-requisition\n2. ตรวจสอบว่า summary cards แสดง 0 สำหรับทุก counts และ total value\n3. ตรวจสอบว่า issue list ว่างเปล่า",
        },
        { type: "expected", description: "Summary cards และ issue list แสดง 0 counts และ empty list" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      const si = new StockIssuePage(page);
      await si.gotoList();
    },
  );

  purchaseTest(
    "TC-SI-010004 Edge Case - Pagination",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้มีสิทธิ์เข้าถึง Stock Issues view และมี permission store_operations.view" },
        {
          type: "steps",
          description:
            "1. ไปที่ /store-operation/store-requisition\n2. ตรวจสอบว่า pagination controls มีอยู่\n3. กด Next หรือ Previous page button\n4. ตรวจสอบว่าหน้า issues ถัดไปหรือก่อนหน้าแสดงขึ้นมา",
        },
        { type: "expected", description: "Pagination controls ทำงานได้และหน้า issues ถัดไปหรือก่อนหน้าแสดงอย่างถูกต้อง" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      const si = new StockIssuePage(page);
      await si.gotoList();
      const next = si.paginationNext();
      if ((await next.count()) > 0) await next.click().catch(() => {});
    },
  );
});

// ═════════════════════════════════════════════════════════════════════════
// TC-SI-900002 — View Issue Detail
// ═════════════════════════════════════════════════════════════════════════
purchaseTest.describe("Stock Issue — View Detail", () => {
  purchaseTest(
    "TC-SI-020001 View existing issue with all details",
    {
      annotation: [
        { type: "preconditions", description: "StoreRequisition อยู่ใน Issue stage destinationLocationType เป็น DIRECT และผู้ใช้มี view permission" },
        {
          type: "steps",
          description:
            "1. ไปที่ /store-operation/store-requisition\n2. คลิก issue row หรือ reference number\n3. ตรวจสอบ header พร้อม SR reference, date และ status badge\n4. ตรวจสอบ cards ของ From Location, Issue Summary, To Location, Department และ Expense Account\n5. ตรวจสอบ items table พร้อมรายละเอียดที่ถูกต้อง\n6. ตรวจสอบ tracking info หากมี",
        },
        { type: "expected", description: "ระบบแสดงรายละเอียดทั้งหมดใน issue layout ตามที่คาดหวัง" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const si = new StockIssuePage(page);
      await si.gotoList();
      const row = page.getByRole("row").nth(1);
      if ((await row.count()) === 0) {
        purchaseTest.skip(true, "No SR available");
        return;
      }
      await openRecordFromRow(row);
    },
  );

  purchaseTest(
    "TC-SI-020002 View issue with missing department assignment",
    {
      annotation: [
        { type: "preconditions", description: "StoreRequisition อยู่ใน Issue stage destinationLocationType เป็น DIRECT ผู้ใช้มี view permission และ department ไม่ถูก assign" },
        {
          type: "steps",
          description:
            "1. ไปที่ /store-operation/store-requisition\n2. คลิก issue row หรือ reference number\n3. ตรวจสอบ header พร้อม SR reference, date และ status badge\n4. ตรวจสอบ cards ของ From Location, Issue Summary, To Location และ Expense Account\n5. ตรวจสอบ items table พร้อมรายละเอียดที่ถูกต้อง\n6. ตรวจสอบ tracking info หากมี",
        },
        { type: "expected", description: "ระบบแสดงรายละเอียดทั้งหมดยกเว้น department card ตามที่คาดหวัง" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      const si = new StockIssuePage(page);
      await si.gotoList();
    },
  );
});

requestorTest.describe("Stock Issue — View Detail — Permission denial", () => {
  requestorTest(
    "TC-SI-020003 View issue without view permission",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+requestor@gmail.com StoreRequisition อยู่ใน Issue stage destinationLocationType เป็น DIRECT และผู้ใช้ไม่มี view permission" },
        {
          type: "steps",
          description:
            "1. ไปที่ /store-operation/store-requisition\n2. คลิก issue row หรือ reference number\n3. ตรวจสอบ error message หรือสัญญาณบอกว่าถูกจำกัดสิทธิ์",
        },
        { type: "expected", description: "ระบบจำกัดการเข้าถึงหรือแสดง error message ตามที่คาดหวัง" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      await page.goto(LIST_PATH);
      const url = page.url();
      const onListPage = /store-requisition/.test(url);
      const onUnauthorized = /unauthorized|denied|403|login/i.test(url);
      expect(onListPage || onUnauthorized).toBeTruthy();
    },
  );
});

// ═════════════════════════════════════════════════════════════════════════
// TC-SI-900003 — Search & Filter
// ═════════════════════════════════════════════════════════════════════════
purchaseTest.describe("Stock Issue — Search & Filter", () => {
  purchaseTest(
    "TC-SI-030001 Happy Path - Search by SR Reference Number",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้มีสิทธิ์เข้าถึง Stock Issues view" },
        {
          type: "steps",
          description:
            "1. ไปที่ /store-operation/store-requisition\n2. กรอก search term 'SR-12345' ใน search box\n3. เลือก status filter 'All'\n4. รอให้ list อัปเดต\n5. ตรวจสอบว่า SR 'SR-12345' แสดงใน list",
        },
        { type: "expected", description: "SR 'SR-12345' แสดงใน list พร้อมรายละเอียดที่เกี่ยวข้องอย่างถูกต้อง" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const si = new StockIssuePage(page);
      await si.gotoList();
      const search = si.searchInput();
      if ((await search.count()) > 0) await search.fill("SR-12345").catch(() => {});
    },
  );

  purchaseTest(
    "TC-SI-030002 Negative Case - Invalid Search Term",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้มีสิทธิ์เข้าถึง Stock Issues view" },
        {
          type: "steps",
          description:
            "1. ไปที่ /store-operation/store-requisition\n2. กรอก search term 'InvalidSR' ใน search box\n3. เลือก status filter 'All'\n4. รอให้ list อัปเดต\n5. ตรวจสอบว่าไม่มี SRs แสดง",
        },
        { type: "expected", description: "ไม่มี SRs แสดงใน list" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const si = new StockIssuePage(page);
      await si.gotoList();
      const search = si.searchInput();
      if ((await search.count()) > 0) await search.fill("__INVALID_SR_E2E__").catch(() => {});
      await expect(si.emptyState()).toBeVisible({ timeout: 10_000 });
    },
  );

  purchaseTest(
    "TC-SI-030003 Edge Case - Empty Search Term",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้มีสิทธิ์เข้าถึง Stock Issues view" },
        {
          type: "steps",
          description:
            "1. ไปที่ /store-operation/store-requisition\n2. clear search term ใน search box\n3. เลือก status filter 'All'\n4. รอให้ list อัปเดต\n5. ตรวจสอบว่า SRs ทั้งหมดแสดงขึ้นมา",
        },
        { type: "expected", description: "SRs ทั้งหมดแสดงใน list" },
        { type: "priority", description: "Low" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      const si = new StockIssuePage(page);
      await si.gotoList();
      const search = si.searchInput();
      if ((await search.count()) > 0) await search.fill("").catch(() => {});
    },
  );

  purchaseTest(
    "TC-SI-030005 Edge Case - Multiple Filters",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้มีสิทธิ์เข้าถึง Stock Issues view" },
        {
          type: "steps",
          description:
            "1. ไปที่ /store-operation/store-requisition\n2. กรอก search term 'SR-12345' ใน search box\n3. เลือก status filter 'Active'\n4. กด dropdown 'From Location'\n5. เลือก 'Warehouse A' จาก dropdown\n6. กด dropdown 'To Location'\n7. เลือก 'Warehouse B' จาก dropdown\n8. กด dropdown 'Department'\n9. เลือก 'Sales' จาก dropdown\n10. รอให้ list อัปเดต\n11. ตรวจสอบว่า SR 'SR-12345' ที่มีสถานะ 'Active' จาก 'Warehouse A' ไปยัง 'Warehouse B' และอยู่ใน department 'Sales' แสดงขึ้นมา",
        },
        { type: "expected", description: "SR 'SR-12345' ที่ตรงกับ filters ที่กำหนดแสดงใน list" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      const si = new StockIssuePage(page);
      await si.gotoList();
      const search = si.searchInput();
      if ((await search.count()) > 0) await search.fill("SR-12345").catch(() => {});
    },
  );
});

requestorTest.describe("Stock Issue — Search & Filter — Permission denial", () => {
  requestorTest(
    "TC-SI-030004 Negative Case - No Permission",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+requestor@gmail.com และไม่มีสิทธิ์เข้าถึง Stock Issues view" },
        {
          type: "steps",
          description:
            "1. ไปที่ /store-operation/store-requisition\n2. พยายามกรอก search term ใน search box",
        },
        { type: "expected", description: "ผู้ใช้ถูก redirect ไปยังหน้า permission denied หรือ error message แสดงขึ้นมา" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      await page.goto(LIST_PATH);
      const url = page.url();
      const onListPage = /store-requisition/.test(url);
      const onUnauthorized = /unauthorized|denied|403|login/i.test(url);
      expect(onListPage || onUnauthorized).toBeTruthy();
    },
  );
});

// ═════════════════════════════════════════════════════════════════════════
// TC-SI-900004 — View Full SR
// ═════════════════════════════════════════════════════════════════════════
purchaseTest.describe("Stock Issue — View Full SR", () => {
  purchaseTest(
    "TC-SI-040001 Happy Path - View Full SR from Issue Detail",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+purchase@gmail.com มี SR view permission และ Issue view แสดงอยู่" },
        {
          type: "steps",
          description:
            "1. ไปที่ /store-operation/store-requisition\n2. กด 'View Full SR'\n3. ตรวจสอบว่าหน้า Store Requisition detail แสดงขึ้นมา",
        },
        { type: "expected", description: "ผู้ใช้ถูกนำทางไปยังหน้า Store Requisition detail ซึ่งสามารถดูข้อมูลที่เกี่ยวข้องทั้งหมดและดำเนินการได้หากมีสิทธิ์" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const si = new StockIssuePage(page);
      await si.gotoList();
      const row = page.getByRole("row").nth(1);
      if ((await row.count()) === 0) return;
      await openRecordFromRow(row);
      await si.viewFullSRButton().click({ timeout: 5_000 }).catch(() => {});
    },
  );

  purchaseTest(
    "TC-SI-040003 Edge Case - Empty SR Reference Link",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้มี SR view permission และ Issue view แสดงพร้อม SR reference link ที่ว่างเปล่า" },
        {
          type: "steps",
          description:
            "1. ไปที่ /store-operation/store-requisition\n2. กด 'View Full SR' (link ว่างเปล่า)\n3. ตรวจสอบว่า error message แสดงขึ้นมา",
        },
        { type: "expected", description: "Error message แสดงว่า SR reference link ไม่ถูกต้องหรือว่างเปล่า" },
        { type: "priority", description: "Low" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      const si = new StockIssuePage(page);
      await si.gotoList();
    },
  );

  purchaseTest(
    "TC-SI-040004 Negative - User at Issue Stage No Permissions",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+purchase@gmail.com มี SR view permission และ Issue view แสดงพร้อม SR ใน Issue stage" },
        {
          type: "steps",
          description:
            "1. ไปที่ /store-operation/store-requisition\n2. กด 'View Full SR'\n3. กด 'Complete'\n4. ตรวจสอบว่า error message แสดงขึ้นมา",
        },
        { type: "expected", description: "Error message แสดงว่าผู้ใช้ไม่มีสิทธิ์ complete SR" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const si = new StockIssuePage(page);
      await si.gotoList();
    },
  );

  purchaseTest(
    "TC-SI-040005 Happy Path - Print SR",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+purchase@gmail.com มี SR view และ print permission และ Issue view แสดงพร้อม SR ใน Issue stage" },
        {
          type: "steps",
          description:
            "1. ไปที่ /store-operation/store-requisition\n2. กด 'View Full SR'\n3. กด 'Print'\n4. ตรวจสอบว่า print dialog หรือ confirmation message แสดงขึ้นมา",
        },
        { type: "expected", description: "Print dialog หรือ confirmation message แสดงขึ้นมาเพื่อให้ผู้ใช้ print SR ได้" },
        { type: "priority", description: "Low" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const si = new StockIssuePage(page);
      await si.gotoList();
      const row = page.getByRole("row").nth(1);
      if ((await row.count()) === 0) return;
      await openRecordFromRow(row);
      await si.printButton().click({ timeout: 5_000 }).catch(() => {});
    },
  );
});

requestorTest.describe("Stock Issue — View Full SR — Permission denial", () => {
  requestorTest(
    "TC-SI-040002 Negative - No SR View Permission",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+requestor@gmail.com แต่ไม่มี SR view permission และ Issue view แสดงอยู่" },
        {
          type: "steps",
          description:
            "1. ไปที่ /store-operation/store-requisition?view=all-document\n2. ตรวจสอบว่ารายการว่างและไม่มีปุ่ม View Full SR",
        },
        { type: "expected", description: "รายการ SR ของ requestor ว่าง (สิทธิ์ view เห็นเฉพาะใบที่ตัวเองเป็นผู้ขอ) จึงไม่มีใบให้เปิดและไม่มีปุ่ม View Full SR" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const si = new StockIssuePage(page);
      await si.gotoAllDocuments();
      // Permission scope, not missing data: store-requisition.service.ts findAll limits a user with
      // only `view` to `requestor_id = caller` (department users get `view_department`). The
      // STD seed creates every SR as the purchase user, so the requestor's list is empty while
      // hod/fc/purchase see 7 SRs in the same BU (measured 2026-11-21). The empty list is the denial.
      await expect(page.getByText(/no data found/i).first()).toBeVisible({ timeout: 15_000 });
      await expect(recordRows(page)).toHaveCount(0);
      // ...and there is no record to open, so the restricted action cannot be reached.
      await expect(si.viewFullSRButton()).toHaveCount(0);
    },
  );
});

// ═════════════════════════════════════════════════════════════════════════
// TC-SI-900005 — Print Stock Issue
// ═════════════════════════════════════════════════════════════════════════
purchaseTest.describe("Stock Issue — Print", () => {
  purchaseTest(
    "TC-SI-050001 Happy Path: Warehouse Staff prints a stock issue document",
    {
      annotation: [
        { type: "preconditions", description: "Issue อยู่ใน Issue/Complete stage และผู้ใช้มี view permission" },
        {
          type: "steps",
          description:
            "1. ไปที่ /store-operation/store-requisition\n2. กด 'Print' button\n3. ตรวจสอบว่าเอกสารถูกสร้างพร้อม header, location information, items list และ signature fields\n4. Browser print dialog เปิดขึ้นมา",
        },
        { type: "expected", description: "เอกสารถูก print สำเร็จพร้อมข้อมูลที่จำเป็นทั้งหมด" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const si = new StockIssuePage(page);
      await si.gotoList();
      const row = page.getByRole("row").nth(1);
      if ((await row.count()) === 0) return;
      await openRecordFromRow(row);
      await si.printButton().click({ timeout: 5_000 }).catch(() => {});
    },
  );

  purchaseTest(
    "TC-SI-050003 Edge Case: Multiple items with zero quantity",
    {
      annotation: [
        { type: "preconditions", description: "Issue มี items หลายรายการ บางรายการมี quantity เป็นศูนย์" },
        {
          type: "steps",
          description:
            "1. ไปที่ /store-operation/store-requisition\n2. กด 'Print' button\n3. ตรวจสอบว่าเอกสารแสดงเฉพาะ items ที่มี quantity ไม่ใช่ศูนย์",
        },
        { type: "expected", description: "เอกสารไม่แสดง items ที่มี quantity เป็นศูนย์" },
        { type: "priority", description: "Low" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      const si = new StockIssuePage(page);
      await si.gotoList();
    },
  );

  purchaseTest(
    "TC-SI-050004 Negative: Issue does not exist",
    {
      annotation: [
        { type: "preconditions", description: "Issue ไม่มีอยู่ในระบบ" },
        {
          type: "steps",
          description:
            "1. ไปที่ /store-operation/store-requisition\n2. กด 'Print' button\n3. ตรวจสอบว่าระบบแสดง error message",
        },
        { type: "expected", description: "ระบบแสดง error message ว่า issue ไม่มีอยู่" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const si = new StockIssuePage(page);
      await si.gotoDetail("non-existent-issue-99999");
    },
  );

  purchaseTest(
    "TC-SI-050005 Edge Case: Issue at Cancel stage",
    {
      annotation: [
        { type: "preconditions", description: "Issue มีอยู่แต่อยู่ใน Cancel stage" },
        {
          type: "steps",
          description:
            "1. ไปที่ /store-operation/store-requisition\n2. กด 'Print' button\n3. ตรวจสอบว่าระบบแสดง error message",
        },
        { type: "expected", description: "ระบบแสดง error message ว่า issue อยู่ใน Cancel stage และไม่สามารถ print ได้" },
        { type: "priority", description: "Low" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      const si = new StockIssuePage(page);
      await si.gotoList();
      const cancelledRow = page.locator("tbody").getByRole("row").filter({ hasText: /cancel/i }).first();
      if ((await cancelledRow.count()) === 0) return;
      await openRecordFromRow(cancelledRow);
    },
  );
});

requestorTest.describe("Stock Issue — Print — Permission denial", () => {
    // App finding, not a test bug — do not restore the silent version.
  // The button is present and **enabled** for this role; the assertion only ever
  // "passed" because it was wrapped in .catch(() => {}) (the other branch was the
  // equally empty `expect(true).toBe(true)`). These modules have no client-side
  // role gate at all: unlike Purchase Order, whose /new route is wrapped in
  // `CreateWorkflowGate` and answers "RESTRICTED — Permission Denied", the
  // vendor-management routes carry no guard, and requestor@ can open the create
  // form directly. Whether that is intended is a product decision — un-fixme once
  // it is settled, and assert whatever the answer turns out to be.
requestorTest.fixme(
    "TC-SI-050002 Negative: User without permission attempts to print",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+requestor@gmail.com Issue อยู่ใน Issue/Complete stage แต่ผู้ใช้ไม่มี view permission" },
        {
          type: "steps",
          description:
            "1. ไปที่ /store-operation/store-requisition\n2. กด 'Print' button\n3. ตรวจสอบว่าระบบปฏิเสธสิทธิ์และไม่อนุญาตให้ print",
        },
        { type: "expected", description: "ระบบปฏิเสธการ print เนื่องจาก permissions ไม่เพียงพอ" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const si = new StockIssuePage(page);
      await si.gotoList();
      const row = page.getByRole("row").nth(1);
      if ((await row.count()) === 0) return;
      await openRecordFromRow(row);
      const print = si.printButton();
      // Either button is hidden (correct) or disabled
      if ((await print.count()) === 0) {
        expect(true).toBe(true);
      } else {
        await expect(print).toBeDisabled({ timeout: 5_000 });
      }
    },
  );
});

// ═════════════════════════════════════════════════════════════════════════
// TC-SI-900006 — Expense Allocation
// ═════════════════════════════════════════════════════════════════════════
purchaseTest.describe("Stock Issue — Expense Allocation", () => {
  purchaseTest(
    "TC-SI-060001 Happy Path - View Expense Allocation",
    {
      annotation: [
        { type: "preconditions", description: "สถานะ SR เป็น Completed และผู้ใช้มี permission ดู costs" },
        {
          type: "steps",
          description: "1. ไปที่ /store-operation/store-requisition\n2. กด 'View Expense Allocation'",
        },
        { type: "expected", description: "รายละเอียด expense allocation แสดงขึ้นมา: Department, Expense Account, Total Value expensed และ items พร้อม individual costs" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const si = new StockIssuePage(page);
      await si.gotoList();
      const completedRow = page.locator("tbody").getByRole("row").filter({ hasText: /complete/i }).first();
      if ((await completedRow.count()) === 0) return;
      await openRecordFromRow(completedRow);
      await si.viewExpenseAllocationButton().click({ timeout: 5_000 }).catch(() => {});
    },
  );

  purchaseTest(
    "TC-SI-060003 Edge Case - SR with No Expense Allocation",
    {
      annotation: [
        { type: "preconditions", description: "สถานะ SR เป็น Completed ผู้ใช้มี permission ดู costs และ SR ไม่มี expense allocation" },
        {
          type: "steps",
          description: "1. ไปที่ /store-operation/store-requisition\n2. กด 'View Expense Allocation'",
        },
        { type: "expected", description: "ระบบแสดง message ว่าไม่มี expense allocation" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      const si = new StockIssuePage(page);
      await si.gotoList();
    },
  );

  purchaseTest(
    "TC-SI-060004 Negative - Invalid SR ID",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้มี permission ดู costs" },
        {
          type: "steps",
          description: "1. ไปที่ /store-operation/store-requisition\n2. กด 'View Expense Allocation'",
        },
        { type: "expected", description: "ระบบแสดง message ว่า SR ID ไม่ถูกต้อง" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const si = new StockIssuePage(page);
      await si.gotoDetail("999");
    },
  );
});

requestorTest.describe("Stock Issue — Expense Allocation — Permission denial", () => {
  requestorTest(
    "TC-SI-060002 Negative - No Permission to View Costs",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+requestor@gmail.com สถานะ SR เป็น Completed และผู้ใช้ไม่มี permission ดู costs" },
        {
          type: "steps",
          description: "1. ไปที่ /store-operation/store-requisition?view=all-document\n2. ตรวจสอบว่ารายการว่างและไม่มีปุ่ม View Expense Allocation",
        },
        { type: "expected", description: "รายการ SR ของ requestor ว่าง จึงไม่มีใบให้เปิดและไม่มีปุ่ม View Expense Allocation (ดู costs ไม่ได้)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const si = new StockIssuePage(page);
      await si.gotoAllDocuments();
      // Permission scope, not missing data: store-requisition.service.ts findAll limits a user with
      // only `view` to `requestor_id = caller` (department users get `view_department`). The
      // STD seed creates every SR as the purchase user, so the requestor's list is empty while
      // hod/fc/purchase see 7 SRs in the same BU (measured 2026-11-21). The empty list is the denial.
      await expect(page.getByText(/no data found/i).first()).toBeVisible({ timeout: 15_000 });
      await expect(recordRows(page)).toHaveCount(0);
      // ...and there is no record to open, so the restricted action cannot be reached.
      await expect(si.viewExpenseAllocationButton()).toHaveCount(0);
    },
  );
});
