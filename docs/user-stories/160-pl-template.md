# Price List Template — User Stories

_Generated from `tests/160-pl-template.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Price List Template
**Spec:** `tests/160-pl-template.spec.ts`
**Default role:** Admin
**Total test cases:** 33 (21 High / 12 Medium / 0 Low)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-PT-010001 | Create Pricelist Template - Happy Path | High | Happy Path |
| TC-PT-010002 | Create Pricelist Template - Empty Template Name | High | Negative |
| TC-PT-010004 | Create Pricelist Template - No Permission | High | Negative |
| TC-PT-010005 | Create Pricelist Template - Without Description (optional) | Medium | Alternate Flow |
| TC-PT-010050 | active BU = BLAVG | High | Smoke |
| TC-PT-010051 | สร้าง pricelist template (admin/BLAVG) สำเร็จ | High | CRUD |
| TC-PT-020001 | Add products to template - Happy Path | High | Happy Path |
| TC-PT-020002 | Add products to template - Invalid Input (ไม่มีสินค้าเลย) | High | Negative |
| TC-PT-020003 | Add products to template - No Permission | High | Negative |
| TC-PT-020004 | Add products to template - Edge Case - Remove restores empty state | Medium | Edge Case |
| TC-PT-030001 | Edit template with valid data | High | Happy Path |
| TC-PT-030002 | Edit template with invalid validity period | High | Negative |
| TC-PT-030003 | Edit template without product selection | High | Negative |
| TC-PT-030004 | Edit template with minimal changes | High | Happy Path |
| TC-PT-030005 | Edit template with all fields in default state | High | Edge Case |
| TC-PT-040001 | No clone action on template detail | Medium | Negative |
| TC-PT-040002 | No clone option in list row actions | Medium | Negative |
| TC-PT-040003 | No clone action for Procurement Staff | Medium | Negative |
| TC-PT-040004 | No clone action even in edit mode | Medium | Edge Case |
| TC-PT-040050 | แก้ชื่อ template แล้ว persist | High | CRUD |
| TC-PT-040051 | แก้ชื่อแล้วกด Cancel — ค่าเดิมคงอยู่ | Medium | CRUD |
| TC-PT-050001 | Set template status to Active - Happy Path | High | Happy Path |
| TC-PT-050003 | Status is a closed set - Invalid Input | Medium | Negative |
| TC-PT-050004 | Cannot change status - No Permission | High | Negative |
| TC-PT-050005 | Template Status Change - Edge Case (rapid toggle) | Medium | Edge Case |
| TC-PT-050050 | เปิด delete dialog แล้ว Cancel — template ยังอยู่ | Medium | CRUD |
| TC-PT-050051 | ลบ template (admin/BLAVG) cleanup | High | CRUD |
| TC-PT-060001 | Search and View Templates - Happy Path | High | Happy Path |
| TC-PT-060002 | Search and View Templates - Negative - Invalid Search Term | High | Negative |
| TC-PT-060003 | Search and View Templates - Negative - Insufficient Permission | High | Negative |
| TC-PT-060004 | Search and View Templates - Edge Case - Filter by Product Count | Medium | Edge Case |
| TC-PT-060005 | Search and View Templates - Edge Case - Sort by Name (Z-A) | Medium | Edge Case |
| TC-PT-200050 | สร้าง template ชื่อซ้ำ ต้องถูก reject | High | Negative |

---

## TC-PT-010001 — Create Pricelist Template - Happy Path

> **As a** Admin user, **I want** this Price List Template behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Happy Path

**Preconditions**

Login เป็น Procurement Manager และมีสิทธิ์เข้าถึง Pricelist Templates

**Steps**

1. ไปที่ /vendor-management/price-list-template
2. คลิก 'New Pricelist Template'
3. กรอก 'Template Name' ด้วย 'Office Supplies'
4. กรอก 'Description' ด้วย 'Office supplies pricelist for 2023'
5. คลิก 'Save'

**Expected**

Pricelist template สร้างสำเร็จ

---

## TC-PT-010002 — Create Pricelist Template - Empty Template Name

> **As a** Admin user, **I want** this Price List Template behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

Login เป็น Procurement Manager และมีสิทธิ์เข้าถึง Pricelist Templates

**Steps**

1. ไปที่ /vendor-management/price-list-template
2. คลิก 'New Pricelist Template'
3. กรอก 'Description' ด้วย 'Office supplies pricelist for 2023'
4. คลิก 'Save'

**Expected**

การสร้างถูกบล็อก (name เป็น required): ฟอร์มคงอยู่ที่ /new และไม่มี success toast

---

## TC-PT-010004 — Create Pricelist Template - No Permission

> **As a** Admin user, **I want** this Price List Template behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

Login เป็น Procurement Staff และมีสิทธิ์เข้าถึงเฉพาะหน้า list ของ Pricelist Templates

**Steps**

1. ไปที่ /vendor-management/price-list-template
2. คลิก 'New Pricelist Template'

**Expected**

ผู้ใช้ถูก redirect ไปยังหน้าไม่มีสิทธิ์เข้าถึงหรือปุ่ม 'New Pricelist Template' ถูกซ่อน/disabled

---

## TC-PT-010005 — Create Pricelist Template - Without Description (optional)

> **As a** Admin user, **I want** this Price List Template behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Alternate Flow

**Preconditions**

Login เป็น Procurement Manager และมีสิทธิ์เข้าถึง Pricelist Templates; มี currency อย่างน้อย 1 รายการ

**Steps**

1. ไปที่ /vendor-management/price-list-template/new
2. กรอก 'Template Name'
3. เลือก Currency (required)
4. เว้นช่อง Description ว่างไว้
5. คลิก 'Save'

**Expected**

template ถูกสร้างสำเร็จโดยไม่ต้องกรอก description (description เป็น optional ใน redesigned schema) — แสดง success toast

> _Note: Redesign made description optional (z.string(), no min); the old 'missing description → error' expectation is obsolete. Verified live: creating without a description succeeds._

---

## TC-PT-010050 — active BU = BLAVG

> **As a** Admin user, **I want** core Price List Template interactions to work, **so that** day-to-day usage stays smooth.

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

## TC-PT-010051 — สร้าง pricelist template (admin/BLAVG) สำเร็จ

> **As a** Admin user, **I want** to create a new Price List Template record, **so that** it becomes available for downstream operations.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG; template ชื่อ ADMIN_NAME ยังไม่มีใน DB; มี currency อย่างน้อย 1 รายการ

**Steps**

1. เปิดหน้า /new
2. กรอกชื่อ (hero NameField) = ADMIN_NAME
3. เลือก Currency (required)
4. กด 'Save'
5. ตรวจสอบ success toast

**Expected**

success toast ปรากฏ (template ถูกสร้าง) — ใช้เป็น seed ของ serial chain

---

## TC-PT-020001 — Add products to template - Happy Path

> **As a** Admin user, **I want** this Price List Template behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Happy Path

**Preconditions**

Login เป็น Procurement Manager; เปิดฟอร์มสร้าง template ใหม่ (/new) ได้

**Steps**

1. ไปที่ /vendor-management/price-list-template/new
2. ตรวจสอบว่า product table แสดง empty state 'No products yet'
3. คลิกปุ่ม 'Add product'

**Expected**

มี product row ถูกเพิ่มในตาราง inline (ปุ่ม 'Remove tier' ปรากฏ) และ empty state 'No products yet' หายไป

> _Note: Inline product table replaced the old Add Products dialog; an 'Add product' button appends a row._

---

## TC-PT-020002 — Add products to template - Invalid Input (ไม่มีสินค้าเลย)

> **As a** Admin user, **I want** this Price List Template behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

Login เป็น Procurement Manager; มี currency อย่างน้อย 1 รายการ

**Steps**

1. ไปที่ /vendor-management/price-list-template/new
2. กรอกชื่อ template + เลือก currency
3. ไม่ติ๊กสินค้าใด ๆ จาก lookup tree
4. คลิก 'Save'

**Expected**

ระบบแสดง validation error (ต้องมีสินค้าอย่างน้อย 1 รายการ) และ template ไม่ถูกบันทึก

> _Note: เดิมเคสนี้ทดสอบ 'แถวเปล่า' ซึ่งสร้างไม่ได้อีกแล้ว — ฟอร์มเปลี่ยนมาใช้ TreeProductLookup แถวจึงเกิดได้ทางเดียวคือมีสินค้าถูกติ๊ก (ดู plt-item-fields.tsx:155-180) สถานะ 'ข้อมูลไม่ครบ' ที่ยังทดสอบได้จริงคือบันทึกโดยไม่มีสินค้าเลย_

---

## TC-PT-020003 — Add products to template - No Permission

> **As a** Admin user, **I want** this Price List Template behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

Login เป็น Procurement Staff (อ่าน template ได้แต่ไม่มีสิทธิ์แก้ไข)

**Steps**

1. ไปที่ /vendor-management/price-list-template
2. เปิด template รายการแรก (view mode)
3. มองหาช่องทางเพิ่ม product

**Expected**

ไม่มีปุ่ม 'Add product' ให้ Procurement Staff (product table เป็น read-only — ต้องอยู่ใน edit mode ถึงจะเพิ่มได้ และ staff เข้า edit ไม่ได้)

> _Note: The inline 'Add product' button renders only when the form is editable; a read-only viewer never sees it._

---

## TC-PT-020004 — Add products to template - Edge Case - Remove restores empty state

> **As a** Admin user, **I want** this Price List Template behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Edge Case

**Preconditions**

Login เป็น Procurement Manager; เปิดฟอร์มสร้าง template ใหม่ได้

**Steps**

1. ไปที่ /vendor-management/price-list-template/new
2. คลิก 'Add product' เพื่อเพิ่ม row
3. คลิกปุ่ม 'Remove tier' บน row นั้น

**Expected**

row ถูกลบออกและตารางกลับสู่ empty state 'No products yet'

> _Note: The inline table is a flat detail list; removing the only row returns to the empty-products state._

---

## TC-PT-030001 — Edit template with valid data

> **As a** Admin user, **I want** this Price List Template behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Happy Path

**Preconditions**

Login เป็น Procurement Manager และมีสิทธิ์แก้ไข template

**Steps**

1. ไปที่ /vendor-management/price-list-template/[id]
2. คลิก 'Edit'
3. กรอกชื่อ template
4. กรอก description
5. เลือก currency
6. กรอก validity period
7. กรอก vendor instructions
8. สลับ switch allow multi-MOQ
9. สลับ switch require lead time
10. กรอก max items per submission
11. สลับ switch send reminders
12. เลือก 14 และ 7 วันใน reminder checkboxes
13. กรอก escalation days
14. คลิก 'Save Changes'

**Expected**

template บันทึกสำเร็จ doc_version เพิ่มขึ้น แสดงข้อความสำเร็จ และบันทึกการเปลี่ยนแปลงใน audit trail

---

## TC-PT-030002 — Edit template with invalid validity period

> **As a** Admin user, **I want** this Price List Template behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

Login เป็น Procurement Manager และมีสิทธิ์แก้ไข template

**Steps**

1. ไปที่ /vendor-management/price-list-template/[id]
2. คลิก 'Edit'
3. กรอก validity period เป็น 0 วัน
4. คลิก 'Save Changes'

**Expected**

validity 0 ถูก reject โดย native min=1 constraint (rangeUnderflow): submit ถูกบล็อก ไม่มี success toast (template ไม่ถูกบันทึก)

---

## TC-PT-030003 — Edit template without product selection

> **As a** Admin user, **I want** this Price List Template behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

Procurement Manager มีสิทธิ์แก้ไข template และไม่มี product เชื่อมโยงกับ template

**Steps**

1. ไปที่ /vendor-management/price-list-template/[id]
2. คลิก 'Edit'
3. คลิก 'Save Changes'

**Expected**

ระบบแสดงข้อความ error แจ้งว่าต้องมี product selection อย่างน้อย 1 รายการและ template ไม่ถูกบันทึก

---

## TC-PT-030004 — Edit template with minimal changes

> **As a** Admin user, **I want** this Price List Template behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Happy Path

**Preconditions**

Login เป็น Procurement Manager และมีสิทธิ์แก้ไข template

**Steps**

1. ไปที่ /vendor-management/price-list-template/[id]
2. คลิก 'Edit'
3. เปลี่ยน validity period เป็น 1 วัน
4. คลิก 'Save Changes'

**Expected**

template บันทึกสำเร็จ doc_version เพิ่มขึ้น และบันทึกการเปลี่ยนแปลงใน audit trail

---

## TC-PT-030005 — Edit template with all fields in default state

> **As a** Admin user, **I want** this Price List Template behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Edge Case

**Preconditions**

Procurement Manager มีสิทธิ์แก้ไข template; template อยู่ในสถานะ default โดยไม่มีการเปลี่ยนแปลง

**Steps**

1. ไปที่ /vendor-management/price-list-template/[id]
2. คลิก 'Edit'
3. คลิก 'Save Changes'

**Expected**

template ไม่มีการเปลี่ยนแปลง doc_version คงเดิม และไม่มีการบันทึกการเปลี่ยนแปลงใน audit trail

---

## TC-PT-040001 — No clone action on template detail

> **As a** Admin user, **I want** this Price List Template behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Negative

**Preconditions**

Login เป็น Procurement Manager; มี template อย่างน้อย 1 รายการในระบบ

**Steps**

1. ไปที่ /vendor-management/price-list-template
2. เปิด template รายการแรก
3. มองหาปุ่ม Clone/Duplicate ใน detail toolbar

**Expected**

ไม่มีปุ่ม Clone/Duplicate ในหน้า detail (feature ถูกถอดออกใน redesign — เหลือเพียง Copy glyph badge ที่ไม่ใช่ปุ่ม)

> _Note: Clone/Duplicate removed in the redesign; the toolbar 'Copy' glyph is a decorative <span>, not a clickable action._

---

## TC-PT-040002 — No clone option in list row actions

> **As a** Admin user, **I want** this Price List Template behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Negative

**Preconditions**

Login เป็น Procurement Manager; มี template อย่างน้อย 1 รายการในระบบ

**Steps**

1. ไปที่ /vendor-management/price-list-template
2. เปิดเมนู 'Row actions' ของ template รายการแรก
3. ตรวจสอบรายการเมนู

**Expected**

เมนู row actions ไม่มีตัวเลือก Clone/Duplicate (มีเพียง Edit / Delete)

> _Note: Row actions menu (data-grid) exposes only Edit and Delete; no clone/duplicate item._

---

## TC-PT-040003 — No clone action for Procurement Staff

> **As a** Admin user, **I want** this Price List Template behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Negative

**Preconditions**

Login เป็น Procurement Staff (อ่าน template ได้)

**Steps**

1. ไปที่ /vendor-management/price-list-template
2. เปิด template รายการแรก
3. มองหาปุ่ม/เมนู Clone/Duplicate

**Expected**

ไม่มีปุ่มหรือเมนู Clone/Duplicate ให้ Procurement Staff (feature ถูกถอดออกทั้งระบบ)

> _Note: Clone is gone for every role; a staff viewer sees neither a clone button nor a clone menu item._

---

## TC-PT-040004 — No clone action even in edit mode

> **As a** Admin user, **I want** this Price List Template behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Edge Case

**Preconditions**

Login เป็น Procurement Manager; มี template อย่างน้อย 1 รายการในระบบ

**Steps**

1. ไปที่ /vendor-management/price-list-template
2. เปิด template รายการแรกแล้วกด 'Edit'
3. ตรวจสอบ toolbar ใน edit mode

**Expected**

edit toolbar มีเพียง Cancel / Save / Delete — ไม่มีปุ่ม Clone/Duplicate; ปุ่ม Save ปรากฏ

> _Note: Entering edit mode exposes Cancel/Save/Delete only; clone never appears._

---

## TC-PT-040050 — แก้ชื่อ template แล้ว persist

> **As a** Admin user, **I want** to manage Price List Template records via CRUD, **so that** the data stays correct over time.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

TC-PT-010051 ผ่านแล้ว → template ADMIN_NAME มีอยู่; login carmensoftware.dev+admin@gmail.com; active BU = BLAVG

**Steps**

1. ไป list แล้วเปิด template ADMIN_NAME
2. กด 'Edit'
3. แก้ชื่อเป็น ADMIN_NAME_UPDATED
4. กด 'Save'
5. กลับ list ค้นหา ADMIN_NAME_UPDATED

**Expected**

success toast ปรากฏ และ ADMIN_NAME_UPDATED ค้นเจอใน list ภายใน 10s (ค่าถูก persist)

---

## TC-PT-040051 — แก้ชื่อแล้วกด Cancel — ค่าเดิมคงอยู่

> **As a** Admin user, **I want** to manage Price List Template records via CRUD, **so that** the data stays correct over time.

**Priority:** Medium · **Test Type:** CRUD

**Preconditions**

TC-PT-040050 ผ่านแล้ว → template ADMIN_NAME_UPDATED มีอยู่; login carmensoftware.dev+admin@gmail.com; active BU = BLAVG

**Steps**

1. ไป list เปิด template ADMIN_NAME_UPDATED
2. กด 'Edit'
3. แก้ชื่อเป็นค่าทิ้ง
4. กด 'Cancel'
5. กลับ list ค้นหา ADMIN_NAME_UPDATED

**Expected**

ชื่อ template ยังเป็น ADMIN_NAME_UPDATED (การแก้ที่ยกเลิกไม่ถูกบันทึก)

---

## TC-PT-050001 — Set template status to Active - Happy Path

> **As a** Admin user, **I want** this Price List Template behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Happy Path

**Preconditions**

Login เป็น Procurement Manager; มี currency อย่างน้อย 1 รายการ

**Steps**

1. ไปที่ /vendor-management/price-list-template/new
2. กรอกชื่อ template + เลือก currency
3. เลือก Status = 'Active' จาก dropdown ใน summary aside
4. คลิก 'Save'
5. ตรวจสอบ success toast

**Expected**

template ถูกสร้างพร้อม status 'Active' และแสดง success toast

> _Note: Activate/Deactivate is now a status Select on the form, not a dedicated button._

---

## TC-PT-050003 — Status is a closed set - Invalid Input

> **As a** Admin user, **I want** this Price List Template behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Negative

**Preconditions**

Login เป็น Procurement Manager; เปิดฟอร์มสร้าง template ใหม่ได้

**Steps**

1. ไปที่ /vendor-management/price-list-template/new
2. เปิด Status dropdown ใน summary aside
3. ตรวจสอบตัวเลือกที่มี

**Expected**

Status เป็น dropdown ที่มีเฉพาะ Draft / Active / Inactive (3 ตัวเลือก) — ไม่รับค่าอิสระ/ไม่ถูกต้อง

> _Note: status enum is z.enum(['draft','active','inactive']); the Select cannot accept any other value._

---

## TC-PT-050004 — Cannot change status - No Permission

> **As a** Admin user, **I want** this Price List Template behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

Login เป็น Procurement Staff (อ่าน template ได้แต่ไม่มีสิทธิ์แก้ไข)

**Steps**

1. ไปที่ /vendor-management/price-list-template
2. เปิด template รายการแรก (view mode)
3. มองหา Status dropdown ที่แก้ไขได้

**Expected**

ไม่มี Status dropdown ให้ Procurement Staff (status แก้ได้เฉพาะ edit mode ซึ่ง staff เข้าไม่ได้ — view mode แสดงเป็น StatusPill อ่านอย่างเดียว)

> _Note: The editable status Select renders only in edit mode; a read-only viewer sees a StatusPill instead._

---

## TC-PT-050005 — Template Status Change - Edge Case (rapid toggle)

> **As a** Admin user, **I want** this Price List Template behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Edge Case

**Preconditions**

Login เป็น Procurement Manager; มี currency อย่างน้อย 1 รายการ

**Steps**

1. ไปที่ /vendor-management/price-list-template/new
2. กรอกชื่อ + เลือก currency
3. สลับ Status Active → Inactive → Active ติดต่อกันอย่างรวดเร็ว
4. คลิก 'Save'

**Expected**

การสลับ status หลายครั้งไม่ทำให้ฟอร์มพัง; template ถูกบันทึกสำเร็จ (success toast)

> _Note: Rapidly cycling the status Select must not break submit; the last selection persists._

---

## TC-PT-050050 — เปิด delete dialog แล้ว Cancel — template ยังอยู่

> **As a** Admin user, **I want** to delete a Price List Template record, **so that** the list reflects only valid entries.

**Priority:** Medium · **Test Type:** CRUD

**Preconditions**

TC-PT-200050 ผ่านแล้ว → template ADMIN_NAME_UPDATED ยังอยู่ใน DB; login carmensoftware.dev+admin@gmail.com; active BU = BLAVG

**Steps**

1. ไป list ค้นหา ADMIN_NAME_UPDATED
2. เปิด row actions
3. กด 'Delete'
4. ใน dialog กด 'Cancel'
5. ตรวจสอบว่า template ยังอยู่

**Expected**

template ADMIN_NAME_UPDATED ยังคงอยู่ใน list (ไม่ถูกลบ)

---

## TC-PT-050051 — ลบ template (admin/BLAVG) cleanup

> **As a** Admin user, **I want** to delete a Price List Template record, **so that** the list reflects only valid entries.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

TC-PT-050050 ผ่านแล้ว → template ADMIN_NAME_UPDATED ยังอยู่ใน DB; login carmensoftware.dev+admin@gmail.com; active BU = BLAVG

**Steps**

1. ไป list ค้นหา ADMIN_NAME_UPDATED
2. เปิด row actions
3. กด 'Delete'
4. ใน dialog ยืนยัน Delete
5. ตรวจสอบ success toast

**Expected**

success toast ('deleted/success/สำเร็จ') ปรากฏภายใน 10s (template ถูกลบ — ปิดท้าย serial chain)

---

## TC-PT-060001 — Search and View Templates - Happy Path

> **As a** Admin user, **I want** this Price List Template behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Happy Path

**Preconditions**

Login เข้า Carmen Blue พร้อมสิทธิ์ดู template

**Steps**

1. ไปที่ /vendor-management/price-list-template
2. คลิก status tab 'All'
3. กรอก 'example' ในช่องค้นหา
4. คลิก 'Search'
5. คลิก template card

**Expected**

ระบบแสดงหน้า detail ของ template พร้อมข้อมูล template ที่เกี่ยวข้อง

---

## TC-PT-060002 — Search and View Templates - Negative - Invalid Search Term

> **As a** Admin user, **I want** this Price List Template behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

Login เข้า Carmen Blue พร้อมสิทธิ์ดู template

**Steps**

1. ไปที่ /vendor-management/price-list-template
2. กรอก 'nonexistent' ในช่องค้นหา
3. คลิก 'Search'

**Expected**

ระบบแสดงข้อความแจ้งว่าไม่พบ template ที่ตรงกัน

---

## TC-PT-060003 — Search and View Templates - Negative - Insufficient Permission

> **As a** Admin user, **I want** this Price List Template behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

Login เข้า Carmen Blue แต่ไม่มีสิทธิ์ดู template

**Steps**

1. ไปที่ /vendor-management/price-list-template

**Expected**

ระบบ redirect ผู้ใช้ไปยังหน้าไม่มีสิทธิ์เข้าถึงหรือแสดงข้อความปฏิเสธสิทธิ์

---

## TC-PT-060004 — Search and View Templates - Edge Case - Filter by Product Count

> **As a** Admin user, **I want** this Price List Template behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Edge Case

**Preconditions**

Login เข้า Carmen Blue พร้อมสิทธิ์ดู template

**Steps**

1. ไปที่ /vendor-management/price-list-template
2. คลิก status tab 'All'
3. คลิก 'Filter by Product Count'
4. กรอก '0' ในช่องจำนวนต่ำสุด
5. กรอก '10' ในช่องจำนวนสูงสุด
6. คลิก 'Apply Filter'

**Expected**

ระบบแสดง list ของ template ที่กรองแล้วโดยมีจำนวน product อยู่ในช่วงที่ระบุ

---

## TC-PT-060005 — Search and View Templates - Edge Case - Sort by Name (Z-A)

> **As a** Admin user, **I want** this Price List Template behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Edge Case

**Preconditions**

Login เข้า Carmen Blue พร้อมสิทธิ์ดู template

**Steps**

1. ไปที่ /vendor-management/price-list-template
2. คลิก status tab 'All'
3. คลิก header คอลัมน์ 'Name'
4. คลิกตัวเลือกเรียงลำดับ 'Z-A'

**Expected**

ระบบเรียงลำดับ list ของ template ตามตัวอักษรจาก Z-A ตามชื่อ template

---

## TC-PT-200050 — สร้าง template ชื่อซ้ำ ต้องถูก reject

> **As a** Admin user, **I want** this Price List Template behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

TC-PT-040050 ผ่านแล้ว → template ADMIN_NAME_UPDATED มีอยู่ใน DB; login carmensoftware.dev+admin@gmail.com; active BU = BLAVG

**Steps**

1. เปิดหน้า /new
2. กรอกชื่อ = ADMIN_NAME_UPDATED (ซ้ำ) + เลือก currency
3. กด 'Save'

**Expected**

รายการที่สองไม่ถูกสร้าง: มี error toast (backend reject duplicate name) — ไม่มี success toast

---


<sub>Last regenerated: 2026-09-20 · git e45b917</sub>
