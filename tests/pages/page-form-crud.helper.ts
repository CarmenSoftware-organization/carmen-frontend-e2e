import type { Page, Locator } from "@playwright/test";
import { ConfigListPage } from "./config-list.page";
import { BasePage } from "./base.page";

/**
 * Helper for page-form-based config modules (department, location, adjustment-type).
 *
 * These modules use a full page form (not a dialog) with:
 *  - /config/{module}        → list
 *  - /config/{module}/new    → create form
 *  - /config/{module}/[id]   → view/edit form (toggle via Edit button)
 *
 * The form uses FormToolbar with Save/Create button via formId attribute.
 */
export interface PageFormCrudOptions {
  listPath: string;
  codeInputId: string; // e.g. "department-code"
  nameInputId: string; // e.g. "department-name"
  activeSwitchId?: string; // e.g. "department-is-active"
  descriptionInputId?: string; // e.g. "department-description"
}

class _BasePageImpl extends BasePage {}

export class PageFormCrudHelper {
  readonly list: ConfigListPage;
  private readonly base: _BasePageImpl;

  constructor(
    private page: Page,
    private opts: PageFormCrudOptions,
  ) {
    this.list = new ConfigListPage(page, opts.listPath);
    this.base = new _BasePageImpl(page);
  }

  async gotoNew() {
    await this.page.goto(`${this.opts.listPath}/new`);
    await this.page.waitForLoadState("networkidle");
  }

  codeInput(): Locator {
    return this.page.locator(`#${this.opts.codeInputId}`);
  }

  nameInput(): Locator {
    return this.page.locator(`#${this.opts.nameInputId}`);
  }

  activeSwitch(): Locator | null {
    return this.opts.activeSwitchId
      ? this.page.locator(`#${this.opts.activeSwitchId}`)
      : null;
  }

  descriptionInput(): Locator {
    if (!this.opts.descriptionInputId) {
      throw new Error("descriptionInputId not configured for this module");
    }
    return this.page.locator(`#${this.opts.descriptionInputId}`);
  }

  /** Read the Radix status switch state (role="switch" → aria-checked). */
  async isActive(): Promise<boolean> {
    const sw = this.activeSwitch();
    if (!sw) throw new Error("activeSwitchId not configured for this module");
    return (await sw.getAttribute("aria-checked")) === "true";
  }

  /** Set the status switch to `on`, clicking only if it differs from current. */
  async setActive(on: boolean): Promise<void> {
    const sw = this.activeSwitch();
    if (!sw) throw new Error("activeSwitchId not configured for this module");
    if ((await this.isActive()) !== on) {
      await sw.click();
    }
  }

  // Save button is rendered by FormToolbar — name is "Create" or "Save" depending on mode
  saveButton(): Locator {
    return this.page.getByRole("button", {
      name: /^(Create|Save|สร้าง|บันทึก)$/i,
    });
  }

  cancelButton(): Locator {
    return this.page.getByRole("button", { name: /^(Cancel|ยกเลิก)$/i });
  }

  /**
   * ค่าที่ฟอร์มแสดงในโหมด view (ผูกกับ id ของ input ตัวเดียวกันผ่าน label[for]).
   *
   * หน้ารายละเอียดกลับเป็นโหมด view ทุกครั้งที่โหลดใหม่ — `hooks/use-entity-form.ts`
   * ตั้ง `mode = "view"` และโหมดนั้นไม่ render input เลย ค่าออกมาเป็น
   * `<span data-slot="field-plain-text">` แทน การ assert ค่าหลัง reload จึงต้องอ่าน
   * จากตรงนี้ ไม่ใช่จาก `#<id>` ซึ่งยังไม่มีอยู่จนกว่าจะกด Edit
   */
  viewValueFor(inputId: string): Locator {
    return this.page
      .locator(`[data-slot="field"]:has(label[for="${inputId}"]) [data-slot="field-plain-text"]`)
      .first();
  }

  /**
   * The field as view mode shows it, whichever way the form renders read mode: plain text
   * (`readOnly` fields, see viewValueFor) or a disabled input (forms that pass `disabled`, e.g.
   * operation-plan/category). Use for visibility checks; read values with viewValueFor.
   * ช่องในโหมด view ไม่ว่าฟอร์มจะแสดงเป็นข้อความล้วนหรือ input ที่ disabled
   */
  viewFieldFor(inputId: string): Locator {
    return this.viewValueFor(inputId).or(this.page.locator(`#${inputId}[disabled]`)).first();
  }

  editButton(): Locator {
    return this.page.getByRole("button", { name: /^(Edit|แก้ไข)$/i });
  }

  deleteButton(): Locator {
    return this.page.getByRole("button", { name: /^(Delete|ลบ)$/i });
  }

  errorMessage(): Locator {
    return this.page.locator("[data-invalid='true'] [role='alert'], form [data-invalid='true']").first();
  }

  deleteConfirm(): Locator {
    return this.base.alertDialog();
  }

  deleteConfirmButton(): Locator {
    return this.deleteConfirm().getByRole("button", { name: /^(Delete|ลบ)$/i });
  }

  async clickRowName(name: string) {
    // CellAction renders a <button> — click it directly so navigation fires
    // even if the cell has padding/whitespace around the button.
    const button = this.page.getByRole("button", { name, exact: true }).first();
    await button.waitFor({ state: "visible", timeout: 10_000 });
    await button.click();
    // Wait for navigation to /{listPath}/{id}, not the list itself or /new.
    const listPath = this.opts.listPath.replace(/\/$/, "");
    await this.page.waitForURL(
      (url) => {
        const p = url.pathname.replace(/\/$/, "");
        return p.startsWith(`${listPath}/`) && !p.endsWith("/new");
      },
      { timeout: 10_000 },
    );
    await this.page.waitForLoadState("networkidle");
  }
}
