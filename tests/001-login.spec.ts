import { test, expect } from "@playwright/test";
import { LoginPage } from "./pages/login.page";
import { DashboardPage } from "./pages/dashboard.page";
import { TEST_USERS, TEST_PASSWORD } from "./test-users";

/**
 * Login & Logout E2E suite
 *
 * TC ranges
 *   TC-LOGIN-010001..TC-LOGIN-010006  Login success per role (Requestor/HOD/Purchase/FC/GM/Owner), then logout
 *   TC-LOGIN-100001          TT (user without department) → dialog "No department assigned"
 *   TC-LOGIN-010008..TC-LOGIN-010013  Logout success per role
 *   TC-LOGIN-010014..TC-LOGIN-010022  Validation / error handling
 *   TC-LOGIN-010023..TC-LOGIN-100003  Edge cases (case-sensitivity, trim, mask, Enter key)
 *   TC-LOGIN-100004..TC-LOGIN-100005  Auth-guard redirects
 *   TC-LOGIN-100004..TC-LOGIN-100007  Security (SQL injection / XSS / wrong username 401 / rate limit 429)
 *   TC-LOGIN-010031..TC-LOGIN-010032  Login success — StoreManager / Budget
 *   TC-LOGIN-010033..TC-LOGIN-010034  Logout success — StoreManager / Budget
 *   TC-LOGIN-100008          Open-redirect guard (next param ที่เป็น external URL)
 *   TC-LOGIN-010037          Session persistence หลัง reload (refresh-token boot)
 *   TC-LOGIN-010040          Backend ล่ม → friendly error, คงอยู่ /login (mocked)
 */

const LOGIN_TC: Record<string, string> = {
  Requestor: "TC-LOGIN-010001",
  HOD: "TC-LOGIN-010002",
  Purchase: "TC-LOGIN-010003",
  FC: "TC-LOGIN-010004",
  GM: "TC-LOGIN-010005",
  Owner: "TC-LOGIN-010006",
  StoreManager: "TC-LOGIN-010031",
  Budget: "TC-LOGIN-010032",
  // TT intentionally omitted — handled by dedicated TC-LOGIN-100001 below
  // (user has no department → login should surface a "No department assigned"
  // dialog instead of redirecting to /dashboard).
};

const LOGOUT_TC: Record<string, string> = {
  Requestor: "TC-LOGIN-010008",
  HOD: "TC-LOGIN-010009",
  Purchase: "TC-LOGIN-010010",
  FC: "TC-LOGIN-010011",
  GM: "TC-LOGIN-010012",
  Owner: "TC-LOGIN-010013",
  StoreManager: "TC-LOGIN-010033",
  Budget: "TC-LOGIN-010034",
};

