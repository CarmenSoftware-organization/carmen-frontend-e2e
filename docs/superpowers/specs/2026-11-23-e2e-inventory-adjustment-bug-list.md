# Inventory Adjustment e2e — bug list (2026-11-23)

Filled in as the 731 / 732 specs run on TEST BU (GR2VYNKQ). Sections: 1 suspected bugs, 2 needs product decision, 3 not testable.

## 1. Suspected bugs

| TC | Pin | Observed | Source |
| --- | --- | --- | --- |
| TC-IADJ-710003 | `test.fail` FE-5 (known bug, carried over from 730) | A reopened Stock Out draft shows Cost/Unit 0.00 on every row. Total Cost now carries the estimate (-50.00 / -40.00 on TEST BU), so the bug is narrower than in 730, where the whole row showed 0.00. The pin checks the Cost/Unit cell. | Task 3, 731 |
| TC-IADJ-800007 | `test.fail` negative Stock In qty accepted | POST then PATCH commit of a Stock In line with qty -1 (cost 5) answers 2xx and the document is `completed`. Its stock-movements show one posted line `qty_in 0, qty_out 1` (an unchecked stock out), yet on-hand read through inventory-info did not move. DTO has no `@Min` / `@IsPositive` (user ruling 23 Nov). | Task 4, 732 |
| TC-IADJ-800008 | `test.fail` negative Stock In cost accepted | Qty 2 at cost -5 commits `completed` with a posted line `qty_in 2, cost_per_unit -5`, yet on-hand and value did not move (zero stock effect). Per R11 the spec leaves that document alone: it is described `E2E-IA 732 accepted-bad ...` and `cleanupIaRun` skips completed documents with that tag. | Task 4, 732 |
| TC-IADJ-800008 (void) | suspected bug: void of an accepted negative-cost Stock In is not symmetric (observed in earlier runs, before R11) | The commit added no on-hand, but voiding the document answered 2xx and took its qty out of on-hand (6 -> 4 for qty 2). Each void drifts the product down by qty. Not re-run any more: the spec no longer voids a zero-effect accepted document. The ~6-unit surplus on E2E-IA-A (from the earlier repair) stays until the next data:reset. | Task 4, 732 (evidence from earlier runs) |
| TC-IADJ-800009 | `test.fail` qty 0 Stock In line accepted | Qty 0 at cost 5 commits `completed` with one posted line `qty_in 0, qty_out 0`. A document that posts nothing is accepted instead of refused (user ruling 23 Nov). | Task 4, 732 |
| TC-IADJ-820001 | `test.fail` a voided Stock In disappears | Void answers 2xx, then `GET /stock-ins/:id` answers 404 `STOCK_IN_NOT_FOUND`, the document is absent from `listIa("stock-in", {status: "voided"})` and from the list page's Voided filter (the Completed filter showed it just before, which proves the URL and search work). Void soft-deletes the document (stock-in.service.ts:1889-1900). User ruling 23 Nov: a voided document must stay visible. Repro: create + commit a Stock In, void it, `GET /stock-ins/:id`. | Task 5, 732 |
| TC-IADJ-820002 | `test.fail` a voided Stock Out disappears | Same as 820001 for Stock Out: `GET /stock-outs/:id` answers 404 `STOCK_OUT_NOT_FOUND` after a successful void; absent from the voided list and the Voided filter. A second void of the same document therefore answers 404 rather than a "already voided" refusal (TC-IADJ-810007 only requires a 4xx). | Task 5, 732 |

## 2. Needs product decision

| TC | Question | Source |
| --- | --- | --- |
| TC-IADJ-710003 | The draft stores `cost_per_unit` 0 and the view shows the estimate only in Total Cost. Is a Cost/Unit of 0.00 on a Stock Out draft intended (the cost is computed at commit), or should the view show the per-unit estimate too? | Task 3, 731 |
| TC-IADJ-810001 (observed, no pin) | Moving-average unit cost is rounded to 2 decimals before it is multiplied by the issued qty. Is that intended? | On TEST BU a pool of 26 units worth 348.00 (avg 13.3846) issued 15 units at 13.38 x 15 = 200.70, while 15 x 348 / 26 = 200.77. The form's estimated total and the posted movement agree with each other (200.70), so the form is consistent; the 0.07 is the unit-cost rounding. Each issue drifts value by up to qty x 0.005, and issuing a whole pool leaves value behind (26 x 13.38 = 347.88, 0.12 left at 0 qty). The oracle (`expectedIssueCost`) rounds once at the end, so 810001 fails on such a pool and passes on a pool whose average is exact (the specs now keep E2E-IA-B at an exact average: 800006 undoes its own documents, seed layers 10 @ 10 and 10 @ 20 average 15.00). No dedicated pin because the pool state that triggers it is not deterministic. | Task 5, 732 |

## 3. Not testable

| What | Why | Source |
| --- | --- | --- |
| TC-IADJ-800010 (later period held, AVG) | TEST BU has a single inventory period (2611); `GET /inventory-periods` and `/period-ends` list no pre-generated later period, so the case fails loudly with that reason on every run. It becomes runnable once a later open period exists (the spec never creates or closes periods). | Task 4, 732 |
| Void in a closed period | Needs a closed period; the specs never close or create periods (no E2E_ALLOW_IRREVERSIBLE) and TEST BU has one open period. | Task 5, 732 |
| Costing on the other method (FIFO) | Only TEST BU's own method (average) is exercised. `costLayers` throws for FIFO: `cost_layers` of inventory-info is a ledger of every lot posted (in rows keep their full balance after issues and voids, out rows carry negative balances), so per-lot remaining qty cannot be read from it. `expectedIssueCost` supports FIFO and is unit-tested. | Task 5, 732 |
| List-page UI cases still in the gap report | Filtering, sorting, search and pagination of the Inventory Adjustment list, and the Voided filter other than the 820001/820002 lookup, have no UI cases (see COVERAGE.md / SPEC-HEALTH.md gap report). | Task 5, 731/732 |
| TC-IADJ-810004 date | Passes on TEST BU through the "before the earliest open period" branch because no other open period exists. | Task 5, 732 |

## Resolved

- FE-4 (730 TC-IADJ-710004: editing an existing Stock Out line's qty made Total NaN and Save sent nothing) no longer reproduces on TEST BU. 731 ran it with no `test.fail` and it passed on every run, so the pin was removed.
