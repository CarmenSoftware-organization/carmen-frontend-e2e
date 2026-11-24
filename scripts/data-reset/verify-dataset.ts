// scripts/data-reset/verify-dataset.ts
// Spec step 3: read back counts per document type and state for the whole BU, compare with the
// table, and name every short row with the doc numbers seeded for it.
// ขั้น 3: นับเอกสารทั้ง BU เทียบกับตาราง แถวที่ขาดจะบอกชื่อพร้อมเลขเอกสารที่ seed ไว้
import type { ApiClient } from "../seed-master/api-client";
import type { ResetConfig } from "./config";
import { READ_SET, listAll } from "./docs/accounting";
import { DF_PRODUCTS } from "./docs/doc-flow";
import { verifyPeriodClose } from "./docs/period-close";
import { refId } from "./docs/refs";
import type { RowLedger } from "./docs/row-ledger";
import { localDate, planHistoryPeriod, planNextPeriod } from "./period";
import type { Sessions } from "./sessions";

export interface ExpectedRow {
  row: string;
  /** List path; `{bu}` is replaced by the BU code. */
  list: string;
  filter?: string;
  /** Count in-progress rows whose workflow_current_stage equals this. */
  stage?: string;
  min: number;
  ledgerRows: string[];
}

const PR = "/api/purchase-requests?bu_code={bu}";
const SR = "/api/store-requisitions?bu_code={bu}";
const at = (bu: string) => `/api/{bu}/${bu}`;

export const EXPECTED_ROWS: ExpectedRow[] = [
  { row: "PR draft", list: PR, filter: "pr_status:draft", min: 3, ledgerRows: ["pr.draft"] },
  { row: "PR at HOD Approval", list: PR, stage: "HOD Approval", min: 19, ledgerRows: ["pr.hod", "pr.second-dept"] },
  { row: "PR at Purchase", list: PR, stage: "Purchase", min: 8, ledgerRows: ["pr.purchase"] },
  { row: "PR at GM Approval", list: PR, stage: "GM Approval", min: 2, ledgerRows: ["pr.gm"] },
  { row: "PR returned", list: PR, stage: "Create Request", min: 1, ledgerRows: ["pr.returned"] },
  { row: "PR approved", list: PR, filter: "pr_status:approved", min: 5, ledgerRows: ["pr.approved"] },
  { row: "PR completed", list: PR, filter: "pr_status:completed", min: 1, ledgerRows: ["pr.completed"] },
  { row: "PR voided", list: PR, filter: "pr_status:voided", min: 2, ledgerRows: ["pr.rejected", "pr.void"] },
  { row: "PR template", list: at("purchase-request-templates"), min: 1, ledgerRows: ["pr-template.active"] },
  { row: "PO draft", list: at("purchase-orders"), filter: "po_status:draft", min: 1, ledgerRows: ["po.draft"] },
  { row: "PO voided", list: at("purchase-orders"), filter: "po_status:voided", min: 1, ledgerRows: ["po.rejected"] },
  { row: "PO approved", list: at("purchase-orders"), filter: "po_status:approved", min: 2, ledgerRows: ["po.approved", "po.from-pr"] },
  { row: "PO sent", list: at("purchase-orders"), filter: "po_status:sent_or_print", min: 1, ledgerRows: ["po.sent"] },
  { row: "PO partial", list: at("purchase-orders"), filter: "po_status:partial", min: 1, ledgerRows: ["po.partial"] },
  { row: "PO completed", list: at("purchase-orders"), filter: "po_status:completed", min: 1, ledgerRows: ["po.completed"] },
  { row: "GRN draft", list: at("good-received-notes"), filter: "doc_status:draft", min: 1, ledgerRows: ["grn.draft"] },
  { row: "GRN saved", list: at("good-received-notes"), filter: "doc_status:saved", min: 1, ledgerRows: ["grn.received"] },
  { row: "GRN committed", list: at("good-received-notes"), filter: "doc_status:committed", min: 2, ledgerRows: ["grn.committed", "grn.partial"] },
  { row: "CN draft", list: at("credit-notes"), filter: "doc_status:draft", min: 1, ledgerRows: ["cn.draft"] },
  { row: "CN completed", list: at("credit-notes"), filter: "doc_status:completed", min: 1, ledgerRows: ["cn.committed"] },
  { row: "SR draft", list: SR, filter: "doc_status:draft", min: 2, ledgerRows: ["sr.draft"] },
  { row: "SR in progress", list: SR, filter: "doc_status:in_progress", min: 3, ledgerRows: ["sr.approve", "sr.ready-for-issue"] },
  { row: "SR voided", list: SR, filter: "doc_status:voided", min: 1, ledgerRows: ["sr.cancelled"] },
  { row: "SR completed", list: SR, filter: "doc_status:completed", min: 1, ledgerRows: ["sr.completed"] },
  { row: "Price list active", list: at("pricelists"), filter: "status:active", min: 3, ledgerRows: ["pricelist.active"] },
  { row: "Campaign", list: at("request-for-pricings"), min: 3, ledgerRows: ["campaign.active", "campaign.draft", "campaign.expired"] },
  {
    row: "Stock-ins completed", list: at("stock-ins"), filter: "doc_status:completed", min: 5,
    ledgerRows: ["stock.tiers", "stock.on-hand.l1", "stock.on-hand.l2", "stock.expired", "stock.near-expiry"],
  },
];

