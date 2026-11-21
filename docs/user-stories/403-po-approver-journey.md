# Po Approver Journey — User Stories

_Generated from `tests/403-po-approver-journey.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Po Approver Journey
**Spec:** `tests/403-po-approver-journey.spec.ts`
**Default role:** FC
**Total test cases:** 19 (12 High / 6 Medium / 1 Low)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-PO-070101 | My Approval dashboard loads with Total Pending count visible | High | Smoke |
| TC-PO-070102 | PO filter tab shows pending POs (DRAFT + IN PROGRESS) | High | Functional |
| TC-PO-070103 | Click pending PO row navigates to PO detail | High | Smoke |
| TC-PO-070201 | PO Detail loads in IN PROGRESS view (FC perspective) | High | Smoke |
| TC-PO-070202 | Header fields are read-only for FC (cannot edit vendor/date/etc.) | High | Authorization |
| TC-PO-070203 | Edit button + Comment button visible | Medium | Functional |
| TC-PO-070301 | Edit mode → select item → Approve toolbar appears | High | Smoke |
| TC-PO-070302 | Mark item Approved → green badge appears on item row | High | CRUD |
| TC-PO-070303 | Mark item Review → amber badge + Send Back footer button appears | High | CRUD |
| TC-PO-070304 | Mark item Reject → reject badge + footer Reject button appears | Medium | CRUD |
| TC-PO-070305 | All items Approved → Document Approve button enabled in footer | High | Functional |
| TC-PO-070306 | Click Approve PO → confirmation dialog ('Once approved, PO will be sent to vendor') | High | Smoke |
| TC-PO-070307 | Confirm Approve → PATCH approve สำเร็จ และใบเลื่อนไปขั้น GM | High | CRUD |
| TC-PO-070308 | Click Send Back → dialog with stage selector + per-item reason | Medium | Smoke |
| TC-PO-070309 | Confirm Send Back → PO returned (status updates) | Medium | CRUD |
| TC-PO-070310 | Click Reject → dialog with optional reason field | Medium | Smoke |
| TC-PO-070311 | Confirm Reject → PO ends Voided (the app's rejected end state) | Medium | CRUD |
| TC-PO-070312 | Cancel edit mode (no item marked) → exits without saving | Low | Functional |
| TC-PO-070901 | Full FC flow: My Approval → open PO → Edit → mark all items Approved → Document Approve → GM approve → APPROVED | High | Smoke |

---

## TC-PO-070101 — My Approval dashboard loads with Total Pending count visible

> **As a** FC user, **I want** core Po Approver Journey interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

Login เป็น FC (carmensoftware.dev+fc@gmail.com)

**Steps**

1. ไปที่ /procurement/my-approval
2. ตรวจสอบการ์ด 'Total Pending'

**Expected**

URL เป็น /procurement/my-approval และการ์ด 'Total Pending N' visible

---

## TC-PO-070102 — PO filter tab shows pending POs (DRAFT + IN PROGRESS)

> **As a** FC user, **I want** to filter the Po Approver Journey list, **so that** I can narrow results to relevant records.

**Priority:** High · **Test Type:** Functional

**Preconditions**

อยู่ที่ My Approval dashboard พร้อม PO ที่รอดำเนินการอย่างน้อยหนึ่งรายการ

**Steps**

1. กดชิป filter Purchase Order บนหน้า My Approval
2. ตรวจสอบว่าชิปถูกเลือก

**Expected**

ชิป Purchase Order ถูกเลือก (aria-pressed=true)

---

## TC-PO-070103 — Click pending PO row navigates to PO detail

> **As a** FC user, **I want** core Po Approver Journey interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

อยู่ที่ My Approval dashboard พร้อมแถว PO ที่รอดำเนินการอย่างน้อยหนึ่งแถว (seeded ผ่าน submitPOAsPurchaser)

**Steps**

1. Seed PO ผ่าน Purchaser context
2. ไปที่ dashboard
3. คลิกแถว PO ที่ seed

**Expected**

URL navigate ไปยัง /procurement/purchase-order/<ref>

---

## TC-PO-070201 — PO Detail loads in IN PROGRESS view (FC perspective)

> **As a** FC user, **I want** core Po Approver Journey interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

มี PO ที่มี status IN PROGRESS (seeded ผ่าน submitPOAsPurchaser)

**Steps**

1. เปิดหน้า detail ของ PO ในฐานะ FC
2. ตรวจสอบ URL และ status badge

**Expected**

URL เป็น /procurement/purchase-order/<ref>; text ของ status badge ตรงกับ /in.progress/i

---

## TC-PO-070202 — Header fields are read-only for FC (cannot edit vendor/date/etc.)

> **As a** low-privilege user, **I should NOT** see Add/edit controls on Po Approver Journey, **so that** role separation is enforced.

**Priority:** High · **Test Type:** Authorization

**Preconditions**

อยู่ที่หน้า detail ของ IN PROGRESS PO ในฐานะ FC

**Steps**

1. ตรวจสอบ input ของ vendor / description / delivery date
2. ตรวจสอบว่า input เหล่านั้นถูก disable หรือแก้ไขไม่ได้

**Expected**

header ของ FC ใน view mode เป็นข้อความ: ไม่มีตัวเลือก vendor / delivery date / ช่องกรอก description

---

## TC-PO-070203 — Edit button + Comment button visible

> **As a** FC user, **I want** this Po Approver Journey interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

อยู่ที่หน้า detail ของ IN PROGRESS PO ในฐานะ FC

**Steps**

1. ตรวจสอบ action toolbar

**Expected**

ปุ่ม Edit visible ปุ่ม Comment visible เมื่อมี

---

## TC-PO-070301 — Edit mode → select item → Approve toolbar appears

> **As a** FC user, **I want** core Po Approver Journey interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

มี IN PROGRESS PO ที่มี ≥1 รายการ (seeded ผ่าน submitPOAsPurchaser)

**Steps**

1. เปิดหน้า detail ของ PO
2. กด Edit
3. เลือกรายการแรกผ่าน row checkbox

**Expected**

Item action toolbar (Approve/Review/Reject) visible

---

## TC-PO-070302 — Mark item Approved → green badge appears on item row

> **As a** FC user, **I want** to manage Po Approver Journey records via CRUD, **so that** the data stays correct over time.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

Item action toolbar visible บนแถว

**Steps**

1. เลือกรายการ
2. กด Approve ใน toolbar
3. ตรวจสอบ badge

**Expected**

แถวรายการแสดง badge Approved

---

## TC-PO-070303 — Mark item Review → amber badge + Send Back footer button appears

> **As a** FC user, **I want** to manage Po Approver Journey records via CRUD, **so that** the data stays correct over time.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

Item action toolbar visible บนแถว

**Steps**

1. เลือกรายการ
2. กด Review ใน toolbar
3. ตรวจสอบ badge + ปุ่ม footer

**Expected**

แถวรายการแสดง badge Review; ปุ่ม Send Back ของเอกสาร visible ใน footer

---

## TC-PO-070304 — Mark item Reject → reject badge + footer Reject button appears

> **As a** FC user, **I want** to manage Po Approver Journey records via CRUD, **so that** the data stays correct over time.

**Priority:** Medium · **Test Type:** CRUD

**Preconditions**

Item action toolbar visible บนแถว

**Steps**

1. เลือกรายการ
2. กด Reject ใน toolbar
3. ยืนยันใน dialog
4. ตรวจสอบ badge + ปุ่ม footer

**Expected**

แถวรายการแสดง badge Reject; ปุ่ม Reject ของเอกสาร visible ใน footer

---

## TC-PO-070305 — All items Approved → Document Approve button enabled in footer

> **As a** FC user, **I want** this Po Approver Journey interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

มี IN PROGRESS PO ที่มี ≥1 รายการ

**Steps**

1. เข้าสู่ edit mode
2. เลือกรายการและทำเครื่องหมาย Approve
3. ตรวจสอบปุ่ม Document Approve

**Expected**

ปุ่ม Document Approve visible (และ enabled เมื่อมี)

---

## TC-PO-070306 — Click Approve PO → confirmation dialog ('Once approved, PO will be sent to vendor')

> **As a** FC user, **I want** core Po Approver Journey interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

รายการทั้งหมดถูกทำเครื่องหมาย Approved; ปุ่ม Document Approve visible

**Steps**

1. approve รายการทั้งหมด
2. กดปุ่ม Document Approve PO

**Expected**

Confirmation dialog visible

---

## TC-PO-070307 — Confirm Approve → PATCH approve สำเร็จ และใบเลื่อนไปขั้น GM

> **As a** GM user, **I want** to manage Po Approver Journey records via CRUD, **so that** the data stays correct over time.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

Confirmation dialog ของ Document Approve เปิดอยู่

**Steps**

1. approve รายการ
2. กด Document Approve
3. ยืนยัน dialog

**Expected**

PATCH .../approve ตอบ ok; ใบยังเป็น IN PROGRESS (เลื่อนไปขั้น GM ตาม workflow General PO) และ FC ไม่เห็นปุ่ม Edit อีก

---

## TC-PO-070308 — Click Send Back → dialog with stage selector + per-item reason

> **As a** FC user, **I want** core Po Approver Journey interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** Medium · **Test Type:** Smoke

**Preconditions**

รายการถูกทำเครื่องหมาย Review; ปุ่ม Document Send Back visible

**Steps**

1. ทำเครื่องหมายรายการว่า Review
2. กด Document Send Back

**Expected**

Send Back dialog visible

---

## TC-PO-070309 — Confirm Send Back → PO returned (status updates)

> **As a** FC user, **I want** to edit an existing Po Approver Journey record, **so that** its data stays accurate.

**Priority:** Medium · **Test Type:** CRUD

**Preconditions**

Send Back dialog เปิดอยู่

**Steps**

1. ทำเครื่องหมายรายการว่า Review
2. กด Send Back
3. กรอกเหตุผล
4. ยืนยัน

**Expected**

URL ยังคงอยู่ที่ PO ref หลังการยืนยัน

---

## TC-PO-070310 — Click Reject → dialog with optional reason field

> **As a** FC user, **I want** core Po Approver Journey interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** Medium · **Test Type:** Smoke

**Preconditions**

รายการถูกทำเครื่องหมาย Reject; ปุ่ม Document Reject visible

**Steps**

1. ทำเครื่องหมายรายการว่า Reject
2. กด Document Reject

**Expected**

Reject dialog visible

---

## TC-PO-070311 — Confirm Reject → PO ends Voided (the app's rejected end state)

> **As a** FC user, **I want** to manage Po Approver Journey records via CRUD, **so that** the data stays correct over time.

**Priority:** Medium · **Test Type:** CRUD

**Preconditions**

Reject dialog เปิดอยู่

**Steps**

1. ทำเครื่องหมายรายการว่า Reject
2. กด Document Reject
3. ยืนยันใน dialog แรก (are you sure)
4. กรอกเหตุผลใน dialog ที่สอง แล้วยืนยัน

**Expected**

การยืนยันยิง PATCH .../reject สำเร็จ และ PO ที่เปิดใหม่มี status chip Voided (PO ไม่มี status Rejected — STD dataset po.rejected ก็จบที่ Voided).

---

## TC-PO-070312 — Cancel edit mode (no item marked) → exits without saving

> **As a** FC user, **I want** this Po Approver Journey interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Low · **Test Type:** Functional

**Preconditions**

edit mode active บน IN PROGRESS PO โดยไม่มีรายการที่ถูกทำเครื่องหมาย

**Steps**

1. เข้าสู่ edit mode
2. กด Cancel โดยไม่เลือก/ทำเครื่องหมายรายการใดๆ

**Expected**

Form กลับสู่ view mode (ปุ่ม Edit visible อีกครั้ง)

---

## TC-PO-070901 — Full FC flow: My Approval → open PO → Edit → mark all items Approved → Document Approve → GM approve → APPROVED

> **As a** FC user, **I want** core Po Approver Journey interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

Login เป็น FC; มี IN PROGRESS PO ใหม่ที่ seed ผ่าน submitPOAsPurchaser

**Steps**

1. Seed IN PROGRESS PO
2. เปิดหน้า detail ของ PO
3. กด Edit
4. เลือกรายการแรก
5. ทำเครื่องหมาย Approve
6. กด Document Approve
7. ยืนยัน dialog

**Expected**

PATCH .../approve ของ FC ตอบ ok และหลัง GM อนุมัติต่อ status badge เป็น APPROVED/SENT

---


<sub>Last regenerated: 2026-11-21 · git 9d79c62</sub>
