import { expect, type Locator } from "@playwright/test";
import { BasePage } from "./base.page";
import { amountOf } from "./ap-invoice.page";

const BASE = "/accounting/accounts-receivable/ar-invoice";

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

  newInvoiceButton(): Locator {
    return this.button("New Invoice");
  }

  // ── Form header (ar-invoice-draft-form.tsx; ar-customer-lookup.tsx placeholder `selectCustomer`) ──
  customerLookup(): Locator {
    return this.page.getByRole("combobox", { name: "Select an AR customer" }).or(this.page.getByRole("button", { name: "Select an AR customer" })).first();
  }

  /** Pick the first customer matching `search` ("E2E-CUST-1") in the lookup popover. */
  async selectCustomer(search: string) {
    await this.customerLookup().click();
    const pop = this.page.locator("[data-slot=popover-content]:visible").last();
    await pop.locator("[data-slot=command-input], input").first().fill(search);
    const option = pop.locator("[data-value], [role=option]").filter({ hasText: new RegExp(esc(search), "i") }).first();
    await expect(option).toBeVisible();
    await option.click();
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
      revenueAccount: () => dlg.getByRole("combobox", { name: /Revenue account/ }).or(dlg.getByRole("button", { name: /Revenue account/ })).first(),
      /** Lookup trigger in the group labelled "Revenue cost center" (LookupCostCenter). */
      costCenter: () => dlg.getByRole("group", { name: "Revenue cost center" }).getByRole("combobox").or(dlg.getByRole("group", { name: "Revenue cost center" }).getByRole("button")).first(),
      /** First "Tax 1" profile lookup (LookupTaxProfile); the "No tax" button next to it clears it. */
      taxProfile: () => dlg.getByRole("combobox", { name: /Tax Profile|Tax 1/ }).or(dlg.getByRole("button", { name: /Select Tax Profile/ })).first(),
      field,
      /** Pick the first lookup option matching `search` in the popover the trigger opens. */
      pick: async (trigger: Locator, search: string) => {
        await trigger.click();
        const pop = this.page.locator("[data-slot=popover-content]:visible").last();
        await pop.locator("[data-slot=command-input], input").first().fill(search);
        const option = pop.locator("[data-value], [role=option]").filter({ hasText: new RegExp(esc(search), "i") }).first();
        await expect(option).toBeVisible();
        await option.click();
      },
    };
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
   * Its title is `<action>Title` ("Void invoice?", "Reject invoice?"), the reason box is `#ar-action-reason`.
   */
  confirmDialog(): Locator {
    return this.page.getByRole("dialog").filter({ has: this.page.locator("[data-slot=dialog-title]") }).last();
  }

  /** Click the toolbar `action` button, fill the reason and press the dialog's confirm button (named like the action). */
  async confirmWithReason(action: "Void" | "Reject" | "Send back" | "Approve" | "Submit", reason: string) {
    await this.button(action).first().click();
    const dlg = this.confirmDialog();
    await expect(dlg).toBeVisible();
    await dlg.locator("#ar-action-reason").fill(reason);
    await dlg.getByRole("button", { name: action, exact: true }).click();
  }

  /** A toast whose text matches. */
  toastWith(re: RegExp): Locator {
    return this.page.locator("[data-sonner-toast]").filter({ hasText: re });
  }
}
