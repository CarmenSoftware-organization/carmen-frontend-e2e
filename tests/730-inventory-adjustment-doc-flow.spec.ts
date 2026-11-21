import type { Page } from "@playwright/test";
import { test, gotoBu, expect, observed } from "./fixtures/movement.fixture";
import { apiGet, txOfDoc } from "./helpers/movement/api";
import { adjustmentUrl, createAdjustment, type AdjustmentType } from "./helpers/movement/docs";
import { addRow, button, confirmDialog, numRe, pickLookup, toasts, typeInto } from "./helpers/movement/ui";
import { DOC_FLOW_BU as BU, DOC_FLOW_ROLE, PROD, todayInActivePeriod, itemRow, nameOf, stamp } from "./helpers/movement/doc-flow";

/**
 * Inventory Adjustment doc flow (Stock In = section 70, Stock Out = section 71) —
 * movement suite (opt-in: `bun run test:movement`).
 * CARMEN-AVG · fc (the only account with Stock In/Out permission) · location 1FO02,
 * which stocks only products A and B · dated inside the active period.
 * open form → draft → view → edit (description + qty/cost + remove B, re-add B as a
 * new line) → delete → new + Commit. Stock In commits A/B ×2 so Stock Out has stock.
 *
 * Known bugs pinned with `test.fail()` (they turn red once fixed):
 *  - TC-IADJ-710003  FE-5: a reopened Stock Out draft shows estimated cost 0.00
 *  - TC-IADJ-710004  FE-4: editing an existing Stock Out line's qty makes Total NaN and Save sends nothing
 *
 * The rest of the module's cases are still a gap report:
 * docs/test-cases/gaps/730-inventory-adjustment-gap.md.
 * Origin: `_movement_play/eop_bf/e2e/fe/06-adjustment.spec.ts` (SI.0–SI.5, SO.0–SO.5).
 */
const { user: USER, loc: LOC } = DOC_FLOW_ROLE.adj;
test.use({ user: USER, bu: BU });
// 1FO02 holds nothing until the Stock In commit: the cost estimator answers 422 "No available stock".
test.beforeEach(({ signals }) => signals.minor(/\/cost\/products\/.+ → 422/, "location has no stock yet: cost estimator 422"));

interface AdjLine {
  product: string;
  qty: number;
  price?: number;
}

const REASON: Record<AdjustmentType, string> = { "stock-in": "Test stock_in", "stock-out": "Test stock_out" };
const fmtOf = (type: AdjustmentType) => (ls: AdjLine[]) =>
  ls.map((l) => `${l.product}×${l.qty}${type === "stock-in" ? `@${l.price}` : ""}`).sort().join(", ");

async function byId(type: AdjustmentType, id: string) {
  const { status, body } = await apiGet(`/api/${BU}/${type}s/${id}`);
  const d = body?.data;
  if (status !== 200 || !d) return { status: "deleted", no: "", desc: "", lines: [] as AdjLine[] };
  return {
    status: d.doc_status as string,
    no: (d.si_no ?? d.so_no) as string,
    desc: (d.description ?? "") as string,
    lines: (d.stock_in_detail ?? d.stock_out_detail ?? []).map((x: any) => ({
      product: x.product?.code,
      qty: Number(x.qty),
      ...(type === "stock-in" ? { price: Number(x.cost_per_unit) } : {}),
    })) as AdjLine[],
  };
}

let TODAY = "";
test.beforeAll(async () => {
  TODAY = (await todayInActivePeriod(BU)) ?? "";
});
// Data precondition (API-checked in beforeAll): the form cannot be dated beyond today (FE 90018c6d), so every case
// that fills the date needs an active period that contains today. The two "open the create page" cases do not.
test.beforeEach(() => {
  test.skip(!TODAY && !/TC-IADJ-7[01]0001/.test(test.info().title), `${BU} active period does not contain today — Stock In/Out cannot be dated inside it`);
});

// ── shared steps ────────────────────────────────────────────────────────────────
// Methods are named expect* — they assert inside, and scripts/lib/spec-health.ts counts `obj.expectX()`
// calls as assertion helpers (same convention as the page objects).

