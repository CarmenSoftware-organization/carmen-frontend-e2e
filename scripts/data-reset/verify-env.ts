// scripts/data-reset/verify-env.ts
// Step 0: what the reset keeps (platform schema) must already be right — check it, never change it.
// ขั้น 0: สิ่งที่ reset เก็บไว้ (schema กลาง) ต้องถูกอยู่แล้ว — ตรวจอย่างเดียว ไม่แก้
import { BU_CODE, TEST_BUS, TEST_USERS } from "../../tests/test-users";
import type { ResetConfig } from "./config";
import { findBuId } from "./reset";
import type { Sessions } from "./sessions";
import { rowsOf } from "./step-result";

export const PURCHASE_EMAIL = "carmensoftware.dev+purchase@gmail.com";

export const REQUIRED_PURCHASE_PERMISSIONS = [
  "vendor_management.vendor.view",
  "product_management.category.view",
  "vendor_management.request_price_list.view",
];

interface Permission {
  resource: string;
  action: string;
  is_granted: boolean;
}

type ProfileUnit = { id: string; code: string; is_default?: boolean };

export interface TestUserInfo {
  id: string;
  firstname: string;
  middlename: string;
  lastname: string;
}

const dataOf = <T>(body: unknown): T => ((body as { data?: T })?.data ?? body) as T;

export function checkMembership(email: string, profileBody: unknown, buCode: string): string | null {
  const units = dataOf<{ business_unit?: ProfileUnit[] }>(profileBody)?.business_unit ?? [];
  const target = units.find((u) => u.code === buCode);
  if (!target) return `${email}: not a member of ${buCode}`;
  // The default BU must be BU_CODE for every target (data:reset never changes other accounts'
  // default); an account with no BU marked default lands in its BU anyway (dev: purchase, requestor).
  // BU หลักของบัญชีต้องเป็น BU_CODE เสมอ (ไม่ว่าจะ reset BU ไหน) หรือไม่มี BU ใดถูกตั้งเป็น default
  const currentDefault = units.find((u) => u.is_default);
  if (!currentDefault || currentDefault.code === BU_CODE) return null;
  return `${email}: default BU is ${currentDefault.code}, not ${BU_CODE}`;
}

/** The BU's inventory cost method (as admin) must be the one its TEST_BUS entry promises. */
export async function calcMethodProblem(sessions: Sessions, cfg: ResetConfig): Promise<string | null> {
  const want = TEST_BUS.find((b) => b.code === cfg.buCode)?.method;
  const admin = await sessions.client(cfg.adminEmail);
  const path = `/api/${cfg.buCode}/inventory-transactions/calculation-method`;
  const res = await admin.get(path);
  if (!res.ok) return `GET ${path} → ${res.status}`;
  const body = (res.body as { data?: unknown })?.data ?? res.body;
  const got = typeof body === "string" ? body : (body as { calculation_method?: string; method?: string })?.calculation_method ?? (body as { method?: string })?.method;
  if (got !== want) return `${cfg.buCode}: calculation method is ${String(got)}, expected ${want}`;
  return null;
}

export function missingPermissions(roles: Array<{ permissions: Permission[] }>, required: string[]): string[] {
  const granted = new Set(
    roles.flatMap((role) => role.permissions.filter((p) => p.is_granted).map((p) => `${p.resource}.${p.action}`)),
  );
  return required.filter((key) => !granted.has(key));
}

export async function purchaseProblems(
  sessions: Sessions, cfg: ResetConfig, purchaseId: string, notes?: string[],
): Promise<string[]> {
  const admin = await sessions.client(cfg.adminEmail);
  if (notes && cfg.buCode !== BU_CODE) {
    // A fresh TEST BU has no roles yet: the access step copies them from BU_CODE.
    // BU ใหม่ยังไม่มี role — ขั้น access จะคัดลอกมาจาก BU_CODE
    const list = await admin.get(`/api/config/${cfg.buCode}/application-roles?perpage=100`);
    const names = rowsOf<{ name?: string; application_role_name?: string }>(list.body).map((r) => r.name ?? r.application_role_name);
    if (list.ok && !names.includes("Purchase")) {
      notes.push(`purchase role will be copied from ${BU_CODE}`);
      return [];
    }
  }
  const assigned = await admin.get(`/api/config/${cfg.buCode}/user-application-roles/${purchaseId}`);
  if (!assigned.ok) return [`cannot read purchase's roles in ${cfg.buCode} (${assigned.status})`];
  const roleIds = (dataOf<{ application_roles?: Array<{ application_role_id: string }> }>(assigned.body)
    ?.application_roles ?? []).map((r) => r.application_role_id);
  if (notes && cfg.buCode !== BU_CODE && roleIds.length === 0) {
    notes.push(`purchase has no role in ${cfg.buCode} yet; it will be assigned after the roles are copied from ${BU_CODE}`);
    return [];
  }
  const roles: Array<{ permissions: Permission[] }> = [];
  for (const id of roleIds) {
    const role = await admin.get(`/api/config/${cfg.buCode}/application-roles/${id}`);
    if (!role.ok) return [`cannot read application role ${id} (${role.status})`];
    roles.push({ permissions: dataOf<{ permissions?: Permission[] }>(role.body)?.permissions ?? [] });
  }
  return missingPermissions(roles, REQUIRED_PURCHASE_PERMISSIONS).map(
    (key) =>
      `purchase lacks ${key} in ${cfg.buCode} — grant it once in the purchase role (platform schema, survives every reset)`,
  );
}

export async function verifyEnvironment(
  sessions: Sessions,
  cfg: ResetConfig,
): Promise<{ problems: string[]; notes: string[]; userIds: Record<string, string>; users: Record<string, TestUserInfo>; buId: string }> {
  const problems: string[] = [];
  const notes: string[] = [];
  const userIds: Record<string, string> = {};
  const users: Record<string, TestUserInfo> = {};
  let buId = "";
  for (const { email } of TEST_USERS) {
    const client = await sessions.client(email);
    const res = await client.get("/api/user/profile");
    if (!res.ok) {
      problems.push(`${email}: profile request failed (${res.status})`);
      continue;
    }
    const me = dataOf<{ id: string; user_info?: Partial<TestUserInfo> }>(res.body);
    userIds[email] = me.id;
    users[email] = {
      id: me.id,
      firstname: me.user_info?.firstname ?? "",
      middlename: me.user_info?.middlename ?? "",
      lastname: me.user_info?.lastname ?? "",
    };
    const problem = checkMembership(email, res.body, cfg.buCode);
    if (problem) problems.push(problem);
    if (email === cfg.adminEmail && !problem) buId = findBuId(res.body, cfg.buCode);
  }
  const calc = await calcMethodProblem(sessions, cfg);
  if (calc) problems.push(calc);
  if (userIds[PURCHASE_EMAIL]) problems.push(...(await purchaseProblems(sessions, cfg, userIds[PURCHASE_EMAIL], notes)));
  if (!buId && !problems.some((p) => p.startsWith(cfg.adminEmail))) {
    problems.push(`${cfg.adminEmail}: could not resolve the id of ${cfg.buCode}`);
  }
  return { problems, notes, userIds, users, buId };
}
