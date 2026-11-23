import { expect } from "@playwright/test";
import { createAuthTest } from "./fixtures/auth.fixture";
import { buConfigSend } from "./helpers/bu-api";
import { accountCode, assertAccountingReady, getGlSettingValue } from "./helpers/gl-api";
import { field } from "./helpers/movement/ui";

// ─────────────────────────────────────────────────────────────────────────
// Accounting settings + dashboards smoke on the TEST BU (GR2VYNKQ). Read-only: nothing here writes (the one write is
// the Requestor's refused PUT of the value it just read, so even a bug would leave the value as it was).
//
// /accounting/settings edits the BU's `gl_setting` app-config row; the AP / JV specs depend on its accounts, so the
// settings page must show the seeded accounts by code. The page is writable only with `configuration.app_config.update`
// (FE `writable`, gateway PUT permission); the Requestor is the view-only role.
// Both dashboards (/accounting, /accounting/accounts-payable) render the FE mock snapshot today (`mock` flag, "AP dashboard
// ยังเป็น mock" in ap-dashboard.tsx), so the figures asserted are the mock ones: this is a smoke check that the page
// renders a figure, not a check of ledger numbers (out of scope).
// ─────────────────────────────────────────────────────────────────────────
const test = createAuthTest("carmensoftware.dev+admin@gmail.com");
const requestorTest = createAuthTest("carmensoftware.dev+requestor@gmail.com");
test.describe.configure({ timeout: 90_000 });
requestorTest.describe.configure({ timeout: 90_000 });

const SETTINGS = "/accounting/settings";

/** Account fields of the settings page: label on screen -> `gl_setting` key. */
const ACCOUNT_FIELDS: [label: string, key: string][] = [
  ["AP control account", "ap_control_account_id"],
  ["Input VAT account", "input_vat_account_id"],
  ["WHT payable account", "wht_payable_account_id"],
  ["Advance deposit account", "advance_deposit_account_id"],
];

test.describe("Accounting settings (820)", () => {
  test.beforeAll(async () => {
    await assertAccountingReady();
  });

  test(
    "TC-ACCT-010001 หน้าตั้งค่า Accounting แสดงบัญชี gl_setting ที่ seed ไว้ด้วยรหัสบัญชี",
    {
      annotation: [
        { type: "preconditions", description: "Admin login บน TEST BU; gl_setting มีบัญชี AP control / Input VAT / WHT payable / Advance deposit (data:reset)" },
        { type: "steps", description: "1. อ่าน gl_setting ผ่าน API และแปลง id บัญชีเป็นรหัส\n2. เปิด /accounting/settings\n3. อ่านช่องบัญชีทั้ง 4 ช่อง" },
        {
          type: "expected",
          description:
            "แต่ละช่อง (AP control account, Input VAT account, WHT payable account, Advance deposit account) แสดงรหัสบัญชีตรงกับ gl_setting; Admin เห็นปุ่ม Edit (มีสิทธิ์เขียน). assumption: oracle ไม่ได้กำหนดหน้านี้ เป็นการยืนยันว่าหน้าอ่านค่าตั้งต้นที่ spec AP / JV พึ่งพา",
        },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page }) => {
      const value = await getGlSettingValue();
      const expected: [string, string][] = [];
      for (const [label, key] of ACCOUNT_FIELDS) {
        expect(value[key], `gl_setting.${key} is not set - run data:reset`).toBeTruthy();
        expected.push([label, await accountCode(String(value[key]))]);
      }
      await page.goto(SETTINGS);
      await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeVisible({ timeout: 20_000 });
      for (const [label, code] of expected) {
        await expect(field(page, label), label).toContainText(code, { timeout: 15_000 });
      }
    },
  );

  test(
    "TC-ACCT-030001 (mock) แดชบอร์ด AP (/accounting/accounts-payable) โหลดและแสดงตัวเลข AP outstanding ไม่ใช่ 0",
    {
      annotation: [
        { type: "preconditions", description: "Admin login บน TEST BU; license accounting.ap" },
        { type: "steps", description: "1. เปิด /accounting/accounts-payable\n2. อ่านแผง Key metrics" },
        {
          type: "expected",
          description:
            "หัวเรื่อง Accounts Payable Dashboard; แผง Key metrics มีการ์ด 'AP outstanding' ที่แสดงจำนวนเงินที่ไม่ใช่ 0. assumption: FE ใช้ข้อมูลตัวอย่าง (mock) ของแดชบอร์ดตรง ๆ ตัวเลขจึงไม่ได้มาจาก read set ของ BU; เคสนี้ยืนยันว่าหน้าแสดงตัวเลข ไม่ใช่ความถูกต้องของยอดบัญชี",
        },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page }) => {
      await page.goto("/accounting/accounts-payable");
      await expect(page.getByRole("heading", { name: "Accounts Payable Dashboard" })).toBeVisible({ timeout: 20_000 });
      const card = page.getByRole("region", { name: "Key metrics" }).getByRole("button", { name: /AP outstanding/ });
      await expect(card).toBeVisible();
      await expect(card).toContainText(/[1-9]/);
    },
  );

  test(
    "TC-ACCT-030002 (mock) แดชบอร์ด GL (/accounting) โหลดและแสดงตัวเลข Unposted JV ไม่ใช่ 0",
    {
      annotation: [
        { type: "preconditions", description: "Admin login บน TEST BU; license accounting.gl" },
        { type: "steps", description: "1. เปิด /accounting\n2. อ่านแผง Key metrics" },
        {
          type: "expected",
          description:
            "หัวเรื่อง General Ledger Dashboard; แผง Key metrics มีการ์ด 'Unposted JV' ที่แสดงตัวเลขไม่ใช่ 0. assumption: FE ใช้ข้อมูลตัวอย่าง (mock) ตรง ๆ ตัวเลขไม่ได้มาจาก read set ของ BU",
        },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page }) => {
      await page.goto("/accounting");
      await expect(page.getByRole("heading", { name: "General Ledger Dashboard" })).toBeVisible({ timeout: 20_000 });
      const card = page.getByRole("region", { name: "Key metrics" }).getByRole("button", { name: /Unposted JV/ });
      await expect(card).toBeVisible();
      await expect(card).toContainText(/[1-9]/);
    },
  );
});

