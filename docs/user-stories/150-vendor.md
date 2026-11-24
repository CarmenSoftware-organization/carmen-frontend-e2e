# Vendor — User Stories

_Generated from `tests/150-vendor.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Vendor
**Spec:** `tests/150-vendor.spec.ts`
**Default role:** Admin
**Total test cases:** 31 (15 High / 16 Medium / 0 Low)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-VEN-010001 | หน้า list โหลดสำเร็จ | High | Smoke |
| TC-VEN-010002 | ปุ่ม Add แสดง | High | Smoke |
| TC-VEN-010003 | ช่องค้นหาใช้งานได้ | Medium | Smoke |
| TC-VEN-010004 | ค้นหาคำที่ไม่มีต้องแสดง empty state | Medium | Functional |
| TC-VEN-010005 | Filter status (active/inactive) ใช้งานได้ | Medium | Functional |
| TC-VEN-010050 | active BU = BLAVG | High | Smoke |
| TC-VEN-030001 | เปิดหน้า new form สำเร็จ | High | Smoke |
| TC-VEN-030002 | เลือก business type จาก dropdown ได้ | Medium | Functional |
| TC-VEN-030003 | สร้าง vendor ขั้นต่ำ (code + name + business type) สำเร็จ | High | CRUD |
| TC-VEN-030004 | สร้าง vendor พร้อม address 1 รายการ | High | CRUD |
| TC-VEN-030005 | สร้าง vendor พร้อม contact 1 รายการ (primary) | High | CRUD |
| TC-VEN-030007 | เพิ่ม address row ได้หลาย row | Medium | Functional |
| TC-VEN-030008 | ลบ address row ได้ | Medium | Functional |
| TC-VEN-030009 | เพิ่ม contact row ได้หลาย row | Medium | Functional |
| TC-VEN-030010 | ลบ contact row ได้ | Medium | Functional |
| TC-VEN-030011 | เปลี่ยน primary contact ได้ (radio exclusive) | Medium | Functional |
| TC-VEN-030012 | เพิ่ม info row (label/value) ได้ | Medium | Functional |
| TC-VEN-030013 | ลบ info row ได้ | Medium | Functional |
| TC-VEN-030050 | สร้าง vendor (admin/BLAVG) สำเร็จ | High | CRUD |
| TC-VEN-040001 | แก้ name ของ vendor ที่สร้างแล้ว save สำเร็จ | High | CRUD |
| TC-VEN-040050 | แก้ name ของ vendor แล้ว persist | High | CRUD |
| TC-VEN-050001 | เปิด delete dialog ของ vendor แล้ว cancel — row ยังอยู่ | Medium | Functional |
| TC-VEN-050002 | ลบ vendor ที่สร้างในชุด test สำเร็จ (cleanup หลัก) | High | CRUD |
| TC-VEN-050003 | หลังลบแล้วค้นหาไม่พบ row นั้นอีก | Medium | Functional |
| TC-VEN-050050 | ลบ vendor (admin/BLAVG) cleanup | High | CRUD |
| TC-VEN-200001 | บันทึกโดยไม่กรอก code ต้องแสดง error | High | Validation |
| TC-VEN-200002 | บันทึกโดยไม่กรอก name ต้องแสดง error | High | Validation |
| TC-VEN-200003 | code เกิน 10 ตัวอักษรต้องถูก reject | Medium | Validation |
| TC-VEN-200004 | name เกิน 100 ตัวอักษรต้องถูก reject | Medium | Validation |
| TC-VEN-200006 | contact email รูปแบบผิดต้องแสดง error | Medium | Validation |
| TC-VEN-200050 | สร้าง vendor code ซ้ำ ต้องถูก reject | High | Negative |

---

## TC-VEN-010001 — หน้า list โหลดสำเร็จ

> **As a** Admin user, **I want** the Vendor list page to load successfully, **so that** I can manage Vendor records.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

Logged in as carmensoftware.dev+purchase@gmail.com via createAuthTest fixture; ผู้ใช้มีสิทธิ์เข้าถึง vendor-management

**Steps**

1. ไปที่ /vendor-management/vendor

**Expected**

URL ตรงกับ /vendor-management/vendor และปุ่ม Add visible ภายใน 10s

---

## TC-VEN-010002 — ปุ่ม Add แสดง

> **As a** Admin user, **I want** to see the Add button on the Vendor list, **so that** I can create new records.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

Login เป็น carmensoftware.dev+purchase@gmail.com; on /vendor-management/vendor

**Steps**

1. ไปที่ /vendor-management/vendor

**Expected**

ปุ่ม Add visible บนหน้า list

---

## TC-VEN-010003 — ช่องค้นหาใช้งานได้

> **As a** Admin user, **I want** to type into the Vendor search field, **so that** I can quickly locate existing records.

**Priority:** Medium · **Test Type:** Smoke

**Preconditions**

Login เป็น carmensoftware.dev+purchase@gmail.com; on /vendor-management/vendor

**Steps**

1. ไปที่ /vendor-management/vendor
2. พิมพ์ 'test' ในช่องค้นหา

**Expected**

ช่องค้นหา visible และรับค่า input ได้โดยไม่ error

---

## TC-VEN-010004 — ค้นหาคำที่ไม่มีต้องแสดง empty state

> **As a** Admin user, **I want** a clear empty-state when no Vendor records match my search, **so that** I know nothing was found.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

Login เป็น carmensoftware.dev+purchase@gmail.com; on /vendor-management/vendor

**Steps**

1. ไปที่ /vendor-management/vendor
2. ค้นหาด้วยคำที่ไม่มี (`__NOPE__<UID>`)

**Expected**

Empty-state placeholder ปรากฏภายใน 10s (ไม่มีแถวที่ตรงกับคำค้น)

---

## TC-VEN-010005 — Filter status (active/inactive) ใช้งานได้

> **As a** Admin user, **I want** to filter the Vendor list, **so that** I can narrow results to relevant records.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

Login เป็น carmensoftware.dev+purchase@gmail.com; on /vendor-management/vendor

**Steps**

1. ไปที่ /vendor-management/vendor
2. คลิกปุ่ม Filter แล้วเปิดกลุ่ม Status
3. ตรวจว่ามีตัวเลือก All / Active / Inactive
4. เลือก Active แล้วปิดแผง

**Expected**

มีตัวเลือก All / Active / Inactive; หลังเลือก Active ตารางเหลือเฉพาะ vendor ที่ไม่ใช่ Inactive และปุ่ม Add ยัง visible

---

## TC-VEN-010050 — active BU = BLAVG

> **As a** Admin user, **I want** core Vendor interactions to work, **so that** day-to-day usage stays smooth.

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

## TC-VEN-030001 — เปิดหน้า new form สำเร็จ

> **As a** Admin user, **I want** core Vendor interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

Logged in as carmensoftware.dev+purchase@gmail.com; ผู้ใช้มีสิทธิ์สร้าง vendor

**Steps**

1. ไปที่ /vendor-management/vendor/new

**Expected**

URL ตรงกับ /vendor-management/vendor/new; code input, name input และปุ่ม Save visible

---

## TC-VEN-030002 — เลือก business type จาก dropdown ได้

> **As a** Admin user, **I want** this Vendor interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

Logged in as carmensoftware.dev+purchase@gmail.com; on /vendor-management/vendor/new; backend มีข้อมูล business types อย่างน้อย 1 รายการ

**Steps**

1. เปิด new form
2. ตรวจว่ามี business type option อย่างน้อย 1 รายการ
3. เปิด business type dropdown
4. เลือก option แรก

**Expected**

มี option ให้เลือก (count > 0) และ trigger ของ business type แสดง label ของรายการที่เลือกภายใน 5s

---

## TC-VEN-030003 — สร้าง vendor ขั้นต่ำ (code + name + business type) สำเร็จ

> **As a** Admin user, **I want** to create a new Vendor record, **so that** it becomes available for downstream operations.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

Logged in as carmensoftware.dev+purchase@gmail.com; vendor CODE/NAME ยังไม่มีใน DB

**Steps**

1. เปิด new form
2. กรอก code + name ใน tab General
3. เลือก business type (ถ้ามี option)
4. กด Save
5. กลับ list และค้นหาด้วย NAME

**Expected**

Save toast/feedback ปรากฏ และ vendor ใหม่ค้นเจอใน list ภายใน 10s

---

## TC-VEN-030004 — สร้าง vendor พร้อม address 1 รายการ

> **As a** Admin user, **I want** to create a new Vendor record, **so that** it becomes available for downstream operations.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

Logged in as carmensoftware.dev+purchase@gmail.com; vendor CODE+'A' ยังไม่มีใน DB

**Steps**

1. เปิด new form
2. กรอก code + name
3. เลือก business type (ถ้ามี)
4. เพิ่ม address row 1 รายการ (mailing/international, line1, city, country)
5. กด Save
6. cleanup ลบ vendor (best-effort)

**Expected**

Save toast/feedback ปรากฏ บ่งชี้ว่า vendor พร้อม address ถูกบันทึกสำเร็จ

---

## TC-VEN-030005 — สร้าง vendor พร้อม contact 1 รายการ (primary)

> **As a** Admin user, **I want** to create a new Vendor record, **so that** it becomes available for downstream operations.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

Logged in as carmensoftware.dev+purchase@gmail.com; vendor CODE+'C' ยังไม่มีใน DB

**Steps**

1. เปิด new form
2. กรอก code + name
3. เลือก business type (ถ้ามี)
4. เพิ่ม contact row 1 รายการ (name/email/phone/is_primary=true)
5. กด Save
6. กลับ list ค้นหาด้วย name

**Expected**

Save toast/feedback ปรากฏ และ vendor ที่มี contact ค้นเจอใน list ภายใน 10s

---

## TC-VEN-030007 — เพิ่ม address row ได้หลาย row

> **As a** Admin user, **I want** this Vendor interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

Logged in as carmensoftware.dev+purchase@gmail.com; on /vendor-management/vendor/new ที่ tab address

**Steps**

1. เปิด new form
2. สลับไป tab address
3. กดปุ่มเพิ่ม address 2 ครั้ง

**Expected**

เริ่มจาก 0 row → เพิ่มได้เป็น 1 และ 2 row ตามลำดับ

---

## TC-VEN-030008 — ลบ address row ได้

> **As a** Admin user, **I want** this Vendor interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

Logged in as carmensoftware.dev+purchase@gmail.com; on /vendor-management/vendor/new ที่ tab address

**Steps**

1. เปิด new form
2. สลับไป tab address
3. เพิ่ม 2 row
4. ลบ row index 0

**Expected**

หลังลบ จำนวน address row เหลือ 1

---

## TC-VEN-030009 — เพิ่ม contact row ได้หลาย row

> **As a** Admin user, **I want** this Vendor interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

Logged in as carmensoftware.dev+purchase@gmail.com; on /vendor-management/vendor/new ที่ tab contact

**Steps**

1. เปิด new form
2. สลับไป tab contact
3. กดปุ่มเพิ่ม contact 2 ครั้ง

**Expected**

เริ่มจาก 0 row → เพิ่มได้เป็น 2 row

---

## TC-VEN-030010 — ลบ contact row ได้

> **As a** Admin user, **I want** this Vendor interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

Logged in as carmensoftware.dev+purchase@gmail.com; on /vendor-management/vendor/new ที่ tab contact

**Steps**

1. เปิด new form
2. สลับไป tab contact
3. เพิ่ม 2 row และกรอกชื่อ
4. ลบ row index 0

**Expected**

หลังลบ จำนวน contact row เหลือ 1

---

## TC-VEN-030011 — เปลี่ยน primary contact ได้ (radio exclusive)

> **As a** Admin user, **I want** this Vendor interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

Logged in as carmensoftware.dev+purchase@gmail.com; on /vendor-management/vendor/new ที่ tab contact

**Steps**

1. เปิด new form
2. สลับไป tab contact
3. เพิ่ม 2 row และกรอกชื่อ A, B
4. setPrimary index 0
5. setPrimary index 1

**Expected**

เมื่อเปลี่ยน primary เป็น index 1 แล้ว index 0 ต้อง not checked (radio-exclusive behavior)

---

## TC-VEN-030012 — เพิ่ม info row (label/value) ได้

> **As a** Admin user, **I want** this Vendor interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

Logged in as carmensoftware.dev+purchase@gmail.com; on /vendor-management/vendor/new ที่ tab info

**Steps**

1. เปิด new form
2. สลับไป tab info
3. เพิ่ม info row 1 รายการ และกรอก label='Tax ID' / value='1234567890' / dataType='string'

**Expected**

เริ่มจาก 0 row → หลังเพิ่มแล้วมี 1 row

---

## TC-VEN-030013 — ลบ info row ได้

> **As a** Admin user, **I want** this Vendor interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

Logged in as carmensoftware.dev+purchase@gmail.com; on /vendor-management/vendor/new ที่ tab info

**Steps**

1. เปิด new form
2. สลับไป tab info
3. เพิ่ม 2 row
4. ลบ row index 0

**Expected**

หลังลบ จำนวน info row เหลือ 1

---

## TC-VEN-030050 — สร้าง vendor (admin/BLAVG) สำเร็จ

> **As a** Admin user, **I want** to create a new Vendor record, **so that** it becomes available for downstream operations.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG; vendor ADMIN_CODE/ADMIN_NAME ยังไม่มีใน DB

**Steps**

1. เปิด new form
2. กรอก code + name ใน tab General
3. เลือก business type (ถ้ามี option)
4. กด Save
5. กลับ list และค้นหาด้วย ADMIN_NAME

**Expected**

Save toast/feedback ปรากฏ และ vendor ใหม่ค้นเจอใน list ภายใน 10s

---

## TC-VEN-040001 — แก้ name ของ vendor ที่สร้างแล้ว save สำเร็จ

> **As a** Admin user, **I want** to create a new Vendor record, **so that** it becomes available for downstream operations.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

TC-VEN-030003 ผ่านแล้ว → vendor ที่ NAME มีอยู่ใน DB; logged in as carmensoftware.dev+purchase@gmail.com

**Steps**

1. ไปที่ list และเปิด detail ของ vendor ตาม NAME
2. กด Edit
3. สลับไป tab general
4. แก้ name เป็น NAME_UPDATED
5. กด Save
6. กลับ list ค้นหาด้วย NAME_UPDATED

**Expected**

Save toast/feedback ปรากฏ และ NAME_UPDATED ค้นเจอใน list ภายใน 10s

---

## TC-VEN-040050 — แก้ name ของ vendor แล้ว persist

> **As a** Admin user, **I want** to manage Vendor records via CRUD, **so that** the data stays correct over time.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

TC-VEN-030050 ผ่านแล้ว → vendor ที่ ADMIN_NAME มีอยู่ใน DB; login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG

**Steps**

1. ไปที่ list และเปิด detail ของ vendor ตาม ADMIN_NAME
2. กด Edit
3. สลับไป tab general
4. แก้ name เป็น ADMIN_NAME_UPDATED
5. กด Save
6. กลับ list ค้นหาด้วย ADMIN_NAME_UPDATED

**Expected**

Save toast/feedback ปรากฏ และ ADMIN_NAME_UPDATED ค้นเจอใน list ภายใน 10s (ค่าถูก persist)

---

## TC-VEN-050001 — เปิด delete dialog ของ vendor แล้ว cancel — row ยังอยู่

> **As a** Admin user, **I want** this Vendor interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

TC-VEN-040001 ผ่านแล้ว → vendor ที่ NAME_UPDATED มีอยู่ใน DB

**Steps**

1. ไปที่ list และค้นหาด้วย NAME_UPDATED
2. เปิด row actions ของ row นั้น
3. คลิก menuitem Delete
4. ใน alertdialog กด Cancel

**Expected**

Alertdialog ปิดและแถวของ NAME_UPDATED ยังคง visible (ไม่ถูกลบ)

---

## TC-VEN-050002 — ลบ vendor ที่สร้างในชุด test สำเร็จ (cleanup หลัก)

> **As a** Admin user, **I want** to create a new Vendor record, **so that** it becomes available for downstream operations.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

TC-VEN-050001 ผ่านแล้ว → vendor ที่ NAME_UPDATED ยังคงอยู่ใน DB

**Steps**

1. ไปที่ list และค้นหาด้วย NAME_UPDATED
2. เปิด row actions
3. คลิก menuitem Delete
4. ใน alertdialog กดยืนยัน Delete/Confirm

**Expected**

Success toast ('success/deleted/สำเร็จ') ปรากฏภายใน 10s

---

## TC-VEN-050003 — หลังลบแล้วค้นหาไม่พบ row นั้นอีก

> **As a** Admin user, **I want** this Vendor interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

TC-VEN-050002 ผ่านแล้ว → vendor ที่ NAME_UPDATED ถูกลบจาก DB แล้ว

**Steps**

1. ไปที่ list
2. ค้นหาด้วย NAME_UPDATED

**Expected**

Empty-state placeholder ปรากฏภายใน 10s (ยืนยันว่าลบได้สำเร็จจริง)

---

## TC-VEN-050050 — ลบ vendor (admin/BLAVG) cleanup

> **As a** Admin user, **I want** to delete a Vendor record, **so that** the list reflects only valid entries.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

TC-VEN-200050 ผ่านแล้ว → vendor ที่ ADMIN_NAME_UPDATED ยังคงอยู่ใน DB; login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG

**Steps**

1. ไปที่ list และค้นหาด้วย ADMIN_NAME_UPDATED
2. เปิด row actions
3. คลิก menuitem Delete
4. ใน alertdialog กดยืนยัน Delete/Confirm

**Expected**

Success toast ('success/deleted/สำเร็จ') ปรากฏภายใน 10s

---

## TC-VEN-200001 — บันทึกโดยไม่กรอก code ต้องแสดง error

> **As a** Admin user, **I want** the system to block invalid Vendor submissions, **so that** data quality is preserved.

**Priority:** High · **Test Type:** Validation

**Preconditions**

Login เป็น carmensoftware.dev+purchase@gmail.com; on /vendor-management/vendor/new

**Steps**

1. เปิด new form ที่ tab general
2. กรอกเฉพาะ name (เว้น code)
3. กด Save

**Expected**

Error indicator ปรากฏและ URL ยังคงอยู่ที่ /new (form block submit)

---

## TC-VEN-200002 — บันทึกโดยไม่กรอก name ต้องแสดง error

> **As a** Admin user, **I want** the system to block invalid Vendor submissions, **so that** data quality is preserved.

**Priority:** High · **Test Type:** Validation

**Preconditions**

Login เป็น carmensoftware.dev+purchase@gmail.com; on /vendor-management/vendor/new

**Steps**

1. เปิด new form ที่ tab general
2. กรอกเฉพาะ code (เว้น name)
3. กด Save

**Expected**

Error indicator ปรากฏและ URL ยังคงอยู่ที่ /new (form block submit)

---

## TC-VEN-200003 — code เกิน 10 ตัวอักษรต้องถูก reject

> **As a** Admin user, **I want** the system to block invalid Vendor submissions, **so that** data quality is preserved.

**Priority:** Medium · **Test Type:** Validation

**Preconditions**

Login เป็น carmensoftware.dev+purchase@gmail.com; on /vendor-management/vendor/new

**Steps**

1. เปิด new form ที่ tab general
2. พยายาม fill code 'X' ยาว 20 ตัวอักษร

**Expected**

ค่าใน code input ต้องไม่เกิน 10 ตัวอักษร (input maxLength enforcement)

---

## TC-VEN-200004 — name เกิน 100 ตัวอักษรต้องถูก reject

> **As a** Admin user, **I want** the system to block invalid Vendor submissions, **so that** data quality is preserved.

**Priority:** Medium · **Test Type:** Validation

**Preconditions**

Login เป็น carmensoftware.dev+purchase@gmail.com; on /vendor-management/vendor/new

**Steps**

1. เปิด new form
2. กรอก code + business type ที่ถูกต้อง
3. กรอก name ยาว 150 ตัวอักษร
4. กด Save

**Expected**

zod name.max(100) บล็อก submit — ยังอยู่ที่ /new และไม่มี success toast

---

## TC-VEN-200006 — contact email รูปแบบผิดต้องแสดง error

> **As a** Admin user, **I want** the system to block invalid Vendor submissions, **so that** data quality is preserved.

**Priority:** Medium · **Test Type:** Validation

**Preconditions**

Login เป็น carmensoftware.dev+purchase@gmail.com; on /vendor-management/vendor/new

**Steps**

1. เปิด new form
2. กรอก code + name + business type
3. เพิ่ม contact row และกรอก email = 'not-an-email'
4. กด Save

**Expected**

URL ยังคงอยู่ที่ /new (HTML5 native email validation block submit)

---

## TC-VEN-200050 — สร้าง vendor code ซ้ำ ต้องถูก reject

> **As a** Admin user, **I want** this Vendor behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

TC-VEN-040050 ผ่านแล้ว → vendor ที่ ADMIN_CODE มีอยู่ใน DB; login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG

**Steps**

1. เปิด new form
2. กรอก code = ADMIN_CODE (ซ้ำ) + name ใหม่
3. เลือก business type (ถ้ามี)
4. กด Save

**Expected**

รายการที่สองไม่ถูกสร้าง: ยังอยู่ที่ form (/new) หรือมี error (backend reject duplicate code)

---


<sub>Last regenerated: 2026-11-24 · git f462816</sub>
