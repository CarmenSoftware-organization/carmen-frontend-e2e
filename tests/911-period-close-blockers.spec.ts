import type { Page } from "@playwright/test";
import {
  test,
  expect,
  gotoInBu,
  BU,
  SCHEMA,
  PC_USERS,
  apiSend,
  inventoryLocations,
  srIssueWorkflow,
  pcUserId,
  adjustmentTypeId,
  pinBusinessUnit,
  requireScenario,
  shot,
  record,
  prevRecord,
  review,
  getDoc,
  putDoc,
  sql,
  type DocRef,
} from "./helpers/period-close/context";
import { deleteAdjustment } from "./helpers/period-close/docs";
import { startExpectingBlocked } from "./helpers/period-close/period-end";
import { btn } from "./helpers/movement/ui";
import { SCN, PERIOD, L, PX } from "./helpers/period-close/scenarios";
import { authFile } from "./fixtures/auth.paths";

/**
 * Period close · phase 911 — Case 1 ด่าน Start: เอกสารค้างขวาง Start (section 41).
 *
 * TEST BU ว่างจากเอกสาร (data:reset ไม่ seed PR/PO/GRN/CN/SR/SO) เคสนี้จึงสร้างตัวขวางเองผ่าน API ก่อน (createBlockers):
 * SO ร่างลงวันที่ในงวดของ scenario + SR ที่ requestor (gmail) submit ไปค้างที่ขั้น HOD โดยใช้ sr_date_pattern = open-period
 * (วันสุดท้ายของงวด active — ถ้าใช้ today ใบจะตกงวดของวันนี้ ไม่ขวาง Start ของงวดที่ปิด) แล้วทดสอบด่านผ่าน UI:
 * กด Start → dialog → ลบ SO ร่าง (admin) → HOD เลือกทุกรายการ → Reject → Reject ทั้งใบ (reject ตั้ง doc_status = voided)
 * ห้ามกด Start ซ้ำหลังเคลียร์ — ผ่านคือเปิดรอบนับจริง
 *
 * Irreversible? ไม่แตะสถานะงวด (การกด Start ถูกดัก: ไม่มีตัวขวางจริง = ตัด request ทิ้ง ดู startExpectingBlocked)
 *   แต่สร้าง SO/SR ลง TEST BU แล้วลบ/reject ทิ้ง — เอกสารที่ voided ค้างอยู่ใน BU
 * Prerequisites: 910 ผ่านแล้ว · project setup (storageState ของ Admin และ HOD gmail) · E2E_DB_URL · BU มีคลังสำหรับ
 *   ต้นทาง + ปลายทางอย่างน้อย 2 คลัง และ workflow SR ที่มีขั้น Issue
 * Run:  E2E_PERIOD_BU=<BU> bun run test:period-close -- tests/911-period-close-blockers.spec.ts
 *
 * Origin: _movement_play/eop_bf/e2e/specs/05-blockers.spec.ts (sub-case 1.N1) — เดิมใช้ SO/SR ที่ค้างอยู่จริงบน BU เก่า
 */
const CASE = "Case 1 · ด่าน Start";

test.beforeAll(() => requireScenario());

const inList = (ids: string[]) => ids.map((n) => `'${n}'`).join(",");

// เอกสารขวางของรอบนี้ — ถูกเติมโดย createBlockers ในเคส (ห้ามอ่านตอน module load)
let blockers: { soDrafts: DocRef[]; srInProgress: DocRef[] } = { soDrafts: [], srInProgress: [] };

function soDocs() {
  return sql<{ id: string; no: string; st: string }>(`select id, so_no no, doc_status::text st from ${SCHEMA}.tb_stock_out
    where id in (${inList(blockers.soDrafts.map((d) => d.id))}) and deleted_at is null`);
}
function srDocs() {
  return sql<{ id: string; no: string; st: string; stage: string }>(`select id, sr_no no, doc_status::text st, workflow_current_stage stage
    from ${SCHEMA}.tb_store_requisition where id in (${inList(blockers.srInProgress.map((d) => d.id))}) and deleted_at is null order by sr_no`);
}

