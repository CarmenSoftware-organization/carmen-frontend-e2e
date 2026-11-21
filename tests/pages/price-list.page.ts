import type { Page, Locator } from "@playwright/test";
import { expect } from "@playwright/test";
import { BasePage } from "./base.page";

export const LIST_PATH = "/vendor-management/price-list";
export const NEW_PATH = "/vendor-management/price-list/new";

export interface PriceListHeaderInput {
  number?: string;
  vendor?: string;
  currency?: string;
  validFrom?: string;
  validTo?: string;
  notes?: string;
}

export interface PriceListItemInput {
  product?: string;
  moq?: number | string;
  unit?: string;
  unitPrice?: number | string;
  leadTime?: number | string;
  notes?: string;
}

export class PriceListPage extends BasePage {
  // ── Navigation ────────────────────────────────────────────────────────
  async gotoList() {
    await this.page.goto(LIST_PATH);
    await this.page.waitForLoadState("networkidle");
  }

  async gotoDetail(id: string) {
    await this.page.goto(`${LIST_PATH}/${id}`);
    await this.page.waitForLoadState("networkidle");
  }

  // ── List page ────────────────────────────────────────────────────────
  addNewButton(): Locator {
    // The list header button reads "Add Price List". The old pattern wanted
    // "new price list" / "add new", neither of which matches it, so every test
    // that opened the create form was asserting against a locator that found
    // nothing — invisible until the swallowing .catch() came off.
    return this.page
      .getByRole("button", { name: /add price list|add new|new price.?list|^new$|^create$/i })
      .first();
  }

  searchButton(): Locator {
    return this.page.getByRole("button", { name: /^search$/i }).first();
  }

  /**
   * Status is no longer a combobox in the toolbar — the list has a single
   * "Filter" button whose popover offers Status / Currency / Vendor / Effective
   * Period (plus Clear and "Save current filters as view"). The old locator found
   * nothing, so the filter tests never filtered anything.
   */
  filterButton(): Locator {
    return this.page.getByRole("button", { name: /^filter$/i }).first();
  }

  /** Open the filter popover and reveal the Status entry. */
  statusFilter(): Locator {
    return this.page.getByText(/^status$/i).last();
  }

  async openStatusFilter(): Promise<void> {
    await this.filterButton().click({ timeout: 10_000 });
    const status = this.statusFilter();
    await status.waitFor({ state: "visible", timeout: 10_000 });
    await status.click({ timeout: 10_000 });
  }

  statusOption(name: RegExp | string): Locator {
    return this.page.getByRole("option", { name: typeof name === "string" ? new RegExp(name, "i") : name });
  }

  priceListRow(text: string): Locator {
    return this.page.getByRole("row").filter({ hasText: text }).first();
  }

  rowActionsTrigger(text: string): Locator {
    return this.priceListRow(text).getByRole("button", { name: /actions|more|menu/i }).first();
  }

  actionMenuItem(name: RegExp | string): Locator {
    return this.page.getByRole("menuitem", { name: typeof name === "string" ? new RegExp(name, "i") : name });
  }

  // override: matches "no … found" instead of base's "no … results"
  emptyState(): Locator {
    return this.page.getByText(/no.*found|no.*data|empty|ไม่พบ/i).first();
  }

  // ── Form ─────────────────────────────────────────────────────────────
  /**
   * The create form has no "price list number" any more — the record is
   * identified by a **Name** (`#pl-name`, placeholder "e.g. Quotation - Fresh
   * Produce"); the number is generated. Every label-based locator on this form
   * resolved to zero elements, which is why the header was never filled.
   */
  numberInput(): Locator {
    return this.page.locator("#pl-name");
  }

  /** Vendor is picked from a dialog of "<code> <name>" button cards, not typed. */
  vendorTrigger(): Locator {
    return this.page.getByRole("button", { name: /select vendor/i }).first();
  }

  async selectFirstVendor(): Promise<void> {
    const trigger = this.vendorTrigger();
    if ((await trigger.count()) === 0) return; // already chosen
    await trigger.click({ timeout: 10_000 });
    const card = this.page
      .locator('[role="dialog"], [role="alertdialog"]')
      .last()
      .getByRole("button")
      .filter({ hasText: /^[A-Z]\d{3}/ })
      .first();
    await card.waitFor({ state: "visible", timeout: 10_000 });
    await card.click({ timeout: 10_000 });
  }

  currencyTrigger(): Locator {
    return this.page.getByLabel(/currency/i).first();
  }

  /**
   * Effective From / To are date-picker **buttons** ("Pick a date"), not inputs —
   * `fill()` on them threw "Element is not an <input>…". Once a date is chosen the
   * button's own label becomes the date, so the remaining "Pick a date" button is
   * always the next one to set.
   */
  datePickerTrigger(): Locator {
    return this.page.getByRole("button", { name: /pick a date/i }).first();
  }

