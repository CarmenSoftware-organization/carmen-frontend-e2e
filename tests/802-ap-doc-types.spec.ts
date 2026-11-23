import { expect } from "@playwright/test";
import { createAuthTest } from "./fixtures/auth.fixture";
import { ApInvoicePage, type ApPageType } from "./pages/ap-invoice.page";
import { buConfigSend } from "./helpers/bu-api";
import { createApDoc, getApDoc, seededApDoc, submitApDoc, type ApDocType } from "./helpers/ap-api";
import { assertAccountingReady, buDecimals, CREATOR, jvOfSource, listAllRows, type JvLine } from "./helpers/gl-api";
import { docAmounts, expectBalanced, round } from "./helpers/money";
import { expectSaved } from "./helpers/settle";
import { uid } from "./helpers/test-data";

// ─────────────────────────────────────────────────────────────────────────
// AP deposit, debit note and credit note on the TEST BU (GR2VYNKQ): create through the UI, post, JV signs, read set.
//
// Read set (never mutated, seeded by `bun run data:reset --yes`): E2E-AP-DEPOSIT (2,000.00) · E2E-AP-DN (150.00) ·
// E2E-AP-CN (120.00), all posted with no VAT. Every state-changing case creates its own document tagged
// `E2E-T-802-<case>-<uid>`, so the spec re-runs without a reset.
//
// Sign convention (preflight 4.3, inv:106 fixes none): amounts are positive in the API; a debit note increases the
// vendor's open balance (posts like an invoice: Dr expense, Cr AP control), a credit note reduces it (Dr AP control,
// Cr expense / VAT), a deposit posts Dr advance-deposit account / Cr AP control. Every such case says "assumption:".
// Expected amounts come from tests/helpers/money.ts or the literals above, never from the BE echo.
// ─────────────────────────────────────────────────────────────────────────
const test = createAuthTest("carmensoftware.dev+admin@gmail.com");
test.describe.configure({ timeout: 90_000 });

const tag = (key: string) => `E2E-T-802-${key}-${uid}`;

async function docByTag(vendorInvoiceNo: string) {
  const hit = (await listAllRows(CREATOR, `/ap-invoice?search=${encodeURIComponent(vendorInvoiceNo)}`)).find((d) => d.vendor_invoice_no === vendorInvoiceNo);
  if (!hit) throw new Error(`no AP document tagged ${vendorInvoiceNo}`);
  return getApDoc(String(hit.id));
}

async function firstVendorCode(): Promise<string> {
  const r = await buConfigSend(CREATOR, "GET", "/vendors?perpage=1");
  const v = r.body?.data?.[0];
  if (r.status !== 200 || !v) throw new Error(`no vendor on the TEST BU (GET vendors -> ${r.status}) - run data:reset`);
  return String(v.code);
}

let coa: Promise<Map<string, string>> | null = null;
async function codeOfAccount(id: string): Promise<string> {
  coa ??= listAllRows(CREATOR, "/chart-of-accounts", true).then((rows) => new Map(rows.map((a) => [String(a.id), String(a.code)])));
  const code = (await coa).get(id);
  if (!code) throw new Error(`no COA account with id ${id}`);
  return code;
}

/** COA code a `gl_setting` account key points at (configuration, not an echo of the document under test). */
async function glSettingAccount(key: "input_vat_account_id" | "ap_control_account_id" | "advance_deposit_account_id"): Promise<string> {
  const r = await buConfigSend(CREATOR, "GET", "/app-config/gl_setting");
  const id = r.body?.data?.value?.[key];
  if (r.status !== 200 || !id) throw new Error(`gl_setting.${key} missing (GET -> ${r.status}) - run data:reset`);
  return codeOfAccount(String(id));
}

function sum(lines: JvLine[], account: string, side: "dr" | "cr"): number {
  return round(lines.filter((l) => l.account === account).reduce((s, l) => s + l[side], 0), 4);
}

/** The page type, API type and the debit account a document type posts to. */
const KIND = {
  deposit: { page: "deposit" as ApPageType, api: "deposit" as ApDocType, vat: false },
  debit: { page: "debit-note" as ApPageType, api: "debit_note" as ApDocType, vat: true },
  credit: { page: "credit-note" as ApPageType, api: "credit_note" as ApDocType, vat: true },
};

