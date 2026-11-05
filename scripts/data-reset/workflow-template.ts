// scripts/data-reset/workflow-template.ts
// The first PR, PO and SR workflows of the standard dataset, as a template that names users by email.
// workflow PR/PO ชุดแรกของชุดข้อมูลมาตรฐาน — แม่แบบที่อ้าง user ด้วยอีเมล
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { TEST_USERS } from "../../tests/test-users";

export const FIXTURE_PATH = fileURLToPath(new URL("./fixtures/workflows.json", import.meta.url));

export interface TemplateStage {
  name: string;
  role: "create" | "approve" | "purchase" | "issue";
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
  workflow_type: "purchase_request" | "purchase_order" | "store_requisition";
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
    // The backend completes a document on the approval that ENTERS the last stage, so a last stage
    // with a real approver is never acted on — Carmen workflows end on a terminal "Completed" stage.
    const last = wf.data.stages[wf.data.stages.length - 1];
    if (last && Object.values(last.available_actions ?? {}).some((a) => a?.is_active)) {
      problems.push(
        `${wf.name}: last stage ${last.name} has active actions — end on a terminal stage (e.g. Completed) or the backend finishes the workflow one stage early`,
      );
    }
    for (const stage of wf.data.stages) {
      for (const { email } of stage.assigned_users) {
        if (!known.has(email)) problems.push(`${wf.name}: stage ${stage.name} names ${email}, not a test account`);
      }
    }
  }
  return problems;
}