requestorTest.describe("Accounting settings (820) - Requestor (view-only)", () => {
  requestorTest(
    "TC-ACCT-020001 Requestor (view-only) เปิดหน้าตั้งค่า Accounting: ไม่มีปุ่ม Edit และ PUT gl_setting ผ่าน API ถูกปฏิเสธ",
    {
      annotation: [
        { type: "preconditions", description: "Requestor login (ไม่มี configuration.app_config.update); gl_setting มีค่าอยู่แล้ว" },
        { type: "steps", description: "1. เปิด /accounting/settings\n2. หาปุ่ม Edit\n3. Requestor เรียก PUT app-config/gl_setting ด้วยค่าเดิมผ่าน API\n4. อ่านค่า gl_setting อีกครั้ง" },
        {
          type: "expected",
          description:
            "หน้าแสดง Permission Denied (Requestor ไม่มี configuration.app_config.view จึงเปิดหน้าไม่ได้ด้วยซ้ำ) และไม่มีปุ่ม Edit/Save; PUT ตอบ 403 และค่า gl_setting ไม่เปลี่ยน. rule: หน้าอ่านต้องมี configuration.app_config.view และเขียนต้องมี configuration.app_config.update (FE module-list + writable, gateway PUT permission). assumption: oracle ไม่ได้กำหนดสิทธิ์ของหน้านี้",
        },
        { type: "priority", description: "High" },
        { type: "testType", description: "Authorization" },
      ],
    },
    async ({ page }) => {
      const before = await getGlSettingValue("Admin");
      await page.goto(SETTINGS);
      await expect(page.getByRole("heading", { name: "Permission Denied" })).toBeVisible({ timeout: 20_000 });
      await expect(page.getByRole("button", { name: "Edit", exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Save", exact: true })).toHaveCount(0);
      const put = await buConfigSend("Requestor", "PUT", "/app-config/gl_setting", { value: before });
      expect(put.status, JSON.stringify(put.body).slice(0, 200)).toBe(403);
      expect(await getGlSettingValue("Admin")).toEqual(before);
    },
  );
});
