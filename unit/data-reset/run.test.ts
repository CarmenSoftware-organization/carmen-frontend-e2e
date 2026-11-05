import { describe, it, expect } from "vitest";
import { runDataReset } from "../../scripts/data-reset/index";
import type { ResetConfig } from "../../scripts/data-reset/config";
import type { ResetArgs } from "../../scripts/data-reset/cli";
import type { SeedResult } from "../../scripts/seed-master/types";
import { TEST_USERS } from "../../tests/test-users";
import { fakeBackend } from "./fake-backend";

const cfg: ResetConfig = {
  backendUrl: "https://dev.example", xAppId: "app", buCode: "GR2VYNKQ", deployToken: "t",
  adminEmail: "carmensoftware.dev+admin@gmail.com",
};
const args = (over: Partial<ResetArgs> = {}): ResetArgs => ({
  dryRun: false, yes: true, skipReset: false, verbose: false, help: false, ...over,
});
const base = "/api/config/GR2VYNKQ";
const now = new Date("2026-11-05T03:00:00Z");

function routes(over: Record<string, unknown> = {}) {
  return {
    "GET /api/user/profile": {
      data: {
        id: "user-x", user_info: { firstname: "F", middlename: "", lastname: "L" },
        business_unit: [{ id: "bu-1", code: "GR2VYNKQ", is_default: true }],
      },
    },
    [`GET ${base}/user-application-roles/user-x`]: { data: { application_roles: [{ application_role_id: "r1" }] } },
    [`GET ${base}/application-roles/r1`]: {
      data: {
        permissions: [
          { resource: "vendor_management.vendor", action: "view", is_granted: true },
          { resource: "product_management.category", action: "view", is_granted: true },
          { resource: "vendor_management.request_price_list", action: "view", is_granted: true },
        ],
      },
    },
    "POST /api-system/tenant/resets/bu-1": {
      data: { bu_id: "bu-1", bu_code: "GR2VYNKQ", schema: "S", tables_truncated: 3, rows_removed: {}, seeds: { success: true, created: 1, skipped: 0 } },
    },
    "GET /api/GR2VYNKQ/purchase-requests": { data: [], paginate: { total: 0 } },
    [`GET ${base}/departments`]: { data: [{ id: "dA", code: "A", name: "Admin" }, { id: "dB", code: "B", name: "Bar" }] },
    [`GET ${base}/locations`]: { data: [{ id: "l1", code: "L1" }, { id: "l2", code: "L2" }] },
    [`GET ${base}/vendors`]: { data: [{ id: "v1", code: "A001" }] },
    [`GET ${base}/vendors/v1`]: { data: { vendor_contact: [{ email: "v@x" }] } },
    [`GET ${base}/workflows`]: { data: [] },
    [`GET ${base}/products`]: { data: [{ id: "p1", code: "P1", name: "Rice" }] },
    "GET /api/GR2VYNKQ/inventory-periods/current": { __status: 404 },
    ...over,
  };
}

const okSeed = async (): Promise<SeedResult[]> => [{ entity: "unit", key: "ea", status: "created" }];

async function run(over: Record<string, unknown> = {}, a: Partial<ResetArgs> = {}, seedMaster = okSeed) {
  const backend = fakeBackend(routes(over));
  const lines: string[] = [];
  const seedCalls: boolean[] = [];
  const code = await runDataReset(args(a), cfg, {
    fetchFn: backend.fetchFn,
    now,
    log: (l) => lines.push(l),
    seedMaster: async (_client, dryRun) => { seedCalls.push(dryRun); return seedMaster(); },
  });
  return { code, backend, out: lines.join("\n"), seedCalls };
}

const firstWrite = (paths: string[], prefix: string) => paths.findIndex((p) => p.startsWith(prefix));

