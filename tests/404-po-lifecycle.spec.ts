import type { Page } from "@playwright/test";
import { test, gotoBu, expect, observed } from "./fixtures/doc-flow.fixture";
import { BU_CODE } from "./test-users";
import { buSend } from "./helpers/bu-api";
import { dfGet } from "./helpers/doc-flow/api";
import { DF, firstVendor, itemRow, srLocations, stamp } from "./helpers/doc-flow/data";
import {
  addRow,
  button,
  confirmDialog,
  field,
  shownText,
  numRe,
  pickDate,
  pickLookup,
  pickSelectIn,
  toasts,
  typeInto,
} from "./helpers/movement/ui";

/**
 * PO lifecycle — doc-flow suite on the TEST BU (AVG), gmail accounts.
 * BU-GR2VYNKQ · Purchase · workflow "General PO" · first vendor · products E2E-DF-1..4 · location read at run time.
 * draft → view → edit (header + qty/price + remove line + add line) → delete → new + Submit.
 *
 * The creator is Purchase because the seeded "General PO" workflow's "Create Request" stage
 * assigns only purchase (TC-PO-010002/020002 assert the requestor cannot create a PO).
 * Origin: `_movement_play/eop_bf/e2e/fe/02-po.spec.ts` (PO.1–PO.5).
 */
const BU = BU_CODE;
const WF = "General PO";
const DELIVERY = "2026-10-20";
let LOC = "";
let VENDOR = "";
test.use({ role: "Purchase", bu: BU_CODE });
test.describe.configure({ mode: "serial", retries: 0 });
test.setTimeout(300_000);

test.beforeAll(async () => {
  LOC = (await srLocations(BU)).from;
  VENDOR = (await firstVendor(BU)).code;
});

/**
 * Cleanup by description stamp, read from the API (not from in-memory ids) so a failed case is
 * still cleaned. Drafts are deleted; the submitted PO is deleted too if the API allows it
 * (otherwise it stays in progress — reported, not failed).
 */
test.afterAll(async () => {
  test.setTimeout(180_000);
  try {
    const { status, body } = await dfGet(`/purchase-orders?search=${encodeURIComponent(DESC)}&perpage=100`, "Admin", BU);
    if (status !== 200) return;
    for (const d of (body?.data ?? []) as any[]) {
      if (!String(d.description ?? "").startsWith(DESC)) continue;
      const r = await buSend("Admin", "DELETE", `/purchase-orders/${d.id}`, undefined, BU);
      if (r.status >= 300) console.warn(`cleanup: PO ${d.po_no} (${d.po_status}) not deleted — HTTP ${r.status}`);
    }
  } catch (e) {
    console.warn("cleanup: PO", e);
  }
});

// Finding FE-1: the PO page calls previous-stages even for a draft (no stage yet) → certain 404.
// pr-form.tsx guards it with `enabled`; po-form.tsx calls usePoPreviousStages unguarded.
test.beforeEach(({ signals }) => signals.minor(/previous-stages → 404/, "FE-1 PO draft calls previous-stages before it has a stage"));

interface PoLine {
  product: string;
  qty: number;
  price: number;
}

async function poById(id: string) {
  const { status, body } = await dfGet(`/purchase-orders/${id}`, "Admin", BU);
  if (status !== 200) return { status: "deleted", no: "", desc: "", stage: "", lines: [] as PoLine[] };
  const d = body.data;
  return {
    status: d.po_status as string,
    no: d.po_no as string,
    desc: d.description as string,
    stage: d.workflow_current_stage as string,
    lines: (d.purchase_order_detail ?? d.details ?? []).map((x: any) => ({
      product: x.product?.code ?? x.product_code ?? x.product_sku,
      qty: Number(x.order_qty),
      price: Number(x.price),
    })) as PoLine[],
  };
}
const fmt = (ls: PoLine[]) => ls.map((l) => `${l.product}×${l.qty}@${l.price}`).sort().join(", ");

async function setLine(page: Page, line: PoLine) {
  const r = itemRow(page, line.product);
  await typeInto(r.locator('input[name$=".order_qty"]'), line.qty);
  await typeInto(r.locator('input[name$=".price"]'), line.price);
}

