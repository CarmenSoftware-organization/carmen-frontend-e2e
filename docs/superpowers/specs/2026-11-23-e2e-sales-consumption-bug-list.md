# E2E Sales Consumption + Import POS — bug list

| | |
| --- | --- |
| Date | 2026-11-23 |
| Branch | `test/e2e-sales-consumption` |
| Source of truth | every `.fail(` in `tests/140-import-pos.spec.ts` and `tests/141-sales-consumption.spec.ts`. After Task 4 (140): **0 pin sites**. After Task 5 (141 groups 01-05): **0 pin sites**. Later 141 tasks append their rows here. A `test.fail` reports passed while the bug exists and turns red ("unexpectedly passed") once fixed: drop the marker then. |

Format as `2026-11-23-e2e-phase-2a-bug-list.md`. Verdicts are the implementer's, none confirmed by a product owner.

## 1. Suspected bugs

None found by spec 140 (17 runs of 8 cases on dev, two consecutive runs without a reset, all green).

None found by spec 141 groups 01-05 (14 cases; see section 2 for refusal codes that differ from the plan's guesses but match the feature spec). Parallel `post` (same `doc_version`) gave exactly one 2xx and one set of Stock Outs; a second sequential post gave 409 and no second set; a short location produced no Stock Out and left on-hand unchanged.

## 2. Needs product decision

| Observation | Spec / TC-ID | Oracle | Actual |
| --- | --- | --- | --- |
| `POST /pos-sales/imports/micros3700/check` is accepted (200, `kind: rejected`, a `format_error` import row recorded) on a BU where Micros 3700 is **not** enabled (`enabled_brands` = `simphony`). The Upload PDF button is hidden by the FE, but the endpoint has no brand gate. Not pinned: the case asserts the documented rejected answer. | 140 TC-IPOS-020004 (asserts the documented answer, not a pin) | feature spec §4.2 says only enabled brands show an upload button (UI); silent about the API | 200 + rejected row in history for a disabled brand. Decide whether the API should refuse with 403 / a catalog code. |
| The brief expected a Micros `check` of Simphony lines to be "not 2xx". The BE answers 200 with `kind: rejected` (gateway docblock: a file that cannot be imported is recorded as a rejected import and comes back `kind: rejected`). Treated as correct. | 140 TC-IPOS-020004 | gateway docblock `checkMicros3700` | 200, `kind: rejected`, `import.status` `format_error` |
| SC detail flips to the Ingredients tab after every sales-line edit (location or recipe saved from the Sales lines tab returns the page on `?tab=ingredients`). A user editing several lines has to switch back to Sales lines each time. Not pinned (no dedicated case); the page object's `showSalesLines()` works around it. Repro: open a pending SC > Sales lines > change any line's location or recipe > the page lands on Ingredients. | 141 TC-SC-020001 / TC-SC-020003 (workaround only) | feature spec §4.2 describes the Sales lines / Ingredients tabs but not which tab is shown after an edit | tab switches to Ingredients after each line save. Decide whether the edit should keep the user on Sales lines. |
| Refusal codes differ from the plan's guesses, behaviour matches the feature spec, asserted as the real code: editing lines of a posted SC answers `SALES_CONSUMPTION_NOT_PENDING` (409), not `SALES_CONSUMPTION_LINE_POSTED`; post after a line edit (verification dropped) answers `SALES_CONSUMPTION_NOT_VERIFIED`, not `SALES_CONSUMPTION_VERIFY_STALE`. Post on a verified-short day answers `SALES_CONSUMPTION_VERIFY_FAILED` whose body does not name the short products (the per-location short list is in the verify answer); spec §4.2 says a refused post "returns the short products per location". Not pinned. | 141 TC-SC-020004 / 030002 / 040002 | feature spec §4.2 (posted SC cannot be edited; line edit invalidates verification; short location = no Stock Out) | codes as stated. Decide whether post's VERIFY_FAILED should carry the short list. |

## 3. Not covered by 140

- Micros 3700 PDF upload and SFTP pulls (non-goal; Simphony only).
- Cancel of a posted day through the UI: the Cancel import button is hidden when the import has confirmed lines, so TC-IPOS-030002 checks that the button is absent and drives the refusal through the API.
- Overwrite / `needs_resolution` of Micros outlets (Micros not enabled on TEST BU).
- Cancel of an import with partially confirmed lines (needs a multi-location posted day; 141 owns posting).
