import { describe, it, expect } from "vitest";
import { resolveResetConfig } from "../../scripts/data-reset/config";

describe("resolveResetConfig", () => {
  it("fixes the BU and the admin account, and reads the deploy token", () => {
    expect(
      resolveResetConfig({ SEED_BACKEND_URL: "https://h", SEED_X_APP_ID: "a", DATA_RESET_DEPLOY_TOKEN: "t" }),
    ).toEqual({
      backendUrl: "https://h", xAppId: "a", buCode: "GR2VYNKQ", deployToken: "t",
      adminEmail: "carmensoftware.dev+admin@gmail.com",
    });
  });

  it("ignores SEED_BU_CODE and SEED_EMAIL from the old seed target", () => {
    const cfg = resolveResetConfig({
      SEED_BACKEND_URL: "https://h", SEED_X_APP_ID: "a", SEED_BU_CODE: "BLAVG", SEED_EMAIL: "admin@blueledgers.com",
    });
    expect(cfg.buCode).toBe("GR2VYNKQ");
    expect(cfg.adminEmail).toBe("carmensoftware.dev+admin@gmail.com");
  });

  it("leaves deployToken undefined when not set", () => {
    expect(resolveResetConfig({ SEED_BACKEND_URL: "https://h", SEED_X_APP_ID: "a" }).deployToken).toBeUndefined();
  });

  it("still requires a backend URL", () => {
    expect(() => resolveResetConfig({ SEED_CONFIG_PATH: "/nonexistent.json", SEED_X_APP_ID: "a" })).toThrow(/SEED_BACKEND_URL/);
  });
});
