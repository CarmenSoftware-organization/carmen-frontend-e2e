---
title: Product — Product Master Journey
persona: Product Manager
route: /product-management/product
status: Draft
parent: INDEX.md
version: 1.0.0
last_updated: 2026-06-17
---

# Product — Product Master Journey

> Grounded in `routes/product-management/product` of `carmen-frontend` (list `page.tsx` + `_components/`, create `new/page.tsx`, detail `[id]/page.tsx` + `[id]/_content.tsx`). Field labels in the source are i18n keys (`field.*`, `productManagement.product.*`); this doc gives the human-readable label they resolve to plus the underlying form field name.

## Purpose / Use Case

The Product Manager maintains the **product master** — the canonical list of items the property buys, stocks, and consumes. Each product carries its identification (name/code/local name, category via item group), the **inventory unit** it is counted in, **unit conversions** to purchase and recipe units, per-location **stock thresholds**, **pricing/tax** defaults, descriptive **attributes**, **images**, and **eco-label certifications**. Keeping this catalog complete and accurate is what lets the procurement, receiving, and inventory modules reference real products with correct units and costs.

Two screens carry the whole journey:

- **Product List** (`/product-management/product`) — browse, search, filter (status / category / sub-category / item group), switch list ↔ grid, export/print, open a product, or delete from the row menu.
- **Create / Detail form** (`/product-management/product/new` and `/product-management/product/:id`) — a single sectioned, tabbed form used for both creating (add mode) and viewing/editing (view → edit mode). The detail screen always opens read-only; the Product Manager presses **Edit** to make changes, then **Save**.

---

## Screens & Steps

### 1. Product List — `/product-management/product`

Source: `routes/product-management/product/page.tsx`, `_components/pd-component.tsx`, `_components/use-product-table.tsx`, `_components/pd-card.tsx`.

**Header / toolbar**
- Page title with a **count badge** of total records.
- **Add** button → `/product-management/product/new`.
- **Search** (`SearchInput`) — filters by code/name.
- **Status filter** — options Active / Inactive.
- **Category**, **Sub-category**, **Item Group** filters — each a **multi-select**; options come from active records; multiple filters combine (AND) and changing any one resets to page 1.
- **Active-filter bar** — removable chips per applied filter, plus **Clear all**.
- **View toggle** — list (`DataGrid`) ↔ grid (`ProductCard`). Forced to grid on mobile; toggle hidden on mobile.
- **Columns** visibility control (list mode only).
- **Export** — produces a file with columns code / name / local name / unit / category / sub-category / item group / status; toasts success (or warning when no data). **Print** — opens the browser print dialog.

**List table columns** (in order): select, `#`, **code** (clickable → detail), **name** (clickable → detail), **local name**, **unit** (inventory unit), **category**, **sub-category**, **item group**, **status** (Badge — `success` for active, `destructive` for inactive), row-delete action.

**Grid card** (`ProductCard`): name, code, Active/Inactive badge, local name, unit, item group; whole card clickable → detail. Grid mode uses **infinite scroll** (loads the next page when the sentinel scrolls into view); list mode uses standard **pagination**.

**Steps**
1. Navigate to `/product-management/product`.
2. (optional) Type a code/name in search and press Enter, or apply Status / Category / Sub-category / Item Group filters.
3. Click a product's code or name to open its detail, or use the row action menu → Delete.

> Covers TC-PROD-010001…010010, 050001, 050002, 100001 (auth guard), 900001 (mobile grid + infinite scroll).

---

### 2. Create Product — `/product-management/product/new`

Source: `new/page.tsx`, `_components/pd-form.tsx`, `pd-form-toolbar.tsx`, `pd-required-checklist.tsx`, `pd-general-tab.tsx`, `pd-unit-conversion-tab.tsx`, `pd-unit-cells.tsx`, `pd-location-tab.tsx`.

The form opens in **add mode** with a **Draft** status badge, a **Required checklist**, tabs **General / Units / Locations**, and a **Create Product** submit button. (The **Eco-Labels** tab appears only once the product exists — i.e. on detail/edit, never on create.)

**Required checklist** (informational progress, 7 items — `pd-required-checklist.tsx`): Name · Local name · Item group · Inventory unit · Price · Order unit · Barcode. The counter shows "done / total"; each chip flips to a green tick when its field is filled. (Not all 7 are hard schema-required — see the General table below; barcode and order-unit presence are checklist-only, and the form auto-injects a default 1:1 order-unit on submit if none exists.)

#### General tab

