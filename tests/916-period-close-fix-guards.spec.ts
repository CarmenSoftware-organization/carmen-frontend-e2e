import {
  test,
  expect,
  requireScenario,
  sql,
  SCHEMA,
  prevRecord,
  record,
  shot,
  getDoc,
  putDoc, gatePhase
} from "./helpers/period-close/context";
import { L, P, SCN } from "./helpers/period-close/scenarios";
import {
  createAdjustment,
  createCreditNote,
  createGrn,
  commitGrn,
  deleteCreditNoteDraft,
  submitCreditNote,
  tryVoidGrn,
  type CreatedDoc,
} from "./helpers/period-close/docs";

/**
 * Period close · phase 916 — Case 4: proves backend PRs #712 / #713 through the
 * screens, on an average-cost BU only (#713 is about the AVG period close). Runs
 * before Start Period Close.
 *   TC-PE-460001  #712 — a new CN number never reuses the number of a deleted draft
 *   TC-PE-460002  #713 — voiding a GRN whose stock was already issued is refused (409)
 *   TC-PE-460003  the toast of that refusal names the real reason (known bug, test.fail)
 *   TC-PE-460004  #713 — a CN returning more than is on hand only takes what is there
 *
 * Not reversible: posts real documents into the scenario's period (GRN saved then
 * committed, Stock Out completed, CN completed; two CN drafts created and deleted).
 * Does not touch the period status. Documents are remembered in state.json, so a
 * rerun reuses them — 460002 needs a fresh key set per rerun (E2E_PERIOD_K42=3, 4, …)
 * because the GRN it tried to void is committed afterwards.
 * Prerequisite: phase 910 (origin 00-prestep) created `grnA` in state.json.
 *
 * Overlap: TC-GRN-120001 / TC-GRN-120003 (tests/501-grn.spec.ts) expect Void to
 * succeed and reverse stock; 460002 pins the opposite for a GRN whose stock was
 * already issued — both can be right, they cover different states.
 *
 * Run: E2E_PERIOD_BU=<BU> bun run test:period-close -- tests/916-period-close-fix-guards.spec.ts
 *
 * Origin: _movement_play/eop_bf/e2e/specs/23-fix-guards.spec.ts
 */

/**
 * Case 4 · พิสูจน์ PR #712 / #713 ผ่าน UI (AVG เท่านั้น — #713 เป็นเรื่องของการปิดงวดแบบ average) รันก่อนกด Start
 *
 * ต้นเหตุของ #713: แถวปิด/เปิดงวด AVG ไม่ผูก parent_lot_no หลังปิดงวดล็อตเก่าจึงดูเต็ม การจ่ายออกผูกไปที่ล็อตเก่า
 * ล็อตของ GRN ใหม่จึง "ดูไม่ถูกใช้" ทั้งที่ของถูกจ่ายไปแล้ว — เคสข้างล่างจัดให้เกิดสภาพนั้นจริง แล้วดูว่าระบบไม่ปล่อยให้คลังติดลบ
 */
const CASE = "Case 4 · พิสูจน์ PR #712 / #713";
// คงเป็น average อย่างเดียว: #713 เป็นเรื่อง processAverageClose (แถวปิด/เปิดงวด AVG ไม่ผูก parent_lot_no) ยังไม่มีหลักฐานว่า average_per_location เป็นแบบเดียวกัน
test.skip(SCN.method !== "average", "เฉพาะ BU แบบ average");

test.beforeAll(() => requireScenario());
gatePhase({ dates: true });

const DATE = SCN.case1Date;
const prodId = (code: string) => `(select id from ${SCHEMA}.tb_product where code = '${code}')`;
const locId = () => `(select id from ${SCHEMA}.tb_location where code = '${L.code}')`;

