import { expect, type Locator } from "@playwright/test";
import { BasePage } from "./base.page";
import { amountOf } from "./ap-invoice.page";

const BASE = "/accounting/accounts-receivable/invoice";

export type ArTotalField = "net" | "vat" | "total" | "outstanding";

/**
 * Footer summary label (en.json `accounting.arRegister`: net / tax1Amount / total / outstanding;
 * routes/accounting/accounts-receivable/ar-invoice-detail.route.tsx SummaryFooterBar items).
 */
const TOTAL_LABEL: Record<ArTotalField, string> = { net: "Net", vat: "Tax 1", total: "Total", outstanding: "Outstanding" };

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * AR invoice list, detail and form (`/accounting/accounts-receivable/ar-invoice`). Locators are factories so they
 * survive navigations. Sources in carmen-frontend `routes/accounting/accounts-receivable/`:
 * ar-invoice-list.route.tsx, ar-invoice-detail.route.tsx, ar-invoice-draft-form.tsx, ar-invoice-lines.tsx,
 * ar-invoice-line-dialog.tsx, ar-customer-lookup.tsx. The FE creates `doc_type: invoice` only.
 */
export class ArInvoicePage extends BasePage {
  async gotoList() {
    await this.page.goto(BASE);
    await expect(this.searchInput()).toBeVisible();
  }

  async gotoNew() {
    await this.page.goto(`${BASE}/new`);
    await expect(this.button("Save Draft")).toBeVisible();
  }

  async gotoDetail(id: string) {
    await this.page.goto(`${BASE}/${id}`);
    await expect(this.statusChip()).toBeVisible({ timeout: 20_000 });
  }

  // ── List (ar-invoice-list.route.tsx) ─────────────────────────────────
  searchInput(): Locator {
    return this.page.getByPlaceholder("Search...");
  }

  /** A list row by any text it shows (doc no., customer). */
  row(text: string): Locator {
    return this.page.getByRole("row").filter({ hasText: text });
  }

  /** Status chip: in `scope` (e.g. a list row) when given, else the first on the page (detail header). */
  statusChip(scope?: Locator): Locator {
    return (scope ?? this.page).locator("[data-slot=status-chip]").first();
  }

  /** Every body row of the list table. */
  rows(): Locator {
    return this.page.locator("table tbody tr");
  }

  /** Type into the search box and press Enter (the list searches on Enter only). */
  async search(text: string) {
    await this.searchInput().fill(text);
    await this.searchInput().press("Enter");
  }

  /** Tick one option of a list filter field ("Status" or "Document type") in the Filter menu. */
  async filterBy(field: "Status" | "Document type", label: string) {
    await this.page.getByRole("button", { name: /^Filter/ }).click();
    await this.page.getByText(field, { exact: true }).last().click();
    const pop = this.page.locator("[data-slot=popover-content]:visible, [role=menu]:visible").last();
    await pop.getByText(label, { exact: true }).click();
    await this.page.keyboard.press("Escape");
  }

  newInvoiceButton(): Locator {
    return this.button("New Invoice");
  }

  // ── Form header (ar-invoice-draft-form.tsx; ar-customer-lookup.tsx placeholder `selectCustomer`) ──
  customerLookup(): Locator {
    return this.page.getByRole("button", { name: "Select an AR customer" });
  }

  /** Open a lookup popover with `trigger`, search `search` and click the first matching option. */
  private async pickFrom(trigger: Locator, search: string) {
    await trigger.click();
    const pop = this.page.locator("[data-slot=popover-content]:visible").last();
    await pop.locator("[data-slot=command-input]").fill(search);
    const option = pop.getByRole("button", { name: new RegExp(esc(search), "i") }).first();
    await expect(option).toBeVisible();
    await option.click();
  }

  /** Pick the first customer matching `search` ("E2E-CUST-1") in the lookup popover. */
  async selectCustomer(search: string) {
    await this.pickFrom(this.customerLookup(), search);
  }

  // ── Lines (ar-invoice-lines.tsx, ar-invoice-line-dialog.tsx) ──────────
  /** "Add Line" (`addLine`) opens the line dialog titled "Add Line · <n>". */
  addLineButton(): Locator {
    return this.button("Add Line");
  }

  /** The line dialog: "Add Line · n" for a new line, "Edit Line · n" for an existing one. */
  lineDialog() {
    const dlg = this.page.getByRole("dialog", { name: /^(Add|Edit) Line/ });
    const field = (label: string | RegExp) => dlg.getByLabel(label);
    return {
      root: () => dlg,
      /** `#ar-line-quantity` */
      qty: () => dlg.locator("#ar-line-quantity"),
      /** `#ar-line-unit_price` */
      unitPrice: () => dlg.locator("#ar-line-unit_price"),
      /** `#ar-line-discount_pct` */
      discountPct: () => dlg.locator("#ar-line-discount_pct"),
      /** Lookup trigger under the "Revenue account" label (LookupChartOfAccountById). */
      revenueAccount: () => dlg.getByRole("button", { name: "Revenue account", exact: true }),
      /** Lookup trigger in the group labelled "Revenue cost center" (LookupCostCenter). */
      costCenter: () => dlg.getByRole("group", { name: /^Revenue cost center/ }).getByRole("button"),
      /** First "Tax 1" profile lookup (LookupTaxProfile); the "No tax" button next to it clears it. */
      taxProfile: () => dlg.getByRole("button", { name: "Select Tax Profile" }).first(),
      field,
      /** Pick the first lookup option matching `search` in the popover the trigger opens. */
      pick: (trigger: Locator, search: string) => this.pickFrom(trigger, search),
    };
  }

