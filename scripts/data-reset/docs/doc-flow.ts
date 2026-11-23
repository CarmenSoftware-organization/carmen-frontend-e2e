// scripts/data-reset/docs/doc-flow.ts
// Doc-flow base: four products (E2E-DF-1..4) linked to two inventory locations, no stock, and added to
// the product list of every seeded workflow — so the document-flow specs have a stable item to put in
// PR / PO / SR on each TEST BU regardless of what the BU's own master data holds.
// ฐานของ doc-flow: สินค้า 4 ตัวผูกกับ location 2 แห่ง ไม่มีสต๊อก และอยู่ในรายการสินค้าของทุก workflow
import type { ApiClient } from "../../seed-master/api-client";
import type { ResetConfig } from "../config";
import type { Sessions } from "../sessions";
import { rowsOf, type StepResult } from "../step-result";
import type { SeedContext } from "./context";
import { listAll } from "./accounting";
import { refId } from "./refs";
import type { RowLedger } from "./row-ledger";
import { why } from "./transition";

export const DF_PRODUCTS = ["E2E-DF-1", "E2E-DF-2", "E2E-DF-3", "E2E-DF-4"] as const;
export const DF_CN_REASON = "E2E-DF damaged";

export interface DocFlowPlan {
  products: Array<{ code: string; name: string; templateId: string }>;
  locationIds: [string, string];
}

type Row = Record<string, any>;

/**
 * Pure: what doc-flow seeds. Category / unit are copied from the template product (the first one).
 * `locationIds` defaults to the context's first two inventory locations; seedDocFlow passes the pair
 * it found qualifying when those two do not.
 */
export function planDocFlow(ctx: SeedContext, locationIds?: [string, string]): DocFlowPlan {
  const template = ctx.products[0];
  if (!template) throw new Error("doc-flow needs a product to copy the item group and unit from, found none");
  return {
    products: DF_PRODUCTS.map((code) => ({ code, name: code, templateId: template.id })),
    locationIds: locationIds ?? [ctx.locations.first.id, ctx.locations.second.id],
  };
}

/**
 * Pure: the first two inventory locations (by code) the Store Requisition can use as source and
 * destination — the context's own pair when both qualify, else the first two that do.
 * Qualifies = active inventory location that every user assigned to an SR stage may use.
 */
export function pickLocationPair(
  ctx: SeedContext,
  inventory: Array<{ id: string; code: string }>,
  usable: ReadonlySet<string>,
): [string, string] | null {
  const preferred: [string, string] = [ctx.locations.first.id, ctx.locations.second.id];
  if (preferred.every((id) => usable.has(id))) return preferred;
  const found = [...inventory].sort((a, b) => a.code.localeCompare(b.code)).filter((l) => usable.has(l.id)).slice(0, 2);
  return found.length === 2 ? [found[0].id, found[1].id] : null;
}

/** Location ids every SR-stage user may use (their locations-users mapping), intersected. */
async function usableLocationIds(admin: ApiClient, bu: string, sr: Row): Promise<Set<string>> {
  const userIds = new Set<string>();
  for (const stage of sr.data?.stages ?? []) {
    for (const u of stage.assigned_users ?? []) if (u.user_id) userIds.add(String(u.user_id));
  }
  let usable: Set<string> | undefined;
  for (const userId of userIds) {
    const res = await admin.get(`/api/config/${bu}/locations-users/${userId}`);
    const ids = new Set(rowsOf<Row>(res.body).filter((l) => l.is_active !== false).map((l) => String(l.location_id)));
    const prev: Set<string> | undefined = usable;
    usable = prev ? new Set([...prev].filter((id) => ids.has(id))) : ids;
  }
  return usable ?? new Set();
}

