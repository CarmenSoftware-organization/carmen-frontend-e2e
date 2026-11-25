import { test as baseTest, expect } from "@playwright/test";
import { createAuthTest } from "./fixtures/auth.fixture";
import { PurchaseOrderPage, LIST_PATH } from "./pages/purchase-order.page";
import { openRecordFromRow } from "./helpers/list-row";

// ─────────────────────────────────────────────────────────────────────────
// Multi-role auth — Purchasing Staff/Manager == carmensoftware.dev+purchase@gmail.com.
// Permission-denial cases use carmensoftware.dev+requestor@gmail.com (no PO permission).
// requestor is declared LAST so doc default role reads "Purchase".
// (See generate-user-stories.ts:findAuthRole — last createAuthTest wins.)
// ─────────────────────────────────────────────────────────────────────────
const requestorTest = createAuthTest("carmensoftware.dev+requestor@gmail.com");
// NOTE: TC-PO-010001 consumes an approved PR (From-PR wizard) -> run `bun run data:reset --yes`
// before a full run of this file; the STD dataset (scripts/data-reset) seeds the PRs and the
// Draft / Voided / Approved / Sent / Partial / Completed POs the status cases below read.
const purchaseTest = createAuthTest("carmensoftware.dev+purchase@gmail.com");

const noAuthTest = baseTest;

const SKIP_NOTE_BACKEND =
  "Backend / system-level behavior (sequence generation, calculations, budget integration, GRN sync, scheduled jobs). " +
  "Cannot be exercised reliably through the UI in E2E. Tracked here for documentation; verify with API/integration tests.";

const SKIP_NOTE_TIME =
  "Time-based / cron behavior (daily 2 AM cleanup, 3-day delivery reminder). " +
  "Not feasible in E2E without fixed-clock control. Verify via integration tests with mocked time.";

