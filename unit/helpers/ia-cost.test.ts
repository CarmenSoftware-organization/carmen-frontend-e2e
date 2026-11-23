import { describe, expect, it } from "vitest";
import { expectedIssueCost } from "../../tests/helpers/ia-cost";

const L = [
  { qty: 10, cost: 10 },
  { qty: 10, cost: 20 },
];

describe("expectedIssueCost", () => {
  it("average: issue × weighted average", () => {
    expect(expectedIssueCost(L, 5, "average")).toBe(75);
  });
  it("fifo: consumes layers in the given order", () => {
    expect(expectedIssueCost(L, 15, "fifo")).toBe(200);
    expect(expectedIssueCost(L, 10, "fifo")).toBe(100);
  });
  it("throws when the issue exceeds the layers", () => {
    expect(() => expectedIssueCost(L, 21, "fifo")).toThrow();
    expect(() => expectedIssueCost(L, 21, "average")).toThrow();
  });
  it("rounds only at the end (10.005 -> 10.01)", () => {
    expect(
      expectedIssueCost([{ qty: 3, cost: 10 }, { qty: 3, cost: 10.01 }], 1, "average"),
    ).toBe(10.01);
  });
});
