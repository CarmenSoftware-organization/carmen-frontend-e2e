# E2E period-close on the TEST BUs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run the 13 period-close phases (910–924) on the three TEST BUs from a `data:reset --with-history` start, repeatable with no hand-written scenario.

**Architecture:** `data:reset --bu <BU> --with-history` opens last month as the first (active) period, tops up the open periods, seeds dedicated `E2E-PC-*` master data and dates the normal seed in the period that covers today. The period-close helpers build their scenario from `E2E_PERIOD_BU` + today (period = last month, next = this month). The phases then run as gmail `TEST_USERS` and close last month, which leaves the BU in its normal shape.

**Tech Stack:** Bun (data:reset scripts), Playwright + TypeScript (specs), dev backend REST, read-only Postgres via `scripts/db-query.ts`.

**Spec:** `docs/superpowers/specs/2026-11-24-e2e-period-close-on-test-bus-design.md`

## Global Constraints

- Branch `test/e2e-period-close-test-bu` in `carmen-frontend-e2e`. Commit messages in Thai. No push or PR until the user says so.
- TEST BUs only: `BU-GR2VYNKQ` (average) · `BU-96EAT3GX` (fifo) · `BU-0706T34Y` (average_per_location), from `TEST_BUS` in `tests/test-users.ts`. Never write to CARMEN-AVG / CARMEN-FIFO.
- A plain `data:reset` (no `--with-history`) must behave exactly as today.
- `--with-history` is refused with `--bu all`, and refused without an explicit `--bu`.
- Case IDs `TC-PE-*` and what each case asserts stay the same. Only data, dates, accounts, BU and gates change.
- **Per user preference: no new `*.test.ts` / `*.spec.ts` unit files, and no "write failing test" steps.** Verify with `bunx tsc --noEmit` and with the real runs in Tasks 1, 7 and 8.
- Live-run tasks write real data to the dev backend. Run them only on the TEST BU the task names, and only after a reset of that BU.
- Don't touch the unrelated dirty files in the working tree (`.cursor/`, `.gemini/`, `opencode.json` …).

## Review Focus

- A run started on the 1st or 2nd of the month (Bangkok): `requireScenario()` must refuse with the reason, never date next-period docs after today (Task 3).
- A period-close run on a BU that was reset **without** `--with-history`: the irreversible steps must skip, not close this month (Task 4, check `active period === SCN.period`).
- A December run: period = `YY11`… and January: last month is December of the previous year. Fiscal year/month roll over in `planHistoryPeriod` and `scenarioFor` (Tasks 1 and 3, checked with `bun -e` one-liners in the verify step).
- Evidence from a previous run of the same BU + period: a fresh `--with-history` must clear it, or `prevRecord` skips steps that never ran on this tenant (Task 2).
- `E2E_PERIOD_BU` set to a code outside `TEST_BUS`: the fixture refuses before any request (Task 4).

---

### Task 1: `--with-history` period step + live probe (STOP gate)

**Files:**
- Modify: `scripts/data-reset/cli.ts` (flag `--with-history` → `ResetArgs.withHistory: boolean`; refuse with `--bu all` or with no `--bu`; help text)
- Modify: `scripts/data-reset/period.ts` (`planHistoryPeriod`, `seedPeriod(..., opts?: { withHistory?: boolean })`)
- Modify: `scripts/data-reset/index.ts:174` (pass `withHistory`)
- Create: `scripts/movement/probe-period-history.ts` (read + small writes, the probe of design §0)

**Interfaces:**
- Produces: `ResetArgs.withHistory: boolean`
- Produces: `planHistoryPeriod(now: Date): { fiscal_year: number; fiscal_month: number; start_at: string }`, the Bangkok month before `now` (January → December of year−1), `start_at` = `YYYY-MM-01`
- Produces: `seedPeriod(sessions, cfg, now, opts?: { withHistory?: boolean }): Promise<StepResult>`. With history: POST last month (the BU is empty after the reset), then call generate until an open period covers today **and** next month exists. Verify by reading back: `inventory-periods/current` = last month, an open period covers today. Without history: unchanged.

