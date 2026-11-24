# Period End — User Stories

_Generated from `tests/900-period-end.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Period End
**Spec:** `tests/900-period-end.spec.ts`
**Default role:** Admin
**Total test cases:** 19 (14 High / 5 Medium / 0 Low)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-PE-010001 | Happy Path - View Current Period | High | Happy Path |
| TC-PE-010002 | Negative - User Without Permission | High | Negative |
| TC-PE-010003 | Edge Case - Empty Period History | Medium | Edge Case |
| TC-PE-010004 | Negative - No Current Period | High | Negative |
| TC-PE-010005 | Edge Case - Closed Current Period | Medium | Edge Case |
| TC-PE-020001 | View period detail for open period | High | Happy Path |
| TC-PE-020003 | View period detail with no permission | High | Negative |
| TC-PE-020005 | View period detail for period with incomplete validation | Medium | Edge Case |
| TC-PE-030001 | Happy Path - Close Period enabled when nothing blocks closing | High | Happy Path |
| TC-PE-030005 | Edge Case - Close Period disabled while counts and documents are outstanding | High | Edge Case |
| TC-PE-040004 | Close Period - Server Error | High | Edge Case |
| TC-PE-040005 | Close Period - Validation No Longer Passes | High | Negative |
| TC-PE-310001 | All transactions posted | High | Happy Path |
| TC-PE-310002 | Missing GRN document | High | Negative |
| TC-PE-330001 | All Physical Counts Finalized Successfully | High | Happy Path |
| TC-PE-330002 | Review with No Physical Counts | Medium | Edge Case |
| TC-PE-330004 | Physical Count Status Not Finalized | High | Negative |
| TC-PE-340001 | Happy Path - Log Activity Entry | High | Happy Path |
| TC-PE-340006 | Activity Monitor กรอง Record Type = Period ได้ | Medium | Functional |

---

## TC-PE-010001 — Happy Path - View Current Period

> **As a** Admin user, **I want** this Period End behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Happy Path

**Preconditions**

Login เป็น carmensoftware.dev+purchase@gmail.com และมี period view permission

**Steps**

1. ไปที่ /inventory-management/period-end
2. กด 'View Details'

**Expected**

ผู้ใช้ถูกนำทางไปยังหน้า period detail

---

## TC-PE-010002 — Negative - User Without Permission

> **As a** Admin user, **I want** this Period End behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

Login เป็น carmensoftware.dev+requestor@gmail.com แต่ไม่มี period view permission

**Steps**

1. ไปที่ /inventory-management/period-end

**Expected**

แสดง Permission Denied ทับหน้า (ไม่ redirect) และไม่มีปุ่ม Start Period Close

---

## TC-PE-010003 — Edge Case - Empty Period History

> **As a** Admin user, **I want** this Period End behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Edge Case

**Preconditions**

ผู้ใช้มี period view permission และไม่มี periods ใน history

**Steps**

1. จำลองหลังบ้านตอบรายการ period history ว่าง (page.route)
2. ไปที่ /inventory-management/period-end

**Expected**

ส่วน History แสดง 'No closed periods yet.' และ current period card ยังคง visible

---

## TC-PE-010004 — Negative - No Current Period

> **As a** Admin user, **I want** this Period End behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

ผู้ใช้มี period view permission และไม่มี current period

**Steps**

1. จำลองหลังบ้านตอบ /period-ends/current เป็น 404 (page.route)
2. ไปที่ /inventory-management/period-end

**Expected**

แสดงข้อความ 'No current period end found.' ไม่มี current period card และไม่มีปุ่ม Start Period Close ส่วน History ยังแสดง

---

## TC-PE-010005 — Edge Case - Closed Current Period

> **As a** Admin user, **I want** this Period End behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Edge Case

**Preconditions**

ผู้ใช้มี period view permission และ current period ถูกปิดแล้ว

**Steps**

1. จำลองหลังบ้านตอบ current period สถานะ closed (page.route)
2. ไปที่ /inventory-management/period-end

**Expected**

Current period card แสดงสถานะ Closed และปุ่ม Start Period Close ถูก disable

---

## TC-PE-020001 — View period detail for open period

> **As a** Admin user, **I want** this Period End behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Happy Path

**Preconditions**

Login เป็น carmensoftware.dev+purchase@gmail.com และมี period view permission และมี open period อยู่

**Steps**

1. ไปที่ /inventory-management/period-end/review

**Expected**

หน้า Period Close Review แสดงหัวข้อ Transactions, Physical Count และปุ่ม Close Period

> _Note: เดิมเป็นหน้า /period-end/[id] (ไม่มีใน FE) — ย้ายมาตรวจหน้า review ซึ่งเป็นหน้ารายละเอียดของงวดปัจจุบัน_

---

## TC-PE-020003 — View period detail with no permission

> **As a** Admin user, **I want** this Period End behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

Login เป็น carmensoftware.dev+requestor@gmail.com แต่ไม่มี period view permission

**Steps**

1. ไปที่ /inventory-management/period-end/review

**Expected**

แสดง Permission Denied (ไม่ redirect) และไม่มีปุ่ม Close Period

---

## TC-PE-020005 — View period detail for period with incomplete validation

> **As a** Admin user, **I want** this Period End behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Edge Case

**Preconditions**

Login เป็น carmensoftware.dev+purchase@gmail.com และมี period view permission และมีเอกสาร GRN ค้าง (จำลองคำตอบ review)

**Steps**

1. จำลอง /period-ends/review ให้ GRN ค้าง 3 ใบ
2. ไปที่ /inventory-management/period-end/review

**Expected**

แสดง '3 document(s) block closing' แถว Goods Receive Notes แสดง '3 pending' และปุ่ม Close Period ถูก disable

---

## TC-PE-030001 — Happy Path - Close Period enabled when nothing blocks closing

> **As a** Admin user, **I want** this Period End behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Happy Path

**Preconditions**

Login เป็น carmensoftware.dev+purchase@gmail.com และมี period view permission และ backend รายงาน can_close = true (จำลองคำตอบ review)

**Steps**

1. จำลอง /period-ends/review ให้ทุกโมดูลครบและ can_close = true
2. ไปที่ /inventory-management/period-end/review

**Expected**

แสดง 'Nothing here blocks closing' และปุ่ม Close Period ถูก enable

> _Note: เดิม Validate All แล้วปุ่ม Close enable — FE ไม่มีปุ่ม Validate All ปุ่ม Close ขึ้นกับ can_close จาก backend_

---

## TC-PE-030005 — Edge Case - Close Period disabled while counts and documents are outstanding

> **As a** Admin user, **I want** this Period End behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Edge Case

**Preconditions**

Login เป็น carmensoftware.dev+purchase@gmail.com และมี period view permission

**Steps**

1. จำลอง /period-ends/review ให้ can_close = false (GRN ค้าง, ยังไม่นับ)
2. ไปที่ /inventory-management/period-end/review

**Expected**

ปุ่ม Close Period ถูก disable และ tooltip บอกว่าต้องทำรายการและนับให้ครบก่อนปิด

---

## TC-PE-040004 — Close Period - Server Error

> **As a** Admin user, **I want** this Period End behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Edge Case

**Preconditions**

Login เป็น carmensoftware.dev+purchase@gmail.com และมี period view permission และ backend รายงาน can_close = true (จำลอง)

**Steps**

1. จำลอง review ให้ปิดได้ และ POST /period-ends ตอบ 500
2. ไปหน้า review กด Close Period แล้วยืนยัน

**Expected**

ไม่แสดง 'Period closed successfully.' และยังอยู่หน้า review (ไม่ redirect)

---

## TC-PE-040005 — Close Period - Validation No Longer Passes

> **As a** Admin user, **I want** this Period End behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

Login เป็น carmensoftware.dev+purchase@gmail.com และมี period view permission และ review รายงาน can_close = true แต่ POST ปฏิเสธ (จำลอง)

**Steps**

1. จำลอง review ให้ปิดได้ แต่ POST /period-ends ตอบ 422
2. ไปหน้า review กด Close Period แล้วยืนยัน

**Expected**

ไม่แสดง 'Period closed successfully.' และยังอยู่หน้า review

---

## TC-PE-310001 — All transactions posted

> **As a** Admin user, **I want** this Period End behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Happy Path

**Preconditions**

Login เป็น carmensoftware.dev+purchase@gmail.com และมี period view permission และทุกโมดูลมีเอกสารครบ (จำลองคำตอบ review)

**Steps**

1. จำลอง /period-ends/review ให้ทุกโมดูลเสร็จครบ
2. ไปที่ /inventory-management/period-end/review

**Expected**

แถว GRN, Stock In, Stock Out, SR, CN แสดง 'Complete' และสรุป 'Nothing here blocks closing'

---

## TC-PE-310002 — Missing GRN document

> **As a** Admin user, **I want** this Period End behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

Login เป็น carmensoftware.dev+purchase@gmail.com และมี period view permission และมี GRN ค้าง 2 ใบ (จำลอง)

**Steps**

1. จำลอง review ให้ GRN ค้าง 2 ใบ
2. ไปที่ /inventory-management/period-end/review

**Expected**

แถว Goods Receive Notes แสดง '2 pending' แถวอื่นยัง Complete และ Close Period ถูก disable

---

## TC-PE-330001 — All Physical Counts Finalized Successfully

> **As a** Admin user, **I want** this Period End behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Happy Path

**Preconditions**

Login เป็น carmensoftware.dev+purchase@gmail.com และมี period view permission และทุกคลังนับเสร็จ (จำลอง)

**Steps**

1. จำลอง review ให้ 2 คลังนับเสร็จ
2. ไปที่ /inventory-management/period-end/review

**Expected**

ส่วน Physical Count แสดง '2 of 2 completed'

---

## TC-PE-330002 — Review with No Physical Counts

> **As a** Admin user, **I want** this Period End behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Edge Case

**Preconditions**

Login เป็น carmensoftware.dev+purchase@gmail.com และมี period view permission

**Steps**

1. จำลอง review ให้ไม่มีคลังที่ต้องนับ
2. ไปที่ /inventory-management/period-end/review

**Expected**

แสดง 'No physical counts in this period.'

---

## TC-PE-330004 — Physical Count Status Not Finalized

> **As a** Admin user, **I want** this Period End behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

Login เป็น carmensoftware.dev+purchase@gmail.com และมี period view permission และมีคลังที่ยังนับไม่เสร็จ (จำลอง)

**Steps**

1. จำลอง review ให้ 1 จาก 2 คลังนับเสร็จ
2. ไปที่ /inventory-management/period-end/review

**Expected**

แสดง '1 of 2 completed'

---

## TC-PE-340001 — Happy Path - Log Activity Entry

> **As a** Admin user, **I want** this Period End behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Happy Path

**Preconditions**

ปิดงวดจริงแล้วด้วย phase 924 (TC-PE-540001) และตั้ง E2E_ALLOW_IRREVERSIBLE=<BU>:<งวด> ของงวดที่ปิด

**Steps**

1. อ่าน /api/<BU>/activity-logs?entity_type=period เรียงใหม่สุดก่อน
2. หาแถวของงวดที่ปิด

**Expected**

มี activity entry entity_type=period ของงวดนั้นที่ new_data.status = closed พร้อม actor_id

> _Note: ต้องมีการปิดงวดจริง (ย้อนกลับไม่ได้) จึงกั้นเหมือน 924 — ไม่ปิดงวดเองในเคสนี้ ส่วนตัวกรอง Period ตรวจใน TC-PE-340006_

---

## TC-PE-340006 — Activity Monitor กรอง Record Type = Period ได้

> **As a** Admin user, **I want** to filter the Period End list, **so that** I can narrow results to relevant records.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com ที่เปิด Activity Monitor ได้

**Steps**

1. ไปที่ /system-admin/activity-log
2. กด Filter แล้วเลือก Record Type = Period

**Expected**

request ส่ง entity_type=period ตอบ 200 ทุกแถวที่ได้เป็น entity_type period และตัวกรองแสดง Record Type = period

> _Note: ส่วนที่ย้อนกลับได้ของ TC-PE-340001 (ต้องปิดงวดจริง) — อ่านอย่างเดียว ไม่ปิดงวด_

---


<sub>Last regenerated: 2026-11-24 · git f462816</sub>
