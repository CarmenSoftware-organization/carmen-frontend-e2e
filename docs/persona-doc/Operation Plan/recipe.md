---
title: Recipe — Operation Planner Journey
persona: Operation Planner
system: Carmen Blue — Operation Plan
module: Recipe
route: routes/operation-plan/recipe
url: /operation-plan/recipe
prefix: RCP
status: Draft
created: 2026-06-17
last_updated: 2026-06-17
version: 1.0.0
changelog:
  - 1.0.0 | 2026-06-17 | Initial draft, grounded in routes/operation-plan/recipe source + docs/test-cases/120-recipe.md
---

# Recipe — Operation Planner Journey

## Purpose

The Recipe module is the heart of Operation Plan. It lets the Operation Planner author a full recipe specification: classify it (code, name, cuisine, category, difficulty), compose its ingredients, set prep/cook time and base yield, let a live **cost console** compute cost-per-portion and margins, record allergens/tags/compliance, attach images, and move the recipe through its `DRAFT → PUBLISHED` lifecycle.

## Use Case

> As an Operation Planner I want to build a costed, compliant recipe so that the kitchen can produce it consistently and the business can price it profitably.

A recipe is created from required classification fields, then enriched section by section on a single long form. The cost numbers are **computed automatically** from the values the planner enters — the planner supplies the inputs (ingredient costs, labor, overhead, base yield, selling price) and the form derives cost/portion, margin and food-cost %.

---

## Screens & Steps

### Screen 1 — Recipe List (`/operation-plan/recipe`)

The landing grid. Columns: **Code, Name, Cuisine, Category, Difficulty** (color-coded badge), with a count badge in the header.

| Action | Control | Behavior |
|--------|---------|----------|
| Search | Search box | Type name/code, press Enter → grid filters to matches |
| Filter by Cuisine | Cuisine multi-select | Shows only recipes in the chosen cuisine(s); a filter chip appears |
| Filter by Category | Category multi-select | Shows only recipes in the chosen category(ies) |
| Filter by Difficulty | Difficulty filter | EASY / MEDIUM / HARD |
| Switch view | List / Grid toggle | Card grid ↔ table (desktop) |
| Open detail | Click Code or Name | Navigate to `/operation-plan/recipe/:id` (view mode) |
| Add | Add button | Navigate to `/operation-plan/recipe/new` |

The Difficulty badge is color-coded: **EASY** → success (green), **MEDIUM** → warning (yellow), **HARD** → destructive (red). An empty search renders `EmptyComponent`.

Linked test cases: TC-RCP-010001 … TC-RCP-010007, TC-RCP-020001.

---

### Screen 2 — Recipe Detail / View (`/operation-plan/recipe/:id`)

Opens in **view** (read-only) mode. The toolbar shows the status badge and an **Edit** button; the hero shows the recipe image, name and quick stats. Clicking Edit unlocks the form sections below.

Linked test cases: TC-RCP-020001, TC-RCP-040001, TC-RCP-040002, TC-RCP-050001, TC-RCP-050002.

---

### Screen 3 — Create / Edit Recipe (`/operation-plan/recipe/new` and `:id` in edit mode)

A single long form composed of several sections. The **required** fields gate creation; the schema (`recipe-form-schema.ts`) marks `code`, `name`, `status`, `difficulty`, `cuisine_id`, `category_id` and `base_yield_unit` as required.

#### 3a. Recipe Details (classification) — `recipe-general-fields.tsx`

| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| Code | text | ✅ | `maxLength={10}` |
| Name | text (hero field) | ✅ | edited inline in the hero |
| Cuisine | lookup (`LookupCuisine`) | ✅ | `cuisine_id` |
| Category | lookup (`LookupRecipeCategory`) | ✅ | `category_id` |
| Yield Unit | lookup (`LookupUnit`) | ✅ | `base_yield_unit` |
| Description | textarea | — | shown as the hero description preview |
| Difficulty | select (EASY/MEDIUM/HARD) | ✅ | rendered as a dotted pill in the hero |

On a failed submit the form **scrolls to the first invalid field** (TC-RCP-200003).

#### 3b. Hero & Quick Stats — `recipe-hero-fields.tsx`

The hero hosts the image gallery, the inline name field, the description preview, a pill row (difficulty / Active / Deduct-from-stock toggles), and four **Quick Stats** computed live:

| Quick Stat | Source | Notes |
|------------|--------|-------|
| Prep | `prep_time` | minutes |
| Cook | `cook_time` | minutes |
| Yield | `base_yield` | portions |
| Total | `prep_time + cook_time` | accent card; also shows `฿{costPerPortion}` when > 0 |

Prep / Cook time and Base Yield are adjusted with **+ / − steppers** and cannot go below 0 (TC-RCP-410001).

#### 3c. Ingredients — `recipe-ingredients-fields.tsx`

An editable table. Each row: **Name, Qty, Unit, Cost (฿), Yield %, Prep Notes**, plus a remove (X) button. The header shows the ingredient count and the running `฿` total; a footer row shows **Total Recipe Cost = Σ Cost**. When the table is empty, an empty-state card offers "Add first ingredient".

| Column | Default | Validation / behavior |
|--------|---------|-----------------------|
| Name | "" | free text |
| Qty | 1 | numeric, decimal |
| Unit | "" | free text (e.g. `g`) |
| Cost | 0 | numeric (฿), 0.01 step; feeds Total Recipe Cost |
| Yield % | 100 | 0–100; shows a **warning color when < 90** (TC-RCP-400005) |
| Prep Notes | "" | free text (Thai) |

