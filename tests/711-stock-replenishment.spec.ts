import { expect, type Locator, type Page } from "@playwright/test";
import { createAuthTest } from "./fixtures/auth.fixture";
import { BU_CODE } from "./test-users";
import { ensureActiveBu } from "./helpers/bu";
import { buGet, rootGet } from "./helpers/bu-api";

/**
 * Stock Replenishment (SRPL) — E2E Test Suite.
 *
 * Route: /store-operation/stock-replenishment
 * Prefix: SRPL
 *
 * Page (FE 5d5779fb summary + sticky action bar, 50446240 width-driven table tiers): locations
 * with products below their stock levels, collapsible per location, row/location checkboxes feed
 * a sticky bar (Create SR / Create PR). Expected values are computed from the same
 * GET /stock-replenishments the page reads (TEST BU seed data), not hard-coded. Create cases make
 * real PR/SR documents in the TEST BU (data:reset wipes them).
 */

const test = createAuthTest("carmensoftware.dev+purchase@gmail.com");
const adminTest = createAuthTest("carmensoftware.dev+admin@gmail.com");
const requestorTest = createAuthTest("carmensoftware.dev+requestor@gmail.com");
const PATH = "/store-operation/stock-replenishment";
const API = "**/api/*/stock-replenishments*";

interface Prod { id: string; name: string; code: string; local_name?: string | null; status: "low" | "warning" | "critical"; reorder_qty: number; on_hand_qty: number }
interface Loc { location_id: string; location_code: string; location_name: string; products_location: Prod[] }

async function replenishment(): Promise<Loc[]> {
  const r = await buGet("Admin", "/stock-replenishments");
  expect(r.status, "stock-replenishments API").toBe(200);
  return r.body.data as Loc[];
}
/** Data precondition (API-checked, not a UI visibility guard). */
function needLocations(locs: Loc[], n: number, perLocation = 1) {
  const ok = locs.filter((l) => l.products_location.length >= perLocation);
  test.skip(ok.length < n, `TEST BU needs ${n} location(s) with >= ${perLocation} replenishment product(s); API returned ${ok.length}`);
  return ok;
}

const heading = (page: Page) => page.getByRole("heading", { name: /Stock Replenishment/i }).first();
const selectAll = (page: Page, loc: Loc) => page.getByRole("checkbox", { name: `Select all products in ${loc.location_name}` });
const rowOf = (page: Page, p: Prod) => page.locator("tbody tr").filter({ hasText: p.name }).first();
const rowBox = (page: Page, p: Prod) => page.getByRole("checkbox", { name: `Select ${p.name}`, exact: true }).first();
const selectedText = (page: Page) => page.getByText(/\d+ items? selected/i).first();
const createPr = (page: Page) => page.getByRole("button", { name: /^Create PR$/ });
const createSr = (page: Page) => page.getByRole("button", { name: /^Create SR$/ });