- [ ] **Step 1:** Implement the flag in `cli.ts`. Error text for misuse: `--with-history needs one --bu <code> (not all): each BU needs its own period-close run`.
- [ ] **Step 2:** Implement `planHistoryPeriod` and the history branch of `seedPeriod`. Reuse `listPeriods` / `seedNextPeriod`, and loop the generate call until the coverage condition holds (cap 3 calls, then fail the step).
- [ ] **Step 3:** Type-check. Run: `bunx tsc --noEmit`. Expected: no errors. Then check the roll-over: `bun -e 'import("./scripts/data-reset/period.ts").then(m=>console.log(m.planHistoryPeriod(new Date("2027-01-10T05:00:00Z")), m.planHistoryPeriod(new Date("2026-11-24T05:00:00Z"))))'`. Expected: `{fiscal_year:2026,fiscal_month:12,start_at:"2026-12-01"}` and `{2026,10,"2026-10-01"}`.
- [ ] **Step 4:** Write `probe-period-history.ts` (args `--bu`). For each check it prints `PASS/FAIL <check> <evidence>`:
  1. `GET inventory-periods/current` = last month, and an open period covers today.
  2. Via API as admin: a GRN dated last month 15th commits. A GRN dated today saves and commits. A Stock In dated today saves. Record the status codes.
  3. Via SQL (`E2E_DB_URL`, `schemaOf(bu)`): `select count(*) from <schema>.tb_inventory_period`. This proves the URL reaches the schema.
  4. gmail Requestor / HOD / FC: read `GET /api/<bu>/...` permission/profile and list the SR workflows with an Issue stage (workflow stages contain role `issue`).
  It does not check the date picker (that is step 6, by eye).
- [ ] **Step 5:** Live: `bun run data:reset --yes --bu BU-96EAT3GX --with-history`, then `bun run scripts/movement/probe-period-history.ts --bu BU-96EAT3GX`. Expected: reset exit 0, probe prints PASS for 1–4.
- [ ] **Step 6:** Open `/inventory-management/stock-in/new` on BU-96EAT3GX as gmail admin (claude-in-chrome or headed Playwright). Confirm the date picker allows a date in last month. Record what you see.
- [ ] **Step 7: STOP.** Report the probe output to the user. If check 1 or 2 fails, stop the plan: the design does not hold. If 3 or 4 fails, say which piece must be seeded or granted, and wait for the user.
- [ ] **Step 8:** Commit: `git add scripts/data-reset/cli.ts scripts/data-reset/period.ts scripts/data-reset/index.ts scripts/movement/probe-period-history.ts && git commit -m "feat(data-reset): --with-history เปิดงวดเดือนก่อนเป็นงวดแรก + สคริปต์ probe ของชุดปิดงวด"`

### Task 2: Seed dates, period-close master data, evidence reset

**Files:**
- Modify: `scripts/data-reset/docs/stock.ts:44`, `scripts/data-reset/docs/pos.ts:74` (date by the open period covering today, not `current`)
- Create: `scripts/data-reset/docs/period-close.ts`
- Modify: `scripts/data-reset/index.ts` (run `seedPeriodClose` only with `withHistory`, and clear evidence)
- Modify: `scripts/data-reset/verify-dataset.ts` (verify `E2E-PC-*` when `withHistory`)

**Interfaces:**
- Consumes: `ResetArgs.withHistory` (Task 1)
- Produces: `openPeriodCovering(admin, buCode, day: string): Promise<{ start_at: string; end_at: string } | null>` in `period.ts`. It replaces the two `current` reads.
- Produces: `PC_PRODUCTS = ["E2E-PC-1","E2E-PC-2","E2E-PC-3","E2E-PC-4"] as const`, `PC_SPARE = "E2E-PC-X"`, `seedPeriodClose(ctx): Promise<StepResult>`. It copies the products from the template product the way `doc-flow.ts` does, links them to the **first** inventory location only, and creates no stock.
- Produces: the evidence path `runs/period-close/<BU>/<period>/`. On a `--with-history` reset, `seedPeriodClose` deletes `runs/period-close/<BU>/` (local files only).

