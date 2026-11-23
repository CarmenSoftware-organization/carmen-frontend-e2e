import { describe, expect, it } from "vitest";
import { buildSimphonyFile, type SimphonyLine } from "../tests/helpers/simphony-fixture";

const line = (over: Partial<SimphonyLine> = {}): SimphonyLine => ({
  outletCode: "OUT1", outletName: "Outlet 1", itemCode: "ITM1", itemName: "Item 1",
  deptCode: "D1", deptName: "Dept 1", qty: 3, total: 450, ...over,
});
const input = (lines: SimphonyLine[]) => ({ storeKey: "E2E-STORE", storeName: "E2E Store", businessDate: "2026-11-05", lines });

describe("buildSimphonyFile", () => {
  it("writes the GLID header with the business date twice", () => {
    const f = buildSimphonyFile(input([line()])).split("\r\n")[0].split("|");
    expect(f[0]).toBe("GLID");
    expect(f[1]).toBe("E2E-STORE");
    expect(f[3]).toBe("20261105");
    expect(f[4]).toBe("20261105");
    expect(f[7]).toBe("1.20");
  });
  it("writes MID lines with 40+ fields and the parsed columns in place", () => {
    const rows = buildSimphonyFile(input([line(), line({ itemCode: "ITM2", qty: 1.5, total: 99.5 })])).split("\r\n").filter(Boolean);
    expect(rows).toHaveLength(3);
    for (const r of rows.slice(1)) {
      const f = r.split("|");
      expect(f.length).toBeGreaterThanOrEqual(40);
      expect(f[0]).toBe("MID");
      expect(f[1]).toBe("OUT1");
      expect(["ITM1", "ITM2"]).toContain(f[3]);
      expect(f[14]).toBe("Outlet 1");
      expect(f[20]).toBe("D1");
    }
    const second = rows[2].split("|");
    expect(second[3]).toBe("ITM2");
    expect(second[6]).toBe("1.5");
    expect(second[32]).toBe("99.5");
  });
  it("uses CRLF and honours a custom version", () => {
    const f = buildSimphonyFile({ ...input([line()]), version: "1.10" });
    expect(f.endsWith("\r\n")).toBe(true);
    expect(f.split("\r\n")[0].split("|")[7]).toBe("1.10");
  });
  it("rejects a code longer than 20 characters", () => {
    expect(() => buildSimphonyFile(input([line({ itemCode: "X".repeat(21) })]))).toThrow(/item code/);
    expect(() => buildSimphonyFile(input([line({ outletCode: "X".repeat(21) })]))).toThrow(/outlet code/);
    expect(() => buildSimphonyFile({ ...input([line()]), storeKey: "X".repeat(21) })).toThrow(/store key/);
  });
});
