# Cuisine — User Stories

_Generated from `tests/111-cuisine.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Cuisine
**Spec:** `tests/111-cuisine.spec.ts`
**Default role:** Admin
**Total test cases:** 17 (7 High / 7 Medium / 3 Low)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-CUIS-010001 | แสดงรายการ Cuisine Type | High | Smoke |
| TC-CUIS-010002 | ค้นหา Cuisine ด้วยชื่อ | High | Functional |
| TC-CUIS-010007 | สลับมุมมองตาราง ↔ การ์ด | Medium | Functional |
| TC-CUIS-010010 | หน้ารายการไม่มีปุ่ม Export / Print (hideExportPrint) | Low | Functional |
| TC-CUIS-020001 | เปิดหน้ารายละเอียด Cuisine จาก list | Medium | Happy Path |
| TC-CUIS-020003 | เปิด id ที่ไม่มีอยู่จริงแล้วเจอสถานะไม่พบข้อมูล | Medium | Negative |
| TC-CUIS-020004 | ปุ่ม Back กลับหน้า list | Low | Happy Path |
| TC-CUIS-030001 | สร้าง Cuisine ใหม่สำเร็จ | High | CRUD |
| TC-CUIS-030003 | กด Cancel ตอนกรอกฟอร์มใหม่ค้างไว้แล้วเจอ Discard dialog | Medium | Alternate Flow |
| TC-CUIS-040001 | แก้ไขชื่อและ Region แล้วค่าคงอยู่ | High | CRUD |
| TC-CUIS-040002 | สลับสถานะ Active เป็น Inactive | Medium | CRUD |
| TC-CUIS-040003 | กด Cancel ในโหมด edit แล้วค่าเดิมกลับคืน | Medium | Alternate Flow |
| TC-CUIS-050001 | ลบ Cuisine จากเมนูแถวในตารางสำเร็จ | High | CRUD |
| TC-CUIS-050002 | ยกเลิกการลบใน dialog | Medium | Alternate Flow |
| TC-CUIS-100001 | เข้าหน้า Cuisine โดยไม่มี session แล้วถูกส่งไป /login | High | Auth-guard |
| TC-CUIS-200001 | บันทึกไม่ได้เมื่อเว้น Name ว่าง | High | Validation |
| TC-CUIS-900001 | ค้นหาด้วยคำที่ไม่มีผลลัพธ์ | Low | Edge Case |

---

## TC-CUIS-010001 — แสดงรายการ Cuisine Type

> **As a** Admin user, **I want** core Cuisine interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG; มี cuisine อย่างน้อย 1 รายการ

**Steps**

1. ไปที่ /operation-plan/cuisine
2. รอให้ DataGrid โหลดเสร็จ

**Expected**

หัวหน้าแสดงชื่อ 'Cuisine Type'; ตารางมีคอลัมน์ Name, Region, Status; ปุ่ม 'Add Cuisine Type' แสดงอยู่มุมขวาบน

---

## TC-CUIS-010002 — ค้นหา Cuisine ด้วยชื่อ

> **As a** Admin user, **I want** this Cuisine interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

อยู่ที่หน้า /operation-plan/cuisine; มี cuisine หลายรายการ

**Steps**

1. คลิกช่อง Search
2. พิมพ์ชื่อ cuisine ที่มีอยู่
3. กด Enter

**Expected**

ตารางแสดงเฉพาะ cuisine ที่ตรงกับคำค้น

---

## TC-CUIS-010007 — สลับมุมมองตาราง ↔ การ์ด

> **As a** Admin user, **I want** this Cuisine interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

อยู่ที่หน้า /operation-plan/cuisine บนจอขนาด desktop; มี cuisine อย่างน้อย 1 รายการ

**Steps**

1. กดปุ่มไอคอน 'Grid view'
2. สังเกตเนื้อหาที่แสดง
3. กดปุ่ม 'List view' เพื่อกลับ

**Expected**

โหมด grid แสดงการ์ด; กดกลับ List view แล้วกลับมาเป็น DataGrid

---

## TC-CUIS-010010 — หน้ารายการไม่มีปุ่ม Export / Print (hideExportPrint)

> **As a** Admin user, **I want** a clear empty-state when no Cuisine records match my search, **so that** I know nothing was found.

**Priority:** Low · **Test Type:** Functional

**Preconditions**

อยู่ที่หน้า /operation-plan/cuisine

**Steps**

1. ไปที่ /operation-plan/cuisine\n2. มองหาปุ่ม Export / Print บน toolbar

**Expected**

ไม่มีปุ่ม Export และ Print (หน้านี้ซ่อนไว้ด้วย hideExportPrint) ส่วนปุ่ม Add Cuisine Type ใช้งานได้

---

## TC-CUIS-020001 — เปิดหน้ารายละเอียด Cuisine จาก list

> **As a** Admin user, **I want** this Cuisine behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Happy Path

**Preconditions**

อยู่ที่หน้า /operation-plan/cuisine; มี cuisine อย่างน้อย 1 รายการ

**Steps**

1. คลิกที่ชื่อ cuisine ในคอลัมน์ Name (เป็นปุ่ม ไม่ใช่ลิงก์)

**Expected**

นำทางไปที่ /operation-plan/cuisine/{id}; ทุกช่องกรอกอยู่ในสถานะ disabled และ toolbar แสดงปุ่ม 'Activity' กับ 'Edit'

---

## TC-CUIS-020003 — เปิด id ที่ไม่มีอยู่จริงแล้วเจอสถานะไม่พบข้อมูล

> **As a** Admin user, **I want** this Cuisine behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Negative

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG

**Steps**

1. เข้า URL /operation-plan/cuisine/00000000-0000-0000-0000-000000000000

**Expected**

แสดงกล่อง role='alert' หรือหน้าไม่พบข้อมูล; ไม่มี crash ของแอป

---

## TC-CUIS-020004 — ปุ่ม Back กลับหน้า list

> **As a** Admin user, **I want** this Cuisine behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Low · **Test Type:** Happy Path

**Preconditions**

อยู่ที่ /operation-plan/cuisine/{id}

**Steps**

1. คลิกปุ่มย้อนกลับบนหน้ารายละเอียด

**Expected**

กลับไปที่ /operation-plan/cuisine โดยไม่มีการเปลี่ยนแปลงข้อมูล

---

## TC-CUIS-030001 — สร้าง Cuisine ใหม่สำเร็จ

> **As a** Admin user, **I want** to create a new Cuisine record, **so that** it becomes available for downstream operations.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG; อยู่ที่หน้า /operation-plan/cuisine

**Steps**

1. คลิกปุ่ม 'Add Cuisine Type'
2. ตรวจว่า URL เป็น /operation-plan/cuisine/new
3. กรอก Name
4. คลิกปุ่ม 'Create'

**Expected**

แสดง toast 'Cuisine Type created successfully'; เด้งกลับไปที่ /operation-plan/cuisine และ cuisine ใหม่ปรากฏในตาราง

---

## TC-CUIS-030003 — กด Cancel ตอนกรอกฟอร์มใหม่ค้างไว้แล้วเจอ Discard dialog

> **As a** Admin user, **I want** this Cuisine behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Alternate Flow

**Preconditions**

อยู่ที่ /operation-plan/cuisine/new

**Steps**

1. กรอก Name บางส่วน (ฟอร์มกลายเป็น dirty)
2. คลิกปุ่มย้อนกลับหรือ Cancel
3. ในกล่องเตือน คลิก 'Keep editing'
4. คลิกย้อนกลับอีกครั้ง แล้วคลิก 'Discard'

**Expected**

กล่อง 'Discard changes?' ปรากฏ; 'Keep editing' คืนสู่หน้า /new; 'Discard' พากลับไป /operation-plan/cuisine

---

## TC-CUIS-040001 — แก้ไขชื่อและ Region แล้วค่าคงอยู่

> **As a** Admin user, **I want** to edit an existing Cuisine record, **so that** its data stays accurate.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

มีหมวดหมู่ cuisine ที่สร้างไว้แล้ว (NAME จาก TC-CUIS-030001)

**Steps**

1. ค้นหา cuisine ที่สร้างไว้
2. เปิดหน้ารายละเอียด
3. คลิก 'Edit'
4. แก้ไขชื่อเป็นค่าใหม่
5. คลิก 'Save'

**Expected**

แสดง toast 'Cuisine Type updated successfully'; เด้งกลับไปหน้า list; ชื่อใหม่แสดงในตาราง

---

## TC-CUIS-040002 — สลับสถานะ Active เป็น Inactive

> **As a** Admin user, **I want** to manage Cuisine records via CRUD, **so that** the data stays correct over time.

**Priority:** Medium · **Test Type:** CRUD

**Preconditions**

มี cuisine ที่สถานะ Active; อยู่ที่หน้ารายละเอียด

**Steps**

1. เปิดรายละเอียด cuisine
2. คลิก 'Edit'
3. สลับสวิตช์สถานะ Active → Inactive
4. คลิก 'Save'

**Expected**

แสดง toast อัปเดตสำเร็จ; เด้งกลับ list; แถวนั้นแสดง Status = Inactive

---

## TC-CUIS-040003 — กด Cancel ในโหมด edit แล้วค่าเดิมกลับคืน

> **As a** Admin user, **I want** this Cuisine behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Alternate Flow

**Preconditions**

มี cuisine ที่ edit ได้; อยู่ที่หน้ารายละเอียด

**Steps**

1. เปิดรายละเอียด cuisine
2. คลิก 'Edit'
3. แก้ชื่อเป็น 'UNSAVED_CHANGE_XYZ'
4. คลิก 'Cancel'

**Expected**

กลับสู่โหมดอ่านอย่างเดียวและชื่อยังเป็นค่าเดิม

---

## TC-CUIS-050001 — ลบ Cuisine จากเมนูแถวในตารางสำเร็จ

> **As a** Admin user, **I want** to delete a Cuisine record, **so that** the list reflects only valid entries.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

มี cuisine ที่ไม่ถูกอ้างอิงและสามารถลบได้

**Steps**

1. สร้าง cuisine ใหม่สำหรับลบ
2. คลิกเมนูจุดสามจุด (Row actions)
3. คลิก 'Delete'
4. ยืนยันใน dialog

**Expected**

แสดง toast ลบสำเร็จ; cuisine หายจากตาราง

---

## TC-CUIS-050002 — ยกเลิกการลบใน dialog

> **As a** Admin user, **I want** this Cuisine behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Alternate Flow

**Preconditions**

มี cuisine อย่างน้อย 1 รายการ

**Steps**

1. เปิดเมนูจุดสามจุดของแถว แล้วคลิก 'Delete'
2. ในกล่องยืนยัน คลิก 'Cancel'

**Expected**

กล่องปิดลงโดยไม่มีการลบ; cuisine ยังอยู่ในตาราง

---

## TC-CUIS-100001 — เข้าหน้า Cuisine โดยไม่มี session แล้วถูกส่งไป /login

> **As an** unauthenticated user hitting a protected route, **I want** to be redirected to /login, **so that** protected screens stay protected.

**Priority:** High · **Test Type:** Auth-guard

**Preconditions**

ไม่มี session (browser context ที่ยังไม่ได้ล็อกอิน)

**Steps**

1. เปิด URL /operation-plan/cuisine ตรงๆ โดยไม่มี session

**Expected**

ถูก redirect ไปหน้า /login และไม่เห็นข้อมูล cuisine ใดๆ

---

## TC-CUIS-200001 — บันทึกไม่ได้เมื่อเว้น Name ว่าง

> **As a** Admin user, **I want** the system to block invalid Cuisine submissions, **so that** data quality is preserved.

**Priority:** High · **Test Type:** Validation

**Preconditions**

อยู่ที่ /operation-plan/cuisine/new

**Steps**

1. ปล่อยช่อง Name ว่างไว้
2. คลิกปุ่ม 'Create'

**Expected**

แสดงข้อความ error ใต้ช่อง Name; ยังอยู่หน้า /new ไม่มี toast และไม่มีการสร้าง cuisine

---

## TC-CUIS-900001 — ค้นหาด้วยคำที่ไม่มีผลลัพธ์

> **As a** Admin user, **I want** this Cuisine behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Low · **Test Type:** Edge Case

**Preconditions**

อยู่ที่หน้า /operation-plan/cuisine

**Steps**

_(no steps documented)_

**Expected**

ตารางไม่มีแถวข้อมูล และแสดงสถานะว่าง

---


<sub>Last regenerated: 2026-11-21 · git 4c477d5</sub>
