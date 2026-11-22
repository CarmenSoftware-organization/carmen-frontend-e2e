# E2E catch-up — Phase 0 (measure) + Phase 1 (repair the existing suite)

Date: 2026-11-20 · Repo: `carmen-frontend-e2e` · Target app: `../carmen-frontend` @ `main`

## Intent / why

The existing specs no longer describe the app. Since the last full run (results in
`tests/results/`, 2026-10-15) the frontend has taken ~775 commits in November alone —
detail headers became PR-style document cards, audit footers, view-text in detail mode,
"one primary button per page", list columns sized by box width, and many module-level
changes. Test cases did not follow. The user wants the whole suite brought up to date
(option **B**: repair everything that exists, then add specs for every uncovered module).

B is several independent projects. Agreed order, one design + PR series per phase:

| Phase | Scope |
|---|---|
| **0** | Measure: reset data, run the full default suite once, triage every failure |
| **1** | Repair the existing 47 spec'd modules (this document) |
| 2 | New specs for money/stock flows: Accounting (AP invoice/payment/approvals, AR, JV, settings), inventory-adjustment, sales-consumption + import-pos, procurement `from-*` entry routes |
| 3 | Specs for the 40 modules that only have a hand-written catalog in `docs/test-cases/` (verify each catalog against the live app first — they are likely stale too) |
| 4 | Specs for the 12 new config master pages (cost-center, dimension, bank-account, wht-* …) using the `010-department` pattern |

