# E2E AR invoice (806) - bug list

| | |
| --- | --- |
| Date | 2026-11-26 |
| Branch | `test/e2e-ar-invoice` |
| Target | local FE `main` (`../carmen-frontend`, app v2.9.1) + local BE `main` (`../carmen-turborepo-backend`, API `v4.0.13-build.20261112.f529576a9`) on the dev database, TEST BU `BU-GR2VYNKQ` |
| Source of truth | every `.fail(` in `tests/806-ar-invoice.spec.ts`: **8 pin sites** = 4 causes. A `test.fail` reports **passed** while the bug exists and turns **red ("unexpectedly passed")** once it is fixed: drop the marker then. Section 08 (workflow) has no pins. |

Verdicts are the implementer's. None is confirmed by a product owner: **every row needs a per-item decision (fix / accept / drop the case)**.
"Oracle rule" is **assumption** where the repo holds no AR business document (the design says so); the pinned cases carry
`assumption:` in `expected`. Repro: `E2E_NO_WEBSERVER=1 E2E_BASE_URL=http://localhost:3000 bunx playwright test --project=setup --project=chromium tests/806-ar-invoice.spec.ts -g <TC-ID>`.

> **Watch out:** `test.fail(true)` flips the whole test. A regression in the receivable/revenue legs asserted before the VAT pins (040003, 050002, 050004, 070003) would also read as an expected failure until the VAT bug is fixed. The same legs are asserted unpinned in 040002, 050001, 050003 and 070002.

## 1. Suspected bugs

| Cause | TC-IDs (pinned) | Oracle rule | Actual vs expected | FE/BE suspect |
| --- | --- | --- | --- | --- |
| **AR output VAT posts to the tax profile's account (1170 Input VAT) instead of `gl_setting.output_vat_account_id` (2160 Output VAT)** | 040003 (invoice), 050002 (debit note), 050004 (credit note), 070003 (void reversal) | assumption; **user decided 2026-11-25 (option a)**: the AR output-VAT setting wins over a profile account that serves purchases | Expected Cr 2160 = 14.00 on an invoice (Dr 2160 on a credit note, mirrored on the void reversal). Actual (probe, no line VAT override): invoice **ARIV26110034** JV = `1130 Dr 214.00 / 4100 Cr 200.00 / 1170 Cr 14.00`, its void reversal = `1130 Cr 214 / 4100 Dr 200 / 1170 Dr 14`; debit note **ARDN26110006** = `1130 Dr 214 / 4100 Cr 200 / 1170 Cr 14`; credit note **ARCN26110015** = `1130 Cr 107 / 4100 Dr 100 / 1170 Dr 7`. The only VAT 7% profile points at 1170 Input VAT, and the BE order is line override -> tax profile account -> gl_setting. Every other posting case (040002, 050001, 050003, 070002) asserts only that a VAT leg of the right amount exists, so receivable, revenue and balance checks stay green. | BE `ar-invoice` VAT account resolution (tax profile account before `gl_setting.output_vat_account_id`); or data: a separate output-VAT tax profile (rejected option b) |
| **The Requestor (accounting.ar.view only) sees an enabled New Invoice button** | 100003 | assumption | Expected: hidden or disabled. Actual: enabled (`addDisabled={!canWrite}`, `canWrite` is not tied to an `accounting.ar` key). Create / update / delete carry no gateway `@Permission` (same shape as the AP finding in the 2a bug list). | FE `ar-invoice-list.route.tsx` `useCan().canWrite` |

## 2. Needs product decision

| Question | TC-ID (pinned) | Actual vs expected |
| --- | --- | --- |
| Is a tax invoice with a 7% line and a 0% line "mixed VAT rate"? | 040007 | Brief expects 400 `AR_TAX_INVOICE_MIXED_VAT_RATE`. Actual: submit answered 200, the invoice posted (probe **ARIV26110035**). The BE rule (`mixedVatRate`, `ar-invoice.service.ts`: spec §10.2) counts distinct rates among lines whose VAT amount is non-zero only, so 7% + 0% is allowed. Two distinct non-zero rates cannot be built on the TEST BU: the only VAT-type tax profile is `Vat 7%` (`WHT 3%` is refused with "VAT profile must be a VAT type"). The case is pinned until the product says whether a 0% line must match, or a second VAT profile is seeded to test the rule as coded. |
| With no `ar_invoice` workflow, should a holder of `accounting.ar.view` alone be able to post? | 100005 (FE Submit button on a Draft), 100006 (API) | `data:reset` grants the Requestor `accounting.ar.view` on purpose, and BE gateway and FE both gate Submit on that key (a requester submitting into a workflow is legitimate). But with no workflow, Submit posts directly: the Requestor sees Submit on E2E-AR-DRAFT, and `POST /ar-invoice/:id/submit` as Requestor on a draft answered 200 and the document became posted (probe). Void is correctly refused (100002, 100004 pass). The cases expect no button / 403 and are pinned until the product decides whether direct posting needs a stronger key (`accounting.ar.post`?) or is accepted when no workflow exists. FE `ar-doc-actions.ts`, BE gateway `ar-invoice.controller.ts` submit `@Permission`. |

## 3. Findings without a TC

| Finding | Evidence |
| --- | --- |
| The AR page path is `/accounting/accounts-receivable/invoice`, not `.../ar-invoice` | The page object's first base path 404'd; fixed in `tests/pages/ar-invoice.page.ts`. |
| AR dashboard, receipt, deposit etc. are out of scope | Per the design's non-goals. |

## 4. Confirmed by probe (no action)

| Item | TC-IDs | Observation |
| --- | --- | --- |
| Direct post, numbering, JV signs | 040001, 040002, 050001, 050003 | No workflow: submit posts, `ARIV/ARDN/ARCN` + 8 digits; invoice / debit note Dr 1130 = total, Cr 4100 = net; credit note flips them. |
| Tax invoice | 040004, 070004 | `TXIV` + 8 digits, `pending` at post, `void` after the void. |
| E2E-CUST-2 | 040005 | Dr 1130 through the gl_setting default. |
| Credit-note application | 060001..060004 | Candidates list the CN with available 107.00; applying 50.00 gives outstanding total - 50.00 and CN referenceApplied 50.00; over-application is refused at create with `AR_REFERENCE_OVER_APPLIED` (400); a referenced CN cannot be voided (409 `AR_INVOICE_IS_REFERENCED`). |
| Reject reason | 080005 | An omitted or empty `reason` is refused by the request schema (400 validation); a whitespace-only reason reaches the service and gets 422 `AR_INVOICE_REJECT_REASON_REQUIRED`. The case sends the blank reason. |
| Creator approve | 080002, 080010 | The stage-actor check runs before the creator rule (`accounting-doc-workflow.ts:117-130`): Budget (creator and stage approver) gets 403 `WORKFLOW_CREATOR_CANNOT_APPROVE`; Admin (Create Request stage only) gets 422 `WORKFLOW_USER_NOT_STAGE_APPROVER`. Not a bug. |
| Void | 070001..070006 | UI confirm disabled until a reason; reversing JV negates every line; void without a reason 400; void of a draft works and posts nothing. |

## 5. Side effects on TEST BU (`GR2VYNKQ`)

Every state-changing case creates tagged documents (`E2E-T-806-<key>-<uid>`) and posts / voids them; posted documents cannot be deleted, so the AR list grows each run. The read set is never mutated. Section 100006 posts one document as the Requestor (the product-decision case).
