# Period Close Verify — User Stories

_Generated from `tests/922-period-close-verify.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Period Close Verify
**Spec:** `tests/922-period-close-verify.spec.ts`
**Default role:** any authenticated
**Total test cases:** 4 (3 High / 1 Medium / 0 Low)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-PE-520001 | ใบชดเชยจากการนับ EOP-IN และ EOP-OUT เกิดครบต่อคลังที่มีผลต่าง ลงวันที่สิ้นงวดและเลขไม่ซ้ำ | High | Functional |
| TC-PE-520002 | ราคาต่อหน่วยในใบชดเชยตรงกับกติกาต้นทุนของ scenario | High | Functional |
| TC-PE-520003 | ยอดระบบที่ใบนับใช้เทียบเท่ากับยอดคงเหลือ ณ สิ้นงวดที่นับทุกคลังและสินค้า | Medium | Edge Case |
| TC-PE-520004 | เคลียร์เอกสารที่ขวางหรือค้างแล้วงวดพร้อมปิด ปุ่ม Close Period กดได้โดยไม่กดปิดจริง | High | Functional |

---

## TC-PE-520001 — ใบชดเชยจากการนับ EOP-IN และ EOP-OUT เกิดครบต่อคลังที่มีผลต่าง ลงวันที่สิ้นงวดและเลขไม่ซ้ำ

> **As a** any authenticated user, **I want** this Period Close Verify interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

Login เป็น admin@carmen.com บน BU ของ scenario; E2E_PERIOD_SCENARIO และ E2E_DB_URL ตั้งไว้; TC-PE-510001 นับครบทุกคลังแล้ว (คลัง 1AG01 มีทั้งนับเกินและนับขาด); งวดที่ทดสอบยังเป็นงวดปัจจุบัน

**Steps**

1. หาใบ Stock In / Stock Out ที่ระบบสร้างจากการ submit ใบนับ (description "Physical Count Adjustment - Period <ปี-เดือน>")
2. เปิดหน้า Inventory Adjustment ของแต่ละใบ ดูว่าเลขใบแสดงอยู่
3. คิดใบที่ควรเกิดจากแถวใบนับที่ diff_qty ไม่เป็น 0: ต่อคลัง นับเกิน = SI หนึ่งใบ นับขาด = SO หนึ่งใบ
4. ตรวจเลขใบซ้ำในตาราง (รวมใบที่ลบ)

**Expected**

ชุดคลัง:ชนิดของใบที่เกิด = ชุดที่ควรเกิดพอดี · SI ใช้ adjustment type EOP-IN และ SO ใช้ EOP-OUT · ทุกใบสถานะ completed ลงวันที่สิ้นงวดที่นับ · เลขใบแต่ละเลขมีแถวเดียว

> _Note: เดิม 2.8 (_movement_play specs/45-verify) · หลักฐาน 2.8 (ภาพใบชดเชยถูกใช้ต่อใน 2.9) · อ่านอย่างเดียว · รอบล่าสุด p11-r4 / avg2607-r4 (2026-10-02) PASS_

---

## TC-PE-520002 — ราคาต่อหน่วยในใบชดเชยตรงกับกติกาต้นทุนของ scenario

> **As a** any authenticated user, **I want** this Period Close Verify interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

TC-PE-520001 รันแล้ว (ภาพใบชดเชย); ใบชดเชยของคลัง 1AG01 มีบรรทัดของสินค้าทุกตัวใน costCases ของ scenario; เอกสารรับเข้า/กับดักราคาของ pre-step และ TC-PE-500001 ยังอยู่; E2E_DB_URL ตั้งไว้

**Steps**

1. อ่านราคาต่อหน่วยบนบรรทัด SI ชดเชย (สินค้าที่นับเกิน) และ SO ชดเชย (สินค้าที่นับขาด) พร้อมต้นทุนที่บัญชีโพสต์ของบรรทัด SO
2. ต่อสินค้าใน costCases: คิดราคาที่คาด — ราคาตายตัวจากเอกสารรับเข้าที่กติกาเลือก, ค่าเฉลี่ยงวด (มูลค่า ÷ จำนวนรับเข้าทั้งงวดทุกคลัง รวมยอดยกมา ไม่รวมใบชดเชยรอบนี้) หรือ ต้นทุนที่บัญชีโพสต์
3. หาเอกสารต้นทางที่ราคาตรงกับที่ระบบให้ และ cost layer ที่ใบชดเชยลงบัญชี (แสดงในหลักฐาน)

**Expected**

ทุกสินค้าใน costCases: ราคาบนใบชดเชย = ราคาที่คาดตามกติกาของ scenario (เช่น ล็อตของ GRN ที่ void / GRN งวดหน้า / GRN draft ต้องไม่ถูกหยิบ) และมีบรรทัดครบทุกสินค้า

> _Note: เดิม 2.9-P1..P4 (_movement_play specs/45-verify) · ต้นฉบับบันทึก FAIL ลง results.json แต่ assert แค่ว่ามีบรรทัดครบ — port assert ราคาเท่าที่คาดทุกสินค้า · เคย FAIL ใน period03 / period04 (lookupLastReceiving / lookupLast หยิบ GRN void, GRN งวดหน้า, SI ร่าง) แก้แล้วด้วย PR #702 / #706 / #708 / #709 (สถานะ FIXED) · รอบล่าสุด p11-r4 / avg2607-r4 (2026-10-02) PASS ทุกตัว จึงไม่ใช่บั๊กที่รู้อยู่_

---

## TC-PE-520003 — ยอดระบบที่ใบนับใช้เทียบเท่ากับยอดคงเหลือ ณ สิ้นงวดที่นับทุกคลังและสินค้า

> **As a** any authenticated user, **I want** this Period Close Verify behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Edge Case

**Preconditions**

TC-PE-510001 นับครบแล้ว (ใบนับของงวดที่ทดสอบมี on_hand_qty ที่บันทึกตอนนับ); E2E_DB_URL ตั้งไว้

**Steps**

1. อ่าน on_hand_qty ทุกแถวของใบนับงวดที่ทดสอบ
2. คิดยอดคงเหลือ ณ สิ้นงวดจาก cost layer (at_period ไม่เกินงวดที่นับ ไม่รวมใบชดเชยของรอบนี้)
3. แถวที่ไม่เท่า แยกสาเหตุ: รายการของใบที่ void/ลบ, รายการงวดหลัง, qty ของรายการไม่ตรง cost layer

**Expected**

ไม่มีคลัง/สินค้าใดที่ยอดในใบนับต่างจากยอดคงเหลือ ณ สิ้นงวดที่นับ

> _Note: เดิม 2.7-onhand (_movement_play specs/45-verify) · ต้นฉบับไม่มี expect เลย (บันทึก FAIL ลง results.json แต่ test เขียว) — port assert ว่าไม่มีแถวที่ยอดไม่ตรง · เคย FAIL ใน period03–05 และ avg09 (นับรายการของใบที่ void และรายการงวดหลัง) แก้แล้วด้วย PR #705 (สถานะ FIXED) · รอบล่าสุด p11-r4 / avg2607-r4 (2026-10-02) PASS จึงไม่ใช่บั๊กที่รู้อยู่ · อ่านอย่างเดียว_

---

## TC-PE-520004 — เคลียร์เอกสารที่ขวางหรือค้างแล้วงวดพร้อมปิด ปุ่ม Close Period กดได้โดยไม่กดปิดจริง

> **As a** any authenticated user, **I want** this Period Close Verify interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

TC-PE-500001 สร้างเอกสาร closeGate ไว้ (จำใน state.json); TC-PE-510001 นับครบทุกคลังแล้ว; งวดที่ทดสอบยังเป็นงวดปัจจุบัน; POST /period-ends ถูกตัดทิ้งทั้งไฟล์

**Steps**

1. ต่อเอกสารใน closeGate: GRN saved → Void (หรือ Commit เมื่อ scenario กำหนด clear = commit เช่น AVG ที่ลงสต๊อกตั้งแต่ save) · GRN draft → ลบ · SI ร่าง → ลบ (ข้ามใบที่ทำแล้ว)
2. เปิด Period End → Review
3. อ่าน can_close / close_blocking จาก /period-ends/review และดูปุ่ม Close Period (ไม่กด)

**Expected**

close_blocking ทุกตัวเป็น 0 · can_close = true · ปุ่ม Close Period กดได้

> _Note: เดิม 2.10-ready (_movement_play specs/45-verify) · void/ลบเอกสาร closeGate จริง (ทำซ้ำได้ — ข้ามที่ทำแล้ว) แต่ไม่กดปิดงวด · ต้นฉบับ assert แค่ can_close — port assert ปุ่ม Close Period กดได้ด้วยตาม verdict · ซ้อนกับ TC-PE-030001 ใน 900-period-end ซึ่งเป็น skip ว่าง · รอบล่าสุด p11-r4 / avg2607-r4 (2026-10-02) PASS_

---


<sub>Last regenerated: 2026-11-24 · git f462816</sub>
