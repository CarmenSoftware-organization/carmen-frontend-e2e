import { expect, type Locator, type Page } from "@playwright/test";
import { createAuthTest } from "./fixtures/auth.fixture";
import {
  assertIaReady,
  calcMethod,
  cleanupIaRun,
  commitIa,
  createIa,
  getIa,
  movementsOf,
  stockAt,
  voidIa,
  type IaLine,
  type IaReady,
  type IaType,
} from "./helpers/ia-api";
import { buSend } from "./helpers/bu-api";
import { addRow, confirmDialog, pickDate, pickLookup, typeInto } from "./helpers/movement/ui";
import { expectSaved } from "./helpers/settle";
import { uid } from "./helpers/test-data";
import { InventoryAdjustmentPage } from "./pages/inventory-adjustment.page";

/**
 * Inventory Adjustment stock / cost outcomes, Stock In side (section 80) on the TEST BU (GR2VYNKQ) as Admin.
 * Money and stock are asserted through the API (inventory-info on-hand and cost layers, the document's stock-movements),
 * never through toasts. Every figure is a delta of a live read taken just before the action, so leftover layers of an
 * earlier run (or 731 sharing E2E-IA-A / E2E-IA-B) cannot break a re-run. `cleanupIaRun("732")` (afterAll) voids what this
 * spec committed (Stock Outs first) and deletes its drafts.
 *
 * Known bugs pinned with `test.fail()` (turn red once fixed): see the bug list
 *   docs/superpowers/specs/2026-11-23-e2e-inventory-adjustment-bug-list.md
 */
const test = createAuthTest("carmensoftware.dev+admin@gmail.com");
test.describe.configure({ timeout: 180_000 });

const TAG = "E2E-IA 732";
const REASON_NAME_IN = "E2E IA stock in";
const ready: { v: IaReady | null } = { v: null };
const R = () => ready.v as IaReady;
let method: "average" | "fifo" = "average";

const status = (r: { status: number }) => r.status;
const errCode = (r: { body: any }) => String(r.body?.error?.code ?? "");
const items = (body: any): any[] => (Array.isArray(body?.data?.items) ? body.data.items : []);
const day = (iso: string) => String(iso).slice(0, 10);
const shiftDay = (d: string, n: number) => new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10) + n)).toISOString().slice(0, 10);

/** A draft made through the API. Throws unless the backend accepted it. */
async function draft(type: IaType, what: string, lines: IaLine[], date = R().today): Promise<{ id: string; version: number }> {
  const r = await createIa(type, {
    date,
    locationId: R().locationId,
    adjustmentTypeId: type === "stock-in" ? R().adjustmentTypeIn : R().adjustmentTypeOut,
    description: `${TAG} ${what} ${uid}`,
    lines,
  });
  expect(r.status, `create ${type} draft: ${JSON.stringify(r.body).slice(0, 200)}`).toBeLessThan(300);
  return { id: r.body.data.id as string, version: Number(r.body.data.doc_version ?? 0) };
}

async function versionOf(type: IaType, id: string): Promise<number> {
  const g = await getIa(type, id);
  expect(g.status, `read ${type} ${id}`).toBe(200);
  return Number(g.body.data.doc_version);
}

async function statusOf(type: IaType, id: string): Promise<string> {
  const g = await getIa(type, id);
  return g.status === 200 ? String(g.body.data.doc_status) : `http-${g.status}`;
}

/** Commit with the document's current doc_version (what the FE sends). */
async function commitNow(type: IaType, id: string) {
  return commitIa(type, id, await versionOf(type, id));
}

async function commitOk(type: IaType, id: string) {
  const r = await commitNow(type, id);
  expect(r.status, `commit ${type} ${id}: ${JSON.stringify(r.body).slice(0, 200)}`).toBeLessThan(300);
  return r;
}

