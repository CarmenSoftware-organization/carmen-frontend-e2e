import { test, expect, BU, requireScenario, sql, SCHEMA, record, getDoc, putDoc, currentPeriod, gatePhase, apiSend, srIssueWorkflow, inventoryLocations, pcUserId, adjustmentTypeId } from "./helpers/period-close/context";
import { L, PX, SCN, PERIOD, NEXT } from "./helpers/period-close/scenarios";

/**
 * Period close · phase 917 — Case 5: the rules introduced after the reset
 * (backend PRs #715 · #718 · #719). Runs after phase 914 (origin 20-case2 — needs
 * the next-period GRN of sub-case 2.1) and before Start Period Close.
 *   TC-PE-470001  #719 — a saved GRN dated next period posts no stock yet (AVG)
 *   TC-PE-470002  #719 — a committed Stock In dated next period posts no stock yet (AVG)
 *   TC-PE-470003  #715 — a saved GRN accepts header edits only
 *   TC-PE-470004  #718 — an SR dated after the current period reaches Issue but cannot be issued
 *
 * Every case is API-only on purpose: the screens cannot produce these states (the
 * calendar is locked to the current period, the form never sends line edits or a
 * status change for a saved GRN, the SR workflow needs a second approver account).
 *
 * Not reversible: commits a real Stock In dated next period (470002 — it posts when
 * the period closes) and creates an SR that is rejected afterwards (470004). Does
 * not touch the period status.
 *
 * Run: E2E_PERIOD_BU=<BU> bun run test:period-close -- tests/917-period-close-new-rules.spec.ts
 *
 * Origin: _movement_play/eop_bf/e2e/specs/24-new-rules.spec.ts
 */

/**
 * Case 5 · กติกาใหม่หลังรีเซ็ต (PR #715 · #718 · #719) — รันหลัง phase 20 (ต้องมีใบรับงวดหน้าจากข้อ 2.1) ก่อนกด Start
 * ยิง API เฉพาะสิ่งที่หน้าจอทำไม่ได้ — apiSend ของ helpers/period-close/context.ts (ล็อกอินเป็นบัญชี gmail บน TEST BU)
 */
const CASE = "Case 5 · กติกาใหม่ (PR #715 · #718 · #719)";
// AVG-LOCATION posts stock at save like AVG, and with one location its per-location average = the average (eb02388 live finding)
const isAvg = SCN.method !== "fifo";

/** layer ที่ยังไม่ถูกลบของเอกสาร (ผ่านหัวรายการเคลื่อนไหวที่ inventory_doc_no = id ของเอกสาร) */
function docLayerCount(docId: string): number {
  const [r] = sql<{ n: string }>(`
    select count(*) n from ${SCHEMA}.tb_inventory_transaction_cost_layer cl
    join ${SCHEMA}.tb_inventory_transaction_detail d on d.id = cl.inventory_transaction_detail_id
    join ${SCHEMA}.tb_inventory_transaction t on t.id = d.inventory_transaction_id
    where t.inventory_doc_no = '${docId}' and cl.deleted_at is null and t.deleted_at is null`);
  return Number(r.n);
}
const idOf = (table: string, where: string) => sql<{ id: string }>(`select id from ${SCHEMA}.${table} where ${where} limit 1`)[0]?.id;

test.beforeAll(() => requireScenario());
gatePhase({ db: true });

test.beforeAll(async () => {
  expect(await currentPeriod(BU)).toBe(PERIOD);
});

