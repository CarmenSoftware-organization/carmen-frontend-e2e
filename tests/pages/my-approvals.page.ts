import type { Page, Locator } from "@playwright/test";
import { BasePage } from "./base.page";

export const LIST_PATH = "/procurement/my-approval";
export const PR_LIST_PATH = "/procurement/purchase-request";

export class MyApprovalsPage extends BasePage {
  async gotoList() {
    await this.page.goto(LIST_PATH);
    await this.page.waitForLoadState("networkidle");
  }

  async gotoPRList() {
    await this.page.goto(PR_LIST_PATH);
    await this.page.waitForLoadState("networkidle");
  }

  // ── List page ────────────────────────────────────────────────────────
  // Redesigned dashboard: the summary counts are clickable cards rendered as
  // <button> elements ("Total Pending 22"), not <Badge> components.
  pendingCountBadge(): Locator {
    return this.page.getByRole("button", { name: /total pending/i }).first();
  }

  // "Showing 1–N of TOTAL" pagination label — the authoritative total count.
  paginationTotal(): Locator {
    return this.page.getByText(/showing\s+\d+.*of\s+\d+/i).first();
  }

  // A list row. `text` may be the human PR reference ("PR2026...") shown as the
  // row's link text, OR the detail UUID embedded in that link's href (which is
  // what createDraftPR returns). Match either.
  documentRow(text: string): Locator {
    return this.page
      .locator("tr")
      .filter({ has: this.page.locator(`a[href*="${text}"]`) })
      .or(this.page.getByRole("row").filter({ hasText: text }))
      .first();
  }

  // override: also matches "no pending"/"no approval" empty text
  emptyState(): Locator {
    return this.page.getByText(/no.*pending|no.*approval|empty|ไม่พบ/i).first();
  }

  // ── Bulk actions ─────────────────────────────────────────────────────
  selectMultipleButton(): Locator {
    return this.page.getByRole("button", { name: /select multiple/i }).first();
  }

  rowCheckbox(text: string): Locator {
    return this.documentRow(text).getByRole("checkbox").first();
  }

  bulkApproveButton(): Locator {
    return this.page.getByRole("button", { name: /bulk approve/i }).first();
  }

  confirmBulkApprovalButton(): Locator {
    return this.page
      .locator('[role="dialog"], [role="alertdialog"]')
      .last()
      .getByRole("button", { name: /confirm bulk approval/i })
      .first();
  }

  // ── Approve / Reject / Request Info ──────────────────────────────────
  approveButton(): Locator {
    return this.page.getByRole("button", { name: /^approve$/i }).first();
  }

  /**
   * Approve / Reject / Send for Review exist **only in edit mode** on a PR detail
   * — the view page offers just Edit and More. Call `enterEditMode()` first; a
   * test that goes straight for this locator finds nothing and then times out on
   * the confirm dialog that never opened.
   */
  rejectButton(): Locator {
    return this.page.getByRole("button", { name: /^reject$/i }).first();
  }

  editModeButton(): Locator {
    return this.page.getByRole("button", { name: /^edit$|edit pr|edit mode/i }).first();
  }

  async enterEditMode(): Promise<void> {
    const edit = this.editModeButton();
    await edit.waitFor({ state: "visible", timeout: 15_000 });
    await edit.click({ timeout: 10_000 });
    // The verdict buttons are the signal that edit mode is live.
    await this.page
      .getByRole("button", { name: /^reject$/i })
      .first()
      .waitFor({ state: "visible", timeout: 15_000 });
  }

  requestMoreInfoButton(): Locator {
    return this.page.getByRole("button", { name: /request more info/i }).first();
  }

  reasonInput(): Locator {
    // Both roles: confirmation popups here are Radix AlertDialog, which
    // getByRole("dialog") never matches — the reason box then stayed unfilled and
    // the dialog's own confirm button stayed disabled. `.last()` skips the
    // always-mounted Command Palette.
    return this.page
      .locator('[role="dialog"], [role="alertdialog"]')
      .last()
      .locator("textarea, input[type='text']")
      .first();
  }

  rejectReasonOption(name: RegExp): Locator {
    return this.page.getByRole("option", { name }).first();
  }

  /**
   * Confirmations in this app are Radix **AlertDialog** — `role="alertdialog"`,
   * which `getByRole("dialog")` does NOT match. This resolved to nothing, and
   * since almost every call site wraps the click in `.catch(() => {})`, the step
   * silently did nothing: PO Submit left the record in Draft while reporting
   * success. Match both roles, and take `.last()` so the always-mounted Command
   * Palette (also a dialog) never wins.
   */
  confirmDialogButton(name: RegExp = /confirm|ok|yes/i): Locator {
    return this.page
      .locator('[role="dialog"], [role="alertdialog"]')
      .last()
      .getByRole("button", { name })
      .first();
  }

  // ── Delegation ───────────────────────────────────────────────────────
  manageDelegationsButton(): Locator {
    return this.page.getByRole("button", { name: /manage delegations/i }).first();
  }

  newDelegationButton(): Locator {
    return this.page.getByRole("button", { name: /new delegation/i }).first();
  }

  delegateUserInput(): Locator {
    return this.page.getByLabel(/delegate user/i).first();
  }

  createDelegationButton(): Locator {
    return this.page.getByRole("button", { name: /create delegation/i }).first();
  }

}
