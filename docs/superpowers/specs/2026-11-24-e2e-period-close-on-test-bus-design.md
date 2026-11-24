# E2E period-close on the TEST BUs — design

Date: 2026-11-24 · Repo: `carmen-frontend-e2e` · Branch: `test/e2e-period-close-test-bu`
Follows: `2026-11-24-e2e-doc-flow-on-test-bus-design.md` (PR #106, which named this project as next)

## Intent

The period-close phases `910`–`924-period-close-*.spec.ts` (13 files, ~76 cases) still run on
CARMEN-AVG / CARMEN-FIFO with the `*@carmen.com` movement accounts and hand-written scenarios
(`p09`…`p11`, `avg2607`, `avg2612`). Every scenario was a one-shot: a period closed on those BUs
cannot be reopened, so each round needed a new scenario and a BU that had moved on.

The user wants every e2e spec on a BU that `data:reset` controls (decision 2026-11-23). On the TEST
BUs a reset wipes the tenant schema, so closing a period is no longer irreversible: reset → run →
reset again gives the same starting state every time.

## Goals

- All 13 period-close phases run on the three TEST BUs, one BU per run:
  TEST BU (AVG) `BU-GR2VYNKQ` · TEST BU (FIFO) `BU-96EAT3GX` · TEST BU (AVG-LOCATION) `BU-0706T34Y`.
- The run is repeatable: `data:reset --bu <BU> --with-history` → the 13 phases in order → done, with
  no hand-written scenario per round.
- After a full run the active period is this month again. The main `chromium` suite needs a normal
  `data:reset` of that BU first, because `--with-history` seeds no documents (user ruling 2026-11-24,
  below).
- Gmail `TEST_USERS` replace the movement accounts.

## Non-goals

- Changing what the phases assert (case IDs `TC-PE-*`, oracles, sections 40–54 stay). Only data,
  dates, accounts, BU and gates move.
- `900-period-end.spec.ts` (runs in `chromium`, not part of this suite).
- Running the period-close project inside the normal `chromium` run — it stays opt-in
  (`E2E_PERIOD_CLOSE=1`), one BU at a time.
- Keeping CARMEN-AVG / CARMEN-FIFO support. The old scenarios stay in git history only.

## Anti-goals

- A plain `data:reset` (no flag) that behaves differently from today — the main suite depends on
  the current period being this month.
- Posting any period-close document into CARMEN-AVG / CARMEN-FIFO or any BU outside `TEST_BUS`.
- Cases silently skipping because the new environment misses a gate. A gate the TEST BU should
  meet must pass, or the run fails under `E2E_MOVEMENT_STRICT=1`.

## Constraints (facts from the code / backend)

- **The active period is the oldest open/locked period**, not the one today falls in
  (`919` tests this; `data:reset` README §period).
- **A period can be created by hand only while the BU has none.** After that, periods only come from
  `POST /inventory-periods/next` (generate) or from closing a period, which tops open periods back up
  to 12 (backend, learning 2026-11-13). Right after a reset the BU is empty, so creating a past
  month first is allowed.
- `data:reset` today (`scripts/data-reset/period.ts`) creates the period covering today plus next
  month, and dates seeded stock documents on the **first day of the current period**
  (`inventory-periods/current`).
- FE caps SI/SO dates at min(today, period end) (FE `90018c6d`) — a past period can be dated into;
  a document dated after today cannot be entered through the UI.
- `gatePhase({ dates: true })` in `tests/helpers/period-close/context.ts` skips when the period
  under test does not contain today. With a past period under test that gate is wrong and must change.
- The phases hand documents to each other via `state.json` + `results.json` and skip steps a previous
  run already passed (`prevRecord`). After a reset these records are stale.
- SQL checks read the tenant schema (`schemaOf(bu)`, read-only, `E2E_DB_URL`).
- `estimate.ts` already handles `average_per_location`.

## Approaches

**Where the period history comes from** (user picked ก on 2026-11-24):
- ก. data:reset creates a past period so the suite closes a past month while today's month stays
  open. **Picked.**
- ข. Close this month's period for real and reset after every run. Rejected: the main suite breaks
  until the next reset, and the two suites can never interleave.

**How ก is triggered** (user picked 1 on 2026-11-24):
1. Opt-in flag `data:reset --bu <BU> --with-history`: first period = last month, the active period
   lags today by one month. The suite closes last month, the active period becomes this month, and
   the BU is back to the normal shape. **Picked.** Cost: one period-close run per reset.
2. Every reset starts at last month. Rejected: the main suite would see last month as the current
   period until a period-close run happens. Specs that read the current period (900, physical count,
   seeds dated on its first day) would drift.

**Scenarios**: computed from today's date and the BU's costing method (period = last month,
next = this month), not hand-written per round. Builder's call (see below), proposed to the user
2026-11-24.

## Design

### 1. `data:reset --with-history`

- Valid only with `--bu <one TEST BU>` (refuse `--bu all` + `--with-history`: each BU then needs its
  own period-close run, and a forgotten BU would leave the main suite seeing a lagging period).
- Period step: after the reset the BU is empty, so `POST /inventory-periods` for **last month**
  (Bangkok calendar), then generate until open periods cover this month and next month (the backend
  tops up to 12 after a close anyway). Verify: the active period is last month, and an open period
  covers today.
- Without the flag: unchanged.
- **Seeds no documents of the normal dataset** (PR/PO/GRN/CN/SR/stock/POS/IA/AP …): master data,
  accounting setup and roles only, plus §3. User ruling 2026-11-24 after the Task 1 probe: CN can
  only be dated inside the active period (422 "dated inside the current period (2610)"), the UI date
  picker offers only the active period's days, and seeded open documents in last month would block
  Start / Close of the suite itself. Cost: a normal reset before the main suite.
- Seeds the period-close master data (§3).

### 2. Scenario from date + BU

`tests/helpers/period-close/scenarios.ts` keeps the `Scenario` type and replaces the fixed records
with one builder: `scenarioFor(buCode, today)`.
- BU picked by env `E2E_PERIOD_BU` (one of `TEST_BUS`). `E2E_PERIOD_SCENARIO` is removed. Without
  `E2E_PERIOD_BU`, `requireScenario()` fails, as now.
- `method` comes from the BU (`average` / `fifo` / `average_per_location`), read once from
  `GET /inventory-transactions/calculation-method` and checked against what `TEST_BUS` says.
- `period` = last month (`YYMM`), `next` = this month, `periodEnd` = last day of last month.
- Document days inside the period stay as `avgPeriod` places them (5, 12, 14, 18, 20, 22, 25, 26).
  Next-period documents (today on days 10 / 12 / 15) move to days **1 / 2 / 3** of this month. They
  keep their order and never fall after today. `requireScenario()` refuses a run before the 3rd
  (Bangkok) with that reason, rather than collapsing them onto one date.
- FIFO keeps the `P11` trap layout. The five `E2E-PC-*` products sit at one location only, so the
  "no shared products at L" assumption holds by construction. With a single location,
  average-per-location equals the average, so AVG-LOCATION runs the AVG layout and trap cases
  unchanged, and expected values still come from `estimate.ts` with the BU's method.
- The FIFO price/trap layout comes from the latest FIFO scenario (`P11`), the AVG layout from
  `avgPeriod`. AVG-LOCATION uses the AVG layout; expected costs that differ by method go through
  `estimate.ts` (`period-average` / `posted`), never through hard-coded numbers that only fit one
  method.
- `preBlockers` / `preClean` are dropped: a freshly reset BU has no leftovers. 911 creates its own
  blockers (an SO draft and an SR waiting for HOD) at the start of the phase instead of reading
  numbers from the scenario. This makes 911 run every time; today it is always skipped.

### 3. Master data the phases need

Seeded by `--with-history` on the BU, with codes that no other spec uses:
- Products `E2E-PC-1` … `E2E-PC-4` (P1–P4) and `E2E-PC-X` (PX), no history before the run.
- A price-test location for `L` (today `1AG01` "A&G-Accounting"): use the first inventory location
  the reset creates, linked to the five products. Its code goes into the scenario.
- `917`: SR workflow create > approve (HOD) > issue > approve, a source / consume location pair, and
  one product per method (today `TEST-MOVE` / `TEST-CONSUME`, `T-01-A` / `T-01-F`). Reuse what the
  doc-flow seed (`E2E-DF-*`, SR workflow of 702/721) already creates where it fits. Otherwise seed
  the missing pieces.
- CN reason: read from the BU (first active), not hard-coded per BU.

### 4. Accounts and fixture

- `admin` → `carmensoftware.dev+admin@gmail.com`. `requestor` / `hod` / `fc` → the matching gmail
  roles in `tests/test-users.ts`. storageState comes from the normal `setup` project. The
  `movement-setup` project and `tests/movement-users.ts` go once nothing imports them.
- The `period-close` project depends on `setup` instead of `movement-setup`.
- SQL that names `requestor@carmen.com` (917) reads the gmail email instead.
- `movement.fixture.ts` default `bu` becomes the scenario BU. A guard refuses any BU outside
  `TEST_BUS`.

- 921 counts **every** location of the count round, as today: Close requires all of them. Locations
  from the normal seed hold no stock in last month (their documents are dated this month), so they
  count at the system quantity, zero. No narrowing of the count.

### 5. Gates

- `gatePhase({ dates })`: pass when today ≥ the period start (period under test is not in the
  future). Skip only for a future period.
- Irreversible steps (918 Start, 921, 924 Close): `irreversibleAllowed` is true when the BU is in
  `TEST_BUS` **and** the BU's active period equals the scenario period. Elsewhere it is false, and
  `E2E_ALLOW_IRREVERSIBLE` goes away. The second check stops a run that was not preceded by
  `--with-history` from closing this month.
- `state.json` / `results.json` of the period-close run are keyed by BU + period. A
  `--with-history` reset of a BU clears that BU's records, so `prevRecord` never skips a step that
  ran before the reset.

### 0. Live probe first (STOP gate, before any other task)

The approach rests on backend behaviour that no code in this repo proves. The first plan task probes
it on **one** TEST BU (FIFO `BU-96EAT3GX`, the strictest), right after a plain reset, and stops the
plan if any answer is no:
1. Empty BU: `POST /inventory-periods` with last month's start is accepted, and `/next` / generate
   continues from the last existing period, not from today.
2. With last month active: GRN / Stock In / SR / CN dated last month commit, **and** documents dated
   this month (seeds, "next" docs) save and commit, or are refused exactly as the phases expect
   (917 asserts that next-period documents post no stock yet).
3. The FE date picker on GRN / SI / SO / CN allows a date inside last month while it is the active
   period. Documents the UI cannot date go through the API, as 917 already does for next-period SI.
4. `E2E_DB_URL` reaches the three TEST BU schemas and `schemaOf(bu)` names them right.
5. The gmail Requestor / HOD / FC accounts hold the rights the phases use (PR/PO/SR create, GRN/CN,
   HOD approve, SR Issue stage, Stock In/Out), and a TEST BU workflow has an SR Issue stage.
   doc-flow 702/721 already passed with these accounts on TEST BU (AVG), so this is a check, not a
   seeding project. Seed or grant what is missing on the BUs where it is missing.

If 1 or 2 fails, the "active period lags one month" design does not hold. Come back to the user
before planning further. `E2E_DB_URL` is a documented prerequisite of the suite, not a silent skip.

### 6. Run order (docs + package script)

```
bun run data:reset --yes --bu BU-96EAT3GX --with-history
E2E_PERIOD_BU=BU-96EAT3GX bun run test:period-close -- tests/910-…   # then 911 … 924 one at a time, or the whole project
```

Repeat per BU. README, the data:reset README and `docs/test-id-scheme.md` are updated. The
playwright config comment loses the CARMEN-AVG / CARMEN-FIFO wording.

## Verification

- A real run of all 13 phases on each of the three BUs, starting from `--with-history`. After 924:
  the active period = this month, and the next 12 open periods exist.
- After one BU's run, the main suite's period-dependent specs (900, physical count, my-pending) pass
  on that BU without another reset. Spot run, not the full 1,381.
- Unit tests for the new period planning and `scenarioFor` dates (month roll-over in January,
  day 1–3 of the month) — data:reset has a `scripts/__tests__` suite already.

## Left to the builder

- The exact generate loop / verify in `period.ts` and how `--with-history` threads through `index.ts`.
- Whether the doc-flow seed's SR workflow is enough for 917 or 917 needs its own.
- How 911 creates its blockers (API vs UI). Keep the UI for the steps the case asserts on.
- The key/clearing of `state.json`/`results.json`.
- Updating annotation text (`preconditions` / `steps`) that still names `*@carmen.com`, CARMEN-AVG,
  `1AG01`, `T-01-A`, so the regenerated user stories read correctly.

## Calls made by Claude (not decided by the user)

- Scenario computed from date + BU instead of hand-written rounds.
- Dedicated `E2E-PC-*` products seeded by `--with-history`.
- All three BUs, one at a time. AVG-LOCATION reuses the AVG layout with method-aware oracles.
- Irreversible gate auto-passes on `TEST_BUS` only when the active period matches the scenario.
- `--bu all --with-history` refused.
- (replaced by user ruling) `--with-history` seeds no documents. A normal reset follows before the main suite.
- 911 creates its own blockers instead of `preBlockers`.
- Live probe (§0) on the FIFO BU as a STOP gate before anything else.
- Next-period documents on days 1/2/3 of this month, and a run is refused before the 3rd.
- 921 counts every location, with no narrowing.
