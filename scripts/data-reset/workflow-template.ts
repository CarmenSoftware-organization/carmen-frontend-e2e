// scripts/data-reset/workflow-template.ts
// The first PR and PO workflows of the standard dataset, as a template that names users by email.
// workflow PR/PO ชุดแรกของชุดข้อมูลมาตรฐาน — แม่แบบที่อ้าง user ด้วยอีเมล
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { TEST_USERS } from "../../tests/test-users";

export const GM_THRESHOLD = 100_000;
export const FIXTURE_PATH = fileURLToPath(new URL("./fixtures/workflows.json", import.meta.url));

export interface TemplateStage {
  name: string;
  role: "create" | "approve" | "purchase";
  is_hod?: boolean;
  assigned_users: Array<{ email: string }>;
  [key: string]: unknown;
}

export interface RoutingRule {
  trigger_stage: string;
  condition: { field: string; operator: string; value: string[] };
  action: { type: "NEXT_STAGE" | "SKIP_STAGE"; parameters: { target_stage: string } };
}

export interface WorkflowTemplate {
  order: number;
  name: string;
  workflow_type: "purchase_request" | "purchase_order";
  description: string | null;
  is_active: boolean;
  data: { stages: TemplateStage[]; routing_rules: RoutingRule[] };
}

export interface WorkflowFixture {
  note: string;
  bu_code: "GR2VYNKQ";
  workflows: WorkflowTemplate[];
}

export function loadWorkflowFixture(path: string = FIXTURE_PATH): WorkflowFixture {
  return JSON.parse(readFileSync(path, "utf8")) as WorkflowFixture;
}

/** Problems a hand edit could introduce; the app's editor would refuse the same ones. */
export function validateFixture(fixture: WorkflowFixture): string[] {
  const known = new Set<string>(TEST_USERS.map((u) => u.email));
  const problems: string[] = [];
  for (const wf of fixture.workflows) {
    const names = wf.data.stages.map((s) => s.name);
    for (const rule of wf.data.routing_rules) {
      if (names.indexOf(rule.action.parameters.target_stage) <= names.indexOf(rule.trigger_stage)) {
        problems.push(
          `${wf.name}: rule on ${rule.trigger_stage} targets ${rule.action.parameters.target_stage}, which is not after it`,
        );
      }
    }
    for (const stage of wf.data.stages) {
      for (const { email } of stage.assigned_users) {
        if (!known.has(email)) problems.push(`${wf.name}: stage ${stage.name} names ${email}, not a test account`);
      }
    }
  }
  return problems;
}
