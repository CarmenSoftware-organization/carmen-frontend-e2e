# Period Close Start — User Stories

_Generated from `tests/918-period-close-start.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Period Close Start
**Spec:** `tests/918-period-close-start.spec.ts`
**Default role:** any authenticated
**Total test cases:** 1 (1 High / 0 Medium / 0 Low)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-PE-480001 | กด Start Period Close จริงขณะมีเอกสารนอกงวดและใบลดหนี้ร่างเปิดค้าง ต้องเริ่มนับได้ | High | Happy Path |

---

## TC-PE-480001 — กด Start Period Close จริงขณะมีเอกสารนอกงวดและใบลดหนี้ร่างเปิดค้าง ต้องเริ่มนับได้

> **As a** any authenticated user, **I want** this Period Close Start behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Happy Path

**Preconditions**

E2E_PERIOD_BU=<BU> เป็น TEST BU และงวด active ของ BU = งวดของ scenario (ไม่ใช่ = ข้าม); Login เป็น Admin (gmail, project setup); งวดปัจจุบันของ BU = งวดของ scenario; phase 910–917 ผ่านแล้ว (รวม TC-PE-440007 ตรวจความพร้อม) — review.start_blocking.total = 0 และรอบนับของงวดยังเป็น draft; เอกสารนอกงวด (GRN งวดหน้า saved/draft) และใบลดหนี้ร่างที่ phase ก่อนสร้างยังเปิดค้างอยู่ใน state.json

**Steps**

1. ตรวจ GET /period-ends/current = งวดของ scenario และ GET /period-ends/review: รอบนับเป็น draft, start_blocking.total = 0 (ถ้ารอบนับเป็น counting แล้ว จบโดยไม่กดซ้ำ)
2. เปิด /inventory-management/period-end
3. กด Start Period Close
4. กด Start Period Close ใน dialog ยืนยัน แล้วรอ POST /period-ends/start-counting
5. อ่าน toast และดูว่าหน้าพาไป /inventory-management/period-end/review
6. อ่าน review จาก API อีกครั้ง

**Expected**

POST start-counting ตอบ 2xx, toast "Counting started.", หน้าพาไป /inventory-management/period-end/review และ review.physical_count_period.status เปลี่ยน draft → counting — เอกสารนอกงวดและใบลดหนี้ร่างไม่ขวางการเริ่มนับ

> _Note: เดิม 2.6 (_movement_play specs/25-start) · ย้อนกลับไม่ได้: เปิดรอบนับของงวดจริง ทำได้เฉพาะบน TEST BU ที่รีเซ็ตด้วย data:reset ได้ · ผลล่าสุด PASS ทั้ง avg2607-r4 และ p11-r4 (2026-10-02) · เดิมรอหน้า review ด้วย .catch() — เปลี่ยนเป็น expect.soft บน URL เพื่อให้แถว 2.6 ใน results.json ยังถูกบันทึกหลังกดจริงแม้หน้าไม่พาไป review · กรณี Start ถูกขวาง (422) อยู่ใน 912 (เดิม 10-case1-start) · ตรวจความพร้อมแบบไม่กดอยู่ใน TC-PE-440007_

---


<sub>Last regenerated: 2026-11-24 · git 13584e4</sub>
