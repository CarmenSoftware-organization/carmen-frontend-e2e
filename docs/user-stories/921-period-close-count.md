# Period Close Count — User Stories

_Generated from `tests/921-period-close-count.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Period Close Count
**Spec:** `tests/921-period-close-count.spec.ts`
**Default role:** any authenticated
**Total test cases:** 1 (1 High / 0 Medium / 0 Low)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-PE-510001 | นับทุกคลังผ่านหน้าจอแล้ว submit ใบนับ คลังทดสอบราคานับเกินและขาดตามที่ตั้ง คลังอื่นนับเท่ายอดระบบ | High | Functional |

---

## TC-PE-510001 — นับทุกคลังผ่านหน้าจอแล้ว submit ใบนับ คลังทดสอบราคานับเกินและขาดตามที่ตั้ง คลังอื่นนับเท่ายอดระบบ

> **As a** any authenticated user, **I want** this Period Close Count interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

Login เป็น Admin (gmail) บน BU ของ scenario; E2E_PERIOD_BU, E2E_DB_URL ตั้งไว้ และงวด active ของ TEST BU = งวดของ scenario; งวดที่ทดสอบยังเป็นงวดปัจจุบัน รอบนับอยู่สถานะ counting; TC-PE-500001 รันแล้วและเอกสารของมันยังค้างอยู่

**Steps**

1. อ่านรายการคลังที่ต้องนับจาก /period-ends/review (คลังทดสอบราคา คลัง L ไว้ท้ายสุด; E2E_PERIOD_LOC จำกัดได้)
2. ต่อคลัง: คิดยอดที่ใบนับใช้เทียบ (cost layer ของงวดที่นับ) — คลัง L ตั้ง P1/P2/P3 เกิน +2 และ P4 ขาด −2 คลังอื่นนับเท่ายอดระบบ (ยอดติดลบนับเป็น 0)
3. Period End → Review → กดการ์ดคลัง → กรอกยอดทีละสินค้าผ่านช่องค้นหา
4. กด Submit for Review แล้ว Submit
5. อ่านแถวของใบนับ (ยอดระบบ / ยอดนับ / ส่วนต่าง) จากฐานข้อมูล

**Expected**

ทุกคลังที่นับ: ใบนับสถานะ completed และ diff_qty ของทุกสินค้าตรงกับที่ตั้ง — คลัง L ส่วนต่าง P1/P2/P3 = +2, P4 = −2 ตัวอื่น 0 · คลังอื่นส่วนต่าง 0 (ยกเว้นยอดระบบติดลบที่นับเป็น 0)

> _Note: [IRREVERSIBLE] submit ใบนับแล้วเป็น completed ย้อนไม่ได้ — ต้นฉบับไม่ได้กั้น port นี้ skip ถ้างวด active ของ BU ไม่ใช่งวดของ scenario · เดิม 2.7 (_movement_play specs/40-count) ซึ่งสร้างหนึ่ง test ต่อคลังด้วยชื่อแบบ dynamic — port รวมเป็น test เดียววน test.step ต่อคลัง หลักฐาน 2.7-<รหัสคลัง> เหมือนเดิม · ต้นฉบับ hardcode รายชื่อ 13 คลังของ BU เดิม — port อ่านจาก review.details.physical_count · ส่วนต่างที่ผิดใช้ expect.soft เพื่อให้นับคลังที่เหลือต่อ (ต้นฉบับแยก test ต่อคลังจึงล้มทีละคลัง) รันซ้ำข้ามคลังที่ completed แล้ว · ซ้อนกับ TC-PE-330001 ใน 900-period-end ซึ่งเป็น skip ว่าง · รอบล่าสุด p11-r4 / avg2607-r4 (2026-10-02) PASS ทุกคลัง_

---


<sub>Last regenerated: 2026-11-24 · git 13584e4</sub>
