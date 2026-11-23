# E2E Doc-Flow on TEST BUs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the six doc-flow specs (312 PR, 404 PO, 502 GRN, 603 CN, 702 SR, 721 SR issue) off CARMEN-AVG/FIFO onto the three TEST BUs that `data:reset` controls, running in the main `chromium` project with gmail `TEST_USERS`.

**Architecture:** `data:reset` gains `--bu <code|all>` and a `doc-flow` step (products `E2E-DF-1..4`). Specs are rewritten onto seeded data, workflows and stage names. Lifecycle cases run on TEST BU (AVG) only; 502 posting and 721 issue-cost cases run once per BU against a shared costing oracle (average / fifo / average_per_location). A non-default BU is reached by pinning the BU in the browser (profile rewrite) and by an explicit `bu` param in `bu-api.ts`.

**Tech Stack:** Playwright + TypeScript (bun), vitest (`unit/`), backend gateway on the shared dev DB.

**Spec:** `docs/superpowers/specs/2026-11-24-e2e-doc-flow-on-test-bus-design.md` (approved 2026-11-24, binding). Precedent: `docs/superpowers/plans/2026-11-23-e2e-inventory-adjustment.md`.

## Global Constraints

- The deliverable is the six moved specs and the helpers / `data:reset` changes named here. **No TDD steps. No new `*.test.ts` / `*.spec.ts`.** Existing `unit/**` tests are updated only where a changed signature breaks them.
- Verification per code task: `bunx tsc --noEmit` (no `typecheck` script, no lint in this repo), `bun run audit:tc-ids`, `bun run test:unit` green, and `bun run data:reset --dry-run` where `scripts/data-reset/**` changed.
- TEST BUs: `BU-GR2VYNKQ` average, `BU-96EAT3GX` fifo, `BU-0706T34Y` average_per_location. `BU_CODE` stays = the AVG one.
- Cost cases read `GET /api/<bu>/inventory-transactions/calculation-method` and **fail** on mismatch with `TEST_BUS[].method`. No silent `test.skip`; every skip is a Gap entry naming the spec file.
- Never post compensating documents on a TEST BU (R11). Stock assertions are deltas around the case, never absolutes. Expected costs come from the live before-state (pool before), never from a reset.
- Never leave any gmail account's default BU on FIFO / AVG-LOCATION. Default stays `BU-GR2VYNKQ`.
- Each moved file: `test.describe.configure({ mode: "serial", retries: 0 })`, `test.setTimeout(300_000)`, `afterAll` cleanup with `test.setTimeout(180_000)` (void/delete what the run created and can still void/delete; committed postings stay until the next reset).
- Do not touch `tests/movement.setup.ts`, `tests/movement-users.ts`, `scripts/movement/*`, `tests/helpers/movement/*` or `tests/helpers/period-close/*` (period-close 910-924 still uses them). New code that needs them copies, it does not edit them.
- Git: branch `test/e2e-doc-flow-test-bu`. Thai commit messages (`test(e2e): ...`). **Stage explicit paths only; never `git add -A` / `.`.** Never stage the dirty graft deletions (AGENTS.md, .cursor/, .kiro/, .gemini/, opencode.json, GEMINI.md, .github/copilot-instructions.md, .trail/hook.cjs) or `tests/results/*`. Never read any `.env*` file. No push / merge without the user.

## Review Focus

1. **Wrong-BU post:** a pinned page or `bu-api` call that silently lands on `BU-GR2VYNKQ` while the case believes it is on FIFO. Every cost describe calls `gotoBu` (waits for the `- <code>` switcher text) and the describe's first step asserts `calcMethod(bu) === bu.method`. Owned by Tasks 4, 5, 8, 11.
2. **Account default drift:** a run or `data:reset --bu all` leaving a gmail default on a non-default BU. Owned by Task 2 (verify-env refuses; any switch-and-restore is in `finally` and fails loudly) and Task 13 (re-read all nine profiles after the run).
3. **Re-run without reset:** each spec passes twice in a row; leftover lots/stock from run 1 feed the oracle. Owned by Tasks 5, 8, 11, 13.
4. **Dirty FIFO lots:** if per-lot remaining qty cannot be read, the FIFO oracle is wrong, not "close". Task 5 step 3 stops and asks rather than approximating.
5. **Shared-stock bleed:** specs 141 / 711 / 720 / 731 / 732 read TEST BU on-hand; the doc-flow specs touch only `E2E-DF-*`. Owned by Task 3 (products only in the doc-flow step) and Task 13 (full main suite after the role grant).

## File Map

