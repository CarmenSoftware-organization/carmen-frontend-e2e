# Period Close Close — User Stories

_Generated from `tests/924-period-close-close.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Period Close Close
**Spec:** `tests/924-period-close-close.spec.ts`
**Default role:** any authenticated
**Total test cases:** 2 (1 High / 1 Medium / 0 Low)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-PE-540001 | กด Close Period จริงแล้วงวดปัจจุบันเลื่อนเป็นงวดถัดไป และยอดยกไปตรงกับยอดคงเหลือ ณ สิ้นงวดทุกคลังและสินค้า | High | Happy Path |
| TC-PE-540002 | ใบรับและ Stock In ของงวดหน้าที่พักไว้ลงสต๊อกหลังแถวยกยอดตอนปิดงวด (#719 · AVG) | Medium | Functional |

---

## TC-PE-540001 — กด Close Period จริงแล้วงวดปัจจุบันเลื่อนเป็นงวดถัดไป และยอดยกไปตรงกับยอดคงเหลือ ณ สิ้นงวดทุกคลังและสินค้า

> **As a** any authenticated user, **I want** this Period Close Close behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Happy Path

**Preconditions**

Login เป็น Admin (gmail) บน BU ของ scenario; E2E_PERIOD_BU, E2E_DB_URL ตั้งไว้ และงวด active ของ TEST BU = งวดของ scenario; TC-PE-520004 ผ่านแล้ว (can_close = true, ปุ่ม Close Period กดได้) — หรือปิดงวดไปแล้วจากรอบก่อนและมี bf-before-close.json ในโฟลเดอร์หลักฐาน

**Steps**

1. ถ้างวดที่ทดสอบยังเป็นงวดปัจจุบัน: ตรวจ can_close แล้วเก็บยอดที่คาดว่าจะยกไปลง bf-before-close.json (FIFO: ยอดคงเหลือ at_period ไม่เกินงวด · AVG: สูตร processAverageClose)
2. Period End → Review → กด Close Period → ยืนยันใน dialog "Close this period?" รอ POST /period-ends
3. อ่าน /period-ends/current และเปิดหน้า Period End
4. เทียบยอดที่เก็บไว้กับ layer open_period ของงวดถัดไป ทีละคลัง/สินค้า

**Expected**

2.10: POST /period-ends ตอบสำเร็จ และ /period-ends/current = งวดถัดไป · 2.11: มีรายการที่คาดอย่างน้อยหนึ่งรายการ ทุกคลัง/สินค้าจำนวนและมูลค่าตรงกัน (AVG ต้นทุนต่อหน่วย = ค่าเฉลี่ยงวดด้วย) และไม่มีรายการ open_period เกินมา

> _Note: [IRREVERSIBLE] ปิดงวดจริง ย้อนไม่ได้ — skip ถ้างวด active ของ BU ไม่ใช่งวดของ scenario · รันซ้ำหลังปิดแล้วไม่กดซ้ำ ตรวจอย่างเดียว · เดิม 2.10 + 2.11 (_movement_play specs/50-close) · snapshot bf-before-close.json อยู่ใต้ EVIDENCE_DIR เหมือนต้นฉบับ · ต้นฉบับ 2.11 บันทึก FAIL แต่ assert แค่ว่ามีรายการ — port assert ไม่มีรายการไม่ตรงและไม่มีรายการเกินมา · 2.11 เคย FAIL ใน period09 (2026-10-01, BU เดิม) — รอบ p10-r3 / p11-r4 / avg2607-r4 (2026-10-02) PASS จึงไม่ใช่บั๊กที่รู้อยู่ · ซ้อนกับ TC-PE-040001 ใน 900-period-end ซึ่งเป็น skip ว่าง · ขัดกับ gap TC-PE-040104 (docs/test-cases/gaps/900-period-end-gap.md) ที่คาดว่าหลังปิดการ์ดงวดแสดงป้าย Closed และปุ่มถูก disable — ต้นฉบับ assert ว่า /period-ends/current เลื่อนเป็นงวดถัดไป (หลักฐานทุกรอบ: งวดปัจจุบันเลื่อน หน้า Period End แสดงงวดใหม่) port คงตามต้นฉบับ ต้องตกลงว่าแบบไหนถูกแล้วแก้ฝั่งใดฝั่งหนึ่ง_

---

## TC-PE-540002 — ใบรับและ Stock In ของงวดหน้าที่พักไว้ลงสต๊อกหลังแถวยกยอดตอนปิดงวด (#719 · AVG)

> **As a** any authenticated user, **I want** this Period Close Close interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

scenario ต้นทุนเฉลี่ย (AVG) เท่านั้น; ปิดงวดที่ทดสอบแล้ว (TC-PE-540001) — งวดปัจจุบัน = งวดถัดไป; state.json มี GRN งวดหน้า (keys.nextGrn) และ siNextHeld ที่สร้างไว้ก่อนเริ่มนับ; E2E_DB_URL ตั้งไว้

**Steps**

1. อ่านเวลาที่เกิดแถวยกยอด (open_period) ล่าสุดของงวดถัดไป
2. ต่อเอกสารที่พักไว้ (GRN งวดหน้า และ Stock In งวดหน้า): อ่าน cost layer ของใบนั้น — จำนวนแถว งวด ราคา และเวลาที่เกิด

**Expected**

พบเอกสารที่พักไว้ครบสองใบ · ทั้งสองใบมี cost layer แล้ว ลงงวดถัดไปเท่านั้น และเกิดไม่ก่อนแถวยกยอดล่าสุดของงวดถัดไป

> _Note: เดิม 5.5 (_movement_play specs/50-close) · กติกา #719 (PR #715 · #718 · #719) · อ่านอย่างเดียว — skip เองถ้าไม่ใช่ AVG หรือยังไม่ได้ปิดงวด · รอบล่าสุด avg2607-r4 (2026-10-02) PASS_

---


<sub>Last regenerated: 2026-11-24 · git 13584e4</sub>
