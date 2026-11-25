# AR Invoice e2e Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cover AR Invoice (invoice / debit note / credit note) on TEST BU with money assertions. That needs an AR read-set in
`data:reset`, plus a new spec `806-ar-invoice.spec.ts` (prefix `ARINV`).

**Architecture:** `data:reset` gains the AR prerequisites, which are COA 1130 / 2160, the two gl_setting AR keys, a cost
center, two customers, the AR permission keys and an inactive `ar_invoice` workflow. It also gains five read-set documents.
The spec drives the UI for the invoice form and the detail page. It checks the money through the API with
`tests/helpers/ar-api.ts`, and reuses `gl-api.ts` / `money.ts`. The workflow group activates the workflow for its own run
only.

**Tech Stack:** Playwright, TypeScript, Bun (scripts), the backend REST API through `bu-api` / the data-reset `ApiClient`.

**Spec:** `docs/superpowers/specs/2026-11-25-e2e-ar-invoice-design.md`. Read it before any task.

## Global Constraints

- TEST BU `BU-GR2VYNKQ` only (bu_code in paths `GR2VYNKQ`). Nothing posts on any BU outside `TEST_BUS`.
- **No unit / failing-test steps** (user preference): implement, type-check, commit. The e2e spec is the deliverable,
  and its verification is running it.
- Every `test(...)` carries the 5 annotations (`preconditions`, `steps`, `expected`, `priority`, `testType`). Titles
  are `TC-ARINV-XXYYYY <Thai description>`.
- Expected money comes from the test's inputs (`money.ts`), never from the FE or the BE echo.
- Workflow cases that depend on each other go in `describe.serial`.
- Login only through `loginWithRetry` or the storageState of `setup`. Leave at least 60 s between two `data:reset` runs.
- The workflow must never be left active. `afterAll` deactivates it, and every non-workflow describe's `beforeAll`
  deactivates it if it finds it active.
- The output-VAT behaviour is pinned exactly as the design says (`suspected bug: AR output VAT posts to the tax
  profile's account …`). The VAT leg is asserted in one dedicated case per document type only.
- Subagent commits use explicit `git add <paths>`, never `-A` / `.`.
- Run the suite with `E2E_NO_WEBSERVER=1 E2E_BASE_URL=http://localhost:3000 bunx playwright test --project=setup --project=chromium <spec>`.

## Review Focus

- **A re-run without a reset.** State-changing cases create tagged docs (`E2E-T-806-<case>-<uid>`). The read-set and
  list assertions must still hold after one or more earlier runs, so list cases search or filter, never "page 1 shows X".
  Task 7 covers this by running the spec twice.
- **The workflow left active by a killed run.** The non-workflow `beforeAll` guard is in Task 6, and Task 7 checks it by
  activating the workflow by hand before a run.
- **The FE's tax-invoice mock section.** No UI case ticks *Tax Invoice*. Tax-invoice cases create through the API
  (Task 6).
- **Customer code re-use after a soft delete.** `data:reset` must find-or-create customers and the cost center by code,
  and must not fail on 409 (Task 2).
- **Running data:reset on the other two TEST BUs.** The AR steps run only on `BU-GR2VYNKQ`, and the other BUs must not
  fail (Task 2).

---

### Task 1: AR accounts, gl_setting keys, permission keys

**Files:**
- Modify: `scripts/data-reset/fixtures/chart-of-accounts.json` (add `1130 Trade Accounts Receivable`, asset, postable,
  and `2160 Output VAT`, liability, postable, shaped like the existing 1170 / 2100 entries)
- Modify: `scripts/data-reset/accounting.ts` (`ACCOUNT_CODES`, the gl_setting PUT in `seedAccountingBase`): add
  `ar_control_account_id` → `1130` and `output_vat_account_id` → `2160`, each skipped when it is already set, like the
  other keys
- Modify: `scripts/data-reset/access.ts:141-152`: `ACCOUNTING_VIEW_KEYS` += `accounting.ar.view`;
  `ACCOUNTING_APPROVER_KEYS` += `accounting.ar.void`. Before adding them, confirm the key strings exist in the BU's
  "Accounting" role catalog (that role lists every permission) and in the FE `useCan` calls
  (`routes/accounting/accounts-receivable/ar-doc-actions.ts`). If a key is named differently, use the real name.
- Modify: `scripts/data-reset/index.ts` dry-run log lines (lines 116 and 121) to mention the AR keys

