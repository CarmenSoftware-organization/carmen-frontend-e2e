# Period Close Out Of Period Docs — User Stories

_Generated from `tests/914-period-close-out-of-period-docs.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Period Close Out Of Period Docs
**Spec:** `tests/914-period-close-out-of-period-docs.spec.ts`
**Default role:** any authenticated
**Total test cases:** 7 (4 High / 3 Medium / 0 Low)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-PE-440001 | GRN บันทึกแล้ว (saved) ลงวันที่งวดถัดไปสร้างได้ เพื่อใช้ตรวจว่าไม่ขวาง Start ของงวดนี้ | High | Functional |
| TC-PE-440002 | GRN ร่างลงวันที่งวดถัดไปสร้างได้ เพื่อใช้ตรวจว่าไม่ขวาง Start ของงวดนี้ | High | Functional |
| TC-PE-440003 | ฟอร์ม Stock In เลือกวันที่ในงวดถัดไปไม่ได้ (ปฏิทินล็อกไว้ที่งวดปัจจุบัน) | Medium | Validation |
| TC-PE-440004 | ฟอร์ม Stock Out เลือกวันที่ในงวดถัดไปไม่ได้ (ปฏิทินล็อกไว้ที่งวดปัจจุบัน) | Medium | Validation |
| TC-PE-440005 | ใบลดหนี้ลงวันที่งวดถัดไปต้องถูกปฏิเสธ (CREDIT_NOTE_DATE_NOT_CURRENT_PERIOD) | High | Negative |
| TC-PE-440006 | เปิดค้างไว้: ใบลดหนี้ร่างในงวดนี้ และตรวจว่า PR / PO ค้างไม่อยู่ในตัวขวาง Start | Medium | Functional |
| TC-PE-440007 | ตรวจความพร้อมก่อนกด Start Period Close: เอกสารนอกงวดและ CN ร่างต้องไม่ขวาง (ไม่กด Start) | High | Happy Path |

---

## TC-PE-440001 — GRN บันทึกแล้ว (saved) ลงวันที่งวดถัดไปสร้างได้ เพื่อใช้ตรวจว่าไม่ขวาง Start ของงวดนี้

> **As a** any authenticated user, **I want** this Period Close Out Of Period Docs interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

Login เป็น Admin (gmail); งวดปัจจุบันของ BU = งวดของ scenario และงวดถัดไปเปิดอยู่; รอบนับยังไม่เริ่ม; admin ผูกกับคลัง L (910)

**Steps**

1. Goods Receive Note → New (Manual) · Vendor C010 · GRN Date = วันที่ในงวดถัดไปตาม scenario (nextGrn.date)
2. คลัง L · สินค้า nextGrn ของ scenario qty 10 ราคาตาม scenario
3. กด Create (saved)
4. อ่านสถานะใบสดจาก API แล้วเปิดใบ

**Expected**

GRN มีสถานะ saved (งวดถัดไปเปิดอยู่จึงสร้างได้) — ใบนี้ต้องไม่ขวาง Start ของงวดนี้ (ตรวจใน TC-PE-440007)

> _Note: เดิม 2.1 (_movement_play specs/20-case2) · ชนิดเดียวกับ 1.2 แต่อยู่งวดหน้า · ใช้เป็น "GRN งวดหน้า" ในการตรวจต้นทุนข้อ 2.9 · ต้นฉบับบันทึก PASS/FAIL โดยไม่ assert — พอร์ต assert สถานะ saved · idempotent: จำใน state.json_

---

## TC-PE-440002 — GRN ร่างลงวันที่งวดถัดไปสร้างได้ เพื่อใช้ตรวจว่าไม่ขวาง Start ของงวดนี้

> **As a** any authenticated user, **I want** this Period Close Out Of Period Docs interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

Login เป็น Admin (gmail); งวดปัจจุบันของ BU = งวดของ scenario และงวดถัดไปเปิดอยู่; รอบนับยังไม่เริ่ม

**Steps**

1. Goods Receive Note → New (Manual) · Vendor C010 · GRN Date = วันที่ในงวดถัดไปตาม scenario (nextGrnDraftDate)
2. คลัง L · E2E-PC-X qty 1 @10
3. กด Save Draft
4. อ่านสถานะใบสดจาก API แล้วเปิดใบ

**Expected**

GRN มีสถานะ draft (เลข draft-…) — ใบนี้ต้องไม่ขวาง Start ของงวดนี้ (ตรวจใน TC-PE-440007)

> _Note: เดิม 2.1b (_movement_play specs/20-case2) · ชนิดเดียวกับ 1.1 แต่อยู่งวดหน้า · ต้นฉบับบันทึก PASS/FAIL โดยไม่ assert — พอร์ต assert สถานะ draft · รอบถัดไป 910 (preCleanAuto) จะลบใบนี้ทิ้ง_

---

## TC-PE-440003 — ฟอร์ม Stock In เลือกวันที่ในงวดถัดไปไม่ได้ (ปฏิทินล็อกไว้ที่งวดปัจจุบัน)

> **As a** any authenticated user, **I want** the system to block invalid Period Close Out Of Period Docs submissions, **so that** data quality is preserved.

**Priority:** Medium · **Test Type:** Validation

**Preconditions**

Login เป็น Admin (gmail); งวดปัจจุบันของ BU = งวดของ scenario

**Steps**

1. Inventory Adjustment → Add Stock In
2. เปิดปฏิทินช่อง Date → กดเดือนถัดไปหนึ่งครั้ง → ดูวันที่ของงวดหน้าตาม scenario (nextMonth.day)
3. ปิดปฏิทิน แล้วใช้ date picker เดินเดือนไปเลือกวันที่ในงวดถัดไป (nextGrn.date)

**Expected**

วันที่ของงวดถัดไปเลือกไม่ได้ทั้งสองทาง (ปุ่มวันถูกปิดหรือเดินเดือนไปไม่ถึง) — สร้าง Stock In ลงงวดหน้าผ่าน UI ไม่ได้ จึงบันทึกเป็น N/A

> _Note: เดิม 2.2 (_movement_play specs/20-case2) · ปฏิทินล็อกตาม ia-form-schema.ts (Date must be within the current period) แม้หลังบ้านจะรับ SI ลงงวดที่เปิดอยู่ · ต้นฉบับบันทึก N/A/FAIL โดยไม่ assert — พอร์ต assert ว่าเลือกไม่ได้ และเพิ่มการลองด้วย pickDate อีกทาง เพราะ nextMonth.day ของ scenario p10/p11 เคยสลับวัน/เดือน (10/11/2026, 10/12/2026 — แก้ใน scenarios.ts แล้ว) ทำให้การตรวจเดิมผ่านเสมอ_

---

## TC-PE-440004 — ฟอร์ม Stock Out เลือกวันที่ในงวดถัดไปไม่ได้ (ปฏิทินล็อกไว้ที่งวดปัจจุบัน)

> **As a** any authenticated user, **I want** the system to block invalid Period Close Out Of Period Docs submissions, **so that** data quality is preserved.

**Priority:** Medium · **Test Type:** Validation

**Preconditions**

Login เป็น Admin (gmail); งวดปัจจุบันของ BU = งวดของ scenario

**Steps**

1. Inventory Adjustment → Add Stock Out
2. เปิดปฏิทินช่อง Date → กดเดือนถัดไปหนึ่งครั้ง → ดูวันที่ของงวดหน้าตาม scenario (nextMonth.day)
3. ปิดปฏิทิน แล้วใช้ date picker เดินเดือนไปเลือกวันที่ในงวดถัดไป (nextGrn.date)

**Expected**

วันที่ของงวดถัดไปเลือกไม่ได้ทั้งสองทาง — สร้าง Stock Out ลงงวดหน้าผ่าน UI ไม่ได้ จึงบันทึกเป็น N/A

> _Note: เดิม 2.3 (_movement_play specs/20-case2) · หลังบ้านก็ปฏิเสธเองด้วย 422 STOCK_OUT_DATE_NOT_CURRENT_PERIOD (จ่ายออกต้องอยู่งวดปัจจุบันเท่านั้น) · ต้นฉบับบันทึก N/A/FAIL โดยไม่ assert — พอร์ต assert ว่าเลือกไม่ได้ (+ pickDate เหมือน TC-PE-440003)_

---

## TC-PE-440005 — ใบลดหนี้ลงวันที่งวดถัดไปต้องถูกปฏิเสธ (CREDIT_NOTE_DATE_NOT_CURRENT_PERIOD)

> **As a** any authenticated user, **I want** this Period Close Out Of Period Docs behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

Login เป็น Admin (gmail); งวดปัจจุบันของ BU = งวดของ scenario; มี GRN ฐานที่ commit แล้ว (grnA จาก 910 หรือเลข GRN ที่ scenario ระบุ)

**Steps**

1. Credit Note → New · Vendor C010 · GRN = GRN ฐานของ scenario · Reason ของ BU · Doc Date / Tax Invoice Date = วันที่ในงวดถัดไป (cnNext.date)
2. Add Item → Select from GRN: สินค้า cnNext ของ scenario คืน 1
3. กด Create (→ Submit ถ้าสร้างได้)
4. ถ้ามีใบ: อ่านสถานะ และ cost layer ของใบลดหนี้ที่คลัง L

**Expected**

หลังบ้านปฏิเสธด้วย 422 CREDIT_NOTE_DATE_NOT_CURRENT_PERIOD และไม่มีใบลดหนี้ที่ completed — ใบลดหนี้ลงวันที่ได้เฉพาะงวด active

> _Note: เดิม 2.4 (_movement_play specs/20-case2) · กติกาตาม PR #724 (ผู้ใช้ยืนยัน 2026-10-02) — รอบก่อน #724 บันทึก INFO (ใบลงวันที่งวดหน้าแต่สต๊อกไปลดในงวดปัจจุบัน) · รอบล่าสุด p11-r4 / avg2607-r4 = PASS 2026-10-02 จึงไม่ใช่ test.fail_

---

## TC-PE-440006 — เปิดค้างไว้: ใบลดหนี้ร่างในงวดนี้ และตรวจว่า PR / PO ค้างไม่อยู่ในตัวขวาง Start

> **As a** any authenticated user, **I want** this Period Close Out Of Period Docs interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

Login เป็น Admin (gmail); งวดปัจจุบันของ BU = งวดของ scenario; มี GRN ฐาน grnA ที่ commit แล้ว (910); รอบนับยังไม่เริ่ม

**Steps**

1. Credit Note → New · GRN = grnA · Doc Date = วันที่ในงวดนี้ (cnDraftIn.date) · สินค้า cnDraftIn คืน 1 → Create (ไม่ Submit)
2. อ่านสถานะใบสดจาก API แล้วเปิดใบ
3. GET period-ends/review: หา PR/PO ที่ค้างในงวดจาก details.transaction
4. มี PR/PO ค้างจริง: เปิด Period End → Review ถ่ายภาพ · ไม่มี: เปิด Purchase Order → New และ Purchase Request → New ดูว่าสร้างได้ไหม

**Expected**

CN มีสถานะ draft (เปิดค้างไว้ให้ TC-PE-440007 ตรวจว่าไม่ขวาง); start_blocking ไม่มีชนิด pr / po ไม่ว่าจะมี PR/PO ค้างอยู่จริงหรือไม่

> _Note: เดิม 2.5 และ 2.5-PRPO (_movement_play specs/20-case2) · ตามโค้ด CN ร่างไม่ขวางทั้งสองด่าน และ validatePeriodEnd ตัด PR/PO ออกโดยตั้งใจ · 2.5-PRPO เป็น N/A เมื่อไม่มี PR/PO ค้าง (admin ไม่อยู่ใน approval flow ของ PR/PO → Permission Denied) — พอร์ต assert ข้อเท็จจริงว่า start_blocking ไม่นับ pr/po ในทั้งสองกรณี · CN ร่างนี้ phase ถัดไปใช้ต่อ (state key cnDraftIn)_

---

## TC-PE-440007 — ตรวจความพร้อมก่อนกด Start Period Close: เอกสารนอกงวดและ CN ร่างต้องไม่ขวาง (ไม่กด Start)

> **As a** any authenticated user, **I want** this Period Close Out Of Period Docs behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Happy Path

**Preconditions**

TC-PE-440001 / 440002 / 440006 ผ่านแล้ว (serial) — มี GRN saved และ GRN ร่างลงวันที่งวดถัดไป และ CN ร่างในงวดนี้; ไม่มีเอกสารค้างอื่นในงวด; รอบนับยังไม่เริ่ม

**Steps**

1. GET period-ends/review
2. เปิด Period End → Review ถ่ายภาพ
3. เปิด Period End ดูปุ่ม Start Period Close (ไม่กด — POST start-counting ถูกตัดทิ้งทุก test)

**Expected**

can_start_counting = true และ start_blocking.total = 0; ปุ่ม Start Period Close กดได้ (enabled)

> _Note: เดิม 2.6-ready (_movement_play specs/20-case2) · หยุดก่อนกด Start — การกด Start จริง (ย้อนกลับไม่ได้) อยู่ใน phase ถัดไป (918) และรันเฉพาะเมื่อ BU ยังอยู่ที่งวดของ scenario · ทับซ้อน TC-PE-310001 (ทุก transaction post แล้ว → ผ่านด่าน)_

---


<sub>Last regenerated: 2026-11-24 · git 13584e4</sub>
