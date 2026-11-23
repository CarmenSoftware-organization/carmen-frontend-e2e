import { expect } from "@playwright/test";
import { createAuthTest } from "./fixtures/auth.fixture";
import { SalesConsumptionPage } from "./pages/sales-consumption.page";
import { buConfigSend, buSend, type ApiResult } from "./helpers/bu-api";
import {
  assertPosReady,
  cleanupPosRun,
  importSimphony,
  listItems,
  listOutlets,
  onHand,
  rowsOf,
  scCalendar,
  scDetail,
  scForDay,
  scPost,
  scUpdateLines,
  scVerify,
  scVoid,
  voidStockOut,
  mapItem,
  mapOutlet,
} from "./helpers/pos-api";
import { pastDays, saleDay, type Period } from "./helpers/pos-days";
import { buildSimphonyFile, type SimphonyLine } from "./helpers/simphony-fixture";
import { expectSaved } from "./helpers/settle";
import { uid } from "./helpers/test-data";

// ─────────────────────────────────────────────────────────────────────────
// Sales Consumption on the TEST BU (GR2VYNKQ): mapping blocks Post, line overrides, verify on-hand, post (Stock Outs
// per location + on-hand deltas), double post, void + late lines and the calendar. Groups 01-07 (06: 5 cases, one skipped by ruling, one pinned).
//
// Store key E2E-141; sale days saleDay(141, n) count backward from the end of the open inventory period (spec 140
// counts forward): groups 01-05 use n = 1..7, group 06 uses n = 11..13 (two stores). The calendar case (07) uses five
// pastDays (strictly before yesterday, outside both day ranges) so it never depends on how far into the month today is. Every case starts from a clean store (beforeEach cleanupPosRun: voids posted
// SCs, cancels imports) so a day can be reused and a failed case never leaves a posted SC behind. Case -> day:
// 01 -> 1 (010004 also 2), 02 -> 3, 03 -> 4, 04 -> 5, 05 -> 6, 06 -> 11 / 12 / 13 (060001 / 060002 / 060004),
// 07 -> five pastDays: net-0 (No sales), two without a file, posted, pending.
//
// Oracle: ../carmen-frontend/docs/superpowers/specs/2026-10-26-sales-consumption-design.md §4.2 (blocked lines, location
// / recipe override, verify, post = one Stock Out per location) and §6. Expected ingredient qty = recipe qty x net sale
// qty, grouped by the line's location. Stock assertions are deltas of live on-hand (inventory-info as of the sale day).
//
// Fixture: outlets O1 (master -> first location), O2 (-> second), O9 (no location where a case needs it); items I1 ->
// E2E-POS-A (P1 x2, P2 x1), I2 -> E2E-POS-B (P3 x1, P4 x3), I8 (unmapped), I9 (ignored). The master mapping persists per
// store across runs, so every case sets the state it needs (setMasters) before acting. Writes go through pos-api (Admin).
// ─────────────────────────────────────────────────────────────────────────
const test = createAuthTest("carmensoftware.dev+admin@gmail.com");
test.describe.configure({ timeout: 120_000 });

const STORE_KEY = "E2E-141";
const STORE_NAME = "E2E 141";
// second store: the file that arrives after a day was posted (TC-SC-060004)
const STORE_KEY_B = "E2E-141B";
const STORE_NAME_B = "E2E 141B";
const ALL_STORE_KEYS = [STORE_KEY, STORE_KEY_B];
const fileName = (key: string) => `e2e-141-${key}-${uid}.txt`;

const OUTLET = { O1: "Outlet One", O2: "Outlet Two", O9: "Outlet Nine" } as const;
const ITEM = { I1: "Item One", I2: "Item Two", I8: "Item Eight", I9: "Item Nine" } as const;
type OutletCode = keyof typeof OUTLET;
type ItemCode = keyof typeof ITEM;

function line(outlet: OutletCode, item: ItemCode, qty: number): SimphonyLine {
  return { outletCode: outlet, outletName: OUTLET[outlet], itemCode: item, itemName: ITEM[item], deptCode: "D1", deptName: "Dept One", qty, total: qty * 10 };
}

interface Loc {
  id: string;
  code: string;
  name: string;
}
interface Recipe {
  id: string;
  /** ingredients in sequence order: product id, name and qty per portion */
  ingredients: Array<{ productId: string; name: string; qty: number }>;
}

let period: Period;
let locs: { first: Loc; second: Loc; third: Loc };
let recipes: { A: Recipe; B: Recipe };
/** P1..P4: recipe A's two products then recipe B's two. */
let products: Array<{ id: string; name: string }>;
const day = (n: number) => saleDay(141, n, period);

async function currentPeriod(): Promise<Period> {
  const r = await buSend("Admin", "GET", "/inventory-periods/current");
  const p = r.body?.data;
  if (r.status !== 200 || p?.status !== "open") throw new Error(`no open inventory period (GET -> ${r.status}) - run data:reset`);
  return { start: String(p.start_at).slice(0, 10), end: String(p.end_at).slice(0, 10) };
}

async function loadFixture(): Promise<void> {
  const l = await buConfigSend("Admin", "GET", "/locations?perpage=100");
  const inv = rowsOf<any>(l.body)
    .filter((x) => (x.location_type ?? "inventory") === "inventory")
    .sort((a, b) => String(a.code).localeCompare(String(b.code)));
  if (l.status !== 200 || inv.length < 3) throw new Error(`need 3 inventory locations (GET locations -> ${l.status})`);
  const loc = (x: any): Loc => ({ id: String(x.id), code: String(x.code), name: String(x.name) });
  locs = { first: loc(inv[0]), second: loc(inv[1]), third: loc(inv[2]) };

  const readRecipe = async (code: string): Promise<Recipe> => {
    const list = await buConfigSend("Admin", "GET", `/recipes?search=${code}&perpage=50`);
    const hit = rowsOf<any>(list.body).find((x) => x.code === code);
    if (!hit) throw new Error(`recipe ${code} is missing - run data:reset`);
    const d = (await buConfigSend("Admin", "GET", `/recipes/${hit.id}`)).body?.data;
    const ingredients = [...(d?.ingredients ?? [])]
      .sort((a: any, b: any) => a.sequence_no - b.sequence_no)
      .map((i: any) => ({ productId: String(i.product_id), name: String(i.product?.name ?? i.name), qty: Number(i.qty) }));
    return { id: String(hit.id), ingredients };
  };
  recipes = { A: await readRecipe("E2E-POS-A"), B: await readRecipe("E2E-POS-B") };
  // the oracle values: A = P1 x2 + P2 x1, B = P3 x1 + P4 x3
  expect(recipes.A.ingredients.map((i) => i.qty)).toEqual([2, 1]);
  expect(recipes.B.ingredients.map((i) => i.qty)).toEqual([1, 3]);
  products = [...recipes.A.ingredients, ...recipes.B.ingredients].map((i) => ({ id: i.productId, name: i.name }));
}

/** Import through the API and demand a live import (status success). */
async function importLive(key: string, businessDate: string, lines: SimphonyLine[], store = { key: STORE_KEY, name: STORE_NAME }): Promise<void> {
  const name = fileName(key);
  const text = buildSimphonyFile({ storeKey: store.key, storeName: store.name, businessDate, lines });
  const r = await importSimphony(text, name);
  expect(r.status, `import ${name}: ${JSON.stringify(r.body).slice(0, 200)}`).toBe(201);
  expect(r.body?.data?.status).toBe("success");
}

type ItemMaster = string | null | "ignore";
interface Masters {
  O1: string | null;
  O2: string | null;
  O9: string | null;
  I1: ItemMaster;
  I2: ItemMaster;
  I8: ItemMaster;
  I9: ItemMaster;
}
const defaultMasters = (): Masters => ({ O1: locs.first.id, O2: locs.second.id, O9: null, I1: recipes.A.id, I2: recipes.B.id, I8: null, I9: null });

/** Set the master mapping of every outlet / item the store already knows (the store exists once a file was imported). */
async function setMasters(over: Partial<Masters> = {}): Promise<void> {
  const want = { ...defaultMasters(), ...over };
  const stores = rowsOf<any>((await buSend("Admin", "GET", "/pos-sales/stores")).body);
  const store = stores.find((s) => s.store_key === STORE_KEY);
  if (!store) throw new Error(`POS store ${STORE_KEY} not found after import`);
  for (const o of rowsOf<any>((await listOutlets(store.id)).body)) {
    if (!(o.code in want)) continue;
    const r = await mapOutlet(o.id, want[o.code as OutletCode]);
    expect(r.status, `map outlet ${o.code}: ${JSON.stringify(r.body).slice(0, 200)}`).toBe(200);
  }
  for (const i of rowsOf<any>((await listItems(store.id)).body)) {
    if (!(i.code in want)) continue;
    const m = want[i.code as ItemCode];
    const body = m === "ignore" ? { is_ignored: true } : { recipe_id: m, is_ignored: false };
    const r = await mapItem(i.id, body);
    expect(r.status, `map item ${i.code}: ${JSON.stringify(r.body).slice(0, 200)}`).toBe(200);
  }
}

