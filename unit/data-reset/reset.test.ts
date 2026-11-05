import { describe, it, expect } from "vitest";
import { callReset, findBuId } from "../../scripts/data-reset/reset";
import type { ResetConfig } from "../../scripts/data-reset/config";

const cfg: ResetConfig = {
  backendUrl: "https://dev", xAppId: "app", buCode: "GR2VYNKQ", deployToken: "t",
  adminEmail: "carmensoftware.dev+admin@gmail.com",
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const okBody = {
  data: {
    bu_id: "u2", bu_code: "GR2VYNKQ", schema: "S", tables_truncated: 197, rows_removed: {},
    seeds: { success: true, created: 120, skipped: 0 },
  },
};

describe("findBuId", () => {
  it("returns the id of the BU with that code", () => {
    const profile = { data: { business_unit: [{ id: "u1", code: "OTHER" }, { id: "u2", code: "GR2VYNKQ" }] } };
    expect(findBuId(profile, "GR2VYNKQ")).toBe("u2");
  });

  it("throws when the account is not in that BU", () => {
    expect(() => findBuId({ data: { business_unit: [] } }, "GR2VYNKQ")).toThrow(
      "GR2VYNKQ is not in this account's business units",
    );
  });
});

describe("callReset", () => {
  it("posts with the deploy token and no user token", async () => {
    let url = "", init: RequestInit | undefined;
    const fakeFetch = (async (u: string, i?: RequestInit) => {
      url = u; init = i;
      return jsonResponse(200, okBody);
    }) as unknown as typeof fetch;
    await callReset(cfg, "u2", fakeFetch);
    expect(url).toBe("https://dev/api-system/tenant/resets/u2");
    expect(init!.method).toBe("POST");
    const headers = init!.headers as Record<string, string>;
    expect(headers["x-deploy-token"]).toBe("t");
    expect(Object.keys(headers).map((k) => k.toLowerCase())).not.toContain("authorization");
  });

  it("unwraps a successful summary", async () => {
    const fakeFetch = (async () => jsonResponse(200, okBody)) as unknown as typeof fetch;
    const outcome = await callReset(cfg, "u2", fakeFetch);
    expect(outcome).toEqual({ ok: true, summary: okBody.data });
  });

  it("accepts a summary that is not wrapped in data", async () => {
    const fakeFetch = (async () => jsonResponse(200, okBody.data)) as unknown as typeof fetch;
    expect((await callReset(cfg, "u2", fakeFetch)).ok).toBe(true);
  });

  it("does not trust a reset of another BU", async () => {
    const fakeFetch = (async () => jsonResponse(200, { data: { ...okBody.data, bu_code: "OTHER" } })) as unknown as typeof fetch;
    expect(await callReset(cfg, "u2", fakeFetch)).toMatchObject({ ok: false, reason: "unknown" });
  });

  it("reports a 403 as refused and names the allow-list and the token", async () => {
    const fakeFetch = (async () => jsonResponse(403, { message: "no" })) as unknown as typeof fetch;
    const outcome = await callReset(cfg, "u2", fakeFetch);
    expect(outcome).toMatchObject({ ok: false, reason: "refused" });
    if (!outcome.ok) {
      expect(outcome.message).toContain("TENANT_RESET_ALLOWED_BU_CODES");
      expect(outcome.message).toContain("DATA_RESET_DEPLOY_TOKEN");
    }
  });

  for (const [label, fakeFetch] of [
    ["a 504", (async () => jsonResponse(504, { message: "Gateway Timeout" })) as unknown as typeof fetch],
    ["a timeout", (async () => { throw new Error("The operation timed out"); }) as unknown as typeof fetch],
  ] as const) {
    it(`reports ${label} as unknown: the reset may have completed`, async () => {
      const outcome = await callReset(cfg, "u2", fakeFetch);
      expect(outcome).toMatchObject({ ok: false, reason: "unknown" });
      if (!outcome.ok) {
        expect(outcome.message).toContain("may have completed");
        expect(outcome.message).toContain("--skip-reset");
      }
    });
  }

  it("throws before any request when the token is not set", async () => {
    let calls = 0;
    const fakeFetch = (async () => { calls++; return jsonResponse(200, okBody); }) as unknown as typeof fetch;
    await expect(callReset({ ...cfg, deployToken: undefined }, "u2", fakeFetch)).rejects.toThrow(
      "DATA_RESET_DEPLOY_TOKEN is not set",
    );
    expect(calls).toBe(0);
  });
});
