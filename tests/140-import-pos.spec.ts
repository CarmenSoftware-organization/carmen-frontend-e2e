import { expect } from "@playwright/test";
import { createAuthTest } from "./fixtures/auth.fixture";
import { ImportPosPage } from "./pages/import-pos.page";
import { buConfigSend, buSend } from "./helpers/bu-api";
import {
  assertPosReady,
  cancelImport,
  cleanupPosRun,
  importSimphony,
  listImports,
  listItems,
  listOutlets,
  mapItem,
  mapOutlet,
  rowsOf,
  scDetail,
  scForDay,
  scPost,
  scVerify,
} from "./helpers/pos-api";
import { saleDay, type Period } from "./helpers/pos-days";
import { buildSimphonyFile, type SimphonyLine } from "./helpers/simphony-fixture";
import { expectSaved } from "./helpers/settle";
import { uid } from "./helpers/test-data";

// ─────────────────────────────────────────────────────────────────────────
// Import POS (Simphony) on the TEST BU (BU-GR2VYNKQ): upload, refusals, cancel.
//
// Store key E2E-140; sale days saleDay(140, 1..6) count forward from the start of the open inventory period, so the
// spec never shares a day with 141. Case -> day: 01 -> 1, 02 duplicate -> 2, 03 posted day -> 3, 03 pending day -> 4.
// Oracle: ../carmen-frontend/docs/superpowers/specs/2026-10-26-sales-consumption-design.md §4.2 (Import POS shows raw
// lines only, no mapping; cancel of an import whose lines sit in a posted SC is refused) and the gateway docblocks of
// `POST /pos-sales/imports/simphony` and `.../imports/:id/cancel` (backend-gateway pos-sales.controller.ts).
//
// Writes go through pos-api (role Admin: StoreManager lacks stock_out.create/delete on this BU). Master mapping per
// store persists across runs, so each case that needs a mapping sets it first through the API. afterAll voids the
// posted SC the spec made and cancels its imports; a cleanup failure throws.
// ─────────────────────────────────────────────────────────────────────────
const test = createAuthTest("carmensoftware.dev+admin@gmail.com");
test.describe.configure({ timeout: 90_000 });

const STORE_KEY = "E2E-140";
const STORE_NAME = "E2E 140";
const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fileName = (key: string) => `e2e-140-${key}-${uid}.txt`;

const O1 = { outletCode: "O1", outletName: "Outlet One" };
const O2 = { outletCode: "O2", outletName: "Outlet Two" };
const I1 = { itemCode: "I1", itemName: "Item One", deptCode: "D1", deptName: "Dept One" };
const I2 = { itemCode: "I2", itemName: "Item Two", deptCode: "D1", deptName: "Dept One" };

/** 2 outlets x 2 items, every quantity and amount different so a mix-up shows. Sum of totals 475. */
const DAY1_LINES: SimphonyLine[] = [
  { ...O1, ...I1, qty: 2, total: 100 },
  { ...O1, ...I2, qty: 1, total: 45 },
  { ...O2, ...I1, qty: 3, total: 150 },
  { ...O2, ...I2, qty: 4, total: 180 },
];
const ONE_LINE: SimphonyLine[] = [{ ...O1, ...I1, qty: 1, total: 100 }];

const file = (day: string, lines: SimphonyLine[]) => buildSimphonyFile({ storeKey: STORE_KEY, storeName: STORE_NAME, businessDate: day, lines });

let period: Period;
const day = (n: number) => saleDay(140, n, period);

async function currentPeriod(): Promise<Period> {
  const r = await buSend("Admin", "GET", "/inventory-periods/current");
  const p = r.body?.data;
  if (r.status !== 200 || p?.status !== "open") throw new Error(`no open inventory period (GET -> ${r.status}) - run data:reset`);
  return { start: String(p.start_at).slice(0, 10), end: String(p.end_at).slice(0, 10) };
}

/** Import through the API and demand a live import (status success). */
async function importLive(name: string, businessDate: string, lines: SimphonyLine[]): Promise<string> {
  const r = await importSimphony(file(businessDate, lines), name);
  expect(r.status, `import ${name}: ${JSON.stringify(r.body).slice(0, 200)}`).toBe(201);
  expect(r.body?.data?.status).toBe("success");
  return String(r.body.data.id);
}

async function historyOf(name: string) {
  const row = rowsOf<any>((await listImports()).body).find((i) => i.file_name === name);
  if (!row) throw new Error(`no import history row for ${name}`);
  return row;
}

