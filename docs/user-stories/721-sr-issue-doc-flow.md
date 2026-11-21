# Store Requisition → Issue — Doc Flow (movement suite) — User Stories

_Generated from `tests/721-sr-issue-doc-flow.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Store Requisition → Issue — Doc Flow (movement suite)
**Spec:** `tests/721-sr-issue-doc-flow.spec.ts`
**Default role:** any authenticated
**Total test cases:** 12 (7 High / 3 Medium / 2 Low)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-SI-700001 | Requestor รับสินค้าเข้าคลังต้นทางด้วย GRN ให้มีของพอเบิก | Medium | Functional |
| TC-SI-700002 | Requestor Submit ใบเบิกแล้วระบบถามวันที่ตามกติกางวด active | High | Functional |
| TC-SI-700003 | HOD อนุมัติรายบรรทัดแล้วอนุมัติทั้งใบ ใบเบิกไปขั้น Issue | High | Functional |
| TC-SI-700004 | FC กรอกจำนวนจ่ายแล้วกด Issue ใบเบิกของงวด active จ่ายได้และตัดของ | High | Functional |
| TC-SI-700005 | Requestor Submit ใบใหม่ตอนวันนี้อยู่ในงวดที่สร้างล่วงหน้า ระบบยังต้องถามวันที่ | Medium | Edge Case |
| TC-SI-710001 | FC รับสินค้าเข้า TEST-MOVE ด้วย GRN แล้ว Commit ให้มีของพอเบิก | Medium | Functional |
| TC-SI-710002 | Requestor Submit ใบเบิกบน FIFO วันนี้อยู่ในงวด active จึงไม่ถามวันที่ | High | Functional |
| TC-SI-710003 | HOD อนุมัติใบเบิกบน FIFO ไปขั้น Issue | High | Functional |
| TC-SI-710004 | FC กรอกจำนวนจ่ายแล้วกด Issue บน FIFO จ่ายได้และตัดของ | High | Functional |
| TC-SI-710005 | Requestor สร้างใบเบิกใบที่สองแล้ว Submit บน FIFO | Low | Functional |
| TC-SI-710006 | HOD อนุมัติใบเบิกใบที่สองบน FIFO | Low | Functional |
| TC-SI-710007 | FC กด Issue โดยไม่กรอกจำนวนจ่าย ระบบต้องไม่ปิดใบโดยไม่ได้จ่ายของ | High | Negative |

---

## TC-SI-700001 — Requestor รับสินค้าเข้าคลังต้นทางด้วย GRN ให้มีของพอเบิก

> **As a** Requestor user, **I want** this Store Requisition → Issue — Doc Flow (movement suite) interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

Login เป็น requestor@carmen.com (movement-setup); BU CARMEN-AVG

**Steps**

1. สร้าง GRN manual วันที่ในงวด active: กร๊อบกรอบ รสสาหร่าย (11020001) × 5 @10 ที่ LCX013
2. กด Create (AVG ลงสต๊อกตอน saved)
3. อ่านยอดคงเหลือของสินค้านั้นที่ LCX013

**Expected**

GRN สถานะ saved และยอดคงเหลือ 11020001 ที่ LCX013 ≥ 1 — ตัดเหตุ "ของไม่พอ" ออกจากการทดสอบ issue

> _Note: เดิม SRI.0 (_movement_play fe/07-sr-issue) · เป็นขั้นเตรียมข้อมูลของสายนี้_

---

## TC-SI-700002 — Requestor Submit ใบเบิกแล้วระบบถามวันที่ตามกติกางวด active

> **As a** Requestor user, **I want** this Store Requisition → Issue — Doc Flow (movement suite) interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

TC-SI-700001 ผ่านแล้ว; Login เป็น requestor@carmen.com; workflow SR workflow ขั้น Create→HOD→Issue (หาจาก stage ไม่ใช้ชื่อ — ชื่อถูกเปลี่ยนบน dev) มีสินค้าแล้ว

**Steps**

1. สร้าง SR: LCX013 → 1FO02, 11020001 × 1, กด Save
2. กด Submit แล้วยืนยัน
3. ถ้าระบบถาม "Which date should this carry?" เลือก "inside the open period"

**Expected**

SR in_progress ขั้น HOD; ถ้าวันนี้อยู่ในงวด active ต้องไม่ถามและลงวันนี้ — ถ้าอยู่นอกงวด active ต้องถาม และ sr_date = วันสุดท้ายของงวด active

> _Note: เดิม SRI.1 · กติกา #718 · 422 SR_DATE_PATTERN_REQUIRED รอบแรกเป็นพฤติกรรมที่ตั้งใจ · TC-SR-050001 (701-sr) ตายเพราะหาปุ่ม "submit for approval"_

---

## TC-SI-700003 — HOD อนุมัติรายบรรทัดแล้วอนุมัติทั้งใบ ใบเบิกไปขั้น Issue

> **As a** HOD user, **I want** this Store Requisition → Issue — Doc Flow (movement suite) interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

TC-SI-700002 ผ่านแล้ว — SR อยู่ขั้น HOD; Login เป็น hod@carmen.com (หัวหน้าแผนกของ workflow)

**Steps**

1. เปิดใบ แล้วกด Edit
2. ติ๊ก Select all → เลือก "Select all" ใน dialog → กด Approve ของบรรทัด
3. กด Approve ของทั้งใบที่ footer แล้วยืนยัน

**Expected**

คำขอ approve ตอบ < 300 และ workflow_current_stage = Issue

> _Note: เดิม SRI.2 · ปุ่ม Approve ของทั้งใบขึ้นหลังตัดสินทุกบรรทัดในโหมดแก้แล้วเท่านั้น — TC-SR-070001/080001 (701-sr) กด Approve ที่หน้าดูและไม่ assert_

---

## TC-SI-700004 — FC กรอกจำนวนจ่ายแล้วกด Issue ใบเบิกของงวด active จ่ายได้และตัดของ

> **As a** FC user, **I want** this Store Requisition → Issue — Doc Flow (movement suite) interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

TC-SI-700003 ผ่านแล้ว — SR อยู่ขั้น Issue และลงวันที่ในงวด active; Login เป็น fc@carmen.com (อยู่ใน stage Issue)

**Steps**

1. เปิดใบ → Edit → เลือกทุกบรรทัด → Approve รายบรรทัด
2. ช่อง Issued กรอก 1 (เท่าที่ขอ)
3. กด Issue ของทั้งใบ แล้วยืนยัน
4. ถ้าระบบถามวันที่ เลือก "inside the open period"

**Expected**

คำขอ issue ตอบ < 300; SR completed; ยอดคงเหลือต้นทางลด 1; มี inventory transaction ลงวันที่ในงวด active (API ไม่เปิดงวดของ cost layer); ถ้าวันนี้อยู่นอกงวด active ระบบต้องถามวันที่จ่าย

> _Note: เดิม SRI.3 · ณ 2026-10-02 รอบ r3 หลังบ้านตอบ 422 SR_ISSUE_PERIOD_NOT_CURRENT ไม่ถามวันที่ — รอบ r4 ผ่านแล้ว · TC-SR-120001 (701-sr) หาปุ่ม Record Issuance ซึ่งไม่มีแล้ว_

---

## TC-SI-700005 — Requestor Submit ใบใหม่ตอนวันนี้อยู่ในงวดที่สร้างล่วงหน้า ระบบยังต้องถามวันที่

> **As a** Requestor user, **I want** this Store Requisition → Issue — Doc Flow (movement suite) behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Edge Case

**Preconditions**

สร้างงวดล่วงหน้าที่ครอบวันนี้แล้ว แต่งวด active (open/locked เก่าสุด) ยังเป็นงวดเก่า; Login เป็น requestor@carmen.com; รันด้วย E2E_SRI_PHASE=post

**Steps**

1. สร้าง SR ใหม่: LCX013 → 1FO02, 11020001 × 1, กด Save
2. กด Submit แล้วยืนยัน
3. ถ้าระบบถามวันที่ เลือก "inside the open period"

**Expected**

วันนี้อยู่นอกงวด active → ระบบต้องถามว่าจะลงวันที่อะไร (ไม่ลงวันนี้เงียบ ๆ) และเลือก "inside" = วันสุดท้ายของงวด active

> _Note: เดิม SRI.7 · ณ 2026-10-02 รอบ r3 ไม่ถาม — รอบ r4 ผ่านแล้ว_

---

## TC-SI-710001 — FC รับสินค้าเข้า TEST-MOVE ด้วย GRN แล้ว Commit ให้มีของพอเบิก

> **As a** FC user, **I want** this Store Requisition → Issue — Doc Flow (movement suite) interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

รัน bun run movement:setup-fifo-roles แล้ว (fc ถือ role Purchase + คลัง TEST-MOVE บน CARMEN-FIFO); E2E_SRI_BU=FIFO

**Steps**

1. Login เป็น fc สร้าง GRN manual วันที่ในงวด active: T-01-F × 5 @10 ที่ TEST-MOVE
2. กด Create แล้ว Commit (FIFO ลงสต๊อกตอน commit)
3. อ่านยอดคงเหลือ T-01-F ที่ TEST-MOVE

**Expected**

GRN committed และยอดคงเหลือ T-01-F ที่ TEST-MOVE ≥ 1

> _Note: เดิม SRF.0_

---

## TC-SI-710002 — Requestor Submit ใบเบิกบน FIFO วันนี้อยู่ในงวด active จึงไม่ถามวันที่

> **As a** Requestor user, **I want** this Store Requisition → Issue — Doc Flow (movement suite) interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

TC-SI-710001 ผ่านแล้ว; requestor ถือ role Requestor + คลัง TEST-MOVE, TEST-CONSUME บน CARMEN-FIFO

**Steps**

1. สร้าง SR: TEST-MOVE → TEST-CONSUME, T-01-F × 1, กด Save
2. กด Submit แล้วยืนยัน

**Expected**

SR in_progress ขั้น HOD; วันนี้อยู่ในงวด active → ไม่ถามวันที่ (ตามกติกาเดียวกับ TC-SI-700002)

> _Note: เดิม SRF.1 · พิสูจน์กลับของกติกา #718_

---

## TC-SI-710003 — HOD อนุมัติใบเบิกบน FIFO ไปขั้น Issue

> **As a** HOD user, **I want** this Store Requisition → Issue — Doc Flow (movement suite) interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

TC-SI-710002 ผ่านแล้ว; hod ถือ role HOD บน CARMEN-FIFO

**Steps**

1. เปิดใบ → Edit → Select all → Approve รายบรรทัด
2. กด Approve ของทั้งใบแล้วยืนยัน

**Expected**

คำขอ approve ตอบ < 300 และ workflow_current_stage = Issue

> _Note: เดิม SRF.2_

---

## TC-SI-710004 — FC กรอกจำนวนจ่ายแล้วกด Issue บน FIFO จ่ายได้และตัดของ

> **As a** FC user, **I want** this Store Requisition → Issue — Doc Flow (movement suite) interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

TC-SI-710003 ผ่านแล้ว — SR อยู่ขั้น Issue; fc อยู่ใน stage Issue ของ workflow บน CARMEN-FIFO

**Steps**

1. เปิดใบ → Edit → Approve รายบรรทัด
2. ช่อง Issued กรอก 1
3. กด Issue ของทั้งใบแล้วยืนยัน

**Expected**

คำขอ issue ตอบ < 300; SR completed; ยอดคงเหลือ TEST-MOVE ลด 1; มี inventory transaction ลงวันที่ในงวด active (API ไม่เปิดงวดของ cost layer)

> _Note: เดิม SRF.3_

---

## TC-SI-710005 — Requestor สร้างใบเบิกใบที่สองแล้ว Submit บน FIFO

> **As a** Requestor user, **I want** this Store Requisition → Issue — Doc Flow (movement suite) interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Low · **Test Type:** Functional

**Preconditions**

TC-SI-710001 ผ่านแล้ว (TEST-MOVE มีของ)

**Steps**

1. สร้าง SR: TEST-MOVE → TEST-CONSUME, T-01-F × 1, กด Save
2. กด Submit แล้วยืนยัน

**Expected**

SR in_progress ขั้น HOD

> _Note: เดิม SRF.4 · ขั้นเตรียมของ TC-SI-710007_

---

## TC-SI-710006 — HOD อนุมัติใบเบิกใบที่สองบน FIFO

> **As a** HOD user, **I want** this Store Requisition → Issue — Doc Flow (movement suite) interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Low · **Test Type:** Functional

**Preconditions**

TC-SI-710005 ผ่านแล้ว — ใบที่สองอยู่ขั้น HOD

**Steps**

1. เปิดใบ → Edit → Approve รายบรรทัด
2. กด Approve ของทั้งใบแล้วยืนยัน

**Expected**

workflow_current_stage = Issue

> _Note: เดิม SRF.5 · ขั้นเตรียมของ TC-SI-710007_

---

## TC-SI-710007 — FC กด Issue โดยไม่กรอกจำนวนจ่าย ระบบต้องไม่ปิดใบโดยไม่ได้จ่ายของ

> **As a** FC user, **I want** this Store Requisition → Issue — Doc Flow (movement suite) behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

TC-SI-710006 ผ่านแล้ว — ใบที่สองอยู่ขั้น Issue

**Steps**

1. เปิดใบ → Edit → Approve รายบรรทัด
2. ไม่แตะช่อง Issued (ค่าตั้งต้น 0)
3. กด Issue แล้วยืนยัน

**Expected**

ระบบเติมจำนวนจ่ายให้ หรือกันไม่ให้กด หรือหลังบ้านปฏิเสธ — ต้องไม่ใช่ completed + ไม่ตัดของ + toast ว่าจ่ายแล้ว

> _Note: บั๊กที่รู้อยู่ (test.fail): ณ 2026-10-02 ใบปิดเป็น completed โดย issued_qty = 0 และยอดคงเหลือไม่ลด · เดิม SRF.6_

---


<sub>Last regenerated: 2026-11-21 · git 3ec284f</sub>
