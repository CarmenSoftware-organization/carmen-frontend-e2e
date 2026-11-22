import { expect, type Page } from "@playwright/test";
import { writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createAuthTest } from "./fixtures/auth.fixture";
import { GRNPage } from "./pages/grn.page";
import { createDraftGrn, createExtraCostType, deleteExtraCostType, deleteGrnsByPrefix, getGrn, listGrns, seededGrn } from "./helpers/grn-api";
import { buGet } from "./helpers/bu-api";
import { addRow, button, confirmDialog, field, lastToast, pickDate, pickLookup, typeInto } from "./helpers/movement/ui";
import { uid } from "./helpers/test-data";
import { expectBlocked, expectRefused } from "./helpers/settle";

// ─────────────────────────────────────────────────────────────────────────
// Roles (permissions read from /api/user/profile of the TEST BU):
//  - Purchase  : goods_received_note create/update/delete/commit/view
//  - FC        : goods_received_note.view ONLY -> the "no permission" role
//  - Requestor : no GRN permission at all (list shows "Permission Denied")
// Mutating cases work on their own draft GRN seeded through the API (invoice no. "E2E-GRN ...",
// tests/helpers/grn-api.ts) and clean it up; the four seeded "STD-grn.*" documents
// (draft / saved / committed x2) are read-only fixtures.
//
// Deleted cases (feature absent in ../carmen-frontend/routes/procurement/goods-receive-note/*):
//   bulk approval 180001-4 (GRN has Commit/Void only, no line approval), multi-select line delete 090005,
//   "no vendor / invalid PO / PO without catalog product" 030003-5 and mixed vendor/currency PO selection 040002
//   (from-po lists only vendors with open POs and scopes step 2 to the chosen vendor), partially received
//   commit 110004, void PO-status revert 120004 (void/commit are not PO-aware in the footer), invalid currency 060002
//   (currency is a lookup of valid values), future date 060005 and max quantity 070004 (no such rule in
//   grn-form-schema.ts), extra "no permission" views 130002 / 140002 / 170002 (no per-tab permission; the
//   page itself is covered by 010003), outdated financial summary 130004, no-activity log 170004
//   (a document always has a Created entry), comment / attachment "without permission" 150002 / 160002 (the comment dialog
//   components/ui/comment-sheet.tsx has no permission gate, so there is no denied state to test), maximum attachment count 160004 (the dialog limits type and size by BU policy, not count).
// ─────────────────────────────────────────────────────────────────────────
const fcTest = createAuthTest("carmensoftware.dev+fc@gmail.com");
const requestorTest = createAuthTest("carmensoftware.dev+requestor@gmail.com");
const purchaseTest = createAuthTest("carmensoftware.dev+purchase@gmail.com");

purchaseTest.describe.configure({ timeout: 90_000 });
fcTest.describe.configure({ timeout: 60_000 });

const PFX = "E2E-GRN";
const inv = (tag: string) => `${PFX}-${tag}-${uid}`;
const sweep = () => deleteGrnsByPrefix(PFX);
const today = () => new Date().toLocaleDateString("sv");
const LIST = "/procurement/goods-receive-note";
const goto = async (page: Page, id: string) => {
  await page.goto(`${LIST}/${id}`);
  await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeVisible({ timeout: 20_000 });
};
const rowsOf = (page: Page) => page.locator("table tbody tr");

