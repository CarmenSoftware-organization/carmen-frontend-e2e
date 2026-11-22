import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { Locator, Page } from "@playwright/test";
import { test as movementTest, expect, gotoBu, pinBusinessUnit } from "../../fixtures/movement.fixture";
import { apiGet } from "../movement/api";
import { hasDb, sql as rawSql } from "../movement/db";
import { DocState, type DocRef } from "../movement/state";
import { SCENARIO, SCENARIO_SET, SCN } from "./scenarios";

/**
 * Shared context of the period-close phases (`tests/9xx-period-close-*.spec.ts`,
 * project `period-close`, opt-in with E2E_PERIOD_CLOSE=1).
 *
 * Everything is keyed by the scenario in E2E_PERIOD_SCENARIO (see scenarios.ts):
 * the BU, the period under test, the documents to create. Phases run one at a time
 * (`bun run test:period-close -- tests/910-…`), hand documents to each other through
 * state.json, and keep per-sub-case evidence (results.json + screenshots) — a rerun
 * reads it to skip steps that already ran (prevRecord).
 *
 * Origin: `_movement_play/eop_bf/e2e/` (specs/, helpers/, fixtures/).
 */

/** BU of the scenario under test. */
export const BU = SCN.bu;
/** Tenant schema, quoted — CARMEN_FIFO, not CARMEN-FIFO (a wrong name returns zero rows silently). */
export const SCHEMA = `"${SCN.schema}"`;

/**
 * Admin on the scenario's BU by default — period close runs as admin (role accounts
 * have no FIFO permission). Front-end signals are recorded (attached to the report)
 * but do not fail the case: the phases provoke refusals on purpose and assert the
 * backend's answers themselves.
 */
export const test = movementTest.extend({ bu: BU, failOnSignals: false });

/** Navigate and confirm the header shows the intended BU — never post a document into the wrong BU. */
export const gotoInBu = (page: Page, path: string, bu: string = BU) => gotoBu(page, path, bu);

export { expect, pinBusinessUnit };

/**
 * Call from each phase's beforeAll: stops a run that did not name its scenario
 * (the default exists only so `--list` works) — running a stale scenario against a
 * BU that has moved on would create documents in the wrong period.
 */
export function requireScenario(): void {
  if (!SCENARIO_SET) {
    throw new Error("set E2E_PERIOD_SCENARIO (e.g. avg2607) — see tests/helpers/period-close/scenarios.ts");
  }
}

/** Gate for the irreversible steps (Start Period Close, Close Period): E2E_ALLOW_IRREVERSIBLE=<BU>:<period>. */
export const irreversibleAllowed = (period: string): boolean => process.env.E2E_ALLOW_IRREVERSIBLE === `${BU}:${period}`;

/** Skip reason of a step that cannot be undone — the catch-up rounds never set the gate (user decision 2026-11-22). */
export const irreversibleSkip = (what: string): string =>
  `irreversible: ${what} — needs E2E_ALLOW_IRREVERSIBLE=${BU}:<period>, not run in catch-up per user 2026-11-22`;

/**
 * Environment gates of a phase, checked before every case (beforeEach) so a gap is a skip with the reason on the report
 * instead of a failure deep inside a step — E2E_MOVEMENT_STRICT=1 turns the gap into a failure for a CI that must not lose cases.
 *  - db: the phase verifies through SQL (E2E_DB_URL) — the catch-up environment has none.
 *  - dates: the phase fills a document date inside the scenario's period through the UI; the FE caps it at min(period end, today)
 *    (FE 90018c6d), so it needs a period that already contains today.
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
        const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
        const [a, b] = [r.start_date, r.end_date].map((d) => String(d).slice(0, 10));
        if (today < a || today > b) {
          return `period ${SCN.period} (${a}..${b}) does not contain today ${today} — the FE caps document dates at min(period end, today) (FE 90018c6d), so nothing can be dated inside it through the UI`;
        }
      }
      if (needs.counting && r?.physical_count_period?.status !== "counting") {
        return `count round of ${SCN.period} is ${r?.physical_count_period?.status ?? "absent"}, not counting — opening it is the irreversible Start Period Close (E2E_ALLOW_IRREVERSIBLE=${BU}:${SCN.period}, not run in catch-up per user 2026-11-22)`;
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
 * Evidence folder of this scenario: runs/period-close/<scenario> (gitignored), or
 * E2E_EVIDENCE_DIR. Each phase is a separate command writing into the same folder;
 * rerunning overwrites a row instead of appending.
 */
export const EVIDENCE_DIR = process.env.E2E_EVIDENCE_DIR ?? join("runs", "period-close", SCENARIO);
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
