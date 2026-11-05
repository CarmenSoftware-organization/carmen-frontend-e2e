// scripts/data-reset/sessions.ts
// One login per account per run — the backend answers 429 after 3 failed logins.
// login ครั้งเดียวต่อบัญชีต่อรอบ — backend ตอบ 429 หลัง login ผิด 3 ครั้ง
import { createApiClient, login, type ApiClient } from "../seed-master/api-client";
import { getPasswordFor } from "../../tests/test-users";
import type { ResetConfig } from "./config";

export interface Sessions {
  client(email: string): Promise<ApiClient>;
}

export function createSessions(cfg: ResetConfig, fetchFn: typeof fetch = fetch): Sessions {
  const cache = new Map<string, Promise<ApiClient>>();
  return {
    client(email) {
      const cached = cache.get(email);
      if (cached) return cached;
      const seedCfg = {
        backendUrl: cfg.backendUrl,
        xAppId: cfg.xAppId,
        buCode: cfg.buCode,
        email,
        password: getPasswordFor(email),
      };
      const pending = login(seedCfg, fetchFn).then((token) => createApiClient(seedCfg, token, fetchFn));
      pending.catch(() => cache.delete(email));
      cache.set(email, pending);
      return pending;
    },
  };
}
