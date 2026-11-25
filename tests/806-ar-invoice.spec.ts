import { expect } from "@playwright/test";
import { createAuthTest } from "./fixtures/auth.fixture";
import { ArInvoicePage } from "./pages/ar-invoice.page";
import { buSend } from "./helpers/bu-api";
import {
  arWorkflowActive,
  createArDoc,
  getArDoc,
  referenceCandidates,
  seededArDoc,
  setArWorkflowActive,
  submitArDoc,
  voidArDoc,
  type ArLine,
} from "./helpers/ar-api";
import { assertAccountingReady, buDecimals, CREATOR, jvOfSource, listAllRows, type JvLine } from "./helpers/gl-api";
import { docAmounts, expectBalanced, round, type MoneyLine } from "./helpers/money";
import { expectBlocked, expectSaved } from "./helpers/settle";
import { uid } from "./helpers/test-data";

// ─────────────────────────────────────────────────────────────────────────
// AR invoice on the TEST BU (BU-GR2VYNKQ), money path: list, detail, create, edit, post, debit / credit notes,
// credit-note application, void, viewer. Section 08 (the ar_invoice approval workflow) is a later describe.
//
// Roles: Admin creates / edits / deletes / submits / voids (UI + API, a BU admin bypasses the permission keys);
// Requestor is the viewer (accounting.ar.view only). With no active `ar_invoice` workflow Submit posts, so the
// beforeAll switches the workflow off if a crashed run left it on.
// Read set (never mutated, seeded by `bun run data:reset --yes`, found by description `STD ar.<row> <KEY>`):
// E2E-AR-POSTED (one line 3 x 333.33 VAT 7%: net 999.99, VAT 70.00, total 1,069.99, tax invoice TXIV...) ·
// E2E-AR-DRAFT (1 x 500.00 VAT 7%: 535.00) · E2E-AR-CN (credit note 107.00) · E2E-AR-DN (debit note 200.00, no VAT) ·
// E2E-AR-VOID (invoice 300.00, voided). Customers E2E-CUST-1 (AR account 1130) and E2E-CUST-2 (none: gl_setting default).
// Every state-changing case creates its own document tagged `E2E-T-806-<case>-<uid>`, so the spec re-runs without a reset.
//
// Expected amounts come from tests/helpers/money.ts (or the literals above), never from the BE echo. Output VAT: the
// design expects the VAT leg on gl_setting.output_vat_account_id (2160). The VAT leg is asserted only in the four
// dedicated cases (invoice 040003, debit note 050002, credit note 050004, void reversal 070003), which are pinned
// with test.fail; every other posting case only asserts that a VAT leg of the right amount exists. The FE never ticks
// "Tax invoice" (mock supplement), so tax-invoice cases create through the API.
// ─────────────────────────────────────────────────────────────────────────
const test = createAuthTest("carmensoftware.dev+admin@gmail.com");
const requestorTest = createAuthTest("carmensoftware.dev+requestor@gmail.com");

test.describe.configure({ timeout: 90_000 });
requestorTest.describe.configure({ timeout: 60_000 });

const tag = (key: string) => `E2E-T-806-${key}-${uid}`;
const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const toMoney = (lines: ArLine[]): MoneyLine[] => lines.map((l) => ({ qty: l.qty, price: l.price, vat: !!l.vat }));

const VAT_PIN =
  "suspected bug: AR output VAT posts to the tax profile's account (1170 Input VAT) instead of gl_setting.output_vat_account_id (2160 Output VAT); see docs/superpowers/specs/2026-11-25-e2e-ar-invoice-bug-list.md";

/** Sum of debit / credit of one account across JV lines. */
function sum(lines: JvLine[], account: string, side: "dr" | "cr"): number {
  return round(lines.filter((l) => l.account === account).reduce((s, l) => s + l[side], 0), 4);
}

/** A VAT leg of `amount` on some account other than receivable / revenue, on the given side. */
function hasVatLeg(lines: JvLine[], amount: number, side: "dr" | "cr"): boolean {
  return lines.some((l) => l.account !== "1130" && l.account !== "4100" && round(l[side], 2) === amount);
}

/** The document a spec created through the UI, found by the tag in its description. */
async function docByTag(t: string) {
  const hit = (await listAllRows(CREATOR, `/ar-invoice?search=${encodeURIComponent(t)}`)).find((d) => String(d.description ?? "").includes(t));
  return hit ? getArDoc(String(hit.id)) : null;
}

/** Create and post a document through the API (Admin). */
async function posted(docType: "invoice" | "debit_note" | "credit_note", key: string, lines: ArLine[], extra: { taxInvoice?: boolean; customer?: "E2E-CUST-1" | "E2E-CUST-2"; references?: { id: string; amount: number }[] } = {}) {
  const created = await createArDoc(docType, { tag: tag(key), lines, ...extra });
  const res = await submitArDoc(created.id);
  expect(res.status, JSON.stringify(res.body).slice(0, 300)).toBe(200);
  return { ...created, doc: await getArDoc(created.id) };
}

const MIXED: ArLine[] = [
  { qty: 2, price: 100, vat: true },
  { qty: 1, price: 999.99 },
];

