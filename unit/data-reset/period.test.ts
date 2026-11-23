import { describe, it, expect } from "vitest";
import { planNextPeriod, planPeriod, seedPeriod } from "../../scripts/data-reset/period";
import { createSessions } from "../../scripts/data-reset/sessions";
import type { ResetConfig } from "../../scripts/data-reset/config";
import { fakeBackend } from "./fake-backend";

const cfg: ResetConfig = {
  backendUrl: "http://h", xAppId: "app", buCode: "BU-GR2VYNKQ", deployToken: "t",
  adminEmail: "carmensoftware.dev+admin@gmail.com",
};
const current = "/api/BU-GR2VYNKQ/inventory-periods/current";
const create = "/api/BU-GR2VYNKQ/inventory-periods";

describe("planPeriod", () => {
  it("uses the Bangkok calendar month", () => {
    expect(planPeriod(new Date("2026-11-30T20:00:00Z"))).toEqual({ fiscal_year: 2026, fiscal_month: 12, start_at: "2026-12-01" });
    expect(planPeriod(new Date("2026-11-05T00:00:00Z"))).toEqual({ fiscal_year: 2026, fiscal_month: 11, start_at: "2026-11-01" });
  });

  it("rolls the year at new year in Bangkok", () => {
    expect(planPeriod(new Date("2026-12-31T18:00:00Z"))).toEqual({ fiscal_year: 2027, fiscal_month: 1, start_at: "2027-01-01" });
  });
});

describe("planNextPeriod", () => {
  it("is the month after the Bangkok calendar month", () => {
    expect(planNextPeriod(new Date("2026-11-05T03:00:00Z"))).toEqual({ fiscal_year: 2026, fiscal_month: 12 });
    expect(planNextPeriod(new Date("2026-11-30T20:00:00Z"))).toEqual({ fiscal_year: 2027, fiscal_month: 1 });
  });

  it("rolls December into January of next year", () => {
    expect(planNextPeriod(new Date("2026-12-15T03:00:00Z"))).toEqual({ fiscal_year: 2027, fiscal_month: 1 });
    expect(planNextPeriod(new Date("2026-12-31T18:00:00Z"))).toEqual({ fiscal_year: 2027, fiscal_month: 2 });
  });
});

describe("seedPeriod", () => {
  const now = new Date("2026-11-05T03:00:00Z");

  const covering = { data: { status: "open", start_at: "2026-11-01T00:00:00.000Z", end_at: "2026-11-30T23:59:59.999Z" } };
  const nov = { fiscal_year: 2026, fiscal_month: 11, status: "open" };
  const dec = { fiscal_year: 2026, fiscal_month: 12, status: "open" };

  it("skips both when this month and next month already exist (idempotent, no writes)", async () => {
    const backend = fakeBackend({ [`GET ${current}`]: covering, [`GET ${create}`]: { data: [nov, dec] } });
    const result = await seedPeriod(createSessions(cfg, backend.fetchFn), cfg, now);
    expect(result).toEqual({ step: "period", created: 0, skipped: 2, failed: [] });
    expect(backend.writes()).toEqual([]);
  });

  it("generates only the next month when this month's period already covers today", async () => {
    let generated = false;
    const backend = fakeBackend({
      [`GET ${current}`]: covering,
      [`GET ${create}`]: () => ({ data: generated ? [nov, dec] : [nov] }),
      [`POST ${create}/next`]: () => { generated = true; return { data: { total_created: 1 } }; },
    });
    const result = await seedPeriod(createSessions(cfg, backend.fetchFn), cfg, now);
    expect(result).toEqual({ step: "period", created: 1, skipped: 1, failed: [] });
    expect(backend.writes()).toEqual([{ method: "POST", path: `${create}/next`, body: { count: 2, start_day: 1 } }]);
  });

  it("creates this month's period when there is none, then tops up to the next month", async () => {
    let created = false;
    let generated = false;
    const backend = fakeBackend({
      [`GET ${current}`]: { __status: 404, message: "none" },
      [`GET ${create}`]: () => ({ data: [...(created ? [nov] : []), ...(generated ? [dec] : [])] }),
      [`POST ${create}`]: () => { created = true; return { data: { id: "p" } }; },
      [`POST ${create}/next`]: () => { generated = true; return { data: {} }; },
    });
    const result = await seedPeriod(createSessions(cfg, backend.fetchFn), cfg, now);
    expect(result).toEqual({ step: "period", created: 2, skipped: 0, failed: [] });
    expect(backend.writes()).toEqual([
      { method: "POST", path: create, body: { fiscal_year: 2026, fiscal_month: 11, start_at: "2026-11-01" } },
      { method: "POST", path: `${create}/next`, body: { count: 2, start_day: 1 } },
    ]);
  });

  it("fails when the next month is still missing after generating", async () => {
    const backend = fakeBackend({ [`GET ${current}`]: covering, [`GET ${create}`]: { data: [nov] } });
    const result = await seedPeriod(createSessions(cfg, backend.fetchFn), cfg, now);
    expect(result.failed).toEqual([`next period 2026-12 not found after POST ${create}/next`]);
  });

  it("reports a refused generate", async () => {
    const backend = fakeBackend({
      [`GET ${current}`]: covering, [`GET ${create}`]: { data: [nov] }, [`POST ${create}/next`]: { __status: 403, message: "no" },
    });
    const result = await seedPeriod(createSessions(cfg, backend.fetchFn), cfg, now);
    expect(result.failed).toEqual([`POST ${create}/next → 403 "no"`]);
  });

  it("creates one when the current period is closed or ended", async () => {
    const backend = fakeBackend({
      [`GET ${current}`]: { data: { status: "open", start_at: "2026-10-01T00:00:00Z", end_at: "2026-10-31T23:59:59Z" } },
    });
    await seedPeriod(createSessions(cfg, backend.fetchFn), cfg, now);
    expect(backend.writes()[0]).toMatchObject({ method: "POST", path: create });
  });

  it("reports a refused create", async () => {
    const backend = fakeBackend({ [`POST ${create}`]: { __status: 400, message: "exists" } });
    const result = await seedPeriod(createSessions(cfg, backend.fetchFn), cfg, now);
    expect(result.failed).toEqual([`POST ${create} → 400 "exists"`]);
  });
});
