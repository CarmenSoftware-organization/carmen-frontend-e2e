---
title: "A tenant reset leaves TEST BU's default currency pointing at a currency that no longer exists, so data:reset must re-point it"
author: Thammanoon
date: 2026-11-16
branch: main
cost: { minutes: 19, tokens: 582612 }
id: l-42278972
scope: repo
status: active
src: agent
touches:
  - tests/results/001-login-results.json
  - tests/results/002-spa-smoke-results.json
  - tests/results/010-department-results.json
  - tests/results/020-unit-results.json
  - tests/results/029-business-type-results.json
  - tests/results/030-extra-cost-results.json
  - tests/results/031-adjustment-type-results.json
  - tests/results/032-credit-term-results.json
  - tests/results/040-currency-results.json
  - tests/results/041-exchange-rate-results.json
---

## Decided
- The access step treats a default currency as set only if its id is still one of the BU's currencies. Otherwise it PATCHes the BU to the new THB. A reset always needs this, not just a fresh BU.

## Tried and ruled out
- Checking only "is a default currency set?" (the first version). After a live reset it skipped, because the BU row still held the old id. Every PR/PO page then warned that the default currency "no longer exists", and PR/PO saves stopped redirecting: 59 of 111 failures in the PR/PO rerun on 2026-11-16.

## Watch out
- The reset empties the tenant tables (currencies included) and re-seeds them with new ids, but the business-unit row lives in the central schema and survives. Any BU-level setting that stores a tenant-table id can dangle the same way after a reset.
- Application-role assignments did survive the reset (access step: 0 created, 9 skipped).

In the code:
- `planDefaultCurrency` in scripts/data-reset/access.ts; test "replaces a default currency that no longer exists" in unit/data-reset/access.test.ts
- frontend banner text: "The default currency of business unit GR2VYNKQ no longer exists"
