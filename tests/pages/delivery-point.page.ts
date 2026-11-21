import type { Page, Locator } from "@playwright/test";
import { BasePage } from "./base.page";

export class DeliveryPointListPage extends BasePage {
  readonly addButton = () => this.page.getByRole("button", { name: /Add/i }).first();
  // override: returns the full collection (no .first()) so callers can use .count() / .nth()
  readonly searchInput = () => this.page.getByPlaceholder(/Search/i);
  readonly table = () => this.page.locator("table");
  readonly tableRows = () => this.table().locator("tbody tr");
  readonly headerCell = (name: string | RegExp) =>
    this.page.locator("thead").getByRole("columnheader", { name });
  // override: returns the full collection (no .first()) so callers can use .count()
  readonly emptyState = () => this.page.getByText(/no.*data|no.*results|empty|ไม่พบ/i);
  // DisplayModeToggle (FE components/share/display-mode-toggle.tsx): "List view" / "Grid view" (aria-pressed)
  readonly viewToggleTable = () => this.page.getByRole("button", { name: /^list view$/i });
  readonly viewToggleCard = () => this.page.getByRole("button", { name: /^grid view$/i });
  readonly columnVisibilityButton = () =>
    this.page.getByRole("button", { name: /^toggle columns$/i });
  readonly perPageSelect = () => this.page.getByRole("combobox", { name: /per page|rows/i });
  readonly nextPageButton = () => this.page.getByRole("button", { name: /next page/i });
  readonly prevPageButton = () => this.page.getByRole("button", { name: /previous page/i });

  // override: zero-arg form — uses the module's hardcoded path
  async goto() {
    await this.page.goto("/config/delivery-point");
    await this.page.waitForLoadState("networkidle");
  }

  async search(query: string) {
    // .first() and bounded actions: `searchInput()` deliberately returns the whole
    // collection so callers can count it, and this page carries more than one
    // "Search" placeholder — the un-scoped click was strict-mode-ambiguous, and
    // with actionTimeout at 0 it waited for a stable element forever instead of
    // failing. That burned the full test timeout inside a beforeEach.
    const input = this.searchInput().first();
    await input.click({ timeout: 10_000 });
    await input.fill("", { timeout: 10_000 });
    if (query) {
      await input.pressSequentially(query, { delay: 20, timeout: 15_000 });
    }
    await input.press("Enter", { timeout: 10_000 });
    await this.page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  }

  rowByName(name: string): Locator {
    return this.page.getByRole("row", { name: new RegExp(name, "i") });
  }

  async clickRowName(name: string) {
    // CellAction renders a <button>; click it directly so the edit dialog opens
    const button = this.page.getByRole("button", { name, exact: true }).first();
    await button.waitFor({ state: "visible", timeout: 10_000 });
    await button.click();
  }

  async deleteRow(name: string) {
    // Delete lives inside a per-row "Row actions" dropdown menu
    const row = this.rowByName(name);
    await row.getByRole("button", { name: "Row actions" }).click();
    await this.page.getByRole("menuitem", { name: /^Delete$/i }).click();
  }
}

export class DeliveryPointDialog {
  constructor(private page: Page) {}

  readonly dialog = () => this.page.getByRole("dialog");
  readonly title = () => this.dialog().getByRole("heading");
  readonly nameInput = () => this.page.locator("#delivery-point-name");
  readonly activeSwitch = () => this.page.locator("#delivery-point-is-active");
  readonly cancelButton = () => this.dialog().getByRole("button", { name: /Cancel|ยกเลิก/i });
  readonly saveButton = () =>
    this.dialog().getByRole("button", { name: /^(Create|Save|สร้าง|บันทึก)$/i });
  readonly errorMessage = () =>
    this.dialog().locator(
      "[aria-invalid='true'], [data-invalid='true'], [role='alert']",
    );
}

export class DeleteConfirmDialog {
  constructor(private page: Page) {}

  readonly dialog = () => this.page.getByRole("alertdialog");
  readonly confirmButton = () => this.dialog().getByRole("button", { name: /Delete|ลบ/i });
  readonly cancelButton = () => this.dialog().getByRole("button", { name: /Cancel|ยกเลิก/i });
}
