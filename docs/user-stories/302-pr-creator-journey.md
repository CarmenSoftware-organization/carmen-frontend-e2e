# Pr Creator Journey — User Stories

_Generated from `tests/302-pr-creator-journey.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Pr Creator Journey
**Spec:** `tests/302-pr-creator-journey.spec.ts`
**Default role:** Requestor
**Total test cases:** 42 (18 High / 22 Medium / 2 Low)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-PR-050101 | List loads with My Pending tab and Creator's PRs visible | High | Smoke |
| TC-PR-050102 | Switch to All Documents tab broadens scope | Medium | Functional |
| TC-PR-050103 | Search by reference number filters list | Medium | Functional |
| TC-PR-050104 | Filter by status (Draft) | Medium | Functional |
| TC-PR-050105 | Sort list by Date | Low | Functional |
| TC-PR-050106 | Click row navigates to PR detail | High | Smoke |
| TC-PR-050107 | New PR button opens create dialog | High | Smoke |
| TC-PR-050150 | active BU = BLAVG | High | Smoke |
| TC-PR-050201 | Open Create dialog → Blank → form loads | High | Smoke |
| TC-PR-050202 | Default values populated on the new form | High | Functional |
| TC-PR-050203 | Fill header fields | High | CRUD |
| TC-PR-050204 | Add 1 basic line item | High | CRUD |
| TC-PR-050205 | Add line item with FOC flag | Medium | CRUD |
| TC-PR-050206 | Add multiple line items — form stays on /new | Medium | CRUD |
| TC-PR-050207 | Edit line item before save | Medium | CRUD |
| TC-PR-050208 | Remove line item | Medium | CRUD |
| TC-PR-050209 | Save as Draft → redirect to detail with PR number | High | CRUD |
| TC-PR-050210 | Save without line items → button disabled or stays on form | Medium | Validation |
| TC-PR-050211 | Delivery date in the past → calendar blocks past days | Medium | Validation |
| TC-PR-050301 | Open Create dialog → Template option → picker opens | Medium | Smoke |
| TC-PR-050302 | Select first template → form pre-fills | Medium | Functional |
| TC-PR-050303 | Modify template-loaded items before save | Medium | CRUD |
| TC-PR-050304 | Save template-based PR → Draft created | Medium | CRUD |
| TC-PR-050305 | Empty-state message when no template matches the search | Low | Functional |
| TC-PR-050401 | Draft PR detail loads with Items tab default | High | Smoke |
| TC-PR-050402 | Switch to Workflow History tab | Medium | Functional |
| TC-PR-050403 | Edit / Delete / Submit buttons present for Draft | High | Functional |
| TC-PR-050404 | Edit / Delete absent when status is In Progress | Medium | Authorization |
| TC-PR-050501 | Click Edit → enter edit mode | High | Smoke |
| TC-PR-050502 | Modify header description in edit mode | Medium | CRUD |
| TC-PR-050503 | Modify line item quantity in edit mode | Medium | CRUD |
| TC-PR-050504 | Add line item in edit mode | Medium | CRUD |
| TC-PR-050505 | Save → exit edit mode + persist changes | High | CRUD |
| TC-PR-050506 | Cancel → discard changes, restore original | Medium | Functional |
| TC-PR-050601 | Submit → confirmation dialog appears | High | Smoke |
| TC-PR-050602 | Cancel submit → stays on Draft | Medium | Functional |
| TC-PR-050603 | Confirm submit → status moves to In Progress | High | CRUD |
| TC-PR-050604 | Submit empty PR — button disabled or no transition | Medium | Validation |
| TC-PR-050801 | Click Delete → confirmation dialog | High | Smoke |
| TC-PR-050802 | Cancel delete → PR remains | Medium | Functional |
| TC-PR-050803 | Confirm delete → list refreshed, PR gone | High | CRUD |
| TC-PR-050901 | Full Creator flow: List → Create → Save Draft → Edit → Submit → In Progress | High | Smoke |

---

## TC-PR-050101 — List loads with My Pending tab and Creator's PRs visible

> **As a** Requestor user, **I want** the Pr Creator Journey list page to load successfully, **so that** I can manage Pr Creator Journey records.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

Login เป็น Requestor (carmensoftware.dev+requestor@gmail.com)

**Steps**

1. ไปที่ /procurement/purchase-request
2. ตรวจสอบว่า My Pending tab ถูกเลือกเป็นค่าเริ่มต้น
3. ตรวจสอบว่าตาราง list แสดงผล

**Expected**

URL เป็น /procurement/purchase-request, ปุ่ม viewMode 'My Pending' แสดง (เป็น view เริ่มต้น), ตารางหรือ empty-state แสดงผล

---

## TC-PR-050102 — Switch to All Documents tab broadens scope

> **As a** Requestor user, **I want** this Pr Creator Journey interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

อยู่ที่หน้า PR list

**Steps**

1. คลิก tab All Documents
2. ตรวจสอบว่า list รีเฟรช

**Expected**

หลังคลิก All Documents URL มี ?view=all-document

---

## TC-PR-050103 — Search by reference number filters list

> **As a** Requestor user, **I want** to filter the Pr Creator Journey list, **so that** I can narrow results to relevant records.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

อยู่ที่หน้า PR list; มี PR อย่างน้อยหนึ่งรายการที่มีเลขอ้างอิงที่รู้จัก

**Steps**

1. คลิกช่องค้นหา
2. พิมพ์เลขอ้างอิงบางส่วน
3. รอให้ list กรองข้อมูล

**Expected**

ค้น PR2611 แล้วทุกแถวที่แสดงมีข้อความนั้น; ค้นข้อความที่ไม่มีอยู่แล้วไม่เหลือแถว

---

## TC-PR-050104 — Filter by status (Draft)

> **As a** Requestor user, **I want** to filter the Pr Creator Journey list, **so that** I can narrow results to relevant records.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

อยู่ที่หน้า PR list

**Steps**

1. เปิดแผง Filter
2. เลือกฟิลด์ Status แล้วติ๊ก Draft (ไม่มีปุ่ม Apply)

**Expected**

ทุกแถวที่แสดงมีสถานะ Draft (requestor มี Draft จากชุดข้อมูลทดสอบ)

---

## TC-PR-050105 — Sort list by Date

> **As a** Requestor user, **I want** to sort the Pr Creator Journey list, **so that** I can find records in a useful order.

**Priority:** Low · **Test Type:** Functional

**Preconditions**

อยู่ที่หน้า PR list

**Steps**

1. คลิก header คอลัมน์ Date เพื่อ sort
2. ตรวจสอบว่า list เรียงลำดับใหม่

**Expected**

header คอลัมน์แสดง sort indicator และ list เรียงลำดับใหม่

---

## TC-PR-050106 — Click row navigates to PR detail

> **As a** Requestor user, **I want** core Pr Creator Journey interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

อยู่ที่หน้า PR list; มีแถว PR อย่างน้อยหนึ่งแถว

**Steps**

1. คลิกแถว PR แรก

**Expected**

นำทางไปยัง /procurement/purchase-request/<id>

---

## TC-PR-050107 — New PR button opens create dialog

> **As a** Requestor user, **I want** core Pr Creator Journey interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

อยู่ที่หน้า PR list

**Steps**

1. คลิก New Purchase Request

**Expected**

dialog สร้างใหม่เปิดขึ้น หรือ URL เปลี่ยนเป็น /new

---

## TC-PR-050150 — active BU = BLAVG

> **As a** Requestor user, **I want** core Pr Creator Journey interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

Login เป็น carmensoftware.dev+requestor@gmail.com ผ่าน auth fixture

**Steps**

1. เรียก ensureActiveBu(BLAVG)
2. อ่าน profile API
3. หา business unit ที่ is_default
4. อ่าน label ของ BU switcher

**Expected**

default business unit มี code === 'BLAVG'; trigger ของ BU switcher แสดง label ของ BU นั้น

---

## TC-PR-050201 — Open Create dialog → Blank → form loads

> **As a** Requestor user, **I want** core Pr Creator Journey interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

Login เป็น Requestor; อยู่ที่หน้า PR list

**Steps**

1. คลิก New Purchase Request
2. เลือกตัวเลือก Blank PR (ถ้า dialog ปรากฏ)
3. รอให้ฟอร์มสร้างโหลด

**Expected**

URL เปลี่ยนเป็น /procurement/purchase-request/new และฟอร์มสร้างแสดงผล

---

## TC-PR-050202 — Default values populated on the new form

> **As a** Requestor user, **I want** this Pr Creator Journey interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

อยู่ที่ฟอร์มสร้าง PR

**Steps**

1. ไปที่ /new
2. ตรวจสอบค่า default ของ date, department, location, currency, status

**Expected**

ฟอร์มอยู่ที่ /new มีปุ่ม Add Item, workflow ยังไม่เลือก (Select workflow) และยังไม่มีรายการสินค้า

---

## TC-PR-050203 — Fill header fields

> **As a** Requestor user, **I want** to manage Pr Creator Journey records via CRUD, **so that** the data stays correct over time.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

อยู่ที่ฟอร์มสร้าง PR

**Steps**

1. ตั้ง PR type = General
2. ตั้ง delivery date เป็นวันในอนาคต
3. กรอก description และ notes

**Expected**

ช่อง description มีค่าที่กรอก (มี E2E-PRC marker)

---

## TC-PR-050204 — Add 1 basic line item

> **As a** Requestor user, **I want** to create a new Pr Creator Journey record, **so that** it becomes available for downstream operations.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

อยู่ที่ฟอร์มสร้าง PR โดยกรอก header แล้ว

**Steps**

1. คลิก Add Item
2. กรอก product, qty, uom, unit price
3. บันทึกรายการ

**Expected**

ตารางมี 1 แถว (requested qty = 1) และฟอร์มยังอยู่ที่ /new

---

## TC-PR-050205 — Add line item with FOC flag

> **As a** Requestor user, **I want** to create a new Pr Creator Journey record, **so that** it becomes available for downstream operations.

**Priority:** Medium · **Test Type:** CRUD

**Preconditions**

อยู่ที่ฟอร์มสร้าง PR โดยกรอก header แล้ว

**Steps**

1. เพิ่มรายการ
2. Toggle checkbox FOC
3. บันทึก

**Expected**

ช่อง FOC qty ของแถวเก็บค่า 5 ไว้

---

## TC-PR-050206 — Add multiple line items — form stays on /new

> **As a** Requestor user, **I want** to create a new Pr Creator Journey record, **so that** it becomes available for downstream operations.

**Priority:** Medium · **Test Type:** CRUD

**Preconditions**

อยู่ที่ฟอร์มสร้าง PR

**Steps**

1. เพิ่มรายการสินค้า 3 รายการที่ราคาต่างกัน
2. ตรวจสอบว่าฟอร์มยังแสดงอยู่

**Expected**

หลังเพิ่ม 3 รายการ ตารางมี 3 แถว (ช่อง requested qty 3 ช่อง)

---

## TC-PR-050207 — Edit line item before save

> **As a** Requestor user, **I want** to edit an existing Pr Creator Journey record, **so that** its data stays accurate.

**Priority:** Medium · **Test Type:** CRUD

**Preconditions**

กรอก header แล้วและเพิ่มรายการสินค้าอย่างน้อยหนึ่งรายการ

**Steps**

1. เพิ่ม 1 รายการ
2. แก้ไขจำนวน
3. บันทึกรายการ

**Expected**

ช่อง requested qty ของรายการแรกเปลี่ยนเป็น 5

---

## TC-PR-050208 — Remove line item

> **As a** Requestor user, **I want** to delete a Pr Creator Journey record, **so that** the list reflects only valid entries.

**Priority:** Medium · **Test Type:** CRUD

**Preconditions**

กรอก header แล้วและเพิ่มรายการสินค้าอย่างน้อยหนึ่งรายการ

**Steps**

1. เพิ่มรายการ
2. คลิกปุ่มลบรายการนั้น

**Expected**

แถวถูกลบออกจากตาราง (ไม่เหลือช่อง requested qty)

---

## TC-PR-050209 — Save as Draft → redirect to detail with PR number

> **As a** Requestor user, **I want** to manage Pr Creator Journey records via CRUD, **so that** the data stays correct over time.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

กรอก header และมีรายการสินค้า ≥1 รายการ

**Steps**

1. คลิก Save as Draft
2. รอ redirect ไปยังหน้ารายละเอียด

**Expected**

URL เปลี่ยนเป็น /purchase-request/<id> (ไม่ใช่ /new) และหน้ารายละเอียดแสดงเลขเอกสารร่างที่ระบบออกให้ (รูปแบบ draft-N) พร้อมสถานะ DRAFT

---

## TC-PR-050210 — Save without line items → button disabled or stays on form

> **As a** Requestor user, **I want** the system to block invalid Pr Creator Journey submissions, **so that** data quality is preserved.

**Priority:** Medium · **Test Type:** Validation

**Preconditions**

อยู่ที่ฟอร์มสร้าง PR โดยกรอก header แล้วแต่ไม่มีรายการสินค้า

**Steps**

1. กรอก header
2. คลิก Save as Draft โดยไม่เพิ่มรายการสินค้าใดๆ

**Expected**

ปุ่ม Save ถูก disabled หรือฟอร์มไม่นำทางออกจาก /new

---

## TC-PR-050211 — Delivery date in the past → calendar blocks past days

> **As a** Requestor user, **I want** the system to block invalid Pr Creator Journey submissions, **so that** data quality is preserved.

**Priority:** Medium · **Test Type:** Validation

**Preconditions**

อยู่ที่ฟอร์มสร้าง PR

**Steps**

1. ตั้ง delivery date เป็นวันที่ในอดีต
2. เพิ่มรายการ
3. พยายามบันทึก

**Expected**

ปฏิทินวันส่งของของรายการมีวันที่ก่อนวันนี้ที่เลือกไม่ได้ (disabled) — เลือกวันอดีตไม่ได้

---

## TC-PR-050301 — Open Create dialog → Template option → picker opens

> **As a** Requestor user, **I want** core Pr Creator Journey interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** Medium · **Test Type:** Smoke

**Preconditions**

Login เป็น Requestor; อยู่ที่หน้า PR list

**Steps**

1. คลิก New Purchase Request
2. เลือกตัวเลือก From-Template ใน dialog

**Expected**

Template picker (dialog หรือ listbox) แสดงผลหลังเลือกตัวเลือก From-Template

---

## TC-PR-050302 — Select first template → form pre-fills

> **As a** Requestor user, **I want** this Pr Creator Journey interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

Template picker เปิดอยู่และมี template อย่างน้อยหนึ่งรายการ

**Steps**

1. เปิด template picker
2. เลือก template แรก

**Expected**

URL มี query param template_id (ฟอร์มกำลังโหลดจาก template)

---

## TC-PR-050303 — Modify template-loaded items before save

> **As a** Requestor user, **I want** to manage Pr Creator Journey records via CRUD, **so that** the data stays correct over time.

**Priority:** Medium · **Test Type:** CRUD

**Preconditions**

อยู่ที่ฟอร์มสร้างจาก template ที่มีรายการสินค้ากรอกล่วงหน้า

**Steps**

1. เปิดฟอร์ม template
2. แก้ไขจำนวนรายการสินค้าแรกที่กรอกล่วงหน้า

**Expected**

ช่อง requested qty ของรายการจาก template เปลี่ยนเป็น 9

---

## TC-PR-050304 — Save template-based PR → Draft created

> **As a** Requestor user, **I want** to create a new Pr Creator Journey record, **so that** it becomes available for downstream operations.

**Priority:** Medium · **Test Type:** CRUD

**Preconditions**

ฟอร์มจาก template มีรายการสินค้ากรอกล่วงหน้า

**Steps**

1. เปิดฟอร์ม template
2. คลิก Save as Draft

**Expected**

URL เปลี่ยนเป็น /purchase-request/<id> (ไม่ใช่ /new) หลังบันทึก

---

## TC-PR-050305 — Empty-state message when no template matches the search

> **As a** Requestor user, **I want** a clear empty-state when no Pr Creator Journey records match my search, **so that** I know nothing was found.

**Priority:** Low · **Test Type:** Functional

**Preconditions**

Template picker เปิดอยู่และไม่มี template ในระบบ

**Steps**

1. เปิด template picker
2. ตรวจสอบเนื้อหา

**Expected**

ค้นหา template ที่ไม่มีอยู่แล้วแสดง empty-state ('No Templates Available' / 'Try searching with different keywords') และไม่เหลือการ์ด

---

## TC-PR-050401 — Draft PR detail loads with Items tab default

> **As a** Requestor user, **I want** core Pr Creator Journey interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

มี Draft PR ของ Requestor นี้ (สร้างใน beforeEach)

**Steps**

1. เปิดหน้ารายละเอียด Draft PR
2. ตรวจสอบว่า Items tab ถูกเลือก

**Expected**

Detail URL เป็น /procurement/purchase-request/<ref>; ตารางรายการสินค้า (คอลัมน์ Product + อย่างน้อย 1 แถว) แสดงเป็นค่าเริ่มต้น

---

## TC-PR-050402 — Switch to Workflow History tab

> **As a** Requestor user, **I want** this Pr Creator Journey interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

PR ถูกสร้างและ submit แล้ว (Draft ไม่มี workflow stepper — ประวัติ workflow เริ่มเมื่อ submit)

**Steps**

1. คลิก tab Workflow History

**Expected**

หลังคลิกตัวเปิดประวัติ (stepper) แสดง sheet Workflow History

---

## TC-PR-050403 — Edit / Delete / Submit buttons present for Draft

> **As a** Requestor user, **I want** this Pr Creator Journey interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

อยู่ที่หน้ารายละเอียด Draft PR

**Steps**

1. ตรวจสอบ action toolbar

**Expected**

ปุ่ม Edit, Delete และ Submit แสดงผลทั้งหมดสำหรับสถานะ Draft

---

## TC-PR-050404 — Edit / Delete absent when status is In Progress

> **As a** low-privilege user, **I should NOT** see Add/edit controls on Pr Creator Journey, **so that** role separation is enforced.

**Priority:** Medium · **Test Type:** Authorization

**Preconditions**

มี PR ที่มีสถานะ In Progress (สร้างผ่านขั้นตอน Submit)

**Steps**

1. Submit Draft PR
2. โหลดหน้ารายละเอียดใหม่
3. ตรวจสอบ toolbar

**Expected**

ปุ่ม Edit และ Delete ไม่แสดงผล (โหมด read-only)

---

## TC-PR-050501 — Click Edit → enter edit mode

> **As a** Requestor user, **I want** core Pr Creator Journey interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

มี Draft PR ของ Requestor นี้

**Steps**

1. เปิด Draft PR
2. คลิก Edit

**Expected**

ฟอร์มสามารถแก้ไขได้; ปุ่ม Save (หรือ Cancel) ระดับฟอร์มแสดงผล

---

## TC-PR-050502 — Modify header description in edit mode

> **As a** Requestor user, **I want** to edit an existing Pr Creator Journey record, **so that** its data stays accurate.

**Priority:** Medium · **Test Type:** CRUD

**Preconditions**

Draft PR เปิดอยู่ในโหมดแก้ไข

**Steps**

1. เข้าโหมดแก้ไข
2. อัปเดต description
3. บันทึก

**Expected**

หลังบันทึก (toast สำเร็จ) เปิด PR ใหม่แล้วเห็น description ที่แก้

---

## TC-PR-050503 — Modify line item quantity in edit mode

> **As a** Requestor user, **I want** to edit an existing Pr Creator Journey record, **so that** its data stays accurate.

**Priority:** Medium · **Test Type:** CRUD

**Preconditions**

Draft PR ที่มีรายการสินค้าอย่างน้อยหนึ่งรายการเปิดอยู่ในโหมดแก้ไข

**Steps**

1. เข้าโหมดแก้ไข
2. แก้ไขจำนวนรายการสินค้าแรก
3. บันทึก

**Expected**

หลังบันทึก (toast สำเร็จ) เปิด PR ใหม่แล้วจำนวนของรายการแรกเป็น 7

---

## TC-PR-050504 — Add line item in edit mode

> **As a** Requestor user, **I want** to create a new Pr Creator Journey record, **so that** it becomes available for downstream operations.

**Priority:** Medium · **Test Type:** CRUD

**Preconditions**

Draft PR เปิดอยู่ในโหมดแก้ไข

**Steps**

1. เข้าโหมดแก้ไข
2. คลิก Add Item
3. กรอก product/qty/uom
4. บันทึก

**Expected**

หลังบันทึก (toast สำเร็จ) เปิด PR ใหม่แล้วมี 2 รายการ

---

## TC-PR-050505 — Save → exit edit mode + persist changes

> **As a** Requestor user, **I want** to edit an existing Pr Creator Journey record, **so that** its data stays accurate.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

Draft PR เปิดอยู่ในโหมดแก้ไขและมีการเปลี่ยนแปลงอย่างน้อยหนึ่งอย่าง

**Steps**

1. เข้าโหมดแก้ไข
2. ทำการเปลี่ยนแปลง
3. คลิก Save

**Expected**

ฟอร์มกลับสู่โหมดดู (ปุ่ม Edit แสดงผลอีกครั้งในหน้ารายละเอียด)

---

## TC-PR-050506 — Cancel → discard changes, restore original

> **As a** Requestor user, **I want** this Pr Creator Journey interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

Draft PR เปิดอยู่ในโหมดแก้ไข

**Steps**

1. เข้าโหมดแก้ไข
2. พิมพ์ใน description
3. คลิก Cancel

**Expected**

ฟอร์มกลับสู่โหมดดู (ปุ่ม Edit แสดงผลอีกครั้งในหน้ารายละเอียด)

---

## TC-PR-050601 — Submit → confirmation dialog appears

> **As a** Requestor user, **I want** core Pr Creator Journey interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

มี Draft PR ที่มีรายการสินค้า ≥1 รายการ

**Steps**

1. เปิด Draft PR
2. คลิก Submit

**Expected**

dialog ยืนยันแสดงผล

---

## TC-PR-050602 — Cancel submit → stays on Draft

> **As a** Requestor user, **I want** this Pr Creator Journey interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

dialog ยืนยัน submit เปิดอยู่

**Steps**

1. เปิด dialog Submit
2. คลิก Cancel

**Expected**

dialog ปิด; URL ยังคงอยู่ที่หน้ารายละเอียด (ไม่มีการเปลี่ยนสถานะ submit)

---

## TC-PR-050603 — Confirm submit → status moves to In Progress

> **As a** Requestor user, **I want** to manage Pr Creator Journey records via CRUD, **so that** the data stays correct over time.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

dialog ยืนยัน submit เปิดอยู่

**Steps**

1. เปิด dialog Submit
2. คลิก Confirm

**Expected**

badge สถานะอัปเดตเป็น In Progress (ยืนยันโดย submitDraftPR helper)

---

## TC-PR-050604 — Submit empty PR — button disabled or no transition

> **As a** Requestor user, **I want** the system to block invalid Pr Creator Journey submissions, **so that** data quality is preserved.

**Priority:** Medium · **Test Type:** Validation

**Preconditions**

มี Draft PR ที่ไม่มีรายการสินค้า

**Steps**

1. เปิด Draft PR ที่ไม่มีรายการสินค้า
2. ตรวจสอบปุ่ม Submit

**Expected**

ปุ่ม Submit ถูก disabled หรือการคลิกไม่เปลี่ยนสถานะเป็น In Progress (URL ยังคงอยู่ที่หน้ารายละเอียด)

---

## TC-PR-050801 — Click Delete → confirmation dialog

> **As a** Requestor user, **I want** core Pr Creator Journey interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

มี Draft PR ของ Requestor นี้

**Steps**

1. เปิด Draft PR
2. คลิก Delete

**Expected**

dialog ยืนยันการลบแสดงผล

---

## TC-PR-050802 — Cancel delete → PR remains

> **As a** Requestor user, **I want** this Pr Creator Journey interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

dialog ยืนยันการลบเปิดอยู่

**Steps**

1. เปิด dialog Delete
2. คลิก Cancel

**Expected**

dialog ปิด; URL ยังคงอยู่ที่หน้ารายละเอียด (PR ไม่ถูกลบ)

---

## TC-PR-050803 — Confirm delete → list refreshed, PR gone

> **As a** Requestor user, **I want** to delete a Pr Creator Journey record, **so that** the list reflects only valid entries.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

dialog ยืนยันการลบเปิดอยู่

**Steps**

1. เปิด dialog Delete
2. คลิก Confirm

**Expected**

หน้านำทางกลับไปที่ PR list และ backend ไม่พบ PR ใบนั้นอีก (GET ตอบ 404)

---

## TC-PR-050901 — Full Creator flow: List → Create → Save Draft → Edit → Submit → In Progress

> **As a** Requestor user, **I want** the Pr Creator Journey list page to load successfully, **so that** I can manage Pr Creator Journey records.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

Login เป็น Requestor; อยู่ที่หน้า PR list

**Steps**

1. เปิด list
2. คลิก New PR (Blank)
3. กรอก header + รายการสินค้า 1 รายการ
4. บันทึกเป็น Draft
5. เปิดหน้ารายละเอียดและคลิก Edit
6. แก้ไข description
7. บันทึก
8. คลิก Submit และ confirm

**Expected**

PR ถูกสร้าง (detail URL พร้อม ref), แก้ไขแล้ว (ปุ่ม Edit แสดงผลอีกครั้งหลังบันทึก), submit แล้ว (badge สถานะแสดง In Progress)

---


<sub>Last regenerated: 2026-11-21 · git 1107d0c</sub>
