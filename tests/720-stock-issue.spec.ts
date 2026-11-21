import { expect, type Page } from "@playwright/test";
import { createAuthTest } from "./fixtures/auth.fixture";
import { StockIssuePage, LIST_PATH } from "./pages/stock-issue.page";
import { recordRows } from "./helpers/list-row";
import { rootGet } from "./helpers/bu-api";
import { BU_CODE } from "./test-users";
import { ensureActiveBu } from "./helpers/bu";

// ─────────────────────────────────────────────────────────────────────────
// Stock Issue = the Store Requisition list/detail at the "Issue" stage.
// Warehouse/Store-Operations Staff == carmensoftware.dev+purchase@gmail.com (can start SR workflows).
// requestor@ sees only SRs it raised itself (store-requisition.service.ts findAll limits a user
// holding only `view` to `requestor_id = caller`), so it is the "no access to other people's SR" role.
// requestor declared LAST so doc default role reads "Purchase".
// Seed (data:reset STD): SR261100001/2 in_progress at Store Approval, SR261100003 at Issue,
// SR261100004 voided, SR261100005 completed, draft-1/draft-2 — expected values are read from the API.
// ─────────────────────────────────────────────────────────────────────────
const requestorTest = createAuthTest("carmensoftware.dev+requestor@gmail.com");
const purchaseTest = createAuthTest("carmensoftware.dev+purchase@gmail.com");

interface Sr { id: string; sr_no: string; doc_status: string; workflow_current_stage: string | null; department_name?: string | null; from_location_name?: string; to_location_name?: string; store_requisition_detail: { product: { name: string } }[] }
async function loadSrs(): Promise<Sr[]> {
  const r = await rootGet("Purchase", `/store-requisitions?perpage=50&bu_code=${BU_CODE}`);
  expect(r.status, "store-requisitions list").toBe(200);
  return r.body.data.find((b: { bu_code: string }) => b.bu_code === BU_CODE).data as Sr[];
}
/** Data precondition (API-checked): the SR the case needs exists. */
async function needSr(pick: (s: Sr) => boolean, what: string): Promise<Sr> {
  const found = (await loadSrs()).find(pick);
  purchaseTest.skip(!found, `TEST BU has no SR ${what} (API-checked)`);
  return found!;
}
const detailPath = (id: string) => `${LIST_PATH}/${id}`;
const goDetail = async (page: Page, sr: Sr) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(detailPath(sr.id));
  await expect(page.getByText(sr.sr_no).first()).toBeVisible({ timeout: 20_000 });
};
const errorState = (page: Page) => page.getByText(/something went wrong/i).first();

