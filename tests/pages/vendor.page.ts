import type { Page, Locator } from "@playwright/test";
import { expect } from "@playwright/test";
import { BasePage } from "./base.page";
import { ConfigListPage } from "./config-list.page";

export interface VendorAddressInput {
  address_type?: "contact_address" | "mailing_address" | "register_address";
  address_line1?: string;
  address_line2?: string;
  city?: string;
  district?: string;
  sub_district?: string;
  province?: string;
  postal_code?: string;
  country?: string;
  mode?: "thai" | "international";
}

export interface VendorContactInput {
  name?: string;
  email?: string;
  phone?: string;
  is_primary?: boolean;
}

export interface VendorInfoInput {
  label: string;
  value: string;
  dataType?: "string" | "number";
}

export interface VendorFormData {
  code: string;
  name: string;
  description?: string;
  businessType?: string;
  isActive?: boolean;
  addresses?: VendorAddressInput[];
  contacts?: VendorContactInput[];
  info?: VendorInfoInput[];
}

export const LIST_PATH = "/vendor-management/vendor";
export const NEW_PATH = "/vendor-management/vendor/new";

/**
 * Page object for the **redesigned** Vendor module.
 *
 * The form is a single sectioned page (no Radix tabs): a `#vendor-code` input, a
 * hero `NameField`, a `LookupBuType` business-type multi-select, a
 * `#vendor-description` textarea, and Addresses / Contacts / Info **sections**
 * built on react-hook-form field arrays. Array inputs therefore carry stable
 * `name="vendor_address.<i>.<field>"` (etc.) attributes, which we target
 * directly. Rows are **prepended**, so a freshly added row is index 0.
 *
 * `switchTab()` is retained as a no-op for backward compatibility with existing
 * callers — every section now lives on one page.
 */
export class VendorPage extends BasePage {
  readonly list: ConfigListPage;

  constructor(page: Page) {
    super(page);
    this.list = new ConfigListPage(page, LIST_PATH);
  }

  // ── Navigation ────────────────────────────────────────────────────────
  async gotoList() {
    await this.page.goto(LIST_PATH);
    await this.page.waitForLoadState("networkidle");
  }

  async gotoNew() {
    await this.page.goto(NEW_PATH);
    await this.page.waitForLoadState("networkidle");
  }

  // ── Form — general section ────────────────────────────────────────────
  codeInput(): Locator {
    return this.page.locator("#vendor-code");
  }

  nameInput(): Locator {
    return this.page.locator("#vendor-name");
  }

  descriptionInput(): Locator {
    return this.page.locator("#vendor-description");
  }

  // override: FormToolbar submit button (text "Create" in add mode, "Save" in edit)
  saveButton(): Locator {
    return this.page
      .getByRole("button", { name: /^(Create|Save|บันทึก|สร้าง)$/i })
      .and(this.page.locator('[type="submit"]'));
  }

  /** No-op: the redesign renders all sections on a single page (no tabs). */
  async switchTab(_tab?: "general" | "info" | "address" | "contact") {
    /* sections share one page now */
  }

  // ── Business type (LookupBuType: Popover + Command, multi-select) ──────
  businessTypeTrigger(): Locator {
    // The General fields sit OUTSIDE <form id="vendor-form"> now (they live in the header card —
    // FE 8a8885c0), so scope by the "Business Type" field wrapper instead of the form id.
    return this.page
      .locator('[data-slot="field"]')
      .filter({ hasText: /Business Type/i })
      .locator("button[aria-expanded]")
      .first();
  }

  businessTypeSearch(): Locator {
    // CommandInput inside the popover.
    return this.page.getByRole("dialog").getByPlaceholder(/search/i).first()
      .or(this.page.getByPlaceholder(/search/i).last());
  }

  async pickBusinessType(label?: string): Promise<string> {
    await this.businessTypeTrigger().click();
    const search = this.businessTypeSearch();
    await search.waitFor({ state: "visible", timeout: 5_000 });
    if (label) await search.fill(label);
    const firstOption = this.page.getByRole("option").first();
    await firstOption.waitFor({ state: "visible", timeout: 5_000 });
    const text = (await firstOption.textContent()) ?? "";
    await firstOption.click();
    await this.page.keyboard.press("Escape");
    return text.trim();
  }

