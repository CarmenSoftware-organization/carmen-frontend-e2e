# `data:reset` skeleton (reset → step 0 → master → mappings, workflows, period) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One manual command, `bun run data:reset --yes`, that wipes TEST BU (`GR2VYNKQ`) through the new backend
endpoint, checks the platform-side environment the tests assume, and rebuilds everything the BU schema lost
*except documents and stock*: master data, user↔department / user↔location mappings, the first PR and PO
workflows, and an open inventory period covering today. Plan 3 adds documents, stock and the final count check
on top of this.

**Architecture:** A new `scripts/data-reset/` module next to `scripts/seed-master/`, reusing seed-master's
config, login and HTTP client (extended with `put` / `patch`). Every step is a pure "plan" function (input →
list of API calls) plus a thin runner, so the dry run prints the plan and unit tests cover the plan functions
with injected `fetchFn` stubs. Workflows are copied from a fixture captured once from today's TEST BU, so the
re-created ones match what the specs were written against.

**Tech Stack:** Bun, TypeScript, vitest (`bun run test:unit`), the backend HTTP API (bearer + `x-app-id`).

**Spec:** `docs/superpowers/specs/2026-11-04-standard-test-dataset-design.md` (step 0, step 1, "Who calls
what", "One command"). Depends on plan 1 (`docs/superpowers/plans/2026-11-04-tenant-reset-endpoint.md`,
backend PR #1004) being **deployed to dev** before the first real (non-dry) run.

## Global Constraints

- Target is BU `GR2VYNKQ` only. Any other BU code → exit 2 before any network call.
- Only the dev backend. Live run against a non-localhost backend requires `--yes` (same rule as `seed:master`); `--dry-run` never writes.
- Flags: `--dry-run`, `--yes`, `--skip-reset`, `--verbose`, `-h/--help`. Unknown flags throw (like `seed-master/index.ts parseArgs`).
- `--skip-reset` refuses to seed a BU that already holds any purchase request.
- Reset is called with header `x-deploy-token: $DATA_RESET_DEPLOY_TOKEN` (no user token). Token only in `.env.local`; `.env.example` gets the key with an empty value.
- Master data, workflows, mappings and period are written as `carmensoftware.dev+admin@gmail.com` (password via `getPasswordFor`). Not `admin@blueledgers.com`, not `SEED_EMAIL`.
- One login per account per run (token cache); never log in per call (backend 429 after 3 failed logins).
- No direct DB writes. No change to any role's permissions — step 0 only *checks*.
- Unit tests: vitest, files under `unit/data-reset/*.test.ts`, injected `fetchFn`, no network. Coverage threshold 80% applies (`vitest.config.ts`).
- Not wired into `bun run test` or the Playwright `setup` project.

## Facts the tasks rely on (verified 2026-11-05)

- Reset: `POST {backend}/api-system/tenant/resets/:bu_id`, `:bu_id` = BU **UUID** (from `GET /api/user/profile` → `data.business_unit[].id` where `code === "GR2VYNKQ"`). 200 → `{ bu_id, bu_code, schema, tables_truncated, rows_removed, seeds:{success,created,skipped} }` (possibly inside the standard `data` envelope — unwrap if present). 403 = BU not allow-listed or bad token; a 504/timeout does **not** mean nothing happened (`carmen-turborepo-backend/docs/ops-tenant-reset.md`).
- Tenant base seeds create no workflow, period, department, location or mapping.
- Profile: `GET /api/user/profile` → `data.business_unit:[{id,code,is_default,...}]`, `data.id` = user id (platform schema, survives reset).
- Permission check for another user: `GET /api/config/GR2VYNKQ/user-application-roles/:user_id` → `application_roles[].application_role_id`; then `GET /api/config/GR2VYNKQ/application-roles/:id` → `permissions:[{resource, action, is_granted}]`.
- Permission keys purchase needs (`carmen-frontend/constant/module-list.ts`): `vendor_management.vendor.view`, `product_management.category.view`, `vendor_management.request_price_list.view` (Campaign = `/vendor-management/request-price-list`).
- Workflows: `GET/POST /api/config/GR2VYNKQ/workflows`, `GET /workflows/:id`; body `{ name, workflow_type, description, data, is_active }`; `workflow_type` ∈ `purchase_request | purchase_order | …`. `data = { stages[], routing_rules[], products?, notifications?, document_reference_pattern? }`; `stages[].assigned_users[]` are objects `{ user_id, email, firstname, lastname, initials, department:{id,name} }`; `is_hod:true` stages resolve from the department's HOD. "First" workflow = what the PR/PO form's first option shows.
- Departments: `GET /api/config/GR2VYNKQ/departments`, `PATCH /departments/:id` with `{ department_users:{add:[{id}]}, hod_users:{add:[{id}]} }`. Do **not** use `POST /department-users` (NotImplemented).
- Locations per user: `PUT /api/config/GR2VYNKQ/locations-users/:userId` with `{ location_ids: string[] }` — replaces the user's set.
- Period: `POST /api/GR2VYNKQ/inventory-periods` with `{ fiscal_year, fiscal_month, start_at }` (status defaults to `open`, `end_at` defaults to month end); `GET /api/GR2VYNKQ/inventory-periods/current`.
- seed-master exports `resolveConfig`, `login`, `createApiClient` (`get`/`post` only), `readWorkbookFile`, `extractRows`, `runSeed`, `resolveWorkbookPath`, `printSummary`; its `main()` is not exported.

## Review Focus

- **Reset returns 504 / times out** → the command must not report success or carry on seeding blind; it stops, says the reset may have completed, and tells the operator to rerun with `--skip-reset` once the BU is confirmed empty. Test in Task 2.
- **A test account is missing from TEST BU, or TEST BU is not its default** → stop before the reset with the account and what is wrong; never wipe a BU the tests cannot log into. Test in Task 3.
- **The captured workflow fixture references a department by an id that no longer exists after reset** → ids are remapped by department *name*; a name that is no longer present fails loudly instead of posting a dangling id. Test in Task 5.
- **Today is the 1st or last day of the month / a period for this month already exists** → period plan uses the calendar month containing today (UTC+7, the BU's local date) and a rerun with `--skip-reset` that finds the period already open skips it instead of failing. Test in Task 6.
- **seed-master reports failures for some rows** → `data:reset` exits non-zero after printing the summary; mappings, workflows and period are not attempted on a half-seeded BU. Test in Task 7.

---

### Task 1: CLI, config and the role-session client

**Files:**
- Create: `scripts/data-reset/cli.ts`, `scripts/data-reset/config.ts`, `scripts/data-reset/sessions.ts`
- Modify: `scripts/seed-master/api-client.ts` (add `put`, `patch` to `ApiClient`)
- Modify: `.env.example` (add `DATA_RESET_DEPLOY_TOKEN=` with a Thai comment: dev only, same value as backend `TENANT_DEPLOY_TOKEN`)
- Test: `unit/data-reset/cli.test.ts`, `unit/data-reset/config.test.ts`, `unit/data-reset/sessions.test.ts`, extend `unit/seed-master/api-client.test.ts`

**Interfaces:**
- Produces:
  - `parseResetArgs(argv: string[]): ResetArgs` — `ResetArgs = { dryRun: boolean; yes: boolean; skipReset: boolean; verbose: boolean; help: boolean }`
  - `resolveResetConfig(env = process.env): ResetConfig` — `ResetConfig = { backendUrl: string; xAppId: string; buCode: "GR2VYNKQ"; deployToken: string | undefined; adminEmail: string }`; backend URL / app id resolved exactly as seed-master's `resolveConfig` does (`SEED_BACKEND_URL` / `SEED_X_APP_ID` / `SEED_CONFIG_PATH`), but BU fixed to `BU_CODE` and email fixed to the admin test account.
  - `ApiClient.put(path, body)`, `ApiClient.patch(path, body)` → `{ status, ok, body }` (same shape as `post`).
  - `createSessions(cfg: ResetConfig, fetchFn = fetch): Sessions` — `Sessions.client(email: string): Promise<ApiClient>` logs in once per email (password from `getPasswordFor`) and caches the client; a failed login is not cached.

- [ ] **Step 1: Write the failing tests**
  - `parseResetArgs(["--yes","--skip-reset"])` → `{ yes:true, skipReset:true, dryRun:false, verbose:false, help:false }`; `parseResetArgs(["--bu","X"])` throws `/unknown flag/i` (there is no `--bu`: the BU is fixed).
  - `resolveResetConfig({ SEED_BACKEND_URL:"https://h", SEED_X_APP_ID:"a", DATA_RESET_DEPLOY_TOKEN:"t" })` → `{ backendUrl:"https://h", xAppId:"a", buCode:"GR2VYNKQ", deployToken:"t", adminEmail:"carmensoftware.dev+admin@gmail.com" }`; without `DATA_RESET_DEPLOY_TOKEN` → `deployToken: undefined` (only a live reset needs it).
  - `api-client`: `put("/x",{a:1})` sends method `PUT` with JSON body and the bearer + `x-app-id` headers; same for `patch`.
  - `sessions`: two `client("a@x")` calls → one `/api/auth/login` request; `client("b@x")` → a second; a login that returns 401 rejects, and the next `client("a@x")` logs in again.
- [ ] **Step 2: Run** `bun run test:unit -- unit/data-reset unit/seed-master/api-client.test.ts` — Expected: FAIL (modules not found / `put` is not a function).
- [ ] **Step 3: Implement** the four functions in the files above; `sessions.ts` wraps seed-master `login` + `createApiClient`.
- [ ] **Step 4: Run** the same command — Expected: PASS, and the existing `unit/seed-master/*` tests still pass.
- [ ] **Step 5: Commit** `feat(data-reset): CLI, config และ client ต่อบัญชี`

### Task 2: Call the reset endpoint

**Files:**
- Create: `scripts/data-reset/reset.ts`
- Test: `unit/data-reset/reset.test.ts`

**Interfaces:**
- Consumes: `ResetConfig` (Task 1).
- Produces: `findBuId(profileBody: unknown, buCode: string): string` (throws `"<code> is not in this account's business units"`); `callReset(cfg: ResetConfig, buId: string, fetchFn = fetch): Promise<ResetOutcome>` — `ResetOutcome = { ok: true; summary: ResetSummary } | { ok: false; reason: "refused" | "unknown"; message: string }`; `ResetSummary` mirrors the backend response above.

- [ ] **Step 1: Write the failing tests**
  - `findBuId({ data:{ business_unit:[{id:"u1",code:"OTHER"},{id:"u2",code:"GR2VYNKQ"}] } }, "GR2VYNKQ")` → `"u2"`; missing → throws.
  - `callReset` sends `POST {backendUrl}/api-system/tenant/resets/u2` with header `x-deploy-token: t` and **no** `authorization` header.
  - 200 with `{ data:{ bu_code:"GR2VYNKQ", tables_truncated:197, rows_removed:{}, seeds:{success:true,created:120,skipped:0} } }` → `ok:true`, summary unwrapped.
  - 200 whose `bu_code` is not `GR2VYNKQ` → `ok:false, reason:"unknown"` (never trust a reset of the wrong BU as success).
  - 403 → `ok:false, reason:"refused"`, message names `TENANT_RESET_ALLOWED_BU_CODES` and the token.
  - 504, and a `fetchFn` that rejects (timeout) → `ok:false, reason:"unknown"`, message contains `"may have completed"` and `"--skip-reset"`.
  - `deployToken` undefined → throws before calling `fetchFn` (`DATA_RESET_DEPLOY_TOKEN is not set`).
- [ ] **Step 2: Run** `bun run test:unit -- unit/data-reset/reset.test.ts` — Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `findBuId` and `callReset` in `scripts/data-reset/reset.ts`.
- [ ] **Step 4: Run** the same — Expected: PASS.
- [ ] **Step 5: Commit** `feat(data-reset): เรียก endpoint reset BU`

### Task 3: Step 0 — verify memberships and purchase permissions

**Files:**
- Create: `scripts/data-reset/verify-env.ts`
- Test: `unit/data-reset/verify-env.test.ts`

**Interfaces:**
- Consumes: `Sessions` (Task 1), `findBuId` (Task 2), `TEST_USERS`, `BU_CODE` (`tests/test-users.ts`).
- Produces:
  - `checkMembership(email: string, profileBody: unknown, buCode: string): string | null` — `null` when OK, else a one-line problem (`"<email>: not a member of GR2VYNKQ"` / `"<email>: default BU is <code>, not GR2VYNKQ"`).
  - `REQUIRED_PURCHASE_PERMISSIONS = ["vendor_management.vendor.view", "product_management.category.view", "vendor_management.request_price_list.view"]`
  - `missingPermissions(roles: Array<{ permissions: Array<{ resource: string; action: string; is_granted: boolean }> }>, required: string[]): string[]` — a key is satisfied when **any** of the user's roles grants `resource.action`.
  - `verifyEnvironment(sessions: Sessions, cfg: ResetConfig): Promise<{ problems: string[]; userIds: Record<string, string>; buId: string }>` — logs in each of the 9 `TEST_USERS`, collects problems, records each user's `data.id`, takes `buId` from the admin's profile, reads purchase's roles **as admin**.

- [ ] **Step 1: Write the failing tests**
  - `checkMembership` for: member + default → `null`; member, default false (another BU default) → names that BU; not a member → "not a member".
  - `missingPermissions([{permissions:[{resource:"vendor_management.vendor",action:"view",is_granted:true}]},{permissions:[{resource:"product_management.category",action:"view",is_granted:false}]}], REQUIRED_PURCHASE_PERMISSIONS)` → `["product_management.category.view","vendor_management.request_price_list.view"]`.
  - `verifyEnvironment` with a stubbed `fetchFn` where `hod`'s profile has `is_default:false` → `problems` has exactly one entry naming `carmensoftware.dev+hod@gmail.com`; `userIds` has 9 entries.
- [ ] **Step 2: Run** `bun run test:unit -- unit/data-reset/verify-env.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** in `scripts/data-reset/verify-env.ts`. Problem text for permissions: `"purchase lacks <key> in GR2VYNKQ — grant it once in the purchase role (platform schema, survives every reset)"`.
- [ ] **Step 4: Run** the same — Expected: PASS.
- [ ] **Step 5: Commit** `feat(data-reset): ตรวจสมาชิก BU และสิทธิ์ purchase ก่อน reset`

### Task 4: Capture the workflow fixture (one-time, live, read-only)

TEST BU still has the workflows the specs were written against; capture them **before** the first reset.

**Files:**
- Create: `scripts/data-reset/capture-workflows.ts` (CLI: `bun run scripts/data-reset/capture-workflows.ts`), `scripts/data-reset/fixtures/workflows.json` (output, committed)
- Test: `unit/data-reset/capture-workflows.test.ts`

**Interfaces:**
- Produces: `WorkflowFixture = { captured_at: string; bu_code: "GR2VYNKQ"; workflows: Array<{ order: number; name: string; workflow_type: "purchase_request" | "purchase_order"; description: string | null; is_active: boolean; data: unknown }> }`; `selectFirstWorkflows(list: Array<{ id: string; name: string; workflow_type: string; is_active: boolean }>): { pr: string[]; po: string[] }` — ids of active PR / PO workflows in the order the list endpoint returns them (the form shows the first); `toFixtureEntry(detail: unknown, order: number): WorkflowFixture["workflows"][number]`.

- [ ] **Step 1: Write the failing test** — `selectFirstWorkflows` keeps only active `purchase_request` / `purchase_order` rows, preserving order; `toFixtureEntry` drops `id`, `doc_version`, `created_*`, `updated_*`, and `data.available_stage_role` (server recomputes it) and keeps `data` otherwise verbatim.
- [ ] **Step 2: Run** `bun run test:unit -- unit/data-reset/capture-workflows.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement**: as admin, `GET /api/config/GR2VYNKQ/workflows?perpage=100`, then `GET /workflows/:id` for every active PR/PO workflow; write the fixture (pretty JSON). No writes to the backend.
- [ ] **Step 4: Run** the unit test (PASS), then the capture **once against dev**: `bun run scripts/data-reset/capture-workflows.ts`. Expected: fixture with ≥1 `purchase_request` (first one has an HOD stage, a Purchase stage and a GM stage reachable by a routing rule) and ≥1 `purchase_order` whose first is "General PO" with stages create (purchase) → FC → GM. If the live first workflows do not match that, stop and report — do not hand-edit the fixture.
- [ ] **Step 5: Commit** `feat(data-reset): เก็บ workflow PR/PO ของ TEST BU เป็น fixture` (script + fixture + test).

### Task 5: Mappings and workflows after master data

**Files:**
- Create: `scripts/data-reset/mappings.ts`, `scripts/data-reset/workflows.ts`
- Test: `unit/data-reset/mappings.test.ts`, `unit/data-reset/workflows.test.ts`

**Interfaces:**
- Consumes: `Sessions`, `userIds` (Task 3), `WorkflowFixture` (Task 4).
- Produces:
  - `planDepartmentAssignments(departments: Array<{ id: string; code: string; name: string }>, userIds: Record<string, string>): Array<{ departmentId: string; body: { department_users: { add: {id:string}[] }; hod_users?: { add: {id:string}[] } } }>` — departments sorted by `code`; the **first** gets all 9 users as members and hod as HOD; the **second** gets `owner` as member (the "second department with a requester" for FC). Fewer than 2 departments → throws.
  - `planLocationAssignments(locationIds: string[], userIds: Record<string, string>): Array<{ userId: string; body: { location_ids: string[] } }>` — every one of the 9 users gets every location (my call: the specs never test a location being *absent*).
  - `remapWorkflow(wf: WorkflowFixture["workflows"][number], departmentsByName: Map<string, { id: string; name: string }>): { name: string; workflow_type: string; description: string | null; is_active: boolean; data: unknown }` — rewrites every `stages[].assigned_users[].department.id` by `department.name`; an unknown name throws `"workflow <name>: department <dept> not found after reset"`. User ids are kept (platform schema).
  - `checkMasterShape(snapshot: { departments: number; locations: number; firstVendor: { code: string; email: string | null } | null }): string[]` — spec step 1: problems when departments < 2, locations < 2, or the first vendor (sorted by code) has no email. Par/reorder levels belong to plan 3 (stock tiers). `seedMappings` runs it first and fails the step on any problem.
  - `seedMappings(sessions, cfg, userIds): Promise<StepResult>` and `seedWorkflows(sessions, cfg, fixture): Promise<StepResult>` — `StepResult = { step: string; created: number; skipped: number; failed: string[] }`. Workflows are POSTed in fixture `order`, so the first stays first. A workflow whose name already exists is `skipped` (for `--skip-reset` reruns).

- [ ] **Step 1: Write the failing tests**
  - `planDepartmentAssignments` with departments `[{code:"B"},{code:"A"}]` → first plan targets `A`, has 9 members and `hod_users.add = [{id: userIds["carmensoftware.dev+hod@gmail.com"]}]`; second targets `B` with `owner` only and no `hod_users`; with one department → throws.
  - `planLocationAssignments(["l1","l2"], nineUsers)` → 9 entries, each `location_ids:["l1","l2"]`.
  - `remapWorkflow` maps `department:{id:"old",name:"Kitchen"}` to the new Kitchen id in every stage; unknown `"Bar"` → throws with that message.
  - `seedWorkflows` with a stub that already lists `"General PO"` → POSTs only the others, `skipped:1`.
  - `checkMasterShape({departments:1, locations:2, firstVendor:{code:"A001", email:null}})` → two problems (departments, vendor email); `{2, 2, {A001, "a@x"}}` → `[]`.
- [ ] **Step 2: Run** `bun run test:unit -- unit/data-reset/mappings.test.ts unit/data-reset/workflows.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** both files (PATCH departments, PUT locations-users, POST workflows; list endpoints with `?perpage=100`).
- [ ] **Step 4: Run** the same — Expected: PASS.
- [ ] **Step 5: Commit** `feat(data-reset): ผูก user กับแผนก/location และสร้าง workflow จาก fixture`

### Task 6: Open inventory period covering today

**Files:**
- Create: `scripts/data-reset/period.ts`
- Test: `unit/data-reset/period.test.ts`

**Interfaces:**
- Produces: `planPeriod(now: Date): { fiscal_year: number; fiscal_month: number; start_at: string }` — month containing `now` in `Asia/Bangkok`, `start_at` = `YYYY-MM-01`; `seedPeriod(sessions, cfg, now = new Date()): Promise<StepResult>` — `GET .../inventory-periods/current`; if it is open and covers today → `skipped:1`; else POST `planPeriod(now)`.

- [ ] **Step 1: Write the failing tests** — `planPeriod(new Date("2026-11-30T20:00:00Z"))` → `{ fiscal_year:2026, fiscal_month:12, start_at:"2026-12-01" }` (03:00 on 1 Dec in Bangkok); `planPeriod(new Date("2026-11-05T00:00:00Z"))` → month 11, `"2026-11-01"`; `seedPeriod` with a current open period covering today → no POST, `skipped:1`; with 404/empty current → one POST with the planned body.
- [ ] **Step 2: Run** `bun run test:unit -- unit/data-reset/period.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** in `scripts/data-reset/period.ts`.
- [ ] **Step 4: Run** the same — Expected: PASS.
- [ ] **Step 5: Commit** `feat(data-reset): เปิดงวดสินค้าคงคลังที่ครอบวันนี้`

### Task 7: The command — orchestrate, dry run, docs

**Files:**
- Create: `scripts/data-reset/index.ts` (entry, `if (import.meta.main)`), `scripts/data-reset/README.md`
- Modify: `package.json` (`"data:reset": "bun run scripts/data-reset/index.ts"`), `CLAUDE.md` (short "Standard test dataset (`data:reset`)" section: what it does, that it is manual, needs `DATA_RESET_DEPLOY_TOKEN` in `.env.local`, plan 3 adds documents)
- Test: `unit/data-reset/run.test.ts`

**Interfaces:**
- Consumes: everything above; seed-master `readWorkbookFile`, `extractRows`, `runSeed`, `resolveWorkbookPath("avg")`, `printSummary`.
- Produces: `runDataReset(args: ResetArgs, cfg: ResetConfig, deps: { fetchFn?: typeof fetch; now?: Date; log?: (line: string) => void }): Promise<number>` (exit code). Order: refuse non-local without `--yes` (unless dry run) → `verifyEnvironment` (problems → exit 1, nothing written) → `--skip-reset` ? refuse if any PR exists : `callReset` (not ok → exit 1) → seed master (`runSeed`, same defaults as `seed:master`; any failed row → print summary, exit 1) → `seedMappings` → `seedWorkflows` → `seedPeriod` → print one summary table (step, created, skipped, failed) → exit 0 iff nothing failed. Dry run: performs only GETs (verify, list) and prints every planned write, calling no POST/PUT/PATCH and not the reset.

- [ ] **Step 1: Write the failing tests** (stubbed `fetchFn` that records method + path):
  - dry run → recorded methods are all `GET` (login POSTs aside); output lists the reset, master entities, mapping, workflow and period writes.
  - live without `--yes` against `https://dev…` → exit 2, zero requests.
  - a step-0 problem → exit 1, no request to `/api-system/tenant/resets/`.
  - reset `ok:false` → exit 1, no POST to `/api/config/`.
  - `runSeed` result with one failed row → exit 1, no request to `/workflows` or `/inventory-periods`.
  - `--skip-reset` with a non-empty PR list → exit 1 before any write (the PR list path is the one `docs/sample-data-procurement-flow.md` in the backend uses; "non-empty" = `paginate.total > 0` or a non-empty `data` array).
  - happy path → exit 0; order of first write per step is reset → master → departments → locations-users → workflows → inventory-periods.
- [ ] **Step 2: Run** `bun run test:unit -- unit/data-reset/run.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** `runDataReset` + CLI wrapper (`--help` prints usage), README (flags, env, order, "504 does not mean nothing happened"), package.json script, CLAUDE.md section.
- [ ] **Step 4: Run** `bun run test:unit:coverage` — Expected: PASS incl. the 80% gate. Then `bun run data:reset --dry-run` against dev — Expected: exit 0, or exit 1 listing real step-0 problems (e.g. purchase permissions) — report them, do not change roles; only GETs either way.
- [ ] **Step 5: Commit** `feat(data-reset): คำสั่ง data:reset (reset → ตรวจ → master → mapping → workflow → งวด)`
- [ ] **Step 6 (only after backend PR #1004 is deployed to dev and the user says so):** `bun run data:reset --yes` once. Expected: exit 0; then, in the app, the PR form's first workflow as requestor is the captured one, and Vendor / Product Category / Campaign open as purchase. Put the run's summary in the PR description.
