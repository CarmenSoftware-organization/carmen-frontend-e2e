# Tax Profile — User Stories

_Generated from `tests/042-tax-profile.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Tax Profile
**Spec:** `tests/042-tax-profile.spec.ts`
**Default role:** Admin
**Total test cases:** 19 (12 High / 7 Medium / 0 Low)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-TP-010001 | หน้า list โหลดสำเร็จ | High | Smoke |
| TC-TP-010002 | ปุ่ม Add แสดง | High | Smoke |
| TC-TP-010003 | ช่องค้นหาใช้งานได้ | Medium | Smoke |
| TC-TP-010004 | ค้นหาคำที่ไม่มีต้องแสดง empty state | Medium | Functional |
| TC-TP-010005 | active BU = BLAVG | High | Smoke |
| TC-TP-030001 | สร้างรายการใหม่และปรากฏในตาราง | High | CRUD |
| TC-TP-040001 | แก้ไขชื่อและบันทึก | High | CRUD |
| TC-TP-040002 | toggle is_active แล้ว persist | Medium | CRUD |
| TC-TP-040003 | แก้ไขชื่อแล้ว persist | High | CRUD |
| TC-TP-040004 | ยกเลิกการแก้ไข ค่าต้องไม่ถูกบันทึก | Medium | Functional |
| TC-TP-050001 | ลบรายการ | High | CRUD |
| TC-TP-050002 | ยกเลิกการลบ record ต้องยังอยู่ | Medium | Functional |
| TC-TP-100001 | XSS payload ในชื่อต้องไม่รัน script | High | Security |
| TC-TP-100002 | SQL injection payload ต้องไม่ทำให้ระบบ crash | High | Security |
| TC-TP-100003 | ชื่อยาวเกิน maxLength ต้องถูกจำกัดที่ 100 | Medium | Validation |
| TC-TP-100004 _(skipped)_ | user สิทธิ์ต่ำเข้าหน้านี้ต้องไม่เห็นปุ่ม Add หรือถูก redirect | High | Authorization |
| TC-TP-200001 | บันทึกโดยไม่กรอกชื่อต้องแสดง error | High | Validation |
| TC-TP-200002 | แก้ไข: clear name แล้วบันทึก ต้องแสดง error | Medium | Validation |
| TC-TP-200003 | สร้าง name ซ้ำ ต้องถูก reject | High | Negative |

---

## TC-TP-010001 — หน้า list โหลดสำเร็จ

> **As a** Admin user, **I want** the Tax Profile list page to load successfully, **so that** I can manage Tax Profile records.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com ผ่าน auth fixture

**Steps**

1. ไปที่ /config/tax-profile

**Expected**

URL matches /config/tax-profile; หน้า list ของ tax profile (มี name + rate columns) โหลดสำเร็จ

---

## TC-TP-010002 — ปุ่ม Add แสดง

> **As a** Admin user, **I want** to see the Add button on the Tax Profile list, **so that** I can create new records.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; อยู่ที่ /config/tax-profile

**Steps**

1. ไปที่ /config/tax-profile

**Expected**

ปุ่ม Add visible บนหน้า list (พร้อมเปิด dialog สำหรับ name + rate)

---

## TC-TP-010003 — ช่องค้นหาใช้งานได้

> **As a** Admin user, **I want** to type into the Tax Profile search field, **so that** I can quickly locate existing records.

**Priority:** Medium · **Test Type:** Smoke

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; อยู่ที่ /config/tax-profile

**Steps**

1. ไปที่ /config/tax-profile
2. พิมพ์ 'test' ในช่องค้นหา

**Expected**

ช่องค้นหา visible และรับค่า input ได้โดยไม่ error

---

## TC-TP-010004 — ค้นหาคำที่ไม่มีต้องแสดง empty state

> **As a** Admin user, **I want** a clear empty-state when no Tax Profile records match my search, **so that** I know nothing was found.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; อยู่ที่ /config/tax-profile

**Steps**

1. ไปที่ /config/tax-profile
2. ค้นหาด้วยคำที่ไม่มี (`__NOPE__<UID>`)

**Expected**

Empty-state placeholder ปรากฏภายใน 10s (ไม่มี tax profile ที่ตรงกับคำค้น)

---

## TC-TP-010005 — active BU = BLAVG

> **As a** Admin user, **I want** core Tax Profile interactions to work, **so that** day-to-day usage stays smooth.

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

## TC-TP-030001 — สร้างรายการใหม่และปรากฏในตาราง

> **As a** Admin user, **I want** to create a new Tax Profile record, **so that** it becomes available for downstream operations.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; tax profile ชื่อ NAME ยังไม่มีอยู่ใน DB

**Steps**

1. เปิด Add dialog
2. กรอก name = NAME (rate ใช้ค่า default ของฟอร์ม)
3. กด Save
4. ค้นหา NAME ใน list

**Expected**

Success toast (created/success/สำเร็จ) และแถวใหม่ที่มี NAME ปรากฏใน list

---

## TC-TP-040001 — แก้ไขชื่อและบันทึก

> **As a** Admin user, **I want** to edit an existing Tax Profile record, **so that** its data stays accurate.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

TC-TP-030001 ผ่านแล้ว → tax profile ชื่อ NAME มีอยู่ใน DB

**Steps**

1. ค้นหา NAME ใน list
2. คลิกแถวเพื่อเปิด edit dialog
3. clear name + กรอก NAME_UPDATED (ไม่แก้ rate)
4. กด Save

**Expected**

Updated/success toast ปรากฏ และแถว NAME_UPDATED ปรากฏใน list (rate คงเดิม)

---

## TC-TP-040002 — toggle is_active แล้ว persist

> **As a** Admin user, **I want** to manage Tax Profile records via CRUD, **so that** the data stays correct over time.

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

## TC-TP-040003 — แก้ไขชื่อแล้ว persist

> **As a** Admin user, **I want** to edit an existing Tax Profile record, **so that** its data stays accurate.

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

## TC-TP-040004 — ยกเลิกการแก้ไข ค่าต้องไม่ถูกบันทึก

> **As a** Admin user, **I want** this Tax Profile interaction to behave as expected, **so that** the workflow stays predictable.

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

## TC-TP-050001 — ลบรายการ

> **As a** Admin user, **I want** to delete a Tax Profile record, **so that** the list reflects only valid entries.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

TC-TP-200002 ผ่านแล้ว → tax profile ชื่อ NAME_UPDATED ยังคงมีอยู่ใน DB

**Steps**

1. ค้นหา NAME_UPDATED ใน list
2. กด delete บนแถว
3. ยืนยัน Delete

**Expected**

Deleted/success toast ปรากฏ (deleted/success/สำเร็จ) และ tax profile ถูกลบจาก DB

---

## TC-TP-050002 — ยกเลิกการลบ record ต้องยังอยู่

> **As a** Admin user, **I want** this Tax Profile interaction to behave as expected, **so that** the workflow stays predictable.

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

## TC-TP-100001 — XSS payload ในชื่อต้องไม่รัน script

> **As the** system, **I want** XSS payloads in Tax Profile inputs to be neutralized, **so that** no script executes in users' browsers.

**Priority:** High · **Test Type:** Security

**Preconditions**

Logged in user with permission to access /config/tax-profile; XSS dialog guard attached

**Steps**

1. เปิด list /config/tax-profile
2. คลิก Add เพื่อเปิด dialog
3. กรอก name ด้วย XSS payload "<script>alert('xss-e2e')</script>"
4. กด Save

**Expected**

ไม่มี browser alert/dialog จาก payload (script ไม่ถูก execute); หาก dialog ยังเปิดอยู่ก็ปิดได้ปกติ

---

## TC-TP-100002 — SQL injection payload ต้องไม่ทำให้ระบบ crash

> **As the** system, **I want** SQL-injection payloads in Tax Profile fields to be safely handled, **so that** the database remains intact.

**Priority:** High · **Test Type:** Security

**Preconditions**

Logged in user with permission to access /config/tax-profile

**Steps**

1. เปิด list /config/tax-profile
2. พิมพ์ SQL injection payload "'; DROP TABLE users; --" ลงในช่องค้นหา

**Expected**

หน้าไม่ crash; ปุ่ม Add ยังคง visible (list ทำงานปกติ)

---

## TC-TP-100003 — ชื่อยาวเกิน maxLength ต้องถูกจำกัดที่ 100

> **As a** Admin user, **I want** the system to block invalid Tax Profile submissions, **so that** data quality is preserved.

**Priority:** Medium · **Test Type:** Validation

**Preconditions**

Logged in user with permission to access /config/tax-profile

**Steps**

1. เปิด list /config/tax-profile
2. คลิก Add เพื่อเปิด dialog
3. กรอก name ด้วย string ยาว 200 ตัวอักษร ('a' x 200)

**Expected**

ค่าใน input ถูก clamp ที่ ≤ 100 ตัวอักษร (maxLength enforced)

---

## TC-TP-100004 — user สิทธิ์ต่ำเข้าหน้านี้ต้องไม่เห็นปุ่ม Add หรือถูก redirect _(skipped)_

> **As a** low-privilege user, **I should NOT** see Add/edit controls on Tax Profile, **so that** role separation is enforced.

**Priority:** High · **Test Type:** Authorization

**Preconditions**

Test user requestor@blueledgers.com (low-privilege role) มีอยู่จริง; module list path = /config/tax-profile

**Steps**

1. เปิด browser context ใหม่
2. login เป็น requestor@blueledgers.com
3. ไปที่ /config/tax-profile

**Expected**

User ถูก redirect ออกจาก /config/tax-profile หรือ ปุ่ม Add ไม่ปรากฏ (count = 0)

---

## TC-TP-200001 — บันทึกโดยไม่กรอกชื่อต้องแสดง error

> **As a** Admin user, **I want** the system to block invalid Tax Profile submissions, **so that** data quality is preserved.

**Priority:** High · **Test Type:** Validation

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; อยู่ที่ /config/tax-profile

**Steps**

1. เปิด Add dialog
2. กด Save โดยไม่กรอก name (rate ปล่อยตามค่า default)

**Expected**

Error message ปรากฏใต้ name input (required validation block submit); ปิด dialog ด้วย Cancel

---

## TC-TP-200002 — แก้ไข: clear name แล้วบันทึก ต้องแสดง error

> **As a** Admin user, **I want** the system to block invalid Tax Profile submissions, **so that** data quality is preserved.

**Priority:** Medium · **Test Type:** Validation

**Preconditions**

TC-TP-040001 ผ่านแล้ว → tax profile ชื่อ NAME_UPDATED มีอยู่ใน DB

**Steps**

1. ค้นหา NAME_UPDATED ใน list
2. เปิด edit dialog
3. clear name (rate ไม่แตะ)
4. กด Save

**Expected**

Error message ปรากฏใต้ name input (required validation block submit); ปิด dialog ด้วย Cancel

---

## TC-TP-200003 — สร้าง name ซ้ำ ต้องถูก reject

> **As a** Admin user, **I want** this Tax Profile behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG

**Steps**

1. สร้าง record ด้วย name X
2. เปิด Add dialog กรอก name X เดิม กด Save

**Expected**

รายการที่สองไม่ถูกสร้าง: dialog ยังเปิดอยู่ (backend reject name ซ้ำ)

---


<sub>Last regenerated: 2026-11-24 · git f462816</sub>
