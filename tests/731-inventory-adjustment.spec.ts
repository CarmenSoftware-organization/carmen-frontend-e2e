import { expect, type Locator, type Page } from "@playwright/test";
import { createAuthTest } from "./fixtures/auth.fixture";
import { cleanupIaRun, assertIaReady, getIa, stockAt, typeCost, type IaReady, type IaType } from "./helpers/ia-api";
import { addRow, confirmDialog, numRe, pickDate, pickLookup, typeInto } from "./helpers/movement/ui";
import { expectSaved } from "./helpers/settle";
import { uid } from "./helpers/test-data";
import { InventoryAdjustmentPage } from "./pages/inventory-adjustment.page";

/**
 * Inventory Adjustment doc flow (Stock In = section 70, Stock Out = section 71) on the TEST BU (GR2VYNKQ) as Admin.
 * Moved from the opt-in movement suite (730, CARMEN-AVG) into the main suite. Products E2E-IA-A / E2E-IA-B at their single
 * location and the reasons E2E-IA-IN / E2E-IA-OUT come from `data:reset` (step `ia`); `assertIaReady()` fails loudly when
 * any of it is missing. Every document carries `E2E-IA 731 ...` in its description so `cleanupIaRun("731")` (afterAll) can
 * void what the spec committed and delete its drafts, which keeps a re-run without a reset clean.
 * open form → draft → view → edit (description + qty/cost + remove B, re-add B as a new line) → delete → new + Commit.
 * Stock In commits A/B x2 so the Stock Out commit has stock to draw on.
 *
 * Known bug pinned with `test.fail()` (turns red once fixed):
 *  - TC-IADJ-710003  FE-5: a reopened Stock Out draft shows estimated cost 0.00 (Cost/Unit; Total Cost carries the estimate now)
 * FE-4 (710004: editing an existing Stock Out line's qty made Total NaN and Save sent nothing) no longer reproduces; its pin was removed.
 *
 * Gap report for the cases this spec does not cover: docs/test-cases/gaps/730-inventory-adjustment-gap.md.
 */
const test = createAuthTest("carmensoftware.dev+admin@gmail.com");
test.describe.configure({ timeout: 180_000 });

interface AdjLine {
  product: string;
  qty: number;
  price?: number;
}

const TAG = `E2E-IA 731`;
// The Reason lookup lists adjustment types by name; these are the names data:reset (step `ia`) gives E2E-IA-IN / E2E-IA-OUT.
const REASON_NAME_IN = "E2E IA stock in";
const REASON_NAME_OUT = "E2E IA stock out";
const ready: { v: IaReady | null } = { v: null };
const R = () => ready.v as IaReady;


const fmtOf = (type: IaType) => (ls: AdjLine[]) =>
  ls.map((l) => `${l.product}×${l.qty}${type === "stock-in" ? `@${l.price}` : ""}`).sort().join(", ");

const itemRow = (page: Page, code: string) => page.locator("table tbody tr").filter({ hasText: code }).first();
const writeUrl = (type: IaType) => new RegExp(`/${type}s/`);

/** The document as the backend holds it (status "deleted" when the GET no longer finds it). */
async function byId(type: IaType, id: string) {
  const { status, body } = await getIa(type, id);
  const d = (body as any)?.data;
  if (status !== 200 || !d) return { status: "deleted", no: "", desc: "", lines: [] as AdjLine[] };
  return {
    status: d.doc_status as string,
    no: (d.si_no ?? d.so_no) as string,
    desc: (d.description ?? "") as string,
    lines: ((d.stock_in_detail ?? d.stock_out_detail ?? []) as any[]).map((x) => ({
      product: x.product?.code as string,
      qty: Number(x.qty),
      ...(type === "stock-in" ? { price: Number(x.cost_per_unit) } : {}),
    })) as AdjLine[],
  };
}

// ── shared steps ────────────────────────────────────────────────────────────────

async function expectFormOpens(page: Page, type: IaType) {
  const ia = new InventoryAdjustmentPage(page);
  await ia.gotoNew(type);
  await expect(ia.description()).toBeVisible();
  // FE-6: the route guard checked inventory_management.view (module key) while roles grant the
  // sub-keys inventory_management.inventory_adjustment.* — accounts with the real permission were locked out.
  const denied = page.getByRole("alert").filter({ hasText: /Permission Denied/i });
  await expect(denied, "Permission Denied — the route guard must accept the inventory_adjustment sub-keys").toHaveCount(0);
}

