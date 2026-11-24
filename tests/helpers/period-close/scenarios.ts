// ข้อมูลทดสอบของรอบปิดงวด — คำนวณจาก BU (E2E_PERIOD_BU) + วันที่วันนี้ (เวลา Bangkok) ไม่มี scenario เขียนมืออีก
// งวดที่ปิด = เดือนที่แล้ว · งวดถัดไป = เดือนนี้ · สินค้า E2E-PC-1..4 / E2E-PC-X มาจาก `data:reset --bu <BU> --with-history`
// (scripts/data-reset/docs/period-close.ts: PC_PRODUCTS, PC_SPARE — import ตรงไม่ได้เพราะไฟล์นั้นลากโค้ด Bun-only มาด้วย จึงซ้ำรหัสไว้ที่นี่)
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { BU_CODE, TEST_BUS, type TestBuCode } from "../../test-users";

export const P = {
  P1: { code: "E2E-PC-1", name: "E2E-PC-1" },
  P2: { code: "E2E-PC-2", name: "E2E-PC-2" },
  P3: { code: "E2E-PC-3", name: "E2E-PC-3" },
  P4: { code: "E2E-PC-4", name: "E2E-PC-4" }, // นับขาด → SO ชดเชย
} as const;

/** สินค้าสำรองที่ไม่อยู่ในการทดสอบราคา — ใช้เป็นเอกสารค้างของ Case 1 */
export const PX = { code: "E2E-PC-X", name: "E2E-PC-X" };

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
  /** ชื่อ schema ของ tenant — คำนวณจากรหัส BU ไม่ได้ (ชื่อ opaque) scenarioFor ใส่ "" ไว้ แล้ว Task 4 เติมตอนรันจากตาราง business unit */
  schema: string;
  /** วิธีคิดต้นทุนของ BU — กำหนดสูตรยกยอดในข้อ 2.11 */
  method: "fifo" | "average" | "average_per_location";
  /** คลังแรกของ BU ที่ seed สินค้า E2E-PC ไว้ (อ่านจาก runs/period-close/<BU>/location.json) */
  location: { code: string; name: string };
  /** เหตุผลของใบลดหนี้ (master ต่อ BU ไม่เหมือนกัน) — scenarioFor ใส่ "" แล้วเติมตอนรัน */
  cnReason: string;
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
  /** (เลิกใช้ — ว่างเสมอ) */
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

const pad = (n: number) => String(n).padStart(2, "0");

/** วันที่ Bangkok (YYYY-MM-DD) ของวันนี้ */
export function bangkokToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

/** FE จำกัดวันที่เอกสารไม่เกินวันนี้ และเอกสารงวดหน้าลงวันที่ 1/2/3 — ก่อนวันที่ 3 สร้างไม่ได้ */
export function scenarioTooEarly(today: string): string | null {
  const day = Number(today.slice(8, 10));
  return day < 3 ? `วันที่ ${today} (Bangkok) ยังไม่ถึงวันที่ 3 — เอกสารงวดหน้าลงวันที่ 1/2/3 ไม่ได้ (FE จำกัดวันที่ไม่เกินวันนี้) รันได้ตั้งแต่วันที่ 3` : null;
}

