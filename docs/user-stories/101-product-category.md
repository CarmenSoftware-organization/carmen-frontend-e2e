# Product Category — User Stories

_Generated from `tests/101-product-category.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Product Category
**Spec:** `tests/101-product-category.spec.ts`
**Default role:** Admin
**Total test cases:** 23 (22 High / 1 Medium / 0 Low)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-CAT-010001 | View all categories | High | Happy Path |
| TC-CAT-010002 | No permission to view categories | High | Negative |
| TC-CAT-010003 | Expand and collapse category levels | High | Happy Path |
| TC-CAT-010004 | Category hierarchy with very long names | Medium | Edge Case |
| TC-CAT-010005 | Multiple levels of categories | High | Happy Path |
| TC-CAT-010050 | active BU = BLAVG | High | Smoke |
| TC-CAT-020002 | Negative - No Permission to Create Category | High | Negative |
| TC-CAT-030003 | Negative Case - No Permission | High | Negative |
| TC-CAT-030050 | สร้าง root category สำเร็จ | High | CRUD |
| TC-CAT-030051 | สร้าง root category (parent ของ subtree) | High | CRUD |
| TC-CAT-030052 | สร้าง subcategory ใต้ root ผ่านปุ่ม Add child | High | CRUD |
| TC-CAT-040002 | Create Item Group with Missing Permission | High | Negative |
| TC-CAT-040050 | แก้ไขชื่อ category แล้วค่าคงอยู่ | High | CRUD |
| TC-CAT-040051 | สร้าง item group ใต้ subcategory ผ่านปุ่ม Add child | High | CRUD |
| TC-CAT-050003 | Edit Category with No Permission | High | Negative |
| TC-CAT-050050 | ลบ category สำเร็จ (cleanup) | High | CRUD |
| TC-CAT-050051 | ลบ item group สำเร็จ | High | CRUD |
| TC-CAT-050052 | ลบ subcategory สำเร็จ | High | CRUD |
| TC-CAT-050053 | ลบ root category สำเร็จ (cleanup) | High | CRUD |
| TC-CAT-090001 | Happy Path - Search for Existing Category | High | Happy Path |
| TC-CAT-090002 | Negative Case - Search with Invalid Input | High | Negative |
| TC-CAT-090003 | Edge Case - Search with Empty Input | High | Edge Case |
| TC-CAT-090004 | Negative Case - User without Permission | High | Negative |

---

## TC-CAT-010001 — View all categories

> **As a** Admin user, **I want** this Product Category behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Happy Path

**Preconditions**

ผู้ใช้ login แล้วและมีสิทธิ์ดู category

**Steps**

1. ไปที่ /product-management/category
2. ตรวจสอบว่า category ระดับบนสุดทั้งหมดแสดงอยู่
3. คลิก category
4. ตรวจสอบว่า subcategory แสดงในโครงสร้าง tree ที่ขยายได้

**Expected**

category ทั้งหมดแสดงถูกต้องและสามารถขยายได้ในโครงสร้าง tree

---

## TC-CAT-010002 — No permission to view categories

> **As a** Admin user, **I want** this Product Category behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

ผู้ใช้ login แล้วแต่ไม่มีสิทธิ์ดู category

**Steps**

1. ไปที่ /product-management/category
2. ตรวจสอบว่าไม่มี category แสดง

**Expected**

ผู้ใช้เห็นข้อความ error หรือข้อความแจ้งการจำกัดสิทธิ์

---

## TC-CAT-010003 — Expand and collapse category levels

> **As a** Admin user, **I want** this Product Category behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Happy Path

**Preconditions**

ผู้ใช้มีสิทธิ์ดู category

**Steps**

1. ไปที่ /product-management/category
2. คลิกปุ่ม 'Expand' เพื่อขยายทุกระดับ
3. ตรวจสอบว่า tree แสดง node (หรือ empty state)
4. คลิกปุ่ม 'Collapse' เพื่อยุบทุกระดับ
5. ตรวจสอบว่า root node ยังคงแสดงอยู่

**Expected**

ผู้ใช้สามารถขยายและยุบระดับ category ได้โดยไม่เกิด error และ tree ยังคงแสดงผล

---

## TC-CAT-010004 — Category hierarchy with very long names

> **As a** Admin user, **I want** this Product Category behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Edge Case

**Preconditions**

ผู้ใช้มีสิทธิ์ดู category

**Steps**

1. ไปที่ /product-management/category
2. คลิกปุ่ม 'Expand' เพื่อขยายทุกระดับ
3. ตรวจสอบว่า node ทุกตัว (รวมที่ชื่อยาว) ยังแสดงผลในโครงสร้าง tree โดยไม่ทำให้ layout พัง

**Expected**

โครงสร้าง category hierarchy แสดงถูกต้อง (node ใช้ class truncate) แม้ชื่อ category จะยาวมาก

---

## TC-CAT-010005 — Multiple levels of categories

> **As a** Admin user, **I want** this Product Category behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Happy Path

**Preconditions**

ผู้ใช้มีสิทธิ์ดู category

**Steps**

1. ไปที่ /product-management/category
2. คลิกปุ่ม 'Expand' เพื่อขยายทุกระดับ (category → subcategory → item group)
3. ตรวจสอบว่าทุกระดับของ tree แสดงผลถูกต้อง

**Expected**

ทุกระดับของ category hierarchy แสดงถูกต้องหลังคลิก Expand All

---

## TC-CAT-010050 — active BU = BLAVG

> **As a** Admin user, **I want** core Product Category interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com ผ่าน auth fixture; beforeEach เรียก ensureActiveBu(BLAVG) แล้ว

**Steps**

1. อ่าน profile API (/api/proxy/api/user/profile)
2. หา business unit ที่ is_default
3. เปิดหน้าที่มี navbar แล้วอ่าน label ของ BU switcher

**Expected**

default business unit มี code === 'BLAVG'; trigger ของ BU switcher ใน navbar แสดง label ของ BU นั้น

---

## TC-CAT-020002 — Negative - No Permission to Create Category

> **As a** Admin user, **I want** this Product Category behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

ผู้ใช้ไม่มีสิทธิ์สร้าง category

**Steps**

1. คลิก 'New Category'
2. กรอก 'Category Name' ด้วยชื่อที่ถูกต้อง
3. คลิก 'Save'

**Expected**

ผู้ใช้ได้รับข้อความ error แจ้งว่าไม่มีสิทธิ์สร้าง category

---

## TC-CAT-030003 — Negative Case - No Permission

> **As a** Admin user, **I want** this Product Category behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

ผู้ใช้ไม่มีสิทธิ์สร้าง category

**Steps**

1. ไปที่ /product-management/category
2. คลิก parent category
3. คลิก 'New Subcategory'

**Expected**

ผู้ใช้ถูกแจ้งให้ login หรือไม่มีสิทธิ์ดำเนินการ

---

## TC-CAT-030050 — สร้าง root category สำเร็จ

> **As a** Admin user, **I want** to create a new Product Category record, **so that** it becomes available for downstream operations.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG; มี Tax Profile ที่ active อย่างน้อย 1 รายการ

**Steps**

1. ไปที่ /product-management/category
2. คลิก 'Add Category'
3. กรอก Code และ Name ด้วยค่าที่ไม่ซ้ำ
4. เลือก Tax Profile รายการแรก
5. คลิก 'Create'

**Expected**

แสดง toast 'Category created successfully' และ root category ใหม่ปรากฏใน tree

---

## TC-CAT-030051 — สร้าง root category (parent ของ subtree)

> **As a** Admin user, **I want** to create a new Product Category record, **so that** it becomes available for downstream operations.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG; มี Tax Profile ที่ active อย่างน้อย 1 รายการ

**Steps**

1. ไปที่ /product-management/category
2. คลิก 'Add Category'
3. กรอก Code และ Name ที่ไม่ซ้ำ
4. เลือก Tax Profile รายการแรก
5. คลิก 'Create'

**Expected**

แสดง toast สร้างสำเร็จ และ root category ใหม่ปรากฏใน tree

---

## TC-CAT-030052 — สร้าง subcategory ใต้ root ผ่านปุ่ม Add child

> **As a** Admin user, **I want** to create a new Product Category record, **so that** it becomes available for downstream operations.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG; root category จาก TC-CAT-030051 มีอยู่

**Steps**

1. ไปที่ /product-management/category
2. คลิก 'Expand' เพื่อแสดง tree
3. hover ที่ row ของ root แล้วคลิกปุ่ม 'Add child' (Plus)
4. กรอก Code และ Name ของ subcategory (Tax Profile สืบทอดจาก parent)
5. คลิก 'Create'
6. คลิก 'Expand' อีกครั้งเพื่อดู subcategory

**Expected**

แสดง toast สร้างสำเร็จ และ subcategory ใหม่ปรากฏใต้ root

---

## TC-CAT-040002 — Create Item Group with Missing Permission

> **As a** Admin user, **I want** this Product Category behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

ผู้ใช้ไม่มีสิทธิ์สร้าง category

**Steps**

1. ไปที่ /product-management/category
2. พยายามคลิก 'New Item Group'

**Expected**

ผู้ใช้ไม่สามารถเข้าถึงปุ่ม 'New Item Group' และเห็นข้อความ error เรื่องสิทธิ์ที่เหมาะสม

---

## TC-CAT-040050 — แก้ไขชื่อ category แล้วค่าคงอยู่

> **As a** Admin user, **I want** to edit an existing Product Category record, **so that** its data stays accurate.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG; category จาก TC-CAT-030050 ถูกสร้างแล้ว

**Steps**

1. ไปที่ /product-management/category
2. hover ที่ row ของ category ที่สร้างไว้
3. คลิกปุ่ม Edit
4. แก้ Name เป็นชื่อใหม่
5. คลิก 'Save'
6. reload หน้า

**Expected**

แสดง toast 'Category updated successfully'; ชื่อใหม่ปรากฏใน tree และยังคงอยู่หลัง reload

---

## TC-CAT-040051 — สร้าง item group ใต้ subcategory ผ่านปุ่ม Add child

> **As a** Admin user, **I want** to create a new Product Category record, **so that** it becomes available for downstream operations.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG; subcategory จาก TC-CAT-030052 มีอยู่

**Steps**

1. ไปที่ /product-management/category
2. คลิก 'Expand' เพื่อแสดงทุกระดับ
3. hover ที่ row ของ subcategory แล้วคลิกปุ่ม 'Add child' (Plus)
4. กรอก Code และ Name ของ item group (Tax Profile สืบทอดจาก parent)
5. คลิก 'Create'
6. คลิก 'Expand' อีกครั้งเพื่อดู item group

**Expected**

แสดง toast สร้างสำเร็จ และ item group ใหม่ปรากฏใต้ subcategory

---

## TC-CAT-050003 — Edit Category with No Permission

> **As a** Admin user, **I want** this Product Category behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

ผู้ใช้ไม่มีสิทธิ์แก้ไข category

**Steps**

1. ไปที่ /product-management/category
2. เลือก category ที่มีอยู่
3. คลิก 'Edit'

**Expected**

ระบบแสดงข้อความ error แจ้งว่าสิทธิ์ไม่เพียงพอ

---

## TC-CAT-050050 — ลบ category สำเร็จ (cleanup)

> **As a** Admin user, **I want** to delete a Product Category record, **so that** the list reflects only valid entries.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG; category (ชื่อที่แก้ไขแล้ว) จาก TC-CAT-040050 ยังมีอยู่

**Steps**

1. ไปที่ /product-management/category
2. hover ที่ row ของ category
3. คลิกปุ่ม Delete
4. ยืนยันใน AlertDialog ด้วยปุ่ม 'Delete'
5. reload หน้า

**Expected**

แสดง toast 'Category deleted successfully'; category หายไปจาก tree และไม่กลับมาหลัง reload

---

## TC-CAT-050051 — ลบ item group สำเร็จ

> **As a** Admin user, **I want** to delete a Product Category record, **so that** the list reflects only valid entries.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG; item group จาก TC-CAT-040051 มีอยู่

**Steps**

1. ไปที่ /product-management/category
2. คลิก 'Expand' เพื่อแสดงทุกระดับ
3. hover ที่ row ของ item group แล้วคลิกปุ่ม Delete
4. ยืนยันใน AlertDialog ด้วยปุ่ม 'Delete'

**Expected**

แสดง toast ลบสำเร็จ และ item group หายไปจาก tree

---

## TC-CAT-050052 — ลบ subcategory สำเร็จ

> **As a** Admin user, **I want** to delete a Product Category record, **so that** the list reflects only valid entries.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG; subcategory จาก TC-CAT-030052 ว่างจาก children แล้ว (ลบ item group ไปแล้ว)

**Steps**

1. ไปที่ /product-management/category
2. คลิก 'Expand' เพื่อแสดง subcategory
3. hover ที่ row ของ subcategory แล้วคลิกปุ่ม Delete
4. ยืนยันใน AlertDialog ด้วยปุ่ม 'Delete'

**Expected**

แสดง toast ลบสำเร็จ และ subcategory หายไปจาก tree

---

## TC-CAT-050053 — ลบ root category สำเร็จ (cleanup)

> **As a** Admin user, **I want** to delete a Product Category record, **so that** the list reflects only valid entries.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG; root จาก TC-CAT-030051 ว่างจาก children แล้ว

**Steps**

1. ไปที่ /product-management/category
2. hover ที่ row ของ root แล้วคลิกปุ่ม Delete
3. ยืนยันใน AlertDialog ด้วยปุ่ม 'Delete'
4. reload หน้า

**Expected**

แสดง toast ลบสำเร็จ; root หายไปจาก tree และไม่กลับมาหลัง reload

---

## TC-CAT-090001 — Happy Path - Search for Existing Category

> **As a** Admin user, **I want** this Product Category behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Happy Path

**Preconditions**

ผู้ใช้มีสิทธิ์ดู category

**Steps**

1. ไปที่ /product-management/category
2. คลิกไอคอน 'Search'
3. กรอก 'Category Name' ด้วย 'Electronics'
4. คลิก 'Search'

**Expected**

ผลการค้นหาแสดง category 'Electronics' พร้อมคำอธิบายที่ตรงกัน

---

## TC-CAT-090002 — Negative Case - Search with Invalid Input

> **As a** Admin user, **I want** this Product Category behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

ผู้ใช้มีสิทธิ์ดู category

**Steps**

1. ไปที่ /product-management/category
2. คลิกไอคอน 'Search'
3. กรอก 'Category Name' ด้วย 'InvalidCategory123'
4. คลิก 'Search'

**Expected**

ผลการค้นหาไม่พบรายการที่ตรงกันและแสดงข้อความหรือ placeholder แจ้งว่าไม่พบผลลัพธ์

---

## TC-CAT-090003 — Edge Case - Search with Empty Input

> **As a** Admin user, **I want** this Product Category behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Edge Case

**Preconditions**

ผู้ใช้มีสิทธิ์ดู category

**Steps**

1. ไปที่ /product-management/category
2. คลิกไอคอน 'Search'
3. กรอก 'Category Name' ด้วย input ว่างเปล่า
4. คลิก 'Search'

**Expected**

ผลการค้นหาไม่เปลี่ยนจาก view เริ่มต้น

---

## TC-CAT-090004 — Negative Case - User without Permission

> **As a** Admin user, **I want** this Product Category behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

ผู้ใช้ไม่มีสิทธิ์ดู category

**Steps**

1. ไปที่ /product-management/category
2. คลิกไอคอน 'Search'
3. กรอก 'Category Name' ด้วย 'Office Supplies'
4. คลิก 'Search'

**Expected**

ผู้ใช้ถูก redirect ไปยังหน้าปฏิเสธสิทธิ์หรือได้รับข้อความ error

---


<sub>Last regenerated: 2026-11-24 · git f462816</sub>
