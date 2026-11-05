// scripts/data-reset/docs/purchase-orders.ts
// POs per row of the table — all manual, so the approved PRs stay approved. One PO comes from the
// single PR reserved for "Completed" (confirm-pr marks that PR completed).
// PO ทุกแถวเป็นแบบ manual เพื่อไม่ดึง PR ที่อนุมัติแล้วไปใช้ ยกเว้น PR ใบเดียวที่จองไว้ให้เป็น Completed
import type { ResetConfig } from "../config";
import type { Sessions } from "../sessions";
import type { StepResult } from "../step-result";
import type { SeedContext } from "./context";
import { addDays, isoDay } from "./dates";
import type { RowLedger } from "./row-ledger";
import { createDoc, transition, why } from "./transition";

export type PoTarget = "draft" | "rejected" | "approved" | "sent" | "for-grn-full" | "for-grn-partial";
type Role = "purchase" | "fc" | "gm";
type Action = "create" | "submit" | "approve" | "reject" | "mark-sent";

const mail = (role: string) => `carmensoftware.dev+${role}@gmail.com`;
const TARGETS: PoTarget[] = ["draft", "rejected", "approved", "sent", "for-grn-full", "for-grn-partial"];
const PRICE = 100;
const QTY = 10;

export function planPurchaseOrders(_ctx: SeedContext): Array<{ row: string; target: PoTarget }> {
  return TARGETS.map((target) => ({ row: `po.${target}`, target }));
}

export function poActions(target: PoTarget): Array<{ by: Role; action: Action }> {
  const create = [{ by: "purchase" as Role, action: "create" as Action }];
  if (target === "draft") return create;
  const submitted = [...create, { by: "purchase" as Role, action: "submit" as Action }];
  if (target === "rejected") return [...submitted, { by: "fc", action: "reject" }];
  const approved = [...submitted, { by: "fc" as Role, action: "approve" as Action }, { by: "gm" as Role, action: "approve" as Action }];
  if (target === "approved") return approved;
  return [...approved, { by: "purchase", action: "mark-sent" }];
}

const detailsOf = (doc: any): any[] => doc?.purchase_order_detail ?? doc?.details ?? [];

function createBody(ctx: SeedContext, row: string) {
  return {
    stage_role: "create",
    details: {
      po_type: "manual",
      vendor_id: ctx.vendor.id,
      currency_id: ctx.currencyId,
      delivery_date: isoDay(addDays(ctx.today, 7)),
      workflow_id: ctx.workflows.po,
      description: `STD ${row}`,
      purchase_order_detail: {
        add: ctx.products.slice(0, 2).map((p, i) => ({
          sequence: i + 1, product_id: p.id, location_id: ctx.locations.first.id, order_unit_id: p.unitId,
          order_qty: QTY, base_qty: QTY, price: PRICE, sub_total_price: PRICE * QTY, net_amount: PRICE * QTY,
          total_price: PRICE * QTY, tax_profile_id: ctx.taxProfileId, tax_rate: 0, foc_qty: 0,
        })),
      },
    },
  };
}

function stepBody(action: Action, by: Role, v: number, doc: any) {
  const lines = detailsOf(doc);
  if (action === "mark-sent") return undefined;
  const status = action === "submit" ? "submit" : action;
  return {
    doc_version: v,
    stage_role: by === "purchase" ? "create" : "approve",
    details: lines.map((l) => ({ id: l.id, stage_status: status, stage_message: null })),
  };
}

const firstDoc = (body: any): { id?: string; po_no?: string } => {
  const data = body?.data ?? body;
  if (Array.isArray(data)) return data[0] ?? {};
  if (Array.isArray(data?.purchase_orders)) return data.purchase_orders[0] ?? {};
  return data ?? {};
};

export async function seedPurchaseOrders(
  sessions: Sessions, cfg: ResetConfig, ctx: SeedContext, ledger: RowLedger, reservedPr: string,
): Promise<StepResult & { forGrn: { full: string; partial: string } }> {
  const base = `/api/${cfg.buCode}/purchase-orders`;
  const result = { step: "purchase-orders", created: 0, skipped: 0, failed: [] as string[], forGrn: { full: "", partial: "" } };
  const fail = (row: string, reason: string) => {
    result.failed.push(reason);
    ledger.record(row, null, false, reason);
  };

  for (const { row, target } of planPurchaseOrders(ctx)) {
    const [, ...rest] = poActions(target);
    const created = await createDoc(await sessions.client(mail("purchase")), base, createBody(ctx, row));
    if (!created.ok || !created.id) {
      fail(row, why(`create ${row}`, created));
      continue;
    }
    let failure: string | null = null;
    for (const step of rest) {
      const res = await transition(
        await sessions.client(mail(step.by)), `${base}/${created.id}`, step.action,
        (v, doc) => stepBody(step.action, step.by, v, doc), step.action === "mark-sent" ? "post" : "patch",
      );
      if (!res.ok) {
        failure = why(`${step.by} ${step.action} ${created.no ?? created.id}`, res);
        break;
      }
    }
    if (failure) {
      fail(row, failure);
      continue;
    }
    result.created += 1;
    ledger.record(row, created.no ?? created.id, true);
    if (target === "for-grn-full") result.forGrn.full = created.id;
    if (target === "for-grn-partial") result.forGrn.partial = created.id;
  }

  if (!reservedPr) {
    fail("pr.completed", "pr.completed: no PR reached approved to convert");
  } else {
    const purchase = await sessions.client(mail("purchase"));
    const confirmed = await purchase.post(`${base}/confirm-pr`, { workflow_id: ctx.workflows.po, pr_ids: [reservedPr] });
    const po = firstDoc(confirmed.body);
    if (!confirmed.ok || !po.id) {
      fail("pr.completed", why("confirm-pr", confirmed));
    } else {
      ledger.record("pr.completed", po.po_no ?? po.id, true);
      let failure: string | null = null;
      for (const by of ["fc", "gm"] as Role[]) {
        const res = await transition(await sessions.client(mail(by)), `${base}/${po.id}`, "approve", (v, doc) =>
          stepBody("approve", by, v, doc),
        );
        if (!res.ok) {
          failure = why(`${by} approve ${po.po_no ?? po.id}`, res);
          break;
        }
      }
      if (failure) fail("po.from-pr", failure);
      else {
        result.created += 1;
        ledger.record("po.from-pr", po.po_no ?? po.id, true);
      }
    }
  }
  return result;
}
