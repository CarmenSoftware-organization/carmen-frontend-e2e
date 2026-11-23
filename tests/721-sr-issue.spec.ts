import type { Page } from "@playwright/test";
import { test, gotoBu, expect, observed } from "./fixtures/doc-flow.fixture";
import { BU_CODE, TEST_BUS } from "./test-users";
import { buConfigSend, buSend } from "./helpers/bu-api";
import { dfGet, multiBuRows, txOfDoc } from "./helpers/doc-flow/api";
import { createGrn } from "./helpers/doc-flow/docs";
import { DF as P, activePeriodDate, firstVendor, itemRow, srLocations, srWorkflowName, stamp } from "./helpers/doc-flow/data";
import { calcMethod, costLayers, expectedIssueCost, stockAt } from "./helpers/costing";
import { addRow, answerSrDateQuestion, chooseDateInDialog, button, field, pickLookup, pickSelectIn, toasts, typeInto } from "./helpers/movement/ui";

/**
 * Store requisition all the way to Issue, on the three TEST BUs (one chain per cost method), gmail accounts.
 *   Purchase receives stock (GRN created + committed) -> Requestor creates + Submits ("Create Request" -> "Store Approval")
 *   -> Purchase Approves ("Store Approval") -> StoreManager Issues ("Issue").
 * Workflow "Store Requisition" (Create -> Store Approval -> Issue), product E2E-DF-1, from/to = the doc-flow location pair.
 *
 * Section 70 = BU-GR2VYNKQ (average) · 71 = BU-96EAT3GX (fifo) · 72 = BU-0706T34Y (average_per_location).
 * TC-SI-710005..710007 (second SR, "Issue without typing the issued qty") run once on BU-GR2VYNKQ; they keep the
 * 71 prefix because they were first written for the old FIFO variant (history, not BU).
 * Each chain's first step asserts the BU's cost method (calculation-method) equals TEST_BUS[].method — a pinned page
 * that silently lands on another BU fails there instead of posting into the wrong BU.
 *
 * Issue cost (the 7x0004 cases): expected = expectedIssueCost(costLayers(...) read BEFORE the issue, qty, method):
 *   average = BU-wide pool over both doc-flow locations · average_per_location = source location only · fifo = open
 *   lots at the source location, oldest first (replay of the inventory-info ledger, user decision "Replay FIFO").
 * Expected values come from the live before-state and stock is asserted as a delta, so the spec re-runs without a reset.
 * The actual cost = sum of total_cost of the SR's inventory-transaction rows that take stock out of the source location.
 * A disagreement between the oracle and the backend is a finding, never an oracle tweak: the failure message carries
 * the layers, expected and actual.
 *
 * Gaps (also in docs/superpowers/specs/2026-11-24-e2e-doc-flow-on-test-bus-design.md): TC-SI-700005 needs an active
 * period older than today (periods built in advance) — skipped; the old E2E_SRI_PHASE pre/post split is gone.
 * Rule #718 (user, 2026-10-02): when today is outside the active period the system must ASK which date to use (submit
 * and issue). On a fresh TEST BU today is inside the active period, so no question is expected; if one is asked it is
 * answered "inside the open period" and recorded.
 *
 * Local helpers (not in tests/helpers on purpose — shared helpers are frozen for this task): srCtx, issueCost, approveAllLines.
 * FINDING: the BU-scoped list `GET /api/<bu>/store-requisitions` is 404 — the list lives at `/api/store-requisitions?bu_code=`
 * (same as tests/helpers/sr-api.ts); cleanup here uses that. 702's afterAll uses the BU-scoped path and will fail the same way.
 * Needs the doc-flow step of `bun run data:reset --bu all`.
 * Origin: `_movement_play/eop_bf/e2e/fe/07-sr-issue.spec.ts` (SRI.0–SRI.7, SRF.0–SRF.6).
 */
test.describe.configure({ retries: 0 });
test.setTimeout(300_000);

