import { expect, type Page } from "@playwright/test";

/**
 * The switcher label of the BU each page is pinned to, read from the profile it rewrote. The FE
 * shows `alias - name`, or just `name` without an alias (carmen-frontend components/navbar/bu-switcher.tsx);
 * the TEST BUs have no alias, so the label never carries the BU code.
 * label ของปุ่มสลับ BU คือชื่อ BU (มี alias ก็นำหน้า) ไม่มีรหัส BU
 */
const pinnedLabel = new WeakMap<Page, { code: string; label: string }>();
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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
      if (bu.is_default) {
        const alias = String(bu.alias_name ?? "").trim();
        const name = String(bu.name ?? "").trim();
        if (name) pinnedLabel.set(page, { code: buCode, label: alias ? `${alias} - ${name}` : name });
      }
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
  // The switcher's accessible name is the pinned BU's label (see pinnedLabel); the profile is fetched
  // on the first load, so the label is known once the page has asked for it.
  await expect
    .poll(() => pinnedLabel.get(page), { message: `profile of ${bu} not loaded — is the page pinned with pinBusinessUnit?`, timeout: 30_000 })
    .toBeTruthy();
  const pinned = pinnedLabel.get(page)!;
  if (pinned.code !== bu) throw new Error(`gotoBu(${bu}): this page is pinned to ${pinned.code}`);
  const label = pinned.label;
  await expect(page.getByRole("button", { name: new RegExp(`^${escape(label)}$`) }).first()).toBeVisible({ timeout: 30_000 });
}