purchaseTest.describe("Stock Issue — List", () => {
  purchaseTest.describe.configure({ timeout: 90_000 });
  purchaseTest(
    "TC-SI-010001 Happy Path - View Issue List",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase (Warehouse/Store Staff); active BU = TEST BU; ข้อมูล SR จาก data:reset" },
        { type: "steps", description: "1. ไปที่ /store-operation/store-requisition\n2. เปิด All Documents" },
        { type: "expected", description: "แสดงหัวคอลัมน์ SR No./Status และแถว SR ทุกใบของ BU (เลขเอกสารตรงกับ API)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page }) => {
      const srs = await loadSrs();
      const si = new StockIssuePage(page);
      await page.setViewportSize({ width: 1920, height: 1080 });
      await si.gotoAllDocuments();
      await expect(page).toHaveURL(/store-requisition/);
      for (const h of ["SR No.", "Workflow", "Requester", "Status"]) await expect(page.getByRole("columnheader", { name: h })).toBeVisible();
      for (const s of srs) await expect(page.getByText(s.sr_no).first()).toBeVisible();
    },
  );

  purchaseTest(
    "TC-SI-010003 Edge Case - ไม่มีรายการที่ตรงคำค้น แสดง empty state",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase (Warehouse/Store Staff); active BU = TEST BU; ข้อมูล SR จาก data:reset" },
        { type: "steps", description: "1. เปิด All Documents\n2. ค้นหาคำที่ไม่มี SR ตรง" },
        { type: "expected", description: "ไม่มีแถว SR และแสดงข้อความ 'No data found'" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      const si = new StockIssuePage(page);
      await si.gotoAllDocuments();
      const input = si.searchInput();
      await input.fill("NO_SUCH_SR_E2E_010003");
      await input.press("Enter");
      await expect(page.getByText(/no data found/i).first()).toBeVisible({ timeout: 15_000 });
      await expect(recordRows(page)).toHaveCount(0);
    },
  );

  purchaseTest(
    "TC-SI-010004 Edge Case - Pagination เปลี่ยนหน้าแสดงแถวชุดถัดไป",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase (Warehouse/Store Staff); active BU = TEST BU; ข้อมูล SR จาก data:reset; BU มี SR > 5 ใบ" },
        { type: "steps", description: "1. เปิด All Documents ด้วย perpage=5\n2. กดหน้าถัดไป" },
        { type: "expected", description: "หน้าแรกมี 5 แถว; หน้า 2 (page=2 ใน URL) มีแถวที่เหลือและเป็นคนละชุดกับหน้าแรก" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      const srs = await loadSrs();
      purchaseTest.skip(srs.length <= 5, `TEST BU has only ${srs.length} SR(s); pagination needs > 5 (API-checked)`);
      await page.goto(`${LIST_PATH}?view=all-document&perpage=5`);
      await expect(recordRows(page)).toHaveCount(5, { timeout: 20_000 });
      const first = await recordRows(page).allInnerTexts();
      await page.getByRole("button", { name: /next page/i }).click();
      await expect(page).toHaveURL(/page=2/);
      await expect(recordRows(page)).toHaveCount(srs.length - 5);
      const second = await recordRows(page).allInnerTexts();
      expect(second.some((t) => first.includes(t))).toBe(false);
    },
  );
});

purchaseTest.describe("Stock Issue — View Detail", () => {
  purchaseTest.describe.configure({ timeout: 90_000 });
  purchaseTest(
    "TC-SI-020001 View existing issue with all details",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase (Warehouse/Store Staff); active BU = TEST BU; ข้อมูล SR จาก data:reset; SR261100003 อยู่ที่ขั้น Issue" },
        { type: "steps", description: "1. เปิด All Documents\n2. เปิด SR ที่อยู่ขั้น Issue" },
        { type: "expected", description: "หน้ารายละเอียดแสดงเลข SR, สถานะ In progress, Request From/Deliver To ตรงกับ API และรายการสินค้าครบ" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Smoke" },
      ],
    },
    async ({ page }) => {
      const sr = await needSr((s) => s.workflow_current_stage === "Issue", "at the Issue stage");
      const si = new StockIssuePage(page);
      await si.gotoAllDocuments();
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.getByText(sr.sr_no).first().click();
      await expect(page).toHaveURL(new RegExp(detailPath(sr.id)));
      const main = page.locator("main");
      await expect(main).toContainText(sr.sr_no);
      await expect(main).toContainText(/in progress/i);
      await expect(main).toContainText(sr.from_location_name!);
      await expect(main).toContainText(sr.to_location_name!);
      await page.getByRole("tab", { name: "Items" }).click();
      for (const d of sr.store_requisition_detail) await expect(page.locator("tbody").getByText(d.product.name).first()).toBeVisible();
    },
  );

  purchaseTest(
    "TC-SI-020002 View issue with missing department assignment",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase (Warehouse/Store Staff); active BU = TEST BU; ข้อมูล SR จาก data:reset; มี SR ที่ department_name ว่าง" },
        { type: "steps", description: "1. เปิดรายละเอียดของ SR ที่ไม่มี department" },
        { type: "expected", description: "หน้ารายละเอียดเปิดได้ปกติ (ไม่เกิด error) และแสดงเลข SR กับรายการสินค้า" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      const sr = await needSr((s) => !s.department_name, "without a department");
      await goDetail(page, sr);
      await expect(errorState(page)).toHaveCount(0);
      await expect(page.getByRole("tab", { name: "Items" })).toBeVisible();
    },
  );
});

