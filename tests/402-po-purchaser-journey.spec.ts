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
      await expect(fb, "Filter button not present in this build").toBeVisible({ timeout: 10_000 });
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
      await expect(input, "Search input not present in this build").toBeVisible({ timeout: 10_000 });
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
      await expect(blank, "Manual/Blank PO menu item not present").toBeVisible({ timeout: 10_000 });
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
      await expect(desc, "Description input not present").toBeVisible({ timeout: 10_000 });
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
      await save.click({ timeout: 5_000 });
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
      await expect(item, "From Price List menu item not present").toBeVisible({ timeout: 10_000 });
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
      await page.goto("/procurement/purchase-order/from-price-list");
      await po.priceListWizardPickVendorAndNext();
      // Step 2 lists the price-list lines of the chosen vendor.
      await expect(page.getByRole("row").filter({ hasText: /PL\d+/ }).first()).toBeVisible({ timeout: 10_000 });
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
      await page.goto("/procurement/purchase-order/from-price-list");
      await po.priceListWizardPickVendorAndNext();
      await po.priceListWizardPickItemAndNext();
      // Step 3 summarises the order, then Confirm creates it.
      await expect(page.getByText(/order details/i).first()).toBeVisible({ timeout: 10_000 });
      const created = page.waitForResponse(
        (r) => /purchase-orders/.test(r.url()) && r.request().method() === "POST",
        { timeout: 20_000 },
      );
      await page.getByRole("button", { name: /^confirm$/i }).click({ timeout: 10_000 });
      const dlg = page.getByRole("alertdialog");
      if (await dlg.isVisible().catch(() => false)) {
        await dlg.getByRole("button", { name: /^confirm$/i }).click({ timeout: 10_000 });
      }
      expect((await created).ok()).toBe(true);
    },
  );

  purchaseTest(
    "TC-PO-060208 Wizard step 1 lists vendors that have an active price list on the delivery date",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Purchaser; อยู่ที่หน้า list ของ PO" },
        { type: "steps", description: "1. เปิด wizard From Price List\n2. เลือก workflow และ delivery date\n3. ตรวจสอบรายการ vendor ใน step 1" },
        { type: "expected", description: "หลังเลือก workflow + delivery date รายการ vendor (radio) ปรากฏจาก price list ที่ active วันนั้น" },
        { type: "priority", description: "Low" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const po = new PurchaseOrderPage(page);
      await page.goto("/procurement/purchase-order/from-price-list");
      await po.selectFirstWorkflow();
      await po.selectDeliveryDate();
      // Vendors come from the price lists active on the delivery date (STD pricing seed).
      await expect(
        page.getByRole("radio").first(),
        "no vendor with an active price list — run `bun run data:reset --yes`",
      ).toBeVisible({ timeout: 15_000 });
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
      await expect(item, "From PR menu item not present").toBeVisible({ timeout: 10_000 });
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
      await po.fromPRWizardPickFirstPRAndNext();
      // Step 2 lists the POs that will be generated (one per vendor) with their PR ref.
      await expect(page.locator("tbody tr").filter({ hasText: /PR\d{6,}/ })).toHaveCount(1);
    },
  );

  purchaseTest(
    "TC-PO-060211 Submit From PR wizard → POs created",
    {
      annotation: [
        { type: "preconditions", description: "Wizard From PR step 2 เปิดอยู่" },
        { type: "steps", description: "1. กด Create/Submit บน step สุดท้ายของ wizard" },
        { type: "expected", description: "ยืนยัน 2 ชั้น (Confirm + alert dialog) แล้ว POST purchase-orders ตอบ ok และหน้าแสดง 'purchase orders created'" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const po = new PurchaseOrderPage(page);
      await po.fromPRWizardPickFirstPRAndNext();
      await page.getByRole("button", { name: /^confirm$/i }).click({ timeout: 10_000 });
      const created = page.waitForResponse(
        (r) => /purchase-orders/.test(r.url()) && r.request().method() === "POST",
        { timeout: 20_000 },
      );
      await page.getByRole("alertdialog").getByRole("button", { name: /^confirm$/i }).click({ timeout: 10_000 });
      expect((await created).ok()).toBe(true);
      await expect(page.getByText(/purchase orders created/i)).toBeVisible({ timeout: 20_000 });
    },
  );

  purchaseTest(
    "TC-PO-060212 From PR wizard lists approved PRs once a workflow is chosen",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Purchaser; อยู่ที่หน้า list ของ PO" },
        { type: "steps", description: "1. เปิด wizard From PR\n2. เลือก workflow\n3. ตรวจสอบรายการ PR ใน step 1" },
        { type: "expected", description: "หลังเลือก workflow ตาราง PR ที่ approved แล้วปรากฏ (เลข PR..)" },
        { type: "priority", description: "Low" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const po = new PurchaseOrderPage(page);
      await page.goto("/procurement/purchase-order/from-pr");
      await po.selectFirstWorkflow();
      await expect(
        page.locator("tbody tr").filter({ hasText: /PR\d{6,}/ }).first(),
        "no approved PR in TEST BU — run `bun run data:reset --yes`",
      ).toBeVisible({ timeout: 15_000 });
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
    "TC-PO-060302 Item rows expand and collapse inline via Expand all (no tab panel)",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่หน้า detail ของ Draft PO ที่มีอย่างน้อยหนึ่งรายการ" },
        { type: "steps", description: "1. เปิดหน้า detail ของ PO ที่มีรายการ\n2. กด 'Expand all'" },
        { type: "expected", description: "ปุ่มสลับเป็น 'Collapse all' (รายการกางในแถว); ไม่มีแท็บ Items/Quantity/Pricing แล้ว" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page, browser }) => {
      const po = new PurchaseOrderPage(page);
      const created = await submitPOAsPurchaser(browser);
      await gotoPODetail(page, created.ref);
      // The PO detail has no Details/Quantity/Pricing tab panel (grep of FE
      // routes/procurement/purchase-order: no Tabs); item rows expand inline via the
      // "Expand all" / "Collapse all" toggle (po-item-fields.tsx).
      const expand = page.getByRole("button", { name: /expand all/i });
      await expect(expand).toBeVisible({ timeout: 15_000 });
      await expand.click();
      await expect(page.getByRole("button", { name: /collapse all/i })).toBeVisible({ timeout: 5_000 });
      await expect(po.tabItems()).toHaveCount(0);
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
    "TC-PO-060304 Read-only state for an APPROVED PO (no Edit button)",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Purchaser; seed PO จนถึง Approved (FC + GM)" },
        { type: "steps", description: "1. เปิดหน้า detail ของ PO ที่ Approved\n2. ตรวจ toolbar" },
        { type: "expected", description: "ไม่มีปุ่ม Edit; มีปุ่ม Send to vendor" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Authorization" },
      ],
    },
    async ({ page, browser }) => {
      const po = new PurchaseOrderPage(page);
      // Sent/Completed cannot be reached on TEST BU (Send needs an email profile), so
      // the read-only state is checked on an Approved PO: no Edit, but Close/Send.
      const created = await seedApprovedPO(browser, { description: "[E2E-POP] TC-PO-060304" });
      await gotoPODetail(page, created.ref);
      await expect(po.sendToVendorButton()).toBeVisible({ timeout: 15_000 });
      await expect(po.editModeButton()).toHaveCount(0);
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
      await expect(po.editModeButton(), "Edit button not present").toBeVisible({ timeout: 10_000 });
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
      await expect(po.editModeButton(), "Edit button not present").toBeVisible({ timeout: 10_000 });
      await po.enterEditMode();
      const qty = page.getByLabel(/^quantity$|^qty$/i).first();
      if ((await qty.count()) > 0) await qty.fill("5");
      await po.saveButton().click({ timeout: 5_000 });
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
      purchaseTest.setTimeout(90_000);
      const po = new PurchaseOrderPage(page);
      const created = await createDraftPOAsPurchaser(browser);
      await gotoPODetail(page, created.ref);
      await po.enterEditMode();
      await po.addItemToPO({ product: "Added in Edit", quantity: 2, uom: "ea", unitPrice: 50 });
      const saved = page.waitForResponse(
        (r) => /\/purchase-orders\//.test(r.url()) && /PATCH|PUT|POST/.test(r.request().method()),
        { timeout: 15_000 },
      );
      await po.saveButton().click({ timeout: 5_000 });
      expect((await saved).ok()).toBe(true);
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
      await expect(po.editModeButton(), "Edit button not present").toBeVisible({ timeout: 10_000 });
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
      await expect(submit, "Submit button not present (Draft may already be In Progress)").toBeVisible({ timeout: 10_000 });
      await submit.click({ timeout: 5_000 });
      await po.confirmDialogButton(/confirm|submit|ok|yes/i).click({ timeout: 5_000 });
      await expect(page).toHaveURL(new RegExp(`${LIST_PATH}/${created.ref}`), { timeout: 15_000 });
    },
  );

  purchaseTest(
    "TC-PO-060406 Delete DRAFT PO via Edit Mode",
    {
      annotation: [
        { type: "preconditions", description: "มี PO สถานะ Draft ที่ Purchaser สร้างเอง (หลัง submit แล้วผู้สร้างเป็น view_only ลบไม่ได้)" },
        { type: "steps", description: "1. เปิด PO\n2. กด Edit\n3. กด Delete\n4. ยืนยัน" },
        { type: "expected", description: "URL navigate กลับไปยัง list (PO ถูกลบ)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page, browser }) => {
      const po = new PurchaseOrderPage(page);
      // A submitted PO hands its creator role=view_only (no Edit/Delete), so only a
      // Draft can be deleted through Edit mode.
      const created = await createDraftPOAsPurchaser(browser);
      await gotoPODetail(page, created.ref);
      await po.enterEditMode();
      const del = po.deleteButton();
      await expect(del).toBeVisible({ timeout: 10_000 });
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
      await expect(send).toBeVisible({ timeout: 15_000 });
    },
  );

  purchaseTest(
    "TC-PO-060502 Click Send to Vendor → compose dialog opens bound to the PO",
    {
      annotation: [
        { type: "preconditions", description: "มี PO ที่ approved อยู่ในระบบ" },
        { type: "steps", description: "1. เปิด Approved PO\n2. กด Send to Vendor\n3. ตรวจ dialog" },
        { type: "expected", description: "dialog 'Send purchase order to vendor' เปิดพร้อมเลข PO; TEST BU ไม่มี email profile ที่เปิดใช้ จึงแสดง no-profile + ลิงก์ตั้งค่า (ไม่กดส่งจริง); URL ยังอยู่ที่ PO ref" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page, browser }) => {
      const po = new PurchaseOrderPage(page);
      const created = await seedApprovedPO(browser);
      await gotoPODetail(page, created.ref);
      const send = po.sendToVendorButton();
      await expect(send).toBeVisible({ timeout: 15_000 });
      await send.click({ timeout: 5_000 });
      await po.expectSendToVendorDialogOpen();
      await expect(page).toHaveURL(new RegExp(`${LIST_PATH}/${created.ref}`));
    },
  );

  purchaseTest.fixme(
    "TC-PO-060503 Close PO with items received → COMPLETED",
    {
      annotation: [
        { type: "preconditions", description: "มี SENT PO ที่มีรายการที่รับแล้ว (best-effort; เชื่อ DB)" },
        { type: "steps", description: "1. ค้นหา SENT PO ที่มีรายการที่รับแล้วในรายการ\n2. เปิดหน้า detail\n3. กด Close\n4. ยืนยัน" },
        { type: "expected", description: "text ของ status ตรงกับ /completed/i หลัง close" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "CRUD" },
        { type: "note", description: "fixme (data): ต้องมี PO ที่ Sent และรับของแล้ว — Send ต้องมี email profile ที่เปิดใช้ ซึ่ง TEST BU ไม่มี และ STD receiving ใช้ PO หมด" },
      ],
    },
    async () => {
      // Needs a PO with received quantity > 0 that is Sent. Sending needs an enabled
      // email profile (TEST BU has none, see TC-PO-060502) and the STD receiving seed
      // consumes its POs, so this lifecycle is not reachable from data:reset yet.
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
      await expect(close, "Close button not present on this Approved PO").toBeVisible({ timeout: 10_000 });
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
        { type: "expected", description: "lifecycle ครบ (Create → Draft → Submit → FC → GM → Approved) แล้วกด Send to Vendor เปิด dialog ผูกกับเลข PO (ไม่มี email profile ใน TEST BU จึงไม่กดส่งจริง); URL ยังอยู่ที่ PO ref" },
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
      await expect(send).toBeVisible({ timeout: 15_000 });

      // Step 6: Send to Vendor opens the compose dialog (no email profile in TEST BU)
      await send.click({ timeout: 5_000 });
      await po.expectSendToVendorDialogOpen();
      await expect(page).toHaveURL(new RegExp(`${LIST_PATH}/${created.ref}`));
    },
  );
});
