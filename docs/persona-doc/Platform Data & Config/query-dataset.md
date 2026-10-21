---
title: Query Dataset — SQL Workbench
persona: Platform Administrator
route: /system-admin/query-dataset
status: Draft
parent: INDEX.md
version: 1.0.0
last_updated: 2026-06-17
changelog:
  - 1.0.0 | 2026-06-17 | Initial draft — full SQL Workbench journey grounded in routes/system-admin/query-dataset
---

# Query Dataset — SQL Workbench

> The SQL Workbench is where the Platform Administrator explores the tenant database, runs read-only queries, and saves reusable database objects (views, stored procedures, functions) that downstream dashboards and reports draw from. It is the only authoring surface for these objects in Carmen Blue.

---

## Purpose / Use Case

A Platform Administrator opens the SQL Workbench to:

- **Inspect** existing views, procedures and functions in the tenant database via a searchable object tree.
- **Explore** data by writing and running read-only SQL, seeing the result set, and exporting it to CSV.
- **Author** a new reporting view (or stored procedure / function) and save it so it appears in the object tree and can back a dashboard dataset.
- **Remove** an obsolete object with Drop.

Two guardrails define the journey:

- **Run** accepts only read statements: `SELECT`, `WITH`, `SHOW`, `EXPLAIN`, `DESCRIBE`, `DESC`.
- **Save** accepts only `CREATE` (view / procedure / function) or `SELECT` / `WITH` (auto-wrapped into a view). Anything destructive — `DROP`, `TRUNCATE`, `DELETE`, `UPDATE` — is rejected by `validateSqlSafety` before it ever reaches the database.

---

## Screens & Steps

### 1. Opening the Workbench

Navigate to `/system-admin/query-dataset`. The page shows the **SQL Workbench** title, a left **Database Objects** sidebar, and the **SQL Editor** on the right. Unauthenticated visitors are redirected to `/login`.

### 2. The Database Object Tree (left sidebar)

| Element | Behavior |
|---------|----------|
| **Search** | Filters the tree by `schema.name`; "No matches" shows when nothing matches. |
| **Views** section | Collapsible; shows a count badge and each view as `schema.name`. |
| **Procedures / Functions** section | Collapsible; shows a count badge. Each item carries a `PROC` badge (stored procedure) or `FN` badge (function). |
| **Click an item** | Loads its definition into the editor — see step 4. |

Clicking a section header toggles it open/closed (the chevron flips).

### 3. The Object Form (above the editor)

| Field | Description |
|-------|-------------|
| **Object Name** | The identifier for the object being authored. Placeholder `e.g. v_pr_summary`. Required when saving a bare `SELECT` as a view. |
| **Type** | Select with options **View** (default) / **Stored Procedure** / **Function**. |

### 4. Loading an existing object

Click any object in the tree. The app fetches its definition and:

- Shows a success toast `Loaded <type>: schema.name`.
- Fills **Object Name** and the **SQL Editor** with the definition.
- Sets **Type** to match the object.
- Displays `Editing: schema.name (type)` and reveals the **Drop** button.

### 5. The SQL Editor (Monaco)

The editor is a Monaco instance with SQL tooling:

| Control | Behavior |
|---------|----------|
| **Run** (Ctrl+Enter) | Executes the SQL after the safety validator passes. Read statements only. |
| **Format** (Ctrl+Shift+F) | Reformats via `sql-formatter` — keywords uppercased, indentation applied — and writes the formatted text back to the editor/state. |
| **Minimap** toggle | Shows/hides the Monaco minimap. |
| Autocomplete | Suggestions drawn from the database schema. |
| Comment / Find / Wrap / Clear | Standard editor helpers. |

### 6. Running a query & the Result Panel

Enter a read statement (e.g. `SELECT 1 AS n, 'a' AS label`) and Run. The Result Panel opens with:

| Element | Description |
|---------|-------------|
| **Result table** | One column per selected column, with data rows. |
| **Header summary** | Row count, `durationMs` (ms), and column count for the run. |
| **CSV** button | Downloads `query_result_<timestamp>.csv` — header row of column names plus properly escaped data rows. Available when `rowCount > 0`. |
| **Pagination** | Rows per page (50 / 100 / 200 / 500) with Prev / Next; the `x–y of total` range stays correct. |
| **Error state** | A failing query shows an Error status with the DB message. If the message references `line N`, a hint `error referenced line N` is shown. |

