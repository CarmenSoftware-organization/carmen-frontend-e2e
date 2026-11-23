import type { Page } from "@playwright/test";
import { test, gotoBu, expect, observed } from "./fixtures/movement.fixture";
import { apiGet, txOfDoc } from "./helpers/movement/api";
import { createGrn } from "./helpers/movement/docs";
import { addRow, button, confirmDialog, inputValues, numRe, pickLookup, toasts, typeInto } from "./helpers/movement/ui";
import { DOC_FLOW_BU as BU, DOC_FLOW_ROLE, PROD as P, activePeriodDate, itemRow, stamp } from "./helpers/movement/doc-flow";

/**
 * GRN doc flow (manual GRN) — movement suite (opt-in: `bun run test:movement`).
 * CARMEN-AVG · requestor · vendor C010 · location LCX013 · dated inside the active period.
 * draft → view → edit (invoice no. + qty/price + remove line + add line) → delete → new + Create (saved).
 *
 * AVG posts stock when a GRN is SAVED (FIFO waits for commit) — TC-GRN-700005
 * asserts that. TC-GRN-140003 in 501-grn ("no stock movements before commit")
 * says the opposite for BLAVG; one of them is stale and needs a decision from
 * the backend team before either is changed.
 * Origin: `_movement_play/eop_bf/e2e/fe/04-grn.spec.ts` (GRN.1–GRN.5).
 */
const { user: USER, loc: LOC } = DOC_FLOW_ROLE.grn;
test.use({ user: USER, bu: BU });
test.describe.configure({ mode: "serial" });

interface GrnLine {
  product: string;
  qty: number;
  price: number;
}

async function grnById(id: string) {
  const { status, body } = await apiGet(`/api/${BU}/good-received-notes/${id}`);
  if (status !== 200 || !body?.data) return { status: "deleted", no: "", invoice: "", lines: [] as GrnLine[] };
  const d = body.data;
  return {
    status: d.doc_status as string,
    no: d.grn_no as string,
    invoice: d.invoice_no as string,
    lines: (d.good_received_note_detail ?? []).flatMap((x: any) =>
      (x.items ?? []).map((i: any) => ({ product: x.product?.code, qty: Number(i.received_qty), price: Number(i.received_price) })),
    ) as GrnLine[],
  };
}
const fmt = (ls: GrnLine[]) => ls.map((l) => `${l.product}×${l.qty}@${l.price}`).sort().join(", ");

/** Add a row in edit mode — new rows land on top and copy the previous row's location (as on create). */
async function addLine(page: Page, line: GrnLine) {
  const row = await addRow(page, "Select Product");
  await expect(row.locator("button").first()).not.toHaveText(/^\s*$/);
  const loc = row.getByRole("button", { name: "Select Location" });
  if (await loc.count()) await pickLookup(page, loc, LOC);
  await expect(row).toContainText(LOC);
  await pickLookup(page, row.getByRole("button", { name: "Select Product" }), line.product);
  await typeInto(row.locator('input[name$=".received_qty"]'), line.qty);
  const unit = row.getByRole("button", { name: "Select Unit" }).first();
  if (await unit.isVisible().catch(() => false)) {
    await unit.click();
    await page.locator("[data-slot=popover-content]:visible button[data-value], [data-slot=select-item], [role=option]").first().click();
  }
  await typeInto(row.locator('input[placeholder="0.00"]').first(), line.price);
}

let TODAY = "";
let draftId = "";
const LINES: GrnLine[] = [
  { product: P.P1.code, qty: 3, price: 100 },
  { product: P.P2.code, qty: 5, price: 200 },
];
const INVOICE = `FE-GRN-${stamp}`;
const EDITED_INVOICE = `${INVOICE}-E`;
const EDITED: GrnLine[] = [
  { product: P.P1.code, qty: 7, price: 120 },
  { product: P.P3.code, qty: 2, price: 300 },
];

test.beforeAll(async () => {
  TODAY = await activePeriodDate(BU);
});

test(
  "TC-GRN-700001 Requestor สร้าง GRN manual แบบ draft แล้วหลังบ้านเก็บใบกำกับ จำนวน และราคาครบ",
  {
    annotation: [
      { type: "preconditions", description: "Login เป็น requestor@carmen.com (movement-setup); BU CARMEN-AVG; requestor มีคลัง LCX013 และสิทธิ์ GRN; ผู้ขาย C010 มีอยู่" },
      { type: "steps", description: "1. เปิด /procurement/goods-receive-note/new?doc_type=manual\n2. ผู้ขาย C010, GRN Date = วันในงวด active, Currency THB, เลขใบกำกับ FE-GRN-<stamp>, Invoice Date เดียวกัน\n3. Add Item 2 รายการที่ LCX013: 11110001 × 3 @100, 11110003 × 5 @200\n4. กด Save Draft" },
      { type: "expected", description: "POST ตอบ ok; หลังบ้าน doc_status = draft, invoice_no = FE-GRN-<stamp> และรายการ 11110001×3@100, 11110003×5@200" },
      { type: "priority", description: "High" },
      { type: "testType", description: "CRUD" },
      { type: "note", description: "เดิม GRN.1 (_movement_play fe/04-grn) · TC-GRN-050001 ไม่มี assertion และคาดสถานะ RECEIVED ซึ่งไม่มีแล้ว (draft / saved / committed)" },
    ],
  },
  async ({ page }) => {
    const doc = await createGrn(page, { bu: BU, location: LOC, date: TODAY, invoiceNo: INVOICE, lines: LINES, status: "draft" });
    draftId = doc!.id;
    const g = await grnById(draftId);
    expect(g.status).toBe("draft");
    expect(g.invoice).toBe(INVOICE);
    expect(fmt(g.lines)).toBe(fmt(LINES));
    await observed(`${g.no} · ${g.status} · invoice ${g.invoice} · ${fmt(g.lines)} · toast: ${(await toasts(page)).join(" / ") || "-"}`);
  },
);

