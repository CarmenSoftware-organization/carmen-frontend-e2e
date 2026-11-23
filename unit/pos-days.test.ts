import { describe, expect, it } from "vitest";
import { pastDays, saleDay } from "../tests/helpers/pos-days";

const NOV = { start: "2026-11-01", end: "2026-11-30" };
const FEB = { start: "2026-02-01", end: "2026-02-28" };

describe("saleDay", () => {
  it("counts 140 forward from the start and 141 backward from the end", () => {
    expect(saleDay(140, 1, NOV)).toBe("2026-11-01");
    expect(saleDay(140, 6, NOV)).toBe("2026-11-06");
    expect(saleDay(141, 1, NOV)).toBe("2026-11-30");
    expect(saleDay(141, 16, NOV)).toBe("2026-11-15");
  });
  it("throws past the caps", () => {
    expect(() => saleDay(140, 7, NOV)).toThrow();
    expect(() => saleDay(141, 17, NOV)).toThrow();
    expect(() => saleDay(140, 0, NOV)).toThrow();
  });
  it("never overlaps for a 28-day month", () => {
    const a = Array.from({ length: 6 }, (_, i) => saleDay(140, i + 1, FEB));
    const b = Array.from({ length: 16 }, (_, i) => saleDay(141, i + 1, FEB));
    expect(new Set([...a, ...b]).size).toBe(22);
  });
  it("throws when the period is too short for both ranges", () => {
    expect(() => saleDay(140, 1, { start: "2026-11-01", end: "2026-11-20" })).toThrow(/too short/);
  });
});

describe("pastDays", () => {
  it("is null on the 2nd of the month", () => {
    expect(pastDays(NOV, "2026-11-02", 1)).toBeNull();
  });
  it("never returns today, yesterday or a sale day", () => {
    const days = pastDays(NOV, "2026-11-23", 3)!;
    expect(days).toHaveLength(3);
    expect(new Set(days).size).toBe(3);
    for (const d of days) {
      expect(d < "2026-11-22").toBe(true);
      expect(d >= NOV.start).toBe(true);
      for (let n = 1; n <= 6; n++) expect(d).not.toBe(saleDay(140, n, NOV));
      for (let n = 1; n <= 16; n++) expect(d).not.toBe(saleDay(141, n, NOV));
    }
  });
  it("is null when not enough free days remain", () => {
    expect(pastDays(NOV, "2026-11-23", 20)).toBeNull();
  });
});