async function expectFormOpens(page: Page, type: AdjustmentType) {
  await gotoBu(page, `/inventory-management/inventory-adjustment/new?type=${type}`, BU);
  await page.waitForTimeout(1500);
  // FE-6: the route guard checked inventory_management.view (module key) while roles grant the
  // sub-keys inventory_management.inventory_adjustment.* — accounts with the real permission were locked out.
  const denied = page.getByRole("alert").filter({ hasText: /Permission Denied/i });
  expect(await denied.count(), "Permission Denied — route guard checks inventory_management.view, which the role does not grant").toBe(0);
  await expect(page.locator("#inv-adj-description")).toBeVisible();
}

async function expectDraftCreated(page: Page, type: AdjustmentType, lines: AdjLine[], desc: string): Promise<string> {
  // createAdjustment fills up to the lines and stops (dryRun) — the description goes in after the lines.
  await createAdjustment(page, { bu: BU, location: LOC, type, date: TODAY, reason: REASON[type], lines, status: "draft", dryRun: true });
  await page.locator("#inv-adj-description").fill(desc);
  const created = page.waitForResponse(
    (r) => r.request().method() === "POST" && new RegExp(`/${type}s/?(\\?|$)`).test(r.url()),
    { timeout: 60_000 },
  );
  await button(page, "Save").first().click();
  const r = await created;
  expect(r.status(), (await r.text()).slice(0, 400)).toBeLessThan(300);
  const id: string = (await r.json()).data.id;
  const d = await byId(type, id);
  expect(d.status).toBe("draft");
  expect(d.desc).toBe(desc);
  expect(fmtOf(type)(d.lines)).toBe(fmtOf(type)(lines));
  await observed(`${d.no} · ${d.status} · "${d.desc}" · ${fmtOf(type)(d.lines)} · toast: ${(await toasts(page)).join(" / ") || "-"}`);
  return id;
}

async function expectDraftShown(page: Page, type: AdjustmentType, id: string, lines: AdjLine[], desc: string): Promise<string[]> {
  await gotoBu(page, adjustmentUrl(type, id), BU);
  await expect(page.getByText(desc).first()).toBeVisible();
  const seen: string[] = [];
  for (const l of lines) {
    const row = itemRow(page, l.product);
    await expect(row).toBeVisible();
    await page.waitForTimeout(1500); // the Stock Out estimated cost arrives later
    const all = (await row.innerText()).replace(/\s+/g, " ").replace(/,/g, "");
    expect(all, `${nameOf(l.product)} qty`).toMatch(numRe(l.qty));
    if (type === "stock-in") expect(all, `${nameOf(l.product)} cost`).toMatch(numRe(l.price!));
    seen.push(`${nameOf(l.product)}: ${all.slice(0, 90)}`);
  }
  await observed(seen.join(" · "));
  return seen;
}

/** 1FO02 holds only A and B, so "add a line" re-adds B as a new line after removing the old one. */
async function expectDraftEdited(page: Page, type: AdjustmentType, id: string, edited: AdjLine[], desc: string) {
  const isIn = type === "stock-in";
  await gotoBu(page, adjustmentUrl(type, id), BU);
  await button(page, "Edit").click();
  await page.locator("#inv-adj-description").fill(desc);
  const a = itemRow(page, PROD.A.code);
  await typeInto(a.locator('input[name$=".qty"]'), edited[0].qty);
  if (isIn) await typeInto(a.locator('input[name$=".cost_per_unit"]'), edited[0].price!);
  await itemRow(page, PROD.B.code).getByRole("button", { name: "Remove" }).click();
  if (await page.locator("[role=alertdialog]:visible").count()) await confirmDialog(page, /remove|delete|confirm|ลบ/i);
  await expect(itemRow(page, PROD.B.code)).toHaveCount(0);
  const row = await addRow(page, "Select Product");
  await pickLookup(page, row.getByRole("button", { name: "Select Product" }), edited[1].product);
  const added = itemRow(page, edited[1].product);
  await typeInto(added.locator('input[name$=".qty"]'), edited[1].qty);
  if (isIn) {
    await page.waitForTimeout(1500); // CostProbe fills a cost first, then we type over it
    await typeInto(added.locator('input[name$=".cost_per_unit"]'), edited[1].price!);
  }
  // FE-4: Stock Out with an edited existing line → Total NaN and Save sends no request at all — caught with a short wait.
  const totals = (await page.locator("table tbody tr").allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim());
  const resp = page
    .waitForResponse((r) => new RegExp(`/${type}s/`).test(r.url()) && !["GET", "OPTIONS"].includes(r.request().method()), { timeout: 15_000 })
    .catch(() => null);
  await button(page, "Save").first().click();
  const r = await resp;
  expect(r, `Save sent no request to the backend (no toast) · rows on screen: ${totals.join(" | ")}`).not.toBeNull();
  expect(r!.status(), (await r!.text()).slice(0, 400)).toBeLessThan(300);
  await expect.poll(async () => fmtOf(type)((await byId(type, id)).lines), { timeout: 15_000 }).toBe(fmtOf(type)(edited));
  const d = await byId(type, id);
  expect(d.status).toBe("draft");
  expect(d.desc).toBe(desc);
  await observed(`${d.no} · ${d.status} · "${d.desc}" · ${fmtOf(type)(d.lines)} · toast: ${(await toasts(page)).join(" / ") || "-"}`);
}

