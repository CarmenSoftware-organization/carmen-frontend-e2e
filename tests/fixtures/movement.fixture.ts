import { test as base, expect, type Page } from "@playwright/test";
import { authFile } from "./auth.paths";
import { MOVEMENT_USERS, type MovementUser } from "../movement-users";
import { Signals } from "../helpers/movement/signals";

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
export async function pinBusinessUnit(page: Page, buCode: string): Promise<void> {
  // Switches BU in this browser only, by rewriting `is_default` in the profile
  // response. The real BU switcher saves the default on the account, which would
  // move every other session of the same user (ensureActiveBu accepts that for
  // the gmail accounts; these accounts are shared with people testing by hand).
  // content-encoding/content-length must be dropped before fulfill, or the browser
  // fails to decode the rewritten body and login hangs.
  await page.route(/\/api\/user\/profile$/, async (route) => {
    let resp: Awaited<ReturnType<typeof route.fetch>> | null = null;
    let lastError: unknown = null;
    // Retry a dropped dev connection (ECONNRESET / socket hang up), 429 or 5xx —
    // unanswered, the app spins on its loader forever although nothing is broken.
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        resp = await route.fetch();
        if (resp.status() !== 429 && resp.status() < 500) break;
      } catch (error) {
        lastError = error;
        resp = null;
      }
      await new Promise((done) => setTimeout(done, 1500 * (attempt + 1)));
    }
    if (!resp) {
      // Abort so the app shows its "Couldn't load your profile" retry state instead of a silent spinner.
      console.warn(`[pinBusinessUnit] profile fetch failed after retries: ${String(lastError)}`);
      await route.abort("connectionreset");
      return;
    }
    const body = await resp.json();
    for (const bu of body?.data?.business_unit ?? []) {
      bu.is_default = bu.code === buCode;
    }
    const headers = Object.fromEntries(
      Object.entries(resp.headers()).filter(([k]) => !["content-encoding", "content-length"].includes(k.toLowerCase())),
    );
    await route.fulfill({ status: resp.status(), headers, body: JSON.stringify(body) });
  });
}

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

/** Navigate, then wait until the header shows the intended BU — never post a document into the wrong BU. */
export async function gotoBu(page: Page, path: string, bu: string): Promise<void> {
  await page.goto(path);
  // The BU switcher button reads "<short name> - <BU code>" (it no longer sits in a <header> landmark).
  await expect(page.getByRole("button", { name: new RegExp(`- ${bu}$`) }).first()).toBeVisible({ timeout: 30_000 });
}

/** Record what was actually observed — shows in the HTML report next to the case. */
export async function observed(text: string): Promise<void> {
  await test.info().attach("observed", { body: text, contentType: "text/plain" });
}

export { expect };
