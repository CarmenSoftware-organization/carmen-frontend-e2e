import { describe, it, expect } from "vitest";
import { runDataReset } from "../../scripts/data-reset/index";
import type { ResetConfig } from "../../scripts/data-reset/config";
import type { ResetArgs } from "../../scripts/data-reset/cli";
import type { SeedResult } from "../../scripts/seed-master/types";
import type { StepResult } from "../../scripts/data-reset/step-result";
import { TEST_USERS } from "../../tests/test-users";
import { fakeBackend } from "./fake-backend";

const cfg: ResetConfig = {
  backendUrl: "https://dev.example", xAppId: "app", buCode: "BU-GR2VYNKQ", deployToken: "t",
  adminEmail: "carmensoftware.dev+admin@gmail.com",
};
const args = (over: Partial<ResetArgs> = {}): ResetArgs => ({
  dryRun: false, yes: true, skipReset: false, verbose: false, help: false, bu: "BU-GR2VYNKQ", ...over,
});
const base = "/api/config/BU-GR2VYNKQ";
const now = new Date("2026-11-05T03:00:00Z");

// The accounting step resolves account ids from the COA list, so POSTed accounts must come back on GET.
const accountingCodes = ["2100", "1170", "2150", "1180", "5300", "1140", "1110", "4300", "5400"];