async function addLine(page: Page, line: PoLine) {
  const row = await addRow(page, "Select Product");
  const loc = row.getByRole("button", { name: "Select Location" });
  await expect(row.locator("td").nth(1)).toContainText(new RegExp(`Select Location|${LOC}`));
  if (await loc.count()) await pickLookup(page, loc, LOC);
  await expect(row).toContainText(LOC);
  await pickLookup(page, row.getByRole("button", { name: "Select Product" }), line.product);
  await setLine(page, line);
}

async function saveAndWait(page: Page) {
  const resp = page.waitForResponse(
    (r) => /\/purchase-orders/.test(r.url()) && !["GET", "OPTIONS"].includes(r.request().method()),
    { timeout: 60_000 },
  );
  await button(page, "Save").first().click();
  const r = await resp;
  return { status: r.status(), body: await r.json().catch(() => ({})) };
}

async function fillHeader(page: Page, desc: string) {
  await pickSelectIn(page, "Workflow", WF);
  await pickLookup(page, field(page, "Vendor").locator("button").first(), VENDOR);
  expect(await pickDate(page, field(page, "Delivery Date").locator("button").first(), DELIVERY), `Delivery Date ${DELIVERY}`).toBe(true);
  await page.locator("#po-description").fill(desc);
}

let draftId = "";
const LINES: PoLine[] = [
  { product: DF.P1.code, qty: 3, price: 12.5 },
  { product: DF.P2.code, qty: 5, price: 20 },
];
const DESC = `FE-CRUD PO ${stamp}`;
const EDITED_DESC = `${DESC} (แก้)`;
const EDITED: PoLine[] = [
  { product: DF.P1.code, qty: 7, price: 15 },
  { product: DF.P3.code, qty: 2, price: 30 },
];

test(
  "TC-PO-700001 Purchase สร้าง PO draft แล้วหลังบ้านเก็บจำนวนและราคาครบ",
  {
    annotation: [
      { type: "preconditions", description: "Login เป็น carmensoftware.dev+purchase@gmail.com; BU TEST (AVG) BU-GR2VYNKQ; workflow \"General PO\" ขั้น Create Request มี purchase; มีผู้ขายที่ active (ใช้ตัวแรกตาม code); สินค้า E2E-DF-1..4 มาจาก data:reset" },
      { type: "steps", description: "1. เปิด /procurement/purchase-order/new\n2. เลือก workflow \"General PO\", ผู้ขายตัวแรก, Delivery Date 2026-10-20, ใส่คำอธิบาย\n3. Add Item 2 รายการที่คลังแรกของคู่ doc-flow: E2E-DF-1 × 3 @12.5, E2E-DF-2 × 5 @20\n4. กด Save" },
      { type: "expected", description: "Save ตอบ < 300 และ URL เปลี่ยนเป็นหน้าใบ; หลังบ้าน po_status = draft, description ตรง, รายการ E2E-DF-1×3@12.5 และ E2E-DF-2×5@20" },
      { type: "priority", description: "High" },
      { type: "testType", description: "CRUD" },
      { type: "note", description: "เดิม PO.1 (_movement_play fe/02-po) · ซ้อนกับ TC-PO-060203 ที่ตรวจแค่ URL/toast · ราคากรอกด้วย typeInto (fill() ทำให้ \"18.00\" กลายเป็น \"1821\")" },
    ],
  },
  async ({ page }) => {
    await gotoBu(page, "/procurement/purchase-order/new", BU);
    await fillHeader(page, DESC);
    for (const l of LINES) await addLine(page, l);
    const r = await saveAndWait(page);
    expect(r.status, JSON.stringify(r.body).slice(0, 400)).toBeLessThan(300);
    draftId = r.body.data.id;
    await expect(page).toHaveURL(new RegExp(draftId));
    const po = await poById(draftId);
    expect(po.status).toBe("draft");
    expect(po.desc).toBe(DESC);
    expect(fmt(po.lines)).toBe(fmt(LINES));
    await observed(`${po.no} · ${po.status} · "${po.desc}" · ${fmt(po.lines)} · toast: ${(await toasts(page)).join(" / ") || "-"}`);
  },
);

