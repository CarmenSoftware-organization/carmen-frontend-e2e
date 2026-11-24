import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { Locator, Page } from "@playwright/test";
import { test as movementTest, expect, gotoBu, pinBusinessUnit } from "../../fixtures/movement.fixture";
import { authFile } from "../../fixtures/auth.paths";
import { TEST_USERS, TEST_BUS, type TestBuCode } from "../../test-users";
import { buConfigSend, buSend, rawSend, type Role } from "../bu-api";
import { hasDb, sql as rawSql } from "../movement/db";
import { DocState, type DocRef } from "../movement/state";
import { SCENARIO_SET, SCN, bangkokToday, scenarioTooEarly } from "./scenarios";

/**
 * Shared context of the period-close phases (`tests/9xx-period-close-*.spec.ts`,
 * project `period-close`, opt-in with E2E_PERIOD_CLOSE=1).
 *
 * Everything is derived from E2E_PERIOD_BU (one of the TEST BUs) and today's date (see
 * scenarios.ts): the BU, the period under test, the documents to create. Phases run one at a time
 * (`bun run test:period-close -- tests/910-…`), hand documents to each other through
 * state.json, and keep per-sub-case evidence (results.json + screenshots) — a rerun
 * reads it to skip steps that already ran (prevRecord).
 *
 * Origin: `_movement_play/eop_bf/e2e/` (specs/, helpers/, fixtures/).
 */

/** BU of the scenario under test. */
export const BU = SCN.bu;
/**
 * Tenant schema, quoted — opaque (e.g. bu_tcczafackj4us7i6), looked up by requireScenario() from
 * CARMEN_SYSTEM.tb_business_unit. Interpolate it in a template string (`${SCHEMA}.tb_x`): it is read
 * at that moment, so it reflects the value resolved at runtime. Before requireScenario() it is "".
 */
export const SCHEMA = { toString: (): string => (SCN.schema ? `"${SCN.schema}"` : "") };

/** Period-close accounts: the gmail TEST_USERS (same ones the `setup` project signs in), by short key. */
const PC_ROLES = { admin: "Admin", requestor: "Requestor", hod: "HOD", fc: "FC" } as const satisfies Record<string, Role>;
export type PcUser = keyof typeof PC_ROLES;
export const PC_USERS = Object.fromEntries(
  (Object.keys(PC_ROLES) as PcUser[]).map((k) => {
    const u = TEST_USERS.find((x) => x.role === PC_ROLES[k])!;
    return [k, { email: u.email as string, password: u.password as string }];
  }),
) as Record<PcUser, { email: string; password: string }>;
const pcRole = (user: string): Role => {
  const r = PC_ROLES[user as PcUser];
  if (!r) throw new Error(`period-close: no account for "${user}" (have ${Object.keys(PC_ROLES).join(", ")})`);
  return r;
};

/** Direct backend call as a period-close account (admin by default); `path` is the full gateway path from `/api`. */
export async function apiSend<T = any>(method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE", path: string, body?: unknown, user: PcUser = "admin") {
  const r = await rawSend<T>(pcRole(user), method, path, body);
  return { ...r, appCode: ((r.body as any)?.error?.code ?? "") as string };
}
export const apiGet = <T = any>(path: string, user: PcUser = "admin") => apiSend<T>("GET", path, undefined, user);

/**
 * Admin on the scenario's BU by default — period close runs as admin. Front-end signals are recorded (attached to the report)
 * but do not fail the case: the phases provoke refusals on purpose and assert the
 * backend's answers themselves.
 */
export const test = movementTest.extend({
  bu: BU,
  failOnSignals: false,
  // gmail accounts signed in by the normal `setup` project (the base fixture points at the legacy movement accounts)
  storageState: async ({ user }, use) => use(authFile(PC_USERS[user as PcUser]?.email ?? pcRole(user))),
});

/** Navigate and confirm the header shows the intended BU — never post a document into the wrong BU. */
export const gotoInBu = (page: Page, path: string, bu: string = BU) => gotoBu(page, path, bu);

export { expect, pinBusinessUnit };

/**
 * Call from each phase's beforeAll (return its promise): stops a run that cannot be trusted —
 * no/unknown E2E_PERIOD_BU, today too early for the scenario, or a BU whose cost method is not
 * the TEST BU's. Then fills the runtime parts of SCN in place (SCN.location is aliased by `L`,
 * so it is mutated, never reassigned): tenant schema, first inventory location, CN reason.
 * Location is also written to runs/period-close/<BU>/location.json for later workers.
 */
