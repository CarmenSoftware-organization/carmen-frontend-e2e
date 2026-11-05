---
title: "Adding a contact while updating a vendor silently does nothing, so set the email on the vendor's existing contact instead"
author: Thammanoon
date: 2026-11-05
branch: fix/data-reset-vendor-put
cost: { minutes: 2, tokens: 15131 }
id: l-da3d66b5
scope: repo
status: active
src: agent
touches:
  - unit/data-reset/mappings.test.ts
  - scripts/data-reset/mappings.ts
---

## Decided
To give the first vendor (A023) an email, the data reset updates the contact the vendor already has (the sample workbook creates one, primary, with email "") instead of adding a new contact. It only adds a contact when the vendor has none.

## Tried and ruled out
- PATCH on the vendor: the gateway has no PATCH route for vendors and answers 404. Vendors update with PUT and the body needs `doc_version`.
- PUT with `vendor_contact.add`: answers 200 and bumps doc_version, but the contact never appears on the vendor. The backend's update path calls createMany for added contacts without setting vendor_id, so the row is not linked to the vendor. Backend bug, not fixed yet.

## Watch out
Anything that adds vendor contacts through the update endpoint (scripts or specs) hits the same bug: success response, no contact. Use `vendor_contact.update` with `vendor_contact_id` on an existing contact, or add contacts when creating the vendor (the create path does link them).

In the code:
- e2e scripts/data-reset/mappings.ts `ensureFirstVendorReady`
- backend apps/micro-business/src/master/vendors/vendors.service.ts update: `vendor_contact.add` → `tb_vendor_contact.createMany` without vendor_id
- gateway apps/backend-gateway/src/config/config_vendors/config_vendors.controller.ts `@Put(':vendor_id')`
