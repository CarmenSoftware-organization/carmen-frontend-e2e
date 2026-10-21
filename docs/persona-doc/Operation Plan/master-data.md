---
title: Operation Plan Master Data — Operation Planner Journey
persona: Operation Planner
system: Carmen Blue — Operation Plan
modules: [Recipe Category, Cuisine Type, Equipment, Equipment Category, Recipe Equipment Category]
status: Draft
created: 2026-06-17
last_updated: 2026-06-17
version: 1.0.0
changelog:
  - 1.0.0 | 2026-06-17 | Initial draft — consolidated CRUD journey for the supporting master-data modules, grounded in routes/operation-plan source + the test-case catalogs
---

# Operation Plan Master Data — Operation Planner Journey

## Purpose

This document consolidates the five supporting master-data modules that surround the Recipe (see [recipe.md](recipe.md)). They are all relatively simple CRUD entities, so they share one journey doc rather than one thin file each.

Two editing patterns are in play, grounded in the source:

- **Detail-page modules** open a dedicated page (`/:id`) with a view → Edit flow: **Recipe Category**, **Equipment** (both have `[id]/page.tsx` and `new/page.tsx` routes).
- **Dialog modules** create and edit inside an in-list Dialog: **Equipment Category** and **Recipe Equipment Category** (both ship an `*-dialog.tsx` and no `[id]` route).
- **Cuisine** also uses the detail-page pattern (`cuisine/[id]/page.tsx`, `cuisine/new/page.tsx`).

All modules share the same list affordances: Search (Enter to apply), Status (Active/Inactive) filter, optional List/Grid toggle, and an `EmptyComponent` for no-match searches. Update calls carry `doc_version` for optimistic concurrency.

## Use Case

> As an Operation Planner I want to maintain the cuisines, categories and equipment master data so that recipe authoring has clean, complete lookups to draw from.

---

## Module 1 — Recipe Category (`/operation-plan/category`, prefix `OPCAT`)

Classifies recipes; supports a **parent/child hierarchy** and carries **default cost settings + profit margins** that recipes can inherit. Detail-page editing.

**Key fields** (`recipe-category-form-schema.ts`)

| Field | Schema key | Required | Notes |
|-------|-----------|:--------:|-------|
| Code | `code` | ✅ | "Code is required"; `maxLength` 10 on the input |
| Name | `name` | ✅ | "Name is required" |
| Description | `description` | — | |
| Parent Category | `parent_id` | — | lookup; builds the hierarchy |
| Level | `level` | ✅ | ≥ 1 |
| Labor Cost % | `cost_labor_percentage` | — | Default Cost Settings; ≥ 0 |
| Overhead % | `cost_overhead_percentage` | — | Default Cost Settings; ≥ 0 |
| Target Food Cost % | `cost_target_food_cost_percentage` | — | Default Cost Settings; ≥ 0 |
| Minimum Profit Margin | `margin_minimum` | — | Default Profit Margins; ≥ 0 |
| Target Profit Margin | `margin_target` | — | Default Profit Margins; ≥ 0 |

**Actions:** list (Code/Name/Parent columns), search, filter by Status, filter by **Parent category** (multi-select), List/Grid toggle, open detail, create, create sub-category (pick Parent), edit name, edit cost settings & margins, delete (with confirm), cancel delete.

**Validation:** Code + Name required (TC-OPCAT-200001); Code capped at 10 chars (TC-OPCAT-200002).

**Linked test cases:** TC-OPCAT-010001 … TC-OPCAT-010005, TC-OPCAT-020001, TC-OPCAT-030001, TC-OPCAT-030002, TC-OPCAT-040001, TC-OPCAT-040002, TC-OPCAT-050001, TC-OPCAT-050002, TC-OPCAT-100001, TC-OPCAT-200001, TC-OPCAT-200002, TC-OPCAT-900001. (Catalog: `docs/test-cases/110-op-category.md`)

---

## Module 2 — Cuisine Type (`/operation-plan/cuisine`, prefix `CUIS`)

Classifies recipes by cuisine and region. Detail-page editing.

**Key fields** (`cuisine-form-schema.ts`)

| Field | Schema key | Required | Notes |
|-------|-----------|:--------:|-------|
| Name | `name` | ✅ | "Name is required" |
| Region | `region` | ✅ | "Region is required"; default `ASIA`; shown as a colored Badge in the list |
| Description | `description` | — | |
| Note | `note` | — | |
| Popular Dishes | `popular_dishes` | — | newline-separated list (text ↔ array) |
| Key Ingredients | `key_ingredients` | — | newline-separated list (text ↔ array) |
| Active | `is_active` | — | StatusSwitch; default true |

**Actions:** list (Name + Region badge), search, filter by Status, open detail, create (Name + Region), create with popular dishes / key ingredients, edit name & region, toggle Active→Inactive, delete (confirm), cancel delete.

**Validation:** Name required (TC-CUIS-200001); Region required (TC-CUIS-200002).

**Linked test cases:** TC-CUIS-010001 … TC-CUIS-010004, TC-CUIS-020001, TC-CUIS-030001, TC-CUIS-030002, TC-CUIS-040001, TC-CUIS-040002, TC-CUIS-050001, TC-CUIS-050002, TC-CUIS-100001, TC-CUIS-200001, TC-CUIS-200002, TC-CUIS-900001. (Catalog: `docs/test-cases/111-cuisine.md`)

---

## Module 3 — Equipment (`/operation-plan/equipment`, prefix `EQP`)

Kitchen equipment register. Detail-page editing with sectioned form (General, Quantity, Maintenance, Instructions, Additional).