  async businessTypeOptionCount(): Promise<number> {
    await this.businessTypeTrigger().click();
    const search = this.businessTypeSearch();
    await search.waitFor({ state: "visible", timeout: 5_000 });
    await Promise.race([
      this.page.getByRole("option").first().waitFor({ state: "visible", timeout: 3_000 }),
      this.page.getByText(/no.*found|not.*found|ไม่พบ/i).first().waitFor({ state: "visible", timeout: 3_000 }),
    ]).catch(() => {});
    const count = await this.page.getByRole("option").count();
    await this.page.keyboard.press("Escape");
    return count;
  }

  // ── Fill helpers ──────────────────────────────────────────────────────
  async fillGeneral(data: Pick<VendorFormData, "code" | "name" | "description" | "businessType">) {
    await this.codeInput().fill(data.code);
    await this.nameInput().fill(data.name);
    if (data.description !== undefined) {
      await this.descriptionInput().fill(data.description).catch(() => {});
    }
    if (data.businessType !== undefined) {
      const count = await this.businessTypeOptionCount();
      if (count > 0) await this.pickBusinessType(data.businessType || undefined);
    }
  }

  async createVendor(data: VendorFormData) {
    await this.fillGeneral(data);
    if (data.addresses) {
      for (const a of data.addresses) {
        await this.addAddressRow();
        await this.fillAddress(0, a);
      }
    }
    if (data.contacts) {
      for (const c of data.contacts) {
        await this.addContactRow();
        await this.fillContact(0, c);
      }
    }
    if (data.info) {
      for (const i of data.info) {
        await this.addInfoRow();
        await this.fillInfo(0, i);
      }
    }
    await this.saveButton().click();
  }

