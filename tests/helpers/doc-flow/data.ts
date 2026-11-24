import type { Locator, Page } from "@playwright/test";
import { buConfigSend } from "../bu-api";
import { dfGet } from "./api";

/**
 * Shared data of the doc-flow specs on the TEST BUs. The products come from the `data:reset`
 * doc-flow step (E2E-DF-1..4, name = code, no stock); vendor, CN reason, SR locations and the SR
 * workflow are read from the BU at run time instead of being hard-coded.
 * P1-P3 are the line items, P4 the single-line posting product.
 */
export const DF: Record<"P1" | "P2" | "P3" | "P4", { code: string; name: string }> = {
  P1: { code: "E2E-DF-1", name: "E2E-DF-1" },
  P2: { code: "E2E-DF-2", name: "E2E-DF-2" },
  P3: { code: "E2E-DF-3", name: "E2E-DF-3" },
  P4: { code: "E2E-DF-4", name: "E2E-DF-4" },
};

/** A line's table row, matched by code (name = code for the doc-flow products). */
export const itemRow = (page: Page, code: string): Locator =>
  page.locator("table tbody tr").filter({ hasText: code }).first();

/** Short run stamp put into descriptions / invoice numbers — tells each run's documents apart. */
export const stamp = new Date().toISOString().slice(5, 16).replace(/[-T:]/g, "");

/**
 * A date inside the BU's current (active) period — documents that post stock
 * (GRN / CN) must be dated there: today when today falls in it (a date
 * picker may refuse future days), else the 15th.
 */
export async function activePeriodDate(bu: string): Promise<string> {
  const { status, body } = await dfGet(`/period-ends/current`, "Admin", bu);
  const period = String(body?.data?.period ?? "");
  if (status !== 200 || !/^\d{4}$/.test(period)) {
    throw new Error(`current period of ${bu}: HTTP ${status} period="${period}"`);
  }
  const month = `20${period.slice(0, 2)}-${period.slice(2)}`;
  // en-CA formats as YYYY-MM-DD; the e2e projects run in Asia/Bangkok.
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  return today.startsWith(month) ? today : `${month}-15`;
}

/** First active vendor by code. */
export async function firstVendor(bu: string): Promise<{ id: string; code: string; name: string }> {
  const r = await buConfigSend("Admin", "GET", "/vendors?perpage=100&sort=code:asc", undefined, bu);
  if (r.status !== 200) throw new Error(`${bu}: vendors HTTP ${r.status}`);
  const rows = ((r.body?.data ?? []) as any[]).filter((v) => v.is_active !== false);
  rows.sort((a, b) => String(a.code).localeCompare(String(b.code)));
  const v = rows[0];
  if (!v) throw new Error(`${bu}: no active vendor`);
  return { id: String(v.id), code: String(v.code), name: String(v.name) };
}

/** Name of the first active credit-note reason (read at run time). */
export async function firstCnReason(bu: string): Promise<string> {
  const r = await buConfigSend("Admin", "GET", "/credit-note-reasons?perpage=100", undefined, bu);
  if (r.status !== 200) throw new Error(`${bu}: credit-note-reasons HTTP ${r.status}`);
  const row = ((r.body?.data ?? []) as any[]).find((x) => x.is_active !== false);
  if (!row) throw new Error(`${bu}: no active credit-note reason`);
  return String(row.name);
}

/**
 * Names of the doc-flow location pair, read from the E2E-DF-1 product's locations. The reset step
 * picks the pair as the first two inventory locations by code (from, to), so they are ordered by
 * code here too — the product detail only carries names, so codes come from the location list.
 */
export async function srLocations(bu: string): Promise<{ from: string; to: string }> {
  const prod = await buConfigSend("Admin", "GET", `/products?search=${encodeURIComponent(DF.P1.code)}&perpage=20`, undefined, bu);
  const hit = ((prod.body?.data ?? []) as any[]).find((p) => p.code === DF.P1.code);
  if (!hit) throw new Error(`${bu}: product ${DF.P1.code} not found — run data:reset first`);
  const detail = await buConfigSend("Admin", "GET", `/products/${hit.id}`, undefined, bu);
  const locs = ((detail.body?.data?.locations ?? []) as any[])
    .filter((l) => l.is_active !== false && l.location_type === "inventory" && l.location)
    .map((l) => ({ id: String(l.location.id), name: String(l.location.name) }));
  if (locs.length < 2) throw new Error(`${bu}: ${DF.P1.code} has ${locs.length} inventory location(s), expected the doc-flow pair`);
  const all = await buConfigSend("Admin", "GET", "/locations?perpage=100", undefined, bu);
  const code = new Map<string, string>(((all.body?.data ?? []) as any[]).map((l) => [String(l.id), String(l.code ?? "")]));
  locs.sort((a, b) => (code.get(a.id) ?? "").localeCompare(code.get(b.id) ?? "") || a.name.localeCompare(b.name));
  return { from: locs[0].name, to: locs[1].name };
}

/** Name of the active store_requisition workflow called "Store Requisition". */
export async function srWorkflowName(bu: string): Promise<string> {
  const r = await buConfigSend("Admin", "GET", "/workflows?perpage=100", undefined, bu);
  if (r.status !== 200) throw new Error(`${bu}: workflows HTTP ${r.status}`);
  const hit = ((r.body?.data ?? []) as any[]).find(
    (w) => w.workflow_type === "store_requisition" && w.is_active && w.name === "Store Requisition",
  );
  if (!hit) throw new Error(`${bu}: no active store_requisition workflow named "Store Requisition"`);
  return String(hit.name);
}
