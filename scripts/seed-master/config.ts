import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { SeedConfig } from "./types";

const DEFAULT_CONFIG_PATH = "../carmen-frontend/dist/config.json";

export function resolveConfig(
  env: Record<string, string | undefined> = process.env,
): SeedConfig {
  const configPath = env.SEED_CONFIG_PATH ?? DEFAULT_CONFIG_PATH;
  let fileCfg: { BACKEND_URL?: string; X_APP_ID?: string } = {};
  try {
    fileCfg = JSON.parse(readFileSync(resolve(process.cwd(), configPath), "utf8"));
  } catch {
    // config.json is optional when env supplies BACKEND_URL/X_APP_ID
  }

  const backendUrl = (env.SEED_BACKEND_URL ?? fileCfg.BACKEND_URL ?? "").replace(/\/+$/, "");
  const xAppId = env.SEED_X_APP_ID ?? fileCfg.X_APP_ID ?? "";
  const buCode = env.SEED_BU_CODE ?? "";
  const email = env.SEED_EMAIL ?? "";
  const password = env.SEED_PASSWORD ?? "";

  const missing: string[] = [];
  if (!backendUrl) missing.push("SEED_BACKEND_URL (or config.json BACKEND_URL)");
  if (!xAppId) missing.push("SEED_X_APP_ID (or config.json X_APP_ID)");
  if (!buCode) missing.push("SEED_BU_CODE");
  if (!email) missing.push("SEED_EMAIL");
  if (!password) missing.push("SEED_PASSWORD");
  if (missing.length > 0) {
    throw new Error(`Missing required config: ${missing.join(", ")}`);
  }

  return { backendUrl, xAppId, buCode, email, password };
}

export function isLocalHost(backendUrl: string): boolean {
  try {
    const host = new URL(backendUrl).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}
