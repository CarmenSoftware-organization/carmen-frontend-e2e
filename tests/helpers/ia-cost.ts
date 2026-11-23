import { round } from "./money";

export interface CostLayer {
  qty: number;
  cost: number;
}

/**
 * Expected cost of issuing `issueQty` from `layers` (oldest first). Pure.
 * average: issueQty x (sum(qty x cost) / sum(qty)); fifo: consume layers in the given order.
 * Rounded to 2 places once, at the end, so the oracle never hides the backend's own rounding.
 * Throws when the issue exceeds the layers' total.
 */
export function expectedIssueCost(layers: CostLayer[], issueQty: number, method: "average" | "fifo"): number {
  const totalQty = layers.reduce((n, l) => n + l.qty, 0);
  if (issueQty > totalQty) throw new Error(`expectedIssueCost: issue ${issueQty} exceeds layers total ${totalQty}`);
  if (method === "average") {
    const value = layers.reduce((n, l) => n + l.qty * l.cost, 0);
    return round((issueQty * value) / totalQty, 2);
  }
  let left = issueQty;
  let sum = 0;
  for (const l of layers) {
    if (left <= 0) break;
    const take = Math.min(left, l.qty);
    sum += take * l.cost;
    left -= take;
  }
  return round(sum, 2);
}
