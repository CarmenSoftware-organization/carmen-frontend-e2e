/**
 * Simphony Standard Export fixture builder. Field positions are 1-based and count the line-type
 * column (parser `field(fields, n)` = `split("|")[n - 1]`), see simphony.parser.ts in the backend.
 * ตัวสร้างไฟล์ Simphony: ตำแหน่งฟิลด์นับจาก 1 รวมคอลัมน์ชนิดบรรทัด
 */
export interface SimphonyLine {
  outletCode: string;
  outletName: string;
  itemCode: string;
  itemName: string;
  deptCode: string;
  deptName: string;
  qty: number;
  total: number;
}

export interface SimphonyInput {
  storeKey: string;
  storeName: string;
  /** YYYY-MM-DD */
  businessDate: string;
  version?: string;
  lines: SimphonyLine[];
}

const MID_FIELDS = 40;
const MAX_CODE = 20;

function code(label: string, value: string): string {
  if (value.length > MAX_CODE) throw new Error(`simphony-fixture: ${label} "${value}" is longer than ${MAX_CODE} characters`);
  return value;
}

export function buildSimphonyFile(input: SimphonyInput): string {
  const ymd = input.businessDate.replaceAll("-", "");
  if (!/^\d{8}$/.test(ymd)) throw new Error(`simphony-fixture: businessDate must be YYYY-MM-DD (got "${input.businessDate}")`);
  const glid = new Array<string>(11).fill("");
  glid[0] = "GLID";
  glid[1] = code("store key", input.storeKey);
  glid[2] = input.storeName;
  glid[3] = ymd;
  glid[4] = ymd;
  glid[7] = input.version ?? "1.20";
  glid[9] = "E2E";
  glid[10] = "Simphony export";
  const rows = [glid.join("|")];
  for (const l of input.lines) {
    const mid = new Array<string>(MID_FIELDS).fill("");
    mid[0] = "MID";
    mid[1] = code("outlet code", l.outletCode);
    mid[3] = code("item code", l.itemCode);
    mid[4] = l.itemName;
    mid[6] = String(l.qty);
    mid[14] = l.outletName;
    mid[19] = l.deptName;
    mid[20] = code("department code", l.deptCode);
    mid[32] = String(l.total);
    rows.push(mid.join("|"));
  }
  return rows.join("\r\n") + "\r\n";
}
