// scripts/data-reset/docs/refs.ts
// GET responses go through the gateway's @CollapseRefs: `unit_id` comes back as `unit: { id, … }`.
// response ของ GET ผ่าน @CollapseRefs — `unit_id` กลับมาเป็น `unit: { id }`

/** The id of reference `base` on a row, flat (`base_id`) or collapsed (`base.id`). */
export function refId(row: any, base: string): string | undefined {
  const flat = row?.[`${base}_id`];
  if (typeof flat === "string" && flat) return flat;
  const nested = row?.[base]?.id;
  return typeof nested === "string" && nested ? nested : undefined;
}
