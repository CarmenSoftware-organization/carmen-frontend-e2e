import type { Browser, BrowserContext, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { PurchaseOrderPage, LIST_PATH } from "./purchase-order.page";
import { BU_CODE } from "../test-users";
import { authFile } from "../fixtures/auth.paths";
import { ensureActiveBu } from "../helpers/bu";

export interface CreatedPO {
  /** Record id (uuid) from the detail URL. */
  ref: string;
  url: string;
  /** Human document number ("PO26110001") shown in the header and list rows. */
  poNo: string;
}

/**
 * Opens an auxiliary BrowserContext pre-authenticated as `email` from the
 * persisted storageState (.auth/<email>.json, written by auth.setup.ts) and runs
 * `fn` with a fresh page in that context. The context is always closed.
 *
 * Booting from storageState instead of logging in through the UI is what keeps
 * this usable from inside a test: a second context that tries a UI login while
 * the calling test already holds its own authenticated context hangs hard — the
 * PO journeys burned their whole timeout on exactly that, with no error to point
 * at. The same fix already lives in pr-approver.helpers.ts. It is also far
 * faster, and pinning the BU to BLAVG here gives the PO form's BU-dependent
 * lookups (workflow, vendor, location) data to work with.
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

/** Fill the PO form and save, leaving the record in Draft. Shared by the seeders. */
async function createDraftOnPage(
  page: Page,
  opts: { description?: string; vendor?: string } | undefined,
  who: string,
): Promise<CreatedPO> {
  const po = new PurchaseOrderPage(page);
  await po.gotoNew();
  await expect(page).toHaveURL(/purchase-order\/new/, { timeout: 10_000 });

  // addItemToPO (on a blank form) picks the workflow, the vendor and the delivery date.
  // `opts.vendor` was only ever typed into a trigger that is a dialog button now, so it
  // is not honoured: fail loudly rather than silently seed with the wrong vendor.
  if (opts?.vendor) {
    throw new Error(`${who}: opts.vendor is not supported — the vendor is picked from a dialog (first vendor)`);
  }
  const desc = po.descriptionInput();
  await expect(desc, `${who}: Description input not present`).toBeVisible({ timeout: 10_000 });
  await desc.fill(opts?.description ?? "[E2E-POP] approver-fixture");

  await po.addItemToPO({ product: "Test Item", quantity: 1, uom: "ea", unitPrice: 100 });

  await po.saveButton().click({ timeout: 10_000 });
  await page.waitForURL(/purchase-order\/(?!new$)[^\/?#]+$/, { timeout: 20_000 }).catch(() => {
    // fall through: the explicit URL check below reports what the page is actually on
  });

  const url = page.url();
  if (url.endsWith("/new") || url.includes("/new?")) {
    throw new Error(`${who}: save did not redirect — still on ${url}. PO was not created.`);
  }
  const ref = url.match(/purchase-order\/([^\/?#]+)/)?.[1];
  if (!ref || ref === "new") {
    throw new Error(`${who}: could not extract PO ref from URL: ${url}`);
  }
  // Lists and the approval inbox show the document number, never the uuid in the URL.
  // BE #1108: a saved draft holds DRAFT-NNNNNNNN; the real PO number is reserved at first submit.
  const poNo = (await page.getByText(/^DRAFT-\d{8}$/).first().textContent({ timeout: 15_000 }))?.trim() ?? "";
  if (!poNo) throw new Error(`${who}: could not read the PO number for ${ref}`);
  return { ref, url, poNo };
}

/**
 * Seed a PO that is still in **Draft**. Tests about the creator's own draft
 * (Edit / Delete / Submit visible, edit-mode behaviour) need this: once a PO is
 * submitted the backend hands its creator `role = "view_only"` and those buttons
 * are gone, so seeding with submitPOAsPurchaser made them assert the impossible.
 */
export async function createDraftPOAsPurchaser(
  browser: Browser,
  opts?: { description?: string; vendor?: string },
): Promise<CreatedPO> {
  return await withRoleContext(browser, "carmensoftware.dev+purchase@gmail.com", (page) =>
    createDraftOnPage(page, opts, "createDraftPOAsPurchaser"),
  );
}

/**
 * Cross-context helper: opens a fresh BrowserContext, logs in as Purchaser,
 * creates a Draft PO with header + 1 item, submits it for approval, and
 * returns the PO ref. The auxiliary context is closed cleanly so the
 * calling test's primary context is unaffected.
 *
 * Used by Step 5 post-approval and Golden Journey to seed POs at the
 * Approved stage (combined with approveAsFC).
 */
export async function submitPOAsPurchaser(
  browser: Browser,
  opts?: { description?: string; vendor?: string },
): Promise<CreatedPO> {
  return await withRoleContext(browser, "carmensoftware.dev+purchase@gmail.com", async (page) => {
    const po = new PurchaseOrderPage(page);
    const { ref, url, poNo } = await createDraftOnPage(page, opts, "submitPOAsPurchaser");

    // Submit for approval. Two things made this look like it worked while the PO
    // stayed in Draft:
    //   1. the confirmation is a Radix AlertDialog, which `getByRole("dialog")`
    //      never matched, so nothing ever confirmed (see confirmDialogButton);
    //   2. once it did confirm, the app optimistically routes back to the list,
    //      so the Submit button detaches *before* the PATCH lands — and
    //      withRoleContext then closes the context, aborting the request
    //      in flight. The record kept `last_action.state = "submitted"` with a
    //      null timestamp and `po_status = draft`.
    // Waiting on the response itself is the only proof that holds: the workflow
    // moves to the first approve stage (FC) only when this PATCH completes.
    const submit = po.submitButton();
    await submit.waitFor({ state: "visible", timeout: 20_000 });

    const submitted = page.waitForResponse(
      (r) => /\/purchase-orders\/[^/]+\/submit/.test(r.url()) && r.request().method() === "PATCH",
      { timeout: 30_000 },
    );
    await submit.click({ timeout: 10_000 });
    await po.confirmDialogButton(/confirm|submit|ok|yes/i).click({ timeout: 10_000 });

    const res = await submitted.catch(() => null);
    if (!res) {
      throw new Error(`submitPOAsPurchaser: PO ${ref} — no PATCH .../submit was ever sent`);
    }
    if (!res.ok()) {
      throw new Error(
        `submitPOAsPurchaser: PO ${ref} submit failed — ${res.status()} ${(await res.text().catch(() => "")).slice(0, 200)}`,
      );
    }

    // The draft number is replaced at submit; read the real one the inbox will show.
    await gotoPODetail(page, ref);
    const realNo = (await page.getByText(/^PO\d{6,}$/).first().textContent({ timeout: 15_000 }))?.trim() ?? "";
    if (!realNo) throw new Error(`submitPOAsPurchaser: PO ${ref} (${poNo}) has no real PO number after submit`);
    return { ref, url, poNo: realNo };
  });
}

/**
 * Cross-context helper: opens a fresh BrowserContext as FC and walks the PO from
 * In Progress to Approved.
 *
 * Approving a PO is not one button. `po-footer-action.tsx` only renders the
 * footer Approve when `role === "approve"` **and** `computePoAction(itemStatuses)`
 * is `"approved"` — and a freshly submitted PO has every item at `""`, which
 * that function maps to `"none"`. So the approver must first mark the lines:
 * enter Edit mode, select the item rows (the bulk bar needs `isEditMode` *and* a
 * selection), press the item-table Approve, and only then does the footer offer
 * Approve. The old helper looked for Approve straight after Edit, found nothing,
 * and blamed the workflow.
 *
 * FC is the right approver here: the backend's General PO workflow lists
 * `carmensoftware.dev+purchase@gmail.com` on Create Request and `carmensoftware.dev+fc@gmail.com` on the
 * first approve stage, and the PO form only ever offers that one workflow.
 */
export async function approveAsFC(browser: Browser, ref: string): Promise<void> {
  await approveAsRole(browser, "carmensoftware.dev+fc@gmail.com", ref);
}

/**
 * The GM leg. FC's approval only moves the PO to the next approve stage — the
 * General PO workflow is Create Request → FC → GM → Completed — so a PO is not
 * actually Approved (and has no Send to Vendor / Close) until GM signs too.
 */
export async function approveAsGM(browser: Browser, ref: string): Promise<void> {
  await approveAsRole(browser, "carmensoftware.dev+gm@gmail.com", ref);
}

/** Submit as Purchaser, then walk both approve stages, leaving an Approved PO. */
export async function seedApprovedPO(
  browser: Browser,
  opts?: { description?: string; vendor?: string },
): Promise<CreatedPO> {
  const created = await submitPOAsPurchaser(browser, opts);
  await approveAsFC(browser, created.ref);
  await approveAsGM(browser, created.ref);
  return created;
}

async function approveAsRole(browser: Browser, email: string, ref: string): Promise<void> {
  await withRoleContext(browser, email, async (page) => {
    await gotoPODetail(page, ref);
    const po = new PurchaseOrderPage(page);

    // Edit is the approver's gate: it renders only once the backend hands this
    // user role="approve" on this PO. If it never shows, the PO is not at FC's
    // stage and there is nothing to approve — say so instead of timing out.
    await po
      .editModeButton()
      .waitFor({ state: "visible", timeout: 20_000 })
      .catch(() => {
        throw new Error(
          `approveAsRole(${email}): PO ${ref} never offered Edit — it is not sitting at this role's approve stage`,
        );
      });
    await po.enterEditMode();

    const rowCheckboxes = page.locator("tbody").getByRole("checkbox");
    await rowCheckboxes.first().waitFor({ state: "visible", timeout: 10_000 });
    const rows = await rowCheckboxes.count();
    for (let i = 0; i < rows; i++) {
      await rowCheckboxes.nth(i).click({ timeout: 5_000 });
    }

    // Item-table Approve — marks every selected line approved in the form state.
    const itemApprove = page.getByRole("button", { name: /^approve$/i }).first();
    await itemApprove.waitFor({ state: "visible", timeout: 10_000 });
    await itemApprove.click({ timeout: 5_000 });

    // Footer Approve only appears now that no line is left pending.
    const approve = po.approveButton();
    await approve.waitFor({ state: "visible", timeout: 10_000 }).catch(() => {
      throw new Error(
        `approveAsRole(${email}): PO ${ref} — items were marked approved but the footer Approve never appeared`,
      );
    });

    const approved = page.waitForResponse(
      (r) => /\/purchase-orders\/[^/]+\/approve/.test(r.url()) && r.request().method() === "PATCH",
      { timeout: 30_000 },
    );
    await approve.click({ timeout: 5_000 });
    await po.confirmDialogButton(/confirm|approve|ok|yes/i).click({ timeout: 10_000 });

    const res = await approved.catch(() => null);
    if (!res) throw new Error(`approveAsRole(${email}): PO ${ref} — no PATCH .../approve was ever sent`);
    if (!res.ok()) {
      throw new Error(
        `approveAsRole(${email}): PO ${ref} approve failed — ${res.status()} ${(await res.text().catch(() => "")).slice(0, 200)}`,
      );
    }
  });
}

/**
 * Navigates to a PO detail page in the calling context.
 */
export async function gotoPODetail(page: Page, ref: string): Promise<void> {
  await page.goto(`${LIST_PATH}/${ref}`);
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
}
