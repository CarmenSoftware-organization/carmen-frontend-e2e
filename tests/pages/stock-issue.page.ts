import type { Page, Locator } from "@playwright/test";
import { BasePage } from "./base.page";

export const LIST_PATH = "/store-operation/store-requisition";

export class StockIssuePage extends BasePage {
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

  async gotoDetail(id: string) {
    await this.page.goto(`${LIST_PATH}/${id}`);
    await this.page.waitForLoadState("networkidle");
  }

  // ── List page ────────────────────────────────────────────────────────
  statusFilter(): Locator {
    return this.page.getByRole("combobox", { name: /status/i }).first();
  }

  fromLocationFilter(): Locator {
    return this.page.getByRole("combobox", { name: /from location/i }).first();
  }

  toLocationFilter(): Locator {
    return this.page.getByRole("combobox", { name: /to location/i }).first();
  }

  departmentFilter(): Locator {
    return this.page.getByRole("combobox", { name: /department/i }).first();
  }

  filterOption(name: RegExp | string): Locator {
    return this.page.getByRole("option", { name: typeof name === "string" ? new RegExp(name, "i") : name });
  }

  summaryCards(): Locator {
    return this.page.locator("[data-slot='card'], .card, article").first();
  }

  issueRow(text: string): Locator {
    return this.page.getByRole("row").filter({ hasText: text }).first();
  }

  // override: also matches "no issue" empty text
  emptyState(): Locator {
    return this.page.getByText(/no.*issue|no.*data|empty|ไม่พบ/i).first();
  }

  paginationNext(): Locator {
    return this.page.getByRole("button", { name: /next/i }).first();
  }

  paginationPrev(): Locator {
    return this.page.getByRole("button", { name: /previous|prev/i }).first();
  }

  // ── Detail page ──────────────────────────────────────────────────────
  fromLocationCard(): Locator {
    return this.page.locator("[data-slot='card'], section, article").filter({ hasText: /from location/i }).first();
  }

  toLocationCard(): Locator {
    return this.page.locator("[data-slot='card'], section, article").filter({ hasText: /to location/i }).first();
  }

  departmentCard(): Locator {
    return this.page.locator("[data-slot='card'], section, article").filter({ hasText: /department/i }).first();
  }

  expenseAccountCard(): Locator {
    return this.page.locator("[data-slot='card'], section, article").filter({ hasText: /expense account/i }).first();
  }

  itemsTable(): Locator {
    return this.page.getByRole("table").filter({ hasText: /item|product|qty/i }).first();
  }

  // ── Action buttons ───────────────────────────────────────────────────
  viewFullSRButton(): Locator {
    return this.page.getByRole("button", { name: /view full sr|view sr/i }).first();
  }

  printButton(): Locator {
    return this.page.getByRole("button", { name: /^print$/i }).first();
  }

  completeButton(): Locator {
    return this.page.getByRole("button", { name: /^complete$/i }).first();
  }

  viewExpenseAllocationButton(): Locator {
    return this.page.getByRole("button", { name: /view expense allocation/i }).first();
  }

  // ── Status / verification ────────────────────────────────────────────
  // override: filters to stock-issue-specific status text
  statusBadge(): Locator {
    return this.page
      .locator("[data-slot='status'], [data-slot='badge'], [class*='badge']")
      .filter({ hasText: /draft|issue|complete|cancel|active/i })
      .first();
  }
}
