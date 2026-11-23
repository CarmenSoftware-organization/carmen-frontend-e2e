import { expect, type Page } from "@playwright/test";

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

/** Navigate, then wait until the header shows the intended BU — never post a document into the wrong BU. */
export async function gotoBu(page: Page, path: string, bu: string): Promise<void> {
  await page.goto(path);
  // The BU switcher button reads "<short name> - <BU code>" (it no longer sits in a <header> landmark).
  await expect(page.getByRole("button", { name: new RegExp(`- ${bu}$`) }).first()).toBeVisible({ timeout: 30_000 });
}
