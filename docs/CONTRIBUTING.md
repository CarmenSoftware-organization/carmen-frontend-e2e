# Contributing

How to set up, write, and land changes in this Playwright e2e suite. The full
architecture notes live in [`CLAUDE.md`](../CLAUDE.md); the Thai run guide is
[`e2e_test.md`](../e2e_test.md).

## Setup

Prerequisites:

- [Bun](https://bun.sh) (scripts, runners, unit tests)
- A checkout of the frontend at `../carmen-frontend` (or set `E2E_FRONTEND_DIR`)
- The backend reachable on `:4000` for local runs (Docker). If it is down, the `setup` project hangs silently.

```bash
bun install
bunx lefthook install         # pre-commit audits (Bun skips dependency postinstall scripts)
bun run install-browsers     # one-time: Chromium
cp .env.example .env.local   # then fill in what you need
bun run test:login           # smoke check
```

Environment variables are documented in the README's
[Environment variables](../README.md#environment-variables) table.

## Scripts

The full list is in the README's [Scripts reference](../README.md#scripts-reference).
The ones you will use day to day:

| Command | When |
|---------|------|
| `bun run test -- <spec> -g "<TC-ID>"` | Run one spec or one test |
| `./tests/scripts/run-module.sh <module>` | Run a module and sync results |
| `bun run test:unit` | Unit tests for the scripts in `scripts/` (`unit/`) |
| `bun run audit:tc-ids` | TC ID format + catalog audit (CI gate) |
| `bun run docs:user-stories` | Regenerate `docs/user-stories/` after annotation changes |

Use `bun run test`, never bare `bun test` (that runs Bun's own test runner).

## Writing a test

1. **Pick the ID.** Titles start with `TC-<PREFIX>-XXYYYY` (regex `^TC-[A-Z]{2,5}-\d{6}$`).
   A new prefix or section must be registered in [`test-id-scheme.md`](./test-id-scheme.md) first.
2. **Annotate fully.** Every `test(...)` and `test.skip(...)` carries all five annotations:
   `preconditions`, `steps` (numbered from `1.`), `expected`, `priority` (`High` | `Medium` | `Low`),
   and `testType`. Reference: `tests/001-login.spec.ts`.
3. **Use page objects.** Add locator factories (arrow functions returning `Locator`) under `tests/pages/`.
   Prefer `getByRole`; fall back to Radix `data-slot="..."` attributes.
4. **Use auth fixtures.** `createAuthTest(email)` from `tests/fixtures/auth.fixture.ts` boots from the
   `setup` project's storageState — no per-test login. Any UI login goes through `loginWithRetry`.
5. **Generate data.** Use `tests/helpers/test-data.ts` (`buildEntity`, `fakeCode`, `fakeName`) for unique records.
6. **Chain dependent CRUD steps** (create → edit → delete) in `test.describe.serial`.
7. **Don't swallow failures.** No `.catch(() => {})` around actions or assertions — it turns failures into false passes.
8. **Titles are in Thai** to match the product UX.
9. **Sync to Sheets.** A new spec needs an entry in `SYNC_TARGETS` (`scripts/sync-test-results.ts`).

## Code style and checks

There is no linter or formatter configured; match the surrounding code. Before committing:

```bash
npx tsc --noEmit             # type-check
bun run test:unit            # if you touched scripts/
bun run audit:tc-ids
```

The lefthook `pre-commit` hook runs automatically, scoped by what is staged:

| Staged path | Runs |
|-------------|------|
| `tests/**/*.spec.ts` | `audit:tc-ids`, `audit:spec-health:check` |
| `docs/**/*.md` | `audit:tc-ids`, `audit:coverage:check`, `audit:spec-health:check` |
| `scripts/**/*.ts` | `audit:coverage:check`, `audit:spec-health:check` |

CI (`.github/workflows/tc-id-audit.yml`) runs `bun audit:tc-ids` on every PR and on pushes to `main`.

## PR checklist

- [ ] Branch is `feature/<ticket>-<slug>` or `fix/<ticket>-<slug>`, based on `main`
- [ ] `npx tsc --noEmit` passes
- [ ] `bun run audit:tc-ids` passes
- [ ] Annotation audit shows no mismatch:
      ```bash
      for f in tests/*.spec.ts; do
        pre=$(grep -c 'type: "preconditions"' "$f"); exp=$(grep -c 'type: "expected"' "$f")
        [ "$pre" = "$exp" ] || echo "MISMATCH in $f: pre=$pre exp=$exp"
      done
      ```
- [ ] Annotations changed → `bun run docs:user-stories` output committed in the same PR
- [ ] New spec → `SYNC_TARGETS` entry added; new prefix → `docs/test-id-scheme.md` row added
- [ ] The touched spec was run locally and the result is stated in the PR description
- [ ] No secrets, `.env.*`, or `.auth/` files committed
