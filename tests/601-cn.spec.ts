import { expect, type Page } from "@playwright/test";
import { writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createAuthTest } from "./fixtures/auth.fixture";
import { CreditNotePage } from "./pages/credit-note.page";
import { createDraftCn, deleteE2eCns, deleteReason, ensureReason, getCn, listCns, seededCn } from "./helpers/cn-api";
import { button, confirmDialog, lastToast, pickDate, pickLookup, typeInto } from "./helpers/movement/ui";
import { uid } from "./helpers/test-data";

// ─────────────────────────────────────────────────────────────────────────
// Roles (permissions read from /api/user/profile of the TEST BU):
//  - Purchase  : credit_note create/update/delete/view
//  - FC        : credit_note.view ONLY -> the "no permission" role
//  - Requestor : no credit-note permission (the list shows "Permission Denied")
// Mutating cases work on their own draft CN seeded through the API (description "E2E ...",
// tests/helpers/cn-api.ts); the two seeded notes (CN26110001 draft, CN26110002 completed) are
// read-only fixtures. The TEST BU dataset has no credit-note reason and the form requires one, so
// every describe that needs one creates "E2E-CN reason" in beforeAll and removes it in afterAll.
//
// The credit note is draft -> Submit -> Completed. Deleted cases (feature absent in
// ../carmen-frontend/routes/procurement/credit-note/*):
//   lot selection 020005 / 060004 (no lot columns - lots only appear in the Stock Movement tab), void 110001-5
//   (cn-footer-action.tsx has Submit only; VOIDED is a status the UI shows, there is no Void action),
//   cost-analysis access 070002, large item count 040004 (a GRN has 1-2 lines in the dataset), accounting-period
//   closed / date out of range on commit 100004 / 100005 (Submit has no period rule; period close is covered by 9xx),
//   comment / attachment "without permission" 090002 (components/ui/comment-sheet.tsx has no permission gate)
// ─────────────────────────────────────────────────────────────────────────
const fcTest = createAuthTest("carmensoftware.dev+fc@gmail.com");
const requestorTest = createAuthTest("carmensoftware.dev+requestor@gmail.com");
const purchaseTest = createAuthTest("carmensoftware.dev+purchase@gmail.com");

purchaseTest.describe.configure({ timeout: 90_000 });
fcTest.describe.configure({ timeout: 60_000 });

const SKIP_NOTE_BACKEND =
  "Backend / system-level behavior (server actions, sequence generation, journal entries, " +
  "stock movement generation, FIFO costing, tax calculations, audit log integrity, " +
  "real-time sync, transaction commitment). Cannot be exercised reliably through the UI in E2E. " +
  "Verify with API / integration tests.";

const SKIP_NOTE_CONCURRENCY =
  "Requires concurrent multi-user session orchestration. Tracked but skipped in single-worker E2E.";


const LIST = "/procurement/credit-note";
const today = () => new Date().toLocaleDateString("sv");
const rowsOf = (page: Page) => page.locator("table tbody tr");
const NO_GATE =
  "suspected bug: view-only FC gets an enabled CN action - the FE does not gate it (cn-footer-action.tsx Submit has no permission check) and the gateway credit-notes controller has no permission decorator";

async function gotoCn(page: Page, id: string) {
  await page.goto(`${LIST}/${id}`);
  await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeVisible({ timeout: 20_000 });
}

async function search(page: Page, text: string) {
  const box = page.getByPlaceholder("Search...");
  await box.fill(text);
  await box.press("Enter");
}

/** Edit -> Save, wait for the success toast. */
async function save(page: Page) {
  await button(page, "Save").click();
  expect(await lastToast(page)).toMatch(/updated|saved|success/i);
}

/** New CN form up to (not including) Create: vendor, GRN, reason, tax invoice no./date. */
async function fillHeader(page: Page, taxNo: string, grnNo = "GRN261100002") {
  await page.goto(`${LIST}/new`);
  await pickLookup(page, page.getByRole("button", { name: "Select Vendor" }));
  await pickLookup(page, page.getByRole("button", { name: "Select GRN" }), grnNo);
  await pickLookup(page, page.getByRole("button", { name: "Select CN Reason" }));
  await page.locator("#cn-tax-invoice-no").fill(taxNo);
  const taxDate = page.locator("[data-slot=field]").filter({ hasText: "Tax Invoice Date" }).locator("button").first();
  expect(await pickDate(page, taxDate, today()), "Tax Invoice Date today").toBe(true);
}

/** Add Item -> tick the first N GRN lines in the "Select from GRN" dialog -> Add. */
async function addFromGrn(page: Page, lines = 1, which: "first" | "last" = "first") {
  await button(page, "Add Item").click();
  const dlg = page.locator("[role=dialog]:visible").last();
  await expect(dlg).toContainText("Select from GRN");
  const boxes = dlg.getByRole("checkbox");
  if (which === "last") await boxes.last().click();
  else for (let i = 0; i < lines; i++) await boxes.nth(i).click();
  await dlg.getByRole("button", { name: /^Add(\s|$)/ }).click();
  await expect(dlg).toHaveCount(0);
}

const withReason = (name: string, fn: () => void) =>
  purchaseTest.describe(name, () => {
    purchaseTest.beforeAll(async () => {
      await ensureReason();
    });
    // a draft holds its GRN products (each product of a receipt can be credited once), so every case clears its own drafts
    purchaseTest.afterEach(async () => {
      await deleteE2eCns();
    });
    purchaseTest.afterAll(async () => {
      await deleteE2eCns();
      await deleteReason();
    });
    fn();
  });

