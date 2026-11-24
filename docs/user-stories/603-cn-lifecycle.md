# Cn Lifecycle — User Stories

_Generated from `tests/603-cn-lifecycle.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Cn Lifecycle
**Spec:** `tests/603-cn-lifecycle.spec.ts`
**Default role:** any authenticated
**Total test cases:** 7 (4 High / 3 Medium / 0 Low)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-CN-700001 | เตรียม GRN ที่ commit แล้ว 3 รายการให้ใบลดหนี้อ้าง | High | Functional |
| TC-CN-700002 | Purchase สร้างใบลดหนี้ draft จาก GRN แล้วหลังบ้านเก็บใบกำกับและจำนวนคืนครบ | High | CRUD |
| TC-CN-700003 | Purchase เปิดใบลดหนี้ draft แล้วเห็นใบกำกับ GRN ที่อ้าง และจำนวนคืน | Medium | CRUD |
| TC-CN-700004 | ใบลดหนี้ใหม่ที่อ้าง GRN เดิมต้องเลือกสินค้าที่อยู่ในใบลดหนี้อื่นแล้วไม่ได้ | Medium | Validation |
| TC-CN-700005 | Purchase แก้ใบลดหนี้ draft (ใบกำกับ + จำนวนคืน + ลบรายการ + เพิ่มรายการจาก GRN) | High | CRUD |
| TC-CN-700006 | Purchase ลบใบลดหนี้ draft (Edit → Delete) แล้วใบหายจากหลังบ้าน | Medium | CRUD |
| TC-CN-700007 | Purchase สร้างใบลดหนี้แล้ว Submit ได้ completed และลงสต๊อกคืนของ | High | Functional |

---

## TC-CN-700001 — เตรียม GRN ที่ commit แล้ว 3 รายการให้ใบลดหนี้อ้าง

> **As a** any authenticated user, **I want** this Cn Lifecycle interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

Login เป็นบัญชี Purchase (gmail); BU TEST (AVG); Purchase มีสิทธิ์สร้าง/commit GRN และสร้างใบลดหนี้ (data:reset)

**Steps**

1. สร้าง GRN manual วันที่ในงวด active: E2E-DF-1 / E2E-DF-2 / E2E-DF-3 อย่างละ 5
2. กด Create
3. กด Commit แล้วยืนยัน

**Expected**

หลังบ้าน GRN doc_status = committed (ใบลดหนี้อ้างได้เฉพาะ GRN ที่ commit แล้ว)

> _Note: เดิม CN.0 · สร้างใหม่ทุกรอบ เพราะสินค้าหนึ่งตัวบนใบรับลดหนี้ได้ครั้งเดียว · TC-GRN-110001 (501-grn) skip ทุกรอบเพราะหาแถว received_

---

## TC-CN-700002 — Purchase สร้างใบลดหนี้ draft จาก GRN แล้วหลังบ้านเก็บใบกำกับและจำนวนคืนครบ

> **As a** Purchase user, **I want** to create a new Cn Lifecycle record, **so that** it becomes available for downstream operations.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

TC-CN-700001 ผ่านแล้วในรอบเดียวกัน (serial) — มี GRN committed ของผู้ขายแรกที่ active; มีเหตุผลใบลดหนี้ที่ active

**Steps**

1. เปิด /procurement/credit-note/new
2. ผู้ขายแรกที่ active, GRN No. = ใบจาก TC-CN-700001, Reason แรกที่ active, Doc Date/Tax Invoice Date = วันในงวด active, เลขใบกำกับภาษี FE-CN-<stamp>
3. Add Item → Select from GRN: E2E-DF-1 + E2E-DF-2 → Add
4. จำนวนคืนอย่างละ 1
5. กด Create

**Expected**

POST ตอบ ok; หลังบ้าน doc_status = draft, tax_invoice_no = FE-CN-<stamp> และรายการ E2E-DF-2×1, E2E-DF-1×1

> _Note: เดิม CN.1 · TC-CN-020001 ไม่มี assertion และสมมติว่ามีการเลือก lot ซึ่งไม่มีแล้ว_

---

## TC-CN-700003 — Purchase เปิดใบลดหนี้ draft แล้วเห็นใบกำกับ GRN ที่อ้าง และจำนวนคืน

> **As a** Purchase user, **I want** to manage Cn Lifecycle records via CRUD, **so that** the data stays correct over time.

**Priority:** Medium · **Test Type:** CRUD

**Preconditions**

TC-CN-700002 ผ่านแล้วในรอบเดียวกัน (serial) — มี CN draft

**Steps**

1. เปิด /procurement/credit-note/<id> จากลิงก์ตรง
2. อ่านเลขใบกำกับภาษี เลข GRN ที่อ้าง และแถวรายการ

**Expected**

ช่องใบกำกับภาษีมีค่า FE-CN-<stamp>; หน้าแสดงเลข GRN ที่อ้าง; แถว E2E-DF-1 และ E2E-DF-2 มีจำนวนคืน 1

> _Note: เดิม CN.2 · TC-CN-040001 เปิดแถวแล้วไม่ assert และ skip_

---

## TC-CN-700004 — ใบลดหนี้ใหม่ที่อ้าง GRN เดิมต้องเลือกสินค้าที่อยู่ในใบลดหนี้อื่นแล้วไม่ได้

> **As a** any authenticated user, **I want** the system to block invalid Cn Lifecycle submissions, **so that** data quality is preserved.

**Priority:** Medium · **Test Type:** Validation

**Preconditions**

TC-CN-700002 ผ่านแล้วในรอบเดียวกัน (serial) — CN draft ถือ E2E-DF-1 + E2E-DF-2 ของ GRN อยู่ (E2E-DF-3 ยังว่าง)

**Steps**

1. เปิด /procurement/credit-note/new แล้วกรอกหัวใบอ้าง GRN เดิม (ผู้ขายแรกที่ active, Reason, วันที่, ใบกำกับ FE-CN-<stamp>-DUP)
2. กด Add Item ดู dialog Select from GRN
3. ดูว่าช่องของ E2E-DF-1 (อยู่ใน CN draft อื่นแล้ว) ถูก disabled หรือไม่

**Expected**

dialog ปิด/ทำเครื่องหมายสินค้าที่ถูกลดหนี้แล้ว (หลังบ้านมี GET good-received-notes/:id/ref บอกให้) — ช่องของ E2E-DF-1 ต้อง disabled

> _Note: suspected bug (test.fail): dialog ให้เลือกสินค้าที่ถูกลดหนี้แล้วได้ (ยังเป็นอยู่ 2026-11-22) · เดิม CN.3 · ใกล้เคียง gap TC-CN-030007 ซึ่งครอบแค่ภายในใบเดียว_

---

## TC-CN-700005 — Purchase แก้ใบลดหนี้ draft (ใบกำกับ + จำนวนคืน + ลบรายการ + เพิ่มรายการจาก GRN)

> **As a** Purchase user, **I want** to delete a Cn Lifecycle record, **so that** the list reflects only valid entries.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

TC-CN-700002 ผ่านแล้วในรอบเดียวกัน (serial) — CN draft มี E2E-DF-1×1, E2E-DF-2×1

**Steps**

1. เปิดใบ แล้วกด Edit
2. เลขใบกำกับภาษี → FE-CN-<stamp>-E
3. E2E-DF-1 คืน 1 → 2
4. ลบ E2E-DF-2
5. Add Item → Select from GRN: E2E-DF-3 คืน 1
6. กด Save

**Expected**

Save ตอบ < 300; ใบยังเป็น draft; หลังบ้านเก็บใบกำกับใหม่ และรายการเหลือ E2E-DF-1×2, E2E-DF-3×1 (บรรทัดที่ลบต้องหายจริง)

> _Note: FE-3 แก้แล้ว: FE 48edc588 ส่งบรรทัดที่ลบด้วยคีย์ credit_note_detail.delete ที่หลังบ้านอ่าน (เดิมส่ง remove แล้วบรรทัดที่ลบยังอยู่) จึงถอด test.fail ออก · เดิม CN.4 · TC-CN-050001 แก้ช่อง Total Amount ซึ่งไม่มีแล้ว_

---

## TC-CN-700006 — Purchase ลบใบลดหนี้ draft (Edit → Delete) แล้วใบหายจากหลังบ้าน

> **As a** Purchase user, **I want** to edit an existing Cn Lifecycle record, **so that** its data stays accurate.

**Priority:** Medium · **Test Type:** CRUD

**Preconditions**

TC-CN-700002 ผ่านแล้วในรอบเดียวกัน (serial) — CN draft ยังอยู่

**Steps**

1. เปิดใบ แล้วกด Edit
2. กด Delete
3. ยืนยัน Delete ใน dialog

**Expected**

GET ใบนั้นไม่พบแล้ว และหน้าจอออกจาก URL ของใบกลับไปหน้ารายการ

> _Note: เดิม CN.5 · main ไม่มีเคสลบ CN (TC-CN-110001 เป็น Void ซึ่ง UI ไม่มี) · ครอบ gap TC-CN-110006_

---

## TC-CN-700007 — Purchase สร้างใบลดหนี้แล้ว Submit ได้ completed และลงสต๊อกคืนของ

> **As a** Purchase user, **I want** this Cn Lifecycle interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

TC-CN-700001 ผ่านแล้วในรอบเดียวกัน (serial) — GRN committed; ตรวจ inventory transaction จาก API

**Steps**

1. สร้างใบลดหนี้อ้าง GRN เดิม คืน E2E-DF-1 × 1 แล้วกด Create
2. เปิดใบ กด Submit
3. ยืนยัน Submit

**Expected**

หลังบ้าน doc_status = completed, รายการ E2E-DF-1×1; inventory-transactions ของใบนี้ตัดสต๊อก E2E-DF-1 ออก 1

> _Note: เดิม CN.6 · TC-CN-100001 กดปุ่ม Commit และคาด COMMITTED ซึ่งไม่มีแล้ว · ครอบเคส stock movement ที่ skip อยู่ (TC-CN-310001 / 280001) · ครอบ gap TC-CN-100008_

---


<sub>Last regenerated: 2026-11-24 · git f462816</sub>
