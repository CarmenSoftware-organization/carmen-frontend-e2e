# Master seed

A standalone Bun CLI that reads a "Preconfig" Excel workbook (`sample_seed_data/`)
and seeds a **sample subset** of its master data into an **existing** business
unit (BU) via the backend REST API. Use it to establish a known baseline so
tests can reference stable records instead of always faking throwaway ones.

It is run manually — it is **not** wired into the Playwright test run, so it never
mutates a backend automatically.

## Prerequisites

1. **Credentials in `.env.local`** (gitignored — never commit real ones):

   ```
   SEED_BU_CODE=BLAVG
   SEED_EMAIL=admin@blueledgers.com
   SEED_PASSWORD=12345678
   # Optional — fall back to the frontend config.json when unset:
   # SEED_BACKEND_URL=http://localhost:4000
   # SEED_X_APP_ID=...
   # SEED_CONFIG_PATH=../carmen-frontend/dist/config.json
   ```

   `SEED_BU_CODE`, `SEED_EMAIL`, `SEED_PASSWORD` are required (`--bu` can supply
   the BU instead). `SEED_BACKEND_URL` / `SEED_X_APP_ID` fall back to the
   frontend `config.json` (`BACKEND_URL` / `X_APP_ID`) when unset.

2. **The workbook file must exist** — `sample_seed_data/Preconfig_CARMEN_AVG.xlsx`
   (default) or `..._FIFO.xlsx`. Pass any other path with `--file <path>`.

3. **The backend must be reachable** and the seeding account must have access to
   the target BU (login can succeed while list/POST still fail with 403 if the
   account has no membership in that BU).

## Quick start

Always preview first — `--dry-run` is read-only (logs in, reads existing records,
prints what *would* change, writes nothing):

```bash
bun run seed:master --dry-run
```

Then seed for real:

```bash
bun run seed:master --bu BLAVG          # localhost target
bun run seed:master --bu BLAVG --yes    # non-localhost (dev/uat) target — --yes required
```

## Flags

| Flag | Effect |
|------|--------|
| `--dry-run` | Preview only — no writes (always read-only). |
| `--bu <code>` | Override `SEED_BU_CODE`. |
| `--host <url>` | Override the backend server URL (`SEED_BACKEND_URL` / `config.json` `BACKEND_URL`), e.g. `--host http://localhost:4000`. |
| `--file <avg\|fifo\|path>` | Workbook to read (default `avg`). `avg`/`fifo` resolve to the bundled `sample_seed_data/Preconfig_CARMEN_*.xlsx`; anything else is treated as a path. |
| `--limit <n>` | Cap rows seeded for **Product** and **Vendor** (default `50`). Must be a non-negative number. |
| `--only <a,b>` | Seed only the listed entities. |
| `--skip <a,b>` | Seed everything except the listed entities. |
| `--yes` | Required to seed a non-localhost target. |
| `--verbose` | More verbose logging. |
| `-h`, `--help` | Print usage (flags, entities, env vars, examples, exit codes) and exit `0`. |

Valid entity names for `--only`/`--skip` (an unknown name is rejected):
`currency`, `unit`, `tax-profile`, `delivery-point`, `department`,
`store-location`, `item-group`, `vendor`, `product`.

```bash
bun run seed:master --file fifo --limit 20    # FIFO workbook, 20 product/vendor rows
bun run seed:master --only currency,unit      # just these two
bun run seed:master --skip product,vendor     # everything except the big lists
bun run seed:master --host http://localhost:4000   # override backend server URL
```

## Behaviour

- **Skip-existing / idempotent:** records whose identity already exists in the BU
  are skipped, so re-running is safe and converges. Identity is `code` for most
  entities, but `name` for `unit` / `tax-profile` / `delivery-point` (these have
  no code in the backend).
- **Sample subset:** the small lookups seed in full; **Product and Vendor are
  capped by `--limit`** (default 50). Products whose inventory unit or item group
  cannot be resolved are skipped (orphan-safe).
- **Dependency order:** seeds in FK order — currency → unit → tax-profile →
  delivery-point → department → store-location → item-group tree
  (category → sub-category → item-group) → vendor → product.
- **Per-row resilience:** one failed create records `failed` and the run
  continues; the end-of-run summary reports created / skipped / failed per entity.
- **Safety:** seeding a non-localhost target requires `--yes`. `--dry-run` is
  always read-only and exempt from the gate. A banner prints the target URL, BU,
  file, mode, and limit before anything runs.
- **Out of scope:** Company Profile / BU (tenant) creation. The seeder targets a
  BU that already exists.

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | Completed with no failed rows (or a dry-run). |
| `1` | One or more rows failed, or an unexpected error was thrown. |
| `2` | Refused to seed a non-localhost target without `--yes`. |

## Troubleshooting

On a usage or config error (unknown flag, missing value, missing `SEED_*` var) the
CLI prints the error message followed by the full `--help` output and exits `1`.

- **`Missing required config: ...`** — set the listed `SEED_*` vars in
  `.env.local` (or pass `--bu`).
- **`Refusing to seed non-localhost target ... without --yes`** — add `--yes` to
  confirm a dev/uat target, or point `SEED_BACKEND_URL` at localhost.
- **All entities show `failed` with 401/403** — the account lacks access to the
  target BU, or the token expired; check `SEED_BU_CODE` and credentials.
- **`Missing sheet "..."`** — the workbook isn't a Preconfig export (a required
  sheet is absent); use one of the `sample_seed_data/` files or a matching layout.
