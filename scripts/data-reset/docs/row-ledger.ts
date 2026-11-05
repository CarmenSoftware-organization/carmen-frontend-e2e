// scripts/data-reset/docs/row-ledger.ts
// Which documents each dataset row produced, and what failed — read by the final verify.
// เก็บว่าแต่ละแถวของชุดข้อมูลได้เอกสารเลขอะไร และอะไรล้ม — ใช้ตอนตรวจนับท้ายสุด

export class RowLedger {
  private readonly byRow = new Map<string, { docNos: string[]; failures: string[] }>();

  record(row: string, docNo: string | null, ok: boolean, why?: string): void {
    const entry = this.byRow.get(row) ?? { docNos: [], failures: [] };
    if (ok && docNo) entry.docNos.push(docNo);
    if (!ok) entry.failures.push(why ?? "failed");
    this.byRow.set(row, entry);
  }

  rows(): Record<string, { docNos: string[]; failures: string[] }> {
    return Object.fromEntries(this.byRow);
  }
}
