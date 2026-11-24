import type { Page } from "@playwright/test";
import {
  test,
  expect,
  gotoInBu,
  BU,
  SCHEMA,
  requireScenario,
  shot,
  record,
  prevRecord,
  currentPeriod,
  userLocations,
  buConfig,
  getDoc,
  putDoc,
  layers,
  sql, gatePhase,
  PC_USERS,
  apiGet,
} from "./helpers/period-close/context";
import { pickSelect, pickLookup, lastToast, btn, toasts } from "./helpers/movement/ui";
import { createGrn, commitGrn, grnById, deleteGrnDraft, createAdjustment, adjustmentUrl } from "./helpers/period-close/docs";
import { L, SCN, PERIOD } from "./helpers/period-close/scenarios";

/**
 * Period close · phase 910 — Case 0 pre-step (section 40).
 *
 * เตรียมข้อมูลผ่าน UI จริงก่อนทดสอบปิดงวด (ค่าตาม scenario ใน helpers/period-close/scenarios.ts):
 * เคลียร์ GRN ที่ค้างจากงวดก่อน → ผูก admin กับคลัง L → สร้างเอกสารรับเข้า (GRN / SI) ที่เป็นฐานต้นทุน
 * → ตั้ง "Default price for added items" (si.cost-from) ของ BU
 * ทุกขั้นเช็คสถานะก่อนทำ (idempotent) รันซ้ำแล้วไม่สร้างเอกสารซ้ำ — เอกสารที่สร้างจำไว้ใน state.json ของ scenario
 *
 * Irreversible? ไม่แตะสถานะงวด แต่สร้าง/commit เอกสารจริงลง BU ของ scenario (ลบคืนอัตโนมัติไม่ได้)
 * Prerequisites: งวดปัจจุบันของ BU = งวดของ scenario · E2E_DB_URL (อ่าน cost layer) · project setup (storageState ของ Admin gmail)
 * Run:  E2E_PERIOD_BU=<BU> bun run test:period-close -- tests/910-period-close-prestep.spec.ts
 *
 * Serial: เอกสารรับเข้า (TC-PE-400003) ลงคลัง L ได้ก็ต่อเมื่อ admin ผูกกับคลังนั้นแล้ว (TC-PE-400002)
 * Origin: _movement_play/eop_bf/e2e/specs/00-prestep.spec.ts (sub-case 0.0 / 0.1 / 0.2–0.3c / 0.4)
 */
const CASE = "Case 0 · pre-step";
const ADMIN = PC_USERS.admin;
/** แถวของผู้ใช้ Admin (gmail) ในหน้า Users — ปุ่มชื่ออยู่ในแถวที่ช่องอีเมลมี title = อีเมล */
const openAdminUser = (page: Page) =>
  page.getByRole("row").filter({ has: page.getByTitle(ADMIN.email, { exact: true }) }).getByRole("button").first().click();

test.describe.configure({ mode: "serial" });

test.beforeAll(() => requireScenario());
// 400001/400003 อ่าน SQL (E2E_DB_URL); 400003 ลงวันที่เอกสารในงวดผ่านฟอร์ม — 400002/400004 ตั้งค่า BU เท่านั้น ไม่ต้องใช้
gatePhase({ db: true, dates: true }, /TC-PE-400001|TC-PE-400003/);
test.beforeAll(async () => {
  expect(await currentPeriod(BU), `งวดปัจจุบันของ ${BU} ต้องเป็น ${PERIOD}`).toBe(PERIOD);
});

/** GRN saved/draft ที่ลงวันที่ในงวดนี้ (ของค้างจากข้อ 2.1/2.1b ของรอบก่อน) */
function pendingGrnsInPeriod() {
  return sql<{ grn_no: string; st: string }>(`select g.grn_no, g.doc_status::text st from ${SCHEMA}.tb_good_received_note g
    join ${SCHEMA}.tb_inventory_period ip on ip.period = '${PERIOD}' and ip.deleted_at is null
    where g.deleted_at is null and g.doc_status in ('saved', 'draft') and g.grn_date >= ip.start_at and g.grn_date <= ip.end_at + interval '1 day'
    order by g.grn_date`);
}

