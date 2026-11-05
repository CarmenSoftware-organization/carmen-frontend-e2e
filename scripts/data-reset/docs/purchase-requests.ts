// scripts/data-reset/docs/purchase-requests.ts
// PRs in every state of the spec's table, each moved by the role that does that stage.
// PR ทุกสถานะตามตาราง แต่ละขั้นทำโดย role ของขั้นนั้นจริง
import type { ApiClient } from "../../seed-master/api-client";
import type { ResetConfig } from "../config";
import type { Sessions } from "../sessions";
import type { StepResult } from "../step-result";
import type { SeedContext } from "./context";
import { addDays, isoDay } from "./dates";
import { refId } from "./refs";
import type { RowLedger } from "./row-ledger";
import { createDoc, transition, why } from "./transition";

export type PrTarget =
  | "draft" | "hod" | "purchase" | "gm" | "approved" | "returned" | "rejected" | "void" | "completed-reserve" | "second-dept";

export interface PrLine { productIndex: number; qty: number; focQty?: number }

export interface PlannedPr {
  row: string;
  target: PrTarget;
  requestor: string;
  departmentId: string;
  lines: PrLine[];
  deliveryDate: string | null;
  highValue: boolean;
}

type Role = "requestor" | "owner" | "hod" | "purchase" | "gm";
type Action = "create" | "submit" | "approve" | "purchase" | "review" | "reject";

const mail = (role: string) => `carmensoftware.dev+${role}@gmail.com`;
const HIGH_PRICE = 60_000;
const PRICE = 100;

const COUNTS: Array<[PrTarget, number]> = [
  ["draft", 3], ["hod", 18], ["purchase", 8], ["gm", 2], ["approved", 5], ["returned", 1],
  ["rejected", 1], ["void", 1], ["completed-reserve", 1], ["second-dept", 1],
];

export function planPurchaseRequests(ctx: SeedContext): PlannedPr[] {
  const plan: PlannedPr[] = [];
  let k = 0;
  for (const [target, n] of COUNTS) {
    for (let i = 0; i < n; i++, k++) {
      const highValue = target === "gm";
      const product = k % ctx.products.length;
      const lines: PrLine[] = [{ productIndex: product, qty: highValue ? 2 : 5 }];
      if (target === "hod" && i < 6) lines.push({ productIndex: (product + 1) % ctx.products.length, qty: 3 });
      if (target === "hod" && i === 6) lines[0].focQty = 1;
      plan.push({
        row: `pr.${target}`,
        target,
        requestor: mail(target === "second-dept" ? "owner" : "requestor"),
        departmentId: target === "second-dept" ? ctx.departments.second.id : ctx.departments.first.id,
        lines,
        deliveryDate: target === "approved" && i === 0 ? null : addDays(ctx.today, 7),
        highValue,
      });
    }
  }
  return plan;
}

export function prActions(target: PrTarget): Array<{ by: Role; action: Action }> {
  const head: Array<{ by: Role; action: Action }> = [{ by: "requestor", action: "create" }];
  if (target === "draft") return head;
  const submitted = [...head, { by: "requestor" as Role, action: "submit" as Action }];
  if (target === "hod" || target === "second-dept") return submitted;
  if (target === "returned") return [...submitted, { by: "hod", action: "review" }];
  if (target === "rejected") return [...submitted, { by: "hod", action: "reject" }];
  const atPurchase = [...submitted, { by: "hod" as Role, action: "approve" as Action }];
  if (target === "purchase") return atPurchase;
  if (target === "void") return [...atPurchase, { by: "purchase", action: "reject" }];
  const atGm = [...atPurchase, { by: "purchase" as Role, action: "purchase" as Action }];
  if (target === "gm") return atGm;
  return [...atGm, { by: "gm", action: "approve" }];
}

const detailsOf = (doc: any): any[] => doc?.purchase_request_detail ?? doc?.details ?? [];

function createBody(ctx: SeedContext, pr: PlannedPr) {
  return {
    stage_role: "create",
    details: {
      pr_date: isoDay(ctx.today),
      description: `STD ${pr.row}`,
      requestor_id: ctx.users[pr.requestor]?.id,
      workflow_id: ctx.workflows.pr,
      department_id: pr.departmentId,
      purchase_request_detail: {
        add: pr.lines.map((l) => {
          const product = ctx.products[l.productIndex];
          return {
            product_id: product.id,
            location_id: ctx.locations.first.id,
            delivery_point_id: ctx.deliveryPointId,
            ...(pr.deliveryDate ? { delivery_date: isoDay(pr.deliveryDate) } : {}),
            requested_qty: l.qty,
            requested_unit_id: product.unitId,
            currency_id: ctx.currencyId,
            exchange_rate: 1,
            inventory_unit_id: product.unitId,
            ...(l.focQty ? { foc_qty: l.focQty, foc_unit_id: product.unitId } : {}),
            description: `STD ${pr.row}`,
            comment: "",
          };
        }),
      },
    },
  };
}

