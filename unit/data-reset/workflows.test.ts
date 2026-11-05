import { describe, it, expect } from "vitest";
import { resolveWorkflow, seedWorkflows } from "../../scripts/data-reset/workflows";
import { loadWorkflowFixture } from "../../scripts/data-reset/workflow-template";
import { createSessions } from "../../scripts/data-reset/sessions";
import type { ResetConfig } from "../../scripts/data-reset/config";
import { TEST_USERS } from "../../tests/test-users";
import { fakeBackend } from "./fake-backend";

const cfg: ResetConfig = {
  backendUrl: "http://h", xAppId: "app", buCode: "GR2VYNKQ", deployToken: "t",
  adminEmail: "carmensoftware.dev+admin@gmail.com",
};
const users = Object.fromEntries(
  TEST_USERS.map((u) => [u.email, { id: `id-${u.role}`, firstname: u.role, middlename: "", lastname: "carmensoftware" }]),
);
const department = { id: "dA", name: "Admin" };

describe("resolveWorkflow", () => {
  it("turns each email into the user object the backend stores", () => {
    const [, po] = loadWorkflowFixture().workflows;
    const resolved = resolveWorkflow(po, users, department);
    expect(resolved.data.stages[1].assigned_users).toEqual([
      {
        user_id: "id-FC", email: "carmensoftware.dev+fc@gmail.com", firstname: "FC", middlename: "",
        lastname: "carmensoftware", initials: "Fc", department: { id: "dA", name: "Admin" },
      },
    ]);
    expect(resolved).toMatchObject({ name: "General PO", workflow_type: "purchase_order", is_active: true });
    expect("order" in resolved).toBe(false);
  });

  it("fails on an account with no profile", () => {
    const [, po] = loadWorkflowFixture().workflows;
    const { ["carmensoftware.dev+fc@gmail.com"]: _gone, ...rest } = users;
    expect(() => resolveWorkflow(po, rest, department)).toThrow(
      "workflow General PO: no profile for carmensoftware.dev+fc@gmail.com",
    );
  });
});

describe("seedWorkflows", () => {
  const base = "/api/config/GR2VYNKQ/workflows";

  it("posts in fixture order and skips names that already exist", async () => {
    const backend = fakeBackend({ [`GET ${base}`]: { data: [{ id: "w", name: "General PO" }] } });
    const result = await seedWorkflows(createSessions(cfg, backend.fetchFn), cfg, loadWorkflowFixture(), users, department);
    expect(result).toEqual({ step: "workflows", created: 1, skipped: 1, failed: [] });
    expect(backend.writes().map((c) => [c.method, c.path, (c.body as { name: string }).name])).toEqual([
      ["POST", base, "Purchase Request"],
    ]);
  });

  it("posts both on an empty BU, PR first", async () => {
    const backend = fakeBackend({ [`GET ${base}`]: { data: [] } });
    await seedWorkflows(createSessions(cfg, backend.fetchFn), cfg, loadWorkflowFixture(), users, department);
    expect(backend.writes().map((c) => (c.body as { name: string }).name)).toEqual(["Purchase Request", "General PO"]);
  });
});
