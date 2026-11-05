// Regression tests for the review findings: wire shapes the real gateway uses.
import { describe, it, expect } from "vitest";
import { isoDay } from "../../scripts/data-reset/docs/dates";
import { createDoc, transition } from "../../scripts/data-reset/docs/transition";
import { refId } from "../../scripts/data-reset/docs/refs";
import { seedPurchaseRequests } from "../../scripts/data-reset/docs/purchase-requests";
import { seedPurchaseOrders } from "../../scripts/data-reset/docs/purchase-orders";
import { seedReceiving } from "../../scripts/data-reset/docs/receiving";
import { seedStock } from "../../scripts/data-reset/docs/stock";
import { seedStoreRequisitions } from "../../scripts/data-reset/docs/store-requisitions";
import { seedAllDocuments } from "../../scripts/data-reset/docs/seed-all";
import { resolveSeedContext } from "../../scripts/data-reset/docs/context";
import { verifyDataset } from "../../scripts/data-reset/verify-dataset";
import { RowLedger } from "../../scripts/data-reset/docs/row-ledger";
import { createSessions } from "../../scripts/data-reset/sessions";
import { fakeBackend } from "./fake-backend";
import { cfg, collapseRefs, ctx, docStore, users } from "./docs-fixtures";

const ISO = /^\d{4}-\d{2}-\d{2}T05:00:00\.000Z$/;
const sessionsOf = (backend: ReturnType<typeof fakeBackend>) => createSessions(cfg, backend.fetchFn);

describe("dates on the wire (C1: z.string().datetime() refuses YYYY-MM-DD)", () => {
  it("isoDay is noon in Bangkok as a UTC datetime", () => {
    expect(isoDay("2026-11-05")).toBe("2026-11-05T05:00:00.000Z");
  });

  it("PR, SR, GRN, CN and stock-in dates are full ISO datetimes", async () => {
    const store = docStore("purchase_request_detail", "pr_no");
    const backend = fakeBackend({}, store.fallback);
    await seedPurchaseRequests(sessionsOf(backend), cfg, ctx, new RowLedger());
    const pr = backend.writes().find((w) => w.path === "/api/GR2VYNKQ/purchase-requests")!.body as any;
    expect(pr.details.pr_date).toMatch(ISO);
    expect(pr.details.purchase_request_detail.add[0].delivery_date).toMatch(ISO);

    const srStore = docStore("store_requisition_detail", "sr_no");
    const srBackend = fakeBackend({}, srStore.fallback);
    await seedStoreRequisitions(sessionsOf(srBackend), cfg, ctx, new RowLedger());
    const sr = srBackend.writes().find((w) => w.path === "/api/GR2VYNKQ/store-requisitions")!.body as any;
    expect([sr.details.sr_date, sr.details.expected_date].every((d: string) => ISO.test(d))).toBe(true);
  });

  it("GRN, CN and expiry dates are full ISO datetimes", async () => {
    const store = docStore("good_received_note_detail", "grn_no");
    const po = (id: string) => ({ data: collapseRefs({ id, doc_version: 0, purchase_order_detail: [{ id: `${id}-a`, product_id: "p1", location_id: "l1", order_qty: 10, order_unit_id: "u", price: 100 }] }) });
    const backend = fakeBackend({ "GET /api/GR2VYNKQ/purchase-orders/poF": po("poF"), "GET /api/GR2VYNKQ/purchase-orders/poP": po("poP") }, store.fallback);
    await seedReceiving(sessionsOf(backend), cfg, ctx, new RowLedger(), { full: "poF", partial: "poP" });
    const grn = backend.writes().find((w) => w.path === "/api/GR2VYNKQ/good-received-notes")!.body as any;
    expect([grn.grn_date, grn.invoice_date].every((d: string) => ISO.test(d))).toBe(true);
    const cn = backend.writes().find((w) => w.path === "/api/GR2VYNKQ/credit-notes")!.body as any;
    expect(cn.cn_date).toMatch(ISO);
  });
});