// ═════════════════════════════════════════════════════════════════════════
// TC-PO-900001 — Create PO from Approved PR
// ═════════════════════════════════════════════════════════════════════════
purchaseTest.describe("PO — Create from PR", () => {
  purchaseTest(
    "TC-PO-010001 Happy Path - Create PO from Approved PR",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Purchasing Staff/Manager; ผู้ใช้มีสิทธิ์สร้าง PO; มี PR ที่ approved อย่างน้อยหนึ่งรายการ; งบประมาณมีเพียงพอ" },
        {
          type: "steps",
          description:
            "1. ไปที่ /procurement/purchase-order\n2. กดปุ่ม dropdown 'New PO'\n3. เลือก 'Create from Purchase Requests'\n4. เลือก PR ที่ approved\n5. กรอกรายละเอียด PO\n6. กด 'Save PO'",
        },
        { type: "expected", description: "Purchase Order ถูกสร้างสำเร็จและเชื่อมโยงกับ Purchase Request ที่เลือก" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const po = new PurchaseOrderPage(page);
      await po.gotoList();
      await po.newPODropdown().click({ timeout: 10_000 });
      const fromPR = po.createFromPRMenuItem();
      await expect(fromPR).toBeVisible({ timeout: 10_000 });
      await fromPR.click({ timeout: 10_000 });
      await expect(page).toHaveURL(/purchase-order\/from-pr/, { timeout: 15_000 });

      // Wizard (FE c9495d99): pick the target workflow -> tick approved PRs -> Next
      // (Review POs) -> Confirm. The standard dataset (data:reset) seeds approved
      // PRs, so an empty table is a missing-data failure, not a skip.
      await page.getByRole("combobox").filter({ hasText: /select workflow/i }).click();
      await page.getByRole("option").first().click();
      const prRows = page.locator("tbody tr").filter({ hasText: /PR\d{6,}/ });
      await expect(
        prRows.first(),
        "no approved PR in TEST BU — run `bun run data:reset --yes` (STD pr.approved docs)",
      ).toBeVisible({ timeout: 15_000 });
      await prRows.first().getByRole("checkbox").click();
      await page.getByRole("button", { name: /^next/i }).click();
      await expect(page.getByText(/review pos/i).first()).toBeVisible({ timeout: 10_000 });
      await expect(page.locator("tbody tr").filter({ hasText: /PR\d{6,}/ })).toHaveCount(1);
      await page.getByRole("button", { name: /^confirm$/i }).click({ timeout: 10_000 });
      // "Create purchase orders?" alert dialog: its own Confirm creates the PO(s).
      const created = page.waitForResponse(
        (r) => /purchase-orders/.test(r.url()) && r.request().method() === "POST",
        { timeout: 20_000 },
      );
      await page.getByRole("alertdialog").getByRole("button", { name: /^confirm$/i }).click({ timeout: 10_000 });
      expect((await created).ok()).toBe(true);
      // The wizard stays on /from-pr and swaps to a result card listing the new PO.
      await expect(page.getByText(/1 purchase orders created/i)).toBeVisible({ timeout: 20_000 });
      await expect(page.getByRole("link", { name: /^PO\d{6,}/ }).first()).toBeVisible();
    },
  );

  purchaseTest(
    "TC-PO-010003 Edge Case - From-PR wizard shows empty guidance before a workflow is chosen",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็นผู้ใช้ที่มีสิทธิ์สร้าง PO; หน้า wizard 'From Purchase Request' ยังไม่ได้เลือก workflow (ชุดข้อมูล STD มี PR ที่ approved เสมอ จึงสร้างสถานะ 'ไม่มี PR' ไม่ได้ — เคสนี้ตรวจ empty state ที่เข้าถึงได้จริง)" },
        {
          type: "steps",
          description:
            "1. ไปที่ /procurement/purchase-order\n2. กดปุ่ม 'New Purchase Order'\n3. เลือก 'From Purchase Request'\n4. ยังไม่เลือก workflow",
        },
        { type: "expected", description: "wizard แสดง empty state 'Select a workflow first' (ไม่มีตาราง PR ให้เลือก) และปุ่ม Next ยังกดไม่ได้" },
        { type: "priority", description: "Low" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      const po = new PurchaseOrderPage(page);
      await po.gotoList();
      await po.newPODropdown().click({ timeout: 5_000 });
      const fromPR = po.createFromPRMenuItem();
      await expect(fromPR, "expected element missing (fromPR) - seed data or UI changed").toBeVisible({ timeout: 10_000 });
      await fromPR.click();
      // FE from-pr/step-select-pr.tsx: no workflow -> EmptyComponent "Select a workflow first".
      await expect(page.getByText(/select a workflow first/i).first()).toBeVisible({ timeout: 10_000 });
      await expect(page.locator("tbody tr").filter({ hasText: /PR\d{6,}/ })).toHaveCount(0);
      await expect(page.getByRole("button", { name: /^next/i })).toBeDisabled();
    },
  );

  purchaseTest(
    "TC-PO-010004 Negative - Save PO without a vendor assigned",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้มีสิทธิ์สร้าง PO; vendor เลือกได้จาก dialog ของ vendor ที่มีอยู่เท่านั้น (ใส่ vendor ที่ไม่ถูกต้องไม่ได้) จึงทดสอบกรณีที่เข้าถึงได้คือไม่ได้เลือก vendor" },
        {
          type: "steps",
          description:
            "1. ไปที่ /procurement/purchase-order/new\n2. เลือก workflow และวันที่ส่งของ แต่ไม่เลือก vendor\n3. กด Save",
        },
        { type: "expected", description: "ระบบไม่สร้าง PO ค้างอยู่ที่ /new และแสดง toast \"Some fields aren't filled in correctly\" พร้อมช่อง vendor ที่ยังไม่ได้เลือก" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const po = new PurchaseOrderPage(page);
      await po.gotoNew();
      await po.selectFirstWorkflow();
      await po.selectDeliveryDate();
      await po.saveButton().click({ timeout: 10_000 });
      await expect(page.getByText(/fields aren't filled in correctly/i).first()).toBeVisible({ timeout: 10_000 });
      await expect(page.getByRole("button", { name: /select vendor/i }).first()).toBeVisible();
      await expect(page).toHaveURL(/purchase-order\/new/);
    },
  );
});

requestorTest.describe("PO — Create from PR — Permission denial", () => {
  requestorTest(
    "TC-PO-010002 Negative - No Permission to Create PO",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็นผู้ใช้ที่ไม่มีสิทธิ์สร้าง PO" },
        {
          type: "steps",
          description: "1. ไปที่ /procurement/purchase-order\n2. กดปุ่ม dropdown 'New PO'\n3. เลือก 'Create from Purchase Requests'",
        },
        { type: "expected", description: "ปุ่ม New Purchase Order แสดงแต่ถูก disable และการเปิด /purchase-order/new ตรง ๆ ได้หน้า RESTRICTED — Permission Denied" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const po = new PurchaseOrderPage(page);
      await po.gotoList();

      // The app keeps the button in the toolbar but disables it for roles that
      // cannot create a PO — it never hides it. The old body asserted nothing
      // (`expect(true).toBe(true)` on one branch, a swallowed click on the
      // other) and only "passed" because the locator matched no element at all.
      // Clicking a disabled button is also the actionTimeout=0 hang.
      await expect(po.newPODropdown()).toBeVisible({ timeout: 10_000 });
      await expect(po.newPODropdown()).toBeDisabled({ timeout: 10_000 });

      // ...and the route itself is guarded, not just the button.
      await page.goto("/procurement/purchase-order/new");
      await expect(
        page.getByText(/permission denied|restricted/i).first(),
      ).toBeVisible({ timeout: 10_000 });
    },
  );
});

// ═════════════════════════════════════════════════════════════════════════
// TC-PO-900002 — Create Manual PO
// ═════════════════════════════════════════════════════════════════════════
purchaseTest.describe("PO — Create manual", () => {
  purchaseTest(
    "TC-PO-020001 Create a Purchase Order with Valid Data",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้มีสิทธิ์สร้าง PO และ PO แบบไม่มี PR; vendor มีอยู่ในระบบ" },
        {
          type: "steps",
          description:
            "1. ไปที่ /procurement/purchase-order\n2. กด 'Create Purchase Order' แล้วกดปุ่ม 'Manual PO'\n3. เลือก vendor จาก dropdown\n4. กรอกรายละเอียด purchase order\n5. กด 'Submit'",
        },
        { type: "expected", description: "Purchase order ถูกสร้างสำเร็จ ไปหน้ารายละเอียดของใบ และแสดงเลข draft รูปแบบ DRAFT-xxxxxxxx (เลข PO จริงออกตอน Submit ครั้งแรก)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const po = new PurchaseOrderPage(page);
      await po.gotoList();
      await po.newPODropdown().click({ timeout: 10_000 });
      const manual = po.manualPOMenuItem();
      await expect(manual, "Blank PO card missing in the create picker").toBeVisible({ timeout: 10_000 });
      await manual.click({ timeout: 10_000 });
      // "with Valid Data" — but the body used to fill nothing at all and then
      // press Save, so the form was rejected and the toast never came. Both the
      // click and the toast check were swallowed, so it read as a pass.
      // addItemToPO drives the whole cascade: workflow, vendor, delivery date,
      // then the line item.
      await po.addItemToPO({ product: "Test Item", quantity: 1, uom: "ea", unitPrice: 100 });
      await po.saveButton().click({ timeout: 10_000 });
      await po.expectSavedToast();
      // Saved = redirected off /new onto the record, which shows its document number.
      await expect(page).toHaveURL(/purchase-order\/(?!new$)[^/?#]+$/, { timeout: 15_000 });
      // BE #1108: a manual PO holds a DRAFT-NNNNNNNN placeholder until its first submit.
      await expect(page.getByText(/^DRAFT-\d{8}$/).first()).toBeVisible({ timeout: 15_000 });
    },
  );

  purchaseTest(
    "TC-PO-020003 Select a Non-Existent Vendor",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้มีสิทธิ์สร้าง PO; vendor ไม่มีอยู่ในระบบ" },
        {
          type: "steps",
          description:
            "1. ไปที่ /procurement/purchase-order\n2. กด 'Create Purchase Order' แล้วกดปุ่ม 'Manual PO'\n3. เลือก workflow แล้วเปิด dialog เลือก vendor\n4. พิมพ์ชื่อ vendor ที่ไม่มีอยู่ในช่องค้นหา",
        },
        { type: "expected", description: "ค้นหา vendor ที่ไม่มีอยู่ใน dialog แล้วแสดง 'No vendor found' และไม่มี vendor ให้เลือก" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const po = new PurchaseOrderPage(page);
      await po.gotoList();
      await po.newPODropdown().click({ timeout: 5_000 });
      const manual = po.manualPOMenuItem();
      await expect(manual, "Blank PO card missing in the create picker").toBeVisible({ timeout: 10_000 });
      await manual.click();
      // The vendor is a dialog picker (LookupVendor); a non-existent vendor can only be
      // typed into its search box, which then reports "No vendor found".
      await po.selectFirstWorkflow();
      await po.vendorPickerButton().click({ timeout: 10_000 });
      const dialog = page.getByRole("dialog").last();
      await dialog.getByPlaceholder(/search/i).fill("__NONEXISTENT_VENDOR__");
      await expect(dialog.getByText(/no vendor found/i)).toBeVisible({ timeout: 10_000 });
      await expect(dialog.getByRole("button").filter({ hasText: /^[A-Z]\d{3}/ })).toHaveCount(0);
    },
  );

  purchaseTest(
    "TC-PO-020004 Leave Required Fields Blank",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้มีสิทธิ์สร้าง PO" },
        {
          type: "steps",
          description:
            "1. ไปที่ /procurement/purchase-order\n2. กด 'Create Purchase Order' แล้วกดปุ่ม 'Manual PO'\n3. เลือก vendor จาก dropdown\n4. ปล่อย field ที่จำเป็นว่างเปล่า\n5. กด 'Submit'",
        },
        { type: "expected", description: "ระบบแสดงข้อความแจ้งข้อผิดพลาดว่า field ที่จำเป็นยังไม่ได้กรอก" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const po = new PurchaseOrderPage(page);
      await po.gotoList();
      await po.newPODropdown().click({ timeout: 5_000 });
      const manual = po.manualPOMenuItem();
      await expect(manual, "Blank PO card missing in the create picker").toBeVisible({ timeout: 10_000 });
      await manual.click();
      await expect(page).toHaveURL(/purchase-order\/new/, { timeout: 10_000 });
      await po.saveButton().click({ timeout: 10_000 });
      await expect(page.getByText(/fields aren't filled in correctly/i).first()).toBeVisible({ timeout: 10_000 });
      await expect(po.anyError().first()).toBeVisible({ timeout: 5_000 });
      await expect(page).toHaveURL(/purchase-order\/new/);
    },
  );

  purchaseTest(
    "TC-PO-020005 Edge Case - Add several line items to one PO (no item cap in the form)",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้มีสิทธิ์สร้าง PO; FE ไม่มีเพดานจำนวนรายการต่อ PO (ไม่พบ max ใน routes/procurement/purchase-order) จึงตรวจว่าเพิ่มหลายบรรทัดได้" },
        {
          type: "steps",
          description:
            "1. ไปที่ /procurement/purchase-order แล้วเปิด Blank PO\n2. เลือก workflow, vendor, วันที่ส่งของ แล้วเพิ่มรายการแรก\n3. กด Add Item อีกครั้ง",
        },
        { type: "expected", description: "จำนวนแถวในตารางรายการเพิ่มขึ้นหลังกด Add Item ครั้งที่สอง (เพิ่มบรรทัดว่างได้ ไม่มีข้อความปฏิเสธ/เพดานจำนวนรายการ)" },
        { type: "priority", description: "Low" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      const po = new PurchaseOrderPage(page);
      await po.gotoList();
      await po.newPODropdown().click({ timeout: 5_000 });
      const manual = po.manualPOMenuItem();
      await expect(manual, "Blank PO card missing in the create picker").toBeVisible({ timeout: 10_000 });
      await manual.click();
      await po.addItemToPO({ product: "Test Item", quantity: 1, uom: "ea", unitPrice: 100 });
      const rows = page.locator("tbody tr");
      const before = await rows.count();
      await po.addItemButton().click({ timeout: 10_000 });
      // A second blank line row is prepended; the form has no item cap.
      await expect.poll(() => rows.count(), { timeout: 10_000 }).toBeGreaterThan(before);
    },
  );
});

requestorTest.describe("PO — Create manual — Permission denial", () => {
  requestorTest(
    "TC-PO-020002 Attempt to Create PO without Permission",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็นผู้ใช้ที่ไม่มีสิทธิ์สร้าง PO" },
        {
          type: "steps",
          description:
            "1. ไปที่ /procurement/purchase-order\n2. กด 'Create Purchase Order' แล้วกดปุ่ม 'Manual PO'",
        },
        { type: "expected", description: "ปุ่ม New Purchase Order แสดงแต่ถูก disable และการเปิด /purchase-order/new ตรง ๆ ได้หน้า RESTRICTED — Permission Denied" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const po = new PurchaseOrderPage(page);
      await po.gotoList();

      // The app keeps the button in the toolbar but disables it for roles that
      // cannot create a PO — it never hides it. The old body asserted nothing
      // (`expect(true).toBe(true)` on one branch, a swallowed click on the
      // other) and only "passed" because the locator matched no element at all.
      // Clicking a disabled button is also the actionTimeout=0 hang.
      await expect(po.newPODropdown()).toBeVisible({ timeout: 10_000 });
      await expect(po.newPODropdown()).toBeDisabled({ timeout: 10_000 });

      // ...and the route itself is guarded, not just the button.
      await page.goto("/procurement/purchase-order/new");
      await expect(
        page.getByText(/permission denied|restricted/i).first(),
      ).toBeVisible({ timeout: 10_000 });
    },
  );
});

// ═════════════════════════════════════════════════════════════════════════
// TC-PO-900003 — Send to Vendor
// ═════════════════════════════════════════════════════════════════════════
purchaseTest.describe("PO — Send to Vendor", () => {
  purchaseTest(
    "TC-PO-030001 Alternate Flow - Send to vendor on an Approved PO shows the empty email-profile state",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Purchasing Staff; มี PO ที่ Approved (STD dataset); BU ไม่มี email profile ที่เปิดใช้ (TEST BU จาก data:reset) — เคสนี้ตรวจ dialog ที่เปิดได้จริง ไม่ได้ส่งอีเมลจริง" },
        {
          type: "steps",
          description:
            "1. ไปที่ All Documents ของ /procurement/purchase-order\n2. เปิด PO ที่ Approved\n3. กด 'Send to vendor'",
        },
        { type: "expected", description: "เปิด dialog 'Send purchase order to vendor' ผูกกับเลข PO และแสดงสถานะ 'No enabled email profile' พร้อมลิงก์ไปหน้าตั้งค่า email profile (ไม่มีปุ่ม Send เพราะยังไม่มี profile)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Alternate Flow" },
      ],
    },
    async ({ page }) => {
      const po = new PurchaseOrderPage(page);
      // Read-only: Approved rows are seeded by data:reset (po.approved), so there is
      // nothing to create here and nothing to clean up.
      await po.gotoAllDocuments();
      const approvedRow = po.rowWithStatus(/^approved$/i).first();
      await expect(approvedRow, "no Approved PO in TEST BU — run `bun run data:reset --yes`").toBeVisible({ timeout: 10_000 });
      await openRecordFromRow(approvedRow);

      await expect(po.sendToVendorButton()).toBeVisible({ timeout: 15_000 });
      await po.sendToVendorButton().click({ timeout: 10_000 });
      // Dialog bound to this PO; the compose form is replaced by the no-profile state
      // because the standard dataset has no enabled email profile. Pressing Send would
      // dispatch a real message, so it is deliberately not exercised (see 030002).
      await po.expectSendToVendorDialogOpen();
    },
  );

  // Needs the compose form, which only renders once the BU has an enabled email
  // profile. The STD dataset (data:reset) has none and seeding one needs SMTP
  // credentials, so this is an explicit data-precondition skip decided from the
  // profile API response the dialog itself loads (never a visibility guess).
  purchaseTest(
    "TC-PO-030002 Negative - Send with no recipient (vendor email missing)",
    {
      annotation: [
        { type: "preconditions", description: "PO อยู่ใน status Approved; BU มี email profile ที่เปิดใช้อย่างน้อยหนึ่งรายการ (ถ้าไม่มี เคสนี้ skip พร้อมเหตุผลที่ตรวจจาก API)" },
        {
          type: "steps",
          description:
            "1. ไปที่ /procurement/purchase-order แล้วเปิด PO ที่ Approved\n2. กด 'Send to vendor'\n3. ลบผู้รับ (To) ทั้งหมด\n4. กด Send",
        },
        { type: "expected", description: "ระบบไม่ส่ง และแสดง 'At least one recipient is required' (FE po-send-email-dialog: toRequired)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
        { type: "note", description: "Data-precondition skip: TEST BU from data:reset has no enabled email profile (checked via GET /{bu}/email-senders, the response the dialog loads)." },
      ],
    },
    async ({ page }) => {
      const po = new PurchaseOrderPage(page);
      await po.gotoAllDocuments();
      const approvedRow = po.rowWithStatus(/^approved$/i).first();
      await expect(approvedRow, "no Approved PO in TEST BU — run `bun run data:reset --yes`").toBeVisible({ timeout: 10_000 });
      await openRecordFromRow(approvedRow);
      await expect(po.sendToVendorButton()).toBeVisible({ timeout: 15_000 });
      const profilesRes = page.waitForResponse((r) => /\/email-senders/.test(r.url()) && r.request().method() === "GET", { timeout: 15_000 });
      await po.sendToVendorButton().click({ timeout: 10_000 });
      const body = await (await profilesRes).json();
      // 404 "Config key not found" = the BU never configured an email profile.
      const d = body?.data;
      const profiles: Array<{ enabled?: boolean }> = Array.isArray(d) ? d : (d?.profiles ?? d?.senders ?? d?.value?.profiles ?? []);
      purchaseTest.skip(
        !profiles.some((p) => p.enabled),
        "data precondition: TEST BU has no enabled email profile (GET /{bu}/email-senders -> 404 Config key not found) — the compose form with a recipient field is not rendered",
      );
      const dialog = page.locator('[role="dialog"], [role="alertdialog"]').last();
      for (const remove of await dialog.getByRole("button", { name: /^remove /i }).all()) {
        await remove.click();
      }
      await dialog.getByRole("button", { name: /^send$/i }).click({ timeout: 10_000 });
      await expect(dialog.getByText(/at least one recipient is required/i)).toBeVisible({ timeout: 10_000 });
    },
  );

  purchaseTest(
    "TC-PO-030004 Edge Case - Voided PO (the app's 'rejected' end state) offers no Send / Close",
    {
      annotation: [
        { type: "preconditions", description: "มี PO ที่ status Voided (STD dataset: po.rejected — FC reject แล้ว); PO ไม่มี status 'Rejected' ตรง ๆ (PO_STATUS ใน FE: draft/in_progress/approved/sent_or_print/partial/closed/completed) การ reject แสดงเป็น Voided" },
        {
          type: "steps",
          description:
            "1. ไปที่ All Documents ของ /procurement/purchase-order\n2. เปิด PO ที่ status Voided\n3. ตรวจปุ่มบน toolbar",
        },
        { type: "expected", description: "ไม่มีปุ่ม 'Send to vendor' และ 'Close'; header แสดง chip Voided (ยังไม่แสดงใน FE ปัจจุบัน — pinned ด้วย test.fail เหมือน TC-PO-070311) (po-header.tsx: SEND_EMAIL_STATUSES ไม่รวม voided; Close เฉพาะ approved/sent)" },
        { type: "priority", description: "Low" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      const po = new PurchaseOrderPage(page);
      await po.gotoAllDocuments();
      const voidedRow = po.rowWithStatus(/^voided$/i).first();
      await expect(voidedRow, "no Voided PO in TEST BU — run `bun run data:reset --yes` (po.rejected)").toBeVisible({ timeout: 10_000 });
      await openRecordFromRow(voidedRow);
      // Wait for the toolbar to render (Comment/Print are always there) before asserting absence.
      await expect(page.getByRole("button", { name: /^comment/i }).first()).toBeVisible({ timeout: 15_000 });
      await expect(po.sendToVendorButton()).toHaveCount(0);
      await expect(po.closePOButton()).toHaveCount(0);
      // PO_STATUS_CONFIG has no "voided" (constant/purchase-order.ts) so po-header.tsx renders no chip for it, while the
      // list falls back to the raw status (use-po-table.tsx) - list shows Voided, detail header shows nothing.
      purchaseTest.fail(true, "suspected bug: a voided PO's detail header shows no 'Voided' status chip (PO_STATUS_CONFIG lacks voided; po-header.tsx renders the chip only for configured statuses)");
      await expect(po.headerStatus()).toHaveText(/voided/i, { timeout: 10_000 });
    },
  );
});

// ═════════════════════════════════════════════════════════════════════════
// TC-PO-900005 — Close rules (replaces the retired "Cancel PO" cases)
// The FE has no Cancel / Void / Change Order action on a PO (po-header.tsx offers
// Edit / Delete / Submit on Draft; Close / Send / Comment / Activity / Print on
// Approved|Sent). Cancel-happy-path (050001) and every Change Order case
// (040001-040004) were deleted; closing an Approved PO is TC-PO-060504 (402).
// ═════════════════════════════════════════════════════════════════════════
purchaseTest.describe("PO — Close rules", () => {
  purchaseTest(
    "TC-PO-050002 Negative - Completed Purchase Order cannot be closed or cancelled",
    {
      annotation: [
        { type: "preconditions", description: "มี PO ที่ status Completed (STD dataset: po.completed — รับครบด้วย GRN)" },
        {
          type: "steps",
          description:
            "1. ไปที่ All Documents ของ /procurement/purchase-order\n2. เปิด PO ที่ status Completed\n3. ตรวจปุ่มบน toolbar",
        },
        { type: "expected", description: "ไม่มีปุ่ม Close และไม่มีปุ่ม Cancel/Void บน PO ที่ Completed แล้ว" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const po = new PurchaseOrderPage(page);
      await po.gotoAllDocuments();
      const completedRow = po.rowWithStatus(/^completed$/i).first();
      await expect(completedRow, "no Completed PO in TEST BU — run `bun run data:reset --yes` (po.completed)").toBeVisible({ timeout: 10_000 });
      await openRecordFromRow(completedRow);
      await expect(page.getByRole("button", { name: /^comment/i }).first()).toBeVisible({ timeout: 15_000 });
      await expect(po.closePOButton()).toHaveCount(0);
      await expect(po.cancelPOButton()).toHaveCount(0);
    },
  );

  purchaseTest(
    "TC-PO-050003 Edge Case - PO with received goods (Partial) offers no Close",
    {
      annotation: [
        { type: "preconditions", description: "มี PO ที่ status Partial (STD dataset: po.partial — รับบางส่วนด้วย GRN)" },
        {
          type: "steps",
          description:
            "1. ไปที่ All Documents ของ /procurement/purchase-order\n2. เปิด PO ที่ status Partial\n3. ตรวจปุ่มบน toolbar",
        },
        { type: "expected", description: "ไม่มีปุ่ม Close/Cancel บน PO ที่รับสินค้าแล้วบางส่วน (po-header.tsx: Close เฉพาะ approved/sent_or_print) แต่ยังมี 'Send to vendor'" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      const po = new PurchaseOrderPage(page);
      await po.gotoAllDocuments();
      const partialRow = po.rowWithStatus(/^partial$/i).first();
      await expect(partialRow, "no Partial PO in TEST BU — run `bun run data:reset --yes` (po.partial)").toBeVisible({ timeout: 10_000 });
      await openRecordFromRow(partialRow);
      await expect(po.sendToVendorButton()).toBeVisible({ timeout: 15_000 });
      await expect(po.closePOButton()).toHaveCount(0);
      await expect(po.cancelPOButton()).toHaveCount(0);
    },
  );
});

noAuthTest(
  "TC-PO-050004 Negative - Cancel Purchase Order without Authentication",
  {
    annotation: [
      { type: "preconditions", description: "ผู้ใช้ยังไม่ได้ login" },
      {
        type: "steps",
        description:
          "1. ไปที่ /procurement/purchase-order\n2. พยายามกดปุ่ม 'Cancel Purchase Order'",
      },
      { type: "expected", description: "ระบบ redirect ไปยังหน้า login หรือแสดงข้อความแจ้งข้อผิดพลาดให้ผู้ใช้ login ก่อน" },
      { type: "priority", description: "Medium" },
      { type: "testType", description: "Negative" },
    ],
  },
  async ({ page }) => {
    await page.goto(LIST_PATH);
    await expect(page).toHaveURL(/login|sign-?in/i, { timeout: 10_000 });
  },
);

// ═════════════════════════════════════════════════════════════════════════
// TC-PO-900006 — Dashboard
// ═════════════════════════════════════════════════════════════════════════
purchaseTest.describe("PO — Dashboard", () => {
  purchaseTest(
    "TC-PO-060001 View the Purchase Order list as Purchasing Staff (All Documents)",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้มีสิทธิ์ดู PO; STD dataset มี PO 7 ใบ (Draft/Voided/Approved/Sent/Partial/Completed). FE ไม่มี dashboard/chart ของ PO — มีแต่ list พร้อมตัวนับ" },
        {
          type: "steps",
          description:
            "1. ไปที่ /procurement/purchase-order?view=all-document\n2. ตรวจตัวนับจำนวนข้างหัวข้อ\n3. ตรวจแถวในตาราง\n4. ตรวจ footer 'Showing'",
        },
        { type: "expected", description: "ตารางแสดงแถว PO ที่มีเลข PO หรือเลข draft DRAFT-xxxxxxxx พร้อม status chip และ footer 'Showing 1–N of T' โดย N ตรงกับจำนวนแถวที่แสดง" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const po = new PurchaseOrderPage(page);
      await po.gotoAllDocuments();
      const rows = page.locator("tbody tr").filter({ hasText: /PO\d{6,}|DRAFT-\d{8}/ });
      await expect(rows.first(), "no PO in TEST BU — run `bun run data:reset --yes`").toBeVisible({ timeout: 10_000 });
      const n = await rows.count();
      await expect(page.locator("tbody [data-slot='status-chip']")).toHaveCount(n);
      await expect(page.getByText(new RegExp(`Showing\\s+1.\\s*${n}\\s+of\\s+\\d+`, "i")).first()).toBeVisible();
    },
  );

  purchaseTest(
    "TC-PO-060003 Search the PO list for a term that matches nothing",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้มีสิทธิ์ดู PO; ค้นด้วยคำที่ไม่ตรงกับ PO ใด (ชุดข้อมูล STD มี PO อยู่เสมอ จึงใช้การค้นหาแทนการลบ PO ทั้งหมด)" },
        {
          type: "steps",
          description:
            "1. ไปที่ /procurement/purchase-order?view=all-document\n2. พิมพ์ '__NO_SUCH_PO__' ในช่องค้นหา",
        },
        { type: "expected", description: "ตารางไม่เหลือแถว PO และแสดงข้อความไม่พบข้อมูล" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      const po = new PurchaseOrderPage(page);
      await po.gotoAllDocuments();
      await po.searchInput().fill("__NO_SUCH_PO__");
      await page.keyboard.press("Enter");
      await expect(page.locator("tbody tr").filter({ hasText: /PO\d{6,}|DRAFT-\d{8}/ })).toHaveCount(0, { timeout: 10_000 });
      await expect(page.getByText(/no data found/i).first()).toBeVisible({ timeout: 10_000 });
    },
  );

  purchaseTest(
    "TC-PO-060004 PO list paginates and the page-size selector changes rows shown",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้มีสิทธิ์ดู PO; มี PO อย่างน้อย 6 ใบ (data:reset)" },
        {
          type: "steps",
          description:
            "1. ไปที่ /procurement/purchase-order?view=all-document\n2. ตรวจ footer 'Showing 1–N of N'\n3. เปลี่ยน Rows per page เป็น 5\n4. กดไปหน้าถัดไป",
        },
        { type: "expected", description: "footer ระบุช่วงและจำนวนรวม; เลือก 5 แถวต่อหน้าแล้วตารางเหลือ 5 แถวและ footer เป็น 1–5; หน้าถัดไปแสดงแถวชุดอื่น" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      const po = new PurchaseOrderPage(page);
      await po.gotoAllDocuments();
      await expect(page.getByText(/Showing\s+1.\s*\d+\s+of\s+\d+/i).first()).toBeVisible({ timeout: 10_000 });
      const rows = page.locator("tbody tr").filter({ hasText: /PO\d{6,}|DRAFT-\d{8}/ });
      await expect(rows.nth(5), "need at least 6 POs - run data:reset").toBeVisible({ timeout: 10_000 });
      await page.getByRole("combobox", { name: /rows per page/i }).click();
      await page.getByRole("option", { name: "5", exact: true }).click();
      await expect(rows).toHaveCount(5, { timeout: 10_000 });
      await expect(page.getByText(/Showing\s+1.\s*5\s+of\s+\d+/i).first()).toBeVisible({ timeout: 10_000 });
      const firstPage = await rows.first().innerText();
      await page.getByRole("button", { name: /next/i }).first().click();
      await expect(rows.first(), "next page shows the same rows").not.toHaveText(firstPage, { timeout: 10_000 });
      await expect(page.getByText(/Showing\s+6.\s*\d+\s+of\s+\d+/i).first()).toBeVisible({ timeout: 10_000 });
    },
  );
});

requestorTest.describe("PO — Dashboard — Permission denial", () => {
  requestorTest(
    "TC-PO-060002 Requestor has no PO to action: My pending is empty and New is disabled",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Requestor (ไม่มีสิทธิ์สร้าง/อนุมัติ PO; ดูรายการได้แต่ไม่มี PO รอดำเนินการ)" },
        {
          type: "steps",
          description: "1. ไปที่ /procurement/purchase-order (My pending)\n2. ตรวจสอบรายการและปุ่ม New Purchase Order",
        },
        { type: "expected", description: "My pending แสดง 'No data found' ไม่มีแถว PO และปุ่ม New Purchase Order ถูก disable" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const po = new PurchaseOrderPage(page);
      await po.gotoList();
      await expect(page.getByText(/no data found/i).first()).toBeVisible({ timeout: 10_000 });
      await expect(page.locator("tbody tr").filter({ hasText: /PO\d{6,}|DRAFT-\d{8}/ })).toHaveCount(0);
      await expect(po.newPODropdown()).toBeDisabled();
    },
  );
});

// ═════════════════════════════════════════════════════════════════════════
// TC-PO-900020 — QR Code: DELETED (200003, 200004). The FE has no QR code on a PO
// (no qr/QR code in ../carmen-frontend routes/ or components/), so there is nothing
// to assert; the old bodies only counted <img> matches on a 404 page / reloaded a row.
// ═════════════════════════════════════════════════════════════════════════

// ═════════════════════════════════════════════════════════════════════════
// BACKEND / SYSTEM-LEVEL — all skipped
// TC-PO-900101 sequence gen, TC-PO-900102 calculations, TC-PO-900103 budget approval,
// TC-PO-900104 GRN sync, TC-PO-900105 delivery reminder, TC-PO-900201 encumbrance,
// TC-PO-900202 vendor master, TC-PO-900301 daily cleanup
// ═════════════════════════════════════════════════════════════════════════
purchaseTest.describe("PO — Sequence generation — Backend only", () => {
  purchaseTest.skip(
    "TC-PO-310001 Happy Path - Valid PO Creation",
    {
      annotation: [
        { type: "preconditions", description: "Sequence table มีอยู่จริงและ initialized แล้ว" },
        {
          type: "steps",
          description:
            "1. ไปที่ /procurement/purchase-request\n2. กด 'New Purchase Request'\n3. ตรวจสอบว่าวันที่ปัจจุบันแสดง\n4. กด 'Generate PO Number'\n5. ตรวจสอบว่า PO number มีรูปแบบ PO-2401-000123",
        },
        { type: "expected", description: "PO number ที่ถูกต้องถูกสร้างและแสดง" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Happy Path" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );

  purchaseTest.skip(
    "TC-PO-310002 Negative Case - No Sequence Table",
    {
      annotation: [
        { type: "preconditions", description: "Sequence table ไม่พร้อมใช้งาน" },
        {
          type: "steps",
          description:
            "1. ไปที่ /procurement/purchase-request\n2. กด 'New Purchase Request'\n3. กด 'Generate PO Number'\n4. ตรวจสอบข้อความแจ้งข้อผิดพลาด 'Sequence table not initialized'",
        },
        { type: "expected", description: "แสดงข้อความแจ้งข้อผิดพลาดว่า sequence table ยังไม่ได้ initialized" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );

  purchaseTest.skip(
    "TC-PO-310003 Edge Case - Month Transition",
    {
      annotation: [
        { type: "preconditions", description: "Sequence table มีอยู่จริงและ initialized แล้ว" },
        {
          type: "steps",
          description:
            "1. ไปที่ /procurement/purchase-request\n2. กด 'New Purchase Request'\n3. ตรวจสอบว่า PO number มีรูปแบบ PO-2401-000123 (มกราคม)\n4. รอให้เปลี่ยนเป็นเดือนกุมภาพันธ์\n5. กด 'Generate PO Number'\n6. ตรวจสอบว่า PO number มีรูปแบบ PO-2402-000001 (กุมภาพันธ์)",
        },
        { type: "expected", description: "PO number ที่ถูกต้องถูกสร้างพร้อมรูปแบบเดือนใหม่" },
        { type: "priority", description: "Low" },
        { type: "testType", description: "Edge Case" },
        { type: "note", description: SKIP_NOTE_TIME },
      ],
    },
    async () => {},
  );

  purchaseTest.skip(
    "TC-PO-310004 Negative Case - Insufficient Permissions",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ไม่มีสิทธิ์สร้าง PO" },
        {
          type: "steps",
          description:
            "1. ไปที่ /procurement/purchase-request\n2. กด 'New Purchase Request'\n3. กด 'Generate PO Number'\n4. ตรวจสอบข้อความแจ้งข้อผิดพลาด 'Insufficient permissions to create purchase order'",
        },
        { type: "expected", description: "แสดงข้อความแจ้งข้อผิดพลาดว่าสิทธิ์ไม่เพียงพอ" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
});

purchaseTest.describe("PO — Calculations — Backend only", () => {
  purchaseTest.skip(
    "TC-PO-320001 Calculate Subtotal with Valid Input",
    {
      annotation: [
        { type: "preconditions", description: "มี PO ที่มีรายการสินค้าพร้อม quantity และ unit price" },
        {
          type: "steps",
          description:
            "1. ไปที่ /purchase-order\n2. กรอก quantity และ unit price ของรายการสินค้า\n3. กด 'Calculate Totals'",
        },
        { type: "expected", description: "Subtotal ถูกคำนวณถูกต้องเป็นผลรวมของ (line_item.quantity × line_item.unit_price)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Happy Path" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );

  purchaseTest.skip(
    "TC-PO-320002 Apply Percentage Discount",
    {
      annotation: [
        { type: "preconditions", description: "มี PO ที่มีรายการสินค้า; กำหนด discount แบบเปอร์เซ็นต์แล้ว" },
        {
          type: "steps",
          description:
            "1. ไปที่ /purchase-order\n2. กด 'Apply Discount'\n3. เลือก 'Percentage'\n4. กรอกเปอร์เซ็นต์ discount\n5. กด 'Apply'",
        },
        { type: "expected", description: "Subtotal ถูกคำนวณใหม่พร้อม discount เปอร์เซ็นต์ที่ใช้" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Happy Path" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );

  purchaseTest.skip(
    "TC-PO-320003 Apply Fixed Amount Discount",
    {
      annotation: [
        { type: "preconditions", description: "มี PO ที่มีรายการสินค้า; กำหนด discount แบบจำนวนเงินคงที่แล้ว" },
        {
          type: "steps",
          description:
            "1. ไปที่ /purchase-order\n2. กด 'Apply Discount'\n3. เลือก 'Fixed Amount'\n4. กรอกจำนวน discount\n5. กด 'Apply'",
        },
        { type: "expected", description: "Subtotal ถูกคำนวณใหม่พร้อม discount จำนวนเงินที่ใช้" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Happy Path" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );

  purchaseTest.skip(
    "TC-PO-320004 No Discount Applied",
    {
      annotation: [
        { type: "preconditions", description: "มี PO ที่มีรายการสินค้า; ยังไม่ได้ใช้ discount" },
        {
          type: "steps",
          description:
            "1. ไปที่ /purchase-order\n2. กด 'Apply Discount'\n3. ไม่เลือกประเภท discount\n4. กด 'Apply'",
        },
        { type: "expected", description: "Subtotal ถูกคำนวณโดยไม่มี discount" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );

  purchaseTest.skip(
    "TC-PO-320005 Negative Quantity Entered",
    {
      annotation: [
        { type: "preconditions", description: "มี PO ที่มีรายการสินค้าอย่างน้อยหนึ่งรายการ; กรอก quantity ติดลบ" },
        {
          type: "steps",
          description:
            "1. ไปที่ /purchase-order\n2. กรอก quantity ติดลบในรายการสินค้า\n3. กด 'Calculate Totals'",
        },
        { type: "expected", description: "แสดงข้อความแจ้งข้อผิดพลาดว่า quantity ที่กรอกไม่ถูกต้อง" },
        { type: "priority", description: "Low" },
        { type: "testType", description: "Edge Case" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
});

purchaseTest.describe("PO — Budget approval — Backend only", () => {
  purchaseTest.skip(
    "TC-PO-330001 Happy Path - Valid PO with Existing Budget",
    {
      annotation: [
        { type: "preconditions", description: "มี PO ที่มียอดรวมและ budget account ที่เกี่ยวข้อง" },
        {
          type: "steps",
          description:
            "1. ไปที่ /procurement/purchase-order\n2. กดปุ่ม 'Approve'\n3. ระบบดึงข้อมูลการจัดสรรงบประมาณสำหรับ PO\n4. ระบบ query ระบบงบประมาณสำหรับแต่ละ budget account\n5. ตรวจสอบว่า PO status เปลี่ยนเป็น 'Budget Approved'",
        },
        { type: "expected", description: "PO status เปลี่ยนเป็น 'Budget Approved' โดยไม่มีข้อความแจ้งข้อผิดพลาด" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Happy Path" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );

  purchaseTest.skip(
    "TC-PO-330002 Negative - Invalid PO Total",
    {
      annotation: [
        { type: "preconditions", description: "มี PO ที่มียอดรวมเกินกว่าการจัดสรรงบประมาณ" },
        {
          type: "steps",
          description:
            "1. ไปที่ /procurement/purchase-order\n2. แก้ไขยอดรวม PO ให้เกินการจัดสรรงบประมาณ\n3. กดปุ่ม 'Approve'\n4. ตรวจสอบข้อความแจ้งข้อผิดพลาดของระบบว่างบประมาณไม่เพียงพอ",
        },
        { type: "expected", description: "ระบบแสดงข้อความแจ้งข้อผิดพลาดว่าไม่สามารถ approve PO ได้เนื่องจากงบประมาณไม่เพียงพอ" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );

  purchaseTest.skip(
    "TC-PO-330003 Edge Case - No Budget Accounts Specified",
    {
      annotation: [
        { type: "preconditions", description: "มี PO ที่ไม่ได้ระบุ budget account ใดๆ" },
        {
          type: "steps",
          description:
            "1. ไปที่ /procurement/purchase-order\n2. approve purchase order\n3. ตรวจสอบว่าระบบแจ้งให้ระบุ budget account",
        },
        { type: "expected", description: "ระบบแจ้งให้ผู้ใช้ระบุ budget account ก่อนที่จะ approve PO ได้" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
});

purchaseTest.describe("PO — GRN sync — Backend only", () => {
  purchaseTest.skip(
    "TC-PO-340001 Happy Path - PO Status Updated Successfully",
    {
      annotation: [
        { type: "preconditions", description: "มี PO ใน status Sent หรือ Acknowledged; มี GRN ที่อ้างอิง PO line item ที่มี status approved" },
        {
          type: "steps",
          description:
            "1. ไปที่ /inventory/grn\n2. กด 'Create New GRN'\n3. กรอกรายละเอียด GRN และเลือก PO line item ที่อ้างอิง\n4. กด 'Save and Approve'",
        },
        { type: "expected", description: "PO status ถูกอัปเดตเป็น Received ในรายละเอียด purchase order" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Happy Path" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );

  purchaseTest.skip(
    "TC-PO-340002 Negative - No PO Line Items in GRN",
    {
      annotation: [
        { type: "preconditions", description: "มี PO ใน status Sent หรือ Acknowledged แต่ GRN ไม่ได้อ้างอิง PO line item ใดๆ" },
        {
          type: "steps",
          description:
            "1. ไปที่ /inventory/grn\n2. กด 'Create New GRN'\n3. กรอกรายละเอียด GRN โดยไม่เลือก PO line item ใดๆ\n4. พยายาม Save and Approve",
        },
        { type: "expected", description: "ระบบป้องกันการบันทึกและ approve GRN และแสดงข้อความแจ้งข้อผิดพลาด" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );

  purchaseTest.skip(
    "TC-PO-340003 Edge Case - Multiple GRNs for Same PO Line Item",
    {
      annotation: [
        { type: "preconditions", description: "มี GRN หลายรายการที่สร้างสำหรับ PO line item เดียวกันพร้อม quantity ที่แตกต่างกัน" },
        {
          type: "steps",
          description:
            "1. ไปที่ /inventory/grn\n2. กด 'View GRN Details'\n3. ตรวจสอบว่า quantity ที่รับรวมตรงกับ quantity ของ PO line item",
        },
        { type: "expected", description: "quantity ที่รับรวมถูกคำนวณและแสดงอย่างถูกต้อง" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
});

purchaseTest.describe("PO — Delivery reminder — Time-based, backend only", () => {
  purchaseTest.skip(
    "TC-PO-350001 Send automatic delivery reminder for valid purchase orders",
    {
      annotation: [
        { type: "preconditions", description: "วันนี้คือ 2023-10-01; มี PO ที่มี status 'Sent' หรือ 'Acknowledged' และวันที่จัดส่งที่คาดไว้ภายใน 3 วันจากวันนี้" },
        {
          type: "steps",
          description:
            "1. ไปที่ /procurement/purchase-order\n2. กด 'Run Scheduled Job'\n3. ตรวจสอบว่าส่ง email notification สำหรับ purchase order ที่ถูกต้อง",
        },
        { type: "expected", description: "ส่ง email reminder สำหรับ PO ที่มี status 'Sent' หรือ 'Acknowledged' และวันที่จัดส่งที่คาดไว้ภายใน 3 วันจากวันนี้ แต่ไม่ส่ง reminder สำหรับ PO ที่มี GR แล้ว" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Happy Path" },
        { type: "note", description: SKIP_NOTE_TIME },
      ],
    },
    async () => {},
  );

  purchaseTest.skip(
    "TC-PO-350002 Scheduled job fails to run due to invalid input",
    {
      annotation: [
        { type: "preconditions", description: "วันนี้คือ 2023-10-01; scheduled job ตั้งค่าให้ทำงานทุกวันเวลา 6:00 AM แต่เวลาเซิร์ฟเวอร์คือ 2023-10-02 06:00 AM" },
        {
          type: "steps",
          description:
            "1. ไปที่ /admin/system-settings\n2. ตรวจสอบ status ของ scheduled job\n3. กด 'Run Now'\n4. ตรวจสอบข้อความแจ้งข้อผิดพลาด",
        },
        { type: "expected", description: "แสดงข้อความแจ้งข้อผิดพลาดว่า scheduled job ทำงานล้มเหลวเนื่องจากวันที่ input ไม่ถูกต้อง" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
        { type: "note", description: SKIP_NOTE_TIME },
      ],
    },
    async () => {},
  );

  purchaseTest.skip(
    "TC-PO-350003 No purchase orders to remind due to no valid POs",
    {
      annotation: [
        { type: "preconditions", description: "วันนี้คือ 2023-10-01; ไม่มี PO ที่มี status 'Sent' หรือ 'Acknowledged' และวันที่จัดส่งที่คาดไว้ภายใน 3 วันจากวันนี้" },
        {
          type: "steps",
          description:
            "1. ไปที่ /procurement/purchase-order\n2. กด 'Run Scheduled Job'\n3. ตรวจสอบว่าไม่มีการส่ง email notification",
        },
        { type: "expected", description: "ไม่มีการส่ง email reminder สำหรับ purchase order เนื่องจากไม่มีรายการที่ตรงตามเกณฑ์" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
        { type: "note", description: SKIP_NOTE_TIME },
      ],
    },
    async () => {},
  );

  purchaseTest.skip(
    "TC-PO-350004 Scheduled job fails due to non-operational email system",
    {
      annotation: [
        { type: "preconditions", description: "วันนี้คือ 2023-10-01; มี PO ที่ตรงตามเกณฑ์การเตือน แต่ระบบ email ล่ม" },
        {
          type: "steps",
          description:
            "1. ไปที่ /procurement/purchase-order\n2. กด 'Run Scheduled Job'\n3. ตรวจสอบว่าไม่มีการส่ง email notification",
        },
        { type: "expected", description: "ไม่มีการส่ง email reminder สำหรับ purchase order เนื่องจากระบบ email ไม่ทำงาน" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
        { type: "note", description: SKIP_NOTE_TIME },
      ],
    },
    async () => {},
  );

  purchaseTest.skip(
    "TC-PO-350005 No reminders sent for POs with GR",
    {
      annotation: [
        { type: "preconditions", description: "วันนี้คือ 2023-10-01; มี PO ที่ตรงตามเกณฑ์การเตือน แต่บางรายการมี GR แล้ว" },
        {
          type: "steps",
          description:
            "1. ไปที่ /procurement/purchase-order\n2. กด 'Run Scheduled Job'\n3. ตรวจสอบว่าส่ง email notification เฉพาะ PO ที่ถูกต้องเท่านั้น",
        },
        { type: "expected", description: "ส่ง email reminder เฉพาะ PO ที่ยังไม่มี GR เท่านั้น" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
        { type: "note", description: SKIP_NOTE_TIME },
      ],
    },
    async () => {},
  );
});

purchaseTest.describe("PO — Encumbrance — Backend only", () => {
  purchaseTest.skip(
    "TC-PO-210001 PO Approved - Encumbrance Created",
    {
      annotation: [
        { type: "preconditions", description: "มี PO ที่มีการจัดสรรงบประมาณและระบบจัดการงบประมาณทำงานปกติ" },
        {
          type: "steps",
          description:
            "1. ไปที่ /procurement/purchase-order\n2. คลิก action 'Approved' สำหรับ PO\n3. รอให้ระบบประมวลผลและสร้าง encumbrance\n4. ตรวจสอบจำนวน encumbrance ในระบบจัดการงบประมาณ",
        },
        { type: "expected", description: "จำนวน encumbrance ถูกสร้างอย่างถูกต้องในระบบจัดการงบประมาณ" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );

  purchaseTest.skip(
    "TC-PO-210002 PO Amount Modified - Encumbrance Adjusted",
    {
      annotation: [
        { type: "preconditions", description: "มี PO ที่มีการจัดสรรงบประมาณ; ระบบจัดการงบประมาณทำงานปกติ" },
        {
          type: "steps",
          description:
            "1. ไปที่ /procurement/purchase-order\n2. แก้ไขจำนวนเงิน PO\n3. รอให้ระบบประมวลผลและปรับ encumbrance\n4. ตรวจสอบจำนวน encumbrance ที่ปรับแล้วในระบบจัดการงบประมาณ",
        },
        { type: "expected", description: "จำนวน encumbrance ถูกปรับอย่างถูกต้องในระบบจัดการงบประมาณ" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );

  purchaseTest.skip(
    "TC-PO-210003 PO Cancelled - Encumbrance Released",
    {
      annotation: [
        { type: "preconditions", description: "มี PO ที่มีการจัดสรรงบประมาณ; ระบบจัดการงบประมาณทำงานปกติ" },
        {
          type: "steps",
          description:
            "1. ไปที่ /procurement/purchase-order\n2. ยกเลิก purchase order\n3. รอให้ระบบประมวลผลและปล่อย encumbrance\n4. ตรวจสอบว่าจำนวน encumbrance ถูกปล่อยในระบบจัดการงบประมาณ",
        },
        { type: "expected", description: "จำนวน encumbrance ถูกปล่อยอย่างถูกต้องในระบบจัดการงบประมาณ" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );

  purchaseTest.skip(
    "TC-PO-210004 Invalid PO Event - No Action Taken",
    {
      annotation: [
        { type: "preconditions", description: "มี PO ที่มีการจัดสรรงบประมาณ; ระบบจัดการงบประมาณทำงานปกติ" },
        {
          type: "steps",
          description:
            "1. ไปที่ /procurement/purchase-order\n2. พยายามดำเนินการที่ไม่ถูกต้อง (เช่น approve โดยไม่มีการเปลี่ยนแปลง)\n3. รอการตอบสนองจากระบบ\n4. ตรวจสอบว่าไม่มีการเปลี่ยนแปลงในระบบจัดการงบประมาณ",
        },
        { type: "expected", description: "ไม่มีการเปลี่ยนแปลงในระบบจัดการงบประมาณ" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );

  purchaseTest.skip(
    "TC-PO-210005 GRN Created Without PO - No Encumbrance Conversion",
    {
      annotation: [
        { type: "preconditions", description: "มี PO ที่มีการจัดสรรงบประมาณ; ระบบจัดการงบประมาณทำงานปกติ" },
        {
          type: "steps",
          description:
            "1. ไปที่ /procurement/receipt-note\n2. สร้าง GRN โดยไม่มี PO ที่สอดคล้องกัน\n3. รอการตอบสนองจากระบบ\n4. ตรวจสอบว่าไม่มีการแปลง encumbrance เป็น expense ในระบบจัดการงบประมาณ",
        },
        { type: "expected", description: "ไม่มีการแปลง encumbrance เป็น expense ในระบบจัดการงบประมาณ" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
});

purchaseTest.describe("PO — Vendor master integration — Backend only", () => {
  purchaseTest.skip(
    "TC-PO-220001 Happy Path - Valid Vendor Selection and Information Retrieval",
    {
      annotation: [
        { type: "preconditions", description: "Vendor Management System ทำงานปกติ; ข้อมูล vendor master เป็นปัจจุบัน; มี integration API หรือ database access" },
        {
          type: "steps",
          description:
            "1. ไปที่ /procurement/purchase-request\n2. กด 'New Purchase Request'\n3. กรอก 'Vendor Name'\n4. เลือก 'Vendor' จาก dropdown\n5. ตรวจสอบว่า 'Vendor Status' เป็น 'Active'\n6. ตรวจสอบว่า 'Vendor Contact' ถูกดึงมา",
        },
        { type: "expected", description: "ข้อมูล vendor ถูกดึงและแสดงสำเร็จ" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );

  purchaseTest.skip(
    "TC-PO-220002 Negative Case - Vendor Not Found",
    {
      annotation: [
        { type: "preconditions", description: "Vendor Management System ทำงานปกติ; ข้อมูล vendor master เป็นปัจจุบัน; มี integration API หรือ database access" },
        {
          type: "steps",
          description:
            "1. ไปที่ /procurement/purchase-request\n2. กด 'New Purchase Request'\n3. กรอก 'Vendor Name'\n4. เลือก 'Vendor' จาก dropdown\n5. ตรวจสอบว่า 'Vendor Status' เป็น 'Inactive'\n6. ตรวจสอบข้อความแจ้งข้อผิดพลาด 'Vendor not found'",
        },
        { type: "expected", description: "ระบบแสดงข้อความแจ้งข้อผิดพลาดว่าไม่พบ vendor" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );

  purchaseTest.skip(
    "TC-PO-220003 Edge Case - Vendor Name Format",
    {
      annotation: [
        { type: "preconditions", description: "Vendor Management System ทำงานปกติ; ข้อมูล vendor master เป็นปัจจุบัน; มี integration API หรือ database access" },
        {
          type: "steps",
          description:
            "1. ไปที่ /procurement/purchase-request\n2. กด 'New Purchase Request'\n3. กรอก 'Vendor Name' ด้วยอักขระพิเศษ (เช่น @#)$&)\n4. เลือก 'Vendor' จาก dropdown\n5. ตรวจสอบว่า 'Vendor Status' เป็น 'Inactive'",
        },
        { type: "expected", description: "ระบบไม่อนุญาตให้ใช้อักขระพิเศษใน vendor name และ vendor status ยังคงเป็น 'Inactive'" },
        { type: "priority", description: "Low" },
        { type: "testType", description: "Edge Case" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
});

purchaseTest.describe("PO — Daily cleanup — Time-based, backend only", () => {
  purchaseTest.skip(
    "TC-PO-110001 Happy Path - Daily Purchase Order Status Cleanup",
    {
      annotation: [
        { type: "preconditions", description: "Database เข้าถึงได้; ระบบทำงานปกติ; ไม่มีช่วง maintenance window active" },
        {
          type: "steps",
          description:
            "1. ไปที่ /admin/scheduled-jobs\n2. รอถึงเวลา 2:00 AM\n3. ระบบเริ่ม scheduled job\n4. ระบบ query PO ที่มี status = 'Fully Received' และวันที่กิจกรรมล่าสุด >= 30 วันก่อน\n5. ตรวจสอบว่าไม่มีปัญหาคุณภาพที่ค้างอยู่ ไม่มีข้อพิพาทหรือการคืนสินค้า ใบแจ้งหนี้ที่เกี่ยวข้องทั้งหมดประมวลผลแล้ว\n6. ตรวจสอบว่า PO ที่ตรงตามเงื่อนไขทั้งหมดถูกทำเครื่องหมายว่า completed",
        },
        { type: "expected", description: "PO ที่ตรงตามเงื่อนไขทั้งหมดถูกทำเครื่องหมายว่า completed และไม่มีการรายงานข้อผิดพลาด" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
        { type: "note", description: SKIP_NOTE_TIME },
      ],
    },
    async () => {},
  );

  purchaseTest.skip(
    "TC-PO-110002 Negative Case - Database Unavailable",
    {
      annotation: [
        { type: "preconditions", description: "Database เข้าถึงไม่ได้; ระบบทำงานปกติ; ไม่มีช่วง maintenance window active" },
        {
          type: "steps",
          description:
            "1. ไปที่ /admin/scheduled-jobs\n2. รอถึงเวลา 2:00 AM\n3. ระบบพยายามเริ่ม scheduled job แต่ล้มเหลวเนื่องจาก database ไม่พร้อมใช้งาน",
        },
        { type: "expected", description: "แสดงข้อความแจ้งข้อผิดพลาดว่า database ไม่พร้อมใช้งาน" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
        { type: "note", description: SKIP_NOTE_TIME },
      ],
    },
    async () => {},
  );

  purchaseTest.skip(
    "TC-PO-110003 Negative Case - No Purchase Orders Meet Criteria",
    {
      annotation: [
        { type: "preconditions", description: "Database เข้าถึงได้; ระบบทำงานปกติ; ไม่มีช่วง maintenance window active" },
        {
          type: "steps",
          description:
            "1. ไปที่ /admin/scheduled-jobs\n2. รอถึงเวลา 2:00 AM\n3. ระบบ query PO ที่มี status = 'Fully Received' และวันที่กิจกรรมล่าสุด >= 30 วันก่อน\n4. ตรวจสอบว่าไม่มี purchase order ที่ตรงตามเกณฑ์",
        },
        { type: "expected", description: "ไม่มี purchase order ถูกทำเครื่องหมายว่า completed และไม่มีการรายงานข้อผิดพลาด" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
        { type: "note", description: SKIP_NOTE_TIME },
      ],
    },
    async () => {},
  );

  purchaseTest.skip(
    "TC-PO-110004 Edge Case - Maintenance Window Active",
    {
      annotation: [
        { type: "preconditions", description: "Database เข้าถึงได้; ระบบไม่ทำงาน; มีช่วง maintenance window active" },
        {
          type: "steps",
          description:
            "1. ไปที่ /admin/scheduled-jobs\n2. รอถึงเวลา 2:00 AM\n3. ระบบพยายามเริ่ม scheduled job แต่ล้มเหลวเนื่องจากระบบไม่ทำงานระหว่าง maintenance window",
        },
        { type: "expected", description: "แสดงข้อความแจ้งข้อผิดพลาดว่า maintenance window active" },
        { type: "priority", description: "Low" },
        { type: "testType", description: "Edge Case" },
        { type: "note", description: SKIP_NOTE_TIME },
      ],
    },
    async () => {},
  );
});
