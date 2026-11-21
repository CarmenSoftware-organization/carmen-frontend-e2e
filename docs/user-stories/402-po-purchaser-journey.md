# Po Purchaser Journey — User Stories

_Generated from `tests/402-po-purchaser-journey.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Po Purchaser Journey
**Spec:** `tests/402-po-purchaser-journey.spec.ts`
**Default role:** Purchase
**Total test cases:** 32 (14 High / 15 Medium / 3 Low)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-PO-060101 | List loads with PO statuses (DRAFT / IN PROGRESS / APPROVED / etc.) | High | Smoke |
| TC-PO-060102 | Switch to All Documents tab broadens scope | Medium | Functional |
| TC-PO-060103 | Filter by status (DRAFT) | Medium | Functional |
| TC-PO-060104 | Search by PO reference | Medium | Functional |
| TC-PO-060105 | Sort by Date | Low | Functional |
| TC-PO-060201 | Open Create dropdown → Blank → form loads | High | Smoke |
| TC-PO-060202 | Fill header (vendor, delivery date, description) + add 1 line item | High | CRUD |
| TC-PO-060203 | Save Draft → redirect to detail with PO number | High | CRUD |
| TC-PO-060204 | Save without items → button disabled or stays on /new | Medium | Validation |
| TC-PO-060205 | Open Create → From Price List → wizard step 1 (Select Vendors) | Medium | Smoke |
| TC-PO-060206 | Select vendor → wizard step 2 (Review items) | Medium | Functional |
| TC-PO-060207 | Submit Price List wizard → POs created (URL changes from /new to detail) | High | CRUD |
| TC-PO-060208 | Skip dynamically if no price list / vendors available | Low | Functional |
| TC-PO-060209 | Open Create → From PR → wizard step 1 (Select Approved PRs) | Medium | Smoke |
| TC-PO-060210 | Select approved PR → wizard step 2 (Review POs grouped by vendor) | Medium | Functional |
| TC-PO-060211 | Submit From PR wizard → POs created | High | CRUD |
| TC-PO-060212 | Skip dynamically if no approved PR available | Low | Functional |
| TC-PO-060301 | Detail loads (DRAFT) with header + items table | High | Smoke |
| TC-PO-060302 | Item Details panel — Details / Quantity / Pricing tabs | Medium | Functional |
| TC-PO-060303 | Edit / Delete / Submit buttons present for DRAFT | High | Functional |
| TC-PO-060304 | Read-only state for SENT/COMPLETED status (best-effort) | Medium | Authorization |
| TC-PO-060401 | Click Edit on DRAFT → edit mode active (Save/Cancel visible) | High | Smoke |
| TC-PO-060402 | Modify line item quantity → Save → URL stays on detail | High | CRUD |
| TC-PO-060403 | Add new line item in edit mode → Save | Medium | CRUD |
| TC-PO-060404 | Cancel edit → ยืนยัน Discard แล้วกลับสู่ view mode | Medium | Functional |
| TC-PO-060405 | Submit Draft PO → confirmation dialog → status moves to IN PROGRESS | High | CRUD |
| TC-PO-060406 | Delete IN PROGRESS PO via Edit Mode | Medium | CRUD |
| TC-PO-060501 | Approved PO has Send to Vendor + Close buttons (seeded via seedApprovedPO) | High | Functional |
| TC-PO-060502 | Click Send to Vendor → status updates / toast | High | CRUD |
| TC-PO-060503 | Close PO with items received → COMPLETED | Medium | CRUD |
| TC-PO-060504 | Close PO without items received → CLOSED | Medium | CRUD |
| TC-PO-060901 | Full Purchaser flow: Create blank → Save Draft → Submit → FC approves → Send to Vendor | High | Smoke |

---

## TC-PO-060101 — List loads with PO statuses (DRAFT / IN PROGRESS / APPROVED / etc.)

> **As a** Purchase user, **I want** the Po Purchaser Journey list page to load successfully, **so that** I can manage Po Purchaser Journey records.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

Login เป็น Purchaser (carmensoftware.dev+purchase@gmail.com)

**Steps**

1. ไปที่ /procurement/purchase-order
2. ตรวจสอบ URL และตรวจสอบว่า list table หรือ empty-state visible

**Expected**

URL อยู่ที่หน้า list ของ PO; ปุ่ม My Pending มองเห็นและถูกเลือก

---

## TC-PO-060102 — Switch to All Documents tab broadens scope

> **As a** Purchase user, **I want** this Po Purchaser Journey interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

อยู่ที่หน้า list ของ PO

**Steps**

1. กดแท็บ All Documents

**Expected**

แท็บ All Documents ถูกเลือก

---

## TC-PO-060103 — Filter by status (DRAFT)

> **As a** Purchase user, **I want** to filter the Po Purchaser Journey list, **so that** I can narrow results to relevant records.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

อยู่ที่หน้า list ของ PO

**Steps**

1. เปิดแผง Filter
2. เลือก status = DRAFT
3. Apply

**Expected**

URL ยังคงอยู่ที่หน้า list ของ PO หลัง apply filter

---

## TC-PO-060104 — Search by PO reference

> **As a** Purchase user, **I want** this Po Purchaser Journey interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

อยู่ที่หน้า list ของ PO

**Steps**

1. พิมพ์ reference บางส่วนในช่องค้นหา

**Expected**

URL ยังคงอยู่ที่หน้า list ของ PO หลังพิมพ์ในช่องค้นหา

---

## TC-PO-060105 — Sort by Date

> **As a** Purchase user, **I want** to sort the Po Purchaser Journey list, **so that** I can find records in a useful order.

**Priority:** Low · **Test Type:** Functional

**Preconditions**

อยู่ที่หน้า list ของ PO

**Steps**

1. คลิกหัวคอลัมน์ Date เพื่อเรียงลำดับ
2. ตรวจสอบว่ารายการเรียงลำดับใหม่

**Expected**

URL ยังคงอยู่ที่หน้า list ของ PO หลังคลิก sort

---

## TC-PO-060201 — Open Create dropdown → Blank → form loads

> **As a** Purchase user, **I want** core Po Purchaser Journey interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

Login เป็น Purchaser; อยู่ที่หน้า list ของ PO

**Steps**

1. กดปุ่ม dropdown New PO
2. เลือก option Blank/Manual PO
3. ตรวจสอบว่า URL เปลี่ยนเป็น /new

**Expected**

URL เปลี่ยนเป็น /procurement/purchase-order/new และ form visible

---

## TC-PO-060202 — Fill header (vendor, delivery date, description) + add 1 line item

> **As a** Purchase user, **I want** to create a new Po Purchaser Journey record, **so that** it becomes available for downstream operations.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

อยู่ที่ form สร้าง PO (blank)

**Steps**

1. กรอก vendor, description, delivery date
2. เพิ่ม 1 line item

**Expected**

Description input คงค่าที่กรอก (marker E2E-POP)

---

## TC-PO-060203 — Save Draft → redirect to detail with PO number

> **As a** Purchase user, **I want** to manage Po Purchaser Journey records via CRUD, **so that** the data stays correct over time.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

กรอก header + ≥1 line item บน form สร้าง

**Steps**

1. กดบันทึก
2. รอการ redirect ไปยังหน้า detail

**Expected**

URL เปลี่ยนเป็น /procurement/purchase-order/<id> (ไม่ใช่ /new)

---

## TC-PO-060204 — Save without items → button disabled or stays on /new

> **As a** Purchase user, **I want** the system to block invalid Po Purchaser Journey submissions, **so that** data quality is preserved.

**Priority:** Medium · **Test Type:** Validation

**Preconditions**

อยู่ที่ form สร้าง PO พร้อม header แต่ยังไม่มีรายการ

**Steps**

1. กดบันทึกโดยไม่เพิ่ม line item ใดๆ

**Expected**

ปุ่มบันทึกถูก disable หรือ form ไม่ navigate ออกจาก /new

---

## TC-PO-060205 — Open Create → From Price List → wizard step 1 (Select Vendors)

> **As a** Purchase user, **I want** the Po Purchaser Journey list page to load successfully, **so that** I can manage Po Purchaser Journey records.

**Priority:** Medium · **Test Type:** Smoke

**Preconditions**

Login เป็น Purchaser; อยู่ที่หน้า list ของ PO

**Steps**

1. กดปุ่ม dropdown New PO
2. เลือก From Price List

**Expected**

Wizard step 1 แสดง (URL เปลี่ยนหรือ dialog ปรากฏพร้อมการเลือก vendor)

---

## TC-PO-060206 — Select vendor → wizard step 2 (Review items)

> **As a** Purchase user, **I want** this Po Purchaser Journey interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

Wizard From Price List step 1 เปิดอยู่

**Steps**

1. เลือก vendor แรก
2. กด Next/Continue

**Expected**

Wizard ไปยัง step 2 (หน้า review visible)

---

## TC-PO-060207 — Submit Price List wizard → POs created (URL changes from /new to detail)

> **As a** Purchase user, **I want** to create a new Po Purchaser Journey record, **so that** it becomes available for downstream operations.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

Wizard From Price List step 2 (Review) เปิดอยู่

**Steps**

1. กด Create/Submit บน step สุดท้ายของ wizard

**Expected**

URL เปลี่ยนออกจาก /new ไปยัง PO detail หรือ list ที่ถูกสร้าง

---

## TC-PO-060208 — Skip dynamically if no price list / vendors available

> **As a** Purchase user, **I want** this Po Purchaser Journey interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Low · **Test Type:** Functional

**Preconditions**

Login เป็น Purchaser; อยู่ที่หน้า list ของ PO

**Steps**

1. เปิด wizard From Price List
2. ตรวจสอบรายการ vendor ใน step 1

**Expected**

หาก wizard แสดงรายการ vendor ว่างเปล่า การทดสอบ skip พร้อมเหตุผล ไม่เช่นนั้นตรวจสอบว่า wizard step 1 visible

> _Note: Dynamically skipped when DB lacks price list / vendor data._

---

## TC-PO-060209 — Open Create → From PR → wizard step 1 (Select Approved PRs)

> **As a** Purchase user, **I want** core Po Purchaser Journey interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** Medium · **Test Type:** Smoke

**Preconditions**

Login เป็น Purchaser; อยู่ที่หน้า list ของ PO

**Steps**

1. กดปุ่ม dropdown New PO
2. เลือก From PR

**Expected**

Wizard step 1 แสดง (รายการเลือก PR visible หรือ dialog ปรากฏ)

---

## TC-PO-060210 — Select approved PR → wizard step 2 (Review POs grouped by vendor)

> **As a** Purchase user, **I want** this Po Purchaser Journey interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

Wizard From PR step 1 เปิดอยู่พร้อม PR ที่ approved อย่างน้อยหนึ่งรายการ

**Steps**

1. เลือก PR ที่ approved แรก
2. กด Next/Continue

**Expected**

Wizard ไปยัง step 2 (review PO ที่จัดกลุ่มตาม vendor)

---

## TC-PO-060211 — Submit From PR wizard → POs created

> **As a** Purchase user, **I want** to create a new Po Purchaser Journey record, **so that** it becomes available for downstream operations.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

Wizard From PR step 2 เปิดอยู่

**Steps**

1. กด Create/Submit บน step สุดท้ายของ wizard

**Expected**

URL เปลี่ยนออกจาก /new (PO ถูกสร้าง)

---

## TC-PO-060212 — Skip dynamically if no approved PR available

> **As a** Purchase user, **I want** this Po Purchaser Journey interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Low · **Test Type:** Functional

**Preconditions**

Login เป็น Purchaser; อยู่ที่หน้า list ของ PO

**Steps**

1. เปิด wizard From PR
2. ตรวจสอบรายการ PR ใน step 1

**Expected**

หาก wizard แสดงรายการ PR ว่างเปล่า การทดสอบ skip พร้อมเหตุผล ไม่เช่นนั้นตรวจสอบว่า wizard step 1 visible

> _Note: Dynamically skipped when DB lacks approved PRs._

---

## TC-PO-060301 — Detail loads (DRAFT) with header + items table

> **As a** Purchase user, **I want** core Po Purchaser Journey interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

มี Draft PO สำหรับ Purchaser นี้ (seeded ผ่าน submitPOAsPurchaser)

**Steps**

1. เปิดหน้า detail ของ Draft PO
2. ตรวจสอบว่า URL ตรงกับ PO ref

**Expected**

URL เป็น /procurement/purchase-order/<ref>

---

## TC-PO-060302 — Item Details panel — Details / Quantity / Pricing tabs

> **As a** Purchase user, **I want** this Po Purchaser Journey interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

อยู่ที่หน้า detail ของ Draft PO ที่มีอย่างน้อยหนึ่งรายการ

**Steps**

1. ค้นหาแท็บใน Item Details panel
2. สลับระหว่างแท็บ Items / Quantity / Pricing ถ้ามี

**Expected**

แท็บแสดงและถูกเลือกเมื่อคลิก (skip ถ้าไม่มี)

---

## TC-PO-060303 — Edit / Delete / Submit buttons present for DRAFT

> **As a** Purchase user, **I want** this Po Purchaser Journey interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

อยู่ที่หน้า detail ของ Draft PO

**Steps**

1. ตรวจสอบ action toolbar

**Expected**

ปุ่ม Edit visible (ความ visible ของปุ่ม Submit ขึ้นอยู่กับ UI variant)

---

## TC-PO-060304 — Read-only state for SENT/COMPLETED status (best-effort)

> **As a** low-privilege user, **I should NOT** see Add/edit controls on Po Purchaser Journey, **so that** role separation is enforced.

**Priority:** Medium · **Test Type:** Authorization

**Preconditions**

มี PO ที่มี status SENT หรือ COMPLETED ใน DB (ที่ไม่ใช่ Draft หรือ In-Progress)

**Steps**

1. ไปที่หน้า list ของ PO
2. ค้นหาแถว SENT/COMPLETED
3. เปิดและตรวจสอบ toolbar

**Expected**

ปุ่ม Edit ไม่ visible หรือถูก disable Skip ถ้าไม่มี PO ที่มี status SENT/COMPLETED

> _Note: Dynamically skipped if no SENT/COMPLETED PO available._

---

## TC-PO-060401 — Click Edit on DRAFT → edit mode active (Save/Cancel visible)

> **As a** Purchase user, **I want** core Po Purchaser Journey interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

มี Draft PO อยู่ในระบบ

**Steps**

1. เปิดหน้า detail ของ Draft PO
2. กด Edit
3. ตรวจสอบปุ่ม Save/Cancel ระดับ form

**Expected**

ปุ่ม Save visible หลังเข้าสู่ edit mode

---

## TC-PO-060402 — Modify line item quantity → Save → URL stays on detail

> **As a** Purchase user, **I want** to manage Po Purchaser Journey records via CRUD, **so that** the data stays correct over time.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

edit mode active บน Draft PO ที่มีอย่างน้อยหนึ่งรายการ

**Steps**

1. เข้าสู่ edit mode
2. แก้ไข quantity input
3. กดบันทึก

**Expected**

หลังบันทึก URL ยังคงอยู่ที่ /procurement/purchase-order/<ref>

---

## TC-PO-060403 — Add new line item in edit mode → Save

> **As a** Purchase user, **I want** to create a new Po Purchaser Journey record, **so that** it becomes available for downstream operations.

**Priority:** Medium · **Test Type:** CRUD

**Preconditions**

edit mode active บน Draft PO

**Steps**

1. เข้าสู่ edit mode
2. เพิ่ม line item ใหม่
3. บันทึก

**Expected**

หลังบันทึก URL ยังคงอยู่ที่หน้า detail

---

## TC-PO-060404 — Cancel edit → ยืนยัน Discard แล้วกลับสู่ view mode

> **As a** Purchase user, **I want** this Po Purchaser Journey interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

edit mode active บน Draft PO โดยไม่มีการเปลี่ยนแปลงที่พิมพ์

**Steps**

1. เข้าสู่ edit mode
2. กด Cancel โดยไม่ทำการเปลี่ยนแปลง

**Expected**

มี dialog ยืนยัน Keep editing/Discard เสมอแม้ไม่ได้แก้อะไร; กด Discard แล้วกลับสู่ view mode (ปุ่ม Edit visible, ปุ่ม Save หาย)

---

## TC-PO-060405 — Submit Draft PO → confirmation dialog → status moves to IN PROGRESS

> **As a** Purchase user, **I want** to manage Po Purchaser Journey records via CRUD, **so that** the data stays correct over time.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

มี Draft PO ที่มี ≥1 รายการ

**Steps**

1. เปิด Draft PO
2. กด Submit
3. ยืนยัน dialog

**Expected**

URL ยังคงอยู่ที่ PO ref; text ของ status badge อัปเดต (best effort)

---

## TC-PO-060406 — Delete IN PROGRESS PO via Edit Mode

> **As a** Purchase user, **I want** to edit an existing Po Purchaser Journey record, **so that** its data stays accurate.

**Priority:** Medium · **Test Type:** CRUD

**Preconditions**

มี PO ที่มี status IN PROGRESS (หลัง submit) DRAFT ก็ยอมรับได้เช่นกัน

**Steps**

1. เปิด PO
2. กด Edit
3. กด Delete
4. ยืนยัน

**Expected**

URL navigate กลับไปยัง list (PO ถูกลบ)

---

## TC-PO-060501 — Approved PO has Send to Vendor + Close buttons (seeded via seedApprovedPO)

> **As a** Purchase user, **I want** this Po Purchaser Journey interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

มี PO ที่ approved (seeded ผ่าน seedApprovedPO: submit + FC + GM)

**Steps**

1. Seed Approved PO
2. เปิดหน้า detail
3. ตรวจสอบ action toolbar

**Expected**

ปุ่ม Send to Vendor visible ความ visible ของปุ่ม Close เป็นรอง (ไม่ assert hard ถ้าไม่มี)

---

## TC-PO-060502 — Click Send to Vendor → status updates / toast

> **As a** Purchase user, **I want** to edit an existing Po Purchaser Journey record, **so that** its data stays accurate.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

มี PO ที่ approved อยู่ในระบบ

**Steps**

1. เปิด Approved PO
2. กด Send to Vendor
3. ยืนยัน

**Expected**

URL ยังคงอยู่ที่ PO ref; success toast หรือการอัปเดต status visible

---

## TC-PO-060503 — Close PO with items received → COMPLETED

> **As a** Purchase user, **I want** to manage Po Purchaser Journey records via CRUD, **so that** the data stays correct over time.

**Priority:** Medium · **Test Type:** CRUD

**Preconditions**

มี SENT PO ที่มีรายการที่รับแล้ว (best-effort; เชื่อ DB)

**Steps**

1. ค้นหา SENT PO ที่มีรายการที่รับแล้วในรายการ
2. เปิดหน้า detail
3. กด Close
4. ยืนยัน

**Expected**

text ของ status ตรงกับ /completed/i หลัง close Skip ถ้าไม่มี PO ที่เข้าเกณฑ์

> _Note: Dynamically skipped when no SENT-with-items PO exists._

---

## TC-PO-060504 — Close PO without items received → CLOSED

> **As a** Purchase user, **I want** to manage Po Purchaser Journey records via CRUD, **so that** the data stays correct over time.

**Priority:** Medium · **Test Type:** CRUD

**Preconditions**

มี Approved/SENT PO ที่ยังไม่มีรายการที่รับ

**Steps**

1. ค้นหา PO ที่เข้าเกณฑ์
2. กด Close
3. ยืนยัน

**Expected**

text ของ status ตรงกับ /voided|cancelled/i หลัง close Skip ถ้าไม่มี PO ที่เข้าเกณฑ์

> _Note: Dynamically skipped when no eligible PO exists._

---

## TC-PO-060901 — Full Purchaser flow: Create blank → Save Draft → Submit → FC approves → Send to Vendor

> **As a** FC user, **I want** core Po Purchaser Journey interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

Login เป็น Purchaser

**Steps**

1. สร้าง blank PO (header + 1 รายการ)
2. บันทึก Draft
3. Submit
4. FC approve (cross-context)
5. Reload หน้า detail
6. กด Send to Vendor

**Expected**

URL ยังคงอยู่ที่ PO ref หลัง Send to Vendor (lifecycle ครบถ้วน end-to-end)

---


<sub>Last regenerated: 2026-11-21 · git c6e714b</sub>
