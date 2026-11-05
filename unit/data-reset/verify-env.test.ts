import { describe, it, expect } from "vitest";
import {
  REQUIRED_PURCHASE_PERMISSIONS,
  checkMembership,
  missingPermissions,
  verifyEnvironment,
} from "../../scripts/data-reset/verify-env";
import { createSessions } from "../../scripts/data-reset/sessions";
import type { ResetConfig } from "../../scripts/data-reset/config";
import { TEST_USERS } from "../../tests/test-users";

const cfg: ResetConfig = {
  backendUrl: "http://h", xAppId: "app", buCode: "GR2VYNKQ", deployToken: "t",
  adminEmail: "carmensoftware.dev+admin@gmail.com",
};

const profile = (units: Array<{ id: string; code: string; is_default: boolean }>, id = "user-1") => ({
  data: { id, business_unit: units },
});

describe("checkMembership", () => {
  it("passes a member whose default BU is TEST BU", () => {
    expect(checkMembership("a@x", profile([{ id: "b", code: "GR2VYNKQ", is_default: true }]), "GR2VYNKQ")).toBeNull();
  });

  it("names the BU that is default instead", () => {
    const body = profile([
      { id: "b", code: "GR2VYNKQ", is_default: false },
      { id: "c", code: "CARMEN-AVG", is_default: true },
    ]);
    expect(checkMembership("a@x", body, "GR2VYNKQ")).toBe("a@x: default BU is CARMEN-AVG, not GR2VYNKQ");
  });

  it("reports a non-member", () => {
    expect(checkMembership("a@x", profile([{ id: "c", code: "OTHER", is_default: true }]), "GR2VYNKQ")).toBe(
      "a@x: not a member of GR2VYNKQ",
    );
  });
});

describe("missingPermissions", () => {
  it("is satisfied by any role and lists what no role grants", () => {
    const roles = [
      { permissions: [{ resource: "vendor_management.vendor", action: "view", is_granted: true }] },
      { permissions: [{ resource: "product_management.category", action: "view", is_granted: false }] },
    ];
    expect(missingPermissions(roles, REQUIRED_PURCHASE_PERMISSIONS)).toEqual([
      "product_management.category.view",
      "vendor_management.request_price_list.view",
    ]);
  });
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("verifyEnvironment", () => {
  it("collects one problem per account and records every user id", async () => {
    const granted = REQUIRED_PURCHASE_PERMISSIONS.map((key) => {
      const action = key.slice(key.lastIndexOf(".") + 1);
      return { resource: key.slice(0, key.lastIndexOf(".")), action, is_granted: true };
    });
    const tokenOf: Record<string, string> = {};
    const fakeFetch = (async (url: string, init?: RequestInit) => {
      if (url.endsWith("/api/auth/login")) {
        const email = JSON.parse(init!.body as string).email as string;
        tokenOf[`Bearer tok-${email}`] = email;
        return jsonResponse(200, { data: { access_token: `tok-${email}` } });
      }
      const email = tokenOf[(init!.headers as Record<string, string>).Authorization];
      if (url.endsWith("/api/user/profile")) {
        const isHod = email === "carmensoftware.dev+hod@gmail.com";
        return jsonResponse(200, profile([{ id: "bu-1", code: "GR2VYNKQ", is_default: !isHod }], `id-${email}`));
      }
      if (url.includes("/user-application-roles/")) {
        return jsonResponse(200, { data: { application_roles: [{ application_role_id: "r1" }] } });
      }
      if (url.includes("/application-roles/r1")) {
        return jsonResponse(200, { data: { permissions: granted } });
      }
      return jsonResponse(404, {});
    }) as unknown as typeof fetch;

    const result = await verifyEnvironment(createSessions(cfg, fakeFetch), cfg);
    expect(result.problems).toEqual(["carmensoftware.dev+hod@gmail.com: default BU is (none), not GR2VYNKQ"]);
    expect(Object.keys(result.userIds)).toHaveLength(TEST_USERS.length);
    expect(result.userIds["carmensoftware.dev+purchase@gmail.com"]).toBe("id-carmensoftware.dev+purchase@gmail.com");
    expect(result.buId).toBe("bu-1");
  });

  it("reports purchase's missing permissions", async () => {
    const fakeFetch = (async (url: string) => {
      if (url.endsWith("/api/auth/login")) return jsonResponse(200, { data: { access_token: "tok" } });
      if (url.endsWith("/api/user/profile")) return jsonResponse(200, profile([{ id: "bu-1", code: "GR2VYNKQ", is_default: true }]));
      if (url.includes("/user-application-roles/")) return jsonResponse(200, { data: { application_roles: [{ application_role_id: "r1" }] } });
      if (url.includes("/application-roles/r1")) return jsonResponse(200, { data: { permissions: [] } });
      return jsonResponse(404, {});
    }) as unknown as typeof fetch;
    const result = await verifyEnvironment(createSessions(cfg, fakeFetch), cfg);
    expect(result.problems).toHaveLength(3);
    expect(result.problems[0]).toBe(
      "purchase lacks vendor_management.vendor.view in GR2VYNKQ — grant it once in the purchase role (platform schema, survives every reset)",
    );
  });
});
