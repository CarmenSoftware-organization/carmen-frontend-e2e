# Standard Test Dataset for TEST BU (reset + seed) — Design

**Date:** 2026-11-04
**Status:** draft — awaiting approval (questions answered 2026-11-04)
**Builds on:** `2026-06-29-master-seed-from-excel-design.md` (master-data seeder, `scripts/seed-master`)
**Target:** BU `GR2VYNKQ` ("TEST BU") on the dev backend (`https://dev.blueledgers.com:4001`, as served by
`http://carmen-frontend.vercel.app/config.json`)

## Why

Two problems keep breaking runs (the user's words, paraphrased):

1. **Leftover data** — records created by an earlier run are still there; a rerun collides with them
   (duplicate codes, unexpected rows).
2. **Data not ready / not enough** — tests expect existing records (a PR waiting for HOD, a committed GRN,
   stock on hand…) that are not in the BU, so lookups find nothing and tests skip or fail.

The fix is a **standard dataset**: one known, identical state of TEST BU that can always be wiped and rebuilt.

## Goals

- One command, run by hand before a test run, that **resets TEST BU and seeds the standard dataset**.
- After it finishes, every spec in the default run (`setup` / `login` / `chromium` projects) finds the
  pre-existing master data, documents and stock it expects (table below).
- The dataset is the same every time (same shape, same counts, same states) so results are comparable
  between runs.
- Enough of each document for **one** full run. The user's decision: reset + seed **before every run**, so
  there is no need to stock up for several runs.

## Non-goals

- Not wired into `bun run test` / the Playwright `setup` project. **User's decision:** a separate command
  run manually before testing (consistent with `seed:master`, which never mutates a backend on its own).
- Not fixing test bugs found during the survey (selectors that can never match, stale routes — see
  "Out of scope findings"). That is separate work.
- Not the movement suite (`*-doc-flow`, `910–924` period close): it runs on CARMEN-AVG/FIFO with its own
  accounts.
- Not UAT/prod. Only TEST BU on dev.

## Anti-goals (would be a failure even if it "works")

- Able to wipe any BU other than TEST BU, or able to run against a non-dev backend.
- Wiping the 9 test accounts, their membership of TEST BU, or leaving them without the role permissions the
  specs need (that would break login and every test).
- Faking state by writing rows straight into the database: statuses, stock balances and costs must come out
  of the real document flow so they behave like real data.

## Decided

### 1. Reset is a new backend endpoint, built in `../carmen-turborepo-backend` (user's decision)

The user's decision: a reset-BU endpoint, and we build it ourselves in the backend repo
(`/Users/samutpra/Github/CarmenSoftware-organization/carmen-turborepo-backend`). It removes all business data
in TEST BU, including documents that are posted/committed (which the normal API refuses to delete — see
`scripts/movement/cleanup.ts`, "ถอยไม่ได้"). This e2e repo only **calls** it.

What the backend already has, and why the reset is tractable (verified 2026-11-04):

- Each BU's data is one **Postgres schema** (`tb_business_unit.db_schema` in the platform schema); the tenant
  Prisma schema (`packages/prisma-shared-schema-tenant`) has 198 models.
- Everything about **who can do what** lives in the **platform (backstage) schema**, not the BU schema:
  users, BU membership and default BU (`tb_user_tb_business_unit.is_default`), application roles per BU and
  their permissions (`tb_application_role`, `tb_application_role_tb_permission`,
  `tb_user_tb_application_role`), and the BU's costing method (`tb_business_unit.calculation_method`).
  **A reset that touches only the BU schema keeps all of these by construction.**
- In the BU schema, and therefore wiped and re-created by the seed: workflows (`tb_workflow`), running codes
  (`tb_config_running_code`), application config, inventory periods, and the user↔department /
  user↔location mappings (`tb_department_user`, `tb_location_user`) — the HOD's department, the locations
  each role can use.
- Operator endpoints with the right shape already exist and are the pattern to copy:
  `api-system/tenant/migrations/:bu_id/deploy` and `api-system/tenant/seeds/:bu_id/deploy/stream`, both
  behind `TenantMigrationGuard` (`TENANT_MIGRATION_API_ENABLED` + `x-deploy-token` header =
  `TENANT_DEPLOY_TOKEN`). The tenant-seeds endpoint re-creates a fresh BU's base rows (running codes,
  notification / email templates, etc.). `api-system/tenant/preconfig-imports` imports a Preconfig workbook
  server-side.

Requirements for the new endpoint:

- `POST api-system/tenant/resets/:bu_id` (path my call), same guard as migrations/seeds, **plus** an
  allow-list of BU codes from env (e.g. `TENANT_RESET_ALLOWED_BU_CODES=GR2VYNKQ`); anything else is refused.
  The env flag is off by default, so it can only work where someone turned it on (dev).
- Empties every table of that BU's schema (except Prisma's migration bookkeeping), in one transaction, then
  re-runs the tenant base seeds so the BU is in the same state as a freshly provisioned one.
- Never touches the platform schema or any other BU's schema; checks `current_schema()` against the target
  before deleting (the backend CLAUDE.md warns about connection strings pointing at the wrong schema).
