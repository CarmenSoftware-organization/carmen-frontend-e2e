import { expect, type Page } from "@playwright/test";
import { createAuthTest } from "./fixtures/auth.fixture";
import { StoreRequisitionPage, LIST_PATH, NEW_PATH } from "./pages/store-requisition.page";
import { recordRows } from "./helpers/list-row";
import { buGet, buSend, rootGet } from "./helpers/bu-api";
import { createDraftSr, disposeSr, getSr, seedSr, srSeedContext, touchDraftSr, type SeededSr } from "./helpers/sr-api";
import { BU_CODE } from "./test-users";

// ─────────────────────────────────────────────────────────────────────────
// Store Requisition. Every case that needs a document in a given stage creates its own SR through
// the API (helpers/sr-api.ts: Purchase runs Create Request / Store Approval / Issue) and disposes
// of it in `finally`, so no case depends on the seeded SRs or on queue order.
//
// Approve / reject / send back / issue is two-step: Edit -> tick the item rows -> the Items toolbar
// marks them (Approve / Reject / Send Back), then the footer button decides the document
// (FE routes/store-operation/store-requisition: sr-item-fields.tsx, sr-footer.tsx, use-sr-form-actions.ts).
//
// Purchase = requestor + approver + issuer of the seeded SR workflow. requestor@ only holds
// store_requisition.view (checked in /api/user/profile) and sees only SRs it raised itself;
// hod@ holds view + view_department (same department as Purchase) so it can open Purchase's SRs read-only.
// requestor declared LAST so doc default role reads "Purchase".
// ─────────────────────────────────────────────────────────────────────────
const hodTest = createAuthTest("carmensoftware.dev+hod@gmail.com");
const requestorTest = createAuthTest("carmensoftware.dev+requestor@gmail.com");
const purchaseTest = createAuthTest("carmensoftware.dev+purchase@gmail.com");

const BIG = { width: 1920, height: 1080 };
const unique = (tag: string) => `E2E 701 ${tag} ${Date.now()}`;
const lines = (doc: any): any[] => doc.store_requisition_detail;

/** Open an SR's detail page and wait until its number is in the header. */
async function openSr(page: Page, sr: SeededSr) {
  await page.setViewportSize(BIG);
  await page.goto(`${LIST_PATH}/${sr.id}`);
  await expect(page.getByRole("heading", { level: 1, name: sr.sr_no })).toBeVisible({ timeout: 30_000 });
}

/** Run `fn` with an SR at `stage`, disposing it afterwards whatever happens. */
async function withSeeded<T>(stage: "draft" | "approval" | "issue" | "completed", fn: (sr: SeededSr) => Promise<T>, opts: { products?: number; qty?: number } = {}): Promise<T> {
  const sr = await seedSr(stage, opts);
  try {
    return await fn(sr);
  } finally {
    await disposeSr(sr.id);
  }
}

/** Fill the new-document header (workflow + both locations) with the seed pair. */
async function fillNewHeader(sr: StoreRequisitionPage, description: string) {
  const c = await srSeedContext();
  await sr.pickWorkflow(/store requisition/i);
  await sr.pickLocation(/^Request From/, c.from_location.code);
  await sr.pickLocation(/^Deliver To/, c.to_location.code);
  await sr.descriptionInput().fill(description);
  return c;
}

/** Add one item row to the open form. */
async function addItem(sr: StoreRequisitionPage, code: string, qty: string) {
  // the product scope (workflow + both locations) loads in the background; adding a row before it is
  // ready would open the "Can't add items yet" dialog instead of a row
  await sr.waitSettled();
  await sr.addItemButton().click();
  const row = sr.itemRows().first();
  await expect(sr.selectProductButton(row)).toBeVisible({ timeout: 15_000 });
  await sr.pickProduct(row, code);
  await sr.qtySpinbutton(row).fill(qty);
  return row;
}

/** The SR a UI-created document landed on (the page navigates to /<id> after Save). */
async function idFromUrl(page: Page): Promise<string> {
  await expect(page).toHaveURL(new RegExp(`${LIST_PATH}/[0-9a-f-]{36}$`), { timeout: 30_000 });
  return page.url().split("/").pop()!;
}

/** Descriptions of every SR of the TEST BU (the cross-BU list, filtered to this BU). */
async function allDescriptions(): Promise<string[]> {
  const all = await rootGet("Purchase", `/store-requisitions?perpage=100&bu_code=${BU_CODE}`);
  expect(all.status).toBe(200);
  return (all.body.data.find((b: any) => b.bu_code === BU_CODE).data as any[]).map((r) => r.description);
}

const toasts = (page: Page) => page.locator("[data-sonner-toast]");

