// scripts/data-reset/verify-env.ts
// Step 0: what the reset keeps (platform schema) must already be right — check it, never change it.
// ขั้น 0: สิ่งที่ reset เก็บไว้ (schema กลาง) ต้องถูกอยู่แล้ว — ตรวจอย่างเดียว ไม่แก้
import { TEST_USERS } from "../../tests/test-users";
import type { ResetConfig } from "./config";
import { findBuId } from "./reset";
import type { Sessions } from "./sessions";

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

const dataOf = <T>(body: unknown): T => ((body as { data?: T })?.data ?? body) as T;

export function checkMembership(email: string, profileBody: unknown, buCode: string): string | null {
  const units = dataOf<{ business_unit?: ProfileUnit[] }>(profileBody)?.business_unit ?? [];
  const target = units.find((u) => u.code === buCode);
  if (!target) return `${email}: not a member of ${buCode}`;
  if (target.is_default) return null;
  const actual = units.find((u) => u.is_default)?.code ?? "(none)";
  return `${email}: default BU is ${actual}, not ${buCode}`;
}

export function missingPermissions(roles: Array<{ permissions: Permission[] }>, required: string[]): string[] {
  const granted = new Set(
    roles.flatMap((role) => role.permissions.filter((p) => p.is_granted).map((p) => `${p.resource}.${p.action}`)),
  );
  return required.filter((key) => !granted.has(key));
}

async function purchaseProblems(sessions: Sessions, cfg: ResetConfig, purchaseId: string): Promise<string[]> {
  const admin = await sessions.client(cfg.adminEmail);
  const assigned = await admin.get(`/api/config/${cfg.buCode}/user-application-roles/${purchaseId}`);
  if (!assigned.ok) return [`cannot read purchase's roles in ${cfg.buCode} (${assigned.status})`];
  const roleIds = (dataOf<{ application_roles?: Array<{ application_role_id: string }> }>(assigned.body)
    ?.application_roles ?? []).map((r) => r.application_role_id);
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
): Promise<{ problems: string[]; userIds: Record<string, string>; buId: string }> {
  const problems: string[] = [];
  const userIds: Record<string, string> = {};
  let buId = "";
  for (const { email } of TEST_USERS) {
    const client = await sessions.client(email);
    const res = await client.get("/api/user/profile");
    if (!res.ok) {
      problems.push(`${email}: profile request failed (${res.status})`);
      continue;
    }
    userIds[email] = dataOf<{ id: string }>(res.body).id;
    const problem = checkMembership(email, res.body, cfg.buCode);
    if (problem) problems.push(problem);
    if (email === cfg.adminEmail && !problem) buId = findBuId(res.body, cfg.buCode);
  }
  if (userIds[PURCHASE_EMAIL]) problems.push(...(await purchaseProblems(sessions, cfg, userIds[PURCHASE_EMAIL])));
  if (!buId && !problems.some((p) => p.startsWith(cfg.adminEmail))) {
    problems.push(`${cfg.adminEmail}: could not resolve the id of ${cfg.buCode}`);
  }
  return { problems, userIds, buId };
}