/** สร้าง scenario ของ BU ทดสอบ: ปิดงวดของเดือนที่แล้ว, เอกสารงวดหน้าลงวันที่ 1/2/3 ของเดือนนี้ */
export function scenarioFor(bu: TestBuCode, today: string, loc: { code: string; name: string }): Scenario {
  const method = TEST_BUS.find((b) => b.code === bu)?.method ?? "average";
  const fifo = method === "fifo";
  const [ny, nm] = today.split("-").map(Number);
  const ly = nm === 1 ? ny - 1 : ny;
  const lm = nm === 1 ? 12 : nm - 1;
  const ym = `${ly}-${pad(lm)}`;
  const nextYm = `${ny}-${pad(nm)}`;
  const d = (m: string, day: number) => `${m}-${pad(day)}`;
  const period = `${String(ly).slice(2)}${pad(lm)}`;
  const next = `${String(ny).slice(2)}${pad(nm)}`;
  const periodEnd = d(ym, new Date(Date.UTC(ly, lm, 0)).getUTCDate());
  const mmdd = (day: number) => `${pad(lm)}-${pad(day)}`;
  const price = fifo
    ? { a1: 120, a3: 300, p4: 60, p3: 380, p2: 235, si2: 225, si1: 170, void1: 145, cg2: 250, draft3: 395, next3: 450 }
    : { a1: 140, a3: 340, p4: 70, p3: 400, p2: 275, si2: 240, si1: 190, void1: 165, cg2: 280, draft3: 410, next3: 460 };
  const monthName = new Date(Date.UTC(ny, nm - 1, 1)).toLocaleString("en-US", { month: "long", timeZone: "UTC" });
  return {
    bu, schema: "", method, location: loc, cnReason: "",
    period, next, periodEnd, descPeriod: ym,
    costFrom: fifo ? { value: "last_cost", label: "Last cost" } : { value: "average", label: "Average" },
    nextMonth: { caption: `${monthName} ${ny}`, day: `${nm}/1/${ny}` }, // M/D/YYYY
    voidTrap: { key: "grnVoidP1", product: P.P1, price: price.void1, date: d(ym, 18) },
    case1Date: d(ym, 15),
    keys: { nextGrn: "grnNext", nextGrnDraft: "grnDraftNext", cnNext: "cnNext", cnDraftIn: "cnDraftIn" },
    nextGrn: { product: P.P3, price: price.next3, date: d(nextYm, 1), note: 'ใช้เป็น "GRN งวดหน้า" ของ P3 ในข้อ 2.9' },
    nextGrnDraftDate: d(nextYm, 2),
    cnNext: { grnKey: "grnA", product: P.P3, date: d(nextYm, 3) },
    cnDraftIn: { grnKey: "grnA", product: P.P1, date: d(ym, 20) },
    preClean: [],
    preCleanAuto: false,
    receipts: [
      {
        id: "0.2", key: "grnA", kind: "grn", date: d(ym, 5),
        title: `GRN ฐานของงวด (P1 @${price.a1}, P3 @${price.a3}, P4 @${price.p4})`,
        lines: [
          { product: P.P1.code, qty: QTY, price: price.a1 }, { product: P.P3.code, qty: QTY, price: price.a3 },
          { product: P.P4.code, qty: QTY, price: price.p4 },
        ],
      },
      { id: "0.2b", key: "grnP3", kind: "grn", date: d(ym, 14), title: `GRN P3 ลงวันที่ ${mmdd(14)} @${price.p3}`, lines: [{ product: P.P3.code, qty: QTY, price: price.p3 }] },
      { id: "0.3a", key: "grnP2", kind: "grn", date: d(ym, 20), title: `GRN P2 ลงวันที่ ${mmdd(20)} @${price.p2}`, lines: [{ product: P.P2.code, qty: QTY, price: price.p2 }] },
      { id: "0.3b", key: "siP2", kind: "stock-in", date: d(ym, 5), title: `SI P2 ลงวันที่ ${mmdd(5)} @${price.si2} — สร้างหลัง GRN แต่วันที่เอกสารเก่ากว่า`, lines: [{ product: P.P2.code, qty: 5, price: price.si2 }] },
      { id: "0.3c", key: "siP1", kind: "stock-in", date: d(ym, 12), title: `SI P1 ลงวันที่ ${mmdd(12)} @${price.si1} — ใหม่กว่า GRN ฐานของ P1`, lines: [{ product: P.P1.code, qty: 5, price: price.si1 }] },
    ],
    // FIFO: GRN saved ยังไม่ลงสต๊อก → void · AVG: ลงสต๊อกตอน save → commit (void ทีหลังทำยอดในใบนับเพี้ยน)
    closeGate: fifo
      ? [
          { key: "cg-grn-saved", kind: "grn-saved", product: P.P2, price: price.cg2, date: d(ym, 22), clear: "void" },
          { key: "cg-grn-draft", kind: "grn-draft", product: P.P3, price: 360, date: d(ym, 28), clear: "delete" },
          { key: "cg-si-draft", kind: "si-draft", product: P.P3, price: price.draft3, date: d(ym, 25), clear: "delete" },
        ]
      : [
          { key: "cg-grn-saved", kind: "grn-saved", product: P.P2, price: price.cg2, date: d(ym, 22), clear: "commit" },
          { key: "cg-grn-draft", kind: "grn-draft", product: PX, price: 20, date: d(ym, 26), clear: "delete" },
          { key: "cg-si-draft", kind: "si-draft", product: P.P3, price: price.draft3, date: d(ym, 25), clear: "delete" },
        ],
    costCases: fifo
      ? [
          { p: P.P1, want: price.si1, wantFrom: `SI completed ${mmdd(12)} @${price.si1}`, trap: `GRN void ${mmdd(18)} @${price.void1} (ใหม่กว่า) · GRN ${mmdd(5)} @${price.a1} (เก่ากว่า)`, topic: "SI นับ · GRN void ไม่นับ" },
          { p: P.P2, want: price.p2, wantFrom: `GRN committed ${mmdd(20)} @${price.p2}`, trap: `SI ${mmdd(5)} @${price.si2} สร้างทีหลัง · GRN saved ${mmdd(22)} @${price.cg2} (FIFO ยังไม่ลงสต๊อก)`, topic: "เทียบด้วยวันที่เอกสาร · FIFO ไม่นับ saved" },
          { p: P.P3, want: price.p3, wantFrom: `GRN committed ${mmdd(14)} @${price.p3}`, trap: `GRN draft ${mmdd(28)} @360 · SI ร่าง ${mmdd(25)} @${price.draft3} · GRN ${mmdd(5)} @${price.a3} (เก่ากว่า) · GRN งวด ${next} @${price.next3}`, topic: "ร่างไม่นับ · GRN งวดหน้าไม่นับ" },
          { p: P.P4, side: "out", want: "posted", wantFrom: "ล็อตที่ตัดจริง", trap: `si.cost-from last_cost = ${price.p4}`, topic: "ของออกตีราคาตามล็อตที่ตัด (#709)" },
        ]
      : [
          { p: P.P1, want: "period-average", wantFrom: `ค่าเฉลี่ยงวด ${period}`, trap: `GRN void ${mmdd(18)} @${price.void1} ต้องไม่อยู่ในค่าเฉลี่ย`, topic: "void ไม่ปนค่าเฉลี่ย" },
          { p: P.P2, want: "period-average", wantFrom: `ค่าเฉลี่ยงวด ${period}`, trap: `GRN saved ${mmdd(22)} @${price.cg2} ต้องอยู่ในค่าเฉลี่ย`, topic: "GRN saved ระหว่างนับถูกนับ (AVG)" },
          { p: P.P3, want: "period-average", wantFrom: `ค่าเฉลี่ยงวด ${period}`, trap: `GRN งวด ${next} @${price.next3} · SI ร่าง @${price.draft3} ต้องไม่อยู่ในค่าเฉลี่ย`, topic: "รับเข้างวดหน้าไม่ปนค่าเฉลี่ย" },
          { p: P.P4, side: "out", want: "posted", wantFrom: "ค่าเฉลี่ยที่บัญชีใช้ตัด", trap: "—", topic: "ของออกตีราคาตามบัญชี (#709)" },
        ],
    rule: fifo
      ? "ต้นทุนรับเข้าล่าสุด ณ สิ้นงวด จาก GRN committed (FIFO) หรือ SI completed เทียบด้วยวันที่เอกสาร · ของออก (SO) = ต้นทุนของล็อตที่ตัดจริง"
      : "ค่าเฉลี่ย ณ ปิดงวดที่นับ = มูลค่ารับเข้าทั้งงวด (รวมยอดยกมา) ÷ จำนวน ของสินค้า ทุกคลัง (สูตร computePeriodAverages) · ของออก (SO) = ต้นทุนที่บัญชีโพสต์",
    fixedBy: "PR #702 · #706 · #708 · #709 · #712 · #713 · #724",
  };
}