function actionBody(ctx: SeedContext, pr: PlannedPr, action: Action, by: Role, v: number, doc: any) {
  const lines = detailsOf(doc);
  const approveLine = (l: any) => ({
    id: l.id, purchase_request_id: doc.id, stage_status: "approve", stage_message: null,
    approved_qty: l.requested_qty, approved_unit_id: refId(l, "requested_unit"),
  });
  switch (action) {
    case "submit":
      return { doc_version: v, stage_role: "create", details: lines.map((l) => ({ id: l.id, stage_status: "submit", stage_message: null })) };
    case "approve":
      return { doc_version: v, stage_role: "approve", details: lines.map(approveLine) };
    case "purchase": {
      const price = pr.highValue ? HIGH_PRICE : PRICE;
      return {
        doc_version: v,
        stage_role: "purchase",
        details: lines.map((l) => {
          const total = price * Number(l.requested_qty ?? 0);
          return {
            ...approveLine(l), vendor_id: ctx.vendor.id, currency_id: ctx.currencyId, exchange_rate: 1,
            tax_profile_id: ctx.taxProfileId, tax_rate: 0, tax_amount: 0, is_tax_adjustment: false,
            sub_total_price: total, net_amount: total, total_price: total,
            base_sub_total_price: total, base_net_amount: total, base_total_price: total,
            pricelist_detail_id: null, pricelist_no: null, foc_qty: l.foc_qty ?? 0,
          };
        }),
      };
    }
    case "review":
      return {
        doc_version: v, stage_role: "approve", des_stage: "Create Request",
        details: lines.map((l) => ({ id: l.id, stage_status: "review", stage_message: "STD returned" })),
      };
    case "reject":
      return {
        doc_version: v, stage_role: by === "purchase" ? "purchase" : "approve",
        details: lines.map((l) => ({ id: l.id, stage_status: "reject", stage_message: "STD rejected" })),
      };
    default:
      throw new Error(`no body for ${action}`);
  }
}

/** Create one PR and walk it to its target; returns its id or the reason it stopped. */
async function seedOne(
  sessions: Sessions, cfg: ResetConfig, ctx: SeedContext, pr: PlannedPr,
): Promise<{ id?: string; no?: string; failure?: string }> {
  const base = `/api/${cfg.buCode}/purchase-requests`;
  const client = (role: Role): Promise<ApiClient> => sessions.client(role === "requestor" ? pr.requestor : mail(role));
  const [first, ...rest] = prActions(pr.target);
  const created = await createDoc(await client(first.by), base, createBody(ctx, pr));
  if (!created.ok || !created.id) return { failure: why(`create ${pr.row}`, created) };
  for (const step of rest) {
    const action = step.action === "purchase" ? "approve" : step.action;
    const res = await transition(await client(step.by), `${base}/${created.id}`, action, (v, doc) =>
      actionBody(ctx, pr, step.action, step.by, v, doc),
    );
    if (!res.ok) return { id: created.id, no: created.no, failure: why(`${step.by} ${step.action} ${created.no ?? created.id}`, res) };
  }
  return { id: created.id, no: created.no };
}

export async function seedPurchaseRequests(
  sessions: Sessions, cfg: ResetConfig, ctx: SeedContext, ledger: RowLedger,
): Promise<StepResult & { reservedForPo: string }> {
  const result = { step: "purchase-requests", created: 0, skipped: 0, failed: [] as string[], reservedForPo: "" };
  for (const pr of planPurchaseRequests(ctx)) {
    const out = await seedOne(sessions, cfg, ctx, pr);
    if (out.failure) {
      result.failed.push(out.failure);
      ledger.record(pr.row, null, false, out.failure);
      continue;
    }
    result.created += 1;
    ledger.record(pr.row, out.no ?? out.id ?? null, true);
    if (pr.target === "completed-reserve") result.reservedForPo = out.id!;
  }
  return result;
}

export async function seedPrTemplate(
  sessions: Sessions, cfg: ResetConfig, ctx: SeedContext, ledger: RowLedger,
): Promise<StepResult> {
  const purchase = await sessions.client(mail("purchase"));
  const created = await createDoc(purchase, `/api/${cfg.buCode}/purchase-request-templates`, {
    name: "STD PR template",
    workflow_id: ctx.workflows.pr,
    is_active: true,
    note: "STD pr-template.active",
    purchase_request_template_detail: {
      add: ctx.products.slice(0, 2).map((p) => ({
        product_id: p.id, location_id: ctx.locations.first.id, delivery_point_id: ctx.deliveryPointId,
        requested_qty: 5, requested_unit_id: p.unitId, currency_id: ctx.currencyId, tax_profile_id: ctx.taxProfileId, foc_qty: 0,
      })),
    },
  });
  if (!created.ok) {
    const reason = why("create PR template", created);
    ledger.record("pr-template.active", null, false, reason);
    return { step: "pr-template", created: 0, skipped: 0, failed: [reason] };
  }
  ledger.record("pr-template.active", created.no ?? created.id ?? "template", true);
  return { step: "pr-template", created: 1, skipped: 0, failed: [] };
}
