// ข้อมูลทดสอบของรอบปิดงวด — เลือกด้วย env E2E_PERIOD_SCENARIO
// เก็บไว้เฉพาะรอบล่าสุดของแต่ละ BU เป็นต้นแบบ: p11 = CARMEN-FIFO งวด 2611 (สร้างต่อจาก p09 → p10 จึงต้องเก็บสองตัวนั้นไว้ด้วย)
// · avg2607 = CARMEN-AVG งวด 2607 (สร้างจาก avgPeriod) — ทั้งสองรอบรันไปแล้ว 2026-10-02 · รอบใหม่ = เพิ่ม scenario ใหม่ท้ายไฟล์
// L = 1AG01 เพราะไม่มีประวัติ GRN/ledger ก่อนเริ่ม (TEST-MOVE มี GRN งวด 2604 ค้างจากการทดสอบเก่า จะทำให้ "GRN ล่าสุด" เพี้ยน)
// ย้ายมาจาก _movement_play/eop_bf/e2e/helpers/data.ts — scenario ของรอบเก่า (p03–p08, avg09, avg2601–avg2606) ดูได้ที่ต้นฉบับ

export const L = { code: "1AG01", name: "A&G-Accounting" };

export const P = {
  P1: { code: "11110001", name: "Ground Beef" },
  P2: { code: "11110003", name: "Australian Sirloin" },
  P3: { code: "11110009", name: "Pork neck tenderloin" },
  P4: { code: "11110012", name: "Shredded pork skin" }, // นับขาด → SO ชดเชย
} as const;

/** สินค้าสำรองที่ไม่อยู่ในการทดสอบราคา — ใช้เป็นเอกสารค้างของ Case 1 */
export const PX = { code: "11110024", name: "Chicken frame" };

export const QTY = 10;

type ProductRef = { code: string; name: string };
type Line = { product: string; qty: number; price?: number };

/** เอกสารรับเข้าที่ pre-step สร้าง (ทำครั้งเดียว จำใน state ด้วย key) */
export interface Receipt {
  id: string; // sub-case ใน Excel
  key: string;
  kind: "grn" | "stock-in";
  date: string;
  lines: Line[];
  title: string;
}

/** เอกสารที่สร้างระหว่างช่วงนับเพื่อทดสอบด่าน Close */
export interface CloseGateDoc {
  key: string;
  kind: "grn-saved" | "grn-draft" | "si-draft";
  product: ProductRef;
  price: number;
  date: string;
  /** void = ยกเลิก (ใบ FIFO ที่ยังไม่ลงสต๊อก) · delete = ลบร่าง · commit = ปิดใบ (AVG ลงสต๊อกตอน save แล้ว void ทีหลังจะทำให้ยอดในใบนับเพี้ยน) */
  clear: "void" | "delete" | "commit";
}

/** ราคาที่คาดในใบชดเชย (ข้อ 2.9) — side "out" = อ่านจาก SO ชดเชย (สินค้าที่นับขาด) */
export interface CostCase {
  p: ProductRef;
  side?: "in" | "out";
  /**
   * ราคาที่คาด หรือ "period-average" = คิดตอนตรวจจากสูตรปิดงวด (ค่าเฉลี่ยของสินค้าจากยอดยกมา + รับเข้าทั้งงวด)
   * หรือ "posted" = ต้นทุนที่บัญชีโพสต์จริงของบรรทัดนั้น (ฝั่ง out หลัง PR #709: ของออกตีราคาตามล็อตที่ตัด/ค่าเฉลี่ย
   * ไม่ใช่ si.cost-from — ผู้ใช้เคาะ 2026-10-01 "out มันต้องคิดตาม lot ที่ out ไป") · scenario เก่าก่อน #709 คง want เดิมไว้
   */
  want: number | "period-average" | "posted";
  wantFrom: string;
  trap: string;
  topic: string;
}

