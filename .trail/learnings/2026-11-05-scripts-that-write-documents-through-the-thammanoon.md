---
title: Scripts that write documents through the gateway must use its real wire shapes — fakes built from the DTO names pass while every live call fails
author: Thammanoon
date: 2026-11-05
branch: feature/data-reset-documents
cost: { minutes: 1, tokens: 0 }
id: l-bfd11ac1
scope: repo
status: active
src: agent
touches:
  - scripts/data-reset/verify-dataset.ts
  - unit/data-reset/docs-fixtures.ts
---

## Decided
- Dates go out as full ISO datetimes (noon Bangkok in UTC), because many create DTOs use `z.string().datetime()` and "2026-11-05" fails with 400.
- Refs are read from GET with a flat-or-collapsed helper, because @CollapseRefs returns `inventory_unit_id` / `product_id` / `order_unit_id` as `{ id, … }` objects; otherwise the next write silently drops the field.
- Test fakes collapse `*_id` like the gateway, because fakes that echo the request shape let 115 unit tests pass while the review found every live document kind would fail.

## Watch out
- Create/mutation responses carry only `{ id, doc_version }` — GET the doc for its number.
- Cross-BU lists (`/api/purchase-requests?bu_code=`, `/api/store-requisitions?bu_code=`) answer `data: [{ bu_code, paginate, data }]`; per-BU lists are flat, so counts read 0 otherwise.
- Product update needs `doc_version` and `locations.{add|update}[].location_id` (no re_order_qty), and products must be linked to a location or the PR item picker is empty there.

In the code: scripts/data-reset/docs/{dates,refs,transition}.ts, scripts/data-reset/verify-dataset.ts (listOf), unit/data-reset/docs-fixtures.ts (collapseRefs); backend apps/backend-gateway/src/common/dto/**