- [ ] **Step 1:** Implement `openPeriodCovering` and switch stock.ts / pos.ts to it. In normal mode it returns the same period as `current`.
- [ ] **Step 2:** Implement `period-close.ts`, modelled on `docs/doc-flow.ts` (template copy, location link, skip if it exists).
- [ ] **Step 3:** Wire into `index.ts` after the doc-flow seed and add the verify rows.
- [ ] **Step 4:** Run `bunx tsc --noEmit` (expected: clean) and `bun run data:reset --dry-run --bu BU-96EAT3GX --with-history` (expected: prints the period-close seed step, and writes nothing).
- [ ] **Step 5:** Live: `bun run data:reset --yes --bu BU-96EAT3GX --with-history`. Expected: exit 0, verify-dataset lists `E2E-PC-1..4`, `E2E-PC-X` at the first location, and the seeded stock documents are dated in this month.
- [ ] **Step 6:** Commit: `git commit -m "feat(data-reset): seed สินค้า E2E-PC ของชุดปิดงวด และลงวันที่เอกสาร seed ในงวดที่ครอบวันนี้"`

### Task 3: Scenario from BU + date

**Files:**
- Modify: `tests/helpers/period-close/scenarios.ts` (replace fixed records P09/P10/P11/AVG2607/AVG2612 with a builder)

**Interfaces:**
- Produces: `scenarioFor(bu: TestBuCode, today: string /* YYYY-MM-DD Bangkok */, loc: { code: string; name: string }): Scenario`. `Scenario.method` widens to `"fifo" | "average" | "average_per_location"`. `period` = last month `YYMM`, `next` = this month, `periodEnd` = last day of last month, `descPeriod` = `YYYY-MM` of last month.
- Produces: `SCENARIO_SET = Boolean(process.env.E2E_PERIOD_BU)`, `SCN`, `PERIOD`, `NEXT`, `P` (codes `E2E-PC-1..4`), `PX` (`E2E-PC-X`). `L` is no longer a constant: `SCN.location`.
- Produces: `scenarioTooEarly(today: string): string | null`, which returns the reason when the Bangkok day is < 3.

- [ ] **Step 1:** Build the AVG layout from `avgPeriod` (same days and prices; next-period docs on days 1/2/3 of `next` instead of 10/12/15). Build the FIFO layout from `P11`, with the same day mapping. `average_per_location` uses the AVG layout. Drop `preBlockers` and `preClean`, and set `preCleanAuto: false`. `cnReason` is no longer static: `""`, filled at runtime (Task 4).
- [ ] **Step 2:** `SCN` = `scenarioFor(E2E_PERIOD_BU ?? BU_CODE, today, loc)`. `loc` comes from a sync read of `runs/period-close/<BU>/location.json`, which Task 4's `beforeAll` writes. Before it exists, `--list` uses a placeholder `{ code: "?", name: "?" }`.
- [ ] **Step 3:** Run `bunx tsc --noEmit`. Expected: the only errors are in files Task 4/5 change. List them in the report. Check dates: `E2E_PERIOD_BU=BU-96EAT3GX bun -e '…scenarioFor("BU-96EAT3GX","2027-01-05",{code:"L",name:"L"})…'`. Expected: period `2612`, next `2701`, nextGrn date `2027-01-01`.
- [ ] **Step 4:** Commit: `git commit -m "test(period-close): scenario คำนวณจาก BU + วันที่ แทนรอบที่เขียนมือ"`

### Task 4: Context, fixture, accounts and gates

**Files:**
- Modify: `tests/helpers/period-close/context.ts`
- Modify: `playwright.config.ts:40-136` (`period-close` depends on `setup`, the `movement-setup` project goes, comment drops CARMEN wording)
- Modify: `tests/movement-users.ts` docstring only if needed (it stays: `scripts/movement/*` and `movement.setup.ts` still import it)