test(
  "TC-PE-470001 ใบรับลงวันที่งวดหน้าที่บันทึกแล้วยังไม่ลงสต๊อก (#719 · AVG)",
  {
    annotation: [
      {
        type: "preconditions",
        description:
          "E2E_PERIOD_BU เป็น TEST BU แบบ average; งวดปัจจุบันของ BU = งวดของ scenario; phase 914 (เดิม 20-case2) TC-PE-440001 (ข้อ 2.1) สร้างใบรับงวดหน้า (saved) ไว้ใน state.json แล้ว",
      },
      {
        type: "steps",
        description:
          "1. อ่านใบรับงวดหน้าจาก state.json (key nextGrn ของ scenario)\n2. อ่าน doc_status ของใบจาก tb_good_received_note\n3. นับ cost layer ที่ยังไม่ถูกลบของใบนี้",
      },
      {
        type: "expected",
        description:
          "ใบเป็น saved แต่มีรายการเคลื่อนไหว 0 แถว — จะไปลงตอนปิดงวดปัจจุบันหลังยกยอดเข้างวดหน้า (ตรวจในข้อ 5.5 ของ phase ปิดงวด)",
      },
      { type: "priority", description: "High" },
      { type: "testType", description: "Functional" },
      {
        type: "note",
        description:
          "เดิม 5.1 (_movement_play specs/24-new-rules) · พิสูจน์ backend PR #719 · ข้ามบน FIFO (FIFO ลงสต๊อกตอน commit อยู่แล้ว) · ผลล่าสุด avg2607-r4 2026-10-02 PASS · เดิมยืนยันแค่จำนวน layer — เพิ่มการยืนยันสถานะ saved ให้ตรงกับ verdict",
      },
    ],
  },
  async () => {
    test.skip(!isAvg, "เฉพาะต้นทุนเฉลี่ย — FIFO ลงสต๊อกตอน commit อยู่แล้ว");
    const grn = getDoc(SCN.keys.nextGrn)!;
    const [row] = sql<{ doc_status: string }>(`select doc_status::text doc_status from ${SCHEMA}.tb_good_received_note where id = '${grn.id}'`);
    const layers = docLayerCount(grn.id);
    record({
      id: "5.1",
      case: CASE,
      title: `ใบรับ ${grn.no} ลงวันที่ ${SCN.nextGrn.date} (งวด ${NEXT}) บันทึกแล้ว ต้องยังไม่ลงสต๊อก`,
      steps: [`ข้อ 2.1 สร้างใบรับ ${grn.no} แบบบันทึกแล้ว ลงวันที่งวด ${NEXT} ขณะที่งวดปัจจุบันคือ ${PERIOD}`, "ตรวจรายการเคลื่อนไหวของใบนี้"],
      expected: `ใบเป็นบันทึกแล้ว แต่ไม่มีรายการเคลื่อนไหว — จะไปลงตอนปิดงวด ${PERIOD} หลังยกยอดเข้า ${NEXT} (ตรวจในข้อ 5.5)`,
      actual: `สถานะ ${row?.doc_status} · รายการเคลื่อนไหว ${layers} แถว`,
      status: row?.doc_status === "saved" && layers === 0 ? "PASS" : "FAIL",
      docs: [grn.no],
    });
    expect(layers).toBe(0);
    expect(row?.doc_status).toBe("saved");
  },
);

