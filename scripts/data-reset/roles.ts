// scripts/data-reset/roles.ts
// A reset empties a BU's application roles; the first TEST BU (BU_CODE) keeps the reference set.
// The other TEST BUs start with none, so copy BU_CODE's roles (with their granted permissions) first.
// BU ใหม่ไม่มี application role เลย — คัดลอกจาก BU_CODE (ชื่อเดียวกัน, สิทธิ์ที่ granted) ก่อนผูกให้บัญชีเทส
import { BU_CODE } from "../../tests/test-users";
import type { ApiClient } from "../seed-master/api-client";
import type { ResetConfig } from "./config";
import type { Sessions } from "./sessions";
import { rowsOf, type StepResult } from "./step-result";

interface Role { id: string; name: string; description?: string }
interface RoleDetail { permissions?: Array<{ permission_id: string; resource: string; action: string; is_granted: boolean }> }
interface CatalogRow { id: string; resource: string; action: string }

/**
 * The backend writes a role's permissions one row at a time inside a 5 s interactive transaction;
 * Purchase (the largest role) ran out of time on 2026-11-24 ("expired transaction ... 5025 ms").
 * So permissions go in slices: the POST carries the first one, PUTs add the rest.
 * backend เขียนสิทธิ์ทีละแถวใน transaction 5 วินาที — role ใหญ่ต้องแบ่งใส่เป็นชุด
 */
const PERMISSION_CHUNK = 20;
const chunks = <T>(xs: T[]): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += PERMISSION_CHUNK) out.push(xs.slice(i, i + PERMISSION_CHUNK));
  return out;
};

/** PUT `ids` onto a role slice by slice; returns the failure text of the first slice that fails. */
async function addPermissions(admin: ApiClient, path: string, ids: string[]): Promise<string | undefined> {
  for (const slice of chunks(ids)) {
    const res = await admin.put(path, { permissions: { add: slice } });
    if (!res.ok) return `PUT ${path} → ${res.status} ${JSON.stringify(res.body?.message ?? "")}`;
  }
  return undefined;
}

async function listRoles(admin: ApiClient, bu: string): Promise<Role[] | string> {
  const path = `/api/config/${bu}/application-roles?perpage=100`;
  const res = await admin.get(path);
  if (!res.ok) return `GET ${path} → ${res.status}`;
  const rows = rowsOf<Record<string, unknown>>(res.body);
  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name ?? r.application_role_name ?? ""),
    description: (r.description as string | undefined) ?? "",
  }));
}

async function grantedKeys(admin: ApiClient, bu: string, roleId: string): Promise<string[] | string> {
  const path = `/api/config/${bu}/application-roles/${roleId}`;
  const res = await admin.get(path);
  if (!res.ok) return `GET ${path} → ${res.status}`;
  const detail = res.body?.data as RoleDetail | undefined;
  return (detail?.permissions ?? []).filter((p) => p.is_granted).map((p) => `${p.resource}.${p.action}`);
}

async function targetCatalog(admin: ApiClient, bu: string): Promise<Map<string, string> | string> {
  const ids = new Map<string, string>();
  for (let page = 1; page <= 20; page++) {
    const path = `/api/config/${bu}/permissions?perpage=100&page=${page}`;
    const res = await admin.get(path);
    if (!res.ok) return `GET ${path} → ${res.status}`;
    const rows = rowsOf<CatalogRow>(res.body);
    for (const p of rows) ids.set(`${p.resource}.${p.action}`, p.id);
    if (rows.length < 100) break;
  }
  return ids;
}

/** How many roles of BU_CODE the target lacks (for the dry-run text); 0 for BU_CODE itself. */
export async function countRolesToCopy(sessions: Sessions, cfg: ResetConfig): Promise<number> {
  if (cfg.buCode === BU_CODE) return 0;
  const admin = await sessions.client(cfg.adminEmail);
  const mine = await listRoles(admin, cfg.buCode);
  const source = await listRoles(admin, BU_CODE);
  if (typeof mine === "string" || typeof source === "string") return 0;
  const have = new Set(mine.map((r) => r.name));
  return source.filter((r) => !have.has(r.name)).length;
}

/** Idempotent: create missing roles, top up missing permissions of same-named ones. Never writes to BU_CODE. */
export async function copyRolesFromSource(sessions: Sessions, cfg: ResetConfig): Promise<StepResult> {
  const result: StepResult = { step: "copy-roles", created: 0, skipped: 0, failed: [] };
  if (cfg.buCode === BU_CODE) return result;
  const admin = await sessions.client(cfg.adminEmail);
  const base = `/api/config/${cfg.buCode}/application-roles`;
  const source = await listRoles(admin, BU_CODE);
  if (typeof source === "string") {
    result.failed.push(`cannot read ${BU_CODE}'s roles: ${source}`);
    return result;
  }
  if (source.length === 0) {
    result.failed.push(`no application roles in ${BU_CODE} — nothing to copy`);
    return result;
  }
  const catalog = await targetCatalog(admin, cfg.buCode);
  if (typeof catalog === "string") {
    result.failed.push(`cannot read ${cfg.buCode}'s permission catalog: ${catalog}`);
    return result;
  }
  const existing = await listRoles(admin, cfg.buCode);
  if (typeof existing === "string") {
    result.failed.push(`cannot read ${cfg.buCode}'s roles: ${existing}`);
    return result;
  }
  for (const role of source) {
    const wantKeys = await grantedKeys(admin, BU_CODE, role.id);
    if (typeof wantKeys === "string") {
      result.failed.push(`${role.name}: cannot read its permissions (${wantKeys}) — not copied`);
      continue;
    }
    const absent = wantKeys.filter((k) => !catalog.has(k));
    if (absent.length > 0) {
      result.failed.push(`${role.name}: not in ${cfg.buCode}'s permission catalog: ${absent.join(", ")} — not copied`);
      continue;
    }
    const wantIds = wantKeys.filter((k) => catalog.has(k)).map((k) => catalog.get(k)!);
    const mine = existing.find((r) => r.name === role.name);
    if (!mine) {
      const [first = [], ...rest] = chunks(wantIds);
      const res = await admin.post(base, {
        application_role_name: role.name, description: role.description ?? "", is_active: true, permissions: { add: first },
      });
      const newId = (res.body?.data as { id?: string } | undefined)?.id;
      if (!res.ok || !newId) {
        result.failed.push(`POST ${base} (${role.name}) → ${res.status} ${JSON.stringify(res.body?.message ?? "")}`);
        continue;
      }
      const failed = await addPermissions(admin, `${base}/${newId}`, rest.flat());
      if (failed) result.failed.push(`${role.name}: created with only part of its permissions — ${failed}`);
      else result.created += 1;
      continue;
    }
    const haveKeys = await grantedKeys(admin, cfg.buCode, mine.id);
    if (typeof haveKeys === "string") {
      result.failed.push(`${role.name}: cannot read target role (${haveKeys}) — not updated`);
      continue;
    }
    const have = new Set(haveKeys.map((k) => catalog.get(k)));
    const missing = wantIds.filter((id) => !have.has(id));
    if (missing.length === 0) {
      result.skipped += 1;
      continue;
    }
    const failed = await addPermissions(admin, `${base}/${mine.id}`, missing);
    if (failed) result.failed.push(`${role.name}: ${failed}`);
    else result.created += 1;
  }
  return result;
}