**Interfaces:**
- Consumes: `SCN`, `scenarioTooEarly` (Task 3)
- Produces: `PC_USERS: Record<"admin"|"requestor"|"hod"|"fc", { email: string; password: string }>`, mapped from `TEST_USERS` roles Admin / Requestor / HOD / FC. The `test` fixture's `storageState` uses `authFile(PC_USERS[user].email)` from the normal `setup` project.
- Produces: `requireScenario()` throws when `E2E_PERIOD_BU` is unset, when it is not in `TEST_BUS`, or when `scenarioTooEarly` returns a reason. It also checks `calculation-method` of the BU = `TEST_BUS` method, then writes `location.json` (first inventory location) and resolves `SCN.cnReason` (first active CN reason of the BU).
- Produces: `irreversibleAllowed(period: string): Promise<boolean>`, true when BU ∈ `TEST_BUS` and `currentPeriod(BU) === period`. It is async now, so update the 6 call sites in 918/921/924. `irreversibleSkip(what)` text: `irreversible: ${what} — BU active period is not ${SCN.period}; run data:reset --bu ${BU} --with-history first`.
- Produces: `gatePhase({ dates })` skips only when today < period start.
- Produces: `EVIDENCE_DIR = runs/period-close/<BU>/<period>` (Task 2 clears the parent).

- [ ] **Step 1:** Implement the items above. Remove `E2E_ALLOW_IRREVERSIBLE` from code and `.env.example`.
- [ ] **Step 2:** Run `bunx tsc --noEmit`. Expected: the remaining errors are only in the spec files of Task 5.
- [ ] **Step 3:** Run `E2E_PERIOD_CLOSE=1 E2E_PERIOD_BU=BU-96EAT3GX bunx playwright test --project=period-close --list`. Expected: 13 files listed, setup is the dependency, and no movement-setup.
- [ ] **Step 4:** Commit: `git commit -m "test(period-close): ใช้บัญชี gmail + BU จาก E2E_PERIOD_BU, ด่าน irreversible ผ่านเมื่องวดปัจจุบันตรง scenario"`

### Task 5: Phase specs follow the new data

**Files:**
- Modify: `tests/911-period-close-blockers.spec.ts` (create its own blockers)
- Modify: `tests/917-period-close-new-rules.spec.ts` (gmail requestor email in SQL. Workflow, locations and product from the BU, not `TEST-MOVE` / `T-01-A` / `T-01-F`)
- Modify: every spec in `tests/9*-period-close-*.spec.ts` plus `tests/helpers/period-close/count.ts`, wherever they name `1AG01`, `*@carmen.com`, CARMEN-AVG/FIFO or `E2E_PERIOD_SCENARIO`

**Interfaces:**
- Consumes: `PC_USERS`, `SCN.location`, `SCN.cnReason`, async `irreversibleAllowed` (Task 4)
- Produces: in 911, `createBlockers(page): Promise<{ soDrafts: DocRef[]; srInProgress: DocRef[] }>`. Create via API (an SO draft dated in the period, and an SR submitted to the HOD stage by PC_USERS.requestor). The steps the case asserts on (dialog, delete, HOD reject) stay in the UI, as today, with `PC_USERS.hod` as approver.

