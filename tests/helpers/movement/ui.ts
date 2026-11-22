import { expect, type Locator, type Page, type Response } from "@playwright/test";

// The frontend has almost no data-testid (two in the whole app), so these helpers
// anchor on the shared components' data-slot attributes and on visible labels.
// A required field's label carries a trailing "*" in the same span, hence ^label\*?$.

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The field container for a visible label. */
export function field(scope: Page | Locator, label: string): Locator {
  const lbl = scope
    .locator("[data-slot=field-label], label")
    .filter({ hasText: new RegExp(`^\\s*${esc(label)}\\s*\\*?\\s*$`) })
    .first();
  return lbl.locator("xpath=ancestor::*[@data-slot='field'][1]");
}

/** Button by exact accessible name. */
export const btn = (scope: Page | Locator, name: string | RegExp) =>
  scope.getByRole("button", { name, exact: typeof name === "string" });

/** Visible button by exact accessible name (skips hidden duplicates rendered for other breakpoints). */
export const button = (scope: Page | Locator, name: string | RegExp) =>
  scope.getByRole("button", { name, exact: typeof name === "string" }).filter({ visible: true });

/**
 * Pick an option in a lookup popover (command list); empty search = first option.
 * Returns the picked option's text.
 *
 * Several tables (GRN rows, SI rows) open the next lookup on their own
 * (`defaultOpen`): if a popover is already open, use it — clicking the trigger
 * again would toggle it shut. An option that is already selected is not clicked
 * again (that would deselect it).
 */
export async function pickLookup(page: Page, trigger: Locator, search = "", match?: RegExp): Promise<string> {
  const openInput = page.locator("[data-slot=popover-content]:visible [data-slot=command-input]");
  await page.waitForTimeout(500);
  if (!(await openInput.count())) await trigger.click();
  const input = openInput.last();
  await input.waitFor();
  if (search) await input.fill(search);
  const option = page
    .locator("[data-slot=popover-content]:visible button[data-value]")
    .filter({ hasText: match ?? (search ? new RegExp(esc(search), "i") : /./) })
    .first();
  await expect(option).toBeVisible();
  const text = (await option.innerText()).replace(/\s+/g, " ").trim();
  if ((await option.getAttribute("aria-pressed")) === "true") {
    await page.keyboard.press("Escape");
    return text;
  }
  const value = await option.getAttribute("data-value");
  await option.click();
  // The next popover may open at once, so wait for the clicked option to go — not for the popover to close.
  await expect(page.locator(`[data-slot=popover-content]:visible button[data-value=${JSON.stringify(value)}]`)).toHaveCount(0);
  return text;
}

/** Pick from a Radix Select (trigger is a combobox). */
export async function pickSelect(page: Page, trigger: Locator, optionText: string | RegExp): Promise<void> {
  await trigger.click();
  await page.locator("[data-slot=select-item], [role=option]").filter({ hasText: optionText }).first().click();
}

