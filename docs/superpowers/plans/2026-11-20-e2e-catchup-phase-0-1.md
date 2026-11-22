# E2E catch-up Phase 0 + 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Measure how far the existing Playwright suite has drifted from `carmen-frontend@main`, then repair every existing spec so it passes against the current app or is deliberately marked — one PR per group.

**Architecture:** Phase 0 runs the full default suite once on a freshly reset TEST BU and produces a triage table that clusters every failure by cause. Phase 1 fixes the shared page objects/helpers first (app-wide UI patterns), then repairs specs group by group (master data → procurement → inventory/movement → period close), each group starting from `data:reset`. The deliverable here *is* test code, so every task's "verification" is a real Playwright run.

**Tech Stack:** Playwright, TypeScript, bun, vitest (scripts only).

**Spec:** `docs/superpowers/specs/2026-11-20-e2e-catchup-phase-0-1-design.md` — read it first; the failure policy and "Decisions settled after review" section govern every judgement call below.

## Global Constraints

- Failure policy (spec §Failure policy): intentional change (cite FE/BE commit) → update test · suspected bug → `test.fail(true, "suspected bug: <one line>")` + add to bug list · env-data → fix data path or keep a *data* guard with reason · BE merged-but-not-deployed on dev → class **env-data (BE not deployed)**, `test.fail(true, "BE not deployed on dev: <PR>")`.
- Remove every `isVisible()`-based `test.skip()`. Keep only data/BU-type guards, each with a reason string. Never add a new skip/fixme as an escape.
- Feature gone from app → delete the case, list it in the PR body. Vague title → rewrite title + annotation to a concrete outcome, then assert it.
- `workers: 1` and `retries: 0` stay. A failing case may be re-run once in isolation; pass-on-rerun → list as *flaky* in PR body.
- Every `test(...)` / `test.skip(...)` carries all 5 annotations (`preconditions`, `steps`, `expected`, `priority`, `testType`).
- Before each commit that touches specs: pre/exp count audit (CLAUDE.md loop) prints nothing · `bun audit:tc-ids` passes · `bun test:unit` passes · if any annotation changed, `bun docs:user-stories` regenerated **in the same commit**.
- End of each PR: `bun audit:coverage` + `bun audit:spec-health` regenerated and committed.
- `bun run data:reset --yes` (TEST BU `GR2VYNKQ`) runs at Phase 0 start and before each group — no confirmation needed (user, 2026-11-20). Period close (Task 5) needs user confirmation before the first run.
- Backend: test against dev as deployed (`:4000` → shared dev DB). Do not deploy anything.
- Branch per PR off `main` · commit messages Thai · PR title/body English · merge with merge commit (`gh pr merge --merge`), never squash.
- Locators: `getByRole` first, `data-slot` when ambiguous; page objects expose locator factories (arrow functions), never stored `Locator`s.
- Run with `bun run test` (never bare `bun test`).

## Review Focus

