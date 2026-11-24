import { expect, type Locator, type Page } from "@playwright/test";
import { gotoBu } from "../../fixtures/movement.fixture";
import { btn, field, lastToast, pickDate, pickLookup, pickSelect } from "./ui";
import { apiGet } from "./api";

/**
 * Create / commit / void inventory documents through the real screens, for the
 * movement suite (doc-flow specs and period close). Every helper takes the BU
 * explicitly: the suite posts into CARMEN-AVG and CARMEN-FIFO, and a document in
 * the wrong BU would silently corrupt the other one's stock.
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

export type AdjustmentType = "stock-in" | "stock-out";

/** คาร์เมน ซอฟต์แวร์ บจก. — the vendor every movement GRN/CN uses. */
export const MOVEMENT_VENDOR = "C010";

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
  const { body } = await apiGet(`/api/${bu}/good-received-notes/${id}`);
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
    vendor?: string;
    dryRun?: boolean;
    /** Called as soon as the document exists (before commit) so a spec can record it before a commit failure. */
    onCreated?: (doc: CreatedDoc) => void;
  },
): Promise<CreatedDoc | null> {
  const { bu, location } = opts;
  await gotoBu(page, "/procurement/goods-receive-note/new?doc_type=manual", bu);
  await pickLookup(page, field(page, "Vendor").locator("button").first(), opts.vendor ?? MOVEMENT_VENDOR);
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

/** Confirm Void — GRN uses a plain confirm; SI/SO use VoidDialog with a required #void-reason. */
async function confirmVoid(page: Page, reason: string) {
  const dlg = page.locator("[role=alertdialog], [role=dialog]").filter({ hasText: /void/i }).last();
  await expect(dlg).toBeVisible();
  const reasonBox = dlg.locator("#void-reason");
  if (await reasonBox.count()) await reasonBox.fill(reason);
  await dlg.getByRole("button", { name: "Void", exact: true }).click();
}

/** A GRN that is not committed: Void sits in the view footer. */
export async function voidGrn(page: Page, id: string, reason: string, bu: string): Promise<void> {
  await gotoBu(page, `/procurement/goods-receive-note/${id}`, bu);
  await btn(page, "Void").click();
  await confirmVoid(page, reason);
  await expect.poll(async () => (await grnById(id, bu)).status, { timeout: 60_000 }).toBe("voided");
}

/**
 * Try to void a GRN without assuming it succeeds — for cases the backend must refuse (#713).
 * Returns the toast, the status afterwards, and what the backend really answered
 * (HTTP + catalog code): the toast alone can't be trusted, because the frontend turns
 * a 409 without a message for its code into "someone else changed this" (AVG 2605 case 4.2).
 */
export async function tryVoidGrn(
  page: Page,
  id: string,
  reason: string,
  bu: string,
): Promise<{ toast: string; status: string; http: number; appCode: string }> {
  await gotoBu(page, `/procurement/goods-receive-note/${id}`, bu);
  await btn(page, "Void").click();
  const resp = page.waitForResponse((r) => r.url().includes(`/${id}/void`) && r.request().method() !== "GET", { timeout: 60_000 });
  await confirmVoid(page, reason);
  const r = await resp;
  const body = await r.json().catch(() => ({}));
  // Same place the frontend reads (lib/api-error.ts readErrorBody: body.error.code).
  const appCode: string = body?.error?.code ?? body?.app_code ?? "";
  const toast = await lastToast(page).catch(() => "(no toast)");
  await page.waitForTimeout(1500);
  return { toast, status: (await grnById(id, bu)).status, http: r.status(), appCode: String(appCode) };
}

/** GRN draft: Edit → Delete (header) → confirm. Soft delete on the backend. */
export async function deleteGrnDraft(page: Page, id: string, bu: string): Promise<void> {
  await gotoBu(page, `/procurement/goods-receive-note/${id}`, bu);
  await btn(page, "Edit").click();
  await btn(page, "Delete").click();
  await dialogConfirm(page, /^delete$/i);
  await expect.poll(async () => (await apiGet(`/api/${bu}/good-received-notes/${id}`)).status, { timeout: 60_000 }).not.toBe(200);
}

// ── Inventory Adjustment (Stock In / Stock Out) ──────────────────────────────────

export const adjustmentUrl = (type: AdjustmentType, id: string) =>
  `/inventory-management/inventory-adjustment/${id}?type=${type}`;

/** A voided/deleted SI/SO disappears from the API (void is a soft delete too) → status "deleted". */
export async function adjustmentById(type: AdjustmentType, id: string, bu: string): Promise<CreatedDoc> {
  const { body } = await apiGet(`/api/${bu}/${type}s/${id}`);
  const d = body?.data;
  if (!d) return { id, no: "", status: "deleted" };
  return { id, no: d.si_no ?? d.so_no, status: d.doc_status };
}

/**
 * Stock In / Stock Out through the Inventory Adjustment screen:
 *   draft     = Save
 *   completed = Commit (footer) + confirm
 * Also returns the cost the form auto-filled before any edit (CostProbe), as evidence.
 */
export async function createAdjustment(
  page: Page,
  opts: {
    bu: string;
    location: string;
    type: AdjustmentType;
    date: string;
    reason: string;
    lines: Line[];
    status: "draft" | "completed";
    dryRun?: boolean;
    onCreated?: (doc: CreatedDoc) => void;
    /** The cost CostProbe filled per row (before edits) — called before a dryRun returns too. */
    onAutoCost?: (costs: string[]) => void;
  },
): Promise<(CreatedDoc & { autoCost: string[] }) | null> {
  const { bu } = opts;
  await gotoBu(page, `/inventory-management/inventory-adjustment/new?type=${opts.type}`, bu);
  expect(await pickDate(page, dateTrigger(page, "Date"), opts.date), `Date ${opts.date}`).toBe(true);
  // Reason (adjustment type) changed from a Select to a lazy lookup — support both.
  const reason = field(page, "Reason").locator("[role=combobox], button").first();
  if ((await reason.getAttribute("data-slot")) === "select-trigger") await pickSelect(page, reason, opts.reason);
  else await pickLookup(page, reason, opts.reason);
  await pickLookup(page, field(page, "Location").locator("button").first(), opts.location);

  const autoCost: string[] = [];
  for (const line of opts.lines) {
    const row = await addItemRow(page);
    await pickRowLookup(page, row, "Select Product", line.product);
    const qty = row.locator('input[type="number"]').first();
    await qty.fill(String(line.qty));
    await qty.press("Tab");
    await page.waitForTimeout(1500); // CostProbe fills the cost
    if (opts.type === "stock-in") {
      const cost = row.locator("input").nth(1);
      autoCost.push(await cost.inputValue());
      if (line.price != null) {
        await cost.fill(String(line.price));
        await cost.press("Tab");
      }
    } else {
      // The SO form has no unit-cost input, only Total Cost (column before the delete button).
      autoCost.push((await row.locator("td").nth(-2).innerText()).trim().replace(/,/g, ""));
    }
  }
  opts.onAutoCost?.(autoCost);
  if (opts.dryRun) return null;

  const created = page.waitForResponse(
    (r) => r.request().method() === "POST" && new RegExp(`/${opts.type}s/?(\\?|$)`).test(r.url()),
    { timeout: 60_000 },
  );
  if (opts.status === "draft") {
    await btn(page, "Save").click();
  } else {
    await btn(page, "Commit").click();
    await dialogConfirm(page, /commit/i);
  }
  const resp = await created;
  expect(resp.ok(), `create ${opts.type} ${resp.status()} ${await resp.text()}`).toBe(true);
  const id: string = (await resp.json()).data?.id;
  opts.onCreated?.(await adjustmentById(opts.type, id, bu));
  await lastToast(page);
  if (opts.status === "completed") {
    await expect.poll(async () => (await adjustmentById(opts.type, id, bu)).status, { timeout: 60_000 }).toBe("completed");
  }
  const doc = await adjustmentById(opts.type, id, bu);
  return { ...doc, autoCost };
}

/**
 * SI/SO draft: Void sits in the footer in edit mode only → Edit → Void.
 * The backend voids and soft-deletes in one go (stock-in.service voidStockIn), so the
 * document vanishes from the API — accept voided or deleted. Returns the payload the
 * frontend really sent, to check whether void_reason reached the backend.
 */
export async function voidAdjustment(page: Page, type: AdjustmentType, id: string, reason: string, bu: string) {
  await gotoBu(page, adjustmentUrl(type, id), bu);
  await btn(page, "Edit").click();
  await btn(page, "Void").click();
  const req = page.waitForRequest((r) => r.url().includes(id) && /void/i.test(r.url()) && r.method() !== "GET");
  await confirmVoid(page, reason);
  const sent = await req;
  await expect.poll(async () => (await adjustmentById(type, id, bu)).status, { timeout: 60_000 }).toMatch(/^(voided|deleted)$/);
  return { payload: sent.postData() ?? "", url: sent.url() };
}

/** SI/SO draft: Delete in the header (view mode) → confirm. */
export async function deleteAdjustment(page: Page, type: AdjustmentType, id: string, bu: string): Promise<void> {
  await gotoBu(page, adjustmentUrl(type, id), bu);
  await btn(page, "Delete").click();
  await dialogConfirm(page, /^delete$/i);
  await expect.poll(async () => (await apiGet(`/api/${bu}/${type}s/${id}`)).status, { timeout: 60_000 }).not.toBe(200);
}

// ── Credit Note ────────────────────────────────────────────────────────────────

export async function cnById(id: string, bu: string): Promise<CreatedDoc> {
  const { body } = await apiGet(`/api/${bu}/credit-notes/${id}`);
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
    vendor?: string;
    onCreated?: (doc: CreatedDoc) => void;
    dryRun?: boolean;
  },
): Promise<CreatedDoc | null> {
  const { bu } = opts;
  await gotoBu(page, "/procurement/credit-note/new", bu);
  await pickLookup(page, field(page, "Vendor").locator("button").first(), opts.vendor ?? MOVEMENT_VENDOR);
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
  await expect.poll(async () => (await apiGet(`/api/${bu}/credit-notes/${id}`)).status, { timeout: 60_000 }).not.toBe(200);
}