/** Fill header + lines on /new (stops before any save). The description goes in after the lines. */
async function fillNew(page: Page, type: IaType, lines: AdjLine[], desc: string) {
  const ia = new InventoryAdjustmentPage(page);
  await ia.gotoNew(type);
  expect(await pickDate(page, ia.dateTrigger(), R().today), `Date ${R().today}`).toBe(true);
  await pickLookup(page, ia.reason(), type === "stock-in" ? REASON_NAME_IN : REASON_NAME_OUT);
  await pickLookup(page, ia.location(), R().locationName);
  for (const line of lines) {
    const row = await addRow(page, "Select Product");
    await pickLookup(page, row.getByRole("button", { name: "Select Product" }), line.product);
    await typeInto(row.locator('input[name$=".qty"]'), line.qty);
    if (type === "stock-in") {
      await typeCost(row.locator('input[name$=".cost_per_unit"]'), line.price!);
    }
  }
  if (type === "stock-in") {
    // A later row's CostProbe answer can still overwrite an earlier cost: settle, then pin every cost again before saving.
    await page.waitForLoadState("networkidle");
    for (const line of lines) await typeCost(itemRow(page, line.product).locator('input[name$=".cost_per_unit"]'), line.price!);
  }
  await ia.description().fill(desc);
}

async function expectDraftCreated(page: Page, type: IaType, lines: AdjLine[], desc: string): Promise<string> {
  const ia = new InventoryAdjustmentPage(page);
  await fillNew(page, type, lines, desc);
  const res = await expectSaved(
    page,
    new RegExp(`/${type}s/?(\\?|$)`),
    () => ia.saveButton().click(),
    page.locator("[data-sonner-toast]"),
  );
  const id: string = (await res.json()).data.id;
  const d = await byId(type, id);
  expect(d.status).toBe("draft");
  expect(d.desc).toBe(desc);
  expect(fmtOf(type)(d.lines)).toBe(fmtOf(type)(lines));
  return id;
}

async function expectDraftShown(page: Page, type: IaType, id: string, lines: AdjLine[], desc: string): Promise<string[]> {
  const ia = new InventoryAdjustmentPage(page);
  await ia.gotoDoc(type, id);
  await expect(page.getByText(desc).first()).toBeVisible();
  const seen: string[] = [];
  for (const l of lines) {
    const row = itemRow(page, l.product);
    await expect(row).toBeVisible();
    await page.waitForLoadState("networkidle"); // the Stock Out estimated cost arrives later
    const all = (await row.innerText()).replace(/\s+/g, " ").replace(/,/g, "");
    expect(all, `${l.product} qty`).toMatch(numRe(l.qty));
    if (type === "stock-in") expect(all, `${l.product} cost`).toMatch(numRe(l.price!));
    seen.push(`${l.product}: ${all.slice(0, 90)}`);
  }
  return seen;
}

/** The location holds only A and B, so "add a line" re-adds B as a new line after removing the old one. */
async function expectDraftEdited(page: Page, type: IaType, id: string, edited: AdjLine[], desc: string) {
  const ia = new InventoryAdjustmentPage(page);
  const isIn = type === "stock-in";
  await ia.gotoDoc(type, id);
  await page.getByRole("button", { name: "Edit", exact: true }).filter({ visible: true }).first().click();
  await ia.description().fill(desc);
  const a = itemRow(page, edited[0].product);
  await typeInto(a.locator('input[name$=".qty"]'), edited[0].qty);
  if (isIn) await typeCost(a.locator('input[name$=".cost_per_unit"]'), edited[0].price!);
  await itemRow(page, R().productB.code).getByRole("button", { name: "Remove" }).click();
  const dlg = page.locator("[role=alertdialog]:visible");
  if (await dlg.count()) await confirmDialog(page, /remove|delete|confirm|ลบ/i);
  await expect(itemRow(page, R().productB.code)).toHaveCount(0);
  const row = await addRow(page, "Select Product");
  await pickLookup(page, row.getByRole("button", { name: "Select Product" }), edited[1].product);
  const added = itemRow(page, edited[1].product);
  await typeInto(added.locator('input[name$=".qty"]'), edited[1].qty);
  if (isIn) await typeCost(added.locator('input[name$=".cost_per_unit"]'), edited[1].price!);
  // Save must go out and succeed (FE-4 once sent nothing for an edited existing Stock Out line).
  await expectSaved(page, writeUrl(type), () => ia.saveButton().click(), page.locator("[data-sonner-toast]"));
  await expect.poll(async () => fmtOf(type)((await byId(type, id)).lines), { timeout: 15_000 }).toBe(fmtOf(type)(edited));
  const d = await byId(type, id);
  expect(d.status).toBe("draft");
  expect(d.desc).toBe(desc);
}

