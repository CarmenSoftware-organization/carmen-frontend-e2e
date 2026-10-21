---
title: System Config — Documents, Sequences, Email, Datasets & Signatures
persona: Platform Administrator
route: /system-admin/{document,running-code,config-email,dashboard-dataset} · /system-admin (signature-config)
status: Draft
parent: INDEX.md
version: 1.0.0
last_updated: 2026-06-17
changelog:
  - 1.0.0 | 2026-06-17 | Initial draft — consolidated journey for document repository, running-code, config-email, dashboard-dataset and signature-config
---

# System Config — Documents, Sequences, Email, Datasets & Signatures

> This doc consolidates the five simpler System Admin configuration screens the Platform Administrator manages. Each is small enough that a per-screen journey would be repetitive, so they are grouped here with a short section apiece. The richer SQL Workbench has its own doc: [query-dataset.md](query-dataset.md).

---

## Purpose / Use Case

The Platform Administrator uses these screens to keep platform plumbing healthy:

- Maintain the shared **document repository** (templates, reference files).
- Define **number sequences** (running codes) that procurement documents draw from.
- Configure **outbound email** (SMTP) and verify it with a test send.
- Review the **dashboard dataset** catalog the system ships (read-only).
- Shape the **signature block** that prints on documents (PR/PO/SR/GRN/CN/Adjustment).

All five live under `/system-admin/*` and are guarded — an unauthenticated request to any of them redirects to `/login`.

---

## Screens & Steps

### A. Document Repository — `/system-admin/document`

**Purpose** A plain file store: upload, list, filter, delete. There is no create/edit form and no detail page — "creating" a document means uploading a file.

**Key fields (table columns)**

| Column | Description |
|--------|-------------|
| File Name | The uploaded file's name. |
| Type | File-type icon derived from the content type. |
| Size | File size. |
| Last Modified | Upload / modification timestamp. |

**Actions**

- **Upload** (top-right) — opens the file picker; the button shows **Uploading** and is disabled while the mutation is pending; success shows a toast and the new row.
- **Search** — submits on Enter; no-match shows an empty state.
- **Type filter** — multi-select over PDF / Excel·CSV / Word / Image / Text / Archive / Code; active filters appear as removable badges with **Clear all**; the count badge reflects the filtered set.
- **Delete** (row action) — opens a dialog naming the file; Cancel keeps it, confirm deletes it (success toast) and the row disappears.
- **Mobile** — rows render as cards with infinite scroll; the filter is a bottom Sheet.

**Validation**

- Files over **10 MB** are rejected with a `fileSizeLimit` error toast and the input resets.
- The picker `accept` is limited to `.pdf,.docx,.xls,.xlsx,.csv,.txt`; unsupported types (e.g. `.exe`) are not stored.

**Linked Test Cases** — `docs/test-cases/1107-document.md` · [user stories](../../user-stories/1107-document.md) (prefix `DOC`, 18 cases): TC-DOC-010001..010009, TC-DOC-030001..030002, TC-DOC-050001..050003, TC-DOC-100001, TC-DOC-200001..200002, TC-DOC-900001.

---

### B. Running Code — `/system-admin/running-code`

**Purpose** Manage number sequences (running codes) as records keyed by `type`, each holding a JSON `config` (prefix / format / next-number / reset rules) and a `note`. These feed the numbering of procurement documents.

**Key fields (Add/Edit dialog)**

| Field | Description |
|-------|-------------|
| Type | Required record key; max 100 chars. Read-only / disabled when editing. |
| Config | JSON textarea (max 256) with a **Format JSON** button; empty saves as `{}`. |
| Note | Free text, max 256. |

**Actions**

- **Add** — always visible; opens the dialog with Type / Config / Note and Cancel / Create.
- **Init** — seeds the default set of running codes; button shows *initializing*, then an `initSuccess` toast.
- **Export** — downloads a file with Type / Note / Config columns; button shows *exporting*; warns `exportNoData` when empty.
- **Print** — print the list (desktop; on mobile these sit in a **More** dropdown).
- **Edit** — click the Type cell (or row action) to reopen the dialog; updates send the original `doc_version` (optimistic concurrency).
- **Delete** — dialog naming the type; Cancel keeps it, confirm removes it.

**Validation**

- Empty Type → required FieldError (`type.min(1)`); dialog stays open.
- Invalid JSON in Config → `invalidJson` FieldError (zod refine on `JSON.parse`); no submit.
- Type capped at 100 chars; Config and Note capped at 256.

**Linked Test Cases** — `docs/test-cases/1110-running-code.md` · [user stories](../../user-stories/1110-running-code.md) (prefix `RUNC`, 19 cases): TC-RUNC-010001..010005, TC-RUNC-030001..030004, TC-RUNC-040001..040002, TC-RUNC-050001..050002, TC-RUNC-100001, TC-RUNC-200001..200003, TC-RUNC-300001..300002.

---

### C. Config Email (SMTP) — `/system-admin/config-email`

