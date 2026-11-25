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
import { BU_CODE, TEST_BUS, getPasswordFor } from "../../tests/test-users";
import { parseResetArgs, resetHelpText, type ResetArgs } from "./cli";
import { resolveResetConfig, type ResetConfig } from "./config";
import { DEFAULT_CURRENCY_CODE, loadCoaFixture, seedBuCurrency, seedChartOfAccounts } from "./bu-base";
import { seedAccountingBase } from "./accounting";
import { seedMappings } from "./mappings";
import { countRolesToCopy } from "./roles";
import { seedAccess, seedAccountingRoles } from "./access";
import { seedPeriod, planPeriod, planNextPeriod, planHistoryPeriod } from "./period";
import { callReset } from "./reset";
import { createSessions } from "./sessions";
import type { StepResult } from "./step-result";
import { verifyEnvironment } from "./verify-env";
import { loadWorkflowFixture, validateFixture } from "./workflow-template";
import { seedWorkflows } from "./workflows";
import { seedAllDocuments } from "./docs/seed-all";
import { seedCostFrom, seedPeriodClose } from "./docs/period-close";
import { verifyHistoryDataset } from "./verify-dataset";
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
  log(`step 0: 9 accounts in ${cfg.buCode}, default ${BU_CODE}, cost method ${TEST_BUS.find((b) => b.code === cfg.buCode)?.method}${env.notes.length === 0 ? ", purchase permissions present" : ""}`);
  env.notes.forEach((n) => log(`  note: ${n}`));
  const admin = await sessions.client(cfg.adminEmail);

  if (args.dryRun) {
    log(`reset: would POST /api-system/tenant/resets/${env.buId}${args.skipReset ? " (skipped: --skip-reset)" : ""}`);
    const master = masterStep(await seedMaster(admin, true, cfg));
    log(`master: would create ${master.created}, ${master.skipped} already present`);
    log(`bu-currency: would PATCH /api/business-units default_currency_id to the ${DEFAULT_CURRENCY_CODE} row`);
    log(`coa: would POST ${loadCoaFixture().length} accounts unless their codes exist`);
    log("accounting: would PUT gl_setting (AP / AR control / input + output VAT / WHT / deposit / FX accounts, ap_auto_from_grn off), POST a GL fiscal year unless an open period covers today, POST bank account E2E-BANK, map the Vat 7% profile and POST WHT 3%, and PUT the AP control account on every vendor — each skipped when already set");
    log("mappings: would PATCH 2 departments (all 9 accounts + hod as HOD; owner in the second) and PUT 9 location sets");
    const toCopy = await countRolesToCopy(sessions, cfg);
    if (cfg.buCode !== BU_CODE) log(`copy-roles: would copy ${toCopy} roles from ${BU_CODE} (name + granted permissions, mapped by resource.action) before assigning them`);
    log("access: would POST each account's missing role (requestor, hod, purchase, fc/gm/owner/storemanager → Approval, budget → Accounting) and set THB as the BU's default currency if none is set");
    log("accounting-roles: would create \"Accounting Approver\" (budget: AP + AR void, JV void / post / reverse) and \"Accounting Viewer\" (requestor: view only, incl. AP / AR view) from the BU's permission catalog, unless they exist");
    log(`workflows: would POST ${fixture.workflows.map((w) => w.name).join(", ")}`);
    if (!args.withHistory) {
      log(`period: would POST ${JSON.stringify(planPeriod(now))} unless an open period covers today, then ensure ${JSON.stringify(planNextPeriod(now))} exists via POST /next`);
    }
    if (args.withHistory) log(`period: --with-history would instead POST ${JSON.stringify(planHistoryPeriod(now))} first, then generate until today + next month are covered`);
    if (args.withHistory) {
      log("period-close: --with-history would create E2E-PC-1..4 and E2E-PC-X (copied from a master product, linked to the first inventory location only, no stock), clear runs/period-close/" + cfg.buCode + "/, then verify them and the periods");
      log("documents: SKIPPED with --with-history (no stock-ins, doc-flow products, PRs, POs, GRNs, CNs, SRs, price lists, campaigns or accounting documents) — run a normal reset after the period-close run");
      return 0;
    }
    log("documents: would create 5 stock-ins, 4 doc-flow products, 1 PR template, 41 PRs, 7 POs, 4 GRNs, 2 CNs, 7 SRs, 3 price lists, 3 campaigns, the accounting read set (8 AP documents incl. payments, 1 JV, 1 JV template), then verify the counts");
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
  results.push(await seedBuCurrency(sessions, cfg));
  results.push(await seedChartOfAccounts(sessions, cfg));
  if (results.slice(-2).every((r) => r.failed.length === 0)) results.push(await seedAccountingBase(sessions, cfg, now));
  if (results.slice(-3).some((r) => r.failed.length > 0)) {
    // Mappings, workflows and documents on a BU without a currency / COA / posting setup only make a second mess.
    log(summaryTable(results));
    log("✗ BU base (default currency / chart of accounts / accounting setup) failed — stopping before mappings and workflows");
    return 1;
  }
  const mappings = await seedMappings(sessions, cfg, env.userIds);
  results.push(mappings);
  if (mappings.firstDepartment) {
    results.push(await seedAccess(sessions, cfg, env.userIds));
    results.push(await seedAccountingRoles(sessions, cfg, env.userIds));
  }
  if (mappings.firstDepartment) {
    results.push(await seedWorkflows(sessions, cfg, fixture, env.users, mappings.firstDepartment));
    results.push(await seedPeriod(sessions, cfg, now, { withHistory: args.withHistory }));
  }
  if (args.withHistory && results.every((r) => r.failed.length === 0) && mappings.firstDepartment) {
    // No documents of the normal dataset: they could not be dated last month, and open ones would block Start / Close.
    results.push(await seedPeriodClose(sessions, cfg));
    results.push(await seedCostFrom(sessions, cfg));
    const verified = await verifyHistoryDataset(sessions, cfg, now);
    log(verified.table);
    results.push({ step: "verify", created: 0, skipped: 0, failed: verified.short });
  } else if (!args.withHistory && results.every((r) => r.failed.length === 0) && mappings.firstDepartment) {
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
  const targets = args.bu === "all" ? TEST_BUS.map((b) => b.code) : [args.bu];
  for (const [i, code] of targets.entries()) {
    if (targets.length > 1) console.log(`\n=== BU ${i + 1}/${targets.length} ===`);
    const exit = await runDataReset(args, resolveResetConfig(process.env, code));
    if (exit !== 0) process.exit(exit);
  }
  process.exit(0);
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
