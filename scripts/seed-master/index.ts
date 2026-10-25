// scripts/seed-master/index.ts
import type { EntityName, SeedResult, SeedConfig } from "./types";
import { ALL_ENTITIES } from "./types";
import { resolveConfig, isLocalHost } from "./config";
import { readWorkbookFile, extractRows } from "./parser";
import { login, createApiClient } from "./api-client";
import { runSeed } from "./orchestrator";

export interface CliArgs {
  file: string;
  bu?: string;
  host?: string;
  limit: number;
  only?: EntityName[];
  skip?: EntityName[];
  dryRun: boolean;
  yes: boolean;
  verbose: boolean;
  help?: boolean;
}

function parseEntityList(v: string, flag: string): EntityName[] {
  const names = v.split(",").map((s) => s.trim()).filter(Boolean);
  const invalid = names.filter((n) => !ALL_ENTITIES.includes(n as EntityName));
  if (invalid.length > 0) throw new Error(`Unknown entity for ${flag}: ${invalid.join(", ")}`);
  return names as EntityName[];
}

export function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { file: "avg", limit: 50, dryRun: false, yes: false, verbose: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "-h":
      case "--help": args.help = true; break;
      case "--dry-run": args.dryRun = true; break;
      case "--yes": args.yes = true; break;
      case "--verbose": args.verbose = true; break;
      case "--file": {
        const v = argv[++i];
        if (v === undefined) throw new Error("Missing value for --file");
        args.file = v;
        break;
      }
      case "--bu": {
        const v = argv[++i];
        if (v === undefined) throw new Error("Missing value for --bu");
        args.bu = v;
        break;
      }
      case "--host": {
        const v = argv[++i];
        if (v === undefined) throw new Error("Missing value for --host");
        args.host = v;
        break;
      }
      case "--limit": {
        const v = argv[++i];
        if (v === undefined) throw new Error("Missing value for --limit");
        args.limit = Number(v);
        if (!Number.isFinite(args.limit) || args.limit < 0)
          throw new Error("--limit requires a non-negative number");
        break;
      }
      case "--only": {
        const v = argv[++i];
        if (v === undefined) throw new Error("Missing value for --only");
        args.only = parseEntityList(v, "--only");
        break;
      }
      case "--skip": {
        const v = argv[++i];
        if (v === undefined) throw new Error("Missing value for --skip");
        args.skip = parseEntityList(v, "--skip");
        break;
      }
      default: throw new Error(`Unknown argument: ${a}`);
    }
  }
  return args;
}

export function helpText(): string {
  return [
    "seed-master — seed a sample subset of Preconfig master data into an existing BU",
    "via the backend REST API (idempotent: existing records are skipped).",
    "",
    "Usage:",
    "  bun run seed:master [flags]",
    "",
    "Flags:",
    "  --dry-run               Preview only — log in, read existing records, write nothing.",
    "  --bu <code>             BU code to seed into (overrides SEED_BU_CODE).",
    "  --host <url>            Backend URL (overrides SEED_BACKEND_URL / config.json BACKEND_URL).",
    "  --file <avg|fifo|path>  Workbook to read (default: avg). avg/fifo resolve to the bundled",
    "                          sample_seed_data/Preconfig_CARMEN_*.xlsx; anything else is a path.",
    "  --limit <n>             Cap rows seeded for Product and Vendor (default: 50). Non-negative.",
    "  --only <a,b,...>        Seed only the listed entities (comma-separated).",
    "  --skip <a,b,...>        Seed everything except the listed entities.",
    "  --yes                   Required to seed a non-localhost target.",
    "  --verbose               More verbose logging.",
    "  -h, --help              Show this help and exit.",
    "",
    "Entities (for --only / --skip), seeded in FK order:",
    "  " + ALL_ENTITIES.join(", "),
    "",
    "Config (env, e.g. in .env.local):",
    "  SEED_BU_CODE            BU code (required unless --bu is passed).",
    "  SEED_EMAIL              Login email (required).",
    "  SEED_PASSWORD           Login password (required).",
    "  SEED_BACKEND_URL        Backend URL (optional; falls back to config.json BACKEND_URL).",
    "  SEED_X_APP_ID           X-App-Id header (optional; falls back to config.json X_APP_ID).",
    "  SEED_CONFIG_PATH        Frontend config.json path",
    "                          (default: ../carmen-frontend/dist/config.json).",
    "",
    "Examples:",
    "  bun run seed:master --dry-run                     # preview, no writes",
    "  bun run seed:master --bu BLAVG                    # localhost target",
    "  bun run seed:master --bu BLAVG --yes              # non-localhost (dev/uat) target",
    "  bun run seed:master --file fifo --limit 20        # FIFO workbook, 20 product/vendor rows",
    "  bun run seed:master --only currency,unit          # just these two",
    "  bun run seed:master --skip product,vendor         # everything except the big lists",
    "  bun run seed:master --host http://localhost:4000  # override backend URL",
    "",
    "Exit codes:",
    "  0  Completed with no failed rows (also dry-run / --help).",
    "  1  One or more rows failed, or an unexpected error was thrown.",
    "  2  Refused to seed a non-localhost target without --yes.",
  ].join("\n");
}

