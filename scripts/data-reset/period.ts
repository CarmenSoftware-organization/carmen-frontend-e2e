// scripts/data-reset/period.ts
// An open inventory period covering today, so GRN / CN / adjustment / SR issue can post, plus the NEXT
// month's period pre-generated the way period end / the admin "generate" action does (status open, a later
// fiscal month — the BE's current period is the earliest open one, so it stays this month). Creating is
// normally irreversible; on TEST BU the next reset undoes it (spec step 0).
// เปิดงวดที่ครอบวันนี้ และสร้างงวดเดือนถัดไปล่วงหน้าแบบเดียวกับที่ปิดงวด/ปุ่มสร้างงวดทำ (สถานะ open เดือนมากกว่า
// งวดปัจจุบันของ BE คืองวดเปิดที่เก่าสุด จึงยังเป็นเดือนนี้) — ปกติย้อนไม่ได้ แต่บน TEST BU reset รอบถัดไปล้างให้
import type { ResetConfig } from "./config";
import type { Sessions } from "./sessions";
import type { StepResult } from "./step-result";

const BU_TIME_ZONE = "Asia/Bangkok";

export function localDate(now: Date): { year: number; month: number; day: string } {
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

/** The fiscal month after the Bangkok calendar month of `now` (December rolls to January of next year). */
export function planNextPeriod(now: Date): { fiscal_year: number; fiscal_month: number } {
  const { year, month } = localDate(now);
  return month === 12 ? { fiscal_year: year + 1, fiscal_month: 1 } : { fiscal_year: year, fiscal_month: month + 1 };
}

/** The Bangkok month before `now` (January rolls back to December of the year before); start_at is its first day. */
export function planHistoryPeriod(now: Date): { fiscal_year: number; fiscal_month: number; start_at: string } {
  const { year, month } = localDate(now);
  const [fiscal_year, fiscal_month] = month === 1 ? [year - 1, 12] : [year, month - 1];
  return { fiscal_year, fiscal_month, start_at: `${fiscal_year}-${String(fiscal_month).padStart(2, "0")}-01` };
}

function coversToday(period: { status?: string; start_at?: string; end_at?: string } | undefined, today: string): boolean {
  if (!period || period.status !== "open" || !period.start_at || !period.end_at) return false;
  const day = (iso: string) => localDate(new Date(iso)).day;
  return day(period.start_at) <= today && today <= day(period.end_at);
}

export async function seedPeriod(
  sessions: Sessions, cfg: ResetConfig, now: Date = new Date(), opts: { withHistory?: boolean } = {},
): Promise<StepResult> {
  if (opts.withHistory) return seedPeriodWithHistory(sessions, cfg, now);
  const admin = await sessions.client(cfg.adminEmail);
  const base = `/api/${cfg.buCode}/inventory-periods`;
  const result: StepResult = { step: "period", created: 0, skipped: 0, failed: [] };
  const current = await admin.get(`${base}/current`);
  if (current.ok && coversToday(current.body?.data, localDate(now).day)) {
    result.skipped = 1;
  } else {
    const res = await admin.post(base, planPeriod(now));
    if (res.ok) result.created = 1;
    else {
      result.failed.push(`POST ${base} → ${res.status} ${JSON.stringify(res.body?.message ?? "")}`);
      return result;
    }
  }
  await seedNextPeriod(admin, base, now, result);
  return result;
}

type Admin = Awaited<ReturnType<Sessions["client"]>>;

async function listPeriods(admin: Admin, base: string): Promise<{ ok: boolean; status: number; rows: any[] }> {
  const res = await admin.get(`${base}?perpage=100`);
  return { ok: res.ok, status: res.status, rows: Array.isArray(res.body?.data) ? res.body.data : [] };
}

/**
 * Top the open periods up by one via the generate endpoint (the only way to add a period once the BU has
 * one — POST create is refused unless the BU is empty), then read back that next month exists.
 */
async function seedNextPeriod(admin: Admin, base: string, now: Date, result: StepResult): Promise<void> {
  const next = planNextPeriod(now);
  const has = (rows: any[]) => rows.some((p) => p.fiscal_year === next.fiscal_year && p.fiscal_month === next.fiscal_month);
  const before = await listPeriods(admin, base);
  if (!before.ok) {
    result.failed.push(`GET ${base} → ${before.status}`);
    return;
  }
  if (has(before.rows)) {
    result.skipped += 1;
    return;
  }
  const open = before.rows.filter((p) => p.status === "open" || p.status === "locked").length;
  const res = await admin.post(`${base}/next`, { count: open + 1, start_day: 1 });
  if (!res.ok) {
    result.failed.push(`POST ${base}/next → ${res.status} ${JSON.stringify(res.body?.message ?? "")}`);
    return;
  }
  const after = await listPeriods(admin, base);
  if (after.ok && has(after.rows)) result.created += 1;
  else result.failed.push(`next period ${next.fiscal_year}-${String(next.fiscal_month).padStart(2, "0")} not found after POST ${base}/next`);
}

const ym = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;

/**
 * --with-history: last month becomes the FIRST (active) period — the BU is empty right after the reset, the only
 * time POST create is allowed — then generate adds this month and next month. The BE's current period is the oldest
 * open one, so `current` = last month while an open period still covers today.
 * เปิดงวดเดือนก่อนเป็นงวดแรก (BU ว่างหลัง reset) แล้ว generate เดือนนี้ + เดือนหน้า — งวดปัจจุบันของ BE = งวดเปิดที่เก่าสุด
 */
async function seedPeriodWithHistory(sessions: Sessions, cfg: ResetConfig, now: Date): Promise<StepResult> {
  const admin = await sessions.client(cfg.adminEmail);
  const base = `/api/${cfg.buCode}/inventory-periods`;
  const result: StepResult = { step: "period", created: 0, skipped: 0, failed: [] };
  const history = planHistoryPeriod(now);
  const next = planNextPeriod(now);
  const today = localDate(now).day;
  const hasMonth = (rows: any[], y: number, m: number) => rows.some((p) => p.fiscal_year === y && p.fiscal_month === m);

  const first = await listPeriods(admin, base);
  if (!first.ok) {
    result.failed.push(`GET ${base} → ${first.status}`);
    return result;
  }
  if (hasMonth(first.rows, history.fiscal_year, history.fiscal_month)) {
    result.skipped += 1;
  } else {
    const res = await admin.post(base, history);
    if (!res.ok) {
      result.failed.push(`POST ${base} → ${res.status} ${JSON.stringify(res.body?.message ?? "")}`);
      return result;
    }
    result.created += 1;
  }

  let rows = (await listPeriods(admin, base)).rows;
  for (let call = 0; call < 3; call++) {
    if (rows.some((p) => coversToday(p, today)) && hasMonth(rows, next.fiscal_year, next.fiscal_month)) break;
    const open = rows.filter((p) => p.status === "open" || p.status === "locked").length;
    const res = await admin.post(`${base}/next`, { count: open + 1, start_day: 1 });
    if (!res.ok) {
      result.failed.push(`POST ${base}/next → ${res.status} ${JSON.stringify(res.body?.message ?? "")}`);
      return result;
    }
    result.created += 1;
    rows = (await listPeriods(admin, base)).rows;
  }
  if (!rows.some((p) => coversToday(p, today))) result.failed.push(`no open period covers ${today} after generate (3 calls)`);
  if (!hasMonth(rows, next.fiscal_year, next.fiscal_month)) result.failed.push(`next period ${ym(next.fiscal_year, next.fiscal_month)} missing after generate (3 calls)`);

  const current = await admin.get(`${base}/current`);
  const cur = current.body?.data;
  if (!current.ok || cur?.fiscal_year !== history.fiscal_year || cur?.fiscal_month !== history.fiscal_month) {
    result.failed.push(`GET ${base}/current → expected ${ym(history.fiscal_year, history.fiscal_month)}, got ${current.ok ? ym(cur?.fiscal_year, cur?.fiscal_month) : current.status}`);
  }
  return result;
}
