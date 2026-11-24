import { rateLimitBypassToken } from "../rate-limit";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MOVEMENT_USERS, type MovementUser } from "../../movement-users";
import { TEST_USERS } from "../../test-users";

// The period-close project runs on the TEST BUs with the gmail accounts of the `setup` project, so its
// verification reads must log in as those — the legacy movement accounts are not on the TEST BUs.
const PERIOD_CLOSE_ROLES: Record<MovementUser, string> = { admin: "Admin", requestor: "Requestor", purchase: "Purchase", hod: "HOD", fc: "FC" };
function credentialsFor(user: MovementUser): { email: string; password: string } {
  if (process.env.E2E_PERIOD_CLOSE === "1") {
    const u = TEST_USERS.find((x) => x.role === PERIOD_CLOSE_ROLES[user]);
    if (!u) throw new Error(`movement api: no gmail TEST_USERS account for role ${PERIOD_CLOSE_ROLES[user]}`);
    return { email: u.email as string, password: u.password as string };
  }
  return MOVEMENT_USERS[user];
}

/**
 * Direct backend access for the movement suite.
 *
 * Reads exist to VERIFY what the UI just did (the stored qty, status, workflow
 * stage) — never to set up what the UI could do itself. Writes (`apiSend` with a
 * non-GET method) are reserved for the few cases the screens cannot produce,
 * e.g. a Stock In dated next period: the form's calendar is locked to the current
 * period but the backend accepts it, and that acceptance is what is under test.
 *
 * Logs in separately from the browser: the browser keeps only a refresh token,
 * and refreshing it here would rotate it out from under the page.
 *
 * Backend resolution: E2E_API_URL + E2E_X_APP_ID, else the running frontend's
 * /config.json (what the browser talks to), else the frontend checkout's
 * public/config.local.json.
 */
interface Backend {
  url: string;
  appId: string;
}

let backend: Promise<Backend> | null = null;
const tokens = new Map<string, Promise<string>>();

async function resolveBackend(): Promise<Backend> {
  const envUrl = process.env.E2E_API_URL;
  const envApp = process.env.E2E_X_APP_ID;
  let cfg: { BACKEND_URL?: string; X_APP_ID?: string } = {};
  if (!envUrl || !envApp) {
    const base = (process.env.E2E_BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
    try {
      const r = await fetch(`${base}/config.json`);
      if (r.ok) cfg = await r.json();
    } catch {
      // frontend not running (standalone script) — fall through to the checkout's file
    }
    if (!cfg.BACKEND_URL) {
      const dir = process.env.E2E_FRONTEND_DIR ?? "../carmen-frontend";
      const file = ["public/config.local.json", "public/config.json"]
        .map((f) => resolve(dir, f))
        .find((p) => existsSync(p));
      if (file) cfg = JSON.parse(readFileSync(file, "utf8"));
    }
  }
  const url = (envUrl ?? cfg.BACKEND_URL ?? "").replace(/\/+$/, "");
  const appId = envApp ?? cfg.X_APP_ID ?? "";
  if (!url || !appId) {
    throw new Error("movement api: set E2E_API_URL + E2E_X_APP_ID, or run the frontend so /config.json is readable");
  }
  return { url, appId };
}

const getBackend = () => (backend ??= resolveBackend());

async function login(user: MovementUser): Promise<string> {
  const { url, appId } = await getBackend();
  const creds = credentialsFor(user);
  let r: Response | null = null;
  // Login is rate limited per email (429) — the bypass header usually avoids it,
  // the backoff covers a backend that ignores the header.
  for (let attempt = 0; attempt < 6; attempt++) {
    r = await fetch(`${url}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-app-id": appId, "x-rate-limit-bypass": rateLimitBypassToken() },
      body: JSON.stringify({ email: creds.email, password: creds.password }),
    });
    if (r.status !== 429) break;
    await new Promise((done) => setTimeout(done, 5_000 * (attempt + 1)));
  }
  if (!r || !r.ok) throw new Error(`movement api: login ${creds.email} → ${r?.status}`);
  return (await r.json()).data.access_token as string;
}

function tokenFor(user: MovementUser): Promise<string> {
  let t = tokens.get(user);
  if (!t) {
    t = login(user);
    tokens.set(user, t);
    // a failed login must not poison the cache for the next caller
    t.catch(() => tokens.delete(user));
  }
  return t;
}

export interface ApiResult<T> {
  status: number;
  body: T;
  /** Backend error code (`body.error.code`) — the same field the frontend reads. */
  appCode: string;
}

export async function apiSend<T = any>(
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
  user: MovementUser = "admin",
): Promise<ApiResult<T>> {
  const { url, appId } = await getBackend();
  const r = await fetch(`${url}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-app-id": appId,
      Authorization: `Bearer ${await tokenFor(user)}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  const parsed = text ? JSON.parse(text) : null;
  return { status: r.status, body: parsed as T, appCode: parsed?.error?.code ?? "" };
}

/** Read-only GET as `user` (admin by default — it can see every document). */
export function apiGet<T = any>(path: string, user: MovementUser = "admin"): Promise<ApiResult<T>> {
  return apiSend<T>("GET", path, undefined, user);
}

export interface TxDetail {
  qty_in: number;
  qty_out: number;
  cost_per_unit: number;
  total_cost: number;
  location?: { code?: string };
  product?: { code?: string };
}

/**
 * Inventory transaction details a document posted (API `inventory-transactions`, matched by
 * the parent document id) — what "the document moved stock" means, without reading the DB.
 */
export async function txOfDoc(bu: string, docId: string, docNo: string): Promise<TxDetail[]> {
  const { status, body } = await apiGet(`/api/${bu}/inventory-transactions?perpage=100&search=${encodeURIComponent(docNo)}`);
  if (status !== 200) throw new Error(`inventory-transactions ${docNo}: HTTP ${status}`);
  return (body?.data ?? [])
    .filter((t: any) => t.parent_document_id === docId)
    .flatMap((t: any) => t.details ?? []) as TxDetail[];
}