/** Cross-BU lists (/api/purchase-requests, /api/store-requisitions) answer `data: [{ bu_code, paginate, data }]`. */
function listOf(body: any): { total: number; rows: any[] } {
  const perBu = Array.isArray(body?.data) && body.data[0] && "paginate" in body.data[0] ? body.data[0] : null;
  const scope = perBu ?? body;
  return { total: Number(scope?.paginate?.total ?? 0), rows: Array.isArray(scope?.data) ? scope.data : [] };
}

function url(list: string, bu: string, params: Record<string, string>): string {
  const path = list.replace("{bu}", bu);
  const query = new URLSearchParams(params).toString();
  return `${path}${path.includes("?") ? "&" : "?"}${query}`;
}

/** BU-level state the reset can leave broken: a resolvable default currency and a non-empty COA. */
async function verifyBuBase(admin: ApiClient, cfg: ResetConfig): Promise<string[]> {
  const problems: string[] = [];
  const profile = await admin.get("/api/user/profile");
  const bu = (profile.body?.data?.business_unit ?? []).find((b: any) => b.code === cfg.buCode);
  // Same rule as the app's banner (lib/bu-currency-status.ts): an id with no resolved currency row.
  if (!bu?.config?.default_currency_id) problems.push(`BU default currency: not set on ${cfg.buCode}`);
  else if (!bu.config.default_currency) problems.push(`BU default currency: ${bu.config.default_currency_id} no longer exists in ${cfg.buCode}`);
  const coa = await admin.get(`/api/config/${cfg.buCode}/chart-of-accounts?perpage=1`);
  if (listOf(coa.body).total < 1) problems.push("Chart of accounts: expected ≥ 1 account, found 0");
  return problems;
}

/**
 * Read back every accounting read-set key the seed says it created: it must exist and be in the state
 * the table promises. A key that was refused or failed is not expected here (its step already says so).
 */
async function verifyAccountingSet(
  admin: ApiClient, cfg: ResetConfig, seeded: ReturnType<RowLedger["rows"]>,
): Promise<{ lines: string[]; short: string[] }> {
  const lines: string[] = [];
  const short: string[] = [];
  const expected = READ_SET.filter((k) => (seeded[`acct.${k.key}`]?.docNos.length ?? 0) > 0);
  if (expected.length === 0) return { lines, short };
  const bu = cfg.buCode;
  const rows = {
    ap: new Map((await listAll(admin, `/api/${bu}/ap-invoice`)).map((d) => [String(d.vendor_invoice_no), d])),
    jv: new Map((await listAll(admin, `/api/${bu}/gl-jv`)).map((d) => [String(d.description), d])),
    template: new Map((await listAll(admin, `/api/${bu}/gl-jv-templates`)).map((d) => [String(d.code), d])),
  };
  for (const k of expected) {
    const doc = rows[k.kind].get(k.key);
    const status = k.kind === "ap" ? doc?.doc_status : k.kind === "jv" ? doc?.jv_status : undefined;
    const found = doc && (!k.state || status === k.state) ? 1 : 0;
    lines.push(`${k.key.padEnd(22)}${String(1).padStart(5)}${String(found).padStart(7)}${found < 1 ? "  ✗" : ""}`);
    if (found < 1) short.push(`${k.key}: expected ${k.state ?? "present"}, found ${doc ? status : "none"}`);
  }
  return { lines, short };
}