async function itemMaster(code: ItemCode): Promise<any> {
  const stores = rowsOf<any>((await buSend("Admin", "GET", "/pos-sales/stores")).body);
  const store = stores.find((s) => s.store_key === STORE_KEY);
  return rowsOf<any>((await listItems(store.id)).body).find((i) => i.code === code);
}

/** Import `lines` on day n, set the masters and return the day's SC. */
async function prepare(key: string, n: number | string, lines: SimphonyLine[], masters: Partial<Masters> = {}) {
  // n = a saleDay index, or an explicit YYYY-MM-DD (the calendar case uses past days outside both day ranges)
  const d = typeof n === "string" ? n : day(n);
  await importLive(key, d, lines);
  await setMasters(masters);
  const sc = await scForDay(d);
  expect(sc, `the import should have created the SC of ${d}`).toBeTruthy();
  return { d, id: sc!.id };
}

async function detail(id: string): Promise<any> {
  const r = await scDetail(id);
  expect(r.status, `sc detail -> ${r.status}`).toBe(200);
  return r.body.data;
}

async function lineOf(id: string, outlet: OutletCode, item: ItemCode): Promise<any> {
  const l = (await detail(id)).lines.find((x: any) => x.outlet.code === outlet && x.item.code === item);
  if (!l) throw new Error(`no ${outlet}/${item} line in the SC`);
  return l;
}

/** A refusal the real backend gave: not 401, not 5xx, the status and the catalog code. */
function expectRefusal(r: ApiResult, status: number, code: string | string[]): void {
  expect(r.status, "answered by the real backend").not.toBe(401);
  expect(r.status, `refusal body ${JSON.stringify(r.body).slice(0, 300)}`).toBeLessThan(500);
  expect(r.status).toBe(status);
  expect(Array.isArray(code) ? code : [code]).toContain(r.body?.error?.code);
}

type Snap = Map<string, number>;
const keyOf = (loc: Loc, productId: string) => `${loc.code}:${productId}`;
/** Live on-hand of P1..P4 at both locations as of the sale day. */
async function snapshot(d: string): Promise<Snap> {
  const s: Snap = new Map();
  for (const loc of [locs.first, locs.second]) for (const p of products) s.set(keyOf(loc, p.id), await onHand(p.id, loc.id, d));
  return s;
}

type Use = Map<string, Map<string, number>>;
/** Expected ingredient qty per location code and product: recipe qty x net sale qty. */
function expectedUse(rows: Array<{ loc: Loc; recipe: "A" | "B"; qty: number }>): Use {
  const out: Use = new Map();
  for (const r of rows) {
    const perLoc = out.get(r.loc.code) ?? new Map<string, number>();
    for (const i of recipes[r.recipe].ingredients) perLoc.set(i.productId, (perLoc.get(i.productId) ?? 0) + i.qty * r.qty);
    out.set(r.loc.code, perLoc);
  }
  return out;
}

async function stockOutOf(id: string) {
  const r = await buSend("Admin", "GET", `/stock-outs/${id}`);
  expect(r.status, `stock-out ${id} -> ${r.status}`).toBe(200);
  const d = r.body.data;
  const qty = new Map<string, number>();
  for (const l of d.stock_out_detail ?? []) qty.set(String(l.product.id), (qty.get(String(l.product.id)) ?? 0) + Number(l.qty));
  return { id: String(d.id), date: String(d.so_date).slice(0, 10), type: String(d.adjustment_type?.code), loc: String(d.location?.code), qty, scId: d.info?.sales_consumption_id };
}

/** The live (not voided) Stock Outs of an SC, read from the SC detail. */
async function liveStockOuts(scId: string) {
  const d = await detail(scId);
  return (d.stock_outs as Array<{ id: string; voided: boolean }>).filter((s) => !s.voided);
}

/** Assert the SC's Stock Outs: one per expected location, type SALE, dated the sale day, product qty = formula. */
async function expectStockOuts(scId: string, d: string, expected: Use): Promise<void> {
  const live = await liveStockOuts(scId);
  expect(live.length, "one Stock Out per location").toBe(expected.size);
  const outs = await Promise.all(live.map((s) => stockOutOf(s.id)));
  expect(outs.map((o) => o.loc).sort()).toEqual([...expected.keys()].sort());
  for (const o of outs) {
    expect(o.type, `${o.loc} adjustment type`).toBe("SALE");
    expect(o.date, `${o.loc} date`).toBe(d);
    expect(o.scId).toBe(scId);
    const want = expected.get(o.loc)!;
    expect([...o.qty.entries()].sort(), `${o.loc} products`).toEqual([...want.entries()].sort());
  }
}

/** On-hand now vs before: only the expected products moved, each by exactly the expected qty (negative). */
async function expectDeltas(d: string, before: Snap, expected: Use): Promise<void> {
  const after = await snapshot(d);
  for (const loc of [locs.first, locs.second]) {
    for (const p of products) {
      const k = keyOf(loc, p.id);
      const used = expected.get(loc.code)?.get(p.id) ?? 0;
      // delta + used = 0 (a plain toBe(-0) would fail on 0 - 0)
      expect(after.get(k)! - before.get(k)! + used, `on-hand delta of ${p.name} at ${loc.code} should be -${used}`).toBe(0);
    }
  }
}

async function postedFresh(key: string, n: number | string, lines: SimphonyLine[]) {
  const s = await prepare(key, n, lines);
  const v = await scVerify(s.id);
  expect(v.status, `verify: ${JSON.stringify(v.body).slice(0, 300)}`).toBe(200);
  const p = await scPost(s.id, Number((await detail(s.id)).doc_version));
  expect(p.status, `post: ${JSON.stringify(p.body).slice(0, 300)}`).toBeLessThan(300);
  return s;
}

