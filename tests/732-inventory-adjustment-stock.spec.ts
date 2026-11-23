import { expect, type Locator, type Page } from "@playwright/test";
import { createAuthTest } from "./fixtures/auth.fixture";
import {
  assertIaReady,
  calcMethod,
  cleanupIaRun,
  commitIa,
  costLayers,
  createIa,
  deleteIa,
  getIa,
  listIa,
  movementsOf,
  stockAt,
  updateIa,
  voidIa,
  type IaLine,
  type IaReady,
  type IaType,
  typeCost,
} from "./helpers/ia-api";
import { buSend } from "./helpers/bu-api";
import { expectedIssueCost } from "./helpers/ia-cost";
import { addRow, confirmDialog, pickDate, pickLookup, typeInto } from "./helpers/movement/ui";
import { expectRefused, expectSaved } from "./helpers/settle";
import { uid } from "./helpers/test-data";
import { InventoryAdjustmentPage } from "./pages/inventory-adjustment.page";

/**
 * Inventory Adjustment stock / cost outcomes: Stock In (section 80), Stock Out (81) and what a void leaves behind (82) on the TEST BU (BU-GR2VYNKQ) as Admin.
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
const REASON_NAME_OUT = "E2E IA stock out";
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

test.describe("Inventory Adjustment stock outcomes (Stock In / Stock Out / void)", () => {
  test.describe.configure({ mode: "serial" });
  const leakedBad = new Set<string>(); // accepted-bad documents whose effect could not be voided in the case
  test.beforeAll(async () => {
    ready.v = await assertIaReady();
    method = await calcMethod();
  });
  test.afterAll(async () => {
    // Cleanup voids / deletes every run document one by one over all list pages of the shared
    // TEST BU; the default 30 s hook budget ran out (TC-IADJ-800010 reported the timeout).
    test.setTimeout(180_000);
    await cleanupIaRun("732", leakedBad);
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
      await typeCost(row.locator('input[name$=".cost_per_unit"]'), 12.5);
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

      // The value is read from a ledger the backend updates right after the status flips: poll it instead of one read.
      await expect.poll(async () => (await onHand(a.id)).value - before.value, { message: "stock value moved by qty x cost", timeout: 20_000 }).toBeCloseTo(125, 2);
      const after = await onHand(a.id);
      expect(after.qty - before.qty, "on-hand moved by the committed qty").toBe(10);
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
      // Policy (same as 810005 (b)): a commit without doc_version accepted AND posted exactly once = pass (no double-post, R6);
      // accepted with a double post, or refused yet posted = bug pin.
      const accepted = pb.filter((r) => r.status < 300).length;
      const deltaB = afterB.qty - beforeB.qty;
      if (posted > 1 || accepted > 1 || deltaB > 3 || (accepted === 0 && (posted !== 0 || deltaB !== 0))) {
        test.fail(true, "suspected bug: parallel commit without doc_version posts twice or posts although refused (status check outside the transaction, stock-in.service.ts:706-710)");
        expect(posted, "(b) movements = lines").toBe(1);
        expect(deltaB, "(b) qty posted once").toBe(3);
        expect(accepted, "(b) exactly one commit accepted").toBe(1);
        return;
      }
      if (accepted === 1) {
        expect(posted, "(b) exactly one posting").toBe(1);
        expect(deltaB, "(b) qty posted once").toBe(3);
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
      await expect.poll(async () => (await onHand(b.id)).qty - before.qty, { message: "commit +qty", timeout: 20_000 }).toBe(5);
      await expect.poll(async () => (await onHand(b.id)).value - before.value, { message: "commit +value", timeout: 20_000 }).toBeCloseTo(45, 2);
      const v = await voidIa("stock-in", d.id, "e2e void untouched", await versionOf("stock-in", d.id));
      expect(v.status, `void: ${JSON.stringify(v.body).slice(0, 200)}`).toBeLessThan(300);
      await expect.poll(async () => (await onHand(b.id)).qty - before.qty, { message: "on-hand back to before", timeout: 20_000 }).toBe(0);
      await expect.poll(async () => (await onHand(b.id)).value - before.value, { message: "value back to before", timeout: 20_000 }).toBeCloseTo(0, 2);
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
      // Hand the product back as found (Stock Out first): the 81 group prices issues from the pooled average, and a
      // leftover 6 units at 8.00 would skew it for every Stock Out case after this one.
      for (const [type, id] of [["stock-out", so.id], ["stock-in", si.id]] as const) {
        const undo = await voidIa(type, id, "e2e undo 800006", await versionOf(type, id));
        expect(undo.status, `undo ${type}: ${JSON.stringify(undo.body).slice(0, 200)}`).toBeLessThan(300);
      }
    },
  );

  // 800007 / 800008 / 800009: each pins its own bug, so a fix of one turns only that case red.
  // The bad document is described "E2E-IA 732 accepted-bad ...". A wrongly accepted one is handled by its measured commit
  // effect (R11), never by a compensating document: no effect on on-hand / value -> left alone (cleanupIaRun skips completed
  // "accepted-bad" documents, but throws for one whose in-case void failed); an effect -> voided, and the void must return the stock to the pre-commit read (else it is its own bug).
  async function badLine(what: string, line: IaLine) {
    const a = R().productA;
    const before = await onHand(a.id);
    const made = await createIa("stock-in", {
      date: R().today,
      locationId: R().locationId,
      adjustmentTypeId: R().adjustmentTypeIn,
      description: `${TAG} accepted-bad ${what} ${uid}`,
      lines: [line],
    });
    answered(made, `create (${what})`);
    // refused already at create is a valid refusal too
    const result = made.status < 300 ? await commitNow("stock-in", made.body.data.id) : made;
    answered(result, `commit (${what})`);
    const afterCommit = await onHand(a.id);
    let voidReturned: boolean | null = null;
    const hadEffect = Math.abs(afterCommit.qty - before.qty) > 1e-9 || Math.abs(afterCommit.value - before.value) > 1e-9;
    if (made.status < 300 && result.status < 300 && hadEffect) {
      const v = await voidIa("stock-in", made.body.data.id, `e2e void of accepted ${what}`, await versionOf("stock-in", made.body.data.id));
      if (v.status >= 300) leakedBad.add(made.body.data.id);
      expect(v.status, `the accepted bad document must be voidable: ${JSON.stringify(v.body).slice(0, 200)}`).toBeLessThan(300);
      const afterVoid = await onHand(a.id);
      voidReturned = Math.abs(afterVoid.qty - before.qty) < 1e-9 && Math.abs(afterVoid.value - before.value) < 1e-9;
    }
    return { before, result, afterCommit, hadEffect, voidReturned };
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
      const { before, result, afterCommit, voidReturned } = await badLine("negative qty", { productId: R().productA.id, qty: -1, cost: 5 });
      test.fail(true, "suspected bug: negative Stock In qty accepted (acts as an unchecked stock out)");
      expect(result.status, `negative qty must be refused (got ${result.status})`).toBeGreaterThanOrEqual(400);
      expect(afterCommit.qty - before.qty, "on-hand unchanged").toBe(0);
      expect(voidReturned, "voiding the accepted document must return stock to the pre-commit read").not.toBe(false);
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
      const { before, result, afterCommit, voidReturned } = await badLine("negative cost", { productId: R().productA.id, qty: 2, cost: -5 });
      test.fail(true, "suspected bug: negative cost accepted");
      expect(result.status, `negative cost must be refused (got ${result.status})`).toBeGreaterThanOrEqual(400);
      expect(afterCommit.qty - before.qty, "on-hand unchanged").toBe(0);
      expect(voidReturned, "voiding the accepted document must return stock to the pre-commit read").not.toBe(false);
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
      const { before, result, afterCommit, voidReturned } = await badLine("qty zero", { productId: R().productA.id, qty: 0, cost: 5 });
      test.fail(true, "suspected bug: qty 0 line accepted on commit");
      expect(result.status, `qty 0 must be refused (got ${result.status})`).toBeGreaterThanOrEqual(400);
      expect(afterCommit.qty - before.qty, "on-hand unchanged").toBe(0);
      expect(voidReturned, "voiding the accepted document must return stock to the pre-commit read").not.toBe(false);
    },
  );

  // ---------------------------------------------------------------- 81: Stock Out stock / cost outcomes
  // Every case commits its own Stock In of E2E-IA-B first (10 @ 10.00, then 10 @ 20.00), reads the live layers and
  // takes its oracle from them (expectedIssueCost), so layers left by 731 or an earlier run never matter.
  async function seedLayers() {
    const b = R().productB;
    for (const [qty, cost] of [[10, 10], [10, 20]]) {
      const d = await draft("stock-in", "seed layer", [{ productId: b.id, qty, cost }]);
      await commitOk("stock-in", d.id);
    }
  }
  /** Create then commit a Stock Out: the backend may refuse already at the draft (it checks stock there too) or only at commit. */
  async function createAndCommitOut(what: string, lines: IaLine[]) {
    const made = await createIa("stock-out", {
      date: R().today,
      locationId: R().locationId,
      adjustmentTypeId: R().adjustmentTypeOut,
      description: `${TAG} ${what} ${uid}`,
      lines,
    });
    answered(made, `create (${what})`);
    const refused = made.status < 300 ? await commitNow("stock-out", made.body.data.id) : made;
    return { made, refused, id: made.status < 300 ? (made.body.data.id as string) : null };
  }

  const layersB = () => costLayers(R().productB.id, R().locationId, R().today);
  const issueCostOf = (body: any) => Number(body?.data?.summary?.total_cost_out);

  test(
    "TC-IADJ-810001 FC Commit Stock Out จากหน้าจอแล้ว on-hand ลดและมูลค่าลดตามต้นทุนที่วิธีคิดต้นทุนกำหนด",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Admin; BU TEST; เหตุผล E2E-IA-OUT; ลง Stock In E2E-IA-B 2 ชั้น (10 @ 10.00 แล้ว 10 @ 20.00) ทาง API; อ่านชั้นต้นทุน วิธีคิดต้นทุน และสต๊อก (on-hand, มูลค่า) สดก่อนกด Commit" },
        { type: "steps", description: "1. เปิดหน้าสร้าง Stock Out\n2. Date = วันนี้, Reason E2E IA stock out, Location ของ E2E-IA-B\n3. Add Item: E2E-IA-B จำนวน 15\n4. อ่านยอด Grand Total ของฟอร์ม (ต้นทุนประเมิน)\n5. กด Commit แล้วยืนยัน\n6. อ่านสต๊อกและ stock-movements ของใบจาก API" },
        { type: "expected", description: "ยอด Grand Total ก่อน Commit = ต้นทุนที่คำนวณจากชั้นสด (±0.01); ใบเป็น completed; on-hand ลด 15; ต้นทุนใน movement = ต้นทุนที่คำนวณ; มูลค่าลดเท่ากับต้นทุนนั้น" },
        { type: "priority", description: "Critical" },
        { type: "testType", description: "Functional" },
        { type: "note", description: "ค่าคาดหวังมาจาก expectedIssueCost(ชั้นต้นทุนสด, 15, วิธีคิดต้นทุนของ BU) ไม่ใช่ตัวเลขตายตัว · ส่วนต่างของค่าที่อ่านสดก่อน/หลัง" },
      ],
    },
    async ({ page }) => {
      const ia = new InventoryAdjustmentPage(page);
      const b = R().productB;
      await seedLayers();
      const expected = expectedIssueCost(await layersB(), 15, method);
      const before = await onHand(b.id);
      const desc = `${TAG} UI stock out ${uid}`;

      await ia.gotoNew("stock-out");
      expect(await pickDate(page, ia.dateTrigger(), R().today), `Date ${R().today}`).toBe(true);
      await pickLookup(page, ia.reason(), REASON_NAME_OUT);
      await pickLookup(page, ia.location(), R().locationName);
      const row = await addRow(page, "Select Product");
      await pickLookup(page, row.getByRole("button", { name: "Select Product" }), b.code);
      await typeInto(row.locator('input[name$=".qty"]'), 15);
      await ia.description().fill(desc);
      // The estimate arrives after the qty is typed: wait until the total is a number and has settled (two equal reads).
      let estimate = Number.NaN;
      let lastRead = Number.NaN;
      await expect(async () => {
        const read = async () => {
          const text = (await ia.grandTotal().innerText()).replace(/,/g, "");
          const m = /-?\d+\.\d{2}/.exec(text);
          expect(m, `no Grand Total amount in: ${text.slice(0, 80)}`).toBeTruthy();
          return Math.abs(Number(m![0]));
        };
        const cur = await read();
        const settled = cur === lastRead; // two successive attempts read the same total
        lastRead = cur;
        estimate = cur;
        expect(settled, "estimate settled").toBe(true);
        expect(estimate, "estimate is not 0").toBeGreaterThan(0);
      }).toPass({ timeout: 30_000 });
      console.log(`810001 live: pool before ${JSON.stringify(before)} oracle ${expected} form estimate ${estimate}`);

      const res = await expectSaved(
        page,
        /\/stock-outs\/?(\?|$)/,
        async () => {
          await ia.commitButton().click();
          await confirmDialog(page, /commit/i);
        },
        page.locator("[data-sonner-toast]"),
      );
      const id: string = (await res.json()).data.id;
      await expect.poll(() => statusOf("stock-out", id), { timeout: 60_000 }).toBe("completed");

      // The ledger is updated right after the status flips (same lag 800001 showed): poll the deltas instead of one read.
      await expect.poll(async () => (await onHand(b.id)).qty - before.qty, { message: "on-hand moved by -15", timeout: 20_000 }).toBe(-15);
      const mvBody = (await movementsOf("stock-out", id)).body;
      expect(mvBody?.data?.is_posted, "movements are posted").toBe(true);
      expect(issueCostOf(mvBody), "issue cost on the movement = oracle").toBeCloseTo(expected, 2);
      expect(Math.abs(estimate - expected), `form estimate ${estimate} vs oracle ${expected}`).toBeLessThanOrEqual(0.0100001);
      await expect.poll(async () => (await onHand(b.id)).value - before.value, { message: "value moved by -issue cost", timeout: 20_000 }).toBeCloseTo(-expected, 1);
    },
  );

  test(
    "TC-IADJ-810002 FC Commit Stock Out เกิน on-hand ถูกปฏิเสธ สต๊อกไม่เปลี่ยนและใบยังเป็น draft",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Admin; BU TEST; ลง Stock In E2E-IA-B 2 ชั้นทาง API; อ่าน on-hand สดของ E2E-IA-B" },
        { type: "steps", description: "1. API: สร้าง Stock Out E2E-IA-B จำนวน on-hand + 1 (หลังบ้านอาจปฏิเสธตั้งแต่สร้าง draft หรือตอน commit) แล้ว PATCH commit ถ้าสร้างได้\n2. อ่านสต๊อกและสถานะใบ\n3. หน้าจอ: สร้าง Stock Out จำนวน on-hand + 1 กด Commit แล้วยืนยัน" },
        { type: "expected", description: "API: 4xx STOCK_OUT_INSUFFICIENT_STOCK และข้อความระบุ E2E-IA-B; on-hand ไม่เปลี่ยน; ถ้าสร้างใบได้ ใบยัง draft. หน้าจอ: แสดง error และยังอยู่ที่หน้าฟอร์มสร้าง" },
        { type: "priority", description: "Critical" },
        { type: "testType", description: "Negative" },
        { type: "note", description: "ส่วนต่างสดก่อน/หลัง ไม่ใช้ค่าสัมบูรณ์" },
      ],
    },
    async ({ page }) => {
      const b = R().productB;
      await seedLayers();
      const live = await onHand(b.id);
      const qty = Math.floor(live.qty) + 1;
      const { refused: r, id } = await createAndCommitOut("over on-hand", [{ productId: b.id, qty }]);
      expect(r.status, `over on-hand must be refused: ${JSON.stringify(r.body).slice(0, 250)}`).toBeGreaterThanOrEqual(400);
      expect(r.status).toBeLessThan(500);
      expect(errCode(r)).toBe("STOCK_OUT_INSUFFICIENT_STOCK");
      expect(JSON.stringify(r.body), "the refusal names the product").toContain(b.code);
      if (id) expect(await statusOf("stock-out", id), "document stays draft").toBe("draft");
      expect((await onHand(b.id)).qty - live.qty, "on-hand unchanged").toBe(0);

      const ia = new InventoryAdjustmentPage(page);
      await ia.gotoNew("stock-out");
      expect(await pickDate(page, ia.dateTrigger(), R().today), `Date ${R().today}`).toBe(true);
      await pickLookup(page, ia.reason(), REASON_NAME_OUT);
      await pickLookup(page, ia.location(), R().locationName);
      const row = await addRow(page, "Select Product");
      await pickLookup(page, row.getByRole("button", { name: "Select Product" }), b.code);
      await typeInto(row.locator('input[name$=".qty"]'), qty);
      await ia.description().fill(`${TAG} UI over on-hand ${uid}`);
      await page.waitForLoadState("networkidle");
      const status4 = await expectRefused(
        page,
        /\/stock-outs\/?/,
        async () => {
          await ia.commitButton().click();
          await confirmDialog(page, /commit/i);
        },
        page.locator("[data-sonner-toast]"),
      );
      expect(status4).toBeGreaterThanOrEqual(400);
      expect(page.url(), "the page stays on the form").toContain("/new");
      expect((await onHand(b.id)).qty - live.qty, "on-hand unchanged after the UI attempt").toBe(0);
    },
  );

  test(
    "TC-IADJ-810003 FC Stock Out 2 บรรทัดสินค้าเดียวกันที่รวมกันเกิน on-hand ถูกปฏิเสธทั้งใบ",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Admin; BU TEST; ลง Stock In E2E-IA-B 2 ชั้นทาง API; อ่าน on-hand สด" },
        { type: "steps", description: "1. สร้าง Stock Out draft ทาง API 2 บรรทัดของ E2E-IA-B บรรทัดละ ceil(on-hand/2)+1 (แต่ละบรรทัดพอจ่ายได้เดี่ยว ๆ แต่รวมกันเกิน)\n2. PATCH commit\n3. อ่านสต๊อก" },
        { type: "expected", description: "ถูกปฏิเสธ 4xx STOCK_OUT_INSUFFICIENT_STOCK; ใบยัง draft; on-hand ไม่เปลี่ยน" },
        { type: "priority", description: "Critical" },
        { type: "testType", description: "Negative" },
        { type: "note", description: "Review Focus 4: ตรวจรวมทั้งใบ ไม่ใช่ทีละบรรทัด" },
      ],
    },
    async () => {
      const b = R().productB;
      await seedLayers();
      const live = await onHand(b.id);
      const each = Math.ceil(live.qty / 2) + 1;
      const { refused: r, id } = await createAndCommitOut("whole doc shortage", [{ productId: b.id, qty: each }, { productId: b.id, qty: each }]);
      expect(r.status, `whole-document shortage must be refused: ${JSON.stringify(r.body).slice(0, 250)}`).toBeGreaterThanOrEqual(400);
      expect(r.status).toBeLessThan(500);
      expect(errCode(r)).toBe("STOCK_OUT_INSUFFICIENT_STOCK");
      if (id) expect(await statusOf("stock-out", id), "document stays draft").toBe("draft");
      expect((await onHand(b.id)).qty - live.qty, "on-hand unchanged").toBe(0);
    },
  );

  test(
    "TC-IADJ-810004 FC Stock Out ลงวันที่นอกงวดปัจจุบันถูกปฏิเสธและสต๊อกไม่เปลี่ยน",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Admin; BU TEST; ลง Stock In E2E-IA-B ทาง API; อ่านงวดจาก GET /inventory-periods" },
        { type: "steps", description: "1. เลือกวันในงวดเปิดอื่นที่ไม่ใช่งวดปัจจุบัน ถ้าไม่มีใช้วันก่อนวันเริ่มของงวดเปิดแรกสุด\n2. สร้าง Stock Out E2E-IA-B × 1 ลงวันนั้นทาง API\n3. ถ้าสร้างได้ PATCH commit\n4. อ่านสต๊อก" },
        { type: "expected", description: "ขั้นสร้างหรือ commit ตอบ 4xx STOCK_OUT_DATE_NOT_CURRENT_PERIOD หรือ STOCK_OUT_NO_OPEN_PERIOD; ไม่มีใบ completed; on-hand ไม่เปลี่ยน" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
        { type: "note", description: "เส้นทาง API เท่านั้น · ไม่มีงวดเปิดเลย = ล้มพร้อมเหตุผล ไม่ข้าม · เคสนี้ไม่ปิดและไม่สร้างงวด" },
      ],
    },
    async () => {
      const b = R().productB;
      await seedLayers();
      const list = await buSend("Admin", "GET", "/inventory-periods?perpage=100");
      expect(list.status, "GET /inventory-periods").toBe(200);
      const periods = ((list.body?.data ?? []) as any[]).sort((x, y) => String(x.start_at).localeCompare(String(y.start_at)));
      const open = periods.filter((p) => p.status === "open");
      expect(open.length, "no open inventory period is known on TEST BU - cannot build a date outside the current period").toBeGreaterThan(0);
      const other = open.find((p) => !(day(p.start_at) <= R().today && R().today <= day(p.end_at)));
      const date = other ? day(other.start_at) : shiftDay(day(open[0].start_at), -1);

      const before = await onHand(b.id);
      const made = await createIa("stock-out", {
        date,
        locationId: R().locationId,
        adjustmentTypeId: R().adjustmentTypeOut,
        description: `${TAG} other period ${uid}`,
        lines: [{ productId: b.id, qty: 1 }],
      });
      let refused = made;
      if (made.status < 300) refused = await commitNow("stock-out", made.body.data.id);
      expect(refused.status, `date ${date} must be refused: ${JSON.stringify(refused.body).slice(0, 250)}`).toBeGreaterThanOrEqual(400);
      expect(refused.status).toBeLessThan(500);
      expect(["STOCK_OUT_DATE_NOT_CURRENT_PERIOD", "STOCK_OUT_NO_OPEN_PERIOD"]).toContain(errCode(refused));
      if (made.status < 300) expect(await statusOf("stock-out", made.body.data.id), "the refused document must not be completed").toBe("draft");
      expect((await onHand(b.id)).qty - before.qty, "on-hand unchanged").toBe(0);
    },
  );

  test(
    "TC-IADJ-810005 FC Commit Stock Out ซ้ำ (ต่อเนื่องและพร้อมกัน) ตัดสต๊อกครั้งเดียว",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Admin; BU TEST; ลง Stock In E2E-IA-B 2 ชั้นทาง API; Stock Out draft 3 ใบ (E2E-IA-B × 2); อ่านสต๊อกก่อนแต่ละใบ" },
        { type: "steps", description: "(ต่อเนื่อง) commit แล้ว commit ซ้ำ\n(a) ยิง commit 2 คำขอพร้อมกันด้วย doc_version เดียวกัน\n(b) ยิง commit 2 คำขอพร้อมกันโดยไม่ส่ง doc_version แล้ว commit ที่ถูกต้องอีกครั้ง" },
        { type: "expected", description: "ต่อเนื่อง: ครั้งสอง 4xx STOCK_OUT_ONLY_DRAFT_COMMITTABLE; ทุกแบบ on-hand ลด 2 ครั้งเดียว และมี movement 1 บรรทัด\n(b) คำขอที่ไม่มี doc_version ถูกปฏิเสธ 4xx และไม่มี movement" },
        { type: "priority", description: "Critical" },
        { type: "testType", description: "Concurrency" },
        { type: "note", description: "R6: DTO บังคับ doc_version เป็นจำนวนเต็ม จึงทดสอบ (b) เป็น 'ไม่มี doc_version ต้องไม่ตัดอะไร'. ถ้า (b) ตัดซ้ำ = บั๊ก (ปักหมุด เหมือน 800004)" },
      ],
    },
    async () => {
      const b = R().productB;
      await seedLayers();
      const line = [{ productId: b.id, qty: 2 }];

      // sequential
      const d1 = await draft("stock-out", "commit twice", line);
      const before1 = await onHand(b.id);
      await commitOk("stock-out", d1.id);
      const second = await commitNow("stock-out", d1.id);
      expect(second.status, `second commit: ${JSON.stringify(second.body).slice(0, 200)}`).toBeGreaterThanOrEqual(400);
      expect(second.status).toBeLessThan(500);
      expect(errCode(second)).toBe("STOCK_OUT_ONLY_DRAFT_COMMITTABLE");
      expect(await postedLines("stock-out", d1.id), "sequential: movements = lines").toBe(1);
      expect((await onHand(b.id)).qty - before1.qty, "sequential: deducted once").toBe(-2);

      // (a) parallel, same doc_version
      const da = await draft("stock-out", "parallel same version", line);
      const ver = await versionOf("stock-out", da.id);
      const beforeA = await onHand(b.id);
      const pa = await Promise.all([commitIa("stock-out", da.id, ver), commitIa("stock-out", da.id, ver)]);
      expect(pa.filter((r) => r.status < 300).length, `parallel commit (same doc_version) must succeed once: ${pa.map(status).join("/")}`).toBe(1);
      expect(await postedLines("stock-out", da.id), "(a) movements = lines").toBe(1);
      expect((await onHand(b.id)).qty - beforeA.qty, "(a) deducted once").toBe(-2);

      // (b) parallel, neither carries doc_version
      const db = await draft("stock-out", "parallel no version", line);
      const beforeB = await onHand(b.id);
      const pb = await Promise.all([commitIa("stock-out", db.id), commitIa("stock-out", db.id)]);
      for (const r of pb) answered(r, "commit without doc_version");
      const afterB = await onHand(b.id);
      const posted = await postedLines("stock-out", db.id);
      const accepted = pb.filter((r) => r.status < 300).length;
      // Policy (same as 800004 (b)): accepted AND posted exactly once = pass (no double-post, R6); accepted with a double post, or refused yet posted = bug pin.
      if (posted > 1 || accepted > 1 || afterB.qty - beforeB.qty < -2 || (accepted === 0 && (posted !== 0 || afterB.qty !== beforeB.qty))) {
        test.fail(true, "suspected bug: parallel Stock Out commit without doc_version deducts twice or posts although refused");
        expect(posted, "(b) movements = lines").toBe(1);
        expect(afterB.qty - beforeB.qty, "(b) deducted once").toBe(-2);
        return;
      }
      if (accepted === 1) {
        // accepted without a version but still exactly one deduction: no double-post, nothing more to prove
        expect(posted, "(b) exactly one posting").toBe(1);
        expect(afterB.qty - beforeB.qty, "(b) deducted once").toBe(-2);
        return;
      }
      for (const r of pb) expect(r.status, `commit without doc_version refused: ${JSON.stringify(r.body).slice(0, 150)}`).toBeGreaterThanOrEqual(400);
      expect(posted, "(b) refused commits post nothing").toBe(0);
      expect(afterB.qty - beforeB.qty, "(b) refused commits deduct nothing").toBe(0);
      await commitOk("stock-out", db.id);
      expect(await postedLines("stock-out", db.id), "(b) one posting after the proper commit").toBe(1);
      expect((await onHand(b.id)).qty - beforeB.qty, "(b) deducted once").toBe(-2);
    },
  );

  test(
    "TC-IADJ-810006 FC Void Stock Out ที่ commit แล้วคืนจำนวนและมูลค่ากลับเท่าก่อน commit",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Admin; BU TEST; ลง Stock In E2E-IA-B 2 ชั้นทาง API; อ่านสต๊อก (on-hand และมูลค่า) ก่อน commit Stock Out" },
        { type: "steps", description: "1. สร้าง Stock Out E2E-IA-B × 15 ทาง API แล้ว commit\n2. อ่านสต๊อก\n3. Void ใบ (void_reason + doc_version ปัจจุบัน)\n4. อ่านสต๊อก" },
        { type: "expected", description: "หลัง commit on-hand −15; หลัง void ส่วนต่างเทียบก่อน commit เป็น 0 ทั้งจำนวนและมูลค่า (คืนที่ต้นทุนที่ตัดไป)" },
        { type: "priority", description: "Critical" },
        { type: "testType", description: "Functional" },
        { type: "note", description: "ส่วนต่างของค่าที่อ่านสด ไม่ใช้ค่าสัมบูรณ์" },
      ],
    },
    async () => {
      const b = R().productB;
      await seedLayers();
      const before = await onHand(b.id);
      const d = await draft("stock-out", "void restores", [{ productId: b.id, qty: 15 }]);
      await commitOk("stock-out", d.id);
      await expect.poll(async () => (await onHand(b.id)).qty - before.qty, { message: "commit -qty", timeout: 20_000 }).toBe(-15);
      const v = await voidIa("stock-out", d.id, "e2e void stock out", await versionOf("stock-out", d.id));
      expect(v.status, `void: ${JSON.stringify(v.body).slice(0, 200)}`).toBeLessThan(300);
      await expect.poll(async () => (await onHand(b.id)).qty - before.qty, { message: "on-hand back to before", timeout: 20_000 }).toBe(0);
      await expect.poll(async () => (await onHand(b.id)).value - before.value, { message: "value back to before (restored at the issued cost)", timeout: 20_000 }).toBeCloseTo(0, 2);
    },
  );

  test(
    "TC-IADJ-810007 FC Stock Out ที่ completed แล้วแก้/ลบไม่ได้ และ void ซ้ำถูกปฏิเสธ",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Admin; BU TEST; ลง Stock In E2E-IA-B 2 ชั้นทาง API; Stock Out E2E-IA-B × 1 commit แล้ว" },
        { type: "steps", description: "1. PATCH save (เปลี่ยนคำอธิบาย) ใบที่ completed\n2. DELETE ใบที่ completed\n3. Void ใบ\n4. Void ซ้ำ" },
        { type: "expected", description: "save → 4xx STOCK_OUT_COMPLETED_NO_UPDATE; delete → 4xx STOCK_OUT_COMPLETED_NO_DELETE; void ครั้งแรกสำเร็จ; void ซ้ำ → 4xx" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
        { type: "note", description: "เส้นทาง API เท่านั้น (หน้าจอไม่แสดงปุ่มแก้/ลบของใบ completed)" },
      ],
    },
    async () => {
      const b = R().productB;
      await seedLayers();
      const d = await draft("stock-out", "locked", [{ productId: b.id, qty: 1 }]);
      await commitOk("stock-out", d.id);
      const upd = await updateIa("stock-out", d.id, { doc_version: await versionOf("stock-out", d.id), description: `${TAG} locked edited ${uid}` });
      expect(upd.status, `save of a completed document: ${JSON.stringify(upd.body).slice(0, 200)}`).toBeGreaterThanOrEqual(400);
      expect(upd.status).toBeLessThan(500);
      expect(errCode(upd)).toBe("STOCK_OUT_COMPLETED_NO_UPDATE");
      const del = await deleteIa("stock-out", d.id);
      expect(del.status, `delete of a completed document: ${JSON.stringify(del.body).slice(0, 200)}`).toBeGreaterThanOrEqual(400);
      expect(del.status).toBeLessThan(500);
      expect(errCode(del)).toBe("STOCK_OUT_COMPLETED_NO_DELETE");
      expect(await statusOf("stock-out", d.id), "still completed").toBe("completed");
      const v = await voidIa("stock-out", d.id, "e2e void locked", await versionOf("stock-out", d.id));
      expect(v.status, `first void: ${JSON.stringify(v.body).slice(0, 200)}`).toBeLessThan(300);
      const again = await voidIa("stock-out", d.id, "e2e void twice");
      expect(again.status, `second void: ${JSON.stringify(again.body).slice(0, 200)}`).toBeGreaterThanOrEqual(400);
      expect(again.status).toBeLessThan(500);
    },
  );

  // ---------------------------------------------------------------- 82: a voided document stays visible
  // User ruling 2026-11-23: a voided document disappearing is a suspected bug. The void itself must succeed first.
  const NO_KEY: Record<IaType, string> = { "stock-in": "si_no", "stock-out": "so_no" };
  const LIST_URL = "/inventory-management/inventory-adjustment";
  const listUrl = (docStatus: string, no: string) => `${LIST_URL}?filter=${encodeURIComponent(`doc_status|string:${docStatus}`)}&search=${encodeURIComponent(no)}`;

  async function voidedStaysVisible(page: Page, type: IaType) {
    const b = R().productB;
    if (type === "stock-out") await seedLayers();
    const made = await draft(type, "voided visible", [type === "stock-in" ? { productId: b.id, qty: 5, cost: 9 } : { productId: b.id, qty: 3 }]);
    await commitOk(type, made.id);
    const no = String((await getIa(type, made.id)).body.data[NO_KEY[type]]);
    expect(no, "document number").toBeTruthy();
    // control: the list URL (status filter + search) does find a completed document, so a miss below is the document, not the URL
    await page.goto(listUrl("completed", no));
    await expect(page.getByText(no).first(), "control: the completed filter lists the document").toBeVisible({ timeout: 20_000 });

    const v = await voidIa(type, made.id, "e2e void visible", await versionOf(type, made.id));
    expect(v.status, `void: ${JSON.stringify(v.body).slice(0, 200)}`).toBeLessThan(300);
    const got = await getIa(type, made.id);
    answered(got, "read after void");
    const inVoided = (await listIa(type, { status: "voided" })).some((d) => d.id === made.id);
    // Pinned only now: the void succeeded and the backend answered the reads.
    test.fail(true, "suspected bug: void soft-deletes the document (stock-in.service.ts:1889-1900) — user ruled 2026-11-23 that a voided document must stay visible");
    expect.soft(got.status, `GET after void answered ${got.status}`).toBe(200);
    expect.soft(got.body?.data?.doc_status, "doc_status after void").toBe("voided");
    expect.soft(inVoided, "listIa(status: voided) contains the document").toBe(true);
    await page.goto(listUrl("voided", no));
    await expect.soft(page.getByText(no).first(), "the Voided filter of the list shows the number").toBeVisible({ timeout: 10_000 });
    return { voidStatus: v.status, afterVoidStatus: got.status };
  }

  test(
    "TC-IADJ-820001 FC Stock In ที่ void แล้วยังต้องเห็นได้ในระบบ (อ่านได้ สถานะ voided อยู่ในตัวกรอง Voided)",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Admin; BU TEST; Stock In E2E-IA-B × 5 ต้นทุน 9 ทาง API commit แล้ว และหน้ารายการเห็นใบในตัวกรอง Completed" },
        { type: "steps", description: "1. Void ใบ\n2. GET /stock-ins/:id\n3. ดึงรายการ doc_status=voided ทาง API\n4. เปิดหน้ารายการด้วยตัวกรอง Voided ค้นด้วยเลขที่ใบ" },
        { type: "expected", description: "GET ตอบ 200 และ doc_status = voided; รายการ voided ทาง API มีใบนี้; หน้ารายการตัวกรอง Voided แสดงเลขที่ใบ" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
        { type: "note", description: "ผู้ใช้ตัดสิน 23 พ.ย.: ใบที่ void แล้วหายไป = บั๊ก (void ทำ soft-delete, stock-in.service.ts:1889-1900) — ปักหมุด test.fail หลัง void สำเร็จ" },
      ],
    },
    async ({ page }) => {
      const seen = await voidedStaysVisible(page, "stock-in");
      expect(seen.voidStatus, "the void itself succeeded").toBeLessThan(300);
    },
  );

  test(
    "TC-IADJ-820002 FC Stock Out ที่ void แล้วยังต้องเห็นได้ในระบบ (อ่านได้ สถานะ voided อยู่ในตัวกรอง Voided)",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Admin; BU TEST; ลง Stock In E2E-IA-B 2 ชั้นทาง API; Stock Out E2E-IA-B × 3 commit แล้ว และหน้ารายการเห็นใบในตัวกรอง Completed" },
        { type: "steps", description: "1. Void ใบ\n2. GET /stock-outs/:id\n3. ดึงรายการ doc_status=voided ทาง API\n4. เปิดหน้ารายการด้วยตัวกรอง Voided ค้นด้วยเลขที่ใบ" },
        { type: "expected", description: "GET ตอบ 200 และ doc_status = voided; รายการ voided ทาง API มีใบนี้; หน้ารายการตัวกรอง Voided แสดงเลขที่ใบ" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
        { type: "note", description: "ผู้ใช้ตัดสิน 23 พ.ย.: ใบที่ void แล้วหายไป = บั๊ก — ปักหมุด test.fail หลัง void สำเร็จ" },
      ],
    },
    async ({ page }) => {
      const seen = await voidedStaysVisible(page, "stock-out");
      expect(seen.voidStatus, "the void itself succeeded").toBeLessThan(300);
    },
  );

  // Last on purpose: it fails loudly while TEST BU has one inventory period, and a failure stops the serial group.
  test(
    "TC-IADJ-800010 FC Stock In ลงวันแรกของงวดถัดไปที่สร้างล่วงหน้า (AVG: completed แต่ยังไม่ลงสต๊อก)",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Admin; BU TEST; อ่านวิธีคิดต้นทุนของ BU จาก calculation-method; มีงวด open ที่เริ่มหลังงวดปัจจุบัน (สร้างล่วงหน้า) ใน GET /inventory-periods" },
        { type: "steps", description: "1. หางวดที่เริ่มหลังงวดปัจจุบัน; ไม่พบ = ล้มพร้อมเหตุผล\n2. อ่านสต๊อก E2E-IA-A ที่วันแรกของงวดนั้นและวันนี้\n3. สร้าง Stock In E2E-IA-A × 2 ต้นทุน 11 ลงวันแรกของงวดนั้น แล้ว commit\n4. อ่านสต๊อกอีกครั้ง" },
        { type: "expected", description: "AVG: ใบ completed และ on-hand ที่วันนั้นและวันนี้ไม่เปลี่ยน (รอ bring-forward); FIFO: commit ลง movement จริง" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
        { type: "note", description: "TEST BU ใช้วิธี average (อ่านสด) · เส้นทาง API เท่านั้น (ฟอร์มไม่ให้ลงวันอนาคต) · งวดถัดไปถูกสร้างโดย data:reset ขั้น period — เคสนี้ไม่ปิดงวดและไม่สร้างงวด" },
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
