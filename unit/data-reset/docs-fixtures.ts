// Shared fixtures for the document-seeding tests.
import type { ResetConfig } from "../../scripts/data-reset/config";
import type { SeedContext } from "../../scripts/data-reset/docs/context";
import { TEST_USERS } from "../../tests/test-users";

export const cfg: ResetConfig = {
  backendUrl: "http://h", xAppId: "app", buCode: "GR2VYNKQ", deployToken: "t",
  adminEmail: "carmensoftware.dev+admin@gmail.com",
};

export const users = Object.fromEntries(
  TEST_USERS.map((u) => [u.email, { id: `id-${u.role.toLowerCase()}`, firstname: u.role, middlename: "", lastname: "c" }]),
);

export const email = (role: string) => `carmensoftware.dev+${role}@gmail.com`;

export const ctx: SeedContext = {
  today: "2026-11-05",
  users,
  departments: { first: { id: "dA", name: "Admin" }, second: { id: "dB", name: "Bar" } },
  locations: { first: { id: "l1", name: "1AG01" }, second: { id: "l2", name: "1AG02" } },
  products: Array.from({ length: 10 }, (_, i) => ({ id: `p${i + 1}`, code: `1111000${i}`, unitId: "u-ea" })),
  vendor: { id: "v1", email: "carmensoftware.dev+vendor@gmail.com" },
  currencyId: "thb",
  deliveryPointId: "dp",
  taxProfileId: "tax-none",
  workflows: { pr: "wf-pr", po: "wf-po", sr: "wf-sr" },
  adjustmentTypeId: "adj-in",
};

/** Which account made a call: the fake backend hands out `tok-<email>`. */
export const callerOf = (init?: RequestInit) =>
  ((init?.headers as Record<string, string>)?.Authorization ?? "").replace("Bearer tok-", "");

/**
 * A fake document store for `fakeBackend`'s fallback: POST <list> creates `<kind>N` with one
 * detail line per added line, GET <list>/<id> returns it (doc_version 0), any other write → 200.
 * `failOn("PATCH", /approve$/, 2)` makes the 2nd matching call answer 400.
 */
export function docStore(detailKey: string, noKey: string) {
  const docs = new Map<string, any>();
  const failures: Array<{ method: string; re: RegExp; nth: number; seen: number }> = [];
  let n = 0;
  const fallback = (method: string, path: string, body: any) => {
    for (const f of failures) {
      if (f.method === method && f.re.test(path) && ++f.seen === f.nth) return { __status: 400, message: "boom" };
    }
    const id = path.split("/").pop()!;
    if (method === "GET" && docs.has(id)) return { data: docs.get(id) };
    if (method === "POST" && /\/(purchase-requests|purchase-orders|good-received-notes|credit-notes|store-requisitions|pricelists|pricelist-templates|request-for-pricings|purchase-request-templates)$/.test(path)) {
      const newId = `d${++n}`;
      const added = body?.details?.[detailKey]?.add ?? body?.[detailKey]?.add ?? [];
      const doc = {
        id: newId, doc_version: 0, [noKey]: `NO-${n}`,
        [detailKey]: added.map((l: any, i: number) => ({ id: `${newId}-l${i + 1}`, ...l })),
      };
      docs.set(newId, doc);
      return { data: doc };
    }
    return method === "GET" ? undefined : { data: {} };
  };
  return {
    fallback,
    docs,
    failOn: (method: string, re: RegExp, nth = 1) => failures.push({ method, re, nth, seen: 0 }),
  };
}

/** Writes as "<caller-role> <METHOD> <last two path segments>" for readable sequence asserts. */
export const steps = (writes: Array<{ method: string; path: string; caller: string }>, id?: string) =>
  writes
    .filter((w) => !id || w.path.includes(`/${id}`) || (w.method === "POST" && !w.path.split("/").pop()!.startsWith("d")))
    .map((w) => `${w.caller.split("+")[1]?.split("@")[0]} ${w.method} ${w.path.split("/").slice(-1)[0]}`);
