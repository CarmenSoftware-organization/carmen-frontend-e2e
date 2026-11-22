import { test as baseTest, expect, type Page } from "@playwright/test";
import { createAuthTest } from "./fixtures/auth.fixture";
import { PurchaseRequestPage, LIST_PATH } from "./pages/purchase-request.page";
import {
  submitPRAsRequestor,
  approveAsHOD,
  bulkApprove,
  bulkReject,
  bulkSendForReview,
  gotoPRDetail,
  splitFirstItem,
} from "./pages/pr-approver.helpers";
import { BU_CODE } from "./test-users";
import { ensureActiveBu, getBusinessUnits, defaultBu } from "./helpers/bu";
import { BuSwitcherPage } from "./pages/bu-switcher.page";

// Persona-journey spec — Purchaser. Runs alongside 301/302/303.
// Source docs: docs/persona-doc/Purchase Request/Purchaser/INDEX.md and step-01..04.md.
const purchaseTest = createAuthTest("carmensoftware.dev+purchase@gmail.com");

const REJECT_REASON = "Vendor pricing exceeds budget";
const REVIEW_REASON = "Please confirm vendor selection";
const REVIEW_STAGE = "HOD";

// Cases seed their PR through second/third browser contexts (requestor create+submit,
// HOD approve). That takes well over the default 30s on the dev backend, and the timeout
// used to fire inside seeding as a bogus "browserContext.close: Target page ... closed".
purchaseTest.describe.configure({ timeout: 180_000 });

purchaseTest.describe("Step 1 — PR List (Purchaser View)", () => {
  // Transaction-module rollout: pin the purchaser session's active BU to BLAVG
  // first so it persists (server-side) for the rest of the journey.
  purchaseTest(
    "TC-PR-070150 active BU = BLAVG",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+purchase@gmail.com ผ่าน auth fixture" },
        { type: "steps", description: "1. เรียก ensureActiveBu(BLAVG)\n2. อ่าน profile API\n3. หา business unit ที่ is_default\n4. อ่าน label ของ BU switcher" },
        { type: "expected", description: "default business unit มี code === 'BLAVG'; trigger ของ BU switcher แสดง label ของ BU นั้น" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page }) => {
      await ensureActiveBu(page, BU_CODE);
      const units = await getBusinessUnits(page);
      const active = defaultBu(units);
      expect(active?.code).toBe(BU_CODE);
      const switcher = new BuSwitcherPage(page);
      await expect(switcher.trigger()).toContainText(active!.name, { timeout: 15_000 });
    },
  );

  purchaseTest(
    "TC-PR-070101 List loads, My Pending tab default (PRs at Purchase stage)",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Purchaser (carmensoftware.dev+purchase@gmail.com)" },
        { type: "steps", description: "1. ไปที่ /procurement/purchase-request\n2. ตรวจสอบ URL และแท็บ My Pending" },
        { type: "expected", description: "URL อยู่ที่หน้า PR list; ปุ่ม My Pending แสดงและเป็นมุมมองเริ่มต้น (ไม่มี view=all-document)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page }) => {
      const pr = new PurchaseRequestPage(page);
      await pr.gotoList();
      await expect(page).toHaveURL(new RegExp(LIST_PATH));
      // Redesigned list uses a viewMode <Button> toggle (no aria-selected).
      await expect(pr.tabMyPending(), "My Pending toggle missing on the PR list").toBeVisible({ timeout: 5_000 });
      // My Pending is the default view: ?view= is absent or my-pending, never all-document.
      await expect(page).not.toHaveURL(/view=all-document/);
    },
  );

  purchaseTest(
    "TC-PR-070102 Switch to All Documents tab broadens scope",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่หน้า PR list" },
        { type: "steps", description: "1. คลิกแท็บ All Documents" },
        { type: "expected", description: "หลังคลิก All Documents URL มี ?view=all-document" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const pr = new PurchaseRequestPage(page);
      await pr.gotoList();
      const tab = pr.tabAllDocuments();
      await expect(tab, "All Documents toggle missing on the PR list").toBeVisible({ timeout: 10_000 });
      await tab.click();
      // The viewMode toggle has no aria-selected; its state lives in the URL (?view=).
      await expect(page).toHaveURL(/view=all-document/, { timeout: 5_000 });
    },
  );

  purchaseTest(
    "TC-PR-070103 All Stage dropdown filters by status",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่หน้า PR list" },
        { type: "steps", description: "1. เปิดแผง Filter\n2. เลือกฟิลด์ Stage\n3. ติ๊ก stage แรกในรายการ" },
        { type: "expected", description: "ตอนเปิด ตัวเลือก All Stage ถูกติ๊ก; หลังติ๊ก stage แรก stage นั้นถูกติ๊กและ All Stage ถูกยกเลิกติ๊ก" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const pr = new PurchaseRequestPage(page);
      // GET purchase-requests/workflow-stages only returns the stages of workflows used by
      // PRs the *caller requested* (purchase-request.service.ts findAllWorkflowStagesByPr,
      // `where: { requestor_id: user_id }`), so an approver/purchaser who raised no PR gets
      // data = [] and the filter lists nothing but "All Stage". Measured 2026-11-21.
      await pr.gotoAllDocuments();
      await pr.openStageFilter();
      // These two steps are the openStageFilter() contract. They run BEFORE the bug is declared
      // below, so a regression in the page object fails the case for real instead of being
      // swallowed by test.fail.
      await expect(pr.stageFilterOption(/^all stage$/i)).toBeVisible({ timeout: 10_000 });
      await expect(pr.stageFilterOption(/^all stage$/i)).toBeChecked();

      purchaseTest.fail(true, "suspected bug: PR workflow-stages is scoped to requestor_id, so the stage filter lists no stage for approvers/purchasers");
      // Desired behaviour: at least one stage besides "All Stage". Flips red ("expected to fail
      // but passed") only when the backend stops scoping the list to the requestor.
      const stageOptions = page.getByRole("dialog").getByRole("checkbox");
      await expect(stageOptions).not.toHaveCount(1, { timeout: 5_000 });
      const stage = stageOptions.nth(1);
      await stage.click();
      await expect(stage).toBeChecked();
      await expect(pr.stageFilterOption(/^all stage$/i)).not.toBeChecked();
    },
  );

  purchaseTest(
    "TC-PR-070104 Filter panel opens and applies",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่หน้า PR list" },
        { type: "steps", description: "1. เปิดแผง Filter\n2. เลือกฟิลด์ Status แล้วติ๊ก In progress (ไม่มีปุ่ม Apply)" },
        { type: "expected", description: "หลังติ๊ก In progress ทุกแถวที่แสดงมีสถานะ In progress" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const pr = new PurchaseRequestPage(page);
      await pr.gotoList();
      await expect(pr.filterButton(), "Filter button missing on the PR list").toBeVisible({ timeout: 10_000 });
      await pr.gotoAllDocuments();
      await pr.applyFilter("In progress");
      await pr.expectEveryRowStatus(/in progress/i);
    },
  );

  purchaseTest(
    "TC-PR-070105 Search by PR reference filters list",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่หน้า PR list; มี PR อย่างน้อยหนึ่งรายการที่มี reference ที่รู้จัก" },
        { type: "steps", description: "1. พิมพ์ reference บางส่วนใน search\n2. รอผลลัพธ์" },
        { type: "expected", description: "URL ยังคงอยู่ที่หน้า PR list หลังจากพิมพ์ใน search input" },
        { type: "priority", description: "Low" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const pr = new PurchaseRequestPage(page);
      await pr.gotoList();
      await expect(pr.searchInput(), "Search input missing on the PR list").toBeVisible({ timeout: 10_000 });
      await pr.searchFor("PR");
      await expect(page).toHaveURL(new RegExp(LIST_PATH));
    },
  );
});

