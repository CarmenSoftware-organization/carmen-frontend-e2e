// scripts/data-reset/docs/store-requisitions.ts
// Store requisitions from location 1 (stocked in the stock step) to location 2, all by purchase:
// the SR workflow puts purchase on Create, Store Approval and Issue. There is no cancel endpoint,
// so "Cancelled" is a rejected SR (voided).
// ใบเบิกจาก location 1 ไป 2 ทำโดย purchase ทั้งหมด — ไม่มี endpoint ยกเลิก "Cancelled" จึงใช้การ reject
import type { ResetConfig } from "../config";
import type { Sessions } from "../sessions";
import type { StepResult } from "../step-result";
import type { SeedContext } from "./context";
import { addDays } from "./dates";
import type { RowLedger } from "./row-ledger";
import { createDoc, transition, why } from "./transition";

export type SrTarget = "draft" | "approve" | "ready-for-issue" | "cancelled" | "completed";
type Action = "create" | "submit" | "approve" | "reject" | "issue";

const PURCHASE = "carmensoftware.dev+purchase@gmail.com";
const QTY = 5;

export function planStoreRequisitions(): Array<{ row: string; target: SrTarget }> {
  const rows: Array<[SrTarget, number]> = [["draft", 2], ["approve", 2], ["ready-for-issue", 1], ["cancelled", 1], ["completed", 1]];
  return rows.flatMap(([target, n]) => Array.from({ length: n }, () => ({ row: `sr.${target}`, target })));
}

export function srActions(target: SrTarget): Action[] {
  if (target === "draft") return ["create"];
  if (target === "approve") return ["create", "submit"];
  if (target === "ready-for-issue") return ["create", "submit", "approve"];
  if (target === "cancelled") return ["create", "submit", "reject"];
  return ["create", "submit", "approve", "issue"];
}

const detailsOf = (doc: any): any[] => doc?.store_requisition_detail ?? doc?.details ?? [];

function stepBody(action: Action, v: number, doc: any) {
  const lines = detailsOf(doc);
  switch (action) {
    case "submit":
      return { doc_version: v, stage_role: "create", sr_date_pattern: "today", details: lines.map((l) => ({ id: l.id, stage_status: "submit", stage_message: null })) };
    case "approve":
      return { doc_version: v, stage_role: "approve", details: lines.map((l) => ({ id: l.id, stage_status: "approve", stage_message: null, approved_qty: Number(l.requested_qty ?? QTY) })) };
    case "issue":
      return {
        doc_version: v, stage_role: "issue", issue_date_pattern: "today",
        details: lines.map((l) => ({ id: l.id, stage_status: "approve", stage_message: null, issued_qty: Number(l.approved_qty ?? l.requested_qty ?? QTY) })),
      };
    case "reject":
      return { doc_version: v, stage_role: "approve", details: lines.map((l) => ({ id: l.id, stage_status: "reject", stage_message: "STD cancelled" })) };
    default:
      throw new Error(`no body for ${action}`);
  }
}

export async function seedStoreRequisitions(
  sessions: Sessions, cfg: ResetConfig, ctx: SeedContext, ledger: RowLedger,
): Promise<StepResult> {
  const result: StepResult = { step: "store-requisitions", created: 0, skipped: 0, failed: [] };
  const purchase = await sessions.client(PURCHASE);
  const base = `/api/${cfg.buCode}/store-requisitions`;
  for (const { row, target } of planStoreRequisitions()) {
    const created = await createDoc(purchase, base, {
      stage_role: "create",
      details: {
        sr_date: ctx.today,
        expected_date: addDays(ctx.today, 1),
        requestor_id: ctx.users[PURCHASE]?.id,
        workflow_id: ctx.workflows.sr,
        department_id: ctx.departments.first.id,
        from_location_id: ctx.locations.first.id,
        to_location_id: ctx.locations.second.id,
        description: `STD ${row}`,
        store_requisition_detail: { add: ctx.products.slice(3, 5).map((p) => ({ product_id: p.id, requested_qty: QTY })) },
      },
    });
    if (!created.ok || !created.id) {
      const reason = why(`create ${row}`, created);
      result.failed.push(reason);
      ledger.record(row, null, false, reason);
      continue;
    }
    let failure: string | null = null;
    for (const action of srActions(target).slice(1)) {
      const endpoint = action === "issue" ? "approve" : action;
      const res = await transition(purchase, `${base}/${created.id}`, endpoint, (v, doc) => stepBody(action, v, doc));
      if (!res.ok) {
        failure = why(`${action} ${created.no ?? created.id}`, res);
        break;
      }
    }
    if (failure) {
      result.failed.push(failure);
      ledger.record(row, null, false, failure);
      continue;
    }
    result.created += 1;
    ledger.record(row, created.no ?? created.id, true);
  }
  return result;
}
