# Recipe Equipment Category — User Stories

_Generated from `tests/121-recipe-equipment-category.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Recipe Equipment Category
**Spec:** `tests/121-recipe-equipment-category.spec.ts`
**Default role:** Admin
**Total test cases:** 16 (10 High / 5 Medium / 1 Low)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-RECC-010001 | หน้า list โหลดสำเร็จ | High | Smoke |
| TC-RECC-010002 | ปุ่ม Add แสดง | High | Smoke |
| TC-RECC-010003 | ช่องค้นหาใช้งานได้ | Medium | Smoke |
| TC-RECC-010005 | active BU = BLAVG | High | Smoke |
| TC-RECC-030001 | สร้างรายการใหม่และปรากฏในตาราง | High | CRUD |
| TC-RECC-040001 | แก้ไขชื่อและบันทึก | High | CRUD |
| TC-RECC-040002 | toggle is_active แล้ว persist | Medium | CRUD |
| TC-RECC-050001 | ลบรายการ | High | CRUD |
| TC-RECC-050002 | ยกเลิกการลบ record ต้องยังอยู่ | Medium | Alternate Flow |
| TC-RECC-100001 | XSS payload ในชื่อต้องไม่รัน script | High | Security |
| TC-RECC-100002 | SQL injection payload ต้องไม่ทำให้ระบบ crash | High | Security |
| TC-RECC-100003 | ชื่อยาวเกิน maxLength ต้องถูกจำกัดที่ 100 | Medium | Validation |
| TC-RECC-100004 _(skipped)_ | user สิทธิ์ต่ำเข้าหน้านี้ต้องไม่เห็นปุ่ม Add หรือถูก redirect | High | Authorization |
| TC-RECC-200001 | บันทึกโดยไม่กรอกชื่อต้องแสดง error | High | Validation |
| TC-RECC-200002 | แก้ไข: clear name แล้วบันทึก ต้องแสดง error | Medium | Validation |
| TC-RECC-900001 | ค้นหาคำที่ไม่มีต้องแสดง empty state | Low | Edge Case |

---

## TC-RECC-010001 — หน้า list โหลดสำเร็จ

> **As a** Admin user, **I want** the Recipe Equipment Category list page to load successfully, **so that** I can manage Recipe Equipment Category records.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com ผ่าน auth fixture

**Steps**

1. ไปที่ /operation-plan/recipe-equipment-category

**Expected**

URL ตรงกับ /operation-plan/recipe-equipment-category; หน้า list โหลดสำเร็จโดยไม่ error

---

## TC-RECC-010002 — ปุ่ม Add แสดง

> **As a** Admin user, **I want** to see the Add button on the Recipe Equipment Category list, **so that** I can create new records.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; อยู่ที่ /operation-plan/recipe-equipment-category

**Steps**

1. ไปที่ /operation-plan/recipe-equipment-category

**Expected**

ปุ่ม Add visible บนหน้า list

---

## TC-RECC-010003 — ช่องค้นหาใช้งานได้

> **As a** Admin user, **I want** to type into the Recipe Equipment Category search field, **so that** I can quickly locate existing records.

**Priority:** Medium · **Test Type:** Smoke

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; อยู่ที่ /operation-plan/recipe-equipment-category

**Steps**

1. ไปที่ /operation-plan/recipe-equipment-category
2. พิมพ์ 'test' ในช่องค้นหา

**Expected**

ช่องค้นหา visible และรับค่า input ได้โดยไม่ error

---

## TC-RECC-010005 — active BU = BLAVG

> **As a** Admin user, **I want** core Recipe Equipment Category interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com ผ่าน auth fixture; beforeEach เรียก ensureActiveBu(BLAVG) แล้ว

**Steps**

1. อ่าน profile API
2. หา business unit ที่ is_default
3. เปิดหน้าที่มี navbar แล้วอ่าน label ของ BU switcher

**Expected**

default business unit มี code === 'BLAVG'; trigger ของ BU switcher ใน navbar แสดง label ของ BU นั้น

---

## TC-RECC-030001 — สร้างรายการใหม่และปรากฏในตาราง

> **As a** Admin user, **I want** to create a new Recipe Equipment Category record, **so that** it becomes available for downstream operations.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; record NAME ยังไม่มีอยู่ใน DB

**Steps**

1. ไปที่ /operation-plan/recipe-equipment-category
2. เปิด dialog Add
3. กรอก name
4. กด Save
5. ค้นหาด้วย NAME

**Expected**

Success toast (created/success/สำเร็จ); แถวใหม่ที่มี NAME ปรากฏใน list

---

## TC-RECC-040001 — แก้ไขชื่อและบันทึก

> **As a** Admin user, **I want** to edit an existing Recipe Equipment Category record, **so that** its data stays accurate.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

TC-RECC-030001 ผ่านแล้ว → record NAME มีอยู่ใน DB

**Steps**

1. ค้นหา NAME ใน list
2. คลิกแถวเพื่อเปิด edit dialog
3. แก้ name เป็น NAME_UPDATED
4. กด Save
5. ค้นหาด้วย NAME_UPDATED

**Expected**

Updated/success toast ปรากฏ; แถวที่มี NAME_UPDATED ปรากฏใน list

---

## TC-RECC-040002 — toggle is_active แล้ว persist

> **As a** Admin user, **I want** to manage Recipe Equipment Category records via CRUD, **so that** the data stays correct over time.

**Priority:** Medium · **Test Type:** CRUD

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG

**Steps**

1. เปิด Add dialog กรอก name ปิด switch is_active กด Save
2. เปิดแถวอีกครั้งอ่านสถานะ switch
3. ลบ record

**Expected**

หลังเปิดแถวใหม่ switch is_active = false (ค่าถูก persist)

---

## TC-RECC-050001 — ลบรายการ

> **As a** Admin user, **I want** to delete a Recipe Equipment Category record, **so that** the list reflects only valid entries.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

TC-RECC-200002 ผ่านแล้ว → record NAME_UPDATED ยังคงมีอยู่ใน DB

**Steps**

1. ค้นหา NAME_UPDATED ใน list
2. กด Delete บนแถว
3. ยืนยัน Delete ใน confirm dialog

**Expected**

Deleted/success toast ปรากฏ (deleted/success/สำเร็จ)

---

## TC-RECC-050002 — ยกเลิกการลบ record ต้องยังอยู่

> **As a** Admin user, **I want** this Recipe Equipment Category behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Alternate Flow

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG

**Steps**

1. สร้าง record
2. เปิด delete dialog แล้วกด Cancel
3. ค้นหา record ใน list
4. ลบ record (cleanup)

**Expected**

Delete dialog ปิดโดยไม่ลบ; record ยังปรากฏใน list

---

## TC-RECC-100001 — XSS payload ในชื่อต้องไม่รัน script

> **As the** system, **I want** XSS payloads in Recipe Equipment Category inputs to be neutralized, **so that** no script executes in users' browsers.

**Priority:** High · **Test Type:** Security

**Preconditions**

Logged in user with permission to access /operation-plan/recipe-equipment-category; XSS dialog guard attached

**Steps**

1. เปิด list /operation-plan/recipe-equipment-category
2. คลิก Add เพื่อเปิด dialog
3. กรอก name ด้วย XSS payload "<script>alert('xss-e2e')</script>"
4. กด Save

**Expected**

ไม่มี browser alert/dialog จาก payload (script ไม่ถูก execute); หาก dialog ยังเปิดอยู่ก็ปิดได้ปกติ

---

## TC-RECC-100002 — SQL injection payload ต้องไม่ทำให้ระบบ crash

> **As the** system, **I want** SQL-injection payloads in Recipe Equipment Category fields to be safely handled, **so that** the database remains intact.

**Priority:** High · **Test Type:** Security

**Preconditions**

Logged in user with permission to access /operation-plan/recipe-equipment-category

**Steps**

1. เปิด list /operation-plan/recipe-equipment-category
2. พิมพ์ SQL injection payload "'; DROP TABLE users; --" ลงในช่องค้นหา

**Expected**

หน้าไม่ crash; ปุ่ม Add ยังคง visible (list ทำงานปกติ)

---

## TC-RECC-100003 — ชื่อยาวเกิน maxLength ต้องถูกจำกัดที่ 100

> **As a** Admin user, **I want** the system to block invalid Recipe Equipment Category submissions, **so that** data quality is preserved.

**Priority:** Medium · **Test Type:** Validation

**Preconditions**

Logged in user with permission to access /operation-plan/recipe-equipment-category

**Steps**

1. เปิด list /operation-plan/recipe-equipment-category
2. คลิก Add เพื่อเปิด dialog
3. กรอก name ด้วย string ยาว 200 ตัวอักษร ('a' x 200)

**Expected**

ค่าใน input ถูก clamp ที่ ≤ 100 ตัวอักษร (maxLength enforced)

---

## TC-RECC-100004 — user สิทธิ์ต่ำเข้าหน้านี้ต้องไม่เห็นปุ่ม Add หรือถูก redirect _(skipped)_

> **As a** low-privilege user, **I should NOT** see Add/edit controls on Recipe Equipment Category, **so that** role separation is enforced.

**Priority:** High · **Test Type:** Authorization

**Preconditions**

Test user requestor@blueledgers.com (low-privilege role) มีอยู่จริง; module list path = /operation-plan/recipe-equipment-category

**Steps**

1. เปิด browser context ใหม่
2. login เป็น requestor@blueledgers.com
3. ไปที่ /operation-plan/recipe-equipment-category

**Expected**

User ถูก redirect ออกจาก /operation-plan/recipe-equipment-category หรือ ปุ่ม Add ไม่ปรากฏ (count = 0)

---

## TC-RECC-200001 — บันทึกโดยไม่กรอกชื่อต้องแสดง error

> **As a** Admin user, **I want** the system to block invalid Recipe Equipment Category submissions, **so that** data quality is preserved.

**Priority:** High · **Test Type:** Validation

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; อยู่ที่ /operation-plan/recipe-equipment-category

**Steps**

1. ไปที่ /operation-plan/recipe-equipment-category
2. เปิด dialog Add
3. กด Save โดยไม่กรอก name

**Expected**

Error message ปรากฏใน dialog (form block submit ด้วย client-side validation)

---

## TC-RECC-200002 — แก้ไข: clear name แล้วบันทึก ต้องแสดง error

> **As a** Admin user, **I want** the system to block invalid Recipe Equipment Category submissions, **so that** data quality is preserved.

**Priority:** Medium · **Test Type:** Validation

**Preconditions**

TC-RECC-040001 ผ่านแล้ว → record มี name = NAME_UPDATED

**Steps**

1. ค้นหา NAME_UPDATED ใน list
2. เปิด edit dialog
3. clear name
4. กด Save

**Expected**

Error message ปรากฏใน dialog (form block submit; ยังคงอยู่ใน edit mode)

---

## TC-RECC-900001 — ค้นหาคำที่ไม่มีต้องแสดง empty state

> **As a** Admin user, **I want** this Recipe Equipment Category behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Low · **Test Type:** Edge Case

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; อยู่ที่ /operation-plan/recipe-equipment-category

**Steps**

1. ไปที่ /operation-plan/recipe-equipment-category
2. ค้นหาด้วยคำที่ไม่มี (`__NOPE__<UID>`)

**Expected**

Empty-state placeholder ปรากฏภายใน 10s (ไม่มีแถวที่ตรงกับคำค้น)

---


<sub>Last regenerated: 2026-11-24 · git f462816</sub>