requestorTest.describe("Stock Issue — View Detail — Permission denial", () => {
  requestorTest.describe.configure({ timeout: 90_000 });
  requestorTest(
    "TC-SI-020003 เปิด URL ของ SR ที่คนอื่นสร้างโดยตรงไม่ได้ (ไม่เห็นข้อมูลเอกสาร)",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Requestor (เห็นเฉพาะ SR ที่ตัวเองสร้าง); TEST BU มี SR ที่สร้างโดย Purchase" },
        { type: "steps", description: "1. เปิด /store-operation/store-requisition/<id ของ SR ที่ Purchase สร้าง> โดยตรง" },
        { type: "expected", description: "หน้าแสดง error state ('Something went wrong') และไม่แสดงเลข SR หรือรายการสินค้า" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Authorization" },
      ],
    },
    async ({ page }) => {
      const sr = (await loadSrs()).find((s) => s.doc_status === "in_progress")!;
      await page.goto(detailPath(sr.id));
      await expect(errorState(page)).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText(sr.sr_no)).toHaveCount(0);
      await expect(page.getByRole("tab", { name: "Items" })).toHaveCount(0);
    },
  );
});

purchaseTest.describe("Stock Issue — Search & Filter", () => {
  purchaseTest.describe.configure({ timeout: 90_000 });
  purchaseTest(
    "TC-SI-030001 Happy Path - Search by SR Reference Number",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase (Warehouse/Store Staff); active BU = TEST BU; ข้อมูล SR จาก data:reset" },
        { type: "steps", description: "1. เปิด All Documents\n2. ค้นหาเลข SR ใบหนึ่งแล้วกด Enter" },
        { type: "expected", description: "เหลือเฉพาะแถวของ SR นั้นใบเดียว" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const [sr] = await loadSrs();
      const si = new StockIssuePage(page);
      await si.gotoAllDocuments();
      const input = si.searchInput();
      await input.fill(sr.sr_no);
      await input.press("Enter");
      await expect(recordRows(page)).toHaveCount(1, { timeout: 15_000 });
      await expect(recordRows(page).first()).toContainText(sr.sr_no);
    },
  );

  purchaseTest(
    "TC-SI-030002 Negative Case - Invalid Search Term",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase (Warehouse/Store Staff); active BU = TEST BU; ข้อมูล SR จาก data:reset" },
        { type: "steps", description: "1. เปิด All Documents\n2. ค้นหา '__INVALID_SR_E2E__'" },
        { type: "expected", description: "ไม่มีแถว SR และแสดง 'No data found'" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const si = new StockIssuePage(page);
      await si.gotoAllDocuments();
      const input = si.searchInput();
      await input.fill("__INVALID_SR_E2E__");
      await input.press("Enter");
      await expect(page.getByText(/no data found/i).first()).toBeVisible({ timeout: 15_000 });
      await expect(recordRows(page)).toHaveCount(0);
    },
  );

  purchaseTest(
    "TC-SI-030003 Edge Case - ล้างคำค้นแล้วรายการกลับมาครบ",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase (Warehouse/Store Staff); active BU = TEST BU; ข้อมูล SR จาก data:reset" },
        { type: "steps", description: "1. ค้นหาเลข SR\n2. ล้างช่องค้นหาแล้วกด Enter" },
        { type: "expected", description: "จำนวนแถวกลับมาเท่ากับจำนวน SR ใน API" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      const srs = await loadSrs();
      const si = new StockIssuePage(page);
      await si.gotoAllDocuments();
      const input = si.searchInput();
      await input.fill(srs[0].sr_no);
      await input.press("Enter");
      await expect(recordRows(page)).toHaveCount(1);
      await input.fill("");
      await input.press("Enter");
      await expect(recordRows(page)).toHaveCount(srs.length);
    },
  );

  purchaseTest(
    "TC-SI-030005 Edge Case - สลับ scope (My pending) แล้วคำค้นถูกล้างและรายการเป็นของ scope ใหม่",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase (Warehouse/Store Staff); active BU = TEST BU; ข้อมูล SR จาก data:reset" },
        { type: "steps", description: "1. เปิด All Documents และค้นหาเลข SR\n2. สลับไป My pending" },
        { type: "expected", description: "URL เป็น view=my-pending โดยไม่มี search และช่องค้นหาว่าง (การสลับ scope ล้างคำค้น)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      const [sr] = await loadSrs();
      const si = new StockIssuePage(page);
      await si.gotoAllDocuments();
      const input = si.searchInput();
      await input.fill(sr.sr_no);
      await input.press("Enter");
      await expect(recordRows(page)).toHaveCount(1);
      await si.tabMyPending().click();
      await expect(page).toHaveURL(/view=my-pending/);
      await expect(page).not.toHaveURL(/search=/);
      await expect(input).toHaveValue("");
    },
  );
});

