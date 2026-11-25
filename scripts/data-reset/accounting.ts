// scripts/data-reset/accounting.ts
// What AP + GL posting needs on TEST BU before any document can post: gl_setting account ids, an open
// GL period, a bank account, tax profiles mapped to accounts, and an AP control account per vendor.
// A reset empties all of it. Every write is skipped when the row already says what we want.
// สิ่งที่ AP + GL ต้องมีก่อน post ได้: gl_setting, งวด GL, บัญชีธนาคาร, tax profile ที่ผูกบัญชี, บัญชีเจ้าหนี้ของ vendor
import type { ApiClient } from "../seed-master/api-client";
import type { ResetConfig } from "./config";
import { localDate } from "./period";
import type { Sessions } from "./sessions";
import { rowsOf, type StepResult } from "./step-result";

/** COA ids the AP / GL posting paths resolve accounts from (consumed by roles / workflows / specs). */
export interface AccountingAccounts {
  apControl: string;
  inputVat: string;
  whtPayable: string;
  advanceDeposit: string;
  expense: string;
  inventory: string;
  bank: string;
  fxGain: string;
  fxLoss: string;
  arControl: string;
  outputVat: string;
}

/** Account code per role, from `fixtures/chart-of-accounts.json`. */
export const ACCOUNT_CODES: Record<keyof AccountingAccounts, string> = {
  apControl: "2100",
  inputVat: "1170",
  whtPayable: "2150",
  advanceDeposit: "1180",
  expense: "5300",
  inventory: "1140",
  bank: "1110",
  fxGain: "4300",
  fxLoss: "5400",
  arControl: "1130",
  outputVat: "2160",
};

/** GL JV prefixes the AP posting path needs: AP / auto vouchers, and reversal (void / reverse). */
export const JV_PREFIXES = {
  ap: { code: "APJV", description: "AP voucher (e2e)" },
  reversal: { code: "APRV", description: "AP reversal voucher (e2e)" },
} as const;
export const BANK_ACCOUNT_CODE = "E2E-BANK";
export const VAT_PROFILE_NAME = "Vat 7%";
export const WHT_PROFILE_NAME = "WHT 3%";
/** Period 1 starts in January; the GL period API derives the 13 ranges from this. */
const FISCAL_YEAR_START_MONTH = 1;

interface Row { id: string; [k: string]: unknown }

function emptyAccounts(): AccountingAccounts {
  return Object.fromEntries(Object.keys(ACCOUNT_CODES).map((k) => [k, ""])) as unknown as AccountingAccounts;
}

const note = (res: { status: number; body?: { message?: unknown } }) => `${res.status} ${JSON.stringify(res.body?.message ?? "")}`;

export async function resolveAccounts(admin: ApiClient, base: string, result: StepResult): Promise<AccountingAccounts | null> {
  const list = await admin.get(`${base}/chart-of-accounts?perpage=100`);
  if (!list.ok) {
    result.failed.push(`GET ${base}/chart-of-accounts → ${list.status}`);
    return null;
  }
  const idByCode = new Map(rowsOf<{ id: string; code: string }>(list.body).map((a) => [a.code, a.id]));
  const accounts = emptyAccounts();
  const missing: string[] = [];
  for (const [role, code] of Object.entries(ACCOUNT_CODES) as [keyof AccountingAccounts, string][]) {
    const id = idByCode.get(code);
    if (id) accounts[role] = id;
    else missing.push(`${role} (${code})`);
  }
  if (missing.length > 0) {
    result.failed.push(`chart of accounts lacks ${missing.join(", ")}`);
    return null;
  }
  return accounts;
}

interface JvPrefixIds { ap: string; reversal: string }

/** Create the AP and reversal JV prefixes unless their codes exist; returns their ids. */
async function seedJvPrefixes(admin: ApiClient, base: string, result: StepResult): Promise<JvPrefixIds | null> {
  const path = `${base}/gl-jv-prefixes`;
  const list = await admin.get(`${path}?perpage=100`);
  if (!list.ok) {
    result.failed.push(`GET ${path} → ${list.status}`);
    return null;
  }
  const rows = rowsOf<Row>(list.body);
  const ids: Partial<JvPrefixIds> = {};
  for (const [role, want] of Object.entries(JV_PREFIXES) as [keyof JvPrefixIds, { code: string; description: string }][]) {
    const existing = rows.find((r) => r.code === want.code);
    if (existing) {
      ids[role] = existing.id;
      result.skipped++;
      continue;
    }
    const res = await admin.post(path, { code: want.code, description: want.description, is_active: true, is_default: false });
    const id = (res.body?.data as { id?: string } | undefined)?.id;
    if (!res.ok || !id) {
      result.failed.push(`POST ${path} ${want.code} → ${note(res)}`);
      return null;
    }
    ids[role] = id;
    result.created++;
  }
  return ids as JvPrefixIds;
}

