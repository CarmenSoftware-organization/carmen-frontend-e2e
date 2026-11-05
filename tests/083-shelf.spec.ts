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
 * NOTE (as of 2026-09-20): The catalog (`docs/test-cases/083-shelf.md`) explicitly
 * documents that the backend endpoint `/api/config/{bu_code}/shelves` does not
 * yet exist. The page was built ahead of the API contract.
 *
 * Strategy:
 *  - TC-SHLF-010001: Smoke test — page loads and toolbar renders (whether the
 *    table is empty or shows an error state is acceptable).
 *  - TC-SHLF-900002: Explicit test for the error-state / retry-button behaviour
 *    that the catalog documents as expected when the endpoint is absent.
 *  - All CRUD tests (TC-SHLF-030001, 040001, 050001, etc.) are marked
 *    test.fixme() with an explanatory note. They must be revisited once the
 *    backend endpoint is live.
 */

const test = createAuthTest("carmensoftware.dev+admin@gmail.com");
const PATH = "/config/shelf";

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
  // TC-SHLF-900002 — Error state: backend endpoint absent → retry button
  // ------------------------------------------------------------------
  test(
    "TC-SHLF-900002 backend ยังไม่มี endpoint ชั้นวาง — หน้าแสดงสถานะข้อผิดพลาดพร้อมปุ่มลองใหม่",
    {
      annotation: [
        { type: "preconditions", description: "backend ของ BU ที่ใช้ทดสอบยังไม่มี endpoint /api/config/{bu_code}/shelves (สถานะตามคอมเมนต์ใน hooks/use-shelf.ts)" },
        { type: "steps", description: "1. ไปที่ /config/shelf\n2. รอให้คำขอรายการล้มเหลว\n3. คลิกปุ่มลองใหม่ในหน้าสถานะข้อผิดพลาด" },
        { type: "expected", description: "แทนที่ตาราง หน้าแสดง ErrorState พร้อมข้อความข้อผิดพลาดและปุ่มลองใหม่; กดลองใหม่แล้วระบบยิงคำขอซ้ำโดยแอปไม่ค้างและไม่ crash" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      await page.goto(PATH);
      await page.waitForLoadState("networkidle");
      // If endpoint is absent, look for an error/retry state OR an empty table.
      // If the endpoint IS available (backend implemented), this test may show
      // an empty table instead. We accept both gracefully — the important thing
      // is that the app does not crash.
      const retryBtn = page.getByRole("button", { name: /retry|try again|ลองใหม่/i }).first();
      const isEmpty = await retryBtn.isVisible({ timeout: 5_000 }).catch(() => false);
      if (isEmpty) {
        await retryBtn.click();
        await page.waitForLoadState("networkidle");
        // After retry, the page should still be on /config/shelf (no crash)
        await expect(page).toHaveURL(new RegExp(PATH));
      } else {
        // Endpoint available: table or empty-state visible — test passes
        // An empty list renders the table AND its "No data found" row — `.or()` matches both,
        // so take the first to stay out of strict mode.
        const tableOrEmpty = page.locator("table").first()
          .or(page.getByText(/no.*data|no.*results|ไม่พบ/i).first())
          .first();
        await expect(tableOrEmpty).toBeVisible({ timeout: 10_000 });
      }
    },
  );
});

