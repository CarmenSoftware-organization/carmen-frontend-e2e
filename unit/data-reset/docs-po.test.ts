import { describe, it, expect } from "vitest";
import { planPurchaseOrders, poActions, seedPurchaseOrders } from "../../scripts/data-reset/docs/purchase-orders";
import { RowLedger } from "../../scripts/data-reset/docs/row-ledger";
import { createSessions } from "../../scripts/data-reset/sessions";
import { fakeBackend } from "./fake-backend";
import { cfg, ctx, docStore, email } from "./docs-fixtures";

describe("planPurchaseOrders", () => {
  it("has one manual PO per row", () => {
    expect(planPurchaseOrders(ctx).map((p) => p.row)).toEqual([
      "po.draft", "po.rejected", "po.approved", "po.sent", "po.for-grn-full", "po.for-grn-partial",
    ]);
  });
});

describe("poActions", () => {
  const seq = (t: Parameters<typeof poActions>[0]) => poActions(t).map((a) => `${a.by}:${a.action}`);
  it("walks General PO purchase → FC → GM and marks sent where needed", () => {
    expect(seq("draft")).toEqual(["purchase:create"]);
    expect(seq("rejected")).toEqual(["purchase:create", "purchase:submit", "fc:reject"]);
    expect(seq("approved")).toEqual(["purchase:create", "purchase:submit", "fc:approve", "gm:approve"]);
    expect(seq("sent")).toEqual([...seq("approved"), "purchase:mark-sent"]);
    expect(seq("for-grn-full")).toEqual(seq("sent"));
    expect(seq("for-grn-partial")).toEqual(seq("sent"));
  });
});

describe("seedPurchaseOrders", () => {
  const run = async () => {
    const store = docStore("purchase_order_detail", "po_no");
    const backend = fakeBackend(
      { "POST /api/GR2VYNKQ/purchase-orders/confirm-pr": { data: [{ id: "po-from-pr", po_no: "PO-PR" }] },
        "GET /api/GR2VYNKQ/purchase-orders/po-from-pr": { data: { id: "po-from-pr", doc_version: 0, purchase_order_detail: [{ id: "x" }] } } },
      store.fallback,
    );
    const ledger = new RowLedger();
    const result = await seedPurchaseOrders(createSessions(cfg, backend.fetchFn), cfg, ctx, ledger, "pr-reserved");
    return { backend, ledger, result, store };
  };

  it("sends only the reserved PR to confirm-pr, once", async () => {
    const { backend } = await run();
    const confirms = backend.writesBy().filter((w) => w.path.endsWith("/confirm-pr"));
    expect(confirms).toHaveLength(1);
    expect(confirms[0].body).toEqual({ workflow_id: "wf-po", pr_ids: ["pr-reserved"] });
    const otherPrIds = backend.writesBy().filter((w) => JSON.stringify(w.body ?? "").includes("pr_ids"));
    expect(otherPrIds).toHaveLength(1);
  });

  it("creates manual POs and walks the PR's PO to approved", async () => {
    const { backend, result, ledger } = await run();
    expect(result.failed).toEqual([]);
    const creates = backend.writesBy().filter((w) => w.path === "/api/GR2VYNKQ/purchase-orders");
    expect(creates).toHaveLength(6);
    expect((creates[0].body as any).details).toMatchObject({ po_type: "manual", vendor_id: "v1", workflow_id: "wf-po" });
    const fromPr = backend.writesBy().filter((w) => w.path.startsWith("/api/GR2VYNKQ/purchase-orders/po-from-pr/"));
    expect(fromPr.map((w) => `${w.caller.split("+")[1].split("@")[0]} ${w.path.split("/").pop()}`)).toEqual(["fc approve", "gm approve"]);
    expect(ledger.rows()["pr.completed"].docNos).toEqual(["PO-PR"]);
    expect(Object.keys(result.forGrn)).toEqual(["full", "partial"]);
  });

  it("rejects at FC as fc and marks sent as purchase", async () => {
    const { backend } = await run();
    const w = backend.writesBy();
    expect(w.filter((x) => x.path.endsWith("/reject")).map((x) => x.caller)).toEqual([email("fc")]);
    expect(new Set(w.filter((x) => x.path.endsWith("/mark-sent")).map((x) => x.caller))).toEqual(new Set([email("purchase")]));
    expect(w.filter((x) => x.path.endsWith("/mark-sent")).every((x) => x.method === "POST")).toBe(true);
  });
});
