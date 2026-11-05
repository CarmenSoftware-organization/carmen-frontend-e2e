// scripts/data-reset/cli.ts
// Flags for `bun run data:reset`. The BU is fixed to TEST BU, so there is no --bu.
// แฟล็กของ `bun run data:reset` — BU ถูกตรึงไว้ที่ TEST BU จึงไม่มี --bu

export interface ResetArgs {
  dryRun: boolean;
  yes: boolean;
  skipReset: boolean;
  verbose: boolean;
  help: boolean;
}

const FLAGS: Record<string, keyof ResetArgs> = {
  "--dry-run": "dryRun",
  "--yes": "yes",
  "--skip-reset": "skipReset",
  "--verbose": "verbose",
  "--help": "help",
  "-h": "help",
};

export function parseResetArgs(argv: string[]): ResetArgs {
  const args: ResetArgs = { dryRun: false, yes: false, skipReset: false, verbose: false, help: false };
  for (const arg of argv) {
    const key = FLAGS[arg];
    if (!key) throw new Error(`Unknown flag: ${arg}`);
    args[key] = true;
  }
  return args;
}

export function resetHelpText(): string {
  return [
    "Usage: bun run data:reset [--dry-run] [--yes] [--skip-reset] [--verbose]",
    "",
    "Wipes TEST BU (GR2VYNKQ) on the dev backend and rebuilds the standard dataset.",
    "  --dry-run     read-only: print every planned write, call nothing that writes",
    "  --yes         required for a live run against a non-localhost backend",
    "  --skip-reset  seed onto an already-reset BU (refused if it holds any PR)",
    "  --verbose     print each API call",
    "",
    "Env (.env.local): DATA_RESET_DEPLOY_TOKEN, SEED_BACKEND_URL / SEED_X_APP_ID (or SEED_CONFIG_PATH)",
  ].join("\n");
}
