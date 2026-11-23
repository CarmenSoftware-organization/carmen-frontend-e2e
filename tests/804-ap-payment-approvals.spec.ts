import { expect } from "@playwright/test";
import { createAuthTest } from "./fixtures/auth.fixture";
import { ApPaymentPage } from "./pages/ap-payment.page";
import { buSend } from "./helpers/bu-api";
import { approvePayment, createApDoc, createPayment, getApDoc, submitApDoc, submitPayment } from "./helpers/ap-api";
import { assertAccountingReady, CREATOR, jvOfSource, listAllRows, type JvLine } from "./helpers/gl-api";
import { expectBalanced, round } from "./helpers/money";
import { expectSaved } from "./helpers/settle";
import { uid } from "./helpers/test-data";

// ─────────────────────────────────────────────────────────────────────────
// AP payment approvals on the TEST BU (GR2VYNKQ): the Payment Approvals queue, approve, reject, who may act.
//
// Workflow `ap_payment` (scripts/data-reset/fixtures/workflows.json): Create Request (Admin, Budget) -> Accounting
// Approval (Budget) -> Completed. Admin creates and submits, Budget approves and the approval posts. Requestor is the
// view-only accounting role. Every case creates its own tagged invoice (1 x 1,000.00, no VAT) and its own payment,
// so the spec re-runs without a reset.
//
// No threshold case: the seeded `ap_payment` workflow has `routing_rules: []`, so no stage is picked by
// `base_net_paid_amount` and there is nothing to assert. (The workflow mapper does read that field; a seeded rule
// would add a case.)
//
// Separation of duties (pay:194, pay:225, pay:253): "403 - no permission, maker-checker violation, or wrong workflow
// assignment". The seeded workflow names Budget as BOTH a create-stage user and the approver, so Budget can submit and
// then approve its own payment. The oracle requires the backend to refuse that, so it is pinned (TC-APAPR-030001) rather
// than treated as an acceptable review note. The gateway controller documents that approve / reject carry no `@Permission`
// (KeycloakGuard only), which explains a view-only role being allowed; it does not cover stage assignment (030002).
// ─────────────────────────────────────────────────────────────────────────
const test = createAuthTest("carmensoftware.dev+admin@gmail.com");
const budgetTest = createAuthTest("carmensoftware.dev+budget@gmail.com");
const requestorTest = createAuthTest("carmensoftware.dev+requestor@gmail.com");
test.describe.configure({ timeout: 120_000 });
budgetTest.describe.configure({ timeout: 120_000 });
requestorTest.describe.configure({ timeout: 120_000 });

const tag = (key: string) => `E2E-T-804-${key}-${uid}`;
const AP = "2100";
const BANK = "1110";
const BUG_LIST = "docs/superpowers/specs/2026-11-23-e2e-phase-2a-bug-list.md";

function sum(lines: JvLine[], account: string, side: "dr" | "cr"): number {
  return round(lines.filter((l) => l.account === account).reduce((s, l) => s + l[side], 0), 4);
}

/** A fresh posted invoice (1,000.00, no VAT) and a full payment of it, submitted by Admin and now `in_review`. */
async function submittedPayment(key: string, submitter: "Admin" | "Budget" = "Admin") {
  const inv = await createApDoc("invoice", { tag: tag(key), lines: [{ qty: 1, price: 1000, vat: false }] });
  expect((await submitApDoc(inv.id)).status).toBe(200);
  const pay = await createPayment([{ id: inv.id, amount: 1000 }]);
  expect((await submitPayment(pay.id, submitter)).status).toBe(200);
  const doc = (await buSend(CREATOR, "GET", `/ap-payment/${pay.id}`)).body.data;
  expect(doc.doc_status).toBe("in_review");
  return { invoiceId: inv.id, id: pay.id, no: String(doc.doc_no) };
}

async function paymentStatus(id: string): Promise<string> {
  return String((await buSend(CREATOR, "GET", `/ap-payment/${id}`)).body.data.doc_status);
}

/** Two paint frames: the list has rendered the response it just received (no visible signal for "row absent"). */
const settled = (page: import("@playwright/test").Page) =>
  page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))));