**Purpose** A single settings form (config key `report_email`) for the outbound SMTP server and report recipients, with a one-click test send.

**Key fields**

| Group | Field | Description |
|-------|-------|-------------|
| SMTP Server | Host | Required. |
| | Port | Number, 1–65535, default 587. |
| | Username | Required. |
| | Password | Required; `type=password` (masked). |
| | From Address | Required. |
| | Enabled | Switch toggling `smtp_enabled`. |
| Recipients | To | Comma-separated; parsed to an array. |
| | CC | Comma-separated; parsed to an array. |
| | Subject Prefix | Default `[Carmen Blue]`. |

**Actions**

- **Save** — upserts to config key `report_email`; success toast `Email config saved`. Recipients/CC are split on `,` `;` or whitespace, trimmed, and sent as arrays.
- **Test Email** — sends a test message; button disabled while sending; success toast `Test email sent successfully`. On failure the backend error surfaces as an error toast (no success toast).
- Existing config is prefilled on load (host/port/username/from, Enabled, recipients/cc joined with `, `, subject prefix).

**Validation**

- Empty Host → `SMTP host is required`.
- Empty Username / Password / From → respective required errors.
- Port outside 1–65535 → FieldError (zod int min 1 max 65535).
- On failed submit the page scrolls to the first invalid field.

**Linked Test Cases** — `docs/test-cases/1111-config-email.md` · [user stories](../../user-stories/1111-config-email.md) (prefix `CEML`, 14 cases): TC-CEML-020001..020005, TC-CEML-040001..040002, TC-CEML-100001, TC-CEML-300001..300002, TC-CEML-200001..200004.

---

### D. Dashboard Dataset — `/system-admin/dashboard-dataset`

**Purpose** A **read-only** catalog of the dashboard datasets the system provides. No create / edit / delete — the Platform Admin browses and searches only.

**Key fields (DatasetCard)**

| Field | Description |
|-------|-------------|
| Name | Card heading. |
| Shape | Badge (top-right). |
| Description | Body text. |
| Id · Unit | Bottom row. |

**Actions**

- **Search** — matches across id, name, description and category (case-insensitive); results regroup by category.
- Datasets are grouped into category sections (alphabetical, uppercase headers) with a `· N` per-category count; a total count badge sits beside the title.
- Clearing the search restores the full grouped list.

**States**

- **Loading** — spinner with `aria-busy` while fetching.
- **Error** — red error box with the error / `loadError` message; no list rendered.
- **Empty (no data)** — `emptyTitle` / `emptyDesc`; no total badge.
- **Empty (filtered)** — `emptyFilteredTitle` / `emptyFilteredDesc` for no-match searches.

**Linked Test Cases** — `docs/test-cases/1112-dashboard-dataset.md` · [user stories](../../user-stories/1112-dashboard-dataset.md) (prefix `DDS`, 13 cases): TC-DDS-010001..010008, TC-DDS-020001, TC-DDS-090001..090003, TC-DDS-100001.

---

### E. Signature Config — `/system-admin` (embedded component)

**Purpose** A reusable form (`routes/system-admin/_components/signature-config.tsx`) embedded in document-config screens (PR / PO / SR / GRN / CN / Adjustment). It defines the print signature block: page orientation plus the ordered list of signatories that prints at the foot of a document.

**Key fields**

| Group | Field | Description |
|-------|-------|-------------|
| Print Settings | Orientation | Portrait / Landscape. |
| Import from Workflow *(when `workflowType` supplied)* | Workflow select + Import Stages / stage chips | Pull approval stages in as signatures. |
| Signatures | Label | Required per card. |
| | Name | Free text, or a LookupCombobox to pick a signer when the doc has a workflow. |

**Actions**

- **Add** — appends an empty signature card (max 5; the button disables at 5).
- **Delete** (trash) — removes a card (min 1; the button disables at the last card).
- **Drag** (GripVertical handle) — reorders cards; positions renumber on Save.
- **Import Stages** — replaces signatures with the workflow's approval stages (drops `view_only`, max 5; stage name → label, first assigned user → name/user_id).
- **Stage chip** — appends a single stage; chips disable once 5 signatures exist.
- **Report Preview** — live preview reflecting label/name as typed (`—` when label empty).
- **Save** — upserts both the print config (orientation) and signature config (signatures), renumbering `position = index + 1`; success toast `<docLabel> config saved`.

**Validation**

- Empty Label → `Label is required` FieldError on the card, an error toast with the first `path:message`, scroll to the invalid field, no save.
- Max 5 signatures (Add and chips disabled at 5; schema max 5).
- Min 1 signature (delete disabled at the last card; schema min 1).

**Linked Test Cases** — `docs/test-cases/1113-signature-config.md` · [user stories](../../user-stories/1113-signature-config.md) (prefix `SIGN`, 15 cases): TC-SIGN-020001..020004, TC-SIGN-040001..040005, TC-SIGN-300001..300002, TC-SIGN-200001..200003, TC-SIGN-100001.