export async function seedDocFlow(sessions: Sessions, cfg: ResetConfig, ctx: SeedContext, ledger: RowLedger): Promise<StepResult> {
  const result: StepResult = { step: "doc-flow", created: 0, skipped: 0, failed: [] };
  const admin = await sessions.client(cfg.adminEmail);
  const bu = cfg.buCode;
  const path = `/api/config/${bu}/products`;

  // Step 1: the location pair, verified against the seeded SR workflow.
  const srRes = await admin.get(`/api/config/${bu}/workflows/${ctx.workflows.sr}`);
  if (!srRes.ok) {
    result.failed.push(why("read Store Requisition workflow", srRes));
    return result;
  }
  const inventory = (await listAll(admin, `/api/config/${bu}/locations`)).filter(
    (l) => (l.location_type ?? "inventory") === "inventory" && l.is_active !== false,
  ) as Array<{ id: string; code: string }>;
  const pair = pickLocationPair(ctx, inventory, await usableLocationIds(admin, bu, srRes.body?.data ?? {}));
  if (!pair) {
    result.failed.push("no two inventory locations usable by every Store Requisition user — cannot place the doc-flow products");
    ledger.record("doc-flow.locations", null, false, "no usable location pair");
    return result;
  }
  const plan = planDocFlow(ctx, pair);
  ledger.record("doc-flow.locations", pair.join(","), true);

  const template = await admin.get(`${path}/${plan.products[0].templateId}`);
  if (!template.ok) {
    result.failed.push(why(`read template product ${plan.products[0].templateId}`, template));
    return result;
  }
  const t = template.body?.data ?? {};
  const inventoryUnit = refId(t, "inventory_unit") ?? ctx.products[0].unitId;
  const itemGroup = refId(t, "product_item_group");
  if (!inventoryUnit) {
    result.failed.push("template product has no inventory unit");
    return result;
  }

  // Step 2a: the products.
  const have = new Set((await listAll(admin, path)).map((r) => String(r.code)));
  for (const p of plan.products) {
    if (have.has(p.code)) {
      result.skipped++;
      ledger.record(`doc-flow.${p.code}`, p.code, true);
      continue;
    }
    const res = await admin.post(path, {
      code: p.code,
      name: p.name,
      local_name: p.name,
      description: "",
      inventory_unit_id: inventoryUnit,
      ...(itemGroup ? { product_item_group_id: itemGroup } : {}),
      product_status_type: "active",
      product_info: { is_used_in_recipe: false, is_sold_directly: false, barcode: "", sku: "", info: [] },
      locations: { add: pair.map((location_id) => ({ location_id })) },
    });
    if (res.ok) {
      result.created++;
      ledger.record(`doc-flow.${p.code}`, p.code, true);
    } else {
      const reason = why(`product ${p.code}`, res);
      result.failed.push(reason);
      ledger.record(`doc-flow.${p.code}`, null, false, reason);
    }
  }

  // Step 2b: every workflow's product list (the picker shows workflow products ∩ location products).
  const now = new Map((await listAll(admin, path)).map((r) => [String(r.code), r]));
  const wanted = DF_PRODUCTS.flatMap((code) => {
    const row = now.get(code);
    return row ? [{ id: String(row.id), code, name: String(row.name ?? code) }] : [];
  });
  if (wanted.length !== DF_PRODUCTS.length) return result; // a product failed above; already reported
  for (const wf of await listAll(admin, `/api/config/${bu}/workflows`)) {
    const detail = await admin.get(`/api/config/${bu}/workflows/${wf.id}`);
    const w = detail.body?.data;
    if (!detail.ok || !w) {
      result.failed.push(why(`read workflow ${wf.name}`, detail));
      continue;
    }
    if (!Array.isArray(w.data?.products)) continue; // this workflow type carries no product list
    const listed = new Set<string>(w.data.products.map((p: Row) => String(p.id)));
    const missing = wanted.filter((p) => !listed.has(p.id));
    if (missing.length === 0) {
      result.skipped++;
      continue;
    }
    const res = await admin.put(`/api/config/${bu}/workflows/${wf.id}`, {
      doc_version: Number(w.doc_version ?? 0),
      name: w.name,
      workflow_type: w.workflow_type,
      description: w.description ?? null,
      is_active: w.is_active,
      data: { ...w.data, products: [...w.data.products, ...missing] },
    });
    if (res.ok) result.created++;
    else result.failed.push(why(`add doc-flow products to workflow ${w.name}`, res));
  }

  // Step 2c: the SR picker must now offer all four between the pair.
  // The lookup pages at 10 rows and rejects perpage > 100, so filter to the doc-flow codes instead.
  const lookup = await admin.get(`/api/config/${bu}/products-location-workflow/${pair[0]}/${pair[1]}/${ctx.workflows.sr}?search=E2E-DF`);
  const offered = new Set(rowsOf<Row>(lookup.body).map((r) => String(r.product_code)));
  const absent = DF_PRODUCTS.filter((c) => !offered.has(c));
  if (!lookup.ok || absent.length > 0) {
    result.failed.push(`SR product lookup between the doc-flow locations misses ${absent.join(", ") || `(HTTP ${lookup.status})`}`);
  }

  // Step 3: a credit-note reason. The reset empties them and the master workbook ships none, but the
  // CN spec (603) must pick one — keep an active one, create DF_CN_REASON when there is none.
  // reset ล้างเหตุผลใบลดหนี้ และ workbook ไม่มี — 603 ต้องเลือกได้อย่างน้อยหนึ่งตัว
  const reasonsPath = `/api/config/${bu}/credit-note-reasons`;
  const reasons = await admin.get(`${reasonsPath}?perpage=100`);
  if (!reasons.ok) {
    result.failed.push(why("list credit-note reasons", reasons));
  } else if (rowsOf<Row>(reasons.body).some((r) => r.is_active !== false)) {
    result.skipped++;
  } else {
    const res = await admin.post(reasonsPath, { name: DF_CN_REASON, description: "doc-flow E2E (data:reset)" });
    if (res.ok) result.created++;
    else result.failed.push(why(`credit-note reason ${DF_CN_REASON}`, res));
  }
  return result;
}
