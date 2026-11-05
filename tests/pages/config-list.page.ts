import type { Page } from "@playwright/test";
import { BasePage } from "./base.page";

/**
 * Generic list page object for any module under /config/*.
 *
 * Use for smoke / read-only tests. For full CRUD tests, create a
 * module-specific page object with the module's form field selectors.
 */
export class ConfigListPage extends BasePage {
  constructor(page: Page, private path: string) {
    super(page);
  }

  // Most config lists label the create button "Add"; Chart of Accounts and Exchange Rate use
  // "New" (carmen-frontend messages config.chartOfAccounts.add / config.exchangeRate.new).
  readonly addButton = () => this.page.getByRole("button", { name: /^\s*(add|new)\b/i }).first();
  // override: returns the full collection (no .first()) so callers can use .count() / .nth()
  readonly searchInput = () => this.page.getByPlaceholder(/Search/i);
  readonly table = () => this.page.locator("table");
  readonly tableRows = () => this.table().locator("tbody tr");
  // override: returns the full collection (no .first()) so callers can use .count()
  readonly emptyState = () =>
    this.page.getByText(/no.*data|no.*results|empty|ไม่พบ/i);

  // override: zero-arg form — uses this.path captured at construction
  async goto() {
    await this.page.goto(this.path);
    await this.page.waitForLoadState("networkidle");
  }

  async search(query: string) {
    const input = this.searchInput();
    await input.click();
    await input.fill("");
    if (query) {
      await input.pressSequentially(query, { delay: 20 });
    }
    await input.press("Enter");
    await this.page.waitForLoadState("networkidle");
  }
}