requestorTest.describe("Stock Issue — Search & Filter — Permission denial", () => {
  requestorTest.describe.configure({ timeout: 90_000 });
  requestorTest(
    "TC-SI-030004 Requestor ค้นหาเลข SR ของคนอื่นไม่พบ (scope เฉพาะเอกสารของตัวเอง)",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Requestor (เห็นเฉพาะ SR ที่ตัวเองสร้าง); TEST BU มี SR ที่สร้างโดย Purchase" },
        { type: "steps", description: "1. เปิด All Documents\n2. ค้นหาเลข SR ที่ Purchase สร้าง" },
        { type: "expected", description: "ไม่มีแถว SR และแสดง 'No data found' (ไม่มีแถวรั่วมาจาก SR ของคนอื่น)" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Authorization" },
      ],
    },
    async ({ page }) => {
      const [sr] = await loadSrs();
      const si = new StockIssuePage(page);
      await si.gotoAllDocuments();
      const input = si.searchInput();
      await input.fill(sr.sr_no);
      await input.press("Enter");
      await expect(page.getByText(/no data found/i).first()).toBeVisible({ timeout: 15_000 });
      await expect(recordRows(page)).toHaveCount(0);
    },
  );
});

purchaseTest.describe("Stock Issue — Issue stage actions", () => {
  purchaseTest.describe.configure({ timeout: 90_000 });
  purchaseTest(
    "TC-SI-040004 Negative - SR ที่ขั้น Issue ไม่มีปุ่ม action เดินเอกสารสำหรับ Purchase",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase (Warehouse/Store Staff); active BU = TEST BU; ข้อมูล SR จาก data:reset; SR261100003 อยู่ที่ขั้น Issue และ Purchase ไม่ใช่ผู้รับผิดชอบขั้นนี้" },
        { type: "steps", description: "1. เปิดรายละเอียด SR ที่อยู่ขั้น Issue" },
        { type: "expected", description: "ไม่มีปุ่ม Issue/Approve/Reject/Submit ในหน้า (มีเพียง Edit/Duplicate/Print/Comment/Activity)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      const sr = await needSr((s) => s.workflow_current_stage === "Issue", "at the Issue stage");
      await goDetail(page, sr);
      for (const name of [/^issue$/i, /^approve$/i, /^reject$/i, /submit/i]) await expect(page.getByRole("button", { name })).toHaveCount(0);
      await expect(page.getByRole("button", { name: /^Print$/ })).toBeVisible();
    },
  );

  purchaseTest(
    "TC-SI-040005 Happy Path - Print SR เปิดหน้า report viewer",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase (Warehouse/Store Staff); active BU = TEST BU; ข้อมูล SR จาก data:reset" },
        { type: "steps", description: "1. เปิดรายละเอียด SR\n2. กดปุ่ม Print" },
        { type: "expected", description: "ยิง GET .../store-requisitions/{id}/print-viewer สำเร็จและเปิด popup ของ report viewer" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const [sr] = await loadSrs();
      await goDetail(page, sr);
      const viewer = page.waitForResponse((r) => r.url().includes(`/store-requisitions/${sr.id}/print-viewer`));
      const popup = page.waitForEvent("popup");
      await page.getByRole("button", { name: /^Print$/ }).click();
      expect((await viewer).status()).toBe(200);
      expect((await popup).url()).toMatch(/Report\/Viewer\//);
    },
  );
});

requestorTest.describe("Stock Issue — View Full SR — Permission denial", () => {
  requestorTest.describe.configure({ timeout: 90_000 });
  requestorTest(
    "TC-SI-040002 Negative - Requestor ไม่เห็น SR ของคนอื่นใน All Documents (scope เฉพาะของตัวเอง)",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Requestor (เห็นเฉพาะ SR ที่ตัวเองสร้าง); TEST BU มี SR ที่สร้างโดย Purchase" },
        { type: "steps", description: "1. เปิด All Documents" },
        { type: "expected", description: "ไม่มีแถว SR (BU มี SR 7 ใบที่คนอื่นสร้าง) และแสดง 'No data found'" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Authorization" },
      ],
    },
    async ({ page }) => {
      const srs = await loadSrs();
      expect(srs.length, "SRs exist in the BU for other users").toBeGreaterThan(0);
      const si = new StockIssuePage(page);
      await si.gotoAllDocuments();
      await expect(page.getByText(/no data found/i).first()).toBeVisible({ timeout: 15_000 });
      await expect(recordRows(page)).toHaveCount(0);
    },
  );
});

