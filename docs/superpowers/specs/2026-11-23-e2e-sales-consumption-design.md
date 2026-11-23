# E2E — Sales Consumption + Import POS (Phase 2, stock path)

Date: 2026-11-23 · Repo: `carmen-frontend-e2e` · Target app: `../carmen-frontend` @ `main`
Follows: `2026-11-23-e2e-phase-2a-accounting-ap-jv-design.md` (merged #95–#101). The 2a table called
this sub-phase "2c"; the user re-ordered Phase 2 on 2026-11-23 so it runs **first**:
sales-consumption + import-pos → inventory-adjustment → procurement `from-*` → AR (waits for real backend).

Feature spec under test: `../carmen-frontend/docs/superpowers/specs/2026-10-26-sales-consumption-design.md`
(BE #945, FE #453, deployed to dev 2026-10-27). Its §6 acceptance list was checked only by hand
("no new tests" at the time) and the feature was merged without ever running against a DB.

## Intent / why

Phase 2 goal (user): catch money / stock bugs **before real use**. Sales Consumption is the
path that turns a day of POS sales into Stock Out documents — a wrong number here silently
corrupts on-hand and cost. So the tests check **stock outcomes** (which Stock Outs exist, at which
location, for how much, and on-hand before/after), not just that pages open.

## Environment facts (verified 2026-11-23)

- TEST BU `GR2VYNKQ` had no POS license (`403 LICENSE_REQUIRED interface.pos`). **The user issued an
  INF licence for TEST BU on 2026-11-23**; `/pos-sales/status` now answers 200 with `enabled_brands: []`.
- SC endpoints still answer `403 SALES_CONSUMPTION_POS_NOT_ENABLED` until a brand is switched on:
  BE reads `tb_application_config` key `interface_pos_simphony` with `value.enabled === true`
  (`micro-business/src/inventory/sales-consumption/pos-enabled.ts`).
- SC lines come **only** from POS imports (Simphony text, Micros 3700 PDF, SFTP). There is no
  "create SC" endpoint: a successful import syncs the day's pending SC (`sales-consumption-sync.ts`).
- One Simphony business date per store is imported once (`REJECTED_DUPLICATE`) until cancelled.
- `data:reset` is a full tenant reset of TEST BU, so it also wipes every POS table.

## Scope

Routes: `/operation-plan/import-pos`, `/operation-plan/sales-consumption` (list: calendar + table +
Mapping tab) and `/operation-plan/sales-consumption/:id` (detail: sales lines, ingredients by
location, history, Verify on-hand, Post, Void). Plus the Stock Out the post creates
(`/inventory-management/…stock-out` detail) only as far as the "void from Stock Out is refused" rule.

Brand: **Simphony only** (user, 2026-11-23). Micros 3700 is covered only by its `check` endpoint
refusing a non-Micros file. Consequence: spec §6 items "two brands same day → one SC" and "Micros
overwrite of a posted day fails" are **not covered** — listed in the PR and the coverage gap file.

## Goals

1. `data:reset` leaves TEST BU ready for POS: Simphony enabled, two recipes, and on-hand for their
   ingredients at 2 locations dated the **first day of the open period** (see "Builder check
   answers"). Outlet / item mapping is **not** seeded — those masters only exist after an import.
2. A Simphony fixture builder in the e2e repo produces a valid Standard Export file for a given
   business date, store, outlets and items/qty (pipe-delimited `GLID` header + `MID` lines, format
   from `micro-business/src/inventory/pos-sale/parsers/simphony.parser.ts`).
3. Cases below pass against current `main`, or are pinned per the failure policy.

### Cases (from feature spec §6, Simphony-only)

Import POS
- upload a valid file → history row `success`, raw lines shown, link to that day's SC; no mapping
  buttons on Import POS
- same store + date again → `REJECTED_DUPLICATE` recorded in history (201, not 400)
- empty / binary file → 400; Micros `check` with a Simphony file → refused
- only enabled brands show an upload button
- cancel an import whose SC is pending → SC loses those lines (deleted when empty)
- cancel an import whose lines sit in a **posted** SC → refused ("void SC first")

Mapping and blocking
- item neither mapped nor ignored → Post disabled (UI) and `POST …/post` refused (API)
- outlet without location → Post disabled
- ignore an item → stays ignored on the next day's file; ignored / net qty ≤ 0 lines are not deducted
- per-line location override (outlet mapped to A, line set to B) → that line lands in B's Stock Out;
  later outlet master change does not overwrite the override; posted SC cannot change location
- per-line recipe override affects only that line; "set as item default" updates master and other
  non-overridden lines

Verify / Post / Void (stock outcomes — assert through API)
- not verified → Post disabled and direct API post refused; verify passed then a line edited →
  post refused until re-verified
- Verify on-hand marks each ingredient row OK / short at the right location
- post a day with 2 locations → exactly 2 `SALE` Stock Outs, one per location, date = sale date,
  qty = recipe formula × net qty; on-hand at each location drops by that qty
- post twice (sequential and two parallel requests) → still one set of Stock Outs
- one location short → no Stock Out at all, response lists the short products per location;
  on-hand unchanged
- void (open period) → every Stock Out voided, on-hand restored, new SC `pending` for that day
  with the same lines
- void the Stock Out directly from the Stock Out page / API → refused (error catalog "void at Sales
  Consumption")
- a later file of a posted day (different store) → late lines flagged on the SC, not attached

Calendar
- days show Posted / Pending post / No sales / No file correctly; "No file" never before the first
  imported day and never for today

Not testable here (pinned with reason, not skipped silently)
- void when the sale day's inventory period is closed — we never close periods on any BU.

## Non-goals

- Micros 3700 PDF and SFTP pulls; two-brand days.
- Fixing app bugs found (reported in the bug list, as in Phase 1/2a).
- Visual / layout checks beyond what a case asserts.

## Anti-goals (a failure even if green)

- A stock case that asserts only the UI toast, not the Stock Outs and on-hand behind it.
- Tests that depend on a previous run's POS data, or that leave a **posted** SC behind (it holds
  stock out of TEST BU's on-hand and breaks other specs' stock numbers).
- Touching any BU other than TEST BU.

## Approach (user chose A)

Considered:
- **A. UI journey + API verification (chosen).** The user path runs in the browser (upload on
  Import POS, mapping/ignore, Verify → Post → Void on the SC page); outcomes are read with
  `tests/helpers/bu-api.ts`. Guard cases that the UI cannot reach (direct post without verify,
  parallel post, direct Stock Out void, cancel vs posted) call the API only. Same shape as 2a.
- B. API-first with a UI smoke — rejected: the feature spec puts many rules on the screen (Post
  disabled until verified, verify result expires on edit, ingredients grouped by location).
- C. Put it in the opt-in movement suite like `730` — rejected: that runs on real BUs
  (CARMEN-AVG/FIFO); TEST BU now has the licence, so there is no reason to touch them.

## Decisions (author's calls unless marked user)

- **Brand: Simphony only** (user).
- **Approach A** (user).
- **Licence:** INF issued by the user in backstage (user). `data:reset` only writes the BU-level
  app-config `interface_pos_simphony` (`enabled: true`, no SFTP), and `verify-dataset` checks it.
- **Spec files** (author): `140-import-pos.spec.ts` (prefix `IPOS`) and
  `141-sales-consumption.spec.ts` (prefix `SC`), in the Operation Plan block next to recipe (120)
  and equipment (130). Register both in `docs/test-id-scheme.md`.
- **Sale dates** (author): each test owns distinct past days inside the open inventory period
  (data:reset opens this month), derived from a per-spec offset so specs never collide. If fewer
  free days remain than a spec needs (early in the month), the spec fails its precondition loudly
  with a reason — it does not reuse a day. A unique store key per spec (`E2E-<spec>`) keeps
  duplicates within one store only.
- **Cleanup** (author): `afterAll` voids any SC the spec posted, then cancels its imports. A
  posted SC left behind is an anti-goal, so cleanup failures throw.
- **Recipes** (author): two seeded recipes with 1–2 ingredients each, taken from products the
  `stock` step already gives on-hand at both locations, with quantities small enough that one
  day's sale does not exhaust stock; the "short" case uses a qty the seeded on-hand cannot cover.
- **Failure policy** unchanged: suspected bug → `test.fail(true, "suspected bug: …")` after setup,
  with real-BE-answer guards (not 401, < 500) before it; product question → "needs product
  decision:" pin; new entries go to a bug list `2026-11-23-e2e-sales-consumption-bug-list.md`.

## Builder check answers (2026-11-23, author's calls unless marked fact)

1. **Mapping before import.** Fact: outlets / items are created per store by the import itself
   (`pos-sale-import.service.ts` upserts them), so nothing can be mapped earlier. Call: each spec
   imports its first day in `beforeAll` under its own store key (`E2E-140`, `E2E-141`), then maps
   the outlets/items it does not test through the same API the Mapping tab uses (`PATCH
   /pos-sales/outlets/:id`, `PATCH /pos-sales/items/:id`). Cases that test mapping leave their
   outlet/item unmapped and map it through the UI. Masters stay mapped for the spec's later days
   (master mapping is per store), which is what the "ignore remembered next day" case relies on.
2. **Day budget.** Fact: the open inventory period after `data:reset` covers the whole month
   (2611 = 2026-11-01 → 2026-11-30), and the Simphony import has no future-date rule. Fact: verify /
   post check on-hand **as of the sale date**, so a day before the stock-in has no stock. Call:
   the POS seed step stock-ins the recipe ingredients dated the **first day of the open period**,
   so every day of the month is a usable sale day (~30 days, the suite needs ~15). Days are
   allocated per spec from fixed offsets (140 from the start of the month, 141 from the end).
   Only the calendar "No file" case needs past days (before yesterday); when the month is too
   young for it, that case keeps a data guard with a reason (allowed by the failure policy).
3. **Stock baseline.** Call: the POS seed step uses its own ingredient stock-in (one product per
   recipe line, qty large enough for every planned sale), not the `stock` step's 711 levels.
   Stock assertions are always **deltas** read from the live on-hand before and after; the
   "short" case computes its sale qty from the live on-hand + 1, so other specs moving stock
   cannot break it. Recipe ingredient units = the product's inventory unit (no conversion).
4. **`SALE` adjustment type.** Fact: present on TEST BU (`GET /config/GR2VYNKQ/adjustment-types`
   returns `EOP-IN`, `EOP-OUT`, `SALE`). `verify-dataset` checks it so a missing type reads as an
   environment failure, not an app bug.
5. **Recipes.** Left to the builder to read the recipe create API (`/api/config/:bu/recipes`) for
   required state (active / category / cuisine); seed whatever the item → recipe mapping accepts,
   and fail `data:reset` loudly if the mapping refuses the seeded recipe.
6. **Reset scope / recovery.** Fact: `data:reset` already rewrites `gl_setting` every run because
   the reset wipes `tb_application_config`, so the `interface_pos_simphony` write runs after the
   wipe in the same way. Recovery from a crashed run that left a posted SC: void it via API, or
   re-run `data:reset`.

## Constraints (repo rules — unchanged from Phase 1/2a)

- All 5 annotation fields on every `test(...)`; `bun audit:tc-ids` passes; `bun docs:user-stories`
  regenerated with any annotation change (restore the footers of untouched stories).
- `workers: 1`, no retries; run with `bun run test -- --project=chromium <spec>`.
- Locators: `getByRole` first, `data-slot` when ambiguous; page objects expose locator factories.
- Irreversible actions only on TEST BU. Never close a period, never set `E2E_ALLOW_IRREVERSIBLE`.
- Commits in Thai; PR in English; merge commits only.
- `COVERAGE.md` / `SPEC-HEALTH.md` regenerated at the end.

## Left to the builder

- Exact fixture line contents (field positions from the parser), page-object shape, which seeded
  products/locations the recipes use, how tests split across `describe` blocks.
- Whether recipe/mapping seeding lives in a new `scripts/data-reset/pos.ts` step or in `mappings.ts`.
- Assertion detail per case, as long as stock cases assert Stock Outs and on-hand.
