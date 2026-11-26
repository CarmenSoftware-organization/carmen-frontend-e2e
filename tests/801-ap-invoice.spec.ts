import { expect } from "@playwright/test";
import { createAuthTest } from "./fixtures/auth.fixture";
import { ApInvoicePage, amountOf } from "./pages/ap-invoice.page";
import { buConfigSend, buSend } from "./helpers/bu-api";
import { approveApDoc, approvePayment, createApDoc, createPayment, getApDoc, seededApDoc, submitApDoc, submitPayment, voidApDoc } from "./helpers/ap-api";
import { assertAccountingReady, buDecimals, CREATOR, jvOfSource, listAllRows, today, type JvLine } from "./helpers/gl-api";
import { docAmounts, expectBalanced, lineAmounts, netFromIncVat, round, vatOf } from "./helpers/money";
import { expectBlocked, expectRefused, expectSaved } from "./helpers/settle";
import { uid } from "./helpers/test-data";

// ─────────────────────────────────────────────────────────────────────────
// AP invoice on the TEST BU (BU-GR2VYNKQ), money path: list, detail, create, edit, validation, posting, void, permissions.
//
// Roles: Admin creates / submits / voids (UI + API, bypasses permission keys); Budget is the accounting approver;
// Requestor is the accounting viewer. AP invoices have no workflow, so Submit posts them.
// Read set (never mutated, seeded by `bun run data:reset --yes`): E2E-AP-POSTED (one line 3 x 333.33: net 999.99,
// VAT 70.00, total 1,069.99) · E2E-AP-INCVAT (net 1,000.00, VAT 70.00) · E2E-AP-PARTIAL (open 670.00, has a payment) ·
// E2E-AP-PAID (open 0) · E2E-AP-DRAFT. Every state-changing case creates its own document tagged
// `E2E-T-801-<case>-<uid>`, so the spec re-runs without a reset.
//
// Expected amounts come from tests/helpers/money.ts (or the literals above), never from the BE echo; the BE and the
// UI are the actuals. Cases resting on a doc gap say "assumption:" in `expected` (preflight 4.3).
// ─────────────────────────────────────────────────────────────────────────
const test = createAuthTest("carmensoftware.dev+admin@gmail.com");
const requestorTest = createAuthTest("carmensoftware.dev+requestor@gmail.com");

test.describe.configure({ timeout: 90_000 });
requestorTest.describe.configure({ timeout: 60_000 });

const tag = (key: string) => `E2E-T-801-${key}-${uid}`;
const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** The draft / posted document a spec created, found by its vendor invoice number. */
async function docByTag(vendorInvoiceNo: string) {
  const hit = (await listAllRows(CREATOR, `/ap-invoice?search=${encodeURIComponent(vendorInvoiceNo)}`)).find((d) => d.vendor_invoice_no === vendorInvoiceNo);
  if (!hit) throw new Error(`no AP document tagged ${vendorInvoiceNo}`);
  return getApDoc(String(hit.id));
}

/** Code of the first (and only used) vendor of the BU, plus the AP control account code it posts to. */
async function firstVendor() {
  const r = await buConfigSend(CREATOR, "GET", "/vendors?perpage=1");
  const v = r.body?.data?.[0];
  if (r.status !== 200 || !v) throw new Error(`no vendor on the TEST BU (GET vendors -> ${r.status}) - run data:reset`);
  return { id: String(v.id), code: String(v.code), apAccountId: String(v.ap_chart_of_accounts_id) };
}

let coa: Promise<Map<string, string>> | null = null;
/** COA account code of an account id. */
async function codeOfAccount(id: string): Promise<string> {
  coa ??= listAllRows(CREATOR, "/chart-of-accounts", true).then((rows) => new Map(rows.map((a) => [String(a.id), String(a.code)])));
  const code = (await coa).get(id);
  if (!code) throw new Error(`no COA account with id ${id}`);
  return code;
}

async function glSettingAccount(key: "input_vat_account_id" | "ap_control_account_id"): Promise<string> {
  const r = await buConfigSend(CREATOR, "GET", "/app-config/gl_setting");
  const id = r.body?.data?.value?.[key];
  if (r.status !== 200 || !id) throw new Error(`gl_setting.${key} missing (GET -> ${r.status}) - run data:reset`);
  return codeOfAccount(String(id));
}

/** Sum of debit / credit of one account across JV lines. */
function sum(lines: JvLine[], account: string, side: "dr" | "cr"): number {
  return round(lines.filter((l) => l.account === account).reduce((s, l) => s + l[side], 0), 4);
}

