import type { Page, Locator } from "@playwright/test";
import { expect } from "@playwright/test";
import { BasePage } from "./base.page";

export const LIST_PATH = "/procurement/purchase-order";
export const NEW_PATH = "/procurement/purchase-order/new";

export interface POHeaderInput {
  vendor?: string;
  description?: string;
  deliveryDate?: string;
  notes?: string;
}

export interface POLineItemInput {
  product?: string;
  quantity?: number | string;
  uom?: string;
  unitPrice?: number | string;
}

export class PurchaseOrderPage extends BasePage {
  // ── Navigation ────────────────────────────────────────────────────────
  async gotoList() {
    await this.page.goto(LIST_PATH);
    await this.page.waitForLoadState("networkidle");
  }

  /** List opens on "My pending" (`?view=my-pending`); this opens "All Documents". */
  async gotoAllDocuments() {
    await this.page.goto(`${LIST_PATH}?view=all-document`);
    await this.page.waitForLoadState("networkidle");
    await this.waitForListRows();
  }

  async gotoDetail(orderNumber: string) {
    await this.page.goto(`${LIST_PATH}/${orderNumber}`);
    await this.page.waitForLoadState("networkidle");
  }

  async gotoNew() {
    await this.page.goto(NEW_PATH);
    await this.page.waitForLoadState("networkidle");
  }

  // ── List page ────────────────────────────────────────────────────────
  newPODropdown(): Locator {
    // The list header button reads "New Purchase Order". The old pattern had
    // `new po`, which does not match that string (after "New P" comes "u"), so
    // every test that opened the create picker sat on an un-clickable locator
    // until its timeout.
    return this.page
      .getByRole("button", { name: /new purchase order|new po\b|create purchase order|^create$/i })
      .first();
  }

  // The create picker is a dialog of plain <button> cards (po-create-dialog.tsx),
  // not a dropdown menu — "Blank PO" / "From PR" / "From Price List", each of which
  // navigates to its own route (/new, /from-pr, /from-price-list).
  // `/from pr/i` also matches "From **Pr**ice List" — the picker's three cards are
  // "Blank PO", "From Price List" and "From PR", and a substring match on the
  // wrong one silently sent every "create from PR" test into the price-list
  // wizard. Anchor on the card's own heading text.
  createFromPRMenuItem(): Locator {
    return this.page
      .getByRole("button", { name: /^from purchase request/i })
      .first();
  }

  manualPOMenuItem(): Locator {
    return this.page.getByRole("button", { name: /blank po|manual po/i }).first();
  }

  createFromPriceListButton(): Locator {
    return this.page.getByRole("button", { name: /from price list/i }).first();
  }

  poRow(text: string): Locator {
    return this.page.getByRole("row").filter({ hasText: text }).first();
  }

  // ── List filters / search / sort / tabs ──────────────────────────────
  tabMyPending(): Locator {
    return this.page.getByRole("button", { name: /my pending|my po/i }).first();
  }

  tabAllDocuments(): Locator {
    return this.page.getByRole("button", { name: /all documents?|^all$/i }).first();
  }

  async searchFor(text: string) {
    const input = this.searchInput();
    await input.fill(text);
    await this.page.waitForLoadState("networkidle").catch(() => {});
  }

  async applyFilter(opts: { status?: string }) {
    await this.filterButton().click();
    if (opts.status) {
      const trigger = this.page
        .getByRole("dialog")
        .getByLabel(/status/i)
        .first()
        .or(this.page.getByLabel(/status/i).first());
      if ((await trigger.count()) > 0) {
        await trigger.click();
        await this.page.getByRole("option", { name: new RegExp(opts.status, "i") }).first().click();
      }
    }
    const apply = this.page.getByRole("button", { name: /^apply$|^ok$/i }).first();
    if ((await apply.count()) > 0) await apply.click({ timeout: 5_000 }).catch(() => {});
  }

  async sortBy(column: string) {
    const header = this.page.getByRole("columnheader", { name: new RegExp(column, "i") }).first();
    if ((await header.count()) > 0) await header.click();
    await this.page.waitForLoadState("networkidle").catch(() => {});
  }

  // ── Form ─────────────────────────────────────────────────────────────
  vendorTrigger(): Locator {
    return this.page.getByLabel(/vendor/i).first();
  }

  descriptionInput(): Locator {
    return this.page.getByLabel(/^description$/i).first();
  }