interface Scenario {
  bu: string;
  /** ชื่อ schema ของ tenant (ขีดล่าง ไม่ใช่ bu_code) */
  schema: string;
  /** วิธีคิดต้นทุนของ BU — กำหนดสูตรยกยอดในข้อ 2.11 */
  method: "fifo" | "average";
  /** เหตุผลของใบลดหนี้ (master ต่อ BU ไม่เหมือนกัน) */
  cnReason: string;
  /** เอกสารที่ค้างอยู่ก่อนเริ่มทดสอบ ใช้เป็นเคสขวาง Start จริงแล้วเคลียร์ (05-blockers) */
  preBlockers?: { soDrafts: string[]; srInProgress: string[]; srApprover: string };
  period: string;
  next: string;
  periodEnd: string;
  descPeriod: string;
  costFrom: { value: string; label: string };
  nextMonth: { caption: string; day: string };
  /** 1.2: GRN saved ในงวด → void (กับดักใบ void ของ P1) */
  voidTrap: { key: string; product: ProductRef; price: number; date: string };
  case1Date: string;
  keys: { nextGrn: string; nextGrnDraft: string; cnNext: string; cnDraftIn: string };
  nextGrn: { product: ProductRef; price: number; date: string; note: string };
  nextGrnDraftDate: string;
  cnNext: { grnKey?: string; grnNo?: string; product: ProductRef; date: string };
  cnDraftIn: { grnKey: string; product: ProductRef; date: string };
  preClean: { key: string; grnNo: string; action: "commit" | "delete" }[];
  /** หา GRN saved/draft ที่ลงวันที่ในงวดนี้เอง (ของค้างจากรอบก่อน) แล้ว commit/ลบ — ใช้แทน preClean ที่ต้องรู้เลขล่วงหน้า */
  preCleanAuto?: boolean;
  receipts: Receipt[];
  closeGate: CloseGateDoc[];
  costCases: CostCase[];
  rule: string;
  /** โค้ดที่แก้ต้นทุนแล้ว (ถ้ามี) — ใช้แทนคำอธิบายต้นเหตุของโค้ดเดิมในข้อ 2.9 */
  fixedBy?: string;
}

const FIFO = { bu: "CARMEN-FIFO", schema: "CARMEN_FIFO", method: "fifo", cnReason: "สินค้าชำรุด" } as const;

