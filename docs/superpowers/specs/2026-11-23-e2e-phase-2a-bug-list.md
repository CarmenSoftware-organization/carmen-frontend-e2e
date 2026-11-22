# E2E Phase 2a — bug list

| | |
| --- | --- |
| Date | 2026-11-23 |
| Branch | `feat/e2e-phase-2a-ap-docs` (stacked on PR #95) |
| Dev backend | API `v4.0.13-build.20261112.f529576a9` |
| Source of truth | every `test.fail(` in the Phase 2a specs (`tests/8xx-*.spec.ts`). A `test.fail` reports passed while the bug exists and turns red ("unexpectedly passed") once it is fixed: drop the marker then. |

Same format as `2026-11-20-e2e-catchup-bug-list.md`. Verdicts are the implementer's, checked against FE `main`
(`../carmen-frontend`); none has been confirmed by a product owner. Each row needs a per-item decision.

## 1. Suspected bugs (one row per cause)

### 1b. Frontend

| Cause | Specs / TC-IDs | Actual vs expected | Repro | FE/BE suspect |
| --- | --- | --- | --- | --- |
| View-only roles see an enabled Void on a posted AP invoice | 801 TC-APINV-100001 | Expected: a role without `accounting.ap.void` (Requestor, accounting viewer) does not get a Void button. Actual: the button is shown; pressing it makes the gateway answer 403 (TC-APINV-100002 pins that the API refuses). | Log in as `requestor@`, open `E2E-AP-POSTED`. | FE `routes/accounting/accounts-payable/shared/ap-status.ts` `apActions()` offers `void` on `doc_status === "posted"` alone; `ap-invoice-detail.tsx` has no `useCan` / permission gate (only AR pages use `useCan`). Searched `git log` of `../carmen-frontend` for an intentional ungated design (`--grep permission` / `void` under `routes/accounting`): none found. |

## 2. Needs product decision (not pinned, no assertion)

| Cause | Specs / TC-IDs | Actual vs expected | Repro | FE/BE suspect |
| --- | --- | --- | --- | --- |
| The reversing JV of a voided AP invoice carries the same `jv_no` as another JV | 801 TC-APINV-400010 (read via `jvOfSource`, not asserted) | Voiding an AP invoice produced a reversing JV with `jv_no 20261100001`, the number of the seeded `E2E-AP-POSTED` JV. jv:107 says the number is unique per BU/prefix/sequence, so a different prefix may make this legal. Decide whether `jv_no` must be unique across prefixes. | Void any posted AP invoice, compare `jv_no` of the reversal with the earliest AP JV. | BE reversal prefix running number (`reversal_prefix_id`) vs AP prefix. |
| The new-invoice form cannot reach "zero lines" and shows no text for a missing vendor | 801 TC-APINV-200001, 200003, 200004 | The remove-line button is disabled on the last line, so "zero lines" is only reachable by API (400, refused). A missing vendor shows a red icon on the lookup and the toast "Please complete the required fields", but no `Select a vendor` text (`LookupVendor` `error` prop is not rendered as text). | /invoice/new, Save Draft with no vendor. | FE `ap-invoice-header.tsx` `LookupVendor error=`. |
| A view-only Requestor can create, submit (post) and delete AP invoices through the API | 801 TC-APINV-100003 (documents the 409 state refusal; not pinned) | Probe: `POST /ap-invoice/:id/submit` as Requestor on a draft -> 200, document posted with a JV. No permission refusal exists on create / submit / approve. The gateway controller documents this as intentional ("Draft-level CRUD and the workflow actions ... are gated only by KeycloakGuard, same as gl-jv"; only void carries `@Permission`), so it is NOT pinned as a bug; the product decision is whether a viewer may post. | API: Requestor submits an Admin-created draft. | BE `apps/backend-gateway/src/application/ap-invoice/ap-invoice.controller.ts` docblock; `PermissionGuard` fail-opens without `@Permission`. |