function routes(over: Record<string, unknown> = {}) {
  const coa = accountingCodes.map((code) => ({ id: `coa-${code}`, code }));
  let generated = false;
  return {
    "GET /api/BU-GR2VYNKQ/inventory-transactions/calculation-method": { data: { calculation_method: "average" } },
    "GET /api/BU-GR2VYNKQ/inventory-periods": () => ({
      data: [
        { fiscal_year: 2026, fiscal_month: 11, status: "open" },
        ...(generated ? [{ fiscal_year: 2026, fiscal_month: 12, status: "open" }] : []),
      ],
    }),
    "POST /api/BU-GR2VYNKQ/inventory-periods/next": () => { generated = true; return { data: { total_created: 1 } }; },
    "GET /api/user/profile": {
      data: {
        id: "user-x", user_info: { firstname: "F", middlename: "", lastname: "L" },
        business_unit: [{ id: "bu-1", code: "BU-GR2VYNKQ", is_default: true }],
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
      data: { bu_id: "bu-1", bu_code: "BU-GR2VYNKQ", schema: "S", tables_truncated: 3, rows_removed: {}, seeds: { success: true, created: 1, skipped: 0 } },
    },
    "GET /api/BU-GR2VYNKQ/purchase-requests": { data: [], paginate: { total: 0 } },
    [`GET ${base}/departments`]: { data: [{ id: "dA", code: "A", name: "Admin" }, { id: "dB", code: "B", name: "Bar" }] },
    [`GET ${base}/locations`]: { data: [{ id: "l1", code: "L1" }, { id: "l2", code: "L2" }] },
    [`GET ${base}/vendors`]: { data: [{ id: "v1", code: "A001" }] },
    [`GET ${base}/vendors/v1`]: { data: { vendor_contact: [{ email: "v@x" }] } },
    [`GET ${base}/application-roles`]: {
      data: ["Accounting", "Approval", "HOD", "Purchase", "Requestor"].map((name) => ({ id: `r-${name}`, name })),
    },
    [`GET ${base}/user-application-roles`]: { data: [] },
    // The accounting roles read permission ids from the BU's "Accounting" role.
    [`GET ${base}/application-roles/r-Accounting`]: {
      data: {
        id: "r-Accounting",
        permissions: [
          "accounting.view", "accounting.ap.view", "accounting.gl.view", "accounting.gl.jv_template.view",
          "accounting.ap.void", "accounting.gl.void", "accounting.gl.post", "accounting.gl.reverse",
        ].map((k) => ({ permission_id: `perm-${k}`, resource: k.slice(0, k.lastIndexOf(".")), action: k.slice(k.lastIndexOf(".") + 1), is_granted: false })),
      },
    },
    [`POST ${base}/application-roles`]: (b: unknown) => ({ data: { id: `new-${(b as { application_role_name: string }).application_role_name}` } }),
    "GET /api/business-units": { data: { id: "bu-1", code: "BU-GR2VYNKQ", doc_version: 1, default_currency_id: null } },
    [`GET ${base}/currencies`]: { data: [{ id: "c-thb", code: "THB" }] },
    [`GET ${base}/workflows`]: { data: [] },
    [`GET ${base}/products`]: { data: [{ id: "p1", code: "P1", name: "Rice" }] },
    "GET /api/BU-GR2VYNKQ/inventory-periods/current": { __status: 404 },
    [`GET ${base}/currencies`]: { data: [{ id: "c-thb", code: "THB" }] },
    "GET /api/business-units": { data: { id: "bu-1", code: "BU-GR2VYNKQ", doc_version: 4, default_currency_id: "c-old" } },
    "PATCH /api/business-units": { data: { id: "bu-1", doc_version: 5 } },
    [`GET ${base}/chart-of-accounts`]: { data: coa },
    [`POST ${base}/chart-of-accounts`]: { data: { id: "a1" } },
    [`GET ${base}/gl-jv-prefixes`]: { data: [] },
    [`POST ${base}/gl-jv-prefixes`]: (b: unknown) => ({ data: { id: `px-${(b as { code: string }).code}` } }),
    [`GET ${base}/app-config/gl_setting`]: { __status: 404 },
    [`PUT ${base}/app-config/gl_setting`]: { data: {} },
    [`GET ${base}/gl-periods`]: { data: [] },
    [`POST ${base}/gl-periods/years`]: { data: {} },
    [`GET ${base}/bank-accounts`]: { data: [] },
    [`POST ${base}/bank-accounts`]: { data: {} },
    [`GET ${base}/tax-profiles`]: { data: [{ id: "t-vat", name: "Vat 7%", chart_of_accounts_id: null, doc_version: 0 }] },
    [`PATCH ${base}/tax-profiles/t-vat`]: { data: {} },
    [`POST ${base}/tax-profiles`]: { data: {} },
    [`PUT ${base}/vendors/v1`]: { data: {} },
    ...over,
  };
}

const okSeed = async (): Promise<SeedResult[]> => [{ entity: "unit", key: "ea", status: "created" }];

async function run(
  over: Record<string, unknown> = {},
  a: Partial<ResetArgs> = {},
  seedMaster = okSeed,
  documents: StepResult[] = [{ step: "verify", created: 0, skipped: 0, failed: [] }],
) {
  const backend = fakeBackend(routes(over));
  const lines: string[] = [];
  const seedCalls: boolean[] = [];
  const documentCalls: number[] = [];
  const code = await runDataReset(args(a), cfg, {
    fetchFn: backend.fetchFn,
    now,
    log: (l) => lines.push(l),
    seedMaster: async (_client, dryRun) => { seedCalls.push(dryRun); return seedMaster(); },
    seedDocuments: async () => {
      documentCalls.push(backend.writes().length);
      return documents;
    },
  });
  return { code, backend, out: lines.join("\n"), seedCalls, documentCalls };
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
      "PATCH /api/business-units",
      `POST ${base}/chart-of-accounts`,
      `POST ${base}/gl-jv-prefixes`,
      `PUT ${base}/app-config/gl_setting`,
      `POST ${base}/gl-periods/years`,
      `POST ${base}/bank-accounts`,
      `PATCH ${base}/tax-profiles/`,
      `PUT ${base}/vendors/`,
      `PATCH ${base}/departments/`,
      `PUT ${base}/locations-users/`,
      `POST ${base}/user-application-roles`,
      `POST ${base}/application-roles`,
      `POST ${base}/workflows`,
      "POST /api/BU-GR2VYNKQ/inventory-periods",
    ].map((p) => firstWrite(writes, p));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((x, y) => x - y)).toEqual(order);
  });

  it("dry run only reads and lists the planned writes", async () => {
    const { code, backend, out, seedCalls } = await run({}, { dryRun: true, yes: false });
    expect(code).toBe(0);
    expect(backend.writes()).toEqual([]);
    expect(seedCalls).toEqual([true]);
    expect(out).toContain("accounting: would");
    for (const step of ["reset", "master", "accounting", "mappings", "access", "accounting-roles", "workflows", "period"]) expect(out).toContain(step);
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

  it("stops with exit 1 before mappings and workflows when the BU default currency cannot be set", async () => {
    const { code, backend, out, documentCalls } = await run({ "PATCH /api/business-units": { __status: 500 } });
    expect(code).toBe(1);
    expect(out).toContain("BU base");
    const writes = backend.writes().map((c) => `${c.method} ${c.path}`);
    expect(writes.some((p) => p.startsWith(`PATCH ${base}/departments/`) || p === `POST ${base}/workflows`)).toBe(false);
    expect(documentCalls).toEqual([]);
  });

  it("stops with exit 1 before mappings when the chart of accounts cannot be seeded", async () => {
    const { code, backend } = await run({ [`POST ${base}/chart-of-accounts`]: { __status: 500 } });
    expect(code).toBe(1);
    expect(backend.writes().some((c) => c.path === `${base}/workflows`)).toBe(false);
  });

  it("stops with exit 1 before mappings when the accounting base cannot be seeded", async () => {
    const { code, backend, out, documentCalls } = await run({ [`PUT ${base}/app-config/gl_setting`]: { __status: 500 } });
    expect(code).toBe(1);
    expect(out).toContain("accounting setup");
    expect(backend.writes().some((c) => c.path.startsWith(`${base}/departments/`) || c.path === `${base}/workflows`)).toBe(false);
    expect(documentCalls).toEqual([]);
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
      { "GET /api/BU-GR2VYNKQ/purchase-requests": { data: [{ id: "pr" }], paginate: { total: 1 } } },
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
      const { code, backend } = await run({ "GET /api/BU-GR2VYNKQ/purchase-requests": answer }, { skipReset: true });
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
    const { code, out } = await run({ "POST /api/BU-GR2VYNKQ/inventory-periods": { __status: 400, message: "x" } });
    expect(code).toBe(1);
    expect(out).toContain("period");
  });

  it("seeds documents after the period, once, and fails the run on a short verify row", async () => {
    const ok = await run();
    expect(ok.code).toBe(0);
    expect(ok.documentCalls).toHaveLength(1);
    const lastWrite = ok.backend.writes().at(-1)!;
    expect(lastWrite.path).toBe("/api/BU-GR2VYNKQ/inventory-periods/next");
    const short = await run({}, {}, okSeed, [{ step: "verify", created: 0, skipped: 0, failed: ["PR draft: expected ≥ 3, found 0"] }]);
    expect(short.code).toBe(1);
    expect(short.out).toContain("PR draft: expected ≥ 3, found 0");
  });

  it("dry run does not seed documents but prints the document plan", async () => {
    const { documentCalls, out } = await run({}, { dryRun: true, yes: false });
    expect(documentCalls).toEqual([]);
    expect(out).toMatch(/documents: would create .*41 PR.*accounting read set/);
  });

  it("does not seed documents after a failed earlier step", async () => {
    const { documentCalls } = await run({ "POST /api/BU-GR2VYNKQ/inventory-periods": { __status: 400 } });
    expect(documentCalls).toEqual([]);
  });

  it("logs in each of the 9 accounts once", async () => {
    const backend = fakeBackend(routes());
    let logins = 0;
    const counting = (async (url: string, init?: RequestInit) => {
      if (url.endsWith("/api/auth/login")) logins++;
      return backend.fetchFn(url, init);
    }) as unknown as typeof fetch;
    await runDataReset(args(), cfg, { fetchFn: counting, now, log: () => {}, seedMaster: okSeed, seedDocuments: async () => [] });
    expect(logins).toBe(TEST_USERS.length);
  });
});
