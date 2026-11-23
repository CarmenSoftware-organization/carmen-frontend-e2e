# E2E Sales Consumption + Import POS — bug list

| | |
| --- | --- |
| Date | 2026-11-23 |
| Branch | `test/e2e-sales-consumption` |
| Source of truth | every `.fail(` in `tests/140-import-pos.spec.ts` and `tests/141-sales-consumption.spec.ts`. After Task 4 (140): **0 pin sites**. After Task 5 (141 groups 01-05): **1 pin site** (TC-SC-040003). After Task 6 (141 groups 06-07): **2 pin sites** (TC-SC-040003, TC-SC-060005). A `test.fail` reports passed while the bug exists and turns red ("unexpectedly passed") once fixed: drop the marker then. |

Format as `2026-11-23-e2e-phase-2a-bug-list.md`. Verdicts are the implementer's, none confirmed by a product owner.

## 1. Suspected bugs

None found by spec 140 (8 cases; green in two consecutive combined runs with 141 without a reset, no posted SC left behind).

Spec 141 groups 01-07 (21 cases: 18 pass, 1 skipped by ruling (section 3), 2 pinned): 2 suspected bugs, pinned.

| Observation | Spec / TC-ID | Oracle | Actual |
| --- | --- | --- | --- |
| `POST /pos-sales/sales-consumptions/:id/post` on a day whose verify shows P4 short at the second location is refused 422 `SALES_CONSUMPTION_VERIFY_FAILED`, no Stock Out is made (correct), but the body carries only the message; it does not name the short products per location. Repro: import O1/I1 x1 and O2/I2 x ceil((on-hand P4 at second + 1) / 3) on a day of the open period, map O1 -> first location, O2 -> second, I1 -> E2E-POS-A, I2 -> E2E-POS-B, verify, post: body is `{"message":"The latest on-hand verification found insufficient stock; fix it and verify again","error":{"code":"SALES_CONSUMPTION_VERIFY_FAILED"}}` with no params. The verify answer does list them (groups[].products[].short). | 141 TC-SC-040003 (`test.fail`) | feature spec §4.2 line 150 and §6: short at one location returns the short products per location | refusal without the list. Verdict: suspected bug (implementer's). |
| The detail of a **voided** SC (`GET /pos-sales/sales-consumptions/:id`) returns `stock_outs: []` and empty ingredients, although the SC had posted Stock Outs that were voided with it. The BE selects `deleted_at IS NULL OR doc_status = voided` and maps `voided: true`, and the FE has a "voided" label for them, so the list was meant to carry them; the soft-delete filter appears to hide the voided (soft-deleted) rows. Repro: import O1/I1 x2 on a day of the open period, map, verify, post, void the SC (UI or API), read the old SC: `stock_outs` is `[]`. | 141 TC-SC-060005 (`test.fail`) | feature spec §4.2 line 158: a voided SC page shows what the Stock Outs actually posted; BE `loadStockOuts` comment | empty list. The Stock Outs themselves are voided (`/stock-outs/:id` answers 404, on-hand is back, TC-SC-060001 asserts both). Verdict: suspected bug (implementer's). |

Other observations: parallel `post` (same `doc_version`) gave exactly one 2xx and one set of Stock Outs; a second sequential post gave 409 and no second set; a short location produced no Stock Out and left on-hand unchanged. Void (TC-SC-060001/060004): all Stock Outs void in one go, on-hand returns to the pre-post values and a new pending SC of the day takes the lines (plus late lines). Calendar (TC-SC-070001): `before_start` is BU-wide, so a day only shows No file after the BU's first live import; the case therefore imports a net-0 file on an earlier day to set that start (the calendar has to be read with at least one live import).

## 2. Needs product decision

| Observation | Spec / TC-ID | Oracle | Actual |
| --- | --- | --- | --- |
| `POST /pos-sales/imports/micros3700/check` is accepted (200, `kind: rejected`, a `format_error` import row recorded) on a BU where Micros 3700 is **not** enabled (`enabled_brands` = `simphony`). The Upload PDF button is hidden by the FE, but the endpoint has no brand gate. Not pinned: the case asserts the documented rejected answer. | 140 TC-IPOS-020004 (asserts the documented answer, not a pin) | feature spec §4.2 says only enabled brands show an upload button (UI); silent about the API | 200 + rejected row in history for a disabled brand. Decide whether the API should refuse with 403 / a catalog code. |
| The brief expected a Micros `check` of Simphony lines to be "not 2xx". The BE answers 200 with `kind: rejected` (gateway docblock: a file that cannot be imported is recorded as a rejected import and comes back `kind: rejected`). Treated as correct. | 140 TC-IPOS-020004 | gateway docblock `checkMicros3700` | 200, `kind: rejected`, `import.status` `format_error` |
| SC detail flips to the Ingredients tab after every sales-line edit (location or recipe saved from the Sales lines tab returns the page on `?tab=ingredients`). A user editing several lines has to switch back to Sales lines each time. Not pinned (no dedicated case); the page object's `showSalesLines()` works around it. Repro: open a pending SC > Sales lines > change any line's location or recipe > the page lands on Ingredients. | 141 TC-SC-020001 / TC-SC-020003 (workaround only) | feature spec §4.2 describes the Sales lines / Ingredients tabs but not which tab is shown after an edit | tab switches to Ingredients after each line save. Decide whether the edit should keep the user on Sales lines. |
| Refusal codes differ from the plan's guesses, behaviour matches the feature spec, asserted as the real code: editing lines of a posted SC answers `SALES_CONSUMPTION_NOT_PENDING` (409), not `SALES_CONSUMPTION_LINE_POSTED`; post after a line edit (verification dropped) answers `SALES_CONSUMPTION_NOT_VERIFIED`, not `SALES_CONSUMPTION_VERIFY_STALE`. Post on a verified-short day answers `SALES_CONSUMPTION_VERIFY_FAILED` (asserted as the real code; the missing short list is a pinned bug, section 1). | 141 TC-SC-020004 / 030002 / 040002 | feature spec §4.2 (posted SC cannot be edited; line edit invalidates verification; short location = no Stock Out) | codes as stated. |

## 3. Not covered by 140 / 141

- Micros 3700 PDF upload and SFTP pulls (non-goal; Simphony only).
- Cancel of a posted day through the UI: the Cancel import button is hidden when the import has confirmed lines, so TC-IPOS-030002 checks that the button is absent and drives the refusal through the API.
- Overwrite / `needs_resolution` of Micros outlets (Micros not enabled on TEST BU).
- Cancel of an import with partially confirmed lines (needs a multi-location posted day; 141 owns posting).
- Two-brand day (one day with both a Simphony and a Micros 3700 file): Micros is not enabled on the TEST BU, so late lines are covered with a second Simphony store (TC-SC-060004) instead.
- Micros overwrite of a posted day (`needs_resolution` of an outlet inside a posted SC): needs Micros enabled.
- Void in a closed inventory period (TC-SC-060003, `test.skip`): e2e never closes inventory periods (design 2026-11-23), so `SALES_CONSUMPTION_VOID_PERIOD_CLOSED` is untested.
- Calendar (TC-SC-070001) is skipped early in a month by its data guard (needs 5 past days before yesterday outside the 140/141 day ranges, i.e. it only runs from about the 13th of a 30-day month); on those days the Posted / Pending / No sales / No file statuses go unchecked.
