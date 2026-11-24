import { expect, type Locator, type Page } from "@playwright/test";
import { gotoBu } from "../bu-pin";
import { btn, field, lastToast, pickDate, pickLookup, pickSelect } from "../movement/ui";
import { dfGet } from "./api";

/**
 * Create / commit / delete GRN and Credit Note through the real screens, for the doc-flow specs on
 * the TEST BUs. Ported from `movement/docs.ts` without the @carmen.com accounts or hard-coded
 * vendor / reason: callers pass both (see `firstVendor` / `firstCnReason` in `data.ts`).
 */
export interface Line {
  /** product code */
  product: string;
  qty: number;
  price?: number;
}

export interface CreatedDoc {
  id: string;
  no: string;
  status: string;
}

async function dialogConfirm(page: Page, name: string | RegExp) {
  const dlg = page.locator("[role=alertdialog], [role=dialog]").last();
  await expect(dlg).toBeVisible();
  await dlg.getByRole("button", { name }).last().click();
}

/** The date field's opener is its first button (the second is Clear). */
const dateTrigger = (page: Page, label: string) => field(page, label).locator("button").first();

async function pickRowLookup(page: Page, row: Locator, placeholder: string, search: string) {
  await pickLookup(page, row.getByRole("button", { name: placeholder }), search);
}

/** Add Item, then the new row pinned by index (rows are inserted at the top). */
async function addItemRow(page: Page): Promise<Locator> {
  const rows = page.locator("table tbody tr");
  await btn(page, "Add Item").click();
  await expect(rows.filter({ has: page.getByRole("button", { name: "Select Product" }) })).toHaveCount(1);
  const idx = await rows.evaluateAll((trs) =>
    trs.findIndex((tr) => Array.from(tr.querySelectorAll("button")).some((b) => b.textContent?.trim() === "Select Product")),
  );
  return rows.nth(idx);
}

// ── GRN ─────────────────────────────────────────────────────────────────────────

export async function grnById(id: string, bu: string): Promise<CreatedDoc> {
  const { body } = await dfGet(`/good-received-notes/${id}`, "Admin", bu);
  return { id, no: body.data.grn_no, status: body.data.doc_status };
}

/**
 * Manual GRN through the screen:
 *   draft     = Save Draft (number DRAFT-NNNNNNNN)
 *   saved     = Create (real number; AVG posts stock here, FIFO waits for commit)
 *   committed = Create, then Commit in the footer + confirm
 * dryRun = fill everything, then stop without saving (selector checks, no junk documents).
 */
export async function createGrn(
  page: Page,
  opts: {
    bu: string;
    location: string;
    date: string;
    invoiceNo: string;
    lines: Line[];
    status: "draft" | "saved" | "committed";
    vendor: string;
    dryRun?: boolean;
    /** Called as soon as the document exists (before commit) so a spec can record it before a commit failure. */
    onCreated?: (doc: CreatedDoc) => void;
  },
): Promise<CreatedDoc | null> {
  const { bu, location } = opts;
  await gotoBu(page, "/procurement/goods-receive-note/new?doc_type=manual", bu);
  await pickLookup(page, field(page, "Vendor").locator("button").first(), opts.vendor);
  expect(await pickDate(page, dateTrigger(page, "GRN Date"), opts.date), `GRN Date ${opts.date}`).toBe(true);
  // FE PR #197 turned Currency from a Select into a lookup — support both.
  const currency = field(page, "Currency").locator("[role=combobox], button").first();
  if ((await currency.getAttribute("data-slot")) === "select-trigger") await pickSelect(page, currency, /^THB$/);
  else await pickLookup(page, currency, "THB");
  await page.locator("#grn-invoice-no").fill(opts.invoiceNo);
  expect(await pickDate(page, dateTrigger(page, "Invoice Date"), opts.date)).toBe(true);

  for (const line of opts.lines) {
    const row = await addItemRow(page);
    // The location button is blank for ~300ms while the user's locations load — wait before deciding to pick one.
    await expect(row.locator("button").first()).not.toHaveText(/^\s*$/);
    if (await row.getByRole("button", { name: "Select Location" }).isVisible().catch(() => false)) {
      await pickRowLookup(page, row, "Select Location", location);
    }
    await expect(row).toContainText(location);
    await pickRowLookup(page, row, "Select Product", line.product);
    await row.locator('input[name$=".received_qty"]').fill(String(line.qty));
    const unit = row.getByRole("button", { name: "Select Unit" }).first();
    if (await unit.isVisible().catch(() => false)) {
      await unit.click();
      await page.locator("[data-slot=popover-content]:visible button[data-value], [data-slot=select-item], [role=option]").first().click();
    }
    const price = row.locator('input[placeholder="0.00"]').first();
    await price.fill(String(line.price ?? 0));
    await price.press("Tab");
  }
  // The last row's unit may still be loading — saving then sends an empty unit.
  await expect(page.locator("table tbody .animate-spin")).toHaveCount(0);
  await expect(page.locator("table tbody").getByRole("button", { name: "Select Unit" })).toHaveCount(0);
  if (opts.dryRun) return null;

  // After Create the page returns to the list — take the id from the POST response, not the URL.
  const created = page.waitForResponse(
    (r) => r.request().method() === "POST" && /\/good-received-notes\/?(\?|$)/.test(r.url()),
    { timeout: 60_000 },
  );
  await btn(page, opts.status === "draft" ? "Save Draft" : "Create").click();
  const resp = await created;
  expect(resp.ok(), `create GRN ${resp.status()} ${await resp.text()}`).toBe(true);
  const id: string = (await resp.json()).data?.id;
  await lastToast(page);

  opts.onCreated?.(await grnById(id, bu));
  // Create = POST, then the frontend fires save (the stock posting) — a passing POST does not mean save passed
  // (AVG 2609 case 1.5: save hit a unique lot_no and the document stayed DRAFT-00000007 while the case passed silently).
  if (opts.status !== "draft") {
    await expect
      .poll(async () => (await grnById(id, bu)).status, { timeout: 30_000, message: `GRN ${id} must be saved after Create` })
      .not.toBe("draft");
  }
  if (opts.status === "committed") await commitGrn(page, id, bu);
  return grnById(id, bu);
}

