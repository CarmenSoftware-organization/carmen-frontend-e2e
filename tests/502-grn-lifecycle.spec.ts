import type { Page } from "@playwright/test";
import { test, gotoBu, expect, observed } from "./fixtures/doc-flow.fixture";
import { BU_CODE, TEST_BUS } from "./test-users";
import { buConfigSend, buSend } from "./helpers/bu-api";
import { calcMethod, stockAt } from "./helpers/costing";
import { dfGet, txOfDoc } from "./helpers/doc-flow/api";
import { commitGrn, createGrn } from "./helpers/doc-flow/docs";
import { DF as P, activePeriodDate, firstVendor, itemRow, srLocations, stamp } from "./helpers/doc-flow/data";
import { addRow, button, confirmDialog, inputValues, numRe, pickLookup, toasts, typeInto } from "./helpers/movement/ui";

/**
 * GRN doc flow (manual GRN) — doc-flow suite on the TEST BUs, gmail accounts.
 * Lifecycle (700001-700004) runs on TEST BU (AVG) BU-GR2VYNKQ only; the stock-posting case runs once per BU
 * (700005 average / 710005 fifo / 720005 average_per_location), each against the BU's own cost method.
 * Role = Purchase: probe D (see 603-cn-lifecycle.spec.ts header) found the gmail `Purchase` role holds GRN
 * create/commit on all three TEST BUs, so no role is granted anywhere (scripts/data-reset/access.ts untouched).
 * Products E2E-DF-1..4, vendor and location read at run time (first inventory location of the doc-flow pair).
 * draft -> view -> edit (invoice no. + qty/price + remove line + add line) -> delete -> new + Create (saved).
 * Needs the doc-flow step of `bun run data:reset` on every BU (all three were reset).
 *
 * When stock posts (the thing the three posting cases pin):
 *  - average:              Create (saved) posts stock           (TC-GRN-700005)
 *  - fifo:                 Create posts NOTHING, Commit posts   (TC-GRN-710005)
 *  - average_per_location: see "Finding" below                  (TC-GRN-720005)
 * FINDING (average_per_location, live 2026-11-24, three runs without reset): posts at **saved**, like average
 * (on-hand 0 -> 1, one inventory transaction at saved). FIFO posts nothing at saved and +1 at commit
 * (transactions 0 -> 1). The 720005 branch asserts that and fails loudly if the backend changes.
 *
 * On FIFO the backend refuses a receipt dated before the latest receipt of the same product/location in the
 * period (422), so the posting cases are dated today (activePeriodDate returns today while it is in the period).
 * Stock is asserted as a DELTA around the case (other docs also move E2E-DF-4); nothing is compensated on a TEST BU.
 *
 * TC-GRN-140003 in 501-grn ("no stock movements before commit") says the opposite for BLAVG; 501 runs on its
 * own BU and the two have never been reconciled — a decision for the backend team before either is changed.
 * Origin: `_movement_play/eop_bf/e2e/fe/04-grn.spec.ts` (GRN.1–GRN.5).
 */
test.setTimeout(300_000);

interface GrnLine {
  product: string;
  qty: number;
  price: number;
}

async function grnById(id: string, bu: string) {
  const { status, body } = await dfGet(`/good-received-notes/${id}`, "Admin", bu);
  if (status !== 200 || !body?.data) return { status: "deleted", no: "", invoice: "", lines: [] as GrnLine[] };
  const d = body.data;
  return {
    status: d.doc_status as string,
    no: d.grn_no as string,
    invoice: d.invoice_no as string,
    lines: (d.good_received_note_detail ?? []).flatMap((x: any) =>
      (x.items ?? []).map((i: any) => ({ product: x.product?.code, qty: Number(i.received_qty), price: Number(i.received_price) })),
    ) as GrnLine[],
  };
}
const fmt = (ls: GrnLine[]) => ls.map((l) => `${l.product}×${l.qty}@${l.price}`).sort().join(", ");