async function seedGlSetting(admin: ApiClient, base: string, a: AccountingAccounts, prefixes: JvPrefixIds, result: StepResult): Promise<void> {
  const path = `${base}/app-config/gl_setting`;
  const current = await admin.get(path);
  // 404 = key not created yet; any other failure must not be read as "empty" and overwrite real settings.
  if (!current.ok && current.status !== 404) {
    result.failed.push(`GET ${path} → ${current.status}`);
    return;
  }
  const existing = (current.ok ? (current.body?.data?.value as Record<string, unknown> | undefined) : undefined) ?? {};
  const desired = {
    fiscal_year_start_month: existing.fiscal_year_start_month ?? FISCAL_YEAR_START_MONTH,
    ap_control_account_id: a.apControl,
    input_vat_account_id: a.inputVat,
    wht_payable_account_id: a.whtPayable,
    advance_deposit_account_id: a.advanceDeposit,
    realized_fx_gain_account_id: a.fxGain,
    realized_fx_loss_account_id: a.fxLoss,
    ar_control_account_id: a.arControl,
    output_vat_account_id: a.outputVat,
    ap_jv_prefix_id: prefixes.ap,
    auto_jv_prefix_id: prefixes.ap,
    reversal_prefix_id: prefixes.reversal,
    ap_auto_from_grn: false,
  };
  if (Object.entries(desired).every(([k, v]) => existing[k] === v)) {
    result.skipped++;
    return;
  }
  const res = await admin.put(path, { value: { ...existing, ...desired } });
  if (res.ok) result.created++;
  else result.failed.push(`PUT ${path} → ${note(res)}`);
}

async function seedGlPeriod(admin: ApiClient, base: string, now: Date, result: StepResult): Promise<void> {
  const path = `${base}/gl-periods`;
  const today = localDate(now);
  const list = await admin.get(path);
  if (!list.ok) {
    result.failed.push(`GET ${path} → ${list.status}`);
    return;
  }
  // start_at/end_at are UTC calendar-day bounds (observed 2026-01-01T00:00:00.000Z .. 2026-01-31T23:59:59.999Z), so slice(0, 10) is the period day.
  const covers = rowsOf<{ status?: string; start_at?: string; end_at?: string }>(list.body).some(
    (p) => p.status === "open" && !!p.start_at && !!p.end_at && p.start_at.slice(0, 10) <= today.day && today.day <= p.end_at.slice(0, 10),
  );
  if (covers) {
    result.skipped++;
    return;
  }
  const res = await admin.post(`${path}/years`, { fiscal_year: today.year });
  if (res.ok) result.created++;
  else result.failed.push(`POST ${path}/years → ${note(res)}`);
}

async function seedBankAccount(admin: ApiClient, base: string, bankCoaId: string, result: StepResult): Promise<void> {
  const path = `${base}/bank-accounts`;
  const currencies = await admin.get(`${base}/currencies?perpage=100`);
  const thb = rowsOf<{ id: string; code: string }>(currencies.body).find((c) => c.code === "THB");
  if (!thb) {
    result.failed.push(`no THB currency for the bank account (GET currencies → ${currencies.status})`);
    return;
  }
  const list = await admin.get(`${path}?perpage=100`);
  if (!list.ok) {
    result.failed.push(`GET ${path} → ${list.status}`);
    return;
  }
  const existing = rowsOf<Row>(list.body).find((b) => b.code === BANK_ACCOUNT_CODE);
  if (existing && existing.chart_of_accounts_id === bankCoaId && existing.is_active !== false) {
    result.skipped++;
    return;
  }
  const res = existing
    ? await admin.put(`${path}/${existing.id}`, { doc_version: Number(existing.doc_version ?? 0), chart_of_accounts_id: bankCoaId, is_active: true })
    : await admin.post(path, {
        code: BANK_ACCOUNT_CODE, name: "E2E Bank Current THB", bank_name: "E2E Bank", account_no: "000-0-00000-0",
        currency_id: thb.id, chart_of_accounts_id: bankCoaId, is_active: true,
      });
  if (res.ok) result.created++;
  else result.failed.push(`${existing ? "PUT" : "POST"} ${path} → ${note(res)}`);
}

