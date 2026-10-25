# carmen-frontend-e2e

Playwright end-to-end test suite for the [**carmen-frontend**](https://github.com/CarmenSoftware-organization/carmen-frontend) Vite SPA.

The frontend lives in a sibling directory (`../carmen-frontend`). This repo contains only tests, page objects, fixtures, and a CSV-to-Google-Sheets reporter — no application code.

## Quickstart

```bash
bun install
bun run install-browsers    # one-time: installs Chromium
bun run test                # runs the full suite (boots the frontend via Playwright webServer)
```

`bun run test` will spawn `bun dev` in `../carmen-frontend` (Vite dev server, serves on `:3000`). To test against an already running frontend (e.g. staging) set:

```bash
export E2E_NO_WEBSERVER=1
export E2E_BASE_URL=https://your-host.example.com
bun run test
```

See `.env.example` for all environment variables.

## Running subsets

```bash
bun run test:login              # 001-login.spec.ts only (TC-LOGIN-010001..010030)
bun run test:chromium           # everything except login (auto-runs the setup project first)
bun run test:ui                 # Playwright UI mode
bun run test:headed             # headed browser
bun run test:debug              # step-through debugger
bunx playwright test currency   # single spec (substring match against filename)
bunx playwright test -g "TC-LOGIN-010001"  # single test by title
bun run report                  # open last HTML report
```

## Scripts reference

<!-- AUTO-GENERATED: from package.json "scripts" — regenerate, don't hand-edit -->
| Command | Description |
|---------|-------------|
| `bun run test` / `e2e` / `test:dev` / `e2e:dev` | `playwright test` — full suite (boots the frontend via webServer) |
| `bun run test:ui` / `e2e:ui` | Playwright UI mode |
| `bun run test:headed` / `e2e:headed` | Headed browser |
| `bun run test:debug` / `e2e:debug` | Step-through debugger |
| `bun run test:login` / `e2e:login` | Only the `login` project (`001-login.spec.ts`) |
| `bun run test:chromium` / `e2e:chromium` | Only the `chromium` project (runs `setup` first) |
| `bun run test:uat` / `e2e:uat` | Run against `.env.uat` via `scripts/run-env.ts` |
| `bun run test:prod` / `e2e:prod` | Run against `.env.prod` via `scripts/run-env.ts` |
| `bun run test:movement` | Opt-in movement doc-flow specs (`*-doc-flow.spec.ts`, CARMEN-AVG/FIFO accounts) |
| `bun run test:period-close` | Opt-in period-close phases (`9xx-period-close-*.spec.ts`) — needs `E2E_PERIOD_SCENARIO` |
| `bun run test:unit` | Vitest unit tests (`unit/`) |
| `bun run test:unit:coverage` | Vitest with coverage |
| `bun run report` / `e2e:report` | Open the last HTML report |
| `bun run codegen` | Playwright codegen against `http://localhost:3000` |
| `bun run install-browsers` | `playwright install --with-deps` |
| `bun run e2e:sync` | Upsert `tests/results/*.json` into Google Sheets |
| `bun run e2e:sync:reset` | Same, with `--reset` |
| `bun run docs:user-stories` | Regenerate `docs/user-stories/*.md` from spec annotations |
| `bun run audit:tc-ids` (`:strict`) | TC ID format + prefix/section catalog audit |
| `bun run audit:tc-ids:legacy` | Audit in `--legacy-mode` |
| `bun run audit:tc-ids:lenient` | Audit with `--lenient-docs` |
| `bun run audit:coverage` (`:check`) | Generate / verify `COVERAGE.md` |
| `bun run audit:spec-health` (`:check`) | Generate / verify `SPEC-HEALTH.md` |
| `bun run migrate:tc-propose` / `tc-apply` / `tc-sheet` | TC ID migration: propose map → apply → sync sheet |
| `bun run wiki:seed` / `wiki:coverage` / `wiki:sitemap` | Wiki screenshot manifest, coverage, sitemap |
| `bun run wiki:probe` / `wiki:capture` | Playwright `wiki-probe` / `wiki-screenshots` projects |
| `bun run seed:master` | Excel → REST master-data seeder (`scripts/seed-master`) |
| `bun run create:sitemap:screen` | Crawl the app per test user → `runs/screens/<datetime>/` |
| `bun run movement:setup-workflows` (`restore`) | Give the movement accounts' workflows products / put them back |
| `bun run movement:setup-fifo-roles` (`restore`) | Roles + locations for the FIFO SR-issue variant / put them back |
| `bun run movement:cleanup` (`--apply`) | List / clear documents the movement suite left behind |
<!-- /AUTO-GENERATED -->

> Use `bun run test`, not bare `bun test` — the latter invokes Bun's built-in test runner instead of the `test` script.

## Environment variables

<!-- AUTO-GENERATED: from .env.example + process.env usage — regenerate, don't hand-edit -->
| Variable | Required | Description | Default / Example |
|----------|----------|-------------|-------------------|
| `E2E_BASE_URL` | No | URL of the frontend under test | `http://localhost:3000` |
| `E2E_FRONTEND_DIR` | No | Frontend checkout for the webServer (relative to repo root) | `../carmen-frontend` |
| `E2E_NO_WEBSERVER` | No | `1` = don't spawn the frontend; test an already running instance | `0` |
| `CI` | No | Set by CI: `forbidOnly` + 2 retries | — |
| `GOOGLE_SHEETS_SA_KEY_PATH` | For `e2e:sync` | Absolute path to service-account JSON key | `/abs/path/sa.json` |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | For `e2e:sync` | Target sheet ID | — |
| `SYNC_RESET` | No | `1` = same as `e2e:sync --reset` | — |
| `SEED_BU_CODE` | For `seed:master` | Business unit to seed | `BLAVG` |
| `SEED_EMAIL` / `SEED_PASSWORD` | For `seed:master` | Seeder credentials | `admin@blueledgers.com` / `12345678` |
| `SEED_BACKEND_URL` | No | Backend URL; falls back to frontend `config.json` | `http://localhost:4000` |
| `SEED_X_APP_ID` | No | App ID header; falls back to frontend `config.json` | — |
| `SEED_CONFIG_PATH` | No | Frontend `config.json` to read fallbacks from | `../carmen-frontend/dist/config.json` |
| `VITE_DEV_PROXY_TARGET` | No | Only if the SPA's `BACKEND_URL` is blanked — Vite `/api` proxy target | `http://localhost:4000` |
| `WIKI_CAPTURE_EMAIL` / `WIKI_CAPTURE_PASSWORD` | No | Shoot every wiki screen as one user (matrix ignored) | `carmensoftware.dev+admin@gmail.com` / `12345678` |
| `WIKI_CAPTURE_DETAIL_ONLY` | No | Capture only dynamic (`:id`) routes | — |
| `WIKI_CAPTURE_WIKI_ONLY` | No | Capture only shots that feed a wiki page | — |
| `WIKI_ASSETS_DIR` | No | Wiki screenshot output dir | `../carmen-wiki/assets/screenshots/inventory` |
| `WIKI_SITEMAP_PATH` | No | Wiki sitemap output | `../carmen-wiki/sitemap.html` |
| `WIKI_SPECS_DIR` | No | Wiki specs dir for `wiki:coverage` | `../carmen-wiki/.specs` |
| `E2E_MOVEMENT` / `E2E_PERIOD_CLOSE` | No | `1` = register the opt-in movement / period-close projects | — |
| `E2E_DB_URL` | For movement | Postgres URL of the tenant DB (read-only role is enough) — `.env.local` only | — |
| `E2E_API_URL` / `E2E_X_APP_ID` | No | Backend for the movement API checks; falls back to the frontend's `/config.json` | — |
| `E2E_MOVEMENT_DATE` | No | Date for stock-posting doc-flow documents | today / 15th of the current period |
| `E2E_SRI_BU` / `E2E_SRI_PHASE` | No | SR → Issue flow: `FIFO` variant; AVG phase `pre` / `post` / `all` | AVG / `all` |
| `E2E_PERIOD_SCENARIO` | For period-close | Scenario key in `tests/helpers/period-close/scenarios.ts` | `avg2607` |
| `E2E_ALLOW_IRREVERSIBLE` | For Start / count / Close | `<BU>:<period>` gate for the irreversible period-close steps | `CARMEN-AVG:2607` |
| `E2E_EVIDENCE_DIR` | No | Period-close evidence folder | `runs/period-close/<scenario>` |
<!-- /AUTO-GENERATED -->

Named targets: `.env.<name>` is loaded by `scripts/run-env.ts` and overrides `.env` / `.env.local`.

### Per-module shell scripts

```bash
./tests/scripts/run-module.sh currency
./tests/scripts/run-module.sh department --headed
./tests/scripts/run-module.sh currency --debug
./tests/scripts/run-all.sh                 # sequential, summary at the end
./tests/scripts/run-all.sh --workers=100%  # single parallel batch
```

Any `playwright test` flag (`--headed`, `--ui`, `-g <pattern>`, `--debug`, …) passes through.

## Project structure

```
.
├── playwright.config.ts          # 5 projects (setup, login, chromium, wiki-screenshots, wiki-probe) + opt-in movement-setup / movement / period-close; webServer; JSON reporter
├── tests/
│   ├── auth.setup.ts             # setup project — pre-authenticates every role once per run
│   ├── movement.setup.ts         # movement-setup project — logs in the @carmen.com movement accounts
│   ├── *-doc-flow.spec.ts        # movement suite: doc lifecycle per role on CARMEN-AVG (opt-in)
│   ├── 9xx-period-close-*.spec.ts# movement suite: period-close phases (opt-in, partly irreversible)
│   ├── *.spec.ts                 # 45 specs: 001-login, 010-department, …, 1001-campaign
│   ├── pages/                    # page objects (locator factories)
│   ├── fixtures/
│   │   ├── auth.fixture.ts       # createAuthTest(email) — boots context from .auth/<email>.json
│   │   └── auth.paths.ts         # authFile(email) — single-source path helper
│   ├── helpers/                  # shared helpers (security-cases, CRUD helpers)
│   ├── reporters/tc-json-reporter.ts
│   ├── results/*.json            # per-spec result JSONs (checked in as seeds; updated each run)
│   ├── scripts/                  # shell runners (run-module.sh, run-all.sh)
│   ├── test-users.ts             # role-based test accounts
│   └── movement-users.ts         # movement-suite accounts (CARMEN-AVG / CARMEN-FIFO)
├── .auth/                        # runtime — gitignored; storageState files written by setup
└── scripts/                      # run-env, sync-test-results, audits, seed-master, capture-screens
```

## Test accounts

Defined in `tests/test-users.ts`. Nine roles: Requestor, HOD, Purchase, FC, GM, Owner, StoreManager, Budget, TT. Most share password `12345678`; `TT` uses `Qaz123!@#`. The `setup` project pre-authenticates every role once per `bun run test` invocation and persists cookies to `.auth/<email>.json`; subsequent specs reuse that storageState instead of logging in per test.

## Test IDs

Every test title starts with a `TC-<PREFIX>-XXYYYY` ID (2-digit section + 4-digit sequence — e.g. `TC-LOGIN-010001`, `TC-DP-010003`). Strict regex: `^TC-[A-Z]{2,5}-\d{6}$`. The JSON reporter (`tests/reporters/tc-json-reporter.ts`) parses these IDs and writes one JSON per spec into `tests/results/`. Preserve the pattern when adding new tests — otherwise they won't appear in the reports. Run `bun audit:tc-ids` to verify TC ID format and prefix-catalog registration before opening a PR.

## Google Sheets sync (optional)

`bun e2e:sync` reads `tests/results/*.json` and upserts Status + Test Date into a Google Sheet. To enable:

1. Google Cloud Console → create project → enable **Google Sheets API**
2. IAM → Service Accounts → create one → download JSON key
3. Share the target spreadsheet with the service-account email as Editor
4. Set in `.env.local` (do NOT commit):
   ```
   GOOGLE_SHEETS_SA_KEY_PATH=/absolute/path/to/service-account.json
   GOOGLE_SHEETS_SPREADSHEET_ID=<sheet id from URL>
   ```
5. `bun e2e:sync`

The shell runners (`tests/scripts/run-module.sh` and `run-all.sh`) call `bun e2e:sync` automatically after each run, wrapped in `|| true` so missing credentials don't fail tests.

Tab mapping is hard-coded in `SYNC_TARGETS` inside `scripts/sync-test-results.ts` — add an entry there for any new results file.

## Notes for contributors

- **Rate limiting**: the backend returns HTTP 429 after 3 wrong-password attempts on the same email. Always use `LoginPage.loginWithRetry` rather than raw `login` when tests may produce failed auth.
- **`workers: 1`** in the config is intentional — backend state is shared across role-based accounts and tests cannot safely interleave.
- **Test titles are in Thai** to match the product UX.

See [docs/CONTRIBUTING.md](./docs/CONTRIBUTING.md) for setup, test-writing rules and the PR checklist, [e2e_test.md](./e2e_test.md) for the Thai run guide, and [CLAUDE.md](./CLAUDE.md) for the architecture deep-dive used by AI coding agents.

## Default target: the React SPA

By default the suite drives the **React SPA** (`../carmen-frontend`,
Vite, `:3000`). The SPA reads its backend from `public/config.json`, so no dev proxy
is required; set `VITE_DEV_PROXY_TARGET=<backend-url>` only if you blank out
`BACKEND_URL` in that file to route `/api` through Vite's proxy instead.

`002-spa-smoke.spec.ts` (TC-SPA-01xxxx) is a cross-section smoke moved here from
the SPA repo — it asserts SPA-specific behavior (auth-guard redirect, real dashboard
instead of the migration placeholder).