export function resolveEnabled(args: CliArgs): Set<EntityName> {
  let set = new Set<EntityName>(ALL_ENTITIES);
  if (args.only) set = new Set(args.only);
  if (args.skip) for (const s of args.skip) set.delete(s);
  return set;
}

export function resolveWorkbookPath(file: string): string {
  if (file === "avg") return "sample_seed_data/Preconfig_CARMEN_AVG.xlsx";
  if (file === "fifo") return "sample_seed_data/Preconfig_CARMEN_FIFO.xlsx";
  return file;
}

export function printSummary(results: SeedResult[]): string {
  const byEntity = new Map<string, { created: number; skipped: number; failed: number }>();
  for (const r of results) {
    const e = byEntity.get(r.entity) ?? { created: 0, skipped: 0, failed: 0 };
    e[r.status]++;
    byEntity.set(r.entity, e);
  }
  const lines = ["", "=== Seed summary ===", "entity".padEnd(16) + "created  skipped  failed"];
  for (const [entity, c] of byEntity) {
    lines.push(entity.padEnd(16) + String(c.created).padEnd(9) + String(c.skipped).padEnd(9) + String(c.failed));
  }
  const failed = results.filter((r) => r.status === "failed");
  if (failed.length > 0) {
    lines.push("", "Failures:");
    for (const f of failed) lines.push(`  ${f.entity} ${f.key}: ${f.error}`);
  }
  return lines.join("\n");
}

/** Print a usage/config error followed by the full help, then exit 1. */
function usageError(e: unknown): never {
  console.error(e instanceof Error ? e.message : String(e));
  console.error("");
  console.error(helpText());
  process.exit(1);
}

async function main(): Promise<void> {
  let args: CliArgs;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (e) {
    usageError(e);
  }

  if (args.help) {
    console.log(helpText());
    process.exit(0);
  }

  let cfg: SeedConfig;
  try {
    cfg = resolveConfig({
      ...process.env,
      ...(args.bu ? { SEED_BU_CODE: args.bu } : {}),
      ...(args.host ? { SEED_BACKEND_URL: args.host } : {}),
    });
  } catch (e) {
    usageError(e);
  }

  if (!args.dryRun && !isLocalHost(cfg.backendUrl) && !args.yes) {
    console.error(`Refusing to seed non-localhost target ${cfg.backendUrl} without --yes.`);
    process.exit(2);
  }

  const wbPath = resolveWorkbookPath(args.file);
  const enabled = resolveEnabled(args);
  console.log([
    "=== Master seed ===",
    `target:  ${cfg.backendUrl}`,
    `bu:      ${cfg.buCode}`,
    `file:    ${wbPath}`,
    `mode:    ${args.dryRun ? "DRY-RUN (no writes)" : "LIVE"}`,
    `limit:   ${args.limit}`,
    `entities: ${[...enabled].join(", ")}`,
  ].join("\n"));

  const rows = extractRows(readWorkbookFile(wbPath));
  const token = await login(cfg);
  const client = createApiClient(cfg, token);
  const results = await runSeed(cfg, client, rows, {
    limit: args.limit,
    dryRun: args.dryRun,
    enabled,
  });

  console.log(printSummary(results));
  const failed = results.filter((r) => r.status === "failed").length;
  process.exit(failed > 0 ? 1 : 0);
}

// Run only when invoked directly (not when imported by unit tests).
if (import.meta.main) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : String(e));
    console.error("\nRun 'bun run seed:master --help' for usage.");
    process.exit(1);
  });
}
