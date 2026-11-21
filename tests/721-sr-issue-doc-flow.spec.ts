import type { Page } from "@playwright/test";
import { test, gotoBu, expect, observed } from "./fixtures/movement.fixture";
import { apiGet, txOfDoc } from "./helpers/movement/api";
import { createGrn } from "./helpers/movement/docs";
import { DocState } from "./helpers/movement/state";
import { addRow, answerSrDateQuestion, chooseDateInDialog, button, field, pickLookup, pickSelectIn, toasts, typeInto } from "./helpers/movement/ui";
import { DOC_FLOW_ROLE, PROD, SR_TO, activePeriodDate, itemRow, srIssueWorkflowName, stamp } from "./helpers/movement/doc-flow";
import type { MovementUser } from "./movement-users";

/**
 * Store requisition all the way to Issue, with the real role accounts —
 * movement suite (opt-in: `bun run test:movement`).
 *   receiver stocks the source location → requestor creates + Submits → hod Approves → fc Issues
 * Workflow SR workflow (Create→HOD→Issue).
 *
 * Rule #718 (confirmed by the user 2026-10-02): the active period = the oldest
 * open/locked period. When today is outside it, the system must ASK which date to
 * use — on submit and on issue — and a requisition dated inside the active period
 * must be issuable (posting into that period).
 *
 * Two variants, picked with E2E_SRI_BU:
 *   (default) AVG  — section 70 · CARMEN-AVG, active period behind this month
 *   FIFO           — section 71 · CARMEN-FIFO, active period = this month
 * E2E_SRI_PHASE (AVG only): pre = 700001–700003 before a period covering today
 * exists · post = 700004–700005 after creating periods in advance · all (default).
 * The phases hand the SR over through runs/movement/sr-issue-<bu>.json.
 *
 * Setup once: `bun run movement:setup-workflows` (AVG) · `bun run movement:setup-fifo-roles` (FIFO).
 * Origin: `_movement_play/eop_bf/e2e/fe/07-sr-issue.spec.ts` (SRI.0–SRI.7, SRF.0–SRF.6).
 */
const SRI_BU = process.env.E2E_SRI_BU === "FIFO" ? "FIFO" : "AVG";
const PHASE = SRI_BU === "FIFO" ? "all" : (process.env.E2E_SRI_PHASE ?? "all");

interface Variant {
  bu: string;
  from: string;
  to: string;
  product: { code: string; name: string };
  grn: { user: MovementUser; status: "saved" | "committed" };
}

const AVG: Variant = {
  bu: "CARMEN-AVG",
  from: DOC_FLOW_ROLE.sr.loc,
  to: SR_TO,
  product: { code: PROD.A.code, name: PROD.A.name },
  // AVG posts stock when the GRN is saved
  grn: { user: DOC_FLOW_ROLE.sr.user, status: "saved" },
};
const FIFO: Variant = {
  bu: "CARMEN-FIFO",
  from: "TEST-MOVE",
  to: "TEST-CONSUME",
  product: { code: "T-01-F", name: "T-01-F" },
  // FIFO posts stock on commit
  grn: { user: "fc", status: "committed" },
};
const V = SRI_BU === "FIFO" ? FIFO : AVG;
const state = new DocState(`runs/movement/sr-issue-${V.bu}.json`);

test.describe.configure({ mode: "serial" });
// Before the stock arrives the cost estimator answers 422 "No available stock" — known, not under test.
test.beforeEach(({ signals }) => signals.minor(/\/cost\/products\/.+ → 422/, "location has no stock yet: cost estimator 422"));

async function srById(id: string) {
  const { status, body } = await apiGet(`/api/${V.bu}/store-requisitions/${id}`);
  const d = body?.data;
  if (status !== 200 || !d) return { status: "deleted", no: "", stage: "", date: "" };
  return { status: d.doc_status as string, no: d.sr_no as string, stage: d.workflow_current_stage as string, date: String(d.sr_date ?? "") };
}

