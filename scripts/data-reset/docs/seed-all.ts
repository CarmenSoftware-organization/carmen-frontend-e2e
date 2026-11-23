// scripts/data-reset/docs/seed-all.ts
// The document half of data:reset, in dependency order: stock → PR template → PRs → POs (one from
// the reserved PR) → GRN/CN → SRs → pricing → verify. Each step is injectable for tests.
// ครึ่งเอกสารของ data:reset ตามลำดับที่พึ่งกัน — แต่ละขั้นเปลี่ยนเป็นของปลอมได้ตอนเทส
import type { ResetConfig } from "../config";
import type { Sessions } from "../sessions";
import type { StepResult } from "../step-result";
import type { TestUserInfo } from "../verify-env";
import { verifyDataset } from "../verify-dataset";
import { resolveSeedContext, type SeedContext } from "./context";
import { seedAccountingDocs } from "./accounting";
import { seedPricing } from "./pricing";
import { seedPrTemplate, seedPurchaseRequests } from "./purchase-requests";
import { seedPurchaseOrders } from "./purchase-orders";
import { seedReceiving } from "./receiving";
import { RowLedger } from "./row-ledger";
import { seedIa } from "./ia";
import { seedPos } from "./pos";
import { seedStock } from "./stock";
import { seedStoreRequisitions } from "./store-requisitions";

export interface DocumentSteps {
  context: typeof resolveSeedContext;
  stock: typeof seedStock;
  pos: typeof seedPos;
  ia: typeof seedIa;
  prTemplate: typeof seedPrTemplate;
  purchaseRequests: typeof seedPurchaseRequests;
  purchaseOrders: typeof seedPurchaseOrders;
  receiving: typeof seedReceiving;
  storeRequisitions: typeof seedStoreRequisitions;
  pricing: typeof seedPricing;
  accountingDocs: typeof seedAccountingDocs;
  verify: typeof verifyDataset;
}

const DEFAULT_STEPS: DocumentSteps = {
  context: resolveSeedContext,
  stock: seedStock,
  pos: seedPos,
  ia: seedIa,
  prTemplate: seedPrTemplate,
  purchaseRequests: seedPurchaseRequests,
  purchaseOrders: seedPurchaseOrders,
  receiving: seedReceiving,
  storeRequisitions: seedStoreRequisitions,
  pricing: seedPricing,
  accountingDocs: seedAccountingDocs,
  verify: verifyDataset,
};

/** Run a step; a throw becomes a failed step instead of aborting the run without a summary. */
async function guard<T extends StepResult>(step: string, run: () => Promise<T>, fallback: Omit<T, keyof StepResult>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { step, created: 0, skipped: 0, failed: [`${step} threw: ${msg}`], ...fallback } as T;
  }
}

const strip = ({ step, created, skipped, failed }: StepResult): StepResult => ({ step, created, skipped, failed });

export async function seedAllDocuments(
  sessions: Sessions,
  cfg: ResetConfig,
  users: Record<string, TestUserInfo>,
  now: Date,
  overrides: Partial<DocumentSteps> = {},
  log: (line: string) => void = () => {},
): Promise<StepResult[]> {
  const s = { ...DEFAULT_STEPS, ...overrides };
  let ctx: SeedContext;
  try {
    ctx = await s.context(sessions, cfg, users, now);
  } catch (err) {
    return [{ step: "documents", created: 0, skipped: 0, failed: [err instanceof Error ? err.message : String(err)] }];
  }
  const ledger = new RowLedger();
  const results: StepResult[] = [];
  results.push(await guard("stock", () => s.stock(sessions, cfg, ctx, ledger), {}));
  results.push(await guard("pos", () => s.pos(sessions, cfg, ctx, ledger), {}));
  results.push(await guard("ia", () => s.ia(sessions, cfg, ctx, ledger), {}));
  results.push(await guard("pr-template", () => s.prTemplate(sessions, cfg, ctx, ledger), {}));
  const prs = await guard("purchase-requests", () => s.purchaseRequests(sessions, cfg, ctx, ledger), { reservedForPo: "" });
  results.push(strip(prs));
  const pos = await guard("purchase-orders", () => s.purchaseOrders(sessions, cfg, ctx, ledger, prs.reservedForPo), {
    forGrn: { full: "", partial: "" },
  });
  results.push(strip(pos));
  results.push(await guard("receiving", () => s.receiving(sessions, cfg, ctx, ledger, pos.forGrn), {}));
  results.push(await guard("store-requisitions", () => s.storeRequisitions(sessions, cfg, ctx, ledger), {}));
  results.push(await guard("pricing", () => s.pricing(sessions, cfg, ctx, ledger), {}));
  const accounting = await guard("accounting-docs", () => s.accountingDocs(sessions, cfg, ctx, ledger), { refused: [] as string[] });
  for (const refusal of accounting.refused) log(`accounting-docs: dev refused ${refusal}`);
  results.push(strip(accounting));
  let verified: { short: string[]; table: string };
  try {
    verified = await s.verify(sessions, cfg, ledger);
  } catch (err) {
    verified = { short: [`verify threw: ${err instanceof Error ? err.message : String(err)}`], table: "" };
  }
  if (verified.table) log(verified.table);
  results.push({ step: "verify", created: 0, skipped: 0, failed: verified.short });
  return results;
}
