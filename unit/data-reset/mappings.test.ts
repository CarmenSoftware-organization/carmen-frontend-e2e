import { describe, it, expect } from "vitest";
import {
  checkMasterShape,
  ensureFirstVendorReady,
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
      [{ id: "dB", code: "B", name: "Bar", doc_version: 4 }, { id: "dA", code: "A", name: "Admin", doc_version: 2 }],
      userIds,
    );
    expect(plans[0].departmentId).toBe("dA");
    expect(plans[0].body.department_users.add).toHaveLength(9);
    expect(plans[0].body.hod_users).toEqual({ add: [{ id: "id-hod" }] });
    // The gateway's department update requires the doc_version last read (400 without it).
    expect(plans[0].body.doc_version).toBe(2);
    expect(plans[1]).toEqual({
      departmentId: "dB",
      // A PR's HOD stage needs a HOD in its department — without one the submit fails with 503.
      body: { doc_version: 4, department_users: { add: [{ id: "id-owner" }] }, hod_users: { add: [{ id: "id-hod" }] } },
    });
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

describe("ensureFirstVendorReady", () => {
  const base = "/api/config/GR2VYNKQ";
  const list = { data: [{ id: "v2", code: "B002" }, { id: "v1", code: "A023" }] };
  const admin = async (backend: ReturnType<typeof fakeBackend>) =>
    createSessions(cfg, backend.fetchFn).client(cfg.adminEmail);

  it("adds an email to the first vendor by code when it has none", async () => {
    const backend = fakeBackend({
      [`GET ${base}/vendors`]: list,
      [`GET ${base}/vendors/v1`]: { data: { id: "v1", code: "A023", doc_version: 3, vendor_contact: [] } },
    });
    expect(await ensureFirstVendorReady(await admin(backend), cfg)).toEqual([]);
    // The gateway updates a vendor with PUT (PATCH is 404) and requires doc_version.
    expect(backend.writes()).toEqual([
      {
        method: "PUT",
        path: `${base}/vendors/v1`,
        body: {
          doc_version: 3,
          vendor_contact: {
            add: [{ name: "STD contact", email: "carmensoftware.dev+vendor@gmail.com", phone: "0800000000", is_primary: true }],
          },
        },
      },
    ]);
  });

  it("fills the email on the vendor's existing contact instead of adding one", async () => {
    // The sample workbook gives A023 a primary contact with email "". The backend's update path
    // creates added contacts without vendor_id (they never show on the vendor), so set it via update.
    const backend = fakeBackend({
      [`GET ${base}/vendors`]: list,
      [`GET ${base}/vendors/v1`]: {
        data: { id: "v1", code: "A023", doc_version: 1, vendor_contact: [{ id: "c1", name: "บจก. เอบีโอ", email: "", is_primary: true }] },
      },
    });
    expect(await ensureFirstVendorReady(await admin(backend), cfg)).toEqual([]);
    expect(backend.writes()).toEqual([
      {
        method: "PUT",
        path: `${base}/vendors/v1`,
        body: {
          doc_version: 1,
          vendor_contact: { update: [{ vendor_contact_id: "c1", name: "บจก. เอบีโอ", email: "carmensoftware.dev+vendor@gmail.com" }] },
        },
      },
    ]);
  });

  it("leaves a vendor that already has an email alone", async () => {
    const backend = fakeBackend({
      [`GET ${base}/vendors`]: list,
      [`GET ${base}/vendors/v1`]: { data: { id: "v1", code: "A023", vendor_contact: [{ email: "a@x" }] } },
    });
    expect(await ensureFirstVendorReady(await admin(backend), cfg)).toEqual([]);
    expect(backend.writes()).toEqual([]);
  });

  it("reports a refused update", async () => {
    const backend = fakeBackend({
      [`GET ${base}/vendors`]: list,
      [`GET ${base}/vendors/v1`]: { data: { id: "v1", code: "A023" } },
      [`PUT ${base}/vendors/v1`]: { __status: 400 },
    });
    expect(await ensureFirstVendorReady(await admin(backend), cfg)).toEqual([
      "first vendor A023: could not add an email (400)",
    ]);
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