test(
  "TC-GRN-700002 Requestor เปิด GRN draft แล้วเห็นใบกำกับ จำนวน และราคาตามที่บันทึก",
  {
    annotation: [
      { type: "preconditions", description: "TC-GRN-700001 ผ่านแล้วในรอบเดียวกัน (serial) — มี GRN draft บน CARMEN-AVG" },
      { type: "steps", description: "1. เปิด /procurement/goods-receive-note/<id> จากลิงก์ตรง\n2. อ่านเลขใบกำกับ และข้อความ/ค่าในแถวของแต่ละสินค้า" },
      { type: "expected", description: "หน้าแสดงเลขใบกำกับ FE-GRN-<stamp>; แถว 11110001 มีจำนวน 3 ราคา 100; แถว 11110003 มีจำนวน 5 ราคา 200" },
      { type: "priority", description: "Medium" },
      { type: "testType", description: "CRUD" },
      { type: "note", description: "เดิม GRN.2 · main ไม่มีเคสเปิดดู GRN · ครอบบางส่วนของ gap TC-GRN-020101/020103" },
    ],
  },
  async ({ page }) => {
    await gotoBu(page, `/procurement/goods-receive-note/${draftId}`, BU);
    await expect
      .poll(async () => `${(await inputValues(page)).join(" ")} ${await page.locator("main").innerText()}`)
      .toContain(INVOICE);
    const seen: string[] = [];
    for (const l of LINES) {
      const row = itemRow(page, l.product);
      await expect(row).toBeVisible();
      const vals = await row.locator("input").evaluateAll((xs) => xs.map((x) => (x as HTMLInputElement).value));
      const all = `${(await row.innerText()).replace(/\s+/g, " ")} ${vals.join(" ")}`.replace(/,/g, "");
      expect(all, `${l.product} qty`).toMatch(numRe(l.qty));
      expect(all, `${l.product} price`).toMatch(numRe(l.price));
      seen.push(`${l.product}: ${all.slice(0, 120)}`);
    }
    await observed(seen.join(" · "));
  },
);

test(
  "TC-GRN-700003 Requestor แก้ GRN draft (ใบกำกับ + จำนวน/ราคา + ลบรายการ + เพิ่มรายการ)",
  {
    annotation: [
      { type: "preconditions", description: "TC-GRN-700001 ผ่านแล้วในรอบเดียวกัน (serial) — GRN draft มี 11110001×3@100, 11110003×5@200" },
      { type: "steps", description: "1. เปิดใบ แล้วกด Edit\n2. เลขใบกำกับ → FE-GRN-<stamp>-E\n3. Ground Beef 3@100 → 7@120\n4. ลบ Australian Sirloin ด้วย \"Remove this line\"\n5. Add Item: Pork neck tenderloin (11110009) 2@300\n6. รอหน่วยโหลดเสร็จ แล้วกด Save Draft" },
      { type: "expected", description: "Save ตอบ < 300; ใบยังเป็น draft; หลังบ้านเก็บเลขใบกำกับใหม่ และรายการเหลือ 11110001×7@120, 11110009×2@300" },
      { type: "priority", description: "High" },
      { type: "testType", description: "CRUD" },
      { type: "note", description: "เดิม GRN.3 · TC-GRN-060001/070001/080001/090001 เป็นเปลือกที่ไม่ได้ตรวจผล · ครอบ gap TC-GRN-040108 และบางส่วนของ 070103" },
    ],
  },
  async ({ page }) => {
    await gotoBu(page, `/procurement/goods-receive-note/${draftId}`, BU);
    await button(page, "Edit").click();
    await page.locator("#grn-invoice-no").fill(EDITED_INVOICE);
    const p1 = itemRow(page, P.P1.code);
    await typeInto(p1.locator('input[name$=".received_qty"]'), 7);
    await typeInto(p1.locator('input[placeholder="0.00"]').first(), 120);
    await itemRow(page, P.P2.code).getByRole("button", { name: "Remove this line" }).click();
    if (await page.locator("[role=alertdialog]:visible").count()) await confirmDialog(page, /remove|delete|confirm|ลบ/i);
    await expect(itemRow(page, P.P2.code)).toHaveCount(0);
    await addLine(page, EDITED[1]);
    await expect(page.locator("table tbody .animate-spin")).toHaveCount(0);
    const resp = page.waitForResponse(
      (r) => /\/good-received-notes/.test(r.url()) && !["GET", "OPTIONS"].includes(r.request().method()),
      { timeout: 60_000 },
    );
    await button(page, "Save Draft").click();
    const r = await resp;
    expect(r.status(), (await r.text()).slice(0, 400)).toBeLessThan(300);
    await expect.poll(async () => fmt((await grnById(draftId)).lines), { timeout: 15_000 }).toBe(fmt(EDITED));
    const g = await grnById(draftId);
    expect(g.status).toBe("draft");
    expect(g.invoice).toBe(EDITED_INVOICE);
    await observed(`${g.no} · ${g.status} · invoice ${g.invoice} · ${fmt(g.lines)} · toast: ${(await toasts(page)).join(" / ") || "-"}`);
  },
);

