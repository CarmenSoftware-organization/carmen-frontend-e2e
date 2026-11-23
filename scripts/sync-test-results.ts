/**
 * Sync Playwright test results to Google Sheets, one tab per spec file.
 *
 * Reads JSON written by `tests/reporters/tc-json-reporter.ts` — one file per
 * spec at `tests/results/<NNN-module>-results.json`. Each file is an array of
 * rows (see TCResultRow interface).
 *
 * For each sheet tab:
 *   1. Read the current header row. If the tab is empty, bootstrap it with
 *      the canonical 15-column header. If it exists but is missing any of
 *      the canonical columns, append them (preserves existing columns).
 *   2. Build a `testId → row number` index from the sheet's Test ID column.
 *   3. For each JSON row:
 *        - If the sheet already has a row with that Test ID → update it.
 *          - Reporter-owned columns (Status, Run Date, Duration, Error, Seq)
 *            are always overwritten.
 *          - Annotation-owned columns (Preconditions, Steps, Expected Result,
 *            Priority, Test Type) are always overwritten — they come from
 *            the test source (code is truth).
 *          - Title is write-once (only fills an empty cell).
 *          - Note is write-once (free-form, human-authored).
 *        - If not found → append a new row with all fields populated.
 *
 * Required env (set in `.env.local` — do NOT commit):
 *   GOOGLE_SHEETS_SA_KEY_PATH=/absolute/path/to/service-account.json
 *   GOOGLE_SHEETS_SPREADSHEET_ID=<sheet id from URL>
 *
 * Setup (one-time):
 *   1. Google Cloud Console → enable Google Sheets API
 *   2. IAM → Service Accounts → create → download JSON key
 *   3. Share the target spreadsheet with the service-account email as Editor
 *   4. Set the env vars above
 *   5. `bun run scripts/sync-test-results.ts`
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { google } from "googleapis";
import type { TCResultRow } from "../tests/reporters/tc-json-reporter";

interface SyncTarget {
  jsonFile: string; // file under tests/results/
  sheetTab: string; // exact tab name in the spreadsheet
}

const SYNC_TARGETS: SyncTarget[] = [
  { jsonFile: "001-login-results.json", sheetTab: "Login" },
  { jsonFile: "002-spa-smoke-results.json", sheetTab: "SPA_Smoke" },
  { jsonFile: "010-department-results.json", sheetTab: "Department" },
  { jsonFile: "020-unit-results.json", sheetTab: "Unit" },
  { jsonFile: "029-business-type-results.json", sheetTab: "Business_Type" },
  { jsonFile: "030-extra-cost-results.json", sheetTab: "Extra_Cost" },
  { jsonFile: "031-adjustment-type-results.json", sheetTab: "Adjustment_Type" },
  { jsonFile: "032-credit-term-results.json", sheetTab: "Credit_Term" },
  { jsonFile: "040-currency-results.json", sheetTab: "Currency" },
  { jsonFile: "041-exchange-rate-results.json", sheetTab: "Exchange_Rate" },
  { jsonFile: "042-tax-profile-results.json", sheetTab: "Tax_Profile" },
  { jsonFile: "043-certification-results.json", sheetTab: "Certification" },
  { jsonFile: "044-eco-results.json", sheetTab: "Eco" },
  { jsonFile: "079-delivery-point-results.json", sheetTab: "Delivery_Point" },
  { jsonFile: "080-location-results.json", sheetTab: "Location" },
  { jsonFile: "081-chart-of-account-mapping-results.json", sheetTab: "Chart_Of_Account_Mapping" },
  { jsonFile: "082-chart-of-accounts-results.json", sheetTab: "Chart_Of_Accounts" },
  { jsonFile: "083-shelf-results.json", sheetTab: "Shelf" },
  { jsonFile: "101-product-category-results.json", sheetTab: "Product_Category" },
  { jsonFile: "110-op-category-results.json", sheetTab: "OP_Category" },
  { jsonFile: "111-cuisine-results.json", sheetTab: "Cuisine" },
  { jsonFile: "121-recipe-equipment-category-results.json", sheetTab: "Recipe_Equipment_Category" },
  { jsonFile: "131-equipment-category-results.json", sheetTab: "Equipment_Category" },
  { jsonFile: "150-vendor-results.json", sheetTab: "Vendor" },
  { jsonFile: "159-pl-results.json", sheetTab: "PL" },
  { jsonFile: "160-pl-template-results.json", sheetTab: "PL_Template" },
  { jsonFile: "201-my-approvals-results.json", sheetTab: "My_Approvals" },
  { jsonFile: "301-pr-results.json", sheetTab: "PR" },
  { jsonFile: "302-pr-creator-journey-results.json", sheetTab: "PR_Creator" },
  { jsonFile: "303-pr-approver-journey-results.json", sheetTab: "PR_Approver" },
  { jsonFile: "304-pr-purchaser-journey-results.json", sheetTab: "PR_Purchaser" },
  { jsonFile: "310-pr-template-results.json", sheetTab: "PR_Template" },
  { jsonFile: "311-pr-returned-flow-results.json", sheetTab: "PR_Returned_Flow" },
  { jsonFile: "312-pr-doc-flow-results.json", sheetTab: "PR_Doc_Flow" },
  { jsonFile: "401-po-results.json", sheetTab: "PO" },
  { jsonFile: "402-po-purchaser-journey-results.json", sheetTab: "PO_Purchaser" },
  { jsonFile: "403-po-approver-journey-results.json", sheetTab: "PO_Approver" },
  { jsonFile: "404-po-doc-flow-results.json", sheetTab: "PO_Doc_Flow" },
  { jsonFile: "501-grn-results.json", sheetTab: "GRN" },
  { jsonFile: "502-grn-doc-flow-results.json", sheetTab: "GRN_Doc_Flow" },
  { jsonFile: "601-cn-results.json", sheetTab: "CN" },
  { jsonFile: "602-cn-reason-results.json", sheetTab: "CN_Reason" },
  { jsonFile: "603-cn-doc-flow-results.json", sheetTab: "CN_Doc_Flow" },
  { jsonFile: "701-sr-results.json", sheetTab: "SR" },
  { jsonFile: "702-sr-doc-flow-results.json", sheetTab: "SR_Doc_Flow" },
  { jsonFile: "710-wastage-reporting-results.json", sheetTab: "Wastage_Reporting" },
  { jsonFile: "711-stock-replenishment-results.json", sheetTab: "Stock_Replenishment" },
  { jsonFile: "720-stock-issue-results.json", sheetTab: "Stock_Issue" },
  { jsonFile: "721-sr-issue-doc-flow-results.json", sheetTab: "SR_Issue_Doc_Flow" },
  { jsonFile: "731-inventory-adjustment-results.json", sheetTab: "Inventory_Adjustment" },
  { jsonFile: "732-inventory-adjustment-stock-results.json", sheetTab: "Inventory_Adjustment_Stock" },
  { jsonFile: "900-period-end-results.json", sheetTab: "Period_End" },
  { jsonFile: "910-period-close-prestep-results.json", sheetTab: "Period_Close_Prestep" },
  { jsonFile: "911-period-close-blockers-results.json", sheetTab: "Period_Close_Blockers" },
  { jsonFile: "912-period-close-start-gate-results.json", sheetTab: "Period_Close_Start_Gate" },
  { jsonFile: "914-period-close-out-of-period-docs-results.json", sheetTab: "Period_Close_Out_Of_Period" },
  { jsonFile: "916-period-close-fix-guards-results.json", sheetTab: "Period_Close_Fix_Guards" },
  { jsonFile: "917-period-close-new-rules-results.json", sheetTab: "Period_Close_New_Rules" },
  { jsonFile: "918-period-close-start-results.json", sheetTab: "Period_Close_Start" },
  { jsonFile: "919-period-close-active-period-results.json", sheetTab: "Period_Close_Active_Period" },
  { jsonFile: "920-period-close-close-gate-results.json", sheetTab: "Period_Close_Close_Gate" },
  { jsonFile: "921-period-close-count-results.json", sheetTab: "Period_Close_Count" },
  { jsonFile: "922-period-close-verify-results.json", sheetTab: "Period_Close_Verify" },
  { jsonFile: "923-period-close-ledger-views-results.json", sheetTab: "Period_Close_Ledger_Views" },
  { jsonFile: "924-period-close-close-results.json", sheetTab: "Period_Close_Close" },
  { jsonFile: "1001-campaign-results.json", sheetTab: "Campaign" },
];

const RESULTS_DIR = resolve(process.cwd(), "tests/results");

function loadResults(jsonFile: string): TCResultRow[] {
  const path = resolve(RESULTS_DIR, jsonFile);
  if (!existsSync(path)) {
    console.warn(`[skip] ${jsonFile} not found at ${path}`);
    return [];
  }
  try {
    const raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.warn(`[skip] ${jsonFile} is not a JSON array`);
      return [];
    }
    return parsed.filter((r) => r && typeof r.testId === "string");
  } catch (err) {
    console.warn(`[skip] ${jsonFile} failed to parse: ${(err as Error).message}`);
    return [];
  }
}

/** Canonical column order used when bootstrapping/extending a sheet tab. */
const CANONICAL_HEADER = [
  "Seq",
  "Test ID",
  "Title",
  "Preconditions",
  "Steps",
  "Expected Result",
  "Priority",
  "Test Type",
  "Status",
  "Run Date",
  "Duration (ms)",
  "Error",
  "Note",
  "Screenshot",
  "Video",
];

