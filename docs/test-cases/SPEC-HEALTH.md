# Spec Health — what the suite actually tests

**Generated file — do not edit.** Run `bun audit:spec-health` to refresh.

Counting TC-IDs answers how many cases a spec *declares*. This counts how many
of them run, and how many of those assert anything. A case that is skipped, or
that runs without an `expect(...)`, reports green and checks nothing.

| | Count |
| --- | --- |
| Cases declared | 1418 |
| **Running** | **1174** |
| Skipped | 201 |
| Fixme | 43 |
| **Dormant** (skipped + fixme) | **17%** |
| Running cases asserting only through a page-object helper | 38 |
| **Running cases asserting nothing at all** | **285** |
| Running cases whose assertions are all trivial | 25 |
| Running cases behind an in-body skip guard | 248 |
| Assertions in running cases | 1534 |

**Trivial** means the assertion cannot fail — `expect(true).toBe(true)` and friends.
**Helper** counts calls like `pr.expectSavedToast()`: the page object asserts, so the case is fine —
it just does not say so in its own body. Only the last row is a case that checks nothing.

> **What this cannot see:** an assertion helper is recognised by its name (`expectSomething`).
> A page-object method that asserts under another name — `verifyX`, `assertY` — still reads as
> silent here. Open the case before acting on a number; the count is a place to look, not a verdict.

**Guard** counts running cases holding an in-body `test.skip(condition, ...)`. Dormant does not
include them: the case is declared as running and the reporter shows it, but whether it executes
is decided at runtime by a locator count or a seeded row. A guard that is always true is a case
that never runs and never says so — `304-pr-purchaser-journey.spec.ts` reads as 0% dormant while
four of its cases skip every run, because the page object looks for fields in a collapsed row that
only exist once the row is expanded. A high guard count is a place to look, not a verdict.

**Catch** counts `.catch(...)` calls in the file; they usually wrap an action, but one
wrapped around an assertion turns a failure into a pass, so a high count is worth a look.

## Per spec

Sorted by dormant share, then by cases that assert nothing.