// ═════════════════════════════════════════════════════════════════════════
// Create
// ═════════════════════════════════════════════════════════════════════════
purchaseTest.describe("Store Requisition — Create", () => {
  purchaseTest.describe.configure({ timeout: 120_000 });

  purchaseTest(
    "TC-SR-010001 Happy Path - Create Store Requisition",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase (มีแผนกและ workflow Store Requisition ที่เริ่มได้); active BU = TEST BU; คลัง 1AG01 → 1AG02 และสินค้าตัวแรกอยู่ในคู่คลังนี้" },
        { type: "steps", description: "1. เปิด /store-operation/store-requisition/new\n2. เลือก Workflow, Request From (1AG01) และ Deliver To (1AG02)\n3. กรอก Description\n4. กด Add Item เลือกสินค้าและใส่ Requested = 3\n5. กด Save" },
        { type: "expected", description: "ระบบสร้าง SR สถานะ Draft และพาไปหน้ารายละเอียดของใบใหม่; API คืนใบ draft ที่มี Description, คลังต้นทาง/ปลายทางและรายการสินค้า 3 หน่วยตามที่กรอก" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const sr = new StoreRequisitionPage(page);
      const description = unique("create");
      let id: string | undefined;
      try {
        await page.setViewportSize(BIG);
        await sr.gotoNew();
        const c = await fillNewHeader(sr, description);
        await addItem(sr, c.products[0].code, "3");
        await sr.saveAsDraftButton().click();
        id = await idFromUrl(page);
        await expect(page.getByRole("heading", { level: 1 })).toContainText(/DRAFT-\d{8}/);
        await expect(page.getByText("Draft", { exact: true }).first()).toBeVisible();
        const doc = await getSr(id);
        expect(doc.doc_status).toBe("draft");
        expect(doc.description).toBe(description);
        expect(doc.from_location.id).toBe(c.from_location.id);
        expect(doc.to_location.id).toBe(c.to_location.id);
        expect(lines(doc)).toHaveLength(1);
        expect(lines(doc)[0].product.id).toBe(c.products[0].id);
        expect(Number(lines(doc)[0].requested_qty)).toBe(3);
      } finally {
        if (id) await disposeSr(id);
      }
    },
  );

  // The profile always carries a department for every TEST BU role (checked in /api/user/profile),
  // so the "no department" state cannot be produced by the dataset; only the profile response is rewritten.
  requestorTest(
    "TC-SR-010002 Negative - User Not Assigned to Department",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Requestor; โปรไฟล์ของผู้ใช้ไม่มีแผนก (ทุก role ใน TEST BU มีแผนก จึงจำลองโดยแก้ response ของ /api/user/profile ให้ department = null)" },
        { type: "steps", description: "1. เปิด /store-operation/store-requisition/new" },
        { type: "expected", description: "แสดง toast เตือน 'Your profile does not have a department assigned…' และปุ่ม Save ถูก disable (title บอกเหตุผลเดียวกัน)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      await page.route("**/api/user/profile", async (route) => {
        const res = await route.fetch();
        const json = await res.json();
        for (const bu of json.data.business_unit) bu.department = null;
        await route.fulfill({ response: res, json });
      });
      const sr = new StoreRequisitionPage(page);
      await sr.gotoNew();
      await expect(toasts(page).filter({ hasText: /does not have a department assigned/i }).first()).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTitle(/does not have a department assigned/i)).toBeDisabled();
    },
  );


  purchaseTest(
    "TC-SR-010004 Negative - Invalid Input - Missing Expected Delivery Date",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase; ฟอร์ม New กรอก Workflow, คลังทั้งสอง และรายการสินค้าครบแล้ว" },
        { type: "steps", description: "1. เปิด /store-operation/store-requisition/new และกรอกฟอร์มให้ครบ\n2. กด Clear ที่ Expected Delivery\n3. กด Save" },
        { type: "expected", description: "การบันทึกฉบับร่างไม่ผ่าน zod ฝั่ง FE จึงเป็น backend ที่ตอบ 400 ชี้ field details.expected_date และแสดง toast 'Some fields aren't filled in correctly'; ไม่มี SR ใหม่ถูกสร้าง (ยังอยู่ที่หน้า /new และ API ไม่มีใบที่ใช้ Description นี้)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const sr = new StoreRequisitionPage(page);
      const description = unique("nodate");
      await page.setViewportSize(BIG);
      await sr.gotoNew();
      const c = await fillNewHeader(sr, description);
      await addItem(sr, c.products[0].code, "2");
      await sr.headerGroup(/^Expected Delivery/).getByRole("button", { name: "Clear" }).click();
      const rejected = page.waitForResponse((r) => /\/store-requisitions$/.test(r.url()) && r.request().method() === "POST");
      await sr.saveAsDraftButton().click();
      const res = await rejected;
      expect(res.status()).toBe(400);
      expect(JSON.stringify(await res.json())).toContain("details.expected_date");
      await expect(toasts(page).filter({ hasText: /some fields aren't filled in correctly/i }).first()).toBeVisible({ timeout: 15_000 });
      await expect(page).toHaveURL(new RegExp(`${NEW_PATH}$`));
      expect(await allDescriptions()).not.toContain(description);
    },
  );

  purchaseTest(
    "TC-SR-010006 Alternate Flow - Quick Create by Duplicating an Existing Requisition",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase; มี SR ที่ส่งแล้ว 1 ใบ (สร้างผ่าน API ใน test) — หน้า SR ไม่มี template จึงใช้ Duplicate เป็นทางลัดสร้างใบใหม่" },
        { type: "steps", description: "1. เปิดรายละเอียด SR ที่ส่งแล้ว\n2. กด Duplicate\n3. ตรวจฟอร์ม New ที่เติมคลังและรายการจากใบเดิม\n4. กด Save" },
        { type: "expected", description: "ฟอร์ม New ถูกเติมด้วยคลังและสินค้าจากใบเดิม; หลัง Save ได้ SR ใหม่สถานะ Draft ที่มีสินค้า/จำนวนเท่าใบเดิม และเป็นคนละใบกัน" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Alternate Flow" },
      ],
    },
    async ({ page }) => {
      await withSeeded("approval", async (src) => {
        const srDoc = await getSr(src.id);
        let copyId: string | undefined;
        try {
          await openSr(page, src);
          await page.waitForLoadState("networkidle");
          await page.getByRole("button", { name: "Duplicate" }).click();
          await expect(page).toHaveURL(new RegExp(`${NEW_PATH}\\?duplicate_id=${src.id}`));
          const sr = new StoreRequisitionPage(page);
          await expect(sr.locationPicker(/^Request From/)).toContainText(srDoc.from_location.code);
          await expect(sr.locationPicker(/^Deliver To/)).toContainText(srDoc.to_location.code);
          for (const l of lines(srDoc)) await expect(sr.itemRowByProduct(l.product.name)).toBeVisible();
          await sr.saveAsDraftButton().click();
          copyId = await idFromUrl(page);
          expect(copyId).not.toBe(src.id);
          const copy = await getSr(copyId);
          expect(copy.doc_status).toBe("draft");
          const shape = (doc: any) => lines(doc).map((l) => `${l.product.id}:${Number(l.requested_qty)}`).sort();
          expect(shape(copy)).toEqual(shape(srDoc));
        } finally {
          if (copyId) await disposeSr(copyId);
        }
      });
    },
  );

  purchaseTest(
    "TC-SR-010007 Edge Case - Add Item Blocked Until Workflow and Locations Are Chosen",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase; เปิดฟอร์ม New ที่ยังไม่ได้เลือก Workflow และคลัง" },
        { type: "steps", description: "1. เปิด /store-operation/store-requisition/new\n2. กด Add Item โดยยังไม่เลือก Workflow / Request From / Deliver To" },
        { type: "expected", description: "ขึ้นกล่อง \"Can't add items yet\" บอกให้เลือก workflow, คลังต้นทางและปลายทางก่อน และตารางรายการยังว่าง (ไม่มีแถวใหม่)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      const sr = new StoreRequisitionPage(page);
      await sr.gotoNew();
      await sr.addItemButton().click();
      const dialog = sr.actionDialog();
      await expect(dialog.getByRole("heading", { name: "Can't add items yet" })).toBeVisible();
      await expect(dialog).toContainText(/fill in the workflow, the store you are requesting from, and the destination store first/i);
      await dialog.getByRole("button", { name: "Close" }).click();
      await expect(sr.itemsPanel().getByText("No Items Yet")).toBeVisible();
      await expect(sr.itemsPanel().getByRole("button", { name: /select product/i })).toHaveCount(0);
    },
  );

});

// ═════════════════════════════════════════════════════════════════════════
// Add items
// ═════════════════════════════════════════════════════════════════════════
purchaseTest.describe("Store Requisition — Add Items", () => {
  purchaseTest.describe.configure({ timeout: 120_000 });

  purchaseTest(
    "TC-SR-020001 Happy Path - Add Single Item",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase; มี SR สถานะ Draft ที่มีสินค้า 1 รายการ (สร้างผ่าน API ใน test)" },
        { type: "steps", description: "1. เปิดรายละเอียด SR Draft แล้วกด Edit\n2. กด Add Item\n3. เลือกสินค้าตัวที่สองและใส่ Requested = 2\n4. กด Save" },
        { type: "expected", description: "SR มีสินค้า 2 รายการ — สินค้าที่เพิ่มพร้อมจำนวน 2 ถูกบันทึก (ตรวจจาก API) และตารางแสดงสินค้านั้น" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const c = await srSeedContext();
      const draft = await createDraftSr({ products: 1 });
      try {
        const sr = new StoreRequisitionPage(page);
        await openSr(page, draft);
        await sr.editButton().click();
        await sr.addItemButton().click();
        const row = sr.itemRows().first();
        await sr.pickProduct(row, c.products[1].code);
        await sr.qtySpinbutton(row).fill("2");
        await sr.saveAsDraftButton().click();
        await expect(page.getByText(/updated successfully/i).first()).toBeVisible({ timeout: 20_000 });
        const doc = await getSr(draft.id);
        expect(lines(doc)).toHaveLength(2);
        const added = lines(doc).find((l) => l.product.id === c.products[1].id);
        expect(Number(added.requested_qty)).toBe(2);
        await expect(sr.itemRowByProduct(c.products[1].name)).toBeVisible();
      } finally {
        await disposeSr(draft.id);
      }
    },
  );

  purchaseTest(
    "TC-SR-020002 Negative - Invalid Quantity",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase; ฟอร์ม New กรอก Workflow, คลังทั้งสอง และเลือกสินค้าแล้ว" },
        { type: "steps", description: "1. เปิด /store-operation/store-requisition/new และเลือกสินค้า\n2. ใส่ Requested = -1\n3. กด Submit" },
        { type: "expected", description: "ฟอร์มไม่ผ่านการตรวจ: toast เตือนว่ากรอกไม่ครบ/ไม่ถูกต้อง, ไม่ขึ้นกล่องยืนยันการส่ง และไม่มี SR ใหม่ถูกสร้าง" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const sr = new StoreRequisitionPage(page);
      const description = unique("badqty");
      await page.setViewportSize(BIG);
      await sr.gotoNew();
      const c = await fillNewHeader(sr, description);
      await addItem(sr, c.products[0].code, "-1");
      await sr.footerAction("Submit").click();
      await expect(toasts(page).filter({ hasText: /fields|incomplete|correct|missing/i }).first()).toBeVisible({ timeout: 15_000 });
      await expect(sr.actionDialog()).toHaveCount(0);
      await expect(page).toHaveURL(new RegExp(`${NEW_PATH}$`));
      expect(await allDescriptions()).not.toContain(description);
    },
  );
});