/** ยอดที่หยิบได้ของคลัง (งวดปัจจุบัน) — กติกาเดียวกับด่านของ backend: รับเข้างวดนี้/ก่อนหน้า − จ่ายออกทุกงวด */
function drawable(code: string): number {
  const [r] = sql<{ b: string }>(`
    with cur as (select end_at from ${SCHEMA}.tb_inventory_period where status::text in ('open','locked') and deleted_at is null order by fiscal_year, fiscal_month limit 1),
         dr as (select period from ${SCHEMA}.tb_inventory_period where deleted_at is null and end_at <= (select end_at from cur))
    select coalesce(sum(in_qty) filter (where in_qty > 0 and (at_period is null or at_period in (select period from dr))), 0)
         - coalesce(sum(out_qty) filter (where out_qty > 0), 0) b
    from ${SCHEMA}.tb_inventory_transaction_cost_layer
    where deleted_at is null and product_id = ${prodId(code)} and location_id = ${locId()}`);
  return Number(r.b);
}

/** ล็อตที่ตัวจัดสรรเห็นว่ายังเหลือ (รับเข้า − ขาออกที่ผูก parent) — ตัวที่เกินของจริงหลังปิดงวด AVG */
function visibleLots(code: string): number {
  const [r] = sql<{ v: string }>(`
    with recv as (select lot_no, sum(in_qty) tin from ${SCHEMA}.tb_inventory_transaction_cost_layer
                  where deleted_at is null and in_qty > 0 and product_id = ${prodId(code)} and location_id = ${locId()} group by 1)
    select coalesce(sum(greatest(r.tin - coalesce((select sum(o.out_qty) from ${SCHEMA}.tb_inventory_transaction_cost_layer o
            where o.deleted_at is null and o.out_qty > 0 and o.parent_lot_no = r.lot_no), 0), 0)), 0) v from recv r`);
  return Number(r.v);
}

/** layer ของเอกสาร (ผ่านหัวรายการเคลื่อนไหวที่ inventory_doc_no = id ของเอกสาร) */
function docLayers(docId: string) {
  return sql<{ lot_no: string; parent_lot_no: string | null; in_qty: string; out_qty: string; note: string | null; tt: string }>(`
    select cl.lot_no, cl.parent_lot_no, cl.in_qty, cl.out_qty, cl.note, cl.transaction_type::text tt
    from ${SCHEMA}.tb_inventory_transaction_cost_layer cl
    join ${SCHEMA}.tb_inventory_transaction_detail d on d.id = cl.inventory_transaction_detail_id
    join ${SCHEMA}.tb_inventory_transaction t on t.id = d.inventory_transaction_id
    where t.inventory_doc_no = '${docId}' and cl.deleted_at is null and t.deleted_at is null
    order by cl.lot_index`);
}

async function once(key: string, make: () => Promise<CreatedDoc | null>): Promise<CreatedDoc> {
  const had = getDoc(key);
  if (had) return had as CreatedDoc;
  const d = (await make())!;
  putDoc(key, { ...d });
  return d;
}

