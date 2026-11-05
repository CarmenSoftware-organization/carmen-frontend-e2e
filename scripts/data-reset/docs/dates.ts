// scripts/data-reset/docs/dates.ts
/** `YYYY-MM-DD` plus n calendar days. / วันที่บวก n วัน */
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * A day as the gateway's `z.string().datetime()` accepts it: noon in Bangkok, written in UTC, so
 * it is the same calendar day in either zone.
 * วันที่ในรูปที่ gateway รับ — เที่ยงวันเวลาไทย เขียนเป็น UTC จึงเป็นวันเดียวกันทั้งสองเขต
 */
export function isoDay(day: string): string {
  return `${day}T05:00:00.000Z`;
}
