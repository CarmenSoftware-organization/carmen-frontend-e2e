import type { Page, Locator } from "@playwright/test";
import { expect } from "@playwright/test";
import { BasePage } from "./base.page";

export const LIST_PATH = "/procurement/purchase-request";
export const NEW_PATH = "/procurement/purchase-request/new";
export const APPROVALS_PATH = "/procurement/my-approval";

export type PRType = "general" | "asset" | "service";

export interface PRLineItemInput {
  product?: string;
  description?: string;
  quantity?: number | string;
  uom?: string;
  vendor?: string;
  unitPrice?: number | string;
  discount?: number | string;
  taxRate?: number | string;
  isFOC?: boolean;
}

export interface PRHeaderInput {
  prType?: PRType;
  deliveryDate?: string;
  description?: string;
  justification?: string;
  notes?: string;
  internalNotes?: string;
  hidePrice?: boolean;
}

export class PurchaseRequestPage extends BasePage {
  // ── Navigation ────────────────────────────────────────────────────────
  async gotoList() {
    await this.page.goto(LIST_PATH);
    await this.page.waitForLoadState("networkidle");
  }

  /** List opens on "My pending" (`?view=my-pending`); this opens "All Documents". */
  async gotoAllDocuments() {
    await this.page.goto(`${LIST_PATH}?view=all-document&perpage=100`);
    // No networkidle: the shell polls notifications, so the network never settles (a 100-row page
    // made that wait eat the whole test budget). Rows (or the empty state) are the readiness signal.
    await this.waitForListRows();
  }

  /**
   * A returned PR. There is no "Returned" status: when an approver sends a PR back it stays
   * In progress and its workflow stage moves back to "Create Request" (the STD dataset's
   * pr.returned row is verified the same way — verify-dataset.ts: stage "Create Request").
   */
  returnedPRRow(): Locator {
    return this.rowWithStatus(/in progress/i).filter({ hasText: /create request/i });
  }

  async gotoNew() {
    await this.page.goto(NEW_PATH);
    await this.page.waitForLoadState("networkidle");
  }

  async gotoApprovals() {
    await this.page.goto(APPROVALS_PATH);
    await this.page.waitForLoadState("networkidle");
  }

  // ── List page ────────────────────────────────────────────────────────
  newButton(): Locator {
    // Redesigned list toolbar button is "Add Request".
    return this.page.getByRole("button", { name: /add request|new purchase request|create purchase request|^add$|^new$|^create$/i }).first();
  }

  bulkActionsTrigger(): Locator {
    return this.page.getByRole("button", { name: /bulk actions/i }).first();
  }

  bulkActionItem(name: RegExp | string): Locator {
    return this.page.getByRole("menuitem", { name: typeof name === "string" ? new RegExp(name, "i") : name });
  }

  prRow(refOrText: string): Locator {
    return this.page.getByRole("row").filter({ hasText: refOrText }).first();
  }

  rowCheckbox(refOrText: string): Locator {
    return this.prRow(refOrText).getByRole("checkbox").first();
  }