/** The active period (oldest open/locked, API `period-ends/current`) and whether today is inside it — compared on UTC days, like the backend. */
async function activePeriod() {
  const { status, body } = await apiGet(`/api/${V.bu}/period-ends/current`);
  const a = body?.data;
  if (status !== 200 || !a?.period) throw new Error(`current period of ${V.bu}: HTTP ${status}`);
  const now = new Date();
  const day = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const [s0, e0] = [Date.parse(a.start_at), Date.parse(a.end_at)];
  return {
    period: a.period as string,
    end: new Date(e0).toISOString(),
    todayInside: day >= s0 && day <= e0,
    contains: (iso: string) => Date.parse(iso) >= s0 && Date.parse(iso) <= e0,
  };
}

/** On hand of the variant's product at the source location (API `products/:id/on-hand`). */
async function onHand(): Promise<number> {
  const found = await apiGet(`/api/config/${V.bu}/products?perpage=5&search=${encodeURIComponent(V.product.code)}`);
  const id = (found.body?.data ?? []).find((x: any) => x.code === V.product.code)?.id;
  if (!id) throw new Error(`${V.bu}: product ${V.product.code} not found`);
  const { status, body } = await apiGet(`/api/${V.bu}/products/${id}/on-hand`);
  if (status !== 200) throw new Error(`on-hand ${V.product.code}: HTTP ${status}`);
  const loc = (body?.data?.locations ?? []).find((l: any) => l.location_code === V.from);
  return Number(loc?.on_hand_qty ?? 0);
}

/** Confirm an action's dialog — the last button whose name matches; returns the dialog text. */
let dialogAsked = false; // the last confirm dialog asked which date to use
async function confirmAction(page: Page, name: RegExp) {
  const dlg = page.locator("[role=alertdialog]:visible, [role=dialog]:visible").last();
  await expect(dlg).toBeVisible();
  const text = (await dlg.innerText()).replace(/\s+/g, " ").trim();
  dialogAsked = await chooseDateInDialog(dlg); // Submit asks for the date in the dialog when today is outside the open period (FE 7bca06a0)
  await dlg.getByRole("button", { name }).last().click();
  return text;
}

/**
 * Approver and issuer must decide every line before the document-level button
 * (footer) appears: Edit → tick Select all → "Select all" in the dialog → the
 * line Approve in the bar that appears; then the footer's Approve / Issue.
 */
async function approveAllLines(page: Page) {
  await button(page, "Edit").click();
  await page.getByRole("checkbox", { name: "Select all" }).click();
  await page.locator("[role=dialog]:visible").getByRole("button", { name: /^Select all/ }).click();
  await button(page, "Approve").first().click();
  await page.waitForTimeout(1000);
  return (await page.locator("table tbody tr").allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim());
}

async function expectSourceStocked(page: Page) {
  const g = await createGrn(page, {
    bu: V.bu,
    location: V.from,
    date: await activePeriodDate(V.bu),
    invoiceNo: `FE-GRN-SRI-${stamp}`,
    status: V.grn.status,
    lines: [{ product: V.product.code, qty: 5, price: 10 }],
  });
  const q = await onHand();
  expect(q).toBeGreaterThanOrEqual(1);
  await observed(`${g!.no} · ${g!.status} · on hand ${V.product.name} at ${V.from} = ${q}`);
}

