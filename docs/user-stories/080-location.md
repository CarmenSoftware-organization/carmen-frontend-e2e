# Location — User Stories

_Generated from `tests/080-location.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Location
**Spec:** `tests/080-location.spec.ts`
**Default role:** Admin
**Total test cases:** 21 (12 High / 9 Medium / 0 Low)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-LOC-010001 | หน้า list โหลดสำเร็จ | High | Smoke |
| TC-LOC-010002 | ปุ่ม Add แสดง | High | Smoke |
| TC-LOC-010003 | ช่องค้นหาใช้งานได้ | Medium | Smoke |
| TC-LOC-010004 | ค้นหาคำที่ไม่มีต้องแสดง empty state | Medium | Functional |
| TC-LOC-010005 | active BU = BLAVG | High | Smoke |
| TC-LOC-030001 | สร้างรายการใหม่และปรากฏในตาราง | High | CRUD |
| TC-LOC-030002 | สร้าง location_type = Direct และลบ | Medium | CRUD |
| TC-LOC-030003 | สร้าง location_type = Consignment และลบ | Medium | CRUD |
| TC-LOC-040001 | แก้ไขชื่อและบันทึก | High | CRUD |
| TC-LOC-040002 | toggle is_active แล้ว persist | Medium | CRUD |
| TC-LOC-040003 | แก้ไขชื่อแล้ว persist | High | CRUD |
| TC-LOC-040004 | ยกเลิกการแก้ไข ค่าต้องไม่ถูกบันทึก | Medium | Functional |
| TC-LOC-050001 | ลบรายการ | High | CRUD |
| TC-LOC-050002 | ยกเลิกการลบ record ต้องยังอยู่ | Medium | Functional |
| TC-LOC-100001 | XSS payload ในชื่อต้องไม่รัน script | High | Security |
| TC-LOC-100002 | SQL injection payload ต้องไม่ทำให้ระบบ crash | High | Security |
| TC-LOC-100003 | ชื่อยาวเกิน maxLength ต้องถูกจำกัดที่ 100 | Medium | Validation |
| TC-LOC-100004 _(skipped)_ | user สิทธิ์ต่ำเข้าหน้านี้ต้องไม่เห็นปุ่ม Add หรือถูก redirect | High | Authorization |
| TC-LOC-200001 | บันทึกโดยไม่กรอก code/name ต้องแสดง error | High | Validation |
| TC-LOC-200002 | แก้ไข: clear code/name แล้วบันทึก ต้องแสดง error | Medium | Validation |
| TC-LOC-200003 | สร้าง code ซ้ำ ต้องถูก reject | High | Negative |

---

## TC-LOC-010001 — หน้า list โหลดสำเร็จ

> **As a** Admin user, **I want** the Location list page to load successfully, **so that** I can manage Location records.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com ผ่าน auth fixture

**Steps**

1. ไปที่ /config/location

**Expected**

URL matches /config/location; หน้า list render สำเร็จโดยไม่มี error

---

## TC-LOC-010002 — ปุ่ม Add แสดง

> **As a** Admin user, **I want** to see the Add button on the Location list, **so that** I can create new records.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; on /config/location

**Steps**

1. ไปที่ /config/location

**Expected**

ปุ่ม Add visible บนหน้า list

---

## TC-LOC-010003 — ช่องค้นหาใช้งานได้

> **As a** Admin user, **I want** to type into the Location search field, **so that** I can quickly locate existing records.

**Priority:** Medium · **Test Type:** Smoke

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; on /config/location

**Steps**

1. ไปที่ /config/location
2. พิมพ์ 'test' ในช่องค้นหา

**Expected**

ช่องค้นหา visible และรับค่า input ได้โดยไม่ error

---

## TC-LOC-010004 — ค้นหาคำที่ไม่มีต้องแสดง empty state

> **As a** Admin user, **I want** a clear empty-state when no Location records match my search, **so that** I know nothing was found.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; on /config/location

**Steps**

1. ไปที่ /config/location
2. ค้นหาด้วยคำที่ไม่มี (`__NOPE__<UID>`)

**Expected**

Empty-state placeholder ปรากฏภายใน 10s (ไม่มีแถวที่ตรงกับคำค้น)

---

## TC-LOC-010005 — active BU = BLAVG

> **As a** Admin user, **I want** core Location interactions to work, **so that** day-to-day usage stays smooth.

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

## TC-LOC-030001 — สร้างรายการใหม่และปรากฏในตาราง

> **As a** Admin user, **I want** to create a new Location record, **so that** it becomes available for downstream operations.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; record CODE/NAME ยังไม่มีอยู่ใน DB

**Steps**

1. เปิด new form
2. กรอก code + name
3. เลือก Location Type = Inventory
4. เลือก Physical Count = Yes
5. เปิด dialog Select Delivery Point และเลือกตัวเลือกแรก
6. กด Save
7. กลับ list และค้นหาด้วย NAME

**Expected**

Success toast (created/success/สำเร็จ); แถวใหม่ที่มี NAME ปรากฏใน list

---

## TC-LOC-030002 — สร้าง location_type = Direct และลบ

> **As a** Admin user, **I want** to create a new Location record, **so that** it becomes available for downstream operations.

**Priority:** Medium · **Test Type:** CRUD

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; record CODE_DIRECT/NAME_DIRECT ยังไม่มีอยู่ใน DB

**Steps**

1. เปิด new form
2. กรอก code_direct + name_direct
3. เลือก Location Type = Direct
4. เลือก Physical Count = Yes
5. เลือก Delivery Point
6. กด Save
7. กลับ list ค้นหา NAME_DIRECT
8. เปิด detail → Edit → Delete → ยืนยัน

**Expected**

Created toast → แถวปรากฏใน list → Deleted toast หลังลบ (วงจร CRUD ครบสำหรับ type Direct)

---

## TC-LOC-030003 — สร้าง location_type = Consignment และลบ

> **As a** Admin user, **I want** to create a new Location record, **so that** it becomes available for downstream operations.

**Priority:** Medium · **Test Type:** CRUD

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; record CODE_CONSIGN/NAME_CONSIGN ยังไม่มีอยู่ใน DB

**Steps**

1. เปิด new form
2. กรอก code_consign + name_consign
3. เลือก Location Type = Consignment
4. เลือก Physical Count = Yes
5. เลือก Delivery Point
6. กด Save
7. กลับ list ค้นหา NAME_CONSIGN
8. เปิด detail → Edit → Delete → ยืนยัน

**Expected**

Created toast → แถวปรากฏใน list → Deleted toast หลังลบ (วงจร CRUD ครบสำหรับ type Consignment)

---

## TC-LOC-040001 — แก้ไขชื่อและบันทึก

> **As a** Admin user, **I want** to edit an existing Location record, **so that** its data stays accurate.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

TC-LOC-030001 ผ่านแล้ว → record CODE/NAME มีอยู่ใน DB

**Steps**

1. ค้นหา NAME ใน list
2. คลิกแถวเพื่อเปิด detail
3. กด Edit
4. clear name แล้วใส่ NAME_UPDATED
5. กด Save

**Expected**

Updated/success toast ปรากฏ (updated/success/สำเร็จ)

---

## TC-LOC-040002 — toggle is_active แล้ว persist

> **As a** Admin user, **I want** to manage Location records via CRUD, **so that** the data stays correct over time.

**Priority:** Medium · **Test Type:** CRUD

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG; มี delivery point อย่างน้อย 1 รายการใน BLAVG

**Steps**

1. สร้าง location ผ่าน new form โดยปิด switch is_active
2. กลับ list ค้นหา name แล้วเปิด detail
3. อ่านสถานะ switch is_active
4. ลบ record (cleanup)

**Expected**

หลังเปิด detail ใหม่ switch is_active มี aria-checked = false (ค่าถูก persist)

---

## TC-LOC-040003 — แก้ไขชื่อแล้ว persist

> **As a** Admin user, **I want** to edit an existing Location record, **so that** its data stays accurate.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG; มี delivery point อย่างน้อย 1 รายการใน BLAVG

**Steps**

1. สร้าง location ผ่าน new form
2. เปิด detail จาก list กด Edit แก้ name แล้ว Save
3. กลับ list ค้นหา name ใหม่ เปิด detail ยืนยันค่า
4. ลบ record (cleanup)

**Expected**

Updated/success toast; หลังเปิด detail ใหม่ nameInput มีค่าเป็น name ที่แก้ไข (ค่าถูก persist จริง)

---

## TC-LOC-040004 — ยกเลิกการแก้ไข ค่าต้องไม่ถูกบันทึก

> **As a** Admin user, **I want** this Location interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG; มี delivery point อย่างน้อย 1 รายการใน BLAVG

**Steps**

1. สร้าง location ผ่าน new form
2. เปิด detail กด Edit แก้ name เป็นค่าใหม่
3. กด Cancel
4. เปิด detail เดิมอีกครั้งเช็ค name
5. ลบ record (cleanup)

**Expected**

หลัง Cancel แล้วเปิดใหม่ nameInput ยังเป็นค่าเดิม (การแก้ไขไม่ถูกบันทึก)

---

## TC-LOC-050001 — ลบรายการ

> **As a** Admin user, **I want** to delete a Location record, **so that** the list reflects only valid entries.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

TC-LOC-200002 ผ่านแล้ว → record NAME_UPDATED ยังคงมีอยู่ใน DB

**Steps**

1. ค้นหา NAME_UPDATED ใน list
2. เปิด detail
3. กด Edit
4. กด Delete
5. ยืนยัน Delete

**Expected**

Deleted/success toast ปรากฏ (deleted/success/สำเร็จ)

---

## TC-LOC-050002 — ยกเลิกการลบ record ต้องยังอยู่

> **As a** Admin user, **I want** this Location interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG; มี delivery point อย่างน้อย 1 รายการใน BLAVG

**Steps**

1. สร้าง location ผ่าน new form
2. เปิด detail กด Edit กด Delete
3. ใน confirm dialog กด Cancel
4. กลับ list ค้นหายืนยัน record ยังอยู่
5. ลบ record (cleanup)

**Expected**

Confirm dialog ปิดโดยไม่ลบ; record ยังปรากฏใน list

---

## TC-LOC-100001 — XSS payload ในชื่อต้องไม่รัน script

> **As the** system, **I want** XSS payloads in Location inputs to be neutralized, **so that** no script executes in users' browsers.

**Priority:** High · **Test Type:** Security

**Preconditions**

Logged in user with permission to access /config/location; XSS dialog guard attached

**Steps**

1. เปิด new form ของ /config/location
2. กรอก code ด้วย random suffix
3. กรอก name ด้วย XSS payload "<script>alert('xss-e2e')</script>"
4. กด Save

**Expected**

ไม่มี browser alert/dialog จาก payload; URL ยังคงอยู่ภายใต้ /config/ (ฟอร์มอาจ reject หรือ save แบบ escaped)

---

## TC-LOC-100002 — SQL injection payload ต้องไม่ทำให้ระบบ crash

> **As the** system, **I want** SQL-injection payloads in Location fields to be safely handled, **so that** the database remains intact.

**Priority:** High · **Test Type:** Security

**Preconditions**

Logged in user with permission to access /config/location

**Steps**

1. เปิด list /config/location
2. พิมพ์ SQL injection payload "'; DROP TABLE users; --" ลงในช่องค้นหา

**Expected**

หน้าไม่ crash; ปุ่ม Add ยังคง visible (list ทำงานปกติ)

---

## TC-LOC-100003 — ชื่อยาวเกิน maxLength ต้องถูกจำกัดที่ 100

> **As a** Admin user, **I want** the system to block invalid Location submissions, **so that** data quality is preserved.

**Priority:** Medium · **Test Type:** Validation

**Preconditions**

Logged in user with permission to access /config/location

**Steps**

1. เปิด new form ของ /config/location
2. กรอก name ด้วย string ยาว 200 ตัวอักษร ('a' x 200)

**Expected**

ค่าใน input ถูก clamp ที่ ≤ 100 ตัวอักษร (maxLength enforced)

---

## TC-LOC-100004 — user สิทธิ์ต่ำเข้าหน้านี้ต้องไม่เห็นปุ่ม Add หรือถูก redirect _(skipped)_

> **As a** low-privilege user, **I should NOT** see Add/edit controls on Location, **so that** role separation is enforced.

**Priority:** High · **Test Type:** Authorization

**Preconditions**

Test user requestor@blueledgers.com (low-privilege role) มีอยู่จริง; module list path = /config/location

**Steps**

1. เปิด browser context ใหม่
2. login เป็น requestor@blueledgers.com
3. ไปที่ /config/location

**Expected**

User ถูก redirect ออกจาก /config/location หรือ ปุ่ม Add ไม่ปรากฏ (count = 0)

---

## TC-LOC-200001 — บันทึกโดยไม่กรอก code/name ต้องแสดง error

> **As a** Admin user, **I want** the system to block invalid Location submissions, **so that** data quality is preserved.

**Priority:** High · **Test Type:** Validation

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; on /config/location/new

**Steps**

1. เปิดฟอร์ม new
2. กด Save โดยไม่กรอก code/name

**Expected**

URL ยังคงอยู่ที่ /new (ฟอร์ม block submit ด้วย client-side validation)

---

## TC-LOC-200002 — แก้ไข: clear code/name แล้วบันทึก ต้องแสดง error

> **As a** Admin user, **I want** the system to block invalid Location submissions, **so that** data quality is preserved.

**Priority:** Medium · **Test Type:** Validation

**Preconditions**

TC-LOC-040001 ผ่านแล้ว → record มี name = NAME_UPDATED

**Steps**

1. ค้นหา NAME_UPDATED ใน list
2. เปิด detail
3. กด Edit
4. clear code + name
5. กด Save

**Expected**

Save button ยังคง visible (form ไม่ submit; ยังอยู่ใน edit mode)

---

## TC-LOC-200003 — สร้าง code ซ้ำ ต้องถูก reject

> **As a** Admin user, **I want** this Location behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG; มี delivery point อย่างน้อย 1 รายการใน BLAVG

**Steps**

1. สร้าง location ด้วย code X
2. เปิด new form อีกครั้งกรอก code X เดิม (name ต่าง) กด Save

**Expected**

รายการที่สองไม่ถูกสร้าง: URL ยังคงอยู่ที่ /new (backend reject code ซ้ำ)

---


<sub>Last regenerated: 2026-11-24 · git f462816</sub>