test(
  "TC-PE-460001 เลขใบลดหนี้ใหม่ต้องไม่ซ้ำกับใบร่างที่ลบไปแล้ว (#712)",
  {
    annotation: [
      {
        type: "preconditions",
        description:
          "E2E_PERIOD_BU เป็น TEST BU แบบ average; Login เป็น Admin (gmail, project setup); phase 910 (เดิม 00-prestep) สร้าง grnA ไว้ใน state.json; ยังไม่กด Start Period Close",
      },
      {
        type: "steps",
        description:
          "1. สร้างใบลดหนี้ร่างอ้าง grnA คืน P1 1 (Tax Invoice E2E-712-A) → ได้เลขใบแรก\n2. เปิดใบ → Edit → Delete → ยืนยัน\n3. สร้างใบลดหนี้ร่างใบใหม่แบบเดียวกัน (Tax Invoice E2E-712-B) → ได้เลขใบที่สอง\n4. ลบใบที่สองทิ้ง (เก็บกวาด)\n5. นับแถวใน tb_credit_note (รวมที่ลบแล้ว) ที่ใช้เลขใบที่สอง",
      },
      {
        type: "expected",
        description:
          "เลขใบที่สองไม่เท่ากับเลขใบแรก และมีแถวใน tb_credit_note ที่ใช้เลขนั้นเพียง 1 แถว (ก่อน #712 จะได้เลขเดิมซ้ำ เพราะการหาเลขล่าสุดมองไม่เห็นใบที่ลบ)",
      },
      { type: "priority", description: "Medium" },
      { type: "testType", description: "Functional" },
      {
        type: "note",
        description:
          "เดิม 4.1 (_movement_play specs/23-fix-guards) · พิสูจน์ backend PR #712 · ผลล่าสุด avg2605-r2 2026-10-02 PASS · เดิมยืนยันแค่เลขไม่ซ้ำ — เพิ่มการยืนยันจำนวนแถวที่ใช้เลขเดียวกัน (= 1) ให้ตรงกับ verdict ใน results.json",
      },
    ],
  },
  async ({ page }) => {
    const grnA = getDoc("grnA")!;
    // P1, not P4: 914's draft CN (cnDraftIn) holds P4 of grnA and a product can be credited once per GRN (drafts count).
    // Both drafts here are deleted, so P1 is free again for 919.
    const cnLine = [{ productName: P.P1.name, qty: 1 }];
    const first = await createCreditNote(page, { grnNo: grnA.no, docDate: DATE, taxInvoiceNo: "E2E-712-A", lines: cnLine, status: "draft" });
    const img1 = await shot(page, "4.1", `CN-${first!.no}-ร่างใบแรก`);
    await deleteCreditNoteDraft(page, first!.id);
    const second = await createCreditNote(page, { grnNo: grnA.no, docDate: DATE, taxInvoiceNo: "E2E-712-B", lines: cnLine, status: "draft" });
    const img2 = await shot(page, "4.1", `CN-${second!.no}-ร่างใบใหม่หลังลบ`);
    await deleteCreditNoteDraft(page, second!.id);
    const dup = sql<{ n: string }>(`select count(*) n from ${SCHEMA}.tb_credit_note where cn_no = '${second!.no}'`)[0];
    record({
      id: "4.1",
      case: CASE,
      title: "สร้าง CN ร่าง → ลบ → สร้างใหม่: เลขต้องไม่ซ้ำกับใบที่ลบ",
      steps: [`CN ร่างอ้าง ${grnA.no} (${P.P4.name} 1) → ได้ ${first!.no}`, "Edit → Delete", `สร้างใหม่ → ได้ ${second!.no}`, "ลบใบที่สองทิ้ง (เก็บกวาด)"],
      expected: `เลขใบที่สอง ≠ ${first!.no} (ก่อน #712 จะได้เลขเดิมซ้ำ เพราะการหาเลขล่าสุดมองไม่เห็นใบที่ลบ)`,
      actual: `ใบแรก ${first!.no} · ใบที่สอง ${second!.no} · แถวในตารางที่ใช้เลข ${second!.no}: ${dup.n}`,
      status: second!.no !== first!.no && Number(dup.n) === 1 ? "PASS" : "FAIL",
      docs: [first!.no, second!.no],
      images: [img1, img2],
    });
    expect(second!.no).not.toBe(first!.no);
    expect(Number(dup.n), `แถวใน tb_credit_note ที่ใช้เลข ${second!.no}`).toBe(1);
  },
);

// ใบที่ลองแล้วถูก commit ทิ้ง (void ใบ committed ไม่ได้อยู่แล้ว) รันซ้ำในโฟลเดอร์เดิมต้องใช้ key ชุดใหม่: E2E_PERIOD_K42=3, 4, …
const K42 = process.env.E2E_PERIOD_K42 ?? "2";