/**
 * สร้างตัวขวาง Start ผ่าน API: SO ร่างลงวันที่ในงวด + SR ที่ requestor submit ค้างที่ขั้น HOD (วันที่ = วันสุดท้ายของงวด active).
 * รันซ้ำ: ถ้าใบที่จำไว้ใน state ยังค้างอยู่ (ไม่ถูกลบ/ไม่ voided) ใช้ใบเดิม ไม่สร้างเพิ่ม
 */
export async function createBlockers(_page: Page): Promise<{ soDrafts: DocRef[]; srInProgress: DocRef[] }> {
  const saved = getDoc("1.N1-blockers") as unknown as { so?: DocRef[]; sr?: DocRef[] } | undefined;
  if (saved?.so?.length && saved?.sr?.length) {
    const soOk = sql<{ id: string }>(`select id from ${SCHEMA}.tb_stock_out where id in (${inList(saved.so.map((d) => d.id))}) and deleted_at is null and doc_status::text = 'draft'`);
    const srOk = sql<{ id: string }>(`select id from ${SCHEMA}.tb_store_requisition where id in (${inList(saved.sr.map((d) => d.id))}) and deleted_at is null and doc_status::text = 'in_progress'`);
    if (soOk.length === saved.so.length && srOk.length === saved.sr.length) return { soDrafts: saved.so, srInProgress: saved.sr };
  }

  const locs = await inventoryLocations();
  const from = locs.find((l) => l.code === L.code);
  const to = locs.find((l) => l.code !== L.code);
  if (!from || !to) throw new Error(`${BU}: ต้องมีคลัง inventory อย่างน้อย 2 คลัง (ต้นทาง ${L.code} + ปลายทาง) แต่เจอ ${locs.map((l) => l.code).join(", ") || "-"}`);
  const prodId = sql<{ id: string }>(`select id from ${SCHEMA}.tb_product where code = '${PX.code}' and deleted_at is null limit 1`)[0]?.id;
  if (!prodId) throw new Error(`${BU}: ไม่พบสินค้า ${PX.code} — รัน data:reset --bu ${BU} --with-history`);
  const at = `${SCN.case1Date}T05:00:00.000Z`; // กลางวันเวลาไทย วันที่ 15 ของงวด

  // SO ร่าง — admin
  const so = await apiSend("POST", `/api/${BU}/stock-outs`, {
    so_date: at,
    description: `E2E ${PERIOD}: SO ร่างขวาง Start`,
    adjustment_type_id: await adjustmentTypeId("stock_out"),
    location_id: from.id,
    stock_out_detail: { add: [{ product_id: prodId, qty: 1 }] },
  });
  expect(so.status, `สร้าง SO ร่าง ${so.status} ${JSON.stringify(so.body).slice(0, 300)}`).toBeLessThan(300);
  const soId = so.body.data.id as string;
  const [soRow] = sql<{ no: string }>(`select so_no no from ${SCHEMA}.tb_stock_out where id = '${soId}'`);

  // SR — requestor สร้างแล้ว submit ไปค้างที่ขั้น HOD
  const created = await apiSend(
    "POST",
    `/api/${BU}/store-requisitions`,
    {
      stage_role: "create",
      details: {
        sr_date: at,
        expected_date: at,
        description: `E2E ${PERIOD}: SR ค้างขวาง Start`,
        requestor_id: pcUserId("requestor"),
        workflow_id: (await srIssueWorkflow()).id,
        from_location_id: from.id,
        to_location_id: to.id,
        store_requisition_detail: { add: [{ product_id: prodId, requested_qty: 1 }] },
      },
    },
    "requestor",
  );
  expect(created.status, `สร้าง SR ${created.status} ${JSON.stringify(created.body).slice(0, 300)}`).toBeLessThan(300);
  const srId = created.body.data.id as string;
  const get = async () => (await apiSend("GET", `/api/${BU}/store-requisitions/${srId}`, undefined, "requestor")).body.data;
  const draft = await get();
  const lineId = (draft.store_requisition_detail ?? [])[0]?.id;
  const sub = await apiSend(
    "PATCH",
    `/api/${BU}/store-requisitions/${srId}/submit`,
    {
      doc_version: draft.doc_version,
      stage_role: "create",
      sr_date_pattern: "open-period",
      details: [{ id: lineId, stage_status: "submit", stage_message: "" }],
    },
    "requestor",
  );
  expect(sub.status, `submit SR ${sub.status} ${JSON.stringify(sub.body).slice(0, 300)}`).toBeLessThan(300);
  const [srRow] = sql<{ no: string; st: string }>(`select sr_no no, doc_status::text st from ${SCHEMA}.tb_store_requisition where id = '${srId}'`);
  expect(srRow.st, `SR ${srRow.no} ต้องค้างอยู่ (in_progress) ที่ขั้น HOD`).toBe("in_progress");
  // open-period ต้องลงวันที่ในงวดของ scenario จริง (ตรวจ ไม่ได้สมมติ) — เทียบเดือนตามเวลาไทย
  const srDate = (await get()).sr_date as string;
  const srMonth = new Date(new Date(srDate).getTime() + 7 * 3600_000).toISOString().slice(0, 7);
  expect(srMonth, `SR ${srRow.no} sr_date ${srDate} ต้องอยู่ในงวด ${PERIOD} (${SCN.descPeriod})`).toBe(SCN.descPeriod);

  const out = {
    soDrafts: [{ id: soId, no: soRow.no, status: "draft" }],
    srInProgress: [{ id: srId, no: srRow.no, status: "in_progress" }],
  };
  putDoc("1.N1-blockers", { id: "", no: "", status: "created", so: out.soDrafts, sr: out.srInProgress });
  return out;
}