/** Create a draft through the new-document form (3 x 333.33), return its id. */
async function createViaUi(page: import("@playwright/test").Page, kind: keyof typeof KIND, no: string) {
  const ap = new ApInvoicePage(page);
  const { page: type, vat } = KIND[kind];
  await ap.gotoNew(type);
  await ap.selectVendor(await firstVendorCode());
  await ap.setVendorInvoiceNo(no);
  await ap.fillLine(1, { description: `${no} line 1`, qty: 3, price: 333.33, account: kind === "deposit" ? "1180" : undefined }, { vat });
  return ap;
}

/** Shared body of the "submit posts a balanced JV" cases: expected JV lines are given per document type. */
async function expectPostedJv(id: string, expected: Record<"dr" | "cr", [string, number][]>) {
  const jv = await jvOfSource("ap_invoice", id);
  expectBalanced(jv);
  expect(jv.every((l) => l.jvStatus === "posted")).toBe(true);
  for (const [acct, amount] of expected.dr) expect(sum(jv, acct, "dr")).toBe(amount);
  for (const [acct, amount] of expected.cr) expect(sum(jv, acct, "cr")).toBe(amount);
  const touched = new Set([...expected.dr, ...expected.cr].map(([a]) => a));
  expect(jv.every((l) => touched.has(l.account))).toBe(true);
}

