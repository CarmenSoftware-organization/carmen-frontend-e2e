# Pr Lifecycle — User Stories

_Generated from `tests/312-pr-lifecycle.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Pr Lifecycle
**Spec:** `tests/312-pr-lifecycle.spec.ts`
**Default role:** any authenticated
**Total test cases:** 5 (3 High / 2 Medium / 0 Low)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-PR-700001 | Requestor สร้าง PR draft แล้วหลังบ้านเก็บคำอธิบายและรายการครบ | High | CRUD |
| TC-PR-700002 | Requestor เปิด PR draft แล้วเห็นคำอธิบายและรายการตามที่บันทึก | Medium | CRUD |
| TC-PR-700003 | Requestor แก้ PR draft (หัว + จำนวน + ลบรายการ + เพิ่มรายการ) ในการบันทึกครั้งเดียว | High | CRUD |
| TC-PR-700004 | Requestor ลบ PR draft แล้วใบหายจากหลังบ้าน | Medium | CRUD |
| TC-PR-700005 | Requestor สร้าง PR แล้ว Submit ได้เลขจริงและไปขั้น HOD Approval | High | Functional |

---

## TC-PR-700001 — Requestor สร้าง PR draft แล้วหลังบ้านเก็บคำอธิบายและรายการครบ

> **As a** Requestor user, **I want** to create a new Pr Lifecycle record, **so that** it becomes available for downstream operations.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

Login เป็น carmensoftware.dev+requestor@gmail.com; BU TEST (AVG) BU-GR2VYNKQ; workflow "Purchase Request" (ขั้น Create Request มี requestor); สินค้า E2E-DF-1..4 มาจาก data:reset และมีคลังคู่ doc-flow

**Steps**

1. เปิด /procurement/purchase-request/new
2. เลือก workflow "Purchase Request" และใส่คำอธิบาย FE-CRUD PR <stamp>
3. Add Item 2 รายการที่คลังแรกของคู่ doc-flow: E2E-DF-1 × 3, E2E-DF-2 × 5
4. กด Save

**Expected**

POST ตอบ < 300 และ URL เปลี่ยนเป็น /procurement/purchase-request/<id>; GET /api/BU-GR2VYNKQ/purchase-requests/<id> ได้ pr_status = draft, description ตรงที่กรอก และรายการ E2E-DF-1×3, E2E-DF-2×5

> _Note: เดิม PR.1 (_movement_play fe/01-pr) · ซ้อนกับ TC-PR-050209 ที่ตรวจแค่ redirect — เคสนี้ตรวจค่าที่หลังบ้านเก็บ_

---

## TC-PR-700002 — Requestor เปิด PR draft แล้วเห็นคำอธิบายและรายการตามที่บันทึก

> **As a** Requestor user, **I want** to manage Pr Lifecycle records via CRUD, **so that** the data stays correct over time.

**Priority:** Medium · **Test Type:** CRUD

**Preconditions**

TC-PR-700001 ผ่านแล้วในรอบเดียวกัน (serial) — มี PR draft ของ requestor บน BU-GR2VYNKQ

**Steps**

1. เปิด /procurement/purchase-request/<id> จากลิงก์ตรง
2. อ่านช่องคำอธิบายและแถวรายการ

**Expected**

ช่องคำอธิบายมีค่า FE-CRUD PR <stamp>; แถวของ E2E-DF-1 แสดงจำนวน 3 และแถวของ E2E-DF-2 แสดงจำนวน 5

> _Note: เดิม PR.2 · ครอบบางส่วนของ gap TC-PR-050715 (เปิดจากลิงก์ตรง ไม่ได้ตรวจคลัง)_

---

## TC-PR-700003 — Requestor แก้ PR draft (หัว + จำนวน + ลบรายการ + เพิ่มรายการ) ในการบันทึกครั้งเดียว

> **As a** Requestor user, **I want** to delete a Pr Lifecycle record, **so that** the list reflects only valid entries.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

TC-PR-700001 ผ่านแล้วในรอบเดียวกัน (serial) — PR draft มี E2E-DF-1×3, E2E-DF-2×5

**Steps**

1. เปิดใบ แล้วกด Edit
2. แก้คำอธิบายเป็น "FE-CRUD PR <stamp> (แก้)"
3. แก้ E2E-DF-1 จำนวน 3 → 7
4. ลบแถว E2E-DF-2 (ยืนยันถ้ามี dialog)
5. Add Item: E2E-DF-3 × 2
6. กด Save

**Expected**

Save ตอบ < 300; หลังบ้านเก็บคำอธิบายใหม่ และรายการเหลือ E2E-DF-1×7, E2E-DF-3×2 (แถวที่ลบหายจริง)

> _Note: เดิม PR.3 · TC-PR-050502/050503/050504 ตรวจแค่ URL และหาช่องจำนวนจาก label (ถ้าไม่เจอก็ผ่านเงียบ) — เคสนี้อ่านผลจากหลังบ้าน_

---

## TC-PR-700004 — Requestor ลบ PR draft แล้วใบหายจากหลังบ้าน

> **As a** Requestor user, **I want** to delete a Pr Lifecycle record, **so that** the list reflects only valid entries.

**Priority:** Medium · **Test Type:** CRUD

**Preconditions**

TC-PR-700001 ผ่านแล้วในรอบเดียวกัน (serial) — PR draft ยังอยู่

**Steps**

1. เปิดใบ
2. กด Delete (โหมดดู)
3. ยืนยัน Delete ใน dialog

**Expected**

GET ใบนั้นไม่พบแล้ว (ไม่ใช่ 200) และหน้าจอออกจาก URL ของใบกลับไปหน้ารายการ

> _Note: เดิม PR.4 · ซ้อนกับ TC-PR-050803 ที่ไม่ได้ตรวจหลังบ้าน · การดึงใบที่เพิ่งลบซ้ำ (404) บันทึกเป็นข้อค้นพบเล็ก ไม่ทำให้เคสล้ม_

---

## TC-PR-700005 — Requestor สร้าง PR แล้ว Submit ได้เลขจริงและไปขั้น HOD Approval

> **As a** Requestor user, **I want** this Pr Lifecycle interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

Login เป็น carmensoftware.dev+requestor@gmail.com; BU BU-GR2VYNKQ; workflow "Purchase Request" ขั้นแรก Create Request แล้วต่อด้วย "HOD Approval"

**Steps**

1. สร้าง PR ใหม่ 1 รายการ E2E-DF-4 × 4 แล้วกด Save
2. กด Submit ที่หน้าใบ
3. ยืนยันใน dialog (ถ้ามี)

**Expected**

คำขอ submit ตอบ < 300; หลังบ้าน pr_status = in_progress, pr_no ไม่ขึ้นต้นด้วย draft และ workflow_current_stage = "HOD Approval"

> _Note: เดิม PR.5 · TC-PR-050603/050901 ตรวจแค่ redirect/toast_

---


<sub>Last regenerated: 2026-11-24 · git f462816</sub>
