import { expect } from "@playwright/test";
import { createAuthTest } from "./fixtures/auth.fixture";
import { ApPaymentPage } from "./pages/ap-payment.page";
import { ApInvoicePage } from "./pages/ap-invoice.page";
import { buSend, type ApiResult } from "./helpers/bu-api";
import { approvePayment, createApDoc, createPayment, getApDoc, seededApDoc, submitApDoc, submitPayment, voidPayment } from "./helpers/ap-api";
import { assertAccountingReady, CREATOR, jvOfSource, listAllRows, today, type JvLine } from "./helpers/gl-api";
import { expectBalanced, round, whtOf } from "./helpers/money";
import { expectSaved } from "./helpers/settle";
import { uid } from "./helpers/test-data";

// ─────────────────────────────────────────────────────────────────────────
// AP payment on the TEST BU (BU-GR2VYNKQ), money path: WHT 3%, partial payments, void, refusals, read set.
//
// Roles: Admin creates / submits (UI + API); Budget approves through the seeded `ap_payment` workflow
// (Create Request -> Accounting Approval -> Completed); the approval itself is 804. Seeded: bank E2E-BANK (COA 1110),
// payment type E2E-PT, "WHT 3%" profile (COA 2150), AP control 2100.
// Read set (never mutated): E2E-AP-PARTIAL (total 1,070.00, its 400.00 payment carries no WHT -> open 670.00, controller
// ruling R5) · E2E-AP-PAID (open 0). Every state-changing case creates its own tagged invoice and its own payments, so
// the spec re-runs without a reset.
//
// WHT rule (preflight 4.1): computed at PAYMENT on the pre-VAT base; the save equation is
// `invoices = payment + WHT - other expenses` (ap-payment-save-rules.md:17); the payment JV is
// `Dr AP control / Cr WHT payable / Cr Bank` (pay:127-130). "WHT reduces the open amount by cash + WHT" is an
// INFERENCE (rules:17 + inv:99 + pay:127-130, no single sentence states it); it is confirmed on dev and tagged
// "inference" in the cases that rest on it.
// The WHT money cases do NOT use the helper's FE-style fill: they send the oracle literals (`whtBase` / `whtAmount` /
// `paymentAmount`, computed here with money.ts `whtOf`) and assert on what the BE stored and posted.
// ─────────────────────────────────────────────────────────────────────────
const test = createAuthTest("carmensoftware.dev+admin@gmail.com");
test.describe.configure({ timeout: 120_000 });

const tag = (key: string) => `E2E-T-803-${key}-${uid}`;
const WHT_RATE = 3;
const AP = "2100";
const BANK = "1110";
const WHT_PAYABLE = "2150";

function sum(lines: JvLine[], account: string, side: "dr" | "cr"): number {
  return round(lines.filter((l) => l.account === account).reduce((s, l) => s + l[side], 0), 4);
}

/** A posted invoice of one line (`vat: false` = no VAT), its id. */
async function postedInvoice(key: string, price: number, opts: { qty?: number; vat?: boolean; wht?: boolean } = {}): Promise<string> {
  const d = await createApDoc("invoice", { tag: tag(key), lines: [{ qty: opts.qty ?? 1, price, vat: opts.vat, wht: opts.wht }] });
  expect((await submitApDoc(d.id)).status).toBe(200);
  return d.id;
}

/** Submit as the creator and approve as the stage user; both must succeed. */
async function postPayment(id: string): Promise<void> {
  expect((await submitPayment(id)).status).toBe(200);
  expect((await approvePayment(id)).status).toBe(200);
}

async function getPayment(id: string) {
  const r = await buSend(CREATOR, "GET", `/ap-payment/${id}`);
  expect(r.status).toBe(200);
  return r.body.data as Record<string, any>;
}

