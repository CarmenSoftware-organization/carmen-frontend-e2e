import type { Page, Locator } from "@playwright/test";
import { expect } from "@playwright/test";
import { recordRows } from "../helpers/list-row";

/**
 * Abstract base for every `*.page.ts` page object in this repo.
 *
 * Owns the locators and helpers that appeared duplicated across 14+ page
 * objects before the Phase 1 refactor (see
 * `docs/superpowers/specs/2026-04-28-base-page-refactor-design.md`).
 *
 * Sub-classes:
 * - May add module-specific locators using `this.page.locator(...)` etc.
 * - May override a base method when the module needs a *looser* regex or
 *   extra chained logic (e.g. `.and()` / `.filter()`).
 * - Must NOT redeclare a base method to keep the same selector — that
 *   defeats the refactor.
 */
export abstract class BasePage {
  constructor(protected page: Page) {}

  // ── Universal feedback locators ──────────────────────────────────
  toast(): Locator {
    return this.page
      .locator('[data-sonner-toast], [role="status"], [role="alert"]')
      .first();
  }

  anyError(): Locator {
    // `.text-destructive` rather than `p.text-destructive`: the forms no longer
    // render field errors as <p> (a price-list save with empty required fields
    // gives 0 matches for the <p> form and 8 for the class alone). aria-invalid
    // still carries the signal, so this mainly widens the net for forms that mark
    // the message but not the control.
    return this.page.locator(
      '[aria-invalid="true"], .text-destructive, [role="alert"][data-slot="field-error"]',
    );
  }

  dialog(): Locator {
    return this.page.getByRole("dialog");
  }

  alertDialog(): Locator {
    return this.page.getByRole("alertdialog");
  }

  // ── Common buttons (EN + TH) ─────────────────────────────────────
  saveButton(): Locator {
    return this.page
      .getByRole("button", { name: /^(Save|Create|บันทึก|สร้าง)$/i })
      .first();
  }

  cancelButton(): Locator {
    return this.page
      .getByRole("button", { name: /^(Cancel|ยกเลิก)$/i })
      .first();
  }

  editButton(): Locator {
    return this.page
      .getByRole("button", { name: /^(Edit|แก้ไข)$/i })
      .first();
  }

  deleteButton(): Locator {
    return this.page
      .getByRole("button", { name: /^(Delete|ลบ)$/i })
      .first();
  }

  // ── Document page patterns (PR / PO / GRN / CN / SR) ─────────────
  // FE: header + header fields sit in one filled card (DOC_HEADER_CARD in
  // components/loader/doc-page-skeleton.tsx — e0e5cade PR, 27b35bed PO/GRN/CN/SR);
  // the actions bar is DocActions (components/share/doc-actions.tsx).

  /** The filled header card holding doc no., status chip, workflow track and fields. */
  docHeader(): Locator {
    return this.page.locator("div.bg-card.rounded-lg.border.p-3").first();
  }

  /** Comment button of the header action bar. Accessible name is "Comment" or
   *  "Comment (N)" — the label text is `max-xl:sr-only`, so match by role, not text visibility. */
  commentButton(): Locator {
    return this.page.getByRole("button", { name: /^comment(\s*\(\d+\))?$/i }).first();
  }

  /** Activity ("who changed what") button — opens the shared activity sheet. */
  activityButton(): Locator {
    return this.page.getByRole("button", { name: /^activity$/i }).first();
  }

  /**
   * Created / last-updated audit table. It moved from a bottom footer into the
   * header card (DocAuditLine, `<table>` with sr-only caption "Created / last
   * updated"); it is `hidden sm:table`, so absent below the sm breakpoint.
   */
  auditFooter(): Locator {
    return this.page.getByRole("table", { name: /created \/ last updated/i }).first();
  }

  /**
   * The document's single primary (filled blue) button. components/share/
   * form-primary-action.tsx (d6536f28): the footer workflow button claims it and
   * the header Edit/Save drop to outline; with no workflow button the header
   * is primary again. So exactly one of these exists per document page.
   */
  primaryAction(): Locator {
    return this.page.locator('button[data-slot="button"][data-variant="default"]');
  }

  /**
   * `networkidle` returns before the list query resolves, so a row lookup made
   * right after navigation can still hit the skeleton / "No data found" row.
   * Wait for either a real record row or the empty state before reading rows.
   */
  async waitForListRows(timeout = 15_000) {
    await recordRows(this.page)
      .first()
      .or(this.page.getByText(/no data found/i).first())
      .waitFor({ state: "visible", timeout })
      .catch(() => {});
  }

  /**
   * Assert a list scope toggle ("My pending" / "All Documents") is the active one.
   * ViewModeToggle (components/share/view-mode-toggle.tsx) renders two plain
   * <Button>s with no aria-selected/aria-pressed — the active one is
   * `variant="default"`, which the Button component mirrors as `data-variant`.
   */
  async expectScopeSelected(scope: Locator) {
    await expect(scope).toHaveAttribute("data-variant", "default", { timeout: 5_000 });
  }

  // ── Filter / search / list affordances ───────────────────────────
  searchInput(): Locator {
    return this.page.getByPlaceholder(/search/i).first();
  }

  filterButton(): Locator {
    return this.page
      .getByRole("button", { name: /^(Filter|กรอง)$/i })
      .first();
  }

  applyFilterButton(): Locator {
    return this.page
      .getByRole("button", { name: /apply filters?/i })
      .first();
  }

  emptyState(): Locator {
    return this.page
      .getByText(/no.*data|no.*results|empty|ไม่พบ/i)
      .first();
  }

  // ── Status badge (transactional modules) ─────────────────────────
  statusBadge(): Locator {
    return this.page.locator('[data-slot="badge"]').first();
  }

  // ── Helpers ──────────────────────────────────────────────────────
  async goto(path: string): Promise<void> {
    await this.page.goto(path);
    await this.page.waitForLoadState("networkidle");
  }

  async waitForToast(text?: string | RegExp): Promise<void> {
    const t = this.toast();
    await t.waitFor({ state: "visible" });
    if (text !== undefined) {
      const re = typeof text === "string" ? new RegExp(text, "i") : text;
      await t.filter({ hasText: re }).waitFor({ state: "visible" });
    }
  }

  async expectNoError(): Promise<void> {
    const count = await this.anyError().count();
    if (count > 0) {
      const first = await this.anyError().first().textContent();
      throw new Error(`Validation error visible before action: ${first?.trim()}`);
    }
  }
}