async function expectDraftDeleted(page: Page, type: IaType, id: string) {
  const ia = new InventoryAdjustmentPage(page);
  await ia.gotoDoc(type, id);
  await ia.deleteButton().click();
  await confirmDialog(page, /^delete$/i);
  await expect.poll(async () => (await byId(type, id)).status, { timeout: 30_000 }).toBe("deleted");
  await expect(page).not.toHaveURL(new RegExp(id), { timeout: 15_000 });
}

async function expectCommitted(page: Page, type: IaType, lines: AdjLine[], desc: string) {
  const ia = new InventoryAdjustmentPage(page);
  const r = R();
  const before = new Map<string, number>();
  for (const l of lines) {
    const p = l.product === r.productA.code ? r.productA : r.productB;
    before.set(l.product, (await stockAt(p.id, r.locationId, r.today)).qty);
  }
  await fillNew(page, type, lines, desc);
  const res = await expectSaved(
    page,
    new RegExp(`/${type}s/?(\\?|$)`),
    async () => {
      await ia.commitButton().click();
      await confirmDialog(page, /commit/i);
    },
    page.locator("[data-sonner-toast]"),
  );
  const id: string = (await res.json()).data.id;
  await expect.poll(async () => (await byId(type, id)).status, { timeout: 60_000 }).toBe("completed");
  const d = await byId(type, id);

  expect(fmtOf(type)(d.lines)).toBe(fmtOf(type)(lines));
  for (const l of lines) {
    const p = l.product === r.productA.code ? r.productA : r.productB;
    const after = (await stockAt(p.id, r.locationId, r.today)).qty;
    const delta = after - before.get(l.product)!;
    expect(delta, `${l.product} on-hand moved by the committed qty`).toBe(type === "stock-in" ? l.qty : -l.qty);
  }
}

const adj = { expectFormOpens, expectDraftCreated, expectDraftShown, expectDraftEdited, expectDraftDeleted, expectCommitted };
const A = () => R().productA.code;
const B = () => R().productB.code;

