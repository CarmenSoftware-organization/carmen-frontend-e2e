import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BU_CODE, TEST_USERS } from "../test-users";
import { TEST_PASSWORD } from "../test-users";

/**
 * Direct backend access for the TEST BU (default project accounts, `TEST_USERS`).
 *
 * Reads VERIFY what the UI just did; writes only seed or restore data the UI cannot
 * cheaply produce. Logs in on its own (fetch) — the browser keeps its access token in
 * memory, so the page's token cannot be reused, and a separate login does not rotate
 * the page's refresh token.
 */
export type Role = (typeof TEST_USERS)[number]["role"];

interface Backend {
  url: string;
  appId: string;
}
let backend: Promise<Backend> | null = null;
const tokens = new Map<string, Promise<string>>();

async function resolveBackend(): Promise<Backend> {
  const base = (process.env.E2E_BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  let cfg: { BACKEND_URL?: string; X_APP_ID?: string } = {};
  try {
    const r = await fetch(`${base}/config.json`);
    if (r.ok) cfg = await r.json();
  } catch {
    // frontend not reachable — fall back to the checkout's file
  }
  if (!cfg.BACKEND_URL) {
    const dir = process.env.E2E_FRONTEND_DIR ?? "../carmen-frontend";
    const file = ["public/config.local.json", "public/config.json"]
      .map((f) => resolve(dir, f))
      .find((p) => existsSync(p));
    if (file) cfg = JSON.parse(readFileSync(file, "utf8"));
  }
  const url = (cfg.BACKEND_URL ?? "").replace(/\/+$/, "");
  if (!url || !cfg.X_APP_ID) throw new Error("bu-api: cannot resolve BACKEND_URL / X_APP_ID from /config.json");
  return { url, appId: cfg.X_APP_ID };
}

async function login(role: Role): Promise<string> {
  const { url, appId } = await (backend ??= resolveBackend());
  const email = TEST_USERS.find((u) => u.role === role)!.email;
  let r: Response | null = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    r = await fetch(`${url}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-id": appId,
        "x-rate-limit-bypass": process.env.E2E_RATE_LIMIT_BYPASS_TOKEN || process.env.RATE_LIMIT_BYPASS_TOKEN || "true",
      },
      body: JSON.stringify({ email, password: TEST_PASSWORD }),
    });
    if (r.status !== 429) break;
    await new Promise((done) => setTimeout(done, 5_000 * (attempt + 1)));
  }
  if (!r || !r.ok) throw new Error(`bu-api: login ${email} -> ${r?.status}`);
  return (await r.json()).data.access_token as string;
}

function tokenFor(role: Role): Promise<string> {
  let t = tokens.get(role);
  if (!t) {
    t = login(role);
    tokens.set(role, t);
    t.catch(() => tokens.delete(role));
  }
  return t;
}

export interface ApiResult<T = any> {
  status: number;
  body: T;
}

/** `path` is relative to the BU: `/purchase-request-templates` -> `/api/<BU>/purchase-request-templates`. */
export async function buSend<T = any>(
  role: Role,
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  const { url, appId } = await (backend ??= resolveBackend());
  const r = await fetch(`${url}/api/${BU_CODE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-app-id": appId,
      Authorization: `Bearer ${await tokenFor(role)}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: r.status, body: parsed as T };
}

/** Config endpoints live under `/api/config/<BU>/...` (extra-cost-types, tax profiles ...). */
export async function buConfigSend<T = any>(
  role: Role,
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  const { url, appId } = await (backend ??= resolveBackend());
  const r = await fetch(`${url}/api/config/${BU_CODE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", "x-app-id": appId, Authorization: `Bearer ${await tokenFor(role)}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: r.status, body: parsed as T };
}

export const buGet = <T = any>(role: Role, path: string) => buSend<T>(role, "GET", path);

/** The role's permission keys from /api/user/profile (for "no role gate" claims). */
export async function profilePermissions(role: Role): Promise<unknown> {
  const { url, appId } = await (backend ??= resolveBackend());
  const r = await fetch(`${url}/api/user/profile`, {
    headers: { "x-app-id": appId, Authorization: `Bearer ${await tokenFor(role)}` },
  });
  return (await r.json()).data;
}