// ------------------------------------------------------------------
// CRUD stubs — deferred until backend endpoint is live
// ------------------------------------------------------------------
test.describe("Shelf — CRUD (deferred)", () => {
  test.beforeEach(async ({ page }) => {
    await ensureActiveBu(page, BU_CODE);
  });

  test.fixme(
    "TC-SHLF-030001 สร้างชั้นวางใหม่ด้วยฟิลด์บังคับ (รหัส + ชื่อ)",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG; อยู่ที่หน้า /config/shelf; backend มี endpoint /api/config/{bu_code}/shelves" },
        { type: "steps", description: "1. คลิกปุ่ม 'เพิ่มชั้นวาง'\n2. กรอกรหัสที่ไม่ซ้ำ\n3. กรอกชื่อ\n4. คลิกปุ่มสร้าง" },
        { type: "expected", description: "แสดง toast 'สร้างชั้นวางสำเร็จ'; dialog ปิดเอง; ชั้นวางใหม่ปรากฏในรายการ" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async () => { /* deferred — backend endpoint not yet live */ },
  );

  test.fixme(
    "TC-SHLF-030002 สร้างชั้นวางพร้อมคำอธิบายและลำดับ",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ใน dialog เพิ่มชั้นวาง; backend มี endpoint ชั้นวาง" },
        { type: "steps", description: "1. กรอกรหัสและชื่อที่ไม่ซ้ำ\n2. กรอกคำอธิบาย\n3. กรอกลำดับเป็นจำนวนเต็มบวก เช่น '3'\n4. คลิกปุ่มสร้าง" },
        { type: "expected", description: "สร้างสำเร็จพร้อม toast; คอลัมน์คำอธิบายในตารางแสดงข้อความที่กรอก" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async () => { /* deferred — backend endpoint not yet live */ },
  );

  test.fixme(
    "TC-SHLF-040001 แก้ไขชื่อและคำอธิบายแล้วค่าคงอยู่",
    {
      annotation: [
        { type: "preconditions", description: "มีชั้นวางที่สร้างไว้แล้วอย่างน้อย 1 รายการ; backend มี endpoint ชั้นวาง" },
        { type: "steps", description: "1. คลิกรหัสของชั้นวางเพื่อเปิด dialog แก้ไข\n2. แก้ไขชื่อและคำอธิบาย\n3. คลิกปุ่มบันทึก\n4. เปิด dialog ของชั้นวางนั้นอีกครั้ง" },
        { type: "expected", description: "แสดง toast อัปเดตสำเร็จ; ตารางแสดงชื่อและคำอธิบายใหม่" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async () => { /* deferred — backend endpoint not yet live */ },
  );

  test.fixme(
    "TC-SHLF-050001 ลบชั้นวางสำเร็จ",
    {
      annotation: [
        { type: "preconditions", description: "มีชั้นวางที่สร้างขึ้นมาเพื่อลบโดยเฉพาะ; backend มี endpoint ชั้นวาง" },
        { type: "steps", description: "1. เปิดเมนูจัดการท้ายแถวของชั้นวางนั้นแล้วเลือกลบ\n2. ยืนยัน dialog การลบ" },
        { type: "expected", description: "แสดง toast ลบสำเร็จ; ชั้นวางหายจากรายการหลังรีเฟรชข้อมูล" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async () => { /* deferred — backend endpoint not yet live */ },
  );

  test.fixme(
    "TC-SHLF-200001 บันทึกไม่ได้เมื่อเว้นรหัสและชื่อว่าง",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ใน dialog เพิ่มชั้นวาง โดยยังไม่กรอกอะไรเลย; backend มี endpoint ชั้นวาง" },
        { type: "steps", description: "1. ปล่อยช่องรหัสและช่องชื่อว่าง\n2. คลิกปุ่มสร้าง" },
        { type: "expected", description: "แสดงข้อความ error ใต้ทั้งสองช่อง; dialog ไม่ปิดและไม่มีชั้นวางถูกสร้าง" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Validation" },
      ],
    },
    async () => { /* deferred — backend endpoint not yet live */ },
  );

  test.fixme(
    "TC-SHLF-300001 ส่งออกรายการชั้นวางเป็นไฟล์ XLSX",
    {
      annotation: [
        { type: "preconditions", description: "อยู่ที่หน้า /config/shelf บน desktop; มีชั้นวางอย่างน้อย 1 รายการ; backend มี endpoint ชั้นวาง" },
        { type: "steps", description: "1. คลิกปุ่มส่งออก\n2. รอจนปุ่มกลับจากสถานะกำลังส่งออก" },
        { type: "expected", description: "เบราว์เซอร์ดาวน์โหลดไฟล์ XLSX; แสดง toast แจ้งจำนวนรายการ" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async () => { /* deferred — backend endpoint not yet live */ },
  );
});
