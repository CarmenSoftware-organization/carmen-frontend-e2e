# E2E — move the doc-flow suites onto the three TEST BUs

Status: draft, awaiting user approval (2026-11-24) — builder check done
Follows: `2026-11-23-e2e-inventory-adjustment-design.md` (730 → 731 move, same pattern)
Out of scope here, next project: period-close 910–924 (needs period history; separate design)

## Intent / why

The user wants every e2e spec to run on BUs that `data:reset` controls, so a run never depends on
the hand-built CARMEN-AVG / CARMEN-FIFO tenants and the `*@carmen.com` accounts whose permissions
were set by hand. Three TEST BUs exist now, one per costing method:

| BU | code | `GET /api/<bu>/inventory-transactions/calculation-method` |
|---|---|---|
| TEST BU (AVG) | `BU-GR2VYNKQ` | `average` |
| TEST BU (FIFO) | `BU-96EAT3GX` | `fifo` |
| TEST BU (AVG-LOCATION) | `BU-0706T34Y` | `average_per_location` |

This project moves the six doc-flow specs (312 PR, 404 PO, 502 GRN, 603 CN, 702 SR, 721 SR issue;
~74 TC ids) off CARMEN-AVG/FIFO.

## Current state (recon 2026-11-23, file:line in the scratch recon)

- The six specs are opt-in (`movement` project, `DOC_FLOW_SPECS = /-doc-flow\.spec\.ts$/`,
  `E2E_MOVEMENT=1`), log in as `MOVEMENT_USERS` (`tests/movement-users.ts`), pin BU through
  `tests/fixtures/movement.fixture.ts` (`bu` option, `pinBusinessUnit`), and take the BU from the
  constant `DOC_FLOW_BU = "CARMEN-AVG"` (`tests/helpers/movement/doc-flow.ts:19`).
- They name master data `data:reset` never creates: location LCX013 / 1FO02 / TEST-MOVE /
  TEST-CONSUME, products 11110001… / 11020001 / 55000001 / T-01-F, vendor C010, workflows
  "general item" / "PO inherit-sig test", stage names "หัวหน้าแผนก" / "HOD", CN reason "Damage Good".
- 721 has two env-selected variants (`E2E_SRI_BU` AVG on CARMEN-AVG, FIFO on CARMEN-FIFO) and an
  AVG-only `E2E_SRI_PHASE` pre/post split that needs the active period to lag behind today.