// ═════════════════════════════════════════════════════════════════════════
// List
// ═════════════════════════════════════════════════════════════════════════
purchaseTest.describe("CN — List", () => {
  purchaseTest(
    "TC-CN-010001 View All Credit Notes",
    {
      annotation: [
        { type: "preconditions", description: "data:reset seed CN 2 ใบ (CN26110001 draft, CN26110002 completed)" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note\n2. ดูตาราง\n3. คลิกแถว CN26110001" },
        { type: "expected", description: "ตารางแสดง CN26110001 (Draft) และ CN26110002 (Completed) พร้อม GRN261100001; คลิกแถวเปิดหน้า detail ของใบนั้น" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      await new CreditNotePage(page).gotoList();
      await expect(page.getByRole("row").filter({ hasText: "CN26110001" })).toContainText(/draft/i);
      await expect(page.getByRole("row").filter({ hasText: "CN26110002" })).toContainText(/completed/i);
      await expect(page.getByRole("row").filter({ hasText: "CN26110001" })).toContainText("GRN261100001");
      const draft = await seededCn("draft");
      await page.getByRole("row").filter({ hasText: "CN26110001" }).getByText("CN26110001").click();
      await expect(page).toHaveURL(new RegExp(`credit-note/${draft.id}$`));
    },
  );

  purchaseTest(
    "TC-CN-010002 Apply Status Filter",
    {
      annotation: [
        { type: "preconditions", description: "มี CN Draft 1 ใบและ Completed 1 ใบ" },
        { type: "steps", description: "1. คลิก Filter → Status → DRAFT" },
        { type: "expected", description: "request มีตัวกรอง status; เหลือเฉพาะ CN26110001 (Draft) ไม่มี CN26110002" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      await new CreditNotePage(page).gotoList();
      const filtered = page.waitForRequest((r) => /credit-notes\?.*filter/.test(decodeURIComponent(r.url())));
      await page.getByRole("button", { name: "Filter" }).click();
      await page.locator("[data-slot=popover-content]:visible").getByRole("button", { name: "Status" }).click();
      await page.getByText("DRAFT", { exact: true }).last().click();
      expect(decodeURIComponent((await filtered).url())).toMatch(/status/i);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("row").filter({ hasText: "CN26110001" })).toHaveCount(1);
      await expect(page.getByRole("row").filter({ hasText: "CN26110002" })).toHaveCount(0);
    },
  );

  purchaseTest(
    "TC-CN-010003 Filter by Vendor",
    {
      annotation: [
        { type: "preconditions", description: "CN ทั้ง 2 ใบเป็นของ vendor เอบีโอ โฟกัส ดีไซน์" },
        { type: "steps", description: "1. ค้นหา 'เอบีโอ' แล้วกด Enter\n2. ค้นหาชื่อ vendor ที่ไม่มี" },
        { type: "expected", description: "ค้นด้วย 'เอบีโอ' แสดงทั้ง 2 ใบ; ค้นด้วยชื่อที่ไม่มีแสดง 'No data found'" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      await new CreditNotePage(page).gotoList();
      await search(page, "เอบีโอ");
      await expect(page.getByRole("row").filter({ hasText: /CN2611/ })).toHaveCount(2, { timeout: 10_000 });
      await search(page, `zz-vendor-${uid}`);
      await expect(page.getByText("No data found")).toBeVisible({ timeout: 10_000 });
    },
  );

  purchaseTest(
    "TC-CN-010004 Invalid Filter Input",
    {
      annotation: [
        { type: "preconditions", description: "มี CN ใน TEST BU" },
        { type: "steps", description: "1. ค้นหาข้อความอักขระพิเศษ ';--%\"\n2. ล้างช่องค้นหา" },
        { type: "expected", description: "ไม่เกิด error: แสดง 'No data found' แล้วกลับมาแสดง CN ทั้ง 2 ใบเมื่อล้างช่อง" },
        { type: "priority", description: "Low" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      await new CreditNotePage(page).gotoList();
      await search(page, "';--%\"");
      await expect(page.getByText("No data found")).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText("Something went wrong")).toHaveCount(0);
      await search(page, "");
      await expect(page.getByRole("row").filter({ hasText: /CN2611/ })).toHaveCount(2, { timeout: 10_000 });
    },
  );

  purchaseTest(
    "TC-CN-010005 No Credit Notes Available",
    {
      annotation: [
        { type: "preconditions", description: "ไม่มี CN สถานะ Cancelled" },
        { type: "steps", description: "1. คลิก Filter → Status → CANCELLED" },
        { type: "expected", description: "ตารางแสดง empty state 'No data found' ไม่มีแถว CN" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      await new CreditNotePage(page).gotoList();
      await page.getByRole("button", { name: "Filter" }).click();
      await page.locator("[data-slot=popover-content]:visible").getByRole("button", { name: "Status" }).click();
      await page.getByText("CANCELLED", { exact: true }).last().click();
      await page.keyboard.press("Escape");
      await expect(page.getByText("No data found")).toBeVisible({ timeout: 10_000 });
      await expect(page.getByRole("row").filter({ hasText: /CN2611/ })).toHaveCount(0);
    },
  );
});

// ═════════════════════════════════════════════════════════════════════════
// Create
// ═════════════════════════════════════════════════════════════════════════
withReason("CN — Create from GRN", () => {
  purchaseTest(
    "TC-CN-020001 Create Quantity-Based Credit Note from GRN - Happy Path",
    {
      annotation: [
        { type: "preconditions", description: "มี GRN261100002 (committed, Ground Beef 5 KG); มี reason ของ test" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note/new\n2. เลือก Vendor, GRN, Reason, กรอก Tax Invoice # และวันที่\n3. Add Item ติ๊ก Ground Beef → Add แล้วกรอก Return qty 1\n4. Create" },
        { type: "expected", description: "toast สำเร็จ; backend มี CN ประเภท quantity_return อ้าง GRN261100002 หนึ่งบรรทัด return_qty 1 สถานะ draft" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const taxNo = `E2E-CN-new-${uid}`;
      await fillHeader(page, taxNo);
      await addFromGrn(page, 1);
      await typeInto(rowsOf(page).first().locator('input[name$=".quantity"]'), 1);
      await button(page, "Create").click();
      expect(await lastToast(page)).toMatch(/created|success/i);
      const mine = [];
      for (const c of await listCns()) {
        const d = (await getCn(c.id)).data!;
        if (d.tax_invoice_no === taxNo) mine.push(d);
      }
      expect(mine).toHaveLength(1);
      expect(mine[0].credit_note_type).toBe("quantity_return");
      expect(mine[0].grn?.no).toBe("GRN261100002");
      expect(mine[0].credit_note_detail).toHaveLength(1);
      expect(Number(mine[0].credit_note_detail[0].return_qty)).toBe(1);
      expect(mine[0].doc_status).toBe("draft");
    },
  );

  purchaseTest(
    "TC-CN-020002 Create Quantity-Based Credit Note from GRN - Invalid Vendor",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้มีสิทธิ์สร้าง CN" },
        { type: "steps", description: "1. เปิดฟอร์ม New Credit Note\n2. ดูช่อง GRN No. ก่อนเลือก Vendor\n3. เลือก Vendor" },
        { type: "expected", description: "ก่อนเลือก Vendor ช่อง GRN No. ถูกปิดใช้งาน (เลือก GRN โดยไม่มี vendor ไม่ได้); หลังเลือก vendor ช่อง GRN เปิดและมี GRN261100002 ให้เลือก" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      await page.goto(`${LIST}/new`);
      await expect(page.getByRole("button", { name: "Select GRN" })).toBeDisabled({ timeout: 15_000 });
      await pickLookup(page, page.getByRole("button", { name: "Select Vendor" }));
      await expect(page.getByRole("button", { name: "Select GRN" })).toBeEnabled({ timeout: 10_000 });
      await page.getByRole("button", { name: "Select GRN" }).click();
      await expect(page.locator("[data-slot=popover-content]:visible button[data-value]").filter({ hasText: "GRN261100002" })).toBeVisible();
    },
  );

  purchaseTest(
    "TC-CN-020003 Create Quantity-Based Credit Note from GRN - No GRN Selected",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้มีสิทธิ์สร้าง CN" },
        { type: "steps", description: "1. เปิดฟอร์ม New Credit Note\n2. ไม่เลือก GRN\n3. คลิก Add Item" },
        { type: "expected", description: "ไม่มีรายการสินค้าถูกเพิ่ม: dialog 'Select from GRN' ไม่แสดงบรรทัดให้ติ๊ก (ไม่มี checkbox) และตารางยังเป็น 'No Items Yet'" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      await page.goto(`${LIST}/new`);
      await button(page, "Add Item").click();
      await page.waitForTimeout(1000);
      await expect(page.locator("[role=dialog]:visible").getByRole("checkbox")).toHaveCount(0);
      await page.keyboard.press("Escape");
      await expect(page.getByText("No Items Yet")).toBeVisible();
    },
  );

  purchaseTest(
    "TC-CN-020004 Create Quantity-Based Credit Note from GRN - Insufficient Quantity",
    {
      annotation: [
        { type: "preconditions", description: "GRN261100002 รับ Ground Beef 5 KG" },
        { type: "steps", description: "1. กรอกหัวฟอร์มและ Add Item Ground Beef\n2. พิมพ์ Return qty 10 (เกินที่รับ 5)\n3. Create" },
        { type: "expected", description: "ไม่บันทึก: ไม่มี toast สำเร็จ ยังอยู่ที่ /new และไม่มี CN ที่ใช้เลข tax invoice นั้นใน backend" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const taxNo = `E2E-CN-over-${uid}`;
      await fillHeader(page, taxNo);
      await addFromGrn(page, 1);
      await typeInto(rowsOf(page).first().locator('input[name$=".quantity"]'), 10);
      await button(page, "Create").click();
      await page.waitForTimeout(1500);
      await expect(page.locator("[data-sonner-toast]").filter({ hasText: /created|success/i })).toHaveCount(0);
      await expect(page).toHaveURL(/credit-note\/new/);
      for (const c of await listCns()) expect((await getCn(c.id)).data!.tax_invoice_no).not.toBe(taxNo);
    },
  );
});

// ═════════════════════════════════════════════════════════════════════════
// Create — validation
// ═════════════════════════════════════════════════════════════════════════
withReason("CN — Create validation", () => {
  purchaseTest(
    "TC-CN-030002 Negative - Missing Vendor",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้มีสิทธิ์สร้าง CN" },
        { type: "steps", description: "1. เปิดฟอร์ม New Credit Note\n2. ไม่เลือก Vendor\n3. Create" },
        { type: "expected", description: "ไม่บันทึก: ยังอยู่ที่ /new ไม่มี toast สำเร็จ และไม่มี CN ใหม่ใน backend" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const before = (await listCns()).length;
      await page.goto(`${LIST}/new`);
      await button(page, "Create").click();
      await page.waitForTimeout(1500);
      await expect(page).toHaveURL(/credit-note\/new/);
      await expect(page.locator("[data-sonner-toast]").filter({ hasText: /created|success/i })).toHaveCount(0);
      expect((await listCns()).length).toBe(before);
    },
  );

  purchaseTest(
    "TC-CN-030003 Edge Case - No GRN Reference",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้มีสิทธิ์สร้าง CN" },
        { type: "steps", description: "1. เปิดฟอร์ม New Credit Note\n2. เลือก Vendor แต่ไม่เลือก GRN\n3. Create" },
        { type: "expected", description: "ไม่บันทึก: ช่อง 'Select GRN' ยังอยู่ ไม่มี toast สำเร็จ ไม่มี CN ใหม่ใน backend" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      const before = (await listCns()).length;
      await page.goto(`${LIST}/new`);
      await pickLookup(page, page.getByRole("button", { name: "Select Vendor" }));
      await button(page, "Create").click();
      await page.waitForTimeout(1500);
      await expect(page.getByRole("button", { name: "Select GRN" })).toBeVisible();
      await expect(page.locator("[data-sonner-toast]").filter({ hasText: /created|success/i })).toHaveCount(0);
      expect((await listCns()).length).toBe(before);
    },
  );

  purchaseTest(
    "TC-CN-080002 Negative - No Credit Reason Selected",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้มีสิทธิ์สร้าง CN" },
        { type: "steps", description: "1. กรอก Vendor, GRN, Tax Invoice # และ Add Item\n2. ไม่เลือก Reason\n3. Create" },
        { type: "expected", description: "ไม่บันทึก: ช่อง 'Select CN Reason' ยังอยู่ ไม่มี toast สำเร็จ ไม่มี CN ที่ใช้เลข tax invoice นั้น" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const taxNo = `E2E-CN-noreason-${uid}`;
      await page.goto(`${LIST}/new`);
      await pickLookup(page, page.getByRole("button", { name: "Select Vendor" }));
      await pickLookup(page, page.getByRole("button", { name: "Select GRN" }), "GRN261100002");
      await page.locator("#cn-tax-invoice-no").fill(taxNo);
      await addFromGrn(page, 1);
      await button(page, "Create").click();
      await page.waitForTimeout(1500);
      await expect(page.getByRole("button", { name: "Select CN Reason" })).toBeVisible();
      await expect(page.locator("[data-sonner-toast]").filter({ hasText: /created|success/i })).toHaveCount(0);
      for (const c of await listCns()) expect((await getCn(c.id)).data!.tax_invoice_no).not.toBe(taxNo);
    },
  );

  purchaseTest(
    "TC-CN-080003 Edge Case - Maximum Character Limit for Description",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้มีสิทธิ์สร้าง CN" },
        { type: "steps", description: "1. เปิดฟอร์ม New Credit Note\n2. วางข้อความ 300 ตัวอักษรในช่อง Description" },
        { type: "expected", description: "ช่อง Description รับสูงสุด 256 ตัวอักษร (ตัวนับ 256/256) ส่วนที่เกินถูกตัด" },
        { type: "priority", description: "Low" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      await page.goto(`${LIST}/new`);
      const box = page.locator("#cn-description");
      await box.fill("x".repeat(300));
      expect((await box.inputValue()).length).toBe(256);
      await expect(page.getByText("256/256")).toBeVisible();
    },
  );
});

// ═════════════════════════════════════════════════════════════════════════
// View
// ═════════════════════════════════════════════════════════════════════════
purchaseTest.describe("CN — View", () => {
  purchaseTest(
    "TC-CN-040001 View existing credit note",
    {
      annotation: [
        { type: "preconditions", description: "มี CN26110001 (draft) ที่ data:reset seed" },
        { type: "steps", description: "1. เปิดหน้า detail ของ CN26110001" },
        { type: "expected", description: "แสดงเลข CN, สถานะ Draft, vendor, GRN No. GRN261100001, ประเภท Quantity Return, รายการ Ground Beef 1.00KG และ Grand Total 100.00 ตรงกับ backend; มีปุ่ม Edit/Submit" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const d = await seededCn("draft");
      await gotoCn(page, d.id);
      const rec = (await getCn(d.id)).data!;
      expect(rec.credit_note_detail).toHaveLength(1);
      const main = page.locator("main");
      await expect(main).toContainText("CN26110001");
      await expect(main).toContainText(/draft/i);
      await expect(main).toContainText("GRN261100001");
      await expect(main).toContainText("Quantity Return");
      await expect(main).toContainText(rec.credit_note_detail[0].product.name);
      await expect(main).toContainText(/Grand Total\s*\|?\s*100\.00/);
      await expect(page.getByRole("button", { name: "Submit", exact: true })).toBeVisible();
    },
  );

  purchaseTest(
    "TC-CN-040002 Attempt to view non-existent credit note",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้มีสิทธิ์ view" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note/00000000-0000-4000-8000-000000000000" },
        { type: "expected", description: "แสดงหน้า error ('Something went wrong' + Try again) ไม่มีปุ่ม Edit/Submit" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      await page.goto(`${LIST}/00000000-0000-4000-8000-000000000000`);
      await expect(page.getByText("Something went wrong").first()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole("button", { name: /^(edit|submit)$/i })).toHaveCount(0);
    },
  );
});

requestorTest.describe("CN — View — Permission denial", () => {
  requestorTest(
    "TC-CN-040003 View credit note without necessary permissions",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Requestor — ไม่มี permission credit_note" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note" },
        { type: "expected", description: "แสดงหน้า 'Permission Denied' แทน list; ไม่มีปุ่ม New Credit Note" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Authorization" },
      ],
    },
    async ({ page }) => {
      await page.goto(LIST);
      await expect(page.getByRole("heading", { name: "Permission Denied" })).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole("button", { name: "New Credit Note" })).toHaveCount(0);
    },
  );
});

// ═════════════════════════════════════════════════════════════════════════
// Edit / items / reason (own draft)
// ═════════════════════════════════════════════════════════════════════════
withReason("CN — Edit", () => {
  purchaseTest(
    "TC-CN-050001 Happy Path - Edit Credit Note",
    {
      annotation: [
        { type: "preconditions", description: "มี CN draft ของ test (1 บรรทัด)" },
        { type: "steps", description: "1. เปิด CN → Edit\n2. แก้ Description\n3. Save" },
        { type: "expected", description: "toast สำเร็จ; กลับสู่โหมดดูและแสดง Description ใหม่; backend เก็บ description ใหม่" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const g = await createDraftCn("edit");
      await gotoCn(page, g.id);
      await button(page, "Edit").click();
      const text = `edited ${uid}`;
      await page.locator("#cn-description").fill(text);
      await save(page);
      await expect(page.locator("main")).toContainText(text);
      expect((await getCn(g.id)).data!.description).toBe(text);
    },
  );

  purchaseTest(
    "TC-CN-050002 Negative - Invalid Total Amount",
    {
      annotation: [
        { type: "preconditions", description: "มี CN draft ของ test ประเภท Quantity Return (return_qty 1)" },
        { type: "steps", description: "1. เปิด CN → Edit\n2. ตั้ง Return qty แถวแรกเป็น 0 → Save (draft)\n3. คลิก Submit และยืนยัน" },
        { type: "expected", description: "Save เป็นการบันทึกร่าง (cn-form.tsx draftSaveHandler) จึงรับ qty 0 ได้; แต่ Submit ไม่ผ่าน — CN ยังเป็น draft (ไม่ completed) และไม่มี toast สำเร็จของการ submit" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const g = await createDraftCn("zeroqty");
      await gotoCn(page, g.id);
      await button(page, "Edit").click();
      await typeInto(rowsOf(page).first().locator('input[name$=".quantity"]'), 0);
      await save(page);
      expect(Number((await getCn(g.id)).data!.credit_note_detail[0].return_qty)).toBe(0);
      await button(page, "Submit").click();
      await confirmDialog(page, /submit|confirm|yes/i);
      await page.waitForTimeout(2000);
      expect((await getCn(g.id)).data!.doc_status).toBe("draft");
      await expect(page.locator("main")).toContainText(/draft/i);
    },
  );

  purchaseTest(
    "TC-CN-050004 Edge Case - Edit Credit Note with No Items",
    {
      annotation: [
        { type: "preconditions", description: "มี CN draft ของ test (1 บรรทัด)" },
        { type: "steps", description: "1. เปิด CN → Edit\n2. ลบบรรทัดเดียวที่มี → Save (draft)\n3. คลิก Submit และยืนยัน" },
        { type: "expected", description: "ตารางแสดง 'No Items Yet'; Save บันทึกร่างได้ (draftSaveHandler) แต่ Submit ไม่ผ่าน — CN ยังเป็น draft และ backend มี 0 บรรทัด" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      const g = await createDraftCn("noitems");
      await gotoCn(page, g.id);
      await button(page, "Edit").click();
      await rowsOf(page).first().getByRole("button", { name: /remove|delete/i }).first().click();
      await page.waitForTimeout(500);
      if (await page.locator("[role=alertdialog]:visible").count()) await confirmDialog(page, /remove|delete|confirm|yes/i);
      await expect(page.getByText("No Items Yet")).toBeVisible();
      await save(page);
      expect((await getCn(g.id)).data!.credit_note_detail).toHaveLength(0);
      await button(page, "Submit").click();
      await confirmDialog(page, /submit|confirm|yes/i);
      await page.waitForTimeout(2000);
      expect((await getCn(g.id)).data!.doc_status).toBe("draft");
    },
  );

  purchaseTest(
    "TC-CN-060001 Add Credit Note Item with Valid Lot Selection",
    {
      annotation: [
        { type: "preconditions", description: "มี CN draft ของ test 1 บรรทัด (Australian Sirloin) จาก GRN261100003 ซึ่งมีสินค้า 2 รายการ (ไม่มี lot ใน CN แล้ว — เลือกบรรทัดจาก GRN)" },
        { type: "steps", description: "1. เปิด CN → Edit\n2. Add Item ติ๊กบรรทัดที่สอง (AAA Beef) จาก 'Select from GRN' → Add\n3. ตั้ง Return qty 1 → Save" },
        { type: "expected", description: "toast สำเร็จ; backend มี 2 บรรทัด (บรรทัดที่เพิ่มมี return_qty 1 สินค้าต่างจากบรรทัดเดิม)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const g = await createDraftCn("additem", { lines: 1, grn: "received" });
      await gotoCn(page, g.id);
      await button(page, "Edit").click();
      await addFromGrn(page, 1, "last");
      await typeInto(rowsOf(page).first().locator('input[name$=".quantity"]'), 1);
      await save(page);
      const rec = (await getCn(g.id)).data!;
      expect(rec.credit_note_detail).toHaveLength(2);
      expect(new Set(rec.credit_note_detail.map((d) => d.product.id)).size).toBe(2);
      for (const d of rec.credit_note_detail) expect(Number(d.return_qty)).toBe(1);
    },
  );

  purchaseTest(
    "TC-CN-060003 Remove Credit Note Item with Lot Selection",
    {
      annotation: [
        { type: "preconditions", description: "มี CN draft ของ test 2 บรรทัด (GRN261100003)" },
        { type: "steps", description: "1. เปิด CN → Edit\n2. ลบบรรทัดแรก (ยืนยันถ้ามี dialog)\n3. Save" },
        { type: "expected", description: "ตารางเหลือ 1 แถว; หลัง Save backend มี 1 บรรทัด" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const g = await createDraftCn("rmitem", { lines: 2 });
      await gotoCn(page, g.id);
      await button(page, "Edit").click();
      await expect(rowsOf(page).filter({ has: page.getByRole("button", { name: /remove|delete/i }) })).toHaveCount(2);
      await rowsOf(page).first().getByRole("button", { name: /remove|delete/i }).first().click();
      await page.waitForTimeout(500);
      if (await page.locator("[role=alertdialog]:visible").count()) await confirmDialog(page, /remove|delete|confirm|yes/i);
      await save(page);
      expect((await getCn(g.id)).data!.credit_note_detail).toHaveLength(1);
    },
  );

  purchaseTest(
    "TC-CN-080001 Happy Path - Select Credit Reason and Provide Description",
    {
      annotation: [
        { type: "preconditions", description: "มี CN draft ของ test ที่มี Reason 'E2E-CN reason'" },
        { type: "steps", description: "1. เปิดหน้า detail ของ CN\n2. ดู Reason และ Description\n3. Edit → แก้ Description → Save" },
        { type: "expected", description: "โหมดดูแสดง Reason 'E2E-CN reason'; หลัง Save backend ยังเก็บ reason เดิมและ description ใหม่" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const g = await createDraftCn("reason");
      await gotoCn(page, g.id);
      await expect(page.locator("main")).toContainText("E2E-CN reason");
      await button(page, "Edit").click();
      const text = `reason edit ${uid}`;
      await page.locator("#cn-description").fill(text);
      await save(page);
      const rec = (await getCn(g.id)).data!;
      expect(rec.description).toBe(text);
      expect(rec.cn_reason?.name).toBe("E2E-CN reason");
    },
  );

  purchaseTest(
    "TC-CN-070001 Review Existing Credit Note with Quantity-Based Items",
    {
      annotation: [
        { type: "preconditions", description: "มี CN26110002 (completed) ที่ data:reset seed" },
        { type: "steps", description: "1. เปิดหน้า detail ของ CN26110002\n2. คลิกแท็บ Stock Movement" },
        { type: "expected", description: "แท็บ Stock Movement แสดงข้อมูลของสินค้า Chilled Angus Australia ของใบนั้น (ไม่ว่างเปล่า)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const c = await seededCn("completed");
      await page.goto(`${LIST}/${c.id}`);
      await expect(page.getByRole("tab", { name: /stock movement/i })).toBeVisible({ timeout: 20_000 });
      await page.getByRole("tab", { name: /stock movement/i }).click();
      await expect(page.locator("main")).toContainText("Chilled Angus", { timeout: 15_000 });
    },
  );

  purchaseTest(
    "TC-CN-070003 Review Empty Credit Note",
    {
      annotation: [
        { type: "preconditions", description: "มี CN draft ของ test (ยังไม่ submit จึงยังไม่มีการเคลื่อนไหวสต๊อก)" },
        { type: "steps", description: "1. เปิดหน้า detail ของ CN draft\n2. คลิกแท็บ Stock Movement" },
        { type: "expected", description: "แท็บไม่แสดงแถวสต๊อก (ไม่มีชื่อสินค้า) และไม่เกิด error" },
        { type: "priority", description: "Low" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      const g = await createDraftCn("emptystock");
      await gotoCn(page, g.id);
      await page.getByRole("tab", { name: /stock movement/i }).click();
      await page.waitForTimeout(1500);
      await expect(page.getByText("Something went wrong")).toHaveCount(0);
      await expect(page.locator("table tbody tr").filter({ hasText: "Ground Beef" })).toHaveCount(0);
    },
  );
});

// ═════════════════════════════════════════════════════════════════════════
// Comments & attachments
// ═════════════════════════════════════════════════════════════════════════
withReason("CN — Comments & attachments", () => {
  const png = () => {
    const dir = mkdtempSync(join(tmpdir(), "cn-att-"));
    const file = join(dir, "e2e-pixel.png");
    writeFileSync(file, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
    return file;
  };
  const open = async (page: Page) => {
    await page.getByRole("button", { name: "Comment", exact: true }).click();
    const dlg = page.locator("[role=dialog]:visible").last();
    await expect(dlg).toContainText(/Comments \(\d+\)/);
    return dlg;
  };

  purchaseTest(
    "TC-CN-090001 Add valid comments and attachments successfully",
    {
      annotation: [
        { type: "preconditions", description: "มี CN draft ของ test (ไม่มี comment)" },
        { type: "steps", description: "1. เปิด CN → Comment\n2. Attach file เลือกรูป PNG\n3. พิมพ์ข้อความ → Send comment" },
        { type: "expected", description: "header เป็น 'Comments (1)' แสดงข้อความ ชื่อผู้ส่ง และไฟล์แนบ e2e-pixel.png" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const g = await createDraftCn("c1");
      await gotoCn(page, g.id);
      const dlg = await open(page);
      await expect(dlg).toContainText("Comments (0)");
      await dlg.locator("input[type=file]").setInputFiles(png());
      const text = `hello ${uid}`;
      await dlg.getByPlaceholder("Add comment...").fill(text);
      await dlg.getByRole("button", { name: "Send comment" }).click();
      await expect(dlg).toContainText("Comments (1)", { timeout: 20_000 });
      await expect(dlg).toContainText(text);
      await expect(dlg).toContainText("purchase carmensoftware");
      await expect(dlg.getByText("e2e-pixel.png").or(dlg.locator("img").first())).toBeVisible({ timeout: 15_000 });
    },
  );

  purchaseTest(
    "TC-CN-090003 Attempt to upload an invalid file type",
    {
      annotation: [
        { type: "preconditions", description: "มี CN draft ของ test" },
        { type: "steps", description: "1. เปิด CN → Comment\n2. Attach file เลือกไฟล์ .txt" },
        { type: "expected", description: "toast 'only JPG, PNG, WEBP, GIF, PDF files are allowed'; ไม่มีไฟล์แนบ ยังเป็น 'Comments (0)'" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const g = await createDraftCn("c3");
      const dir = mkdtempSync(join(tmpdir(), "cn-att-"));
      const txt = join(dir, "e2e-note.txt");
      writeFileSync(txt, "hello");
      await gotoCn(page, g.id);
      const dlg = await open(page);
      await dlg.locator("input[type=file]").setInputFiles(txt);
      await expect(page.locator("[data-sonner-toast]").filter({ hasText: /only JPG, PNG, WEBP, GIF, PDF/i })).toBeVisible({ timeout: 10_000 });
      await expect(dlg).toContainText("Comments (0)");
    },
  );

  purchaseTest(
    "TC-CN-090004 Attach multiple documents to a credit note",
    {
      annotation: [
        { type: "preconditions", description: "มี CN draft ของ test" },
        { type: "steps", description: "1. เปิด CN → Comment\n2. Attach file เลือกรูป PNG สองไฟล์พร้อมกัน\n3. พิมพ์ข้อความ → Send comment" },
        { type: "expected", description: "comment เดียวถูกเพิ่ม ('Comments (1)') พร้อมไฟล์แนบสองไฟล์ (รูป 2 รูปใน comment นั้น)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const g = await createDraftCn("c4");
      const a = png();
      const dir2 = mkdtempSync(join(tmpdir(), "cn-att-"));
      const b = join(dir2, "e2e-pixel-2.png");
      writeFileSync(b, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
      await gotoCn(page, g.id);
      const dlg = await open(page);
      await dlg.locator("input[type=file]").setInputFiles([a, b]);
      await dlg.getByPlaceholder("Add comment...").fill(`two files ${uid}`);
      await dlg.getByRole("button", { name: "Send comment" }).click();
      await expect(dlg).toContainText("Comments (1)", { timeout: 20_000 });
      await expect(dlg.locator("img")).toHaveCount(2, { timeout: 15_000 });
    },
  );
});

purchaseTest.describe("CN — Comments — no document", () => {
  purchaseTest(
    "TC-CN-090005 Attempt to add comments when no credit note exists",
    {
      annotation: [
        { type: "preconditions", description: "ไม่มี CN ตาม id" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note/00000000-0000-4000-8000-000000000001\n2. มองหาปุ่ม Comment" },
        { type: "expected", description: "แสดงหน้า error แทน detail; ไม่มีปุ่ม Comment ให้เปิด" },
        { type: "priority", description: "Low" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      await page.goto(`${LIST}/00000000-0000-4000-8000-000000000001`);
      await expect(page.getByText("Something went wrong").first()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole("button", { name: "Comment", exact: true })).toHaveCount(0);
    },
  );
});

// ═════════════════════════════════════════════════════════════════════════
// Submit (was "Commit")
// ═════════════════════════════════════════════════════════════════════════
withReason("CN — Submit", () => {
  purchaseTest(
    "TC-CN-100001 Commit credit note - Happy path",
    {
      annotation: [
        { type: "preconditions", description: "มี CN draft ของ test (1 บรรทัด return_qty 1) — การ 'commit' ของ CN คือปุ่ม Submit" },
        { type: "steps", description: "1. เปิด CN draft\n2. คลิก Submit ที่ footer\n3. ยืนยันใน dialog" },
        { type: "expected", description: "backend เปลี่ยนสถานะเป็น completed; หน้าแสดง badge Completed และไม่มีปุ่ม Edit/Submit; แท็บ Stock Movement แสดงสินค้าของใบ" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const g = await createDraftCn("submit");
      await gotoCn(page, g.id);
      await button(page, "Submit").click();
      await confirmDialog(page, /submit|confirm|yes/i);
      await expect.poll(async () => (await getCn(g.id)).data!.doc_status, { timeout: 60_000 }).toBe("completed");
      await page.reload();
      await expect(page.locator("main")).toContainText(/completed/i, { timeout: 15_000 });
      await expect(page.getByRole("button", { name: "Submit", exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Edit", exact: true })).toHaveCount(0);
    },
  );

  purchaseTest(
    "TC-CN-100003 Commit credit note - Invalid credit note status",
    {
      annotation: [
        { type: "preconditions", description: "มี CN26110002 (completed)" },
        { type: "steps", description: "1. เปิดหน้า detail ของ CN26110002\n2. มองหาปุ่ม Submit/Edit" },
        { type: "expected", description: "ไม่มีปุ่ม Submit และ Edit — ส่งซ้ำ/แก้ใบที่ Completed แล้วไม่ได้; backend ยังเป็น completed" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const c = await seededCn("completed");
      await page.goto(`${LIST}/${c.id}`);
      await expect(page.locator("main")).toContainText(/completed/i, { timeout: 20_000 });
      await expect(page.getByRole("button", { name: "Submit", exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Edit", exact: true })).toHaveCount(0);
      expect((await getCn(c.id)).data!.doc_status).toBe("completed");
    },
  );
});

// ═════════════════════════════════════════════════════════════════════════
// Permission denial (FC = credit_note.view only)
// ═════════════════════════════════════════════════════════════════════════
fcTest.describe("CN — Permission denial", () => {
  const draftUrl = async () => `${LIST}/${(await seededCn("draft")).id}`;

  fcTest(
    "TC-CN-050003 Negative - No Permission",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น FC (view อย่างเดียว); CN26110001 (draft)" },
        { type: "steps", description: "1. เปิดหน้า detail ของ CN26110001\n2. ดูปุ่ม Edit" },
        { type: "expected", description: "ปุ่ม Edit ถูกปิดใช้งาน (aria-disabled) กดแล้วไม่เข้าโหมดแก้ไข (ไม่มีช่อง Description)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Authorization" },
      ],
    },
    async ({ page }) => {
      await page.goto(await draftUrl());
      const edit = page.getByRole("button", { name: "Edit", exact: true });
      await expect(edit).toBeVisible({ timeout: 20_000 });
      await expect(edit).toHaveAttribute("aria-disabled", "true");
      await edit.click({ force: true });
      await expect(page.locator("#cn-description")).toHaveCount(0);
    },
  );

  fcTest(
    "TC-CN-060005 Manage Credit Note Items with No Permission",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น FC (view อย่างเดียว); CN26110001 (draft)" },
        { type: "steps", description: "1. เปิดหน้า detail ของ CN26110001\n2. มองหาปุ่ม Add Item/Remove และช่อง Return qty" },
        { type: "expected", description: "ไม่มีปุ่ม Add Item/Remove และไม่มีช่อง Return qty (โหมดดูอย่างเดียว) และ Edit ถูกปิดใช้งาน" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Authorization" },
      ],
    },
    async ({ page }) => {
      await page.goto(await draftUrl());
      await expect(page.getByRole("button", { name: "Edit", exact: true })).toHaveAttribute("aria-disabled", "true", { timeout: 20_000 });
      await expect(page.getByRole("button", { name: "Add Item" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: /^(remove|delete)$/i })).toHaveCount(0);
      await expect(page.locator('input[name$=".quantity"]')).toHaveCount(0);
    },
  );

  fcTest(
    "TC-CN-100002 Commit credit note - No commit permission",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น FC (view อย่างเดียว); CN26110001 (draft)" },
        { type: "steps", description: "1. เปิดหน้า detail ของ CN26110001\n2. ดูปุ่ม Submit ที่ footer" },
        { type: "expected", description: "ปุ่ม Submit ถูกปิดใช้งาน (aria-disabled) — ผู้ไม่มีสิทธิ์ไม่ควรส่งใบได้" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Authorization" },
      ],
    },
    async ({ page }) => {
      await page.goto(await draftUrl());
      const submit = page.getByRole("button", { name: "Submit", exact: true });
      await expect(submit).toBeVisible({ timeout: 20_000 });
      fcTest.fail(true, NO_GATE);
      await expect(submit).toHaveAttribute("aria-disabled", "true");
    },
  );
});

// ═════════════════════════════════════════════════════════════════════════
// BACKEND / SYSTEM-LEVEL — all skipped
// TC-CN-900101..214 = stock movement gen, journal entries, tax calc, costing,
// FIFO, audit log, sequence gen, server actions, real-time sync, etc.
// ═════════════════════════════════════════════════════════════════════════

const skipBackend = (
  testFn: typeof purchaseTest,
  id: string,
  title: string,
  pre: string,
  steps: string,
  expected: string,
  priority: string,
  testType: string,
) => {
  testFn.skip(
    `${id} ${title}`,
    {
      annotation: [
        { type: "preconditions", description: pre },
        { type: "steps", description: steps },
        { type: "expected", description: expected },
        { type: "priority", description: priority },
        { type: "testType", description: testType },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
};

purchaseTest.describe("Credit Note — Stock movement generation — Backend only", () => {
  purchaseTest.skip(
    "TC-CN-310001 Happy Path - Generate Stock Movements for Quantity-Based Credit Notes",
    {
      annotation: [
        { type: "preconditions", description: "มี credit note ประเภท QUANTITY_RETURN ที่ทุก items เลือก lots และ inventory locations แล้ว และอยู่ในสถานะ COMMITTED" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note\n2. กดปุ่ม 'View' ของ committed credit note\n3. กด 'Generate Stock Movements'" },
        { type: "expected", description: "สร้าง stock movements สำเร็จ ลด inventory balance สำหรับ items ที่คืน" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
  purchaseTest.skip(
    "TC-CN-310002 Negative Case - Generate Stock Movements with Invalid Credit Note Type",
    {
      annotation: [
        { type: "preconditions", description: "มี credit note ประเภทอื่นที่ไม่ใช่ QUANTITY_RETURN ที่ทุก items เลือก lots และ inventory locations แล้ว และอยู่ในสถานะ COMMITTED" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note\n2. กดปุ่ม 'View' ของ committed credit note\n3. กด 'Generate Stock Movements'" },
        { type: "expected", description: "แสดง error message ว่าประเภท credit note ไม่รองรับการสร้าง stock movement" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
  purchaseTest.skip(
    "TC-CN-310003 Negative Case - Generate Stock Movements Without Selected Lots",
    {
      annotation: [
        { type: "preconditions", description: "มี credit note ประเภท QUANTITY_RETURN ที่บาง items ไม่มี lots และ inventory locations และอยู่ในสถานะ COMMITTED" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note\n2. กดปุ่ม 'View' ของ committed credit note\n3. พยายามกด 'Generate Stock Movements'" },
        { type: "expected", description: "แสดง error message ว่าทุก items ต้องเลือก lots" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
  purchaseTest.skip(
    "TC-CN-310004 Edge Case - Generate Stock Movements After Changing Credit Note Status",
    {
      annotation: [
        { type: "preconditions", description: "มี credit note ประเภท QUANTITY_RETURN ที่ทุก items เลือก lots และ inventory locations แล้ว และอยู่ในสถานะ PENDING" },
        { type: "steps", description: "1. เปลี่ยนสถานะ credit note เป็น COMMITTED\n2. ไปที่ /procurement/credit-note\n3. กดปุ่ม 'View' ของ credit note ที่เป็น COMMITTED แล้ว\n4. กด 'Generate Stock Movements'" },
        { type: "expected", description: "สร้าง stock movements สำเร็จ ลด inventory balance สำหรับ items ที่คืน" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
  purchaseTest.skip(
    "TC-CN-310005 Edge Case - Generate Stock Movements with No Inventory Locations Configured",
    {
      annotation: [
        { type: "preconditions", description: "มี credit note ประเภท QUANTITY_RETURN ที่ทุก items เลือก lots แล้ว และอยู่ในสถานะ COMMITTED แต่ไม่ได้กำหนด inventory locations" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note\n2. กดปุ่ม 'View' ของ committed credit note\n3. กด 'Generate Stock Movements'" },
        { type: "expected", description: "แสดง error message ว่าต้องกำหนด inventory locations" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
});

purchaseTest.describe("Credit Note — Journal entries — Backend only", () => {
  purchaseTest.skip(
    "TC-CN-320001 Generate Journal Entries - Happy Path",
    {
      annotation: [
        { type: "preconditions", description: "สถานะ credit note เป็น COMMITTED, กำหนด GL account mapping แล้ว, accounting period เปิดอยู่, และมี vendor account" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note\n2. คลิก COMMITTED credit note\n3. กด 'Generate Journal Entries'" },
        { type: "expected", description: "สร้าง journal entries อัตโนมัติ ตัดบัญชี accounts payable และเครดิต inventory และ tax accounts" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
  purchaseTest.skip(
    "TC-CN-320002 Generate Journal Entries - Invalid GL Account Mapping",
    {
      annotation: [
        { type: "preconditions", description: "สถานะ credit note เป็น COMMITTED, GL account mapping ไม่ถูกต้อง, accounting period เปิดอยู่, และมี vendor account" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note\n2. คลิก COMMITTED credit note\n3. กด 'Generate Journal Entries'" },
        { type: "expected", description: "แสดง error message ว่า GL account mapping ไม่ถูกต้อง" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
  purchaseTest.skip(
    "TC-CN-320003 Generate Journal Entries - Accounting Period Closed",
    {
      annotation: [
        { type: "preconditions", description: "สถานะ credit note เป็น COMMITTED, กำหนด GL account mapping แล้ว, accounting period ปิดแล้ว, และมี vendor account" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note\n2. คลิก COMMITTED credit note\n3. กด 'Generate Journal Entries'" },
        { type: "expected", description: "แสดง error message ว่า accounting period ปิดแล้ว" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
  purchaseTest.skip(
    "TC-CN-320004 Generate Journal Entries - No Vendor Account",
    {
      annotation: [
        { type: "preconditions", description: "สถานะ credit note เป็น COMMITTED, กำหนด GL account mapping แล้ว, accounting period เปิดอยู่, แต่ไม่มี vendor account" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note\n2. คลิก COMMITTED credit note\n3. กด 'Generate Journal Entries'" },
        { type: "expected", description: "แสดง error message ว่าไม่มี vendor account" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
  purchaseTest.skip(
    "TC-CN-320005 Generate Journal Entries - Large Volume of Credit Notes",
    {
      annotation: [
        { type: "preconditions", description: "มี credit notes หลายรายการสถานะ COMMITTED, กำหนด GL account mapping แล้ว, accounting period เปิดอยู่, และมี vendor account" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note\n2. เลือก COMMITTED credit notes หลายรายการ\n3. กด 'Generate Journal Entries'" },
        { type: "expected", description: "สร้าง journal entries สำหรับ credit notes ที่เลือกทั้งหมด" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
});

purchaseTest.describe("Credit Note — Tax calculations — Backend only", () => {
  purchaseTest.skip(
    "TC-CN-330001 Happy Path - Credit Note with Valid Items and Taxes",
    {
      annotation: [
        { type: "preconditions", description: "Credit note มี items พร้อมจำนวนเงิน, กำหนด tax rates แล้ว, ข้อมูลภาษีของ vendor พร้อมใช้, และระบุ tax invoice reference แล้ว" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note\n2. กด 'New Credit Note'\n3. กรอก 'Vendor Name'\n4. กรอก 'Tax Invoice Reference'\n5. กด 'Add Line Item'\n6. กรอก 'Item Description', 'Quantity', และ 'Price'\n7. เลือก 'Tax Rate' ที่ใช้งาน\n8. กด 'Save'\n9. กด 'Update' เพื่อแก้ไข credit note ที่มีอยู่\n10. อัปเดต 'Quantity' และ 'Price'\n11. กด 'Save'" },
        { type: "expected", description: "ระบบคำนวณการปรับ input VAT อัตโนมัติตาม credit note ที่แก้ไข ลดภาระภาษีตามจำนวน credit" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
  purchaseTest.skip(
    "TC-CN-330002 Negative Case - Missing Tax Rate",
    {
      annotation: [
        { type: "preconditions", description: "Credit note มี items พร้อมจำนวนเงิน แต่ไม่มีการกำหนด tax rate สำหรับ items ใดๆ" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note\n2. กด 'New Credit Note'\n3. กรอก 'Vendor Name'\n4. กรอก 'Tax Invoice Reference'\n5. กด 'Add Line Item'\n6. กรอก 'Item Description', 'Quantity', และ 'Price'\n7. กด 'Save'" },
        { type: "expected", description: "ระบบไม่คำนวณการปรับภาษีใดๆ และแสดง error message ว่าต้องกำหนด tax rates" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
});

purchaseTest.describe("Credit Note — Consumed-item processing — Backend only", () => {
  purchaseTest.skip(
    "TC-CN-340001 Happy Path - Process Valid Credit Note for Consumed Item",
    {
      annotation: [
        { type: "preconditions", description: "สร้าง credit note ประเภท QUANTITY_RETURN สำหรับ item ที่ถูกใช้หมดแล้ว" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note\n2. กด 'Process Credit Note'\n3. เลือก QUANTITY_RETURN credit note\n4. กด 'Process'" },
        { type: "expected", description: "ปรับ cost of goods sold แต่ inventory balance ไม่เปลี่ยนแปลง" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
  purchaseTest.skip(
    "TC-CN-340002 Negative - Process Credit Note with Invalid Type",
    {
      annotation: [
        { type: "preconditions", description: "เลือก credit note ประเภทอื่นที่ไม่ใช่ QUANTITY_RETURN" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note\n2. กด 'Process Credit Note'\n3. เลือก credit note ประเภทอื่น\n4. กด 'Process'" },
        { type: "expected", description: "ระบบแสดง error message ว่าประเภท credit note ไม่รองรับ" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
  purchaseTest.skip(
    "TC-CN-340003 Negative - Process Credit Note Without Permissions",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ไม่มีสิทธิ์ประมวลผล credit notes" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note\n2. กด 'Process Credit Note'" },
        { type: "expected", description: "ระบบแสดง permission error message" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
  purchaseTest.skip(
    "TC-CN-340004 Edge Case - Process Credit Note for Partially Consumed Item",
    {
      annotation: [
        { type: "preconditions", description: "สร้าง credit note สำหรับ item ที่ถูกใช้ไปบางส่วน" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note\n2. กด 'Process Credit Note'\n3. เลือก credit note\n4. กด 'Process'" },
        { type: "expected", description: "ระบบแสดง error message ว่า credit note ประมวลผลได้เฉพาะกับ items ที่ถูกใช้หมดแล้วเท่านั้น" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
});

purchaseTest.describe("Credit Note — Partial-availability processing — Backend only", () => {
  purchaseTest.skip(
    "TC-CN-350001 Happy Path - Process Credit Note with Partial Availability",
    {
      annotation: [
        { type: "preconditions", description: "Inventory มี Item A 50 หน่วย, issue credit note สำหรับ Item A 60 หน่วย (ประเภท QUANTITY_RETURN)" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note/new\n2. กรอก 'Item A' ในช่อง 'Item'\n3. กรอก '60' ในช่อง 'Return Quantity'\n4. กด 'Submit'" },
        { type: "expected", description: "ระบบแบ่งการประมวลผล: 50 หน่วยย้ายไป COGS, 10 หน่วยยังไม่ได้ประมวลผล" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
  purchaseTest.skip(
    "TC-CN-350002 Negative - Insufficient Available Inventory",
    {
      annotation: [
        { type: "preconditions", description: "Inventory มี Item A 20 หน่วย, issue credit note สำหรับ Item A 50 หน่วย (ประเภท QUANTITY_RETURN)" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note/new\n2. กรอก 'Item A' ในช่อง 'Item'\n3. กรอก '50' ในช่อง 'Return Quantity'\n4. กด 'Submit'" },
        { type: "expected", description: "ระบบแสดง error message: 'Insufficient inventory available for Item A'" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
  purchaseTest.skip(
    "TC-CN-350003 Negative - Invalid Credit Note Type",
    {
      annotation: [
        { type: "preconditions", description: "Inventory มี Item A 40 หน่วย, issue credit note สำหรับ Item A 30 หน่วย แต่ประเภทไม่ใช่ QUANTITY_RETURN" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note/new\n2. กรอก 'Item A' ในช่อง 'Item'\n3. กรอก '30' ในช่อง 'Return Quantity'\n4. เลือก 'Non-Return' ในช่อง 'Type'\n5. กด 'Submit'" },
        { type: "expected", description: "ระบบแสดง error message: 'Invalid credit note type. Only QUANTITY_RETURN allowed for this action'" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
  purchaseTest.skip(
    "TC-CN-350004 Edge Case - Exact Quantity Available",
    {
      annotation: [
        { type: "preconditions", description: "Inventory มี Item A 35 หน่วย, issue credit note สำหรับ Item A 35 หน่วย (ประเภท QUANTITY_RETURN)" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note/new\n2. กรอก 'Item A' ในช่อง 'Item'\n3. กรอก '35' ในช่อง 'Return Quantity'\n4. กด 'Submit'" },
        { type: "expected", description: "ระบบประมวลผล 35 หน่วยทั้งหมดไปยัง COGS" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
});

purchaseTest.describe("Credit Note — Retrospective discount — Backend only", () => {
  purchaseTest.skip(
    "TC-CN-360001 Happy Path - Process Retrospective Vendor Discount",
    {
      annotation: [
        { type: "preconditions", description: "สร้าง credit note ส่วนลดย้อนหลังที่ถูกต้องพร้อม GRNs ในอดีตหลายรายการ" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note\n2. กด 'Process Credit Note'\n3. เลือก credit note ประเภท AMOUNT_DISCOUNT\n4. ตรวจสอบว่า credit note อ้างอิง GRNs ในอดีตหลายรายการ\n5. กด 'Process Discount'" },
        { type: "expected", description: "ระบบประมวลผล credit note โดยจัดสรรส่วนลดตามสัดส่วนให้กับ receipts ในอดีตทั่ว GRNs" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
  purchaseTest.skip(
    "TC-CN-360004 Edge Case - Single GRN Credit Note",
    {
      annotation: [
        { type: "preconditions", description: "สร้าง credit note ที่อ้างอิง GRN เพียงรายการเดียว" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note\n2. กด 'Process Credit Note'\n3. เลือก credit note ที่อ้างอิง GRN เพียงรายการเดียว" },
        { type: "expected", description: "ระบบประมวลผล credit note โดยไม่จัดสรรส่วนลดให้ GRNs อื่น เนื่องจากอ้างอิง GRN เพียงรายการเดียว" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
  purchaseTest.skip(
    "TC-CN-360005 Edge Case - No Historical GRNs",
    {
      annotation: [
        { type: "preconditions", description: "สร้าง credit note ที่ไม่อ้างอิง GRNs ในอดีตใดๆ" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note\n2. กด 'Process Credit Note'\n3. เลือก credit note ที่ไม่มี GRNs ในอดีต" },
        { type: "expected", description: "ระบบแสดง error message ว่าไม่มี GRNs ในอดีตที่อ้างอิง" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
});

purchaseTest.describe("Credit Note — Server actions — Backend only", () => {
  purchaseTest.skip(
    "TC-CN-210001 Happy Path - Create Credit Note (server action)",
    {
      annotation: [
        { type: "preconditions", description: "กำหนด server action context แล้ว, database connection พร้อมใช้, ผู้ใช้ได้รับการยืนยันตัวตนและมีสิทธิ์" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note\n2. กด 'New Credit Note'\n3. กรอก 'Credit Note Date'\n4. กรอก 'Supplier Name'\n5. กรอก 'Amount'\n6. กด 'Save'" },
        { type: "expected", description: "สร้าง credit note สำเร็จด้วย atomic transaction และ validation ที่ถูกต้อง" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
  purchaseTest.skip(
    "TC-CN-210003 Negative - Unauthorized User",
    {
      annotation: [
        { type: "preconditions", description: "กำหนด server action context แล้ว, database connection พร้อมใช้, ผู้ใช้ยังไม่ได้รับการยืนยันตัวตน" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note\n2. พยายามกด 'New Credit Note'" },
        { type: "expected", description: "ผู้ใช้ถูก redirect ไปหน้า login หรือถูกปฏิเสธการเข้าถึง" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
  purchaseTest.skip(
    "TC-CN-210004 Edge Case - Concurrent Delete",
    {
      annotation: [
        { type: "preconditions", description: "กำหนด server action context แล้ว, database connection พร้อมใช้, ผู้ใช้หลายคนได้รับการยืนยันตัวตนและมีสิทธิ์" },
        {
          type: "steps",
          description:
            "1. User A ไปที่ /procurement/credit-note\n2. User A กด 'New Credit Note'\n3. User B ไปที่ /procurement/credit-note\n4. User B กด 'Delete' บน credit note เดียวกัน\n5. User A กด 'Save'",
        },
        { type: "expected", description: "การสร้าง credit note ล้มเหลวเนื่องจากการลบพร้อมกัน พร้อม error message ที่เหมาะสม" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Edge Case" },
        { type: "note", description: SKIP_NOTE_CONCURRENCY },
      ],
    },
    async () => {},
  );
});

purchaseTest.describe("Credit Note — Vendor/GRN data fetch — Backend only", () => {
  purchaseTest.skip(
    "TC-CN-220001 Fetch vendor and GRN data with valid input",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ได้รับการยืนยันตัวตนพร้อมสิทธิ์ purchasing, ข้อมูล vendor และ GRN มีอยู่ใน database" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note\n2. กด 'Fetch Vendor and GRN Data'\n3. เลือก vendor จาก dropdown\n4. กด 'Fetch'" },
        { type: "expected", description: "ดึงและแสดงข้อมูล vendor และ GRN สำเร็จ" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
  purchaseTest.skip(
    "TC-CN-220002 Fetch vendor and GRN data with invalid vendor selection",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ได้รับการยืนยันตัวตนพร้อมสิทธิ์ purchasing, ข้อมูล vendor และ GRN มีอยู่ใน database, เลือก vendor ที่ไม่ถูกต้อง" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note\n2. กด 'Fetch Vendor and GRN Data'\n3. เลือก vendor ที่ไม่ถูกต้องจาก dropdown\n4. กด 'Fetch'" },
        { type: "expected", description: "แสดง error message ว่าเลือก vendor ไม่ถูกต้อง" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
  purchaseTest.skip(
    "TC-CN-220003 Fetch vendor and GRN data when no vendor data exists",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ได้รับการยืนยันตัวตนพร้อมสิทธิ์ purchasing, ไม่มีข้อมูล vendor และ GRN ใน database" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note\n2. กด 'Fetch Vendor and GRN Data'\n3. เลือก vendor จาก dropdown\n4. กด 'Fetch'" },
        { type: "expected", description: "ไม่พบข้อมูล vendor และ GRN และแสดง message ที่เหมาะสม" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
  purchaseTest.skip(
    "TC-CN-220004 Fetch vendor and GRN data with no vendor permissions",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ได้รับการยืนยันตัวตนแต่ไม่มีสิทธิ์ purchasing, ข้อมูล vendor และ GRN มีอยู่ใน database" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note\n2. กด 'Fetch Vendor and GRN Data'\n3. เลือก vendor จาก dropdown\n4. กด 'Fetch'" },
        { type: "expected", description: "แสดง access denied message" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
  purchaseTest.skip(
    "TC-CN-220005 Fetch vendor and GRN data with multiple vendors selected",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ได้รับการยืนยันตัวตนพร้อมสิทธิ์ purchasing, มีข้อมูล vendors หลายรายการและ GRN ใน database" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note\n2. กด 'Fetch Vendor and GRN Data'\n3. เลือก vendors หลายรายการจาก dropdown\n4. กด 'Fetch'" },
        { type: "expected", description: "แสดง error message ว่าไม่สามารถเลือก vendors หลายรายการได้" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
});

purchaseTest.describe("Credit Note — Commitment transaction — Backend only", () => {
  purchaseTest.skip(
    "TC-CN-230001 Happy Path - Commitment Transaction",
    {
      annotation: [
        { type: "preconditions", description: "มี credit note สถานะ DRAFT และ accounting period เปิดอยู่สำหรับวันที่ในเอกสาร" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note\n2. กดปุ่ม 'Execute Commitment'\n3. รอให้ transaction เสร็จสิ้น\n4. ตรวจสอบว่า journal entries, stock movements, และ vendor balance ถูกอัปเดต" },
        { type: "expected", description: "transaction ดำเนินการสำเร็จ journal entries, stock movements, และ vendor balance อัปเดตตามที่คาดหวัง" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
  purchaseTest.skip(
    "TC-CN-230002 Negative - No Credit Note",
    {
      annotation: [
        { type: "preconditions", description: "ไม่มี credit note สถานะ DRAFT" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note\n2. กดปุ่ม 'Execute Commitment'\n3. ดู error message" },
        { type: "expected", description: "แสดง error message ว่าไม่มี draft credit note" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
  purchaseTest.skip(
    "TC-CN-230003 Negative - Invalid Accounting Period",
    {
      annotation: [
        { type: "preconditions", description: "มี credit note สถานะ DRAFT แต่ accounting period ปิดแล้วสำหรับวันที่ในเอกสาร" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note\n2. กดปุ่ม 'Execute Commitment'\n3. ดู error message" },
        { type: "expected", description: "แสดง error message ว่า accounting period ปิดแล้วสำหรับวันที่ในเอกสาร" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
  purchaseTest.skip(
    "TC-CN-230004 Edge Case - Document Date Outside Accounting Period",
    {
      annotation: [
        { type: "preconditions", description: "มี credit note สถานะ DRAFT และวันที่ในเอกสารอยู่นอกช่วง accounting period ที่เปิดอยู่" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note\n2. กดปุ่ม 'Execute Commitment'\n3. ดู error message" },
        { type: "expected", description: "แสดง error message ว่าวันที่ในเอกสารอยู่นอกช่วง accounting period ที่เปิดอยู่" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Edge Case" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
  purchaseTest.skip(
    "TC-CN-230005 Negative - Insufficient Permissions",
    {
      annotation: [
        { type: "preconditions", description: "มี credit note สถานะ DRAFT และผู้ใช้ไม่มีสิทธิ์ดำเนินการ commitment transactions" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note\n2. กดปุ่ม 'Execute Commitment'\n3. ดู error message" },
        { type: "expected", description: "แสดง error message ว่าไม่มีสิทธิ์เพียงพอในการดำเนินการ commitment transactions" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
});

purchaseTest.describe("Credit Note — Void with reversal — Backend only", () => {
  purchaseTest.skip(
    "TC-CN-240001 Happy Path - Void Existing Credit Note",
    {
      annotation: [
        { type: "preconditions", description: "มี credit note สถานะ COMMITTED, accounting period เปิดอยู่สำหรับวันที่ void, ผู้ใช้มี manager role และสิทธิ์ void" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note\n2. คลิก credit note ที่ต้องการ void\n3. กดปุ่ม 'Void'\n4. ตรวจสอบว่า journal entries ถูก reverse\n5. ตรวจสอบว่า inventory balance ถูกคืน" },
        { type: "expected", description: "Credit note ถูก void, journal entries ถูก reverse, และ inventory balance ถูกคืน" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
  purchaseTest.skip(
    "TC-CN-240002 Negative Case - No Void Permission",
    {
      annotation: [
        { type: "preconditions", description: "มี credit note สถานะ COMMITTED, accounting period เปิดอยู่สำหรับวันที่ void, ผู้ใช้ไม่มีสิทธิ์ void" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note\n2. คลิก credit note ที่ต้องการ void\n3. กดปุ่ม 'Void'\n4. ตรวจสอบว่าระบบปฏิเสธการดำเนินการ" },
        { type: "expected", description: "ระบบปฏิเสธการพยายาม void credit note ของผู้ใช้" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
  purchaseTest.skip(
    "TC-CN-240003 Negative Case - Dependent Transactions Exist",
    {
      annotation: [
        { type: "preconditions", description: "มี credit note สถานะ COMMITTED, มี dependent transactions, accounting period เปิดอยู่สำหรับวันที่ void, ผู้ใช้มี manager role และสิทธิ์ void" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note\n2. คลิก credit note ที่ต้องการ void\n3. กดปุ่ม 'Void'\n4. ตรวจสอบว่าระบบปฏิเสธการดำเนินการเนื่องจาก dependent transactions" },
        { type: "expected", description: "ระบบปฏิเสธการพยายาม void credit note ของผู้ใช้เนื่องจากมี dependent transactions ที่มีอยู่" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
  purchaseTest.skip(
    "TC-CN-240004 Edge Case - Void During Closed Accounting Period",
    {
      annotation: [
        { type: "preconditions", description: "มี credit note สถานะ COMMITTED, accounting period ปิดแล้ว, ผู้ใช้มี manager role และสิทธิ์ void" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note\n2. คลิก credit note ที่ต้องการ void\n3. กดปุ่ม 'Void'\n4. ตรวจสอบว่าระบบปฏิเสธการดำเนินการเนื่องจาก accounting period ปิดแล้ว" },
        { type: "expected", description: "ระบบปฏิเสธการพยายาม void credit note ของผู้ใช้เนื่องจาก accounting period ปิดแล้ว" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Edge Case" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
});

purchaseTest.describe("Credit Note — FIFO costing — Backend only", () => {
  purchaseTest.skip(
    "TC-CN-250001 Happy Path - FIFO Calculation for Credit Note",
    {
      annotation: [
        { type: "preconditions", description: "มี items ใน credit note พร้อม lot selections และข้อมูลต้นทุน lot ใน inventory" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note\n2. เลือก credit note ที่มี lot selections\n3. กดปุ่ม 'Calculate Costs'\n4. ตรวจสอบว่าใช้วิธี FIFO\n5. ตรวจสอบว่าการคำนวณต้นทุนถูกต้องตามวิธี FIFO" },
        { type: "expected", description: "ใช้วิธี FIFO อย่างถูกต้อง และการคำนวณต้นทุนแม่นยำตาม lots ที่เลือก" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
  purchaseTest.skip(
    "TC-CN-250002 Negative - Invalid Costing Method Selection",
    {
      annotation: [
        { type: "preconditions", description: "มี items ใน credit note พร้อม lot selections และข้อมูลต้นทุน lot ใน inventory" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note\n2. เลือก credit note ที่มี lot selections\n3. กดปุ่ม 'Calculate Costs'\n4. กรอก costing method ที่ไม่ถูกต้องด้วยตนเอง\n5. ตรวจสอบว่าระบบไม่อนุญาตวิธีที่ไม่ถูกต้อง" },
        { type: "expected", description: "ระบบป้องกันการเลือก costing method ที่ไม่ถูกต้องและแสดง error message ที่เหมาะสม" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
  purchaseTest.skip(
    "TC-CN-250003 Edge Case - No Lot Selection for Credit Note",
    {
      annotation: [
        { type: "preconditions", description: "มี items ใน credit note โดยไม่มี lot selections และมีข้อมูลต้นทุน lot ใน inventory" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note\n2. เลือก credit note ที่ไม่มี lot selections\n3. กดปุ่ม 'Calculate Costs'\n4. ตรวจสอบว่าระบบไม่อนุญาตการคำนวณต้นทุนโดยไม่มี lot selections" },
        { type: "expected", description: "ระบบป้องกันการคำนวณต้นทุนโดยไม่มี lot selections และแสดง error message ที่เหมาะสม" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
  purchaseTest.skip(
    "TC-CN-250004 Negative - No Inventory Lot Cost Data",
    {
      annotation: [
        { type: "preconditions", description: "มี items ใน credit note พร้อม lot selections แต่ไม่มีข้อมูลต้นทุน lot ใน inventory" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note\n2. เลือก credit note ที่มี lot selections\n3. กดปุ่ม 'Calculate Costs'\n4. ตรวจสอบว่าระบบไม่อนุญาตการคำนวณต้นทุนเนื่องจากข้อมูลต้นทุน lot ขาดหายไป" },
        { type: "expected", description: "ระบบป้องกันการคำนวณต้นทุนเนื่องจากข้อมูลต้นทุน lot ขาดหายไป และแสดง error message ที่เหมาะสม" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
});

purchaseTest.describe("Credit Note — Tax adjustments — Backend only", () => {
  purchaseTest.skip(
    "TC-CN-260002 Negative - Invalid Tax Rate",
    {
      annotation: [
        { type: "preconditions", description: "มี credit note พร้อม items และจำนวนเงิน, มี tax rate ที่ไม่ถูกต้องหรือยังไม่ได้กำหนดสำหรับวันที่ในเอกสาร, และมีข้อมูลการลงทะเบียนภาษีของ vendor" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note\n2. กด 'New Credit Note'\n3. กรอกรายละเอียด credit note รวมถึง items และจำนวนเงิน\n4. เลือก tax rate ที่ไม่ถูกต้องหรือยังไม่ได้กำหนด\n5. กด 'Save'" },
        { type: "expected", description: "ระบบส่งคืน error message ว่าไม่สามารถใช้ tax rate ที่ไม่ถูกต้องได้" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
  purchaseTest.skip(
    "TC-CN-260003 Negative - No Vendor Tax Registration",
    {
      annotation: [
        { type: "preconditions", description: "มี credit note พร้อม items และจำนวนเงิน, กำหนด tax rates สำหรับวันที่ในเอกสารแล้ว แต่ไม่มีข้อมูลการลงทะเบียนภาษีของ vendor" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note\n2. กด 'New Credit Note'\n3. กรอกรายละเอียด credit note รวมถึง items และจำนวนเงิน\n4. กด 'Save'" },
        { type: "expected", description: "ระบบส่งคืน error message ว่าต้องมีข้อมูลการลงทะเบียนภาษีของ vendor" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
  purchaseTest.skip(
    "TC-CN-260004 Edge Case - Large Credit Note Amount",
    {
      annotation: [
        { type: "preconditions", description: "มี credit note ที่มีจำนวนเงินมาก, กำหนด tax rates สำหรับวันที่ในเอกสารแล้ว และมีข้อมูลการลงทะเบียนภาษีของ vendor" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note\n2. กด 'New Credit Note'\n3. กรอกรายละเอียด credit note รวมถึง items และจำนวนเงินมาก\n4. กด 'Save'" },
        { type: "expected", description: "คำนวณจำนวนภาษีได้อย่างแม่นยำสำหรับ credit note ที่มีจำนวนเงินมาก" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
  purchaseTest.skip(
    "TC-CN-260005 Edge Case - Zero Amount",
    {
      annotation: [
        { type: "preconditions", description: "มี credit note ที่มีจำนวนเงิน item เท่ากับศูนย์, กำหนด tax rates สำหรับวันที่ในเอกสารแล้ว และมีข้อมูลการลงทะเบียนภาษีของ vendor" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note\n2. กด 'New Credit Note'\n3. กรอกรายละเอียด credit note รวมถึง items ที่มีจำนวนเงินเป็นศูนย์\n4. กด 'Save'" },
        { type: "expected", description: "จำนวนภาษีสำหรับ items ที่มีจำนวนเงินเป็นศูนย์ถูกตั้งเป็นศูนย์" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
});

purchaseTest.describe("Credit Note — Journal entry generation (advanced) — Backend only", () => {
  purchaseTest.skip(
    "TC-CN-270002 Generate Journal Entries - Invalid Credit Note ID",
    {
      annotation: [
        { type: "preconditions", description: "กรอก credit note commitment ID ที่ไม่มีอยู่" },
        { type: "steps", description: "1. ไปที่ /journal-entries\n2. กด 'Generate Entries'\n3. กรอก credit note commitment ID ที่ไม่ถูกต้อง\n4. ตรวจสอบว่าแสดง error message" },
        { type: "expected", description: "แสดง error message ว่า credit note ID ไม่ถูกต้อง" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
  purchaseTest.skip(
    "TC-CN-270003 Generate Journal Entries - User with Limited Permissions",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้ที่มีสิทธิ์จำกัดพยายามสร้าง journal entries" },
        { type: "steps", description: "1. Login เป็นผู้ใช้ที่มีสิทธิ์จำกัด\n2. ไปที่ /journal-entries\n3. กด 'Generate Entries'\n4. ตรวจสอบว่าแสดง error message" },
        { type: "expected", description: "แสดง error message ว่าไม่มีสิทธิ์เพียงพอ" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
  purchaseTest.skip(
    "TC-CN-270004 Generate Journal Entries - Simultaneous Multiple Commitments",
    {
      annotation: [
        { type: "preconditions", description: "สร้าง credit note commitments หลายรายการพร้อมกัน" },
        { type: "steps", description: "1. ไปที่ /journal-entries\n2. กด 'Generate Entries'\n3. เริ่มสร้าง journal entries สำหรับหลาย commitments พร้อมกัน\n4. ตรวจสอบว่าสร้าง journal entries ครบสำหรับทุก commitments" },
        { type: "expected", description: "สร้าง journal entries สำเร็จสำหรับทุก commitments โดยไม่มี errors" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
  purchaseTest.skip(
    "TC-CN-270005 Generate Journal Entries - System Timeouts",
    {
      annotation: [
        { type: "preconditions", description: "เซิร์ฟเวอร์กำลังมีโหลดสูงหรือ response times ช้า" },
        { type: "steps", description: "1. ไปที่ /journal-entries\n2. กด 'Generate Entries'\n3. รอเป็นระยะเวลานาน\n4. ตรวจสอบว่าระบบจัดการ timeout และไม่สร้าง journal entries ที่ไม่สมบูรณ์" },
        { type: "expected", description: "ระบบจัดการ timeout อย่างมีประสิทธิภาพ อาจแจ้งให้ retry หรือแสดง warning message" },
        { type: "priority", description: "Low" },
        { type: "testType", description: "Edge Case" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
});

purchaseTest.describe("Credit Note — Stock movement (advanced) — Backend only", () => {
  purchaseTest.skip(
    "TC-CN-280001 Generate Stock Movement - Happy Path",
    {
      annotation: [
        { type: "preconditions", description: "ระบบถูก initialize แล้ว และ inventory balance ถูกตั้งเป็นค่าบวก" },
        { type: "steps", description: "1. ไปที่ /stock/movements\n2. กด 'Generate Stock Movement'\n3. เลือก 'Credit Note' เป็นประเภทการเคลื่อนไหว\n4. กรอกจำนวนและ lot number ที่ถูกต้อง\n5. กด 'Submit'" },
        { type: "expected", description: "ระบบสร้าง stock movement เชิงลบ ลด inventory balance ตามจำนวนที่ระบุ" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
  purchaseTest.skip(
    "TC-CN-280002 Generate Stock Movement - Invalid Quantity",
    {
      annotation: [
        { type: "preconditions", description: "ระบบถูก initialize แล้ว และ inventory balance ถูกตั้งเป็นค่าบวก" },
        { type: "steps", description: "1. ไปที่ /stock/movements\n2. กด 'Generate Stock Movement'\n3. เลือก 'Credit Note' เป็นประเภทการเคลื่อนไหว\n4. กรอกจำนวนที่ไม่ถูกต้อง (ติดลบหรือศูนย์)\n5. กด 'Submit'" },
        { type: "expected", description: "ระบบแสดง error message ว่าจำนวนไม่ถูกต้องและไม่สร้าง stock movement" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
  purchaseTest.skip(
    "TC-CN-280003 Generate Stock Movement - Insufficient Inventory",
    {
      annotation: [
        { type: "preconditions", description: "ระบบถูก initialize แล้ว และ inventory balance ถูกตั้งเป็นค่าที่น้อยกว่าจำนวนที่ร้องขอ" },
        { type: "steps", description: "1. ไปที่ /stock/movements\n2. กด 'Generate Stock Movement'\n3. เลือก 'Credit Note' เป็นประเภทการเคลื่อนไหว\n4. กรอกจำนวนที่มากกว่า inventory ปัจจุบัน\n5. กด 'Submit'" },
        { type: "expected", description: "ระบบแสดง error message ว่า inventory ไม่เพียงพอและไม่สร้าง stock movement" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
  purchaseTest.skip(
    "TC-CN-280004 Generate Stock Movement - No Permission",
    {
      annotation: [
        { type: "preconditions", description: "ระบบถูก initialize แล้ว และผู้ใช้ไม่มีสิทธิ์สร้าง stock movements" },
        { type: "steps", description: "1. Login เป็นผู้ใช้ที่ไม่มีสิทธิ์สร้าง stock movements\n2. ไปที่ /stock/movements\n3. กด 'Generate Stock Movement'" },
        { type: "expected", description: "ระบบแสดง error message ว่าไม่มีสิทธิ์เพียงพอและไม่อนุญาตให้สร้าง stock movement" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
  purchaseTest.skip(
    "TC-CN-280005 Generate Stock Movement - Edge Case - Maximum Lot Quantity",
    {
      annotation: [
        { type: "preconditions", description: "ระบบถูก initialize แล้วด้วย lot quantity ที่เป็นจำนวนสูงสุดที่อนุญาต" },
        { type: "steps", description: "1. ไปที่ /stock/movements\n2. กด 'Generate Stock Movement'\n3. เลือก 'Credit Note' เป็นประเภทการเคลื่อนไหว\n4. กรอก lot quantity สูงสุดที่อนุญาต\n5. กด 'Submit'" },
        { type: "expected", description: "ระบบสร้าง stock movement เชิงลบ ลด inventory balance ตาม lot quantity สูงสุดที่อนุญาต" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
});

purchaseTest.describe("Credit Note — Attachments (advanced) — Backend only", () => {
  purchaseTest.skip(
    "TC-CN-290001 Upload valid attachment",
    {
      annotation: [
        { type: "preconditions", description: "credit note มีอยู่แล้วและผู้ใช้มีสิทธิ์ upload" },
        { type: "steps", description: "1. ไปที่หน้า credit note detail\n2. กด 'Add Attachment'\n3. กรอก file input ด้วย file ที่ถูกต้อง\n4. กด 'Upload'" },
        { type: "expected", description: "Attachment ถูก upload และแสดงบนหน้า credit note detail" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
  purchaseTest.skip(
    "TC-CN-290002 Try to upload invalid attachment",
    {
      annotation: [
        { type: "preconditions", description: "credit note มีอยู่แล้วและผู้ใช้มีสิทธิ์ upload" },
        { type: "steps", description: "1. ไปที่หน้า credit note detail\n2. กด 'Add Attachment'\n3. กรอก file input ด้วย file ที่ไม่ถูกต้อง (เช่น image แทน pdf)\n4. กด 'Upload'" },
        { type: "expected", description: "Error message แสดงขึ้นมาและ file ที่ไม่ถูกต้องไม่ถูก upload" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
  purchaseTest.skip(
    "TC-CN-290003 Delete attachment",
    {
      annotation: [
        { type: "preconditions", description: "credit note มีอยู่แล้ว มี attachment และผู้ใช้มีสิทธิ์ delete" },
        { type: "steps", description: "1. ไปที่หน้า credit note detail\n2. ค้นหา attachment ที่ต้องการ delete\n3. กด 'Delete' บน attachment\n4. ยืนยันการ delete" },
        { type: "expected", description: "Attachment ถูกลบออกจากหน้า credit note detail" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
  purchaseTest.skip(
    "TC-CN-290004 Attempt to delete attachment without permission",
    {
      annotation: [
        { type: "preconditions", description: "credit note มีอยู่แล้ว มี attachment และผู้ใช้ไม่มีสิทธิ์ delete" },
        { type: "steps", description: "1. ไปที่หน้า credit note detail\n2. ค้นหา attachment ที่ต้องการ delete\n3. พยายามกด 'Delete' บน attachment" },
        { type: "expected", description: "ผู้ใช้ถูกปฏิเสธสิทธิ์หรือ error message แสดงขึ้นมา" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
  purchaseTest.skip(
    "TC-CN-290005 Upload large file",
    {
      annotation: [
        { type: "preconditions", description: "credit note มีอยู่แล้ว ผู้ใช้มีสิทธิ์ upload และ storage service รองรับ file ขนาดใหญ่" },
        { type: "steps", description: "1. ไปที่หน้า credit note detail\n2. กด 'Add Attachment'\n3. กรอก file input ด้วย file ขนาดใหญ่\n4. กด 'Upload'" },
        { type: "expected", description: "Attachment ถูก upload และจัดเก็บโดยไม่มีปัญหา" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
});

purchaseTest.describe("Credit Note — Audit log — Backend only", () => {
  purchaseTest.skip(
    "TC-CN-500003 Edge Case - Large Volume of Credit Notes",
    {
      annotation: [
        { type: "preconditions", description: "ระบบมี credit notes จำนวนมากที่สร้างขึ้นภายในช่วงเวลาสั้น" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note\n2. รอให้ระบบประมวลผล credit notes ทั้งหมด\n3. ตรวจสอบว่า credit notes ทั้งหมดถูกบันทึกใน audit trail อย่างถูกต้อง" },
        { type: "expected", description: "credit notes ทั้งหมดได้รับการประมวลผลและบันทึกใน audit trail โดยไม่มี error" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Edge Case" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
});

purchaseTest.describe("Credit Note — CN number generation — Backend only", () => {
  purchaseTest.skip(
    "TC-CN-510001 Happy Path - Generate Valid CN Number",
    {
      annotation: [
        { type: "preconditions", description: "Database sequence table มีอยู่ และ transaction context active" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note/new\n2. กด 'Generate CN Number'" },
        { type: "expected", description: "CN number ที่ unique ในรูปแบบ CN-YYMM-NNNN ถูกสร้างและแสดงผล" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
  purchaseTest.skip(
    "TC-CN-510002 Negative Path - Generate CN Number When Sequence Table Does Not Exist",
    {
      annotation: [
        { type: "preconditions", description: "Database sequence table ไม่มีอยู่ และ transaction context active" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note/new\n2. กด 'Generate CN Number'" },
        { type: "expected", description: "Error แสดงว่า database sequence table ไม่มีอยู่" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
  purchaseTest.skip(
    "TC-CN-510003 Negative Path - Generate CN Number Without Transaction Context",
    {
      annotation: [
        { type: "preconditions", description: "Database sequence table มีอยู่ และไม่มี transaction context active" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note/new\n2. กด 'Generate CN Number'" },
        { type: "expected", description: "Error แสดงว่าต้องมี transaction context" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
  purchaseTest.skip(
    "TC-CN-510004 Edge Case - Generate CN Number at Month End",
    {
      annotation: [
        { type: "preconditions", description: "Database sequence table มีอยู่ transaction context active และ sequence ของเดือนปัจจุบันถึงขีดจำกัดแล้ว" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note/new\n2. กด 'Generate CN Number'" },
        { type: "expected", description: "Sequence ของเดือนใหม่เริ่มต้นที่ 0001 และต่อจากเดือนที่แล้ว" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Edge Case" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
  purchaseTest.skip(
    "TC-CN-510005 Negative Path - Generate CN Number During System Maintenance",
    {
      annotation: [
        { type: "preconditions", description: "Database sequence table มีอยู่ transaction context active และระบบอยู่ในช่วง maintenance" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note/new\n2. กด 'Generate CN Number'" },
        { type: "expected", description: "Error แสดงว่าระบบอยู่ในช่วง maintenance และไม่สามารถดำเนินการได้" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
});

purchaseTest.describe("Credit Note — Vendor balance commitment — Backend only", () => {
  purchaseTest.skip(
    "TC-CN-520001 Happy Path - Credit Note Commitment",
    {
      annotation: [
        { type: "preconditions", description: "Vendor account มีอยู่และ active คำนวณจำนวน credit note แล้ว และ transaction context active" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note\n2. เลือก credit note\n3. กด 'Commit Credit Note'" },
        { type: "expected", description: "Vendor balance ถูกอัปเดตตามที่กำหนด" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
  purchaseTest.skip(
    "TC-CN-520002 Negative Case - Vendor Account Inactive",
    {
      annotation: [
        { type: "preconditions", description: "Vendor account ไม่ active คำนวณจำนวน credit note แล้ว และ transaction context active" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note\n2. เลือก credit note\n3. กด 'Commit Credit Note'" },
        { type: "expected", description: "ระบบปฏิเสธการดำเนินการและแสดง error message" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
  purchaseTest.skip(
    "TC-CN-520003 Negative Case - Invalid Credit Note Amount",
    {
      annotation: [
        { type: "preconditions", description: "Vendor account มีอยู่และ active จำนวน credit note ไม่ถูกต้อง และ transaction context active" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note\n2. สร้าง credit note ใหม่ด้วยจำนวนที่ไม่ถูกต้อง\n3. กด 'Commit Credit Note'" },
        { type: "expected", description: "ระบบปฏิเสธการดำเนินการและแสดง error message" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
  purchaseTest.skip(
    "TC-CN-520004 Edge Case - Void Credit Note",
    {
      annotation: [
        { type: "preconditions", description: "Vendor account มีอยู่และ active คำนวณจำนวน credit note แล้ว transaction context active และ credit note ที่ committed แล้ว" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note\n2. เลือก credit note ที่ committed แล้ว\n3. กด 'Void Credit Note'" },
        { type: "expected", description: "Vendor balance ถูกอัปเดตและสถานะ credit note เปลี่ยนเป็น voided" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Edge Case" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
});

purchaseTest.describe("Credit Note — Validation — Backend only", () => {
  purchaseTest.skip(
    "TC-CN-530001 Valid Credit Note Data",
    {
      annotation: [
        { type: "preconditions", description: "credit note ที่ถูกต้องถูก submit พร้อม field ที่จำเป็นทั้งหมด" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note\n2. กด 'New Credit Note'\n3. กรอก 'Invoice Number'\n4. กรอก 'Credit Amount'\n5. เลือก 'Supplier'\n6. กด 'Save'" },
        { type: "expected", description: "ข้อมูล credit note ผ่านการตรวจสอบและบันทึกสำเร็จโดยไม่มี error" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
  purchaseTest.skip(
    "TC-CN-530002 Missing Required Fields",
    {
      annotation: [
        { type: "preconditions", description: "credit note ถูก submit โดยขาด required fields" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note\n2. กด 'New Credit Note'\n3. กด 'Save'" },
        { type: "expected", description: "ระบบแสดง error messages สำหรับ required fields ที่ขาดหายไป" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
  purchaseTest.skip(
    "TC-CN-530003 Invalid Credit Amount",
    {
      annotation: [
        { type: "preconditions", description: "credit note ถูก submit ด้วยจำนวน credit ที่ไม่ถูกต้อง (ติดลบหรือเป็นศูนย์)" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note\n2. กด 'New Credit Note'\n3. กรอก 'Invoice Number'\n4. กรอก 'Credit Amount' ด้วยค่าติดลบหรือศูนย์\n5. กด 'Save'" },
        { type: "expected", description: "ระบบแสดง error message สำหรับจำนวน credit ที่ไม่ถูกต้อง" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
  purchaseTest.skip(
    "TC-CN-530004 Expired Supplier",
    {
      annotation: [
        { type: "preconditions", description: "credit note ถูก submit ด้วย supplier ที่หมดอายุแล้ว" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note\n2. กด 'New Credit Note'\n3. เลือก supplier ที่หมดอายุ\n4. กด 'Save'" },
        { type: "expected", description: "ระบบแสดง error message สำหรับ supplier ที่หมดอายุ" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
});

purchaseTest.describe("Credit Note — Real-time sync — Backend only", () => {
  purchaseTest.skip(
    "TC-CN-540001 Happy Path - Real-time Credit Note Sync",
    {
      annotation: [
        { type: "preconditions", description: "WebSocket หรือ SSE connection พร้อมใช้งาน Cache layer ถูก configure แล้ว และ User session active" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note\n2. กด 'Refresh' button\n3. รอ 5 วินาที" },
        { type: "expected", description: "รายการและรายละเอียด credit note ถูกอัปเดต real-time" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
  purchaseTest.skip(
    "TC-CN-540002 Negative Case - No WebSocket Connection",
    {
      annotation: [
        { type: "preconditions", description: "Cache layer ถูก configure แล้ว และ User session active" },
        { type: "steps", description: "1. ปิดการใช้งาน WebSocket หรือ SSE connection ใน network settings\n2. ไปที่ /procurement/credit-note\n3. กด 'Refresh' button" },
        { type: "expected", description: "Real-time updates ไม่เกิดขึ้น และ cache ยังคงไม่เปลี่ยนแปลง" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
  purchaseTest.skip(
    "TC-CN-540003 Edge Case - User Session Expired",
    {
      annotation: [
        { type: "preconditions", description: "WebSocket หรือ SSE connection พร้อมใช้งาน และ Cache layer ถูก configure แล้ว" },
        { type: "steps", description: "1. ไปที่ /procurement/credit-note\n2. รอให้ user session หมดอายุ\n3. กด 'Refresh' button" },
        { type: "expected", description: "ระบบแจ้งให้ยืนยันตัวตนใหม่ และ real-time updates ล้มเหลว" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
        { type: "note", description: SKIP_NOTE_BACKEND },
      ],
    },
    async () => {},
  );
});