| Spec | Run | Skip | Fixme | Dormant | Asserts nothing | Helper only | Trivial only | Guarded | Assertions | Catch |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `900-period-end.spec.ts` | 4 | 30 | 1 | 89% | 0 | 0 | 0 | **1** | 4 | 1 |
| `083-shelf.spec.ts` | 2 | 0 | 6 | 75% | 0 | 0 | 0 | 0 | 4 | 1 |
| `601-cn.spec.ts` | 45 | 79 | 0 | 64% | **33** | 0 | **2** | **3** | 16 | 22 |
| `201-my-approvals.spec.ts` | 8 | 12 | 0 | 60% | **3** | 0 | **1** | **1** | 6 | 3 |
| `043-certification.spec.ts` | 6 | 0 | 9 | 60% | 0 | 0 | 0 | 0 | 7 | 1 |
| `401-po.spec.ts` | 25 | 32 | 3 | 58% | **4** | 2 | **1** | **6** | 30 | 25 |
| `301-pr.spec.ts` | 83 | 47 | 2 | 37% | **36** | 7 | **8** | **51** | 48 | 87 |
| `311-pr-returned-flow.spec.ts` | 10 | 0 | 2 | 17% | 0 | 0 | 0 | **9** | 14 | 6 |
| `159-pl.spec.ts` | 24 | 0 | 4 | 14% | **1** | 1 | **2** | **1** | 32 | 21 |
| `101-product-category.spec.ts` | 21 | 0 | 2 | 9% | 0 | 0 | 0 | 0 | 40 | 1 |
| `711-stock-replenishment.spec.ts` | 33 | 0 | 3 | 8% | 0 | 0 | 0 | 0 | 47 | 16 |
| `1001-campaign.spec.ts` | 43 | 0 | 3 | 7% | **33** | 0 | **1** | **2** | 16 | 26 |
| `040-currency.spec.ts` | 14 | 0 | 1 | 7% | 0 | 0 | 0 | 0 | 33 | 1 |
| `150-vendor.spec.ts` | 29 | 0 | 2 | 6% | 0 | 1 | 0 | 0 | 51 | 1 |
| `403-po-approver-journey.spec.ts` | 18 | 0 | 1 | 5% | 0 | 0 | 0 | **15** | 27 | 10 |
| `720-stock-issue.spec.ts` | 24 | 0 | 1 | 4% | **18** | 0 | **2** | **1** | 6 | 9 |
| `001-login.spec.ts` | 26 | 1 | 0 | 4% | 0 | 0 | 0 | 0 | 44 | 2 |
| `160-pl-template.spec.ts` | 32 | 0 | 1 | 3% | **3** | 7 | 0 | **6** | 42 | 21 |
| `701-sr.spec.ts` | 46 | 0 | 1 | 2% | **44** | 0 | 0 | **3** | 2 | 14 |
| `079-delivery-point.spec.ts` | 49 | 0 | 1 | 2% | 0 | 0 | 0 | **25** | 67 | 34 |
| `501-grn.spec.ts` | 76 | 0 | 0 | 0% | **57** | 0 | **4** | **6** | 26 | 49 |
| `310-pr-template.spec.ts` | 61 | 0 | 0 | 0% | **51** | 0 | **4** | 0 | 13 | 11 |
| `111-cuisine.spec.ts` | 17 | 0 | 0 | 0% | **1** | 0 | 0 | 0 | 30 | 7 |
| `302-pr-creator-journey.spec.ts` | 42 | 0 | 0 | 0% | **1** | 0 | 0 | **21** | 52 | 10 |
| `002-spa-smoke.spec.ts` | 5 | 0 | 0 | 0% | 0 | 0 | 0 | 0 | 14 | 0 |
| `010-department.spec.ts` | 21 | 0 | 0 | 0% | 0 | 0 | 0 | **2** | 57 | 0 |
| `020-unit.spec.ts` | 13 | 0 | 0 | 0% | 0 | 0 | 0 | 0 | 32 | 0 |
| `029-business-type.spec.ts` | 15 | 0 | 0 | 0% | 0 | 0 | 0 | 0 | 35 | 0 |
| `030-extra-cost.spec.ts` | 15 | 0 | 0 | 0% | 0 | 0 | 0 | 0 | 34 | 0 |
| `031-adjustment-type.spec.ts` | 15 | 0 | 0 | 0% | 0 | 0 | 0 | 0 | 28 | 0 |
| `032-credit-term.spec.ts` | 15 | 0 | 0 | 0% | 0 | 0 | 0 | 0 | 34 | 0 |
| `041-exchange-rate.spec.ts` | 3 | 0 | 0 | 0% | 0 | 0 | 0 | 0 | 4 | 0 |
| `042-tax-profile.spec.ts` | 15 | 0 | 0 | 0% | 0 | 0 | 0 | 0 | 34 | 0 |
| `044-eco.spec.ts` | 15 | 0 | 0 | 0% | 0 | 0 | 0 | 0 | 28 | 1 |
| `080-location.spec.ts` | 17 | 0 | 0 | 0% | 0 | 0 | 0 | 0 | 37 | 0 |
| `081-chart-of-account-mapping.spec.ts` | 13 | 0 | 0 | 0% | 0 | 0 | 0 | **9** | 38 | 0 |
| `082-chart-of-accounts.spec.ts` | 16 | 0 | 0 | 0% | 0 | 0 | 0 | 0 | 37 | 1 |
| `110-op-category.spec.ts` | 13 | 0 | 0 | 0% | 0 | 0 | 0 | 0 | 28 | 4 |
| `121-recipe-equipment-category.spec.ts` | 12 | 0 | 0 | 0% | 0 | 0 | 0 | 0 | 22 | 0 |
| `131-equipment-category.spec.ts` | 12 | 0 | 0 | 0% | 0 | 0 | 0 | 0 | 22 | 0 |
| `303-pr-approver-journey.spec.ts` | 28 | 0 | 0 | 0% | 0 | 0 | 0 | **22** | 37 | 10 |
| `304-pr-purchaser-journey.spec.ts` | 26 | 0 | 0 | 0% | 0 | 0 | 0 | **22** | 36 | 9 |
| `312-pr-doc-flow.spec.ts` | 5 | 0 | 0 | 0% | 0 | 0 | 0 | 0 | 16 | 1 |
| `402-po-purchaser-journey.spec.ts` | 32 | 0 | 0 | 0% | 0 | 0 | 0 | **26** | 42 | 17 |
| `404-po-doc-flow.spec.ts` | 5 | 0 | 0 | 0% | 0 | 0 | 0 | 0 | 17 | 1 |
| `502-grn-doc-flow.spec.ts` | 5 | 0 | 0 | 0% | 0 | 0 | 0 | 0 | 16 | 1 |
| `602-cn-reason.spec.ts` | 14 | 0 | 0 | 0% | 0 | 0 | 0 | 0 | 31 | 0 |
| `603-cn-doc-flow.spec.ts` | 7 | 0 | 0 | 0% | 0 | 0 | 0 | 0 | 20 | 1 |
| `702-sr-doc-flow.spec.ts` | 5 | 0 | 0 | 0% | 0 | 0 | 0 | 0 | 18 | 1 |
| `710-wastage-reporting.spec.ts` | 20 | 0 | 0 | 0% | 0 | 0 | 0 | 0 | 35 | 6 |
| `721-sr-issue-doc-flow.spec.ts` | 12 | 0 | 0 | 0% | 0 | 9 | 0 | 0 | 10 | 1 |
| `730-inventory-adjustment-doc-flow.spec.ts` | 12 | 0 | 0 | 0% | 0 | 11 | 0 | 0 | 1 | 1 |
| `910-period-close-prestep.spec.ts` | 4 | 0 | 0 | 0% | 0 | 0 | 0 | **1** | 9 | 1 |
| `911-period-close-blockers.spec.ts` | 1 | 0 | 0 | 0% | 0 | 0 | 0 | **1** | 2 | 0 |
| `912-period-close-start-gate.spec.ts` | 7 | 0 | 0 | 0% | 0 | 0 | 0 | 0 | 9 | 0 |
| `914-period-close-out-of-period-docs.spec.ts` | 7 | 0 | 0 | 0% | 0 | 0 | 0 | 0 | 14 | 0 |
| `916-period-close-fix-guards.spec.ts` | 4 | 0 | 0 | 0% | 0 | 0 | 0 | 0 | 10 | 0 |
| `917-period-close-new-rules.spec.ts` | 4 | 0 | 0 | 0% | 0 | 0 | 0 | **3** | 11 | 0 |
| `918-period-close-start.spec.ts` | 1 | 0 | 0 | 0% | 0 | 0 | 0 | **1** | 6 | 0 |
| `919-period-close-active-period.spec.ts` | 11 | 0 | 0 | 0% | 0 | 0 | 0 | **7** | 14 | 0 |
| `920-period-close-close-gate.spec.ts` | 1 | 0 | 0 | 0% | 0 | 0 | 0 | 0 | 7 | 0 |
| `921-period-close-count.spec.ts` | 1 | 0 | 0 | 0% | 0 | 0 | 0 | **1** | 3 | 0 |
| `922-period-close-verify.spec.ts` | 4 | 0 | 0 | 0% | 0 | 0 | 0 | 0 | 9 | 0 |
| `923-period-close-ledger-views.spec.ts` | 3 | 0 | 0 | 0% | 0 | 0 | 0 | 0 | 12 | 0 |
| `924-period-close-close.spec.ts` | 2 | 0 | 0 | 0% | 0 | 0 | 0 | **2** | 8 | 0 |
