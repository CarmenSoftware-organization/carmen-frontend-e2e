import { expect, type Locator, type Page } from "@playwright/test";
import { BasePage } from "./base.page";

const BASE = "/accounting/accounts-payable";

/** URL segment of each AP document type (`invoice` is the default list). */
export type ApPageType = "invoice" | "deposit" | "debit-note" | "credit-note";

export type TotalField = "net" | "vat" | "total" | "open";

/** The footer summary label each total field carries in the English UI. */
const TOTAL_LABEL: Record<TotalField, string> = { net: "Net Amount", vat: "VAT", total: "Total", open: "Unpaid Amount" };

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** `1,069.99 THB` -> 1069.99 */
export function amountOf(text: string): number {
  const m = /-?[\d,]+(\.\d+)?/.exec(text);
  if (!m) throw new Error(`no amount in "${text}"`);
  return Number(m[0].replace(/,/g, ""));
}

export interface LineInput {
  description: string;
  qty: number;
  price: number;
  /** The price already contains VAT. */
  incVat?: boolean;
  /** Part of the debit account code to search, default the expense account. */
  account?: string | null;
}

/**
 * AP invoice list + detail (`/accounting/accounts-payable/<type>`). Locators are factories so they survive navigations.
 * The form is the same component for `new` and an existing draft; the line account and VAT profile live in the
 * per-line "Invoice Item Detail" dialog, everything else is inline in the lines table.
 */
export class ApInvoicePage extends BasePage {
  async gotoList(type: ApPageType = "invoice") {
    await this.page.goto(`${BASE}/${type}`);
    await expect(this.searchBox()).toBeVisible();
  }

  async gotoDetail(id: string, type: ApPageType = "invoice") {
    await this.page.goto(`${BASE}/${type}/${id}`);
    await expect(this.statusChip()).toBeVisible({ timeout: 20_000 });
  }

  async gotoNew(type: ApPageType = "invoice") {
    await this.page.goto(`${BASE}/${type}/new`);
    await expect(this.saveDraftButton()).toBeVisible();
  }

  // ── List ─────────────────────────────────────────────────────────────
  searchBox(): Locator {
    return this.page.getByPlaceholder("Search...");
  }

  async search(text: string) {
    await this.searchBox().fill(text);
    await this.searchBox().press("Enter");
  }

  /** A list row by any text it shows (AP no., vendor invoice no.). */
  row(no: string): Locator {
    return this.page.getByRole("row").filter({ hasText: no });
  }

  /** Every body row of the list table. */
  rows(): Locator {
    return this.page.locator("table tbody tr");
  }

  /** The status chip, in a list row when `scope` is given, else on the detail header. */
  statusChip(scope?: Locator): Locator {
    return (scope ?? this.page).locator("[data-slot=status-chip]").first();
  }

  /** Tick one status in the list's Filter menu. */
  async filterStatus(label: string) {
    await this.page.getByRole("button", { name: /^Filter/ }).click();
    await this.page.getByText("Status", { exact: true }).last().click();
    const pop = this.page.locator("[data-slot=popover-content]:visible, [role=menu]:visible").last();
    await pop.getByText(label, { exact: true }).click();
    await this.page.keyboard.press("Escape");
  }

  newButton(): Locator {
    return this.page.getByRole("button", { name: "New Invoice" });
  }

  // ── Detail footer ────────────────────────────────────────────────────
  /** One total of the footer summary (net / vat / total / unpaid). */
  totalField(name: TotalField): Locator {
    return this.page
      .locator("div.overflow-hidden.tabular-nums")
      .locator(`xpath=.//span[normalize-space(.)='${TOTAL_LABEL[name]}']/following-sibling::span[1]`);
  }

  async totalOf(name: TotalField): Promise<number> {
    await expect(this.totalField(name)).toBeVisible();
    return amountOf(await this.totalField(name).innerText());
  }

