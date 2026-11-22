import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Assert that an action is NOT available to the signed-in role on the open document.
 *
 * "Not available" means the control is hidden, or present but disabled, or — when a
 * role can still press it — the app refuses with an error message. The document page
 * is first proven to be loaded (its Comment button, present for every viewer, is
 * visible), so absence cannot be a page that never finished rendering.
 *
 * This replaces bodies of the shape `if (count === 0) expect(true).toBe(true)`,
 * which passed on any page, loaded or not.
 */
export async function expectActionUnavailable(
  page: Page,
  action: Locator,
  refusal: RegExp = /insufficient|permission|denied|not authori[sz]ed|forbidden/i,
): Promise<void> {
  await expect(
    page.getByRole("button", { name: /^comment(\s*\(\d+\))?$/i }).first(),
    "document page did not finish loading (no Comment button), so the action's absence proves nothing",
  ).toBeVisible({ timeout: 15_000 });
  if ((await action.count()) === 0) return; // hidden: the expected outcome, on a loaded page
  if (await action.isDisabled()) return; // present but disabled: also unavailable
  await action.click({ timeout: 5_000 });
  await expect(
    // only a toast / alert counts: page text such as the confirm dialog's "This action cannot be undone." does not
    page.locator("[data-sonner-toast], [role=alert]").filter({ hasText: refusal }).first(),
    "the action was available to this role and was not refused",
  ).toBeVisible({ timeout: 5_000 });
}
