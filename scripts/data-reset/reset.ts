// scripts/data-reset/reset.ts
// Calls the backend's tenant reset (carmen-turborepo-backend docs/ops-tenant-reset.md).
// เรียก endpoint reset ของ backend — ใช้ deploy token เท่านั้น ไม่ใช้ token ของ user
import type { ResetConfig } from "./config";

export interface ResetSummary {
  bu_id: string;
  bu_code: string;
  schema: string;
  tables_truncated: number;
  rows_removed: Record<string, number>;
  seeds: { success: boolean; created: number; skipped: number };
}

export type ResetOutcome =
  | { ok: true; summary: ResetSummary }
  | { ok: false; reason: "refused" | "unknown"; message: string };

const MAYBE_DONE =
  "the reset may have completed on the backend anyway (it keeps running after the gateway gives up). " +
  "Check the BU, then rerun with --skip-reset if it is empty — do not reset again blindly.";

export function findBuId(profileBody: unknown, buCode: string): string {
  const units = (profileBody as { data?: { business_unit?: Array<{ id: string; code: string }> } })?.data
    ?.business_unit ?? [];
  const unit = units.find((u) => u.code === buCode);
  if (!unit) throw new Error(`${buCode} is not in this account's business units`);
  return unit.id;
}

function unwrap(body: unknown): Partial<ResetSummary> {
  const b = body as { data?: Partial<ResetSummary> } & Partial<ResetSummary>;
  return b?.data && typeof b.data === "object" && "bu_code" in b.data ? b.data : b;
}

export async function callReset(cfg: ResetConfig, buId: string, fetchFn: typeof fetch = fetch): Promise<ResetOutcome> {
  if (!cfg.deployToken) throw new Error("DATA_RESET_DEPLOY_TOKEN is not set");
  let res: Response;
  try {
    res = await fetchFn(`${cfg.backendUrl}/api-system/tenant/resets/${buId}`, {
      method: "POST",
      headers: { "x-deploy-token": cfg.deployToken, "x-app-id": cfg.xAppId },
    });
  } catch (err) {
    return { ok: false, reason: "unknown", message: `Reset request failed (${String(err)}): ${MAYBE_DONE}` };
  }
  const body = await res.json().catch(() => null);
  if (res.status === 401 || res.status === 403) {
    return {
      ok: false,
      reason: "refused",
      message:
        `Reset refused (${res.status}): check that the dev backend has ${cfg.buCode} in ` +
        `TENANT_RESET_ALLOWED_BU_CODES (micro-business), TENANT_MIGRATION_API_ENABLED=true, and that ` +
        `DATA_RESET_DEPLOY_TOKEN matches TENANT_DEPLOY_TOKEN. ${JSON.stringify(body)}`,
    };
  }
  if (!res.ok) {
    return { ok: false, reason: "unknown", message: `Reset answered ${res.status}: ${MAYBE_DONE}` };
  }
  const summary = unwrap(body);
  if (summary.bu_code !== cfg.buCode) {
    return {
      ok: false,
      reason: "unknown",
      message: `Reset answered for BU ${String(summary.bu_code)}, not ${cfg.buCode} — stopping`,
    };
  }
  return { ok: true, summary: summary as ResetSummary };
}
