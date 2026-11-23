import { expect, type Locator } from "@playwright/test";
import { BasePage } from "./base.page";

const BASE = "/operation-plan/sales-consumption";

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** `2026-11-05` -> `November 5, 2026`, the date text the calendar cell puts in its accessible name. */
function longDate(day: string): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));
}

/**
 * Sales Consumption list (calendar / list / mapping views) and detail (`/operation-plan/sales-consumption/:id`).
 * Radix popovers of the lookup cells are driven by role / data-slot clicks, never coordinates.
 * หน้า Sales Consumption: ปฏิทิน/รายการ/Mapping และหน้ารายละเอียด
 */
export class SalesConsumptionPage extends BasePage {
  // ── List ─────────────────────────────────────────────────────────────
  /** `month` = `YYYY-MM` (default: the current month the page opens on). */
  async goto(month?: string) {
    await this.page.goto(month ? `${BASE}?month=${month}` : BASE);
    await expect(this.page.getByRole("tab", { name: "Calendar" })).toBeVisible({ timeout: 20_000 });
  }

  /** A calendar cell by `YYYY-MM-DD`: a link when it has an SC to open, else a group; both carry the date in the name. */
  calendarDay(day: string): Locator {
    const name = new RegExp(`^${esc(longDate(day))}`);
    return this.page.getByRole("link", { name }).or(this.page.getByRole("group", { name }));
  }

  /** The status text inside the cell ("Posted", "Pending", "No file", ...). Absent for future / before-start days. */
  dayStatus(day: string): Locator {
    return this.calendarDay(day).locator("span.font-medium.leading-tight").first();
  }

  /** The three view tabs. */
  mappingTab(): Locator {
    return this.page.getByRole("tab", { name: "Mapping" });
  }

  listTab(): Locator {
    return this.page.getByRole("tab", { name: "List" });
  }

  /** Inner Mapping tabs. */
  outletsMappingTab(): Locator {
    return this.page.getByRole("tab", { name: /^Outlet/ });
  }

  itemsMappingTab(): Locator {
    return this.page.getByRole("tab", { name: /^POS item/ });
  }

  /** Open Mapping, the inner tab and (when given) the POS store, directly through the URL then the store select. */
  async openMapping(tab: "outlets" | "items", storeName?: string) {
    await this.page.goto(`${BASE}?view=mapping&map=${tab}`);
    await expect(this.mappingTab()).toHaveAttribute("data-state", "active", { timeout: 20_000 });
    if (storeName) await this.selectStore(storeName);
  }

  storeSelect(): Locator {
    return this.page.getByRole("combobox", { name: "Store" });
  }

  async selectStore(name: string) {
    await this.storeSelect().click();
    await this.page.getByRole("option", { name, exact: true }).click();
  }

  /** Both mapping tables show their rows by the code cell. */
  private rowByCode(code: string): Locator {
    return this.page.locator("[data-slot=data-row]").filter({ has: this.page.getByRole("cell", { name: code, exact: true }) });
  }

  outletRow(code: string): Locator {
    return this.rowByCode(code);
  }

  itemRow(code: string): Locator {
    return this.rowByCode(code);
  }

  /** Pick the first option of a lookup popover whose text matches `search`. */
  private async pick(trigger: Locator, search: string) {
    await trigger.click();
    const pop = this.page.locator("[data-slot=popover-content]:visible").last();
    await pop.locator("[data-slot=command-input]").fill(search);
    const option = pop.locator("button[data-value]").filter({ hasText: new RegExp(esc(search), "i") }).first();
    await expect(option).toBeVisible();
    // force: an option in a lookup inside a re-rendering editable grid never settles for the stability check
    await option.click({ force: true });
  }

  private lookupIn(row: Locator): Locator {
    return row.locator("button[aria-expanded]").first();
  }

  /** Outlet -> Location (saves on pick; toast "Location saved"). */
  async setOutletLocation(code: string, locationName: string) {
    await this.pick(this.lookupIn(this.outletRow(code)), locationName);
  }

  /** POS item -> Recipe (saves on pick; toast "Recipe saved"). The item leaves the default "Needs mapping" filter. */
  async setItemRecipe(code: string, recipeName: string) {
    await this.pick(this.lookupIn(this.itemRow(code)), recipeName);
  }

  async ignoreItem(code: string) {
    await this.itemRow(code).getByRole("button", { name: "Ignore", exact: true }).click();
  }

