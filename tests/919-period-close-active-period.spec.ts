import { test, expect, BU, requireScenario, sql, SCHEMA, record, gatePhase, getDoc, apiSend, srIssueWorkflow, inventoryLocations, pcUserId, adjustmentTypeId } from "./helpers/period-close/context";
import { createCreditNote } from "./helpers/period-close/docs";
import { MOVEMENT_VENDOR } from "./helpers/movement/docs";
import { L, P as PROD, PX, SCN } from "./helpers/period-close/scenarios";

/**
 * Period close · phase 919 — Case A: "the active period only" (backend PR #724,
 * SQL PR #723, micro-report#19). The active period is the OLDEST open/locked
 * period; every decision about "which period are we working in" must use it — not
 * the period today falls in, not the newest open one. Every expected value is
 * computed from that rule (DB), never from the code under test.
 *
 * Built to run on a BU whose active period lags behind today with a later period
 * already open (a TEST BU after `data:reset --bu <BU> --with-history`: active = last
 * month, today in this month). If today falls inside the active period itself, only the
 * controls run: A1 / A9 / A10 (the others skip on that runtime check).
 *
 * Not reversible: posts real documents into the active period (SR rejected
 * afterwards, CNs completed, a committed GRN with an expiry date, a wastage
 * Stock Out); the A6 / A8 probes delete what they created. Does not touch the
 * period status. Independent of the closing round — the original rounds kept their
 * own evidence folder (active-r4-avg / active-r4-fifo), so set E2E_EVIDENCE_DIR.
 * Setup first: phase 910 ran (L holds E2E-PC-1 with stock in the active period — GRN "grnA").
 *
 * Two cases pin known bugs with `test.fail()` (evidence 2026-10-02 r4; A5c / A8 passed on the FIFO TEST BU
 * on 2026-11-24 — their markers are dropped, the cases now assert the correct behaviour):
 *   TC-PE-490009  A9ab — reports lookups current/previous period follow the newest period
 *   TC-PE-490011  A10  — v_inventory_eop_checklist.period follows the newest period
 * Once one turns red ("unexpectedly passed"), drop its marker.
 *
 * Run: E2E_PERIOD_BU=<BU> E2E_EVIDENCE_DIR=runs/period-close/active-<BU> bun run test:period-close -- tests/919-period-close-active-period.spec.ts
 *
 * Origin: _movement_play/eop_bf/e2e/specs/26-active-period.spec.ts
 */

/**
 * Case A · งวด active เท่านั้น (PR #724 · #723 · micro-report#19) — รันบน dev ที่ยังเป็นโค้ดเดิมเพื่อพิสูจน์ว่าผิดจริง
 *
 * กติกา (ผู้ใช้ยืนยัน 2026-10-02): งวด active = งวด open/locked ที่เก่าที่สุด — ทุกการตัดสินว่า "ตอนนี้ทำงานงวดไหน"
 * ใช้งวดนี้เท่านั้น ไม่ใช่งวดของวันนี้ ไม่ใช่งวด open ใหม่สุด · ทุก expected คำนวณจากกติกา (DB) ไม่ได้มาจากโค้ด
 *
 * E2E_PERIOD_BU ใช้แค่เลือก TEST BU (ทุก expected คำนวณจากงวด active ใน DB ไม่ใช่งวดของ scenario):
 *   active ตามหลังวันนี้ (TEST BU หลัง data:reset --with-history: active = เดือนที่แล้ว) → ทุกข้อ
 *   active ตรงกับเดือนนี้ → เฉพาะข้อควบคุม A1 / A9 / A10 (ข้ออื่น skip ด้วยเช็คตอนรัน)
 * เตรียมก่อน: phase 910 ผ่านแล้ว — คลัง L มี E2E-PC-1 จาก GRN ฐาน (grnA) ในงวด active
 */
const CASE = "Case A · งวด active เท่านั้น (#724 · #723 · micro-report#19)";
/** ป้ายต่อท้าย id ใน results.json: FIFO กับที่เหลือ (average / average_per_location = AVG) — อ่านตอนเรียก ไม่อ่านตอน load */
const tag = () => (SCN.method === "fifo" ? "FIFO" : "AVG");
/** สินค้า/คลังที่ใช้ — E2E-PC-1 ที่คลัง L (L ถูกเติมตอน requireScenario จึงต้องอ่านตอนรันเท่านั้น) */
const stock = () => ({ loc: L.code, prod: PROD.P1.code });
const idOf = (table: string, where: string) => sql<{ id: string }>(`select id from ${SCHEMA}.${table} where ${where} limit 1`)[0]?.id;

/** งวด active ตามกติกา + งวดที่วันนี้ตกอยู่ (ใช้บอกว่าโค้ดเดิมหยิบอะไร) */
function periods() {
  const [a] = sql<{ id: string; period: string; s: string; e: string }>(
    `select id, period, start_at::text s, end_at::text e from ${SCHEMA}.tb_inventory_period
     where status in ('open','locked') and deleted_at is null order by fiscal_year, fiscal_month limit 1`,
  );
  const now = new Date();
  const day = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const [t] = sql<{ id: string; period: string }>(
    `select id, period from ${SCHEMA}.tb_inventory_period where deleted_at is null and status in ('open','locked')
     and start_at <= '${new Date(day).toISOString()}' and end_at >= '${new Date(day).toISOString()}' order by start_at desc limit 1`,
  );
  const [prev] = sql<{ period: string }>(
    `select period from ${SCHEMA}.tb_inventory_period where deleted_at is null and start_at < '${a.s}' order by start_at desc limit 1`,
  );
  const inActive = (iso: string | null | undefined) => {
    if (!iso) return false;
    const d = new Date(iso);
    const dd = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    return dd >= Date.parse(a.s) && dd <= Date.parse(a.e);
  };
  return { active: a, today: t, prev: prev?.period ?? null, inActive };
}
/** งวดที่รายการเคลื่อนไหวของเอกสารลงจริง (cost layer) */
const layerPeriodsOf = (docId: string) =>
  sql<{ p: string }>(`select distinct cl.at_period p from ${SCHEMA}.tb_inventory_transaction_cost_layer cl
    join ${SCHEMA}.tb_inventory_transaction_detail td on td.id = cl.inventory_transaction_detail_id
    join ${SCHEMA}.tb_inventory_transaction t on t.id = td.inventory_transaction_id
    where t.inventory_doc_no = '${docId}' and cl.deleted_at is null`).map((r) => r.p);
/** วันนี้อยู่นอกงวด active (มีงวดเปิดอื่นที่ใหม่กว่าครอบวันนี้) — แทนเช็ค BU ตายตัวของเดิม */
const todayOutsideActive = () => {
  const p = periods();
  return Boolean(p.today) && p.today.period !== p.active.period;
};
const day = (iso: string | null | undefined) => (iso ? new Date(iso).toISOString().slice(0, 10) : "(ว่าง)");

test.beforeAll(() => requireScenario());
gatePhase({ db: true });