describe("collapsed refs on GET (C2)", () => {
  it("refId reads flat and collapsed shapes", () => {
    expect(refId({ unit_id: "a" }, "unit")).toBe("a");
    expect(refId({ unit: { id: "b" } }, "unit")).toBe("b");
    expect(refId({}, "unit")).toBeUndefined();
  });

  it("GRN lines against a PO carry product, location and unit from the collapsed PO detail", async () => {
    const store = docStore("good_received_note_detail", "grn_no");
    const po = (id: string) => ({ data: collapseRefs({ id, doc_version: 0, purchase_order_detail: [{ id: `${id}-a`, product_id: "p1", location_id: "l1", order_qty: 10, order_unit_id: "u", price: 100 }] }) });
    const backend = fakeBackend({ "GET /api/GR2VYNKQ/purchase-orders/poF": po("poF"), "GET /api/GR2VYNKQ/purchase-orders/poP": po("poP") }, store.fallback);
    await seedReceiving(sessionsOf(backend), cfg, ctx, new RowLedger(), { full: "poF", partial: "poP" });
    const line = (backend.writes().find((w) => w.path === "/api/GR2VYNKQ/good-received-notes")!.body as any).good_received_note_detail.add[0];
    expect(line).toMatchObject({ product_id: "p1", location_id: "l1", received_unit_id: "u" });
  });

  it("PR approve lines carry approved_unit_id from the collapsed requested_unit", async () => {
    const store = docStore("purchase_request_detail", "pr_no");
    const backend = fakeBackend({}, store.fallback);
    await seedPurchaseRequests(sessionsOf(backend), cfg, ctx, new RowLedger());
    const approve = backend.writes().find((w) => (w.body as any)?.stage_role === "approve" && w.path.endsWith("/approve"))!.body as any;
    expect(approve.details[0].approved_unit_id).toBe("u-ea");
  });

  it("the context reads the product unit from the collapsed list item", async () => {
    const base = "/api/config/GR2VYNKQ";
    const backend = fakeBackend({
      [`GET ${base}/departments`]: { data: [{ id: "dA", code: "A", name: "A" }, { id: "dB", code: "B", name: "B" }] },
      [`GET ${base}/locations`]: { data: [{ id: "l1", code: "1", name: "1", location_type: "inventory" }, { id: "l2", code: "2", name: "2", location_type: "inventory" }] },
      [`GET ${base}/products`]: { data: Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, code: `c${i}`, inventory_unit: { id: "u", name: "ea" } })) },
      [`GET ${base}/vendors`]: { data: [{ id: "v1", code: "A" }] },
      [`GET ${base}/vendors/v1`]: { data: { vendor_contact: [{ email: "v@x" }] } },
      [`GET ${base}/currencies`]: { data: [{ id: "thb", code: "THB" }] },
      [`GET ${base}/delivery-points`]: { data: [{ id: "dp" }] },
      [`GET ${base}/tax-profiles`]: { data: [{ id: "t0", name: "None" }] },
      [`GET ${base}/workflows`]: { data: ["purchase_request", "purchase_order", "store_requisition"].map((t) => ({ id: t, workflow_type: t })) },
      [`GET ${base}/adjustment-types`]: { data: [{ id: "a" }] },
    });
    const c = await resolveSeedContext(sessionsOf(backend), cfg, users, new Date("2026-11-05T03:00:00Z"));
    expect(c.products.every((p) => p.unitId === "u")).toBe(true);
  });
});