- [ ] **Step 1:** 911: replace the `preBlockers` read with `createBlockers`, and drop the "no scenario names it → skip" path.
- [ ] **Step 2:** 917: SR workflow = the BU's SR workflow whose stages include Issue (found by stage, as `srIssueWorkflowName` does today). Source/consume = the BU's first two inventory locations. Product = `E2E-PC-X`. Requestor email from `PC_USERS.requestor`.
- [ ] **Step 3:** Update every annotation (`preconditions` / `steps` / `note`) that names the old BU, accounts, location or products, so it reads as TEST BU + gmail + `E2E-PC-*`. Run: `grep -nE "1AG01|T-01-[AF]|TEST-MOVE|TEST-CONSUME|@carmen\.com|CARMEN-(AVG|FIFO)|E2E_PERIOD_SCENARIO|E2E_ALLOW_IRREVERSIBLE" tests/9*-period-close-*.spec.ts tests/helpers/period-close/`. Expected: no hits (a hit inside a historical "เดิม …" origin note is fine. Say so in the report).
- [ ] **Step 4:** Run `bunx tsc --noEmit`. Expected: clean.
- [ ] **Step 5:** Commit: `git commit -m "test(period-close): 911 สร้างเอกสารขวางเอง, 917 ใช้ workflow/คลัง/สินค้าของ TEST BU, annotation ตามข้อมูลใหม่"`

### Task 6: Docs

**Files:**
- Modify: `README.md` (rows `test:period-close`, `E2E_PERIOD_SCENARIO` → `E2E_PERIOD_BU`, drop `E2E_ALLOW_IRREVERSIBLE`, `E2E_DB_URL` is required for period-close)
- Modify: `scripts/data-reset/README.md` (`--with-history`, run order of design §6)
- Modify: `docs/test-id-scheme.md:73` (phases run on TEST BUs)
- Regenerate: `bun run docs:user-stories`

- [ ] **Step 1:** Write the docs. Run order, verbatim from design §6:
  ```
  bun run data:reset --yes --bu BU-96EAT3GX --with-history
  E2E_PERIOD_BU=BU-96EAT3GX bun run test:period-close -- tests/910-…   # then 911 … 924 one at a time, or the whole project
  ```
- [ ] **Step 2:** Run `bun run docs:user-stories`. Expected: the user-story files of 910–924 change, and nothing outside them.
- [ ] **Step 3:** Commit: `git commit -m "docs(e2e): วิธีรันชุดปิดงวดบน TEST BU และ data:reset --with-history"`

### Task 7: Full live run on FIFO

- [ ] **Step 1:** `bun run data:reset --yes --bu BU-96EAT3GX --with-history`. Expected: exit 0.
- [ ] **Step 2:** `E2E_MOVEMENT_STRICT=1 E2E_PERIOD_BU=BU-96EAT3GX bun run test:period-close -- tests/910-period-close-prestep.spec.ts`, then each phase in file order through 924, one command per file. Expected: every case passes, or is a `test.fail` pin the spec already carries. No skips under strict mode.
- [ ] **Step 3:** For each failure: use superpowers:systematic-debugging and decide whether it is test data, the new code, or a product bug. Fix the first two in the owning file and re-run from that phase (reset first if the phase is past Start / Close). Product bugs: record them in `docs/superpowers/specs/2026-11-24-e2e-period-close-bug-list.md` with case ID + evidence, and stop to ask the user before pinning.
- [ ] **Step 4:** After 924, check that `GET /api/BU-96EAT3GX/inventory-periods/current` = this month and that ≥ 12 open periods exist. Record the result.
- [ ] **Step 5:** Commit any fixes: `git commit -m "test(period-close): แก้ตามผลรันจริงบน TEST BU (FIFO)"`

### Task 8: Live run on AVG and AVG-LOCATION + main-suite spot check

- [ ] **Step 1:** Repeat Task 7 steps 1–4 for `BU-GR2VYNKQ`, then for `BU-0706T34Y`.
- [ ] **Step 2:** On `BU-GR2VYNKQ` after its 924: `bunx playwright test --project=chromium tests/900-period-end.spec.ts tests/750-physical-count.spec.ts tests/201-*.spec.ts`. Expected: pass with no extra reset. If 750 has another file name, use `ls tests | grep 750`.
- [ ] **Step 3:** Commit fixes: `git commit -m "test(period-close): แก้ตามผลรันจริงบน TEST BU (AVG / AVG-LOCATION)"`. Report to the user the pass counts per BU, the bug list, and that the branch is unpushed.
