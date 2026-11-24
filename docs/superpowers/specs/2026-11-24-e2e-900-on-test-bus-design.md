# 900 period-end on the TEST BUs — short design

**Status:** approved by the user 2026-11-24 ("ok ทำเลย"). Small change.

## Intent
`tests/900-period-end.spec.ts` was the last spec still tied to CARMEN-AVG/FIFO: the `910`–`924` move left it out of scope. Every
other case already runs on `BU-GR2VYNKQ` with the gmail accounts. Only TC-PE-340001 (close entry in the activity log) still used
`helpers/movement/api.ts`, which logs in with the legacy `*@carmen.com` accounts unless `E2E_PERIOD_CLOSE=1`, and
`E2E_ALLOW_IRREVERSIBLE=<BU>:<period>`, which the docs no longer describe. In practice it was always skipped.

## Approaches
1. **Find a closed TEST BU period at runtime (chosen).** Loop over `TEST_BUS`, take the newest `closed` period from
   `/inventory-periods`, then read its activity-log entry as the gmail Admin. Skip with the reason when no TEST BU has a closed period.
   Read-only.
2. Point the env gate at a TEST BU. Rejected: the case would still always skip.
3. Let 900 close a period itself. Rejected: the main suite would do something irreversible.

## Decided
- The backend logs a close as `entity_type = inventory_period`, `action = update`, `new_data.status = closed`, with `actor_id`.
  Probed 2026-11-24 on `BU-96EAT3GX` and `BU-0706T34Y`, where 2610 was closed. It does not use `period`. The case asserts what
  the backend records; the case ID and its meaning stay the same.
- The rest of 900 is untouched.

## Follow-up decided (user, 2026-11-24: "ทำด้วย")
- The FE activity-log Record Type filter sent `entity_type=period`, which has no rows, so it was always empty. carmen-frontend#719
  changes the value to `inventory_period`. TC-PE-340006 now requires at least one `inventory_period` row; before, it passed on an
  empty list. Merge FE #719 first.
