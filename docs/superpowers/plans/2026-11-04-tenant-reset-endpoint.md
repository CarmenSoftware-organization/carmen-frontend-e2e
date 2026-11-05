# Tenant Reset Endpoint Implementation Plan (plan 1 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A guarded backend endpoint that empties one allow-listed BU's tenant schema and re-applies the tenant base seeds, so TEST BU (`GR2VYNKQ`) can always be returned to a freshly-provisioned state.

**Architecture:** Same shape as the existing tenant-seeds feature. `micro-business` gets a `tenant_reset` module (service does the work against a short-lived tenant Prisma client; an RPC handler exposes it). `backend-gateway` gets a `tenant-resets` controller behind `TenantMigrationGuard`, proxying over the HTTP-RPC transport. After truncating, the reset service reuses `TenantSeedService.deployStream` to re-apply base seeds.

**Tech Stack:** NestJS, Prisma (tenant + backstage schemas, `@prisma/adapter-pg`), Zod env config, Jest, `@repo/rpc-contract` (generated).

**Repo:** `/Users/samutpra/Github/CarmenSoftware-organization/carmen-turborepo-backend` — all paths below are relative to it. Follow its `CLAUDE.md` (one export per file, ≤20 statements per function, camelCase locals / snake_case at wire boundary, bilingual JSDoc like the neighbouring files).

**Spec:** `carmen-frontend-e2e/docs/superpowers/specs/2026-11-04-standard-test-dataset-design.md` → "Decided §1".

**Later plans (not this one):** plan 2 = e2e `data:reset` skeleton (call reset, verify step 0, workflows, period, user mappings, master data); plan 3 = documents + stock + verification.

## Global Constraints

- Only BU codes listed in env `TENANT_RESET_ALLOWED_BU_CODES` (comma-separated, trimmed) may be reset. Empty/unset ⇒ every reset refused.
- Gateway route sits behind `TenantMigrationGuard` (`TENANT_MIGRATION_API_ENABLED` + `x-deploy-token` = `TENANT_DEPLOY_TOKEN`, or bearer with backstage permission). New permission key: `tenant_reset.apply`.
- Never touch the platform (backstage) schema or any schema other than the target BU's `db_schema`.
- Before deleting, `SELECT current_schema()` on the tenant client must equal the BU's schema; otherwise abort with no writes.
- Keep `_prisma_migrations` (all other tables in the schema are emptied).
- Truncation runs in one transaction; a failure leaves the schema unchanged.
- Idempotent: resetting an empty BU succeeds.
- RPC contract changes go through `bun run gen:rpc-contract` (never hand-edit `packages/rpc-contract/src/contracts/*`), then `bun run audit:tcp-drift` must pass.

## Review Focus

- **A BU code not on the allow-list (or an empty allow-list)** → refused with FORBIDDEN before any connection to the tenant DB is opened. Test in Task 1.
- **Connection string whose `?schema=` differs from `db_schema`** (the backend CLAUDE.md gotcha) → abort, zero statements run. Test in Task 1.
- **Truncate fails half-way** (e.g. lock timeout) → error surfaces as a failed Result, no seeds re-applied, nothing reported as success. Test in Task 1.
- **Seeds fail after a successful truncate** → response says truncate succeeded and seeds failed (so the operator knows the BU is empty but unseeded), not a generic 500. Test in Task 1.
- **Table names with mixed case / reserved words** → every identifier double-quoted and schema-qualified in the TRUNCATE statement. Test in Task 1 (`buildTruncateSql`).

---

### Task 1: Reset service in micro-business

**Files:**
- Create: `apps/micro-business/src/authen/tenant_reset/tenant_reset.service.ts`
- Create: `apps/micro-business/src/authen/tenant_reset/build-truncate-sql.ts`
- Create: `apps/micro-business/src/authen/tenant_reset/is-bu-reset-allowed.ts`
- Create: `apps/micro-business/src/authen/tenant_reset/tenant-reset-summary.ts` (type)
- Modify: `apps/micro-business/src/libs/config.env.ts` (add `TENANT_RESET_ALLOWED_BU_CODES: z.string().default('')` next to `TENANT_MIGRATION_TIMEOUT_MS`, both in the schema ~line 140 and the export ~line 201)
- Modify: `apps/micro-business/.env.example` (add `TENANT_RESET_ALLOWED_BU_CODES=` under the `TENANT_*` block, with a one-line Thai comment that it must stay empty outside dev)
- Test: `apps/micro-business/src/authen/tenant_reset/tenant_reset.service.spec.ts`, `build-truncate-sql.spec.ts`, `is-bu-reset-allowed.spec.ts`

