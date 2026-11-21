import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { PurchaseRequestPage, LIST_PATH } from "./purchase-request.page";

/**
 * Marks PRs created by E2E so they can be filtered out of the UI manually
 * when the DB grows noisy. Not a cleanup mechanism — see design spec §4.5.
 */
export function e2eDescription(suffix: string): string {
  return `[E2E-PRC] ${suffix}`;
}

export interface CreatedPR {
  ref: string;
  url: string;
}

const FUTURE_DATE = "2099-12-31";

/**
 * Creates a Draft PR with N line items and returns its reference + url.
 * Used by Step 4-6/8 setup and the Golden Journey TC.
 */
export async function createDraftPR(
  page: Page,
  opts?: { items?: number; description?: string; deliveryDate?: string; quantity?: number; foc?: boolean },
): Promise<CreatedPR> {
  const pr = new PurchaseRequestPage(page);
  await pr.gotoList();
  await pr.openCreateDialog();
  await expect(page).toHaveURL(/purchase-request\/new/, { timeout: 10_000 });

  await pr.fillHeader({
    prType: "general",
    deliveryDate: opts?.deliveryDate ?? FUTURE_DATE,
    description: e2eDescription(opts?.description ?? "draft fixture"),
  });

  const itemCount = opts?.items ?? 1;
  for (let i = 0; i < itemCount; i++) {
    await pr.addLineItem({
      product: "Test Item",
      description: `E2E item ${i + 1}`,
      quantity: opts?.quantity ?? 1,
      uom: "ea",
      unitPrice: 100,
      isFOC: opts?.foc,
    });
  }

  await pr.saveDraftButton().click({ timeout: 10_000 });
  await page.waitForURL(/purchase-request\/(?!new$)[^\/?#]+$/, { timeout: 20_000 }).catch(() => {
    // fall through: the URL check below reports what the page is actually on
  });

  const url = page.url();
  if (url.endsWith("/new") || url.includes("/new?")) {
    throw new Error(`createDraftPR: save did not redirect — still on ${url}. PR was not created.`);
  }
  const refMatch = url.match(/purchase-request\/([^\/?#]+)/);
  const ref = refMatch?.[1];
  if (!ref || ref === "new") {
    throw new Error(`createDraftPR: could not extract PR ref from URL: ${url}`);
  }
  return { ref, url };
}

/**
 * Submits an existing Draft PR and waits for the "In Progress" status.
 */
export async function submitDraftPR(page: Page, ref: string): Promise<void> {
  const pr = new PurchaseRequestPage(page);
  if (!page.url().includes(ref)) {
    await page.goto(`${LIST_PATH}/${ref}`);
    await page.waitForLoadState("networkidle");
  }
  await pr.submitButton().click({ timeout: 10_000 });
  await pr.confirmDialogButton(/confirm|submit|ok|yes/i).click({ timeout: 5_000 });
  // A successful submit advances the PR to In Progress and redirects to the PR
  // list. Wait for that redirect rather than a success toast: the create-success
  // toast can linger and matches /success/, giving a false positive that returns
  // before the submit has actually persisted.
  await page.waitForURL(/\/procurement\/purchase-request(\?|$)/, { timeout: 15_000 });
}

/**
 * Deletes an existing Draft PR via UI (confirmation dialog).
 */
export async function deleteDraftPR(page: Page, ref: string): Promise<void> {
  const pr = new PurchaseRequestPage(page);
  if (!page.url().includes(ref)) {
    await page.goto(`${LIST_PATH}/${ref}`);
    await page.waitForLoadState("networkidle");
  }
  await pr.deleteButton().click({ timeout: 10_000 });
  await pr.confirmDialogButton(/confirm|delete|yes/i).click({ timeout: 5_000 });
  await page.waitForURL(/\/procurement\/purchase-request($|\?)/, { timeout: 10_000 }).catch(() => {});
}
