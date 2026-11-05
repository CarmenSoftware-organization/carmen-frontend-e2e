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
