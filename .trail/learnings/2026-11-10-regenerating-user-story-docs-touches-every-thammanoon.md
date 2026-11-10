---
title: "Regenerating user-story docs touches every file, so commit only the doc for the spec you changed"
author: Thammanoon
date: 2026-11-10
branch: feature/pr-price-comparison-columns
cost: { minutes: 1, tokens: 2651 }
id: l-728a2a97
scope: repo
status: active
src: agent
touches:
  - tests/pages/purchase-request.page.ts
  - tests/304-pr-purchaser-journey.spec.ts
  - scripts/generate-user-stories.ts
---

## Decided
After regenerating the user-story docs, keep only the doc for the spec whose annotations changed and revert the rest. The generator rewrites every file's "Last regenerated: <date> · git <sha>" footer even when nothing else changed, so committing everything turns a one-spec change into a 65-file diff that hides the real change.

## Watch out
- Before reverting a file, check that the footer line is its only change. If a file has other changes, a shared template or helper annotation moved (for example the security-cases helper), and that file belongs in the commit.

In the code:
- `bun docs:user-stories` → `scripts/generate-user-stories.ts`
- Check: `git diff --stat docs/user-stories` (footer-only files show `2 +-`)
- Revert the rest: `git diff --name-only docs/user-stories | grep -v <spec-basename> | xargs git checkout --`