/** POST a payment with exact figures (the helper refuses an over-allocation client-side, a spec must reach the BE). */
async function rawPayment(docId: string, o: { applied: number; cash: number; wht?: { base: number; amount: number } }, lineIndex = 0): Promise<ApiResult> {
  const doc = await getApDoc(docId);
  const vendor = (await buSend(CREATOR, "GET", `/ap-invoice/${docId}`)).body.data.vendor_id;
  const bank = (await listAllRows(CREATOR, "/bank-accounts", true)).find((b) => b.code === "E2E-BANK");
  const type = (await listAllRows(CREATOR, "/payment-types", true)).find((t) => t.code === "E2E-PT");
  const profile = (await listAllRows(CREATOR, "/tax-profiles", true)).find((t) => t.name === "WHT 3%");
  if (!bank || !type || !profile) throw new Error("no E2E-BANK / E2E-PT / WHT 3% on the TEST BU - run data:reset");
  return buSend(CREATOR, "POST", "/ap-payment", {
    vendor_id: vendor,
    payment_date: today(),
    bank_account_id: String(bank.id),
    payment_type_id: String(type.id),
    payment_method: "bank_transfer",
    payment_amount: o.cash,
    description: "e2e payment",
    allocations: [{ ap_invoice_detail_id: doc.lines[lineIndex].id, applied_amount: o.applied }],
    ...(o.wht ? { wht: [{ wht_tax_profile_id: String(profile.id), base_amount: o.wht.base, wht_amount: o.wht.amount }] } : {}),
  });
}

/** The money assertions shared by the "pay in full with WHT" cases. */
async function expectWhtPaymentPosted(paymentId: string, invoiceId: string, f: { total: number; base: number; wht: number; cash: number }) {
  const pay = await getPayment(paymentId);
  expect(pay.doc_status).toBe("posted");
  expect(Number(pay.total_applied_amount)).toBe(f.total);
  expect(Number(pay.total_wht_amount)).toBe(f.wht);
  const whtRows = pay.tb_ap_payment_wht as Record<string, any>[];
  expect(whtRows).toHaveLength(1);
  expect(Number(whtRows[0].base_amount)).toBe(f.base);
  expect(Number(whtRows[0].wht_rate)).toBe(WHT_RATE);
  expect(Number(whtRows[0].wht_amount)).toBe(f.wht);
  expect(Number(pay.net_paid_amount)).toBe(f.cash);
  const jv = await jvOfSource("ap_payment", paymentId);
  expectBalanced(jv);
  expect(jv.every((l) => l.jvStatus === "posted")).toBe(true);
  expect(sum(jv, AP, "dr")).toBe(f.total);
  expect(sum(jv, BANK, "cr")).toBe(f.cash);
  expect(sum(jv, WHT_PAYABLE, "cr")).toBe(f.wht);
  expect(new Set(jv.map((l) => l.account))).toEqual(new Set([AP, BANK, WHT_PAYABLE]));
  // inference: the invoice open amount drops by cash + WHT, so a fully applied invoice is at 0
  expect((await getApDoc(invoiceId)).open).toBe(0);
}

