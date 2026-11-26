import { expect, type Locator } from "@playwright/test";
import { BasePage } from "./base.page";

const BASE = "/accounts-payable";

/**
 * AP payment detail and the payment-approvals queue (`/accounts-payable/payment[/<id>]`,
 * `/accounts-payable/payment-approvals`). Locators are factories so they survive navigations.
 */
export class ApPaymentPage extends BasePage {
  async gotoDetail(id: string) {
    await this.page.goto(`${BASE}/payment/${id}`);
    await expect(this.statusChip()).toBeVisible({ timeout: 20_000 });
  }

  /** The approvals queue; `posted` opens the "Approved and posted" tab. */
  async gotoApprovals(tab: "pending" | "posted" = "pending") {
    await this.page.goto(`${BASE}/payment-approvals${tab === "posted" ? "?approval=posted" : ""}`);
    await expect(this.searchBox()).toBeVisible({ timeout: 20_000 });
  }

  searchBox(): Locator {
    return this.page.getByPlaceholder("Search...");
  }

  async search(text: string) {
    await this.searchBox().fill(text);
    await this.searchBox().press("Enter");
  }

  /** A list row by any text it shows (PV no.). */
  row(no: string): Locator {
    return this.page.getByRole("row").filter({ hasText: no });
  }

  statusChip(): Locator {
    return this.page.locator("[data-slot=status-chip]").first();
  }

  button(name: string): Locator {
    return this.page.getByRole("button", { name, exact: true });
  }

  /** The row's selection checkbox in the approvals queue. */
  rowCheckbox(no: string): Locator {
    return this.row(no).getByRole("checkbox");
  }

  approveSelectedButton(): Locator {
    return this.button("Approve selected");
  }

  /** Confirm button of the batch-approve dialog. */
  confirmBatchApprove(): Locator {
    return this.page.getByRole("alertdialog").or(this.page.getByRole("dialog")).getByRole("button", { name: "Approve selected", exact: true });
  }

  toastWith(re: RegExp): Locator {
    return this.page.locator("[data-sonner-toast]").filter({ hasText: re });
  }

  // ── Withholding tax section (editable draft) ─────────────────────────
  recalculateButton(): Locator {
    return this.button("Recalculate from invoices");
  }
  whtBaseInput(): Locator {
    return this.page.getByLabel(/^Base /).first();
  }
  whtAmountInput(): Locator {
    return this.page.getByLabel(/^WHT Amount /).first();
  }

  // ── Reject / void dialog ─────────────────────────────────────────────
  /** Press an action that asks for a reason (`Reject`, `Void`), fill it and confirm. */
  async confirmWithReason(action: "Reject" | "Void", reason: string) {
    await this.button(action).click();
    const dlg = this.page.getByRole("dialog");
    await dlg.getByLabel("Reason").fill(reason);
    await dlg.getByRole("button", { name: action, exact: true }).click();
  }
}