  deliveryDateInput(): Locator {
    return this.page.getByLabel(/delivery date|expected.*delivery/i).first();
  }

  // override: also matches "Save PO" / "Submit"
  saveButton(): Locator {
    return this.page.getByRole("button", { name: /save po|^save$|^submit$|^create$/i }).first();
  }

  // ── Detail / actions ─────────────────────────────────────────────────
  sendToVendorButton(): Locator {
    return this.page.getByRole("button", { name: /send to vendor|^send$/i }).first();
  }

  approveButton(): Locator {
    return this.page.getByRole("button", { name: /^approve$/i }).first();
  }

  cancelPOButton(): Locator {
    return this.page.getByRole("button", { name: /cancel purchase order|cancel po|^void$/i }).first();
  }

  requestChangeOrderButton(): Locator {
    return this.page.getByRole("button", { name: /request change order|change order/i }).first();
  }

  generatePONumberButton(): Locator {
    return this.page.getByRole("button", { name: /generate po number/i }).first();
  }

  applyDiscountButton(): Locator {
    return this.page.getByRole("button", { name: /apply discount/i }).first();
  }

  calculateTotalsButton(): Locator {
    return this.page.getByRole("button", { name: /calculate totals/i }).first();
  }

  qrCodeSection(): Locator {
    return this.page
      .locator("[data-slot='qr-code'], [data-testid='qr-code'], section, div")
      .filter({ has: this.page.locator("img[alt*='qr' i], img[src*='qr' i]") })
      .first();
  }

  qrCodeImage(): Locator {
    return this.page.locator("img[alt*='qr' i], img[src*='qr' i]").first();
  }

  // ── Confirmation dialog ──────────────────────────────────────────────
  reasonInput(): Locator {
    // Both roles: confirmation popups here are Radix AlertDialog, which
    // getByRole("dialog") never matches — the reason box then stayed unfilled and
    // the dialog's own confirm button stayed disabled. `.last()` skips the
    // always-mounted Command Palette.
    return this.page
      .locator('[role="dialog"], [role="alertdialog"]')
      .last()
      .locator("textarea, input[type='text']")
      .first();
  }

  /**
   * Confirmations in this app are Radix **AlertDialog** — `role="alertdialog"`,
   * which `getByRole("dialog")` does NOT match. This resolved to nothing, and
   * since almost every call site wraps the click in `.catch(() => {})`, the step
   * silently did nothing: PO Submit left the record in Draft while reporting
   * success. Match both roles, and take `.last()` so the always-mounted Command
   * Palette (also a dialog) never wins.
   */
  confirmDialogButton(name: RegExp = /confirm|ok|yes/i): Locator {
    return this.page
      .locator('[role="dialog"], [role="alertdialog"]')
      .last()
      .getByRole("button", { name })
      .first();
  }

  // ── Dashboard ────────────────────────────────────────────────────────
  summaryCards(): Locator {
    return this.page.locator("[data-slot='card'], .card, article").first();
  }

  budgetUtilizationChart(): Locator {
    return this.page
      .locator("[data-testid='budget-chart'], canvas, svg")
      .filter({ hasText: /budget|utilization/i })
      .first();
  }

  // ── Status / verification ────────────────────────────────────────────
  // override: filters to PO-specific status text
  statusBadge(): Locator {
    return this.page
      .locator("[data-slot='status'], [data-slot='badge'], [class*='badge']")
      .filter({ hasText: /draft|sent|approved|acknowledged|received|cancelled|completed|rejected/i })
      .first();
  }

  async expectSavedToast() {
    await expect(
      this.page
        .locator('[data-sonner-toast], [role="status"], [role="alert"]')
        .filter({ hasText: /success|saved|created|updated|sent|approved|cancelled|สำเร็จ/i })
        .first(),
    ).toBeVisible({ timeout: 10_000 });
  }

  /**
   * "Send to vendor" opens a compose dialog (FE po-send-email-dialog), not a yes/no
   * confirm. TEST BU from `data:reset` has no enabled email profile, so the compose
   * form is replaced by the no-profile state with a link to the settings page.
   * Sending is deliberately not done (it would dispatch a real email).
   */
  async expectSendToVendorDialogOpen() {
    const dialog = this.page.locator('[role="dialog"], [role="alertdialog"]').last();
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(dialog).toContainText(/send purchase order to vendor/i);
    await expect(dialog).toContainText(/PO\d{6,}/);
    await expect(dialog.getByText(/no enabled email profile/i)).toBeVisible();
    await expect(dialog.getByRole("link", { name: /go to email profile settings/i })).toBeVisible();
  }

