# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Purpose

Standalone Playwright end-to-end test suite for the **carmen-frontend** Vite SPA (sibling directory: `../carmen-frontend`). This repo contains no application code — only tests, page objects, and fixtures that drive the frontend over HTTP. The suite is frontend-agnostic: `E2E_FRONTEND_DIR` points it at a frontend checkout under any path.

## Running tests

```bash
bun install                     # or: npm install
bun run install-browsers        # one-time: installs Chromium
bun run test                    # all tests (starts the frontend via webServer) — not bare `bun test`, which runs Bun's own runner
bun run test:ui                 # Playwright UI mode
bun run test:headed             # headed browser
bun run test:login              # only 001-login.spec.ts
bun run test -- 001-login.spec.ts   # single file
bun run test -- -g "TC-L00101"     # single test by title
bun run test:uat                # run the suite against UAT (loads .env.uat)
bun run test:uat -- --project=login # ...forwarding any playwright flags
bun run report                  # open last HTML report
```

## How the runner starts the frontend

`playwright.config.ts` spawns `bun dev` in `../carmen-frontend` (Vite, serves on `:3000`) via Playwright's `webServer`. To test against an already running instance (e.g. staging) set `E2E_NO_WEBSERVER=1` and override `E2E_BASE_URL`. To point at a frontend checkout under a different path set `E2E_FRONTEND_DIR`; Playwright resolves the `cwd` option relative to the config file, so relative paths are evaluated from this repo root. See `.env.example`.

## Running against a named environment (`.env.uat`, etc.)

bun only auto-loads `.env` / `.env.local`, never a custom name. `scripts/run-env.ts` (exposed as `bun run test:uat` / `bun run e2e:uat`) parses `.env.<name>` (first positional arg, default `uat`) and runs `playwright test` with the file's vars **overriding** the inherited `.env` ones (otherwise the auto-loaded localhost values would shadow UAT). Remaining args are forwarded to `playwright test`. `.env.uat` sets `E2E_NO_WEBSERVER=1` + the deployed `E2E_BASE_URL`, so the run targets UAT with no local frontend. Add a new target by creating `.env.<name>` and calling `bun run scripts/run-env.ts <name>` — no code change. The `parseEnvFile` parser is unit-tested in `unit/run-env.test.ts`.

## Architecture

- **`playwright.config.ts`** — five always-on projects (plus three opt-in ones for the movement suite, see below): `setup` (runs `auth.setup.ts` to pre-authenticate every role and persist storageState), `login` (runs `001-login.spec.ts`), and `chromium` (every other spec; depends on `setup` so cookies are pre-loaded). Two more, `wiki-screenshots` and `wiki-probe`, drive the wiki screenshot pipeline (`bun run wiki:capture` / `wiki:probe`). The split enables selective runs (`bun run test:login`) and keeps the noisy login suite out of the default reporter output when iterating on feature tests. The `chromium`→`setup` dependency is wired explicitly; `login` is independent on purpose because it exercises real UI login. `workers: 1` because (a) the backend rate-limits repeated failed logins (observable via TC-L00130-style tests) and (b) role-based tests share backend state and cannot safely interleave.
- **`tests/pages/`** — page objects. Each class wraps a `Page` and exposes **locator factories** (arrow functions returning `Locator`), not pre-created locators — this avoids stale references across navigations.
- **`tests/fixtures/auth.fixture.ts`** — `createAuthTest(email)` returns a `test` whose browser context boots from `.auth/<email>.json` (produced by the `setup` project). Specs that consume the helper need no other auth setup.
- **`tests/auth.setup.ts`** — Playwright `setup` project. Runs once per `bun run test` invocation, logs in every entry of `TEST_USERS` via the real UI, and writes the resulting browser context to `.auth/<email>.json`. The `chromium` project depends on `setup`, so chromium tests start with cookies pre-loaded and never hit `/login`. The `login` project (`001-login.spec.ts`) deliberately does **not** depend on setup — it tests the UI login flow itself. `.auth/` is gitignored and regenerated each run.
- **`tests/test-users.ts`** — canonical list of role-based test accounts. Most share password `12345678`; `TT` uses `Qaz123!@#`. `getPasswordFor(email)` handles the lookup.

## Conventions

