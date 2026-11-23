# Inventory Adjustment e2e — bug list (2026-11-23)

Filled in as the 731 / 732 specs run on TEST BU (GR2VYNKQ). Sections: 1 suspected bugs, 2 needs product decision, 3 not testable.

## 1. Suspected bugs

| TC | Pin | Observed | Source |
| --- | --- | --- | --- |
| TC-IADJ-710003 | `test.fail` FE-5 (known bug, carried over from 730) | A reopened Stock Out draft shows Cost/Unit 0.00 on every row. Total Cost now carries the estimate (-50.00 / -40.00 on TEST BU), so the bug is narrower than in 730, where the whole row showed 0.00. The pin checks the Cost/Unit cell. | Task 3, 731 |
| TC-IADJ-800007 | `test.fail` negative Stock In qty accepted | POST then PATCH commit of a Stock In line with qty -1 (cost 5) answers 2xx and the document is `completed`. Its stock-movements show one posted line `qty_in 0, qty_out 1` (an unchecked stock out), yet on-hand read through inventory-info did not move. DTO has no `@Min` / `@IsPositive` (user ruling 23 Nov). | Task 4, 732 |
| TC-IADJ-800008 | `test.fail` negative Stock In cost accepted | Qty 2 at cost -5 commits `completed` with a posted line `qty_in 2, cost_per_unit -5`, but on-hand did not rise. Voiding that document then answers 2xx and takes 2 out of on-hand (observed 6 -> 4), so each void of it drifts E2E-IA-A by -2. The spec voids it at once and posts a compensating Stock In described `E2E-IA drift-fix 732 ...` (not voided by cleanup) so the drift does not accumulate. A first run before the helper existed left E2E-IA-A at 4 below the ledger; fixed on dev with a backdated Stock In of 10 described `E2E-IA drift-fix`, so E2E-IA-A now holds a few extra units. | Task 4, 732 |
| TC-IADJ-800009 | `test.fail` qty 0 Stock In line accepted | Qty 0 at cost 5 commits `completed` with one posted line `qty_in 0, qty_out 0`. A document that posts nothing is accepted instead of refused (user ruling 23 Nov). | Task 4, 732 |

## 2. Needs product decision

| TC | Question | Source |
| --- | --- | --- |
| TC-IADJ-710003 | The draft stores `cost_per_unit` 0 and the view shows the estimate only in Total Cost. Is a Cost/Unit of 0.00 on a Stock Out draft intended (the cost is computed at commit), or should the view show the per-unit estimate too? | Task 3, 731 |

## 3. Not testable

| What | Why | Source |
| --- | --- | --- |
| TC-IADJ-800010 (later period held, AVG) | TEST BU has a single inventory period (2611); `GET /inventory-periods` and `/period-ends` list no pre-generated later period, so the case fails loudly with that reason on every run. It becomes runnable once a later open period exists (the spec never creates or closes periods). | Task 4, 732 |

## Resolved

- FE-4 (730 TC-IADJ-710004: editing an existing Stock Out line's qty made Total NaN and Save sent nothing) no longer reproduces on TEST BU. 731 ran it with no `test.fail` and it passed on every run, so the pin was removed.