- [ ] **Step 1: Implement** the three changes above.
- [ ] **Step 2: Type-check.** Run `bunx tsc --noEmit -p .`. Expected: no new errors (17 errors in `scripts/` are already
  there).
- [ ] **Step 3: Dry run.** Run `bun run data:reset --dry-run`. Expected: the log names 1130 / 2160 and the AR keys, and the
  run exits 0.
- [ ] **Step 4: Commit.** `git add` the four files, then commit
  `feat(data-reset): AR control and output-VAT accounts, AR permission keys`.

### Task 2: AR master data, the customers and cost center

**Files:**
- Create: `scripts/data-reset/ar.ts` exporting `seedArBase(sessions: Sessions, cfg: ResetConfig): Promise<StepResult & { setup?: ArSetup }>`
  and `interface ArSetup { customer1: string; customer2: string; costCenter: string; revenue: string; vatProfile: string; noVatProfile: string }`
  (ids). It does find-or-create by code:
  - cost center `E2E-CC-1` (`POST api/config/:bu/cost-centers`, `{code, name, is_active: true}`);
  - customer `E2E-CUST-1` (`ar_chart_of_accounts_id` = 1130, `tax_no` `0105500000001`, `branch_no` `00000`, one
    register address);
  - customer `E2E-CUST-2` (no AR account).
  - Customers go through `POST api/config/:bu/customers`, and a 409 is treated as "exists, re-list" (as seed-master does).
  - Revenue = account `4100`. Profiles are `Vat 7%` and `None` (0%), resolved by name.
- Modify: `scripts/data-reset/index.ts`: call `seedArBase` after `seedAccountingBase`, only when the BU is
  `BU-GR2VYNKQ`. On the other BUs, log `ar: skipped (AR read-set lives on BU-GR2VYNKQ)`. Add a dry-run line.

**Interfaces:**
- Produces: `seedArBase`, `ArSetup` (consumed by Task 4).

- [ ] **Step 1: Implement** `scripts/data-reset/ar.ts` and wire it into `index.ts`.
- [ ] **Step 2: Type-check.** Run `bunx tsc --noEmit -p .`. Expected: no new errors.
- [ ] **Step 3: Commit.** Message: `feat(data-reset): AR customers and cost center on TEST BU`.

### Task 3: Inactive `ar_invoice` workflow in the dataset

**Files:**
- Modify: `scripts/data-reset/workflow-template.ts:27`: add `"ar_invoice"` to the `workflow_type` union.
- Modify: `scripts/data-reset/fixtures/workflows.json`: add an `ar_invoice` entry named `AR Invoice` that copies the
  `ap_payment` stages (Create Request: Admin + Budget, submit → Accounting Approval: Budget, with approve / reject /
  sendback → Completed, terminal, no actions), with `is_active: false`.
- Modify: `scripts/data-reset/workflows.ts` only if it refuses or skips an inactive fixture. It must create the workflow
  inactive and leave an existing one untouched.

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Type-check.** Then run `bun run data:reset --dry-run`. Expected: the workflow step lists `AR Invoice`
  (inactive).
- [ ] **Step 3: Commit.** Message: `feat(data-reset): inactive ar_invoice workflow fixture`.

### Task 4: AR read-set documents and dataset verification

**Files:**
- Create: `scripts/data-reset/docs/ar.ts` exporting `AR_READ_SET` and
  `seedArDocs(sessions: Sessions, cfg: ResetConfig, ctx: SeedContext, ledger: RowLedger): Promise<StepResult>`.
  All documents are created as Admin through `POST api/:bu/ar-invoice` (`doc_source` omitted, `doc_date` = today as
  `YYYY-MM-DD`). Lines have `cr_chart_of_accounts_id` = 4100 and `cr_cost_center_id` = `E2E-CC-1`, with **no**
  `vat_chart_of_accounts_id`. The tag goes in `description` as `STD ar.<row> <KEY>`. If the list `search` does not hit
  `description`, put the key in `source_doc_ref` too, and record which field works in a code comment.

  | Key | doc_type | lines | final state |
  |---|---|---|---|
  | `E2E-AR-POSTED` | invoice, `is_tax_invoice: true`, customer 1 | 3 x 333.33, Vat 7% | posted (net 999.99, VAT 70.00, total 1,069.99) |
  | `E2E-AR-DRAFT` | invoice, customer 1 | 1 x 500.00, Vat 7% | draft |
  | `E2E-AR-CN` | credit_note, customer 1 | 1 x 100.00, Vat 7% | posted (total 107.00) |
  | `E2E-AR-DN` | debit_note, customer 1 | 1 x 200.00, None | posted (total 200.00) |
  | `E2E-AR-VOID` | invoice, customer 2 | 1 x 300.00, None | posted, then voided (`reason: "STD void"`) |

  Re-runs find a key by search and skip it when it exists in the right state.
