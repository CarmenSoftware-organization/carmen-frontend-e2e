# Jv Template — User Stories

_Generated from `tests/811-jv-template.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Jv Template
**Spec:** `tests/811-jv-template.spec.ts`
**Default role:** Admin
**Total test cases:** 7 (2 High / 4 Medium / 0 Low / 1 unset)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-JVT-010001 | รายการ Template Voucher แสดง read-set E2E-JVT-1: ชนิด Recurring และ Active | Medium | Functional |
| TC-JVT-010002 | รายการ Recurring Voucher แสดง E2E-JVT-1 และหน้ารายละเอียดแสดงบรรทัด Dr 5300 250.00 / Cr 1110 250.00 | Medium | Functional |
| TC-JVT-010003 | รายการ Allocation Voucher โหลดได้ แสดง allocation template ของเทสต์เอง และไม่แสดง E2E-JVT-1 (recurring) | Medium | Functional |
| TC-JVT-020001 | สร้าง JV จาก recurring template (บรรทัดคัดลอกจาก E2E-JVT-1) ผ่านหน้า UI: ได้ JV draft ที่คัดลอกบรรทัดครบและสมดุล | Critical | Functional |
| TC-JVT-020002 | Generate template เดิมซ้ำในงวดเดียวกัน: ถูกปฏิเสธ 409 GL_JV_TEMPLATE_ALREADY_RUN และไม่มี JV ใบที่สอง | Medium | Negative |
| TC-JVT-030001 | Allocation template แบ่ง 1,000.00 ตามสัดส่วน 25% / 75%: บรรทัด Dr เท่า allocate x ratio และ Cr เท่ายอดรวม | High | Functional |
| TC-JVT-030002 | Allocation template แบ่ง 1,000.01 ตามสัดส่วน 33.33% / 66.67%: แต่ละบรรทัดต้องปัดครึ่งขึ้นที่ 2 ตำแหน่ง (BE เก็บ 5 ตำแหน่ง) | High | Functional |

---

## TC-JVT-010001 — รายการ Template Voucher แสดง read-set E2E-JVT-1: ชนิด Recurring และ Active

> **As a** Admin user, **I want** this Jv Template interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

Admin login; read-set E2E-JVT-1 (recurring, active) บน TEST BU

**Steps**

1. เปิดหน้า Template Voucher (/accounting/template-voucher)
2. ค้นหา E2E-JVT-1
3. อ่านแถว

**Expected**

พบแถว E2E-JVT-1 เพียงแถวเดียว ชนิด Recurring สถานะ Active

---

## TC-JVT-010002 — รายการ Recurring Voucher แสดง E2E-JVT-1 และหน้ารายละเอียดแสดงบรรทัด Dr 5300 250.00 / Cr 1110 250.00

> **As a** Admin user, **I want** this Jv Template interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

Admin login; read-set E2E-JVT-1

**Steps**

1. เปิดหน้า Recurring Voucher ค้นหา E2E-JVT-1
2. เปิดรายละเอียด
3. อ่านบรรทัดผ่าน API (ยอดเทียบ oracle ที่ seed)

**Expected**

พบแถว E2E-JVT-1; หน้ารายละเอียดแสดงรหัส E2E-JVT-1; API: 2 บรรทัด Dr 250.00 และ Cr 250.00 สมดุล คนละบัญชี (5300 / 1110)

---

## TC-JVT-010003 — รายการ Allocation Voucher โหลดได้ แสดง allocation template ของเทสต์เอง และไม่แสดง E2E-JVT-1 (recurring)

> **As a** Admin user, **I want** this Jv Template interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

Admin login; allocation template ของเทสต์เอง 1 รายการ (50% / 50% ของ 100.00); read-set E2E-JVT-1 เป็น recurring

**Steps**

1. เปิดหน้า Allocation Voucher ค้นหา tag ของ template
2. ค้นหา E2E-JVT-1

**Expected**

พบแถว template ของเทสต์เอง (ยอดแบ่ง 100.00); ค้นหา E2E-JVT-1 ไม่พบแถว (ชนิดไม่ตรงกับหน้านี้)

---

## TC-JVT-020001 — สร้าง JV จาก recurring template (บรรทัดคัดลอกจาก E2E-JVT-1) ผ่านหน้า UI: ได้ JV draft ที่คัดลอกบรรทัดครบและสมดุล

> **As a** Admin user, **I want** this Jv Template interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Critical · **Test Type:** Functional

**Preconditions**

Admin login; template ของเทสต์เอง recurring ช่วงงวดปัจจุบัน บรรทัดคัดลอกจาก E2E-JVT-1 (Dr 5300 250.00 / Cr 1110 250.00); งวดปัจจุบันเปิด

**Steps**

1. เปิดหน้ารายละเอียด template กด Generate JV
2. เลือกงวดปัจจุบัน กด Run
3. อ่าน JV ที่สร้างผ่าน API

**Expected**

toast 'Created draft <jv_no>'; JV สถานะ draft และผลตอบ generate ระบุงวดปัจจุบัน บรรทัดเท่ากับบรรทัดของ E2E-JVT-1 ทุกบรรทัด (5300 Dr 250.00 / 1110 Cr 250.00) และสมดุล; read-set E2E-JVT-1 ไม่ถูกแก้ (ยังไม่เคยถูก generate โดยเทสต์นี้)

---

## TC-JVT-020002 — Generate template เดิมซ้ำในงวดเดียวกัน: ถูกปฏิเสธ 409 GL_JV_TEMPLATE_ALREADY_RUN และไม่มี JV ใบที่สอง

> **As a** Admin user, **I want** this Jv Template behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Negative

**Preconditions**

template recurring ของเทสต์เอง ที่ generate แล้ว 1 ครั้งในงวดปัจจุบัน

**Steps**

1. Generate ครั้งแรก
2. Generate อีกครั้งในงวดเดียวกัน
3. นับ JV ที่มี tag ของ template

**Expected**

ครั้งที่สองได้ 409 รหัส GL_JV_TEMPLATE_ALREADY_RUN; มี JV เพียงใบเดียวที่คำอธิบายตรงกับ template. assumption: oracle ไม่ระบุ; ยืนยันพฤติกรรม idempotent ต่องวดของ BE

---

## TC-JVT-030001 — Allocation template แบ่ง 1,000.00 ตามสัดส่วน 25% / 75%: บรรทัด Dr เท่า allocate x ratio และ Cr เท่ายอดรวม

> **As a** Admin user, **I want** this Jv Template interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

Admin login; allocation template ของเทสต์เอง allocate_amount 1,000.00, Dr 5300 ratio 0.25, Dr 5100 ratio 0.75, Cr 1110 ratio 1.0

**Steps**

1. Generate JV งวดปัจจุบัน
2. อ่านบรรทัดของ JV ที่สร้าง

**Expected**

ค่าที่คาดคำนวณด้วย money.round จากสัดส่วน (ไม่ใช้ค่าที่ BE ตอบ): Dr 5300 = 250.00, Dr 5100 = 750.00, Cr 1110 = 1,000.00; ผลรวม Dr = Cr สมดุล JV เป็น draft. assumption: oracle ไม่ครอบคลุมการแบ่งของ allocation template; ใช้ allocate x ratio ปัดครึ่งขึ้นที่ 2 ตำแหน่งของ BU

---

## TC-JVT-030002 — Allocation template แบ่ง 1,000.01 ตามสัดส่วน 33.33% / 66.67%: แต่ละบรรทัดต้องปัดครึ่งขึ้นที่ 2 ตำแหน่ง (BE เก็บ 5 ตำแหน่ง)

> **As a** Admin user, **I want** this Jv Template interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

Admin login; allocation template ของเทสต์เอง allocate_amount 1,000.01, Dr 5300 ratio 0.3333, Dr 5100 ratio 0.6667, Cr 1110 ratio 1.0

**Steps**

1. Generate JV งวดปัจจุบัน
2. อ่านบรรทัดของ JV ที่สร้าง

**Expected**

ค่าที่คาดคำนวณด้วย money.round: Dr 5300 = round(1000.01 x 0.3333, 2) = 333.30, Dr 5100 = round(1000.01 x 0.6667, 2) = 666.71, Cr 1110 = 1,000.01; Dr = Cr สมดุล. rule: HALF_UP ต่อบรรทัด journal ที่ decimal_places ของสกุลเงินหลัก (accounting-foundation.md:103,120). pinned: BE เก็บ 333.30333 และ 666.70667 (ไม่ปัด)

---


<sub>Last regenerated: 2026-11-24 · git f462816</sub>
