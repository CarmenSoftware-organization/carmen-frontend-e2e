import type { Page } from "@playwright/test";
import { test, gotoBu, expect, observed } from "./fixtures/doc-flow.fixture";
import { BU_CODE } from "./test-users";
import { buSend } from "./helpers/bu-api";
import { dfGet } from "./helpers/doc-flow/api";
import { DF, itemRow, srLocations, stamp } from "./helpers/doc-flow/data";
import { addRow, button, confirmDialog, numRe, shownText, pickLookup, pickSelectIn, toasts, typeInto } from "./helpers/movement/ui";

/**
 * PR lifecycle — doc-flow suite on the TEST BU (AVG), gmail accounts.
 * BU-GR2VYNKQ · Requestor · workflow "Purchase Request" · products E2E-DF-1..4 · location read at run time.
 * draft → view → edit (header + qty + remove line + add line) → delete → new + Submit.
 * Every step is verified in the backend (API), and the doc-flow fixture fails the
 * case on any page error or unexpected API >= 400.
 *
 * Unlike TC-PR-050209 / 050803 (302-pr-creator-journey, which check the redirect or toast),
 * these read back what was stored. Needs the doc-flow step of `bun run data:reset`.
 * Origin: `_movement_play/eop_bf/e2e/fe/01-pr.spec.ts` (PR.1–PR.5).
 */
const BU = BU_CODE;
const WF = "Purchase Request";
let LOC = "";
test.use({ role: "Requestor", bu: BU_CODE });
test.describe.configure({ mode: "serial", retries: 0 });
test.setTimeout(300_000);

test.beforeAll(async () => {
  LOC = (await srLocations(BU)).from;
});

/**
 * Cleanup by description stamp, read from the API (not from in-memory ids) so a failed case is
 * still cleaned. Only drafts can be deleted; the submitted PR is left in progress
 * (warned) until the next data:reset. Failures throw so the hook fails visibly.
 */
