import { describe, it, expect } from "vitest";
import { resolveSeedContext } from "../../scripts/data-reset/docs/context";
import { createSessions } from "../../scripts/data-reset/sessions";
import { fakeBackend } from "./fake-backend";
import { cfg, users } from "./docs-fixtures";

const base = "/api/config/GR2VYNKQ";
const routes = (over: Record<string, unknown> = {}) => ({
  [`GET ${base}/departments`]: { data: [{ id: "dB", code: "B", name: "Bar" }, { id: "dA", code: "A", name: "Admin" }] },
  [`GET ${base}/locations`]: {
    data: [
      { id: "l3", code: "1AG03", name: "Three", location_type: "inventory" },
      { id: "l2", code: "1AG02", name: "Two", location_type: "direct" },
      { id: "l1", code: "1AG01", name: "One", location_type: "inventory" },
    ],
  },
  [`GET ${base}/products`]: {
    data: Array.from({ length: 12 }, (_, i) => ({ id: `p${12 - i}`, code: `111100${String(12 - i).padStart(2, "0")}`, inventory_unit_id: "u" })),
  },
  [`GET ${base}/vendors`]: { data: [{ id: "v1", code: "A023" }] },
  [`GET ${base}/vendors/v1`]: { data: { vendor_contact: [{ email: "v@x" }] } },
  [`GET ${base}/currencies`]: { data: [{ id: "usd", code: "USD" }, { id: "thb", code: "THB" }] },
  [`GET ${base}/delivery-points`]: { data: [{ id: "dp", name: "MAIN" }] },
  [`GET ${base}/tax-profiles`]: { data: [{ id: "t7", name: "Vat 7%" }, { id: "t0", name: "None" }] },
  [`GET ${base}/workflows`]: {
    data: [
      { id: "wpr", name: "Purchase Request", workflow_type: "purchase_request" },
      { id: "wpo", name: "General PO", workflow_type: "purchase_order" },
      { id: "wsr", name: "Store Requisition", workflow_type: "store_requisition" },
    ],
  },
  [`GET ${base}/adjustment-types`]: { data: [{ id: "a-out", code: "SO", type: "stock_out" }, { id: "a-in", code: "SI", type: "stock_in" }] },
  ...over,
});

describe("resolveSeedContext", () => {
  it("collects every id the document payloads need", async () => {
    const backend = fakeBackend(routes());
    const ctx = await resolveSeedContext(createSessions(cfg, backend.fetchFn), cfg, users, new Date("2026-11-05T03:00:00Z"));
    expect(ctx.today).toBe("2026-11-05");
    expect(ctx.departments).toEqual({ first: { id: "dA", name: "Admin" }, second: { id: "dB", name: "Bar" } });
    expect(ctx.locations).toEqual({ first: { id: "l1", name: "One" }, second: { id: "l3", name: "Three" } });
    expect(ctx.products.map((p) => p.id)).toEqual(["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9", "p10"]);
    expect(ctx.products[0]).toEqual({ id: "p1", code: "11110001", unitId: "u" });
    expect(ctx).toMatchObject({
      vendor: { id: "v1", email: "v@x" }, currencyId: "thb", deliveryPointId: "dp", taxProfileId: "t0",
      workflows: { pr: "wpr", po: "wpo", sr: "wsr" }, adjustmentTypeId: "a-in",
    });
    expect(backend.writes()).toEqual([]);
  });

  it("names what is missing", async () => {
    const backend = fakeBackend(routes({ [`GET ${base}/workflows`]: { data: [] } }));
    await expect(
      resolveSeedContext(createSessions(cfg, backend.fetchFn), cfg, users, new Date("2026-11-05T03:00:00Z")),
    ).rejects.toThrow("no Purchase Request workflow in GR2VYNKQ");
  });
});
