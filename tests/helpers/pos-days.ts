/**
 * Sale-day allocation for the POS specs. Spec 140 (import) counts forward from the period start,
 * spec 141 (sales consumption) backward from the period end, so the two never share a day.
 * จัดวันขายของสองสเปก: 140 นับจากต้นงวด 141 นับจากท้ายงวด ไม่ชนกัน
 */
export interface Period {
  start: string;
  end: string;
}

export const MAX_N = { 140: 6, 141: 16 } as const;
const DAY_MS = 86_400_000;

const toMs = (d: string) => Date.parse(`${d}T00:00:00Z`);
const fromMs = (ms: number) => new Date(ms).toISOString().slice(0, 10);

function lengthOf(period: Period): number {
  return Math.round((toMs(period.end) - toMs(period.start)) / DAY_MS) + 1;
}

/** Days reserved for a spec (YYYY-MM-DD), whole range. */
function reserved(spec: 140 | 141, period: Period): string[] {
  const out: string[] = [];
  for (let n = 1; n <= MAX_N[spec]; n++) out.push(dayAt(spec, n, period));
  return out;
}

function dayAt(spec: 140 | 141, n: number, period: Period): string {
  return fromMs(spec === 140 ? toMs(period.start) + (n - 1) * DAY_MS : toMs(period.end) - (n - 1) * DAY_MS);
}

export function saleDay(spec: 140 | 141, n: number, period: Period): string {
  if (!Number.isInteger(n) || n < 1 || n > MAX_N[spec]) {
    throw new Error(`pos-days: spec ${spec} day n=${n} is outside 1..${MAX_N[spec]}`);
  }
  const length = lengthOf(period);
  if (MAX_N[140] + MAX_N[141] > length) {
    throw new Error(`pos-days: period ${period.start}..${period.end} (${length} days) is too short for both specs`);
  }
  return dayAt(spec, n, period);
}

/**
 * `count` distinct days strictly before yesterday, inside the period and outside both specs' ranges.
 * null when the month is too young to have that many.
 */
export function pastDays(period: Period, today: string, count: number): string[] | null {
  const yesterdayMs = toMs(today) - DAY_MS;
  const taken = new Set([...reserved(140, period), ...reserved(141, period)]);
  const out: string[] = [];
  for (let ms = toMs(period.start); ms < yesterdayMs && ms <= toMs(period.end); ms += DAY_MS) {
    const day = fromMs(ms);
    if (!taken.has(day)) out.push(day);
  }
  return out.length >= count ? out.slice(0, count) : null;
}