purchaseTest.describe("Step 2 — PR Detail (Read-only)", () => {
  purchaseTest(
    "TC-PR-070201 Detail loads with Items tab default",
    {
      annotation: [
        { type: "preconditions", description: "PR มีอยู่ที่ขั้นตอน Purchase (seeded ผ่าน submitPRAsRequestor + approveAsHOD)" },
        { type: "steps", description: "1. เปิดหน้า PR detail\n2. ตรวจสอบว่าแท็บ Items เป็นค่าเริ่มต้น" },
        { type: "expected", description: "URL เป็น detail URL; ตารางรายการสินค้า (คอลัมน์ Product + แถวรายการที่ seed) แสดงเป็นค่าเริ่มต้น" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page, browser }) => {
      const pr = new PurchaseRequestPage(page);
      const created = await submitPRAsRequestor(browser);
      await approveAsHOD(browser, created.ref);
      await gotoPRDetail(page, created.ref);
      await expect(page).toHaveURL(new RegExp(`${LIST_PATH}/${created.ref}`));
      await expect(page.getByRole("columnheader", { name: /product/i }).first(), "item table is not shown by default").toBeVisible({ timeout: 10_000 });
      await expect(page.getByRole("button", { name: /^expand row$/i }).first(), "seeded line item is not listed").toBeVisible({ timeout: 10_000 });
    },
  );

  purchaseTest(
    "TC-PR-070202 Switch to Workflow History tab",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่หน้า PR detail ขั้นตอน Purchase" },
        { type: "steps", description: "1. คลิกแท็บ Workflow History" },
        { type: "expected", description: "หลังคลิกตัวเปิดประวัติ (stepper) แสดง sheet Workflow History ที่มีรายการของ requestor" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page, browser }) => {
      const pr = new PurchaseRequestPage(page);
      const created = await submitPRAsRequestor(browser);
      await approveAsHOD(browser, created.ref);
      await gotoPRDetail(page, created.ref);
      const wh = pr.tabWorkflowHistory();
      await expect(wh, "Workflow History control missing on PR detail").toBeVisible({ timeout: 10_000 });
      await wh.click();
      const sheet = pr.workflowHistorySheet();
      await expect(sheet, "Workflow History sheet did not open").toBeVisible({ timeout: 10_000 });
      await expect(sheet.getByText(/requestor carmensoftware/i).first(), "history shows no entry by the requestor").toBeVisible({ timeout: 10_000 });
    },
  );

  purchaseTest(
    "TC-PR-070203 No standalone Approve/Reject/Return buttons (BRD discrepancy)",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่หน้า PR detail ขั้นตอน Purchase (read-only view)" },
        { type: "steps", description: "1. ตรวจสอบ header / action toolbar ของหน้า detail" },
        { type: "expected", description: "ปุ่ม Approve, Reject และ Send for Review แบบ standalone ต้องไม่ visible ที่ header ของหน้า (ตาม BRD discrepancy — actions อยู่ใน bulk toolbar ของ Edit Mode)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Authorization" },
      ],
    },
    async ({ page, browser }) => {
      const pr = new PurchaseRequestPage(page);
      const created = await submitPRAsRequestor(browser);
      await approveAsHOD(browser, created.ref);
      await gotoPRDetail(page, created.ref);
      await expect(pr.editModeButton(), "Edit button missing — cannot verify read-only header state").toBeVisible({ timeout: 10_000 });
      await expect(pr.approveButton()).toHaveCount(0);
      await expect(pr.rejectButton()).toHaveCount(0);
      await expect(pr.sendBackButton()).toHaveCount(0);
    },
  );

  purchaseTest(
    "TC-PR-070204 Edit button visible (entry to vendor/pricing edit)",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่หน้า PR detail ขั้นตอน Purchase" },
        { type: "steps", description: "1. ตรวจสอบ action toolbar" },
        { type: "expected", description: "ปุ่ม Edit visible (Purchaser สามารถเข้า Edit Mode สำหรับ vendor/pricing allocation ได้)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page, browser }) => {
      purchaseTest.slow(); // cross-context seed (submit + HOD approve) is slow
      const pr = new PurchaseRequestPage(page);
      const created = await submitPRAsRequestor(browser);
      await approveAsHOD(browser, created.ref);
      await gotoPRDetail(page, created.ref);
      // The Purchaser only gets an Edit button once the PR is at the Purchase stage; a missing
      // button is a routing/seed failure and must show as one.
      await expect(pr.editModeButton()).toBeVisible({ timeout: 10_000 });
    },
  );
});