test(
  "TC-PE-400001 เคลียร์ GRN saved/draft ที่ค้างจากงวดก่อนและขวางการเริ่มนับของงวดนี้",
  {
    annotation: [
      { type: "preconditions", description: "Login เป็น Admin (gmail, project setup); BU และงวดของ scenario (E2E_PERIOD_BU) เป็นงวดปัจจุบัน; scenario มีรายการ preClean หรือเปิด preCleanAuto (TEST BU ว่างจากเอกสาร ทั้งสองค่าจึงปิดไว้ = เคสนี้ skip); E2E_DB_URL ตั้งไว้" },
      { type: "steps", description: "1. หา GRN ที่ต้องเคลียร์: รายการ preClean ของ scenario + (preCleanAuto) GRN saved/draft ที่ลงวันที่ในงวดของ scenario จาก DB\n2. GRN saved → เปิดใบ → Commit → ยืนยัน\n3. GRN draft → เปิดใบ → Edit → Delete → ยืนยัน\n4. DB: ค้นหา GRN saved/draft ที่ลงวันที่ในงวดนี้อีกครั้ง" },
      { type: "expected", description: "ใบที่สั่ง commit มีสถานะ committed; ใบร่างถูกลบ; ไม่เหลือ GRN saved/draft ที่ลงวันที่ในงวดของ scenario" },
      { type: "priority", description: "High" },
      { type: "testType", description: "Functional" },
      { type: "note", description: "เดิม 0.0 (_movement_play specs/00-prestep) · ต้นฉบับบันทึก PASS เสมอและไม่ assert — พอร์ตเพิ่มการตรวจสถานะหลัง commit และตรวจซ้ำว่าไม่มี GRN ค้างในงวด (บันทึก FAIL ถ้ายังค้าง) · สร้างผลกระทบจริง: commit ใบ saved ลงสต๊อก" },
    ],
  },
  async ({ page }) => {
    test.skip(!SCN.preClean.length && !SCN.preCleanAuto, "scenario นี้ไม่มีของค้าง");
    const images: string[] = [];
    const notes: string[] = [];
    // preCleanAuto: GRN saved/draft ที่ลงวันที่ในงวดนี้ (ของค้างจากข้อ 2.1/2.1b ของรอบก่อน) — saved → commit · draft → ลบ
    const auto = SCN.preCleanAuto
      ? pendingGrnsInPeriod().map((r) => ({
          key: `pre-${r.grn_no}`,
          grnNo: r.grn_no,
          action: (r.st === "saved" ? "commit" : "delete") as "commit" | "delete",
        }))
      : [];
    const preClean = [...SCN.preClean, ...auto];
    const notCommitted: string[] = [];
    for (const c of preClean) {
      const [row] = sql(`select id, doc_status::text st, deleted_at is not null del from ${SCHEMA}.tb_good_received_note where grn_no = '${c.grnNo}' order by created_at desc limit 1`);
      if (!row) {
        notes.push(`${c.grnNo}: ไม่พบ`);
        continue;
      }
      if (c.action === "commit" && row.st === "saved") await commitGrn(page, row.id);
      const deleted = String(row.del) === "true";
      if (c.action === "delete" && !deleted && row.st === "draft") await deleteGrnDraft(page, row.id);
      const after = c.action === "commit" ? (await grnById(row.id)).status : "deleted";
      putDoc(c.key, { id: row.id, no: c.grnNo, status: after });
      if (c.action === "commit") {
        if (after !== "committed") notCommitted.push(`${c.grnNo}=${after}`);
        await gotoInBu(page, `/procurement/goods-receive-note/${row.id}`);
        images.push(await shot(page, "0.0", `commit-${c.grnNo}`));
      }
      notes.push(`${c.grnNo}: ${row.st} → ${after}`);
    }
    // ผลที่คาดของข้อนี้คือ "ไม่มี GRN draft/saved ค้างในงวดนี้" — ตรวจซ้ำจาก DB หลังเคลียร์
    const left = pendingGrnsInPeriod();
    record({
      id: "0.0", case: CASE, title: "เคลียร์ GRN ที่ค้างจากงวดก่อนและขวางการเริ่มนับของงวดนี้",
      steps: preClean.length ? preClean.map((c) => `${c.action === "commit" ? "Commit" : "Delete"} ${c.grnNo}`) : ["ค้นหา GRN saved/draft ที่ลงวันที่ในงวดนี้"],
      expected: "ไม่มี GRN draft/saved ค้างในงวดนี้",
      actual:
        (notes.join(" · ") || "ไม่มีของค้าง") +
        (left.length ? ` · ยังค้างหลังเคลียร์: ${left.map((r) => `${r.grn_no}=${r.st}`).join(", ")}` : ""),
      status: left.length || notCommitted.length ? "FAIL" : "PASS",
      images,
    });
    expect(notCommitted, "ใบที่สั่ง commit ต้องเป็น committed").toEqual([]);
    expect(left.map((r) => `${r.grn_no}=${r.st}`), `ยังมี GRN saved/draft ลงวันที่ในงวด ${PERIOD}`).toEqual([]);
  },
);

