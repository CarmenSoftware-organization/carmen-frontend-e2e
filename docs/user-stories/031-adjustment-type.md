# Adjustment Type — User Stories

_Generated from `tests/031-adjustment-type.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Adjustment Type
**Spec:** `tests/031-adjustment-type.spec.ts`
**Default role:** Admin
**Total test cases:** 19 (12 High / 7 Medium / 0 Low)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-AT-010001 | หน้า list โหลดสำเร็จ | High | Smoke |
| TC-AT-010002 | ปุ่ม Add แสดง | High | Smoke |
| TC-AT-010003 | ช่องค้นหาใช้งานได้ | Medium | Smoke |
| TC-AT-010004 | ค้นหาคำที่ไม่มีต้องแสดง empty state | Medium | Functional |
| TC-AT-010005 | active BU = BLAVG | High | Smoke |
| TC-AT-030001 | สร้างรายการใหม่และปรากฏในตาราง | High | CRUD |
| TC-AT-040001 | แก้ไขชื่อและบันทึก | High | CRUD |
| TC-AT-040002 | toggle is_active แล้ว persist | Medium | CRUD |
| TC-AT-040003 | แก้ไขชื่อแล้ว persist | High | CRUD |
| TC-AT-040004 | ยกเลิกการแก้ไข ค่าต้องไม่ถูกบันทึก | Medium | Functional |
| TC-AT-050001 | ลบรายการ | High | CRUD |
| TC-AT-050002 | ยกเลิกการลบ record ต้องยังอยู่ | Medium | Functional |
| TC-AT-100001 | XSS payload ในชื่อต้องไม่รัน script | High | Security |
| TC-AT-100002 | SQL injection payload ต้องไม่ทำให้ระบบ crash | High | Security |
| TC-AT-100003 | ชื่อยาวเกิน maxLength ต้องถูกจำกัดที่ 100 | Medium | Validation |
| TC-AT-100004 _(skipped)_ | user สิทธิ์ต่ำเข้าหน้านี้ต้องไม่เห็นปุ่ม Add หรือถูก redirect | High | Authorization |
| TC-AT-200001 | บันทึกโดยไม่กรอกข้อมูลต้องแสดง error | High | Validation |
| TC-AT-200002 | แก้ไข: clear name แล้วบันทึก ต้องแสดง error | Medium | Validation |
| TC-AT-200003 | สร้าง code ซ้ำ ต้องถูก reject | High | Negative |

---

## TC-AT-010001 — หน้า list โหลดสำเร็จ

> **As a** Admin user, **I want** the Adjustment Type list page to load successfully, **so that** I can manage Adjustment Type records.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com ผ่าน auth fixture

**Steps**

1. ไปที่ /config/adjustment-type

**Expected**

URL ตรงกับ /config/adjustment-type; หน้า list render สำเร็จ

---

## TC-AT-010002 — ปุ่ม Add แสดง

> **As a** Admin user, **I want** to see the Add button on the Adjustment Type list, **so that** I can create new records.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; อยู่ที่ /config/adjustment-type

**Steps**

1. ไปที่ /config/adjustment-type

**Expected**

ปุ่ม Add visible บนหน้า list

---

## TC-AT-010003 — ช่องค้นหาใช้งานได้

> **As a** Admin user, **I want** to type into the Adjustment Type search field, **so that** I can quickly locate existing records.

**Priority:** Medium · **Test Type:** Smoke

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; อยู่ที่ /config/adjustment-type

**Steps**

1. ไปที่ /config/adjustment-type
2. พิมพ์ 'test' ในช่องค้นหา

**Expected**

ช่องค้นหา visible และรับค่า input ได้โดยไม่ error

---

## TC-AT-010004 — ค้นหาคำที่ไม่มีต้องแสดง empty state

> **As a** Admin user, **I want** a clear empty-state when no Adjustment Type records match my search, **so that** I know nothing was found.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; อยู่ที่ /config/adjustment-type

**Steps**

1. ไปที่ /config/adjustment-type
2. ค้นหาด้วยคำที่ไม่มี (`__NOPE__<UID>`)

**Expected**

Empty-state placeholder ปรากฏภายใน 10s (ไม่มีแถวที่ตรงกับคำค้น)

---

## TC-AT-010005 — active BU = BLAVG

> **As a** Admin user, **I want** core Adjustment Type interactions to work, **so that** day-to-day usage stays smooth.

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

## TC-AT-030001 — สร้างรายการใหม่และปรากฏในตาราง

> **As a** Admin user, **I want** to create a new Adjustment Type record, **so that** it becomes available for downstream operations.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; record CODE ยังไม่มีอยู่ใน DB

**Steps**

1. เปิด Add dialog
2. กรอก code = CODE, name = NAME, เลือก type = Stock In
3. กด Save
4. ค้นหาด้วย CODE

**Expected**

Success toast (created/success/สำเร็จ); แถวใหม่ที่มี CODE ปรากฏใน list

---

## TC-AT-040001 — แก้ไขชื่อและบันทึก

> **As a** Admin user, **I want** to edit an existing Adjustment Type record, **so that** its data stays accurate.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

TC-AT-030001 ผ่านแล้ว → record CODE/NAME มีอยู่ใน DB

**Steps**

1. ค้นหา CODE ใน list
2. คลิกแถวเพื่อเปิด edit dialog
3. clear ชื่อและกรอก NAME_UPDATED
4. กด Save
5. ค้นหา CODE

**Expected**

Updated/success toast ปรากฏ; แถว CODE ที่มีชื่อ NAME_UPDATED ปรากฏใน list

---

## TC-AT-040002 — toggle is_active แล้ว persist

> **As a** Admin user, **I want** to manage Adjustment Type records via CRUD, **so that** the data stays correct over time.

**Priority:** Medium · **Test Type:** CRUD

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG

**Steps**

1. เปิด Add dialog กรอก code/name เลือก type ปิด switch is_active กด Save
2. เปิดแถวอีกครั้งอ่านสถานะ switch
3. ลบ record

**Expected**

หลังเปิดแถวใหม่ switch is_active = false (ค่าถูก persist)

---

## TC-AT-040003 — แก้ไขชื่อแล้ว persist

> **As a** Admin user, **I want** to edit an existing Adjustment Type record, **so that** its data stays accurate.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG

**Steps**

1. สร้าง record
2. เปิดแถวจาก list แก้ name แล้ว Save
3. ยืนยัน list มี name ใหม่ ไม่พบ name เดิม
4. ลบ record

**Expected**

Updated; list มีแถว name ใหม่ และไม่พบ name เดิม (ค่าถูก persist จริง)

---

## TC-AT-040004 — ยกเลิกการแก้ไข ค่าต้องไม่ถูกบันทึก

> **As a** Admin user, **I want** this Adjustment Type interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG

**Steps**

1. สร้าง record
2. เปิดแถวแก้ name เป็นค่าใหม่
3. กด Cancel (dialog ปิดโดยไม่ save)
4. เปิดแถวเดิมอีกครั้งเช็ค name
5. ลบ record

**Expected**

หลัง Cancel แล้วเปิดใหม่ name ยังเป็นค่าเดิม (การแก้ไขไม่ถูกบันทึก)

---

## TC-AT-050001 — ลบรายการ

> **As a** Admin user, **I want** to delete a Adjustment Type record, **so that** the list reflects only valid entries.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

TC-AT-200002 ผ่านแล้ว → record CODE ยังคงมีอยู่ใน DB

**Steps**

1. ค้นหา CODE ใน list
2. กด Delete ที่แถว
3. ยืนยัน Delete

**Expected**

Deleted/success toast ปรากฏ (deleted/success/สำเร็จ)

---

## TC-AT-050002 — ยกเลิกการลบ record ต้องยังอยู่

> **As a** Admin user, **I want** this Adjustment Type interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

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

## TC-AT-100001 — XSS payload ในชื่อต้องไม่รัน script

> **As the** system, **I want** XSS payloads in Adjustment Type inputs to be neutralized, **so that** no script executes in users' browsers.

**Priority:** High · **Test Type:** Security

**Preconditions**

Logged in user with permission to access /config/adjustment-type; XSS dialog guard attached

**Steps**

1. เปิด list /config/adjustment-type
2. คลิก Add เพื่อเปิด dialog
3. กรอก name ด้วย XSS payload "<script>alert('xss-e2e')</script>"
4. กด Save

**Expected**

ไม่มี browser alert/dialog จาก payload (script ไม่ถูก execute); หาก dialog ยังเปิดอยู่ก็ปิดได้ปกติ

---

## TC-AT-100002 — SQL injection payload ต้องไม่ทำให้ระบบ crash

> **As the** system, **I want** SQL-injection payloads in Adjustment Type fields to be safely handled, **so that** the database remains intact.

**Priority:** High · **Test Type:** Security

**Preconditions**

Logged in user with permission to access /config/adjustment-type

**Steps**

1. เปิด list /config/adjustment-type
2. พิมพ์ SQL injection payload "'; DROP TABLE users; --" ลงในช่องค้นหา

**Expected**

หน้าไม่ crash; ปุ่ม Add ยังคง visible (list ทำงานปกติ)

---

## TC-AT-100003 — ชื่อยาวเกิน maxLength ต้องถูกจำกัดที่ 100

> **As a** Admin user, **I want** the system to block invalid Adjustment Type submissions, **so that** data quality is preserved.

**Priority:** Medium · **Test Type:** Validation

**Preconditions**

Logged in user with permission to access /config/adjustment-type

**Steps**

1. เปิด list /config/adjustment-type
2. คลิก Add เพื่อเปิด dialog
3. กรอก name ด้วย string ยาว 200 ตัวอักษร ('a' x 200)

**Expected**

ค่าใน input ถูก clamp ที่ ≤ 100 ตัวอักษร (maxLength enforced)

---

## TC-AT-100004 — user สิทธิ์ต่ำเข้าหน้านี้ต้องไม่เห็นปุ่ม Add หรือถูก redirect _(skipped)_

> **As a** low-privilege user, **I should NOT** see Add/edit controls on Adjustment Type, **so that** role separation is enforced.

**Priority:** High · **Test Type:** Authorization

**Preconditions**

Test user requestor@blueledgers.com (low-privilege role) มีอยู่จริง; module list path = /config/adjustment-type

**Steps**

1. เปิด browser context ใหม่
2. login เป็น requestor@blueledgers.com
3. ไปที่ /config/adjustment-type

**Expected**

User ถูก redirect ออกจาก /config/adjustment-type หรือ ปุ่ม Add ไม่ปรากฏ (count = 0)

---

## TC-AT-200001 — บันทึกโดยไม่กรอกข้อมูลต้องแสดง error

> **As a** Admin user, **I want** the system to block invalid Adjustment Type submissions, **so that** data quality is preserved.

**Priority:** High · **Test Type:** Validation

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; อยู่ที่ /config/adjustment-type

**Steps**

1. เปิด Add dialog
2. กด Save โดยไม่กรอก code/name

**Expected**

Error message แสดงใน dialog (required validation); dialog ยังเปิดอยู่

---

## TC-AT-200002 — แก้ไข: clear name แล้วบันทึก ต้องแสดง error

> **As a** Admin user, **I want** the system to block invalid Adjustment Type submissions, **so that** data quality is preserved.

**Priority:** Medium · **Test Type:** Validation

**Preconditions**

TC-AT-040001 ผ่านแล้ว → record มี name = NAME_UPDATED

**Steps**

1. ค้นหา CODE ใน list
2. เปิด edit dialog
3. clear name
4. กด Save

**Expected**

Error message แสดงใน dialog (required validation); dialog ยังเปิดอยู่

---

## TC-AT-200003 — สร้าง code ซ้ำ ต้องถูก reject

> **As a** Admin user, **I want** this Adjustment Type behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG

**Steps**

1. สร้าง record ด้วย code X
2. เปิด Add dialog กรอก code X เดิม + ชื่อใหม่ เลือก type กด Save

**Expected**

รายการที่สองไม่ถูกสร้าง: dialog ยังเปิดอยู่ (backend reject code ซ้ำ)

---


<sub>Last regenerated: 2026-11-24 · git f462816</sub>
