import type { Page, Locator } from "@playwright/test";
import { expect } from "@playwright/test";
import { BasePage } from "./base.page";

export const LIST_PATH = "/vendor-management/price-list-template";
export const NEW_PATH = "/vendor-management/price-list-template/new";

// Superset of header fields. The redesigned form only renders name (required),
// currency (required), description, validity period and vendor instruction;
// the remaining switch/reminder fields are kept for backward compatibility with
// older tests and are no-ops when their controls are absent.
export interface TemplateHeaderInput {
  name?: string;
  description?: string;
  /** "first" picks the first available currency option; a string matches by label/code. */
  currency?: "first" | string;
  validityDays?: number | string;
  vendorInstructions?: string;
  allowMultiMOQ?: boolean;
  requireLeadTime?: boolean;
  maxItemsPerSubmission?: number | string;
  sendReminders?: boolean;
  reminderDays?: number[];
  escalationDays?: number | string;
}

/**
 * Page object for the **redesigned** Pricelist Template module.
 *
 * The create/edit screen is a rich document form on `/price-list-template/new`
 * (and `/:id`): a hero NameField, a required LookupCurrency Radix Select, an
 * optional description Textarea, validity, and an inline product table. The list
 * exposes an "Add Template" button, a SearchInput (fires onSearch on Enter), and
 * per-row "Row actions" menus whose Delete opens a DeleteDialog (AlertDialog).
 *
 * (The previous tabbed/dialog-based clone / activate-deactivate / add-products
 * affordances were removed in the redesign — those flows no longer exist here.)
 */