async function expectDraftDeleted(page: Page, type: AdjustmentType, id: string) {
  await gotoBu(page, adjustmentUrl(type, id), BU);
  await button(page, "Delete").first().click();
  await confirmDialog(page, /^delete$/i);
  await expect.poll(async () => (await byId(type, id)).status, { timeout: 30_000 }).toBe("deleted");
  await expect(page).not.toHaveURL(new RegExp(id), { timeout: 15_000 });
  await observed(`deleted · ${page.url().replace(/^https?:\/\/[^/]+/, "")} · toast: ${(await toasts(page)).join(" / ") || "-"}`);
}

async function expectCommitted(page: Page, type: AdjustmentType, lines: AdjLine[]) {
  const doc = await createAdjustment(page, { bu: BU, location: LOC, type, date: TODAY, reason: REASON[type], lines, status: "completed" });
  const d = await byId(type, doc!.id);
  expect(d.status).toBe("completed");
  expect(fmtOf(type)(d.lines)).toBe(fmtOf(type)(lines));
  const tx = await txOfDoc(BU, doc!.id, d.no);
  expect(tx.length, "a committed adjustment must post stock").toBeGreaterThan(0);
  const moved = tx.reduce((n, t) => n + (type === "stock-in" ? t.qty_in : t.qty_out), 0);
  expect(moved, "stock moved = sum of line qty").toBe(lines.reduce((n, l) => n + l.qty, 0));
  await observed(
    `${d.no} · ${d.status} · ${fmtOf(type)(d.lines)} · inventory transactions ${tx.length} · cost auto-filled ${doc!.autoCost.join(", ")} · toast: ${(await toasts(page)).join(" / ") || "-"}`,
  );
}

const adj = { expectFormOpens, expectDraftCreated, expectDraftShown, expectDraftEdited, expectDraftDeleted, expectCommitted };

// ── Stock In (section 70) ───────────────────────────────────────────────────────

