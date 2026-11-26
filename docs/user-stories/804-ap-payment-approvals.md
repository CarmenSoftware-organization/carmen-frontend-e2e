# Ap Payment Approvals — User Stories

_Generated from `tests/804-ap-payment-approvals.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Ap Payment Approvals
**Spec:** `tests/804-ap-payment-approvals.spec.ts`
**Default role:** Requestor
**Total test cases:** 7 (3 High / 2 Medium / 0 Low / 2 unset)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-APAPR-010001 | Budget เปิดคิว Payment Approvals: ใบจ่ายที่ Submit แล้วอยู่ในคิว เลือกแล้ว Approve selected -> posted พร้อม JV ใบเหลือ 0 | Critical | Functional |
| TC-APAPR-010002 | Requestor (accounting viewer) เปิดคิว Payment Approvals: ใบที่ Submit รอ Budget ต้องไม่อยู่ในคิวของ Requestor | Medium | Authorization |
| TC-APAPR-010003 | Requestor เปิดรายละเอียดใบ in_review: ไม่เห็นปุ่ม Approve และ Reject (FE ซ่อนตามรายชื่อ user_action.execute) | Medium | Authorization |
| TC-APAPR-020001 | Budget อนุมัติจากหน้ารายละเอียดใบ in_review: posted พร้อม JV Dr เจ้าหนี้ / Cr ธนาคาร | Critical | Functional |
| TC-APAPR-020002 | Budget Reject ใบ in_review พร้อมเหตุผล: ใบจ่ายถูก void ทั้งใบ ไม่มี JV ใบแจ้งหนี้กลับมาค้าง 1,000.00 และออกจากคิว | High | Functional |
| TC-APAPR-030001 | Budget Submit ใบจ่ายเองแล้ว Approve เอง: ต้องถูกปฏิเสธ 403 (maker-checker) | High | Authorization |
| TC-APAPR-030002 | Requestor (ไม่ได้อยู่ในขั้นอนุมัติ) Approve ใบ in_review ผ่าน API: ถูกปฏิเสธ 422 WORKFLOW_USER_NOT_STAGE_APPROVER | High | Authorization |

---

## TC-APAPR-010001 — Budget เปิดคิว Payment Approvals: ใบจ่ายที่ Submit แล้วอยู่ในคิว เลือกแล้ว Approve selected -> posted พร้อม JV ใบเหลือ 0

> **As a** Requestor user, **I want** this Ap Payment Approvals interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Critical · **Test Type:** Functional

**Preconditions**

Budget login (ผู้อนุมัติของ workflow ap_payment); ใบจ่ายเต็ม 1,000.00 ที่ Admin Submit แล้ว (in_review) ของเทสต์เอง

**Steps**

1. เปิด /accounts-payable/payment-approvals ค้นหาเลขที่ PV
2. ติ๊กเลือกแถว กด Approve selected และยืนยัน
3. เปิดแท็บ Approved and posted
4. อ่านใบจ่าย JV และยอดค้างของใบ

**Expected**

แถวของใบจ่ายแสดงในแท็บ In Review และเลือกได้; หลังยืนยัน toast 'Approved 1 payment vouchers.'; ใบจ่ายเป็น posted และไปอยู่แท็บ Approved and posted; JV สมดุล Dr 2100 = 1,000.00, Cr 1110 = 1,000.00 (ไม่มี WHT); ยอดค้างของใบ 0.00. rule: การอนุมัติขั้นสุดท้าย post (pay:188, rules:26)

---

## TC-APAPR-010002 — Requestor (accounting viewer) เปิดคิว Payment Approvals: ใบที่ Submit รอ Budget ต้องไม่อยู่ในคิวของ Requestor

> **As a** low-privilege user, **I should NOT** see Add/edit controls on Ap Payment Approvals, **so that** role separation is enforced.

**Priority:** Medium · **Test Type:** Authorization

**Preconditions**

Requestor login (view-only accounting, ไม่ได้อยู่ในขั้นอนุมัติของ workflow ap_payment); ใบจ่ายที่ Admin Submit แล้วรอ Budget (in_review)

**Steps**

1. เปิด /accounts-payable/payment-approvals
2. ค้นหาเลขที่ PV ของใบที่รอ Budget
3. ดูว่ามีแถวหรือไม่

**Expected**

ไม่มีแถวของใบนี้ในคิวของ Requestor (คิวอนุมัติคือใบที่ผู้ใช้ต้องดำเนินการเอง; pay:225 'submitted assigned items'). pinned (needs product decision): backend ส่งใบ in_review ทุกใบให้ทุกผู้ใช้ จึงมีแถวขึ้น; คำถามที่เปิดอยู่คือคิวเป็น worklist ร่วมหรือเฉพาะผู้อนุมัติที่ถูกมอบหมาย (ดู bug list ส่วน 2)

---

## TC-APAPR-010003 — Requestor เปิดรายละเอียดใบ in_review: ไม่เห็นปุ่ม Approve และ Reject (FE ซ่อนตามรายชื่อ user_action.execute)

> **As a** low-privilege user, **I should NOT** see Add/edit controls on Ap Payment Approvals, **so that** role separation is enforced.

**Priority:** Medium · **Test Type:** Authorization

**Preconditions**

Requestor login; ใบจ่าย in_review ที่ผู้อนุมัติคือ Budget

**Steps**

1. เปิดหน้ารายละเอียดใบจ่าย
2. ดูปุ่มในแถบหัว

**Expected**

สถานะ In Review; ไม่มีปุ่ม Approve และ Reject. rule: ปุ่มอนุมัติเสนอเฉพาะผู้ที่อยู่ในรายชื่อผู้ดำเนินการของขั้น (ap-status.ts apActions, pay:194)

---

## TC-APAPR-020001 — Budget อนุมัติจากหน้ารายละเอียดใบ in_review: posted พร้อม JV Dr เจ้าหนี้ / Cr ธนาคาร

> **As a** Requestor user, **I want** this Ap Payment Approvals interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Critical · **Test Type:** Functional

**Preconditions**

Budget login; ใบจ่ายเต็ม 1,000.00 ที่ Admin Submit แล้ว (in_review)

**Steps**

1. เปิดหน้ารายละเอียดใบจ่าย
2. กด Approve
3. อ่านสถานะ JV และยอดค้างของใบ

**Expected**

เห็นปุ่ม Approve และ Reject; หลัง Approve toast 'Payment approved' สถานะ Posted; JV posted สมดุล Dr 2100 = 1,000.00, Cr 1110 = 1,000.00; ยอดค้างของใบ 0.00. rule: อนุมัติขั้นสุดท้าย post (pay:188)

---

## TC-APAPR-020002 — Budget Reject ใบ in_review พร้อมเหตุผล: ใบจ่ายถูก void ทั้งใบ ไม่มี JV ใบแจ้งหนี้กลับมาค้าง 1,000.00 และออกจากคิว

> **As a** Requestor user, **I want** a clear empty-state when no Ap Payment Approvals records match my search, **so that** I know nothing was found.

**Priority:** High · **Test Type:** Functional

**Preconditions**

Budget login; ใบจ่ายเต็ม 1,000.00 ที่ Admin Submit แล้ว (in_review)

**Steps**

1. เปิดหน้ารายละเอียดใบจ่าย
2. กด Reject ใส่เหตุผลและยืนยัน
3. อ่านสถานะ JV ยอดค้างของใบ และคิว in_review ผ่าน API

**Expected**

toast 'Payment rejected'; สถานะ Void (API doc_status void); ไม่มี JV ที่มี source = ใบจ่าย; ยอดค้างของใบแจ้งหนี้ยัง 1,000.00 (ใบจ่ายที่ void ไม่จองบรรทัดใบแจ้งหนี้); ใบจ่ายไม่อยู่ในรายการ in_review. rule: Reject = void ทั้งใบและต้องมีเหตุผล (BE #1110, 2026-11-25; เดิมคืนเป็น Draft)

---

## TC-APAPR-030001 — Budget Submit ใบจ่ายเองแล้ว Approve เอง: ต้องถูกปฏิเสธ 403 (maker-checker)

> **As a** low-privilege user, **I should NOT** see Add/edit controls on Ap Payment Approvals, **so that** role separation is enforced.

**Priority:** High · **Test Type:** Authorization

**Preconditions**

ใบจ่ายเต็ม 1,000.00 ที่ Budget เป็นผู้ Submit (Budget อยู่ทั้งขั้นสร้างและขั้นอนุมัติของ workflow ที่ seed)

**Steps**

1. Budget Submit ใบจ่ายผ่าน API
2. Budget Approve ใบเดียวกัน
3. อ่านสถานะใบจ่าย

**Expected**

Approve ถูกปฏิเสธ 403 และใบยัง in_review ไม่มี JV. rule: ผู้สร้างหรือผู้ Submit อนุมัติใบของตัวเองไม่ได้ (pay:194, pay:225, pay:253 'maker-checker violation'). pinned: backend ตอบ 200 และ post — กฎ WORKFLOW_CREATOR_CANNOT_APPROVE ของ BE #1110 ห้ามเฉพาะผู้สร้างใบ (ที่นี่คือ Admin) ไม่ครอบคลุมผู้ Submit (ตรวจ 2026-11-25)

---

## TC-APAPR-030002 — Requestor (ไม่ได้อยู่ในขั้นอนุมัติ) Approve ใบ in_review ผ่าน API: ถูกปฏิเสธ 422 WORKFLOW_USER_NOT_STAGE_APPROVER

> **As a** low-privilege user, **I should NOT** see Add/edit controls on Ap Payment Approvals, **so that** role separation is enforced.

**Priority:** High · **Test Type:** Authorization

**Preconditions**

ใบจ่ายที่ Admin Submit แล้ว รอ Budget (in_review); Requestor ไม่อยู่ในรายชื่อผู้ดำเนินการของขั้น Accounting Approval

**Steps**

1. Requestor เรียก Approve ผ่าน API
2. อ่านสถานะใบจ่ายและ JV

**Expected**

ถูกปฏิเสธ 422 รหัส WORKFLOW_USER_NOT_STAGE_APPROVER ใบยัง in_review ไม่มี JV. rule: ผู้ที่ไม่อยู่ในขั้นของ workflow อนุมัติไม่ได้ (pay:194, pay:253; BE #1110 ตรวจผู้ดำเนินการของขั้นแล้ว 2026-11-25). หมายเหตุ: oracle ระบุ 403 แต่ BE ใช้ 422 เหมือนเอกสารอื่นที่ใช้ workflow

---


<sub>Last regenerated: 2026-11-25 · git fe077d4</sub>