**Interfaces:**
- Consumes: `TenantService.resolveConnectionForBusinessUnit(bu)`, `PRISMA_SYSTEM` injection, `TenantSeedService.deployStream(bu_id, keys?) : Observable<SeedProgressEvent>` (all existing; copy `resolveConnection` / `createTenantClient` from `tenant_seed.service.ts:39-91`, which itself mirrors `TenantMigrationService`).
- Produces:
  - `isBuResetAllowed(buCode: string, allowList: string): boolean`
  - `buildTruncateSql(schema: string, tables: string[]): string`
  - `interface TenantResetSummary { bu_id: string; bu_code: string; schema: string; tables_truncated: number; rows_removed: Record<string, number>; seeds: { success: boolean; created: number; skipped: number } }`
  - `TenantResetService.reset(bu_id: string): Promise<Result<TenantResetSummary>>`
  - `protected TenantResetService.createTenantClient(database_url: string): TenantResetDb` (test seam, same as the seed service), where `TenantResetDb` exposes only `$queryRawUnsafe`, `$executeRawUnsafe`, `$transaction`, `$disconnect`.

- [ ] **Step 0: Branch** — in the backend repo, from an up-to-date `main`: `git switch -c feature/tenant-reset-endpoint`. All commits in this plan go there.

- [ ] **Step 1: Write failing tests for the pure helpers**

`is-bu-reset-allowed.spec.ts`:
- `isBuResetAllowed('GR2VYNKQ', 'GR2VYNKQ')` → `true`
- `isBuResetAllowed('GR2VYNKQ', ' GR2VYNKQ , OTHER ')` → `true`
- `isBuResetAllowed('CARMEN-AVG', 'GR2VYNKQ')` → `false`
- `isBuResetAllowed('GR2VYNKQ', '')` → `false`
- `isBuResetAllowed('gr2vynkq', 'GR2VYNKQ')` → `false` (exact match, no case folding)

`build-truncate-sql.spec.ts`:
- `buildTruncateSql('T_1', ['tb_a', 'Order'])` → `'TRUNCATE TABLE "T_1"."tb_a", "T_1"."Order" RESTART IDENTITY CASCADE'`
- identifier containing `"` is escaped by doubling (`'a"b'` → `"a""b"`)
- `buildTruncateSql('S', [])` throws `'no tables to truncate'`

- [ ] **Step 2: Run, confirm they fail**

Run: `cd apps/micro-business && bunx jest src/authen/tenant_reset -t "isBuResetAllowed|buildTruncateSql"`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement both helpers** in their files (one export each).

- [ ] **Step 4: Run, confirm they pass** (same command). Expected: PASS.

- [ ] **Step 5: Write failing tests for `TenantResetService.reset`**

Build the service with a fake `prismaSystem.tb_business_unit.findFirst`, a fake `TenantService.resolveConnectionForBusinessUnit` returning `postgresql://u:p@h:5432/postgres?schema=GR2VYNKQ_SCHEMA`, a fake `TenantSeedService.deployStream` (rxjs `of(...)` of `start` + `done`), and override `createTenantClient` to return a fake recording every SQL string. Set `envConfig.TENANT_RESET_ALLOWED_BU_CODES` per test (follow how existing specs override `envConfig`).