/** Product id and the id of the named location on it (name read from the product's own location list). */
async function productAndLocation(bu: string, code: string, locationName: string): Promise<{ productId: string; locationId: string }> {
  const list = await buConfigSend("Admin", "GET", `/products?search=${encodeURIComponent(code)}&perpage=20`, undefined, bu);
  const hit = ((list.body?.data ?? []) as any[]).find((p) => p.code === code);
  if (!hit) throw new Error(`${bu}: product ${code} not found - run data:reset first`);
  const detail = await buConfigSend("Admin", "GET", `/products/${hit.id}`, undefined, bu);
  const loc = ((detail.body?.data?.locations ?? []) as any[]).find((l) => l.location?.name === locationName);
  if (!loc) throw new Error(`${bu}: ${code} has no location "${locationName}"`);
  return { productId: String(hit.id), locationId: String(loc.location.id) };
}

/** Add a row in edit mode — new rows land on top and copy the previous row's location (as on create). */
async function addLine(page: Page, line: GrnLine, location: string) {
  const row = await addRow(page, "Select Product");
  await expect(row.locator("button").first()).not.toHaveText(/^\s*$/);
  const loc = row.getByRole("button", { name: "Select Location" });
  if (await loc.count()) await pickLookup(page, loc, location);
  await expect(row).toContainText(location);
  await pickLookup(page, row.getByRole("button", { name: "Select Product" }), line.product);
  await typeInto(row.locator('input[name$=".received_qty"]'), line.qty);
  const unit = row.getByRole("button", { name: "Select Unit" }).first();
  if (await unit.isVisible().catch(() => false)) {
    await unit.click();
    await page.locator("[data-slot=popover-content]:visible button[data-value], [data-slot=select-item], [role=option]").first().click();
  }
  await typeInto(row.locator('input[placeholder="0.00"]').first(), line.price);
}

/** Invoice-number prefix of every GRN this run creates — cleanup finds them by it, from the API. */
const INVOICE = `FE-GRN-${stamp}`;

/**
 * Cleanup by invoice-number stamp on each TEST BU, read from the API (not from in-memory ids) so a failed case is
 * still cleaned. drafts -> DELETE; saved (not committed) -> void; committed GRNs cannot be voided (the FE hides
 * Void after commit) so they stay, with a warning, until the next data:reset. A delete/void the BU refuses is
 * collected and thrown so the hook fails visibly instead of leaking silently.
 */