  // ── Form + Items (line items) ────────────────────────────────────────
  addItemButton(): Locator {
    return this.page.getByRole("button", { name: /add item|add line item|^add$/i }).first();
  }

  /** Header combobox: the workflow gates everything else on the form. */
  workflowTrigger(): Locator {
    return this.page.getByRole("combobox").filter({ hasText: /select workflow/i }).first();
  }

  async selectFirstWorkflow() {
    const trigger = this.workflowTrigger();
    // Wait rather than count(): the trigger renders a beat after the form shell.
    await trigger.waitFor({ state: "visible", timeout: 10_000 });
    await trigger.click();
    await this.page.getByRole("option").first().click();
  }

  /**
   * Vendor is a lookup (FE `LookupVendor` → `LookupCombobox`, lazy-loaded on open): a
   * popover (role=dialog) holding a virtualised list of <button> rows ("A023 <name>").
   * Without a vendor the line product lookup stays empty.
   */
  async selectFirstVendor() {
    // The form re-renders right after the workflow is chosen, so the trigger may be
    // briefly absent: wait for it instead of reading count() (a /new form never has a
    // vendor pre-selected).
    const trigger = this.page.getByRole("button", { name: /select vendor/i }).first();
    await trigger.waitFor({ state: "visible", timeout: 10_000 });
    await trigger.click();
    const card = this.page.getByRole("dialog").last().getByRole("button").filter({ hasText: /^[A-Z]\d{3}/ }).first();
    await card.waitFor({ state: "visible", timeout: 10_000 });
    await card.click();
    await expect(this.page.getByRole("button", { name: /select vendor/i })).toHaveCount(0, { timeout: 5_000 });
  }

  /**
   * Pick a delivery date. The header field is a date-picker <button> ("Select
   * date"), not a text input — the old `deliveryDateInput().fill()` silently did
   * nothing inside its .catch(), and Save then refused with "Some details are
   * missing" pointing at this field.
   */
  async selectDeliveryDate() {
    const trigger = this.page.getByRole("button", { name: /select date/i }).first();
    await trigger.waitFor({ state: "visible", timeout: 10_000 });
    await trigger.click({ timeout: 10_000 });
    const dialog = this.page.getByRole("dialog").last();
    await dialog.waitFor({ state: "visible", timeout: 5_000 }).catch(() => {});
    // Any selectable day works; take the last enabled one so the date lands in the
    // future rather than on a past day the picker disables. `:not([disabled])` has
    // to be part of the CSS — Locator.filter({hasNot}) tests descendants, not the
    // element itself, so it never excluded the disabled days.
    const day = dialog.locator('button:not([disabled])').filter({ hasText: /^\d{1,2}$/ }).last();
    await day.waitFor({ state: "visible", timeout: 5_000 });
    await day.click({ timeout: 10_000 });
    await dialog.waitFor({ state: "hidden", timeout: 5_000 }).catch(() => {});
  }

