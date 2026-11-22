# Credit Note — Doc Flow (movement suite) — User Stories

_Generated from `tests/603-cn-doc-flow.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Credit Note — Doc Flow (movement suite)
**Spec:** `tests/603-cn-doc-flow.spec.ts`
**Default role:** any authenticated
**Total test cases:** 7 (4 High / 3 Medium / 0 Low)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-CN-700001 | เตรียม GRN ที่ commit แล้ว 3 รายการให้ใบลดหนี้อ้าง | High | Functional |
| TC-CN-700002 | Requestor สร้างใบลดหนี้ draft จาก GRN แล้วหลังบ้านเก็บใบกำกับและจำนวนคืนครบ | High | CRUD |
| TC-CN-700003 | Requestor เปิดใบลดหนี้ draft แล้วเห็นใบกำกับ GRN ที่อ้าง และจำนวนคืน | Medium | CRUD |
| TC-CN-700004 | ใบลดหนี้ใหม่ที่อ้าง GRN เดิมต้องเลือกสินค้าที่อยู่ในใบลดหนี้อื่นแล้วไม่ได้ | Medium | Validation |
| TC-CN-700005 | Requestor แก้ใบลดหนี้ draft (ใบกำกับ + จำนวนคืน + ลบรายการ + เพิ่มรายการจาก GRN) | High | CRUD |
| TC-CN-700006 | Requestor ลบใบลดหนี้ draft (Edit → Delete) แล้วใบหายจากหลังบ้าน | Medium | CRUD |
| TC-CN-700007 | Requestor สร้างใบลดหนี้แล้ว Submit ได้ completed และลงสต๊อกคืนของ | High | Functional |

---

## TC-CN-700001 — เตรียม GRN ที่ commit แล้ว 3 รายการให้ใบลดหนี้อ้าง

> **As a** any authenticated user, **I want** this Credit Note — Doc Flow (movement suite) interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

Login เป็น requestor@carmen.com (movement-setup); BU CARMEN-AVG; requestor มีคลัง LCX013 และสิทธิ์ GRN

**Steps**

1. สร้าง GRN manual วันที่ในงวด active: Ground Beef / Australian Sirloin / Pork neck tenderloin อย่างละ 5
2. กด Create
3. กด Commit แล้วยืนยัน

**Expected**

หลังบ้าน GRN doc_status = committed (ใบลดหนี้อ้างได้เฉพาะ GRN ที่ commit แล้ว)

> _Note: เดิม CN.0 · สร้างใหม่ทุกรอบ เพราะสินค้าหนึ่งตัวบนใบรับลดหนี้ได้ครั้งเดียว · TC-GRN-110001 (501-grn) skip ทุกรอบเพราะหาแถว received_

---

## TC-CN-700002 — Requestor สร้างใบลดหนี้ draft จาก GRN แล้วหลังบ้านเก็บใบกำกับและจำนวนคืนครบ

> **As a** Requestor user, **I want** to create a new Credit Note — Doc Flow (movement suite) record, **so that** it becomes available for downstream operations.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

TC-CN-700001 ผ่านแล้วในรอบเดียวกัน (serial) — มี GRN committed ของ C010; เหตุผล "Damage Good" มีอยู่

**Steps**

1. เปิด /procurement/credit-note/new
2. ผู้ขาย C010, GRN No. = ใบจาก TC-CN-700001, Reason "Damage Good", Doc Date/Tax Invoice Date = วันในงวด active, เลขใบกำกับภาษี FE-CN-<stamp>
3. Add Item → Select from GRN: Ground Beef + Australian Sirloin → Add
4. จำนวนคืนอย่างละ 1
5. กด Create

**Expected**

POST ตอบ ok; หลังบ้าน doc_status = draft, tax_invoice_no = FE-CN-<stamp> และรายการ Australian Sirloin×1, Ground Beef×1

> _Note: เดิม CN.1 · TC-CN-020001 ไม่มี assertion และสมมติว่ามีการเลือก lot ซึ่งไม่มีแล้ว_

---

## TC-CN-700003 — Requestor เปิดใบลดหนี้ draft แล้วเห็นใบกำกับ GRN ที่อ้าง และจำนวนคืน

> **As a** Requestor user, **I want** to manage Credit Note — Doc Flow (movement suite) records via CRUD, **so that** the data stays correct over time.

**Priority:** Medium · **Test Type:** CRUD

**Preconditions**

TC-CN-700002 ผ่านแล้วในรอบเดียวกัน (serial) — มี CN draft

**Steps**

1. เปิด /procurement/credit-note/<id> จากลิงก์ตรง
2. อ่านเลขใบกำกับภาษี เลข GRN ที่อ้าง และแถวรายการ

**Expected**

ช่องใบกำกับภาษีมีค่า FE-CN-<stamp>; หน้าแสดงเลข GRN ที่อ้าง; แถว Ground Beef และ Australian Sirloin มีจำนวนคืน 1

> _Note: เดิม CN.2 · TC-CN-040001 เปิดแถวแล้วไม่ assert และ skip_

---

## TC-CN-700004 — ใบลดหนี้ใหม่ที่อ้าง GRN เดิมต้องเลือกสินค้าที่อยู่ในใบลดหนี้อื่นแล้วไม่ได้

> **As a** any authenticated user, **I want** the system to block invalid Credit Note — Doc Flow (movement suite) submissions, **so that** data quality is preserved.

**Priority:** Medium · **Test Type:** Validation

**Preconditions**

TC-CN-700002 ผ่านแล้วในรอบเดียวกัน (serial) — CN draft ถือ Ground Beef + Australian Sirloin ของ GRN อยู่ (Pork neck tenderloin ยังว่าง)

**Steps**

1. เปิด /procurement/credit-note/new แล้วกรอกหัวใบอ้าง GRN เดิม (ผู้ขาย C010, Reason, วันที่, ใบกำกับ FE-CN-<stamp>-DUP)
2. กด Add Item ดู dialog Select from GRN
3. ดูว่าช่องของ Ground Beef (อยู่ใน CN draft อื่นแล้ว) ถูก disabled หรือไม่

**Expected**

dialog ปิด/ทำเครื่องหมายสินค้าที่ถูกลดหนี้แล้ว (หลังบ้านมี GET good-received-notes/:id/ref บอกให้) — ช่องของ Ground Beef ต้อง disabled

> _Note: suspected bug (test.fail): dialog ให้เลือกสินค้าที่ถูกลดหนี้แล้วได้ (ยังเป็นอยู่ 2026-11-22) · เดิม CN.3 · ใกล้เคียง gap TC-CN-030007 ซึ่งครอบแค่ภายในใบเดียว_

---

## TC-CN-700005 — Requestor แก้ใบลดหนี้ draft (ใบกำกับ + จำนวนคืน + ลบรายการ + เพิ่มรายการจาก GRN)

> **As a** Requestor user, **I want** to delete a Credit Note — Doc Flow (movement suite) record, **so that** the list reflects only valid entries.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

TC-CN-700002 ผ่านแล้วในรอบเดียวกัน (serial) — CN draft มี Ground Beef×1, Australian Sirloin×1

**Steps**

1. เปิดใบ แล้วกด Edit
2. เลขใบกำกับภาษี → FE-CN-<stamp>-E
3. Ground Beef คืน 1 → 2
4. ลบ Australian Sirloin
5. Add Item → Select from GRN: Pork neck tenderloin คืน 1
6. กด Save

**Expected**

Save ตอบ < 300; ใบยังเป็น draft; หลังบ้านเก็บใบกำกับใหม่ และรายการเหลือ Ground Beef×2, Pork neck tenderloin×1 (บรรทัดที่ลบต้องหายจริง)

> _Note: FE-3 แก้แล้ว: FE 48edc588 ส่งบรรทัดที่ลบด้วยคีย์ credit_note_detail.delete ที่หลังบ้านอ่าน (เดิมส่ง remove แล้วบรรทัดที่ลบยังอยู่) จึงถอด test.fail ออก · เดิม CN.4 · TC-CN-050001 แก้ช่อง Total Amount ซึ่งไม่มีแล้ว_

---

## TC-CN-700006 — Requestor ลบใบลดหนี้ draft (Edit → Delete) แล้วใบหายจากหลังบ้าน

> **As a** Requestor user, **I want** to edit an existing Credit Note — Doc Flow (movement suite) record, **so that** its data stays accurate.

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

## TC-CN-700007 — Requestor สร้างใบลดหนี้แล้ว Submit ได้ completed และลงสต๊อกคืนของ

> **As a** Requestor user, **I want** this Credit Note — Doc Flow (movement suite) interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

TC-CN-700001 ผ่านแล้วในรอบเดียวกัน (serial) — GRN committed; ตรวจ inventory transaction จาก API

**Steps**

1. สร้างใบลดหนี้อ้าง GRN เดิม คืน Ground Beef × 1 แล้วกด Create
2. เปิดใบ กด Submit
3. ยืนยัน Submit

**Expected**

หลังบ้าน doc_status = completed, รายการ Ground Beef×1; inventory-transactions ของใบนี้ตัดสต๊อก Ground Beef ออก 1

> _Note: เดิม CN.6 · TC-CN-100001 กดปุ่ม Commit และคาด COMMITTED ซึ่งไม่มีแล้ว · ครอบเคส stock movement ที่ skip อยู่ (TC-CN-310001 / 280001) · ครอบ gap TC-CN-100008_

---


<sub>Last regenerated: 2026-11-21 · git 4a3cb23</sub>