/** Commit in the GRN view footer, then confirm. */
export async function commitGrn(page: Page, id: string, bu: string): Promise<void> {
  if (!page.url().includes(id)) await gotoBu(page, `/procurement/goods-receive-note/${id}`, bu);
  await btn(page, "Commit").click();
  await dialogConfirm(page, /commit/i);
  await expect.poll(async () => (await grnById(id, bu)).status, { timeout: 60_000 }).toBe("committed");
}

/** GRN draft: Edit → Delete (header) → confirm. Soft delete on the backend. */
export async function deleteGrnDraft(page: Page, id: string, bu: string): Promise<void> {
  await gotoBu(page, `/procurement/goods-receive-note/${id}`, bu);
  await btn(page, "Edit").click();
  await btn(page, "Delete").click();
  await dialogConfirm(page, /^delete$/i);
  await expect.poll(async () => (await dfGet(`/good-received-notes/${id}`, "Admin", bu)).status, { timeout: 60_000 }).not.toBe(200);
}

// ── Credit Note ────────────────────────────────────────────────────────────────

export async function cnById(id: string, bu: string): Promise<CreatedDoc> {
  const { body } = await dfGet(`/credit-notes/${id}`, "Admin", bu);
  const d = body?.data;
  if (!d) return { id, no: "", status: "deleted" };
  return { id, no: d.cn_no, status: d.doc_status };
}

/**
 * Quantity-return credit note against a committed GRN (the GRN lookup lists only
 * that vendor's committed GRNs). Currency is locked to the GRN. Lines are picked
 * by product name in the "Select from GRN" dialog.
 *   draft     = Create only
 *   completed = Create, open it → Submit (footer) → confirm
 */
export async function createCreditNote(
  page: Page,
  opts: {
    bu: string;
    reason: string;
    grnNo: string;
    docDate: string;
    taxInvoiceNo: string;
    lines: { productName: string; qty: number }[];
    status: "draft" | "completed";
    vendor: string;
    onCreated?: (doc: CreatedDoc) => void;
    dryRun?: boolean;
  },
): Promise<CreatedDoc | null> {
  const { bu } = opts;
  await gotoBu(page, "/procurement/credit-note/new", bu);
  await pickLookup(page, field(page, "Vendor").locator("button").first(), opts.vendor);
  await pickLookup(page, field(page, "GRN No.").locator("button").first(), opts.grnNo);
  await pickLookup(page, field(page, "Reason").locator("button").first(), opts.reason);
  expect(await pickDate(page, dateTrigger(page, "Doc Date"), opts.docDate), `Doc Date ${opts.docDate}`).toBe(true);
  await page.locator("#cn-tax-invoice-no").fill(opts.taxInvoiceNo);
  expect(await pickDate(page, dateTrigger(page, "Tax Invoice Date"), opts.docDate)).toBe(true);

  await btn(page, "Add Item").click();
  const dlg = page.locator("[role=dialog]").filter({ hasText: "Select from GRN" });
  for (const line of opts.lines) {
    const row = dlg.locator("label, li, div").filter({ hasText: line.productName }).filter({ has: page.getByRole("checkbox") }).last();
    await row.getByRole("checkbox").click();
  }
  await dlg.getByRole("button", { name: /^Add \d+ items?$/ }).click();
  for (const line of opts.lines) {
    const row = page.locator("table tbody tr").filter({ hasText: line.productName }).first();
    const qty = row.locator('input[name$=".quantity"]');
    await qty.fill(String(line.qty));
    await qty.press("Tab");
  }
  if (opts.dryRun) return null;

  const created = page.waitForResponse(
    (r) => r.request().method() === "POST" && /\/credit-notes\/?(\?|$)/.test(r.url()),
    { timeout: 60_000 },
  );
  await btn(page, "Create").click();
  const resp = await created;
  expect(resp.ok(), `create CN ${resp.status()} ${await resp.text()}`).toBe(true);
  const id: string = (await resp.json()).data?.id;
  opts.onCreated?.(await cnById(id, bu));
  await lastToast(page);

  if (opts.status === "completed") await submitCreditNote(page, id, bu);
  return cnById(id, bu);
}

export async function submitCreditNote(page: Page, id: string, bu: string): Promise<void> {
  await gotoBu(page, `/procurement/credit-note/${id}`, bu);
  await btn(page, "Submit").click();
  await dialogConfirm(page, /^submit$/i);
  await expect.poll(async () => (await cnById(id, bu)).status, { timeout: 60_000 }).toBe("completed");
}

/** CN draft: Edit → Delete → confirm. Soft delete on the backend. */
export async function deleteCreditNoteDraft(page: Page, id: string, bu: string): Promise<void> {
  await gotoBu(page, `/procurement/credit-note/${id}`, bu);
  await btn(page, "Edit").click();
  await btn(page, "Delete").click();
  await dialogConfirm(page, /^delete$/i);
  await expect.poll(async () => (await dfGet(`/credit-notes/${id}`, "Admin", bu)).status, { timeout: 60_000 }).not.toBe(200);
}