describe("runDataReset", () => {
  it("runs every step in order on the happy path", async () => {
    const { code, backend, seedCalls } = await run();
    expect(code).toBe(0);
    expect(seedCalls).toEqual([false]);
    const writes = backend.writes().map((c) => `${c.method} ${c.path}`);
    const order = [
      "POST /api-system/tenant/resets/",
      `PATCH ${base}/departments/`,
      `PUT ${base}/locations-users/`,
      `POST ${base}/workflows`,
      "POST /api/GR2VYNKQ/inventory-periods",
    ].map((p) => firstWrite(writes, p));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((x, y) => x - y)).toEqual(order);
  });

  it("dry run only reads and lists the planned writes", async () => {
    const { code, backend, out, seedCalls } = await run({}, { dryRun: true, yes: false });
    expect(code).toBe(0);
    expect(backend.writes()).toEqual([]);
    expect(seedCalls).toEqual([true]);
    for (const step of ["reset", "master", "mappings", "workflows", "period"]) expect(out).toContain(step);
  });

  it("refuses a live run against a remote backend without --yes", async () => {
    const { code, backend } = await run({}, { yes: false });
    expect(code).toBe(2);
    expect(backend.calls).toEqual([]);
  });

  it("stops before the reset when step 0 finds a problem", async () => {
    const { code, backend, out } = await run({ [`GET ${base}/application-roles/r1`]: { data: { permissions: [] } } });
    expect(code).toBe(1);
    expect(backend.calls.some((c) => c.path.startsWith("/api-system/tenant/resets/"))).toBe(false);
    expect(out).toContain("purchase lacks vendor_management.vendor.view");
  });

  it("stops when the reset fails", async () => {
    const { code, backend } = await run({ "POST /api-system/tenant/resets/bu-1": { __status: 504 } });
    expect(code).toBe(1);
    expect(backend.writes().filter((c) => c.path.startsWith("/api/config/"))).toEqual([]);
  });

  it("stops after a master row fails", async () => {
    const failing = async (): Promise<SeedResult[]> => [{ entity: "vendor", key: "A001", status: "failed", error: "400" }];
    const { code, backend } = await run({}, {}, failing);
    expect(code).toBe(1);
    expect(backend.calls.some((c) => c.path.includes("/workflows") || c.path.includes("/inventory-periods"))).toBe(false);
  });

  it("--skip-reset refuses a BU that already holds PRs", async () => {
    const { code, backend, out } = await run(
      { "GET /api/GR2VYNKQ/purchase-requests": { data: [{ id: "pr" }], paginate: { total: 1 } } },
      { skipReset: true },
    );
    expect(code).toBe(1);
    expect(backend.writes()).toEqual([]);
    expect(out).toMatch(/already holds 1 purchase request/);
  });

  for (const [label, answer] of [
    ["answers 500", { __status: 500 }],
    ["has no paginate total", { data: [] }],
  ] as const) {
    it(`--skip-reset refuses when the PR list ${label}`, async () => {
      const { code, backend } = await run({ "GET /api/GR2VYNKQ/purchase-requests": answer }, { skipReset: true });
      expect(code).toBe(1);
      expect(backend.writes()).toEqual([]);
    });
  }

  it("--skip-reset seeds an empty BU without calling the reset", async () => {
    const { code, backend } = await run({}, { skipReset: true });
    expect(code).toBe(0);
    expect(backend.calls.some((c) => c.path.startsWith("/api-system/"))).toBe(false);
  });

  it("exits 1 when a later step records a failure", async () => {
    const { code, out } = await run({ "POST /api/GR2VYNKQ/inventory-periods": { __status: 400, message: "x" } });
    expect(code).toBe(1);
    expect(out).toContain("period");
  });

  it("logs in each of the 9 accounts once", async () => {
    const backend = fakeBackend(routes());
    let logins = 0;
    const counting = (async (url: string, init?: RequestInit) => {
      if (url.endsWith("/api/auth/login")) logins++;
      return backend.fetchFn(url, init);
    }) as unknown as typeof fetch;
    await runDataReset(args(), cfg, { fetchFn: counting, now, log: () => {}, seedMaster: okSeed });
    expect(logins).toBe(TEST_USERS.length);
  });
});