  /**
   * Add one line item to a PO being created or edited.
   *
   * Two gates sit in front of this, and both fail silently if skipped:
   *  1. "Add Item" checks `workflow_id` first (po-item-fields.tsx:123) — with no
   *     workflow it opens a "Select a workflow first" dialog and adds no row at all.
   *  2. The row's product lookup is scoped to the chosen vendor.
   * The old implementation did neither and guessed at `getByLabel(/product/i)`
   * with every step wrapped in .catch(), so it added nothing, left Save disabled,
   * and the PO was never created — which is what made the PO journeys time out.
   */
  async addItemToPO(data: POLineItemInput) {
    // Same reason as PriceListPage.fillHeader: the steps below decide what to do
    // from an immediate `count()`, so a form that has not rendered yet makes all
    // of them no-op. Wait for the item table's own control first.
    await this.addItemButton().waitFor({ state: "visible", timeout: 15_000 });
    // Header pickers only exist on a blank form; in edit mode the PO already has them.
    if (/purchase-order\/new/.test(this.page.url())) {
      await this.selectFirstWorkflow();
      await this.selectFirstVendor();
      await this.selectDeliveryDate();
    }
    await this.addItemButton().click({ timeout: 10_000 });

    // Rows are prepended, so the row being filled is the first body row. Wait on
    // something inside it rather than on the <tr>: right after the click the first
    // body row is still the "No Items Yet" placeholder, and a lookup scoped to it
    // finds no triggers at all — which used to return quietly and leave every
    // later step on an unfilled row.
    //
    // Which trigger to wait on depends on where we are. On a brand-new PO the row
    // starts empty and offers "Select Location". Adding a row to a PO that already
    // has items pre-fills the location from the existing line, so that button
    // never appears and "Select Product" is the first thing to act on — waiting
    // for "Select Location" there simply timed out.
    const row = this.page.locator("tbody tr").first();
    await row
      .getByRole("button", { name: /select location|select product/i })
      .first()
      .waitFor({ state: "visible", timeout: 10_000 });

    // waitFor, not count(): the wait above can settle on the (disabled) "Select
    // Product" button, and at that instant the row's location trigger may not be
    // rendered yet. Reading count() there skipped the location pick on a brand-new
    // PO, and "Select Product" — which the cascade only enables once a location is
    // chosen — then never became enabled.
    const hasLocationTrigger = await row
      .getByRole("button", { name: /select location/i })
      .first()
      .waitFor({ state: "visible", timeout: 5_000 })
      .then(() => true)
      .catch(() => false);
    if (hasLocationTrigger) {
      await this.pickFromRowTrigger(row, /select location/i);
    }
    if (data.product !== undefined) {
      await this.pickFromRowTrigger(row, /select product/i);
    }
    if (data.quantity !== undefined) {
      await row.locator('input[name$=".order_qty"]').first().fill(String(data.quantity));
    }
    if (data.unitPrice !== undefined) {
      const price = row.locator('input[name$=".price"]').first();
      if ((await price.count()) > 0) await price.fill(String(data.unitPrice));
    }
  }

  /**
   * Click a "Select X" trigger inside a row and take the first option offered.
   *
   * Every wait here is bounded on purpose. The triggers unlock in sequence —
   * "Select Product" ships `disabled` until a location is chosen — and Playwright's
   * default `actionTimeout` is 0, so clicking a still-disabled trigger waits for it
   * to become actionable *forever* rather than failing. That is what hung the PO
   * journeys for the full test timeout with no error to point at.
   */
  private async pickFromRowTrigger(row: Locator, name: RegExp) {
    const trigger = row.getByRole("button", { name }).first();
    // waitFor, not count(): count() answers immediately, and each pick re-renders
    // the row, so the next trigger is briefly absent from the DOM. Reading the
    // count at that instant threw "the row layout changed" on a row that was
    // merely mid-render — an intermittent failure that took out whichever test
    // happened to seed at the wrong moment.
    await trigger.waitFor({ state: "attached", timeout: 10_000 }).catch(() => {
      throw new Error(`addItemToPO: no "${name}" trigger in the item row — the row layout changed`);
    });
    // Wait for the cascade to unlock this step instead of blocking on the click.
    await expect(trigger).toBeEnabled({ timeout: 10_000 });
    await trigger.click({ timeout: 10_000 });
    // The picker is either a dialog of <button> cards (location, product) or a
    // plain listbox. Branch on what actually opened instead of unioning the two:
    // an .or() locator resolves against both roles and can settle on something
    // that is not the row we mean to pick.
    // .last(): the app keeps a hidden Command Palette dialog mounted, so
    // getByRole("dialog") matches more than one node and any strict-mode call on it
    // throws — which silently sent this down the listbox branch and left the row
    // unfilled. The picker that just opened is the last one in the DOM.
    const dialog = this.page.getByRole("dialog").last();
    // waitFor, not isVisible: isVisible() answers immediately, so right after the
    // click it reports false while the picker is still opening and the code falls
    // through to the listbox branch that will never match.
    const dialogOpened = await dialog
      .waitFor({ state: "visible", timeout: 5_000 })
      .then(() => true)
      .catch(() => false);
    if (dialogOpened) {
      const card = dialog.getByRole("button").filter({ hasText: /\S/ }).first();
      await card.waitFor({ state: "visible", timeout: 10_000 });
      await card.click({ timeout: 10_000 });
      await dialog.waitFor({ state: "hidden", timeout: 10_000 }).catch(() => {});
    } else {
      const option = this.page.getByRole("option").first();
      await option.waitFor({ state: "visible", timeout: 10_000 });
      await option.click({ timeout: 10_000 });
    }
    await this.page.waitForTimeout(300);
  }

  // ── Edit mode ────────────────────────────────────────────────────────
  editModeButton(): Locator {
    return this.page.getByRole("button", { name: /^edit$|edit po|edit mode/i }).first();
  }

