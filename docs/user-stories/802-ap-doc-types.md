# Ap Doc Types — User Stories

_Generated from `tests/802-ap-doc-types.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Ap Doc Types
**Spec:** `tests/802-ap-doc-types.spec.ts`
**Default role:** Admin
**Total test cases:** 10 (6 High / 4 Medium / 0 Low)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-APDOC-010001 | สร้างเงินมัดจำผ่าน UI 3 x 333.33 (ไม่มี VAT): ยอด 999.99 บันทึกเป็น Draft | High | CRUD |
| TC-APDOC-010002 | Submit เงินมัดจำ: ลงบัญชี Dr 1180 เงินมัดจำ = 999.99, Cr 2100 เจ้าหนี้ = 999.99 | High | Functional |
| TC-APDOC-010003 | เงินมัดจำที่มีบรรทัดคิด VAT: BE ปฏิเสธ 422 และไม่มีใบถูกสร้าง | Medium | Negative |
| TC-APDOC-010004 | รายละเอียดเงินมัดจำ E2E-AP-DEPOSIT: 2,000.00 ตรงกับ oracle, API และ JV | Medium | Functional |
| TC-APDOC-020001 | สร้าง Debit Note ผ่าน UI 3 x 333.33 + VAT 7%: net 999.99 VAT 70.00 รวม 1,069.99 เป็น Draft | High | CRUD |
| TC-APDOC-020002 | Submit Debit Note: เจ้าหนี้เพิ่ม Dr 5300 = 999.99, Dr 1170 = 70.00, Cr 2100 = 1,069.99 | High | Functional |
| TC-APDOC-020003 | รายละเอียด Debit Note E2E-AP-DN: 150.00 ตรงกับ oracle, API และ JV | Medium | Functional |
| TC-APDOC-030001 | สร้าง Credit Note ผ่าน UI 3 x 333.33 + VAT 7%: net 999.99 VAT 70.00 รวม 1,069.99 เป็น Draft | High | CRUD |
| TC-APDOC-030002 | Submit Credit Note: เจ้าหนี้ลด Dr 2100 = 1,069.99, Cr 5300 = 999.99, Cr 1170 = 70.00 | High | Functional |
| TC-APDOC-030003 | รายละเอียด Credit Note E2E-AP-CN: 120.00 ตรงกับ oracle, API และ JV | Medium | Functional |

---

## TC-APDOC-010001 — สร้างเงินมัดจำผ่าน UI 3 x 333.33 (ไม่มี VAT): ยอด 999.99 บันทึกเป็น Draft

> **As a** Admin user, **I want** to create a new Ap Doc Types record, **so that** it becomes available for downstream operations.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

Admin login บน TEST BU; vendor แรกของ BU; บัญชี 1180 Advance Deposit มีใน COA

**Steps**

1. เปิด /accounts-payable/deposit/new
2. เลือก vendor กรอก Vendor Invoice
3. บรรทัด 1 = 3 x 333.33 บัญชี 1180 ไม่ใส่ VAT
4. อ่านแถบสรุป
5. กด Save Draft

**Expected**

แถบสรุป net 999.99 VAT 0.00 total 999.99; toast Invoice saved; API ได้ doc_type deposit สถานะ draft ยอดเดียวกัน; Submit ผ่าน API แล้ว JV ลง Dr 1180 (บัญชีที่เลือกในฟอร์ม) / Cr 2100. assumption: เงินมัดจำไม่มี VAT (BE ปฏิเสธบรรทัดมัดจำที่มี VAT: 422) และยอด = จำนวน x ราคา ปัดครึ่งขึ้น

---

## TC-APDOC-010002 — Submit เงินมัดจำ: ลงบัญชี Dr 1180 เงินมัดจำ = 999.99, Cr 2100 เจ้าหนี้ = 999.99

> **As a** Admin user, **I want** this Ap Doc Types interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

Admin login; เงินมัดจำ Draft 3 x 333.33 ที่สร้างผ่าน API; GL period เปิดครอบวันนี้

**Steps**

1. เปิดหน้ารายละเอียดเงินมัดจำ Draft
2. กด Submit
3. ดึง JV ที่มี source = ใบนี้

**Expected**

สถานะ Posted ค้าง 999.99; JV สมดุล มี 2 บัญชีเท่านั้น: Dr = บัญชีเงินมัดจำใน gl_setting (1180) 999.99, Cr = บัญชีเจ้าหนี้ใน gl_setting (2100) 999.99. assumption: เงินมัดจำลง Dr บัญชีเงินมัดจำล่วงหน้า / Cr เจ้าหนี้ ตาม BE (inv:266 ยังเป็นคำถามเปิด ว่าเป็นหนี้สิน สินทรัพย์ หรือทั้งคู่)

---

## TC-APDOC-010003 — เงินมัดจำที่มีบรรทัดคิด VAT: BE ปฏิเสธ 422 และไม่มีใบถูกสร้าง

> **As a** Admin user, **I want** this Ap Doc Types behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Negative

**Preconditions**

Admin login; vendor แรกของ BU; มี tax profile Vat 7%

**Steps**

1. POST /ap-invoice doc_type deposit บรรทัด 3 x 333.33 พร้อม Vat 7%
2. ค้นหาใบด้วย Vendor Invoice ที่ใช้

**Expected**

ตอบ 422 ข้อความระบุว่าบรรทัดมัดจำมี VAT ไม่ได้; ค้นไม่เจอใบที่ใช้เลขนั้น. assumption: เงินมัดจำไม่มี VAT (พฤติกรรมของ BE ที่ตรวจพบ ไม่ได้ระบุใน inv)

---

## TC-APDOC-010004 — รายละเอียดเงินมัดจำ E2E-AP-DEPOSIT: 2,000.00 ตรงกับ oracle, API และ JV

> **As a** Admin user, **I want** this Ap Doc Types interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

Admin login; data:reset --yes แล้ว (E2E-AP-DEPOSIT เงินมัดจำ 2,000.00 ลงบัญชีแล้ว)

**Steps**

1. หา id ของ E2E-AP-DEPOSIT
2. เปิดหน้ารายละเอียดชนิด deposit
3. อ่านแถบสรุป
4. ดึง JV ของใบ

**Expected**

สถานะ Posted; net 2,000.00 VAT 0.00 total 2,000.00 ค้าง 2,000.00 ตรงกับค่าของ read set และ API; JV Dr 1180 = 2,000.00, Cr 2100 = 2,000.00. assumption: เงินมัดจำลง Dr เงินมัดจำ / Cr เจ้าหนี้ (inv:266)

---

## TC-APDOC-020001 — สร้าง Debit Note ผ่าน UI 3 x 333.33 + VAT 7%: net 999.99 VAT 70.00 รวม 1,069.99 เป็น Draft

> **As a** Admin user, **I want** to create a new Ap Doc Types record, **so that** it becomes available for downstream operations.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

Admin login; vendor แรกของ BU; บัญชี 5300 และ Vat 7% มีใน TEST BU

**Steps**

1. เปิด /accounts-payable/debit-note/new
2. เลือก vendor กรอก Vendor Invoice
3. บรรทัด 1 = 3 x 333.33 (5300, Vat 7%)
4. อ่านแถบสรุป
5. กด Save Draft

**Expected**

แถบสรุป net 999.99 VAT 70.00 total 1,069.99 (999.99 x 7% = 69.9993 ปัดเป็น 70.00); บันทึกแล้ว API ได้ doc_type debit_note สถานะ draft ยอดเดียวกัน. assumption: ไม่ต้องอ้างใบแจ้งหนี้เดิม (inv:267 ยังเป็นคำถามเปิด; BE สร้างได้โดยมีแค่ vendor วันที่ และบรรทัด); VAT 7% บนฐานก่อน VAT ปัดครึ่งขึ้น

---

## TC-APDOC-020002 — Submit Debit Note: เจ้าหนี้เพิ่ม Dr 5300 = 999.99, Dr 1170 = 70.00, Cr 2100 = 1,069.99

> **As a** Admin user, **I want** this Ap Doc Types interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

Admin login; Debit Note Draft 3 x 333.33 ที่สร้างผ่าน API; GL period เปิดครอบวันนี้

**Steps**

1. เปิดหน้ารายละเอียด Debit Note Draft
2. กด Submit
3. ดึง JV ที่มี source = ใบนี้

**Expected**

สถานะ Posted ค้าง 1,069.99; JV สมดุล; Dr 5300 = 999.99, Dr 1170 = 70.00, Cr 2100 = 1,069.99 (ยอดเจ้าหนี้เพิ่มขึ้น) ไม่มีบัญชีอื่น. assumption: Debit Note เพิ่มยอดเจ้าหนี้ จึงลงเหมือนใบแจ้งหนี้ (Dr ค่าใช้จ่ายและภาษีซื้อ / Cr เจ้าหนี้) ทิศทางไม่ได้ระบุใน inv:106

---

## TC-APDOC-020003 — รายละเอียด Debit Note E2E-AP-DN: 150.00 ตรงกับ oracle, API และ JV

> **As a** Admin user, **I want** this Ap Doc Types interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

Admin login; data:reset --yes แล้ว (E2E-AP-DN ยอด 150.00 ไม่มี VAT ลงบัญชีแล้ว)

**Steps**

1. หา id ของ E2E-AP-DN
2. เปิดหน้ารายละเอียดชนิด debit-note
3. อ่านแถบสรุป
4. ดึง JV ของใบ

**Expected**

สถานะ Posted; net 150.00 VAT 0.00 total 150.00 ค้าง 150.00 ตรงกับ read set และ API; JV Dr 5300 = 150.00, Cr 2100 = 150.00. assumption: Debit Note เพิ่มยอดเจ้าหนี้ (Dr ค่าใช้จ่าย / Cr เจ้าหนี้)

---

## TC-APDOC-030001 — สร้าง Credit Note ผ่าน UI 3 x 333.33 + VAT 7%: net 999.99 VAT 70.00 รวม 1,069.99 เป็น Draft

> **As a** Admin user, **I want** to create a new Ap Doc Types record, **so that** it becomes available for downstream operations.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

Admin login; vendor แรกของ BU; บัญชี 5300 และ Vat 7% มีใน TEST BU

**Steps**

1. เปิด /accounts-payable/credit-note/new
2. เลือก vendor กรอก Vendor Invoice
3. บรรทัด 1 = 3 x 333.33 (5300, Vat 7%)
4. อ่านแถบสรุป
5. กด Save Draft

**Expected**

แถบสรุป net 999.99 VAT 70.00 total 1,069.99; บันทึกแล้ว API ได้ doc_type credit_note สถานะ draft ยอดเป็นค่าบวกเท่ากัน. assumption: ยอด Credit Note เก็บเป็นค่าบวก ไม่ติดลบ (inv:106 ไม่ระบุเครื่องหมาย); ไม่ต้องอ้างใบแจ้งหนี้เดิม (inv:267)

---

## TC-APDOC-030002 — Submit Credit Note: เจ้าหนี้ลด Dr 2100 = 1,069.99, Cr 5300 = 999.99, Cr 1170 = 70.00

> **As a** Admin user, **I want** this Ap Doc Types interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

Admin login; Credit Note Draft 3 x 333.33 ที่สร้างผ่าน API; GL period เปิดครอบวันนี้

**Steps**

1. เปิดหน้ารายละเอียด Credit Note Draft
2. กด Submit
3. ดึง JV ที่มี source = ใบนี้

**Expected**

สถานะ Posted; JV สมดุล; Dr 2100 = 1,069.99, Cr 5300 = 999.99, Cr 1170 = 70.00 (ยอดเจ้าหนี้ลดลง) ไม่มีบัญชีอื่น. assumption: Credit Note ลดยอดเจ้าหนี้ จึงลงตรงข้ามกับใบแจ้งหนี้ (Dr เจ้าหนี้ / Cr ค่าใช้จ่ายและภาษีซื้อ) ทิศทางไม่ได้ระบุใน inv:106

---

## TC-APDOC-030003 — รายละเอียด Credit Note E2E-AP-CN: 120.00 ตรงกับ oracle, API และ JV

> **As a** Admin user, **I want** this Ap Doc Types interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

Admin login; data:reset --yes แล้ว (E2E-AP-CN ยอด 120.00 ไม่มี VAT ลงบัญชีแล้ว)

**Steps**

1. หา id ของ E2E-AP-CN
2. เปิดหน้ารายละเอียดชนิด credit-note
3. อ่านแถบสรุป
4. ดึง JV ของใบ

**Expected**

สถานะ Posted; net 120.00 VAT 0.00 total 120.00 ค้าง 120.00 ตรงกับ read set และ API; JV Dr 2100 = 120.00, Cr 5300 = 120.00. assumption: Credit Note ลดยอดเจ้าหนี้ (Dr เจ้าหนี้ / Cr ค่าใช้จ่าย) และยอดเก็บเป็นค่าบวก

---


<sub>Last regenerated: 2026-11-24 · git f462816</sub>