// ═════════════════════════════════════════════════════════════════════════
// Inventory information per item
// ═════════════════════════════════════════════════════════════════════════
purchaseTest.describe("Store Requisition — Real-time Inventory", () => {
  purchaseTest.describe.configure({ timeout: 120_000 });

  purchaseTest(
    "TC-SR-030001 Happy Path - Sufficient Inventory",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase; มี SR Draft ที่มีสินค้าที่มี stock ในคลังปลายทาง (data:reset ลง stock ให้สินค้าชุดนี้)" },
        { type: "steps", description: "1. เปิดรายละเอียด SR Draft\n2. กดปุ่ม Inventory Information ที่แถวสินค้า" },
        { type: "expected", description: "กล่อง Inventory Information แสดงชื่อสินค้า และช่อง On Hand แสดงยอดคงเหลือที่คลังปลายทาง (Deliver To) เท่ากับ GET /inventory-info/{productId}/{locationId}" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const c = await srSeedContext();
      const draft = await createDraftSr({ products: 1 });
      try {
        const sr = new StoreRequisitionPage(page);
        const api = await buGet("Purchase", `/inventory-info/${c.products[0].id}/${c.to_location.id}`);
        expect(api.status).toBe(200);
        const there = api.body.data;
        expect(Number(there.on_hand_qty), "seed product has stock at the destination location").toBeGreaterThan(0);
        await openSr(page, draft);
        await sr.inventoryInfoButton(sr.itemRows().first()).click();
        const dialog = page.getByRole("dialog", { name: "Inventory Information" });
        await expect(dialog).toContainText(c.products[0].name);
        await expect(dialog.getByRole("button", { name: "On Hand" }).locator("xpath=following-sibling::*[1]")).toContainText(`${Number(there.on_hand_qty)} KG`);
      } finally {
        await disposeSr(draft.id);
      }
    },
  );

  // The dataset has stock for every product the SR picker offers, so "no inventory records" cannot be
  // produced with real data; only the inventory-info response is replaced with zero balances.
  purchaseTest(
    "TC-SR-030003 Edge Case - No Inventory Records",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase; มี SR Draft; สินค้าไม่มียอด stock ที่คลังปลายทาง (จำลองโดยแทน response ของ /inventory-info/{productId}/{locationId} ด้วยยอดศูนย์ เพราะ dataset มี stock ครบทุกสินค้า)" },
        { type: "steps", description: "1. เปิดรายละเอียด SR Draft\n2. กดปุ่ม Inventory Information ที่แถวสินค้า" },
        { type: "expected", description: "กล่อง Inventory Information แสดงชื่อสินค้า โดย On Hand เป็น 0 KG และ Stock Level 0.0%" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      const c = await srSeedContext();
      const draft = await createDraftSr({ products: 1 });
      try {
        await page.route("**/inventory-info/*/*", async (route) => {
          await route.fulfill({
            json: { data: { on_hand_qty: 0, on_order_qty: 0, re_order_qty: 0, re_stock_qty: 0, inventory_unit_name: "KG", on_order: [] } },
          });
        });
        const sr = new StoreRequisitionPage(page);
        await openSr(page, draft);
        await sr.inventoryInfoButton(sr.itemRows().first()).click();
        const dialog = page.getByRole("dialog", { name: "Inventory Information" });
        await expect(dialog).toContainText(c.products[0].name);
        await expect(dialog.getByRole("button", { name: "On Hand" }).locator("xpath=following-sibling::*[1]")).toContainText("0 KG");
        await expect(dialog.getByText(/stock level: 0\.0%/i)).toBeVisible();
      } finally {
        await disposeSr(draft.id);
      }
    },
  );
});

// ═════════════════════════════════════════════════════════════════════════
// Save
// ═════════════════════════════════════════════════════════════════════════
purchaseTest.describe("Store Requisition — Save", () => {
  purchaseTest.describe.configure({ timeout: 120_000 });

  purchaseTest(
    "TC-SR-040001 Save as Draft with Valid Input",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase; มี SR Draft (สร้างผ่าน API ใน test) ที่ Requested = 5" },
        { type: "steps", description: "1. เปิดรายละเอียด SR Draft แล้วกด Edit\n2. แก้ Description และ Requested เป็น 7\n3. กด Save" },
        { type: "expected", description: "แสดง toast อัปเดตสำเร็จ; SR ยังเป็น Draft และ API เก็บ Description กับจำนวน 7 ตามที่แก้" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const draft = await createDraftSr({ products: 1 });
      try {
        const sr = new StoreRequisitionPage(page);
        const description = unique("saved");
        await openSr(page, draft);
        await sr.editButton().click();
        await sr.descriptionInput().fill(description);
        await sr.qtySpinbutton(sr.itemRows().first()).fill("7");
        await sr.saveAsDraftButton().click();
        await expect(page.getByText(/updated successfully/i).first()).toBeVisible({ timeout: 20_000 });
        const doc = await getSr(draft.id);
        expect(doc.doc_status).toBe("draft");
        expect(doc.description).toBe(description);
        expect(Number(lines(doc)[0].requested_qty)).toBe(7);
      } finally {
        await disposeSr(draft.id);
      }
    },
  );

  // The backend failure cannot be produced on demand; only the create POST is answered with a 500.
  purchaseTest(
    "TC-SR-040005 Save Failure due to Network/Database Issue",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase; ฟอร์ม New กรอกครบ; การสร้างล้มเหลวฝั่ง server (จำลองด้วยการตอบ POST /store-requisitions เป็น 500)" },
        { type: "steps", description: "1. เปิดฟอร์ม New และกรอก Workflow, คลัง, Description, สินค้า\n2. กด Save" },
        { type: "expected", description: "แสดง error toast, ยังอยู่ที่หน้า /new โดยข้อมูลที่กรอก (Description, สินค้า, จำนวน) ยังอยู่ครบ และไม่มี SR ถูกสร้างจริง" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const sr = new StoreRequisitionPage(page);
      const description = unique("fail");
      await page.route(/\/store-requisitions$/, async (route) => {
        if (route.request().method() !== "POST") return route.continue();
        await route.fulfill({ status: 500, json: { success: false, status: 500, message: "Internal server error" } });
      });
      await page.setViewportSize(BIG);
      await sr.gotoNew();
      const c = await fillNewHeader(sr, description);
      const row = await addItem(sr, c.products[0].code, "4");
      await sr.saveAsDraftButton().click();
      await expect(toasts(page).first()).toBeVisible({ timeout: 15_000 });
      await expect(page).toHaveURL(new RegExp(`${NEW_PATH}$`));
      await expect(sr.descriptionInput()).toHaveValue(description);
      await expect(row).toContainText(c.products[0].name);
      await expect(sr.qtySpinbutton(row)).toHaveValue("4");
      expect(await allDescriptions()).not.toContain(description);
    },
  );
});

