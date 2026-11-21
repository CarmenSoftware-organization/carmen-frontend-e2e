import type { Browser, BrowserContext, Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { PurchaseRequestPage, LIST_PATH } from "./purchase-request.page";
import { createDraftPR, type CreatedPR } from "./pr-creator.helpers";
import { BU_CODE } from "../test-users";
import { authFile } from "../fixtures/auth.paths";
import { ensureActiveBu } from "../helpers/bu";

export type { CreatedPR } from "./pr-creator.helpers";

/**
 * Opens an auxiliary BrowserContext pre-authenticated as `email` from the
 * persisted storageState (.auth/<email>.json, written by auth.setup.ts) and
 * runs `fn` with a fresh page in that context. The context is always closed.
 *
 * Using storageState (instead of a fresh UI login via loginWithRetry) avoids
 * a hard hang observed when a second context tried to log in through the UI
 * while the calling test already held its own authenticated context. It is
 * also much faster — no login round-trip — and the BU is pinned to BLAVG once
 * the app has booted so the PR form's BU-dependent lookups have data.
 */
async function withRoleContext<T>(
  browser: Browser,
  email: string,
  fn: (page: Page) => Promise<T>,
): Promise<T> {
  const ctx: BrowserContext = await browser.newContext({
    storageState: authFile(email),
  });
  try {
    const page = await ctx.newPage();
    await ensureActiveBu(page, BU_CODE);
    return await fn(page);
  } finally {
    await ctx.close();
  }
}

/**
 * Cross-context fixture: opens a fresh browser context, logs in as the
 * Requestor, creates a Draft PR with N items, submits it for approval,
 * and returns the PR ref. The auxiliary context is closed cleanly so
 * the calling HOD/FC test's primary context is unaffected.
 *
 * Used in beforeEach of Step 3, 4, Scope Contrast, and Golden Journey.
 */
export async function submitPRAsRequestor(
  browser: Browser,
  opts?: { items?: number; description?: string; quantity?: number; foc?: boolean },
): Promise<CreatedPR> {
  return withRoleContext(browser, "carmensoftware.dev+requestor@gmail.com", async (page) => {
    const created = await createDraftPR(page, {
      items: opts?.items ?? 1,
      description: opts?.description ?? "approver-fixture",
      quantity: opts?.quantity,
      foc: opts?.foc,
    });

    const pr = new PurchaseRequestPage(page);
    await pr.submitButton().click({ timeout: 5_000 });
    await pr.confirmDialogButton(/confirm|submit|ok|yes/i).click({ timeout: 5_000 });
    // A successful submit advances the PR to In Progress and redirects to the
    // list. Wait for that redirect (NOT a toast — the create-success toast can
    // still be on screen and would be a false positive) so the submit has truly
    // persisted before withRoleContext closes this context. Closing too early
    // aborts the in-flight submit and leaves the PR stuck in Draft.
    await page.waitForURL(/\/procurement\/purchase-request(\?|$)/, { timeout: 15_000 });
    return created;
  });
}

/** Wait for the PATCH that a document-level decision sends: `.../purchase-requests/<id>/<action>`. */
function waitForDecision(page: Page, action: "approve" | "reject" | "review") {
  return page.waitForResponse(
    (r) =>
      new RegExp(`/purchase-requests/[^/?]+/${action}(\\?|$)`).test(r.url()) &&
      r.request().method() === "PATCH",
    { timeout: 20_000 },
  );
}

/**
 * Edit Mode → select all rows → Approve (marks the rows) → document-level Approve → confirm.
 * Caller must already be in Edit Mode on a PR detail page. Resolves once PATCH .../approve was
 * accepted and the app is back on the list (the document moved to the next stage).
 *
 * The toolbar "Approve" only marks rows; Save alone persists the marks but leaves the document
 * at the approver's own stage. The decision is the footer's second "Approve" button.
 */
export async function bulkApprove(page: Page, confirm: RegExp = /^approve$/i): Promise<void> {
  const pr = new PurchaseRequestPage(page);
  await pr.selectAllInEditMode();
  await pr.bulkApproveInEditMode().click({ timeout: 5_000 });
  const decided = waitForDecision(page, "approve");
  await pr.documentApproveButton().click({ timeout: 10_000 });
  await pr.confirmDialogButton(confirm).click({ timeout: 10_000 });
  const res = await decided;
  expect(res.ok(), `document Approve was refused (${res.status()})`).toBe(true);
  await page.waitForURL(/\/procurement\/purchase-request(\?|$)/, { timeout: 15_000 });
}

/**
 * Edit Mode → select all rows → Reject (reason dialog marks the rows) → document-level Reject →
 * confirm. Resolves once PATCH .../reject was accepted and the app is back on the list.
 */
export async function bulkReject(page: Page, reason: string): Promise<void> {
  const pr = new PurchaseRequestPage(page);
  await pr.selectAllInEditMode();
  await pr.bulkRejectInEditMode().click({ timeout: 5_000 });
  await pr.reasonInput().fill(reason, { timeout: 10_000 });
  await pr.confirmDialogButton(/^reject$/i).click({ timeout: 10_000 });
  // Let the row-level dialog finish closing: `actionDialog()` takes the first dialog in the DOM, so
  // a still-closing one would swallow the document-level confirm below (seen once in a full run).
  await expect(pr.actionDialog(), "row Reject dialog did not close").toBeHidden({ timeout: 10_000 });
  // Every row now carries the Reject mark; only then does the footer offer the document Reject.
  const decided = waitForDecision(page, "reject");
  await pr.documentRejectButton().click({ timeout: 10_000 });
  await expect(pr.actionDialog(), "document Reject confirm did not open").toBeVisible({ timeout: 10_000 });
  await pr.confirmDialogButton(/^reject$/i).click({ timeout: 10_000 });
  const res = await decided;
  expect(res.ok(), `document Reject was refused (${res.status()})`).toBe(true);
  await page.waitForURL(/\/procurement\/purchase-request(\?|$)/, { timeout: 15_000 });
}

/**
 * Edit Mode → select all rows → Send for Review (marks the rows) → footer "Send Back" → stage
 * radio + reason → confirm. Resolves once PATCH .../review was accepted.
 *
 * Two separate actions, exactly like PO: "Send for Review" opens **no dialog** (each row picks up
 * `aria-label="REVIEW"`); returning the *document* is the footer's **Send Back** button, which
 * only appears once something is marked and carries the stage + reason dialog. Save alone just
 * persists the marks and leaves the document at the approver's own stage.
 */
export async function bulkSendForReview(
  page: Page,
  reason: string,
  stage: string = "",
): Promise<void> {
  const pr = new PurchaseRequestPage(page);
  await pr.selectAllInEditMode();
  await pr.bulkSendForReviewInEditMode().click({ timeout: 10_000 });

  const sendBack = page.getByRole("button", { name: /^send back$/i }).first();
  await expect(sendBack, "document Send Back did not appear after marking items for review").toBeVisible({ timeout: 10_000 });
  await sendBack.click({ timeout: 10_000 });

  const dialog = page.locator('[role="dialog"], [role="alertdialog"]').last();
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  // The dialog lists every stage this PR can go back to; pick the requested one by name
  // (an empty `stage` = the first stage offered, the earliest one the PR can return to).
  const target = dialog.getByRole("radio", { name: new RegExp(stage, "i") }).first();
  await expect(target, `Send Back dialog offers no "${stage || "(any)"}" stage to return to`).toBeVisible({ timeout: 10_000 });
  await target.check({ force: true, timeout: 10_000 });
  await pr.reasonInput().fill(reason, { timeout: 10_000 });

  const confirm = pr.confirmDialogButton(/^send back$/i);
  await expect(confirm).toBeEnabled({ timeout: 10_000 });
  const decided = waitForDecision(page, "review");
  await confirm.click({ timeout: 10_000 });
  const res = await decided;
  expect(res.ok(), `Send Back was refused (${res.status()})`).toBe(true);
}

/**
 * Cross-context helper: opens a fresh BrowserContext as HOD, opens the PR at `ref`, enters Edit
 * Mode and approves every row plus the document — advancing it from HOD stage to Purchase stage.
 * Used by Purchaser tests to seed PRs at the Purchase stage.
 */
export async function approveAsHOD(browser: Browser, ref: string): Promise<void> {
  await withRoleContext(browser, "carmensoftware.dev+hod@gmail.com", async (page) => {
    await gotoPRDetail(page, ref);
    const pr = new PurchaseRequestPage(page);
    await expect(
      pr.editModeButton(),
      `approveAsHOD: no Edit button on PR ${ref} — it is not at the HOD stage`,
    ).toBeVisible({ timeout: 15_000 });
    await pr.enterEditMode();
    await bulkApprove(page);
  });
}

/**
 * Cross-context helper: opens a fresh BrowserContext as HOD, opens the PR at `ref`, enters Edit
 * Mode and sends it back for review to the first stage the dialog offers (the creator's stage).
 * Used by the PR Returned Flow spec to seed PRs the creator gets back.
 */
export async function sendForReviewAsHOD(
  browser: Browser,
  ref: string,
  reason: string = "Please revise — returned for review",
): Promise<void> {
  await withRoleContext(browser, "carmensoftware.dev+hod@gmail.com", async (page) => {
    await gotoPRDetail(page, ref);
    const pr = new PurchaseRequestPage(page);
    await expect(
      pr.editModeButton(),
      `sendForReviewAsHOD: no Edit button on PR ${ref} — it is not at the HOD stage`,
    ).toBeVisible({ timeout: 15_000 });
    await pr.enterEditMode();
    await bulkSendForReview(page, reason);
  });
}

/**
 * Navigates to a PR detail page in HOD's primary context (or current page).
 */
export async function gotoPRDetail(page: Page, ref: string): Promise<void> {
  await page.goto(`${LIST_PATH}/${ref}`);
  await page.waitForLoadState("networkidle");
}


/**
 * On an open PR detail page as the stage's approver: Edit -> select every item row.
 * Approve / Reject / Send for Review / Split are *bulk item actions* of edit mode — the
 * view page offers just Edit and More, and Edit itself only shows for the user whose stage
 * the PR sits at. Fails with that reason instead of timing out on a button that never comes.
 */
export async function enterApproverEditMode(page: Page): Promise<PurchaseRequestPage> {
  const pr = new PurchaseRequestPage(page);
  await expect(
    pr.editModeButton(),
    "PR is not at this role's approval stage — no Edit available",
  ).toBeVisible({ timeout: 15_000 });
  await pr.enterEditMode();
  await pr.selectAllInEditMode();
  return pr;
}

/** Approve every item of the open PR (bulk Approve + Save) and wait for the write to be accepted. */
export async function approveOpenPR(page: Page): Promise<void> {
  const pr = await enterApproverEditMode(page);
  await pr.bulkApproveInEditMode().click({ timeout: 10_000 });
  const written = page.waitForResponse(
    (r) => /\/purchase-requests\/[^/?]+/.test(r.url()) && ["PATCH", "PUT"].includes(r.request().method()),
    { timeout: 20_000 },
  );
  await pr.saveEditMode();
  const res = await written;
  expect(res.ok(), `saving the approval was refused (${res.status()})`).toBe(true);
}

/**
 * Open the document-level "Send Back" dialog: Edit -> select all -> bulk Review -> Send Back,
 * with the first stage radio chosen. Returns the dialog so a case can fill / leave the reason
 * and confirm.
 */
export async function openSendBackDialog(page: Page): Promise<Locator> {
  const pr = await enterApproverEditMode(page);
  await pr.bulkSendForReviewInEditMode().click({ timeout: 10_000 });
  const sendBack = page.getByRole("button", { name: /^send back$/i }).first();
  await expect(sendBack, "document Send Back did not appear after marking items for review").toBeVisible({ timeout: 10_000 });
  await sendBack.click({ timeout: 10_000 });
  const dialog = page.locator('[role="dialog"], [role="alertdialog"]').last();
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  const stage = dialog.getByRole("radio").first();
  await expect(stage, "Send Back dialog offers no stage to return to").toBeVisible({ timeout: 10_000 });
  await stage.check({ force: true, timeout: 10_000 });
  return dialog;
}

/**
 * Edit mode: tick the first item row only and press Split; resolves with the POST .../split response.
 * Split moves the ticked saved lines to a new PR, so it needs a PR with at least two lines — ticking
 * every line is refused with 400 (verified against dev, 2026-11-21).
 */
export async function splitFirstItem(page: Page) {
  const pr = new PurchaseRequestPage(page);
  await page.locator("tbody tr").first().getByRole("checkbox").first().click({ timeout: 10_000 });
  const split = pr.bulkSplitInEditMode();
  await expect(split, "Split stays disabled after ticking a row").toBeEnabled({ timeout: 10_000 });
  const response = page.waitForResponse(
    (r) => /\/purchase-requests\/[^/?]+\/split/.test(r.url()) && r.request().method() === "POST",
    { timeout: 20_000 },
  );
  await split.click({ timeout: 5_000 });
  return response;
}