- Modify: `tests/test-users.ts`, `scripts/data-reset/{config,cli,index,workflow-template,workflows,verify-env,bu-base,access,verify-dataset}.ts`, `scripts/data-reset/fixtures/workflows.json`, `scripts/data-reset/docs/seed-all.ts`, `scripts/data-reset/README.md`, `tests/helpers/bu-api.ts`, `tests/helpers/ia-api.ts`, `tests/fixtures/auth.fixture.ts`, `tests/fixtures/movement.fixture.ts`, `playwright.config.ts`, `package.json`, `README.md`, `CLAUDE.md`, `docs/test-id-scheme.md` (only if it lists the 70-72 sections), `unit/data-reset/*.test.ts` (signature fixes only).
- Create: `scripts/data-reset/docs/doc-flow.ts`, `tests/helpers/bu-pin.ts`, `tests/helpers/costing.ts`, `tests/fixtures/doc-flow.fixture.ts`, `tests/helpers/doc-flow/{api,docs,data}.ts`, the six renamed specs (git mv from `*-doc-flow.spec.ts`) (no separate gaps file: gaps are appended to the spec's Gaps section).

## Tasks

### Task 1: Live feasibility probe (STOP gate) - needs user prerequisites

**Needs from the user first (do not start without all three):** backend `TENANT_RESET_ALLOWED_BU_CODES` += `BU-96EAT3GX,BU-0706T34Y`; the nine gmail accounts are members of both new BUs with default still `BU-GR2VYNKQ`; both new BUs hold the same licenses as `BU-GR2VYNKQ`.

**Depends on this task:** Task 2 step 5 (per-BU write path), Task 4 (pin design), Tasks 7-11 (everything run live). Tasks 2 (except step 5), 3, 5, 6 may proceed in parallel as code-only work.

**Files:** none committed (scratch script in the scratchpad dir; reuse `tests/helpers/bu-api.ts` shapes).

- [ ] **Step 1: Probe A (page pin).** Using the gmail `requestor` storageState and `pinBusinessUnit(page, "BU-96EAT3GX")` (copy of `movement.fixture.ts:25-57`), open `/procurement/purchase-request/new`, create and Submit a PR. Record: BU switcher text, PR number, which BU's list shows it.
- [ ] **Step 2: Probe B (API with explicit BU).** Same account via fetch to `/api/BU-96EAT3GX/purchase-requests` (create, then submit): record HTTP status and whether the doc lands in `BU-96EAT3GX`.
- [ ] **Step 3: Probe C (per-BU write path for `data:reset` bu-base/access).** Read how `../carmen-frontend` writes the BU default currency / default BU (search for `/api/business-units`, `default-bu`, BU switcher). Record whether `PATCH /api/business-units` can target a non-default BU (header / query / body `id`), or only "switch account default, write, restore". No writes if the answer is already readable from FE code.
- [ ] **Step 4: Probe D (role holders).** `profilePermissions(role)` for every gmail role on `BU-GR2VYNKQ`: which roles hold GRN create/commit, CN create/submit, Stock In/Out. Record in the plan's execution notes (fills Task 8 / 9 / 11 role choice).
- [ ] **Step 5: STOP condition.** If A or B is denied/redirected because of the account's saved default BU (403, wrong-BU document, profile pin ignored), **stop the whole plan and report to the user** with the statuses. Do not implement per-run default switching (spec anti-goal). If A and B pass, delete the probe PRs (they are drafts/in-progress PRs on a TEST BU) via the UI/API and continue.

### Task 2: `TEST_BUS` and `--bu` plumbing in data:reset

**Files:** Modify `tests/test-users.ts`, `scripts/data-reset/{config,cli,index,workflow-template,workflows,verify-env,bu-base,access}.ts`, `scripts/data-reset/fixtures/workflows.json`, `unit/data-reset/{cli,config,verify-env,workflow-template,bu-base,access,run}.test.ts` (signature fixes only).

**Interfaces:**
- Produces in `tests/test-users.ts`:
  ```ts
  export const TEST_BUS = [
    { code: "BU-GR2VYNKQ", method: "average" },
    { code: "BU-96EAT3GX", method: "fifo" },
    { code: "BU-0706T34Y", method: "average_per_location" },
  ] as const;
  export type TestBuCode = (typeof TEST_BUS)[number]["code"];
  export type CostMethod = (typeof TEST_BUS)[number]["method"];
  export const BU_CODE: TestBuCode = TEST_BUS[0].code;   // unchanged value
  ```
- Produces `ResetConfig.buCode: TestBuCode`; `resolveResetConfig(env?, buCode: TestBuCode = BU_CODE): ResetConfig`; `ResetArgs.bu: TestBuCode | "all"` (default `BU_CODE`).

- [ ] **Step 1:** Add the `TEST_BUS` block above; `BU_CODE` keeps its literal value so every other `BU_CODE` user is unchanged.
- [ ] **Step 2: cli.ts** — parse `--bu <value>` (value form `--bu X` and `--bu=X`); a value not in `TEST_BUS` codes and not `all` throws `Unknown BU ... (allowed: ...)` before any HTTP call (main already prints help and exits 2 on a thrown parse error). Update `resetHelpText()` (usage line, "Wipes a TEST BU", `--bu <code|all>`).
- [ ] **Step 3: config.ts / workflow-template.ts / workflows.json** — widen `ResetConfig.buCode` and the `WorkflowFixture.bu_code` type to `TestBuCode`; delete `bu_code` from `fixtures/workflows.json` and from the fixture type (target BU comes from the config); drop any validate check on it. `workflows.ts` already uses `cfg.buCode`.
- [ ] **Step 4: verify-env.ts** — `checkMembership(email, profileBody, buCode)` keeps "member of target" and replaces the default rule with: the account's default BU must equal `BU_CODE` (for any target) or the account has no other BU marked default. Step-0 log line says "9 accounts in <bu>, default BU-GR2VYNKQ". Also add `calcMethodProblem(cfg)`: `GET /api/<bu>/inventory-transactions/calculation-method` (as admin) must equal `TEST_BUS.find(code).method`, else a step-0 problem (nothing changed).
- [ ] **Step 5: bu-base.ts / access.ts (depends on Task 1 probe C)** — their `PATCH /api/business-units` asserts the admin's current default BU equals `cfg.buCode`. For `cfg.buCode === BU_CODE` keep the exact current path. For other targets use the per-BU write path Task 1 found; if only "switch default, write, restore" exists, wrap it in `try/finally` that restores the admin default to `BU_CODE` and **pushes a failure into the step result if the restore fails**. Pure planner functions (`planDefaultCurrency`) keep their signatures.
- [ ] **Step 6: index.ts** — `runDataReset(args, cfg, deps)` unchanged shape; `main()` builds one cfg per BU: `args.bu === "all"` loops `TEST_BUS` in order, stops at the first non-zero exit code, and prints `=== BU n/3 ===` headers. Dry-run texts mention the target. `--yes` rule unchanged (applies per BU).
- [ ] **Step 7: Verify** — `bunx tsc --noEmit`; `bun run test:unit`; `bun run data:reset --dry-run` (default BU, output as before) and `bun run data:reset --dry-run --bu BU-96EAT3GX`, `--bu all` (needs prerequisites; if missing, record that only step 0 of the new BUs fails for membership, not for code); `bun run data:reset --bu nope` exits 2 with no HTTP call.
- [ ] **Step 8: Commit**
  ```bash
  git add tests/test-users.ts scripts/data-reset/config.ts scripts/data-reset/cli.ts scripts/data-reset/index.ts scripts/data-reset/workflow-template.ts scripts/data-reset/workflows.ts scripts/data-reset/verify-env.ts scripts/data-reset/bu-base.ts scripts/data-reset/access.ts scripts/data-reset/fixtures/workflows.json unit/data-reset
  git commit -m "test(e2e): data:reset รับ --bu และ TEST_BUS สามหน่วยธุรกิจ"
  ```

### Task 3: `doc-flow` data:reset step

**Files:** Create `scripts/data-reset/docs/doc-flow.ts`; modify `scripts/data-reset/docs/seed-all.ts`, `scripts/data-reset/verify-dataset.ts`, `scripts/data-reset/index.ts` (dry-run text), `scripts/data-reset/README.md`.

**Interfaces:**
- Produces (modelled on `docs/ia.ts`):
  ```ts
  export const DF_PRODUCTS = ["E2E-DF-1", "E2E-DF-2", "E2E-DF-3", "E2E-DF-4"] as const;
  export interface DocFlowPlan { products: Array<{code:string; name:string; templateId:string}>; locationIds: [string, string]; }
  export function planDocFlow(ctx: SeedContext): DocFlowPlan;
  export async function seedDocFlow(sessions: Sessions, cfg: ResetConfig, ctx: SeedContext, ledger: RowLedger): Promise<StepResult>;
  ```
  Ledger keys `doc-flow.<code>`; `StepResult.step = "doc-flow"`.

- [ ] **Step 1: planDocFlow** — template = `ctx.products[0]` (copies unit + item group, as `planIa`). Location pair: start from `ctx.locations.first/second` and **verify live** that the seeded Store Requisition workflow accepts both as SR source/destination (read the SR workflow, `ctx.workflows.sr`, and the users' location mappings); if either does not qualify, pick the first two inventory locations that do. The chosen ids are returned in the plan and recorded in the ledger as `doc-flow.locations`; failing to find two is a step failure, not a fallback.
- [ ] **Step 2: seedDocFlow** — for each code not already present: `POST /api/config/<bu>/products` with body shape of `seedIa`'s product POST, but `locations: { add: [{location_id: a}, {location_id: b}] }`; no opening stock. Then, for **every** seeded workflow (PR, PO, SR, plus AP Payment / JV if they carry product lists), add the four products to its product list (lookup = workflow products ∩ location products) through the same call `workflows.ts` uses for the initial product list; idempotent when already present.
- [ ] **Step 3: wire** — `seed-all.ts`: add `docFlow: typeof seedDocFlow` to the deps type and defaults, call `guard("doc-flow", ...)` right after `ia`. `verify-dataset.ts`: `verifyDocFlow` mirroring `verifyIa` (products exist, each has both locations, each is in the SR workflow's product list, on-hand 0 where nothing ran). `index.ts` dry-run "documents:" line adds "4 doc-flow products". README step list gets a `doc-flow` entry.
- [ ] **Step 4: Verify** — `bunx tsc --noEmit`; `bun run test:unit` (fix fixtures in `unit/data-reset/docs-wire.test.ts` / `docs-fixtures.ts` only if the dependency type broke them); `bun run data:reset --dry-run`.
- [ ] **Step 5: Commit** — `git add scripts/data-reset/docs/doc-flow.ts scripts/data-reset/docs/seed-all.ts scripts/data-reset/verify-dataset.ts scripts/data-reset/index.ts scripts/data-reset/README.md unit/data-reset` then `git commit -m "test(e2e): data:reset เพิ่มขั้น doc-flow สินค้า E2E-DF-1..4"`.

### Task 4: Shared BU pin, fixtures, `bu-api` explicit BU

**Depends on Task 1 (A and B passing).**

**Files:** Create `tests/helpers/bu-pin.ts`, `tests/fixtures/doc-flow.fixture.ts`; modify `tests/fixtures/movement.fixture.ts`, `tests/fixtures/auth.fixture.ts`, `tests/helpers/bu-api.ts`.

**Interfaces:**
- `tests/helpers/bu-pin.ts` exports `pinBusinessUnit(page: Page, buCode: string): Promise<void>` and `gotoBu(page: Page, path: string, bu: string): Promise<void>` moved verbatim from `movement.fixture.ts`. `movement.fixture.ts` imports and re-exports both (9xx specs still import `gotoBu` from it).
- `createAuthTest(email)` returns a test with an extra option `bu: string` (default `BU_CODE`, `{ option: true }`); its `page` fixture calls `pinBusinessUnit` **only when `bu !== BU_CODE`** so all existing specs are unaffected.
- `tests/fixtures/doc-flow.fixture.ts` exports `test` (and re-exports `expect`, `gotoBu`, `observed`) with options `role: Role` (default `"Admin"`), `bu: string` (default `BU_CODE`), `failOnSignals`, plus the auto `signals` fixture copied from `movement.fixture.ts` (same `Signals` class, same telemetry `minor`). `storageState` = `authFile(TEST_USERS.find(role).email)`. Several roles per file work through `test.use({ role })` in nested describes (721 needs this).
- `bu-api.ts`: `buSend(role, method, path, body?, bu = BU_CODE)`, `buConfigSend(..., bu = BU_CODE)`, `buSendForm(role, path, form, bu = BU_CODE)`, `buGet(role, path, bu = BU_CODE)`. Optional trailing param so existing callers compile unchanged.

- [ ] **Step 1:** Extract and wire the pin helper; add the `bu` option to `auth.fixture.ts`; add `bu` params to `bu-api.ts`.
- [ ] **Step 2:** Write `doc-flow.fixture.ts` (own file rather than touching 40+ main-suite specs; ruling: the spec's "main fixture `bu` option" is satisfied by `createAuthTest` plus this role-aware sibling, because 721 needs several roles in one file).
- [ ] **Step 3: Verify** — `bunx tsc --noEmit`; `bun run test:unit` (`unit/bu.test.ts`, `unit/bu-network.test.ts` cover bu-api shape; fix only if broken); `bun run audit:tc-ids`.
- [ ] **Step 4: Commit** — `git add tests/helpers/bu-pin.ts tests/fixtures/doc-flow.fixture.ts tests/fixtures/movement.fixture.ts tests/fixtures/auth.fixture.ts tests/helpers/bu-api.ts` then `git commit -m "test(e2e): แยก helper ตรึง BU และเพิ่มพารามิเตอร์ bu ใน bu-api"`.

### Task 5: Shared costing oracle

**Files:** Create `tests/helpers/costing.ts`; modify `tests/helpers/ia-api.ts`, `tests/helpers/ia-cost.ts` (re-export or delete after moving), `tests/731-inventory-adjustment.spec.ts` / `tests/732-inventory-adjustment-stock.spec.ts` (import paths and the `bu` argument only).

**Interfaces:**
- Produces in `costing.ts`:
  ```ts
  export type { CostMethod } from "./../test-users";
  export interface CostLayer { qty: number; cost: number }
  export function expectedIssueCost(layers: CostLayer[], issueQty: number, method: CostMethod): number; // pure; average and average_per_location = pooled average of the layers passed in; fifo = oldest first; rounds to 2 places once
  export function calcMethod(bu?: string): Promise<CostMethod>;           // GET /inventory-transactions/calculation-method, Admin, accepts all three values
  export function stockAt(productId: string, locationId: string, atDate: string, bu?: string): Promise<{ qty: number; value: number }>;
  export function costLayers(args: { productId: string; locationIds: string[]; sourceLocationId: string; atDate: string; bu?: string }): Promise<CostLayer[]>;
  ```
  `costLayers` returns: **average** one pooled layer over all `locationIds` (BU-wide); **average_per_location** one pooled layer over `sourceLocationId` only; **fifo** the open lots oldest first.
- `ia-api.ts` keeps its exports (`stockAt`, `costLayers(productId, locationId, atDate)`, `calcMethod`) as thin wrappers over `costing.ts` with `BU_CODE`, so 731/732 diffs are import-only.

- [ ] **Step 1:** Move the pure oracle from `ia-cost.ts` and `calcMethod` / `stockAt` / `costLayers` from `ia-api.ts` into `costing.ts`, parametrised by `bu`; extend the method type. 731/732 behaviour must not change on `average`.
- [ ] **Step 2:** `average_per_location` expectation: issue cost = moving average of the **source location** only; posting timing of a GRN as `average` (verify live in Task 13; if the backend differs the spec follows the backend and logs a finding in the spec file header).
- [ ] **Step 3 (FIFO lots, STOP if impossible):** find how to read open lots per product/location on the live FIFO BU (`inventory-info` `cost_layers` rows carry `lot_no`, in/out qty? or a lots endpoint). `ia-api.ts` documents that on `average` the ledger is not per-lot; for FIFO check whether `in_qty - out_qty` per lot exists. If remaining qty per lot cannot be derived, **stop and ask the user** (options: assert FIFO issue cost structurally from the issue's own lot rows; or a backend lots endpoint). Do not approximate.
- [ ] **Step 3b:** If 731/732 are not live-runnable at this point, only `bunx tsc --noEmit` is claimed; the live 731/732 re-run is in Task 13.
- [ ] **Step 4: Verify** — `bunx tsc --noEmit`; `bun run test:unit` (update `unit/helpers/*` imports if they reference `ia-cost`); `bun run audit:tc-ids`.
- [ ] **Step 5: Commit** — `git add tests/helpers/costing.ts tests/helpers/ia-api.ts tests/helpers/ia-cost.ts tests/731-inventory-adjustment.spec.ts tests/732-inventory-adjustment-stock.spec.ts unit/helpers` then `git commit -m "test(e2e): ย้าย oracle ต้นทุนไป costing.ts รองรับ average_per_location"` (drop paths from the command that were not changed).

### Task 6: Doc-flow helper layer (no `@carmen.com` dependency)

**Files:** Create `tests/helpers/doc-flow/api.ts`, `tests/helpers/doc-flow/docs.ts`, `tests/helpers/doc-flow/data.ts`.

**Why a copy:** `tests/helpers/movement/{api,docs,doc-flow}.ts` call the backend as `@carmen.com` accounts and hard-code C010 / LCX013 / names. They stay for period-close, so the moved specs get their own layer. `movement/ui.ts` is pure UI and is imported as is.

**Interfaces (all take `bu` explicitly, default `BU_CODE`; API calls use `buSend`/`buGet` with a gmail `Role`):**
- `api.ts`: `dfGet(path, role?: Role, bu?)` (role default `"Admin"`, path relative to the BU), `txOfDoc(bu, docId, docNo): Promise<TxDetail[]>` (same shape as `movement/api.ts:123-136`).
- `docs.ts`: ports of `grnById`, `createGrn`, `commitGrn`, `deleteGrnDraft`, `cnById`, `createCreditNote`, `submitCreditNote`, `deleteCreditNoteDraft` with the same signatures, except `vendor` and `reason` are required params (no `MOVEMENT_VENDOR` / `Damage Good` default) and API reads go through `dfGet`.
- `data.ts`:
  ```ts
  export const DF: Record<"P1"|"P2"|"P3"|"P4", { code: string; name: string }>; // E2E-DF-1..4, name = code
  export const stamp: string;                                                   // as movement/doc-flow.ts
  export const itemRow: (page: Page, code: string) => Locator;
  export function activePeriodDate(bu: string): Promise<string>;                // as movement version, no E2E_MOVEMENT_DATE
  export function firstVendor(bu: string): Promise<{ id: string; code: string; name: string }>;     // first active vendor by code
  export function firstCnReason(bu: string): Promise<string>;                   // first active CN reason name, read at run time
  export function srLocations(bu: string): Promise<{ from: string; to: string }>; // names of the doc-flow location pair (read from the E2E-DF-1 product's locations, ordered as the data:reset step chose them)
  export function srWorkflowName(bu: string): Promise<string>;                  // active store_requisition workflow named "Store Requisition"
  ```
  The `P3`/`P4` entries keep the spec-local mapping the old `PROD` had (P1-P3 line items, P4 the single-line posting product).

- [ ] **Step 1:** Write the three files. **Step 2: Verify** `bunx tsc --noEmit`. **Step 3: Commit** — `git add tests/helpers/doc-flow` + `git commit -m "test(e2e): helper doc-flow ใช้บัญชี gmail และข้อมูลจาก data:reset"`.

### Task 7: 312 PR and 404 PO

**Depends on Tasks 1, 4, 6 (and Task 3 live in Task 13).**

**Files:** `git mv tests/312-pr-doc-flow.spec.ts tests/312-pr-lifecycle.spec.ts`; `git mv tests/404-po-doc-flow.spec.ts tests/404-po-lifecycle.spec.ts`; edit both.

- [ ] **Step 1 (312):** Imports -> `doc-flow.fixture`, `helpers/doc-flow/*`. `test.use({ role: "Requestor", bu: BU_CODE })`. Products `DF.P1`/`P2`/`P3` replace 11110001/11110003/11110009; location = first of `srLocations`' pair. Workflow = seeded "Purchase Request" (pick by name, no "general item"). TC-PR-700005 submit lands on stage **"HOD Approval"**. Roles: create + submit = Requestor (stage "Create Request" assigns requestor, purchase, owner). Runs on **TEST BU (AVG) only**. TC ids: 700001-700005, unchanged. Update annotations (BU name, accounts, stage names) and the header comment.
- [ ] **Step 2 (404):** Same pattern. `role: "Purchase"` (General PO "Create Request" assigns only purchase), workflow "General PO", vendor = `firstVendor(bu)`. TC-PO-700005 submit lands on stage **"FC Approval"** (approver `FC`, used only if a step approves). TC ids 700001-700005. AVG only.
- [ ] **Step 3 (both):** `test.describe.configure({ mode: "serial", retries: 0 })`; `test.setTimeout(300_000)`; `afterAll` (`setTimeout(180_000)`): delete the run's remaining drafts and the submitted PR/PO is voided/cancelled only if the API allows it (read from the API by description stamp, not from in-memory state, so a failed case is still cleaned). Keep `test.fail(true, "suspected bug: ...")` markers exactly as they are (TC-PR-700003).
- [ ] **Step 4: Verify** — `bunx tsc --noEmit`; `bun run audit:tc-ids`; `bun run test:unit`; `git grep -n "carmen.com\|CARMEN-AVG\|LCX013\|11110001\|C010\|movement/" tests/312-pr-lifecycle.spec.ts tests/404-po-lifecycle.spec.ts` prints nothing.
- [ ] **Step 5: Commit** — `git add tests/312-pr-lifecycle.spec.ts tests/404-po-lifecycle.spec.ts tests/312-pr-doc-flow.spec.ts tests/404-po-doc-flow.spec.ts` then `git commit -m "test(e2e): ย้าย 312 PR และ 404 PO ไป TEST BU (AVG) ด้วยบัญชี gmail"`.

### Task 8: 502 GRN (posting runs on all three BUs)

**Depends on Tasks 1, 4, 5, 6, and Task 1 probe D (GRN role).**

**Files:** `git mv tests/502-grn-doc-flow.spec.ts tests/502-grn-lifecycle.spec.ts`; edit; modify `scripts/data-reset/access.ts` **only if** no gmail role holds GRN create/commit (spec ruling: grant to `purchase` only, no new role; the full main suite must stay green, see Task 13).

- [ ] **Step 1: Lifecycle (AVG only):** TC-GRN-700001 .. 700004 (create draft, open, edit, delete). Role = the one holding GRN permission (default `Purchase`; record the choice and Task 1 probe D result in the spec header), vendor `firstVendor`, products `DF.P1..P3`, location first of the pair, date `activePeriodDate(bu)`.
- [ ] **Step 2: Posting cases, one describe per `TEST_BUS` entry** (`test.use({ bu })`; first step `expect(await calcMethod(bu.code)).toBe(bu.method)`):
  - `BU-GR2VYNKQ` average: **TC-GRN-700005** (existing id) GRN Create -> saved, stock posted at saved.
  - `BU-96EAT3GX` fifo: **TC-GRN-710005** GRN Create -> saved posts **no** stock; commit -> stock posted.
  - `BU-0706T34Y` average_per_location: **TC-GRN-720005** same as average (saved posts); if live differs, follow the backend and write the difference into the header as a finding.
  All assert **deltas** of `stockAt` before/after for `DF.P4` at the GRN location, and `txOfDoc` rows. (Ruling: `audit:tc-ids` rejects the same id in two titles, so the per-BU copies of 700005 get 71/72 ids in the existing 70/71 pattern of 721.)
- [ ] **Step 3: Cleanup:** `afterAll` voids committed GRNs of the run (tag by invoice stamp, read from API) per BU; a void that the BU refuses is reported in the failure, not swallowed.
- [ ] **Step 4: Verify** — `bunx tsc --noEmit`; `bun run audit:tc-ids`; `bun run test:unit`; the same `git grep` as Task 7.
- [ ] **Step 5: Commit** — `git add tests/502-grn-lifecycle.spec.ts tests/502-grn-doc-flow.spec.ts` (+ `scripts/data-reset/access.ts unit/data-reset/access.test.ts` if changed) then `git commit -m "test(e2e): ย้าย 502 GRN ไป TEST BU และรันเคสลงสต๊อกครบสามวิธีคิดต้นทุน"`.

### Task 9: 603 CN

**Depends on Tasks 1, 4, 6; probe D (CN role).**

**Files:** `git mv tests/603-cn-doc-flow.spec.ts tests/603-cn-lifecycle.spec.ts`; edit; `access.ts` grant only per Task 8's rule.

- [ ] **Step 1:** AVG only; all of TC-CN-700001..700007 keep ids. Role = holder of CN create/submit (default `Purchase`); vendor `firstVendor`; reason `firstCnReason(bu)`; GRN prepared by the same role (700001) with `DF.P1..P3`, committed; dates in `activePeriodDate`.
- [ ] **Step 2:** TC-CN-700004 keeps `test.fail(true, "suspected bug: ...")`; 700007 (CN submit returns stock) asserts a stock **delta** via `stockAt`, not absolutes. Cleanup per Task 7 step 3 (CN drafts deleted; completed CNs stay).
- [ ] **Step 3: Verify / Commit** as Task 8 steps 4-5, message `test(e2e): ย้าย 603 CN ไป TEST BU (AVG) ด้วยบัญชี gmail`.

### Task 10: 702 SR

**Depends on Tasks 1, 4, 6.**

**Files:** `git mv tests/702-sr-doc-flow.spec.ts tests/702-sr-lifecycle.spec.ts`; edit.

- [ ] **Step 1:** AVG only; TC-SR-700001..700005 keep ids. Role `Requestor` (SR "Create Request" assigns purchase, requestor, storemanager); workflow `srWorkflowName(bu)` = "Store Requisition"; from/to = `srLocations(bu)`; product `DF.P1`; edit case (700003) may now also remove/add lines because DF products are in both locations (old file noted this limit).
- [ ] **Step 2:** TC-SR-700005 submit lands on stage **"Store Approval"** (approver `Purchase`); no HOD step. Keep the 422 `SR_DATE_PATTERN_REQUIRED` handling.
- [ ] **Step 3: Verify / Commit** as Task 8, message `test(e2e): ย้าย 702 SR ไป TEST BU (AVG) ด้วยบัญชี gmail`.

### Task 11: 721 SR issue (issue cost on all three BUs)

**Depends on Tasks 1, 4, 5, 6, and probe D (GRN and Stock role).**

**Files:** `git mv tests/721-sr-issue-doc-flow.spec.ts tests/721-sr-issue.spec.ts`; edit.

- [ ] **Step 1: Remove variants:** delete `E2E_SRI_BU`, `E2E_SRI_PHASE`, the FIFO `V` table and `DocState` handover file; one chain per BU in `for (const bu of TEST_BUS) test.describe(bu.code, ...)` with `test.use({ bu: bu.code })` and a first step asserting `calcMethod(bu.code) === bu.method`. Chain state (SR id) lives in a per-describe variable (serial).
- [ ] **Step 2: Roles per step** (from workflows.json): receive stock via GRN = GRN-role holder (probe D; default `Purchase`), GRN committed on every BU (fifo posts only on commit; on average the commit is harmless); SR create + submit = `Requestor` -> stage "Create Request" -> **"Store Approval"**; approve = `Purchase` (stage "Store Approval"); issue = `StoreManager` (stage "Issue"; purchase also qualifies, storemanager is used). Product `DF.P1`; from/to = `srLocations(bu)`.
- [ ] **Step 3 (TC ids):** AVG `BU-GR2VYNKQ`: TC-SI-700001..700004 (receive, submit, approve, issue); FIFO `BU-96EAT3GX`: TC-SI-710001..710004; AVG-LOCATION `BU-0706T34Y`: TC-SI-720001..720004 (new ids by the same pattern; `audit:tc-ids` forbids a repeated id). TC-SI-700004 / 710004 / 720004 assert the same-period issue: SR completed, source delta = -qty, transaction dated in the active period, and **issue cost = `expectedIssueCost(await costLayers(...), qty, bu.method)`** computed from the pool read **before** the issue (average: BU-wide pool over both doc-flow locations; average_per_location: source location only; fifo: oldest open lots).
- [ ] **Step 4: Non-cost cases, AVG only:** TC-SI-710005, 710006, 710007 (second SR, approve, "Issue without typing the issued qty" with its `test.fail(true, "known bug: ...")`) keep their ids and run once on `BU-GR2VYNKQ`; header says why the 71 prefix is historical.
- [ ] **Step 5: Gap TCs (skipped, reason names the spec):**
  - **TC-SI-700005** (submit after periods created in advance): `test.skip(true, "gap: needs an active period older than today; a fresh TEST BU has only this month and next; moved to the period-close project (docs/superpowers/specs/2026-11-24-e2e-doc-flow-on-test-bus-design.md, Gaps)")`.
  - The pre/post phase part of the old AVG issue case: removed with `E2E_SRI_PHASE`; recorded in the same Gaps list (see ambiguity ruling in the plan hand-off: there is no second TC id; TC-SI-700004 runs as the same-period issue the spec asks for).
  Append both lines to the spec's Gaps section in this commit.
- [ ] **Step 6: Cleanup:** `afterAll` (`setTimeout(180_000)`) cancels/voids what is still open (draft/in-progress SR); completed issues and committed GRNs stay until the next reset. No compensating documents.
- [ ] **Step 7: Verify / Commit** — as Task 8 step 4; `git add tests/721-sr-issue.spec.ts tests/721-sr-issue-doc-flow.spec.ts docs/superpowers/specs/2026-11-24-e2e-doc-flow-on-test-bus-design.md` then `git commit -m "test(e2e): ย้าย 721 SR issue ไปสามวิธีคิดต้นทุน และบันทึก gap งวดย้อนหลัง"`.

### Task 12: Config, scripts and docs

**Files:** Modify `playwright.config.ts`, `package.json`, `README.md`, `CLAUDE.md`, `scripts/data-reset/README.md`, `docs/test-id-scheme.md` (only if it lists sections 70-72).

- [ ] **Step 1: playwright.config.ts** — remove the `movement` project block, the `DOC_FLOW_SPECS` constant and its entry in the `chromium` `testIgnore`; keep `movement-setup` (now `MOVEMENT || PERIOD_CLOSE` -> only `PERIOD_CLOSE` triggers it; keep `MOVEMENT` env accepted so `scripts/movement/*` still run if they read it) and `period-close`. `package.json`: drop `test:movement`.
- [ ] **Step 2: Docs** — `README.md`: remove the `test:movement` row and the `*-doc-flow.spec.ts` tree line, update the project count text; add `data:reset --bu <code|all>` and the run order (**`bun run data:reset --yes --bu all` before the suite; the cost cases read live state so a reset is optional on re-runs**). `CLAUDE.md`: the "Standard test dataset" paragraph gets `--bu`, `TEST_BUS`, the `doc-flow` step; the movement paragraph/commands drop the doc-flow specs (period-close stays) and line 91 is rewritten for the new filenames and gmail roles. `scripts/data-reset/README.md`: usage with `--bu`, prerequisites (allowlist, membership, licenses, default stays `BU-GR2VYNKQ`), `doc-flow` step.
- [ ] **Step 3: Verify** — `bunx tsc --noEmit`; `bun run audit:tc-ids`; `bun run test:unit`; `bunx playwright test --list --project=chromium | grep -E "312|404|502|603|702|721"` shows the six specs; `E2E_MOVEMENT=1 bunx playwright test --list --project=movement` fails with "project not found".
- [ ] **Step 4: Commit** — `git add playwright.config.ts package.json README.md CLAUDE.md scripts/data-reset/README.md` (+ `docs/test-id-scheme.md` if changed) then `git commit -m "test(e2e): เอาโปรเจกต์ movement ออก และอัปเดตเอกสาร data:reset --bu"`.

### Task 13 (LIVE, run by the controller; needs the Task 1 prerequisites): reset and run

- [ ] **Step 1:** `NODE_EXTRA_CA_CERTS=<scratchpad CA chain> bun run data:reset --yes --bu all` (never commit that path). Exit 0 for all three; re-read all nine gmail profiles: default BU is `BU-GR2VYNKQ` for each (Review Focus 2).
- [ ] **Step 2:** Per spec, `bun run test -- --project=chromium tests/<file>` for 312, 404, 502, 603, 702, 721 (workers 1). Each green or a listed gap. Record the live outcome of the `average_per_location` GRN timing and issue cost (Task 5 step 2, Task 8 step 2) as findings in the spec headers; a mismatch with the oracle is investigated, not tuned away.
- [ ] **Step 3:** Run 502 and 721 **a second time with no reset** (Review Focus 3); re-run 731 and 732 (costing helper moved).
- [ ] **Step 4:** Full main suite (`bun run test -- --project=chromium`) once, to catch role-grant side effects on 201 / 501 / 601 / 701 (only needed if Task 8 or 9 changed `access.ts`) and shared-stock bleed on 141 / 711 / 720.
- [ ] **Step 5:** `git restore tests/results`, `bun run audit:tc-ids`, `bun run docs:user-stories` only if the repo convention requires it (check `git status`; restore footer-only story diffs), then commit any generated tracked output by explicit path. Report to the user: branch ready for PR (merge commit, English PR text); do not push.

## Self-Review

- **Spec coverage:** TEST_BUS/`--bu all`/verify-env/bu-base/access -> T2; `doc-flow` step and workflow product lists -> T3; pin helper, fixture `bu`, `bu-api` -> T4; costing oracle incl. average_per_location -> T5; six specs with roles/stages/ids -> T7-T11; config/doc updates -> T12; builder checks 1-6 -> T1, T7 (retries/timeout), T8 (grant rule), T5 (dirty stock), T3 (location pair), T6 (vendor/reason); gaps -> T11; prerequisites -> T1/T13.
- **Type consistency:** `TestBuCode`/`CostMethod`/`TEST_BUS` defined in T2 and used in T4-T11; `calcMethod(bu)`, `costLayers({...})`, `stockAt(..., bu)` from T5 used in T8/T11; `DF`, `srLocations`, `firstVendor`, `firstCnReason`, `srWorkflowName`, `activePeriodDate` from T6 used in T7-T11; fixture options `role`/`bu` from T4.
- **Proportion:** signatures and decisions only; bodies are left to the implementer.