// ═════════════════════════════════════════════════════════════════════════
// Submit
// ═════════════════════════════════════════════════════════════════════════
purchaseTest.describe("Store Requisition — Submit", () => {
  purchaseTest.describe.configure({ timeout: 120_000 });

  purchaseTest(
    "TC-SR-050001 Submit approved requisition with valid items",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase; มี SR Draft ที่มีสินค้า 2 รายการ (สร้างผ่าน API ใน test)" },
        { type: "steps", description: "1. เปิดรายละเอียด SR Draft\n2. กด Submit ที่แถบล่าง\n3. กด Submit ในกล่องยืนยัน" },
        { type: "expected", description: "แสดง toast 'Store requisition submitted' แล้วกลับหน้า list; SR เปลี่ยนเป็น In Progress ที่ขั้น Store Approval (ตรวจจาก API) โดยไม่มี error" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const draft = await createDraftSr();
      try {
        const sr = new StoreRequisitionPage(page);
        await openSr(page, draft);
        await sr.footerAction("Submit").click();
        const dialog = sr.actionDialog();
        await expect(dialog.getByRole("heading", { name: "Submit Store Requisition" })).toBeVisible();
        await dialog.getByRole("button", { name: "Submit", exact: true }).click();
        await expect(toasts(page).filter({ hasText: "Store requisition submitted" })).toBeVisible({ timeout: 30_000 });
        const doc = await getSr(draft.id);
        expect(doc.doc_status).toBe("in_progress");
        expect(doc.workflow_current_stage).toBe("Store Approval");
      } finally {
        await disposeSr(draft.id);
      }
    },
  );

  purchaseTest(
    "TC-SR-050002 Submit requisition with missing destination locations",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase; มี SR Draft (สร้างผ่าน API ใน test) ที่เปิดแก้ไขแล้วเปลี่ยน Request From เป็นคลังปลายทางเดิม ซึ่งทำให้ Deliver To และสินค้าถูกล้าง" },
        { type: "steps", description: "1. เปิดรายละเอียด SR Draft แล้วกด Edit\n2. เปลี่ยน Request From เป็น 1AG02 (คลังเดียวกับ Deliver To)\n3. กด Submit" },
        { type: "expected", description: "การส่งถูกปฏิเสธฝั่งฟอร์ม: ช่อง Deliver To แสดง error, toast เตือนว่ากรอกไม่ครบ, ไม่ขึ้นกล่องยืนยัน และ SR ยังเป็น Draft ใน API" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const c = await srSeedContext();
      const draft = await createDraftSr();
      try {
        const sr = new StoreRequisitionPage(page);
        await openSr(page, draft);
        await sr.editButton().click();
        await sr.pickLocation(/^Request From/, c.to_location.code);
        await expect(sr.locationPicker(/^Deliver To/)).toContainText(/select location/i);
        await sr.footerAction("Submit").click();
        await expect(toasts(page).filter({ hasText: /fields|incomplete|correct|missing/i }).first()).toBeVisible({ timeout: 15_000 });
        await expect(sr.actionDialog()).toHaveCount(0);
        expect((await getSr(draft.id)).doc_status).toBe("draft");
      } finally {
        await disposeSr(draft.id);
      }
    },
  );

  purchaseTest(
    "TC-SR-050003 Submit requisition with empty line items",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase; ฟอร์ม New กรอก Workflow และคลังทั้งสองแล้ว แต่ยังไม่มีรายการสินค้า" },
        { type: "steps", description: "1. เปิด /store-operation/store-requisition/new และเลือก Workflow กับคลัง\n2. กด Submit" },
        { type: "expected", description: "ไม่ขึ้นกล่องยืนยัน มี toast เตือนว่ากรอกไม่ครบ ระบบเติมแถวสินค้าเปล่าให้กรอก และไม่มี SR ใหม่ถูกสร้าง" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const sr = new StoreRequisitionPage(page);
      const description = unique("noitems");
      await page.setViewportSize(BIG);
      await sr.gotoNew();
      await fillNewHeader(sr, description);
      await sr.footerAction("Submit").click();
      await expect(toasts(page).filter({ hasText: /incomplete|fields|correct|at least|missing/i }).first()).toBeVisible({ timeout: 15_000 });
      await expect(sr.actionDialog()).toHaveCount(0);
      await expect(sr.itemsPanel().getByRole("button", { name: /select product/i })).toHaveCount(1);
      await expect(page).toHaveURL(new RegExp(`${NEW_PATH}$`));
      expect(await allDescriptions()).not.toContain(description);
    },
  );

  requestorTest(
    "TC-SR-050004 Submit requisition as an unauthorized user",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Requestor (มีแค่สิทธิ์ view และไม่ใช่ผู้สร้างใบ); มี SR Draft ที่ Purchase สร้างไว้ (สร้างผ่าน API ใน test)" },
        { type: "steps", description: "1. เปิดรายละเอียด SR ของ Purchase ตรง ๆ ด้วย URL\n2. ส่ง PATCH /store-requisitions/{id}/submit ในชื่อ Requestor" },
        { type: "expected", description: "หน้าไม่แสดงเอกสาร (error state ไม่มีปุ่ม Submit); API ปฏิเสธการ submit (4xx ไม่ใช่ 2xx) และ SR ยังเป็น Draft" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const draft = await createDraftSr();
      try {
        await page.setViewportSize(BIG);
        await page.goto(`${LIST_PATH}/${draft.id}`);
        await expect(page.getByText(/something went wrong|not found/i).first()).toBeVisible({ timeout: 30_000 });
        await expect(page.getByRole("button", { name: "Submit", exact: true })).toHaveCount(0);
        const doc = await getSr(draft.id);
        const res = await buSend("Requestor", "PATCH", `/store-requisitions/${draft.id}/submit`, {
          doc_version: doc.doc_version,
          stage_role: "create",
          sr_date_pattern: "today",
          details: lines(doc).map((l) => ({ id: l.id, stage_status: "submit", stage_message: null })),
        });
        requestorTest.fail(true, "suspected bug: PATCH /store-requisitions/{id}/submit is accepted (200) for a Requestor who only holds store_requisition.view and did not create the SR — the gateway does not enforce creator/stage ownership on submit (the same user is refused 404 on GET and 422 WORKFLOW_USER_NOT_STAGE_APPROVER on approve)");
        expect(res.status, JSON.stringify(res.body).slice(0, 200)).toBeGreaterThanOrEqual(400);
        expect((await getSr(draft.id)).doc_status).toBe("draft");
      } finally {
        await disposeSr(draft.id);
      }
    },
  );
});

// ═════════════════════════════════════════════════════════════════════════
// List (approver view)
// ═════════════════════════════════════════════════════════════════════════
purchaseTest.describe("Store Requisition — Approver list actions", () => {
  purchaseTest.describe.configure({ timeout: 120_000 });

  purchaseTest(
    "TC-SR-060001 Navigate to Store Requisitions with Pending Approvals",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase (ผู้อนุมัติขั้น Store Approval); มี SR ที่รออนุมัติ 1 ใบ (สร้างผ่าน API ใน test)" },
        { type: "steps", description: "1. เปิด /store-operation/store-requisition (มุมมองเริ่มต้น My pending)\n2. ค้นหาเลข SR ของใบที่รออนุมัติ\n3. กดเลข SR เพื่อเปิด" },
        { type: "expected", description: "My pending แสดงใบที่รออนุมัติ สถานะ In Progress ขั้น Store Approval; เมื่อกดเปิดจะเห็นหน้ารายละเอียดของใบนั้น (เลข SR, สินค้าทุกรายการ)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      await withSeeded("approval", async (sr) => {
        const srPage = new StoreRequisitionPage(page);
        const doc = await getSr(sr.id);
        await page.setViewportSize(BIG);
        await srPage.gotoList();
        await expect(page.getByRole("button", { name: /my pending/i })).toBeVisible();
        const input = srPage.searchInput();
        await input.fill(sr.sr_no);
        await input.press("Enter");
        const row = recordRows(page).filter({ hasText: sr.sr_no });
        await expect(row).toHaveCount(1, { timeout: 20_000 });
        await expect(row).toContainText(/in progress/i);
        await expect(row).toContainText("Store Approval");
        await row.getByRole("button", { name: sr.sr_no }).click();
        await expect(page).toHaveURL(new RegExp(`${LIST_PATH}/${sr.id}`));
        await expect(page.getByRole("heading", { level: 1, name: sr.sr_no })).toBeVisible();
        for (const l of lines(doc)) await expect(page.getByText(l.product.name).first()).toBeVisible();
      });
    },
  );

  purchaseTest(
    "TC-SR-060002 View Requisition Details with Filtered Columns",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase; BU มี SR สถานะ Completed อย่างน้อย 1 ใบ และ SR สถานะอื่น (data:reset)" },
        { type: "steps", description: "1. เปิด All Documents\n2. เปิด Toggle columns แล้วซ่อนคอลัมน์ Department\n3. เปิด Filter เลือก Status = COMPLETED" },
        { type: "expected", description: "หัวคอลัมน์ Department หายไปและคอลัมน์อื่นยังอยู่; หลังกรอง Status = Completed ทุกแถวที่แสดงเป็น Completed และจำนวนแถวไม่เกินจำนวนใบ Completed ใน API" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const sr = new StoreRequisitionPage(page);
      await page.setViewportSize(BIG);
      await sr.gotoAllDocuments();
      await expect(page.getByRole("columnheader", { name: "Department" })).toBeVisible();
      await page.getByRole("button", { name: "Toggle columns" }).click();
      await page.getByRole("menuitemcheckbox", { name: "Department" }).click();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("columnheader", { name: "Department" })).toHaveCount(0);
      for (const h of ["SR No.", "Workflow", "Status"]) await expect(page.getByRole("columnheader", { name: h })).toBeVisible();
      const all = await rootGet("Purchase", `/store-requisitions?perpage=100&bu_code=${BU_CODE}`);
      const completed = (all.body.data.find((b: any) => b.bu_code === BU_CODE).data as any[]).filter((r) => r.doc_status === "completed").length;
      expect(completed, "BU has Completed SRs (API-checked precondition)").toBeGreaterThan(0);
      await page.getByRole("button", { name: "Filter" }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Status" }).click();
      await page.getByRole("option", { name: "COMPLETED" }).click();
      await page.keyboard.press("Escape");
      await expect.poll(async () => {
        const texts = await recordRows(page).allInnerTexts();
        return texts.length > 0 && texts.length <= Math.min(10, completed) && texts.every((t) => /completed/i.test(t));
      }, { timeout: 20_000 }).toBe(true);
    },
  );

  purchaseTest(
    "TC-SR-060006 Sort the Requisition List by SR No.",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase; BU มี SR หลายใบ (data:reset)" },
        { type: "steps", description: "1. เปิด All Documents\n2. กดหัวคอลัมน์ SR No. เพื่อเรียง แล้วกดซ้ำ" },
        { type: "expected", description: "แถวถูกเรียงตามเลข SR (คอลัมน์ SR No. เรียงต่อเนื่องในทิศทางเดียว) และกดซ้ำแล้วทิศทางกลับกัน" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const sr = new StoreRequisitionPage(page);
      await page.setViewportSize(BIG);
      await sr.gotoAllDocuments();
      const numbers = async () =>
        (await recordRows(page).evaluateAll((trs) => trs.map((tr) => tr.querySelector("button, a")?.textContent?.trim() ?? ""))).filter((t) => /^SR\d+/.test(t));
      expect((await numbers()).length).toBeGreaterThan(2);
      const header = page.getByRole("columnheader", { name: "SR No." }).getByRole("button");
      await header.click();
      await expect.poll(async () => { const n = await numbers(); return n.length > 2 && JSON.stringify(n) === JSON.stringify([...n].sort()); }, { timeout: 15_000 }).toBe(true);
      const asc = await numbers();
      await header.click();
      await expect.poll(async () => { const n = await numbers(); return n.length > 2 && JSON.stringify(n) === JSON.stringify([...n].sort().reverse()); }, { timeout: 15_000 }).toBe(true);
      expect(await numbers()).not.toEqual(asc);
    },
  );


  purchaseTest(
    "TC-SR-060003 Export the Current Requisition List Page",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase; BU มี SR (data:reset); หน้า list ไม่มีการเลือกหลายแถว จึงใช้ปุ่ม Export ของ list ที่ส่งออกตามตัวกรองปัจจุบัน" },
        { type: "steps", description: "1. เปิด All Documents\n2. กด Export" },
        { type: "expected", description: "ได้ไฟล์ store-requisition_*.xlsx และ toast 'Exported N records' โดย N เท่ากับจำนวนแถวที่ list กำลังแสดง (ส่งออกตามหน้า/ตัวกรองปัจจุบัน)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const sr = new StoreRequisitionPage(page);
      await page.setViewportSize(BIG);
      await sr.gotoAllDocuments();
      const shownRows = await recordRows(page).count();
      expect(shownRows).toBeGreaterThan(0);
      const download = page.waitForEvent("download");
      await page.getByRole("button", { name: "Export" }).click();
      expect((await download).suggestedFilename()).toMatch(/^store-requisition_.*\.xlsx$/);
      const toast = toasts(page).filter({ hasText: /exported \d+ records/i }).first();
      await expect(toast).toBeVisible({ timeout: 20_000 });
      expect(Number((await toast.innerText()).match(/exported (\d+) records/i)![1])).toBe(shownRows);
    },
  );

  requestorTest(
    "TC-SR-060004 No Pending Approvals - Empty State",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Requestor (ไม่ใช่ผู้อนุมัติของ SR ใด; ตรวจจาก API ว่า /my-pending/store-requisitions ว่าง)" },
        { type: "steps", description: "1. เปิด /store-operation/store-requisition (My pending)" },
        { type: "expected", description: "ไม่มีแถว SR และแสดงข้อความว่าง 'No data found'" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      const mine = await rootGet("Requestor", "/my-pending/store-requisitions?perpage=20");
      expect(mine.status).toBe(200);
      expect(JSON.stringify(mine.body.data), "Requestor has no pending SR (API-checked precondition)").not.toMatch(/"sr_no"/);
      const sr = new StoreRequisitionPage(page);
      await sr.gotoList();
      await expect(page.getByText(/no data found/i).first()).toBeVisible({ timeout: 20_000 });
      await expect(recordRows(page)).toHaveCount(0);
    },
  );
});