  /**
   * Add one line through the dialog. `revenue: null` / `costCenter: null` leave that lookup empty (to provoke the
   * dialog's own refusal); `vat` picks the "Vat 7%" profile, else the tax profile stays empty (no tax).
   * Does not click Add when `submit` is false.
   */
  async addLine(l: { description?: string; qty: number; price: number; vat?: boolean; discountPct?: number; revenue?: string | null; costCenter?: string | null; submit?: boolean }) {
    await this.addLineButton().click();
    const d = this.lineDialog();
    await expect(d.root()).toBeVisible();
    if (l.description) await d.field("Description").fill(l.description);
    await d.qty().fill(String(l.qty));
    await d.unitPrice().fill(String(l.price));
    if (l.discountPct) await d.discountPct().fill(String(l.discountPct));
    if (l.revenue !== null) await d.pick(d.revenueAccount(), l.revenue ?? "4100");
    if (l.costCenter !== null) await d.pick(d.costCenter(), l.costCenter ?? "E2E-CC-1");
    if (l.vat) await d.pick(d.taxProfile(), "Vat 7");
    if (l.submit !== false) await d.root().getByRole("button", { name: "Add", exact: true }).click();
  }

  /** The description cell button of a line (its description, or "Line n" when empty); opens the Edit Line dialog on a draft. */
  lineButton(description: string | RegExp): Locator {
    return this.page.getByRole("button", { name: description });
  }

  /** Remove button of line `n` (`aria-label` "Remove line n"). */
  removeLineButton(n: number): Locator {
    return this.page.getByRole("button", { name: `Remove line ${n}` });
  }

  // ── Footer summary (SummaryFooterBar -> components/ui/summary-bar.tsx: `overflow-hidden tabular-nums` bar of label/value spans) ──
  summary() {
    const bar = this.page.locator("div.overflow-hidden.tabular-nums");
    const field = (name: ArTotalField) =>
      bar.locator(`xpath=.//span[normalize-space(.)='${TOTAL_LABEL[name]}']/following-sibling::span[1]`);
    return {
      field,
      net: () => field("net"),
      vat: () => field("vat"),
      total: () => field("total"),
      outstanding: () => field("outstanding"),
      /** Numeric value of one field, waiting for it to render. */
      valueOf: async (name: ArTotalField) => {
        await expect(field(name)).toBeVisible();
        return amountOf(await field(name).innerText());
      },
    };
  }

  // ── Actions ───────────────────────────────────────────────────────────
  /** Toolbar / footer button by its visible name (Save Draft, Edit, Submit, Approve, Reject, Send back, Void, Delete). */
  button(name: string): Locator {
    return this.page.getByRole("button", { name, exact: true });
  }

  /**
   * The confirmation dialog of Submit / Approve / Reject / Void / Send back (ar-invoice-detail.route.tsx:178-279).
   * Its title is `<action>Title` ("Void invoice?", "Reject invoice?"). Only Void, Reject and Send back have a reason box (`#ar-action-reason`); Submit and Approve do not.
   */
  confirmDialog(): Locator {
    return this.page.getByRole("dialog").filter({ has: this.page.locator("[data-slot=dialog-title]") }).last();
  }

  /** Void / Reject: open the dialog, fill the required `#ar-action-reason` and confirm. */
  async confirmWithReason(action: "Void" | "Reject", reason: string) {
    await this.button(action).first().click();
    const dlg = this.confirmDialog();
    await expect(dlg).toBeVisible();
    await dlg.locator("#ar-action-reason").fill(reason);
    await dlg.getByRole("button", { name: action, exact: true }).click();
  }

  /** Submit / Approve: no reason box, just open the dialog and confirm. */
  async confirm(action: "Submit" | "Approve") {
    await this.button(action).first().click();
    const dlg = this.confirmDialog();
    await expect(dlg).toBeVisible();
    await dlg.getByRole("button", { name: action, exact: true }).click();
  }

  /**
   * Send back: pick `stage` in the dialog's stage Select (SendBackFields, routes/accounting/shared/send-back-fields.tsx:
   * trigger aria-label "Send back to stage", options named by stage), optionally fill the note, confirm.
   * Confirm stays disabled until a stage is chosen (ar-invoice-detail.route.tsx:248).
   */
  async sendBack(stage: string, note?: string) {
    await this.button("Send back").first().click();
    const dlg = this.confirmDialog();
    await expect(dlg).toBeVisible();
    await dlg.getByRole("combobox", { name: "Send back to stage" }).click();
    await this.page.getByRole("option", { name: stage, exact: true }).click();
    if (note) await dlg.locator("#ar-action-reason").fill(note);
    await dlg.getByRole("button", { name: "Send back", exact: true }).click();
  }

  /** A toast whose text matches. */
  toastWith(re: RegExp): Locator {
    return this.page.locator("[data-sonner-toast]").filter({ hasText: re });
  }
}