async function expectSubmitted(page: Page, key: string) {
  await gotoBu(page, "/store-operation/store-requisition/new", V.bu);
  await pickSelectIn(page, "Workflow", await srIssueWorkflowName(V.bu));
  await pickLookup(page, field(page, "Request From").locator("button").first(), V.from);
  await pickLookup(page, field(page, "Deliver To (Destination)").locator("button").first(), V.to);
  await page.locator("#sr-description").fill(`FE-CRUD SR issue ${stamp}`);
  const row = await addRow(page, "Select Product");
  await pickLookup(page, row.getByRole("button", { name: "Select Product" }), V.product.code);
  await typeInto(itemRow(page, V.product.code).locator('input[name$=".requested_qty"]'), 1);
  const saved = page.waitForResponse((r) => /\/store-requisitions/.test(r.url()) && r.request().method() === "POST", { timeout: 60_000 });
  await button(page, "Save").first().click();
  const id: string = (await (await saved).json()).data.id;
  state.put(key, { id, no: "", status: "draft" });
  await expect(page).toHaveURL(new RegExp(id));
  const submitted = page.waitForResponse((r) => /\/store-requisitions\/.+\/submit/.test(r.url()), { timeout: 60_000 });
  await button(page, "Submit").first().click();
  const dialog = await confirmAction(page, /submit|confirm|ยืนยัน/i);
  const q = await answerSrDateQuestion(page, await submitted, /\/store-requisitions\/.+\/submit/);
  expect(q.res.status(), JSON.stringify(q.body).slice(0, 300)).toBeLessThan(300);
  await expect.poll(async () => (await srById(id)).status, { timeout: 30_000 }).toBe("in_progress");
  const sr = await srById(id);
  state.put(key, { id, no: sr.no, status: sr.status });
  expect(sr.stage).toBe("HOD");
  const text = `${sr.no} · ${sr.status} · stage ${sr.stage} · date question: ${dialogAsked ? "asked in the Submit dialog → \"last day of the open period\"" : q.asked ? `asked (${q.code}) → "inside the open period"` : "not asked"} · sr_date ${sr.date} · confirm dialog: "${dialog.slice(0, 120)}"`;
  return { asked: dialogAsked || q.asked, srDate: sr.date, text };
}

/** Submit rule: today inside the active period → no question, dated today · else must ask, and "inside" = the active period's last day. */
async function expectSubmitDateRule(r: { asked: boolean; srDate: string; text: string }) {
  const a = await activePeriod();
  if (a.todayInside) {
    expect(r.asked, `today is inside active period ${a.period}, no question expected — ${r.text}`).toBe(false);
  } else {
    expect(r.asked, `today is outside active period ${a.period}, the system must ask which date — ${r.text}`).toBe(true);
    expect(new Date(r.srDate).toISOString(), `"inside the open period" must date it on the last day of ${a.period} — ${r.text}`).toBe(a.end);
  }
}

async function expectApprovedToIssue(page: Page, id: string) {
  await gotoBu(page, `/store-operation/store-requisition/${id}`, V.bu);
  await approveAllLines(page);
  const approved = page.waitForResponse((r) => new RegExp(`/store-requisitions/${id}/approve`).test(r.url()), { timeout: 60_000 });
  await button(page, "Approve").last().click();
  const dialog = await confirmAction(page, /approve|confirm|ยืนยัน/i);
  const a = await approved;
  expect(a.status(), (await a.text()).slice(0, 300)).toBeLessThan(300);
  await expect.poll(async () => (await srById(id)).stage, { timeout: 30_000 }).toBe("Issue");
  const sr = await srById(id);
  await observed(`${sr.no} · ${sr.status} · stage ${sr.stage} · dialog: "${dialog.slice(0, 200)}" · toast: ${(await toasts(page)).join(" / ") || "-"}`);
}

/** fillQty = the issuer types Issued = requested qty · false = leave the field's default. */
async function issueAsFc(page: Page, id: string, fillQty: boolean) {
  const before = await onHand();
  await gotoBu(page, `/store-operation/store-requisition/${id}`, V.bu);
  const lines = await approveAllLines(page);
  const issuedInput = itemRow(page, V.product.code).locator('input[name$=".issued_qty"]');
  const defaultIssued = await issuedInput.inputValue().catch(() => "(no field)");
  if (fillQty) await typeInto(issuedInput, 1);
  await expect(button(page, "Issue"), `no Issue button after approving the lines · rows: ${lines.join(" | ")}`).toBeVisible();
  const issueUrl = new RegExp(`/store-requisitions/${id}/`);
  const issued = page.waitForResponse((r) => issueUrl.test(r.url()) && r.request().method() !== "GET", { timeout: 60_000 });
  await button(page, "Issue").last().click();
  const dialog = await confirmAction(page, /issue|confirm|ยืนยัน/i);
  const q = await answerSrDateQuestion(page, await issued, issueUrl);
  await page.waitForTimeout(2000);
  const toast = (await toasts(page)).join(" / ");
  const sr = await srById(id);
  const after = await onHand();
  const full = (await apiGet(`/api/${V.bu}/store-requisitions/${id}`)).body?.data;
  const issuedQty = (full?.store_requisition_detail ?? []).reduce((n: number, x: any) => n + Number(x.issued_qty ?? 0), 0);
  const tx = sr.no ? await txOfDoc(V.bu, id, sr.no) : [];
  // The API does not expose the cost layer's at_period, so "posted into the active period" = it posted and the SR is dated inside that period.
  const period = await activePeriod();
  const atPeriods = tx.length && sr.date && period.contains(sr.date) ? [period.period] : [];
  const d = { issued: String(issuedQty), tx: tx.length ? "yes" : null };
  const facts = `date question: ${q.asked ? `asked (${q.code})` : "not asked"} · HTTP ${q.res.status()} code=${q.body?.error?.code ?? "-"} · posted to ${atPeriods.join(",") || "-"} · Issued default "${defaultIssued}"${fillQty ? " → typed 1" : " (left)"} · SR ${sr.status} stage ${sr.stage} · issued_qty ${Number(d?.issued ?? 0)} · inventory transaction ${d?.tx ? "yes" : "no"} · on hand ${V.from} ${before} → ${after} · dialog: "${dialog.slice(0, 120)}" · toast: "${toast || "-"}"`;
  await observed(facts);
  return { status: q.res.status(), sr, before, after, facts, asked: q.asked, atPeriods };
}

