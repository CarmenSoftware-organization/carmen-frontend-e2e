# Period Close Close Gate — User Stories

_Generated from `tests/920-period-close-close-gate.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Period Close Close Gate
**Spec:** `tests/920-period-close-close-gate.spec.ts`
**Default role:** any authenticated
**Total test cases:** 1 (1 High / 0 Medium / 0 Low)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-PE-500001 | เอกสารที่เกิดระหว่างช่วงนับ: GRN saved และคลังที่ยังไม่นับขวางการปิดงวด ส่วนเอกสารร่างไม่ขวาง | High | Functional |

---

## TC-PE-500001 — เอกสารที่เกิดระหว่างช่วงนับ: GRN saved และคลังที่ยังไม่นับขวางการปิดงวด ส่วนเอกสารร่างไม่ขวาง

> **As a** any authenticated user, **I want** this Period Close Close Gate interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

Login เป็น Admin (gmail, project setup) บน BU ของ scenario; E2E_PERIOD_BU และ E2E_DB_URL ตั้งไว้; งวดที่ทดสอบยังเป็นงวดปัจจุบัน และรอบนับอยู่สถานะ counting (กด Start Period Close แล้ว); ยังนับไม่ครบทุกคลัง

**Steps**

1. สร้างเอกสารตาม closeGate ของ scenario ผ่านหน้าจอ ลงวันที่ในงวด: GRN กด Create (saved), GRN กด Save Draft, Stock In กด Save (ร่าง) — รันซ้ำใช้ใบเดิมจาก state.json
2. เปิดหน้าเอกสารแต่ละใบเก็บภาพ
3. เปิด Period End → Review
4. อ่าน close_blocking / can_close จาก /period-ends/review และดูปุ่ม Close Period

**Expected**

1.6: close_blocking.grn = จำนวน GRN saved ที่สร้าง และปุ่ม Close Period กดไม่ได้ · 1.7: close_blocking.physical_count = จำนวนคลังที่ยังไม่ completed (มากกว่า 0) และ can_close = false · 1.8: GRN draft และ SI ร่างไม่ถูกนับ — close_blocking.grn มาจาก GRN saved เท่านั้น และ close_blocking.stock_in = 0

> _Note: เดิม 1.6–1.8 (_movement_play specs/30-case1-close) · หลักฐาน 1.6 / 1.7 / 1.8 · สร้างเอกสารจริง ต้องค้างไว้ถึง TC-PE-520004 (void/ลบก่อนปิด) · ต้นฉบับ assert แค่ close_blocking.grn — port นี้ assert ครบตาม verdict ทั้งสามข้อ (ปุ่ม Close กดไม่ได้, จำนวนคลังที่ยังไม่นับ, ร่างไม่ขวาง) · ต้นฉบับใช้เลข 13 คลังตายตัวใน 1.7 — port นับจาก review.details.physical_count (คลังที่ physical_count_type = yes ที่ยังไม่ completed) · 1.8 เป็น INFO (ข้อค้นพบ: ร่างที่ลงวันที่ในงวดไม่ขวางการปิด) — assert ข้อเท็จจริงนั้นแทน · ซ้อนกับ TC-PE-310002 ใน 900-period-end ซึ่งเป็น skip ว่าง · รอบล่าสุด p11-r4 / avg2607-r4 (2026-10-02) 1.6 และ 1.7 PASS, 1.8 INFO_

---


<sub>Last regenerated: 2026-11-24 · git 60aa365</sub>