purchaseTest.describe("Stock Issue — Print", () => {
  purchaseTest.describe.configure({ timeout: 90_000 });
  purchaseTest(
    "TC-SI-050001 Happy Path: Warehouse Staff prints a stock issue document",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase (Warehouse/Store Staff); active BU = TEST BU; ข้อมูล SR จาก data:reset; SR ที่ขั้น Issue" },
        { type: "steps", description: "1. เปิดรายละเอียด SR ที่ขั้น Issue\n2. กดปุ่ม Print" },
        { type: "expected", description: "ยิง print-viewer สำเร็จ (200) และเปิดหน้า report viewer" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const sr = await needSr((s) => s.workflow_current_stage === "Issue", "at the Issue stage");
      await goDetail(page, sr);
      const viewer = page.waitForResponse((r) => r.url().includes(`/store-requisitions/${sr.id}/print-viewer`));
      const popup = page.waitForEvent("popup");
      await page.getByRole("button", { name: /^Print$/ }).click();
      expect((await viewer).status()).toBe(200);
      expect((await popup).url()).toMatch(/Report\/Viewer\//);
    },
  );

  purchaseTest(
    "TC-SI-050003 Edge Case: รายการที่ยังไม่ได้ issue (Issued = 0) แสดงเป็น 0.00",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase (Warehouse/Store Staff); active BU = TEST BU; ข้อมูล SR จาก data:reset; SR261100003 ยังไม่ issue สินค้าใด" },
        { type: "steps", description: "1. เปิดรายละเอียด SR ที่ขั้น Issue\n2. ตรวจคอลัมน์ Issued ในแท็บ Items" },
        { type: "expected", description: "ทุกแถวสินค้าแสดงจำนวน Issued 0.00 และตารางไม่ error" },
        { type: "priority", description: "Low" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      const sr = await needSr((s) => s.workflow_current_stage === "Issue", "at the Issue stage");
      await goDetail(page, sr);
      await page.getByRole("tab", { name: "Items" }).click();
      await expect(page.getByRole("columnheader", { name: /Issued/i })).toBeVisible();
      for (const d of sr.store_requisition_detail) {
        const row = page.locator("tbody tr").filter({ hasText: d.product.name }).first();
        await expect(row).toBeVisible();
        await expect(row).toContainText("0.00KG"); // issued column (nothing issued yet)
      }
    },
  );

  purchaseTest(
    "TC-SI-050004 Negative: Issue does not exist",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase (Warehouse/Store Staff); active BU = TEST BU; ข้อมูล SR จาก data:reset" },
        { type: "steps", description: "1. เปิด /store-operation/store-requisition/<uuid ที่ไม่มี>" },
        { type: "expected", description: "แสดง error state พร้อมปุ่ม Try again และไม่มีข้อมูลเอกสาร" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      await page.goto(detailPath("00000000-0000-4000-8000-000000000000"));
      await expect(errorState(page)).toBeVisible({ timeout: 20_000 });
      await expect(page.getByRole("button", { name: /try again/i })).toBeVisible();
      await expect(page.getByRole("tab", { name: "Items" })).toHaveCount(0);
    },
  );

  purchaseTest(
    "TC-SI-050005 Edge Case: Issue at Cancel stage (SR ที่ void แล้ว)",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase (Warehouse/Store Staff); active BU = TEST BU; ข้อมูล SR จาก data:reset; มี SR สถานะ voided" },
        { type: "steps", description: "1. เปิดรายละเอียด SR ที่ void" },
        { type: "expected", description: "header แสดงสถานะ Voided และไม่มีปุ่ม Edit" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Edge Case" },
      ],
    },
    async ({ page }) => {
      const sr = await needSr((s) => s.doc_status === "voided", "in voided status");
      await goDetail(page, sr);
      await expect(page.locator("main")).toContainText(/voided/i);
      await expect(page.getByRole("button", { name: /^Edit$/ })).toHaveCount(0);
    },
  );
});

