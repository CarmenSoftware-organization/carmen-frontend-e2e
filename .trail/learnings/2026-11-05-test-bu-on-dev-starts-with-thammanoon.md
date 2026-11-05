---
title: "TEST BU on dev starts with no workflows and purchase has no role there, so the dataset has to build workflows itself and give them products"
author: Thammanoon
date: 2026-11-05
branch: feature/data-reset
cost: { minutes: 27, tokens: 286070 }
id: l-52deeb98
scope: repo
status: active
src: agent
touches:
  - scripts/data-reset/README.md
  - scripts/data-reset/index.ts
  - scripts/data-reset/workflows.ts
  - unit/data-reset/run.test.ts
  - unit/data-reset/workflows.test.ts
  - scripts/data-reset/sessions.ts
  - scripts/seed-master/api-client.ts
  - unit/data-reset/sessions.test.ts
  - CLAUDE.md
  - package.json
---

## Decided
- The standard dataset's first PR and PO workflows are a hand-authored template (users by email), not a copy of the BU: as of 2026-11-05 GR2VYNKQ on dev has zero workflows (checked as admin, purchase, requestor).
- PR route: Create → HOD (is_hod) → GM → Purchase, with a rule at HOD that skips to Purchase when total_amount ≤ 100,000 (user's threshold). General PO: purchase → FC → GM.
- Every created workflow carries `data.products` = all seeded products.

## Tried and ruled out
- Capturing the live workflows before the first reset: there were none to capture.
- GM as an optional *last* stage (HOD → Purchase → GM, skip GM when cheap): the app's routing editor only allows a target stage *after* the trigger, so "skip to the end" can't be expressed.

## Watch out
- A workflow without `data.products` leaves the PR/PO item picker empty — the backend lists only those products.
- The GM rule reads total_amount at HOD time, i.e. only prices the requestor typed; a PR priced over 100,000 only at Purchase never reaches GM. High-value seed PRs need requestor prices.
- purchase has no application role in GR2VYNKQ, which is why it gets Permission Denied on Vendor / Product Category / Campaign; data:reset only checks, the grant is a one-time manual step.
- purchase and requestor have GR2VYNKQ as their only BU with is_default=false; they still land in it.
- 9 logins per run sit under RATE_LIMIT_LOGIN_MAX=10/min; send `x-rate-limit-bypass: true` like the Playwright config.

In the code: scripts/data-reset/fixtures/workflows.json, scripts/data-reset/workflows.ts (products), carmen-turborepo-backend micro-business master/products/products.service.ts (getWorkflowProductIds), carmen-frontend routes/system-admin/workflow/wf-routing-utils.ts (routingTargetOptions)