1. **Removed visibility guard on a page that legitimately has no rows** (dataset doesn't seed that entity) → test must fail with a clear message pointing at missing data, not a locator timeout. Owning tasks 2–5: when removing a guard, check `scripts/data-reset/` seeds the data; if not, replace with an explicit data precondition (see spec).
2. **`test.fail` marks hiding a later fix** → when the app is fixed the case flips red ("expected to fail but passed"). That is the intended signal; PR bodies must list every `test.fail` with its reason so nobody "fixes" it by deleting the mark.
3. **Deleted cases leave orphan TC-IDs** in `docs/user-stories/*.md` and the Sheet sync → regenerate user stories in the same commit; `bun audit:tc-ids` must pass.
4. **Page-object change in Task 1 breaks opt-in specs** (movement / period-close) that aren't in the default run → Task 1 PR body lists which opt-in specs import each touched page object; Tasks 4/5 re-validate them.
5. **Shared dev DB drift between runs** (another BE deploy mid-phase) → each group PR records the dev BE state it was validated against (same method as Task 0 Step 1).

---

### Task 0: Phase 0 — measure and triage

**Files:**
- Create: `docs/superpowers/specs/2026-11-20-e2e-catchup-triage.md`
- Modify (regenerated): `docs/test-cases/COVERAGE.md`, `docs/test-cases/SPEC-HEALTH.md`, `tests/results/*.json`

**Interfaces:**
- Produces: triage table with columns `| Spec | TC-ID | Error (≤1 line) | Cluster | Evidence |`, cluster ∈ `ui-pattern:<name>` · `module` · `suspected-bug` · `env-data` · `env-data:be-not-deployed`. The set of `ui-pattern:<name>` values is the work list for Task 1. Rows also cover every case currently behind a visibility skip guard (from SPEC-HEALTH), cluster as above.

- [ ] **Step 1: Branch + record versions**
  `git switch main && git pull && git switch -c chore/e2e-catchup-phase-0`. In the triage file header record: FE `main` SHA (`git -C ../carmen-frontend rev-parse --short HEAD`, after pulling `main`), e2e SHA, date, and dev backend state (latest successful Deploy Dev run of `carmen-turborepo-backend` via `gh run list -R CarmenSoftware-organization/carmen-turborepo-backend --workflow build.yml -L 1`, plus note "manual SSH deploys may not appear").
- [ ] **Step 2: Reset data**
  Run: `bun run data:reset --yes` · Expected: exits 0, `verify-dataset` prints no short rows. If 504, follow `scripts/data-reset/README.md` before continuing.
- [ ] **Step 3: Full default run**
  Run: `bun run test 2>&1 | tee /tmp/e2e-phase0.log` (projects `setup`, `login`, `chromium`; FE served by webServer on `:3000`). Expected: completes (failures are expected); `tests/results/*.json` rewritten.
- [ ] **Step 4: Triage**
  For every failed case and every case behind a visibility guard: one row in the triage table. Cluster app-wide causes under a shared `ui-pattern:<name>` (expect at least: `doc-header-card`, `audit-footer`, `view-text`, `single-primary-button`, `list-columns` — add others found). For `suspected-bug` vs intentional: look up `git -C ../carmen-frontend log --oneline -- <component file>`; cite the commit in Evidence.
  Add a summary block at the top: counts per cluster, per group (Tasks 2–5).
- [ ] **Step 5: Regenerate reports**
  Run: `bun audit:coverage && bun audit:spec-health` · then `bun audit:coverage:check && bun audit:spec-health:check` → both exit 0.
- [ ] **Step 6: Commit + PR**
  ```bash
  git add docs/superpowers/specs/2026-11-20-e2e-catchup-triage.md docs/test-cases/COVERAGE.md docs/test-cases/SPEC-HEALTH.md tests/results
  git commit -m "chore(e2e): วัดผลชุดเดิมกับ main ปัจจุบัน + ตาราง triage ตามสาเหตุ"
  ```
  Push, open PR "E2E catch-up Phase 0: baseline run + triage" with the summary block as body. **Stop and show the user the summary before Task 1** — the cluster list may change the Task 1 scope.

### Task 1: Shared layer — page objects/helpers for app-wide UI patterns (+ 001/002)

**Files:**
- Modify: `tests/pages/*.ts`, `tests/helpers/*.ts` — only those the Task 0 `ui-pattern:*` rows point to (expected: `base.page.ts`, `config-list.page.ts`, `page-form-crud.helper.ts`, `dialog-crud.helper.ts`, `list-row.ts`, document pages `purchase-request` / `purchase-order` / `grn` / `credit-note` / `store-requisition` / `stock-issue`)
- Modify: `tests/001-login.spec.ts`, `tests/002-spa-smoke.spec.ts`

**Interfaces:**
- Consumes: Task 0 `ui-pattern:*` clusters.
- Produces: one locator factory per pattern on the page object that owns it, named after the pattern, e.g. `docHeader: () => Locator`, `auditFooter: () => Locator`, `primaryAction: () => Locator`. Group tasks use these instead of inline locators. If a factory already exists, fix it in place — don't rename.

- [ ] **Step 1:** Branch `fix/e2e-shared-ui-patterns` off `main` (after Task 0 merged).
- [ ] **Step 2:** For each `ui-pattern:*` cluster, inspect the live element in `../carmen-frontend` source (component under `components/` or `routes/`) and update/add the factory. No spec-level edits except call-site swaps to the new factory.
- [ ] **Step 3: Verify** — run every default-run spec that imports a touched file: `bun run test -- <spec files>`. Expected: every row of Task 0 clustered `ui-pattern:*` for those specs now passes or has moved to another cluster (update the triage file).
- [ ] **Step 4:** Repair `001-login` / `002-spa-smoke` per the Global Constraints (`bun run test:login`, `bun run test -- 002-spa-smoke`). Expected: pass or marked per policy.
- [ ] **Step 5:** Run the commit gate (Global Constraints) · regenerate audits · commit `fix(e2e): page object รองรับ UI แบบใหม่ทั้งแอป (header การ์ด, audit footer, ปุ่มหลัก ...)` · PR body lists touched page objects → opt-in specs importing them (`grep -l` in `tests/*doc-flow*.spec.ts tests/9[1-2]*.spec.ts`).

### Group repair procedure (Tasks 2–5 each follow it with their own file set)

1. Branch `fix/e2e-<group>` off `main` (previous group merged).
2. `bun run data:reset --yes` → exit 0; record dev BE state in the PR body (Task 0 Step 1 method).
3. Run the group: command in the task. Compare with the triage rows for the group.
4. Per failing case apply the failure policy; remove visibility guards; for each no-assert / trivial-only case listed in `SPEC-HEALTH.md` for these specs, add an assertion on the title's outcome; revive or justify each `skip`/`fixme`.
5. Re-run the group → every case passes or is marked `test.fail` with reason. Re-run a single failing case once to detect flakiness.
6. Commit gate (Global Constraints) · `bun audit:spec-health` shows 0 no-assert and 0 visibility-guarded cases for this group's specs.
7. Commit (Thai message naming the group) → PR with: dev BE state, list of `test.fail` (reason + cluster), deleted cases, flaky cases, suspected bugs added.

### Task 2: Master data group

**Files:** `tests/0{10,20,29,30,31,32,40,41,42,43,44,79,80,81,82,83}-*.spec.ts`, `tests/1{01,10,11,21,31,50,59,60}-*.spec.ts`, `tests/1001-campaign.spec.ts`, `tests/helpers/security-cases.ts` (if its generated cases fail), their page objects.
**Run:** `bun run test -- "tests/(0[1-8][0-9]|1[0-6][0-9]|1001)-"` (`chromium` project; `001`/`002` already handled in Task 1).
- [ ] Follow the Group repair procedure, branch `fix/e2e-master-data`.

### Task 3: Procurement group (non-movement)

**Files:** `tests/201-*.spec.ts`, `tests/30[1-4]-*.spec.ts`, `tests/31[01]-*.spec.ts`, `tests/40[1-3]-*.spec.ts`, `tests/501-grn.spec.ts`, `tests/60[12]-*.spec.ts`, `tests/pages/{purchase-request,purchase-order,grn,credit-note,pr-template,my-approvals}.page.ts`, `tests/pages/{pr,po}-*.helpers.ts`.
**Run:** `bun run test -- "tests/(201|30[1-4]|31[01]|40[1-3]|501|60[12])-"`.
- [ ] Follow the Group repair procedure, branch `fix/e2e-procurement`.
- Note: role journeys (302–304, 402–403) share state in `serial` suites — a failure early in a serial suite masks later ones; fix in order and re-run the whole file.

### Task 4: Inventory/store group + all movement doc-flows

**Files:** `tests/70[1]-*.spec.ts`, `tests/71[01]-*.spec.ts`, `tests/720-*.spec.ts`, every `tests/*-doc-flow.spec.ts` (312, 404, 502, 603, 702, 721, 730), `tests/movement.setup.ts`, `tests/movement-users.ts`, `tests/helpers/movement/*`, `tests/pages/{store-requisition,stock-issue}.page.ts`.
**Run:** default specs `bun run test -- "tests/(701|71[01]|720)-"`; doc-flows `bun run test:movement` (opt-in project, `@carmen.com` accounts on CARMEN-AVG/FIFO — not TEST BU, `data:reset` doesn't cover them).
- [ ] Follow the Group repair procedure, branch `fix/e2e-inventory-movement`. All doc-flows live here (spec goal 5: opt-in suites last), including the procurement ones.

### Task 5: Period end / close group

**Files:** `tests/900-period-end.spec.ts`, `tests/9{10..24}-period-close-*.spec.ts`, `tests/helpers/period-close/*`, `tests/pages/period-end.page.ts`.
**Run:** `bun run test -- 900-period-end`; close phases one at a time: `bun run test:period-close -- <phase spec>` (see repo CLAUDE.md §Movement suite for phase order).
- [ ] **Step 0:** Ask the user to confirm before the first period-close run (changes real period state on the movement BUs).
- [ ] Follow the Group repair procedure, branch `fix/e2e-period-close`.

### Task 6: Close Phase 1

**Files:** Create `docs/superpowers/specs/2026-11-20-e2e-catchup-bug-list.md`.
- [ ] **Step 1:** Collect every `test.fail` with reason `suspected bug:` across Tasks 1–5, grouped by cause: `| Cause | Specs / TC-IDs | Actual vs expected | Repro | FE/BE suspect |`. Separate section: `BE not deployed on dev` marks (to remove after the next BE deploy).
- [ ] **Step 2:** `bun run data:reset --yes` then full default run `bun run test` → zero unexpected failures. Regenerate audits; record final SPEC-HEALTH numbers vs Task 0 baseline at the top of the bug list.
- [ ] **Step 3:** Commit `docs(e2e): สรุปบั๊กที่ e2e พบ + ตัวเลขก่อน/หลังเฟส 1` · PR · hand the bug list to the user for per-item decisions.
