// scripts/data-reset/config.ts
import { resolveConfig } from "../seed-master/config";
import { BU_CODE, getPasswordFor } from "../../tests/test-users";

export const ADMIN_EMAIL = "carmensoftware.dev+admin@gmail.com";

export interface ResetConfig {
  backendUrl: string;
  xAppId: string;
  buCode: typeof BU_CODE;
  deployToken: string | undefined;
  adminEmail: string;
}

/**
 * Backend URL and app id are resolved exactly like `seed:master`; the BU and the account are
 * fixed to TEST BU and its admin test user, whatever the old SEED_BU_CODE / SEED_EMAIL say.
 * URL กับ app id หาแบบเดียวกับ seed:master ส่วน BU และบัญชีถูกตรึงไว้ที่ TEST BU และ admin ของชุดเทส
 */
export function resolveResetConfig(env: Record<string, string | undefined> = process.env): ResetConfig {
  const base = resolveConfig({
    ...env,
    SEED_BU_CODE: BU_CODE,
    SEED_EMAIL: ADMIN_EMAIL,
    SEED_PASSWORD: getPasswordFor(ADMIN_EMAIL),
  });
  return {
    backendUrl: base.backendUrl,
    xAppId: base.xAppId,
    buCode: BU_CODE,
    deployToken: env.DATA_RESET_DEPLOY_TOKEN || undefined,
    adminEmail: ADMIN_EMAIL,
  };
}
