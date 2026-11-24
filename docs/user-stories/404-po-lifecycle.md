# Po Lifecycle — User Stories

_Generated from `tests/404-po-lifecycle.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Po Lifecycle
**Spec:** `tests/404-po-lifecycle.spec.ts`
**Default role:** any authenticated
**Total test cases:** 5 (3 High / 2 Medium / 0 Low)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-PO-700001 | Purchase สร้าง PO draft แล้วหลังบ้านเก็บจำนวนและราคาครบ | High | CRUD |
| TC-PO-700002 | Purchase เปิด PO draft แล้วเห็นจำนวนและราคาตามที่บันทึก | Medium | CRUD |
| TC-PO-700003 | Purchase แก้ PO draft (หัว + จำนวน/ราคา + ลบรายการ + เพิ่มรายการ) | High | CRUD |
| TC-PO-700004 | Purchase ลบ PO draft จากโหมดดูแล้วใบหายจากหลังบ้าน | Medium | CRUD |
| TC-PO-700005 | Purchase สร้าง PO แล้ว Submit ได้เลขจริงและไปขั้น FC Approval | High | Functional |

---

## TC-PO-700001 — Purchase สร้าง PO draft แล้วหลังบ้านเก็บจำนวนและราคาครบ

> **As a** Purchase user, **I want** to create a new Po Lifecycle record, **so that** it becomes available for downstream operations.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

Login เป็น carmensoftware.dev+purchase@gmail.com; BU TEST (AVG) BU-GR2VYNKQ; workflow "General PO" ขั้น Create Request มี purchase; มีผู้ขายที่ active (ใช้ตัวแรกตาม code); สินค้า E2E-DF-1..4 มาจาก data:reset

**Steps**

1. เปิด /procurement/purchase-order/new
2. เลือก workflow "General PO", ผู้ขายตัวแรก, Delivery Date 2026-10-20, ใส่คำอธิบาย
3. Add Item 2 รายการที่คลังแรกของคู่ doc-flow: E2E-DF-1 × 3 @12.5, E2E-DF-2 × 5 @20
4. กด Save

**Expected**

Save ตอบ < 300 และ URL เปลี่ยนเป็นหน้าใบ; หลังบ้าน po_status = draft, description ตรง, รายการ E2E-DF-1×3@12.5 และ E2E-DF-2×5@20

> _Note: เดิม PO.1 (_movement_play fe/02-po) · ซ้อนกับ TC-PO-060203 ที่ตรวจแค่ URL/toast · ราคากรอกด้วย typeInto (fill() ทำให้ "18.00" กลายเป็น "1821")_

---

## TC-PO-700002 — Purchase เปิด PO draft แล้วเห็นจำนวนและราคาตามที่บันทึก

> **As a** Purchase user, **I want** to manage Po Lifecycle records via CRUD, **so that** the data stays correct over time.

**Priority:** Medium · **Test Type:** CRUD

**Preconditions**

TC-PO-700001 ผ่านแล้วในรอบเดียวกัน (serial) — มี PO draft บน BU-GR2VYNKQ

**Steps**

1. เปิด /procurement/purchase-order/<id> จากลิงก์ตรง
2. อ่านช่องคำอธิบาย และข้อความ/ค่าในแถวของแต่ละสินค้า

**Expected**

ช่องคำอธิบายมีค่า FE-CRUD PO <stamp>; แถว E2E-DF-1 มีจำนวน 3 และราคา 12.5; แถว E2E-DF-2 มีจำนวน 5 และราคา 20

> _Note: เดิม PO.2 · TC-PO-060301 ตรวจแค่ URL_

---

## TC-PO-700003 — Purchase แก้ PO draft (หัว + จำนวน/ราคา + ลบรายการ + เพิ่มรายการ)

> **As a** Purchase user, **I want** to delete a Po Lifecycle record, **so that** the list reflects only valid entries.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

TC-PO-700001 ผ่านแล้วในรอบเดียวกัน (serial) — PO draft มี E2E-DF-1×3@12.5, E2E-DF-2×5@20

**Steps**

1. เปิดใบ แล้วกด Edit
2. แก้คำอธิบายเป็น "... (แก้)"
3. E2E-DF-1 3@12.5 → 7@15
4. ลบ E2E-DF-2 ด้วยปุ่ม "Remove this product" ในแถวคอมเมนต์ใต้รายการ
5. Add Item: E2E-DF-3 2@30
6. กด Save

**Expected**

Save ตอบ < 300; หลังบ้านเก็บคำอธิบายใหม่ และรายการเหลือ E2E-DF-1×7@15, E2E-DF-3×2@30

> _Note: เดิม PO.3 · TC-PO-060402/060403 หาช่องจำนวนจาก label (ถ้าไม่เจอก็ผ่านเงียบ) และตรวจแค่ URL_

---

## TC-PO-700004 — Purchase ลบ PO draft จากโหมดดูแล้วใบหายจากหลังบ้าน

> **As a** Purchase user, **I want** to delete a Po Lifecycle record, **so that** the list reflects only valid entries.

**Priority:** Medium · **Test Type:** CRUD

**Preconditions**

TC-PO-700001 ผ่านแล้วในรอบเดียวกัน (serial) — PO draft ยังอยู่

**Steps**

1. เปิดใบ (โหมดดู)
2. กด Delete
3. ยืนยัน Delete ใน dialog

**Expected**

GET ใบนั้นไม่พบแล้ว และหน้าจอออกจาก URL ของใบกลับไปหน้ารายการ

> _Note: เดิม PO.4 · main ไม่มีเคสลบ PO draft (TC-PO-060406 ลบใบ In Progress และ skip ทุกรอบ) · ยืนยันว่า Delete ของ PO draft อยู่ในโหมดดู_

---

## TC-PO-700005 — Purchase สร้าง PO แล้ว Submit ได้เลขจริงและไปขั้น FC Approval

> **As a** Purchase user, **I want** this Po Lifecycle interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

Login เป็น carmensoftware.dev+purchase@gmail.com; BU BU-GR2VYNKQ; workflow "General PO" ขั้นแรก Create Request แล้วต่อด้วย FC Approval

**Steps**

1. สร้าง PO ใหม่ 1 รายการ E2E-DF-4 × 4 @10 แล้วกด Save
2. กด Submit ที่หน้าใบ
3. ยืนยันใน dialog (ถ้ามี)

**Expected**

คำขอ submit ตอบ < 300; หลังบ้าน po_status = in_progress, po_no ไม่ขึ้นต้นด้วย draft และ workflow_current_stage = FC Approval

> _Note: เดิม PO.5 · TC-PO-060405/060901 ตรวจแค่ URL_

---


<sub>Last regenerated: 2026-11-24 · git f462816</sub>
