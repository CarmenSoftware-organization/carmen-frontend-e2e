import { describe, expect, it } from "vitest";
import { INVOICE_PLANS, planTotal } from "../scripts/data-reset/docs/accounting";
import { docAmounts, expectBalanced, netFromIncVat, round, vatOf, whtOf } from "../tests/helpers/money";

describe("money oracle", () => {
  it("rounds half-up", () => {
    expect(round(69.9993, 2)).toBe(70);
    expect(round(0.005, 2)).toBe(0.01);
    expect(round(1.005, 2)).toBe(1.01);
    expect(round(-0.005, 2)).toBe(-0.01);
    expect(round(2.5, 0)).toBe(3);
  });
  it("computes VAT, WHT and the Inc-VAT base", () => {
    expect(vatOf(999.99, 7, 2)).toBe(70);
    expect(whtOf(999.99, 3, 2)).toBe(30);
    expect(netFromIncVat(1070, 7, 2)).toBe(1000);
  });
  it("totals the rounding case 3 x 333.33", () => {
    expect(docAmounts([{ qty: 3, price: 333.33 }])).toEqual({ net: 999.99, vat: 70, total: 1069.99 });
  });
  it("splits an Inc-VAT line", () => {
    expect(docAmounts([{ qty: 1, price: 1070, incVat: true }])).toEqual({ net: 1000, vat: 70, total: 1070 });
  });
  it("expectBalanced passes a balanced journal and throws on a 0.01 gap", () => {
    expect(() => expectBalanced([{ dr: 100, cr: 0 }, { dr: 0, cr: 100 }])).not.toThrow();
    expect(() => expectBalanced([{ dr: 100, cr: 0 }, { dr: 0, cr: 99.99 }])).toThrow(/not balanced/);
  });
  it("agrees with the seed's planTotal for every INVOICE_PLANS entry", () => {
    for (const plan of INVOICE_PLANS) {
      const lines = plan.lines.map((l) => ({ qty: l.qty, price: l.price, vat: !!l.vat, incVat: !!l.vatIncluded }));
      expect(docAmounts(lines).total, plan.key).toBe(planTotal(plan));
    }
  });
});