/** The toast the form raises when it refuses to submit (missing field / incomplete line / bad value). */
const blockedToast = (page: Page) =>
  page.locator("[data-sonner-toast]").filter({ hasText: /details are missing|still incomplete|aren't filled in/i });

/** Remove the first line; the app either asks to confirm or removes it at once. Waits for the row to be gone. */
async function removeFirstLine(page: Page) {
  const removers = page.getByRole("button", { name: "Remove this line" });
  const before = await removers.count();
  await rowsOf(page).first().getByRole("button", { name: "Remove this line" }).click();
  const dlg = page.locator("[role=alertdialog]:visible");
  await expect
    .poll(async () => (await dlg.count()) > 0 || (await removers.count()) < before, { message: "line neither removed nor confirm dialog shown" })
    .toBe(true);
  if (await dlg.count()) await confirmDialog(page, /remove|delete|confirm|yes/i);
  await expect(removers).toHaveCount(before - 1);
}
const NO_GATE =
  "suspected bug: view-only FC gets an enabled GRN action - the FE does not gate it (list 'New Goods Receive Note' passes no addDisabled, grn-footer-action.tsx Commit/Void carry no permission check) and the gateway good-received-notes controller has no permission decorator";

/** From the list: Search box + Enter (the box only searches on Enter / the magnifier). */
async function search(page: Page, text: string) {
  const box = page.getByPlaceholder("Search...");
  await box.fill(text);
  await box.press("Enter");
}

/** Step 2 of from-po: tick the PO (its own header checkbox is the nearest one before its number). */
async function tickPo(page: Page, poNo: string) {
  const po = page.getByText(poNo, { exact: true });
  await expect(po).toBeVisible({ timeout: 15_000 });
  await po.locator("xpath=preceding::*[@role='checkbox' or @type='checkbox'][1]").click();
}

/** Edit -> Save Draft, wait for the success toast. */
async function saveDraft(page: Page) {
  await button(page, "Save Draft").click();
  expect(await lastToast(page)).toMatch(/updated|saved|success/i);
}

/** New manual GRN form: vendor, invoice no/date, and one row per product (qty, price). */
async function fillManualGrn(page: Page, invoiceNo: string, products: string[]) {
  await page.goto(`${LIST}/new?doc_type=manual`);
  await pickLookup(page, field(page, "Vendor").locator("button").first());
  await page.locator("#grn-invoice-no").fill(invoiceNo);
  expect(await pickDate(page, field(page, "Invoice Date").locator("button").first(), today()), "Invoice Date today").toBe(true);
  for (const code of products) {
    const row = await addRow(page);
    // the location button is blank for a moment while the user's locations load
    await expect(row.locator("button").first()).not.toHaveText(/^\s*$/);
    if (await row.getByRole("button", { name: "Select Location" }).isVisible().catch(() => false)) {
      await pickLookup(page, row.getByRole("button", { name: "Select Location" }));
    }
    await pickLookup(page, row.getByRole("button", { name: "Select Product" }), code);
    // the product's units load after the pick (the seeded products are all sold in KG); saving before that sends an empty unit
    await expect(row).toContainText("KG", { timeout: 15_000 });
    // every unit selector still on "Select Unit" (received / FOC) needs a pick; they can render as buttons or comboboxes
    for (let i = 0; i < 4; i++) {
      const unit = row.getByRole("combobox", { name: "Select Unit" }).or(row.getByRole("button", { name: "Select Unit" })).first();
      if (!(await unit.isVisible().catch(() => false))) break;
      await unit.click();
      await page.locator("[data-slot=popover-content]:visible button[data-value], [data-slot=select-item], [role=option]").first().click();
    }
    await typeInto(row.locator('input[name$=".received_qty"]'), 2);
    await typeInto(row.locator('input[placeholder="0.00"]').first(), 50);
  }
  await expect(page.locator("table tbody").getByText("Select Unit")).toHaveCount(0, { timeout: 15_000 });
}

purchaseTest.describe("GRN — List", () => {
  purchaseTest(
    "TC-GRN-010001 View GRN List as Authenticated User",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Purchase; data:reset seed GRN 4 ใบ (draft / saved / committed x2)" },
        { type: "steps", description: "1. ไปที่ /procurement/goods-receive-note\n2. ดูตาราง\n3. คลิกแถว GRN261100001" },
        { type: "expected", description: "ตารางแสดง 4 แถวพร้อมสถานะ Committed/Saved/Draft และยอดรวม; คลิกแถวเปิด /procurement/goods-receive-note/<id> ของใบนั้น" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const grn = new GRNPage(page);
      await grn.gotoList();
      for (const no of ["GRN261100001", "GRN261100002", "GRN261100003", "draft-4"]) await expect(page.getByRole("row").filter({ hasText: no })).toHaveCount(1);
      await expect(page.getByRole("row").filter({ hasText: "GRN261100001" })).toContainText(/committed/i);
      await expect(page.getByRole("row").filter({ hasText: "GRN261100003" })).toContainText(/saved/i);
      await expect(page.getByRole("row").filter({ hasText: "draft-4" })).toContainText(/draft/i);
      const committed = await seededGrn("committed");
      await page.getByRole("row").filter({ hasText: "GRN261100001" }).getByText("GRN261100001").click();
      await expect(page).toHaveURL(new RegExp(`goods-receive-note/${committed.id}$`));
    },
  );

  purchaseTest(
    "TC-GRN-010002 View GRN List with No GRNs",
    {
      annotation: [
        { type: "preconditions", description: "มี GRN ใน TEST BU (ใช้การค้นหาที่ไม่มีผลลัพธ์แทนข้อมูลว่าง)" },
        { type: "steps", description: "1. ไปที่ list\n2. ค้นหาข้อความที่ไม่ตรงกับ GRN ใด แล้วกด Enter" },
        { type: "expected", description: "ตารางแสดง empty state 'No data found' และไม่มีแถว GRN" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const grn = new GRNPage(page);
      await grn.gotoList();
      await search(page, `zz-none-${uid}`);
      await expect(page.getByText("No data found")).toBeVisible({ timeout: 10_000 });
      await expect(page.getByRole("row").filter({ hasText: /GRN26/ })).toHaveCount(0);
    },
  );

  purchaseTest(
    "TC-GRN-010004 View GRN List with Large Number of GRNs",
    {
      annotation: [
        { type: "preconditions", description: "มี GRN 4 ใบ; แบ่งหน้าละ 2 แถว (?perpage=2)" },
        { type: "steps", description: "1. เปิด list ด้วย ?perpage=2\n2. ดูตัวนับหน้า\n3. คลิก Go to next page" },
        { type: "expected", description: "หน้าแรกแสดง 2 แถว 'Showing 1–2 of 4' และ 'Page 1 of 2'; หน้า 2 แสดงอีก 2 แถวที่ไม่ซ้ำหน้าแรก" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      await page.goto(`${LIST}?perpage=2`);
      await expect(page.getByText(/Showing 1–2 of 4/)).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(/Page 1 of 2/)).toBeVisible();
      const first = await page.getByRole("row").filter({ hasText: /GRN26|draft-/ }).allInnerTexts();
      expect(first).toHaveLength(2);
      await page.getByRole("button", { name: "Go to next page" }).click();
      await expect(page.getByText(/Showing 3–4 of 4/)).toBeVisible({ timeout: 10_000 });
      const second = await page.getByRole("row").filter({ hasText: /GRN26|draft-/ }).allInnerTexts();
      expect(second).toHaveLength(2);
      for (const r of second) expect(first).not.toContain(r);
    },
  );

});

requestorTest.describe("GRN — List — Permission denial", () => {
  requestorTest(
    "TC-GRN-010003 View GRN List with Insufficient Permissions",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Requestor — ไม่มี permission ของ GRN เลย" },
        { type: "steps", description: "1. ไปที่ /procurement/goods-receive-note" },
        { type: "expected", description: "แสดงหน้า 'Permission Denied' แทน list; ไม่มีช่อง Search และไม่มีปุ่ม New Goods Receive Note" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Authorization" },
      ],
    },
    async ({ page }) => {
      await page.goto(LIST);
      await expect(page.getByRole("heading", { name: "Permission Denied" })).toBeVisible({ timeout: 15_000 });
      await expect(page.getByPlaceholder("Search...")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "New Goods Receive Note" })).toHaveCount(0);
    },
  );

});

purchaseTest.describe("GRN — Filter / Search", () => {
  purchaseTest(
    "TC-GRN-020001 Filter by GRN Number",
    {
      annotation: [
        { type: "preconditions", description: "มี GRN261100001 ใน TEST BU" },
        { type: "steps", description: "1. ไปที่ list\n2. พิมพ์ 'GRN261100001' ใน Search แล้วกด Enter" },
        { type: "expected", description: "เหลือเฉพาะแถว GRN261100001 (1 แถว) ไม่มี GRN อื่น" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      await page.goto(LIST);
      await search(page, "GRN261100001");
      await expect(page.getByRole("row").filter({ hasText: "GRN261100001" })).toHaveCount(1);
      await expect(page.getByRole("row").filter({ hasText: /GRN261100002|GRN261100003|draft-4/ })).toHaveCount(0);
    },
  );

  purchaseTest(
    "TC-GRN-020002 Clear Filters",
    {
      annotation: [
        { type: "preconditions", description: "มี GRN 4 ใบ" },
        { type: "steps", description: "1. ค้นหาจนเหลือ 1 แถว\n2. คลิกปุ่ม Clear search (x) ในช่อง Search" },
        { type: "expected", description: "list กลับมาแสดงทั้ง 4 แถวและช่อง Search ว่าง" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      await page.goto(LIST);
      await search(page, "GRN261100001");
      await expect(page.getByRole("row").filter({ hasText: /GRN26|draft-/ })).toHaveCount(1);
      await page.getByRole("button", { name: /clear search/i }).click();
      await expect(page.getByRole("row").filter({ hasText: /GRN26|draft-/ })).toHaveCount(4, { timeout: 10_000 });
      await expect(page.getByPlaceholder("Search...")).toHaveValue("");
    },
  );

  purchaseTest(
    "TC-GRN-020003 Invalid Search Term",
    {
      annotation: [
        { type: "preconditions", description: "มี GRN ใน TEST BU" },
        { type: "steps", description: "1. ค้นหาข้อความที่ไม่มีใน GRN ใด" },
        { type: "expected", description: "แสดง 'No data found' และไม่มีแถว GRN" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      await page.goto(LIST);
      await search(page, `zz-invalid-${uid}`);
      await expect(page.getByText("No data found")).toBeVisible({ timeout: 10_000 });
      await expect(page.getByRole("row").filter({ hasText: /GRN26|draft-/ })).toHaveCount(0);
    },
  );

  purchaseTest(
    "TC-GRN-020004 Search with Empty Term",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้เพิ่งค้นหาจน list ว่าง" },
        { type: "steps", description: "1. ค้นหาข้อความที่ไม่มีผล\n2. ล้างช่อง Search แล้วกด Enter" },
        { type: "expected", description: "list แสดงทั้ง 4 แถว ไม่มี empty state" },
        { type: "priority", description: "Low" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      await page.goto(LIST);
      await search(page, `zz-none-${uid}`);
      await expect(page.getByText("No data found")).toBeVisible({ timeout: 10_000 });
      await search(page, "");
      await expect(page.getByRole("row").filter({ hasText: /GRN26|draft-/ })).toHaveCount(4, { timeout: 10_000 });
      await expect(page.getByText("No data found")).toHaveCount(0);
    },
  );

  purchaseTest(
    "TC-GRN-020005 Filter by Vendor Name and Invoice Number",
    {
      annotation: [
        { type: "preconditions", description: "GRN draft-4 มี invoice 'STD-grn.draft'" },
        { type: "steps", description: "1. ค้นหา 'STD-grn.draft' (invoice no.)\n2. ค้นหาชื่อ vendor 'เอบีโอ'" },
        { type: "expected", description: "ค้นหา invoice no. เหลือเฉพาะ draft-4; ค้นหาชื่อ vendor แสดงทั้ง 4 ใบ (ทุกใบเป็นของ vendor นี้)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      await page.goto(LIST);
      await search(page, "STD-grn.draft");
      await expect(page.getByRole("row").filter({ hasText: /GRN26|draft-/ })).toHaveCount(1);
      await expect(page.getByRole("row").filter({ hasText: "draft-4" })).toHaveCount(1);
      await search(page, "เอบีโอ");
      await expect(page.getByRole("row").filter({ hasText: /GRN26|draft-/ })).toHaveCount(4, { timeout: 10_000 });
    },
  );

});

purchaseTest.describe("GRN — Create from Single PO", () => {
  purchaseTest(
    "TC-GRN-030001 Create GRN from Single PO - Happy Path",
    {
      annotation: [
        { type: "preconditions", description: "มี PO ที่ยังเปิดอยู่ของ vendor A023 (PO261100003, 2 บรรทัด x 10 KG)" },
        { type: "steps", description: "1. New Goods Receive Note → Purchase Order\n2. เลือก vendor เอบีโอ → Next\n3. ติ๊ก PO261100003 → Confirm\n4. กรอก Invoice No./Invoice Date แล้ว Create" },
        { type: "expected", description: "ฟอร์ม /new?doc_type=purchase_order มี 2 บรรทัดจาก PO (Ground Beef, Chilled Angus) ยอด 2,000.00; หลัง Create backend มี GRN doc_type purchase_order 2 บรรทัด และ toast สำเร็จ" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const invoice = inv("frompo");
      const before = new Set((await listGrns()).map((g) => g.id));
      await page.goto(LIST);
      await page.getByRole("button", { name: "New Goods Receive Note" }).click();
      await page.getByRole("button", { name: /^Purchase Order/ }).click();
      await expect(page).toHaveURL(/from-po$/);
      await page.getByRole("radio").first().click();
      await button(page, "Next").click();
      await tickPo(page, "PO261100003");
      await button(page, "Confirm").click();
      await expect(page).toHaveURL(/new\?doc_type=purchase_order/);
      await expect(rowsOf(page).filter({ hasText: "Ground Beef" })).toHaveCount(1);
      await expect(rowsOf(page).filter({ hasText: "Chilled Angus" })).toHaveCount(1);
      await expect(page.getByText("2,000.00").first()).toBeVisible();
      await page.locator("#grn-invoice-no").fill(invoice);
      expect(await pickDate(page, field(page, "Invoice Date").locator("button").first(), today())).toBe(true);
      await button(page, "Create").click();
      expect(await lastToast(page)).toMatch(/created|success/i);
      const created = (await listGrns(invoice)).find((g) => g.invoice_no === invoice);
      expect(created, "GRN exists in backend").toBeTruthy();
      const rec = (await getGrn(created!.id)).data!;
      expect(rec.doc_type).toBe("purchase_order");
      expect(rec.good_received_note_detail).toHaveLength(2);
      expect(before.has(created!.id)).toBe(false);
    },
  );

});

fcTest.describe("GRN — Create — Permission denial", () => {
  fcTest(
    "TC-GRN-030002 Create GRN without Create GRN Permission",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น FC (view อย่างเดียว)" },
        { type: "steps", description: "1. ไปที่ list\n2. ดูปุ่ม 'New Goods Receive Note'" },
        { type: "expected", description: "ปุ่ม New Goods Receive Note ถูกปิดใช้งาน (aria-disabled) — ผู้ใช้ไม่มีสิทธิ์สร้าง" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Authorization" },
      ],
    },
    async ({ page }) => {
      await page.goto(LIST);
      const add = page.getByRole("button", { name: "New Goods Receive Note" });
      await expect(add).toBeVisible({ timeout: 15_000 });
      fcTest.fail(true, NO_GATE);
      await expect(add).toHaveAttribute("aria-disabled", "true");
    },
  );

});

purchaseTest.describe("GRN — Create from Multiple POs", () => {
  purchaseTest(
    "TC-GRN-040004 Create GRN from Multiple POs - Edge Case - Partial POs",
    {
      annotation: [
        { type: "preconditions", description: "มี PO ที่ยังเปิด 2 ใบ รวม PO261100006 ที่รับแล้วบางส่วน (PARTIAL)" },
        { type: "steps", description: "1. New GRN → Purchase Order → เลือก vendor → Next\n2. ติ๊ก PO261100006 (PARTIAL) และ PO261100007 → Confirm" },
        { type: "expected", description: "ฟอร์มรวมบรรทัดของทั้งสอง PO (Ground Beef/Chilled Angus จาก 06 และ PORK CHOP จาก 07) และมีปุ่ม 'Add more PO'" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      await page.goto(`${LIST}/from-po`);
      await page.getByRole("radio").first().click();
      await button(page, "Next").click();
      for (const no of ["PO261100006", "PO261100007"]) await tickPo(page, no);
      await button(page, "Confirm").click();
      await expect(page).toHaveURL(/new\?doc_type=purchase_order/);
      await expect(rowsOf(page).filter({ hasText: "PORK CHOP" })).toHaveCount(1);
      await expect(rowsOf(page).filter({ hasText: "Ground Beef" })).toHaveCount(1);
      await expect(rowsOf(page).filter({ hasText: "Chilled Angus" })).toHaveCount(1);
      await expect(page.getByRole("button", { name: "Add more PO" })).toBeVisible();
    },
  );

});

fcTest.describe("GRN — Create from Multiple POs — Permission denial", () => {
  fcTest(
    "TC-GRN-040003 Create GRN from Multiple POs - No Permission",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น FC (view อย่างเดียว)" },
        { type: "steps", description: "1. ไปที่ list\n2. ดูปุ่ม New Goods Receive Note (ทางเข้า from-po)" },
        { type: "expected", description: "ปุ่ม New Goods Receive Note ถูกปิดใช้งาน — เข้า flow สร้างจากหลาย PO ไม่ได้" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Authorization" },
      ],
    },
    async ({ page }) => {
      await page.goto(LIST);
      const add = page.getByRole("button", { name: "New Goods Receive Note" });
      await expect(add).toBeVisible({ timeout: 15_000 });
      fcTest.fail(true, NO_GATE);
      await expect(add).toHaveAttribute("aria-disabled", "true");
    },
  );

});

purchaseTest.describe("GRN — Manual creation", () => {
  purchaseTest.afterAll(sweep);

  purchaseTest(
    "TC-GRN-050001 Create Manual GRN with Valid Data",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้มีสิทธิ์สร้าง; มี vendor/สินค้า/คลังใน TEST BU" },
        { type: "steps", description: "1. New GRN → Manual\n2. เลือก Vendor, กรอก Invoice No./Date\n3. Add Item เลือก Product กรอก Qty 2 ราคา 50\n4. Create" },
        { type: "expected", description: "toast สำเร็จ; backend มี GRN manual เลข invoice นั้น 1 บรรทัด qty 2 ราคา 50 ยอด 100 และ list แสดงใบใหม่" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const invoice = inv("manual");
      await fillManualGrn(page, invoice, ["1111000"]);
      await button(page, "Create").click();
      expect(await lastToast(page)).toMatch(/created|success/i);
      const created = (await listGrns(invoice)).find((g) => g.invoice_no === invoice);
      expect(created, "GRN exists in backend").toBeTruthy();
      const rec = (await getGrn(created!.id)).data!;
      expect(rec.doc_type).toBe("manual");
      expect(rec.good_received_note_detail).toHaveLength(1);
      expect(Number(rec.good_received_note_detail[0].items[0].received_qty)).toBe(2);
      expect(Number(rec.good_received_note_detail[0].items[0].received_price)).toBe(50);
      expect(Number(rec.total_amount)).toBe(100);
    },
  );

  purchaseTest(
    "TC-GRN-050003 Create Manual GRN with Missing Vendor",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้มีสิทธิ์สร้าง" },
        { type: "steps", description: "1. เปิดฟอร์ม Manual\n2. กรอก Invoice No. แต่ไม่เลือก Vendor\n3. Create" },
        { type: "expected", description: "ไม่บันทึก: ยังอยู่ที่ /new, ไม่มี toast สำเร็จ, ไม่มี GRN เลข invoice นั้นใน backend" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const invoice = inv("novendor");
      await page.goto(`${LIST}/new?doc_type=manual`);
      await page.locator("#grn-invoice-no").fill(invoice);
      await expectBlocked(page, /good-received-note/, () => button(page, "Create").click(), blockedToast(page));
      await expect(page).toHaveURL(/goods-receive-note\/new/);
      await expect(page.locator("[data-sonner-toast]").filter({ hasText: /created|success/i })).toHaveCount(0);
      expect((await listGrns(invoice)).filter((g) => g.invoice_no === invoice)).toHaveLength(0);
    },
  );

  purchaseTest(
    "TC-GRN-050004 Create Manual GRN with Empty Product Details",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้มีสิทธิ์สร้าง" },
        { type: "steps", description: "1. เปิดฟอร์ม Manual\n2. เลือก Vendor และ Invoice แต่ไม่เพิ่มรายการ\n3. Create" },
        { type: "expected", description: "ไม่บันทึก: ยังอยู่ที่ /new ไม่มี toast สำเร็จ ไม่มี GRN เลข invoice นั้นใน backend" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const invoice = inv("noitems");
      await page.goto(`${LIST}/new?doc_type=manual`);
      await pickLookup(page, field(page, "Vendor").locator("button").first());
      await page.locator("#grn-invoice-no").fill(invoice);
      expect(await pickDate(page, field(page, "Invoice Date").locator("button").first(), today())).toBe(true);
      await expectBlocked(page, /good-received-note/, () => button(page, "Create").click(), blockedToast(page));
      await expect(page).toHaveURL(/goods-receive-note\/new/);
      await expect(page.locator("[data-sonner-toast]").filter({ hasText: /created|success/i })).toHaveCount(0);
      expect((await listGrns(invoice)).filter((g) => g.invoice_no === invoice)).toHaveLength(0);
    },
  );

  purchaseTest(
    "TC-GRN-050005 Create Manual GRN with Large Number of Products",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้มีสิทธิ์สร้าง" },
        { type: "steps", description: "1. เปิดฟอร์ม Manual เลือก Vendor/Invoice\n2. Add Item 3 รายการ (สินค้าต่างกัน) qty 2 ราคา 50\n3. Create" },
        { type: "expected", description: "backend มี GRN manual 3 บรรทัด ยอดรวม 300 และ toast สำเร็จ" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      const invoice = inv("many");
      await fillManualGrn(page, invoice, ["11110001", "11110002", "11110003"]);
      await button(page, "Create").click();
      expect(await lastToast(page)).toMatch(/created|success/i);
      const created = (await listGrns(invoice)).find((g) => g.invoice_no === invoice);
      expect(created, "GRN exists in backend").toBeTruthy();
      const rec = (await getGrn(created!.id)).data!;
      expect(rec.good_received_note_detail).toHaveLength(3);
      expect(Number(rec.total_amount)).toBe(300);
    },
  );

});

fcTest.describe("GRN — Manual creation — Permission denial", () => {
  fcTest(
    "TC-GRN-050002 Create Manual GRN without Permission",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น FC (view อย่างเดียว)" },
        { type: "steps", description: "1. เปิด /procurement/goods-receive-note\n2. ดูปุ่ม New Goods Receive Note" },
        { type: "expected", description: "ปุ่ม New Goods Receive Note ถูกปิดใช้งาน — ผู้ใช้ไม่มีสิทธิ์สร้างไม่ควรเปิดฟอร์ม Manual ได้" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Authorization" },
      ],
    },
    async ({ page }) => {
      await page.goto(LIST);
      const add = page.getByRole("button", { name: "New Goods Receive Note" });
      await expect(add).toBeVisible({ timeout: 15_000 });
      fcTest.fail(true, NO_GATE);
      await expect(add).toHaveAttribute("aria-disabled", "true");
    },
  );

});

purchaseTest.describe("GRN — Edit Header", () => {
  purchaseTest.afterAll(sweep);

  purchaseTest(
    "TC-GRN-060001 Edit GRN Header - Happy Path",
    {
      annotation: [
        { type: "preconditions", description: "มี GRN draft ของ test (2 บรรทัด)" },
        { type: "steps", description: "1. เปิด GRN → Edit\n2. แก้ Description\n3. Save Draft" },
        { type: "expected", description: "toast สำเร็จ; กลับสู่โหมดดูและแสดง Description ใหม่; backend เก็บ description ใหม่ และสถานะยังเป็น draft" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const g = await createDraftGrn(inv("hdr"));
      await goto(page, g.id);
      await button(page, "Edit").click();
      const text = `edited ${uid}`;
      await page.locator("#grn-description").fill(text);
      await saveDraft(page);
      await expect(page.locator("main")).toContainText(text);
      const rec = (await getGrn(g.id)).data!;
      expect(rec.description).toBe(text);
      expect(rec.doc_status).toBe("draft");
    },
  );

  purchaseTest(
    "TC-GRN-060004 Edit GRN Header - Empty Fields",
    {
      annotation: [
        { type: "preconditions", description: "มี GRN draft ของ test" },
        { type: "steps", description: "1. เปิด GRN → Edit\n2. ล้างช่อง Invoice No.\n3. คลิก Save (ไม่ใช่ Save Draft — draft ยอมให้ข้อมูลไม่ครบ)" },
        { type: "expected", description: "ไม่บันทึก: ช่อง Invoice No. ถูกมาร์ก invalid, ไม่มี toast สำเร็จ, backend ยังเก็บ invoice no. เดิม" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const g = await createDraftGrn(inv("empty"));
      await goto(page, g.id);
      await button(page, "Edit").click();
      await page.locator("#grn-invoice-no").fill("");
      // "Save Draft" lets an incomplete draft through by design; the full Save enforces the required fields
      await expectBlocked(page, /good-received-note/, () => button(page, "Save").click(), blockedToast(page));
      await expect(page.locator("#grn-invoice-no")).toHaveAttribute("aria-invalid", "true");
      await expect(page.locator("[data-sonner-toast]").filter({ hasText: /updated|saved|success/i })).toHaveCount(0);
      expect((await getGrn(g.id)).data!.invoice_no).toBe(g.invoice_no);
    },
  );

});

fcTest.describe("GRN — Edit Header — Permission denial", () => {
  fcTest(
    "TC-GRN-060003 Edit GRN Header - No Permission",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น FC (view อย่างเดียว); มี GRN draft-4" },
        { type: "steps", description: "1. เปิดหน้า detail ของ draft-4\n2. ดูปุ่ม Edit" },
        { type: "expected", description: "ปุ่ม Edit ถูกปิดใช้งาน (aria-disabled) กดแล้วไม่เข้าโหมดแก้ไข (ไม่มีช่อง Invoice No.)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Authorization" },
      ],
    },
    async ({ page }) => {
      const d = await seededGrn("draft");
      await page.goto(`${LIST}/${d.id}`);
      const edit = page.getByRole("button", { name: "Edit", exact: true });
      await expect(edit).toBeVisible({ timeout: 20_000 });
      await expect(edit).toHaveAttribute("aria-disabled", "true");
      await edit.click({ force: true });
      await expect(page.locator("#grn-invoice-no")).toHaveCount(0);
    },
  );

});

purchaseTest.describe("GRN — Add Line Item", () => {
  purchaseTest.afterAll(sweep);

  purchaseTest(
    "TC-GRN-070001 Happy Path - Add Line Item",
    {
      annotation: [
        { type: "preconditions", description: "มี GRN draft ของ test (2 บรรทัด x 5 @ 100 = 1,000)" },
        { type: "steps", description: "1. เปิด GRN → Edit → Add Item\n2. เลือก Product ใหม่ qty 3 ราคา 20\n3. Save Draft" },
        { type: "expected", description: "backend มี 3 บรรทัด ยอดรวม 1,060 และหน้าแสดง Grand Total 1,060.00" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const g = await createDraftGrn(inv("addline"));
      await goto(page, g.id);
      await button(page, "Edit").click();
      const row = await addRow(page);
      await pickLookup(page, row.getByRole("button", { name: "Select Product" }), "", /^(?!.*1111000[34])/s);
      await expect(row).toContainText("KG", { timeout: 15_000 });
      await typeInto(row.locator('input[name$=".received_qty"]'), 3);
      await typeInto(row.locator('input[placeholder="0.00"]').first(), 20);
      await expect(page.locator("table tbody").getByRole("button", { name: "Select Unit" })).toHaveCount(0, { timeout: 15_000 });
      await saveDraft(page);
      await expect(page.locator("main")).toContainText("1,060.00");
      const rec = (await getGrn(g.id)).data!;
      expect(rec.good_received_note_detail).toHaveLength(3);
      expect(Number(rec.total_amount)).toBe(1060);
    },
  );

  purchaseTest(
    "TC-GRN-070002 Invalid Input - Empty Product Name",
    {
      annotation: [
        { type: "preconditions", description: "มี GRN draft ของ test (2 บรรทัด)" },
        { type: "steps", description: "1. เปิด GRN → Edit → Add Item\n2. ไม่เลือก Product\n3. คลิก Save" },
        { type: "expected", description: "ไม่บันทึก: แถวใหม่ยังเป็น 'Select Product', ไม่มี toast สำเร็จ, backend ยังมี 2 บรรทัด" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const g = await createDraftGrn(inv("noprod"));
      await goto(page, g.id);
      await button(page, "Edit").click();
      await button(page, "Add Item").click();
      await expectBlocked(page, /good-received-note/, () => button(page, "Save").click(), blockedToast(page));
      await expect(page.getByRole("button", { name: "Select Product" })).toBeVisible();
      await expect(page.locator("[data-sonner-toast]").filter({ hasText: /updated|saved|success/i })).toHaveCount(0);
      expect((await getGrn(g.id)).data!.good_received_note_detail).toHaveLength(2);
    },
  );

});

fcTest.describe("GRN — Add Line Item — Permission denial", () => {
  fcTest(
    "TC-GRN-070003 No Permission - User Tries to Add Item",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น FC (view อย่างเดียว); มี GRN draft-4" },
        { type: "steps", description: "1. เปิดหน้า detail ของ draft-4\n2. มองหาปุ่ม Add Item" },
        { type: "expected", description: "ไม่มีปุ่ม Add Item ในโหมดดู และ Edit ถูกปิดใช้งาน" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Authorization" },
      ],
    },
    async ({ page }) => {
      const d = await seededGrn("draft");
      await page.goto(`${LIST}/${d.id}`);
      await expect(page.getByRole("button", { name: "Edit", exact: true })).toHaveAttribute("aria-disabled", "true", { timeout: 20_000 });
      await expect(page.getByRole("button", { name: "Add Item" })).toHaveCount(0);
    },
  );

});

purchaseTest.describe("GRN — Edit Line Item", () => {
  purchaseTest.afterAll(sweep);

  purchaseTest(
    "TC-GRN-080001 Edit Existing Line Item - Happy Path",
    {
      annotation: [
        { type: "preconditions", description: "มี GRN draft ของ test (2 บรรทัด x 5 @ 100)" },
        { type: "steps", description: "1. เปิด GRN → Edit\n2. แก้ Received qty แถวแรกเป็น 8\n3. Save Draft" },
        { type: "expected", description: "บรรทัดนั้นเก็บ qty 8 (ยอดบรรทัด 800); ยอดรวมเอกสารคำนวณใหม่เป็น 1,300.00" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const g = await createDraftGrn(inv("editline"));
      await goto(page, g.id);
      await button(page, "Edit").click();
      await typeInto(page.locator('input[name="items.0.received_qty"]'), 8);
      await saveDraft(page);
      const rec = (await getGrn(g.id)).data!;
      const qtys = rec.good_received_note_detail.map((d) => Number(d.items[0].received_qty)).sort((a, b) => a - b);
      expect(qtys).toEqual([5, 8]);
      expect(Number(rec.total_amount)).toBe(1300);
      await expect(page.locator("main")).toContainText("1,300.00");
    },
  );

  purchaseTest(
    "TC-GRN-080002 Edit Line Item - Invalid Price Input",
    {
      annotation: [
        { type: "preconditions", description: "มี GRN draft ของ test" },
        { type: "steps", description: "1. เปิด GRN → Edit\n2. พิมพ์ 'abc' ในช่อง Unit Price แถวแรก\n3. ดูค่าในช่อง" },
        { type: "expected", description: "ช่อง Unit Price ไม่รับตัวอักษร (ค่าที่เห็นไม่มีตัวอักษร) และยอดรวมไม่เป็น NaN" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const g = await createDraftGrn(inv("badprice"));
      await goto(page, g.id);
      await button(page, "Edit").click();
      const price = rowsOf(page).first().locator('input[placeholder="0.00"]').first();
      await typeInto(price, "abc");
      expect(await price.inputValue()).not.toMatch(/[a-z]/i);
      await expect(page.locator("main")).not.toContainText("NaN");
    },
  );

  purchaseTest(
    "TC-GRN-080004 Edit Line Item - No Line Items Exist",
    {
      annotation: [
        { type: "preconditions", description: "มี GRN draft ของ test (2 บรรทัด)" },
        { type: "steps", description: "1. เปิด GRN → Edit\n2. ลบทั้งสองบรรทัด (Remove this line)\n3. คลิก Save" },
        { type: "expected", description: "ตารางไม่มีแถว; Save ไม่ผ่าน (ไม่มี toast สำเร็จ); backend ยังมี 2 บรรทัด" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const g = await createDraftGrn(inv("nolines"));
      await goto(page, g.id);
      await button(page, "Edit").click();
      for (let i = 0; i < 2; i++) await removeFirstLine(page);
      await expect(page.getByRole("button", { name: "Remove this line" })).toHaveCount(0);
      await expectBlocked(page, /good-received-note/, () => button(page, "Save").click(), blockedToast(page));
      await expect(page.locator("[data-sonner-toast]").filter({ hasText: /updated|saved|success/i })).toHaveCount(0);
      expect((await getGrn(g.id)).data!.good_received_note_detail).toHaveLength(2);
    },
  );

  purchaseTest(
    "TC-GRN-080005 Edit Line Item - GRN in RECEIVED Status",
    {
      annotation: [
        { type: "preconditions", description: "มี GRN ที่ committed (GRN261100001)" },
        { type: "steps", description: "1. เปิด GRN261100001 → Edit\n2. ดูช่อง Received qty" },
        { type: "expected", description: "ในโหมด Edit จำนวน Received ของทุกแถวเป็นข้อความอ่านอย่างเดียว (ไม่มีช่อง input) — แก้บรรทัดของใบที่ commit แล้วไม่ได้" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const c = await seededGrn("committed");
      await goto(page, c.id);
      await button(page, "Edit").click();
      await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeVisible({ timeout: 10_000 });
      await expect(page.locator('input[name$=".received_qty"]')).toHaveCount(0);
      await expect(page.locator("main")).toContainText("10KG");
    },
  );

});

fcTest.describe("GRN — Edit Line Item — Permission denial", () => {
  fcTest(
    "TC-GRN-080003 Edit Line Item - No Permission",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น FC (view อย่างเดียว); GRN draft-4 มี 2 บรรทัด" },
        { type: "steps", description: "1. เปิดหน้า detail ของ draft-4\n2. มองหาช่อง Received qty" },
        { type: "expected", description: "รายการเป็นข้อความอ่านอย่างเดียว ไม่มี input ของ qty และ Edit ถูกปิดใช้งาน" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Authorization" },
      ],
    },
    async ({ page }) => {
      const d = await seededGrn("draft");
      await page.goto(`${LIST}/${d.id}`);
      await expect(page.getByRole("button", { name: "Edit", exact: true })).toHaveAttribute("aria-disabled", "true", { timeout: 20_000 });
      await expect(page.locator('input[name$=".received_qty"]')).toHaveCount(0);
    },
  );

});

purchaseTest.describe("GRN — Delete Line Item", () => {
  purchaseTest.afterAll(sweep);

  purchaseTest(
    "TC-GRN-090001 Delete a valid line item from a draft GRN",
    {
      annotation: [
        { type: "preconditions", description: "มี GRN draft ของ test (2 บรรทัด x 500)" },
        { type: "steps", description: "1. เปิด GRN → Edit\n2. คลิก Remove this line แถวแรก (ยืนยันถ้ามี dialog)\n3. Save Draft" },
        { type: "expected", description: "เหลือ 1 แถว; หลัง Save backend มี 1 บรรทัด ยอดรวม 500 และหน้าแสดง Grand Total 500.00" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const g = await createDraftGrn(inv("rmline"));
      await goto(page, g.id);
      await button(page, "Edit").click();
      await expect(rowsOf(page)).toHaveCount(2);
      await removeFirstLine(page);
      await expect(rowsOf(page)).toHaveCount(1);
      await saveDraft(page);
      const rec = (await getGrn(g.id)).data!;
      expect(rec.good_received_note_detail).toHaveLength(1);
      expect(Number(rec.total_amount)).toBe(500);
      await expect(page.locator("main")).toContainText("500.00");
    },
  );

  purchaseTest(
    "TC-GRN-090003 Try to delete a line item from a received GRN",
    {
      annotation: [
        { type: "preconditions", description: "มี GRN ที่ committed (GRN261100001)" },
        { type: "steps", description: "1. เปิด GRN261100001 → Edit\n2. มองหาปุ่ม Remove this line" },
        { type: "expected", description: "ไม่มีปุ่ม Remove this line เลย — ลบบรรทัดของใบที่ commit แล้วไม่ได้; backend ยังมี 2 บรรทัด" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const c = await seededGrn("committed");
      await goto(page, c.id);
      await button(page, "Edit").click();
      await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeVisible({ timeout: 10_000 });
      await expect(page.getByRole("button", { name: "Remove this line" })).toHaveCount(0);
      expect((await getGrn(c.id)).data!.good_received_note_detail).toHaveLength(2);
    },
  );

});

fcTest.describe("GRN — Delete Line Item — Permission denial", () => {
  fcTest(
    "TC-GRN-090002 Attempt to delete a line item without edit permission",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น FC (view อย่างเดียว); GRN draft-4" },
        { type: "steps", description: "1. เปิดหน้า detail ของ draft-4\n2. มองหาปุ่ม Remove this line" },
        { type: "expected", description: "ไม่มีปุ่ม Remove this line ในโหมดดู และเข้าโหมดแก้ไขไม่ได้ (Edit ปิดใช้งาน)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Authorization" },
      ],
    },
    async ({ page }) => {
      const d = await seededGrn("draft");
      await page.goto(`${LIST}/${d.id}`);
      await expect(page.getByRole("button", { name: "Edit", exact: true })).toHaveAttribute("aria-disabled", "true", { timeout: 20_000 });
      await expect(page.getByRole("button", { name: "Remove this line" })).toHaveCount(0);
    },
  );

});

purchaseTest.describe("GRN — Extra Costs", () => {
  // the TEST BU dataset has no extra-cost type, so the describe creates one and removes it again
  let costTypeId = "";
  purchaseTest.beforeAll(async () => {
    costTypeId = await createExtraCostType(`${PFX} freight ${uid}`);
  });
  purchaseTest.afterAll(async () => {
    await sweep();
    if (costTypeId) await deleteExtraCostType(costTypeId);
  });

  purchaseTest(
    "TC-GRN-100001 Happy Path - Add Extra Costs",
    {
      annotation: [
        { type: "preconditions", description: "มี GRN draft ของ test; มีประเภท extra cost ใน TEST BU" },
        { type: "steps", description: "1. เปิด GRN → Edit → แท็บ Extra Cost\n2. คลิก Add Cost เลือก Type กรอก Amount 100\n3. Save Draft" },
        { type: "expected", description: "backend เก็บ extra cost 1 รายการ amount 100; แท็บ Extra Cost แสดงจำนวน 1" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const g = await createDraftGrn(inv("extra"));
      await goto(page, g.id);
      await button(page, "Edit").click();
      await page.getByRole("tab", { name: /extra cost/i }).click();
      await button(page, "Add Cost").first().click();
      await pickLookup(page, page.getByRole("button", { name: "Select Extra Cost" }));
      await typeInto(page.locator('input[name="extra_cost_details.0.amount"]'), 100);
      await saveDraft(page);
      const ec = (await getGrn(g.id)).data!.extra_cost as { extra_cost_detail?: Array<{ amount: number }> } | null;
      expect(ec?.extra_cost_detail).toHaveLength(1);
      expect(Number(ec!.extra_cost_detail![0].amount)).toBe(100);
      await expect(page.getByRole("tab", { name: /extra cost/i })).toContainText("1");
    },
  );

  purchaseTest(
    "TC-GRN-100003 Edge Case - Invalid Cost Amount",
    {
      annotation: [
        { type: "preconditions", description: "มี GRN draft ของ test" },
        { type: "steps", description: "1. เปิด GRN → Edit → แท็บ Extra Cost → Add Cost\n2. เลือก Type แต่พิมพ์ 'abc' ใน Amount\n3. Save Draft" },
        { type: "expected", description: "ช่อง Amount ไม่รับตัวอักษร; Save ไม่ผ่าน (ไม่มี toast สำเร็จ); backend ไม่มี extra cost" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const g = await createDraftGrn(inv("badcost"));
      await goto(page, g.id);
      await button(page, "Edit").click();
      await page.getByRole("tab", { name: /extra cost/i }).click();
      await button(page, "Add Cost").first().click();
      await pickLookup(page, page.getByRole("button", { name: "Select Extra Cost" }));
      const amount = page.locator('input[name="extra_cost_details.0.amount"]');
      await typeInto(amount, "abc");
      expect(await amount.inputValue()).not.toMatch(/[a-z]/i);
      // the form lets the bad amount through to the backend, which refuses it (4xx) and the app reports it
      await expectRefused(page, /good-received-note/, () => button(page, "Save Draft").click(), blockedToast(page));
      await expect(page.locator("[data-sonner-toast]").filter({ hasText: /updated|saved|success/i })).toHaveCount(0);
      expect((await getGrn(g.id)).data!.extra_cost?.extra_cost_detail ?? []).toHaveLength(0);
    },
  );

});

fcTest.describe("GRN — Extra Costs — Permission denial", () => {
  fcTest(
    "TC-GRN-100002 Negative - No Permission to Add Costs",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น FC (view อย่างเดียว); GRN draft-4" },
        { type: "steps", description: "1. เปิดหน้า detail ของ draft-4 → แท็บ Extra Cost\n2. มองหาปุ่ม Add Cost" },
        { type: "expected", description: "ไม่มีปุ่ม Add Cost (โหมดดู) และ Edit ถูกปิดใช้งาน" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Authorization" },
      ],
    },
    async ({ page }) => {
      const d = await seededGrn("draft");
      await page.goto(`${LIST}/${d.id}`);
      await expect(page.getByRole("button", { name: "Edit", exact: true })).toHaveAttribute("aria-disabled", "true", { timeout: 20_000 });
      await page.getByRole("tab", { name: /extra cost/i }).click();
      await expect(page.getByRole("button", { name: "Add Cost" })).toHaveCount(0);
    },
  );

});

purchaseTest.describe("GRN — Commit", () => {
  purchaseTest.afterAll(sweep);

  purchaseTest(
    "TC-GRN-110001 Happy Path - Commit GRN",
    {
      annotation: [
        { type: "preconditions", description: "มี GRN draft ของ test (2 บรรทัด)" },
        { type: "steps", description: "1. เปิด GRN draft\n2. คลิก Commit ที่ footer\n3. ยืนยันใน dialog" },
        { type: "expected", description: "backend เปลี่ยนสถานะเป็น committed; หน้าแสดง badge Committed และไม่มีปุ่ม Commit/Void อีก; แท็บ Stock Movement แสดงรายการสินค้า" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const g = await createDraftGrn(inv("commit"));
      await goto(page, g.id);
      await button(page, "Commit").click();
      await confirmDialog(page, /commit/i);
      await expect.poll(async () => (await getGrn(g.id)).data!.doc_status, { timeout: 60_000 }).toBe("committed");
      await page.reload();
      await expect(page.locator("main")).toContainText(/committed/i, { timeout: 15_000 });
      await expect(page.getByRole("button", { name: "Commit", exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Void", exact: true })).toHaveCount(0);
      await page.getByRole("tab", { name: /stock movement/i }).click();
      await expect(page.locator("main")).toContainText("Australian Sirloin", { timeout: 15_000 });
    },
  );

  purchaseTest(
    "TC-GRN-110003 Negative - Missing Storage Location",
    {
      annotation: [
        { type: "preconditions", description: "มี GRN draft ของ test" },
        { type: "steps", description: "1. เปิด GRN → Edit → ลบทุกบรรทัด\n2. Add Item (แถวใหม่ไม่มีคลัง)\n3. คลิก Save" },
        { type: "expected", description: "แถวใหม่ยังเป็น 'Select Location'; Save ไม่ผ่าน (ไม่มี toast สำเร็จ); backend ยังมี 2 บรรทัดและ draft" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const g = await createDraftGrn(inv("noloc"));
      await goto(page, g.id);
      await button(page, "Edit").click();
      for (let i = 0; i < 2; i++) await removeFirstLine(page);
      await button(page, "Add Item").click();
      await expect(page.getByRole("button", { name: "Select Location" })).toBeVisible();
      await expectBlocked(page, /good-received-note/, () => button(page, "Save").click(), blockedToast(page));
      await expect(page.locator("[data-sonner-toast]").filter({ hasText: /updated|saved|success/i })).toHaveCount(0);
      const rec = (await getGrn(g.id)).data!;
      expect(rec.good_received_note_detail).toHaveLength(2);
      expect(rec.doc_status).toBe("draft");
    },
  );

});

fcTest.describe("GRN — Commit — Permission denial", () => {
  fcTest(
    "TC-GRN-110002 Negative - No Permission to Commit GRN",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น FC (view อย่างเดียว); GRN draft-4" },
        { type: "steps", description: "1. เปิดหน้า detail ของ draft-4\n2. ดูปุ่ม Commit ที่ footer" },
        { type: "expected", description: "ปุ่ม Commit ถูกปิดใช้งาน (aria-disabled) — ผู้ไม่มีสิทธิ์ commit ไม่ควรกดได้" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Authorization" },
      ],
    },
    async ({ page }) => {
      const d = await seededGrn("draft");
      await page.goto(`${LIST}/${d.id}`);
      const commit = page.getByRole("button", { name: "Commit", exact: true });
      await expect(commit).toBeVisible({ timeout: 20_000 });
      fcTest.fail(true, NO_GATE);
      await expect(commit).toHaveAttribute("aria-disabled", "true");
    },
  );

});

purchaseTest.describe("GRN — Void", () => {
  purchaseTest.afterAll(sweep);

  purchaseTest(
    "TC-GRN-120001 Void GRN - Happy Path",
    {
      annotation: [
        { type: "preconditions", description: "มี GRN draft ของ test" },
        { type: "steps", description: "1. เปิด GRN draft\n2. คลิก Void ที่ footer\n3. ยืนยันใน dialog" },
        { type: "expected", description: "backend เปลี่ยนสถานะเป็น voided; หน้าแสดง badge Voided และไม่มีปุ่ม Commit/Void" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const g = await createDraftGrn(inv("void"));
      await goto(page, g.id);
      await button(page, "Void").click();
      await confirmDialog(page, /^void$/i);
      await expect.poll(async () => (await getGrn(g.id)).data!.doc_status, { timeout: 60_000 }).toBe("voided");
      await page.reload();
      await expect(page.locator("main")).toContainText(/void/i, { timeout: 15_000 });
      await expect(page.getByRole("button", { name: "Commit", exact: true })).toHaveCount(0);
    },
  );

  purchaseTest(
    "TC-GRN-120003 Void GRN - Committed GRN",
    {
      annotation: [
        { type: "preconditions", description: "มี GRN ที่ committed (GRN261100001)" },
        { type: "steps", description: "1. เปิด GRN261100001\n2. มองหาปุ่ม Void/Commit ที่ footer" },
        { type: "expected", description: "ใบที่ commit แล้วไม่มีปุ่ม Void และ Commit (FE ให้ void ได้เฉพาะใบที่ยังไม่ commit — grn-footer-action.tsx); backend ยังเป็น committed" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const c = await seededGrn("committed");
      await goto(page, c.id);
      await expect(page.locator("main")).toContainText(/committed/i);
      await expect(page.getByRole("button", { name: "Void", exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Commit", exact: true })).toHaveCount(0);
      expect((await getGrn(c.id)).data!.doc_status).toBe("committed");
    },
  );

});

fcTest.describe("GRN — Void — Permission denial", () => {
  fcTest(
    "TC-GRN-120002 Void GRN - No Permission",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น FC (view อย่างเดียว); GRN draft-4" },
        { type: "steps", description: "1. เปิดหน้า detail ของ draft-4\n2. ดูปุ่ม Void ที่ footer" },
        { type: "expected", description: "ปุ่ม Void ถูกปิดใช้งาน (aria-disabled) — ผู้ไม่มีสิทธิ์ไม่ควร void ได้" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Authorization" },
      ],
    },
    async ({ page }) => {
      const d = await seededGrn("draft");
      await page.goto(`${LIST}/${d.id}`);
      const voidBtn = page.getByRole("button", { name: "Void", exact: true });
      await expect(voidBtn).toBeVisible({ timeout: 20_000 });
      fcTest.fail(true, NO_GATE);
      await expect(voidBtn).toHaveAttribute("aria-disabled", "true");
    },
  );

});

purchaseTest.describe("GRN — Financial Summary", () => {
  purchaseTest(
    "TC-GRN-130001 View Financial Summary - Happy Path",
    {
      annotation: [
        { type: "preconditions", description: "มี GRN ที่ committed GRN261100001 (2 บรรทัด x 1,000)" },
        { type: "steps", description: "1. เปิดหน้า detail ของ GRN261100001\n2. ดูแถบสรุปท้ายหน้า" },
        { type: "expected", description: "แถบสรุปแสดง Subtotal 2,000.00, Discount 0.00, Net 2,000.00, Tax 0.00, Grand Total 2,000.00 THB ตรงกับ backend" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const c = await seededGrn("committed");
      await goto(page, c.id);
      const rec = (await getGrn(c.id)).data!;
      expect(Number(rec.total_amount)).toBe(2000);
      const main = page.locator("main");
      await expect(main).toContainText(/Subtotal\s*\|?\s*2,000\.00/);
      await expect(main).toContainText(/Net\s*\|?\s*2,000\.00/);
      await expect(main).toContainText(/Grand Total\s*\|?\s*2,000\.00/);
      await expect(main).toContainText(/Discount\s*\|?\s*0\.00/);
    },
  );

  purchaseTest(
    "TC-GRN-130003 View Financial Summary - Invalid GRN",
    {
      annotation: [
        { type: "preconditions", description: "ไม่มี GRN ตาม id" },
        { type: "steps", description: "1. ไปที่ /procurement/goods-receive-note/00000000-0000-4000-8000-000000000000" },
        { type: "expected", description: "แสดงหน้า error ('Something went wrong' + Try again) ไม่มีแถบสรุปยอด" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      await page.goto(`${LIST}/00000000-0000-4000-8000-000000000000`);
      await expect(page.getByText("Something went wrong").first()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText("Grand Total")).toHaveCount(0);
    },
  );

});

purchaseTest.describe("GRN — Stock Movements", () => {
  purchaseTest(
    "TC-GRN-140001 View stock movements for committed GRN",
    {
      annotation: [
        { type: "preconditions", description: "มี GRN ที่ committed GRN261100001" },
        { type: "steps", description: "1. เปิด GRN261100001\n2. คลิกแท็บ Stock Movement" },
        { type: "expected", description: "แท็บแสดงแถวการเคลื่อนไหวของสินค้า Ground Beef และ Chilled Angus โดยไม่มีข้อความ 'shows after this receipt is committed'" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const c = await seededGrn("committed");
      await goto(page, c.id);
      await page.getByRole("tab", { name: /stock movement/i }).click();
      const main = page.locator("main");
      await expect(main).toContainText("Ground Beef", { timeout: 15_000 });
      await expect(main).toContainText("Chilled Angus");
      await expect(main).not.toContainText(/shows after this receipt is committed/i);
    },
  );

  purchaseTest(
    "TC-GRN-140003 No stock movements when GRN is not committed",
    {
      annotation: [
        { type: "preconditions", description: "มี GRN draft-4" },
        { type: "steps", description: "1. เปิดหน้า draft-4\n2. คลิกแท็บ Stock Movement" },
        { type: "expected", description: "แท็บแสดงข้อความ 'Stock movement shows after this receipt is committed' ไม่มีแถวสินค้า" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const d = await seededGrn("draft");
      await goto(page, d.id);
      await page.getByRole("tab", { name: /stock movement/i }).click();
      await expect(page.getByText(/shows after this receipt is committed/i)).toBeVisible({ timeout: 10_000 });
    },
  );

});

purchaseTest.describe("GRN — Comments", () => {
  purchaseTest.afterAll(sweep);

  purchaseTest(
    "TC-GRN-150001 Add valid comment",
    {
      annotation: [
        { type: "preconditions", description: "มี GRN draft ของ test (ไม่มี comment)" },
        { type: "steps", description: "1. เปิด GRN → Comment\n2. พิมพ์ข้อความ → Send comment" },
        { type: "expected", description: "toast 'Comment added'; header เป็น 'Comments (1)' และแสดงข้อความ + ชื่อผู้ส่ง" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const g = await createDraftGrn(inv("c1"));
      await goto(page, g.id);
      await page.getByRole("button", { name: "Comment", exact: true }).click();
      const dlg = page.locator("[role=dialog]:visible").last();
      await expect(dlg).toContainText(/Comments \(\d+\)/);
      await expect(dlg).toContainText("Comments (0)");
      const text = `hello ${uid}`;
      await dlg.getByPlaceholder("Add comment...").fill(text);
      await dlg.getByRole("button", { name: "Send comment" }).click();
      await expect(dlg).toContainText("Comments (1)", { timeout: 15_000 });
      await expect(dlg).toContainText(text);
      await expect(dlg).toContainText("purchase carmensoftware");
    },
  );

  purchaseTest(
    "TC-GRN-150003 Add comment with empty text",
    {
      annotation: [
        { type: "preconditions", description: "มี GRN draft ของ test" },
        { type: "steps", description: "1. เปิด GRN → Comment\n2. ไม่พิมพ์อะไร" },
        { type: "expected", description: "ปุ่ม Send comment ถูกปิดใช้งาน และยังเป็น 'Comments (0)'; พิมพ์เว้นวรรคอย่างเดียวก็ยังกดส่งไม่ได้" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const g = await createDraftGrn(inv("c3"));
      await goto(page, g.id);
      await page.getByRole("button", { name: "Comment", exact: true }).click();
      const dlg = page.locator("[role=dialog]:visible").last();
      await expect(dlg).toContainText(/Comments \(\d+\)/);
      const send = dlg.getByRole("button", { name: "Send comment" });
      await expect(send).toBeDisabled();
      await dlg.getByPlaceholder("Add comment...").fill("   ");
      await expect(send).toBeDisabled();
      await expect(dlg).toContainText("Comments (0)");
    },
  );

  purchaseTest(
    "TC-GRN-150004 Add comment with very long text",
    {
      annotation: [
        { type: "preconditions", description: "มี GRN draft ของ test" },
        { type: "steps", description: "1. เปิด GRN → Comment\n2. วางข้อความ 300 ตัวอักษร" },
        { type: "expected", description: "ช่องรับได้สูงสุด 256 ตัวอักษร (ตัวนับ 256/256) ส่วนที่เกินถูกตัด" },
        { type: "priority", description: "Low" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      const g = await createDraftGrn(inv("c4"));
      await goto(page, g.id);
      await page.getByRole("button", { name: "Comment", exact: true }).click();
      const dlg = page.locator("[role=dialog]:visible").last();
      await expect(dlg).toContainText(/Comments \(\d+\)/);
      const box = dlg.getByPlaceholder("Add comment...");
      await box.fill("x".repeat(300));
      expect((await box.inputValue()).length).toBe(256);
      await expect(dlg).toContainText("256/256");
    },
  );

  purchaseTest(
    "TC-GRN-150005 Add multiple comments",
    {
      annotation: [
        { type: "preconditions", description: "มี GRN draft ของ test" },
        { type: "steps", description: "1. เปิด GRN → Comment\n2. ส่ง comment สองข้อความ" },
        { type: "expected", description: "header เป็น 'Comments (2)' และแสดงทั้งสองข้อความ" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const g = await createDraftGrn(inv("c5"));
      await goto(page, g.id);
      await page.getByRole("button", { name: "Comment", exact: true }).click();
      const dlg = page.locator("[role=dialog]:visible").last();
      await expect(dlg).toContainText(/Comments \(\d+\)/);
      for (const n of [1, 2]) {
        await dlg.getByPlaceholder("Add comment...").fill(`msg ${n} ${uid}`);
        await dlg.getByRole("button", { name: "Send comment" }).click();
        await expect(dlg).toContainText(`Comments (${n})`, { timeout: 15_000 });
      }
      await expect(dlg).toContainText(`msg 1 ${uid}`);
      await expect(dlg).toContainText(`msg 2 ${uid}`);
    },
  );

});

purchaseTest.describe("GRN — Attachments", () => {
  purchaseTest.afterAll(sweep);

  purchaseTest(
    "TC-GRN-160001 Happy Path - Upload Valid Attachments",
    {
      annotation: [
        { type: "preconditions", description: "มี GRN draft ของ test" },
        { type: "steps", description: "1. เปิด GRN → Comment\n2. Attach file เลือกรูป PNG\n3. พิมพ์ข้อความ → Send comment" },
        { type: "expected", description: "comment ถูกเพิ่ม ('Comments (1)') พร้อมไฟล์แนบ e2e-pixel.png ที่แสดงในรายการ" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const g = await createDraftGrn(inv("a1"));
      await goto(page, g.id);
      const dir = mkdtempSync(join(tmpdir(), "grn-att-"));
      const png = join(dir, "e2e-pixel.png");
      writeFileSync(png, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
      await page.getByRole("button", { name: "Comment", exact: true }).click();
      const dlg = page.locator("[role=dialog]:visible").last();
      await expect(dlg).toContainText(/Comments \(\d+\)/);
      await dlg.locator("input[type=file]").setInputFiles(png);
      await dlg.getByPlaceholder("Add comment...").fill(`with file ${uid}`);
      await dlg.getByRole("button", { name: "Send comment" }).click();
      await expect(dlg).toContainText("Comments (1)", { timeout: 20_000 });
      await expect(dlg.getByText("e2e-pixel.png").or(dlg.locator("img").first())).toBeVisible({ timeout: 15_000 });
    },
  );

  purchaseTest(
    "TC-GRN-160003 Negative - Upload Invalid File Type",
    {
      annotation: [
        { type: "preconditions", description: "มี GRN draft ของ test" },
        { type: "steps", description: "1. เปิด GRN → Comment\n2. Attach file เลือกไฟล์ .txt" },
        { type: "expected", description: "toast 'only JPG, PNG, WEBP, GIF, PDF files are allowed'; ไม่มีไฟล์ถูกแนบ ยังเป็น 'Comments (0)'" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const g = await createDraftGrn(inv("a3"));
      await goto(page, g.id);
      const dir = mkdtempSync(join(tmpdir(), "grn-att-"));
      const txt = join(dir, "e2e-note.txt");
      writeFileSync(txt, "hello");
      await page.getByRole("button", { name: "Comment", exact: true }).click();
      const dlg = page.locator("[role=dialog]:visible").last();
      await expect(dlg).toContainText(/Comments \(\d+\)/);
      await dlg.locator("input[type=file]").setInputFiles(txt);
      await expect(page.locator("[data-sonner-toast]").filter({ hasText: /only JPG, PNG, WEBP, GIF, PDF/i })).toBeVisible({ timeout: 10_000 });
      await expect(dlg).toContainText("Comments (0)");
    },
  );

  purchaseTest(
    "TC-GRN-160005 Negative - No Files to Upload",
    {
      annotation: [
        { type: "preconditions", description: "มี GRN draft ของ test" },
        { type: "steps", description: "1. เปิด GRN → Comment\n2. ไม่เลือกไฟล์และไม่พิมพ์ข้อความ" },
        { type: "expected", description: "ปุ่ม Send comment ถูกปิดใช้งาน ไม่มี comment ถูกสร้าง" },
        { type: "priority", description: "Low" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const g = await createDraftGrn(inv("a5"));
      await goto(page, g.id);
      await page.getByRole("button", { name: "Comment", exact: true }).click();
      const dlg = page.locator("[role=dialog]:visible").last();
      await expect(dlg).toContainText(/Comments \(\d+\)/);
      await expect(dlg.getByRole("button", { name: "Send comment" })).toBeDisabled();
      await expect(dlg).toContainText("Comments (0)");
    },
  );

});

purchaseTest.describe("GRN — Activity Log", () => {
  purchaseTest(
    "TC-GRN-170001 View Activity Log with Valid GRN",
    {
      annotation: [
        { type: "preconditions", description: "มี GRN GRN261100003 (saved) ที่ data:reset seed" },
        { type: "steps", description: "1. เปิดหน้า detail ของ GRN261100003\n2. คลิก Activity" },
        { type: "expected", description: "sheet 'Activity' แสดงเลข GRN261100003 และรายการ 'Created' กับ 'Saved' โดย purchase carmensoftware" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const s = await seededGrn("saved");
      await goto(page, s.id);
      await page.getByRole("button", { name: "Activity", exact: true }).click();
      const sheet = page.locator("[role=dialog]:visible").last();
      await expect(sheet).toContainText("GRN261100003", { timeout: 10_000 });
      await expect(sheet).toContainText("Created");
      await expect(sheet).toContainText("Saved");
      await expect(sheet).toContainText("purchase carmensoftware");
    },
  );

  purchaseTest(
    "TC-GRN-170003 View Activity Log for Non-Existent GRN",
    {
      annotation: [
        { type: "preconditions", description: "ไม่มี GRN ตาม id" },
        { type: "steps", description: "1. ไปที่ /procurement/goods-receive-note/00000000-0000-4000-8000-000000000001" },
        { type: "expected", description: "แสดงหน้า error แทนหน้า detail; ไม่มีปุ่ม Activity ให้เปิด" },
        { type: "priority", description: "Low" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      await page.goto(`${LIST}/00000000-0000-4000-8000-000000000001`);
      await expect(page.getByText("Something went wrong").first()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole("button", { name: "Activity", exact: true })).toHaveCount(0);
    },
  );

});