async function openPage(page: Page) {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(PATH);
  await expect(heading(page)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: /Expand all|Collapse all/i })).toBeVisible({ timeout: 15_000 });
}
async function expandAll(page: Page) {
  const b = page.getByRole("button", { name: /^Expand all$/i });
  if ((await b.count()) > 0) await b.click();
  await expect(page.getByRole("button", { name: /^Collapse all$/i })).toBeVisible();
}
async function pickFirstOption(page: Page, dialog: Locator, index: number) {
  await dialog.getByRole("combobox").nth(index).click();
  const opt = page.getByRole("option").first();
  await expect(opt).toBeVisible({ timeout: 10_000 });
  await opt.click();
}
const fromLocationTrigger = (dialog: Locator) => dialog.getByRole("button", { name: /Select Location/i });
async function pickFromLocation(page: Page, dialog: Locator) {
  await fromLocationTrigger(dialog).click();
  const opt = page.locator("button[data-value]").first();
  await expect(opt).toBeVisible({ timeout: 10_000 });
  await opt.click();
}
const createPost = (page: Page) => page.waitForResponse((r) => r.request().method() === "POST" && /\/stock-replenishments?\//.test(r.url()), { timeout: 90_000 });

/** Cross-BU lists wrap one block per BU: data[0] = TEST BU with its own `paginate.total`. */
async function docCount(path: "/purchase-requests" | "/store-requisitions"): Promise<number> {
  const r = await rootGet("Admin", `${path}?perpage=1&bu_code=${BU_CODE}`);
  expect(r.status, path).toBe(200);
  const block = r.body.data?.find((b: any) => b.bu_code === BU_CODE);
  return (block?.paginate?.total ?? 0) as number;
}
const prCount = () => docCount("/purchase-requests");

test.describe("Stock Replenishment — Store Operations", () => {
  // The first API call per process logs in (retries on a 429 throttle); creating PR/SR takes ~30s.
  test.describe.configure({ timeout: 120_000 });
  test.beforeEach(async ({ page }) => {
    await ensureActiveBu(page, BU_CODE);
  });

  test(
    "TC-SRPL-010001 หน้า Stock Replenishment โหลดสำเร็จ",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (GR2VYNKQ); license store_operations.stock_replenishment" },
        { type: "steps", description: "1. ไปที่ /store-operation/stock-replenishment" },
        { type: "expected", description: "URL ตรงกับ path; หัวข้อและคำอธิบายหน้าแสดง; มีปุ่ม Refresh และช่องค้นหา; แถบสรุปแสดง" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page }) => {
      await openPage(page);
      await expect(page).toHaveURL(new RegExp(PATH));
      await expect(page.getByText(/What is running low, and how much to order/i)).toBeVisible();
      await expect(page.getByRole("button", { name: /^Refresh$/ })).toBeVisible();
      await expect(page.getByPlaceholder(/Search/i).first()).toBeVisible();
      await expect(page.getByText(/\d+ locations/)).toBeVisible();
    },
  );

  test(
    "TC-SRPL-010002 แถบสรุป (locations / items to reorder / critical / warning / low) ตรงกับข้อมูลจาก API",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (GR2VYNKQ); license store_operations.stock_replenishment; GET /stock-replenishments ของ TEST BU มีข้อมูล" },
        { type: "steps", description: "1. ไปที่ /store-operation/stock-replenishment\n2. ตรวจแถบสรุปเหนือรายการ" },
        { type: "expected", description: "จำนวน locations, items to reorder และ badge critical/warning/low เท่ากับที่คำนวณจาก API; badge ที่เป็น 0 ไม่แสดง" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const locs = needLocations(await replenishment(), 1);
      const all = locs.flatMap((l) => l.products_location);
      const n = (s: string) => all.filter((p) => p.status === s).length;
      await openPage(page);
      await expect(page.getByText(`${locs.length} locations`, { exact: true })).toBeVisible();
      const toReorder = all.filter((p) => p.reorder_qty > 0).length;
      await expect(page.getByText(`${toReorder} ${toReorder === 1 ? "item" : "items"} to reorder`, { exact: true })).toBeVisible();
      for (const s of ["critical", "warning", "low"]) {
        const bar = page.locator("div.bg-muted\\/30");
        if (n(s) > 0) await expect(bar.getByText(`${n(s)} ${s}`, { exact: true })).toBeVisible();
        else await expect(bar.getByText(new RegExp(`\\d+ ${s}`))).toHaveCount(0);
      }
    },
  );

  test(
    "TC-SRPL-010003 แถบหัว location แสดง checkbox + รหัส/ชื่อคลัง + badge จำนวนสินค้า",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (GR2VYNKQ); license store_operations.stock_replenishment; GET /stock-replenishments ของ TEST BU มีข้อมูล" },
        { type: "steps", description: "1. ไปที่ /store-operation/stock-replenishment\n2. ตรวจแถบหัวของ location แรก" },
        { type: "expected", description: "มี checkbox 'Select all products in <ชื่อคลัง>', รหัสและชื่อคลัง และ badge '<n> items' ตรงกับ API" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const [loc] = needLocations(await replenishment(), 1);
      await openPage(page);
      const trigger = page.getByRole("button", { name: new RegExp(loc.location_code) }).filter({ hasText: loc.location_name }).first();
      await expect(trigger).toBeVisible();
      await expect(selectAll(page, loc)).toBeVisible();
      const n = loc.products_location.length;
      await expect(trigger).toContainText(`${n} ${n === 1 ? "item" : "items"}`);
    },
  );

  test(
    "TC-SRPL-010004 ขยาย/ยุบ location เดี่ยวได้",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (GR2VYNKQ); license store_operations.stock_replenishment; GET /stock-replenishments ของ TEST BU มีข้อมูล" },
        { type: "steps", description: "1. กดที่หัว location\n2. กดซ้ำ" },
        { type: "expected", description: "ครั้งแรกสถานะ expanded สลับ และตารางสินค้าของ location แสดง/ซ่อน; ครั้งที่สองกลับสภาพเดิม" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const [loc] = needLocations(await replenishment(), 1);
      await openPage(page);
      const trigger = page.getByRole("button", { name: new RegExp(loc.location_code) }).filter({ hasText: loc.location_name }).first();
      const first = loc.products_location[0];
      const was = await trigger.getAttribute("aria-expanded");
      await trigger.click();
      await expect(trigger).toHaveAttribute("aria-expanded", was === "true" ? "false" : "true");
      if (was === "true") await expect(page.getByText(first.name).first()).toBeHidden();
      else await expect(page.getByText(first.name).first()).toBeVisible();
      await trigger.click();
      await expect(trigger).toHaveAttribute("aria-expanded", was ?? "false");
    },
  );

  test(
    "TC-SRPL-010005 ปุ่มสลับ Expand all / Collapse all ทำงาน",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (GR2VYNKQ); license store_operations.stock_replenishment; GET /stock-replenishments ของ TEST BU มีข้อมูล" },
        { type: "steps", description: "1. กดปุ่ม Expand all\n2. กดปุ่มเดิมอีกครั้ง (Collapse all)" },
        { type: "expected", description: "หลัง Expand all ทุก location ขยายและปุ่มกลายเป็น Collapse all; หลังกด Collapse all ทุก location ยุบและปุ่มกลับเป็น Expand all" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const locs = needLocations(await replenishment(), 1);
      await openPage(page);
      await expandAll(page);
      const triggers = page.locator("[aria-expanded]").filter({ hasText: /\d+ items?/ });
      await expect(triggers).toHaveCount(locs.length);
      for (const t of await triggers.all()) await expect(t).toHaveAttribute("aria-expanded", "true");
      await page.getByRole("button", { name: /^Collapse all$/i }).click();
      await expect(page.getByRole("button", { name: /^Expand all$/i })).toBeVisible();
      for (const t of await triggers.all()) await expect(t).toHaveAttribute("aria-expanded", "false");
    },
  );

  test(
    "TC-SRPL-010006 คอลัมน์ตารางสินค้า (select/#/Product/Stock level/Reorder/Status) แสดงครบ",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (GR2VYNKQ); license store_operations.stock_replenishment; GET /stock-replenishments ของ TEST BU มีข้อมูล; viewport 1920x1080" },
        { type: "steps", description: "1. ไปที่ /store-operation/stock-replenishment\n2. กด Expand all\n3. ตรวจหัวตารางของ location แรก" },
        { type: "expected", description: "หัวตารางมีคอลัมน์ #, Product, Stock level, Reorder Qty, Status และแถวแสดงชื่อสินค้า" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const [loc] = needLocations(await replenishment(), 1);
      await openPage(page);
      await expandAll(page);
      const table = page.getByRole("table").first();
      for (const h of [/^#$/, /Product/i, /Stock level/i, /Reorder/i, /Status/i]) {
        await expect(table.getByRole("columnheader", { name: h })).toBeVisible();
      }
      await expect(table).toContainText(loc.products_location[0].name);
    },
  );

  test(
    "TC-SRPL-010007 ค้นหาด้วยชื่อ/รหัส/ชื่อท้องถิ่น/หมวด/กลุ่มสินค้า กรอง location และสินค้าที่ตรง",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (GR2VYNKQ); license store_operations.stock_replenishment; GET /stock-replenishments ของ TEST BU มีข้อมูล" },
        { type: "steps", description: "1. พิมพ์รหัสสินค้าชิ้นแรกในช่อง Search\n2. กด Enter" },
        { type: "expected", description: "แสดงเฉพาะ location ที่มีสินค้าตรงรหัสนั้น และสินค้าอื่นหายไป; ตัวนับ locations ตรงกับ API" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const locs = needLocations(await replenishment(), 1);
      const target = locs[0].products_location[0];
      await openPage(page);
      const input = page.getByPlaceholder(/Search/i).first();
      await input.fill(target.code);
      await input.press("Enter");
      const matching = locs.filter((l) => l.products_location.some((p) => p.code.toLowerCase().includes(target.code.toLowerCase() )));
      await expect(page.getByText(`${matching.length} locations`, { exact: true })).toBeVisible();
      await expandAll(page);
      await expect(rowOf(page, target)).toBeVisible();
      const other = locs.flatMap((l) => l.products_location).find((p) => !p.code.toLowerCase().includes(target.code.toLowerCase()) && p.name !== target.name);
      if (other) await expect(page.locator("tbody tr").filter({ hasText: other.name })).toHaveCount(0);
    },
  );

  test(
    "TC-SRPL-010008 ค้นหาคำที่ไม่มีต้องไม่แสดง location ใด ๆ",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (GR2VYNKQ); license store_operations.stock_replenishment; GET /stock-replenishments ของ TEST BU มีข้อมูล" },
        { type: "steps", description: "1. พิมพ์คำค้นที่ไม่มีในระบบแล้วกด Enter" },
        { type: "expected", description: "ไม่แสดง location ใด ๆ; แสดง empty state 'No products match' พร้อมปุ่ม Clear search" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      needLocations(await replenishment(), 1);
      await openPage(page);
      const input = page.getByPlaceholder(/Search/i).first();
      await input.fill("NONEXISTENT_PRODUCT_CODE_99999");
      await input.press("Enter");
      await expect(page.getByText(/No products match/i)).toContainText("NONEXISTENT_PRODUCT_CODE_99999");
      await expect(page.getByText("0 locations", { exact: true })).toBeVisible();
      await expect(page.locator("tbody tr")).toHaveCount(0);
    },
  );

  test(
    "TC-SRPL-010009 ปุ่ม Refresh ยิง request โหลดข้อมูลใหม่",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (GR2VYNKQ); license store_operations.stock_replenishment" },
        { type: "steps", description: "1. กดปุ่ม Refresh บน toolbar" },
        { type: "expected", description: "ยิง GET /stock-replenishments ซ้ำอีกหนึ่งครั้ง และหน้ายังแสดงข้อมูลเดิม" },
        { type: "priority", description: "Low" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      await openPage(page);
      const again = page.waitForResponse((r) => /\/api\/[^/]+\/stock-replenishments/.test(r.url()) && r.request().method() === "GET");
      await page.getByRole("button", { name: /^Refresh$/ }).click();
      expect((await again).status()).toBe(200);
      await expect(page.getByText(/\d+ locations/)).toBeVisible();
    },
  );

  test(
    "TC-SRPL-010010 ล้างคำค้นด้วยปุ่ม Clear search แล้วรายการกลับมาครบ",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (GR2VYNKQ); license store_operations.stock_replenishment; GET /stock-replenishments ของ TEST BU มีข้อมูล" },
        { type: "steps", description: "1. ค้นคำที่ไม่มีในระบบ\n2. กดปุ่ม Clear search" },
        { type: "expected", description: "ช่องค้นว่างและจำนวน locations กลับมาเท่ากับ API" },
        { type: "priority", description: "Low" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const locs = needLocations(await replenishment(), 1);
      await openPage(page);
      const input = page.getByPlaceholder(/Search/i).first();
      await input.fill("NONEXISTENT_PRODUCT_CODE_99999");
      await input.press("Enter");
      await expect(page.getByText("0 locations", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: /clear search/i }).last().click();
      await expect(input).toHaveValue("");
      await expect(page.getByText(`${locs.length} locations`, { exact: true })).toBeVisible();
    },
  );

  test(
    "TC-SRPL-010050 request ของหน้านี้ไปที่ BU ที่ active (TEST BU)",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (GR2VYNKQ); license store_operations.stock_replenishment" },
        { type: "steps", description: "1. ไปที่ /store-operation/stock-replenishment\n2. ตรวจ URL ของ request" },
        { type: "expected", description: "ยิง GET /api/GR2VYNKQ/stock-replenishments สำเร็จ (200)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page }) => {
      const resp = page.waitForResponse((r) => /\/api\/[^/]+\/stock-replenishments/.test(r.url()) && r.request().method() === "GET");
      await page.goto(PATH);
      const r = await resp;
      expect(r.url()).toContain(`/api/${BU_CODE}/stock-replenishments`);
      expect(r.status()).toBe(200);
    },
  );

  test(
    "TC-SRPL-020001 สถานะสินค้า (Critical/Warning/Low) ในแถวตรงกับ status จาก API",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (GR2VYNKQ); license store_operations.stock_replenishment; GET /stock-replenishments ของ TEST BU มีข้อมูล; viewport 1920x1080" },
        { type: "steps", description: "1. ไปที่หน้า และกด Expand all\n2. ตรวจคอลัมน์ Status ของสินค้าแต่ละสถานะ" },
        { type: "expected", description: "แถวของสินค้า status=critical/warning/low แสดงป้ายสถานะ Critical/Warning/Low ตามลำดับ" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const locs = needLocations(await replenishment(), 1);
      const all = locs.flatMap((l) => l.products_location);
      await openPage(page);
      await expandAll(page);
      let checked = 0;
      for (const s of ["critical", "warning", "low"] as const) {
        const p = all.find((x) => x.status === s);
        if (!p) continue;
        await expect(rowOf(page, p).getByRole("cell").last()).toHaveText(new RegExp(`^${s}$`, "i"));
        checked++;
      }
      expect(checked, "at least one status present in the seed data").toBeGreaterThan(0);
    },
  );

  test(
    "TC-SRPL-020002 คอลัมน์ Reorder แสดง reorder_qty ของสินค้าตรงกับ API",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (GR2VYNKQ); license store_operations.stock_replenishment; GET /stock-replenishments ของ TEST BU มีข้อมูล; viewport 1920x1080" },
        { type: "steps", description: "1. ไปที่หน้า และกด Expand all\n2. ตรวจคอลัมน์ Reorder Qty ของสินค้าแรก" },
        { type: "expected", description: "เซลล์ Reorder ของสินค้าแสดงค่า reorder_qty เดียวกับ API" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const [loc] = needLocations(await replenishment(), 1);
      const p = loc.products_location.find((x) => x.reorder_qty > 0) ?? loc.products_location[0];
      await openPage(page);
      await expandAll(page);
      await expect(rowOf(page, p).getByRole("cell").nth(-2)).toHaveText(p.reorder_qty.toLocaleString("en-US"));
    },
  );

  test(
    "TC-SRPL-020003 คอลัมน์ Product แสดงชื่อท้องถิ่นเป็นบรรทัดรอง",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (GR2VYNKQ); license store_operations.stock_replenishment; GET /stock-replenishments ของ TEST BU มีข้อมูล; มีสินค้าที่มี local_name" },
        { type: "steps", description: "1. ไปที่หน้า และกด Expand all\n2. ตรวจเซลล์สินค้าที่มีชื่อท้องถิ่น" },
        { type: "expected", description: "เซลล์สินค้าแสดงชื่อหลักและชื่อท้องถิ่นในเซลล์เดียวกัน" },
        { type: "priority", description: "Low" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const locs = needLocations(await replenishment(), 1);
      const p = locs.flatMap((l) => l.products_location).find((x) => x.local_name);
      test.skip(!p, "no replenishment product with local_name in TEST BU (API-checked)");
      await openPage(page);
      await expandAll(page);
      const row = rowOf(page, p!);
      await expect(row).toContainText(p!.name);
      await expect(row).toContainText(p!.local_name!);
    },
  );

  test(
    "TC-SRPL-060001 เลือกสินค้าในแถวเดียวด้วย checkbox ได้",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (GR2VYNKQ); license store_operations.stock_replenishment; GET /stock-replenishments ของ TEST BU มีข้อมูล" },
        { type: "steps", description: "1. กด Expand all\n2. ติ๊ก checkbox ของสินค้าแรก" },
        { type: "expected", description: "checkbox ถูกเลือก; แถบล่างแสดง '1 item selected' พร้อมปุ่ม Create SR และ Create PR" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const [loc] = needLocations(await replenishment(), 1);
      const p = loc.products_location[0];
      await openPage(page);
      await expandAll(page);
      await rowBox(page, p).click();
      await expect(rowBox(page, p)).toBeChecked();
      await expect(selectedText(page)).toHaveText(/^1 item selected$/);
      await expect(createPr(page)).toBeVisible();
      await expect(createSr(page)).toBeVisible();
    },
  );

  test(
    "TC-SRPL-060002 เลือกทั้งหมดใน location ด้วย checkbox บนแถบหัว location",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (GR2VYNKQ); license store_operations.stock_replenishment; GET /stock-replenishments ของ TEST BU มีข้อมูล" },
        { type: "steps", description: "1. ติ๊ก checkbox บนแถบหัว location แรก" },
        { type: "expected", description: "สินค้าทุกชิ้นใน location ถูกเลือก; ตัวนับเท่ากับจำนวนสินค้าของ location" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const [loc] = needLocations(await replenishment(), 1);
      await openPage(page);
      await selectAll(page, loc).click();
      const n = loc.products_location.length;
      await expect(selectedText(page)).toHaveText(`${n} ${n === 1 ? "item" : "items"} selected`);
      await expect(selectAll(page, loc)).toBeChecked();
      await expandAll(page);
      for (const p of loc.products_location) await expect(rowBox(page, p)).toBeChecked();
    },
  );

  test(
    "TC-SRPL-060003 checkbox แถบหัว location แสดงสถานะ indeterminate เมื่อเลือกบางส่วน",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (GR2VYNKQ); license store_operations.stock_replenishment; GET /stock-replenishments ของ TEST BU มีข้อมูล; location แรกมีสินค้า >= 2" },
        { type: "steps", description: "1. กด Expand all\n2. ติ๊กสินค้าเพียงชิ้นเดียวใน location" },
        { type: "expected", description: "checkbox บนแถบหัว location เป็น mixed (aria-checked='mixed')" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const [loc] = needLocations(await replenishment(), 1, 2);
      await openPage(page);
      await expandAll(page);
      await rowBox(page, loc.products_location[0]).click();
      await expect(selectAll(page, loc)).toHaveAttribute("aria-checked", "mixed");
    },
  );

  test(
    "TC-SRPL-060004 เลือกข้ามหลาย location แล้วตัวนับรวมถูกต้อง",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (GR2VYNKQ); license store_operations.stock_replenishment; GET /stock-replenishments ของ TEST BU มีข้อมูล; มีอย่างน้อย 2 location" },
        { type: "steps", description: "1. ติ๊ก checkbox หัว location ที่ 1 และที่ 2" },
        { type: "expected", description: "ตัวนับรวมเท่ากับจำนวนสินค้าของสอง location รวมกัน" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const [a, b] = needLocations(await replenishment(), 2);
      await openPage(page);
      await selectAll(page, a).click();
      await selectAll(page, b).click();
      const n = a.products_location.length + b.products_location.length;
      await expect(selectedText(page)).toHaveText(`${n} items selected`);
    },
  );

  test(
    "TC-SRPL-060005 แถบ action ล่างแสดงปุ่ม Create PR / Create SR และจำนวนที่เลือกเมื่อมีการเลือก",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (GR2VYNKQ); license store_operations.stock_replenishment; GET /stock-replenishments ของ TEST BU มีข้อมูล" },
        { type: "steps", description: "1. ยังไม่เลือกอะไร ตรวจแถบ\n2. ติ๊กเลือกสินค้า 1 รายการ" },
        { type: "expected", description: "ก่อนเลือกไม่มีปุ่ม Create PR/SR; หลังเลือกมีปุ่มทั้งสองและข้อความ '1 item selected'" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const [loc] = needLocations(await replenishment(), 1);
      await openPage(page);
      await expect(createPr(page)).toHaveCount(0);
      await expect(createSr(page)).toHaveCount(0);
      await expandAll(page);
      await rowBox(page, loc.products_location[0]).click();
      await expect(createPr(page)).toBeVisible();
      await expect(createSr(page)).toBeVisible();
      await expect(selectedText(page)).toHaveText(/^1 item selected$/);
    },
  );

  test(
    "TC-SRPL-060006 ยกเลิกการเลือกทั้งหมดแล้วปุ่ม Create PR/SR หายไป",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (GR2VYNKQ); license store_operations.stock_replenishment; GET /stock-replenishments ของ TEST BU มีข้อมูล" },
        { type: "steps", description: "1. ติ๊กสินค้า\n2. ติ๊กออกอีกครั้ง" },
        { type: "expected", description: "แถบ action และปุ่ม Create PR/SR หายไป" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const [loc] = needLocations(await replenishment(), 1);
      const p = loc.products_location[0];
      await openPage(page);
      await expandAll(page);
      await rowBox(page, p).click();
      await expect(createPr(page)).toBeVisible();
      await rowBox(page, p).click();
      await expect(createPr(page)).toHaveCount(0);
      await expect(createSr(page)).toHaveCount(0);
      await expect(selectedText(page)).toHaveCount(0);
    },
  );

  test(
    "TC-SRPL-060007 กด Create PR เปิด wizard พร้อมตารางรายการที่ติ๊ก",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (GR2VYNKQ); license store_operations.stock_replenishment; GET /stock-replenishments ของ TEST BU มีข้อมูล; role Purchase เริ่ม workflow PR ได้" },
        { type: "steps", description: "1. ติ๊กสินค้า\n2. กดปุ่ม Create PR" },
        { type: "expected", description: "เปิด dialog 'Create Purchase Request' ที่มีแถวของสินค้าที่ติ๊กและช่อง Workflow" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const [loc] = needLocations(await replenishment(), 1);
      const p = loc.products_location[0];
      await openPage(page);
      await expandAll(page);
      await rowBox(page, p).click();
      await createPr(page).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("heading", { name: /Create Purchase Request/i })).toBeVisible();
      await expect(dialog).toContainText(p.name);
      await expect(dialog).toContainText(/Workflow/i);
      await expect(dialog).toContainText("1 item");
    },
  );

  test(
    "TC-SRPL-060008 ปุ่ม Create ใน PR wizard ปิดจนกว่าจะเลือก workflow",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (GR2VYNKQ); license store_operations.stock_replenishment; GET /stock-replenishments ของ TEST BU มีข้อมูล" },
        { type: "steps", description: "1. เปิด PR wizard โดยยังไม่เลือก workflow\n2. เลือก workflow" },
        { type: "expected", description: "ก่อนเลือก workflow ปุ่ม Create ถูก disable; หลังเลือกปุ่ม Create enable" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Validation" },
      ],
    },
    async ({ page }) => {
      const [loc] = needLocations(await replenishment(), 1);
      await openPage(page);
      await expandAll(page);
      await rowBox(page, loc.products_location[0]).click();
      await createPr(page).click();
      const dialog = page.getByRole("dialog");
      const create = dialog.getByRole("button", { name: /^Create$/ });
      await expect(create).toBeDisabled();
      await pickFirstOption(page, dialog, 0);
      await expect(create).toBeEnabled();
    },
  );

  test(
    "TC-SRPL-060009 ตัดแถวออกจาก PR wizard ด้วยปุ่มถังขยะ",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (GR2VYNKQ); license store_operations.stock_replenishment; GET /stock-replenishments ของ TEST BU มีข้อมูล; location แรกมีสินค้า >= 2" },
        { type: "steps", description: "1. ติ๊กสินค้า 2 ชิ้นใน location\n2. เปิด PR wizard\n3. กดถังขยะของแถวแรก" },
        { type: "expected", description: "dialog แสดง '2 items' ก่อนลบ; หลังลบเหลือ '1 item' และสินค้าที่ลบหายจาก dialog" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const [loc] = needLocations(await replenishment(), 1, 2);
      const [p1, p2] = loc.products_location;
      await openPage(page);
      await expandAll(page);
      await rowBox(page, p1).click();
      await rowBox(page, p2).click();
      await createPr(page).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toContainText("2 items");
      await dialog.getByRole("button", { name: /^Delete$/ }).first().click();
      await expect(dialog).toContainText("1 item");
      await expect(dialog).not.toContainText("2 items");
    },
  );

  test(
    "TC-SRPL-060010 กด Create SR (ติ๊กคลังเดียว) เปิด wizard พร้อม Workflow / Request From / Deliver To",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (GR2VYNKQ); license store_operations.stock_replenishment; GET /stock-replenishments ของ TEST BU มีข้อมูล; role Purchase เริ่ม workflow SR ได้" },
        { type: "steps", description: "1. ติ๊กสินค้าจาก location เดียว\n2. กดปุ่ม Create SR" },
        { type: "expected", description: "เปิด dialog 'Create Store Requisition' มีฟิลด์ Workflow, Request From, Deliver To และแถวสินค้าที่ติ๊ก" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const [loc] = needLocations(await replenishment(), 1);
      const p = loc.products_location[0];
      await openPage(page);
      await expandAll(page);
      await rowBox(page, p).click();
      await createSr(page).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("heading", { name: /Create Store Requisition/i })).toBeVisible();
      for (const f of [/Workflow/i, /Request From/i, /Deliver To/i]) await expect(dialog).toContainText(f);
      await expect(dialog).toContainText(p.name);
      await expect(dialog).toContainText(loc.location_name);
    },
  );

  test(
    "TC-SRPL-060011 ช่อง Request From ของ SR wizard ไม่มีคลังปลายทางให้เลือก",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (GR2VYNKQ); license store_operations.stock_replenishment; GET /stock-replenishments ของ TEST BU มีข้อมูล; มีอย่างน้อย 2 location" },
        { type: "steps", description: "1. ติ๊กสินค้าของ location ที่ 1\n2. เปิด SR wizard\n3. เปิด dropdown Request From" },
        { type: "expected", description: "ตัวเลือกใน Request From ไม่มีชื่อ location ที่ 1 (ปลายทาง)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const [loc] = needLocations(await replenishment(), 1);
      await openPage(page);
      await selectAll(page, loc).click();
      await createSr(page).click();
      const dialog = page.getByRole("dialog");
      await fromLocationTrigger(dialog).click();
      const options = page.locator("button[data-value]");
      await expect(options.first()).toBeVisible({ timeout: 10_000 });
      expect(await options.count()).toBeGreaterThan(1);
      // match on the code: another (direct) location carries the same name
      await expect(options.filter({ hasText: loc.location_code })).toHaveCount(0);
    },
  );

  test(
    "TC-SRPL-060012 ปิด wizard ด้วย Cancel แล้วไม่มีเอกสารเกิดขึ้นและรายการที่ติ๊กยังอยู่",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (GR2VYNKQ); license store_operations.stock_replenishment; GET /stock-replenishments ของ TEST BU มีข้อมูล" },
        { type: "steps", description: "1. ติ๊กสินค้า\n2. กด Create PR แล้วกด Cancel" },
        { type: "expected", description: "dialog ปิด; จำนวน PR ใน BU ไม่เปลี่ยน (API); ตัวนับยังเป็น '1 item selected'" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const [loc] = needLocations(await replenishment(), 1);
      const before = await prCount();
      await openPage(page);
      await expandAll(page);
      await rowBox(page, loc.products_location[0]).click();
      await createPr(page).click();
      await page.getByRole("dialog").getByRole("button", { name: /^Cancel$/ }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(selectedText(page)).toHaveText(/^1 item selected$/);
      expect(await prCount()).toBe(before);
    },
  );

  requestorTest(
    "TC-SRPL-100001 ผู้ใช้ที่ไม่มีสิทธิ์ stock_in.view เปิด URL ตรง ๆ ต้องเจอ Permission Denied",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Requestor (ไม่มี inventory_management.stock_in ใน /api/user/profile)" },
        { type: "steps", description: "1. เปิด /store-operation/stock-replenishment โดยตรง" },
        { type: "expected", description: "แสดง Permission Denied และไม่แสดงรายการ location" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Authorization" },
      ],
    },
    async ({ page }) => {
      await page.goto(PATH);
      await expect(page.getByText(/permission denied/i).first()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole("button", { name: /^Refresh$/ })).toHaveCount(0);
    },
  );

  test(
    "TC-SRPL-100002 ผู้ที่ไม่ได้ login เข้าหน้าตรง ๆ ต้องถูก redirect ไป /login",
    {
      annotation: [
        { type: "preconditions", description: "ไม่มี session" },
        { type: "steps", description: "1. เปิด /store-operation/stock-replenishment ใน browser context ใหม่" },
        { type: "expected", description: "ถูก redirect ไปยัง /login และไม่มีรายการ location บนจอ" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Auth-guard" },
      ],
    },
    async ({ browser }) => {
      const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
      const page = await ctx.newPage();
      await page.goto(PATH);
      await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
      await expect(page.getByRole("button", { name: /^Refresh$/ })).toHaveCount(0);
      await ctx.close();
    },
  );

  adminTest(
    "TC-SRPL-100003 Admin เข้าหน้าได้ (Admin ผ่านการเช็ก permission)",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Admin (ผ่านการเช็ก permission); active BU = TEST BU" },
        { type: "steps", description: "1. ไปที่ /store-operation/stock-replenishment" },
        { type: "expected", description: "เข้าหน้าสำเร็จ: หัวข้อ, ปุ่ม Refresh และข้อมูล location แสดง ไม่มี Permission Denied" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Authorization" },
      ],
    },
    async ({ page }) => {
      await openPage(page);
      await expect(page.getByText(/permission denied/i)).toHaveCount(0);
      await expect(page.getByText(/\d+ locations/)).toBeVisible();
    },
  );

  test(
    "TC-SRPL-300001 Create PR สร้างใบขอซื้อจากรายการที่เลือกได้สำเร็จ",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (GR2VYNKQ); license store_operations.stock_replenishment; GET /stock-replenishments ของ TEST BU มีข้อมูล; Purchase เริ่ม workflow PR ได้ (สร้าง PR จริงใน TEST BU)" },
        { type: "steps", description: "1. ติ๊กสินค้า 1 ชิ้น\n2. เปิด PR wizard เลือก workflow\n3. กด Create" },
        { type: "expected", description: "toast 'Created 1 purchase request(s)'; dialog ปิด; จำนวน PR ใน BU เพิ่มขึ้น 1 (API); ตัวนับที่เลือกถูกล้าง" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Integration" },
      ],
    },
    async ({ page }) => {
      const [loc] = needLocations(await replenishment(), 1);
      const before = await prCount();
      await openPage(page);
      await expandAll(page);
      await rowBox(page, loc.products_location[0]).click();
      await createPr(page).click();
      const dialog = page.getByRole("dialog");
      await pickFirstOption(page, dialog, 0);
      const posted = createPost(page);
      await dialog.getByRole("button", { name: /^Create$/ }).click();
      const res = await posted;
      test.fail(true, "suspected bug: FE/BE contract mismatch on both mains — POST /stock-replenishments/pr answers 400 'products.0.location_id: expected string, received undefined'; FE main (carmen-frontend routes/store-operation/stock-replenishment/use-stock-replenishment.ts:64-75 CreateStockReplPrDto) sends location_id at the top level, BE main (carmen-turborepo-backend apps/backend-gateway/src/common/dto/stock-replenishment/stock-replenishment.dto.ts:30, since 400fff4a9 2026-08-24 'ย้าย location ไปอยู่ที่บรรทัด') requires products[].location_id; cluster: fe-be-contract");
      expect(res.status(), await res.text()).toBeLessThan(300);
      await expect(page.getByText(/Created 1 purchase request/i)).toBeVisible();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(selectedText(page)).toHaveCount(0);
      expect(await prCount()).toBe(before + 1);
    },
  );

  test(
    "TC-SRPL-300002 Create SR สร้างใบเบิกจากรายการที่เลือกได้สำเร็จ",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (GR2VYNKQ); license store_operations.stock_replenishment; GET /stock-replenishments ของ TEST BU มีข้อมูล; มีอย่างน้อย 2 location (ต้นทาง/ปลายทาง); Purchase เริ่ม workflow SR ได้ (สร้าง SR จริงใน TEST BU)" },
        { type: "steps", description: "1. ติ๊กสินค้า 1 ชิ้น\n2. เปิด SR wizard เลือก workflow และ Request From\n3. กด Create" },
        { type: "expected", description: "toast สร้างสำเร็จ; dialog ปิด; จำนวน SR ใน BU เพิ่มขึ้น 1 (API)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Integration" },
      ],
    },
    async ({ page }) => {
      const [loc] = needLocations(await replenishment(), 1);
      const count = () => docCount("/store-requisitions");
      const before = await count();
      await openPage(page);
      await expandAll(page);
      await rowBox(page, loc.products_location[0]).click();
      await createSr(page).click();
      const dialog = page.getByRole("dialog");
      await pickFirstOption(page, dialog, 0);
      await pickFromLocation(page, dialog);
      const posted = createPost(page);
      await dialog.getByRole("button", { name: /^Create$/ }).click();
      const res = await posted;
      test.fail(true, "suspected bug: FE/BE contract mismatch on both mains — POST /stock-replenishments/sr answers 400 'products.0.location_id / products.0.from_location: expected string, received undefined'; FE main (use-stock-replenishment.ts:77-83 CreateStockReplSrDto) sends location_id/from_location at the top level, BE main (stock-replenishment.dto.ts:68-69, since 400fff4a9) requires them per product line; cluster: fe-be-contract");
      expect(res.status(), await res.text()).toBeLessThan(300);
      await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 30_000 });
      await expect(selectedText(page)).toHaveCount(0);
      expect(await count()).toBe(before + 1);
    },
  );

  test(
    "TC-SRPL-300003 ติ๊กข้ามหลายคลังแล้ว Create PR ได้ใบขอซื้อคลังละใบ",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (GR2VYNKQ); license store_operations.stock_replenishment; GET /stock-replenishments ของ TEST BU มีข้อมูล; มีอย่างน้อย 2 location; Purchase เริ่ม workflow PR ได้ (สร้าง PR จริงใน TEST BU)" },
        { type: "steps", description: "1. ติ๊กสินค้า 1 ชิ้นจากแต่ละ location (2 คลัง)\n2. เปิด PR wizard เลือก workflow\n3. กด Create" },
        { type: "expected", description: "wizard บอก '2 purchase requests will be created'; หลังกด Create จำนวน PR ใน BU เพิ่มขึ้น 2 (API)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Integration" },
      ],
    },
    async ({ page }) => {
      const [a, b] = needLocations(await replenishment(), 2);
      const before = await prCount();
      await openPage(page);
      await expandAll(page);
      await rowBox(page, a.products_location[0]).click();
      await rowBox(page, b.products_location[0]).click();
      await createPr(page).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toContainText(/2 purchase requests will be created/i);
      await pickFirstOption(page, dialog, 0);
      const posted = createPost(page);
      await dialog.getByRole("button", { name: /^Create$/ }).click();
      const res = await posted;
      test.fail(true, "suspected bug: FE/BE contract mismatch on both mains — POST /stock-replenishments/pr answers 400 'products.0.location_id: expected string, received undefined'; FE main (carmen-frontend routes/store-operation/stock-replenishment/use-stock-replenishment.ts:64-75 CreateStockReplPrDto) sends location_id at the top level, BE main (carmen-turborepo-backend apps/backend-gateway/src/common/dto/stock-replenishment/stock-replenishment.dto.ts:30, since 400fff4a9 2026-08-24 'ย้าย location ไปอยู่ที่บรรทัด') requires products[].location_id; cluster: fe-be-contract");
      expect(res.status(), await res.text()).toBeLessThan(300);
      await expect(page.getByText(/Created 2 purchase request/i)).toBeVisible({ timeout: 10_000 });
      expect(await prCount()).toBe(before + 2);
    },
  );

  test(
    "TC-SRPL-900001 กรณีไม่มีสินค้าต้องเติม แสดง empty state",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (GR2VYNKQ); license store_operations.stock_replenishment; endpoint ถูก mock ให้ตอบ data=[]" },
        { type: "steps", description: "1. ไปที่ /store-operation/stock-replenishment" },
        { type: "expected", description: "แสดง 'Every location is within its stock levels' และไม่มีแถบสรุป/ตาราง" },
        { type: "priority", description: "Low" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      await page.route(API, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [], success: true }) }));
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto(PATH);
      await expect(page.getByText("Every location is within its stock levels")).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(/\d+ locations/)).toHaveCount(0);
      await expect(page.getByRole("table")).toHaveCount(0);
    },
  );

  test(
    "TC-SRPL-900002 กด Create SR ขณะติ๊กข้าม 2 คลังขึ้นไป ต้องเตือนว่าใบเบิกทำได้ทีละคลัง",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (GR2VYNKQ); license store_operations.stock_replenishment; GET /stock-replenishments ของ TEST BU มีข้อมูล; มีอย่างน้อย 2 location" },
        { type: "steps", description: "1. ติ๊กหัว location ที่ 1 และที่ 2\n2. กดปุ่ม Create SR" },
        { type: "expected", description: "แสดง dialog 'One location per requisition' และไม่เปิด SR wizard" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      const [a, b] = needLocations(await replenishment(), 2);
      await openPage(page);
      await selectAll(page, a).click();
      await selectAll(page, b).click();
      await createSr(page).click();
      await expect(page.getByRole("dialog").getByText(/One location per requisition/i)).toBeVisible();
      await expect(page.getByRole("heading", { name: /Create Store Requisition/i })).toHaveCount(0);
    },
  );

  adminTest(
    "TC-SRPL-900003 บัญชีที่เริ่ม workflow PR/SR ไม่ได้ กด Create PR/SR แล้วเด้ง Permission Denied",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Admin (GET /workflows/type/purchase_request และ store_requisition ตอบ can_create=false); TEST BU มีสินค้าในรายการ" },
        { type: "steps", description: "1. ติ๊กสินค้า 1 ชิ้น\n2. กดปุ่ม Create PR (ปุ่มจางแต่ยังกดได้)\n3. ปิด dialog แล้วกด Create SR" },
        { type: "expected", description: "ทั้งสองปุ่มแสดง dialog Permission Denied และไม่เปิด wizard" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      for (const t of ["purchase_request", "store_requisition"]) {
        const wf = await buGet("Admin", `/workflows/type/${t}`);
        expect(wf.body.data.every((w: { can_create?: boolean }) => w.can_create === false), `Admin can_create for ${t}`).toBe(true);
      }
      const [loc] = needLocations(await replenishment(), 1);
      await openPage(page);
      await expandAll(page);
      await rowBox(page, loc.products_location[0]).click();
      for (const btn of [createPr(page), createSr(page)]) {
        await expect(btn).toHaveAttribute("aria-disabled", "true");
        await btn.click({ force: true });
        await expect(page.getByText(/permission denied/i).first()).toBeVisible();
        await expect(page.getByRole("heading", { name: /Create (Purchase Request|Store Requisition)/i })).toHaveCount(0);
        await page.keyboard.press("Escape");
        await expect(page.getByText(/permission denied/i)).toHaveCount(0);
      }
    },
  );

  test(
    "TC-SRPL-900004 โหลดข้อมูลล้มเหลวต้องแสดง error state พร้อมปุ่ม Try again",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (GR2VYNKQ); license store_operations.stock_replenishment" },
        { type: "steps", description: "1. ตั้ง route intercept ตอบ 500 สำหรับ endpoint stock-replenishments\n2. ไปที่หน้านี้\n3. ปลด intercept แล้วกด Try again" },
        { type: "expected", description: "แสดง ErrorState พร้อมปุ่ม Try again; กดลองใหม่แล้วข้อมูลกลับมา" },
        { type: "priority", description: "Low" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      await page.route(API, (route) =>
        route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "Simulated Internal Server Error" }) }),
      );
      await page.goto(PATH);
      const retry = page.getByRole("button", { name: /Try again|Retry/i }).first();
      await expect(retry).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(/\d+ locations/)).toHaveCount(0);
      await page.unroute(API);
      await retry.click();
      await expect(heading(page)).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(/\d+ locations/)).toBeVisible({ timeout: 15_000 });
    },
  );
});
