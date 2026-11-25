// scripts/data-reset/docs/ar.ts
// The stable AR Invoice read set on BU-GR2VYNKQ: a posted tax invoice, a draft, a posted credit note, a
// posted debit note and a posted-then-voided invoice. Specs that only read (lists, detail, filters,
// money checks) use these; specs that change state build their own. Every document is created as Admin
// and carries `STD ar.<row> <KEY>` in `description`; a rerun finds it by list search and skips it.
// The list `search` hits `description` (doc_no, customer and description are searched), so
// `source_doc_ref` is not needed — confirmed by the live re-run skipping every key.
// ชุดเอกสาร AR ที่อ่านอย่างเดียว — ใส่ key ใน description เพื่อให้รันซ้ำหาเจอและไม่สร้างซ้ำ
import type { ApiClient } from "../../seed-master/api-client";
import { ACCOUNT_CODES, VAT_PROFILE_NAME } from "../accounting";
import { AR_COST_CENTER_CODE, AR_CUSTOMER_CODES, NO_VAT_PROFILE_NAME, REVENUE_ACCOUNT_CODE } from "../ar";
import type { ResetConfig } from "../config";
import type { Sessions } from "../sessions";
import type { StepResult } from "../step-result";
import { listAll } from "./accounting";
import type { SeedContext } from "./context";
import { isoDay } from "./dates";
import type { RowLedger } from "./row-ledger";
import { createDoc, transition, why } from "./transition";

export interface ArReadSetKey {
  key: string;
  /** Ledger row name; the description is `STD ar.<row> <key>`. */
  row: string;
  /** Final `doc_status`. */
  state: "posted" | "draft" | "void";
}

export const AR_READ_SET: ArReadSetKey[] = [
  { key: "E2E-AR-POSTED", row: "posted", state: "posted" },
  { key: "E2E-AR-DRAFT", row: "draft", state: "draft" },
  { key: "E2E-AR-CN", row: "cn", state: "posted" },
  { key: "E2E-AR-DN", row: "dn", state: "posted" },
  { key: "E2E-AR-VOID", row: "void", state: "void" },
];

interface Plan extends ArReadSetKey {
  docType: "invoice" | "credit_note" | "debit_note";
  customer: "customer1" | "customer2";
  taxInvoice?: boolean;
  lines: { qty: number; price: number }[];
  vat: boolean;
  total: number;
}

const PLANS: Plan[] = [
  { ...AR_READ_SET[0], docType: "invoice", customer: "customer1", taxInvoice: true, lines: [{ qty: 3, price: 333.33 }], vat: true, total: 1069.99 },
  { ...AR_READ_SET[1], docType: "invoice", customer: "customer1", lines: [{ qty: 1, price: 500 }], vat: true, total: 535 },
  { ...AR_READ_SET[2], docType: "credit_note", customer: "customer1", lines: [{ qty: 1, price: 100 }], vat: true, total: 107 },
  { ...AR_READ_SET[3], docType: "debit_note", customer: "customer1", lines: [{ qty: 1, price: 200 }], vat: false, total: 200 },
  { ...AR_READ_SET[4], docType: "invoice", customer: "customer2", lines: [{ qty: 1, price: 300 }], vat: false, total: 300 },
];

type Row = Record<string, any>;
const tag = (p: ArReadSetKey) => `STD ar.${p.row} ${p.key}`;

interface Ids { customer1: string; customer2: string; costCenter: string; revenue: string; vat: string; noVat: string }

async function resolveIds(admin: ApiClient, bu: string, result: StepResult): Promise<Ids | null> {
  const c = `/api/config/${bu}`;
  const customers = await listAll(admin, `${c}/customers`);
  const costCenters = await listAll(admin, `${c}/cost-centers`);
  const coa = await listAll(admin, `${c}/chart-of-accounts`);
  const profiles = await listAll(admin, `${c}/tax-profiles`);
  const ids = {
    customer1: customers.find((r) => r.code === AR_CUSTOMER_CODES.customer1)?.id,
    customer2: customers.find((r) => r.code === AR_CUSTOMER_CODES.customer2)?.id,
    costCenter: costCenters.find((r) => r.code === AR_COST_CENTER_CODE)?.id,
    revenue: coa.find((r) => r.code === REVENUE_ACCOUNT_CODE)?.id,
    vat: profiles.find((r) => r.name === VAT_PROFILE_NAME)?.id,
    noVat: profiles.find((r) => r.name === NO_VAT_PROFILE_NAME)?.id,
  };
  const missing = Object.entries(ids).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length > 0) {
    result.failed.push(`AR setup missing: ${missing.join(", ")} (control ${ACCOUNT_CODES.arControl}) — the ar step must run first`);
    return null;
  }
  return ids as Ids;
}

