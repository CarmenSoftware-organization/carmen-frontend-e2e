// Shared stub backend for data-reset unit tests: answers login, records every call, and serves
// canned bodies per "METHOD path" (path without the query string).
export interface Call { method: string; path: string; body: unknown }

export function fakeBackend(routes: Record<string, unknown | ((body: unknown) => unknown)>) {
  const calls: Call[] = [];
  const fetchFn = (async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const path = new URL(url).pathname;
    const body = init?.body ? JSON.parse(init.body as string) : undefined;
    if (path === "/api/auth/login") {
      return new Response(JSON.stringify({ data: { access_token: `tok-${(body as { email: string }).email}` } }), { status: 200 });
    }
    calls.push({ method, path, body });
    const route = routes[`${method} ${path}`];
    const answer = typeof route === "function" ? (route as (b: unknown) => unknown)(body) : route;
    if (answer === undefined) return new Response(JSON.stringify({ data: {} }), { status: method === "GET" ? 404 : 200 });
    const status = (answer as { __status?: number })?.__status ?? 200;
    return new Response(JSON.stringify(answer), { status });
  }) as unknown as typeof fetch;
  return { fetchFn, calls, writes: () => calls.filter((c) => c.method !== "GET") };
}
