// scripts/data-reset/docs/receiving.ts
// GRNs (draft / saved / committed in full / committed partially) and credit notes on the committed
// GRN. Committing updates the PO to completed / partial.
// GRN ทุกสถานะ และ CN บน GRN ที่ commit แล้ว — PO เปลี่ยนสถานะตอน commit
import type { ApiClient } from "../../seed-master/api-client";
import type { ResetConfig } from "../config";
import type { Sessions } from "../sessions";
import type { StepResult } from "../step-result";
import type { SeedContext } from "./context";
import type { RowLedger } from "./row-ledger";
import { createDoc, transition, why } from "./transition";
import { isoDay } from "./dates";
import { refId } from "./refs";

const PURCHASE = "carmensoftware.dev+purchase@gmail.com";
const PRICE = 100;

interface GrnLine { poDetailId?: string; productId: string; locationId: string; qty: number; unitId: string; price: number }

function grnBody(ctx: SeedContext, row: string, docType: "purchase_order" | "manual", lines: GrnLine[]) {
  return {
    doc_type: docType,
    grn_date: isoDay(ctx.today),
    invoice_no: `STD-${row}`,
    invoice_date: isoDay(ctx.today),
    description: `STD ${row}`,
    received_by_id: ctx.users[PURCHASE]?.id,
    vendor_id: ctx.vendor.id,
    currency_id: ctx.currencyId,
    exchange_rate: 1,
    good_received_note_detail: {
      add: lines.map((l) => ({
        ...(l.poDetailId ? { purchase_order_detail_id: l.poDetailId } : {}),
        product_id: l.productId, location_id: l.locationId, received_qty: l.qty, received_unit_id: l.unitId,
        received_base_qty: l.qty, order_price: l.price, received_price: l.price, foc_qty: 0,
        net_amount: l.qty * l.price, base_net_amount: l.qty * l.price,
      })),
    },
  };
}

async function poLines(client: ApiClient, cfg: ResetConfig, poId: string, portion: "full" | "half-first"): Promise<GrnLine[]> {
  const res = await client.get(`/api/${cfg.buCode}/purchase-orders/${poId}`);
  const lines: any[] = res.body?.data?.purchase_order_detail ?? [];
  const mapped = lines.map((l) => ({
    poDetailId: l.id, productId: refId(l, "product")!, locationId: refId(l, "location")!, qty: Number(l.order_qty),
    unitId: refId(l, "order_unit")!, price: Number(l.price ?? PRICE),
  }));
  return portion === "full" ? mapped : mapped.slice(0, 1).map((l) => ({ ...l, qty: Math.floor(l.qty / 2) }));
}

export async function seedReceiving(
  sessions: Sessions, cfg: ResetConfig, ctx: SeedContext, ledger: RowLedger, forGrn: { full: string; partial: string },
): Promise<StepResult> {
  const result: StepResult = { step: "receiving", created: 0, skipped: 0, failed: [] };
  const purchase = await sessions.client(PURCHASE);
  const grnBase = `/api/${cfg.buCode}/good-received-notes`;
  const fail = (row: string, reason: string) => {
    result.failed.push(reason);
    ledger.record(row, null, false, reason);
  };
  const manualLines: GrnLine[] = ctx.products.slice(2, 4).map((p) => ({
    productId: p.id, locationId: ctx.locations.first.id, qty: 5, unitId: p.unitId, price: PRICE,
  }));

  const grns: Array<{ row: string; poRow?: string; docType: "purchase_order" | "manual"; lines: () => Promise<GrnLine[]>; steps: Array<"save" | "commit"> }> = [
    { row: "grn.committed", poRow: "po.completed", docType: "purchase_order", lines: () => poLines(purchase, cfg, forGrn.full, "full"), steps: ["save", "commit"] },
    { row: "grn.partial", poRow: "po.partial", docType: "purchase_order", lines: () => poLines(purchase, cfg, forGrn.partial, "half-first"), steps: ["save", "commit"] },
    { row: "grn.received", docType: "manual", lines: async () => manualLines, steps: ["save"] },
    { row: "grn.draft", docType: "manual", lines: async () => manualLines, steps: [] },
  ];

  let committedGrn: string | null = null;
  for (const g of grns) {
    const lines = await g.lines();
    if (lines.length === 0) {
      fail(g.row, `${g.row}: the PO it receives against has no lines`);
      continue;
    }
    const created = await createDoc(purchase, grnBase, grnBody(ctx, g.row, g.docType, lines));
    if (!created.ok || !created.id) {
      fail(g.row, why(`create ${g.row}`, created));
      continue;
    }
    let failure: string | null = null;
    for (const step of g.steps) {
      const res = await transition(purchase, `${grnBase}/${created.id}`, step, (v) => (step === "save" ? { data: {} } : { doc_version: v }));
      if (!res.ok) {
        failure = why(`${step} ${created.no ?? created.id}`, res);
        break;
      }
    }
    if (failure) {
      fail(g.row, failure);
      continue;
    }
    result.created += 1;
    ledger.record(g.row, created.no ?? created.id, true);
    if (g.poRow) ledger.record(g.poRow, created.no ?? created.id, true);
    if (g.row === "grn.committed") committedGrn = created.id;
  }

  const cnBase = `/api/${cfg.buCode}/credit-notes`;
  for (const [row, submit] of [["cn.draft", false], ["cn.committed", true]] as const) {
    if (!committedGrn) {
      fail(row, `${row}: no committed GRN to credit`);
      continue;
    }
    const product = ctx.products[0];
    const created = await createDoc(purchase, cnBase, {
      credit_note_type: "quantity_return",
      grn_id: committedGrn,
      vendor_id: ctx.vendor.id,
      currency_id: ctx.currencyId,
      exchange_rate: 1,
      cn_date: isoDay(ctx.today),
      description: `STD ${row}`,
      credit_note_detail: {
        add: [{
          product_id: product.id, location_id: ctx.locations.first.id, return_qty: 1, return_unit_id: product.unitId,
          return_base_qty: 1, return_conversion_factor: 1, price: PRICE, cn_amount: PRICE,
          tax_profile_id: ctx.taxProfileId, tax_rate: 0, is_tax_adjustment: false,
        }],
      },
    });
    if (!created.ok || !created.id) {
      fail(row, why(`create ${row}`, created));
      continue;
    }
    if (submit) {
      const res = await transition(purchase, `${cnBase}/${created.id}`, "submit", (v) => ({ doc_version: v }));
      if (!res.ok) {
        fail(row, why(`submit ${created.no ?? created.id}`, res));
        continue;
      }
    }
    result.created += 1;
    ledger.record(row, created.no ?? created.id, true);
  }
  return result;
}