Adding, editing and removing rows update the count and the total instantly (TC-RCP-400001 … TC-RCP-400004).

> Note: ingredients are an interactive client-side composition aid (the card flags an "ingredients preview" note); the recipe's costing inputs are entered in the cost console below.

#### 3d. Cost Console — `recipe-cost-fields.tsx` + `use-recipe-cost-calc.ts`

A sticky console composed of cost hero, breakdown, margins and metrics. The planner enters the **inputs**; the hook derives the rest with `round2`:

| Input field | Schema key |
|-------------|-----------|
| Total ingredient cost | `total_ingredient_cost` |
| Labor cost | `labor_cost` |
| Overhead cost | `overhead_cost` |
| Base yield | `base_yield` |
| Selling price | `selling_price` |
| Target food cost % | `target_food_cost_percentage` |

| Computed output | Formula (from `use-recipe-cost-calc.ts`) |
|-----------------|------------------------------------------|
| Cost per portion | `(ingredient + labor + overhead) / base_yield` (when yield > 0) |
| Gross margin | `selling_price − cost_per_portion` (when sell > 0) |
| Gross margin % | `gross_margin / selling_price × 100` |
| Actual food cost % | `ingredient / selling_price × 100` |
| Labor cost % | `labor / selling_price × 100` |
| Overhead % | `overhead / selling_price × 100` |
| Suggested price | `cost_per_portion / (1 − targetPct/100)` (when 0 < targetPct < 100) |

These outputs are written back into the form fields (`cost_per_portion`, `gross_margin`, `gross_margin_percentage`, etc.) so they persist on save (TC-RCP-420001).

#### 3e. Safety & Compliance — `recipe-compliance-fields.tsx`

| Element | Control | Notes |
|---------|---------|-------|
| Standard allergens | toggle chips from `ALLERGEN_OPTIONS` | stored in `allergens.standard[]` |
| Other allergens | text input (`maxLength={256}`) | comma-separated; stored in `allergens.custom` |
| Flagged count | derived label | `standard.length + custom items` |
| Tags | toggle chips (Seasonal, Best Seller, New, High Margin, Vegetarian) | stored newline/comma-joined in `tags` |

On save, standard + custom allergens are merged into a single array (`mergeAllergens`). The flagged-count label updates as chips/custom entries change (TC-RCP-430001). The **Deduct from stock** toggle lives in the hero pill row and is saved alongside tags (TC-RCP-430002).

#### 3f. Recipe Image Gallery — `recipe-image-gallery.tsx` + `use-recipe-gallery.ts`

A controlled desired-state gallery: a hero preview with reorder / set-primary / remove, a thumbnail strip, and an upload affordance (`IMAGE_ACCEPT_ATTR`, max `IMAGE_MAX_BYTES`). Existing images (from GET) and new uploads are reconciled into a **manifest** synced to the backend on submit (TC-RCP-440001).

#### 3g. Status lifecycle

Status (`DRAFT` default) is changed via a Status select in the toolbar. Changing `DRAFT → PUBLISHED` and saving flips the toolbar badge to Published (green) in view mode (TC-RCP-040002).

Linked test cases for the editor: TC-RCP-030001 (create), TC-RCP-030002 (discard dirty form), TC-RCP-200001 / TC-RCP-200002 / TC-RCP-200003 (validation), TC-RCP-400001 … TC-RCP-400005 (ingredients), TC-RCP-410001 (steppers), TC-RCP-420001 (cost), TC-RCP-430001 / TC-RCP-430002 (compliance), TC-RCP-440001 (images).

---

### Screen 4 — Delete & Discard dialogs

- **Discard** (`DiscardDialog`) — fires on Back/Cancel when the form is dirty; confirming returns to the list without saving (TC-RCP-030002).
- **Delete** (`DeleteDialog`) — from Edit mode → Delete → confirm: success toast and redirect to the list, recipe removed (TC-RCP-050001). Cancel keeps the recipe (TC-RCP-050002).

---

## Authorization

A user without recipe permission is denied access to `/operation-plan/recipe` (redirect or error; no data shown) — TC-RCP-100001.

---

## Linked Test Cases

Full catalog: `docs/test-cases/120-recipe.md` · User stories: `docs/user-stories/120-recipe.md`

| Area | Test cases |
|------|-----------|
| List / search / filter / view-toggle / badge | TC-RCP-010001 … TC-RCP-010007 |
| Detail view | TC-RCP-020001 |
| Create / discard | TC-RCP-030001, TC-RCP-030002 |
| Edit / publish | TC-RCP-040001, TC-RCP-040002 |
| Delete / cancel | TC-RCP-050001, TC-RCP-050002 |
| Authorization | TC-RCP-100001 |
| Validation | TC-RCP-200001, TC-RCP-200002, TC-RCP-200003 |
| Ingredients | TC-RCP-400001, TC-RCP-400002, TC-RCP-400003, TC-RCP-400004, TC-RCP-400005 |
| Time / yield steppers | TC-RCP-410001 |
| Cost console | TC-RCP-420001 |
| Compliance (allergens/tags/stock) | TC-RCP-430001, TC-RCP-430002 |
| Image gallery | TC-RCP-440001 |
