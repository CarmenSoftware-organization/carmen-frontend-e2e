# Unit — User Stories

_Generated from `tests/020-unit.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Unit
**Spec:** `tests/020-unit.spec.ts`
**Default role:** Admin
**Total test cases:** 17 (11 High / 6 Medium / 0 Low)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-UN-010001 | หน้า list โหลดสำเร็จ | High | Smoke |
| TC-UN-010002 | ปุ่ม Add แสดง | High | Smoke |
| TC-UN-010003 | ช่องค้นหาใช้งานได้ | Medium | Smoke |
| TC-UN-010004 | ค้นหาคำที่ไม่มีต้องแสดง empty state | Medium | Functional |
| TC-UN-010005 | active BU = BLAVG | High | Smoke |
| TC-UN-030001 | สร้าง unit ใหม่และปรากฏในตาราง | High | CRUD |
| TC-UN-040001 | แก้ไขชื่อแล้ว persist | High | CRUD |
| TC-UN-040002 | toggle is_active แล้ว persist | Medium | CRUD |
| TC-UN-050001 | ลบ unit | High | CRUD |
| TC-UN-100001 | XSS payload ในชื่อต้องไม่รัน script | High | Security |
| TC-UN-100002 | SQL injection payload ต้องไม่ทำให้ระบบ crash | High | Security |
| TC-UN-100003 | ชื่อยาวเกิน maxLength ต้องถูกจำกัดที่ 100 | Medium | Validation |
| TC-UN-100004 _(skipped)_ | user สิทธิ์ต่ำเข้าหน้านี้ต้องไม่เห็นปุ่ม Add หรือถูก redirect | High | Authorization |
| TC-UN-200001 | บันทึกโดยไม่กรอกชื่อต้องแสดง error | High | Validation |
| TC-UN-200002 | สร้าง name ซ้ำ ต้องถูก reject | High | Negative |
| TC-UN-200003 | description สร้าง/แก้ไข + maxLength | Medium | CRUD |
| TC-UN-200004 | แก้ไข: clear name แล้วบันทึก ต้องแสดง error | Medium | Validation |

---

## TC-UN-010001 — หน้า list โหลดสำเร็จ

> **As a** Admin user, **I want** the Unit list page to load successfully, **so that** I can manage Unit records.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com ผ่าน auth fixture (createAuthTest)

**Steps**

1. ไปที่ /config/unit

**Expected**

URL ตรงกับ /config/unit; หน้า list โหลดสำเร็จโดยไม่ error

---

## TC-UN-010002 — ปุ่ม Add แสดง

> **As a** Admin user, **I want** to see the Add button on the Unit list, **so that** I can create new records.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; อยู่ที่ /config/unit

**Steps**

1. ไปที่ /config/unit

**Expected**

ปุ่ม Add visible บนหน้า list

---

## TC-UN-010003 — ช่องค้นหาใช้งานได้

> **As a** Admin user, **I want** to type into the Unit search field, **so that** I can quickly locate existing records.

**Priority:** Medium · **Test Type:** Smoke

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; อยู่ที่ /config/unit

**Steps**

1. ไปที่ /config/unit
2. พิมพ์ 'test' ในช่องค้นหา

**Expected**

ช่องค้นหา visible และรับค่า input ได้โดยไม่ error

---

## TC-UN-010004 — ค้นหาคำที่ไม่มีต้องแสดง empty state

> **As a** Admin user, **I want** a clear empty-state when no Unit records match my search, **so that** I know nothing was found.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; อยู่ที่ /config/unit

**Steps**

1. ไปที่ /config/unit
2. ค้นหาด้วยคำที่ไม่มี (`__NOPE__<timestamp>`)

**Expected**

Empty-state placeholder ปรากฏภายใน 10s (ไม่มีแถวที่ตรงกับคำค้น)

---

## TC-UN-010005 — active BU = BLAVG

> **As a** Admin user, **I want** core Unit interactions to work, **so that** day-to-day usage stays smooth.

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

## TC-UN-030001 — สร้าง unit ใหม่และปรากฏในตาราง

> **As a** Admin user, **I want** to create a new Unit record, **so that** it becomes available for downstream operations.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG

**Steps**

1. เปิด Add dialog
2. กรอก name
3. กด Save
4. ค้นหา name ใน list
5. ลบ record

**Expected**

Success toast (created/success/สำเร็จ); แถวที่มี name ปรากฏใน list

---

## TC-UN-040001 — แก้ไขชื่อแล้ว persist

> **As a** Admin user, **I want** to edit an existing Unit record, **so that** its data stays accurate.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG

**Steps**

1. สร้าง unit
2. ค้นหาและเปิดแถวเพื่อแก้ไข
3. แก้ name เป็นค่าใหม่ กด Save
4. ค้นหา name ใหม่/เดิมใน list
5. ลบ record

**Expected**

Updated toast; list มีแถว name ใหม่ และไม่พบ name เดิม (ค่าถูก persist จริง)

---

## TC-UN-040002 — toggle is_active แล้ว persist

> **As a** Admin user, **I want** to manage Unit records via CRUD, **so that** the data stays correct over time.

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

## TC-UN-050001 — ลบ unit

> **As a** Admin user, **I want** to delete a Unit record, **so that** the list reflects only valid entries.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG

**Steps**

1. สร้าง unit
2. ค้นหาใน list
3. เปิด Row actions → Delete → ยืนยัน
4. ค้นหาอีกครั้ง

**Expected**

Deleted toast; ไม่พบแถว name ใน list (empty state)

---

## TC-UN-100001 — XSS payload ในชื่อต้องไม่รัน script

> **As the** system, **I want** XSS payloads in Unit inputs to be neutralized, **so that** no script executes in users' browsers.

**Priority:** High · **Test Type:** Security

**Preconditions**

Logged in user with permission to access /config/unit; XSS dialog guard attached

**Steps**

1. เปิด list /config/unit
2. คลิก Add เพื่อเปิด dialog
3. กรอก name ด้วย XSS payload "<script>alert('xss-e2e')</script>"
4. กด Save

**Expected**

ไม่มี browser alert/dialog จาก payload (script ไม่ถูก execute); หาก dialog ยังเปิดอยู่ก็ปิดได้ปกติ

---

## TC-UN-100002 — SQL injection payload ต้องไม่ทำให้ระบบ crash

> **As the** system, **I want** SQL-injection payloads in Unit fields to be safely handled, **so that** the database remains intact.

**Priority:** High · **Test Type:** Security

**Preconditions**

Logged in user with permission to access /config/unit

**Steps**

1. เปิด list /config/unit
2. พิมพ์ SQL injection payload "'; DROP TABLE users; --" ลงในช่องค้นหา

**Expected**

หน้าไม่ crash; ปุ่ม Add ยังคง visible (list ทำงานปกติ)

---

## TC-UN-100003 — ชื่อยาวเกิน maxLength ต้องถูกจำกัดที่ 100

> **As a** Admin user, **I want** the system to block invalid Unit submissions, **so that** data quality is preserved.

**Priority:** Medium · **Test Type:** Validation

**Preconditions**

Logged in user with permission to access /config/unit

**Steps**

1. เปิด list /config/unit
2. คลิก Add เพื่อเปิด dialog
3. กรอก name ด้วย string ยาว 200 ตัวอักษร ('a' x 200)

**Expected**

ค่าใน input ถูก clamp ที่ ≤ 100 ตัวอักษร (maxLength enforced)

---

## TC-UN-100004 — user สิทธิ์ต่ำเข้าหน้านี้ต้องไม่เห็นปุ่ม Add หรือถูก redirect _(skipped)_

> **As a** low-privilege user, **I should NOT** see Add/edit controls on Unit, **so that** role separation is enforced.

**Priority:** High · **Test Type:** Authorization

**Preconditions**

Test user requestor@blueledgers.com (low-privilege role) มีอยู่จริง; module list path = /config/unit

**Steps**

1. เปิด browser context ใหม่
2. login เป็น requestor@blueledgers.com
3. ไปที่ /config/unit

**Expected**

User ถูก redirect ออกจาก /config/unit หรือ ปุ่ม Add ไม่ปรากฏ (count = 0)

---

## TC-UN-200001 — บันทึกโดยไม่กรอกชื่อต้องแสดง error

> **As a** Admin user, **I want** the system to block invalid Unit submissions, **so that** data quality is preserved.

**Priority:** High · **Test Type:** Validation

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG

**Steps**

1. เปิด Add dialog
2. กด Save โดยไม่กรอก name

**Expected**

Error message ปรากฏใน dialog (form block submit ด้วย client-side validation)

---

## TC-UN-200002 — สร้าง name ซ้ำ ต้องถูก reject

> **As a** Admin user, **I want** this Unit behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG

**Steps**

1. สร้าง unit ด้วย name X
2. เปิด Add dialog กรอก name X เดิม กด Save

**Expected**

รายการที่สองไม่ถูกสร้าง: dialog ยังเปิดอยู่ (backend reject name ซ้ำ)

---

## TC-UN-200003 — description สร้าง/แก้ไข + maxLength

> **As a** Admin user, **I want** to create a new Unit record, **so that** it becomes available for downstream operations.

**Priority:** Medium · **Test Type:** CRUD

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG

**Steps**

1. สร้าง unit พร้อม description
2. เปิดแถวอีกครั้งเช็คค่า description
3. ทดสอบ maxLength โดยพิมพ์ยาวเกิน
4. ลบ record

**Expected**

description ถูก persist (เห็นค่าเดิมเมื่อเปิด dialog ใหม่); ช่อง description ถูกจำกัดความยาวตาม maxLength

---

## TC-UN-200004 — แก้ไข: clear name แล้วบันทึก ต้องแสดง error

> **As a** Admin user, **I want** the system to block invalid Unit submissions, **so that** data quality is preserved.

**Priority:** Medium · **Test Type:** Validation

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG

**Steps**

1. สร้าง unit
2. เปิดแถวเพื่อแก้ไข
3. clear name กด Save
4. ลบ record

**Expected**

Error message ปรากฏใน dialog (validation block submit; dialog ไม่ปิด)

---


<sub>Last regenerated: 2026-11-24 · git f462816</sub>
