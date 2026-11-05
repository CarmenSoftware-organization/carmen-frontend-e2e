---
title: "The rate-limit bypass header only works with the gateway's secret token, so a dry run and a live reset back to back hit the login limit"
author: Thammanoon
date: 2026-11-05
branch: fix/data-reset-vendor-put
cost: { minutes: 27, tokens: 143082 }
id: l-d7e68954
scope: repo
status: active
src: agent
touches:
  - scripts/data-reset/mappings.ts
  - playwright.config.ts
  - scripts/data-reset/sessions.ts
  - unit/data-reset/mappings.test.ts
---

## Decided
Leave at least 60 seconds of clear time between two `data:reset` runs (dry run then live, or a retry after a failure). One run logs in 9 accounts and dev allows 10 logins per minute per IP, so the second run inside the same minute gets 429 at login, before anything is written.

## Tried and ruled out
- Sending `x-rate-limit-bypass: true` (as playwright.config.ts and the data-reset sessions do). The gateway skips the throttler only when the header equals its configured `RATE_LIMIT_BYPASS_TOKEN` (constant-time compare), and never in production. The literal "true" just falls through to normal throttling. An earlier learning said the header keeps a rerun under the limit; that is wrong.
- Retrying 47 seconds after a 429: still 429, because the failed attempts count toward the same window.

## Watch out
A 429 at login stops the run before the reset, so TEST BU is untouched. Wait a full minute (90 seconds is safe), then rerun.

In the code:
- carmen-turborepo-backend apps/backend-gateway/src/common/rate-limit/rate-limit-bypass.ts (`shouldSkipRateLimit`)
- apps/backend-gateway/src/libs/config.env.ts: RATE_LIMIT_TTL_MS=60000, RATE_LIMIT_LOGIN_MAX=10, RATE_LIMIT_BYPASS_TOKEN default ''
- e2e scripts/data-reset/sessions.ts sends the header with "true"