##### Identification (`sectionIdentification`)
| Label | Field name | Input | Required | Notes |
|-------|-----------|-------|----------|-------|
| Name | `name` | text | ✅ | max 100 |
| Code | `code` | text | ✅ | max 10 (input `maxLength=10`) |
| Local name | `local_name` | text | ✅ | max 100, Thai font |
| Description | `description` | textarea (3 rows) | — | max 256 |
| Item group | `product_item_group_id` | lookup | ✅ | selecting it auto-fills category & sub-category names, price/qty deviation limits, recipe/sold flags, and tax profile |
| Category | _(derived)_ | read-only display | — | from item group |
| Sub-category | _(derived)_ | read-only display | — | from item group |
| Inventory unit | `inventory_unit_id` | lookup | ✅ | the base unit the product is counted in |
| Tax profile | `tax_profile_id` | lookup | — | |
| Price deviation limit | `price_deviation_limit` | number `%` | — | 0–100 |
| Qty deviation limit | `qty_deviation_limit` | number `%` | — | 0–100 |

##### Codes & Cost (`sectionCodesCost`)
| Label | Field name | Input | Required |
|-------|-----------|-------|----------|
| SKU | `sku` | text | — |
| Barcode (EAN-13) | `barcode` | text | — (checklist item, not schema-enforced) |
| Price | `price` | number | ✅ schema requires non-null **≥ 0** |

##### Flags (`sectionFlags`) — toggle switches
| Toggle | Field name | Control |
|--------|-----------|---------|
| Status | `product_status_type` | Switch — on = `active`, off = `inactive` |
| Used in recipe | `is_used_in_recipe` | Switch (boolean) — gates the Ingredient Units section |
| Sold directly | `is_sold_directly` | Switch (boolean) |

##### Attributes (`sectionAttributes`)
Dynamic rows (`info` field array). **Add attribute** adds a row with fields **label** (required per row), **value**, **data_type** (default `string`). Suggested labels include allergens, calories, serving size, storage, shelf life, brand, color, size, weight, country of origin, etc. Rows deletable via confirm dialog.

##### Images
Renders only on an existing product (edit/detail) — not part of the form schema; uploaded/managed separately via `ProductImages`.

#### Units tab

Source: `pd-unit-conversion-tab.tsx`, `pd-unit-cells.tsx`. Two stacked conversion grids, both keyed against the inventory unit:

- **Order Unit** (`order_units`) — `from_unit` is the editable purchase unit; `to_unit` is fixed to the inventory unit.
- **Ingredient Unit** (`ingredient_units`) — `from_unit` is fixed to the inventory unit; `to_unit` is the editable recipe unit. Add is disabled unless **Used in recipe** is on.

Each row's fields: `from_unit_id` (lookup, excludes already-used units), `from_unit_qty`, `to_unit_id` (lookup), `to_unit_qty` (**min 1**), `is_default` (radio — only one default per array; selecting one clears the others), `is_active` (checkbox). A live **conversion preview** reads `"{fromQty} {fromName} = {toQty} {toName}"`. Add is also disabled until an **inventory unit** is selected.

> Covers TC-PROD-400001 (add conversion + exclusive default) and TC-PROD-400002 (qty < 1 rejected via `to_unit_qty.min(1)`).

#### Locations tab

Source: `pd-location-tab.tsx`. Dynamic `locations` field array with a client-side search box and **Add location**. Each row: **Location** (`location_id`, lookup, required; excludes already-assigned locations; auto-fills code/name/type/delivery point), **Min qty** (`min_qty`), **Max qty** (`max_qty`), **Re-order qty** (`re_order_qty`), **Par qty** (`par_qty`) — all numeric ≥ 0 — and a read-only status badge. Rows deletable via confirm dialog.

#### Toolbar & submit (`pd-form-toolbar.tsx`)
- Add mode shows **Cancel** and **Create Product** (label switches to "creating…" while pending) plus the **Draft** badge.
- On success: create → navigate to the new product's detail (`/product-management/product/:id`).

**Steps (minimal create)**
1. Go to `/product-management/product/new`.
2. General → fill Name, Code, Local name.
3. Select Item group (category/sub-category derive automatically).
4. Select Inventory unit; enter Price.
5. (optional) Add Attributes / Units / Locations.
6. Press **Create Product** → success toast → redirected to the product detail.

> Covers TC-PROD-030001…030005, plus validation TC-PROD-200001 (mandatory fields), 200002 (code max 10), 200003 (duplicate code rejected by backend).

---

### 3. Product Detail (view) — `/product-management/product/:id`

Source: `[id]/page.tsx`, `[id]/_content.tsx`, `pd-form.tsx`, `pd-eco-label-section.tsx`.

Opens **read-only**: all fields render as text, no Add-row buttons, and the toolbar shows an **Edit** button (plus a status badge — Active / Inactive). Tabs present: **General**, **Units**, **Locations**, and **Eco-Labels** (the Eco-Labels tab is shown only because a product id now exists).

**Eco-Labels** (`pd-eco-label-section.tsx`): a table of certifications — columns Certificate No · Eco label · Issued date · Expiry date · Status (Badge) · Edit/Delete actions. **CRUD here fires its own API calls immediately**, independent of the product Save (so it is available only on a saved product and is not gated by form dirtiness).

