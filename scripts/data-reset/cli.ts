// scripts/data-reset/cli.ts
// Flags for `bun run data:reset`. --bu picks one of the TEST BUs (or all three).
// แฟล็กของ `bun run data:reset` — --bu เลือก TEST BU หนึ่งตัว หรือ all
import { BU_CODE, TEST_BUS, type TestBuCode } from "../../tests/test-users";

export interface ResetArgs {
  dryRun: boolean;
  yes: boolean;
  skipReset: boolean;
  verbose: boolean;
  help: boolean;
  withHistory: boolean;
  bu: TestBuCode | "all";
}

type BooleanFlag = Exclude<keyof ResetArgs, "bu">;

const FLAGS: Record<string, BooleanFlag> = {
  "--dry-run": "dryRun",
  "--yes": "yes",
  "--skip-reset": "skipReset",
  "--verbose": "verbose",
  "--with-history": "withHistory",
  "--help": "help",
  "-h": "help",
};

export function parseResetArgs(argv: string[]): ResetArgs {
  const args: ResetArgs = { dryRun: false, yes: false, skipReset: false, verbose: false, help: false, withHistory: false, bu: BU_CODE };
  const allowed = [...TEST_BUS.map((b) => b.code), "all"];
  const setBu = (value: string | undefined): void => {
    if (value === undefined || !allowed.includes(value)) {
      throw new Error(`Unknown BU ${value === undefined ? "(missing value)" : value} (allowed: ${allowed.join(", ")})`);
    }
    args.bu = value as ResetArgs["bu"];
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--bu") {
      setBu(argv[++i]);
      continue;
    }
    if (arg.startsWith("--bu=")) {
      setBu(arg.slice("--bu=".length));
      continue;
    }
    const key = FLAGS[arg];
    if (!key) throw new Error(`Unknown flag: ${arg}`);
    args[key] = true;
  }
  if (args.withHistory && args.bu === "all") {
    throw new Error("--with-history needs one --bu <code> (not all): each BU needs its own period-close run");
  }
  return args;
}

export function resetHelpText(): string {
  return [
    "Usage: bun run data:reset [--bu <code|all>] [--dry-run] [--yes] [--skip-reset] [--verbose] [--with-history]",
    "",
    "Wipes a TEST BU on the dev backend and rebuilds the standard dataset.",
    `  --bu <code|all>  one of ${TEST_BUS.map((b) => b.code).join(" / ")}, or all in order (default ${BU_CODE})`,
    "  --dry-run     read-only: print every planned write, call nothing that writes",
    "  --yes         required for a live run against a non-localhost backend",
    "  --skip-reset  seed onto an already-reset BU (refused if it holds any PR)",
    "  --verbose     print each API call",
    "  --with-history  open LAST month as the first period (then this + next month); needs one --bu, not all",
    "",
    "Env (.env.local): DATA_RESET_DEPLOY_TOKEN, SEED_BACKEND_URL / SEED_X_APP_ID (or SEED_CONFIG_PATH)",
  ].join("\n");
}