test.describe("AP deposit, debit note, credit note (802)", () => {
  test.beforeAll(async () => {
    await assertAccountingReady();
  });

  // ── 01 deposit ────────────────────────────────────────────────────────
  test(
    "TC-APDOC-010001 สร้างเงินมัดจำผ่าน UI 3 x 333.33 (ไม่มี VAT): ยอด 999.99 บันทึกเป็น Draft",
    {
      annotation: [
        { type: "preconditions", description: "Admin login บน TEST BU; vendor แรกของ BU; บัญชี 1180 Advance Deposit มีใน COA" },
        { type: "steps", description: "1. เปิด /accounting/accounts-payable/deposit/new\n2. เลือก vendor กรอก Vendor Invoice\n3. บรรทัด 1 = 3 x 333.33 บัญชี 1180 ไม่ใส่ VAT\n4. อ่านแถบสรุป\n5. กด Save Draft" },
        {
          type: "expected",
          description:
            "แถบสรุป net 999.99 VAT 0.00 total 999.99; toast Invoice saved; API ได้ doc_type deposit สถานะ draft ยอดเดียวกัน; Submit ผ่าน API แล้ว JV ลง Dr 1180 (บัญชีที่เลือกในฟอร์ม) / Cr 2100. assumption: เงินมัดจำไม่มี VAT (BE ปฏิเสธบรรทัดมัดจำที่มี VAT: 422) และยอด = จำนวน x ราคา ปัดครึ่งขึ้น",
        },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const dp = await buDecimals();
      const expected = docAmounts([{ qty: 3, price: 333.33, vat: false }], 7, dp);
      expect(expected).toEqual({ net: 999.99, vat: 0, total: 999.99 });
      const no = tag("dep-create");
      const ap = await createViaUi(page, "deposit", no);
      expect(await ap.totalOf("net")).toBe(expected.net);
      expect(await ap.totalOf("vat")).toBe(expected.vat);
      expect(await ap.totalOf("total")).toBe(expected.total);
      await expectSaved(page, /\/ap-invoice(\?|$)/, () => ap.saveDraftButton().click(), ap.toastWith(/saved/i));
      const doc = await docByTag(no);
      expect(doc.type).toBe("deposit");
      expect(doc.status).toBe("draft");
      expect({ net: doc.net, vat: doc.vat, total: doc.total }).toEqual(expected);
      // the account picked on the form is the one the posting uses: post it and read the JV
      expect((await submitApDoc(doc.id)).status).toBe(200);
      await expectPostedJv(doc.id, { dr: [[await glSettingAccount("advance_deposit_account_id"), expected.total]], cr: [[await glSettingAccount("ap_control_account_id"), expected.total]] });
    },
  );

  test(
    "TC-APDOC-010002 Submit เงินมัดจำ: ลงบัญชี Dr 1180 เงินมัดจำ = 999.99, Cr 2100 เจ้าหนี้ = 999.99",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; เงินมัดจำ Draft 3 x 333.33 ที่สร้างผ่าน API; GL period เปิดครอบวันนี้" },
        { type: "steps", description: "1. เปิดหน้ารายละเอียดเงินมัดจำ Draft\n2. กด Submit\n3. ดึง JV ที่มี source = ใบนี้" },
        {
          type: "expected",
          description:
            "สถานะ Posted ค้าง 999.99; JV สมดุล มี 2 บัญชีเท่านั้น: Dr = บัญชีเงินมัดจำใน gl_setting (1180) 999.99, Cr = บัญชีเจ้าหนี้ใน gl_setting (2100) 999.99. assumption: เงินมัดจำลง Dr บัญชีเงินมัดจำล่วงหน้า / Cr เจ้าหนี้ ตาม BE (inv:266 ยังเป็นคำถามเปิด ว่าเป็นหนี้สิน สินทรัพย์ หรือทั้งคู่)",
        },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const ap = new ApInvoicePage(page);
      const created = await createApDoc("deposit", { tag: tag("dep-post"), lines: [{ qty: 3, price: 333.33, vat: false }] });
      await ap.gotoDetail(created.id, "deposit");
      await expectSaved(page, /\/ap-invoice\/[0-9a-f-]{36}\/submit$/, () => ap.submitButton().click(), ap.toastWith(/submitted/i));
      await expect(ap.statusChip()).toHaveText(/posted/i);
      const deposit = await glSettingAccount("advance_deposit_account_id");
      const control = await glSettingAccount("ap_control_account_id");
      expect([deposit, control]).toEqual(["1180", "2100"]);
      await expectPostedJv(created.id, { dr: [[deposit, 999.99]], cr: [[control, 999.99]] });
      const doc = await getApDoc(created.id);
      expect(doc.status).toBe("posted");
      expect(doc.open).toBe(999.99);
    },
  );

  test(
    "TC-APDOC-010003 เงินมัดจำที่มีบรรทัดคิด VAT: BE ปฏิเสธ 422 และไม่มีใบถูกสร้าง",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; vendor แรกของ BU; มี tax profile Vat 7%" },
        { type: "steps", description: "1. POST /ap-invoice doc_type deposit บรรทัด 3 x 333.33 พร้อม Vat 7%\n2. ค้นหาใบด้วย Vendor Invoice ที่ใช้" },
        { type: "expected", description: "ตอบ 422 ข้อความระบุว่าบรรทัดมัดจำมี VAT ไม่ได้; ค้นไม่เจอใบที่ใช้เลขนั้น. assumption: เงินมัดจำไม่มี VAT (พฤติกรรมของ BE ที่ตรวจพบ ไม่ได้ระบุใน inv)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async () => {
      const no = tag("dep-vat");
      await expect(createApDoc("deposit", { tag: no, lines: [{ qty: 3, price: 333.33 }] })).rejects.toThrow(/422.*deposit lines may not carry VAT/i);
      const hits = (await listAllRows(CREATOR, `/ap-invoice?search=${encodeURIComponent(no)}`)).filter((d) => d.vendor_invoice_no === no);
      expect(hits).toHaveLength(0);
    },
  );

  test(
    "TC-APDOC-010004 รายละเอียดเงินมัดจำ E2E-AP-DEPOSIT: 2,000.00 ตรงกับ oracle, API และ JV",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; data:reset --yes แล้ว (E2E-AP-DEPOSIT เงินมัดจำ 2,000.00 ลงบัญชีแล้ว)" },
        { type: "steps", description: "1. หา id ของ E2E-AP-DEPOSIT\n2. เปิดหน้ารายละเอียดชนิด deposit\n3. อ่านแถบสรุป\n4. ดึง JV ของใบ" },
        {
          type: "expected",
          description: "สถานะ Posted; net 2,000.00 VAT 0.00 total 2,000.00 ค้าง 2,000.00 ตรงกับค่าของ read set และ API; JV Dr 1180 = 2,000.00, Cr 2100 = 2,000.00. assumption: เงินมัดจำลง Dr เงินมัดจำ / Cr เจ้าหนี้ (inv:266)",
        },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const ap = new ApInvoicePage(page);
      const doc = await seededApDoc("E2E-AP-DEPOSIT");
      await ap.gotoDetail(doc.id, "deposit");
      await expect(ap.statusChip()).toHaveText(/posted/i);
      expect(await ap.totalOf("net")).toBe(2000);
      expect(await ap.totalOf("vat")).toBe(0);
      expect(await ap.totalOf("total")).toBe(2000);
      expect(await ap.totalOf("open")).toBe(2000);
      expect({ type: doc.type, status: doc.status, net: doc.net, vat: doc.vat, total: doc.total, open: doc.open }).toEqual({
        type: "deposit",
        status: "posted",
        net: 2000,
        vat: 0,
        total: 2000,
        open: 2000,
      });
      await expectPostedJv(doc.id, { dr: [["1180", 2000]], cr: [["2100", 2000]] });
    },
  );

  // ── 02 debit note ─────────────────────────────────────────────────────
  test(
    "TC-APDOC-020001 สร้าง Debit Note ผ่าน UI 3 x 333.33 + VAT 7%: net 999.99 VAT 70.00 รวม 1,069.99 เป็น Draft",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; vendor แรกของ BU; บัญชี 5300 และ Vat 7% มีใน TEST BU" },
        { type: "steps", description: "1. เปิด /accounting/accounts-payable/debit-note/new\n2. เลือก vendor กรอก Vendor Invoice\n3. บรรทัด 1 = 3 x 333.33 (5300, Vat 7%)\n4. อ่านแถบสรุป\n5. กด Save Draft" },
        {
          type: "expected",
          description:
            "แถบสรุป net 999.99 VAT 70.00 total 1,069.99 (999.99 x 7% = 69.9993 ปัดเป็น 70.00); บันทึกแล้ว API ได้ doc_type debit_note สถานะ draft ยอดเดียวกัน. assumption: ไม่ต้องอ้างใบแจ้งหนี้เดิม (inv:267 ยังเป็นคำถามเปิด; BE สร้างได้โดยมีแค่ vendor วันที่ และบรรทัด); VAT 7% บนฐานก่อน VAT ปัดครึ่งขึ้น",
        },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const dp = await buDecimals();
      const expected = docAmounts([{ qty: 3, price: 333.33 }], 7, dp);
      expect(expected).toEqual({ net: 999.99, vat: 70, total: 1069.99 });
      const no = tag("dn-create");
      const ap = await createViaUi(page, "debit", no);
      expect(await ap.totalOf("net")).toBe(expected.net);
      expect(await ap.totalOf("vat")).toBe(expected.vat);
      expect(await ap.totalOf("total")).toBe(expected.total);
      await expectSaved(page, /\/ap-invoice(\?|$)/, () => ap.saveDraftButton().click(), ap.toastWith(/saved/i));
      const doc = await docByTag(no);
      expect(doc.type).toBe("debit_note");
      expect(doc.status).toBe("draft");
      expect({ net: doc.net, vat: doc.vat, total: doc.total }).toEqual(expected);
    },
  );

  test(
    "TC-APDOC-020002 Submit Debit Note: เจ้าหนี้เพิ่ม Dr 5300 = 999.99, Dr 1170 = 70.00, Cr 2100 = 1,069.99",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; Debit Note Draft 3 x 333.33 ที่สร้างผ่าน API; GL period เปิดครอบวันนี้" },
        { type: "steps", description: "1. เปิดหน้ารายละเอียด Debit Note Draft\n2. กด Submit\n3. ดึง JV ที่มี source = ใบนี้" },
        {
          type: "expected",
          description:
            "สถานะ Posted ค้าง 1,069.99; JV สมดุล; Dr 5300 = 999.99, Dr 1170 = 70.00, Cr 2100 = 1,069.99 (ยอดเจ้าหนี้เพิ่มขึ้น) ไม่มีบัญชีอื่น. assumption: Debit Note เพิ่มยอดเจ้าหนี้ จึงลงเหมือนใบแจ้งหนี้ (Dr ค่าใช้จ่ายและภาษีซื้อ / Cr เจ้าหนี้) ทิศทางไม่ได้ระบุใน inv:106",
        },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const ap = new ApInvoicePage(page);
      const expected = docAmounts([{ qty: 3, price: 333.33 }]);
      const created = await createApDoc("debit_note", { tag: tag("dn-post"), lines: [{ qty: 3, price: 333.33 }] });
      await ap.gotoDetail(created.id, "debit-note");
      await expectSaved(page, /\/ap-invoice\/[0-9a-f-]{36}\/submit$/, () => ap.submitButton().click(), ap.toastWith(/submitted/i));
      await expect(ap.statusChip()).toHaveText(/posted/i);
      const vat = await glSettingAccount("input_vat_account_id");
      const control = await glSettingAccount("ap_control_account_id");
      await expectPostedJv(created.id, { dr: [["5300", expected.net], [vat, expected.vat]], cr: [[control, expected.total]] });
      const doc = await getApDoc(created.id);
      expect(doc.status).toBe("posted");
      expect(doc.open).toBe(expected.total);
    },
  );

  test(
    "TC-APDOC-020003 รายละเอียด Debit Note E2E-AP-DN: 150.00 ตรงกับ oracle, API และ JV",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; data:reset --yes แล้ว (E2E-AP-DN ยอด 150.00 ไม่มี VAT ลงบัญชีแล้ว)" },
        { type: "steps", description: "1. หา id ของ E2E-AP-DN\n2. เปิดหน้ารายละเอียดชนิด debit-note\n3. อ่านแถบสรุป\n4. ดึง JV ของใบ" },
        {
          type: "expected",
          description: "สถานะ Posted; net 150.00 VAT 0.00 total 150.00 ค้าง 150.00 ตรงกับ read set และ API; JV Dr 5300 = 150.00, Cr 2100 = 150.00. assumption: Debit Note เพิ่มยอดเจ้าหนี้ (Dr ค่าใช้จ่าย / Cr เจ้าหนี้)",
        },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const ap = new ApInvoicePage(page);
      const doc = await seededApDoc("E2E-AP-DN");
      await ap.gotoDetail(doc.id, "debit-note");
      await expect(ap.statusChip()).toHaveText(/posted/i);
      expect(await ap.totalOf("net")).toBe(150);
      expect(await ap.totalOf("vat")).toBe(0);
      expect(await ap.totalOf("total")).toBe(150);
      expect(await ap.totalOf("open")).toBe(150);
      expect({ type: doc.type, status: doc.status, net: doc.net, vat: doc.vat, total: doc.total, open: doc.open }).toEqual({
        type: "debit_note",
        status: "posted",
        net: 150,
        vat: 0,
        total: 150,
        open: 150,
      });
      await expectPostedJv(doc.id, { dr: [["5300", 150]], cr: [["2100", 150]] });
    },
  );

  // ── 03 credit note ────────────────────────────────────────────────────
  test(
    "TC-APDOC-030001 สร้าง Credit Note ผ่าน UI 3 x 333.33 + VAT 7%: net 999.99 VAT 70.00 รวม 1,069.99 เป็น Draft",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; vendor แรกของ BU; บัญชี 5300 และ Vat 7% มีใน TEST BU" },
        { type: "steps", description: "1. เปิด /accounting/accounts-payable/credit-note/new\n2. เลือก vendor กรอก Vendor Invoice\n3. บรรทัด 1 = 3 x 333.33 (5300, Vat 7%)\n4. อ่านแถบสรุป\n5. กด Save Draft" },
        {
          type: "expected",
          description:
            "แถบสรุป net 999.99 VAT 70.00 total 1,069.99; บันทึกแล้ว API ได้ doc_type credit_note สถานะ draft ยอดเป็นค่าบวกเท่ากัน. assumption: ยอด Credit Note เก็บเป็นค่าบวก ไม่ติดลบ (inv:106 ไม่ระบุเครื่องหมาย); ไม่ต้องอ้างใบแจ้งหนี้เดิม (inv:267)",
        },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const dp = await buDecimals();
      const expected = docAmounts([{ qty: 3, price: 333.33 }], 7, dp);
      expect(expected).toEqual({ net: 999.99, vat: 70, total: 1069.99 });
      const no = tag("cn-create");
      const ap = await createViaUi(page, "credit", no);
      expect(await ap.totalOf("net")).toBe(expected.net);
      expect(await ap.totalOf("vat")).toBe(expected.vat);
      expect(await ap.totalOf("total")).toBe(expected.total);
      await expectSaved(page, /\/ap-invoice(\?|$)/, () => ap.saveDraftButton().click(), ap.toastWith(/saved/i));
      const doc = await docByTag(no);
      expect(doc.type).toBe("credit_note");
      expect(doc.status).toBe("draft");
      expect({ net: doc.net, vat: doc.vat, total: doc.total }).toEqual(expected);
    },
  );

  test(
    "TC-APDOC-030002 Submit Credit Note: เจ้าหนี้ลด Dr 2100 = 1,069.99, Cr 5300 = 999.99, Cr 1170 = 70.00",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; Credit Note Draft 3 x 333.33 ที่สร้างผ่าน API; GL period เปิดครอบวันนี้" },
        { type: "steps", description: "1. เปิดหน้ารายละเอียด Credit Note Draft\n2. กด Submit\n3. ดึง JV ที่มี source = ใบนี้" },
        {
          type: "expected",
          description:
            "สถานะ Posted; JV สมดุล; Dr 2100 = 1,069.99, Cr 5300 = 999.99, Cr 1170 = 70.00 (ยอดเจ้าหนี้ลดลง) ไม่มีบัญชีอื่น. assumption: Credit Note ลดยอดเจ้าหนี้ จึงลงตรงข้ามกับใบแจ้งหนี้ (Dr เจ้าหนี้ / Cr ค่าใช้จ่ายและภาษีซื้อ) ทิศทางไม่ได้ระบุใน inv:106",
        },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const ap = new ApInvoicePage(page);
      const expected = docAmounts([{ qty: 3, price: 333.33 }]);
      const created = await createApDoc("credit_note", { tag: tag("cn-post"), lines: [{ qty: 3, price: 333.33 }] });
      await ap.gotoDetail(created.id, "credit-note");
      await expectSaved(page, /\/ap-invoice\/[0-9a-f-]{36}\/submit$/, () => ap.submitButton().click(), ap.toastWith(/submitted/i));
      await expect(ap.statusChip()).toHaveText(/posted/i);
      const vat = await glSettingAccount("input_vat_account_id");
      const control = await glSettingAccount("ap_control_account_id");
      await expectPostedJv(created.id, { dr: [[control, expected.total]], cr: [["5300", expected.net], [vat, expected.vat]] });
      const doc = await getApDoc(created.id);
      expect(doc.status).toBe("posted");
    },
  );

  test(
    "TC-APDOC-030003 รายละเอียด Credit Note E2E-AP-CN: 120.00 ตรงกับ oracle, API และ JV",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; data:reset --yes แล้ว (E2E-AP-CN ยอด 120.00 ไม่มี VAT ลงบัญชีแล้ว)" },
        { type: "steps", description: "1. หา id ของ E2E-AP-CN\n2. เปิดหน้ารายละเอียดชนิด credit-note\n3. อ่านแถบสรุป\n4. ดึง JV ของใบ" },
        {
          type: "expected",
          description: "สถานะ Posted; net 120.00 VAT 0.00 total 120.00 ค้าง 120.00 ตรงกับ read set และ API; JV Dr 2100 = 120.00, Cr 5300 = 120.00. assumption: Credit Note ลดยอดเจ้าหนี้ (Dr เจ้าหนี้ / Cr ค่าใช้จ่าย) และยอดเก็บเป็นค่าบวก",
        },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const ap = new ApInvoicePage(page);
      const doc = await seededApDoc("E2E-AP-CN");
      await ap.gotoDetail(doc.id, "credit-note");
      await expect(ap.statusChip()).toHaveText(/posted/i);
      expect(await ap.totalOf("net")).toBe(120);
      expect(await ap.totalOf("vat")).toBe(0);
      expect(await ap.totalOf("total")).toBe(120);
      expect(await ap.totalOf("open")).toBe(120);
      expect({ type: doc.type, status: doc.status, net: doc.net, vat: doc.vat, total: doc.total, open: doc.open }).toEqual({
        type: "credit_note",
        status: "posted",
        net: 120,
        vat: 0,
        total: 120,
        open: 120,
      });
      await expectPostedJv(doc.id, { dr: [["2100", 120]], cr: [["5300", 120]] });
    },
  );
});
