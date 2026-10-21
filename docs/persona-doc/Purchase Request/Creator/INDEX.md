---
title: Creator — Purchase Request Workflow
persona: Creator (Requestor)
system: Carmen Blue — Procurement Module
status: Draft
created: 2026-04-10
test_user: requestor@zebra.com / 12345678
app_url: https://carmen-inventory.vercel.app
version: 1.0.0
last_updated: 2026-04-10
changelog:
  - 1.0.0 | 2026-04-10 | Initial draft
---

# Creator — Purchase Request Workflow

The **Creator** persona covers staff who originate purchase requests. In Carmen Blue, this role maps to the user type _Requestor_ (Staff, Chef, Housekeeping Manager, Engineers, Counter Staff, etc.).

---

## Workflow Overview

```mermaid
graph TD
    list["1. PR List"] --> create["2. Create PR"]
    list --> tmpl["3. Create from Template"]
    create --> detail["4. PR Detail"]
    tmpl --> detail
    detail -->|Edit| edit["5. Edit PR"]
    edit --> submit["6. Submit Confirmation"]
    submit --> inprog(["Submitted - In Progress"])
    inprog -->|Returned| returned["7. Returned PR"]
    returned --> edit
    detail -->|Delete| del["8. Delete Confirmation"]
    del --> list
```

---

## Document Index

| Step | Document | Screen | Route |
|------|----------|--------|-------|
| 1 | [step-01-pr-list.md](step-01-pr-list.md) | Purchase Request List | `/procurement/purchase-request` |
| 2 | [step-02-create-pr.md](step-02-create-pr.md) | Create PR Form (Blank) | `/procurement/purchase-request/new` |
| 3 | [step-03-pr-template.md](step-03-pr-template.md) | Create PR from Template | `/procurement/purchase-request/new?template_id=:uuid` |
| 4 | [step-04-pr-detail.md](step-04-pr-detail.md) | PR Detail View | `/procurement/purchase-request/:uuid` |
| 5 | [step-05-edit-pr.md](step-05-edit-pr.md) | Edit PR (Draft / Returned) | `/procurement/purchase-request/:uuid` |
| 6 | [step-06-submit-confirmation.md](step-06-submit-confirmation.md) | Submit Confirmation Dialog | overlay on `/:uuid` |
| 7 | [step-07-returned-pr.md](step-07-returned-pr.md) | Returned PR — Review & Resubmit | `/procurement/purchase-request/:uuid` (status=RETURNED) |
| 8 | [step-08-delete-confirmation.md](step-08-delete-confirmation.md) | Delete Confirmation Dialog | overlay on `/:uuid` |

---

## Access Path

**Dashboard → Procurement (sidebar) → Purchase Request**

Or direct: `https://carmen-inventory.vercel.app/procurement/purchase-request`

---

## Creator Permissions Summary

| Action | Draft | In Progress | Void | Approved | Completed |
|--------|-------|-------------|------|----------|-----------|
| View | ✅ | ✅ | ✅ | ✅ | ✅ |
| Edit | ✅ | ❌ | ✅ | ❌ | ❌ |
| Submit | ✅ (requires ≥1 item) | ❌ | ❌ | ❌ | ❌ |
| Delete | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## Related Flow Documents

| Stage | Persona | Document |
|-------|---------|----------|
| 1 — Create & Submit | **Creator** ← you are here | This folder |
| 2 — Vendor Allocation | Purchaser | `02-purchaser/` |
| 3 — Approval | Approver | `03-approver/` |
