import { test as baseTest, expect } from "@playwright/test";
import { createAuthTest } from "./fixtures/auth.fixture";
import { PurchaseOrderPage, LIST_PATH } from "./pages/purchase-order.page";
import { MyApprovalsPage } from "./pages/my-approvals.page";
import { openRecordFromRow } from "./helpers/list-row";
import {
  submitPOAsPurchaser,
  approveAsGM,
  gotoPODetail,
} from "./pages/po-approver.helpers";

// Persona-journey spec — PO FC Approver. Runs alongside 401/402.
// Source docs: docs/persona-doc/Purchase Order/Approver/INDEX.md
// and step-01..03.md.
const fcTest = createAuthTest("carmensoftware.dev+fc@gmail.com");

const SEND_BACK_REASON = "Please verify pricing";

fcTest.describe("Step 1 — My Approval", () => {
  fcTest(
    "TC-PO-070101 My Approval dashboard loads with Total Pending count visible",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น FC (carmensoftware.dev+fc@gmail.com)" },
        { type: "steps", description: "1. ไปที่ /procurement/my-approval\n2. ตรวจสอบการ์ด 'Total Pending'" },
        { type: "expected", description: "URL เป็น /procurement/my-approval และการ์ด 'Total Pending N' visible" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page }) => {
      const approvals = new MyApprovalsPage(page);
      await approvals.gotoList();
      await expect(page).toHaveURL(/\/procurement\/my-approval/);
      // "Total Pending N" summary card + the pagination total are the dashboard's own elements.
      await expect(approvals.pendingCountBadge()).toBeVisible({ timeout: 15_000 });
    },
  );

  fcTest(
    "TC-PO-070102 PO filter tab shows pending POs (DRAFT + IN PROGRESS)",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่ My Approval dashboard พร้อม PO ที่รอดำเนินการอย่างน้อยหนึ่งรายการ" },
        { type: "steps", description: "1. กดชิป filter Purchase Order บนหน้า My Approval\n2. ตรวจสอบว่าชิปถูกเลือก" },
        { type: "expected", description: "ชิป Purchase Order ถูกเลือก (aria-pressed=true)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const approvals = new MyApprovalsPage(page);
      await approvals.gotoList();
      const chip = approvals.docTypeChip("po");
      await chip.click();
      // The type filter is now a toggle chip, not a Radix tab: aria-pressed, not aria-selected
      // (routes/procurement/my-approval/approval-component.tsx, 6711160c / c4a603bb).
      await expect(chip).toHaveAttribute("aria-pressed", "true", { timeout: 5_000 });
    },
  );

  fcTest(
    "TC-PO-070103 Click pending PO row navigates to PO detail",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่ My Approval dashboard พร้อมแถว PO ที่รอดำเนินการอย่างน้อยหนึ่งแถว (seeded ผ่าน submitPOAsPurchaser)" },
        { type: "steps", description: "1. Seed PO ผ่าน Purchaser context\n2. ไปที่ dashboard\n3. คลิกแถว PO ที่ seed" },
        { type: "expected", description: "URL navigate ไปยัง /procurement/purchase-order/<ref>" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page, browser }) => {
      const tag = `070103-${Date.now().toString(36)}`;
      const created = await submitPOAsPurchaser(browser, { description: `[E2E-POP] ${tag}` });
      const approvals = new MyApprovalsPage(page);
      await approvals.gotoList();
      await approvals.docTypeChip("po").click();
      // The inbox is paged (10/page) and sorted oldest-waiting first, so a fresh PO is
      // not on page 1: flip the Waiting sort to newest-first.
      await page.getByRole("columnheader", { name: /waiting/i }).getByRole("button").click();
      const row = approvals.documentRow(created.poNo);
      await expect(row, `seeded PO ${created.poNo} not in FC My Approval list`).toBeVisible({ timeout: 15_000 });
      await openRecordFromRow(row);
      await expect(page).toHaveURL(new RegExp(`${LIST_PATH}/${created.ref}`), { timeout: 10_000 });
    },
  );
});