test(
  "TC-PE-470002 Stock In ลงวันที่งวดหน้าที่ยืนยันแล้วยังไม่ลงสต๊อก (#719 · AVG)",
  {
    annotation: [
      {
        type: "preconditions",
        description:
          "E2E_PERIOD_BU เป็น TEST BU แบบ average; งวดปัจจุบันของ BU = งวดของ scenario; มีงวดหน้าเปิดไว้แล้ว; BU มีประเภทปรับปรุง stock_in ที่ใช้งานได้ (E2E-IA-IN จาก data:reset) และคลังแรก L มีสินค้า E2E-PC-X",
      },
      {
        type: "steps",
        description:
          "1. ถ้ายังไม่มี siNextHeld ใน state: POST /stock-ins ลงวันที่วันที่ 11 ของงวดหน้า ที่คลัง L: E2E-PC-X 2 หน่วย @20 (หน้าจอเลือกวันนอกงวดปัจจุบันไม่ได้)\n2. GET ใบเพื่ออ่าน doc_version แล้ว PATCH /stock-ins/:id/commit\n3. อ่าน doc_status ของใบจาก tb_stock_in\n4. นับ cost layer ที่ยังไม่ถูกลบของใบนี้",
      },
      {
        type: "expected",
        description:
          "สร้างและ commit ได้ (HTTP < 300); ใบเป็น completed แต่มีรายการเคลื่อนไหว 0 แถว — จะไปลงตอนปิดงวดปัจจุบันหลังยกยอด (ตรวจในข้อ 5.5)",
      },
      { type: "priority", description: "High" },
      { type: "testType", description: "Functional" },
      {
        type: "note",
        description:
          "เดิม 5.2 (_movement_play specs/24-new-rules) · พิสูจน์ backend PR #719 · ยิง API เพราะปฏิทินของฟอร์มล็อกไว้ที่งวดปัจจุบัน · ข้ามบน FIFO · ใบที่ commit แล้วย้อนไม่ได้ (ลงสต๊อกตอนปิดงวด) · ผลล่าสุด avg2607-r4 2026-10-02 PASS · เดิมยืนยันแค่จำนวน layer — เพิ่มการยืนยันสถานะ completed ให้ตรงกับ verdict",
      },
    ],
  },
  async () => {
    test.skip(!isAvg, "เฉพาะต้นทุนเฉลี่ย");
    const siDate = SCN.nextGrn.date.replace(/-\d\d$/, "-11");
    let si = getDoc("siNextHeld");
    const steps = [
      `ยิง API สร้าง Stock In ลงวันที่ ${siDate} (งวด ${NEXT}) ที่ ${L.code}: ${PX.name} 2 หน่วย @20 — หน้าจอเลือกวันนอกงวดปัจจุบันไม่ได้`,
      "ยิง API commit",
    ];
    if (!si) {
      const created = await apiSend("POST", `/api/${BU}/stock-ins`, {
        si_date: siDate,
        description: `E2E ${PERIOD} 5.2 Stock In งวดหน้า`,
        adjustment_type_id: await adjustmentTypeId("stock_in"),
        location_id: idOf("tb_location", `code = '${L.code}'`),
        stock_in_detail: { add: [{ product_id: idOf("tb_product", `code = '${PX.code}'`), qty: 2, cost_per_unit: 20, total_cost: 40 }] },
      });
      expect(created.status, `create SI ${JSON.stringify(created.body)}`).toBeLessThan(300);
      const id = created.body.data.id as string;
      const fresh = await apiSend("GET", `/api/${BU}/stock-ins/${id}`);
      const committed = await apiSend("PATCH", `/api/${BU}/stock-ins/${id}/commit`, { doc_version: fresh.body.data.doc_version });
      expect(committed.status, `commit SI ${JSON.stringify(committed.body)}`).toBeLessThan(300);
      si = { id, no: fresh.body.data.si_no, status: "completed" };
      putDoc("siNextHeld", si);
    }
    const [row] = sql<{ doc_status: string }>(`select doc_status::text doc_status from ${SCHEMA}.tb_stock_in where id = '${si.id}'`);
    const layers = docLayerCount(si.id);
    record({
      id: "5.2",
      case: CASE,
      title: `Stock In ${si.no} ลงวันที่งวด ${NEXT} ยืนยันแล้ว ต้องยังไม่ลงสต๊อก`,
      steps,
      expected: `ใบเสร็จสมบูรณ์ แต่ไม่มีรายการเคลื่อนไหว — จะไปลงตอนปิดงวด ${PERIOD} หลังยกยอด (ตรวจในข้อ 5.5)`,
      actual: `สถานะ ${row?.doc_status} · รายการเคลื่อนไหว ${layers} แถว`,
      status: row?.doc_status === "completed" && layers === 0 ? "PASS" : "FAIL",
      docs: [si.no],
    });
    expect(layers).toBe(0);
    expect(row?.doc_status).toBe("completed");
  },
);