test(
  "TC-PE-400002 ผูก admin กับคลัง L ของ scenario ผ่านหน้า System Admin → Users",
  {
    annotation: [
      { type: "preconditions", description: "Login เป็น Admin (gmail, project setup); BU ของ scenario; คลัง L (คลัง inventory แรกของ BU ที่ data:reset ผูก E2E-PC-* ไว้) มีอยู่ใน BU" },
      { type: "steps", description: "1. เปิด /system-admin/user → กดชื่อ Admin (gmail)\n2. ถ้ายังไม่ผูกคลัง L: Edit → ติ๊กแถวคลัง L → Save\n3. GET /user-locations ของ BU\n4. เปิดผู้ใช้อีกครั้ง ดูส่วน Locations (โหมด view)" },
      { type: "expected", description: "GET /api/<BU>/user-locations มีรหัสคลัง L และหน้า view ของผู้ใช้แสดงแถวคลัง L" },
      { type: "priority", description: "High" },
      { type: "testType", description: "Functional" },
      { type: "note", description: "ผูกคลังเป็นการตั้งค่าเริ่มต้นของ suite โดยตั้งใจ ไม่ถูกย้อนคืนหลังรัน · เดิม 0.1 (_movement_play specs/00-prestep) · idempotent: ผูกไว้แล้วจะไม่กด Edit/Save ซ้ำ" },
    ],
  },
  async ({ page }) => {
    const before = await userLocations(BU);
    await gotoInBu(page, "/system-admin/user");
    await openAdminUser(page);
    await page.waitForURL(/\/system-admin\/user\/.+/);

    const images: string[] = [];
    if (!before.includes(L.code)) {
      await btn(page, "Edit").click();
      const row = page.locator("tr").filter({ has: page.getByRole("cell", { name: L.code, exact: true }) });
      await row.getByRole("checkbox").check();
      images.push(await shot(page, "0.1", "เลือกคลัง"));
      await btn(page, "Save").click();
      await lastToast(page);
    }
    await expect.poll(() => userLocations(BU)).toContain(L.code);
    // หลัง Save หน้าเด้งกลับไปที่ list — เปิดผู้ใช้ใหม่แล้วถ่ายเฉพาะส่วน Locations ให้เห็นแถวที่ติ๊กแล้ว
    if (!/\/system-admin\/user\/.+/.test(page.url())) {
      await openAdminUser(page);
      await page.waitForURL(/\/system-admin\/user\/.+/);
    }
    // โหมด view แสดงเฉพาะคลังที่ผูกไว้ ไม่มี checkbox
    const locCell = page.getByRole("cell", { name: L.code, exact: true });
    await expect(locCell).toBeVisible();
    await locCell.scrollIntoViewIfNeeded();
    images.push(await shot(page, "0.1", "หลังบันทึก", { fullPage: false }));

    record({
      id: "0.1", case: CASE, title: `ผูก ${ADMIN.email} กับคลัง ${L.code}`,
      steps: ["System Admin → Users → Admin (gmail)", "Edit → ติ๊ก " + L.code, "Save"],
      expected: `GET /user-locations มี ${L.code}`,
      actual: before.includes(L.code) ? (prevRecord("0.1")?.actual ?? "ผูกไว้แล้วจากรอบก่อน") : `ผูกแล้ว (ก่อนหน้า: ${before.length} คลัง)`,
      status: "PASS", images,
    });
  },
);

