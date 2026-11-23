// scripts/data-reset/config.ts
import { resolveConfig } from "../seed-master/config";
import { BU_CODE, getPasswordFor, type TestBuCode } from "../../tests/test-users";

export const ADMIN_EMAIL = "carmensoftware.dev+admin@gmail.com";

export interface ResetConfig {
  backendUrl: string;
  xAppId: string;
  buCode: TestBuCode;
  deployToken: string | undefined;
  adminEmail: string;
}

/**
 * Backend URL and app id are resolved exactly like `seed:master`; the BU is one of the TEST BUs (default BU-GR2VYNKQ) and the account is
 * its admin test user, whatever the old SEED_BU_CODE / SEED_EMAIL say.
 * URL กับ app id หาแบบเดียวกับ seed:master ส่วน BU และบัญชีถูกตรึงไว้ที่ TEST BU และ admin ของชุดเทส
 */
export function resolveResetConfig(
  env: Record<string, string | undefined> = process.env,
  buCode: TestBuCode = BU_CODE,
): ResetConfig {
  const base = resolveConfig({
    ...env,
    SEED_BU_CODE: buCode,
    SEED_EMAIL: ADMIN_EMAIL,
    SEED_PASSWORD: getPasswordFor(ADMIN_EMAIL),
  });
  return {
    backendUrl: base.backendUrl,
    xAppId: base.xAppId,
    buCode,
    deployToken: env.DATA_RESET_DEPLOY_TOKEN || undefined,
    adminEmail: ADMIN_EMAIL,
  };
}
