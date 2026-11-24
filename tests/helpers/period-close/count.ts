import { expect, type Page } from "@playwright/test";
import { btn, lastToast } from "../movement/ui";
import { BU, SCHEMA, gotoInBu, review, shot, sql } from "./context";
import { PERIOD } from "./scenarios";

/**
 * ยอดที่ขั้น review ของใบนับใช้เทียบ = SUM(qty) ของ tb_inventory_transaction_detail ต่อคลัง+สินค้า
 * (physical-count.service reviewItems) — ไม่กรองงวด รายการงวดหลังจึงปนมาด้วย (ข้อค้นพบ 2.7-onhand)
 */
export function reviewOnHand(locationCode: string): Record<string, number> {
  // ยอดที่ใบนับแสดง (หลัง PR #705): สินค้าที่ผูกกับคลัง ∪ ยอดของงวดไม่เป็นศูนย์ · ยอด = SUM(in − out) ของ cost layer
  // ที่ยังไม่ถูกลบและประทับงวดที่นับ — กติกาเดียวกับ physical-count.service (location-on-hand.helper)
  const rows = sql(`
    with l as (select id from ${SCHEMA}.tb_location where code = '${locationCode}'),
    stock as (
      select cl.product_id, sum(cl.in_qty - cl.out_qty) q from ${SCHEMA}.tb_inventory_transaction_cost_layer cl
      where cl.location_id = (select id from l) and cl.deleted_at is null and cl.at_period = '${PERIOD}' group by 1),
    sheet as (
      select pl.product_id from ${SCHEMA}.tb_product_location pl where pl.location_id = (select id from l) and pl.deleted_at is null
      union select product_id from stock where q <> 0)
    select p.code prod, coalesce(stock.q, 0) q
    from sheet join ${SCHEMA}.tb_product p on p.id = sheet.product_id
    left join stock on stock.product_id = sheet.product_id`);
  return Object.fromEntries(rows.map((r) => [r.prod, Number(r.q)]));
}

export async function locationStatus(code: string) {
  const r = await review(BU);
  return r.details.physical_count.find((l: { code: string }) => l.code === code);
}

/**
 * นับหนึ่งคลังผ่านหน้าจอครบวงจร: การ์ดคลังในหน้า review → entry (พิมพ์ยอดทีละสินค้าผ่านช่องค้นหา)
 * → Submit for Review → หน้า review ของใบ → Submit
 * คืน path รูปที่ถ่าย (entry, review) — ถ้าคลังนั้นนับเสร็จแล้วจะไม่ทำซ้ำ
 */
export async function countLocation(page: Page, id: string, code: string, counts: Record<string, number>) {
  const images: string[] = [];
  const before = await locationStatus(code);
  if (before?.physical_count_status === "completed") return { images, skipped: true, physicalCountId: before.physical_count_id };

  await gotoInBu(page, "/inventory-management/period-end/review");
  const card = page
    .locator("div")
    .filter({ has: page.getByText(code, { exact: true }) })
    .filter({ has: page.getByRole("button") })
    .last();
  await card.getByRole("button").first().click();
  await page.waitForURL(/\/physical-count\/[0-9a-f-]{36}\/entry/, { timeout: 60_000 });
  const physicalCountId = page.url().match(/physical-count\/([0-9a-f-]{36})/)![1];

  const search = page.getByPlaceholder(/search/i).first();
  const codes = Object.keys(counts);
  const nameOf = Object.fromEntries(
    (codes.length ? sql(`select code, name from ${SCHEMA}.tb_product where code in (${codes.map((c) => `'${c}'`).join(",")})`) : []).map((r) => [r.code, r.name]),
  );
  for (const [prod, qty] of Object.entries(counts)) {
    await search.fill(prod);
    await page.waitForTimeout(600); // debounce ของช่องค้นหา 200ms + virtualizer
    // รอให้ผลค้นหากรองเสร็จ — AVG 2609 คลัง 1FO02: 600ms ยังไม่พอ เลขไปลงช่องของสินค้าตัวอื่น
    // ค้นด้วยรหัสอาจเจอหลายใบ (รหัสสั้นอาจไปตรงกับรหัสอื่นที่มีรหัสนี้เป็นส่วนหนึ่ง) → เลือกการ์ดที่ชื่อสินค้าตรงเป๊ะ
    const visible = page.locator("input[type=number]:visible");
    const card = page
      .locator("div")
      .filter({ has: page.getByText(nameOf[prod] ?? prod, { exact: true }) })
      .filter({ has: visible })
      .last();
    await expect
      .poll(async () => ((await visible.count()) === 1 ? 1 : await card.count()), { timeout: 15_000, message: `ค้น ${prod} ต้องเจอการ์ดของสินค้านี้` })
      .toBeGreaterThan(0);
    const input = (await visible.count()) === 1 ? visible.first() : card.locator("input[type=number]").first();
    await expect(input).toBeVisible();
    await input.fill(String(qty));
    await input.press("Enter");
    await page.waitForTimeout(300);
  }
  if (Object.keys(counts).length) {
    await search.fill("");
    await page.waitForTimeout(600);
  }
  images.push(await shot(page, id, `a-entry-${code}`));

  await btn(page, "Submit for Review").click();
  await page.waitForURL(/\/physical-count\/[0-9a-f-]{36}\/review/, { timeout: 60_000 });
  await page.waitForTimeout(1500);
  images.push(await shot(page, id, `b-review-${code}`));

  const submitted = page.waitForResponse(
    (r) => /\/physical-counts\/[0-9a-f-]{36}\/submit/.test(r.url()) && r.request().method() !== "GET",
    { timeout: 120_000 },
  );
  await btn(page, "Submit").last().click();
  const dlg = page.locator("[role=alertdialog]");
  if (await dlg.isVisible({ timeout: 2000 }).catch(() => false)) {
    await dlg.getByRole("button", { name: /submit|confirm/i }).last().click();
  }
  const resp = await submitted;
  expect(resp.ok(), `submit ${code}: ${resp.status()} ${await resp.text()}`).toBe(true);
  await lastToast(page).catch(() => "");
  await expect.poll(async () => (await locationStatus(code))?.physical_count_status, { timeout: 60_000 }).toBe("completed");
  images.push(await shot(page, id, `c-submitted-${code}`));
  return { images, skipped: false, physicalCountId };
}

/** แถวของใบนับหลัง submit (ยอดระบบ / ยอดนับ / ส่วนต่าง) */
export function countDetails(physicalCountId: string) {
  return sql(`
    select p.code prod, d.on_hand_qty, d.actual_qty, d.diff_qty
    from ${SCHEMA}.tb_physical_count_detail d join ${SCHEMA}.tb_product p on p.id = d.product_id
    where d.physical_count_id = '${physicalCountId}' and d.deleted_at is null order by p.code`);
}