test(
  "TC-PE-400003 สร้างเอกสารรับเข้าของ scenario (GRN / Stock In) ผ่าน UI แล้วได้ cost layer ตามราคาที่กรอก",
  {
    annotation: [
      { type: "preconditions", description: "TC-PE-400002 ผ่านแล้ว (admin ผูกกับคลัง L ของ scenario); งวดปัจจุบันของ BU = งวดของ scenario; E2E_DB_URL ตั้งไว้" },
      { type: "steps", description: "1. วนเอกสารรับเข้าทุกใบของ scenario (SCN.receipts: 0.2, 0.2b, 0.3, 0.3a, 0.3b, 0.3c ตามที่ scenario มี) — แต่ละใบเป็น test.step ของตัวเอง\n2. GRN: Goods Receive Note → New (Manual) · Vendor C010 · GRN Date ตาม scenario · คลัง L · สินค้า/จำนวน/ราคาตาม scenario → Create → Commit\n3. Stock In: Inventory Adjustment → Add Stock In · Date ตาม scenario · Reason Test stock_in · คลัง L → Commit\n4. เปิดใบ ตรวจว่าแสดงเลขเอกสาร\n5. DB: อ่าน cost layer ของสินค้าแต่ละบรรทัดที่คลัง L" },
      { type: "expected", description: "GRN มีสถานะ committed / Stock In มีสถานะ completed และทุกบรรทัดมี cost layer at_period = งวดของ scenario ที่ in_qty และ cost_per_unit ตรงกับที่กรอก" },
      { type: "priority", description: "High" },
      { type: "testType", description: "Functional" },
      { type: "note", description: "เดิม 0.2 / 0.2b / 0.3 / 0.3a / 0.3b / 0.3c (_movement_play specs/00-prestep — เดิมเป็นหนึ่ง test ต่อใบ ชื่อเปลี่ยนตาม scenario) · ต้นฉบับ assert แค่สถานะใบ แต่บันทึก FAIL เมื่อ layer ไม่ตรงด้วย — พอร์ต assert ทั้งสองอย่าง (expect.soft ให้ใบถัดไปยังถูกสร้าง) · idempotent: จำเลขใบใน state.json · ราคาเหล่านี้เป็นฐานของการตรวจต้นทุนในข้อ 2.9" },
    ],
  },
  async ({ page }) => {
    expect(SCN.receipts.length, "scenario ต้องมีเอกสารรับเข้าอย่างน้อยหนึ่งใบ").toBeGreaterThan(0);
    for (const r of SCN.receipts) {
      await test.step(r.id + " " + (r.kind === "grn" ? "GRN" : "SI") + " " + r.date + " · " + r.title, async () => {
        const images: string[] = [];
        let doc = getDoc(r.key);
        if (r.kind === "grn") {
          if (!doc) {
            await createGrn(page, {
              date: r.date, invoiceNo: `E2E-${PERIOD}-${r.key}`, status: "saved", lines: r.lines,
              onCreated: (d) => putDoc(r.key, { ...d }),
            });
            doc = getDoc(r.key)!;
          }
          if (doc.status !== "committed") {
            await commitGrn(page, doc.id);
            doc = { ...(await grnById(doc.id)) };
            putDoc(r.key, doc);
          }
          if (!page.url().includes(doc.id)) await gotoInBu(page, `/procurement/goods-receive-note/${doc.id}`);
        } else {
          if (!doc) {
            const created = await createAdjustment(page, {
              type: "stock-in", date: r.date, reason: "Test stock_in", status: "completed", lines: r.lines,
              onCreated: (d) => putDoc(r.key, { ...d }),
            });
            doc = { ...created! };
            putDoc(r.key, doc);
          }
          await gotoInBu(page, adjustmentUrl("stock-in", doc.id));
        }
        await expect(page.getByText(doc.no).first()).toBeVisible();
        images.push(await shot(page, r.id, `${r.kind === "grn" ? "GRN" : "SI"}-${doc.no}`));

        const got = r.lines.map((l) => ({
          p: l.product,
          ok: layers(L.code, l.product).some((x) => x.at_period === PERIOD && Number(x.in_qty) === l.qty && Number(x.cost_per_unit) === l.price),
        }));
        const done = r.kind === "grn" ? doc.status === "committed" : doc.status === "completed";
        record({
          id: r.id, case: CASE, title: `${r.title} (ลงวันที่ ${r.date})`,
          steps: [
            r.kind === "grn" ? `Goods Receive Note → New (Manual) · Vendor C010 · GRN Date ${r.date}` : `Inventory Adjustment → Add Stock In · Date ${r.date} · Reason Test stock_in`,
            `ที่ ${L.code}: ${r.lines.map((l) => `${l.product} qty ${l.qty} @${l.price}`).join(" · ")}`,
            r.kind === "grn" ? "Create → Commit" : "Commit",
          ],
          expected: `ใบ ${r.kind === "grn" ? "committed" : "completed"} และมี cost layer งวด ${PERIOD} ตามราคาที่กรอก`,
          actual:
            `${doc.no} = ${doc.status} · layer ครบ: ${got.map((g) => `${g.p}${g.ok ? "✓" : "✗"}`).join(" ")}` +
            (doc.autoCost ? ` · ราคาที่ฟอร์มเติมให้เองก่อนแก้ (CostProbe) = ${JSON.stringify(doc.autoCost)}` : ""),
          status: done && got.every((g) => g.ok) ? "PASS" : "FAIL",
          docs: [doc.no], images,
        });
        expect.soft(done, `${doc.no} = ${doc.status}`).toBe(true);
        expect.soft(got.filter((g) => !g.ok).map((g) => g.p), `${doc.no}: สินค้าที่ไม่มี cost layer งวด ${PERIOD} ตามจำนวน/ราคาที่กรอก`).toEqual([]);
      });
    }
  },
);

