---
title: "Running the suite here needs the target passed explicitly, and failures named BLAVG are really TEST BU"
author: Thammanoon
date: 2026-11-04
branch: docs/standard-test-dataset-design
cost: { minutes: 77, tokens: 229897 }
id: l-97afd0e5
scope: repo
status: active
src: agent
touches:
  - docs/superpowers/specs/2026-11-04-standard-test-dataset-design.md
  - docs/test-cases/COVERAGE.md
  - docs/superpowers/plans/2026-11-04-tenant-reset-endpoint.md
  - tests/test-users.ts
  - playwright.config.ts
  - lefthook.yml
---

## Watch out
- `bun run test` did not hand `.env` values to Playwright on this machine: it still tried to start a local frontend and died with `spawn /bin/sh ENOENT` (the default frontend dir did not exist). Passing the target on the command line works.
- "BLAVG" in test titles and annotations is stale text. Every test account has a single BU, `GR2VYNKQ` ("TEST BU"), which is what `BU_CODE` points at. When many cases fail at once, open the failure screenshot before blaming the BU: on 2026-11-04 the purchase account hit "Permission Denied" on Vendor, Product Category and Campaign (a role-permission gap), and the admin-side failures were locator drift.
- Committing any `docs/**/*.md` runs the coverage audit, which needs the frontend checked out at `../carmen-frontend`, and fails if `COVERAGE.md` is stale.

In the code:
- `E2E_NO_WEBSERVER=1 E2E_BASE_URL=http://carmen-frontend.vercel.app bunx playwright test --project=setup --project=login --project=chromium`
- `tests/test-users.ts` (`BU_CODE`), `playwright.config.ts` (`webServer`), `lefthook.yml` (`audit-catalogs`), `bun audit:coverage`