Cases (`describe('TenantResetService.reset')`):
1. `rejects a malformed bu_id` → `Result` error, `ErrorCode.INVALID_ARGUMENT`, no `createTenantClient` call.
2. `refuses a BU not on the allow-list` (BU code `CARMEN-AVG`, allow-list `GR2VYNKQ`) → error with `ErrorCode.FORBIDDEN` (use the closest existing code in `@/common` `ErrorCode` if `FORBIDDEN` is not defined — check first), no `createTenantClient` call.
3. `aborts when current_schema() differs from db_schema` (fake returns `public`) → error, recorded SQL contains no `TRUNCATE`, `deployStream` not called, `$disconnect` called.
4. `truncates every table except _prisma_migrations, then re-seeds` → fake table list `['tb_a','tb_b','_prisma_migrations']`; recorded TRUNCATE equals `buildTruncateSql(schema, ['tb_a','tb_b'])`; executed inside `$transaction`; summary `tables_truncated: 2`, `rows_removed` has counts for `tb_a`/`tb_b` taken **before** truncating; `seeds.success: true` with created/skipped from the `done` event.
5. `reports truncate failure without seeding` → fake `$transaction` rejects; result is an error; `deployStream` not called.
6. `reports seed failure after a successful truncate` → `deployStream` emits `{ type: 'error', message: 'boom' }`; result is **ok** with `seeds.success: false` (the BU is empty; the operator must see that), and `tables_truncated` still reported.
7. `succeeds on an empty BU` → row counts all 0, result ok.
8. Every path calls `$disconnect` exactly once on the client it created.

- [ ] **Step 6: Run, confirm failure.** `bunx jest src/authen/tenant_reset/tenant_reset.service.spec.ts` → FAIL.

- [ ] **Step 7: Implement `TenantResetService`.**
  Order inside `reset`: validate UUID → load BU (`id, code, db_schema, tb_database_pool`) → allow-list check (before opening any tenant connection) → resolve URL → create client → `SELECT current_schema()` must equal `db_schema` → list tables from `information_schema.tables WHERE table_schema = $1 AND table_type = 'BASE TABLE' AND table_name <> '_prisma_migrations'` → count rows per table → `$transaction` running `buildTruncateSql` → `lastValueFrom(deployStream(bu_id).pipe(toArray()))` and read the `done` / `error` event → `$disconnect` in `finally`. Keep each method ≤20 statements (split into private helpers). Log one structured `tenant-reset.done` line with bu_code, tables_truncated, seeds.success.

- [ ] **Step 8: Run, confirm pass.** Same command → PASS. Then `cd apps/micro-business && bunx tsc --noEmit -p .` → no errors.

- [ ] **Step 9: Commit**

```bash
git add apps/micro-business/src/authen/tenant_reset apps/micro-business/src/libs/config.env.ts apps/micro-business/.env.example
git commit -m "feat(tenant-reset): service ล้าง schema ของ BU ที่อยู่ใน allow-list แล้ว seed ข้อมูลตั้งต้นใหม่"
```

---

### Task 2: RPC handler + contract

**Files:**
- Create: `apps/micro-business/src/authen/tenant_reset/tenant_reset.controller.ts`
- Create: `apps/micro-business/src/authen/tenant_reset/tenant_reset.module.ts` (imports what `TenantSeedModule` imports, plus `TenantSeedModule` — export `TenantSeedService` from it if it does not already)
- Modify: `apps/micro-business/src/app.module.ts` (register `TenantResetModule` next to `TenantSeedModule`, ~line 358)
- Generated: `packages/rpc-contract/src/contracts/tenant-resets.ts` + index export (via generator only)
- Test: `apps/micro-business/src/authen/tenant_reset/tenant_reset.controller.spec.ts`

**Interfaces:**
- Consumes: `TenantResetService.reset` (Task 1).
- Produces: RPC `TenantResets.reset` with pattern cmd `'tenant-resets.reset'`, service `'micro-business'`, payload `MicroservicePayload & { bu_id: string }`, returning `handleResult(Result<TenantResetSummary>)`.

- [ ] **Step 1: Failing test** — controller calls `reset(payload.bu_id)` once and returns `handleResult` of its value (mirror `tenant_seed.controller.spec.ts`).
- [ ] **Step 2: Run** `bunx jest src/authen/tenant_reset/tenant_reset.controller.spec.ts` → FAIL.
- [ ] **Step 3: Implement** the controller with the temporary literal `@MessagePattern({ cmd: 'tenant-resets.reset', service: 'micro-business' })`, the module, and the app.module registration.
- [ ] **Step 4: Generate the contract** — from repo root: `bun run gen:rpc-contract`; then replace the literal with `TenantResets.reset.pattern`.
- [ ] **Step 5: Run** the spec → PASS; `bun run audit:tcp-drift` → no drift reported for `tenant-resets`.
- [ ] **Step 6: Commit** `feat(tenant-reset): RPC handler tenant-resets.reset`.