test(
  "TC-PE-490001 ยอดคงเหลือที่หลังบ้านคืนต้องเป็นยอดของงวด active",
  {
    annotation: [
      {
        type: "preconditions",
        description:
          "E2E_PERIOD_BU เป็น TEST BU (งวด active ตามหลังวันนี้ หรือเท่ากับเดือนนี้ = ตัวควบคุม); คลัง L มี E2E-PC-1 ในงวด active (GRN ฐานของ phase 910)",
      },
      {
        type: "steps",
        description:
          "1. หางวด active (open/locked ที่เก่าที่สุด) จาก tb_inventory_period\n2. รวม in_qty − out_qty ของ cost layer สินค้า/คลังนั้นเฉพาะงวด active ใน DB\n3. GET /products/:id/on-hand?location_id=…\n4. GET /inventory-info/:product/:location",
      },
      {
        type: "expected",
        description: "ยอดในงวด active มากกว่า 0 และทั้ง total_on_hand กับ on_hand_qty เท่ากับยอดของงวด active ใน DB",
      },
      { type: "priority", description: "High" },
      { type: "testType", description: "Functional" },
      {
        type: "note",
        description:
          "เดิม A1 (_movement_play specs/26-active-period) · id ใน results.json = A1-AVG / A1-FIFO ตาม BU · พิสูจน์ backend PR #724 · active-r3-avg FAIL (โค้ดเดิมคืน 0) → active-r4-avg PASS, active-r4-fifo PASS (2026-10-02)",
      },
    ],
  },
  async () => {
    const P = periods();
    const pid = idOf("tb_product", `code = '${stock().prod}'`);
    const lid = idOf("tb_location", `code = '${stock().loc}'`);
    const [db] = sql<{ q: string }>(`select coalesce(sum(in_qty - out_qty), 0) q from ${SCHEMA}.tb_inventory_transaction_cost_layer
      where deleted_at is null and product_id = '${pid}' and location_id = '${lid}' and at_period = '${P.active.period}'`);
    const expected = Number(db.q);
    const onHand = await apiSend("GET", `/api/${BU}/products/${pid}/on-hand?location_id=${lid}`);
    const info = await apiSend("GET", `/api/${BU}/inventory-info/${pid}/${lid}`);
    const got = { onHand: Number(onHand.body?.data?.total_on_hand), info: Number(info.body?.data?.on_hand_qty) };
    const ok = expected > 0 && got.onHand === expected && got.info === expected;
    record({
      id: `A1-${tag()}`,
      case: CASE,
      title: `ยอดคงเหลือ ${stock().prod} ที่ ${stock().loc} — งวด active ${P.active.period} · วันนี้อยู่งวด ${P.today?.period ?? "-"}${todayOutsideActive() ? "" : " (ตัวควบคุม: งวด active = วันนี้)"}`,
      steps: [`GET /products/:id/on-hand?location_id`, `GET /inventory-info/:product/:location`, `เทียบกับผลรวม cost layer ของงวด ${P.active.period} ใน DB`],
      expected: `ทั้งสอง endpoint = ${expected} (ยอดของงวด active ${P.active.period})`,
      actual: `on-hand ${got.onHand} · inventory-info ${got.info} · DB งวด ${P.active.period} = ${expected}`,
      status: ok ? "PASS" : "FAIL",
    });
    expect(ok, JSON.stringify({ expected, got })).toBe(true);
  },
);

test(
  "TC-PE-490002 ใบเบิกที่เลือกลงวันที่วันนี้ (งวดหลัง) ต้องรอจนงวดของมันเป็นงวด active",
  {
    annotation: [
      {
        type: "preconditions",
        description:
          "E2E_PERIOD_BU เป็น TEST BU และวันนี้อยู่ในงวดเปิดที่ใหม่กว่างวด active (ไม่ใช่ = ข้าม); workflow SR ที่มีขั้น Issue (หาจาก stage ด้วย srIssueWorkflow ไม่อิงชื่อ); คลัง inventory ≥ 2 คลัง (L เป็นต้นทาง) สินค้า E2E-PC-X อยู่ที่ L; บัญชี Requestor และ HOD (gmail) อยู่ใน workflow",
      },
      {
        type: "steps",
        description:
          "1. admin POST /store-requisitions (requestor = Requestor gmail): E2E-PC-X 1 หน่วย จากคลัง L → คลัง inventory ถัดไป\n2. admin PATCH …/submit พร้อม sr_date_pattern = today\n3. HOD (gmail) PATCH …/approve ขั้น HOD\n4. admin PATCH …/approve stage_role = issue\n5. เก็บกวาด: reject ใบที่ค้าง",
      },
      {
        type: "expected",
        description:
          "submit และ approve ได้ (HTTP < 300) ใบลงวันที่วันนี้; การจ่ายถูกปฏิเสธ 422 SR_ISSUE_PERIOD_NOT_CURRENT (งวดของใบไม่ใช่งวด active) และใบยังไม่ completed",
      },
      { type: "priority", description: "Medium" },
      { type: "testType", description: "Negative" },
      {
        type: "note",
        description:
          "เดิม A4 (_movement_play specs/26-active-period) · ตัวควบคุม — เกือบซ้ำกับ TC-PE-470004 (เดิม 5.4 ใน 24-new-rules) ตั้งใจคงไว้: ข้อนี้เป็นของชุดงวด active ส่วน 5.4 เป็นของรอบปิดงวด · ผลล่าสุด active-r4-avg 2026-10-02 PASS",
      },
    ],
  },
  async () => {
    test.skip(!todayOutsideActive(), "ต้องการ BU ที่วันนี้อยู่นอกงวด active");
    const P = periods();
    const get = async (id: string) => (await apiSend("GET", `/api/${BU}/store-requisitions/${id}`)).body.data;
    const lineOf = (d: any) => (d.store_requisition_detail ?? d.tb_store_requisition_detail ?? [])[0]?.id;
    const requestor = pcUserId("requestor");
    const locs = await inventoryLocations();
    const from = locs.find((l) => l.code === L.code);
    const to = locs.find((l) => l.code !== L.code);
    expect(from && to, `${BU}: ต้องมีคลัง inventory อย่างน้อย 2 คลัง (เจอ ${locs.map((l) => l.code).join(", ") || "-"})`).toBeTruthy();
    const now = new Date().toISOString();
    const created = await apiSend("POST", `/api/${BU}/store-requisitions`, {
      stage_role: "create",
      details: {
        sr_date: now,
        expected_date: now,
        description: "E2E A4 today pattern",
        requestor_id: requestor,
        workflow_id: (await srIssueWorkflow()).id,
        from_location_id: from!.id,
        to_location_id: to!.id,
        store_requisition_detail: { add: [{ product_id: idOf("tb_product", `code = '${PX.code}'`), requested_qty: 1 }] },
      },
    });
    expect(created.status, JSON.stringify(created.body)).toBeLessThan(300);
    const id = created.body.data.id as string;
    let d = await get(id);
    const sub = await apiSend("PATCH", `/api/${BU}/store-requisitions/${id}/submit`, {
      doc_version: d.doc_version,
      stage_role: "create",
      sr_date_pattern: "today",
      details: [{ id: lineOf(d), stage_status: "submit", stage_message: "" }],
    });
    d = await get(id);
    const app = await apiSend(
      "PATCH",
      `/api/${BU}/store-requisitions/${id}/approve`,
      { doc_version: d.doc_version, stage_role: "approve", details: [{ id: lineOf(d), stage_status: "approve", stage_message: "", approved_qty: 1 }] },
      "purchase", // TEST BU: ขั้น Store Approval ของ workflow SR มอบให้บัญชี Purchase
    );
    d = await get(id);
    const issue = await apiSend("PATCH", `/api/${BU}/store-requisitions/${id}/approve`, {
      doc_version: d.doc_version,
      stage_role: "issue",
      details: [{ id: lineOf(d), stage_status: "approve", stage_message: "", issued_qty: 1 }],
    });
    d = await get(id);
    const params = issue.body?.error?.params ?? issue.body?.params ?? {};
    const ok =
      sub.status < 300 && day(d.sr_date) === now.slice(0, 10) && app.status < 300 &&
      issue.status === 422 && issue.appCode === "SR_ISSUE_PERIOD_NOT_CURRENT" && d.doc_status !== "completed";
    record({
      id: "A4",
      case: CASE,
      title: `ใบเบิก ${d.sr_no} เลือก "today" ตอน submit (วันนี้อยู่ ${P.today?.period}) — ตัวควบคุม`,
      steps: [`admin สร้างใบเบิก ${PX.code} ${from!.code} → ${to!.code}`, `submit พร้อม sr_date_pattern = today`, "hod อนุมัติ", "admin กดจ่าย"],
      expected: `ลงวันที่วันนี้ (งวด ${P.today?.period}) · อนุมัติได้ · จ่ายถูกปฏิเสธ 422 SR_ISSUE_PERIOD_NOT_CURRENT เพราะงวดของใบไม่ใช่งวด active ${P.active.period}`,
      actual: `submit ${sub.status}${sub.appCode ? " " + sub.appCode : ""} · sr_date ${day(d.sr_date)} · approve ${app.status} · issue ${issue.status} ${issue.appCode} ${JSON.stringify(params)} · สถานะ ${d.doc_status} ขั้น ${d.workflow_current_stage}`,
      status: ok ? "PASS" : "FAIL",
      docs: [d.sr_no],
    });
    if (d.doc_status !== "completed" && d.doc_status !== "rejected") {
      const r = await apiSend(
        "PATCH",
        `/api/${BU}/store-requisitions/${id}/reject`,
        {
          doc_version: d.doc_version,
          stage_role: d.workflow_current_stage === "Issue" ? "issue" : "approve",
          details: [{ id: lineOf(d), stage_status: "reject", stage_message: "E2E A4 เก็บกวาด" }],
        },
        d.workflow_current_stage === "Issue" ? undefined : "purchase",
      );
      console.log(`A4 cleanup reject → ${r.status} ${r.appCode}`);
    }
    expect(ok, `submit ${sub.status} · sr_date ${day(d.sr_date)} · approve ${app.status} · issue ${issue.status} ${issue.appCode} · ${d.doc_status}`).toBe(true);
  },
);

