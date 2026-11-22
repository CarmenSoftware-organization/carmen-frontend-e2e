// scripts/data-reset/docs/accounting.ts
// The stable read set of accounting documents on TEST BU: AP invoices in each state (posted, Inc-VAT,
// partly paid, fully paid, draft), a deposit / debit note / credit note, one manual JV and one JV
// template. Specs that only read (lists, detail pages, filters, money checks) use these; specs that
// change state build their own documents. Every document carries its key (`E2E-AP-*` in
// vendor_invoice_no, `E2E-JV-*` in the description, `E2E-JVT-*` as the template code) so a rerun
// finds it instead of creating a second one.
// ชุดเอกสารบัญชีที่อ่านอย่างเดียวบน TEST BU — มี key ในเลขใบแจ้งหนี้/คำอธิบาย เพื่อหาเจอซ้ำได้ ไม่สร้างซ้ำ
import type { ApiClient } from "../../seed-master/api-client";
import type { ResetConfig } from "../config";
import { BANK_ACCOUNT_CODE, VAT_PROFILE_NAME, ACCOUNT_CODES } from "../accounting";
import type { Sessions } from "../sessions";
import { rowsOf, type StepResult } from "../step-result";
import type { SeedContext } from "./context";
import { isoDay } from "./dates";
import type { RowLedger } from "./row-ledger";
import { createDoc, transition, why } from "./transition";

export const BUDGET_EMAIL = "carmensoftware.dev+budget@gmail.com";
export const PAYMENT_TYPE_CODE = "E2E-PT";

type Kind = "ap" | "jv" | "template";
export interface ReadSetKey {
  key: string;
  kind: Kind;
  /** Status the document must be in (invoice `doc_status`, JV `jv_status`); templates have none. */
  state?: string;
  /** Document types dev may refuse — reported, never faked, and not an error. */
  mayBeRefused?: boolean;
}

export const READ_SET: ReadSetKey[] = [
  { key: "E2E-AP-POSTED", kind: "ap", state: "posted" },
  { key: "E2E-AP-INCVAT", kind: "ap", state: "posted" },
  { key: "E2E-AP-PARTIAL", kind: "ap", state: "posted" },
  { key: "E2E-AP-PAID", kind: "ap", state: "posted" },
  { key: "E2E-AP-DRAFT", kind: "ap", state: "draft" },
  { key: "E2E-AP-DEPOSIT", kind: "ap", state: "posted", mayBeRefused: true },
  { key: "E2E-AP-DN", kind: "ap", state: "posted", mayBeRefused: true },
  { key: "E2E-AP-CN", kind: "ap", state: "posted", mayBeRefused: true },
  { key: "E2E-JV-POSTED", kind: "jv", state: "posted" },
  { key: "E2E-JVT-1", kind: "template" },
];

/** Half-up to 2 dp, the BU's rounding rule (accounting-foundation.md). */
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

interface InvoiceLine { qty: number; price: number; vat?: boolean; vatIncluded?: boolean; account?: "expense" | "advanceDeposit" }
interface InvoicePlan {
  key: string;
  docType: "invoice" | "deposit" | "debit_note" | "credit_note";
  lines: InvoiceLine[];
  /** Leave as a draft. */
  draft?: boolean;
  /** Cash paid against the invoice (no WHT — R5): `"all"` pays the whole total. */
  pay?: number | "all";
}

export const INVOICE_PLANS: InvoicePlan[] = [
  { key: "E2E-AP-POSTED", docType: "invoice", lines: [1, 2, 3].map(() => ({ qty: 1, price: 333.33, vat: true })) },
  { key: "E2E-AP-INCVAT", docType: "invoice", lines: [{ qty: 1, price: 1070, vat: true, vatIncluded: true }] },
  { key: "E2E-AP-PARTIAL", docType: "invoice", lines: [{ qty: 1, price: 1000, vat: true }], pay: 400 },
  { key: "E2E-AP-PAID", docType: "invoice", lines: [{ qty: 1, price: 500, vat: true }], pay: "all" },
  { key: "E2E-AP-DRAFT", docType: "invoice", lines: [{ qty: 1, price: 100 }], draft: true },
  { key: "E2E-AP-DEPOSIT", docType: "deposit", lines: [{ qty: 1, price: 2000, account: "advanceDeposit" }] },
  { key: "E2E-AP-DN", docType: "debit_note", lines: [{ qty: 1, price: 150 }] },
  { key: "E2E-AP-CN", docType: "credit_note", lines: [{ qty: 1, price: 120 }] },
];

