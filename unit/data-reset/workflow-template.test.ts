import { describe, it, expect } from "vitest";
import { GM_THRESHOLD, loadWorkflowFixture, validateFixture } from "../../scripts/data-reset/workflow-template";
import { TEST_USERS } from "../../tests/test-users";

const emails = new Set<string>(TEST_USERS.map((u) => u.email));

describe("workflow fixture", () => {
  const fixture = loadWorkflowFixture();
  const [pr, po] = fixture.workflows;

  it("lists the PR workflow first, then General PO", () => {
    expect(fixture.workflows.map((w) => [w.order, w.workflow_type])).toEqual([
      [0, "purchase_request"],
      [1, "purchase_order"],
    ]);
    expect(po.name).toBe("General PO");
  });

  it("routes a PR requestor → HOD → GM → Purchase", () => {
    expect(pr.data.stages.map((s) => [s.name, s.role])).toEqual([
      ["Create Request", "create"],
      ["HOD Approval", "approve"],
      ["GM Approval", "approve"],
      ["Purchase", "purchase"],
    ]);
    expect(pr.data.stages[1].is_hod).toBe(true);
    expect(pr.data.stages[1].assigned_users).toEqual([]);
  });

  it("skips GM for a PR of 100,000 or less", () => {
    expect(GM_THRESHOLD).toBe(100_000);
    expect(pr.data.routing_rules).toEqual([
      {
        trigger_stage: "HOD Approval",
        condition: { field: "total_amount", operator: "lte", value: ["100000"] },
        action: { type: "SKIP_STAGE", parameters: { target_stage: "Purchase" } },
      },
    ]);
  });

  it("routes General PO purchase → FC → GM", () => {
    expect(po.data.stages.map((s) => [s.name, s.role, s.assigned_users.map((u) => u.email)])).toEqual([
      ["Create Request", "create", ["carmensoftware.dev+purchase@gmail.com"]],
      ["FC Approval", "approve", ["carmensoftware.dev+fc@gmail.com"]],
      ["GM Approval", "approve", ["carmensoftware.dev+gm@gmail.com"]],
    ]);
  });

  it("only names test accounts", () => {
    const named = fixture.workflows.flatMap((w) => w.data.stages.flatMap((s) => s.assigned_users.map((u) => u.email)));
    expect(named.filter((e) => !emails.has(e))).toEqual([]);
    expect(validateFixture(fixture)).toEqual([]);
  });
});

describe("validateFixture", () => {
  it("reports a rule whose target is not after its trigger, and an unknown account", () => {
    const bad = loadWorkflowFixture();
    bad.workflows[0].data.routing_rules[0].action.parameters.target_stage = "Create Request";
    bad.workflows[1].data.stages[0].assigned_users = [{ email: "nobody@x" }];
    expect(validateFixture(bad)).toEqual([
      "Purchase Request: rule on HOD Approval targets Create Request, which is not after it",
      "General PO: stage Create Request names nobody@x, not a test account",
    ]);
  });
});
