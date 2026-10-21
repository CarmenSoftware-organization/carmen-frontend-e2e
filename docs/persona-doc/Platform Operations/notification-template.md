---
title: Notification Template — Platform Administrator Journey
persona: Platform Administrator
route: /system-admin/notification-template
status: Draft
parent: INDEX.md
version: 1.0.0
last_updated: 2026-06-17
---

# Notification Template — Platform Administrator Journey

> The CRUD surface for the messages Carmen Blue sends across its delivery channels. The Platform Administrator authors, edits and retires templates here.

---

## Purpose / Use Case

Notification templates define the reusable content the platform dispatches over four channels — **App**, **Email**, **LINE** and **SMS**. The administrator uses this module to create a template (name + channel + body, optionally subject + description), toggle whether it is active, edit it later, and delete obsolete ones. The list is the entry point; a template name links to a detail page that opens read-only and switches to an editable form on demand.

Grounded in `routes/system-admin/notification-template/` (`page.tsx`, `[id]/`, `new/`, and `_components/noti-tmpl.tsx`, `noti-tmpl-form.tsx`, `noti-tmpl-form-schema.ts`, `use-noti-tmpl-table.tsx`).

---

## Screens & Steps

### Screen 1 — Template List

**Purpose:** Browse, search and count existing templates; entry point to create or open one.

| Column | Description |
|--------|-------------|
| **Name** | Template name, rendered as a blue link to `/system-admin/notification-template/{id}`. Shows `...` if empty. |
| **Channel** | Delivery channel as a secondary badge with a channel icon — App (Bell), Email (Mail), LINE (MessageCircle), SMS (Smartphone). Not sortable. |
| **Subject** | Email-style subject line; shows `—` when null. Not sortable. |

**Actions**
- **Add** (Plus icon) → navigates to `/system-admin/notification-template/new`.
- **Search** input → filters the list (debounced DataGrid query).
- **Total badge** beside the title → record count in locale format; hidden when total = 0.

**Validation / notes:** Read-only listing; no inline editing.

---

### Screen 2 — Template Detail (view / edit)

**Purpose:** Inspect a single template read-only, then switch into an editable form to update or delete it. Route: `/system-admin/notification-template/{id}`.

The form has two sections — **General** and **Message content** — and opens in `view` mode (all inputs disabled). Pressing **Edit** switches to `edit` mode.

| Field | Section | Description | Validation |
|-------|---------|-------------|------------|
| **Name** | General | Template name. Required. | `min(1)` "Name is required"; `maxLength=100`. |
| **Channel** (type) | General | Select: App / Email / LINE / SMS. Required. | enum `app \| email \| line \| sms`. |
| **Description** | General | Optional free-text note. | `maxLength` enforced on the textarea; nullable. |
| **Status switch** (is_active) | General | StatusSwitch toggling Active/Inactive. Defaults to active on create. | boolean. |
| **Subject** | Message content | Optional subject line (mainly for email). | `maxLength=200`; empty string saved as `null`. |
| **Body** | Message content | Message body. Required. | `min(1)` "Body is required". |

**Status badge:** next to the title — `Active` (success-light) when `is_active=true`, else `Inactive` (warning-light). Hidden in add mode.

**Actions**
- **Edit** (view mode) → enables the form.
- **Save** (edit mode) → submits; on update, `doc_version` round-trips for optimistic-concurrency. Success toast, then back to list.
- **Cancel** (edit mode) → if the form is dirty, a DiscardDialog confirms; on confirm resets to original values and returns to view.
- **Delete** (edit mode only, destructive) → opens the Delete dialog (Screen 4).
- **Back** (ChevronLeft) → returns to list; in edit mode while dirty it raises the DiscardDialog (warning variant).

**Validation / notes:** In view mode every input is disabled. Validation errors scroll to the first invalid field on submit.

---

### Screen 3 — New Template Form

**Purpose:** Create a template from scratch. Route: `/system-admin/notification-template/new`.

Same field set and validation as Screen 2 in `add` mode. The status switch defaults to **active**. The primary action is **Create** (shows "Creating…" while pending). On success: a create toast fires and the app navigates back to the list, where the new template is searchable.

**Validation / notes:** Submitting without a name shows "Name is required"; without a body shows "Body is required"; the form stays on `/new`. Subject empty → saved as `null`.

---

### Screen 4 — Delete Confirmation Dialog

**Purpose:** Guard against accidental deletion. Opened from the Delete button in edit mode.

**Actions**
- **Cancel** → closes the dialog; the template remains and is still viewable.
- **Confirm** → deletes the template; success toast fires and the app returns to the list, where the template no longer appears.

**Validation / notes:** The dialog title and confirmation message interpolate the template name (`deleteConfirm`).

---

## Authorization

- Users without System Admin permission are blocked from the list (forbidden message or redirect away).
- Unauthenticated direct access to any route under `/system-admin/notification-template` redirects to `/login`.

---

## Linked Test Cases

See `docs/user-stories/1104-notification-template.md` (catalog `docs/test-cases/1104-notification-template.md`, prefix `NTPL`).

| Area | Test cases |
|------|-----------|
| List & search | TC-NTPL-010001 – TC-NTPL-010006 |
| Detail (view) | TC-NTPL-020001 – TC-NTPL-020003 |
| Create | TC-NTPL-030001 – TC-NTPL-030005 |
| Edit | TC-NTPL-040001 – TC-NTPL-040004 |
| Delete | TC-NTPL-050001 – TC-NTPL-050002 |
| Authorization / Auth-guard | TC-NTPL-100001 – TC-NTPL-100002 |
| Validation | TC-NTPL-200001 – TC-NTPL-200004 |