/** ใบรับที่ใช้อ้างในใบลดหนี้ — ใบรับแรกที่ A7 ตั้งต้นไว้ (มี E2E-PC-1 ที่คลัง L) ถ้ายังไม่มีใช้ GRN ฐานของ 910 (grnA) */
const A5_GRN = () => {
  const no =
    sql<{ no: string }>(`select grn_no no from ${SCHEMA}.tb_good_received_note where description like 'E2E A7 expiring%'
      and deleted_at is null order by created_at limit 1`)[0]?.no ?? getDoc(SCN.receipts[0].key)?.no;
  if (!no) throw new Error("ไม่มีใบรับให้ใบลดหนี้อ้าง — รัน phase 910 (GRN ฐาน) ก่อน หรือรัน TC-PE-490007");
  return no;
};

test(
  "TC-PE-490003 ใบลดหนี้ลงวันที่วันนี้ (นอกงวด active) ต้องถูกปฏิเสธไม่ลงบัญชี",
  {
    annotation: [
      {
        type: "preconditions",
        description:
          "E2E_PERIOD_BU เป็น TEST BU และวันนี้อยู่นอกงวด active (ไม่ใช่ = ข้าม); Login เป็น Admin (gmail, project setup); มีใบรับ committed ที่มี E2E-PC-1 ที่คลัง L (ใบรับ \"E2E A7 expiring …\" ของ TC-PE-490007 จากรอบก่อน หรือ GRN260600001)",
      },
      {
        type: "steps",
        description:
          "1. เปิด Credit Note → New ผ่านหน้าจอ อ้างใบรับนั้น คืน E2E-PC-1 1 หน่วย\n2. Doc Date และ Tax Invoice Date = วันนี้ (เวลาไทย)\n3. กด Create แล้ว Submit\n4. ถ้ามีใบ: อ่านสถานะ, cn_date และงวดที่ cost layer ลง",
      },
      {
        type: "expected",
        description:
          "หลังบ้านปฏิเสธด้วย CREDIT_NOTE_DATE_NOT_CURRENT_PERIOD (ตอนสร้างหรือตอน submit) และไม่มีใบ completed ที่ลงวันที่นอกงวด active — วันที่บนเอกสารกับงวดบัญชีต้องตรงกันเสมอ",
      },
      { type: "priority", description: "High" },
      { type: "testType", description: "Negative" },
      {
        type: "note",
        description:
          "เดิม A5 (_movement_play specs/26-active-period) · พิสูจน์ backend PR #724 · เกือบซ้ำกับ TC-PE-440005 (เดิม 2.4 ใน 20-case2: CN ลงวันที่งวดหน้าต้องถูกปฏิเสธ) ตั้งใจคงไว้: ข้อนี้ใช้วันนี้ซึ่งอยู่ในงวดที่สร้างล่วงหน้า · ล้มด้วยเหตุอื่นที่ไม่ใช่เรื่องงวด = FAIL · active-r3-avg FAIL → active-r4-avg PASS (2026-10-02)",
      },
    ],
  },
  async ({ page }) => {
    test.skip(!todayOutsideActive(), "ต้องการ BU ที่วันนี้อยู่นอกงวด active");
    test.setTimeout(5 * 60_000);
    const P = periods();
    const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
    const [prod] = sql<{ name: string }>(`select name from ${SCHEMA}.tb_product where code = '${stock().prod}'`);
    let created: { id: string; no: string } | null = null;
    let error = "";
    try {
      await createCreditNote(page, {
        grnNo: A5_GRN(),
        docDate: today,
        taxInvoiceNo: `E2E-A5-${Date.now()}`,
        bu: BU,
        lines: [{ productName: prod.name, qty: 1 }],
        status: "completed",
        onCreated: (d) => {
          created = { id: d.id, no: d.no };
        },
      });
    } catch (e) {
      // คาดว่าจะล้ม — ข้อความ error คือหลักฐาน (ตรวจรหัสด้านล่าง)
      error = (e as Error).message.replace(/\s+/g, " ").slice(0, 300);
    }
    const cn = created as { id: string; no: string } | null;
    const row = cn
      ? sql<{ cn_date: string; st: string }>(`select cn_date::text cn_date, doc_status::text st from ${SCHEMA}.tb_credit_note where id = '${cn.id}'`)[0]
      : undefined;
    const layers = cn ? layerPeriodsOf(cn.id) : [];
    const postedOutside = !!row && row.st === "completed" && !P.inActive(row.cn_date);
    // ผ่านได้ทางเดียว: หลังบ้านปฏิเสธด้วยเหตุเรื่องงวด (ตอนสร้างหรือตอน submit) — ล้มด้วยเหตุอื่น = ไม่ได้พิสูจน์อะไร นับเป็น FAIL
    const refusedForPeriod = /CREDIT_NOTE_DATE_NOT_CURRENT_PERIOD/.test(error) && !postedOutside;
    record({
      id: "A5",
      case: CASE,
      title: `ใบลดหนี้ลงวันที่ ${today} (งวด ${P.today?.period}) ขณะที่งวด active คือ ${P.active.period}`,
      steps: [`admin สร้างใบลดหนี้ผ่านหน้าจอ อ้าง ${A5_GRN()} คืน 1 หน่วย`, `Doc Date ${today}`, "Create → Submit"],
      expected: `ถูกปฏิเสธ (CREDIT_NOTE_DATE_NOT_CURRENT_PERIOD) — ใบลดหนี้ลงวันที่ได้เฉพาะในงวด active ${P.active.period} ไม่มีทางที่วันที่บนเอกสารอยู่งวดหนึ่งแต่ลงบัญชีอีกงวด`,
      actual: `${cn ? `${cn.no} · สถานะ ${row?.st} · cn_date ${day(row?.cn_date)} · ลงบัญชีงวด ${layers.join(",") || "-"}` : "ไม่มีใบ"}${error ? ` · error: ${error}` : ""}`,
      status: refusedForPeriod ? "PASS" : "FAIL",
      docs: cn ? [cn.no] : [],
    });
    expect(refusedForPeriod, `ใบลดหนี้ลงวันที่นอกงวด active — ${row?.st ?? "ไม่มีใบ"} ลงบัญชีงวด ${layers.join(",") || "-"} ${error}`).toBe(true);
  },
);

