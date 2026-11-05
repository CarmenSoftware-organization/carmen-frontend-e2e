import { describe, it, expect } from "vitest";
import { planStoreRequisitions, srActions, seedStoreRequisitions } from "../../scripts/data-reset/docs/store-requisitions";
import { RowLedger } from "../../scripts/data-reset/docs/row-ledger";
import { createSessions } from "../../scripts/data-reset/sessions";
import { fakeBackend } from "./fake-backend";
import { cfg, ctx, docStore, email } from "./docs-fixtures";

describe("planStoreRequisitions", () => {
  it("has the spec's rows", () => {
    expect(planStoreRequisitions().map((s) => s.row)).toEqual([
      "sr.draft", "sr.draft", "sr.approve", "sr.approve", "sr.ready-for-issue", "sr.cancelled", "sr.completed",
    ]);
  });
});

describe("srActions", () => {
  it("walks create → Store Approval → Issue, all by purchase", () => {
    const seq = (t: Parameters<typeof srActions>[0]) => srActions(t);
    expect(seq("draft")).toEqual(["create"]);
    expect(seq("approve")).toEqual(["create", "submit"]);
    expect(seq("ready-for-issue")).toEqual(["create", "submit", "approve"]);
    expect(seq("cancelled")).toEqual(["create", "submit", "reject"]);
    expect(seq("completed")).toEqual(["create", "submit", "approve", "issue"]);
  });
});

describe("seedStoreRequisitions", () => {
  it("moves stock from location 1 to 2 and sends the right quantities per stage", async () => {
    const store = docStore("store_requisition_detail", "sr_no");
    const backend = fakeBackend({}, store.fallback);
    const ledger = new RowLedger();
    const result = await seedStoreRequisitions(createSessions(cfg, backend.fetchFn), cfg, ctx, ledger);
    expect(result).toMatchObject({ created: 7, failed: [] });
    const w = backend.writesBy();
    expect(w.every((x) => x.caller === email("purchase"))).toBe(true);
    const create = w.find((x) => x.path === "/api/GR2VYNKQ/store-requisitions")!.body as any;
    expect(create.details).toMatchObject({ from_location_id: "l1", to_location_id: "l2", workflow_id: "wf-sr" });
    expect(create.details.store_requisition_detail.add).toEqual([
      { product_id: "p4", requested_qty: 5 },
      { product_id: "p5", requested_qty: 5 },
    ]);
    const bodies = (suffix: string) => w.filter((x) => x.path.endsWith(suffix)).map((x) => x.body as any);
    expect(bodies("/submit")[0]).toMatchObject({ stage_role: "create", sr_date_pattern: "today" });
    const approves = bodies("/approve");
    expect(approves.filter((b) => b.stage_role === "approve").every((b) => b.details.every((d: any) => d.approved_qty === 5))).toBe(true);
    const issue = approves.find((b) => b.stage_role === "issue")!;
    expect(issue.details.every((d: any) => d.issued_qty === 5)).toBe(true);
    expect(bodies("/reject")[0]).toMatchObject({ stage_role: "approve" });
    expect(ledger.rows()["sr.draft"].docNos).toHaveLength(2);
  });
});