// Methods are named expect* — they assert inside, and scripts/lib/spec-health.ts counts `obj.expectX()`
// calls as assertion helpers (same convention as the page objects).
const flow = { expectSourceStocked, expectSubmitted, expectSubmitDateRule, expectApprovedToIssue };

// ── CARMEN-AVG (section 70) ─────────────────────────────────────────────────────

test.describe("CARMEN-AVG", () => {
  test.skip(SRI_BU !== "AVG", "E2E_SRI_BU=FIFO runs the FIFO variant");

  test.describe("receiver", () => {
    test.skip(PHASE === "post", "post phase — the requisition was created in the pre phase");
    test.use({ user: AVG.grn.user, bu: AVG.bu });
    test(
      "TC-SI-700001 Requestor รับสินค้าเข้าคลังต้นทางด้วย GRN ให้มีของพอเบิก",
      {
        annotation: [
          { type: "preconditions", description: "Login เป็น requestor@carmen.com (movement-setup); BU CARMEN-AVG; E2E_DB_URL ตั้งไว้ (อ่านยอดคงเหลือจาก cost layer)" },
          { type: "steps", description: "1. สร้าง GRN manual วันที่ในงวด active: กร๊อบกรอบ รสสาหร่าย (11020001) × 5 @10 ที่ LCX013\n2. กด Create (AVG ลงสต๊อกตอน saved)\n3. อ่านยอดคงเหลือของสินค้านั้นที่ LCX013" },
          { type: "expected", description: "GRN สถานะ saved และยอดคงเหลือ 11020001 ที่ LCX013 ≥ 1 — ตัดเหตุ \"ของไม่พอ\" ออกจากการทดสอบ issue" },
          { type: "priority", description: "Medium" },
          { type: "testType", description: "Functional" },
          { type: "note", description: "เดิม SRI.0 (_movement_play fe/07-sr-issue) · เป็นขั้นเตรียมข้อมูลของสายนี้" },
        ],
      },
      async ({ page }) => {
        await flow.expectSourceStocked(page);
      },
    );
  });

  test.describe("requestor", () => {
    test.skip(PHASE === "post", "post phase — the requisition was created in the pre phase");
    test.use({ user: DOC_FLOW_ROLE.sr.user, bu: AVG.bu });
    test(
      "TC-SI-700002 Requestor Submit ใบเบิกแล้วระบบถามวันที่ตามกติกางวด active",
      {
        annotation: [
          { type: "preconditions", description: "TC-SI-700001 ผ่านแล้ว; Login เป็น requestor@carmen.com; workflow SR workflow ขั้น Create→HOD→Issue (หาจาก stage ไม่ใช้ชื่อ — ชื่อถูกเปลี่ยนบน dev) มีสินค้าแล้ว; E2E_DB_URL ตั้งไว้ (อ่านงวด active)" },
          { type: "steps", description: "1. สร้าง SR: LCX013 → 1FO02, 11020001 × 1, กด Save\n2. กด Submit แล้วยืนยัน\n3. ถ้าระบบถาม \"Which date should this carry?\" เลือก \"inside the open period\"" },
          { type: "expected", description: "SR in_progress ขั้น HOD; ถ้าวันนี้อยู่ในงวด active ต้องไม่ถามและลงวันนี้ — ถ้าอยู่นอกงวด active ต้องถาม และ sr_date = วันสุดท้ายของงวด active" },
          { type: "priority", description: "High" },
          { type: "testType", description: "Functional" },
          { type: "note", description: "เดิม SRI.1 · กติกา #718 · 422 SR_DATE_PATTERN_REQUIRED รอบแรกเป็นพฤติกรรมที่ตั้งใจ · TC-SR-050001 (701-sr) ตายเพราะหาปุ่ม \"submit for approval\"" },
        ],
      },
      async ({ page, signals }) => {
        signals.expectApiError(/\/store-requisitions\/.+\/submit → 422/);
        const r = await flow.expectSubmitted(page, "sr");
        await flow.expectSubmitDateRule(r);
        await observed(r.text);
      },
    );
  });

  test.describe("hod", () => {
    test.skip(PHASE === "post", "post phase — approved in the pre phase");
    test.use({ user: "hod", bu: AVG.bu });
    test(
      "TC-SI-700003 HOD อนุมัติรายบรรทัดแล้วอนุมัติทั้งใบ ใบเบิกไปขั้น Issue",
      {
        annotation: [
          { type: "preconditions", description: "TC-SI-700002 ผ่านแล้ว — SR อยู่ขั้น HOD; Login เป็น hod@carmen.com (หัวหน้าแผนกของ workflow)" },
          { type: "steps", description: "1. เปิดใบ แล้วกด Edit\n2. ติ๊ก Select all → เลือก \"Select all\" ใน dialog → กด Approve ของบรรทัด\n3. กด Approve ของทั้งใบที่ footer แล้วยืนยัน" },
          { type: "expected", description: "คำขอ approve ตอบ < 300 และ workflow_current_stage = Issue" },
          { type: "priority", description: "High" },
          { type: "testType", description: "Functional" },
          { type: "note", description: "เดิม SRI.2 · ปุ่ม Approve ของทั้งใบขึ้นหลังตัดสินทุกบรรทัดในโหมดแก้แล้วเท่านั้น — TC-SR-070001/080001 (701-sr) กด Approve ที่หน้าดูและไม่ assert" },
        ],
      },
      async ({ page }) => {
        await flow.expectApprovedToIssue(page, state.need("sr", "run the pre phase (TC-SI-700002) first").id);
      },
    );
  });

  test.describe("issuer", () => {
    test.skip(PHASE === "pre", "pre phase — issued in the post phase, after periods are created in advance");
    test.use({ user: "fc", bu: AVG.bu });
    test(
      "TC-SI-700004 FC กรอกจำนวนจ่ายแล้วกด Issue ใบเบิกของงวด active จ่ายได้และตัดของ",
      {
        annotation: [
          { type: "preconditions", description: "TC-SI-700003 ผ่านแล้ว — SR อยู่ขั้น Issue และลงวันที่ในงวด active; Login เป็น fc@carmen.com (อยู่ใน stage Issue); E2E_DB_URL ตั้งไว้" },
          { type: "steps", description: "1. เปิดใบ → Edit → เลือกทุกบรรทัด → Approve รายบรรทัด\n2. ช่อง Issued กรอก 1 (เท่าที่ขอ)\n3. กด Issue ของทั้งใบ แล้วยืนยัน\n4. ถ้าระบบถามวันที่ เลือก \"inside the open period\"" },
          { type: "expected", description: "คำขอ issue ตอบ < 300; SR completed; ยอดคงเหลือต้นทางลด 1; cost layer ลงงวด active; ถ้าวันนี้อยู่นอกงวด active ระบบต้องถามวันที่จ่าย" },
          { type: "priority", description: "High" },
          { type: "testType", description: "Functional" },
          { type: "note", description: "เดิม SRI.3 · ณ 2026-10-02 รอบ r3 หลังบ้านตอบ 422 SR_ISSUE_PERIOD_NOT_CURRENT ไม่ถามวันที่ — รอบ r4 ผ่านแล้ว · TC-SR-120001 (701-sr) หาปุ่ม Record Issuance ซึ่งไม่มีแล้ว" },
        ],
      },
      async ({ page, signals }) => {
        signals.expectApiError(/\/store-requisitions\/.+\/(issue|approve) → 4\d\d/);
        const a = await activePeriod();
        const x = await issueAsFc(page, state.need("sr", "run the pre phase (TC-SI-700002/700003) first").id, true);
        expect(x.status, `the backend refused to issue a requisition of the active period — ${x.facts}`).toBeLessThan(300);
        expect(x.sr.status, x.facts).toBe("completed");
        expect(x.after, `issuing must take the stock — ${x.facts}`).toBe(x.before - 1);
        expect(x.atPeriods, `must post into active period ${a.period} — ${x.facts}`).toEqual([a.period]);
        if (!a.todayInside) expect(x.asked, `today is outside the active period, the issue date must be asked — ${x.facts}`).toBe(true);
      },
    );
  });

  test.describe("submit after periods created in advance", () => {
    test.skip(PHASE !== "post", "post phase only");
    test.use({ user: DOC_FLOW_ROLE.sr.user, bu: AVG.bu });
    test(
      "TC-SI-700005 Requestor Submit ใบใหม่ตอนวันนี้อยู่ในงวดที่สร้างล่วงหน้า ระบบยังต้องถามวันที่",
      {
        annotation: [
          { type: "preconditions", description: "สร้างงวดล่วงหน้าที่ครอบวันนี้แล้ว แต่งวด active (open/locked เก่าสุด) ยังเป็นงวดเก่า; Login เป็น requestor@carmen.com; รันด้วย E2E_SRI_PHASE=post" },
          { type: "steps", description: "1. สร้าง SR ใหม่: LCX013 → 1FO02, 11020001 × 1, กด Save\n2. กด Submit แล้วยืนยัน\n3. ถ้าระบบถามวันที่ เลือก \"inside the open period\"" },
          { type: "expected", description: "วันนี้อยู่นอกงวด active → ระบบต้องถามว่าจะลงวันที่อะไร (ไม่ลงวันนี้เงียบ ๆ) และเลือก \"inside\" = วันสุดท้ายของงวด active" },
          { type: "priority", description: "Medium" },
          { type: "testType", description: "Edge Case" },
          { type: "note", description: "เดิม SRI.7 · ณ 2026-10-02 รอบ r3 ไม่ถาม — รอบ r4 ผ่านแล้ว" },
        ],
      },
      async ({ page, signals }) => {
        signals.expectApiError(/\/store-requisitions\/.+\/submit → 422/);
        const r = await flow.expectSubmitted(page, "sr.advance");
        await flow.expectSubmitDateRule(r);
        await observed(r.text);
      },
    );
  });
});

