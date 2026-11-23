import { expect, type Locator } from "@playwright/test";
import { BasePage } from "./base.page";

const PATH = "/operation-plan/import-pos";

/**
 * Import POS (`/operation-plan/import-pos`): upload buttons per enabled brand, the import history table and the raw
 * lines of the import picked with "View lines" (`?import=<id>`). Locators are factories so they survive navigations.
 * หน้า Import POS: ปุ่มอัปโหลดตามแบรนด์ที่เปิด ตารางประวัติ และบรรทัดดิบของรายการที่เลือก
 */
export class ImportPosPage extends BasePage {
  async goto() {
    await this.page.goto(PATH);
    await expect(this.page.getByRole("heading", { name: "Import history" })).toBeVisible({ timeout: 20_000 });
  }

  // ── Upload ───────────────────────────────────────────────────────────
  /** Upload button of a brand: Simphony "Upload file", Micros 3700 "Upload PDF". Absent when the brand is not enabled. */
  uploadButton(brand: "simphony" | "micros3700"): Locator {
    return this.page.getByRole("button", { name: brand === "simphony" ? /^Upload file$/ : /^Upload PDF$/ });
  }

  /**
   * Feed a Simphony file to the hidden file input of the upload button (the button only calls `input.click()`, so
   * the input is set directly, which is what a file chooser does). Resolves once the input took the file.
   */
  async uploadSimphony(file: string, name: string) {
    await expect(this.uploadButton("simphony")).toBeEnabled();
    await this.page
      .locator('input[type="file"][accept=".txt,text/plain"]')
      .setInputFiles({ name, mimeType: "text/plain", buffer: Buffer.from(file, "utf8") });
  }

  // ── History ──────────────────────────────────────────────────────────
  /** The history row of a file by the file name it shows. */
  historyRow(fileName: string): Locator {
    return this.page.locator("[data-slot=data-row]").filter({ has: this.page.getByText(fileName, { exact: true }) });
  }

  /** The status badge text of a history row ("Imported", "Already imported for this date", ...). */
  rowStatus(fileName: string): Locator {
    return this.historyRow(fileName).locator("td").nth(5);
  }

  /** "View lines" of a row (only successful imports have it). */
  openLines(fileName: string): Locator {
    return this.historyRow(fileName).getByRole("button", { name: "View lines" });
  }

  /** The raw transactions section opened by "View lines". */
  rawLinesSection(): Locator {
    return this.page.getByRole("region", { name: "Raw transactions" });
  }

  /** Its table body rows. */
  rawLinesTable(): Locator {
    return this.rawLinesSection().locator("[data-slot=data-row]");
  }

  /** One raw line by item code (code cell is exact). */
  rawLine(itemCode: string): Locator {
    return this.rawLinesTable().filter({ has: this.page.getByRole("cell", { name: itemCode, exact: true }) });
  }

  // ── Row actions ──────────────────────────────────────────────────────
  /** The Sales Consumption link of a row (its `sc_no`); "-" when the import has none. */
  scLink(fileName: string): Locator {
    return this.historyRow(fileName).getByRole("link", { name: /^SC/ });
  }

  /** "Cancel import" of a row; only an import with no confirmed lines has it. */
  cancelImport(fileName: string): Locator {
    return this.historyRow(fileName).getByRole("button", { name: "Cancel import" });
  }

  /** The confirm dialog of cancel-import and its confirm button. */
  cancelDialog(): Locator {
    return this.page.getByRole("alertdialog", { name: "Cancel this import?" });
  }

  cancelConfirmButton(): Locator {
    return this.cancelDialog().getByRole("button", { name: "Cancel import" });
  }
}
