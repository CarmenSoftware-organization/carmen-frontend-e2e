# Ap Payment — User Stories

_Generated from `tests/803-ap-payment.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Ap Payment
**Spec:** `tests/803-ap-payment.spec.ts`
**Default role:** Admin
**Total test cases:** 10 (6 High / 2 Medium / 0 Low / 2 unset)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-APPAY-010001 | จ่ายเต็มใบ 1,000.00 + VAT พร้อม WHT 3%: JV Dr เจ้าหนี้ 1,070.00 / Cr ธนาคาร 1,040.00 / Cr WHT 30.00 ใบเหลือ 0 | Critical | Functional |
| TC-APPAY-010002 | ขอบปัดเศษ 3 x 333.33 (ฐาน 999.99): WHT 3% = 30.00 (29.9997 ปัดขึ้น) เงินสด 1,039.99 JV ตรงยอด | High | Boundary |
| TC-APPAY-010003 | WHT ไม่ตรงสูตร (99.00 แทน 30.00): BE ปฏิเสธ 422 Payment is not balanced ไม่เกิดใบจ่าย | High | Negative |
| TC-APPAY-020001 | จ่ายบางส่วน 400 แล้ว 600 ใบ 1,000.00: เหลือ 600 แล้ว 0; void ใบจ่ายที่สองผ่าน UI แล้วกลับมา 600 และ JV กลับรายการหักล้างพอดี | Critical | Functional |
| TC-APPAY-020002 | จ่ายบางส่วนพร้อม WHT (ใบ 1,070.00 จ่าย 535.00 ฐาน 500.00 WHT 15.00 เงินสด 520.00): ค้างลด 535.00 = เงินสด + WHT | High | Functional |
| TC-APPAY-020003 | Void ใบจ่ายเต็มที่มี WHT: ยอดค้างกลับเป็น 1,070.00 และ JV กลับรายการ (รวมบัญชี WHT 2150) หักล้างพอดี | High | Functional |
| TC-APPAY-030001 | จ่ายเกินยอดค้าง 0.01 (1,000.01 จากใบ 1,000.00): ถูกปฏิเสธ 422 AP_PAYMENT_OVER_ALLOCATED ไม่เกิดใบจ่าย | High | Negative |
| TC-APPAY-030002 | จ่ายใบที่ชำระครบแล้ว (E2E-AP-PAID ค้าง 0): ถูกปฏิเสธ 422 และ read-set ไม่เปลี่ยน | Medium | Negative |
| TC-APPAY-040001 | read-set E2E-AP-PARTIAL (รวม 1,070.00 จ่ายแล้ว 400.00 ไม่มี WHT): หน้ารายละเอียดแสดงค้าง 670.00 | Medium | Functional |
| TC-APPAY-050001 | หน้าใบจ่าย Recalculate WHT จากใบ 1,000.00 + VAT: FE แสดงฐาน 1,000.00 WHT 30.00 ตรงสูตร และบันทึกลง BE ตรงกัน | High | Functional |

---

## TC-APPAY-010001 — จ่ายเต็มใบ 1,000.00 + VAT พร้อม WHT 3%: JV Dr เจ้าหนี้ 1,070.00 / Cr ธนาคาร 1,040.00 / Cr WHT 30.00 ใบเหลือ 0

> **As a** Admin user, **I want** this Ap Payment interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Critical · **Test Type:** Functional

**Preconditions**

Admin login บน TEST BU; ใบ 1 x 1,000.00 + VAT 7% (รวม 1,070.00) ลงบัญชีแล้ว; E2E-BANK (1110), E2E-PT, โปรไฟล์ WHT 3% (2150); workflow ap_payment (Admin สร้าง Budget อนุมัติ)

**Steps**

1. สร้างใบจ่าย: จ่ายเต็ม 1,070.00 ฐาน WHT 1,000.00 ยอด WHT 30.00 เงินสด 1,040.00 (ส่งตัวเลขตามสูตร ไม่ใช้ค่าที่ FE กรอกให้)
2. Submit (Admin) แล้ว Approve (Budget)
3. อ่านใบจ่ายและ JV ที่มี source = ใบจ่าย
4. อ่านยอดค้างของใบ

**Expected**

ใบจ่าย posted: total_applied 1,070.00, total_wht 30.00 (= whtOf(1000, 3%)), net_paid 1,040.00; JV สมดุลมี 3 บัญชีเท่านั้น: Dr 2100 = 1,070.00, Cr 1110 = 1,040.00, Cr 2150 = 30.00; ยอดค้างของใบ = 0.00. assumption: WHT คิดตอนจ่ายจากฐานก่อน VAT (1,000.00 ไม่ใช่ 1,070.00) ตาม pay:110; inference: ยอดค้างลดลง = เงินสด + WHT (rules:17 + pay:127-130, ยืนยันบน dev)

---

## TC-APPAY-010002 — ขอบปัดเศษ 3 x 333.33 (ฐาน 999.99): WHT 3% = 30.00 (29.9997 ปัดขึ้น) เงินสด 1,039.99 JV ตรงยอด

> **As a** Admin user, **I want** this Ap Payment behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Boundary

**Preconditions**

Admin login; ใบ 3 x 333.33 + VAT 7% (net 999.99, VAT 70.00, รวม 1,069.99) ลงบัญชีแล้ว

**Steps**

1. สร้างใบจ่ายเต็ม 1,069.99 ฐาน WHT 999.99 ยอด WHT 30.00 เงินสด 1,039.99
2. Submit และ Approve
3. อ่านใบจ่ายและ JV

**Expected**

total_wht 30.00, net_paid 1,039.99; JV: Dr 2100 = 1,069.99, Cr 1110 = 1,039.99, Cr 2150 = 30.00 สมดุล; ยอดค้าง 0.00. assumption: ปัด WHT ครึ่งขึ้นที่ทศนิยม 2 ตำแหน่ง (accounting-foundation.md:103); 999.99 x 3% = 29.9997 -> 30.00

---

## TC-APPAY-010003 — WHT ไม่ตรงสูตร (99.00 แทน 30.00): BE ปฏิเสธ 422 Payment is not balanced ไม่เกิดใบจ่าย

> **As a** Admin user, **I want** this Ap Payment behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

Admin login; ใบ 1 x 1,000.00 + VAT (รวม 1,070.00) ลงบัญชีแล้ว

**Steps**

1. POST ใบจ่าย: applied 1,070.00, ฐาน 1,000.00, WHT 99.00, เงินสด 1,040.00 (ผลรวมไม่ลงตัว: 1,040.00 + 99.00 != 1,070.00)
2. อ่านรายการใบจ่ายของ vendor และยอดค้างของใบ

**Expected**

422 ข้อความ 'Payment is not balanced: invoices = payment + WHT - other expenses'; ไม่มีใบจ่ายใหม่; ยอดค้างของใบยัง 1,070.00. rule: invoices = payment + WHT - other expenses (rules:17), backend ตรวจซ้ำ (rules:22)

---

## TC-APPAY-020001 — จ่ายบางส่วน 400 แล้ว 600 ใบ 1,000.00: เหลือ 600 แล้ว 0; void ใบจ่ายที่สองผ่าน UI แล้วกลับมา 600 และ JV กลับรายการหักล้างพอดี

> **As a** Admin user, **I want** this Ap Payment interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Critical · **Test Type:** Functional

**Preconditions**

Admin login; ใบ 1 x 1,000.00 ไม่มี VAT ลงบัญชีแล้ว (ค้าง 1,000.00); ใบจ่ายสร้างเองต่อเคส

**Steps**

1. จ่าย 400.00 (Submit + Approve) อ่านยอดค้าง
2. จ่าย 600.00 (Submit + Approve) อ่านยอดค้าง
3. เปิดหน้ารายละเอียดใบจ่ายที่สอง กด Void ใส่เหตุผลยืนยัน
4. อ่านยอดค้างและ JV ของใบจ่ายที่สอง

**Expected**

ค้าง 600.00 หลังจ่าย 400.00, ค้าง 0.00 หลังจ่าย 600.00; หลัง void ใบจ่ายที่สอง: ใบจ่ายเป็น void, ค้างกลับเป็น 600.00 (Review Focus 4); JV กลับรายการผูก reversal_of กับ JV เดิม ทุกบัญชีสุทธิ 0 (Dr 2100 600.00 / Cr 1110 600.00 เดิม หักล้างด้วยด้านตรงข้าม); JV ของใบจ่ายแรกไม่เปลี่ยน. rule: partial payment ได้ ใบ stay posted (inv:188, pay:263)

---

## TC-APPAY-020002 — จ่ายบางส่วนพร้อม WHT (ใบ 1,070.00 จ่าย 535.00 ฐาน 500.00 WHT 15.00 เงินสด 520.00): ค้างลด 535.00 = เงินสด + WHT

> **As a** Admin user, **I want** this Ap Payment interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

Admin login; ใบ 1 x 1,000.00 + VAT 7% (รวม 1,070.00) ลงบัญชีแล้ว

**Steps**

1. สร้างใบจ่าย applied 535.00 ฐาน WHT 500.00 (ครึ่งหนึ่งของ net) WHT 15.00 เงินสด 520.00
2. Submit และ Approve
3. อ่านยอดค้างของใบและ JV

**Expected**

ค้าง 535.00 (1,070.00 - 520.00 - 15.00); JV: Dr 2100 = 535.00, Cr 1110 = 520.00, Cr 2150 = 15.00 สมดุล. inference: ยอดค้างลด = เงินสด + WHT (rules:17 + inv:99 + pay:127-130); assumption: ใบจ่ายบางส่วนใช้ฐาน WHT ตามสัดส่วนที่จ่าย (500.00 = 535 / 1,070 x 1,000) เพราะ docs ไม่กำหนดการแบ่งสัดส่วน (preflight 4.3)

---

## TC-APPAY-020003 — Void ใบจ่ายเต็มที่มี WHT: ยอดค้างกลับเป็น 1,070.00 และ JV กลับรายการ (รวมบัญชี WHT 2150) หักล้างพอดี

> **As a** Admin user, **I want** this Ap Payment interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

Admin login; ใบ 1 x 1,000.00 + VAT จ่ายเต็มพร้อม WHT 30.00 ลงบัญชีแล้ว (ค้าง 0)

**Steps**

1. Void ใบจ่ายผ่าน API พร้อมเหตุผล
2. อ่านใบจ่าย ยอดค้างของใบ และ JV ทั้งหมดของใบจ่าย

**Expected**

void สำเร็จ; ใบจ่ายเป็น void; ยอดค้างของใบ = 1,070.00; JV กลับรายการมีครบ 3 บัญชี (Cr 2100 1,070.00, Dr 1110 1,040.00, Dr 2150 30.00) และทุกบัญชีสุทธิ 0 เมื่อรวม JV เดิม. rule: void กลับรายการด้วย JV ที่สลับ Dr/Cr (jv:221-222)

---

## TC-APPAY-030001 — จ่ายเกินยอดค้าง 0.01 (1,000.01 จากใบ 1,000.00): ถูกปฏิเสธ 422 AP_PAYMENT_OVER_ALLOCATED ไม่เกิดใบจ่าย

> **As a** Admin user, **I want** this Ap Payment behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

Admin login; ใบ 1 x 1,000.00 ไม่มี VAT ลงบัญชีแล้ว ค้าง 1,000.00

**Steps**

1. POST ใบจ่าย applied 1,000.01 เงินสด 1,000.01 (สมดุล แต่เกินยอดค้างของบรรทัด)
2. อ่านจำนวนใบจ่ายและยอดค้าง

**Expected**

422 รหัส AP_PAYMENT_OVER_ALLOCATED 'Applied amount exceeds unpaid amount'; ไม่มีใบจ่ายใหม่; ยอดค้างยัง 1,000.00. rule: จ่ายบางส่วนได้ แต่เกินยอดค้างไม่ได้ (pay:263, ap-payment-save-rules.md)

---

## TC-APPAY-030002 — จ่ายใบที่ชำระครบแล้ว (E2E-AP-PAID ค้าง 0): ถูกปฏิเสธ 422 และ read-set ไม่เปลี่ยน

> **As a** Admin user, **I want** this Ap Payment behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Negative

**Preconditions**

Admin login; E2E-AP-PAID ใน read-set ค้าง 0.00

**Steps**

1. POST ใบจ่าย applied 1.00 กับบรรทัดของ E2E-AP-PAID
2. อ่านยอดค้างของ E2E-AP-PAID

**Expected**

422 รหัส AP_PAYMENT_OVER_ALLOCATED (ค้าง 0 จึงจ่ายเพิ่มไม่ได้); E2E-AP-PAID ยังค้าง 0.00 และสถานะเดิม. rule: ห้ามเกินยอดค้างแม้จ่ายหลายครั้ง (pay:263)

---

## TC-APPAY-040001 — read-set E2E-AP-PARTIAL (รวม 1,070.00 จ่ายแล้ว 400.00 ไม่มี WHT): หน้ารายละเอียดแสดงค้าง 670.00

> **As a** Admin user, **I want** a clear empty-state when no Ap Payment records match my search, **so that** I know nothing was found.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

Admin login; E2E-AP-PARTIAL ลงบัญชีแล้ว รวม 1,070.00 มีใบจ่าย 400.00 ที่ไม่มี WHT (ควบคุมโดย controller ruling R5)

**Steps**

1. เปิดหน้ารายละเอียด E2E-AP-PARTIAL
2. อ่านยอด Total และ Unpaid Amount
3. อ่านยอดค้างผ่าน API

**Expected**

Total 1,070.00, Unpaid Amount 670.00 ทั้งบน UI และ API. inference: ยอดค้างลด = เงินสด + WHT; ใบจ่าย 400.00 ไม่มี WHT ค้างจึง 1,070.00 - 400.00 = 670.00 (ถ้าใบจ่ายมี WHT W ค้างต้องเป็น 1,070.00 - 400.00 - W; preflight 4.1)

---

## TC-APPAY-050001 — หน้าใบจ่าย Recalculate WHT จากใบ 1,000.00 + VAT: FE แสดงฐาน 1,000.00 WHT 30.00 ตรงสูตร และบันทึกลง BE ตรงกัน

> **As a** Admin user, **I want** this Ap Payment interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

Admin login; ใบ 1 x 1,000.00 + VAT (รวม 1,070.00) ที่บรรทัดระบุ WHT 3% ลงบัญชีแล้ว; ใบจ่าย Draft จ่ายเต็ม 1,070.00 ไม่มีแถว WHT

**Steps**

1. เปิดหน้ารายละเอียดใบจ่าย Draft กด Edit
2. กด Recalculate from invoices
3. อ่านฐานและยอด WHT ในตาราง
4. ใส่ Payment amount 1,040.00 กด Save Draft
5. อ่านใบจ่ายผ่าน API

**Expected**

ตาราง WHT แสดงฐาน 1,000.00 และยอด 30.00 (= whtOf(1000, 3%), ค่าที่ FE คำนวณผ่าน wht-preview ต้องเท่าสูตรอิสระ); Save Draft สำเร็จ toast Payment saved; API: total_wht 30.00, net_paid 1,040.00, total_applied 1,070.00. assumption: WHT 3% คิดจากฐานก่อน VAT (pay:110) และเงินสด = ยอดที่จ่าย - WHT (rules:17)

---


<sub>Last regenerated: 2026-11-22 · git 45df177</sub>
