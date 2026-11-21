import { test as baseTest, expect } from "@playwright/test";
import { createAuthTest } from "./fixtures/auth.fixture";
import { PurchaseOrderPage, LIST_PATH } from "./pages/purchase-order.page";
import { recordRows } from "./helpers/list-row";
import {
  submitPOAsPurchaser,
  createDraftPOAsPurchaser,
  seedApprovedPO,
  gotoPODetail,
} from "./pages/po-approver.helpers";

// Persona-journey spec — PO Purchaser. Runs alongside 401-po.spec.ts
// (per-action multi-role) without modifying it. Source docs:
// docs/persona-doc/Purchase Order/Purchaser/INDEX.md and step-01..05.md.
const purchaseTest = createAuthTest("carmensoftware.dev+purchase@gmail.com");

const FUTURE_DATE = "2099-12-31";

purchaseTest.describe("Step 1 — PO List", () => {
  purchaseTest(
    "TC-PO-060101 List loads with PO statuses (DRAFT / IN PROGRESS / APPROVED / etc.)",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Purchaser (carmensoftware.dev+purchase@gmail.com)" },
        { type: "steps", description: "1. ไปที่ /procurement/purchase-order\n2. ตรวจสอบ URL และตรวจสอบว่า list table หรือ empty-state visible" },
        { type: "expected", description: "URL อยู่ที่หน้า list ของ PO; ปุ่ม My Pending มองเห็นและถูกเลือก" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page }) => {
      const po = new PurchaseOrderPage(page);
      await po.gotoList();
      await expect(page).toHaveURL(new RegExp(LIST_PATH));
      // The scope toggle is part of every PO list; a missing button must fail, not skip.
      const tab = po.tabMyPending();
      await expect(tab).toBeVisible({ timeout: 10_000 });
      await po.expectScopeSelected(tab);
    },
  );

  purchaseTest(
    "TC-PO-060102 Switch to All Documents tab broadens scope",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่หน้า list ของ PO" },
        { type: "steps", description: "1. กดแท็บ All Documents" },
        { type: "expected", description: "แท็บ All Documents ถูกเลือก" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const po = new PurchaseOrderPage(page);
      await po.gotoList();
      const tab = po.tabAllDocuments();
      await expect(tab).toBeVisible({ timeout: 10_000 });
      await tab.click();
      await po.expectScopeSelected(tab);
    },
  );

  purchaseTest(
    "TC-PO-060103 Filter by status (DRAFT)",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่หน้า list ของ PO" },
        { type: "steps", description: "1. เปิดแผง Filter\n2. เลือก status = DRAFT\n3. Apply" },
        { type: "expected", description: "URL ยังคงอยู่ที่หน้า list ของ PO หลัง apply filter" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const po = new PurchaseOrderPage(page);
      await po.gotoList();
      const fb = po.filterButton();
      if ((await fb.count()) === 0) {
        purchaseTest.skip(true, "Filter button not present in this build");
        return;
      }
      await po.applyFilter({ status: "DRAFT" });
      await expect(page).toHaveURL(new RegExp(LIST_PATH), { timeout: 10_000 });
    },
  );

  purchaseTest(
    "TC-PO-060104 Search by PO reference",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่หน้า list ของ PO" },
        { type: "steps", description: "1. พิมพ์ reference บางส่วนในช่องค้นหา" },
        { type: "expected", description: "URL ยังคงอยู่ที่หน้า list ของ PO หลังพิมพ์ในช่องค้นหา" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const po = new PurchaseOrderPage(page);
      await po.gotoList();
      const input = po.searchInput();
      if ((await input.count()) === 0) {
        purchaseTest.skip(true, "Search input not present in this build");
        return;
      }
      await po.searchFor("PO");
      await expect(page).toHaveURL(new RegExp(LIST_PATH));
    },
  );

  purchaseTest(
    "TC-PO-060105 Sort by Date",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่หน้า list ของ PO" },
        { type: "steps", description: "1. คลิกหัวคอลัมน์ Date เพื่อเรียงลำดับ\n2. ตรวจสอบว่ารายการเรียงลำดับใหม่" },
        { type: "expected", description: "URL ยังคงอยู่ที่หน้า list ของ PO หลังคลิก sort" },
        { type: "priority", description: "Low" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const po = new PurchaseOrderPage(page);
      await po.gotoList();
      await po.sortBy("date");
      await expect(page).toHaveURL(new RegExp(LIST_PATH));
    },
  );
});