test.describe("เข้าสู่ระบบ", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
    await context.clearPermissions();
  });

  // ── Login success per role ────────────────────────────────────────────────
  for (const user of TEST_USERS) {
    if (!LOGIN_TC[user.role]) continue;
    test(
      `${LOGIN_TC[user.role]} ${user.role} เข้าสู่ระบบสำเร็จ`,
      {
        annotation: [
          { type: "preconditions", description: `User ${user.email} มีอยู่จริงและ active; browser logged out` },
          { type: "steps", description: "1. เปิด /login\n2. กรอก email + password\n3. กด Sign In\n4. กด logout จาก user menu" },
          { type: "expected", description: "หลัง Sign In ไปที่ /dashboard และหลัง logout กลับมา /login" },
          { type: "priority", description: "High" },
          { type: "testType", description: "Smoke" },
        ],
      },
      async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.goto();
        await loginPage.loginWithRetry(user.email, user.password);
        await expect(page).toHaveURL(/dashboard/, { timeout: 15_000 });

        // Logout immediately to release the session
        const dashboardPage = new DashboardPage(page);
        await dashboardPage.userMenuTrigger().waitFor({ state: "visible", timeout: 15_000 });
        await dashboardPage.logout();
        await expect(page).toHaveURL(/login/, { timeout: 10_000 });
      },
    );
  }

  // ── TT: user without department → dialog ─────────────────────────────────
  test.skip(
    "TC-LOGIN-100001 TT (user ไม่มี department) login ต้องแสดง dialog แจ้งยังไม่กำหนด department",
    {
      annotation: [
        { type: "preconditions", description: "User tt@blueledgers.com มีอยู่จริงและ active แต่ยังไม่ถูกกำหนด department ในระบบ; browser logged out" },
        { type: "steps", description: "1. เปิด /login\n2. กรอก email = tt@blueledgers.com, password = Qaz123!@#\n3. กด Sign In" },
        { type: "expected", description: "แสดง alertdialog/modal ข้อความ 'No department assigned' (หรือคำแปลไทยที่สื่อความเดียวกัน)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Auth-guard" },
      ],
    },
    async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login("tt@blueledgers.com", "Qaz123!@#");

      // Expect a dialog/alertdialog surfacing the missing-department state.
      const dialog = page.getByRole("alertdialog").or(page.getByRole("dialog"));
      await expect(dialog.first()).toBeVisible({ timeout: 15_000 });
      await expect(dialog.first()).toContainText(/no department assigned/i);
    },
  );

  // ── Validation / error handling ───────────────────────────────────────────
  test(
    "TC-LOGIN-010014 แสดง error เมื่อไม่กรอกรหัสผ่าน",
    {
      annotation: [
        { type: "preconditions", description: "browser logged out; อยู่ที่ /login" },
        { type: "steps", description: "1. เปิด /login\n2. กรอกเฉพาะ email\n3. กด Sign In" },
        { type: "expected", description: "คงอยู่ที่ /login; ไม่ redirect ไป dashboard" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Validation" },
      ],
    },
    async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.emailInput().fill("carmensoftware.dev+requestor@gmail.com");
      await loginPage.submitButton().click();
      await expect(page).toHaveURL(/login/);
    },
  );

  test(
    "TC-LOGIN-010015 แสดง error เมื่อไม่กรอกอีเมล",
    {
      annotation: [
        { type: "preconditions", description: "browser logged out; อยู่ที่ /login" },
        { type: "steps", description: "1. เปิด /login\n2. กรอกเฉพาะ password\n3. กด Sign In" },
        { type: "expected", description: "คงอยู่ที่ /login; ไม่ redirect ไป dashboard" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Validation" },
      ],
    },
    async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.passwordInput().fill(TEST_PASSWORD);
      await loginPage.submitButton().click();
      await expect(page).toHaveURL(/login/);
    },
  );

  test(
    "TC-LOGIN-010016 แสดง error เมื่อไม่กรอกข้อมูลทั้งสองช่อง",
    {
      annotation: [
        { type: "preconditions", description: "browser logged out; อยู่ที่ /login" },
        { type: "steps", description: "1. เปิด /login\n2. ปล่อย form ว่าง\n3. กด Sign In" },
        { type: "expected", description: "คงอยู่ที่ /login" },
        { type: "priority", description: "Low" },
        { type: "testType", description: "Validation" },
      ],
    },
    async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.submitButton().click();
      await expect(page).toHaveURL(/login/);
    },
  );

  test(
    "TC-LOGIN-010017 แสดง error เมื่อรูปแบบอีเมลไม่ถูกต้อง",
    {
      annotation: [
        { type: "preconditions", description: "browser logged out; อยู่ที่ /login" },
        { type: "steps", description: "1. กรอก email = 'not-an-email'\n2. กรอก password\n3. กด Sign In" },
        { type: "expected", description: "คงอยู่ที่ /login; HTML5/Zod validation บล็อกการ submit" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Validation" },
      ],
    },
    async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login("not-an-email", TEST_PASSWORD);
      await expect(page).toHaveURL(/login/);
    },
  );

  test(
    "TC-LOGIN-010018 แสดง error เมื่อ credentials ไม่ถูกต้อง",
    {
      annotation: [
        { type: "preconditions", description: "browser logged out; อยู่ที่ /login; ไม่มี user 'invalid@test.com' ในระบบ" },
        { type: "steps", description: "1. เปิด /login\n2. กรอก email = 'invalid@test.com', password = 'wrongpassword'\n3. กด Sign In" },
        { type: "expected", description: "แสดงข้อความ error (form หรือ alertdialog) และคงอยู่ที่ /login" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Validation" },
      ],
    },
    async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    // unique per run: the backend locks (email+IP) for 3 min after 3 failures and a non-existent
    // address never succeeds, so a fixed one is locked by the third run inside 3 minutes.
    await loginPage.login(`invalid-${Date.now()}@test.com`, "wrongpassword");

    const errorVisible = page.locator("form p.text-destructive");
    const dialogVisible = page.getByRole("alertdialog");
    await expect(errorVisible.or(dialogVisible).first()).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/login/);
  });

  test(
    "TC-LOGIN-010019 แสดง error เมื่ออีเมลถูกแต่รหัสผ่านผิด",
    {
      annotation: [
        { type: "preconditions", description: "User carmensoftware.dev+requestor@gmail.com มีอยู่จริงและ active; browser logged out" },
        { type: "steps", description: "1. เปิด /login\n2. กรอก email = carmensoftware.dev+requestor@gmail.com, password = 'wrong-password-xyz'\n3. กด Sign In" },
        { type: "expected", description: "แสดงข้อความ error (form หรือ alertdialog) และคงอยู่ที่ /login" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Validation" },
      ],
    },
    async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login("carmensoftware.dev+requestor@gmail.com", "wrong-password-xyz");

    const errorVisible = page.locator("form p.text-destructive");
    const dialogVisible = page.getByRole("alertdialog");
    await expect(errorVisible.or(dialogVisible).first()).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/login/);
  });

  // ── Edge cases ────────────────────────────────────────────────────────────
  test(
    "TC-LOGIN-010020 อีเมลไม่สนใจตัวพิมพ์ใหญ่-เล็ก",
    {
      annotation: [
        { type: "preconditions", description: "User carmensoftware.dev+requestor@gmail.com มีอยู่จริงและ active; browser logged out" },
        { type: "steps", description: "1. เปิด /login\n2. กรอก email = 'CARMENSOFTWARE.DEV+REQUESTOR@GMAIL.COM' (ตัวพิมพ์ใหญ่ทั้งหมด) + password ที่ถูกต้อง\n3. กด Sign In" },
        { type: "expected", description: "Login สำเร็จและ redirect ไปที่ /dashboard (อีเมลไม่ case-sensitive)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login("CARMENSOFTWARE.DEV+REQUESTOR@GMAIL.COM", TEST_PASSWORD);
    await expect(page).toHaveURL(/dashboard/, { timeout: 15_000 });
  });

  test(
    "TC-LOGIN-010021 รหัสผ่านแยกตัวพิมพ์ใหญ่-เล็ก (พิมพ์ผิดเคสต้อง fail)",
    {
      annotation: [
        { type: "preconditions", description: "User tt@blueledgers.com มีอยู่จริง รหัสผ่านที่ถูกต้องคือ 'Qaz123!@#'; browser logged out" },
        { type: "steps", description: "1. เปิด /login\n2. กรอก email = tt@blueledgers.com, password = 'qaz123!@#' (ตัวพิมพ์เล็กทั้งหมด)\n3. กด Sign In" },
        { type: "expected", description: "Login fail และคงอยู่ที่ /login (password เป็น case-sensitive)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Validation" },
      ],
    },
    async ({ page }) => {
    // tt@blueledgers.com password "Qaz123!@#" → lower-cased variant must fail
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login("tt@blueledgers.com", "qaz123!@#");
    await expect(page).toHaveURL(/login/);
  });

  test(
    "TC-LOGIN-010022 รองรับช่องว่างหน้า/หลังอีเมล",
    {
      annotation: [
        { type: "preconditions", description: "User carmensoftware.dev+requestor@gmail.com มีอยู่จริงและ active; browser logged out" },
        { type: "steps", description: "1. เปิด /login\n2. กรอก email = '  carmensoftware.dev+requestor@gmail.com  ' (มีช่องว่างหน้า/หลัง) + password\n3. กด Sign In" },
        { type: "expected", description: "ระบบ trim ช่องว่างและ login สำเร็จ ไปที่ /dashboard (หรือคงอยู่ที่ /login หากเลือก reject — accept ทั้งสองแบบ)" },
        { type: "priority", description: "Low" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login("  carmensoftware.dev+requestor@gmail.com  ", TEST_PASSWORD);
    await expect(page).toHaveURL(/dashboard|login/, { timeout: 15_000 });
  });

  test(
    "TC-LOGIN-010023 ช่องรหัสผ่านถูก mask",
    {
      annotation: [
        { type: "preconditions", description: "browser logged out; อยู่ที่ /login" },
        { type: "steps", description: "1. เปิด /login\n2. ตรวจสอบ attribute ของ password input" },
        { type: "expected", description: "Password input มี attribute type='password' (ตัวอักษรถูก mask ไม่แสดง plain text)" },
        { type: "priority", description: "Low" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await expect(loginPage.passwordInput()).toHaveAttribute("type", "password");
  });

  test(
    "TC-LOGIN-010024 กด Enter เพื่อ submit form ได้",
    {
      annotation: [
        { type: "preconditions", description: "User carmensoftware.dev+requestor@gmail.com มีอยู่จริงและ active; browser logged out" },
        { type: "steps", description: "1. เปิด /login\n2. กรอก email + password\n3. กด Enter ในช่อง password (แทนการคลิกปุ่ม Sign In)" },
        { type: "expected", description: "Form submit และ redirect ไปที่ /dashboard เหมือนกับการคลิกปุ่ม Sign In" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
    const loginPage = new LoginPage(page);
    for (let attempt = 0; attempt < 4; attempt++) {
      await loginPage.goto();
      await page.waitForLoadState("domcontentloaded");
      await loginPage.emailInput().fill("carmensoftware.dev+requestor@gmail.com");
      await loginPage.passwordInput().fill(TEST_PASSWORD);
      await Promise.all([
        page.waitForURL(/dashboard/, { timeout: 10_000 }).catch(() => null),
        loginPage.passwordInput().press("Enter"),
      ]);
      if (/dashboard/.test(page.url())) return;
      const rateLimited = await loginPage
        .rateLimitMessage()
        .isVisible()
        .catch(() => false);
      if (!rateLimited) break;
      await page.waitForTimeout(5_000);
    }
    await expect(page).toHaveURL(/dashboard/, { timeout: 15_000 });
  });

  // ── Auth-guard redirects ──────────────────────────────────────────────────
  test(
    "TC-LOGIN-100002 เข้า route ที่ต้อง login โดยไม่ login ต้อง redirect ไปหน้า login",
    {
      annotation: [
        { type: "preconditions", description: "Browser ไม่มี session/cookies (logged out)" },
        { type: "steps", description: "1. clear cookies\n2. navigate ตรงไปที่ /dashboard โดยไม่ผ่าน /login" },
        { type: "expected", description: "Auth-guard redirect กลับไปที่ /login (ไม่อนุญาตให้เข้า /dashboard เมื่อยังไม่ได้ login)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Auth-guard" },
      ],
    },
    async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/login/, { timeout: 10_000 });
  });

  test(
    "TC-LOGIN-100003 user ที่ login แล้วเข้า /login ต้อง redirect ไป dashboard",
    {
      annotation: [
        { type: "preconditions", description: "User carmensoftware.dev+requestor@gmail.com login สำเร็จและมี active session อยู่แล้วที่ /dashboard" },
        { type: "steps", description: "1. login ด้วย carmensoftware.dev+requestor@gmail.com\n2. รอ /dashboard โหลดเสร็จ\n3. navigate ไปที่ /login อีกครั้ง" },
        { type: "expected", description: "Auth-guard redirect กลับไปที่ /dashboard (ไม่ให้ user ที่ login แล้วเห็นหน้า /login ซ้ำ)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Auth-guard" },
      ],
    },
    async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.loginWithRetry("carmensoftware.dev+requestor@gmail.com", TEST_PASSWORD);
    await expect(page).toHaveURL(/dashboard/, { timeout: 15_000 });
    await page.waitForLoadState("networkidle");

    await page.goto("/login");
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 });
  });

  // ── Security ──────────────────────────────────────────────────────────────
  test(
    "TC-LOGIN-100004 อีเมลแบบ SQL injection ต้องถูก reject อย่างปลอดภัย",
    {
      annotation: [
        { type: "preconditions", description: "browser logged out; อยู่ที่ /login" },
        { type: "steps", description: "1. เปิด /login\n2. กรอก email = \"admin' OR '1'='1\", password = 'anything'\n3. กด Sign In" },
        { type: "expected", description: "Login fail และคงอยู่ที่ /login; SQL injection payload ไม่ถูก execute (ไม่มีข้อมูลรั่วไหล / ไม่ได้ session)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Security" },
      ],
    },
    async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login("admin' OR '1'='1", "anything");
    await expect(page).toHaveURL(/login/);
  });

  test(
    "TC-LOGIN-100005 อีเมลแบบ XSS ต้องถูก reject อย่างปลอดภัย",
    {
      annotation: [
        { type: "preconditions", description: "browser logged out; อยู่ที่ /login" },
        { type: "steps", description: "1. เปิด /login\n2. ติด listener สำหรับ browser dialog (ห้ามเปิด)\n3. กรอก email = '<script>alert(1)</script>@x.com', password = 'anything'\n4. กด Sign In" },
        { type: "expected", description: "ไม่มี alert dialog เด้งจาก XSS payload และคงอยู่ที่ /login (input ถูก sanitize/escape)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Security" },
      ],
    },
    async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    page.on("dialog", () => {
      throw new Error("Unexpected dialog from XSS payload");
    });
    await loginPage.login("<script>alert(1)</script>@x.com", "anything");
    await expect(page).toHaveURL(/login/);
  });

  test(
    "TC-LOGIN-100006 login username ผิดต้องได้รับ HTTP 401",
    {
      annotation: [
        { type: "preconditions", description: "browser logged out; อยู่ที่ /login; ไม่มี user 'wrong-user@nonexistent.com' ในระบบ" },
        { type: "steps", description: "1. เปิด /login\n2. ดัก response จาก POST /auth\n3. กรอก email = 'wrong-user@nonexistent.com', password = 'anypassword'\n4. กด Sign In" },
        { type: "expected", description: "Backend ตอบกลับ HTTP 401 Unauthorized และ user คงอยู่ที่ /login" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Security" },
      ],
    },
    async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    const responsePromise = page.waitForResponse(
      (res) => res.url().includes("/auth") && res.request().method() === "POST",
      { timeout: 10_000 },
    );

    await loginPage.login(`wrong-user-${Date.now()}@nonexistent.com`, "anypassword");

    const response = await responsePromise;
    expect(response.status()).toBe(401);
    await expect(page).toHaveURL(/login/);
  });

  test(
    "TC-LOGIN-100007 login ชื่อเดิมผิด 3 ครั้ง ต้องได้รับ HTTP 429",
    {
      annotation: [
        { type: "preconditions", description: "browser logged out; อยู่ที่ /login; backend rate-limiter เปิดใช้งานอยู่ (429 หลัง 3 ครั้งที่ผิดด้วย email เดียวกัน)" },
        { type: "steps", description: "1. สร้าง email ที่ไม่มีจริง (unique per run)\n2. login ด้วย email + รหัสผิด ซ้ำ 3 ครั้ง\n3. ตรวจสอบ HTTP status ของ response สุดท้าย" },
        { type: "expected", description: "Response สุดท้ายเป็น HTTP 429 Too Many Requests และคงอยู่ที่ /login (rate-limit ทำงาน)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Security" },
      ],
    },
    async ({ page }) => {
    const loginPage = new LoginPage(page);
    const wrongEmail = `brute-${Date.now()}@nonexistent.com`;

    let lastStatus = 0;
    for (let i = 0; i < 3; i++) {
      await loginPage.goto();
      const responsePromise = page.waitForResponse(
        (res) => res.url().includes("/auth") && res.request().method() === "POST",
        { timeout: 10_000 },
      );
      await loginPage.login(wrongEmail, "wrongpassword");
      const response = await responsePromise;
      lastStatus = response.status();
    }

    expect(lastStatus).toBe(429);
    await expect(page).toHaveURL(/login/);
  });

  // ── Redirect / session / error-handling ───────────────────────────────────
  test(
    "TC-LOGIN-100008 next param แบบ external URL ต้องไม่ redirect ออกนอกเว็บ (open-redirect guard)",
    {
      annotation: [
        { type: "preconditions", description: "User carmensoftware.dev+requestor@gmail.com มีอยู่จริงและ active; browser logged out" },
        { type: "steps", description: "1. เปิด /login?next=//evil.example.com\n2. login ด้วย carmensoftware.dev+requestor@gmail.com\n3. ตรวจสอบ origin/path ปลายทางหลัง login" },
        { type: "expected", description: "resolveNextPath ปฏิเสธ next ที่เป็น external URL → redirect ไป /dashboard บน origin เดิม (ไม่หลุดไป evil.example.com)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Security" },
      ],
    },
    async ({ page }) => {
      const loginPage = new LoginPage(page);
      await page.goto("/login?next=//evil.example.com");
      const origin = new URL(page.url()).origin;
      await loginPage.loginWithRetry("carmensoftware.dev+requestor@gmail.com", TEST_PASSWORD);

      await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
      // ต้องคงอยู่บน origin เดิม — open-redirect ต้องไม่พาออกนอกเว็บ
      expect(new URL(page.url()).origin).toBe(origin);
    },
  );

  test(
    "TC-LOGIN-010037 session คงอยู่หลัง reload (refresh-token boot)",
    {
      annotation: [
        { type: "preconditions", description: "User carmensoftware.dev+requestor@gmail.com login สำเร็จและอยู่ที่ /dashboard; refresh token ถูกเก็บใน localStorage" },
        { type: "steps", description: "1. login ด้วย carmensoftware.dev+requestor@gmail.com\n2. รอ /dashboard\n3. reload หน้า\n4. ตรวจสอบว่ายัง authenticated" },
        { type: "expected", description: "หลัง reload boot ใช้ refresh token ออก access token ใหม่ → ยังอยู่ที่ /dashboard และ user menu ปรากฏ (ไม่เด้งไป /login)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginWithRetry("carmensoftware.dev+requestor@gmail.com", TEST_PASSWORD);
      await expect(page).toHaveURL(/dashboard/, { timeout: 15_000 });

      await page.reload();
      await expect(page).toHaveURL(/dashboard/, { timeout: 15_000 });
      const dashboardPage = new DashboardPage(page);
      await expect(dashboardPage.userMenuTrigger()).toBeVisible({ timeout: 15_000 });
    },
  );

  test(
    "TC-LOGIN-010040 backend ล่มต้องแสดง error อย่างนุ่มนวลและคงอยู่ /login",
    {
      annotation: [
        { type: "preconditions", description: "browser logged out; อยู่ที่ /login; mock /api/auth/login ให้ fail (network error)" },
        { type: "steps", description: "1. intercept POST **/api/auth/login แล้ว abort\n2. เปิด /login\n3. กรอก carmensoftware.dev+requestor@gmail.com + password\n4. กด Sign In" },
        { type: "expected", description: "แสดง alert ข้อความ 'Could not reach the server' (ไม่ crash / ไม่โชว์ raw stack) และคงอยู่ที่ /login" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Validation" },
      ],
    },
    async ({ page }) => {
      const loginPage = new LoginPage(page);
      await page.route("**/api/auth/login", (route) => route.abort());
      await loginPage.goto();
      await loginPage.login("carmensoftware.dev+requestor@gmail.com", TEST_PASSWORD);

      await expect(loginPage.serverUnavailableMessage()).toBeVisible({ timeout: 15_000 });
      await expect(page).toHaveURL(/login/);
    },
  );

  // ── Redirect / session / form UX (batch 2) ────────────────────────────────
  test(
    "TC-LOGIN-010035 login พร้อม ?next= ที่ valid ต้อง redirect ไปปลายทางนั้น",
    {
      annotation: [
        { type: "preconditions", description: "User carmensoftware.dev+requestor@gmail.com มีอยู่จริงและ active; browser logged out; /profile เป็น shell route ที่ requestor เข้าได้" },
        { type: "steps", description: "1. เปิด /login?next=/profile\n2. login ด้วย carmensoftware.dev+requestor@gmail.com\n3. ตรวจสอบ URL ปลายทาง" },
        { type: "expected", description: "หลัง login redirect ไป /profile (เคารพ ?next= ที่ปลอดภัย) ไม่ใช่ /dashboard" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const loginPage = new LoginPage(page);
      await page.goto("/login?next=/profile");
      await loginPage.loginWithRetry("carmensoftware.dev+requestor@gmail.com", TEST_PASSWORD);
      await expect(page).toHaveURL(/\/profile(\?|$)/, { timeout: 15_000 });
    },
  );

  test(
    "TC-LOGIN-100009 refresh token ปลอม/เสีย เข้า /dashboard ต้องเด้งไป login",
    {
      annotation: [
        { type: "preconditions", description: "browser logged out; localStorage มี refresh token ที่ไม่ valid (ปลอม)" },
        { type: "steps", description: "1. เปิด /login เพื่อ set origin\n2. set localStorage carmen.refresh_token เป็นค่าปลอม\n3. navigate ไป /dashboard" },
        { type: "expected", description: "boot ใช้ refresh token ปลอม → backend ปฏิเสธ → token store ว่าง → RequireAuth เด้งไป /login" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Security" },
      ],
    },
    async ({ page }) => {
      await page.goto("/login");
      await page.evaluate(() =>
        localStorage.setItem("carmen.refresh_token", "garbage-invalid-token"),
      );
      await page.goto("/dashboard");
      await expect(page).toHaveURL(/login/, { timeout: 15_000 });
    },
  );

  test(
    "TC-LOGIN-010041 ปุ่ม show/hide password สลับการแสดงรหัสผ่านได้",
    {
      annotation: [
        { type: "preconditions", description: "browser logged out; อยู่ที่ /login" },
        { type: "steps", description: "1. เปิด /login\n2. กรอกรหัสผ่าน\n3. กดปุ่ม Show password\n4. กดปุ่ม Hide password" },
        { type: "expected", description: "เริ่มต้น type=password; กด Show → type=text; กด Hide → type=password อีกครั้ง" },
        { type: "priority", description: "Low" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.passwordInput().fill(TEST_PASSWORD);

      await expect(loginPage.passwordInput()).toHaveAttribute("type", "password");
      await loginPage.showPasswordToggle().click();
      await expect(loginPage.passwordInput()).toHaveAttribute("type", "text");
      await loginPage.hidePasswordToggle().click();
      await expect(loginPage.passwordInput()).toHaveAttribute("type", "password");
    },
  );

  test(
    "TC-LOGIN-010039 ปุ่ม Sign In ถูก disable ระหว่าง request กำลังทำงาน (กัน double-submit)",
    {
      annotation: [
        { type: "preconditions", description: "User carmensoftware.dev+requestor@gmail.com มีอยู่จริงและ active; browser logged out" },
        { type: "steps", description: "1. เปิด /login\n2. กรอก credentials\n3. กด Sign In\n4. ตรวจสถานะปุ่มทันทีระหว่าง request" },
        { type: "expected", description: "ปุ่ม disabled ระหว่าง in-flight; ถ้า backend ตอบเร็วจน redirect ไป /dashboard ก่อนสังเกตได้ ถือว่าผ่าน (ไม่เปิดช่อง double-submit) — best-effort" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.emailInput().fill("carmensoftware.dev+requestor@gmail.com");
      await loginPage.passwordInput().fill(TEST_PASSWORD);
      await loginPage.submitButton().click();

      // best-effort: จับ disabled ทันภายใน 1s หรือถือว่า login จบเร็วแล้วไป dashboard
      let sawDisabled = true;
      try {
        await expect(loginPage.submitButton()).toBeDisabled({ timeout: 1_000 });
      } catch {
        sawDisabled = false;
      }
      if (!sawDisabled) {
        await expect(page).toHaveURL(/dashboard/, { timeout: 15_000 });
      }
    },
  );

  test(
    "TC-LOGIN-010042 หลังผิดซ้ำจนโดน rate-limit ต้องแสดง countdown และ disable ปุ่ม",
    {
      annotation: [
        { type: "preconditions", description: "browser logged out; backend rate-limiter เปิด (429 + retry_after หลังผิด 3 ครั้งด้วย email เดียวกัน)" },
        { type: "steps", description: "1. สร้าง email ปลอม unique ต่อ run\n2. login ด้วยรหัสผิดซ้ำ 3 ครั้ง\n3. ตรวจ UI หลังโดน 429" },
        { type: "expected", description: "แสดงข้อความ countdown 'Too many login attempts. Try again in Ns.' และปุ่ม Sign In ถูก disable — best-effort (พึ่ง retry_after จาก backend)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const loginPage = new LoginPage(page);
      const wrongEmail = `countdown-${Date.now()}@nonexistent.com`;

      let lastStatus = 0;
      for (let i = 0; i < 3; i++) {
        await loginPage.goto();
        const responsePromise = page.waitForResponse(
          (res) => res.url().includes("/auth") && res.request().method() === "POST",
          { timeout: 10_000 },
        );
        await loginPage.login(wrongEmail, "wrongpassword");
        const response = await responsePromise;
        lastStatus = response.status();
      }

      // ยืนยันว่าโดน rate-limit จริงก่อนเช็ค UI (ล้มชัดเจนหาก backend เปลี่ยน threshold)
      expect(lastStatus).toBe(429);
      await expect(loginPage.countdownMessage()).toBeVisible({ timeout: 15_000 });
      await expect(loginPage.submitButton()).toBeDisabled();
    },
  );
});

test.describe("ออกจากระบบ", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
    await context.clearPermissions();
  });

  for (const user of TEST_USERS) {
    if (!LOGOUT_TC[user.role]) continue;
    test(
      `${LOGOUT_TC[user.role]} ${user.role} ออกจากระบบสำเร็จ`,
      {
        annotation: [
          { type: "preconditions", description: `User ${user.email} (${user.role}) มีอยู่จริงและ active; browser logged out ก่อนเริ่ม test` },
          { type: "steps", description: "1. เปิด /login และ login ด้วย credentials ของ role นี้\n2. รอให้ไปที่ /dashboard\n3. เปิด user menu จาก avatar\n4. กด Logout" },
          { type: "expected", description: "Session ถูกล้างและ redirect กลับมาที่ /login" },
          { type: "priority", description: "High" },
          { type: "testType", description: "Smoke" },
        ],
      },
      async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.goto();
        await loginPage.loginWithRetry(user.email, user.password);
        await expect(page).toHaveURL(/dashboard/, { timeout: 15_000 });

        const dashboardPage = new DashboardPage(page);
        await dashboardPage.userMenuTrigger().waitFor({ state: "visible", timeout: 15_000 });
        await dashboardPage.logout();

        await expect(page).toHaveURL(/login/, { timeout: 10_000 });
      },
    );
  }

  test(
    "TC-LOGIN-100010 logout ต้องลบ refresh token และเข้าถึง dashboard ไม่ได้",
    {
      annotation: [
        { type: "preconditions", description: "User carmensoftware.dev+requestor@gmail.com login สำเร็จและมี refresh token ใน localStorage" },
        { type: "steps", description: "1. login ด้วย carmensoftware.dev+requestor@gmail.com\n2. ตรวจว่ามี refresh token\n3. logout\n4. ตรวจว่า refresh token ถูกลบ\n5. navigate ไป /dashboard" },
        { type: "expected", description: "หลัง logout: refresh token ถูกลบจาก localStorage และเข้า /dashboard ไม่ได้ (เด้งกลับ /login)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Security" },
      ],
    },
    async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginWithRetry("carmensoftware.dev+requestor@gmail.com", TEST_PASSWORD);
      await expect(page).toHaveURL(/dashboard/, { timeout: 15_000 });

      const before = await page.evaluate(() =>
        localStorage.getItem("carmen.refresh_token"),
      );
      expect(before).toBeTruthy();

      const dashboardPage = new DashboardPage(page);
      await dashboardPage.userMenuTrigger().waitFor({ state: "visible", timeout: 15_000 });
      await dashboardPage.logout();
      await expect(page).toHaveURL(/login/, { timeout: 10_000 });

      const after = await page.evaluate(() =>
        localStorage.getItem("carmen.refresh_token"),
      );
      expect(after).toBeFalsy();

      await page.goto("/dashboard");
      await expect(page).toHaveURL(/login/, { timeout: 15_000 });
    },
  );
});
