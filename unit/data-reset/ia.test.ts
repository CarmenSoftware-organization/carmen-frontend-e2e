import { describe, it, expect } from "vitest";
import { IA_TYPES, planIa } from "../../scripts/data-reset/docs/ia";
import { ctx } from "./docs-fixtures";

describe("planIa", () => {
  it("plans E2E-IA-A and E2E-IA-B on the first product as template and the first location", () => {
    const plan = planIa(ctx);
    expect(plan.products.map((p) => p.code)).toEqual(["E2E-IA-A", "E2E-IA-B"]);
    for (const p of plan.products) expect(p.templateId).toBe(ctx.products[0].id);
    expect(plan.locationId).toBe(ctx.locations.first.id);
  });

  it("throws when there is no product to copy from", () => {
    expect(() => planIa({ ...ctx, products: [] })).toThrow(/product/);
  });

  it("creates one stock_in and one stock_out type under its own codes", () => {
    expect(IA_TYPES.map((t) => [t.code, t.type])).toEqual([
      ["E2E-IA-IN", "stock_in"],
      ["E2E-IA-OUT", "stock_out"],
    ]);
  });
});