test.describe("AR invoice (806)", () => {
  test.beforeAll(async () => {
    await assertAccountingReady();
    if (await arWorkflowActive()) {
      console.warn("806: ar_invoice workflow was ACTIVE (left by a crashed run); switching it off for the money cases");
      await setArWorkflowActive(false);
    }
  });

  // ── 01 list / detail ──────────────────────────────────────────────────
  test(
    "TC-ARINV-010001 รายการแสดงใบ read-set ครบ พร้อมยอด สถานะ และยอดค้าง",
    {
      annotation: [
        { type: "preconditions", description: "Admin login บน TEST BU; data:reset --yes แล้ว (มีใบ E2E-AR-POSTED / DRAFT / CN / DN / VOID)" },
        { type: "steps", description: "1. เปิด /accounting/accounts-receivable/invoice\n2. ค้น E2E-AR-\n3. ดูแถวของแต่ละใบ (หาจากเลขเอกสาร)" },
        {
          type: "expected",
          description:
            "POSTED = 1,069.99 ค้าง 1,069.99 Posted; DRAFT = 535.00 สถานะ Draft; CN = 107.00 ค้าง 107.00 Posted; DN = 200.00 ค้าง 200.00 Posted; VOID = 300.00 ค้าง 0.00 Void. assumption: ยอด POSTED = 3 x 333.33 + VAT 7% ปัดครึ่งขึ้นต่อบรรทัด",
        },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const ar = new ArInvoicePage(page);
      const [posted_, draft, cn, dn, voided] = await Promise.all(["E2E-AR-POSTED", "E2E-AR-DRAFT", "E2E-AR-CN", "E2E-AR-DN", "E2E-AR-VOID"].map(seededArDoc));
      await ar.gotoList();
      await ar.search("E2E-AR-");
      // exact cell matches: a substring match would let "0.00 THB" hit "1,070.00 THB"
      const cell = (no: string, text: string) => ar.row(no).getByRole("cell", { name: text, exact: true });
      const p = docAmounts([{ qty: 3, price: 333.33 }]);
      await expect(cell(posted_.no, `${fmt(p.total)} THB`)).toHaveCount(2); // total and outstanding
      await expect(ar.statusChip(ar.row(posted_.no))).toHaveText(/posted/i);
      await expect(cell(draft.no, `${fmt(docAmounts([{ qty: 1, price: 500 }]).total)} THB`)).toHaveCount(1);
      await expect(ar.statusChip(ar.row(draft.no))).toHaveText(/draft/i);
      await expect(cell(cn.no, `${fmt(docAmounts([{ qty: 1, price: 100 }]).total)} THB`)).toHaveCount(2);
      await expect(ar.statusChip(ar.row(cn.no))).toHaveText(/posted/i);
      await expect(cell(dn.no, `${fmt(docAmounts([{ qty: 1, price: 200, vat: false }]).total)} THB`)).toHaveCount(2);
      await expect(ar.statusChip(ar.row(dn.no))).toHaveText(/posted/i);
      await expect(cell(voided.no, "300.00 THB")).toHaveCount(1);
      await expect(cell(voided.no, "0.00 THB")).toHaveCount(1);
      await expect(ar.statusChip(ar.row(voided.no))).toHaveText(/void/i);
    },
  );

  test(
    "TC-ARINV-010002 ตัวกรองสถานะ Draft แสดงเฉพาะใบ Draft ของ read-set",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; data:reset --yes แล้ว (E2E-AR-DRAFT เป็น Draft ใบอื่นของ read-set ลงบัญชีหรือ void แล้ว)" },
        { type: "steps", description: "1. เปิดรายการ AR invoice\n2. ค้น E2E-AR-\n3. Filter > Status > Draft" },
        { type: "expected", description: "เหลือแถว E2E-AR-DRAFT แถวเดียว สถานะ Draft; ไม่มีแถวของ E2E-AR-POSTED" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const ar = new ArInvoicePage(page);
      const [posted_, draft] = await Promise.all(["E2E-AR-POSTED", "E2E-AR-DRAFT"].map(seededArDoc));
      await ar.gotoList();
      await ar.search("E2E-AR-");
      await expect(ar.row(posted_.no)).toBeVisible();
      await ar.filterBy("Status", "Draft");
      await expect(ar.row(posted_.no)).toHaveCount(0);
      await expect(ar.rows()).toHaveCount(1);
      await expect(ar.rows().first()).toContainText(draft.no);
      await expect(ar.statusChip(ar.rows().first())).toHaveText(/draft/i);
    },
  );

  test(
    "TC-ARINV-010003 ตัวกรองประเภทเอกสาร Credit note แสดงเฉพาะใบลดหนี้",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; data:reset --yes แล้ว (E2E-AR-CN เป็นใบลดหนี้เพียงใบเดียวใน read-set)" },
        { type: "steps", description: "1. เปิดรายการ AR invoice\n2. ค้น E2E-AR-\n3. Filter > Document type > Credit note" },
        { type: "expected", description: "เหลือแถว E2E-AR-CN แถวเดียว ประเภท Credit note; ไม่มีแถวของ E2E-AR-POSTED และ E2E-AR-DN" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const ar = new ArInvoicePage(page);
      const [posted_, cn, dn] = await Promise.all(["E2E-AR-POSTED", "E2E-AR-CN", "E2E-AR-DN"].map(seededArDoc));
      await ar.gotoList();
      await ar.search("E2E-AR-");
      await expect(ar.row(dn.no)).toBeVisible();
      await ar.filterBy("Document type", "Credit note");
      await expect(ar.row(posted_.no)).toHaveCount(0);
      await expect(ar.row(dn.no)).toHaveCount(0);
      await expect(ar.rows()).toHaveCount(1);
      await expect(ar.rows().first()).toContainText(cn.no);
      await expect(ar.rows().first().getByRole("cell", { name: "Credit note", exact: true })).toHaveCount(1);
    },
  );

  test(
    "TC-ARINV-010004 ค้นด้วยเลขเอกสารของ E2E-AR-POSTED เจอใบเดียว",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; data:reset --yes แล้ว" },
        { type: "steps", description: "1. เปิดรายการ AR invoice\n2. พิมพ์เลขเอกสารของ E2E-AR-POSTED ในช่องค้นแล้วกด Enter" },
        { type: "expected", description: "เหลือแถวเดียวและเป็นเลขเอกสารนั้น; ไม่มีแถวของ E2E-AR-DRAFT" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const ar = new ArInvoicePage(page);
      const [posted_, draft] = await Promise.all(["E2E-AR-POSTED", "E2E-AR-DRAFT"].map(seededArDoc));
      await ar.gotoList();
      await ar.search(posted_.no);
      await expect(ar.rows()).toHaveCount(1);
      await expect(ar.rows().first()).toContainText(posted_.no);
      await expect(ar.row(draft.no)).toHaveCount(0);
    },
  );

  test(
    "TC-ARINV-010005 รายละเอียด E2E-AR-POSTED แสดงบรรทัด VAT 70.00 เลขใบกำกับภาษี และลิงก์ JV",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; data:reset --yes แล้ว; E2E-AR-POSTED มีบรรทัดเดียว 3 x 333.33 VAT 7% เป็นใบกำกับภาษี ลงบัญชีแล้ว" },
        { type: "steps", description: "1. หา id ของ E2E-AR-POSTED\n2. เปิดหน้ารายละเอียด\n3. อ่านบรรทัดและแถบสรุปท้ายหน้า\n4. เปิดแท็บ Journal" },
        {
          type: "expected",
          description:
            "บรรทัด 3 x 333.33 net 999.99 VAT 70.00; แถบสรุป net 999.99 / Tax 1 70.00 / total 1,069.99 / outstanding 1,069.99 เท่ากับ money.ts; ช่อง Tax invoice เป็นเลข TXIV...; แท็บ Journal มีลิงก์เลข JV ของใบนี้. assumption: VAT 7% บนฐานก่อน VAT ปัดครึ่งขึ้นต่อบรรทัด",
        },
        { type: "priority", description: "High" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      const ar = new ArInvoicePage(page);
      const dp = await buDecimals();
      const expected = docAmounts([{ qty: 3, price: 333.33 }], 7, dp);
      expect(expected).toEqual({ net: 999.99, vat: 70, total: 1069.99 });
      const doc = await seededArDoc("E2E-AR-POSTED");
      await ar.gotoDetail(doc.id);
      await expect(ar.statusChip()).toHaveText(/posted/i);
      await expect(page.getByRole("row").filter({ hasText: "E2E-AR-POSTED line 1" })).toContainText("70.00");
      expect(await ar.summary().valueOf("net")).toBe(expected.net);
      expect(await ar.summary().valueOf("vat")).toBe(expected.vat);
      expect(await ar.summary().valueOf("total")).toBe(expected.total);
      expect(await ar.summary().valueOf("outstanding")).toBe(expected.total);
      await expect(page.getByRole("group").filter({ hasText: /^Tax invoice\s*TXIV\d+/ })).toBeVisible();
      const jv = await jvOfSource("ar_invoice", doc.id);
      expect(jv.length).toBeGreaterThan(0);
      await page.getByRole("tab", { name: "Journal" }).click();
      await expect(page.getByRole("link", { name: jv[0].jvNo })).toBeVisible();
    },
  );

  // ── 02 create (UI) ────────────────────────────────────────────────────
  test(
    "TC-ARINV-020001 สร้างใบผ่าน UI 2 บรรทัด: ยอดที่แสดงและที่บันทึกตรง oracle เลข DRAFT- สถานะ Draft",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; ลูกค้า E2E-CUST-1, บัญชี 4100, cost center E2E-CC-1 และ Vat 7% มีใน TEST BU" },
        {
          type: "steps",
          description:
            "1. เปิด /accounting/accounts-receivable/invoice/new\n2. เลือกลูกค้า E2E-CUST-1 และกรอก Description\n3. บรรทัด 1 = 2 x 100.00 Vat 7%, บรรทัด 2 = 1 x 999.99 ไม่มีภาษี (4100, E2E-CC-1)\n4. อ่านแถบสรุป\n5. กด Save Draft",
        },
        {
          type: "expected",
          description:
            "แถบสรุปก่อนบันทึก net 1,199.99 VAT 14.00 total 1,213.99; บันทึกแล้ว toast Invoice draft created ไปหน้ารายละเอียด; API ได้ยอดเดียวกัน เลขเอกสารตรง /^DRAFT-\\d{8}$/ สถานะ draft 2 บรรทัด. assumption: VAT ปัดต่อบรรทัดแล้วรวม",
        },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const ar = new ArInvoicePage(page);
      const dp = await buDecimals();
      const expected = docAmounts(toMoney(MIXED), 7, dp);
      expect(expected).toEqual({ net: 1199.99, vat: 14, total: 1213.99 });
      const t = tag("create");

      await ar.gotoNew();
      await ar.selectCustomer("E2E-CUST-1");
      await page.getByRole("textbox", { name: "Description", exact: true }).fill(t);
      await ar.addLine({ description: `${t} line 1`, qty: 2, price: 100, vat: true });
      await ar.addLine({ description: `${t} line 2`, qty: 1, price: 999.99 });
      expect(await ar.summary().valueOf("net")).toBe(expected.net);
      expect(await ar.summary().valueOf("vat")).toBe(expected.vat);
      expect(await ar.summary().valueOf("total")).toBe(expected.total);

      await expectSaved(page, /\/ar-invoice(\?|$)/, () => ar.button("Save Draft").click(), ar.toastWith(/draft created/i));
      await expect(page).toHaveURL(/\/invoice\/[0-9a-f-]{36}$/);
      const doc = await docByTag(t);
      expect(doc, "the saved draft is not in the list").not.toBeNull();
      expect(doc!.status).toBe("draft");
      expect(doc!.no).toMatch(/^DRAFT-\d{8}$/);
      expect({ net: doc!.net, vat: doc!.vat, total: doc!.total }).toEqual(expected);
      expect(doc!.lines).toHaveLength(2);
    },
  );

  test(
    "TC-ARINV-020002 ไม่เลือกลูกค้า: บันทึกไม่ได้ ยังอยู่หน้า new และไม่มีใบถูกสร้าง",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; ฟอร์มใบใหม่ที่มี 1 บรรทัดครบ แต่ยังไม่เลือกลูกค้า" },
        { type: "steps", description: "1. เปิดหน้า new, กรอก Description ที่เป็น tag\n2. เพิ่ม 1 บรรทัด 1 x 100.00\n3. กด Save Draft โดยไม่เลือกลูกค้า" },
        { type: "expected", description: "ข้อความ Select an active AR customer. ปรากฏ; ไม่มี request เขียนไป backend; URL ยังเป็น /invoice/new; ค้นด้วย tag ไม่พบใบใด" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Validation" },
      ],
    },
    async ({ page }) => {
      const ar = new ArInvoicePage(page);
      const t = tag("nocust");
      await ar.gotoNew();
      await page.getByRole("textbox", { name: "Description", exact: true }).fill(t);
      await ar.addLine({ description: `${t} line 1`, qty: 1, price: 100, vat: true });
      await expectBlocked(page, /\/ar-invoice(\?|$)/, () => ar.button("Save Draft").click(), page.getByText("Select an active AR customer."));
      await expect(page).toHaveURL(/\/invoice\/new$/);
      expect(await docByTag(t)).toBeNull();
    },
  );

  test(
    "TC-ARINV-020003 บรรทัดที่ไม่มีบัญชีรายได้: dialog ปฏิเสธและไม่เพิ่มบรรทัด",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; ฟอร์มใบใหม่เลือกลูกค้า E2E-CUST-1 แล้ว" },
        { type: "steps", description: "1. กด Add Line\n2. กรอกจำนวน 1 ราคา 100.00 และเลือก cost center แต่ไม่เลือกบัญชีรายได้\n3. กด Add" },
        { type: "expected", description: "ข้อความ Select a revenue account and its cost center. ปรากฏใน dialog; dialog ยังเปิด; ตารางบรรทัดยังว่าง (แถบสรุป total 0.00); ไม่มี request เขียน" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Validation" },
      ],
    },
    async ({ page }) => {
      const ar = new ArInvoicePage(page);
      await ar.gotoNew();
      await ar.selectCustomer("E2E-CUST-1");
      await ar.addLine({ description: "no revenue", qty: 1, price: 100, revenue: null, submit: false });
      await expectBlocked(
        page,
        /\/ar-invoice(\?|$)/,
        () => ar.lineDialog().root().getByRole("button", { name: "Add", exact: true }).click(),
        ar.lineDialog().root().getByText("Select a revenue account and its cost center."),
      );
      await expect(ar.lineDialog().root()).toBeVisible();
      await ar.lineDialog().root().getByRole("button", { name: "Cancel" }).click();
      await expect(ar.lineDialog().root()).toBeHidden();
      await expect(page.getByRole("row", { name: "No records" })).toBeVisible();
      expect(await ar.summary().valueOf("total")).toBe(0);
    },
  );

  test(
    "TC-ARINV-020004 ส่วนลด 10% บน 1 x 1,000.00 Vat 7%: net 900.00 VAT 63.00 รวม 963.00",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; ลูกค้า E2E-CUST-1, 4100, E2E-CC-1 และ Vat 7% มีใน TEST BU" },
        { type: "steps", description: "1. เปิดหน้า new, เลือกลูกค้า, กรอก Description เป็น tag\n2. เพิ่มบรรทัด 1 x 1,000.00 ส่วนลด 10% Vat 7%\n3. อ่านแถบสรุป\n4. กด Save Draft" },
        {
          type: "expected",
          description:
            "แถบสรุปก่อนและหลังบันทึก (API) net 900.00 (1,000.00 - ส่วนลด 100.00) VAT 63.00 (7% ของฐานหลังลด) total 963.00. assumption: VAT คิดจากฐานหลังหักส่วนลด",
        },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      const ar = new ArInvoicePage(page);
      const dp = await buDecimals();
      // 10% of 1,000.00 is 100.00, so the VAT base is the 900.00 net
      const expected = docAmounts([{ qty: 1, price: 900 }], 7, dp);
      expect(expected).toEqual({ net: 900, vat: 63, total: 963 });
      const t = tag("discount");
      await ar.gotoNew();
      await ar.selectCustomer("E2E-CUST-1");
      await page.getByRole("textbox", { name: "Description", exact: true }).fill(t);
      await ar.addLine({ description: `${t} line 1`, qty: 1, price: 1000, discountPct: 10, vat: true });
      expect(await ar.summary().valueOf("net")).toBe(expected.net);
      expect(await ar.summary().valueOf("vat")).toBe(expected.vat);
      expect(await ar.summary().valueOf("total")).toBe(expected.total);
      await expectSaved(page, /\/ar-invoice(\?|$)/, () => ar.button("Save Draft").click(), ar.toastWith(/draft created/i));
      const doc = await docByTag(t);
      expect(doc, "the saved draft is not in the list").not.toBeNull();
      expect({ net: doc!.net, vat: doc!.vat, total: doc!.total }).toEqual(expected);
    },
  );

  // ── 03 edit / delete ──────────────────────────────────────────────────
  test(
    "TC-ARINV-030001 แก้ราคาบรรทัดของใบ Draft ผ่าน UI: API ได้ยอดรวมใหม่",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; ใบ Draft ที่สร้างผ่าน API มีบรรทัดเดียว 2 x 100.00 Vat 7%" },
        { type: "steps", description: "1. เปิดหน้ารายละเอียดใบ Draft\n2. กด Edit\n3. เปิดบรรทัด 1 เปลี่ยนราคาเป็น 150.00 กด Save\n4. อ่านแถบสรุป\n5. กด Save" },
        {
          type: "expected",
          description: "ก่อนบันทึกแถบสรุป net 300.00 VAT 21.00 total 321.00; หลังบันทึก toast Invoice draft saved และ API ได้ 300.00 / 21.00 / 321.00 สถานะ draft. assumption: VAT 7% บนฐานก่อน VAT",
        },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const ar = new ArInvoicePage(page);
      const dp = await buDecimals();
      const after = docAmounts([{ qty: 2, price: 150 }], 7, dp);
      expect(after).toEqual({ net: 300, vat: 21, total: 321 });
      const created = await createArDoc("invoice", { tag: tag("edit"), lines: [{ qty: 2, price: 100, vat: true }] });
      await ar.gotoDetail(created.id);
      await ar.button("Edit").click();
      await ar.lineButton(`${tag("edit")} line 1`).click();
      await ar.lineDialog().unitPrice().fill("150");
      await ar.lineDialog().root().getByRole("button", { name: "Save", exact: true }).click();
      expect(await ar.summary().valueOf("net")).toBe(after.net);
      expect(await ar.summary().valueOf("total")).toBe(after.total);
      await expectSaved(page, /\/ar-invoice\/[0-9a-f-]{36}$/, () => ar.button("Save").click(), ar.toastWith(/draft saved/i));
      const doc = await getArDoc(created.id);
      expect(doc.status).toBe("draft");
      expect({ net: doc.net, vat: doc.vat, total: doc.total }).toEqual(after);
    },
  );

  test(
    "TC-ARINV-030002 PUT ด้วย doc_version เก่า: ถูกปฏิเสธ 409 AR_INVOICE_IMMUTABLE และใบไม่เปลี่ยน",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; ใบ Draft ที่สร้างผ่าน API; แก้ description สำเร็จหนึ่งครั้ง (doc_version เพิ่ม)" },
        { type: "steps", description: "1. PUT /ar-invoice/:id ด้วย doc_version ปัจจุบันและ description ใหม่ (สำเร็จ)\n2. PUT อีกครั้งด้วย doc_version เดิมที่เก่าแล้ว" },
        { type: "expected", description: "ครั้งแรก 200; ครั้งที่สองตอบ 409 รหัส AR_INVOICE_IMMUTABLE; description ยังเป็นค่าของครั้งแรก. assumption: การเขียนทับด้วยเวอร์ชันเก่าถูกปฏิเสธ (optimistic concurrency)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async () => {
      const created = await createArDoc("invoice", { tag: tag("stale"), lines: [{ qty: 1, price: 100, vat: true }] });
      const before = await getArDoc(created.id);
      const first = await buSend(CREATOR, "PUT", `/ar-invoice/${created.id}`, { doc_version: before.version, description: `e2e ${tag("stale")} v2` });
      expect(first.status, JSON.stringify(first.body).slice(0, 300)).toBe(200);
      const stale = await buSend(CREATOR, "PUT", `/ar-invoice/${created.id}`, { doc_version: before.version, description: `e2e ${tag("stale")} v3` });
      expect(stale.status, JSON.stringify(stale.body).slice(0, 300)).toBe(409);
      expect(stale.body?.error?.code).toBe("AR_INVOICE_IMMUTABLE");
      const raw = await buSend(CREATOR, "GET", `/ar-invoice/${created.id}`);
      expect(String(raw.body?.data?.description)).toContain("v2");
      expect(String(raw.body?.data?.description)).not.toContain("v3");
    },
  );

  test(
    "TC-ARINV-030003 ลบใบ Draft ที่เลข DRAFT- ผ่าน UI: GET ตอบ 404",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; ใบ Draft ที่สร้างผ่าน API (เลข DRAFT-xxxxxxxx ยังไม่เคย Submit)" },
        { type: "steps", description: "1. เปิดหน้ารายละเอียดใบ Draft\n2. กด Delete แล้วยืนยัน\n3. GET /ar-invoice/:id" },
        { type: "expected", description: "toast Invoice draft deleted กลับไปรายการ; GET ตอบ 404. assumption: ใบ Draft ที่ยังเป็นเลข DRAFT- ลบทิ้งได้จริง" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
      ],
    },
    async ({ page }) => {
      const ar = new ArInvoicePage(page);
      const created = await createArDoc("invoice", { tag: tag("delete"), lines: [{ qty: 1, price: 100 }] });
      expect(created.no).toMatch(/^DRAFT-\d{8}$/);
      await ar.gotoDetail(created.id);
      await ar.button("Delete").click();
      const dlg = page.getByRole("alertdialog").or(page.getByRole("dialog")).last();
      await expectSaved(page, /\/ar-invoice\/[0-9a-f-]{36}$/, () => dlg.getByRole("button", { name: "Delete", exact: true }).click(), ar.toastWith(/draft deleted/i));
      const res = await buSend(CREATOR, "GET", `/ar-invoice/${created.id}`);
      expect(res.status).toBe(404);
    },
  );

  // ── 04 submit & post (no workflow) ────────────────────────────────────
  test(
    "TC-ARINV-040001 Submit (ไม่มี workflow) ลงบัญชีทันที: เลข ARIV สถานะ posted ค้าง = ยอดรวม",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; ไม่มี ar_invoice workflow ที่ active; ใบ Draft 2 บรรทัด (2 x 100.00 Vat 7%, 1 x 999.99 ไม่มีภาษี)" },
        { type: "steps", description: "1. สร้างใบ Draft ผ่าน API\n2. POST /ar-invoice/:id/submit\n3. อ่านใบกลับ" },
        { type: "expected", description: "ตอบ 200; เลขเอกสารตรง /^ARIV\\d{8}$/ (ไม่ใช่ DRAFT-); สถานะ posted; net 1,199.99 VAT 14.00 total 1,213.99; ยอดค้าง = ยอดรวม 1,213.99; มี JV (gl_jv_id)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async () => {
      const dp = await buDecimals();
      const expected = docAmounts(toMoney(MIXED), 7, dp);
      const { doc } = await posted("invoice", "post", MIXED);
      expect(doc.no).toMatch(/^ARIV\d{8}$/);
      expect(doc.status).toBe("posted");
      expect({ net: doc.net, vat: doc.vat, total: doc.total }).toEqual(expected);
      expect(doc.outstanding).toBe(expected.total);
      expect(doc.glJvId).toBeTruthy();
    },
  );

  test(
    "TC-ARINV-040002 JV ของใบที่ลงบัญชี: สมดุล Dr 1130 = ยอดรวม Cr 4100 = net และมีขา VAT ตามจำนวน",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; ใบ 2 บรรทัด (2 x 100.00 Vat 7%, 1 x 999.99 ไม่มีภาษี) ลูกค้า E2E-CUST-1 ที่ Submit ลงบัญชีแล้ว" },
        { type: "steps", description: "1. Submit ใบผ่าน API\n2. อ่านบรรทัดของ JV ที่ source = ar_invoice และ id ของใบ" },
        {
          type: "expected",
          description:
            "JV เดียว Dr รวม = Cr รวม; Dr 1130 = 1,213.99; Cr 4100 = 1,199.99; มีขา Cr VAT = 14.00 บนบัญชีหนึ่ง (ไม่ยืนยันบัญชี VAT ที่นี่ ดู 040003). assumption: ใบขาย Dr ลูกหนี้ = ยอดรวม / Cr รายได้ = net / Cr VAT = VAT",
        },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async () => {
      const dp = await buDecimals();
      const expected = docAmounts(toMoney(MIXED), 7, dp);
      const { id } = await posted("invoice", "jv", MIXED);
      const jv = await jvOfSource("ar_invoice", id);
      expect(new Set(jv.map((l) => l.jvId)).size).toBe(1);
      expectBalanced(jv);
      expect(sum(jv, "1130", "dr")).toBe(expected.total);
      expect(sum(jv, "4100", "cr")).toBe(expected.net);
      expect(hasVatLeg(jv, expected.vat, "cr"), `no Cr VAT leg of ${expected.vat} in ${JSON.stringify(jv.map((l) => [l.account, l.dr, l.cr]))}`).toBe(true);
    },
  );

  test(
    "TC-ARINV-040003 ขา VAT ของใบขายลงบัญชี 2160 Output VAT ตาม gl_setting.output_vat_account_id",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; gl_setting.output_vat_account_id = 2160; ใบ 2 x 100.00 Vat 7% ลูกค้า E2E-CUST-1 (ไม่ส่ง vat_chart_of_accounts_id ที่บรรทัด)" },
        { type: "steps", description: "1. Submit ใบผ่าน API\n2. อ่าน JV ของใบ" },
        {
          type: "expected",
          description: "Cr 2160 = 14.00 (VAT ขาย ต้องเข้าบัญชีภาษีขายตามตั้งค่า AR). assumption: ตั้งค่า output_vat_account_id ของ AR ต้องมาก่อนบัญชีของ tax profile ที่ใช้ฝั่งซื้อ (user ตัดสิน 2026-11-25 ตัวเลือก a)",
        },
        { type: "note", description: "ปักเป็นบั๊ก: backend ใช้บัญชีของ tax profile (1170 Input VAT) ก่อน gl_setting.output_vat_account_id; ดู bug list" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async () => {
      test.fail(true, VAT_PIN);
      const { id, doc } = await posted("invoice", "vat", [{ qty: 2, price: 100, vat: true }]);
      const jv = await jvOfSource("ar_invoice", id);
      expect(sum(jv, "2160", "cr"), `${doc.no} JV: ${JSON.stringify(jv.map((l) => [l.account, l.dr, l.cr]))}`).toBe(14);
    },
  );

  test(
    "TC-ARINV-040004 ใบกำกับภาษี (API create): ได้เลข TXIV และสถานะ pending",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; ใบ 1 x 100.00 Vat 7% สร้างผ่าน API ด้วย is_tax_invoice = true (UI ไม่ติ๊กเพราะส่วนเสริมยัง mock)" },
        { type: "steps", description: "1. สร้างใบด้วย taxInvoice = true\n2. Submit\n3. อ่านใบกลับ" },
        { type: "expected", description: "สถานะ posted; เลขใบกำกับภาษีตรง /^TXIV\\d{8}$/; สถานะใบกำกับภาษี pending. assumption: ใบกำกับภาษีออกตอนลงบัญชีและเริ่มที่ pending" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async () => {
      const { doc } = await posted("invoice", "taxinv", [{ qty: 1, price: 100, vat: true }], { taxInvoice: true });
      expect(doc.status).toBe("posted");
      expect(doc.taxInvoiceNo).toMatch(/^TXIV\d{8}$/);
      expect(doc.taxStatus).toBe("pending");
    },
  );

  test(
    "TC-ARINV-040005 ลูกค้า E2E-CUST-2 (ไม่มีบัญชีลูกหนี้): Dr 1130 ผ่านค่าเริ่มต้นของ gl_setting",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; E2E-CUST-2 ไม่มี ar_chart_of_accounts_id; gl_setting.ar_control_account_id = 1130" },
        { type: "steps", description: "1. สร้างใบ 1 x 100.00 Vat 7% ลูกค้า E2E-CUST-2\n2. Submit\n3. อ่าน JV" },
        { type: "expected", description: "สถานะ posted; Dr 1130 = 107.00 (ยอดรวม); JV สมดุล. assumption: ลูกค้าที่ไม่มีบัญชีลูกหนี้ใช้ ar_control_account_id ของ gl_setting" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Alternate Flow" },
      ],
    },
    async () => {
      const expected = docAmounts([{ qty: 1, price: 100 }]);
      const { id, doc } = await posted("invoice", "cust2", [{ qty: 1, price: 100, vat: true }], { customer: "E2E-CUST-2" });
      expect(doc.status).toBe("posted");
      const jv = await jvOfSource("ar_invoice", id);
      expectBalanced(jv);
      expect(sum(jv, "1130", "dr")).toBe(expected.total);
    },
  );

  test(
    "TC-ARINV-040006 ยอดรวม 0: Submit ถูกปฏิเสธ 400 และใบยังเป็น Draft",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; ใบ Draft 1 บรรทัด 1 x 0.00 ไม่มีภาษี (ยอดรวม 0)" },
        { type: "steps", description: "1. POST /ar-invoice/:id/submit" },
        { type: "expected", description: "ตอบ 400 รหัส AR_INVOICE_LINE_INVALID; ใบยัง draft เลข DRAFT- ไม่มี JV. assumption: ใบที่ยอดรวม 0 ลงบัญชีไม่ได้ (ตามรหัสข้อผิดพลาดของ BE)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async () => {
      const created = await createArDoc("invoice", { tag: tag("zero"), lines: [{ qty: 1, price: 0 }] });
      const res = await submitArDoc(created.id);
      expect(res.status, JSON.stringify(res.body).slice(0, 300)).toBe(400);
      expect(res.body?.error?.code).toBe("AR_INVOICE_LINE_INVALID");
      const doc = await getArDoc(created.id);
      expect(doc.status).toBe("draft");
      expect(doc.no).toMatch(/^DRAFT-\d{8}$/);
      expect(doc.glJvId).toBeFalsy();
    },
  );

  test(
    "TC-ARINV-040007 ใบกำกับภาษีที่ผสมอัตรา VAT: Submit ถูกปฏิเสธ 400 AR_TAX_INVOICE_MIXED_VAT_RATE",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; ใบกำกับภาษี (is_tax_invoice) 2 บรรทัด: 1 x 100.00 Vat 7% และ 1 x 100.00 ไม่มีภาษี (None 0%); TEST BU มีโปรไฟล์ VAT เดียว (Vat 7%) จึงสร้างอัตรา VAT ที่ไม่ใช่ศูนย์ตัวที่สองไม่ได้" },
        { type: "steps", description: "1. POST /ar-invoice/:id/submit" },
        { type: "expected", description: "ตอบ 400 รหัส AR_TAX_INVOICE_MIXED_VAT_RATE; ใบยัง draft ไม่มี JV ไม่มีเลข TXIV. assumption: ใบกำกับภาษีใบเดียวมี VAT อัตราเดียว (spec §10.2 ที่โค้ด BE อ้าง) และบรรทัด 0% ก็เป็นอัตราหนึ่งที่ต่างจาก 7%" },
        { type: "note", description: "ปักเป็นคำถามเชิงผลิตภัณฑ์: BE นับเฉพาะบรรทัดที่ VAT ไม่ศูนย์ (mixedVatRate ใน ar-invoice.service.ts) จึงรับ 7% + 0% บนใบกำกับภาษีใบเดียว; ดู bug list" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async () => {
      test.fail(true, "needs product decision: the BE's mixed-rate rule ignores zero-VAT lines, so a tax invoice with a 7% line and a 0% line is posted (200) instead of refused with AR_TAX_INVOICE_MIXED_VAT_RATE; see docs/superpowers/specs/2026-11-25-e2e-ar-invoice-bug-list.md");
      const created = await createArDoc("invoice", {
        tag: tag("mixed"),
        taxInvoice: true,
        lines: [
          { qty: 1, price: 100, vat: true },
          { qty: 1, price: 100 },
        ],
      });
      const res = await submitArDoc(created.id);
      expect(res.status, JSON.stringify(res.body).slice(0, 300)).toBe(400);
      expect(res.body?.error?.code).toBe("AR_TAX_INVOICE_MIXED_VAT_RATE");
      const doc = await getArDoc(created.id);
      expect(doc.status).toBe("draft");
      expect(doc.glJvId).toBeFalsy();
      expect(doc.taxInvoiceNo).toBeFalsy();
    },
  );

  // ── 05 debit & credit notes (API create, UI view) ─────────────────────
  test(
    "TC-ARINV-050001 ใบเพิ่มหนี้ (API) ลงบัญชีด้วยด้านเดียวกับใบขาย เลข ARDN และเปิดดูใน UI ได้",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; ใบเพิ่มหนี้ 1 x 200.00 Vat 7% (UI สร้างได้เฉพาะ invoice จึงสร้างผ่าน API)" },
        { type: "steps", description: "1. สร้างใบเพิ่มหนี้ผ่าน API แล้ว Submit\n2. อ่าน JV\n3. เปิดหน้ารายละเอียดใน UI" },
        {
          type: "expected",
          description:
            "เลขตรง /^ARDN\\d{8}$/ สถานะ posted; Dr 1130 = 214.00, Cr 4100 = 200.00, มีขา Cr VAT = 14.00; JV สมดุล; UI แสดง Posted และ total 214.00. assumption: ใบเพิ่มหนี้ใช้ด้านเดียวกับใบขาย",
        },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const ar = new ArInvoicePage(page);
      const expected = docAmounts([{ qty: 1, price: 200 }]);
      const { id, doc } = await posted("debit_note", "dn", [{ qty: 1, price: 200, vat: true }]);
      expect(doc.no).toMatch(/^ARDN\d{8}$/);
      expect(doc.status).toBe("posted");
      const jv = await jvOfSource("ar_invoice", id);
      expectBalanced(jv);
      expect(sum(jv, "1130", "dr")).toBe(expected.total);
      expect(sum(jv, "4100", "cr")).toBe(expected.net);
      expect(hasVatLeg(jv, expected.vat, "cr")).toBe(true);
      await ar.gotoDetail(id);
      await expect(ar.statusChip()).toHaveText(/posted/i);
      expect(await ar.summary().valueOf("total")).toBe(expected.total);
    },
  );

  test(
    "TC-ARINV-050002 ขา VAT ของใบเพิ่มหนี้ลงบัญชี 2160 Output VAT",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; gl_setting.output_vat_account_id = 2160; ใบเพิ่มหนี้ 1 x 200.00 Vat 7% (ไม่ส่ง vat_chart_of_accounts_id)" },
        { type: "steps", description: "1. สร้างใบเพิ่มหนี้ผ่าน API แล้ว Submit\n2. อ่าน JV" },
        { type: "expected", description: "Cr 2160 = 14.00. assumption: เหมือน 040003 บัญชี VAT ขายของ AR ต้องมาก่อนบัญชีของ tax profile" },
        { type: "note", description: "ปักเป็นบั๊กเดียวกับ 040003 (backend ใช้บัญชี tax profile 1170); ดู bug list" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async () => {
      test.fail(true, VAT_PIN);
      const { id, doc } = await posted("debit_note", "dnvat", [{ qty: 1, price: 200, vat: true }]);
      const jv = await jvOfSource("ar_invoice", id);
      expect(sum(jv, "2160", "cr"), `${doc.no} JV: ${JSON.stringify(jv.map((l) => [l.account, l.dr, l.cr]))}`).toBe(14);
    },
  );

  test(
    "TC-ARINV-050003 ใบลดหนี้ (API) ลงบัญชีด้านกลับกับใบขาย เลข ARCN และเปิดดูใน UI ได้",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; ใบลดหนี้ 1 x 100.00 Vat 7% (สร้างผ่าน API)" },
        { type: "steps", description: "1. สร้างใบลดหนี้ผ่าน API แล้ว Submit\n2. อ่าน JV\n3. เปิดหน้ารายละเอียดใน UI" },
        {
          type: "expected",
          description:
            "เลขตรง /^ARCN\\d{8}$/ สถานะ posted; Cr 1130 = 107.00, Dr 4100 = 100.00, มีขา Dr VAT = 7.00; JV สมดุล; UI แสดง Posted total 107.00. assumption: ใบลดหนี้กลับด้านของใบขาย",
        },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const ar = new ArInvoicePage(page);
      const expected = docAmounts([{ qty: 1, price: 100 }]);
      const { id, doc } = await posted("credit_note", "cn", [{ qty: 1, price: 100, vat: true }]);
      expect(doc.no).toMatch(/^ARCN\d{8}$/);
      expect(doc.status).toBe("posted");
      const jv = await jvOfSource("ar_invoice", id);
      expectBalanced(jv);
      expect(sum(jv, "1130", "cr")).toBe(expected.total);
      expect(sum(jv, "4100", "dr")).toBe(expected.net);
      expect(sum(jv, "1130", "dr")).toBe(0);
      expect(hasVatLeg(jv, expected.vat, "dr")).toBe(true);
      await ar.gotoDetail(id);
      await expect(ar.statusChip()).toHaveText(/posted/i);
      expect(await ar.summary().valueOf("total")).toBe(expected.total);
    },
  );

  test(
    "TC-ARINV-050004 ขา VAT ของใบลดหนี้ลงบัญชี 2160 Output VAT ฝั่ง Dr",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; gl_setting.output_vat_account_id = 2160; ใบลดหนี้ 1 x 100.00 Vat 7% (ไม่ส่ง vat_chart_of_accounts_id)" },
        { type: "steps", description: "1. สร้างใบลดหนี้ผ่าน API แล้ว Submit\n2. อ่าน JV" },
        { type: "expected", description: "Dr 2160 = 7.00 (กลับด้านของใบขาย). assumption: เหมือน 040003 บัญชี VAT ขายของ AR ต้องมาก่อนบัญชีของ tax profile" },
        { type: "note", description: "ปักเป็นบั๊กเดียวกับ 040003 (backend ใช้บัญชี tax profile 1170); ดู bug list" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async () => {
      test.fail(true, VAT_PIN);
      const { id, doc } = await posted("credit_note", "cnvat", [{ qty: 1, price: 100, vat: true }]);
      const jv = await jvOfSource("ar_invoice", id);
      expect(sum(jv, "2160", "dr"), `${doc.no} JV: ${JSON.stringify(jv.map((l) => [l.account, l.dr, l.cr]))}`).toBe(7);
    },
  );

  // ── 06 credit-note application (own credit notes) ─────────────────────
  test(
    "TC-ARINV-060001 reference-candidates ของใบขายแสดงใบลดหนี้ที่ลงบัญชีแล้วพร้อมยอดคงเหลือ",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; ใบลดหนี้ของเคสนี้ 1 x 100.00 Vat 7% (107.00) ลงบัญชีแล้ว ลูกค้า E2E-CUST-1; ใบขาย Draft ลูกค้าเดียวกัน" },
        { type: "steps", description: "1. สร้างและ Submit ใบลดหนี้\n2. สร้างใบขาย Draft\n3. GET /ar-invoice/:id/reference-candidates ของใบขาย" },
        { type: "expected", description: "รายการมีใบลดหนี้ใบนั้นและ available = 107.00 (ยังไม่เคยถูกนำไปหักใบใด)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async () => {
      const cn = await posted("credit_note", "ref-cn1", [{ qty: 1, price: 100, vat: true }]);
      const inv = await createArDoc("invoice", { tag: tag("ref-inv1"), lines: [{ qty: 1, price: 1000, vat: true }] });
      const hit = (await referenceCandidates(inv.id)).find((c) => c.id === cn.id);
      expect(hit, "the new credit note is not offered as a reference candidate").toBeTruthy();
      expect(hit!.available).toBe(docAmounts([{ qty: 1, price: 100 }]).total);
    },
  );

  test(
    "TC-ARINV-060002 ใบขายที่หักใบลดหนี้ 50.00: ค้าง = ยอดรวม - 50.00 และ referenceApplied ของใบลดหนี้ = 50.00",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; ใบลดหนี้ 107.00 ลงบัญชีแล้ว; ใบขาย 1 x 1,000.00 Vat 7% (1,070.00) อ้างใบลดหนี้นั้น applied 50.00" },
        { type: "steps", description: "1. สร้างใบลดหนี้และ Submit\n2. สร้างใบขายที่ references = [{ใบลดหนี้, 50.00}]\n3. Submit ใบขาย\n4. อ่านใบขายและใบลดหนี้" },
        { type: "expected", description: "ใบขาย posted ค้าง 1,020.00 (1,070.00 - 50.00); ใบลดหนี้ reference_applied_amount = 50.00 และยัง posted" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async () => {
      const cn = await posted("credit_note", "ref-cn2", [{ qty: 1, price: 100, vat: true }]);
      const total = docAmounts([{ qty: 1, price: 1000 }]).total;
      const inv = await posted("invoice", "ref-inv2", [{ qty: 1, price: 1000, vat: true }], { references: [{ id: cn.id, amount: 50 }] });
      expect(inv.doc.status).toBe("posted");
      expect(inv.doc.outstanding).toBe(round(total - 50, 2));
      const cnAfter = await getArDoc(cn.id);
      expect(cnAfter.referenceApplied).toBe(50);
      expect(cnAfter.status).toBe("posted");
    },
  );

  test(
    "TC-ARINV-060003 หักใบลดหนี้เกินยอดคงเหลือ: ถูกปฏิเสธ AR_REFERENCE_OVER_APPLIED และไม่มีผลกับใบลดหนี้",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; ใบลดหนี้ 107.00 ลงบัญชีแล้ว (ยังไม่เคยหักใบใด)" },
        { type: "steps", description: "1. สร้างใบขาย 1 x 1,000.00 Vat 7% ที่ references = [{ใบลดหนี้, 107.01}] แล้ว Submit (ถ้ายังสร้างได้)" },
        { type: "expected", description: "การสร้างหรือ Submit ตอบ 4xx รหัส AR_REFERENCE_OVER_APPLIED; ใบลดหนี้ reference_applied_amount ยัง 0.00" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async () => {
      const cn = await posted("credit_note", "ref-cn3", [{ qty: 1, price: 100, vat: true }]);
      const avail = docAmounts([{ qty: 1, price: 100 }]).total;
      let code = "";
      let status = 0;
      try {
        const inv = await createArDoc("invoice", { tag: tag("ref-inv3"), lines: [{ qty: 1, price: 1000, vat: true }], references: [{ id: cn.id, amount: round(avail + 0.01, 2) }] });
        const res = await submitArDoc(inv.id);
        status = res.status;
        code = String(res.body?.error?.code ?? "");
      } catch (e) {
        const m = /-> (\d{3}) /.exec(String(e));
        status = Number(m?.[1] ?? 0);
        code = String(e);
      }
      expect(status, code).toBeGreaterThanOrEqual(400);
      expect(status).toBeLessThan(500);
      expect(code).toContain("AR_REFERENCE_OVER_APPLIED");
      expect((await getArDoc(cn.id)).referenceApplied).toBe(0);
    },
  );

  test(
    "TC-ARINV-060004 Void ใบลดหนี้ที่ถูกอ้างโดยใบขายที่ลงบัญชีแล้ว: ถูกปฏิเสธ 409 AR_INVOICE_IS_REFERENCED",
    {
      annotation: [
        { type: "preconditions", description: "Admin login (มีสิทธิ์ void); ใบลดหนี้ 107.00 ที่ใบขายที่ลงบัญชีแล้วหักไป 50.00" },
        { type: "steps", description: "1. สร้างและ Submit ใบลดหนี้ และใบขายที่อ้างมัน 50.00\n2. POST /ar-invoice/:cn/void พร้อมเหตุผล" },
        { type: "expected", description: "ตอบ 409 รหัส AR_INVOICE_IS_REFERENCED; ใบลดหนี้ยัง posted และ reference_applied_amount ยัง 50.00" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async () => {
      const cn = await posted("credit_note", "ref-cn4", [{ qty: 1, price: 100, vat: true }]);
      await posted("invoice", "ref-inv4", [{ qty: 1, price: 1000, vat: true }], { references: [{ id: cn.id, amount: 50 }] });
      const res = await voidArDoc(cn.id, CREATOR, "e2e void referenced");
      expect(res.status, JSON.stringify(res.body).slice(0, 300)).toBe(409);
      expect(res.body?.error?.code).toBe("AR_INVOICE_IS_REFERENCED");
      const after = await getArDoc(cn.id);
      expect(after.status).toBe("posted");
      expect(after.referenceApplied).toBe(50);
    },
  );

  // ── 07 void ───────────────────────────────────────────────────────────
  test(
    "TC-ARINV-070001 Void ใบที่ลงบัญชีผ่าน UI: ปุ่มยืนยันปิดจนกว่าจะใส่เหตุผล แล้วสถานะ void ค้าง 0.00",
    {
      annotation: [
        { type: "preconditions", description: "Admin login (มีสิทธิ์ void); ใบ 3 x 333.33 Vat 7% ที่ Submit ลงบัญชีแล้ว" },
        { type: "steps", description: "1. เปิดหน้ารายละเอียดใบ posted\n2. กด Void\n3. สังเกตปุ่ม Void ใน dialog ก่อนใส่เหตุผล\n4. ใส่เหตุผลแล้วยืนยัน" },
        { type: "expected", description: "ปุ่ม Void ใน dialog disabled จนกว่าจะใส่เหตุผล; หลังยืนยันสถานะ Void และ API ได้ status void, outstanding 0.00, มี void_gl_jv_id" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const ar = new ArInvoicePage(page);
      const { id } = await posted("invoice", "void", [{ qty: 3, price: 333.33, vat: true }]);
      await ar.gotoDetail(id);
      await expect(ar.statusChip()).toHaveText(/posted/i);
      await ar.button("Void").first().click();
      const dlg = ar.confirmDialog();
      await expect(dlg).toBeVisible();
      const confirm = dlg.getByRole("button", { name: "Void", exact: true });
      await expect(confirm).toBeDisabled();
      await dlg.locator("#ar-action-reason").fill("e2e void");
      await expect(confirm).toBeEnabled();
      await expectSaved(page, /\/ar-invoice\/[0-9a-f-]{36}\/void$/, () => confirm.click(), page.locator("[data-slot=status-chip]").filter({ hasText: /void/i }));
      await expect(ar.statusChip()).toHaveText(/void/i);
      const doc = await getArDoc(id);
      expect(doc.status).toBe("void");
      expect(doc.outstanding).toBe(0);
      expect(doc.voidGlJvId).toBeTruthy();
    },
  );

  test(
    "TC-ARINV-070002 JV กลับรายการของใบที่ void หักล้างของเดิมทุกบรรทัด",
    {
      annotation: [
        { type: "preconditions", description: "Admin login (มีสิทธิ์ void); ใบ 3 x 333.33 Vat 7% (999.99 + 70.00 = 1,069.99) ที่ Submit ลงบัญชีแล้ว" },
        { type: "steps", description: "1. Void ใบผ่าน API พร้อมเหตุผล\n2. อ่าน JV ทั้งหมดของใบ" },
        {
          type: "expected",
          description:
            "มี 2 JV (ต้นฉบับและกลับรายการที่ชี้ reversal_of_jv_id ไปต้นฉบับ); JV สมดุล; กลับรายการ Cr 1130 = 1,069.99 และ Dr 4100 = 999.99; ยอดสุทธิของทุกบัญชีรวมสองใบ = 0 (ตรวจ VAT รวมในนั้นโดยไม่ระบุบัญชี). assumption: void ของใบ posted กลับรายการ JV เดิมทุกขา",
        },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async () => {
      const expected = docAmounts([{ qty: 3, price: 333.33 }]);
      const { id } = await posted("invoice", "revjv", [{ qty: 3, price: 333.33, vat: true }]);
      const res = await voidArDoc(id, CREATOR, "e2e void");
      expect(res.status, JSON.stringify(res.body).slice(0, 300)).toBe(200);
      const jv = await jvOfSource("ar_invoice", id);
      expectBalanced(jv);
      expect([...new Set(jv.map((l) => l.jvId))]).toHaveLength(2);
      const original = jv.filter((l) => l.reversalOfJvId === null);
      const reversing = jv.filter((l) => l.reversalOfJvId !== null);
      expect(reversing.every((l) => l.reversalOfJvId === original[0].jvId)).toBe(true);
      expect(sum(reversing, "1130", "cr")).toBe(expected.total);
      expect(sum(reversing, "4100", "dr")).toBe(expected.net);
      for (const account of new Set(jv.map((l) => l.account))) {
        expect(round(sum(jv, account, "dr") - sum(jv, account, "cr"), 4), `net of ${account} after void`).toBe(0);
      }
    },
  );

  test(
    "TC-ARINV-070003 ขา VAT ของ JV กลับรายการหักล้างที่ 2160 Output VAT",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; gl_setting.output_vat_account_id = 2160; ใบ 3 x 333.33 Vat 7% (VAT 70.00) ที่ลงบัญชีแล้ว (ไม่ส่ง vat_chart_of_accounts_id)" },
        { type: "steps", description: "1. Void ใบผ่าน API\n2. อ่าน JV กลับรายการ" },
        { type: "expected", description: "JV กลับรายการมี Dr 2160 = 70.00. assumption: เหมือน 040003 บัญชี VAT ขายของ AR ต้องมาก่อนบัญชีของ tax profile" },
        { type: "note", description: "ปักเป็นบั๊กเดียวกับ 040003 (backend ใช้บัญชี tax profile 1170); ดู bug list" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async () => {
      test.fail(true, VAT_PIN);
      const { id, doc } = await posted("invoice", "revvat", [{ qty: 3, price: 333.33, vat: true }]);
      expect((await voidArDoc(id, CREATOR, "e2e void")).status).toBe(200);
      const reversing = (await jvOfSource("ar_invoice", id)).filter((l) => l.reversalOfJvId !== null);
      expect(sum(reversing, "2160", "dr"), `${doc.no} reversal: ${JSON.stringify(reversing.map((l) => [l.account, l.dr, l.cr]))}`).toBe(70);
    },
  );

  test(
    "TC-ARINV-070004 Void ใบกำกับภาษี: ใบกำกับภาษีเป็น void",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; ใบกำกับภาษี (API create is_tax_invoice) 1 x 100.00 Vat 7% ที่ลงบัญชีแล้ว ได้เลข TXIV สถานะ pending" },
        { type: "steps", description: "1. Void ใบผ่าน API\n2. อ่านใบกลับ" },
        { type: "expected", description: "ใบ status void; เลขใบกำกับภาษียังเป็นเลขเดิม และสถานะใบกำกับภาษี = void" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async () => {
      const { id, doc } = await posted("invoice", "voidtax", [{ qty: 1, price: 100, vat: true }], { taxInvoice: true });
      expect(doc.taxStatus).toBe("pending");
      expect((await voidArDoc(id, CREATOR, "e2e void")).status).toBe(200);
      const after = await getArDoc(id);
      expect(after.status).toBe("void");
      expect(after.taxInvoiceNo).toBe(doc.taxInvoiceNo);
      expect(after.taxStatus).toBe("void");
    },
  );

  test(
    "TC-ARINV-070005 Void โดยไม่ใส่เหตุผล (API): ถูกปฏิเสธ 400 และใบยัง posted",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; ใบ 1 x 100.00 ที่ลงบัญชีแล้ว" },
        { type: "steps", description: "1. POST /ar-invoice/:id/void โดยไม่ส่ง reason" },
        { type: "expected", description: "ตอบ 400 รหัส AR_INVOICE_LINE_INVALID; ใบยัง posted ไม่มี JV กลับรายการ (1 JV). assumption: การ void ต้องมีเหตุผล (ตามรหัสข้อผิดพลาดของ BE)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async () => {
      const { id } = await posted("invoice", "noreason", [{ qty: 1, price: 100 }]);
      const res = await voidArDoc(id, CREATOR);
      expect(res.status, JSON.stringify(res.body).slice(0, 300)).toBe(400);
      expect(res.body?.error?.code).toBe("AR_INVOICE_LINE_INVALID");
      expect((await getArDoc(id)).status).toBe("posted");
      expect(new Set((await jvOfSource("ar_invoice", id)).map((l) => l.jvId)).size).toBe(1);
    },
  );

  test(
    "TC-ARINV-070006 Void ใบ Draft: สถานะ void และไม่มี JV",
    {
      annotation: [
        { type: "preconditions", description: "Admin login (มีสิทธิ์ void); ใบ Draft 1 x 100.00 ที่ยังไม่ Submit" },
        { type: "steps", description: "1. POST /ar-invoice/:id/void พร้อมเหตุผล\n2. อ่านใบกลับ" },
        { type: "expected", description: "ตอบ 200; ใบ status void ค้าง 0.00; ไม่มี JV ของใบนี้ (ไม่เคยลงบัญชี)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Alternate Flow" },
      ],
    },
    async () => {
      const created = await createArDoc("invoice", { tag: tag("voiddraft"), lines: [{ qty: 1, price: 100 }] });
      const res = await voidArDoc(created.id, CREATOR, "e2e void draft");
      expect(res.status, JSON.stringify(res.body).slice(0, 300)).toBe(200);
      const doc = await getArDoc(created.id);
      expect(doc.status).toBe("void");
      expect(doc.outstanding).toBe(0);
      expect(await jvOfSource("ar_invoice", created.id)).toHaveLength(0);
    },
  );
});

// ── 10 viewer ───────────────────────────────────────────────────────────
requestorTest.describe("AR invoice (806) - Requestor (viewer)", () => {
  requestorTest(
    "TC-ARINV-100001 Requestor เห็นรายการและรายละเอียดของใบที่ลงบัญชีแล้ว",
    {
      annotation: [
        { type: "preconditions", description: "Requestor login (accounting viewer: accounting.ar.view เท่านั้น); data:reset --yes แล้ว" },
        { type: "steps", description: "1. เปิดรายการ AR invoice ค้น E2E-AR-\n2. เปิดรายละเอียด E2E-AR-POSTED" },
        { type: "expected", description: "รายการแสดงแถวของ E2E-AR-POSTED; หน้ารายละเอียดแสดงสถานะ Posted และยอดรวม 1,069.99" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Authorization" },
      ],
    },
    async ({ page }) => {
      const ar = new ArInvoicePage(page);
      const doc = await seededArDoc("E2E-AR-POSTED");
      await ar.gotoList();
      await ar.search("E2E-AR-");
      await expect(ar.row(doc.no)).toBeVisible();
      await ar.gotoDetail(doc.id);
      await expect(ar.statusChip()).toHaveText(/posted/i);
      expect(await ar.summary().valueOf("total")).toBe(docAmounts([{ qty: 3, price: 333.33 }]).total);
    },
  );

  requestorTest(
    "TC-ARINV-100002 Requestor ไม่เห็นปุ่ม Void บนใบ posted และใบ Draft และไม่เห็น Submit บนใบ posted",
    {
      annotation: [
        { type: "preconditions", description: "Requestor login (accounting.ar.view เท่านั้น ไม่มี accounting.ar.void); E2E-AR-POSTED ลงบัญชีแล้ว E2E-AR-DRAFT เป็น Draft" },
        { type: "steps", description: "1. เปิดรายละเอียด E2E-AR-POSTED\n2. เปิดรายละเอียด E2E-AR-DRAFT" },
        { type: "expected", description: "ทั้งสองหน้าไม่มีปุ่ม Void; หน้า E2E-AR-POSTED ไม่มีปุ่ม Submit (Void ถูกกรองด้วยสิทธิ์ accounting.ar.void ใน FE)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Authorization" },
      ],
    },
    async ({ page }) => {
      const ar = new ArInvoicePage(page);
      for (const key of ["E2E-AR-POSTED", "E2E-AR-DRAFT"]) {
        const doc = await seededArDoc(key);
        await ar.gotoDetail(doc.id);
        await expect(ar.button("Void")).toHaveCount(0);
        if (key === "E2E-AR-POSTED") await expect(ar.button("Submit")).toHaveCount(0);
      }
    },
  );

  requestorTest(
    "TC-ARINV-100003 Requestor ไม่เห็นปุ่ม New Invoice ที่กดได้บนรายการ",
    {
      annotation: [
        { type: "preconditions", description: "Requestor login (viewer: accounting.ar.view เท่านั้น)" },
        { type: "steps", description: "1. เปิดรายการ AR invoice" },
        { type: "expected", description: "ไม่มีปุ่ม New Invoice ที่กดได้ (ไม่แสดง หรืออย่างน้อย disabled)" },
        { type: "note", description: "ปักเป็นบั๊ก: ปุ่มเปิดใช้งานสำหรับ viewer เพราะ canWrite ของ FE ไม่ผูกกับสิทธิ์ accounting.ar; ดู bug list" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Authorization" },
      ],
    },
    async ({ page }) => {
      requestorTest.fail(true, "suspected bug: the view-only Requestor sees an enabled New Invoice button (useCan.canWrite is not tied to an accounting.ar key); see docs/superpowers/specs/2026-11-25-e2e-ar-invoice-bug-list.md");
      const ar = new ArInvoicePage(page);
      await ar.gotoList();
      await expect(ar.newInvoiceButton().and(page.locator(":enabled"))).toHaveCount(0);
    },
  );

  requestorTest(
    "TC-ARINV-100005 Requestor ไม่เห็นปุ่ม Submit บนใบ Draft (Submit ลงบัญชีได้ จึงไม่ควรเปิดให้ viewer)",
    {
      annotation: [
        { type: "preconditions", description: "Requestor login (accounting.ar.view เท่านั้น); E2E-AR-DRAFT เป็น Draft" },
        { type: "steps", description: "1. เปิดรายละเอียด E2E-AR-DRAFT" },
        { type: "expected", description: "ไม่มีปุ่ม Submit (การ Submit ลงบัญชีโดยตรงเมื่อไม่มี workflow). assumption: viewer ลงบัญชีไม่ได้" },
        { type: "note", description: "ปักเป็นบั๊ก: gateway และ FE ใช้ accounting.ar.view เป็นสิทธิ์ของ Submit จึงเปิดให้ viewer; ดู bug list" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Authorization" },
      ],
    },
    async ({ page }) => {
      requestorTest.fail(true, "suspected bug: Submit (which posts the invoice) is gated by accounting.ar.view, so the view-only Requestor gets the button; see docs/superpowers/specs/2026-11-25-e2e-ar-invoice-bug-list.md");
      const ar = new ArInvoicePage(page);
      const doc = await seededArDoc("E2E-AR-DRAFT");
      await ar.gotoDetail(doc.id);
      await expect(ar.button("Submit")).toHaveCount(0);
    },
  );

  requestorTest(
    "TC-ARINV-100006 Requestor submit ใบ Draft ผ่าน API: ถูกปฏิเสธ 403 และใบยังคง draft",
    {
      annotation: [
        { type: "preconditions", description: "ใบ Draft 1 x 100.00 ที่ Admin สร้างผ่าน API; Requestor เป็น viewer (accounting.ar.view เท่านั้น)" },
        { type: "steps", description: "1. Requestor เรียก POST /ar-invoice/:id/submit ผ่าน API" },
        { type: "expected", description: "ตอบ 403; ใบยัง draft เลข DRAFT- ไม่มี JV. assumption: viewer ลงบัญชีไม่ได้" },
        { type: "note", description: "ปักเป็นบั๊กเดียวกับ 100005: submit ใช้สิทธิ์ accounting.ar.view; ดู bug list" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Security" },
      ],
    },
    async () => {
      requestorTest.fail(true, "suspected bug: Submit (which posts the invoice) is gated by accounting.ar.view, so the view-only Requestor can post through the API; see docs/superpowers/specs/2026-11-25-e2e-ar-invoice-bug-list.md");
      const created = await createArDoc("invoice", { tag: tag("reqsubmit"), lines: [{ qty: 1, price: 100, vat: true }] });
      const res = await submitArDoc(created.id, "Requestor");
      expect(res.status, `${created.no}: ${JSON.stringify(res.body).slice(0, 200)}`).toBe(403);
      const doc = await getArDoc(created.id);
      expect(doc.status).toBe("draft");
      expect(doc.glJvId).toBeFalsy();
    },
  );

  requestorTest(
    "TC-ARINV-100004 Requestor void ใบผ่าน API: ถูกปฏิเสธ 4xx และใบยังคง posted",
    {
      annotation: [
        { type: "preconditions", description: "ใบ 1 x 100.00 ที่ Admin Submit ลงบัญชีแล้ว; Requestor ไม่มีสิทธิ์ accounting.ar.void" },
        { type: "steps", description: "1. Requestor เรียก POST /ar-invoice/:id/void พร้อมเหตุผลผ่าน API" },
        { type: "expected", description: "ตอบ 403 ไม่ใช่ 2xx; ใบยัง posted ค้าง 107.00; ไม่มี JV กลับรายการ (1 JV)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Security" },
      ],
    },
    async () => {
      const { id } = await posted("invoice", "reqvoid", [{ qty: 1, price: 100, vat: true }]);
      const res = await voidArDoc(id, "Requestor", "e2e requestor void");
      expect(res.status, JSON.stringify(res.body).slice(0, 300)).toBe(403);
      const doc = await getArDoc(id);
      expect(doc.status).toBe("posted");
      expect(doc.outstanding).toBe(docAmounts([{ qty: 1, price: 100 }]).total);
      expect(doc.voidGlJvId).toBeFalsy();
      expect(new Set((await jvOfSource("ar_invoice", id)).map((l) => l.jvId)).size).toBe(1);
    },
  );
});
