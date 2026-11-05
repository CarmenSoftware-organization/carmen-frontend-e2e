// scripts/data-reset/index.ts
// `bun run data:reset` — wipe TEST BU on dev and rebuild the standard dataset (plan 2: everything
// but documents and stock). Manual on purpose: never wired into `bun run test`.
// ล้าง TEST BU บน dev แล้วสร้างชุดข้อมูลมาตรฐานใหม่ — สั่งเองเท่านั้น ไม่ผูกกับ bun run test
import { isLocalHost } from "../seed-master/config";
import type { ApiClient } from "../seed-master/api-client";
import { parseArgs as parseSeedArgs, printSummary, resolveEnabled, resolveWorkbookPath } from "../seed-master/index";
import { runSeed } from "../seed-master/orchestrator";
import { extractRows, readWorkbookFile } from "../seed-master/parser";
import type { SeedResult } from "../seed-master/types";
import { getPasswordFor } from "../../tests/test-users";
import { parseResetArgs, resetHelpText, type ResetArgs } from "./cli";
import { resolveResetConfig, type ResetConfig } from "./config";
import { seedMappings } from "./mappings";
import { seedPeriod, planPeriod } from "./period";
import { callReset } from "./reset";
import { createSessions } from "./sessions";
import type { StepResult } from "./step-result";
import { verifyEnvironment } from "./verify-env";
import { loadWorkflowFixture, validateFixture } from "./workflow-template";
import { seedWorkflows } from "./workflows";
import { seedAllDocuments } from "./docs/seed-all";
import type { TestUserInfo } from "./verify-env";
import type { Sessions } from "./sessions";

export interface RunDeps {
  fetchFn?: typeof fetch;
  now?: Date;
  log?: (line: string) => void;
  /** Master data seeding; defaults to seed-master's workbook run (sample subset). */
  seedMaster?: (client: ApiClient, dryRun: boolean, cfg: ResetConfig) => Promise<SeedResult[]>;
  /** Documents, stock and the final count (plan 3); defaults to seedAllDocuments. */
  seedDocuments?: (
    sessions: Sessions, cfg: ResetConfig, users: Record<string, TestUserInfo>, now: Date, log: (line: string) => void,
  ) => Promise<StepResult[]>;
}

async function defaultSeedMaster(client: ApiClient, dryRun: boolean, cfg: ResetConfig): Promise<SeedResult[]> {
  const defaults = parseSeedArgs([]);
  const rows = extractRows(readWorkbookFile(resolveWorkbookPath(defaults.file)));
  const seedCfg = {
    backendUrl: cfg.backendUrl, xAppId: cfg.xAppId, buCode: cfg.buCode,
    email: cfg.adminEmail, password: getPasswordFor(cfg.adminEmail),
  };
  return runSeed(seedCfg, client, rows, { limit: defaults.limit, dryRun, enabled: resolveEnabled(defaults) });
}

function summaryTable(results: StepResult[]): string {
  const lines = ["step        created  skipped  failed"];
  for (const r of results) {
    lines.push(`${r.step.padEnd(12)}${String(r.created).padStart(7)}${String(r.skipped).padStart(9)}${String(r.failed.length).padStart(8)}`);
    for (const f of r.failed) lines.push(`  ✗ ${f}`);
  }
  return lines.join("\n");
}

function masterStep(results: SeedResult[]): StepResult {
  return {
    step: "master",
    created: results.filter((r) => r.status === "created").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    failed: results.filter((r) => r.status === "failed").map((r) => `${r.entity} ${r.key}: ${r.error ?? "failed"}`),
  };
}

/** PR count, or why it could not be read — the --skip-reset guard must fail closed. */
async function countPurchaseRequests(client: ApiClient, cfg: ResetConfig): Promise<number | string> {
  const path = `/api/${cfg.buCode}/purchase-requests?perpage=1`;
  const res = await client.get(path);
  const total = res.body?.paginate?.total;
  if (!res.ok) return `GET ${path} → ${res.status}`;
  if (typeof total !== "number") return `GET ${path} gave no paginate.total`;
  return total;
}

