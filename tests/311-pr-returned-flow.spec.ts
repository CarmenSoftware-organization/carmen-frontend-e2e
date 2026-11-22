import { test as baseTest, expect, type Browser } from "@playwright/test";
import { createAuthTest } from "./fixtures/auth.fixture";
import { PurchaseRequestPage, LIST_PATH } from "./pages/purchase-request.page";
import {
  submitPRAsRequestor,
  sendForReviewAsHOD,
  gotoPRDetail,
} from "./pages/pr-approver.helpers";
import { BU_CODE } from "./test-users";
import { buGet } from "./helpers/bu-api";
import { ensureActiveBu, getBusinessUnits, defaultBu } from "./helpers/bu";
import { BuSwitcherPage } from "./pages/bu-switcher.page";

// Measured, not guessed: every test here seeds a PR and then has HOD return it.
// `submitPRAsRequestor` alone timed at **38s** — the create drives the whole item
// cascade (workflow, location, product, qty, unit, delivery point) before the
// submit and its confirm dialog. Against the 30s default every test in the file
// died inside the fixture, which is why this spec has been 1/11 since the first
// sweep.
baseTest.describe.configure({ timeout: 180_000 });

// "Returned" is not a status: when the HOD sends a PR back it stays IN PROGRESS, its workflow
// stage moves back to "Create Request" and the list row carries a send-back hint (tooltip with
// the reason). The creator gets Edit + Submit again; Delete is offered on Draft documents only
// (FE pr-header.tsx `pr_status === PR_STATUS.DRAFT ? onDelete`). The earlier fixmes on
// 080702/080704 expected a RETURNED badge and no Edit button - both wrong for the current app.
//
// Cross-persona spec — Creator's Step 7 (Returned PR flow). Runs alongside
// 302/303/304. Source docs: docs/persona-doc/Purchase Request/Creator/
// step-07-returned-pr.md.
const requestorTest = createAuthTest("carmensoftware.dev+requestor@gmail.com");

const SEED_REASON = "Please revise — returned for review";

/** Requestor submits a 1-line PR, HOD sends it back (first stage offered = Create Request). Returns the id. */
async function seedReturned(browser: Browser, tag: string): Promise<string> {
  const created = await submitPRAsRequestor(browser, { items: 1, description: `${tag} returned` });
  await sendForReviewAsHOD(browser, created.ref, SEED_REASON);
  return created.ref;
}

/** The PR number (PRyymmnnnn) the list and the detail header show - `ref` is the id. */
async function prNo(id: string): Promise<string> {
  const r = await buGet("Requestor", `/purchase-requests/${id}`);
  expect(r.status, "read the seeded PR").toBe(200);
  return r.body.data.pr_no as string;
}