test.describe("AP payment (803)", () => {
  test.beforeAll(async () => {
    await assertAccountingReady();
  });

  // ── 01 pay in full with WHT 3% ─────────────────────────────────────────
  test(
    "TC-APPAY-010001 จ่ายเต็มใบ 1,000.00 + VAT พร้อม WHT 3%: JV Dr เจ้าหนี้ 1,070.00 / Cr ธนาคาร 1,040.00 / Cr WHT 30.00 ใบเหลือ 0",
    {
      annotation: [
        { type: "preconditions", description: "Admin login บน TEST BU; ใบ 1 x 1,000.00 + VAT 7% (รวม 1,070.00) ลงบัญชีแล้ว; E2E-BANK (1110), E2E-PT, โปรไฟล์ WHT 3% (2150); workflow ap_payment (Admin สร้าง Budget อนุมัติ)" },
        { type: "steps", description: "1. สร้างใบจ่าย: จ่ายเต็ม 1,070.00 ฐาน WHT 1,000.00 ยอด WHT 30.00 เงินสด 1,040.00 (ส่งตัวเลขตามสูตร ไม่ใช้ค่าที่ FE กรอกให้)\n2. Submit (Admin) แล้ว Approve (Budget)\n3. อ่านใบจ่ายและ JV ที่มี source = ใบจ่าย\n4. อ่านยอดค้างของใบ" },
        {
          type: "expected",
          description:
            "ใบจ่าย posted: total_applied 1,070.00, total_wht 30.00 (= whtOf(1000, 3%)), net_paid 1,040.00; JV สมดุลมี 3 บัญชีเท่านั้น: Dr 2100 = 1,070.00, Cr 1110 = 1,040.00, Cr 2150 = 30.00; ยอดค้างของใบ = 0.00. assumption: WHT คิดตอนจ่ายจากฐานก่อน VAT (1,000.00 ไม่ใช่ 1,070.00) ตาม pay:110; inference: ยอดค้างลดลง = เงินสด + WHT (rules:17 + pay:127-130, ยืนยันบน dev)",
        },
        { type: "priority", description: "Critical" },
        { type: "testType", description: "Functional" },
      ],
    },
    async () => {
      const base = 1000;
      const wht = whtOf(base, WHT_RATE, 2);
      expect(wht).toBe(30);
      const total = 1070;
      const inv = await postedInvoice("full", base);
      expect((await getApDoc(inv)).total).toBe(total);
      const pay = await createPayment([{ id: inv, amount: total }], { whtBase: base, whtAmount: wht, paymentAmount: round(total - wht, 2) });
      await postPayment(pay.id);
      await expectWhtPaymentPosted(pay.id, inv, { total, base, wht, cash: 1040 });
    },
  );

  test(
    "TC-APPAY-010002 ขอบปัดเศษ 3 x 333.33 (ฐาน 999.99): WHT 3% = 30.00 (29.9997 ปัดขึ้น) เงินสด 1,039.99 JV ตรงยอด",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; ใบ 3 x 333.33 + VAT 7% (net 999.99, VAT 70.00, รวม 1,069.99) ลงบัญชีแล้ว" },
        { type: "steps", description: "1. สร้างใบจ่ายเต็ม 1,069.99 ฐาน WHT 999.99 ยอด WHT 30.00 เงินสด 1,039.99\n2. Submit และ Approve\n3. อ่านใบจ่ายและ JV" },
        {
          type: "expected",
          description:
            "total_wht 30.00, net_paid 1,039.99; JV: Dr 2100 = 1,069.99, Cr 1110 = 1,039.99, Cr 2150 = 30.00 สมดุล; ยอดค้าง 0.00. assumption: ปัด WHT ครึ่งขึ้นที่ทศนิยม 2 ตำแหน่ง (accounting-foundation.md:103); 999.99 x 3% = 29.9997 -> 30.00",
        },
        { type: "priority", description: "High" },
        { type: "testType", description: "Boundary" },
      ],
    },
    async () => {
      const base = 999.99;
      const wht = whtOf(base, WHT_RATE, 2);
      expect(wht).toBe(30);
      const total = 1069.99;
      const inv = await postedInvoice("round", 333.33, { qty: 3 });
      expect((await getApDoc(inv)).total).toBe(total);
      const pay = await createPayment([{ id: inv, amount: total }], { whtBase: base, whtAmount: wht, paymentAmount: round(total - wht, 2) });
      await postPayment(pay.id);
      await expectWhtPaymentPosted(pay.id, inv, { total, base, wht, cash: 1039.99 });
    },
  );

  test(
    "TC-APPAY-010003 WHT ไม่ตรงสูตร (99.00 แทน 30.00): BE ปฏิเสธ 422 Payment is not balanced ไม่เกิดใบจ่าย",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; ใบ 1 x 1,000.00 + VAT (รวม 1,070.00) ลงบัญชีแล้ว" },
        { type: "steps", description: "1. POST ใบจ่าย: applied 1,070.00, ฐาน 1,000.00, WHT 99.00, เงินสด 1,040.00 (ผลรวมไม่ลงตัว: 1,040.00 + 99.00 != 1,070.00)\n2. อ่านรายการใบจ่ายของ vendor และยอดค้างของใบ" },
        {
          type: "expected",
          description:
            "422 ข้อความ 'Payment is not balanced: invoices = payment + WHT - other expenses'; ไม่มีใบจ่ายใหม่; ยอดค้างของใบยัง 1,070.00. rule: invoices = payment + WHT - other expenses (rules:17), backend ตรวจซ้ำ (rules:22)",
        },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async () => {
      const inv = await postedInvoice("badwht", 1000);
      const before = (await listAllRows(CREATOR, "/ap-payment")).length;
      const r = await rawPayment(inv, { applied: 1070, cash: 1040, wht: { base: 1000, amount: 99 } });
      expect(r.status).toBe(422);
      expect(JSON.stringify(r.body?.message ?? r.body)).toContain("Payment is not balanced");
      expect((await listAllRows(CREATOR, "/ap-payment")).length).toBe(before);
      expect((await getApDoc(inv)).open).toBe(1070);
    },
  );

  // ── 02 partial payments and void ───────────────────────────────────────
  test(
    "TC-APPAY-020001 จ่ายบางส่วน 400 แล้ว 600 ใบ 1,000.00: เหลือ 600 แล้ว 0; void ใบจ่ายที่สองผ่าน UI แล้วกลับมา 600 และ JV กลับรายการหักล้างพอดี",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; ใบ 1 x 1,000.00 ไม่มี VAT ลงบัญชีแล้ว (ค้าง 1,000.00); ใบจ่ายสร้างเองต่อเคส" },
        { type: "steps", description: "1. จ่าย 400.00 (Submit + Approve) อ่านยอดค้าง\n2. จ่าย 600.00 (Submit + Approve) อ่านยอดค้าง\n3. เปิดหน้ารายละเอียดใบจ่ายที่สอง กด Void ใส่เหตุผลยืนยัน\n4. อ่านยอดค้างและ JV ของใบจ่ายที่สอง" },
        {
          type: "expected",
          description:
            "ค้าง 600.00 หลังจ่าย 400.00, ค้าง 0.00 หลังจ่าย 600.00; หลัง void ใบจ่ายที่สอง: ใบจ่ายเป็น void, ค้างกลับเป็น 600.00 (Review Focus 4); JV กลับรายการผูก reversal_of กับ JV เดิม ทุกบัญชีสุทธิ 0 (Dr 2100 600.00 / Cr 1110 600.00 เดิม หักล้างด้วยด้านตรงข้าม); JV ของใบจ่ายแรกไม่เปลี่ยน. rule: partial payment ได้ ใบ stay posted (inv:188, pay:263)",
        },
        { type: "priority", description: "Critical" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const inv = await postedInvoice("part", 1000, { vat: false });
      expect((await getApDoc(inv)).open).toBe(1000);
      const a = await createPayment([{ id: inv, amount: 400 }]);
      await postPayment(a.id);
      expect((await getApDoc(inv)).open).toBe(600);
      const b = await createPayment([{ id: inv, amount: 600 }]);
      await postPayment(b.id);
      expect((await getApDoc(inv)).open).toBe(0);
      const jvA = await jvOfSource("ap_payment", a.id);
      expect(sum(jvA, AP, "dr")).toBe(400);
      expect(sum(jvA, BANK, "cr")).toBe(400);

      const pp = new ApPaymentPage(page);
      await pp.gotoDetail(b.id);
      await expect(pp.statusChip()).toHaveText(/posted/i);
      await expectSaved(page, /\/ap-payment\/[0-9a-f-]{36}\/void$/, () => pp.confirmWithReason("Void", "e2e void"), pp.toastWith(/payment voided/i));
      await expect(pp.statusChip()).toHaveText(/void/i);

      expect((await getPayment(b.id)).doc_status).toBe("void");
      expect((await getApDoc(inv)).open).toBe(600);
      const jvB = await jvOfSource("ap_payment", b.id);
      expectBalanced(jvB);
      const original = jvB.filter((l) => l.reversalOfJvId === null);
      const reversing = jvB.filter((l) => l.reversalOfJvId !== null);
      expect(original.length).toBeGreaterThan(0);
      expect(reversing.every((l) => l.reversalOfJvId === original[0].jvId)).toBe(true);
      for (const account of new Set(jvB.map((l) => l.account))) {
        expect(round(sum(jvB, account, "dr") - sum(jvB, account, "cr"), 4), `net of ${account} after void`).toBe(0);
      }
      expect(sum(reversing, AP, "cr")).toBe(600);
      expect(sum(reversing, BANK, "dr")).toBe(600);
      expect(await jvOfSource("ap_payment", a.id)).toEqual(jvA);
    },
  );

  test(
    "TC-APPAY-020002 จ่ายบางส่วนพร้อม WHT (ใบ 1,070.00 จ่าย 535.00 ฐาน 500.00 WHT 15.00 เงินสด 520.00): ค้างลด 535.00 = เงินสด + WHT",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; ใบ 1 x 1,000.00 + VAT 7% (รวม 1,070.00) ลงบัญชีแล้ว" },
        { type: "steps", description: "1. สร้างใบจ่าย applied 535.00 ฐาน WHT 500.00 (ครึ่งหนึ่งของ net) WHT 15.00 เงินสด 520.00\n2. Submit และ Approve\n3. อ่านยอดค้างของใบและ JV" },
        {
          type: "expected",
          description:
            "ค้าง 535.00 (1,070.00 - 520.00 - 15.00); JV: Dr 2100 = 535.00, Cr 1110 = 520.00, Cr 2150 = 15.00 สมดุล. inference: ยอดค้างลด = เงินสด + WHT (rules:17 + inv:99 + pay:127-130); assumption: ใบจ่ายบางส่วนใช้ฐาน WHT ตามสัดส่วนที่จ่าย (500.00 = 535 / 1,070 x 1,000) เพราะ docs ไม่กำหนดการแบ่งสัดส่วน (preflight 4.3)",
        },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async () => {
      const wht = whtOf(500, WHT_RATE, 2);
      expect(wht).toBe(15);
      const inv = await postedInvoice("partwht", 1000);
      const pay = await createPayment([{ id: inv, amount: 535 }], { whtBase: 500, whtAmount: wht, paymentAmount: round(535 - wht, 2) });
      await postPayment(pay.id);
      expect((await getApDoc(inv)).open).toBe(535);
      const jv = await jvOfSource("ap_payment", pay.id);
      expectBalanced(jv);
      expect(sum(jv, AP, "dr")).toBe(535);
      expect(sum(jv, BANK, "cr")).toBe(520);
      expect(sum(jv, WHT_PAYABLE, "cr")).toBe(15);
    },
  );

  test(
    "TC-APPAY-020003 Void ใบจ่ายเต็มที่มี WHT: ยอดค้างกลับเป็น 1,070.00 และ JV กลับรายการ (รวมบัญชี WHT 2150) หักล้างพอดี",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; ใบ 1 x 1,000.00 + VAT จ่ายเต็มพร้อม WHT 30.00 ลงบัญชีแล้ว (ค้าง 0)" },
        { type: "steps", description: "1. Void ใบจ่ายผ่าน API พร้อมเหตุผล\n2. อ่านใบจ่าย ยอดค้างของใบ และ JV ทั้งหมดของใบจ่าย" },
        {
          type: "expected",
          description:
            "void สำเร็จ; ใบจ่ายเป็น void; ยอดค้างของใบ = 1,070.00; JV กลับรายการมีครบ 3 บัญชี (Cr 2100 1,070.00, Dr 1110 1,040.00, Dr 2150 30.00) และทุกบัญชีสุทธิ 0 เมื่อรวม JV เดิม. rule: void กลับรายการด้วย JV ที่สลับ Dr/Cr (jv:221-222)",
        },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async () => {
      const inv = await postedInvoice("voidwht", 1000);
      const pay = await createPayment([{ id: inv, amount: 1070 }], { whtBase: 1000, whtAmount: 30, paymentAmount: 1040 });
      await postPayment(pay.id);
      expect((await getApDoc(inv)).open).toBe(0);
      const v = await voidPayment(pay.id);
      expect(v.status).toBe(200);
      expect((await getPayment(pay.id)).doc_status).toBe("void");
      expect((await getApDoc(inv)).open).toBe(1070);
      const jv = await jvOfSource("ap_payment", pay.id);
      expectBalanced(jv);
      const reversing = jv.filter((l) => l.reversalOfJvId !== null);
      expect(sum(reversing, AP, "cr")).toBe(1070);
      expect(sum(reversing, BANK, "dr")).toBe(1040);
      expect(sum(reversing, WHT_PAYABLE, "dr")).toBe(30);
      for (const account of new Set(jv.map((l) => l.account))) {
        expect(round(sum(jv, account, "dr") - sum(jv, account, "cr"), 4), `net of ${account} after void`).toBe(0);
      }
    },
  );

  // ── 03 refusals ────────────────────────────────────────────────────────
  test(
    "TC-APPAY-030001 จ่ายเกินยอดค้าง 0.01 (1,000.01 จากใบ 1,000.00): ถูกปฏิเสธ 422 AP_PAYMENT_OVER_ALLOCATED ไม่เกิดใบจ่าย",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; ใบ 1 x 1,000.00 ไม่มี VAT ลงบัญชีแล้ว ค้าง 1,000.00" },
        { type: "steps", description: "1. POST ใบจ่าย applied 1,000.01 เงินสด 1,000.01 (สมดุล แต่เกินยอดค้างของบรรทัด)\n2. อ่านจำนวนใบจ่ายและยอดค้าง" },
        {
          type: "expected",
          description:
            "422 รหัส AP_PAYMENT_OVER_ALLOCATED 'Applied amount exceeds unpaid amount'; ไม่มีใบจ่ายใหม่; ยอดค้างยัง 1,000.00. rule: จ่ายบางส่วนได้ แต่เกินยอดค้างไม่ได้ (pay:263, ap-payment-save-rules.md)",
        },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async () => {
      const inv = await postedInvoice("over", 1000, { vat: false });
      const before = (await listAllRows(CREATOR, "/ap-payment")).length;
      const r = await rawPayment(inv, { applied: 1000.01, cash: 1000.01 });
      expect(r.status).toBe(422);
      expect(r.body?.error?.code).toBe("AP_PAYMENT_OVER_ALLOCATED");
      expect((await listAllRows(CREATOR, "/ap-payment")).length).toBe(before);
      expect((await getApDoc(inv)).open).toBe(1000);
    },
  );

  test(
    "TC-APPAY-030002 จ่ายใบที่ชำระครบแล้ว (E2E-AP-PAID ค้าง 0): ถูกปฏิเสธ 422 และ read-set ไม่เปลี่ยน",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; E2E-AP-PAID ใน read-set ค้าง 0.00" },
        { type: "steps", description: "1. POST ใบจ่าย applied 1.00 กับบรรทัดของ E2E-AP-PAID\n2. อ่านยอดค้างของ E2E-AP-PAID" },
        {
          type: "expected",
          description: "422 รหัส AP_PAYMENT_OVER_ALLOCATED (ค้าง 0 จึงจ่ายเพิ่มไม่ได้); E2E-AP-PAID ยังค้าง 0.00 และสถานะเดิม. rule: ห้ามเกินยอดค้างแม้จ่ายหลายครั้ง (pay:263)",
        },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async () => {
      const paid = await seededApDoc("E2E-AP-PAID");
      expect(paid.open).toBe(0);
      const r = await rawPayment(paid.id, { applied: 1, cash: 1 });
      if (r.status < 300) await buSend(CREATOR, "DELETE", `/ap-payment/${r.body?.data?.id}`); // leave no stray draft behind a failing assertion
      expect(r.status).toBe(422);
      expect(r.body?.error?.code).toBe("AP_PAYMENT_OVER_ALLOCATED");
      const after = await seededApDoc("E2E-AP-PAID");
      expect(after.open).toBe(0);
      expect(after.status).toBe(paid.status);
    },
  );

  // ── 04 read set ────────────────────────────────────────────────────────
  test(
    "TC-APPAY-040001 read-set E2E-AP-PARTIAL (รวม 1,070.00 จ่ายแล้ว 400.00 ไม่มี WHT): หน้ารายละเอียดแสดงค้าง 670.00",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; E2E-AP-PARTIAL ลงบัญชีแล้ว รวม 1,070.00 มีใบจ่าย 400.00 ที่ไม่มี WHT (ควบคุมโดย controller ruling R5)" },
        { type: "steps", description: "1. เปิดหน้ารายละเอียด E2E-AP-PARTIAL\n2. อ่านยอด Total และ Unpaid Amount\n3. อ่านยอดค้างผ่าน API" },
        {
          type: "expected",
          description:
            "Total 1,070.00, Unpaid Amount 670.00 ทั้งบน UI และ API. inference: ยอดค้างลด = เงินสด + WHT; ใบจ่าย 400.00 ไม่มี WHT ค้างจึง 1,070.00 - 400.00 = 670.00 (ถ้าใบจ่ายมี WHT W ค้างต้องเป็น 1,070.00 - 400.00 - W; preflight 4.1)",
        },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const doc = await seededApDoc("E2E-AP-PARTIAL");
      expect(doc.total).toBe(1070);
      expect(doc.open).toBe(round(1070 - 400, 2));
      const ap = new ApInvoicePage(page);
      await ap.gotoDetail(doc.id);
      expect(await ap.totalOf("total")).toBe(1070);
      expect(await ap.totalOf("open")).toBe(670);
    },
  );

  // ── 05 UI WHT path ─────────────────────────────────────────────────────
  test(
    "TC-APPAY-050001 หน้าใบจ่าย Recalculate WHT จากใบ 1,000.00 + VAT: FE แสดงฐาน 1,000.00 WHT 30.00 ตรงสูตร และบันทึกลง BE ตรงกัน",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; ใบ 1 x 1,000.00 + VAT (รวม 1,070.00) ที่บรรทัดระบุ WHT 3% ลงบัญชีแล้ว; ใบจ่าย Draft จ่ายเต็ม 1,070.00 ไม่มีแถว WHT" },
        { type: "steps", description: "1. เปิดหน้ารายละเอียดใบจ่าย Draft กด Edit\n2. กด Recalculate from invoices\n3. อ่านฐานและยอด WHT ในตาราง\n4. ใส่ Payment amount 1,040.00 กด Save Draft\n5. อ่านใบจ่ายผ่าน API" },
        {
          type: "expected",
          description:
            "ตาราง WHT แสดงฐาน 1,000.00 และยอด 30.00 (= whtOf(1000, 3%), ค่าที่ FE คำนวณผ่าน wht-preview ต้องเท่าสูตรอิสระ); Save Draft สำเร็จ toast Payment saved; API: total_wht 30.00, net_paid 1,040.00, total_applied 1,070.00. assumption: WHT 3% คิดจากฐานก่อน VAT (pay:110) และเงินสด = ยอดที่จ่าย - WHT (rules:17)",
        },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const base = 1000;
      const wht = whtOf(base, WHT_RATE, 2);
      const inv = await postedInvoice("uiwht", base, { wht: true });
      const pay = await createPayment([{ id: inv, amount: 1070 }]);
      expect(Number((await getPayment(pay.id)).total_wht_amount)).toBe(0);
      const pp = new ApPaymentPage(page);
      await pp.gotoDetail(pay.id);
      await pp.button("Edit").click();
      await pp.recalculateButton().click();
      await expect(pp.whtAmountInput()).toBeVisible({ timeout: 20_000 });
      await expect.poll(async () => Number(await pp.whtAmountInput().inputValue())).toBe(wht);
      expect(Number(await pp.whtBaseInput().inputValue())).toBe(base);

      await page.getByLabel("Payment amount").fill(String(round(1070 - wht, 2)));
      await expectSaved(page, /\/ap-payment\/[0-9a-f-]{36}$/, () => pp.button("Save Draft").click(), pp.toastWith(/payment saved/i));
      const stored = await getPayment(pay.id);
      expect(Number(stored.total_wht_amount)).toBe(wht);
      expect(Number(stored.net_paid_amount)).toBe(1040);
      expect(Number(stored.total_applied_amount)).toBe(1070);
    },
  );
});
