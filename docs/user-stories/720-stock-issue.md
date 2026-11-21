# Stock Issue — User Stories

_Generated from `tests/720-stock-issue.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Stock Issue
**Spec:** `tests/720-stock-issue.spec.ts`
**Default role:** Purchase
**Total test cases:** 25 (4 High / 16 Medium / 5 Low)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-SI-010001 | Happy Path - View Issue List | Medium | Happy Path |
| TC-SI-010003 | Edge Case - No Issues | Medium | Edge Case |
| TC-SI-010004 | Edge Case - Pagination | Medium | Edge Case |
| TC-SI-020001 | View existing issue with all details | Medium | Happy Path |
| TC-SI-020002 | View issue with missing department assignment | Medium | Edge Case |
| TC-SI-020003 | View issue without view permission | High | Negative |
| TC-SI-030001 | Happy Path - Search by SR Reference Number | Medium | Happy Path |
| TC-SI-030002 | Negative Case - Invalid Search Term | Medium | Negative |
| TC-SI-030003 | Edge Case - Empty Search Term | Low | Edge Case |
| TC-SI-030004 | Negative Case - No Permission | High | Negative |
| TC-SI-030005 | Edge Case - Multiple Filters | Medium | Edge Case |
| TC-SI-040001 | Happy Path - View Full SR from Issue Detail | Medium | Happy Path |
| TC-SI-040002 | Negative - No SR View Permission | Medium | Negative |
| TC-SI-040003 | Edge Case - Empty SR Reference Link | Low | Edge Case |
| TC-SI-040004 | Negative - User at Issue Stage No Permissions | Medium | Negative |
| TC-SI-040005 | Happy Path - Print SR | Low | Happy Path |
| TC-SI-050001 | Happy Path: Warehouse Staff prints a stock issue document | High | Happy Path |
| TC-SI-050002 | Negative: User without permission attempts to print | Medium | Negative |
| TC-SI-050003 | Edge Case: Multiple items with zero quantity | Low | Edge Case |
| TC-SI-050004 | Negative: Issue does not exist | Medium | Negative |
| TC-SI-050005 | Edge Case: Issue at Cancel stage | Low | Edge Case |
| TC-SI-060001 | Happy Path - View Expense Allocation | High | Happy Path |
| TC-SI-060002 | Negative - No Permission to View Costs | Medium | Negative |
| TC-SI-060003 | Edge Case - SR with No Expense Allocation | Medium | Edge Case |
| TC-SI-060004 | Negative - Invalid SR ID | Medium | Negative |

---

## TC-SI-010001 — Happy Path - View Issue List

> **As a** Purchase user, **I want** this Stock Issue behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Happy Path

**Preconditions**

ผู้ใช้มีสิทธิ์เข้าถึง Stock Issues view และมี permission store_operations.view

**Steps**

1. ไปที่ /store-operation/store-requisition
2. ตรวจสอบว่า summary cards แสดงจำนวนและมูลค่ารวมที่ถูกต้อง
3. ตรวจสอบว่า issue list ถูก filter สำหรับ Issue stage ที่มี DIRECT destinations
4. คลิก row
5. ตรวจสอบว่ารายละเอียด issue ที่เลือกตรงกับ row

**Expected**

Summary cards และ issue list แสดงข้อมูลที่ถูกต้อง ผู้ใช้สามารถดูรายละเอียดของ issues ที่เลือก

---

## TC-SI-010003 — Edge Case - No Issues

> **As a** Purchase user, **I want** this Stock Issue behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Edge Case

**Preconditions**

ผู้ใช้มีสิทธิ์เข้าถึง และไม่มี issues ใน Issue stage ที่มี DIRECT destinations

**Steps**

1. ไปที่ /store-operation/store-requisition
2. ตรวจสอบว่า summary cards แสดง 0 สำหรับทุก counts และ total value
3. ตรวจสอบว่า issue list ว่างเปล่า

**Expected**

Summary cards และ issue list แสดง 0 counts และ empty list

---

## TC-SI-010004 — Edge Case - Pagination

> **As a** Purchase user, **I want** this Stock Issue behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Edge Case

**Preconditions**

ผู้ใช้มีสิทธิ์เข้าถึง Stock Issues view และมี permission store_operations.view

**Steps**

1. ไปที่ /store-operation/store-requisition
2. ตรวจสอบว่า pagination controls มีอยู่
3. กด Next หรือ Previous page button
4. ตรวจสอบว่าหน้า issues ถัดไปหรือก่อนหน้าแสดงขึ้นมา

**Expected**

Pagination controls ทำงานได้และหน้า issues ถัดไปหรือก่อนหน้าแสดงอย่างถูกต้อง

---

## TC-SI-020001 — View existing issue with all details

> **As a** Purchase user, **I want** this Stock Issue behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Happy Path

**Preconditions**

StoreRequisition อยู่ใน Issue stage destinationLocationType เป็น DIRECT และผู้ใช้มี view permission

**Steps**

1. ไปที่ /store-operation/store-requisition
2. คลิก issue row หรือ reference number
3. ตรวจสอบ header พร้อม SR reference, date และ status badge
4. ตรวจสอบ cards ของ From Location, Issue Summary, To Location, Department และ Expense Account
5. ตรวจสอบ items table พร้อมรายละเอียดที่ถูกต้อง
6. ตรวจสอบ tracking info หากมี

**Expected**

ระบบแสดงรายละเอียดทั้งหมดใน issue layout ตามที่คาดหวัง

---

## TC-SI-020002 — View issue with missing department assignment

> **As a** Purchase user, **I want** this Stock Issue behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Edge Case

**Preconditions**

StoreRequisition อยู่ใน Issue stage destinationLocationType เป็น DIRECT ผู้ใช้มี view permission และ department ไม่ถูก assign

**Steps**

1. ไปที่ /store-operation/store-requisition
2. คลิก issue row หรือ reference number
3. ตรวจสอบ header พร้อม SR reference, date และ status badge
4. ตรวจสอบ cards ของ From Location, Issue Summary, To Location และ Expense Account
5. ตรวจสอบ items table พร้อมรายละเอียดที่ถูกต้อง
6. ตรวจสอบ tracking info หากมี

**Expected**

ระบบแสดงรายละเอียดทั้งหมดยกเว้น department card ตามที่คาดหวัง

---

## TC-SI-020003 — View issue without view permission

> **As a** Purchase user, **I want** this Stock Issue behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

Login เป็น carmensoftware.dev+requestor@gmail.com StoreRequisition อยู่ใน Issue stage destinationLocationType เป็น DIRECT และผู้ใช้ไม่มี view permission

**Steps**

1. ไปที่ /store-operation/store-requisition
2. คลิก issue row หรือ reference number
3. ตรวจสอบ error message หรือสัญญาณบอกว่าถูกจำกัดสิทธิ์

**Expected**

ระบบจำกัดการเข้าถึงหรือแสดง error message ตามที่คาดหวัง

---

## TC-SI-030001 — Happy Path - Search by SR Reference Number

> **As a** Purchase user, **I want** this Stock Issue behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Happy Path

**Preconditions**

ผู้ใช้มีสิทธิ์เข้าถึง Stock Issues view

**Steps**

1. ไปที่ /store-operation/store-requisition
2. กรอก search term 'SR-12345' ใน search box
3. เลือก status filter 'All'
4. รอให้ list อัปเดต
5. ตรวจสอบว่า SR 'SR-12345' แสดงใน list

**Expected**

SR 'SR-12345' แสดงใน list พร้อมรายละเอียดที่เกี่ยวข้องอย่างถูกต้อง

---

## TC-SI-030002 — Negative Case - Invalid Search Term

> **As a** Purchase user, **I want** this Stock Issue behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Negative

**Preconditions**

ผู้ใช้มีสิทธิ์เข้าถึง Stock Issues view

**Steps**

1. ไปที่ /store-operation/store-requisition
2. กรอก search term 'InvalidSR' ใน search box
3. เลือก status filter 'All'
4. รอให้ list อัปเดต
5. ตรวจสอบว่าไม่มี SRs แสดง

**Expected**

ไม่มี SRs แสดงใน list

---

## TC-SI-030003 — Edge Case - Empty Search Term

> **As a** Purchase user, **I want** this Stock Issue behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Low · **Test Type:** Edge Case

**Preconditions**

ผู้ใช้มีสิทธิ์เข้าถึง Stock Issues view

**Steps**

1. ไปที่ /store-operation/store-requisition
2. clear search term ใน search box
3. เลือก status filter 'All'
4. รอให้ list อัปเดต
5. ตรวจสอบว่า SRs ทั้งหมดแสดงขึ้นมา

**Expected**

SRs ทั้งหมดแสดงใน list

---

## TC-SI-030004 — Negative Case - No Permission

> **As a** Purchase user, **I want** this Stock Issue behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

Login เป็น carmensoftware.dev+requestor@gmail.com และไม่มีสิทธิ์เข้าถึง Stock Issues view

**Steps**

1. ไปที่ /store-operation/store-requisition
2. พยายามกรอก search term ใน search box

**Expected**

ผู้ใช้ถูก redirect ไปยังหน้า permission denied หรือ error message แสดงขึ้นมา

---

## TC-SI-030005 — Edge Case - Multiple Filters

> **As a** Purchase user, **I want** this Stock Issue behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Edge Case

**Preconditions**

ผู้ใช้มีสิทธิ์เข้าถึง Stock Issues view

**Steps**

1. ไปที่ /store-operation/store-requisition
2. กรอก search term 'SR-12345' ใน search box
3. เลือก status filter 'Active'
4. กด dropdown 'From Location'
5. เลือก 'Warehouse A' จาก dropdown
6. กด dropdown 'To Location'
7. เลือก 'Warehouse B' จาก dropdown
8. กด dropdown 'Department'
9. เลือก 'Sales' จาก dropdown
10. รอให้ list อัปเดต
11. ตรวจสอบว่า SR 'SR-12345' ที่มีสถานะ 'Active' จาก 'Warehouse A' ไปยัง 'Warehouse B' และอยู่ใน department 'Sales' แสดงขึ้นมา

**Expected**

SR 'SR-12345' ที่ตรงกับ filters ที่กำหนดแสดงใน list

---

## TC-SI-040001 — Happy Path - View Full SR from Issue Detail

> **As a** Purchase user, **I want** this Stock Issue behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Happy Path

**Preconditions**

Login เป็น carmensoftware.dev+purchase@gmail.com มี SR view permission และ Issue view แสดงอยู่

**Steps**

1. ไปที่ /store-operation/store-requisition
2. กด 'View Full SR'
3. ตรวจสอบว่าหน้า Store Requisition detail แสดงขึ้นมา

**Expected**

ผู้ใช้ถูกนำทางไปยังหน้า Store Requisition detail ซึ่งสามารถดูข้อมูลที่เกี่ยวข้องทั้งหมดและดำเนินการได้หากมีสิทธิ์

---

## TC-SI-040002 — Negative - No SR View Permission

> **As a** Purchase user, **I want** this Stock Issue behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Negative

**Preconditions**

Login เป็น carmensoftware.dev+requestor@gmail.com แต่ไม่มี SR view permission และ Issue view แสดงอยู่

**Steps**

1. ไปที่ /store-operation/store-requisition?view=all-document
2. ตรวจสอบว่ารายการว่างและไม่มีปุ่ม View Full SR

**Expected**

รายการ SR ของ requestor ว่าง (สิทธิ์ view เห็นเฉพาะใบที่ตัวเองเป็นผู้ขอ) จึงไม่มีใบให้เปิดและไม่มีปุ่ม View Full SR

---

## TC-SI-040003 — Edge Case - Empty SR Reference Link

> **As a** Purchase user, **I want** this Stock Issue behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Low · **Test Type:** Edge Case

**Preconditions**

ผู้ใช้มี SR view permission และ Issue view แสดงพร้อม SR reference link ที่ว่างเปล่า

**Steps**

1. ไปที่ /store-operation/store-requisition
2. กด 'View Full SR' (link ว่างเปล่า)
3. ตรวจสอบว่า error message แสดงขึ้นมา

**Expected**

Error message แสดงว่า SR reference link ไม่ถูกต้องหรือว่างเปล่า

---

## TC-SI-040004 — Negative - User at Issue Stage No Permissions

> **As a** Purchase user, **I want** this Stock Issue behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Negative

**Preconditions**

Login เป็น carmensoftware.dev+purchase@gmail.com มี SR view permission และ Issue view แสดงพร้อม SR ใน Issue stage

**Steps**

1. ไปที่ /store-operation/store-requisition
2. กด 'View Full SR'
3. กด 'Complete'
4. ตรวจสอบว่า error message แสดงขึ้นมา

**Expected**

Error message แสดงว่าผู้ใช้ไม่มีสิทธิ์ complete SR

---

## TC-SI-040005 — Happy Path - Print SR

> **As a** Purchase user, **I want** this Stock Issue behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Low · **Test Type:** Happy Path

**Preconditions**

Login เป็น carmensoftware.dev+purchase@gmail.com มี SR view และ print permission และ Issue view แสดงพร้อม SR ใน Issue stage

**Steps**

1. ไปที่ /store-operation/store-requisition
2. กด 'View Full SR'
3. กด 'Print'
4. ตรวจสอบว่า print dialog หรือ confirmation message แสดงขึ้นมา

**Expected**

Print dialog หรือ confirmation message แสดงขึ้นมาเพื่อให้ผู้ใช้ print SR ได้

---

## TC-SI-050001 — Happy Path: Warehouse Staff prints a stock issue document

> **As a** Purchase user, **I want** this Stock Issue behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Happy Path

**Preconditions**

Issue อยู่ใน Issue/Complete stage และผู้ใช้มี view permission

**Steps**

1. ไปที่ /store-operation/store-requisition
2. กด 'Print' button
3. ตรวจสอบว่าเอกสารถูกสร้างพร้อม header, location information, items list และ signature fields
4. Browser print dialog เปิดขึ้นมา

**Expected**

เอกสารถูก print สำเร็จพร้อมข้อมูลที่จำเป็นทั้งหมด

---

## TC-SI-050002 — Negative: User without permission attempts to print

> **As a** Purchase user, **I want** this Stock Issue behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Negative

**Preconditions**

Login เป็น carmensoftware.dev+requestor@gmail.com Issue อยู่ใน Issue/Complete stage แต่ผู้ใช้ไม่มี view permission

**Steps**

1. ไปที่ /store-operation/store-requisition
2. กด 'Print' button
3. ตรวจสอบว่าระบบปฏิเสธสิทธิ์และไม่อนุญาตให้ print

**Expected**

ระบบปฏิเสธการ print เนื่องจาก permissions ไม่เพียงพอ

---

## TC-SI-050003 — Edge Case: Multiple items with zero quantity

> **As a** Purchase user, **I want** this Stock Issue behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Low · **Test Type:** Edge Case

**Preconditions**

Issue มี items หลายรายการ บางรายการมี quantity เป็นศูนย์

**Steps**

1. ไปที่ /store-operation/store-requisition
2. กด 'Print' button
3. ตรวจสอบว่าเอกสารแสดงเฉพาะ items ที่มี quantity ไม่ใช่ศูนย์

**Expected**

เอกสารไม่แสดง items ที่มี quantity เป็นศูนย์

---

## TC-SI-050004 — Negative: Issue does not exist

> **As a** Purchase user, **I want** this Stock Issue behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Negative

**Preconditions**

Issue ไม่มีอยู่ในระบบ

**Steps**

1. ไปที่ /store-operation/store-requisition
2. กด 'Print' button
3. ตรวจสอบว่าระบบแสดง error message

**Expected**

ระบบแสดง error message ว่า issue ไม่มีอยู่

---

## TC-SI-050005 — Edge Case: Issue at Cancel stage

> **As a** Purchase user, **I want** this Stock Issue behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Low · **Test Type:** Edge Case

**Preconditions**

Issue มีอยู่แต่อยู่ใน Cancel stage

**Steps**

1. ไปที่ /store-operation/store-requisition
2. กด 'Print' button
3. ตรวจสอบว่าระบบแสดง error message

**Expected**

ระบบแสดง error message ว่า issue อยู่ใน Cancel stage และไม่สามารถ print ได้

---

## TC-SI-060001 — Happy Path - View Expense Allocation

> **As a** Purchase user, **I want** this Stock Issue behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Happy Path

**Preconditions**

สถานะ SR เป็น Completed และผู้ใช้มี permission ดู costs

**Steps**

1. ไปที่ /store-operation/store-requisition
2. กด 'View Expense Allocation'

**Expected**

รายละเอียด expense allocation แสดงขึ้นมา: Department, Expense Account, Total Value expensed และ items พร้อม individual costs

---

## TC-SI-060002 — Negative - No Permission to View Costs

> **As a** Purchase user, **I want** this Stock Issue behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Negative

**Preconditions**

Login เป็น carmensoftware.dev+requestor@gmail.com สถานะ SR เป็น Completed และผู้ใช้ไม่มี permission ดู costs

**Steps**

1. ไปที่ /store-operation/store-requisition?view=all-document
2. ตรวจสอบว่ารายการว่างและไม่มีปุ่ม View Expense Allocation

**Expected**

รายการ SR ของ requestor ว่าง จึงไม่มีใบให้เปิดและไม่มีปุ่ม View Expense Allocation (ดู costs ไม่ได้)

---

## TC-SI-060003 — Edge Case - SR with No Expense Allocation

> **As a** Purchase user, **I want** this Stock Issue behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Edge Case

**Preconditions**

สถานะ SR เป็น Completed ผู้ใช้มี permission ดู costs และ SR ไม่มี expense allocation

**Steps**

1. ไปที่ /store-operation/store-requisition
2. กด 'View Expense Allocation'

**Expected**

ระบบแสดง message ว่าไม่มี expense allocation

---

## TC-SI-060004 — Negative - Invalid SR ID

> **As a** Purchase user, **I want** this Stock Issue behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Negative

**Preconditions**

ผู้ใช้มี permission ดู costs

**Steps**

1. ไปที่ /store-operation/store-requisition
2. กด 'View Expense Allocation'

**Expected**

ระบบแสดง message ว่า SR ID ไม่ถูกต้อง

---


<sub>Last regenerated: 2026-11-21 · git c6e714b</sub>
