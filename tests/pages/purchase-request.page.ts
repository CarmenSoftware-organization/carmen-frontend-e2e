import type { Page, Locator } from "@playwright/test";
import { expect } from "@playwright/test";
import { BasePage } from "./base.page";

export const LIST_PATH = "/procurement/purchase-request";
export const NEW_PATH = "/procurement/purchase-request/new";
export const APPROVALS_PATH = "/procurement/purchase-requests/my-approvals";

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
    await this.newButton().click();
    // Dialog may auto-open or navigate directly to /new — handle both
    const dialog = this.page.getByRole("dialog");
    if ((await dialog.count()) > 0) {
      await this.createDialogBlankOption().click({ timeout: 5_000 }).catch(() => {});
    }
    await this.page.waitForURL(/purchase-request\/new/, { timeout: 10_000 }).catch(() => {});
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
  async selectFirstWorkflow(): Promise<boolean> {
    const trigger = this.page.getByRole("combobox").first();
    return await this.pickFirstInCombobox(trigger);
  }

  async fillHeader(data: PRHeaderInput) {
    // Redesigned create form header is just: workflow (required) + description.
    await this.selectFirstWorkflow().catch(() => {});
    if (data.description !== undefined) {
      const d = this.descriptionInput();
      if ((await d.count()) > 0) await d.fill(data.description);
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
    await this.selectFirstWorkflow().catch(() => {});

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
    if (!(await this.pickFirstInCombobox(row.getByRole("button", { name: /select location/i }).first()))) {
      throw new Error("addLineItem: could not pick a location — the row's Select Location trigger was absent or its list was empty");
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
    await this.pickFirstInCombobox(row.getByRole("button", { name: /select unit/i }).first()).catch(() => {});
    await this.pickFirstInCombobox(row.getByRole("button", { name: /select delivery point/i }).first()).catch(() => {});
    if (data.isFOC) {
      const foc = row.getByRole("checkbox", { name: /foc/i }).first();
      if ((await foc.count()) > 0) await foc.check({ force: true }).catch(() => {});
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

  tabWorkflowHistory(): Locator {
    return this.page.getByRole("tab", { name: /workflow history|workflow/i }).first();
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
    await this.saveDraftButton()
      .or(this.cancelFormButton())
      .first()
      .waitFor({ state: "visible", timeout: 10_000 })
      .catch(() => {});
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
    if (!(await save.isVisible().catch(() => false))) return;
    await save.click({ timeout: 5_000 }).catch(() => {});
    await this.page
      .locator('[data-sonner-toast], [role="status"], [role="alert"]')
      .filter({ hasText: /updated successfully|saved|success|สำเร็จ/i })
      .first()
      .waitFor({ state: "visible", timeout: 10_000 })
      .catch(() => {});
  }

  // ── Line item mutation ───────────────────────────────────────────────
  async removeLineItem(index: number) {
    const row = this.itemRow(index);
    const remove = row.getByRole("button", { name: /remove|delete|trash/i }).first();
    if ((await remove.count()) > 0) await remove.click();
  }

  async editLineItem(index: number, fields: PRLineItemInput) {
    const row = this.itemRow(index);
    const editBtn = row.getByRole("button", { name: /edit/i }).first();
    if ((await editBtn.count()) > 0) {
      await editBtn.click();
      await this.page.waitForLoadState("domcontentloaded").catch(() => {});
    }
    if (fields.quantity !== undefined) {
      const q = this.page.getByLabel(/^quantity$|^qty$/i).first();
      if ((await q.count()) > 0) await q.fill(String(fields.quantity));
    }
    if (fields.description !== undefined) {
      const d = this.page.getByLabel(/item description/i).first();
      if ((await d.count()) > 0) await d.fill(fields.description);
    }
    const save = this.page.getByRole("button", { name: /^save$|^update$/i }).last();
    if ((await save.count()) > 0) await save.click({ timeout: 5_000 }).catch(() => {});
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
    // Idempotent: if the bulk actions are already showing, rows are selected.
    if (await this.bulkActionToolbar().isVisible().catch(() => false)) return;
    const cb = this.selectAllCheckboxInEditMode();
    if ((await cb.count()) === 0) return;
    await cb.click();
    // Clicking "Select all" opens a "Select Items" dialog; choose "All items".
    const dialog = this.page.getByRole("dialog", { name: /select items/i });
    if (await dialog.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await dialog.getByRole("button", { name: /all items/i }).first().click().catch(() => {});
      await dialog.waitFor({ state: "hidden", timeout: 5_000 }).catch(() => {});
    }
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

  // ── Edit-mode editable fields (Approver Edit Mode per FR-PR-011A) ─────
  approvedQtyInput(rowIndex: number): Locator {
    return this.itemRow(rowIndex).getByLabel(/approved.*(qty|quantity)/i).first();
  }

  itemNoteInput(rowIndex: number): Locator {
    return this.itemRow(rowIndex).getByLabel(/item note|note/i).first();
  }

  deliveryPointInput(rowIndex: number): Locator {
    return this.itemRow(rowIndex).getByLabel(/delivery point/i).first();
  }

  // ── Edit-mode read-only fields (Approver cannot edit per FR-PR-011A) ──
  // Returns the cell/input element; tests assert it has [disabled], [readonly],
  // or is a non-input element (e.g. a span).
  vendorReadOnlyCell(rowIndex: number): Locator {
    return this.itemRow(rowIndex).getByLabel(/vendor/i).first();
  }

  unitPriceReadOnlyCell(rowIndex: number): Locator {
    return this.itemRow(rowIndex).getByLabel(/unit price/i).first();
  }

  discountReadOnlyCell(rowIndex: number): Locator {
    return this.itemRow(rowIndex).getByLabel(/discount/i).first();
  }

  taxReadOnlyCell(rowIndex: number): Locator {
    return this.itemRow(rowIndex).getByLabel(/tax/i).first();
  }

  focQtyReadOnlyCell(rowIndex: number): Locator {
    return this.itemRow(rowIndex).getByLabel(/foc.*qty|free.*charge/i).first();
  }

  // ── Edit-mode editable fields (Purchaser scope per FR-PR-011A) ────────
  // Purchaser allocates vendor + pricing in Edit Mode. These locators
  // target the SAME DOM cells as the *ReadOnlyCell methods above; tests
  // assert toBeEditable() here vs toBeDisabled() on the read-only ones.
  vendorInput(rowIndex: number): Locator {
    return this.itemRow(rowIndex).getByLabel(/vendor/i).first();
  }

  unitPriceInput(rowIndex: number): Locator {
    return this.itemRow(rowIndex).getByLabel(/unit price/i).first();
  }

  discountInput(rowIndex: number): Locator {
    return this.itemRow(rowIndex).getByLabel(/discount/i).first();
  }

  taxProfileSelect(rowIndex: number): Locator {
    return this.itemRow(rowIndex).getByLabel(/tax/i).first();
  }

  autoAllocateButton(): Locator {
    return this.page.getByRole("button", { name: /auto allocate/i }).first();
  }

  // ── Read-only verification (Purchaser cannot edit Approved Qty) ───────
  approvedQtyReadOnlyCell(rowIndex: number): Locator {
    return this.itemRow(rowIndex).getByLabel(/approved.*(qty|quantity)/i).first();
  }
}
