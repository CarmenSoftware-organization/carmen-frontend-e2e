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

scenario ระบุ preBlockers (เลข SR ที่รอ HOD อนุมัติ + SO ร่าง ที่ค้างอยู่จริงบน BU — ตอนนี้ยังไม่มี scenario ไหนระบุ จึงถูกข้าม); Login เป็น admin@carmen.com และมี storageState ของ hod@carmen.com (movement-setup); รอบนับของงวดยังไม่เริ่ม

**Steps**

1. เปิดใบ SR ที่ค้าง (in_progress) ถ่ายภาพ
2. Period End → Start Period Close → ยืนยัน (POST start-counting ถูกดัก: ถ้าไม่มีตัวขวางจริงจะตัด request ทิ้ง)
3. ตรวจ dialog "Finish these documents first" แล้วกด Close
4. admin ลบ SO ร่างแต่ละใบ (Delete → ยืนยัน)
5. hod@carmen.com เปิด SR แต่ละใบ → Edit → เลือกทุกรายการ → Reject (กรอกเหตุผล) → Reject ทั้งใบ → ยืนยัน
6. GET period-ends/review

**Expected**

Start ถูกปฏิเสธ 422 และ dialog ลิสต์ SR/SO ทุกใบ; start_blocking.sr ก่อนกด = จำนวน SR ที่ค้าง; reject แล้ว SR มี doc_status = voided; หลังเคลียร์ start_blocking.total = 0

> _Note: เดิม 1.N1 (_movement_play specs/05-blockers) · ผลขั้นกด Start เก็บใน state (1.N1-start) รันซ้ำหลังเคลียร์ไปบางส่วนจะไม่เสียหลักฐานรอบแรก · ผ่านแล้วในรอบก่อน (results.json = PASS) → test.skip แทน return เงียบ ๆ · HOD เข้าระบบด้วย storageState จาก movement-setup แทน login ผ่านฟอร์ม · ทับซ้อน TC-PE-310005 (ชนิดเอกสารค้างหลายชนิด) · ย้อนกลับไม่ได้: ลบ/reject เอกสารจริง_

---


<sub>Last regenerated: 2026-11-24 · git f462816</sub>
