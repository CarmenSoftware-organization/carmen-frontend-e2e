import { describe, it, expect } from "vitest";
import {
  planPurchaseRequests,
  prActions,
  seedPrTemplate,
  seedPurchaseRequests,
} from "../../scripts/data-reset/docs/purchase-requests";
import { RowLedger } from "../../scripts/data-reset/docs/row-ledger";
import { createSessions } from "../../scripts/data-reset/sessions";
import { fakeBackend } from "./fake-backend";
import { cfg, ctx, docStore, email } from "./docs-fixtures";

const count = (plan: ReturnType<typeof planPurchaseRequests>) =>
  plan.reduce<Record<string, number>>((acc, p) => ({ ...acc, [p.row]: (acc[p.row] ?? 0) + 1 }), {});

describe("planPurchaseRequests", () => {
  const plan = planPurchaseRequests(ctx);

  it("has the spec's count per row", () => {
    expect(count(plan)).toEqual({
      "pr.draft": 3, "pr.hod": 18, "pr.purchase": 8, "pr.gm": 2, "pr.approved": 5, "pr.returned": 1,
      "pr.rejected": 1, "pr.void": 1, "pr.completed-reserve": 1, "pr.second-dept": 1,
    });
  });

  it("gives some HOD PRs two lines and one a FOC quantity", () => {
    const hod = plan.filter((p) => p.target === "hod");
    expect(hod.filter((p) => p.lines.length === 2)).toHaveLength(6);
    expect(hod.filter((p) => p.lines.some((l) => (l.focQty ?? 0) > 0))).toHaveLength(1);
  });

  it("makes GM PRs high value and leaves one approved PR without a delivery date", () => {
    expect(plan.filter((p) => p.target === "gm").every((p) => p.highValue)).toBe(true);
    expect(plan.filter((p) => p.target === "approved" && p.deliveryDate === null)).toHaveLength(1);
  });

  it("puts the second-department PR on owner in the second department", () => {
    const [second] = plan.filter((p) => p.target === "second-dept");
    expect(second).toMatchObject({ requestor: email("owner"), departmentId: "dB" });
    expect(plan.filter((p) => p.target !== "second-dept").every((p) => p.departmentId === "dA")).toBe(true);
  });
});

describe("prActions", () => {
  const seq = (t: Parameters<typeof prActions>[0]) => prActions(t).map((a) => `${a.by}:${a.action}`);

  it("walks each target through the real stages and stops where the row needs it", () => {
    expect(seq("draft")).toEqual(["requestor:create"]);
    expect(seq("hod")).toEqual(["requestor:create", "requestor:submit"]);
    expect(seq("returned")).toEqual(["requestor:create", "requestor:submit", "hod:review"]);
    expect(seq("rejected")).toEqual(["requestor:create", "requestor:submit", "hod:reject"]);
    expect(seq("purchase")).toEqual(["requestor:create", "requestor:submit", "hod:approve"]);
    expect(seq("void")).toEqual(["requestor:create", "requestor:submit", "hod:approve", "purchase:reject"]);
    expect(seq("gm")).toEqual(["requestor:create", "requestor:submit", "hod:approve", "purchase:purchase"]);
    expect(seq("approved")).toEqual(["requestor:create", "requestor:submit", "hod:approve", "purchase:purchase", "gm:approve"]);
    expect(seq("completed-reserve")).toEqual(seq("approved"));
    expect(seq("second-dept")).toEqual(seq("hod"));
  });
});

describe("seedPurchaseRequests", () => {
  it("creates every PR as the right accounts, returns the reserved PR and carries on after a failure", async () => {
    const store = docStore("purchase_request_detail", "pr_no");
    store.failOn("PATCH", /\/approve$/, 1);
    const backend = fakeBackend({}, store.fallback);
    const ledger = new RowLedger();
    const result = await seedPurchaseRequests(createSessions(cfg, backend.fetchFn), cfg, ctx, ledger);
    expect(store.docs.size).toBe(41);
    expect(result.failed).toHaveLength(1);
    expect(result.created).toBe(40);
    const reserved = [...store.docs.values()].find((d) => d.id === result.reservedForPo);
    expect(reserved).toBeDefined();
    const writes = backend.writesBy();
    const callersOf = (action: RegExp) => [...new Set(writes.filter((w) => action.test(w.path)).map((w) => w.caller))];
    expect(new Set(callersOf(/\/submit$/))).toEqual(new Set([email("requestor"), email("owner")]));
    expect(callersOf(/\/reject$/).sort()).toEqual([email("hod"), email("purchase")].sort());
    expect(callersOf(/\/review$/)).toEqual([email("hod")]);
    const create = writes.find((w) => w.path === "/api/GR2VYNKQ/purchase-requests")!.body as any;
    expect(create).toMatchObject({ stage_role: "create", details: { workflow_id: "wf-pr", department_id: "dA" } });
    expect(create.details.description).toMatch(/^STD pr\./);
    const purchaseStep = writes.find((w) => (w.body as any)?.stage_role === "purchase")!.body as any;
    expect(purchaseStep.details[0]).toMatchObject({ vendor_id: "v1", tax_profile_id: "tax-none", pricelist_detail_id: null });
    expect(Object.values(ledger.rows()).flatMap((r) => r.failures)).toHaveLength(1);
    const rejects = writes.filter((w) => /\/reject$/.test(w.path));
    expect(rejects.map((w) => [w.caller, (w.body as any).stage_role]).sort()).toEqual(
      [[email("hod"), "approve"], [email("purchase"), "purchase"]].sort(),
    );
  });
});

describe("seedPrTemplate", () => {
  it("creates one active template with two lines as purchase", async () => {
    const store = docStore("purchase_request_template_detail", "name");
    const backend = fakeBackend({}, store.fallback);
    const ledger = new RowLedger();
    const result = await seedPrTemplate(createSessions(cfg, backend.fetchFn), cfg, ctx, ledger);
    expect(result).toMatchObject({ created: 1, failed: [] });
    const [call] = backend.writesBy();
    expect(call.caller).toBe(email("purchase"));
    expect(call.body).toMatchObject({ workflow_id: "wf-pr", is_active: true });
    expect((call.body as any).purchase_request_template_detail.add).toHaveLength(2);
    expect(ledger.rows()["pr-template.active"].docNos).toHaveLength(1);
  });
});