export class PriceListTemplatePage extends BasePage {
  // ── Navigation ────────────────────────────────────────────────────────
  async gotoList() {
    await this.page.goto(LIST_PATH);
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
  newButton(): Locator {
    return this.page
      .getByRole("button", { name: /add template|add price.?list template|^add$|^create$/i })
      .first();
  }

  statusTab(name: RegExp | string): Locator {
    return this.page.getByRole("tab", { name: typeof name === "string" ? new RegExp(name, "i") : name });
  }

  templateRow(text: string): Locator {
    return this.page.getByRole("row").filter({ hasText: text }).first();
  }

  templateCard(text: string): Locator {
    return this.page.locator("[data-slot='card'], article, .card").filter({ hasText: text }).first();
  }

  async openTemplate(text: string) {
    const card = this.templateCard(text);
    if ((await card.count()) > 0) {
      await card.click();
    } else {
      await this.templateRow(text).click();
    }
    await this.page.waitForLoadState("networkidle");
  }

  /**
   * Open the first template in the list by clicking its name button (the row
   * itself is not clickable — navigation is wired to the name cell). Returns
   * false if the list is empty so the caller can skip.
   */
  async openFirst(): Promise<boolean> {
    await this.gotoList();
    const firstName = this.page.getByRole("row").nth(1).getByRole("button").first();
    if ((await firstName.count()) === 0) return false;
    await firstName.click();
    await this.page.waitForLoadState("networkidle");
    return true;
  }

  /**
   * Filter the list to `name` (SearchInput fires on Enter), then open it. Lands
   * on the detail page in view mode.
   */
  async openByName(name: string) {
    await this.gotoList();
    const search = this.searchInput();
    if ((await search.count()) > 0) {
      await search.fill(name).catch(() => {});
      await search.press("Enter").catch(() => {});
    }
    await this.page.getByText(name, { exact: false }).first().click();
    await this.page.waitForLoadState("networkidle");
  }

  // ── Row actions (edit / delete) ──────────────────────────────────────
  rowActionsTrigger(text: string): Locator {
    return this.templateRow(text).getByRole("button", { name: /row actions|actions|more/i }).first();
  }

  /**
   * Open a row's actions menu and click Delete, then either confirm or cancel in
   * the DeleteDialog (AlertDialog). Caller must have the row visible (search first).
   */
  async deleteViaRowActions(text: string, opts: { confirm: boolean }) {
    await this.rowActionsTrigger(text).click({ timeout: 10_000 });
    await this.page.getByRole("menuitem", { name: /^(delete|ลบ)$/i }).first().click({ timeout: 10_000 });
    const dialog = this.page.getByRole("alertdialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    const name = opts.confirm ? /^(delete|confirm|ลบ|ok)$/i : /^(cancel|ยกเลิก)$/i;
    await dialog.getByRole("button", { name }).click();
  }

  // ── Form (create / edit) ─────────────────────────────────────────────
  nameInput(): Locator {
    // Redesigned hero NameField — targeted by its placeholder.
    return this.page.getByPlaceholder(/Fresh Produce Template/i).first();
  }

  descriptionInput(): Locator {
    // Optional description Textarea. Targeted by its react-hook-form
    // register name (i18n-independent) rather than the localized "Optional"
    // placeholder, which changes with the active locale.
    return this.page.locator('textarea[name="description"]').first();
  }

  currencySelect(): Locator {
    return this.page.getByRole("combobox").first();
  }

  /** Open the required currency Select and pick the first available option. */
  async selectFirstCurrency() {
    await this.currencySelect().click();
    await this.page.getByRole("option").first().click();
  }

  validityDaysInput(): Locator {
    // Redesign replaced the labeled "validity period" input with a
    // <PltValidityStepper>: −/+ buttons around a number input (role
    // "spinbutton"). It is the only spinbutton on a fresh create form
    // (the product table — which adds qty spinbuttons — starts empty).
    return this.page.getByRole("spinbutton").first();
  }

  vendorInstructionsInput(): Locator {
    // Vendor-instruction Textarea, targeted by its react-hook-form register
    // name (the old label-based lookup broke — it is now a placeholder-only
    // Textarea inside the "Instructions to vendor" card).
    return this.page.locator('textarea[name="vendor_instruction"]').first();
  }

  // matches the toolbar submit button ("Save" / "Create" / "Save Changes")
  saveButton(): Locator {
    return this.page.getByRole("button", { name: /save changes|^save$|^create$|บันทึก|สร้าง/i }).first();
  }

  async fillHeader(data: TemplateHeaderInput) {
    if (data.name !== undefined) {
      const n = this.nameInput();
      if ((await n.count()) > 0) await n.fill(data.name);
    }
    if (data.currency !== undefined) {
      const c = this.currencySelect();
      if ((await c.count()) > 0) {
        await c.click();
        const option =
          data.currency === "first"
            ? this.page.getByRole("option").first()
            : this.page.getByRole("option", { name: new RegExp(data.currency, "i") }).first();
        await option.click().catch(() => {});
      }
    }
    if (data.description !== undefined) {
      const d = this.descriptionInput();
      if ((await d.count()) > 0) await d.fill(data.description);
    }
    if (data.validityDays !== undefined) {
      const v = this.validityDaysInput();
      if ((await v.count()) > 0) await v.fill(String(data.validityDays));
    }
    if (data.vendorInstructions !== undefined) {
      const v = this.vendorInstructionsInput();
      if ((await v.count()) > 0) await v.fill(data.vendorInstructions);
    }
    // maxItemsPerSubmission: the redesign removed this field — no-op, kept on
    // the interface only for backward compatibility with older callers.
  }

  // ── Product selection (tree lookup, no add-row button) ──────────────
  // Two redesigns happened here. The original "Add Products" dialog (checkbox
  // picker + Confirm Selection) became an inline table with an "Add product"
  // button; that button is gone too. In create/edit mode the form now renders
  // <TreeProductLookup> (components/share/tree-product-lookup.tsx) on the left
  // — a searchable tree of category → product with a checkbox per node — and the
  // chosen products appear as cards on the right (plt-item-fields.tsx:155-180).
  // There is no "empty row" to create any more: a row exists only because a
  // product was ticked.
  //
  // The "Add Item" button still exists, but only in the *view* mode empty state
  // (plt-item-fields.tsx:146), where it is a shortcut into edit mode — not the
  // control that adds a row.
  productLookupSearch(): Locator {
    return this.page.getByPlaceholder(/search by code or name/i).first();
  }

  /** Checkboxes inside the lookup tree: group nodes and leaf products alike. */
  productLookupCheckboxes(): Locator {
    return this.page.getByRole("checkbox");
  }

  /**
   * Tick exactly one product in the lookup tree.
   *
   * Group nodes carry their own checkbox that selects every product beneath them
   * — ticking the wrong one silently adds hundreds of rows (measured: 450), which
   * then makes "remove one product" leave the list far from empty. So narrow the
   * tree with the search box first and take a leaf: leaf rows have no expander
   * button next to their checkbox, group rows do.
   */
  async pickFirstProduct(search = "a") {
    const box = this.productLookupSearch();
    if ((await box.count()) > 0) {
      await box.fill(search, { timeout: 10_000 });
      await this.page.waitForTimeout(600);
    }
    const leafRow = this.page
      .locator("div")
      .filter({ has: this.page.getByRole("checkbox") })
      .filter({ hasNot: this.page.getByRole("button", { name: /expand|collapse/i }) })
      .last();
    const leafBox = leafRow.getByRole("checkbox").last();
    await leafBox.waitFor({ state: "visible", timeout: 10_000 });
    await leafBox.click({ timeout: 10_000 });
    await this.page.waitForTimeout(500);
  }

  /** Cards for the products already added to the template. */
  productCards(): Locator {
    return this.page.getByRole("button", { name: /remove product|remove tier/i });
  }

  productsEmptyState(): Locator {
    return this.page.getByText(/no products yet|no items/i).first();
  }

  /** Per-row remove (X) button; its presence proves a product row exists. */
  removeProductRowButton(): Locator {
    return this.page.getByRole("button", { name: /remove tier|remove product/i });
  }

  /**
   * Remove the first product and confirm the dialog that follows.
   *
   * Removing is not immediate: the app raises a "Remove Product …" confirmation
   * ("Removing this product will delete all of its MOQ …"), so a test that clicks
   * the X and then checks for the empty state sees the row still there.
   */
  async removeFirstProduct() {
    await this.removeProductRowButton().first().click({ timeout: 10_000 });
    const dialog = this.page.getByRole("alertdialog").or(this.page.getByRole("dialog")).last();
    await dialog.waitFor({ state: "visible", timeout: 5_000 }).catch(() => {});
    const confirm = dialog
      .getByRole("button", { name: /^(remove|delete|confirm|ลบ|ยืนยัน)$/i })
      .first();
    if (await confirm.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await confirm.click({ timeout: 10_000 });
      await dialog.waitFor({ state: "hidden", timeout: 10_000 }).catch(() => {});
    }
  }

  // ── Status (redesigned activate / deactivate flow) ──────────────────
  // Dedicated Activate/Deactivate buttons were removed; the status is a Select in
  // the form, rendered only in create/edit mode. It used to sit in an <aside>, but
  // the layout no longer has one at all (verified 2026-09-19: `aside` count is 0),
  // so match on the control's own value instead — the page has exactly two
  // comboboxes, the currency one showing "THB" and this one showing the status.
  statusSelect(): Locator {
    return this.page
      .getByRole("combobox")
      .filter({ hasText: /draft|active|inactive/i })
      .first();
  }

  async selectStatus(label: "Active" | "Inactive" | "Draft") {
    await this.statusSelect().click();
    await this.page
      .getByRole("option", { name: new RegExp(`^${label}$`, "i") })
      .first()
      .click();
  }

  // ── Clone (removed in redesign) ─────────────────────────────────────
  // The Clone/Duplicate action no longer exists; only a decorative "Copy"
  // glyph badge (a <span>, not a button) remains in the detail toolbar.
  cloneButton(): Locator {
    return this.page.getByRole("button", { name: /clone|duplicate/i });
  }

  cloneMenuItem(): Locator {
    return this.page.getByRole("menuitem", { name: /clone|duplicate/i });
  }

  rowActionsButton(): Locator {
    return this.page.getByRole("button", { name: /row actions/i }).first();
  }

  // ── Filters / sorting (list edge cases) ──────────────────────────────
  applyFilterButton(): Locator {
    return this.page.getByRole("button", { name: /apply filters?/i }).first();
  }

  nameColumnHeader(): Locator {
    return this.page.getByRole("columnheader", { name: /^name$/i }).first();
  }

  // ── Verification ─────────────────────────────────────────────────────
  /** Success/created/updated/deleted toast — for both presence and absence checks. */
  successToast(): Locator {
    return this.page
      .locator('[data-sonner-toast], [role="status"], [role="alert"]')
      .filter({ hasText: /success|saved|created|updated|deleted|สำเร็จ/i });
  }

  async expectSavedToast() {
    await expect(this.successToast().first()).toBeVisible({ timeout: 10_000 });
  }
}
