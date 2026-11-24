import type { Page } from "@playwright/test";
import { test, gotoBu, expect, observed } from "./fixtures/doc-flow.fixture";
import { BU_CODE } from "./test-users";
import { buSend } from "./helpers/bu-api";
import { dfGet, multiBuRows } from "./helpers/doc-flow/api";
import { DF as P, itemRow, srLocations, srWorkflowName, stamp } from "./helpers/doc-flow/data";
import {
  addRow,
  answerSrDateQuestion,
  chooseDateInDialog,
  button,
  field,
  shownText,
  numRe,
  pickLookup,
  pickSelectIn,
  toasts,
  typeInto,
} from "./helpers/movement/ui";

/**
 * SR doc flow — doc-flow suite on the TEST BU (AVG), gmail accounts.
 * BU-GR2VYNKQ · Requestor ("Create Request" of the Store Requisition workflow: Create -> Store Approval -> Issue) ·
 * product E2E-DF-1 · workflow and from/to locations read at run time.
 * draft -> view -> edit (header + qty) -> delete -> new + Submit.
 *
 * Needs the doc-flow step of `bun run data:reset`.
 * Origin: `_movement_play/eop_bf/e2e/fe/03-sr.spec.ts` (SR.1-SR.5).
 */
const BU = BU_CODE;
test.use({ role: "Requestor", bu: BU_CODE });
test.describe.configure({ mode: "serial", retries: 0 });
test.setTimeout(300_000);
// The source location may hold no stock: the cost estimator answers 422 and the screen shows Total 0.00 with no warning.
test.beforeEach(({ signals }) =>
  signals.minor(/\/cost\/products\/.+ → 422/, "no stock at the source location: cost estimator 422, screen shows Total 0.00 without a warning"),
);

let FROM = "";
let TO = "";
let WORKFLOW = "";
const DESC = `FE-CRUD SR ${stamp}`;

test.beforeAll(async () => {
  ({ from: FROM, to: TO } = await srLocations(BU));
  WORKFLOW = await srWorkflowName(BU);
});

/**
 * Cleanup by description stamp, read from the API (not from in-memory ids) so a failed case is
 * still cleaned. Only drafts can be deleted; the submitted SR is left in progress (warned) until
 * the next data:reset. Failures throw so the hook fails visibly.
 */
