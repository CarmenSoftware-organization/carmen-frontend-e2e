import { describe, it, expect } from "vitest";
import { parseResetArgs } from "../../scripts/data-reset/cli";

describe("parseResetArgs", () => {
  it("reads the flags it knows", () => {
    expect(parseResetArgs(["--yes", "--skip-reset"])).toEqual({
      yes: true, skipReset: true, dryRun: false, verbose: false, help: false, bu: "BU-GR2VYNKQ",
    });
  });

  it("defaults every flag to false", () => {
    expect(parseResetArgs([])).toEqual({
      yes: false, skipReset: false, dryRun: false, verbose: false, help: false, bu: "BU-GR2VYNKQ",
    });
  });

  it("reads --dry-run, --verbose and -h", () => {
    expect(parseResetArgs(["--dry-run", "--verbose", "-h"])).toMatchObject({ dryRun: true, verbose: true, help: true });
  });

  it("reads --bu in both forms and refuses an unknown BU", () => {
    expect(parseResetArgs(["--bu", "BU-96EAT3GX"]).bu).toBe("BU-96EAT3GX");
    expect(parseResetArgs(["--bu=all"]).bu).toBe("all");
    expect(() => parseResetArgs(["--bu", "X"])).toThrow(/unknown bu/i);
  });
});
