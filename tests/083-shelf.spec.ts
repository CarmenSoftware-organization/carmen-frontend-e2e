import { expect, test as base } from "@playwright/test";
import { createAuthTest } from "./fixtures/auth.fixture";
import { ConfigListPage } from "./pages/config-list.page";
import { DialogCrudHelper } from "./pages/dialog-crud.helper";
import { BU_CODE } from "./test-users";
import { ensureActiveBu } from "./helpers/bu";
import { uid, fakeCode, fakeName } from "./helpers/test-data";

/**
 * Shelf (SHLF) — Config — Shelf
 * URL: /config/shelf
 *
 * The backend endpoint `/api/config/{bu_code}/shelves` is live on dev now (list answers 200,
 * empty until a shelf is created), so the CRUD cases that were deferred behind test.fixme()
 * run for real (dialog form: #shelf-code, #shelf-name, #shelf-description, #shelf-sequence).
 */

const test = createAuthTest("carmensoftware.dev+admin@gmail.com");
const PATH = "/config/shelf";

const CODE = fakeCode("SH");
const NAME = fakeName({ tag: "Shelf" });
const NAME_UPD = fakeName({ tag: "Shelf Upd" });
const CODE2 = fakeCode("SH2");
const NAME2 = fakeName({ tag: "Shelf Del" });

const crud = (page: import("@playwright/test").Page) =>
  new DialogCrudHelper(page, {
    listPath: PATH,
    nameInputId: "shelf-name",
    activeSwitchId: "shelf-is-active",
    descriptionInputId: "shelf-description",
  });

/** Create a shelf through the dialog (code + name, optional description). */
async function createShelf(page: import("@playwright/test").Page, code: string, name: string, description?: string) {
  const h = crud(page);
  await h.list.goto();
  await h.list.addButton().click();
  await page.locator("#shelf-code").fill(code);
  await h.nameInput().fill(name);
  if (description) await h.descriptionInput().fill(description);
  await h.saveButton().click();
  await expect(page.getByText(/created successfully/i).first()).toBeVisible({ timeout: 10_000 });
}