  // ── Detail actions ───────────────────────────────────────────────────
  button(name: string): Locator {
    return this.page.getByRole("button", { name, exact: true });
  }
  saveDraftButton(): Locator {
    return this.button("Save Draft");
  }
  editButton(): Locator {
    return this.button("Edit");
  }
  submitButton(): Locator {
    return this.button("Submit");
  }
  voidButton(): Locator {
    return this.button("Void");
  }

  voidDialog(): Locator {
    return this.page.getByRole("dialog", { name: "Void invoice" });
  }

  /** Open the void dialog, give a reason and press its Void button. Returns the confirm click's promise. */
  async confirmVoid(reason: string) {
    await this.voidButton().click();
    await this.voidDialog().getByLabel("Reason").fill(reason);
    await this.voidDialog().getByRole("button", { name: "Void", exact: true }).click();
  }

  /** A toast whose text matches. */
  toastWith(re: RegExp): Locator {
    return this.page.locator("[data-sonner-toast]").filter({ hasText: re });
  }

  // ── Form ─────────────────────────────────────────────────────────────
  vendorInvoiceInput(): Locator {
    return this.page
      .locator("[data-slot=field]")
      .filter({ has: this.page.locator("[data-slot=field-label]", { hasText: /^\s*Vendor Invoice\s*\*?\s*$/ }) })
      .locator("input");
  }

  /** Pick the first option of a lookup popover that matches `search`. */
  private async pick(trigger: Locator, search: string) {
    await trigger.click();
    const pop = this.page.locator("[data-slot=popover-content]:visible").last();
    await pop.locator("[data-slot=command-input]").fill(search);
    const option = pop.locator("button[data-value]").filter({ hasText: new RegExp(esc(search), "i") }).first();
    await expect(option).toBeVisible();
    await option.click();
  }

  async selectVendor(code: string) {
    await this.pick(this.page.getByRole("button", { name: "Select Vendor" }), code);
  }

  async setVendorInvoiceNo(no: string) {
    await this.vendorInvoiceInput().fill(no);
  }

  /** Number of line rows currently in the table. */
  lineRows(): Locator {
    return this.page.getByLabel(/^description \d+$/);
  }

  addLineButton(): Locator {
    return this.page.getByRole("button", { name: "Add line" });
  }

  itemDialog(): Locator {
    return this.page.getByRole("dialog", { name: "Invoice Item Detail" });
  }

  /** Fill line `n` (1-based). The line must exist; `account: null` leaves the debit account empty. VAT 7% profile unless `vat` is false. */
  async fillLine(n: number, l: LineInput, opts: { vat?: boolean } = {}) {
    await this.page.getByLabel(`description ${n}`).fill(l.description);
    await this.page.getByLabel(`quantity ${n}`).fill(String(l.qty));
    await this.page.getByLabel(`unit price ${n}`).fill(String(l.price));
    if (l.incVat) {
      await this.page.getByRole("row").filter({ has: this.page.getByLabel(`description ${n}`) }).getByRole("checkbox", { name: "Inc VAT" }).click();
    }
    if (l.account === null && opts.vat === false) return;
    await this.page.getByRole("button", { name: `Edit item ${n}` }).click();
    const dlg = this.itemDialog();
    await expect(dlg).toBeVisible();
    if (l.account !== null) await this.pick(dlg.getByRole("button", { name: "Select GL Account" }).first(), l.account ?? "5300");
    if (opts.vat !== false) await this.pick(dlg.getByRole("button", { name: "VAT profile" }), "Vat 7");
    await dlg.getByRole("button", { name: "Close" }).first().click();
    await expect(dlg).toBeHidden();
  }

  /** Add a new empty line and fill it; the table grows by one row. */
  async addAndFillLine(l: LineInput, opts: { vat?: boolean } = {}) {
    const n = (await this.lineRows().count()) + 1;
    await this.addLineButton().click();
    await expect(this.lineRows()).toHaveCount(n);
    await this.fillLine(n, l, opts);
  }
}