test.describe("AP payment approvals (804)", () => {
  test.beforeAll(async () => {
    await assertAccountingReady();
  });

  // ── 01 the queue ───────────────────────────────────────────────────────
  budgetTest(
    "TC-APAPR-010001 Budget เปิดคิว Payment Approvals: ใบจ่ายที่ Submit แล้วอยู่ในคิว เลือกแล้ว Approve selected -> posted พร้อม JV ใบเหลือ 0",
    {
      annotation: [
        { type: "preconditions", description: "Budget login (ผู้อนุมัติของ workflow ap_payment); ใบจ่ายเต็ม 1,000.00 ที่ Admin Submit แล้ว (in_review) ของเทสต์เอง" },
        { type: "steps", description: "1. เปิด /accounting/accounts-payable/payment-approvals ค้นหาเลขที่ PV\n2. ติ๊กเลือกแถว กด Approve selected และยืนยัน\n3. เปิดแท็บ Approved and posted\n4. อ่านใบจ่าย JV และยอดค้างของใบ" },
        {
          type: "expected",
          description:
            "แถวของใบจ่ายแสดงในแท็บ In Review และเลือกได้; หลังยืนยัน toast 'Approved 1 payment vouchers.'; ใบจ่ายเป็น posted และไปอยู่แท็บ Approved and posted; JV สมดุล Dr 2100 = 1,000.00, Cr 1110 = 1,000.00 (ไม่มี WHT); ยอดค้างของใบ 0.00. rule: การอนุมัติขั้นสุดท้าย post (pay:188, rules:26)",
        },
        { type: "priority", description: "Critical" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const p = await submittedPayment("queue");
      const pp = new ApPaymentPage(page);
      await pp.gotoApprovals();
      await pp.search(p.no);
      await expect(pp.row(p.no)).toBeVisible({ timeout: 20_000 });
      await pp.rowCheckbox(p.no).click();
      await expect(pp.approveSelectedButton()).toBeEnabled();
      await pp.approveSelectedButton().click();
      await expectSaved(page, /\/ap-payment\/[0-9a-f-]{36}\/approve$/, () => pp.confirmBatchApprove().click(), pp.toastWith(/approved 1 payment vouchers/i));

      expect(await paymentStatus(p.id)).toBe("posted");
      const jv = await jvOfSource("ap_payment", p.id);
      expectBalanced(jv);
      expect(jv.every((l) => l.jvStatus === "posted")).toBe(true);
      expect(sum(jv, AP, "dr")).toBe(1000);
      expect(sum(jv, BANK, "cr")).toBe(1000);
      expect(new Set(jv.map((l) => l.account))).toEqual(new Set([AP, BANK]));
      expect((await getApDoc(p.invoiceId)).open).toBe(0);

      await pp.gotoApprovals("posted");
      await pp.search(p.no);
      await expect(pp.row(p.no)).toBeVisible({ timeout: 20_000 });
    },
  );

  requestorTest(
    "TC-APAPR-010002 Requestor (accounting viewer) เปิดคิว Payment Approvals: ใบที่ Submit รอ Budget ต้องไม่อยู่ในคิวของ Requestor",
    {
      annotation: [
        { type: "preconditions", description: "Requestor login (view-only accounting, ไม่ได้อยู่ในขั้นอนุมัติของ workflow ap_payment); ใบจ่ายที่ Admin Submit แล้วรอ Budget (in_review)" },
        { type: "steps", description: "1. เปิด /accounting/accounts-payable/payment-approvals\n2. ค้นหาเลขที่ PV ของใบที่รอ Budget\n3. ดูว่ามีแถวหรือไม่" },
        {
          type: "expected",
          description: "ไม่มีแถวของใบนี้ในคิวของ Requestor (คิวอนุมัติคือใบที่ผู้ใช้ต้องดำเนินการเอง; pay:225 'submitted assigned items'). pinned (needs product decision): backend ส่งใบ in_review ทุกใบให้ทุกผู้ใช้ จึงมีแถวขึ้น; คำถามที่เปิดอยู่คือคิวเป็น worklist ร่วมหรือเฉพาะผู้อนุมัติที่ถูกมอบหมาย (ดู bug list ส่วน 2)",
        },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Authorization" },
      ],
    },
    async ({ page }) => {
      const p = await submittedPayment("reqqueue");
      const pp = new ApPaymentPage(page);
      await pp.gotoApprovals();
      const listed = page.waitForResponse((r) => r.request().method() === "GET" && /\/ap-payment\?/.test(r.url()) && r.url().includes(encodeURIComponent(p.no)));
      await pp.search(p.no);
      expect((await listed).status()).toBe(200);
      await settled(page);
      requestorTest.fail(
        true,
        `needs product decision: should the Payment Approvals queue be a shared worklist (every user sees every in_review voucher, as today) or scoped to the assigned approver? Today it lists every in_review voucher to a view-only Requestor who is not assigned (the list filter is doc_status in_review only; only the batch-approve checkbox is gated by user_action.execute). Pinned to the assignee-scoped reading (pay:225) until the owner rules. See ${BUG_LIST} section 2`,
      );
      await expect(pp.row(p.no)).toHaveCount(0);
    },
  );

  requestorTest(
    "TC-APAPR-010003 Requestor เปิดรายละเอียดใบ in_review: ไม่เห็นปุ่ม Approve และ Reject (FE ซ่อนตามรายชื่อ user_action.execute)",
    {
      annotation: [
        { type: "preconditions", description: "Requestor login; ใบจ่าย in_review ที่ผู้อนุมัติคือ Budget" },
        { type: "steps", description: "1. เปิดหน้ารายละเอียดใบจ่าย\n2. ดูปุ่มในแถบหัว" },
        { type: "expected", description: "สถานะ In Review; ไม่มีปุ่ม Approve และ Reject. rule: ปุ่มอนุมัติเสนอเฉพาะผู้ที่อยู่ในรายชื่อผู้ดำเนินการของขั้น (ap-status.ts apActions, pay:194)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Authorization" },
      ],
    },
    async ({ page }) => {
      const p = await submittedPayment("reqdetail");
      const pp = new ApPaymentPage(page);
      await pp.gotoDetail(p.id);
      await expect(pp.statusChip()).toHaveText(/in review/i);
      await expect(pp.button("Approve")).toHaveCount(0);
      await expect(pp.button("Reject")).toHaveCount(0);
    },
  );

  // ── 02 approve / reject on the detail page ─────────────────────────────
  budgetTest(
    "TC-APAPR-020001 Budget อนุมัติจากหน้ารายละเอียดใบ in_review: posted พร้อม JV Dr เจ้าหนี้ / Cr ธนาคาร",
    {
      annotation: [
        { type: "preconditions", description: "Budget login; ใบจ่ายเต็ม 1,000.00 ที่ Admin Submit แล้ว (in_review)" },
        { type: "steps", description: "1. เปิดหน้ารายละเอียดใบจ่าย\n2. กด Approve\n3. อ่านสถานะ JV และยอดค้างของใบ" },
        {
          type: "expected",
          description: "เห็นปุ่ม Approve และ Reject; หลัง Approve toast 'Payment approved' สถานะ Posted; JV posted สมดุล Dr 2100 = 1,000.00, Cr 1110 = 1,000.00; ยอดค้างของใบ 0.00. rule: อนุมัติขั้นสุดท้าย post (pay:188)",
        },
        { type: "priority", description: "Critical" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const p = await submittedPayment("approve");
      const pp = new ApPaymentPage(page);
      await pp.gotoDetail(p.id);
      await expect(pp.statusChip()).toHaveText(/in review/i);
      await expect(pp.button("Reject")).toBeVisible();
      await expectSaved(page, /\/ap-payment\/[0-9a-f-]{36}\/approve$/, () => pp.button("Approve").click(), pp.toastWith(/payment approved/i));
      await expect(pp.statusChip()).toHaveText(/posted/i);
      const jv = await jvOfSource("ap_payment", p.id);
      expectBalanced(jv);
      expect(jv.length).toBe(2);
      expect(sum(jv, AP, "dr")).toBe(1000);
      expect(sum(jv, BANK, "cr")).toBe(1000);
      expect((await getApDoc(p.invoiceId)).open).toBe(0);
    },
  );

  budgetTest(
    "TC-APAPR-020002 Budget Reject ใบ in_review พร้อมเหตุผล: กลับเป็น Draft ไม่มี JV ใบเหลือ 1,000.00 และออกจากคิว",
    {
      annotation: [
        { type: "preconditions", description: "Budget login; ใบจ่ายเต็ม 1,000.00 ที่ Admin Submit แล้ว (in_review)" },
        { type: "steps", description: "1. เปิดหน้ารายละเอียดใบจ่าย\n2. กด Reject ใส่เหตุผลและยืนยัน\n3. อ่านสถานะ JV ยอดค้างของใบ และคิว in_review ผ่าน API" },
        {
          type: "expected",
          description: "toast 'Payment rejected'; สถานะ Draft; ไม่มี JV ที่มี source = ใบจ่าย; ยอดค้างของใบยัง 1,000.00; ใบจ่ายไม่อยู่ในรายการ in_review. assumption: Reject คืนใบเป็น Draft (BE ตอบ doc_status draft; docs ไม่ระบุสถานะปลายทางของ reject)",
        },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const p = await submittedPayment("reject");
      const pp = new ApPaymentPage(page);
      await pp.gotoDetail(p.id);
      await expectSaved(page, /\/ap-payment\/[0-9a-f-]{36}\/reject$/, () => pp.confirmWithReason("Reject", "e2e reject"), pp.toastWith(/payment rejected/i));
      await expect(pp.statusChip()).toHaveText(/draft/i);
      expect(await paymentStatus(p.id)).toBe("draft");
      expect(await jvOfSource("ap_payment", p.id)).toEqual([]);
      expect((await getApDoc(p.invoiceId)).open).toBe(1000);
      const queue = await listAllRows(CREATOR, `/ap-payment?filter=${encodeURIComponent("doc_status|string:in_review")}`);
      expect(queue.some((q) => String(q.id) === p.id)).toBe(false);
    },
  );

  // ── 03 who may act (pinned) ────────────────────────────────────────────
  test(
    "TC-APAPR-030001 Budget Submit ใบจ่ายเองแล้ว Approve เอง: ต้องถูกปฏิเสธ 403 (maker-checker)",
    {
      annotation: [
        { type: "preconditions", description: "ใบจ่ายเต็ม 1,000.00 ที่ Budget เป็นผู้ Submit (Budget อยู่ทั้งขั้นสร้างและขั้นอนุมัติของ workflow ที่ seed)" },
        { type: "steps", description: "1. Budget Submit ใบจ่ายผ่าน API\n2. Budget Approve ใบเดียวกัน\n3. อ่านสถานะใบจ่าย" },
        {
          type: "expected",
          description: "Approve ถูกปฏิเสธ 403 และใบยัง in_review ไม่มี JV. rule: ผู้สร้างหรือผู้ Submit อนุมัติใบของตัวเองไม่ได้ (pay:194, pay:225, pay:253 'maker-checker violation'). pinned: backend ตอบ 200 และ post",
        },
        { type: "priority", description: "High" },
        { type: "testType", description: "Authorization" },
      ],
    },
    async () => {
      const p = await submittedPayment("sod", "Budget");
      const r = await approvePayment(p.id, "Budget");
      // the call must have reached the BE with a real answer before the pin is armed, so an auth / 5xx failure cannot make it "pass"
      expect(r.status, "approve call did not get a real answer from the BE").not.toBe(401);
      expect(r.status).toBeLessThan(500);
      test.fail(
        true,
        `suspected bug: the same user (Budget) submits a payment voucher and approves it, and the backend posts it - the oracle requires a maker-checker 403 (pay:253). See ${BUG_LIST}`,
      );
      expect(r.status).toBe(403);
      expect(await paymentStatus(p.id)).toBe("in_review");
      expect(await jvOfSource("ap_payment", p.id)).toEqual([]);
    },
  );

  test(
    "TC-APAPR-030002 Requestor (ไม่ได้อยู่ในขั้นอนุมัติ) Approve ใบ in_review ผ่าน API: ต้องถูกปฏิเสธ 403",
    {
      annotation: [
        { type: "preconditions", description: "ใบจ่ายที่ Admin Submit แล้ว รอ Budget (in_review); Requestor ไม่อยู่ในรายชื่อผู้ดำเนินการของขั้น Accounting Approval" },
        { type: "steps", description: "1. Requestor เรียก Approve ผ่าน API\n2. อ่านสถานะใบจ่ายและ JV" },
        {
          type: "expected",
          description: "ถูกปฏิเสธ 403 ใบยัง in_review ไม่มี JV. rule: 403 เมื่อไม่มีสิทธิ์หรือผิด workflow assignment (pay:194, pay:253). pinned: backend ตอบ 200 และ post ใบ (gateway ไม่มี @Permission บน approve; BE ไม่ตรวจรายชื่อผู้ดำเนินการของขั้น)",
        },
        { type: "priority", description: "High" },
        { type: "testType", description: "Authorization" },
      ],
    },
    async () => {
      const p = await submittedPayment("nonassignee");
      const r = await approvePayment(p.id, "Requestor");
      expect(r.status, "approve call did not get a real answer from the BE").not.toBe(401);
      expect(r.status).toBeLessThan(500);
      test.fail(
        true,
        `suspected bug: a user who is not assigned to the Accounting Approval stage (view-only Requestor) can approve and post a payment voucher through the API (200) - the oracle requires 403 for a wrong workflow assignment (pay:194, pay:253). See ${BUG_LIST}`,
      );
      expect(r.status).toBe(403);
      expect(await paymentStatus(p.id)).toBe("in_review");
      expect(await jvOfSource("ap_payment", p.id)).toEqual([]);
    },
  );
});
