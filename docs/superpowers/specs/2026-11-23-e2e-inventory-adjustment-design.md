# E2E — Inventory Adjustment (Phase 2, stock path)

Date: 2026-11-23 · Repo: `carmen-frontend-e2e` · Target app: `../carmen-frontend` @ `main`
Follows: `2026-11-23-e2e-sales-consumption-design.md` (merged #102). Phase 2 order (user, 2026-11-23):
sales-consumption → **inventory-adjustment** → procurement `from-*` → AR.

## Intent / why

Phase 2 goal (user): catch money / stock bugs **before real use**. Inventory Adjustment (Stock In /
Stock Out) is the manual way to put stock in or take it out, at a cost. A wrong commit silently
corrupts on-hand and inventory value. IA posts **no JV** (checked: neither `stock-in.service.ts` nor
`stock-out.service.ts` creates journal entries), so the money lives only in the stock cost layers. The
tests therefore assert on-hand and cost through the API, not toasts.

## Current state

- `tests/730-inventory-adjustment-doc-flow.spec.ts`: 16 tests (TC-IADJ-70xxxx Stock In, 71xxxx Stock
  Out). It is in the opt-in movement suite (`E2E_MOVEMENT=1`), runs on **CARMEN-AVG** (a real BU) as
  `fc` at location 1FO02, and skips quietly when the active period does not contain today. It walks
  open → draft → view → edit → delete → new + Commit and pins two FE bugs:
  TC-IADJ-710003 (FE-5: reopened Stock Out draft shows estimated cost 0.00) and TC-IADJ-710004 (FE-4:
  editing a Stock Out line qty makes Total NaN and Save sends nothing).
- The main suite has nothing for IA. `docs/test-cases/gaps/730-inventory-adjustment-gap.md` lists
  60 open cases, mostly list-page UI (filters, sort, saved views).
- No test checks a stock outcome of a commit or a void.

Backend rules (fact, `micro-business/src/inventory/stock-{in,out}/*.service.ts`):
- Stock Out must be dated in the **current** period (`STOCK_OUT_DATE_NOT_CURRENT_PERIOD`). Stock In
  may be dated in any **open** period (`STOCK_IN_DATE_OUTSIDE_OPEN_PERIOD`).
- Stock Out commit checks shortage for the whole document against one balance per product
  (`findStockShortage` → `STOCK_OUT_INSUFFICIENT_STOCK`), using the tenant's calculation method.
- Only drafts commit (`*_ONLY_DRAFT_COMMITTABLE`). Completed documents cannot be updated or deleted
  (`*_COMPLETED_NO_UPDATE` / `_NO_DELETE`).
- Void Stock Out posts an adjustment-in reversal. A Stock Out from Sales Consumption cannot be voided
  here (already covered by 141). Void Stock In whose stock was consumed is refused
  (`STOCK_IN_VOID_INSUFFICIENT_STOCK`). A second void is refused (`*_ALREADY_VOIDED`).

## Scope (user chose B, then option 1)

1. **Move 730 into the main suite on TEST BU** (user). Rewrite it as
   `tests/731-inventory-adjustment.spec.ts`, run as Admin on TEST BU `GR2VYNKQ`. Keep the
   TC-IADJ-70xxxx / 71xxxx IDs and the two pins. Delete 730. Do not use `-doc-flow` in the new file
   name: `playwright.config.ts` drops `*-doc-flow.spec.ts` from the chromium project. Keep
   `tests/helpers/movement/docs.ts` (`createAdjustment` is used by the 9xx period-close specs).
2. **New stock-outcome spec** `tests/732-inventory-adjustment-stock.spec.ts` (cases below).
3. The UI cases in the gap report stay as a gap. Only rows that 731/732 now cover are updated.

### 732 cases

Stock In
- Commit in the UI → on-hand at that location rises by qty, and the movement shows the line cost.
  The document is `completed` and read-only.
- Dated outside every open period → refused (API), with nothing created.
- Commit twice: sequential, and two parallel requests → one movement only.
- Void a committed Stock In whose stock is untouched → on-hand back to before, status `voided`.
- Void a Stock In whose stock was partly issued by a later Stock Out → refused, on-hand unchanged.
- Negative qty, negative cost, or a qty `0` line on commit through the API → refused (user). If any
  is accepted, pin it as a suspected bug. The FE lets a new row start at 0 so it shows no error, but
  commit must not accept it.

Stock Out
- Commit in the UI → on-hand drops by qty. The issue cost equals the tenant's method: weighted
  average for AVG, oldest layer first for FIFO. It also matches the estimate the form showed.
- Qty above on-hand → refused. The response names the short product. On-hand is unchanged and the
  document stays `draft`.
- Two lines of the same product that are each covered but over on-hand together → refused (this is
  the whole-document check).
- Dated in a period other than the current one → refused.
- Commit twice: sequential and parallel → one deduction.
- Void a committed Stock Out → on-hand restored at the cost it was issued.
- Completed document: update / delete through the API → refused. Void twice → refused.

## Goals

1. 731 passes on TEST BU with the same coverage 730 had. Pins remain where the bugs remain.
2. 732 cases pass against current `main`, or are pinned per the failure policy.
3. The main suite run (`--project=chromium`) includes both. The movement suite no longer has an IA spec.

## Non-goals

- List-page UI cases from the gap report.
- Fixing app bugs found (they go to the bug list).
- Testing on CARMEN-AVG / FIFO, and costing-method coverage beyond TEST BU's own method.
- Void when the period is closed. We never close periods.

## Anti-goals (a failure even if green)

- A stock case that asserts only the UI toast, not on-hand / cost behind it.
- Leaving a committed adjustment's stock effect behind. Other specs (141, 711, 720) read TEST BU
  on-hand.
- Asserting absolute on-hand numbers that another spec can move. Use deltas read live.
- Touching any BU other than TEST BU.

## Approaches

Considered:
- **UI journey + API verification (chosen, the one sensible way).** Same shape as 2a and SC: the
  user path runs in the browser, outcomes are read with `tests/helpers/bu-api.ts`. Guards the UI
  cannot reach (parallel commit, void of a consumed Stock In, direct update of a completed doc, bad
  dates) call the API only.
- Moving 730, option 1 **(user): rewrite on TEST BU and delete 730**. Rejected option 2: keep 730
  running on either BU behind an env switch. That needs two sets of accounts, locations and products
  in one spec, for a real-BU run the user no longer wants.

## Decisions (author's calls unless marked user)

- Scope B + move option 1 (user).
- Spec numbers 731 / 732, prefix `IADJ` (author). 732 uses sections that the gap report does not use,
  so IDs never collide (builder picks and registers them in `docs/test-id-scheme.md`). The 730 row in
  the scheme becomes 731.
- Role: Admin on TEST BU (author). 730 used `fc` only because it was the one CARMEN-AVG account with
  Stock In/Out permission. The FE-6 permission case (TC-IADJ-700001 "no Permission Denied") stays,
  run as Admin.
- Dates (author): Stock Out on today (the current period after `data:reset` is this month). The
  "other period" cases use a date in the next pre-generated period if one exists, otherwise last
  month. If neither is available, keep a data guard with a reason; do not skip silently.
- Stock (author): each 732 test stock-ins its own qty first at a known cost, so its Stock Out never
  depends on another spec's stock. Expected cost is computed from the live on-hand and value read
  just before the test.
- Cleanup (author): `afterAll` voids what the spec committed, Stock Outs first and then Stock Ins,
  and deletes drafts. Cleanup failures throw.
- Failure policy unchanged. A suspected bug → `test.fail(true, "suspected bug: …")` after setup, with
  real-BE guards (not 401, < 500) before it. A product question → "needs product decision:" pin. New
  entries go to `2026-11-23-e2e-inventory-adjustment-bug-list.md`.

## Builder check answers (2026-11-23, author's calls unless marked fact)

1. **Void soft-deletes** (fact). `voidStockIn` sets `doc_status=voided` together with `deleted_at`
   (`stock-in.service.ts:1889-1900`). `findOne` / `findAll` / void all filter on `deleted_at: null`, so a
   voided document 404s and leaves the list. A second void therefore answers `*_NOT_FOUND`, not
   `*_ALREADY_VOIDED`. Void cases assert the on-hand / movement effect and the refusal of a second void
   (any 4xx catalog code). **User (2026-11-23): a voided document vanishing is wrong.** One case
   voids a committed document, then expects it to stay readable with `doc_status=voided` (detail
   200) and to appear under the list's Voided filter. It is pinned `test.fail(true, "suspected bug:
   void soft-deletes the document")` and goes in the bug list.
2. **Parallel commit** (author). Two variants. (a) Both requests send the same `doc_version`, which is
   the FE path. (b) Neither sends one, which is a raw API caller. Both must give exactly one posting.
   A second posting is a suspected bug because it double-counts stock. The check sits outside the
   transaction (`stock-in.service.ts:706-710`), and the version lock applies only when sent
   (`:805-808`), so (b) is the case most likely to fail.
3. **Stock In in a later period** (fact + author).
   - Fact: on an AVG tenant, a Stock In dated in a pre-generated later period commits but posts no
     movement until bring-forward (`held-until-brought-forward.helper.ts`).
   - Call: the "outside every open period" case uses a date **before the earliest open period**.
   - Call: on an AVG tenant, add one API case that asserts the held behaviour: the document is
     completed and on-hand does not change. Read TEST BU's calculation method live and branch on it.
4. **Dates beyond today** (fact: the FE refuses them, see the 730 comment on FE 90018c6d). All
   other-period cases are API-only. A refusal is asserted as a 4xx with one of the documented catalog
   codes (`*_DATE_NOT_CURRENT_PERIOD`, `*_NO_OPEN_PERIOD`, `*_DATE_OUTSIDE_OPEN_PERIOD`). When no
   suitable period exists, the data guard **fails loudly** with the reason (same as SC). It is not a
   skip.
5. **Helpers** (author). 731/732 use `tests/helpers/bu-api.ts` (`buGet` / `buSend` as Admin) and the
   main fixture. `tests/helpers/movement/*` is untouched: the 9xx period-close specs run on the
   movement BUs, not TEST BU. Re-check the cost-estimator 422 `signals.minor` on TEST BU and drop it
   if it no longer fires.
6. **Negative / zero values** (user, 2026-11-23). No `@Min` / `@IsPositive` was found on the IA DTOs.
   - Negative qty or negative cost accepted → suspected bug.
   - Qty 0 accepted on commit → suspected bug.
7. **Stock In void check** (fact). The check uses the lowest drawable balance from `si_date` onward
   (`stock-in.service.ts:1795-1817`), not current on-hand. Call: the setup uses same-day documents:
   Stock In today, then Stock Out today.
8. **Clean cost layers** (author). `data:reset` gets an `ia` step that creates 2 products used by no
   other spec (`E2E-IA-A`, `E2E-IA-B`), with **no** opening stock, at one TEST BU location. 732
   stock-ins them at known costs, so expected AVG / FIFO cost can be computed exactly from the
   spec's own layers, and other specs never move them. `verify-dataset` checks they exist. Confirm
   Admin's Stock In/Out permission on TEST BU in `access.ts` while building.

## Constraints (repo rules)

- All 5 annotation fields on every `test(...)`. `bun audit:tc-ids` passes. Regenerate
  `bun docs:user-stories`.
- `workers: 1`, no retries. Run with `bun run test -- --project=chromium <spec>`.
- Locators: `getByRole` first, `data-slot` when ambiguous.
- Irreversible actions only on TEST BU. Never close a period. Never set `E2E_ALLOW_IRREVERSIBLE`.
- Commits in Thai, PR in English, merge commits only. Run `trail check` before the PR.
- Regenerate `COVERAGE.md` / `SPEC-HEALTH.md` at the end.

## Left to the builder

- Which TEST BU location and products to use (from what `data:reset` seeds). Read TEST BU's
  calculation method live.
- Page-object shape (reuse `tests/helpers/movement/ui.ts` or a new `inventory-adjustment.page.ts`).
- The exact API paths for on-hand, cost and movement reads (the 730 `byId` / `txOfDoc` helpers show
  some).