/** HOD: เลือกทุกรายการ → Reject (ใส่เหตุผล) → Reject ทั้งใบ → ยืนยัน */
async function rejectSr(page: Page, id: string, no: string, images: string[]) {
  await gotoInBu(page, `/store-operation/store-requisition/${id}`);
  await page.waitForTimeout(1500);
  images.push(await shot(page, "1.N1", `d-${no}-HOD-เปิดใบ`));
  // หน้าใบเปิดมาเป็นโหมดดู — checkbox ของรายการโผล่หลังกด Edit
  await btn(page, "Edit").first().click();
  await page.waitForTimeout(1000);
  // เลือกทุกแถว: checkbox หัวตาราง (ถ้าเปิด dialog เลือก "ทั้งหมด" ให้กดตัวแรก)
  await page.locator("thead").getByRole("checkbox").first().click();
  const pick = page.locator("[role=dialog]").last();
  if (await pick.isVisible()) await pick.getByRole("button").first().click();
  await btn(page, "Reject").first().click();
  const bulk = page.locator("[role=alertdialog]").last();
  await expect(bulk).toBeVisible();
  for (const box of await bulk.locator("textarea").all()) await box.fill(`E2E ${PERIOD}: เคลียร์ SR ค้างก่อนเริ่มนับ`);
  images.push(await shot(page, "1.N1", `e-${no}-เลือก-Reject-ทุกรายการ`));
  await bulk.getByRole("button", { name: "Reject" }).click();
  await expect(bulk).toBeHidden();
  // ปุ่ม Reject ของทั้งใบอยู่ที่แถบล่าง (โผล่เมื่อทุกรายการถูกตั้งเป็น reject)
  await btn(page, "Reject").last().click();
  const confirm = page.locator("[role=alertdialog]").last();
  await expect(confirm).toBeVisible();
  const done = page.waitForResponse((r) => /\/store-requisitions?\/.*reject/.test(r.url()) && r.request().method() !== "GET", { timeout: 60_000 });
  await confirm.getByRole("button", { name: "Reject" }).click();
  const resp = await done;
  expect(resp.ok(), `reject ${no} ${resp.status()} ${await resp.text()}`).toBe(true);
  await expect.poll(() => srDocs().find((d) => d.no === no)?.st, { timeout: 30_000 }).toBe("voided");
  await gotoInBu(page, `/store-operation/store-requisition/${id}`);
  await page.waitForTimeout(1500);
  images.push(await shot(page, "1.N1", `f-${no}-voided`));
}

