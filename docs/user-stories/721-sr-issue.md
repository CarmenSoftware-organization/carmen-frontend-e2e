# Sr Issue — User Stories

_Generated from `tests/721-sr-issue.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Sr Issue
**Spec:** `tests/721-sr-issue.spec.ts`
**Default role:** any authenticated
**Total test cases:** 4 (1 High / 1 Medium / 2 Low)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-SI-700005 | Requestor Submit ใบใหม่ตอนวันนี้อยู่ในงวดที่สร้างล่วงหน้า ระบบยังต้องถามวันที่ | Medium | Edge Case |
| TC-SI-710005 | Requestor สร้างใบเบิกใบที่สองแล้ว Submit | Low | Functional |
| TC-SI-710006 | Purchase อนุมัติใบเบิกใบที่สอง | Low | Functional |
| TC-SI-710007 | StoreManager กด Issue โดยไม่กรอกจำนวนจ่าย ระบบต้องไม่ปิดใบโดยไม่ได้จ่ายของ | High | Negative |

---

## TC-SI-700005 — Requestor Submit ใบใหม่ตอนวันนี้อยู่ในงวดที่สร้างล่วงหน้า ระบบยังต้องถามวันที่

> **As a** Requestor user, **I want** this Sr Issue behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Edge Case

**Preconditions**

ต้องมีงวด active (open/locked เก่าสุด) ที่เก่ากว่าวันนี้ แต่มีงวดสร้างล่วงหน้าครอบวันนี้ — TEST BU ที่เพิ่ง reset มีแค่เดือนนี้กับเดือนหน้า

**Steps**

1. สร้าง SR ใหม่ 1 รายการ แล้ว Submit
2. ถ้าระบบถามวันที่ เลือก "inside the open period"

**Expected**

วันนี้อยู่นอกงวด active → ระบบต้องถามว่าจะลงวันที่อะไร และ "inside" = วันสุดท้ายของงวด active

> _Note: gap: ย้ายไปโปรเจกต์ period-close (ดู Gaps ใน docs/superpowers/specs/2026-11-24-e2e-doc-flow-on-test-bus-design.md) · เดิม SRI.7 · phase pre/post (E2E_SRI_PHASE) ถูกถอดออก_

---

## TC-SI-710005 — Requestor สร้างใบเบิกใบที่สองแล้ว Submit

> **As a** Requestor user, **I want** this Sr Issue interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Low · **Test Type:** Functional

**Preconditions**

_(none documented)_

**Steps**

1. สร้าง SR: คลังต้นทาง → ปลายทางของคู่ doc-flow, E2E-DF-1 × 1, กด Save
2. กด Submit แล้วยืนยัน

**Expected**

SR in_progress ขั้น Store Approval

> _Note: เดิม SRF.4 · ขั้นเตรียมของ TC-SI-710007 · รันบน BU-GR2VYNKQ ครั้งเดียว_

---

## TC-SI-710006 — Purchase อนุมัติใบเบิกใบที่สอง

> **As a** Purchase user, **I want** this Sr Issue interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Low · **Test Type:** Functional

**Preconditions**

TC-SI-710005 ผ่านแล้ว — ใบที่สองอยู่ขั้น Store Approval

**Steps**

1. เปิดใบ → Edit → Approve รายบรรทัด
2. กด Approve ของทั้งใบแล้วยืนยัน

**Expected**

workflow_current_stage = Issue

> _Note: เดิม SRF.5 · ขั้นเตรียมของ TC-SI-710007_

---

## TC-SI-710007 — StoreManager กด Issue โดยไม่กรอกจำนวนจ่าย ระบบต้องไม่ปิดใบโดยไม่ได้จ่ายของ

> **As a** any authenticated user, **I want** this Sr Issue behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

TC-SI-710006 ผ่านแล้ว — ใบที่สองอยู่ขั้น Issue

**Steps**

1. เปิดใบ → Edit → Approve รายบรรทัด
2. ไม่แตะช่อง Issued (ค่าตั้งต้น 0)
3. กด Issue แล้วยืนยัน

**Expected**

ระบบเติมจำนวนจ่ายให้ หรือกันไม่ให้กด หรือหลังบ้านปฏิเสธ — ต้องไม่ใช่ completed + ไม่ตัดของ + toast ว่าจ่ายแล้ว

> _Note: บั๊กที่รู้อยู่ (test.fail): ณ 2026-10-02 ใบปิดเป็น completed โดย issued_qty = 0 และยอดคงเหลือไม่ลด · เดิม SRF.6_

---


<sub>Last regenerated: 2026-11-24 · git f462816</sub>
