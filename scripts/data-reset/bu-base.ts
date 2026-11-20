// scripts/data-reset/bu-base.ts
// What the reset leaves broken on the BU itself, not in a list: the BU row keeps its old
// `default_currency_id` while the reset recreates currencies with new ids (every page then shows
// "default currency ... no longer exists"), and the chart of accounts is emptied with no source
// in the seed workbook.
// สิ่งที่ reset ทิ้งไว้พังที่ตัว BU: default_currency_id ชี้ id เก่า และผังบัญชีว่าง (workbook ไม่มี COA)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { ResetConfig } from "./config";
import type { Sessions } from "./sessions";
import { rowsOf, type StepResult } from "./step-result";

export const DEFAULT_CURRENCY_CODE = "THB";

export interface CoaFixtureAccount {
  code: string;
  description_1: string;
  category: string;
  nature: string;
  type: string;
}

export function loadCoaFixture(): CoaFixtureAccount[] {
  const path = fileURLToPath(new URL("./fixtures/chart-of-accounts.json", import.meta.url));
  return JSON.parse(readFileSync(path, "utf8")).accounts as CoaFixtureAccount[];
}

/** Point the BU's default currency at the THB row the master seed just created. */
export async function seedBuCurrency(sessions: Sessions, cfg: ResetConfig): Promise<StepResult> {
  const admin = await sessions.client(cfg.adminEmail);
  const result: StepResult = { step: "bu-currency", created: 0, skipped: 0, failed: [] };
  const list = await admin.get(`/api/config/${cfg.buCode}/currencies?perpage=100`);
  const currency = rowsOf<{ id: string; code: string }>(list.body).find((c) => c.code === DEFAULT_CURRENCY_CODE);
  if (!currency) {
    result.failed.push(`no ${DEFAULT_CURRENCY_CODE} currency in ${cfg.buCode} (GET currencies → ${list.status})`);
    return result;
  }
  const bu = await admin.get("/api/business-units");
  const row = bu.body?.data as { id?: string; doc_version?: number; default_currency_id?: string | null } | undefined;
  if (!bu.ok || !row?.id) {
    result.failed.push(`GET /api/business-units → ${bu.status}`);
    return result;
  }
  if (row.default_currency_id === currency.id) {
    result.skipped = 1;
    return result;
  }
  const res = await admin.patch("/api/business-units", { id: row.id, doc_version: row.doc_version, default_currency_id: currency.id });
  if (res.ok) result.created = 1;
  else result.failed.push(`PATCH /api/business-units → ${res.status} ${JSON.stringify(res.body?.message ?? "")}`);
  return result;
}

/** Create the minimal chart of accounts; accounts already present (by code) are left alone. */
export async function seedChartOfAccounts(
  sessions: Sessions, cfg: ResetConfig, accounts: CoaFixtureAccount[] = loadCoaFixture(),
): Promise<StepResult> {
  const admin = await sessions.client(cfg.adminEmail);
  const base = `/api/config/${cfg.buCode}/chart-of-accounts`;
  const result: StepResult = { step: "coa", created: 0, skipped: 0, failed: [] };
  const existing = await admin.get(`${base}?perpage=100`);
  if (!existing.ok) {
    result.failed.push(`GET ${base} → ${existing.status}`);
    return result;
  }
  const have = new Set(rowsOf<{ code: string }>(existing.body).map((a) => a.code));
  for (const account of accounts) {
    if (have.has(account.code)) {
      result.skipped++;
      continue;
    }
    const res = await admin.post(base, { ...account, is_active: true });
    if (res.ok) result.created++;
    else result.failed.push(`POST ${base} ${account.code} → ${res.status} ${JSON.stringify(res.body?.message ?? "")}`);
  }
  return result;
}