test(
  "TC-PE-410001 SR และ SO ที่ค้างอยู่จริงในงวดขวาง Start Period Close แล้วเคลียร์ได้ (HOD reject SR · admin ลบ SO ร่าง)",
  {
    annotation: [
      { type: "preconditions", description: "TEST BU (E2E_PERIOD_BU) ไม่มีเอกสารค้าง — เคสสร้างเองผ่าน API: SO ร่างลงวันที่ในงวด + SR ที่ requestor (gmail) submit ค้างที่ขั้น HOD; Login เป็น Admin (gmail) และมี storageState ของ HOD (gmail) จาก project setup; รอบนับของงวดยังไม่เริ่ม; BU มี ≥ 2 คลัง inventory และ workflow SR ที่มีขั้น Issue" },
      { type: "steps", description: "0. สร้างตัวขวางผ่าน API (createBlockers): SO ร่าง + SR submit ไปขั้น HOD (sr_date_pattern = open-period)\n1. เปิดใบ SR ที่ค้าง (in_progress) ถ่ายภาพ\n2. Period End → Start Period Close → ยืนยัน (POST start-counting ถูกดัก: ถ้าไม่มีตัวขวางจริงจะตัด request ทิ้ง)\n3. ตรวจ dialog \"Finish these documents first\" แล้วกด Close\n4. admin ลบ SO ร่างแต่ละใบ (Delete → ยืนยัน)\n5. HOD (gmail) เปิด SR แต่ละใบ → Edit → เลือกทุกรายการ → Reject (กรอกเหตุผล) → Reject ทั้งใบ → ยืนยัน\n6. GET period-ends/review" },
      { type: "expected", description: "Start ถูกปฏิเสธ 422 และ dialog ลิสต์ SR/SO ทุกใบ; start_blocking.sr ก่อนกด = จำนวน SR ที่ค้าง; reject แล้ว SR มี doc_status = voided; หลังเคลียร์ start_blocking.total = 0" },
      { type: "priority", description: "High" },
      { type: "testType", description: "Negative" },
      { type: "note", description: "เดิม 1.N1 (_movement_play specs/05-blockers) · ผลขั้นกด Start เก็บใน state (1.N1-start) รันซ้ำหลังเคลียร์ไปบางส่วนจะไม่เสียหลักฐานรอบแรก · ผ่านแล้วในรอบก่อน (results.json = PASS) → test.skip แทน return เงียบ ๆ · HOD เข้าระบบด้วย storageState จาก project setup แทน login ผ่านฟอร์ม · ตัวขวางสร้างผ่าน API เพราะ UI สร้าง SR ที่ลงวันที่งวดก่อนไม่ได้ · ทับซ้อน TC-PE-310005 (ชนิดเอกสารค้างหลายชนิด) · ย้อนกลับไม่ได้: ลบ/reject เอกสารจริง" },
    ],
  },
  async ({ page, browser }) => {
    const prev = prevRecord("1.N1");
    test.skip(prev?.status === "PASS", `1.N1 ผ่านแล้วเมื่อ ${prev?.at} — เอกสารค้างถูกเคลียร์ไปแล้ว`);
    const approver = PC_USERS.hod.email;
    blockers = await createBlockers(page);
    const images: string[] = [];
    const so = soDocs().filter((d) => d.st === "draft");
    const sr = srDocs().filter((d) => d.st === "in_progress");

    // ผลของขั้นกด Start เก็บลง state — รันซ้ำหลังเคลียร์ไปบางส่วนแล้วจะได้ไม่เสียหลักฐานรอบแรก
    type StartStep = { counts: Record<string, number>; total: number; listed: { no: string; shown: boolean }[]; note?: string };
    // ผลที่เก็บไว้ใช้ได้เฉพาะเมื่อเป็นของตัวขวางชุดเดียวกัน — createBlockers สร้างชุดใหม่ (เลขใหม่) = ทิ้งของเก่า
    const blockerIds = [...blockers.soDrafts, ...blockers.srInProgress].map((d) => d.id).join(",");
    let start = getDoc("1.N1-start") as unknown as (StartStep & { blockerIds?: string }) | undefined;
    if (start && start.blockerIds !== blockerIds) start = undefined;
    if (!start) {
      const before = await review(BU);
      for (const d of sr) {
        await gotoInBu(page, `/store-operation/store-requisition/${d.id}`);
        await page.waitForTimeout(1500);
        images.push(await shot(page, "1.N1", `a-${d.no}-${d.st}-${d.stage}`));
      }
      const dialog = await startExpectingBlocked(page);
      const dialogText = (await dialog.innerText()).replace(/\s+/g, " ");
      images.push(await shot(page, "1.N1", "b-กด-Start-ถูกบล็อก"));
      await btn(dialog, "Close").last().click();
      start = {
        counts: before.start_blocking.counts, total: before.start_blocking.total,
        listed: [...so, ...sr].map((d) => ({ no: d.no, shown: dialogText.includes(d.no) })),
      };
      putDoc("1.N1-start", { id: "", no: "", status: "done", blockerIds, ...start });
    }
    const listed = start.listed;

    // SO ร่าง — admin ลบเอง
    for (const d of so) {
      await deleteAdjustment(page, "stock-out", d.id);
      images.push(await shot(page, "1.N1", `c-ลบ-${d.no}`));
    }

    // SR — ผู้อนุมัติขั้นปัจจุบันเป็นคน reject (admin ไม่อยู่ใน user_action ของขั้น HOD)
    const projectUse = test.info().project.use;
    const ctx = await browser.newContext({
      baseURL: projectUse.baseURL,
      viewport: projectUse.viewport,
      locale: projectUse.locale,
      timezoneId: projectUse.timezoneId,
      storageState: authFile(approver),
    });
    const hod = await ctx.newPage();
    await pinBusinessUnit(hod, BU);
    for (const d of sr) await rejectSr(hod, d.id, d.no, images);
    await ctx.close();

    const after = await review(BU);
    const srAfter = srDocs();
    const pass =
      (start.counts.sr ?? 0) === blockers.srInProgress.length &&
      listed.every((l) => l.shown) && after.start_blocking.total === 0;
    record({
      id: "1.N1", case: CASE, title: `SR ค้าง (in_progress) ในงวด ${PERIOD} ขวาง Start — ใช้ใบขวางที่สร้างเองบน ${BU}`,
      steps: [
        `ใบขวางที่สร้างผ่าน API: SR ${blockers.srInProgress.map((d) => d.no).join(", ")} (รอ HOD) · SO ร่าง ${blockers.soDrafts.map((d) => d.no).join(", ")}`,
        "Period End → Start Period Close → ยืนยัน",
        `admin ลบ SO ร่าง · HOD (${approver}) เลือกทุกรายการ → Reject → Reject ทั้งใบ`,
      ],
      expected: `Start ถูกปฏิเสธ (422) · dialog ลิสต์ SR ทุกใบ · start_blocking.sr = ${blockers.srInProgress.length} · หลังเคลียร์ total = 0`,
      actual:
        `start_blocking ก่อนกด=${JSON.stringify(start.counts)} total=${start.total}; ` + (start.note ? `${start.note}; ` : "") +
        `dialog: ${listed.map((l) => `${l.no}${l.shown ? "✓" : "✗ไม่แสดง"}`).join(", ")}; ` +
        `SR หลัง reject: ${srAfter.map((d) => `${d.no}=${d.st}`).join(", ")}; หลังเคลียร์ total=${after.start_blocking.total}`,
      status: pass ? "PASS" : "FAIL", docs: [...blockers.soDrafts, ...blockers.srInProgress].map((d) => d.no), images,
    });
    expect(pass, "ดู actual ใน results.json").toBe(true);
  },
);