/** What each line comes to on the BU's own rule (VAT 7% per line, rounded per line, Inc-VAT carved out). */
export function lineTotal(l: InvoiceLine): number {
  const gross = round2(l.qty * l.price);
  if (!l.vat) return gross;
  if (l.vatIncluded) return gross;
  return round2(gross + round2((gross * 7) / 100));
}
export const planTotal = (p: InvoicePlan) => round2(p.lines.reduce((sum, l) => sum + lineTotal(l), 0));

export interface AccountingDocsResult extends StepResult {
  /** Doc types dev refused: key, status and body, for the report. */
  refused: string[];
}

type Row = Record<string, any>;

/** Every row of a list endpoint (the read set is a handful of rows; pages of 100). */
export async function listAll(client: ApiClient, path: string): Promise<Row[]> {
  const rows: Row[] = [];
  for (let page = 1; page <= 20; page++) {
    const res = await client.get(`${path}${path.includes("?") ? "&" : "?"}perpage=100&page=${page}`);
    if (!res.ok) break;
    const got = rowsOf<Row>(res.body);
    rows.push(...got);
    if (got.length < 100) break;
  }
  return rows;
}

const jsonBody = (res: { body?: any }) => JSON.stringify(res.body?.message ?? res.body ?? "").slice(0, 300);

interface Setup {
  expense: string;
  advanceDeposit: string;
  vatProfileId: string;
  bankAccountId: string;
  paymentTypeId: string;
  jvPrefixId: string;
}

async function resolveSetup(admin: ApiClient, bu: string, result: StepResult): Promise<Setup | null> {
  const c = `/api/config/${bu}`;
  const coa = await listAll(admin, `${c}/chart-of-accounts`);
  const idOf = (code: string) => coa.find((a) => a.code === code)?.id as string | undefined;
  const expense = idOf(ACCOUNT_CODES.expense);
  const advanceDeposit = idOf(ACCOUNT_CODES.advanceDeposit);
  const bankCoa = idOf(ACCOUNT_CODES.bank);
  const vat = (await listAll(admin, `${c}/tax-profiles`)).find((t) => t.name === VAT_PROFILE_NAME)?.id as string | undefined;
  const bank = (await listAll(admin, `${c}/bank-accounts`)).find((b) => b.code === BANK_ACCOUNT_CODE)?.id as string | undefined;
  const prefixes = await listAll(admin, `${c}/gl-jv-prefixes`);
  const prefix = (prefixes.find((p) => p.is_default) ?? prefixes.find((p) => p.code === "JV"))?.id as string | undefined;
  const missing = Object.entries({ expense, advanceDeposit, bankCoa, vat, bank, prefix }).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length > 0 || !expense || !advanceDeposit || !bankCoa || !vat || !bank || !prefix) {
    result.failed.push(`accounting setup missing: ${missing.join(", ")} — the accounting step must run first`);
    return null;
  }
  // A new payment needs a Payment Type; the BU has none after a reset.
  let paymentType = (await listAll(admin, `${c}/payment-types`)).find((t) => t.code === PAYMENT_TYPE_CODE);
  if (!paymentType) {
    const res = await admin.post(`${c}/payment-types`, {
      code: PAYMENT_TYPE_CODE, description: "E2E bank transfer", chart_of_accounts_id: bankCoa, bank_account_id: bank, is_active: true,
    });
    const id = (res.body?.data as { id?: string } | undefined)?.id;
    if (!res.ok || !id) {
      result.failed.push(`POST ${c}/payment-types → ${res.status} ${jsonBody(res)}`);
      return null;
    }
    paymentType = { id };
    result.created += 1;
  }
  return { expense, advanceDeposit, vatProfileId: vat, bankAccountId: bank, paymentTypeId: paymentType.id, jvPrefixId: prefix };
}

function invoiceBody(plan: InvoicePlan, ctx: SeedContext, setup: Setup) {
  const day = isoDay(ctx.today);
  return {
    doc_type: plan.docType,
    doc_date: day,
    vendor_id: ctx.vendor.id,
    vendor_invoice_no: plan.key,
    invoice_date: day,
    description: `e2e read set ${plan.key}`,
    details: {
      add: plan.lines.map((l, i) => ({
        sequence_no: i + 1,
        description: `${plan.key} line ${i + 1}`,
        quantity: l.qty,
        unit_price: l.price,
        dr_chart_of_accounts_id: l.account === "advanceDeposit" ? setup.advanceDeposit : setup.expense,
        ...(l.vat ? { vat_tax_profile_id: setup.vatProfileId } : {}),
        ...(l.vatIncluded ? { vat_is_included: true } : {}),
      })),
    },
  };
}

