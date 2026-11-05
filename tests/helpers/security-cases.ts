import { expect, type Page } from "@playwright/test";
import { ConfigListPage } from "../pages/config-list.page";
import type { DialogCrudHelper } from "../pages/dialog-crud.helper";
import type { PageFormCrudHelper } from "../pages/page-form-crud.helper";
import { fakeCode } from "./test-data";

export const XSS_PAYLOAD = "<script>alert('xss-e2e')</script>";
export const SQL_PAYLOAD = "'; DROP TABLE users; --";
export const LONG_NAME = "a".repeat(200);

/**
 * No browser dialog from XSS payload should ever appear during a test.
 * Caller should attach this listener at test start.
 */
export function attachNoXssDialogGuard(page: Page) {
  page.on("dialog", (d) => {
    throw new Error(`Unexpected browser dialog from XSS payload: ${d.message()}`);
  });
}

/**
 * Add 4 security test cases (XSS / SQL injection / max-length / authorization)
 * to a dialog-based config module spec.
 *
 * Usage in a spec file (after the existing CRUD tests):
 *   addDialogSecurityCases(test, {
 *     prefix: "BT",
 *     listPath: "/config/business-type",
 *     makeHelper: (page) => new DialogCrudHelper(page, opts),
 *   });
 */
export function addDialogSecurityCases(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  test: any,
  opts: {
    prefix: string;
    listPath: string;
    makeHelper: (page: Page) => DialogCrudHelper;
    /** Skip the authorization case (TC-XX-100004) */
    skipAuth?: boolean;
  },
) {
  const { prefix, listPath, makeHelper, skipAuth = false } = opts;

  test(
    `TC-${prefix}-100001 XSS payload ในชื่อต้องไม่รัน script`,
    {
      annotation: [
        { type: "preconditions", description: `Logged in user with permission to access ${listPath}; XSS dialog guard attached` },
        { type: "steps", description: `1. เปิด list ${listPath}\n2. คลิก Add เพื่อเปิด dialog\n3. กรอก name ด้วย XSS payload "<script>alert('xss-e2e')</script>"\n4. กด Save` },
        { type: "expected", description: "ไม่มี browser alert/dialog จาก payload (script ไม่ถูก execute); หาก dialog ยังเปิดอยู่ก็ปิดได้ปกติ" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Security" },
      ],
    },
    async ({ page }: { page: Page }) => {
    attachNoXssDialogGuard(page);
    const h = makeHelper(page);
    await h.list.goto();
    await h.openAddDialog();
    await h.nameInput().fill(XSS_PAYLOAD);
    await h.saveButton().click();
    // No alert dialog from XSS — guard above will throw if it fires
    // Either created safely (text escaped) OR validation rejects
    await page.waitForTimeout(500);
    if (await h.dialog().isVisible().catch(() => false)) {
      await h.cancelButton().click();
    }
  });

  test(
    `TC-${prefix}-100002 SQL injection payload ต้องไม่ทำให้ระบบ crash`,
    {
      annotation: [
        { type: "preconditions", description: `Logged in user with permission to access ${listPath}` },
        { type: "steps", description: `1. เปิด list ${listPath}\n2. พิมพ์ SQL injection payload "'; DROP TABLE users; --" ลงในช่องค้นหา` },
        { type: "expected", description: "หน้าไม่ crash; ปุ่ม Add ยังคง visible (list ทำงานปกติ)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Security" },
      ],
    },
    async ({ page }: { page: Page }) => {
    const h = makeHelper(page);
    await h.list.goto();
    await h.list.search(SQL_PAYLOAD);
    // List page must remain functional
    await expect(h.list.addButton()).toBeVisible();
  });

  test(
    `TC-${prefix}-100003 ชื่อยาวเกิน maxLength ต้องถูกจำกัดที่ 100`,
    {
      annotation: [
        { type: "preconditions", description: `Logged in user with permission to access ${listPath}` },
        { type: "steps", description: `1. เปิด list ${listPath}\n2. คลิก Add เพื่อเปิด dialog\n3. กรอก name ด้วย string ยาว 200 ตัวอักษร ('a' x 200)` },
        { type: "expected", description: "ค่าใน input ถูก clamp ที่ ≤ 100 ตัวอักษร (maxLength enforced)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Validation" },
      ],
    },
    async ({ page }: { page: Page }) => {
    const h = makeHelper(page);
    await h.list.goto();
    await h.openAddDialog();
    await h.nameInput().fill(LONG_NAME);
    const value = await h.nameInput().inputValue();
    expect(value.length).toBeLessThanOrEqual(100);
    await h.cancelButton().click();
  });

  const dialogAuthTest = skipAuth ? test.skip : test;
  dialogAuthTest(
    `TC-${prefix}-100004 user สิทธิ์ต่ำเข้าหน้านี้ต้องไม่เห็นปุ่ม Add หรือถูก redirect`,
    {
      annotation: [
        { type: "preconditions", description: `Test user carmensoftware.dev+requestor@gmail.com (low-privilege role) มีอยู่จริง; module list path = ${listPath}` },
        { type: "steps", description: `1. เปิด browser context ใหม่\n2. login เป็น carmensoftware.dev+requestor@gmail.com\n3. ไปที่ ${listPath}` },
        { type: "expected", description: `User ถูก redirect ออกจาก ${listPath} หรือ ปุ่ม Add ไม่ปรากฏ (count = 0)` },
        { type: "priority", description: "High" },
        { type: "testType", description: "Authorization" },
      ],
    },
    async ({
    browser,
  }: {
    browser: import("@playwright/test").Browser;
  }) => {
    // No session: inside createAuthTest specs, browser.newContext() inherits the role's storageState
    // (see 081-chart-of-account-mapping.spec.ts) — clear it explicitly.
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    const { LoginPage } = await import("../pages/login.page");
    const { TEST_PASSWORD } = await import("../test-users");
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.loginWithRetry("carmensoftware.dev+requestor@gmail.com", TEST_PASSWORD);
    await page.waitForURL(/dashboard/, { timeout: 15_000 });
    await page.goto(listPath);
    await page.waitForLoadState("networkidle");
    const url = page.url();
    const list = new ConfigListPage(page, listPath);
    const onPage = url.includes(listPath);
    if (onPage) {
      // Page accessible — Add button must NOT be visible to non-admin
      await expect(list.addButton()).toHaveCount(0);
    }
    // Otherwise: redirected away → also acceptable
    await ctx.close();
  });
}

/**
 * Add 4 security cases for page-form-based modules.
 */
export function addPageFormSecurityCases(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  test: any,
  opts: {
    prefix: string;
    listPath: string;
    makeHelper: (page: Page) => PageFormCrudHelper;
    /** Skip the authorization case (TC-XX-100004) */
    skipAuth?: boolean;
  },
) {
  const { prefix, listPath, makeHelper, skipAuth = false } = opts;
  const tcXss = `TC-${prefix}-100001`;
  const tcSql = `TC-${prefix}-100002`;
  const tcLen = `TC-${prefix}-100003`;
  const tcAuth = `TC-${prefix}-100004`;

  test(
    `${tcXss} XSS payload ในชื่อต้องไม่รัน script`,
    {
      annotation: [
        { type: "preconditions", description: `Logged in user with permission to access ${listPath}; XSS dialog guard attached` },
        { type: "steps", description: `1. เปิด new form ของ ${listPath}\n2. กรอก code ด้วย random suffix\n3. กรอก name ด้วย XSS payload "<script>alert('xss-e2e')</script>"\n4. กด Save` },
        { type: "expected", description: "ไม่มี browser alert/dialog จาก payload; URL ยังคงอยู่ภายใต้ /config/ (ฟอร์มอาจ reject หรือ save แบบ escaped)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Security" },
      ],
    },
    async ({ page }: { page: Page }) => {
    attachNoXssDialogGuard(page);
    const h = makeHelper(page);
    await h.gotoNew();
    // fakeCode is process-stable (prefix + shortUid), not per-call fresh; fine here —
    // the code value is irrelevant to the XSS assertion and unique per entity type.
    await h.codeInput().fill(fakeCode("X"));
    await h.nameInput().fill(XSS_PAYLOAD);
    await h.saveButton().click();
    await page.waitForTimeout(500);
    // Either form rejects or saves with escaped text — neither must crash
    expect(page.url()).toContain("/config/");
  });

  test(
    `${tcSql} SQL injection payload ต้องไม่ทำให้ระบบ crash`,
    {
      annotation: [
        { type: "preconditions", description: `Logged in user with permission to access ${listPath}` },
        { type: "steps", description: `1. เปิด list ${listPath}\n2. พิมพ์ SQL injection payload "'; DROP TABLE users; --" ลงในช่องค้นหา` },
        { type: "expected", description: "หน้าไม่ crash; ปุ่ม Add ยังคง visible (list ทำงานปกติ)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Security" },
      ],
    },
    async ({ page }: { page: Page }) => {
    const h = makeHelper(page);
    await h.list.goto();
    await h.list.search(SQL_PAYLOAD);
    await expect(h.list.addButton()).toBeVisible();
  });

  test(
    `${tcLen} ชื่อยาวเกิน maxLength ต้องถูกจำกัดที่ 100`,
    {
      annotation: [
        { type: "preconditions", description: `Logged in user with permission to access ${listPath}` },
        { type: "steps", description: `1. เปิด new form ของ ${listPath}\n2. กรอก name ด้วย string ยาว 200 ตัวอักษร ('a' x 200)` },
        { type: "expected", description: "ค่าใน input ถูก clamp ที่ ≤ 100 ตัวอักษร (maxLength enforced)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Validation" },
      ],
    },
    async ({ page }: { page: Page }) => {
    const h = makeHelper(page);
    await h.gotoNew();
    await h.nameInput().fill(LONG_NAME);
    const value = await h.nameInput().inputValue();
    expect(value.length).toBeLessThanOrEqual(100);
  });

  const authTest = skipAuth ? test.skip : test;
  authTest(
    `${tcAuth} user สิทธิ์ต่ำเข้าหน้านี้ต้องไม่เห็นปุ่ม Add หรือถูก redirect`,
    {
      annotation: [
        { type: "preconditions", description: `Test user carmensoftware.dev+requestor@gmail.com (low-privilege role) มีอยู่จริง; module list path = ${listPath}` },
        { type: "steps", description: `1. เปิด browser context ใหม่\n2. login เป็น carmensoftware.dev+requestor@gmail.com\n3. ไปที่ ${listPath}` },
        { type: "expected", description: `User ถูก redirect ออกจาก ${listPath} หรือ ปุ่ม Add ไม่ปรากฏ (count = 0)` },
        { type: "priority", description: "High" },
        { type: "testType", description: "Authorization" },
      ],
    },
    async ({
    browser,
  }: {
    browser: import("@playwright/test").Browser;
  }) => {
    // No session: inside createAuthTest specs, browser.newContext() inherits the role's storageState
    // (see 081-chart-of-account-mapping.spec.ts) — clear it explicitly.
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    const { LoginPage } = await import("../pages/login.page");
    const { TEST_PASSWORD } = await import("../test-users");
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.loginWithRetry("carmensoftware.dev+requestor@gmail.com", TEST_PASSWORD);
    await page.waitForURL(/dashboard/, { timeout: 15_000 });
    await page.goto(listPath);
    await page.waitForLoadState("networkidle");
    const list = new ConfigListPage(page, listPath);
    if (page.url().includes(listPath)) {
      await expect(list.addButton()).toHaveCount(0);
    }
    await ctx.close();
  });
}

/**
 * Lightweight security cases for modules with complex CRUD that we don't fully test.
 * Only covers SQL search + authorization.
 */
export function addListOnlySecurityCases(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  test: any,
  opts: { prefix: string; listPath: string; skipTcs?: string[] },
) {
  const { prefix, listPath, skipTcs = [] } = opts;
  const t = (tc: string) => (skipTcs.includes(tc) ? test.skip : test);

  t(`TC-${prefix}-100001`)(
    `TC-${prefix}-100001 XSS payload ในช่องค้นหาต้องไม่รัน script`,
    {
      annotation: [
        { type: "preconditions", description: `Logged in user with permission to access ${listPath}; XSS dialog guard attached` },
        { type: "steps", description: `1. เปิด list ${listPath}\n2. พิมพ์ XSS payload "<script>alert('xss-e2e')</script>" ลงในช่องค้นหา` },
        { type: "expected", description: "ไม่มี browser alert/dialog จาก payload; ปุ่ม Add ยังคง visible (list ทำงานปกติ)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Security" },
      ],
    },
    async ({ page }: { page: Page }) => {
    attachNoXssDialogGuard(page);
    const list = new ConfigListPage(page, listPath);
    await list.goto();
    await list.search(XSS_PAYLOAD);
    await expect(list.addButton()).toBeVisible();
  });

  t(`TC-${prefix}-100002`)(
    `TC-${prefix}-100002 SQL injection payload ในช่องค้นหาต้องไม่ crash`,
    {
      annotation: [
        { type: "preconditions", description: `Logged in user with permission to access ${listPath}` },
        { type: "steps", description: `1. เปิด list ${listPath}\n2. พิมพ์ SQL injection payload "'; DROP TABLE users; --" ลงในช่องค้นหา` },
        { type: "expected", description: "หน้าไม่ crash; ปุ่ม Add ยังคง visible (list ทำงานปกติ)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Security" },
      ],
    },
    async ({ page }: { page: Page }) => {
    const list = new ConfigListPage(page, listPath);
    await list.goto();
    await list.search(SQL_PAYLOAD);
    await expect(list.addButton()).toBeVisible();
  });

  t(`TC-${prefix}-100003`)(
    `TC-${prefix}-100003 ค้นหาด้วย string ยาวมากต้องไม่ crash`,
    {
      annotation: [
        { type: "preconditions", description: `Logged in user with permission to access ${listPath}` },
        { type: "steps", description: `1. เปิด list ${listPath}\n2. พิมพ์ string ยาว 200 ตัวอักษร ('a' x 200) ลงในช่องค้นหา` },
        { type: "expected", description: "หน้าไม่ crash; ปุ่ม Add ยังคง visible (list ทำงานปกติ)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Validation" },
      ],
    },
    async ({ page }: { page: Page }) => {
    const list = new ConfigListPage(page, listPath);
    await list.goto();
    await list.search(LONG_NAME);
    await expect(list.addButton()).toBeVisible();
  });

  t(`TC-${prefix}-100004`)(
    `TC-${prefix}-100004 user สิทธิ์ต่ำเข้าหน้านี้ต้องไม่เห็นปุ่ม Add หรือถูก redirect`,
    {
      annotation: [
        { type: "preconditions", description: `Test user carmensoftware.dev+requestor@gmail.com (low-privilege role) มีอยู่จริง; module list path = ${listPath}` },
        { type: "steps", description: `1. เปิด browser context ใหม่\n2. login เป็น carmensoftware.dev+requestor@gmail.com\n3. ไปที่ ${listPath}` },
        { type: "expected", description: `User ถูก redirect ออกจาก ${listPath} หรือ ปุ่ม Add ไม่ปรากฏ (count = 0)` },
        { type: "priority", description: "High" },
        { type: "testType", description: "Authorization" },
      ],
    },
    async ({
    browser,
  }: {
    browser: import("@playwright/test").Browser;
  }) => {
    // No session: inside createAuthTest specs, browser.newContext() inherits the role's storageState
    // (see 081-chart-of-account-mapping.spec.ts) — clear it explicitly.
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    const { LoginPage } = await import("../pages/login.page");
    const { TEST_PASSWORD } = await import("../test-users");
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.loginWithRetry("carmensoftware.dev+requestor@gmail.com", TEST_PASSWORD);
    await page.waitForURL(/dashboard/, { timeout: 15_000 });
    await page.goto(listPath);
    await page.waitForLoadState("networkidle");
    const list = new ConfigListPage(page, listPath);
    if (page.url().includes(listPath)) {
      await expect(list.addButton()).toHaveCount(0);
    }
    await ctx.close();
  });
}