- `data:reset` is bound to `BU-GR2VYNKQ` in five places (`BU_CODE` in `tests/test-users.ts:20`,
  `ResetConfig.buCode` type, `fixtures/workflows.json` `bu_code` + literal type in
  `workflow-template.ts:42`, verify-env step 0 membership/default rule, bu-base/access PATCH of the
  admin's default BU), always seeds the AVG workbook, and has no `--bu` flag.
- `data:reset` workflows (fixtures/workflows.json), gmail accounts `carmensoftware.dev+<role>@gmail.com`:
  - Purchase Request: Create Request[requestor, purchase, owner] > HOD Approval[is_hod] > Purchase[purchase] > GM Approval[gm] > Completed
  - General PO: Create Request[purchase] > FC Approval[fc] > GM Approval[gm] > Completed
  - Store Requisition: Create Request[purchase, requestor, storemanager] > Store Approval[purchase] > Issue[purchase, storemanager] > Completed
- Main-suite helper `tests/helpers/bu-api.ts` is bound to `BU_CODE`; the IA oracle in
  `tests/helpers/ia-api.ts` knows `average` / `fifo` only.

## Scope (user decisions)

- **User:** split into two projects, doc-flow first, period-close later.
- **User (option ก):** document-lifecycle cases (create / edit / delete / submit / approve / reject /
  send back) run on TEST BU (AVG) only; cases whose outcome depends on the costing method run on
  all three BUs. Cost-dependent here = 502 GRN stock posting and 721 SR issue cost.
- **User (approach 1):** rewrite the specs onto data that `data:reset` creates (as 731 did), not a
  clone of the old tenant inside `data:reset`, and not a separate prep script.

## Goals

1. All six specs run in the main `chromium` project with `TEST_USERS` gmail roles, no opt-in env.
2. `data:reset --bu <code>` resets and seeds any of the three TEST BUs; `--bu all` does all three.
3. 502 and 721 cost cases run once per TEST BU and assert the outcome the BU's costing method
   predicts, including `average_per_location`.
4. Every TC id keeps its id (`bun run audit:tc-ids` stays OK); each TC is either green or listed
   below as a gap with a reason.

## Non-goals

- Period-close 910–924, `movement.setup.ts`, `MOVEMENT_USERS`, `scripts/movement/*` — still used by
  period-close; left alone until that project.
- New test cases beyond the existing TC ids.
- Backend changes.

## Anti-goals (a failure even if green)

- A cost case that passes on a BU whose live costing method differs from what the case assumes
  (the case must read `calculation-method` and fail on mismatch, not trust a table).
- A silent `test.skip` without a gap entry here.
- Posting compensating documents on any TEST BU to "restore" stock (standing rule R11).
- Asserting absolute on-hand of shared products; other main-suite specs (141, 711, 720, 731/732)
  read TEST BU (AVG) stock.
- Leaving any gmail account's default BU on FIFO / AVG-LOCATION after a reset or a run.

## Approaches (user picked 1)

1. **Rewrite onto `data:reset` data (picked).** `data:reset` gains `--bu` and a small `doc-flow`
   step with dedicated products; specs use gmail roles and the seeded workflows/stage names. Most
   spec edits, but nothing depends on hand-built state.
2. Clone CARMEN-AVG's shape inside `data:reset` (LCX013, 1111xxxx, "general item", "หัวหน้าแผนก").
   Fewer spec edits, but duplicates workflows and still breaks on gmail stage membership.
3. Separate prep script for the two new BUs, `data:reset` untouched. Fastest, but two ways to build
   a BU — against the reason for moving.

## Decisions (author's calls unless marked user)

### data:reset

- `TEST_BUS` in `tests/test-users.ts`: `[{code: "BU-GR2VYNKQ", method: "average"}, {code:
  "BU-96EAT3GX", method: "fifo"}, {code: "BU-0706T34Y", method: "average_per_location"}]`. `BU_CODE`
  stays (= the AVG entry) so the rest of the main suite is unchanged.
- `cli.ts`: `--bu <code|all>`, default `BU-GR2VYNKQ`; a code outside `TEST_BUS` is refused before
  any HTTP call. `all` runs the three sequentially and stops on the first failure.
- `ResetConfig.buCode` and `WorkflowFixture.bu_code` widen to the `TEST_BUS` code union;
  `fixtures/workflows.json` drops its `bu_code` (the target BU comes from the config).
- Same workbook (AVG) for all three BUs, so product/vendor codes are identical everywhere. The
  costing method is BU config the backend already holds; `data:reset` does not set it, but
  verify-env checks it equals `TEST_BUS[].method` and fails otherwise.
- verify-env step 0: all nine gmail accounts must be members of the target BU; the default BU of
  every account must be `BU-GR2VYNKQ` (unchanged rule, now checked for every target).
- bu-base / access PATCH `/api/business-units` writes the admin's *current default* BU. For a
  non-default target the builder must find the per-BU write path; if only "switch default, write,
  restore" exists, the restore runs in `finally` and the run fails loudly if the restore fails.
- New step `doc-flow` (`scripts/data-reset/docs/doc-flow.ts`, modelled on `ia.ts`): products
  `E2E-DF-1` … `E2E-DF-4` copied from the template product, linked to the first two inventory
  locations of `SeedContext`, no opening stock. They are added to every seeded workflow's product
  list (lookup = workflow products ∩ location products). No new locations: SR source = first
  location, destination = second.
- Prerequisites the user does outside the repo (fact, must be done before the first live run):
  backend `TENANT_RESET_ALLOWED_BU_CODES` += `BU-96EAT3GX,BU-0706T34Y`; the nine gmail accounts
  are members of both new BUs (default stays `BU-GR2VYNKQ`); both new BUs have the same licenses
  as `BU-GR2VYNKQ`.

### Specs

- Rename to drop the opt-in suffix, keep numbers and TC ids: `312-pr-lifecycle.spec.ts`,
  `404-po-lifecycle.spec.ts`, `502-grn-lifecycle.spec.ts`, `603-cn-lifecycle.spec.ts`,
  `702-sr-lifecycle.spec.ts`, `721-sr-issue.spec.ts`.
- Fixture: the main fixture gains a `bu` option (default `BU_CODE`) that pins the BU per page;
  `pinBusinessUnit` / `gotoBu` move from `movement.fixture.ts` to a shared helper both fixtures
  import. `bu-api.ts` functions take an optional `bu` (default `BU_CODE`).
- Roles (from workflows.json, so the specs must not assume more):
  PR create = requestor, HOD step = hod, PR stage names "Create Request" / "HOD Approval";
  PO create = purchase, approve = fc; SR create = requestor, approve = purchase ("Store Approval"),
  issue = storemanager ("Issue"); GRN / CN / Stock In-Out = whichever gmail role holds the
  permission on TEST BU — the builder verifies and records it in the spec header.
- Master data: products `E2E-DF-*`, vendor = `SeedContext` first vendor (or a code the workbook
  seeds; no C010 assumption), CN reason = first active CN reason read at run time.
- Cost cases (502 posting, 721 issue): `for (const bu of TEST_BUS) test.describe(bu.code, …)`
  with `test.use({ bu: bu.code })`; each describe first asserts the live calculation method equals
  `bu.method`. Expected outcome per method:
  - average: GRN posts stock at **saved**; issue cost = BU-wide moving average.
  - fifo: GRN posts at **commit**; issue cost from the oldest lot.
  - average_per_location: posting as average (to verify live — if it differs, the spec follows the
    backend and the difference is logged as a finding); issue cost = moving average of the source
    location only.
  The shared cost oracle (move `typeCost`-style helpers out of `ia-api.ts` into a costing helper)
  gains `average_per_location`; 731/732 keep calling it with their BU.
- Assertions on stock are deltas around the case (before/after), never absolutes.
- Cleanup per spec in `afterAll` (`test.setTimeout(180_000)`, as #105): void/delete what the run
  created and is still voidable/deletable; committed postings stay until the next `data:reset`.
- 721 AVG `E2E_SRI_PHASE` split is removed; the cases run once (phase "all").
- `playwright.config.ts`: drop the `movement` project, `DOC_FLOW_SPECS` and its entry in the
  `chromium` ignore list; keep `movement-setup` and `period-close`.

## Builder check answers (2026-11-24, author's calls unless marked fact)

1. **Retries / timeout.** Each moved file sets `test.describe.configure({ mode: "serial", retries: 0 })`
   and `test.setTimeout(300_000)` (what the `movement` project gave them). No config-level override.
2. **Role grants.** First use a gmail role that already holds the permission on TEST BU. If none
   holds GRN / CN create, `access.ts` may grant it to `purchase` (GRN, CN) or `storemanager`
   (Stock In/Out) only — no new role. The full main suite must stay green after the grant, so a
   change in what 201 / 501 / 601 / 701 see is caught before merge.
3. **Pinning a non-default BU.** Task 1 of the plan is a live probe: a gmail account whose default
   is `BU-GR2VYNKQ` creates and submits a PR on `BU-96EAT3GX` through the pinned page and through
   `bu-api.ts` with an explicit BU. If the backend denies it because of the saved default, the
   plan stops there and comes back to the user (switching account defaults per run is an
   anti-goal).
4. **Cost oracle on dirty stock.** Expected cost is computed from the live before-state, as 732
   does ("pool before"): average / average_per_location read the on-hand qty + value (BU-wide or
   the source location); FIFO reads the open lots (cost layers) and consumes them oldest first.
   No reset is required before a run; leftover lots from earlier runs are part of the input.
5. **SR location pair.** The `doc-flow` step picks the source and destination from inventory
   locations that the seeded Store Requisition workflow accepts (builder verifies on the live
   BU); "first two" is the default only if both qualify.
6. **Vendor / CN reason.** First active vendor from `SeedContext` and first active CN reason, read
   at run time — no C010 / "Damage Good" literal.

### Gaps (TC ids that cannot run on a fresh TEST BU)

- 721 AVG cases gated on the post phase (the "issued after periods are created in advance" case at
  ~721:295 and the post-only case at ~721:323): both need an active period older than today; a
  fresh BU has only {this month, next month}. Moved to the period-close project, where period
  history is built. Each skipped TC keeps its id with a skip reason naming this doc. The AVG
  issue itself is still covered by a same-period issue case on all three BUs.
- Any further gap the builder finds is added here with a reason, not skipped silently.

## Constraints (repo rules)

- Thai commit messages, English PR; merge commit, never squash; branch `test/e2e-doc-flow-test-bu`.
- No new `*.spec.ts` / unit tests beyond the moved specs (user preference); type-check + lint +
  `audit:tc-ids` must pass; `bun test` unit suite must stay green.
- Do not commit the dirty graft tooling deletions (AGENTS.md, .cursor/, .kiro/, .gemini/,
  opencode.json, GEMINI.md, .github/copilot-instructions.md, .trail/hook.cjs).
- Never read `.env*`.

## Left to the builder

- The per-BU write path for bu-base / access (see data:reset).
- Which gmail role holds GRN / CN / Stock In-Out permission; whether `data:reset` access needs a
  role grant for it.
- Exact cost oracle for `average_per_location` on GRN + SR, verified against one live run.
- Run order of the main suite vs `data:reset --bu all` in the README.