- Returns a summary (rows removed per table, seeds re-applied); NDJSON stream like the seeds endpoint is fine.
- Idempotent: resetting an already-empty BU succeeds.
- Has unit tests in the backend's style and goes through that repo's PR process; then it must be **deployed
  to dev** and the flag + allow-list set there before `data:reset` can use it. **The user reviews, merges and
  deploys the backend PR themselves.** The e2e side can be built and dry-run in parallel; the first real
  reset waits for that deploy.

How to empty the tables (TRUNCATE … CASCADE vs dropping and re-deploying the schema) is left to the builder.

### 2. Seed builds documents through the real flow, via API (my call)

Documents are created and advanced through their workflow by calling the backend API **as the role that does
that step in real life** (requestor creates + submits a PR, HOD approves, purchase acts, FC/GM approve the PO,
etc.). No direct DB writes. Stock on hand comes from committed GRNs (and inventory adjustments where a GRN
cannot express it, e.g. expired lots or exact par-level gaps).

API rather than UI: faster and less flaky, and the frontend's own flows are what the tests themselves verify.

### 3. One command, manual (user's decision)

`bun run data:reset` (name is my call): reset → seed master → seed documents → verify → print a summary.
Flags in the style of `seed:master`: `--dry-run` (plan only, calls nothing that writes), `--yes` (required,
since the target is not localhost), `--skip-reset` (seed onto an already-reset BU, for debugging).
Refuses to run unless the BU is `GR2VYNKQ`.

## The standard dataset

Counts are the minimum for **one** full run. Several tests consume a document (approve / reject / submit /
close changes its state), which is why some counts are higher than one. Source: survey of the specs on
2026-11-04 (evidence lines in parentheses are `tests/<spec>:<line>`).

### Step 0 — environment the tests assume

Kept by the reset (platform schema) — `data:reset` only **verifies** these and stops with a clear message if
they are wrong:

