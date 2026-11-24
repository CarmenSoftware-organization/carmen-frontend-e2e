// scripts/data-reset/docs/period-close.ts
// Period-close base: four products (E2E-PC-1..4) plus one spare (E2E-PC-X), copied from a template
// product and linked to the FIRST inventory location only — no stock, no documents. The period-close
// suite (910–924) builds all its own movements on top; `--with-history` seeds nothing else.
// Also clears the local evidence folder runs/period-close/<BU>/ so a rerun starts clean.
// ฐานของชุดปิดงวด: สินค้า E2E-PC 4 ตัว + ตัวสำรอง ผูก location แรกแห่งเดียว ไม่มีสต๊อก/เอกสาร
import { rmSync } from "node:fs";
import { join } from "node:path";
import type { ResetConfig } from "../config";
import type { Sessions } from "../sessions";
import { rowsOf, type StepResult } from "../step-result";
import { listAll } from "./accounting";
import { refId } from "./refs";
import { why } from "./transition";

export const PC_PRODUCTS = ["E2E-PC-1", "E2E-PC-2", "E2E-PC-3", "E2E-PC-4"] as const;
export const PC_SPARE = "E2E-PC-X";
export const PC_ALL: readonly string[] = [...PC_PRODUCTS, PC_SPARE];

type Row = Record<string, any>;
const byCode = (rows: Row[]) => [...rows].sort((a, b) => String(a.code).localeCompare(String(b.code)));

/** Local evidence of earlier period-close runs for this BU (files only, gitignored). */
export function evidenceDir(buCode: string): string {
  // Specs resolve runs/ against the repo root (they run from there), so do the same.
  return join(process.cwd(), "runs", "period-close", buCode);
}

export async function seedPeriodClose(sessions: Sessions, cfg: ResetConfig): Promise<StepResult> {
  const result: StepResult = { step: "period-close", created: 0, skipped: 0, failed: [] };
  const admin = await sessions.client(cfg.adminEmail);
  const bu = cfg.buCode;
  const path = `/api/config/${bu}/products`;

  try {
    rmSync(evidenceDir(bu), { recursive: true, force: true });
  } catch (err) {
    result.failed.push(`clear evidence ${join("runs/period-close", bu)}: ${err instanceof Error ? err.message : String(err)}`);
  }

  const locations = byCode(
    rowsOf<Row>((await admin.get(`/api/config/${bu}/locations?perpage=100`)).body).filter(
      (l) => (l.location_type ?? "inventory") === "inventory" && l.is_active !== false,
    ),
  );
  const first = locations[0];
  if (!first) {
    result.failed.push("no inventory location to link the E2E-PC products to");
    return result;
  }

  const all = await listAll(admin, path);
  const template = byCode(all.filter((p) => !String(p.code).startsWith("E2E-")))[0];
  if (!template) {
    result.failed.push("no master product to copy the item group and unit from");
    return result;
  }
  const detail = await admin.get(`${path}/${template.id}`);
  if (!detail.ok) {
    result.failed.push(why(`read template product ${template.id}`, detail));
    return result;
  }
  const t = detail.body?.data ?? {};
  const inventoryUnit = refId(t, "inventory_unit");
  const itemGroup = refId(t, "product_item_group");
  if (!inventoryUnit) {
    result.failed.push("template product has no inventory unit");
    return result;
  }

  const have = new Set(all.map((r) => String(r.code)));
  for (const code of PC_ALL) {
    if (have.has(code)) {
      result.skipped++;
      continue;
    }
    const res = await admin.post(path, {
      code,
      name: code,
      local_name: code,
      description: "",
      inventory_unit_id: inventoryUnit,
      ...(itemGroup ? { product_item_group_id: itemGroup } : {}),
      product_status_type: "active",
      product_info: { is_used_in_recipe: false, is_sold_directly: false, barcode: "", sku: "", info: [] },
      locations: { add: [{ location_id: first.id }] },
    });
    if (res.ok) result.created++;
    else result.failed.push(why(`product ${code}`, res));
  }
  return result;
}

/** verify-dataset rows for --with-history: E2E-PC-1..4 + X exist, linked to the first location only. */
export async function verifyPeriodClose(sessions: Sessions, cfg: ResetConfig): Promise<{ lines: string[]; short: string[] }> {
  const admin = await sessions.client(cfg.adminEmail);
  const bu = cfg.buCode;
  const lines: string[] = [];
  const short: string[] = [];
  const check = (row: string, ok: boolean, detail: string) => {
    lines.push(`${row.padEnd(22)}${String(1).padStart(5)}${String(ok ? 1 : 0).padStart(7)}${ok ? "" : "  ✗"}`);
    if (!ok) short.push(`${row}: ${detail}`);
  };
  const locations = byCode(
    rowsOf<Row>((await admin.get(`/api/config/${bu}/locations?perpage=100`)).body).filter(
      (l) => (l.location_type ?? "inventory") === "inventory" && l.is_active !== false,
    ),
  );
  const firstId = locations[0]?.id ? String(locations[0].id) : "";
  const products = new Map((await listAll(admin, `/api/config/${bu}/products`)).map((r) => [String(r.code), r]));
  for (const code of PC_ALL) {
    const row = products.get(code);
    if (!row) {
      check(code, false, "product missing");
      continue;
    }
    const detail = await admin.get(`/api/config/${bu}/products/${row.id}`);
    const linked = ((detail.body?.data?.locations ?? []) as any[]).map((l) => refId(l, "location") ?? "");
    check(code, linked.length === 1 && linked[0] === firstId, `expected linked to first location ${firstId} only, found [${linked.join(", ")}]`);
  }
  return { lines, short };
}