// ── CARMEN-FIFO (section 71) ────────────────────────────────────────────────────

test.describe("CARMEN-FIFO", () => {
  test.skip(SRI_BU !== "FIFO", "set E2E_SRI_BU=FIFO (after bun run movement:setup-fifo-roles)");

  test.describe("receiver", () => {
    test.use({ user: FIFO.grn.user, bu: FIFO.bu });
    test(
      "TC-SI-710001 FC รับสินค้าเข้า TEST-MOVE ด้วย GRN แล้ว Commit ให้มีของพอเบิก",
      {
        annotation: [
          { type: "preconditions", description: "รัน bun run movement:setup-fifo-roles แล้ว (fc ถือ role Purchase + คลัง TEST-MOVE บน CARMEN-FIFO); E2E_SRI_BU=FIFO; E2E_DB_URL ตั้งไว้" },
          { type: "steps", description: "1. Login เป็น fc สร้าง GRN manual วันที่ในงวด active: T-01-F × 5 @10 ที่ TEST-MOVE\n2. กด Create แล้ว Commit (FIFO ลงสต๊อกตอน commit)\n3. อ่านยอดคงเหลือ T-01-F ที่ TEST-MOVE" },
          { type: "expected", description: "GRN committed และยอดคงเหลือ T-01-F ที่ TEST-MOVE ≥ 1" },
          { type: "priority", description: "Medium" },
          { type: "testType", description: "Functional" },
          { type: "note", description: "เดิม SRF.0" },
        ],
      },
      async ({ page }) => {
        await flow.expectSourceStocked(page);
      },
    );
  });

  test.describe("requestor", () => {
    test.use({ user: DOC_FLOW_ROLE.sr.user, bu: FIFO.bu });
    test(
      "TC-SI-710002 Requestor Submit ใบเบิกบน FIFO วันนี้อยู่ในงวด active จึงไม่ถามวันที่",
      {
        annotation: [
          { type: "preconditions", description: "TC-SI-710001 ผ่านแล้ว; requestor ถือ role Requestor + คลัง TEST-MOVE, TEST-CONSUME บน CARMEN-FIFO" },
          { type: "steps", description: "1. สร้าง SR: TEST-MOVE → TEST-CONSUME, T-01-F × 1, กด Save\n2. กด Submit แล้วยืนยัน" },
          { type: "expected", description: "SR in_progress ขั้น HOD; วันนี้อยู่ในงวด active → ไม่ถามวันที่ (ตามกติกาเดียวกับ TC-SI-700002)" },
          { type: "priority", description: "High" },
          { type: "testType", description: "Functional" },
          { type: "note", description: "เดิม SRF.1 · พิสูจน์กลับของกติกา #718" },
        ],
      },
      async ({ page, signals }) => {
        signals.expectApiError(/\/store-requisitions\/.+\/submit → 422/);
        const r = await flow.expectSubmitted(page, "sr");
        await flow.expectSubmitDateRule(r);
        await observed(r.text);
      },
    );
  });

  test.describe("hod", () => {
    test.use({ user: "hod", bu: FIFO.bu });
    test(
      "TC-SI-710003 HOD อนุมัติใบเบิกบน FIFO ไปขั้น Issue",
      {
        annotation: [
          { type: "preconditions", description: "TC-SI-710002 ผ่านแล้ว; hod ถือ role HOD บน CARMEN-FIFO" },
          { type: "steps", description: "1. เปิดใบ → Edit → Select all → Approve รายบรรทัด\n2. กด Approve ของทั้งใบแล้วยืนยัน" },
          { type: "expected", description: "คำขอ approve ตอบ < 300 และ workflow_current_stage = Issue" },
          { type: "priority", description: "High" },
          { type: "testType", description: "Functional" },
          { type: "note", description: "เดิม SRF.2" },
        ],
      },
      async ({ page }) => {
        await flow.expectApprovedToIssue(page, state.need("sr", "run TC-SI-710002 first").id);
      },
    );
  });

  test.describe("issuer", () => {
    test.use({ user: "fc", bu: FIFO.bu });
    test(
      "TC-SI-710004 FC กรอกจำนวนจ่ายแล้วกด Issue บน FIFO จ่ายได้และตัดของ",
      {
        annotation: [
          { type: "preconditions", description: "TC-SI-710003 ผ่านแล้ว — SR อยู่ขั้น Issue; fc อยู่ใน stage Issue ของ workflow บน CARMEN-FIFO" },
          { type: "steps", description: "1. เปิดใบ → Edit → Approve รายบรรทัด\n2. ช่อง Issued กรอก 1\n3. กด Issue ของทั้งใบแล้วยืนยัน" },
          { type: "expected", description: "คำขอ issue ตอบ < 300; SR completed; ยอดคงเหลือ TEST-MOVE ลด 1; cost layer ลงงวด active" },
          { type: "priority", description: "High" },
          { type: "testType", description: "Functional" },
          { type: "note", description: "เดิม SRF.3" },
        ],
      },
      async ({ page, signals }) => {
        signals.expectApiError(/\/store-requisitions\/.+\/(issue|approve) → 4\d\d/);
        const a = await activePeriod();
        const x = await issueAsFc(page, state.need("sr", "run TC-SI-710002/710003 first").id, true);
        expect(x.status, x.facts).toBeLessThan(300);
        expect(x.sr.status, x.facts).toBe("completed");
        expect(x.after, `issuing must take the stock — ${x.facts}`).toBe(x.before - 1);
        expect(x.atPeriods, `must post into active period ${a.period} — ${x.facts}`).toEqual([a.period]);
      },
    );
  });

  test.describe("issue without typing the issued qty", () => {
    test.describe("requestor", () => {
      test.use({ user: DOC_FLOW_ROLE.sr.user, bu: FIFO.bu });
      test(
        "TC-SI-710005 Requestor สร้างใบเบิกใบที่สองแล้ว Submit บน FIFO",
        {
          annotation: [
            { type: "preconditions", description: "TC-SI-710001 ผ่านแล้ว (TEST-MOVE มีของ)" },
            { type: "steps", description: "1. สร้าง SR: TEST-MOVE → TEST-CONSUME, T-01-F × 1, กด Save\n2. กด Submit แล้วยืนยัน" },
            { type: "expected", description: "SR in_progress ขั้น HOD" },
            { type: "priority", description: "Low" },
            { type: "testType", description: "Functional" },
            { type: "note", description: "เดิม SRF.4 · ขั้นเตรียมของ TC-SI-710007" },
          ],
        },
        async ({ page, signals }) => {
          signals.expectApiError(/\/store-requisitions\/.+\/submit → 422/);
          const r = await flow.expectSubmitted(page, "sr.second");
          await observed(r.text);
        },
      );
    });

    test.describe("hod", () => {
      test.use({ user: "hod", bu: FIFO.bu });
      test(
        "TC-SI-710006 HOD อนุมัติใบเบิกใบที่สองบน FIFO",
        {
          annotation: [
            { type: "preconditions", description: "TC-SI-710005 ผ่านแล้ว — ใบที่สองอยู่ขั้น HOD" },
            { type: "steps", description: "1. เปิดใบ → Edit → Approve รายบรรทัด\n2. กด Approve ของทั้งใบแล้วยืนยัน" },
            { type: "expected", description: "workflow_current_stage = Issue" },
            { type: "priority", description: "Low" },
            { type: "testType", description: "Functional" },
            { type: "note", description: "เดิม SRF.5 · ขั้นเตรียมของ TC-SI-710007" },
          ],
        },
        async ({ page }) => {
          await flow.expectApprovedToIssue(page, state.need("sr.second", "run TC-SI-710005 first").id);
        },
      );
    });

    test.describe("issuer", () => {
      test.use({ user: "fc", bu: FIFO.bu });
      test(
        "TC-SI-710007 FC กด Issue โดยไม่กรอกจำนวนจ่าย ระบบต้องไม่ปิดใบโดยไม่ได้จ่ายของ",
        {
          annotation: [
            { type: "preconditions", description: "TC-SI-710006 ผ่านแล้ว — ใบที่สองอยู่ขั้น Issue" },
            { type: "steps", description: "1. เปิดใบ → Edit → Approve รายบรรทัด\n2. ไม่แตะช่อง Issued (ค่าตั้งต้น 0)\n3. กด Issue แล้วยืนยัน" },
            { type: "expected", description: "ระบบเติมจำนวนจ่ายให้ หรือกันไม่ให้กด หรือหลังบ้านปฏิเสธ — ต้องไม่ใช่ completed + ไม่ตัดของ + toast ว่าจ่ายแล้ว" },
            { type: "priority", description: "High" },
            { type: "testType", description: "Negative" },
            { type: "note", description: "บั๊กที่รู้อยู่ (test.fail): ณ 2026-10-02 ใบปิดเป็น completed โดย issued_qty = 0 และยอดคงเหลือไม่ลด · เดิม SRF.6" },
          ],
        },
        async ({ page }) => {
          test.fail(true, "known bug: Issue with the default Issued qty (0) closes the SR as completed without moving stock");
          const x = await issueAsFc(page, state.need("sr.second", "run TC-SI-710005/710006 first").id, false);
          const silentlyClosed = x.status < 300 && x.sr.status === "completed" && x.after === x.before;
          expect(silentlyClosed, `SR closed as completed without issuing anything — ${x.facts}`).toBe(false);
        },
      );
    });
  });
});
