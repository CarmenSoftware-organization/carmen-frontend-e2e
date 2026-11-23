import { describe, it, expect } from "vitest";
import { ACCOUNT_CODES, BANK_ACCOUNT_CODE, JV_PREFIXES, seedAccountingBase } from "../../scripts/data-reset/accounting";
import { loadCoaFixture } from "../../scripts/data-reset/bu-base";
import { createSessions } from "../../scripts/data-reset/sessions";
import { fakeBackend } from "./fake-backend";
import { cfg } from "./docs-fixtures";

const base = `/api/config/${cfg.buCode}`;
const now = new Date("2026-11-05T03:00:00Z");
const idOf = (code: string) => `coa-${code}`;
const coaRows = Object.values(ACCOUNT_CODES).map((code) => ({ id: idOf(code), code }));

function routes(over: Record<string, unknown> = {}) {
  return {
    [`GET ${base}/chart-of-accounts`]: { data: coaRows },
    [`GET ${base}/gl-jv-prefixes`]: { data: [{ id: "px-jv", code: "JV" }] },
    [`POST ${base}/gl-jv-prefixes`]: (b: unknown) => ({ data: { id: `px-${(b as { code: string }).code}` } }),
    [`GET ${base}/app-config/gl_setting`]: { __status: 404 },
    [`PUT ${base}/app-config/gl_setting`]: { data: {} },
    [`GET ${base}/gl-periods`]: { data: [] },
    [`POST ${base}/gl-periods/years`]: { data: { created: 13 } },
    [`GET ${base}/currencies`]: { data: [{ id: "c-thb", code: "THB" }] },
    [`GET ${base}/bank-accounts`]: { data: [] },
    [`POST ${base}/bank-accounts`]: { data: {} },
    [`GET ${base}/tax-profiles`]: {
      data: [
        { id: "t-none", name: "None", tax_type: "vat", tax_rate: 0, chart_of_accounts_id: null, doc_version: 0 },
        { id: "t-vat", name: "Vat 7%", tax_type: "vat", tax_rate: 7, chart_of_accounts_id: null, doc_version: 2 },
      ],
    },
    [`PATCH ${base}/tax-profiles/t-vat`]: { data: {} },
    [`POST ${base}/tax-profiles`]: { data: {} },
    [`GET ${base}/vendors`]: { data: [{ id: "v1", code: "A001" }, { id: "v2", code: "A002" }] },
    [`GET ${base}/vendors/v1`]: { data: { doc_version: 3, ap_chart_of_accounts_id: null } },
    [`GET ${base}/vendors/v2`]: { data: { doc_version: 1, ap_chart_of_accounts_id: null } },
    [`PUT ${base}/vendors/v1`]: { data: {} },
    [`PUT ${base}/vendors/v2`]: { data: {} },
    ...over,
  };
}

async function run(over: Record<string, unknown> = {}) {
  const backend = fakeBackend(routes(over));
  const result = await seedAccountingBase(createSessions(cfg, backend.fetchFn), cfg, now);
  return { backend, result, writes: backend.writes() };
}
const bodyOf = (writes: { method: string; path: string; body: unknown }[], method: string, path: string) =>
  writes.find((w) => w.method === method && w.path === path)?.body as Record<string, unknown>;

