import { expect } from "@playwright/test";
import { createAuthTest } from "./fixtures/auth.fixture";
import { PRTemplatePage, LIST_PATH } from "./pages/pr-template.page";
import { BU_CODE } from "./test-users";
import { ensureActiveBu, getBusinessUnits, defaultBu } from "./helpers/bu";
import { BuSwitcherPage } from "./pages/bu-switcher.page";
import { buSend } from "./helpers/bu-api";
import { createTemplate, deleteTemplate, deleteTemplatesByPrefix, getTemplate, listTemplates, seededTemplate } from "./helpers/prt-api";
import { addRow, button, confirmDialog, lastToast, pickLookup, pickSelectIn, typeInto } from "./helpers/movement/ui";
import { uid } from "./helpers/test-data";
import { expectSaved, expectSilentlyBlocked } from "./helpers/settle";

// ─────────────────────────────────────────────────────────────────────────
// Roles (profile permissions checked against /api/user/profile, TEST BU):
//  - Purchase  : purchase_request_template create/update/delete/view
//  - FC        : purchase_request_template.view ONLY  -> the "no permission" role
//                (Requestor/HOD also hold create/update/delete, so they are NOT a denial role)
//  - Budget    : no template permission at all (not even view)
// Every case that mutates works on its own "E2E-PRT ..." template seeded through the API
// (tests/helpers/prt-api.ts) and removes it again; leftovers of a crashed run are swept by prefix.
//
// Cases for features the template module no longer has were deleted (checked in
// ../carmen-frontend/routes/procurement/purchase-request-template/*.tsx, list + form + item table):
//   clone (050xxx), set-as-default (060xxx), bulk operations (110xxx), convert-to-PR (210xxx,
//   the PR side lives in 302 TC-PR-050301..050305), budget code (220xxx), browse catalog (230xxx),
//   department assignment (010003), usage history (020005), read-only status (030004),
//   default template (040002), multi-select delete (040005), "no selected item" (080004).
// ─────────────────────────────────────────────────────────────────────────
const purchaseTest = createAuthTest("carmensoftware.dev+purchase@gmail.com");
const fcTest = createAuthTest("carmensoftware.dev+fc@gmail.com");
const budgetTest = createAuthTest("carmensoftware.dev+budget@gmail.com");

const PFX = "E2E-PRT";
const nm = (tag: string) => `${PFX} ${tag} ${uid}`;
const QTY = (i: number) => `input[name="items.${i}.requested_qty"]`;
const sweep = () => deleteTemplatesByPrefix(PFX);

purchaseTest.describe.configure({ timeout: 90_000 });
fcTest.describe.configure({ timeout: 60_000 });

// ═════════════════════════════════════════════════════════════════════════
// Create
// ═════════════════════════════════════════════════════════════════════════
purchaseTest.describe("PR Template — Create", () => {
  purchaseTest.afterAll(sweep);

  purchaseTest(
    "TC-PRT-010050 active BU = BLAVG",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น carmensoftware.dev+purchase@gmail.com ผ่าน auth fixture" },
        { type: "steps", description: "1. เรียก ensureActiveBu(BLAVG)\n2. อ่าน profile API\n3. หา business unit ที่ is_default\n4. อ่าน label ของ BU switcher" },
        { type: "expected", description: "default business unit มี code === 'BLAVG'; trigger ของ BU switcher แสดง label ของ BU นั้น" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page }) => {
      await ensureActiveBu(page, BU_CODE);
      const units = await getBusinessUnits(page);
      const active = defaultBu(units);
      expect(active?.code).toBe(BU_CODE);
      const switcher = new BuSwitcherPage(page);
      await expect(switcher.trigger()).toContainText(active!.name, { timeout: 15_000 });
    },
  );

  purchaseTest(
    "TC-PRT-010001 Happy Path - Create Template with Valid Data",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้มีสิทธิ์ create template (Purchase); TEST BU มี workflow ประเภท PR และ location/product" },
        {
          type: "steps",
          description:
            "1. ไปที่ /procurement/purchase-request-template\n2. คลิก 'Add Purchase Request Template'\n3. เลือก Workflow และกรอก Name\n4. คลิก 'Add Item' เลือก Location และ Product แล้วกรอก Qty 3\n5. คลิก 'Create'",
        },
        { type: "expected", description: "toast 'created successfully'; URL เปลี่ยนเป็น /procurement/purchase-request-template/<id>; หน้า detail แสดงชื่อ template และ product ที่เลือก; backend มี template นั้นพร้อม 1 รายการ qty 3" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const name = nm("create");
      const tpl = new PRTemplatePage(page);
      await tpl.gotoList();
      await page.getByRole("button", { name: "Add Purchase Request Template" }).click();
      await expect(page).toHaveURL(/purchase-request-template\/new$/);
      await pickSelectIn(page, "Workflow");
      await page.locator("#prt-name").fill(name);
      await button(page, "Add Item").click();
      const row = page.locator("table tbody tr").first();
      await pickLookup(page, row.getByRole("button", { name: "Select Location" }));
      const product = await pickLookup(page, row.getByRole("button", { name: "Select Product" }));
      await typeInto(row.locator(QTY(0)), 3);
      await button(page, /^create$/i).click();

      await expect(page).toHaveURL(/purchase-request-template\/[0-9a-f-]{36}$/, { timeout: 15_000 });
      expect(await lastToast(page)).toMatch(/created successfully/i);
      await expect(page.getByRole("heading", { name: name }).or(page.getByText(name).first())).toBeVisible();
      await expect(page.locator("main")).toContainText(product.split(" ").slice(1).join(" ").slice(0, 8));
      const saved = (await listTemplates(name)).find((t) => t.name === name);
      expect(saved, "template exists in backend").toBeTruthy();
      expect(saved!.purchase_request_template_detail).toHaveLength(1);
      expect(Number(saved!.purchase_request_template_detail[0].requested_qty)).toBe(3);
    },
  );

  purchaseTest(
    "TC-PRT-010004 Negative - Empty Fields for Template",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้มีสิทธิ์สร้าง template" },
        {
          type: "steps",
          description: "1. ไปที่ /procurement/purchase-request-template/new\n2. ไม่กรอกอะไรเลย\n3. คลิก 'Create'",
        },
        { type: "expected", description: "ฟอร์มแสดง 'Workflow is required' และช่อง Name ถูกมาร์ก invalid; ยังอยู่ที่ /new; ไม่มี template ใหม่ถูกสร้างใน backend" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const before = (await listTemplates()).length;
      const tpl = new PRTemplatePage(page);
      await tpl.gotoNew();
      await button(page, /^create$/i).click();
      await expect(page.getByText("Workflow is required")).toBeVisible({ timeout: 5_000 });
      await expect(page.locator("#prt-name")).toHaveAttribute("aria-invalid", "true");
      await expect(page).toHaveURL(/purchase-request-template\/new$/);
      expect((await listTemplates()).length).toBe(before);
    },
  );
});

