/**
 * SPA cross-section smoke — ย้ายมาจาก carmen-inventory-frontend-react/e2e/
 * (login-page / authenticated-config / authenticated-procurement /
 * authenticated-shell specs ของ repo SPA เดิม รวมเป็นไฟล์เดียวตาม convention ที่นี่)
 *
 * จุดประสงค์: ยืนยันว่า frontend ที่กำลังทดสอบ (ตั้งผ่าน E2E_FRONTEND_DIR /
 * E2E_BASE_URL — ใช้ได้ทั้งแอป Next เดิมและ React SPA) boot + auth guard +
 * ทุก section หลัก render ได้จริง โดยไม่เจาะลึกราย module (มี spec รายโมดูลอยู่แล้ว)
 *
 * หมายเหตุ SPA (carmen-inventory-frontend-react):
 *   E2E_FRONTEND_DIR=../carmen-inventory-frontend-react \
 *   VITE_DEV_PROXY_TARGET=<backend-url> bun e2e
 *   (Vite dev server รับ env ผ่าน webServer; ดู README "Testing the React SPA")
 */
import { test as base, expect } from "@playwright/test";
import { createAuthTest } from "./fixtures/auth.fixture";

const test = createAuthTest("carmensoftware.dev+admin@gmail.com");

test.describe("SPA Smoke — auth guard", () => {
  // ใช้ base test (ไม่มี storageState) — ต้องเป็น context สะอาดเพื่อทดสอบ redirect
  base(
    "TC-SPA-010001 ผู้ใช้ที่ยังไม่ login ถูก redirect ไปหน้า login",
    {
      annotation: [
        { type: "preconditions", description: "ไม่มี session (browser context สะอาด)" },
        { type: "steps", description: "1. เปิด /dashboard ตรงๆ โดยไม่ login" },
        { type: "expected", description: "ถูก redirect ไป /login และฟอร์ม login แสดง (email field + ปุ่ม Sign In)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page }) => {
      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/login$/, { timeout: 15_000 });
      await expect(page.getByRole("textbox").first()).toBeVisible();
      await expect(
        page.getByRole("button", { name: /sign in/i }),
      ).toBeVisible();
    },
  );
});

test.describe("SPA Smoke — dashboard & shell", () => {
  test(
    "TC-SPA-010002 dashboard จริง render (ไม่ใช่ placeholder)",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น admin ผ่าน auth fixture" },
        { type: "steps", description: "1. ไปที่ /dashboard" },
        { type: "expected", description: "ไม่มีข้อความ placeholder 'lands in a later phase'; heading ของ dashboard แสดง" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page }) => {
      await page.goto("/dashboard");
      await expect(page.getByText(/lands in a later phase/i)).toHaveCount(0);
      await expect(page.getByRole("heading").first()).toBeVisible({
        timeout: 10_000,
      });
    },
  );

  test(
    "TC-SPA-010003 หน้า shell (report/profile/notifications) เปิดได้ ไม่เป็น 404",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น admin ผ่าน auth fixture" },
        { type: "steps", description: "1. ไปที่ /report/list 2. /profile 3. /notifications" },
        { type: "expected", description: "ทุกหน้าแสดง UI จริง ไม่พบข้อความ 404/not found" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page }) => {
      for (const path of ["/report/list", "/profile", "/notifications"]) {
        await page.goto(path);
        await expect(page.getByText(/404|not found/i)).toHaveCount(0);
        await expect(page.getByRole("heading").first()).toBeVisible({
          timeout: 10_000,
        });
      }
    },
  );
});

test.describe("SPA Smoke — config", () => {
  test(
    "TC-SPA-010004 config lists render (dialog-based + page-based)",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น admin ผ่าน auth fixture" },
        { type: "steps", description: "1. /config/unit 2. /config/department 3. /config/department/new 4. /config" },
        { type: "expected", description: "ตาราง list แสดง (unit, department); ฟอร์ม department/new แสดง; landing ไม่เป็น 404" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page }) => {
      await page.goto("/config/unit");
      await expect(page.getByRole("table").first()).toBeVisible({
        timeout: 10_000,
      });
      expect(await page.getByRole("row").count()).toBeGreaterThan(1);

      await page.goto("/config/department");
      await expect(page.getByRole("table").first()).toBeVisible({
        timeout: 10_000,
      });
      expect(await page.getByRole("row").count()).toBeGreaterThan(1);

      await page.goto("/config/department/new");
      await expect(page.locator("#department-form")).toBeVisible({
        timeout: 10_000,
      });

      await page.goto("/config");
      await expect(page.getByText(/404|not found/i)).toHaveCount(0);
    },
  );
});

test.describe("SPA Smoke — procurement", () => {
  test(
    "TC-SPA-010005 procurement lists render ครบทุกโมดูล",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น admin ผ่าน auth fixture" },
        { type: "steps", description: "1. เปิด list ของ PRT, CN, GRN, PO, PR ตามลำดับ" },
        { type: "expected", description: "ทุก list แสดงตาราง (header แสดงเสมอแม้ไม่มีข้อมูล)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page }) => {
      for (const path of [
        "/procurement/purchase-request-template",
        "/procurement/credit-note",
        "/procurement/goods-receive-note",
        "/procurement/purchase-order",
        "/procurement/purchase-request",
      ]) {
        await page.goto(path);
        await expect(page.getByRole("table").first()).toBeVisible({
          timeout: 10_000,
        });
      }
    },
  );

  test(
    "TC-SPA-010006 PR detail เปิดจาก list ได้ (ถ้ามีข้อมูล) + landing/approval ไม่เป็น 404",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น admin ผ่าน auth fixture" },
        { type: "steps", description: "1. /procurement/purchase-request คลิกปุ่มแถวแรกใน tbody 2. /procurement 3. /procurement/my-approval" },
        { type: "expected", description: "คลิกแล้ว URL เป็น /purchase-request/<id> (ข้ามถ้า list ว่าง); landing + approval ไม่เป็น 404" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page }) => {
      await page.goto("/procurement/purchase-request");
      await expect(page.getByRole("table").first()).toBeVisible({
        timeout: 10_000,
      });
      const firstCellButton = page.locator("table tbody button").first();
      if (await firstCellButton.count()) {
        await firstCellButton.click();
        await expect(page).toHaveURL(/purchase-request\/[\w-]+/, {
          timeout: 10_000,
        });
      }

      for (const path of ["/procurement", "/procurement/my-approval"]) {
        await page.goto(path);
        await expect(page.getByText(/404|not found/i)).toHaveCount(0);
      }
    },
  );
});
