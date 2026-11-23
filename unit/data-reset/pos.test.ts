import { describe, it, expect } from "vitest";
import { planPos } from "../../scripts/data-reset/docs/pos";
import { ctx } from "./docs-fixtures";

describe("planPos", () => {
  const plan = planPos(ctx, "2026-11-01");

  it("has recipes E2E-POS-A (P1 x2, P2 x1) and E2E-POS-B (P3 x1, P4 x3) on the last four products", () => {
    expect(plan.recipes.map((r) => r.name)).toEqual(["E2E-POS-A", "E2E-POS-B"]);
    expect(plan.recipes.map((r) => r.ingredients.map((i) => [i.productId, i.qty]))).toEqual([
      [["p7", 2], ["p8", 1]],
      [["p9", 1], ["p10", 3]],
    ]);
    expect(plan.recipes[0].ingredients[0].unitId).toBe("u-ea");
  });

  it("stocks the four products with 500 @ 10 at both locations, dated the period start", () => {
    expect(plan.stockIns.map((s) => [s.row, s.locationId, s.siDate])).toEqual([
      ["pos.stock.l1", "l1", "2026-11-01"],
      ["pos.stock.l2", "l2", "2026-11-01"],
    ]);
    for (const s of plan.stockIns) {
      expect(s.lines).toEqual(["p7", "p8", "p9", "p10"].map((productId) => ({ productId, qty: 500, cost: 10 })));
    }
    expect(plan.productLocations.map((p) => p.productId)).toEqual(["p7", "p8", "p9", "p10"]);
  });

  it("throws when fewer than 4 products exist", () => {
    expect(() => planPos({ ...ctx, products: ctx.products.slice(0, 3) }, "2026-11-01")).toThrow(/4 products/);
  });
});