/** The first inventory location by code: the one the POS seed gives ingredient stock at. */
async function stockedLocationId(): Promise<string> {
  const r = await buConfigSend("Admin", "GET", "/locations?perpage=100");
  const inv = rowsOf<any>(r.body)
    .filter((l) => (l.location_type ?? "inventory") === "inventory")
    .sort((a, b) => String(a.code).localeCompare(String(b.code)));
  if (r.status !== 200 || !inv[0]) throw new Error(`no inventory location (GET locations -> ${r.status})`);
  return String(inv[0].id);
}

async function recipeId(code: string): Promise<string> {
  const r = await buConfigSend("Admin", "GET", `/recipes?search=${code}&perpage=50`);
  const hit = rowsOf<any>(r.body).find((x) => x.code === code);
  if (!hit) throw new Error(`recipe ${code} is missing - run data:reset`);
  return String(hit.id);
}

/** Set the master mapping this case needs: O1 -> location, I1 -> recipe (the store exists once a file was imported). */
async function mapO1I1(locationId: string, recipe: string): Promise<void> {
  const stores = rowsOf<any>((await buSend("Admin", "GET", "/pos-sales/stores")).body);
  const store = stores.find((s) => s.store_key === STORE_KEY);
  if (!store) throw new Error(`POS store ${STORE_KEY} not found after import`);
  const outlet = rowsOf<any>((await listOutlets(store.id)).body).find((o) => o.code === "O1");
  const item = rowsOf<any>((await listItems(store.id)).body).find((i) => i.code === "I1");
  if (!outlet || !item) throw new Error("outlet O1 / item I1 missing after import");
  const a = await mapOutlet(outlet.id, locationId);
  const b = await mapItem(item.id, { recipe_id: recipe });
  expect([a.status, b.status], "mapping refused").toEqual([200, 200]);
}

