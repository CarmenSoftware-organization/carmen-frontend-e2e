# Stock Issue — User Stories

_Generated from `tests/720-stock-issue.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Stock Issue
**Spec:** `tests/720-stock-issue.spec.ts`
**Default role:** Purchase
**Total test cases:** 20 (8 High / 11 Medium / 1 Low)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-SI-010001 | Happy Path - View Issue List | High | Smoke |
| TC-SI-010003 | Edge Case - ไม่มีรายการที่ตรงคำค้น แสดง empty state | Medium | Edge Case |
| TC-SI-010004 | Edge Case - Pagination เปลี่ยนหน้าแสดงแถวชุดถัดไป | Medium | Edge Case |
| TC-SI-020001 | View existing issue with all details | High | Smoke |
| TC-SI-020002 | View issue with missing department assignment | Medium | Edge Case |
| TC-SI-020003 | เปิด URL ของ SR ที่คนอื่นสร้างโดยตรงไม่ได้ (ไม่เห็นข้อมูลเอกสาร) | High | Authorization |
| TC-SI-030001 | Happy Path - Search by SR Reference Number | High | Functional |
| TC-SI-030002 | Negative Case - Invalid Search Term | Medium | Negative |
| TC-SI-030003 | Edge Case - ล้างคำค้นแล้วรายการกลับมาครบ | Medium | Edge Case |
| TC-SI-030004 | Requestor ค้นหาเลข SR ของคนอื่นไม่พบ (scope เฉพาะเอกสารของตัวเอง) | High | Authorization |
| TC-SI-030005 | Edge Case - สลับ scope (My pending) แล้วคำค้นถูกล้างและรายการเป็นของ scope ใหม่ | Medium | Edge Case |
| TC-SI-040002 | Negative - Requestor ไม่เห็น SR ของคนอื่นใน All Documents (scope เฉพาะของตัวเอง) | High | Authorization |
| TC-SI-040004 | Negative - SR ที่ขั้น Issue ไม่มีปุ่ม action เดินเอกสารสำหรับ Purchase | Medium | Negative |
| TC-SI-040005 | Happy Path - Print SR เปิดหน้า report viewer | High | Functional |
| TC-SI-050001 | Happy Path: Warehouse Staff prints a stock issue document | High | Functional |
| TC-SI-050002 | Negative: Requestor เปิดเอกสารของคนอื่นเพื่อพิมพ์ไม่ได้ (ไม่มีปุ่ม Print) | Medium | Authorization |
| TC-SI-050003 | Edge Case: รายการที่ยังไม่ได้ issue (Issued = 0) แสดงเป็น 0.00 | Low | Edge Case |
| TC-SI-050004 | Negative: Issue does not exist | Medium | Negative |
| TC-SI-050005 | Edge Case: Issue at Cancel stage (SR ที่ void แล้ว) | Medium | Edge Case |
| TC-SI-060004 | Negative - Invalid SR ID | Medium | Negative |

---

## TC-SI-010001 — Happy Path - View Issue List

> **As a** Purchase user, **I want** the Stock Issue list page to load successfully, **so that** I can manage Stock Issue records.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

เข้าสู่ระบบเป็น Purchase (Warehouse/Store Staff); active BU = TEST BU; ข้อมูล SR จาก data:reset

**Steps**

1. ไปที่ /store-operation/store-requisition
2. เปิด All Documents

**Expected**

แสดงหัวคอลัมน์ SR No./Status และแถว SR ทุกใบของ BU (เลขเอกสารตรงกับ API)

---

## TC-SI-010003 — Edge Case - ไม่มีรายการที่ตรงคำค้น แสดง empty state

> **As a** Purchase user, **I want** this Stock Issue behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Edge Case

**Preconditions**

เข้าสู่ระบบเป็น Purchase (Warehouse/Store Staff); active BU = TEST BU; ข้อมูล SR จาก data:reset

**Steps**

1. เปิด All Documents
2. ค้นหาคำที่ไม่มี SR ตรง

**Expected**

ไม่มีแถว SR และแสดงข้อความ 'No data found'

---

## TC-SI-010004 — Edge Case - Pagination เปลี่ยนหน้าแสดงแถวชุดถัดไป

> **As a** Purchase user, **I want** this Stock Issue behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Edge Case

**Preconditions**

เข้าสู่ระบบเป็น Purchase (Warehouse/Store Staff); active BU = TEST BU; ข้อมูล SR จาก data:reset; BU มี SR > 5 ใบ

**Steps**

1. เปิด All Documents ด้วย perpage=5
2. กดหน้าถัดไป

**Expected**

หน้าแรกมี 5 แถว; หน้า 2 (page=2 ใน URL) มีแถวที่เหลือและเป็นคนละชุดกับหน้าแรก

---

## TC-SI-020001 — View existing issue with all details

> **As a** Purchase user, **I want** core Stock Issue interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

เข้าสู่ระบบเป็น Purchase (Warehouse/Store Staff); active BU = TEST BU; ข้อมูล SR จาก data:reset; SR261100003 อยู่ที่ขั้น Issue

**Steps**

1. เปิด All Documents
2. เปิด SR ที่อยู่ขั้น Issue

**Expected**

หน้ารายละเอียดแสดงเลข SR, สถานะ In progress, Request From/Deliver To ตรงกับ API และรายการสินค้าครบ

---

## TC-SI-020002 — View issue with missing department assignment

> **As a** Purchase user, **I want** this Stock Issue behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Edge Case

**Preconditions**

เข้าสู่ระบบเป็น Purchase (Warehouse/Store Staff); active BU = TEST BU; ข้อมูล SR จาก data:reset; มี SR ที่ department_name ว่าง

**Steps**

1. เปิดรายละเอียดของ SR ที่ไม่มี department

**Expected**

หน้ารายละเอียดเปิดได้ปกติ (ไม่เกิด error) และแสดงเลข SR กับรายการสินค้า

---

## TC-SI-020003 — เปิด URL ของ SR ที่คนอื่นสร้างโดยตรงไม่ได้ (ไม่เห็นข้อมูลเอกสาร)

> **As a** low-privilege user, **I should NOT** see Add/edit controls on Stock Issue, **so that** role separation is enforced.

**Priority:** High · **Test Type:** Authorization

**Preconditions**

เข้าสู่ระบบเป็น Requestor (เห็นเฉพาะ SR ที่ตัวเองสร้าง); TEST BU มี SR ที่สร้างโดย Purchase

**Steps**

1. เปิด /store-operation/store-requisition/<id ของ SR ที่ Purchase สร้าง> โดยตรง

**Expected**

หน้าแสดง error state ('Something went wrong') และไม่แสดงเลข SR หรือรายการสินค้า

---

## TC-SI-030001 — Happy Path - Search by SR Reference Number

> **As a** Purchase user, **I want** this Stock Issue interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

เข้าสู่ระบบเป็น Purchase (Warehouse/Store Staff); active BU = TEST BU; ข้อมูล SR จาก data:reset

**Steps**

1. เปิด All Documents
2. ค้นหาเลข SR ใบหนึ่งแล้วกด Enter

**Expected**

เหลือเฉพาะแถวของ SR นั้นใบเดียว

---

## TC-SI-030002 — Negative Case - Invalid Search Term

> **As a** Purchase user, **I want** this Stock Issue behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Negative

**Preconditions**

เข้าสู่ระบบเป็น Purchase (Warehouse/Store Staff); active BU = TEST BU; ข้อมูล SR จาก data:reset

**Steps**

1. เปิด All Documents
2. ค้นหา '__INVALID_SR_E2E__'

**Expected**

ไม่มีแถว SR และแสดง 'No data found'

---

## TC-SI-030003 — Edge Case - ล้างคำค้นแล้วรายการกลับมาครบ

> **As a** Purchase user, **I want** this Stock Issue behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Edge Case

**Preconditions**

เข้าสู่ระบบเป็น Purchase (Warehouse/Store Staff); active BU = TEST BU; ข้อมูล SR จาก data:reset

**Steps**

1. ค้นหาเลข SR
2. ล้างช่องค้นหาแล้วกด Enter

**Expected**

จำนวนแถวกลับมาเท่ากับจำนวน SR ใน API

---

## TC-SI-030004 — Requestor ค้นหาเลข SR ของคนอื่นไม่พบ (scope เฉพาะเอกสารของตัวเอง)

> **As a** low-privilege user, **I should NOT** see Add/edit controls on Stock Issue, **so that** role separation is enforced.

**Priority:** High · **Test Type:** Authorization

**Preconditions**

เข้าสู่ระบบเป็น Requestor (เห็นเฉพาะ SR ที่ตัวเองสร้าง); TEST BU มี SR ที่สร้างโดย Purchase

**Steps**

1. เปิด All Documents
2. ค้นหาเลข SR ที่ Purchase สร้าง

**Expected**

ไม่มีแถว SR และแสดง 'No data found' (ไม่มีแถวรั่วมาจาก SR ของคนอื่น)

---

## TC-SI-030005 — Edge Case - สลับ scope (My pending) แล้วคำค้นถูกล้างและรายการเป็นของ scope ใหม่

> **As a** Purchase user, **I want** this Stock Issue behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Edge Case

**Preconditions**

เข้าสู่ระบบเป็น Purchase (Warehouse/Store Staff); active BU = TEST BU; ข้อมูล SR จาก data:reset

**Steps**

1. เปิด All Documents และค้นหาเลข SR
2. สลับไป My pending

**Expected**

URL เป็น view=my-pending โดยไม่มี search และช่องค้นหาว่าง (การสลับ scope ล้างคำค้น)

---

## TC-SI-040002 — Negative - Requestor ไม่เห็น SR ของคนอื่นใน All Documents (scope เฉพาะของตัวเอง)

> **As a** low-privilege user, **I should NOT** see Add/edit controls on Stock Issue, **so that** role separation is enforced.

**Priority:** High · **Test Type:** Authorization

**Preconditions**

เข้าสู่ระบบเป็น Requestor (เห็นเฉพาะ SR ที่ตัวเองสร้าง); TEST BU มี SR ที่สร้างโดย Purchase

**Steps**

1. เปิด All Documents

**Expected**

ไม่มีแถว SR ที่คนอื่นสร้าง (SR ของ data:reset ทุกใบไม่ขึ้น); ถ้า Requestor ไม่มี SR ของตัวเองเลย แสดง 'No data found'

---

## TC-SI-040004 — Negative - SR ที่ขั้น Issue ไม่มีปุ่ม action เดินเอกสารสำหรับ Purchase

> **As a** Purchase user, **I want** this Stock Issue behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Negative

**Preconditions**

เข้าสู่ระบบเป็น Purchase (Warehouse/Store Staff); active BU = TEST BU; ข้อมูล SR จาก data:reset; SR261100003 อยู่ที่ขั้น Issue และ Purchase ไม่ใช่ผู้รับผิดชอบขั้นนี้

**Steps**

1. เปิดรายละเอียด SR ที่อยู่ขั้น Issue

**Expected**

ไม่มีปุ่ม Issue/Approve/Reject/Submit ในหน้า (มีเพียง Edit/Duplicate/Print/Comment/Activity)

---

## TC-SI-040005 — Happy Path - Print SR เปิดหน้า report viewer

> **As a** Purchase user, **I want** this Stock Issue interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

เข้าสู่ระบบเป็น Purchase (Warehouse/Store Staff); active BU = TEST BU; ข้อมูล SR จาก data:reset

**Steps**

1. เปิดรายละเอียด SR
2. กดปุ่ม Print

**Expected**

ยิง GET .../store-requisitions/{id}/print-viewer สำเร็จและเปิด popup ของ report viewer

---

## TC-SI-050001 — Happy Path: Warehouse Staff prints a stock issue document

> **As a** Purchase user, **I want** this Stock Issue interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

เข้าสู่ระบบเป็น Purchase (Warehouse/Store Staff); active BU = TEST BU; ข้อมูล SR จาก data:reset; SR ที่ขั้น Issue

**Steps**

1. เปิดรายละเอียด SR ที่ขั้น Issue
2. กดปุ่ม Print

**Expected**

ยิง print-viewer สำเร็จ (200) และเปิดหน้า report viewer

---

## TC-SI-050002 — Negative: Requestor เปิดเอกสารของคนอื่นเพื่อพิมพ์ไม่ได้ (ไม่มีปุ่ม Print)

> **As a** low-privilege user, **I should NOT** see Add/edit controls on Stock Issue, **so that** role separation is enforced.

**Priority:** Medium · **Test Type:** Authorization

**Preconditions**

เข้าสู่ระบบเป็น Requestor (เห็นเฉพาะ SR ที่ตัวเองสร้าง); TEST BU มี SR ที่สร้างโดย Purchase

**Steps**

1. เปิดรายละเอียด SR ที่ Purchase สร้างโดยตรง

**Expected**

แสดง error state และไม่มีปุ่ม Print

---

## TC-SI-050003 — Edge Case: รายการที่ยังไม่ได้ issue (Issued = 0) แสดงเป็น 0.00

> **As a** Purchase user, **I want** this Stock Issue behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Low · **Test Type:** Edge Case

**Preconditions**

เข้าสู่ระบบเป็น Purchase (Warehouse/Store Staff); active BU = TEST BU; ข้อมูล SR จาก data:reset; SR261100003 ยังไม่ issue สินค้าใด

**Steps**

1. เปิดรายละเอียด SR ที่ขั้น Issue
2. ตรวจคอลัมน์ Issued ในแท็บ Items

**Expected**

ทุกแถวสินค้าแสดงจำนวน Issued 0.00 และตารางไม่ error

---

## TC-SI-050004 — Negative: Issue does not exist

> **As a** Purchase user, **I want** this Stock Issue behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Negative

**Preconditions**

เข้าสู่ระบบเป็น Purchase (Warehouse/Store Staff); active BU = TEST BU; ข้อมูล SR จาก data:reset

**Steps**

1. เปิด /store-operation/store-requisition/<uuid ที่ไม่มี>

**Expected**

แสดง error state พร้อมปุ่ม Try again และไม่มีข้อมูลเอกสาร

---

## TC-SI-050005 — Edge Case: Issue at Cancel stage (SR ที่ void แล้ว)

> **As a** Purchase user, **I want** this Stock Issue behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Edge Case

**Preconditions**

เข้าสู่ระบบเป็น Purchase (Warehouse/Store Staff); active BU = TEST BU; ข้อมูล SR จาก data:reset; มี SR สถานะ voided

**Steps**

1. เปิดรายละเอียด SR ที่ void

**Expected**

header แสดงสถานะ Voided และไม่มีปุ่ม Edit

---

## TC-SI-060004 — Negative - Invalid SR ID

> **As a** Purchase user, **I want** this Stock Issue behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Negative

**Preconditions**

เข้าสู่ระบบเป็น Purchase (Warehouse/Store Staff); active BU = TEST BU; ข้อมูล SR จาก data:reset

**Steps**

1. เปิด /store-operation/store-requisition/999

**Expected**

แสดง error state และไม่มีข้อมูลเอกสาร

---


<sub>Last regenerated: 2026-11-24 · git f462816</sub>
