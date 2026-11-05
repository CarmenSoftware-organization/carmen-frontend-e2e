import { describe, it, expect } from "vitest";
import {
  checkMasterShape,
  planDepartmentAssignments,
  planLocationAssignments,
  seedMappings,
} from "../../scripts/data-reset/mappings";
import { createSessions } from "../../scripts/data-reset/sessions";
import type { ResetConfig } from "../../scripts/data-reset/config";
import { TEST_USERS } from "../../tests/test-users";
import { fakeBackend } from "./fake-backend";

const cfg: ResetConfig = {
  backendUrl: "http://h", xAppId: "app", buCode: "GR2VYNKQ", deployToken: "t",
  adminEmail: "carmensoftware.dev+admin@gmail.com",
};
const userIds = Object.fromEntries(TEST_USERS.map((u) => [u.email, `id-${u.email.split("+")[1].split("@")[0]}`]));

describe("planDepartmentAssignments", () => {
  it("puts everyone in the first department by code with hod as HOD, and owner in the second", () => {
    const plans = planDepartmentAssignments(
      [{ id: "dB", code: "B", name: "Bar" }, { id: "dA", code: "A", name: "Admin" }],
      userIds,
    );
    expect(plans[0].departmentId).toBe("dA");
    expect(plans[0].body.department_users.add).toHaveLength(9);
    expect(plans[0].body.hod_users).toEqual({ add: [{ id: "id-hod" }] });
    expect(plans[1]).toEqual({ departmentId: "dB", body: { department_users: { add: [{ id: "id-owner" }] } } });
  });

  it("needs two departments", () => {
    expect(() => planDepartmentAssignments([{ id: "d", code: "A", name: "A" }], userIds)).toThrow(/2 departments/);
  });
});

describe("planLocationAssignments", () => {
  it("gives every user every location", () => {
    const plans = planLocationAssignments(["l1", "l2"], userIds);
    expect(plans).toHaveLength(9);
    expect(plans.every((p) => JSON.stringify(p.body) === JSON.stringify({ location_ids: ["l1", "l2"] }))).toBe(true);
  });
});

describe("checkMasterShape", () => {
  it("reports too few departments and a first vendor without email", () => {
    expect(checkMasterShape({ departments: 1, locations: 2, firstVendor: { code: "A001", email: null } })).toEqual([
      "master data has 1 department(s); the specs need at least 2",
      "first vendor A001 has no email; the PO send-to-vendor flow needs one",
    ]);
  });

  it("passes the minimum shape", () => {
    expect(checkMasterShape({ departments: 2, locations: 2, firstVendor: { code: "A001", email: "a@x" } })).toEqual([]);
  });

  it("reports a BU with no vendor", () => {
    expect(checkMasterShape({ departments: 2, locations: 2, firstVendor: null })).toEqual(["master data has no vendor"]);
  });
});

describe("seedMappings", () => {
  const base = "/api/config/GR2VYNKQ";
  const routes = {
    [`GET ${base}/departments`]: { data: [{ id: "dB", code: "B", name: "Bar" }, { id: "dA", code: "A", name: "Admin" }] },
    [`GET ${base}/locations`]: { data: [{ id: "l1", code: "L1" }, { id: "l2", code: "L2" }] },
    [`GET ${base}/vendors`]: { data: [{ id: "v2", code: "B002" }, { id: "v1", code: "A001" }] },
    [`GET ${base}/vendors/v1`]: { data: { id: "v1", code: "A001", vendor_contact: [{ email: "a@x" }] } },
  };

  it("patches both departments, puts every user's locations and returns the first department", async () => {
    const backend = fakeBackend(routes);
    const result = await seedMappings(createSessions(cfg, backend.fetchFn), cfg, userIds);
    expect(result.failed).toEqual([]);
    expect(result.firstDepartment).toEqual({ id: "dA", name: "Admin" });
    const writes = backend.writes().map((c) => `${c.method} ${c.path}`);
    expect(writes.slice(0, 2)).toEqual([`PATCH ${base}/departments/dA`, `PATCH ${base}/departments/dB`]);
    expect(writes.filter((w) => w.startsWith(`PUT ${base}/locations-users/`))).toHaveLength(9);
  });

  it("writes nothing when master data is short", async () => {
    const backend = fakeBackend({ ...routes, [`GET ${base}/locations`]: { data: [{ id: "l1", code: "L1" }] } });
    const result = await seedMappings(createSessions(cfg, backend.fetchFn), cfg, userIds);
    expect(result.failed).toEqual(["master data has 1 location(s); the specs need at least 2"]);
    expect(backend.writes()).toEqual([]);
  });

  it("records a failed write and carries on", async () => {
    const backend = fakeBackend({ ...routes, [`PATCH ${base}/departments/dB`]: { __status: 400, message: "bad" } });
    const result = await seedMappings(createSessions(cfg, backend.fetchFn), cfg, userIds);
    expect(result.failed).toEqual([`PATCH ${base}/departments/dB → 400`]);
    expect(result.created).toBe(10);
  });
});
