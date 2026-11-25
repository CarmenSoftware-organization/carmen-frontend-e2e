# E2E — AR Invoice money path on TEST BU

Date: 2026-11-25 · Repo: `carmen-frontend-e2e` · Target: `../carmen-frontend` @ `main`, BE `carmen-turborepo-backend` @ `main`
Follows: `2026-11-23-e2e-phase-2a-accounting-ap-jv-design.md` (AP + JV, which deferred AR until it was wired to the backend)

## Intent / why

AR Invoice is now wired to the backend (FE #725, BE #1111). Phase 2a's reason for deferring AR, that the screens
wrote nothing, no longer holds for AR Invoice. The user wants AR covered next (2026-11-25). The aim is the same as 2a:
**catch money bugs before go-live**, so the spec asserts money outcomes (totals, VAT, JV, tax invoice, outstanding,
credit-note application) through the API, plus the user-visible state.

## Scope

- Route `/accounting/accounts-receivable/invoice` (list, `new`, `:id` detail).
- Document types `invoice`, `debit_note`, `credit_note`. The FE can create **only `invoice`**, so debit and credit notes
  are created through the API and viewed in the UI.
- Lifecycle: create (`DRAFT-%08d`), edit, delete (DRAFT only), submit (real `ARIV/ARDN/ARCN` number, JV, tax invoice
  `TX…` when `is_tax_invoice`), void (draft and posted), credit-note application on an invoice.
- The `ar_invoice` approval workflow (approve, reject = void, send back, creator rule, non-assignee refusal).
- Viewer permissions (Requestor).

## Non-goals

- AR Receipt, advance deposit, contract, folio, AR profile pages, AR dashboard (still mock / localStorage or out of
  this round).
- The mock parts of the invoice page: `ar-invoice-supplement` (deposit apply, tax-entity form). The spec never ticks
  **Tax Invoice in the UI**, because doing so needs that mock section filled. Tax-invoice cases create through the API.
- Fixing app bugs (they are pinned and listed, as in 2a).

## Anti-goals (a failure even if green)

- Expected numbers read back from the FE or the BE echo. Expected values come from the test's own inputs
  (`tests/helpers/money.ts`).
- Leaving the `ar_invoice` workflow **active** after the spec, because that would silently change every later AR run.
- Mocking the backend. Posting anything on a BU outside `TEST_BUS`.

## Decisions taken with the user

1. **Workflow: hybrid (option C).** The BU has no active `ar_invoice` workflow by default, so submit posts directly
   and the money cases stay short. The approval cases run in one `describe.serial` that activates the workflow and
   deactivates it in `afterAll`, which runs even when a case fails.
2. **Data: a seeded read-set (option 1).** `data:reset` gets an AR step with a known dataset. Cases that change state
   create their own documents tagged `E2E-T-806-<case>-<uid>`, so the spec re-runs without a reset.

## What the TEST BU lacks today (verified 2026-11-25, read-only SQL + BE `origin/main`)

| Missing | Why the BE needs it |
|---|---|
| a customer (`tb_customer` = 0) | `customer_id` is required |
| a cost center (`tb_cost_center` = 0) | every line needs an active `cr_cost_center_id` |
| a receivable account (COA has none) | the line Dr account defaults to customer `ar_chart_of_accounts_id`, then `gl_setting.ar_control_account_id`, else `GL_SETTING_ACCOUNT_MISSING` |
| an output-VAT account | VAT account resolves as line `vat_chart_of_accounts_id` → tax profile account → `gl_setting.output_vat_account_id` |
| `accounting.ar.*` permission keys on the roles | submit needs `accounting.ar.view`, void needs `accounting.ar.void` (gateway + FE `arActionsAllowed`) |
| an `ar_invoice` workflow | needed only by the approval group |

Present already: an open GL period covering today, the `Vat 7%` and `None` (0%) tax profiles, revenue accounts 4100 / 4200,
fx gain / loss accounts, BU default currency THB (`data:reset`).

## Design

### A. `data:reset` additions (BU-GR2VYNKQ only, like the AP read-set)

1. **COA** (`fixtures/chart-of-accounts.json`): add `1130 Trade Accounts Receivable` (asset, postable) and
   `2160 Output VAT` (liability, postable).
2. **gl_setting**: set `ar_control_account_id = 1130` and `output_vat_account_id = 2160`.
3. **Cost center** `E2E-CC-1` (all accounts allowed) through `POST api/config/:bu/cost-centers`.
4. **Customer** `E2E-CUST-1` (with `ar_chart_of_accounts_id = 1130`, `tax_no` 13 digits, `branch_no` `00000`, a register
   address) and `E2E-CUST-2` (no AR account, which exercises the `gl_setting` default).
5. **Permissions** (`access.ts`, add-only): Admin and Budget get `accounting.ar.view` and `accounting.ar.void`. Requestor
   gets `accounting.ar.view` only. Budget's approver role stays the AR approver. The builder checks the exact key names
   against the BE permission catalog and the FE `useCan` calls before granting them.
6. **Workflow** (`fixtures/workflows.json`): an `ar_invoice` entry with the `ap_payment` shape (Create Request: Admin +
   Budget → Accounting Approval: Budget → Completed), seeded **inactive**. Add `ar_invoice` to the `workflow_type`
   union in `workflow-template.ts`.
7. **Read-set**, all for `E2E-CUST-1`, revenue 4100, cost center `E2E-CC-1`, description starting `STD ar.<row>`:
   - `E2E-AR-POSTED`: invoice, 1 line 3 x 333.33 with VAT 7%, `is_tax_invoice`, posted (net 999.99, VAT 70.00,
     total 1,069.99, tax invoice `TXIV…`).
   - `E2E-AR-DRAFT`: invoice draft, 1 line 1 x 500.00 VAT 7%.
   - `E2E-AR-CN`: credit note 1 x 100.00 VAT 7%, posted (total 107.00).
   - `E2E-AR-DN`: debit note 1 x 200.00 no VAT, posted.
   - `E2E-AR-VOID`: invoice posted then voided.
   The tags go in `source_doc_ref`, since the BE searches `description` and `doc_no`. The builder picks whichever field
   the list search hits, and the spec looks documents up the same way.
8. **verify-dataset**: rows for the customers, the cost center, the two gl_setting keys and the five documents with
   their statuses.

### B. Spec `806-ar-invoice.spec.ts`, prefix `ARINV`

Register prefix `ARINV` with sections in `docs/test-id-scheme.md` before writing the spec.

| Section | Cases (about 30 in all) |
|---|---|
| 01 list / detail | the read-set shows with totals, status, outstanding; filters by status and doc type; search by doc_no; detail shows lines, VAT and the JV link |
| 02 create (UI) | invoice with 2 lines (one VAT 7%, one none) shows the right net / VAT / total before and after save; number is `DRAFT-\d{8}`; customer required; revenue account required; discount % on a line |
| 03 edit / delete | edit a draft (needs `doc_version`); a stale `doc_version` is refused; delete a DRAFT; an in-review doc cannot be deleted |
| 04 submit & post (no workflow) | submit posts directly: real `ARIV\d{8}` number, JV balanced with Dr 1130 = total, Cr 4100 = net, Cr 2160 = VAT; `outstanding = total`; with `is_tax_invoice` a `TXIV` number; customer without an AR account posts to the gl_setting default; total 0 refused; mixed VAT rates on a tax invoice refused (`AR_TAX_INVOICE_MIXED_VAT_RATE`) |
| 05 debit & credit notes (API) | debit note JV has the invoice signs; credit note JV flips them (Cr 1130 / Dr 4100 / Dr 2160) |
| 06 credit-note application | an invoice referencing `E2E-AR-CN`-like CN: `reference-candidates` lists it with `available_amount`; after posting the invoice, its outstanding = total - applied and the CN's `reference_applied_amount` grows; over-application refused (`AR_REFERENCE_OVER_APPLIED`); a referenced CN cannot be voided (`AR_INVOICE_IS_REFERENCED`) |
| 07 void | void a posted invoice: reversing JV cancels the original exactly, tax invoice `void`, outstanding 0; reason required; void a draft |
| 08 workflow (`describe.serial`, activates `ar_invoice`) | submit → `in_review` with a real number and no JV; Budget approves → posted + JV; Admin (creator) approve refused `WORKFLOW_CREATOR_CANNOT_APPROVE` (403); Requestor approve refused `WORKFLOW_USER_NOT_STAGE_APPROVER` (422); reject without reason refused, with reason → void, no JV; send back to Create Request → draft keeping its real number, then delete refused `AR_INVOICE_NUMBERED_VOID_ONLY`; `afterAll` deactivates the workflow |
| 10 viewer | Requestor sees the list and a posted invoice but no Void / Submit / New; void through the API refused |

Expected accounting rules have **no AR business document** in the repo (AP had `accounts-payable-invoice-design.md`).
Cases that rest on general accounting practice or on the BE code say `assumption:` in `expected`. Those rules are:
- the invoice JV is Dr receivable = total / Cr revenue = net / Cr output VAT = VAT;
- a credit note flips those sides;
- VAT is exclusive and rounded per line `HALF_UP` to 2 places.

### C. Supporting code

- `tests/helpers/ar-api.ts`: `createArDoc`, `getArDoc`, `submitArDoc`, `approveArDoc`, `reviewArDoc`, `rejectArDoc`,
  `voidArDoc`, `seededArDoc`, `referenceCandidates`, `setArWorkflowActive(on)`. Patterned on `ap-api.ts`, through
  `bu-api` (bearer token, `x-rate-limit-bypass`).
- `tests/pages/ar-invoice.page.ts`: list, detail, draft form, line dialog, action buttons. Locators come from the FE
  source (`ar-invoice-*.tsx`), preferring role queries.
- Reuse `gl-api.ts` (`jvOfSource('ar_invoice', id)`, `assertAccountingReady`) and `money.ts`.
- Register the results file in `scripts/sync-test-results.ts` `SYNC_TARGETS`, regenerate user-story docs, refresh
  `COVERAGE.md` / `SPEC-HEALTH.md`.

## Output VAT account (user decided 2026-11-25: option a)

The only VAT 7% tax profile points to account 1170 Input VAT, and the BE resolves the AR VAT account as line override
→ **tax profile account** → `gl_setting.output_vat_account_id`. So an AR invoice with VAT 7% and no line override
credits **1170 Input VAT**, even after the reset sets the gl_setting key to 2160.

**Decision:** expect **2160 Output VAT** (the AR output-VAT setting should win over a profile account that serves
purchases), and pin the cases whose VAT leg is asserted with
`test.fail(true, "suspected bug: AR output VAT posts to the tax profile's account (1170 Input VAT) instead of gl_setting.output_vat_account_id …")`.
Add the bug to a bug list, `docs/superpowers/specs/2026-11-25-e2e-ar-invoice-bug-list.md`.

To keep one pin from hiding every other money check, assert the VAT leg in **one dedicated case per document type**
(invoice, debit note, credit note, void reversal). The other posting cases assert the receivable and revenue legs, the
balance, and that a VAT leg of the right amount exists on some account. The data and helpers send no line VAT
override, so the bug stays visible.

Rejected options:
- (b) a separate output-VAT profile would accept the BE order as designed.
- (c) a line override on every line would hide the behaviour.

## Settled after the builder check

- **Target backend.** This is the local BE at `main` (`config.local.json` → `localhost:4000`), which carries #1111, on the
  dev database. The dev deployment is not assumed.
- **Seed endpoints.**
  - Customers: `POST api/config/:bu/customers` (`code`, `name` required; 409 `CUSTOMER_CODE_DUPLICATE` on a live code).
  - Cost centers: `POST api/config/:bu/cost-centers`.
  - `gl_setting` keys: the same write path the AP step in `scripts/data-reset/docs/accounting.ts` already uses.
  - No SQL writes.
- **Who acts.**
  - Admin (a BU admin, which bypasses the permission guard, as 801 relies on) creates, edits, deletes, submits and
    voids, and is the **creator** in section 08.
  - Budget is the stage approver.
  - Requestor is the viewer.
  - Create, update and delete carry no gateway `@Permission`. Only submit (`accounting.ar.view`) and void
    (`accounting.ar.void`) do. So the `access.ts` change is the two keys above, plus whatever the FE `useCan` checks
    to show **New** to a non-admin (the builder confirms this). Section 10 asserts what Requestor gets with view only.
- **Section 06 creates its own credit notes** (tagged per case). The seeded `E2E-AR-CN` is read-only and is never
  applied, so section 01 and `verify-dataset` stay stable across re-runs.
- **Workflow safety net.** `afterAll` deactivates the workflow. In addition, a `beforeAll` in every non-workflow
  describe calls `setArWorkflowActive(false)` when it finds the workflow active, and logs it. A crashed run therefore
  cannot make the money cases pass or fail for the wrong reason.
- **`assumption:` cases assert strictly.** When the BE disagrees, the case is pinned with
  `test.fail(true, "suspected bug …" | "needs product decision: …")` and listed, as in 2a. Nothing is soft-skipped.
- **`verify-dataset`.** A short AR row makes `data:reset` exit 1, the same as every other row.

## Left to the builder

- Exact permission key names and the role mapping in `access.ts`.
- Whether the read-set tag lives in `description` or `source_doc_ref`, depending on what the list search hits.
- Page-object locators.
- Case wording, within the sections above.
