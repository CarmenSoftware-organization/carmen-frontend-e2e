import { describe, it, expect } from "vitest";
import { createSessions } from "../../scripts/data-reset/sessions";
import type { ResetConfig } from "../../scripts/data-reset/config";

const cfg: ResetConfig = {
  backendUrl: "http://h", xAppId: "app", buCode: "GR2VYNKQ", deployToken: "t",
  adminEmail: "carmensoftware.dev+admin@gmail.com",
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("createSessions", () => {
  it("logs each account in once and reuses the client", async () => {
    const logins: string[] = [];
    const fakeFetch = (async (url: string, init?: RequestInit) => {
      if (url.endsWith("/api/auth/login")) {
        logins.push(JSON.parse(init!.body as string).email);
        return jsonResponse(200, { data: { access_token: "tok" } });
      }
      return jsonResponse(200, {});
    }) as unknown as typeof fetch;
    const sessions = createSessions(cfg, fakeFetch);
    await sessions.client("a@x");
    await sessions.client("a@x");
    await sessions.client("b@x");
    expect(logins).toEqual(["a@x", "b@x"]);
  });

  it("uses the test-user password for the account", async () => {
    let body: { password?: string } = {};
    const fakeFetch = (async (_url: string, init?: RequestInit) => {
      body = JSON.parse(init!.body as string);
      return jsonResponse(200, { data: { access_token: "tok" } });
    }) as unknown as typeof fetch;
    await createSessions(cfg, fakeFetch).client("carmensoftware.dev+hod@gmail.com");
    expect(body.password).toBe("12345678");
  });

  it("sends the suite's rate-limit bypass header on login", async () => {
    let headers: Record<string, string> = {};
    const fakeFetch = (async (_url: string, init?: RequestInit) => {
      headers = init!.headers as Record<string, string>;
      return jsonResponse(200, { data: { access_token: "tok" } });
    }) as unknown as typeof fetch;
    await createSessions(cfg, fakeFetch).client("a@x");
    expect(headers["x-rate-limit-bypass"]).toBe("true");
  });

  it("does not cache a failed login", async () => {
    let calls = 0;
    const fakeFetch = (async () => {
      calls++;
      return calls === 1 ? jsonResponse(401, { message: "bad" }) : jsonResponse(200, { data: { access_token: "tok" } });
    }) as unknown as typeof fetch;
    const sessions = createSessions(cfg, fakeFetch);
    await expect(sessions.client("a@x")).rejects.toThrow(/Login failed: 401/);
    await expect(sessions.client("a@x")).resolves.toBeDefined();
    expect(calls).toBe(2);
  });
});
