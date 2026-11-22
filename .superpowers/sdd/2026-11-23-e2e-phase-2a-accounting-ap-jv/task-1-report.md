# Task 1 report

Status: DONE. Commit b22c37b (pushed, no force) on feat/e2e-phase-2a-accounting-data.
Tests: bun test:unit 58 files / 536 tests green; tsc shows only pre-existing errors (import.meta in index.ts, duplicate keys in run.test.ts lines 59-60).
Live: data:reset --yes exit 0, accounting created 55 / failed 0. Standalone re-run of seedAccountingBase on seeded BU: created 0, skipped 55, failed 0 (a full data:reset always wipes first, so the skipped row only shows when calling the step alone).

Files: scripts/data-reset/accounting.ts (new), index.ts (step after coa, dry-run line, stop gate), fixtures/chart-of-accounts.json (+1110, 1180, 2150, 4300, 5400; existing 13 untouched), README.md, unit/data-reset/accounting.test.ts (10 cases), run.test.ts (routes, order list, new stop case), preflight doc section 6.
Endpoints: PUT /app-config/gl_setting ({value}), POST /gl-periods/years ({fiscal_year}), POST/PUT /bank-accounts, GET/POST/PATCH /tax-profiles, PUT /vendors/:id.
Concerns: see handback.

## Fix round 1
- accounting.ts now seeds GL JV prefixes APJV (AP / auto) and APRV (reversal) via `/gl-jv-prefixes` (by code, idempotent; system prefixes JV/OV/RV already exist and are left alone) and writes `ap_jv_prefix_id`, `auto_jv_prefix_id`, `reversal_prefix_id` through the gl_setting merge.
- Tests: 539 green (new prefix cases, read-failure case, dry-run case; idempotent skipped count 9).
- Live: data:reset --yes exit 0, accounting created 57, failed 0.
- Posting probe (admin, TEST BU only): create invoice (1 line, 100, dr 5300) -> 200; submit -> doc_status posted, gl_jv_no 20261100001, gl_jv_id set; void -> doc_status void. No other missing setting found. The voided probe invoice APIV26110001 remains in TEST BU (void leaves the row); the next data:reset wipes it.