- Modify: `scripts/data-reset/docs/seed-all.ts`: add `arDocs: seedArDocs` to the steps map and run it after
  `accounting-docs` on `BU-GR2VYNKQ` only.
- Modify: `scripts/data-reset/verify-dataset.ts` `EXPECTED_ROWS`: add rows for `customer E2E-CUST-1/2`,
  `cost center E2E-CC-1`, `gl_setting ar_control_account_id / output_vat_account_id`, and each AR key with its
  `doc_status`. A short row makes the run exit 1.
- Modify: `scripts/data-reset/README.md` and `CLAUDE.md` (the "Standard test dataset" paragraph): one sentence each
  naming the AR read-set.

**Interfaces:**
- Consumes: `seedArBase` / `ArSetup` (Task 2).
- Produces: the five keys, which the spec reads by search (Task 5 `seededArDoc`).

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Type-check.** Expected: no new errors.
- [ ] **Step 3: Live reset (manual verification).** Run `bun run data:reset --yes`. Expected: exit 0, the AR rows created
  with 0 failed, and `verify` 0 failed. Then run `bun run data:reset --yes --bu BU-96EAT3GX`. Expected: exit 0 with
  `ar: skipped`.
- [ ] **Step 4: Re-run without changes.** Wait at least 60 s, then run `bun run data:reset --yes` again. Expected: the AR rows
  are skipped, and there are no 409 failures.
- [ ] **Step 5: Commit.** Message: `feat(data-reset): AR invoice read-set (posted / draft / CN / DN / void) + verify rows`.

### Task 5: Test-ID registration, the API helper, the page object

**Files:**
- Modify: `docs/test-id-scheme.md`: add the row
  `| 806-ar-invoice.spec.ts | ARINV | 01–08, 10 | Accounting AR invoice on TEST BU: list / detail (01), create (02), edit / delete (03), submit & post (04), debit / credit notes (05), credit-note application (06), void (07), ar_invoice workflow (08), viewer (10) |`
  next to the 80x rows, along with whatever section catalog `bun audit:tc-ids` needs.
- Create: `tests/helpers/ar-api.ts`, shaped like `tests/helpers/ap-api.ts` (same `Role`, `CREATOR` = Admin,
  `APPROVER` = Budget, through `buSend`):
  - `interface ArLine { qty: number; price: number; vat?: boolean; discountPct?: number }`
  - `createArDoc(docType: "invoice" | "debit_note" | "credit_note", opts: { tag: string; lines: ArLine[]; customer?: "E2E-CUST-1" | "E2E-CUST-2"; taxInvoice?: boolean; references?: { id: string; amount: number }[] }): Promise<{ id: string; no: string }>`
  - `getArDoc(id: string): Promise<ArDoc>`, where `ArDoc` holds `{ id, no, docType, status, version, total, net, vat, outstanding, referenceApplied, taxInvoiceNo?, taxStatus?, glJvId?, voidGlJvId?, allowedActions: string[], lines }` mapped from `doc_no`, `doc_status`, `doc_version`, `total_amount`, `net_amount`, `vat_amount`, `outstanding_amount`, `reference_applied_amount`, the tax invoice fields, and `allowed_actions`
  - `seededArDoc(key: string): Promise<ArDoc>` (search the list, throw `"<key> missing - run bun run data:reset --yes"`)
  - `submitArDoc`, `approveArDoc`, `rejectArDoc(id, role, reason?)`, `reviewArDoc(id, role, stage)`, `voidArDoc(id, role, reason?)`, `deleteArDoc(id, role)`: each returns `{ status: number; body: any }`, sends the current `doc_version`, and none throws on 4xx
  - `referenceCandidates(invoiceId: string): Promise<{ id: string; available: number }[]>`
  - `setArWorkflowActive(on: boolean): Promise<void>` (GET `config/:bu/workflows/ar-invoice`, then PUT `is_active` with
    `doc_version`, a no-op when it is already in that state) and `arWorkflowActive(): Promise<boolean>`