// CARMEN-AVG หลังล้างข้อมูล (2026-10-01) — งวด 2601/2602/2603 ใช้ si.cost-from คนละวิธี กับดักชุดเดียวกับ FIFO
// กติกา "ใบที่มีผล" (เคาะ 2026-10-01): นับตรงที่เกิด movement — AVG ลงสต๊อกตอน save จึงนับ GRN saved+committed
// GRN saved ระหว่างช่วงนับ (1.6) ใช้ P2 ราคาใหม่สุด → ต้องถูกเลือก · เคลียร์ก่อนปิดด้วย commit ไม่ใช่ void
function avgPeriod(o: {
  period: string; next: string; ym: string; nextYm: string; periodEnd: string; nextCaption: string;
  costFrom: { value: string; label: string };
  price: { a1: number; a3: number; p3: number; p2: number; si2: number; si1: number; void1: number; cg2: number; draft3: number; next3: number };
  p4?: number; costCases: CostCase[]; rule: string; preCleanAuto: boolean; fixedBy?: string;
}): Scenario {
  const d = (ym: string, day: number) => `${ym}-${String(day).padStart(2, "0")}`;
  const [ny, nm] = o.nextYm.split("-").map(Number);
  return {
    bu: "CARMEN-AVG", schema: "CARMEN_AVG", method: "average", cnReason: "Damage Good",
    period: o.period, next: o.next, periodEnd: o.periodEnd, descPeriod: o.ym,
    costFrom: o.costFrom,
    nextMonth: { caption: o.nextCaption, day: `${nm}/10/${ny}` },
    voidTrap: { key: "grnVoidP1", product: P.P1, price: o.price.void1, date: d(o.ym, 18) },
    case1Date: d(o.ym, 15),
    keys: { nextGrn: "grnNext", nextGrnDraft: "grnDraftNext", cnNext: "cnNext", cnDraftIn: "cnDraftIn" },
    nextGrn: { product: P.P3, price: o.price.next3, date: d(o.nextYm, 10), note: 'ใช้เป็น "GRN งวดหน้า" ของ P3 ในข้อ 2.9' },
    nextGrnDraftDate: d(o.nextYm, 12),
    cnNext: { grnKey: "grnA", product: P.P3, date: d(o.nextYm, 15) },
    cnDraftIn: { grnKey: "grnA", product: P.P1, date: d(o.ym, 20) },
    preClean: [],
    preCleanAuto: o.preCleanAuto,
    receipts: [
      {
        id: "0.2", key: "grnA", kind: "grn", date: d(o.ym, 5),
        title: `GRN ฐานของงวด (P1 @${o.price.a1}, P3 @${o.price.a3}${o.p4 ? `, P4 @${o.p4}` : ""})`,
        lines: [
          { product: P.P1.code, qty: QTY, price: o.price.a1 }, { product: P.P3.code, qty: QTY, price: o.price.a3 },
          ...(o.p4 ? [{ product: P.P4.code, qty: QTY, price: o.p4 }] : []),
        ],
      },
      { id: "0.2b", key: "grnP3", kind: "grn", date: d(o.ym, 14), title: `GRN P3 ลงวันที่ ${d(o.ym, 14)} @${o.price.p3}`, lines: [{ product: P.P3.code, qty: QTY, price: o.price.p3 }] },
      { id: "0.3a", key: "grnP2", kind: "grn", date: d(o.ym, 20), title: `GRN P2 ลงวันที่ ${d(o.ym, 20)} @${o.price.p2}`, lines: [{ product: P.P2.code, qty: QTY, price: o.price.p2 }] },
      { id: "0.3b", key: "siP2", kind: "stock-in", date: d(o.ym, 5), title: `SI P2 ลงวันที่ ${d(o.ym, 5)} @${o.price.si2} — สร้างหลัง GRN แต่วันที่เอกสารเก่ากว่า`, lines: [{ product: P.P2.code, qty: 5, price: o.price.si2 }] },
      { id: "0.3c", key: "siP1", kind: "stock-in", date: d(o.ym, 12), title: `SI P1 ลงวันที่ ${d(o.ym, 12)} @${o.price.si1} — ใหม่กว่า GRN ฐานของ P1`, lines: [{ product: P.P1.code, qty: 5, price: o.price.si1 }] },
    ],
    closeGate: [
      { key: "cg-grn-saved", kind: "grn-saved", product: P.P2, price: o.price.cg2, date: d(o.ym, 22), clear: "commit" },
      { key: "cg-grn-draft", kind: "grn-draft", product: PX, price: 20, date: d(o.ym, 26), clear: "delete" },
      { key: "cg-si-draft", kind: "si-draft", product: P.P3, price: o.price.draft3, date: d(o.ym, 25), clear: "delete" },
    ],
    costCases: o.costCases, rule: o.rule, fixedBy: o.fixedBy ?? "PR #706 (dev 1ac8dd487)",
  };
}

