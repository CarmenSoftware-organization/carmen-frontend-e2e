// scripts/seed-master/parser.ts
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import type { RawRows, Row } from "./types";

/** RawRows key → exact sheet name in the workbook. Company Profile is intentionally omitted. */
const SHEET_MAP: Record<keyof RawRows, string> = {
  currency: "Currency",
  unit: "Unit",
  taxProfile: "Tax Profile",
  deliveryPoint: "Delivery Point",
  department: "Department",
  storeLocation: "Store Location",
  itemGroup: "Item Group",
  vendor: "Vendor",
  product: "Product list",
};

export function extractRows(wb: XLSX.WorkBook): RawRows {
  const out = {} as RawRows;
  for (const key of Object.keys(SHEET_MAP) as (keyof RawRows)[]) {
    const sheetName = SHEET_MAP[key];
    const ws = wb.Sheets[sheetName];
    if (!ws) throw new Error(`Missing sheet "${sheetName}"`);
    out[key] = XLSX.utils.sheet_to_json<Row>(ws, { defval: null });
  }
  return out;
}

export function readWorkbookFile(path: string): XLSX.WorkBook {
  // xlsx 0.20 (ESM build) has no fs unless XLSX.set_fs() is called, so readFile throws
  // "Cannot access file"; read the bytes ourselves.
  return XLSX.read(readFileSync(path), { type: "buffer" });
}
