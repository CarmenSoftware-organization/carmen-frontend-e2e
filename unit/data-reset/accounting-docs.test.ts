import { describe, it, expect } from "vitest";
import { BUDGET_EMAIL, INVOICE_PLANS, READ_SET, planTotal, seedAccountingDocs } from "../../scripts/data-reset/docs/accounting";
import { RowLedger } from "../../scripts/data-reset/docs/row-ledger";
import { verifyDataset } from "../../scripts/data-reset/verify-dataset";
import { loadWorkflowFixture } from "../../scripts/data-reset/workflow-template";
import { ACCOUNTING_APPROVER_KEYS, ACCOUNTING_ROLES, ACCOUNTING_VIEW_KEYS } from "../../scripts/data-reset/access";
import { createSessions } from "../../scripts/data-reset/sessions";
import { fakeBackend, healthyProfile } from "./fake-backend";
import { cfg, ctx, email } from "./docs-fixtures";

const bu = "/api/BU-GR2VYNKQ";
const c = "/api/config/BU-GR2VYNKQ";
type Doc = Record<string, any>;
const cents = (n: number) => Math.round(n * 100) / 100;

/**
 * A small accounting backend: AP invoices post on submit, payments go draft → in_review → posted on
 * the second account's approve and take the paid amount off the invoice, JVs go in_review → posted.
 * `refuse` makes create answer 400 for a doc_type (what dev may do for deposit / debit / credit note).
 */