async function seedTaxProfiles(admin: ApiClient, base: string, a: AccountingAccounts, result: StepResult): Promise<void> {
  const path = `${base}/tax-profiles`;
  const list = await admin.get(`${path}?perpage=100`);
  if (!list.ok) {
    result.failed.push(`GET ${path} → ${list.status}`);
    return;
  }
  const rows = rowsOf<Row>(list.body);
  const wanted = [
    { name: VAT_PROFILE_NAME, tax_type: "vat", tax_rate: 7, chart_of_accounts_id: a.inputVat },
    { name: WHT_PROFILE_NAME, tax_type: "wht", tax_rate: 3, chart_of_accounts_id: a.whtPayable, wht_pnd_form: "pnd_53" },
  ];
  for (const want of wanted) {
    const existing = rows.find((r) => r.name === want.name);
    if (existing && existing.chart_of_accounts_id === want.chart_of_accounts_id && existing.is_active !== false) {
      result.skipped++;
      continue;
    }
    // Existing profile (the workbook's "Vat 7%"): only map the account — never change its name or rate.
    const res = existing
      ? await admin.patch(`${path}/${existing.id}`, { doc_version: Number(existing.doc_version ?? 0), chart_of_accounts_id: want.chart_of_accounts_id, is_active: true })
      : await admin.post(path, { ...want, is_active: true });
    if (res.ok) result.created++;
    else result.failed.push(`${existing ? "PATCH" : "POST"} ${path} ${want.name} → ${note(res)}`);
  }
}

async function seedVendorApAccounts(admin: ApiClient, base: string, apControlId: string, result: StepResult): Promise<void> {
  const path = `${base}/vendors`;
  const perPage = 100;
  const vendors: { id: string; code: string }[] = [];
  for (let page = 1; page <= 50; page++) {
    const list = await admin.get(`${path}?perpage=${perPage}&page=${page}`);
    if (!list.ok) {
      result.failed.push(`GET ${path} page ${page} → ${list.status}`);
      return;
    }
    const rows = rowsOf<{ id: string; code: string }>(list.body);
    vendors.push(...rows);
    if (rows.length < perPage) break;
  }
  for (const vendor of vendors) {
    const detail = await admin.get(`${path}/${vendor.id}`);
    const row = detail.body?.data as Row | undefined;
    if (!detail.ok || !row) {
      result.failed.push(`GET ${path}/${vendor.code} → ${detail.status}`);
      continue;
    }
    if (row.ap_chart_of_accounts_id === apControlId) {
      result.skipped++;
      continue;
    }
    // Vendors update with PUT and need doc_version (see mappings.ts).
    const res = await admin.put(`${path}/${vendor.id}`, { doc_version: Number(row.doc_version ?? 0), ap_chart_of_accounts_id: apControlId });
    if (res.ok) result.created++;
    else result.failed.push(`PUT ${path}/${vendor.code} → ${note(res)}`);
  }
}

/** Run after `coa` (needs its account ids), before mappings / workflows. */
export async function seedAccountingBase(
  sessions: Sessions, cfg: ResetConfig, now: Date = new Date(),
): Promise<StepResult & { accounts: AccountingAccounts }> {
  const admin = await sessions.client(cfg.adminEmail);
  const base = `/api/config/${cfg.buCode}`;
  const result: StepResult = { step: "accounting", created: 0, skipped: 0, failed: [] };
  const accounts = await resolveAccounts(admin, base, result);
  if (!accounts) return { ...result, accounts: emptyAccounts() };
  // gl_setting first: the GL period endpoint reads fiscal_year_start_month from it.
  const prefixes = await seedJvPrefixes(admin, base, result);
  if (prefixes) await seedGlSetting(admin, base, accounts, prefixes, result);
  if (result.failed.length === 0) await seedGlPeriod(admin, base, now, result);
  await seedBankAccount(admin, base, accounts.bank, result);
  await seedTaxProfiles(admin, base, accounts, result);
  await seedVendorApAccounts(admin, base, accounts.apControl, result);
  return { ...result, accounts };
}
