import { rootGet, type Role } from "./bu-api";
import { TEST_BUS } from "../test-users";

/**
 * Pending-approval totals behind My Approvals, read from the API the page itself calls.
 *
 * The "Total Pending" card reads `GET /api/my-approve/pending`, which takes no BU and counts every
 * business unit the user belongs to; the table reads `GET /api/my-pending?bu_code=<active BU>`.
 * With the gmail accounts in all three TEST BUs the two differ, so a card-vs-footer check must
 * compare the card with the sum over the BUs and the footer with the active BU alone.
 * การ์ด Total Pending นับทุก BU ส่วนตารางนับเฉพาะ BU ที่เลือก
 */
export async function pendingTotals(role: Role): Promise<{ perBu: Record<string, number>; all: number }> {
  const perBu: Record<string, number> = {};
  for (const { code } of TEST_BUS) {
    const { status, body } = await rootGet(role, `/my-pending?bu_code=${code}&perpage=1`);
    if (status !== 200) throw new Error(`my-pending on ${code}: HTTP ${status}`);
    perBu[code] = Number(body?.paginate?.total ?? 0);
  }
  return { perBu, all: Object.values(perBu).reduce((a, b) => a + b, 0) };
}
