import { expect } from "@playwright/test";
import { buSend, buGet, rootGet } from "./bu-api";
import { BU_CODE } from "../test-users";

/**
 * Store requisition seeding through the API (Purchase role - the SR workflow puts Purchase on
 * Create Request, Store Approval and Issue, see scripts/data-reset/docs/store-requisitions.ts).
 *
 * data:reset leaves no SR that a single case may consume: the two SRs at "Store Approval" are
 * shared by every spec and a decided SR cannot be undone. Each 701 case therefore creates its
 * own SR here, drives it to the stage the case needs and disposes of it in `finally`
 * (draft -> deleted, in progress -> rejected/voided). Nothing here depends on queue order.
 */
export type SrStage = "draft" | "approval" | "issue" | "completed";

export interface SrSeedContext {
  workflow_id: string;
  department_id: string;
  requestor_id: string;
  from_location: { id: string; name: string; code: string };
  to_location: { id: string; name: string; code: string };
  /** Products the seeded SRs already carry - valid for this location pair + workflow. */
  products: { id: string; name: string; code: string }[];
}

let ctx: Promise<SrSeedContext> | null = null;

export function srSeedContext(): Promise<SrSeedContext> {
  return (ctx ??= (async () => {
    const r = await rootGet("Purchase", `/store-requisitions?perpage=50&bu_code=${BU_CODE}`);
    expect(r.status, "store-requisitions list").toBe(200);
    const rows: { id: string; doc_status: string }[] = r.body.data.find((b: { bu_code: string }) => b.bu_code === BU_CODE).data;
    const sample = rows.find((s) => s.doc_status !== "draft");
    if (!sample) throw new Error("sr-api: no submitted SR in the TEST BU - run `bun run data:reset --yes`");
    const d = (await buGet("Purchase", `/store-requisitions/${sample.id}`)).body.data;
    return {
      workflow_id: d.workflow.id,
      department_id: d.department.id,
      requestor_id: d.requestor.id,
      from_location: d.from_location,
      to_location: d.to_location,
      products: d.store_requisition_detail.map((l: any) => ({ id: l.product.id, name: l.product.name, code: l.product.code })),
    };
  })());
}

export interface SeededSr {
  id: string;
  sr_no: string;
}

const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString();

export async function getSr(id: string): Promise<any> {
  const r = await buGet("Purchase", `/store-requisitions/${id}`);
  expect(r.status, `GET store-requisition ${id}`).toBe(200);
  return r.body.data;
}

async function step(id: string, action: "submit" | "approve" | "reject", body: (doc: any) => Record<string, unknown>) {
  const doc = await getSr(id);
  const res = await buSend("Purchase", "PATCH", `/store-requisitions/${id}/${action}`, { doc_version: doc.doc_version, ...body(doc) });
  expect(res.status, `${action} ${doc.sr_no}: ${JSON.stringify(res.body).slice(0, 300)}`).toBeLessThan(300);
}

const lines = (doc: any): any[] => doc.store_requisition_detail ?? [];

/** Create a draft SR with `qty` of each of the seed products (default 2 products x 5). */
export async function createDraftSr(opts: { products?: number; qty?: number; description?: string } = {}): Promise<SeededSr> {
  const c = await srSeedContext();
  const picked = c.products.slice(0, opts.products ?? 2);
  const res = await buSend("Purchase", "POST", "/store-requisitions", {
    stage_role: "create",
    details: {
      sr_date: day(0),
      expected_date: day(1),
      requestor_id: c.requestor_id,
      workflow_id: c.workflow_id,
      department_id: c.department_id,
      from_location_id: c.from_location.id,
      to_location_id: c.to_location.id,
      description: opts.description ?? "E2E 701",
      store_requisition_detail: { add: picked.map((p) => ({ product_id: p.id, requested_qty: opts.qty ?? 5 })) },
    },
  });
  expect(res.status, `create SR: ${JSON.stringify(res.body).slice(0, 300)}`).toBeLessThan(300);
  const id = res.body.data.id as string;
  return { id, sr_no: (await getSr(id)).sr_no };
}

/** Create an SR and advance it to `stage` (draft | approval = Store Approval | issue = Issue | completed). */
export async function seedSr(stage: SrStage, opts: { products?: number; qty?: number; description?: string } = {}): Promise<SeededSr> {
  const draft = await createDraftSr(opts);
  const done = async (): Promise<SeededSr> => ({ id: draft.id, sr_no: (await getSr(draft.id)).sr_no });
  if (stage === "draft") return done();
  await step(draft.id, "submit", (doc) => ({
    stage_role: "create",
    sr_date_pattern: "today",
    details: lines(doc).map((l) => ({ id: l.id, stage_status: "submit", stage_message: null })),
  }));
  if (stage === "approval") return done();
  await step(draft.id, "approve", (doc) => ({
    stage_role: "approve",
    details: lines(doc).map((l) => ({ id: l.id, stage_status: "approve", stage_message: null, approved_qty: Number(l.requested_qty) })),
  }));
  if (stage === "issue") return done();
  await step(draft.id, "approve", (doc) => ({
    stage_role: "issue",
    issue_date_pattern: "today",
    details: lines(doc).map((l) => ({ id: l.id, stage_status: "approve", stage_message: null, issued_qty: Number(l.approved_qty) })),
  }));
  return done();
}

/**
 * Best-effort clean up so the shared dataset does not accumulate live SRs: a draft is deleted,
 * an SR still at Store Approval / Issue is rejected (-> voided), a finished one stays (no API to undo it).
 */
export async function disposeSr(id: string): Promise<void> {
  const doc = await getSr(id).catch(() => null);
  if (!doc) return;
  if (doc.doc_status === "draft") {
    await buSend("Purchase", "DELETE", `/store-requisitions/${id}`);
  } else if (doc.doc_status === "in_progress" && doc.role !== "view_only") {
    await step(id, "reject", (d) => ({
      stage_role: d.role,
      details: lines(d).map((l) => ({ id: l.id, stage_status: "reject", stage_message: "E2E cleanup" })),
    })).catch(() => {});
  }
}

/** Run `fn` against a fresh SR at `stage`; the SR is disposed of afterwards whatever the outcome. */
export async function withSr<T>(stage: SrStage, fn: (sr: SeededSr) => Promise<T>, opts: { products?: number; qty?: number } = {}): Promise<T> {
  const sr = await seedSr(stage, opts);
  try {
    return await fn(sr);
  } finally {
    await disposeSr(sr.id);
  }
}
