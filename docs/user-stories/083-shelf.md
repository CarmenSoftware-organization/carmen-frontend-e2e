# Shelf — User Stories

_Generated from `tests/083-shelf.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Shelf
**Spec:** `tests/083-shelf.spec.ts`
**Default role:** Admin
**Total test cases:** 8 (5 High / 3 Medium / 0 Low)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-SHLF-010001 | แสดงรายการชั้นวางพร้อมคอลัมน์มาตรฐาน | High | Smoke |
| TC-SHLF-030001 | สร้างชั้นวางใหม่ด้วยฟิลด์บังคับ (รหัส + ชื่อ) | High | CRUD |
| TC-SHLF-030002 | สร้างชั้นวางพร้อมคำอธิบายและลำดับ | Medium | Happy Path |
| TC-SHLF-040001 | แก้ไขชื่อและคำอธิบายแล้วค่าคงอยู่ | High | CRUD |
| TC-SHLF-050001 | ลบชั้นวางสำเร็จ | High | CRUD |
| TC-SHLF-200001 | บันทึกไม่ได้เมื่อเว้นรหัสและชื่อว่าง | High | Validation |
| TC-SHLF-300001 | ส่งออกรายการชั้นวางเป็นไฟล์ XLSX | Medium | Functional |
| TC-SHLF-900002 | รายการชั้นวางโหลดจาก endpoint จริง — แสดงตารางและไม่เป็น error state | Medium | Edge Case |

---

## TC-SHLF-010001 — แสดงรายการชั้นวางพร้อมคอลัมน์มาตรฐาน

> **As a** Admin user, **I want** core Shelf interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG

**Steps**

1. ไปที่ /config/shelf
2. รอให้ DataGrid หรือ error-state โหลดเสร็จ

**Expected**

URL ตรงกับ /config/shelf; หน้าแสดงชื่อ 'Shelf' หรือ 'ชั้นวาง' และ toolbar แสดงช่องค้นหาและปุ่มเพิ่ม (โดยไม่คำนึงว่าตารางจะมีข้อมูลหรือแสดง error-state เพราะ backend อาจยังไม่มี endpoint)

---

## TC-SHLF-030001 — สร้างชั้นวางใหม่ด้วยฟิลด์บังคับ (รหัส + ชื่อ)

> **As a** Admin user, **I want** to create a new Shelf record, **so that** it becomes available for downstream operations.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG; อยู่ที่หน้า /config/shelf

**Steps**

1. คลิกปุ่ม 'เพิ่มชั้นวาง'
2. กรอกรหัสที่ไม่ซ้ำ
3. กรอกชื่อ
4. คลิกปุ่มสร้าง

**Expected**

แสดง toast 'สร้างชั้นวางสำเร็จ'; dialog ปิดเอง; ชั้นวางใหม่ปรากฏในรายการ

---

## TC-SHLF-030002 — สร้างชั้นวางพร้อมคำอธิบายและลำดับ

> **As a** Admin user, **I want** this Shelf behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Happy Path

**Preconditions**

อยู่ใน dialog เพิ่มชั้นวาง

**Steps**

1. กรอกรหัสและชื่อที่ไม่ซ้ำ
2. กรอกคำอธิบาย
3. กรอกลำดับเป็นจำนวนเต็มบวก เช่น '3'
4. คลิกปุ่มสร้าง

**Expected**

สร้างสำเร็จพร้อม toast; คอลัมน์คำอธิบายในตารางแสดงข้อความที่กรอก

---

## TC-SHLF-040001 — แก้ไขชื่อและคำอธิบายแล้วค่าคงอยู่

> **As a** Admin user, **I want** to edit an existing Shelf record, **so that** its data stays accurate.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

มีชั้นวางที่สร้างไว้แล้วอย่างน้อย 1 รายการ

**Steps**

1. คลิกรหัสของชั้นวางเพื่อเปิด dialog แก้ไข
2. แก้ไขชื่อและคำอธิบาย
3. คลิกปุ่มบันทึก
4. เปิด dialog ของชั้นวางนั้นอีกครั้ง

**Expected**

แสดง toast อัปเดตสำเร็จ; ตารางแสดงชื่อและคำอธิบายใหม่

---

## TC-SHLF-050001 — ลบชั้นวางสำเร็จ

> **As a** Admin user, **I want** to delete a Shelf record, **so that** the list reflects only valid entries.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

มีชั้นวางที่สร้างขึ้นมาเพื่อลบโดยเฉพาะ

**Steps**

1. เปิดเมนูจัดการท้ายแถวของชั้นวางนั้นแล้วเลือกลบ
2. ยืนยัน dialog การลบ

**Expected**

แสดง toast ลบสำเร็จ; ชั้นวางหายจากรายการหลังรีเฟรชข้อมูล

---

## TC-SHLF-200001 — บันทึกไม่ได้เมื่อเว้นรหัสและชื่อว่าง

> **As a** Admin user, **I want** the system to block invalid Shelf submissions, **so that** data quality is preserved.

**Priority:** High · **Test Type:** Validation

**Preconditions**

อยู่ใน dialog เพิ่มชั้นวาง โดยยังไม่กรอกอะไรเลย

**Steps**

1. ปล่อยช่องรหัสและช่องชื่อว่าง
2. คลิกปุ่มสร้าง

**Expected**

แสดงข้อความ error ใต้ทั้งสองช่อง; dialog ไม่ปิดและไม่มีชั้นวางถูกสร้าง

---

## TC-SHLF-300001 — ส่งออกรายการชั้นวางเป็นไฟล์ XLSX

> **As a** Admin user, **I want** this Shelf interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

อยู่ที่หน้า /config/shelf บน desktop; มีชั้นวางอย่างน้อย 1 รายการ

**Steps**

1. คลิกปุ่มส่งออก
2. รอจนปุ่มกลับจากสถานะกำลังส่งออก

**Expected**

เบราว์เซอร์ดาวน์โหลดไฟล์ XLSX; แสดง toast แจ้งจำนวนรายการ

---

## TC-SHLF-900002 — รายการชั้นวางโหลดจาก endpoint จริง — แสดงตารางและไม่เป็น error state

> **As a** Admin user, **I want** this Shelf behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Edge Case

**Preconditions**

backend ของ BU ที่ใช้ทดสอบมี endpoint /api/config/{bu_code}/shelves ใช้งานได้

**Steps**

1. ไปที่ /config/shelf
2. รอให้คำขอรายการเสร็จ

**Expected**

หน้าแสดงตารางรายการ (หรือสถานะว่าง) และไม่แสดง ErrorState / ปุ่มลองใหม่

---


<sub>Last regenerated: 2026-11-24 · git f462816</sub>