test(
  "TC-PO-700002 Purchase เปิด PO draft แล้วเห็นจำนวนและราคาตามที่บันทึก",
  {
    annotation: [
      { type: "preconditions", description: "TC-PO-700001 ผ่านแล้วในรอบเดียวกัน (serial) — มี PO draft บน BU-GR2VYNKQ" },
      { type: "steps", description: "1. เปิด /procurement/purchase-order/<id> จากลิงก์ตรง\n2. อ่านช่องคำอธิบาย และข้อความ/ค่าในแถวของแต่ละสินค้า" },
      { type: "expected", description: "ช่องคำอธิบายมีค่า FE-CRUD PO <stamp>; แถว E2E-DF-1 มีจำนวน 3 และราคา 12.5; แถว E2E-DF-2 มีจำนวน 5 และราคา 20" },
      { type: "priority", description: "Medium" },
      { type: "testType", description: "CRUD" },
      { type: "note", description: "เดิม PO.2 · TC-PO-060301 ตรวจแค่ URL" },
    ],
  },
  async ({ page }) => {
    await gotoBu(page, `/procurement/purchase-order/${draftId}`, BU);
    await expect.poll(() => shownText(page)).toContain(DESC);
    const seen: string[] = [];
    for (const l of LINES) {
      const row = itemRow(page, l.product);
      await expect(row).toBeVisible();
      const text = (await row.innerText()).replace(/\s+/g, " ");
      const vals = await row.locator("input").evaluateAll((xs) => xs.map((x) => (x as HTMLInputElement).value));
      const all = `${text} ${vals.join(" ")}`;
      expect(all, `${l.product} qty`).toMatch(numRe(l.qty));
      expect(all, `${l.product} price`).toMatch(numRe(l.price));
      seen.push(`${l.product}: ${all.slice(0, 120)}`);
    }
    await observed(seen.join(" · "));
  },
);

test(
  "TC-PO-700003 Purchase แก้ PO draft (หัว + จำนวน/ราคา + ลบรายการ + เพิ่มรายการ)",
  {
    annotation: [
      { type: "preconditions", description: "TC-PO-700001 ผ่านแล้วในรอบเดียวกัน (serial) — PO draft มี E2E-DF-1×3@12.5, E2E-DF-2×5@20" },
      { type: "steps", description: "1. เปิดใบ แล้วกด Edit\n2. แก้คำอธิบายเป็น \"... (แก้)\"\n3. E2E-DF-1 3@12.5 → 7@15\n4. ลบ E2E-DF-2 ด้วยปุ่ม \"Remove this product\" ในแถวคอมเมนต์ใต้รายการ\n5. Add Item: E2E-DF-3 2@30\n6. กด Save" },
      { type: "expected", description: "Save ตอบ < 300; หลังบ้านเก็บคำอธิบายใหม่ และรายการเหลือ E2E-DF-1×7@15, E2E-DF-3×2@30" },
      { type: "priority", description: "High" },
      { type: "testType", description: "CRUD" },
      { type: "note", description: "เดิม PO.3 · TC-PO-060402/060403 หาช่องจำนวนจาก label (ถ้าไม่เจอก็ผ่านเงียบ) และตรวจแค่ URL" },
    ],
  },
  async ({ page }) => {
    await gotoBu(page, `/procurement/purchase-order/${draftId}`, BU);
    await button(page, "Edit").click();
    await page.locator("#po-description").fill(EDITED_DESC);
    await setLine(page, EDITED[0]);
    // The remove button lives in the comment row under each line — find that product's row, then the next one.
    const idx = await page
      .locator("table tbody tr")
      .evaluateAll(
        (trs, [code, name]) =>
          trs.findIndex((tr) => (tr.textContent ?? "").includes(code) || (tr.textContent ?? "").replace(/\s/g, " ").includes(name)),
        [DF.P2.code, DF.P2.name],
      );
    await page.locator("table tbody tr").nth(idx + 1).getByRole("button", { name: /Remove this product/ }).click();
    if (await page.locator("[role=alertdialog]:visible").count()) await confirmDialog(page, /remove|delete|confirm|ลบ/i);
    await expect(itemRow(page, DF.P2.code)).toHaveCount(0);
    await addLine(page, EDITED[1]);
    const r = await saveAndWait(page);
    expect(r.status, JSON.stringify(r.body).slice(0, 400)).toBeLessThan(300);
    await expect.poll(async () => fmt((await poById(draftId)).lines), { timeout: 15_000 }).toBe(fmt(EDITED));
    const po = await poById(draftId);
    expect(po.desc).toBe(EDITED_DESC);
    await observed(`${po.no} · "${po.desc}" · ${fmt(po.lines)} · toast: ${(await toasts(page)).join(" / ") || "-"}`);
  },
);