requestorTest.describe("Stock Issue — Print — Permission denial", () => {
  requestorTest.describe.configure({ timeout: 90_000 });
  requestorTest(
    "TC-SI-050002 Negative: Requestor เปิดเอกสารของคนอื่นเพื่อพิมพ์ไม่ได้ (ไม่มีปุ่ม Print)",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Requestor (เห็นเฉพาะ SR ที่ตัวเองสร้าง); TEST BU มี SR ที่สร้างโดย Purchase" },
        { type: "steps", description: "1. เปิดรายละเอียด SR ที่ Purchase สร้างโดยตรง" },
        { type: "expected", description: "แสดง error state และไม่มีปุ่ม Print" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Authorization" },
      ],
    },
    async ({ page }) => {
      const sr = (await loadSrs()).find((s) => s.workflow_current_stage === "Issue")!;
      await page.goto(detailPath(sr.id));
      await expect(errorState(page)).toBeVisible({ timeout: 20_000 });
      await expect(page.getByRole("button", { name: /^Print$/ })).toHaveCount(0);
    },
  );
});

purchaseTest.describe("Stock Issue — Invalid id", () => {
  purchaseTest.describe.configure({ timeout: 90_000 });
  purchaseTest(
    "TC-SI-060004 Negative - Invalid SR ID",
    {
      annotation: [
        { type: "preconditions", description: "เข้าสู่ระบบเป็น Purchase (Warehouse/Store Staff); active BU = TEST BU; ข้อมูล SR จาก data:reset" },
        { type: "steps", description: "1. เปิด /store-operation/store-requisition/999" },
        { type: "expected", description: "แสดง error state และไม่มีข้อมูลเอกสาร" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async ({ page }) => {
      await page.goto(detailPath("999"));
      await expect(errorState(page)).toBeVisible({ timeout: 20_000 });
      await expect(page.getByRole("tab", { name: "Items" })).toHaveCount(0);
    },
  );
});