  async openPR(refOrText: string) {
    // The list renders as a table OR cards depending on viewMode/build. Find the
    // container holding the ref text and click its name link/button, falling back
    // to the container itself; navigation goes to /purchase-request/<id>.
    const row = this.prRow(refOrText);
    const card = this.page
      .locator("[data-slot='card'], article")
      .filter({ hasText: refOrText })
      .first();
    const target = (await row.count()) > 0 ? row : card;
    await target.waitFor({ state: "visible", timeout: 10_000 });
    const link = target.getByRole("link").first();
    const button = target.getByRole("button", { name: new RegExp(refOrText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }).first();
    if ((await link.count()) > 0) {
      await link.click();
    } else if ((await button.count()) > 0) {
      await button.click();
    } else {
      await target.click();
    }
    await this.page.waitForLoadState("networkidle");
  }

  // ── List filters / search / sort / tabs ──────────────────────────────
  async searchFor(text: string) {
    const input = this.searchInput();
    await input.fill(text);
    await input.press("Enter"); // SearchInput fires onSearch on Enter
    await this.page.waitForLoadState("networkidle").catch(() => {});
  }

  /**
   * Filter menu -> Status -> tick `status` (a multi-select inside the menu, FE
   * use-pr-filter-fields.tsx). There is no Apply button: ticking applies. Resolves once the
   * option is checked; callers assert the effect on the list.
   */
  async applyFilter(status = "In progress") {
    await this.filterButton().click();
    const menu = this.page.getByRole("dialog");
    await expect(menu, "filter menu did not open").toBeVisible({ timeout: 10_000 });
    await menu.getByRole("button", { name: /^status$/i }).first().click({ timeout: 5_000 });
    // The options open in a flyout next to the menu (not inside it), labelled in upper case; each
    // row is a clickable label around a presentational checkbox (tabIndex -1), not a role=checkbox.
    const option = this.page
      .locator("div, label, button")
      .filter({ has: this.page.getByRole("checkbox"), hasText: new RegExp(`^${status}$`, "i") })
      .last();
    await expect(option, `Status filter offers no "${status}" option`).toBeVisible({ timeout: 5_000 });
    await option.click();
  }

  /**
   * After a Status filter: every list row's status chip reads `status`. Rows can carry extra badges
   * (e.g. "Send back"), which are not a status and are ignored.
   */
  async expectEveryRowStatus(status: RegExp) {
    const chips = this.page.locator("tbody tr").locator("[data-slot='status-chip'], [data-slot='badge']");
    await expect(chips.first(), "filtered list shows no status chip").toBeVisible({ timeout: 10_000 });
    const texts = (await chips.allInnerTexts()).map((t) => t.trim()).filter((t) => t && !/^send back$/i.test(t));
    expect(texts.length, "no status chips to check").toBeGreaterThan(0);
    for (const t of texts) expect(t, `a row outside the filter: "${t}"`).toMatch(status);
  }

  async sortBy(column: string) {
    const header = this.page.getByRole("columnheader", { name: new RegExp(column, "i") }).first();
    if ((await header.count()) > 0) await header.click();
    await this.page.waitForLoadState("networkidle").catch(() => {});
  }

  /**
   * Stage filter. There is no standalone "All Stage" dropdown any more: the stage
   * control is a field of the list filter menu (use-pr-filter-fields.tsx,
   * `control: "stage"` → components/filter/filter-stage.tsx, inline variant).
   * Flow: Filter button → "Stage" field → checkbox list ("All Stage" + each stage).
   */
  async openStageFilter() {
    await this.filterButton().click();
    await this.page.getByRole("dialog").getByRole("button", { name: /^stage$/i }).first().click();
  }

  /** A stage checkbox inside the open stage filter ("All Stage" or a stage name). */
  stageFilterOption(name: RegExp | string): Locator {
    return this.page.getByRole("dialog").getByRole("checkbox", { name }).first();
  }

  // Redesigned list uses viewMode <Button>s, not Radix tabs.
  tabMyPending(): Locator {
    return this.page.getByRole("button", { name: /my pending|my pr/i }).first();
  }

  tabAllDocuments(): Locator {
    return this.page.getByRole("button", { name: /all documents?|^all$/i }).first();
  }

  // ── Create dialog (list "Create Purchase Request" entry) ──────────────
  createDialogBlankOption(): Locator {
    return this.page.getByRole("button", { name: /blank|empty|start.*scratch|new pr/i }).first();
  }

  async openCreateDialog() {
    await this.newButton().click({ timeout: 10_000 });
    // The button either opens a picker dialog (Blank / From template) or goes straight
    // to /new; settle on whichever happened, then require the form route.
    const dialog = this.page.getByRole("dialog").last();
    const opened = await dialog
      .waitFor({ state: "visible", timeout: 3_000 })
      .then(() => true)
      .catch(() => false);
    if (opened) {
      await this.createDialogBlankOption().click({ timeout: 5_000 });
    }
    await expect(this.page, "create did not reach /purchase-request/new").toHaveURL(/purchase-request\/new/, { timeout: 10_000 });
  }

  // ── Form (header) ─────────────────────────────────────────────────────
  prTypeTrigger(): Locator {
    return this.page.getByLabel(/pr type|type/i).first();
  }

  descriptionInput(): Locator {
    // Match on the id, not the tag: [name='description'] would also hit
    // <meta name="description">, and the field is an <input> now —
    // pr-general-fields.tsx renders <Input id="pr-description">, not a textarea.
    return this.page.locator("#pr-description").first();
  }

  justificationInput(): Locator {
    return this.page.locator("#pr-justification, [name='justification'], textarea[aria-label*='justification' i]").first();
  }

  deliveryDateInput(): Locator {
    return this.page.getByLabel(/delivery date|required date/i).first();
  }

  hidePriceToggle(): Locator {
    return this.page.getByRole("switch", { name: /hide price/i }).first();
  }

  notesInput(): Locator {
    return this.page.getByLabel(/^notes$/i).first();
  }

  internalNotesInput(): Locator {
    return this.page.getByLabel(/internal notes/i).first();
  }

  async setPRType(type: PRType) {
    const trigger = this.prTypeTrigger();
    if ((await trigger.count()) === 0) return;
    await trigger.click();
    const labelMap: Record<PRType, RegExp> = {
      general: /general/i,
      asset: /asset/i,
      service: /service/i,
    };
    await this.page.getByRole("option", { name: labelMap[type] }).first().click();
  }

  /** Open a lookup trigger (button/combobox) and pick the first option. Capped
   *  wait so a still-disabled cascading trigger doesn't eat the whole timeout. */
  private async pickFirstInCombobox(trigger: Locator): Promise<boolean> {
    // No early count-check: cascading triggers mount/enable after the prior
    // selection re-renders, so let click() auto-wait for it (then catch absence).
    try {
      await trigger.click({ timeout: 10_000 });
    } catch {
      return false;
    }
    // Let the popover open + options load (Radix Select items = role="option";
    // LookupCombobox items = <button aria-pressed>). Pick the first visible item.
    await this.page.waitForTimeout(800);
    const item = this.page
      .locator('[role="option"]:visible, button[aria-pressed]:visible')
      .first();
    if ((await item.count()) === 0) {
      await this.page.keyboard.press("Escape").catch(() => {});
      return false;
    }
    await item.click({ timeout: 5_000 });
    return true;
  }

  /**
   * Workflow Select on the /new general fields (required — "Add Item" is disabled
   * until a workflow is chosen). On the blank create form it is the only/first
   * combobox. Picks the first workflow option.
   */
  /** Open a lookup trigger and pick its first option; throws (naming `what`) when it cannot. */
  async pickFirstOption(trigger: Locator, what: string) {
    if (!(await this.pickFirstInCombobox(trigger))) {
      throw new Error(`could not pick a ${what} — the trigger was absent or its list was empty`);
    }
  }

  /**
   * Replace the value of an amount input. The masked InputAmount appends to whatever it already
   * holds on a plain fill() (a price-listed item starts at 100 and fill("125") gave "100125"), so
   * select the content first and type over it.
   */
  async setAmount(input: Locator, value: number) {
    await input.click();
    await input.press("ControlOrMeta+a");
    await input.pressSequentially(String(value));
    await input.blur();
  }

  /**
   * Purchase stage: give item `index` the three things Approve demands (FE pr-footer-action.tsx
   * allItemsReadyForPurchase): a vendor, a unit price > 0 and a tax profile.
   */
  async allocateVendorPriceTax(index: number, price: number) {
    await this.expandItem(index);
    await this.pickFirstOption(this.vendorInput(index), "vendor");
    const priceInput = this.unitPriceInput(index);
    await expect(priceInput, "Unit Price input missing for the purchaser").toBeVisible({ timeout: 10_000 });
    await this.setAmount(priceInput, price);
    await this.pickFirstOption(this.taxProfileSelect(index), "tax profile");
  }

  async selectFirstWorkflow(): Promise<boolean> {
    const trigger = this.page.getByRole("combobox").first();
    return await this.pickFirstInCombobox(trigger);
  }

  async fillHeader(data: PRHeaderInput) {
    // Redesigned create form header is just: workflow (required) + description.
    if (!(await this.selectFirstWorkflow())) {
      throw new Error("fillHeader: could not pick a workflow — the workflow combobox was absent or its list empty");
    }
    if (data.description !== undefined) {
      const d = this.descriptionInput();
      await expect(d, "PR description input (#pr-description) not present").toBeVisible({ timeout: 10_000 });
      await d.fill(data.description);
    }
  }

  // ── Form (line items) ─────────────────────────────────────────────────
  addItemButton(): Locator {
    return this.page.getByRole("button", { name: /add item|add line item|^add$/i }).first();
  }

  itemRow(index: number): Locator {
    return this.page.getByRole("row").filter({ has: this.page.locator("input,button") }).nth(index);
  }

  /** The row in the item datagrid for field-array index (rows are prepended → 0 = newest). */
  itemRowByIndex(index: number): Locator {
    return this.page
      .locator("tr")
      .filter({ has: this.page.locator(`input[name="items.${index}.requested_qty"]`) })
      .first();
  }

  async addLineItem(data: PRLineItemInput) {
    // Redesigned editor: "Add Item" prepends a blank row (index 0) in an editable
    // datagrid. The cascade enables in order (location → product → unit); a valid
    // item needs location, product, qty, unit (auto-set from product) + delivery
    // point (currency auto-fills from the BU, delivery date defaults to tomorrow).
    //
    // The qty cell is NOT an input until a product is chosen — requested-cell.tsx
    // renders <QtyUnitPlain> while `!productId` ("กรอกจำนวนก่อนเลือกสินค้าไม่มี
    // ความหมาย"). So the new row is anchored on its "Select Location" button,
    // not on the qty input, which only exists from step 2 onwards.
    // A workflow must be chosen before the item row is any use: the product list
    // comes from `products-location-workflow/{location}/{workflow}`, so without
    // one the product picker opens **empty** and the whole cascade stalls. Tests
    // that only wanted to add a line never selected it, and the failure showed up
    // three steps later as a missing qty input.
    // Use the same locator selectFirstWorkflow() uses — the first combobox on the
    // form. A `filter({ hasText: /select workflow/i })` looks more precise but
    // matches nothing here, even though the control's own text reads exactly
    // that. Selecting before Add Item keeps `.first()` unambiguous: the item row
    // adds comboboxes of its own.
    // Only pick it when none is chosen yet: a second line item must not re-open the
    // workflow combobox (the first combobox on the form) and change the choice.
    const workflow = this.page.getByRole("combobox").first();
    await workflow.waitFor({ state: "visible", timeout: 10_000 });
    if (/select workflow/i.test((await workflow.textContent()) ?? "")) {
      if (!(await this.selectFirstWorkflow())) {
        throw new Error("addLineItem: could not pick a workflow — Add Item is gated on it");
      }
    }

    await this.addItemButton().click({ timeout: 10_000 });
    // Anchor on position, not on content: every cascade step replaces the trigger
    // it just used ("Select Location" becomes the chosen location's name), so a
    // content-based row filter goes stale after the first pick. New rows are
    // prepended, so the row being edited is always the first body row; the
    // second body row is the comment box, not another item.
    const row = this.page.locator("tbody tr").first();
    await row.waitFor({ state: "visible", timeout: 10_000 });

    // Report which gate failed. These two used to drop the boolean on the floor,
    // so a location or product that could not be picked only surfaced later as
    // "qty input never became visible" — which points at the wrong step entirely
    // (qty simply does not exist until a product is set).
    // A second line inherits the location of the previous one (the trigger is then already
    // labelled with it), so "Select Location" is only there for the first row of a form.
    const locationTrigger = row.getByRole("button", { name: /select location/i }).first();
    const needsLocation = await locationTrigger.waitFor({ state: "visible", timeout: 4_000 }).then(
      () => true,
      () => false,
    );
    if (needsLocation) {
      if (!(await this.pickFirstInCombobox(locationTrigger))) {
        throw new Error("addLineItem: could not pick a location — the row's Select Location trigger's list was empty");
      }
    } else {
      await expect(
        row.getByRole("button", { name: /select product/i }).first(),
        "addLineItem: new row has neither a Select Location trigger nor the product picker",
      ).toBeVisible({ timeout: 10_000 });
    }
    if (data.product !== undefined) {
      if (!(await this.pickFirstInCombobox(row.getByRole("button", { name: /select product/i }).first()))) {
        throw new Error("addLineItem: could not pick a product — check that a location was set first (product is gated on it)");
      }
    }
    if (data.quantity !== undefined) {
      // Only reachable once a product is set; scoped to this row so a re-render
      // of the grid cannot retarget it at a sibling row.
      const qtyInput = row.locator('input[name^="items."][name$=".requested_qty"]').first();
      await qtyInput.waitFor({ state: "visible", timeout: 10_000 });
      await qtyInput.fill(String(data.quantity));
    }
    // Unit auto-fills from the product and the delivery point may already be defaulted, so
    // these two triggers are legitimately absent on some rows (pickFirstInCombobox then
    // returns false without throwing).
    await this.pickFirstInCombobox(row.getByRole("button", { name: /select unit/i }).first());
    await this.pickFirstInCombobox(row.getByRole("button", { name: /select delivery point/i }).first());
    if (data.isFOC) {
      // FE foc-cell.tsx: FOC is a quantity input (items.N.foc_qty), not a checkbox.
      const foc = row.locator('input[name$=".foc_qty"]').first();
      await expect(foc, "FOC qty input not present on the new row").toBeVisible({ timeout: 5_000 });
      await foc.fill(String(data.quantity ?? 1));
    }
    // No per-item Save in the inline datagrid — the row persists with the form.
  }

  // ── Form actions ──────────────────────────────────────────────────────
  saveDraftButton(): Locator {
    return this.page.getByRole("button", { name: /save as draft|save draft|^save$/i }).first();
  }

  submitButton(): Locator {
    return this.page.getByRole("button", { name: /submit for approval|^submit$/i }).first();
  }

  cancelFormButton(): Locator {
    return this.page.getByRole("button", { name: /^cancel$/i }).first();
  }

  // ── Detail page actions ───────────────────────────────────────────────
  approveButton(): Locator {
    return this.page.getByRole("button", { name: /^approve$|purchase approve/i }).first();
  }

  rejectButton(): Locator {
    return this.page.getByRole("button", { name: /^reject$/i }).first();
  }

  sendBackButton(): Locator {
    return this.page.getByRole("button", { name: /send back|return for revision|^return$/i }).first();
  }

  recallButton(): Locator {
    return this.page.getByRole("button", { name: /^recall$/i }).first();
  }

  cancelPRButton(): Locator {
    return this.page.getByRole("button", { name: /cancel pr|void/i }).first();
  }

  convertToPOButton(): Locator {
    return this.page.getByRole("button", { name: /convert to po|create po/i }).first();
  }

  saveAsTemplateButton(): Locator {
    return this.page.getByRole("button", { name: /save as template/i }).first();
  }

  splitButton(): Locator {
    return this.page.getByRole("button", { name: /^split$/i }).first();
  }

  // ── Confirmation dialog (submit / approve / reject / return / cancel) ──
  // The redesigned workflow action dialog (pr-action-dialog) is an AlertDialog
  // (role="alertdialog"); other confirmations may use role="dialog".
  actionDialog(): Locator {
    return this.page.getByRole("alertdialog").or(this.page.getByRole("dialog")).first();
  }

  reasonInput(): Locator {
    return this.actionDialog().locator("textarea, input[type='text']").first();
  }

  confirmDialogButton(name: RegExp = /confirm|ok|yes/i): Locator {
    return this.actionDialog().getByRole("button", { name }).first();
  }

  // ── Status / verification ─────────────────────────────────────────────
  // override: filters to PR-specific status text
  statusBadge(): Locator {
    return this.page
      .locator("[data-slot='status'], [data-slot='badge'], [class*='badge']")
      .filter({ hasText: /draft|in.progress|approved|void|completed|returned|rejected|cancelled/i })
      .first();
  }

  async expectSavedToast() {
    await expect(
      this.page
        .locator('[data-sonner-toast], [role="status"], [role="alert"]')
        .filter({ hasText: /success|saved|created|updated|approved|rejected|submitted|สำเร็จ/i })
        .first(),
    ).toBeVisible({ timeout: 10_000 });
  }

  // ── Detail page tabs ─────────────────────────────────────────────────
  tabItems(): Locator {
    return this.page.getByRole("tab", { name: /^items$/i }).first();
  }

  /** The workflow stepper is the history trigger (aria-label "See who has handled this document"); it opens the history sheet. */
  tabWorkflowHistory(): Locator {
    return this.page.getByRole("button", { name: /see who has handled this document|^workflow history$/i }).first();
  }

  /** The history sheet opened by the trigger above. */
  workflowHistorySheet(): Locator {
    return this.page.getByRole("dialog").filter({ hasText: /workflow history/i }).last();
  }

  // ── Price Comparison dialog (Purchase / Approve stage) ───────────────
  /** Chevron in the select column that toggles an item's expanded panel. */
  expandItemButton(index = 0): Locator {
    return this.page.getByRole("button", { name: /^expand row$/i }).nth(index);
  }

  /** Scale icon in the expanded panel's left gutter — rendered only at Purchase/Approve stage. */
  comparePriceButton(index = 0): Locator {
    return this.page.getByRole("button", { name: /^compare price$/i }).nth(index);
  }

  priceComparisonDialog(): Locator {
    return this.page.getByRole("dialog").filter({ hasText: /price comparison/i });
  }

  /** Expand item row `index` and open its Price Comparison dialog. */
  async openPriceComparison(index = 0) {
    if ((await this.comparePriceButton(index).count()) === 0) {
      await this.expandItemButton(index).click();
    }
    await this.comparePriceButton(index).click();
    await this.priceComparisonDialog().waitFor({ state: "visible", timeout: 10_000 });
  }

  // ── Edit mode ────────────────────────────────────────────────────────
  editModeButton(): Locator {
    return this.page.getByRole("button", { name: /^edit$|edit pr|edit mode/i }).first();
  }

  async enterEditMode() {
    await this.editModeButton().click();
    // Wait for the edit-mode action bar (Save/Cancel) to appear rather than for
    // networkidle — the detail page polls notifications, so the network never
    // goes idle and waitForLoadState("networkidle") would eat the whole test
    // budget and time out.
    await expect(
      this.saveDraftButton().or(this.cancelFormButton()).first(),
      "edit mode did not open (no Save/Cancel after pressing Edit)",
    ).toBeVisible({ timeout: 10_000 });
  }

  /**
   * Leave edit mode. When the form is dirty, Cancel does not exit on its own —
   * it raises the shared "Discard changes?" AlertDialog (components/ui/
   * discard-dialog.tsx) and the form stays in edit mode until that is confirmed.
   * A caller that only clicks Cancel is therefore still in edit mode afterwards,
   * with the dialog covering the page.
   */
  async cancelEditMode() {
    await this.cancelFormButton().click({ timeout: 5_000 });
    const discard = this.page
      .getByRole("alertdialog")
      .getByRole("button", { name: /^(discard|ละทิ้ง|ทิ้ง)$/i })
      .first();
    if (await discard.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await discard.click();
    }
  }

  /**
   * Persist edit-mode changes. In the redesigned PR detail, Save commits both
   * field edits AND bulk item decisions (Approve/Reject/etc. only MARK the
   * decision in the form — Save is what writes it). There is no confirm dialog;
   * a "Purchase Request updated successfully" toast signals success.
   */
  async saveEditMode() {
    const save = this.saveDraftButton();
    await expect(save, "Save not visible in edit mode").toBeVisible({ timeout: 10_000 });
    const written = this.page
      .waitForResponse((r) => /\/purchase-requests\/[^/?]+(\/save)?(\?|$)/.test(r.url()) && ["PATCH", "PUT", "POST"].includes(r.request().method()), { timeout: 15_000 })
      .catch(() => null);
    await save.click({ timeout: 10_000 });
    const res = await written;
    const shown = (await this.page.locator("[data-sonner-toast]").allInnerTexts()).join(" | ");
    expect(res, `Save sent no write request (toasts: ${shown || "none"})`).not.toBeNull();
    expect(res!.ok(), `Save was refused ${res!.status()} ${res!.ok() ? "" : (await res!.text()).slice(0, 400)} (toasts: ${shown || "none"})`).toBe(true);
    await expect(
      this.page
        .locator('[data-sonner-toast], [role="status"], [role="alert"]')
        .filter({ hasText: /updated successfully|saved|success|สำเร็จ/i })
        .first(),
      "no success toast after Save in edit mode",
    ).toBeVisible({ timeout: 15_000 });
  }

  // ── Line item mutation ───────────────────────────────────────────────
  /** Requested-qty inputs of the item grid — one per row that has a product (count = rows with a chosen product). */
  requestedQtyInputs(): Locator {
    return this.page.locator('input[name^="items."][name$=".requested_qty"]');
  }

  /** Remove item row `index` with its trash button (FE pr-item-cells/delete-cell.tsx, aria-label "Remove"). */
  async removeLineItem(index: number) {
    const remove = this.page.locator("tbody tr").nth(index).getByRole("button", { name: /^remove$/i });
    await expect(remove, `row ${index} has no Remove button`).toBeVisible({ timeout: 10_000 });
    await remove.click();
    // Removing a row asks for confirmation first (FE pr-item-fields.tsx DeleteDialog, "Remove product").
    await this.page.getByRole("alertdialog").getByRole("button", { name: /delete|remove|confirm|yes/i }).last().click({ timeout: 10_000 });
  }

  /** Edit the requested quantity of field-array item `index` in place (the grid cells are inputs in edit mode). */
  async editLineItem(index: number, fields: PRLineItemInput) {
    if (fields.quantity === undefined) throw new Error("editLineItem: only quantity is editable in place");
    const q = this.page.locator(`input[name="items.${index}.requested_qty"]`);
    await expect(q, `requested qty input of item ${index} missing`).toBeVisible({ timeout: 10_000 });
    await q.fill(String(fields.quantity));
  }

  // ── Template picker (Step 3) ─────────────────────────────────────────
  createDialogTemplateOption(): Locator {
    return this.page.getByRole("button", { name: /from template|use template|template/i }).first();
  }

  // ── Create-from-template (its own page, not a dialog) ─────────────────
  // Picking "From Template" in the create dialog navigates to
  // /procurement/purchase-request/from-template (pr-create-dialog.tsx), a two-step
  // wizard: pick a template card → set quantities → Next, which lands on /new with
  // the form pre-filled. Nothing here is a dialog or a listbox.
  templatePicker(): Locator {
    return this.page.getByRole("heading", { name: /select template/i }).first();
  }

  templateCards(): Locator {
    return this.page.getByRole("button").filter({ hasText: /item\(s\)/i });
  }

  templatePickerEmpty(): Locator {
    return this.page.getByText(/no templates|empty|none available/i).first();
  }

  /** Step 2 of the wizard: the quantity step for the chosen template. */
  templateQtyNextButton(): Locator {
    return this.page.getByRole("button", { name: /^next$/i }).first();
  }

  /**
   * Walks the whole wizard: first template card → quantity step → Next, leaving
   * the browser on /new with the template's items loaded.
   */
  async selectFirstTemplate() {
    await this.templateCards().first().click();
    await this.templateQtyNextButton().waitFor({ state: "visible", timeout: 10_000 });
    await this.templateQtyNextButton().click();
    await this.page.waitForURL(/purchase-request\/new/, { timeout: 10_000 });
    await this.page.waitForLoadState("networkidle").catch(() => {});
  }

  // ── Status assertion ─────────────────────────────────────────────────
  async expectStatus(status: string) {
    await expect(
      this.page
        .locator("[data-slot='status'], [data-slot='badge'], [class*='badge']")
        .filter({ hasText: new RegExp(status, "i") })
        .first(),
    ).toBeVisible({ timeout: 10_000 });
  }

  // ── Edit-mode bulk actions (Approver actions) ────────────────────────
  // The live UI exposes Approve / Reject / Send for Review / Split only after
  // rows are selected in Edit Mode (BRD discrepancy: no per-row buttons). They
  // render as top-level <button>s — there is NO [role=toolbar] wrapper.
  // Selecting rows is a two-step interaction: clicking the "Select all"
  // checkbox opens a "Select Items" dialog where you choose the scope.
  bulkActionToolbar(): Locator {
    return this.page
      .getByRole("button", { name: /^approve$|^reject$|send for review|^split$/i })
      .first();
  }

  selectAllCheckboxInEditMode(): Locator {
    return this.page.getByRole("checkbox", { name: /select all/i }).first();
  }

  async selectAllInEditMode() {
    // Idempotent: the bulk toolbar (Approve / Send for Review / Reject / Split) is always
    // rendered in edit mode and only *enabled* once rows are selected, so "visible" proves
    // nothing — test the Approve button's enabled state instead.
    if (await this.bulkApproveInEditMode().isEnabled().catch(() => false)) return;
    const cb = this.selectAllCheckboxInEditMode();
    await expect(cb, "select-all checkbox missing in edit mode").toBeVisible({ timeout: 10_000 });
    await cb.click();
    // Clicking "Select all" opens a "Select Items" dialog; choose "All items".
    const dialog = this.page.getByRole("dialog", { name: /select items/i });
    if (await dialog.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await dialog.getByRole("button", { name: /all items/i }).first().click().catch(() => {});
      await dialog.waitFor({ state: "hidden", timeout: 5_000 }).catch(() => {});
    }
    await expect(this.bulkApproveInEditMode(), "selecting all rows did not enable the bulk actions").toBeEnabled({ timeout: 10_000 });
  }

  bulkApproveInEditMode(): Locator {
    return this.page.getByRole("button", { name: /^approve$/i }).first();
  }

  bulkRejectInEditMode(): Locator {
    return this.page.getByRole("button", { name: /^reject$/i }).first();
  }

  bulkSendForReviewInEditMode(): Locator {
    return this.page.getByRole("button", { name: /send for review/i }).first();
  }

  bulkSplitInEditMode(): Locator {
    return this.page.getByRole("button", { name: /^split$/i }).first();
  }

  // Document-level decision buttons. They are a second button of the same name: the first
  // ("Approve" / "Reject" in the item toolbar) only MARKS the selected rows, and once every
  // row carries that mark the summary footer grows a document button (FE
  // workflow/pr-footer-action.tsx: showApprove / showReject) that opens a confirm dialog and
  // sends PATCH .../approve | .../reject. The footer sits after the toolbar in the DOM, hence
  // `.last()`; callers must have marked the rows first, otherwise `.last()` is the toolbar button.
  documentApproveButton(): Locator {
    return this.page.getByRole("button", { name: /^approve$/i }).last();
  }

  documentRejectButton(): Locator {
    return this.page.getByRole("button", { name: /^reject$/i }).last();
  }

  // ── Edit-mode editable fields (Approver Edit Mode per FR-PR-011A) ─────
  // The edit-mode cells are bare react-hook-form inputs (no label), so they are addressed by
  // field-array name: FE pr-item-cells/approved-cell.tsx, foc-cell.tsx, pr-item-fields comment row.
  approvedQtyInput(rowIndex: number): Locator {
    return this.page.locator(`input[name="items.${rowIndex}.approved_qty"]`);
  }

  focQtyInput(rowIndex: number): Locator {
    return this.page.locator(`input[name="items.${rowIndex}.foc_qty"]`);
  }

  itemNoteInput(rowIndex: number): Locator {
    return this.page.locator(`input[name="items.${rowIndex}.comment"], textarea[name="items.${rowIndex}.comment"]`);
  }

  /** The delivery-point lookup trigger of an existing row (a popover button; absent when the row is read-only text). */
  deliveryPointInput(rowIndex: number): Locator {
    return this.page.locator("tbody tr").nth(rowIndex).locator('button[aria-haspopup="dialog"]:not([disabled])').first();
  }

  // ── Expanded row panel (pricing) ──────────────────────────────────────
  // FE pr-item-expand.tsx: pricing fields are editable controls only for the stage that owns them
  // (Purchase); for everyone else the same labels render as plain text with no control.
  /** The panel that expand-row reveals — identified by its Pricelist and Unit Price labels. */
  expandedPanel(): Locator {
    return this.page.getByRole("row").filter({ hasText: /pricelist/i }).filter({ hasText: /unit price/i }).last();
  }

  /** Expand item `index` if it is collapsed, so its pricing panel is rendered. */
  async expandItem(index = 0) {
    const collapse = this.page.getByRole("button", { name: /^collapse row$/i }).nth(index);
    if ((await collapse.count()) === 0) await this.expandItemButton(index).click();
    await expect(this.expandedPanel(), "expanding the row did not reveal the pricing panel").toBeVisible({ timeout: 10_000 });
  }

  // ── Edit-mode read-only fields (Approver cannot edit per FR-PR-011A) ──
  // Assert with expect(...).toHaveCount(0) after expandItem(): no control = read-only text.
  vendorReadOnlyCell(rowIndex: number): Locator {
    return this.expandedPanel().locator('button[aria-haspopup="dialog"]');
  }

  unitPriceReadOnlyCell(rowIndex: number): Locator {
    return this.page.locator(`#items-${rowIndex}-pricelist-price`);
  }

  discountReadOnlyCell(rowIndex: number): Locator {
    return this.page.locator(`#items-${rowIndex}-discount-rate`);
  }

  taxReadOnlyCell(_rowIndex: number): Locator {
    return this.expandedPanel().locator('button[aria-haspopup="dialog"]');
  }

  focQtyReadOnlyCell(rowIndex: number): Locator {
    return this.focQtyInput(rowIndex);
  }

  // ── Edit-mode editable fields (Purchaser scope per FR-PR-011A) ────────
  vendorInput(_rowIndex: number): Locator {
    return this.expandedPanel().locator('button[aria-haspopup="dialog"]').first();
  }

  unitPriceInput(rowIndex: number): Locator {
    return this.page.locator(`#items-${rowIndex}-pricelist-price`);
  }

  discountInput(rowIndex: number): Locator {
    return this.page.locator(`#items-${rowIndex}-discount-rate`);
  }

  taxProfileSelect(_rowIndex: number): Locator {
    return this.expandedPanel().locator('button[aria-haspopup="dialog"]').nth(1);
  }

  autoAllocateButton(): Locator {
    return this.page.getByRole("button", { name: /auto allocate/i }).first();
  }

  // ── Read-only verification (Purchaser cannot edit Approved Qty) ───────
  approvedQtyReadOnlyCell(rowIndex: number): Locator {
    return this.approvedQtyInput(rowIndex);
  }
}
