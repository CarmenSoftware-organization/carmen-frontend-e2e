import { expect, type Locator } from "@playwright/test";
import { BasePage } from "./base.page";

const BASE = "/accounting/journal-voucher";

/** Header fields the v2.14 mockup shows on the JV detail; team decision 2026-11-04: all of them show even when empty. */
export const JV_HEADER_FIELDS = ["Voucher Type", "Document No.", "Date", "Description"] as const;

export interface JvLineInput {
  /** COA code, e.g. `5300`. */
  account: string;
  dr?: number;
  cr?: number;
  comment?: string;
}

/**
 * Journal voucher list + detail/form (`/accounting/journal-voucher`). One component serves `new`, a draft and a
 * read-only view. A line is two table rows (the second holds the base amounts), so line `n` is row `2n - 2`.
 */
export class JournalVoucherPage extends BasePage {
  async gotoList() {
    await this.page.goto(BASE);
    await expect(this.page.getByRole("heading", { name: "Journal Voucher", level: 1 })).toBeVisible();
  }

  async gotoNew() {
    await this.page.goto(`${BASE}/new`);
    await expect(this.button("Save")).toBeVisible();
  }

  async gotoDetail(id: string) {
    await this.page.goto(`${BASE}/${id}`);
    await expect(this.statusChip()).toBeVisible({ timeout: 20_000 });
  }

  button(name: string): Locator {
    return this.page.getByRole("button", { name, exact: true });
  }

  statusChip(): Locator {
    return this.page.locator("[data-slot=status-chip]").first();
  }

  /** A header field by its label (the label and its value share a `group`). */
  field(label: string): Locator {
    return this.page.getByRole("group").filter({ hasText: label }).first();
  }

  descriptionInput(): Locator {
    return this.page.getByRole("textbox", { name: "Description" });
  }

  addRowButton(): Locator {
    return this.button("Add Row Alt+A");
  }

  lineRow(n: number): Locator {
    return this.page.locator("table tbody tr").nth(2 * (n - 1));
  }

  /** `awaitRules`: wait for the account's dimension-rules read (Submit refuses until it settles); false for an account already picked on this form. */
  async fillLine(n: number, l: JvLineInput, awaitRules = true) {
    const row = this.lineRow(n);
    await row.locator("td").nth(1).getByRole("button").click();
    const pop = this.page.locator("[data-slot=popover-content]:visible").last();
    await pop.getByRole("combobox").fill(l.account);
    const option = pop.getByRole("button", { name: new RegExp(`^${l.account} - `) });
    await expect(option).toBeVisible();
    const rules = awaitRules
      ? this.page.waitForResponse((r) => r.url().includes("/account-dimension-rules") && r.request().method() === "GET")
      : Promise.resolve(null);
    await option.click();
    await rules;
    // spinbuttons of a line: rate, debit, credit
    if (l.dr) await row.getByRole("spinbutton").nth(1).fill(String(l.dr));
    if (l.cr) await row.getByRole("spinbutton").nth(2).fill(String(l.cr));
    if (l.comment) await row.getByRole("textbox").first().fill(l.comment);
  }

  /** Fill the description and every line (the first row exists on a new form, the rest are added). */
  async fillForm(description: string, lines: JvLineInput[]) {
    await this.descriptionInput().fill(description);
    const seen = new Set<string>();
    for (const [i, l] of lines.entries()) {
      if (i > 0) {
        await this.addRowButton().click();
        await expect(this.page.getByRole("checkbox", { name: /^Select journal row/ })).toHaveCount(i + 1);
      }
      await this.fillLine(i + 1, l, !seen.has(l.account));
      seen.add(l.account);
    }
  }

  balanceMessage(kind: "Balanced" | "Unbalanced"): Locator {
    return this.page.getByText(new RegExp(`^${kind} ·`));
  }

  toastWith(re: RegExp): Locator {
    return this.page.locator("[data-sonner-toast]").filter({ hasText: re });
  }

  voidDialog(): Locator {
    return this.page.getByRole("dialog", { name: "Void this voucher?" });
  }

  reverseDialog(): Locator {
    return this.page.getByRole("dialog", { name: "Reverse this voucher?" });
  }

  /** A list row by any text it shows (JV no., description). */
  row(text: string): Locator {
    return this.page.getByRole("row").filter({ hasText: text });
  }
}