- **Test IDs**: format `TC-<PREFIX>-XXYYYY` (2-digit section + 4-digit seq). Strict regex `^TC-[A-Z]{2,5}-\d{6}$`. The canonical catalog of prefixes and section blocks lives in `docs/test-id-scheme.md`. To add a new module, add a row there before opening the spec PR; the audit (`bun audit:tc-ids`) and CI gate enforce that every prefix and section is registered.
- **Login flows** must use `loginWithRetry` — the backend returns 429 after 3 wrong-password attempts on the same email, and the retry helper backs off when it detects the rate-limit message.
- **Selectors** prefer `getByRole` / semantic queries. The frontend uses Radix primitives with `data-slot="..."` attributes (e.g. `data-slot="dropdown-menu-trigger"`, `data-slot="avatar"`) — use these when a role query is ambiguous, as seen in `DashboardPage.userMenuTrigger`.
- **Test data**: build unique records via `tests/helpers/test-data.ts` (`buildEntity` / `fakeCode` / `fakeName` / `fakeDescription`), not hand-rolled strings. It wraps `@faker-js/faker` with the run-scoped UID suffix (`Date.now().toString(36)`) so names look realistic yet stay unique across runs; codes keep the ASCII `PREFIX+4` format (`≤ 10` chars). Faker is **not** seeded. `010-department.spec.ts` is the reference consumer; rolling the convention out to the remaining CRUD specs (and `helpers/security-cases.ts`) is a follow-up.
- **Language**: test titles are Thai to match the product UX.
- **Test annotations**: every `test(...)` should ship the full 5-field annotation set so the JSON reporter (and downstream Google Sheet) gets populated metadata. Use the 3-arg form `test("TC-XXNN title", { annotation: [...] }, async ({ page }) => { ... })`. Reference: `tests/001-login.spec.ts:49-86`. Required types (case-insensitive — see `tests/reporters/tc-json-reporter.ts:97-127`):
  - `preconditions` — system/user state required before the test runs (login state, prior test dependencies for `serial` suites, existing records).
  - `steps` — numbered, newline-separated user actions starting with `1.`.
  - `expected` — concrete outcome (URL, toast, locator state). Avoid just echoing the title.
  - `priority` — one of `High` | `Medium` | `Low`.
  - `testType` — taxonomy of what the test is verifying. Two orthogonal axes are in active use; a single test picks one value (the dominant intent):
    - **Test category** (what part of the system): `Smoke` | `CRUD` | `Validation` | `Functional` | `Security` | `Authorization` | `Auth-guard`
    - **Test intent** (what flow shape): `Happy Path` | `Negative` | `Edge Case` | `Alternate Flow`

    Extend as needed; keep the choice consistent across modules. Run the audit below to inventory current usage before introducing a new value.
  - Optional: `note`.
- **Shared security helpers** (`tests/helpers/security-cases.ts`) carry their own annotations and interpolate `${listPath}` so each consuming spec gets module-specific metadata for free. When adding a new helper-generated test, follow the same pattern.
- **Annotation completeness is a hard requirement.** Every `test(...)` and `test.skip(...)` in `tests/*.spec.ts` MUST carry all five annotation fields (`preconditions`, `steps`, `expected`, `priority`, `testType`). The 1-field `expected`-only shape is not acceptable — fill it out at write-time, not later. Audit before merging:
  ```bash
  for f in tests/*.spec.ts; do
    pre=$(grep -c 'type: "preconditions"' "$f")
    exp=$(grep -c 'type: "expected"' "$f")
    [ "$pre" = "$exp" ] || echo "MISMATCH in $f: pre=$pre exp=$exp"
  done
  ```
  All counts must match; any mismatch means a test is missing fields.
- Also run the TC ID audit — must pass before merging — checks TC ID format, prefix dictionary, and section catalog:
  ```bash
  bun audit:tc-ids
  ```
- **Whenever you add or modify any annotation in any spec, regenerate the user-story docs in the same change**: run `bun docs:user-stories` and commit the resulting `docs/user-stories/*.md` alongside the spec edit. The two are coupled by design — never let them drift. Skip the regeneration only when no annotations changed (e.g. pure refactor, locator update).

## Movement suite (opt-in: doc flows + period close)

