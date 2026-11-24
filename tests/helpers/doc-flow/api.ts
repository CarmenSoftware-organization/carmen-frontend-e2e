import { BU_CODE } from "../../test-users";
import { buGet, rootGet, type ApiResult, type Role } from "../bu-api";

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

/**
 * Rows of a document list that is not BU-scoped (`GET /api/purchase-requests`, `/api/store-requisitions`
 * — the `/api/<bu>/...` form is 404). They take `bu_code` and group rows per BU at `data[i].data`;
 * reading `data` directly finds nothing, which made cleanup pass silently. Throws on a non-200.
 * list ของ PR/SR ไม่ผูก BU ใน path และห่อแถวไว้ที่ data[i].data
 */
export async function multiBuRows(path: string, bu: string, role: Role = "Admin"): Promise<any[]> {
  const sep = path.includes("?") ? "&" : "?";
  const { status, body } = await rootGet(role, `${path}${sep}bu_code=${bu}`);
  if (status !== 200) throw new Error(`list ${path} on ${bu}: HTTP ${status} ${JSON.stringify(body).slice(0, 300)}`);
  return ((body?.data ?? []) as any[]).flatMap((g) => (Array.isArray(g?.data) ? g.data : [g]));
}