function accountingBackend(opts: { refuse?: string[]; seeded?: Doc[] } = {}) {
  const invoices = new Map<string, Doc>((opts.seeded ?? []).map((d) => [d.id, d]));
  const payments = new Map<string, Doc>();
  const jvs = new Map<string, Doc>();
  const templates = new Map<string, Doc>();
  const paymentTypes: Doc[] = [];
  let n = 0;
  const lineTotal = (l: Doc) => {
    const gross = cents(l.quantity * l.unit_price);
    if (!l.vat_tax_profile_id) return gross;
    return l.vat_is_included ? gross : cents(gross + cents(gross * 0.07));
  };
  const fallback = (method: string, path: string, body: any) => {
    const [, , , kind, id, action] = path.split("/");
    if (path === `${c}/payment-types` && method === "POST") {
      paymentTypes.push({ id: "pt1", code: body.code });
      return { data: { id: "pt1", doc_version: 0 } };
    }
    if (path === `${bu}/ap-invoice` && method === "POST") {
      if (opts.refuse?.includes(body.doc_type)) return { __status: 422, message: `${body.doc_type} is not enabled` };
      const docId = `inv${++n}`;
      const lines = body.details.add.map((l: Doc, i: number) => ({ id: `${docId}-l${i + 1}`, ...l, total_amount: lineTotal(l) }));
      const total = cents(lines.reduce((s: number, l: Doc) => s + l.total_amount, 0));
      invoices.set(docId, { id: docId, doc_version: 0, doc_no: `APIV${n}`, doc_type: body.doc_type, doc_status: "draft", vendor_invoice_no: body.vendor_invoice_no, total_amount: total, outstanding_amount: total, tb_ap_invoice_detail: lines });
      return { data: { id: docId, doc_no: `APIV${n}` } };
    }
    if (kind === "ap-invoice" && id && action === "submit" && method === "POST") {
      Object.assign(invoices.get(id)!, { doc_status: "posted", doc_version: 2 });
      return { data: { id, doc_status: "posted" } };
    }
    if (kind === "ap-invoice" && id && !action && method === "GET") return { data: invoices.get(id) };
    if (path === `${bu}/ap-invoice` && method === "GET") return { data: [...invoices.values()] };
    if (path === `${bu}/ap-payment` && method === "POST") {
      const payId = `pay${++n}`;
      payments.set(payId, { id: payId, doc_version: 0, doc_status: "draft", allocations: body.allocations, payment_type_id: body.payment_type_id, body });
      return { data: { id: payId, doc_no: `APPV${n}` } };
    }
    if (kind === "ap-payment" && id && method === "GET") return { data: payments.get(id) };
    if (kind === "ap-payment" && id && action === "submit") {
      payments.get(id)!.doc_status = "in_review";
      return { data: { id, doc_status: "in_review" } };
    }
    if (kind === "ap-payment" && id && action === "approve") {
      const pay = payments.get(id)!;
      pay.doc_status = "posted";
      for (const a of pay.allocations) {
        const inv = [...invoices.values()].find((i) => i.tb_ap_invoice_detail.some((l: Doc) => l.id === a.ap_invoice_detail_id))!;
        inv.outstanding_amount = cents(inv.outstanding_amount - a.applied_amount);
      }
      return { data: { id, doc_status: "posted" } };
    }
    if (path === `${bu}/gl-jv` && method === "POST") {
      const jvId = `jv${++n}`;
      jvs.set(jvId, { id: jvId, doc_version: 0, jv_no: `JV${n}`, jv_status: "draft", description: body.description, body });
      return { data: { id: jvId, jv_no: `JV${n}` } };
    }
    if (kind === "gl-jv" && id && method === "GET") return { data: jvs.get(id) };
    if (path === `${bu}/gl-jv` && method === "GET") return { data: [...jvs.values()] };
    if (kind === "gl-jv" && id && action === "submit") {
      jvs.get(id)!.jv_status = "in_review";
      return { data: { id } };
    }
    if (kind === "gl-jv" && id && action === "approve") {
      jvs.get(id)!.jv_status = "posted";
      return { data: { id, jv_status: "posted" } };
    }
    if (path === `${bu}/gl-jv-templates` && method === "POST") {
      templates.set(body.code, { id: `t${++n}`, code: body.code, body });
      return { data: { id: `t${n}`, code: body.code } };
    }
    if (path === `${bu}/gl-jv-templates` && method === "GET") return { data: [...templates.values()] };
    return method === "GET" ? undefined : { data: {} };
  };
  const coa = ["5300", "1180", "1110"].map((code) => ({ id: `coa-${code}`, code }));
  const backend = fakeBackend(
    {
      [`GET ${c}/chart-of-accounts`]: { data: coa },
      [`GET ${c}/tax-profiles`]: { data: [{ id: "tp-vat", name: "Vat 7%" }] },
      [`GET ${c}/bank-accounts`]: { data: [{ id: "bank1", code: "E2E-BANK" }] },
      [`GET ${c}/gl-jv-prefixes`]: { data: [{ id: "px-jv", code: "JV", is_default: true }] },
      [`GET ${c}/payment-types`]: () => ({ data: paymentTypes }),
    },
    fallback,
  );
  return { backend, invoices, payments, jvs, templates, paymentTypes };
}

const run = (b: ReturnType<typeof accountingBackend>, ledger = new RowLedger()) =>
  seedAccountingDocs(createSessions(cfg, b.backend.fetchFn), cfg, ctx, ledger).then((result) => ({ result, ledger }));

