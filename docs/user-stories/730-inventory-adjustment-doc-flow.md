# Inventory Adjustment — Doc Flow (movement suite) — User Stories

_Generated from `tests/730-inventory-adjustment-doc-flow.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Inventory Adjustment — Doc Flow (movement suite)
**Spec:** `tests/730-inventory-adjustment-doc-flow.spec.ts`
**Default role:** any authenticated
**Total test cases:** 12 (8 High / 4 Medium / 0 Low)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-IADJ-700001 | FC เปิดหน้าสร้าง Stock In ได้โดยไม่ขึ้น Permission Denied | High | Authorization |
| TC-IADJ-700002 | FC สร้าง Stock In draft 2 รายการแล้วหลังบ้านเก็บจำนวนและต้นทุนครบ | High | CRUD |
| TC-IADJ-700003 | FC เปิด Stock In draft แล้วเห็นจำนวนและต้นทุนตามที่บันทึก | Medium | CRUD |
| TC-IADJ-700004 | FC แก้ Stock In draft (คำอธิบาย + จำนวน/ต้นทุน + ลบรายการ + เพิ่มรายการ) | High | CRUD |
| TC-IADJ-700005 | FC ลบ Stock In draft จากโหมดดูแล้วใบหายจากหลังบ้าน | Medium | CRUD |
| TC-IADJ-700006 | FC สร้าง Stock In แล้ว Commit ได้ completed และลงสต๊อก | High | Functional |
| TC-IADJ-710001 | FC เปิดหน้าสร้าง Stock Out ได้โดยไม่ขึ้น Permission Denied | High | Authorization |
| TC-IADJ-710002 | FC สร้าง Stock Out draft 2 รายการแล้วหลังบ้านเก็บจำนวนครบ | High | CRUD |
| TC-IADJ-710003 | FC เปิด Stock Out draft แล้วเห็นจำนวนและต้นทุนประเมินที่ไม่ใช่ 0 | Medium | Functional |
| TC-IADJ-710004 | FC แก้ Stock Out draft (คำอธิบาย + จำนวน + ลบรายการ + เพิ่มรายการ) | High | CRUD |
| TC-IADJ-710005 | FC ลบ Stock Out draft จากโหมดดูแล้วใบหายจากหลังบ้าน | Medium | CRUD |
| TC-IADJ-710006 | FC สร้าง Stock Out แล้ว Commit ได้ completed และตัดสต๊อก | High | Functional |

---

## TC-IADJ-700001 — FC เปิดหน้าสร้าง Stock In ได้โดยไม่ขึ้น Permission Denied

> **As a** low-privilege user, **I should NOT** see Add/edit controls on Inventory Adjustment — Doc Flow (movement suite), **so that** role separation is enforced.

**Priority:** High · **Test Type:** Authorization

**Preconditions**

Login เป็น fc@carmen.com (movement-setup); BU CARMEN-AVG; role ของ fc มี inventory_management.stock_in.create และ inventory_adjustment.create (คีย์ย่อย) แต่ไม่ได้ให้ inventory_management.view

**Steps**

1. เปิด /inventory-management/inventory-adjustment/new?type=stock-in
2. รอหน้าโหลด

**Expected**

ไม่มีกล่อง alert "Permission Denied" และช่อง #inv-adj-description แสดง

> _Note: เดิม SI.0 · regression ของ FE-6 (route guard เช็คคีย์ระดับโมดูล) · gap TC-IADJ-100001 ถือว่า "ไม่มี inventory_management.view → AccessDenied" เป็นพฤติกรรมที่ตั้งใจ — ต้องทบทวนว่ายังจริงอยู่ไหม_

---

## TC-IADJ-700002 — FC สร้าง Stock In draft 2 รายการแล้วหลังบ้านเก็บจำนวนและต้นทุนครบ

> **As a** FC user, **I want** to create a new Inventory Adjustment — Doc Flow (movement suite) record, **so that** it becomes available for downstream operations.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

Login เป็น fc@carmen.com; BU CARMEN-AVG; คลัง 1FO02 (สินค้า A = 11020001, B = 55000001); เหตุผล "Test stock_in" มีอยู่

**Steps**

1. เปิดหน้าสร้าง Stock In
2. Date = วันในงวด active, Reason "Test stock_in", Location 1FO02
3. Add Item: A × 3 ต้นทุน 100, B × 5 ต้นทุน 200
4. ใส่คำอธิบาย FE-CRUD SI <stamp> (หลังเพิ่มรายการ)
5. กด Save

**Expected**

POST ตอบ < 300; หลังบ้าน doc_status = draft, description ตรง และรายการ 11020001×3@100, 55000001×5@200

> _Note: เดิม SI.1 · ใกล้ TC-IADJ-030002/030004 ใน gap report (เคสนี้ตรวจค่าที่หลังบ้านเก็บด้วย)_

---

## TC-IADJ-700003 — FC เปิด Stock In draft แล้วเห็นจำนวนและต้นทุนตามที่บันทึก

> **As a** FC user, **I want** to manage Inventory Adjustment — Doc Flow (movement suite) records via CRUD, **so that** the data stays correct over time.

**Priority:** Medium · **Test Type:** CRUD

**Preconditions**

TC-IADJ-700002 ผ่านแล้วในรอบเดียวกัน (serial) — มี Stock In draft

**Steps**

1. เปิด /inventory-management/inventory-adjustment/<id>?type=stock-in
2. อ่านคำอธิบายและแถวรายการ

**Expected**

หน้าแสดงคำอธิบาย FE-CRUD SI <stamp>; แถว A มีจำนวน 3 ต้นทุน 100; แถว B มีจำนวน 5 ต้นทุน 200

> _Note: เดิม SI.2 · ใกล้ TC-IADJ-020001/020009 ใน gap report_

---

## TC-IADJ-700004 — FC แก้ Stock In draft (คำอธิบาย + จำนวน/ต้นทุน + ลบรายการ + เพิ่มรายการ)

> **As a** FC user, **I want** to delete a Inventory Adjustment — Doc Flow (movement suite) record, **so that** the list reflects only valid entries.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

TC-IADJ-700002 ผ่านแล้วในรอบเดียวกัน (serial) — Stock In draft มี A×3@100, B×5@200

**Steps**

1. เปิดใบ แล้วกด Edit
2. แก้คำอธิบายเป็น "... (แก้)"
3. A → จำนวน 7 ต้นทุน 120
4. ลบแถว B
5. Add Item: B กลับมาเป็นบรรทัดใหม่ จำนวน 2 ต้นทุน 300
6. กด Save

**Expected**

Save ส่งคำขอและตอบ < 300; ใบยังเป็น draft; หลังบ้านเก็บคำอธิบายใหม่ และรายการ 11020001×7@120, 55000001×2@300

> _Note: เดิม SI.3 · gap TC-IADJ-040001 แก้แค่คำอธิบาย — เคสนี้แก้บรรทัดและลบบรรทัดด้วย_

---

## TC-IADJ-700005 — FC ลบ Stock In draft จากโหมดดูแล้วใบหายจากหลังบ้าน

> **As a** FC user, **I want** to delete a Inventory Adjustment — Doc Flow (movement suite) record, **so that** the list reflects only valid entries.

**Priority:** Medium · **Test Type:** CRUD

**Preconditions**

TC-IADJ-700002 ผ่านแล้วในรอบเดียวกัน (serial) — Stock In draft ยังอยู่

**Steps**

1. เปิดใบ (โหมดดู)
2. กด Delete
3. ยืนยัน Delete ใน dialog

**Expected**

GET ใบนั้นไม่พบแล้ว และหน้าจอออกจาก URL ของใบกลับไปหน้ารายการ

> _Note: เดิม SI.4 · ตรงกับ TC-IADJ-050001 ใน gap report (ลบได้โดยไม่ต้องกด Edit)_

---

## TC-IADJ-700006 — FC สร้าง Stock In แล้ว Commit ได้ completed และลงสต๊อก

> **As a** FC user, **I want** this Inventory Adjustment — Doc Flow (movement suite) interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

Login เป็น fc@carmen.com; BU CARMEN-AVG; ตรวจ inventory transaction จาก API

**Steps**

1. สร้าง Stock In ใหม่: A × 2 ต้นทุน 50, B × 2 ต้นทุน 40 ที่ 1FO02
2. กด Commit
3. ยืนยัน

**Expected**

หลังบ้าน doc_status = completed, รายการ 11020001×2@50, 55000001×2@40; inventory-transactions ของใบนี้รับเข้ารวม 4 หน่วย (ให้ Stock Out มีของจ่าย)

> _Note: เดิม SI.5 · ใกล้ TC-IADJ-060002 ใน gap report (เคสนี้ commit จากหน้า new โดยตรง)_

---

## TC-IADJ-710001 — FC เปิดหน้าสร้าง Stock Out ได้โดยไม่ขึ้น Permission Denied

> **As a** low-privilege user, **I should NOT** see Add/edit controls on Inventory Adjustment — Doc Flow (movement suite), **so that** role separation is enforced.

**Priority:** High · **Test Type:** Authorization

**Preconditions**

Login เป็น fc@carmen.com (movement-setup); BU CARMEN-AVG; role ของ fc มี inventory_management.stock_out.create และ inventory_adjustment.create (คีย์ย่อย)

**Steps**

1. เปิด /inventory-management/inventory-adjustment/new?type=stock-out
2. รอหน้าโหลด

**Expected**

ไม่มีกล่อง alert "Permission Denied" และช่อง #inv-adj-description แสดง

> _Note: เดิม SO.0 · regression ของ FE-6_

---

## TC-IADJ-710002 — FC สร้าง Stock Out draft 2 รายการแล้วหลังบ้านเก็บจำนวนครบ

> **As a** FC user, **I want** to create a new Inventory Adjustment — Doc Flow (movement suite) record, **so that** it becomes available for downstream operations.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

Login เป็น fc@carmen.com; BU CARMEN-AVG; คลัง 1FO02; เหตุผล "Test stock_out" มีอยู่

**Steps**

1. เปิดหน้าสร้าง Stock Out
2. Date = วันในงวด active, Reason "Test stock_out", Location 1FO02
3. Add Item: A × 1, B × 1
4. ใส่คำอธิบาย FE-CRUD SO <stamp>
5. กด Save

**Expected**

POST ตอบ < 300; หลังบ้าน doc_status = draft, description ตรง และรายการ 11020001×1, 55000001×1

> _Note: เดิม SO.1 · ใกล้ TC-IADJ-030003 ใน gap report (ยังไม่ได้ตรวจว่าตารางไม่มีคอลัมน์ Cost/Unit)_

---

## TC-IADJ-710003 — FC เปิด Stock Out draft แล้วเห็นจำนวนและต้นทุนประเมินที่ไม่ใช่ 0

> **As a** FC user, **I want** this Inventory Adjustment — Doc Flow (movement suite) interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

TC-IADJ-710002 ผ่านแล้วในรอบเดียวกัน (serial) — มี Stock Out draft

**Steps**

1. เปิด /inventory-management/inventory-adjustment/<id>?type=stock-out
2. รอต้นทุนประเมินโหลด แล้วอ่านแถวรายการ

**Expected**

หน้าแสดงคำอธิบาย FE-CRUD SO <stamp>; แถว A และ B มีจำนวน 1 และต้นทุนประเมินไม่เป็น 0.00

> _Note: บั๊กที่รู้อยู่ FE-5 (test.fail): ใบ SO draft ไม่เก็บต้นทุน (คิดตอน commit) — ตอนสร้างฟอร์มประเมินให้ แต่เปิดใบกลับมาขึ้น 0.00 ทุกแถว · เดิม SO.2_

---

## TC-IADJ-710004 — FC แก้ Stock Out draft (คำอธิบาย + จำนวน + ลบรายการ + เพิ่มรายการ)

> **As a** FC user, **I want** to delete a Inventory Adjustment — Doc Flow (movement suite) record, **so that** the list reflects only valid entries.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

TC-IADJ-710002 ผ่านแล้วในรอบเดียวกัน (serial) — Stock Out draft มี A×1, B×1

**Steps**

1. เปิดใบ แล้วกด Edit
2. แก้คำอธิบายเป็น "... (แก้)"
3. A → จำนวน 2
4. ลบแถว B
5. Add Item: B กลับมาเป็นบรรทัดใหม่ จำนวน 1
6. กด Save

**Expected**

Save ส่งคำขอและตอบ < 300; ใบยังเป็น draft; หลังบ้านเก็บคำอธิบายใหม่ และรายการ 11020001×2, 55000001×1

> _Note: บั๊กที่รู้อยู่ FE-4 (test.fail): แก้จำนวนแถวเดิมของ SO → Total เป็น NaN แล้ว Save ไม่ยิงคำขอเลย (zod ตีกลับเงียบ ๆ ไม่มี toast) · เดิม SO.3_

---

## TC-IADJ-710005 — FC ลบ Stock Out draft จากโหมดดูแล้วใบหายจากหลังบ้าน

> **As a** FC user, **I want** to delete a Inventory Adjustment — Doc Flow (movement suite) record, **so that** the list reflects only valid entries.

**Priority:** Medium · **Test Type:** CRUD

**Preconditions**

TC-IADJ-710002 ผ่านแล้วในรอบเดียวกัน (serial) — Stock Out draft ยังอยู่

**Steps**

1. เปิดใบ (โหมดดู)
2. กด Delete
3. ยืนยัน Delete ใน dialog

**Expected**

GET ใบนั้นไม่พบแล้ว และหน้าจอออกจาก URL ของใบกลับไปหน้ารายการ

> _Note: เดิม SO.4_

---

## TC-IADJ-710006 — FC สร้าง Stock Out แล้ว Commit ได้ completed และตัดสต๊อก

> **As a** FC user, **I want** this Inventory Adjustment — Doc Flow (movement suite) interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

TC-IADJ-700006 commit Stock In ไปแล้ว (1FO02 มี A อย่างน้อย 1); ตรวจ inventory transaction จาก API

**Steps**

1. สร้าง Stock Out ใหม่: A × 1 ที่ 1FO02
2. กด Commit
3. ยืนยัน

**Expected**

หลังบ้าน doc_status = completed, รายการ 11020001×1; inventory-transactions ของใบนี้จ่ายออกรวม 1 หน่วย

> _Note: เดิม SO.5_

---


<sub>Last regenerated: 2026-11-21 · git 4a3cb23</sub>