async function ensureHeaders(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  sheetTab: string,
  currentHeader: string[],
): Promise<string[]> {
  const missing = CANONICAL_HEADER.filter((c) => {
    if (c === "Run Date") {
      return currentHeader.indexOf("Run Date") < 0 && currentHeader.indexOf("Test Date") < 0;
    }
    return currentHeader.indexOf(c) < 0;
  });
  if (missing.length === 0) return currentHeader;
  const newHeader = [...currentHeader, ...missing];
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetTab}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: [newHeader] },
  });
  console.log(`[${sheetTab}] added missing header columns: ${missing.join(", ")}`);
  return newHeader;
}

function colLetter(zeroIdx: number): string {
  let n = zeroIdx + 1;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

async function syncTab(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  target: SyncTarget,
  rows: TCResultRow[],
  resetMode: boolean,
) {
  if (rows.length === 0) {
    console.log(`[${target.sheetTab}] no rows in ${target.jsonFile}`);
    return;
  }

  const range = `${target.sheetTab}!A1:Z`;
  let grid: string[][] = [];
  try {
    const { data } = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    grid = (data.values ?? []) as string[][];
  } catch (err: unknown) {
    const e = err as { status?: number; code?: number; message?: string };
    const status = e?.status ?? e?.code;
    const message = e?.message ?? String(err);
    if (status === 400 || status === 404) {
      // Tab does not exist yet (range parse fails for an unknown tab). Since we
      // only reach here when there ARE rows to write (rows.length === 0 returns
      // earlier), create the tab and fall through to the header bootstrap below.
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{ addSheet: { properties: { title: target.sheetTab } } }],
        },
      });
      console.log(`[${target.sheetTab}] tab did not exist — created`);
      grid = [];
    } else {
      console.error(`[${target.sheetTab}] error (${status ?? "?"}): ${message}`);
      throw err;
    }
  }

  // Bootstrap empty tab with canonical header.
  if (grid.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${target.sheetTab}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [CANONICAL_HEADER] },
    });
    console.log(`[${target.sheetTab}] tab was empty — wrote header`);
    grid = [CANONICAL_HEADER];
  }

  // Extend header with any missing canonical columns.
  const header = await ensureHeaders(sheets, spreadsheetId, target.sheetTab, grid[0]);
  grid[0] = header;

  // Reset mode: drop all data rows (keep header), then everything will be appended fresh.
  if (resetMode && grid.length > 1) {
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${target.sheetTab}!A2:Z`,
    });
    console.log(`[${target.sheetTab}] reset — cleared ${grid.length - 1} data row(s)`);
    grid = [header];
  }

  // Resolve column indexes (all 15 canonical + legacy "Test Date" fallback).
  const idCol = header.indexOf("Test ID");
  const seqCol = header.indexOf("Seq");
  const titleCol = (() => {
    const i = header.indexOf("Title");
    return i >= 0 ? i : header.indexOf("Description");
  })();
  const preconditionsCol = header.indexOf("Preconditions");
  const stepsCol = header.indexOf("Steps");
  const expectedCol = header.indexOf("Expected Result");
  const priorityCol = header.indexOf("Priority");
  const testTypeCol = header.indexOf("Test Type");
  const statusCol = header.indexOf("Status");
  const dateCol = (() => {
    const i = header.indexOf("Run Date");
    return i >= 0 ? i : header.indexOf("Test Date");
  })();
  const durationCol = header.indexOf("Duration (ms)");
  const errorCol = header.indexOf("Error");
  const noteCol = header.indexOf("Note");
  const screenshotCol = header.indexOf("Screenshot");
  const videoCol = header.indexOf("Video");

  if (idCol < 0 || statusCol < 0 || dateCol < 0) {
    console.warn(`[${target.sheetTab}] missing required columns (Test ID/Status/Run Date) — skipping`);
    return;
  }

  // Build Test ID → 1-based row number index.
  const idToRow = new Map<string, number>();
  for (let i = 1; i < grid.length; i++) {
    const id = grid[i][idCol];
    if (id) idToRow.set(id, i + 1);
  }

  const dataUpdates: { range: string; values: string[][] }[] = [];
  const appendRows: string[][] = [];
  const headerLen = header.length;
  let matched = 0;
  let appended = 0;

  for (const r of rows) {
    const rowNum = idToRow.get(r.testId);
    if (!rowNum) {
      const row = new Array<string>(headerLen).fill("");
      row[idCol] = r.testId;
      if (seqCol >= 0) row[seqCol] = String(r.seq);
      if (titleCol >= 0) row[titleCol] = r.title;
      if (preconditionsCol >= 0) row[preconditionsCol] = r.preconditions;
      if (stepsCol >= 0) row[stepsCol] = r.steps;
      if (expectedCol >= 0) row[expectedCol] = r.expected;
      if (priorityCol >= 0) row[priorityCol] = r.priority;
      if (testTypeCol >= 0) row[testTypeCol] = r.testType;
      row[statusCol] = r.status;
      row[dateCol] = r.runDate;
      if (durationCol >= 0) row[durationCol] = String(r.duration);
      if (errorCol >= 0) row[errorCol] = r.error;
      if (noteCol >= 0) row[noteCol] = r.note;
      if (screenshotCol >= 0) row[screenshotCol] = r.screenshot ?? "";
      if (videoCol >= 0) row[videoCol] = r.video ?? "";
      appendRows.push(row);
      appended++;
      continue;
    }
    matched++;

    // Reporter-owned columns: always overwrite.
    const push = (col: number, value: string) => {
      if (col < 0) return;
      dataUpdates.push({
        range: `${target.sheetTab}!${colLetter(col)}${rowNum}`,
        values: [[value]],
      });
    };
    push(statusCol, r.status);
    push(dateCol, r.runDate);
    if (durationCol >= 0) push(durationCol, String(r.duration));
    if (errorCol >= 0) push(errorCol, r.error);
    if (seqCol >= 0) push(seqCol, String(r.seq));
    if (screenshotCol >= 0) push(screenshotCol, r.screenshot ?? "");
    if (videoCol >= 0) push(videoCol, r.video ?? "");

    // Annotation-owned columns: always overwrite (code is truth).
    push(preconditionsCol, r.preconditions);
    push(stepsCol, r.steps);
    push(expectedCol, r.expected);
    push(priorityCol, r.priority);
    push(testTypeCol, r.testType);

    // Title: write-once (preserve manual edits).
    if (titleCol >= 0 && r.title) {
      const existing = grid[rowNum - 1]?.[titleCol] ?? "";
      if (!existing.trim()) push(titleCol, r.title);
    }
    // Note: write-once (free-form, human-authored).
    if (noteCol >= 0 && r.note) {
      const existing = grid[rowNum - 1]?.[noteCol] ?? "";
      if (!existing.trim()) push(noteCol, r.note);
    }
  }

  if (dataUpdates.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: { valueInputOption: "RAW", data: dataUpdates },
    });
  }
  if (appendRows.length > 0) {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${target.sheetTab}!A1`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: appendRows },
    });
  }

  console.log(`[${target.sheetTab}] updated ${matched} rows` + (appended > 0 ? `, appended ${appended} new rows` : ""));
}

async function main() {
  const keyPath = process.env.GOOGLE_SHEETS_SA_KEY_PATH;
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!keyPath || !spreadsheetId) {
    console.error(
      "Missing GOOGLE_SHEETS_SA_KEY_PATH or GOOGLE_SHEETS_SPREADSHEET_ID. " +
        "See header comment in this file for setup steps.",
    );
    process.exit(1);
  }

  const resetMode = process.argv.includes("--reset") || process.env.SYNC_RESET === "1";
  if (resetMode) {
    console.log(
      "Reset mode: data rows will be cleared in every tab before syncing (header preserved). " +
        "Manual edits in Title/Note will be lost.",
    );
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: keyPath,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  if (existsSync(RESULTS_DIR)) {
    console.log(`Found result files: ${readdirSync(RESULTS_DIR).join(", ")}`);
  }

  for (const target of SYNC_TARGETS) {
    const rows = loadResults(target.jsonFile);
    await syncTab(sheets, spreadsheetId, target, rows, resetMode);
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
