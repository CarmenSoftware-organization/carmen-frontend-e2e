---
title: "Workflow approval refusals come back as 422 with an error code, not 403, and the creator rule does not cover the submitter"
author: Thammanoon
date: 2026-11-25
branch: test/e2e-fe-be-sync-2026-11-25
cost: { minutes: 41, tokens: 153925 }
id: l-e2cf6e2e
scope: repo
status: active
src: agent
touches:
  - tests/804-ap-payment-approvals.spec.ts
  - scripts/seed-master/parser.ts
  - sample_seed_data/Preconfig_CARMEN_AVG.xlsx
  - package.json
---

## Decided
- 2026-11-25: when the backend refuses an approval because the user is not on the workflow stage, it answers 422 `WORKFLOW_USER_NOT_STAGE_APPROVER` (not the 403 the docs' oracle names). Specs assert the 422 + code that the BE really returns, not 403.
- The new creator-cannot-approve rule (`WORKFLOW_CREATOR_CANNOT_APPROVE`) blocks only the user who created the document. A different user who submits and then approves still gets 200 and posts; the maker-checker case on the submitter stays pinned as a product question.
- 2026-11-25: the workbook is read from bytes (`XLSX.read(buffer)`), not `XLSX.readFile`. The xlsx 0.20.3 tarball from the SheetJS CDN has no fs in its ESM build, and `readFile` throws "Cannot access file" even though the file exists.

## Watch out
- A burst of `login -> 503` in the middle of a run means a backend micro-service went down (e.g. its checkout was switched to another branch and the watcher restarted), not a spec failure. Check that :6020 (micro-business) is listening before reading the results.
- `bun docs:user-stories` rewrites the "Last regenerated" stamp in every file; keep only the docs of the specs you changed.

In the code:
- tests/804-ap-payment-approvals.spec.ts (TC-APAPR-030001 pinned, TC-APAPR-030002 asserts 422)
- BE PRs #1109 / #1110 / #1111 / #1116
- The reset step runs first (209 tenant tables emptied), and only then does master seeding open the workbook. A failure there leaves the BU with no master data, so every spec on it fails until the reset is run again in full.
- Before a live reset, check that the workbook parses: `bun -e 'import {readWorkbookFile} from "./scripts/seed-master/parser.ts"; readWorkbookFile("sample_seed_data/Preconfig_CARMEN_AVG.xlsx")'`.

- scripts/seed-master/parser.ts `readWorkbookFile`
- package.json `xlsx` = https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz (PR #108)
