// scripts/data-reset/period.ts
// An open inventory period covering today, so GRN / CN / adjustment / SR issue can post. Opening is
// normally irreversible; on TEST BU the next reset undoes it (spec step 0).
// เปิดงวดที่ครอบวันนี้ — ปกติย้อนไม่ได้ แต่บน TEST BU reset รอบถัดไปจะล้างให้
import type { ResetConfig } from "./config";
import type { Sessions } from "./sessions";
import type { StepResult } from "./step-result";

const BU_TIME_ZONE = "Asia/Bangkok";

function localDate(now: Date): { year: number; month: number; day: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BU_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return { year: Number(get("year")), month: Number(get("month")), day: `${get("year")}-${get("month")}-${get("day")}` };
}

export function planPeriod(now: Date): { fiscal_year: number; fiscal_month: number; start_at: string } {
  const { year, month } = localDate(now);
  return { fiscal_year: year, fiscal_month: month, start_at: `${year}-${String(month).padStart(2, "0")}-01` };
}

function coversToday(period: { status?: string; start_at?: string; end_at?: string } | undefined, today: string): boolean {
  if (!period || period.status !== "open" || !period.start_at || !period.end_at) return false;
  const day = (iso: string) => localDate(new Date(iso)).day;
  return day(period.start_at) <= today && today <= day(period.end_at);
}

export async function seedPeriod(sessions: Sessions, cfg: ResetConfig, now: Date = new Date()): Promise<StepResult> {
  const admin = await sessions.client(cfg.adminEmail);
  const base = `/api/${cfg.buCode}/inventory-periods`;
  const result: StepResult = { step: "period", created: 0, skipped: 0, failed: [] };
  const current = await admin.get(`${base}/current`);
  if (current.ok && coversToday(current.body?.data, localDate(now).day)) {
    result.skipped = 1;
    return result;
  }
  const res = await admin.post(base, planPeriod(now));
  if (res.ok) result.created = 1;
  else result.failed.push(`POST ${base} → ${res.status} ${JSON.stringify(res.body?.message ?? "")}`);
  return result;
}