/** TC ids per BU: receive, submit, approve, issue. */
const IDS = {
  "BU-GR2VYNKQ": ["TC-SI-700001", "TC-SI-700002", "TC-SI-700003", "TC-SI-700004"],
  "BU-96EAT3GX": ["TC-SI-710001", "TC-SI-710002", "TC-SI-710003", "TC-SI-710004"],
  "BU-0706T34Y": ["TC-SI-720001", "TC-SI-720002", "TC-SI-720003", "TC-SI-720004"],
} as const;
const GRN_QTY = 5;
// A price that changes from run to run, so a re-run (no reset) leaves lots / pools of different cost and the oracle is not trivially satisfied.
const GRN_PRICE = 10 + (Number(stamp.slice(-2)) % 9);

interface SrCtx {
  from: string;
  to: string;
  workflow: string;
  vendor: string;
  today: string;
  productId: string;
  fromId: string;
  toId: string;
}

async function srCtx(bu: string): Promise<SrCtx> {
  const { from, to } = await srLocations(bu);
  const list = await buConfigSend("Admin", "GET", `/products?search=${encodeURIComponent(P.P1.code)}&perpage=20`, undefined, bu);
  const hit = ((list.body?.data ?? []) as any[]).find((p) => p.code === P.P1.code);
  if (!hit) throw new Error(`${bu}: product ${P.P1.code} not found - run data:reset first`);
  const detail = await buConfigSend("Admin", "GET", `/products/${hit.id}`, undefined, bu);
  const locs = (detail.body?.data?.locations ?? []) as any[];
  const id = (name: string) => {
    const l = locs.find((x) => x.location?.name === name);
    if (!l) throw new Error(`${bu}: ${P.P1.code} has no location "${name}"`);
    return String(l.location.id);
  };
  return {
    from,
    to,
    workflow: await srWorkflowName(bu),
    vendor: (await firstVendor(bu)).code,
    today: await activePeriodDate(bu),
    productId: String(hit.id),
    fromId: id(from),
    toId: id(to),
  };
}

async function srById(bu: string, id: string) {
  const { status, body } = await dfGet(`/store-requisitions/${id}`, "Admin", bu);
  const d = body?.data;
  if (status !== 200 || !d) return { status: "deleted", no: "", stage: "", date: "", issued: 0 };
  const issued = (d.store_requisition_detail ?? []).reduce((n: number, x: any) => n + Number(x.issued_qty ?? 0), 0);
  return { status: d.doc_status as string, no: d.sr_no as string, stage: d.workflow_current_stage as string, date: String(d.sr_date ?? ""), issued };
}