- Create: `tests/pages/ar-invoice.page.ts` `ArInvoicePage`, with locator factories (arrow functions) read from FE
  `routes/accounting/accounts-receivable/ar-invoice-{list.route,detail.route,draft-form,line-dialog,lines}.tsx`:
  - `gotoList()`, `gotoNew()`, `gotoDetail(id)`;
  - `row(text)`, `statusChip(scope?)`, `searchInput()`;
  - `customerLookup()`, `addLineButton()`, `lineDialog()` with `qty / unitPrice / discountPct / revenueAccount /
    costCenter / taxProfile` fields;
  - `summary()` (net / VAT / total), `button(name)`, `confirmWithReason(action, reason)`, `toastWith(re)`.
  - Prefer `getByRole` and use `data-slot` where roles collide.

**Interfaces:**
- Produces: everything named above (consumed by Tasks 6 and 7).

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Static checks.** Run `bunx tsc --noEmit -p .` and `bun audit:tc-ids`. Expected: no new type errors, audit OK.
- [ ] **Step 3: Commit.** Message: `test(806): ARINV prefix, ar-api helper and AR invoice page object`.

### Task 6: Spec `806-ar-invoice.spec.ts`, sections 01–07 and 10

**Files:**
- Create: `tests/806-ar-invoice.spec.ts`: header comment as in 801 (roles, read-set, tag scheme), a test per role from
  `createAuthTest`, `test.describe.configure({ timeout: 90_000 })`, `beforeAll`: `assertAccountingReady()` plus
  `if (await arWorkflowActive()) { console.warn(...); await setArWorkflowActive(false) }`.
- Create: `docs/superpowers/specs/2026-11-25-e2e-ar-invoice-bug-list.md`: the output-VAT entry, plus anything else
  pinned.

Cases, using the design's section table. Expected values come from `money.ts`. Each case is one `test` with all five
annotations.
- **01**
  - The read-set (search each key) shows status / total / outstanding: POSTED 1,069.99 / 1,069.99 Posted, DRAFT
    Draft, CN 107.00 Posted, DN 200.00 Posted, VOID Void 0.00.
  - The status filter Draft lists DRAFT only, among the keyed docs.
  - The doc-type filter.
  - Search by POSTED's `doc_no`.
  - The POSTED detail shows the line, VAT 70.00, the TX number and the JV link.
- **02 (UI)**
  - Create with customer 1 and two lines: 2 x 100.00 Vat 7%, and 1 x 999.99 None. Summary before save shows net
    1,199.99, VAT 14.00, total 1,213.99. After save the API matches, the number matches `/^DRAFT-\d{8}$/` and the
    status is draft.
  - No customer → refused (stays on `new`, nothing created).
  - A line without a revenue account → refused.
  - Discount 10% on 1 x 1,000.00 Vat 7% → net 900.00, VAT 63.00.
- **03**
  - Edit a draft line price through the UI, then the API shows the new total.
  - A stale `doc_version` PUT gives 409 `AR_INVOICE_IMMUTABLE`.
  - Delete a `DRAFT-` draft, after which GET gives 404.
- **04**
  - Submit (no workflow) posts. The number matches `/^ARIV\d{8}$/`.
  - The JV balances.
  - Dr 1130 = total and Cr 4100 = net.
  - A VAT leg of the VAT amount exists.
  - `outstanding = total`.
  - **VAT-leg case (pinned):** Cr 2160 = VAT.
  - A tax invoice (API create `taxInvoice: true`) gets a `TXIV` number with status `pending`.
  - Customer 2 posts Dr to 1130 through the gl_setting default.
  - Total 0 is refused with 400 and the doc stays draft.
  - Mixed VAT rates on a tax invoice give 400 `AR_TAX_INVOICE_MIXED_VAT_RATE`.
- **05 (API create, UI view)**
  - A debit note posts with invoice signs and `ARDN` number. **VAT-leg case (pinned):** Cr 2160 on a VAT debit note.
  - A credit note posts with flipped signs (Cr 1130 = total, Dr 4100 = net) and an `ARCN` number. **VAT-leg case
    (pinned):** Dr 2160.
- **06 (own credit notes)**
  - `referenceCandidates(invoice)` lists the new CN with `available` = its total.
  - An invoice applying 50.00 posts: invoice outstanding = total - 50.00, and the CN's `referenceApplied` = 50.00.
  - Applying more than available gives `AR_REFERENCE_OVER_APPLIED`.
  - Voiding the referenced CN gives 409 `AR_INVOICE_IS_REFERENCED`.