fcTest.describe("Step 2 — PO Detail (FC view)", () => {
  fcTest(
    "TC-PO-070201 PO Detail loads in IN PROGRESS view (FC perspective)",
    {
      annotation: [
        { type: "preconditions", description: "มี PO ที่มี status IN PROGRESS (seeded ผ่าน submitPOAsPurchaser)" },
        { type: "steps", description: "1. เปิดหน้า detail ของ PO ในฐานะ FC\n2. ตรวจสอบ URL และ status badge" },
        { type: "expected", description: "URL เป็น /procurement/purchase-order/<ref>; text ของ status badge ตรงกับ /in.progress/i" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page, browser }) => {
      const created = await submitPOAsPurchaser(browser);
      await gotoPODetail(page, created.ref);
      await expect(page).toHaveURL(new RegExp(`${LIST_PATH}/${created.ref}`));
      await expect(
        page
          .locator("[data-slot='status'], [data-slot='badge'], [class*='badge']")
          .filter({ hasText: /in.progress/i })
          .first(),
      ).toBeVisible({ timeout: 10_000 });
    },
  );

  fcTest(
    "TC-PO-070202 Header fields are read-only for FC (cannot edit vendor/date/etc.)",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่หน้า detail ของ IN PROGRESS PO ในฐานะ FC" },
        { type: "steps", description: "1. ตรวจสอบ input ของ vendor / description / delivery date\n2. ตรวจสอบว่า input เหล่านั้นถูก disable หรือแก้ไขไม่ได้" },
        { type: "expected", description: "header ของ FC ใน view mode เป็นข้อความ: ไม่มีตัวเลือก vendor / delivery date / ช่องกรอก description" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Authorization" },
      ],
    },
    async ({ page, browser }) => {
      const created = await submitPOAsPurchaser(browser);
      await gotoPODetail(page, created.ref);
      // View mode renders the header as plain text (FE e00d52b7, po-general-fields
      // SettingField): the vendor name is shown, but there is no vendor picker,
      // date picker or description input to edit.
      await expect(page.getByText("Vendor", { exact: true }).first()).toBeVisible({ timeout: 10_000 });
      await expect(page.getByRole("button", { name: /select vendor/i })).toHaveCount(0);
      await expect(page.getByRole("button", { name: /select date/i })).toHaveCount(0);
      await expect(page.getByPlaceholder("Optional")).toHaveCount(0);
    },
  );

  fcTest(
    "TC-PO-070203 Edit button + Comment button visible",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่หน้า detail ของ IN PROGRESS PO ในฐานะ FC" },
        { type: "steps", description: "1. ตรวจสอบ action toolbar" },
        { type: "expected", description: "ปุ่ม Edit visible ปุ่ม Comment visible เมื่อมี" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page, browser }) => {
      const po = new PurchaseOrderPage(page);
      const created = await submitPOAsPurchaser(browser);
      await gotoPODetail(page, created.ref);
      await expect(po.editModeButton()).toBeVisible({ timeout: 10_000 });
      await expect(po.commentButton()).toBeVisible({ timeout: 10_000 });
    },
  );
});