/** Radix Select inside the field with `label` (e.g. Workflow) — by text, or the first option. */
export async function pickSelectIn(page: Page, label: string, option?: string | RegExp): Promise<string> {
  await field(page, label).getByRole("combobox").click();
  const items = page.locator("[data-slot=select-item]:visible, [role=option]:visible");
  const item = option ? items.filter({ hasText: option }).first() : items.first();
  const text = (await item.innerText()).trim();
  await item.click();
  return text;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Pick a date in the DatePicker (react-day-picker): page months until the caption
 * matches, then click the day. `data-day` uses the browser's toLocaleDateString()
 * — the movement projects pin locale en-US, so M/D/YYYY.
 * Returns false when the day is disabled (e.g. the calendar is locked to the
 * current period) — the caller decides whether that is N/A or a failure.
 */
export async function pickDate(page: Page, trigger: Locator, isoDate: string): Promise<boolean> {
  const [y, m, d] = isoDate.split("-").map(Number);
  await trigger.click();
  const pop = page.locator("[data-slot=popover-content]:visible").last();
  const target = `${MONTHS[m - 1]} ${y}`;
  for (let i = 0; i < 36; i++) {
    const caption = (await pop.locator(".rdp-caption_label, [role=status]").first().innerText()).trim();
    if (caption === target) break;
    const [cm, cy] = caption.split(" ");
    const cur = Number(cy) * 12 + MONTHS.indexOf(cm);
    const want = y * 12 + (m - 1);
    const nav = pop.locator(want < cur ? ".rdp-button_previous" : ".rdp-button_next");
    if (await nav.isDisabled()) return false;
    await nav.click();
  }
  const day = pop.locator(`button[data-day="${m}/${d}/${y}"]`);
  if (!(await day.count()) || (await day.isDisabled())) {
    await page.keyboard.press("Escape");
    return false;
  }
  await day.click();
  return true;
}

/** Text of the latest toast (sonner). */
export async function lastToast(page: Page, timeout = 15_000): Promise<string> {
  const t = page.locator("[data-sonner-toast]").last();
  await t.waitFor({ state: "visible", timeout });
  return (await t.innerText()).replace(/\s+/g, " ").trim();
}

/** Every toast currently shown. */
export async function toasts(page: Page): Promise<string[]> {
  return (await page.locator("[data-sonner-toast]").allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim());
}

/** Confirm in the latest (alert)dialog. */
export async function confirmDialog(page: Page, name: string | RegExp): Promise<void> {
  const dlg = page.locator("[role=alertdialog]:visible, [role=dialog]:visible").last();
  await expect(dlg).toBeVisible();
  await dlg.getByRole("button", { name }).last().click();
}

/**
 * Click Add Item and return the new row, pinned by index. The new row is inserted
 * at the TOP (and GRN copies the previous row's location into it), so it is found
 * by the placeholder button it still shows. Do not keep a filter({ has: placeholder })
 * locator: once the product is picked the placeholder is gone and the locator loses the row.
 */
export async function addRow(page: Page, placeholder = "Select Product", addLabel = "Add Item"): Promise<Locator> {
  const rows = page.locator("table tbody tr");
  await button(page, addLabel).click();
  await expect(rows.filter({ has: page.getByRole("button", { name: placeholder }) })).toHaveCount(1);
  const idx = await rows.evaluateAll(
    (trs, ph) => trs.findIndex((tr) => Array.from(tr.querySelectorAll("button")).some((b) => b.textContent?.trim() === ph)),
    placeholder,
  );
  return rows.nth(idx);
}

/** Values of every visible input/textarea (view mode has no id/name to anchor on). */
export async function inputValues(page: Page): Promise<string[]> {
  return page.locator("input:visible, textarea:visible").evaluateAll((xs) => xs.map((x) => (x as HTMLInputElement).value));
}

/**
 * What a document page shows for its header fields: input values (edit mode) plus the
 * page text (view mode renders description / invoice no. as plain text, not inputs).
 */
export async function shownText(page: Page): Promise<string> {
  return [...(await inputValues(page)), await page.locator("main").innerText()].join("\n");
}

/**
 * Type into a numeric field like a user: click → select all → type → Tab.
 * Never locator.fill() a price field that already holds a value: the field
 * reformats on focus ("18.00" → "18"), fill's selection is lost and the digits
 * get appended ("1821"). Users don't hit it — clicking selects the text for them.
 */
export async function typeInto(input: Locator, value: string | number): Promise<void> {
  await input.click();
  await input.press("ControlOrMeta+a");
  await input.pressSequentially(String(value));
  await input.press("Tab");
}

/** Matches a number inside row text, tolerant of "3KG", "3.00 BOX", "12.50" (strip "," before matching). */
export function numRe(n: number): RegExp {
  const forms = [...new Set([String(n), n.toFixed(2)])].map((f) => f.replace(".", "\\."));
  return new RegExp(`(^|[^\\d.])(${forms.join("|")})(\\.0+)?(?![\\d])`);
}

/**
 * The SR Submit confirm dialog asks "Today is outside the open period ... pick the date" itself
 * (FE 7bca06a0) and keeps Submit disabled until a radio is chosen. Picks one when the question is
 * there; returns whether it was asked.
 */
export async function chooseDateInDialog(dlg: Locator, choice: "open-period" | "today" = "open-period"): Promise<boolean> {
  const radios = dlg.getByRole("radio");
  if (!(await radios.count())) return false;
  await dlg.getByRole("radio", { name: choice === "today" ? /^Today/ : /^Last day of the open period/ }).click();
  return true;
}

/**
 * Answer the store requisition's "Which date should this carry?" question (submit / issue).
 * The backend answers 422 `SR_DATE_PATTERN_REQUIRED` / `SR_ISSUE_DATE_PATTERN_REQUIRED`
 * when today is outside the active period; the frontend then asks, and resends.
 * Returns whether it asked, plus the backend's final answer.
 */
export async function answerSrDateQuestion(
  page: Page,
  first: Response,
  url: RegExp,
  choice: "open-period" | "today" = "open-period",
) {
  const firstBody = await first.json().catch(() => ({}));
  const code: string = firstBody?.error?.code ?? "";
  if (!/DATE_PATTERN_REQUIRED$/.test(code)) return { asked: false, code, res: first, body: firstBody };
  const dlg = page.getByRole("alertdialog").filter({ hasText: "Which date should this carry?" });
  await dlg.waitFor({ state: "visible", timeout: 15_000 });
  const again = page.waitForResponse((r) => url.test(r.url()) && r.request().method() !== "GET", { timeout: 60_000 });
  await dlg.getByRole("button", { name: choice === "today" ? /today anyway/i : /inside the open period/i }).click();
  const res = await again;
  return { asked: true, code, res, body: await res.json().catch(() => ({})) };
}
