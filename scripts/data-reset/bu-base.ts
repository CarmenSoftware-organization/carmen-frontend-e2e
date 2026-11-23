// scripts/data-reset/bu-base.ts
// What the reset leaves broken on the BU itself, not in a list: the BU row keeps its old
// `default_currency_id` while the reset recreates currencies with new ids (every page then shows
// "default currency ... no longer exists"), and the chart of accounts is emptied with no source
// in the seed workbook.
// สิ่งที่ reset ทิ้งไว้พังที่ตัว BU: default_currency_id ชี้ id เก่า และผังบัญชีว่าง (workbook ไม่มี COA)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { BU_CODE } from "../../tests/test-users";
import type { ResetConfig } from "./config";
import { findBuId } from "./reset";
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

/**
 * `PATCH /api/business-units` writes the caller's default BU and refuses any other id
 * (409 BUSINESS_UNIT_NOT_CURRENT). For a target other than BU_CODE, switch the admin session's
 * default to it, run `fn`, and always switch back to BU_CODE; a failed restore is a loud failure.
 * For BU_CODE itself nothing is switched.
 * เขียนได้เฉพาะ BU default ของ admin — BU อื่นต้องสลับ default ไปก่อนแล้วคืนเป็น BU_CODE เสมอ
 */
export async function withAdminDefaultBu<T extends StepResult>(
  sessions: Sessions, cfg: ResetConfig, result: T, fn: () => Promise<T>,
): Promise<T> {
  if (cfg.buCode === BU_CODE) return fn();
  const admin = await sessions.client(cfg.adminEmail);
  const profile = await admin.get("/api/user/profile");
  if (!profile.ok) {
    result.failed.push(`GET /api/user/profile → ${profile.status} — cannot switch default BU to ${cfg.buCode}`);
    return result;
  }
  let targetId: string;
  let homeId: string;
  try {
    targetId = findBuId(profile.body, cfg.buCode);
    homeId = findBuId(profile.body, BU_CODE);
  } catch (err) {
    result.failed.push(err instanceof Error ? err.message : String(err));
    return result;
  }
  const switchTo = (id: string) => admin.post("/api/business-units/default", { tenant_id: id });
  const first = await switchTo(targetId);
  if (!first.ok) {
    result.failed.push(`POST /api/business-units/default (${cfg.buCode}) → ${first.status}`);
    return result;
  }
  try {
    return await fn();
  } finally {
    // Never throw from here: it would mask an error thrown by fn().
    try {
      const back = await switchTo(homeId);
      if (!back.ok) {
        const line = `RESTORE FAILED: POST /api/business-units/default (${BU_CODE}) → ${back.status} — admin's default BU is still ${cfg.buCode}; switch it back by hand`;
        result.failed.push(line);
        console.error(line);
      }
    } catch (err) {
      const line = `RESTORE FAILED: POST /api/business-units/default (${BU_CODE}) threw ${err instanceof Error ? err.message : String(err)} — admin's default BU may still be ${cfg.buCode}; switch it back by hand`;
      result.failed.push(line);
      console.error(line);
    }
  }
}

/** Point the BU's default currency at the THB row the master seed just created. */
export async function seedBuCurrency(sessions: Sessions, cfg: ResetConfig): Promise<StepResult> {
  const result: StepResult = { step: "bu-currency", created: 0, skipped: 0, failed: [] };
  return withAdminDefaultBu(sessions, cfg, result, () => seedBuCurrencyInner(sessions, cfg, result));
}

async function seedBuCurrencyInner(sessions: Sessions, cfg: ResetConfig, result: StepResult): Promise<StepResult> {
  const admin = await sessions.client(cfg.adminEmail);
  const list = await admin.get(`/api/config/${cfg.buCode}/currencies?perpage=100`);
  const currency = rowsOf<{ id: string; code: string }>(list.body).find((c) => c.code === DEFAULT_CURRENCY_CODE);
  if (!currency) {
    result.failed.push(`no ${DEFAULT_CURRENCY_CODE} currency in ${cfg.buCode} (GET currencies → ${list.status})`);
    return result;
  }
  // Both calls act on the session's current BU, not on a code in the URL: assert it is TEST BU
  // before writing, otherwise a mismatch would patch another BU.
  type BuRow = { id?: string; code?: string; doc_version?: number; default_currency_id?: string | null };
  const readBu = async (): Promise<{ row?: BuRow; status: number }> => {
    const bu = await admin.get("/api/business-units");
    return { row: bu.ok ? (bu.body?.data as BuRow | undefined) : undefined, status: bu.status };
  };
  let { row, status } = await readBu();
  if (!row?.id) {
    result.failed.push(`GET /api/business-units → ${status}`);
    return result;
  }
  if (row.code !== cfg.buCode) {
    result.failed.push(`current BU of ${cfg.adminEmail} is ${row.code ?? "unknown"}, not ${cfg.buCode} — refusing to PATCH /api/business-units`);
    return result;
  }
  if (row.default_currency_id === currency.id) {
    result.skipped = 1;
    return result;
  }
  const patch = (r: BuRow) => admin.patch("/api/business-units", { id: r.id, doc_version: r.doc_version, default_currency_id: currency.id });
  let res = await patch(row);
  if (res.status === 409) {
    // Someone edited the BU between our read and write: re-read once and retry once.
    ({ row, status } = await readBu());
    if (!row?.id || row.code !== cfg.buCode) {
      result.failed.push(`PATCH /api/business-units → 409, re-read gave ${row?.code ?? `status ${status}`}`);
      return result;
    }
    if (row.default_currency_id === currency.id) {
      result.skipped = 1;
      return result;
    }
    res = await patch(row);
  }
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