  /** Open the next unset date picker and take `day` from the month on show. */
  async pickNextDate(day = 15): Promise<void> {
    const trigger = this.datePickerTrigger();
    if ((await trigger.count()) === 0) return;
    await trigger.click({ timeout: 10_000 });
    const cell = this.page
      .getByRole("gridcell")
      .filter({ hasText: new RegExp(`^${day}$`) })
      .first();
    await cell.waitFor({ state: "visible", timeout: 10_000 });
    await cell.click({ timeout: 10_000 });
  }

  /**
   * Scoped to a form control on purpose: a bare `[name="description"]` also picks
   * up the document's `<meta name="description">`, which is never fillable — the
   * call then waited out its timeout on an element in <head>.
   */
  notesInput(): Locator {
    return this.page
      .locator('input[name="description"], textarea[name="description"]')
      .first();
  }

  addItemButton(): Locator {
    return this.page.getByRole("button", { name: /add item/i }).first();
  }

  /** The item row's first cell is a "Select Product" **button**, not a text box. */
  productInput(): Locator {
    return this.page.getByRole("button", { name: /select product/i }).first();
  }

  /** Open the product picker on the first item row and take the first entry. */
  async selectFirstProduct(): Promise<void> {
    const trigger = this.productInput();
    if ((await trigger.count()) === 0) return;
    await trigger.click({ timeout: 10_000 });
    const option = this.page
      .locator('[role="dialog"], [role="alertdialog"]')
      .last()
      .getByRole("button")
      .filter({ hasText: /\S/ })
      .first()
      .or(this.page.getByRole("option").first())
      .first();
    await option.waitFor({ state: "visible", timeout: 10_000 });
    await option.click({ timeout: 10_000 });
  }

  // The item fields are react-hook-form controls named `pricelist_detail.<n>.*`;
  // none of them carries a label the old getByLabel patterns could find.
  /**
   * Tax Profile is **required** on every item row and starts unset. Saving without
   * it leaves the form on /new with `aria-invalid="true"` on this very button and
   * no toast — which is what made "create a price list" look like it silently
   * failed even once the product picker worked.
   */
  taxProfileTrigger(): Locator {
    // A Popover + Command lookup now (FE c80f15e8 moved tax profile to the Lookup API), not a Radix
    // Select: a plain button reading "Select Tax Profile" in the item row.
    return this.page
      .locator("tbody tr")
      .first()
      .getByRole("button")
      .filter({ hasText: /select tax profile/i })
      .first();
  }

  /**
   * The item row's Unit. Required like Tax Profile, and just as quiet about it:
   * when it is empty the form marks the label with a `*` but sets **no**
   * `aria-invalid`, and pressing Create fires no request, shows no toast and
   * leaves you on /new. That combination reads exactly like a broken Save.
   */
  unitTrigger(): Locator {
    // Scoped by position, not by text: the control reads "Select Unit" on a fresh
    // row but goes **blank** once a product is chosen, so a hasText filter finds
    // nothing exactly when it matters. Within the row the order is Unit then Tax
    // Profile.
    return this.page.locator("tbody tr").first().getByRole("combobox").first();
  }

  async selectFirstUnit(): Promise<void> {
    const trigger = this.unitTrigger();
    if ((await trigger.count()) === 0) return;
    await trigger.click({ timeout: 10_000 });
    const option = this.page.getByRole("option").first();
    await option.waitFor({ state: "visible", timeout: 10_000 });
    await option.click({ timeout: 10_000 });
  }

  async selectFirstTaxProfile(): Promise<void> {
    const trigger = this.taxProfileTrigger();
    // Required field: wait for it rather than skipping when count() is read a beat too early.
    await trigger.waitFor({ state: "visible", timeout: 10_000 });
    await trigger.click({ timeout: 10_000 });
    // Lookup options are buttons with data-value inside the popover; the first is "None".
    // Pick a real VAT profile by name when there is one (this BU may also hold junk tax-profile
    // names from the security specs, so never take a loose match).
    const options = this.page.locator("[data-slot=popover-content]:visible button[data-value]");
    await options.first().waitFor({ state: "visible", timeout: 10_000 });
    const vat = options.filter({ hasText: /^\s*vat/i }).first();
    // The list opens with "None" and fills in once the lookup answers — wait for the VAT entry
    // instead of reading count() the instant the first option shows.
    if (await vat.waitFor({ state: "visible", timeout: 8_000 }).then(() => true, () => false)) {
      await vat.click({ timeout: 10_000 });
      return;
    }
    await options.filter({ hasNotText: /^\s*none\s*$/i }).first().click({ timeout: 10_000 });
  }

