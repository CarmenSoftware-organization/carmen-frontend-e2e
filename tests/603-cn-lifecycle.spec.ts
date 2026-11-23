import type { Page } from "@playwright/test";
import { test, gotoBu, expect, observed } from "./fixtures/doc-flow.fixture";
import { BU_CODE } from "./test-users";
import { buConfigSend, buSend } from "./helpers/bu-api";
import { dfGet, txOfDoc } from "./helpers/doc-flow/api";
import { createCreditNote, createGrn } from "./helpers/doc-flow/docs";
import { DF as P, activePeriodDate, firstCnReason, firstVendor, srLocations, stamp } from "./helpers/doc-flow/data";
import { stockAt } from "./helpers/ia-api";
import { button, confirmDialog, field, shownText, numRe, pickDate, pickLookup, toasts, typeInto } from "./helpers/movement/ui";

/**
 * CN doc flow (quantity return) — doc-flow suite on the TEST BU (AVG), gmail accounts.
 * BU-GR2VYNKQ · Purchase (the role holding GRN create/commit and CN create) · products E2E-DF-1..3 ·
 * vendor, CN reason and location read at run time.
 * prepare a committed GRN -> CN draft -> view -> (guard) -> edit -> delete -> new + Submit (completed).
 *
 * One case pins a suspected bug with `test.fail()` — it reports Fail in the results
 * sheet while the bug exists and turns red ("unexpectedly passed") once it is
 * fixed, which is the signal to drop the marker:
 *  - TC-CN-700004  the Select-from-GRN dialog offers a product already on another CN
 * (TC-CN-700005's FE-3 "removed line survives Save" was fixed by FE 48edc588 — marker dropped.)
 *
 * 601-cn still drives Commit / Void / lot selection and a "Total Amount" field,
 * none of which exist any more (its own gap report agrees); the real flow is
 * Create -> Submit -> completed with lines picked from the GRN.
 * Needs the doc-flow step of `bun run data:reset`.
 * Origin: `_movement_play/eop_bf/e2e/fe/05-cn.spec.ts` (CN.0–CN.6).
 */
const BU = BU_CODE;
test.use({ role: "Purchase", bu: BU_CODE });
test.describe.configure({ mode: "serial", retries: 0 });
test.setTimeout(300_000);

let LOC = "";
let VENDOR = "";
let CN_REASON = "";

interface CnLine {
  product: string;
  qty: number;
}

async function cnById(id: string) {
  const { status, body } = await dfGet(`/credit-notes/${id}`, "Admin", BU);
  if (status !== 200 || !body?.data) return { status: "deleted", no: "", taxInvoice: "", lines: [] as CnLine[] };
  const d = body.data;
  const det = d.credit_note_detail ?? d.details ?? [];
  return {
    status: d.doc_status as string,
    no: d.cn_no as string,
    taxInvoice: d.tax_invoice_no as string,
    // Compare by code (name = code for the doc-flow products).
    lines: det.map((x: any) => ({ product: x.product?.code ?? x.product?.name, qty: Number(x.return_qty) })) as CnLine[],
  };
}
/** Product id and the id of the named location on it (name read from the product's own location list). */
async function productAndLocation(code: string, locationName: string): Promise<{ productId: string; locationId: string }> {
  const list = await buConfigSend("Admin", "GET", `/products?search=${encodeURIComponent(code)}&perpage=20`, undefined, BU);
  const hit = ((list.body?.data ?? []) as any[]).find((p) => p.code === code);
  if (!hit) throw new Error(`${BU}: product ${code} not found - run data:reset first`);
  const detail = await buConfigSend("Admin", "GET", `/products/${hit.id}`, undefined, BU);
  const loc = ((detail.body?.data?.locations ?? []) as any[]).find((l) => l.location?.name === locationName);
  if (!loc) throw new Error(`${BU}: ${code} has no location "${locationName}"`);
  return { productId: String(hit.id), locationId: String(loc.location.id) };
}
const itemRow = (page: Page, name: string) => page.locator("table tbody tr").filter({ hasText: name }).first();
const fmt = (ls: CnLine[]) => ls.map((l) => `${l.product}×${l.qty}`).sort().join(", ");

