# Sr Lifecycle — User Stories

_Generated from `tests/702-sr-lifecycle.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Sr Lifecycle
**Spec:** `tests/702-sr-lifecycle.spec.ts`
**Default role:** any authenticated
**Total test cases:** 5 (2 High / 3 Medium / 0 Low)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-SR-700001 | Requestor สร้าง SR draft แล้วหลังบ้านเก็บคำอธิบายและรายการครบ | High | CRUD |
| TC-SR-700002 | Requestor เปิด SR draft แล้วเห็นคลังต้นทาง/ปลายทางและจำนวนตามที่บันทึก | Medium | CRUD |
| TC-SR-700003 | Requestor แก้ SR draft (คำอธิบาย + จำนวน) | Medium | CRUD |
| TC-SR-700004 | Requestor ลบ SR draft จากโหมดแก้แล้วใบหายจากหลังบ้าน | Medium | CRUD |
| TC-SR-700005 | Requestor สร้าง SR แล้ว Submit ได้เลขจริงและไปขั้น Store Approval | High | Functional |

---

## TC-SR-700001 — Requestor สร้าง SR draft แล้วหลังบ้านเก็บคำอธิบายและรายการครบ

> **As a** Requestor user, **I want** to create a new Sr Lifecycle record, **so that** it becomes available for downstream operations.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

Login เป็น บัญชี Requestor (gmail); BU TEST (AVG); workflow Store Requisition ขั้น Create→Store Approval→Issue; E2E-DF-1 อยู่ทั้งสองคลังของคู่ doc-flow (data:reset)

**Steps**

1. เปิด /store-operation/store-requisition/new
2. เลือก workflow Store Requisition, Request From = คลังแรกของคู่ doc-flow, Deliver To = คลังที่สอง, ใส่คำอธิบาย
3. Add Item: E2E-DF-1 × 3
4. กด Save

**Expected**

Save ตอบ < 300 และ URL เปลี่ยนเป็นหน้าใบ; หลังบ้าน doc_status = draft, description ตรง และรายการ E2E-DF-1×3

> _Note: เดิม SR.1 (_movement_play fe/03-sr) · TC-SR-010001/040001 ไม่ได้ assert อะไร · ครอบบางส่วนของ gap TC-SR-040101_

---

## TC-SR-700002 — Requestor เปิด SR draft แล้วเห็นคลังต้นทาง/ปลายทางและจำนวนตามที่บันทึก

> **As a** Requestor user, **I want** to manage Sr Lifecycle records via CRUD, **so that** the data stays correct over time.

**Priority:** Medium · **Test Type:** CRUD

**Preconditions**

TC-SR-700001 ผ่านแล้วในรอบเดียวกัน (serial) — มี SR draft บน TEST BU (AVG)

**Steps**

1. เปิด /store-operation/store-requisition/<id> จากลิงก์ตรง
2. อ่านช่องคำอธิบาย คลังต้นทาง/ปลายทาง และแถวรายการ

**Expected**

ช่องคำอธิบายมีค่า FE-CRUD SR <stamp>; หน้าแสดงคลังต้นทาง/ปลายทางของคู่ doc-flow; แถว E2E-DF-1 มีจำนวน 3

> _Note: เดิม SR.2 · main ไม่มีเคสเปิดดู SR draft ที่ตรวจค่า_

---

## TC-SR-700003 — Requestor แก้ SR draft (คำอธิบาย + จำนวน)

> **As a** Requestor user, **I want** to manage Sr Lifecycle records via CRUD, **so that** the data stays correct over time.

**Priority:** Medium · **Test Type:** CRUD

**Preconditions**

TC-SR-700001 ผ่านแล้วในรอบเดียวกัน (serial) — SR draft มี E2E-DF-1×3

**Steps**

1. เปิดใบ แล้วกด Edit
2. แก้คำอธิบายเป็น "... (แก้)"
3. แก้จำนวน E2E-DF-1 3 → 7
4. กด Save

**Expected**

Save ตอบ < 300; หลังบ้านเก็บคำอธิบายใหม่ และรายการเป็น E2E-DF-1×7

> _Note: เดิม SR.3 · ครอบบางส่วนของ gap TC-SR-040103 · ยังไม่ทดสอบลบ/เพิ่มรายการ_

---

## TC-SR-700004 — Requestor ลบ SR draft จากโหมดแก้แล้วใบหายจากหลังบ้าน

> **As a** Requestor user, **I want** to delete a Sr Lifecycle record, **so that** the list reflects only valid entries.

**Priority:** Medium · **Test Type:** CRUD

**Preconditions**

TC-SR-700001 ผ่านแล้วในรอบเดียวกัน (serial) — SR draft ยังอยู่

**Steps**

1. เปิดใบ แล้วกด Edit (ปุ่ม Delete ของ SR มีเฉพาะโหมดแก้)
2. กด Delete ตัวแรก (ของหัวใบ)
3. ยืนยัน Delete ใน dialog

**Expected**

GET ใบนั้นไม่พบแล้ว และหน้าจอออกจาก URL ของใบกลับไปหน้ารายการ

> _Note: เดิม SR.4 · ครอบ gap TC-SR-040106 (ยังไม่ได้ตรวจข้อความ dialog / toast)_

---

## TC-SR-700005 — Requestor สร้าง SR แล้ว Submit ได้เลขจริงและไปขั้น Store Approval

> **As a** Requestor user, **I want** this Sr Lifecycle interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

Login เป็นบัญชี Requestor (gmail); BU TEST (AVG); workflow Store Requisition ขั้น Create→Store Approval→Issue ขั้นแรกคือ Store Approval (ไม่มีขั้น HOD)

**Steps**

1. สร้าง SR ใหม่ 1 รายการ E2E-DF-1 × 1 แล้วกด Save
2. กด Submit ที่หน้าใบ
3. ยืนยันใน dialog
4. ถ้าระบบถาม "Which date should this carry?" (วันนี้อยู่นอกงวด active) เลือก "inside the open period"

**Expected**

คำตอบสุดท้ายของ submit < 300; หลังบ้าน doc_status = in_progress, sr_no ไม่ขึ้นต้นด้วย draft และ workflow_current_stage = Store Approval

> _Note: เดิม SR.5 · TC-SR-050001 หาปุ่ม "submit for approval" ซึ่งไม่มีแล้ว จึง skip ทุกรอบ — ปุ่มจริงชื่อ Submit · 422 *_DATE_PATTERN_REQUIRED รอบแรกเป็นพฤติกรรมที่ตั้งใจ_

---


<sub>Last regenerated: 2026-11-24 · git f462816</sub>