test(
  "TC-PE-490004 ใบลดหนี้ลงวันที่ในงวด active ยังสร้างและลงบัญชีได้ตามปกติ",
  {
    annotation: [
      {
        type: "preconditions",
        description:
          "E2E_PERIOD_BU เป็น TEST BU ที่วันนี้อยู่นอกงวด active (ไม่ใช่ = ข้าม); Login เป็น Admin (gmail, project setup); มีใบรับ committed ที่มี E2E-PC-1 ที่คลัง L และยังคืนได้",
      },
      {
        type: "steps",
        description:
          "1. เปิด Credit Note → New ผ่านหน้าจอ อ้างใบรับเดียวกับ TC-PE-490003 คืน E2E-PC-1 1 หน่วย\n2. Doc Date และ Tax Invoice Date = วันที่ 20 ของงวด active\n3. กด Create แล้ว Submit\n4. อ่านสถานะ, cn_date และงวดที่ cost layer ลง",
      },
      {
        type: "expected",
        description: "ใบเป็น completed, cn_date อยู่ในงวด active และ cost layer ทุกแถวลงงวด active — ด่านใหม่ต้องไม่กันเกิน",
      },
      { type: "priority", description: "High" },
      { type: "testType", description: "Happy Path" },
      {
        type: "note",
        description:
          "เดิม A5b (_movement_play specs/26-active-period) · ตัวคุมฝั่งบวกของด่าน #724 · ผลล่าสุด active-r4-avg 2026-10-02 PASS",
      },
    ],
  },
  async ({ page }) => {
    test.skip(!todayOutsideActive(), "ต้องการ BU ที่วันนี้อยู่นอกงวด active");
    test.setTimeout(5 * 60_000);
    const P = periods();
    const docDate = P.active.e.slice(0, 8) + "20";
    const [prod] = sql<{ name: string }>(`select name from ${SCHEMA}.tb_product where code = '${stock().prod}'`);
    let created: { id: string; no: string } | null = null;
    let error = "";
    try {
      await createCreditNote(page, {
        grnNo: A5_GRN(),
        docDate,
        taxInvoiceNo: `E2E-A5b-${Date.now()}`,
        bu: BU,
        lines: [{ productName: prod.name, qty: 1 }],
        status: "completed",
        onCreated: (d) => {
          created = { id: d.id, no: d.no };
        },
      });
    } catch (e) {
      // เก็บข้อความไว้เป็นหลักฐาน — เคสยังล้มที่ expect ด้านล่าง
      error = (e as Error).message.replace(/\s+/g, " ").slice(0, 300);
    }
    const cn = created as { id: string; no: string } | null;
    const row = cn ? sql<{ cn_date: string; st: string }>(`select cn_date::text cn_date, doc_status::text st from ${SCHEMA}.tb_credit_note where id = '${cn.id}'`)[0] : undefined;
    const layers = cn ? layerPeriodsOf(cn.id) : [];
    const ok = row?.st === "completed" && P.inActive(row.cn_date) && layers.length > 0 && layers.every((p) => p === P.active.period);
    record({
      id: "A5b",
      case: CASE,
      title: `ใบลดหนี้ลงวันที่ ${docDate} (ในงวด active ${P.active.period})`,
      steps: [`admin สร้างใบลดหนี้ผ่านหน้าจอ อ้าง ${A5_GRN()} คืน 1 หน่วย`, `Doc Date ${docDate}`, "Create → Submit"],
      expected: `completed และลงบัญชีงวด ${P.active.period}`,
      actual: `${cn ? `${cn.no} · ${row?.st} · cn_date ${day(row?.cn_date)} · ลงบัญชีงวด ${layers.join(",") || "-"}` : "ไม่มีใบ"}${error ? ` · error: ${error}` : ""}`,
      status: ok ? "PASS" : "FAIL",
      docs: cn ? [cn.no] : [],
    });
    expect(ok, error).toBe(true);
  },
);

