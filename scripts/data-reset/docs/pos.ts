// scripts/data-reset/docs/pos.ts
// POS / Sales Consumption base: Simphony switched on, two recipes with fixed ingredients, and
// opening stock for those ingredients at both locations (committed stock-ins dated the first day of
// the open period, so a sale dated inside the period can consume it).
// ฐานของ POS / Sales Consumption: เปิด Simphony, recipe 2 ตัวที่ส่วนผสมคงที่ และสต๊อกต้นงวดของวัตถุดิบ
import type { ResetConfig } from "../config";
import type { Sessions } from "../sessions";
import type { StepResult } from "../step-result";
import { rowsOf } from "../step-result";
import type { SeedContext } from "./context";
import { isoDay } from "./dates";
import { refId } from "./refs";
import type { RowLedger } from "./row-ledger";
import { createDoc, transition, why } from "./transition";
import { localDate } from "../period";
import { TEST_BUS } from "../../../tests/test-users";

const STOREMANAGER = "carmensoftware.dev+storemanager@gmail.com";
// Same defaults the FE form starts from (routes/system-admin/interface/pos/pos-simphony-form.tsx).
const EMPTY_SIMPHONY = {
  sftp_host: "", sftp_port: 22, sftp_username: "", sftp_password: "",
  remote_folder_path: "/export/", file_pattern: "GLExport_*.txt", schedule_time: "03:00",
};
export const POS_CONFIG_KEY = "interface_pos_simphony";
export const RECIPE_A = "E2E-POS-A";
export const RECIPE_B = "E2E-POS-B";
const CATEGORY_CODE = "E2E-POS";
const CUISINE_NAME = "E2E POS";
const OPENING_QTY = 500;
const OPENING_COST = 10;

export interface PosRecipe {
  code: string;
  name: string;
  ingredients: Array<{ productId: string; unitId: string; qty: number }>;
}

export interface PosStockIn {
  row: string;
  locationId: string;
  siDate: string;
  lines: Array<{ productId: string; qty: number; cost: number }>;
}

export interface PosPlan {
  productLocations: Array<{ productId: string; entries: Array<{ location_id: string }> }>;
  recipes: PosRecipe[];
  stockIns: PosStockIn[];
}

/** Pure: what pos seeds, from the context and the first day (YYYY-MM-DD) of the open period. */
export function planPos(ctx: SeedContext, periodStart: string): PosPlan {
  if (ctx.products.length < 4) throw new Error(`pos needs 4 products, found ${ctx.products.length}`);
  const [p1, p2, p3, p4] = ctx.products.slice(-4);
  const l1 = ctx.locations.first.id;
  const l2 = ctx.locations.second.id;
  const line = (p: { id: string; unitId: string }, qty: number) => ({ productId: p.id, unitId: p.unitId, qty });
  const lines = [p1, p2, p3, p4].map((p) => ({ productId: p.id, qty: OPENING_QTY, cost: OPENING_COST }));
  return {
    productLocations: [p1, p2, p3, p4].map((p) => ({ productId: p.id, entries: [{ location_id: l1 }, { location_id: l2 }] })),
    recipes: [
      { code: RECIPE_A, name: RECIPE_A, ingredients: [line(p1, 2), line(p2, 1)] },
      { code: RECIPE_B, name: RECIPE_B, ingredients: [line(p3, 1), line(p4, 3)] },
    ],
    stockIns: [
      { row: "pos.stock.l1", locationId: l1, siDate: periodStart, lines },
      { row: "pos.stock.l2", locationId: l2, siDate: periodStart, lines },
    ],
  };
}

async function openPeriodStart(sessions: Sessions, cfg: ResetConfig): Promise<string | null> {
  const admin = await sessions.client(cfg.adminEmail);
  const res = await admin.get(`/api/${cfg.buCode}/inventory-periods/current`);
  const p = res.body?.data;
  if (!res.ok || p?.status !== "open" || !p.start_at) return null;
  return localDate(new Date(p.start_at)).day;
}

/** The row with this key, creating it when the list has none. Returns the id or a failure reason. */
async function ensureRow(
  admin: Awaited<ReturnType<Sessions["client"]>>, path: string, match: (r: any) => boolean, body: unknown,
): Promise<{ id: string; created: boolean } | { error: string }> {
  const list = await admin.get(`${path}?perpage=100`);
  if (!list.ok) return { error: why(`GET ${path}`, list) };
  const found = rowsOf<any>(list.body).find(match);
  if (found?.id) return { id: found.id, created: false };
  const res = await admin.post(path, body);
  const id = res.body?.data?.id;
  return res.ok && id ? { id, created: true } : { error: why(`POST ${path}`, res) };
}

