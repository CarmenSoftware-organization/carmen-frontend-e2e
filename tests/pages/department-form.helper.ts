import { expect, type Page, type Locator } from "@playwright/test";

/**
 * Scopes interactions to one of the department form's two Transfer widgets,
 * identified by its section heading ("Department Members" or "Head of
 * Department"). The form renders both with an identical move button
 * (aria-label "Move selected to right"), so every locator is scoped to the
 * section container to avoid cross-matching.
 */
export class DepartmentMembersHelper {
  constructor(private readonly page: Page) {}

  /** The section container (the bordered card) that holds the given heading. */
  private section(heading: string): Locator {
    return this.page
      .locator("div")
      .filter({ has: this.page.getByText(heading, { exact: true }) })
      .filter({ has: this.page.getByRole("button", { name: "Move selected to right" }) })
      .last();
  }

  /** Count shown on the "Available Users" header of the section's left list. */
  async availableUsers(heading: string): Promise<number> {
    const section = this.section(heading);
    // The header reads "-1 / LOADING..." until the user list arrives — poll until it is a count.
    let count = -1;
    await expect
      .poll(
        async () => {
          const m = (await section.innerText()).match(/available users\s*(\d+)\s*(?!loading)/i);
          count = m ? Number(m[1]) : -1;
          return count >= 0 && !/loading/i.test(await section.innerText());
        },
        { timeout: 15_000, message: `"Available Users" count under ${heading} never loaded` },
      )
      .toBe(true);
    return count;
  }

  /** Number of selectable users in the section's left ("available") list. */
  async availableCount(heading: string): Promise<number> {
    return this.section(heading).getByRole("checkbox").count();
  }

  /**
   * Tick the first available user and move it to the right (assigned) list.
   * Returns the moved user's visible label, or null if none were available.
   */
  async assignFirstAvailable(heading: string): Promise<string | null> {
    const section = this.section(heading);
    // checkbox #0 is the "Available Users" header (select all) — the first row is #1
    const firstCheckbox = section.getByRole("checkbox").nth(1);
    if ((await firstCheckbox.count()) === 0) return null;
    const label = await firstCheckbox.evaluate((el) => (el.parentElement?.textContent ?? "").trim());
    await firstCheckbox.check();
    await section.getByRole("button", { name: "Move selected to right" }).click();
    return label || "(moved)";
  }

  /**
   * Tick the first *assigned* user and move it back to the left (available) list. Returns the
   * moved user's label, or null when nothing is assigned.
   */
  async unassignFirstAssigned(heading: string): Promise<string | null> {
    const section = this.section(heading);
    const boxes = section.getByRole("checkbox");
    // Layout: [available header][available rows...][assigned header][assigned rows...]
    const idx = (await this.availableUsers(heading)) + 2;
    if ((await boxes.count()) <= idx) return null;
    const first = boxes.nth(idx);
    const label = await first.evaluate((el) => (el.parentElement?.textContent ?? "").trim());
    await first.check();
    await section.getByRole("button", { name: "Move selected to left" }).click();
    return label || "(moved)";
  }
}
