# Purchase Request Template — User Stories

_Generated from `tests/310-pr-template.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Purchase Request Template
**Spec:** `tests/310-pr-template.spec.ts`
**Default role:** Budget
**Total test cases:** 31 (20 High / 8 Medium / 3 Low)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-PRT-010001 | Happy Path - Create Template with Valid Data | High | Happy Path |
| TC-PRT-010002 | Negative - No Permission to Create Template | High | Authorization |
| TC-PRT-010004 | Negative - Empty Fields for Template | High | Negative |
| TC-PRT-010050 | active BU = BLAVG | High | Smoke |
| TC-PRT-020001 | View template with valid permissions | High | Happy Path |
| TC-PRT-020003 | View non-existent template | High | Negative |
| TC-PRT-020004 | View template with no items | Medium | Edge Case |
| TC-PRT-030001 | Edit Template - Happy Path | High | Happy Path |
| TC-PRT-030002 | Edit Template - Invalid Input | High | Negative |
| TC-PRT-030003 | Edit Template - No Permission | High | Authorization |
| TC-PRT-030005 | Edit Template - No Existing Template | Medium | Negative |
| TC-PRT-040001 | Delete valid template - Happy Path | High | Happy Path |
| TC-PRT-040003 | Delete template with no permissions - Negative Case | High | Authorization |
| TC-PRT-040004 | Attempt to delete template that does not exist - Negative Case | Medium | Negative |
| TC-PRT-070001 | Add valid item to template | High | Happy Path |
| TC-PRT-070002 | Add item with missing product | High | Negative |
| TC-PRT-070003 | Add item with no permission | High | Authorization |
| TC-PRT-070004 | Add item with zero quantity | Medium | Edge Case |
| TC-PRT-070005 | Add item with very large quantity | Low | Edge Case |
| TC-PRT-080001 | Edit existing template item successfully | High | Happy Path |
| TC-PRT-080002 | Attempt to edit template without permission | High | Authorization |
| TC-PRT-080003 | Edit template item with invalid quantity | Medium | Negative |
| TC-PRT-080005 | Edit template item with minimal changes | Low | Edge Case |
| TC-PRT-090001 | Delete template item - happy path | High | Happy Path |
| TC-PRT-090002 | Delete template item - no permission | High | Authorization |
| TC-PRT-090003 | Delete template item - cannot save with all items removed | Medium | Negative |
| TC-PRT-100001 | Search for template by name | High | Happy Path |
| TC-PRT-100002 | Filter templates by status | Medium | Happy Path |
| TC-PRT-100003 | Search with invalid input | Medium | Negative |
| TC-PRT-100004 | Filter with no permission | High | Authorization |
| TC-PRT-100005 | Edge case - search with empty input | Low | Edge Case |

---

## TC-PRT-010001 — Happy Path - Create Template with Valid Data

> **As a** Budget user, **I want** this Purchase Request Template behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Happy Path

**Preconditions**

ผู้ใช้มีสิทธิ์ create template (Purchase); TEST BU มี workflow ประเภท PR และ location/product

**Steps**

1. ไปที่ /procurement/purchase-request-template
2. คลิก 'Add Purchase Request Template'
3. เลือก Workflow และกรอก Name
4. คลิก 'Add Item' เลือก Location และ Product แล้วรอให้ช่อง Unit โหลดหน่วยเสร็จ
5. กรอก Qty 3
6. คลิก 'Create'

**Expected**

toast 'created successfully'; URL เปลี่ยนเป็น /procurement/purchase-request-template/<id>; หน้า detail แสดงชื่อ template และ product ที่เลือก; backend มี template นั้นพร้อม 1 รายการ qty 3

---

## TC-PRT-010002 — Negative - No Permission to Create Template

> **As a** low-privilege user, **I should NOT** see Add/edit controls on Purchase Request Template, **so that** role separation is enforced.

**Priority:** High · **Test Type:** Authorization

**Preconditions**

Login เป็น FC — มีเฉพาะ purchase_request_template.view (ไม่มี create)

**Steps**

1. ไปที่ /procurement/purchase-request-template
2. ตรวจปุ่ม 'Add Purchase Request Template'
3. ลอง POST สร้าง template ผ่าน API ด้วย token ของ FC

**Expected**

ปุ่ม Add ถูกปิดใช้งาน (aria-disabled) และ backend ตอบ 403 — ผู้ใช้ไม่มีสิทธิ์สร้างไม่ควรสร้าง template ได้

---

## TC-PRT-010004 — Negative - Empty Fields for Template

> **As a** Budget user, **I want** this Purchase Request Template behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

ผู้ใช้มีสิทธิ์สร้าง template

**Steps**

1. ไปที่ /procurement/purchase-request-template/new
2. ไม่กรอกอะไรเลย
3. คลิก 'Create'

**Expected**

ฟอร์มแสดง 'Workflow is required' และช่อง Name ถูกมาร์ก invalid; ยังอยู่ที่ /new; ไม่มี template ใหม่ถูกสร้างใน backend

---

## TC-PRT-010050 — active BU = BLAVG

> **As a** Budget user, **I want** core Purchase Request Template interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

Login เป็น carmensoftware.dev+purchase@gmail.com ผ่าน auth fixture

**Steps**

1. เรียก ensureActiveBu(BLAVG)
2. อ่าน profile API
3. หา business unit ที่ is_default
4. อ่าน label ของ BU switcher

**Expected**

default business unit มี code === 'BLAVG'; trigger ของ BU switcher แสดง label ของ BU นั้น

---

## TC-PRT-020001 — View template with valid permissions

> **As a** Budget user, **I want** this Purchase Request Template behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Happy Path

**Preconditions**

ผู้ใช้มีสิทธิ์ view; มี template 'STD PR template' ที่ data:reset seed (2 รายการ)

**Steps**

1. ไปที่ /procurement/purchase-request-template
2. คลิกแถว 'STD PR template'

**Expected**

URL เป็น /procurement/purchase-request-template/<id>; หน้าแสดงชื่อ, Workflow 'Purchase Request', Items 2 และชื่อสินค้า/คลังของทุกรายการที่ backend ส่งมา; มีปุ่ม Edit/Delete

---

## TC-PRT-020003 — View non-existent template

> **As a** Budget user, **I want** this Purchase Request Template behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

ผู้ใช้มีสิทธิ์ view

**Steps**

1. ไปที่ /procurement/purchase-request-template/00000000-0000-4000-8000-000000000000

**Expected**

แสดงหน้า error ('Something went wrong' + ปุ่ม Try again) แทนฟอร์ม; ไม่มีปุ่ม Edit/Delete

---

## TC-PRT-020004 — View template with no items

> **As a** Budget user, **I want** this Purchase Request Template behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Edge Case

**Preconditions**

มี template ที่ไม่มีรายการ (seed ผ่าน API)

**Steps**

1. เปิดหน้า detail ของ template ที่ไม่มีรายการ

**Expected**

ส่วน Items แสดงจำนวน 0 และ empty state 'No Items Yet / Add items to this template.' ไม่มีแถวสินค้า

---

## TC-PRT-030001 — Edit Template - Happy Path

> **As a** Budget user, **I want** this Purchase Request Template behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Happy Path

**Preconditions**

มี template ของ test (2 รายการ qty 5)

**Steps**

1. เปิด template → คลิก Edit
2. กรอก Description ใหม่
3. เปลี่ยน Qty ของแถวแรกเป็น 8
4. คลิก Save

**Expected**

toast 'updated successfully'; กลับเป็นโหมดดูและแสดง Description ใหม่; backend เก็บ description ใหม่และ qty 8

---

## TC-PRT-030002 — Edit Template - Invalid Input

> **As a** Budget user, **I want** this Purchase Request Template behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

มี template ของ test (qty 5)

**Steps**

1. เปิด template → คลิก Edit
2. พิมพ์ '-5' ในช่อง Qty ของแถวแรก
3. คลิก Save

**Expected**

ช่อง Qty ไม่รับเครื่องหมายลบ (ค่าที่ค้างอยู่ไม่มี '-'); ค่าที่บันทึกใน backend ไม่ติดลบ

---

## TC-PRT-030003 — Edit Template - No Permission

> **As a** low-privilege user, **I should NOT** see Add/edit controls on Purchase Request Template, **so that** role separation is enforced.

**Priority:** High · **Test Type:** Authorization

**Preconditions**

Login เป็น FC (view อย่างเดียว); มี template 'STD PR template'

**Steps**

1. เปิดหน้า detail ของ template
2. ดูปุ่ม Edit

**Expected**

ปุ่ม Edit ถูกปิดใช้งาน (aria-disabled) ผู้ใช้เข้าโหมดแก้ไขไม่ได้ ไม่มีช่อง Name ให้กรอก

---

## TC-PRT-030005 — Edit Template - No Existing Template

> **As a** Budget user, **I want** this Purchase Request Template behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Negative

**Preconditions**

ผู้ใช้มีสิทธิ์แก้ไข; template ไม่มีอยู่

**Steps**

1. ไปที่ /procurement/purchase-request-template/<id ที่ไม่มีอยู่>
2. มองหาปุ่ม Edit และช่องกรอก

**Expected**

แสดงหน้า error; ไม่มีปุ่ม Edit/Save และไม่มีช่อง Name/Qty ให้กรอก

---

## TC-PRT-040001 — Delete valid template - Happy Path

> **As a** Budget user, **I want** this Purchase Request Template behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Happy Path

**Preconditions**

มี template ของ test

**Steps**

1. ไปที่ list ค้นหาชื่อ template
2. เปิดเมนู Row actions ของแถว → Delete
3. กด Delete ใน dialog ยืนยัน

**Expected**

toast 'deleted successfully'; แถวหายจาก list; backend ตอบ 404 ให้ id นั้น

---

## TC-PRT-040003 — Delete template with no permissions - Negative Case

> **As a** low-privilege user, **I should NOT** see Add/edit controls on Purchase Request Template, **so that** role separation is enforced.

**Priority:** High · **Test Type:** Authorization

**Preconditions**

Login เป็น FC (view อย่างเดียว); มี template ของ test ที่สร้างโดย Purchase

**Steps**

1. เปิดหน้า detail ของ template
2. ดูปุ่ม Delete และคลิกมัน

**Expected**

ปุ่ม Delete ถูกปิดใช้งาน (aria-disabled) และคลิกแล้วไม่มี dialog ยืนยันการลบ; template ยังอยู่ใน backend

---

## TC-PRT-040004 — Attempt to delete template that does not exist - Negative Case

> **As a** Budget user, **I want** this Purchase Request Template behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Negative

**Preconditions**

template ถูกลบโดยคนอื่น (ผ่าน API) หลังที่ list ถูกโหลดแล้ว

**Steps**

1. เปิด list (แถว template ยังแสดงอยู่)
2. ลบ template นั้นผ่าน API
3. ที่ list กด Row actions → Delete → ยืนยัน

**Expected**

ไม่มี toast สำเร็จ แต่มี toast ข้อผิดพลาด; dialog ยังเปิดให้กดยกเลิก; หลัง refresh list ไม่มีแถวนั้น

---

## TC-PRT-070001 — Add valid item to template

> **As a** Budget user, **I want** this Purchase Request Template behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Happy Path

**Preconditions**

มี template ของ test (2 รายการ); มีสินค้าอื่นให้เลือก

**Steps**

1. เปิด template → Edit
2. คลิก 'Add Item'
3. เลือก Location และ Product (ตัวที่ยังไม่อยู่ใน template)
4. รอให้ช่อง Unit โหลดหน่วยของสินค้าเสร็จ
5. กรอก Qty 7
6. Save

**Expected**

toast 'updated successfully'; หน้า detail แสดง Items 3; backend มีรายการที่ qty 7 รวมเป็น 3 บรรทัด

---

## TC-PRT-070002 — Add item with missing product

> **As a** Budget user, **I want** this Purchase Request Template behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

มี template ของ test (2 รายการ)

**Steps**

1. เปิด template → Edit
2. คลิก 'Add Item' แต่ไม่เลือก Location/Product
3. Save

**Expected**

แถวใหม่ยังไม่มี Product (ปุ่ม 'Select Product' ยังอยู่) ไม่บันทึก ยังอยู่ในโหมดแก้ไข ไม่มี toast สำเร็จ; backend ยังมี 2 บรรทัด

---

## TC-PRT-070003 — Add item with no permission

> **As a** low-privilege user, **I should NOT** see Add/edit controls on Purchase Request Template, **so that** role separation is enforced.

**Priority:** High · **Test Type:** Authorization

**Preconditions**

Login เป็น FC (view อย่างเดียว); มี template 'STD PR template'

**Steps**

1. เปิดหน้า detail ของ template
2. มองหาปุ่ม 'Add Item'

**Expected**

ไม่มีปุ่ม Add Item ในโหมดดู และปุ่ม Edit ถูกปิดใช้งาน

---

## TC-PRT-070004 — Add item with zero quantity

> **As a** Budget user, **I want** this Purchase Request Template behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Edge Case

**Preconditions**

มี template ของ test (2 รายการ)

**Steps**

1. เปิด template → Edit → Add Item
2. เลือก Location, Product และคง Qty = 0 (ค่าเริ่มต้น)
3. รอให้ช่อง Unit โหลดหน่วยของสินค้าเสร็จ
4. Save

**Expected**

บันทึกได้ (แม่แบบเก็บ 'ชุดสินค้า' จำนวนจริงกรอกตอนทำ PR — FE 447079d1 ตั้ง qty เริ่มต้น 0 โดยตั้งใจ); backend มีบรรทัด qty 0

---

## TC-PRT-070005 — Add item with very large quantity

> **As a** Budget user, **I want** this Purchase Request Template behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Low · **Test Type:** Edge Case

**Preconditions**

มี template ของ test (2 รายการ)

**Steps**

1. เปิด template → Edit
2. ใส่ Qty = 999999999999999 ที่แถวแรก
3. Save

**Expected**

ระบบแสดงข้อความว่า quantity มากเกินไปและไม่บันทึก (ค่าใน backend ยังเป็น 5)

---

## TC-PRT-080001 — Edit existing template item successfully

> **As a** Budget user, **I want** this Purchase Request Template behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Happy Path

**Preconditions**

มี template ของ test (2 รายการ qty 5)

**Steps**

1. เปิด template → Edit
2. เปลี่ยน Qty แถวที่สองเป็น 12
3. Save

**Expected**

toast 'updated successfully'; โหมดดูแสดง 12.00 ของแถวนั้น; backend เก็บ [5, 12]

---

## TC-PRT-080002 — Attempt to edit template without permission

> **As a** low-privilege user, **I should NOT** see Add/edit controls on Purchase Request Template, **so that** role separation is enforced.

**Priority:** High · **Test Type:** Authorization

**Preconditions**

Login เป็น FC (view อย่างเดียว); template มี 2 รายการ

**Steps**

1. เปิดหน้า detail ของ template
2. มองหาช่อง Qty ของรายการ

**Expected**

รายการแสดงเป็นข้อความอ่านอย่างเดียว ไม่มีช่อง Qty (input) ให้แก้

---

## TC-PRT-080003 — Edit template item with invalid quantity

> **As a** Budget user, **I want** this Purchase Request Template behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Negative

**Preconditions**

มี template ของ test (qty 5)

**Steps**

1. เปิด template → Edit
2. พิมพ์ 'abc' ในช่อง Qty แถวแรก
3. Save

**Expected**

ช่อง Qty ไม่รับตัวอักษร (ค่าในช่องไม่มีตัวอักษร); ค่าที่บันทึกยังเป็นตัวเลข ไม่เป็น NaN

---

## TC-PRT-080005 — Edit template item with minimal changes

> **As a** Budget user, **I want** this Purchase Request Template behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Low · **Test Type:** Edge Case

**Preconditions**

มี template ของ test (2 รายการ qty 5)

**Steps**

1. เปิด template → Edit
2. เปลี่ยน Qty แถวแรกจาก 5 เป็น 6 (เปลี่ยนน้อยที่สุด)
3. Save

**Expected**

บันทึกสำเร็จ; backend เก็บ [5, 6] — แถวที่ไม่ได้แก้ยังเป็น 5

---

## TC-PRT-090001 — Delete template item - happy path

> **As a** Budget user, **I want** this Purchase Request Template behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Happy Path

**Preconditions**

มี template ของ test (2 รายการ)

**Steps**

1. เปิด template → Edit
2. คลิก Remove ที่แถวแรก
3. ยืนยันใน dialog 'Remove Item'
4. Save

**Expected**

แถวหายจากตาราง; หลัง Save backend เหลือ 1 บรรทัด

---

## TC-PRT-090002 — Delete template item - no permission

> **As a** low-privilege user, **I should NOT** see Add/edit controls on Purchase Request Template, **so that** role separation is enforced.

**Priority:** High · **Test Type:** Authorization

**Preconditions**

Login เป็น FC (view อย่างเดียว); template มี 2 รายการ

**Steps**

1. เปิดหน้า detail ของ template
2. มองหาปุ่ม Remove ของรายการ

**Expected**

ไม่มีปุ่ม Remove; ไม่สามารถเข้าโหมดแก้ไขได้ (Edit ปิดใช้งาน)

---

## TC-PRT-090003 — Delete template item - cannot save with all items removed

> **As a** Budget user, **I want** this Purchase Request Template behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Negative

**Preconditions**

มี template ของ test (2 รายการ)

**Steps**

1. เปิด template → Edit
2. ลบทั้งสองแถว (Remove + ยืนยัน)
3. Save

**Expected**

ตารางแสดง 'No Items Yet'; Save ไม่ผ่าน (ไม่มี toast สำเร็จ ยังอยู่ในโหมดแก้ไข); backend ยังมี 2 บรรทัด

---

## TC-PRT-100001 — Search for template by name

> **As a** Budget user, **I want** this Purchase Request Template behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Happy Path

**Preconditions**

มี template ของ test 1 รายการ และ 'STD PR template'

**Steps**

1. ไปที่ /procurement/purchase-request-template
2. พิมพ์ชื่อ template ของ test ในช่อง Search แล้วกด Enter

**Expected**

list แสดงเฉพาะ template ที่ชื่อตรง; 'STD PR template' ไม่แสดง

---

## TC-PRT-100002 — Filter templates by status

> **As a** Budget user, **I want** this Purchase Request Template behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Happy Path

**Preconditions**

มี template สถานะ Active อย่างน้อยหนึ่งรายการ

**Steps**

1. ไปที่ list
2. คลิก Filter → Status → เลือก Active
3. ดู list

**Expected**

มีตัวกรอง Status แสดงบนแถบ; ทุกแถวที่เหลือมีสถานะ Active และมีอย่างน้อย 1 แถว

---

## TC-PRT-100003 — Search with invalid input

> **As a** Budget user, **I want** this Purchase Request Template behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Negative

**Preconditions**

มี template อย่างน้อยหนึ่งรายการ

**Steps**

1. ไปที่ list
2. พิมพ์ข้อความที่ไม่ตรงกับ template ใดแล้วกด Enter

**Expected**

ตารางแสดง empty state 'No data found' ไม่มีแถวข้อมูล

---

## TC-PRT-100004 — Filter with no permission

> **As a** low-privilege user, **I should NOT** see Add/edit controls on Purchase Request Template, **so that** role separation is enforced.

**Priority:** High · **Test Type:** Authorization

**Preconditions**

Login เป็น Budget — ไม่มี permission ของ PR template เลย (แม้แต่ view)

**Steps**

1. ไปที่ /procurement/purchase-request-template

**Expected**

แสดงหน้า 'Permission Denied' แทน list; ไม่มีช่อง Search/Filter หรือปุ่ม Add

---

## TC-PRT-100005 — Edge case - search with empty input

> **As a** Budget user, **I want** this Purchase Request Template behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Low · **Test Type:** Edge Case

**Preconditions**

มี template อย่างน้อยหนึ่งรายการ; ผู้ใช้เพิ่งค้นหาจน list ว่าง

**Steps**

1. ค้นหาข้อความที่ไม่มีผลลัพธ์
2. ล้างช่อง Search แล้วกด Enter

**Expected**

list กลับมาแสดง template ทั้งหมด (มี 'STD PR template')

---


<sub>Last regenerated: 2026-11-22 · git ce2b00b</sub>
