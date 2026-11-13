// scripts/data-reset/access.ts
// What a test account may do in TEST BU: its application role, and the BU's default currency.
// Neither comes back on its own — on 2026-11-11 only purchase held a role (the rest got
// "Permission Denied" on the PR pages) and the BU had no default currency (amounts fell back to THB
// with a warning banner on every page).
// สิทธิ์ของบัญชีเทสใน TEST BU (application role) และสกุลเงินหลักของ BU — ไม่มีใครตั้งให้เอง
import { TEST_USERS } from "../../tests/test-users";
import type { ResetConfig } from "./config";
import type { Sessions } from "./sessions";
import { rowsOf, type StepResult } from "./step-result";

const email = (local: string) => `carmensoftware.dev+${local}@gmail.com`;
const localPart = (account: string) => account.split("+")[1].split("@")[0];

/**
 * One role per account, by the role's name in the BU. Admin is left out: it is the BU admin
 * (`bu_role=admin`). No role grants SR approve/issue — those come from the SR workflow stages.
 */
export const ROLE_BY_EMAIL: Record<string, string> = {
  [email("requestor")]: "Requestor",
  [email("hod")]: "HOD",
  [email("purchase")]: "Purchase",
  [email("fc")]: "Approval",
  [email("gm")]: "Approval",
  [email("owner")]: "Approval",
  [email("storemanager")]: "Approval",
  [email("budget")]: "Accounting",
};

const DEFAULT_CURRENCY = "THB";

interface Role { id: string; name: string }
interface UserRoles { user_id: string; role_ids?: string[] }
/** Body of `POST /api/config/:bu/user-application-roles` — the API takes a diff, this only adds. */
interface RolePlan { user_id: string; application_role_id: { add: string[] } }

export function planRoleAssignments(
  roles: Role[],
  current: UserRoles[],
  userIds: Record<string, string>,
): { plans: RolePlan[]; problems: string[] } {
  const roleId = new Map(roles.map((r) => [r.name, r.id]));
  const held = new Map(current.map((u) => [u.user_id, new Set(u.role_ids ?? [])]));
  const plans: RolePlan[] = [];
  const missing = new Map<string, string[]>();
  for (const { email: account } of TEST_USERS) {
    const name = ROLE_BY_EMAIL[account];
    if (!name) continue;
    const id = roleId.get(name);
    if (!id) {
      missing.set(name, [...(missing.get(name) ?? []), localPart(account)]);
      continue;
    }
    const userId = userIds[account];
    if (held.get(userId)?.has(id)) continue;
    plans.push({ user_id: userId, application_role_id: { add: [id] } });
  }
  const problems = [...missing].map(
    ([name, who]) => `role "${name}" does not exist in the BU (needed by ${who.join(", ")})`,
  );
  return { plans, problems };
}

interface BusinessUnit { id: string; code: string; doc_version: number; default_currency_id: string | null }

/**
 * `PATCH /api/business-units` has no BU in its path — it writes the caller's default BU — so this
 * refuses unless that BU is the one being reset.
 */
export function planDefaultCurrency(
  bu: BusinessUnit,
  currencies: Array<{ id: string; code: string }>,
  buCode: string,
): { body: { id: string; doc_version: number; default_currency_id: string } | null } | { problem: string } {
  if (bu.code !== buCode) return { problem: `admin's default BU is ${bu.code}, not ${buCode} — refusing to set its currency` };
  if (bu.default_currency_id) return { body: null };
  const currency = currencies.find((c) => c.code === DEFAULT_CURRENCY);
  if (!currency) return { problem: `no ${DEFAULT_CURRENCY} currency in ${buCode} to make the default` };
  return { body: { id: bu.id, doc_version: Number(bu.doc_version ?? 0), default_currency_id: currency.id } };
}

export async function seedAccess(
  sessions: Sessions,
  cfg: ResetConfig,
  userIds: Record<string, string>,
): Promise<StepResult> {
  const admin = await sessions.client(cfg.adminEmail);
  const base = `/api/config/${cfg.buCode}`;
  const result: StepResult = { step: "access", created: 0, skipped: 0, failed: [] };
  const nameOf = new Map(Object.entries(userIds).map(([account, id]) => [id, localPart(account)]));

  const roles = rowsOf<Role>((await admin.get(`${base}/application-roles?perpage=100`)).body);
  const current = rowsOf<UserRoles>((await admin.get(`${base}/user-application-roles?perpage=100`)).body);
  const { plans, problems } = planRoleAssignments(roles, current, userIds);
  result.failed.push(...problems);
  result.skipped += Object.keys(ROLE_BY_EMAIL).length - plans.length - problems.length;
  for (const plan of plans) {
    const path = `${base}/user-application-roles`;
    const res = await admin.post(path, plan);
    if (res.ok) result.created += 1;
    else result.failed.push(`${nameOf.get(plan.user_id)}: POST ${path} → ${res.status}`);
  }

  const bu = ((await admin.get("/api/business-units")).body as { data?: BusinessUnit })?.data;
  const currencies = rowsOf<{ id: string; code: string }>((await admin.get(`${base}/currencies?perpage=100`)).body);
  const currency = bu ? planDefaultCurrency(bu, currencies, cfg.buCode) : { problem: "cannot read admin's default BU" };
  if ("problem" in currency) result.failed.push(currency.problem);
  else if (currency.body) {
    const res = await admin.patch("/api/business-units", currency.body);
    if (res.ok) result.created += 1;
    else result.failed.push(`PATCH /api/business-units → ${res.status}`);
  } else result.skipped += 1;
  return result;
}
