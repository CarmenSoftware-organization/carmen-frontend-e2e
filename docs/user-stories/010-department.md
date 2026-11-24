# Department — User Stories

_Generated from `tests/010-department.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Department
**Spec:** `tests/010-department.spec.ts`
**Default role:** Admin
**Total test cases:** 25 (12 High / 11 Medium / 1 Low / 1 unset)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-DEP-010001 | หน้า list โหลดสำเร็จ | High | Smoke |
| TC-DEP-010002 | ปุ่ม Add แสดง | High | Smoke |
| TC-DEP-010003 | ช่องค้นหาใช้งานได้ | Medium | Smoke |
| TC-DEP-010004 | ค้นหาคำที่ไม่มีต้องแสดง empty state | Medium | Functional |
| TC-DEP-010005 | active BU = BLAVG | High | Smoke |
| TC-DEP-010006 | ค้นหาด้วย code เจอรายการ | Medium | Functional |
| TC-DEP-030001 | chain — shares the TC-DEP-030001 record | — | — |
| TC-DEP-030002 | description สร้าง/แก้ไข + maxLength 256 | Medium | CRUD |
| TC-DEP-030003 | toggle is_active แล้ว persist | High | CRUD |
| TC-DEP-040001 | แก้ไขชื่อและบันทึก | High | CRUD |
| TC-DEP-040002 | แก้ไขแล้ว persist หลัง reload | High | Functional |
| TC-DEP-040003 | Cancel ขณะ form dirty ต้องเด้ง Discard dialog | Medium | Functional |
| TC-DEP-040004 | ย้ายสมาชิกออก/กลับเข้า department members แล้วบันทึกคงอยู่ | Medium | CRUD |
| TC-DEP-040005 | assign user เป็น Head of Department | Low | CRUD |
| TC-DEP-050001 | ลบรายการ | High | CRUD |
| TC-DEP-050002 | ยกเลิกการลบ record ต้องยังอยู่ | Medium | Functional |
| TC-DEP-100001 | XSS payload ในชื่อต้องไม่รัน script | High | Security |
| TC-DEP-100002 | SQL injection payload ต้องไม่ทำให้ระบบ crash | High | Security |
| TC-DEP-100003 | ชื่อยาวเกิน maxLength ต้องถูกจำกัดที่ 100 | Medium | Validation |
| TC-DEP-100004 _(skipped)_ | user สิทธิ์ต่ำเข้าหน้านี้ต้องไม่เห็นปุ่ม Add หรือถูก redirect | High | Authorization |
| TC-DEP-200001 | บันทึกโดยไม่กรอก code/name ต้องแสดง error | High | Validation |
| TC-DEP-200002 | แก้ไข: clear code/name แล้วบันทึก ต้องแสดง error | Medium | Validation |
| TC-DEP-200003 | code เกิน maxLength ต้องถูกจำกัดที่ 10 | Medium | Validation |
| TC-DEP-200004 | สร้าง code ซ้ำ ต้องถูก reject | High | Negative |
| TC-DEP-200005 | บันทึกโดยกรอก field เดียว ต้องถูก block | Medium | Validation |

---

## TC-DEP-010001 — หน้า list โหลดสำเร็จ

> **As a** Admin user, **I want** the Department list page to load successfully, **so that** I can manage Department records.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com ผ่าน auth fixture

**Steps**

1. ไปที่ /config/department

**Expected**

URL ตรงกับ /config/department; หน้า list โหลดสำเร็จและพร้อมใช้งาน

---

## TC-DEP-010002 — ปุ่ม Add แสดง

> **As a** Admin user, **I want** to see the Add button on the Department list, **so that** I can create new records.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; อยู่ที่ /config/department

**Steps**

1. ไปที่ /config/department
2. ตรวจสอบว่าปุ่ม Add ปรากฏ

**Expected**

ปุ่ม Add visible บนหน้า list (พร้อมเข้าสู่ flow create)

---

## TC-DEP-010003 — ช่องค้นหาใช้งานได้

> **As a** Admin user, **I want** to type into the Department search field, **so that** I can quickly locate existing records.

**Priority:** Medium · **Test Type:** Smoke

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; อยู่ที่ /config/department

**Steps**

1. ไปที่ /config/department
2. พิมพ์ 'test' ในช่องค้นหา

**Expected**

ช่องค้นหา visible และรับค่า input ได้โดยไม่ error

---

## TC-DEP-010004 — ค้นหาคำที่ไม่มีต้องแสดง empty state

> **As a** Admin user, **I want** a clear empty-state when no Department records match my search, **so that** I know nothing was found.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; อยู่ที่ /config/department

**Steps**

1. ไปที่ /config/department
2. ค้นหาด้วยคำที่ไม่มี (`__NOPE__<UID>`)

**Expected**

Empty-state placeholder ปรากฏภายใน 10s (ไม่มีแถวที่ตรงกับคำค้น)

---

## TC-DEP-010005 — active BU = BLAVG

> **As a** Admin user, **I want** core Department interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com ผ่าน auth fixture; beforeEach เรียก ensureActiveBu(BLAVG) แล้ว

**Steps**

1. อ่าน profile API (/api/proxy/api/user/profile)
2. หา business unit ที่ is_default
3. เปิดหน้าใดๆ ที่มี navbar แล้วอ่าน label ของ BU switcher

**Expected**

default business unit มี code === 'BLAVG'; trigger ของ BU switcher ใน navbar แสดง label ของ BU นั้น

---

## TC-DEP-010006 — ค้นหาด้วย code เจอรายการ

> **As a** Admin user, **I want** this Department interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG

**Steps**

1. สร้าง department ด้วย code+name ที่รู้ค่า
2. กลับ list แล้วค้นหาด้วย code
3. ลบ record

**Expected**

list แสดงแถวที่มี name ของ record เมื่อค้นด้วย code

---

## TC-DEP-030001 — chain — shares the TC-DEP-030001 record

> **As a** Admin user, **I want** this Department behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** _unset_ · **Test Type:** _unset_

**Preconditions**

_(none documented)_

**Steps**

_(no steps documented)_

**Expected**

_(no expected outcome documented)_

---

## TC-DEP-030002 — description สร้าง/แก้ไข + maxLength 256

> **As a** Admin user, **I want** to create a new Department record, **so that** it becomes available for downstream operations.

**Priority:** Medium · **Test Type:** CRUD

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG

**Steps**

1. สร้าง department พร้อม description
2. reload เช็คค่า description
3. ตรวจ maxLength: พิมพ์ description ยาว 300 ตัว
4. ลบ record

**Expected**

description ถูก persist หลัง reload; ช่อง description ถูกจำกัดที่ 256 ตัวอักษร

---

## TC-DEP-030003 — toggle is_active แล้ว persist

> **As a** Admin user, **I want** to manage Department records via CRUD, **so that** the data stays correct over time.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG

**Steps**

1. เปิด new form
2. ปิด switch is_active
3. กรอก code+name แล้ว Save
4. reload detail แล้วอ่านสถานะ switch

**Expected**

หลัง save+reload switch is_active = false (ค่าถูก persist)

---

## TC-DEP-040001 — แก้ไขชื่อและบันทึก

> **As a** Admin user, **I want** to edit an existing Department record, **so that** its data stays accurate.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; TC-DEP-030001 ผ่านแล้ว → record CODE/NAME มีอยู่ใน DB

**Steps**

1. ค้นหา NAME ใน list
2. คลิกแถวเพื่อเปิด detail
3. กดปุ่ม Edit
4. clear name และกรอก NAME_UPDATED
5. กด Save

**Expected**

Updated/success toast ปรากฏ (updated/success/สำเร็จ)

---

## TC-DEP-040002 — แก้ไขแล้ว persist หลัง reload

> **As a** Admin user, **I want** this Department interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG

**Steps**

1. สร้าง department (code+name)
2. เปิด detail กด Edit เปลี่ยน name เป็นค่าใหม่ แล้ว Save
3. reload หน้า detail
4. กลับ list ค้นหา name ใหม่และ name เดิม

**Expected**

หลัง reload ฟอร์มแสดง name ใหม่ (ค่าถูก persist จริง ไม่ใช่แค่ toast); list มีแถว name ใหม่ และไม่พบ name เดิม

---

## TC-DEP-040003 — Cancel ขณะ form dirty ต้องเด้ง Discard dialog

> **As a** Admin user, **I want** this Department interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG; มี record อยู่

**Steps**

1. สร้าง record
2. เปิด detail กด Edit เปลี่ยน name (form dirty)
3. กด Cancel
4. ยืนยัน Discard
5. reload เช็ค name เดิม

**Expected**

Discard dialog ปรากฏ; หลังยืนยันกลับ view mode และ name ยังเป็นค่าเดิม (ไม่ถูกบันทึก)

---

## TC-DEP-040004 — ย้ายสมาชิกออก/กลับเข้า department members แล้วบันทึกคงอยู่

> **As a** Admin user, **I want** to manage Department records via CRUD, **so that** the data stays correct over time.

**Priority:** Medium · **Test Type:** CRUD

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; BU BU-GR2VYNKQ; department แรกในรายการ (data:reset) มีสมาชิกครบทุก user

**Steps**

1. เปิด department แรกจาก list แล้วกด Edit
2. ย้ายสมาชิกคนแรกจาก Department Members กลับไป Available Users
3. Save แล้ว reload เปิด Edit ดูว่ามี user ใน Available
4. ย้าย user กลับเข้า Department Members แล้ว Save (คืนค่าเดิม)

**Expected**

การย้ายสมาชิกถูกบันทึกจริง (user ปรากฏใน Available หลัง reload) และย้ายกลับแล้ว Available กลับเป็นว่างเหมือนเดิม

---

## TC-DEP-040005 — assign user เป็น Head of Department

> **As a** Admin user, **I want** to manage Department records via CRUD, **so that** the data stays correct over time.

**Priority:** Low · **Test Type:** CRUD

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; BU BU-GR2VYNKQ; department แรกในรายการ (data:reset) มีสมาชิกครบทุก user

**Steps**

1. เปิด department แรกจาก list แล้วกด Edit
2. ใน section 'Head of Department' เลือก user ตัวแรกแล้วย้ายไปขวา
3. Save
4. reload เช็คว่า user ปรากฏใน HOD
5. เปิด Edit ย้าย user กลับออกแล้ว Save (คืนค่าเดิม)

**Expected**

user ที่ถูก assign แสดงใน section HOD หลัง reload และคืนค่าเดิมได้

---

## TC-DEP-050001 — ลบรายการ

> **As a** Admin user, **I want** to delete a Department record, **so that** the list reflects only valid entries.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

TC-DEP-200002 ผ่านแล้ว → record NAME_UPDATED ยังคงมีอยู่ใน DB

**Steps**

1. ค้นหา NAME_UPDATED ใน list
2. เปิด detail
3. กด Edit
4. กด Delete
5. ยืนยัน Delete

**Expected**

Deleted/success toast ปรากฏ (deleted/success/สำเร็จ)

---

## TC-DEP-050002 — ยกเลิกการลบ record ต้องยังอยู่

> **As a** Admin user, **I want** this Department interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG; มี record อยู่

**Steps**

1. สร้าง record
2. เปิด detail กด Edit แล้วกด Delete
3. ใน dialog กด Cancel
4. กลับ list ค้นหา record

**Expected**

Delete dialog ปิดโดยไม่ลบ; record ยังปรากฏใน list

---

## TC-DEP-100001 — XSS payload ในชื่อต้องไม่รัน script

> **As the** system, **I want** XSS payloads in Department inputs to be neutralized, **so that** no script executes in users' browsers.

**Priority:** High · **Test Type:** Security

**Preconditions**

Logged in user with permission to access /config/department; XSS dialog guard attached

**Steps**

1. เปิด new form ของ /config/department
2. กรอก code ด้วย random suffix
3. กรอก name ด้วย XSS payload "<script>alert('xss-e2e')</script>"
4. กด Save

**Expected**

ไม่มี browser alert/dialog จาก payload; URL ยังคงอยู่ภายใต้ /config/ (ฟอร์มอาจ reject หรือ save แบบ escaped)

---

## TC-DEP-100002 — SQL injection payload ต้องไม่ทำให้ระบบ crash

> **As the** system, **I want** SQL-injection payloads in Department fields to be safely handled, **so that** the database remains intact.

**Priority:** High · **Test Type:** Security

**Preconditions**

Logged in user with permission to access /config/department

**Steps**

1. เปิด list /config/department
2. พิมพ์ SQL injection payload "'; DROP TABLE users; --" ลงในช่องค้นหา

**Expected**

หน้าไม่ crash; ปุ่ม Add ยังคง visible (list ทำงานปกติ)

---

## TC-DEP-100003 — ชื่อยาวเกิน maxLength ต้องถูกจำกัดที่ 100

> **As a** Admin user, **I want** the system to block invalid Department submissions, **so that** data quality is preserved.

**Priority:** Medium · **Test Type:** Validation

**Preconditions**

Logged in user with permission to access /config/department

**Steps**

1. เปิด new form ของ /config/department
2. กรอก name ด้วย string ยาว 200 ตัวอักษร ('a' x 200)

**Expected**

ค่าใน input ถูก clamp ที่ ≤ 100 ตัวอักษร (maxLength enforced)

---

## TC-DEP-100004 — user สิทธิ์ต่ำเข้าหน้านี้ต้องไม่เห็นปุ่ม Add หรือถูก redirect _(skipped)_

> **As a** low-privilege user, **I should NOT** see Add/edit controls on Department, **so that** role separation is enforced.

**Priority:** High · **Test Type:** Authorization

**Preconditions**

Test user requestor@blueledgers.com (low-privilege role) มีอยู่จริง; module list path = /config/department

**Steps**

1. เปิด browser context ใหม่
2. login เป็น requestor@blueledgers.com
3. ไปที่ /config/department

**Expected**

User ถูก redirect ออกจาก /config/department หรือ ปุ่ม Add ไม่ปรากฏ (count = 0)

---

## TC-DEP-200001 — บันทึกโดยไม่กรอก code/name ต้องแสดง error

> **As a** Admin user, **I want** the system to block invalid Department submissions, **so that** data quality is preserved.

**Priority:** High · **Test Type:** Validation

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; อยู่ที่ /config/department/new

**Steps**

1. เปิดฟอร์ม new
2. กด Save โดยไม่กรอก code/name (รวมถึง parent ถ้ามี)

**Expected**

URL ยังคงอยู่ที่ /new (ฟอร์ม block submit ด้วย client-side validation)

---

## TC-DEP-200002 — แก้ไข: clear code/name แล้วบันทึก ต้องแสดง error

> **As a** Admin user, **I want** the system to block invalid Department submissions, **so that** data quality is preserved.

**Priority:** Medium · **Test Type:** Validation

**Preconditions**

TC-DEP-040001 ผ่านแล้ว → record มี name = NAME_UPDATED

**Steps**

1. ค้นหา NAME_UPDATED ใน list
2. เปิด detail
3. กด Edit
4. clear code + name
5. กด Save

**Expected**

Save button ยังคง visible (form ไม่ submit; ยังอยู่ใน edit mode)

---

## TC-DEP-200003 — code เกิน maxLength ต้องถูกจำกัดที่ 10

> **As a** Admin user, **I want** the system to block invalid Department submissions, **so that** data quality is preserved.

**Priority:** Medium · **Test Type:** Validation

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; อยู่ที่ /config/department/new

**Steps**

1. เปิด new form
2. พิมพ์ code ยาว 15 ตัวอักษร

**Expected**

ค่าใน input ถูกตัดที่ 10 ตัวอักษร (maxLength=10)

---

## TC-DEP-200004 — สร้าง code ซ้ำ ต้องถูก reject

> **As a** Admin user, **I want** this Department behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG

**Steps**

1. สร้าง department ด้วย code X
2. สร้างอีกรายการด้วย code X เดิม (name ต่าง)
3. กด Save

**Expected**

รายการที่สองไม่ถูกสร้าง: ยังอยู่ที่ฟอร์ม /new (ไม่ navigate ไป detail) — backend reject code ซ้ำ

---

## TC-DEP-200005 — บันทึกโดยกรอก field เดียว ต้องถูก block

> **As a** Admin user, **I want** the system to block invalid Department submissions, **so that** data quality is preserved.

**Priority:** Medium · **Test Type:** Validation

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; อยู่ที่ /config/department/new

**Steps**

1. เปิด new form กรอกเฉพาะ name (code ว่าง) กด Save
2. เปิด new form ใหม่ กรอกเฉพาะ code (name ว่าง) กด Save

**Expected**

ทั้งสองกรณีฟอร์ม block submit: ยังอยู่ที่ /new

---


<sub>Last regenerated: 2026-11-24 · git f462816</sub>