export async function runDataReset(args: ResetArgs, cfg: ResetConfig, deps: RunDeps = {}): Promise<number> {
  const log = deps.log ?? console.log;
  const now = deps.now ?? new Date();
  const seedMaster = deps.seedMaster ?? defaultSeedMaster;

  if (!args.dryRun && !isLocalHost(cfg.backendUrl) && !args.yes) {
    log(`Refusing to reset ${cfg.buCode} on non-localhost ${cfg.backendUrl} without --yes.`);
    return 2;
  }
  const fixture = loadWorkflowFixture();
  const fixtureProblems = validateFixture(fixture);
  if (fixtureProblems.length > 0) {
    fixtureProblems.forEach((p) => log(`✗ workflow fixture: ${p}`));
    return 1;
  }
  log(`=== data:reset ${cfg.buCode} @ ${cfg.backendUrl} — ${args.dryRun ? "DRY-RUN (no writes)" : "LIVE"} ===`);

  const sessions = createSessions(cfg, deps.fetchFn);
  const env = await verifyEnvironment(sessions, cfg);
  if (env.problems.length > 0) {
    log("Step 0 failed — nothing was changed:");
    env.problems.forEach((p) => log(`  ✗ ${p}`));
    return 1;
  }
  log("step 0: 9 accounts in the BU, purchase permissions present");
  const admin = await sessions.client(cfg.adminEmail);

  if (args.dryRun) {
    log(`reset: would POST /api-system/tenant/resets/${env.buId}${args.skipReset ? " (skipped: --skip-reset)" : ""}`);
    const master = masterStep(await seedMaster(admin, true, cfg));
    log(`master: would create ${master.created}, ${master.skipped} already present`);
    log("mappings: would PATCH 2 departments (all 9 accounts + hod as HOD; owner in the second) and PUT 9 location sets");
    log(`workflows: would POST ${fixture.workflows.map((w) => w.name).join(", ")}`);
    log(`period: would POST ${JSON.stringify(planPeriod(now))} unless an open period covers today`);
    log("documents: would create 5 stock-ins, 1 PR template, 41 PRs, 7 POs, 4 GRNs, 2 CNs, 7 SRs, 3 price lists, 3 campaigns, then verify the counts");
    return 0;
  }

  if (args.skipReset) {
    const prs = await countPurchaseRequests(admin, cfg);
    if (typeof prs === "string") {
      log(`--skip-reset: cannot tell whether ${cfg.buCode} is empty (${prs}) — refusing to seed.`);
      return 1;
    }
    if (prs > 0) {
      log(`--skip-reset: ${cfg.buCode} already holds ${prs} purchase request(s); the seed is not written to resume. Reset first.`);
      return 1;
    }
    log("reset: skipped (--skip-reset), BU holds no purchase request");
  } else {
    const outcome = await callReset(cfg, env.buId, deps.fetchFn);
    if (!outcome.ok) {
      log(`✗ reset: ${outcome.message}`);
      return 1;
    }
    log(`reset: ${outcome.summary.tables_truncated} tables emptied, tenant seeds ${outcome.summary.seeds.success ? "re-applied" : "FAILED"}`);
    if (!outcome.summary.seeds.success) {
      log("✗ the BU is empty but the tenant base seeds failed — run POST /api-system/tenant/seeds/:bu_id/deploy/stream, then rerun with --skip-reset");
      return 1;
    }
  }

  const masterResults = await seedMaster(admin, false, cfg);
  const results: StepResult[] = [masterStep(masterResults)];
  if (results[0].failed.length > 0) {
    log(printSummary(masterResults));
    log(summaryTable(results));
    return 1;
  }
  const mappings = await seedMappings(sessions, cfg, env.userIds);
  results.push(mappings);
  if (mappings.firstDepartment) {
    results.push(await seedWorkflows(sessions, cfg, fixture, env.users, mappings.firstDepartment));
    results.push(await seedPeriod(sessions, cfg, now));
  }
  if (results.every((r) => r.failed.length === 0) && mappings.firstDepartment) {
    const seedDocuments = deps.seedDocuments ?? ((s, c, u, n, l) => seedAllDocuments(s, c, u, n, {}, l));
    results.push(...(await seedDocuments(sessions, cfg, env.users, now, log)));
  }
  log(summaryTable(results));
  return results.some((r) => r.failed.length > 0) ? 1 : 0;
}

async function main(): Promise<void> {
  let args: ResetArgs;
  try {
    args = parseResetArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    console.error(resetHelpText());
    process.exit(2);
  }
  if (args.help) {
    console.log(resetHelpText());
    process.exit(0);
  }
  process.exit(await runDataReset(args, resolveResetConfig()));
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