/** The checkbox of a product in the "Select from GRN" dialog. */
const grnLineBox = (page: Page, name: string) =>
  page
    .locator("[role=dialog]")
    .filter({ hasText: "Select from GRN" })
    .locator("label, li, div")
    .filter({ hasText: name })
    .filter({ has: page.getByRole("checkbox") })
    .last()
    .getByRole("checkbox");

/** Add Item → pick from the GRN by product name → Add, then type the return qty. */
async function addFromGrn(page: Page, line: CnLine) {
  await button(page, "Add Item").click();
  await grnLineBox(page, line.product).click();
  await page.locator("[role=dialog]").filter({ hasText: "Select from GRN" }).getByRole("button", { name: /^Add \d+ items?$/ }).click();
  await typeInto(itemRow(page, line.product).locator('input[name$=".quantity"]'), line.qty);
}

let TODAY = "";
let grnNo = "";
let draftId = "";
const TAX = `FE-CN-${stamp}`;
const LINES: CnLine[] = [
  { product: P.P1.name, qty: 1 },
  { product: P.P2.name, qty: 1 },
];
const EDITED_TAX = `${TAX}-E`;
const EDITED: CnLine[] = [
  { product: P.P1.name, qty: 2 },
  { product: P.P3.name, qty: 1 },
];

test.beforeAll(async () => {
  TODAY = await activePeriodDate(BU);
  LOC = (await srLocations(BU)).from;
  VENDOR = (await firstVendor(BU)).code;
  CN_REASON = await firstCnReason(BU);
});

/**
 * Cleanup by tax-invoice stamp, read from the API (not from in-memory ids) so a failed case is
 * still cleaned. Only CN drafts can be deleted; completed CNs and committed GRNs stay (warned)
 * until the next data:reset. Failures throw so the hook fails visibly.
 */
