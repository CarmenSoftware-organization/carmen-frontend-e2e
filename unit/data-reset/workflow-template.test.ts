import { describe, it, expect } from "vitest";
import { loadWorkflowFixture, validateFixture } from "../../scripts/data-reset/workflow-template";
import { TEST_USERS } from "../../tests/test-users";

const emails = new Set<string>(TEST_USERS.map((u) => u.email));

describe("workflow fixture", () => {
  const fixture = loadWorkflowFixture();
  const [pr, po, sr] = fixture.workflows;

  it("lists the PR workflow first, then General PO, then the SR workflow", () => {
    expect(fixture.workflows.map((w) => [w.order, w.workflow_type])).toEqual([
      [0, "purchase_request"],
      [1, "purchase_order"],
      [2, "store_requisition"],
    ]);
    expect(po.name).toBe("General PO");
  });

  it("routes every PR requestor → HOD → Purchase → GM, with no skip rule", () => {
    expect(pr.data.stages.map((s) => [s.name, s.role])).toEqual([
      ["Create Request", "create"],
      ["HOD Approval", "approve"],
      ["Purchase", "purchase"],
      ["GM Approval", "approve"],
      ["Completed", "approve"],
    ]);
    // owner raises the second-department PR; a creator not on the create stage cannot submit (503).
    expect(pr.data.stages[0].assigned_users.map((u) => u.email.split("+")[1].split("@")[0])).toEqual(["requestor", "purchase", "owner"]);
    expect(pr.data.stages[1].is_hod).toBe(true);
    expect(pr.data.stages[1].assigned_users).toEqual([]);
    expect(pr.data.routing_rules).toEqual([]);
  });

  it("routes an SR create → Store Approval (purchase) → Issue", () => {
    expect(sr.data.stages.map((s) => [s.name, s.role, s.assigned_users.map((u) => u.email.split("+")[1].split("@")[0])])).toEqual([
      ["Create Request", "create", ["purchase", "requestor", "storemanager"]],
      ["Store Approval", "approve", ["purchase"]],
      ["Issue", "issue", ["purchase", "storemanager"]],
      ["Completed", "approve", []],
    ]);
  });

  it("routes General PO purchase → FC → GM", () => {
    expect(po.data.stages.map((s) => [s.name, s.role, s.assigned_users.map((u) => u.email)])).toEqual([
      ["Create Request", "create", ["carmensoftware.dev+purchase@gmail.com"]],
      ["FC Approval", "approve", ["carmensoftware.dev+fc@gmail.com"]],
      ["GM Approval", "approve", ["carmensoftware.dev+gm@gmail.com"]],
      ["Completed", "approve", []],
    ]);
  });

  it("only names test accounts", () => {
    const named = fixture.workflows.flatMap((w) => w.data.stages.flatMap((s) => s.assigned_users.map((u) => u.email)));
    expect(named.filter((e) => !emails.has(e))).toEqual([]);
    expect(validateFixture(fixture)).toEqual([]);
  });
});

describe("validateFixture", () => {
  it("requires every workflow to end on a terminal stage with no active action", () => {
    // The backend completes a document on the approval that ENTERS the last stage
    // (isFinalApproval = no stage after the one it moves into), so a real approver
    // on the last stage is skipped. Carmen workflows end on a "Completed" stage.
    const bad = loadWorkflowFixture();
    bad.workflows[0].data.stages.pop();
    expect(validateFixture(bad)).toEqual([
      "Purchase Request: last stage GM Approval has active actions — end on a terminal stage (e.g. Completed) or the backend finishes the workflow one stage early",
    ]);
  });


  it("reports a rule whose target is not after its trigger, and an unknown account", () => {
    const bad = loadWorkflowFixture();
    bad.workflows[0].data.routing_rules.push({
      trigger_stage: "HOD Approval",
      condition: { field: "total_amount", operator: "lte", value: ["1"] },
      action: { type: "SKIP_STAGE", parameters: { target_stage: "Create Request" } },
    });
    bad.workflows[1].data.stages[0].assigned_users = [{ email: "nobody@x" }];
    expect(validateFixture(bad)).toEqual([
      "Purchase Request: rule on HOD Approval targets Create Request, which is not after it",
      "General PO: stage Create Request names nobody@x, not a test account",
    ]);
  });
});
