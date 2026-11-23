# E2E Phase 2a — Accounting: AP + JV money path

Date: 2026-11-23 · Repo: `carmen-frontend-e2e` · Target app: `../carmen-frontend` @ `main`
Follows: `2026-11-20-e2e-catchup-phase-0-1-design.md` (Phase 0+1, merged as #87–#94)

## Intent / why

Accounting is about to be used for real. The user wants e2e coverage that **catches bugs before
go-live** (user, 2026-11-23). In an accounting system the worst bug is a screen that works while
the numbers are wrong. So this phase checks **money outcomes**, not just that pages open.

Phase 2 from the parent design covered "Accounting, inventory-adjustment, sales-consumption +
import-pos, procurement `from-*`". That is several projects. The agreed order is:

| Sub-phase | Scope |
|---|---|
| **2a (this doc)** | AP + JV: the money path that already talks to the real backend |
| 2b | `inventory-adjustment` default spec (today only opt-in `730` in the movement project) |
| 2c | `sales-consumption` + `import-pos` |
| 2d | `goods-receive-note/from-po` (the only `from-*` route without a spec; from-pr / from-price-list / from-template are already driven) |
| later | AR. Most AR screens still run on mock / staging / localStorage (profile, contract, folio, receipt, advance deposit, draft form). Tests written now would test screens that write nothing, so AR waits until it is wired to the backend. |

Each sub-phase gets its own short design (or a line in this one, if trivial) and its own PR series.

## Scope of 2a

The money path, as the user saw it:

```
GRN commit → AP invoice → approve → payment (WHT) → payment approvals
                 ↓                        ↓
              JV posted   ←───────────  JV posted   (+ manual JV / JV template / void / reverse)
```

Routes in scope (FE `routes/accounting/…`, all gated by license `accounting.ap` or `accounting.gl`):
- AP: `/accounting/accounts-payable` (dashboard), `…/invoice` (list + detail), `…/deposit`,
  `…/debit-note`, `…/credit-note`, `…/payment` (list + detail), `…/payment-approvals`
- GL: `/accounting/journal-voucher` (list + form), `/accounting/template-voucher`,
  `/accounting/recurring-voucher`, `/accounting/allocation-voucher`, accounting documents list/detail
  (the JV detail page is `documents/accounting-document-detail.tsx`)
- `/accounting/settings` (read and the toggles the flows depend on)
- GRN → AP invoice auto-creation (BE #1002 / FE #502, a BU switch that is off by default)

Out of scope for 2a: AR (see above), the accounting dashboard's aggregate widgets beyond a smoke
check, cheque reconciliation and output-tax reports. The builder may add output tax as a read-only
VAT cross-check if it is wired to the backend.

## Goals

1. Each route in scope has a spec, numbered after the existing scheme (`docs/test-id-scheme.md`,
   new prefixes for AP / JV).
2. **Money assertions through the API**, with expected values computed by the test from its own
   inputs (for example, net 1,000.00 at VAT 7% gives VAT 70.00, and WHT 3% applies to the net).
   Never read the expected value from the FE's own formula.
   - every posted JV balances (Σ Dr = Σ Cr) and uses the accounts the BU mapping says
   - AP invoice totals, VAT and WHT are correct, including Inc-VAT per line (BE #1036)
   - the AP open balance drops by exactly what was paid, and partial payments leave the remainder open
   - void and reverse produce a JV that exactly cancels the original
   - approval / workflow states move as the workflow says, and roles without permission are refused
3. The user-visible part is asserted too: amounts shown on the detail pages match the API, and
   status chips and actions follow the state.
4. Suspected bugs are pinned and listed exactly as in Phase 1.

## Non-goals

- Fixing app bugs (they are reported, as in Phase 1).
- AR, and the 2b–2d scopes (they get their own PRs).
- Performance or load testing.

## Anti-goals (a failure even if green)

- Tests that only check that a page loads, or that a button exists.
- Expected numbers taken from the same code path that is under test (FE formulas, or the API
  echoing what the FE sent). Expected values come from the test's own inputs.
- Mocking the backend. (`page.route` is allowed only to hold a response in order to pin a race,
  as with TC-PRT-070006.)
- Running anything that posts or changes periods on CARMEN-AVG / CARMEN-FIFO or any BU other than TEST.

## Approach (user chose option 3: hybrid data)

Alternatives considered:
1. *data:reset seeds every accounting document state; specs only use them.* Fast, but specs that
   change state (approve, pay, void) use the data up in one run and cannot re-run without a reset.
   That is the problem 601 has today.
2. *Every spec builds its whole chain through the API.* Always re-runnable, but slow, and it leaves
   many documents on TEST BU each run.
3. **Hybrid (chosen):** `data:reset` seeds a **stable read set** (for example a posted AP invoice, a
   paid invoice, a partially paid invoice, a posted manual JV, a JV template). These serve list,
   detail, filter and number checks. Specs that **change state** create fresh documents in the test
   through API helpers (`tests/helpers/ap-api.ts`, `gl-api.ts`, same style as `grn-api.ts` /
   `sr-api.ts`), so they re-run without a reset.

## Decisions (author's calls unless marked user)

- **Failure policy:** same as Phase 1 (policy ข). Intentional change → update and cite the
  commit. Suspected bug → `test.fail(true, "suspected bug: …")` after setup, plus a row in a new
  bug list `docs/superpowers/specs/2026-11-23-e2e-phase-2a-bug-list.md`. BE merged but not deployed
  → classify as such. Racy bugs are pinned deterministically (hold the response with `page.route`)
  instead of being skipped.
- **Backend:** test dev as deployed (as in Phase 1, user decision 1ก). Record the dev BE build at the start.
- **Preconditions to check first (Task 0 of the plan):** TEST BU `GR2VYNKQ` holds licenses
  `accounting.ap`, `accounting.gl` and `accounting.gl.jv_template` (`LICENSE_ENFORCEMENT` is on in
  every env). The test accounts hold the AP / GL permissions. The gateway allowlist covers
  `ap-invoice.*`, `ap-payment.*` and the GL endpoints on dev. COA and the account mappings the
  postings need exist after `data:reset` (Phase 0.5 seeds a minimal COA, which may need more
  accounts). Each gap is either fixed in `data:reset` (TEST BU only) or reported to the user. Never
  work around it with a skip.
- **GRN → AP auto switch:** a spec that needs it turns it on for TEST BU and restores the previous
  value in `finally` (same pattern as `hide_fields` in `workflow-api.ts`).
- **Irreversible postings:** allowed **only on TEST BU**, because `data:reset` wipes it. No
  irreversible action on CARMEN-AVG / FIFO (user rule from Phase 1, 2026-11-22).
- **Outcome waits:** use the `expectBlocked` / `expectRefused` / `expectSaved` helpers in
  `tests/helpers/settle.ts`. No `waitForTimeout` and no `.catch(() => null)` swallows.
- **Rounding:** expected amounts are computed with the BU's decimal settings, read from the API
  once per run, not hardcoded.

## Facts found in code (answers to the builder check, 2026-11-23)

BE = `carmen-turborepo-backend/apps` (gw = backend-gateway, mb = micro-business).

- **Creating documents directly.** `POST /api/:bu/ap-invoice` creates all four AP types through
  `doc_type` = invoice | debit_note | credit_note | deposit (gw `ap-invoice.controller.ts:66`).
  - Required fields: doc_date, vendor_id, vendor_invoice_no, invoice_date, and `details.add[≥1]`.
    Each line needs sequence_no, quantity, unit_price and dr_chart_of_accounts_id.
  - Clients cannot send doc_source `grn` / `grn_auto`.
  - The FE has a "new" flow at `<list>/new` for each of the four types.
  - So state-changing specs create AP documents with no GRN chain. The GRN → AP auto path gets its
    own spec.
- **GRN auto switch.** `gl_setting.ap_auto_from_grn` in `tb_application_config` (key `gl_setting`).
  A missing value means off (mb `ap-invoice.service.ts:305`, `gl-posting.service.ts:173-189`).
- **Posting is synchronous.** Submit with no workflow, or the final approve, posts the JV in the
  same transaction. A failed post rolls the approval back (mb `ap-invoice.service.ts:879-944`, same
  pattern in `ap-payment.service.ts:717-736`). No polling is needed. The only scheduled path is
  manual JV `post_at` / run-due.
- **Accounts used.**
  - AP control (Cr): `tb_vendor.ap_chart_of_accounts_id`, falling back to
    `gl_setting.ap_control_account_id` (else `GL_SETTING_ACCOUNT_MISSING`).
  - Expense / inventory (Dr): the line `dr_chart_of_accounts_id`. A GRN auto invoice takes it from
    the product category mapping.
  - VAT input: the line `vat_chart_of_accounts_id`, falling back to `gl_setting.input_vat_account_id`.
  - Deposit: `advance_deposit_account_id`.
  - Payment: bank = `tb_bank_account.chart_of_accounts_id`; WHT = the tax profile account, falling
    back to `gl_setting.wht_payable_account_id`.
- **Period.** Every AP / JV post needs a **GL period** (`tb_gl_period`, status open, covering the
  doc date), else `GL_PERIOD_NOT_OPEN`. The bypass is `gl_setting.allow_post_to_closed_period`.
- **Void / reverse.**
  - AP invoice / payment void: a draft changes status only. A posted document gets a reversing JV;
    a payment void also restores the unpaid amount.
  - An invoice void is refused with `AP_INVOICE_HAS_PAYMENT` / `AP_INVOICE_IS_REFERENCED`.
  - Manual JV: `void` backs the amounts out of the balances with no new JV. `reverse` creates a
    mirror JV on a later date.
  - Subledger (AP-generated) JVs refuse both with `GL_JV_IMMUTABLE`.
  - Void needs `accounting.ap.void` / `accounting.gl.void`. Approve is resolved by workflow stage.
- **What `data:reset` lacks for accounting today** (this decides the size of Task 1):
  - The COA fixture has 13 codes with no name or type.
  - No `gl_setting` accounts and no GL period are seeded.
  - No vendor AP account, no bank account, and no WHT / VAT profile accounts.
  - No AP payment or JV workflow (`fixtures/workflows.json` has only PR, PO and SR).
  - Only Admin is certain to hold AP / GL permissions. Budget gets the "Accounting" role, whose
    contents are BU data.
- **Period-close specs (910–924)** run on CARMEN-AVG / FIFO only, never on TEST BU, so they do not
  collide with 2a.

## User decisions after the builder check (2026-11-23)

- **Oracle for "correct numbers" (user: ก):**
  - The source of truth is the FE accounting design docs: `../carmen-frontend/docs/accounting/specs/`
    (`accounts-payable-invoice-design.md`, `accounts-payable-payment-design.md`,
    `general-ledger-journal-voucher-design.md`) plus `docs/accounting/ap-payment-save-rules.md`.
  - Code that disagrees with them is a suspected bug.
  - Where they are silent (rounding per line or per document, WHT base on Inc-VAT lines …), follow
    standard Thai tax practice: VAT 7% on the pre-VAT base, WHT on the pre-VAT base, and round half-up
    to the BU's decimals.
  - Each such case states that the rule is an **assumption**, in its `expected` annotation and in the
    bug-list row if it fails.
- **Expand `data:reset` (user: approved).** This is **Task 1** of the plan, on TEST BU only:
  - a COA with names and types that covers AP control, VAT input, WHT payable, advance deposit,
    expense, inventory, bank and FX gain/loss
  - `gl_setting` accounts
  - an open GL period for the current month
  - a bank account mapped to the COA
  - WHT / VAT tax profiles mapped to accounts
  - an AP account on the seeded vendors
  - an AP payment workflow and a JV workflow (with stages)
  - two accounting roles: an approver role, and a view-only role for the refusal cases
  - the seeded read set (approach 3)

  Each new step has a vitest test in `unit/data-reset/`. The run-time increase is accepted.

## Constraints (repo rules — every PR, unchanged from Phase 1)

- All 5 annotations on every case. The pre/exp audit passes, `bun audit:tc-ids` passes, and
  `bun docs:user-stories` is regenerated in the same commit.
- `bun test:unit` stays green. `data:reset` changes get vitest coverage in `unit/data-reset/`.
- `workers: 1`, `retries: 0`. A failure may be re-run once in isolation, and one that passes on
  re-run is listed as flaky.
- Locators: `getByRole` first, `data-slot` when ambiguous. Page objects expose locator factories.
- `bun audit:coverage` + `bun audit:spec-health` are regenerated at the end of each PR.
- Commit messages in Thai, PR text in English, merge commits only (no squash), and no merge
  without the user.
- No secrets in commits. The rate-limit bypass token goes through `tests/helpers/rate-limit.ts`.

## Left to the builder

- Spec numbering and file split (for example AP invoice / AP payment / JV / JV template), and the
  PR split (about 2–4 PRs).
- The exact documents in the seeded read set, and their amounts. Pick numbers that make VAT, WHT
  and rounding cases visible.
- Whether deposit, debit note and credit note get one spec each or share one.
- Whether output tax gets a read-only VAT cross-check.
