# Period Close Fix Guards — User Stories

_Generated from `tests/916-period-close-fix-guards.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Period Close Fix Guards
**Spec:** `tests/916-period-close-fix-guards.spec.ts`
**Default role:** any authenticated
**Total test cases:** 4 (2 High / 2 Medium / 0 Low)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-PE-460001 | เลขใบลดหนี้ใหม่ต้องไม่ซ้ำกับใบร่างที่ลบไปแล้ว (#712) | Medium | Functional |
| TC-PE-460002 | void GRN ที่ของถูกจ่ายออกไปแล้วต้องถูกปฏิเสธและคลังไม่ติดลบ (#713) | High | Negative |
| TC-PE-460003 | toast เมื่อ void GRN ถูกปฏิเสธต้องบอกเหตุผลจริงว่าของถูกเบิกไปแล้ว | Medium | Negative |
| TC-PE-460004 | ใบลดหนี้คืนของเกินยอดคลังจริงต้องถูกปฏิเสธ 422 และคลังไม่ติดลบ (backend 490fc9ee1 แทน #713) | High | Edge Case |

---

## TC-PE-460001 — เลขใบลดหนี้ใหม่ต้องไม่ซ้ำกับใบร่างที่ลบไปแล้ว (#712)

> **As a** any authenticated user, **I want** this Period Close Fix Guards interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

E2E_PERIOD_BU เป็น TEST BU แบบ average; Login เป็น Admin (gmail, project setup); phase 910 (เดิม 00-prestep) สร้าง grnA ไว้ใน state.json; ยังไม่กด Start Period Close

**Steps**

1. สร้างใบลดหนี้ร่างอ้าง grnA คืน P1 1 (Tax Invoice E2E-712-A) → ได้เลขใบแรก
2. เปิดใบ → Edit → Delete → ยืนยัน
3. สร้างใบลดหนี้ร่างใบใหม่แบบเดียวกัน (Tax Invoice E2E-712-B) → ได้เลขใบที่สอง
4. ลบใบที่สองทิ้ง (เก็บกวาด)
5. นับแถวใน tb_credit_note (รวมที่ลบแล้ว) ที่ใช้เลขใบที่สอง

**Expected**

เลขใบที่สองไม่เท่ากับเลขใบแรก และมีแถวใน tb_credit_note ที่ใช้เลขนั้นเพียง 1 แถว (ก่อน #712 จะได้เลขเดิมซ้ำ เพราะการหาเลขล่าสุดมองไม่เห็นใบที่ลบ)

> _Note: เดิม 4.1 (_movement_play specs/23-fix-guards) · พิสูจน์ backend PR #712 · ผลล่าสุด avg2605-r2 2026-10-02 PASS · เดิมยืนยันแค่เลขไม่ซ้ำ — เพิ่มการยืนยันจำนวนแถวที่ใช้เลขเดียวกัน (= 1) ให้ตรงกับ verdict ใน results.json_

---

## TC-PE-460002 — void GRN ที่ของถูกจ่ายออกไปแล้วต้องถูกปฏิเสธและคลังไม่ติดลบ (#713)

> **As a** any authenticated user, **I want** this Period Close Fix Guards behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

E2E_PERIOD_BU เป็น TEST BU แบบ average; Login เป็น Admin (gmail, project setup); คลัง L มี E2E-PC-1 จากงวดก่อน ๆ (ล็อตเก่าที่ปิดงวดแล้ว); ยังไม่กด Start Period Close; รันซ้ำต้องตั้ง E2E_PERIOD_K42 ชุดใหม่

**Steps**

1. สร้าง GRN แบบ saved ที่คลัง L: E2E-PC-1 10 @150 (AVG ลงสต๊อกตอน save) → จดล็อตของใบ
2. สร้าง Stock Out (completed) จ่าย E2E-PC-1 จนยอดหยิบได้เหลือ 3 → จด parent_lot_no ที่ถูกผูก
3. เปิด GRN → Void → ใส่เหตุผล → ยืนยัน แล้วดักคำตอบของ POST …/void
4. อ่านสถานะใบและยอดหยิบได้ของคลังหลังลอง void
5. ถ้าใบยัง saved: Commit ทิ้งไว้ (ใบ saved ขวางการเริ่มนับ)

**Expected**

หลังบ้านตอบ 409 GRN_RECEIPT_ALREADY_CONSUMED, ใบยังเป็น saved, ยอดหยิบได้ไม่ติดลบ และ Stock Out ผูก parent กับล็อตเก่า ไม่ใช่ล็อตของ GRN นี้ (ก่อน #713 จะ void ผ่านแล้วคลังเหลือ −7)

> _Note: เดิม 4.2 (_movement_play specs/23-fix-guards) · พิสูจน์ backend PR #713 · ผลล่าสุด avg2605-r2 2026-10-02 PASS · เดิมยืนยันแค่สถานะ saved + ยอดไม่ติดลบ — เพิ่มการยืนยัน 409 + รหัส GRN_RECEIPT_ALREADY_CONSUMED และล็อตที่ถูกผูกให้ตรงกับ verdict · ขัดกับ TC-GRN-120001/120003 (501-grn) ที่คาดว่า Void สำเร็จและคืนสต๊อก — นั่นคือใบที่ของยังไม่ถูกจ่าย · บันทึกแถว 4.2-msg ไว้ในเคสนี้ด้วย (ตรวจใน TC-PE-460003)_

---

## TC-PE-460003 — toast เมื่อ void GRN ถูกปฏิเสธต้องบอกเหตุผลจริงว่าของถูกเบิกไปแล้ว

> **As a** any authenticated user, **I want** this Period Close Fix Guards behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Negative

**Preconditions**

TC-PE-460002 ผ่านแล้วในรอบเดียวกัน (serial) — กด Void แล้วหลังบ้านตอบ 409 GRN_RECEIPT_ALREADY_CONSUMED และเก็บ toast ไว้

**Steps**

1. อ่าน toast ที่ขึ้นหลังกด Void ใน TC-PE-460002
2. ตรวจว่าไม่ใช่ข้อความกลางของ 409

**Expected**

toast บอกเหตุผลจริงว่าของที่รับเข้าใบนี้ถูกเบิกออกไปแล้วจึงยกเลิกไม่ได้ — ไม่ใช่ "Someone else changed this document. Refresh the page and try again." / "มีคนแก้ใบนี้"

> _Note: เดิม 4.2-msg (_movement_play specs/23-fix-guards) · บั๊กที่รู้อยู่ (เคยเป็น test.fail — ถอดแล้ว 2026-11-24 เพราะผ่านจริงบน BU-GR2VYNKQ หลัง FE #216): ผลล่าสุดเดิม avg2605-r2 2026-10-02T06:47Z FAIL — FE ไม่มีข้อความของรหัส GRN_RECEIPT_ALREADY_CONSUMED จึงตกไปข้อความกลางของ 409 · FE PR #216 (merge 2026-10-02 ราว 10:05Z หลังหลักฐานล่าสุด) เพิ่มข้อความแล้ว — แถว results.json ยังบันทึกใน TC-PE-460002 ตามเดิม_

---

## TC-PE-460004 — ใบลดหนี้คืนของเกินยอดคลังจริงต้องถูกปฏิเสธ 422 และคลังไม่ติดลบ (backend 490fc9ee1 แทน #713)

> **As a** any authenticated user, **I want** this Period Close Fix Guards behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Edge Case

**Preconditions**

E2E_PERIOD_BU เป็น TEST BU แบบ average; Login เป็น Admin (gmail, project setup); คลัง L มี E2E-PC-2 จากงวดก่อน ๆ; ยังไม่กด Start Period Close; ใช้ evidence folder ใหม่ (รันซ้ำจะใช้ใบเดิมจาก state.json)

**Steps**

1. สร้าง GRN committed ที่คลัง L: E2E-PC-2 10 @290
2. สร้าง Stock Out (completed) จ่าย E2E-PC-2 จนยอดหยิบได้เหลือ 2
3. สร้างใบลดหนี้อ้าง GRN นั้น คืน E2E-PC-2 10 → Create (ถูกปฏิเสธ)
4. อ่าน cost layer ของใบลดหนี้ (ตัดไปเท่าไร, note shortfall) และยอดหยิบได้หลัง CN

**Expected**

สร้างใบลดหนี้คืน 10 ขณะที่เหลือจริง 2 แล้วหลังบ้านตอบ 422 CREDIT_NOTE_INSUFFICIENT_STOCK (on_hand 2, requested 10) ไม่มีใบลดหนี้ถูกสร้าง และยอดหยิบได้ของคลังยังเท่าเดิม ไม่ติดลบ

> _Note: เดิม 4.3 (_movement_play specs/23-fix-guards) พิสูจน์ PR #713 ที่ให้ CN ตัดเท่าที่มี — backend 490fc9ee1 (2026-10-07) มาแทน #713 แล้ว เคสนี้จึงยืนยันกติกาใหม่: CN คืนเกินยอดคลังถูกปฏิเสธ 422 CREDIT_NOTE_INSUFFICIENT_STOCK · ไม่มีใบลดหนี้ถูกสร้าง · ยอดคลังเท่าเดิมและไม่ติดลบ · รันซ้ำในโฟลเดอร์เดิมคำนวณยอดก่อน CN ใหม่ไม่ได้ ทั้ง results.json และเคสจะเป็น FAIL_

---


<sub>Last regenerated: 2026-11-24 · git 60aa365</sub>
