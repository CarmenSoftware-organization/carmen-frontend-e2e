import type { Page, Request } from "@playwright/test";

const WRITE = /^(POST|PUT|PATCH|DELETE)$/;

/**
 * Run `action` (a Save / Create / Submit click) and wait until its outcome is in, without a fixed sleep.
 *
 * The write requests the action fires at `urlRe` are collected; if any, each one's response is awaited.
 * If none is fired (the form blocked the submit client-side), two paint frames are flushed so the
 * validation pass has run before the caller's own assertions read the result. Either way the caller
 * still asserts the outcome (toast, URL, backend state) — this only guarantees it has settled.
 */
export async function settleAfter(page: Page, urlRe: RegExp, action: () => Promise<unknown>): Promise<number[]> {
  const sent: Request[] = [];
  const on = (r: Request) => {
    if (WRITE.test(r.method()) && urlRe.test(r.url())) sent.push(r);
  };
  page.on("request", on);
  try {
    await action();
    await page.evaluate(
      () => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(done, 0)))),
    );
    const statuses: number[] = [];
    for (const r of sent) statuses.push((await r.response())?.status() ?? 0);
    return statuses;
  } finally {
    page.off("request", on);
  }
}
