import { BU_CODE } from "../../test-users";
import { buGet, type ApiResult, type Role } from "../bu-api";

/** Read-only GET as a TEST BU role (Admin by default — it can see every document). `path` is relative to the BU. */
export function dfGet<T = any>(path: string, role: Role = "Admin", bu: string = BU_CODE): Promise<ApiResult<T>> {
  return buGet<T>(role, path, bu);
}

export interface TxDetail {
  qty_in: number;
  qty_out: number;
  cost_per_unit: number;
  total_cost: number;
  location?: { code?: string };
  product?: { code?: string };
}

/**
 * Inventory transaction details a document posted (API `inventory-transactions`, matched by
 * the parent document id) — what "the document moved stock" means, without reading the DB.
 */
export async function txOfDoc(bu: string, docId: string, docNo: string): Promise<TxDetail[]> {
  const { status, body } = await dfGet(`/inventory-transactions?perpage=100&search=${encodeURIComponent(docNo)}`, "Admin", bu);
  if (status !== 200) throw new Error(`inventory-transactions ${docNo}: HTTP ${status}`);
  return (body?.data ?? [])
    .filter((t: any) => t.parent_document_id === docId)
    .flatMap((t: any) => t.details ?? []) as TxDetail[];
}
