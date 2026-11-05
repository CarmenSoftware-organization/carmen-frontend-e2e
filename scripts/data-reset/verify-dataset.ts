// scripts/data-reset/verify-dataset.ts
// Spec step 3: read back counts per document type and state for the whole BU, compare with the
// table, and name every short row with the doc numbers seeded for it.
// ขั้น 3: นับเอกสารทั้ง BU เทียบกับตาราง แถวที่ขาดจะบอกชื่อพร้อมเลขเอกสารที่ seed ไว้
import type { ResetConfig } from "./config";
import type { RowLedger } from "./docs/row-ledger";
import type { Sessions } from "./sessions";

export interface ExpectedRow {
  row: string;
  /** List path; `{bu}` is replaced by the BU code. */
  list: string;
  filter?: string;
  /** Count in-progress rows whose workflow_current_stage equals this. */
  stage?: string;
  min: number;
  ledgerRows: string[];
}

const PR = "/api/purchase-requests?bu_code={bu}";
const SR = "/api/store-requisitions?bu_code={bu}";
const at = (bu: string) => `/api/{bu}/${bu}`;

export const EXPECTED_ROWS: ExpectedRow[] = [
  { row: "PR draft", list: PR, filter: "pr_status:draft", min: 3, ledgerRows: ["pr.draft"] },
  { row: "PR at HOD Approval", list: PR, stage: "HOD Approval", min: 19, ledgerRows: ["pr.hod", "pr.second-dept"] },
  { row: "PR at Purchase", list: PR, stage: "Purchase", min: 8, ledgerRows: ["pr.purchase"] },
  { row: "PR at GM Approval", list: PR, stage: "GM Approval", min: 2, ledgerRows: ["pr.gm"] },
  { row: "PR returned", list: PR, stage: "Create Request", min: 1, ledgerRows: ["pr.returned"] },
  { row: "PR approved", list: PR, filter: "pr_status:approved", min: 5, ledgerRows: ["pr.approved"] },
  { row: "PR completed", list: PR, filter: "pr_status:completed", min: 1, ledgerRows: ["pr.completed"] },
  { row: "PR voided", list: PR, filter: "pr_status:voided", min: 2, ledgerRows: ["pr.rejected", "pr.void"] },
  { row: "PR template", list: at("purchase-request-templates"), min: 1, ledgerRows: ["pr-template.active"] },
  { row: "PO draft", list: at("purchase-orders"), filter: "po_status:draft", min: 1, ledgerRows: ["po.draft"] },
  { row: "PO voided", list: at("purchase-orders"), filter: "po_status:voided", min: 1, ledgerRows: ["po.rejected"] },
  { row: "PO approved", list: at("purchase-orders"), filter: "po_status:approved", min: 2, ledgerRows: ["po.approved", "po.from-pr"] },
  { row: "PO sent", list: at("purchase-orders"), filter: "po_status:sent_or_print", min: 1, ledgerRows: ["po.sent"] },
  { row: "PO partial", list: at("purchase-orders"), filter: "po_status:partial", min: 1, ledgerRows: ["po.partial"] },
  { row: "PO completed", list: at("purchase-orders"), filter: "po_status:completed", min: 1, ledgerRows: ["po.completed"] },
  { row: "GRN draft", list: at("good-received-notes"), filter: "doc_status:draft", min: 1, ledgerRows: ["grn.draft"] },
  { row: "GRN saved", list: at("good-received-notes"), filter: "doc_status:saved", min: 1, ledgerRows: ["grn.received"] },
  { row: "GRN committed", list: at("good-received-notes"), filter: "doc_status:committed", min: 2, ledgerRows: ["grn.committed", "grn.partial"] },
  { row: "CN draft", list: at("credit-notes"), filter: "doc_status:draft", min: 1, ledgerRows: ["cn.draft"] },
  { row: "CN completed", list: at("credit-notes"), filter: "doc_status:completed", min: 1, ledgerRows: ["cn.committed"] },
  { row: "SR draft", list: SR, filter: "doc_status:draft", min: 2, ledgerRows: ["sr.draft"] },
  { row: "SR in progress", list: SR, filter: "doc_status:in_progress", min: 3, ledgerRows: ["sr.approve", "sr.ready-for-issue"] },
  { row: "SR voided", list: SR, filter: "doc_status:voided", min: 1, ledgerRows: ["sr.cancelled"] },
  { row: "SR completed", list: SR, filter: "doc_status:completed", min: 1, ledgerRows: ["sr.completed"] },
  { row: "Price list active", list: at("pricelists"), filter: "status:active", min: 3, ledgerRows: ["pricelist.active"] },
  { row: "Campaign", list: at("request-for-pricings"), min: 3, ledgerRows: ["campaign.active", "campaign.draft", "campaign.expired"] },
];

function url(list: string, bu: string, params: Record<string, string>): string {
  const path = list.replace("{bu}", bu);
  const query = new URLSearchParams(params).toString();
  return `${path}${path.includes("?") ? "&" : "?"}${query}`;
}

export async function verifyDataset(
  sessions: Sessions, cfg: ResetConfig, ledger: RowLedger,
): Promise<{ short: string[]; table: string }> {
  const admin = await sessions.client(cfg.adminEmail);
  const seeded = ledger.rows();
  const short: string[] = [];
  const lines = ["row                     min  found"];
  for (const r of EXPECTED_ROWS) {
    let found: number;
    if (r.stage) {
      // Stage filter key on the list is unverified; count the in-progress rows client-side.
      const res = await admin.get(url(r.list, cfg.buCode, { perpage: "100", filter: "pr_status:in_progress" }));
      const rows: any[] = Array.isArray(res.body?.data) ? res.body.data : [];
      found = rows.filter((x) => x.workflow_current_stage === r.stage).length;
    } else {
      const res = await admin.get(url(r.list, cfg.buCode, { perpage: "1", ...(r.filter ? { filter: r.filter } : {}) }));
      found = Number(res.body?.paginate?.total ?? 0);
    }
    lines.push(`${r.row.padEnd(22)}${String(r.min).padStart(5)}${String(found).padStart(7)}${found < r.min ? "  ✗" : ""}`);
    if (found < r.min) {
      const docs = r.ledgerRows.flatMap((k) => seeded[k]?.docNos ?? []);
      short.push(`${r.row}: expected ≥ ${r.min}, found ${found} (seeded: ${docs.length ? docs.join(", ") : "none"})`);
    }
  }
  return { short, table: lines.join("\n") };
}