// ═════════════════════════════════════════════════════════════════════════
// Approve
// ═════════════════════════════════════════════════════════════════════════
/** Approver flow part 1: Edit mode + tick every row. */
async function startMarking(sr: StoreRequisitionPage) {
  await sr.editButton().click();
  await sr.selectAllItems();
}

purchaseTest.describe("Store Requisition — Approve", () => {
  purchaseTest.describe.configure({ timeout: 120_000 });

  purchaseTest(
    "TC-SR-070001 Approve Requisition with No Quantity Adjustments",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase (ผู้อนุมัติขั้น Store Approval); มี SR In Progress ที่ขั้น Store Approval (สร้างผ่าน API ใน test)" },
        { type: "steps", description: "1. เปิดรายละเอียด SR แล้วกด Edit\n2. ติ๊กทุกแถว (Select all) แล้วกด Approve ที่แถบเครื่องมือรายการ\n3. กด Approve ที่แถบล่าง\n4. ยืนยันในกล่อง Approve Store Requisition" },
        { type: "expected", description: "แสดง toast 'Store requisition approved'; SR ไปขั้น Issue (ตรวจจาก API) อนุมัติเท่าจำนวนที่ขอ และ workflow history มีรายการ approved จากขั้น Store Approval" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      await withSeeded("approval", async (sr) => {
        const srPage = new StoreRequisitionPage(page);
        await openSr(page, sr);
        await startMarking(srPage);
        await srPage.toolbarAction("Approve").click();
        for (const row of await srPage.itemRows().all()) await expect(srPage.rowStatus(row)).toHaveAttribute("aria-label", /approve/i);
        await srPage.footerAction("Approve").click();
        const dialog = srPage.actionDialog();
        await expect(dialog.getByRole("heading", { name: "Approve Store Requisition" })).toBeVisible();
        await dialog.getByRole("button", { name: "Approve", exact: true }).click();
        await expect(toasts(page).filter({ hasText: "Store requisition approved" })).toBeVisible({ timeout: 30_000 });
        const doc = await getSr(sr.id);
        expect(doc.doc_status).toBe("in_progress");
        expect(doc.workflow_current_stage).toBe("Issue");
        for (const l of lines(doc)) expect(Number(l.approved_qty)).toBe(Number(l.requested_qty));
        expect(doc.workflow_history.some((h: any) => h.action === "approved" && h.current_stage === "Store Approval")).toBe(true);
      });
    },
  );

  requestorTest(
    "TC-SR-070002 Unauthorized User Attempts to Approve Requisition",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Requestor (ไม่ใช่ผู้อนุมัติขั้น Store Approval); มี SR In Progress ที่ขั้น Store Approval ซึ่ง Purchase สร้างไว้ (สร้างผ่าน API ใน test)" },
        { type: "steps", description: "1. ส่ง PATCH /store-requisitions/{id}/approve ในชื่อ Requestor\n2. เปิดรายละเอียด SR ตรง ๆ ด้วย URL" },
        { type: "expected", description: "API ปฏิเสธด้วย 422 WORKFLOW_USER_NOT_STAGE_APPROVER และ SR ยังอยู่ที่ Store Approval; หน้าไม่แสดงเอกสารและไม่มีปุ่ม Approve" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      await withSeeded("approval", async (sr) => {
        const doc = await getSr(sr.id);
        const res = await buSend("Requestor", "PATCH", `/store-requisitions/${sr.id}/approve`, {
          doc_version: doc.doc_version,
          stage_role: "approve",
          details: lines(doc).map((l) => ({ id: l.id, stage_status: "approve", stage_message: null, approved_qty: Number(l.requested_qty) })),
        });
        expect(res.status).toBe(422);
        expect(res.body.error.code).toBe("WORKFLOW_USER_NOT_STAGE_APPROVER");
        expect((await getSr(sr.id)).workflow_current_stage).toBe("Store Approval");
        await page.setViewportSize(BIG);
        await page.goto(`${LIST_PATH}/${sr.id}`);
        await expect(page.getByText(/something went wrong|not found/i).first()).toBeVisible({ timeout: 30_000 });
        await expect(page.getByRole("button", { name: "Approve", exact: true })).toHaveCount(0);
      });
    },
  );
});

