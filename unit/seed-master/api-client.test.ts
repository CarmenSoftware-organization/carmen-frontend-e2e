// unit/seed-master/api-client.test.ts
import { describe, it, expect } from "vitest";
import { login, createApiClient } from "../../scripts/seed-master/api-client";
import type { SeedConfig } from "../../scripts/seed-master/types";

const cfg: SeedConfig = {
  backendUrl: "http://localhost:4000", xAppId: "app-1",
  buCode: "BLAVG", email: "a@b.com", password: "pw",
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("login", () => {
  it("posts credentials and returns access_token", async () => {
    let calledUrl = "", calledInit: RequestInit | undefined;
    const fakeFetch = (async (url: string, init?: RequestInit) => {
      calledUrl = url; calledInit = init;
      return jsonResponse(200, { data: { access_token: "tok-1", refresh_token: "r-1" } });
    }) as unknown as typeof fetch;

    const token = await login(cfg, fakeFetch);
    expect(token).toBe("tok-1");
    expect(calledUrl).toBe("http://localhost:4000/api/auth/login");
    expect((calledInit!.headers as Record<string, string>)["x-app-id"]).toBe("app-1");
    expect(JSON.parse(calledInit!.body as string)).toEqual({ email: "a@b.com", password: "pw" });
  });

  it("retries once on 429 then succeeds", async () => {
    let calls = 0;
    const fakeFetch = (async () => {
      calls++;
      return calls === 1
        ? jsonResponse(429, { retry_after: 0 })
        : jsonResponse(200, { data: { access_token: "tok-2", refresh_token: "r" } });
    }) as unknown as typeof fetch;

    const token = await login(cfg, fakeFetch, { sleep: async () => {} });
    expect(token).toBe("tok-2");
    expect(calls).toBe(2);
  });

  it("throws on non-2xx non-429", async () => {
    const fakeFetch = (async () => jsonResponse(401, { message: "bad creds" })) as unknown as typeof fetch;
    await expect(login(cfg, fakeFetch)).rejects.toThrow(/Login failed: 401/);
  });
});

describe("createApiClient", () => {
  it("adds bearer + x-app-id and parses GET json", async () => {
    let headers: Record<string, string> = {};
    const fakeFetch = (async (_url: string, init?: RequestInit) => {
      headers = init!.headers as Record<string, string>;
      return jsonResponse(200, { data: [{ id: "1", code: "THB" }] });
    }) as unknown as typeof fetch;

    const client = createApiClient(cfg, "tok-9", fakeFetch);
    const res = await client.get("/api/config/BLAVG/currencies");
    expect(res.ok).toBe(true);
    expect(res.body.data[0].code).toBe("THB");
    expect(headers["Authorization"]).toBe("Bearer tok-9");
    expect(headers["x-app-id"]).toBe("app-1");
  });

  it("returns ok:false with parsed body on POST failure", async () => {
    const fakeFetch = (async () => jsonResponse(400, { message: "validation" })) as unknown as typeof fetch;
    const client = createApiClient(cfg, "tok", fakeFetch);
    const res = await client.post("/api/config/BLAVG/units", { name: "KG" });
    expect(res.ok).toBe(false);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("validation");
  });
});

describe("createApiClient put/patch", () => {
  for (const method of ["put", "patch"] as const) {
    it(`${method} sends ${method.toUpperCase()} with a JSON body and auth headers`, async () => {
      let calledUrl = "", calledInit: RequestInit | undefined;
      const fakeFetch = (async (url: string, init?: RequestInit) => {
        calledUrl = url; calledInit = init;
        return jsonResponse(200, { data: { ok: true } });
      }) as unknown as typeof fetch;
      const client = createApiClient(cfg, "tok", fakeFetch);
      const res = await client[method]("/x", { a: 1 });
      expect(calledUrl).toBe("http://localhost:4000/x");
      expect(calledInit!.method).toBe(method.toUpperCase());
      expect(JSON.parse(calledInit!.body as string)).toEqual({ a: 1 });
      const headers = calledInit!.headers as Record<string, string>;
      expect(headers.Authorization).toBe("Bearer tok");
      expect(headers["x-app-id"]).toBe("app-1");
      expect(res.body.data.ok).toBe(true);
    });
  }
});