requestorTest.describe("7a — View Returned PR", () => {
  // Transaction-module rollout: pin the creator session's active BU to BLAVG
  // first so it persists (server-side) for the rest of the returned-PR flow.
  requestorTest(
    "TC-PR-080750 active BU = BLAVG",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+requestor@gmail.com ผ่าน auth fixture" },
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

  requestorTest(
    "TC-PR-080701 Returned PR appears in Creator's list with RETURNED status badge",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Requestor; PR ที่ HOD ส่งกลับ (seed ผ่าน submitPRAsRequestor + sendForReviewAsHOD)" },
        { type: "steps", description: "1. เปิด PR list มุมมอง All Documents\n2. หาแถวของ PR ที่ seed\n3. ดูสถานะ/สเตจและ hover ป้ายส่งกลับ" },
        { type: "expected", description: "แถวแสดงสถานะ 'In progress' ที่สเตจ 'Create Request' (ไม่มีสถานะ Returned) และป้ายส่งกลับแสดงเหตุผล 'Please revise' เมื่อ hover" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page, browser }) => {
      const pr = new PurchaseRequestPage(page);
      const ref = await seedReturned(browser, "TC-PR-080701");
      await pr.gotoAllDocuments();
      const row = pr.prRow(await prNo(ref));
      await expect(row).toBeVisible({ timeout: 15_000 });
      await expect(row).toContainText(/in progress/i);
      await expect(row).toContainText(/create request/i);
      await row.locator("[data-slot=tooltip-trigger]").first().hover();
      await expect(page.getByText(/please revise/i).first()).toBeVisible({ timeout: 10_000 });
    },
  );

  requestorTest(
    "TC-PR-080702 Open Returned PR detail loads with status In progress",
    {
      annotation: [
        { type: "preconditions", description: "มี PR ที่ HOD ส่งกลับ" },
        { type: "steps", description: "1. เปิดหน้า detail ของ PR ที่ถูกส่งกลับ\n2. ตรวจ URL และ status chip" },
        { type: "expected", description: "URL คือ /procurement/purchase-request/<id>; status chip เป็น 'In progress' (ไม่ใช่ Returned); stepper อยู่ที่สเตจ 'Create Request'" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page, browser }) => {
      const pr = new PurchaseRequestPage(page);
      const ref = await seedReturned(browser, "TC-PR-080702");
      await gotoPRDetail(page, ref);
      await expect(page).toHaveURL(new RegExp(`${LIST_PATH}/[0-9a-f-]{36}`));
      await expect(page.locator("main")).toContainText(await prNo(ref));
      await expect(pr.statusBadge()).toContainText(/in.progress/i);
      await expect(page.locator("main")).toContainText(/create request/i);
      await expect(pr.statusBadge()).not.toContainText(/returned/i);
    },
  );

  requestorTest(
    "TC-PR-080703 Workflow History shows the send-back transition made by HOD",
    {
      annotation: [
        { type: "preconditions", description: "หน้า detail ของ PR ที่ถูกส่งกลับ" },
        { type: "steps", description: "1. คลิก stepper (See who has handled this document) เพื่อเปิด Workflow History\n2. ดูรายการเปลี่ยนสเตจ" },
        { type: "expected", description: "แผง Workflow History แสดงรายการ 'HOD Approval → Create Request' โดย hod และ 'Create Request → HOD Approval' โดย requestor (timeline แสดงเฉพาะการย้ายสเตจ ไม่มีเหตุผล — เหตุผลอยู่ที่ hint ของแถวใน list, ดู TC-PR-080701)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page, browser }) => {
      const pr = new PurchaseRequestPage(page);
      const ref = await seedReturned(browser, "TC-PR-080703");
      await gotoPRDetail(page, ref);
      await pr.tabWorkflowHistory().click();
      const sheet = pr.workflowHistorySheet();
      await expect(sheet).toContainText(/HOD Approval\s*→\s*Create Request/, { timeout: 10_000 });
      await expect(sheet).toContainText(/hod carmensoftware/i);
      await expect(sheet).toContainText(/Create Request\s*→\s*HOD Approval/);
    },
  );

});

requestorTest.describe("7b — Edit Returned PR", () => {
  requestorTest(
    "TC-PR-080704 Edit button visible on Returned PR (Creator can re-edit)",
    {
      annotation: [
        { type: "preconditions", description: "หน้า detail ของ PR ที่ถูกส่งกลับ (Requestor เป็นเจ้าของ)" },
        { type: "steps", description: "1. ดู action toolbar" },
        { type: "expected", description: "ปุ่ม Edit แสดงและกดได้ (Creator เข้า Edit Mode เพื่อแก้ไขได้); กดแล้วมีปุ่ม Save" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page, browser }) => {
      const pr = new PurchaseRequestPage(page);
      const ref = await seedReturned(browser, "TC-PR-080704");
      await gotoPRDetail(page, ref);
      await expect(pr.editModeButton()).toBeEnabled({ timeout: 10_000 });
      await pr.enterEditMode();
      await expect(pr.saveDraftButton()).toBeVisible();
    },
  );

  requestorTest(
    "TC-PR-080705 Modify line item quantity → Save → URL stays on detail",
    {
      annotation: [
        { type: "preconditions", description: "หน้า detail ของ PR ที่ถูกส่งกลับพร้อม 1 รายการ" },
        { type: "steps", description: "1. คลิก Edit\n2. แก้ Qty แถวแรกเป็น 7\n3. คลิก Save" },
        { type: "expected", description: "บันทึกสำเร็จ (toast updated) URL ยังอยู่ที่ /procurement/purchase-request/<id>; หน้า detail แสดง Requested 7.00" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page, browser }) => {
      const pr = new PurchaseRequestPage(page);
      const ref = await seedReturned(browser, "TC-PR-080705");
      await gotoPRDetail(page, ref);
      const detailUrl = page.url();
      await pr.enterEditMode();
      await pr.editLineItem(0, { quantity: 7 });
      requestorTest.fail(true, "suspected bug: PR detail save returns 400 when a line carries both pricelist_detail_id:null and is_tax_included (message \"Unknown argument `product_id`\" on update, \"Argument `is_tax_included` is missing\" on add) - FE main payload (FE 76ec45e4 adds is_tax_included) vs dev BE f529576a9; bisected by replaying PATCH .../save: dropping either key makes it 200");
      await pr.saveEditMode();
      await expect(page).toHaveURL(detailUrl);
      await expect(page.locator("main")).toContainText(/7\.00/);
    },
  );

  requestorTest(
    "TC-PR-080706 Add new line item to Returned PR → Save",
    {
      annotation: [
        { type: "preconditions", description: "หน้า detail ของ PR ที่ถูกส่งกลับพร้อม 1 รายการ" },
        { type: "steps", description: "1. คลิก Edit\n2. คลิก Add Item แล้วเลือก Product/Unit กรอก Qty\n3. คลิก Save" },
        { type: "expected", description: "บันทึกสำเร็จ; URL ยังอยู่ที่หน้า detail; ตารางมี 2 รายการ" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page, browser }) => {
      const pr = new PurchaseRequestPage(page);
      const ref = await seedReturned(browser, "TC-PR-080706");
      await gotoPRDetail(page, ref);
      const detailUrl = page.url();
      await pr.enterEditMode();
      await expect(pr.requestedQtyInputs()).toHaveCount(1);
      await pr.addLineItem({ product: "Added in Returned", quantity: 2, uom: "ea", unitPrice: 75 });
      requestorTest.fail(true, "suspected bug: PR detail save returns 400 when a line carries both pricelist_detail_id:null and is_tax_included (message \"Unknown argument `product_id`\" on update, \"Argument `is_tax_included` is missing\" on add) - FE main payload (FE 76ec45e4 adds is_tax_included) vs dev BE f529576a9; bisected by replaying PATCH .../save: dropping either key makes it 200");
      await pr.saveEditMode();
      await expect(page).toHaveURL(detailUrl);
      await expect(pr.requestedQtyInputs().or(page.locator("tbody tr").filter({ hasText: /\d/ }))).not.toHaveCount(0);
      await expect(page.locator("main")).toContainText(/2\.00/);
    },
  );

});

requestorTest.describe("7c — Resubmit", () => {
  requestorTest(
    "TC-PR-080707 Submit confirmation dialog appears for Returned PR",
    {
      annotation: [
        { type: "preconditions", description: "หน้า detail ของ PR ที่ถูกส่งกลับ" },
        { type: "steps", description: "1. คลิก Submit" },
        { type: "expected", description: "dialog ยืนยัน (alertdialog) ปรากฏขึ้นพร้อมปุ่มยืนยัน" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page, browser }) => {
      const pr = new PurchaseRequestPage(page);
      const ref = await seedReturned(browser, "TC-PR-080707");
      await gotoPRDetail(page, ref);
      await expect(pr.submitButton()).toBeVisible({ timeout: 10_000 });
      await pr.submitButton().click();
      await expect(page.getByRole("alertdialog")).toBeVisible({ timeout: 10_000 });
      await expect(pr.confirmDialogButton(/confirm|submit|resubmit|ok|yes/i)).toBeVisible();
    },
  );

  requestorTest(
    "TC-PR-080708 Confirm submit → PR goes back to the approver",
    {
      annotation: [
        { type: "preconditions", description: "dialog ยืนยัน Submit เปิดอยู่บน PR ที่ถูกส่งกลับ" },
        { type: "steps", description: "1. คลิก Submit\n2. กด confirm ใน dialog\n3. รอผล" },
        { type: "expected", description: "backend รับ submit (2xx); PR ออกจากสเตจ Create Request — creator ไม่มีปุ่ม Submit/Edit อีก; status ยังเป็น In progress ที่สเตจ HOD Approval" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page, browser }) => {
      const pr = new PurchaseRequestPage(page);
      const ref = await seedReturned(browser, "TC-PR-080708");
      await gotoPRDetail(page, ref);
      const submitted = page.waitForResponse((r) => /\/purchase-requests\/[^/?]+\/submit/.test(r.url()) && r.request().method() === "PATCH", { timeout: 20_000 });
      await pr.submitButton().click();
      await pr.confirmDialogButton(/confirm|submit|resubmit|ok|yes/i).click();
      expect((await submitted).ok(), "resubmit was refused").toBe(true);
      await gotoPRDetail(page, ref);
      await expect(pr.statusBadge()).toContainText(/in.progress/i);
      await expect(pr.submitButton()).toHaveCount(0);
      await expect(pr.editModeButton()).toHaveCount(0);
    },
  );

});

requestorTest.describe("7d — Edge cases", () => {
  requestorTest(
    "TC-PR-080709 Cancel submit on Returned PR → URL stays on detail (still Returned)",
    {
      annotation: [
        { type: "preconditions", description: "dialog ยืนยัน Submit เปิดอยู่บน PR ที่ถูกส่งกลับ" },
        { type: "steps", description: "1. คลิก Submit\n2. คลิก Cancel ใน dialog" },
        { type: "expected", description: "dialog ปิด; URL ยังอยู่ที่หน้า detail; ปุ่ม Submit ยังอยู่ (PR ยังอยู่ที่สเตจ Create Request)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page, browser }) => {
      const pr = new PurchaseRequestPage(page);
      const ref = await seedReturned(browser, "TC-PR-080709");
      await gotoPRDetail(page, ref);
      const detailUrl = page.url();
      await pr.submitButton().click();
      const dialog = page.getByRole("alertdialog");
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: /cancel|no/i }).first().click();
      await expect(dialog).toHaveCount(0);
      await expect(page).toHaveURL(detailUrl);
      await expect(pr.submitButton()).toBeVisible();
      await expect(page.locator("main")).toContainText(/create request/i);
    },
  );

  requestorTest(
    "TC-PR-080710 Delete is not offered on a Returned PR",
    {
      annotation: [
        { type: "preconditions", description: "หน้า detail ของ PR ที่ถูกส่งกลับ (In progress ไม่ใช่ Draft)" },
        { type: "steps", description: "1. ดู action toolbar ของ Creator" },
        { type: "expected", description: "ไม่มีปุ่ม Delete — FE ให้ลบได้เฉพาะเอกสาร Draft (pr-header.tsx: onDelete เมื่อ pr_status = draft); PR ที่เข้า workflow แล้วลบไม่ได้" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page, browser }) => {
      const pr = new PurchaseRequestPage(page);
      const ref = await seedReturned(browser, "TC-PR-080710");
      await gotoPRDetail(page, ref);
      await expect(pr.editModeButton()).toBeVisible({ timeout: 10_000 });
      await expect(pr.deleteButton()).toHaveCount(0);
    },
  );

});

requestorTest.describe.serial("Golden Journey", () => {
  requestorTest(
    "TC-PR-080902 Full returned-flow: HOD returns → Creator views history → resubmits → PR back at HOD",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Requestor; PR ใหม่ถูก seed และ HOD ส่งกลับ" },
        { type: "steps", description: "1. เปิดหน้า detail ของ PR ที่ถูกส่งกลับ\n2. เปิด Workflow History ตรวจการส่งกลับ\n3. Submit + confirm" },
        { type: "expected", description: "เห็นการส่งกลับ HOD Approval → Create Request ใน Workflow History; หลัง resubmit PR ยังเป็น In progress ที่สเตจ HOD Approval และ Creator ไม่มี Submit/Edit (การแก้ Qty ก่อนส่งใหม่ทดสอบที่ 080705 ซึ่งติด BE 400)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page, browser }) => {
      const pr = new PurchaseRequestPage(page);
      const ref = await seedReturned(browser, "TC-PR-080902");
      await gotoPRDetail(page, ref);
      await expect(page).toHaveURL(new RegExp(`${LIST_PATH}/[0-9a-f-]{36}`));

      await pr.tabWorkflowHistory().click();
      await expect(pr.workflowHistorySheet()).toContainText(/HOD Approval\s*→\s*Create Request/, { timeout: 10_000 });
      await page.keyboard.press("Escape");

      const submitted = page.waitForResponse((r) => /\/purchase-requests\/[^/?]+\/submit/.test(r.url()) && r.request().method() === "PATCH", { timeout: 20_000 });
      await pr.submitButton().click();
      await pr.confirmDialogButton(/confirm|submit|resubmit|ok|yes/i).click();
      expect((await submitted).ok(), "resubmit was refused").toBe(true);
      await gotoPRDetail(page, ref);
      await expect(pr.statusBadge()).toContainText(/in.progress/i);
      await expect(page.locator("main")).toContainText(/hod approval/i);
      await expect(pr.submitButton()).toHaveCount(0);
    },
  );

});
