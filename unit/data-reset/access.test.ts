import { describe, it, expect } from "vitest";
import { ROLE_BY_EMAIL, planDefaultCurrency, planRoleAssignments, seedAccess } from "../../scripts/data-reset/access";
import { createSessions } from "../../scripts/data-reset/sessions";
import type { ResetConfig } from "../../scripts/data-reset/config";
import { TEST_USERS } from "../../tests/test-users";
import { fakeBackend } from "./fake-backend";

const cfg: ResetConfig = {
  backendUrl: "http://h", xAppId: "app", buCode: "GR2VYNKQ", deployToken: "t",
  adminEmail: "carmensoftware.dev+admin@gmail.com",
};
const short = (email: string) => email.split("+")[1].split("@")[0];
const userIds = Object.fromEntries(TEST_USERS.map((u) => [u.email, `id-${short(u.email)}`]));
const roles = ["Accounting", "Approval", "HOD", "Purchase", "Requestor", "System Admin"].map((name) => ({
  id: `r-${name}`,
  name,
}));

describe("ROLE_BY_EMAIL", () => {
  it("gives every test account except admin one role", () => {
    const expected = TEST_USERS.map((u) => u.email).filter((e) => e !== cfg.adminEmail).sort();
    expect(Object.keys(ROLE_BY_EMAIL).sort()).toEqual(expected);
  });
});

describe("planRoleAssignments", () => {
  it("adds each account's role, leaving accounts that already hold it alone", () => {
    const current = [{ user_id: "id-purchase", role_ids: ["r-Purchase"] }];
    const { plans, problems } = planRoleAssignments(roles, current, userIds);
    expect(problems).toEqual([]);
    expect(plans).toContainEqual({ user_id: "id-requestor", application_role_id: { add: ["r-Requestor"] } });
    expect(plans).toContainEqual({ user_id: "id-storemanager", application_role_id: { add: ["r-Approval"] } });
    expect(plans).toContainEqual({ user_id: "id-budget", application_role_id: { add: ["r-Accounting"] } });
    expect(plans.map((p) => p.user_id)).not.toContain("id-purchase");
    expect(plans.map((p) => p.user_id)).not.toContain("id-admin");
    expect(plans).toHaveLength(7);
  });

  it("never removes a role an account already has", () => {
    const current = [{ user_id: "id-requestor", role_ids: ["r-HOD"] }];
    const { plans } = planRoleAssignments(roles, current, userIds);
    const requestor = plans.find((p) => p.user_id === "id-requestor");
    expect(requestor).toEqual({ user_id: "id-requestor", application_role_id: { add: ["r-Requestor"] } });
  });

  it("reports a role missing from the BU instead of guessing", () => {
    const { plans, problems } = planRoleAssignments(roles.filter((r) => r.name !== "Approval"), [], userIds);
    expect(problems).toEqual([`role "Approval" does not exist in the BU (needed by fc, gm, owner, storemanager)`]);
    expect(plans.map((p) => p.user_id)).not.toContain("id-fc");
  });
});

describe("planDefaultCurrency", () => {
  const bu = { id: "bu1", code: "GR2VYNKQ", doc_version: 2, default_currency_id: null };
  const currencies = [{ id: "c-usd", code: "USD" }, { id: "c-thb", code: "THB" }];

  it("sets THB when the BU has no default currency", () => {
    expect(planDefaultCurrency(bu, currencies, "GR2VYNKQ")).toEqual({
      body: { id: "bu1", doc_version: 2, default_currency_id: "c-thb" },
    });
  });

  it("leaves a BU that already has a default currency alone", () => {
    expect(planDefaultCurrency({ ...bu, default_currency_id: "c-usd" }, currencies, "GR2VYNKQ")).toEqual({ body: null });
  });

  it("refuses when the admin's default BU is not TEST BU — the PATCH writes the caller's default BU", () => {
    expect(planDefaultCurrency({ ...bu, code: "OTHER" }, currencies, "GR2VYNKQ")).toEqual({
      problem: "admin's default BU is OTHER, not GR2VYNKQ — refusing to set its currency",
    });
  });

  it("reports a BU without a THB currency", () => {
    expect(planDefaultCurrency(bu, [{ id: "c-usd", code: "USD" }], "GR2VYNKQ")).toEqual({
      problem: "no THB currency in GR2VYNKQ to make the default",
    });
  });
});

describe("seedAccess", () => {
  const base = "/api/config/GR2VYNKQ";
  const routes = {
    [`GET ${base}/application-roles`]: { data: roles },
    [`GET ${base}/user-application-roles`]: { data: [{ user_id: "id-purchase", role_ids: ["r-Purchase"] }] },
    [`GET /api/business-units`]: { data: { id: "bu1", code: "GR2VYNKQ", doc_version: 2, default_currency_id: null } },
    [`GET ${base}/currencies`]: { data: [{ id: "c-thb", code: "THB" }] },
  };

  it("posts the missing roles and patches the BU's default currency, all as admin", async () => {
    const backend = fakeBackend(routes);
    const result = await seedAccess(createSessions(cfg, backend.fetchFn), cfg, userIds);
    expect(result).toMatchObject({ step: "access", created: 8, skipped: 1, failed: [] });
    const writes = backend.writesBy();
    expect(writes.every((c) => c.caller === cfg.adminEmail)).toBe(true);
    // The call the movement suite has run live (setup-fifo-roles.ts), one per account.
    const roleWrites = writes.filter((c) => c.method === "POST" && c.path === `${base}/user-application-roles`);
    expect(roleWrites).toHaveLength(7);
    expect(roleWrites.map((c) => c.body)).toContainEqual({ user_id: "id-requestor", application_role_id: { add: ["r-Requestor"] } });
    expect(writes.at(-1)).toMatchObject({
      method: "PATCH",
      path: "/api/business-units",
      body: { id: "bu1", doc_version: 2, default_currency_id: "c-thb" },
    });
  });

  it("records a refused write and carries on", async () => {
    const backend = fakeBackend({
      ...routes,
      [`POST ${base}/user-application-roles`]: (body: unknown) =>
        (body as { user_id: string }).user_id === "id-requestor" ? { __status: 403 } : { data: {} },
    });
    const result = await seedAccess(createSessions(cfg, backend.fetchFn), cfg, userIds);
    expect(result.failed).toEqual(["requestor: POST /api/config/GR2VYNKQ/user-application-roles → 403"]);
    expect(result.created).toBe(7);
  });
});