test.describe("Stock In", () => {
  test.describe.configure({ mode: "serial" });
  let draftId = "";
  const LINES: AdjLine[] = [
    { product: PROD.A.code, qty: 3, price: 100 },
    { product: PROD.B.code, qty: 5, price: 200 },
  ];
  const EDITED: AdjLine[] = [
    { product: PROD.A.code, qty: 7, price: 120 },
    { product: PROD.B.code, qty: 2, price: 300 },
  ];
  const DESC = `FE-CRUD SI ${stamp}`;

  test(
    "TC-IADJ-700001 FC เปิดหน้าสร้าง Stock In ได้โดยไม่ขึ้น Permission Denied",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น fc@carmen.com (movement-setup); BU CARMEN-AVG; role ของ fc มี inventory_management.stock_in.create และ inventory_adjustment.create (คีย์ย่อย) แต่ไม่ได้ให้ inventory_management.view" },
        { type: "steps", description: "1. เปิด /inventory-management/inventory-adjustment/new?type=stock-in\n2. รอหน้าโหลด" },
        { type: "expected", description: "ไม่มีกล่อง alert \"Permission Denied\" และช่อง #inv-adj-description แสดง" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Authorization" },
        { type: "note", description: "เดิม SI.0 · regression ของ FE-6 (route guard เช็คคีย์ระดับโมดูล) · gap TC-IADJ-100001 ถือว่า \"ไม่มี inventory_management.view → AccessDenied\" เป็นพฤติกรรมที่ตั้งใจ — ต้องทบทวนว่ายังจริงอยู่ไหม" },
      ],
    },
    async ({ page }) => {
      await adj.expectFormOpens(page, "stock-in");
      await observed("form opened");
    },
  );

  test(
    "TC-IADJ-700002 FC สร้าง Stock In draft 2 รายการแล้วหลังบ้านเก็บจำนวนและต้นทุนครบ",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น fc@carmen.com; BU CARMEN-AVG; คลัง 1FO02 (สินค้า A = 11020001, B = 55000001); เหตุผล \"Test stock_in\" มีอยู่" },
        { type: "steps", description: "1. เปิดหน้าสร้าง Stock In\n2. Date = วันในงวด active, Reason \"Test stock_in\", Location 1FO02\n3. Add Item: A × 3 ต้นทุน 100, B × 5 ต้นทุน 200\n4. ใส่คำอธิบาย FE-CRUD SI <stamp> (หลังเพิ่มรายการ)\n5. กด Save" },
        { type: "expected", description: "POST ตอบ < 300; หลังบ้าน doc_status = draft, description ตรง และรายการ 11020001×3@100, 55000001×5@200" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
        { type: "note", description: "เดิม SI.1 · ใกล้ TC-IADJ-030002/030004 ใน gap report (เคสนี้ตรวจค่าที่หลังบ้านเก็บด้วย)" },
      ],
    },
    async ({ page }) => {
      draftId = await adj.expectDraftCreated(page, "stock-in", LINES, DESC);
    },
  );

  test(
    "TC-IADJ-700003 FC เปิด Stock In draft แล้วเห็นจำนวนและต้นทุนตามที่บันทึก",
    {
      annotation: [
        { type: "preconditions", description: "TC-IADJ-700002 ผ่านแล้วในรอบเดียวกัน (serial) — มี Stock In draft" },
        { type: "steps", description: "1. เปิด /inventory-management/inventory-adjustment/<id>?type=stock-in\n2. อ่านคำอธิบายและแถวรายการ" },
        { type: "expected", description: "หน้าแสดงคำอธิบาย FE-CRUD SI <stamp>; แถว A มีจำนวน 3 ต้นทุน 100; แถว B มีจำนวน 5 ต้นทุน 200" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "CRUD" },
        { type: "note", description: "เดิม SI.2 · ใกล้ TC-IADJ-020001/020009 ใน gap report" },
      ],
    },
    async ({ page }) => {
      await adj.expectDraftShown(page, "stock-in", draftId, LINES, DESC);
    },
  );

  test(
    "TC-IADJ-700004 FC แก้ Stock In draft (คำอธิบาย + จำนวน/ต้นทุน + ลบรายการ + เพิ่มรายการ)",
    {
      annotation: [
        { type: "preconditions", description: "TC-IADJ-700002 ผ่านแล้วในรอบเดียวกัน (serial) — Stock In draft มี A×3@100, B×5@200" },
        { type: "steps", description: "1. เปิดใบ แล้วกด Edit\n2. แก้คำอธิบายเป็น \"... (แก้)\"\n3. A → จำนวน 7 ต้นทุน 120\n4. ลบแถว B\n5. Add Item: B กลับมาเป็นบรรทัดใหม่ จำนวน 2 ต้นทุน 300\n6. กด Save" },
        { type: "expected", description: "Save ส่งคำขอและตอบ < 300; ใบยังเป็น draft; หลังบ้านเก็บคำอธิบายใหม่ และรายการ 11020001×7@120, 55000001×2@300" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
        { type: "note", description: "เดิม SI.3 · gap TC-IADJ-040001 แก้แค่คำอธิบาย — เคสนี้แก้บรรทัดและลบบรรทัดด้วย" },
      ],
    },
    async ({ page }) => {
      await adj.expectDraftEdited(page, "stock-in", draftId, EDITED, `${DESC} (แก้)`);
    },
  );

  test(
    "TC-IADJ-700005 FC ลบ Stock In draft จากโหมดดูแล้วใบหายจากหลังบ้าน",
    {
      annotation: [
        { type: "preconditions", description: "TC-IADJ-700002 ผ่านแล้วในรอบเดียวกัน (serial) — Stock In draft ยังอยู่" },
        { type: "steps", description: "1. เปิดใบ (โหมดดู)\n2. กด Delete\n3. ยืนยัน Delete ใน dialog" },
        { type: "expected", description: "GET ใบนั้นไม่พบแล้ว และหน้าจอออกจาก URL ของใบกลับไปหน้ารายการ" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "CRUD" },
        { type: "note", description: "เดิม SI.4 · ตรงกับ TC-IADJ-050001 ใน gap report (ลบได้โดยไม่ต้องกด Edit)" },
      ],
    },
    async ({ page, signals }) => {
      signals.minor(new RegExp(`GET .*/stock-ins/${draftId} → 404`), "refetch of the just-deleted document");
      await adj.expectDraftDeleted(page, "stock-in", draftId);
    },
  );

  test(
    "TC-IADJ-700006 FC สร้าง Stock In แล้ว Commit ได้ completed และลงสต๊อก",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น fc@carmen.com; BU CARMEN-AVG; ตรวจ inventory transaction จาก API" },
        { type: "steps", description: "1. สร้าง Stock In ใหม่: A × 2 ต้นทุน 50, B × 2 ต้นทุน 40 ที่ 1FO02\n2. กด Commit\n3. ยืนยัน" },
        { type: "expected", description: "หลังบ้าน doc_status = completed, รายการ 11020001×2@50, 55000001×2@40; inventory-transactions ของใบนี้รับเข้ารวม 4 หน่วย (ให้ Stock Out มีของจ่าย)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
        { type: "note", description: "เดิม SI.5 · ใกล้ TC-IADJ-060002 ใน gap report (เคสนี้ commit จากหน้า new โดยตรง)" },
      ],
    },
    async ({ page }) => {
      await adj.expectCommitted(page, "stock-in", [
        { product: PROD.A.code, qty: 2, price: 50 },
        { product: PROD.B.code, qty: 2, price: 40 },
      ]);
    },
  );
});