export async function requireScenario(): Promise<void> {
  if (!SCENARIO_SET) {
    throw new Error(`set E2E_PERIOD_BU to one of ${TEST_BUS.map((b) => b.code).join(", ")} — see tests/helpers/period-close/scenarios.ts`);
  }
  if (!TEST_BUS.some((b) => b.code === process.env.E2E_PERIOD_BU)) {
    throw new Error(`E2E_PERIOD_BU=${process.env.E2E_PERIOD_BU} is not a TEST BU (${TEST_BUS.map((b) => b.code).join(", ")})`);
  }
  const early = scenarioTooEarly(bangkokToday());
  if (early) throw new Error(early);

  const want = TEST_BUS.find((b) => b.code === BU)!.method;
  const got = (await buSend("Admin", "GET", "/inventory-transactions/calculation-method", undefined, BU)).body?.data?.calculation_method;
  if (got !== want) throw new Error(`${BU}: calculation-method is ${JSON.stringify(got)}, expected ${want} (TEST_BUS)`);

  // Tenant schema is opaque — read it from the system schema.
  if (!hasDb()) {
    if (process.env.E2E_MOVEMENT_STRICT === "1") throw new Error("period-close needs E2E_DB_URL (read-only SQL) — set it in .env.local");
  } else if (!SCN.schema) {
    const rows = rawSql<{ db_schema: string }>(`select db_schema from "CARMEN_SYSTEM".tb_business_unit where code = '${BU}'`);
    const schema = rows[0]?.db_schema;
    if (!schema || !/^[a-z0-9_]+$/i.test(schema)) throw new Error(`${BU}: tenant schema not found in CARMEN_SYSTEM.tb_business_unit (got ${JSON.stringify(schema)})`);
    SCN.schema = schema;
  }

  // First active inventory location by code — the one data:reset seeds the E2E-PC products into.
  if (SCN.location.code === "?") {
    const r = await buConfigSend("Admin", "GET", "/locations?perpage=100", undefined, BU);
    if (r.status !== 200) throw new Error(`${BU}: locations HTTP ${r.status}`);
    const first = ((r.body?.data ?? []) as any[])
      .filter((l) => (l.location_type ?? "inventory") === "inventory" && l.is_active !== false)
      .sort((x, y) => String(x.code).localeCompare(String(y.code)))[0];
    if (!first) throw new Error(`${BU}: no active inventory location`);
    SCN.location.code = String(first.code);
    SCN.location.name = String(first.name ?? first.code);
    const dir = join("runs", "period-close", BU);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "location.json"), JSON.stringify(SCN.location, null, 2));
  }

  if (!SCN.cnReason) {
    const r = await buConfigSend("Admin", "GET", "/credit-note-reasons?perpage=100", undefined, BU);
    if (r.status !== 200) throw new Error(`${BU}: credit-note-reasons HTTP ${r.status}`);
    const row = ((r.body?.data ?? []) as any[]).find((x) => x.is_active !== false);
    if (!row) throw new Error(`${BU}: no active credit-note reason`);
    SCN.cnReason = String(row.name);
  }
}

/**
 * Gate for the irreversible steps (Start Period Close, count submit, Close Period): they run only on a
 * TEST BU whose active period is the scenario's — `data:reset --bu <BU> --with-history` puts it there.
 * `period` is the one the step expects to still be active.
 */
export async function irreversibleAllowed(period: string): Promise<boolean> {
  return TEST_BUS.some((b) => b.code === (BU as TestBuCode)) && (await currentPeriod(BU)) === period;
}

/** Skip reason of a step that cannot be undone. */
export const irreversibleSkip = (what: string): string =>
  `irreversible: ${what} — BU active period is not ${SCN.period}; run data:reset --bu ${BU} --with-history first`;

/**
 * Environment gates of a phase, checked before every case (beforeEach) so a gap is a skip with the reason on the report
 * instead of a failure deep inside a step — E2E_MOVEMENT_STRICT=1 turns the gap into a failure for a CI that must not lose cases.
 *  - db: the phase verifies through SQL (E2E_DB_URL).
 *  - dates: the phase fills a document date inside the scenario's period through the UI; the FE caps it at min(period end, today)
 *    (FE 90018c6d), so it skips only when today is before the period's start.
 *  - counting: the phase works on an open count round, which only the irreversible Start Period Close opens.
 * `only` narrows the gate to cases whose title matches.
 */
export function gatePhase(needs: { db?: boolean; dates?: boolean; counting?: boolean }, only?: RegExp): void {
  let cache: Promise<string | null> | null = null;
  const reason = (): Promise<string | null> =>
    (cache ??= (async () => {
      if (needs.db && !hasDb()) return "needs E2E_DB_URL (read-only SQL against the tenant DB) — not set in this environment, so this phase is not verified here";
      const r = needs.dates || needs.counting ? await review(BU) : null;
      if (needs.dates && r) {
        const today = bangkokToday();
        const a = String(r.start_date).slice(0, 10);
        if (today < a) {
          return `today ${today} is before the start of period ${SCN.period} (${a}) — the FE caps document dates at min(period end, today) (FE 90018c6d), so nothing can be dated inside it through the UI`;
        }
      }
      if (needs.counting && r?.physical_count_period?.status !== "counting") {
        return `count round of ${SCN.period} is ${r?.physical_count_period?.status ?? "absent"}, not counting — opening it is the irreversible Start Period Close (phase 918)`;
      }
      return null;
    })());
  test.beforeEach(async () => {
    if (only && !only.test(test.info().title)) return;
    const why = await reason();
    if (why && process.env.E2E_MOVEMENT_STRICT === "1") throw new Error(`precondition not met: ${why}`);
    test.skip(why !== null, why ?? "");
  });
}

