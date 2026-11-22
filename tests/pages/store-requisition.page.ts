import type { Page, Locator } from "@playwright/test";
import { BasePage } from "./base.page";

export const LIST_PATH = "/store-operation/store-requisition";
export const NEW_PATH = "/store-operation/store-requisition/new";

export class StoreRequisitionPage extends BasePage {
  async gotoList() {
    await this.page.goto(LIST_PATH);
    await this.page.waitForLoadState("networkidle");
  }

  /**
   * The list opens on "My pending" (`?view=my-pending`, the useURL default in the
   * route component — empty for most roles). Specs that need to find a record by
   * status open "All Documents" instead. FE: ViewModeToggle (components/share/
   * view-mode-toggle.tsx), list pages 2f77b773 / 6802a125.
   */
  async gotoAllDocuments() {
    await this.page.goto(`${LIST_PATH}?view=all-document`);
    await this.page.waitForLoadState("networkidle");
    await this.waitForListRows();
  }

  /** Scope toggle: "My pending" (<button>, not a Radix tab). */
  tabMyPending(): Locator {
    return this.page.getByRole("button", { name: /my pending|my po|my pr/i }).first();
  }

  /** Scope toggle: "All Documents" (<button>, not a Radix tab). */
  tabAllDocuments(): Locator {
    return this.page.getByRole("button", { name: /all documents?|^all$/i }).first();
  }

  /** Let background lookups (e.g. the product scope of the chosen locations) finish. */
  async waitSettled() {
    await this.page.waitForLoadState("networkidle");
  }

  async gotoNew() {
    await this.page.goto(NEW_PATH);
    await this.page.waitForLoadState("networkidle");
  }

  async gotoDetail(id: string) {
    await this.page.goto(`${LIST_PATH}/${id}`);
    await this.page.waitForLoadState("networkidle");
  }

  // ── List page ────────────────────────────────────────────────────────
  newRequisitionButton(): Locator {
    // The list header button reads "New Store Requisition" — none of the old
    // alternatives matched it, so every test that opened the create form was
    // clicking nothing.
    return this.page
      .getByRole("button", { name: /new store requisition|new requisition|^new$|^create$/i })
      .first();
  }

  sortByButton(): Locator {
    return this.page.getByRole("button", { name: /sort by/i }).first();
  }

  bulkActionsButton(): Locator {
    return this.page.getByRole("button", { name: /bulk actions/i }).first();
  }

  bulkActionItem(name: RegExp | string): Locator {
    return this.page.getByRole("menuitem", { name: typeof name === "string" ? new RegExp(name, "i") : name });
  }

  delegateApprovalsButton(): Locator {
    return this.page.getByRole("button", { name: /delegate approvals/i }).first();
  }

  pendingApprovalsBadge(): Locator {
    return this.page
      .locator("[data-slot='status'], [data-slot='badge'], [class*='badge']")
      .filter({ hasText: /pending/i })
      .first();
  }

  // override: also matches "no pending"/"no requisition" empty text
  emptyState(): Locator {
    return this.page.getByText(/no.*pending|no.*requisition|empty|ไม่พบ/i).first();
  }

  // ── Header form ──────────────────────────────────────────────────────
  expectedDeliveryDateInput(): Locator {
    return this.page.getByLabel(/expected delivery date/i).first();
  }

  descriptionInput(): Locator {
    return this.page.getByLabel(/description|purpose/i).first();
  }

  requestFromTrigger(): Locator {
    return this.page.getByLabel(/request from|source location/i).first();
  }

  emergencyCheckbox(): Locator {
    return this.page.getByRole("checkbox", { name: /mark as emergency|emergency/i }).first();
  }

  emergencyJustificationInput(): Locator {
    return this.page.getByLabel(/emergency justification|justification/i).first();
  }

  // ── Items ────────────────────────────────────────────────────────────
  addItemButton(): Locator {
    return this.page.getByRole("button", { name: /add item/i }).first();
  }

  itemSearchInput(): Locator {
    return this.page.getByPlaceholder(/search.*item|search.*product/i).first();
  }

  itemOption(name: string): Locator {
    return this.page.getByRole("option", { name }).first();
  }

  requestedQuantityInput(): Locator {
    return this.page.getByLabel(/requested quantity|^quantity$/i).first();
  }

  // ── Actions ──────────────────────────────────────────────────────────
  saveAsDraftButton(): Locator {
    // The create form's button is plain "Save" — there is no "Save as Draft" here
    // (saving *is* what produces the draft; Submit is the separate action).
    return this.page
      .getByRole("button", { name: /save as draft|save draft|^save$/i })
      .first();
  }

  saveAndCloseButton(): Locator {
    return this.page.getByRole("button", { name: /save and close/i }).first();
  }

  submitForApprovalButton(): Locator {
    return this.page.getByRole("button", { name: /submit for approval/i }).first();
  }