test.describe("AP invoice (801)", () => {
  test.beforeAll(async () => {
    await assertAccountingReady();
  });

  // ── 01 list ───────────────────────────────────────────────────────────
  test(
    "TC-APINV-010001 รายการแสดงใบ read-set ครบ พร้อมยอด สถานะ และยอดค้าง",
    {
      annotation: [
        { type: "preconditions", description: "Admin login บน TEST BU; data:reset --yes แล้ว (มีใบ E2E-AP-POSTED / INCVAT / PARTIAL / PAID / DRAFT)" },
        { type: "steps", description: "1. เปิด /accounts-payable/invoice\n2. ค้น E2E-AP-\n3. ดูแถวของแต่ละใบ" },
        {
          type: "expected",
          description:
            "POSTED = 1,069.99 ค้าง 1,069.99 Unpaid Posted; INCVAT = 1,070.00 ค้าง 1,070.00; PARTIAL = 1,070.00 ค้าง 670.00 Partially Paid; PAID ค้าง 0.00 Paid; DRAFT = Draft. assumption: ยอด POSTED คำนวณจาก 3 x 333.33 + VAT 7% ปัดครึ่งขึ้นต่อบรรทัด",
        },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const ap = new ApInvoicePage(page);
      await ap.gotoList();
      await ap.search("E2E-AP-");
      const posted = docAmounts([{ qty: 3, price: 333.33 }]);
      // exact cell matches: a substring match would let "0.00 THB" hit "1,070.00 THB" and "Paid" hit "Partially Paid"
      const cell = (key: string, text: string) => ap.row(key).getByRole("cell", { name: text, exact: true });
      await expect(cell("E2E-AP-POSTED", `${fmt(posted.total)} THB`)).toHaveCount(2); // total and open
      await expect(cell("E2E-AP-POSTED", "Unpaid")).toHaveCount(1);
      await expect(ap.statusChip(ap.row("E2E-AP-POSTED"))).toHaveText(/posted/i);
      await expect(cell("E2E-AP-INCVAT", "1,070.00 THB")).toHaveCount(2);
      await expect(cell("E2E-AP-INCVAT", "Unpaid")).toHaveCount(1);
      await expect(cell("E2E-AP-PARTIAL", "1,070.00 THB")).toHaveCount(1);
      await expect(cell("E2E-AP-PARTIAL", "670.00 THB")).toHaveCount(1);
      await expect(cell("E2E-AP-PARTIAL", "Partially Paid")).toHaveCount(1);
      await expect(cell("E2E-AP-PAID", "0.00 THB")).toHaveCount(1); // the open cell only
      await expect(cell("E2E-AP-PAID", "Paid")).toHaveCount(1);
      await expect(cell("E2E-AP-PAID", "Partially Paid")).toHaveCount(0);
      await expect(ap.statusChip(ap.row("E2E-AP-DRAFT"))).toHaveText(/draft/i);
    },
  );

  test(
    "TC-APINV-010002 ค้นด้วยเลขใบของผู้ขาย E2E-AP-POSTED เจอใบเดียว",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; data:reset --yes แล้ว" },
        { type: "steps", description: "1. เปิดรายการ AP invoice\n2. พิมพ์ E2E-AP-POSTED ในช่องค้นแล้วกด Enter" },
        { type: "expected", description: "เหลือแถวเดียว และเป็นใบที่มี Vendor Invoice = E2E-AP-POSTED; ไม่มีแถวของ E2E-AP-INCVAT" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const ap = new ApInvoicePage(page);
      await ap.gotoList();
      await ap.search("E2E-AP-POSTED");
      await expect(ap.rows()).toHaveCount(1);
      await expect(ap.rows().first()).toContainText("E2E-AP-POSTED");
      await expect(ap.row("E2E-AP-INCVAT")).toHaveCount(0);
    },
  );

  test(
    "TC-APINV-010003 ตัวกรองสถานะ Draft แสดงเฉพาะใบ Draft",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; data:reset --yes แล้ว (E2E-AP-DRAFT เป็น Draft ส่วนใบอื่นของ read-set ลงบัญชีแล้ว)" },
        { type: "steps", description: "1. เปิดรายการ AP invoice\n2. ค้น E2E-AP-\n3. Filter > Status > Draft" },
        { type: "expected", description: "เหลือแถว E2E-AP-DRAFT แถวเดียว สถานะ Draft; ไม่มี E2E-AP-POSTED" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const ap = new ApInvoicePage(page);
      await ap.gotoList();
      await ap.search("E2E-AP-");
      await expect(ap.row("E2E-AP-POSTED")).toBeVisible();
      await ap.filterStatus("Draft");
      await expect(ap.row("E2E-AP-POSTED")).toHaveCount(0);
      await expect(ap.rows()).toHaveCount(1);
      await expect(ap.statusChip(ap.rows().first())).toHaveText(/draft/i);
      await expect(ap.rows().first()).toContainText("E2E-AP-DRAFT");
    },
  );

  // ── 02 detail ─────────────────────────────────────────────────────────
  test(
    "TC-APINV-020001 รายละเอียด E2E-AP-POSTED แสดง net 999.99 VAT 70.00 รวม 1,069.99 ตรงกับ oracle และ API",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; data:reset --yes แล้ว; E2E-AP-POSTED มีบรรทัดเดียว 3 x 333.33 ลงบัญชีแล้ว" },
        { type: "steps", description: "1. หา id ของ E2E-AP-POSTED\n2. เปิดหน้ารายละเอียด\n3. อ่านแถบสรุปท้ายหน้า (Net Amount / VAT / Total / Unpaid)" },
        {
          type: "expected",
          description:
            "net 999.99, VAT 70.00, total 1,069.99, ค้าง 1,069.99 เท่ากับ money.ts (999.99 x 7% = 69.9993 ปัดเป็น 70.00) และเท่ากับที่ API คืน. assumption: VAT 7% บนฐานก่อน VAT ปัดครึ่งขึ้นที่ 2 ตำแหน่ง",
        },
        { type: "priority", description: "High" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      const ap = new ApInvoicePage(page);
      const dp = await buDecimals();
      const expected = docAmounts([{ qty: 3, price: 333.33 }], 7, dp);
      expect(expected).toEqual({ net: 999.99, vat: 70, total: 1069.99 });
      const doc = await seededApDoc("E2E-AP-POSTED");
      await ap.gotoDetail(doc.id);
      await expect(ap.statusChip()).toHaveText(/posted/i);
      expect(await ap.totalOf("net")).toBe(expected.net);
      expect(await ap.totalOf("vat")).toBe(expected.vat);
      expect(await ap.totalOf("total")).toBe(expected.total);
      expect(await ap.totalOf("open")).toBe(expected.total);
      // the backend agrees with the oracle too
      expect({ net: doc.net, vat: doc.vat, total: doc.total }).toEqual(expected);
    },
  );

  test(
    "TC-APINV-020002 ใบ Inc VAT แสดง net 1,000.00 VAT 70.00 รวม 1,070.00",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; data:reset --yes แล้ว; E2E-AP-INCVAT ราคา 1,070.00 ติ๊ก Inc VAT" },
        { type: "steps", description: "1. หา id ของ E2E-AP-INCVAT\n2. เปิดหน้ารายละเอียด\n3. อ่านแถบสรุป" },
        {
          type: "expected",
          description:
            "net 1,000.00 (= 1,070 / 1.07), VAT 70.00, total 1,070.00 เท่ากับ money.ts และ API. assumption: ราคา Inc VAT ถอดฐานก่อน VAT จากยอดรวม แล้ว VAT = ยอดรวม - ฐาน (inv:103 ไม่ระบุสูตรปัดเศษ)",
        },
        { type: "priority", description: "High" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      const ap = new ApInvoicePage(page);
      const dp = await buDecimals();
      const net = netFromIncVat(1070, 7, dp);
      const expected = { net, vat: round(1070 - net, dp), total: 1070 };
      expect(expected).toEqual({ net: 1000, vat: 70, total: 1070 });
      expect(vatOf(net, 7, dp)).toBe(expected.vat);
      const doc = await seededApDoc("E2E-AP-INCVAT");
      await ap.gotoDetail(doc.id);
      expect(await ap.totalOf("net")).toBe(expected.net);
      expect(await ap.totalOf("vat")).toBe(expected.vat);
      expect(await ap.totalOf("total")).toBe(expected.total);
      expect({ net: doc.net, vat: doc.vat, total: doc.total }).toEqual(expected);
    },
  );

  // ── 03 create ─────────────────────────────────────────────────────────
  test(
    "TC-APINV-030001 สร้างใบผ่าน UI 2 บรรทัด: ยอดที่แสดงและที่บันทึกตรง oracle สถานะ Draft",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; บัญชี 5300 และ Vat 7% มีใน TEST BU; vendor แรกของ BU" },
        {
          type: "steps",
          description:
            "1. เปิด /accounts-payable/invoice/new\n2. เลือก vendor และกรอก Vendor Invoice\n3. บรรทัด 1 = 2 x 100.00, บรรทัด 2 = 3 x 333.33 (บัญชี 5300, Vat 7%)\n4. อ่านแถบสรุป\n5. กด Save Draft",
        },
        {
          type: "expected",
          description:
            "แถบสรุปก่อนบันทึก net 1,199.99 VAT 84.00 total 1,283.99 (บรรทัด 1: 200.00 + 14.00, บรรทัด 2: 999.99 + 70.00); บันทึกแล้ว toast Invoice saved ไปหน้ารายละเอียด; API ได้ยอดเดียวกันและสถานะ draft. assumption: VAT ปัดต่อบรรทัดแล้วรวม ไม่ปัดซ้ำที่ระดับเอกสาร (accounting-foundation.md:103,120)",
        },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const ap = new ApInvoicePage(page);
      const dp = await buDecimals();
      const lines = [
        { qty: 2, price: 100 },
        { qty: 3, price: 333.33 },
      ];
      const expected = docAmounts(lines, 7, dp);
      expect(expected).toEqual({ net: 1199.99, vat: 84, total: 1283.99 });
      const no = tag("create");
      const vendor = await firstVendor();

      await ap.gotoNew();
      await ap.selectVendor(vendor.code);
      await ap.setVendorInvoiceNo(no);
      await ap.fillLine(1, { description: `${no} line 1`, ...lines[0] });
      await ap.addAndFillLine({ description: `${no} line 2`, ...lines[1] });
      expect(await ap.totalOf("net")).toBe(expected.net);
      expect(await ap.totalOf("vat")).toBe(expected.vat);
      expect(await ap.totalOf("total")).toBe(expected.total);

      await expectSaved(page, /\/ap-invoice(\?|$)/, () => ap.saveDraftButton().click(), ap.toastWith(/invoice saved/i));
      await expect(page).toHaveURL(/\/invoice\/[0-9a-f-]{36}$/);
      const doc = await docByTag(no);
      expect(doc.status).toBe("draft");
      expect({ net: doc.net, vat: doc.vat, total: doc.total }).toEqual(expected);
      expect(doc.lines).toHaveLength(2);
    },
  );

  test(
    "TC-APINV-030002 บรรทัด Inc VAT ที่กรอกผ่าน UI: net 1,000.00 VAT 70.00 รวม 1,070.00",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; บัญชี 5300 และ Vat 7% มีใน TEST BU" },
        { type: "steps", description: "1. เปิดหน้าสร้างใบ\n2. เลือก vendor, Vendor Invoice\n3. บรรทัด 1 = 1 x 1,070.00 ติ๊ก Inc VAT (5300, Vat 7%)\n4. กด Save Draft" },
        {
          type: "expected",
          description:
            "แถบสรุปและค่าที่บันทึกเป็น net 1,000.00, VAT 70.00, total 1,070.00; สถานะ draft. assumption: ราคา Inc VAT ถอดฐานก่อน VAT จากยอดรวม (inv:103)",
        },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      const ap = new ApInvoicePage(page);
      const dp = await buDecimals();
      const expected = docAmounts([{ qty: 1, price: 1070, incVat: true }], 7, dp);
      expect(expected).toEqual({ net: 1000, vat: 70, total: 1070 });
      const no = tag("incvat");
      const vendor = await firstVendor();

      await ap.gotoNew();
      await ap.selectVendor(vendor.code);
      await ap.setVendorInvoiceNo(no);
      await ap.fillLine(1, { description: `${no} line 1`, qty: 1, price: 1070, incVat: true });
      expect(await ap.totalOf("net")).toBe(expected.net);
      expect(await ap.totalOf("vat")).toBe(expected.vat);
      expect(await ap.totalOf("total")).toBe(expected.total);

      await expectSaved(page, /\/ap-invoice(\?|$)/, () => ap.saveDraftButton().click(), ap.toastWith(/invoice saved/i));
      const doc = await docByTag(no);
      expect(doc.status).toBe("draft");
      expect({ net: doc.net, vat: doc.vat, total: doc.total }).toEqual(expected);
    },
  );

  // ── 04 edit ───────────────────────────────────────────────────────────
  test(
    "TC-APINV-040001 แก้จำนวนบรรทัดของใบ Draft: ยอดรวมคำนวณใหม่และบันทึก",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; ใบ Draft ที่สร้างผ่าน API มีบรรทัดเดียว 2 x 100.00" },
        { type: "steps", description: "1. เปิดหน้ารายละเอียดใบ Draft\n2. กด Edit\n3. เปลี่ยนจำนวนเป็น 5\n4. อ่านแถบสรุป\n5. กด Save Draft" },
        {
          type: "expected",
          description: "ก่อนบันทึกแถบสรุป net 500.00 VAT 35.00 total 535.00; หลังบันทึก toast Invoice saved และ API ได้ 500.00 / 35.00 / 535.00 สถานะ draft. assumption: VAT 7% บนฐานก่อน VAT",
        },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const ap = new ApInvoicePage(page);
      const dp = await buDecimals();
      const before = docAmounts([{ qty: 2, price: 100 }], 7, dp);
      const after = docAmounts([{ qty: 5, price: 100 }], 7, dp);
      expect(after).toEqual({ net: 500, vat: 35, total: 535 });
      const created = await createApDoc("invoice", { tag: tag("edit"), lines: [{ qty: 2, price: 100 }] });
      await ap.gotoDetail(created.id);
      expect(await ap.totalOf("total")).toBe(before.total);

      await ap.editButton().click();
      await page.getByLabel("quantity 1").fill("5");
      expect(await ap.totalOf("net")).toBe(after.net);
      expect(await ap.totalOf("vat")).toBe(after.vat);
      expect(await ap.totalOf("total")).toBe(after.total);

      await expectSaved(page, /\/ap-invoice\/[0-9a-f-]{36}$/, () => ap.saveDraftButton().click(), ap.toastWith(/invoice saved/i));
      const doc = await getApDoc(created.id);
      expect(doc.status).toBe("draft");
      expect({ net: doc.net, vat: doc.vat, total: doc.total }).toEqual(after);
    },
  );

  // ── 20 validation ─────────────────────────────────────────────────────
  test(
    "TC-APINV-200001 ไม่เลือก vendor: บันทึกไม่ได้ และแจ้ง Select a vendor",
    {
      annotation: [
        { type: "preconditions", description: "Admin login" },
        { type: "steps", description: "1. เปิดหน้าสร้างใบ\n2. กรอก Vendor Invoice และบรรทัด 1 ครบ แต่ไม่เลือก vendor\n3. กด Save Draft" },
        { type: "expected", description: "แสดงข้อความ Select a vendor ใต้ช่อง vendor และไม่มี write request ไปที่ ap-invoice" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Validation" },
      ],
    },
    async ({ page }) => {
      const ap = new ApInvoicePage(page);
      await ap.gotoNew();
      await ap.setVendorInvoiceNo(tag("novendor"));
      await ap.fillLine(1, { description: "no vendor", qty: 1, price: 100 });
      await expectBlocked(page, /\/ap-invoice(\?|$)/, () => ap.saveDraftButton().click(), page.getByText("Please complete the required fields"));
      await expect(page.getByRole("button", { name: "Select Vendor" })).toBeVisible();
    },
  );

  test(
    "TC-APINV-200002 ไม่กรอกเลข Vendor Invoice: บันทึกไม่ได้",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; vendor แรกของ BU" },
        { type: "steps", description: "1. เปิดหน้าสร้างใบ\n2. เลือก vendor, บรรทัด 1 ครบ แต่เว้น Vendor Invoice\n3. กด Save Draft" },
        { type: "expected", description: "แสดงข้อความ Enter the vendor invoice number (max 100 characters) และไม่มี write request" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Validation" },
      ],
    },
    async ({ page }) => {
      const ap = new ApInvoicePage(page);
      const vendor = await firstVendor();
      await ap.gotoNew();
      await ap.selectVendor(vendor.code);
      await ap.fillLine(1, { description: "no invoice no", qty: 1, price: 100 });
      await expectBlocked(page, /\/ap-invoice(\?|$)/, () => ap.saveDraftButton().click(), page.getByText(/enter the vendor invoice number/i));
      await expect(page).toHaveURL(/\/invoice\/new$/);
    },
  );

  test(
    "TC-APINV-200003 บรรทัดไม่มีบัญชีเดบิต: บันทึกไม่ได้",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; vendor แรกของ BU" },
        {
          type: "steps",
          description:
            "1. เปิดหน้าสร้างใบ\n2. เลือก vendor, Vendor Invoice\n3. บรรทัดเดียว (ฟอร์มไม่ให้ลบบรรทัดสุดท้าย จึงทดสอบ 'ไม่มีบรรทัดที่ใช้ได้' ด้วยบรรทัดที่ไม่มีบัญชี) กรอกจำนวนและราคาแต่ไม่เลือกบัญชี\n4. กด Save Draft",
        },
        { type: "expected", description: "แสดง Every line needs a debit account และไม่มี write request" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Validation" },
      ],
    },
    async ({ page }) => {
      const ap = new ApInvoicePage(page);
      const vendor = await firstVendor();
      await ap.gotoNew();
      await ap.selectVendor(vendor.code);
      await ap.setVendorInvoiceNo(tag("noaccount"));
      await ap.fillLine(1, { description: "no account", qty: 1, price: 100, account: null });
      await expectBlocked(page, /\/ap-invoice(\?|$)/, () => ap.saveDraftButton().click(), page.getByText("Every line needs a debit account"));
      await expect(page).toHaveURL(/\/invoice\/new$/);
    },
  );

  test(
    "TC-APINV-200004 สร้างใบที่ไม่มีบรรทัดผ่าน API: ถูกปฏิเสธ",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; vendor แรกของ BU" },
        { type: "steps", description: "1. POST /ap-invoice พร้อม details.add = []" },
        { type: "expected", description: "ตอบ 400 และไม่มีใบถูกสร้าง. assumption: ใบต้องมีอย่างน้อย 1 บรรทัดแม้เป็น Draft (docs ไม่ระบุ; FE ก็ไม่ให้ลบบรรทัดสุดท้าย)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async () => {
      const no = tag("zero");
      const vendor = await firstVendor();
      const r = await buSend(CREATOR, "POST", "/ap-invoice", {
        doc_type: "invoice",
        doc_date: today(),
        vendor_id: vendor.id,
        vendor_invoice_no: no,
        invoice_date: today(),
        details: { add: [] },
      });
      expect(r.status).toBe(400);
      const hits = (await listAllRows(CREATOR, `/ap-invoice?search=${encodeURIComponent(no)}`)).filter((d) => d.vendor_invoice_no === no);
      expect(hits).toHaveLength(0);
    },
  );

  test(
    "TC-APINV-200005 เลข Vendor Invoice ซ้ำของ vendor เดียวกัน: ถูกปฏิเสธ 409",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; ใบที่สร้างผ่าน API ของ vendor แรกใช้เลข E2E-T-801-dup-<uid> แล้ว" },
        { type: "steps", description: "1. เปิดหน้าสร้างใบ\n2. เลือก vendor เดิม ใส่ Vendor Invoice เดิม และบรรทัดครบ\n3. กด Save Draft" },
        {
          type: "expected",
          description:
            "backend ปฏิเสธ 409 พร้อม toast ว่าเลขซ้ำ และไม่มีใบที่สองถูกสร้าง. assumption: unique ตาม BU + vendor + เลขใบ (inv:49 'อย่างน้อย BU+vendor+normalized no.', inv:240 ตอบ 409); ไม่ทดสอบการ normalize ช่องว่าง/ขีด (inv:264 ยังเป็นคำถามเปิด)",
        },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const ap = new ApInvoicePage(page);
      const no = tag("dup");
      const vendor = await firstVendor();
      await createApDoc("invoice", { tag: no, lines: [{ qty: 1, price: 100 }] });

      await ap.gotoNew();
      await ap.selectVendor(vendor.code);
      await ap.setVendorInvoiceNo(no);
      await ap.fillLine(1, { description: "duplicate", qty: 1, price: 100 });
      const status = await expectRefused(page, /\/ap-invoice(\?|$)/, () => ap.saveDraftButton().click(), ap.toastWith(/already exists|duplicate/i));
      expect(status).toBe(409);
      const hits = (await listAllRows(CREATOR, `/ap-invoice?search=${encodeURIComponent(no)}`)).filter((d) => d.vendor_invoice_no === no);
      expect(hits).toHaveLength(1);
    },
  );

  // ── 40 posting ────────────────────────────────────────────────────────
  test(
    "TC-APINV-400001 Submit ใบ Draft ผ่าน UI ลงบัญชีทันที: JV สมดุล Dr 5300 = net, Dr 1170 = VAT, Cr 2100 = รวม",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; ใบ Draft 3 x 333.33 ที่สร้างผ่าน API; AP ไม่มี workflow; GL period เปิดครอบวันนี้" },
        { type: "steps", description: "1. เปิดหน้ารายละเอียดใบ Draft\n2. กด Submit\n3. ดึง JV ที่มี source = ใบนี้จาก API" },
        {
          type: "expected",
          description:
            "toast Invoice submitted สถานะ Posted ค้าง 1,069.99; JV สมดุล; Dr 5300 = 999.99, Dr 1170 = 70.00, Cr 2100 = 1,069.99; บัญชีภาษีซื้อและเจ้าหนี้ตรงกับ gl_setting / บัญชีเจ้าหนี้ของ vendor. assumption: AP invoice ไม่มี workflow ดังนั้น Submit ลงบัญชีเลย (BE facts ของ plan; docs อ้าง workflow ตามนโยบาย)",
        },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const ap = new ApInvoicePage(page);
      const dp = await buDecimals();
      const expected = docAmounts([{ qty: 3, price: 333.33 }], 7, dp);
      const created = await createApDoc("invoice", { tag: tag("submit"), lines: [{ qty: 3, price: 333.33 }] });
      await ap.gotoDetail(created.id);

      await expectSaved(page, /\/ap-invoice\/[0-9a-f-]{36}\/submit$/, () => ap.submitButton().click(), ap.toastWith(/invoice submitted/i));
      await expect(ap.statusChip()).toHaveText(/posted/i);
      expect(await ap.totalOf("open")).toBe(expected.total);

      const doc = await getApDoc(created.id);
      expect(doc.status).toBe("posted");
      expect(doc.open).toBe(expected.total);
      const jv = await jvOfSource("ap_invoice", created.id);
      expectBalanced(jv);
      const vendor = await firstVendor();
      const apAccount = await codeOfAccount(vendor.apAccountId);
      const vatAccount = await glSettingAccount("input_vat_account_id");
      expect(apAccount).toBe(await glSettingAccount("ap_control_account_id"));
      expect(sum(jv, "5300", "dr")).toBe(expected.net);
      expect(sum(jv, vatAccount, "dr")).toBe(expected.vat);
      expect(sum(jv, apAccount, "cr")).toBe(expected.total);
      expect(jv.every((l) => l.jvStatus === "posted")).toBe(true);
    },
  );

  test(
    "TC-APINV-400002 JV ของใบหลายบรรทัด (3 x 333.33 + Inc VAT 1,070.00): ยอดรวมต่อบัญชีตรง oracle",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; GL period เปิด; ใบ Draft 2 บรรทัดที่สร้างผ่าน API" },
        { type: "steps", description: "1. Submit ผ่าน API\n2. ดึงบรรทัด JV ของใบ" },
        {
          type: "expected",
          description:
            "net 1,999.99 (999.99 + 1,000.00), VAT 140.00 (70.00 + 70.00), รวม 2,139.99; JV สมดุล; Dr 5300 = 1,999.99, Dr 1170 = 140.00, Cr 2100 = 2,139.99. assumption: บรรทัด Inc VAT ลงเดบิตค่าใช้จ่ายด้วยฐานก่อน VAT และรวมยอดจากบรรทัดที่ปัดแล้ว (accounting-foundation.md:103,120; inv:103)",
        },
        { type: "priority", description: "High" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async () => {
      const dp = await buDecimals();
      const lines = [
        { qty: 3, price: 333.33 },
        { qty: 1, price: 1070, incVat: true },
      ];
      const expected = docAmounts(lines, 7, dp);
      expect(lineAmounts(lines[1], 7, dp)).toEqual({ net: 1000, vat: 70, total: 1070 });
      expect(expected).toEqual({ net: 1999.99, vat: 140, total: 2139.99 });
      const created = await createApDoc("invoice", { tag: tag("multi"), lines });
      const res = await submitApDoc(created.id);
      expect(res.status, JSON.stringify(res.body).slice(0, 200)).toBe(200);

      const jv = await jvOfSource("ap_invoice", created.id);
      expectBalanced(jv);
      const vendor = await firstVendor();
      const apAccount = await codeOfAccount(vendor.apAccountId);
      const vatAccount = await glSettingAccount("input_vat_account_id");
      expect(sum(jv, "5300", "dr")).toBe(expected.net);
      expect(sum(jv, vatAccount, "dr")).toBe(expected.vat);
      expect(sum(jv, apAccount, "cr")).toBe(expected.total);
    },
  );

  test(
    "TC-APINV-400003 อนุมัติใบที่ลงบัญชีแล้ว (ไม่มี workflow): ถูกปฏิเสธ AP_INVOICE_IMMUTABLE และใบยังคง posted",
    {
      annotation: [
        { type: "preconditions", description: "ใบ 1 บรรทัดที่ Submit ลงบัญชีแล้ว (AP invoice ไม่มี workflow); ทดสอบความไม่เปลี่ยนแปลงของใบ posted ไม่ใช่สิทธิ์ของ Budget (gateway ไม่มี @Permission บน approve)" },
        { type: "steps", description: "1. สร้างและ Submit ใบ (Admin)\n2. Budget (ผู้อนุมัติฝั่งบัญชี) เรียก POST approve ผ่าน API" },
        {
          type: "expected",
          description:
            "ตอบ 409 รหัส AP_INVOICE_IMMUTABLE; ใบยัง posted, ค้าง 1,069.99, และไม่มี JV เพิ่ม (1 ใบ). assumption: AP invoice ไม่มีขั้นอนุมัติ จึงไม่มีอะไรให้ Budget อนุมัติหลัง Submit ลงบัญชีแล้ว",
        },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async () => {
      const created = await createApDoc("invoice", { tag: tag("approve"), lines: [{ qty: 3, price: 333.33 }] });
      expect((await submitApDoc(created.id)).status).toBe(200);
      const jvBefore = new Set((await jvOfSource("ap_invoice", created.id)).map((l) => l.jvId));
      const res = await approveApDoc(created.id);
      expect(res.status).toBe(409);
      expect(res.body?.error?.code).toBe("AP_INVOICE_IMMUTABLE");
      const doc = await getApDoc(created.id);
      expect(doc.status).toBe("posted");
      expect(doc.open).toBe(docAmounts([{ qty: 3, price: 333.33 }]).total);
      expect(new Set((await jvOfSource("ap_invoice", created.id)).map((l) => l.jvId)).size).toBe(jvBefore.size);
    },
  );

  test(
    "TC-APINV-400010 Void ใบที่ลงบัญชีแล้วและยังไม่มีการจ่าย: JV กลับรายการหักล้างของเดิมพอดี",
    {
      annotation: [
        { type: "preconditions", description: "Admin login (มีสิทธิ์ void); ใบ 3 x 333.33 ที่ Submit ลงบัญชีแล้ว ยังไม่มี payment" },
        { type: "steps", description: "1. เปิดหน้ารายละเอียดใบที่ลงบัญชีแล้ว\n2. กด Void ใส่เหตุผล แล้วยืนยัน\n3. ดึง JV ทั้งหมดของใบ" },
        {
          type: "expected",
          description:
            "toast Invoice voided สถานะ Void ค้าง 0.00; มี JV กลับรายการ 1 ใบ ผูกกับ JV เดิม; ทุกบรรทัดสลับ Dr/Cr กับของเดิม (Cr 5300 999.99, Cr 1170 70.00, Dr 2100 1,069.99) ผลรวมสุทธิต่อบัญชีเป็น 0. assumption: ใบที่ยังไม่มี payment void ได้และสร้าง JV กลับรายการ (inv:188 ไม่ระบุ; jv:221-222 ระบุเฉพาะ JV กลับรายการ)",
        },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const ap = new ApInvoicePage(page);
      const dp = await buDecimals();
      const expected = docAmounts([{ qty: 3, price: 333.33 }], 7, dp);
      const created = await createApDoc("invoice", { tag: tag("void"), lines: [{ qty: 3, price: 333.33 }] });
      expect((await submitApDoc(created.id)).status).toBe(200);
      await ap.gotoDetail(created.id);
      await expect(ap.statusChip()).toHaveText(/posted/i);

      await expectSaved(page, /\/ap-invoice\/[0-9a-f-]{36}\/void$/, () => ap.confirmVoid("e2e void"), ap.toastWith(/invoice voided/i));
      await expect(ap.statusChip()).toHaveText(/void/i);

      const doc = await getApDoc(created.id);
      expect(doc.status).toBe("void");
      expect(doc.voidGlJvId).not.toBeNull();
      const jv = await jvOfSource("ap_invoice", created.id);
      expectBalanced(jv);
      const heads = [...new Set(jv.map((l) => l.jvId))];
      expect(heads).toHaveLength(2);
      const original = jv.filter((l) => l.reversalOfJvId === null);
      const reversing = jv.filter((l) => l.reversalOfJvId !== null);
      expect(reversing.every((l) => l.reversalOfJvId === original[0].jvId)).toBe(true);
      const vatAccount = await glSettingAccount("input_vat_account_id");
      const apAccount = await codeOfAccount((await firstVendor()).apAccountId);
      expect(sum(reversing, "5300", "cr")).toBe(expected.net);
      expect(sum(reversing, vatAccount, "cr")).toBe(expected.vat);
      expect(sum(reversing, apAccount, "dr")).toBe(expected.total);
      for (const account of new Set(jv.map((l) => l.account))) {
        expect(round(sum(jv, account, "dr") - sum(jv, account, "cr"), 4), `net of ${account} after void`).toBe(0);
      }
    },
  );

  test(
    "TC-APINV-400011 Void ใบที่มี payment แล้ว (ใบของเทสต์เอง จ่าย 400.00): ถูกปฏิเสธ AP_INVOICE_HAS_PAYMENT ใบไม่เปลี่ยน",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; ใบ 3 x 333.33 (รวม 1,069.99) ที่ Submit ลงบัญชีแล้วและจ่ายบางส่วน 400.00 (payment Submit + Approve ลงบัญชี) สร้างเองต่อเคส ไม่แตะ read-set" },
        { type: "steps", description: "1. เปิดหน้ารายละเอียดใบที่จ่ายบางส่วน\n2. กด Void ใส่เหตุผลแล้วยืนยัน\n3. เรียก void ผ่าน API ซ้ำเพื่ออ่านรหัสข้อผิดพลาด" },
        {
          type: "expected",
          description: "backend ปฏิเสธ 409 รหัส AP_INVOICE_HAS_PAYMENT มี toast แจ้ง; ใบยัง posted ค้าง 669.99 (1,069.99 - 400.00) และจำนวน JV ไม่เปลี่ยน. assumption: ใบที่มี payment void ตรง ๆ ไม่ได้ ต้องยกเลิก payment ก่อน (ตาม error code ของ BE; docs ไม่ระบุ)",
        },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const ap = new ApInvoicePage(page);
      const total = docAmounts([{ qty: 3, price: 333.33 }]).total;
      const partial = await createApDoc("invoice", { tag: tag("partvoid"), lines: [{ qty: 3, price: 333.33 }] });
      expect((await submitApDoc(partial.id)).status).toBe(200);
      const payment = await createPayment([{ id: partial.id, amount: 400 }]);
      expect((await submitPayment(payment.id)).status).toBe(200);
      expect((await approvePayment(payment.id)).status).toBe(200);
      expect((await getApDoc(partial.id)).open).toBe(round(total - 400, 2));
      const jvBefore = (await jvOfSource("ap_invoice", partial.id)).length;
      await ap.gotoDetail(partial.id);

      const status = await expectRefused(page, /\/ap-invoice\/[0-9a-f-]{36}\/void$/, () => ap.confirmVoid("e2e void"), ap.toastWith(/payment/i));
      expect(status).toBe(409);
      const raw = await voidApDoc(partial.id);
      expect(raw.status).toBe(409);
      expect(raw.body?.error?.code).toBe("AP_INVOICE_HAS_PAYMENT");

      const after = await getApDoc(partial.id);
      expect(after.status).toBe("posted");
      expect(after.open).toBe(round(total - 400, 2));
      expect(after.voidGlJvId).toBeNull();
      expect((await jvOfSource("ap_invoice", partial.id)).length).toBe(jvBefore);
    },
  );
});

// ── 10 security ─────────────────────────────────────────────────────────
requestorTest.describe("AP invoice (801) - Requestor (viewer)", () => {
  requestorTest(
    "TC-APINV-100001 Requestor เปิดรายละเอียดใบที่ลงบัญชีแล้ว: ไม่เห็นปุ่ม Void",
    {
      annotation: [
        { type: "preconditions", description: "Requestor login (accounting viewer: ดูได้ ไม่มีสิทธิ์ void/approve); E2E-AP-POSTED ลงบัญชีแล้ว" },
        { type: "steps", description: "1. เปิดหน้ารายละเอียด E2E-AP-POSTED" },
        { type: "expected", description: "เห็นข้อมูลใบและสถานะ Posted แต่ไม่มีปุ่ม Void (ปุ่ม Approve ไม่ปรากฏบนใบ posted อยู่แล้วทุกบทบาท จึงไม่ใช้เป็นหลักฐานสิทธิ์)" },
        { type: "note", description: "เดิมปักเป็นบั๊ก (FE แสดง Void ตามสถานะอย่างเดียว) แก้แล้ว 2026-11-25 พร้อม AP invoice workflow ที่ FE ใช้ allowed_actions" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Authorization" },
      ],
    },
    async ({ page }) => {
      const ap = new ApInvoicePage(page);
      const doc = await seededApDoc("E2E-AP-POSTED");
      await ap.gotoDetail(doc.id);
      await expect(ap.statusChip()).toHaveText(/posted/i);
      // Was pinned as a known bug (Void shown on status alone); fixed 2026-11-25 with the AP invoice workflow
      // (FE #723 / BE #1109: actions come from allowed_actions).
      await expect(ap.voidButton()).toHaveCount(0);
    },
  );

  requestorTest(
    "TC-APINV-100002 Requestor void ใบผ่าน API: ถูกปฏิเสธ 4xx และใบยังคง posted",
    {
      annotation: [
        { type: "preconditions", description: "ใบ 3 x 333.33 ที่ Admin Submit ลงบัญชีแล้ว; Requestor ไม่มีสิทธิ์ accounting.ap.void" },
        { type: "steps", description: "1. Requestor เรียก POST /ap-invoice/:id/void ผ่าน API" },
        { type: "expected", description: "ตอบ 403 (permission) ไม่ใช่ 2xx; ใบยัง posted ค้าง 1,069.99; ไม่มี JV กลับรายการ" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Security" },
      ],
    },
    async () => {
      const created = await createApDoc("invoice", { tag: tag("reqvoid"), lines: [{ qty: 3, price: 333.33 }] });
      expect((await submitApDoc(created.id)).status).toBe(200);
      const res = await voidApDoc(created.id, "Requestor");
      expect(res.status, JSON.stringify(res.body).slice(0, 200)).toBe(403);
      const doc = await getApDoc(created.id);
      expect(doc.status).toBe("posted");
      expect(doc.voidGlJvId).toBeNull();
      expect(new Set((await jvOfSource("ap_invoice", created.id)).map((l) => l.jvId)).size).toBe(1);
    },
  );

  requestorTest(
    "TC-APINV-100003 Requestor approve ใบ Draft ผ่าน API: ถูกปฏิเสธเพราะสถานะ (409 AP_INVOICE_IMMUTABLE) ไม่ใช่สิทธิ์ และใบยังคง draft",
    {
      annotation: [
        { type: "preconditions", description: "ใบ Draft ที่ Admin สร้างผ่าน API; Requestor เป็น viewer" },
        { type: "steps", description: "1. Requestor เรียก POST /ap-invoice/:id/approve ผ่าน API" },
        {
          type: "expected",
          description:
            "ตอบ 409 รหัส AP_INVOICE_IMMUTABLE (ไม่ใช่ 403); ใบยัง draft ไม่มี JV. หมายเหตุ: gateway ไม่มี @Permission บน create/submit/approve ตั้งใจ (ap-invoice.controller.ts docblock, 'เหมือน gl-jv'; มีเฉพาะ void) จึงไม่มีการปฏิเสธด้วยสิทธิ์ให้ยืนยันบน approve; assumption: การปฏิเสธด้วยสถานะคือพฤติกรรมที่ถูกต้องของ AP ที่ไม่มี workflow",
        },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async () => {
      const created = await createApDoc("invoice", { tag: tag("reqapprove"), lines: [{ qty: 1, price: 100 }] });
      const res = await approveApDoc(created.id, "Requestor");
      expect(res.status, JSON.stringify(res.body).slice(0, 200)).toBe(409);
      expect(res.body?.error?.code).toBe("AP_INVOICE_IMMUTABLE");
      const doc = await getApDoc(created.id);
      expect(doc.status).toBe("draft");
      expect(doc.glJvId).toBeNull();
    },
  );
});
