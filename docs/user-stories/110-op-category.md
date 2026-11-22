# Op Category — User Stories

_Generated from `tests/110-op-category.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Op Category
**Spec:** `tests/110-op-category.spec.ts`
**Default role:** Admin
**Total test cases:** 13 (7 High / 4 Medium / 2 Low)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-OPCAT-010001 | แสดงรายการหมวดหมู่สูตรอาหาร | High | Smoke |
| TC-OPCAT-010002 | ค้นหาหมวดหมู่ด้วยชื่อ/รหัส | High | Functional |
| TC-OPCAT-030001 | สร้างหมวดหมู่ใหม่สำเร็จ | High | CRUD |
| TC-OPCAT-030003 | ออกจากฟอร์มสร้างที่ยังไม่บันทึกแล้วมีกล่องเตือน | Medium | Alternate Flow |
| TC-OPCAT-040001 | แก้ไขชื่อหมวดหมู่แล้วค่าคงอยู่ | High | CRUD |
| TC-OPCAT-040003 | หน้ารายละเอียดอ่านอย่างเดียวจนกว่าจะกด Edit | Medium | Functional |
| TC-OPCAT-050001 | ลบหมวดหมู่จากเมนูในแถวของตาราง | High | CRUD |
| TC-OPCAT-050002 | ยกเลิกการลบใน dialog | Medium | Alternate Flow |
| TC-OPCAT-100001 | ผู้ใช้ที่มีสิทธิ์ category.view เห็นหน้าหมวดหมู่ | High | Authorization |
| TC-OPCAT-200001 | บันทึกไม่ได้เมื่อเว้น Code/Name ว่าง | High | Validation |
| TC-OPCAT-200002 | จำกัดความยาว Code ไม่เกิน 10 ตัวอักษร | Medium | Validation |
| TC-OPCAT-900001 | ค้นหาด้วยคำที่ไม่มีผลลัพธ์ | Low | Edge Case |
| TC-OPCAT-900002 | เปิดหมวดหมู่ด้วย id ที่ไม่มีอยู่จริง | Low | Edge Case |

---

## TC-OPCAT-010001 — แสดงรายการหมวดหมู่สูตรอาหาร

> **As a** Admin user, **I want** core Op Category interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG; มีหมวดหมู่สูตรอาหารอย่างน้อย 1 รายการ

**Steps**

1. ไปที่ /operation-plan/category
2. รอให้ DataGrid โหลดเสร็จ

**Expected**

หัวข้อหน้าแสดง 'Recipe Category' พร้อม badge จำนวนรายการ; ตารางแสดงคอลัมน์ Code, Name, Parent, Status และเมนูจุดสามจุดท้ายแถว

---

## TC-OPCAT-010002 — ค้นหาหมวดหมู่ด้วยชื่อ/รหัส

> **As a** Admin user, **I want** this Op Category interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

อยู่ที่หน้า /operation-plan/category และมีหลายหมวดหมู่

**Steps**

1. คลิกที่ช่อง Search บนแถบเครื่องมือ
2. พิมพ์ชื่อหรือรหัสของหมวดหมู่ที่มีอยู่
3. กด Enter

**Expected**

ตารางแสดงเฉพาะหมวดหมู่ที่ตรงกับคำค้นหา; พิมพ์อย่างเดียวไม่ยิงค้นหา ต้องกด Enter เท่านั้น

---

## TC-OPCAT-030001 — สร้างหมวดหมู่ใหม่สำเร็จ

> **As a** Admin user, **I want** to create a new Op Category record, **so that** it becomes available for downstream operations.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG; อยู่ที่หน้า /operation-plan/category

**Steps**

1. คลิกปุ่ม 'Add Category'
2. ตรวจว่า URL เป็น /operation-plan/category/new
3. กรอก Code และ Name ด้วยค่าที่ไม่ซ้ำ
4. คลิกปุ่ม 'Create'

**Expected**

แสดง toast 'Recipe Category created successfully'; แอปเด้งกลับไปที่ /operation-plan/category และหมวดหมู่ใหม่ปรากฏในตาราง

---

## TC-OPCAT-030003 — ออกจากฟอร์มสร้างที่ยังไม่บันทึกแล้วมีกล่องเตือน

> **As a** Admin user, **I want** this Op Category behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Alternate Flow

**Preconditions**

อยู่ที่ /operation-plan/category/new

**Steps**

1. กรอก Code และ Name บางส่วน (ฟอร์มกลายเป็น dirty)
2. คลิกปุ่มย้อนกลับ 'Go back'
3. ในกล่องเตือน คลิก 'Keep editing'
4. คลิกปุ่มย้อนกลับอีกครั้ง แล้วคลิก 'Discard'

**Expected**

ขั้นที่ 2 ขึ้นกล่อง 'Discard changes?'; 'Keep editing' ปิดกล่องโดยยังอยู่หน้าเดิม; 'Discard' พากลับไป /operation-plan/category โดยไม่สร้างรายการใหม่

---

## TC-OPCAT-040001 — แก้ไขชื่อหมวดหมู่แล้วค่าคงอยู่

> **As a** Admin user, **I want** to edit an existing Op Category record, **so that** its data stays accurate.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

มีหมวดหมู่ที่สร้างไว้แล้ว (เช่น จาก TC-OPCAT-030001)

**Steps**

1. เปิดหมวดหมู่จาก list แล้วคลิกปุ่ม 'Edit'
2. แก้ไข Name เป็นค่าใหม่
3. คลิกปุ่ม 'Save'

**Expected**

แสดง toast 'Recipe Category updated successfully' และเด้งกลับไปหน้า list; ชื่อใหม่แสดงในตาราง

---

## TC-OPCAT-040003 — หน้ารายละเอียดอ่านอย่างเดียวจนกว่าจะกด Edit

> **As a** Admin user, **I want** this Op Category interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

อยู่ที่ /operation-plan/category/{id} ของหมวดหมู่ที่มีอยู่จริง

**Steps**

1. ตรวจสถานะของช่อง Code, Name ก่อนกด Edit
2. คลิกปุ่ม 'Edit'
3. ตรวจสถานะของช่องเดิมอีกครั้ง
4. คลิก 'Cancel'

**Expected**

ก่อนกด Edit ทุกช่องถูก disable; หลังกด Edit ช่องทั้งหมดแก้ไขได้; กด Cancel กลับสู่โหมดอ่านอย่างเดียว

---

## TC-OPCAT-050001 — ลบหมวดหมู่จากเมนูในแถวของตาราง

> **As a** Admin user, **I want** to delete a Op Category record, **so that** the list reflects only valid entries.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

มีหมวดหมู่ที่ไม่ถูกอ้างอิงและสามารถลบได้; อยู่ที่หน้า /operation-plan/category

**Steps**

1. สร้างหมวดหมู่ใหม่สำหรับลบ
2. คลิกเมนูจุดสามจุด (Row actions)
3. คลิก 'Delete'
4. ยืนยันใน dialog

**Expected**

กล่องยืนยันมีหัวข้อ 'Delete Recipe Category'; ยืนยันแล้วแสดง toast และหมวดหมู่หายจากตาราง

---

## TC-OPCAT-050002 — ยกเลิกการลบใน dialog

> **As a** Admin user, **I want** this Op Category behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Alternate Flow

**Preconditions**

มีหมวดหมู่อย่างน้อย 1 รายการ; อยู่ที่หน้า list

**Steps**

1. เปิดเมนูจุดสามจุดของแถวแล้วคลิก 'Delete'
2. ในกล่องยืนยัน คลิก 'Cancel'

**Expected**

กล่องปิดลงโดยไม่มีการลบ ไม่มี toast และหมวดหมู่ยังอยู่ในตารางเหมือนเดิม

---

## TC-OPCAT-100001 — ผู้ใช้ที่มีสิทธิ์ category.view เห็นหน้าหมวดหมู่

> **As a** low-privilege user, **I should NOT** see Add/edit controls on Op Category, **so that** role separation is enforced.

**Priority:** High · **Test Type:** Authorization

**Preconditions**

Login ด้วยบัญชีที่ไม่ได้ถือ permission operation_plan.view และไม่ใช่ admin

**Steps**

1. เข้า URL /operation-plan/category ตรงๆ

**Expected**

ยังอยู่ที่ URL เดิมแต่เนื้อหาถูกแทนด้วยกล่อง role='alert' หัวข้อ 'Permission Denied' — ไม่มีข้อมูลหมวดหมู่ใดๆ แสดง

---

## TC-OPCAT-200001 — บันทึกไม่ได้เมื่อเว้น Code/Name ว่าง

> **As a** Admin user, **I want** the system to block invalid Op Category submissions, **so that** data quality is preserved.

**Priority:** High · **Test Type:** Validation

**Preconditions**

อยู่ที่ /operation-plan/category/new

**Steps**

1. ปล่อยช่อง Code และ Name ว่าง
2. คลิก 'Create'

**Expected**

แสดงข้อความ error 'Code is required' และ 'Name is required'; ยังอยู่หน้า /new

---

## TC-OPCAT-200002 — จำกัดความยาว Code ไม่เกิน 10 ตัวอักษร

> **As a** Admin user, **I want** the system to block invalid Op Category submissions, **so that** data quality is preserved.

**Priority:** Medium · **Test Type:** Validation

**Preconditions**

อยู่ที่ /operation-plan/category/new

**Steps**

1. พิมพ์ข้อความยาวเกิน 10 ตัวอักษรลงในช่อง Code

**Expected**

ช่อง Code รับได้สูงสุด 10 ตัวอักษร (maxLength=10) ส่วนที่เกินไม่ถูกรับเข้าช่อง

---

## TC-OPCAT-900001 — ค้นหาด้วยคำที่ไม่มีผลลัพธ์

> **As a** Admin user, **I want** this Op Category behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Low · **Test Type:** Edge Case

**Preconditions**

อยู่ที่หน้า /operation-plan/category

**Steps**

_(no steps documented)_

**Expected**

ตารางไม่มีแถวข้อมูล และแสดงสถานะว่าง (EmptyComponent)

---

## TC-OPCAT-900002 — เปิดหมวดหมู่ด้วย id ที่ไม่มีอยู่จริง

> **As a** Admin user, **I want** this Op Category behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Low · **Test Type:** Edge Case

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG

**Steps**

1. เข้า URL /operation-plan/category/{uuid ที่ไม่มีอยู่ในระบบ} ตรงๆ

**Expected**

แสดงกล่อง role='alert' หัวข้อ 'Something went wrong' พร้อม 'Recipe category not found'; มีปุ่ม 'Back to list'

---


<sub>Last regenerated: 2026-11-21 · git 4c477d5</sub>