Merged from the standalone `_movement_play/eop_bf/e2e` suite. It tests inventory movement end to end on the **CARMEN-AVG / CARMEN-FIFO** tenant with its own accounts (`tests/movement-users.ts`, `@carmen.com`) — not the gmail `TEST_USERS` / BLAVG of the rest of the suite — and it verifies results in the backend (API) and the database (read-only SQL), not just on screen. Because none of that exists on UAT/prod targets and the specs post real stock, it is **excluded from `bun run test`** (chromium's `testIgnore`) and only registered when asked for:

```bash
bun run test:movement                          # E2E_MOVEMENT=1 → projects movement-setup + movement (*-doc-flow.spec.ts)
E2E_PERIOD_SCENARIO=avg2607 bun run test:period-close -- tests/910-period-close-prestep.spec.ts   # one phase
./tests/scripts/run-period-close.sh avg2607    # a whole round, stopping before each irreversible step on failure
bun run movement:setup-workflows               # once per environment: give the role accounts' workflows products (restore: … restore)
bun run movement:cleanup [--apply]             # list / clear documents the suite left behind
```

- **Doc-flow specs** (`312-pr`, `404-po`, `502-grn`, `603-cn`, `702-sr`, `721-sr-issue`, `730-inventory-adjustment` — all `*-doc-flow.spec.ts`) reuse their module's prefix with **section 70–71** (registered in `docs/test-id-scheme.md`). Each is a serial chain create → view → edit → delete → submit/commit as the real role (requestor / hod / fc).
- **Period-close phases** (`910`–`924-period-close-*.spec.ts`, prefix `PE`, **section 40–54**, one per phase) follow the scenario in `E2E_PERIOD_SCENARIO` (`tests/helpers/period-close/scenarios.ts`; add a new scenario per round). Phases hand documents over through `runs/period-close/<scenario>/state.json` and keep per-sub-case evidence there (`results.json` + screenshots), which a rerun reads to skip steps that already ran. Start, count submit and Close are **irreversible** and run only with `E2E_ALLOW_IRREVERSIBLE=<BU>:<period>`.
- **Fixture** `tests/fixtures/movement.fixture.ts`: `test.use({ user, bu })`; the BU is pinned in the browser only (profile response rewritten — the real switcher would move the shared account's default BU), and the auto `signals` fixture **fails a doc-flow test on any page error or unexpected API ≥ 400** (declare intended refusals with `signals.expectApiError`, harmless ones with `signals.minor`); period-close phases set `failOnSignals: false` — they provoke refusals on purpose and assert the backend's answers themselves.
- **Known bugs are pinned with `test.fail(true, "known bug …")`**: green in Playwright, `Fail` in the results sheet, and red ("unexpectedly passed") once fixed — then drop the marker.
- **Secrets**: the DB URL is `E2E_DB_URL` in `.env.local` only (`scripts/db-query.ts` runs the SQL under Bun; helpers accept SELECT/WITH only). The backend comes from `E2E_API_URL` + `E2E_X_APP_ID` or the running frontend's `/config.json`.
- **Behaviour conflicts with the main suite** are flagged in the notes rather than resolved: an AVG GRN posts stock when *saved* (TC-GRN-700005 vs TC-GRN-140003), requestor may create POs on CARMEN-AVG (TC-PO-700001 vs TC-PO-010002), and the period card after Close (period-close vs gap TC-PE-040104). Settle them with the backend team before changing either side.

## User-story docs (`docs/user-stories/`)

`docs/user-stories/<spec>.md` contains a stakeholder-friendly view of every test case (one file per spec), rendered from the spec annotations: each TC opens with an "As a / I want / so that" line followed by Priority / Test Type / Preconditions / Steps / Expected blocks. The files are **generated** — do not hand-edit. To refresh after annotation changes, run `bun docs:user-stories` (calls `scripts/generate-user-stories.ts`). The generator parses each spec via the TypeScript compiler API, expands `for (const user of TEST_USERS)` loops in `001-login.spec.ts` per role, and synthesizes the helper-generated security cases by mirroring the templates in `tests/helpers/security-cases.ts`.

## Batch scripts

`tests/scripts/` ships two scripts: `run-module.sh` (takes a module name, or opens an interactive `select` menu when none is given) and `run-all.sh` (runs every numeric-prefixed spec). Both auto-discover modules from `tests/[0-9]*-*.spec.ts` — no list to maintain. Any `playwright test` flag can be appended (`--headed`, `--ui`, `-g <pattern>`, `--workers=100%` for the parallel batch mode in `run-all.sh`).

## Screen sitemap capture (`create:sitemap:screen`)

`scripts/capture-screens.ts` crawls the app as each test user and writes a
browsable sitemap of full-page screenshots:

```bash
bun run create:sitemap:screen                       # all 9 TEST_USERS, sequential
bun run create:sitemap:screen -- --user admin,hod   # by role or email local part
bun run create:sitemap:screen -- --concurrency 3    # N users at a time
bun run create:sitemap:screen -- --max-pages 20     # cap per user (default 300)
bun run create:sitemap:screen -- --bu GR2VYNKQ      # BU to crawl in (default BU_CODE; `none` = account default)
```

After login every user is switched to the `--bu` business unit (`ensureActiveBu`,
which persists as the account's default BU). A user who is not a member of that
BU is reported as `bu-failed` and not crawled — crawling the wrong BU yields a
plausible-looking sitemap of "Permission Denied" pages.

Output lands in `runs/screens/<datetime>/` (gitignored) — `index.html` (one card
per user), `manifest.json`, and `<user>/sitemap.html` + `<user>/images/*.png`.
`runs/screens/latest` symlinks the newest run. Each user's sitemap is written as
soon as that user finishes, so a crash on role 7 still leaves roles 1-6 on disk.

How it differs from `tests/wiki-screenshots/`: that pipeline shoots a **curated
manifest** of routes discovered from the frontend's router source, role-aware via
a probe matrix. This one **crawls** — it follows the links each role actually
sees, so the per-user sitemaps double as evidence of what that role can reach.
Both are kept; neither replaces the other.

Three app-specific behaviours the crawler depends on:

- **The module launcher.** This SPA does not put its navigation in the DOM up
  front: the sidebar lists only the pages of the module you are already inside,
  and the 11 module roots live behind the "Modules" popover. `collectLinks()`
  opens it (after the screenshot, so it never covers the image) — without that
  the crawl finds three links from `/dashboard` and stops.
- **Redirects are recorded, not re-shot.** A route the role cannot open bounces
  back to a page already captured; that entry is marked `redirected` instead of
  saving a second copy of the destination under the blocked route's name, which
  would read as "this role can reach it".
- **List rows are opened by button, not link.** A record opens from a
  link-styled `<button>` whose text is its code ("CAD", "P055", "draft-1425") —
  no `<a href>` is involved, so link-following alone never reaches a detail
  screen. `captureFirstRowDetail()` clicks that one button on the first row of
  every list (never the row itself, which also holds a checkbox and row
  actions). Master and transaction modules navigate to `/<module>/<record>/
  <uuid>`, and the new URL is queued so the normal loop shoots it as a `:id`
  route; config modules open a dialog and leave the URL alone, so it is shot
  here and filed under `<route>#detail`. That dialog is the module's **edit**
  form — pressing Escape rather than Save is what keeps the crawl read-only.

A full crawl as `admin` captures 123 screens in ~5 min (14 detail dialogs, 23
detail pages, ~12 MB).

Auth is a fresh UI login per user (`LoginPage.loginWithRetry`) in its own browser
context — no dependency on the `setup` project or `.auth/*.json`. The pure URL
rules live in `scripts/lib/screen-crawl.ts` and are unit-tested in
`unit/screen-crawl.test.ts`.

## JSON reporter

`tests/reporters/tc-json-reporter.ts` is registered in `playwright.config.ts` and writes one `<spec-basename>-results.json` per spec file into `tests/results/`, keyed by the TC IDs parsed from test titles with `/\bTC-[A-Z]{2,5}-\d{6}\b/` — keep titles in the `TC-<PREFIX>-XXYYYY <description>` shape or the test won't be recorded. The repo ships seed JSONs; the reporter updates Status + Test Date on each run.

## Google Sheets sync (`e2e:sync`)

`scripts/sync-test-results.ts` reads every `tests/results/*.json` and upserts Status + Test Date into a Google Sheet by matching the `Test ID` column. Requires two env vars in `.env.local`:

- `GOOGLE_SHEETS_SA_KEY_PATH` — absolute path to a service-account JSON key with "Google Sheets API" enabled and Editor access to the target sheet.
- `GOOGLE_SHEETS_SPREADSHEET_ID` — the sheet ID from its URL.

Tab names are hard-coded in `SYNC_TARGETS` inside the script (e.g. `001-login-results.json` → tab "Login"). New result files need a matching entry there. The shell runners in `tests/scripts/` call `bun e2e:sync` after every playwright invocation; the call is wrapped in `|| true` so missing credentials don't fail the run.

## Origin: the legacy Next.js app's in-tree `e2e/` suite

This suite was mirrored from that app's in-tree `e2e/` directory — specs, page objects, fixtures, helpers, reporter, shell scripts, seed result files, and the Google Sheets sync script. **That repo no longer exists, so there is nothing left to sync from**; the substitutions below are kept only to explain why paths here differ from the ones the ported files assume:

- `testDir` is `./tests` (not `./e2e`).
- Reporter `outputDir` is `tests/results` (not `e2e/results`).
- Shell scripts resolve SPECs as `tests/<module>.spec.ts`.
- `RESULTS_DIR` in `scripts/sync-test-results.ts` is `tests/results`.

Specs added in this repo that are NOT in upstream: `vendor.spec.ts` (28 tests covering the vendor-management/vendor module — TC-VEN00101..28).
