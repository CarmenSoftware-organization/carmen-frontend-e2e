import type { Page, Locator } from "@playwright/test";
import { expect } from "@playwright/test";
import { BasePage } from "./base.page";
import { pickTaxProfile } from "../helpers/tax-profile-lookup";

export const LIST_PATH = "/product-management/category";

/**
 * Page object for the **redesigned** Product Category module.
 *
 * The module is a tree of category → subcategory → item-group nodes. A single
 * "Add Category" button opens a dialog to create a root category; each tree node
 * exposes **hover-only** actions — Add child (Plus), Edit (Pencil), Delete
 * (Trash) — by `aria-label`. The dialog (CategoryDialog → CategoryForm) has
 * `#code`, `#name`, and a required Tax Profile select (LookupTaxProfile, a Radix
 * Select). Delete is confirmed through a DeleteDialog (AlertDialog). Search
 * filters the tree client-side (SearchInput fires onSearch on Enter).
 */
export class ProductCategoryPage extends BasePage {
  async gotoList() {
    await this.page.goto(LIST_PATH);
    await this.page.waitForLoadState("networkidle");
  }

  // ── List / tree ───────────────────────────────────────────────────────
  addButton(): Locator {
    return this.page.getByRole("button", { name: /add category|^add$/i }).first();
  }

  /** A tree node row (carries the Tailwind `group/node` class), found by text. */
  node(text: string): Locator {
    return this.page.locator("div.group\\/node").filter({ hasText: text }).first();
  }

  searchInput(): Locator {
    return this.page.getByPlaceholder(/search/i).first();
  }

  emptyState(): Locator {
    return this.page.getByText(/no.*categor|no.*data|no.*found|empty|ไม่พบ/i).first();
  }

  async expandAll() {
    await this.page.getByRole("button", { name: /expand all/i }).first().click().catch(() => {});
  }

  // ── Node hover actions ────────────────────────────────────────────────
  /** Reveal a node's hover actions, then click the named one. */
  private async nodeAction(text: string, name: RegExp) {
    const row = this.node(text);
    await row.scrollIntoViewIfNeeded();
    await row.hover();
    await row.getByRole("button", { name }).first().click({ timeout: 10_000 });
  }

  async addChildOf(text: string) {
    await this.nodeAction(text, /add child/i);
  }

  async editNode(text: string) {
    await this.nodeAction(text, /^edit$|แก้ไข/i);
  }

  /** Open a node's delete confirm and either confirm or cancel. */
  async deleteNode(text: string, opts: { confirm: boolean }) {
    await this.nodeAction(text, /^delete$|ลบ/i);
    const dialog = this.page.getByRole("alertdialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    const name = opts.confirm ? /^(delete|confirm|ลบ|ok)$/i : /^(cancel|ยกเลิก)$/i;
    await dialog.getByRole("button", { name }).click();
  }

  // ── Dialog form ───────────────────────────────────────────────────────
  dialog(): Locator {
    return this.page.getByRole("dialog");
  }

  codeInput(): Locator {
    return this.dialog().locator("#code");
  }

  nameInput(): Locator {
    return this.dialog().locator("#name");
  }

  /** Open the required Tax Profile select and pick the first option. */
  async selectFirstTaxProfile() {
    // Popover lookup (FE LookupTaxProfile), a "Select Tax Profile" button — not a combobox.
    await pickTaxProfile(this.page, this.dialog().getByRole("button", { name: /tax profile/i }).first());
  }

  saveButton(): Locator {
    return this.dialog().getByRole("button", { name: /^(create|save|บันทึก|สร้าง)$/i }).first();
  }

  /** Fill the add/edit dialog and submit. */
  async fillAndSave(data: { code?: string; name?: string; pickTaxProfile?: boolean }) {
    if (data.code !== undefined) await this.codeInput().fill(data.code);
    if (data.name !== undefined) await this.nameInput().fill(data.name);
    if (data.pickTaxProfile) await this.selectFirstTaxProfile();
    await this.saveButton().click({ timeout: 10_000 });
  }

  async expectSavedToast() {
    await expect(
      this.page
        .locator('[data-sonner-toast], [role="status"], [role="alert"]')
        .filter({ hasText: /success|created|updated|deleted|saved|สำเร็จ/i })
        .first(),
    ).toBeVisible({ timeout: 10_000 });
  }
}