  moqInput(): Locator {
    return this.page.locator('input[name$=".moq_qty"]').first();
  }

  unitInput(): Locator {
    return this.page.getByLabel(/^unit$/i).first();
  }

  unitPriceInput(): Locator {
    return this.page.locator('input[name$=".price"]').first();
  }

  leadTimeInput(): Locator {
    return this.page.locator('input[name$=".lead_time_days"]').first();
  }

  // override: also matches Submit button in some flows
  saveButton(): Locator {
    return this.page.getByRole("button", { name: /^save$|^create$|^submit$/i }).first();
  }

  exportButton(): Locator {
    return this.page.getByRole("button", { name: /^export$/i }).first();
  }

  duplicateButton(): Locator {
    return this.page.getByRole("button", { name: /^duplicate$/i }).first();
  }

  markExpiredButton(): Locator {
    return this.page.getByRole("button", { name: /mark.*expired/i }).first();
  }

  // ── Confirmation dialog ──────────────────────────────────────────────
  /**
   * Confirmations in this app are Radix **AlertDialog** — `role="alertdialog"`,
   * which `getByRole("dialog")` does NOT match. This resolved to nothing, and
   * since almost every call site wraps the click in `.catch(() => {})`, the step
   * silently did nothing: PO Submit left the record in Draft while reporting
   * success. Match both roles, and take `.last()` so the always-mounted Command
   * Palette (also a dialog) never wins.
   */
  confirmDialogButton(name: RegExp = /confirm|delete|ok|yes/i): Locator {
    return this.page
      .locator('[role="dialog"], [role="alertdialog"]')
      .last()
      .getByRole("button", { name })
      .first();
  }

  cancelDialogButton(): Locator {
    return this.page
      .locator('[role="dialog"], [role="alertdialog"]')
      .last()
      .getByRole("button", { name: /^cancel$/i })
      .first();
  }

  // ── Form fill helpers ────────────────────────────────────────────────
  /**
   * Fill the create form. `validFrom` / `validTo` are honoured as "set this date
   * field", not as literal values: the form offers a calendar, so the day comes
   * from the month on show rather than from the string. Tests that need a
   * specific date must drive the picker themselves.
   */
  async fillHeader(data: PriceListHeaderInput) {
    // Wait for the form before touching anything. Every field here is looked up
    // with `count() > 0`, which answers immediately — so on a page that has not
    // finished rendering the create form, *every* field silently skipped and the
    // save then failed validation with no clue why. Callers should not have to
    // sleep first.
    await this.numberInput().waitFor({ state: "visible", timeout: 15_000 });
    if (data.number !== undefined) {
      const i = this.numberInput();
      if ((await i.count()) > 0) await i.fill(data.number, { timeout: 10_000 });
    }
    if (data.vendor !== undefined || data.number !== undefined) {
      // Vendor is required; pick one whenever we are filling the form for real.
      await this.selectFirstVendor();
    }
    if (data.validFrom !== undefined) await this.pickNextDate(15);
    if (data.validTo !== undefined) await this.pickNextDate(20);
    if (data.notes !== undefined) {
      const i = this.notesInput();
      if ((await i.count()) > 0) await i.fill(data.notes, { timeout: 10_000 });
    }
  }

  async addLineItem(data: PriceListItemInput) {
    await this.addItemButton().click({ timeout: 10_000 });
    if (data.product !== undefined) {
      // Picked from a dialog — `fill()` used to throw "Element is not an <input>"
      // here, which is what stopped every create test from ever adding a line.
      await this.selectFirstProduct();
    }
    if (data.moq !== undefined) {
      const i = this.moqInput();
      if ((await i.count()) > 0) await i.fill(String(data.moq), { timeout: 10_000 });
    }
    if (data.unitPrice !== undefined) {
      const i = this.unitPriceInput();
      if ((await i.count()) > 0) await i.fill(String(data.unitPrice), { timeout: 10_000 });
    }
    if (data.leadTime !== undefined) {
      const i = this.leadTimeInput();
      if ((await i.count()) > 0) await i.fill(String(data.leadTime), { timeout: 10_000 });
    }
    await this.selectFirstUnit();
    await this.selectFirstTaxProfile();
  }

  // ── Verification ─────────────────────────────────────────────────────
  async expectSavedToast() {
    await expect(
      this.page
        .locator('[data-sonner-toast], [role="status"], [role="alert"]')
        .filter({ hasText: /success|saved|created|updated|deleted|expired|exported|duplicated|สำเร็จ/i })
        .first(),
    ).toBeVisible({ timeout: 10_000 });
  }
}
