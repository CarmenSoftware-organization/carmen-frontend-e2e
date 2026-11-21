# Pr Approver Journey — User Stories

_Generated from `tests/303-pr-approver-journey.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Pr Approver Journey
**Spec:** `tests/303-pr-approver-journey.spec.ts`
**Default role:** FC
**Total test cases:** 28 (16 High / 10 Medium / 2 Low)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-PR-060101 | Dashboard loads with Total Pending count visible | High | Smoke |
| TC-PR-060102 | Click pending PR row navigates to PR detail | High | Smoke |
| TC-PR-060103 | Pending count matches actual list row count | Medium | Functional |
| TC-PR-060104 | Category filter chips render and the PR chip becomes active | Medium | Functional |
| TC-PR-060150 | active BU = BLAVG | High | Smoke |
| TC-PR-060201 | My Pending tab shows PRs at HOD stage | High | Smoke |
| TC-PR-060202 | All Documents tab broadens scope | Medium | Functional |
| TC-PR-060203 | All Stage dropdown filters by status | Medium | Functional |
| TC-PR-060204 | Filter panel opens and applies | Medium | Functional |
| TC-PR-060205 | Search by PR reference filters list | Low | Functional |
| TC-PR-060301 | Detail loads with Items tab default | High | Smoke |
| TC-PR-060302 | Switch to Workflow History tab | Medium | Functional |
| TC-PR-060303 | No standalone Approve/Reject/Return buttons (BRD discrepancy) | High | Authorization |
| TC-PR-060304 | Edit button visible (entry to bulk actions) | High | Functional |
| TC-PR-060401 | Click Edit → edit mode active | High | Smoke |
| TC-PR-060402 | Approved Quantity field is editable | High | CRUD |
| TC-PR-060403 | Item Note field is editable | Medium | CRUD |
| TC-PR-060404 | Delivery Point field is editable | Medium | CRUD |
| TC-PR-060405 | Vendor field is read-only | High | Authorization |
| TC-PR-060406 | Unit Price field is read-only | High | Authorization |
| TC-PR-060407 | Discount / Tax / FOC Qty are read-only (FOC pinned: editable today) | Medium | Authorization |
| TC-PR-060408 | Bulk Approve via Select All → toolbar | High | CRUD |
| TC-PR-060409 | Bulk Reject via toolbar (with reason) | High | CRUD |
| TC-PR-060410 | Bulk Send for Review via toolbar | High | CRUD |
| TC-PR-060411 | Bulk Split via toolbar | Low | Functional |
| TC-PR-060412 | Cancel edit → discard changes | Medium | Functional |
| TC-PR-060501 | FC sees PRs from multiple departments | High | Authorization |
| TC-PR-060901 | HOD full flow: My Approval → List → Detail → Edit → Adjust Qty → Bulk Approve | High | Smoke |

---

## TC-PR-060101 — Dashboard loads with Total Pending count visible

> **As a** FC user, **I want** core Pr Approver Journey interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

Login เป็น HOD (carmensoftware.dev+hod@gmail.com)

**Steps**

1. ไปที่ My Approvals
2. ตรวจสอบว่า badge จำนวน pending แสดงผล

**Expected**

My Approvals dashboard โหลด; badge จำนวน pending แสดงผล

---

## TC-PR-060102 — Click pending PR row navigates to PR detail

> **As a** FC user, **I want** core Pr Approver Journey interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

อยู่ใน My Approvals dashboard และมีแถว PR ที่ pending อย่างน้อยหนึ่งแถว

**Steps**

1. คลิกแถว PR ที่ pending แรก

**Expected**

URL นำทางไปยัง /procurement/purchase-request/<ref>

---

## TC-PR-060103 — Pending count matches actual list row count

> **As a** FC user, **I want** this Pr Approver Journey interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

อยู่ใน My Approvals dashboard

**Steps**

1. อ่านค่า badge pending
2. อ่านยอดรวมจาก label pagination

**Expected**

ค่า badge Total Pending เท่ากับยอดรวมใน label 'Showing 1–N of TOTAL' ของ pagination

---

## TC-PR-060104 — Category filter chips render and the PR chip becomes active

> **As a** FC user, **I want** to filter the Pr Approver Journey list, **so that** I can narrow results to relevant records.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

อยู่ใน My Approvals dashboard

**Steps**

1. หา category chip (PO/PR/SR)
2. คลิก chip Purchase Request

**Expected**

chip Purchase Request แสดงผลและเปลี่ยนเป็น aria-pressed=true หลังคลิก

---

## TC-PR-060150 — active BU = BLAVG

> **As a** FC user, **I want** core Pr Approver Journey interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

Login เป็น carmensoftware.dev+hod@gmail.com ผ่าน auth fixture

**Steps**

1. เรียก ensureActiveBu(BLAVG)
2. อ่าน profile API
3. หา business unit ที่ is_default
4. อ่าน label ของ BU switcher

**Expected**

default business unit มี code === 'BLAVG'; trigger ของ BU switcher แสดง label ของ BU นั้น

---

## TC-PR-060201 — My Pending tab shows PRs at HOD stage

> **As a** HOD user, **I want** core Pr Approver Journey interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

Login เป็น HOD; นำทางไปที่ PR list แล้ว

**Steps**

1. ไปที่ /procurement/purchase-request
2. ตรวจสอบว่า My Pending tab ถูกเลือก

**Expected**

URL อยู่ที่ PR list และ My Pending tab ถูกเลือกเมื่อมี

---

## TC-PR-060202 — All Documents tab broadens scope

> **As a** FC user, **I want** this Pr Approver Journey interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

อยู่ที่หน้า PR list

**Steps**

1. คลิก tab All Documents

**Expected**

หลังคลิก All Documents URL มี ?view=all-document (ขอบเขตกว้างขึ้นจาก My Pending)

---

## TC-PR-060203 — All Stage dropdown filters by status

> **As a** FC user, **I want** to filter the Pr Approver Journey list, **so that** I can narrow results to relevant records.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

อยู่ที่หน้า PR list

**Steps**

1. เปิดแผง Filter
2. เลือกฟิลด์ Stage
3. ติ๊ก stage แรกในรายการ

**Expected**

ตอนเปิด ตัวเลือก All Stage ถูกติ๊ก; หลังติ๊ก stage แรก stage นั้นถูกติ๊กและ All Stage ถูกยกเลิกติ๊ก

---

## TC-PR-060204 — Filter panel opens and applies

> **As a** FC user, **I want** to filter the Pr Approver Journey list, **so that** I can narrow results to relevant records.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

อยู่ที่หน้า PR list

**Steps**

1. เปิดแผง Filter
2. เลือกฟิลด์ Status แล้วติ๊ก In progress (ไม่มีปุ่ม Apply)

**Expected**

หลังติ๊ก In progress ทุกแถวที่แสดงมีสถานะ In progress

---

## TC-PR-060205 — Search by PR reference filters list

> **As a** FC user, **I want** to filter the Pr Approver Journey list, **so that** I can narrow results to relevant records.

**Priority:** Low · **Test Type:** Functional

**Preconditions**

อยู่ที่หน้า PR list; มี PR อย่างน้อยหนึ่งรายการที่มีเลขอ้างอิงที่รู้จัก

**Steps**

1. พิมพ์เลขอ้างอิงบางส่วนในช่องค้นหา
2. รอผลลัพธ์

**Expected**

URL ยังคงอยู่ที่ PR list หลังพิมพ์ในช่องค้นหา

---

## TC-PR-060301 — Detail loads with Items tab default

> **As a** FC user, **I want** core Pr Approver Journey interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

มี PR ที่ pending (In Progress, HOD stage) อยู่; สร้างผ่าน submitPRAsRequestor

**Steps**

1. เปิดหน้ารายละเอียด PR
2. ตรวจสอบว่า Items tab เป็นค่าเริ่มต้น

**Expected**

URL เป็น detail URL; ตารางรายการสินค้า (คอลัมน์ Product + แถวรายการที่ seed) แสดงเป็นค่าเริ่มต้น

---

## TC-PR-060302 — Switch to Workflow History tab

> **As a** FC user, **I want** this Pr Approver Journey interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

อยู่ที่หน้ารายละเอียด PR ที่ pending

**Steps**

1. คลิก tab Workflow History

**Expected**

หลังคลิกตัวเปิดประวัติ (stepper) แสดง sheet Workflow History ที่มีรายการของ requestor

---

## TC-PR-060303 — No standalone Approve/Reject/Return buttons (BRD discrepancy)

> **As a** low-privilege user, **I should NOT** see Add/edit controls on Pr Approver Journey, **so that** role separation is enforced.

**Priority:** High · **Test Type:** Authorization

**Preconditions**

อยู่ที่หน้ารายละเอียด PR ที่ pending (โหมด read-only)

**Steps**

1. ตรวจสอบ header หน้ารายละเอียด / action toolbar

**Expected**

ปุ่ม Approve, Reject และ Send for Review แบบ standalone ไม่แสดงที่ header หน้า (ตาม BRD discrepancy — actions อยู่ใน Edit Mode bulk toolbar)

---

## TC-PR-060304 — Edit button visible (entry to bulk actions)

> **As a** FC user, **I want** this Pr Approver Journey interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

อยู่ที่หน้ารายละเอียด PR ที่ pending

**Steps**

1. ตรวจสอบ action toolbar

**Expected**

ปุ่ม Edit แสดงผล (HOD สามารถเข้าโหมด Edit Mode สำหรับ bulk actions)

---

## TC-PR-060401 — Click Edit → edit mode active

> **As a** FC user, **I want** core Pr Approver Journey interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

หน้ารายละเอียด PR ที่ pending เปิดอยู่

**Steps**

1. คลิก Edit
2. ตรวจสอบว่าปุ่ม Save/Cancel ระดับฟอร์มปรากฏ

**Expected**

ปุ่ม Save Draft (หรือ Cancel) ระดับฟอร์มแสดงผล

---

## TC-PR-060402 — Approved Quantity field is editable

> **As a** FC user, **I want** to edit an existing Pr Approver Journey record, **so that** its data stays accurate.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

โหมดแก้ไขเปิดใช้งานบน PR ที่ pending และมีรายการสินค้าอย่างน้อยหนึ่งรายการ

**Steps**

1. เข้าโหมดแก้ไข
2. หาช่อง Approved Qty ในแถวแรก
3. ตรวจสอบว่าแก้ไขได้

**Expected**

ช่อง Approved Qty แสดงผลและรับค่าได้

---

## TC-PR-060403 — Item Note field is editable

> **As a** FC user, **I want** to edit an existing Pr Approver Journey record, **so that** its data stays accurate.

**Priority:** Medium · **Test Type:** CRUD

**Preconditions**

โหมดแก้ไขเปิดใช้งานบน PR ที่ pending และมีรายการสินค้าอย่างน้อยหนึ่งรายการ

**Steps**

1. เข้าโหมดแก้ไข
2. หาช่อง Item Note
3. พิมพ์ note

**Expected**

ช่อง Item Note รับค่าที่พิมพ์

---

## TC-PR-060404 — Delivery Point field is editable

> **As a** FC user, **I want** to edit an existing Pr Approver Journey record, **so that** its data stays accurate.

**Priority:** Medium · **Test Type:** CRUD

**Preconditions**

โหมดแก้ไขเปิดใช้งานบน PR ที่ pending และมีรายการสินค้าอย่างน้อยหนึ่งรายการ

**Steps**

1. เข้าโหมดแก้ไข
2. หาช่อง Delivery Point
3. ตรวจสอบว่าแก้ไขได้

**Expected**

ช่อง Delivery Point แก้ไขได้

---

## TC-PR-060405 — Vendor field is read-only

> **As a** low-privilege user, **I should NOT** see Add/edit controls on Pr Approver Journey, **so that** role separation is enforced.

**Priority:** High · **Test Type:** Authorization

**Preconditions**

โหมดแก้ไขเปิดใช้งานบน PR ที่ pending และมีรายการสินค้าอย่างน้อยหนึ่งรายการ

**Steps**

1. เข้าโหมดแก้ไข
2. หาเซลล์ Vendor ในแถวแรก

**Expected**

เซลล์ Vendor ถูก disabled หรือแก้ไขไม่ได้ตาม FR-PR-011A

---

## TC-PR-060406 — Unit Price field is read-only

> **As a** low-privilege user, **I should NOT** see Add/edit controls on Pr Approver Journey, **so that** role separation is enforced.

**Priority:** High · **Test Type:** Authorization

**Preconditions**

โหมดแก้ไขเปิดใช้งานบน PR ที่ pending และมีรายการสินค้าอย่างน้อยหนึ่งรายการ

**Steps**

1. เข้าโหมดแก้ไข
2. หาเซลล์ Unit Price ในแถวแรก

**Expected**

เซลล์ Unit Price ถูก disabled หรือแก้ไขไม่ได้ตาม FR-PR-011A

---

## TC-PR-060407 — Discount / Tax / FOC Qty are read-only (FOC pinned: editable today)

> **As a** low-privilege user, **I should NOT** see Add/edit controls on Pr Approver Journey, **so that** role separation is enforced.

**Priority:** Medium · **Test Type:** Authorization

**Preconditions**

โหมดแก้ไขเปิดใช้งานบน PR ที่ pending และมีรายการสินค้าอย่างน้อยหนึ่งรายการ

**Steps**

1. เข้าโหมดแก้ไข
2. หาเซลล์ Discount, Tax, FOC Qty

**Expected**

เซลล์ทั้งสามถูก disabled หรือแก้ไขไม่ได้ตาม FR-PR-011A / FR-PR-024

---

## TC-PR-060408 — Bulk Approve via Select All → toolbar

> **As a** FC user, **I want** to manage Pr Approver Journey records via CRUD, **so that** the data stays correct over time.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

โหมดแก้ไขเปิดใช้งานบน PR ที่ pending

**Steps**

1. เข้าโหมดแก้ไข
2. เลือกทุกแถว
3. คลิก Approve ใน bulk toolbar
4. Confirm

**Expected**

PATCH .../approve สำเร็จและกลับหน้า list; เปิด PR ใหม่แล้ว HOD ไม่มีปุ่ม Edit (เอกสารไปขั้นตอนถัดไปแล้ว)

---

## TC-PR-060409 — Bulk Reject via toolbar (with reason)

> **As a** FC user, **I want** to manage Pr Approver Journey records via CRUD, **so that** the data stays correct over time.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

โหมดแก้ไขเปิดใช้งานบน PR ที่ pending

**Steps**

1. เข้าโหมดแก้ไข
2. เลือกทุกแถว
3. คลิก Reject ใน bulk toolbar
4. กรอกเหตุผล + Reject ใน dialog
5. กด Reject ระดับเอกสารที่ footer + ยืนยัน

**Expected**

PATCH .../reject สำเร็จ (ต้องกด Reject ที่รายการแล้วกด Reject ระดับเอกสารอีกครั้ง) และ PR ที่เปิดใหม่มีสถานะ Voided

---

## TC-PR-060410 — Bulk Send for Review via toolbar

> **As a** FC user, **I want** to manage Pr Approver Journey records via CRUD, **so that** the data stays correct over time.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

โหมดแก้ไขเปิดใช้งานบน PR ที่ pending

**Steps**

1. เข้าโหมดแก้ไข
2. เลือกทุกแถว
3. คลิก Send for Review
4. กรอกเหตุผล + stage
5. Confirm

**Expected**

PATCH .../review สำเร็จ กลับหน้า list และเปิด PR ใหม่แล้ว HOD ไม่มีปุ่ม Edit (เอกสารถูกส่งกลับไป Create Request)

---

## TC-PR-060411 — Bulk Split via toolbar

> **As a** FC user, **I want** this Pr Approver Journey interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Low · **Test Type:** Functional

**Preconditions**

โหมดแก้ไขเปิดใช้งานบน PR ที่ pending

**Steps**

1. เข้าโหมดแก้ไขบน PR ที่มี 2 รายการ
2. ติ๊กแถวแรกแถวเดียว
3. คลิก Split

**Expected**

POST .../split สำเร็จ (200) — รายการที่ติ๊กถูกย้ายไป PR ใหม่

---

## TC-PR-060412 — Cancel edit → discard changes

> **As a** FC user, **I want** this Pr Approver Journey interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

โหมดแก้ไขเปิดใช้งานบน PR ที่ pending และมีรายการสินค้าอย่างน้อยหนึ่งรายการ

**Steps**

1. เข้าโหมดแก้ไข
2. พิมพ์ใน Approved Qty
3. คลิก Cancel

**Expected**

ฟอร์มกลับสู่โหมดดู (ปุ่ม Edit แสดงผลอีกครั้ง)

---

## TC-PR-060501 — FC sees PRs from multiple departments

> **As a** low-privilege user, **I should NOT** see Add/edit controls on Pr Approver Journey, **so that** role separation is enforced.

**Priority:** High · **Test Type:** Authorization

**Preconditions**

Login เป็น FC (carmensoftware.dev+fc@gmail.com); มี PR ที่ pending ในฐานข้อมูลจากหลายแผนก

**Steps**

1. ไปที่ PR list ในฐานะ FC
2. เปิด tab All Documents
3. อ่านค่าคอลัมน์ department จากแถว

**Expected**

มีค่า department อย่างน้อย 2 ค่าที่แตกต่างกันปรากฏใน list 

---

## TC-PR-060901 — HOD full flow: My Approval → List → Detail → Edit → Adjust Qty → Bulk Approve

> **As a** HOD user, **I want** the Pr Approver Journey list page to load successfully, **so that** I can manage Pr Approver Journey records.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

Login เป็น HOD; มี PR ที่ pending ใหม่ seeded ผ่าน submitPRAsRequestor

**Steps**

1. เปิด My Approvals
2. เปิดหน้ารายละเอียด PR
3. คลิก Edit
4. ปรับ Approved Qty ในแถวแรก
5. เลือกทั้งหมด + Bulk Approve + Confirm

**Expected**

Approved Qty แก้เป็น 2 ได้; bulk approve สำเร็จ และ HOD ไม่มีปุ่ม Edit บน PR นั้นอีก (journey เสร็จสมบูรณ์)

---


<sub>Last regenerated: 2026-11-21 · git 9d79c62</sub>