// หลัง #712 / #713 deploy (dev 716398089) — รอบ "ให้ผ่านโดยไม่ติดอะไรเลย" · FIFO last_cost (ยังไม่เคยเทสผ่าน UI หลัง #706)
const P09: Scenario = {
  ...FIFO,
  period: "2609",
  next: "2610",
  periodEnd: "2026-09-30",
  descPeriod: "2026-09",
  costFrom: { value: "last_cost", label: "Last cost" },
  nextMonth: { caption: "October 2026", day: "10/10/2026" },
  voidTrap: { key: "grnVoidP1", product: P.P1, price: 145, date: "2026-09-18" },
  case1Date: "2026-09-15",
  keys: { nextGrn: "grnNext", nextGrnDraft: "grnDraftNext", cnNext: "cnNext", cnDraftIn: "cnDraftIn" },
  nextGrn: { product: P.P3, price: 450, date: "2026-10-10", note: 'ใช้เป็น "GRN งวดหน้า" ของ P3 ในข้อ 2.9' },
  nextGrnDraftDate: "2026-10-12",
  cnNext: { grnKey: "grnA", product: P.P3, date: "2026-10-15" },
  cnDraftIn: { grnKey: "grnA", product: P.P1, date: "2026-09-20" },
  preClean: [],
  // ค้างจากงวด 08: GRN saved 09-10 P3 @440 (ข้อ 2.1) + GRN ร่าง 09-12 (ข้อ 2.1b)
  preCleanAuto: true,
  receipts: [
    {
      id: "0.2", key: "grnA", kind: "grn", date: "2026-09-05", title: "GRN ฐานของงวด 09 (P1 @120, P3 @300, P4 @60)",
      lines: [
        { product: P.P1.code, qty: QTY, price: 120 }, { product: P.P3.code, qty: QTY, price: 300 },
        { product: P.P4.code, qty: QTY, price: 60 },
      ],
    },
    {
      id: "0.2b", key: "grnP3", kind: "grn", date: "2026-09-14", title: "GRN P3 ลงวันที่ 09-14 @380 — ใหม่กว่า GRN 09-10 @440 ที่ค้างจากงวด 08",
      lines: [{ product: P.P3.code, qty: QTY, price: 380 }],
    },
    {
      id: "0.3a", key: "grnP2", kind: "grn", date: "2026-09-20", title: "GRN P2 ลงวันที่ 09-20 @235 — รับเข้าล่าสุดของ P2 ตามวันที่เอกสาร",
      lines: [{ product: P.P2.code, qty: QTY, price: 235 }],
    },
    {
      id: "0.3b", key: "siP2", kind: "stock-in", date: "2026-09-05",
      title: "SI P2 ลงวันที่ 09-05 @225 — สร้างหลัง GRN 09-20 แต่วันที่เอกสารเก่ากว่า (ต้องแพ้)",
      lines: [{ product: P.P2.code, qty: 5, price: 225 }],
    },
    {
      id: "0.3c", key: "siP1", kind: "stock-in", date: "2026-09-12", title: "SI P1 ลงวันที่ 09-12 @170 — ใหม่กว่า GRN 09-05 ของ P1 (last_cost นับ SI)",
      lines: [{ product: P.P1.code, qty: 5, price: 170 }],
    },
  ],
  closeGate: [
    { key: "cg-grn-saved", kind: "grn-saved", product: P.P2, price: 250, date: "2026-09-22", clear: "void" },
    { key: "cg-grn-draft", kind: "grn-draft", product: P.P3, price: 360, date: "2026-09-28", clear: "delete" },
    { key: "cg-si-draft", kind: "si-draft", product: P.P3, price: 395, date: "2026-09-25", clear: "delete" },
  ],
  costCases: [
    { p: P.P1, want: 170, wantFrom: "SI completed 09-12 @170", trap: "GRN void 09-18 @145 (ใหม่กว่า) · GRN 09-05 @120 (เก่ากว่า)", topic: "SI นับ · GRN void ไม่นับ" },
    { p: P.P2, want: 235, wantFrom: "GRN committed 09-20 @235", trap: "SI 09-05 @225 สร้างทีหลัง · GRN saved 09-22 @250 (FIFO ยังไม่ลงสต๊อก)", topic: "เทียบด้วยวันที่เอกสาร · FIFO ไม่นับ saved" },
    { p: P.P3, want: 380, wantFrom: "GRN committed 09-14 @380", trap: "GRN draft 09-28 @360 · SI ร่าง 09-25 @395 · GRN 09-10 @440 (เก่ากว่า) · GRN งวด 2610 @450", topic: "ร่างไม่นับ · GRN งวดหน้าไม่นับ" },
    { p: P.P4, side: "out", want: "posted", wantFrom: "ล็อตที่ตัดจริง", trap: "si.cost-from last_cost = 60", topic: "ของออกตีราคาตามล็อตที่ตัด (#709)" },
  ],
  rule: "ต้นทุนรับเข้าล่าสุด ณ สิ้นงวด จาก GRN committed (FIFO) หรือ SI completed เทียบด้วยวันที่เอกสาร · ของออก (SO) = ต้นทุนของล็อตที่ตัดจริง",
  fixedBy: "PR #702 · #706 · #708 · #709 · #712 · #713",
};