Out of scope for all phases (builder's call, user may override): `/design-system`,
`/developers/api` (dev tools), `/login/callback` (needs real Google sign-in).

Phases 2–4 get their own brainstorm/design; this document covers **0 and 1 only**.

## Baseline (from the committed reports, generated 2026-11-04 — already stale, `--check` fails)

- `docs/test-cases/SPEC-HEALTH.md`: 1418 cases declared · 1174 running · 201 skipped ·
  43 fixme · **285 running cases with no assertion** · 25 trivial-only · **248 behind an
  in-body skip guard**.
- `docs/test-cases/COVERAGE.md`: 120 router modules → 47 spec · 40 catalog-only · 33 none.

Key finding: many specs guard with `if (!(await x.isVisible().catch(() => false))) test.skip();`.
When the UI changes and the element disappears, the test **skips green instead of failing** —
this is the main reason drift went unnoticed.

## Goals

1. Every case in the default run (`setup` + `login` + `chromium` projects) either passes
   against current `main`, or is deliberately marked (see failure policy) with a reason.
2. Visibility-based skip guards are gone: "can't find the element" is a failure.
3. Running cases with no assertion (285) and trivial-only assertions (25) get a real
   assertion on the outcome the test title claims.
4. Dormant cases (201 skip + 43 fixme) are re-evaluated: revived if the feature now exists,
   otherwise kept with an explicit reason string.
5. Opt-in suites (movement doc-flows `E2E_MOVEMENT=1`, period-close `E2E_PERIOD_CLOSE=1`)
   are repaired too, as the last group.
6. `COVERAGE.md` and `SPEC-HEALTH.md` regenerated and committed at the end of each PR.

## Non-goals

- New specs for uncovered modules (phases 2–4).
- Rewriting passing tests for style.
- Fixing app bugs found along the way (they are reported, not fixed here).

## Anti-goals (would be a failure even if everything is green)

- Making a test green by loosening it until it asserts nothing, or by adding a new skip.
- Rewriting an `expected` to match behaviour that is actually a bug.
- Parallel runs against the shared dev backend (`workers: 1` stays).

## Failure policy (decided by user: option ข)

For each failing case, classify:

1. **Intentional app change** — traceable to a FE/BE commit or PR (cite it in the commit
   message) → update locator / steps / `expected` (and the annotation) to current behaviour.
2. **Suspected bug** — no intentional change explains it → leave it failing as
   `test.fail(true, "<suspected bug: …>")` (so the suite stays green but flips loudly when
   the bug is fixed) and add it to the bug list delivered to the user at the end of Phase 1.
   The user decides each one (fix app / accept behaviour → update test).
3. **Environment / data** — missing seed data, wrong BU type → fix the data path
   (`data:reset` fixtures) or keep a *data* guard (`!hasData`, `!isAvg`) with a reason.

Skip guards: guards based on **element visibility** are removed (→ hard failure). Guards
based on **data or BU type** stay, with a reason string.

## Approach (decided: approach 2 — run all, cluster by cause, fix shared code first)

Alternatives considered:
- *Module-by-module in file order* — rejected: app-wide UI patterns would be patched
  differently in dozens of specs.
- *Parallel subagents per module* — rejected: `workers: 1` exists because roles share
  backend state and login is rate-limited; parallel runs on the shared dev DB give random
  red that can't be attributed.

### Phase 0 — measure

1. `bun run data:reset --yes` on TEST BU `GR2VYNKQ` (dev backend). Wipes that BU; the
   user confirmed nobody else uses it, so no per-run confirmation is needed. Needs
   `DATA_RESET_DEPLOY_TOKEN` in `.env.local`.
2. Run the default suite against local FE `:3000` → backend `:4000` (shared dev DB).
   Opt-in suites are run at the start of their own group in Phase 1, not here.
3. Produce a triage table (`docs/superpowers/specs/2026-11-20-e2e-catchup-triage.md`):
   one row per failing/skipped-by-guard case → spec, TC-ID, error excerpt, cluster
   (app-wide UI pattern / module-specific / suspected bug / env-data).
4. Regenerate `COVERAGE.md` / `SPEC-HEALTH.md` as the true starting numbers.

### Phase 1 — repair, as a PR series

- **PR 1 — shared layer:** `tests/pages/*`, `tests/helpers/*` updated for the app-wide
  patterns found in triage (document header card, audit footer, view-text, single primary
  button, list columns). Re-run all specs that import the touched page objects.
- **PR 2 — master data:** 010–083, 101–160, 1001 (config CRUD, vendor, price lists, campaign).
- **PR 3 — procurement:** 201, 301–312, 401–404, 501–502, 601–603.
- **PR 4 — inventory / store:** 701–730 incl. doc-flows (`E2E_MOVEMENT=1`, `@carmen.com`
  accounts, CARMEN-AVG/FIFO BUs).
- **PR 5 — period end / close:** 900–924 (`E2E_PERIOD_CLOSE=1`, one phase at a time).
  Period close changes real period state on the shared dev BUs — confirm before running.
- **Closing deliverable:** suspected-bug list (spec, TC-ID, what happens vs expected, repro).

Each group PR: the group's specs pass (or are marked per policy) in one run, and the
remove-visibility-guard / add-assertion / revive-dormant work for that group is in the
same PR.

## Constraints (repo rules — every PR)

- All 5 annotation fields on every `test(...)` / `test.skip(...)`; the pre/exp count audit
  in `CLAUDE.md` passes.
- `bun audit:tc-ids` passes. New TC-IDs follow `docs/test-id-scheme.md`.
- Any annotation change ⇒ `bun docs:user-stories` regenerated in the same commit.
- `bun test:unit` (vitest for scripts) stays green.
- Locators: `getByRole` first, `data-slot` when ambiguous; page objects expose locator
  factories, not stored locators.
- Commit messages in Thai; PR titles/bodies in English; merge with merge commit (no squash).
- Branch per PR off `main`.

## Decisions settled after review (author's calls — user may override)

- **Evidence for "intentional change":** a FE/BE commit or PR that touches the component /
  endpoint involved and whose message or diff explains the new behaviour (find via
  `git log -- <file>` / `git log -S` in `../carmen-frontend`). Cite it in the commit message.
  No such evidence after that look → suspected-bug list. The list is grouped by cluster
  so many cases with one cause read as one item, not hundreds.
- **TEST BU usage (user, 2026-11-20):** nobody else uses `GR2VYNKQ`. `data:reset --yes`
  may be run at the start of Phase 0 **and again before each group PR** without asking —
  every group starts from the standard dataset. (Period close on the movement BUs in PR 5
  still needs confirmation; that is not TEST BU.)
- **Backend lag (user chose: test against dev as deployed, don't deploy first):** before Phase 0, record the FE `main` SHA and the dev backend deploy
  state in the triage file. A failure caused by a merged-but-not-deployed BE change is
  classified **env-data (BE not deployed)**, not a bug.
- **No assertable outcome:** if the feature the case tests no longer exists → delete the
  case and say so in the PR. If the title is vague → rewrite title + annotation so it
  names a concrete outcome, then assert that. Never `fixme`/skip as an escape.
- **Mixed visibility/data guards:** if the standard `data:reset` dataset guarantees the
  data, the guard is removed (hard failure). If it doesn't, replace the visibility check
  with an explicit data precondition (row count / API check) and keep the skip with a reason.
- **Flakiness:** a failing case may be re-run once in isolation. Fails again → classified
  normally. Passes on re-run but failed in the group run → listed as *flaky* in the PR
  body; no retries config and no quarantine.
- **Phase 0 is its own PR:** triage file + regenerated `COVERAGE.md` / `SPEC-HEALTH.md` +
  the refreshed `tests/results/*.json` (tracked in git — the run overwrites them; that's
  intended).
- **PR 1 and opt-in specs:** page-object changes in PR 1 are validated against the default
  run only. Opt-in specs (movement / period-close) are validated in PR 4 / PR 5.

## Left to the builder

- Exact clustering and how to split a group PR if it grows too big.
- Assertion choice for each no-assert case (must match the title's claim).
- Whether a stale dormant case is revived, rewritten, or deleted (deletion only when the
  feature it tests no longer exists in the app — note it in the PR).