describe("product locations (C3)", () => {
  it("sends doc_version and location_id, and links all 10 products to both locations", async () => {
    let v = 0;
    const backend = fakeBackend(
      { "GET /api/GR2VYNKQ/inventory-periods/current": { data: { status: "open", start_at: "2026-11-01T00:00:00Z", end_at: "2026-11-30T00:00:00Z" } } },
      (method, path) => {
        if (method === "GET" && path.startsWith("/api/config/GR2VYNKQ/products/")) return { data: { id: path.split("/").pop(), doc_version: 7, locations: [] } };
        if (method === "POST") return { data: { id: `si${++v}`, doc_version: 0 } };
        if (method === "GET") return { data: { doc_version: 0 } };
        return { data: {} };
      },
    );
    await seedStock(sessionsOf(backend), cfg, ctx, new RowLedger());
    const patches = backend.writes().filter((w) => w.method === "PATCH" && w.path.startsWith("/api/config/GR2VYNKQ/products/"));
    expect(patches).toHaveLength(10);
    const p1 = patches.find((w) => w.path.endsWith("/p1"))!.body as any;
    expect(p1.doc_version).toBe(7);
    expect(p1.locations.add).toEqual([
      { location_id: "l1", par_qty: 100, min_qty: 10, max_qty: 150 },
      { location_id: "l2" },
    ]);
    const p5 = patches.find((w) => w.path.endsWith("/p5"))!.body as any;
    expect(p5.locations.add).toEqual([{ location_id: "l1" }, { location_id: "l2" }]);
  });

  it("updates instead of adding a location the product already has", async () => {
    const backend = fakeBackend(
      { "GET /api/GR2VYNKQ/inventory-periods/current": { data: { status: "open", start_at: "2026-11-01T00:00:00Z", end_at: "2026-11-30T00:00:00Z" } } },
      (method, path) => {
        if (method === "GET" && path.startsWith("/api/config/GR2VYNKQ/products/")) return { data: { doc_version: 1, locations: [{ location: { id: "l1" } }] } };
        if (method === "POST") return { data: { id: "si", doc_version: 0 } };
        if (method === "GET") return { data: { doc_version: 0 } };
        return { data: {} };
      },
    );
    await seedStock(sessionsOf(backend), cfg, ctx, new RowLedger());
    const p1 = backend.writes().find((w) => w.path === "/api/config/GR2VYNKQ/products/p1")!.body as any;
    expect(p1.locations).toEqual({
      update: [{ location_id: "l1", par_qty: 100, min_qty: 10, max_qty: 150 }],
      add: [{ location_id: "l2" }],
    });
  });

  it("expiry dates on stock-ins are full ISO datetimes", async () => {
    const backend = fakeBackend(
      { "GET /api/GR2VYNKQ/inventory-periods/current": { data: { status: "open", start_at: "2026-11-01T00:00:00Z", end_at: "2026-11-30T00:00:00Z" } } },
      (method) => (method === "POST" ? { data: { id: "si", doc_version: 0 } } : { data: { doc_version: 0, locations: [] } }),
    );
    await seedStock(sessionsOf(backend), cfg, ctx, new RowLedger());
    const expiries = backend.writes().filter((w) => w.path === "/api/GR2VYNKQ/stock-ins")
      .flatMap((w) => (w.body as any).stock_in_detail.add).filter((l: any) => l.expired_at).map((l: any) => l.expired_at);
    expect(expiries).toEqual(["2026-10-06T05:00:00.000Z", "2026-11-12T05:00:00.000Z"]);
  });
});

describe("PR / SR list shape (C4): data[0] per BU", () => {
  it("reads paginate and rows from data[0]", async () => {
    const stages = [...Array(19).fill("HOD Approval"), ...Array(8).fill("Purchase"), ...Array(2).fill("GM Approval"), "Create Request"];
    const backend = fakeBackend({}, (_m, path) => {
      if (path === "/api/purchase-requests" || path === "/api/store-requisitions") {
        return { data: [{ bu_code: "GR2VYNKQ", paginate: { total: 99 }, data: stages.map((s) => ({ workflow_current_stage: s })) }] };
      }
      return { data: [], paginate: { total: 99 } };
    });
    const { short } = await verifyDataset(sessionsOf(backend), cfg, new RowLedger());
    expect(short).toEqual([]);
  });
});