test(
  "TC-GRN-700004 Requestor ลบ GRN draft (Edit → Delete) แล้วใบหายจากหลังบ้าน",
  {
    annotation: [
      { type: "preconditions", description: "TC-GRN-700001 ผ่านแล้วในรอบเดียวกัน (serial) — GRN draft ยังอยู่" },
      { type: "steps", description: "1. เปิดใบ แล้วกด Edit\n2. กด Delete\n3. ยืนยัน Delete ใน dialog" },
      { type: "expected", description: "GET ใบนั้นไม่พบแล้ว และหน้าจอออกจาก URL ของใบกลับไปหน้ารายการ" },
      { type: "priority", description: "Medium" },
      { type: "testType", description: "CRUD" },
      { type: "note", description: "เดิม GRN.4 · main มีแต่เคสลบบรรทัด · ครอบ gap TC-GRN-050102 และบางส่วนของ 050101" },
    ],
  },
  async ({ page, signals }) => {
    signals.minor(new RegExp(`GET .*/good-received-notes/${draftId} → 404`), "refetch of the just-deleted document");
    await gotoBu(page, `/procurement/goods-receive-note/${draftId}`, BU);
    await button(page, "Edit").click();
    await button(page, "Delete").first().click();
    await confirmDialog(page, /^delete$/i);
    await expect.poll(async () => (await grnById(draftId)).status, { timeout: 30_000 }).toBe("deleted");
    await expect(page).not.toHaveURL(new RegExp(draftId), { timeout: 15_000 });
    await observed(`deleted · ${page.url().replace(/^https?:\/\/[^/]+/, "")} · toast: ${(await toasts(page)).join(" / ") || "-"}`);
  },
);

test(
  "TC-GRN-700005 Requestor สร้าง GRN แล้วกด Create ได้สถานะ saved และ AVG ลงสต๊อกทันที",
  {
    annotation: [
      { type: "preconditions", description: "Login เป็น requestor@carmen.com; BU CARMEN-AVG (costing แบบ average — ลงสต๊อกตอน saved); ตรวจ inventory transaction จาก API" },
      { type: "steps", description: "1. สร้าง GRN manual 1 รายการ 11110012 × 1 @50 วันที่ในงวด active\n2. กด Create\n3. รอให้ใบพ้นสถานะ draft" },
      { type: "expected", description: "หลังบ้าน doc_status = saved, grn_no ไม่ขึ้นต้นด้วย draft, รายการ 11110012×1@50; inventory-transactions ของใบนี้รับเข้า 11110012 จำนวน 1" },
      { type: "priority", description: "High" },
      { type: "testType", description: "Functional" },
      { type: "note", description: "เดิม GRN.5 · ขัดกับ TC-GRN-140003 (501-grn: ยังไม่ commit ต้องไม่มี stock movement) — ต้องให้ทีมหลังบ้านยืนยันว่าพฤติกรรมของ AVG แบบไหนถูก" },
    ],
  },
  async ({ page }) => {
    const lines: GrnLine[] = [{ product: P.P4.code, qty: 1, price: 50 }];
    const doc = await createGrn(page, { bu: BU, location: LOC, date: TODAY, invoiceNo: `${INVOICE}-S`, lines, status: "saved" });
    const g = await grnById(doc!.id);
    expect(g.status).toBe("saved");
    expect(g.no).not.toMatch(/^draft/);
    expect(fmt(g.lines)).toBe(fmt(lines));
    const tx = await txOfDoc(BU, doc!.id, g.no);
    expect(tx.length, "an AVG GRN must post stock when saved").toBeGreaterThan(0);
    expect(tx.reduce((n, t) => n + t.qty_in, 0), "stock received = GRN line qty").toBe(lines[0].qty);
    expect(tx[0].product?.code).toBe(lines[0].product);
    await observed(`${g.no} · ${g.status} · ${fmt(g.lines)} · inventory transactions ${tx.length} · toast: ${(await toasts(page)).join(" / ") || "-"}`);
  },
);
