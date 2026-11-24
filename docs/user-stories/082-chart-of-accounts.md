# Chart Of Accounts — User Stories

_Generated from `tests/082-chart-of-accounts.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Chart Of Accounts
**Spec:** `tests/082-chart-of-accounts.spec.ts`
**Default role:** Admin
**Total test cases:** 16 (9 High / 6 Medium / 1 Low)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-COA-010001 | แสดงรายการผังบัญชีในตาราง | High | Smoke |
| TC-COA-010002 | ค้นหาบัญชีด้วยรหัสหรือชื่อบัญชี | High | Functional |
| TC-COA-010003 | ล้างคำค้นด้วยปุ่มกากบาทในช่องค้นหา | Medium | Functional |
| TC-COA-010004 | กรองตามสถานะ Active / Inactive | High | Functional |
| TC-COA-020001 | เปิดหน้ารายละเอียดบัญชีจากคอลัมน์ Code | High | Happy Path |
| TC-COA-020002 | ยกเลิกการแก้ไขด้วยปุ่ม Cancel โดยไม่บันทึก | Medium | Alternate Flow |
| TC-COA-030001 | สร้างบัญชีใหม่ (Assets + Balance sheet) | High | CRUD |
| TC-COA-030003 | สร้างบัญชีโดยปิดสถานะใช้งานตั้งแต่ต้น | Medium | CRUD |
| TC-COA-040001 | แก้ไขชื่อบัญชีแล้วค่าคงอยู่ | High | CRUD |
| TC-COA-050001 | ลบบัญชีจากเมนู Row actions | High | CRUD |
| TC-COA-050002 | ยกเลิกการลบใน dialog ยืนยัน | Medium | Alternate Flow |
| TC-COA-200001 | บันทึกไม่ได้เมื่อเว้นรหัสบัญชีว่าง | High | Validation |
| TC-COA-200002 | บันทึกไม่ได้เมื่อเว้นชื่อบัญชีว่าง | High | Validation |
| TC-COA-200003 | ช่องคำอธิบายภาษาไทยไม่บังคับ — ปล่อยว่างแล้วบันทึกได้ | Medium | Validation |
| TC-COA-900001 | ช่องกรอกจำกัดความยาวสูงสุดตามที่กำหนด | Low | Edge Case |
| TC-COA-900002 | ไม่พบข้อมูล — แสดงสถานะว่างและส่งออกไม่ได้ | Medium | Edge Case |

---

## TC-COA-010001 — แสดงรายการผังบัญชีในตาราง

> **As a** Admin user, **I want** core Chart Of Accounts interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG; มีรหัสบัญชีอย่างน้อย 1 รายการใน BU นี้

**Steps**

1. ไปที่ /config/chart-of-accounts
2. รอให้ DataGrid โหลดเสร็จ

**Expected**

หัวข้อหน้าแสดง 'Chart of Accounts'; ตารางแสดงคอลัมน์ Code, Account name, Debit / Credit, Type, Status; มีแถบ pagination ด้านล่าง

---

## TC-COA-010002 — ค้นหาบัญชีด้วยรหัสหรือชื่อบัญชี

> **As a** Admin user, **I want** this Chart Of Accounts interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

อยู่ที่หน้า /config/chart-of-accounts; มีบัญชีหลายรายการ

**Steps**

1. คลิกช่อง Search
2. พิมพ์รหัสหรือชื่อบัญชีที่มีอยู่จริง
3. กด Enter

**Expected**

ตารางแสดงเฉพาะแถวที่ตรงกับคำค้น

---

## TC-COA-010003 — ล้างคำค้นด้วยปุ่มกากบาทในช่องค้นหา

> **As a** Admin user, **I want** this Chart Of Accounts interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

ค้นหาไปแล้วอย่างน้อย 1 ครั้งและช่อง Search ยังมีข้อความอยู่

**Steps**

1. ค้นหาจนรายการถูกกรอง
2. คลิกปุ่มกากบาท (Clear search) ท้ายช่องค้นหา

**Expected**

ช่องค้นหาว่าง และตารางกลับมาแสดงรายการทั้งหมดอีกครั้ง

---

## TC-COA-010004 — กรองตามสถานะ Active / Inactive

> **As a** Admin user, **I want** to filter the Chart Of Accounts list, **so that** I can narrow results to relevant records.

**Priority:** High · **Test Type:** Functional

**Preconditions**

มีบัญชีทั้งสถานะ active และ inactive ใน BU BLAVG

**Steps**

1. คลิกปุ่ม Filter
2. เลือก Status = Active
3. ปิดเมนูตัวกรอง

**Expected**

ตารางแสดงเฉพาะแถวที่ Status badge เป็น Active; ปุ่ม Filter แสดง badge จำนวนตัวกรองที่ใช้งาน

---

## TC-COA-020001 — เปิดหน้ารายละเอียดบัญชีจากคอลัมน์ Code

> **As a** Admin user, **I want** this Chart Of Accounts behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Happy Path

**Preconditions**

มีบัญชีอย่างน้อย 1 รายการที่ทราบค่าทุกช่อง

**Steps**

1. คลิกที่รหัสบัญชีในคอลัมน์ Code ของแถวที่ต้องการ

**Expected**

เปิดหน้ารายละเอียด /config/chart-of-accounts/:id ในโหมดดู (มีปุ่ม Edit) และแสดงรหัสบัญชีของแถวที่คลิก

---

## TC-COA-020002 — ยกเลิกการแก้ไขด้วยปุ่ม Cancel โดยไม่บันทึก

> **As a** Admin user, **I want** this Chart Of Accounts behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Alternate Flow

**Preconditions**

เปิดหน้ารายละเอียดบัญชีอยู่

**Steps**

1. เปิดหน้ารายละเอียดบัญชี
2. คลิก Edit
3. แก้ค่าในช่อง Account Description (English)
4. คลิกปุ่ม Cancel (และยืนยันทิ้งการแก้ไขถ้ามี prompt)

**Expected**

กลับสู่โหมดดู (มีปุ่ม Edit) โดยไม่มี toast บันทึกสำเร็จ

---

## TC-COA-030001 — สร้างบัญชีใหม่ (Assets + Balance sheet)

> **As a** Admin user, **I want** to create a new Chart Of Accounts record, **so that** it becomes available for downstream operations.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG; เตรียมรหัสบัญชีที่ยังไม่ถูกใช้งาน

**Steps**

1. คลิกปุ่ม New (ไปที่ /config/chart-of-accounts/new)
2. กรอก Code และ Account Description (English)
3. เลือก Category = Assets และ Type = Balance sheet
4. คลิกปุ่ม Create

**Expected**

แสดง toast สร้างสำเร็จ; กลับไปหน้า list; แถวใหม่ปรากฏในตาราง

---

## TC-COA-030003 — สร้างบัญชีโดยปิดสถานะใช้งานตั้งแต่ต้น

> **As a** Admin user, **I want** to create a new Chart Of Accounts record, **so that** it becomes available for downstream operations.

**Priority:** Medium · **Test Type:** CRUD

**Preconditions**

อยู่ที่หน้า /config/chart-of-accounts/new

**Steps**

1. กรอก Code, Account Description (English), Category และ Type
2. สลับสวิตช์สถานะให้เป็น inactive
3. คลิกปุ่ม Create

**Expected**

บัญชีถูกสร้างพร้อม toast สำเร็จ; แถวใหม่ในตารางแสดงสถานะ Inactive

---

## TC-COA-040001 — แก้ไขชื่อบัญชีแล้วค่าคงอยู่

> **As a** Admin user, **I want** to edit an existing Chart Of Accounts record, **so that** its data stays accurate.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

มีบัญชีที่สร้างไว้จากเคสก่อนหน้า (หรือบัญชีทดสอบที่แก้ไขได้)

**Steps**

1. ค้นหาบัญชีที่ CODE
2. คลิกรหัสบัญชีเพื่อเปิดหน้ารายละเอียด
3. คลิก Edit แล้วแก้ช่อง Account Description (English)
4. คลิกปุ่ม Save

**Expected**

แสดง toast อัปเดตสำเร็จ; กลับหน้า list; คอลัมน์ Account name เป็นค่าใหม่

---

## TC-COA-050001 — ลบบัญชีจากเมนู Row actions

> **As a** Admin user, **I want** to delete a Chart Of Accounts record, **so that** the list reflects only valid entries.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

มีบัญชีทดสอบที่ลบได้ (ไม่ถูกอ้างอิงจากที่อื่น)

**Steps**

1. ค้นหาบัญชีที่ CODE2
2. คลิกปุ่ม Row actions ท้ายแถว
3. เลือกเมนู Delete
4. ยืนยันใน dialog ยืนยันการลบ

**Expected**

Dialog ยืนยันแสดง; หลังยืนยันแสดง toast ลบสำเร็จ และแถวนั้นหายจากรายการ

---

## TC-COA-050002 — ยกเลิกการลบใน dialog ยืนยัน

> **As a** Admin user, **I want** this Chart Of Accounts behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Alternate Flow

**Preconditions**

มีบัญชีอย่างน้อย 1 รายการในตาราง

**Steps**

1. คลิกปุ่ม Row actions ท้ายแถว แล้วเลือก Delete
2. ใน dialog ยืนยัน คลิก Cancel

**Expected**

Dialog ปิดลงโดยไม่มี toast ลบสำเร็จ; แถวเดิมยังอยู่ในตาราง

---

## TC-COA-200001 — บันทึกไม่ได้เมื่อเว้นรหัสบัญชีว่าง

> **As a** Admin user, **I want** the system to block invalid Chart Of Accounts submissions, **so that** data quality is preserved.

**Priority:** High · **Test Type:** Validation

**Preconditions**

อยู่ที่หน้า /config/chart-of-accounts/new

**Steps**

1. ปล่อยช่อง Code ว่างไว้
2. กรอกเฉพาะ Account Description (English)
3. คลิกปุ่ม Create

**Expected**

ไม่บันทึก: ยังอยู่ที่ /new และช่อง Code ถูกทำเครื่องหมายผิดพลาด (aria-invalid)

---

## TC-COA-200002 — บันทึกไม่ได้เมื่อเว้นชื่อบัญชีว่าง

> **As a** Admin user, **I want** the system to block invalid Chart Of Accounts submissions, **so that** data quality is preserved.

**Priority:** High · **Test Type:** Validation

**Preconditions**

อยู่ที่หน้า /config/chart-of-accounts/new

**Steps**

1. กรอกเฉพาะช่อง Code
2. ปล่อยช่อง Account Description (English) ว่างไว้
3. คลิกปุ่ม Create

**Expected**

ไม่บันทึก: ยังอยู่ที่ /new และช่อง Account Description (English) ถูกทำเครื่องหมายผิดพลาด (aria-invalid)

---

## TC-COA-200003 — ช่องคำอธิบายภาษาไทยไม่บังคับ — ปล่อยว่างแล้วบันทึกได้

> **As a** Admin user, **I want** the system to block invalid Chart Of Accounts submissions, **so that** data quality is preserved.

**Priority:** Medium · **Test Type:** Validation

**Preconditions**

อยู่ที่หน้า /config/chart-of-accounts/new; เตรียมรหัสบัญชีที่ยังไม่ถูกใช้

**Steps**

1. กรอก Code, Account Description (English), Category และ Type
2. ปล่อยช่อง Account Description (Thai) ว่าง
3. คลิกปุ่ม Create

**Expected**

บัญชีถูกสร้างสำเร็จพร้อม toast (ช่องคำอธิบายภาษาไทยไม่บังคับ)

---

## TC-COA-900001 — ช่องกรอกจำกัดความยาวสูงสุดตามที่กำหนด

> **As a** Admin user, **I want** this Chart Of Accounts behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Low · **Test Type:** Edge Case

**Preconditions**

อยู่ที่หน้า /config/chart-of-accounts/new

**Steps**

1. พิมพ์ข้อความยาวเกิน 50 ตัวอักษรลงในช่อง Code
2. พิมพ์ข้อความยาวเกิน 150 ตัวอักษรลงในช่อง Account Description (English)
3. พิมพ์ข้อความยาวเกิน 150 ตัวอักษรลงในช่อง Account Description (Thai)

**Expected**

ช่อง Code รับได้สูงสุด 50 ตัวอักษร; ช่อง Account name และ Description รับได้สูงสุด 150 ตัวอักษร

---

## TC-COA-900002 — ไม่พบข้อมูล — แสดงสถานะว่างและส่งออกไม่ได้

> **As a** Admin user, **I want** this Chart Of Accounts behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Edge Case

**Preconditions**

อยู่ที่หน้า /config/chart-of-accounts บน desktop

**Steps**

_(no steps documented)_

**Expected**

ตารางไม่มีแถวข้อมูล และมุมมอง List แสดงสถานะว่าง

---


<sub>Last regenerated: 2026-11-24 · git f462816</sub>
