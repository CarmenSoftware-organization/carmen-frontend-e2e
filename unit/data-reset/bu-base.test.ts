import { describe, it, expect } from "vitest";
import { loadCoaFixture, seedBuCurrency, seedChartOfAccounts } from "../../scripts/data-reset/bu-base";
import { createSessions } from "../../scripts/data-reset/sessions";
import { fakeBackend } from "./fake-backend";
import { cfg } from "./docs-fixtures";

const base = `/api/config/${cfg.buCode}`;
const sessionsOf = (b: ReturnType<typeof fakeBackend>) => createSessions(cfg, b.fetchFn);

describe("seedBuCurrency", () => {
  it("repoints a stale default currency at the new THB row", async () => {
    const backend = fakeBackend({
      [`GET ${base}/currencies`]: { data: [{ id: "c-thb", code: "THB" }] },
      "GET /api/business-units": { data: { id: "bu-1", doc_version: 4, default_currency_id: "c-old" } },
      "PATCH /api/business-units": { data: {} },
    });
    const r = await seedBuCurrency(sessionsOf(backend), cfg);
    expect(r).toEqual({ step: "bu-currency", created: 1, skipped: 0, failed: [] });
    expect(backend.writes()).toEqual([
      { method: "PATCH", path: "/api/business-units", body: { id: "bu-1", doc_version: 4, default_currency_id: "c-thb" } },
    ]);
  });

  it("does nothing when the BU already points at THB", async () => {
    const backend = fakeBackend({
      [`GET ${base}/currencies`]: { data: [{ id: "c-thb", code: "THB" }] },
      "GET /api/business-units": { data: { id: "bu-1", doc_version: 4, default_currency_id: "c-thb" } },
    });
    const r = await seedBuCurrency(sessionsOf(backend), cfg);
    expect(r.skipped).toBe(1);
    expect(backend.writes()).toEqual([]);
  });

  it("fails when there is no THB currency to point at", async () => {
    const backend = fakeBackend({ [`GET ${base}/currencies`]: { data: [] } });
    const r = await seedBuCurrency(sessionsOf(backend), cfg);
    expect(r.failed).toHaveLength(1);
  });
});

describe("seedChartOfAccounts", () => {
  it("creates the fixture accounts that are missing and skips present codes", async () => {
    const [first, ...rest] = loadCoaFixture();
    const backend = fakeBackend({
      [`GET ${base}/chart-of-accounts`]: { data: [{ code: first.code }] },
      [`POST ${base}/chart-of-accounts`]: { data: { id: "a" } },
    });
    const r = await seedChartOfAccounts(sessionsOf(backend), cfg);
    expect(r).toEqual({ step: "coa", created: rest.length, skipped: 1, failed: [] });
  });

  it("reports a rejected account", async () => {
    const backend = fakeBackend({
      [`GET ${base}/chart-of-accounts`]: { data: [] },
      [`POST ${base}/chart-of-accounts`]: { __status: 400, message: "bad" },
    });
    const r = await seedChartOfAccounts(sessionsOf(backend), cfg);
    expect(r.failed).toHaveLength(loadCoaFixture().length);
  });
});