// รอบ r3: FIFO เริ่มที่ 2610 (งวดแรกหลังรีเซ็ต = เดือนนี้) — แบบเดียวกับ p09 เลื่อนวันที่ทั้งหมดมาเดือน ต.ค.
const P10: Scenario = {
  ...P09,
  period: "2610",
  next: "2611",
  periodEnd: "2026-10-31",
  descPeriod: "2026-10",
  nextMonth: { caption: "November 2026", day: "11/10/2026" }, // M/D/YYYY — ต้นฉบับสลับเป็น 10/11 (= 11 ต.ค.) ทำให้ข้อ 2.2/2.3 ผ่านเสมอ
  voidTrap: { key: "grnVoidP1", product: P.P1, price: 145, date: "2026-10-18" },
  case1Date: "2026-10-15",
  nextGrn: { product: P.P3, price: 450, date: "2026-11-10", note: 'ใช้เป็น "GRN งวดหน้า" ของ P3 ในข้อ 2.9' },
  nextGrnDraftDate: "2026-11-12",
  cnNext: { grnKey: "grnA", product: P.P3, date: "2026-11-15" },
  cnDraftIn: { grnKey: "grnA", product: P.P1, date: "2026-10-20" },
  receipts: [
    {
      id: "0.2", key: "grnA", kind: "grn", date: "2026-10-05", title: "GRN ฐานของงวด 10 (P1 @120, P3 @300, P4 @60)",
      lines: [
        { product: P.P1.code, qty: QTY, price: 120 }, { product: P.P3.code, qty: QTY, price: 300 },
        { product: P.P4.code, qty: QTY, price: 60 },
      ],
    },
    {
      id: "0.2b", key: "grnP3", kind: "grn", date: "2026-10-14", title: "GRN P3 ลงวันที่ 10-14 @380 — ใหม่กว่า GRN 10-05 @300",
      lines: [{ product: P.P3.code, qty: QTY, price: 380 }],
    },
    {
      id: "0.3a", key: "grnP2", kind: "grn", date: "2026-10-20", title: "GRN P2 ลงวันที่ 10-20 @235 — รับเข้าล่าสุดของ P2 ตามวันที่เอกสาร",
      lines: [{ product: P.P2.code, qty: QTY, price: 235 }],
    },
    {
      id: "0.3b", key: "siP2", kind: "stock-in", date: "2026-10-05",
      title: "SI P2 ลงวันที่ 10-05 @225 — สร้างหลัง GRN 10-20 แต่วันที่เอกสารเก่ากว่า (ต้องแพ้)",
      lines: [{ product: P.P2.code, qty: 5, price: 225 }],
    },
    {
      id: "0.3c", key: "siP1", kind: "stock-in", date: "2026-10-12", title: "SI P1 ลงวันที่ 10-12 @170 — ใหม่กว่า GRN 10-05 ของ P1 (last_cost นับ SI)",
      lines: [{ product: P.P1.code, qty: 5, price: 170 }],
    },
  ],
  closeGate: [
    { key: "cg-grn-saved", kind: "grn-saved", product: P.P2, price: 250, date: "2026-10-22", clear: "void" },
    { key: "cg-grn-draft", kind: "grn-draft", product: P.P3, price: 360, date: "2026-10-28", clear: "delete" },
    { key: "cg-si-draft", kind: "si-draft", product: P.P3, price: 395, date: "2026-10-25", clear: "delete" },
  ],
  costCases: [
    { p: P.P1, want: 170, wantFrom: "SI completed 10-12 @170", trap: "GRN void 10-18 @145 (ใหม่กว่า) · GRN 10-05 @120 (เก่ากว่า)", topic: "SI นับ · GRN void ไม่นับ" },
    { p: P.P2, want: 235, wantFrom: "GRN committed 10-20 @235", trap: "SI 10-05 @225 สร้างทีหลัง · GRN saved 10-22 @250 (FIFO ยังไม่ลงสต๊อก)", topic: "เทียบด้วยวันที่เอกสาร · FIFO ไม่นับ saved" },
    { p: P.P3, want: 380, wantFrom: "GRN committed 10-14 @380", trap: "GRN draft 10-28 @360 · SI ร่าง 10-25 @395 · GRN 10-05 @300 (เก่ากว่า) · GRN งวด 2611 @450", topic: "ร่างไม่นับ · GRN งวดหน้าไม่นับ" },
    { p: P.P4, side: "out", want: "posted", wantFrom: "ล็อตที่ตัดจริง", trap: "si.cost-from last_cost = 60", topic: "ของออกตีราคาตามล็อตที่ตัด (#709)" },
  ],
};