// ขอบงวด: งวดเก็บ start_at เป็น 17:00Z ของวันก่อน (= เที่ยงคืนเวลาไทย) และหน้าจอส่งวันที่เป็นเที่ยงคืนเวลาไทยเหมือนกัน
// วันแรกของงวดตามปฏิทินไทยต้องอยู่ในงวด — ตรวจทั้งใบลดหนี้ (ด่านใหม่ #724)
test(
  "TC-PE-490005 ใบลดหนี้ลงวันที่วันแรกของงวด active (เวลาไทย) ต้องสร้างได้",
  {
    annotation: [
      {
        type: "preconditions",
        description:
          "E2E_PERIOD_BU เป็น TEST BU ที่วันนี้อยู่นอกงวด active (ไม่ใช่ = ข้าม); Login เป็น Admin (gmail, project setup); มีใบรับ saved/committed ที่มี E2E-PC-2 และยังไม่เคยถูกคืนสินค้านี้",
      },
      {
        type: "steps",
        description:
          "1. หาใบรับล่าสุดที่มี E2E-PC-2 และยังไม่มีใบลดหนี้ของสินค้านี้\n2. เปิด Credit Note → New ผ่านหน้าจอ อ้างใบรับนั้น คืน E2E-PC-2 1\n3. Doc Date และ Tax Invoice Date = วันที่ 1 ของงวด active (เลือกจากปฏิทิน)\n4. กด Create แล้ว Submit\n5. อ่านสถานะและงวดที่ cost layer ลง",
      },
      {
        type: "expected",
        description:
          "ใบเป็น completed และ cost layer ทุกแถวลงงวด active — วันที่ 1 ตามปฏิทินไทยอยู่ในงวดนี้ (งวดเก็บ start_at เป็น 17:00Z ของวันก่อน)",
      },
      { type: "priority", description: "Medium" },
      { type: "testType", description: "Edge Case" },
      {
        type: "note",
        description:
          "เดิม A5c (_movement_play specs/26-active-period) · บั๊กที่รู้อยู่ (test.fail): ผลล่าสุด active-r4-avg 2026-10-02T15:31Z FAIL — ด่านใหม่ของ #724 ตอบ 422 CREDIT_NOTE_DATE_NOT_CURRENT_PERIOD กับวันที่ 1 ของงวด (ขอบ start_at 17:00Z ของวันก่อน) · ถ้าขึ้น \"unexpectedly passed\" ให้เอา test.fail ออก",
      },
    ],
  },
  async ({ page }) => {
    test.skip(!todayOutsideActive(), "ต้องการ BU ที่วันนี้อยู่นอกงวด active");
    test.setTimeout(5 * 60_000);
    const P = periods();
    const docDate = P.active.e.slice(0, 8) + "01";
    const [prod] = sql<{ name: string }>(`select name from ${SCHEMA}.tb_product where code = '${PROD.P2.code}'`);
    const grn = sql<{ no: string }>(`select g.grn_no no from ${SCHEMA}.tb_good_received_note g
      join ${SCHEMA}.tb_good_received_note_detail d on d.good_received_note_id = g.id
      where g.deleted_at is null and g.doc_status in ('saved','committed') and d.product_code = '${PROD.P2.code}'
      and not exists (select 1 from ${SCHEMA}.tb_credit_note_detail cd join ${SCHEMA}.tb_credit_note c on c.id = cd.credit_note_id
        where c.grn_id = g.id and cd.product_id = d.product_id and c.deleted_at is null and c.doc_status::text not in ('cancelled','voided'))
      order by g.grn_date desc limit 1`)[0]?.no;
    let created: { id: string; no: string } | null = null;
    let error = "";
    try {
      await createCreditNote(page, {
        grnNo: grn,
        docDate,
        taxInvoiceNo: `E2E-A5c-${Date.now()}`,
        bu: BU,
        lines: [{ productName: prod.name, qty: 1 }],
        status: "completed",
        onCreated: (d) => {
          created = { id: d.id, no: d.no };
        },
      });
    } catch (e) {
      // เก็บข้อความไว้เป็นหลักฐาน — เคสยังล้มที่ expect ด้านล่าง
      error = (e as Error).message.replace(/\s+/g, " ").slice(0, 300);
    }
    const cn = created as { id: string; no: string } | null;
    const row = cn ? sql<{ cn_date: string; st: string }>(`select cn_date::text cn_date, doc_status::text st from ${SCHEMA}.tb_credit_note where id = '${cn.id}'`)[0] : undefined;
    const layers = cn ? layerPeriodsOf(cn.id) : [];
    const ok = row?.st === "completed" && layers.length > 0 && layers.every((p) => p === P.active.period);
    record({
      id: "A5c",
      case: CASE,
      title: `ใบลดหนี้ลงวันที่ ${docDate} = วันแรกของงวด active ${P.active.period} (เวลาไทย)`,
      steps: [`admin สร้างใบลดหนี้ผ่านหน้าจอ อ้าง ${grn} คืน ${prod.name} 1`, `Doc Date ${docDate} (เลือกจากปฏิทิน)`, "Create → Submit"],
      expected: `completed และลงบัญชีงวด ${P.active.period} — วันที่ 1 ตามปฏิทินไทยอยู่ในงวดนี้`,
      actual: `${cn ? `${cn.no} · ${row?.st} · cn_date (DB) ${row?.cn_date} · ลงบัญชีงวด ${layers.join(",") || "-"}` : "ไม่มีใบ"}${error ? ` · error: ${error}` : ""}`,
      status: ok ? "PASS" : "FAIL",
      docs: cn ? [cn.no] : [],
    });
    expect(ok, error).toBe(true);
  },
);

test(
  "TC-PE-490006 สร้างรอบนับ (physical count period) ได้เฉพาะงวด active",
  {
    annotation: [
      {
        type: "preconditions",
        description:
          "E2E_PERIOD_BU เป็น TEST BU ที่มีงวดเปิดล่วงหน้าครอบวันนี้ (ไม่ใช่งวด active) (ไม่ใช่ = ข้าม)",
      },
      {
        type: "steps",
        description:
          "1. หางวดที่วันนี้ตกอยู่ (ไม่ใช่งวด active)\n2. POST /physical-count-periods { period_id: งวดนั้น } — หน้าจอไม่ได้เรียก endpoint นี้\n3. ถ้าสร้างได้: DELETE รอบนับนั้นทิ้ง (เก็บกวาด)",
      },
      {
        type: "expected",
        description: "ถูกปฏิเสธ HTTP ≥ 400 (\"Period is not the active period\") — รอบนับเป็นของงวดที่กำลังทำงานเท่านั้น",
      },
      { type: "priority", description: "Medium" },
      { type: "testType", description: "Negative" },
      {
        type: "note",
        description:
          "เดิม A6 (_movement_play specs/26-active-period) · พิสูจน์ backend PR #724 · ยิง API อย่างเดียว · active-r3-avg FAIL (สร้างได้) → active-r4-avg PASS 400 (2026-10-02)",
      },
    ],
  },
  async () => {
    test.skip(!todayOutsideActive(), "ต้องการ BU ที่มีงวดเปิดล่วงหน้าที่ไม่ใช่งวด active");
    const P = periods();
    const r = await apiSend("POST", `/api/${BU}/physical-count-periods`, { period_id: P.today!.id });
    const id = r.body?.data?.id as string | undefined;
    record({
      id: "A6",
      case: CASE,
      title: `POST physical-count-periods งวด ${P.today?.period} (ไม่ใช่งวด active ${P.active.period})`,
      steps: [`POST /physical-count-periods { period_id: งวด ${P.today?.period} } — หน้าจอไม่ได้เรียก endpoint นี้ (ยิง API)`],
      expected: "ถูกปฏิเสธ — รอบนับเป็นของงวดที่กำลังทำงานเท่านั้น",
      actual: `${r.status} ${r.appCode || ""} ${id ? `สร้างได้ id ${id.slice(0, 8)}` : JSON.stringify(r.body?.error ?? r.body).slice(0, 200)}`,
      status: r.status >= 400 ? "PASS" : "FAIL",
    });
    if (id) console.log(`A6 cleanup delete → ${(await apiSend("DELETE", `/api/${BU}/physical-count-periods/${id}`)).status}`);
    expect(r.status).toBeGreaterThanOrEqual(400);
  },
);