/** Movement lines actually posted: a draft's stock-movements is a preview (is_posted false) and does not count. */
const postedLines = async (type: IaType, id: string) => {
  const { body } = await movementsOf(type, id);
  return body?.data?.is_posted === true ? items(body).length : 0;
};
const onHand = (productId: string, date = R().today) => stockAt(productId, R().locationId, date);

/** Guard that the backend really answered (not a login / gateway / server failure) before a bug is pinned. */
const answered = (r: { status: number; body: any }, what: string) => {
  expect(r.status, `${what}: the backend must answer (got ${r.status})`).not.toBe(401);
  expect(r.status, `${what}: the backend must answer (got ${r.status})`).toBeLessThan(500);
};

/** Type a Stock In cost and make sure it sticks: CostProbe fills a cost asynchronously and can overwrite what was typed. */
async function typeCost(page: Page, input: Locator, price: number) {
  await expect(async () => {
    await typeInto(input, price);
    await page.waitForLoadState("networkidle");
    expect(Number(await input.inputValue())).toBe(price);
  }).toPass({ timeout: 20_000 });
}

test.describe("Inventory Adjustment stock outcomes (Stock In)", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeAll(async () => {
    ready.v = await assertIaReady();
    method = await calcMethod();
  });
  test.afterAll(async () => {
    await cleanupIaRun("732");
  });

  test(
    "TC-IADJ-800001 FC Commit Stock In จากหน้าจอแล้วสต๊อกและมูลค่าเพิ่มตามที่ลง และใบอ่านอย่างเดียว",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Admin; BU TEST; E2E-IA-A ผูกคลังเดียว; เหตุผล E2E-IA-IN; มีงวดเปิดครอบคลุมวันนี้; อ่านสต๊อก (on-hand และมูลค่า) ของ E2E-IA-A ก่อนกด Commit" },
        { type: "steps", description: "1. เปิดหน้าสร้าง Stock In\n2. Date = วันนี้, Reason E2E IA stock in, Location ของ E2E-IA-A\n3. Add Item: E2E-IA-A จำนวน 10 ต้นทุน 12.50\n4. ใส่คำอธิบาย E2E-IA 732 UI commit <uid>\n5. กด Commit แล้วยืนยัน\n6. อ่านสต๊อกและ stock-movements ของใบจาก API\n7. เปิดใบนั้นอีกครั้งในหน้าจอ" },
        { type: "expected", description: "ใบเป็น completed; on-hand เพิ่ม 10 และมูลค่าเพิ่ม 125.00; stock-movements มี 1 บรรทัดต้นทุน 12.50; เปิดใบซ้ำแล้วไม่มีปุ่ม Save และ Commit" },
        { type: "priority", description: "Critical" },
        { type: "testType", description: "Functional" },
        { type: "note", description: "เทียบส่วนต่างของสต๊อกที่อ่านสดก่อน/หลัง ไม่ยึดค่าสัมบูรณ์ · มูลค่า = ผลรวม balance_qty × cost_per_unit ของ cost_layers (inventory-info ไม่มีมูลค่ารวม)" },
      ],
    },
    async ({ page }) => {
      const ia = new InventoryAdjustmentPage(page);
      const a = R().productA;
      const desc = `${TAG} UI commit ${uid}`;
      const before = await onHand(a.id);

      await ia.gotoNew("stock-in");
      expect(await pickDate(page, ia.dateTrigger(), R().today), `Date ${R().today}`).toBe(true);
      await pickLookup(page, ia.reason(), REASON_NAME_IN);
      await pickLookup(page, ia.location(), R().locationName);
      const row = await addRow(page, "Select Product");
      await pickLookup(page, row.getByRole("button", { name: "Select Product" }), a.code);
      await typeInto(row.locator('input[name$=".qty"]'), 10);
      await typeCost(page, row.locator('input[name$=".cost_per_unit"]'), 12.5);
      await page.waitForLoadState("networkidle");
      await typeCost(page, row.locator('input[name$=".cost_per_unit"]'), 12.5);
      await ia.description().fill(desc);

      const res = await expectSaved(
        page,
        /\/stock-ins\/?(\?|$)/,
        async () => {
          await ia.commitButton().click();
          await confirmDialog(page, /commit/i);
        },
        page.locator("[data-sonner-toast]"),
      );
      const id: string = (await res.json()).data.id;
      await expect.poll(() => statusOf("stock-in", id), { timeout: 60_000 }).toBe("completed");

      const after = await onHand(a.id);
      expect(after.qty - before.qty, "on-hand moved by the committed qty").toBe(10);
      expect(after.value - before.value, "stock value moved by qty x cost").toBeCloseTo(125, 2);
      const mvBody = (await movementsOf("stock-in", id)).body;
      const mv = items(mvBody);
      expect(mvBody?.data?.is_posted, "movements are posted").toBe(true);
      expect(mv, "one movement line").toHaveLength(1);
      expect(Number(mv[0].cost_per_unit), "movement cost").toBeCloseTo(12.5, 2);

      await ia.gotoDoc("stock-in", id);
      await expect(page.getByText(desc).first()).toBeVisible();
      await page.waitForLoadState("networkidle");
      await expect(ia.saveButton(), "a completed document has no Save button").toHaveCount(0);
      await expect(ia.commitButton(), "a completed document has no Commit button").toHaveCount(0);
    },
  );

  test(
    "TC-IADJ-800002 FC Stock In ลงวันที่ก่อนงวดเปิดแรกสุดถูกปฏิเสธและไม่มีอะไรถูก commit",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Admin; BU TEST; อ่านรายการงวดจาก GET /inventory-periods แล้วหางวด open ที่เริ่มเร็วสุด; อ่านสต๊อก E2E-IA-A ก่อน" },
        { type: "steps", description: "1. หาวันก่อนวันเริ่มของงวดเปิดแรกสุด 1 วัน\n2. POST /stock-ins ลงวันนั้น (E2E-IA-A × 1 ต้นทุน 5)\n3. ถ้าสร้างได้ PATCH commit" },
        { type: "expected", description: "ขั้นสร้างหรือขั้น commit ตอบ 4xx ด้วย STOCK_IN_DATE_OUTSIDE_OPEN_PERIOD; ไม่มีใบ completed; on-hand ของ E2E-IA-A ไม่เปลี่ยน" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
        { type: "note", description: "เส้นทาง API เท่านั้น (ฟอร์มไม่ให้เลือกวันนอกงวด) · ไม่รู้งวดเปิด = เคสล้มพร้อมเหตุผล ไม่ข้าม" },
      ],
    },
    async () => {
      const a = R().productA;
      const list = await buSend("Admin", "GET", "/inventory-periods?perpage=100");
      expect(list.status, "GET /inventory-periods").toBe(200);
      const open = ((list.body?.data ?? []) as any[]).filter((p) => p.status === "open").sort((x, y) => String(x.start_at).localeCompare(String(y.start_at)));
      expect(open.length, "no open inventory period is known on TEST BU - cannot build a date outside every open period").toBeGreaterThan(0);
      const bad = shiftDay(day(open[0].start_at), -1);

      const before = await onHand(a.id);
      const made = await createIa("stock-in", {
        date: bad,
        locationId: R().locationId,
        adjustmentTypeId: R().adjustmentTypeIn,
        description: `${TAG} outside period ${uid}`,
        lines: [{ productId: a.id, qty: 1, cost: 5 }],
      });
      let refused = made;
      if (made.status < 300) refused = await commitNow("stock-in", made.body.data.id);
      expect(refused.status, `date ${bad} must be refused: ${JSON.stringify(refused.body).slice(0, 200)}`).toBeGreaterThanOrEqual(400);
      expect(refused.status).toBeLessThan(500);
      expect(errCode(refused)).toBe("STOCK_IN_DATE_OUTSIDE_OPEN_PERIOD");
      if (made.status < 300) expect(await statusOf("stock-in", made.body.data.id), "the refused document must not be completed").toBe("draft");
      expect((await onHand(a.id)).qty - before.qty, "on-hand unchanged").toBe(0);
    },
  );

  test(
    "TC-IADJ-800003 FC Commit Stock In ซ้ำหลังสำเร็จแล้วถูกปฏิเสธและลงสต๊อกครั้งเดียว",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Admin; BU TEST; สร้าง Stock In draft E2E-IA-A × 4 ต้นทุน 7 ทาง API; อ่านสต๊อกก่อน" },
        { type: "steps", description: "1. PATCH commit ครั้งแรก\n2. PATCH commit ซ้ำทันที (ส่ง doc_version ปัจจุบัน)\n3. อ่านสต๊อกและ stock-movements" },
        { type: "expected", description: "ครั้งแรกสำเร็จ; ครั้งสองตอบ 4xx STOCK_IN_ONLY_DRAFT_COMMITTABLE; จำนวน movement = จำนวนบรรทัด (1); on-hand เพิ่ม 4 ครั้งเดียว" },
        { type: "priority", description: "Critical" },
        { type: "testType", description: "Negative" },
        { type: "note", description: "กันกดซ้ำแบบต่อเนื่อง (sequential)" },
      ],
    },
    async () => {
      const a = R().productA;
      const d = await draft("stock-in", "commit twice", [{ productId: a.id, qty: 4, cost: 7 }]);
      const before = await onHand(a.id);
      await commitOk("stock-in", d.id);
      const second = await commitNow("stock-in", d.id);
      expect(second.status, `second commit: ${JSON.stringify(second.body).slice(0, 200)}`).toBeGreaterThanOrEqual(400);
      expect(second.status).toBeLessThan(500);
      expect(errCode(second)).toBe("STOCK_IN_ONLY_DRAFT_COMMITTABLE");
      expect(await postedLines("stock-in", d.id), "movements = lines").toBe(1);
      expect((await onHand(a.id)).qty - before.qty, "qty posted once").toBe(4);
    },
  );

  test(
    "TC-IADJ-800004 FC Commit Stock In พร้อมกัน 2 คำขอลงสต๊อกครั้งเดียว (มี/ไม่มี doc_version)",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Admin; BU TEST; สร้าง Stock In draft 2 ใบ (E2E-IA-A × 3 ต้นทุน 6) ทาง API; อ่านสต๊อกก่อนแต่ละใบ" },
        { type: "steps", description: "(a) ใบที่ 1: ยิง PATCH commit 2 คำขอพร้อมกัน (Promise.all) ด้วย doc_version เดียวกัน\n(b) ใบที่ 2: ยิง PATCH commit 2 คำขอพร้อมกันโดยไม่ส่ง doc_version แล้วค่อย commit ให้ถูกต้องอีกครั้ง\nอ่านสต๊อกและ stock-movements หลังแต่ละขั้น" },
        { type: "expected", description: "(a) ลงสต๊อกครั้งเดียว: on-hand เพิ่ม 3 และ movement = 1 บรรทัด\n(b) คำขอที่ไม่มี doc_version ถูกปฏิเสธ 4xx ทั้งคู่ ไม่มี movement และ on-hand ไม่เปลี่ยน; commit ที่ถูกต้องหลังจากนั้นลงครั้งเดียว" },
        { type: "priority", description: "Critical" },
        { type: "testType", description: "Concurrency" },
        { type: "note", description: "ผลตัดสิน R6: DTO ของ commit บังคับ doc_version เป็นจำนวนเต็ม จึงทดสอบ (b) เป็น 'ไม่มี doc_version ต้องไม่ลงอะไร'. ถ้า (b) ลงซ้ำ = บั๊ก (เช็คสถานะอยู่นอก transaction, stock-in.service.ts:706-710)" },
      ],
    },
    async () => {
      const a = R().productA;
      // (a) same doc_version in parallel
      const da = await draft("stock-in", "parallel same version", [{ productId: a.id, qty: 3, cost: 6 }]);
      const ver = await versionOf("stock-in", da.id);
      const beforeA = await onHand(a.id);
      const pa = await Promise.all([commitIa("stock-in", da.id, ver), commitIa("stock-in", da.id, ver)]);
      expect(pa.filter((r) => r.status < 300).length, `parallel commit (same doc_version) must succeed once: ${pa.map(status).join("/")}`).toBe(1);
      expect(await postedLines("stock-in", da.id), "(a) movements = lines").toBe(1);
      expect((await onHand(a.id)).qty - beforeA.qty, "(a) qty posted once").toBe(3);

      // (b) neither carries doc_version
      const db = await draft("stock-in", "parallel no version", [{ productId: a.id, qty: 3, cost: 6 }]);
      const beforeB = await onHand(a.id);
      const pb = await Promise.all([commitIa("stock-in", db.id), commitIa("stock-in", db.id)]);
      for (const r of pb) answered(r, "commit without doc_version");
      const afterB = await onHand(a.id);
      const posted = await postedLines("stock-in", db.id);
      if (pb.some((r) => r.status < 300) || posted !== 0 || afterB.qty !== beforeB.qty) {
        // accepted: it must still be exactly one posting, otherwise this is the double-post bug
        test.fail(true, "suspected bug: parallel commit without doc_version posts twice (status check outside the transaction, stock-in.service.ts:706-710)");
        expect(posted, "(b) movements = lines").toBe(1);
        expect(afterB.qty - beforeB.qty, "(b) qty posted once").toBe(3);
        expect(pb.filter((r) => r.status < 300).length, "(b) exactly one commit accepted").toBe(1);
        return;
      }
      for (const r of pb) expect(r.status, `commit without doc_version refused: ${JSON.stringify(r.body).slice(0, 150)}`).toBeGreaterThanOrEqual(400);
      await commitOk("stock-in", db.id);
      expect(await postedLines("stock-in", db.id), "(b) one posting after the proper commit").toBe(1);
      expect((await onHand(a.id)).qty - beforeB.qty, "(b) qty posted once").toBe(3);
    },
  );

  test(
    "TC-IADJ-800005 FC Void Stock In ที่สต๊อกยังไม่ถูกแตะแล้ว on-hand และมูลค่ากลับเท่าก่อน commit",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Admin; BU TEST; อ่านสต๊อก (on-hand และมูลค่า) ของ E2E-IA-B ก่อน commit" },
        { type: "steps", description: "1. สร้าง Stock In E2E-IA-B × 5 ต้นทุน 9 ทาง API แล้ว commit\n2. อ่านสต๊อก\n3. Void ใบ (void_reason + doc_version ปัจจุบัน)\n4. อ่านสต๊อก" },
        { type: "expected", description: "หลัง commit on-hand +5 มูลค่า +45.00; หลัง void ส่วนต่างเทียบก่อน commit เป็น 0 ทั้งจำนวนและมูลค่า" },
        { type: "priority", description: "Critical" },
        { type: "testType", description: "Functional" },
        { type: "note", description: "การที่ใบที่ void แล้วหายจากรายการ (soft-delete) อยู่ในกลุ่ม 82" },
      ],
    },
    async () => {
      const b = R().productB;
      const d = await draft("stock-in", "void untouched", [{ productId: b.id, qty: 5, cost: 9 }]);
      const before = await onHand(b.id);
      await commitOk("stock-in", d.id);
      const mid = await onHand(b.id);
      expect(mid.qty - before.qty, "commit +qty").toBe(5);
      expect(mid.value - before.value, "commit +value").toBeCloseTo(45, 2);
      const v = await voidIa("stock-in", d.id, "e2e void untouched", await versionOf("stock-in", d.id));
      expect(v.status, `void: ${JSON.stringify(v.body).slice(0, 200)}`).toBeLessThan(300);
      const after = await onHand(b.id);
      expect(after.qty - before.qty, "on-hand back to before").toBe(0);
      expect(after.value - before.value, "value back to before").toBeCloseTo(0, 2);
    },
  );

  test(
    "TC-IADJ-800006 FC Void Stock In ที่ถูกจ่ายออกไปบางส่วนแล้วถูกปฏิเสธและสต๊อกไม่เปลี่ยน",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Admin; BU TEST; เหตุผล E2E-IA-OUT; จำนวน Stock Out = 4 (มากกว่านี้ถ้า E2E-IA-B มีสต๊อกเดิมอยู่ เพื่อให้ยอดต่ำสุดหลังจ่ายต่ำกว่าที่ลงไว้)" },
        { type: "steps", description: "1. Stock In E2E-IA-B × 10 วันนี้ commit\n2. Stock Out E2E-IA-B × 4 วันนี้ commit\n3. อ่านสต๊อก\n4. Void Stock In\n5. อ่านสต๊อก" },
        { type: "expected", description: "void ตอบ 4xx STOCK_IN_VOID_INSUFFICIENT_STOCK; ใบ Stock In ยัง completed; on-hand ไม่เปลี่ยนจากก่อน void" },
        { type: "priority", description: "Critical" },
        { type: "testType", description: "Negative" },
        { type: "note", description: "เช็คจากยอดคงเหลือต่ำสุดที่จ่ายได้ตั้งแต่ si_date เป็นต้นไป ไม่ใช่ on-hand ปัจจุบัน (stock-in.service.ts:1795-1817); cleanup void Stock Out ก่อน Stock In" },
      ],
    },
    async () => {
      const a = R().productB;
      // The void check uses the lowest balance from si_date on, so the Stock Out must draw the balance below the Stock In qty:
      // 4 on an empty product, more when the product already holds stock (live read, never an absolute).
      const start = await onHand(a.id);
      const outQty = Math.max(4, Math.floor(start.qty) + 1);
      const si = await draft("stock-in", "void partial in", [{ productId: a.id, qty: 10, cost: 8 }]);
      await commitOk("stock-in", si.id);
      const so = await draft("stock-out", "void partial out", [{ productId: a.id, qty: outQty }]);
      await commitOk("stock-out", so.id);
      const before = await onHand(a.id);
      const v = await voidIa("stock-in", si.id, "e2e void partial issue", await versionOf("stock-in", si.id));
      expect(v.status, `void must be refused: ${JSON.stringify(v.body).slice(0, 200)}`).toBeGreaterThanOrEqual(400);
      expect(v.status).toBeLessThan(500);
      expect(errCode(v)).toBe("STOCK_IN_VOID_INSUFFICIENT_STOCK");
      expect(await statusOf("stock-in", si.id), "the Stock In stays completed").toBe("completed");
      const after = await onHand(a.id);
      expect(after.qty - before.qty, "on-hand unchanged").toBe(0);
    },
  );

  // 800007 / 800008 / 800009: each pins its own bug, so a fix of one turns only that case red.
  // When the backend accepts the bad document, this helper voids it again before the case asserts (cleanupIaRun would
  // otherwise meet it later). Voiding a negative-cost Stock In takes stock out that its commit never added (observed:
  // on-hand -qty), so the helper then posts a compensating Stock In of the missing qty. That document is described
  // "E2E-IA drift-fix 732 ..." on purpose: it is not tagged "E2E-IA 732", so cleanupIaRun leaves it (a void of it would drift again).
  async function badLine(what: string, line: IaLine) {
    const a = R().productA;
    const before = await onHand(a.id);
    const made = await createIa("stock-in", {
      date: R().today,
      locationId: R().locationId,
      adjustmentTypeId: R().adjustmentTypeIn,
      description: `${TAG} ${what} ${uid}`,
      lines: [line],
    });
    answered(made, `create (${what})`);
    // refused already at create is a valid refusal too
    const result = made.status < 300 ? await commitNow("stock-in", made.body.data.id) : made;
    answered(result, `commit (${what})`);
    const afterCommit = await onHand(a.id);
    let drift = 0;
    if (made.status < 300 && result.status < 300) {
      const v = await voidIa("stock-in", made.body.data.id, `e2e void of accepted ${what}`, await versionOf("stock-in", made.body.data.id));
      expect(v.status, `the accepted bad document must be voidable: ${JSON.stringify(v.body).slice(0, 200)}`).toBeLessThan(300);
      drift = (await onHand(a.id)).qty - before.qty;
      if (drift < 0) {
        const fix = await createIa("stock-in", {
          date: R().today,
          locationId: R().locationId,
          adjustmentTypeId: R().adjustmentTypeIn,
          description: `E2E-IA drift-fix 732 ${what} ${uid}`,
          lines: [{ productId: a.id, qty: -drift, cost: 1 }],
        });
        expect(fix.status, "compensating Stock In").toBeLessThan(300);
        await commitOk("stock-in", fix.body.data.id);
      }
    }
    return { before, result, afterCommit, drift };
  }

  test(
    "TC-IADJ-800007 FC Commit Stock In จำนวนติดลบต้องถูกปฏิเสธ",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Admin; BU TEST; อ่านสต๊อก E2E-IA-A ก่อน" },
        { type: "steps", description: "1. สร้าง Stock In draft ทาง API: E2E-IA-A × -1 ต้นทุน 5\n2. PATCH commit" },
        { type: "expected", description: "ถูกปฏิเสธ 4xx (สร้างไม่ได้ หรือ commit ไม่ผ่าน) และ on-hand ไม่เปลี่ยน" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
        { type: "note", description: "ผู้ใช้ตัดสิน 23 พ.ย.: รับ qty ติดลบ = บั๊ก (DTO ไม่มี @Min/@IsPositive) — ปักหมุด test.fail" },
      ],
    },
    async () => {
      const { before, result, afterCommit } = await badLine("negative qty", { productId: R().productA.id, qty: -1, cost: 5 });
      test.fail(true, "suspected bug: negative Stock In qty accepted (acts as an unchecked stock out)");
      expect(result.status, `negative qty must be refused (got ${result.status})`).toBeGreaterThanOrEqual(400);
      expect(afterCommit.qty - before.qty, "on-hand unchanged").toBe(0);
    },
  );

  test(
    "TC-IADJ-800008 FC Commit Stock In ต้นทุนติดลบต้องถูกปฏิเสธ",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Admin; BU TEST; อ่านสต๊อก E2E-IA-A ก่อน" },
        { type: "steps", description: "1. สร้าง Stock In draft ทาง API: E2E-IA-A × 2 ต้นทุน -5\n2. PATCH commit" },
        { type: "expected", description: "ถูกปฏิเสธ 4xx และ on-hand ไม่เปลี่ยน" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
        { type: "note", description: "ผู้ใช้ตัดสิน 23 พ.ย.: รับต้นทุนติดลบ = บั๊ก — ปักหมุด test.fail" },
      ],
    },
    async () => {
      const { before, result, afterCommit } = await badLine("negative cost", { productId: R().productA.id, qty: 2, cost: -5 });
      test.fail(true, "suspected bug: negative cost accepted");
      expect(result.status, `negative cost must be refused (got ${result.status})`).toBeGreaterThanOrEqual(400);
      expect(afterCommit.qty - before.qty, "on-hand unchanged").toBe(0);
    },
  );

  test(
    "TC-IADJ-800009 FC Commit Stock In บรรทัดจำนวน 0 ต้องถูกปฏิเสธ",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Admin; BU TEST; อ่านสต๊อก E2E-IA-A ก่อน" },
        { type: "steps", description: "1. สร้าง Stock In draft ทาง API: E2E-IA-A × 0 ต้นทุน 5\n2. PATCH commit" },
        { type: "expected", description: "ถูกปฏิเสธ 4xx และไม่มี movement; on-hand ไม่เปลี่ยน" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
        { type: "note", description: "ฟอร์มให้แถวใหม่เริ่มที่ 0 จึงไม่ขึ้น error แต่ commit ต้องไม่รับ · ผู้ใช้ตัดสิน 23 พ.ย.: รับ = บั๊ก — ปักหมุด test.fail" },
      ],
    },
    async () => {
      const { before, result, afterCommit } = await badLine("qty zero", { productId: R().productA.id, qty: 0, cost: 5 });
      test.fail(true, "suspected bug: qty 0 line accepted on commit");
      expect(result.status, `qty 0 must be refused (got ${result.status})`).toBeGreaterThanOrEqual(400);
      expect(afterCommit.qty - before.qty, "on-hand unchanged").toBe(0);
    },
  );

  test(
    "TC-IADJ-800010 FC Stock In ลงวันแรกของงวดถัดไปที่สร้างล่วงหน้า (AVG: completed แต่ยังไม่ลงสต๊อก)",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Admin; BU TEST; อ่านวิธีคิดต้นทุนของ BU จาก calculation-method; มีงวด open ที่เริ่มหลังงวดปัจจุบัน (สร้างล่วงหน้า) ใน GET /inventory-periods" },
        { type: "steps", description: "1. หางวดที่เริ่มหลังงวดปัจจุบัน; ไม่พบ = ล้มพร้อมเหตุผล\n2. อ่านสต๊อก E2E-IA-A ที่วันแรกของงวดนั้นและวันนี้\n3. สร้าง Stock In E2E-IA-A × 2 ต้นทุน 11 ลงวันแรกของงวดนั้น แล้ว commit\n4. อ่านสต๊อกอีกครั้ง" },
        { type: "expected", description: "AVG: ใบ completed และ on-hand ที่วันนั้นและวันนี้ไม่เปลี่ยน (รอ bring-forward); FIFO: commit ลง movement จริง" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
        { type: "note", description: "TEST BU ใช้วิธี average (อ่านสด) · เส้นทาง API เท่านั้น (ฟอร์มไม่ให้ลงวันอนาคต) · งวดที่สองต้องสร้างเตรียมไว้เอง — เคสนี้ไม่ปิดงวดและไม่สร้างงวด" },
      ],
    },
    async () => {
      const a = R().productA;
      const list = await buSend("Admin", "GET", "/inventory-periods?perpage=100");
      expect(list.status, "GET /inventory-periods").toBe(200);
      const periods = ((list.body?.data ?? []) as any[]).sort((x, y) => String(x.start_at).localeCompare(String(y.start_at)));
      const current = periods.find((p) => day(p.start_at) <= R().today && R().today <= day(p.end_at));
      expect(current, "no inventory period contains today").toBeTruthy();
      const later = periods.find((p) => p.status === "open" && day(p.start_at) > day(current.end_at));
      expect(later, "no pre-generated period after the current one exists on TEST BU (GET /inventory-periods lists only the current period) - generate the next period first").toBeTruthy();
      const date = day(later.start_at);

      const beforeThen = await onHand(a.id, date);
      const beforeNow = await onHand(a.id);
      const d = await draft("stock-in", "later period", [{ productId: a.id, qty: 2, cost: 11 }], date);
      await commitOk("stock-in", d.id);
      expect(await statusOf("stock-in", d.id)).toBe("completed");
      if (method === "average") {
        expect((await onHand(a.id, date)).qty - beforeThen.qty, "on-hand at that date unchanged (held until bring-forward)").toBe(0);
        expect((await onHand(a.id)).qty - beforeNow.qty, "on-hand today unchanged").toBe(0);
      } else {
        expect(await postedLines("stock-in", d.id), "FIFO posts the movement").toBe(1);
      }
    },
  );
});
