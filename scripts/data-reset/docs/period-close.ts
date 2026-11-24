// scripts/data-reset/docs/period-close.ts
// Period-close base: four products (E2E-PC-1..4) plus one spare (E2E-PC-X), copied from a template
// product; E2E-PC-1..4 linked to the FIRST inventory location only, the spare to every one — no stock, no documents. The period-close
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
import { DF_CN_REASON } from "./doc-flow";
import { withAdminDefaultBu } from "../bu-base";
import { TEST_BUS } from "../../../tests/test-users";
import { IA_TYPES } from "./ia";

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
      // PC-1..4 sit in the first location only; the spare is linked everywhere so an SR can name any
      // inventory location as its destination (the backend refuses products not linked to it).
      locations: { add: (code === PC_SPARE ? locations : [first]).map((l) => ({ location_id: l.id })) },
    });
    if (res.ok) result.created++;
    else result.failed.push(why(`product ${code}`, res));
  }

  // The suite files a credit note and stock in/out adjustments; the reset empties the reasons and the
  // master workbook ships neither them nor adjustment types, so keep one of each (skip when present).
  const reasonsPath = `/api/config/${bu}/credit-note-reasons`;
  const reasons = await admin.get(`${reasonsPath}?perpage=100`);
  if (!reasons.ok) {
    result.failed.push(why("list credit-note reasons", reasons));
  } else if (rowsOf<Row>(reasons.body).some((r) => r.is_active !== false)) {
    result.skipped++;
  } else {
    const res = await admin.post(reasonsPath, { name: DF_CN_REASON, description: "period-close E2E (data:reset)" });
    if (res.ok) result.created++;
    else result.failed.push(why(`credit-note reason ${DF_CN_REASON}`, res));
  }
  const typePath = `/api/config/${bu}/adjustment-types`;
  const haveTypes = new Set((await listAll(admin, typePath)).map((r) => String(r.code)));
  for (const t of IA_TYPES) {
    if (haveTypes.has(t.code)) {
      result.skipped++;
      continue;
    }
    const res = await admin.post(typePath, { code: t.code, name: t.name, type: t.type, description: "", is_active: true });
    if (res.ok) result.created++;
    else result.failed.push(why(`adjustment type ${t.code}`, res));
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
    if (code === PC_SPARE) {
      check(code, locations.every((l) => linked.includes(String(l.id))), `expected linked to every inventory location, found [${linked.join(", ")}]`);
    } else {
      check(code, linked.length === 1 && linked[0] === firstId, `expected linked to first location ${firstId} only, found [${linked.join(", ")}]`);
    }
  }
  return { lines, short };
}

/**
 * si.cost-from of the TEST BU = what the scenario expects (FIFO: last_cost, AVG: average). The Default Setting
 * page writes the admin's default BU only, so the UI case (910 / 0.4) cannot set it on a TEST BU — set it
 * here, through the same default-BU switch the other steps use. Idempotent: an existing right value is skipped.
 */
export async function seedCostFrom(sessions: Sessions, cfg: ResetConfig): Promise<StepResult> {
  const result: StepResult = { step: "cost-from", created: 0, skipped: 0, failed: [] };
  const method = TEST_BUS.find((b) => b.code === cfg.buCode)?.method;
  const want = method === "fifo" ? "last_cost" : "average";
  return withAdminDefaultBu(sessions, cfg, result, async () => {
    const admin = await sessions.client(cfg.adminEmail);
    const bu = await admin.get("/api/business-units");
    const row = bu.ok ? (bu.body?.data as Row | undefined) : undefined;
    if (!row?.id || row.code !== cfg.buCode) {
      result.failed.push(`GET /api/business-units → ${bu.status}, current BU ${row?.code ?? "unknown"} is not ${cfg.buCode}`);
      return result;
    }
    const config: Row[] = Array.isArray(row.config) ? row.config : [];
    if (config.find((c) => c.key === "si.cost-from")?.value === want) {
      result.skipped++;
      return result;
    }
    const next = [
      ...config.filter((c) => c.key !== "si.cost-from"),
      { key: "si.cost-from", label: "Default price for added items", datatype: "enum", value: want },
    ];
    const res = await admin.patch("/api/business-units", { id: row.id, doc_version: row.doc_version, config: next });
    if (res.ok) result.created++;
    else result.failed.push(why("si.cost-from", res));
    return result;
  });
}