test(
  "TC-PE-490007 ตัดของเสียไม่ส่งวันที่ ใบจ่ายออกต้องลงวันที่และลงบัญชีในงวด active",
  {
    annotation: [
      {
        type: "preconditions",
        description:
          "E2E_PERIOD_BU เป็น TEST BU และวันนี้อยู่นอกงวด active (ไม่ใช่ = ข้าม); ผู้ขาย (MOVEMENT_VENDOR), สกุลเงิน THB, ประเภทปรับปรุง stock_out ที่ใช้งานได้ และคลัง L มีอยู่",
      },
      {
        type: "steps",
        description:
          "1. ตั้งต้น (ครั้งแรกของงวด active): POST /good-received-notes ลงวันที่ 20 ของงวด active ที่คลัง L: E2E-PC-1 3 หน่วย @10 มีวันหมดอายุ (หน้าจอใส่วันหมดอายุไม่ได้) → save → commit\n2. POST /wastage-reporting ตัด 1 หน่วยจากบรรทัดของใบรับนั้น โดยไม่ส่ง so_date — ไม่มีหน้าจอเรียก\n3. อ่าน Stock Out ที่เกิดขึ้น (so_date, สถานะ) และงวดที่ cost layer ลง",
      },
      {
        type: "expected",
        description:
          "POST สำเร็จ (HTTP < 300) มี Stock Out เกิดขึ้น ลงวันที่ในงวด active และ cost layer ทุกแถวลงงวด active — วันที่บนเอกสารกับงวดบัญชีตรงกัน",
      },
      { type: "priority", description: "Medium" },
      { type: "testType", description: "Functional" },
      {
        type: "note",
        description:
          "เดิม A7 (_movement_play specs/26-active-period) · พิสูจน์ backend PR #724 · ยิง API อย่างเดียว · ใบรับที่ตั้งต้นไว้ถูกใช้ต่อใน TC-PE-490003/490004 (รอบถัดไป) · active-r3-avg FAIL (ลงวันนี้แต่ลงบัญชีงวด active) → active-r4-avg PASS (2026-10-02)",
      },
    ],
  },
  async () => {
    test.skip(!todayOutsideActive(), "ต้องการ BU ที่วันนี้อยู่นอกงวด active");
    const P = periods();
    const grnDate = P.active.e.slice(0, 8) + "20T03:00:00.000Z"; // วันที่ 20 ของงวด active
    const setup: string[] = [];
    // ตั้งต้น: write-off รับเฉพาะบรรทัดของใบรับที่ committed และมีวันหมดอายุ — ใบรับจากหน้าจอใส่วันหมดอายุไม่ได้ จึงยิง API
    const A7_DESC = `E2E A7 expiring ${P.active.period}`;
    let grnId = sql<{ id: string }>(`select id from ${SCHEMA}.tb_good_received_note where description = '${A7_DESC}' and deleted_at is null limit 1`)[0]?.id;
    if (!grnId) {
      const pid = idOf("tb_product", `code = '${stock().prod}'`);
      const unit = sql<{ u: string }>(`select inventory_unit_id u from ${SCHEMA}.tb_product where id = '${pid}'`)[0].u;
      const g = await apiSend("POST", `/api/${BU}/good-received-notes`, {
        doc_type: "manual",
        grn_date: grnDate,
        invoice_no: `INV-A7-${Date.now()}`,
        invoice_date: grnDate,
        description: A7_DESC,
        received_by_id: pcUserId("admin"),
        vendor_id: idOf("tb_vendor", `code = '${MOVEMENT_VENDOR}'`),
        currency_id: idOf("tb_currency", "code = 'THB' and deleted_at is null"),
        exchange_rate: 1,
        good_received_note_detail: {
          add: [
            {
              product_id: pid,
              location_id: idOf("tb_location", `code = '${stock().loc}'`),
              received_qty: 3,
              received_unit_id: unit,
              received_base_qty: 3,
              order_price: 10,
              received_price: 10,
              foc_qty: 0,
              net_amount: 30,
              base_net_amount: 30,
              expired_at: P.active.e.slice(0, 8) + "28T00:00:00.000Z",
            },
          ],
        },
      });
      expect(g.status, `create GRN ${JSON.stringify(g.body).slice(0, 300)}`).toBeLessThan(300);
      grnId = g.body.data.id as string;
      for (const step of ["save", "commit"]) {
        const d = (await apiSend("GET", `/api/${BU}/good-received-notes/${grnId}`)).body.data;
        const r = await apiSend("PATCH", `/api/${BU}/good-received-notes/${grnId}/${step}`, { doc_version: d.doc_version ?? 0 });
        setup.push(`${step} ${r.status}${r.appCode ? " " + r.appCode : ""}`);
        expect(r.status, `${step} ${JSON.stringify(r.body).slice(0, 300)}`).toBeLessThan(300);
      }
    }
    const [g] = sql<{ no: string; item: string }>(`select g.grn_no no, i.id item from ${SCHEMA}.tb_good_received_note g
      join ${SCHEMA}.tb_good_received_note_detail d on d.good_received_note_id = g.id
      join ${SCHEMA}.tb_good_received_note_detail_item i on i.good_received_note_detail_id = d.id where g.id = '${grnId}'`);
    const r = await apiSend("POST", `/api/${BU}/wastage-reporting`, {
      adjustment_type_id: await adjustmentTypeId("stock_out"),
      description: "E2E A7 write-off no date",
      items: [{ grn_detail_item_id: g.item, qty: 1 }],
    });
    const [so] = sql<{ id: string; so_no: string; so_date: string; st: string }>(`select id, so_no, so_date::text so_date, doc_status::text st
      from ${SCHEMA}.tb_stock_out where description = 'E2E A7 write-off no date' and deleted_at is null order by created_at desc limit 1`);
    const layers = so ? layerPeriodsOf(so.id) : [];
    const ok = r.status < 300 && !!so && P.inActive(so.so_date) && layers.every((p) => p === P.active.period);
    record({
      id: "A7",
      case: CASE,
      title: `write-off ไม่ส่ง so_date — งวด active ${P.active.period} · วันนี้อยู่ ${P.today?.period}`,
      steps: [
        `ตั้งต้น (API): ใบรับ ${g.no} ลงวันที่ ${grnDate.slice(0, 10)} ${stock().prod} 3 หน่วย มีวันหมดอายุ → save → commit${setup.length ? ` (${setup.join(", ")})` : ""}`,
        `POST /wastage-reporting (ไม่มีหน้าจอเรียก) ตัด 1 หน่วยจาก ${g.no} ไม่ส่ง so_date`,
      ],
      expected: `ใบจ่ายออกลงวันที่ในงวด active ${P.active.period} และลงบัญชีงวด ${P.active.period} (วันที่บนเอกสารกับงวดบัญชีตรงกัน)`,
      actual: `${r.status} ${r.appCode || ""} · ${so ? `${so.so_no} · ${so.st} · so_date ${day(so.so_date)} · ลงบัญชีงวด ${layers.join(",") || "-"}` : "ไม่มีใบ"}`,
      status: ok ? "PASS" : "FAIL",
      docs: so ? [g.no, so.so_no] : [g.no],
    });
    expect(ok, `${r.status} ${r.appCode} · so_date ${day(so?.so_date)} · ลงบัญชีงวด ${layers.join(",") || "-"}`).toBe(true);
  },
);