/** ตั้ง E2E_PERIOD_BU ไว้จริงไหม — ไม่ตั้ง = ใช้ BU_CODE ได้แค่ตอน --list ตอนรันจริง requireScenario() จะหยุดก่อน */
export const SCENARIO_SET = Boolean(process.env.E2E_PERIOD_BU);
/** รหัส BU ที่ใช้ (context.ts อ่านเพื่อแสดงชื่อรอบ) */
export const SCENARIO: TestBuCode = (process.env.E2E_PERIOD_BU as TestBuCode | undefined) ?? BU_CODE;

function readLocation(bu: string): { code: string; name: string } {
  try {
    const file = join(process.cwd(), "runs", "period-close", bu, "location.json");
    if (existsSync(file)) {
      const j = JSON.parse(readFileSync(file, "utf8")) as { code?: string; name?: string };
      if (j.code) return { code: j.code, name: j.name ?? j.code };
    }
  } catch {
    // ไม่มีไฟล์/อ่านไม่ได้ = ใช้ placeholder
  }
  return { code: "?", name: "?" };
}

export const SCN: Scenario = scenarioFor(SCENARIO, bangkokToday(), readLocation(SCENARIO));
export const PERIOD = SCN.period;
export const NEXT = SCN.next;
/** คลังแรกของ BU (คลังที่ seed สินค้า E2E-PC-*) — spec ใช้ชื่อ L */
export const L = SCN.location;