test(
  "TC-PO-700004 Purchase ลบ PO draft จากโหมดดูแล้วใบหายจากหลังบ้าน",
  {
    annotation: [
      { type: "preconditions", description: "TC-PO-700001 ผ่านแล้วในรอบเดียวกัน (serial) — PO draft ยังอยู่" },
      { type: "steps", description: "1. เปิดใบ (โหมดดู)\n2. กด Delete\n3. ยืนยัน Delete ใน dialog" },
      { type: "expected", description: "GET ใบนั้นไม่พบแล้ว และหน้าจอออกจาก URL ของใบกลับไปหน้ารายการ" },
      { type: "priority", description: "Medium" },
      { type: "testType", description: "CRUD" },
      { type: "note", description: "เดิม PO.4 · main ไม่มีเคสลบ PO draft (TC-PO-060406 ลบใบ In Progress และ skip ทุกรอบ) · ยืนยันว่า Delete ของ PO draft อยู่ในโหมดดู" },
    ],
  },
  async ({ page, signals }) => {
    signals.minor(new RegExp(`GET .*/purchase-orders/${draftId} → 404`), "refetch of the just-deleted document");
    await gotoBu(page, `/procurement/purchase-order/${draftId}`, BU);
    await button(page, "Delete").first().click();
    await confirmDialog(page, /^delete$/i);
    await expect.poll(async () => (await poById(draftId)).status, { timeout: 30_000 }).toBe("deleted");
    await expect(page).not.toHaveURL(new RegExp(draftId), { timeout: 15_000 });
    await observed(`deleted · ${page.url().replace(/^https?:\/\/[^/]+/, "")} · toast: ${(await toasts(page)).join(" / ") || "-"}`);
  },
);

test(
  "TC-PO-700005 Purchase สร้าง PO แล้ว Submit ได้เลขจริงและไปขั้น FC Approval",
  {
    annotation: [
      { type: "preconditions", description: "Login เป็น carmensoftware.dev+purchase@gmail.com; BU BU-GR2VYNKQ; workflow \"General PO\" ขั้นแรก Create Request แล้วต่อด้วย FC Approval" },
      { type: "steps", description: "1. สร้าง PO ใหม่ 1 รายการ E2E-DF-4 × 4 @10 แล้วกด Save\n2. กด Submit ที่หน้าใบ\n3. ยืนยันใน dialog (ถ้ามี)" },
      { type: "expected", description: "คำขอ submit ตอบ < 300; หลังบ้าน po_status = in_progress, po_no ไม่ขึ้นต้นด้วย draft และ workflow_current_stage = FC Approval" },
      { type: "priority", description: "High" },
      { type: "testType", description: "Functional" },
      { type: "note", description: "เดิม PO.5 · TC-PO-060405/060901 ตรวจแค่ URL" },
    ],
  },
  async ({ page }) => {
    const line: PoLine = { product: DF.P4.code, qty: 4, price: 10 };
    await gotoBu(page, "/procurement/purchase-order/new", BU);
    await fillHeader(page, `${DESC} submit`);
    await addLine(page, line);
    const r = await saveAndWait(page);
    expect(r.status, JSON.stringify(r.body).slice(0, 400)).toBeLessThan(300);
    const id = r.body.data.id;
    await expect(page).toHaveURL(new RegExp(id));
    const submitted = page.waitForResponse((x) => /\/purchase-orders\/.+\/submit/.test(x.url()), { timeout: 60_000 });
    await button(page, "Submit").first().click();
    if (await page.locator("[role=alertdialog]:visible, [role=dialog]:visible").count()) {
      await confirmDialog(page, /submit|confirm|ยืนยัน/i);
    }
    const s = await submitted;
    expect(s.status(), (await s.text()).slice(0, 300)).toBeLessThan(300);
    await expect.poll(async () => (await poById(id)).status, { timeout: 30_000 }).toBe("in_progress");
    const po = await poById(id);
    expect(po.no).not.toMatch(/^draft/);
    expect(po.stage).toBe("FC Approval");
    await observed(`${po.no} · ${po.status} · stage ${po.stage} · ${fmt(po.lines)} · toast: ${(await toasts(page)).join(" / ") || "-"}`);
  },
);