test.describe("Sales Consumption (141)", () => {
  test.beforeAll(async () => {
    await assertPosReady();
    period = await currentPeriod();
    await loadFixture();
  });

  // a failed case must never leave a posted SC (or a live import) behind
  test.beforeEach(async () => {
    for (const key of ALL_STORE_KEYS) await cleanupPosRun(key);
  });
  test.afterAll(async () => {
    for (const key of ALL_STORE_KEYS) await cleanupPosRun(key);
  });

  // ── 01 blocking ───────────────────────────────────────────────────────
  test(
    "TC-SC-010001 บรรทัดของ item ที่ยังไม่ผูก recipe: ปุ่ม Post ปิด และ API post ถูกปฏิเสธ SALES_CONSUMPTION_HAS_UNRESOLVED_LINES",
    {
      annotation: [
        { type: "preconditions", description: "Admin login บน TEST BU; ร้าน E2E-141 วันขายที่ 1 import 2 บรรทัด O1/I1 (ผูก recipe A) และ O1/I8; master: O1 -> location แรก, I1 -> E2E-POS-A, I8 ไม่ผูก" },
        { type: "steps", description: "1. เปิดหน้ารายละเอียด SC ของวันนั้น\n2. ดูสถานะบรรทัด O1/I8 และปุ่ม Post & deduct stock\n3. ยิง POST verify-onhand และ POST post ทาง API" },
        {
          type: "expected",
          description: "บรรทัด O1/I8 state needs_recipe, ปุ่ม Post ปิด (disabled); verify และ post ถูกปฏิเสธ 422 SALES_CONSUMPTION_HAS_UNRESOLVED_LINES; ไม่มี Stock Out ถูกสร้าง SC ยัง pending",
        },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const s = await prepare("unmapped-item", 1, [line("O1", "I1", 2), line("O1", "I8", 1)]);
      expect((await lineOf(s.id, "O1", "I8")).state).toBe("needs_recipe");

      const sc = new SalesConsumptionPage(page);
      await sc.gotoDetail(s.id);
      await expect(sc.postButton()).toBeDisabled();

      const v = await scVerify(s.id);
      expectRefusal(v, 422, "SALES_CONSUMPTION_HAS_UNRESOLVED_LINES");
      const p = await scPost(s.id, Number((await detail(s.id)).doc_version));
      expectRefusal(p, 422, "SALES_CONSUMPTION_HAS_UNRESOLVED_LINES");
      expect(await liveStockOuts(s.id)).toEqual([]);
      expect((await detail(s.id)).status).toBe("pending");
    },
  );

  test(
    "TC-SC-010002 บรรทัดของ outlet ที่ยังไม่มี location: ปุ่ม Post ปิด และ API post ถูกปฏิเสธ",
    {
      annotation: [
        { type: "preconditions", description: "Admin login บน TEST BU; ร้าน E2E-141 วันขายที่ 1 import 2 บรรทัด O1/I1 และ O9/I1; master: O1 -> location แรก, O9 ไม่มี location, I1 -> E2E-POS-A" },
        { type: "steps", description: "1. เปิดหน้ารายละเอียด SC ของวันนั้น\n2. ดูสถานะบรรทัด O9/I1 และปุ่ม Post\n3. ยิง POST post ทาง API" },
        {
          type: "expected",
          description: "บรรทัด O9/I1 state needs_location, ปุ่ม Post ปิด; post ถูกปฏิเสธ 422 SALES_CONSUMPTION_HAS_UNRESOLVED_LINES; ไม่มี Stock Out ถูกสร้าง",
        },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const s = await prepare("no-location", 1, [line("O1", "I1", 2), line("O9", "I1", 1)]);
      expect((await lineOf(s.id, "O9", "I1")).state).toBe("needs_location");

      const sc = new SalesConsumptionPage(page);
      await sc.gotoDetail(s.id);
      await expect(sc.postButton()).toBeDisabled();

      const p = await scPost(s.id, Number((await detail(s.id)).doc_version));
      expectRefusal(p, 422, "SALES_CONSUMPTION_HAS_UNRESOLVED_LINES");
      expect(await liveStockOuts(s.id)).toEqual([]);
    },
  );

  test(
    "TC-SC-010003 ผูก I8 -> recipe และ O9 -> location ในแท็บ Mapping: Verify เปิดใช้ได้ แล้ว Post เปิดหลัง verify",
    {
      annotation: [
        { type: "preconditions", description: "Admin login บน TEST BU; ร้าน E2E-141 วันขายที่ 1 import 3 บรรทัด O1/I1, O1/I8, O9/I1; master: I8 ไม่ผูก, O9 ไม่มี location (บล็อก post ทั้งสองจุด)" },
        {
          type: "steps",
          description:
            "1. เปิดหน้า SC ของวันนั้น ตรวจว่า Verify และ Post ปิด\n2. เปิด Sales Consumption > Mapping > POS items เลือกร้าน E2E 141 ผูก I8 -> E2E-POS-A\n3. แท็บ Outlets ผูก O9 -> location แรก\n4. กลับหน้า SC: ดู Verify แล้วกด Verify on-hand\n5. ดูปุ่ม Post",
        },
        {
          type: "expected",
          description: "ก่อนผูก Verify และ Post ปิด; หลังผูกครบทั้งสองจุดบรรทัดทุกบรรทัดเป็น ok, Verify เปิดใช้ได้ (Post ยังปิดจนกว่าจะ verify), หลังกด Verify แล้ว Post เปิดใช้ได้; ยังไม่ได้ post (ไม่มี Stock Out)",
        },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const s = await prepare("map-in-ui", 1, [line("O1", "I1", 2), line("O1", "I8", 1), line("O9", "I1", 1)]);
      const sc = new SalesConsumptionPage(page);
      await sc.gotoDetail(s.id);
      await expect(sc.verifyButton()).toBeDisabled();
      await expect(sc.postButton()).toBeDisabled();

      await sc.openMapping("items", STORE_NAME);
      await expectSaved(page, /\/pos-sales\/items\//, () => sc.setItemRecipe("I8", "E2E-POS-A"), page.getByText("Recipe saved"));
      await sc.openMapping("outlets", STORE_NAME);
      await expectSaved(page, /\/pos-sales\/outlets\//, () => sc.setOutletLocation("O9", locs.first.name), page.getByText("Location saved"));

      expect((await detail(s.id)).lines.map((l: any) => l.state)).toEqual(["ok", "ok", "ok"]);
      await sc.gotoDetail(s.id);
      await expect(sc.verifyButton()).toBeEnabled();
      await expect(sc.postButton()).toBeDisabled();
      await expectSaved(page, /\/verify-onhand/, () => sc.verifyButton().click(), sc.ingredientRowState(locs.first.code, products[0].name));
      await expect(sc.postButton()).toBeEnabled();
      expect(await liveStockOuts(s.id)).toEqual([]);
    },
  );

  test(
    "TC-SC-010004 ignore I9 ในแท็บ Mapping: วันถัดไปที่มี I9 ถูกข้ามเอง; บรรทัด ignored และ net qty 0 ไม่มีวัตถุดิบ",
    {
      annotation: [
        { type: "preconditions", description: "Admin login บน TEST BU; ร้าน E2E-141 วัน 1 import O1/I1 และ O1/I9 (I9 ไม่ผูก); วัน 2 import O1/I1 qty 2, O1/I9, O1/I2 qty 3 และ O1/I2 qty -3 (คืนของ net 0)" },
        {
          type: "steps",
          description:
            "1. วัน 1: ตรวจว่า O1/I9 บล็อก post\n2. Mapping > POS items ร้าน E2E 141 กด Ignore ที่ I9\n3. import วัน 2 แล้วเปิด SC ของวันนั้นโดยไม่ทำอะไรกับ I9\n4. ดูสถานะบรรทัดและวัตถุดิบที่จะตัด; verify ผ่าน API",
        },
        {
          type: "expected",
          description:
            "วัน 1 บรรทัด I9 บล็อก (needs_recipe); หลัง ignore บรรทัด I9 วัน 1 is_ignored และ state not_counted; วัน 2 บรรทัด I9 เป็น ignored/not_counted เอง ไม่ต้องทำอะไร, บรรทัด I2 สุทธิ <= 0 state not_counted ไม่บล็อก; วัตถุดิบมีเฉพาะ location แรก P1 = 4, P2 = 2 (จาก O1/I1 qty 2 ตาม recipe A) ไม่มี P3/P4 และไม่มีวัตถุดิบของ I9; verify ผ่าน",
        },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const d1 = await prepare("ign-d1", 1, [line("O1", "I1", 2), line("O1", "I9", 1)]);
      expect((await lineOf(d1.id, "O1", "I9")).state).toBe("needs_recipe");

      const sc = new SalesConsumptionPage(page);
      await sc.openMapping("items", STORE_NAME);
      await expectSaved(page, /\/pos-sales\/items\//, () => sc.ignoreItem("I9"), page.getByText(/ignored/i));
      const l1 = await lineOf(d1.id, "O1", "I9");
      expect(l1.is_ignored).toBe(true);
      expect(l1.state, "an ignored line is shown as not counted").toBe("not_counted");

      // day 2: nothing is done to I9 - the master remembers it
      const d2 = day(2);
      await importLive("ign-d2", d2, [line("O1", "I1", 2), line("O1", "I9", 1), line("O1", "I2", 3), line("O1", "I2", -3)]);
      const s2 = (await scForDay(d2))!;
      expect(s2).toBeTruthy();
      const det = await detail(s2.id);
      const i9 = det.lines.filter((l: any) => l.item.code === "I9");
      expect(i9.length).toBe(1);
      expect(i9[0].state).toBe("not_counted");
      const i2 = det.lines.filter((l: any) => l.item.code === "I2");
      expect(i2.length, "the net-0 I2 line is still listed").toBeGreaterThan(0);
      for (const l of i2) {
        expect(Number(l.qty), "refund line nets out").toBeLessThanOrEqual(0);
        expect(l.state, "a net <= 0 line is not counted").toBe("not_counted");
      }
      expect(det.lines.filter((l: any) => l.state === "needs_recipe" || l.state === "needs_location")).toEqual([]);

      const v = await scVerify(s2.id);
      expect(v.status, `verify: ${JSON.stringify(v.body).slice(0, 300)}`).toBe(200);
      const groups = (await detail(s2.id)).ingredients;
      expect(groups.length).toBe(1);
      expect(groups[0].location.code).toBe(locs.first.code);
      expect(groups[0].products.map((p: any) => [p.product_id, p.qty])).toEqual([
        [products[0].id, 4],
        [products[1].id, 2],
      ]);
    },
  );

  // ── 02 overrides ──────────────────────────────────────────────────────
  test(
    "TC-SC-020001 เปลี่ยน location ของบรรทัด O1/I1 เป็น location ที่สองบนหน้า SC: ตอน post วัตถุดิบของบรรทัดไปอยู่ Stock Out ของ location ที่สอง",
    {
      annotation: [
        { type: "preconditions", description: "Admin login บน TEST BU; ร้าน E2E-141 วัน 3 import O1/I1 qty 2 และ O1/I2 qty 1; master: O1 -> location แรก, I1 -> A, I2 -> B" },
        {
          type: "steps",
          description: "1. เปิดหน้า SC แท็บ Sales lines\n2. เปลี่ยน location ของบรรทัด O1/I1 เป็น location ที่สอง\n3. verify แล้ว post (API)\n4. อ่าน Stock Out ทั้งสองใบ",
        },
        {
          type: "expected",
          description:
            "บรรทัด O1/I1 มี location = location ที่สอง (location_source line), O1/I2 ยังอยู่ location แรก; Stock Out 2 ใบ ชนิด SALE วันที่ = วันขาย: location ที่สองมี P1 = 4, P2 = 2 (I1 x2), location แรกมี P3 = 1, P4 = 3 (I2 x1); on-hand ลดตามยอดนี้เท่านั้น",
        },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const s = await prepare("ovr-loc", 3, [line("O1", "I1", 2), line("O1", "I2", 1)]);
      const before = await snapshot(s.d);
      const sc = new SalesConsumptionPage(page);
      await sc.gotoDetail(s.id);
      await sc.showSalesLines();
      await expectSaved(page, /\/sales-consumptions\/[^/]+\/lines/, () => sc.setLineLocation("O1", "I1", locs.second.code), page.getByText(locs.second.code).first());

      const l = await lineOf(s.id, "O1", "I1");
      expect(l.location.code).toBe(locs.second.code);
      expect(l.location_source).not.toBe("master");
      expect((await lineOf(s.id, "O1", "I2")).location.code).toBe(locs.first.code);

      const v = await scVerify(s.id);
      expect(v.status, `verify: ${JSON.stringify(v.body).slice(0, 300)}`).toBe(200);
      const p = await scPost(s.id, Number((await detail(s.id)).doc_version));
      expect(p.status, `post: ${JSON.stringify(p.body).slice(0, 300)}`).toBeLessThan(300);

      const want = expectedUse([
        { loc: locs.second, recipe: "A", qty: 2 },
        { loc: locs.first, recipe: "B", qty: 1 },
      ]);
      await expectStockOuts(s.id, s.d, want);
      await expectDeltas(s.d, before, want);
    },
  );

  test(
    "TC-SC-020002 เปลี่ยน master location ของ O1 ภายหลัง: บรรทัดที่ override คงที่ ส่วนบรรทัดที่ไม่ override เปลี่ยนตาม",
    {
      annotation: [
        { type: "preconditions", description: "Admin login บน TEST BU; ร้าน E2E-141 วัน 3 import O1/I1 และ O1/I2; บรรทัด O1/I1 ถูก override เป็น location ที่สอง (API) ส่วน O1/I2 ตาม master" },
        { type: "steps", description: "1. เปลี่ยน master ของ outlet O1 เป็น location ที่สามของ BU (API)\n2. อ่านรายละเอียด SC" },
        {
          type: "expected",
          description: "บรรทัด O1/I1 ยัง location ที่สอง (override ไม่ถูกทับ); บรรทัด O1/I2 (ไม่ override) เปลี่ยนไปที่ location ที่สาม location_source master; master ของ O1 เป็นของใหม่",
        },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async () => {
      const s = await prepare("ovr-master", 3, [line("O1", "I1", 2), line("O1", "I2", 1)]);
      const i1 = await lineOf(s.id, "O1", "I1");
      const u = await scUpdateLines(s.id, { line_ids: [i1.id], location_id: locs.second.id });
      expect(u.status, `override: ${JSON.stringify(u.body).slice(0, 300)}`).toBe(200);
      expect((await lineOf(s.id, "O1", "I1")).location.code).toBe(locs.second.code);

      await setMasters({ O1: locs.third.id });
      const after = await lineOf(s.id, "O1", "I1");
      expect(after.location.code, "override kept").toBe(locs.second.code);
      const follow = await lineOf(s.id, "O1", "I2");
      expect(follow.location.code, "line without override follows the master").toBe(locs.third.code);
      expect(follow.location_source).toBe("master");
    },
  );

  test(
    "TC-SC-020003 เปลี่ยน recipe ที่บรรทัด: มีผลเฉพาะบรรทัดนั้น; ติ๊ก 'ตั้งเป็นค่าเริ่มต้น' แล้ว master เปลี่ยนและบรรทัดอื่นที่ไม่ override ตาม",
    {
      annotation: [
        { type: "preconditions", description: "Admin login บน TEST BU; ร้าน E2E-141 วัน 3 import I1 สามบรรทัด O1/I1, O2/I1, O9/I1; master: O1 -> location แรก, O2 และ O9 -> location ที่สอง, I1 -> E2E-POS-A" },
        {
          type: "steps",
          description: "1. แท็บ Sales lines: เปลี่ยน recipe ของ O1/I1 เป็น E2E-POS-B (ไม่ติ๊กค่าเริ่มต้น)\n2. ตรวจบรรทัดอื่นและ master ของ I1\n3. เปลี่ยน recipe ของ O2/I1 เป็น E2E-POS-B พร้อมติ๊ก Also set as item default\n4. ตรวจ master ของ I1 และบรรทัด O9/I1",
        },
        {
          type: "expected",
          description:
            "หลังข้อ 1: O1/I1 recipe B (recipe_source line), O2/I1 และ O9/I1 ยัง A, master I1 ยัง E2E-POS-A; หลังข้อ 3: master I1 = E2E-POS-B และ O9/I1 (ไม่ override) เปลี่ยนเป็น B ตาม master",
        },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const s = await prepare("ovr-recipe", 3, [line("O1", "I1", 2), line("O2", "I1", 1), line("O9", "I1", 3)], { O9: locs.second.id });
      const recipeOf = async (o: OutletCode) => (await lineOf(s.id, o, "I1")).recipe?.id;
      const sc = new SalesConsumptionPage(page);
      await sc.gotoDetail(s.id);

      await sc.showSalesLines();
      await expectSaved(page, /\/sales-consumptions\/[^/]+\/lines/, () => sc.setLineRecipe("O1", "I1", "E2E-POS-B"), page.getByText("E2E-POS-B").first());
      expect(await recipeOf("O1")).toBe(recipes.B.id);
      expect((await lineOf(s.id, "O1", "I1")).recipe_source).not.toBe("master");
      expect(await recipeOf("O2")).toBe(recipes.A.id);
      expect(await recipeOf("O9")).toBe(recipes.A.id);
      expect((await itemMaster("I1")).recipe?.id).toBe(recipes.A.id);

      await sc.showSalesLines();
      await expectSaved(
        page,
        /\/sales-consumptions\/[^/]+\/lines/,
        () => sc.setLineRecipe("O2", "I1", "E2E-POS-B", { setItemDefault: true }),
        page.getByText("E2E-POS-B").first(),
      );
      expect((await itemMaster("I1")).recipe?.id, "item default changed").toBe(recipes.B.id);
      expect(await recipeOf("O9"), "non-overridden line follows the new master").toBe(recipes.B.id);
      expect((await lineOf(s.id, "O9", "I1")).recipe_source).toBe("master");
    },
  );

  test(
    "TC-SC-020004 SC ที่ post แล้วแก้บรรทัดไม่ได้: API ปฏิเสธ SALES_CONSUMPTION_NOT_PENDING และบรรทัดไม่เปลี่ยน",
    {
      annotation: [
        { type: "preconditions", description: "Admin login บน TEST BU; ร้าน E2E-141 วัน 3 import O1/I1 และ post แล้ว (verify + post ทาง API); afterAll void SC" },
        { type: "steps", description: "1. PATCH sales-consumptions/:id/lines เปลี่ยน location ของบรรทัด O1/I1 เป็น location ที่สอง\n2. PATCH เปลี่ยน recipe ของบรรทัดเดียวกัน\n3. อ่านรายละเอียด SC" },
        {
          type: "expected",
          description:
            "ทั้งสองคำขอถูกปฏิเสธ 409 SALES_CONSUMPTION_NOT_PENDING (brief เดาว่า SALES_CONSUMPTION_LINE_POSTED — BE จริงตอบ NOT_PENDING ซึ่งตรงกับ spec §4.2: posted แก้ไม่ได้ ต้อง void ก่อน); SC ยัง posted บรรทัด O1/I1 ยัง location แรก recipe A; Stock Out ยังชุดเดิม",
        },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async () => {
      const s = await postedFresh("posted-edit", 3, [line("O1", "I1", 2)]);
      const so = await liveStockOuts(s.id);
      const l = await lineOf(s.id, "O1", "I1");
      expectRefusal(await scUpdateLines(s.id, { line_ids: [l.id], location_id: locs.second.id }), 409, "SALES_CONSUMPTION_NOT_PENDING");
      expectRefusal(await scUpdateLines(s.id, { line_ids: [l.id], recipe_id: recipes.B.id }), 409, "SALES_CONSUMPTION_NOT_PENDING");
      const d = await detail(s.id);
      expect(d.status).toBe("posted");
      const after = await lineOf(s.id, "O1", "I1");
      expect(after.location.code).toBe(locs.first.code);
      expect(after.recipe.id).toBe(recipes.A.id);
      expect((await liveStockOuts(s.id)).map((x) => x.id)).toEqual(so.map((x) => x.id));
    },
  );

  // ── 03 verify ─────────────────────────────────────────────────────────
  test(
    "TC-SC-030001 ยังไม่ verify: ปุ่ม Post ปิด และ API post ถูกปฏิเสธ SALES_CONSUMPTION_NOT_VERIFIED",
    {
      annotation: [
        { type: "preconditions", description: "Admin login บน TEST BU; ร้าน E2E-141 วัน 4 import O1/I1 qty 2 ผูกครบ (ไม่มีบรรทัดค้าง) แต่ยังไม่กด Verify" },
        { type: "steps", description: "1. เปิดหน้า SC ดูปุ่ม Verify และ Post\n2. ยิง POST post ทาง API ตรง ๆ" },
        { type: "expected", description: "Verify เปิดใช้ได้ แต่ Post ปิด; post ถูกปฏิเสธ 422 SALES_CONSUMPTION_NOT_VERIFIED; ไม่มี Stock Out; SC ยัง pending" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const s = await prepare("not-verified", 4, [line("O1", "I1", 2)]);
      const sc = new SalesConsumptionPage(page);
      await sc.gotoDetail(s.id);
      await expect(sc.verifyButton()).toBeEnabled();
      await expect(sc.postButton()).toBeDisabled();
      const p = await scPost(s.id, Number((await detail(s.id)).doc_version));
      expectRefusal(p, 422, "SALES_CONSUMPTION_NOT_VERIFIED");
      expect(await liveStockOuts(s.id)).toEqual([]);
      expect((await detail(s.id)).status).toBe("pending");
    },
  );

  test(
    "TC-SC-030002 verify: ทุกแถววัตถุดิบ OK ตาม location; แก้บรรทัดหลัง verify แล้วผลตรวจหาย post ถูกปฏิเสธจนกว่าจะ verify ใหม่",
    {
      annotation: [
        { type: "preconditions", description: "Admin login บน TEST BU; ร้าน E2E-141 วัน 4 import O1/I1 qty 2 และ O2/I2 qty 1 ผูกครบ" },
        {
          type: "steps",
          description:
            "1. เปิดหน้า SC กด Verify on-hand\n2. ดูแถววัตถุดิบแต่ละ location\n3. แก้ location ของบรรทัด O1/I1 เป็น location ที่สอง (API)\n4. ยิง post ด้วย doc_version ใหม่ (ผลตรวจหายไปแล้ว)\n5. verify ใหม่แล้ว post",
        },
        {
          type: "expected",
          description:
            "หลัง verify: location แรกมี P1, P2 ขึ้น Yes และ location ที่สองมี P3, P4 ขึ้น Yes, Post เปิด; หลังแก้บรรทัดผล verify หาย (verification = null) Post ปิด, post ถูกปฏิเสธ 422 SALES_CONSUMPTION_NOT_VERIFIED (brief เดาว่า VERIFY_STALE — BE จริงล้างผลตรวจตอนแก้บรรทัด ตรงกับ spec §4.2/§6 (แก้บรรทัดแล้วผลตรวจหาย) จึงเป็นรหัสนี้); verify ใหม่แล้ว post ผ่านและมี Stock Out 2 ใบตามกลุ่มใหม่ (location ที่สอง P1, P2, P3, P4 = 4, 2, 1, 3; location แรกไม่มีใบ)",
        },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const s = await prepare("verify", 4, [line("O1", "I1", 2), line("O2", "I2", 1)]);
      const before = await snapshot(s.d);
      const sc = new SalesConsumptionPage(page);
      await sc.gotoDetail(s.id);
      await expectSaved(page, /\/verify-onhand/, () => sc.verifyButton().click(), sc.ingredientRowState(locs.first.code, products[0].name));
      for (const p of [products[0], products[1]]) await expect(sc.ingredientRowState(locs.first.code, p.name), `${p.name} at ${locs.first.code}`).toHaveText("Yes");
      for (const p of [products[2], products[3]]) await expect(sc.ingredientRowState(locs.second.code, p.name), `${p.name} at ${locs.second.code}`).toHaveText("Yes");
      await expect(sc.postButton()).toBeEnabled();
      expect((await detail(s.id)).verification).toMatchObject({ ok: true, stale: false });

      const i1 = await lineOf(s.id, "O1", "I1");
      const u = await scUpdateLines(s.id, { line_ids: [i1.id], location_id: locs.second.id });
      expect(u.status, `edit: ${JSON.stringify(u.body).slice(0, 300)}`).toBe(200);
      const d = await detail(s.id);
      expect(d.verification, "the edit drops the verification result").toBeNull();
      // real BE: the edit drops the verification, so post answers NOT_VERIFIED (brief guessed VERIFY_STALE); spec §6 "แก้บรรทัดแล้วผลตรวจหาย"
      const stale = await scPost(s.id, Number(d.doc_version));
      expectRefusal(stale, 422, "SALES_CONSUMPTION_NOT_VERIFIED");
      expect(await liveStockOuts(s.id)).toEqual([]);

      await sc.gotoDetail(s.id);
      await expect(sc.postButton()).toBeDisabled();
      const v = await scVerify(s.id);
      expect(v.status, `re-verify: ${JSON.stringify(v.body).slice(0, 300)}`).toBe(200);
      const p = await scPost(s.id, Number((await detail(s.id)).doc_version));
      expect(p.status, `post: ${JSON.stringify(p.body).slice(0, 300)}`).toBeLessThan(300);
      const want = expectedUse([
        { loc: locs.second, recipe: "A", qty: 2 },
        { loc: locs.second, recipe: "B", qty: 1 },
      ]);
      await expectStockOuts(s.id, s.d, want);
      await expectDeltas(s.d, before, want);
    },
  );

  // ── 04 post (stock) ───────────────────────────────────────────────────
  test(
    "TC-SC-040001 post วันที่มีบรรทัดสอง location ผ่านหน้าเว็บ: Stock Out 2 ใบ (SALE, ใบละ location, วันที่ = วันขาย) ยอดตามสูตร และ on-hand ลดตามนั้น",
    {
      annotation: [
        { type: "preconditions", description: "Admin login บน TEST BU; ร้าน E2E-141 วัน 5 import O1/I1 x2, O1/I2 x3, O2/I1 x4, O2/I2 x1; master: O1 -> location แรก, O2 -> location ที่สอง, I1 -> A (P1 x2, P2 x1), I2 -> B (P3 x1, P4 x3); อ่าน on-hand P1-P4 ทั้งสอง location ณ วันขายก่อนเริ่ม" },
        { type: "steps", description: "1. เปิดหน้า SC กด Verify on-hand\n2. กด Post & deduct stock\n3. อ่าน Stock Out ที่ SC สร้าง\n4. อ่าน on-hand P1-P4 ทั้งสอง location ใหม่" },
        {
          type: "expected",
          description:
            "SC posted; Stock Out ตรง 2 ใบ ชนิด SALE ใบละ location ลงวันที่ = วันขาย; location แรก: P1 = 4, P2 = 2, P3 = 3, P4 = 9; location ที่สอง: P1 = 8, P2 = 4, P3 = 1, P4 = 3; on-hand ของแต่ละสินค้าแต่ละ location ลดลงเท่ายอดนี้พอดี (ผลต่างของค่าจริง ไม่ใช่ค่าสัมบูรณ์)",
        },
        { type: "priority", description: "Critical" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const s = await prepare("post-two-loc", 5, [line("O1", "I1", 2), line("O1", "I2", 3), line("O2", "I1", 4), line("O2", "I2", 1)]);
      const before = await snapshot(s.d);
      const sc = new SalesConsumptionPage(page);
      await sc.gotoDetail(s.id);
      await expectSaved(page, /\/verify-onhand/, () => sc.verifyButton().click(), sc.ingredientRowState(locs.first.code, products[0].name));
      await expect(sc.postButton()).toBeEnabled();
      await expectSaved(page, /\/sales-consumptions\/[^/]+\/post/, () => sc.postButton().click(), sc.stockOutLinks().first());

      expect((await detail(s.id)).status).toBe("posted");
      const want = expectedUse([
        { loc: locs.first, recipe: "A", qty: 2 },
        { loc: locs.first, recipe: "B", qty: 3 },
        { loc: locs.second, recipe: "A", qty: 4 },
        { loc: locs.second, recipe: "B", qty: 1 },
      ]);
      expect([...want.get(locs.first.code)!.values()]).toEqual([4, 2, 3, 9]);
      expect([...want.get(locs.second.code)!.values()]).toEqual([8, 4, 1, 3]);
      await expectStockOuts(s.id, s.d, want);
      await expectDeltas(s.d, before, want);
    },
  );

  test(
    "TC-SC-040002 สต็อก P4 ไม่พอที่ location ที่สอง: verify ขึ้นขาดเฉพาะ location นั้น, post ถูกปฏิเสธ, ไม่มี Stock Out และ on-hand ไม่เปลี่ยน",
    {
      annotation: [
        { type: "preconditions", description: "Admin login บน TEST BU; ร้าน E2E-141 วัน 5 import O1/I1 x1 และ O2/I2 x N โดย N = ceil((on-hand P4 ที่ location ที่สอง ณ วันขาย + 1) / 3) (P4 ต้องใช้ 3 ต่อหน่วย จึงขาด 1 หน่วยพอดีขึ้นไป); location แรกพอ" },
        { type: "steps", description: "1. อ่าน on-hand ก่อน\n2. เปิดหน้า SC กด Verify on-hand (UI)\n3. ยิง post ทาง API\n4. อ่าน Stock Out ของ SC และ on-hand ใหม่" },
        {
          type: "expected",
          description:
            "verify: ที่ location ที่สองแถว P4 ขึ้น Short (ที่เหลือ Yes), location แรกทุกแถว Yes; verify (API) รายงานสินค้าที่ขาดแยก location มีเฉพาะ P4 ที่ location ที่สอง; post ถูกปฏิเสธ 422 SALES_CONSUMPTION_VERIFY_FAILED (spec §4.2: ขาดแม้ location เดียว = ไม่มีใบไหนออก; การที่คำตอบของ post ไม่ระบุสินค้าที่ขาดแยก location แยกเป็น TC-SC-040003); ไม่มี Stock Out สำหรับ SC นี้ SC ยัง pending; on-hand P1-P4 ทั้งสอง location เท่าเดิม",
        },
        { type: "priority", description: "Critical" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const d = day(5);
      const have = await onHand(products[3].id, locs.second.id, d);
      const qty = Math.ceil((have + 1) / 3);
      const s = await prepare("short", 5, [line("O1", "I1", 1), line("O2", "I2", qty)]);
      const before = await snapshot(s.d);

      const sc = new SalesConsumptionPage(page);
      await sc.gotoDetail(s.id);
      await expectSaved(page, /\/verify-onhand/, () => sc.verifyButton().click(), sc.ingredientRowState(locs.second.code, products[3].name));
      await expect(sc.ingredientRowState(locs.second.code, products[3].name)).toContainText("Short");
      await expect(sc.ingredientRowState(locs.second.code, products[2].name)).toHaveText("Yes");
      for (const p of [products[0], products[1]]) await expect(sc.ingredientRowState(locs.first.code, p.name)).toHaveText("Yes");
      await expect(sc.postButton()).toBeDisabled();

      const v = (await detail(s.id)).verification;
      expect(v?.ok).toBe(false);
      const v2 = await scVerify(s.id);
      expect(v2.status, `verify: ${JSON.stringify(v2.body).slice(0, 300)}`).toBe(200);
      const p = await scPost(s.id, Number((await detail(s.id)).doc_version));
      expectRefusal(p, 422, "SALES_CONSUMPTION_VERIFY_FAILED");
      // the short list (per location) comes with the verify answer: only P4 at the second location is short
      const shortList = (v2.body.data.groups as any[]).flatMap((g) => g.products.filter((x: any) => x.short > 0).map((x: any) => `${g.location_id}:${x.product_id}`));
      expect(shortList).toEqual([`${locs.second.id}:${products[3].id}`]);
      expect(await liveStockOuts(s.id)).toEqual([]);
      expect((await detail(s.id)).status).toBe("pending");
      await expectDeltas(s.d, before, new Map());
    },
  );

  test(
    "TC-SC-040003 post ที่ถูกปฏิเสธเพราะสต็อกไม่พอ ต้องระบุสินค้าที่ขาดแยก location ในคำตอบ (spec §4.2)",
    {
      annotation: [
        { type: "preconditions", description: "Admin login บน TEST BU; ร้าน E2E-141 วัน 7 import O1/I1 x1 และ O2/I2 x N โดย N = ceil((on-hand P4 ที่ location ที่สอง ณ วันขาย + 1) / 3); verify แล้วขึ้นขาด (API)" },
        { type: "steps", description: "1. verify (API) ได้ผลขาด P4 ที่ location ที่สอง\n2. ยิง POST post ทาง API\n3. อ่านเนื้อหาคำตอบ" },
        {
          type: "expected",
          description: "post ถูกปฏิเสธ 422 SALES_CONSUMPTION_VERIFY_FAILED และเนื้อหาคำตอบระบุ P4 ที่ location ที่สอง (feature spec §4.2: ขาดแม้ location เดียว = ไม่มีใบไหนออก คืนรายการสินค้าที่ขาดแยก location). BE จริงตอบเฉพาะข้อความ ไม่ระบุสินค้า จึง pin เป็น suspected bug (test.fail)",
        },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async () => {
      const d = day(7);
      const have = await onHand(products[3].id, locs.second.id, d);
      const qty = Math.ceil((have + 1) / 3);
      const s = await prepare("short-list", 7, [line("O1", "I1", 1), line("O2", "I2", qty)]);
      const v = await scVerify(s.id);
      expect(v.status, `verify: ${JSON.stringify(v.body).slice(0, 300)}`).toBe(200);
      const p = await scPost(s.id, Number((await detail(s.id)).doc_version));
      expectRefusal(p, 422, "SALES_CONSUMPTION_VERIFY_FAILED");
      expect(await liveStockOuts(s.id)).toEqual([]);

      test.fail(true, "suspected bug: post VERIFY_FAILED does not list short products per location (feature spec §4.2)");
      const body = JSON.stringify(p.body);
      expect(body, "names P4").toContain(products[3].id);
      expect(body.includes(locs.second.id) || body.includes(locs.second.code), "names the second location").toBe(true);
    },
  );

  // ── 05 double post ────────────────────────────────────────────────────
  test(
    "TC-SC-050001 post ซ้ำหลัง post สำเร็จ: ถูกปฏิเสธ จำนวน Stock Out และ on-hand ไม่เปลี่ยน",
    {
      annotation: [
        { type: "preconditions", description: "Admin login บน TEST BU; ร้าน E2E-141 วัน 6 import O1/I1 x2 และ O2/I2 x1 แล้ว verify + post สำเร็จ (Stock Out 2 ใบ)" },
        { type: "steps", description: "1. ยิง POST post ซ้ำด้วย doc_version เดิม\n2. อ่าน Stock Out ของ SC และ on-hand" },
        {
          type: "expected",
          description: "ครั้งที่สองถูกปฏิเสธ 409 SALES_CONSUMPTION_NOT_PENDING; SC ยังมี Stock Out ชุดเดิม 2 ใบ (id เดิม) ไม่มีชุดที่สอง; on-hand ลดเท่ายอดของ post แรกครั้งเดียว",
        },
        { type: "priority", description: "Critical" },
        { type: "testType", description: "Negative" },
      ],
    },
    async () => {
      const d = day(6);
      await importLive("dbl-seq", d, [line("O1", "I1", 2), line("O2", "I2", 1)]);
      await setMasters();
      const sc = (await scForDay(d))!;
      const before = await snapshot(d);
      expect((await scVerify(sc.id)).status).toBe(200);
      const ver = Number((await detail(sc.id)).doc_version);
      const first = await scPost(sc.id, ver);
      expect(first.status, `post: ${JSON.stringify(first.body).slice(0, 300)}`).toBeLessThan(300);
      const made = (await liveStockOuts(sc.id)).map((x) => x.id).sort();
      expect(made.length).toBe(2);

      const again = await scPost(sc.id, ver);
      expectRefusal(again, 409, "SALES_CONSUMPTION_NOT_PENDING");
      expect((await liveStockOuts(sc.id)).map((x) => x.id).sort()).toEqual(made);
      await expectDeltas(
        d,
        before,
        expectedUse([
          { loc: locs.first, recipe: "A", qty: 2 },
          { loc: locs.second, recipe: "B", qty: 1 },
        ]),
      );
    },
  );

  test(
    "TC-SC-050002 post พร้อมกันสองคำขอ (doc_version เดียวกัน): สำเร็จ 2xx เพียงหนึ่ง และเกิด Stock Out ชุดเดียว",
    {
      annotation: [
        { type: "preconditions", description: "Admin login บน TEST BU; ร้าน E2E-141 วัน 6 import O1/I1 x2 และ O2/I2 x1 แล้ว verify ผ่าน (ยังไม่ post)" },
        { type: "steps", description: "1. ยิง POST post สองคำขอพร้อมกัน (Promise.all) ด้วย doc_version เดียวกัน\n2. อ่าน Stock Out ของ SC และ on-hand" },
        {
          type: "expected",
          description: "ตอบ 2xx เพียงหนึ่งคำขอ อีกคำขอถูกปฏิเสธ 4xx (ไม่ใช่ 5xx); SC posted; Stock Out ที่ไม่ void ตรง 2 ใบ (หนึ่งใบต่อ location) ไม่มีชุดที่สอง; on-hand ลดเท่ายอดของ post ครั้งเดียว",
        },
        { type: "priority", description: "Critical" },
        { type: "testType", description: "Negative" },
      ],
    },
    async () => {
      const d = day(6);
      await importLive("dbl-par", d, [line("O1", "I1", 2), line("O2", "I2", 1)]);
      await setMasters();
      const sc = (await scForDay(d))!;
      const before = await snapshot(d);
      expect((await scVerify(sc.id)).status).toBe(200);
      const ver = Number((await detail(sc.id)).doc_version);

      const [a, b] = await Promise.all([scPost(sc.id, ver), scPost(sc.id, ver)]);
      for (const r of [a, b]) {
        expect(r.status, "answered by the real backend").not.toBe(401);
        expect(r.status, `parallel post answered ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`).toBeLessThan(500);
      }
      const ok = [a, b].filter((r) => r.status >= 200 && r.status < 300);
      expect(ok.length, "exactly one parallel post succeeds").toBe(1);
      const lost = [a, b].find((r) => !(r.status >= 200 && r.status < 300))!;
      expect(lost.status, "the losing request is refused").toBeGreaterThanOrEqual(400);
      expect((await detail(sc.id)).status).toBe("posted");
      const want = expectedUse([
        { loc: locs.first, recipe: "A", qty: 2 },
        { loc: locs.second, recipe: "B", qty: 1 },
      ]);
      await expectStockOuts(sc.id, d, want);
      await expectDeltas(d, before, want);
    },
  );

  // ── 06 void, late lines ───────────────────────────────────────────────
  test(
    "TC-SC-060001 void SC ที่ post แล้ว (งวดเปิด) ผ่านหน้าเว็บ: Stock Out ทุกใบถูก void, on-hand กลับเท่าก่อน post, SC เดิม voided และมี SC ใหม่ pending ของวันเดิมจำนวนบรรทัดเท่าเดิม",
    {
      annotation: [
        { type: "preconditions", description: "Admin login บน TEST BU; ร้าน E2E-141 วัน 11 import O1/I1 x2 และ O2/I2 x1 ผูกครบ; อ่าน on-hand P1-P4 ทั้งสอง location ณ วันขายก่อน post; verify แล้ว post (Stock Out 2 ใบ)" },
        { type: "steps", description: "1. เปิดหน้า SC ที่ posted กด Void ใส่เหตุผลแล้วยืนยัน\n2. อ่าน SC เดิม, Stock Out ของมัน และ SC ของวันนั้น\n3. อ่าน on-hand P1-P4 ทั้งสอง location ใหม่" },
        {
          type: "expected",
          description:
            "ขึ้นข้อความ Voided พร้อมเลข SC ใหม่; SC เดิมสถานะ voided และ Stock Out ทั้ง 2 ใบถูก void (ไม่เหลือใบที่ใช้งานอยู่ และ GET /stock-outs/:id ของแต่ละใบตอบ 404 เพราะ void = soft delete); on-hand ทุกสินค้าทุก location เท่าค่าก่อน post (ผลต่าง 0); SC ของวันเดียวกันที่ไม่ voided มีใบเดียว คนละ id กับใบเดิม สถานะ pending มี 2 บรรทัด (O1/I1 และ O2/I2) และไม่มี Stock Out",
        },
        { type: "priority", description: "Critical" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const d = day(11);
      const before = await snapshot(d);
      const s = await postedFresh("void-ui", 11, [line("O1", "I1", 2), line("O2", "I2", 1)]);
      const posted = await liveStockOuts(s.id);
      expect(posted.length, "post made one Stock Out per location").toBe(2);
      const pendingLines = (await detail(s.id)).lines.length;

      const sc = new SalesConsumptionPage(page);
      await sc.gotoDetail(s.id);
      await expectSaved(page, /\/sales-consumptions\/[^/]+\/void/, () => sc.confirmVoid("e2e void 060001"), page.getByText(/Voided\./));

      const old = await detail(s.id);
      expect(old.status).toBe("voided");
      expect(await liveStockOuts(s.id)).toEqual([]);
      // a voided Stock Out is soft-deleted: /stock-outs/:id answers 404 for it (the SC detail side is TC-SC-060005)
      for (const x of posted) {
        const r = await buSend("Admin", "GET", `/stock-outs/${x.id}`);
        expect(r.status, `voided stock-out ${x.id} is no longer served`).toBe(404);
      }
      await expectDeltas(d, before, new Map());

      const fresh = await scForDay(d);
      expect(fresh, "the day reopened as a new SC").toBeTruthy();
      expect(fresh!.id).not.toBe(s.id);
      const nd = await detail(fresh!.id);
      expect(nd.status).toBe("pending");
      expect(nd.lines.length, "the new SC holds the same lines").toBe(pendingLines);
      expect(await liveStockOuts(fresh!.id)).toEqual([]);
    },
  );

  test(
    "TC-SC-060002 void Stock Out ของ SC ที่ post แล้วตรง ๆ: ถูกปฏิเสธ STOCK_OUT_VOID_VIA_SALES_CONSUMPTION และ Stock Out ยังใช้งานอยู่",
    {
      annotation: [
        { type: "preconditions", description: "Admin login บน TEST BU; ร้าน E2E-141 วัน 12 import O1/I1 x2 ผูกครบ แล้ว verify + post; อ่าน on-hand ก่อนเริ่ม" },
        { type: "steps", description: "1. อ่านรายการ Stock Out ที่ SC สร้าง\n2. ยิง DELETE /stock-outs/:id/void กับ Stock Out นั้นตรง ๆ\n3. อ่าน SC, Stock Out และ on-hand ใหม่" },
        {
          type: "expected",
          description: "ถูกปฏิเสธ 409 STOCK_OUT_VOID_VIA_SALES_CONSUMPTION (feature spec §4.2: void Stock Out ที่มาจาก SC ต้องทำที่ SC); SC ยัง posted, Stock Out ยังไม่ voided รายการเดิม, on-hand ยังลดตามสูตรเท่าเดิม",
        },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async () => {
      const d = day(12);
      const before = await snapshot(d);
      const s = await postedFresh("void-so", 12, [line("O1", "I1", 2)]);
      const so = await liveStockOuts(s.id);
      expect(so.length).toBe(1);
      for (const x of so) expectRefusal(await voidStockOut(x.id), 409, "STOCK_OUT_VOID_VIA_SALES_CONSUMPTION");
      expect((await detail(s.id)).status).toBe("posted");
      expect((await liveStockOuts(s.id)).map((x) => x.id)).toEqual(so.map((x) => x.id));
      await expectDeltas(d, before, expectedUse([{ loc: locs.first, recipe: "A", qty: 2 }]));
    },
  );

  test(
    "TC-SC-060003 void SC ที่วันขายอยู่ในงวดคลังที่ปิดแล้ว ต้องถูกปฏิเสธ",
    {
      annotation: [
        { type: "preconditions", description: "SC ที่ posted แล้วในงวดคลังที่ถูกปิด; e2e ไม่เคยปิดงวด (data:reset ได้งวดเปิดเท่านั้น) จึงสร้างเงื่อนไขนี้ไม่ได้" },
        { type: "steps", description: "1. ปิดงวดคลังของวันขาย\n2. void SC ของวันนั้น" },
        { type: "expected", description: "void ถูกปฏิเสธด้วย SALES_CONSUMPTION_VOID_PERIOD_CLOSED (feature spec §4.2) และไม่มี Stock Out ถูก void" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async () => {
      test.skip(true, "not testable: e2e never closes inventory periods (design 2026-11-23)");
    },
  );

  test(
    "TC-SC-060004 ไฟล์ของอีกร้านเข้ามาหลังวันนั้น post แล้ว: SC ขึ้นคำเตือน late, บรรทัด late ไม่ผูก SC, void แล้ว SC ใหม่รับทั้งบรรทัดเดิมและ late",
    {
      annotation: [
        { type: "preconditions", description: "Admin login บน TEST BU; ร้าน E2E-141 วัน 13 import O1/I1 x2 ผูกครบ verify + post แล้ว; อ่าน on-hand P1-P4 ณ วันขายก่อนเริ่ม; ร้านที่สอง E2E-141B (ไม่ผูก master)" },
        {
          type: "steps",
          description:
            "1. import ไฟล์ของร้าน E2E-141B วัน 13 (O1/I2 x2) หลังวันนั้น post แล้ว\n2. เปิดหน้า SC ที่ posted และอ่านรายละเอียด/ปฏิทินของวัน\n3. void SC ผ่าน API\n4. อ่าน SC ใหม่ของวัน และ on-hand",
        },
        {
          type: "expected",
          description:
            "หน้า SC ขึ้นคำเตือน 'sale line arrived after this was posted' และ late_lines = 1 (ตรงกับปฏิทิน); SC ที่ posted ยังมีแค่ 1 บรรทัดเดิม (บรรทัด late ไม่มี SC id) และ Stock Out ชุดเดิมไม่เปลี่ยน; หลัง void SC เดิม voided, on-hand กลับเท่าก่อน post, มี SC ใหม่ pending ใบเดียวที่มี 2 บรรทัด (เดิม + late) และไม่ขึ้น late อีก",
        },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const d = day(13);
      const before = await snapshot(d);
      const s = await postedFresh("late-a", 13, [line("O1", "I1", 2)]);
      const so = await liveStockOuts(s.id);
      expect(so.length).toBe(1);

      await importLive("late-b", d, [line("O1", "I2", 2)], { key: STORE_KEY_B, name: STORE_NAME_B });
      const posted = await detail(s.id);
      expect(posted.status, "a late file does not touch the posted SC").toBe("posted");
      expect(posted.late_lines).toBe(1);
      expect(posted.lines.length, "the late line is not attached to the posted SC").toBe(1);
      expect((await liveStockOuts(s.id)).map((x) => x.id)).toEqual(so.map((x) => x.id));
      const cal = (await scCalendar(d.slice(0, 7))).body?.data?.find((x: any) => x.date === d);
      expect(cal?.late_lines, "calendar counts the same late line").toBe(1);

      const sc = new SalesConsumptionPage(page);
      await sc.gotoDetail(s.id);
      await expect(sc.lateLinesWarning()).toBeVisible();

      const v = await scVoid(s.id, "e2e void 060004", Number(posted.doc_version));
      expect(v.status, `void: ${JSON.stringify(v.body).slice(0, 300)}`).toBeLessThan(300);
      expect((await detail(s.id)).status).toBe("voided");
      await expectDeltas(d, before, new Map());
      const fresh = await scForDay(d);
      expect(fresh, "the day reopened as a new SC").toBeTruthy();
      expect(fresh!.id).not.toBe(s.id);
      const nd = await detail(fresh!.id);
      expect(nd.status).toBe("pending");
      expect(nd.lines.length, "the new SC holds the original and the late line").toBe(2);
      expect(nd.late_lines).toBe(0);
    },
  );

  test(
    "TC-SC-060005 หน้า SC ที่ถูก void ต้องแสดง Stock Out ที่ถูก void ของมัน (voided = true)",
    {
      annotation: [
        { type: "preconditions", description: "Admin login บน TEST BU; ร้าน E2E-141 วัน 12 import O1/I1 x2 ผูกครบ verify + post (Stock Out 1 ใบ) แล้ว void SC ผ่าน API" },
        { type: "steps", description: "1. void SC ที่ posted (API)\n2. อ่านรายละเอียดของ SC เดิมที่ voided" },
        {
          type: "expected",
          description:
            "stock_outs ของ SC ที่ voided ยังรายการ Stock Out ใบเดิมพร้อม voided = true (feature spec §4.2: หน้า SC ที่ voided แสดงข้อมูลจาก Stock Out ที่ออกจริง; โค้ด BE และป้าย 'voided' ใน FE เตรียมไว้). BE จริงตอบ stock_outs ว่าง จึง pin เป็น suspected bug (test.fail)",
        },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async () => {
      const s = await postedFresh("void-list", 12, [line("O1", "I1", 2)]);
      const so = await liveStockOuts(s.id);
      expect(so.length).toBe(1);
      const v = await scVoid(s.id, "e2e void 060005", Number((await detail(s.id)).doc_version));
      expect(v.status, `void: ${JSON.stringify(v.body).slice(0, 300)}`).toBeLessThan(300);
      const r = await scDetail(s.id);
      expect(r.status, "answered by the real backend").toBe(200);
      expect(r.body.data.status).toBe("voided");

      test.fail(true, "suspected bug: the detail of a voided SC lists no Stock Outs or ingredients (feature spec §4.2)");
      expect((r.body.data.ingredients as unknown[]).length, "ingredients of the voided Stock Out").toBeGreaterThan(0);
      const list = r.body.data.stock_outs as Array<{ id: string; voided: boolean }>;
      expect(list.map((x) => x.id)).toEqual(so.map((x) => x.id));
      expect(list.every((x) => x.voided)).toBe(true);
    },
  );

  // ── 07 calendar ───────────────────────────────────────────────────────
  test(
    "TC-SC-070001 ปฏิทินเดือนปัจจุบัน: วัน post = Posted, วันรอ post = Pending, วันที่ import แต่ยอดสุทธิ 0 = No sales, วันที่ไม่มีไฟล์ = No file และวันนี้ไม่ขึ้น No file",
    {
      annotation: [
        { type: "preconditions", description: "Admin login บน TEST BU; ร้าน E2E-141: ใช้ pastDays 5 วัน (ก่อนเมื่อวาน ไม่ชนวันของ 140/141): วันแรก import เฉพาะรายการยอดสุทธิ 0 (ตั้งต้นปฏิทินของ BU), สองวันถัดไปไม่มีไฟล์, วันที่สี่ import + post, วันที่ห้า import ผูกครบ ยังไม่ post" },
        { type: "steps", description: "1. เปิด Sales Consumption > Calendar เดือนปัจจุบัน\n2. อ่านข้อความสถานะของแต่ละวันที่กล่าวมา และของวันนี้\n3. เทียบกับ GET calendar" },
        {
          type: "expected",
          description:
            "วันที่ post ขึ้น Posted, วันที่ยังไม่ post ขึ้น Pending, วัน net-0 ขึ้น No sales, สองวันที่ไม่มี import (อยู่หลังวัน import แรกของ BU ก่อนวันนี้) ขึ้น No file, วันนี้ไม่ขึ้น No file (API = future); ค่าจาก API calendar ตรงกับหน้า (posted / pending / no_sales / no_file / future)",
        },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
      const past = pastDays(period, today, 5);
      test.skip(past === null, "month too young: needs 5 past days before yesterday outside the 140/141 day ranges");
      // earliest first: the net-0 day is the BU calendar start, so the two days after it (no import) are No file
      const [noSales, noFile1, noFile2, postedDay, pendingDay] = past!;
      const month = today.slice(0, 7);
      for (const dd of past!) {
        expect(dd < today, `${dd} is a past day`).toBe(true);
        expect(dd.slice(0, 7), `${dd} is in the current month`).toBe(month);
      }

      await postedFresh("cal-posted", postedDay, [line("O1", "I1", 1)]);
      await prepare("cal-pending", pendingDay, [line("O1", "I1", 1)]);
      // the BU calendar starts at its first live import: this net-0 day is that start
      await importLive("cal-nosales", noSales, [line("O1", "I2", 3), line("O1", "I2", -3)]);

      const cal = await scCalendar(month);
      expect(cal.status, "calendar answered by the real backend").toBe(200);
      const api = new Map<string, string>((cal.body?.data ?? []).map((x: any) => [x.date as string, x.status as string]));
      expect(api.get(postedDay)).toBe("posted");
      expect(api.get(pendingDay)).toBe("pending");
      expect(api.get(noSales)).toBe("no_sales");
      expect(api.get(noFile1)).toBe("no_file");
      expect(api.get(noFile2)).toBe("no_file");
      // proof that today is never "No file": the API says future (the UI shows no status text for a future day)
      expect(api.get(today), "today is never a missing file").toBe("future");

      const sc = new SalesConsumptionPage(page);
      await sc.goto(month);
      await expect(sc.dayStatus(postedDay)).toHaveText("Posted");
      await expect(sc.dayStatus(pendingDay)).toHaveText("Pending");
      await expect(sc.dayStatus(noSales)).toHaveText("No sales");
      await expect(sc.dayStatus(noFile1)).toHaveText("No file");
      await expect(sc.dayStatus(noFile2)).toHaveText("No file");
      // a future day carries no status text at all
      await expect(sc.dayStatus(today)).toHaveCount(0);
    },
  );
});