// รอบ r4 (หลัง #724 deploy): AVG 2607 / FIFO 2611 — งวดถัดจากรอบ r3
const AVG2607 = avgPeriod({
  period: "2607", next: "2608", ym: "2026-07", nextYm: "2026-08", periodEnd: "2026-07-31", nextCaption: "August 2026",
  costFrom: { value: "average", label: "Average" }, preCleanAuto: true, p4: 70,
  price: { a1: 140, a3: 340, p3: 400, p2: 275, si2: 240, si1: 190, void1: 165, cg2: 280, draft3: 410, next3: 460 },
  rule: "ค่าเฉลี่ย ณ ปิดงวดที่นับ = มูลค่ารับเข้าทั้งงวด (รวมยอดยกมา) ÷ จำนวน ของสินค้า ทุกคลัง (สูตร computePeriodAverages) · ของออก (SO) = ต้นทุนที่บัญชีโพสต์",
  fixedBy: "PR #706 · #708 · #709 · #712 · #713 · #724",
  costCases: [
    { p: P.P1, want: "period-average", wantFrom: "ค่าเฉลี่ยงวด 2607", trap: "GRN void 07-18 @165 ต้องไม่อยู่ในค่าเฉลี่ย", topic: "void ไม่ปนค่าเฉลี่ย" },
    { p: P.P2, want: "period-average", wantFrom: "ค่าเฉลี่ยงวด 2607", trap: "GRN saved 07-22 @280 ต้องอยู่ในค่าเฉลี่ย", topic: "GRN saved ระหว่างนับถูกนับ (AVG)" },
    { p: P.P3, want: "period-average", wantFrom: "ค่าเฉลี่ยงวด 2607", trap: "GRN งวด 2608 @460 · SI ร่าง @410 ต้องไม่อยู่ในค่าเฉลี่ย", topic: "รับเข้างวดหน้าไม่ปนค่าเฉลี่ย" },
    { p: P.P4, side: "out", want: "posted", wantFrom: "ค่าเฉลี่ยที่บัญชีใช้ตัด", trap: "—", topic: "ของออกตีราคาตามบัญชี (#709)" },
  ],
});