**Key fields** (`eq-form-schema.ts`)

| Field | Schema key | Required | Notes |
|-------|-----------|:--------:|-------|
| Code | `code` | ✅ | required |
| Name | `name` | ✅ | required |
| Category | `category_id` | ✅ (per catalog) | lookup |
| Description | `description` | — | |
| Brand / Model / Serial No | `brand` / `model` / `serial_no` | — | manufacturer info |
| Capacity / Power Rating / Station | `capacity` / `power_rating` / `station` | — | shown in list columns |
| Available Qty / Total Qty | `available_qty` / `total_qty` | — | numeric, **≥ 0** (default 1) |
| Usage Count / Avg Usage Time | `usage_count` / `average_usage_time` | — | numeric, ≥ 0 |
| Maintenance Schedule | `maintenance_schedule` | — | Maintenance section |
| Last / Next Maintenance Date | `last_maintenance_date` / `next_maintenance_date` | — | date pickers |
| Operation / Safety / Cleaning instructions | `operation_instructions` / `safety_notes` / `cleaning_instructions` | — | Instructions section |
| Active / Portable | `is_active` / `is_portable` | — | toggles in Additional section |

**Actions:** list (Code, Name, Category, Brand, Model, Station, Capacity), search, filter by Status, List/Grid toggle, open detail, create (required fields), create with manufacturer/station info, edit, edit quantities, fill maintenance schedule & dates, fill instructions, toggle Portable/Active, delete (from Edit, confirm), cancel delete.

**Validation:** Code + Name required (TC-EQP-200001); Category required (TC-EQP-200002); quantities cannot be negative (`min(0)`) (TC-EQP-200003).

**Linked test cases:** TC-EQP-010001 … TC-EQP-010004, TC-EQP-020001, TC-EQP-030001, TC-EQP-030002, TC-EQP-040001, TC-EQP-040002, TC-EQP-050001, TC-EQP-050002, TC-EQP-100001, TC-EQP-200001, TC-EQP-200002, TC-EQP-200003, TC-EQP-400001, TC-EQP-410001, TC-EQP-420001. (Catalog: `docs/test-cases/130-equipment.md`)

---

## Module 4 — Equipment Category (`/operation-plan/equipment-category`, prefix `EQPC`)

Classifies equipment. **Dialog editing** (`equipment-category-dialog.tsx`).

**Key fields** (`equipment-category-form-schema.ts`)

| Field | Schema key | Required | Notes |
|-------|-----------|:--------:|-------|
| Name | `name` | ✅ | required |
| Description | `description` | — | |
| Active | `is_active` | — | StatusSwitch; default true |

**Actions:** list (Name + count badge), search, filter by Status, List/Grid toggle, open edit dialog (prefilled), create (Name + optional Description), cancel create, edit name (persists; `doc_version`), toggle Active→Inactive, delete (confirm), cancel delete.

**Validation:** Name required → FieldError under the Name field (TC-EQPC-200001).

**Linked test cases:** TC-EQPC-010001 … TC-EQPC-010004, TC-EQPC-020001, TC-EQPC-030001, TC-EQPC-030002, TC-EQPC-040001, TC-EQPC-040002, TC-EQPC-050001, TC-EQPC-050002, TC-EQPC-100001, TC-EQPC-200001, TC-EQPC-900001. (Catalog: `docs/test-cases/131-equipment-category.md`)

---

## Module 5 — Recipe Equipment Category (`/operation-plan/recipe-equipment-category`, prefix `RECC`)

Classifies the equipment a recipe needs. **Dialog editing** (`recipe-equipment-category-dialog.tsx`). Schema is identical in shape to Equipment Category.

**Key fields** (`recipe-equipment-category-form-schema.ts`)

| Field | Schema key | Required | Notes |
|-------|-----------|:--------:|-------|
| Name | `name` | ✅ | required |
| Description | `description` | — | |
| Active | `is_active` | — | StatusSwitch; default true |

**Actions:** list (Name column + module title/description), search, filter by Status, open edit dialog (prefilled Name/Description/status), create (Name + optional Description), cancel create, edit name (persists; `doc_version`), toggle Active→Inactive, delete (confirm), cancel delete.

**Validation:** Name required → FieldError under the Name field (TC-RECC-200001).

**Linked test cases:** TC-RECC-010001, TC-RECC-010002, TC-RECC-010003, TC-RECC-020001, TC-RECC-030001, TC-RECC-030002, TC-RECC-040001, TC-RECC-040002, TC-RECC-050001, TC-RECC-050002, TC-RECC-100001, TC-RECC-200001, TC-RECC-900001. (Catalog: `docs/test-cases/121-recipe-equipment-category.md`)

---

## Shared Patterns Summary

| Capability | Recipe Category | Cuisine | Equipment | Equipment Category | Recipe Equipment Category |
|------------|:---------------:|:-------:|:---------:|:------------------:|:-------------------------:|
| Edit surface | Detail page | Detail page | Detail page | Dialog | Dialog |
| Code field | ✅ | — | ✅ | — | — |
| List/Grid toggle | ✅ | — | ✅ | ✅ | — |
| Status filter | ✅ | ✅ | ✅ | ✅ | ✅ |
| Hierarchy / Parent | ✅ | — | — | — | — |
| Authorization guard | ✅ | ✅ | ✅ | ✅ | ✅ |
| Empty-state on no match | ✅ | ✅ | ✅ | ✅ | ✅ |

Each module also has an **Authorization** test (TC-*-100001): a user without permission is denied access (redirect or error, no data shown).
