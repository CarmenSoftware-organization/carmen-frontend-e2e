import { test as baseTest, expect } from "@playwright/test";
import { createAuthTest } from "./fixtures/auth.fixture";
import { PurchaseRequestPage, LIST_PATH } from "./pages/purchase-request.page";
import { createDraftPR, submitDraftPR, deleteDraftPR, e2eDescription } from "./pages/pr-creator.helpers";
import { openRecordFromRow, recordRows } from "./helpers/list-row";
import { buGet } from "./helpers/bu-api";
import { BU_CODE } from "./test-users";
import { ensureActiveBu, getBusinessUnits, defaultBu } from "./helpers/bu";
import { BuSwitcherPage } from "./pages/bu-switcher.page";

// Persona-journey spec — Creator (Requestor). Runs alongside 301-pr.spec.ts
// (per-action multi-role) without modifying it. Source docs:
// docs/persona-doc/Purchase Request/Creator/INDEX.md and step-01..08.md.
const requestorTest = createAuthTest("carmensoftware.dev+requestor@gmail.com");

const FUTURE_DATE = "2099-12-31";

requestorTest.describe("Step 1 — PR List", () => {
  // Transaction-module rollout: pin the creator session's active BU to BLAVG.
  // Run first so the BU persists (server-side) for the rest of the journey.
  requestorTest(
    "TC-PR-050150 active BU = BLAVG",
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
    "TC-PR-050101 List loads with My Pending tab and Creator's PRs visible",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Requestor (carmensoftware.dev+requestor@gmail.com)" },
        { type: "steps", description: "1. ไปที่ /procurement/purchase-request\n2. ตรวจสอบว่า My Pending tab ถูกเลือกเป็นค่าเริ่มต้น\n3. ตรวจสอบว่าตาราง list แสดงผล" },
        { type: "expected", description: "URL เป็น /procurement/purchase-request, ปุ่ม viewMode 'My Pending' แสดง (เป็น view เริ่มต้น), ตารางหรือ empty-state แสดงผล" },
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
      await expect(page).not.toHaveURL(/view=all-document/);
      // Table or its empty state is rendered.
      await expect(page.getByRole("table").or(page.getByText(/no data|no results|nothing/i)).first()).toBeVisible({ timeout: 10_000 });
    },
  );

  requestorTest(
    "TC-PR-050102 Switch to All Documents tab broadens scope",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่หน้า PR list" },
        { type: "steps", description: "1. คลิก tab All Documents\n2. ตรวจสอบว่า list รีเฟรช" },
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

  requestorTest(
    "TC-PR-050103 Search by reference number filters list",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่หน้า PR list; มี PR อย่างน้อยหนึ่งรายการที่มีเลขอ้างอิงที่รู้จัก" },
        { type: "steps", description: "1. คลิกช่องค้นหา\n2. พิมพ์เลขอ้างอิงบางส่วน\n3. รอให้ list กรองข้อมูล" },
        { type: "expected", description: "ค้น PR2611 แล้วทุกแถวที่แสดงมีข้อความนั้น; ค้นข้อความที่ไม่มีอยู่แล้วไม่เหลือแถว" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const pr = new PurchaseRequestPage(page);
      await pr.gotoList();
      await expect(pr.searchInput(), "Search input missing on the PR list").toBeVisible({ timeout: 10_000 });
      await pr.gotoAllDocuments();
      await pr.searchFor("PR2611");
      const rows = recordRows(page);
      await expect(rows.first(), "search for a PR prefix returned no rows").toBeVisible({ timeout: 10_000 });
      // Every listed row carries the searched text.
      for (const text of await rows.allInnerTexts()) expect(text).toMatch(/PR2611/);
      await pr.searchFor("zzz-no-such-pr");
      await expect(rows).toHaveCount(0, { timeout: 10_000 });
    },
  );

  requestorTest(
    "TC-PR-050104 Filter by status (Draft)",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่หน้า PR list" },
        { type: "steps", description: "1. เปิดแผง Filter\n2. เลือกฟิลด์ Status แล้วติ๊ก Draft (ไม่มีปุ่ม Apply)" },
        { type: "expected", description: "ทุกแถวที่แสดงมีสถานะ Draft (requestor มี Draft จากชุดข้อมูลทดสอบ)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const pr = new PurchaseRequestPage(page);
      await pr.gotoList();
      await expect(pr.filterButton(), "Filter button missing on the PR list").toBeVisible({ timeout: 10_000 });
      await pr.gotoAllDocuments();
      await pr.applyFilter("Draft");
      await pr.expectEveryRowStatus(/draft/i);
    },
  );

  requestorTest(
    "TC-PR-050105 Sort list by Date",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่หน้า PR list" },
        { type: "steps", description: "1. คลิก header คอลัมน์ Date เพื่อ sort\n2. ตรวจสอบว่า list เรียงลำดับใหม่" },
        { type: "expected", description: "header คอลัมน์แสดง sort indicator และ list เรียงลำดับใหม่" },
        { type: "priority", description: "Low" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const pr = new PurchaseRequestPage(page);
      await pr.gotoList();
      await pr.gotoAllDocuments();
      const header = page.getByRole("columnheader", { name: /date/i }).first();
      await expect(header, "Date column header missing").toBeVisible({ timeout: 10_000 });
      const before = await page.locator("tbody tr").first().innerText();
      await header.getByRole("button").first().click();
      await expect(page.locator("tbody tr").first(), "list did not re-sort").not.toHaveText(before, { timeout: 10_000 });
    },
  );

  requestorTest(
    "TC-PR-050106 Click row navigates to PR detail",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่หน้า PR list; มีแถว PR อย่างน้อยหนึ่งแถว" },
        { type: "steps", description: "1. คลิกแถว PR แรก" },
        { type: "expected", description: "นำทางไปยัง /procurement/purchase-request/<id>" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page }) => {
      const pr = new PurchaseRequestPage(page);
      await pr.gotoList();
      await pr.gotoAllDocuments();
      const firstRow = recordRows(page).first();
      await expect(firstRow, "No PR rows exist — data:reset seeds PRs for the requestor").toBeVisible({ timeout: 10_000 });
      await openRecordFromRow(firstRow);
      await expect(page).toHaveURL(/purchase-request\/(?!new$)[^\/?#]+$/, { timeout: 10_000 });
    },
  );

  requestorTest(
    "TC-PR-050107 New PR button opens create dialog",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่หน้า PR list" },
        { type: "steps", description: "1. คลิก New Purchase Request" },
        { type: "expected", description: "dialog สร้างใหม่เปิดขึ้น หรือ URL เปลี่ยนเป็น /new" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page }) => {
      const pr = new PurchaseRequestPage(page);
      await pr.gotoList();
      await pr.openCreateDialog();
      await expect(page).toHaveURL(/purchase-request\/new/, { timeout: 10_000 });
      await expect(pr.addItemButton(), "create form did not render its Add Item button").toBeVisible({ timeout: 10_000 });
      await expect(pr.saveDraftButton(), "create form did not render Save as Draft").toBeVisible({ timeout: 10_000 });
    },
  );
});