### 7. Saving an object

Two save paths:

- **Explicit CREATE** — type `CREATE OR REPLACE VIEW v_test_qds AS SELECT 1 AS n;` and Save. A success toast names the view and schema; after refresh the object appears in the tree.
- **Auto-wrap** — set **Object Name** = `v_test_autowrap`, Type = View, write a bare `SELECT 1 AS n`, and Save. The app wraps it into `CREATE OR REPLACE VIEW` and saves.

### 8. Dropping an object

With an object loaded (Drop visible), click **Drop**. A browser `confirm` appears:

- **OK** → success toast `Dropped <type>: name`, the form resets (as if New), and the object leaves the tree.
- **Cancel** → nothing happens; the object stays and the editor keeps its content.

---

## Validation & Safety

| Rule | Trigger | Outcome |
|------|---------|---------|
| Run allows read-only only | Run a non-read statement (e.g. `DROP TABLE users;`) | `Invalid SQL` error toast; not executed. |
| Save blocks destructive SQL | Save SQL containing `DROP` / `TRUNCATE` (e.g. `TRUNCATE TABLE orders;`) | `Invalid SQL` error toast; not saved. |
| View name required | Save a bare `SELECT` (not starting with CREATE) with empty Object Name | `Please enter a name for the view` error toast; not saved. |

---

## Linked Test Cases

User-story doc: [`docs/user-stories/1108-query-dataset.md`](../../user-stories/1108-query-dataset.md) · Catalog: `docs/test-cases/1108-query-dataset.md` (prefix `QDS`, 21 cases)

| TC | Title |
|----|-------|
| TC-QDS-010001 | หน้า SQL Workbench โหลดสำเร็จ |
| TC-QDS-010002 | Database Object Tree แสดง Views และ Procedures/Functions |
| TC-QDS-010003 | ค้นหา object ใน tree กรองรายการได้ |
| TC-QDS-010004 | พับ/ขยาย section Views และ Procedures ได้ |
| TC-QDS-020001 | ฟอร์มมีช่อง Object Name และ Type (View/SP/Function) |
| TC-QDS-020002 | เลือก Type จาก dropdown เปลี่ยนค่าได้ |
| TC-QDS-020003 | คลิก object ใน tree โหลด definition เข้า editor |
| TC-QDS-030001 | สร้าง View ใหม่ด้วย CREATE OR REPLACE VIEW แล้ว Save สำเร็จ |
| TC-QDS-030002 | Save bare SELECT เป็น View (auto-wrap) โดยใส่ Object Name |
| TC-QDS-050001 | ปุ่ม Drop แสดงเมื่อโหลด object และลบได้หลังยืนยัน |
| TC-QDS-050002 | ยกเลิก confirm ของ Drop — object ยังอยู่ |
| TC-QDS-100001 | ผู้ใช้ไม่ login ถูก redirect ไป /login |
| TC-QDS-300001 | Run SELECT แสดงผลใน Result Panel |
| TC-QDS-300002 | Result Panel แสดง row count / duration / column count |
| TC-QDS-300003 | export ผลลัพธ์เป็น CSV ได้ |
| TC-QDS-300004 | pagination ของผลลัพธ์ (rows per page) ใช้งานได้ |
| TC-QDS-300005 | SQL ผิดต้องแสดง error panel พร้อม line hint |
| TC-QDS-300006 | ปุ่ม Format จัดรูปแบบ SQL (keyword uppercase) |
| TC-QDS-200001 | Run คำสั่งที่ไม่ใช่ read (DROP/DELETE) ถูกบล็อกด้วย safety validator |
| TC-QDS-200002 | Save SQL ที่มี DROP/TRUNCATE ถูกปฏิเสธ |
| TC-QDS-200003 | Save โดยไม่ใส่ Object Name สำหรับ View (ที่ไม่ใช่ CREATE) ถูกปฏิเสธ |