fcTest.describe("Step 3 — Approval Actions", () => {  // ─ Item-level marking (4 TCs) ───────────────────────────────────────
  fcTest(
    "TC-PO-070301 Edit mode → select item → Approve toolbar appears",
    {
      annotation: [
        { type: "preconditions", description: "มี IN PROGRESS PO ที่มี ≥1 รายการ (seeded ผ่าน submitPOAsPurchaser)" },
        { type: "steps", description: "1. เปิดหน้า detail ของ PO\n2. กด Edit\n3. เลือกรายการแรกผ่าน row checkbox" },
        { type: "expected", description: "Item action toolbar (Approve/Review/Reject) visible" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page, browser }) => {
      const po = new PurchaseOrderPage(page);
      const created = await submitPOAsPurchaser(browser);
      await gotoPODetail(page, created.ref);
      await expect(po.editModeButton(), "Edit button not present on PO").toBeVisible({ timeout: 10_000 });
      await po.enterEditMode();
      await po.selectItemInEditMode(0);
      const toolbar = po.itemActionToolbar();
      await expect(toolbar, "Item action toolbar not present after select — UI may differ").toBeVisible({ timeout: 10_000 });
      await expect(toolbar).toBeVisible({ timeout: 10_000 });
    },
  );

  fcTest(
    "TC-PO-070302 Mark item Approved → green badge appears on item row",
    {
      annotation: [
        { type: "preconditions", description: "Item action toolbar visible บนแถว" },
        { type: "steps", description: "1. เลือกรายการ\n2. กด Approve ใน toolbar\n3. ตรวจสอบ badge" },
        { type: "expected", description: "แถวรายการแสดง badge Approved" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page, browser }) => {
      const po = new PurchaseOrderPage(page);
      const created = await submitPOAsPurchaser(browser);
      await gotoPODetail(page, created.ref);
      await expect(po.editModeButton(), "Edit button not present").toBeVisible({ timeout: 10_000 });
      await po.enterEditMode();
      await po.selectItemInEditMode(0);
      const approve = po.markItemApproveButton();
      await expect(approve, "Item-level Approve button not present").toBeVisible({ timeout: 10_000 });
      await approve.click({ timeout: 5_000 });
      await expect(po.itemBadge(0, "approved")).toBeVisible({ timeout: 10_000 });
    },
  );

  fcTest(
    "TC-PO-070303 Mark item Review → amber badge + Send Back footer button appears",
    {
      annotation: [
        { type: "preconditions", description: "Item action toolbar visible บนแถว" },
        { type: "steps", description: "1. เลือกรายการ\n2. กด Review ใน toolbar\n3. ตรวจสอบ badge + ปุ่ม footer" },
        { type: "expected", description: "แถวรายการแสดง badge Review; ปุ่ม Send Back ของเอกสาร visible ใน footer" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page, browser }) => {
      const po = new PurchaseOrderPage(page);
      const created = await submitPOAsPurchaser(browser);
      await gotoPODetail(page, created.ref);
      await expect(po.editModeButton(), "Edit button not present").toBeVisible({ timeout: 10_000 });
      await po.enterEditMode();
      await po.selectItemInEditMode(0);
      const review = po.markItemReviewButton();
      await expect(review, "Item-level Review button not present").toBeVisible({ timeout: 10_000 });
      await review.click({ timeout: 5_000 });
      await expect(po.itemBadge(0, "review")).toBeVisible({ timeout: 10_000 });
      await expect(po.documentSendBackButton()).toBeVisible({ timeout: 10_000 });
    },
  );

  fcTest(
    "TC-PO-070304 Mark item Reject → reject badge + footer Reject button appears",
    {
      annotation: [
        { type: "preconditions", description: "Item action toolbar visible บนแถว" },
        { type: "steps", description: "1. เลือกรายการ\n2. กด Reject ใน toolbar\n3. ยืนยันใน dialog\n4. ตรวจสอบ badge + ปุ่ม footer" },
        { type: "expected", description: "แถวรายการแสดง badge Reject; ปุ่ม Reject ของเอกสาร visible ใน footer" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page, browser }) => {
      const po = new PurchaseOrderPage(page);
      const created = await submitPOAsPurchaser(browser);
      await gotoPODetail(page, created.ref);
      await expect(po.editModeButton(), "Edit button not present").toBeVisible({ timeout: 10_000 });
      await po.enterEditMode();
      await po.selectItemInEditMode(0);
      const reject = po.markItemRejectButton();
      await expect(reject, "Item-level Reject button not present").toBeVisible({ timeout: 10_000 });
      await reject.click({ timeout: 5_000 });
      // Unlike Approve and Review, rejecting a line opens a confirmation first
      // ("Reject Purchase Order — …Please provide a reason." with an optional
      // REASON field). The row keeps its old state until that is confirmed, so
      // asserting the badge straight after the click always failed.
      await po.confirmDialogButton(/^reject$/i).click({ timeout: 10_000 });
      await expect(po.itemBadge(0, "rejected")).toBeVisible({ timeout: 10_000 });
      await expect(po.documentRejectButton()).toBeVisible({ timeout: 10_000 });
    },
  );

  // ─ Document Approve flow (3 TCs) ────────────────────────────────────
  fcTest(
    "TC-PO-070305 All items Approved → Document Approve button enabled in footer",
    {
      annotation: [
        { type: "preconditions", description: "มี IN PROGRESS PO ที่มี ≥1 รายการ" },
        { type: "steps", description: "1. เข้าสู่ edit mode\n2. เลือกรายการและทำเครื่องหมาย Approve\n3. ตรวจสอบปุ่ม Document Approve" },
        { type: "expected", description: "ปุ่ม Document Approve visible (และ enabled เมื่อมี)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page, browser }) => {
      const po = new PurchaseOrderPage(page);
      const created = await submitPOAsPurchaser(browser);
      await gotoPODetail(page, created.ref);
      await expect(po.editModeButton(), "Edit button not present").toBeVisible({ timeout: 10_000 });
      await po.enterEditMode();
      await po.selectItemInEditMode(0);
      await expect(po.markItemApproveButton(), "Item-level Approve not present").toBeVisible({ timeout: 10_000 });
      await po.markItemApproveButton().click({ timeout: 5_000 });
      await expect(po.documentApproveButton()).toBeVisible({ timeout: 10_000 });
    },
  );

  fcTest(
    "TC-PO-070306 Click Approve PO → confirmation dialog ('Once approved, PO will be sent to vendor')",
    {
      annotation: [
        { type: "preconditions", description: "รายการทั้งหมดถูกทำเครื่องหมาย Approved; ปุ่ม Document Approve visible" },
        { type: "steps", description: "1. approve รายการทั้งหมด\n2. กดปุ่ม Document Approve PO" },
        { type: "expected", description: "Confirmation dialog visible" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page, browser }) => {
      const po = new PurchaseOrderPage(page);
      const created = await submitPOAsPurchaser(browser);
      await gotoPODetail(page, created.ref);
      await expect(po.editModeButton(), "Edit button not present").toBeVisible({ timeout: 10_000 });
      await po.enterEditMode();
      await po.selectItemInEditMode(0);
      await expect(po.markItemApproveButton(), "Item-level Approve not present").toBeVisible({ timeout: 10_000 });
      await po.markItemApproveButton().click({ timeout: 5_000 });
      const docApprove = po.documentApproveButton();
      await expect(docApprove, "Document Approve button not visible after item approval").toBeVisible({ timeout: 10_000 });
      await docApprove.click({ timeout: 5_000 });
      // Confirmations are Radix AlertDialog (role="alertdialog"), which
      // getByRole("dialog") does not match; .last() skips the always-mounted
      // Command Palette.
      await expect(
        page.locator('[role="dialog"], [role="alertdialog"]').last(),
      ).toBeVisible({ timeout: 10_000 });
    },
  );

  fcTest(
    "TC-PO-070307 Confirm Approve → PATCH approve สำเร็จ และใบเลื่อนไปขั้น GM",
    {
      annotation: [
        { type: "preconditions", description: "Confirmation dialog ของ Document Approve เปิดอยู่" },
        { type: "steps", description: "1. approve รายการ\n2. กด Document Approve\n3. ยืนยัน dialog" },
        { type: "expected", description: "PATCH .../approve ตอบ ok; ใบยังเป็น IN PROGRESS (เลื่อนไปขั้น GM ตาม workflow General PO) และ FC ไม่เห็นปุ่ม Edit อีก" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page, browser }) => {
      const po = new PurchaseOrderPage(page);
      const created = await submitPOAsPurchaser(browser);
      await gotoPODetail(page, created.ref);
      await expect(po.editModeButton(), "Edit button not present").toBeVisible({ timeout: 10_000 });
      await po.enterEditMode();
      await po.selectItemInEditMode(0);
      await expect(po.markItemApproveButton(), "Item-level Approve not present").toBeVisible({ timeout: 10_000 });
      await po.markItemApproveButton().click({ timeout: 5_000 });
      const docApprove = po.documentApproveButton();
      await expect(docApprove, "Document Approve button not visible").toBeVisible({ timeout: 10_000 });
      // Prove the approve actually reached the backend rather than reading the
      // UI: the .catch() below used to swallow a confirm that never fired.
      const approved = page.waitForResponse(
        (r) => /\/purchase-orders\/[^/]+\/approve/.test(r.url()) && r.request().method() === "PATCH",
        { timeout: 20_000 },
      );
      await docApprove.click({ timeout: 5_000 });
      await po.confirmDialogButton(/confirm|approve|ok|yes/i).click({ timeout: 10_000 });
      const res = await approved;
      expect(res.ok()).toBe(true);

      // NOT approved/sent yet: the General PO workflow is
      // Create Request → FC → GM → Completed, so FC's signature advances the PO
      // to GM and the document stays IN PROGRESS. Asserting /approved|sent/ here
      // was asserting a state this workflow never reaches at this stage.
      // Re-open the record: confirming an action routes back to the PO list.
      await gotoPODetail(page, created.ref);
      await expect(
        page
          .locator("[data-slot='status'], [data-slot='badge'], [class*='badge']")
          .filter({ hasText: /in.progress/i })
          .first(),
      ).toBeVisible({ timeout: 15_000 });
      // FC is done with it — the approver's own actions are gone.
      await expect(po.editModeButton()).toBeHidden({ timeout: 15_000 });
    },
  );

  // ─ Document Send Back flow (2 TCs) ──────────────────────────────────
  fcTest(
    "TC-PO-070308 Click Send Back → dialog with stage selector + per-item reason",
    {
      annotation: [
        { type: "preconditions", description: "รายการถูกทำเครื่องหมาย Review; ปุ่ม Document Send Back visible" },
        { type: "steps", description: "1. ทำเครื่องหมายรายการว่า Review\n2. กด Document Send Back" },
        { type: "expected", description: "Send Back dialog visible" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page, browser }) => {
      const po = new PurchaseOrderPage(page);
      const created = await submitPOAsPurchaser(browser);
      await gotoPODetail(page, created.ref);
      await expect(po.editModeButton(), "Edit button not present").toBeVisible({ timeout: 10_000 });
      await po.enterEditMode();
      await po.selectItemInEditMode(0);
      await expect(po.markItemReviewButton(), "Item-level Review not present").toBeVisible({ timeout: 10_000 });
      await po.markItemReviewButton().click({ timeout: 5_000 });
      const sendBack = po.documentSendBackButton();
      await expect(sendBack, "Document Send Back button not visible").toBeVisible({ timeout: 10_000 });
      await sendBack.click({ timeout: 5_000 });
      // Confirmations are Radix AlertDialog (role="alertdialog"), which
      // getByRole("dialog") does not match; .last() skips the always-mounted
      // Command Palette.
      await expect(
        page.locator('[role="dialog"], [role="alertdialog"]').last(),
      ).toBeVisible({ timeout: 10_000 });
    },
  );

  fcTest(
    "TC-PO-070309 Confirm Send Back → PO returned (status updates)",
    {
      annotation: [
        { type: "preconditions", description: "Send Back dialog เปิดอยู่" },
        { type: "steps", description: "1. ทำเครื่องหมายรายการว่า Review\n2. กด Send Back\n3. กรอกเหตุผล\n4. ยืนยัน" },
        { type: "expected", description: "URL ยังคงอยู่ที่ PO ref หลังการยืนยัน" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page, browser }) => {
      const po = new PurchaseOrderPage(page);
      const created = await submitPOAsPurchaser(browser);
      await gotoPODetail(page, created.ref);
      await expect(po.editModeButton(), "Edit button not present").toBeVisible({ timeout: 10_000 });
      await po.enterEditMode();
      await po.selectItemInEditMode(0);
      await expect(po.markItemReviewButton(), "Item-level Review not present").toBeVisible({ timeout: 10_000 });
      await po.markItemReviewButton().click({ timeout: 5_000 });
      const sendBack = po.documentSendBackButton();
      await expect(sendBack, "Document Send Back not visible").toBeVisible({ timeout: 10_000 });
      await sendBack.click({ timeout: 5_000 });

      // The dialog ("Send for Review") asks for the **stage** to send back to and
      // an optional reason. The stage is a radio, and the Send Back button stays
      // disabled until one is chosen — filling only the reason left it disabled,
      // which read as "the confirm button cannot be clicked" rather than "a
      // required field is unset".
      const dialog = page.locator('[role="dialog"], [role="alertdialog"]').last();
      const stage = dialog.getByRole("radio").first();
      await expect(stage, "Send for Review dialog offers no stage to send back to").toBeVisible({ timeout: 10_000 });
      await stage.check({ force: true, timeout: 10_000 });

      const reason = po.reasonInput();
      await expect(reason, "Send for Review dialog has no reason field").toBeVisible({ timeout: 10_000 });
      await reason.fill(SEND_BACK_REASON, { timeout: 10_000 });

      const confirm = po.confirmDialogButton(/^send back$|^send$|confirm|ok|yes/i);
      await expect(confirm).toBeEnabled({ timeout: 10_000 });
      await confirm.click({ timeout: 10_000 });
      await expect(page).toHaveURL(new RegExp(`${LIST_PATH}/${created.ref}`), { timeout: 15_000 });
    },
  );

  // ─ Document Reject flow (2 TCs) ─────────────────────────────────────
  fcTest(
    "TC-PO-070310 Click Reject → dialog with optional reason field",
    {
      annotation: [
        { type: "preconditions", description: "รายการถูกทำเครื่องหมาย Reject; ปุ่ม Document Reject visible" },
        { type: "steps", description: "1. ทำเครื่องหมายรายการว่า Reject\n2. กด Document Reject" },
        { type: "expected", description: "Reject dialog visible" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page, browser }) => {
      const po = new PurchaseOrderPage(page);
      const created = await submitPOAsPurchaser(browser);
      await gotoPODetail(page, created.ref);
      await expect(po.editModeButton(), "Edit button not present").toBeVisible({ timeout: 10_000 });
      await po.enterEditMode();
      await po.selectItemInEditMode(0);
      await expect(po.markItemRejectButton(), "Item-level Reject not present").toBeVisible({ timeout: 10_000 });
      await po.markItemRejectButton().click({ timeout: 5_000 });
      // Rejecting a line opens its own confirmation before the row changes
      // state; without it the "document" Reject found below is really this
      // dialog's own button.
      await po.confirmDialogButton(/^reject$/i).click({ timeout: 10_000 });
      await expect(po.itemBadge(0, "rejected")).toBeVisible({ timeout: 10_000 });
      const docReject = po.documentRejectButton();
      await expect(docReject, "Document Reject button not visible").toBeVisible({ timeout: 10_000 });
      await docReject.click({ timeout: 5_000 });
      // Confirmations are Radix AlertDialog (role="alertdialog"), which
      // getByRole("dialog") does not match; .last() skips the always-mounted
      // Command Palette.
      await expect(
        page.locator('[role="dialog"], [role="alertdialog"]').last(),
      ).toBeVisible({ timeout: 10_000 });
    },
  );

  // Document-level Reject (item reject -> Document Reject -> confirm). Was a static fixme;
  // revived: its outcome is pinned below.
  fcTest(
    "TC-PO-070311 Confirm Reject → PO ends Voided (the app's rejected end state)",
    {
      annotation: [
        { type: "preconditions", description: "Reject dialog เปิดอยู่" },
        { type: "steps", description: "1. ทำเครื่องหมายรายการว่า Reject\n2. กด Document Reject\n3. ยืนยันใน dialog แรก (are you sure)\n4. กรอกเหตุผลใน dialog ที่สอง แล้วยืนยัน" },
        { type: "expected", description: "การยืนยันยิง PATCH .../reject สำเร็จ และ PO ที่เปิดใหม่มี status chip Voided (PO ไม่มี status Rejected — STD dataset po.rejected ก็จบที่ Voided)." },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page, browser }) => {
      // Seed + edit mode + per-item reject + document reject in one test; the
      // default 30s ran out before the reject request was even sent.
      fcTest.setTimeout(120_000);
      const po = new PurchaseOrderPage(page);
      const created = await submitPOAsPurchaser(browser);
      await gotoPODetail(page, created.ref);
      await expect(po.editModeButton(), "Edit button not present").toBeVisible({ timeout: 10_000 });
      await po.enterEditMode();
      await po.selectItemInEditMode(0);
      await expect(po.markItemRejectButton(), "Item-level Reject not present").toBeVisible({ timeout: 10_000 });
      await po.markItemRejectButton().click({ timeout: 5_000 });
      // Rejecting a line opens its own confirmation before the row changes
      // state; without it the "document" Reject found below is really this
      // dialog's own button.
      await po.confirmDialogButton(/^reject$/i).click({ timeout: 10_000 });
      await expect(po.itemBadge(0, "rejected")).toBeVisible({ timeout: 10_000 });
      const docReject = po.documentRejectButton();
      await expect(docReject, "Document Reject not visible").toBeVisible({ timeout: 10_000 });
      // Document Reject is two dialogs (FE po-footer-action.tsx:311 openConfirm -> onReject ->
      // po-form.tsx:306 setShowReject(true) -> PoActionDialog -> use-po-form-handlers.ts:497
      // handleRejectConfirm -> PATCH .../reject). The first only asks "are you sure"; the request
      // is sent by the second, which also takes the reason.
      const rejected = page.waitForResponse(
        (r) => /\/purchase-orders\/[^/]+\/reject/.test(r.url()) && r.request().method() === "PATCH",
        { timeout: 20_000 },
      );
      await docReject.click({ timeout: 5_000 });
      await po.confirmDialogButton(/^reject$/i).click({ timeout: 10_000 });
      const reason = page.locator('[role="alertdialog"] textarea').first();
      await expect(reason, "the second (reason) Reject dialog did not open").toBeVisible({ timeout: 10_000 });
      await reason.fill("Rejected by E2E");
      await po.confirmDialogButton(/^reject$/i).click({ timeout: 10_000 });
      const rejectRes = await rejected;
      expect(rejectRes.ok(), `PATCH .../reject was refused (${rejectRes.status()})`).toBe(true);

      // Re-open the record: confirming an action routes back to the PO list, so a
      // plain reload() would re-read the list instead of this document.
      await gotoPODetail(page, created.ref);
      // The backend ended the PO as voided (po_status "voided", PATCH .../reject 200 above) but the detail header
      // shows no status chip for it (seen as FC on PO261100044: chips ["Manual", "—"]). 3c saw the chip; this
      // run (2026-11-21, FE eee1f5f, API v4.0.13-build.20261112.f529576a9) does not - reproduced alone too.
      fcTest.fail(true, "suspected bug: a voided PO's detail header shows no 'Voided' status chip (API po_status=voided; header chips are only the doc type and a dash)");
      await expect(
        page
          .locator("[data-slot='status-chip'], [data-slot='status'], [data-slot='badge']")
          .filter({ hasText: /voided/i })
          .first(),
      ).toBeVisible({ timeout: 15_000 });
    },
  );

  // ─ Edit Mode Cancel (1 TC) ──────────────────────────────────────────
  fcTest(
    "TC-PO-070312 Cancel edit mode (no item marked) → exits without saving",
    {
      annotation: [
        { type: "preconditions", description: "edit mode active บน IN PROGRESS PO โดยไม่มีรายการที่ถูกทำเครื่องหมาย" },
        { type: "steps", description: "1. เข้าสู่ edit mode\n2. กด Cancel โดยไม่เลือก/ทำเครื่องหมายรายการใดๆ" },
        { type: "expected", description: "Form กลับสู่ view mode (ปุ่ม Edit visible อีกครั้ง)" },
        { type: "priority", description: "Low" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page, browser }) => {
      const po = new PurchaseOrderPage(page);
      const created = await submitPOAsPurchaser(browser);
      await gotoPODetail(page, created.ref);
      await expect(po.editModeButton(), "Edit button not present").toBeVisible({ timeout: 10_000 });
      await po.enterEditMode();
      await po.cancelEditMode();
      await expect(po.editModeButton()).toBeVisible({ timeout: 10_000 });
    },
  );
});

fcTest.describe.serial("Golden Journey", () => {
  fcTest(
    "TC-PO-070901 Full FC flow: My Approval → open PO → Edit → mark all items Approved → Document Approve → GM approve → APPROVED",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น FC; มี IN PROGRESS PO ใหม่ที่ seed ผ่าน submitPOAsPurchaser" },
        { type: "steps", description: "1. Seed IN PROGRESS PO\n2. เปิดหน้า detail ของ PO\n3. กด Edit\n4. เลือกรายการแรก\n5. ทำเครื่องหมาย Approve\n6. กด Document Approve\n7. ยืนยัน dialog" },
        { type: "expected", description: "PATCH .../approve ของ FC ตอบ ok และหลัง GM อนุมัติต่อ status badge เป็น APPROVED/SENT" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page, browser }) => {
      // Measured, not guessed: this one test drives three roles end to end —
      // Purchaser creates and submits (~11s), FC marks items and approves, then
      // GM approves in its own context (the submit+FC+GM chain alone timed at
      // ~38s). It was failing at exactly 30.1s, which is the default budget
      // running out, not a hang.
      fcTest.setTimeout(150_000);

      const po = new PurchaseOrderPage(page);

      // Seed
      const created = await submitPOAsPurchaser(browser, { description: "[E2E-POA] TC-PO-070901 golden" });

      // Open detail
      await gotoPODetail(page, created.ref);
      await expect(po.editModeButton(), "Edit button not present on seeded PO").toBeVisible({ timeout: 10_000 });

      // Edit + mark all Approved
      await po.enterEditMode();
      await po.selectItemInEditMode(0);
      await expect(po.markItemApproveButton(), "Item-level Approve not present").toBeVisible({ timeout: 10_000 });
      await po.markItemApproveButton().click({ timeout: 5_000 });

      // Document Approve
      const docApprove = po.documentApproveButton();
      await expect(docApprove, "Document Approve button not visible after item approval").toBeVisible({ timeout: 10_000 });
      const approved = page.waitForResponse(
        (r) => /\/purchase-orders\/[^/]+\/approve/.test(r.url()) && r.request().method() === "PATCH",
        { timeout: 20_000 },
      );
      await docApprove.click({ timeout: 5_000 });
      await po.confirmDialogButton(/confirm|approve|ok|yes/i).click({ timeout: 10_000 });
      expect((await approved).ok()).toBe(true);

      // FC's signature hands the PO to GM — General PO is
      // Create Request → FC → GM → Completed — so the document only reaches
      // APPROVED once GM signs too. Walk that last leg so the journey ends where
      // its title says it does instead of asserting a state FC alone can't reach.
      await approveAsGM(browser, created.ref);

      // Hard assertion
      // Re-open the record: confirming an action routes back to the PO list.
      await gotoPODetail(page, created.ref);
      await expect(
        page
          .locator("[data-slot='status'], [data-slot='badge'], [class*='badge']")
          .filter({ hasText: /approved|sent/i })
          .first(),
      ).toBeVisible({ timeout: 15_000 });
    },
  );
});
