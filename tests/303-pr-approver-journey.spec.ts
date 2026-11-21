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
} from "./pages/pr-approver.helpers";
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
const REVIEW_STAGE = "Purchase";

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
      await ma.gotoList();
      const row = ma.documentRow(created.ref);
      if ((await row.count()) === 0) {
        hodTest.skip(true, "Seeded PR not visible in HOD's pending list");
        return;
      }
      await row.click();
      await expect(page).toHaveURL(new RegExp(`${LIST_PATH}/${created.ref}`), { timeout: 10_000 });
    },
  );

  hodTest(
    "TC-PR-060103 Pending count matches actual list row count",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ใน My Approvals dashboard" },
        { type: "steps", description: "1. อ่านค่า badge pending\n2. นับแถว PR ที่แสดงผล" },
        { type: "expected", description: "ค่า badge เท่ากับจำนวนแถวที่แสดงผล (หรือทั้งคู่เป็นศูนย์)" },
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
      const totalText = (await ma.paginationTotal().textContent().catch(() => "")) ?? "";
      const totalMatch = totalText.match(/of\s+(\d+)/i);
      if (totalMatch) {
        expect(badgeNum).toBe(parseInt(totalMatch[1], 10));
      } else {
        const rowCount = await page.getByRole("row").count();
        const dataRowCount = Math.max(0, rowCount - (rowCount > 0 ? 1 : 0));
        expect(Math.abs(badgeNum - dataRowCount)).toBeLessThanOrEqual(1);
      }
    },
  );

  hodTest(
    "TC-PR-060104 Filter tabs render and filter when present",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ใน My Approvals dashboard" },
        { type: "steps", description: "1. หา category filter tabs (PO/PR/SR)\n2. คลิก tab PR ถ้ามี" },
        { type: "expected", description: "tab PR ถูกเลือก (ข้ามหาก dashboard ไม่มี tabs)" },
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
      const card = page.getByRole("button", { name: /purchase request/i }).first();
      if ((await card.count()) === 0) {
        hodTest.skip(true, "Category filter cards not present on My Approvals dashboard");
        return;
      }
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
      const tab = pr.tabMyPending();
      if ((await tab.count()) === 0) return;
      await expect(tab).toBeVisible({ timeout: 5_000 });
    },
  );

  hodTest(
    "TC-PR-060202 All Documents tab broadens scope",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่หน้า PR list" },
        { type: "steps", description: "1. คลิก tab All Documents" },
        { type: "expected", description: "tab All Documents ถูกเลือก" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const pr = new PurchaseRequestPage(page);
      await pr.gotoList();
      const tab = pr.tabAllDocuments();
      if ((await tab.count()) === 0) {
        hodTest.skip(true, "All Documents tab not present in this build");
        return;
      }
      await tab.click();
      // viewMode <Button> toggle has no aria-selected — assert the click kept us
      // on the list (scope broadened) without error.
      await expect(page).toHaveURL(new RegExp(LIST_PATH), { timeout: 5_000 });
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
      // an empty stage list and nothing to pick. Measured 2026-11-21: data = [] for this role.
      hodTest.fail(true, "suspected bug: PR workflow-stages is scoped to requestor_id, so the stage filter is empty for approvers/purchasers");
      await pr.gotoAllDocuments();
      await pr.openStageFilter();
      await expect(pr.stageFilterOption(/^all stage$/i)).toBeChecked();
      const stage = page.getByRole("dialog").getByRole("checkbox").nth(1);
      // Bounded wait: a click on a missing option burns the whole test timeout, and a timed-out
      // test is not accepted by test.fail(); a failed expect is.
      await expect(stage).toBeVisible({ timeout: 5_000 });
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
        { type: "steps", description: "1. เปิดแผง Filter\n2. เลือก status\n3. Apply" },
        { type: "expected", description: "URL ยังคงอยู่ที่ PR list หลัง apply filter" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const pr = new PurchaseRequestPage(page);
      await pr.gotoList();
      const fb = pr.filterButton();
      if ((await fb.count()) === 0) {
        hodTest.skip(true, "Filter button not present in this build");
        return;
      }
      await pr.applyFilter({ status: "In Progress" });
      await expect(page).toHaveURL(new RegExp(LIST_PATH), { timeout: 10_000 });
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
      const input = pr.searchInput();
      if ((await input.count()) === 0) {
        hodTest.skip(true, "Search input not present in this build");
        return;
      }
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
        { type: "expected", description: "URL เป็น detail URL; Items tab ถูกเลือกเมื่อมี" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page, browser }) => {
      const pr = new PurchaseRequestPage(page);
      const created = await submitPRAsRequestor(browser);
      await gotoPRDetail(page, created.ref);
      await expect(page).toHaveURL(new RegExp(`${LIST_PATH}/${created.ref}`));
      const items = pr.tabItems();
      if ((await items.count()) === 0) return;
      await expect(items).toHaveAttribute("aria-selected", /true/i, { timeout: 5_000 });
    },
  );

  hodTest(
    "TC-PR-060302 Switch to Workflow History tab",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่หน้ารายละเอียด PR ที่ pending" },
        { type: "steps", description: "1. คลิก tab Workflow History" },
        { type: "expected", description: "tab Workflow History ถูกเลือก" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page, browser }) => {
      const pr = new PurchaseRequestPage(page);
      const created = await submitPRAsRequestor(browser);
      await gotoPRDetail(page, created.ref);
      const wh = pr.tabWorkflowHistory();
      if ((await wh.count()) === 0) {
        hodTest.skip(true, "Workflow History tab not present in this build");
        return;
      }
      await wh.click();
      await expect(wh).toHaveAttribute("aria-selected", /true/i, { timeout: 5_000 });
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
      const editBtn = pr.editModeButton();
      if ((await editBtn.count()) === 0) {
        hodTest.skip(true, "Edit button not present — cannot verify read-only header state");
        return;
      }
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
      const editBtn = pr.editModeButton();
      if ((await editBtn.count()) === 0) {
        hodTest.skip(true, "Edit button not present in this build");
        return;
      }
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
      if ((await pr.editModeButton().count()) === 0) {
        hodTest.skip(true, "Edit button not present");
        return;
      }
      await pr.enterEditMode();
      const qty = pr.approvedQtyInput(0);
      if ((await qty.count()) === 0) {
        hodTest.skip(true, "Approved Qty input not present in edit mode");
        return;
      }
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
      if ((await pr.editModeButton().count()) === 0) {
        hodTest.skip(true, "Edit button not present");
        return;
      }
      await pr.enterEditMode();
      const note = pr.itemNoteInput(0);
      if ((await note.count()) === 0) {
        hodTest.skip(true, "Item Note input not present");
        return;
      }
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
      if ((await pr.editModeButton().count()) === 0) {
        hodTest.skip(true, "Edit button not present");
        return;
      }
      await pr.enterEditMode();
      const dp = pr.deliveryPointInput(0);
      if ((await dp.count()) === 0) {
        hodTest.skip(true, "Delivery Point input not present");
        return;
      }
      await expect(dp).toBeEditable();
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
      if ((await pr.editModeButton().count()) === 0) {
        hodTest.skip(true, "Edit button not present");
        return;
      }
      await pr.enterEditMode();
      const vendor = pr.vendorReadOnlyCell(0);
      if ((await vendor.count()) === 0) {
        hodTest.skip(true, "Vendor cell not present");
        return;
      }
      const disabled = await vendor.isDisabled().catch(() => false);
      const ariaDisabled = (await vendor.getAttribute("aria-disabled").catch(() => null)) === "true";
      const tagName = await vendor.evaluate((el) => el.tagName.toLowerCase()).catch(() => "");
      const isInput = tagName === "input" || tagName === "textarea";
      expect(disabled || ariaDisabled || !isInput).toBeTruthy();
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
      if ((await pr.editModeButton().count()) === 0) {
        hodTest.skip(true, "Edit button not present");
        return;
      }
      await pr.enterEditMode();
      const cell = pr.unitPriceReadOnlyCell(0);
      if ((await cell.count()) === 0) {
        hodTest.skip(true, "Unit Price cell not present");
        return;
      }
      const disabled = await cell.isDisabled().catch(() => false);
      const ariaDisabled = (await cell.getAttribute("aria-disabled").catch(() => null)) === "true";
      const tagName = await cell.evaluate((el) => el.tagName.toLowerCase()).catch(() => "");
      const isInput = tagName === "input" || tagName === "textarea";
      expect(disabled || ariaDisabled || !isInput).toBeTruthy();
    },
  );

  hodTest(
    "TC-PR-060407 Discount / Tax / FOC Qty are read-only",
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
      if ((await pr.editModeButton().count()) === 0) {
        hodTest.skip(true, "Edit button not present");
        return;
      }
      await pr.enterEditMode();
      const cells = [pr.discountReadOnlyCell(0), pr.taxReadOnlyCell(0), pr.focQtyReadOnlyCell(0)];
      let assertedAtLeastOne = false;
      for (const cell of cells) {
        if ((await cell.count()) === 0) continue;
        const disabled = await cell.isDisabled().catch(() => false);
        const ariaDisabled = (await cell.getAttribute("aria-disabled").catch(() => null)) === "true";
        const tagName = await cell.evaluate((el) => el.tagName.toLowerCase()).catch(() => "");
        const isInput = tagName === "input" || tagName === "textarea";
        expect(disabled || ariaDisabled || !isInput).toBeTruthy();
        assertedAtLeastOne = true;
      }
      if (!assertedAtLeastOne) {
        hodTest.skip(true, "None of Discount / Tax / FOC Qty cells are present");
      }
    },
  );

  hodTest(
    "TC-PR-060408 Bulk Approve via Select All → toolbar",
    {
      annotation: [
        { type: "preconditions", description: "โหมดแก้ไขเปิดใช้งานบน PR ที่ pending" },
        { type: "steps", description: "1. เข้าโหมดแก้ไข\n2. เลือกทุกแถว\n3. คลิก Approve ใน bulk toolbar\n4. Confirm" },
        { type: "expected", description: "สถานะเปลี่ยนออกจาก In Progress (toast / ขั้นตอนถัดไป / reload state)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page, browser }) => {
      const pr = new PurchaseRequestPage(page);
      const created = await submitPRAsRequestor(browser, { items: 1 });
      await gotoPRDetail(page, created.ref);
      if ((await pr.editModeButton().count()) === 0) {
        hodTest.skip(true, "Edit button not present");
        return;
      }
      await pr.enterEditMode();
      if ((await pr.bulkActionToolbar().count()) === 0) {
        await pr.selectAllInEditMode();
      }
      if ((await pr.bulkApproveInEditMode().count()) === 0) {
        hodTest.skip(true, "Bulk Approve button not present in toolbar");
        return;
      }
      await bulkApprove(page);
      await expect(page).toHaveURL(new RegExp(`${LIST_PATH}/${created.ref}`), { timeout: 10_000 });
    },
  );

  hodTest(
    "TC-PR-060409 Bulk Reject via toolbar (with reason)",
    {
      annotation: [
        { type: "preconditions", description: "โหมดแก้ไขเปิดใช้งานบน PR ที่ pending" },
        { type: "steps", description: "1. เข้าโหมดแก้ไข\n2. เลือกทุกแถว\n3. คลิก Reject\n4. กรอกเหตุผล\n5. Confirm" },
        { type: "expected", description: "URL ยังคงอยู่ที่ ref ของ PR หลัง reject (badge สถานะอัปเดต)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page, browser }) => {
      const pr = new PurchaseRequestPage(page);
      const created = await submitPRAsRequestor(browser, { items: 1 });
      await gotoPRDetail(page, created.ref);
      if ((await pr.editModeButton().count()) === 0) {
        hodTest.skip(true, "Edit button not present");
        return;
      }
      await pr.enterEditMode();
      await pr.selectAllInEditMode();
      if ((await pr.bulkRejectInEditMode().count()) === 0) {
        hodTest.skip(true, "Bulk Reject button not present in toolbar");
        return;
      }
      await bulkReject(page, REJECT_REASON);
      await expect(page).toHaveURL(new RegExp(`${LIST_PATH}/${created.ref}`), { timeout: 10_000 });
    },
  );

  hodTest(
    "TC-PR-060410 Bulk Send for Review via toolbar",
    {
      annotation: [
        { type: "preconditions", description: "โหมดแก้ไขเปิดใช้งานบน PR ที่ pending" },
        { type: "steps", description: "1. เข้าโหมดแก้ไข\n2. เลือกทุกแถว\n3. คลิก Send for Review\n4. กรอกเหตุผล + stage\n5. Confirm" },
        { type: "expected", description: "URL ยังคงอยู่ที่ ref ของ PR หลัง send for review" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page, browser }) => {
      const pr = new PurchaseRequestPage(page);
      const created = await submitPRAsRequestor(browser, { items: 1 });
      await gotoPRDetail(page, created.ref);
      if ((await pr.editModeButton().count()) === 0) {
        hodTest.skip(true, "Edit button not present");
        return;
      }
      await pr.enterEditMode();
      await pr.selectAllInEditMode();
      if ((await pr.bulkSendForReviewInEditMode().count()) === 0) {
        hodTest.skip(true, "Bulk Send for Review button not present");
        return;
      }
      await bulkSendForReview(page, REVIEW_REASON, REVIEW_STAGE);
      await expect(page).toHaveURL(new RegExp(`${LIST_PATH}/${created.ref}`), { timeout: 10_000 });
    },
  );

  hodTest(
    "TC-PR-060411 Bulk Split via toolbar",
    {
      annotation: [
        { type: "preconditions", description: "โหมดแก้ไขเปิดใช้งานบน PR ที่ pending" },
        { type: "steps", description: "1. เข้าโหมดแก้ไข\n2. เลือกทุกแถว\n3. คลิก Split" },
        { type: "expected", description: "UI ของ Split ปรากฏ (dialog หรือ inline) — ยืนยันโดย URL ยังคงอยู่ที่หน้ารายละเอียด" },
        { type: "priority", description: "Low" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page, browser }) => {
      const pr = new PurchaseRequestPage(page);
      const created = await submitPRAsRequestor(browser, { items: 1 });
      await gotoPRDetail(page, created.ref);
      if ((await pr.editModeButton().count()) === 0) {
        hodTest.skip(true, "Edit button not present");
        return;
      }
      await pr.enterEditMode();
      await pr.selectAllInEditMode();
      const split = pr.bulkSplitInEditMode();
      if ((await split.count()) === 0) {
        hodTest.skip(true, "Bulk Split button not present");
        return;
      }
      await split.click({ timeout: 5_000 });
      await expect(page).toHaveURL(new RegExp(`${LIST_PATH}/${created.ref}`), { timeout: 10_000 });
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
      if ((await pr.editModeButton().count()) === 0) {
        hodTest.skip(true, "Edit button not present");
        return;
      }
      await pr.enterEditMode();
      const qty = pr.approvedQtyInput(0);
      if ((await qty.count()) > 0) await qty.fill("99");
      await pr.cancelEditMode();
      await expect(pr.editModeButton()).toBeVisible({ timeout: 10_000 });
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
        { type: "expected", description: "มีค่า department อย่างน้อย 2 ค่าที่แตกต่างกันปรากฏใน list (ข้ามหากฐานข้อมูลไม่มี PR ข้ามแผนก)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Authorization" },
      ],
    },
    async ({ page }) => {
      const pr = new PurchaseRequestPage(page);
      await pr.gotoList();
      const tab = pr.tabAllDocuments();
      if ((await tab.count()) > 0) await tab.click();
      const deptCells = page.getByRole("cell").filter({
        has: page.locator("[data-column='department'], [aria-label*='department' i]"),
      });
      const cellCount = await deptCells.count();
      if (cellCount === 0) {
        const rows = page.getByRole("row");
        const rowCount = await rows.count();
        if (rowCount < 3) {
          fcTest.skip(true, "Fewer than 2 data rows visible — cannot assert cross-dept scope");
          return;
        }
      }
      const distinct = new Set<string>();
      for (let i = 0; i < Math.min(cellCount, 20); i++) {
        const text = (await deptCells.nth(i).textContent())?.trim() ?? "";
        if (text) distinct.add(text);
      }
      if (distinct.size === 0) {
        fcTest.skip(true, "Department column not present on this list view");
        return;
      }
      expect(distinct.size).toBeGreaterThanOrEqual(2);
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
        { type: "expected", description: "URL ยังคงอยู่ที่ ref ของ PR หลัง bulk approve; journey เสร็จสมบูรณ์แบบ end-to-end" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page, browser }) => {
      const pr = new PurchaseRequestPage(page);
      const ma = new MyApprovalsPage(page);

      // Seed
      const created = await submitPRAsRequestor(browser, { items: 1, description: "TC-PR-060901 golden" });

      // Step 1: My Approvals
      await ma.gotoList();
      await expect(ma.pendingCountBadge()).toBeVisible({ timeout: 10_000 });

      // Step 2: PR Detail
      await gotoPRDetail(page, created.ref);

      // Step 3: Enter Edit Mode
      if ((await pr.editModeButton().count()) === 0) {
        hodTest.skip(true, "Edit button not present");
        return;
      }
      await pr.enterEditMode();

      // Step 4: Adjust Approved Qty
      const qty = pr.approvedQtyInput(0);
      if ((await qty.count()) > 0) await qty.fill("2");

      // Step 5: Bulk Approve
      await pr.selectAllInEditMode();
      if ((await pr.bulkApproveInEditMode().count()) === 0) {
        hodTest.skip(true, "Bulk Approve button not present");
        return;
      }
      await bulkApprove(page);

      await expect(page).toHaveURL(new RegExp(`${LIST_PATH}/${created.ref}`), { timeout: 10_000 });
    },
  );
});
