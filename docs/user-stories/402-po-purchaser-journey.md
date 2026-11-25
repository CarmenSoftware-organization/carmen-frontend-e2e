# Po Purchaser Journey — User Stories

_Generated from `tests/402-po-purchaser-journey.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Po Purchaser Journey
**Spec:** `tests/402-po-purchaser-journey.spec.ts`
**Default role:** Purchase
**Total test cases:** 31 (14 High / 14 Medium / 3 Low)

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
| TC-PO-060203 | Save Draft → redirect to detail with a DRAFT number | High | CRUD |
| TC-PO-060204 | Save without items → refused, stays on /new | Medium | Validation |
| TC-PO-060205 | Open Create → From Price List → wizard step 1 (Select Vendors) | Medium | Smoke |
| TC-PO-060206 | Select vendor → wizard step 2 (Review items) | Medium | Functional |
| TC-PO-060207 | Confirm Price List wizard → PO created and opened | High | CRUD |
| TC-PO-060208 | Wizard step 1 lists vendors that have an active price list on the delivery date | Low | Functional |
| TC-PO-060209 | Open Create → From PR → wizard step 1 (Select Approved PRs) | Medium | Smoke |
| TC-PO-060210 | Select approved PR → wizard step 2 (Review POs grouped by vendor) | Medium | Functional |
| TC-PO-060211 | Submit From PR wizard → POs created | High | CRUD |
| TC-PO-060212 | From PR wizard lists approved PRs once a workflow is chosen | Low | Functional |
| TC-PO-060301 | Detail loads (DRAFT) with header + items table | High | Smoke |
| TC-PO-060302 | Item rows expand and collapse inline via Expand all (no tab panel) | Medium | Functional |
| TC-PO-060303 | Edit / Delete / Submit buttons present for DRAFT | High | Functional |
| TC-PO-060304 | Read-only state for an APPROVED PO (no Edit button) | Medium | Authorization |
| TC-PO-060401 | Click Edit on DRAFT → edit mode active (Save/Cancel visible) | High | Smoke |
| TC-PO-060402 | Modify line item quantity → Save → URL stays on detail | High | CRUD |
| TC-PO-060403 | Add new line item in edit mode → Save | Medium | CRUD |
| TC-PO-060404 | Cancel edit → ยืนยัน Discard แล้วกลับสู่ view mode | Medium | Functional |
| TC-PO-060405 | Submit Draft PO → confirmation dialog → status moves to IN PROGRESS | High | CRUD |
| TC-PO-060406 | Delete DRAFT PO via Edit Mode | Medium | CRUD |
| TC-PO-060501 | Approved PO has Send to Vendor + Close buttons (seeded via seedApprovedPO) | High | Functional |
| TC-PO-060502 | Click Send to Vendor → compose dialog opens bound to the PO | High | CRUD |
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
2. เลือกฟิลด์ Status แล้วติ๊ก Draft (ไม่มีปุ่ม Apply)

**Expected**

ทุกแถวที่แสดงในตารางมีสถานะ Draft (ชุดข้อมูลทดสอบมี PO Draft)

---

## TC-PO-060104 — Search by PO reference

> **As a** Purchase user, **I want** this Po Purchaser Journey interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

อยู่ที่หน้า list ของ PO

**Steps**

1. อ่านเลข PO ของแถวแรกใน All documents
2. พิมพ์เลขนั้นในช่องค้นหา
3. พิมพ์ข้อความที่ไม่มีอยู่

**Expected**

ค้นเลข PO ของแถวแรกแล้วทุกแถวที่เหลือมีเลข PO นั้น; ค้นข้อความที่ไม่มีอยู่แล้วไม่เหลือแถว

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

หลังคลิกหัวคอลัมน์ Date แถวแรกของตารางเปลี่ยน (list เรียงลำดับใหม่)

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

## TC-PO-060203 — Save Draft → redirect to detail with a DRAFT number

> **As a** Purchase user, **I want** to manage Po Purchaser Journey records via CRUD, **so that** the data stays correct over time.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

กรอก header + ≥1 line item บน form สร้าง

**Steps**

1. กดบันทึก
2. รอการ redirect ไปยังหน้า detail

**Expected**

URL เปลี่ยนเป็น /procurement/purchase-order/<id> (ไม่ใช่ /new) และหน้าใบแสดงเลข draft DRAFT-xxxxxxxx (เลข PO จริงออกตอน Submit ครั้งแรก)

---

## TC-PO-060204 — Save without items → refused, stays on /new

> **As a** Purchase user, **I want** the system to block invalid Po Purchaser Journey submissions, **so that** data quality is preserved.

**Priority:** Medium · **Test Type:** Validation

**Preconditions**

อยู่ที่ form สร้าง PO (blank) ยังไม่ได้กรอกอะไรและไม่มีรายการ

**Steps**

1. กดบันทึกโดยไม่เพิ่ม line item ใดๆ

**Expected**

ปุ่ม Save กดได้แต่ระบบไม่บันทึก: toast "Some fields aren't filled in correctly", ช่องที่ผิดถูกมาร์ก aria-invalid และ URL ยังเป็น /new

---

## TC-PO-060205 — Open Create → From Price List → wizard step 1 (Select Vendors)

> **As a** Purchase user, **I want** the Po Purchaser Journey list page to load successfully, **so that** I can manage Po Purchaser Journey records.

**Priority:** Medium · **Test Type:** Smoke

**Preconditions**

Login เป็น Purchaser; อยู่ที่หน้า list ของ PO

**Steps**

1. กดปุ่ม 'New Purchase Order'
2. เลือกการ์ด 'From Price List'

**Expected**

ไปที่หน้าเต็ม /procurement/purchase-order/from-price-list (ไม่ใช่ dialog) และ step rail แสดง 'Order & Vendor' กับ 'Select Items'

---

## TC-PO-060206 — Select vendor → wizard step 2 (Review items)

> **As a** Purchase user, **I want** this Po Purchaser Journey interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

Wizard From Price List step 1 เปิดอยู่

**Steps**

1. เปิด /procurement/purchase-order/from-price-list
2. เลือก workflow, วันที่ส่งของ และ vendor แรก
3. กด Next

**Expected**

Wizard ไป step 2 'Select Items' ซึ่งแสดงแถวรายการจาก price list (เลข PL) ของ vendor ที่เลือก

---

## TC-PO-060207 — Confirm Price List wizard → PO created and opened

> **As a** Purchase user, **I want** to create a new Po Purchaser Journey record, **so that** it becomes available for downstream operations.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

Wizard From Price List step 2 (Review) เปิดอยู่

**Steps**

1. ไปจนถึง step 3 (Order details / summary)
2. กด Confirm (ไม่มี dialog ยืนยันเพิ่ม)

**Expected**

ยิง POST purchase-orders สำเร็จ แล้ว navigate ไปที่ /procurement/purchase-order/<id> ของ PO ที่สร้าง ซึ่งแสดงเลข draft DRAFT-xxxxxxxx

---

## TC-PO-060208 — Wizard step 1 lists vendors that have an active price list on the delivery date

> **As a** Purchase user, **I want** this Po Purchaser Journey interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Low · **Test Type:** Functional

**Preconditions**

Login เป็น Purchaser; อยู่ที่หน้า list ของ PO

**Steps**

1. เปิด wizard From Price List
2. เลือก workflow และ delivery date
3. ตรวจสอบรายการ vendor ใน step 1

**Expected**

หลังเลือก workflow + delivery date รายการ vendor (radio) ปรากฏจาก price list ที่ active วันนั้น

---

## TC-PO-060209 — Open Create → From PR → wizard step 1 (Select Approved PRs)

> **As a** Purchase user, **I want** core Po Purchaser Journey interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** Medium · **Test Type:** Smoke

**Preconditions**

Login เป็น Purchaser; อยู่ที่หน้า list ของ PO

**Steps**

1. กดปุ่ม 'New Purchase Order'
2. เลือกการ์ด 'From Purchase Request'

**Expected**

ไปที่หน้าเต็ม /procurement/purchase-order/from-pr (ไม่ใช่ dialog) และแสดง step 1 พร้อมช่องเลือก workflow

---

## TC-PO-060210 — Select approved PR → wizard step 2 (Review POs grouped by vendor)

> **As a** Purchase user, **I want** this Po Purchaser Journey interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

Wizard From PR step 1 เปิดอยู่พร้อม PR ที่ approved อย่างน้อยหนึ่งรายการ

**Steps**

1. เปิด /procurement/purchase-order/from-pr แล้วเลือก workflow
2. ติ๊ก PR ที่ approved แรก
3. กด Next

**Expected**

Wizard ไป step 2 'Review POs' แสดงแถวของ PR ที่เลือก 1 แถว (PO จัดกลุ่มตาม vendor)

---

## TC-PO-060211 — Submit From PR wizard → POs created

> **As a** Purchase user, **I want** to create a new Po Purchaser Journey record, **so that** it becomes available for downstream operations.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

Wizard From PR step 2 เปิดอยู่

**Steps**

1. กด Create/Submit บน step สุดท้ายของ wizard

**Expected**

ยืนยัน 2 ชั้น (Confirm + alert dialog) แล้ว POST purchase-orders ตอบ ok และหน้าแสดง 'purchase orders created'

---

## TC-PO-060212 — From PR wizard lists approved PRs once a workflow is chosen

> **As a** Purchase user, **I want** this Po Purchaser Journey interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Low · **Test Type:** Functional

**Preconditions**

Login เป็น Purchaser; อยู่ที่หน้า list ของ PO

**Steps**

1. เปิด wizard From PR
2. เลือก workflow
3. ตรวจสอบรายการ PR ใน step 1

**Expected**

หลังเลือก workflow ตาราง PR ที่ approved แล้วปรากฏ (เลข PR..)

---

## TC-PO-060301 — Detail loads (DRAFT) with header + items table

> **As a** Purchase user, **I want** core Po Purchaser Journey interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

มี Draft PO สำหรับ Purchaser นี้ (seeded ผ่าน submitPOAsPurchaser)

**Steps**

1. เปิดหน้า detail ของ Draft PO
2. ดู header และตารางรายการ

**Expected**

URL เป็น /procurement/purchase-order/<ref>; header แสดงเลข PO และสถานะ Draft; ตารางรายการมีอย่างน้อยหนึ่งแถว (มีปุ่ม Expand all)

---

## TC-PO-060302 — Item rows expand and collapse inline via Expand all (no tab panel)

> **As a** Purchase user, **I want** this Po Purchaser Journey interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

อยู่ที่หน้า detail ของ Draft PO ที่มีอย่างน้อยหนึ่งรายการ

**Steps**

1. เปิดหน้า detail ของ PO ที่มีรายการ
2. กด 'Expand all'

**Expected**

ปุ่มสลับเป็น 'Collapse all' (รายการกางในแถว); ไม่มีแท็บ Items/Quantity/Pricing แล้ว

---

## TC-PO-060303 — Edit / Delete / Submit buttons present for DRAFT

> **As a** Purchase user, **I want** this Po Purchaser Journey interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

อยู่ที่หน้า detail ของ Draft PO

**Steps**

1. ตรวจสอบ action toolbar
2. กด Edit

**Expected**

ปุ่ม Edit และ Submit visible; หลังกด Edit ปุ่ม Delete ปรากฏ (Delete อยู่ใน edit mode เท่านั้น)

---

## TC-PO-060304 — Read-only state for an APPROVED PO (no Edit button)

> **As a** low-privilege user, **I should NOT** see Add/edit controls on Po Purchaser Journey, **so that** role separation is enforced.

**Priority:** Medium · **Test Type:** Authorization

**Preconditions**

Login เป็น Purchaser; seed PO จนถึง Approved (FC + GM)

**Steps**

1. เปิดหน้า detail ของ PO ที่ Approved
2. ตรวจ toolbar

**Expected**

ไม่มีปุ่ม Edit; มีปุ่ม Send to vendor

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

หลังบันทึก URL ยังคงอยู่ที่ /procurement/purchase-order/<ref> และ backend ตอบ PATCH สำเร็จ; โหลดหน้าใหม่แล้วบรรทัดแรกแสดง quantity 5

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

URL ยังคงอยู่ที่ PO ref; chip สถานะใน header เปลี่ยนจาก Draft เป็น In progress

---

## TC-PO-060406 — Delete DRAFT PO via Edit Mode

> **As a** Purchase user, **I want** to edit an existing Po Purchaser Journey record, **so that** its data stays accurate.

**Priority:** Medium · **Test Type:** CRUD

**Preconditions**

มี PO สถานะ Draft ที่ Purchaser สร้างเอง (หลัง submit แล้วผู้สร้างเป็น view_only ลบไม่ได้)

**Steps**

1. เปิด PO
2. กด Edit
3. กด Delete
4. ยืนยัน

**Expected**

URL navigate กลับไปยัง list และค้นเลข PO นั้นใน All documents แล้วไม่พบ (PO ถูกลบ)

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

ทั้งปุ่ม Send to Vendor และปุ่ม Close visible บน PO ที่ Approved (Close มีเฉพาะสถานะ approved/sent)

---

## TC-PO-060502 — Click Send to Vendor → compose dialog opens bound to the PO

> **As a** Purchase user, **I want** to manage Po Purchaser Journey records via CRUD, **so that** the data stays correct over time.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

มี PO ที่ approved อยู่ในระบบ

**Steps**

1. เปิด Approved PO
2. กด Send to Vendor
3. ตรวจ dialog

**Expected**

dialog 'Send purchase order to vendor' เปิดพร้อมเลข PO; TEST BU ไม่มี email profile ที่เปิดใช้ จึงแสดง no-profile + ลิงก์ตั้งค่า (ไม่กดส่งจริง); URL ยังอยู่ที่ PO ref

---

## TC-PO-060504 — Close PO without items received → CLOSED

> **As a** Purchase user, **I want** to manage Po Purchaser Journey records via CRUD, **so that** the data stays correct over time.

**Priority:** Medium · **Test Type:** CRUD

**Preconditions**

Login เป็น Purchaser; เคสสร้าง PO ที่ Approved เองผ่าน seedApprovedPO (ไม่พึ่งข้อมูลเดิม)

**Steps**

1. Seed PO ที่ Approved (submit + FC + GM)
2. เปิดหน้า detail แล้วกด Close
3. ยืนยันใน dialog

**Expected**

เปิด PO ใหม่แล้ว status chip เป็น Closed (PO ไม่มี voided/cancelled จากการ Close)

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

lifecycle ครบ (Create → Draft → Submit → FC → GM → Approved) แล้วกด Send to Vendor เปิด dialog ผูกกับเลข PO (ไม่มี email profile ใน TEST BU จึงไม่กดส่งจริง); URL ยังอยู่ที่ PO ref

---


<sub>Last regenerated: 2026-11-25 · git fe077d4</sub>