fcTest.describe("PR Template — Create — Permission denial", () => {
  fcTest.afterAll(sweep);

  fcTest(
    "TC-PRT-010002 Negative - No Permission to Create Template",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น FC — มีเฉพาะ purchase_request_template.view (ไม่มี create)" },
        {
          type: "steps",
          description: "1. ไปที่ /procurement/purchase-request-template\n2. ตรวจปุ่ม 'Add Purchase Request Template'\n3. ลอง POST สร้าง template ผ่าน API ด้วย token ของ FC",
        },
        { type: "expected", description: "ปุ่ม Add ถูกปิดใช้งาน (aria-disabled) และ backend ตอบ 403 — ผู้ใช้ไม่มีสิทธิ์สร้างไม่ควรสร้าง template ได้" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Authorization" },
      ],
    },
    async ({ page }) => {
      const tpl = new PRTemplatePage(page);
      await tpl.gotoList();
      const add = page.getByRole("button", { name: "Add Purchase Request Template" });
      await expect(add).toBeVisible();
      // The bug sites are the two assertions below (FE Add not gated like PR/PO, BE POST not permission-checked).
      fcTest.fail(
        true,
        "suspected bug: view-only FC can create PR templates - FE Add button is enabled (prt list does not pass addDisabled like PR/PO) and gateway POST /purchase-request-templates has no permission check (201, template created)",
      );
      await expect(add).toHaveAttribute("aria-disabled", "true");
      const res = await buSend("FC", "POST", "/purchase-request-templates", { name: nm("fc-create") });
      expect(res.status).toBe(403);
    },
  );
});

// ═════════════════════════════════════════════════════════════════════════
// View
// ═════════════════════════════════════════════════════════════════════════
purchaseTest.describe("PR Template — View Detail", () => {
  purchaseTest.afterAll(sweep);

  purchaseTest(
    "TC-PRT-020001 View template with valid permissions",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้มีสิทธิ์ view; มี template 'STD PR template' ที่ data:reset seed (2 รายการ)" },
        { type: "steps", description: "1. ไปที่ /procurement/purchase-request-template\n2. คลิกแถว 'STD PR template'" },
        { type: "expected", description: "URL เป็น /procurement/purchase-request-template/<id>; หน้าแสดงชื่อ, Workflow 'Purchase Request', Items 2 และชื่อสินค้า/คลังของทุกรายการที่ backend ส่งมา; มีปุ่ม Edit/Delete" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const std = await seededTemplate();
      const tpl = new PRTemplatePage(page);
      await tpl.gotoList();
      await page.getByRole("row").filter({ hasText: std.name }).getByText(std.name).click();
      await expect(page).toHaveURL(new RegExp(`purchase-request-template/${std.id}$`));
      const main = page.locator("main");
      await expect(main).toContainText(std.name);
      await expect(main).toContainText("Purchase Request");
      for (const line of std.purchase_request_template_detail) {
        await expect(main).toContainText(line.product!.name);
        await expect(main).toContainText(line.location!.code);
      }
      await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeEnabled();
      await expect(page.getByRole("button", { name: "Delete", exact: true })).toBeEnabled();
    },
  );

  purchaseTest(
    "TC-PRT-020003 View non-existent template",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้มีสิทธิ์ view" },
        { type: "steps", description: "1. ไปที่ /procurement/purchase-request-template/00000000-0000-4000-8000-000000000000" },
        { type: "expected", description: "แสดงหน้า error ('Something went wrong' + ปุ่ม Try again) แทนฟอร์ม; ไม่มีปุ่ม Edit/Delete" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const tpl = new PRTemplatePage(page);
      await tpl.gotoDetail("00000000-0000-4000-8000-000000000000");
      await expect(page.getByText("Something went wrong").first()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Edit", exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Delete", exact: true })).toHaveCount(0);
    },
  );

  purchaseTest(
    "TC-PRT-020004 View template with no items",
    {
      annotation: [
        { type: "preconditions", description: "มี template ที่ไม่มีรายการ (seed ผ่าน API)" },
        { type: "steps", description: "1. เปิดหน้า detail ของ template ที่ไม่มีรายการ" },
        { type: "expected", description: "ส่วน Items แสดงจำนวน 0 และ empty state 'No Items Yet / Add items to this template.' ไม่มีแถวสินค้า" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      const t = await createTemplate(nm("noitems"), { lines: 0 });
      const tpl = new PRTemplatePage(page);
      await tpl.gotoDetail(t.id);
      await expect(page.getByText("No Items Yet")).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText("Add items to this template.")).toBeVisible();
      await expect(page.locator("table tbody tr").filter({ hasText: /\d{5,}/ })).toHaveCount(0);
    },
  );
});

