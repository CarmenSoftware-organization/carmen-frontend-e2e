import { describe, it, expect } from "vitest";
import { parseResetArgs } from "../../scripts/data-reset/cli";

describe("parseResetArgs", () => {
  it("reads the flags it knows", () => {
    expect(parseResetArgs(["--yes", "--skip-reset"])).toEqual({
      yes: true, skipReset: true, dryRun: false, verbose: false, help: false,
    });
  });

  it("defaults every flag to false", () => {
    expect(parseResetArgs([])).toEqual({ yes: false, skipReset: false, dryRun: false, verbose: false, help: false });
  });

  it("reads --dry-run, --verbose and -h", () => {
    expect(parseResetArgs(["--dry-run", "--verbose", "-h"])).toMatchObject({ dryRun: true, verbose: true, help: true });
  });

  it("refuses --bu: the BU is fixed", () => {
    expect(() => parseResetArgs(["--bu", "X"])).toThrow(/unknown flag/i);
  });
});
