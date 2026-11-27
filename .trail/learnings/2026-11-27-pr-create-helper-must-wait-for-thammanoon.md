---
title: "PR create helper must wait for the create form before clicking the first combobox, or it opens the list page's rows-per-page select"
author: Thammanoon
date: 2026-11-27
branch: main
cost: { minutes: 28, tokens: 196204 }
id: l-0580f88e
scope: repo
status: active
src: agent
touches:
  - tests/zz-probe.spec.ts
  - tests/pages/purchase-request.page.ts
---

## Decided
`PurchaseRequestPage.selectFirstWorkflow` waits for the create form's description input before it takes "the first combobox". The /new route is lazy: the URL is already /purchase-request/new while the list page is still rendered for a moment, and `.first()` then opened the list's rows-per-page Select (5/10/25/50/100). The form mounted over it, the option count read 0, and `fillHeader` threw "could not pick a workflow" although the Requestor had a creatable workflow.

## Tried and ruled out
- Missing workflow data: after `data:reset` the API returned the PR workflow with `can_create: true` for Requestor, and the failures stayed.
- The CreateWorkflowGate "access denied" block: the failure screenshot showed the form with "Select Workflow".
- BU switching in `withRoleContext` and the 800 ms option wait: isolated probes of both passed 8/8.
- Backend rate limit / 5xx on `workflows/type`: a burst of 8 fresh Requestor contexts never failed.
What settled it: a Playwright trace of a failing repeat, whose snapshot at the click shows URL /new with the list page's pagination text, and no combobox at all 800 ms later.

## Watch out
- It is intermittent (about 1 in 5 warm, 7 of 7 on a cold Vite started by `bun run test`). It only bites once the PR list paginates, which is why it appeared after `data:reset` seeded 41 PRs.
- `filter({ hasText: /select workflow/i })` matches nothing on the PR form (see the addLineItem comment), so the PO page object's approach can't be copied. Anchor on a form-only element instead.
- Anything else that clicks `getByRole("combobox").first()` right after navigating from a list has the same race.

In the code: tests/pages/purchase-request.page.ts selectFirstWorkflow waits for `#pr-description` (descriptionInput) with a 15 s timeout. Verified: TC-PR-060102 8/8 with --repeat-each, and a cold `bun run test` replay of 301/302/303 at 80/80.