describe("exceptions never abort the document half (I1)", () => {
  it("turns a throwing step into a failed step and still verifies", async () => {
    const ok = (step: string, extra = {}) => async () => ({ step, created: 1, skipped: 0, failed: [], ...extra });
    const results = await seedAllDocuments(createSessions(cfg, fakeBackend({}).fetchFn), cfg, users, new Date(), {
      context: async () => ctx,
      stock: async () => { throw new Error("fetch failed"); },
      prTemplate: ok("pr-template"),
      purchaseRequests: ok("purchase-requests", { reservedForPo: "" }),
      purchaseOrders: ok("purchase-orders", { forGrn: { full: "", partial: "" } }),
      receiving: ok("receiving"),
      storeRequisitions: ok("store-requisitions"),
      pricing: ok("pricing"),
      verify: async () => ({ short: [], table: "" }),
    });
    expect(results[0]).toEqual({ step: "stock", created: 0, skipped: 0, failed: ["stock threw: fetch failed"] });
    expect(results.map((r) => r.step)).toContain("verify");
  });
});

describe("doc numbers (I3) and stale versions (I4)", () => {
  it("createDoc reads the doc number with a GET when the create response has none", async () => {
    const backend = fakeBackend({
      "POST /api/GR2VYNKQ/purchase-requests": { data: { id: "pr1", doc_version: 0 } },
      "GET /api/GR2VYNKQ/purchase-requests/pr1": { data: { id: "pr1", pr_no: "PR26110001" } },
    });
    const client = await sessionsOf(backend).client(cfg.adminEmail);
    expect(await createDoc(client, "/api/GR2VYNKQ/purchase-requests", {})).toMatchObject({ id: "pr1", no: "PR26110001" });
  });

  it("retries once when a 4xx says the version is stale", async () => {
    let n = 0;
    const backend = fakeBackend({
      "GET /api/GR2VYNKQ/x/1": { data: { doc_version: 1 } },
      "PATCH /api/GR2VYNKQ/x/1/submit": () => (++n === 1 ? { __status: 400, message: "doc_version mismatch" } : { data: {} }),
    });
    const client = await sessionsOf(backend).client(cfg.adminEmail);
    expect((await transition(client, "/api/GR2VYNKQ/x/1", "submit", (v) => ({ doc_version: v }))).ok).toBe(true);
    expect(n).toBe(2);
  });
});

describe("purchase orders on failure (I5)", () => {
  it("records a failed FC approve and does not hand that PO to receiving", async () => {
    const store = docStore("purchase_order_detail", "po_no");
    store.failOn("PATCH", /\/approve$/, 1);
    const backend = fakeBackend({ "POST /api/GR2VYNKQ/purchase-orders/confirm-pr": { data: { purchase_orders: [{ id: "pp" }] } } }, store.fallback);
    const ledger = new RowLedger();
    const result = await seedPurchaseOrders(sessionsOf(backend), cfg, ctx, ledger, "pr-r");
    expect(ledger.rows()["po.approved"].failures).toHaveLength(1);
    expect(result.forGrn.full).not.toBe("");
    expect(result.failed.length).toBeGreaterThanOrEqual(1);
  });

  it("reads the PO made by confirm-pr from data.purchase_orders", async () => {
    const store = docStore("purchase_order_detail", "po_no");
    const backend = fakeBackend(
      { "POST /api/GR2VYNKQ/purchase-orders/confirm-pr": { data: { purchase_orders: [{ id: "pp", po_no: "PO-9" }] } },
        "GET /api/GR2VYNKQ/purchase-orders/pp": { data: { id: "pp", doc_version: 0, po_no: "PO-9", purchase_order_detail: [] } } },
      store.fallback,
    );
    const ledger = new RowLedger();
    await seedPurchaseOrders(sessionsOf(backend), cfg, ctx, ledger, "pr-r");
    expect(ledger.rows()["po.from-pr"].docNos).toEqual(["PO-9"]);
  });

  it("skips confirm-pr when no PR was reserved and says so", async () => {
    const store = docStore("purchase_order_detail", "po_no");
    const backend = fakeBackend({}, store.fallback);
    const ledger = new RowLedger();
    await seedPurchaseOrders(sessionsOf(backend), cfg, ctx, ledger, "");
    expect(backend.writes().some((w) => w.path.endsWith("/confirm-pr"))).toBe(false);
    expect(ledger.rows()["pr.completed"].failures).toEqual(["pr.completed: no PR reached approved to convert"]);
  });
});