test(
  "TC-PE-400004 ตั้ง Default price for added items (si.cost-from) ของ BU ตามที่ scenario กำหนด",
  {
    annotation: [
      { type: "preconditions", description: "Login เป็น Admin (gmail, project setup); ถ้าต้องเปลี่ยนค่า BU ตั้งต้นของบัญชี admin ต้องเป็น BU ของ scenario (PATCH api/business-units ไม่มี bu_code — เขียนลง BU ตั้งต้นของบัญชี)" },
      { type: "steps", description: "1. อ่าน si.cost-from ของ BU จาก /api/user/profile\n2. ถ้ายังไม่ตรง: เปิด /system-admin/default-setting → Edit → Default price for added items = ค่าของ scenario (Last receiving / Last cost / Average) → Save\n3. รอจน profile ของ BU คืนค่าใหม่\n4. (ถ้า BU ตั้งต้นของบัญชีคือ BU ของ scenario) reload หน้า ดูค่าที่แสดงในโหมด view" },
      { type: "expected", description: "bu_config si.cost-from ของ BU ของ scenario = ค่าที่ scenario กำหนด (เช่น last_cost); request บันทึกตอบ 2xx; หน้า view แสดง label ของค่านั้น" },
      { type: "priority", description: "High" },
      { type: "testType", description: "Functional" },
      { type: "note", description: "เดิม 0.4 (_movement_play specs/00-prestep) · เคยเขียนผิด BU (period04 ข้อ 0.4-F: PATCH 200 แต่ค่าไปลง BU ตั้งต้นของบัญชีแทน) จึงมีด่านเช็ค BU ตั้งต้นก่อนกด Save · พอร์ตเพิ่ม assert ว่า request บันทึกตอบ ok และอ่าน toast แบบไม่รอ (เดิม lastToast().catch)" },
    ],
  },
  async ({ page }) => {
    const want = SCN.costFrom;
    const before = await buConfig(BU, "si.cost-from");
    // หน้า Default Setting อ่าน/เขียน BU ตั้งต้นของบัญชี ไม่ใช่ BU ที่ fixture ปักหมุดไว้ใน browser
    // (ผู้ใช้จริงสลับ BU บน header = เปลี่ยน BU ตั้งต้นไปด้วย สองอย่างจึงตรงกันเสมอ — เป็นเรื่องของ harness เท่านั้น)
    const profile = await apiGet("/api/user/profile");
    const def = (profile.body.data.business_unit as { code: string; is_default: boolean }[]).find((b) => b.is_default);
    await gotoInBu(page, "/system-admin/default-setting");
    const images: string[] = [];
    let saveNote = "";
    let toast = "";
    let saveOk: boolean | undefined;
    if (before !== want.value) {
      // PATCH api/business-units ไม่มี bu_code — หลังบ้านเขียนลง BU ตั้งต้นของบัญชี ไม่ใช่ BU ที่จอโชว์ (เคยเขียนผิดไป BU ตั้งต้นของบัญชี 2026-09-30)
      // ข้อมูล/สภาพแวดล้อม: หน้านี้เขียนลง BU ตั้งต้นของบัญชี — ถ้าไม่ใช่ BU ของ scenario ต้องไม่กด Save (จะเขียนผิด BU) และไม่สลับ BU ตั้งต้นของบัญชี admin ที่ใช้ร่วมกัน
      test.skip(def?.code !== BU, `si.cost-from ของ ${BU} คือ ${before} ไม่ใช่ ${want.value} และ BU ตั้งต้นของ ${ADMIN.email} คือ ${def?.code} — Default Setting เขียนลง BU ตั้งต้น จึงตั้งค่าให้ ${BU} ไม่ได้โดยไม่สลับ BU ตั้งต้นของบัญชี (ตั้งเองก่อนรัน)`);
      await btn(page, "Edit").click();
      const trigger = page.getByLabel("Default price for added items");
      // FE main เปลี่ยน Select หลายช่องเป็น lookup แบบ lazy — รองรับทั้งสองแบบ
      if ((await trigger.getAttribute("data-slot")) === "select-trigger") await pickSelect(page, trigger, want.label);
      else await pickLookup(page, trigger, want.label);
      images.push(await shot(page, "0.4", `เลือก ${want.label}`));
      // null = ไม่มี request บันทึกออกไปเลย — เป็นผลที่ต้องบันทึกลงหลักฐานก่อน แล้ว assert ด้วย saveOk ด้านล่าง
      const saved = page.waitForResponse((r) => /business-units/.test(r.url()) && r.request().method() !== "GET", { timeout: 30_000 }).catch(() => null);
      await btn(page, "Save").click();
      const resp = await saved;
      saveOk = resp?.ok() ?? false;
      saveNote = resp
        ? `${resp.request().method()} ${resp.status()} · ส่ง si.cost-from=${JSON.stringify((JSON.parse(resp.request().postData() ?? "{}").config ?? []).find((c: { key: string }) => c.key === "si.cost-from")?.value)}`
        : "ไม่มี request บันทึกออกไปเลย";
      images.push(await shot(page, "0.4", "หลังกด-Save"));
      toast = (await toasts(page)).join(" / ") || "(ไม่มี toast)";
    }
    const after = await expect
      .poll(() => buConfig(BU, "si.cost-from"), { timeout: 20_000 })
      .toBe(want.value)
      .then(() => want.value, async () => buConfig(BU, "si.cost-from"));
    if (after !== want.value) {
      record({
        id: "0.4", case: CASE, title: `ตั้ง si.cost-from = ${want.value}`,
        steps: ["System Admin → Default Setting", `Edit → Default price for added items = ${want.label}`, "Save"],
        expected: `bu_config si.cost-from = ${want.value}`,
        actual: `ไม่ถูกบันทึก: ${saveNote} · toast="${toast}" · หน้าจอหลังกด Save แสดงค่าใหม่ แต่ profile/DB ยังเป็น ${after}`,
        status: "FAIL", images,
      });
    }
    expect(after).toBe(want.value);
    if (saveOk !== undefined) expect(saveOk, `request บันทึก Default Setting: ${saveNote}`).toBe(true);
    if (def?.code === BU) {
      await page.reload();
      // โหมด view ไม่ได้ render เป็น data-slot=field — ค่าที่เลือกโผล่เป็นข้อความเดี่ยว
      await expect(page.getByText(want.label, { exact: true })).toBeVisible();
      images.push(await shot(page, "0.4", "หลังบันทึก"));
    }

    record({
      id: "0.4", case: CASE, title: `ตั้ง si.cost-from = ${want.value}`,
      steps: ["System Admin → Default Setting", `Edit → Default price for added items = ${want.label}`, "Save"],
      expected: `bu_config si.cost-from = ${want.value}`,
      actual: before === want.value
        ? `ตั้งไว้แล้ว = ${want.value} (ตรวจจาก profile/DB ของ ${BU}${def?.code === BU ? "" : ` · BU ตั้งต้นของบัญชีตอนนี้คือ ${def?.code} หน้าจอจึงแสดงค่าของ BU นั้น ไม่ได้ใช้ตรวจ`})`
        : `ก่อน: ${before} → หลัง: ${want.value}`,
      status: "PASS", images,
    });
  },
);