  async expectSaved() {
    await expect(
      this.page
        .locator('[data-sonner-toast], [role="status"]')
        .filter({ hasText: /success|สำเร็จ|created|updated/i })
        .first(),
    ).toBeVisible({ timeout: 10_000 });
    await expect(this.page).not.toHaveURL(/\/new(\?|$|#)/, { timeout: 10_000 });
  }

  // ── Addresses section ─────────────────────────────────────────────────
  /** Row card scoped by the row's own address_line1 input (stable per row). */
  addressRow(index: number): Locator {
    return this.page
      .locator("div.rounded-xl.border")
      .filter({ has: this.page.locator(`input[name="vendor_address.${index}.address_line1"]`) })
      .first();
  }

  async addAddressRow() {
    const before = await this.addressCount();
    await this.page.getByRole("button", { name: /add address/i }).first().click();
    await expect.poll(() => this.addressCount(), { timeout: 5_000 }).toBe(before + 1);
  }

  async addressCount(): Promise<number> {
    return await this.page.locator('input[name^="vendor_address."][name$=".address_line1"]').count();
  }

  async removeAddressRow(index: number) {
    const before = await this.addressCount();
    await this.addressRow(index).getByRole("button", { name: /remove|delete|ลบ/i }).first().click();
    await expect.poll(() => this.addressCount(), { timeout: 5_000 }).toBe(before - 1);
  }

  async fillAddress(index: number, data: VendorAddressInput) {
    const field = (f: string) => this.page.locator(`input[name="vendor_address.${index}.${f}"]`);

    if (data.address_type) {
      const typeTrigger = this.addressRow(index).getByRole("combobox").first();
      await typeTrigger.click();
      const labelMap: Record<string, RegExp> = {
        contact_address: /contact/i,
        mailing_address: /mailing/i,
        register_address: /register/i,
      };
      await this.page.getByRole("option", { name: labelMap[data.address_type] }).first().click();
    }

    const mode = data.mode ?? "international";
    // Radio labelled "Thailand" / "International" inside the address card (the old #thai-0 ids are gone)
    await this.addressRow(index)
      .getByRole("radio", { name: mode === "thai" ? /thailand/i : /international/i })
      .check({ timeout: 5_000 });

    if (data.address_line1 !== undefined) await field("address_line1").fill(data.address_line1);
    if (data.address_line2 !== undefined) await field("address_line2").fill(data.address_line2);
    if (data.city !== undefined) await field("city").fill(data.city, { timeout: 5_000 });
    if (data.district !== undefined) await field("district").fill(data.district, { timeout: 5_000 });
    if (data.sub_district !== undefined) await field("sub_district").fill(data.sub_district, { timeout: 5_000 });
    if (data.province !== undefined) await field("province").fill(data.province, { timeout: 5_000 });
    if (data.postal_code !== undefined) await field("postal_code").first().fill(data.postal_code, { timeout: 5_000 });
    if (data.country !== undefined) await field("country").fill(data.country, { timeout: 5_000 });
  }

  // ── Contacts section ──────────────────────────────────────────────────
  contactRow(index: number): Locator {
    // The contact card carries `relative` (the section wrapper does not), so this
    // resolves to the single card rather than a wrapper holding multiple cards.
    return this.page
      .locator("div.relative.rounded-xl.border")
      .filter({ has: this.page.locator(`input[name="vendor_contact.${index}.name"]`) })
      .first();
  }

  async addContactRow() {
    const before = await this.contactCount();
    await this.page.getByRole("button", { name: /add contact/i }).first().click();
    await expect.poll(() => this.contactCount(), { timeout: 5_000 }).toBe(before + 1);
  }

  async contactCount(): Promise<number> {
    return await this.page.locator('input[name^="vendor_contact."][name$=".name"]').count();
  }

  async removeContactRow(index: number) {
    const before = await this.contactCount();
    await this.contactRow(index).getByRole("button", { name: /remove|delete|trash|ลบ/i }).first().click();
    // Contact removal is confirmed through a DeleteDialog (AlertDialog).
    await this.page
      .getByRole("alertdialog")
      .getByRole("button", { name: /confirm|delete|ลบ|ok/i })
      .click();
    await expect.poll(() => this.contactCount(), { timeout: 5_000 }).toBe(before - 1);
  }

  async fillContact(index: number, data: VendorContactInput) {
    const field = (f: string) => this.page.locator(`input[name="vendor_contact.${index}.${f}"]`);
    if (data.name !== undefined) await field("name").fill(data.name);
    if (data.email !== undefined) await field("email").fill(data.email);
    if (data.phone !== undefined) await field("phone").fill(data.phone);
    if (data.is_primary) await this.setPrimaryContact(index);
  }

  async setPrimaryContact(index: number) {
    await this.contactRow(index).getByRole("checkbox").first().check({ force: true });
  }

  // ── Info section ──────────────────────────────────────────────────────
  infoRow(index: number): Locator {
    return this.page
      .locator("div.rounded-lg.border")
      .filter({ has: this.page.locator(`input[name="info.${index}.label"]`) })
      .first();
  }

  async addInfoRow() {
    const before = await this.infoCount();
    await this.page.getByRole("button", { name: /add field|add info/i }).first().click();
    await expect.poll(() => this.infoCount(), { timeout: 5_000 }).toBe(before + 1);
  }

  async infoCount(): Promise<number> {
    return await this.page.locator('input[name^="info."][name$=".label"]').count();
  }

  async removeInfoRow(index: number) {
    const before = await this.infoCount();
    await this.page.getByRole("button", { name: /remove info/i }).nth(index).click().catch(async () => {
      await this.infoRow(index).getByRole("button", { name: /remove|delete|ลบ/i }).first().click();
    });
    await expect.poll(() => this.infoCount(), { timeout: 5_000 }).toBe(before - 1);
  }

  async fillInfo(index: number, data: VendorInfoInput) {
    await this.page.locator(`input[name="info.${index}.label"]`).fill(data.label);
    await this.page.locator(`input[name="info.${index}.value"]`).fill(data.value);
    if (data.dataType) {
      await this.infoRow(index).getByRole("combobox").first().click();
      await this.page.getByRole("option", { name: new RegExp(`^${data.dataType}$`, "i") }).click();
    }
  }

  // ── List → detail ─────────────────────────────────────────────────────
  async openDetailByName(name: string) {
    await this.list.search(name);
    const row = this.page.getByRole("row").filter({ hasText: name }).first();
    await row.waitFor({ state: "visible", timeout: 10_000 });
    const nameButton = row.getByRole("button", { name }).first();
    const link = row.getByRole("link").first();
    if ((await nameButton.count()) > 0) {
      await nameButton.click();
    } else if ((await link.count()) > 0) {
      await link.click();
    } else {
      await row.click();
    }
    await this.page.waitForURL(/\/vendor-management\/vendor\/[^/]+$/, { timeout: 10_000 });
    await this.page.waitForLoadState("networkidle");
  }

  // ── Validation helper ─────────────────────────────────────────────────
  anyError(): Locator {
    return this.page.locator(
      '[aria-invalid="true"], p.text-destructive, p.text-\\[0\\.625rem\\].text-destructive, [role="alert"][data-slot="field-error"]',
    );
  }
}