test.describe("Shelf — Smoke & error-state", () => {
  test.beforeEach(async ({ page }) => {
    await ensureActiveBu(page, BU_CODE);
  });

  // ------------------------------------------------------------------
  // TC-SHLF-010001 — Smoke: page loads
  // ------------------------------------------------------------------
  test(
    "TC-SHLF-010001 แสดงรายการชั้นวางพร้อมคอลัมน์มาตรฐาน",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG" },
        { type: "steps", description: "1. ไปที่ /config/shelf\n2. รอให้ DataGrid หรือ error-state โหลดเสร็จ" },
        { type: "expected", description: "URL ตรงกับ /config/shelf; หน้าแสดงชื่อ 'Shelf' หรือ 'ชั้นวาง' และ toolbar แสดงช่องค้นหาและปุ่มเพิ่ม (โดยไม่คำนึงว่าตารางจะมีข้อมูลหรือแสดง error-state เพราะ backend อาจยังไม่มี endpoint)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page }) => {
      await page.goto(PATH);
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveURL(new RegExp(PATH));
      // Page heading or document title should contain shelf-related text
      const headingOrTitle = page
        .getByRole("heading", { name: /Shel(f|ves)|ชั้นวาง/i })
        .first()
        .or(page.locator("h1, h2").filter({ hasText: /Shel(f|ves)|ชั้นวาง/i }).first());
      await expect(headingOrTitle).toBeVisible({ timeout: 15_000 });
    },
  );

  // ------------------------------------------------------------------
  // TC-SHLF-900002 — list loads from the live endpoint (no error state)
  // ------------------------------------------------------------------
  test(
    "TC-SHLF-900002 รายการชั้นวางโหลดจาก endpoint จริง — แสดงตารางและไม่เป็น error state",
    {
      annotation: [
        { type: "preconditions", description: "backend ของ BU ที่ใช้ทดสอบมี endpoint /api/config/{bu_code}/shelves ใช้งานได้" },
        { type: "steps", description: "1. ไปที่ /config/shelf\n2. รอให้คำขอรายการเสร็จ" },
        { type: "expected", description: "หน้าแสดงตารางรายการ (หรือสถานะว่าง) และไม่แสดง ErrorState / ปุ่มลองใหม่" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      await page.goto(PATH);
      await page.waitForLoadState("networkidle");
      // The endpoint answers now: the list renders (table, possibly with its "No data" row) and the
      // ErrorState with a retry button must NOT be shown.
      await expect(page.locator("table").first()).toBeVisible({ timeout: 10_000 });
      await expect(page.getByRole("button", { name: /retry|try again|ลองใหม่/i })).toHaveCount(0);
    },
  );
});

// ------------------------------------------------------------------
// CRUD — dialog form against the live /shelves endpoint
// ------------------------------------------------------------------
test.describe("Shelf — CRUD", () => {
  test.beforeEach(async ({ page }) => {
    await ensureActiveBu(page, BU_CODE);
  });

  test(
    "TC-SHLF-030001 สร้างชั้นวางใหม่ด้วยฟิลด์บังคับ (รหัส + ชื่อ)",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG; อยู่ที่หน้า /config/shelf" },
        { type: "steps", description: "1. คลิกปุ่ม 'เพิ่มชั้นวาง'\n2. กรอกรหัสที่ไม่ซ้ำ\n3. กรอกชื่อ\n4. คลิกปุ่มสร้าง" },
        { type: "expected", description: "แสดง toast 'สร้างชั้นวางสำเร็จ'; dialog ปิดเอง; ชั้นวางใหม่ปรากฏในรายการ" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const h = crud(page);
      await createShelf(page, CODE, NAME);
      await h.list.search(CODE);
      await expect(page.getByRole("cell", { name: new RegExp(CODE) }).first()).toBeVisible({ timeout: 10_000 });
    },
  );

  test(
    "TC-SHLF-030002 สร้างชั้นวางพร้อมคำอธิบายและลำดับ",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ใน dialog เพิ่มชั้นวาง" },
        { type: "steps", description: "1. กรอกรหัสและชื่อที่ไม่ซ้ำ\n2. กรอกคำอธิบาย\n3. กรอกลำดับเป็นจำนวนเต็มบวก เช่น '3'\n4. คลิกปุ่มสร้าง" },
        { type: "expected", description: "สร้างสำเร็จพร้อม toast; คอลัมน์คำอธิบายในตารางแสดงข้อความที่กรอก" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const h = crud(page);
      const desc = `E2E shelf desc ${CODE2}`;
      await h.list.goto();
      await h.list.addButton().click();
      await page.locator("#shelf-code").fill(CODE2);
      await h.nameInput().fill(NAME2);
      await h.descriptionInput().fill(desc);
      await page.locator("#shelf-sequence").fill("3");
      await h.saveButton().click();
      await expect(page.getByText(/created successfully/i).first()).toBeVisible({ timeout: 10_000 });
      await h.list.search(CODE2);
      await expect(page.getByRole("row").filter({ hasText: CODE2 }).first()).toContainText(desc);
    },
  );

  test(
    "TC-SHLF-040001 แก้ไขชื่อและคำอธิบายแล้วค่าคงอยู่",
    {
      annotation: [
        { type: "preconditions", description: "มีชั้นวางที่สร้างไว้แล้วอย่างน้อย 1 รายการ" },
        { type: "steps", description: "1. คลิกรหัสของชั้นวางเพื่อเปิด dialog แก้ไข\n2. แก้ไขชื่อและคำอธิบาย\n3. คลิกปุ่มบันทึก\n4. เปิด dialog ของชั้นวางนั้นอีกครั้ง" },
        { type: "expected", description: "แสดง toast อัปเดตสำเร็จ; ตารางแสดงชื่อและคำอธิบายใหม่" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const h = crud(page);
      await h.list.goto();
      await h.list.search(CODE);
      await expect(page.getByRole("cell", { name: new RegExp(CODE) }).first(), "TC-SHLF-030001 creates this shelf").toBeVisible({ timeout: 10_000 });
      await page.getByRole("button", { name: CODE, exact: true }).first().click();
      await h.nameInput().fill(NAME_UPD);
      await h.descriptionInput().fill("edited by E2E");
      await h.saveButton().click();
      await expect(page.getByText(/updated successfully/i).first()).toBeVisible({ timeout: 10_000 });
      await h.list.search(CODE);
      const row = page.getByRole("row").filter({ hasText: CODE }).first();
      await expect(row).toContainText(NAME_UPD);
      await expect(row).toContainText("edited by E2E");
    },
  );

  test(
    "TC-SHLF-050001 ลบชั้นวางสำเร็จ",
    {
      annotation: [
        { type: "preconditions", description: "มีชั้นวางที่สร้างขึ้นมาเพื่อลบโดยเฉพาะ" },
        { type: "steps", description: "1. เปิดเมนูจัดการท้ายแถวของชั้นวางนั้นแล้วเลือกลบ\n2. ยืนยัน dialog การลบ" },
        { type: "expected", description: "แสดง toast ลบสำเร็จ; ชั้นวางหายจากรายการหลังรีเฟรชข้อมูล" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const h = crud(page);
      await h.list.goto();
      await h.list.search(CODE2);
      const row = page.getByRole("row").filter({ hasText: CODE2 }).first();
      await expect(row, "TC-SHLF-030002 creates this shelf").toBeVisible({ timeout: 10_000 });
      await row.getByRole("button", { name: /Row actions/i }).click();
      await page.getByRole("menuitem", { name: /^Delete$/i }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: /^(Delete|ลบ)$/i }).click();
      await expect(page.getByText(/deleted successfully/i).first()).toBeVisible({ timeout: 10_000 });
      await h.list.search(CODE2);
      await expect(page.getByRole("row").filter({ hasText: CODE2 })).toHaveCount(0);
    },
  );

  test(
    "TC-SHLF-200001 บันทึกไม่ได้เมื่อเว้นรหัสและชื่อว่าง",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ใน dialog เพิ่มชั้นวาง โดยยังไม่กรอกอะไรเลย" },
        { type: "steps", description: "1. ปล่อยช่องรหัสและช่องชื่อว่าง\n2. คลิกปุ่มสร้าง" },
        { type: "expected", description: "แสดงข้อความ error ใต้ทั้งสองช่อง; dialog ไม่ปิดและไม่มีชั้นวางถูกสร้าง" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Validation" },
      ],
    },
    async ({ page }) => {
      const h = crud(page);
      await h.list.goto();
      await h.list.addButton().click();
      await h.saveButton().click();
      await expect(page.locator("#shelf-code")).toHaveAttribute("aria-invalid", "true", { timeout: 5_000 });
      await expect(h.nameInput()).toHaveAttribute("aria-invalid", "true");
      await expect(h.dialog().first()).toBeVisible();
    },
  );

  test(
    "TC-SHLF-300001 ส่งออกรายการชั้นวางเป็นไฟล์ XLSX",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่หน้า /config/shelf บน desktop; มีชั้นวางอย่างน้อย 1 รายการ" },
        { type: "steps", description: "1. คลิกปุ่มส่งออก\n2. รอจนปุ่มกลับจากสถานะกำลังส่งออก" },
        { type: "expected", description: "เบราว์เซอร์ดาวน์โหลดไฟล์ XLSX; แสดง toast แจ้งจำนวนรายการ" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const h = crud(page);
      await h.list.goto();
      const exportBtn = page.getByRole("button", { name: /^Export$/i }).first();
      await expect(exportBtn).toBeEnabled({ timeout: 10_000 });
      const [download] = await Promise.all([page.waitForEvent("download", { timeout: 30_000 }), exportBtn.click()]);
      expect(download.suggestedFilename()).toMatch(/\.xlsx$/i);
    },
  );
});