purchaseTest.describe("Step 3 — Edit Mode (Vendor & Pricing)", () => {
  purchaseTest(
    "TC-PR-070301 Click Edit → vendor/pricing fields become editable",
    {
      annotation: [
        { type: "preconditions", description: "PR มีอยู่ที่ขั้นตอน Purchase" },
        { type: "steps", description: "1. เปิด PR ขั้นตอน Purchase\n2. คลิก Edit\n3. ตรวจสอบว่าปุ่ม Save/Cancel ระดับฟอร์มปรากฏขึ้น" },
        { type: "expected", description: "ปุ่ม Save Draft (หรือ Cancel) ระดับฟอร์ม visible" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page, browser }) => {
      const pr = new PurchaseRequestPage(page);
      const created = await submitPRAsRequestor(browser);
      await approveAsHOD(browser, created.ref);
      await gotoPRDetail(page, created.ref);
      await expect(pr.editModeButton(), "Edit button missing — PR did not reach an editable Purchase stage").toBeVisible({ timeout: 10_000 });
      await pr.enterEditMode();
      // Edit mode shows BOTH Save and Cancel — take .first() to avoid a
      // strict-mode violation on the combined locator.
      await expect(pr.saveDraftButton().or(pr.cancelFormButton()).first()).toBeVisible({ timeout: 10_000 });
    },
  );

  purchaseTest(
    "TC-PR-070302 Vendor field is editable (Purchaser scope)",
    {
      annotation: [
        { type: "preconditions", description: "Edit mode active อยู่บน PR ขั้นตอน Purchase ที่มีอย่างน้อยหนึ่งรายการ" },
        { type: "steps", description: "1. เข้า edit mode\n2. หา Vendor input ในแถวแรก\n3. ตรวจสอบว่าแก้ไขได้" },
        { type: "expected", description: "Vendor input แก้ไขได้ (ตรงข้ามกับ Approver ที่มองเห็นเป็น read-only)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page, browser }) => {
      const pr = new PurchaseRequestPage(page);
      const created = await submitPRAsRequestor(browser, { items: 1 });
      await approveAsHOD(browser, created.ref);
      await gotoPRDetail(page, created.ref);
      await expect(pr.editModeButton(), "Edit button missing — PR did not reach an editable Purchase stage").toBeVisible({ timeout: 10_000 });
      await pr.enterEditMode();
      await pr.expandItem(0);
      const vendor = pr.vendorInput(0);
      await expect(vendor, "Vendor lookup missing for the purchaser (it is plain text for approvers)").toBeVisible({ timeout: 10_000 });
      await expect(vendor).toBeEnabled();
    },
  );

  purchaseTest(
    "TC-PR-070303 Unit Price field is editable",
    {
      annotation: [
        { type: "preconditions", description: "Edit mode active อยู่บน PR ขั้นตอน Purchase ที่มีอย่างน้อยหนึ่งรายการ" },
        { type: "steps", description: "1. เข้า edit mode\n2. หา Unit Price input\n3. พิมพ์ค่า" },
        { type: "expected", description: "Unit Price input รับค่าที่พิมพ์ได้" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page, browser }) => {
      const pr = new PurchaseRequestPage(page);
      const created = await submitPRAsRequestor(browser, { items: 1 });
      await approveAsHOD(browser, created.ref);
      await gotoPRDetail(page, created.ref);
      await expect(pr.editModeButton(), "Edit button missing — PR did not reach an editable Purchase stage").toBeVisible({ timeout: 10_000 });
      await pr.enterEditMode();
      await pr.expandItem(0);
      const price = pr.unitPriceInput(0);
      await expect(price, "Unit Price input missing for the purchaser").toBeVisible({ timeout: 10_000 });
      await expect(price).toBeEditable();
      await pr.setAmount(price, 125);
      await expect(price).toHaveValue(/^125(\.0+)?$/);
    },
  );

  purchaseTest(
    "TC-PR-070304 Discount field is editable",
    {
      annotation: [
        { type: "preconditions", description: "Edit mode active อยู่บน PR ขั้นตอน Purchase" },
        { type: "steps", description: "1. เข้า edit mode\n2. หา Discount input\n3. ตรวจสอบว่าแก้ไขได้" },
        { type: "expected", description: "Discount input แก้ไขได้" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page, browser }) => {
      const pr = new PurchaseRequestPage(page);
      const created = await submitPRAsRequestor(browser, { items: 1 });
      await approveAsHOD(browser, created.ref);
      await gotoPRDetail(page, created.ref);
      await expect(pr.editModeButton(), "Edit button missing — PR did not reach an editable Purchase stage").toBeVisible({ timeout: 10_000 });
      await pr.enterEditMode();
      await pr.expandItem(0);
      const discount = pr.discountInput(0);
      await expect(discount, "Discount input missing for the purchaser").toBeVisible({ timeout: 10_000 });
      await expect(discount).toBeEditable();
      await discount.fill("5");
      await expect(discount).toHaveValue("5");
    },
  );

  purchaseTest(
    "TC-PR-070305 Tax Profile field is editable",
    {
      annotation: [
        { type: "preconditions", description: "Edit mode active อยู่บน PR ขั้นตอน Purchase" },
        { type: "steps", description: "1. เข้า edit mode\n2. หา Tax Profile select\n3. ตรวจสอบว่าแก้ไขได้" },
        { type: "expected", description: "Tax Profile select แก้ไขได้" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page, browser }) => {
      const pr = new PurchaseRequestPage(page);
      const created = await submitPRAsRequestor(browser, { items: 1 });
      await approveAsHOD(browser, created.ref);
      await gotoPRDetail(page, created.ref);
      await expect(pr.editModeButton(), "Edit button missing — PR did not reach an editable Purchase stage").toBeVisible({ timeout: 10_000 });
      await pr.enterEditMode();
      await pr.expandItem(0);
      const tax = pr.taxProfileSelect(0);
      await expect(tax, "Tax Profile lookup missing for the purchaser").toBeVisible({ timeout: 10_000 });
      await expect(tax).toBeEnabled();
    },
  );

  purchaseTest(
    "TC-PR-070306 Approved Qty field stays read-only (HOD already set it)",
    {
      annotation: [
        { type: "preconditions", description: "Edit mode active อยู่บน PR ขั้นตอน Purchase ที่มีอย่างน้อยหนึ่งรายการ" },
        { type: "steps", description: "1. เข้า edit mode\n2. หาช่อง Approved Qty ในแถวแรก" },
        { type: "expected", description: "ช่อง Approved Qty ถูก disabled หรือแก้ไขไม่ได้สำหรับ Purchaser (HOD กำหนดค่าไว้แล้ว)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Authorization" },
      ],
    },
    async ({ page, browser }) => {
      const pr = new PurchaseRequestPage(page);
      const created = await submitPRAsRequestor(browser, { items: 1 });
      await approveAsHOD(browser, created.ref);
      await gotoPRDetail(page, created.ref);
      await expect(pr.editModeButton(), "Edit button missing — PR did not reach an editable Purchase stage").toBeVisible({ timeout: 10_000 });
      await pr.enterEditMode();
      await expect(page.getByRole("columnheader", { name: /approved/i }).first()).toBeVisible();
      // Spec (FR-PR-011A): the purchaser cannot change the approved quantity the HOD set. The FE renders
      // it as an editable input at the Purchase stage too (pr-item-cells/approved-cell.tsx gets the same
      // isDisabled as for the approver; only the Requested column is locked outside the Create stage,
      // use-pr-item-table.tsx:136). Measured 2026-11-21: input[name="items.0.approved_qty"] is enabled.
      purchaseTest.fail(true, "suspected bug: Approved Qty is an editable input for the purchaser stage (spec says read-only)");
      await expect(pr.approvedQtyReadOnlyCell(0), "Approved Qty is editable for the purchaser").toHaveCount(0);
    },
  );

  purchaseTest(
    "TC-PR-070307 Auto Allocate button populates vendors via scoring",
    {
      annotation: [
        { type: "preconditions", description: "Edit mode active อยู่บน PR ขั้นตอน Purchase ที่มีอย่างน้อยหนึ่งรายการ" },
        { type: "steps", description: "1. เข้า edit mode\n2. คลิก Auto Allocate" },
        { type: "expected", description: "หลังคลิก Auto Allocate แอปแจ้งผลการจัดสรร (toast)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page, browser }) => {
      const pr = new PurchaseRequestPage(page);
      const created = await submitPRAsRequestor(browser, { items: 1 });
      await approveAsHOD(browser, created.ref);
      await gotoPRDetail(page, created.ref);
      await expect(pr.editModeButton(), "Edit button missing — PR did not reach an editable Purchase stage").toBeVisible({ timeout: 10_000 });
      await pr.enterEditMode();
      const auto = pr.autoAllocateButton();
      await expect(auto, "Auto Allocate button missing for the purchaser").toBeVisible({ timeout: 10_000 });
      await auto.click({ timeout: 5_000 });
      // Allocation reports its outcome in a toast (assigned, or nothing priced for the product).
      await expect(
        page.locator('[data-sonner-toast]').first(),
        "Auto Allocate gave no feedback",
      ).toBeVisible({ timeout: 15_000 });
    },
  );

  purchaseTest(
    "TC-PR-070308 Multiple line items — pricing on each row independent",
    {
      annotation: [
        { type: "preconditions", description: "Edit mode active อยู่บน PR ขั้นตอน Purchase ที่มีหลายรายการ" },
        { type: "steps", description: "1. Seed PR ด้วย 2 รายการ\n2. เข้า edit mode\n3. กำหนด unit price ในแถว 0\n4. กำหนด unit price ในแถว 1\n5. ตรวจสอบว่าทั้งสองค่ามีอยู่" },
        { type: "expected", description: "Unit Price input ของแต่ละแถวเก็บค่าของตัวเองไว้" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page, browser }) => {
      purchaseTest.slow(); // cross-context seed (submit + HOD approve) is slow
      const pr = new PurchaseRequestPage(page);
      const created = await submitPRAsRequestor(browser, { items: 2 });
      await approveAsHOD(browser, created.ref);
      await gotoPRDetail(page, created.ref);
      await expect(pr.editModeButton(), "Edit button missing — PR did not reach an editable Purchase stage").toBeVisible({ timeout: 10_000 });
      await pr.enterEditMode();
      await page.getByRole("button", { name: /^expand all$/i }).click();
      const price0 = pr.unitPriceInput(0);
      const price1 = pr.unitPriceInput(1);
      await expect(price0, "Unit Price input missing on row 1").toBeVisible({ timeout: 10_000 });
      await expect(price1, "Unit Price input missing on row 2").toBeVisible({ timeout: 10_000 });
      await pr.setAmount(price0, 100);
      await pr.setAmount(price1, 200);
      await expect(price0).toHaveValue(/^100(\.0+)?$/);
      await expect(price1).toHaveValue(/^200(\.0+)?$/);
    },
  );

  purchaseTest(
    "TC-PR-070309 Save edits → exit edit mode + persist values",
    {
      annotation: [
        { type: "preconditions", description: "Edit mode active อยู่บน PR ขั้นตอน Purchase ที่มีการแก้ไข vendor/price" },
        { type: "steps", description: "1. เข้า edit mode\n2. กำหนด unit price\n3. คลิก Save Draft" },
        { type: "expected", description: "ฟอร์มกลับไปที่ view mode (ปุ่ม Edit visible อีกครั้ง)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page, browser }) => {
      const pr = new PurchaseRequestPage(page);
      const created = await submitPRAsRequestor(browser, { items: 1 });
      await approveAsHOD(browser, created.ref);
      await gotoPRDetail(page, created.ref);
      await expect(pr.editModeButton(), "Edit button missing — PR did not reach an editable Purchase stage").toBeVisible({ timeout: 10_000 });
      await pr.enterEditMode();
      await pr.expandItem(0);
      const price = pr.unitPriceInput(0);
      await expect(price).toBeVisible({ timeout: 10_000 });
      await pr.setAmount(price, 150);
      await pr.saveEditMode();
      await expect(pr.editModeButton()).toBeVisible({ timeout: 10_000 });
      // Persisted: a fresh load shows the saved price in the expanded panel.
      await gotoPRDetail(page, created.ref);
      await pr.expandItem(0);
      await expect(pr.expandedPanel().getByText(/150\.00/).first(), "saved unit price was not persisted").toBeVisible({ timeout: 10_000 });
    },
  );

  purchaseTest(
    "TC-PR-070310 Cancel edits → discard changes, restore original",
    {
      annotation: [
        { type: "preconditions", description: "Edit mode active อยู่บน PR ขั้นตอน Purchase" },
        { type: "steps", description: "1. เข้า edit mode\n2. พิมพ์ใน Unit Price\n3. คลิก Cancel" },
        { type: "expected", description: "ฟอร์มกลับไปที่ view mode (ปุ่ม Edit visible อีกครั้ง)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page, browser }) => {
      const pr = new PurchaseRequestPage(page);
      const created = await submitPRAsRequestor(browser, { items: 1 });
      await approveAsHOD(browser, created.ref);
      await gotoPRDetail(page, created.ref);
      await expect(pr.editModeButton(), "Edit button missing — PR did not reach an editable Purchase stage").toBeVisible({ timeout: 10_000 });
      await pr.enterEditMode();
      await pr.expandItem(0);
      const price = pr.unitPriceInput(0);
      await expect(price).toBeVisible({ timeout: 10_000 });
      await pr.setAmount(price, 999);
      await pr.cancelEditMode();
      await expect(pr.editModeButton()).toBeVisible({ timeout: 10_000 });
      // Discarded: the panel shows the original price, not 999.
      await pr.expandItem(0);
      await expect(pr.expandedPanel().getByText(/999/)).toHaveCount(0);
    },
  );
});

// ── Step 3b — Price Comparison dialog ────────────────────────────────────
// carmen-frontend #536–#538 (v2.5.56): the dialog gained its own Inc VAT column
// (✓ / —) placed before Price, and a Net Price column (price before VAT) after
// it. "Best" moved from Price to Net Price, so every row is compared on the
// same pre-VAT basis. Values are checked against the dialog's own
// /pricelists/price-compare response (bearer-token SPA → waitForResponse).

interface PriceCompareEntry {
  vendor_name: string;
  pricelist_detail_id: string;
  price: number;
  is_tax_included?: boolean;
  price_without_tax?: number;
}

/** Mirrors netPriceOf() in pr-pricelist-dialog.tsx. */
const netPriceOf = (e: PriceCompareEntry) =>
  e.price_without_tax != null && e.price_without_tax > 0 ? e.price_without_tax : e.price;

const parseMoney = (text: string) => Number(text.replace(/[^\d.-]/g, ""));

/** Open the dialog and return the rows it renders (selected prepended, as the dialog does). */
async function openComparisonWithData(page: Page, pr: PurchaseRequestPage): Promise<PriceCompareEntry[]> {
  const respP = page.waitForResponse(
    (r) => r.url().includes("/pricelists/price-compare") && r.request().method() === "GET",
    { timeout: 20_000 },
  );
  await pr.openPriceComparison(0);
  const resp = await respP;
  expect(resp.ok()).toBeTruthy();
  const json = await resp.json();
  const lists: PriceCompareEntry[] = json.data?.lists ?? [];
  const selected: PriceCompareEntry | null = json.data?.selected ?? null;
  const rows =
    selected && !lists.some((l) => l.pricelist_detail_id === selected.pricelist_detail_id)
      ? [selected, ...lists]
      : lists;
  if (rows.length > 0) {
    await expect(pr.priceComparisonDialog().locator("tbody tr")).toHaveCount(rows.length, { timeout: 10_000 });
  }
  return rows;
}

/** Header text → column index inside the dialog's grid. */
async function headerIndexes(pr: PurchaseRequestPage) {
  const headers = (await pr.priceComparisonDialog().getByRole("columnheader").allInnerTexts()).map((h) => h.trim());
  const at = (re: RegExp) => headers.findIndex((h) => re.test(h));
  return { headers, incVat: at(/^inc vat$/i), price: at(/^price$/i), net: at(/^net price$/i) };
}

purchaseTest.describe.serial("Step 3b — Price Comparison dialog", () => {
  let ref = "";

  purchaseTest.beforeAll(async ({ browser }) => {
    purchaseTest.setTimeout(120_000);
    const created = await submitPRAsRequestor(browser, { items: 1, description: "TC-PR-0703 price comparison" });
    await approveAsHOD(browser, created.ref);
    ref = created.ref;
  });

  purchaseTest(
    "TC-PR-070311 Price Comparison มีคอลัมน์ Inc VAT ก่อน Price และ Net Price ถัดจาก Price",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Purchaser; PR 1 รายการที่ผ่าน HOD แล้ว (อยู่ขั้นตอน Purchase) สร้างใน beforeAll" },
        { type: "steps", description: "1. เปิด PR detail\n2. กด Expand row ของรายการแรก\n3. กดปุ่ม Compare price\n4. อ่านหัวคอลัมน์ของตารางใน dialog" },
        { type: "expected", description: "dialog 'Price Comparison' เปิดขึ้น; มีหัวคอลัมน์ Inc VAT, Price, Net Price และเรียงลำดับ Inc VAT → Price → Net Price" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
        { type: "note", description: "carmen-frontend #537/#538 (v2.5.56)" },
      ],
    },
    async ({ page }) => {
      const pr = new PurchaseRequestPage(page);
      await gotoPRDetail(page, ref);
      await openComparisonWithData(page, pr);
      const { headers, incVat, price, net } = await headerIndexes(pr);
      expect(incVat, `headers: ${headers.join(" | ")}`).toBeGreaterThanOrEqual(0);
      expect(price, `headers: ${headers.join(" | ")}`).toBeGreaterThan(incVat);
      expect(net, `headers: ${headers.join(" | ")}`).toBe(price + 1);
    },
  );

  purchaseTest(
    "TC-PR-070312 คอลัมน์ Inc VAT แสดง ✓ หรือ — ตรงกับ is_tax_included ทุกแถว",
    {
      annotation: [
        { type: "preconditions", description: "PR ขั้นตอน Purchase จาก beforeAll; สินค้ามีรายการราคา (price list) อย่างน้อย 1 รายการใน BU" },
        { type: "steps", description: "1. เปิด Price Comparison ของรายการแรก\n2. ดักผลลัพธ์ API price-compare\n3. อ่านเซลล์คอลัมน์ Inc VAT ของแต่ละแถว" },
        { type: "expected", description: "แถวที่ is_tax_included = true มีไอคอน ✓ (aria-label 'Inc VAT'); แถวอื่นแสดง '—' — ไม่มีแถวที่ว่าง" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
        { type: "note", description: "carmen-frontend #538 — เดิมแถวที่ไม่ติ๊กอ่านไม่ออกว่า 'ไม่รวม' หรือ 'ไม่มีข้อมูล'" },
      ],
    },
    async ({ page }) => {
      const pr = new PurchaseRequestPage(page);
      await gotoPRDetail(page, ref);
      const rows = await openComparisonWithData(page, pr);
      expect(rows.length, "สินค้าในรายการแรกไม่มี price list ใน BU นี้ — data:reset ต้อง seed price list ให้สินค้านั้น").toBeGreaterThan(0);
      const { incVat } = await headerIndexes(pr);
      const bodyRows = pr.priceComparisonDialog().locator("tbody tr");
      for (const [i, entry] of rows.entries()) {
        const cell = bodyRows.nth(i).locator("td").nth(incVat);
        if (entry.is_tax_included) {
          await expect(cell.getByLabel(/^inc vat$/i), `row ${i} (${entry.vendor_name})`).toBeVisible();
        } else {
          await expect(cell, `row ${i} (${entry.vendor_name})`).toHaveText("—");
        }
      }
    },
  );

  purchaseTest(
    "TC-PR-070313 Net Price แสดงราคาก่อน VAT และป้าย Best อยู่ที่ Net Price ต่ำสุด",
    {
      annotation: [
        { type: "preconditions", description: "PR ขั้นตอน Purchase จาก beforeAll; สินค้ามีรายการราคาอย่างน้อย 1 รายการใน BU" },
        { type: "steps", description: "1. เปิด Price Comparison ของรายการแรก\n2. ดักผลลัพธ์ API price-compare\n3. เทียบเซลล์ Price และ Net Price ของแต่ละแถวกับ price / price_without_tax\n4. ตรวจตำแหน่งป้าย Best" },
        { type: "expected", description: "Price = price ที่กรอก; Net Price = price_without_tax (หรือ price เมื่อไม่มีค่า); ป้าย Best อยู่ในคอลัมน์ Net Price เฉพาะแถวที่ Net Price ต่ำสุด และไม่อยู่ในคอลัมน์ Price" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
        { type: "note", description: "carmen-frontend #537 — Best เดิมตัดสินจากราคาที่กรอก ทำให้ราคารวม VAT เทียบกับราคาไม่รวมตรง ๆ" },
      ],
    },
    async ({ page }) => {
      const pr = new PurchaseRequestPage(page);
      await gotoPRDetail(page, ref);
      const rows = await openComparisonWithData(page, pr);
      expect(rows.length, "สินค้าในรายการแรกไม่มี price list ใน BU นี้ — data:reset ต้อง seed price list ให้สินค้านั้น").toBeGreaterThan(0);
      const { price, net } = await headerIndexes(pr);
      const positive = rows.map(netPriceOf).filter((p) => p > 0);
      const minNet = positive.length ? Math.min(...positive) : 0;
      const bodyRows = pr.priceComparisonDialog().locator("tbody tr");
      for (const [i, entry] of rows.entries()) {
        const label = `row ${i} (${entry.vendor_name})`;
        const priceCell = bodyRows.nth(i).locator("td").nth(price);
        const netCell = bodyRows.nth(i).locator("td").nth(net);
        expect(parseMoney(await priceCell.innerText()), label).toBeCloseTo(entry.price, 2);
        // Net cell = [Best] <amount> <currency> — read the amount span alone.
        const netAmount = netCell.locator("span.tabular-nums");
        expect(parseMoney(await netAmount.innerText()), label).toBeCloseTo(netPriceOf(entry), 2);
        await expect(priceCell.getByText(/^best$/i), label).toHaveCount(0);
        const isBest = minNet > 0 && netPriceOf(entry) === minNet;
        await expect(netCell.getByText(/^best$/i), label).toHaveCount(isBest ? 1 : 0);
      }
    },
  );

  purchaseTest(
    "TC-PR-070314 โหมดดู (ไม่ได้กด Edit) dialog เป็นแบบอ่านอย่างเดียว ไม่มีปุ่ม Assign",
    {
      annotation: [
        { type: "preconditions", description: "PR ขั้นตอน Purchase จาก beforeAll; Purchaser ยังไม่เข้า edit mode" },
        { type: "steps", description: "1. เปิด PR detail (โหมดดู)\n2. เปิด Price Comparison ของรายการแรก\n3. หาปุ่ม Assign ใน dialog" },
        { type: "expected", description: "dialog เปิดได้ แต่ไม่มีปุ่ม Assign ในตาราง (readOnly เมื่อฟอร์มยังไม่อยู่ใน edit mode)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const pr = new PurchaseRequestPage(page);
      await gotoPRDetail(page, ref);
      await openComparisonWithData(page, pr);
      await expect(pr.priceComparisonDialog().getByRole("button", { name: /^assign$/i })).toHaveCount(0);
    },
  );

  purchaseTest(
    "TC-PR-070315 Edit mode: กด Assign แล้ว dialog ปิดและรายการได้ vendor ของแถวที่เลือก",
    {
      annotation: [
        { type: "preconditions", description: "PR ขั้นตอน Purchase จาก beforeAll; สินค้ามีรายการราคาอย่างน้อย 1 รายการใน BU" },
        { type: "steps", description: "1. เปิด PR detail แล้วกด Edit\n2. เปิด Price Comparison ของรายการแรก\n3. กด Assign ที่แถวสุดท้าย\n4. Cancel เพื่อไม่บันทึก" },
        { type: "expected", description: "dialog ปิด; ชื่อ vendor ของแถวที่ Assign แสดงในตารางรายการ; Cancel แล้วออกจาก edit mode (ไม่บันทึกข้อมูล)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const pr = new PurchaseRequestPage(page);
      await gotoPRDetail(page, ref);
      await expect(pr.editModeButton(), "Edit button missing — PR did not reach an editable Purchase stage").toBeVisible({ timeout: 10_000 });
      await pr.enterEditMode();
      const rows = await openComparisonWithData(page, pr);
      expect(rows.length, "สินค้าในรายการแรกไม่มี price list ใน BU นี้ — data:reset ต้อง seed price list ให้สินค้านั้น").toBeGreaterThan(0);
      const target = rows[rows.length - 1];
      const dialog = pr.priceComparisonDialog();
      await dialog.locator("tbody tr").nth(rows.length - 1).getByRole("button", { name: /^assign$/i }).click();
      await expect(dialog).toBeHidden({ timeout: 10_000 });
      await expect(page.getByText(target.vendor_name, { exact: false }).first()).toBeVisible({ timeout: 10_000 });
      await pr.cancelEditMode();
      await expect(pr.editModeButton()).toBeVisible({ timeout: 10_000 });
    },
  );
});

purchaseTest.describe("Step 4 — Workflow Actions", () => {
  purchaseTest(
    "TC-PR-070401 Bulk Approve → PR advances to next stage (FC)",
    {
      annotation: [
        { type: "preconditions", description: "Edit mode active อยู่บน PR ขั้นตอน Purchase" },
        { type: "steps", description: "1. เข้า edit mode\n2. เลือกทุกแถว\n3. คลิก Approve ใน bulk toolbar\n4. Confirm" },
        { type: "expected", description: "ใส่ vendor/ราคา/tax แล้ว PATCH .../approve สำเร็จ และ PR ที่เปิดใหม่ไม่มีปุ่ม Edit สำหรับ Purchaser (เลื่อนไปขั้นตอนถัดไป)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page, browser }) => {
      const pr = new PurchaseRequestPage(page);
      const created = await submitPRAsRequestor(browser, { items: 1 });
      await approveAsHOD(browser, created.ref);
      await gotoPRDetail(page, created.ref);
      await expect(pr.editModeButton(), "Edit button missing — PR did not reach an editable Purchase stage").toBeVisible({ timeout: 10_000 });
      await pr.enterEditMode();
      // Purchase Approve demands vendor + price + tax profile on every item.
      await pr.allocateVendorPriceTax(0, 125);
      await bulkApprove(page, /purchase approve|^approve$/i);
      await gotoPRDetail(page, created.ref);
      await expect(pr.editModeButton(), "PR is still editable by the purchaser after Approve").toHaveCount(0, { timeout: 10_000 });
    },
  );

  purchaseTest(
    "TC-PR-070402 Bulk Reject (with reason)",
    {
      annotation: [
        { type: "preconditions", description: "Edit mode active อยู่บน PR ขั้นตอน Purchase" },
        { type: "steps", description: "1. เข้า edit mode\n2. เลือกทุกแถว\n3. คลิก Reject\n4. กรอกเหตุผล\n5. Confirm" },
        { type: "expected", description: "PATCH .../reject สำเร็จ (Reject ที่รายการแล้วต้องกด Reject ระดับเอกสารอีกครั้ง) และ PR ที่เปิดใหม่มีสถานะ Voided" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page, browser }) => {
      const pr = new PurchaseRequestPage(page);
      const created = await submitPRAsRequestor(browser, { items: 1 });
      await approveAsHOD(browser, created.ref);
      await gotoPRDetail(page, created.ref);
      await expect(pr.editModeButton(), "Edit button missing — PR did not reach an editable Purchase stage").toBeVisible({ timeout: 10_000 });
      await pr.enterEditMode();
      await bulkReject(page, REJECT_REASON);
      await gotoPRDetail(page, created.ref);
      await expect(pr.statusBadge(), "rejected PR is not Voided").toContainText(/voided/i, { timeout: 10_000 });
    },
  );

  purchaseTest(
    "TC-PR-070403 Bulk Send for Review (return to HOD)",
    {
      annotation: [
        { type: "preconditions", description: "Edit mode active อยู่บน PR ขั้นตอน Purchase" },
        { type: "steps", description: "1. เข้า edit mode\n2. เลือกทุกแถว\n3. คลิก Send for Review\n4. กรอกเหตุผล + stage\n5. Confirm" },
        { type: "expected", description: "PATCH .../review สำเร็จ และ PR ที่เปิดใหม่ไม่มีปุ่ม Edit สำหรับ Purchaser (เอกสารถูกส่งกลับ HOD)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page, browser }) => {
      const pr = new PurchaseRequestPage(page);
      const created = await submitPRAsRequestor(browser, { items: 1 });
      await approveAsHOD(browser, created.ref);
      await gotoPRDetail(page, created.ref);
      await expect(pr.editModeButton(), "Edit button missing — PR did not reach an editable Purchase stage").toBeVisible({ timeout: 10_000 });
      await pr.enterEditMode();
      await bulkSendForReview(page, REVIEW_REASON, REVIEW_STAGE);
      await page.waitForURL(/\/procurement\/purchase-request(\?|$)/, { timeout: 15_000 });
      await gotoPRDetail(page, created.ref);
      await expect(pr.editModeButton(), "PR is still editable by the purchaser after Send Back").toHaveCount(0, { timeout: 10_000 });
    },
  );

  purchaseTest(
    "TC-PR-070404 Bulk Split — split selected items",
    {
      annotation: [
        { type: "preconditions", description: "Edit mode active อยู่บน PR ขั้นตอน Purchase" },
        { type: "steps", description: "1. เข้า edit mode บน PR ที่มี 2 รายการ\n2. ติ๊กแถวแรกแถวเดียว\n3. คลิก Split" },
        { type: "expected", description: "POST .../split สำเร็จ (200) — รายการที่ติ๊กถูกย้ายไป PR ใหม่" },
        { type: "priority", description: "Low" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page, browser }) => {
      const pr = new PurchaseRequestPage(page);
      const created = await submitPRAsRequestor(browser, { items: 2 });
      await approveAsHOD(browser, created.ref);
      await gotoPRDetail(page, created.ref);
      await expect(pr.editModeButton(), "Edit button missing — PR did not reach an editable Purchase stage").toBeVisible({ timeout: 10_000 });
      await pr.enterEditMode();
      const res = await splitFirstItem(page);
      expect(res.ok(), `POST .../split was refused (${res.status()})`).toBe(true);
    },
  );

  purchaseTest(
    "TC-PR-070405 Cannot edit when PR is at non-Purchase stage (read-only)",
    {
      annotation: [
        { type: "preconditions", description: "PR อยู่ที่ขั้นตอน HOD (ยังไม่ได้รับการ approve จาก HOD) ดูโดย Purchaser" },
        { type: "steps", description: "1. Seed PR ที่ขั้นตอน HOD (ข้าม approveAsHOD)\n2. เปิด detail ในฐานะ Purchaser\n3. ตรวจสอบปุ่ม Edit" },
        { type: "expected", description: "ปุ่ม Edit ไม่มีอยู่ หรือ detail เป็น read-only — Purchaser ไม่สามารถแก้ไขได้จนกว่า PR จะถึงขั้นตอน Purchase" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Authorization" },
      ],
    },
    async ({ page, browser }) => {
      const pr = new PurchaseRequestPage(page);
      // Seed PR at HOD stage only — DO NOT call approveAsHOD
      const created = await submitPRAsRequestor(browser, { items: 1 });
      await gotoPRDetail(page, created.ref);
      // At the HOD stage the purchaser owns nothing on this document: no Edit, so no way into
      // the vendor/pricing controls.
      await expect(page).toHaveURL(new RegExp(`${LIST_PATH}/${created.ref}`));
      await expect(pr.editModeButton(), "purchaser got an Edit button on a PR still at the HOD stage").toHaveCount(0, { timeout: 10_000 });
      await pr.expandItem(0);
      await expect(pr.vendorInput(0)).toHaveCount(0);
    },
  );
});

purchaseTest.describe.serial("Golden Journey", () => {
  purchaseTest(
    "TC-PR-070901 Purchaser full flow: List → Detail → Edit (allocate vendor + price) → Bulk Approve → next stage",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Purchaser; PR ใหม่ถูก seed ที่ขั้นตอน Purchase ผ่าน submitPRAsRequestor + approveAsHOD" },
        { type: "steps", description: "1. เปิด PR list\n2. เปิด PR detail\n3. คลิก Edit\n4. กำหนด unit price ในแถวแรก\n5. เลือกทั้งหมด + Bulk Approve + Confirm" },
        { type: "expected", description: "ใส่ vendor/ราคา/tax แล้ว bulk approve สำเร็จ และ Purchaser ไม่มีปุ่ม Edit บน PR นั้นอีก (journey เสร็จสมบูรณ์)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page, browser }) => {
      purchaseTest.slow(); // cross-context seed (submit + HOD approve) is slow
      const pr = new PurchaseRequestPage(page);

      // Seed
      const created = await submitPRAsRequestor(browser, { items: 1, description: "TC-PR-070901 golden" });
      await approveAsHOD(browser, created.ref);

      // Step 1: PR List
      await pr.gotoList();
      await expect(page).toHaveURL(new RegExp(LIST_PATH));

      // Step 2: PR Detail
      await gotoPRDetail(page, created.ref);

      // Step 3: Enter Edit Mode
      await expect(pr.editModeButton(), "Edit button missing — PR did not reach an editable Purchase stage").toBeVisible({ timeout: 10_000 });
      await pr.enterEditMode();

      // Step 4: allocate vendor + price + tax on the first row
      await pr.allocateVendorPriceTax(0, 175);

      // Step 5: Bulk Approve
      await bulkApprove(page, /purchase approve|^approve$/i);

      // Next stage: the purchaser no longer owns the document.
      await gotoPRDetail(page, created.ref);
      await expect(pr.editModeButton(), "PR is still editable by the purchaser after Approve").toHaveCount(0, { timeout: 10_000 });
    },
  );
});