test(
  "TC-PE-490008 สร้าง Stock Out / Stock In ไม่ส่งวันที่ ค่าเริ่มต้นต้องอยู่ในงวด active",
  {
    annotation: [
      {
        type: "preconditions",
        description:
          "E2E_PERIOD_BU เป็น TEST BU และวันนี้อยู่นอกงวด active (ไม่ใช่ = ข้าม); ประเภทปรับปรุง stock_out / stock_in ที่ใช้งานได้ และคลัง L มีอยู่",
      },
      {
        type: "steps",
        description:
          "1. POST /stock-outs ที่คลัง L: E2E-PC-1 1 หน่วย โดยไม่ส่ง so_date\n2. POST /stock-ins ที่คลัง L: E2E-PC-1 1 หน่วย @10 โดยไม่ส่ง si_date\n3. อ่าน so_date / si_date ที่เก็บจาก DB\n4. ลบทั้งสองใบทิ้ง (เก็บกวาด)",
      },
      {
        type: "expected",
        description: "สร้างได้ทั้งสองใบ (HTTP < 300) และวันที่ที่ระบบเติมให้อยู่ในงวด active",
      },
      { type: "priority", description: "Low" },
      { type: "testType", description: "Edge Case" },
      {
        type: "note",
        description:
          "เดิม A8 (_movement_play specs/26-active-period) · id ใน results.json = A8-SO / A8-SI · หน้าจอส่งวันที่เสมอ — เคสนี้ API อย่างเดียว · บั๊กที่รู้อยู่ (test.fail): ผลล่าสุด active-r4-avg 2026-10-02T15:30Z FAIL ทั้งคู่ — สร้างได้ 201 แต่ไม่มีวันที่เลย (r3 ก่อน #724: SO 422 / SI commit ไม่ได้) · ถ้าขึ้น \"unexpectedly passed\" ให้เอา test.fail ออก",
      },
    ],
  },
  async () => {
    test.skip(!todayOutsideActive(), "ต้องการ BU ที่วันนี้อยู่นอกงวด active");
    const P = periods();
    const lid = idOf("tb_location", `code = '${stock().loc}'`);
    const pid = idOf("tb_product", `code = '${stock().prod}'`);
    const so = await apiSend("POST", `/api/${BU}/stock-outs`, {
      description: "E2E A8 SO no date",
      adjustment_type_id: await adjustmentTypeId("stock_out"),
      location_id: lid,
      stock_out_detail: { add: [{ product_id: pid, qty: 1 }] },
    });
    const si = await apiSend("POST", `/api/${BU}/stock-ins`, {
      description: "E2E A8 SI no date",
      adjustment_type_id: await adjustmentTypeId("stock_in"),
      location_id: lid,
      stock_in_detail: { add: [{ product_id: pid, qty: 1, cost_per_unit: 10, total_cost: 10 }] },
    });
    const soId = so.body?.data?.id as string | undefined;
    const siId = si.body?.data?.id as string | undefined;
    const soRow = soId ? sql<{ d: string; no: string }>(`select so_date::text d, so_no no from ${SCHEMA}.tb_stock_out where id = '${soId}'`)[0] : undefined;
    const siRow = siId ? sql<{ d: string; no: string }>(`select si_date::text d, si_no no from ${SCHEMA}.tb_stock_in where id = '${siId}'`)[0] : undefined;
    const okSo = so.status < 300 && P.inActive(soRow?.d);
    const okSi = si.status < 300 && P.inActive(siRow?.d);
    for (const [id, label, ok, r, row] of [
      ["A8-SO", "Stock Out", okSo, so, soRow],
      ["A8-SI", "Stock In", okSi, si, siRow],
    ] as const) {
      record({
        id,
        case: CASE,
        title: `สร้าง ${label} ผ่าน API โดยไม่ส่งวันที่ — งวด active ${P.active.period} · วันนี้อยู่ ${P.today?.period}`,
        steps: [`POST /${label === "Stock Out" ? "stock-outs" : "stock-ins"} ไม่ส่ง ${label === "Stock Out" ? "so_date" : "si_date"} (หน้าจอส่งวันที่เสมอ — เคสนี้ API อย่างเดียว)`],
        expected: `สร้างได้ และวันที่ที่ระบบเติมให้อยู่ในงวด active ${P.active.period}`,
        actual: `${r.status} ${r.appCode || ""} · ${row ? `${row.no} · วันที่ ${day(row.d)}` : "ไม่มีใบ"}`,
        status: ok ? "PASS" : "FAIL",
        docs: row ? [row.no] : [],
      });
    }
    for (const [kind, id] of [
      ["stock-outs", soId],
      ["stock-ins", siId],
    ] as const)
      if (id) console.log(`A8 cleanup delete ${kind} → ${(await apiSend("DELETE", `/api/${BU}/${kind}/${id}`)).status}`);
    expect({ okSo, okSi }).toEqual({ okSo: true, okSi: true });
  },
);

