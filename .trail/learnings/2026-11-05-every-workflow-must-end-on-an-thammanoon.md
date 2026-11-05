---
title: "Every workflow must end on an empty Completed stage, because the backend finishes a document on the approval that moves it into the last stage"
author: Thammanoon
date: 2026-11-05
branch: fix/data-reset-vendor-put
cost: { minutes: 3, tokens: 33507 }
id: l-04fce75a
scope: repo
status: active
src: agent
touches:
  - unit/data-reset/mappings.test.ts
  - scripts/data-reset/README.md
  - scripts/data-reset/fixtures/workflows.json
  - scripts/data-reset/workflow-template.ts
  - unit/data-reset/workflow-template.test.ts
---

## Decided
The standard dataset's PR, PO and SR workflows each end with a terminal "Completed" stage: no assigned users, every action inactive, sla 0. The fixture validator rejects a workflow whose last stage still has an active action.

## Tried and ruled out
- Ending the PR workflow on "GM Approval" (and PO on GM, SR on Issue): the approval that moved a document INTO that last stage already marked it approved/completed. PRs went approved right after Purchase, GM then got 403 "You do not have permission to access this purchase request"; GM approving a PO and issuing an SR got 503 because the document was already finished. The counts showed it as "approved" rows above target and "at GM" rows at 0.

## Watch out
- Any workflow built by hand or through the API (specs, movement setup, data:reset) needs the terminal stage, or its real last approver is silently skipped. The backend's own sample workflow ends on "Completed"; the workflow editor may add it for you, the API does not.
- A 503 on approve/issue often means "this document is already final", not a backend outage.

In the code:
- backend apps/micro-business/src/common/workflow/workflow-orchestrator.service.ts `buildApproveWorkflow`: `isFinalApproval = !nav.navigation_info.workflow_next_step` (computed after navigating forward)
- backend sample stage: apps/micro-business/src/master/workflows/workflows.service.ts (commented "Completed" stage)
- e2e scripts/data-reset/fixtures/workflows.json, scripts/data-reset/workflow-template.ts `validateFixture`