/**
 * Read back what the pos step promises: Simphony enabled, both recipes, the SALE adjustment type and
 * the two opening stock-ins completed. Only runs when the pos step recorded its stock rows.
 */
async function verifyPos(admin: ApiClient, cfg: ResetConfig, seeded: ReturnType<RowLedger["rows"]>): Promise<{ lines: string[]; short: string[] }> {
  const lines: string[] = [];
  const short: string[] = [];
  if (!seeded["pos.stock.l1"] && !seeded["pos.stock.l2"]) return { lines, short };
  const bu = cfg.buCode;
  const check = (row: string, ok: boolean, detail: string) => {
    lines.push(`${row.padEnd(22)}${String(1).padStart(5)}${String(ok ? 1 : 0).padStart(7)}${ok ? "" : "  ✗"}`);
    if (!ok) short.push(`${row}: ${detail}`);
  };
  const status = await admin.get(`/api/${bu}/pos-sales/status`);
  const brands: unknown = status.body?.data?.enabled_brands;
  check("pos.simphony-enabled", Array.isArray(brands) && brands.includes("simphony"), `enabled_brands is ${JSON.stringify(brands)} (HTTP ${status.status})`);
  const recipes = new Set((await listAll(admin, `/api/config/${bu}/recipes`)).map((r) => r.name));
  const missing = ["E2E-POS-A", "E2E-POS-B"].filter((n) => !recipes.has(n));
  check("pos.recipes", missing.length === 0, `missing recipe ${missing.join(", ")}`);
  const stockIns = new Map((await listAll(admin, `/api/${bu}/stock-ins`)).map((d) => [String(d.si_no), d]));
  for (const row of ["pos.stock.l1", "pos.stock.l2"]) {
    const no = seeded[row]?.docNos[0];
    const doc = no ? stockIns.get(no) : undefined;
    check(row, doc?.doc_status === "completed", `expected a completed stock-in, found ${doc ? doc.doc_status : "none"}${no ? ` (${no})` : ""}`);
  }
  const adjustments = await listAll(admin, `/api/config/${bu}/adjustment-types`);
  check("adjustment.sale", adjustments.some((a) => a.code === "SALE"), "adjustment type SALE not found");
  return { lines, short };
}

/**
 * Read back what the ia step promises: both E2E-IA products exist and have no stock at their location.
 * Only runs when the ia step recorded its rows.
 */
async function verifyIa(admin: ApiClient, cfg: ResetConfig, seeded: ReturnType<RowLedger["rows"]>): Promise<{ lines: string[]; short: string[] }> {
  const lines: string[] = [];
  const short: string[] = [];
  const codes = ["E2E-IA-A", "E2E-IA-B"];
  if (!codes.some((c) => seeded[`ia.${c}`])) return { lines, short };
  const bu = cfg.buCode;
  const check = (row: string, ok: boolean, detail: string) => {
    lines.push(`${row.padEnd(22)}${String(1).padStart(5)}${String(ok ? 1 : 0).padStart(7)}${ok ? "" : "  ✗"}`);
    if (!ok) short.push(`${row}: ${detail}`);
  };
  const products = new Map((await listAll(admin, `/api/config/${bu}/products`)).map((r) => [String(r.code), r]));
  const missing = codes.filter((c) => !products.has(c));
  const types = await listAll(admin, `/api/config/${bu}/adjustment-types`);
  const badTypes = (["E2E-IA-IN:stock_in", "E2E-IA-OUT:stock_out"] as const)
    .filter((x) => { const [code, kind] = x.split(":"); return !types.some((t) => t.code === code && t.type === kind && t.is_active !== false); })
    .map((x) => x.split(":")[0]);
  check("ia.adjustment-types", badTypes.length === 0, `missing or inactive adjustment type ${badTypes.join(", ")}`);
  check("ia.products", missing.length === 0, `missing product ${missing.join(", ")}`);
  const today = localDate(new Date()).day;
  const stocked: string[] = [];
  for (const code of codes) {
    const id = products.get(code)?.id;
    if (!id) continue;
    const detail = await admin.get(`/api/config/${bu}/products/${id}`);
    const locationId = refId((detail.body?.data?.locations ?? [])[0], "location");
    if (!locationId) {
      stocked.push(`${code} (no linked location)`);
      continue;
    }
    const info = await admin.get(`/api/${bu}/inventory-info/${id}/${locationId}?at_date=${today}`);
    const onHand = Number(info.body?.data?.on_hand_qty);
    if (!info.ok || onHand !== 0) stocked.push(`${code} (on hand ${info.ok ? onHand : `HTTP ${info.status}`})`);
  }
  check("ia.no-stock", missing.length === 0 && stocked.length === 0, `expected 0 on hand, found ${stocked.join(", ") || "unreadable"}`);
  return { lines, short };
}

