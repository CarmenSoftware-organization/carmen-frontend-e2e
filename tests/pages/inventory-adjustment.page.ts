import type { Locator } from "@playwright/test";
import { BasePage } from "./base.page";

const BASE = "/inventory-management/inventory-adjustment";

/** Field container for a visible label (a required label carries a trailing "*"). */
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Inventory Adjustment form (Stock In / Stock Out): `/new?type=` and `/:id?type=`.
 * Selectors copied from the 730 movement helpers; factories only, no assertions.
 * ฟอร์ม Inventory Adjustment — ตัวหา element อย่างเดียว
 */
export class InventoryAdjustmentPage extends BasePage {
  async gotoNew(type: "stock-in" | "stock-out") {
    await this.page.goto(`${BASE}/new?type=${type}`);
  }
  async gotoDoc(type: "stock-in" | "stock-out", id: string) {
    await this.page.goto(`${BASE}/${id}?type=${type}`);
  }

  private field(label: string): Locator {
    return this.page
      .locator("[data-slot=field-label], label")
      .filter({ hasText: new RegExp(`^\\s*${esc(label)}\\s*\\*?\\s*$`) })
      .first()
      .locator("xpath=ancestor::*[@data-slot='field'][1]");
  }

  description(): Locator {
    return this.page.locator("#inv-adj-description");
  }
  /** Lookup trigger of the Location field. */
  location(): Locator {
    return this.field("Location").locator("button").first();
  }
  /** Trigger of the Reason (adjustment type) lookup. */
  reason(): Locator {
    return this.field("Reason").locator("[role=combobox], button").first();
  }
  /** The date field's opener (its first button; the second is Clear). */
  dateTrigger(): Locator {
    return this.field("Date").locator("button").first();
  }
  addItem(): Locator {
    return this.page.getByRole("button", { name: "Add Item", exact: true }).filter({ visible: true });
  }
  private row(i: number): Locator {
    return this.page.locator("table tbody tr").nth(i);
  }
  lineQty(i: number): Locator {
    return this.row(i).locator('input[name$=".qty"]');
  }
  lineCost(i: number): Locator {
    return this.row(i).locator('input[name$=".cost_per_unit"]');
  }
  grandTotal(): Locator {
    return this.page.getByText("Grand Total").locator("xpath=ancestor::*[self::div or self::section][1]");
  }
  saveButton(): Locator {
    return this.page.getByRole("button", { name: "Save", exact: true }).filter({ visible: true }).first();
  }
  commitButton(): Locator {
    return this.page.getByRole("button", { name: "Commit", exact: true }).filter({ visible: true });
  }
  voidButton(): Locator {
    return this.page.getByRole("button", { name: "Void", exact: true }).filter({ visible: true });
  }
  deleteButton(): Locator {
    return this.page.getByRole("button", { name: "Delete", exact: true }).filter({ visible: true }).first();
  }
}