describe("seedAccountingDocs", () => {
  it("creates every read-set document once — 8 invoices, 1 JV, 1 template — and again finds them instead", async () => {
    const b = accountingBackend();
    const first = await run(b);
    expect(first.result).toMatchObject({ failed: [], refused: [] });
    // 10 documents plus the one payment type a payment needs.
    expect(first.result.created).toBe(11);
    expect([...b.invoices.values()].map((d) => d.vendor_invoice_no).sort()).toEqual(
      READ_SET.filter((k) => k.kind === "ap").map((k) => k.key).sort(),
    );
    expect([...b.jvs.values()].map((j) => j.description)).toEqual(["E2E-JV-POSTED"]);
    expect([...b.templates.keys()]).toEqual(["E2E-JVT-1"]);
    for (const k of READ_SET) expect(first.ledger.rows()[`acct.${k.key}`].docNos.length).toBe(1);

    const writesAfterFirst = b.backend.writes().length;
    const second = await run(b);
    expect(second.result).toMatchObject({ created: 0, skipped: 10, failed: [], refused: [] });
    expect(b.backend.writes().length).toBe(writesAfterFirst);
  });

  it("takes each document's total from its own lines and leaves the balances the brief asks for", async () => {
    const b = accountingBackend();
    await run(b);
    const byKey = (key: string) => [...b.invoices.values()].find((d) => d.vendor_invoice_no === key)!;
    // One line, qty 3 × 333.33: net 999.99, VAT 7% = 69.9993 → 70.00 (half-up), total 1069.99.
    expect(byKey("E2E-AP-POSTED").total_amount).toBe(1069.99);
    expect(byKey("E2E-AP-INCVAT").total_amount).toBe(1070);
    expect(byKey("E2E-AP-PARTIAL").outstanding_amount).toBe(670);
    expect(byKey("E2E-AP-PAID").outstanding_amount).toBe(0);
    expect(byKey("E2E-AP-DRAFT").doc_status).toBe("draft");
    expect(INVOICE_PLANS.map((p) => planTotal(p))).toEqual([1069.99, 1070, 1070, 535, 100, 2000, 150, 120]);
    // 400.00 cash with no WHT on the partly paid document (controller ruling R5).
    const partial = [...b.payments.values()].find((p) => p.allocations[0].ap_invoice_detail_id.startsWith(byKey("E2E-AP-PARTIAL").id))!;
    expect(partial.allocations).toEqual([{ ap_invoice_detail_id: expect.any(String), applied_amount: 400 }]);
    expect(partial.body.wht).toBeUndefined();
  });

  it("posts through submit/approve with the approver role", async () => {
    const b = accountingBackend();
    await run(b);
    const writes = b.backend.writesBy();
    const callerOf = (re: RegExp) => [...new Set(writes.filter((w) => re.test(w.path)).map((w) => w.caller))];
    expect(callerOf(/ap-payment\/[^/]+\/submit$/)).toEqual([cfg.adminEmail]);
    expect(callerOf(/ap-payment\/[^/]+\/approve$/)).toEqual([BUDGET_EMAIL]);
    expect(callerOf(/gl-jv\/[^/]+\/submit$/)).toEqual([cfg.adminEmail]);
    expect(callerOf(/gl-jv\/[^/]+\/approve$/)).toEqual([BUDGET_EMAIL]);
    expect(callerOf(/ap-invoice\/[^/]+\/submit$/)).toEqual([cfg.adminEmail]);
    expect([...b.payments.values()].map((p) => p.doc_status)).toEqual(["posted", "posted"]);
    expect([...b.jvs.values()].map((j) => j.jv_status)).toEqual(["posted"]);
    // The draft is never submitted.
    const draft = [...b.invoices.values()].find((d) => d.vendor_invoice_no === "E2E-AP-DRAFT")!;
    expect(writes.some((w) => w.path.includes(`/ap-invoice/${draft.id}/`))).toBe(false);
  });

  it("reports a refused doc type with its status and body, leaves its row out and does not fail the step", async () => {
    const b = accountingBackend({ refuse: ["deposit", "debit_note", "credit_note"] });
    const { result, ledger } = await run(b);
    expect(result.failed).toEqual([]);
    expect(result.refused).toHaveLength(3);
    expect(result.refused[0]).toContain("E2E-AP-DEPOSIT");
    expect(result.refused[0]).toContain("422");
    expect(result.refused[0]).toContain("deposit is not enabled");
    expect(result.created).toBe(8); // 5 invoices + JV + template + payment type
    expect(ledger.rows()["acct.E2E-AP-DEPOSIT"]).toBeUndefined();
    expect([...b.invoices.values()].some((d) => d.vendor_invoice_no === "E2E-AP-DN")).toBe(false);
  });

  it("fails the step, and the row, when a document's total disagrees with its own lines", async () => {
    const b = accountingBackend();
    const original = b.backend.fetchFn;
    // The backend "forgets" VAT on posted invoices.
    const lying = (async (url: string, init?: RequestInit) => {
      const res = await original(url, init);
      if (/\/ap-invoice\/inv\d+$/.test(url) && (init?.method ?? "GET") === "GET") {
        const body = await res.json();
        body.data = { ...body.data, total_amount: 1 };
        return new Response(JSON.stringify(body), { status: 200 });
      }
      return res;
    }) as unknown as typeof fetch;
    const result = await seedAccountingDocs(createSessions(cfg, lying), cfg, ctx, new RowLedger());
    expect(result.failed[0]).toMatch(/^E2E-AP-POSTED: total 1, expected 1069.99/);
  });

  it("says when a payment fails instead of leaving the document half done", async () => {
    const b = accountingBackend();
    const original = b.backend.fetchFn;
    const failing = (async (url: string, init?: RequestInit) =>
      /ap-payment\/[^/]+\/approve$/.test(url) ? new Response(JSON.stringify({ message: "stage" }), { status: 403 }) : original(url, init)) as unknown as typeof fetch;
    const result = await seedAccountingDocs(createSessions(cfg, failing), cfg, ctx, new RowLedger());
    expect(result.failed.some((f) => f.startsWith("E2E-AP-PARTIAL: approve ap-payment → 403"))).toBe(true);
  });
});

