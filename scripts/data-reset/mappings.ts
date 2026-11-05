// scripts/data-reset/mappings.ts
// Re-create what the reset wiped from the BU schema about users: department membership (hod as
// HOD of the first department) and the locations each account may use.
// สร้างการผูก user กับแผนกและ location ใหม่หลัง reset
import { TEST_USERS } from "../../tests/test-users";
import type { ResetConfig } from "./config";
import type { Sessions } from "./sessions";
import { rowsOf, type StepResult } from "./step-result";

const HOD_EMAIL = "carmensoftware.dev+hod@gmail.com";
const SECOND_DEPARTMENT_EMAIL = "carmensoftware.dev+owner@gmail.com";

interface Department { id: string; code: string; name: string }
interface DepartmentBody {
  department_users: { add: { id: string }[] };
  hod_users?: { add: { id: string }[] };
}

const byCode = <T extends { code: string }>(rows: T[]): T[] => [...rows].sort((a, b) => a.code.localeCompare(b.code));

export function planDepartmentAssignments(
  departments: Department[],
  userIds: Record<string, string>,
): Array<{ departmentId: string; body: DepartmentBody }> {
  if (departments.length < 2) throw new Error(`need at least 2 departments, found ${departments.length}`);
  const [first, second] = byCode(departments);
  return [
    {
      departmentId: first.id,
      body: {
        department_users: { add: TEST_USERS.map((u) => ({ id: userIds[u.email] })) },
        hod_users: { add: [{ id: userIds[HOD_EMAIL] }] },
      },
    },
    { departmentId: second.id, body: { department_users: { add: [{ id: userIds[SECOND_DEPARTMENT_EMAIL] }] } } },
  ];
}

export function planLocationAssignments(
  locationIds: string[],
  userIds: Record<string, string>,
): Array<{ userId: string; body: { location_ids: string[] } }> {
  return TEST_USERS.map((u) => ({ userId: userIds[u.email], body: { location_ids: [...locationIds] } }));
}

export function checkMasterShape(snapshot: {
  departments: number;
  locations: number;
  firstVendor: { code: string; email: string | null } | null;
}): string[] {
  const problems: string[] = [];
  if (snapshot.departments < 2) problems.push(`master data has ${snapshot.departments} department(s); the specs need at least 2`);
  if (snapshot.locations < 2) problems.push(`master data has ${snapshot.locations} location(s); the specs need at least 2`);
  if (!snapshot.firstVendor) problems.push("master data has no vendor");
  else if (!snapshot.firstVendor.email) {
    problems.push(`first vendor ${snapshot.firstVendor.code} has no email; the PO send-to-vendor flow needs one`);
  }
  return problems;
}

/** Any email on the vendor's contact lists, wherever the detail puts them. */
function vendorEmail(detail: unknown): string | null {
  const vendor = ((detail as { data?: unknown })?.data ?? detail) as Record<string, unknown>;
  for (const [key, value] of Object.entries(vendor ?? {})) {
    if (!key.includes("contact") || !Array.isArray(value)) continue;
    const found = value.find((c) => typeof (c as { email?: unknown })?.email === "string" && (c as { email: string }).email);
    if (found) return (found as { email: string }).email;
  }
  return null;
}

export async function seedMappings(
  sessions: Sessions,
  cfg: ResetConfig,
  userIds: Record<string, string>,
): Promise<StepResult & { firstDepartment: { id: string; name: string } | null }> {
  const admin = await sessions.client(cfg.adminEmail);
  const base = `/api/config/${cfg.buCode}`;
  const departments = rowsOf<Department>((await admin.get(`${base}/departments?perpage=100`)).body);
  const locations = rowsOf<{ id: string; code: string }>((await admin.get(`${base}/locations?perpage=100`)).body);
  const [vendor] = byCode(rowsOf<{ id: string; code: string }>((await admin.get(`${base}/vendors?perpage=100`)).body));
  const firstVendor = vendor
    ? { code: vendor.code, email: vendorEmail((await admin.get(`${base}/vendors/${vendor.id}`)).body) }
    : null;
  const problems = checkMasterShape({ departments: departments.length, locations: locations.length, firstVendor });
  if (problems.length > 0) return { step: "mappings", created: 0, skipped: 0, failed: problems, firstDepartment: null };

  const result: StepResult = { step: "mappings", created: 0, skipped: 0, failed: [] };
  const write = async (method: "patch" | "put", path: string, body: unknown) => {
    const res = await admin[method](path, body);
    if (res.ok) result.created += 1;
    else result.failed.push(`${method.toUpperCase()} ${path} → ${res.status}`);
  };
  for (const plan of planDepartmentAssignments(departments, userIds)) {
    await write("patch", `${base}/departments/${plan.departmentId}`, plan.body);
  }
  for (const plan of planLocationAssignments(byCode(locations).map((l) => l.id), userIds)) {
    await write("put", `${base}/locations-users/${plan.userId}`, plan.body);
  }
  const [first] = byCode(departments);
  return { ...result, firstDepartment: { id: first.id, name: first.name } };
}