/** What the SR's issue cost the source location: sum of total_cost over the transaction rows that took stock out of it. */
async function issueCost(bu: string, id: string, no: string, fromName: string) {
  const rows = await txOfDoc(bu, id, no);
  const out = rows.filter((t) => Number(t.qty_out) > 0);
  return {
    rows,
    qty: out.reduce((n, t) => n + Number(t.qty_out), 0),
    cost: Math.round(out.reduce((n, t) => n + Number(t.total_cost), 0) * 100) / 100,
    desc: out.map((t) => `${t.location?.code ?? "?"} out ${t.qty_out} @${t.cost_per_unit} = ${t.total_cost}`).join(" | ") || `(no out rows; source ${fromName})`,
  };
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
 * (footer) appears: Edit -> tick Select all -> "Select all" in the dialog -> the
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

async function submitNewSr(page: Page, bu: string, c: SrCtx, tag: string) {
  await gotoBu(page, "/store-operation/store-requisition/new", bu);
  await pickSelectIn(page, "Workflow", c.workflow);
  await pickLookup(page, field(page, "Request From").locator("button").first(), c.from);
  await pickLookup(page, field(page, "Deliver To (Destination)").locator("button").first(), c.to);
  await page.locator("#sr-description").fill(`FE-CRUD SR issue ${stamp} ${tag}`);
  const row = await addRow(page, "Select Product");
  await pickLookup(page, row.getByRole("button", { name: "Select Product" }), P.P1.code);
  await typeInto(itemRow(page, P.P1.code).locator('input[name$=".requested_qty"]'), 1);
  const saved = page.waitForResponse((r) => /\/store-requisitions/.test(r.url()) && r.request().method() === "POST", { timeout: 60_000 });
  await button(page, "Save").first().click();
  const id: string = (await (await saved).json()).data.id;
  await expect(page).toHaveURL(new RegExp(id));
  const submitted = page.waitForResponse((r) => /\/store-requisitions\/.+\/submit/.test(r.url()), { timeout: 60_000 });
  await button(page, "Submit").first().click();
  const dialog = await confirmAction(page, /submit|confirm|ยืนยัน/i);
  const q = await answerSrDateQuestion(page, await submitted, /\/store-requisitions\/.+\/submit/);
  expect(q.res.status(), JSON.stringify(q.body).slice(0, 300)).toBeLessThan(300);
  await expect.poll(async () => (await srById(bu, id)).status, { timeout: 30_000 }).toBe("in_progress");
  const sr = await srById(bu, id);
  expect(sr.stage).toBe("Store Approval");
  const asked = dialogAsked || q.asked;
  await observed(`${sr.no} · ${sr.status} · stage ${sr.stage} · date question: ${asked ? "asked" : "not asked"} · sr_date ${sr.date} · confirm dialog: "${dialog.slice(0, 120)}"`);
  return { id, no: sr.no, asked };
}

async function approveSr(page: Page, bu: string, id: string) {
  await gotoBu(page, `/store-operation/store-requisition/${id}`, bu);
  await approveAllLines(page);
  const approved = page.waitForResponse((r) => new RegExp(`/store-requisitions/${id}/approve`).test(r.url()), { timeout: 60_000 });
  await button(page, "Approve").last().click();
  const dialog = await confirmAction(page, /approve|confirm|ยืนยัน/i);
  const a = await approved;
  expect(a.status(), (await a.text()).slice(0, 300)).toBeLessThan(300);
  await expect.poll(async () => (await srById(bu, id)).stage, { timeout: 30_000 }).toBe("Issue");
  const sr = await srById(bu, id);
  await observed(`${sr.no} · ${sr.status} · stage ${sr.stage} · dialog: "${dialog.slice(0, 200)}" · toast: ${(await toasts(page)).join(" / ") || "-"}`);
}

/** fillQty = the issuer types Issued = requested qty · false = leave the field's default. `beforeIssue` runs after the lines are approved, right before the Issue click. */
async function issueSr(page: Page, bu: string, c: SrCtx, id: string, fillQty: boolean, beforeIssue?: () => Promise<void>) {
  const before = (await stockAt(c.productId, c.fromId, c.today, bu)).qty;
  await gotoBu(page, `/store-operation/store-requisition/${id}`, bu);
  const lines = await approveAllLines(page);
  const issuedInput = itemRow(page, P.P1.code).locator('input[name$=".issued_qty"]');
  const defaultIssued = await issuedInput.inputValue().catch(() => "(no field)");
  if (fillQty) await typeInto(issuedInput, 1);
  await expect(button(page, "Issue"), `no Issue button after approving the lines · rows: ${lines.join(" | ")}`).toBeVisible();
  await beforeIssue?.();
  const issueUrl = new RegExp(`/store-requisitions/${id}/`);
  const issued = page.waitForResponse((r) => issueUrl.test(r.url()) && r.request().method() !== "GET", { timeout: 60_000 });
  await button(page, "Issue").last().click();
  const dialog = await confirmAction(page, /issue|confirm|ยืนยัน/i);
  const q = await answerSrDateQuestion(page, await issued, issueUrl);
  await page.waitForTimeout(2000);
  const toast = (await toasts(page)).join(" / ");
  const sr = await srById(bu, id);
  const after = (await stockAt(c.productId, c.fromId, c.today, bu)).qty;
  const facts = `date question: ${q.asked || dialogAsked ? `asked (${q.code})` : "not asked"} · HTTP ${q.res.status()} code=${q.body?.error?.code ?? "-"} · Issued default "${defaultIssued}"${fillQty ? " → typed 1" : " (left)"} · SR ${sr.status} stage ${sr.stage} · issued_qty ${sr.issued} · on hand ${c.from} ${before} → ${after} · dialog: "${dialog.slice(0, 120)}" · toast: "${toast || "-"}"`;
  await observed(facts);
  return { status: q.res.status(), sr, before, after, facts };
}

/** Void/delete what this run left open — drafts are deleted; in-progress SRs cannot be removed from here and wait for the next reset. Failures throw. */
async function cleanupSrs(bu: string) {
  const rows = await multiBuRows(`/store-requisitions?perpage=100&search=${encodeURIComponent(`FE-CRUD SR issue ${stamp}`)}`, bu);
  const failures: string[] = [];
  for (const d of rows) {
    if (!String(d.description ?? "").startsWith(`FE-CRUD SR issue ${stamp}`)) continue;
    if (d.doc_status !== "draft") {
      console.warn(`cleanup: ${bu} left ${d.sr_no} in ${d.doc_status} until next data:reset`);
      continue;
    }
    const r = await buSend("Admin", "DELETE", `/store-requisitions/${d.id}`, undefined, bu);
    if (r.status >= 300) failures.push(`${d.sr_no ?? d.id} HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
  }
  if (failures.length) throw new Error(`cleanup: SR draft(s) not deleted on ${bu}: ${failures.join(" | ")}`);
}

for (const bu of TEST_BUS) {
  const [RECEIVE, SUBMIT, APPROVE, ISSUE] = IDS[bu.code];
  test.describe(bu.code, () => {
    test.describe.configure({ mode: "serial" });
    test.use({ bu: bu.code });
    // Before the stock arrives the cost estimator answers 422 "No available stock" — known, not under test.
    test.beforeEach(({ signals }) => signals.minor(/\/cost\/products\/.+ → 422/, "location has no stock yet: cost estimator 422"));

    let c: SrCtx;
    let srId = "";
    let srId2 = "";
    test.beforeAll(async () => {
      c = await srCtx(bu.code);
    });
    test.afterAll(async () => {
      test.setTimeout(180_000);
      await cleanupSrs(bu.code);
    });

    test.describe("receiver", () => {
      test.use({ role: "Purchase" });
      test(
        `${RECEIVE} Purchase รับสินค้าเข้าคลังต้นทางบน ${bu.method} ด้วย GRN ที่ commit แล้ว ให้มีของพอเบิก`,
        {
          annotation: [
            { type: "preconditions", description: `Login เป็นบัญชี Purchase (gmail) ที่ถือสิทธิ์ GRN create/commit; BU ${bu.code} (${bu.method}); E2E-DF-1 อยู่ในคลังคู่ doc-flow (data:reset)` },
            { type: "steps", description: `0. อ่าน calculation-method ของ BU ต้องเท่ากับ ${bu.method}\n1. สร้าง GRN manual วันที่ในงวด active: E2E-DF-1 × ${GRN_QTY} ที่คลังต้นทาง (ราคา ${GRN_PRICE}+ เปลี่ยนทุกรอบ)\n2. กด Create แล้ว Commit (FIFO ลงสต๊อกตอน commit, average ไม่เสียหาย)\n3. อ่านยอดคงเหลือที่คลังต้นทางก่อน/หลัง` },
            { type: "expected", description: "calculation-method ตรง; GRN committed; ยอดคงเหลือคลังต้นทางเพิ่ม 5 (delta)" },
            { type: "priority", description: "Medium" },
            { type: "testType", description: "Functional" },
            { type: "note", description: "เดิม SRI.0 / SRF.0 (_movement_play fe/07-sr-issue) · ขั้นเตรียมข้อมูล + ตรวจว่าหน้าไม่หลุดไป BU อื่น" },
          ],
        },
        async ({ page }) => {
          expect(await calcMethod(bu.code), `${bu.code} must run ${bu.method} — wrong BU or reset not run`).toBe(bu.method);
          const before = (await stockAt(c.productId, c.fromId, c.today, bu.code)).qty;
          const g = (await createGrn(page, {
            bu: bu.code,
            vendor: c.vendor,
            location: c.from,
            date: c.today,
            invoiceNo: `FE-GRN-SRI-${stamp}-${bu.method}`,
            status: "committed",
            lines: [{ product: P.P1.code, qty: GRN_QTY, price: GRN_PRICE }],
          }))!;
          expect(g.status).toBe("committed");
          let after = before;
          await expect
            .poll(async () => (after = (await stockAt(c.productId, c.fromId, c.today, bu.code)).qty), { timeout: 30_000 })
            .toBe(before + GRN_QTY);
          await observed(`${g.no} · ${g.status} · on hand ${c.from} ${before} → ${after} · price ${GRN_PRICE}`);
        },
      );
    });

    test.describe("requestor", () => {
      test.use({ role: "Requestor" });
      test(
        `${SUBMIT} Requestor สร้างและ Submit ใบเบิกบน ${bu.method} ไปขั้น Store Approval`,
        {
          annotation: [
            { type: "preconditions", description: `${RECEIVE} ผ่านแล้ว; Login เป็นบัญชี Requestor (gmail); workflow Store Requisition ขั้น Create→Store Approval→Issue` },
            { type: "steps", description: "1. สร้าง SR: คลังต้นทาง → ปลายทางของคู่ doc-flow, E2E-DF-1 × 1, กด Save\n2. กด Submit แล้วยืนยัน\n3. ถ้าระบบถามวันที่ เลือก \"inside the open period\"" },
            { type: "expected", description: "SR in_progress ขั้น Store Approval; วันนี้อยู่ในงวด active ของ TEST BU จึงไม่ควรถามวันที่ (ถ้าถามให้บันทึกไว้)" },
            { type: "priority", description: "High" },
            { type: "testType", description: "Functional" },
            { type: "note", description: "เดิม SRI.1 / SRF.1 · กติกา #718 · 422 SR_DATE_PATTERN_REQUIRED เป็นพฤติกรรมที่ตั้งใจ" },
          ],
        },
        async ({ page, signals }) => {
          signals.expectApiError(/\/store-requisitions\/.+\/submit → 422/);
          const r = await submitNewSr(page, bu.code, c, "a");
          srId = r.id;
          expect(r.asked, "today is inside the active period of a fresh TEST BU, no date question expected").toBe(false);
        },
      );
    });

    test.describe("approver", () => {
      test.use({ role: "Purchase" });
      test(
        `${APPROVE} Purchase อนุมัติรายบรรทัดแล้วอนุมัติทั้งใบบน ${bu.method} ใบเบิกไปขั้น Issue`,
        {
          annotation: [
            { type: "preconditions", description: `${SUBMIT} ผ่านแล้ว — SR อยู่ขั้น Store Approval; Login เป็น Purchase (อยู่ใน stage Store Approval)` },
            { type: "steps", description: "1. เปิดใบ แล้วกด Edit\n2. ติ๊ก Select all → เลือก \"Select all\" ใน dialog → กด Approve ของบรรทัด\n3. กด Approve ของทั้งใบที่ footer แล้วยืนยัน" },
            { type: "expected", description: "คำขอ approve ตอบ < 300 และ workflow_current_stage = Issue" },
            { type: "priority", description: "High" },
            { type: "testType", description: "Functional" },
            { type: "note", description: "เดิม SRI.2 / SRF.2 · ปุ่ม Approve ของทั้งใบขึ้นหลังตัดสินทุกบรรทัดในโหมดแก้แล้วเท่านั้น" },
          ],
        },
        async ({ page }) => {
          expect(srId, `run ${SUBMIT} first`).not.toBe("");
          await approveSr(page, bu.code, srId);
        },
      );
    });

    test.describe("issuer", () => {
      test.use({ role: "StoreManager" });
      test(
        `${ISSUE} StoreManager กรอกจำนวนจ่ายแล้วกด Issue บน ${bu.method} ตัดของและต้นทุนจ่ายตรงตามวิธีคิด`,
        {
          annotation: [
            { type: "preconditions", description: `${APPROVE} ผ่านแล้ว — SR อยู่ขั้น Issue และลงวันที่ในงวด active; Login เป็น StoreManager (stage Issue)` },
            { type: "steps", description: `0. อ่านชั้นต้นทุน (${bu.method === "fifo" ? "lot ที่ยังเหลือของคลังต้นทาง เก่าสุดก่อน" : bu.method === "average" ? "ยอด+มูลค่ารวมของสองคลังคู่ doc-flow" : "ยอด+มูลค่าของคลังต้นทางเท่านั้น"}) ก่อนจ่าย\n1. เปิดใบ → Edit → เลือกทุกบรรทัด → Approve รายบรรทัด\n2. ช่อง Issued กรอก 1\n3. กด Issue ของทั้งใบ แล้วยืนยัน\n4. ถ้าระบบถามวันที่ เลือก \"inside the open period\"` },
            { type: "expected", description: "คำขอ issue ตอบ < 300; SR completed; ยอดคงเหลือต้นทางลด 1 (delta); มี inventory transaction ลงวันที่ในงวด active; ต้นทุนจ่าย = expectedIssueCost(ชั้นต้นทุนที่อ่านก่อนจ่าย, 1, วิธีคิดของ BU)" },
            { type: "priority", description: "High" },
            { type: "testType", description: "Functional" },
            { type: "note", description: "เดิม SRI.3 / SRF.3 · เทียบต้นทุนกับ oracle กลาง tests/helpers/costing.ts · ไม่ปรับ oracle ให้ตรงตัวเลข ถ้าไม่ตรงให้รายงานเลขจริง" },
          ],
        },
        async ({ page, signals }) => {
          signals.expectApiError(/\/store-requisitions\/.+\/(issue|approve) → 4\d\d/);
          expect(srId, `run ${SUBMIT} / ${APPROVE} first`).not.toBe("");
          let layers: Awaited<ReturnType<typeof costLayers>> = [];
          const x = await issueSr(page, bu.code, c, srId, true, async () => {
            layers = await costLayers({ productId: c.productId, locationIds: [c.fromId, c.toId], sourceLocationId: c.fromId, atDate: c.today, bu: bu.code });
          });
          expect(x.status, `the backend refused to issue — ${x.facts}`).toBeLessThan(300);
          expect(x.sr.status, x.facts).toBe("completed");
          expect(x.after, `issuing must take the stock — ${x.facts}`).toBe(x.before - 1);
          expect(x.sr.date.slice(0, 7), `SR dated inside the active period month — ${x.facts}`).toBe(c.today.slice(0, 7));
          const tx = await issueCost(bu.code, srId, x.sr.no, c.from);
          expect(tx.rows.length, `issue must post an inventory transaction — ${x.facts}`).toBeGreaterThan(0);
          expect(tx.qty, `transaction qty out — ${tx.desc}`).toBe(1);
          const expected = expectedIssueCost(layers, 1, bu.method);
          const detail = `layers before ${JSON.stringify(layers)} · expected ${expected} · actual ${tx.cost} (${tx.desc})`;
          await observed(`${bu.method}: ${detail}`);
          expect(Math.abs(tx.cost - expected), `${bu.method} issue cost mismatch — ${detail}`).toBeLessThanOrEqual(0.01);
        },
      );
    });

    // The second-SR cases run once, on the default BU (AVG). Prefix 71 is historical (old FIFO variant).
    if (bu.code === BU_CODE) {
      test.describe("issue without typing the issued qty", () => {
        test.describe("requestor", () => {
          test.use({ role: "Requestor" });
          test(
            "TC-SI-710005 Requestor สร้างใบเบิกใบที่สองแล้ว Submit",
            {
              annotation: [
                { type: "preconditions", description: `${RECEIVE} ผ่านแล้ว (คลังต้นทางมีของ — เหลือจากใบแรก ≥ 4)` },
                { type: "steps", description: "1. สร้าง SR: คลังต้นทาง → ปลายทางของคู่ doc-flow, E2E-DF-1 × 1, กด Save\n2. กด Submit แล้วยืนยัน" },
                { type: "expected", description: "SR in_progress ขั้น Store Approval" },
                { type: "priority", description: "Low" },
                { type: "testType", description: "Functional" },
                { type: "note", description: "เดิม SRF.4 · ขั้นเตรียมของ TC-SI-710007 · รันบน BU-GR2VYNKQ ครั้งเดียว" },
              ],
            },
            async ({ page, signals }) => {
              signals.expectApiError(/\/store-requisitions\/.+\/submit → 422/);
              srId2 = (await submitNewSr(page, bu.code, c, "b")).id;
            },
          );
        });

        test.describe("approver", () => {
          test.use({ role: "Purchase" });
          test(
            "TC-SI-710006 Purchase อนุมัติใบเบิกใบที่สอง",
            {
              annotation: [
                { type: "preconditions", description: "TC-SI-710005 ผ่านแล้ว — ใบที่สองอยู่ขั้น Store Approval" },
                { type: "steps", description: "1. เปิดใบ → Edit → Approve รายบรรทัด\n2. กด Approve ของทั้งใบแล้วยืนยัน" },
                { type: "expected", description: "workflow_current_stage = Issue" },
                { type: "priority", description: "Low" },
                { type: "testType", description: "Functional" },
                { type: "note", description: "เดิม SRF.5 · ขั้นเตรียมของ TC-SI-710007" },
              ],
            },
            async ({ page }) => {
              expect(srId2, "run TC-SI-710005 first").not.toBe("");
              await approveSr(page, bu.code, srId2);
            },
          );
        });

        test.describe("issuer", () => {
          test.use({ role: "StoreManager" });
          test(
            "TC-SI-710007 StoreManager กด Issue โดยไม่กรอกจำนวนจ่าย ระบบต้องไม่ปิดใบโดยไม่ได้จ่ายของ",
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
              expect(srId2, "run TC-SI-710005/710006 first").not.toBe("");
              const x = await issueSr(page, bu.code, c, srId2, false);
              const silentlyClosed = x.status < 300 && x.sr.status === "completed" && x.after === x.before;
              expect(silentlyClosed, `SR closed as completed without issuing anything — ${x.facts}`).toBe(false);
            },
          );
        });
      });

      test.describe("gap: submit after periods created in advance", () => {
        test(
          "TC-SI-700005 Requestor Submit ใบใหม่ตอนวันนี้อยู่ในงวดที่สร้างล่วงหน้า ระบบยังต้องถามวันที่",
          {
            annotation: [
              { type: "preconditions", description: "ต้องมีงวด active (open/locked เก่าสุด) ที่เก่ากว่าวันนี้ แต่มีงวดสร้างล่วงหน้าครอบวันนี้ — TEST BU ที่เพิ่ง reset มีแค่เดือนนี้กับเดือนหน้า" },
              { type: "steps", description: "1. สร้าง SR ใหม่ 1 รายการ แล้ว Submit\n2. ถ้าระบบถามวันที่ เลือก \"inside the open period\"" },
              { type: "expected", description: "วันนี้อยู่นอกงวด active → ระบบต้องถามว่าจะลงวันที่อะไร และ \"inside\" = วันสุดท้ายของงวด active" },
              { type: "priority", description: "Medium" },
              { type: "testType", description: "Edge Case" },
              { type: "note", description: "gap: ย้ายไปโปรเจกต์ period-close (ดู Gaps ใน docs/superpowers/specs/2026-11-24-e2e-doc-flow-on-test-bus-design.md) · เดิม SRI.7 · phase pre/post (E2E_SRI_PHASE) ถูกถอดออก" },
            ],
          },
          async () => {
            test.skip(true, "gap: needs an active period older than today; a fresh TEST BU has only this month and next; moved to the period-close project (docs/superpowers/specs/2026-11-24-e2e-doc-flow-on-test-bus-design.md, Gaps)");
          },
        );
      });
    }
  });
}