  approveButton(): Locator {
    return this.page.getByRole("button", { name: /^approve$/i }).first();
  }

  rejectButton(): Locator {
    return this.page.getByRole("button", { name: /^reject$/i }).first();
  }

  requestReviewButton(): Locator {
    return this.page.getByRole("button", { name: /request review/i }).first();
  }

  recordIssuanceButton(): Locator {
    return this.page.getByRole("button", { name: /record issuance/i }).first();
  }

  issueButton(): Locator {
    return this.page.getByRole("button", { name: /^issue$/i }).first();
  }

  editApprovalMenuItem(): Locator {
    return this.page.getByRole("menuitem", { name: /edit approval/i }).first();
  }

  itemActionMenu(): Locator {
    return this.page.getByRole("button", { name: /actions|more|menu|three dots/i }).first();
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
  confirmDialogButton(name: RegExp = /confirm|approve|reject|ok|yes|submit|issue/i): Locator {
    return this.page
      .locator('[role="dialog"], [role="alertdialog"]')
      .last()
      .getByRole("button", { name })
      .first();
  }

  // ── Verification ─────────────────────────────────────────────────────
  // override: filters to SR-specific status text
  statusBadge(): Locator {
    return this.page
      .locator("[data-slot='status'], [data-slot='badge'], [class*='badge']")
      .filter({ hasText: /draft|in.progress|approved|rejected|complete|ready.*issuance/i })
      .first();
  }

  // ── Document form (new / detail) ─────────────────────────────────────
  // FE: routes/store-operation/store-requisition (sr-request-details.tsx, sr-item-fields.tsx,
  // sr-footer.tsx). The approve/reject/send back/issue flow is two-step: mark items in the
  // Items toolbar (needs Edit mode + ticked rows), then the footer button decides the document.

  /** Header field group by its label ("Workflow", "Request From", "Deliver To (Destination)", "Expected Delivery"). */
  headerGroup(label: RegExp): Locator {
    return this.page.getByRole("group").filter({ hasText: label });
  }

  workflowCombobox(): Locator {
    return this.headerGroup(/^Workflow/).getByRole("combobox");
  }

  /** The location picker button of "Request From" / "Deliver To (Destination)". */
  locationPicker(label: RegExp): Locator {
    return this.headerGroup(label).getByRole("button").first();
  }

  async pickWorkflow(name: RegExp) {
    await this.workflowCombobox().click();
    await this.page.getByRole("option", { name }).click();
  }

  async pickLocation(label: RegExp, code: string) {
    await this.locationPicker(label).click();
    await this.page.getByRole("dialog").getByRole("button", { name: new RegExp(code) }).first().click();
  }

  itemsPanel(): Locator {
    return this.page.getByRole("tabpanel", { name: "Items" });
  }

  /** Item rows of the Items tab (data rows only, the empty-state row is not counted by callers that check names). */
  itemRows(): Locator {
    return this.itemsPanel().locator("tbody tr");
  }

  itemRowByProduct(name: string): Locator {
    return this.itemRows().filter({ hasText: name });
  }

  selectProductButton(row: Locator): Locator {
    return row.getByRole("button", { name: /select product/i });
  }

  async pickProduct(row: Locator, code: string) {
    await this.selectProductButton(row).click();
    await this.page.getByRole("dialog").getByRole("button", { name: new RegExp(code) }).click();
  }

  qtySpinbutton(row: Locator, nth = 0): Locator {
    return row.getByRole("spinbutton").nth(nth);
  }

  inventoryInfoButton(row: Locator): Locator {
    return row.getByRole("button", { name: /inventory information/i });
  }

  /** Tick every item through the header checkbox + the "Select all" card of the Select Items dialog. */
  async selectAllItems() {
    await this.itemsPanel().getByRole("checkbox", { name: "Select all" }).click();
    await this.page.getByRole("dialog", { name: /select items/i }).getByRole("button", { name: /^select all/i }).click();
  }

  async selectItemRow(row: Locator) {
    await row.getByRole("checkbox", { name: "Select row" }).click();
  }

  /** Buttons of the Items toolbar (they only exist while rows are ticked). */
  toolbarAction(name: "Approve" | "Reject" | "Send Back"): Locator {
    return this.itemsPanel().getByRole("button", { name, exact: true });
  }

  /** Footer decision button - the last button of that name outside any dialog. */
  footerAction(name: "Approve" | "Reject" | "Send Back" | "Issue" | "Submit"): Locator {
    return this.page.locator("main").getByRole("button", { name, exact: true }).last();
  }

  /** The status dot of an item row; its aria-label is the status ("Pending" / "Approve" / "Reject" / "Send Back"...). */
  rowStatus(row: Locator): Locator {
    return row.locator("span[data-slot='tooltip-trigger'][aria-label]");
  }

  actionDialog(): Locator {
    return this.page.getByRole("alertdialog");
  }
}
