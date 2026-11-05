// scripts/data-reset/workflows.ts
// Create the first PR and PO workflows from the template, in template order (the form offers the first).
// สร้าง workflow PR/PO จากแม่แบบตามลำดับ — ฟอร์มเลือกตัวแรกให้
import type { ResetConfig } from "./config";
import type { Sessions } from "./sessions";
import { rowsOf, type StepResult } from "./step-result";
import type { TestUserInfo } from "./verify-env";
import type { WorkflowFixture, WorkflowTemplate } from "./workflow-template";

export interface ResolvedWorkflow {
  name: string;
  workflow_type: string;
  description: string | null;
  is_active: boolean;
  data: {
    stages: Array<Record<string, unknown> & { assigned_users: unknown[] }>;
    routing_rules: unknown[];
    products: WorkflowProduct[];
  };
}

/** The item picker lists only `data.products` (micro-business getWorkflowProductIds). */
export interface WorkflowProduct {
  id: string;
  code: string;
  name: string;
}

export function resolveWorkflow(
  wf: WorkflowTemplate,
  users: Record<string, TestUserInfo>,
  department: { id: string; name: string },
  products: WorkflowProduct[],
): ResolvedWorkflow {
  const stages = wf.data.stages.map((stage) => ({
    ...stage,
    assigned_users: stage.assigned_users.map(({ email }) => {
      const user = users[email];
      if (!user) throw new Error(`workflow ${wf.name}: no profile for ${email}`);
      return {
        user_id: user.id,
        email,
        firstname: user.firstname,
        middlename: user.middlename,
        lastname: user.lastname,
        initials: `${user.firstname.charAt(0)}${user.lastname.charAt(0)}`,
        department: { ...department },
      };
    }),
  }));
  return {
    name: wf.name,
    workflow_type: wf.workflow_type,
    description: wf.description,
    is_active: wf.is_active,
    data: { ...wf.data, stages, products: products.map(({ id, code, name }) => ({ id, code, name })) },
  };
}

export async function seedWorkflows(
  sessions: Sessions,
  cfg: ResetConfig,
  fixture: WorkflowFixture,
  users: Record<string, TestUserInfo>,
  department: { id: string; name: string },
): Promise<StepResult> {
  const admin = await sessions.client(cfg.adminEmail);
  const base = `/api/config/${cfg.buCode}/workflows`;
  const result: StepResult = { step: "workflows", created: 0, skipped: 0, failed: [] };
  const list = await admin.get(`${base}?perpage=100`);
  if (!list.ok) {
    result.failed.push(`GET ${base} → ${list.status}`);
    return result;
  }
  const existing = new Set(rowsOf<{ name: string }>(list.body).map((w) => w.name));
  const productList = await admin.get(`/api/config/${cfg.buCode}/products?perpage=100`);
  const products = rowsOf<WorkflowProduct>(productList.body);
  if (!productList.ok || products.length === 0) {
    result.failed.push(`no product in ${cfg.buCode} — a workflow without products leaves the item picker empty`);
    return result;
  }
  for (const wf of [...fixture.workflows].sort((a, b) => a.order - b.order)) {
    if (existing.has(wf.name)) {
      result.skipped += 1;
      continue;
    }
    const res = await admin.post(base, resolveWorkflow(wf, users, department, products));
    if (res.ok) result.created += 1;
    else result.failed.push(`POST ${base} (${wf.name}) → ${res.status} ${JSON.stringify(res.body?.message ?? "")}`);
  }
  return result;
}