test.afterAll(async () => {
  test.setTimeout(180_000);
  const failures: string[] = [];
  for (const { code } of TEST_BUS) {
    const { status, body } = await dfGet(`/good-received-notes?search=${encodeURIComponent(INVOICE)}&perpage=100`, "Admin", code);
    if (status !== 200) {
      failures.push(`${code}: list good-received-notes HTTP ${status} ${JSON.stringify(body).slice(0, 200)}`);
      continue;
    }
    for (const d of (body?.data ?? []) as any[]) {
      if (!String(d.invoice_no ?? "").startsWith(INVOICE)) continue;
      const label = `${code} ${d.grn_no ?? d.id}`;
      if (d.doc_status === "committed") {
        console.warn(`cleanup: left ${label} committed until next data:reset (cannot be voided)`);
        continue;
      }
      if (d.doc_status === "voided" || d.doc_status === "deleted") continue;
      const r =
        d.doc_status === "draft"
          ? await buSend("Admin", "DELETE", `/good-received-notes/${d.id}`, undefined, code)
          : await buSend("Admin", "DELETE", `/good-received-notes/${d.id}/void`, undefined, code);
      if (r.status >= 300) failures.push(`${label} (${d.doc_status}) HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
    }
  }
  if (failures.length) throw new Error(`cleanup: GRN(s) not removed: ${failures.join(" | ")}`);
});

// ── Lifecycle: TEST BU (AVG) only ──────────────────────────────────────────────────

test.describe("GRN lifecycle (TEST BU AVG)", () => {
  const BU = BU_CODE;
  test.use({ role: "Purchase", bu: BU });
  test.describe.configure({ mode: "serial", retries: 0 });

  let LOC = "";
  let VENDOR = "";
  let TODAY = "";
  let draftId = "";
  const LINES: GrnLine[] = [
    { product: P.P1.code, qty: 3, price: 100 },
    { product: P.P2.code, qty: 5, price: 200 },
  ];
  const EDITED_INVOICE = `${INVOICE}-E`;
  const EDITED: GrnLine[] = [
    { product: P.P1.code, qty: 7, price: 120 },
    { product: P.P3.code, qty: 2, price: 300 },
  ];

  test.beforeAll(async () => {
    TODAY = await activePeriodDate(BU);
    LOC = (await srLocations(BU)).from;
    VENDOR = (await firstVendor(BU)).code;
  });

  test(
    "TC-GRN-700001 Purchase สร้าง GRN manual แบบ draft แล้วหลังบ้านเก็บใบกำกับ จำนวน และราคาครบ",
    {
      annotation: [
        { type: "preconditions", description: "Login เป็นบัญชี Purchase (gmail); BU TEST (AVG); Purchase มีสิทธิ์สร้าง/commit GRN (data:reset); มีผู้ขายและสินค้า E2E-DF-1..4 ที่คลังคู่ doc-flow" },
        { type: "steps", description: "1. เปิด /procurement/goods-receive-note/new?doc_type=manual\n2. ผู้ขายแรกที่ active, GRN Date = วันในงวด active, Currency THB, เลขใบกำกับ FE-GRN-<stamp>, Invoice Date เดียวกัน\n3. Add Item 2 รายการที่คลังแรก: E2E-DF-1 × 3 @100, E2E-DF-2 × 5 @200\n4. กด Save Draft" },
        { type: "expected", description: "POST ตอบ ok; หลังบ้าน doc_status = draft, invoice_no = FE-GRN-<stamp> และรายการ E2E-DF-1×3@100, E2E-DF-2×5@200" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
        { type: "note", description: "เดิม GRN.1 (_movement_play fe/04-grn) · TC-GRN-050001 ไม่มี assertion และคาดสถานะ RECEIVED ซึ่งไม่มีแล้ว (draft / saved / committed)" },
      ],
    },
    async ({ page }) => {
      const doc = await createGrn(page, { bu: BU, vendor: VENDOR, location: LOC, date: TODAY, invoiceNo: INVOICE, lines: LINES, status: "draft" });
      draftId = doc!.id;
      const g = await grnById(draftId, BU);
      expect(g.status).toBe("draft");
      expect(g.invoice).toBe(INVOICE);
      expect(fmt(g.lines)).toBe(fmt(LINES));
      await observed(`${g.no} · ${g.status} · invoice ${g.invoice} · ${fmt(g.lines)} · toast: ${(await toasts(page)).join(" / ") || "-"}`);
    },
  );

  test(
    "TC-GRN-700002 Purchase เปิด GRN draft แล้วเห็นใบกำกับ จำนวน และราคาตามที่บันทึก",
    {
      annotation: [
        { type: "preconditions", description: "TC-GRN-700001 ผ่านแล้วในรอบเดียวกัน (serial) — มี GRN draft บน TEST BU (AVG)" },
        { type: "steps", description: "1. เปิด /procurement/goods-receive-note/<id> จากลิงก์ตรง\n2. อ่านเลขใบกำกับ และข้อความ/ค่าในแถวของแต่ละสินค้า" },
        { type: "expected", description: "หน้าแสดงเลขใบกำกับ FE-GRN-<stamp>; แถว E2E-DF-1 มีจำนวน 3 ราคา 100; แถว E2E-DF-2 มีจำนวน 5 ราคา 200" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "CRUD" },
        { type: "note", description: "เดิม GRN.2 · main ไม่มีเคสเปิดดู GRN · ครอบบางส่วนของ gap TC-GRN-020101/020103" },
      ],
    },
    async ({ page }) => {
      await gotoBu(page, `/procurement/goods-receive-note/${draftId}`, BU);
      await expect
        .poll(async () => `${(await inputValues(page)).join(" ")} ${await page.locator("main").innerText()}`)
        .toContain(INVOICE);
      const seen: string[] = [];
      for (const l of LINES) {
        const row = itemRow(page, l.product);
        await expect(row).toBeVisible();
        const vals = await row.locator("input").evaluateAll((xs) => xs.map((x) => (x as HTMLInputElement).value));
        const all = `${(await row.innerText()).replace(/\s+/g, " ")} ${vals.join(" ")}`.replace(/,/g, "");
        expect(all, `${l.product} qty`).toMatch(numRe(l.qty));
        expect(all, `${l.product} price`).toMatch(numRe(l.price));
        seen.push(`${l.product}: ${all.slice(0, 120)}`);
      }
      await observed(seen.join(" · "));
    },
  );

  test(
    "TC-GRN-700003 Purchase แก้ GRN draft (ใบกำกับ + จำนวน/ราคา + ลบรายการ + เพิ่มรายการ)",
    {
      annotation: [
        { type: "preconditions", description: "TC-GRN-700001 ผ่านแล้วในรอบเดียวกัน (serial) — GRN draft มี E2E-DF-1×3@100, E2E-DF-2×5@200" },
        { type: "steps", description: "1. เปิดใบ แล้วกด Edit\n2. เลขใบกำกับ → FE-GRN-<stamp>-E\n3. E2E-DF-1 3@100 → 7@120\n4. ลบ E2E-DF-2 ด้วย \"Remove this line\"\n5. Add Item: E2E-DF-3 2@300\n6. รอหน่วยโหลดเสร็จ แล้วกด Save Draft" },
        { type: "expected", description: "Save ตอบ < 300; ใบยังเป็น draft; หลังบ้านเก็บเลขใบกำกับใหม่ และรายการเหลือ E2E-DF-1×7@120, E2E-DF-3×2@300" },
        { type: "priority", description: "High" },
        { type: "testType", description: "CRUD" },
        { type: "note", description: "เดิม GRN.3 · TC-GRN-060001/070001/080001/090001 เป็นเปลือกที่ไม่ได้ตรวจผล · ครอบ gap TC-GRN-040108 และบางส่วนของ 070103" },
      ],
    },
    async ({ page }) => {
      await gotoBu(page, `/procurement/goods-receive-note/${draftId}`, BU);
      await button(page, "Edit").click();
      await page.locator("#grn-invoice-no").fill(EDITED_INVOICE);
      const p1 = itemRow(page, P.P1.code);
      await typeInto(p1.locator('input[name$=".received_qty"]'), 7);
      await typeInto(p1.locator('input[placeholder="0.00"]').first(), 120);
      await itemRow(page, P.P2.code).getByRole("button", { name: "Remove this line" }).click();
      if (await page.locator("[role=alertdialog]:visible").count()) await confirmDialog(page, /remove|delete|confirm|ลบ/i);
      await expect(itemRow(page, P.P2.code)).toHaveCount(0);
      await addLine(page, EDITED[1], LOC);
      await expect(page.locator("table tbody .animate-spin")).toHaveCount(0);
      const resp = page.waitForResponse(
        (r) => /\/good-received-notes/.test(r.url()) && !["GET", "OPTIONS"].includes(r.request().method()),
        { timeout: 60_000 },
      );
      await button(page, "Save Draft").click();
      const r = await resp;
      expect(r.status(), (await r.text()).slice(0, 400)).toBeLessThan(300);
      await expect.poll(async () => fmt((await grnById(draftId, BU)).lines), { timeout: 15_000 }).toBe(fmt(EDITED));
      const g = await grnById(draftId, BU);
      expect(g.status).toBe("draft");
      expect(g.invoice).toBe(EDITED_INVOICE);
      await observed(`${g.no} · ${g.status} · invoice ${g.invoice} · ${fmt(g.lines)} · toast: ${(await toasts(page)).join(" / ") || "-"}`);
    },
  );

  test(
    "TC-GRN-700004 Purchase ลบ GRN draft (Edit → Delete) แล้วใบหายจากหลังบ้าน",
    {
      annotation: [
        { type: "preconditions", description: "TC-GRN-700001 ผ่านแล้วในรอบเดียวกัน (serial) — GRN draft ยังอยู่" },
        { type: "steps", description: "1. เปิดใบ แล้วกด Edit\n2. กด Delete\n3. ยืนยัน Delete ใน dialog" },
        { type: "expected", description: "GET ใบนั้นไม่พบแล้ว และหน้าจอออกจาก URL ของใบกลับไปหน้ารายการ" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "CRUD" },
        { type: "note", description: "เดิม GRN.4 · main มีแต่เคสลบบรรทัด · ครอบ gap TC-GRN-050102 และบางส่วนของ 050101" },
      ],
    },
    async ({ page, signals }) => {
      signals.minor(new RegExp(`GET .*/good-received-notes/${draftId} → 404`), "refetch of the just-deleted document");
      await gotoBu(page, `/procurement/goods-receive-note/${draftId}`, BU);
      await button(page, "Edit").click();
      await button(page, "Delete").first().click();
      await confirmDialog(page, /^delete$/i);
      await expect.poll(async () => (await grnById(draftId, BU)).status, { timeout: 30_000 }).toBe("deleted");
      await expect(page).not.toHaveURL(new RegExp(draftId), { timeout: 15_000 });
      await observed(`deleted · ${page.url().replace(/^https?:\/\/[^/]+/, "")} · toast: ${(await toasts(page)).join(" / ") || "-"}`);
    },
  );
});

// ── Stock posting: one describe per TEST BU, against its own cost method ───────────────

/** Case id and title per BU. The same id cannot appear in two titles (audit:tc-ids), hence 70/71/72. */
const POSTING: Record<string, { tc: string; title: string; note: string }> = {
  "BU-GR2VYNKQ": {
    tc: "TC-GRN-700005",
    title: "Purchase สร้าง GRN แล้วกด Create ได้สถานะ saved และ AVG ลงสต๊อกทันที",
    note: "เดิม GRN.5 · ขัดกับ TC-GRN-140003 (501-grn: ยังไม่ commit ต้องไม่มี stock movement) — ต้องให้ทีมหลังบ้านยืนยันว่าพฤติกรรมของ AVG แบบไหนถูก",
  },
  "BU-96EAT3GX": {
    tc: "TC-GRN-710005",
    title: "Purchase สร้าง GRN แล้วกด Create ได้ saved โดย FIFO ยังไม่ลงสต๊อก และลงสต๊อกหลัง Commit",
    note: "คู่ของ TC-GRN-700005 บน BU FIFO · วันที่ของใบ = วันนี้ เพราะ FIFO ปฏิเสธใบที่ลงวันก่อนใบรับล่าสุดของสินค้า/คลังเดียวกัน (422)",
  },
  "BU-0706T34Y": {
    tc: "TC-GRN-720005",
    title: "Purchase สร้าง GRN แล้วกด Create บน BU average_per_location แล้วลงสต๊อกตามที่หลังบ้านทำจริง",
    note: "คู่ของ TC-GRN-700005 บน BU average_per_location · คาดว่าลงตอน saved เหมือน average — ผลจริงอยู่ในส่วน Finding ของ header",
  },
};

for (const bu of TEST_BUS) {
  const meta = POSTING[bu.code];
  test.describe(`GRN posting (${bu.method} ${bu.code})`, () => {
    test.use({ role: "Purchase", bu: bu.code });
    test.describe.configure({ mode: "serial", retries: 0 });

    let LOC = "";
    let VENDOR = "";
    let TODAY = "";
    let PRODUCT_ID = "";
    let LOCATION_ID = "";

    test.beforeAll(async () => {
      expect(await calcMethod(bu.code), `${bu.code} cost method`).toBe(bu.method);
      TODAY = await activePeriodDate(bu.code);
      LOC = (await srLocations(bu.code)).from;
      VENDOR = (await firstVendor(bu.code)).code;
      ({ productId: PRODUCT_ID, locationId: LOCATION_ID } = await productAndLocation(bu.code, P.P4.code, LOC));
    });

    test(
      `${meta.tc} ${meta.title}`,
      {
        annotation: [
          { type: "preconditions", description: `Login เป็นบัญชี Purchase (gmail); BU ${bu.code} (costing แบบ ${bu.method}); ตรวจ inventory transaction และสต๊อกจาก API` },
          {
            type: "steps",
            description:
              "1. อ่านสต๊อก E2E-DF-4 ที่คลังแรกก่อนทำ\n2. สร้าง GRN manual 1 รายการ E2E-DF-4 × 1 @50 วันที่ในงวด active\n3. กด Create แล้วรอให้ใบพ้นสถานะ draft\n" +
              (bu.method === "fifo" ? "4. ตรวจว่ายังไม่มี stock movement\n5. กด Commit แล้วยืนยัน" : "4. ตรวจ stock movement และสต๊อกหลัง Create"),
          },
          {
            type: "expected",
            description:
              bu.method === "fifo"
                ? "หลัง Create: doc_status = saved, ไม่มี inventory transaction ของใบนี้, สต๊อกไม่เปลี่ยน; หลัง Commit: committed, รับเข้า E2E-DF-4 จำนวน 1, สต๊อกเพิ่ม 1"
                : "doc_status = saved, grn_no ไม่ขึ้นต้นด้วย draft, รายการ E2E-DF-4×1@50; inventory-transactions ของใบนี้รับเข้า E2E-DF-4 จำนวน 1 และสต๊อกเพิ่ม 1 (เทียบก่อน/หลัง)",
          },
          { type: "priority", description: "High" },
          { type: "testType", description: "Functional" },
          { type: "note", description: meta.note },
        ],
      },
      async ({ page }) => {
        const lines: GrnLine[] = [{ product: P.P4.code, qty: 1, price: 50 }];
        const before = await stockAt(PRODUCT_ID, LOCATION_ID, TODAY, bu.code);
        const doc = await createGrn(page, { bu: bu.code, vendor: VENDOR, location: LOC, date: TODAY, invoiceNo: `${INVOICE}-${bu.method}`, lines, status: "saved" });
        const g = await grnById(doc!.id, bu.code);
        expect(g.status).toBe("saved");
        expect(g.no).not.toMatch(/^draft/i);
        expect(fmt(g.lines)).toBe(fmt(lines));
        const tx = await txOfDoc(bu.code, doc!.id, g.no);
        const afterSave = await stockAt(PRODUCT_ID, LOCATION_ID, TODAY, bu.code);

        if (bu.method === "fifo") {
          // FIFO posts at commit, not at save.
          expect(tx.length, "a saved FIFO GRN must not post stock before commit").toBe(0);
          expect(afterSave.qty - before.qty, "FIFO on-hand delta after Create").toBe(0);
          await commitGrn(page, doc!.id, bu.code);
          const c = await grnById(doc!.id, bu.code);
          expect(c.status).toBe("committed");
          const txC = await txOfDoc(bu.code, doc!.id, c.no);
          expect(txC.length, "a committed FIFO GRN must post stock").toBeGreaterThan(0);
          expect(txC.reduce((n, t) => n + t.qty_in, 0), "stock received = GRN line qty").toBe(lines[0].qty);
          expect(txC[0].product?.code).toBe(lines[0].product);
          const afterCommit = await stockAt(PRODUCT_ID, LOCATION_ID, TODAY, bu.code);
          expect(afterCommit.qty - before.qty, "FIFO on-hand delta after Commit").toBe(lines[0].qty);
          await observed(`${c.no} · saved->committed · on-hand ${before.qty} -> ${afterSave.qty} -> ${afterCommit.qty} · inventory transactions ${tx.length} -> ${txC.length} · toast: ${(await toasts(page)).join(" / ") || "-"}`);
          return;
        }

        // average / average_per_location: posts when saved.
        expect(tx.length, `a saved ${bu.method} GRN must post stock`).toBeGreaterThan(0);
        expect(tx.reduce((n, t) => n + t.qty_in, 0), "stock received = GRN line qty").toBe(lines[0].qty);
        expect(tx[0].product?.code).toBe(lines[0].product);
        expect(afterSave.qty - before.qty, `${bu.method} on-hand delta after Create`).toBe(lines[0].qty);
        await observed(`${g.no} · ${g.status} · ${fmt(g.lines)} · on-hand ${before.qty} -> ${afterSave.qty} · inventory transactions ${tx.length} · toast: ${(await toasts(page)).join(" / ") || "-"}`);
      },
    );
  });
}
