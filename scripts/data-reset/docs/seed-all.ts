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
import { seedPricing } from "./pricing";
import { seedPrTemplate, seedPurchaseRequests } from "./purchase-requests";
import { seedPurchaseOrders } from "./purchase-orders";
import { seedReceiving } from "./receiving";
import { RowLedger } from "./row-ledger";
import { seedStock } from "./stock";
import { seedStoreRequisitions } from "./store-requisitions";

export interface DocumentSteps {
  context: typeof resolveSeedContext;
  stock: typeof seedStock;
  prTemplate: typeof seedPrTemplate;
  purchaseRequests: typeof seedPurchaseRequests;
  purchaseOrders: typeof seedPurchaseOrders;
  receiving: typeof seedReceiving;
  storeRequisitions: typeof seedStoreRequisitions;
  pricing: typeof seedPricing;
  verify: typeof verifyDataset;
}

const DEFAULT_STEPS: DocumentSteps = {
  context: resolveSeedContext,
  stock: seedStock,
  prTemplate: seedPrTemplate,
  purchaseRequests: seedPurchaseRequests,
  purchaseOrders: seedPurchaseOrders,
  receiving: seedReceiving,
  storeRequisitions: seedStoreRequisitions,
  pricing: seedPricing,
  verify: verifyDataset,
};

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
  results.push(await s.stock(sessions, cfg, ctx, ledger));
  results.push(await s.prTemplate(sessions, cfg, ctx, ledger));
  const prs = await s.purchaseRequests(sessions, cfg, ctx, ledger);
  results.push(strip(prs));
  const pos = await s.purchaseOrders(sessions, cfg, ctx, ledger, prs.reservedForPo);
  results.push(strip(pos));
  results.push(await s.receiving(sessions, cfg, ctx, ledger, pos.forGrn));
  results.push(await s.storeRequisitions(sessions, cfg, ctx, ledger));
  results.push(await s.pricing(sessions, cfg, ctx, ledger));
  const verified = await s.verify(sessions, cfg, ledger);
  if (verified.table) log(verified.table);
  results.push({ step: "verify", created: 0, skipped: 0, failed: verified.short });
  return results;
}