  async enterEditMode() {
    // Bounded on purpose: actionTimeout defaults to 0 in this config, so an
    // un-timed click on a button that never becomes actionable waits forever and
    // the test burns its whole budget with nothing to point at.
    await this.editModeButton().click({ timeout: 10_000 });
    await this.page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  }

  /**
   * Leave edit mode. The app asks to confirm ("Keep editing" / "Discard") even
   * when nothing was changed — entering edit mode is enough to mark the form
   * dirty — so a bare Cancel click leaves the dialog on screen and the page stuck
   * in edit mode. Confirm it.
   */
  async cancelEditMode() {
    const cancel = this.page.getByRole("button", { name: /^cancel$/i }).first();
    if ((await cancel.count()) === 0) return;
    await cancel.click({ timeout: 5_000 });
    const discard = this.page
      .locator('[role="dialog"], [role="alertdialog"]')
      .last()
      .getByRole("button", { name: /^discard$/i })
      .first();
    await discard.click({ timeout: 5_000 }).catch(() => {});
  }

  // ── Submit / Delete (Edit Mode actions) ──────────────────────────────
  submitButton(): Locator {
    return this.page.getByRole("button", { name: /submit for approval|^submit$/i }).first();
  }

  // ── Detail page tabs (Item Details panel) ────────────────────────────
  tabItems(): Locator {
    return this.page.getByRole("tab", { name: /^items$/i }).first();
  }

  tabQuantity(): Locator {
    return this.page.getByRole("tab", { name: /^quantity$|^qty$/i }).first();
  }

  tabPricing(): Locator {
    return this.page.getByRole("tab", { name: /^pricing$|^price$/i }).first();
  }

  // ── Create PO wizards (Step 2) ───────────────────────────────────────
  // Same dialog as createFromPRMenuItem above: <button> cards, not menu items.
  fromPriceListMenuItem(): Locator {
    return this.page.getByRole("button", { name: /from price list|price list/i }).first();
  }

  // Same "From Pr[ice List]" collision as createFromPRMenuItem — see the note there.
  fromPRMenuItem(): Locator {
    return this.page
      .getByRole("button", { name: /^from purchase request/i })
      .first();
  }

  /**
   * From-Price-List wizard (FE routes/procurement/purchase-order/from-price-list):
   * step 1 "Order & Vendor" = workflow + delivery date, then a radio list of vendors
   * with a price list active on that date; Next -> step 2 "Select Items".
   */
  async priceListWizardPickVendorAndNext() {
    await this.selectFirstWorkflow();
    await this.selectDeliveryDate();
    const vendor = this.page.getByRole("radio").first();
    await expect(
      vendor,
      "no vendor with an active price list — run `bun run data:reset --yes` (pricing step)",
    ).toBeVisible({ timeout: 15_000 });
    await vendor.click();
    await this.page.getByRole("button", { name: /^next/i }).click({ timeout: 10_000 });
    await expect(this.page.getByText(/select items/i).first()).toBeVisible({ timeout: 10_000 });
  }

  /** Step 2: tick the first price-list line, give it the first location, then Next. */
  async priceListWizardPickItemAndNext() {
    const row = this.page.getByRole("row").filter({ hasText: /PL\d+/ }).first();
    await row.getByRole("checkbox").click({ timeout: 10_000 });
    await row.getByRole("button", { name: /select location/i }).click({ timeout: 10_000 });
    const card = this.page.getByRole("dialog").last().getByRole("button").filter({ hasText: /\S/ }).first();
    await card.waitFor({ state: "visible", timeout: 10_000 });
    await card.click();
    await this.page.getByRole("button", { name: /^next/i }).click({ timeout: 10_000 });
  }

  /**
   * From-PR wizard (FE routes/procurement/purchase-order/from-pr): pick the target
   * workflow, which loads the approved PRs; tick the first, Next -> "Review POs".
   */
  async fromPRWizardPickFirstPRAndNext() {
    await this.page.goto("/procurement/purchase-order/from-pr");
    await this.selectFirstWorkflow();
    const prRows = this.page.locator("tbody tr").filter({ hasText: /PR\d{6,}/ });
    await expect(
      prRows.first(),
      "no approved PR in TEST BU — run `bun run data:reset --yes` (STD pr.approved docs)",
    ).toBeVisible({ timeout: 15_000 });
    await prRows.first().getByRole("checkbox").click();
    await this.page.getByRole("button", { name: /^next/i }).click({ timeout: 10_000 });
    await expect(this.page.getByText(/review pos/i).first()).toBeVisible({ timeout: 10_000 });
  }