describe("verifyDataset accounting rows", () => {
  it("lists every key the seed recorded and flags one that is not in the state promised", async () => {
    const b = accountingBackend();
    const { ledger } = await run(b);
    const fake = fakeBackend(
      { "GET /api/user/profile": healthyProfile, [`GET ${c}/chart-of-accounts`]: { data: [{ id: "a" }], paginate: { total: 1 } } },
      (m, p) => {
        if (m === "GET" && p === `${bu}/ap-invoice`) {
          return { data: [...b.invoices.values()].map((d) => (d.vendor_invoice_no === "E2E-AP-PAID" ? { ...d, doc_status: "draft" } : d)) };
        }
        if (m === "GET" && (p === `${bu}/gl-jv` || p === `${bu}/gl-jv-templates`)) return { data: p.endsWith("gl-jv") ? [...b.jvs.values()] : [...b.templates.values()] };
        return m === "GET" ? { data: [], paginate: { total: 0 } } : { data: {} };
      },
    );
    const { short, table } = await verifyDataset(createSessions(cfg, fake.fetchFn), cfg, ledger);
    for (const k of READ_SET) expect(table).toContain(k.key);
    expect(short.filter((s) => s.startsWith("E2E-"))).toEqual(["E2E-AP-PAID: expected posted, found draft"]);
  });
});

describe("accounting access fixtures", () => {
  it("adds AP payment and JV workflows with Budget as approver", () => {
    const wfs = loadWorkflowFixture().workflows.filter((w) => w.workflow_type === "ap_payment" || w.workflow_type === "gl_jv");
    expect(wfs.map((w) => w.workflow_type)).toEqual(["ap_payment", "gl_jv"]);
    for (const w of wfs) expect(w.data.stages.find((s) => s.role === "approve" && s.assigned_users.length)?.assigned_users).toEqual([{ email: BUDGET_EMAIL }]);
  });

  it("grants accounting roles to budget and requestor — approver may void and post, viewer only views", () => {
    expect(ACCOUNTING_ROLES.map((r) => [r.name, r.holders])).toEqual([
      ["Accounting Approver", [BUDGET_EMAIL]],
      ["Accounting Viewer", [email("requestor")]],
    ]);
    expect(ACCOUNTING_VIEW_KEYS.every((k) => k.endsWith(".view"))).toBe(true);
    expect(ACCOUNTING_APPROVER_KEYS).toEqual(expect.arrayContaining(["accounting.ap.void", "accounting.gl.void"]));
    expect(ACCOUNTING_VIEW_KEYS).not.toContain("accounting.ap.void");
  });
});
