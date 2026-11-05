// scripts/data-reset/docs/dates.ts
/** `YYYY-MM-DD` plus n calendar days. / วันที่บวก n วัน */
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