test.describe("4.2 void GRN หลังของถูกจ่ายออกไปแล้ว", () => {
  // 460003 อ่าน toast ที่ 460002 เก็บไว้ — void ซ้ำไม่ได้ (ใบถูก commit ทิ้งหลังลอง)
  test.describe.configure({ mode: "serial" });
  let voidToast: string | undefined;

  test(
    "TC-PE-460002 void GRN ที่ของถูกจ่ายออกไปแล้วต้องถูกปฏิเสธและคลังไม่ติดลบ (#713)",
    {
      annotation: [
        {
          type: "preconditions",
          description:
            "E2E_PERIOD_BU เป็น TEST BU แบบ average; Login เป็น Admin (gmail, project setup); คลัง L มี E2E-PC-1 จากงวดก่อน ๆ (ล็อตเก่าที่ปิดงวดแล้ว); ยังไม่กด Start Period Close; รันซ้ำต้องตั้ง E2E_PERIOD_K42 ชุดใหม่",
        },
        {
          type: "steps",
          description:
            "1. สร้าง GRN แบบ saved ที่คลัง L: E2E-PC-1 10 @150 (AVG ลงสต๊อกตอน save) → จดล็อตของใบ\n2. สร้าง Stock Out (completed) จ่าย E2E-PC-1 จนยอดหยิบได้เหลือ 3 → จด parent_lot_no ที่ถูกผูก\n3. เปิด GRN → Void → ใส่เหตุผล → ยืนยัน แล้วดักคำตอบของ POST …/void\n4. อ่านสถานะใบและยอดหยิบได้ของคลังหลังลอง void\n5. ถ้าใบยัง saved: Commit ทิ้งไว้ (ใบ saved ขวางการเริ่มนับ)",
        },
        {
          type: "expected",
          description:
            "หลังบ้านตอบ 409 GRN_RECEIPT_ALREADY_CONSUMED, ใบยังเป็น saved, ยอดหยิบได้ไม่ติดลบ และ Stock Out ผูก parent กับล็อตเก่า ไม่ใช่ล็อตของ GRN นี้ (ก่อน #713 จะ void ผ่านแล้วคลังเหลือ −7)",
        },
        { type: "priority", description: "High" },
        { type: "testType", description: "Negative" },
        {
          type: "note",
          description:
            "เดิม 4.2 (_movement_play specs/23-fix-guards) · พิสูจน์ backend PR #713 · ผลล่าสุด avg2605-r2 2026-10-02 PASS · เดิมยืนยันแค่สถานะ saved + ยอดไม่ติดลบ — เพิ่มการยืนยัน 409 + รหัส GRN_RECEIPT_ALREADY_CONSUMED และล็อตที่ถูกผูกให้ตรงกับ verdict · ขัดกับ TC-GRN-120001/120003 (501-grn) ที่คาดว่า Void สำเร็จและคืนสต๊อก — นั่นคือใบที่ของยังไม่ถูกจ่าย · บันทึกแถว 4.2-msg ไว้ในเคสนี้ด้วย (ตรวจใน TC-PE-460003)",
        },
      ],
    },
    async ({ page }) => {
      const grn = await once(`g713a${K42}`, () =>
        createGrn(page, { date: DATE, invoiceNo: `E2E-${SCN.period}-713a${K42}`, status: "saved", lines: [{ product: P.P1.code, qty: 10, price: 150 }] }),
      );
      const grnLot = docLayers(grn.id).find((l) => Number(l.in_qty) > 0)?.lot_no;
      const before = drawable(P.P1.code);
      const lotsBefore = visibleLots(P.P1.code);
      // จ่ายออกจนเหลือ 3 — ตัวจัดสรรตัดล็อตเก่าที่ดูเต็มก่อน ล็อตของ GRN นี้จึงไม่ถูกผูก
      const so = await once(`so713a${K42}`, () =>
        createAdjustment(page, { type: "stock-out", date: DATE, reason: "E2E IA stock out", status: "completed", lines: [{ product: P.P1.code, qty: before - 3 }] }),
      );
      const parents = [...new Set(docLayers(so.id).filter((l) => Number(l.out_qty) > 0).map((l) => l.parent_lot_no))];
      const afterIssue = drawable(P.P1.code);
      const tried = await tryVoidGrn(page, grn.id, "E2E 4.2 void หลังจ่ายของ");
      voidToast = tried.toast;
      const img = await shot(page, "4.2", `void-${grn.no}-ถูกปฏิเสธ`);
      const afterVoid = drawable(P.P1.code);
      const byGuard = tried.http === 409 && tried.appCode === "GRN_RECEIPT_ALREADY_CONSUMED";
      // The lot-binding check only means something when the old lots look fuller than reality (the post-close state that
      // caused #713). On a fresh TEST BU with no closed AVG period there is no such lot, so the allocator may legitimately
      // draw the new receipt's lot too; the 409 guard + non-negative stock are still asserted unconditionally.
      const oldLotsLookFull = lotsBefore > before;
      const lotOk = !oldLotsLookFull || !parents.includes(grnLot ?? "");
      const ok = byGuard && tried.status === "saved" && afterVoid >= 0 && lotOk;
      // ใบ saved ขวางการเริ่มนับ — commit ทิ้งไว้ (AVG commit แค่ล็อกเอกสาร สต๊อกลงไปแล้วตั้งแต่ save)
      if (tried.status === "saved") await commitGrn(page, grn.id);
      record({
        id: "4.2",
        case: CASE,
        title: `void GRN ${grn.no} หลังของถูกจ่ายออกไปแล้ว — ต้องไม่ทำให้คลังติดลบ`,
        steps: [
          `GRN saved ${P.P1.name} 10 @150 ที่ ${L.code} (AVG ลงสต๊อกตอน save) → ล็อต ${grnLot}`,
          `SO จ่าย ${P.P1.code} ${before - 3} จนเหลือ 3 (${so.no})`,
          "กด Void ที่ GRN · ดักคำตอบของ POST …/void",
        ],
        expected:
          "หลังบ้านตอบ 409 GRN_RECEIPT_ALREADY_CONSUMED · ใบยัง saved · ยอดคลังไม่ติดลบ — การจ่ายผูกล็อตเก่า ไม่ใช่ล็อตของใบนี้ (ก่อน #713 จะ void ผ่านแล้วคลังเหลือ −7)",
        actual: `ก่อนจ่าย: ยอดจริง ${before} · ล็อตที่ตัวจัดสรรเห็น ${lotsBefore} · SO ผูก parent ${parents.join(", ")} (ล็อตของ GRN ${parents.includes(grnLot ?? "") ? "ถูกผูก" : "ไม่ถูกผูก"}${oldLotsLookFull ? "" : " · ไม่มีล็อตเก่าที่ดูเต็ม จึงไม่ตรวจการผูกล็อต"}) · หลังจ่ายเหลือ ${afterIssue} · Void → HTTP ${tried.http} ${tried.appCode || "(ไม่มีรหัส)"} · สถานะ ${tried.status} · ยอดหลังลอง void ${afterVoid}`,
        status: ok ? "PASS" : "FAIL",
        docs: [grn.no, so.no],
        images: [img],
      });
      // ข้อความที่ผู้ใช้เห็น — ต้องบอกเหตุผลจริง ไม่ใช่ข้อความกลางของ 409 ที่สั่งให้รีเฟรชแล้วลองใหม่ (ลองกี่ทีก็ไม่ผ่าน)
      const generic = /someone else changed|มีคนแก้ใบนี้/i.test(tried.toast);
      const wasFail = ["FAIL", "FIXED"].includes(prevRecord("4.2-msg")?.status ?? "");
      record({
        id: "4.2-msg",
        case: CASE,
        title: "ข้อความบนจอเมื่อ void ถูกปฏิเสธเพราะของถูกจ่ายไปแล้ว",
        steps: ["ต่อจาก 4.2 — อ่าน toast ที่ขึ้นหลังกด Void"],
        expected: "บอกเหตุผลจริง: ของที่รับเข้าใบนี้ถูกเบิกออกไปแล้ว ยกเลิกไม่ได้",
        actual: `toast: "${tried.toast}" · รหัสจากหลังบ้าน ${tried.appCode || "(ไม่มี)"}${generic ? " — FE ไม่มีข้อความของรหัสนี้ (messages errors.byCode) จึงตกไปข้อความกลางของ 409 (lib/error-message.ts fallbackKey) ผู้ใช้จะรีเฟรชแล้วลองใหม่ไปเรื่อย ๆ" : ""}`,
        status: generic ? "FAIL" : wasFail ? "FIXED" : "PASS",
        docs: [grn.no],
        images: [img],
      });
      expect(tried.status).toBe("saved");
      expect(afterVoid).toBeGreaterThanOrEqual(0);
      expect({ http: tried.http, appCode: tried.appCode }).toEqual({ http: 409, appCode: "GRN_RECEIPT_ALREADY_CONSUMED" });
      if (oldLotsLookFull) expect(parents, `Stock Out ต้องผูกล็อตเก่า ไม่ใช่ล็อตของ ${grn.no} (${grnLot})`).not.toContain(grnLot ?? "");
    },
  );

  test(
    "TC-PE-460003 toast เมื่อ void GRN ถูกปฏิเสธต้องบอกเหตุผลจริงว่าของถูกเบิกไปแล้ว",
    {
      annotation: [
        {
          type: "preconditions",
          description:
            "TC-PE-460002 ผ่านแล้วในรอบเดียวกัน (serial) — กด Void แล้วหลังบ้านตอบ 409 GRN_RECEIPT_ALREADY_CONSUMED และเก็บ toast ไว้",
        },
        {
          type: "steps",
          description: "1. อ่าน toast ที่ขึ้นหลังกด Void ใน TC-PE-460002\n2. ตรวจว่าไม่ใช่ข้อความกลางของ 409",
        },
        {
          type: "expected",
          description:
            "toast บอกเหตุผลจริงว่าของที่รับเข้าใบนี้ถูกเบิกออกไปแล้วจึงยกเลิกไม่ได้ — ไม่ใช่ \"Someone else changed this document. Refresh the page and try again.\" / \"มีคนแก้ใบนี้\"",
        },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
        {
          type: "note",
          description:
            "เดิม 4.2-msg (_movement_play specs/23-fix-guards) · บั๊กที่รู้อยู่ (เคยเป็น test.fail — ถอดแล้ว 2026-11-24 เพราะผ่านจริงบน BU-GR2VYNKQ หลัง FE #216): ผลล่าสุดเดิม avg2605-r2 2026-10-02T06:47Z FAIL — FE ไม่มีข้อความของรหัส GRN_RECEIPT_ALREADY_CONSUMED จึงตกไปข้อความกลางของ 409 · FE PR #216 (merge 2026-10-02 ราว 10:05Z หลังหลักฐานล่าสุด) เพิ่มข้อความแล้ว — แถว results.json ยังบันทึกใน TC-PE-460002 ตามเดิม",
        },
      ],
    },
    async () => {
      expect(voidToast, "TC-PE-460002 ต้องรันก่อนในรอบเดียวกัน").toBeDefined();
      expect(voidToast).not.toMatch(/someone else changed|มีคนแก้ใบนี้/i);
    },
  );
});