// One outer serial group owns the hooks and the order: with a serial group per describe, Playwright ran the afterAll
// after the Stock In group, which voided the Stock In the Stock Out cases draw on.
test.describe("Inventory Adjustment doc flow", () => {
test.describe.configure({ mode: "serial" });
test.beforeAll(async () => {
  ready.v = await assertIaReady();
});
test.afterAll(async () => {
  await cleanupIaRun("731");
});

// ── Stock In (section 70) ───────────────────────────────────────────────────────

test.describe("Stock In", () => {
  let draftId = "";
  const DESC = `${TAG} SI ${uid}`;
  const lines = (): AdjLine[] => [
    { product: A(), qty: 3, price: 100 },
    { product: B(), qty: 5, price: 200 },
  ];
  const edited = (): AdjLine[] => [
    { product: A(), qty: 7, price: 120 },
    { product: B(), qty: 2, price: 300 },
  ];

  test(
    "TC-IADJ-700001 FC เปิดหน้าสร้าง Stock In ได้โดยไม่ขึ้น Permission Denied",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Admin (carmensoftware.dev+admin@gmail.com); BU TEST (GR2VYNKQ); role มีคีย์ย่อย inventory_management.stock_in.create และ inventory_adjustment.create" },
        { type: "steps", description: "1. เปิด /inventory-management/inventory-adjustment/new?type=stock-in\n2. รอหน้าโหลด" },
        { type: "expected", description: "ไม่มีกล่อง alert \"Permission Denied\" และช่อง #inv-adj-description แสดง" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Authorization" },
        { type: "note", description: "เดิม SI.0 · regression ของ FE-6 (route guard เช็คคีย์ระดับโมดูล) · ย้ายจาก CARMEN-AVG (fc) มา TEST BU (Admin) · gap TC-IADJ-100001 ถือว่า \"ไม่มี inventory_management.view → AccessDenied\" เป็นพฤติกรรมที่ตั้งใจ — ต้องทบทวนว่ายังจริงอยู่ไหม" },
      ],
    },
    async ({ page }) => {
      await adj.expectFormOpens(page, "stock-in");
    },
  );

  test(
    "TC-IADJ-700002 FC สร้าง Stock In draft 2 รายการแล้วหลังบ้านเก็บจำนวนและต้นทุนครบ",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Admin; BU TEST; คลังที่ E2E-IA-A / E2E-IA-B ผูกอยู่ (data:reset ขั้น ia); เหตุผล E2E-IA-IN มีอยู่" },
        { type: "steps", description: "1. เปิดหน้าสร้าง Stock In\n2. Date = วันนี้, Reason E2E IA stock in, Location ของสินค้า E2E-IA\n3. Add Item: E2E-IA-A × 3 ต้นทุน 100, E2E-IA-B × 5 ต้นทุน 200\n4. ใส่คำอธิบาย E2E-IA 731 SI <uid> (หลังเพิ่มรายการ)\n5. กด Save" },
        { type: "expected", description: "POST ตอบ < 300; หลังบ้าน doc_status = draft, description ตรง และรายการ E2E-IA-A×3@100, E2E-IA-B×5@200" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
        { type: "note", description: "เดิม SI.1 · ใกล้ TC-IADJ-030002/030004 ใน gap report (เคสนี้ตรวจค่าที่หลังบ้านเก็บด้วย)" },
      ],
    },
    async ({ page }) => {
      draftId = await adj.expectDraftCreated(page, "stock-in", lines(), DESC);
    },
  );

  test(
    "TC-IADJ-700003 FC เปิด Stock In draft แล้วเห็นจำนวนและต้นทุนตามที่บันทึก",
    {
      annotation: [
        { type: "preconditions", description: "TC-IADJ-700002 ผ่านแล้วในรอบเดียวกัน (serial) — มี Stock In draft" },
        { type: "steps", description: "1. เปิด /inventory-management/inventory-adjustment/<id>?type=stock-in\n2. อ่านคำอธิบายและแถวรายการ" },
        { type: "expected", description: "หน้าแสดงคำอธิบาย E2E-IA 731 SI <uid>; แถว E2E-IA-A มีจำนวน 3 ต้นทุน 100; แถว E2E-IA-B มีจำนวน 5 ต้นทุน 200" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "CRUD" },
        { type: "note", description: "เดิม SI.2 · ใกล้ TC-IADJ-020001/020009 ใน gap report" },
      ],
    },
    async ({ page }) => {
      await adj.expectDraftShown(page, "stock-in", draftId, lines(), DESC);
    },
  );

  test(
    "TC-IADJ-700004 FC แก้ Stock In draft (คำอธิบาย + จำนวน/ต้นทุน + ลบรายการ + เพิ่มรายการ)",
    {
      annotation: [
        { type: "preconditions", description: "TC-IADJ-700002 ผ่านแล้วในรอบเดียวกัน (serial) — Stock In draft มี E2E-IA-A×3@100, E2E-IA-B×5@200" },
        { type: "steps", description: "1. เปิดใบ แล้วกด Edit\n2. แก้คำอธิบายเป็น \"... (แก้)\"\n3. E2E-IA-A → จำนวน 7 ต้นทุน 120\n4. ลบแถว E2E-IA-B\n5. Add Item: E2E-IA-B กลับมาเป็นบรรทัดใหม่ จำนวน 2 ต้นทุน 300\n6. กด Save" },
        { type: "expected", description: "Save ส่งคำขอและตอบ < 300; ใบยังเป็น draft; หลังบ้านเก็บคำอธิบายใหม่ และรายการ E2E-IA-A×7@120, E2E-IA-B×2@300" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
        { type: "note", description: "เดิม SI.3 · gap TC-IADJ-040001 แก้แค่คำอธิบาย — เคสนี้แก้บรรทัดและลบบรรทัดด้วย" },
      ],
    },
    async ({ page }) => {
      await adj.expectDraftEdited(page, "stock-in", draftId, edited(), `${DESC} (แก้)`);
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
    async ({ page }) => {
      await adj.expectDraftDeleted(page, "stock-in", draftId);
    },
  );

  test(
    "TC-IADJ-700006 FC สร้าง Stock In แล้ว Commit ได้ completed และลงสต๊อก",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Admin; BU TEST; อ่านสต๊อกคงเหลือของ E2E-IA-A / E2E-IA-B ก่อนและหลังจาก API (inventory-info)" },
        { type: "steps", description: "1. สร้าง Stock In ใหม่: E2E-IA-A × 2 ต้นทุน 50, E2E-IA-B × 2 ต้นทุน 40\n2. กด Commit\n3. ยืนยัน" },
        { type: "expected", description: "หลังบ้าน doc_status = completed, รายการ E2E-IA-A×2@50, E2E-IA-B×2@40; สต๊อกคงเหลือของแต่ละสินค้าเพิ่มขึ้น 2 หน่วย (ให้ Stock Out มีของจ่าย)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
        { type: "note", description: "เดิม SI.5 · ใกล้ TC-IADJ-060002 ใน gap report (เคสนี้ commit จากหน้า new โดยตรง) · เทียบส่วนต่างของสต๊อกที่อ่านสด ไม่ยึดค่าสัมบูรณ์" },
      ],
    },
    async ({ page }) => {
      await adj.expectCommitted(
        page,
        "stock-in",
        [
          { product: A(), qty: 2, price: 50 },
          { product: B(), qty: 2, price: 40 },
        ],
        `${TAG} SI commit ${uid}`,
      );
    },
  );
});

// ── Stock Out (section 71) ──────────────────────────────────────────────────────

test.describe("Stock Out", () => {
  let draftId = "";
  const DESC = `${TAG} SO ${uid}`;
  const lines = (): AdjLine[] => [
    { product: A(), qty: 1 },
    { product: B(), qty: 1 },
  ];
  const edited = (): AdjLine[] => [
    { product: A(), qty: 2 },
    { product: B(), qty: 1 },
  ];

  test(
    "TC-IADJ-710001 FC เปิดหน้าสร้าง Stock Out ได้โดยไม่ขึ้น Permission Denied",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Admin; BU TEST; role มีคีย์ย่อย inventory_management.stock_out.create และ inventory_adjustment.create" },
        { type: "steps", description: "1. เปิด /inventory-management/inventory-adjustment/new?type=stock-out\n2. รอหน้าโหลด" },
        { type: "expected", description: "ไม่มีกล่อง alert \"Permission Denied\" และช่อง #inv-adj-description แสดง" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Authorization" },
        { type: "note", description: "เดิม SO.0 · regression ของ FE-6" },
      ],
    },
    async ({ page }) => {
      await adj.expectFormOpens(page, "stock-out");
    },
  );

  test(
    "TC-IADJ-710002 FC สร้าง Stock Out draft 2 รายการแล้วหลังบ้านเก็บจำนวนครบ",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Admin; BU TEST; คลังที่ E2E-IA-A / E2E-IA-B ผูกอยู่; เหตุผล E2E-IA-OUT มีอยู่" },
        { type: "steps", description: "1. เปิดหน้าสร้าง Stock Out\n2. Date = วันนี้, Reason E2E IA stock out, Location ของสินค้า E2E-IA\n3. Add Item: E2E-IA-A × 1, E2E-IA-B × 1\n4. ใส่คำอธิบาย E2E-IA 731 SO <uid>\n5. กด Save" },
        { type: "expected", description: "POST ตอบ < 300; หลังบ้าน doc_status = draft, description ตรง และรายการ E2E-IA-A×1, E2E-IA-B×1" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
        { type: "note", description: "เดิม SO.1 · ใกล้ TC-IADJ-030003 ใน gap report (ยังไม่ได้ตรวจว่าตารางไม่มีคอลัมน์ Cost/Unit)" },
      ],
    },
    async ({ page }) => {
      draftId = await adj.expectDraftCreated(page, "stock-out", lines(), DESC);
    },
  );

  test(
    "TC-IADJ-710003 FC เปิด Stock Out draft แล้วเห็นจำนวนและต้นทุนประเมินที่ไม่ใช่ 0",
    {
      annotation: [
        { type: "preconditions", description: "TC-IADJ-710002 ผ่านแล้วในรอบเดียวกัน (serial) — มี Stock Out draft" },
        { type: "steps", description: "1. เปิด /inventory-management/inventory-adjustment/<id>?type=stock-out\n2. รอต้นทุนประเมินโหลด แล้วอ่านแถวรายการ" },
        { type: "expected", description: "หน้าแสดงคำอธิบาย E2E-IA 731 SO <uid>; แถว E2E-IA-A และ E2E-IA-B มีจำนวน 1 และต้นทุนประเมินไม่เป็น 0.00" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
        { type: "note", description: "บั๊กที่รู้อยู่ FE-5 (test.fail): ใบ SO draft ไม่เก็บต้นทุน (คิดตอน commit) — ตอนสร้างฟอร์มประเมินให้ แต่เปิดใบกลับมา Cost/Unit ขึ้น 0.00 ทุกแถว (Total Cost แสดงค่าประเมินแล้ว — R9) · เดิม SO.2" },
      ],
    },
    async ({ page }) => {
      const stored = await byId("stock-out", draftId);
      expect(stored.status, "the draft must exist before the pin").toBe("draft");
      await adj.expectDraftShown(page, "stock-out", draftId, lines(), DESC);
      // On TEST BU the Total Cost column now carries the estimate (-50.00 / -40.00); the Cost/Unit column of the same row is still 0.00.
      const heads = (await page.locator("table thead th").allInnerTexts()).map((t) => t.trim());
      const col = heads.findIndex((t) => /Cost\/Unit/i.test(t));
      expect(col, `Cost/Unit column in the view table (headers: ${heads.join(" | ")})`).toBeGreaterThanOrEqual(0);
      const costs: string[] = [];
      for (const l of lines()) costs.push((await itemRow(page, l.product).locator("td").nth(col).innerText()).trim());
      expect(costs, "a Cost/Unit cell was read for every line").toHaveLength(lines().length);
      // Pinned only now: the page opened, the rows and qty matched and the Cost/Unit column was found.
      test.fail(true, "known bug FE-5: a reopened Stock Out draft shows estimated cost 0.00 (Cost/Unit; Total Cost carries the estimate now)");
      expect(costs.filter((c) => /^0(\.0+)?$/.test(c)), `estimated cost lost on reopen: Cost/Unit per row = ${costs.join(" · ")}`).toHaveLength(0);
    },
  );

  test(
    "TC-IADJ-710004 FC แก้ Stock Out draft (คำอธิบาย + จำนวน + ลบรายการ + เพิ่มรายการ)",
    {
      annotation: [
        { type: "preconditions", description: "TC-IADJ-710002 ผ่านแล้วในรอบเดียวกัน (serial) — Stock Out draft มี E2E-IA-A×1, E2E-IA-B×1" },
        { type: "steps", description: "1. เปิดใบ แล้วกด Edit\n2. แก้คำอธิบายเป็น \"... (แก้)\"\n3. E2E-IA-A → จำนวน 2\n4. ลบแถว E2E-IA-B\n5. Add Item: E2E-IA-B กลับมาเป็นบรรทัดใหม่ จำนวน 1\n6. กด Save" },
        { type: "expected", description: "Save ส่งคำขอและตอบ < 300; ใบยังเป็น draft; หลังบ้านเก็บคำอธิบายใหม่ และรายการ E2E-IA-A×2, E2E-IA-B×1" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
        { type: "note", description: "FE-4 (เดิม test.fail: แก้จำนวนแถวเดิมของ SO → Total เป็น NaN แล้ว Save ไม่ยิงคำขอเลย) แก้แล้ว — ถอด pin ออก 23 พ.ย. เพราะเคสผ่านบน TEST BU ทุกรอบ · เดิม SO.3" },
      ],
    },
    async ({ page }) => {
      await adj.expectDraftEdited(page, "stock-out", draftId, edited(), `${DESC} (แก้)`);
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
    async ({ page }) => {
      await adj.expectDraftDeleted(page, "stock-out", draftId);
    },
  );

  test(
    "TC-IADJ-710006 FC สร้าง Stock Out แล้ว Commit ได้ completed และตัดสต๊อก",
    {
      annotation: [
        { type: "preconditions", description: "TC-IADJ-700006 commit Stock In ไปแล้ว (คลังมี E2E-IA-A อย่างน้อย 1); อ่านสต๊อกคงเหลือก่อนและหลังจาก API (inventory-info)" },
        { type: "steps", description: "1. สร้าง Stock Out ใหม่: E2E-IA-A × 1 ที่คลังของสินค้า E2E-IA\n2. กด Commit\n3. ยืนยัน" },
        { type: "expected", description: "หลังบ้าน doc_status = completed, รายการ E2E-IA-A×1; สต๊อกคงเหลือของ E2E-IA-A ลดลง 1 หน่วย" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
        { type: "note", description: "เดิม SO.5 · เทียบส่วนต่างของสต๊อกที่อ่านสด ไม่ยึดค่าสัมบูรณ์" },
      ],
    },
    async ({ page }) => {
      await adj.expectCommitted(page, "stock-out", [{ product: A(), qty: 1 }], `${TAG} SO commit ${uid}`);
    },
  );
});
});