/**
 * Read back what the doc-flow step promises: the four E2E-DF products exist, each linked to both chosen
 * locations, each in the Store Requisition workflow's product list, with nothing on hand.
 * Only runs when the doc-flow step recorded its rows.
 */
async function verifyDocFlow(admin: ApiClient, cfg: ResetConfig, seeded: ReturnType<RowLedger["rows"]>): Promise<{ lines: string[]; short: string[] }> {
  const lines: string[] = [];
  const short: string[] = [];
  const codes = DF_PRODUCTS as readonly string[];
  const locationIds = seeded["doc-flow.locations"]?.docNos[0]?.split(",") ?? [];
  if (!codes.some((c) => seeded[`doc-flow.${c}`]) && locationIds.length === 0) return { lines, short };
  const bu = cfg.buCode;
  const check = (row: string, ok: boolean, detail: string) => {
    lines.push(`${row.padEnd(22)}${String(1).padStart(5)}${String(ok ? 1 : 0).padStart(7)}${ok ? "" : "  ✗"}`);
    if (!ok) short.push(`${row}: ${detail}`);
  };
  const products = new Map((await listAll(admin, `/api/config/${bu}/products`)).map((r) => [String(r.code), r]));
  const missing = codes.filter((c) => !products.has(c));
  check("doc-flow.products", missing.length === 0, `missing product ${missing.join(", ")}`);
  check("doc-flow.locations", locationIds.length === 2, "no location pair recorded");
  const srId = ((await listAll(admin, `/api/config/${bu}/workflows`)).find((w) => w.workflow_type === "store_requisition") ?? {}).id;
  const sr = srId ? (await admin.get(`/api/config/${bu}/workflows/${srId}`)).body?.data : undefined;
  const inSr = new Set<string>((sr?.data?.products ?? []).map((p: any) => String(p.code)));
  const notInSr = codes.filter((c) => !inSr.has(c));
  check("doc-flow.sr-products", notInSr.length === 0, `not in the Store Requisition workflow product list: ${notInSr.join(", ")}`);
  const today = localDate(new Date()).day;
  const bad: string[] = [];
  for (const code of codes) {
    const id = products.get(code)?.id;
    if (!id) continue;
    const detail = await admin.get(`/api/config/${bu}/products/${id}`);
    const linked = new Set<string>(((detail.body?.data?.locations ?? []) as any[]).map((l) => refId(l, "location") ?? ""));
    const lacking = locationIds.filter((l) => !linked.has(l));
    if (lacking.length > 0) bad.push(`${code} (not linked to ${lacking.length} location)`);
    for (const locationId of locationIds) {
      const info = await admin.get(`/api/${bu}/inventory-info/${id}/${locationId}?at_date=${today}`);
      const onHand = Number(info.body?.data?.on_hand_qty);
      if (!info.ok || onHand !== 0) bad.push(`${code} (on hand ${info.ok ? onHand : `HTTP ${info.status}`})`);
    }
  }
  check("doc-flow.links-no-stock", missing.length === 0 && locationIds.length === 2 && bad.length === 0, bad.join(", ") || "unreadable");
  return { lines, short };
}

/** The period step promises next month's inventory period (pre-generated, open) beside the current one. */
async function verifyNextPeriod(admin: ApiClient, cfg: ResetConfig, now: Date): Promise<{ lines: string[]; short: string[] }> {
  const next = planNextPeriod(now);
  const res = await admin.get(`/api/${cfg.buCode}/inventory-periods?perpage=100`);
  const rows: any[] = Array.isArray(res.body?.data) ? res.body.data : [];
  const found = rows.some((p) => p.fiscal_year === next.fiscal_year && p.fiscal_month === next.fiscal_month && p.status === "open");
  return {
    lines: [`${"period.next".padEnd(22)}${String(1).padStart(5)}${String(found ? 1 : 0).padStart(7)}${found ? "" : "  ✗"}`],
    short: found ? [] : [`period.next: no open inventory period for ${next.fiscal_year}-${String(next.fiscal_month).padStart(2, "0")} (HTTP ${res.status})`],
  };
}