requestorTest.describe("Step 2 — Create PR (Blank)", () => {
  // Each test fills the create form from scratch; one line item alone costs ~29s
  // through the location → product → qty cascade. See "Step 4 — PR Detail".
  requestorTest.describe.configure({ timeout: 90_000 });
  requestorTest(
    "TC-PR-050201 Open Create dialog → Blank → form loads",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Requestor; อยู่ที่หน้า PR list" },
        { type: "steps", description: "1. คลิก New Purchase Request\n2. เลือกตัวเลือก Blank PR (ถ้า dialog ปรากฏ)\n3. รอให้ฟอร์มสร้างโหลด" },
        { type: "expected", description: "URL เปลี่ยนเป็น /procurement/purchase-request/new และฟอร์มสร้างแสดงผล" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page }) => {
      const pr = new PurchaseRequestPage(page);
      await pr.gotoList();
      await pr.openCreateDialog();
      await expect(page).toHaveURL(/purchase-request\/new/, { timeout: 10_000 });
      await expect(pr.addItemButton(), "create form did not render its Add Item button").toBeVisible({ timeout: 10_000 });
      await expect(pr.saveDraftButton(), "create form did not render Save as Draft").toBeVisible({ timeout: 10_000 });
    },
  );

  requestorTest(
    "TC-PR-050202 Default values populated on the new form",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่ฟอร์มสร้าง PR" },
        { type: "steps", description: "1. ไปที่ /new\n2. ตรวจสอบค่า default ของ date, department, location, currency, status" },
        { type: "expected", description: "ฟอร์มอยู่ที่ /new มีปุ่ม Add Item, workflow ยังไม่เลือก (Select workflow) และยังไม่มีรายการสินค้า" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const pr = new PurchaseRequestPage(page);
      await pr.gotoNew();
      await expect(page).toHaveURL(/purchase-request\/new/, { timeout: 10_000 });
      // New form defaults: no line items yet, workflow still to be chosen, Save available.
      await expect(pr.addItemButton(), "Add Item button missing on the new form").toBeVisible({ timeout: 10_000 });
      await expect(page.getByRole("combobox").first()).toContainText(/select workflow/i);
      await expect(pr.requestedQtyInputs()).toHaveCount(0);
    },
  );

  requestorTest(
    "TC-PR-050203 Fill header fields",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่ฟอร์มสร้าง PR" },
        { type: "steps", description: "1. ตั้ง PR type = General\n2. ตั้ง delivery date เป็นวันในอนาคต\n3. กรอก description และ notes" },
        { type: "expected", description: "ช่อง description มีค่าที่กรอก (มี E2E-PRC marker)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const pr = new PurchaseRequestPage(page);
      await pr.gotoNew();
      await pr.fillHeader({
        prType: "general",
        deliveryDate: FUTURE_DATE,
        description: e2eDescription("TC-PR-050203 header fill"),
        notes: "auto-generated by E2E",
      });
      await expect(pr.descriptionInput()).toHaveValue(/E2E-PRC/);
    },
  );

  requestorTest(
    "TC-PR-050204 Add 1 basic line item",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่ฟอร์มสร้าง PR โดยกรอก header แล้ว" },
        { type: "steps", description: "1. คลิก Add Item\n2. กรอก product, qty, uom, unit price\n3. บันทึกรายการ" },
        { type: "expected", description: "ตารางมี 1 แถว (requested qty = 1) และฟอร์มยังอยู่ที่ /new" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const pr = new PurchaseRequestPage(page);
      await pr.gotoNew();
      await pr.fillHeader({ prType: "general", deliveryDate: FUTURE_DATE });
      await pr.addLineItem({ product: "Test Item", quantity: 1, uom: "ea", unitPrice: 100 });
      await expect(page).toHaveURL(/purchase-request\/new/, { timeout: 10_000 });
      await expect(pr.requestedQtyInputs(), "the added line is not in the grid").toHaveCount(1);
      await expect(pr.requestedQtyInputs().first()).toHaveValue("1");
    },
  );

  requestorTest(
    "TC-PR-050205 Add line item with FOC flag",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่ฟอร์มสร้าง PR โดยกรอก header แล้ว" },
        { type: "steps", description: "1. เพิ่มรายการ\n2. Toggle checkbox FOC\n3. บันทึก" },
        { type: "expected", description: "ช่อง FOC qty ของแถวเก็บค่า 5 ไว้" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const pr = new PurchaseRequestPage(page);
      await pr.gotoNew();
      await pr.fillHeader({ prType: "general", deliveryDate: FUTURE_DATE });
      await pr.addLineItem({ product: "FOC Item", quantity: 5, uom: "ea", isFOC: true });
      await expect(page).toHaveURL(/purchase-request\/new/, { timeout: 10_000 });
      await expect(pr.focQtyInput(0), "FOC quantity was not kept on the row").toHaveValue("5");
    },
  );

  requestorTest(
    "TC-PR-050206 Add multiple line items — form stays on /new",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่ฟอร์มสร้าง PR" },
        { type: "steps", description: "1. เพิ่มรายการสินค้า 3 รายการที่ราคาต่างกัน\n2. ตรวจสอบว่าฟอร์มยังแสดงอยู่" },
        { type: "expected", description: "หลังเพิ่ม 3 รายการ ตารางมี 3 แถว (ช่อง requested qty 3 ช่อง)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const pr = new PurchaseRequestPage(page);
      await pr.gotoNew();
      await pr.fillHeader({ prType: "general", deliveryDate: FUTURE_DATE });
      for (const i of [1, 2, 3]) {
        await pr.addLineItem({ product: `Item ${i}`, quantity: i, uom: "ea", unitPrice: 50 * i });
      }
      await expect(page).toHaveURL(/purchase-request\/new/, { timeout: 10_000 });
      await expect(pr.requestedQtyInputs(), "three lines were not all added").toHaveCount(3);
    },
  );

  requestorTest(
    "TC-PR-050207 Edit line item before save",
    {
      annotation: [
        { type: "preconditions", description: "กรอก header แล้วและเพิ่มรายการสินค้าอย่างน้อยหนึ่งรายการ" },
        { type: "steps", description: "1. เพิ่ม 1 รายการ\n2. แก้ไขจำนวน\n3. บันทึกรายการ" },
        { type: "expected", description: "ช่อง requested qty ของรายการแรกเปลี่ยนเป็น 5" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const pr = new PurchaseRequestPage(page);
      await pr.gotoNew();
      await pr.fillHeader({ prType: "general", deliveryDate: FUTURE_DATE });
      await pr.addLineItem({ product: "Edit Me", quantity: 1, uom: "ea", unitPrice: 100 });
      await pr.editLineItem(0, { quantity: 5 });
      await expect(pr.requestedQtyInputs().first()).toHaveValue("5");
    },
  );

  requestorTest(
    "TC-PR-050208 Remove line item",
    {
      annotation: [
        { type: "preconditions", description: "กรอก header แล้วและเพิ่มรายการสินค้าอย่างน้อยหนึ่งรายการ" },
        { type: "steps", description: "1. เพิ่มรายการ\n2. คลิกปุ่มลบรายการนั้น" },
        { type: "expected", description: "แถวถูกลบออกจากตาราง (ไม่เหลือช่อง requested qty)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const pr = new PurchaseRequestPage(page);
      await pr.gotoNew();
      await pr.fillHeader({ prType: "general", deliveryDate: FUTURE_DATE });
      await pr.addLineItem({ product: "Remove Me", quantity: 1, uom: "ea", unitPrice: 100 });
      await pr.removeLineItem(0);
      await expect(pr.requestedQtyInputs()).toHaveCount(0);
    },
  );

  requestorTest(
    "TC-PR-050209 Save as Draft → redirect to detail with PR number",
    {
      annotation: [
        { type: "preconditions", description: "กรอก header และมีรายการสินค้า ≥1 รายการ" },
        { type: "steps", description: "1. คลิก Save as Draft\n2. รอ redirect ไปยังหน้ารายละเอียด" },
        { type: "expected", description: "URL เปลี่ยนเป็น /purchase-request/<id> (ไม่ใช่ /new) และหน้ารายละเอียดแสดงเลขเอกสารร่างที่ระบบออกให้ (รูปแบบ draft-N) พร้อมสถานะ DRAFT" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const pr = new PurchaseRequestPage(page);
      await pr.gotoNew();
      await pr.fillHeader({
        prType: "general",
        deliveryDate: FUTURE_DATE,
        description: e2eDescription("TC-PR-050209 save draft"),
      });
      await pr.addLineItem({ product: "Save Item", quantity: 1, uom: "ea", unitPrice: 100 });
      await pr.saveDraftButton().click({ timeout: 5_000 });
      await expect(page).toHaveURL(/purchase-request\/(?!new$)[^\/?#]+$/, { timeout: 15_000 });
      await expect(page.locator("main"), "detail page does not show the generated draft number (draft-N)").toContainText(/draft-\d+/i, { timeout: 15_000 });
    },
  );

  requestorTest(
    "TC-PR-050210 Save without line items → button disabled or stays on form",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่ฟอร์มสร้าง PR โดยกรอก header แล้วแต่ไม่มีรายการสินค้า" },
        { type: "steps", description: "1. กรอก header\n2. คลิก Save as Draft โดยไม่เพิ่มรายการสินค้าใดๆ" },
        { type: "expected", description: "ปุ่ม Save ถูก disabled หรือฟอร์มไม่นำทางออกจาก /new" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Validation" },
      ],
    },
    async ({ page }) => {
      const pr = new PurchaseRequestPage(page);
      await pr.gotoNew();
      await pr.fillHeader({ prType: "general", deliveryDate: FUTURE_DATE });
      // The grid is empty: Save is either disabled or refused with a message; it never creates a PR.
      const save = pr.saveDraftButton();
      if (await save.isEnabled()) {
        await save.click({ timeout: 5_000 });
        await expect(pr.anyError().first().or(page.locator("[data-sonner-toast]").first()), "no validation message after saving an empty PR").toBeVisible({ timeout: 10_000 });
      }
      await expect(page).toHaveURL(/purchase-request\/new/, { timeout: 5_000 });
    },
  );

  requestorTest(
    "TC-PR-050211 Delivery date in the past → calendar blocks past days",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่ฟอร์มสร้าง PR" },
        { type: "steps", description: "1. ตั้ง delivery date เป็นวันที่ในอดีต\n2. เพิ่มรายการ\n3. พยายามบันทึก" },
        { type: "expected", description: "ปฏิทินวันส่งของของรายการมีวันที่ก่อนวันนี้ที่เลือกไม่ได้ (disabled) — เลือกวันอดีตไม่ได้" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Validation" },
      ],
    },
    async ({ page }) => {
      const pr = new PurchaseRequestPage(page);
      await pr.gotoNew();
      await pr.fillHeader({ prType: "general", deliveryDate: FUTURE_DATE });
      await pr.addLineItem({ product: "Past Date", quantity: 1, uom: "ea", unitPrice: 100 });
      // Delivery date is a per-line DatePicker with fromDate=today (FE pr-item-cells/delivery-date-cell.tsx):
      // earlier days exist in the calendar but cannot be chosen.
      await page.locator("tbody tr").first().getByRole("button", { name: /\d{4}-\d{2}-\d{2}/ }).first().click();
      const calendar = page.getByRole("grid").first();
      await expect(calendar, "delivery date calendar did not open").toBeVisible({ timeout: 10_000 });
      await expect(calendar.locator("button[disabled], button[aria-disabled='true'], [data-disabled='true']").first(), "calendar offers selectable past days").toBeVisible();
    },
  );
});

requestorTest.describe("Step 3 — Create from Template", () => {
  // Builds its own Draft PR per test — see the note on "Step 4 — PR Detail".
  requestorTest.describe.configure({ timeout: 90_000 });
  requestorTest(
    "TC-PR-050301 Open Create dialog → Template option → picker opens",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Requestor; อยู่ที่หน้า PR list" },
        { type: "steps", description: "1. คลิก New Purchase Request\n2. เลือกตัวเลือก From-Template ใน dialog" },
        { type: "expected", description: "Template picker (dialog หรือ listbox) แสดงผลหลังเลือกตัวเลือก From-Template" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page }) => {
      const pr = new PurchaseRequestPage(page);
      await pr.gotoList();
      await pr.newButton().click();
      const tmpl = pr.createDialogTemplateOption();
      await expect(tmpl, "From Template option missing in the create dialog").toBeVisible({ timeout: 10_000 });
      await tmpl.click();
      await expect(pr.templatePicker()).toBeVisible({ timeout: 10_000 });
    },
  );

  requestorTest(
    "TC-PR-050302 Select first template → form pre-fills",
    {
      annotation: [
        { type: "preconditions", description: "Template picker เปิดอยู่และมี template อย่างน้อยหนึ่งรายการ" },
        { type: "steps", description: "1. เปิด template picker\n2. เลือก template แรก" },
        { type: "expected", description: "URL มี query param template_id (ฟอร์มกำลังโหลดจาก template)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const pr = new PurchaseRequestPage(page);
      await pr.gotoList();
      await pr.newButton().click();
      const tmpl = pr.createDialogTemplateOption();
      await expect(tmpl, "From Template option missing in the create dialog").toBeVisible({ timeout: 10_000 });
      await tmpl.click();
      // data:reset guarantees an active PR template (verify-dataset: "PR template" min 1).
      await expect(pr.templateCards().first(), "no template card — data:reset should seed one").toBeVisible({ timeout: 15_000 });
      await pr.selectFirstTemplate();
      // The wizard hands the chosen items to /new through router state, not a
      // query string — the URL is a plain /new (from-template-content.tsx:54).
      await expect(page).toHaveURL(/purchase-request\/new/, { timeout: 10_000 });
      await expect(pr.itemRowByIndex(0)).toBeVisible({ timeout: 10_000 });
    },
  );

  requestorTest(
    "TC-PR-050303 Modify template-loaded items before save",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่ฟอร์มสร้างจาก template ที่มีรายการสินค้ากรอกล่วงหน้า" },
        { type: "steps", description: "1. เปิดฟอร์ม template\n2. แก้ไขจำนวนรายการสินค้าแรกที่กรอกล่วงหน้า" },
        { type: "expected", description: "ช่อง requested qty ของรายการจาก template เปลี่ยนเป็น 9" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const pr = new PurchaseRequestPage(page);
      await pr.gotoList();
      await pr.newButton().click();
      const tmpl = pr.createDialogTemplateOption();
      await expect(tmpl, "From Template option missing in the create dialog").toBeVisible({ timeout: 10_000 });
      await tmpl.click();
      // data:reset guarantees an active PR template (verify-dataset: "PR template" min 1).
      await expect(pr.templateCards().first(), "no template card — data:reset should seed one").toBeVisible({ timeout: 15_000 });
      await pr.selectFirstTemplate();
      await expect(pr.requestedQtyInputs().first()).toBeVisible({ timeout: 15_000 });
      await pr.editLineItem(0, { quantity: 9 });
      await expect(pr.requestedQtyInputs().first()).toHaveValue("9");
    },
  );

  requestorTest(
    "TC-PR-050304 Save template-based PR → Draft created",
    {
      annotation: [
        { type: "preconditions", description: "ฟอร์มจาก template มีรายการสินค้ากรอกล่วงหน้า" },
        { type: "steps", description: "1. เปิดฟอร์ม template\n2. คลิก Save as Draft" },
        { type: "expected", description: "URL เปลี่ยนเป็น /purchase-request/<id> (ไม่ใช่ /new) หลังบันทึก" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const pr = new PurchaseRequestPage(page);
      await pr.gotoList();
      await pr.newButton().click();
      const tmpl = pr.createDialogTemplateOption();
      await expect(tmpl, "From Template option missing in the create dialog").toBeVisible({ timeout: 10_000 });
      await tmpl.click();
      // data:reset guarantees an active PR template (verify-dataset: "PR template" min 1).
      await expect(pr.templateCards().first(), "no template card — data:reset should seed one").toBeVisible({ timeout: 15_000 });
      await pr.selectFirstTemplate();
      await pr.fillHeader({ description: e2eDescription("TC-PR-050304 from template") });
      await pr.saveDraftButton().click({ timeout: 5_000 });
      await expect(page).toHaveURL(/purchase-request\/(?!new$)[^\/?#]+$/, { timeout: 15_000 });
    },
  );

  requestorTest(
    "TC-PR-050305 Empty-state message when no template matches the search",
    {
      annotation: [
        { type: "preconditions", description: "Template picker เปิดอยู่และไม่มี template ในระบบ" },
        { type: "steps", description: "1. เปิด template picker\n2. ตรวจสอบเนื้อหา" },
        { type: "expected", description: "ค้นหา template ที่ไม่มีอยู่แล้วแสดง empty-state ('No Templates Available' / 'Try searching with different keywords') และไม่เหลือการ์ด" },
        { type: "priority", description: "Low" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const pr = new PurchaseRequestPage(page);
      await pr.gotoList();
      await pr.newButton().click();
      const tmpl = pr.createDialogTemplateOption();
      await expect(tmpl, "From Template option missing in the create dialog").toBeVisible({ timeout: 10_000 });
      await tmpl.click();
      await expect(pr.templatePicker()).toBeVisible({ timeout: 10_000 });
      // A template exists (data:reset), so the empty state is reached through a search that matches none.
      await page.getByPlaceholder(/search/i).first().fill("zzz-no-such-template");
      await expect(page.getByText(/no templates|try searching with different keywords/i).first(), "no empty state for an unmatched template search").toBeVisible({ timeout: 10_000 });
      await expect(pr.templateCards()).toHaveCount(0);
    },
  );
});

requestorTest.describe("Step 4 — PR Detail", () => {
  // Every test here builds its own Draft PR through the UI, and that path grew
  // longer when the item grid started gating qty on a chosen product
  // (list → create → workflow → location → product → qty → save ≈ 32s measured
  // 2026-09-18). That is just over Playwright's 30s default, so the whole block
  // times out on setup rather than on anything it means to assert.
  requestorTest.describe.configure({ timeout: 90_000 });

  requestorTest(
    "TC-PR-050401 Draft PR detail loads with Items tab default",
    {
      annotation: [
        { type: "preconditions", description: "มี Draft PR ของ Requestor นี้ (สร้างใน beforeEach)" },
        { type: "steps", description: "1. เปิดหน้ารายละเอียด Draft PR\n2. ตรวจสอบว่า Items tab ถูกเลือก" },
        { type: "expected", description: "Detail URL เป็น /procurement/purchase-request/<ref>; ตารางรายการสินค้า (คอลัมน์ Product + อย่างน้อย 1 แถว) แสดงเป็นค่าเริ่มต้น" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page }) => {
      const pr = new PurchaseRequestPage(page);
      const created = await createDraftPR(page);
      await page.goto(`${LIST_PATH}/${created.ref}`);
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveURL(new RegExp(`${LIST_PATH}/${created.ref}`));
      await expect(page.getByRole("columnheader", { name: /product/i }).first(), "item table is not shown by default").toBeVisible({ timeout: 10_000 });
      await expect(page.locator("tbody tr").first()).toBeVisible();
    },
  );

  requestorTest(
    "TC-PR-050402 Switch to Workflow History tab",
    {
      annotation: [
        { type: "preconditions", description: "PR ถูกสร้างและ submit แล้ว (Draft ไม่มี workflow stepper — ประวัติ workflow เริ่มเมื่อ submit)" },
        { type: "steps", description: "1. คลิก tab Workflow History" },
        { type: "expected", description: "หลังคลิกตัวเปิดประวัติ (stepper) แสดง sheet Workflow History" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const pr = new PurchaseRequestPage(page);
      const created = await createDraftPR(page);
      await submitDraftPR(page, created.ref);
      await page.goto(`${LIST_PATH}/${created.ref}`);
      await page.waitForLoadState("networkidle");
      const wh = pr.tabWorkflowHistory();
      await expect(wh, "Workflow History control missing on PR detail").toBeVisible({ timeout: 10_000 });
      await wh.click();
      await expect(pr.workflowHistorySheet(), "Workflow History sheet did not open").toBeVisible({ timeout: 10_000 });
    },
  );

  requestorTest(
    "TC-PR-050403 Edit / Delete / Submit buttons present for Draft",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่หน้ารายละเอียด Draft PR" },
        { type: "steps", description: "1. ตรวจสอบ action toolbar" },
        { type: "expected", description: "ปุ่ม Edit, Delete และ Submit แสดงผลทั้งหมดสำหรับสถานะ Draft" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const pr = new PurchaseRequestPage(page);
      const created = await createDraftPR(page);
      await page.goto(`${LIST_PATH}/${created.ref}`);
      await page.waitForLoadState("networkidle");
      await expect(pr.editModeButton()).toBeVisible({ timeout: 10_000 });
      await expect(pr.deleteButton()).toBeVisible({ timeout: 10_000 });
      await expect(pr.submitButton()).toBeVisible({ timeout: 10_000 });
    },
  );

  requestorTest(
    "TC-PR-050404 Edit / Delete absent when status is In Progress",
    {
      annotation: [
        { type: "preconditions", description: "มี PR ที่มีสถานะ In Progress (สร้างผ่านขั้นตอน Submit)" },
        { type: "steps", description: "1. Submit Draft PR\n2. โหลดหน้ารายละเอียดใหม่\n3. ตรวจสอบ toolbar" },
        { type: "expected", description: "ปุ่ม Edit และ Delete ไม่แสดงผล (โหมด read-only)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Authorization" },
      ],
    },
    async ({ page }) => {
      const pr = new PurchaseRequestPage(page);
      const created = await createDraftPR(page);
      await submitDraftPR(page, created.ref);
      await page.goto(`${LIST_PATH}/${created.ref}`);
      await page.waitForLoadState("networkidle");
      await expect(pr.editModeButton()).toHaveCount(0);
      await expect(pr.deleteButton()).toHaveCount(0);
    },
  );
});

requestorTest.describe("Step 5 — Edit Draft", () => {
  // Builds its own Draft PR per test — see the note on "Step 4 — PR Detail".
  requestorTest.describe.configure({ timeout: 90_000 });

  requestorTest(
    "TC-PR-050501 Click Edit → enter edit mode",
    {
      annotation: [
        { type: "preconditions", description: "มี Draft PR ของ Requestor นี้" },
        { type: "steps", description: "1. เปิด Draft PR\n2. คลิก Edit" },
        { type: "expected", description: "ฟอร์มสามารถแก้ไขได้; ปุ่ม Save (หรือ Cancel) ระดับฟอร์มแสดงผล" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page }) => {
      const pr = new PurchaseRequestPage(page);
      const created = await createDraftPR(page);
      await page.goto(`${LIST_PATH}/${created.ref}`);
      await page.waitForLoadState("networkidle");
      await expect(pr.editModeButton(), "Edit button missing on the Draft detail").toBeVisible({ timeout: 10_000 });
      await pr.enterEditMode();
      // .first() on the union, not on each side: `a.first().or(b.first())` still
      // resolves to both matches (edit mode shows Cancel *and* Save), which trips
      // strict mode. The assertion only needs one of them to prove the form is
      // editable.
      await expect(pr.saveDraftButton().or(pr.cancelFormButton()).first()).toBeVisible({
        timeout: 10_000,
      });
    },
  );

  requestorTest(
    "TC-PR-050502 Modify header description in edit mode",
    {
      annotation: [
        { type: "preconditions", description: "Draft PR เปิดอยู่ในโหมดแก้ไข" },
        { type: "steps", description: "1. เข้าโหมดแก้ไข\n2. อัปเดต description\n3. บันทึก" },
        { type: "expected", description: "หลังบันทึก (toast สำเร็จ) เปิด PR ใหม่แล้วเห็น description ที่แก้" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const pr = new PurchaseRequestPage(page);
      const created = await createDraftPR(page);
      await page.goto(`${LIST_PATH}/${created.ref}`);
      await page.waitForLoadState("networkidle");
      await expect(pr.editModeButton(), "Edit button missing on the Draft detail").toBeVisible({ timeout: 10_000 });
      await pr.enterEditMode();
      const newDesc = e2eDescription("TC-PR-050502 edited");
      // The workflow of a saved draft is fixed; only the description is changed here.
      await pr.descriptionInput().fill(newDesc);
      await pr.saveEditMode();
      await page.goto(`${LIST_PATH}/${created.ref}`);
      await expect(page.getByText(newDesc).first(), "edited description was not persisted").toBeVisible({ timeout: 15_000 });
    },
  );

  requestorTest(
    "TC-PR-050503 Modify line item quantity in edit mode",
    {
      annotation: [
        { type: "preconditions", description: "Draft PR ที่มีรายการสินค้าอย่างน้อยหนึ่งรายการเปิดอยู่ในโหมดแก้ไข" },
        { type: "steps", description: "1. เข้าโหมดแก้ไข\n2. แก้ไขจำนวนรายการสินค้าแรก\n3. บันทึก" },
        { type: "expected", description: "หลังบันทึก (toast สำเร็จ) เปิด PR ใหม่แล้วจำนวนของรายการแรกเป็น 7" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const pr = new PurchaseRequestPage(page);
      const created = await createDraftPR(page, { items: 1 });
      await page.goto(`${LIST_PATH}/${created.ref}`);
      await page.waitForLoadState("networkidle");
      await expect(pr.editModeButton(), "Edit button missing on the Draft detail").toBeVisible({ timeout: 10_000 });
      await pr.enterEditMode();
      await pr.editLineItem(0, { quantity: 7 });
      // Pinned suspected bug (cluster: BE): saving a Draft whose line was edited makes
      // PATCH /purchase-requests/<id> answer 400 {"message":"Unknown argument `product_id`. Did you
      // mean `product_code`?"} — the update path of `details` rejects the payload FE mapItemToPayload
      // (pr-form-schema.ts:743) builds, while a header-only save (TC-PR-050505) is accepted.
      // Measured 2026-11-21 on dev API v4.0.13-build.20261112, 3/3 runs. Flips red once accepted.
      requestorTest.fail(true, "suspected bug: PATCH of a Draft with an edited line -> 400 'Unknown argument product_id' (BE details update path) - bisected by replaying PATCH .../save: a line carrying BOTH pricelist_detail_id:null AND is_tax_included fails, dropping either key gives 200; FE 76ec45e4 (2026-11-09) added is_tax_included to the payload, BE schema 1ac85b1ae (2026-11-09) has the column and dev runs build f529576a9 (2026-11-13), so this is not a not-yet-deployed change");
      await pr.saveEditMode();
      await page.goto(`${LIST_PATH}/${created.ref}`);
      await expect(page.locator("tbody tr").first().getByText(/7\.00/).first(), "saved quantity 7 is not shown").toBeVisible({ timeout: 15_000 });
    },
  );

  requestorTest(
    "TC-PR-050504 Add line item in edit mode",
    {
      annotation: [
        { type: "preconditions", description: "Draft PR เปิดอยู่ในโหมดแก้ไข" },
        { type: "steps", description: "1. เข้าโหมดแก้ไข\n2. คลิก Add Item\n3. กรอก product/qty/uom\n4. บันทึก" },
        { type: "expected", description: "หลังบันทึก (toast สำเร็จ) เปิด PR ใหม่แล้วมี 2 รายการ" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const pr = new PurchaseRequestPage(page);
      const created = await createDraftPR(page, { items: 1 });
      await page.goto(`${LIST_PATH}/${created.ref}`);
      await page.waitForLoadState("networkidle");
      await expect(pr.editModeButton(), "Edit button missing on the Draft detail").toBeVisible({ timeout: 10_000 });
      await pr.enterEditMode();
      await pr.addLineItem({ product: "Added in Edit", quantity: 2, uom: "ea", unitPrice: 50 });
      // Pinned suspected bug (cluster: BE): saving a Draft with a newly added line makes
      // PATCH /purchase-requests/<id> answer 400 {"message":"Argument `is_tax_included` is missing."}
      // although FE mapItemToPayload (pr-form-schema.ts:762) always sends is_tax_included. The
      // create path (POST) accepts the same row. Measured 2026-11-21 on dev API v4.0.13-build.20261112.
      // Flips red ("expected to fail but passed") once the update path accepts new lines.
      requestorTest.fail(true, "suspected bug: PATCH of a Draft with an added line -> 400 'Argument is_tax_included is missing' (BE update/add path) - bisected by replaying PATCH .../save: a line carrying BOTH pricelist_detail_id:null AND is_tax_included fails, dropping either key gives 200; FE 76ec45e4 (2026-11-09) added is_tax_included to the payload, BE schema 1ac85b1ae (2026-11-09) has the column and dev runs build f529576a9 (2026-11-13), so this is not a not-yet-deployed change");
      await pr.saveEditMode();
      await page.goto(`${LIST_PATH}/${created.ref}`);
      await expect(page.locator("tbody tr").filter({ has: page.getByRole("button", { name: /expand row/i }) }), "the added line was not persisted (expected 2 lines)").toHaveCount(2, { timeout: 15_000 });
    },
  );

  requestorTest(
    "TC-PR-050505 Save → exit edit mode + persist changes",
    {
      annotation: [
        { type: "preconditions", description: "Draft PR เปิดอยู่ในโหมดแก้ไขและมีการเปลี่ยนแปลงอย่างน้อยหนึ่งอย่าง" },
        { type: "steps", description: "1. เข้าโหมดแก้ไข\n2. ทำการเปลี่ยนแปลง\n3. คลิก Save" },
        { type: "expected", description: "ฟอร์มกลับสู่โหมดดู (ปุ่ม Edit แสดงผลอีกครั้งในหน้ารายละเอียด)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const pr = new PurchaseRequestPage(page);
      const created = await createDraftPR(page);
      await page.goto(`${LIST_PATH}/${created.ref}`);
      await page.waitForLoadState("networkidle");
      await expect(pr.editModeButton(), "Edit button missing on the Draft detail").toBeVisible({ timeout: 10_000 });
      await pr.enterEditMode();
      const persisted = e2eDescription("TC-PR-050505 persisted");
      await pr.descriptionInput().fill(persisted);
      await pr.saveEditMode();
      await expect(pr.editModeButton()).toBeVisible({ timeout: 10_000 });
      await page.goto(`${LIST_PATH}/${created.ref}`);
      await expect(page.getByText(persisted).first(), "saved description was not persisted").toBeVisible({ timeout: 15_000 });
    },
  );

  requestorTest(
    "TC-PR-050506 Cancel → discard changes, restore original",
    {
      annotation: [
        { type: "preconditions", description: "Draft PR เปิดอยู่ในโหมดแก้ไข" },
        { type: "steps", description: "1. เข้าโหมดแก้ไข\n2. พิมพ์ใน description\n3. คลิก Cancel" },
        { type: "expected", description: "ฟอร์มกลับสู่โหมดดู (ปุ่ม Edit แสดงผลอีกครั้งในหน้ารายละเอียด)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const pr = new PurchaseRequestPage(page);
      const created = await createDraftPR(page);
      await page.goto(`${LIST_PATH}/${created.ref}`);
      await page.waitForLoadState("networkidle");
      await expect(pr.editModeButton(), "Edit button missing on the Draft detail").toBeVisible({ timeout: 10_000 });
      await pr.enterEditMode();
      await pr.descriptionInput().fill("DISCARD ME");
      await pr.cancelEditMode();
      await expect(pr.editModeButton()).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText("DISCARD ME")).toHaveCount(0);
    },
  );
});

requestorTest.describe("Step 6 — Submit", () => {
  // Builds its own Draft PR per test — see the note on "Step 4 — PR Detail".
  requestorTest.describe.configure({ timeout: 90_000 });

  requestorTest(
    "TC-PR-050601 Submit → confirmation dialog appears",
    {
      annotation: [
        { type: "preconditions", description: "มี Draft PR ที่มีรายการสินค้า ≥1 รายการ" },
        { type: "steps", description: "1. เปิด Draft PR\n2. คลิก Submit" },
        { type: "expected", description: "dialog ยืนยันแสดงผล" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page }) => {
      const pr = new PurchaseRequestPage(page);
      const created = await createDraftPR(page, { items: 1 });
      await page.goto(`${LIST_PATH}/${created.ref}`);
      await page.waitForLoadState("networkidle");
      const submit = pr.submitButton();
      await expect(submit, "Submit button missing on the Draft detail").toBeVisible({ timeout: 10_000 });
      await submit.click({ timeout: 5_000 });
      await expect(page.getByRole("alertdialog")).toBeVisible({ timeout: 10_000 });
    },
  );

  requestorTest(
    "TC-PR-050602 Cancel submit → stays on Draft",
    {
      annotation: [
        { type: "preconditions", description: "dialog ยืนยัน submit เปิดอยู่" },
        { type: "steps", description: "1. เปิด dialog Submit\n2. คลิก Cancel" },
        { type: "expected", description: "dialog ปิด; URL ยังคงอยู่ที่หน้ารายละเอียด (ไม่มีการเปลี่ยนสถานะ submit)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const pr = new PurchaseRequestPage(page);
      const created = await createDraftPR(page, { items: 1 });
      await page.goto(`${LIST_PATH}/${created.ref}`);
      await page.waitForLoadState("networkidle");
      const submit = pr.submitButton();
      await expect(submit, "Submit button missing on the Draft detail").toBeVisible({ timeout: 10_000 });
      await submit.click({ timeout: 5_000 });
      const cancel = page.getByRole("alertdialog").getByRole("button", { name: /cancel|no/i }).first();
      await expect(cancel, "confirm dialog has no Cancel button").toBeVisible({ timeout: 5_000 });
      await cancel.click({ timeout: 5_000 });
      await expect(page.getByRole("alertdialog")).toBeHidden({ timeout: 5_000 });
      await expect(page).toHaveURL(new RegExp(`${LIST_PATH}/${created.ref}`), { timeout: 10_000 });
      await expect(pr.editModeButton(), "Draft changed after cancelling").toBeVisible({ timeout: 10_000 });
    },
  );

  requestorTest(
    "TC-PR-050603 Confirm submit → status moves to In Progress",
    {
      annotation: [
        { type: "preconditions", description: "dialog ยืนยัน submit เปิดอยู่" },
        { type: "steps", description: "1. เปิด dialog Submit\n2. คลิก Confirm" },
        { type: "expected", description: "badge สถานะอัปเดตเป็น In Progress (ยืนยันโดย submitDraftPR helper)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const pr = new PurchaseRequestPage(page);
      const created = await createDraftPR(page, { items: 1 });
      await submitDraftPR(page, created.ref);
      // submitDraftPR only waits for the redirect to the list; read the status off the record itself.
      await page.goto(`${LIST_PATH}/${created.ref}`);
      await expect(pr.statusBadge(), "submitted PR is not In progress").toContainText(/in progress/i, { timeout: 15_000 });
    },
  );

  requestorTest(
    "TC-PR-050604 Submit empty PR — button disabled or no transition",
    {
      annotation: [
        { type: "preconditions", description: "มี Draft PR ที่ไม่มีรายการสินค้า" },
        { type: "steps", description: "1. เปิด Draft PR ที่ไม่มีรายการสินค้า\n2. ตรวจสอบปุ่ม Submit" },
        { type: "expected", description: "ปุ่ม Submit ถูก disabled หรือการคลิกไม่เปลี่ยนสถานะเป็น In Progress (URL ยังคงอยู่ที่หน้ารายละเอียด)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Validation" },
      ],
    },
    async ({ page }) => {
      const pr = new PurchaseRequestPage(page);
      // An empty PR (header only, no line items) cannot be saved in the redesign,
      // so it can never reach the submit step. Assert Save is blocked: either the
      // button is disabled, or clicking it does not create/redirect (stays on /new).
      await pr.gotoNew();
      await pr.fillHeader({ description: e2eDescription("TC-PR-050604 empty") });
      const save = pr.saveDraftButton();
      if (await save.isEnabled()) {
        await save.click({ timeout: 5_000 });
        await expect(pr.anyError().first().or(page.locator("[data-sonner-toast]").first()), "no validation message after saving an empty PR").toBeVisible({ timeout: 10_000 });
      }
      await expect(page).toHaveURL(/purchase-request\/new/, { timeout: 8_000 });
    },
  );
});

requestorTest.describe("Step 8 — Delete", () => {
  // Builds its own Draft PR per test — see the note on "Step 4 — PR Detail".
  requestorTest.describe.configure({ timeout: 90_000 });

  requestorTest(
    "TC-PR-050801 Click Delete → confirmation dialog",
    {
      annotation: [
        { type: "preconditions", description: "มี Draft PR ของ Requestor นี้" },
        { type: "steps", description: "1. เปิด Draft PR\n2. คลิก Delete" },
        { type: "expected", description: "dialog ยืนยันการลบแสดงผล" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page }) => {
      const pr = new PurchaseRequestPage(page);
      const created = await createDraftPR(page);
      await page.goto(`${LIST_PATH}/${created.ref}`);
      await page.waitForLoadState("networkidle");
      const del = pr.deleteButton();
      await expect(del, "Delete button missing on the Draft detail").toBeVisible({ timeout: 10_000 });
      await del.click({ timeout: 5_000 });
      await expect(page.getByRole("alertdialog")).toBeVisible({ timeout: 10_000 });
    },
  );

  requestorTest(
    "TC-PR-050802 Cancel delete → PR remains",
    {
      annotation: [
        { type: "preconditions", description: "dialog ยืนยันการลบเปิดอยู่" },
        { type: "steps", description: "1. เปิด dialog Delete\n2. คลิก Cancel" },
        { type: "expected", description: "dialog ปิด; URL ยังคงอยู่ที่หน้ารายละเอียด (PR ไม่ถูกลบ)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const pr = new PurchaseRequestPage(page);
      const created = await createDraftPR(page);
      await page.goto(`${LIST_PATH}/${created.ref}`);
      await page.waitForLoadState("networkidle");
      const del = pr.deleteButton();
      await expect(del, "Delete button missing on the Draft detail").toBeVisible({ timeout: 10_000 });
      await del.click({ timeout: 5_000 });
      const cancel = page.getByRole("alertdialog").getByRole("button", { name: /cancel|no/i }).first();
      await expect(cancel, "confirm dialog has no Cancel button").toBeVisible({ timeout: 5_000 });
      await cancel.click({ timeout: 5_000 });
      await expect(page.getByRole("alertdialog")).toBeHidden({ timeout: 5_000 });
      await expect(page).toHaveURL(new RegExp(`${LIST_PATH}/${created.ref}`), { timeout: 10_000 });
      await expect(pr.editModeButton(), "Draft changed after cancelling").toBeVisible({ timeout: 10_000 });
    },
  );

  requestorTest(
    "TC-PR-050803 Confirm delete → list refreshed, PR gone",
    {
      annotation: [
        { type: "preconditions", description: "dialog ยืนยันการลบเปิดอยู่" },
        { type: "steps", description: "1. เปิด dialog Delete\n2. คลิก Confirm" },
        { type: "expected", description: "หน้านำทางกลับไปที่ PR list และ backend ไม่พบ PR ใบนั้นอีก (GET ตอบ 404)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const created = await createDraftPR(page);
      await deleteDraftPR(page, created.ref);
      // deleteDraftPR uses lenient waitForURL; assert hard here that list URL is current.
      await expect(page).toHaveURL(/\/procurement\/purchase-request($|\?)/, { timeout: 10_000 });
      await expect.poll(async () => (await buGet("Requestor", `/purchase-requests/${created.ref}`)).status, { message: "the deleted PR is still readable", timeout: 10_000 }).toBe(404);
    },
  );
});

requestorTest.describe.serial("Golden Journey", () => {
  // Builds its own Draft PR per test — see the note on "Step 4 — PR Detail".
  requestorTest.describe.configure({ timeout: 90_000 });

  requestorTest(
    "TC-PR-050901 Full Creator flow: List → Create → Save Draft → Edit → Submit → In Progress",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Requestor; อยู่ที่หน้า PR list" },
        { type: "steps", description: "1. เปิด list\n2. คลิก New PR (Blank)\n3. กรอก header + รายการสินค้า 1 รายการ\n4. บันทึกเป็น Draft\n5. เปิดหน้ารายละเอียดและคลิก Edit\n6. แก้ไข description\n7. บันทึก\n8. คลิก Submit และ confirm" },
        { type: "expected", description: "PR ถูกสร้าง (detail URL พร้อม ref), แก้ไขแล้ว (ปุ่ม Edit แสดงผลอีกครั้งหลังบันทึก), submit แล้ว (badge สถานะแสดง In Progress)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page }) => {
      const pr = new PurchaseRequestPage(page);

      // Step 1-4: List → Create → Items → Save Draft (helper does the heavy lifting)
      const created = await createDraftPR(page, { items: 1, description: "TC-PR-050901 golden" });
      await expect(page).toHaveURL(new RegExp(`${LIST_PATH}/${created.ref}`), { timeout: 10_000 });

      // Step 5-7: Edit description and save
      await page.goto(`${LIST_PATH}/${created.ref}`);
      await page.waitForLoadState("networkidle");
      await expect(pr.editModeButton(), "Edit button missing on the Draft detail").toBeVisible({ timeout: 10_000 });
      await pr.enterEditMode();
      await pr.descriptionInput().fill(e2eDescription("TC-PR-050901 edited golden"));
      await pr.saveEditMode();
      await expect(pr.editModeButton()).toBeVisible({ timeout: 10_000 });

      // Step 8: Submit (helper asserts In Progress at the end)
      await submitDraftPR(page, created.ref);
    },
  );
});