  /** Items status filter button: "All" | "Needs mapping" | "Mapped" | "Ignored". */
  itemFilter(label: "All" | "Needs mapping" | "Mapped" | "Ignored"): Locator {
    return this.page.getByRole("group", { name: "Item status" }).getByRole("button", { name: label, exact: true });
  }

  // ── Detail ───────────────────────────────────────────────────────────
  async gotoDetail(id: string) {
    await this.page.goto(`${BASE}/${id}`);
    await expect(this.page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 20_000 });
    await expect(this.page.getByRole("tab", { name: "Ingredients" })).toBeVisible();
  }

  scNo(): Locator {
    return this.page.getByRole("heading", { level: 1 });
  }

  tab(name: "Sales lines" | "Ingredients" | "History"): Locator {
    return this.page.getByRole("tab", { name });
  }

  /**
   * Switch to the Sales lines tab and wait until it is the active one. Observed on dev 2026-11-23: after a line
   * edit saved from this tab the page came back on `?tab=ingredients`, so call this before each line edit.
   */
  async showSalesLines() {
    await this.tab("Sales lines").click();
    await expect(this.tab("Sales lines")).toHaveAttribute("data-state", "active");
  }

  verifyButton(): Locator {
    return this.page.getByRole("button", { name: /^(Verify|Re-verify) on-hand$/ });
  }

  postButton(): Locator {
    return this.page.getByRole("button", { name: "Post & deduct stock" });
  }

  voidButton(): Locator {
    return this.page.getByRole("button", { name: "Void", exact: true });
  }

  voidDialog(): Locator {
    return this.page.getByRole("dialog", { name: "Void this Sales Consumption?" });
  }

  /** Open the void dialog, give a reason and press its Void button. */
  async confirmVoid(reason: string) {
    await this.voidButton().click();
    await this.voidDialog().getByLabel("Void Reason").fill(reason);
    await this.voidDialog().getByRole("button", { name: "Void", exact: true }).click();
  }

  /** The line of the Sales lines tab for an outlet code + POS item code (cells 1 and 3 hold the codes). */
  salesLine(outletCode: string, itemCode: string): Locator {
    const exact = (c: string) => new RegExp(`^${esc(c)}$`);
    return this.page
      .locator("[data-slot=data-row]")
      .filter({ has: this.page.locator("td:nth-child(1) .font-medium").filter({ hasText: exact(outletCode) }) })
      .filter({ has: this.page.locator("td:nth-child(3) .font-medium").filter({ hasText: exact(itemCode) }) });
  }

  async setLineLocation(outletCode: string, itemCode: string, locationName: string) {
    await this.pick(this.lookupIn(this.salesLine(outletCode, itemCode).locator("td:nth-child(2)")), locationName);
  }

  /** Set a line's recipe; `setItemDefault` then ticks "Also set as item default" (shown once the line is overridden). */
  async setLineRecipe(outletCode: string, itemCode: string, recipeName: string, opts: { setItemDefault?: boolean } = {}) {
    const row = this.salesLine(outletCode, itemCode);
    await this.pick(this.lookupIn(row.locator("td:nth-child(4)")), recipeName);
    if (opts.setItemDefault) {
      const box = this.salesLine(outletCode, itemCode).getByRole("checkbox", { name: "Also set as item default" });
      await expect(box).toBeVisible();
      await box.click();
    }
  }

  /** One ingredient group card by its location (heading reads "CODE · Name"). */
  ingredientGroup(locationName: string): Locator {
    return this.page
      .locator("section")
      .filter({ has: this.page.getByRole("heading", { level: 3 }).filter({ hasText: new RegExp(esc(locationName)) }) });
  }

  /**
   * The "Can deduct?" cell of a product in a group (last cell of a pending SC): text "Yes" when the on-hand covers
   * it, "Short <qty>" when it does not, "Not checked" before verify.
   */
  ingredientRowState(locationName: string, productName: string): Locator {
    return this.ingredientGroup(locationName)
      .locator("[data-slot=data-row]")
      .filter({ hasText: new RegExp(esc(productName)) })
      .locator("td")
      .last();
  }

  /** "N sale lines arrived after this was posted..." note of a posted SC. */
  lateLinesWarning(): Locator {
    return this.page.getByRole("status").filter({ hasText: /arrived after this was posted/ });
  }

  /** Links to the Stock Outs the SC created (header and ingredient groups). */
  stockOutLinks(): Locator {
    return this.page.locator('a[href*="/inventory-management/inventory-adjustment/"][href*="type=stock-out"]');
  }
}