export async function seedPos(sessions: Sessions, cfg: ResetConfig, ctx: SeedContext, ledger: RowLedger): Promise<StepResult> {
  const result: StepResult = { step: "pos", created: 0, skipped: 0, failed: [] };
  const start = await openPeriodStart(sessions, cfg);
  if (!start) {
    result.failed.push("no open inventory period — pos stock not posted");
    return result;
  }
  // FIFO refuses a stock-in dated before the latest receipt of the same product/location in the
  // period, and the stock step has already received some of these products today — so on a FIFO BU
  // the opening stock goes in today. Average BUs keep the period start (141 reads that BU).
  // BU FIFO ห้ามลง stock-in ย้อนก่อนใบรับล่าสุด — ขั้น stock รับไปแล้ววันนี้ จึงลงวันนี้แทน
  const fifo = TEST_BUS.find((b) => b.code === cfg.buCode)?.method === "fifo";
  const plan = planPos(ctx, fifo ? ctx.today : start);
  const admin = await sessions.client(cfg.adminEmail);
  const bu = cfg.buCode;

  // 1. Simphony on. Keep any fields already saved; only `enabled` is ours.
  const cfgPath = `/api/config/${bu}/app-config/${POS_CONFIG_KEY}`;
  const current = await admin.get(cfgPath);
  if (!current.ok && current.status !== 404) {
    result.failed.push(why(`GET ${cfgPath}`, current));
  } else {
    const existing = (current.ok ? (current.body?.data?.value as Record<string, unknown> | undefined) : undefined) ?? {};
    if (existing.enabled === true) result.skipped++;
    else {
      // The backend validates the whole Simphony value, so a first save carries the FE form's defaults too.
      const res = await admin.put(cfgPath, { value: { ...EMPTY_SIMPHONY, ...existing, enabled: true } });
      if (res.ok) result.created++;
      else result.failed.push(why(`PUT ${cfgPath}`, res));
    }
  }

  // 2. Ingredients sit at both locations before stock goes in (same read-then-patch as seedStock).
  for (const { productId, entries } of plan.productLocations) {
    const path = `/api/config/${bu}/products/${productId}`;
    const read = await admin.get(path);
    if (!read.ok) {
      result.failed.push(why(`read product ${productId}`, read));
      continue;
    }
    const doc = read.body?.data ?? {};
    const linked = new Set(
      (Array.isArray(doc.locations) ? doc.locations : []).map((l: any) => refId(l, "location")).filter(Boolean),
    );
    const add = entries.filter((e) => !linked.has(e.location_id));
    if (add.length === 0) {
      result.skipped++;
      continue;
    }
    const res = await admin.patch(path, { doc_version: Number(doc.doc_version ?? 0), locations: { add } });
    if (res.ok) result.created++;
    else result.failed.push(why(`product locations ${productId}`, res));
  }

  // 3. Committed opening stock, dated the first day of the period.
  const store = await sessions.client(STOREMANAGER);
  const base = `/api/${bu}/stock-ins`;
  for (const si of plan.stockIns) {
    const created = await createDoc(store, base, {
      adjustment_type_id: ctx.adjustmentTypeId,
      location_id: si.locationId,
      si_date: isoDay(si.siDate),
      note: `STD ${si.row}`,
      stock_in_detail: {
        add: si.lines.map((l) => ({ product_id: l.productId, qty: l.qty, cost_per_unit: l.cost, total_cost: l.qty * l.cost })),
      },
    });
    if (!created.ok || !created.id) {
      const reason = why(`stock-in ${si.row}`, created);
      result.failed.push(reason);
      ledger.record(si.row, null, false, reason);
      continue;
    }
    const committed = await transition(store, `${base}/${created.id}`, "commit", (v) => ({ doc_version: v }));
    if (committed.ok) {
      result.created++;
      ledger.record(si.row, created.no ?? created.id, true);
    } else {
      const reason = why(`commit ${created.no ?? created.id}`, committed);
      result.failed.push(reason);
      ledger.record(si.row, null, false, reason);
    }
  }

  // 4. Recipes need a category and a cuisine; the master dataset ships none, so ensure one of each.
  const category = await ensureRow(admin, `/api/config/${bu}/recipe-categories`, (r) => r.code === CATEGORY_CODE, {
    code: CATEGORY_CODE, name: "E2E POS", is_active: true,
  });
  const cuisine = await ensureRow(admin, `/api/config/${bu}/recipe-cuisines`, (r) => r.name === CUISINE_NAME, {
    name: CUISINE_NAME, region: "ASIA", is_active: true,
  });
  if ("error" in category || "error" in cuisine) {
    result.failed.push(...[category, cuisine].flatMap((r) => ("error" in r ? [`recipe prerequisite ${r.error}`] : [])));
    return result;
  }
  if (category.created) result.created++;
  if (cuisine.created) result.created++;

  const recipesPath = `/api/config/${bu}/recipes`;
  const existing = await admin.get(`${recipesPath}?perpage=100`);
  const have = new Set(rowsOf<any>(existing.body).map((r) => r.code));
  for (const recipe of plan.recipes) {
    if (have.has(recipe.code)) {
      result.skipped++;
      continue;
    }
    // The gateway reads recipe create as multipart with the JSON in a `data` field (images optional).
    const form = new FormData();
    form.set("data", JSON.stringify({
      code: recipe.code, name: recipe.name, is_active: true, status: "PUBLISHED",
      category_id: category.id, cuisine_id: cuisine.id,
      base_yield: 1, base_yield_unit: recipe.ingredients[0].unitId,
    }));
    const made = await admin.post(recipesPath, form);
    const id = made.body?.data?.id;
    if (!made.ok || !id) {
      result.failed.push(why(`recipe ${recipe.code}`, made));
      continue;
    }
    const items = recipe.ingredients.map((i) => ({ product_id: i.productId, ingredient_unit_id: i.unitId, qty: i.qty }));
    const put = await admin.put(`${recipesPath}/${id}/ingredients`, { items, recalculate: false });
    if (put.ok) result.created++;
    else result.failed.push(why(`recipe ${recipe.code} ingredients`, put));
  }
  return result;
}