test.afterAll(async () => {
  test.setTimeout(180_000);
  const { status, body } = await dfGet(`/purchase-requests?search=${encodeURIComponent(DESC)}&perpage=100`, "Admin", BU);
  if (status !== 200) throw new Error(`cleanup: list purchase-requests HTTP ${status} ${JSON.stringify(body).slice(0, 300)}`);
  const failures: string[] = [];
  for (const d of (body?.data ?? []) as any[]) {
    if (!String(d.description ?? "").startsWith(DESC)) continue;
    if (d.pr_status !== "draft") {
      // only drafts can be deleted (no cancel endpoint) — submitted docs wait for the next data:reset
      console.warn(`cleanup: left ${d.pr_no} in ${d.pr_status} until next data:reset`);
      continue;
    }
    const r = await buSend("Admin", "DELETE", `/purchase-requests/${d.id}`, undefined, BU);
    if (r.status >= 300) failures.push(`${d.pr_no ?? d.id} HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
  }
  if (failures.length) throw new Error(`cleanup: PR draft(s) not deleted: ${failures.join(" | ")}`);
});

interface PrLine {
  product: string;
  qty: number;
}

async function prById(id: string) {
  const { status, body } = await dfGet(`/purchase-requests/${id}`, "Admin", BU);
  if (status !== 200) return { status: "deleted", no: "", desc: "", stage: "", lines: [] as PrLine[] };
  const d = body.data;
  return {
    status: d.pr_status as string,
    no: d.pr_no as string,
    desc: d.description as string,
    stage: d.workflow_current_stage as string,
    lines: (d.purchase_request_detail ?? []).map((x: any) => ({
      product: x.product?.code ?? x.product_sku,
      qty: Number(x.requested_qty),
    })) as PrLine[],
  };
}
const fmt = (ls: PrLine[]) => ls.map((l) => `${l.product}×${l.qty}`).sort().join(", ");

/** Add Item, then fill the new row. */
async function addLine(page: Page, line: PrLine) {
  // The new row lands on top and copies the previous row's location — pick one only while empty.
  const row = await addRow(page, "Select Product");
  const loc = row.getByRole("button", { name: "Select Location" });
  await expect(row.locator("td").nth(1)).toContainText(new RegExp(`Select Location|${LOC}`));
  if (await loc.count()) await pickLookup(page, loc, LOC);
  await expect(row).toContainText(LOC);
  await pickLookup(page, row.locator("td").nth(2).locator("button").first(), line.product);
  await typeInto(itemRow(page, line.product).locator('input[name$=".requested_qty"]'), line.qty);
}

async function saveAndWait(page: Page, method: "POST" | "any" = "any") {
  const resp = page.waitForResponse(
    (r) =>
      /\/purchase-requests/.test(r.url()) &&
      r.request().method() !== "GET" &&
      (method === "any" || r.request().method() === method),
    { timeout: 60_000 },
  );
  await button(page, "Save").first().click();
  const r = await resp;
  return { status: r.status(), body: await r.json().catch(() => ({})) };
}

let draftId = "";
const LINES: PrLine[] = [
  { product: DF.P1.code, qty: 3 },
  { product: DF.P2.code, qty: 5 },
];
const DESC = `FE-CRUD PR ${stamp}`;
const EDITED_DESC = `${DESC} (แก้)`;
const EDITED: PrLine[] = [
  { product: DF.P1.code, qty: 7 },
  { product: DF.P3.code, qty: 2 },
];

test(
  "TC-PR-700001 Requestor สร้าง PR draft แล้วหลังบ้านเก็บคำอธิบายและรายการครบ",
  {
    annotation: [
      { type: "preconditions", description: "Login เป็น carmensoftware.dev+requestor@gmail.com; BU TEST (AVG) BU-GR2VYNKQ; workflow \"Purchase Request\" (ขั้น Create Request มี requestor); สินค้า E2E-DF-1..4 มาจาก data:reset และมีคลังคู่ doc-flow" },
      { type: "steps", description: "1. เปิด /procurement/purchase-request/new\n2. เลือก workflow \"Purchase Request\" และใส่คำอธิบาย FE-CRUD PR <stamp>\n3. Add Item 2 รายการที่คลังแรกของคู่ doc-flow: E2E-DF-1 × 3, E2E-DF-2 × 5\n4. กด Save" },
      { type: "expected", description: "POST ตอบ < 300 และ URL เปลี่ยนเป็น /procurement/purchase-request/<id>; GET /api/BU-GR2VYNKQ/purchase-requests/<id> ได้ pr_status = draft, description ตรงที่กรอก และรายการ E2E-DF-1×3, E2E-DF-2×5" },
      { type: "priority", description: "High" },
      { type: "testType", description: "CRUD" },
      { type: "note", description: "เดิม PR.1 (_movement_play fe/01-pr) · ซ้อนกับ TC-PR-050209 ที่ตรวจแค่ redirect — เคสนี้ตรวจค่าที่หลังบ้านเก็บ" },
    ],
  },
  async ({ page }) => {
    await gotoBu(page, "/procurement/purchase-request/new", BU);
    await pickSelectIn(page, "Workflow", WF);
    await page.locator("#pr-description").fill(DESC);
    for (const l of LINES) await addLine(page, l);
    const r = await saveAndWait(page, "POST");
    expect(r.status, JSON.stringify(r.body).slice(0, 300)).toBeLessThan(300);
    draftId = r.body.data.id;
    await expect(page).toHaveURL(new RegExp(draftId));
    const pr = await prById(draftId);
    expect(pr.status).toBe("draft");
    expect(pr.desc).toBe(DESC);
    expect(fmt(pr.lines)).toBe(fmt(LINES));
    await observed(`${pr.no} · ${pr.status} · "${pr.desc}" · ${fmt(pr.lines)} · toast: ${(await toasts(page)).join(" / ") || "-"}`);
  },
);

test(
  "TC-PR-700002 Requestor เปิด PR draft แล้วเห็นคำอธิบายและรายการตามที่บันทึก",
  {
    annotation: [
      { type: "preconditions", description: "TC-PR-700001 ผ่านแล้วในรอบเดียวกัน (serial) — มี PR draft ของ requestor บน BU-GR2VYNKQ" },
      { type: "steps", description: "1. เปิด /procurement/purchase-request/<id> จากลิงก์ตรง\n2. อ่านช่องคำอธิบายและแถวรายการ" },
      { type: "expected", description: "ช่องคำอธิบายมีค่า FE-CRUD PR <stamp>; แถวของ E2E-DF-1 แสดงจำนวน 3 และแถวของ E2E-DF-2 แสดงจำนวน 5" },
      { type: "priority", description: "Medium" },
      { type: "testType", description: "CRUD" },
      { type: "note", description: "เดิม PR.2 · ครอบบางส่วนของ gap TC-PR-050715 (เปิดจากลิงก์ตรง ไม่ได้ตรวจคลัง)" },
    ],
  },
  async ({ page }) => {
    await gotoBu(page, `/procurement/purchase-request/${draftId}`, BU);
    await expect.poll(() => shownText(page)).toContain(DESC);
    const seen: string[] = [];
    for (const l of LINES) {
      const row = itemRow(page, l.product);
      await expect(row).toBeVisible();
      await expect(row).toContainText(numRe(l.qty));
      seen.push(`${l.product}: ${(await row.innerText()).replace(/\s+/g, " ").slice(0, 80)}`);
    }
    await observed(seen.join(" · "));
  },
);

test(
  "TC-PR-700003 Requestor แก้ PR draft (หัว + จำนวน + ลบรายการ + เพิ่มรายการ) ในการบันทึกครั้งเดียว",
  {
    annotation: [
      { type: "preconditions", description: "TC-PR-700001 ผ่านแล้วในรอบเดียวกัน (serial) — PR draft มี E2E-DF-1×3, E2E-DF-2×5" },
      { type: "steps", description: "1. เปิดใบ แล้วกด Edit\n2. แก้คำอธิบายเป็น \"FE-CRUD PR <stamp> (แก้)\"\n3. แก้ E2E-DF-1 จำนวน 3 → 7\n4. ลบแถว E2E-DF-2 (ยืนยันถ้ามี dialog)\n5. Add Item: E2E-DF-3 × 2\n6. กด Save" },
      { type: "expected", description: "Save ตอบ < 300; หลังบ้านเก็บคำอธิบายใหม่ และรายการเหลือ E2E-DF-1×7, E2E-DF-3×2 (แถวที่ลบหายจริง)" },
      { type: "priority", description: "High" },
      { type: "testType", description: "CRUD" },
      { type: "note", description: "เดิม PR.3 · TC-PR-050502/050503/050504 ตรวจแค่ URL และหาช่องจำนวนจาก label (ถ้าไม่เจอก็ผ่านเงียบ) — เคสนี้อ่านผลจากหลังบ้าน" },
    ],
  },
  async ({ page }) => {
    await gotoBu(page, `/procurement/purchase-request/${draftId}`, BU);
    await button(page, "Edit").click();
    await page.locator("#pr-description").fill(EDITED_DESC);
    await typeInto(itemRow(page, DF.P1.code).locator('input[name$=".requested_qty"]'), 7);
    await itemRow(page, DF.P2.code).getByRole("button", { name: "Remove" }).click();
    if (await page.locator("[role=alertdialog]:visible").count()) await confirmDialog(page, /remove|delete|confirm|ลบ/i);
    await expect(itemRow(page, DF.P2.code)).toHaveCount(0);
    await addLine(page, EDITED[1]);
    const r = await saveAndWait(page);
    test.fail(true, "suspected bug: PATCH of a Draft with an added line -> 400 'Argument is_tax_included is missing' (BE update/add path) - bisected by replaying PATCH .../save: a line carrying BOTH pricelist_detail_id:null AND is_tax_included fails, dropping either key gives 200; FE 76ec45e4 (2026-11-09) added is_tax_included to the payload, BE schema 1ac85b1ae (2026-11-09) has the column and dev runs build f529576a9 (2026-11-13), so this is not a not-yet-deployed change; same cluster as the pins in the 301/302/311 PR specs");
    expect(r.status, JSON.stringify(r.body).slice(0, 300)).toBeLessThan(300);
    await expect.poll(async () => fmt((await prById(draftId)).lines), { timeout: 15_000 }).toBe(fmt(EDITED));
    const pr = await prById(draftId);
    expect(pr.desc).toBe(EDITED_DESC);
    await observed(`${pr.no} · "${pr.desc}" · ${fmt(pr.lines)} · toast: ${(await toasts(page)).join(" / ") || "-"}`);
  },
);

test(
  "TC-PR-700004 Requestor ลบ PR draft แล้วใบหายจากหลังบ้าน",
  {
    annotation: [
      { type: "preconditions", description: "TC-PR-700001 ผ่านแล้วในรอบเดียวกัน (serial) — PR draft ยังอยู่" },
      { type: "steps", description: "1. เปิดใบ\n2. กด Delete (โหมดดู)\n3. ยืนยัน Delete ใน dialog" },
      { type: "expected", description: "GET ใบนั้นไม่พบแล้ว (ไม่ใช่ 200) และหน้าจอออกจาก URL ของใบกลับไปหน้ารายการ" },
      { type: "priority", description: "Medium" },
      { type: "testType", description: "CRUD" },
      { type: "note", description: "เดิม PR.4 · ซ้อนกับ TC-PR-050803 ที่ไม่ได้ตรวจหลังบ้าน · การดึงใบที่เพิ่งลบซ้ำ (404) บันทึกเป็นข้อค้นพบเล็ก ไม่ทำให้เคสล้ม" },
    ],
  },
  async ({ page, signals }) => {
    signals.minor(new RegExp(`GET .*/purchase-requests/${draftId} → 404`), "refetch of the just-deleted document");
    await gotoBu(page, `/procurement/purchase-request/${draftId}`, BU);
    await button(page, "Delete").first().click();
    await confirmDialog(page, /^delete$/i);
    await expect.poll(async () => (await prById(draftId)).status, { timeout: 30_000 }).toBe("deleted");
    await expect(page).not.toHaveURL(new RegExp(draftId), { timeout: 15_000 });
    await observed(`deleted · ${page.url().replace(/^https?:\/\/[^/]+/, "")} · toast: ${(await toasts(page)).join(" / ") || "-"}`);
  },
);

test(
  "TC-PR-700005 Requestor สร้าง PR แล้ว Submit ได้เลขจริงและไปขั้น HOD Approval",
  {
    annotation: [
      { type: "preconditions", description: "Login เป็น carmensoftware.dev+requestor@gmail.com; BU BU-GR2VYNKQ; workflow \"Purchase Request\" ขั้นแรก Create Request แล้วต่อด้วย \"HOD Approval\"" },
      { type: "steps", description: "1. สร้าง PR ใหม่ 1 รายการ E2E-DF-4 × 4 แล้วกด Save\n2. กด Submit ที่หน้าใบ\n3. ยืนยันใน dialog (ถ้ามี)" },
      { type: "expected", description: "คำขอ submit ตอบ < 300; หลังบ้าน pr_status = in_progress, pr_no ไม่ขึ้นต้นด้วย draft และ workflow_current_stage = \"HOD Approval\"" },
      { type: "priority", description: "High" },
      { type: "testType", description: "Functional" },
      { type: "note", description: "เดิม PR.5 · TC-PR-050603/050901 ตรวจแค่ redirect/toast" },
    ],
  },
  async ({ page }) => {
    const line: PrLine = { product: DF.P4.code, qty: 4 };
    await gotoBu(page, "/procurement/purchase-request/new", BU);
    await pickSelectIn(page, "Workflow", WF);
    await page.locator("#pr-description").fill(`${DESC} submit`);
    await addLine(page, line);
    const r = await saveAndWait(page, "POST");
    expect(r.status, JSON.stringify(r.body).slice(0, 300)).toBeLessThan(300);
    const id = r.body.data.id;
    await expect(page).toHaveURL(new RegExp(id));
    const submitted = page.waitForResponse((x) => /\/purchase-requests\/.+\/submit/.test(x.url()), { timeout: 60_000 });
    await button(page, "Submit").first().click();
    if (await page.locator("[role=alertdialog]:visible, [role=dialog]:visible").count()) {
      await confirmDialog(page, /submit|confirm|ยืนยัน/i);
    }
    const s = await submitted;
    expect(s.status(), (await s.text()).slice(0, 300)).toBeLessThan(300);
    await expect.poll(async () => (await prById(id)).status, { timeout: 30_000 }).toBe("in_progress");
    const pr = await prById(id);
    expect(pr.no).not.toMatch(/^draft/);
    expect(pr.stage).toBe("HOD Approval");
    await observed(`${pr.no} · ${pr.status} · stage ${pr.stage} · ${fmt(pr.lines)} · toast: ${(await toasts(page)).join(" / ") || "-"}`);
  },
);
