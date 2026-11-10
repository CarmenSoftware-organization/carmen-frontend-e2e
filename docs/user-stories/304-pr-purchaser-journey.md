# Pr Purchaser Journey — User Stories

_Generated from `tests/304-pr-purchaser-journey.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Pr Purchaser Journey
**Spec:** `tests/304-pr-purchaser-journey.spec.ts`
**Default role:** Purchase
**Total test cases:** 31 (17 High / 12 Medium / 2 Low)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-PR-070101 | List loads, My Pending tab default (PRs at Purchase stage) | High | Smoke |
| TC-PR-070102 | Switch to All Documents tab broadens scope | Medium | Functional |
| TC-PR-070103 | All Stage dropdown filters by status | Medium | Functional |
| TC-PR-070104 | Filter panel opens and applies | Medium | Functional |
| TC-PR-070105 | Search by PR reference filters list | Low | Functional |
| TC-PR-070150 | active BU = BLAVG | High | Smoke |
| TC-PR-070201 | Detail loads with Items tab default | High | Smoke |
| TC-PR-070202 | Switch to Workflow History tab | Medium | Functional |
| TC-PR-070203 | No standalone Approve/Reject/Return buttons (BRD discrepancy) | High | Authorization |
| TC-PR-070204 | Edit button visible (entry to vendor/pricing edit) | High | Functional |
| TC-PR-070301 | Click Edit → vendor/pricing fields become editable | High | Smoke |
| TC-PR-070302 | Vendor field is editable (Purchaser scope) | High | CRUD |
| TC-PR-070303 | Unit Price field is editable | High | CRUD |
| TC-PR-070304 | Discount field is editable | Medium | CRUD |
| TC-PR-070305 | Tax Profile field is editable | Medium | CRUD |
| TC-PR-070306 | Approved Qty field stays read-only (HOD already set it) | High | Authorization |
| TC-PR-070307 | Auto Allocate button populates vendors via scoring | Medium | Functional |
| TC-PR-070308 | Multiple line items — pricing on each row independent | Medium | CRUD |
| TC-PR-070309 | Save edits → exit edit mode + persist values | High | CRUD |
| TC-PR-070310 | Cancel edits → discard changes, restore original | Medium | Functional |
| TC-PR-070311 | Price Comparison มีคอลัมน์ Inc VAT ก่อน Price และ Net Price ถัดจาก Price | High | Functional |
| TC-PR-070312 | คอลัมน์ Inc VAT แสดง ✓ หรือ — ตรงกับ is_tax_included ทุกแถว | Medium | Functional |
| TC-PR-070313 | Net Price แสดงราคาก่อน VAT และป้าย Best อยู่ที่ Net Price ต่ำสุด | High | Functional |
| TC-PR-070314 | โหมดดู (ไม่ได้กด Edit) dialog เป็นแบบอ่านอย่างเดียว ไม่มีปุ่ม Assign | Medium | Negative |
| TC-PR-070315 | Edit mode: กด Assign แล้ว dialog ปิดและรายการได้ vendor ของแถวที่เลือก | High | Happy Path |
| TC-PR-070401 | Bulk Approve → PR advances to next stage (FC) | High | CRUD |
| TC-PR-070402 | Bulk Reject (with reason) | High | CRUD |
| TC-PR-070403 | Bulk Send for Review (return to HOD) | High | CRUD |
| TC-PR-070404 | Bulk Split — split selected items | Low | Functional |
| TC-PR-070405 | Cannot edit when PR is at non-Purchase stage (read-only) | Medium | Authorization |
| TC-PR-070901 | Purchaser full flow: List → Detail → Edit (allocate vendor + price) → Bulk Approve → next stage | High | Smoke |

---

## TC-PR-070101 — List loads, My Pending tab default (PRs at Purchase stage)

> **As a** Purchase user, **I want** the Pr Purchaser Journey list page to load successfully, **so that** I can manage Pr Purchaser Journey records.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

Login เป็น Purchaser (carmensoftware.dev+purchase@gmail.com)

**Steps**

1. ไปที่ /procurement/purchase-request
2. ตรวจสอบ URL และแท็บ My Pending

**Expected**

URL อยู่ที่หน้า PR list; แท็บ My Pending ถูกเลือกเมื่อมีอยู่

---

## TC-PR-070102 — Switch to All Documents tab broadens scope

> **As a** Purchase user, **I want** this Pr Purchaser Journey interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

อยู่ที่หน้า PR list

**Steps**

1. คลิกแท็บ All Documents

**Expected**

แท็บ All Documents ถูกเลือก

---

## TC-PR-070103 — All Stage dropdown filters by status

> **As a** Purchase user, **I want** to filter the Pr Purchaser Journey list, **so that** I can narrow results to relevant records.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

อยู่ที่หน้า PR list

**Steps**

1. เปิด dropdown All Stage
2. เลือก In Progress

**Expected**

URL ยังคงอยู่ที่หน้า PR list (filter ถูกใช้งานหรือไม่มีผลเมื่อ dropdown ไม่มีอยู่)

---

## TC-PR-070104 — Filter panel opens and applies

> **As a** Purchase user, **I want** to filter the Pr Purchaser Journey list, **so that** I can narrow results to relevant records.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

อยู่ที่หน้า PR list

**Steps**

1. เปิดแผง Filter
2. เลือก status
3. Apply

**Expected**

URL ยังคงอยู่ที่หน้า PR list หลังจากใช้ filter

---

## TC-PR-070105 — Search by PR reference filters list

> **As a** Purchase user, **I want** to filter the Pr Purchaser Journey list, **so that** I can narrow results to relevant records.

**Priority:** Low · **Test Type:** Functional

**Preconditions**

อยู่ที่หน้า PR list; มี PR อย่างน้อยหนึ่งรายการที่มี reference ที่รู้จัก

**Steps**

1. พิมพ์ reference บางส่วนใน search
2. รอผลลัพธ์

**Expected**

URL ยังคงอยู่ที่หน้า PR list หลังจากพิมพ์ใน search input

---

## TC-PR-070150 — active BU = BLAVG

> **As a** Purchase user, **I want** core Pr Purchaser Journey interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

Login เป็น carmensoftware.dev+purchase@gmail.com ผ่าน auth fixture

**Steps**

1. เรียก ensureActiveBu(BLAVG)
2. อ่าน profile API
3. หา business unit ที่ is_default
4. อ่าน label ของ BU switcher

**Expected**

default business unit มี code === 'BLAVG'; trigger ของ BU switcher แสดง label ของ BU นั้น

---

## TC-PR-070201 — Detail loads with Items tab default

> **As a** Purchase user, **I want** core Pr Purchaser Journey interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

PR มีอยู่ที่ขั้นตอน Purchase (seeded ผ่าน submitPRAsRequestor + approveAsHOD)

**Steps**

1. เปิดหน้า PR detail
2. ตรวจสอบว่าแท็บ Items เป็นค่าเริ่มต้น

**Expected**

URL เป็น detail URL; แท็บ Items ถูกเลือกเมื่อมีอยู่

---

## TC-PR-070202 — Switch to Workflow History tab

> **As a** Purchase user, **I want** this Pr Purchaser Journey interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

อยู่ที่หน้า PR detail ขั้นตอน Purchase

**Steps**

1. คลิกแท็บ Workflow History

**Expected**

แท็บ Workflow History ถูกเลือก

---

## TC-PR-070203 — No standalone Approve/Reject/Return buttons (BRD discrepancy)

> **As a** low-privilege user, **I should NOT** see Add/edit controls on Pr Purchaser Journey, **so that** role separation is enforced.

**Priority:** High · **Test Type:** Authorization

**Preconditions**

อยู่ที่หน้า PR detail ขั้นตอน Purchase (read-only view)

**Steps**

1. ตรวจสอบ header / action toolbar ของหน้า detail

**Expected**

ปุ่ม Approve, Reject และ Send for Review แบบ standalone ต้องไม่ visible ที่ header ของหน้า (ตาม BRD discrepancy — actions อยู่ใน bulk toolbar ของ Edit Mode)

---

## TC-PR-070204 — Edit button visible (entry to vendor/pricing edit)

> **As a** Purchase user, **I want** this Pr Purchaser Journey interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

อยู่ที่หน้า PR detail ขั้นตอน Purchase

**Steps**

1. ตรวจสอบ action toolbar

**Expected**

ปุ่ม Edit visible (Purchaser สามารถเข้า Edit Mode สำหรับ vendor/pricing allocation ได้)

---

## TC-PR-070301 — Click Edit → vendor/pricing fields become editable

> **As a** Purchase user, **I want** core Pr Purchaser Journey interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

PR มีอยู่ที่ขั้นตอน Purchase

**Steps**

1. เปิด PR ขั้นตอน Purchase
2. คลิก Edit
3. ตรวจสอบว่าปุ่ม Save/Cancel ระดับฟอร์มปรากฏขึ้น

**Expected**

ปุ่ม Save Draft (หรือ Cancel) ระดับฟอร์ม visible

---

## TC-PR-070302 — Vendor field is editable (Purchaser scope)

> **As a** Purchase user, **I want** to edit an existing Pr Purchaser Journey record, **so that** its data stays accurate.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

Edit mode active อยู่บน PR ขั้นตอน Purchase ที่มีอย่างน้อยหนึ่งรายการ

**Steps**

1. เข้า edit mode
2. หา Vendor input ในแถวแรก
3. ตรวจสอบว่าแก้ไขได้

**Expected**

Vendor input แก้ไขได้ (ตรงข้ามกับ Approver ที่มองเห็นเป็น read-only)

---

## TC-PR-070303 — Unit Price field is editable

> **As a** Purchase user, **I want** to edit an existing Pr Purchaser Journey record, **so that** its data stays accurate.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

Edit mode active อยู่บน PR ขั้นตอน Purchase ที่มีอย่างน้อยหนึ่งรายการ

**Steps**

1. เข้า edit mode
2. หา Unit Price input
3. พิมพ์ค่า

**Expected**

Unit Price input รับค่าที่พิมพ์ได้

---

## TC-PR-070304 — Discount field is editable

> **As a** Purchase user, **I want** to edit an existing Pr Purchaser Journey record, **so that** its data stays accurate.

**Priority:** Medium · **Test Type:** CRUD

**Preconditions**

Edit mode active อยู่บน PR ขั้นตอน Purchase

**Steps**

1. เข้า edit mode
2. หา Discount input
3. ตรวจสอบว่าแก้ไขได้

**Expected**

Discount input แก้ไขได้

---

## TC-PR-070305 — Tax Profile field is editable

> **As a** Purchase user, **I want** to edit an existing Pr Purchaser Journey record, **so that** its data stays accurate.

**Priority:** Medium · **Test Type:** CRUD

**Preconditions**

Edit mode active อยู่บน PR ขั้นตอน Purchase

**Steps**

1. เข้า edit mode
2. หา Tax Profile select
3. ตรวจสอบว่าแก้ไขได้

**Expected**

Tax Profile select แก้ไขได้

---

## TC-PR-070306 — Approved Qty field stays read-only (HOD already set it)

> **As a** low-privilege user, **I should NOT** see Add/edit controls on Pr Purchaser Journey, **so that** role separation is enforced.

**Priority:** High · **Test Type:** Authorization

**Preconditions**

Edit mode active อยู่บน PR ขั้นตอน Purchase ที่มีอย่างน้อยหนึ่งรายการ

**Steps**

1. เข้า edit mode
2. หาช่อง Approved Qty ในแถวแรก

**Expected**

ช่อง Approved Qty ถูก disabled หรือแก้ไขไม่ได้สำหรับ Purchaser (HOD กำหนดค่าไว้แล้ว)

---

## TC-PR-070307 — Auto Allocate button populates vendors via scoring

> **As a** Purchase user, **I want** this Pr Purchaser Journey interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

Edit mode active อยู่บน PR ขั้นตอน Purchase ที่มีอย่างน้อยหนึ่งรายการ

**Steps**

1. เข้า edit mode
2. คลิก Auto Allocate

**Expected**

URL ยังคงอยู่ที่หน้า detail หลังจากคลิก (allocation ทำงาน)

---

## TC-PR-070308 — Multiple line items — pricing on each row independent

> **As a** Purchase user, **I want** to manage Pr Purchaser Journey records via CRUD, **so that** the data stays correct over time.

**Priority:** Medium · **Test Type:** CRUD

**Preconditions**

Edit mode active อยู่บน PR ขั้นตอน Purchase ที่มีหลายรายการ

**Steps**

1. Seed PR ด้วย 2 รายการ
2. เข้า edit mode
3. กำหนด unit price ในแถว 0
4. กำหนด unit price ในแถว 1
5. ตรวจสอบว่าทั้งสองค่ามีอยู่

**Expected**

Unit Price input ของแต่ละแถวเก็บค่าของตัวเองไว้

---

## TC-PR-070309 — Save edits → exit edit mode + persist values

> **As a** Purchase user, **I want** to edit an existing Pr Purchaser Journey record, **so that** its data stays accurate.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

Edit mode active อยู่บน PR ขั้นตอน Purchase ที่มีการแก้ไข vendor/price

**Steps**

1. เข้า edit mode
2. กำหนด unit price
3. คลิก Save Draft

**Expected**

ฟอร์มกลับไปที่ view mode (ปุ่ม Edit visible อีกครั้ง)

---

## TC-PR-070310 — Cancel edits → discard changes, restore original

> **As a** Purchase user, **I want** this Pr Purchaser Journey interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

Edit mode active อยู่บน PR ขั้นตอน Purchase

**Steps**

1. เข้า edit mode
2. พิมพ์ใน Unit Price
3. คลิก Cancel

**Expected**

ฟอร์มกลับไปที่ view mode (ปุ่ม Edit visible อีกครั้ง)

---

## TC-PR-070311 — Price Comparison มีคอลัมน์ Inc VAT ก่อน Price และ Net Price ถัดจาก Price

> **As a** Purchase user, **I want** this Pr Purchaser Journey interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

Login เป็น Purchaser; PR 1 รายการที่ผ่าน HOD แล้ว (อยู่ขั้นตอน Purchase) สร้างใน beforeAll

**Steps**

1. เปิด PR detail
2. กด Expand row ของรายการแรก
3. กดปุ่ม Compare price
4. อ่านหัวคอลัมน์ของตารางใน dialog

**Expected**

dialog 'Price Comparison' เปิดขึ้น; มีหัวคอลัมน์ Inc VAT, Price, Net Price และเรียงลำดับ Inc VAT → Price → Net Price

> _Note: carmen-frontend #537/#538 (v2.5.56)_

---

## TC-PR-070312 — คอลัมน์ Inc VAT แสดง ✓ หรือ — ตรงกับ is_tax_included ทุกแถว

> **As a** Purchase user, **I want** this Pr Purchaser Journey interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

PR ขั้นตอน Purchase จาก beforeAll; สินค้ามีรายการราคา (price list) อย่างน้อย 1 รายการใน BU

**Steps**

1. เปิด Price Comparison ของรายการแรก
2. ดักผลลัพธ์ API price-compare
3. อ่านเซลล์คอลัมน์ Inc VAT ของแต่ละแถว

**Expected**

แถวที่ is_tax_included = true มีไอคอน ✓ (aria-label 'Inc VAT'); แถวอื่นแสดง '—' — ไม่มีแถวที่ว่าง

> _Note: carmen-frontend #538 — เดิมแถวที่ไม่ติ๊กอ่านไม่ออกว่า 'ไม่รวม' หรือ 'ไม่มีข้อมูล'_

---

## TC-PR-070313 — Net Price แสดงราคาก่อน VAT และป้าย Best อยู่ที่ Net Price ต่ำสุด

> **As a** Purchase user, **I want** this Pr Purchaser Journey interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

PR ขั้นตอน Purchase จาก beforeAll; สินค้ามีรายการราคาอย่างน้อย 1 รายการใน BU

**Steps**

1. เปิด Price Comparison ของรายการแรก
2. ดักผลลัพธ์ API price-compare
3. เทียบเซลล์ Price และ Net Price ของแต่ละแถวกับ price / price_without_tax
4. ตรวจตำแหน่งป้าย Best

**Expected**

Price = price ที่กรอก; Net Price = price_without_tax (หรือ price เมื่อไม่มีค่า); ป้าย Best อยู่ในคอลัมน์ Net Price เฉพาะแถวที่ Net Price ต่ำสุด และไม่อยู่ในคอลัมน์ Price

> _Note: carmen-frontend #537 — Best เดิมตัดสินจากราคาที่กรอก ทำให้ราคารวม VAT เทียบกับราคาไม่รวมตรง ๆ_

---

## TC-PR-070314 — โหมดดู (ไม่ได้กด Edit) dialog เป็นแบบอ่านอย่างเดียว ไม่มีปุ่ม Assign

> **As a** Purchase user, **I want** this Pr Purchaser Journey behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Negative

**Preconditions**

PR ขั้นตอน Purchase จาก beforeAll; Purchaser ยังไม่เข้า edit mode

**Steps**

1. เปิด PR detail (โหมดดู)
2. เปิด Price Comparison ของรายการแรก
3. หาปุ่ม Assign ใน dialog

**Expected**

dialog เปิดได้ แต่ไม่มีปุ่ม Assign ในตาราง (readOnly เมื่อฟอร์มยังไม่อยู่ใน edit mode)

---

## TC-PR-070315 — Edit mode: กด Assign แล้ว dialog ปิดและรายการได้ vendor ของแถวที่เลือก

> **As a** Purchase user, **I want** this Pr Purchaser Journey behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Happy Path

**Preconditions**

PR ขั้นตอน Purchase จาก beforeAll; สินค้ามีรายการราคาอย่างน้อย 1 รายการใน BU

**Steps**

1. เปิด PR detail แล้วกด Edit
2. เปิด Price Comparison ของรายการแรก
3. กด Assign ที่แถวสุดท้าย
4. Cancel เพื่อไม่บันทึก

**Expected**

dialog ปิด; ชื่อ vendor ของแถวที่ Assign แสดงในตารางรายการ; Cancel แล้วออกจาก edit mode (ไม่บันทึกข้อมูล)

---

## TC-PR-070401 — Bulk Approve → PR advances to next stage (FC)

> **As a** FC user, **I want** to manage Pr Purchaser Journey records via CRUD, **so that** the data stays correct over time.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

Edit mode active อยู่บน PR ขั้นตอน Purchase

**Steps**

1. เข้า edit mode
2. เลือกทุกแถว
3. คลิก Approve ใน bulk toolbar
4. Confirm

**Expected**

URL ยังคงอยู่ที่ PR ref (status เลื่อนไปขั้นตอนถัดไป)

---

## TC-PR-070402 — Bulk Reject (with reason)

> **As a** Purchase user, **I want** to manage Pr Purchaser Journey records via CRUD, **so that** the data stays correct over time.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

Edit mode active อยู่บน PR ขั้นตอน Purchase

**Steps**

1. เข้า edit mode
2. เลือกทุกแถว
3. คลิก Reject
4. กรอกเหตุผล
5. Confirm

**Expected**

URL ยังคงอยู่ที่ PR ref หลังจาก reject

---

## TC-PR-070403 — Bulk Send for Review (return to HOD)

> **As a** HOD user, **I want** to manage Pr Purchaser Journey records via CRUD, **so that** the data stays correct over time.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

Edit mode active อยู่บน PR ขั้นตอน Purchase

**Steps**

1. เข้า edit mode
2. เลือกทุกแถว
3. คลิก Send for Review
4. กรอกเหตุผล + stage
5. Confirm

**Expected**

URL ยังคงอยู่ที่ PR ref หลังจาก send for review

---

## TC-PR-070404 — Bulk Split — split selected items

> **As a** Purchase user, **I want** this Pr Purchaser Journey interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Low · **Test Type:** Functional

**Preconditions**

Edit mode active อยู่บน PR ขั้นตอน Purchase

**Steps**

1. เข้า edit mode
2. เลือกทุกแถว
3. คลิก Split

**Expected**

Split UI ปรากฏขึ้น (dialog หรือ inline) — ตรวจสอบโดย URL ยังคงอยู่ที่หน้า detail

---

## TC-PR-070405 — Cannot edit when PR is at non-Purchase stage (read-only)

> **As a** low-privilege user, **I should NOT** see Add/edit controls on Pr Purchaser Journey, **so that** role separation is enforced.

**Priority:** Medium · **Test Type:** Authorization

**Preconditions**

PR อยู่ที่ขั้นตอน HOD (ยังไม่ได้รับการ approve จาก HOD) ดูโดย Purchaser

**Steps**

1. Seed PR ที่ขั้นตอน HOD (ข้าม approveAsHOD)
2. เปิด detail ในฐานะ Purchaser
3. ตรวจสอบปุ่ม Edit

**Expected**

ปุ่ม Edit ไม่มีอยู่ หรือ detail เป็น read-only — Purchaser ไม่สามารถแก้ไขได้จนกว่า PR จะถึงขั้นตอน Purchase

---

## TC-PR-070901 — Purchaser full flow: List → Detail → Edit (allocate vendor + price) → Bulk Approve → next stage

> **As a** Purchase user, **I want** the Pr Purchaser Journey list page to load successfully, **so that** I can manage Pr Purchaser Journey records.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

Login เป็น Purchaser; PR ใหม่ถูก seed ที่ขั้นตอน Purchase ผ่าน submitPRAsRequestor + approveAsHOD

**Steps**

1. เปิด PR list
2. เปิด PR detail
3. คลิก Edit
4. กำหนด unit price ในแถวแรก
5. เลือกทั้งหมด + Bulk Approve + Confirm

**Expected**

URL ยังคงอยู่ที่ PR ref หลังจาก bulk approve; journey เสร็จสมบูรณ์ตั้งแต่ต้นจนจบ

---


<sub>Last regenerated: 2026-11-10 · git 3d9ae0d</sub>
