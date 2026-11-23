// scripts/data-reset/docs/ia.ts
// Inventory-adjustment base: two products (E2E-IA-A / E2E-IA-B) linked to the first location only and
// given NO stock, so the adjustment cost specs start from a known-empty balance.
// ฐานของ inventory adjustment: สินค้า 2 ตัวที่ผูกกับ location แรกอย่างเดียว และไม่มีสต๊อกตั้งต้น
import type { ResetConfig } from "../config";
import type { Sessions } from "../sessions";
import type { StepResult } from "../step-result";
import type { SeedContext } from "./context";
import { listAll } from "./accounting";
import { refId } from "./refs";
import type { RowLedger } from "./row-ledger";
import { why } from "./transition";

export const IA_PRODUCT_A = "E2E-IA-A";
export const IA_PRODUCT_B = "E2E-IA-B";

export const IA_TYPE_IN = "E2E-IA-IN";
export const IA_TYPE_OUT = "E2E-IA-OUT";
/** Adjustment types ia creates (active, own codes so specs never depend on EOP-* / SALE). */
export const IA_TYPES = [
  { code: IA_TYPE_IN, name: "E2E IA stock in", type: "stock_in" },
  { code: IA_TYPE_OUT, name: "E2E IA stock out", type: "stock_out" },
] as const;

export interface IaPlan {
  products: Array<{ code: string; name: string; templateId: string }>;
  locationId: string;
}

/** Pure: what ia seeds. Category / unit are copied from the template product (the first one). */
export function planIa(ctx: SeedContext): IaPlan {
  const template = ctx.products[0];
  if (!template) throw new Error("ia needs a product to copy the item group and unit from, found none");
  return {
    products: [IA_PRODUCT_A, IA_PRODUCT_B].map((code) => ({ code, name: code, templateId: template.id })),
    locationId: ctx.locations.first.id,
  };
}

export async function seedIa(sessions: Sessions, cfg: ResetConfig, ctx: SeedContext, ledger: RowLedger): Promise<StepResult> {
  const result: StepResult = { step: "ia", created: 0, skipped: 0, failed: [] };
  const plan = planIa(ctx);
  const admin = await sessions.client(cfg.adminEmail);
  const path = `/api/config/${cfg.buCode}/products`;

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

  const typePath = `/api/config/${cfg.buCode}/adjustment-types`;
  const haveTypes = new Set((await listAll(admin, typePath)).map((r) => String(r.code)));
  for (const t of IA_TYPES) {
    if (haveTypes.has(t.code)) {
      result.skipped++;
      ledger.record(`ia.${t.code}`, t.code, true);
      continue;
    }
    const res = await admin.post(typePath, { code: t.code, name: t.name, type: t.type, description: "", is_active: true });
    if (res.ok) {
      result.created++;
      ledger.record(`ia.${t.code}`, t.code, true);
    } else {
      const reason = why(`adjustment type ${t.code}`, res);
      result.failed.push(reason);
      ledger.record(`ia.${t.code}`, null, false, reason);
    }
  }

  const have = new Set((await listAll(admin, path)).map((r) => String(r.code)));
  for (const p of plan.products) {
    if (have.has(p.code)) {
      result.skipped++;
      ledger.record(`ia.${p.code}`, p.code, true);
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
      locations: { add: [{ location_id: plan.locationId }] },
    });
    if (res.ok) {
      result.created++;
      ledger.record(`ia.${p.code}`, p.code, true);
    } else {
      const reason = why(`product ${p.code}`, res);
      result.failed.push(reason);
      ledger.record(`ia.${p.code}`, null, false, reason);
    }
  }
  return result;
}