test(
  "TC-PE-470003 ใบรับที่บันทึกแล้วแก้บรรทัดได้ แต่เปลี่ยนวันที่/สถานะไม่ได้ (#715 → GRN_SAVED_IDENTITY_LOCKED)",
  {
    annotation: [
      {
        type: "preconditions",
        description:
          "E2E_PERIOD_BU=<BU> (TEST BU ใดก็ได้); งวดปัจจุบันของ BU = งวดของ scenario; phase 914 (เดิม 20-case2) TC-PE-440001 (ข้อ 2.1) สร้างใบรับงวดหน้า (saved) ไว้ใน state.json แล้ว",
      },
      {
        type: "steps",
        description:
          "1. PATCH /good-received-notes/:id แก้ received_qty ของบรรทัดแรกเป็น 99\n2. PATCH แก้ grn_date เป็นวันที่ 20 ของงวดหน้า (ตัวกำหนดงวด)\n3. PATCH เปลี่ยน doc_status กลับเป็น draft\n4. PATCH แก้ note และ invoice_no (หัวใบ)\n5. อ่าน note, invoice_no, doc_status จาก tb_good_received_note",
      },
      {
        type: "expected",
        description:
          "แก้บรรทัด → สำเร็จ (backend ปัจจุบัน: ใบ saved แก้ได้เหมือนร่าง ยกเว้นผู้ขาย/วันที่รับ — GRN_SAVED_HEADER_ONLY เลิกส่งแล้ว); แก้วันที่ → 400 GRN_SAVED_IDENTITY_LOCKED; เปลี่ยนสถานะ → 400 GRN_STATUS_CHANGE_NOT_ALLOWED; แก้ note/invoice_no → สำเร็จ (HTTP < 300) ค่าใหม่ถูกเก็บ และใบยังเป็น saved",
      },
      { type: "priority", description: "High" },
      { type: "testType", description: "Validation" },
      {
        type: "note",
        description:
          "เดิม 5.3 (_movement_play specs/24-new-rules) · พิสูจน์ backend PR #715 · ยิง API เพราะหน้าจอไม่ส่งการแก้บรรทัด/สถานะของใบ saved · ผลล่าสุด PASS ทั้ง avg2607-r4 และ p11-r4 (2026-10-02)",
      },
    ],
  },
  async () => {
    // The backend now deliberately allows line edits on a saved GRN and locks only vendor and date
    // (GRN_SAVED_IDENTITY_LOCKED); the old assertion here was GRN_SAVED_HEADER_ONLY (user-approved change).
    const grn = getDoc(SCN.keys.nextGrn)!;
    const [detail] = sql<{ id: string; doc_version: string }>(`select id, doc_version from ${SCHEMA}.tb_good_received_note_detail
      where good_received_note_id = '${grn.id}' and deleted_at is null limit 1`);
    const version = async () => (await apiSend("GET", `/api/${BU}/good-received-notes/${grn.id}`)).body.data.doc_version;
    const path = `/api/${BU}/good-received-notes/${grn.id}`;

    const lines = await apiSend("PATCH", path, {
      doc_version: await version(),
      good_received_note_detail: {
        update: [{ id: detail.id, good_received_note_id: grn.id, received_qty: 99, foc_qty: 0, doc_version: Number(detail.doc_version) }],
      },
    });
    const date = await apiSend("PATCH", path, {
      doc_version: await version(),
      grn_date: `${SCN.nextGrn.date.replace(/-\d\d$/, "-20")}T00:00:00.000Z`,
    });
    const status = await apiSend("PATCH", path, { doc_version: await version(), doc_status: "draft" });
    const note = `E2E ${PERIOD} 5.3`;
    const header = await apiSend("PATCH", path, { doc_version: await version(), note, invoice_no: `E2E-INV-${PERIOD}` });
    const [after] = sql<{ note: string; invoice_no: string; doc_status: string }>(
      `select note, invoice_no, doc_status::text doc_status from ${SCHEMA}.tb_good_received_note where id = '${grn.id}'`,
    );
    const ok =
      lines.status < 300 &&
      date.status === 400 && date.appCode === "GRN_SAVED_IDENTITY_LOCKED" &&
      status.status === 400 && status.appCode === "GRN_STATUS_CHANGE_NOT_ALLOWED" &&
      header.status < 300 && after.note === note && after.invoice_no === `E2E-INV-${PERIOD}` && after.doc_status === "saved";
    record({
      id: "5.3",
      case: CASE,
      title: `แก้ใบรับ ${grn.no} ที่บันทึกแล้วผ่าน API`,
      steps: ["แก้จำนวนในบรรทัด", "แก้วันที่ใบรับ (ตัวกำหนดงวด)", "เปลี่ยนสถานะกลับเป็นร่าง", "แก้หมายเหตุกับเลขใบแจ้งหนี้"],
      expected:
        "แก้บรรทัด → สำเร็จ · แก้วันที่ → 400 GRN_SAVED_IDENTITY_LOCKED · เปลี่ยนสถานะ → 400 GRN_STATUS_CHANGE_NOT_ALLOWED · แก้หมายเหตุ/เลขใบแจ้งหนี้ → สำเร็จ และใบยังเป็นบันทึกแล้ว",
      actual: `แก้บรรทัด → ${lines.status} ${lines.appCode} · แก้วันที่ → ${date.status} ${date.appCode} · เปลี่ยนสถานะ → ${status.status} ${status.appCode} · แก้หัวใบ → ${header.status} (note="${after.note}", invoice_no="${after.invoice_no}", สถานะ ${after.doc_status})`,
      status: ok ? "PASS" : "FAIL",
      docs: [grn.no],
    });
    expect(
      ok,
      `lines ${lines.status} ${lines.appCode} · date ${date.status} ${date.appCode} · status ${status.status} ${status.appCode} · header ${header.status} (${after.note} / ${after.invoice_no} / ${after.doc_status})`,
    ).toBe(true);
  },
);

