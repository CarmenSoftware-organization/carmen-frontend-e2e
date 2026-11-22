# GRN — Doc Flow (movement suite) — User Stories

_Generated from `tests/502-grn-doc-flow.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** GRN — Doc Flow (movement suite)
**Spec:** `tests/502-grn-doc-flow.spec.ts`
**Default role:** any authenticated
**Total test cases:** 5 (3 High / 2 Medium / 0 Low)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-GRN-700001 | Requestor สร้าง GRN manual แบบ draft แล้วหลังบ้านเก็บใบกำกับ จำนวน และราคาครบ | High | CRUD |
| TC-GRN-700002 | Requestor เปิด GRN draft แล้วเห็นใบกำกับ จำนวน และราคาตามที่บันทึก | Medium | CRUD |
| TC-GRN-700003 | Requestor แก้ GRN draft (ใบกำกับ + จำนวน/ราคา + ลบรายการ + เพิ่มรายการ) | High | CRUD |
| TC-GRN-700004 | Requestor ลบ GRN draft (Edit → Delete) แล้วใบหายจากหลังบ้าน | Medium | CRUD |
| TC-GRN-700005 | Requestor สร้าง GRN แล้วกด Create ได้สถานะ saved และ AVG ลงสต๊อกทันที | High | Functional |

---

## TC-GRN-700001 — Requestor สร้าง GRN manual แบบ draft แล้วหลังบ้านเก็บใบกำกับ จำนวน และราคาครบ

> **As a** Requestor user, **I want** to create a new GRN — Doc Flow (movement suite) record, **so that** it becomes available for downstream operations.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

Login เป็น requestor@carmen.com (movement-setup); BU CARMEN-AVG; requestor มีคลัง LCX013 และสิทธิ์ GRN; ผู้ขาย C010 มีอยู่

**Steps**

1. เปิด /procurement/goods-receive-note/new?doc_type=manual
2. ผู้ขาย C010, GRN Date = วันในงวด active, Currency THB, เลขใบกำกับ FE-GRN-<stamp>, Invoice Date เดียวกัน
3. Add Item 2 รายการที่ LCX013: 11110001 × 3 @100, 11110003 × 5 @200
4. กด Save Draft

**Expected**

POST ตอบ ok; หลังบ้าน doc_status = draft, invoice_no = FE-GRN-<stamp> และรายการ 11110001×3@100, 11110003×5@200

> _Note: เดิม GRN.1 (_movement_play fe/04-grn) · TC-GRN-050001 ไม่มี assertion และคาดสถานะ RECEIVED ซึ่งไม่มีแล้ว (draft / saved / committed)_

---

## TC-GRN-700002 — Requestor เปิด GRN draft แล้วเห็นใบกำกับ จำนวน และราคาตามที่บันทึก

> **As a** Requestor user, **I want** to manage GRN — Doc Flow (movement suite) records via CRUD, **so that** the data stays correct over time.

**Priority:** Medium · **Test Type:** CRUD

**Preconditions**

TC-GRN-700001 ผ่านแล้วในรอบเดียวกัน (serial) — มี GRN draft บน CARMEN-AVG

**Steps**

1. เปิด /procurement/goods-receive-note/<id> จากลิงก์ตรง
2. อ่านเลขใบกำกับ และข้อความ/ค่าในแถวของแต่ละสินค้า

**Expected**

หน้าแสดงเลขใบกำกับ FE-GRN-<stamp>; แถว 11110001 มีจำนวน 3 ราคา 100; แถว 11110003 มีจำนวน 5 ราคา 200

> _Note: เดิม GRN.2 · main ไม่มีเคสเปิดดู GRN · ครอบบางส่วนของ gap TC-GRN-020101/020103_

---

## TC-GRN-700003 — Requestor แก้ GRN draft (ใบกำกับ + จำนวน/ราคา + ลบรายการ + เพิ่มรายการ)

> **As a** Requestor user, **I want** to delete a GRN — Doc Flow (movement suite) record, **so that** the list reflects only valid entries.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

TC-GRN-700001 ผ่านแล้วในรอบเดียวกัน (serial) — GRN draft มี 11110001×3@100, 11110003×5@200

**Steps**

1. เปิดใบ แล้วกด Edit
2. เลขใบกำกับ → FE-GRN-<stamp>-E
3. Ground Beef 3@100 → 7@120
4. ลบ Australian Sirloin ด้วย "Remove this line"
5. Add Item: Pork neck tenderloin (11110009) 2@300
6. รอหน่วยโหลดเสร็จ แล้วกด Save Draft

**Expected**

Save ตอบ < 300; ใบยังเป็น draft; หลังบ้านเก็บเลขใบกำกับใหม่ และรายการเหลือ 11110001×7@120, 11110009×2@300

> _Note: เดิม GRN.3 · TC-GRN-060001/070001/080001/090001 เป็นเปลือกที่ไม่ได้ตรวจผล · ครอบ gap TC-GRN-040108 และบางส่วนของ 070103_

---

## TC-GRN-700004 — Requestor ลบ GRN draft (Edit → Delete) แล้วใบหายจากหลังบ้าน

> **As a** Requestor user, **I want** to edit an existing GRN — Doc Flow (movement suite) record, **so that** its data stays accurate.

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

## TC-GRN-700005 — Requestor สร้าง GRN แล้วกด Create ได้สถานะ saved และ AVG ลงสต๊อกทันที

> **As a** Requestor user, **I want** this GRN — Doc Flow (movement suite) interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

Login เป็น requestor@carmen.com; BU CARMEN-AVG (costing แบบ average — ลงสต๊อกตอน saved); ตรวจ inventory transaction จาก API

**Steps**

1. สร้าง GRN manual 1 รายการ 11110012 × 1 @50 วันที่ในงวด active
2. กด Create
3. รอให้ใบพ้นสถานะ draft

**Expected**

หลังบ้าน doc_status = saved, grn_no ไม่ขึ้นต้นด้วย draft, รายการ 11110012×1@50; inventory-transactions ของใบนี้รับเข้า 11110012 จำนวน 1

> _Note: เดิม GRN.5 · ขัดกับ TC-GRN-140003 (501-grn: ยังไม่ commit ต้องไม่มี stock movement) — ต้องให้ทีมหลังบ้านยืนยันว่าพฤติกรรมของ AVG แบบไหนถูก_

---


<sub>Last regenerated: 2026-11-21 · git 4a3cb23</sub>