function body(plan: Plan, ctx: SeedContext, ids: Ids) {
  return {
    doc_type: plan.docType,
    doc_date: isoDay(ctx.today),
    customer_id: ids[plan.customer],
    description: tag(plan),
    ...(plan.taxInvoice ? { is_tax_invoice: true } : {}),
    details: {
      add: plan.lines.map((l, i) => ({
        sequence_no: i + 1,
        description: `${plan.key} line ${i + 1}`,
        quantity: l.qty,
        unit_price: l.price,
        cr_chart_of_accounts_id: ids.revenue,
        cr_cost_center_id: ids.costCenter,
        vat_tax_profile_id: plan.vat ? ids.vat : ids.noVat,
      })),
    },
  };
}

async function seedOne(
  admin: ApiClient, bu: string, ctx: SeedContext, ids: Ids, plan: Plan, result: StepResult, ledger: RowLedger,
): Promise<void> {
  const row = `ar.${plan.row}`;
  const api = `/api/${bu}/ar-invoice`;
  const fail = (msg: string, no?: string) => {
    result.failed.push(`${plan.key}: ${msg}`);
    ledger.record(row, no ?? null, false, msg);
  };
  const find = async (): Promise<Row | undefined> => {
    const res = await admin.get(`${api}?search=${encodeURIComponent(plan.key)}&perpage=100`);
    const rows: Row[] = Array.isArray(res.body?.data) ? res.body.data : [];
    return rows.find((d) => typeof d.description === "string" && d.description.includes(tag(plan)));
  };
  let doc = await find();
  let created = false;
  if (!doc) {
    const res = await createDoc(admin, api, body(plan, ctx, ids));
    if (!res.ok || !res.id) return fail(why(`POST ${api}`, { status: res.status, body: res.body }));
    doc = { id: res.id, doc_no: res.no, doc_status: "draft" };
    created = true;
  }
  const id = String(doc.id);
  const path = `${api}/${id}`;
  if (doc.doc_status === "draft" && plan.state !== "draft") {
    const sub = await transition(admin, path, "submit", (v) => ({ doc_version: v }), "post");
    if (!sub.ok) return fail(why("submit", sub), doc.doc_no);
  }
  if (plan.state === "void" && (await admin.get(path)).body?.data?.doc_status === "posted") {
    const voided = await transition(admin, path, "void", (v) => ({ doc_version: v, reason: "STD void" }), "post");
    if (!voided.ok) return fail(why("void", voided), doc.doc_no);
  }
  const now = (await admin.get(path)).body?.data as Row | undefined;
  const no = (now?.doc_no as string | undefined) ?? doc.doc_no;
  if (now?.doc_status !== plan.state) return fail(`is ${now?.doc_status}, expected ${plan.state}`, no);
  if (Math.abs(Number(now?.total_amount)) !== plan.total) return fail(`total ${now?.total_amount}, expected ${plan.total}`, no);
  ledger.record(row, no ?? plan.key, true);
  if (created) result.created += 1;
  else result.skipped += 1;
}

export async function seedArDocs(sessions: Sessions, cfg: ResetConfig, ctx: SeedContext, ledger: RowLedger): Promise<StepResult> {
  const result: StepResult = { step: "ar-docs", created: 0, skipped: 0, failed: [] };
  const admin = await sessions.client(cfg.adminEmail);
  const ids = await resolveIds(admin, cfg.buCode, result);
  if (!ids) return result;
  for (const plan of PLANS) await seedOne(admin, cfg.buCode, ctx, ids, plan, result, ledger);
  return result;
}