test(
  "TC-PE-470004 ใบเบิกลงวันที่งวดหลังอนุมัติถึงขั้นจ่ายได้แต่จ่ายไม่ได้จนกว่างวดนั้นเป็นงวดปัจจุบัน (#718)",
  {
    annotation: [
      {
        type: "preconditions",
        description:
          "E2E_PERIOD_BU=<BU>; งวดปัจจุบันของ BU = งวดของ scenario และวันนี้อยู่ในงวด open/locked อื่นที่ใหม่กว่า (ไม่งั้นข้าม); workflow SR ที่มีขั้น Issue (หาจาก stage ด้วย srIssueWorkflow ของ context.ts ไม่อิงชื่อ); คลัง inventory 2 คลังแรกของ BU (L เป็นต้นทาง คลังที่สองเป็นปลายทาง) สินค้า E2E-PC-X อยู่ที่ L; บัญชี Requestor และ HOD (gmail) มีอยู่และอยู่ใน workflow",
      },
      {
        type: "steps",
        description:
          "1. admin POST /store-requisitions (requestor = Requestor gmail): E2E-PC-X 1 หน่วย จากคลัง L ไปคลังที่สองของ BU\n2. admin PATCH …/submit พร้อม sr_date_pattern = today (ผู้ใช้เลือกลงวันที่วันนี้)\n3. HOD (gmail) PATCH …/approve ขั้น HOD (approved_qty 1)\n4. admin PATCH …/approve stage_role = issue (issued_qty 1)\n5. อ่านใบและนับ cost layer ของใบ\n6. เก็บกวาด: reject ใบที่ค้างขั้น Issue",
      },
      {
        type: "expected",
        description:
          "ใบลงวันที่วันนี้ ส่งและอนุมัติได้ ไปรอที่ขั้น Issue; การจ่ายถูกปฏิเสธ 422 SR_ISSUE_PERIOD_NOT_CURRENT; ใบยังไม่ completed ยังอยู่ขั้น Issue และไม่มีรายการเคลื่อนไหว (0 แถว)",
      },
      { type: "priority", description: "High" },
      { type: "testType", description: "Negative" },
      {
        type: "note",
        description:
          "เดิม 5.4 (_movement_play specs/24-new-rules) · พิสูจน์ backend PR #718 · ยิง API เพราะต้องใช้ผู้อนุมัติอีกบัญชี (HOD) · ข้อที่ระบบต้องถามวันที่เมื่อไม่เลือก อยู่ใน 721-sr-issue-doc-flow · ใกล้เคียง TC-PE-490002 (เดิม A4 ใน 26-active-period) ซึ่งเป็นตัวควบคุมเดียวกัน · ผลล่าสุด avg2607-r4 2026-10-02 PASS (p11-r4 ข้ามเพราะวันนี้อยู่ในงวดปัจจุบัน)",
      },
    ],
  },
  async () => {
    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    const [todays] = sql<{ period: string }>(`select period from ${SCHEMA}.tb_inventory_period
      where deleted_at is null and status in ('open','locked') and start_at <= '${today}'::date and end_at >= '${today}'::date order by start_at desc limit 1`);
    test.skip(!todays || todays.period === PERIOD, "วันนี้อยู่ในงวดปัจจุบัน — ไม่มีเคสให้ปฏิเสธ");
    const get = async (id: string) => (await apiSend("GET", `/api/${BU}/store-requisitions/${id}`)).body.data;
    const lineOf = (d: any) => (d.store_requisition_detail ?? d.tb_store_requisition_detail ?? [])[0]?.id;
    const requestor = pcUserId("requestor");
    const locs = await inventoryLocations();
    const from = locs.find((l) => l.code === L.code);
    const to = locs.find((l) => l.code !== L.code);
    expect(from && to, `${BU}: ต้องมีคลัง inventory อย่างน้อย 2 คลัง (เจอ ${locs.map((l) => l.code).join(", ") || "-"})`).toBeTruthy();

    let sr = getDoc("sr718");
    const trail: string[] = [];
    if (!sr) {
      const created = await apiSend("POST", `/api/${BU}/store-requisitions`, {
        stage_role: "create",
        details: {
          sr_date: now,
          expected_date: now,
          description: `E2E ${PERIOD} 5.4 #718`,
          requestor_id: requestor,
          workflow_id: (await srIssueWorkflow()).id,
          // ต้นทาง = คลังแรกของ BU (L — ที่ data:reset ผูก E2E-PC-X ไว้) · ปลายทาง = คลัง inventory ถัดไป
          from_location_id: from!.id,
          to_location_id: to!.id,
          store_requisition_detail: { add: [{ product_id: idOf("tb_product", `code = '${PX.code}'`), requested_qty: 1 }] },
        },
      });
      expect(created.status, `create SR ${JSON.stringify(created.body)}`).toBeLessThan(300);
      sr = { id: created.body.data.id, no: "", status: "draft" };
      putDoc("sr718", sr);
    }
    let d = await get(sr.id);
    if (d.doc_status === "draft") {
      const r = await apiSend("PATCH", `/api/${BU}/store-requisitions/${sr.id}/submit`, {
        // ผู้ใช้เลือกเองว่าให้ลงวันที่วันนี้ (งวดหลัง) — กติกา: ถ้าไม่เลือก ระบบต้องถาม เพราะวันนี้อยู่นอกงวด active
        // (ข้อที่ระบบต้องถามอยู่ใน 26-active-period / fe/07 SRI.7 — ข้อนี้ตรวจแค่ว่าใบงวดหลังต้องรอ)
        // ที่นี่: 919-period-close-active-period / 721-sr-issue-doc-flow
        doc_version: d.doc_version,
        stage_role: "create",
        sr_date_pattern: "today",
        details: [{ id: lineOf(d), stage_status: "submit", stage_message: "" }],
      });
      trail.push(`ส่ง (submit, เลือก today) → ${r.status}${r.appCode ? " " + r.appCode : ""}`);
      expect(r.status, `submit ${JSON.stringify(r.body)}`).toBeLessThan(300);
      d = await get(sr.id);
    }
    // TEST BU: workflow SR ขั้นอนุมัติชื่อ "Store Approval" และมอบให้บัญชี Purchase (fixtures/workflows.json)
    if (d.workflow_current_stage === "Store Approval") {
      const r = await apiSend(
        "PATCH",
        `/api/${BU}/store-requisitions/${sr.id}/approve`,
        {
          doc_version: d.doc_version,
          stage_role: "approve",
          details: [{ id: lineOf(d), stage_status: "approve", stage_message: "", approved_qty: 1 }],
        },
        "purchase",
      );
      trail.push(`HOD อนุมัติ → ${r.status}${r.appCode ? " " + r.appCode : ""}`);
      expect(r.status, `HOD approve ${JSON.stringify(r.body)}`).toBeLessThan(300);
      d = await get(sr.id);
    }
    const stageBefore = d.workflow_current_stage;
    const issue = await apiSend("PATCH", `/api/${BU}/store-requisitions/${sr.id}/approve`, {
      doc_version: d.doc_version,
      stage_role: "issue",
      details: [{ id: lineOf(d), stage_status: "approve", stage_message: "", issued_qty: 1 }],
    });
    d = await get(sr.id);
    putDoc("sr718", { ...sr, no: d.sr_no, status: d.doc_status });
    const layers = docLayerCount(sr.id);
    const datedToday = String(d.sr_date ?? "").slice(0, 10) === today;
    const ok =
      datedToday && stageBefore === "Issue" && issue.status === 422 && issue.appCode === "SR_ISSUE_PERIOD_NOT_CURRENT" &&
      d.doc_status !== "completed" && d.workflow_current_stage === "Issue" && layers === 0;
    record({
      id: "5.4",
      case: CASE,
      title: `ใบเบิก ${d.sr_no}: วันนี้อยู่งวด ${todays.period} แต่งวดปัจจุบันคือ ${PERIOD}`,
      steps: [
        `admin สร้างใบเบิก (requestor = Requestor gmail; ${PX.code} 1 จาก ${from!.code} ไป ${to!.code}) แล้วส่ง โดยเลือกลงวันที่วันนี้ (sr_date_pattern = today)`,
        "HOD (gmail) อนุมัติขั้น HOD",
        "admin กดจ่ายของ (issue)",
      ],
      expected: `ใบลงวันที่วันนี้ (งวด ${todays.period}) ส่งและอนุมัติได้ ใบไปรอที่ขั้น Issue · การจ่ายถูกปฏิเสธ 422 SR_ISSUE_PERIOD_NOT_CURRENT (งวด ${todays.period} / ปัจจุบัน ${PERIOD}) · ใบยังอยู่ขั้น Issue ไม่มีรายการเคลื่อนไหว`,
      actual: `${trail.join(" · ")}${trail.length ? " · " : ""}sr_date ${String(d.sr_date ?? "").slice(0, 10)} · ก่อนจ่ายอยู่ขั้น ${stageBefore} · จ่าย → ${issue.status} ${issue.appCode} · หลังจากนั้นสถานะ ${d.doc_status} ขั้น ${d.workflow_current_stage} · รายการเคลื่อนไหว ${layers} แถว`,
      status: ok ? "PASS" : "FAIL",
      docs: [d.sr_no],
    });
    // เก็บกวาด: ใบที่ค้างขั้น Issue ลงวันที่งวดของวันนี้ จะไปขวางการเริ่มนับของงวดนั้นในอนาคต
    if (d.doc_status !== "completed" && d.doc_status !== "rejected") {
      const rejected = await apiSend("PATCH", `/api/${BU}/store-requisitions/${sr.id}/reject`, {
        doc_version: d.doc_version,
        stage_role: "issue",
        details: [{ id: lineOf(d), stage_status: "reject", stage_message: "E2E 5.4 เก็บกวาดหลังพิสูจน์ #718" }],
      });
      console.log(`5.4 cleanup reject → ${rejected.status} ${rejected.appCode} · ${(await get(sr.id)).doc_status}`);
    }
    expect(
      ok,
      `sr_date ${String(d.sr_date ?? "").slice(0, 10)} · stage ${stageBefore} → issue ${issue.status} ${issue.appCode} · ${d.doc_status} ${d.workflow_current_stage} · layers ${layers}`,
    ).toBe(true);
  },
);