**Steps**
1. From the list, click a product's code/name.
2. Review the General / Units / Locations / Eco-Labels tabs in read-only mode.

> Covers TC-PROD-020001 (opens in view), 020002 (all tabs present), 020003 (read-only until Edit).

---

### 4. Edit Product — `/product-management/product/:id` (edit mode)

Pressing **Edit** switches every field to editable inputs and swaps the toolbar to **Delete · Cancel · Save** (Save disabled unless the form is dirty).

- Edit identification, codes, price, flags, attributes, unit conversions, locations exactly as in the create form.
- **Toggle status** Active → Inactive via the Flags switch.
- **Cancel** on a dirty form raises a **Discard** warning dialog; confirming reverts to the saved values and returns to view mode.
- On **Save** success: update toast, form resets, returns to **view** mode.

**Steps**
1. Open a product detail, press **Edit**.
2. Change fields (e.g. name, price, status).
3. Press **Save** (or **Cancel** → confirm discard).

> Covers TC-PROD-040001 (edit name/price persists), 040002 (status toggle persists), 040003 (cancel-while-dirty discard warning).

---

### 5. Delete

From the **list row action menu** (or the detail toolbar **Delete** in edit mode) → a confirmation dialog. **Cancel** keeps the row; **Confirm** deletes the product (success toast) and removes it from the list — a follow-up search returns the empty state.

> Covers TC-PROD-050001 (cancel keeps row) and TC-PROD-050002 (confirmed delete, then not found).

---

## Linked Test Cases

| TC | Title | Screen / Step |
|----|-------|---------------|
| TC-PROD-010001 | หน้า list สินค้าโหลดสำเร็จ | List |
| TC-PROD-010002 | ปุ่ม Add แสดงและคลิกไปหน้า new ได้ | List → Create |
| TC-PROD-010003 | ตาราง list แสดงคอลัมน์ครบ | List columns |
| TC-PROD-010004 | ค้นหาด้วยคำที่มีอยู่ | List search |
| TC-PROD-010005 | ค้นหาคำที่ไม่มีต้องแสดง empty state | List search |
| TC-PROD-010006 | filter status (active/inactive) | List filters |
| TC-PROD-010007 | filter category/sub-category/item group (multi-select) | List filters |
| TC-PROD-010008 | active-filter bar ลบทีละอัน / Clear all | List filters |
| TC-PROD-010009 | สลับ list / grid view | List view toggle |
| TC-PROD-010010 | export และ print | List toolbar |
| TC-PROD-020001 | เปิดหน้า detail ในโหมด view | Detail (view) |
| TC-PROD-020002 | หน้า detail แสดง tabs ครบ | Detail tabs |
| TC-PROD-020003 | โหมด view เป็น read-only จนกว่าจะกด Edit | Detail (view) |
| TC-PROD-030001 | เปิดหน้า new form สำเร็จ | Create |
| TC-PROD-030002 | Required checklist อัปเดต | Create checklist |
| TC-PROD-030003 | สร้างสินค้าขั้นต่ำสำเร็จ | Create General |
| TC-PROD-030004 | สร้างสินค้าพร้อม attribute row | Create Attributes |
| TC-PROD-030005 | สร้างสินค้าพร้อม location | Create Locations |
| TC-PROD-040001 | แก้ name/price แล้ว save persist | Edit |
| TC-PROD-040002 | toggle status active → inactive | Edit Flags |
| TC-PROD-040003 | Cancel ระหว่าง edit ที่ dirty ต้องเตือน discard | Edit |
| TC-PROD-050001 | เปิด delete dialog จาก list แล้ว cancel | Delete |
| TC-PROD-050002 | ลบสินค้าสำเร็จ | Delete |
| TC-PROD-100001 | ผู้ใช้ไม่ login ถูก redirect ไป /login | Auth guard |
| TC-PROD-200001 | บันทึกโดยไม่กรอกช่องบังคับ ต้องแสดง error | Create validation |
| TC-PROD-200002 | code เกิน 10 ตัวอักษรถูกจำกัด | Create validation |
| TC-PROD-200003 | สร้าง code ซ้ำ ต้องถูก reject | Create validation |
| TC-PROD-400001 | เพิ่ม order unit conversion และตั้ง default | Units |
| TC-PROD-400002 | conversion qty < 1 ถูก reject | Units validation |
| TC-PROD-900001 | mobile view แสดงเป็น card grid + infinite scroll | List (mobile) |

Full detail: [`docs/test-cases/100-product.md`](../../test-cases/100-product.md) · [`docs/user-stories/100-product.md`](../../user-stories/100-product.md).
Related Category configuration consumed here is covered by the automated **`101-product-category`** spec.
