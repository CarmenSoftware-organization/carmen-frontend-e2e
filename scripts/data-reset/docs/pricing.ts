// scripts/data-reset/docs/pricing.ts
// Price lists valid today, and campaigns (request-for-pricings). A campaign has no status column:
// the list derives open / upcoming / closed from its dates (carmen-frontend rfp-window.ts), so the
// "active", "draft" and "expired" rows are three date windows.
// price list ที่ใช้ได้วันนี้ และ campaign — สถานะของ campaign คำนวณจากวันที่ จึงตั้งช่วงวันที่ 3 แบบ
import type { ResetConfig } from "../config";
import type { Sessions } from "../sessions";
import type { StepResult } from "../step-result";
import type { SeedContext } from "./context";
import { addDays } from "./dates";
import type { RowLedger } from "./row-ledger";
import { createDoc, why } from "./transition";

const PURCHASE = "carmensoftware.dev+purchase@gmail.com";
const PRICE = 100;

export function planCampaignDates(today: string): Record<"active" | "draft" | "expired", { start_date: string; end_date: string }> {
  return {
    active: { start_date: addDays(today, -1), end_date: addDays(today, 30) },
    draft: { start_date: addDays(today, 15), end_date: addDays(today, 45) },
    expired: { start_date: addDays(today, -35), end_date: addDays(today, -5) },
  };
}

export async function seedPricing(sessions: Sessions, cfg: ResetConfig, ctx: SeedContext, ledger: RowLedger): Promise<StepResult> {
  const result: StepResult = { step: "pricing", created: 0, skipped: 0, failed: [] };
  const purchase = await sessions.client(PURCHASE);
  const products = ctx.products.slice(0, 5);
  const track = (row: string, res: { ok: boolean; status: number; id?: string; no?: string; body?: any }, what: string) => {
    if (res.ok) {
      result.created += 1;
      ledger.record(row, res.no ?? res.id ?? what, true);
      return true;
    }
    const reason = why(what, res);
    result.failed.push(reason);
    ledger.record(row, null, false, reason);
    return false;
  };

  for (let i = 1; i <= 3; i++) {
    const res = await createDoc(purchase, `/api/${cfg.buCode}/pricelists`, {
      name: `STD pricelist.active ${i}`,
      status: "active",
      vendor_id: ctx.vendor.id,
      currency_id: ctx.currencyId,
      effective_from_date: addDays(ctx.today, -1),
      effective_to_date: addDays(ctx.today, 90),
      pricelist_detail: {
        add: products.map((p) => ({
          product_id: p.id, unit_id: p.unitId, price: PRICE, price_without_tax: PRICE, tax_amt: 0,
          tax_profile_id: ctx.taxProfileId, tax_rate: 0, moq_qty: 1, lead_time_days: 1, is_preferred: true,
        })),
      },
    });
    track("pricelist.active", res, `create price list ${i}`);
  }

  const template = await createDoc(purchase, `/api/${cfg.buCode}/pricelist-templates`, {
    name: "STD campaign template",
    status: "active",
    currency_id: ctx.currencyId,
    validity_period: 30,
    vendor_instructions: "STD",
    products: { add: products.map((p) => ({ product_id: p.id })) },
  });
  if (!template.ok || !template.id) {
    for (const row of ["campaign.active", "campaign.draft", "campaign.expired"]) {
      const reason = why("create pricelist template", template);
      result.failed.push(reason);
      ledger.record(row, null, false, reason);
    }
    return result;
  }
  for (const [state, dates] of Object.entries(planCampaignDates(ctx.today))) {
    const res = await createDoc(purchase, `/api/${cfg.buCode}/request-for-pricings`, {
      name: `STD campaign.${state}`,
      pricelist_template_id: template.id,
      ...dates,
      custom_message: `STD campaign.${state}`,
      vendors: { add: [{ vendor_id: ctx.vendor.id, contact_person: "STD contact", contact_phone: "0800000000", contact_email: ctx.vendor.email }] },
    });
    track(`campaign.${state}`, res, `create campaign ${state}`);
  }
  return result;
}
