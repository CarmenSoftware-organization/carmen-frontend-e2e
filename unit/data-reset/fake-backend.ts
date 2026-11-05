// Shared stub backend for data-reset unit tests: answers login, records every call, and serves
// canned bodies per "METHOD path" (path without the query string).
export interface Call { method: string; path: string; body: unknown; caller: string }

export function fakeBackend(
  routes: Record<string, unknown | ((body: unknown) => unknown)>,
  fallback?: (method: string, path: string, body: unknown) => unknown,
) {
  const calls: Call[] = [];
  const fetchFn = (async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const path = new URL(url).pathname;
    const body = init?.body ? JSON.parse(init.body as string) : undefined;
    if (path === "/api/auth/login") {
      return new Response(JSON.stringify({ data: { access_token: `tok-${(body as { email: string }).email}` } }), { status: 200 });
    }
    const caller = ((init?.headers as Record<string, string>)?.Authorization ?? "").replace("Bearer tok-", "");
    calls.push({ method, path, body, caller });
    const route = routes[`${method} ${path}`];
    const answer =
      typeof route === "function"
        ? (route as (b: unknown) => unknown)(body)
        : route !== undefined
          ? route
          : fallback?.(method, path, body);
    if (answer === undefined) return new Response(JSON.stringify({ data: {} }), { status: method === "GET" ? 404 : 200 });
    const status = (answer as { __status?: number })?.__status ?? 200;
    return new Response(JSON.stringify(answer), { status });
  }) as unknown as typeof fetch;
  const writes = () => calls.filter((c) => c.method !== "GET").map(({ caller: _c, ...rest }) => rest);
  return { fetchFn, calls, writes, writesBy: () => calls.filter((c) => c.method !== "GET") };
}
