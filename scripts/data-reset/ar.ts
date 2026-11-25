// scripts/data-reset/ar.ts
// AR master data the AR Invoice specs read: two customers, one cost center, and the revenue account /
// tax profile ids. Find-or-create by code; a 409 (code already held, e.g. by a soft-deleted row) is
// treated as "exists" and re-listed. Run after `accounting` (needs the 1130 account and tax profiles).
// ข้อมูลหลัก AR: ลูกค้า 2 ราย, cost center, และ id ของบัญชีรายได้ / tax profile
import type { ApiClient } from "../seed-master/api-client";
import { ACCOUNT_CODES, VAT_PROFILE_NAME } from "./accounting";
import type { ResetConfig } from "./config";
import type { Sessions } from "./sessions";
import { rowsOf, type StepResult } from "./step-result";

export const AR_COST_CENTER_CODE = "E2E-CC-1";
export const AR_CUSTOMER_CODES = { customer1: "E2E-CUST-1", customer2: "E2E-CUST-2" } as const;
export const REVENUE_ACCOUNT_CODE = "4100";
export const NO_VAT_PROFILE_NAME = "None";

/** Ids Task 4's document seeder (and specs) resolve against. */
export interface ArSetup {
  customer1: string;
  customer2: string;
  costCenter: string;
  revenue: string;
  vatProfile: string;
  noVatProfile: string;
}

interface Row { id: string; code?: string; name?: string; [k: string]: unknown }

const note = (res: { status: number; body?: { message?: unknown } }) => `${res.status} ${JSON.stringify(res.body?.message ?? "")}`;

/** Return the id of the row with `code`, creating it with `payload` when absent. */
async function ensureByCode(
  admin: ApiClient, path: string, code: string, payload: Record<string, unknown>, result: StepResult,
): Promise<string | null> {
  const find = async (): Promise<Row | undefined> => {
    const list = await admin.get(`${path}?perpage=100`);
    if (!list.ok) {
      result.failed.push(`GET ${path} → ${list.status}`);
      return undefined;
    }
    return rowsOf<Row>(list.body).find((r) => r.code === code);
  };
  const existing = await find();
  if (result.failed.length > 0) return null;
  if (existing) {
    result.skipped++;
    return existing.id;
  }
  const res = await admin.post(path, payload);
  const id = (res.body?.data as { id?: string } | undefined)?.id;
  if (res.ok && id) {
    result.created++;
    return id;
  }
  if (res.status === 409) {
    const again = await find();
    if (again) {
      result.skipped++;
      return again.id;
    }
  }
  result.failed.push(`POST ${path} ${code} → ${note(res)}`);
  return null;
}

export async function seedArBase(sessions: Sessions, cfg: ResetConfig): Promise<StepResult & { setup?: ArSetup }> {
  const admin = await sessions.client(cfg.adminEmail);
  const base = `/api/config/${cfg.buCode}`;
  const result: StepResult = { step: "ar", created: 0, skipped: 0, failed: [] };

  const coa = await admin.get(`${base}/chart-of-accounts?perpage=100`);
  const profiles = await admin.get(`${base}/tax-profiles?perpage=100`);
  if (!coa.ok) result.failed.push(`GET ${base}/chart-of-accounts → ${coa.status}`);
  if (!profiles.ok) result.failed.push(`GET ${base}/tax-profiles → ${profiles.status}`);
  if (result.failed.length > 0) return result;
  const accountId = (code: string) => rowsOf<Row>(coa.body).find((a) => a.code === code)?.id;
  const profileId = (name: string) => rowsOf<Row>(profiles.body).find((p) => p.name === name)?.id;
  const arControl = accountId(ACCOUNT_CODES.arControl);
  const revenue = accountId(REVENUE_ACCOUNT_CODE);
  const vatProfile = profileId(VAT_PROFILE_NAME);
  const noVatProfile = profileId(NO_VAT_PROFILE_NAME);
  if (!arControl) result.failed.push(`chart of accounts lacks AR control (${ACCOUNT_CODES.arControl})`);
  if (!revenue) result.failed.push(`chart of accounts lacks revenue (${REVENUE_ACCOUNT_CODE})`);
  if (!vatProfile) result.failed.push(`tax profile "${VAT_PROFILE_NAME}" not found`);
  if (!noVatProfile) result.failed.push(`tax profile "${NO_VAT_PROFILE_NAME}" not found`);
  if (result.failed.length > 0 || !arControl || !revenue || !vatProfile || !noVatProfile) return result;

  const costCenter = await ensureByCode(admin, `${base}/cost-centers`, AR_COST_CENTER_CODE,
    { code: AR_COST_CENTER_CODE, name: "E2E Cost Center 1", is_active: true }, result);
  const customer1 = await ensureByCode(admin, `${base}/customers`, AR_CUSTOMER_CODES.customer1, {
    code: AR_CUSTOMER_CODES.customer1, name: "E2E Customer 1", registered_name: "E2E Customer 1 Co., Ltd.",
    tax_no: "0105500000001", branch_no: "00000", ar_chart_of_accounts_id: arControl, is_active: true,
    customer_address: { add: [{
      address_type: "register_address", address_line1: "1 E2E Road", sub_district: "Silom", district: "Bang Rak",
      province: "Bangkok", postal_code: "10500", country: "Thailand",
    }] },
  }, result);
  const customer2 = await ensureByCode(admin, `${base}/customers`, AR_CUSTOMER_CODES.customer2,
    { code: AR_CUSTOMER_CODES.customer2, name: "E2E Customer 2", is_active: true }, result);
  if (!costCenter || !customer1 || !customer2) return result;
  return { ...result, setup: { customer1, customer2, costCenter, revenue, vatProfile, noVatProfile } };
}
