/**
 * Probe for the period-close suite on a TEST BU reset with `--with-history` (design §0). Read + small writes:
 *   bun run scripts/movement/probe-period-history.ts --bu BU-96EAT3GX
 * Prints `PASS|FAIL <check> <evidence>`. The writes are a GRN dated last month 15th (saved + committed), a GRN dated today
 * (saved + committed) and one draft Stock In dated today (left as a draft) — the BU is a TEST BU that the next reset wipes.
 * Does not check the date picker (that is by eye).
 * probe ชุดปิดงวดบน TEST BU ที่ reset ด้วย --with-history — เขียนจริงเล็กน้อย (GRN 2 ใบลงสต๊อก) เฉพาะ TEST BU
 */
import { resolveResetConfig } from "../data-reset/config";
import { createSessions } from "../data-reset/sessions";
import { localDate, planHistoryPeriod, planNextPeriod } from "../data-reset/period";
import { hasDb, schemaOf, sql } from "../../tests/helpers/movement/db";
import { TEST_BUS, TEST_USERS, type TestBuCode } from "../../tests/test-users";

const argBu = process.argv.includes("--bu") ? process.argv[process.argv.indexOf("--bu") + 1] : undefined;
if (!TEST_BUS.some((b) => b.code === argBu)) {
  console.error(`--bu must be one of ${TEST_BUS.map((b) => b.code).join(", ")}`);
  process.exit(2);
}
const bu = argBu as TestBuCode;
const cfg = resolveResetConfig(process.env, bu);
const sessions = createSessions(cfg);
const emailOf = (role: string) => TEST_USERS.find((u) => u.role === role)!.email;
const as = async (role: string) => sessions.client(emailOf(role));
const base = `/api/${bu}`;
const short = (v: unknown, n = 160) => (typeof v === "string" ? v : JSON.stringify(v)).slice(0, n);

let failures = 0;
const report = (ok: boolean, check: string, evidence: string) => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"} ${check} ${evidence}`);
};
const day = (iso: string) => localDate(new Date(iso)).day;

const now = new Date();
const today = localDate(now).day;
const history = planHistoryPeriod(now);
const next = planNextPeriod(now);
const lastMonth15 = `${history.start_at.slice(0, 8)}15`;
// noon Bangkok: unambiguous day in any timezone
const at = (d: string) => new Date(`${d}T12:00:00+07:00`).toISOString();

async function check1() {
  const admin = await as("Admin");
  const cur = await admin.get(`${base}/inventory-periods/current`);
  const c = cur.body?.data;
  const isLast = cur.ok && c?.fiscal_year === history.fiscal_year && c?.fiscal_month === history.fiscal_month;
  report(isLast, "1a current period = last month", `status ${cur.status} current=${c?.fiscal_year}-${c?.fiscal_month} (${c?.status}) expected ${history.fiscal_year}-${history.fiscal_month}`);
  const list = await admin.get(`${base}/inventory-periods?perpage=100`);
  const rows: any[] = Array.isArray(list.body?.data) ? list.body.data : [];
  const covering = rows.find((p) => p.status === "open" && day(p.start_at) <= today && today <= day(p.end_at));
  report(Boolean(covering), "1b an open period covers today", `${today} <- ${covering ? `${covering.fiscal_year}-${covering.fiscal_month} ${day(covering.start_at)}..${day(covering.end_at)}` : "none"}; periods: ${rows.map((p) => `${p.fiscal_year}-${p.fiscal_month}:${p.status}`).join(" ")}`);
  report(rows.some((p) => p.fiscal_year === next.fiscal_year && p.fiscal_month === next.fiscal_month), "1c next month exists", `${next.fiscal_year}-${next.fiscal_month}`);
}

interface GrnSeed { body: any; sample: { product: string; location: string } }

async function grnTemplate(): Promise<GrnSeed | null> {
  const admin = await as("Admin");
  const list = await admin.get(`${base}/good-received-notes?perpage=100&search=STD-grn`);
  const hit = (Array.isArray(list.body?.data) ? list.body.data : []).find((g: any) => g.invoice_no === "STD-grn.draft");
  if (!hit) return null;
  const full = (await admin.get(`${base}/good-received-notes/${hit.id}`)).body?.data;
  const lines = (full.good_received_note_detail as any[]).slice(0, 1).map((l) => {
    const it = l.items[0];
    const q = 5, p = Number(it.received_price) || 100;
    return {
      product_id: l.product.id, location_id: l.location.id, foc_qty: 0, foc_unit_conversion_factor: 1, approved_qty: 0,
      received_qty: q, received_unit_id: it.received_unit.id, received_base_qty: q, received_unit_conversion_factor: 1,
      received_price: p, tax_rate: 0, tax_amount: 0, is_tax_adjustment: false, is_tax_included: false,
      discount_rate: 0, discount_amount: 0, is_discount_adjustment: false, net_amount: q * p, total_price: q * p,
    };
  });
  return {
    sample: { product: lines[0].product_id, location: lines[0].location_id },
    body: {
      invoice_date: full.invoice_date, doc_status: "draft", doc_type: "manual", post_type: full.post_type,
      received_by_id: full.received_by?.id ?? null, is_active: true, vendor_id: full.vendor.id, currency_id: full.currency.id,
      exchange_rate: 1, good_received_note_detail: { add: lines },
    },
  };
}