// ── Stock Out (section 71) ──────────────────────────────────────────────────────

test.describe("Stock Out", () => {
  test.describe.configure({ mode: "serial" });
  let draftId = "";
  const LINES: AdjLine[] = [
    { product: PROD.A.code, qty: 1 },
    { product: PROD.B.code, qty: 1 },
  ];
  const EDITED: AdjLine[] = [
    { product: PROD.A.code, qty: 2 },
    { product: PROD.B.code, qty: 1 },
  ];
  const DESC = `FE-CRUD SO ${stamp}`;

  test(
    "TC-IADJ-710001 FC เปิดหน้าสร้าง Stock Out ได้โดยไม่ขึ้น Permission Denied",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น fc@carmen.com (movement-setup); BU CARMEN-AVG; role ของ fc มี inventory_management.stock_out.create และ inventory_adjustment.create (คีย์ย่อย)" },
        { type: "steps", description: "1. เปิด /inventory-management/inventory-adjustment/new?type=stock-out\n2. รอหน้าโหลด" },
        { type: "expected", description: "ไม่มีกล่อง alert \"Permission Denied\" และช่อง #inv-adj-description แสดง" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Authorization" },
        { type: "note", description: "เดิม SO.0 · regression ของ FE-6" },
      ],
    },
    async ({ page }) => {
      await adj.expectFormOpens(page, "stock-out");
      await observed("form opened");
    },
  );

  test(
    "TC-IADJ-710002 FC สร้าง Stock Out draft 2 รายการแล้วหลังบ้านเก็บจำนวนครบ",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น fc@carmen.com; BU CARMEN-AVG; คลัง 1FO02; เหตุผล \"Test stock_out\" มีอยู่" },
        { type: "steps", description: "1. เปิดหน้าสร้าง Stock Out\n2. Date = วันในงวด active, Reason \"Test stock_out\", Location 1FO02\n3. Add Item: A × 1, B × 1\n4. ใส่คำอธิบาย FE-CRUD SO <stamp>\n5. กด Save" },
        { type: "expected", description: "POST ตอบ < 300; หลังบ้าน doc_status = draft, description ตรง และรายการ 11020001×1, 55000001×1" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
        { type: "note", description: "เดิม SO.1 · ใกล้ TC-IADJ-030003 ใน gap report (ยังไม่ได้ตรวจว่าตารางไม่มีคอลัมน์ Cost/Unit)" },
      ],
    },
    async ({ page }) => {
      draftId = await adj.expectDraftCreated(page, "stock-out", LINES, DESC);
    },
  );

  test(
    "TC-IADJ-710003 FC เปิด Stock Out draft แล้วเห็นจำนวนและต้นทุนประเมินที่ไม่ใช่ 0",
    {
      annotation: [
        { type: "preconditions", description: "TC-IADJ-710002 ผ่านแล้วในรอบเดียวกัน (serial) — มี Stock Out draft" },
        { type: "steps", description: "1. เปิด /inventory-management/inventory-adjustment/<id>?type=stock-out\n2. รอต้นทุนประเมินโหลด แล้วอ่านแถวรายการ" },
        { type: "expected", description: "หน้าแสดงคำอธิบาย FE-CRUD SO <stamp>; แถว A และ B มีจำนวน 1 และต้นทุนประเมินไม่เป็น 0.00" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
        { type: "note", description: "บั๊กที่รู้อยู่ FE-5 (test.fail): ใบ SO draft ไม่เก็บต้นทุน (คิดตอน commit) — ตอนสร้างฟอร์มประเมินให้ แต่เปิดใบกลับมาขึ้น 0.00 ทุกแถว · เดิม SO.2" },
      ],
    },
    async ({ page }) => {
      test.fail(true, "known bug FE-5: a reopened Stock Out draft shows estimated cost 0.00");
      const seen = await adj.expectDraftShown(page, "stock-out", draftId, LINES, DESC);
      const zero = seen.filter((t) => /\s0\.00\s*$/.test(t));
      expect(zero, `estimated cost lost on reopen: ${seen.join(" · ")}`).toHaveLength(0);
    },
  );

  test(
    "TC-IADJ-710004 FC แก้ Stock Out draft (คำอธิบาย + จำนวน + ลบรายการ + เพิ่มรายการ)",
    {
      annotation: [
        { type: "preconditions", description: "TC-IADJ-710002 ผ่านแล้วในรอบเดียวกัน (serial) — Stock Out draft มี A×1, B×1" },
        { type: "steps", description: "1. เปิดใบ แล้วกด Edit\n2. แก้คำอธิบายเป็น \"... (แก้)\"\n3. A → จำนวน 2\n4. ลบแถว B\n5. Add Item: B กลับมาเป็นบรรทัดใหม่ จำนวน 1\n6. กด Save" },
        { type: "expected", description: "Save ส่งคำขอและตอบ < 300; ใบยังเป็น draft; หลังบ้านเก็บคำอธิบายใหม่ และรายการ 11020001×2, 55000001×1" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
        { type: "note", description: "บั๊กที่รู้อยู่ FE-4 (test.fail): แก้จำนวนแถวเดิมของ SO → Total เป็น NaN แล้ว Save ไม่ยิงคำขอเลย (zod ตีกลับเงียบ ๆ ไม่มี toast) · เดิม SO.3" },
      ],
    },
    async ({ page }) => {
      test.fail(true, "known bug FE-4: editing an existing Stock Out line's qty makes Total NaN and Save sends nothing");
      await adj.expectDraftEdited(page, "stock-out", draftId, EDITED, `${DESC} (แก้)`);
    },
  );

  test(
    "TC-IADJ-710005 FC ลบ Stock Out draft จากโหมดดูแล้วใบหายจากหลังบ้าน",
    {
      annotation: [
        { type: "preconditions", description: "TC-IADJ-710002 ผ่านแล้วในรอบเดียวกัน (serial) — Stock Out draft ยังอยู่" },
        { type: "steps", description: "1. เปิดใบ (โหมดดู)\n2. กด Delete\n3. ยืนยัน Delete ใน dialog" },
        { type: "expected", description: "GET ใบนั้นไม่พบแล้ว และหน้าจอออกจาก URL ของใบกลับไปหน้ารายการ" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "CRUD" },
        { type: "note", description: "เดิม SO.4" },
      ],
    },
    async ({ page, signals }) => {
      signals.minor(new RegExp(`GET .*/stock-outs/${draftId} → 404`), "refetch of the just-deleted document");
      await adj.expectDraftDeleted(page, "stock-out", draftId);
    },
  );

  test(
    "TC-IADJ-710006 FC สร้าง Stock Out แล้ว Commit ได้ completed และตัดสต๊อก",
    {
      annotation: [
        { type: "preconditions", description: "TC-IADJ-700006 commit Stock In ไปแล้ว (1FO02 มี A อย่างน้อย 1); ตรวจ inventory transaction จาก API" },
        { type: "steps", description: "1. สร้าง Stock Out ใหม่: A × 1 ที่ 1FO02\n2. กด Commit\n3. ยืนยัน" },
        { type: "expected", description: "หลังบ้าน doc_status = completed, รายการ 11020001×1; inventory-transactions ของใบนี้จ่ายออกรวม 1 หน่วย" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
        { type: "note", description: "เดิม SO.5" },
      ],
    },
    async ({ page }) => {
      await adj.expectCommitted(page, "stock-out", [{ product: PROD.A.code, qty: 1 }]);
    },
  );
});
