# Period Close Blockers — User Stories

_Generated from `tests/911-period-close-blockers.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Period Close Blockers
**Spec:** `tests/911-period-close-blockers.spec.ts`
**Default role:** any authenticated
**Total test cases:** 1 (1 High / 0 Medium / 0 Low)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-PE-410001 | SR และ SO ที่ค้างอยู่จริงในงวดขวาง Start Period Close แล้วเคลียร์ได้ (HOD reject SR · admin ลบ SO ร่าง) | High | Negative |

---

## TC-PE-410001 — SR และ SO ที่ค้างอยู่จริงในงวดขวาง Start Period Close แล้วเคลียร์ได้ (HOD reject SR · admin ลบ SO ร่าง)

> **As a** HOD user, **I want** this Period Close Blockers behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

TEST BU (E2E_PERIOD_BU) ไม่มีเอกสารค้าง — เคสสร้างเองผ่าน API: SO ร่างลงวันที่ในงวด + SR ที่ requestor (gmail) submit ค้างที่ขั้น HOD; Login เป็น Admin (gmail) และมี storageState ของ HOD (gmail) จาก project setup; รอบนับของงวดยังไม่เริ่ม; BU มี ≥ 2 คลัง inventory และ workflow SR ที่มีขั้น Issue

**Steps**

0. สร้างตัวขวางผ่าน API (createBlockers): SO ร่าง + SR submit ไปขั้น HOD (sr_date_pattern = open-period)
1. เปิดใบ SR ที่ค้าง (in_progress) ถ่ายภาพ
2. Period End → Start Period Close → ยืนยัน (POST start-counting ถูกดัก: ถ้าไม่มีตัวขวางจริงจะตัด request ทิ้ง)
3. ตรวจ dialog "Finish these documents first" แล้วกด Close
4. admin ลบ SO ร่างแต่ละใบ (Delete → ยืนยัน)
5. HOD (gmail) เปิด SR แต่ละใบ → Edit → เลือกทุกรายการ → Reject (กรอกเหตุผล) → Reject ทั้งใบ → ยืนยัน
6. GET period-ends/review

**Expected**

Start ถูกปฏิเสธ 422 และ dialog ลิสต์ SR/SO ทุกใบ; start_blocking.sr ก่อนกด = จำนวน SR ที่ค้าง; reject แล้ว SR มี doc_status = voided; หลังเคลียร์ start_blocking.total = 0

> _Note: เดิม 1.N1 (_movement_play specs/05-blockers) · ผลขั้นกด Start เก็บใน state (1.N1-start) รันซ้ำหลังเคลียร์ไปบางส่วนจะไม่เสียหลักฐานรอบแรก · ผ่านแล้วในรอบก่อน (results.json = PASS) → test.skip แทน return เงียบ ๆ · HOD เข้าระบบด้วย storageState จาก project setup แทน login ผ่านฟอร์ม · ตัวขวางสร้างผ่าน API เพราะ UI สร้าง SR ที่ลงวันที่งวดก่อนไม่ได้ · ทับซ้อน TC-PE-310005 (ชนิดเอกสารค้างหลายชนิด) · ย้อนกลับไม่ได้: ลบ/reject เอกสารจริง_

---


<sub>Last regenerated: 2026-11-24 · git 13584e4</sub>