// ═════════════════════════════════════════════════════════════════════════
// Item-level approve
// ═════════════════════════════════════════════════════════════════════════
purchaseTest.describe("Store Requisition — Approve Item-level", () => {
  purchaseTest.describe.configure({ timeout: 120_000 });

  purchaseTest(
    "TC-SR-080001 Happy Path - Approve Item",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase (ผู้อนุมัติ); มี SR ที่ขั้น Store Approval ที่มีสินค้า 2 รายการ (สร้างผ่าน API ใน test)" },
        { type: "steps", description: "1. เปิดรายละเอียด SR แล้วกด Edit\n2. ติ๊กเฉพาะแถวแรก\n3. กด Approve ที่แถบเครื่องมือรายการ" },
        { type: "expected", description: "แถวแรกแสดงสถานะ Approve ส่วนแถวที่สองยัง Pending; ตัว SR ยังเป็น In Progress ที่ Store Approval (ยังไม่ตัดสินจนกว่าจะกดปุ่มล่าง) และแถบล่างมีปุ่ม Approve ให้ยืนยัน" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      await withSeeded("approval", async (sr) => {
        const srPage = new StoreRequisitionPage(page);
        await openSr(page, sr);
        await srPage.editButton().click();
        const rows = srPage.itemRows();
        await srPage.selectItemRow(rows.nth(0));
        await srPage.toolbarAction("Approve").click();
        await expect(srPage.rowStatus(rows.nth(0))).toHaveAttribute("aria-label", /approve/i);
        await expect(srPage.rowStatus(rows.nth(1))).toHaveAttribute("aria-label", /pending/i);
        await expect(page.getByText("In Progress", { exact: true }).first()).toBeVisible();
        await expect(srPage.footerAction("Approve")).toBeVisible();
        const doc = await getSr(sr.id);
        expect(doc.doc_status).toBe("in_progress");
        expect(doc.workflow_current_stage).toBe("Store Approval");
      }, { products: 2 });
    },
  );

  purchaseTest(
    "TC-SR-080002 Negative - Insufficient Stock for Issuance",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase (ผู้จ่ายของขั้น Issue); มี SR ที่ขั้น Issue ที่ขอและอนุมัติ 100000 หน่วย ซึ่งมากกว่า stock ของคลังต้นทาง (สร้างผ่าน API ใน test)" },
        { type: "steps", description: "1. เปิดรายละเอียด SR ขั้น Issue แล้วกด Edit\n2. ใส่ Issued = 100000 ทุกแถว\n3. ติ๊กทุกแถว กด Approve ที่แถบเครื่องมือ\n4. กด Issue ที่แถบล่างและยืนยัน" },
        { type: "expected", description: "ระบบแสดง error 'Not enough … to issue' (SR_ISSUE_INSUFFICIENT_STOCK) และไม่ตัดสต็อก: SR ยังเป็น In Progress ที่ขั้น Issue และ issued_qty ยังเป็น 0" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      await withSeeded("issue", async (sr) => {
        const srPage = new StoreRequisitionPage(page);
        await openSr(page, sr);
        await srPage.editButton().click();
        for (const row of await srPage.itemRows().all()) await srPage.qtySpinbutton(row).fill("100000");
        await srPage.selectAllItems();
        await srPage.toolbarAction("Approve").click();
        await srPage.footerAction("Issue").click();
        await srPage.actionDialog().getByRole("button", { name: "Issue", exact: true }).click();
        await expect(toasts(page).filter({ hasText: /not enough .* to issue/i })).toBeVisible({ timeout: 30_000 });
        const doc = await getSr(sr.id);
        expect(doc.doc_status).toBe("in_progress");
        expect(doc.workflow_current_stage).toBe("Issue");
        for (const l of lines(doc)) expect(Number(l.issued_qty)).toBe(0);
      }, { qty: 100000 });
    },
  );

  hodTest(
    "TC-SR-080003 Negative - No Permission",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น HOD (มีสิทธิ์ view + view_department แผนกเดียวกับ Purchase แต่ไม่ใช่ผู้อนุมัติ; ตรวจจาก /api/user/profile); มี SR ที่ขั้น Store Approval (สร้างผ่าน API ใน test)" },
        { type: "steps", description: "1. เปิดรายละเอียด SR ที่รออนุมัติ\n2. มองหาปุ่ม Edit, ช่องติ๊กแถว และปุ่ม Approve" },
        { type: "expected", description: "เปิดดูได้แบบอ่านอย่างเดียว: ไม่มีปุ่ม Edit, ไม่มีช่องติ๊กแถว, ไม่มีปุ่ม Approve/Reject/Send Back ที่แถบล่าง และ role ของใบใน API เป็น view_only" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      await withSeeded("approval", async (sr) => {
        const mine = await buGet("HOD", `/store-requisitions/${sr.id}`);
        expect(mine.status).toBe(200);
        expect(mine.body.data.role).toBe("view_only");
        const srPage = new StoreRequisitionPage(page);
        await openSr(page, sr);
        await expect(srPage.editButton()).toHaveCount(0);
        await expect(srPage.itemsPanel().getByRole("checkbox")).toHaveCount(0);
        for (const name of ["Approve", "Reject", "Send Back"] as const) await expect(page.getByRole("button", { name, exact: true })).toHaveCount(0);
      });
    },
  );
});

// ═════════════════════════════════════════════════════════════════════════
// Adjust approved quantity
// ═════════════════════════════════════════════════════════════════════════
purchaseTest.describe("Store Requisition — Adjust approved quantity", () => {
  purchaseTest.describe.configure({ timeout: 120_000 });

  purchaseTest(
    "TC-SR-090001 Adjust approved quantity: Happy path",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase (ผู้อนุมัติ); มี SR ที่ขั้น Store Approval ที่ขอสินค้าแถวละ 5 (สร้างผ่าน API ใน test)" },
        { type: "steps", description: "1. เปิดรายละเอียด SR แล้วกด Edit\n2. แก้ช่อง Approved ของแถวแรกเป็น 3\n3. ติ๊กทุกแถว กด Approve ที่แถบเครื่องมือ\n4. กด Approve ที่แถบล่างและยืนยัน" },
        { type: "expected", description: "SR ไปขั้น Issue และ API เก็บ approved_qty ของแถวแรก = 3 (ส่วน requested ยัง 5) ส่วนแถวที่สองอนุมัติ 5" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      await withSeeded("approval", async (sr) => {
        const srPage = new StoreRequisitionPage(page);
        const before = lines(await getSr(sr.id));
        await openSr(page, sr);
        await srPage.editButton().click();
        await srPage.qtySpinbutton(srPage.itemRows().nth(0)).fill("3");
        await srPage.selectAllItems();
        await srPage.toolbarAction("Approve").click();
        await srPage.footerAction("Approve").click();
        await srPage.actionDialog().getByRole("button", { name: "Approve", exact: true }).click();
        await expect(toasts(page).filter({ hasText: "Store requisition approved" })).toBeVisible({ timeout: 30_000 });
        const doc = await getSr(sr.id);
        expect(doc.workflow_current_stage).toBe("Issue");
        const first = lines(doc).find((l) => l.id === before[0].id);
        const second = lines(doc).find((l) => l.id === before[1].id);
        expect(Number(first.approved_qty)).toBe(3);
        expect(Number(first.requested_qty)).toBe(5);
        expect(Number(second.approved_qty)).toBe(5);
      });
    },
  );

  purchaseTest(
    "TC-SR-090003 Decrease approved quantity: Fully issued item",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase; มี SR ที่ issue ครบแล้ว สถานะ Completed (สร้างและ issue ผ่าน API ใน test)" },
        { type: "steps", description: "1. เปิดรายละเอียด SR ที่ Completed\n2. มองหาปุ่ม Edit และช่องแก้ Approved/Issued" },
        { type: "expected", description: "ใบอ่านอย่างเดียว: ไม่มีปุ่ม Edit, ไม่มีช่องกรอกจำนวน (spinbutton) และไม่มีช่องติ๊กแถว; ค่า Approved = Issued ใน API" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      await withSeeded("completed", async (sr) => {
        const srPage = new StoreRequisitionPage(page);
        await openSr(page, sr);
        await expect(page.getByText("Completed", { exact: true }).first()).toBeVisible();
        await expect(srPage.editButton()).toHaveCount(0);
        await expect(srPage.itemsPanel().getByRole("spinbutton")).toHaveCount(0);
        await expect(srPage.itemsPanel().getByRole("checkbox")).toHaveCount(0);
        const doc = await getSr(sr.id);
        expect(doc.doc_status).toBe("completed");
        for (const l of lines(doc)) expect(Number(l.issued_qty)).toBe(Number(l.approved_qty));
      });
    },
  );

  // A real version conflict: the SR header is bumped through the API after the FE has fetched the fresh
  // doc_version and before its PUT reaches the backend (the route only sequences the real requests).
  purchaseTest(
    "TC-SR-090005 Concurrent modification detected",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase; มี SR Draft; ผู้ใช้รายอื่นบันทึกใบเดียวกันหลังจากที่หน้าอ่านเลขรุ่นล่าสุดแล้ว (จำลองด้วยการ PUT หัวใบผ่าน API ก่อนคำขอบันทึกของหน้าไปถึง backend)" },
        { type: "steps", description: "1. เปิดรายละเอียด SR Draft แล้วกด Edit\n2. แก้ Description\n3. ระหว่างกด Save มีอีกผู้ใช้บันทึกใบเดียวกันก่อน" },
        { type: "expected", description: "แสดงข้อความ 'Someone else changed this document. Refresh the page and try again.' และข้อความของผู้ใช้อีกคนยังอยู่ใน API (ไม่ถูกเขียนทับ)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      const draft = await createDraftSr({ products: 1 });
      try {
        const sr = new StoreRequisitionPage(page);
        await openSr(page, draft);
        await sr.editButton().click();
        await sr.descriptionInput().fill("mine");
        let bumped = false;
        await page.route(new RegExp(`/store-requisitions/${draft.id}$`), async (route) => {
          if (route.request().method() === "PUT" && !bumped) {
            bumped = true;
            await touchDraftSr(draft.id, "theirs");
          }
          await route.continue();
        });
        await sr.saveAsDraftButton().click();
        expect((await getSr(draft.id)).description).not.toBe("mine");
        purchaseTest.fail(true, "suspected bug: a stale doc_version on PUT /store-requisitions/{id} is answered 404 SR_NOT_FOUND (document and line still exist) so the FE shows 'This requisition no longer exists. Someone may have deleted it.'; the FE maps COMMON_DOC_VERSION_CONFLICT / 409 to 'Someone else changed this document' (lib/error-message.ts:40-42) but the backend never sends it for SR update");
        await expect(toasts(page).filter({ hasText: "Someone else changed this document" })).toBeVisible({ timeout: 15_000 });
      } finally {
        await disposeSr(draft.id);
      }
    },
  );

});

