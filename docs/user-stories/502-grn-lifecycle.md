# Grn Lifecycle — User Stories

_Generated from `tests/502-grn-lifecycle.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Grn Lifecycle
**Spec:** `tests/502-grn-lifecycle.spec.ts`
**Default role:** any authenticated
**Total test cases:** 4 (2 High / 2 Medium / 0 Low)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-GRN-700001 | Purchase สร้าง GRN manual แบบ draft แล้วหลังบ้านเก็บใบกำกับ จำนวน และราคาครบ | High | CRUD |
| TC-GRN-700002 | Purchase เปิด GRN draft แล้วเห็นใบกำกับ จำนวน และราคาตามที่บันทึก | Medium | CRUD |
| TC-GRN-700003 | Purchase แก้ GRN draft (ใบกำกับ + จำนวน/ราคา + ลบรายการ + เพิ่มรายการ) | High | CRUD |
| TC-GRN-700004 | Purchase ลบ GRN draft (Edit → Delete) แล้วใบหายจากหลังบ้าน | Medium | CRUD |

---

## TC-GRN-700001 — Purchase สร้าง GRN manual แบบ draft แล้วหลังบ้านเก็บใบกำกับ จำนวน และราคาครบ

> **As a** Purchase user, **I want** to create a new Grn Lifecycle record, **so that** it becomes available for downstream operations.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

Login เป็นบัญชี Purchase (gmail); BU TEST (AVG); Purchase มีสิทธิ์สร้าง/commit GRN (data:reset); มีผู้ขายและสินค้า E2E-DF-1..4 ที่คลังคู่ doc-flow

**Steps**

1. เปิด /procurement/goods-receive-note/new?doc_type=manual
2. ผู้ขายแรกที่ active, GRN Date = วันในงวด active, Currency THB, เลขใบกำกับ FE-GRN-<stamp>, Invoice Date เดียวกัน
3. Add Item 2 รายการที่คลังแรก: E2E-DF-1 × 3 @100, E2E-DF-2 × 5 @200
4. กด Save Draft

**Expected**

POST ตอบ ok; หลังบ้าน doc_status = draft, invoice_no = FE-GRN-<stamp> และรายการ E2E-DF-1×3@100, E2E-DF-2×5@200

> _Note: เดิม GRN.1 (_movement_play fe/04-grn) · TC-GRN-050001 ไม่มี assertion และคาดสถานะ RECEIVED ซึ่งไม่มีแล้ว (draft / saved / committed)_

---

## TC-GRN-700002 — Purchase เปิด GRN draft แล้วเห็นใบกำกับ จำนวน และราคาตามที่บันทึก

> **As a** Purchase user, **I want** to manage Grn Lifecycle records via CRUD, **so that** the data stays correct over time.

**Priority:** Medium · **Test Type:** CRUD

**Preconditions**

TC-GRN-700001 ผ่านแล้วในรอบเดียวกัน (serial) — มี GRN draft บน TEST BU (AVG)

**Steps**

1. เปิด /procurement/goods-receive-note/<id> จากลิงก์ตรง
2. อ่านเลขใบกำกับ และข้อความ/ค่าในแถวของแต่ละสินค้า

**Expected**

หน้าแสดงเลขใบกำกับ FE-GRN-<stamp>; แถว E2E-DF-1 มีจำนวน 3 ราคา 100; แถว E2E-DF-2 มีจำนวน 5 ราคา 200

> _Note: เดิม GRN.2 · main ไม่มีเคสเปิดดู GRN · ครอบบางส่วนของ gap TC-GRN-020101/020103_

---

## TC-GRN-700003 — Purchase แก้ GRN draft (ใบกำกับ + จำนวน/ราคา + ลบรายการ + เพิ่มรายการ)

> **As a** Purchase user, **I want** to delete a Grn Lifecycle record, **so that** the list reflects only valid entries.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

TC-GRN-700001 ผ่านแล้วในรอบเดียวกัน (serial) — GRN draft มี E2E-DF-1×3@100, E2E-DF-2×5@200

**Steps**

1. เปิดใบ แล้วกด Edit
2. เลขใบกำกับ → FE-GRN-<stamp>-E
3. E2E-DF-1 3@100 → 7@120
4. ลบ E2E-DF-2 ด้วย "Remove this line"
5. Add Item: E2E-DF-3 2@300
6. รอหน่วยโหลดเสร็จ แล้วกด Save Draft

**Expected**

Save ตอบ < 300; ใบยังเป็น draft; หลังบ้านเก็บเลขใบกำกับใหม่ และรายการเหลือ E2E-DF-1×7@120, E2E-DF-3×2@300

> _Note: เดิม GRN.3 · TC-GRN-060001/070001/080001/090001 เป็นเปลือกที่ไม่ได้ตรวจผล · ครอบ gap TC-GRN-040108 และบางส่วนของ 070103_

---

## TC-GRN-700004 — Purchase ลบ GRN draft (Edit → Delete) แล้วใบหายจากหลังบ้าน

> **As a** Purchase user, **I want** to edit an existing Grn Lifecycle record, **so that** its data stays accurate.

**Priority:** Medium · **Test Type:** CRUD

**Preconditions**

TC-GRN-700001 ผ่านแล้วในรอบเดียวกัน (serial) — GRN draft ยังอยู่

**Steps**

1. เปิดใบ แล้วกด Edit
2. กด Delete
3. ยืนยัน Delete ใน dialog

**Expected**

GET ใบนั้นไม่พบแล้ว และหน้าจอออกจาก URL ของใบกลับไปหน้ารายการ

> _Note: เดิม GRN.4 · main มีแต่เคสลบบรรทัด · ครอบ gap TC-GRN-050102 และบางส่วนของ 050101_

---


<sub>Last regenerated: 2026-11-24 · git f462816</sub>