/** --with-history: the first period is last month and is still the BE's current one. */
async function verifyHistoryPeriod(admin: ApiClient, cfg: ResetConfig, now: Date): Promise<{ lines: string[]; short: string[] }> {
  const h = planHistoryPeriod(now);
  const res = await admin.get(`/api/${cfg.buCode}/inventory-periods/current`);
  const cur = res.body?.data;
  const ok = res.ok && cur?.fiscal_year === h.fiscal_year && cur?.fiscal_month === h.fiscal_month;
  return {
    lines: [`${"period.current".padEnd(22)}${String(1).padStart(5)}${String(ok ? 1 : 0).padStart(7)}${ok ? "" : "  ✗"}`],
    short: ok ? [] : [`period.current: expected ${h.fiscal_year}-${String(h.fiscal_month).padStart(2, "0")}, got ${res.ok ? `${cur?.fiscal_year}-${cur?.fiscal_month}` : `HTTP ${res.status}`}`],
  };
}

/** --with-history: no documents are seeded, so check the BU base, the E2E-PC products and the periods only. */
export async function verifyHistoryDataset(
  sessions: Sessions, cfg: ResetConfig, now: Date = new Date(),
): Promise<{ short: string[]; table: string }> {
  const admin = await sessions.client(cfg.adminEmail);
  const short: string[] = await verifyBuBase(admin, cfg);
  const lines = ["row                     min  found"];
  for (const part of [await verifyPeriodClose(sessions, cfg), await verifyHistoryPeriod(admin, cfg, now), await verifyNextPeriod(admin, cfg, now)]) {
    lines.push(...part.lines);
    short.push(...part.short);
  }
  return { short, table: lines.join("\n") };
}

export async function verifyDataset(
  sessions: Sessions, cfg: ResetConfig, ledger: RowLedger, now: Date = new Date(),
): Promise<{ short: string[]; table: string }> {
  const admin = await sessions.client(cfg.adminEmail);
  const seeded = ledger.rows();
  const short: string[] = await verifyBuBase(admin, cfg);
  const lines = ["row                     min  found"];
  for (const r of EXPECTED_ROWS) {
    let found: number;
    if (r.stage) {
      // Stage filter key on the list is unverified; count the in-progress rows client-side.
      const res = await admin.get(url(r.list, cfg.buCode, { perpage: "100", filter: "pr_status:in_progress" }));
      const { rows } = listOf(res.body);
      found = rows.filter((x) => x.workflow_current_stage === r.stage).length;
    } else {
      const res = await admin.get(url(r.list, cfg.buCode, { perpage: "1", ...(r.filter ? { filter: r.filter } : {}) }));
      found = listOf(res.body).total;
    }
    lines.push(`${r.row.padEnd(22)}${String(r.min).padStart(5)}${String(found).padStart(7)}${found < r.min ? "  ✗" : ""}`);
    if (found < r.min) {
      const docs = r.ledgerRows.flatMap((k) => seeded[k]?.docNos ?? []);
      short.push(`${r.row}: expected ≥ ${r.min}, found ${found} (seeded: ${docs.length ? docs.join(", ") : "none"})`);
    }
  }
  const accounting = await verifyAccountingSet(admin, cfg, seeded);
  lines.push(...accounting.lines);
  short.push(...accounting.short);
  const pos = await verifyPos(admin, cfg, seeded);
  lines.push(...pos.lines);
  short.push(...pos.short);
  const ia = await verifyIa(admin, cfg, seeded);
  lines.push(...ia.lines);
  short.push(...ia.short);
  const docFlow = await verifyDocFlow(admin, cfg, seeded);
  lines.push(...docFlow.lines);
  short.push(...docFlow.short);
  const nextPeriod = await verifyNextPeriod(admin, cfg, now);
  lines.push(...nextPeriod.lines);
  short.push(...nextPeriod.short);
  return { short, table: lines.join("\n") };
}