// ═════════════════════════════════════════════════════════════════════════
// Send back (Request Review)
// ═════════════════════════════════════════════════════════════════════════
purchaseTest.describe("Store Requisition — Request Review", () => {
  purchaseTest.describe.configure({ timeout: 120_000 });

  purchaseTest(
    "TC-SR-100001 Request Review with Valid Comments and Specific Items",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase (ผู้อนุมัติ); มี SR ที่ขั้น Store Approval (สร้างผ่าน API ใน test) — ปุ่ม 'Request Review' ของ FE คือ Send Back" },
        { type: "steps", description: "1. เปิดรายละเอียด SR แล้วกด Edit\n2. ติ๊กทุกแถว กด Send Back ที่แถบเครื่องมือรายการ\n3. กด Send Back ที่แถบล่าง\n4. เลือก stage ปลายทาง Create Request และกรอกเหตุผลของแถวแรก\n5. กด Send Back ในกล่องยืนยัน" },
        { type: "expected", description: "แสดง toast 'Store requisition sent back'; SR กลับไปขั้น Create Request ยัง In Progress และ API เก็บ review_message ที่กรอกไว้ที่แถวแรก" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      await withSeeded("approval", async (sr) => {
        const srPage = new StoreRequisitionPage(page);
        const reason = "Please confirm the quantity before approval";
        await openSr(page, sr);
        await startMarking(srPage);
        await srPage.toolbarAction("Send Back").click();
        await srPage.footerAction("Send Back").click();
        const dialog = srPage.actionDialog();
        await expect(dialog.getByRole("heading", { name: "Send Back Store Requisition" })).toBeVisible();
        await dialog.getByRole("radio", { name: "Create Request" }).click();
        await dialog.getByPlaceholder(/enter reason/i).first().fill(reason);
        await dialog.getByRole("button", { name: "Send Back", exact: true }).click();
        await expect(toasts(page).filter({ hasText: "Store requisition sent back" })).toBeVisible({ timeout: 30_000 });
        const doc = await getSr(sr.id);
        expect(doc.doc_status).toBe("in_progress");
        expect(doc.workflow_current_stage).toBe("Create Request");
        expect(lines(doc).some((l) => l.review_message === reason)).toBe(true);
      });
    },
  );

  purchaseTest(
    "TC-SR-100003 Request Review with No Specific Items Selected",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase (ผู้อนุมัติ); มี SR ที่ขั้น Store Approval ที่มีสินค้า 2 รายการ (สร้างผ่าน API ใน test)" },
        { type: "steps", description: "1. เปิดรายละเอียด SR แล้วกด Edit โดยยังไม่ติ๊กแถวใด\n2. ดูแถบเครื่องมือรายการและแถบล่าง\n3. ติ๊กแถวหนึ่ง" },
        { type: "expected", description: "ตอนยังไม่เลือกแถว ไม่มีปุ่ม Send Back / Approve / Reject ทั้งที่แถบเครื่องมือและแถบล่าง (ต้องเลือกอย่างน้อยหนึ่งรายการก่อน); พอติ๊กแถวแล้วปุ่มทั้งสามจึงปรากฏ" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      await withSeeded("approval", async (sr) => {
        const srPage = new StoreRequisitionPage(page);
        await openSr(page, sr);
        await srPage.editButton().click();
        await expect(srPage.itemsPanel().getByRole("checkbox", { name: "Select all" })).toBeVisible();
        for (const name of ["Send Back", "Approve", "Reject"] as const) await expect(page.getByRole("button", { name, exact: true })).toHaveCount(0);
        await srPage.selectItemRow(srPage.itemRows().nth(0));
        for (const name of ["Send Back", "Approve", "Reject"] as const) await expect(srPage.toolbarAction(name)).toBeVisible();
      }, { products: 2 });
    },
  );
});

// ═════════════════════════════════════════════════════════════════════════
// Reject
// ═════════════════════════════════════════════════════════════════════════
/** Mark every row Reject through the toolbar dialog (with a reason on the first row). */
async function markAllRejected(sr: StoreRequisitionPage, reason: string) {
  await startMarking(sr);
  await sr.toolbarAction("Reject").click();
  const dialog = sr.actionDialog();
  await dialog.getByPlaceholder(/enter reason/i).first().fill(reason);
  await dialog.getByRole("button", { name: "Reject", exact: true }).click();
  await expect(dialog).toHaveCount(0);
}

