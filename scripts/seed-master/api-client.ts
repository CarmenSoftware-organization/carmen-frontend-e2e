// scripts/seed-master/api-client.ts
import type { SeedConfig } from "./types";

export interface ApiResult {
  status: number;
  ok: boolean;
  body: any;
}

export interface ApiClient {
  get(path: string): Promise<ApiResult>;
  post(path: string, body: unknown): Promise<ApiResult>;
  put(path: string, body: unknown): Promise<ApiResult>;
  patch(path: string, body: unknown): Promise<ApiResult>;
}

interface LoginOpts {
  maxRetries?: number;
  /** Extra request headers, e.g. the suite's `x-rate-limit-bypass`. */
  headers?: Record<string, string>;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function login(
  cfg: SeedConfig,
  fetchFn: typeof fetch = fetch,
  opts: LoginOpts = {},
): Promise<string> {
  const maxRetries = opts.maxRetries ?? 3;
  const sleep = opts.sleep ?? defaultSleep;

  for (let attempt = 0; ; attempt++) {
    const res = await fetchFn(`${cfg.backendUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-app-id": cfg.xAppId, ...opts.headers },
      body: JSON.stringify({ email: cfg.email, password: cfg.password }),
    });
    const json = await res.json().catch(() => ({} as any));

    if (res.status === 429 && attempt < maxRetries) {
      const retryAfter = typeof json?.retry_after === "number" ? json.retry_after : 2 ** attempt;
      await sleep(retryAfter * 1000);
      continue;
    }
    if (!res.ok) {
      throw new Error(`Login failed: ${res.status} ${JSON.stringify(json)}`);
    }
    const token = json?.data?.access_token;
    if (!token) throw new Error("Login response missing access_token");
    return token;
  }
}

export function createApiClient(
  cfg: SeedConfig,
  token: string,
  fetchFn: typeof fetch = fetch,
): ApiClient {
  const authHeaders: Record<string, string> = {
    "x-app-id": cfg.xAppId,
    Authorization: `Bearer ${token}`,
  };

  async function request(method: string, path: string, body?: unknown): Promise<ApiResult> {
    const hasBody = body !== undefined;
    const res = await fetchFn(`${cfg.backendUrl}${path}`, {
      method,
      headers: hasBody ? { ...authHeaders, "Content-Type": "application/json" } : authHeaders,
      body: hasBody ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let parsed: any = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }
    return { status: res.status, ok: res.ok, body: parsed };
  }

  return {
    get: (path) => request("GET", path),
    post: (path, body) => request("POST", path, body),
    put: (path, body) => request("PUT", path, body),
    patch: (path, body) => request("PATCH", path, body),
  };
}
