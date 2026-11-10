---
title: E2e login tests hit a real remote dev backend that flakes in two specific ways
author: Thammanoon
date: 2026-11-09
id: l-63373977
scope: repo
status: active
touches:
  - "tests/pages/login.page.ts#LoginPage.loginWithRetry"
---

## Decided
The e2e suite drives a REAL remote backend (`dev.blueledgers.com:4001`, from the React SPA's runtime `public/config.json` `BACKEND_URL`), not a local one. Two flake patterns seen repeatedly:

1. **Cold first-request timeout** → the app shows "Auth server unavailable" (auth-api `fetch` has `AbortSignal.timeout(10_000)`; a cold TLS/connection blip exceeds it). `curl` from the host is fast, so it's browser-fetch-specific. `LoginPage.loginWithRetry` was hardened to retry on this (not just on rate-limit) and waits 12s on success so a slow-but-OK login isn't mistaken for failure. Per-role success logins use `loginWithRetry`.
2. **Rate-limit pollution** → backend returns HTTP 429 after 3 wrong attempts *per email*. Tests using a FIXED wrong email (TC-LOGIN-010029/010030) start failing with 429 instead of 401 after running the suite several times in quick succession. Fix: wait for a cooldown, or use a unique-per-run email (`${Date.now()}@...`) as TC-010030/010042 do.

**Why:** these cause confusing intermittent failures that look like test bugs but are environmental.

## Watch out
before concluding a login test is broken, check for these two; rerun once after ~20s. Related: project_e2e_targets_react_spa.

_From Claude Code's memory of this repo, last updated Jun 16._
