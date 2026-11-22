import type { Locator, Page } from "@playwright/test";

/**
 * Pick a tax profile in the Popover + Command lookup (FE `LookupTaxProfile`, moved to the Lookup
 * API in c80f15e8 — it used to be a Radix Select). Options are `button[data-value]` inside the
 * popover; the list opens with "None" and fills in once the lookup answers, so wait for the VAT
 * entry instead of reading the list the instant the first option shows. Never take a loose match:
 * the BU may hold junk tax-profile names left by the security specs.
 */
export async function pickTaxProfile(page: Page, trigger: Locator): Promise<void> {
  await trigger.waitFor({ state: "visible", timeout: 10_000 });
  await trigger.click({ timeout: 10_000 });
  const options = page.locator("[data-slot=popover-content]:visible button[data-value]");
  await options.first().waitFor({ state: "visible", timeout: 10_000 });
  const vat = options.filter({ hasText: /^\s*vat/i }).first();
  if (await vat.waitFor({ state: "visible", timeout: 8_000 }).then(() => true, () => false)) {
    await vat.click({ timeout: 10_000 });
    return;
  }
  await options.filter({ hasNotText: /^\s*none\s*$/i }).first().click({ timeout: 10_000 });
}