---

### Task 3: Gateway endpoint

**Files:**
- Create: `apps/backend-gateway/src/backstage/tenant-resets/tenant-resets.controller.ts`
- Create: `apps/backend-gateway/src/backstage/tenant-resets/tenant-resets.service.ts`
- Create: `apps/backend-gateway/src/backstage/tenant-resets/tenant-resets.module.ts`
- Modify: `apps/backend-gateway/src/app.module.ts` (register next to `TenantSeedsModule`, ~line 216)
- Modify: `packages/prisma-shared-schema-backstage/prisma/seed.backstage-role-permission.data.ts` (add `tenant_reset.apply` beside `tenant_seed.apply`, same shape)
- Test: `tenant-resets.controller.spec.ts`, `tenant-resets.service.spec.ts` in the same folder

**Interfaces:**
- Consumes: `TenantResets.reset` (Task 2), `RpcClient`, `TenantMigrationGuard`, `RequireBackstagePermission`, `BaseHttpController.respond`.
- Produces: `POST /api-system/tenant/resets/:bu_id` → 200 with the `TenantResetSummary` envelope; 400 invalid bu_id; 403 disabled / no token / no permission / BU not allow-listed; 404 BU not found; 500 truncate failure. Swagger tag `Backstage: Tenant Resets`, `operationId: 'tenantReset_reset'`, `x-deploy-token` header documented exactly like `tenant-seeds.controller.ts:39-46`.

- [ ] **Step 1: Failing tests** — service: `reset('id')` calls `rpc.call(TenantResets.reset, { bu_id: 'id' })`. Controller: route metadata has `TenantMigrationGuard` and permission `tenant_reset.apply`; it writes an audit log line `event: 'tenant-reset.audit'` with actor and bu_id (copy `executeAuditLog` from `tenant-seeds.controller.ts:57-66`); it passes the Result to `respond`.
- [ ] **Step 2: Run** `cd apps/backend-gateway && bunx jest src/backstage/tenant-resets` → FAIL.
- [ ] **Step 3: Implement** controller, service, module, app.module registration, permission seed entry.
- [ ] **Step 4: Run** the specs → PASS; `bunx tsc --noEmit -p .` in `apps/backend-gateway` → clean.
- [ ] **Step 5: Commit** `feat(tenant-reset): endpoint POST api-system/tenant/resets/:bu_id`.

---

### Task 4: Whole-repo checks, docs, PR

**Files:**
- Modify: `apps/backend-gateway/.env.example` — comment next to `TENANT_MIGRATION_API_ENABLED` that the reset route shares this flag.
- Create: `docs/` entry following how the repo documents operator endpoints (look for the tenant-seeds/migrations doc; if none, add a short Thai section to `apps/backend-gateway/src/backstage/tenant-resets/README.md`): what it wipes, what it keeps (platform schema: users, roles, permissions, BU membership, calculation_method), env vars, curl example with `x-deploy-token`, and that `TENANT_RESET_ALLOWED_BU_CODES` must stay empty on UAT/prod.

- [ ] **Step 1:** From repo root run `bun run lint`, `bun run check-types`, `bun run audit:tcp-drift`, and `bun run test` scoped with turbo filter to `micro-business` and `backend-gateway`. Expected: all pass (report any pre-existing failures separately; do not fix unrelated ones).
- [ ] **Step 2:** Write the docs above.
- [ ] **Step 3:** Run `trail check` (backend repo uses trail too) and resolve or explain conflicts.
- [ ] **Step 4: Commit** `docs(tenant-reset): วิธีใช้และข้อควรระวัง`.
- [ ] **Step 5:** Push branch `feature/tenant-reset-endpoint` and open a PR against `main` describing the endpoint, the guard + allow-list, and the dev rollout steps: deploy, set `TENANT_RESET_ALLOWED_BU_CODES=GR2VYNKQ` on micro-business, ensure `TENANT_MIGRATION_API_ENABLED=true` and a deploy token on the gateway, re-run the backstage permission seed so `tenant_reset.apply` exists. The user reviews, merges and deploys.