test(
  "TC-PE-460004 ใบลดหนี้คืนของเกินยอดคลังจริงต้องตัดสต๊อกได้แค่ที่มี (#713)",
  {
    annotation: [
      {
        type: "preconditions",
        description:
          "E2E_PERIOD_BU เป็น TEST BU แบบ average; Login เป็น Admin (gmail, project setup); คลัง L มี E2E-PC-2 จากงวดก่อน ๆ; ยังไม่กด Start Period Close; ใช้ evidence folder ใหม่ (รันซ้ำจะใช้ใบเดิมจาก state.json)",
      },
      {
        type: "steps",
        description:
          "1. สร้าง GRN committed ที่คลัง L: E2E-PC-2 10 @290\n2. สร้าง Stock Out (completed) จ่าย E2E-PC-2 จนยอดหยิบได้เหลือ 2\n3. สร้างใบลดหนี้อ้าง GRN นั้น คืน E2E-PC-2 10 → Create → Submit (ถ้ามีใบร่างค้างจากรอบที่ถูกขัดจังหวะ ใช้ใบนั้น Submit ต่อ)\n4. อ่าน cost layer ของใบลดหนี้ (ตัดไปเท่าไร, note shortfall) และยอดหยิบได้หลัง CN",
      },
      {
        type: "expected",
        description:
          "ใบลดหนี้เป็น completed, ตัดสต๊อกได้เท่ายอดที่เหลือจริง (2), อีก 8 ลงเป็น shortfall \"No stock available …\" (ส่วนต่างราคา ไม่ตัดสต๊อก) และยอดหยิบได้หลัง CN = 0 ไม่ติดลบ (ก่อน #713 ตัดจากล็อตของ GRN ที่ดูยังเต็ม 10 → คลัง −8)",
      },
      { type: "priority", description: "High" },
      { type: "testType", description: "Edge Case" },
      {
        type: "note",
        description:
          "เดิม 4.3 (_movement_play specs/23-fix-guards) · พิสูจน์ backend PR #713 · ผลล่าสุด avg2605-r2 2026-10-02 PASS · เดิมยืนยันแค่ยอดไม่ติดลบ — เพิ่มการยืนยันว่าตัดได้เท่ายอดที่มี, ยอดเหลือ 0 และใบเป็น completed ให้ตรงกับ verdict · รันซ้ำในโฟลเดอร์เดิมคำนวณยอดก่อน CN ใหม่ไม่ได้ ทั้ง results.json และเคสจะเป็น FAIL",
      },
    ],
  },
  async ({ page }) => {
    // Stock Out is checked against the balance on its own date: stock received later in the period (GRN P2 day 20) is not
    // drawable at day 15, so this case works on day 25, after every receipt of the scenario.
    const D713B = `${DATE.slice(0, 8)}25`;
    const grn = await once("g713b", () =>
      createGrn(page, { date: D713B, invoiceNo: `E2E-${SCN.period}-713b`, status: "committed", lines: [{ product: P.P2.code, qty: 10, price: 290 }] }),
    );
    const before = drawable(P.P2.code);
    const so = await once("so713b", () =>
      createAdjustment(page, { type: "stock-out", date: D713B, reason: "E2E IA stock out", status: "completed", lines: [{ product: P.P2.code, qty: before - 2 }] }),
    );
    const afterIssue = drawable(P.P2.code);
    const lotsVisible = visibleLots(P.P2.code);
    // รอบที่ถูกขัดจังหวะระหว่าง Submit ทิ้งใบร่างไว้ — สินค้าบนใบรับคืนได้ครั้งเดียว (ร่างก็นับ) ใบรับจึงหายจากช่องเลือก
    // ใช้ใบเดิมต่อแทนการสร้างใหม่
    if (!getDoc("cn713b")) {
      const [left] = sql<{ id: string; cn_no: string; s: string }>(`select id, cn_no, doc_status::text s from ${SCHEMA}.tb_credit_note
        where grn_id = '${grn.id}' and deleted_at is null and doc_status::text in ('draft', 'completed') order by created_at desc limit 1`);
      if (left) {
        if (left.s === "draft") await submitCreditNote(page, left.id);
        putDoc("cn713b", { id: left.id, no: left.cn_no, status: "completed" });
      }
    }
    const cn = await once("cn713b", () =>
      createCreditNote(page, { grnNo: grn.no, docDate: D713B, taxInvoiceNo: `E2E-713-${SCN.period}`, lines: [{ productName: P.P2.name, qty: 10 }], status: "completed" }),
    );
    const img = await shot(page, "4.3", `CN-${cn.no}`);
    const layers = docLayers(cn.id);
    const taken = layers.reduce((s, l) => s + Number(l.out_qty), 0);
    const shortfall = layers.find((l) => (l.note ?? "").startsWith("No stock available"))?.note ?? "(ไม่มี)";
    const afterCn = drawable(P.P2.code);
    record({
      id: "4.3",
      case: CASE,
      title: `CN คืน ${P.P2.name} 10 อ้าง ${grn.no} ขณะที่คลังเหลือจริง 2`,
      steps: [`GRN committed ${P.P2.name} 10 @290 (${grn.no})`, `SO จ่าย ${before - 2} จนเหลือ 2 (${so.no})`, `CN คืน 10 → Submit (${cn.no})`],
      expected:
        "ตัดสต๊อกได้ 2 · อีก 8 ลง shortfall (ส่วนต่างราคา ไม่ตัดสต๊อก) · ยอดคลังเหลือ 0 ไม่ติดลบ (ก่อน #713 ตัดจากล็อตของ GRN ที่ดูยังเต็ม 10 → คลัง −8)",
      actual: `ก่อน CN: ยอดจริง ${afterIssue} · ล็อตที่ตัวจัดสรรเห็น ${lotsVisible} · CN ${cn.status} ตัดไป ${taken} · shortfall: ${shortfall} · ยอดหลัง CN ${afterCn}`,
      status: taken === afterIssue && afterCn === 0 && cn.status === "completed" ? "PASS" : "FAIL",
      docs: [grn.no, so.no, cn.no],
      images: [img],
    });
    expect(afterCn).toBeGreaterThanOrEqual(0);
    expect({ taken, afterCn, status: cn.status }).toEqual({ taken: afterIssue, afterCn: 0, status: "completed" });
  },
);