test(
  "TC-PE-490009 รายงาน lookup current-period / previous-period ต้องอิงงวด active",
  {
    annotation: [
      {
        type: "preconditions",
        description:
          "E2E_PERIOD_BU เป็น TEST BU (ตัวควบคุม รันได้ทุก BU); มีงวดที่สร้างล่วงหน้าใหม่กว่างวด active",
      },
      {
        type: "steps",
        description:
          "1. หางวด active และงวดก่อนหน้างวด active จาก tb_inventory_period\n2. GET /reports/lookups?types=current-period,previous-period,period (ตัวที่หน้า dialog รายงานเรียก)\n3. เทียบ current-period และ previous-period กับกติกา",
      },
      {
        type: "expected",
        description: "current-period = งวด active และ previous-period = งวดที่อยู่ก่อนงวด active (ไม่มี = null) — ไม่ใช่งวดใหม่สุดที่สร้างล่วงหน้า",
      },
      { type: "priority", description: "Medium" },
      { type: "testType", description: "Functional" },
      {
        type: "note",
        description:
          "เดิม A9 (_movement_play specs/26-active-period) แถว A9a / A9b (id ต่อท้าย -AVG / -FIFO) · แยก A9c ไปเป็น TC-PE-490010 เพื่อไม่ให้ test.fail กลบผลของ A9c ที่ผ่านอยู่ · บั๊กที่รู้อยู่ (test.fail) micro-report#19: ผลล่าสุด 2026-10-02 r4 FAIL ทั้ง AVG (ได้ 2612 / 2611 แทน 2607 / 2606) และ FIFO (ได้ 2612 / 2611 แทน 2611 / 2610) · ถ้าขึ้น \"unexpectedly passed\" ให้เอา test.fail ออก",
      },
    ],
  },
  async () => {
    test.fail(true, "known bug micro-report#19: reports lookups current-period / previous-period follow the newest open period, not the active one");
    const P = periods();
    const r = await apiSend("GET", `/api/${BU}/reports/lookups?types=current-period,previous-period,period`);
    const d = r.body?.data ?? {};
    const cur = d["current-period"]?.period ?? null;
    const prev = d["previous-period"]?.period ?? null;
    const tg = tag();
    for (const [id, label, ok, want, got] of [
      [`A9a-${tg}`, "current-period", cur === P.active.period, P.active.period, cur],
      [`A9b-${tg}`, "previous-period", prev === P.prev, P.prev ?? "ไม่มี", prev ?? "ไม่มี"],
    ] as const) {
      record({
        id,
        case: CASE,
        title: `รายงาน lookup ${label} — ${BU} งวด active ${P.active.period}`,
        steps: ["GET /reports/lookups?types=current-period,previous-period,period (ตัวที่หน้า dialog รายงานเรียก)"],
        expected: `${want}`,
        actual: `${got}`,
        status: ok ? "PASS" : "FAIL",
      });
    }
    expect({ cur, prev }).toEqual({ cur: P.active.period, prev: P.prev });
  },
);

test(
  "TC-PE-490010 รายงาน lookup ตัวเลือกงวดต้องเป็นงวดที่ปิดแล้วกับงวด active",
  {
    annotation: [
      {
        type: "preconditions",
        description:
          "E2E_PERIOD_BU เป็น TEST BU (ตัวควบคุม รันได้ทุก BU); มีงวดที่สร้างล่วงหน้าใหม่กว่างวด active",
      },
      {
        type: "steps",
        description:
          "1. หางวด active และงวดที่ปิดแล้วทั้งหมดจาก tb_inventory_period\n2. GET /reports/lookups?types=current-period,previous-period,period\n3. เทียบรายการ period (code) กับงวดที่ปิดแล้ว + งวด active เรียงใหม่ไปเก่า",
      },
      {
        type: "expected",
        description: "รายการตัวเลือกงวด = งวดที่ปิดแล้วรวมงวด active เรียงจากใหม่ไปเก่า — ไม่มีงวดที่สร้างล่วงหน้า",
      },
      { type: "priority", description: "Medium" },
      { type: "testType", description: "Functional" },
      {
        type: "note",
        description:
          "เดิม A9 (_movement_play specs/26-active-period) แถว A9c (id ต่อท้าย -AVG / -FIFO) · แยกจาก TC-PE-490009 (เดิมรวมอยู่ในเคสเดียวและไม่ได้ assert) · ผลล่าสุด 2026-10-02 r4 PASS ทั้ง AVG และ FIFO",
      },
    ],
  },
  async () => {
    const P = periods();
    const r = await apiSend("GET", `/api/${BU}/reports/lookups?types=current-period,previous-period,period`);
    const d = r.body?.data ?? {};
    const list: string[] = (d.period ?? []).map((x: any) => x.code);
    const closed = sql<{ p: string }>(`select period p from ${SCHEMA}.tb_inventory_period where status = 'closed' and deleted_at is null`).map((x) => x.p);
    const wantList = [...new Set([...closed, P.active.period])].sort().reverse();
    const tg = tag();
    record({
      id: `A9c-${tg}`,
      case: CASE,
      title: `รายงาน lookup ตัวเลือกงวด (period) — ${BU} งวด active ${P.active.period}`,
      steps: ["GET /reports/lookups?types=current-period,previous-period,period (ตัวที่หน้า dialog รายงานเรียก)"],
      expected: `${wantList.join(",")}`,
      actual: `${list.join(",")}`,
      status: JSON.stringify(list) === JSON.stringify(wantList) ? "PASS" : "FAIL",
    });
    expect(list).toEqual(wantList);
  },
);

test(
  "TC-PE-490011 หัวงวดของรายงาน EOP Checklist ต้องเป็นงวด active",
  {
    annotation: [
      {
        type: "preconditions",
        description:
          "E2E_PERIOD_BU เป็น TEST BU (ตัวควบคุม รันได้ทุก BU); มีงวดที่สร้างล่วงหน้าใหม่กว่างวด active",
      },
      {
        type: "steps",
        description:
          "1. หางวด active จาก tb_inventory_period\n2. SELECT DISTINCT period FROM v_inventory_eop_checklist (view ที่รายงาน EOP Checklist อ่าน)",
      },
      {
        type: "expected",
        description: "view คืนอย่างน้อย 1 แถว และทุกแถวมี period = งวด active",
      },
      { type: "priority", description: "Medium" },
      { type: "testType", description: "Functional" },
      {
        type: "note",
        description:
          "เดิม A10 (_movement_play specs/26-active-period) · id ใน results.json = A10-AVG / A10-FIFO · บั๊กที่รู้อยู่ (test.fail) แก้ใน SQL PR #723: ผลล่าสุด 2026-10-02 r4 FAIL ทั้ง AVG (ได้ 2612 แทน 2607) และ FIFO (ได้ 2612 แทน 2611) · ถ้าขึ้น \"unexpectedly passed\" ให้เอา test.fail ออก",
      },
    ],
  },
  async () => {
    test.fail(true, "known bug #723: v_inventory_eop_checklist.period follows the newest open period, not the active one");
    const P = periods();
    const rows = sql<{ p: string | null }>(`select distinct period p from ${SCHEMA}.v_inventory_eop_checklist`).map((x) => x.p);
    const ok = rows.length > 0 && rows.every((p) => p === P.active.period);
    record({
      id: `A10-${tag()}`,
      case: CASE,
      title: `v_inventory_eop_checklist.period — ${BU} งวด active ${P.active.period}`,
      steps: ["SELECT DISTINCT period FROM v_inventory_eop_checklist (view ที่รายงาน EOP Checklist อ่าน)"],
      expected: P.active.period,
      actual: rows.join(",") || "(ไม่มีแถว)",
      status: ok ? "PASS" : "FAIL",
    });
    expect(rows).toEqual([P.active.period]);
  },
);