describe("seedAccountingBase", () => {
  it("fixture has every account code the posting setup needs", () => {
    const codes = new Set(loadCoaFixture().map((a) => a.code));
    for (const code of Object.values(ACCOUNT_CODES)) expect(codes.has(code)).toBe(true);
  });

  it("seeds gl_setting with every account id", async () => {
    const { writes, result } = await run();
    expect(result.failed).toEqual([]);
    const body = bodyOf(writes, "PUT", `${base}/app-config/gl_setting`) as { value: Record<string, unknown> };
    expect(body.value).toMatchObject({
      fiscal_year_start_month: 1,
      ap_control_account_id: idOf("2100"),
      input_vat_account_id: idOf("1170"),
      wht_payable_account_id: idOf("2150"),
      advance_deposit_account_id: idOf("1180"),
      realized_fx_gain_account_id: idOf("4300"),
      realized_fx_loss_account_id: idOf("5400"),
      ap_auto_from_grn: false,
      ap_jv_prefix_id: `px-${JV_PREFIXES.ap.code}`,
      auto_jv_prefix_id: `px-${JV_PREFIXES.ap.code}`,
      reversal_prefix_id: `px-${JV_PREFIXES.reversal.code}`,
    });
    expect(result.accounts.bank).toBe(idOf("1110"));
  });

  it("creates the AP and reversal JV prefixes, and reuses ones that exist", async () => {
    const { writes } = await run();
    const posts = writes.filter((w) => w.method === "POST" && w.path === `${base}/gl-jv-prefixes`).map((w) => (w.body as { code: string }).code);
    expect(posts).toEqual([JV_PREFIXES.ap.code, JV_PREFIXES.reversal.code]);
    const again = await run({
      [`GET ${base}/gl-jv-prefixes`]: { data: [{ id: "x1", code: "APJV" }, { id: "x2", code: "APRV" }] },
    });
    expect(again.writes.some((w) => w.path.includes("/gl-jv-prefixes"))).toBe(false);
    const value = (bodyOf(again.writes, "PUT", `${base}/app-config/gl_setting`) as { value: Record<string, unknown> }).value;
    expect(value).toMatchObject({ ap_jv_prefix_id: "x1", auto_jv_prefix_id: "x1", reversal_prefix_id: "x2" });
  });

  it("writes nothing when the prefix list cannot be read", async () => {
    const { writes, result } = await run({ [`GET ${base}/gl-jv-prefixes`]: { __status: 500 } });
    expect(result.failed.length).toBeGreaterThan(0);
    expect(writes.some((w) => w.path.endsWith("/gl_setting"))).toBe(false);
  });

  it("keeps other gl_setting keys and skips the write when already current", async () => {
    const current = {
      fiscal_year_start_month: 4, allow_post_to_closed_period: true,
      ap_control_account_id: idOf("2100"), input_vat_account_id: idOf("1170"), wht_payable_account_id: idOf("2150"),
      advance_deposit_account_id: idOf("1180"), realized_fx_gain_account_id: idOf("4300"), realized_fx_loss_account_id: idOf("5400"),
      ap_auto_from_grn: false,
      ap_jv_prefix_id: "px-APJV", auto_jv_prefix_id: "px-APJV", reversal_prefix_id: "px-APRV",
    };
    const same = await run({ [`GET ${base}/app-config/gl_setting`]: { data: { value: current } } });
    expect(same.writes.some((w) => w.path.endsWith("/gl_setting"))).toBe(false);
    const stale = await run({ [`GET ${base}/app-config/gl_setting`]: { data: { value: { ...current, ap_auto_from_grn: true } } } });
    const value = (bodyOf(stale.writes, "PUT", `${base}/app-config/gl_setting`) as { value: Record<string, unknown> }).value;
    expect(value).toMatchObject({ fiscal_year_start_month: 4, allow_post_to_closed_period: true, ap_auto_from_grn: false });
  });

  it("does not overwrite gl_setting when reading it fails", async () => {
    const { writes, result } = await run({ [`GET ${base}/app-config/gl_setting`]: { __status: 500 } });
    expect(result.failed.length).toBeGreaterThan(0);
    expect(writes.some((w) => w.path.endsWith("/gl_setting"))).toBe(false);
  });

  it("creates an open GL period covering today unless one exists", async () => {
    const created = await run();
    expect(bodyOf(created.writes, "POST", `${base}/gl-periods/years`)).toEqual({ fiscal_year: 2026 });
    const covered = await run({
      [`GET ${base}/gl-periods`]: { data: [{ status: "open", start_at: "2026-10-31T17:00:00.000Z", end_at: "2026-11-30T16:59:59.999Z" }] },
    });
    expect(covered.writes.some((w) => w.path.includes("/gl-periods"))).toBe(false);
    const closed = await run({
      [`GET ${base}/gl-periods`]: { data: [{ status: "closed", start_at: "2026-11-01T00:00:00.000Z", end_at: "2026-11-30T23:59:59.999Z" }] },
    });
    expect(closed.writes.some((w) => w.path === `${base}/gl-periods/years`)).toBe(true);
  });

  it("creates a bank account mapped to the bank COA", async () => {
    const { writes } = await run();
    expect(bodyOf(writes, "POST", `${base}/bank-accounts`)).toMatchObject({
      code: BANK_ACCOUNT_CODE, currency_id: "c-thb", chart_of_accounts_id: idOf("1110"),
    });
    const again = await run({
      [`GET ${base}/bank-accounts`]: { data: [{ id: "b1", code: BANK_ACCOUNT_CODE, chart_of_accounts_id: idOf("1110"), is_active: true }] },
    });
    expect(again.writes.some((w) => w.path.includes("/bank-accounts"))).toBe(false);
  });

  it("creates WHT 3% and VAT 7% tax profiles mapped to accounts", async () => {
    const { writes } = await run();
    expect(bodyOf(writes, "PATCH", `${base}/tax-profiles/t-vat`)).toEqual({
      doc_version: 2, chart_of_accounts_id: idOf("1170"), is_active: true,
    });
    expect(bodyOf(writes, "POST", `${base}/tax-profiles`)).toMatchObject({
      name: "WHT 3%", tax_type: "wht", tax_rate: 3, chart_of_accounts_id: idOf("2150"), wht_pnd_form: "pnd_53",
    });
    const again = await run({
      [`GET ${base}/tax-profiles`]: {
        data: [
          { id: "t-vat", name: "Vat 7%", chart_of_accounts_id: idOf("1170"), doc_version: 3 },
          { id: "t-wht", name: "WHT 3%", chart_of_accounts_id: idOf("2150"), doc_version: 0 },
        ],
      },
    });
    expect(again.writes.some((w) => w.path.includes("/tax-profiles"))).toBe(false);
  });

  it("sets ap_chart_of_accounts_id on every seeded vendor", async () => {
    const { writes } = await run();
    expect(bodyOf(writes, "PUT", `${base}/vendors/v1`)).toEqual({ doc_version: 3, ap_chart_of_accounts_id: idOf("2100") });
    expect(bodyOf(writes, "PUT", `${base}/vendors/v2`)).toEqual({ doc_version: 1, ap_chart_of_accounts_id: idOf("2100") });
    const again = await run({
      [`GET ${base}/vendors/v1`]: { data: { doc_version: 4, ap_chart_of_accounts_id: idOf("2100") } },
      [`GET ${base}/vendors/v2`]: { data: { doc_version: 2, ap_chart_of_accounts_id: idOf("2100") } },
    });
    expect(again.writes.some((w) => w.path.includes("/vendors"))).toBe(false);
  });

  it("dry run writes nothing (the plan is only logged by runDataReset; see run.test.ts)", async () => {
    // seedAccountingBase has no dry-run mode: runDataReset never calls it with --dry-run.
    const backend = fakeBackend(routes());
    const { runDataReset } = await import("../../scripts/data-reset/index");
    const code = await runDataReset(
      { dryRun: true, yes: false, skipReset: false, verbose: false, help: false, bu: "BU-GR2VYNKQ" }, cfg,
      { fetchFn: backend.fetchFn, now, log: () => {}, seedMaster: async () => [], seedDocuments: async () => [] },
    );
    expect(code).toBeLessThanOrEqual(1);
    expect(backend.writes()).toEqual([]);
  });

  it("reports a missing COA account instead of writing", async () => {
    const { writes, result } = await run({ [`GET ${base}/chart-of-accounts`]: { data: coaRows.slice(1) } });
    expect(result.failed.join()).toContain("lacks");
    expect(writes).toEqual([]);
  });

  it("is idempotent: a second pass over a fully set-up BU writes nothing", async () => {
    const full = { [`GET ${base}/app-config/gl_setting`]: { data: { value: {
      fiscal_year_start_month: 1, ap_control_account_id: idOf("2100"), input_vat_account_id: idOf("1170"), wht_payable_account_id: idOf("2150"),
      advance_deposit_account_id: idOf("1180"), realized_fx_gain_account_id: idOf("4300"), realized_fx_loss_account_id: idOf("5400"), ap_auto_from_grn: false,
      ap_jv_prefix_id: "x1", auto_jv_prefix_id: "x1", reversal_prefix_id: "x2",
    } } },
    [`GET ${base}/gl-jv-prefixes`]: { data: [{ id: "x1", code: "APJV" }, { id: "x2", code: "APRV" }] },
    [`GET ${base}/gl-periods`]: { data: [{ status: "open", start_at: "2026-01-01T00:00:00.000Z", end_at: "2026-12-31T23:59:59.999Z" }] },
    [`GET ${base}/bank-accounts`]: { data: [{ id: "b1", code: BANK_ACCOUNT_CODE, chart_of_accounts_id: idOf("1110") }] },
    [`GET ${base}/tax-profiles`]: { data: [
      { id: "t-vat", name: "Vat 7%", chart_of_accounts_id: idOf("1170") }, { id: "t-wht", name: "WHT 3%", chart_of_accounts_id: idOf("2150") },
    ] },
    [`GET ${base}/vendors/v1`]: { data: { doc_version: 4, ap_chart_of_accounts_id: idOf("2100") } },
    [`GET ${base}/vendors/v2`]: { data: { doc_version: 2, ap_chart_of_accounts_id: idOf("2100") } } };
    const { writes, result } = await run(full);
    expect(writes).toEqual([]);
    expect(result).toMatchObject({ created: 0, failed: [] });
    expect(result.skipped).toBe(9);
  });
});