test.describe("Import POS (140)", () => {
  test.beforeAll(async () => {
    await assertPosReady();
    period = await currentPeriod();
    await cleanupPosRun(STORE_KEY);
  });

  test.afterAll(async () => {
    await cleanupPosRun(STORE_KEY);
  });

  // ── 01 upload ─────────────────────────────────────────────────────────
  test(
    "TC-IPOS-010001 อัปโหลดไฟล์ Simphony ผ่านหน้าเว็บ: ประวัติขึ้น success, บรรทัดดิบครบ, ไม่มีปุ่ม mapping/confirm, ลิงก์ไป SC ของวันนั้น",
    {
      annotation: [
        { type: "preconditions", description: "Admin login บน TEST BU; data:reset แล้ว (เปิด Simphony); ยังไม่มี import live ของร้าน E2E-140 วันขายที่ 1 ของงวด" },
        {
          type: "steps",
          description:
            "1. เปิด /operation-plan/import-pos\n2. อัปโหลดไฟล์ Simphony ของวัน 1 (2 outlet x 2 สินค้า, 4 บรรทัด)\n3. ดูแถวประวัติของไฟล์\n4. กด View lines แล้วเทียบบรรทัดดิบกับไฟล์\n5. ตรวจว่าไม่มีปุ่ม mapping / confirm\n6. กดลิงก์ Sales Consumption ของแถว",
        },
        {
          type: "expected",
          description:
            "แถวประวัติสถานะ Imported, 4 บรรทัด, ยอดขาย 475.00 (API: status success, line_count 4); ตาราง Raw transactions มี 4 บรรทัด ตรง outlet/item/qty/amount ของไฟล์ทุกบรรทัด; หน้าไม่มีปุ่ม Confirm / Map; ลิงก์ SC เปิดหน้า SC ของวัน 1 โดย id ใน URL = id ของ SC จาก scForDay",
        },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const d = day(1);
      const name = fileName("up");
      const pos = new ImportPosPage(page);
      await pos.goto();
      await pos.uploadSimphony(file(d, DAY1_LINES), name);
      await expect(pos.rowStatus(name)).toHaveText("Imported", { timeout: 30_000 });

      const h = await historyOf(name);
      expect(h.status).toBe("success");
      expect(h.line_count).toBe(4);
      expect(Number(h.total_sales_amount)).toBe(475);
      await expect(pos.historyRow(name)).toContainText(fmt(475));

      await pos.openLines(name).click();
      await expect(pos.rawLinesTable()).toHaveCount(4);
      for (const l of DAY1_LINES) {
        const row = pos
          .rawLinesTable()
          .filter({ hasText: `${l.outletCode} ${l.outletName}` })
          .filter({ has: page.getByRole("cell", { name: l.itemCode, exact: true }) });
        await expect(row, `raw line ${l.outletCode}/${l.itemCode}`).toHaveCount(1);
        const cells = row.getByRole("cell");
        await expect(cells.nth(3)).toHaveText(l.itemName);
        await expect(cells.nth(4)).toHaveText(String(l.qty));
        await expect(cells.nth(6)).toHaveText(fmt(l.total));
      }
      await expect(page.getByRole("button", { name: /confirm|map/i })).toHaveCount(0);

      const sc = await scForDay(d);
      expect(sc, "the import should have created the SC of its day").toBeTruthy();
      await pos.scLink(name).click();
      await expect(page).toHaveURL(new RegExp(`/operation-plan/sales-consumption/${sc!.id}$`));
    },
  );

  test(
    "TC-IPOS-010002 แสดงปุ่มอัปโหลดเฉพาะแบรนด์ที่ BU เปิด: Simphony มี, Micros 3700 ไม่มี",
    {
      annotation: [
        { type: "preconditions", description: "Admin login บน TEST BU; data:reset เปิดเฉพาะ Simphony (GET /pos-sales/status enabled_brands)" },
        { type: "steps", description: "1. อ่าน GET /pos-sales/status\n2. เปิด /operation-plan/import-pos\n3. ดูปุ่ม Upload file และ Upload PDF" },
        {
          type: "expected",
          description: "ปุ่มของแบรนด์ใน enabled_brands แสดง (Upload file ของ Simphony) และปุ่มของแบรนด์ที่ไม่อยู่ในรายการไม่อยู่ใน DOM (Upload PDF ของ Micros 3700) — ตรงกับ status ของ API",
        },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const s = await buSend("Admin", "GET", "/pos-sales/status");
      expect(s.status).toBe(200);
      const brands: string[] = s.body?.data?.enabled_brands ?? [];
      const pos = new ImportPosPage(page);
      await pos.goto();
      for (const brand of ["simphony", "micros3700"] as const) {
        if (brands.includes(brand)) await expect(pos.uploadButton(brand)).toBeVisible();
        else await expect(pos.uploadButton(brand)).toHaveCount(0);
      }
      expect(brands).toContain("simphony");
      expect(brands).not.toContain("micros3700");
    },
  );

  // ── 02 refusals ───────────────────────────────────────────────────────
  test(
    "TC-IPOS-020001 อัปโหลดร้านและวันเดิมซ้ำ: API 201 สถานะ rejected_duplicate และมีแถวในประวัติ",
    {
      annotation: [
        { type: "preconditions", description: "Admin login บน TEST BU; มี import live ของ E2E-140 วัน 2 (สร้างทาง API ก่อนเริ่ม)" },
        {
          type: "steps",
          description: "1. อัปโหลดไฟล์วัน 2 ครั้งแรก (API)\n2. อัปโหลดไฟล์วัน 2 ซ้ำอีกชื่อหนึ่ง (API)\n3. เปิด /operation-plan/import-pos แล้วดูแถวของไฟล์ที่สอง",
        },
        {
          type: "expected",
          description: "ครั้งที่สองตอบ 201 พร้อม data.status = rejected_duplicate (gateway docblock: ไฟล์ซ้ำบันทึกเป็นประวัติ ไม่ตอบ error); หน้าประวัติมีแถวของไฟล์นั้น สถานะ 'Already imported for this date' ไม่มีลิงก์ SC; import แรกยัง live",
        },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const d = day(2);
      const first = fileName("dup1");
      const second = fileName("dup2");
      const firstId = await importLive(first, d, ONE_LINE);
      const r = await importSimphony(file(d, ONE_LINE), second);
      expect(r.status).toBe(201);
      expect(r.body?.data?.status).toBe("rejected_duplicate");

      const h = await historyOf(second);
      expect(h.status).toBe("rejected_duplicate");
      const live = await historyOf(first);
      expect(live.id).toBe(firstId);
      expect(live.cancelled_at).toBeNull();

      const pos = new ImportPosPage(page);
      await pos.goto();
      await expect(pos.rowStatus(second)).toHaveText("Already imported for this date");
      await expect(pos.scLink(second)).toHaveCount(0);
    },
  );

  test(
    "TC-IPOS-020002 ไฟล์ว่าง: 400 POS_SALE_UNSUPPORTED_FILE",
    {
      annotation: [
        { type: "preconditions", description: "Admin login บน TEST BU" },
        { type: "steps", description: "1. POST /pos-sales/imports/simphony ด้วยไฟล์ว่าง" },
        {
          type: "expected",
          description: "ตอบ 400 พร้อม error.code POS_SALE_UNSUPPORTED_FILE (gateway docblock: ตอบ 400 เฉพาะไฟล์ว่างหรือไบนารี); ไม่มีแถวใหม่ในประวัติของไฟล์นั้น",
        },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async () => {
      const name = fileName("empty");
      const r = await importSimphony("", name);
      expect(r.status).toBe(400);
      expect(r.body?.error?.code).toBe("POS_SALE_UNSUPPORTED_FILE");
      expect(rowsOf<any>((await listImports()).body).some((i) => i.file_name === name)).toBe(false);
    },
  );

  test(
    "TC-IPOS-020003 ไฟล์ที่ GLID วันแรก ≠ วันสุดท้าย: สถานะ multi_day_glid_reject และขึ้นในประวัติ",
    {
      annotation: [
        { type: "preconditions", description: "Admin login บน TEST BU" },
        {
          type: "steps",
          description: "1. สร้างไฟล์ที่หัว GLID ระบุวันที่ต่างกัน (วัน 5 ถึงวัน 6)\n2. อัปโหลด (API)\n3. เปิด /operation-plan/import-pos แล้วดูแถวของไฟล์",
        },
        {
          type: "expected",
          description: "ตอบ 201 data.status = multi_day_glid_reject พร้อม error_message ว่าหลายวันทำการ; แถวประวัติแสดง 'File contains more than one business day'; ไม่มี SC ของวัน 5 ถูกสร้าง",
        },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const d5 = day(5);
      const d6 = day(6);
      const name = fileName("multi");
      const text = file(d5, ONE_LINE).replace(`|${d5.replaceAll("-", "")}|${d5.replaceAll("-", "")}|`, `|${d5.replaceAll("-", "")}|${d6.replaceAll("-", "")}|`);
      expect(text).not.toBe(file(d5, ONE_LINE));
      const r = await importSimphony(text, name);
      expect(r.status).toBe(201);
      expect(r.body?.data?.status).toBe("multi_day_glid_reject");
      expect(String(r.body?.data?.error_message)).toContain("multiple business dates");
      expect((await historyOf(name)).status).toBe("multi_day_glid_reject");
      expect(await scForDay(d5)).toBeNull();

      const pos = new ImportPosPage(page);
      await pos.goto();
      await expect(pos.rowStatus(name)).toHaveText("File contains more than one business day");
    },
  );

  test(
    "TC-IPOS-020004 Micros 3700 check ที่ส่งบรรทัดของไฟล์ Simphony: ไม่นำเข้า ตอบ rejected และบันทึกเป็น format_error",
    {
      annotation: [
        { type: "preconditions", description: "Admin login บน TEST BU" },
        { type: "steps", description: "1. แปลงไฟล์ Simphony เป็นบรรทัดข้อความ (แยกตามช่อง |)\n2. POST /pos-sales/imports/micros3700/check ด้วยบรรทัดเหล่านั้น" },
        {
          type: "expected",
          description:
            "ไม่นำเข้าอะไร: ตอบ 200 data.kind = rejected, import.status = format_error ('not an MI_R001.RPT ... report'), ไม่มี SC ถูกสร้าง. หมายเหตุ: brief คาดว่าไม่ใช่ 2xx แต่ gateway docblock ของ check ระบุว่าไฟล์ที่นำเข้าไม่ได้จะถูกบันทึกเป็นการนำเข้าที่ถูกปฏิเสธและตอบ kind: rejected — พฤติกรรมตรงตามเอกสาร",
        },
        { type: "priority", description: "Low" },
        { type: "testType", description: "Negative" },
      ],
    },
    async () => {
      const lines = file(day(5), ONE_LINE)
        .split("\r\n")
        .filter((l) => l !== "")
        .map((l) => l.split("|"));
      const r = await buSend("Admin", "POST", "/pos-sales/imports/micros3700/check", { file_name: fileName("micros").replace(".txt", ".pdf"), lines });
      expect(r.status, "answered by the real backend").not.toBe(401);
      expect(r.status).toBeLessThan(500);
      expect(r.status).toBe(200);
      expect(r.body?.data?.kind).toBe("rejected");
      expect(r.body?.data?.import?.status).toBe("format_error");
      expect(await scForDay(day(5))).toBeNull();
    },
  );

  // ── 03 cancel ─────────────────────────────────────────────────────────
  test(
    "TC-IPOS-030001 ยกเลิก import เดียวของวันที่ยังไม่ post: import เป็น cancelled และวันนั้นไม่มี SC",
    {
      annotation: [
        { type: "preconditions", description: "Admin login บน TEST BU; มี import live เดียวของ E2E-140 วัน 4 (สร้างทาง API) ซึ่งสร้าง SC pending ของวันนั้น" },
        { type: "steps", description: "1. เปิด /operation-plan/import-pos\n2. กด Cancel import ที่แถวของไฟล์วัน 4\n3. ยืนยันในกล่องโต้ตอบ" },
        {
          type: "expected",
          description: "POST .../cancel ตอบ 2xx และขึ้นข้อความ Import cancelled; import มี cancelled_at, ปุ่ม Cancel import หายจากแถว; scForDay(วัน 4) = null (SC pending ที่เหลือแต่บรรทัดของ import นี้ถูกลบ — feature spec §4.2)",
        },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const d = day(4);
      const name = fileName("cancel");
      const id = await importLive(name, d, ONE_LINE);
      const before = await scForDay(d);
      expect(before, "the import should have created a pending SC").toBeTruthy();
      expect(before!.status).toBe("pending");

      const pos = new ImportPosPage(page);
      await pos.goto();
      await pos.cancelImport(name).click();
      await expect(pos.cancelDialog()).toBeVisible();
      await expectSaved(page, /\/pos-sales\/imports\/[^/]+\/cancel/, () => pos.cancelConfirmButton().click(), page.getByText("Import cancelled"));
      await expect(pos.cancelImport(name)).toHaveCount(0);

      const h = await historyOf(name);
      expect(h.id).toBe(id);
      expect(h.cancelled_at).not.toBeNull();
      expect(await scForDay(d)).toBeNull();
    },
  );

  test(
    "TC-IPOS-030002 ยกเลิก import ของวันที่ SC post แล้ว: ถูกปฏิเสธ import ยัง live",
    {
      annotation: [
        { type: "preconditions", description: "Admin login บน TEST BU; วัน 3 ของ E2E-140 ผูก O1 -> location ที่มีสต็อก และ I1 -> E2E-POS-A แล้ว import 1 บรรทัด verify และ post SC ทาง API; afterAll void SC แล้วยกเลิก import" },
        {
          type: "steps",
          description: "1. import วัน 3, ผูก mapping, verify on-hand และ post SC (API)\n2. เปิด /operation-plan/import-pos ดูแถวของไฟล์\n3. POST .../imports/:id/cancel",
        },
        {
          type: "expected",
          description: "หน้าเว็บไม่มีปุ่ม Cancel import ที่แถวนั้น; API ปฏิเสธ 400 พร้อม error.code POS_SALE_IMPORT_HAS_CONFIRMED_LINES (cancel docblock: บรรทัดถูกตัดสต็อกใน SC ที่ post แล้ว ต้อง void SC ก่อน); import ยัง live (cancelled_at ว่าง) และ SC ยัง posted",
        },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const d = day(3);
      const name = fileName("posted");
      const id = await importLive(name, d, ONE_LINE);
      await mapO1I1(await stockedLocationId(), await recipeId("E2E-POS-A"));

      const sc = await scForDay(d);
      expect(sc, "the import should have created the SC of its day").toBeTruthy();
      const v = await scVerify(sc!.id);
      expect(v.status, `verify: ${JSON.stringify(v.body).slice(0, 300)}`).toBe(200);
      const detail = (await scDetail(sc!.id)).body?.data;
      const posted = await scPost(sc!.id, Number(detail.doc_version));
      expect(posted.status, `post: ${JSON.stringify(posted.body).slice(0, 400)}`).toBeLessThan(300);
      expect((await scDetail(sc!.id)).body?.data?.status).toBe("posted");

      const pos = new ImportPosPage(page);
      await pos.goto();
      await expect(pos.rowStatus(name)).toHaveText("Imported");
      await expect(pos.cancelImport(name)).toHaveCount(0);

      const r = await cancelImport(id);
      expect(r.status, "answered by the real backend").not.toBe(401);
      expect(r.status).toBeLessThan(500);
      expect(r.status).toBe(400);
      expect(r.body?.error?.code).toBe("POS_SALE_IMPORT_HAS_CONFIRMED_LINES");

      const h = await historyOf(name);
      expect(h.cancelled_at).toBeNull();
      expect((await scDetail(sc!.id)).body?.data?.status).toBe("posted");
    },
  );
});
