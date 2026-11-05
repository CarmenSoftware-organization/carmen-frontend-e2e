import { describe, it, expect } from "vitest";
import { EXPECTED_ROWS, verifyDataset } from "../../scripts/data-reset/verify-dataset";
import { seedAllDocuments } from "../../scripts/data-reset/docs/seed-all";
import { RowLedger } from "../../scripts/data-reset/docs/row-ledger";
import { createSessions } from "../../scripts/data-reset/sessions";
import { fakeBackend } from "./fake-backend";
import { cfg, ctx, users } from "./docs-fixtures";


describe("EXPECTED_ROWS", () => {
  it("covers the spec's table with whole-BU minimums", () => {
    const byRow = Object.fromEntries(EXPECTED_ROWS.map((r) => [r.row, r.min]));
    expect(byRow).toMatchObject({
      "PR draft": 3, "PR at HOD Approval": 19, "PR at Purchase": 8, "PR at GM Approval": 2, "PR returned": 1,
      "PR approved": 5, "PR completed": 1, "PR voided": 2, "PR template": 1,
      "PO draft": 1, "PO voided": 1, "PO approved": 2, "PO sent": 1, "PO partial": 1, "PO completed": 1,
      "GRN draft": 1, "GRN saved": 1, "GRN committed": 2, "CN draft": 1, "CN completed": 1,
      "SR draft": 2, "SR in progress": 3, "SR voided": 1, "SR completed": 1, "Price list active": 3, "Campaign": 3,
    });
  });
});

describe("verifyDataset", () => {
  it("reports a row under its minimum with what was seeded for it", async () => {
    const backend = fakeBackend({}, (method, path) => {
      if (path === "/api/purchase-requests") return { data: [], paginate: { total: 1 } };
      if (path.endsWith("/purchase-requests") || path.endsWith("/store-requisitions")) return { data: [], paginate: { total: 99 } };
      return { data: Array.from({ length: 30 }, () => ({ workflow_current_stage: "x" })), paginate: { total: 99 } };
    });
    const ledger = new RowLedger();
    ledger.record("pr.draft", "PR-1", true);
    const { short } = await verifyDataset(createSessions(cfg, backend.fetchFn), cfg, ledger);
    expect(short).toContain("PR draft: expected ≥ 3, found 1 (seeded: PR-1)");
  });

  it("counts PRs per workflow stage from the in-progress rows", async () => {
    const stageRows = [
      ...Array(19).fill("HOD Approval"), ...Array(8).fill("Purchase"), ...Array(2).fill("GM Approval"), "Create Request",
    ].map((s) => ({ workflow_current_stage: s }));
    const backend = fakeBackend({}, (_m, path) =>
      path === "/api/purchase-requests" ? { data: stageRows, paginate: { total: 99 } } : { data: [], paginate: { total: 99 } },
    );
    const { short } = await verifyDataset(createSessions(cfg, backend.fetchFn), cfg, new RowLedger());
    expect(short).toEqual([]);
  });
});

describe("seedAllDocuments", () => {
  it("runs the document steps in order and turns short rows into a failed verify step", async () => {
    const order: string[] = [];
    const step = (name: string, extra: object = {}) => async () => {
      order.push(name);
      return { step: name, created: 1, skipped: 0, failed: [], ...extra };
    };
    const results = await seedAllDocuments(createSessions(cfg, fakeBackend({}).fetchFn), cfg, users, new Date("2026-11-05T03:00:00Z"), {
      context: async () => ctx,
      stock: step("stock"),
      prTemplate: step("pr-template"),
      purchaseRequests: step("purchase-requests", { reservedForPo: "pr-x" }),
      purchaseOrders: step("purchase-orders", { forGrn: { full: "a", partial: "b" } }),
      receiving: step("receiving"),
      storeRequisitions: step("store-requisitions"),
      pricing: step("pricing"),
      verify: async () => ({ short: ["PR draft: expected ≥ 3, found 0 (seeded: none)"], table: "" }),
    });
    expect(order).toEqual(["stock", "pr-template", "purchase-requests", "purchase-orders", "receiving", "store-requisitions", "pricing"]);
    expect(results.at(-1)).toEqual({ step: "verify", created: 0, skipped: 0, failed: ["PR draft: expected ≥ 3, found 0 (seeded: none)"] });
  });

  it("fails one step, not the run, when the context cannot be resolved", async () => {
    const results = await seedAllDocuments(createSessions(cfg, fakeBackend({}).fetchFn), cfg, users, new Date(), {
      context: async () => { throw new Error("no Purchase Request workflow in GR2VYNKQ"); },
    });
    expect(results).toEqual([{ step: "documents", created: 0, skipped: 0, failed: ["no Purchase Request workflow in GR2VYNKQ"] }]);
  });
});
