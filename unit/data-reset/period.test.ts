import { describe, it, expect } from "vitest";
import { planPeriod, seedPeriod } from "../../scripts/data-reset/period";
import { createSessions } from "../../scripts/data-reset/sessions";
import type { ResetConfig } from "../../scripts/data-reset/config";
import { fakeBackend } from "./fake-backend";

const cfg: ResetConfig = {
  backendUrl: "http://h", xAppId: "app", buCode: "GR2VYNKQ", deployToken: "t",
  adminEmail: "carmensoftware.dev+admin@gmail.com",
};
const current = "/api/GR2VYNKQ/inventory-periods/current";
const create = "/api/GR2VYNKQ/inventory-periods";

describe("planPeriod", () => {
  it("uses the Bangkok calendar month", () => {
    expect(planPeriod(new Date("2026-11-30T20:00:00Z"))).toEqual({ fiscal_year: 2026, fiscal_month: 12, start_at: "2026-12-01" });
    expect(planPeriod(new Date("2026-11-05T00:00:00Z"))).toEqual({ fiscal_year: 2026, fiscal_month: 11, start_at: "2026-11-01" });
  });

  it("rolls the year at new year in Bangkok", () => {
    expect(planPeriod(new Date("2026-12-31T18:00:00Z"))).toEqual({ fiscal_year: 2027, fiscal_month: 1, start_at: "2027-01-01" });
  });
});

describe("seedPeriod", () => {
  const now = new Date("2026-11-05T03:00:00Z");

  it("skips when an open period already covers today", async () => {
    const backend = fakeBackend({
      [`GET ${current}`]: { data: { status: "open", start_at: "2026-11-01T00:00:00.000Z", end_at: "2026-11-30T23:59:59.999Z" } },
    });
    const result = await seedPeriod(createSessions(cfg, backend.fetchFn), cfg, now);
    expect(result).toEqual({ step: "period", created: 0, skipped: 1, failed: [] });
    expect(backend.writes()).toEqual([]);
  });

  it("creates this month's period when there is none", async () => {
    const backend = fakeBackend({ [`GET ${current}`]: { __status: 404, message: "none" } });
    const result = await seedPeriod(createSessions(cfg, backend.fetchFn), cfg, now);
    expect(result).toEqual({ step: "period", created: 1, skipped: 0, failed: [] });
    expect(backend.writes()).toEqual([
      { method: "POST", path: create, body: { fiscal_year: 2026, fiscal_month: 11, start_at: "2026-11-01" } },
    ]);
  });

  it("creates one when the current period is closed or ended", async () => {
    const backend = fakeBackend({
      [`GET ${current}`]: { data: { status: "open", start_at: "2026-10-01T00:00:00Z", end_at: "2026-10-31T23:59:59Z" } },
    });
    await seedPeriod(createSessions(cfg, backend.fetchFn), cfg, now);
    expect(backend.writes()).toHaveLength(1);
  });

  it("reports a refused create", async () => {
    const backend = fakeBackend({ [`POST ${create}`]: { __status: 400, message: "exists" } });
    const result = await seedPeriod(createSessions(cfg, backend.fetchFn), cfg, now);
    expect(result.failed).toEqual([`POST ${create} → 400 "exists"`]);
  });
});
