# Journal Voucher — User Stories

_Generated from `tests/810-journal-voucher.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Journal Voucher
**Spec:** `tests/810-journal-voucher.spec.ts`
**Default role:** Admin
**Total test cases:** 14 (4 High / 5 Medium / 0 Low / 5 unset)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-JV-010001 | สร้าง JV ทำมือ 2 บรรทัดผ่าน UI แล้ว Save: Draft saved และ BE เก็บเป็น draft สมดุล | Critical | Functional |
| TC-JV-010002 | JV ไม่สมดุล (Dr 100.00 / Cr 90.00): ปุ่ม Submit ปิด แสดงข้อความ Unbalanced และไม่มี JV ถูกสร้าง | High | Negative |
| TC-JV-010003 | Save Draft JV ที่ไม่สมดุล: jv:241 ว่า Save Draft ยังไม่บังคับ balanced ครบทุกกรณี แต่ BE ปฏิเสธ 422 ตั้งแต่ร่าง | Medium | Negative |
| TC-JV-010004 | รายการ JV แสดง read-set E2E-JV-POSTED: Manual / POSTED / Dr 250.00 / Cr 250.00 | Medium | Functional |
| TC-JV-020001 | Submit JV จากหน้า UI แล้ว Budget Approve: in_review -> posted และ JV มีวันที่ลงบัญชี | Critical | Functional |
| TC-JV-020002 | Requestor (view-only) Approve JV ที่รออนุมัติ, Void และ Reverse JV ที่ลงบัญชีแล้ว: ถูกปฏิเสธ และสถานะไม่เปลี่ยน | High | Security |
| TC-JV-030001 | หน้ารายละเอียด JV แสดงทุกช่อง header ตาม mockup v2.14 แม้ว่าง (Ref. Doc, Schedule Post, Auto-Reverse) | Medium | Functional |
| TC-JV-040001 | Void JV ทำมือที่ลงบัญชีแล้ว (API): สถานะ void เก็บเหตุผลและเวลา ไม่มี JV ใหม่เกิดขึ้น | Critical | Functional |
| TC-JV-040002 | Void JV จากหน้า UI: ปุ่มยืนยันปิดจนกรอกเหตุผล แล้ว Voucher voided และสถานะ VOID | High | Functional |
| TC-JV-040003 | Void โดยไม่ส่งเหตุผล: BE ปฏิเสธ 422 GL_JV_VOID_REASON_REQUIRED และ JV ยัง posted | Medium | Negative |
| TC-JV-040004 | Void JV ที่ยังเป็นร่าง: oracle อนุญาต (jv:246) แต่ BE ปฏิเสธ 409 GL_JV_IMMUTABLE | Medium | Functional |
| TC-JV-050001 | Reverse JV ทำมือที่ลงบัญชีแล้วลงวันถัดไป: JV กลับรายการ posted สมดุล สลับ Dr/Cr ผูกกับต้นฉบับ | Critical | Functional |
| TC-JV-050002 | Reverse JV ใบเดิมซ้ำ: ถูกปฏิเสธ 409 และไม่มี JV กลับรายการใบที่สอง | High | Negative |
| TC-JV-060001 | JV ที่ AP สร้าง (subledger): Void และ Reverse ตรง ๆ ถูกปฏิเสธ 409 GL_JV_IMMUTABLE และใบ AP ต้นทางยัง posted | Critical | Negative |

---

## TC-JV-010001 — สร้าง JV ทำมือ 2 บรรทัดผ่าน UI แล้ว Save: Draft saved และ BE เก็บเป็น draft สมดุล

> **As a** Admin user, **I want** this Journal Voucher interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Critical · **Test Type:** Functional

**Preconditions**

Admin login บน TEST BU; ผังบัญชี 5300 / 1110; งวดบัญชีเปิดครอบคลุมวันนี้

**Steps**

1. เปิดหน้า New JV เลือกวันที่เป็นวันนี้
2. ใส่คำอธิบาย (tag) บรรทัด 1 Dr 5300 100.00, บรรทัด 2 Cr 1110 100.00
3. กด Save
4. อ่าน JV ผ่าน API

**Expected**

POST gl-jv สำเร็จ toast Draft saved และไปหน้ารายละเอียด; API: jv_status draft, source manual, jv_date = วันนี้ (Bangkok) ที่เลือกเองใน date picker (ฟอร์มตั้งค่าเริ่มต้นเป็นวันที่ UTC จึงไม่พึ่งค่าเริ่มต้น), total_debit = total_credit = 100.00, 2 บรรทัด (5300 Dr 100.00 / 1110 Cr 100.00)

---

## TC-JV-010002 — JV ไม่สมดุล (Dr 100.00 / Cr 90.00): ปุ่ม Submit ปิด แสดงข้อความ Unbalanced และไม่มี JV ถูกสร้าง

> **As a** Admin user, **I want** this Journal Voucher behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

Admin login; หน้า New JV

**Steps**

1. ใส่คำอธิบาย (tag) บรรทัด 1 Dr 5300 100.00, บรรทัด 2 Cr 1110 90.00
2. อ่านข้อความสมดุลและสถานะปุ่ม Submit
3. ค้นหา JV ตาม tag ผ่าน API

**Expected**

แสดง 'Unbalanced · Review debit and credit totals', ปุ่ม Submit disabled (ไม่ยิง request ใด); ไม่มี JV ที่ description = tag. rule: Submit disabled เมื่อ base debit != credit (jv:168, jv:294)

---

## TC-JV-010003 — Save Draft JV ที่ไม่สมดุล: jv:241 ว่า Save Draft ยังไม่บังคับ balanced ครบทุกกรณี แต่ BE ปฏิเสธ 422 ตั้งแต่ร่าง

> **As a** Admin user, **I want** this Journal Voucher behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Negative

**Preconditions**

Admin login; หน้า New JV; Dr 100.00 / Cr 90.00

**Steps**

1. ใส่คำอธิบาย (tag) และ 2 บรรทัดไม่สมดุล
2. กด Save (ไม่ใช่ Submit)
3. อ่าน JV ผ่าน API

**Expected**

Draft saved และมี JV draft ตาม tag. rule (hedged): Save Draft validate shape แต่ยังไม่บังคับ balanced ครบทุกกรณี (jv:241) - อ่านว่าร่างไม่สมดุลบันทึกได้เป็นการตีความ ไม่ใช่ข้อความตรง ๆ. pinned: BE POST gl-jv ตอบ 422 'must have at least two lines with equal base debit and credit'

---

## TC-JV-010004 — รายการ JV แสดง read-set E2E-JV-POSTED: Manual / POSTED / Dr 250.00 / Cr 250.00

> **As a** Admin user, **I want** this Journal Voucher interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

Admin login; read-set E2E-JV-POSTED (Dr 5300 250.00 / Cr 1110 250.00) ลงบัญชีแล้ว

**Steps**

1. เปิดหน้ารายการ JV
2. ค้นหา E2E-JV-POSTED
3. อ่านแถวที่พบ

**Expected**

พบแถว E2E-JV-POSTED ที่ Source = Manual, Status = POSTED, Debit 250.00, Credit 250.00

---

## TC-JV-020001 — Submit JV จากหน้า UI แล้ว Budget Approve: in_review -> posted และ JV มีวันที่ลงบัญชี

> **As a** Admin user, **I want** this Journal Voucher interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Critical · **Test Type:** Functional

**Preconditions**

Admin login; workflow gl_jv (Admin สร้าง/Submit, Budget อนุมัติ); งวดเปิด

**Steps**

1. สร้าง JV 2 บรรทัดสมดุลผ่านฟอร์ม เลือกวันที่เป็นวันนี้ กด Submit
2. อ่านสถานะ
3. Budget Approve ผ่าน API
4. เปิดหน้ารายละเอียด

**Expected**

หลัง Submit: toast Voucher sent for approval, jv_status in_review; หลัง Approve: posted, posted_at มีค่า, jv_date = วันนี้ (Bangkok) ที่เลือกเองใน date picker, เหลือ JV เดียวตาม tag, บรรทัดตรงกับที่กรอก; หน้ารายละเอียดแสดง POSTED. rule: workflow เปิด = Submit แล้ว in_review, final approval จึง post (jv:242, jv:296)

---

## TC-JV-020002 — Requestor (view-only) Approve JV ที่รออนุมัติ, Void และ Reverse JV ที่ลงบัญชีแล้ว: ถูกปฏิเสธ และสถานะไม่เปลี่ยน

> **As the** system, **I want** Journal Voucher inputs hardened against common attacks, **so that** the application stays safe.

**Priority:** High · **Test Type:** Security

**Preconditions**

JV ของเทสต์เอง 1 ใบ in_review และอีก 1 ใบ posted; Requestor ไม่อยู่ใน stage Accounting Approval และไม่มี accounting.gl.void / reverse

**Steps**

1. Requestor Approve JV ที่ in_review
2. Requestor Void JV ที่ posted
3. Requestor Reverse JV ที่ posted
4. อ่านสถานะ JV ทั้งสอง

**Expected**

Approve 422 WORKFLOW_USER_NOT_STAGE_APPROVER (ไม่ใช่ผู้อนุมัติของ stage); Void และ Reverse 403 (ไม่มีสิทธิ์); JV แรกยัง in_review, JV หลังยัง posted และไม่มี JV กลับรายการเกิดขึ้น. rule: 403 ไม่มีสิทธิ์หรือผิด workflow stage (jv:283). assumption: Void ของ JV ที่ posted ถือว่าถูกต้อง แต่ jv:246 ไม่นับ posted ใน Void (jv:247 ให้ Reverse); เคสนี้ยืนยันเฉพาะว่า role ที่ไม่มีสิทธิ์ถูกปฏิเสธ

---

## TC-JV-030001 — หน้ารายละเอียด JV แสดงทุกช่อง header ตาม mockup v2.14 แม้ว่าง (Ref. Doc, Schedule Post, Auto-Reverse)

> **As a** Admin user, **I want** this Journal Voucher interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

Admin login; read-set E2E-JV-POSTED (manual, ไม่มีเอกสารอ้างอิง, ไม่ตั้ง Schedule Post / Auto-Reverse)

**Steps**

1. เปิดหน้ารายละเอียด E2E-JV-POSTED
2. อ่านช่อง header ทุกช่อง
3. อ่านบรรทัดและยอดรวม

**Expected**

แสดง Voucher Type 'JV - Journal Voucher', Document No. = jv_no, Date, Description = E2E-JV-POSTED, checkbox Schedule Post และ Auto-Reverse (ปิดแก้ไข ไม่ติ๊ก), Source Manual, Ref. Doc '—' (ช่องว่างต้องไม่ถูกซ่อน), Status POSTED; 2 บรรทัด 5300 Dr 250.00 / 1110 Cr 250.00 และ 'Balanced · Variance 0.00'. decision: ทีม 2026-11-04 JV detail โชว์ทุกช่องแม้ว่าง

---

## TC-JV-040001 — Void JV ทำมือที่ลงบัญชีแล้ว (API): สถานะ void เก็บเหตุผลและเวลา ไม่มี JV ใหม่เกิดขึ้น

> **As a** Admin user, **I want** a clear empty-state when no Journal Voucher records match my search, **so that** I know nothing was found.

**Priority:** Critical · **Test Type:** Functional

**Preconditions**

JV ของเทสต์เอง posted; Admin มี accounting.gl.void (ผ่าน gl-posting)

**Steps**

1. นับ JV ทั้งหมดของ BU
2. POST gl-posting/:id/void พร้อมเหตุผล
3. อ่าน JV และนับ JV ทั้งหมดอีกครั้ง

**Expected**

200, jv_status void, void_reason = เหตุผลที่ส่ง, void_at มีค่า; จำนวน JV ของ BU ไม่เปลี่ยน (void ถอนยอดโดยไม่สร้าง JV กลับรายการ); ไม่มี JV ใดมี reversal_of_jv_id ชี้มาที่ JV นี้. rule: Void เก็บ reason ห้ามลบ audit (jv:246). assumption: Void ของ JV ที่ posted ถือว่าถูกต้อง ทั้งที่ jv:246 ไม่นับ posted ใน Void (jv:247 ให้ Reverse); ยืนยันพฤติกรรมที่ BE/FE ใช้จริง (ดู TC-JV-040004)

---

## TC-JV-040002 — Void JV จากหน้า UI: ปุ่มยืนยันปิดจนกรอกเหตุผล แล้ว Voucher voided และสถานะ VOID

> **As a** Admin user, **I want** this Journal Voucher interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

Admin login; JV ของเทสต์เอง posted

**Steps**

1. เปิดหน้ารายละเอียด กด Void
2. อ่านปุ่ม Void ในกล่องยืนยันก่อนกรอกเหตุผล
3. กรอกเหตุผล กดยืนยัน
4. อ่านสถานะผ่าน API

**Expected**

ปุ่ม Void ในกล่องยืนยัน disabled จนกรอกเหตุผล; หลังยืนยัน POST gl-posting สำเร็จ toast Voucher voided; API: void, void_reason ตรงที่กรอก. assumption: Void ของ JV ที่ posted ถือว่าถูกต้อง ทั้งที่ jv:246 ไม่นับ posted ใน Void (jv:247 ให้ Reverse)

---

## TC-JV-040003 — Void โดยไม่ส่งเหตุผล: BE ปฏิเสธ 422 GL_JV_VOID_REASON_REQUIRED และ JV ยัง posted

> **As a** Admin user, **I want** this Journal Voucher behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Negative

**Preconditions**

JV ของเทสต์เอง posted

**Steps**

1. POST gl-posting/:id/void โดยไม่มี reason
2. อ่านสถานะ JV

**Expected**

422 รหัส GL_JV_VOID_REASON_REQUIRED; JV ยัง posted ไม่มี void_at. assumption: oracle บอกแค่ 'เก็บ reason' (jv:246) ไม่ได้บอกว่าบังคับ และ jv:246 ไม่นับ posted ใน Void (jv:247 ให้ Reverse); เทสต์นี้ยืนยันพฤติกรรมที่ BE ใช้จริง

---

## TC-JV-040004 — Void JV ที่ยังเป็นร่าง: oracle อนุญาต (jv:246) แต่ BE ปฏิเสธ 409 GL_JV_IMMUTABLE

> **As a** Admin user, **I want** this Journal Voucher interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

JV ของเทสต์เอง draft (ยังไม่ Submit)

**Steps**

1. POST gl-posting/:id/void พร้อมเหตุผล
2. อ่านสถานะ JV

**Expected**

200 และ jv_status void. rule: Void ใช้ได้ในสถานะ draft / submitted / scheduled / post_failed (jv:246), ส่วน posted ใช้ Reverse (jv:247). pinned: BE void ได้เฉพาะ JV ที่ posted; draft และ in_review ได้ 409 GL_JV_IMMUTABLE

---

## TC-JV-050001 — Reverse JV ทำมือที่ลงบัญชีแล้วลงวันถัดไป: JV กลับรายการ posted สมดุล สลับ Dr/Cr ผูกกับต้นฉบับ

> **As a** Admin user, **I want** this Journal Voucher interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Critical · **Test Type:** Functional

**Preconditions**

JV ของเทสต์เอง posted (Dr 5300 100.00 / Cr 1110 100.00) วันนี้; งวดของวันถัดไปเปิดอยู่; Admin มี accounting.gl.reverse

**Steps**

1. POST gl-posting/:id/reverse โดย jv_date = วันถัดไป
2. อ่านต้นฉบับและ JV กลับรายการ

**Expected**

200 สร้าง JV ใหม่ source reversal สถานะ posted ลงวันถัดไป (หลังต้นฉบับ) reversal_of_jv_id = ต้นฉบับ; ต้นฉบับยัง posted และ reversed_by_jv_id = JV ใหม่; JV ใหม่สมดุลและสลับข้าง: 5300 Cr 100.00 / 1110 Dr 100.00. rule: Reverse = linked JV สลับ Dr/Cr หักล้างยอด (jv:247, jv:221-222)

---

## TC-JV-050002 — Reverse JV ใบเดิมซ้ำ: ถูกปฏิเสธ 409 และไม่มี JV กลับรายการใบที่สอง

> **As a** Admin user, **I want** this Journal Voucher behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

JV ของเทสต์เอง posted และถูก Reverse แล้ว 1 ครั้ง

**Steps**

1. Reverse ครั้งแรกสำเร็จ
2. Reverse ใบเดิมอีกครั้ง
3. นับ JV ที่ reversal_of_jv_id ชี้มาที่ต้นฉบับ

**Expected**

ครั้งที่สองได้ 409 (รหัส GL_JV_IMMUTABLE); มี JV กลับรายการเพียงใบเดียว. rule: 409 reversal already exists (jv:284)

---

## TC-JV-060001 — JV ที่ AP สร้าง (subledger): Void และ Reverse ตรง ๆ ถูกปฏิเสธ 409 GL_JV_IMMUTABLE และใบ AP ต้นทางยัง posted

> **As a** Admin user, **I want** this Journal Voucher behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Critical · **Test Type:** Negative

**Preconditions**

ใบ AP invoice ของเทสต์เอง 1 x 100.00 + VAT ลงบัญชีแล้ว (Submit ลงบัญชีตรงไม่ผ่าน workflow) ได้ JV source ap_invoice

**Steps**

1. หา JV ที่ source = ใบ AP
2. POST gl-posting/:id/void
3. POST gl-posting/:id/reverse
4. อ่าน JV และใบ AP อีกครั้ง

**Expected**

Void และ Reverse ได้ 409 รหัส GL_JV_IMMUTABLE ทั้งคู่; JV ยัง posted บรรทัดเดิม (Dr 5300 100.00 + Dr 1170 7.00 / Cr 2100 107.00) และไม่มี JV ใหม่; ใบ AP ยัง posted. rule: JV จาก AP/AR/Inventory เป็น immutable projection แก้จาก source owner เท่านั้น (jv:315)

---


<sub>Last regenerated: 2026-11-22 · git c21b49b</sub>