// ═════════════════════════════════════════════════════════════════════════
// Edit
// ═════════════════════════════════════════════════════════════════════════
purchaseTest.describe("PR Template — Edit", () => {
  purchaseTest.afterAll(sweep);

  purchaseTest(
    "TC-PRT-030001 Edit Template - Happy Path",
    {
      annotation: [
        { type: "preconditions", description: "มี template ของ test (2 รายการ qty 5)" },
        { type: "steps", description: "1. เปิด template → คลิก Edit\n2. กรอก Description ใหม่\n3. เปลี่ยน Qty ของแถวแรกเป็น 8\n4. คลิก Save" },
        { type: "expected", description: "toast 'updated successfully'; กลับเป็นโหมดดูและแสดง Description ใหม่; backend เก็บ description ใหม่และ qty 8" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const t = await createTemplate(nm("edit"), { qty: 5 });
      const tpl = new PRTemplatePage(page);
      await tpl.gotoDetail(t.id);
      await button(page, "Edit").click();
      const desc = `edited ${uid}`;
      await page.locator("#prt-description").fill(desc);
      await typeInto(page.locator(QTY(0)), 8);
      await button(page, "Save").click();
      expect(await lastToast(page)).toMatch(/updated successfully/i);
      await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
      await expect(page.locator("main")).toContainText(desc);
      const saved = (await getTemplate(t.id)).data!;
      expect(saved.description).toBe(desc);
      expect(saved.purchase_request_template_detail.map((d) => Number(d.requested_qty)).sort()).toEqual([5, 8]);
    },
  );

  purchaseTest(
    "TC-PRT-030002 Edit Template - Invalid Input",
    {
      annotation: [
        { type: "preconditions", description: "มี template ของ test (qty 5)" },
        { type: "steps", description: "1. เปิด template → คลิก Edit\n2. พิมพ์ '-5' ในช่อง Qty ของแถวแรก\n3. คลิก Save" },
        { type: "expected", description: "ช่อง Qty ไม่รับเครื่องหมายลบ (ค่าที่ค้างอยู่ไม่มี '-'); ค่าที่บันทึกใน backend ไม่ติดลบ" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const t = await createTemplate(nm("neg"), { qty: 5 });
      const tpl = new PRTemplatePage(page);
      await tpl.gotoDetail(t.id);
      await button(page, "Edit").click();
      const q = page.locator(QTY(0));
      await typeInto(q, "-5");
      expect(await q.inputValue()).not.toContain("-");
      await button(page, "Save").click();
      expect(await lastToast(page)).toMatch(/updated successfully/i);
      const saved = (await getTemplate(t.id)).data!;
      for (const d of saved.purchase_request_template_detail) expect(Number(d.requested_qty)).toBeGreaterThanOrEqual(0);
    },
  );

  purchaseTest(
    "TC-PRT-030005 Edit Template - No Existing Template",
    {
      annotation: [
        { type: "preconditions", description: "ผู้ใช้มีสิทธิ์แก้ไข; template ไม่มีอยู่" },
        { type: "steps", description: "1. ไปที่ /procurement/purchase-request-template/<id ที่ไม่มีอยู่>\n2. มองหาปุ่ม Edit และช่องกรอก" },
        { type: "expected", description: "แสดงหน้า error; ไม่มีปุ่ม Edit/Save และไม่มีช่อง Name/Qty ให้กรอก" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const tpl = new PRTemplatePage(page);
      await tpl.gotoDetail("00000000-0000-4000-8000-000000000001");
      await expect(page.getByText("Something went wrong").first()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole("button", { name: /^(edit|save)$/i })).toHaveCount(0);
      await expect(page.locator("#prt-name")).toHaveCount(0);
    },
  );
});

fcTest.describe("PR Template — Edit — Permission denial", () => {
  fcTest(
    "TC-PRT-030003 Edit Template - No Permission",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น FC (view อย่างเดียว); มี template 'STD PR template'" },
        { type: "steps", description: "1. เปิดหน้า detail ของ template\n2. ดูปุ่ม Edit" },
        { type: "expected", description: "ปุ่ม Edit ถูกปิดใช้งาน (aria-disabled) ผู้ใช้เข้าโหมดแก้ไขไม่ได้ ไม่มีช่อง Name ให้กรอก" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Authorization" },
      ],
    },
    async ({ page }) => {
      const std = await seededTemplate();
      const tpl = new PRTemplatePage(page);
      await tpl.gotoDetail(std.id);
      const edit = page.getByRole("button", { name: "Edit", exact: true });
      await expect(edit).toBeVisible();
      await expect(edit).toHaveAttribute("aria-disabled", "true");
      await edit.click({ force: true });
      await expect(page.locator("#prt-name")).toHaveCount(0);
    },
  );
});

// ═════════════════════════════════════════════════════════════════════════
// Delete
// ═════════════════════════════════════════════════════════════════════════
purchaseTest.describe("PR Template — Delete", () => {
  purchaseTest.afterAll(sweep);

  purchaseTest(
    "TC-PRT-040001 Delete valid template - Happy Path",
    {
      annotation: [
        { type: "preconditions", description: "มี template ของ test" },
        { type: "steps", description: "1. ไปที่ list ค้นหาชื่อ template\n2. เปิดเมนู Row actions ของแถว → Delete\n3. กด Delete ใน dialog ยืนยัน" },
        { type: "expected", description: "toast 'deleted successfully'; แถวหายจาก list; backend ตอบ 404 ให้ id นั้น" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const name = nm("delete");
      const t = await createTemplate(name);
      const tpl = new PRTemplatePage(page);
      await tpl.gotoList();
      const row = page.getByRole("row").filter({ hasText: name });
      await expect(row).toHaveCount(1);
      await row.getByRole("button", { name: "Row actions" }).click();
      await page.getByRole("menuitem", { name: "Delete" }).click();
      await expect(page.getByRole("alertdialog")).toContainText(name);
      await confirmDialog(page, /^delete$/i);
      expect(await lastToast(page)).toMatch(/deleted successfully/i);
      await expect(row).toHaveCount(0);
      expect((await getTemplate(t.id)).status).toBe(404);
    },
  );

  purchaseTest(
    "TC-PRT-040004 Attempt to delete template that does not exist - Negative Case",
    {
      annotation: [
        { type: "preconditions", description: "template ถูกลบโดยคนอื่น (ผ่าน API) หลังที่ list ถูกโหลดแล้ว" },
        { type: "steps", description: "1. เปิด list (แถว template ยังแสดงอยู่)\n2. ลบ template นั้นผ่าน API\n3. ที่ list กด Row actions → Delete → ยืนยัน" },
        { type: "expected", description: "ไม่มี toast สำเร็จ แต่มี toast ข้อผิดพลาด; dialog ยังเปิดให้กดยกเลิก; หลัง refresh list ไม่มีแถวนั้น" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const name = nm("gone");
      const t = await createTemplate(name);
      const tpl = new PRTemplatePage(page);
      await tpl.gotoList();
      const row = page.getByRole("row").filter({ hasText: name });
      await expect(row).toHaveCount(1);
      expect(await deleteTemplate(t.id)).toBeLessThan(300);
      await row.getByRole("button", { name: "Row actions" }).click();
      await page.getByRole("menuitem", { name: "Delete" }).click();
      await confirmDialog(page, /^delete$/i);
      const toast = await lastToast(page);
      expect(toast).not.toMatch(/deleted successfully/i);
      expect(toast.length).toBeGreaterThan(0);
      // the confirm dialog stays open after a failed delete (user cancels or retries)
      await expect(page.getByRole("alertdialog")).toBeVisible();
      await page.getByRole("alertdialog").getByRole("button", { name: /cancel/i }).click();
      await page.reload();
      await expect(page.getByRole("row").filter({ hasText: name })).toHaveCount(0);
    },
  );
});

fcTest.describe("PR Template — Delete — Permission denial", () => {
  fcTest.afterAll(sweep);

  fcTest(
    "TC-PRT-040003 Delete template with no permissions - Negative Case",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น FC (view อย่างเดียว); มี template ของ test ที่สร้างโดย Purchase" },
        { type: "steps", description: "1. เปิดหน้า detail ของ template\n2. ดูปุ่ม Delete และคลิกมัน" },
        { type: "expected", description: "ปุ่ม Delete ถูกปิดใช้งาน (aria-disabled) และคลิกแล้วไม่มี dialog ยืนยันการลบ; template ยังอยู่ใน backend" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Authorization" },
      ],
    },
    async ({ page }) => {
      const t = await createTemplate(nm("fcdelete"));
      const tpl = new PRTemplatePage(page);
      await tpl.gotoDetail(t.id);
      const del = page.getByRole("button", { name: "Delete", exact: true });
      await expect(del).toHaveAttribute("aria-disabled", "true");
      await del.click({ force: true });
      // bug site: aria-disabled is only styling - the click still opens the confirm dialog (prt-form onDelete has no permission guard)
      fcTest.fail(true, "suspected bug: view-only FC can still open the Delete confirm dialog on a template (Delete button is aria-disabled but its click is not guarded in prt-form.tsx); gateway DELETE has no permission check either");
      await expect(page.getByRole("alertdialog")).toHaveCount(0);
      expect((await getTemplate(t.id)).status).toBe(200);
    },
  );
});

// ═════════════════════════════════════════════════════════════════════════
// Items: add / edit / delete
// ═════════════════════════════════════════════════════════════════════════
purchaseTest.describe("PR Template — Add Item", () => {
  purchaseTest.afterAll(sweep);

  purchaseTest(
    "TC-PRT-070001 Add valid item to template",
    {
      annotation: [
        { type: "preconditions", description: "มี template ของ test (2 รายการ); มีสินค้าอื่นให้เลือก" },
        { type: "steps", description: "1. เปิด template → Edit\n2. คลิก 'Add Item'\n3. เลือก Location และ Product (ตัวที่ยังไม่อยู่ใน template)\n4. กรอก Qty 7\n5. Save" },
        { type: "expected", description: "toast 'updated successfully'; หน้า detail แสดง Items 3; backend มีรายการที่ qty 7 รวมเป็น 3 บรรทัด" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const t = await createTemplate(nm("additem"));
      const tpl = new PRTemplatePage(page);
      await tpl.gotoDetail(t.id);
      await button(page, "Edit").click();
      // the new row is prepended and inherits the previous first row's location
      const row = await addRow(page);
      await pickLookup(page, row.getByRole("button", { name: "Select Product" }), "", /^(?!.*1111000[12])/s);
      await typeInto(row.locator(QTY(0)), 7);
      await button(page, "Save").click();
      expect(await lastToast(page)).toMatch(/updated successfully/i);
      const saved = (await getTemplate(t.id)).data!;
      expect(saved.purchase_request_template_detail).toHaveLength(3);
      expect(saved.purchase_request_template_detail.map((d) => Number(d.requested_qty))).toContain(7);
    },
  );

  purchaseTest(
    "TC-PRT-070002 Add item with missing product",
    {
      annotation: [
        { type: "preconditions", description: "มี template ของ test (2 รายการ)" },
        { type: "steps", description: "1. เปิด template → Edit\n2. คลิก 'Add Item' แต่ไม่เลือก Location/Product\n3. Save" },
        { type: "expected", description: "แถวใหม่ยังไม่มี Product (ปุ่ม 'Select Product' ยังอยู่) ไม่บันทึก ยังอยู่ในโหมดแก้ไข ไม่มี toast สำเร็จ; backend ยังมี 2 บรรทัด" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const t = await createTemplate(nm("noproduct"));
      const tpl = new PRTemplatePage(page);
      await tpl.gotoDetail(t.id);
      await button(page, "Edit").click();
      await addRow(page);
      await expectSilentlyBlocked(page, /purchase-request-template/, () => button(page, "Save").click(), "FE shows no validation message for a row without product / an empty item list (no aria-invalid on the Select Product button)");
      await expect(page.getByRole("button", { name: "Select Product" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Save", exact: true })).toBeVisible();
      await expect(page.locator("[data-sonner-toast]").filter({ hasText: /updated successfully/i })).toHaveCount(0);
      expect((await getTemplate(t.id)).data!.purchase_request_template_detail).toHaveLength(2);
    },
  );

  purchaseTest(
    "TC-PRT-070004 Add item with zero quantity",
    {
      annotation: [
        { type: "preconditions", description: "มี template ของ test (2 รายการ)" },
        { type: "steps", description: "1. เปิด template → Edit → Add Item\n2. เลือก Location, Product และคง Qty = 0 (ค่าเริ่มต้น)\n3. Save" },
        { type: "expected", description: "บันทึกได้ (แม่แบบเก็บ 'ชุดสินค้า' จำนวนจริงกรอกตอนทำ PR — FE 447079d1 ตั้ง qty เริ่มต้น 0 โดยตั้งใจ); backend มีบรรทัด qty 0" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      const t = await createTemplate(nm("zeroqty"));
      const tpl = new PRTemplatePage(page);
      await tpl.gotoDetail(t.id);
      await button(page, "Edit").click();
      // the new row is prepended and inherits the previous first row's location
      const row = await addRow(page);
      await pickLookup(page, row.getByRole("button", { name: "Select Product" }), "", /^(?!.*1111000[12])/s);
      await expect(row.locator(QTY(0))).toHaveValue("0");
      await button(page, "Save").click();
      expect(await lastToast(page)).toMatch(/updated successfully/i);
      const qtys = (await getTemplate(t.id)).data!.purchase_request_template_detail.map((d) => Number(d.requested_qty));
      expect(qtys).toHaveLength(3);
      expect(qtys).toContain(0);
    },
  );

  purchaseTest(
    "TC-PRT-070005 Add item with very large quantity",
    {
      annotation: [
        { type: "preconditions", description: "มี template ของ test (2 รายการ)" },
        { type: "steps", description: "1. เปิด template → Edit\n2. ใส่ Qty = 999999999999999 ที่แถวแรก\n3. Save" },
        { type: "expected", description: "ระบบแสดงข้อความว่า quantity มากเกินไปและไม่บันทึก (ค่าใน backend ยังเป็น 5)" },
        { type: "priority", description: "Low" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      const t = await createTemplate(nm("bigqty"), { qty: 5 });
      const tpl = new PRTemplatePage(page);
      await tpl.gotoDetail(t.id);
      await button(page, "Edit").click();
      await typeInto(page.locator(QTY(0)), "999999999999999");
      // the form accepts the value: the write goes out, succeeds and the app says so (the pinned bug is that it should not)
      await expectSaved(page, /purchase-request-template/, () => button(page, "Save").click(), page.locator("[data-sonner-toast]").filter({ hasText: /updated successfully/i }));
      // bug site: the form and backend accept 999,999,999,999,999 (toast 'updated successfully', value persisted)
      purchaseTest.fail(true, "suspected bug: no upper bound on requested_qty - 999999999999999 is accepted and saved (FE schema only has min(0), BE stores it)");
      const qtys = (await getTemplate(t.id)).data!.purchase_request_template_detail.map((d) => Number(d.requested_qty));
      expect(qtys).not.toContain(999999999999999);
    },
  );

  purchaseTest(
    "TC-PRT-080001 Edit existing template item successfully",
    {
      annotation: [
        { type: "preconditions", description: "มี template ของ test (2 รายการ qty 5)" },
        { type: "steps", description: "1. เปิด template → Edit\n2. เปลี่ยน Qty แถวที่สองเป็น 12\n3. Save" },
        { type: "expected", description: "toast 'updated successfully'; โหมดดูแสดง 12.00 ของแถวนั้น; backend เก็บ [5, 12]" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const t = await createTemplate(nm("edititem"), { qty: 5 });
      const tpl = new PRTemplatePage(page);
      await tpl.gotoDetail(t.id);
      await button(page, "Edit").click();
      await typeInto(page.locator(QTY(1)), 12);
      await button(page, "Save").click();
      expect(await lastToast(page)).toMatch(/updated successfully/i);
      await expect(page.locator("main")).toContainText("12.00");
      expect((await getTemplate(t.id)).data!.purchase_request_template_detail.map((d) => Number(d.requested_qty)).sort((a, b) => a - b)).toEqual([5, 12]);
    },
  );

  purchaseTest(
    "TC-PRT-080003 Edit template item with invalid quantity",
    {
      annotation: [
        { type: "preconditions", description: "มี template ของ test (qty 5)" },
        { type: "steps", description: "1. เปิด template → Edit\n2. พิมพ์ 'abc' ในช่อง Qty แถวแรก\n3. Save" },
        { type: "expected", description: "ช่อง Qty ไม่รับตัวอักษร (ค่าในช่องไม่มีตัวอักษร); ค่าที่บันทึกยังเป็นตัวเลข ไม่เป็น NaN" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const t = await createTemplate(nm("badqty"), { qty: 5 });
      const tpl = new PRTemplatePage(page);
      await tpl.gotoDetail(t.id);
      await button(page, "Edit").click();
      const q = page.locator(QTY(0));
      await typeInto(q, "abc");
      expect(await q.inputValue()).not.toMatch(/[a-z]/i);
      await button(page, "Save").click();
      expect(await lastToast(page)).toMatch(/updated successfully/i);
      for (const d of (await getTemplate(t.id)).data!.purchase_request_template_detail) expect(Number.isFinite(Number(d.requested_qty))).toBe(true);
    },
  );

  purchaseTest(
    "TC-PRT-080005 Edit template item with minimal changes",
    {
      annotation: [
        { type: "preconditions", description: "มี template ของ test (2 รายการ qty 5)" },
        { type: "steps", description: "1. เปิด template → Edit\n2. เปลี่ยน Qty แถวแรกจาก 5 เป็น 6 (เปลี่ยนน้อยที่สุด)\n3. Save" },
        { type: "expected", description: "บันทึกสำเร็จ; backend เก็บ [5, 6] — แถวที่ไม่ได้แก้ยังเป็น 5" },
        { type: "priority", description: "Low" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      const t = await createTemplate(nm("minchg"), { qty: 5 });
      const tpl = new PRTemplatePage(page);
      await tpl.gotoDetail(t.id);
      await button(page, "Edit").click();
      await typeInto(page.locator(QTY(0)), 6);
      await button(page, "Save").click();
      expect(await lastToast(page)).toMatch(/updated successfully/i);
      expect((await getTemplate(t.id)).data!.purchase_request_template_detail.map((d) => Number(d.requested_qty)).sort((a, b) => a - b)).toEqual([5, 6]);
    },
  );

  purchaseTest(
    "TC-PRT-090001 Delete template item - happy path",
    {
      annotation: [
        { type: "preconditions", description: "มี template ของ test (2 รายการ)" },
        { type: "steps", description: "1. เปิด template → Edit\n2. คลิก Remove ที่แถวแรก\n3. ยืนยันใน dialog 'Remove Item'\n4. Save" },
        { type: "expected", description: "แถวหายจากตาราง; หลัง Save backend เหลือ 1 บรรทัด" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const t = await createTemplate(nm("rmitem"));
      const tpl = new PRTemplatePage(page);
      await tpl.gotoDetail(t.id);
      await button(page, "Edit").click();
      const rows = page.locator("table tbody tr");
      await expect(rows).toHaveCount(2);
      await rows.first().getByRole("button", { name: "Remove" }).click();
      await confirmDialog(page, /remove|delete|confirm/i);
      await expect(rows).toHaveCount(1);
      await button(page, "Save").click();
      expect(await lastToast(page)).toMatch(/updated successfully/i);
      expect((await getTemplate(t.id)).data!.purchase_request_template_detail).toHaveLength(1);
    },
  );

  purchaseTest(
    "TC-PRT-090003 Delete template item - cannot save with all items removed",
    {
      annotation: [
        { type: "preconditions", description: "มี template ของ test (2 รายการ)" },
        { type: "steps", description: "1. เปิด template → Edit\n2. ลบทั้งสองแถว (Remove + ยืนยัน)\n3. Save" },
        { type: "expected", description: "ตารางแสดง 'No Items Yet'; Save ไม่ผ่าน (ไม่มี toast สำเร็จ ยังอยู่ในโหมดแก้ไข); backend ยังมี 2 บรรทัด" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const t = await createTemplate(nm("rmall"));
      const tpl = new PRTemplatePage(page);
      await tpl.gotoDetail(t.id);
      await button(page, "Edit").click();
      for (let i = 0; i < 2; i++) {
        await page.locator("table tbody tr").first().getByRole("button", { name: "Remove" }).click();
        await confirmDialog(page, /remove|delete|confirm/i);
      }
      await expect(page.getByText("No Items Yet")).toBeVisible();
      await expectSilentlyBlocked(page, /purchase-request-template/, () => button(page, "Save").click(), "FE shows no validation message for a row without product / an empty item list (no aria-invalid on the Select Product button)");
      await expect(page.getByRole("button", { name: "Save", exact: true })).toBeVisible();
      await expect(page.locator("[data-sonner-toast]").filter({ hasText: /updated successfully/i })).toHaveCount(0);
      expect((await getTemplate(t.id)).data!.purchase_request_template_detail).toHaveLength(2);
    },
  );
});

fcTest.describe("PR Template — Items — Permission denial", () => {
  fcTest(
    "TC-PRT-070003 Add item with no permission",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น FC (view อย่างเดียว); มี template 'STD PR template'" },
        { type: "steps", description: "1. เปิดหน้า detail ของ template\n2. มองหาปุ่ม 'Add Item'" },
        { type: "expected", description: "ไม่มีปุ่ม Add Item ในโหมดดู และปุ่ม Edit ถูกปิดใช้งาน" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Authorization" },
      ],
    },
    async ({ page }) => {
      const std = await seededTemplate();
      const tpl = new PRTemplatePage(page);
      await tpl.gotoDetail(std.id);
      await expect(page.getByRole("button", { name: "Edit", exact: true })).toHaveAttribute("aria-disabled", "true");
      await expect(page.getByRole("button", { name: "Add Item" })).toHaveCount(0);
    },
  );

  fcTest(
    "TC-PRT-080002 Attempt to edit template without permission",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น FC (view อย่างเดียว); template มี 2 รายการ" },
        { type: "steps", description: "1. เปิดหน้า detail ของ template\n2. มองหาช่อง Qty ของรายการ" },
        { type: "expected", description: "รายการแสดงเป็นข้อความอ่านอย่างเดียว ไม่มีช่อง Qty (input) ให้แก้" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Authorization" },
      ],
    },
    async ({ page }) => {
      const std = await seededTemplate();
      const tpl = new PRTemplatePage(page);
      await tpl.gotoDetail(std.id);
      await expect(page.locator("main")).toContainText(std.purchase_request_template_detail[0].product!.name);
      await expect(page.locator(QTY(0))).toHaveCount(0);
      await expect(page.locator(QTY(1))).toHaveCount(0);
    },
  );

  fcTest(
    "TC-PRT-090002 Delete template item - no permission",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น FC (view อย่างเดียว); template มี 2 รายการ" },
        { type: "steps", description: "1. เปิดหน้า detail ของ template\n2. มองหาปุ่ม Remove ของรายการ" },
        { type: "expected", description: "ไม่มีปุ่ม Remove; ไม่สามารถเข้าโหมดแก้ไขได้ (Edit ปิดใช้งาน)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Authorization" },
      ],
    },
    async ({ page }) => {
      const std = await seededTemplate();
      const tpl = new PRTemplatePage(page);
      await tpl.gotoDetail(std.id);
      await expect(page.getByRole("button", { name: "Edit", exact: true })).toHaveAttribute("aria-disabled", "true");
      await expect(page.getByRole("button", { name: "Remove" })).toHaveCount(0);
    },
  );
});

// ═════════════════════════════════════════════════════════════════════════
// Search & filter (list)
// ═════════════════════════════════════════════════════════════════════════
purchaseTest.describe("PR Template — Search & Filter", () => {
  purchaseTest.afterAll(sweep);

  const search = async (page: import("@playwright/test").Page, text: string) => {
    const box = page.getByPlaceholder("Search...");
    await box.fill(text);
    await box.press("Enter");
  };

  purchaseTest(
    "TC-PRT-100001 Search for template by name",
    {
      annotation: [
        { type: "preconditions", description: "มี template ของ test 1 รายการ และ 'STD PR template'" },
        { type: "steps", description: "1. ไปที่ /procurement/purchase-request-template\n2. พิมพ์ชื่อ template ของ test ในช่อง Search แล้วกด Enter" },
        { type: "expected", description: "list แสดงเฉพาะ template ที่ชื่อตรง; 'STD PR template' ไม่แสดง" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const name = nm("search");
      await createTemplate(name);
      const tpl = new PRTemplatePage(page);
      await tpl.gotoList();
      await search(page, name);
      await expect(page.getByRole("row").filter({ hasText: name })).toHaveCount(1);
      await expect(page.getByRole("row").filter({ hasText: "STD PR template" })).toHaveCount(0);
    },
  );

  purchaseTest(
    "TC-PRT-100002 Filter templates by status",
    {
      annotation: [
        { type: "preconditions", description: "มี template สถานะ Active อย่างน้อยหนึ่งรายการ" },
        { type: "steps", description: "1. ไปที่ list\n2. คลิก Filter → Status → เลือก Active\n3. ดู list" },
        { type: "expected", description: "มีตัวกรอง Status แสดงบนแถบ; ทุกแถวที่เหลือมีสถานะ Active และมีอย่างน้อย 1 แถว" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async ({ page }) => {
      const tpl = new PRTemplatePage(page);
      await tpl.gotoList();
      await expect(page.getByRole("row").filter({ hasText: "STD PR template" })).toHaveCount(1);
      const filtered = page.waitForRequest((r) => /purchase-request-templates\?.*filter/.test(decodeURIComponent(r.url())));
      await page.getByRole("button", { name: "Filter" }).click();
      await page.locator("[data-slot=popover-content]:visible").getByRole("button", { name: "Status" }).click();
      await page.getByText("Active", { exact: true }).last().click();
      expect(decodeURIComponent((await filtered).url())).toMatch(/is_active/);
      await page.keyboard.press("Escape");
      const rows = page.getByRole("row").filter({ hasText: /Active|Inactive/ });
      await expect(rows.first()).toBeVisible();
      expect(await rows.count()).toBeGreaterThan(0);
      await expect(page.getByRole("row").filter({ hasText: "Inactive" })).toHaveCount(0);
    },
  );

  purchaseTest(
    "TC-PRT-100003 Search with invalid input",
    {
      annotation: [
        { type: "preconditions", description: "มี template อย่างน้อยหนึ่งรายการ" },
        { type: "steps", description: "1. ไปที่ list\n2. พิมพ์ข้อความที่ไม่ตรงกับ template ใดแล้วกด Enter" },
        { type: "expected", description: "ตารางแสดง empty state 'No data found' ไม่มีแถวข้อมูล" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const tpl = new PRTemplatePage(page);
      await tpl.gotoList();
      await search(page, `zz-no-such-template-${uid}`);
      await expect(page.getByText("No data found")).toBeVisible({ timeout: 10_000 });
      await expect(page.getByRole("row").filter({ hasText: "STD PR template" })).toHaveCount(0);
    },
  );

  purchaseTest(
    "TC-PRT-100005 Edge case - search with empty input",
    {
      annotation: [
        { type: "preconditions", description: "มี template อย่างน้อยหนึ่งรายการ; ผู้ใช้เพิ่งค้นหาจน list ว่าง" },
        { type: "steps", description: "1. ค้นหาข้อความที่ไม่มีผลลัพธ์\n2. ล้างช่อง Search แล้วกด Enter" },
        { type: "expected", description: "list กลับมาแสดง template ทั้งหมด (มี 'STD PR template')" },
        { type: "priority", description: "Low" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      const tpl = new PRTemplatePage(page);
      await tpl.gotoList();
      await search(page, `zz-no-such-template-${uid}`);
      await expect(page.getByText("No data found")).toBeVisible({ timeout: 10_000 });
      await search(page, "");
      await expect(page.getByRole("row").filter({ hasText: "STD PR template" })).toHaveCount(1, { timeout: 10_000 });
      await expect(page.getByText("No data found")).toHaveCount(0);
    },
  );
});

budgetTest.describe("PR Template — Search & Filter — Permission denial", () => {
  budgetTest(
    "TC-PRT-100004 Filter with no permission",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็น Budget — ไม่มี permission ของ PR template เลย (แม้แต่ view)" },
        { type: "steps", description: "1. ไปที่ /procurement/purchase-request-template" },
        { type: "expected", description: "แสดงหน้า 'Permission Denied' แทน list; ไม่มีช่อง Search/Filter หรือปุ่ม Add" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Authorization" },
      ],
    },
    async ({ page }) => {
      await page.goto(LIST_PATH);
      await expect(page.getByRole("heading", { name: "Permission Denied" })).toBeVisible({ timeout: 15_000 });
      await expect(page.getByPlaceholder("Search...")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Add Purchase Request Template" })).toHaveCount(0);
    },
  );
});
