import { test as baseTest, expect } from "@playwright/test";
import { createAuthTest } from "./fixtures/auth.fixture";
import { PurchaseRequestPage, LIST_PATH } from "./pages/purchase-request.page";
import { MyApprovalsPage } from "./pages/my-approvals.page";
import {
  submitPRAsRequestor,
  bulkApprove,
  bulkReject,
  bulkSendForReview,
  gotoPRDetail,
  splitFirstItem,
} from "./pages/pr-approver.helpers";
import { openRecordFromRow } from "./helpers/list-row";
import { BU_CODE } from "./test-users";
import { ensureActiveBu, getBusinessUnits, defaultBu } from "./helpers/bu";
import { BuSwitcherPage } from "./pages/bu-switcher.page";

// Persona-journey spec — Approver (HOD primary, FC for scope contrast).
// Runs alongside 301-pr.spec.ts (per-action) and 302-pr-creator-journey.spec.ts.
// Source docs: docs/persona-doc/Purchase Request/Approver/INDEX.md and step-01..04.md.
const hodTest = createAuthTest("carmensoftware.dev+hod@gmail.com");
const fcTest = createAuthTest("carmensoftware.dev+fc@gmail.com");

const REJECT_REASON = "Items discontinued in catalogue";
const REVIEW_REASON = "Please verify quantity";
// An HOD can only return the document to a stage before its own: the dialog offers "Create Request".
const REVIEW_STAGE = "Create Request";

// Cases seed their PR through a second browser context (requestor: create draft ->
// add line -> save -> submit). That alone takes 30-60s on the dev backend, so the
// default 30s budget expired inside seeding and surfaced as a bogus
// "browserContext.close: Target page, context or browser has been closed".
hodTest.describe.configure({ timeout: 120_000 });
fcTest.describe.configure({ timeout: 120_000 });

hodTest.describe("Step 1 — My Approval Dashboard", () => {
  // Transaction-module rollout: pin the approver session's active BU to BLAVG
  // first so it persists (server-side) for the rest of the journey.
  hodTest(
    "TC-PR-060150 active BU = BLAVG",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+hod@gmail.com ผ่าน auth fixture" },
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

  hodTest(
    "TC-PR-060101 Dashboard loads with Total Pending count visible",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น HOD (carmensoftware.dev+hod@gmail.com)" },
        { type: "steps", description: "1. ไปที่ My Approvals\n2. ตรวจสอบว่า badge จำนวน pending แสดงผล" },
        { type: "expected", description: "My Approvals dashboard โหลด; badge จำนวน pending แสดงผล" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page }) => {
      const ma = new MyApprovalsPage(page);
      await ma.gotoList();
      await expect(ma.pendingCountBadge()).toBeVisible({ timeout: 10_000 });
    },
  );

  hodTest(
    "TC-PR-060102 Click pending PR row navigates to PR detail",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ใน My Approvals dashboard และมีแถว PR ที่ pending อย่างน้อยหนึ่งแถว" },
        { type: "steps", description: "1. คลิกแถว PR ที่ pending แรก" },
        { type: "expected", description: "URL นำทางไปยัง /procurement/purchase-request/<ref>" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page, browser }) => {
      const created = await submitPRAsRequestor(browser);
      const ma = new MyApprovalsPage(page);
      await ma.gotoListAll();
      const row = ma.documentRow(created.ref);
      await expect(row, "Seeded PR is not in the HOD's My Approvals list").toBeVisible({ timeout: 15_000 });
      await openRecordFromRow(row);
      await expect(page).toHaveURL(new RegExp(`${LIST_PATH}/${created.ref}`), { timeout: 10_000 });
    },
  );

  hodTest(
    "TC-PR-060103 Pending count matches actual list row count",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ใน My Approvals dashboard" },
        { type: "steps", description: "1. อ่านค่า badge pending\n2. อ่านยอดรวมจาก label pagination" },
        { type: "expected", description: "ค่า badge Total Pending เท่ากับยอดรวมใน label 'Showing 1–N of TOTAL' ของ pagination" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const ma = new MyApprovalsPage(page);
      await ma.gotoList();
      await expect(ma.pendingCountBadge()).toBeVisible({ timeout: 10_000 });
      const badgeText = await ma.pendingCountBadge().textContent();
      const badgeNum = parseInt((badgeText ?? "0").replace(/[^0-9]/g, ""), 10) || 0;
      // The list is paginated ("Showing 1–10 of 22"), so the visible row count
      // need not equal the badge. Compare the badge to the pagination total when
      // present; otherwise fall back to comparing against the rendered rows.
      await expect(ma.paginationTotal(), "My Approvals shows no 'Showing 1-N of TOTAL' label").toBeVisible({ timeout: 10_000 });
      const totalText = (await ma.paginationTotal().textContent()) ?? "";
      const totalMatch = totalText.match(/of\s+(\d+)/i);
      expect(totalMatch, `pagination label has no total: "${totalText}"`).not.toBeNull();
      expect(badgeNum).toBe(parseInt(totalMatch![1], 10));
    },
  );

  hodTest(
    "TC-PR-060104 Category filter chips render and the PR chip becomes active",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ใน My Approvals dashboard" },
        { type: "steps", description: "1. หา category chip (PO/PR/SR)\n2. คลิก chip Purchase Request" },
        { type: "expected", description: "chip Purchase Request แสดงผลและเปลี่ยนเป็น aria-pressed=true หลังคลิก" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const ma = new MyApprovalsPage(page);
      await ma.gotoList();
      // Redesigned dashboard exposes category filters as summary <button> cards
      // ("Purchase Request 22"), not role=tab. Click the PR card and assert it
      // becomes the active (pressed) filter.
      const card = ma.docTypeChip("pr");
      await expect(card, "Purchase Request category chip missing on My Approvals").toBeVisible({ timeout: 10_000 });
      await card.click();
      await expect(card).toHaveAttribute("aria-pressed", /true/i, { timeout: 5_000 });
    },
  );
});

