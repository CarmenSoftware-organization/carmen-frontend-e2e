# Inventory Adjustment e2e — bug list (2026-11-23)

Filled in as the 731 / 732 specs run on TEST BU (GR2VYNKQ). Sections: 1 suspected bugs, 2 needs product decision, 3 not testable.

## 1. Suspected bugs

| TC | Pin | Observed | Source |
| --- | --- | --- | --- |
| TC-IADJ-710003 | `test.fail` FE-5 (known bug, carried over from 730) | A reopened Stock Out draft shows Cost/Unit 0.00 on every row. Total Cost now carries the estimate (-50.00 / -40.00 on TEST BU), so the bug is narrower than in 730, where the whole row showed 0.00. The pin checks the Cost/Unit cell. | Task 3, 731 |

## 2. Needs product decision

| TC | Question | Source |
| --- | --- | --- |
| TC-IADJ-710003 | The draft stores `cost_per_unit` 0 and the view shows the estimate only in Total Cost. Is a Cost/Unit of 0.00 on a Stock Out draft intended (the cost is computed at commit), or should the view show the per-unit estimate too? | Task 3, 731 |

## 3. Not testable

| What | Why | Source |
| --- | --- | --- |

## Resolved

- FE-4 (730 TC-IADJ-710004: editing an existing Stock Out line's qty made Total NaN and Save sent nothing) no longer reproduces on TEST BU. 731 ran it with no `test.fail` and it passed on every run, so the pin was removed.
