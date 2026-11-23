import { test as base, expect } from "@playwright/test";
import { authFile } from "./auth.paths";
import { TEST_USERS, BU_CODE } from "../test-users";
import type { Role } from "../helpers/bu-api";
import { Signals } from "../helpers/movement/signals";
import { pinBusinessUnit, gotoBu } from "../helpers/bu-pin";

/**
 * `test` for the doc-flow suite on the TEST business units.
 *
 *   test.use({ role: "Admin", bu: "BU-GR2VYNKQ" });
 *
 * - `role` — which TEST_USERS account's storageState the context boots from
 * - `bu`   — business unit pinned for this page (skipped for the default BU_CODE)
 * - `signals` / `failOnSignals` — same front-end bug signals as the movement fixture
 */
export const test = base.extend<{ role: Role; bu: string; signals: Signals; failOnSignals: boolean }>({
  role: ["Admin", { option: true }],
  bu: [BU_CODE, { option: true }],
  failOnSignals: [true, { option: true }],
  storageState: async ({ role }, use) => use(authFile(TEST_USERS.find((u) => u.role === role)!.email)),
  page: async ({ page, bu }, use) => {
    if (bu !== BU_CODE) await pinBusinessUnit(page, bu);
    await use(page);
  },
  signals: [
    async ({ page, failOnSignals }, use, testInfo) => {
      const s = new Signals(page);
      s.minor(/\/api\/analytics-events → (401|5\d\d)/, "telemetry failed (dev hiccup)");
      await use(s);
      await page.waitForTimeout(800).catch(() => undefined); // late responses still arriving
      if (s.items.length) {
        await testInfo.attach("fe-signals", { body: JSON.stringify(s.items, null, 2), contentType: "application/json" });
      }
      const hard = s.hard;
      if (hard.length && failOnSignals) {
        throw new Error(`front-end signals: ${hard.map((x) => `[${x.kind}] ${x.text}`).join(" | ").slice(0, 800)}`);
      }
    },
    { auto: true },
  ],
});

/** Record what was actually observed — shows in the HTML report next to the case. */
export async function observed(text: string): Promise<void> {
  await test.info().attach("observed", { body: text, contentType: "text/plain" });
}

export { expect, gotoBu };