// ── SQL / API ────────────────────────────────────────────────────────────────────

export const sql = <T = Record<string, string>>(query: string): T[] => rawSql<T>(query);

/** Balance and cost per lot of a product at a location (from the cost layer). */
export function layers(locationCode: string, productCode: string) {
  return sql(`
    select cl.at_period, cl.lot_no, cl.in_qty, cl.out_qty, cl.cost_per_unit, cl.transaction_type
    from ${SCHEMA}.tb_inventory_transaction_cost_layer cl
    join ${SCHEMA}.tb_location l on l.id = cl.location_id
    join ${SCHEMA}.tb_product p on p.id = cl.product_id
    where cl.deleted_at is null and l.code = '${locationCode}' and p.code = '${productCode}'
    order by cl.created_at`);
}

export async function review(bu: string = BU) {
  const { status, body } = await apiGet(`/api/${bu}/period-ends/review`);
  if (status !== 200) throw new Error(`review ${status}`);
  return body.data as {
    status: string;
    start_date: string;
    end_date: string;
    physical_count_period: { id: string; status: string } | null;
    can_start_counting: boolean;
    start_blocking: { counts: Record<string, number>; total: number };
    can_close: boolean;
    close_blocking: Record<string, number>;
    details: { physical_count: any[]; transaction: Record<string, any> };
  };
}

export async function currentPeriod(bu: string = BU): Promise<string> {
  const { body } = await apiGet(`/api/${bu}/period-ends/current`);
  return body.data.period;
}

export async function userLocations(bu: string = BU): Promise<string[]> {
  const { body } = await apiGet(`/api/${bu}/user-locations?perpage=100`);
  return (body.data ?? []).map((l: any) => l.code);
}

export async function buConfig(bu: string, key: string): Promise<unknown> {
  const { body } = await apiGet(`/api/user/profile`);
  const unit = body.data.business_unit.find((b: any) => b.code === bu);
  return (unit?.bu_config ?? []).find((c: any) => c.key === key)?.value;
}

// ── Evidence (per sub-case) ──────────────────────────────────────────────────────

/**
 * Evidence folder of this scenario: runs/period-close/<BU>/<period> (gitignored), or
 * E2E_EVIDENCE_DIR. Each phase is a separate command writing into the same folder;
 * rerunning overwrites a row instead of appending.
 */
export const EVIDENCE_DIR = process.env.E2E_EVIDENCE_DIR ?? join("runs", "period-close", BU, SCN.period);
const RESULTS = join(EVIDENCE_DIR, "results.json");

/** FIXED = was a bug (FAIL), fixed and retested — the row stays as history. */
export type Status = "PASS" | "FAIL" | "FIXED" | "N/A" | "INFO";

export interface CaseRow {
  /** sub-case id from the original period-close plan, e.g. "1.2" — keep stable, reruns look rows up by it */
  id: string;
  /** e.g. "Case 1 · ด่าน Start" */
  case: string;
  title: string;
  steps: string[];
  expected: string;
  actual: string;
  status: Status;
  /** related document numbers */
  docs?: string[];
  images?: string[];
  at?: string;
}

function loadRows(): Record<string, CaseRow> {
  if (!existsSync(RESULTS)) return {};
  return JSON.parse(readFileSync(RESULTS, "utf8"));
}

/** The recorded row of a sub-case — used when a rerun skips a step that already ran, to keep the real result. */
export function prevRecord(id: string): CaseRow | undefined {
  return loadRows()[id];
}

/** Upsert a sub-case row — screenshots of earlier runs stay unless replaced. */
export function record(row: CaseRow): void {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  const all = loadRows();
  const prev = all[row.id];
  all[row.id] = {
    ...prev,
    ...row,
    // keep earlier runs' images: a rerun that skips a done step must not lose the evidence of when it ran
    images: [...new Set([...(prev?.images ?? []), ...(row.images ?? [])])],
    at: new Date().toISOString(),
  };
  writeFileSync(RESULTS, JSON.stringify(all, null, 2));
}

/** Screenshot named `<id>_<label>.png`; returns the path for record(). */
export async function shot(
  page: Page,
  id: string,
  label: string,
  opts: { target?: Locator; fullPage?: boolean } = {},
): Promise<string> {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  const slug = label.replace(/[^a-zA-Z0-9ก-๙]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  const file = join(EVIDENCE_DIR, `${id}_${slug}.png`);
  await page.waitForTimeout(400); // let animations / toasts settle
  if (opts.target) await opts.target.screenshot({ path: file });
  else await page.screenshot({ path: file, fullPage: opts.fullPage ?? true });
  return file;
}

// ── Documents handed between phases ──────────────────────────────────────────────

const state = new DocState(join(EVIDENCE_DIR, "state.json"));
export type { DocRef };
export const getDoc = (key: string): DocRef | undefined => state.get(key);
export const putDoc = (key: string, doc: DocRef): void => state.put(key, doc);
