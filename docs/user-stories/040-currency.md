# Currency — User Stories

_Generated from `tests/040-currency.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Currency
**Spec:** `tests/040-currency.spec.ts`
**Default role:** Admin
**Total test cases:** 19 (12 High / 7 Medium / 0 Low)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-CUR-010001 | หน้า list โหลดสำเร็จ | High | Smoke |
| TC-CUR-010002 | ปุ่ม Add แสดง | High | Smoke |
| TC-CUR-010003 | ช่องค้นหาใช้งานได้ | Medium | Smoke |
| TC-CUR-010004 | ค้นหาคำที่ไม่มีต้องแสดง empty state | Medium | Functional |
| TC-CUR-010005 | active BU = BLAVG | High | Smoke |
| TC-CUR-030001 | สร้างรายการใหม่และปรากฏในตาราง | High | CRUD |
| TC-CUR-040001 | แก้ไขชื่อและบันทึก | High | CRUD |
| TC-CUR-040002 | toggle is_active แล้ว persist | Medium | CRUD |
| TC-CUR-040003 | แก้ไขชื่อแล้ว persist | High | CRUD |
| TC-CUR-040004 | ยกเลิกการแก้ไข ค่าต้องไม่ถูกบันทึก | Medium | Functional |
| TC-CUR-050001 | ลบรายการ | High | CRUD |
| TC-CUR-050002 | ยกเลิกการลบ record ต้องยังอยู่ | Medium | Functional |
| TC-CUR-100001 | XSS payload ในชื่อต้องไม่รัน script | High | Security |
| TC-CUR-100002 | SQL injection payload ต้องไม่ทำให้ระบบ crash | High | Security |
| TC-CUR-100003 | ชื่อยาวเกิน maxLength ต้องถูกจำกัดที่ 100 | Medium | Validation |
| TC-CUR-100004 _(skipped)_ | user สิทธิ์ต่ำเข้าหน้านี้ต้องไม่เห็นปุ่ม Add หรือถูก redirect | High | Authorization |
| TC-CUR-200001 | บันทึกโดยไม่กรอกชื่อต้องแสดง error | High | Validation |
| TC-CUR-200002 | แก้ไข: clear name แล้วบันทึก ต้องแสดง error | Medium | Validation |
| TC-CUR-200003 | สร้าง name ซ้ำ ต้องถูก reject | High | Negative |

---

## TC-CUR-010001 — หน้า list โหลดสำเร็จ

> **As a** Admin user, **I want** the Currency list page to load successfully, **so that** I can manage Currency records.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com ผ่าน auth fixture

**Steps**

1. ไปที่ /config/currency

**Expected**

URL matches /config/currency; ปุ่ม Add และช่องค้นหา visible ภายใน 10s

---

## TC-CUR-010002 — ปุ่ม Add แสดง

> **As a** Admin user, **I want** to see the Add button on the Currency list, **so that** I can create new records.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; อยู่ที่ /config/currency

**Steps**

1. ไปที่ /config/currency

**Expected**

ปุ่ม Add visible บนหน้า list

---

## TC-CUR-010003 — ช่องค้นหาใช้งานได้

> **As a** Admin user, **I want** to type into the Currency search field, **so that** I can quickly locate existing records.

**Priority:** Medium · **Test Type:** Smoke

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; อยู่ที่ /config/currency

**Steps**

1. ไปที่ /config/currency
2. พิมพ์ 'test' ในช่องค้นหา

**Expected**

ช่องค้นหา visible และรับค่า input ได้โดยไม่ error

---

## TC-CUR-010004 — ค้นหาคำที่ไม่มีต้องแสดง empty state

> **As a** Admin user, **I want** a clear empty-state when no Currency records match my search, **so that** I know nothing was found.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; อยู่ที่ /config/currency

**Steps**

1. ไปที่ /config/currency
2. ค้นหาด้วยคำที่ไม่มี (`__NOPE__<UID>`)

**Expected**

Empty-state placeholder ปรากฏภายใน 10s (ไม่มีแถวที่ตรงกับคำค้น)

---

## TC-CUR-010005 — active BU = BLAVG

> **As a** Admin user, **I want** core Currency interactions to work, **so that** day-to-day usage stays smooth.

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

## TC-CUR-030001 — สร้างรายการใหม่และปรากฏในตาราง

> **As a** Admin user, **I want** to create a new Currency record, **so that** it becomes available for downstream operations.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; record NAME ยังไม่มีอยู่ใน DB; ISO code IDR เลือกได้จาก lookup

**Steps**

1. ไปที่ /config/currency
2. เปิด add dialog
3. คลิกปุ่ม LookupCurrencyIso แล้วค้นหา 'IDR'
4. เลือกแถว IDR (จะ auto-fill symbol และ exchange_rate)
5. กรอก name = NAME
6. กด Save
7. ค้นหา NAME ใน list

**Expected**

Success toast (created/success/สำเร็จ); แถวใหม่ที่มี Name = NAME ปรากฏใน list ภายใน 10s

---

## TC-CUR-040001 — แก้ไขชื่อและบันทึก

> **As a** Admin user, **I want** to edit an existing Currency record, **so that** its data stays accurate.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

TC-CUR-030001 ผ่านแล้ว → record NAME มีอยู่ใน DB

**Steps**

1. ไปที่ /config/currency
2. ค้นหา NAME
3. คลิกแถวเพื่อเปิด edit dialog
4. clear name แล้วกรอก NAME_UPDATED
5. กด Save
6. ค้นหา NAME_UPDATED

**Expected**

Updated/success toast ปรากฏ; แถวที่มี Name = NAME_UPDATED ปรากฏใน list

---

## TC-CUR-040002 — toggle is_active แล้ว persist

> **As a** Admin user, **I want** to manage Currency records via CRUD, **so that** the data stays correct over time.

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

## TC-CUR-040003 — แก้ไขชื่อแล้ว persist

> **As a** Admin user, **I want** to edit an existing Currency record, **so that** its data stays accurate.

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

## TC-CUR-040004 — ยกเลิกการแก้ไข ค่าต้องไม่ถูกบันทึก

> **As a** Admin user, **I want** this Currency interaction to behave as expected, **so that** the workflow stays predictable.

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

## TC-CUR-050001 — ลบรายการ

> **As a** Admin user, **I want** to delete a Currency record, **so that** the list reflects only valid entries.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

TC-CUR-200002 ผ่านแล้ว → record NAME_UPDATED ยังคงมีอยู่ใน DB

**Steps**

1. ไปที่ /config/currency
2. ค้นหา NAME_UPDATED
3. กด delete บนแถว
4. ยืนยัน Delete

**Expected**

Deleted/success toast ปรากฏ (deleted/success/สำเร็จ)

---

## TC-CUR-050002 — ยกเลิกการลบ record ต้องยังอยู่

> **As a** Admin user, **I want** this Currency interaction to behave as expected, **so that** the workflow stays predictable.

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

## TC-CUR-100001 — XSS payload ในชื่อต้องไม่รัน script

> **As the** system, **I want** XSS payloads in Currency inputs to be neutralized, **so that** no script executes in users' browsers.

**Priority:** High · **Test Type:** Security

**Preconditions**

Logged in user with permission to access /config/currency; XSS dialog guard attached

**Steps**

1. เปิด list /config/currency
2. คลิก Add เพื่อเปิด dialog
3. กรอก name ด้วย XSS payload "<script>alert('xss-e2e')</script>"
4. กด Save

**Expected**

ไม่มี browser alert/dialog จาก payload (script ไม่ถูก execute); หาก dialog ยังเปิดอยู่ก็ปิดได้ปกติ

---

## TC-CUR-100002 — SQL injection payload ต้องไม่ทำให้ระบบ crash

> **As the** system, **I want** SQL-injection payloads in Currency fields to be safely handled, **so that** the database remains intact.

**Priority:** High · **Test Type:** Security

**Preconditions**

Logged in user with permission to access /config/currency

**Steps**

1. เปิด list /config/currency
2. พิมพ์ SQL injection payload "'; DROP TABLE users; --" ลงในช่องค้นหา

**Expected**

หน้าไม่ crash; ปุ่ม Add ยังคง visible (list ทำงานปกติ)

---

## TC-CUR-100003 — ชื่อยาวเกิน maxLength ต้องถูกจำกัดที่ 100

> **As a** Admin user, **I want** the system to block invalid Currency submissions, **so that** data quality is preserved.

**Priority:** Medium · **Test Type:** Validation

**Preconditions**

Logged in user with permission to access /config/currency

**Steps**

1. เปิด list /config/currency
2. คลิก Add เพื่อเปิด dialog
3. กรอก name ด้วย string ยาว 200 ตัวอักษร ('a' x 200)

**Expected**

ค่าใน input ถูก clamp ที่ ≤ 100 ตัวอักษร (maxLength enforced)

---

## TC-CUR-100004 — user สิทธิ์ต่ำเข้าหน้านี้ต้องไม่เห็นปุ่ม Add หรือถูก redirect _(skipped)_

> **As a** low-privilege user, **I should NOT** see Add/edit controls on Currency, **so that** role separation is enforced.

**Priority:** High · **Test Type:** Authorization

**Preconditions**

Test user requestor@blueledgers.com (low-privilege role) มีอยู่จริง; module list path = /config/currency

**Steps**

1. เปิด browser context ใหม่
2. login เป็น requestor@blueledgers.com
3. ไปที่ /config/currency

**Expected**

User ถูก redirect ออกจาก /config/currency หรือ ปุ่ม Add ไม่ปรากฏ (count = 0)

---

## TC-CUR-200001 — บันทึกโดยไม่กรอกชื่อต้องแสดง error

> **As a** Admin user, **I want** the system to block invalid Currency submissions, **so that** data quality is preserved.

**Priority:** High · **Test Type:** Validation

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; เปิด add dialog ของ /config/currency

**Steps**

1. ไปที่ /config/currency
2. เปิด add dialog
3. กด Save โดยไม่กรอก name (และไม่เลือก ISO code)
4. ปิด dialog ด้วย Cancel

**Expected**

Error message ปรากฏใน dialog (form block submit ด้วย client-side validation)

---

## TC-CUR-200002 — แก้ไข: clear name แล้วบันทึก ต้องแสดง error

> **As a** Admin user, **I want** the system to block invalid Currency submissions, **so that** data quality is preserved.

**Priority:** Medium · **Test Type:** Validation

**Preconditions**

TC-CUR-040001 ผ่านแล้ว → record มี name = NAME_UPDATED

**Steps**

1. ไปที่ /config/currency
2. ค้นหา NAME_UPDATED
3. คลิกแถวเพื่อเปิด edit dialog
4. clear name
5. กด Save
6. ปิด dialog ด้วย Cancel

**Expected**

Error message ปรากฏใน dialog (form block submit ด้วย client-side validation)

---

## TC-CUR-200003 — สร้าง name ซ้ำ ต้องถูก reject

> **As a** Admin user, **I want** this Currency behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG

**Steps**

1. สร้าง record ด้วย name X
2. เปิด Add dialog กรอก name X เดิม กด Save

**Expected**

รายการที่สองไม่ถูกสร้าง: dialog (ช่อง name) ยังเปิดอยู่ (backend reject name ซ้ำ)

---


<sub>Last regenerated: 2026-11-24 · git f462816</sub>