/** Pay `cash` against an invoice: create (Admin), submit, approve (Budget, the stage user) → posted. */
async function payInvoice(
  admin: ApiClient, budget: ApiClient, bu: string, ctx: SeedContext, setup: Setup, invoiceId: string, cash: number,
): Promise<string | null> {
  const api = `/api/${bu}`;
  const detail = await admin.get(`${api}/ap-invoice/${invoiceId}`);
  const lines = ((detail.body?.data?.tb_ap_invoice_detail ?? []) as Row[]);
  if (lines.length !== 1) return `payment needs a single-line invoice, ${invoiceId} has ${lines.length}`;
  const created = await createDoc(admin, `${api}/ap-payment`, {
    vendor_id: ctx.vendor.id,
    payment_date: isoDay(ctx.today),
    bank_account_id: setup.bankAccountId,
    payment_type_id: setup.paymentTypeId,
    payment_method: "bank_transfer",
    payment_amount: cash,
    description: "e2e read set payment",
    allocations: [{ ap_invoice_detail_id: lines[0].id, applied_amount: cash }],
  });
  if (!created.ok || !created.id) return why("POST ap-payment", { status: created.status, body: created.body });
  const payPath = `${api}/ap-payment/${created.id}`;
  const submitted = await transition(admin, payPath, "submit", (v) => ({ doc_version: v }), "post");
  if (!submitted.ok) return why("submit ap-payment", submitted);
  const approved = await transition(budget, payPath, "approve", (v) => ({ doc_version: v }), "post");
  if (!approved.ok) return why("approve ap-payment", approved);
  const posted = (await admin.get(payPath)).body?.data?.doc_status;
  return posted === "posted" ? null : `payment ${created.no ?? created.id} is ${posted}, not posted`;
}

async function seedInvoice(
  admin: ApiClient, budget: ApiClient, bu: string, ctx: SeedContext, setup: Setup, plan: InvoicePlan,
  existing: Map<string, Row>, result: AccountingDocsResult, ledger: RowLedger,
): Promise<void> {
  const row = `acct.${plan.key}`;
  const api = `/api/${bu}/ap-invoice`;
  const refusable = plan.docType !== "invoice";
  let doc = existing.get(plan.key);
  let created = false;
  if (!doc) {
    const res = await createDoc(admin, api, invoiceBody(plan, ctx, setup));
    if (!res.ok || !res.id) {
      const msg = why(`POST ${api} (${plan.key}, ${plan.docType})`, { status: res.status, body: res.body });
      if (refusable) result.refused.push(`${plan.key}: ${msg} body=${jsonBody(res)}`);
      else {
        result.failed.push(msg);
        ledger.record(row, null, false, msg);
      }
      return;
    }
    doc = { id: res.id, doc_no: res.no, doc_status: "draft" };
    created = true;
  }
  const id = String(doc.id);
  if (!plan.draft && doc.doc_status === "draft") {
    const sub = await transition(admin, `${api}/${id}`, "submit", (v) => ({ doc_version: v }), "post");
    if (!sub.ok) {
      const msg = why(`submit ${plan.key}`, sub);
      if (refusable) {
        result.refused.push(`${plan.key}: ${msg} body=${jsonBody(sub)}`);
        await admin.post(`${api}/${id}/void`, { reason: "e2e read set: submit refused" });
      } else {
        result.failed.push(msg);
        ledger.record(row, doc.doc_no ?? null, false, msg);
      }
      return;
    }
  }
  const total = planTotal(plan);
  // The document total from our own inputs (VAT 7% per line, half-up per line), not from the backend's echo.
  const stored = Number(((await admin.get(`${api}/${id}`)).body?.data as Row | undefined)?.total_amount);
  if (Math.abs(stored) !== total) {
    const msg = `${plan.key}: total ${stored}, expected ${total} from its own lines`;
    result.failed.push(msg);
    ledger.record(row, doc.doc_no ?? null, false, msg);
    return;
  }
  if (plan.pay !== undefined) {
    const cash = plan.pay === "all" ? total : plan.pay;
    const now = (await admin.get(`${api}/${id}`)).body?.data as Row | undefined;
    // Outstanding below the total means a payment already went in on an earlier run.
    if (Number(now?.outstanding_amount) === total) {
      const problem = await payInvoice(admin, budget, bu, ctx, setup, id, cash);
      if (problem) {
        const msg = `${plan.key}: ${problem}`;
        result.failed.push(msg);
        ledger.record(row, doc.doc_no ?? null, false, msg);
        return;
      }
    }
    const open = Number((await admin.get(`${api}/${id}`)).body?.data?.outstanding_amount);
    const wantOpen = round2(total - cash);
    if (open !== wantOpen) {
      const msg = `${plan.key}: open balance ${open}, expected ${wantOpen} (total ${total} − paid ${cash})`;
      result.failed.push(msg);
      ledger.record(row, doc.doc_no ?? null, false, msg);
      return;
    }
  }
  ledger.record(row, doc.doc_no ?? plan.key, true);
  if (created) result.created += 1;
  else result.skipped += 1;
}