- All 9 test accounts are members of TEST BU and have it as **default BU** (most specs never call
  `ensureActiveBu`; they rely on the account's default).
- Role permissions so each role reaches the modules its specs use. Today `purchase` gets "Permission Denied"
  on Vendor, Product Category and Campaign in TEST BU (23 failing cases in the 2026-11-04 run).
  **User's decision: `purchase` should have access to all three.** This is a one-time change to the purchase
  role's permissions in the platform schema; it survives every reset. `data:reset` checks it each run and stops
  with a clear message if it is missing. Making the change itself through the existing role-permission API
  (as admin) or by hand in the app is the builder's call; nothing else about other roles' permissions changes.

Wiped by the reset (BU schema) — the seed **re-creates** these before anything else:

- **First** PR workflow routes requestor → HOD (first approve stage) → Purchase, with a GM stage reached by
  high-value PRs (the table needs PRs waiting for GM). Tests pick the first workflow
  (`tests/pages/purchase-request.page.ts:223-311`). The exact stages and the GM threshold are copied from
  what 301/303/304 and `tests/pages/pr-approver.helpers.ts` expect (builder derives; my call).
- **First** PO workflow is "General PO": purchase → FC → GM → Approved (`tests/pages/po-approver.helpers.ts:162-177`).
- User↔department and user↔location mappings: the HOD heads the requestor's department; a second department
  exists with at least one requester; each role has the locations its specs use.
- An **open inventory period covering today**, so GRN / CN / adjustment / SR issue can post. Opening it is
  normally irreversible, but on TEST BU the next reset undoes it, so the seed does it without the
  `E2E_ALLOW_IRREVERSIBLE` gate (my call).
- **Costing method** stays whatever TEST BU has in the platform schema (default `average`; my call is to keep
  AVG, which is what the main suite was written against). On an AVG BU a GRN posts stock when *saved*
  (CLAUDE.md, TC-GRN-700005 vs TC-GRN-140003), so the "GRN Draft" and "GRN Received (not committed)" rows may
  not be reachable through the real flow; the builder checks this first and, if so, drops those rows from
  the table and from step 3 and reports which 501 cases will skip.

### Step 1 — master data

Reuse `scripts/seed-master` (Excel `sample_seed_data/Preconfig_CARMEN_AVG.xlsx`, sample subset), pointed at
`GR2VYNKQ`. Extra constraints from the specs:

- The **first** vendor card (code like `A001`) has products available at the **first** location, and an email
  on file (so the PO send-to-vendor flow can complete — `401:370-372`).
- At least 2 locations with stock (`711`), at least 2 departments with PRs (`303:752-781`).
- Products carry reorder / par levels so `711` can show Critical, Warning and Low tiers.

### Step 2 — documents and stock

| Document | State | Min | Used by (role) | Must also have |
|---|---|---|---|---|
| PR | Draft, owned by requestor | 3 | requestor | ≥1 line item |
| PR | Waiting for HOD | 18 | HOD, requestor | some with ≥2 items; FOC item; price > 20% over (`301:460001-5`) |
| PR | Waiting for Purchase (after HOD) | 8 | purchase | vendor, unit price, tax profile on items; one high-value |
| PR | Waiting for GM | 2 | GM | high value |
| PR | Approved, eligible for PO | 5 | purchase | one without delivery date (`301:410003`) |
| PR | Returned, Rejected, Void, Completed | 1 each | requestor, purchase | — |
| PR | From a second department | ≥1 | FC | — |
| PR Template | Active | 1 | requestor, purchase | line items |
| PO | Draft, Rejected, Approved, Sent, Completed | 1 each | purchase, requestor | — |
| PO | Sent, partially received | 1 | purchase | linked GRN |
| GRN | Draft | 1 | purchase | ≥2 items |
| GRN | Received (not committed) | 1 | purchase | one item without storage location |
| GRN | Committed | 1 | purchase, requestor | — |
| Credit Note | Draft (items with lots), Committed | 1 each | purchase, requestor | — |
| Store Requisition | Draft, created by purchase | 2 | purchase | source + destination location, items |
| Store Requisition | Waiting at purchase's approve stage | 2 | purchase | — |
| Store Requisition | Ready for issuance, Cancelled, Completed | 1 each | purchase, requestor | stock at source location |
| Stock | On hand at ≥2 locations | — | admin | — |
| Stock | Expired lot, near-expiry lot | ≥1 each | admin | lot no., expiry, cost |
| Stock | Below reorder: Critical, Warning, Low | 1 per tier | admin | — |
| Price List | Active and currently valid | 3 | purchase | vendor + products (`159` expires/rewrites the first two before `402` runs) |
| Campaign (RFP) | Active, Draft, Expired | 1 each | purchase | vendors attached, template |

Specs that create everything they need themselves (need nothing from step 2): `304`, `311`, `403`, `602`, `160`.

### Step 3 — verify and summarise

After seeding, read back counts per document type and state **for the whole BU** and compare to the table;
exit non-zero and say which rows are short. Print the doc numbers created per row so a failing test can be
traced to its seed. Because the counts are for the whole BU, `--skip-reset` refuses to seed a BU that already
holds documents (my call) — the seed is not written to be resumed half-way.

## Who calls what (my call)

- The reset endpoint is called with the deploy token (`x-deploy-token`), not with a user account, so none of
  the 9 role accounts can trigger it. Token and URL in `.env.local` only.
- Master data, workflows, price lists and periods are seeded as `carmensoftware.dev+admin@gmail.com` (a member
  of TEST BU). Documents are created and moved as the role that does each step (requestor, hod, purchase, fc,
  gm). The `admin@blueledgers.com` / `DEMO` values in today's `.env` belong to the old seed target and are not
  used.

## Constraints

- `workers: 1` and file order mean specs run in a fixed order and consume documents; counts above assume one
  run with no retries. CI uses `retries: 2`, which can consume more — reset+seed per run makes this acceptable,
  but a retried consuming test may skip.
- The backend rate-limits failed logins (429 after 3); seed logins must reuse tokens per role (like
  `tests/helpers/movement/api.ts`) rather than logging in per call.
- Credentials and the reset endpoint's admin credentials live in `.env.local` only.
- Existing reusable pieces: `scripts/seed-master/*` (API client, master mappers),
  `tests/helpers/movement/api.ts` (per-role token cache, `apiSend`), `tests/helpers/movement/docs.ts`
  (GRN / adjustment / CN create-commit helpers). Note `tests/pages/*-helpers.ts` drive the **UI**, not the API.

## Left to the builder

- Module layout, names, flag set beyond the three above.
- Exact API payloads and the order of document creation, as long as every state is reached through the real
  workflow transitions.
- How to make documents distinguishable in the summary (description marker, etc.).
- How the reset empties the schema, and the exact endpoint path and response shape.
- Whether master data goes through the existing e2e `seed:master` (client side) or the backend's
  `preconfig-imports` (server side) — either is fine if the result matches step 1.

## Open questions

None left for the user. The builder verifies the AVG GRN behaviour (step 0) before seeding GRNs.

## Out of scope findings (separate work, noted so they aren't mistaken for data gaps)

- `filter({ hasText: /^approved$/i })` / `/^sent$/i` match whole-row text and can never match: 301
  TC-PR-040003, 410001-410004, 630003; 401 TC-PO-040001, 040003, 040004 always skip.
- `APPROVALS_PATH = "/procurement/purchase-requests/my-approvals"` (`tests/pages/purchase-request.page.ts:7`)
  is probably stale (My Approvals moved to `/procurement/my-approval`); 301's `gotoApprovals()` tests would skip
  regardless of data.
- Conflicting expectations: 302 TC-PR-050305 needs zero PR templates while 050302-4 need ≥1; 401 TC-PO-010003,
  501 TC-GRN-010002, 601 TC-CN-010005 expect "no records".
- Admin-side locator drift found on 2026-11-04 (e.g. Chart of Accounts button is "New", not "Add";
  `#recipe-category-code` gone from the op-category form).
- `bun run test` does not pass `.env` to Playwright on this machine; `E2E_NO_WEBSERVER` / `E2E_BASE_URL` had to
  be set explicitly.