- **07**
  - Void a posted invoice through the UI (the confirm stays disabled until a reason is given). The status is void and
    outstanding 0.
  - The reversing JV (`voidGlJvId`) negates every line of the original. **VAT-leg case (pinned)** on a VAT invoice.
  - The tax invoice becomes `void`.
  - Void without a reason (API) gives 400.
  - Void a draft → void.
- **10 (Requestor)**
  - The list and the POSTED detail are visible.
  - There is no Void / Submit button on POSTED or DRAFT, and no New button on the list. If the FE shows New to a
    view-only user, pin it as a suspected bug.
  - Void through the API is refused with 4xx and the doc stays posted.

Pin a case with `test.fail(true, "suspected bug: …")` only after a run shows the backend disagrees, and record it in the
bug list. The output-VAT pin is known up front.

- [ ] **Step 1: Implement** the spec and the bug list.
- [ ] **Step 2: Annotation audit.** Run the `pre`/`exp` count loop from CLAUDE.md and `bun audit:tc-ids`. Expected: no
  mismatch, OK.
- [ ] **Step 3: Run.** Run `... bunx playwright test --project=setup --project=chromium tests/806-ar-invoice.spec.ts`.
  Expected: all pass, with the pinned cases shown as expected failures. For any failure, decide whether it is a spec bug
  (fix it) or an app bug (pin it, and add it to the bug list with the doc number and the BE answer).
- [ ] **Step 4: Commit.** Message: `test(806): AR invoice list, create, post, notes, credit-note application, void, viewer`.

### Task 7: Section 08 workflow, docs, full verification

**Files:**
- Modify: `tests/806-ar-invoice.spec.ts`: add `test.describe.serial("AR invoice workflow (806-08)")`.
  - `beforeAll`: `setArWorkflowActive(true)`. `afterAll`: `setArWorkflowActive(false)`.
  - Cases, all on docs created by Admin:
    1. Submit gives `in_review`, a real `ARIV` number and no JV (`jvOfSource` is empty).
    2. Admin approve gives 403 `WORKFLOW_CREATOR_CANNOT_APPROVE`.
    3. Requestor approve gives 422 `WORKFLOW_USER_NOT_STAGE_APPROVER`.
    4. Budget approves from the detail page UI, giving posted with a balanced JV.
    5. Budget rejects without a reason (API): 422 `AR_INVOICE_REJECT_REASON_REQUIRED`, still `in_review`.
    6. Budget rejects with a reason (UI) gives void, outstanding 0, no JV and no tax invoice.
    7. Budget sends back to `Create Request` gives draft with the same real number.
    8. Delete of that doc gives 422 `AR_INVOICE_NUMBERED_VOID_ONLY`.
    9. Delete of an `in_review` doc gives 409 `AR_INVOICE_IMMUTABLE`.
- Modify: `scripts/sync-test-results.ts` `SYNC_TARGETS`: add `{ jsonFile: "806-ar-invoice-results.json", sheetTab: "AR_Invoice" }`.
- Regenerate: `bun docs:user-stories`, then commit only `docs/user-stories/806-ar-invoice.md`. Run `bun audit:coverage`
  and `bun audit:spec-health`, and commit `docs/test-cases/COVERAGE.md` / `SPEC-HEALTH.md` if they changed.

- [ ] **Step 1: Implement** section 08 and the docs updates.
- [ ] **Step 2: Run the spec twice.** Run it twice without a reset in between. Expected: green both times, with the same
  pins. After the run, `arWorkflowActive()` is false (check with a one-line `bun -e` or the workflow page).
- [ ] **Step 3: Crash guard check.** Activate the workflow by hand (`setArWorkflowActive(true)` through `bun -e`), then
  run sections 01–07 only (`-g "TC-ARINV-0[1-7]"`). Expected: the `beforeAll` warns, deactivates the workflow, and the
  cases pass.
- [ ] **Step 4: Regression on the neighbours.** Run `801`, `804`, `810` and `820`. Expected: the same results as before
  this branch (the new COA accounts, gl_setting keys and permissions must not change AP or JV).
- [ ] **Step 5: Static checks.** Run `bunx tsc --noEmit -p .`, `bun audit:tc-ids` and the annotation loop. Expected: clean.
- [ ] **Step 6: Commit.** Message: `test(806): ar_invoice workflow group, sync target, user-story docs`.