  priceListWizardSubmit(): Locator {
    return this.page.getByRole("button", { name: /create po|finish|done|^create$|^submit$/i }).last();
  }

  fromPRWizardSubmit(): Locator {
    return this.page.getByRole("button", { name: /create po|finish|done|^create$|^submit$/i }).last();
  }

  // ── Close PO (Step 5 post-approval) ──────────────────────────────────
  closePOButton(): Locator {
    return this.page.getByRole("button", { name: /^close$|close po|mark as complete/i }).first();
  }

  // ── FC Approval Actions (Edit Mode item-level + document-level) ──────
  // The FC PO approval flow uses item-level marking (Approve/Review/Reject)
  // that surfaces an action toolbar, plus document-level footer buttons
  // (Approve PO / Send Back / Reject) whose visibility depends on the
  // item-state mix. Distinct from PR's bulk-toolbar pattern.

  selectItemRow(index: number): Locator {
    // Skip header row (nth(0)); data rows start at nth(1)
    return this.page.getByRole("row").nth(index + 1).getByRole("checkbox").first();
  }

  async selectItemInEditMode(index: number) {
    const cb = this.selectItemRow(index);
    if ((await cb.count()) > 0) await cb.check({ force: true });
  }

  /**
   * The approver's bulk-action bar above the item table. There is no
   * `data-slot="toolbar"` or `role="toolbar"` anywhere in this app — the bar is a
   * plain flex `div` — so the old locator matched nothing and every item-level
   * approval test skipped itself with "UI may differ". Anchor on the only thing
   * that identifies it: it is the innermost element holding all three verdict
   * buttons. It renders only in edit mode, for an approver, with rows selected.
   */
  itemActionToolbar(): Locator {
    return this.page
      .locator("div")
      .filter({ has: this.page.getByRole("button", { name: /^approve$/i }) })
      .filter({ has: this.page.getByRole("button", { name: /^review$/i }) })
      .filter({ has: this.page.getByRole("button", { name: /^reject$/i }) })
      .last();
  }

  markItemApproveButton(): Locator {
    return this.itemActionToolbar().getByRole("button", { name: /^approve$/i }).first();
  }

  markItemReviewButton(): Locator {
    return this.itemActionToolbar().getByRole("button", { name: /^review$/i }).first();
  }

  markItemRejectButton(): Locator {
    return this.itemActionToolbar().getByRole("button", { name: /^reject$/i }).first();
  }

  /**
   * Per-item verdict marker. It is not a text badge: the row renders a coloured
   * glyph in a tooltip trigger whose only readable text is its `aria-label`
   * ("APPROVED" / "REVIEW" / "REJECTED"), so a hasText filter never matched.
   */
  itemBadge(index: number, status?: string): Locator {
    const row = this.page.getByRole("row").nth(index + 1);
    const re = status ? new RegExp(status, "i") : /approved|review|rejected/i;
    return row
      .getByLabel(re)
      .first()
      .or(row.locator("[data-slot='status'], [data-slot='badge'], [class*='badge']").filter({ hasText: re }).first())
      .first();
  }

  // Document-level action buttons. These used to be scoped to `footer,
  // [data-slot='footer']` — but the action bar is `SummaryFooterBar`
  // (components/ui/summary-bar.tsx), a plain <div> with no footer element and no
  // data-slot, so that scope matched nothing and the `.or()` fallbacks only
  // accepted "Approve PO"-style names the app never renders.
  //
  // Taking `.last()` is what separates them from the item-level verdict buttons
  // of the same name: the bulk bar sits above the table, the summary bar below
  // it, and the bulk bar disappears anyway once a verdict is applied (the item
  // handlers call table.resetRowSelection()).
  documentApproveButton(): Locator {
    return this.page
      .getByRole("button", { name: /approve po|approve.*purchase order|^approve$/i })
      .last();
  }

  documentSendBackButton(): Locator {
    return this.page
      .getByRole("button", { name: /send back|return for|^send$/i })
      .last();
  }

  documentRejectButton(): Locator {
    return this.page.getByRole("button", { name: /reject po|^reject$/i }).last();
  }

  commentButton(): Locator {
    return this.page.getByRole("button", { name: /^comment$|add comment/i }).first();
  }
}
