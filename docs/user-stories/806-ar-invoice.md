# Ar Invoice — User Stories

_Generated from `tests/806-ar-invoice.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Ar Invoice
**Spec:** `tests/806-ar-invoice.spec.ts`
**Default role:** Budget
**Total test cases:** 49 (32 High / 17 Medium / 0 Low)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-ARINV-010001 | รายการแสดงใบ read-set ครบ พร้อมยอด สถานะ และยอดค้าง | High | Functional |
| TC-ARINV-010002 | ตัวกรองสถานะ Draft แสดงเฉพาะใบ Draft ของ read-set | Medium | Functional |
| TC-ARINV-010003 | ตัวกรองประเภทเอกสาร Credit note แสดงเฉพาะใบลดหนี้ | Medium | Functional |
| TC-ARINV-010004 | ค้นด้วยเลขเอกสารของ E2E-AR-POSTED เจอใบเดียว | Medium | Functional |
| TC-ARINV-010005 | รายละเอียด E2E-AR-POSTED แสดงบรรทัด VAT 70.00 เลขใบกำกับภาษี และลิงก์ JV | High | Edge Case |
| TC-ARINV-020001 | สร้างใบผ่าน UI 2 บรรทัด: ยอดที่แสดงและที่บันทึกตรง oracle เลข DRAFT- สถานะ Draft | High | CRUD |
| TC-ARINV-020002 | ไม่เลือกลูกค้า: บันทึกไม่ได้ ยังอยู่หน้า new และไม่มีใบถูกสร้าง | High | Validation |
| TC-ARINV-020003 | บรรทัดที่ไม่มีบัญชีรายได้: dialog ปฏิเสธและไม่เพิ่มบรรทัด | High | Validation |
| TC-ARINV-020004 | ส่วนลด 10% บน 1 x 1,000.00 Vat 7%: net 900.00 VAT 63.00 รวม 963.00 | Medium | Edge Case |
| TC-ARINV-030001 | แก้ราคาบรรทัดของใบ Draft ผ่าน UI: API ได้ยอดรวมใหม่ | High | CRUD |
| TC-ARINV-030002 | PUT ด้วย doc_version เก่า: ถูกปฏิเสธ 409 AR_INVOICE_IMMUTABLE และใบไม่เปลี่ยน | Medium | Negative |
| TC-ARINV-030003 | ลบใบ Draft ที่เลข DRAFT- ผ่าน UI: GET ตอบ 404 | High | CRUD |
| TC-ARINV-040001 | Submit (ไม่มี workflow) ลงบัญชีทันที: เลข ARIV สถานะ posted ค้าง = ยอดรวม | High | Happy Path |
| TC-ARINV-040002 | JV ของใบที่ลงบัญชี: สมดุล Dr 1130 = ยอดรวม Cr 4100 = net และมีขา VAT ตามจำนวน | High | Functional |
| TC-ARINV-040003 | ขา VAT ของใบขายลงบัญชี 2160 Output VAT ตาม gl_setting.output_vat_account_id | High | Functional |
| TC-ARINV-040004 | ใบกำกับภาษี (API create): ได้เลข TXIV และสถานะ pending | High | Functional |
| TC-ARINV-040005 | ลูกค้า E2E-CUST-2 (ไม่มีบัญชีลูกหนี้): Dr 1130 ผ่านค่าเริ่มต้นของ gl_setting | Medium | Alternate Flow |
| TC-ARINV-040006 | ยอดรวม 0: Submit ถูกปฏิเสธ 400 และใบยังเป็น Draft | Medium | Negative |
| TC-ARINV-040007 | ใบกำกับภาษีที่ผสมอัตรา VAT: Submit ถูกปฏิเสธ 400 AR_TAX_INVOICE_MIXED_VAT_RATE | Medium | Negative |
| TC-ARINV-050001 | ใบเพิ่มหนี้ (API) ลงบัญชีด้วยด้านเดียวกับใบขาย เลข ARDN และเปิดดูใน UI ได้ | High | Functional |
| TC-ARINV-050002 | ขา VAT ของใบเพิ่มหนี้ลงบัญชี 2160 Output VAT | High | Functional |
| TC-ARINV-050003 | ใบลดหนี้ (API) ลงบัญชีด้านกลับกับใบขาย เลข ARCN และเปิดดูใน UI ได้ | High | Functional |
| TC-ARINV-050004 | ขา VAT ของใบลดหนี้ลงบัญชี 2160 Output VAT ฝั่ง Dr | High | Functional |
| TC-ARINV-060001 | reference-candidates ของใบขายแสดงใบลดหนี้ที่ลงบัญชีแล้วพร้อมยอดคงเหลือ | High | Functional |
| TC-ARINV-060002 | ใบขายที่หักใบลดหนี้ 50.00: ค้าง = ยอดรวม - 50.00 และ referenceApplied ของใบลดหนี้ = 50.00 | High | Functional |
| TC-ARINV-060003 | หักใบลดหนี้เกินยอดคงเหลือ: ถูกปฏิเสธ AR_REFERENCE_OVER_APPLIED และไม่มีผลกับใบลดหนี้ | Medium | Negative |
| TC-ARINV-060004 | Void ใบลดหนี้ที่ถูกอ้างโดยใบขายที่ลงบัญชีแล้ว: ถูกปฏิเสธ 409 AR_INVOICE_IS_REFERENCED | High | Negative |
| TC-ARINV-070001 | Void ใบที่ลงบัญชีผ่าน UI: ปุ่มยืนยันปิดจนกว่าจะใส่เหตุผล แล้วสถานะ void ค้าง 0.00 | High | Functional |
| TC-ARINV-070002 | JV กลับรายการของใบที่ void หักล้างของเดิมทุกบรรทัด | High | Functional |
| TC-ARINV-070003 | ขา VAT ของ JV กลับรายการหักล้างที่ 2160 Output VAT | High | Functional |
| TC-ARINV-070004 | Void ใบกำกับภาษี: ใบกำกับภาษีเป็น void | Medium | Functional |
| TC-ARINV-070005 | Void โดยไม่ใส่เหตุผล (API): ถูกปฏิเสธ 400 และใบยัง posted | Medium | Negative |
| TC-ARINV-070006 | Void ใบ Draft: สถานะ void และไม่มี JV | Medium | Alternate Flow |
| TC-ARINV-080001 | Submit ตอนมี workflow: สถานะ in_review ได้เลขจริง ARIV และยังไม่มี JV | High | Functional |
| TC-ARINV-080002 | ผู้สร้างที่เป็นผู้อนุมัติของขั้นด้วย อนุมัติใบของตัวเองไม่ได้: 403 WORKFLOW_CREATOR_CANNOT_APPROVE | High | Negative |
| TC-ARINV-080003 | ผู้ไม่ใช่ผู้อนุมัติของขั้น Approve ไม่ได้: 422 WORKFLOW_USER_NOT_STAGE_APPROVER | High | Authorization |
| TC-ARINV-080004 | Budget อนุมัติผ่านหน้ารายละเอียด: สถานะ posted และมี JV สมดุล | High | Happy Path |
| TC-ARINV-080005 | Reject โดยเหตุผลว่าง (blank): 422 AR_INVOICE_REJECT_REASON_REQUIRED และใบยัง in_review | Medium | Validation |
| TC-ARINV-080006 | Budget Reject พร้อมเหตุผลผ่านหน้ารายละเอียด: void ยอดค้าง 0.00 ไม่มี JV และไม่มี tax invoice | High | Alternate Flow |
| TC-ARINV-080007 | Budget ส่งกลับไปขั้น Create Request: ใบกลับเป็น draft และเลขจริงเดิม | High | Alternate Flow |
| TC-ARINV-080008 | ลบใบ draft ที่ถือเลขจริงแล้ว: 422 AR_INVOICE_NUMBERED_VOID_ONLY | Medium | Negative |
| TC-ARINV-080009 | ลบใบที่ in_review: 409 AR_INVOICE_IMMUTABLE | Medium | Negative |
| TC-ARINV-080010 | Admin (อยู่แค่ขั้น Create Request) อนุมัติใบของตัวเองไม่ได้: 422 WORKFLOW_USER_NOT_STAGE_APPROVER | Medium | Authorization |
| TC-ARINV-100001 | Requestor เห็นรายการและรายละเอียดของใบที่ลงบัญชีแล้ว | High | Authorization |
| TC-ARINV-100002 | Requestor ไม่เห็นปุ่ม Void บนใบ posted และใบ Draft และไม่เห็น Submit บนใบ posted | High | Authorization |
| TC-ARINV-100003 | Requestor ไม่เห็นปุ่ม New Invoice ที่กดได้บนรายการ | Medium | Authorization |
| TC-ARINV-100004 | Requestor void ใบผ่าน API: ถูกปฏิเสธ 4xx และใบยังคง posted | High | Security |
| TC-ARINV-100005 | Requestor (สิทธิ์ view อย่างเดียว) ไม่เห็นปุ่ม Submit บนใบ Draft เมื่อไม่มี workflow | High | Authorization |
| TC-ARINV-100006 | Requestor (สิทธิ์ view อย่างเดียว) submit ใบ Draft ผ่าน API เมื่อไม่มี workflow: ถูกปฏิเสธ 403 และใบยังคง draft | High | Security |

---

## TC-ARINV-010001 — รายการแสดงใบ read-set ครบ พร้อมยอด สถานะ และยอดค้าง

> **As a** Budget user, **I want** this Ar Invoice interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

Admin login บน TEST BU; data:reset --yes แล้ว (มีใบ E2E-AR-POSTED / DRAFT / CN / DN / VOID)

**Steps**

1. เปิด /accounting/accounts-receivable/invoice
2. ค้น E2E-AR-
3. ดูแถวของแต่ละใบ (หาจากเลขเอกสาร)

**Expected**

POSTED = 1,069.99 ค้าง 1,069.99 Posted; DRAFT = 535.00 สถานะ Draft; CN = 107.00 ค้าง 107.00 Posted; DN = 200.00 ค้าง 200.00 Posted; VOID = 300.00 ค้าง 0.00 Void. assumption: ยอด POSTED = 3 x 333.33 + VAT 7% ปัดครึ่งขึ้นต่อบรรทัด

---

## TC-ARINV-010002 — ตัวกรองสถานะ Draft แสดงเฉพาะใบ Draft ของ read-set

> **As a** Budget user, **I want** to filter the Ar Invoice list, **so that** I can narrow results to relevant records.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

Admin login; data:reset --yes แล้ว (E2E-AR-DRAFT เป็น Draft ใบอื่นของ read-set ลงบัญชีหรือ void แล้ว)

**Steps**

1. เปิดรายการ AR invoice
2. ค้น E2E-AR-
3. Filter > Status > Draft

**Expected**

เหลือแถว E2E-AR-DRAFT แถวเดียว สถานะ Draft; ไม่มีแถวของ E2E-AR-POSTED

---

## TC-ARINV-010003 — ตัวกรองประเภทเอกสาร Credit note แสดงเฉพาะใบลดหนี้

> **As a** Budget user, **I want** to filter the Ar Invoice list, **so that** I can narrow results to relevant records.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

Admin login; data:reset --yes แล้ว (E2E-AR-CN เป็นใบลดหนี้เพียงใบเดียวใน read-set)

**Steps**

1. เปิดรายการ AR invoice
2. ค้น E2E-AR-
3. Filter > Document type > Credit note

**Expected**

เหลือแถว E2E-AR-CN แถวเดียว ประเภท Credit note; ไม่มีแถวของ E2E-AR-POSTED และ E2E-AR-DN

---

## TC-ARINV-010004 — ค้นด้วยเลขเอกสารของ E2E-AR-POSTED เจอใบเดียว

> **As a** Budget user, **I want** this Ar Invoice interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

Admin login; data:reset --yes แล้ว

**Steps**

1. เปิดรายการ AR invoice
2. พิมพ์เลขเอกสารของ E2E-AR-POSTED ในช่องค้นแล้วกด Enter

**Expected**

เหลือแถวเดียวและเป็นเลขเอกสารนั้น; ไม่มีแถวของ E2E-AR-DRAFT

---

## TC-ARINV-010005 — รายละเอียด E2E-AR-POSTED แสดงบรรทัด VAT 70.00 เลขใบกำกับภาษี และลิงก์ JV

> **As a** Budget user, **I want** this Ar Invoice behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Edge Case

**Preconditions**

Admin login; data:reset --yes แล้ว; E2E-AR-POSTED มีบรรทัดเดียว 3 x 333.33 VAT 7% เป็นใบกำกับภาษี ลงบัญชีแล้ว

**Steps**

1. หา id ของ E2E-AR-POSTED
2. เปิดหน้ารายละเอียด
3. อ่านบรรทัดและแถบสรุปท้ายหน้า
4. เปิดแท็บ Journal

**Expected**

บรรทัด 3 x 333.33 net 999.99 VAT 70.00; แถบสรุป net 999.99 / Tax 1 70.00 / total 1,069.99 / outstanding 1,069.99 เท่ากับ money.ts; ช่อง Tax invoice เป็นเลข TXIV...; แท็บ Journal มีลิงก์เลข JV ของใบนี้. assumption: VAT 7% บนฐานก่อน VAT ปัดครึ่งขึ้นต่อบรรทัด

---

## TC-ARINV-020001 — สร้างใบผ่าน UI 2 บรรทัด: ยอดที่แสดงและที่บันทึกตรง oracle เลข DRAFT- สถานะ Draft

> **As a** Budget user, **I want** to create a new Ar Invoice record, **so that** it becomes available for downstream operations.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

Admin login; ลูกค้า E2E-CUST-1, บัญชี 4100, cost center E2E-CC-1 และ Vat 7% มีใน TEST BU

**Steps**

1. เปิด /accounting/accounts-receivable/invoice/new
2. เลือกลูกค้า E2E-CUST-1 และกรอก Description
3. บรรทัด 1 = 2 x 100.00 Vat 7%, บรรทัด 2 = 1 x 999.99 ไม่มีภาษี (4100, E2E-CC-1)
4. อ่านแถบสรุป
5. กด Save Draft

**Expected**

แถบสรุปก่อนบันทึก net 1,199.99 VAT 14.00 total 1,213.99; บันทึกแล้ว toast Invoice draft created ไปหน้ารายละเอียด; API ได้ยอดเดียวกัน เลขเอกสารตรง /^DRAFT-\d{8}$/ สถานะ draft 2 บรรทัด. assumption: VAT ปัดต่อบรรทัดแล้วรวม

---

## TC-ARINV-020002 — ไม่เลือกลูกค้า: บันทึกไม่ได้ ยังอยู่หน้า new และไม่มีใบถูกสร้าง

> **As a** Budget user, **I want** the system to block invalid Ar Invoice submissions, **so that** data quality is preserved.

**Priority:** High · **Test Type:** Validation

**Preconditions**

Admin login; ฟอร์มใบใหม่ที่มี 1 บรรทัดครบ แต่ยังไม่เลือกลูกค้า

**Steps**

1. เปิดหน้า new, กรอก Description ที่เป็น tag
2. เพิ่ม 1 บรรทัด 1 x 100.00
3. กด Save Draft โดยไม่เลือกลูกค้า

**Expected**

ข้อความ Select an active AR customer. ปรากฏ; ไม่มี request เขียนไป backend; URL ยังเป็น /invoice/new; ค้นด้วย tag ไม่พบใบใด

---

## TC-ARINV-020003 — บรรทัดที่ไม่มีบัญชีรายได้: dialog ปฏิเสธและไม่เพิ่มบรรทัด

> **As a** Budget user, **I want** the system to block invalid Ar Invoice submissions, **so that** data quality is preserved.

**Priority:** High · **Test Type:** Validation

**Preconditions**

Admin login; ฟอร์มใบใหม่เลือกลูกค้า E2E-CUST-1 แล้ว

**Steps**

1. กด Add Line
2. กรอกจำนวน 1 ราคา 100.00 และเลือก cost center แต่ไม่เลือกบัญชีรายได้
3. กด Add

**Expected**

ข้อความ Select a revenue account and its cost center. ปรากฏใน dialog; dialog ยังเปิด; ตารางบรรทัดยังว่าง (แถบสรุป total 0.00); ไม่มี request เขียน

---

## TC-ARINV-020004 — ส่วนลด 10% บน 1 x 1,000.00 Vat 7%: net 900.00 VAT 63.00 รวม 963.00

> **As a** Budget user, **I want** this Ar Invoice behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Edge Case

**Preconditions**

Admin login; ลูกค้า E2E-CUST-1, 4100, E2E-CC-1 และ Vat 7% มีใน TEST BU

**Steps**

1. เปิดหน้า new, เลือกลูกค้า, กรอก Description เป็น tag
2. เพิ่มบรรทัด 1 x 1,000.00 ส่วนลด 10% Vat 7%
3. อ่านแถบสรุป
4. กด Save Draft

**Expected**

แถบสรุปก่อนและหลังบันทึก (API) net 900.00 (1,000.00 - ส่วนลด 100.00) VAT 63.00 (7% ของฐานหลังลด) total 963.00. assumption: VAT คิดจากฐานหลังหักส่วนลด

---

## TC-ARINV-030001 — แก้ราคาบรรทัดของใบ Draft ผ่าน UI: API ได้ยอดรวมใหม่

> **As a** Budget user, **I want** to create a new Ar Invoice record, **so that** it becomes available for downstream operations.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

Admin login; ใบ Draft ที่สร้างผ่าน API มีบรรทัดเดียว 2 x 100.00 Vat 7%

**Steps**

1. เปิดหน้ารายละเอียดใบ Draft
2. กด Edit
3. เปิดบรรทัด 1 เปลี่ยนราคาเป็น 150.00 กด Save
4. อ่านแถบสรุป
5. กด Save

**Expected**

ก่อนบันทึกแถบสรุป net 300.00 VAT 21.00 total 321.00; หลังบันทึก toast Invoice draft saved และ API ได้ 300.00 / 21.00 / 321.00 สถานะ draft. assumption: VAT 7% บนฐานก่อน VAT

---

## TC-ARINV-030002 — PUT ด้วย doc_version เก่า: ถูกปฏิเสธ 409 AR_INVOICE_IMMUTABLE และใบไม่เปลี่ยน

> **As a** Budget user, **I want** this Ar Invoice behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Negative

**Preconditions**

Admin login; ใบ Draft ที่สร้างผ่าน API; แก้ description สำเร็จหนึ่งครั้ง (doc_version เพิ่ม)

**Steps**

1. PUT /ar-invoice/:id ด้วย doc_version ปัจจุบันและ description ใหม่ (สำเร็จ)
2. PUT อีกครั้งด้วย doc_version เดิมที่เก่าแล้ว

**Expected**

ครั้งแรก 200; ครั้งที่สองตอบ 409 รหัส AR_INVOICE_IMMUTABLE; description ยังเป็นค่าของครั้งแรก. assumption: การเขียนทับด้วยเวอร์ชันเก่าถูกปฏิเสธ (optimistic concurrency)

---

## TC-ARINV-030003 — ลบใบ Draft ที่เลข DRAFT- ผ่าน UI: GET ตอบ 404

> **As a** Budget user, **I want** to delete a Ar Invoice record, **so that** the list reflects only valid entries.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

Admin login; ใบ Draft ที่สร้างผ่าน API (เลข DRAFT-xxxxxxxx ยังไม่เคย Submit)

**Steps**

1. เปิดหน้ารายละเอียดใบ Draft
2. กด Delete แล้วยืนยัน
3. GET /ar-invoice/:id

**Expected**

toast Invoice draft deleted กลับไปรายการ; GET ตอบ 404. assumption: ใบ Draft ที่ยังเป็นเลข DRAFT- ลบทิ้งได้จริง

---

## TC-ARINV-040001 — Submit (ไม่มี workflow) ลงบัญชีทันที: เลข ARIV สถานะ posted ค้าง = ยอดรวม

> **As a** Budget user, **I want** this Ar Invoice behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Happy Path

**Preconditions**

Admin login; ไม่มี ar_invoice workflow ที่ active; ใบ Draft 2 บรรทัด (2 x 100.00 Vat 7%, 1 x 999.99 ไม่มีภาษี)

**Steps**

1. สร้างใบ Draft ผ่าน API
2. POST /ar-invoice/:id/submit
3. อ่านใบกลับ

**Expected**

ตอบ 200; เลขเอกสารตรง /^ARIV\d{8}$/ (ไม่ใช่ DRAFT-); สถานะ posted; net 1,199.99 VAT 14.00 total 1,213.99; ยอดค้าง = ยอดรวม 1,213.99; มี JV (gl_jv_id)

---

## TC-ARINV-040002 — JV ของใบที่ลงบัญชี: สมดุล Dr 1130 = ยอดรวม Cr 4100 = net และมีขา VAT ตามจำนวน

> **As a** Budget user, **I want** this Ar Invoice interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

Admin login; ใบ 2 บรรทัด (2 x 100.00 Vat 7%, 1 x 999.99 ไม่มีภาษี) ลูกค้า E2E-CUST-1 ที่ Submit ลงบัญชีแล้ว

**Steps**

1. Submit ใบผ่าน API
2. อ่านบรรทัดของ JV ที่ source = ar_invoice และ id ของใบ

**Expected**

JV เดียว Dr รวม = Cr รวม; Dr 1130 = 1,213.99; Cr 4100 = 1,199.99; มีขา Cr VAT = 14.00 บนบัญชีหนึ่ง (ไม่ยืนยันบัญชี VAT ที่นี่ ดู 040003). assumption: ใบขาย Dr ลูกหนี้ = ยอดรวม / Cr รายได้ = net / Cr VAT = VAT

---

## TC-ARINV-040003 — ขา VAT ของใบขายลงบัญชี 2160 Output VAT ตาม gl_setting.output_vat_account_id

> **As a** Budget user, **I want** this Ar Invoice interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

Admin login; gl_setting.output_vat_account_id = 2160; ใบ 2 x 100.00 Vat 7% ลูกค้า E2E-CUST-1 (ไม่ส่ง vat_chart_of_accounts_id ที่บรรทัด)

**Steps**

1. Submit ใบผ่าน API
2. อ่าน JV ของใบ

**Expected**

Cr 2160 = 14.00 (VAT ขาย ต้องเข้าบัญชีภาษีขายตามตั้งค่า AR). assumption: ตั้งค่า output_vat_account_id ของ AR ต้องมาก่อนบัญชีของ tax profile ที่ใช้ฝั่งซื้อ (user ตัดสิน 2026-11-25 ตัวเลือก a)

> _Note: ปักเป็นบั๊ก: backend ใช้บัญชีของ tax profile (1170 Input VAT) ก่อน gl_setting.output_vat_account_id; ดู bug list_

---

## TC-ARINV-040004 — ใบกำกับภาษี (API create): ได้เลข TXIV และสถานะ pending

> **As a** Budget user, **I want** this Ar Invoice interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

Admin login; ใบ 1 x 100.00 Vat 7% สร้างผ่าน API ด้วย is_tax_invoice = true (UI ไม่ติ๊กเพราะส่วนเสริมยัง mock)

**Steps**

1. สร้างใบด้วย taxInvoice = true
2. Submit
3. อ่านใบกลับ

**Expected**

สถานะ posted; เลขใบกำกับภาษีตรง /^TXIV\d{8}$/; สถานะใบกำกับภาษี pending. assumption: ใบกำกับภาษีออกตอนลงบัญชีและเริ่มที่ pending

---

## TC-ARINV-040005 — ลูกค้า E2E-CUST-2 (ไม่มีบัญชีลูกหนี้): Dr 1130 ผ่านค่าเริ่มต้นของ gl_setting

> **As a** Budget user, **I want** this Ar Invoice behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Alternate Flow

**Preconditions**

Admin login; E2E-CUST-2 ไม่มี ar_chart_of_accounts_id; gl_setting.ar_control_account_id = 1130

**Steps**

1. สร้างใบ 1 x 100.00 Vat 7% ลูกค้า E2E-CUST-2
2. Submit
3. อ่าน JV

**Expected**

สถานะ posted; Dr 1130 = 107.00 (ยอดรวม); JV สมดุล. assumption: ลูกค้าที่ไม่มีบัญชีลูกหนี้ใช้ ar_control_account_id ของ gl_setting

---

## TC-ARINV-040006 — ยอดรวม 0: Submit ถูกปฏิเสธ 400 และใบยังเป็น Draft

> **As a** Budget user, **I want** this Ar Invoice behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Negative

**Preconditions**

Admin login; ใบ Draft 1 บรรทัด 1 x 0.00 ไม่มีภาษี (ยอดรวม 0)

**Steps**

1. POST /ar-invoice/:id/submit

**Expected**

ตอบ 400 รหัส AR_INVOICE_LINE_INVALID; ใบยัง draft เลข DRAFT- ไม่มี JV. assumption: ใบที่ยอดรวม 0 ลงบัญชีไม่ได้ (ตามรหัสข้อผิดพลาดของ BE)

---

## TC-ARINV-040007 — ใบกำกับภาษีที่ผสมอัตรา VAT: Submit ถูกปฏิเสธ 400 AR_TAX_INVOICE_MIXED_VAT_RATE

> **As a** Budget user, **I want** this Ar Invoice behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Negative

**Preconditions**

Admin login; ใบกำกับภาษี (is_tax_invoice) 2 บรรทัด: 1 x 100.00 Vat 7% และ 1 x 100.00 ไม่มีภาษี (None 0%); TEST BU มีโปรไฟล์ VAT เดียว (Vat 7%) จึงสร้างอัตรา VAT ที่ไม่ใช่ศูนย์ตัวที่สองไม่ได้

**Steps**

1. POST /ar-invoice/:id/submit

**Expected**

ตอบ 400 รหัส AR_TAX_INVOICE_MIXED_VAT_RATE; ใบยัง draft ไม่มี JV ไม่มีเลข TXIV. assumption: ใบกำกับภาษีใบเดียวมี VAT อัตราเดียว (spec §10.2 ที่โค้ด BE อ้าง) และบรรทัด 0% ก็เป็นอัตราหนึ่งที่ต่างจาก 7%

> _Note: ปักเป็นคำถามเชิงผลิตภัณฑ์: BE นับเฉพาะบรรทัดที่ VAT ไม่ศูนย์ (mixedVatRate ใน ar-invoice.service.ts) จึงรับ 7% + 0% บนใบกำกับภาษีใบเดียว; ดู bug list_

---

## TC-ARINV-050001 — ใบเพิ่มหนี้ (API) ลงบัญชีด้วยด้านเดียวกับใบขาย เลข ARDN และเปิดดูใน UI ได้

> **As a** Budget user, **I want** this Ar Invoice interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

Admin login; ใบเพิ่มหนี้ 1 x 200.00 Vat 7% (UI สร้างได้เฉพาะ invoice จึงสร้างผ่าน API)

**Steps**

1. สร้างใบเพิ่มหนี้ผ่าน API แล้ว Submit
2. อ่าน JV
3. เปิดหน้ารายละเอียดใน UI

**Expected**

เลขตรง /^ARDN\d{8}$/ สถานะ posted; Dr 1130 = 214.00, Cr 4100 = 200.00, มีขา Cr VAT = 14.00; JV สมดุล; UI แสดง Posted และ total 214.00. assumption: ใบเพิ่มหนี้ใช้ด้านเดียวกับใบขาย

---

## TC-ARINV-050002 — ขา VAT ของใบเพิ่มหนี้ลงบัญชี 2160 Output VAT

> **As a** Budget user, **I want** this Ar Invoice interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

Admin login; gl_setting.output_vat_account_id = 2160; ใบเพิ่มหนี้ 1 x 200.00 Vat 7% (ไม่ส่ง vat_chart_of_accounts_id)

**Steps**

1. สร้างใบเพิ่มหนี้ผ่าน API แล้ว Submit
2. อ่าน JV

**Expected**

Cr 2160 = 14.00. assumption: เหมือน 040003 บัญชี VAT ขายของ AR ต้องมาก่อนบัญชีของ tax profile

> _Note: ปักเป็นบั๊กเดียวกับ 040003 (backend ใช้บัญชี tax profile 1170); ดู bug list_

---

## TC-ARINV-050003 — ใบลดหนี้ (API) ลงบัญชีด้านกลับกับใบขาย เลข ARCN และเปิดดูใน UI ได้

> **As a** Budget user, **I want** this Ar Invoice interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

Admin login; ใบลดหนี้ 1 x 100.00 Vat 7% (สร้างผ่าน API)

**Steps**

1. สร้างใบลดหนี้ผ่าน API แล้ว Submit
2. อ่าน JV
3. เปิดหน้ารายละเอียดใน UI

**Expected**

เลขตรง /^ARCN\d{8}$/ สถานะ posted; Cr 1130 = 107.00, Dr 4100 = 100.00, มีขา Dr VAT = 7.00; JV สมดุล; UI แสดง Posted total 107.00. assumption: ใบลดหนี้กลับด้านของใบขาย

---

## TC-ARINV-050004 — ขา VAT ของใบลดหนี้ลงบัญชี 2160 Output VAT ฝั่ง Dr

> **As a** Budget user, **I want** this Ar Invoice interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

Admin login; gl_setting.output_vat_account_id = 2160; ใบลดหนี้ 1 x 100.00 Vat 7% (ไม่ส่ง vat_chart_of_accounts_id)

**Steps**

1. สร้างใบลดหนี้ผ่าน API แล้ว Submit
2. อ่าน JV

**Expected**

Dr 2160 = 7.00 (กลับด้านของใบขาย). assumption: เหมือน 040003 บัญชี VAT ขายของ AR ต้องมาก่อนบัญชีของ tax profile

> _Note: ปักเป็นบั๊กเดียวกับ 040003 (backend ใช้บัญชี tax profile 1170); ดู bug list_

---

## TC-ARINV-060001 — reference-candidates ของใบขายแสดงใบลดหนี้ที่ลงบัญชีแล้วพร้อมยอดคงเหลือ

> **As a** Budget user, **I want** this Ar Invoice interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

Admin login; ใบลดหนี้ของเคสนี้ 1 x 100.00 Vat 7% (107.00) ลงบัญชีแล้ว ลูกค้า E2E-CUST-1; ใบขาย Draft ลูกค้าเดียวกัน

**Steps**

1. สร้างและ Submit ใบลดหนี้
2. สร้างใบขาย Draft
3. GET /ar-invoice/:id/reference-candidates ของใบขาย

**Expected**

รายการมีใบลดหนี้ใบนั้นและ available = 107.00 (ยังไม่เคยถูกนำไปหักใบใด)

---

## TC-ARINV-060002 — ใบขายที่หักใบลดหนี้ 50.00: ค้าง = ยอดรวม - 50.00 และ referenceApplied ของใบลดหนี้ = 50.00

> **As a** Budget user, **I want** this Ar Invoice interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

Admin login; ใบลดหนี้ 107.00 ลงบัญชีแล้ว; ใบขาย 1 x 1,000.00 Vat 7% (1,070.00) อ้างใบลดหนี้นั้น applied 50.00

**Steps**

1. สร้างใบลดหนี้และ Submit
2. สร้างใบขายที่ references = [{ใบลดหนี้, 50.00}]
3. Submit ใบขาย
4. อ่านใบขายและใบลดหนี้

**Expected**

ใบขาย posted ค้าง 1,020.00 (1,070.00 - 50.00); ใบลดหนี้ reference_applied_amount = 50.00 และยัง posted

---

## TC-ARINV-060003 — หักใบลดหนี้เกินยอดคงเหลือ: ถูกปฏิเสธ AR_REFERENCE_OVER_APPLIED และไม่มีผลกับใบลดหนี้

> **As a** Budget user, **I want** this Ar Invoice behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Negative

**Preconditions**

Admin login; ใบลดหนี้ 107.00 ลงบัญชีแล้ว (ยังไม่เคยหักใบใด)

**Steps**

1. สร้างใบขาย 1 x 1,000.00 Vat 7% ที่ references = [{ใบลดหนี้, 107.01}] แล้ว Submit (ถ้ายังสร้างได้)

**Expected**

การสร้างหรือ Submit ตอบ 4xx รหัส AR_REFERENCE_OVER_APPLIED; ใบลดหนี้ reference_applied_amount ยัง 0.00

---

## TC-ARINV-060004 — Void ใบลดหนี้ที่ถูกอ้างโดยใบขายที่ลงบัญชีแล้ว: ถูกปฏิเสธ 409 AR_INVOICE_IS_REFERENCED

> **As a** Budget user, **I want** this Ar Invoice behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

Admin login (มีสิทธิ์ void); ใบลดหนี้ 107.00 ที่ใบขายที่ลงบัญชีแล้วหักไป 50.00

**Steps**

1. สร้างและ Submit ใบลดหนี้ และใบขายที่อ้างมัน 50.00
2. POST /ar-invoice/:cn/void พร้อมเหตุผล

**Expected**

ตอบ 409 รหัส AR_INVOICE_IS_REFERENCED; ใบลดหนี้ยัง posted และ reference_applied_amount ยัง 50.00

---

## TC-ARINV-070001 — Void ใบที่ลงบัญชีผ่าน UI: ปุ่มยืนยันปิดจนกว่าจะใส่เหตุผล แล้วสถานะ void ค้าง 0.00

> **As a** Budget user, **I want** this Ar Invoice interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

Admin login (มีสิทธิ์ void); ใบ 3 x 333.33 Vat 7% ที่ Submit ลงบัญชีแล้ว

**Steps**

1. เปิดหน้ารายละเอียดใบ posted
2. กด Void
3. สังเกตปุ่ม Void ใน dialog ก่อนใส่เหตุผล
4. ใส่เหตุผลแล้วยืนยัน

**Expected**

ปุ่ม Void ใน dialog disabled จนกว่าจะใส่เหตุผล; หลังยืนยันสถานะ Void และ API ได้ status void, outstanding 0.00, มี void_gl_jv_id

---

## TC-ARINV-070002 — JV กลับรายการของใบที่ void หักล้างของเดิมทุกบรรทัด

> **As a** Budget user, **I want** this Ar Invoice interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

Admin login (มีสิทธิ์ void); ใบ 3 x 333.33 Vat 7% (999.99 + 70.00 = 1,069.99) ที่ Submit ลงบัญชีแล้ว

**Steps**

1. Void ใบผ่าน API พร้อมเหตุผล
2. อ่าน JV ทั้งหมดของใบ

**Expected**

มี 2 JV (ต้นฉบับและกลับรายการที่ชี้ reversal_of_jv_id ไปต้นฉบับ); JV สมดุล; กลับรายการ Cr 1130 = 1,069.99 และ Dr 4100 = 999.99; ยอดสุทธิของทุกบัญชีรวมสองใบ = 0 (ตรวจ VAT รวมในนั้นโดยไม่ระบุบัญชี). assumption: void ของใบ posted กลับรายการ JV เดิมทุกขา

---

## TC-ARINV-070003 — ขา VAT ของ JV กลับรายการหักล้างที่ 2160 Output VAT

> **As a** Budget user, **I want** this Ar Invoice interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

Admin login; gl_setting.output_vat_account_id = 2160; ใบ 3 x 333.33 Vat 7% (VAT 70.00) ที่ลงบัญชีแล้ว (ไม่ส่ง vat_chart_of_accounts_id)

**Steps**

1. Void ใบผ่าน API
2. อ่าน JV กลับรายการ

**Expected**

JV กลับรายการมี Dr 2160 = 70.00. assumption: เหมือน 040003 บัญชี VAT ขายของ AR ต้องมาก่อนบัญชีของ tax profile

> _Note: ปักเป็นบั๊กเดียวกับ 040003 (backend ใช้บัญชี tax profile 1170); ดู bug list_

---

## TC-ARINV-070004 — Void ใบกำกับภาษี: ใบกำกับภาษีเป็น void

> **As a** Budget user, **I want** this Ar Invoice interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

Admin login; ใบกำกับภาษี (API create is_tax_invoice) 1 x 100.00 Vat 7% ที่ลงบัญชีแล้ว ได้เลข TXIV สถานะ pending

**Steps**

1. Void ใบผ่าน API
2. อ่านใบกลับ

**Expected**

ใบ status void; เลขใบกำกับภาษียังเป็นเลขเดิม และสถานะใบกำกับภาษี = void

---

## TC-ARINV-070005 — Void โดยไม่ใส่เหตุผล (API): ถูกปฏิเสธ 400 และใบยัง posted

> **As a** Budget user, **I want** this Ar Invoice behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Negative

**Preconditions**

Admin login; ใบ 1 x 100.00 ที่ลงบัญชีแล้ว

**Steps**

1. POST /ar-invoice/:id/void โดยไม่ส่ง reason

**Expected**

ตอบ 400 รหัส AR_INVOICE_LINE_INVALID; ใบยัง posted ไม่มี JV กลับรายการ (1 JV). assumption: การ void ต้องมีเหตุผล (ตามรหัสข้อผิดพลาดของ BE)

---

## TC-ARINV-070006 — Void ใบ Draft: สถานะ void และไม่มี JV

> **As a** Budget user, **I want** this Ar Invoice behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Alternate Flow

**Preconditions**

Admin login (มีสิทธิ์ void); ใบ Draft 1 x 100.00 ที่ยังไม่ Submit

**Steps**

1. POST /ar-invoice/:id/void พร้อมเหตุผล
2. อ่านใบกลับ

**Expected**

ตอบ 200; ใบ status void ค้าง 0.00; ไม่มี JV ของใบนี้ (ไม่เคยลงบัญชี)

---

## TC-ARINV-080001 — Submit ตอนมี workflow: สถานะ in_review ได้เลขจริง ARIV และยังไม่มี JV

> **As a** Budget user, **I want** a clear empty-state when no Ar Invoice records match my search, **so that** I know nothing was found.

**Priority:** High · **Test Type:** Functional

**Preconditions**

workflow ar_invoice (AR Invoice) active; Admin เป็นผู้สร้าง; ใบร่าง 2 x 100 Vat 7%

**Steps**

1. สร้างใบร่างผ่าน API
2. Admin Submit ผ่าน API
3. อ่านใบและ JV ของใบ

**Expected**

status in_review; เลขเอกสารเป็น ARIV + 8 หลัก; ไม่มี JV (jvOfSource ว่าง). assumption: Submit เข้า workflow ยังไม่ลงบัญชี

---

## TC-ARINV-080002 — ผู้สร้างที่เป็นผู้อนุมัติของขั้นด้วย อนุมัติใบของตัวเองไม่ได้: 403 WORKFLOW_CREATOR_CANNOT_APPROVE

> **As a** Budget user, **I want** this Ar Invoice behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

workflow active; ใบ in_review ที่ Budget สร้างและ Submit (Budget อยู่ทั้งขั้น Create Request และ Accounting Approval); config ar.invoice.allow-creator-approve ของ TEST BU ต้องปิด

**Steps**

1. Budget สร้างใบร่างผ่าน API แล้ว Submit
2. Budget Approve ใบของตัวเองผ่าน API

**Expected**

403 รหัส WORKFLOW_CREATOR_CANNOT_APPROVE; ใบยัง in_review ไม่มี JV. rule: กฎผู้สร้างทำงานหลังผ่านการตรวจผู้อนุมัติของขั้น (accounting-doc-workflow.ts:117-130) จึงต้องใช้ผู้สร้างที่อยู่ในขั้น Approve ด้วย

---

## TC-ARINV-080003 — ผู้ไม่ใช่ผู้อนุมัติของขั้น Approve ไม่ได้: 422 WORKFLOW_USER_NOT_STAGE_APPROVER

> **As a** low-privilege user, **I should NOT** see Add/edit controls on Ar Invoice, **so that** role separation is enforced.

**Priority:** High · **Test Type:** Authorization

**Preconditions**

workflow active; ใบ in_review (ขั้น Accounting Approval มี Budget เป็นผู้อนุมัติ); Requestor ไม่อยู่ในขั้นนั้น

**Steps**

1. Requestor Approve ผ่าน API

**Expected**

422 รหัส WORKFLOW_USER_NOT_STAGE_APPROVER; ใบยัง in_review

---

## TC-ARINV-080004 — Budget อนุมัติผ่านหน้ารายละเอียด: สถานะ posted และมี JV สมดุล

> **As a** Budget user, **I want** this Ar Invoice behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Happy Path

**Preconditions**

Budget login; workflow active; ใบ 2 x 100 Vat 7% (net 200.00 + VAT 14.00 = 214.00) in_review ที่ Admin Submit

**Steps**

1. เปิดหน้ารายละเอียดของใบ
2. กด Approve
3. ยืนยันใน dialog

**Expected**

สถานะ Posted; API ได้ posted ยอดค้าง 214.00; JV สมดุล และมี Dr 1130 = 214.00, Cr 4100 = 200.00

---

## TC-ARINV-080005 — Reject โดยเหตุผลว่าง (blank): 422 AR_INVOICE_REJECT_REASON_REQUIRED และใบยัง in_review

> **As a** Budget user, **I want** the system to block invalid Ar Invoice submissions, **so that** data quality is preserved.

**Priority:** Medium · **Test Type:** Validation

**Preconditions**

workflow active; ใบ in_review; Budget เป็นผู้อนุมัติ

**Steps**

1. Budget Reject ผ่าน API โดย reason เป็นช่องว่างล้วน (ไม่ส่งหรือส่งสตริงว่าง backend ตอบ 400 จาก schema ก่อนถึงกฎนี้)

**Expected**

reason ว่าง (blank): 422 รหัส AR_INVOICE_REJECT_REASON_REQUIRED; ไม่ส่ง reason เลย: 400 จาก schema; ใบยัง in_review ไม่มี JV

---

## TC-ARINV-080006 — Budget Reject พร้อมเหตุผลผ่านหน้ารายละเอียด: void ยอดค้าง 0.00 ไม่มี JV และไม่มี tax invoice

> **As a** Budget user, **I want** this Ar Invoice behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Alternate Flow

**Preconditions**

Budget login; workflow active; ใบ in_review ที่ติ๊ก tax invoice (สร้างผ่าน API)

**Steps**

1. เปิดหน้ารายละเอียด
2. กด Reject
3. ใส่เหตุผลแล้วยืนยัน

**Expected**

สถานะ Void; API ได้ void, outstanding 0.00, ไม่มี JV, ไม่มีเลข tax invoice. rule: Reject ทำให้ใบ void (เหมือน AP payment ตาม BE #1110)

---

## TC-ARINV-080007 — Budget ส่งกลับไปขั้น Create Request: ใบกลับเป็น draft และเลขจริงเดิม

> **As a** Budget user, **I want** this Ar Invoice behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Alternate Flow

**Preconditions**

Budget login; workflow active; ใบ in_review ที่มีเลขจริง ARIV

**Steps**

1. เปิดหน้ารายละเอียด
2. กด Send back
3. เลือกขั้น Create Request ใส่หมายเหตุแล้วยืนยัน

**Expected**

สถานะ Draft; เลขเอกสารเท่าเดิม (ยังเป็น ARIV จริง); ไม่มี JV

---

## TC-ARINV-080008 — ลบใบ draft ที่ถือเลขจริงแล้ว: 422 AR_INVOICE_NUMBERED_VOID_ONLY

> **As a** Budget user, **I want** this Ar Invoice behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Negative

**Preconditions**

workflow active; ใบที่ Submit แล้วถูก Budget ส่งกลับเป็น draft (ถือเลข ARIV จริง)

**Steps**

1. Submit ใบ แล้ว Budget ส่งกลับไปขั้น Create Request ผ่าน API
2. Admin ลบใบ

**Expected**

422 รหัส AR_INVOICE_NUMBERED_VOID_ONLY; ใบยังอยู่เป็น draft

---

## TC-ARINV-080009 — ลบใบที่ in_review: 409 AR_INVOICE_IMMUTABLE

> **As a** Budget user, **I want** this Ar Invoice behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Negative

**Preconditions**

workflow active; ใบ in_review

**Steps**

1. Admin ลบใบ in_review ผ่าน API

**Expected**

409 รหัส AR_INVOICE_IMMUTABLE; ใบยัง in_review

---

## TC-ARINV-080010 — Admin (อยู่แค่ขั้น Create Request) อนุมัติใบของตัวเองไม่ได้: 422 WORKFLOW_USER_NOT_STAGE_APPROVER

> **As a** low-privilege user, **I should NOT** see Add/edit controls on Ar Invoice, **so that** role separation is enforced.

**Priority:** Medium · **Test Type:** Authorization

**Preconditions**

workflow active; ใบ in_review ที่ Admin สร้างและ Submit (Admin ไม่ได้เป็นผู้อนุมัติของขั้น Accounting Approval)

**Steps**

1. Admin Approve ใบของตัวเองผ่าน API

**Expected**

422 รหัส WORKFLOW_USER_NOT_STAGE_APPROVER; ใบยัง in_review ไม่มี JV. note: การตรวจผู้อนุมัติของขั้นมาก่อนกฎผู้สร้าง (accounting-doc-workflow.ts:117-130) จึงไม่ได้ 403 WORKFLOW_CREATOR_CANNOT_APPROVE

---

## TC-ARINV-100001 — Requestor เห็นรายการและรายละเอียดของใบที่ลงบัญชีแล้ว

> **As a** low-privilege user, **I should NOT** see Add/edit controls on Ar Invoice, **so that** role separation is enforced.

**Priority:** High · **Test Type:** Authorization

**Preconditions**

Requestor login (ถือสิทธิ์ accounting.ar.view เท่านั้น); data:reset --yes แล้ว

**Steps**

1. เปิดรายการ AR invoice ค้น E2E-AR-
2. เปิดรายละเอียด E2E-AR-POSTED

**Expected**

รายการแสดงแถวของ E2E-AR-POSTED; หน้ารายละเอียดแสดงสถานะ Posted และยอดรวม 1,069.99

---

## TC-ARINV-100002 — Requestor ไม่เห็นปุ่ม Void บนใบ posted และใบ Draft และไม่เห็น Submit บนใบ posted

> **As a** low-privilege user, **I should NOT** see Add/edit controls on Ar Invoice, **so that** role separation is enforced.

**Priority:** High · **Test Type:** Authorization

**Preconditions**

Requestor login (accounting.ar.view เท่านั้น ไม่มี accounting.ar.void); E2E-AR-POSTED ลงบัญชีแล้ว E2E-AR-DRAFT เป็น Draft

**Steps**

1. เปิดรายละเอียด E2E-AR-POSTED
2. เปิดรายละเอียด E2E-AR-DRAFT

**Expected**

ทั้งสองหน้าไม่มีปุ่ม Void; หน้า E2E-AR-POSTED ไม่มีปุ่ม Submit (Void ถูกกรองด้วยสิทธิ์ accounting.ar.void ใน FE)

---

## TC-ARINV-100003 — Requestor ไม่เห็นปุ่ม New Invoice ที่กดได้บนรายการ

> **As a** low-privilege user, **I should NOT** see Add/edit controls on Ar Invoice, **so that** role separation is enforced.

**Priority:** Medium · **Test Type:** Authorization

**Preconditions**

Requestor login (ถือสิทธิ์ accounting.ar.view เท่านั้น ไม่มีสิทธิ์ void)

**Steps**

1. เปิดรายการ AR invoice

**Expected**

ไม่มีปุ่ม New Invoice ที่กดได้ (ไม่แสดง หรืออย่างน้อย disabled)

> _Note: ปักเป็นบั๊ก: ปุ่มเปิดใช้งานสำหรับผู้ถือสิทธิ์ view อย่างเดียว เพราะ canWrite ของ FE ไม่ผูกกับสิทธิ์ accounting.ar; ดู bug list_

---

## TC-ARINV-100004 — Requestor void ใบผ่าน API: ถูกปฏิเสธ 4xx และใบยังคง posted

> **As the** system, **I want** Ar Invoice inputs hardened against common attacks, **so that** the application stays safe.

**Priority:** High · **Test Type:** Security

**Preconditions**

ใบ 1 x 100.00 ที่ Admin Submit ลงบัญชีแล้ว; Requestor ไม่มีสิทธิ์ accounting.ar.void

**Steps**

1. Requestor เรียก POST /ar-invoice/:id/void พร้อมเหตุผลผ่าน API

**Expected**

ตอบ 403 ไม่ใช่ 2xx; ใบยัง posted ค้าง 107.00; ไม่มี JV กลับรายการ (1 JV)

---

## TC-ARINV-100005 — Requestor (สิทธิ์ view อย่างเดียว) ไม่เห็นปุ่ม Submit บนใบ Draft เมื่อไม่มี workflow

> **As a** low-privilege user, **I should NOT** see Add/edit controls on Ar Invoice, **so that** role separation is enforced.

**Priority:** High · **Test Type:** Authorization

**Preconditions**

Requestor login (accounting.ar.view เท่านั้น); E2E-AR-DRAFT เป็น Draft

**Steps**

1. เปิดรายละเอียด E2E-AR-DRAFT

**Expected**

ไม่มีปุ่ม Submit (เมื่อไม่มี workflow การ Submit ลงบัญชีโดยตรง). assumption: ผู้ถือสิทธิ์ view อย่างเดียวไม่ควรลงบัญชีโดยตรง

> _Note: ปักเป็นคำถามเชิงผลิตภัณฑ์: data:reset ให้ Requestor ถือ accounting.ar.view โดยตั้งใจ และ BE/FE ใช้คีย์นี้กับ Submit (การส่งเข้า workflow ของผู้ขอเป็นเรื่องปกติ) แต่เมื่อไม่มี workflow Submit ลงบัญชีทันที; ดู bug list_

---

## TC-ARINV-100006 — Requestor (สิทธิ์ view อย่างเดียว) submit ใบ Draft ผ่าน API เมื่อไม่มี workflow: ถูกปฏิเสธ 403 และใบยังคง draft

> **As the** system, **I want** Ar Invoice inputs hardened against common attacks, **so that** the application stays safe.

**Priority:** High · **Test Type:** Security

**Preconditions**

ใบ Draft 1 x 100.00 ที่ Admin สร้างผ่าน API; Requestor ถือ accounting.ar.view เท่านั้น; ไม่มี ar_invoice workflow ที่ active

**Steps**

1. Requestor เรียก POST /ar-invoice/:id/submit ผ่าน API

**Expected**

ตอบ 403; ใบยัง draft เลข DRAFT- ไม่มี JV. assumption: ผู้ถือสิทธิ์ view อย่างเดียวไม่ควรลงบัญชีโดยตรง

> _Note: ปักเป็นคำถามเชิงผลิตภัณฑ์เดียวกับ 100005; ดู bug list_

---


<sub>Last regenerated: 2026-11-25 · git 3ad5b1e</sub>