test.afterAll(async () => {
  test.setTimeout(180_000);
  const rows = await multiBuRows(`/store-requisitions?perpage=100&search=${encodeURIComponent(DESC)}`, BU);
  const failures: string[] = [];
  for (const d of rows) {
    if (!String(d.description ?? "").startsWith(DESC)) continue;
    if (d.doc_status !== "draft") {
      // only drafts can be deleted — submitted docs wait for the next data:reset
      console.warn(`cleanup: left ${d.sr_no} in ${d.doc_status} until next data:reset`);
      continue;
    }
    const r = await buSend("Admin", "DELETE", `/store-requisitions/${d.id}`, undefined, BU);
    if (r.status >= 300) failures.push(`${d.sr_no ?? d.id} HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
  }
  if (failures.length) throw new Error(`cleanup: SR draft(s) not deleted: ${failures.join(" | ")}`);
});

interface SrLine {
  product: string;
  qty: number;
}

async function srById(id: string) {
  const { status, body } = await dfGet(`/store-requisitions/${id}`, "Admin", BU);
  if (status !== 200 || !body?.data) return { status: "deleted", no: "", desc: "", stage: "", lines: [] as SrLine[] };
  const d = body.data;
  const details = d.store_requisition_detail ?? d.details ?? [];
  return {
    status: d.doc_status as string,
    no: d.sr_no as string,
    desc: d.description as string,
    stage: d.workflow_current_stage as string,
    lines: details.map((x: any) => ({
      product: x.product?.code ?? x.product_code ?? x.product_sku ?? x.product_name,
      qty: Number(x.requested_qty),
    })) as SrLine[],
  };
}
const fmt = (ls: SrLine[]) => ls.map((l) => `${l.product}×${l.qty}`).sort().join(", ");

async function addLine(page: Page, line: SrLine) {
  const row = await addRow(page, "Select Product");
  await pickLookup(page, row.getByRole("button", { name: "Select Product" }), line.product);
  await typeInto(itemRow(page, line.product).locator('input[name$=".requested_qty"]'), line.qty);
}

async function saveAndWait(page: Page) {
  const resp = page.waitForResponse(
    (r) => /\/store-requisitions/.test(r.url()) && !["GET", "OPTIONS"].includes(r.request().method()),
    { timeout: 60_000 },
  );
  await button(page, "Save").first().click();
  const r = await resp;
  return { status: r.status(), body: await r.json().catch(() => ({})) };
}

async function fillHeader(page: Page, desc: string) {
  await pickSelectIn(page, "Workflow", WORKFLOW);
  await pickLookup(page, field(page, "Request From").locator("button").first(), FROM);
  await pickLookup(page, field(page, "Deliver To (Destination)").locator("button").first(), TO);
  await page.locator("#sr-description").fill(desc);
}

let draftId = "";
const LINES: SrLine[] = [{ product: P.P1.code, qty: 3 }];
const EDITED_DESC = `${DESC} (แก้)`;
const EDITED: SrLine[] = [{ product: P.P1.code, qty: 7 }];

test(
  "TC-SR-700001 Requestor สร้าง SR draft แล้วหลังบ้านเก็บคำอธิบายและรายการครบ",
  {
    annotation: [
      { type: "preconditions", description: "Login เป็น บัญชี Requestor (gmail); BU TEST (AVG); workflow Store Requisition ขั้น Create→Store Approval→Issue; E2E-DF-1 อยู่ทั้งสองคลังของคู่ doc-flow (data:reset)" },
      { type: "steps", description: "1. เปิด /store-operation/store-requisition/new\n2. เลือก workflow Store Requisition, Request From = คลังแรกของคู่ doc-flow, Deliver To = คลังที่สอง, ใส่คำอธิบาย\n3. Add Item: E2E-DF-1 × 3\n4. กด Save" },
      { type: "expected", description: "Save ตอบ < 300 และ URL เปลี่ยนเป็นหน้าใบ; หลังบ้าน doc_status = draft, description ตรง และรายการ E2E-DF-1×3" },
      { type: "priority", description: "High" },
      { type: "testType", description: "CRUD" },
      { type: "note", description: "เดิม SR.1 (_movement_play fe/03-sr) · TC-SR-010001/040001 ไม่ได้ assert อะไร · ครอบบางส่วนของ gap TC-SR-040101" },
    ],
  },
  async ({ page }) => {
    await gotoBu(page, "/store-operation/store-requisition/new", BU);
    await fillHeader(page, DESC);
    for (const l of LINES) await addLine(page, l);
    const r = await saveAndWait(page);
    expect(r.status, JSON.stringify(r.body).slice(0, 400)).toBeLessThan(300);
    draftId = r.body.data.id;
    await expect(page).toHaveURL(new RegExp(draftId));
    const sr = await srById(draftId);
    expect(sr.status).toBe("draft");
    expect(sr.desc).toBe(DESC);
    expect(fmt(sr.lines)).toBe(fmt(LINES));
    await observed(`${sr.no} · ${sr.status} · "${sr.desc}" · ${fmt(sr.lines)} · toast: ${(await toasts(page)).join(" / ") || "-"}`);
  },
);

test(
  "TC-SR-700002 Requestor เปิด SR draft แล้วเห็นคลังต้นทาง/ปลายทางและจำนวนตามที่บันทึก",
  {
    annotation: [
      { type: "preconditions", description: "TC-SR-700001 ผ่านแล้วในรอบเดียวกัน (serial) — มี SR draft บน TEST BU (AVG)" },
      { type: "steps", description: "1. เปิด /store-operation/store-requisition/<id> จากลิงก์ตรง\n2. อ่านช่องคำอธิบาย คลังต้นทาง/ปลายทาง และแถวรายการ" },
      { type: "expected", description: "ช่องคำอธิบายมีค่า FE-CRUD SR <stamp>; หน้าแสดงคลังต้นทาง/ปลายทางของคู่ doc-flow; แถว E2E-DF-1 มีจำนวน 3" },
      { type: "priority", description: "Medium" },
      { type: "testType", description: "CRUD" },
      { type: "note", description: "เดิม SR.2 · main ไม่มีเคสเปิดดู SR draft ที่ตรวจค่า" },
    ],
  },
  async ({ page }) => {
    await gotoBu(page, `/store-operation/store-requisition/${draftId}`, BU);
    await expect.poll(() => shownText(page)).toContain(DESC);
    await expect(page.getByText(FROM).first()).toBeVisible();
    await expect(page.getByText(TO).first()).toBeVisible();
    const seen: string[] = [];
    for (const l of LINES) {
      const row = itemRow(page, l.product);
      await expect(row).toBeVisible();
      const vals = await row.locator("input").evaluateAll((xs) => xs.map((x) => (x as HTMLInputElement).value));
      const all = `${(await row.innerText()).replace(/\s+/g, " ")} ${vals.join(" ")}`.replace(/,/g, "");
      expect(all, `${l.product} qty`).toMatch(numRe(l.qty));
      seen.push(`${l.product}: ${all.slice(0, 100)}`);
    }
    await observed(seen.join(" · "));
  },
);

test(
  "TC-SR-700003 Requestor แก้ SR draft (คำอธิบาย + จำนวน)",
  {
    annotation: [
      { type: "preconditions", description: "TC-SR-700001 ผ่านแล้วในรอบเดียวกัน (serial) — SR draft มี E2E-DF-1×3" },
      { type: "steps", description: "1. เปิดใบ แล้วกด Edit\n2. แก้คำอธิบายเป็น \"... (แก้)\"\n3. แก้จำนวน E2E-DF-1 3 → 7\n4. กด Save" },
      { type: "expected", description: "Save ตอบ < 300; หลังบ้านเก็บคำอธิบายใหม่ และรายการเป็น E2E-DF-1×7" },
      { type: "priority", description: "Medium" },
      { type: "testType", description: "CRUD" },
      { type: "note", description: "เดิม SR.3 · ครอบบางส่วนของ gap TC-SR-040103 · ยังไม่ทดสอบลบ/เพิ่มรายการ" },
    ],
  },
  async ({ page }) => {
    await gotoBu(page, `/store-operation/store-requisition/${draftId}`, BU);
    await button(page, "Edit").click();
    await page.locator("#sr-description").fill(EDITED_DESC);
    await typeInto(itemRow(page, P.P1.code).locator('input[name$=".requested_qty"]'), 7);
    const r = await saveAndWait(page);
    expect(r.status, JSON.stringify(r.body).slice(0, 400)).toBeLessThan(300);
    await expect.poll(async () => fmt((await srById(draftId)).lines), { timeout: 15_000 }).toBe(fmt(EDITED));
    const sr = await srById(draftId);
    expect(sr.desc).toBe(EDITED_DESC);
    await observed(`${sr.no} · "${sr.desc}" · ${fmt(sr.lines)} · toast: ${(await toasts(page)).join(" / ") || "-"}`);
  },
);

test(
  "TC-SR-700004 Requestor ลบ SR draft จากโหมดแก้แล้วใบหายจากหลังบ้าน",
  {
    annotation: [
      { type: "preconditions", description: "TC-SR-700001 ผ่านแล้วในรอบเดียวกัน (serial) — SR draft ยังอยู่" },
      { type: "steps", description: "1. เปิดใบ แล้วกด Edit (ปุ่ม Delete ของ SR มีเฉพาะโหมดแก้)\n2. กด Delete ตัวแรก (ของหัวใบ)\n3. ยืนยัน Delete ใน dialog" },
      { type: "expected", description: "GET ใบนั้นไม่พบแล้ว และหน้าจอออกจาก URL ของใบกลับไปหน้ารายการ" },
      { type: "priority", description: "Medium" },
      { type: "testType", description: "CRUD" },
      { type: "note", description: "เดิม SR.4 · ครอบ gap TC-SR-040106 (ยังไม่ได้ตรวจข้อความ dialog / toast)" },
    ],
  },
  async ({ page, signals }) => {
    signals.minor(new RegExp(`GET .*/store-requisitions/${draftId} → 404`), "refetch of the just-deleted document");
    await gotoBu(page, `/store-operation/store-requisition/${draftId}`, BU);
    // SR shows Delete in edit mode only (PR/PO show it in view mode); the first one is the header's.
    await button(page, "Edit").click();
    await button(page, "Delete").first().click();
    const dlg = page.locator("[role=alertdialog]:visible, [role=dialog]:visible").last();
    await dlg.getByRole("button", { name: /^delete$/i }).last().click();
    await expect.poll(async () => (await srById(draftId)).status, { timeout: 30_000 }).toBe("deleted");
    await expect(page).not.toHaveURL(new RegExp(draftId), { timeout: 15_000 });
    await observed(`deleted · ${page.url().replace(/^https?:\/\/[^/]+/, "")} · toast: ${(await toasts(page)).join(" / ") || "-"}`);
  },
);

test(
  "TC-SR-700005 Requestor สร้าง SR แล้ว Submit ได้เลขจริงและไปขั้น Store Approval",
  {
    annotation: [
      { type: "preconditions", description: "Login เป็นบัญชี Requestor (gmail); BU TEST (AVG); workflow Store Requisition ขั้น Create→Store Approval→Issue ขั้นแรกคือ Store Approval (ไม่มีขั้น HOD)" },
      { type: "steps", description: "1. สร้าง SR ใหม่ 1 รายการ E2E-DF-1 × 1 แล้วกด Save\n2. กด Submit ที่หน้าใบ\n3. ยืนยันใน dialog\n4. ถ้าระบบถาม \"Which date should this carry?\" (วันนี้อยู่นอกงวด active) เลือก \"inside the open period\"" },
      { type: "expected", description: "คำตอบสุดท้ายของ submit < 300; หลังบ้าน doc_status = in_progress, sr_no ไม่ขึ้นต้นด้วย draft และ workflow_current_stage = Store Approval" },
      { type: "priority", description: "High" },
      { type: "testType", description: "Functional" },
      { type: "note", description: "เดิม SR.5 · TC-SR-050001 หาปุ่ม \"submit for approval\" ซึ่งไม่มีแล้ว จึง skip ทุกรอบ — ปุ่มจริงชื่อ Submit · 422 *_DATE_PATTERN_REQUIRED รอบแรกเป็นพฤติกรรมที่ตั้งใจ" },
    ],
  },
  async ({ page, signals }) => {
    signals.expectApiError(/\/store-requisitions\/.+\/submit → 422/);
    const line: SrLine = { product: P.P1.code, qty: 1 };
    await gotoBu(page, "/store-operation/store-requisition/new", BU);
    await fillHeader(page, `${DESC} submit`);
    await addLine(page, line);
    const r = await saveAndWait(page);
    expect(r.status, JSON.stringify(r.body).slice(0, 400)).toBeLessThan(300);
    const id = r.body.data.id;
    await expect(page).toHaveURL(new RegExp(id));
    const submitted = page.waitForResponse((x) => /\/store-requisitions\/.+\/submit/.test(x.url()), { timeout: 60_000 });
    await button(page, "Submit").first().click();
    const dlg = page.locator("[role=alertdialog]:visible").last();
    await expect(dlg).toBeVisible();
    const dialogText = (await dlg.innerText()).replace(/\s+/g, " ");
    // Today outside the active period → the dialog itself asks which date to use (Submit stays disabled until chosen).
    const askedInDialog = await chooseDateInDialog(dlg);
    await dlg.getByRole("button", { name: /submit|confirm|ยืนยัน|ส่ง/i }).last().click();
    const q = await answerSrDateQuestion(page, await submitted, /\/store-requisitions\/.+\/submit/);
    expect(q.res.status(), JSON.stringify(q.body).slice(0, 300)).toBeLessThan(300);
    await expect.poll(async () => (await srById(id)).status, { timeout: 30_000 }).toBe("in_progress");
    const sr = await srById(id);
    expect(sr.no).not.toMatch(/^draft/i);
    expect(sr.stage).toBe("Store Approval");
    await observed(
      `${sr.no} · ${sr.status} · stage ${sr.stage} · date question: ${askedInDialog ? "asked in the dialog" : q.asked ? `asked (${q.code})` : "not asked"} · ${fmt(sr.lines)} · dialog: "${dialogText.slice(0, 160)}"`,
    );
  },
);