/** create → save → commit as `role`; returns the status codes. */
async function grnCommit(role: string, tpl: GrnSeed, date: string, tag: string) {
  const c = await as(role);
  const created = await c.post(`${base}/good-received-notes`, { ...tpl.body, grn_date: at(date), invoice_no: `PROBE-${tag}`, description: `PROBE ${tag}` });
  if (!created.ok) return { stage: "create", status: created.status, msg: short(created.body?.message ?? created.body) };
  const id = created.body.data.id;
  const get = async () => (await c.get(`${base}/good-received-notes/${id}`)).body?.data;
  const saved = await c.patch(`${base}/good-received-notes/${id}/save`, { doc_version: (await get()).doc_version });
  if (!saved.ok) return { stage: "save", status: saved.status, msg: short(saved.body?.message ?? saved.body) };
  const committed = await c.patch(`${base}/good-received-notes/${id}/commit`, { doc_version: (await get()).doc_version });
  const final = await get();
  return { stage: "commit", status: committed.status, msg: short(committed.body?.message ?? ""), doc_status: final?.doc_status, no: final?.grn_no };
}

async function check2() {
  const tpl = await grnTemplate();
  if (!tpl) return report(false, "2 seeded GRN template", "no STD-grn.draft GRN — run the reset first");
  const tag = Date.now().toString(36).toUpperCase();
  for (const [label, date] of [["2a GRN last month 15th commits", lastMonth15], ["2b GRN today saves + commits", today]] as const) {
    let r = await grnCommit("Admin", tpl, date, `${tag}-${date}`);
    let who = "Admin";
    if (r.status === 403) { who = "Purchase (Admin got 403)"; r = await grnCommit("Purchase", tpl, date, `${tag}-${date}-P`); }
    report(r.stage === "commit" && r.status < 300 && r.doc_status === "committed", label, `as ${who}: ${date} → ${r.stage} ${r.status} doc_status=${(r as any).doc_status ?? "-"} ${(r as any).no ?? ""} ${r.msg}`);
  }
  // Stock In dated today: saves as a draft (left in place; the next reset wipes it)
  const admin = await as("Admin");
  const types = await admin.get(`/api/config/${bu}/adjustment-types?perpage=100`);
  const list: any[] = Array.isArray(types.body?.data) ? types.body.data : types.body?.data?.items ?? [];
  const typeIn = list.find((t) => t.type === "stock_in" && t.is_active)?.id;
  if (!typeIn) return report(false, "2c Stock In today saves", `no active stock_in adjustment type (GET ${types.status})`);
  const si = await admin.post(`${base}/stock-ins`, {
    si_date: at(today), description: `PROBE ${tag}`, adjustment_type_id: typeIn, location_id: tpl.sample.location,
    stock_in_detail: { add: [{ product_id: tpl.sample.product, qty: 1, cost_per_unit: 10, total_cost: 10 }] },
  });
  report(si.ok, "2c Stock In today saves", `status ${si.status} ${si.ok ? "" : short(si.body?.message ?? si.body)}`);
}

function check3() {
  if (!hasDb()) return report(false, "3 SQL reaches the schema", "E2E_DB_URL not set");
  try {
    const rows = sql<{ n: string }>(`select count(*) as n from ${schemaOf(bu)}.tb_inventory_period`);
    report(Number(rows[0]?.n) >= 3, "3 SQL reaches the schema", `${schemaOf(bu)}.tb_inventory_period count=${rows[0]?.n} (expect >= 3: last, this, next month)`);
  } catch (e) {
    report(false, "3 SQL reaches the schema", short(String((e as Error).message), 300));
  }
}

async function check4() {
  const admin = await as("Admin");
  const wf = await admin.get(`/api/config/${bu}/workflows?perpage=100`);
  const sr: any[] = (Array.isArray(wf.body?.data) ? wf.body.data : []).filter((w) => w.workflow_type === "store_requisition");
  const withIssue = sr.filter((w) => (w.data?.stages ?? []).some((s: any) => s.role === "issue"));
  report(withIssue.length > 0, "4a SR workflow with an Issue stage", `${withIssue.length}/${sr.length} SR workflows: ${withIssue.map((w) => `${w.name} [${w.data.stages.map((s: any) => `${s.name}=${s.role}(${(s.assigned_users ?? []).map((u: any) => String(u.email).split("+")[1]?.split("@")[0]).join(",")})`).join(" > ")}]`).join("; ")}`);
  const wanted = /(purchase_request|store_requisition|good_received_note|goods_received|credit_note|stock_in|stock_out|inventory_adjustment|period)/;
  for (const role of ["Requestor", "HOD", "FC"]) {
    const c = await as(role);
    const p = await c.get("/api/user/profile");
    const b = (p.body?.data?.business_unit ?? []).find((x: any) => x.code === bu);
    const perms: string[] = Array.isArray(b?.permissions) ? b.permissions : [];
    const hits = perms.filter((k) => wanted.test(k));
    report(p.ok && Boolean(b) && hits.length > 0, `4b ${role} profile in ${bu}`, `status ${p.status} member=${Boolean(b)} perms=${perms.length} relevant=${hits.length}: ${hits.join(",").slice(0, 400)}`);
  }
}

await check1();
await check2();
check3();
await check4();
console.log(failures === 0 ? "ALL PASS" : `${failures} FAIL`);
process.exit(failures === 0 ? 0 : 1);
