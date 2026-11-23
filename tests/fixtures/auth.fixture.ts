import { test as base } from "@playwright/test";
import { authFile } from "./auth.paths";
import { pinBusinessUnit } from "../helpers/bu-pin";
import { BU_CODE } from "../test-users";

/**
 * Returns a Playwright `test` whose browser context boots with the
 * given user's persisted cookies. The persisted state is produced
 * once per run by tests/auth.setup.ts (registered as the `setup`
 * Playwright project). Specs that previously relied on the
 * loginWithRetry auto-fixture keep their existing call shape:
 *
 *     const test = createAuthTest("carmensoftware.dev+purchase@gmail.com");
 *
 * `test.use({ bu })` pins the page to another business unit; the default
 * (BU_CODE) leaves the page untouched.
 */
export function createAuthTest(email: string) {
  return base.extend<{ bu: string }>({
    bu: [BU_CODE, { option: true }],
    storageState: authFile(email),
    page: async ({ page, bu }, use) => {
      if (bu !== BU_CODE) await pinBusinessUnit(page, bu);
      await use(page);
    },
  });
}