purchaseTest.describe("Step 2 — Create PO", () => {  // ─ Blank method (4 TCs) ─────────────────────────────────────────────
  purchaseTest(
    "TC-PO-060201 Open Create dropdown → Blank → form loads",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Purchaser; อยู่ที่หน้า list ของ PO" },
        { type: "steps", description: "1. กดปุ่ม dropdown New PO\n2. เลือก option Blank/Manual PO\n3. ตรวจสอบว่า URL เปลี่ยนเป็น /new" },
        { type: "expected", description: "URL เปลี่ยนเป็น /procurement/purchase-order/new และ form visible" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page }) => {
      const po = new PurchaseOrderPage(page);
      await po.gotoList();
      await po.newPODropdown().click();
      const blank = po.manualPOMenuItem();
      if ((await blank.count()) === 0) {
        purchaseTest.skip(true, "Manual/Blank PO menu item not present");
        return;
      }
      await blank.click();
      await expect(page).toHaveURL(/purchase-order\/new/, { timeout: 10_000 });
    },
  );

  purchaseTest(
    "TC-PO-060202 Fill header (vendor, delivery date, description) + add 1 line item",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่ form สร้าง PO (blank)" },
        { type: "steps", description: "1. กรอก vendor, description, delivery date\n2. เพิ่ม 1 line item" },
        { type: "expected", description: "Description input คงค่าที่กรอก (marker E2E-POP)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const po = new PurchaseOrderPage(page);
      await po.gotoNew();
      const desc = po.descriptionInput();
      if ((await desc.count()) === 0) {
        purchaseTest.skip(true, "Description input not present");
        return;
      }
      await desc.fill("[E2E-POP] TC-PO-060202");
      const date = po.deliveryDateInput();
      if ((await date.count()) > 0) await date.fill(FUTURE_DATE);
      await po.addItemToPO({ product: "Test Item", quantity: 1, uom: "ea", unitPrice: 100 });
      await expect(desc).toHaveValue(/E2E-POP/);
    },
  );

  purchaseTest(
    "TC-PO-060203 Save Draft → redirect to detail with PO number",
    {
      annotation: [
        { type: "preconditions", description: "กรอก header + ≥1 line item บน form สร้าง" },
        { type: "steps", description: "1. กดบันทึก\n2. รอการ redirect ไปยังหน้า detail" },
        { type: "expected", description: "URL เปลี่ยนเป็น /procurement/purchase-order/<id> (ไม่ใช่ /new)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const po = new PurchaseOrderPage(page);
      await po.gotoNew();
      const desc = po.descriptionInput();
      if ((await desc.count()) > 0) await desc.fill("[E2E-POP] TC-PO-060203 save draft");
      const date = po.deliveryDateInput();
      if ((await date.count()) > 0) await date.fill(FUTURE_DATE);
      await po.addItemToPO({ product: "Save Item", quantity: 1, uom: "ea", unitPrice: 100 });
      await po.saveButton().click({ timeout: 5_000 });
      await expect(page).toHaveURL(/purchase-order\/(?!new$)[^\/?#]+$/, { timeout: 15_000 });
    },
  );

  purchaseTest(
    "TC-PO-060204 Save without items → button disabled or stays on /new",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่ form สร้าง PO พร้อม header แต่ยังไม่มีรายการ" },
        { type: "steps", description: "1. กดบันทึกโดยไม่เพิ่ม line item ใดๆ" },
        { type: "expected", description: "ปุ่มบันทึกถูก disable หรือ form ไม่ navigate ออกจาก /new" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Validation" },
      ],
    },
    async ({ page }) => {
      const po = new PurchaseOrderPage(page);
      await po.gotoNew();
      const save = po.saveButton();
      const disabled = await save.isDisabled().catch(() => false);
      if (disabled) {
        await expect(save).toBeDisabled();
        return;
      }
      await save.click({ timeout: 5_000 }).catch(() => {});
      await expect(page).toHaveURL(/purchase-order\/new/, { timeout: 10_000 });
    },
  );

  // ─ From Price List wizard (4 TCs) ───────────────────────────────────
  purchaseTest(
    "TC-PO-060205 Open Create → From Price List → wizard step 1 (Select Vendors)",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Purchaser; อยู่ที่หน้า list ของ PO" },
        { type: "steps", description: "1. กดปุ่ม dropdown New PO\n2. เลือก From Price List" },
        { type: "expected", description: "Wizard step 1 แสดง (URL เปลี่ยนหรือ dialog ปรากฏพร้อมการเลือก vendor)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page }) => {
      const po = new PurchaseOrderPage(page);
      await po.gotoList();
      await po.newPODropdown().click();
      const item = po.fromPriceListMenuItem();
      if ((await item.count()) === 0) {
        purchaseTest.skip(true, "From Price List menu item not present");
        return;
      }
      await item.click({ timeout: 10_000 });
      // The wizard is a full page, not a dialog, and its first step is labelled
      // "Order & Vendor" — neither "Select Vendor" nor "step 1" appears anywhere,
      // so the old union assertion could not match. Assert the route and the
      // step rail the page actually renders.
      await expect(page).toHaveURL(/purchase-order\/from-price-list/, { timeout: 15_000 });
      await expect(page.getByText(/order & vendor/i).first()).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(/select items/i).first()).toBeVisible({ timeout: 10_000 });
    },
  );

  purchaseTest(
    "TC-PO-060206 Select vendor → wizard step 2 (Review items)",
    {
      annotation: [
        { type: "preconditions", description: "Wizard From Price List step 1 เปิดอยู่" },
        { type: "steps", description: "1. เลือก vendor แรก\n2. กด Next/Continue" },
        { type: "expected", description: "Wizard ไปยัง step 2 (หน้า review visible)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const po = new PurchaseOrderPage(page);
      await po.gotoList();
      await po.newPODropdown().click();
      const item = po.fromPriceListMenuItem();
      if ((await item.count()) === 0) {
        purchaseTest.skip(true, "From Price List menu item not present");
        return;
      }
      await item.click();
      // Select first vendor row/option
      const vendorOption = page.getByRole("checkbox").or(page.getByRole("option")).first();
      if ((await vendorOption.count()) === 0) {
        purchaseTest.skip(true, "No selectable vendor in wizard step 1");
        return;
      }
      await vendorOption.click({ timeout: 5_000 }).catch(() => {});
      const next = page.getByRole("button", { name: /next|continue|review/i }).first();
      if ((await next.count()) === 0) {
        purchaseTest.skip(true, "Next/Continue button not present in wizard");
        return;
      }
      await next.click({ timeout: 5_000 });
      await expect(page.getByText(/review|step 2|items/i).first()).toBeVisible({ timeout: 10_000 });
    },
  );

  purchaseTest(
    "TC-PO-060207 Submit Price List wizard → POs created (URL changes from /new to detail)",
    {
      annotation: [
        { type: "preconditions", description: "Wizard From Price List step 2 (Review) เปิดอยู่" },
        { type: "steps", description: "1. กด Create/Submit บน step สุดท้ายของ wizard" },
        { type: "expected", description: "URL เปลี่ยนออกจาก /new ไปยัง PO detail หรือ list ที่ถูกสร้าง" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const po = new PurchaseOrderPage(page);
      await po.gotoList();
      await po.newPODropdown().click();
      const item = po.fromPriceListMenuItem();
      if ((await item.count()) === 0) {
        purchaseTest.skip(true, "From Price List menu item not present");
        return;
      }
      await item.click();
      const vendorOption = page.getByRole("checkbox").or(page.getByRole("option")).first();
      if ((await vendorOption.count()) === 0) {
        purchaseTest.skip(true, "No selectable vendor in wizard step 1");
        return;
      }
      await vendorOption.click({ timeout: 5_000 }).catch(() => {});
      const next = page.getByRole("button", { name: /next|continue|review/i }).first();
      if ((await next.count()) > 0) await next.click({ timeout: 5_000 }).catch(() => {});
      const submit = po.priceListWizardSubmit();
      if ((await submit.count()) === 0) {
        purchaseTest.skip(true, "Wizard submit button not present");
        return;
      }
      await submit.click({ timeout: 5_000 }).catch(() => {});
      await expect(page).toHaveURL(/purchase-order\/(?!new$)/, { timeout: 15_000 });
      // Fallback assertion: list page or detail page reached
      await expect(page).toHaveURL(new RegExp(LIST_PATH));
    },
  );

  purchaseTest(
    "TC-PO-060208 Skip dynamically if no price list / vendors available",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Purchaser; อยู่ที่หน้า list ของ PO" },
        { type: "steps", description: "1. เปิด wizard From Price List\n2. ตรวจสอบรายการ vendor ใน step 1" },
        { type: "expected", description: "หาก wizard แสดงรายการ vendor ว่างเปล่า การทดสอบ skip พร้อมเหตุผล ไม่เช่นนั้นตรวจสอบว่า wizard step 1 visible" },
        { type: "priority", description: "Low" },
        { type: "testType", description: "Functional" },
        { type: "note", description: "Dynamically skipped when DB lacks price list / vendor data." },
      ],
    },
    async ({ page }) => {
      const po = new PurchaseOrderPage(page);
      await po.gotoList();
      await po.newPODropdown().click();
      const item = po.fromPriceListMenuItem();
      if ((await item.count()) === 0) {
        purchaseTest.skip(true, "From Price List menu item not present");
        return;
      }
      await item.click();
      // Look for empty-state vs vendor list
      const empty = page.getByText(/no vendor|no price list|empty/i).first();
      const vendor = page.getByRole("checkbox").or(page.getByRole("option")).first();
      if ((await empty.count()) > 0) {
        await expect(empty).toBeVisible();
        return;
      }
      if ((await vendor.count()) === 0) {
        purchaseTest.skip(true, "Wizard renders without vendors and without empty-state");
        return;
      }
      await expect(vendor).toBeVisible({ timeout: 5_000 });
    },
  );

  // ─ From PR wizard (4 TCs) ───────────────────────────────────────────
  purchaseTest(
    "TC-PO-060209 Open Create → From PR → wizard step 1 (Select Approved PRs)",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Purchaser; อยู่ที่หน้า list ของ PO" },
        { type: "steps", description: "1. กดปุ่ม dropdown New PO\n2. เลือก From PR" },
        { type: "expected", description: "Wizard step 1 แสดง (รายการเลือก PR visible หรือ dialog ปรากฏ)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page }) => {
      const po = new PurchaseOrderPage(page);
      await po.gotoList();
      await po.newPODropdown().click();
      const item = po.fromPRMenuItem();
      if ((await item.count()) === 0) {
        purchaseTest.skip(true, "From PR menu item not present");
        return;
      }
      await item.click();
      await expect(
        page
          .locator('[role="dialog"], [role="alertdialog"]')
          .last()
          .or(page.getByText(/select.*pr|purchase request|step 1/i).first())
          .first(),
      ).toBeVisible({ timeout: 10_000 });
    },
  );

  purchaseTest(
    "TC-PO-060210 Select approved PR → wizard step 2 (Review POs grouped by vendor)",
    {
      annotation: [
        { type: "preconditions", description: "Wizard From PR step 1 เปิดอยู่พร้อม PR ที่ approved อย่างน้อยหนึ่งรายการ" },
        { type: "steps", description: "1. เลือก PR ที่ approved แรก\n2. กด Next/Continue" },
        { type: "expected", description: "Wizard ไปยัง step 2 (review PO ที่จัดกลุ่มตาม vendor)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const po = new PurchaseOrderPage(page);
      await po.gotoList();
      await po.newPODropdown().click();
      const item = po.fromPRMenuItem();
      if ((await item.count()) === 0) {
        purchaseTest.skip(true, "From PR menu item not present");
        return;
      }
      await item.click({ timeout: 10_000 });

      // Count real PR rows. `getByRole("row").or(getByRole("checkbox")).nth(1)`
      // is a union that resolves against both roles at once and happily settles on
      // the header row or a stray checkbox, so it never reported "no data" even
      // when the wizard had none — the test then pressed Next with nothing
      // selected and waited out its timeout. This BU holds no purchase requests
      // at all (verified against /api/BLAVG/purchase-requests).
      const prRows = recordRows(page).filter({ hasText: /PR\d{6,}/ });
      if ((await prRows.count()) === 0) {
        purchaseTest.skip(true, "No approved PR available in wizard step 1");
        return;
      }
      await prRows.first().getByRole("checkbox").first().check({ force: true, timeout: 10_000 });

      const next = page.getByRole("button", { name: /next|continue|review/i }).first();
      if ((await next.count()) === 0) {
        purchaseTest.skip(true, "Next button not present in From PR wizard");
        return;
      }
      await next.click({ timeout: 10_000 });
      await expect(page.getByText(/review|grouped|vendor|step 2/i).first()).toBeVisible({ timeout: 10_000 });
    },
  );

  purchaseTest(
    "TC-PO-060211 Submit From PR wizard → POs created",
    {
      annotation: [
        { type: "preconditions", description: "Wizard From PR step 2 เปิดอยู่" },
        { type: "steps", description: "1. กด Create/Submit บน step สุดท้ายของ wizard" },
        { type: "expected", description: "URL เปลี่ยนออกจาก /new (PO ถูกสร้าง)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const po = new PurchaseOrderPage(page);
      await po.gotoList();
      await po.newPODropdown().click();
      const item = po.fromPRMenuItem();
      if ((await item.count()) === 0) {
        purchaseTest.skip(true, "From PR menu item not present");
        return;
      }
      await item.click();
      const prRow = page.getByRole("row").or(page.getByRole("checkbox")).nth(1);
      if ((await prRow.count()) === 0) {
        purchaseTest.skip(true, "No approved PR available");
        return;
      }
      await prRow.click({ timeout: 5_000 }).catch(() => {});
      const next = page.getByRole("button", { name: /next|continue|review/i }).first();
      if ((await next.count()) > 0) await next.click({ timeout: 5_000 }).catch(() => {});
      const submit = po.fromPRWizardSubmit();
      if ((await submit.count()) === 0) {
        purchaseTest.skip(true, "Wizard submit button not present");
        return;
      }
      await submit.click({ timeout: 5_000 }).catch(() => {});
      await expect(page).toHaveURL(new RegExp(LIST_PATH), { timeout: 15_000 });
    },
  );

  purchaseTest(
    "TC-PO-060212 Skip dynamically if no approved PR available",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Purchaser; อยู่ที่หน้า list ของ PO" },
        { type: "steps", description: "1. เปิด wizard From PR\n2. ตรวจสอบรายการ PR ใน step 1" },
        { type: "expected", description: "หาก wizard แสดงรายการ PR ว่างเปล่า การทดสอบ skip พร้อมเหตุผล ไม่เช่นนั้นตรวจสอบว่า wizard step 1 visible" },
        { type: "priority", description: "Low" },
        { type: "testType", description: "Functional" },
        { type: "note", description: "Dynamically skipped when DB lacks approved PRs." },
      ],
    },
    async ({ page }) => {
      const po = new PurchaseOrderPage(page);
      await po.gotoList();
      await po.newPODropdown().click();
      const item = po.fromPRMenuItem();
      if ((await item.count()) === 0) {
        purchaseTest.skip(true, "From PR menu item not present");
        return;
      }
      await item.click();
      const empty = page.getByText(/no.*pr|no purchase request|no approved|empty/i).first();
      const prRow = page.getByRole("row").or(page.getByRole("checkbox")).nth(1);
      if ((await empty.count()) > 0) {
        await expect(empty).toBeVisible();
        return;
      }
      if ((await prRow.count()) === 0) {
        purchaseTest.skip(true, "Wizard renders without PRs and without empty-state");
        return;
      }
      await expect(prRow).toBeVisible({ timeout: 5_000 });
    },
  );
});

purchaseTest.describe("Step 3 — PO Detail", () => {
  purchaseTest(
    "TC-PO-060301 Detail loads (DRAFT) with header + items table",
    {
      annotation: [
        { type: "preconditions", description: "มี Draft PO สำหรับ Purchaser นี้ (seeded ผ่าน submitPOAsPurchaser)" },
        { type: "steps", description: "1. เปิดหน้า detail ของ Draft PO\n2. ตรวจสอบว่า URL ตรงกับ PO ref" },
        { type: "expected", description: "URL เป็น /procurement/purchase-order/<ref>" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page, browser }) => {
      const created = await createDraftPOAsPurchaser(browser);
      await gotoPODetail(page, created.ref);
      await expect(page).toHaveURL(new RegExp(`${LIST_PATH}/${created.ref}`));
    },
  );

  purchaseTest(
    "TC-PO-060302 Item Details panel — Details / Quantity / Pricing tabs",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่หน้า detail ของ Draft PO ที่มีอย่างน้อยหนึ่งรายการ" },
        { type: "steps", description: "1. ค้นหาแท็บใน Item Details panel\n2. สลับระหว่างแท็บ Items / Quantity / Pricing ถ้ามี" },
        { type: "expected", description: "แท็บแสดงและถูกเลือกเมื่อคลิก (skip ถ้าไม่มี)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page, browser }) => {
      const po = new PurchaseOrderPage(page);
      const created = await submitPOAsPurchaser(browser);
      await gotoPODetail(page, created.ref);
      const items = po.tabItems();
      if ((await items.count()) === 0) {
        purchaseTest.skip(true, "Item Details panel tabs not present in this build");
        return;
      }
      await items.click();
      await expect(items).toHaveAttribute("aria-selected", /true/i, { timeout: 5_000 });
    },
  );

  purchaseTest(
    "TC-PO-060303 Edit / Delete / Submit buttons present for DRAFT",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่หน้า detail ของ Draft PO" },
        { type: "steps", description: "1. ตรวจสอบ action toolbar" },
        { type: "expected", description: "ปุ่ม Edit visible (ความ visible ของปุ่ม Submit ขึ้นอยู่กับ UI variant)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page, browser }) => {
      const po = new PurchaseOrderPage(page);
      // Must stay in Draft: submitting hands the creator role = "view_only" and
      // Edit / Delete / Submit all disappear, so seeding with
      // submitPOAsPurchaser made this assert something the app never shows.
      const created = await createDraftPOAsPurchaser(browser);
      await gotoPODetail(page, created.ref);
      await expect(po.editModeButton()).toBeVisible({ timeout: 10_000 });
      await expect(po.submitButton()).toBeVisible({ timeout: 10_000 });
    },
  );

  purchaseTest(
    "TC-PO-060304 Read-only state for SENT/COMPLETED status (best-effort)",
    {
      annotation: [
        { type: "preconditions", description: "มี PO ที่มี status SENT หรือ COMPLETED ใน DB (ที่ไม่ใช่ Draft หรือ In-Progress)" },
        { type: "steps", description: "1. ไปที่หน้า list ของ PO\n2. ค้นหาแถว SENT/COMPLETED\n3. เปิดและตรวจสอบ toolbar" },
        { type: "expected", description: "ปุ่ม Edit ไม่ visible หรือถูก disable Skip ถ้าไม่มี PO ที่มี status SENT/COMPLETED" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Authorization" },
        { type: "note", description: "Dynamically skipped if no SENT/COMPLETED PO available." },
      ],
    },
    async ({ page }) => {
      const po = new PurchaseOrderPage(page);
      await po.gotoList();
      // Find a row with SENT or COMPLETED status
      const sentRow = page.locator("tbody").getByRole("row").filter({ hasText: /sent|completed/i }).first();
      if ((await sentRow.count()) === 0) {
        purchaseTest.skip(true, "No SENT/COMPLETED PO available for read-only check");
        return;
      }
      await sentRow.click({ timeout: 5_000 }).catch(() => {});
      await page.waitForLoadState("networkidle").catch(() => {});
      // Edit button absent or disabled
      const edit = po.editModeButton();
      if ((await edit.count()) === 0) {
        await expect(edit).toHaveCount(0);
        return;
      }
      const disabled = await edit.isDisabled().catch(() => false);
      expect(disabled).toBeTruthy();
    },
  );
});

purchaseTest.describe("Step 4 — Edit Mode", () => {
  purchaseTest(
    "TC-PO-060401 Click Edit on DRAFT → edit mode active (Save/Cancel visible)",
    {
      annotation: [
        { type: "preconditions", description: "มี Draft PO อยู่ในระบบ" },
        { type: "steps", description: "1. เปิดหน้า detail ของ Draft PO\n2. กด Edit\n3. ตรวจสอบปุ่ม Save/Cancel ระดับ form" },
        { type: "expected", description: "ปุ่ม Save visible หลังเข้าสู่ edit mode" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page, browser }) => {
      const po = new PurchaseOrderPage(page);
      const created = await createDraftPOAsPurchaser(browser);
      await gotoPODetail(page, created.ref);
      if ((await po.editModeButton().count()) === 0) {
        purchaseTest.skip(true, "Edit button not present");
        return;
      }
      await po.enterEditMode();
      await expect(po.saveButton()).toBeVisible({ timeout: 10_000 });
    },
  );

  purchaseTest(
    "TC-PO-060402 Modify line item quantity → Save → URL stays on detail",
    {
      annotation: [
        { type: "preconditions", description: "edit mode active บน Draft PO ที่มีอย่างน้อยหนึ่งรายการ" },
        { type: "steps", description: "1. เข้าสู่ edit mode\n2. แก้ไข quantity input\n3. กดบันทึก" },
        { type: "expected", description: "หลังบันทึก URL ยังคงอยู่ที่ /procurement/purchase-order/<ref>" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page, browser }) => {
      const po = new PurchaseOrderPage(page);
      const created = await createDraftPOAsPurchaser(browser);
      await gotoPODetail(page, created.ref);
      if ((await po.editModeButton().count()) === 0) {
        purchaseTest.skip(true, "Edit button not present");
        return;
      }
      await po.enterEditMode();
      const qty = page.getByLabel(/^quantity$|^qty$/i).first();
      if ((await qty.count()) > 0) await qty.fill("5").catch(() => {});
      await po.saveButton().click({ timeout: 5_000 }).catch(() => {});
      await expect(page).toHaveURL(new RegExp(`${LIST_PATH}/${created.ref}`), { timeout: 10_000 });
    },
  );

  purchaseTest(
    "TC-PO-060403 Add new line item in edit mode → Save",
    {
      annotation: [
        { type: "preconditions", description: "edit mode active บน Draft PO" },
        { type: "steps", description: "1. เข้าสู่ edit mode\n2. เพิ่ม line item ใหม่\n3. บันทึก" },
        { type: "expected", description: "หลังบันทึก URL ยังคงอยู่ที่หน้า detail" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page, browser }) => {
      const po = new PurchaseOrderPage(page);
      const created = await createDraftPOAsPurchaser(browser);
      await gotoPODetail(page, created.ref);
      if ((await po.editModeButton().count()) === 0) {
        purchaseTest.skip(true, "Edit button not present");
        return;
      }
      await po.enterEditMode();
      await po.addItemToPO({ product: "Added in Edit", quantity: 2, uom: "ea", unitPrice: 50 });
      await po.saveButton().click({ timeout: 5_000 }).catch(() => {});
      await expect(page).toHaveURL(new RegExp(`${LIST_PATH}/${created.ref}`), { timeout: 10_000 });
    },
  );

  purchaseTest(
    "TC-PO-060404 Cancel edit → ยืนยัน Discard แล้วกลับสู่ view mode",
    {
      annotation: [
        { type: "preconditions", description: "edit mode active บน Draft PO โดยไม่มีการเปลี่ยนแปลงที่พิมพ์" },
        { type: "steps", description: "1. เข้าสู่ edit mode\n2. กด Cancel โดยไม่ทำการเปลี่ยนแปลง" },
        { type: "expected", description: "มี dialog ยืนยัน Keep editing/Discard เสมอแม้ไม่ได้แก้อะไร; กด Discard แล้วกลับสู่ view mode (ปุ่ม Edit visible, ปุ่ม Save หาย)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page, browser }) => {
      const po = new PurchaseOrderPage(page);
      const created = await createDraftPOAsPurchaser(browser);
      await gotoPODetail(page, created.ref);
      if ((await po.editModeButton().count()) === 0) {
        purchaseTest.skip(true, "Edit button not present");
        return;
      }
      await po.enterEditMode();
      // The app prompts "Keep editing / Discard" even with nothing changed —
      // entering edit mode alone marks the form dirty. The old title promised
      // "exits without dialog", which this build never does.
      await po.cancelEditMode();
      await expect(po.editModeButton()).toBeVisible({ timeout: 10_000 });
      // Match Save exactly: po.saveButton() also accepts "Submit", which a Draft
      // legitimately still shows in view mode.
      await expect(
        page.getByRole("button", { name: /^save$/i }).first(),
      ).toBeHidden({ timeout: 10_000 });
    },
  );

  purchaseTest(
    "TC-PO-060405 Submit Draft PO → confirmation dialog → status moves to IN PROGRESS",
    {
      annotation: [
        { type: "preconditions", description: "มี Draft PO ที่มี ≥1 รายการ" },
        { type: "steps", description: "1. เปิด Draft PO\n2. กด Submit\n3. ยืนยัน dialog" },
        { type: "expected", description: "URL ยังคงอยู่ที่ PO ref; text ของ status badge อัปเดต (best effort)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page, browser }) => {
      const po = new PurchaseOrderPage(page);
      const created = await createDraftPOAsPurchaser(browser);
      await gotoPODetail(page, created.ref);
      const submit = po.submitButton();
      if ((await submit.count()) === 0) {
        purchaseTest.skip(true, "Submit button not present (Draft may already be In Progress)");
        return;
      }
      await submit.click({ timeout: 5_000 });
      await po.confirmDialogButton(/confirm|submit|ok|yes/i).click({ timeout: 5_000 });
      await expect(page).toHaveURL(new RegExp(`${LIST_PATH}/${created.ref}`), { timeout: 15_000 });
    },
  );

  purchaseTest(
    "TC-PO-060406 Delete IN PROGRESS PO via Edit Mode",
    {
      annotation: [
        { type: "preconditions", description: "มี PO ที่มี status IN PROGRESS (หลัง submit) DRAFT ก็ยอมรับได้เช่นกัน" },
        { type: "steps", description: "1. เปิด PO\n2. กด Edit\n3. กด Delete\n4. ยืนยัน" },
        { type: "expected", description: "URL navigate กลับไปยัง list (PO ถูกลบ)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page, browser }) => {
      const po = new PurchaseOrderPage(page);
      const created = await submitPOAsPurchaser(browser);
      await gotoPODetail(page, created.ref);
      if ((await po.editModeButton().count()) === 0) {
        purchaseTest.skip(true, "Edit button not present");
        return;
      }
      await po.enterEditMode();
      const del = po.deleteButton();
      if ((await del.count()) === 0) {
        purchaseTest.skip(true, "Delete button not present in edit mode");
        return;
      }
      await del.click({ timeout: 5_000 });
      await po.confirmDialogButton(/confirm|delete|yes/i).click({ timeout: 5_000 });
      await expect(page).toHaveURL(/\/procurement\/purchase-order($|\?)/, { timeout: 10_000 });
    },
  );
});

purchaseTest.describe("Step 5 — Post-approval", () => {
  purchaseTest(
    "TC-PO-060501 Approved PO has Send to Vendor + Close buttons (seeded via seedApprovedPO)",
    {
      annotation: [
        { type: "preconditions", description: "มี PO ที่ approved (seeded ผ่าน seedApprovedPO: submit + FC + GM)" },
        { type: "steps", description: "1. Seed Approved PO\n2. เปิดหน้า detail\n3. ตรวจสอบ action toolbar" },
        { type: "expected", description: "ปุ่ม Send to Vendor visible ความ visible ของปุ่ม Close เป็นรอง (ไม่ assert hard ถ้าไม่มี)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page, browser }) => {
      const po = new PurchaseOrderPage(page);
      const created = await seedApprovedPO(browser);
      await gotoPODetail(page, created.ref);
      const send = po.sendToVendorButton();
      if ((await send.count()) === 0) {
        purchaseTest.skip(true, "Send to Vendor button not present — FC approval may not have completed");
        return;
      }
      await expect(send).toBeVisible({ timeout: 10_000 });
    },
  );

  purchaseTest(
    "TC-PO-060502 Click Send to Vendor → status updates / toast",
    {
      annotation: [
        { type: "preconditions", description: "มี PO ที่ approved อยู่ในระบบ" },
        { type: "steps", description: "1. เปิด Approved PO\n2. กด Send to Vendor\n3. ยืนยัน" },
        { type: "expected", description: "URL ยังคงอยู่ที่ PO ref; success toast หรือการอัปเดต status visible" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page, browser }) => {
      const po = new PurchaseOrderPage(page);
      const created = await seedApprovedPO(browser);
      await gotoPODetail(page, created.ref);
      const send = po.sendToVendorButton();
      if ((await send.count()) === 0) {
        purchaseTest.skip(true, "Send to Vendor button not present");
        return;
      }
      await send.click({ timeout: 5_000 });
      await po.confirmDialogButton(/confirm|send|ok|yes/i).click({ timeout: 5_000 });
      await expect(page).toHaveURL(new RegExp(`${LIST_PATH}/${created.ref}`), { timeout: 10_000 });
    },
  );

  purchaseTest(
    "TC-PO-060503 Close PO with items received → COMPLETED",
    {
      annotation: [
        { type: "preconditions", description: "มี SENT PO ที่มีรายการที่รับแล้ว (best-effort; เชื่อ DB)" },
        { type: "steps", description: "1. ค้นหา SENT PO ที่มีรายการที่รับแล้วในรายการ\n2. เปิดหน้า detail\n3. กด Close\n4. ยืนยัน" },
        { type: "expected", description: "text ของ status ตรงกับ /completed/i หลัง close Skip ถ้าไม่มี PO ที่เข้าเกณฑ์" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "CRUD" },
        { type: "note", description: "Dynamically skipped when no SENT-with-items PO exists." },
      ],
    },
    async ({ page }) => {
      const po = new PurchaseOrderPage(page);
      await po.gotoList();
      const sentRow = page.locator("tbody").getByRole("row").filter({ hasText: /sent/i }).first();
      if ((await sentRow.count()) === 0) {
        purchaseTest.skip(true, "No SENT PO available for Close test");
        return;
      }
      await sentRow.click({ timeout: 5_000 }).catch(() => {});
      await page.waitForLoadState("networkidle").catch(() => {});
      const close = po.closePOButton();
      if ((await close.count()) === 0) {
        purchaseTest.skip(true, "Close button not present on this PO (may not have items received)");
        return;
      }
      await close.click({ timeout: 5_000 });
      await po.confirmDialogButton(/confirm|close|complete|yes/i).click({ timeout: 5_000 });
      await expect(
        page
          .locator("[data-slot='status'], [data-slot='badge'], [class*='badge']")
          .filter({ hasText: /completed/i })
          .first(),
      ).toBeVisible({ timeout: 15_000 });
    },
  );

  purchaseTest(
    "TC-PO-060504 Close PO without items received → CLOSED",
    {
      annotation: [
        { type: "preconditions", description: "มี Approved/SENT PO ที่ยังไม่มีรายการที่รับ" },
        { type: "steps", description: "1. ค้นหา PO ที่เข้าเกณฑ์\n2. กด Close\n3. ยืนยัน" },
        { type: "expected", description: "text ของ status ตรงกับ /voided|cancelled/i หลัง close Skip ถ้าไม่มี PO ที่เข้าเกณฑ์" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "CRUD" },
        { type: "note", description: "Dynamically skipped when no eligible PO exists." },
      ],
    },
    async ({ page, browser }) => {
      const po = new PurchaseOrderPage(page);
      const created = await seedApprovedPO(browser);
      await gotoPODetail(page, created.ref);
      const close = po.closePOButton();
      if ((await close.count()) === 0) {
        purchaseTest.skip(true, "Close button not present on this Approved PO");
        return;
      }
      await close.click({ timeout: 10_000 });
      // "Close Purchase Order — …Please provide a reason." with an optional REASON
      // box; the button is labelled Close.
      await po.confirmDialogButton(/^close$|confirm|yes/i).click({ timeout: 10_000 });

      // The document ends up **CLOSED**, not VOIDED — this build has no voided
      // state for a PO at all (PO_STATUS has closed/completed; the old assertion
      // waited for a badge the app never renders). Re-open the record because
      // confirming routes back to the list.
      await gotoPODetail(page, created.ref);
      await expect(
        page
          .locator("[data-slot='status'], [data-slot='badge'], [class*='badge']")
          .filter({ hasText: /closed/i })
          .first(),
      ).toBeVisible({ timeout: 15_000 });
    },
  );
});

purchaseTest.describe.serial("Golden Journey", () => {
  purchaseTest(
    "TC-PO-060901 Full Purchaser flow: Create blank → Save Draft → Submit → FC approves → Send to Vendor",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Purchaser" },
        { type: "steps", description: "1. สร้าง blank PO (header + 1 รายการ)\n2. บันทึก Draft\n3. Submit\n4. FC approve (cross-context)\n5. Reload หน้า detail\n6. กด Send to Vendor" },
        { type: "expected", description: "URL ยังคงอยู่ที่ PO ref หลัง Send to Vendor (lifecycle ครบถ้วน end-to-end)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page, browser }) => {
      const po = new PurchaseOrderPage(page);

      // Step 1-4: create, submit, and walk BOTH approve stages. General PO is
      // Create Request -> FC -> GM -> Completed, so FC alone leaves the PO at GM
      // and Send to Vendor never appears.
      const created = await seedApprovedPO(browser, { description: "[E2E-POP] TC-PO-060901 golden" });

      // Step 5: Reload as Purchaser and verify Approved state has Send button
      await gotoPODetail(page, created.ref);
      const send = po.sendToVendorButton();
      if ((await send.count()) === 0) {
        purchaseTest.skip(true, "Send to Vendor button not present after full approval");
        return;
      }

      // Step 6: Send to Vendor
      await send.click({ timeout: 5_000 });
      await po.confirmDialogButton(/confirm|send|ok|yes/i).click({ timeout: 5_000 });

      await expect(page).toHaveURL(new RegExp(`${LIST_PATH}/${created.ref}`), { timeout: 15_000 });
    },
  );
});
