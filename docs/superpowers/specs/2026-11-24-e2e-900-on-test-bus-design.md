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

## Found, not fixed here
- The FE activity-log Record Type filter sends `entity_type=period`
  (`carmen-frontend` `routes/system-admin/activity-log/activity-log-component.tsx`, `ENTITY_TYPE_OPTIONS`). The backend has no
  `period` rows, so the filter returns nothing. TC-PE-340006 only checks that every row returned is `period`, so it passes on an
  empty list. This needs the user's decision: fix the FE value, and tighten 340006 so it requires at least one row.
</content>
</invoke>
<invoke name="Bash">
<parameter name="command">cd /Users/samutpra/GitHub/carmensoftware-organize/carmen-frontend-e2e && git add tests/900-period-end.spec.ts docs/user-stories/900-period-end.md README.md docs/superpowers/specs/2026-11-24-e2e-900-on-test-bus-design.md && git commit -q -m "test(900): TC-PE-340001 อ่าน log การปิดงวดจาก TEST BU ที่มีงวดปิดแล้ว — เลิกใช้ E2E_ALLOW_IRREVERSIBLE และบัญชี movement, entity_type = inventory_period ตามที่ backend บันทึกจริง" && git log --oneline -1 && trail check 2>&1 | tail -4