// รอบ catch-up 2026-11-22: CARMEN-AVG งวด 2612 (งวด 2611 ปิดแล้ว) — ราคาเหมือน avg2607; ระวัง: FE 90018c6d จำกัดวันที่เอกสารไม่เกินวันนี้
// งวด 2612 เริ่ม 2026-12-01 จึงยังสร้างเอกสารลงงวดนี้ผ่าน UI ไม่ได้ก่อนถึงวันนั้น (phase ที่ต้องลงวันที่ในงวดจะ skip พร้อมเหตุผล)
const AVG2612 = avgPeriod({
  period: "2612", next: "2701", ym: "2026-12", nextYm: "2027-01", periodEnd: "2026-12-31", nextCaption: "January 2027",
  costFrom: { value: "average", label: "Average" }, preCleanAuto: true, p4: 70,
  price: { a1: 140, a3: 340, p3: 400, p2: 275, si2: 240, si1: 190, void1: 165, cg2: 280, draft3: 410, next3: 460 },
  rule: "ค่าเฉลี่ย ณ ปิดงวดที่นับ = มูลค่ารับเข้าทั้งงวด (รวมยอดยกมา) ÷ จำนวน ของสินค้า ทุกคลัง (สูตร computePeriodAverages) · ของออก (SO) = ต้นทุนที่บัญชีโพสต์",
  fixedBy: "PR #706 · #708 · #709 · #712 · #713 · #724",
  costCases: AVG2607.costCases.map((c) => ({
    ...c,
    wantFrom: c.wantFrom.replace("2607", "2612"),
    trap: c.trap.replace("2608", "2701").replace(/\b07-(\d\d)/g, "12-$1").replace("2607", "2612"),
  })),
});

const P11: Scenario = {
  ...P10,
  period: "2611",
  next: "2612",
  periodEnd: "2026-11-30",
  descPeriod: "2026-11",
  nextMonth: { caption: "December 2026", day: "12/10/2026" }, // M/D/YYYY — ต้นฉบับสลับเป็น 10/12
  voidTrap: { key: "grnVoidP1", product: P.P1, price: 145, date: "2026-11-18" },
  case1Date: "2026-11-15",
  nextGrn: { product: P.P3, price: 450, date: "2026-12-10", note: 'ใช้เป็น "GRN งวดหน้า" ของ P3 ในข้อ 2.9' },
  nextGrnDraftDate: "2026-12-12",
  cnNext: { grnKey: "grnA", product: P.P3, date: "2026-12-15" },
  cnDraftIn: { grnKey: "grnA", product: P.P1, date: "2026-11-20" },
  receipts: P10.receipts.map((r) => ({ ...r, date: r.date.replace("2026-10-", "2026-11-"), title: r.title.replace(/\b10-(\d\d)/g, "11-$1").replace("งวด 10", "งวด 11") })),
  closeGate: P10.closeGate.map((g) => ({ ...g, date: g.date.replace("2026-10-", "2026-11-") })),
  costCases: P10.costCases.map((c) => ({ ...c, wantFrom: c.wantFrom.replace(/\b10-(\d\d)/g, "11-$1"), trap: c.trap.replace(/\b10-(\d\d)/g, "11-$1").replace("2611", "2612") })),
};

/** ตั้งชื่อ scenario ไว้จริงไหม — ไม่ตั้ง = ใช้ค่าตั้งต้นได้แค่ตอน list เทส ตอนรันจริง requireScenario() จะหยุดก่อน */
export const SCENARIO_SET = Boolean(process.env.E2E_PERIOD_SCENARIO);
export const SCENARIO = (process.env.E2E_PERIOD_SCENARIO ?? "avg2607") as "p09" | "p10" | "p11" | "avg2607" | "avg2612";
export const SCN: Scenario = { p09: P09, p10: P10, p11: P11, avg2607: AVG2607, avg2612: AVG2612 }[SCENARIO];
export const PERIOD = SCN.period;
export const NEXT = SCN.next;