purchaseTest.describe("Store Requisition — Reject", () => {
  purchaseTest.describe.configure({ timeout: 120_000 });

  purchaseTest(
    "TC-SR-110001 Primary Actor Rejects Requisition Successfully",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase (ผู้อนุมัติ); มี SR ที่ขั้น Store Approval (สร้างผ่าน API ใน test)" },
        { type: "steps", description: "1. เปิดรายละเอียด SR แล้วกด Edit\n2. ติ๊กทุกแถว กด Reject ที่แถบเครื่องมือ กรอกเหตุผลแล้วยืนยัน\n3. กด Reject ที่แถบล่างและยืนยัน" },
        { type: "expected", description: "แสดง toast 'Store requisition rejected'; SR มีสถานะ Voided (rejected ทั้งใบ) ใน API เหตุผลที่กรอกถูกเก็บที่แถวแรก และใบหลุดจาก My pending" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      await withSeeded("approval", async (sr) => {
        const srPage = new StoreRequisitionPage(page);
        const reason = "Specific policy violation";
        await openSr(page, sr);
        await markAllRejected(srPage, reason);
        for (const row of await srPage.itemRows().all()) await expect(srPage.rowStatus(row)).toHaveAttribute("aria-label", /reject/i);
        await srPage.footerAction("Reject").click();
        await srPage.actionDialog().getByRole("button", { name: "Reject", exact: true }).click();
        await expect(toasts(page).filter({ hasText: "Store requisition rejected" })).toBeVisible({ timeout: 30_000 });
        const doc = await getSr(sr.id);
        expect(doc.doc_status).toBe("voided");
        expect(lines(doc).some((l) => l.reject_message === reason)).toBe(true);
        const mine = await rootGet("Purchase", "/my-pending/store-requisitions?perpage=100");
        expect(JSON.stringify(mine.body)).not.toContain(sr.id);
      });
    },
  );

  purchaseTest(
    "TC-SR-110003 User Accidentally Rejects Requisition",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase (ผู้อนุมัติ); มี SR ที่ขั้น Store Approval ซึ่งทุกแถวถูกมาร์ก Reject แล้วแต่ยังไม่ยืนยันที่แถบล่าง" },
        { type: "steps", description: "1. เปิดรายละเอียด SR แล้วกด Edit\n2. มาร์กทุกแถวเป็น Reject ผ่านแถบเครื่องมือ\n3. กด Reject ที่แถบล่าง\n4. กด Cancel ในกล่องยืนยัน" },
        { type: "expected", description: "กล่องยืนยันปิดโดยไม่มีการ reject: SR ยังเป็น In Progress ที่ Store Approval และไม่มีแถวใดถูกบันทึกเป็น rejected ใน API" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      await withSeeded("approval", async (sr) => {
        const srPage = new StoreRequisitionPage(page);
        await openSr(page, sr);
        await markAllRejected(srPage, "Wrong document");
        await srPage.footerAction("Reject").click();
        const dialog = srPage.actionDialog();
        await expect(dialog.getByRole("heading", { name: "Reject Store Requisition" })).toBeVisible();
        await dialog.getByRole("button", { name: "Cancel" }).click();
        await expect(dialog).toHaveCount(0);
        const doc = await getSr(sr.id);
        expect(doc.doc_status).toBe("in_progress");
        expect(doc.workflow_current_stage).toBe("Store Approval");
        expect(lines(doc).some((l) => /reject/i.test(String(l.last_action)))).toBe(false);
      });
    },
  );

  purchaseTest(
    "TC-SR-110004 User Rejects Specific Items Only",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase (ผู้อนุมัติ); มี SR ที่ขั้น Store Approval ที่มีสินค้า 2 รายการ (สร้างผ่าน API ใน test)" },
        { type: "steps", description: "1. เปิดรายละเอียด SR แล้วกด Edit\n2. ติ๊กแถวแรก กด Reject ที่แถบเครื่องมือ กรอกเหตุผล ยืนยัน\n3. ติ๊กแถวที่สอง กด Approve ที่แถบเครื่องมือ\n4. กด Approve ที่แถบล่างและยืนยัน" },
        { type: "expected", description: "แถวแรกถูก reject พร้อมเหตุผล ส่วนแถวที่สองดำเนิน workflow ต่อ: SR ไปขั้น Issue (ไม่ถูก void) และ API บันทึกเหตุผลที่แถวแรกใน reject_message (ไม่ใช่ approved) และแถวที่สองอนุมัติ 5" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Alternate Flow" },
      ],
    },
    async ({ page }) => {
      await withSeeded("approval", async (sr) => {
        const srPage = new StoreRequisitionPage(page);
        const reason = "Invalid request";
        const before = lines(await getSr(sr.id));
        await openSr(page, sr);
        await srPage.editButton().click();
        const rows = srPage.itemRows();
        await srPage.selectItemRow(rows.nth(0));
        await srPage.toolbarAction("Reject").click();
        await srPage.actionDialog().getByPlaceholder(/enter reason/i).first().fill(reason);
        await srPage.actionDialog().getByRole("button", { name: "Reject", exact: true }).click();
        await srPage.selectItemRow(rows.nth(1));
        await srPage.toolbarAction("Approve").click();
        await expect(srPage.rowStatus(rows.nth(0))).toHaveAttribute("aria-label", /reject/i);
        await expect(srPage.rowStatus(rows.nth(1))).toHaveAttribute("aria-label", /approve/i);
        await srPage.footerAction("Approve").click();
        await srPage.actionDialog().getByRole("button", { name: "Approve", exact: true }).click();
        await expect(toasts(page).filter({ hasText: "Store requisition approved" })).toBeVisible({ timeout: 30_000 });
        const doc = await getSr(sr.id);
        expect(doc.doc_status).toBe("in_progress");
        expect(doc.workflow_current_stage).toBe("Issue");
        const first = lines(doc).find((l) => l.id === before[0].id);
        const second = lines(doc).find((l) => l.id === before[1].id);
        expect(Number(second.approved_qty)).toBe(5);
        purchaseTest.fail(true, "suspected bug: a line rejected next to an approved line is stored as approved — API shows last_action 'approved', approved_qty 5, the reason in approved_message and reject_message null/reject_by null, although the line history has status 'reject' (the reject_message / reject_date_at fields exist for this; micro-business store-requisition approve path)");
        expect(first.reject_message).toBe(reason);
      }, { products: 2 });
    },
  );
});

// ═════════════════════════════════════════════════════════════════════════
// Issuance
// ═════════════════════════════════════════════════════════════════════════
/** Stock of a seed product at the SR source location (from the on-hand API). */
async function onHandAtSource(productId: string): Promise<number> {
  const c = await srSeedContext();
  const r = await buGet("Purchase", `/products/${productId}/on-hand`);
  expect(r.status).toBe(200);
  return Number(r.body.data.locations.find((l: any) => l.location_id === c.from_location.id).on_hand_qty);
}

/** Issue stage: Edit, type the issued quantities, tick all, mark Approve, press Issue + confirm. */
async function issueThroughUi(page: Page, srPage: StoreRequisitionPage, issued: string[]) {
  await srPage.editButton().click();
  const rows = srPage.itemRows();
  for (let i = 0; i < issued.length; i++) await srPage.qtySpinbutton(rows.nth(i)).fill(issued[i]);
  await srPage.selectAllItems();
  await srPage.toolbarAction("Approve").click();
  await srPage.footerAction("Issue").click();
  const dialog = srPage.actionDialog();
  await expect(dialog.getByRole("heading", { name: "Issue Store Requisition" })).toBeVisible();
  await dialog.getByRole("button", { name: "Issue", exact: true }).click();
  await expect(toasts(page).filter({ hasText: "Items issued" })).toBeVisible({ timeout: 30_000 });
}

purchaseTest.describe("Store Requisition — Issuance", () => {
  purchaseTest.describe.configure({ timeout: 150_000 });

  purchaseTest(
    "TC-SR-120001 Happy Path - Full Issuance",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase (ผู้จ่ายของขั้น Issue); มี SR ที่ขั้น Issue อนุมัติแถวละ 5 และสินค้ามี stock พอในคลังต้นทาง (สร้างผ่าน API ใน test)" },
        { type: "steps", description: "1. เปิดรายละเอียด SR ขั้น Issue แล้วกด Edit\n2. ใส่ Issued = 5 ทุกแถว\n3. ติ๊กทุกแถว กด Approve ที่แถบเครื่องมือ\n4. กด Issue ที่แถบล่างและยืนยัน" },
        { type: "expected", description: "แสดง toast 'Items issued — stock moved out'; SR เป็น Completed, issued_qty = approved_qty ทุกแถว และ stock ของสินค้าแถวแรกที่คลังต้นทางลดลง 5" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const c = await srSeedContext();
      await withSeeded("issue", async (sr) => {
        const srPage = new StoreRequisitionPage(page);
        const stockBefore = await onHandAtSource(c.products[0].id);
        await openSr(page, sr);
        await issueThroughUi(page, srPage, ["5", "5"]);
        const doc = await getSr(sr.id);
        expect(doc.doc_status).toBe("completed");
        for (const l of lines(doc)) expect(Number(l.issued_qty)).toBe(Number(l.approved_qty));
        expect(await onHandAtSource(c.products[0].id)).toBe(stockBefore - 5);
      });
    },
  );

  purchaseTest(
    "TC-SR-120003 Edge Case - Partial Issuance",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase (ผู้จ่ายของขั้น Issue); มี SR ที่ขั้น Issue อนุมัติแถวละ 5 (สร้างผ่าน API ใน test)" },
        { type: "steps", description: "1. เปิดรายละเอียด SR ขั้น Issue แล้วกด Edit\n2. ใส่ Issued = 2 ที่แถวแรกและ 5 ที่แถวที่สอง\n3. ติ๊กทุกแถว กด Approve ที่แถบเครื่องมือ\n4. กด Issue ที่แถบล่างและยืนยัน" },
        { type: "expected", description: "SR ยังอยู่ใน In Progress และจำนวนที่เหลือ (แถวแรก 3) ยังตามต่อได้" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      await withSeeded("issue", async (sr) => {
        const srPage = new StoreRequisitionPage(page);
        await openSr(page, sr);
        await issueThroughUi(page, srPage, ["2", "5"]);
        const doc = await getSr(sr.id);
        expect(lines(doc).filter((l) => Number(l.issued_qty) === 2)).toHaveLength(1);
        purchaseTest.fail(true, "suspected bug: issuing 2 of 5 completes the SR (doc_status completed, issued 2 < approved 5) — no remaining quantity is tracked and the SR never stays In Progress; needs a product decision on partial issue (backend /approve with stage_role issue; FE use-sr-form-actions.ts handleIssue has no partial path)");
        expect(doc.doc_status).toBe("in_progress");
      });
    },
  );
});