hodTest.describe("Step 2 — PR List (Approver View)", () => {
  hodTest(
    "TC-PR-060201 My Pending tab shows PRs at HOD stage",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น HOD; นำทางไปที่ PR list แล้ว" },
        { type: "steps", description: "1. ไปที่ /procurement/purchase-request\n2. ตรวจสอบว่า My Pending tab ถูกเลือก" },
        { type: "expected", description: "URL อยู่ที่ PR list และ My Pending tab ถูกเลือกเมื่อมี" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page }) => {
      const pr = new PurchaseRequestPage(page);
      await pr.gotoList();
      await expect(page).toHaveURL(new RegExp(LIST_PATH));
      // Redesigned list uses a viewMode <Button> toggle (no aria-selected) —
      // assert the My Pending toggle is present (it is the default view).
      await expect(pr.tabMyPending(), "My Pending toggle missing on the PR list").toBeVisible({ timeout: 5_000 });
      // My Pending is the default view: the ?view= param is absent or my-pending, never all-document.
      await expect(page).not.toHaveURL(/view=all-document/);
    },
  );

  hodTest(
    "TC-PR-060202 All Documents tab broadens scope",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่หน้า PR list" },
        { type: "steps", description: "1. คลิก tab All Documents" },
        { type: "expected", description: "หลังคลิก All Documents URL มี ?view=all-document (ขอบเขตกว้างขึ้นจาก My Pending)" },
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

  hodTest(
    "TC-PR-060203 All Stage dropdown filters by status",
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

      hodTest.fail(true, "suspected bug: PR workflow-stages is scoped to requestor_id, so the stage filter lists no stage for approvers/purchasers");
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

  hodTest(
    "TC-PR-060204 Filter panel opens and applies",
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

  hodTest(
    "TC-PR-060205 Search by PR reference filters list",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่หน้า PR list; มี PR อย่างน้อยหนึ่งรายการที่มีเลขอ้างอิงที่รู้จัก" },
        { type: "steps", description: "1. พิมพ์เลขอ้างอิงบางส่วนในช่องค้นหา\n2. รอผลลัพธ์" },
        { type: "expected", description: "URL ยังคงอยู่ที่ PR list หลังพิมพ์ในช่องค้นหา" },
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

hodTest.describe("Step 3 — PR Detail (Read-only)", () => {
  hodTest(
    "TC-PR-060301 Detail loads with Items tab default",
    {
      annotation: [
        { type: "preconditions", description: "มี PR ที่ pending (In Progress, HOD stage) อยู่; สร้างผ่าน submitPRAsRequestor" },
        { type: "steps", description: "1. เปิดหน้ารายละเอียด PR\n2. ตรวจสอบว่า Items tab เป็นค่าเริ่มต้น" },
        { type: "expected", description: "URL เป็น detail URL; ตารางรายการสินค้า (คอลัมน์ Product + แถวรายการที่ seed) แสดงเป็นค่าเริ่มต้น" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page, browser }) => {
      const pr = new PurchaseRequestPage(page);
      const created = await submitPRAsRequestor(browser);
      await gotoPRDetail(page, created.ref);
      await expect(page).toHaveURL(new RegExp(`${LIST_PATH}/${created.ref}`));
      // The item table is the page's default content: its columns render without picking a tab.
      await expect(page.getByRole("columnheader", { name: /product/i }).first(), "item table is not shown by default").toBeVisible({ timeout: 10_000 });
      await expect(page.getByRole("button", { name: /^expand row$/i }).first(), "seeded line item is not listed").toBeVisible({ timeout: 10_000 });
    },
  );

  hodTest(
    "TC-PR-060302 Switch to Workflow History tab",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่หน้ารายละเอียด PR ที่ pending" },
        { type: "steps", description: "1. คลิก tab Workflow History" },
        { type: "expected", description: "หลังคลิกตัวเปิดประวัติ (stepper) แสดง sheet Workflow History ที่มีรายการของ requestor" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page, browser }) => {
      const pr = new PurchaseRequestPage(page);
      const created = await submitPRAsRequestor(browser);
      await gotoPRDetail(page, created.ref);
      const wh = pr.tabWorkflowHistory();
      await expect(wh, "Workflow History control missing on PR detail").toBeVisible({ timeout: 10_000 });
      await wh.click();
      // The history lists who did what; the requestor's submit is always the first entry.
      const sheet = pr.workflowHistorySheet();
      await expect(sheet, "Workflow History sheet did not open").toBeVisible({ timeout: 10_000 });
      await expect(sheet.getByText(/requestor carmensoftware/i).first(), "history shows no entry by the requestor").toBeVisible({ timeout: 10_000 });
    },
  );

  hodTest(
    "TC-PR-060303 No standalone Approve/Reject/Return buttons (BRD discrepancy)",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่หน้ารายละเอียด PR ที่ pending (โหมด read-only)" },
        { type: "steps", description: "1. ตรวจสอบ header หน้ารายละเอียด / action toolbar" },
        { type: "expected", description: "ปุ่ม Approve, Reject และ Send for Review แบบ standalone ไม่แสดงที่ header หน้า (ตาม BRD discrepancy — actions อยู่ใน Edit Mode bulk toolbar)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Authorization" },
      ],
    },
    async ({ page, browser }) => {
      const pr = new PurchaseRequestPage(page);
      const created = await submitPRAsRequestor(browser);
      await gotoPRDetail(page, created.ref);
      await expect(pr.editModeButton(), "Edit button missing — cannot verify read-only header state").toBeVisible({ timeout: 10_000 });
      await expect(pr.approveButton()).toHaveCount(0);
      await expect(pr.rejectButton()).toHaveCount(0);
      await expect(pr.sendBackButton()).toHaveCount(0);
    },
  );

  hodTest(
    "TC-PR-060304 Edit button visible (entry to bulk actions)",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่หน้ารายละเอียด PR ที่ pending" },
        { type: "steps", description: "1. ตรวจสอบ action toolbar" },
        { type: "expected", description: "ปุ่ม Edit แสดงผล (HOD สามารถเข้าโหมด Edit Mode สำหรับ bulk actions)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page, browser }) => {
      const pr = new PurchaseRequestPage(page);
      const created = await submitPRAsRequestor(browser);
      await gotoPRDetail(page, created.ref);
      await expect(pr.editModeButton()).toBeVisible({ timeout: 10_000 });
    },
  );
});

hodTest.describe("Step 4 — Edit Mode + Bulk Actions", () => {
  hodTest(
    "TC-PR-060401 Click Edit → edit mode active",
    {
      annotation: [
        { type: "preconditions", description: "หน้ารายละเอียด PR ที่ pending เปิดอยู่" },
        { type: "steps", description: "1. คลิก Edit\n2. ตรวจสอบว่าปุ่ม Save/Cancel ระดับฟอร์มปรากฏ" },
        { type: "expected", description: "ปุ่ม Save Draft (หรือ Cancel) ระดับฟอร์มแสดงผล" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page, browser }) => {
      const pr = new PurchaseRequestPage(page);
      const created = await submitPRAsRequestor(browser);
      await gotoPRDetail(page, created.ref);
      await expect(pr.editModeButton(), "Edit button missing — PR is not at the HOD stage").toBeVisible({ timeout: 10_000 });
      await pr.enterEditMode();
      // Edit mode shows BOTH Save and Cancel — take .first() to avoid a
      // strict-mode violation on the combined locator.
      await expect(pr.saveDraftButton().or(pr.cancelFormButton()).first()).toBeVisible({ timeout: 10_000 });
    },
  );

  hodTest(
    "TC-PR-060402 Approved Quantity field is editable",
    {
      annotation: [
        { type: "preconditions", description: "โหมดแก้ไขเปิดใช้งานบน PR ที่ pending และมีรายการสินค้าอย่างน้อยหนึ่งรายการ" },
        { type: "steps", description: "1. เข้าโหมดแก้ไข\n2. หาช่อง Approved Qty ในแถวแรก\n3. ตรวจสอบว่าแก้ไขได้" },
        { type: "expected", description: "ช่อง Approved Qty แสดงผลและรับค่าได้" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page, browser }) => {
      const pr = new PurchaseRequestPage(page);
      const created = await submitPRAsRequestor(browser, { items: 1 });
      await gotoPRDetail(page, created.ref);
      await expect(pr.editModeButton(), "Edit button missing — PR is not at the HOD stage").toBeVisible({ timeout: 10_000 });
      await pr.enterEditMode();
      const qty = pr.approvedQtyInput(0);
      await expect(qty, "Approved Qty input missing in edit mode").toBeVisible({ timeout: 10_000 });
      await expect(qty).toBeEditable();
      await qty.fill("3");
      await expect(qty).toHaveValue("3");
    },
  );

  hodTest(
    "TC-PR-060403 Item Note field is editable",
    {
      annotation: [
        { type: "preconditions", description: "โหมดแก้ไขเปิดใช้งานบน PR ที่ pending และมีรายการสินค้าอย่างน้อยหนึ่งรายการ" },
        { type: "steps", description: "1. เข้าโหมดแก้ไข\n2. หาช่อง Item Note\n3. พิมพ์ note" },
        { type: "expected", description: "ช่อง Item Note รับค่าที่พิมพ์" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page, browser }) => {
      const pr = new PurchaseRequestPage(page);
      const created = await submitPRAsRequestor(browser, { items: 1 });
      await gotoPRDetail(page, created.ref);
      await expect(pr.editModeButton(), "Edit button missing — PR is not at the HOD stage").toBeVisible({ timeout: 10_000 });
      await pr.enterEditMode();
      const note = pr.itemNoteInput(0);
      await expect(note, "Item Note input missing in edit mode").toBeVisible({ timeout: 10_000 });
      await note.fill("HOD note");
      await expect(note).toHaveValue("HOD note");
    },
  );

  hodTest(
    "TC-PR-060404 Delivery Point field is editable",
    {
      annotation: [
        { type: "preconditions", description: "โหมดแก้ไขเปิดใช้งานบน PR ที่ pending และมีรายการสินค้าอย่างน้อยหนึ่งรายการ" },
        { type: "steps", description: "1. เข้าโหมดแก้ไข\n2. หาช่อง Delivery Point\n3. ตรวจสอบว่าแก้ไขได้" },
        { type: "expected", description: "ช่อง Delivery Point แก้ไขได้" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page, browser }) => {
      const pr = new PurchaseRequestPage(page);
      const created = await submitPRAsRequestor(browser, { items: 1 });
      await gotoPRDetail(page, created.ref);
      await expect(pr.editModeButton(), "Edit button missing — PR is not at the HOD stage").toBeVisible({ timeout: 10_000 });
      await pr.enterEditMode();
      const dp = pr.deliveryPointInput(0);
      await expect(dp, "Delivery Point lookup is not editable in edit mode").toBeVisible({ timeout: 10_000 });
      await expect(dp).toBeEnabled();
      await dp.click();
      await expect(page.getByRole("dialog").or(page.getByRole("listbox")).first(), "Delivery Point lookup opened no list").toBeVisible({ timeout: 10_000 });
    },
  );

  hodTest(
    "TC-PR-060405 Vendor field is read-only",
    {
      annotation: [
        { type: "preconditions", description: "โหมดแก้ไขเปิดใช้งานบน PR ที่ pending และมีรายการสินค้าอย่างน้อยหนึ่งรายการ" },
        { type: "steps", description: "1. เข้าโหมดแก้ไข\n2. หาเซลล์ Vendor ในแถวแรก" },
        { type: "expected", description: "เซลล์ Vendor ถูก disabled หรือแก้ไขไม่ได้ตาม FR-PR-011A" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Authorization" },
      ],
    },
    async ({ page, browser }) => {
      const pr = new PurchaseRequestPage(page);
      const created = await submitPRAsRequestor(browser, { items: 1 });
      await gotoPRDetail(page, created.ref);
      await expect(pr.editModeButton(), "Edit button missing — PR is not at the HOD stage").toBeVisible({ timeout: 10_000 });
      await pr.enterEditMode();
      await pr.expandItem(0);
      // Read-only = the label is shown with its value as plain text and no lookup control exists.
      await expect(pr.expandedPanel().getByText(/^vendor$/i).first()).toBeVisible();
      await expect(pr.vendorReadOnlyCell(0)).toHaveCount(0);
    },
  );

  hodTest(
    "TC-PR-060406 Unit Price field is read-only",
    {
      annotation: [
        { type: "preconditions", description: "โหมดแก้ไขเปิดใช้งานบน PR ที่ pending และมีรายการสินค้าอย่างน้อยหนึ่งรายการ" },
        { type: "steps", description: "1. เข้าโหมดแก้ไข\n2. หาเซลล์ Unit Price ในแถวแรก" },
        { type: "expected", description: "เซลล์ Unit Price ถูก disabled หรือแก้ไขไม่ได้ตาม FR-PR-011A" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Authorization" },
      ],
    },
    async ({ page, browser }) => {
      const pr = new PurchaseRequestPage(page);
      const created = await submitPRAsRequestor(browser, { items: 1 });
      await gotoPRDetail(page, created.ref);
      await expect(pr.editModeButton(), "Edit button missing — PR is not at the HOD stage").toBeVisible({ timeout: 10_000 });
      await pr.enterEditMode();
      await pr.expandItem(0);
      await expect(pr.expandedPanel().getByText(/^unit price$/i).first()).toBeVisible();
      await expect(pr.unitPriceReadOnlyCell(0)).toHaveCount(0);
    },
  );

  hodTest(
    "TC-PR-060407 Discount / Tax / FOC Qty are read-only (FOC pinned: editable today)",
    {
      annotation: [
        { type: "preconditions", description: "โหมดแก้ไขเปิดใช้งานบน PR ที่ pending และมีรายการสินค้าอย่างน้อยหนึ่งรายการ" },
        { type: "steps", description: "1. เข้าโหมดแก้ไข\n2. หาเซลล์ Discount, Tax, FOC Qty" },
        { type: "expected", description: "เซลล์ทั้งสามถูก disabled หรือแก้ไขไม่ได้ตาม FR-PR-011A / FR-PR-024" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Authorization" },
      ],
    },
    async ({ page, browser }) => {
      const pr = new PurchaseRequestPage(page);
      const created = await submitPRAsRequestor(browser, { items: 1 });
      await gotoPRDetail(page, created.ref);
      await expect(pr.editModeButton(), "Edit button missing — PR is not at the HOD stage").toBeVisible({ timeout: 10_000 });
      await pr.enterEditMode();
      await pr.expandItem(0);
      await expect(pr.expandedPanel().getByText(/^discount$/i).first()).toBeVisible();
      await expect(pr.discountReadOnlyCell(0), "Discount is editable for the approver").toHaveCount(0);
      await expect(pr.taxReadOnlyCell(0), "Tax is editable for the approver").toHaveCount(0);
      // FOC Qty: the spec (FR-PR-011A / FR-PR-024) says read-only, but the FE renders it as an
      // editable input for the approver stage (pr-item-cells/foc-cell.tsx shares isQtyDisabled with
      // Approved Qty). Pinned below the Discount/Tax assertions so a regression there still fails.
      hodTest.fail(true, "suspected bug: FOC Qty is an editable input for the approver stage (spec says read-only)");
      await expect(pr.focQtyReadOnlyCell(0), "FOC Qty is editable for the approver").toHaveCount(0);
    },
  );

  hodTest(
    "TC-PR-060408 Bulk Approve via Select All → toolbar",
    {
      annotation: [
        { type: "preconditions", description: "โหมดแก้ไขเปิดใช้งานบน PR ที่ pending" },
        { type: "steps", description: "1. เข้าโหมดแก้ไข\n2. เลือกทุกแถว\n3. คลิก Approve ใน bulk toolbar\n4. Confirm" },
        { type: "expected", description: "PATCH .../approve สำเร็จและกลับหน้า list; เปิด PR ใหม่แล้ว HOD ไม่มีปุ่ม Edit (เอกสารไปขั้นตอนถัดไปแล้ว)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page, browser }) => {
      const pr = new PurchaseRequestPage(page);
      const created = await submitPRAsRequestor(browser, { items: 1 });
      await gotoPRDetail(page, created.ref);
      await expect(pr.editModeButton(), "Edit button missing — PR is not at the HOD stage").toBeVisible({ timeout: 10_000 });
      await pr.enterEditMode();
      await bulkApprove(page);
      // The document left the HOD stage: reopening it, the HOD no longer gets an Edit button.
      await gotoPRDetail(page, created.ref);
      await expect(pr.editModeButton(), "PR is still editable by the HOD after Approve").toHaveCount(0, { timeout: 10_000 });
    },
  );

  hodTest(
    "TC-PR-060409 Bulk Reject via toolbar (with reason)",
    {
      annotation: [
        { type: "preconditions", description: "โหมดแก้ไขเปิดใช้งานบน PR ที่ pending" },
        { type: "steps", description: "1. เข้าโหมดแก้ไข\n2. เลือกทุกแถว\n3. คลิก Reject ใน bulk toolbar\n4. กรอกเหตุผล + Reject ใน dialog\n5. กด Reject ระดับเอกสารที่ footer + ยืนยัน" },
        { type: "expected", description: "PATCH .../reject สำเร็จ (ต้องกด Reject ที่รายการแล้วกด Reject ระดับเอกสารอีกครั้ง) และ PR ที่เปิดใหม่มีสถานะ Voided" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page, browser }) => {
      const pr = new PurchaseRequestPage(page);
      const created = await submitPRAsRequestor(browser, { items: 1 });
      await gotoPRDetail(page, created.ref);
      await expect(pr.editModeButton(), "Edit button missing — PR is not at the HOD stage").toBeVisible({ timeout: 10_000 });
      await pr.enterEditMode();
      await bulkReject(page, REJECT_REASON);
      await gotoPRDetail(page, created.ref);
      await expect(pr.statusBadge(), "rejected PR is not Voided").toContainText(/voided/i, { timeout: 10_000 });
    },
  );

  hodTest(
    "TC-PR-060410 Bulk Send for Review via toolbar",
    {
      annotation: [
        { type: "preconditions", description: "โหมดแก้ไขเปิดใช้งานบน PR ที่ pending" },
        { type: "steps", description: "1. เข้าโหมดแก้ไข\n2. เลือกทุกแถว\n3. คลิก Send for Review\n4. กรอกเหตุผล + stage\n5. Confirm" },
        { type: "expected", description: "PATCH .../review สำเร็จ กลับหน้า list และเปิด PR ใหม่แล้ว HOD ไม่มีปุ่ม Edit (เอกสารถูกส่งกลับไป Create Request)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page, browser }) => {
      const pr = new PurchaseRequestPage(page);
      const created = await submitPRAsRequestor(browser, { items: 1 });
      await gotoPRDetail(page, created.ref);
      await expect(pr.editModeButton(), "Edit button missing — PR is not at the HOD stage").toBeVisible({ timeout: 10_000 });
      await pr.enterEditMode();
      await bulkSendForReview(page, REVIEW_REASON, REVIEW_STAGE);
      await page.waitForURL(/\/procurement\/purchase-request(\?|$)/, { timeout: 15_000 });
      await gotoPRDetail(page, created.ref);
      await expect(pr.editModeButton(), "PR is still editable by the HOD after Send Back").toHaveCount(0, { timeout: 10_000 });
    },
  );

  hodTest(
    "TC-PR-060411 Bulk Split via toolbar",
    {
      annotation: [
        { type: "preconditions", description: "โหมดแก้ไขเปิดใช้งานบน PR ที่ pending" },
        { type: "steps", description: "1. เข้าโหมดแก้ไขบน PR ที่มี 2 รายการ\n2. ติ๊กแถวแรกแถวเดียว\n3. คลิก Split" },
        { type: "expected", description: "POST .../split สำเร็จ (200) — รายการที่ติ๊กถูกย้ายไป PR ใหม่" },
        { type: "priority", description: "Low" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page, browser }) => {
      const pr = new PurchaseRequestPage(page);
      // Split needs two lines: it moves the ticked line(s) to a new PR and keeps the rest.
      const created = await submitPRAsRequestor(browser, { items: 2 });
      await gotoPRDetail(page, created.ref);
      await expect(pr.editModeButton(), "Edit button missing — PR is not at the HOD stage").toBeVisible({ timeout: 10_000 });
      await pr.enterEditMode();
      const res = await splitFirstItem(page);
      expect(res.ok(), `POST .../split was refused (${res.status()})`).toBe(true);
    },
  );

  hodTest(
    "TC-PR-060412 Cancel edit → discard changes",
    {
      annotation: [
        { type: "preconditions", description: "โหมดแก้ไขเปิดใช้งานบน PR ที่ pending และมีรายการสินค้าอย่างน้อยหนึ่งรายการ" },
        { type: "steps", description: "1. เข้าโหมดแก้ไข\n2. พิมพ์ใน Approved Qty\n3. คลิก Cancel" },
        { type: "expected", description: "ฟอร์มกลับสู่โหมดดู (ปุ่ม Edit แสดงผลอีกครั้ง)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page, browser }) => {
      const pr = new PurchaseRequestPage(page);
      const created = await submitPRAsRequestor(browser, { items: 1 });
      await gotoPRDetail(page, created.ref);
      await expect(pr.editModeButton(), "Edit button missing — PR is not at the HOD stage").toBeVisible({ timeout: 10_000 });
      await pr.enterEditMode();
      const qty = pr.approvedQtyInput(0);
      await expect(qty).toBeVisible({ timeout: 10_000 });
      await qty.fill("99");
      await pr.cancelEditMode();
      await expect(pr.editModeButton()).toBeVisible({ timeout: 10_000 });
      // Discarded: the approved quantity is back to what the requestor asked for.
      await expect(page.getByText("99.00")).toHaveCount(0);
    },
  );
});

fcTest.describe("Scope Contrast (FC)", () => {
  fcTest(
    "TC-PR-060501 FC sees PRs from multiple departments",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น FC (carmensoftware.dev+fc@gmail.com); มี PR ที่ pending ในฐานข้อมูลจากหลายแผนก" },
        { type: "steps", description: "1. ไปที่ PR list ในฐานะ FC\n2. เปิด tab All Documents\n3. อ่านค่าคอลัมน์ department จากแถว" },
        { type: "expected", description: "มีค่า department อย่างน้อย 2 ค่าที่แตกต่างกันปรากฏใน list " },
        { type: "priority", description: "High" },
        { type: "testType", description: "Authorization" },
      ],
    },
    async ({ page }) => {
      const pr = new PurchaseRequestPage(page);
      await pr.gotoAllDocuments();
      // Scope check through the API the list uses: the FC sees PRs raised from more than one department.
      const header = page.getByRole("columnheader", { name: /department/i }).first();
      await expect(header, "PR list has no Department column — cannot compare scopes").toBeVisible({ timeout: 10_000 });
      const col = await header.evaluate((el) => Array.from(el.parentElement!.children).indexOf(el));
      const cells = page.locator("tbody tr").locator(`td:nth-child(${col + 1})`);
      await expect(cells.first(), "FC's All Documents list is empty").toBeVisible({ timeout: 10_000 });
      const texts = (await cells.allInnerTexts()).map((t) => t.trim()).filter(Boolean);
      expect(new Set(texts).size, `FC sees only one department: ${[...new Set(texts)].join(", ")}`).toBeGreaterThanOrEqual(2);
    },
  );
});

hodTest.describe.serial("Golden Journey", () => {
  hodTest(
    "TC-PR-060901 HOD full flow: My Approval → List → Detail → Edit → Adjust Qty → Bulk Approve",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น HOD; มี PR ที่ pending ใหม่ seeded ผ่าน submitPRAsRequestor" },
        { type: "steps", description: "1. เปิด My Approvals\n2. เปิดหน้ารายละเอียด PR\n3. คลิก Edit\n4. ปรับ Approved Qty ในแถวแรก\n5. เลือกทั้งหมด + Bulk Approve + Confirm" },
        { type: "expected", description: "Approved Qty แก้เป็น 2 ได้; bulk approve สำเร็จ และ HOD ไม่มีปุ่ม Edit บน PR นั้นอีก (journey เสร็จสมบูรณ์)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page, browser }) => {
      const pr = new PurchaseRequestPage(page);
      const ma = new MyApprovalsPage(page);

      // Seed
      const created = await submitPRAsRequestor(browser, { items: 1, quantity: 3, description: "TC-PR-060901 golden" });

      // Step 1: My Approvals
      await ma.gotoList();
      await expect(ma.pendingCountBadge()).toBeVisible({ timeout: 10_000 });

      // Step 2: PR Detail
      await gotoPRDetail(page, created.ref);

      // Step 3: Enter Edit Mode
      await expect(pr.editModeButton(), "Edit button missing — PR is not at the HOD stage").toBeVisible({ timeout: 10_000 });
      await pr.enterEditMode();

      // Step 4: Adjust Approved Qty
      const qty = pr.approvedQtyInput(0);
      await expect(qty).toBeVisible({ timeout: 10_000 });
      // Requested 3: the approver can lower the approved quantity (raising it above the request is clamped).
      await qty.fill("2");
      await expect(qty).toHaveValue("2");

      // Step 5: Bulk Approve (marks rows, document Approve, confirm)
      await bulkApprove(page);

      // The HOD no longer owns the document.
      await gotoPRDetail(page, created.ref);
      await expect(pr.editModeButton(), "PR is still editable by the HOD after Approve").toHaveCount(0, { timeout: 10_000 });
    },
  );
});