async function seedJournalVoucher(
  admin: ApiClient, budget: ApiClient, bu: string, ctx: SeedContext, setup: Setup, accounts: { bank: string },
  result: AccountingDocsResult, ledger: RowLedger,
): Promise<void> {
  const key = "E2E-JV-POSTED";
  const row = `acct.${key}`;
  const api = `/api/${bu}/gl-jv`;
  const existing = (await listAll(admin, api)).find((j) => j.description === key);
  if (existing && existing.jv_status === "posted") {
    ledger.record(row, existing.jv_no ?? key, true);
    result.skipped += 1;
    return;
  }
  const fail = (msg: string) => {
    result.failed.push(`${key}: ${msg}`);
    ledger.record(row, null, false, msg);
  };
  let id = existing?.id as string | undefined;
  let jvNo: string | undefined = existing?.jv_no;
  if (!id) {
    const res = await createDoc(admin, api, {
      prefix_id: setup.jvPrefixId, jv_date: isoDay(ctx.today), description: key,
      details: { add: [
        { sequence_no: 1, chart_of_accounts_id: setup.expense, debit: 250, description: `${key} Dr expense` },
        { sequence_no: 2, chart_of_accounts_id: accounts.bank, credit: 250, description: `${key} Cr bank` },
      ] },
    });
    if (!res.ok || !res.id) return fail(why(`POST ${api}`, { status: res.status, body: res.body }));
    id = res.id;
    jvNo = res.no;
  }
  const sub = await transition(admin, `${api}/${id}`, "submit", (v) => ({ doc_version: v }), "post");
  if (!sub.ok) return fail(why("submit gl-jv", sub));
  const app = await transition(budget, `${api}/${id}`, "approve", (v) => ({ doc_version: v }), "post");
  if (!app.ok) return fail(why("approve gl-jv", app));
  const status = (await admin.get(`${api}/${id}`)).body?.data?.jv_status;
  if (status !== "posted") return fail(`JV is ${status}, not posted`);
  ledger.record(row, jvNo ?? key, true);
  result.created += 1;
}

async function seedTemplate(
  admin: ApiClient, bu: string, ctx: SeedContext, setup: Setup, accounts: { bank: string },
  result: AccountingDocsResult, ledger: RowLedger,
): Promise<void> {
  const key = "E2E-JVT-1";
  const row = `acct.${key}`;
  const api = `/api/${bu}/gl-jv-templates`;
  if ((await listAll(admin, api)).some((t) => t.code === key)) {
    ledger.record(row, key, true);
    result.skipped += 1;
    return;
  }
  const [year, month] = ctx.today.split("-").map(Number);
  const res = await admin.post(api, {
    template_type: "recurring", code: key, name: key, description: "e2e read set template", is_active: true,
    prefix_id: setup.jvPrefixId, from_fiscal_year: year, from_period_no: month, to_fiscal_year: year, to_period_no: month,
    frequency_months: 1,
    details: { add: [
      { sequence_no: 1, chart_of_accounts_id: setup.expense, debit: 250, description: `${key} Dr expense` },
      { sequence_no: 2, chart_of_accounts_id: accounts.bank, credit: 250, description: `${key} Cr bank` },
    ] },
  });
  if (!res.ok) {
    const msg = why(`POST ${api}`, res);
    result.failed.push(`${key}: ${msg}`);
    ledger.record(row, null, false, msg);
    return;
  }
  ledger.record(row, key, true);
  result.created += 1;
}

export async function seedAccountingDocs(
  sessions: Sessions, cfg: ResetConfig, ctx: SeedContext, ledger: RowLedger,
): Promise<AccountingDocsResult> {
  const result: AccountingDocsResult = { step: "accounting-docs", created: 0, skipped: 0, failed: [], refused: [] };
  const admin = await sessions.client(cfg.adminEmail);
  const budget = await sessions.client(BUDGET_EMAIL);
  const bu = cfg.buCode;
  const setup = await resolveSetup(admin, bu, result);
  if (!setup) return result;
  const coa = await listAll(admin, `/api/config/${bu}/chart-of-accounts`);
  const bankCoa = coa.find((a) => a.code === ACCOUNT_CODES.bank)!.id as string;

  const existing = new Map((await listAll(admin, `/api/${bu}/ap-invoice`)).map((d) => [String(d.vendor_invoice_no), d]));
  for (const plan of INVOICE_PLANS) await seedInvoice(admin, budget, bu, ctx, setup, plan, existing, result, ledger);
  await seedJournalVoucher(admin, budget, bu, ctx, setup, { bank: bankCoa }, result, ledger);
  await seedTemplate(admin, bu, ctx, setup, { bank: bankCoa }, result, ledger);
  return result;
}
