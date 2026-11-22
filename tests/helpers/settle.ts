import { expect, type Locator, type Page, type Request, type Response } from "@playwright/test";

const WRITE = /^(POST|PUT|PATCH|DELETE)$/;

export interface Submitted {
  /** Write requests the action fired at `urlRe` (empty = the submit was blocked client-side). */
  sent: Request[];
  /** Their responses, in order. */
  responses: Response[];
}

/**
 * Run `action` (a Save / Create / Submit click) and wait for its visible outcome.
 *
 * `outcome` is the UI signal the caller expects (a validation / refusal / success toast or message). It is
 * awaited with an auto-waiting `expect`, so by the time it is visible the app has finished reacting: a blocked
 * form has shown its validation, a sent one has had its response handled. Write requests fired at `urlRe`
 * during the action are collected and their responses awaited.
 */
async function submit(page: Page, urlRe: RegExp, action: () => Promise<unknown>, outcome: Locator): Promise<Submitted> {
  const sent: Request[] = [];
  const on = (r: Request) => {
    if (WRITE.test(r.method()) && urlRe.test(r.url())) sent.push(r);
  };
  page.on("request", on);
  try {
    await action();
    await expect(outcome.first(), "the expected outcome signal never appeared after the action").toBeVisible({ timeout: 15_000 });
    const responses: Response[] = [];
    for (const r of sent) {
      const res = await r.response();
      if (!res) throw new Error(`no response for ${r.method()} ${r.url()}`);
      responses.push(res);
    }
    return { sent, responses };
  } finally {
    page.off("request", on);
  }
}

/** The form refused client-side: `outcome` (validation message) is visible and NO write request was fired. */
export async function expectBlocked(page: Page, urlRe: RegExp, action: () => Promise<unknown>, outcome: Locator): Promise<void> {
  const r = await submit(page, urlRe, action, outcome);
  expect(r.sent.map((q) => `${q.method()} ${q.url()}`), "a write request was sent although the form should have blocked it").toEqual([]);
}

/** The request went out and the backend refused it (4xx): `outcome` (error toast) is visible. Returns the status. */
export async function expectRefused(page: Page, urlRe: RegExp, action: () => Promise<unknown>, outcome: Locator): Promise<number> {
  const r = await submit(page, urlRe, action, outcome);
  expect(r.sent.length, "no write request was sent, expected one the backend refuses").toBeGreaterThan(0);
  const status = r.responses[r.responses.length - 1].status();
  expect(status, "backend did not refuse with a 4xx").toBeGreaterThanOrEqual(400);
  expect(status).toBeLessThan(500);
  return status;
}

/** The write went out and succeeded (2xx): `outcome` (success toast / UI) is visible. */
export async function expectSaved(page: Page, urlRe: RegExp, action: () => Promise<unknown>, outcome: Locator): Promise<Response> {
  const r = await submit(page, urlRe, action, outcome);
  expect(r.sent.length, "no write request was sent, expected a save").toBeGreaterThan(0);
  const res = r.responses[r.responses.length - 1];
  expect(res.status(), "save did not return 2xx").toBeLessThan(300);
  expect(res.status()).toBeGreaterThanOrEqual(200);
  return res;
}

/**
 * Blocked client-side with NO visible message (the FE just does not submit). There is no signal to wait for, so the
 * only evidence is that no write goes out within two paint frames: weaker than `expectBlocked`; `why` records the gap.
 */
export async function expectSilentlyBlocked(page: Page, urlRe: RegExp, action: () => Promise<unknown>, why: string): Promise<void> {
  void why;
  const sent: Request[] = [];
  const on = (r: Request) => {
    if (WRITE.test(r.method()) && urlRe.test(r.url())) sent.push(r);
  };
  page.on("request", on);
  try {
    await action();
    await page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
    expect(sent.map((q) => `${q.method()} ${q.url()}`), "a write request was sent although the form should have blocked it").toEqual([]);
  } finally {
    page.off("request", on);
  }
}