test.afterAll(async () => {
  test.setTimeout(180_000);
  const { status, body } = await dfGet(`/credit-notes?search=${encodeURIComponent(TAX)}&perpage=100`, "Admin", BU);
  if (status !== 200) throw new Error(`cleanup: list credit-notes HTTP ${status} ${JSON.stringify(body).slice(0, 300)}`);
  const failures: string[] = [];
  for (const d of (body?.data ?? []) as any[]) {
    if (!String(d.tax_invoice_no ?? "").startsWith(TAX)) continue;
    if (d.doc_status !== "draft") {
      // only drafts can be deleted — completed docs wait for the next data:reset
      console.warn(`cleanup: left ${d.cn_no} in ${d.doc_status} until next data:reset`);
      continue;
    }
    const r = await buSend("Admin", "DELETE", `/credit-notes/${d.id}`, undefined, BU);
    if (r.status >= 300) failures.push(`${d.cn_no ?? d.id} HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
  }
  if (failures.length) throw new Error(`cleanup: CN draft(s) not deleted: ${failures.join(" | ")}`);
});

test(
  "TC-CN-700001 เตรียม GRN ที่ commit แล้ว 3 รายการให้ใบลดหนี้อ้าง",
  {
    annotation: [
      { type: "preconditions", description: "Login เป็นบัญชี Purchase (gmail); BU TEST (AVG); Purchase มีสิทธิ์สร้าง/commit GRN และสร้างใบลดหนี้ (data:reset)" },
      { type: "steps", description: "1. สร้าง GRN manual วันที่ในงวด active: E2E-DF-1 / E2E-DF-2 / E2E-DF-3 อย่างละ 5\n2. กด Create\n3. กด Commit แล้วยืนยัน" },
      { type: "expected", description: "หลังบ้าน GRN doc_status = committed (ใบลดหนี้อ้างได้เฉพาะ GRN ที่ commit แล้ว)" },
      { type: "priority", description: "High" },
      { type: "testType", description: "Functional" },
      { type: "note", description: "เดิม CN.0 · สร้างใหม่ทุกรอบ เพราะสินค้าหนึ่งตัวบนใบรับลดหนี้ได้ครั้งเดียว · TC-GRN-110001 (501-grn) skip ทุกรอบเพราะหาแถว received" },
    ],
  },
  async ({ page }) => {
    const g = await createGrn(page, {
      bu: BU,
      vendor: VENDOR,
      location: LOC,
      date: TODAY,
      invoiceNo: `${TAX}-GRN`,
      status: "committed",
      lines: [
        { product: P.P1.code, qty: 5, price: 100 },
        { product: P.P2.code, qty: 5, price: 200 },
        { product: P.P3.code, qty: 5, price: 300 },
      ],
    });
    grnNo = g!.no;
    expect(g!.status).toBe("committed");
    await observed(`${g!.no} · ${g!.status}`);
  },
);

test(
  "TC-CN-700002 Purchase สร้างใบลดหนี้ draft จาก GRN แล้วหลังบ้านเก็บใบกำกับและจำนวนคืนครบ",
  {
    annotation: [
      { type: "preconditions", description: "TC-CN-700001 ผ่านแล้วในรอบเดียวกัน (serial) — มี GRN committed ของผู้ขายแรกที่ active; มีเหตุผลใบลดหนี้ที่ active" },
      { type: "steps", description: "1. เปิด /procurement/credit-note/new\n2. ผู้ขายแรกที่ active, GRN No. = ใบจาก TC-CN-700001, Reason แรกที่ active, Doc Date/Tax Invoice Date = วันในงวด active, เลขใบกำกับภาษี FE-CN-<stamp>\n3. Add Item → Select from GRN: E2E-DF-1 + E2E-DF-2 → Add\n4. จำนวนคืนอย่างละ 1\n5. กด Create" },
      { type: "expected", description: "POST ตอบ ok; หลังบ้าน doc_status = draft, tax_invoice_no = FE-CN-<stamp> และรายการ E2E-DF-2×1, E2E-DF-1×1" },
      { type: "priority", description: "High" },
      { type: "testType", description: "CRUD" },
      { type: "note", description: "เดิม CN.1 · TC-CN-020001 ไม่มี assertion และสมมติว่ามีการเลือก lot ซึ่งไม่มีแล้ว" },
    ],
  },
  async ({ page }) => {
    const doc = await createCreditNote(page, {
      bu: BU,
      vendor: VENDOR,
      reason: CN_REASON,
      grnNo,
      docDate: TODAY,
      taxInvoiceNo: TAX,
      lines: LINES.map((l) => ({ productName: l.product, qty: l.qty })),
      status: "draft",
    });
    draftId = doc!.id;
    const c = await cnById(draftId);
    expect(c.status).toBe("draft");
    expect(c.taxInvoice).toBe(TAX);
    expect(fmt(c.lines)).toBe(fmt(LINES));
    await observed(`${c.no} · ${c.status} · tax invoice ${c.taxInvoice} · ${fmt(c.lines)} · toast: ${(await toasts(page)).join(" / ") || "-"}`);
  },
);

test(
  "TC-CN-700003 Purchase เปิดใบลดหนี้ draft แล้วเห็นใบกำกับ GRN ที่อ้าง และจำนวนคืน",
  {
    annotation: [
      { type: "preconditions", description: "TC-CN-700002 ผ่านแล้วในรอบเดียวกัน (serial) — มี CN draft" },
      { type: "steps", description: "1. เปิด /procurement/credit-note/<id> จากลิงก์ตรง\n2. อ่านเลขใบกำกับภาษี เลข GRN ที่อ้าง และแถวรายการ" },
      { type: "expected", description: "ช่องใบกำกับภาษีมีค่า FE-CN-<stamp>; หน้าแสดงเลข GRN ที่อ้าง; แถว E2E-DF-1 และ E2E-DF-2 มีจำนวนคืน 1" },
      { type: "priority", description: "Medium" },
      { type: "testType", description: "CRUD" },
      { type: "note", description: "เดิม CN.2 · TC-CN-040001 เปิดแถวแล้วไม่ assert และ skip" },
    ],
  },
  async ({ page }) => {
    await gotoBu(page, `/procurement/credit-note/${draftId}`, BU);
    await expect.poll(() => shownText(page)).toContain(TAX);
    await expect(page.getByText(grnNo).first()).toBeVisible();
    const seen: string[] = [];
    for (const l of LINES) {
      const row = itemRow(page, l.product);
      await expect(row).toBeVisible();
      const all = (await row.innerText()).replace(/\s+/g, " ").replace(/,/g, "");
      expect(all, `${l.product} return qty`).toMatch(numRe(l.qty));
      seen.push(`${l.product}: ${all.slice(0, 90)}`);
    }
    await observed(seen.join(" · "));
  },
);

test(
  "TC-CN-700004 ใบลดหนี้ใหม่ที่อ้าง GRN เดิมต้องเลือกสินค้าที่อยู่ในใบลดหนี้อื่นแล้วไม่ได้",
  {
    annotation: [
      { type: "preconditions", description: "TC-CN-700002 ผ่านแล้วในรอบเดียวกัน (serial) — CN draft ถือ E2E-DF-1 + E2E-DF-2 ของ GRN อยู่ (E2E-DF-3 ยังว่าง)" },
      { type: "steps", description: "1. เปิด /procurement/credit-note/new แล้วกรอกหัวใบอ้าง GRN เดิม (ผู้ขายแรกที่ active, Reason, วันที่, ใบกำกับ FE-CN-<stamp>-DUP)\n2. กด Add Item ดู dialog Select from GRN\n3. ดูว่าช่องของ E2E-DF-1 (อยู่ใน CN draft อื่นแล้ว) ถูก disabled หรือไม่" },
      { type: "expected", description: "dialog ปิด/ทำเครื่องหมายสินค้าที่ถูกลดหนี้แล้ว (หลังบ้านมี GET good-received-notes/:id/ref บอกให้) — ช่องของ E2E-DF-1 ต้อง disabled" },
      { type: "priority", description: "Medium" },
      { type: "testType", description: "Validation" },
      { type: "note", description: "suspected bug (test.fail): dialog ให้เลือกสินค้าที่ถูกลดหนี้แล้วได้ (ยังเป็นอยู่ 2026-11-22) · เดิม CN.3 · ใกล้เคียง gap TC-CN-030007 ซึ่งครอบแค่ภายในใบเดียว" },
    ],
  },
  async ({ page }) => {
    await gotoBu(page, "/procurement/credit-note/new", BU);
    await pickLookup(page, field(page, "Vendor").locator("button").first(), VENDOR);
    await pickLookup(page, field(page, "GRN No.").locator("button").first(), grnNo);
    await pickLookup(page, field(page, "Reason").locator("button").first(), CN_REASON);
    expect(await pickDate(page, field(page, "Doc Date").locator("button").first(), TODAY)).toBe(true);
    await page.locator("#cn-tax-invoice-no").fill(`${TAX}-DUP`);
    expect(await pickDate(page, field(page, "Tax Invoice Date").locator("button").first(), TODAY)).toBe(true);
    await button(page, "Add Item").click();
    const dlg = page.locator("[role=dialog]").filter({ hasText: "Select from GRN" });
    await expect(dlg).toBeVisible();
    const state: string[] = [];
    for (const name of [P.P1.name, P.P2.name, P.P3.name]) {
      state.push(`${name}: ${(await grnLineBox(page, name).isDisabled()) ? "disabled" : "selectable"}`);
    }
    await test.info().attach("dialog-select-from-grn", { body: await page.screenshot(), contentType: "image/png" });
    const p1Selectable = !(await grnLineBox(page, P.P1.name).isDisabled());
    await observed(`dialog: ${state.join(" · ")}`);
    test.fail(true, "suspected bug: Select from GRN offers a product already credited on another CN (the backend's duplicate-line check then answers 422 on Create) - the dialog leaves the Ground Beef box enabled; the backend exposes GET good-received-notes/:id/ref for exactly this");
    expect(p1Selectable, `already-credited product was selectable — dialog: ${state.join(" · ")}`).toBe(false);
  },
);

test(
  "TC-CN-700005 Purchase แก้ใบลดหนี้ draft (ใบกำกับ + จำนวนคืน + ลบรายการ + เพิ่มรายการจาก GRN)",
  {
    annotation: [
      { type: "preconditions", description: "TC-CN-700002 ผ่านแล้วในรอบเดียวกัน (serial) — CN draft มี E2E-DF-1×1, E2E-DF-2×1" },
      { type: "steps", description: "1. เปิดใบ แล้วกด Edit\n2. เลขใบกำกับภาษี → FE-CN-<stamp>-E\n3. E2E-DF-1 คืน 1 → 2\n4. ลบ E2E-DF-2\n5. Add Item → Select from GRN: E2E-DF-3 คืน 1\n6. กด Save" },
      { type: "expected", description: "Save ตอบ < 300; ใบยังเป็น draft; หลังบ้านเก็บใบกำกับใหม่ และรายการเหลือ E2E-DF-1×2, E2E-DF-3×1 (บรรทัดที่ลบต้องหายจริง)" },
      { type: "priority", description: "High" },
      { type: "testType", description: "CRUD" },
      { type: "note", description: "FE-3 แก้แล้ว: FE 48edc588 ส่งบรรทัดที่ลบด้วยคีย์ credit_note_detail.delete ที่หลังบ้านอ่าน (เดิมส่ง remove แล้วบรรทัดที่ลบยังอยู่) จึงถอด test.fail ออก · เดิม CN.4 · TC-CN-050001 แก้ช่อง Total Amount ซึ่งไม่มีแล้ว" },
    ],
  },
  async ({ page }) => {
    await gotoBu(page, `/procurement/credit-note/${draftId}`, BU);
    await button(page, "Edit").click();
    await page.locator("#cn-tax-invoice-no").fill(EDITED_TAX);
    await typeInto(itemRow(page, P.P1.name).locator('input[name$=".quantity"]'), 2);
    await itemRow(page, P.P2.name).getByRole("button", { name: "Remove" }).click();
    if (await page.locator("[role=alertdialog]:visible").count()) await confirmDialog(page, /remove|delete|confirm|ลบ/i);
    await expect(itemRow(page, P.P2.name)).toHaveCount(0);
    await addFromGrn(page, EDITED[1]);
    const resp = page.waitForResponse(
      (r) => /\/credit-notes/.test(r.url()) && !["GET", "OPTIONS"].includes(r.request().method()),
      { timeout: 60_000 },
    );
    await button(page, "Save").click();
    const r = await resp;
    expect(r.status(), (await r.text()).slice(0, 400)).toBeLessThan(300);
    await page.waitForTimeout(1500);
    const c = await cnById(draftId);
    await observed(`${c.no} · ${c.status} · tax invoice ${c.taxInvoice} · ${fmt(c.lines)} · toast: ${(await toasts(page)).join(" / ") || "-"}`);
    expect(c.status).toBe("draft");
    expect(c.taxInvoice).toBe(EDITED_TAX);
    expect(fmt(c.lines), "removed line must be gone; edited qty and the added line kept").toBe(fmt(EDITED));
  },
);

test(
  "TC-CN-700006 Purchase ลบใบลดหนี้ draft (Edit → Delete) แล้วใบหายจากหลังบ้าน",
  {
    annotation: [
      { type: "preconditions", description: "TC-CN-700002 ผ่านแล้วในรอบเดียวกัน (serial) — CN draft ยังอยู่" },
      { type: "steps", description: "1. เปิดใบ แล้วกด Edit\n2. กด Delete\n3. ยืนยัน Delete ใน dialog" },
      { type: "expected", description: "GET ใบนั้นไม่พบแล้ว และหน้าจอออกจาก URL ของใบกลับไปหน้ารายการ" },
      { type: "priority", description: "Medium" },
      { type: "testType", description: "CRUD" },
      { type: "note", description: "เดิม CN.5 · main ไม่มีเคสลบ CN (TC-CN-110001 เป็น Void ซึ่ง UI ไม่มี) · ครอบ gap TC-CN-110006" },
    ],
  },
  async ({ page, signals }) => {
    signals.minor(new RegExp(`GET .*/credit-notes/${draftId} → 404`), "refetch of the just-deleted document");
    await gotoBu(page, `/procurement/credit-note/${draftId}`, BU);
    await button(page, "Edit").click();
    await button(page, "Delete").first().click();
    await confirmDialog(page, /^delete$/i);
    await expect.poll(async () => (await cnById(draftId)).status, { timeout: 30_000 }).toBe("deleted");
    await expect(page).not.toHaveURL(new RegExp(draftId), { timeout: 15_000 });
    await observed(`deleted · ${page.url().replace(/^https?:\/\/[^/]+/, "")} · toast: ${(await toasts(page)).join(" / ") || "-"}`);
  },
);

test(
  "TC-CN-700007 Purchase สร้างใบลดหนี้แล้ว Submit ได้ completed และลงสต๊อกคืนของ",
  {
    annotation: [
      { type: "preconditions", description: "TC-CN-700001 ผ่านแล้วในรอบเดียวกัน (serial) — GRN committed; ตรวจ inventory transaction จาก API" },
      { type: "steps", description: "1. สร้างใบลดหนี้อ้าง GRN เดิม คืน E2E-DF-1 × 1 แล้วกด Create\n2. เปิดใบ กด Submit\n3. ยืนยัน Submit" },
      { type: "expected", description: "หลังบ้าน doc_status = completed, รายการ E2E-DF-1×1; inventory-transactions ของใบนี้ตัดสต๊อก E2E-DF-1 ออก 1" },
      { type: "priority", description: "High" },
      { type: "testType", description: "Functional" },
      { type: "note", description: "เดิม CN.6 · TC-CN-100001 กดปุ่ม Commit และคาด COMMITTED ซึ่งไม่มีแล้ว · ครอบเคส stock movement ที่ skip อยู่ (TC-CN-310001 / 280001) · ครอบ gap TC-CN-100008" },
    ],
  },
  async ({ page }) => {
    const lines: CnLine[] = [{ product: P.P1.name, qty: 1 }];
    const { productId, locationId } = await productAndLocation(P.P1.code, LOC);
    const before = await stockAt(productId, locationId, TODAY);
    const doc = await createCreditNote(page, {
      bu: BU,
      vendor: VENDOR,
      reason: CN_REASON,
      grnNo,
      docDate: TODAY,
      taxInvoiceNo: `${TAX}-S`,
      status: "completed",
      lines: lines.map((l) => ({ productName: l.product, qty: l.qty })),
    });
    const c = await cnById(doc!.id);
    expect(c.status).toBe("completed");
    expect(fmt(c.lines)).toBe(fmt(lines));
    const tx = await txOfDoc(BU, doc!.id, c.no);
    expect(tx.length, "a completed CN must post stock").toBeGreaterThan(0);
    expect(tx.reduce((n, t) => n + t.qty_out, 0), "stock returned = CN line qty").toBe(lines[0].qty);
    // Delta, not absolutes: other documents on the BU also move this product's stock.
    const after = await stockAt(productId, locationId, TODAY);
    expect(after.qty - before.qty, "on-hand delta of the returned product at the GRN location").toBe(-lines[0].qty);
    await observed(`${c.no} · ${c.status} · ${fmt(c.lines)} · on-hand ${before.qty} -> ${after.qty} · inventory transactions ${tx.length} · toast: ${(await toasts(page)).join(" / ") || "-"}`);
  },
);
