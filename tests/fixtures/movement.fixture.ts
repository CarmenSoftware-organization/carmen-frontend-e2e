import { test as base, expect } from "@playwright/test";
import { authFile } from "./auth.paths";
import { MOVEMENT_USERS, type MovementUser } from "../movement-users";
import { Signals } from "../helpers/movement/signals";
import { pinBusinessUnit, gotoBu } from "../helpers/bu-pin";

/**
 * `test` for the movement suite.
 *
 *   test.use({ user: "requestor", bu: "CARMEN-AVG" });
 *
 * - `user`    — which movement account's storageState the context boots from
 *               (written by the `movement-setup` project)
 * - `bu`      — business unit pinned for this page (see pinBusinessUnit)
 * - `signals` — front-end bug signals (auto); the test fails on any page error or
 *               unexpected API ≥ 400 the case did not declare
 * - `failOnSignals` — false records the signals without failing (period close drives
 *               refusals on purpose — Start blocked 422, void 409 — and checks the
 *               backend's answers itself, as the suite it came from did)
 */
export const test = base.extend<{ bu: string; user: MovementUser; signals: Signals; failOnSignals: boolean }>({
  bu: ["CARMEN-AVG", { option: true }],
  user: ["admin", { option: true }],
  failOnSignals: [true, { option: true }],
  storageState: async ({ user }, use) => use(authFile(MOVEMENT_USERS[user].email)),
  page: async ({ page, bu }, use) => {
    await pinBusinessUnit(page, bu);
    await use(page);
  },
  // auto: every case is checked, including those that never mention `signals`.
  signals: [
    async ({ page, failOnSignals }, use, testInfo) => {
      const s = new Signals(page);
      // Front-end telemetry fails whenever dev hiccups — unrelated to the document under test.
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

export { expect, pinBusinessUnit, gotoBu };
