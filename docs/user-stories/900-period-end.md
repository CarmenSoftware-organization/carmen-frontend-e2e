# Period End — User Stories

_Generated from `tests/900-period-end.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Period End
**Spec:** `tests/900-period-end.spec.ts`
**Default role:** Purchase
**Total test cases:** 35 (27 High / 8 Medium / 0 Low)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-PE-010001 | Happy Path - View Current Period | High | Happy Path |
| TC-PE-010002 | Negative - User Without Permission | High | Negative |
| TC-PE-010003 | Edge Case - Empty Period History | Medium | Edge Case |
| TC-PE-010004 | Negative - No Current Period | High | Negative |
| TC-PE-010005 | Edge Case - Closed Current Period | Medium | Edge Case |
| TC-PE-020001 _(skipped)_ | View period detail for open period | High | Happy Path |
| TC-PE-020003 _(skipped)_ | View period detail with no permission | High | Negative |
| TC-PE-020004 _(skipped)_ | View period detail with invalid period ID | Medium | Negative |
| TC-PE-020005 _(skipped)_ | View period detail for period with incomplete validation | Medium | Edge Case |
| TC-PE-030001 _(skipped)_ | Happy Path - Inventory Manager Completes Validation | High | Happy Path |
| TC-PE-030003 _(skipped)_ | Edge Case - Period Already Closed | Medium | Edge Case |
| TC-PE-030004 _(skipped)_ | Negative - Invalid Period ID | High | Negative |
| TC-PE-030005 _(skipped)_ | Edge Case - All Sections Fail Validation | High | Edge Case |
| TC-PE-040001 _(skipped)_ | Close Period - Happy Path | High | Happy Path |
| TC-PE-040002 _(skipped)_ | Close Period - Invalid Input | High | Negative |
| TC-PE-040003 _(skipped)_ | Close Period - Permission Denied | High | Negative |
| TC-PE-040004 _(skipped)_ | Close Period - Database Error | High | Edge Case |
| TC-PE-040005 _(skipped)_ | Close Period - Validation No Longer Passes | High | Negative |
| TC-PE-310001 _(skipped)_ | All transactions posted | High | Happy Path |
| TC-PE-310002 _(skipped)_ | Missing GRN document | High | Negative |
| TC-PE-310003 _(skipped)_ | User without permission | High | Negative |
| TC-PE-310005 _(skipped)_ | Partial transaction types | High | Edge Case |
| TC-PE-320001 _(skipped)_ | Happy Path - Successful Spot Check Validation | High | Happy Path |
| TC-PE-320004 _(skipped)_ | Edge Case - No Spot Checks for Period | Medium | Edge Case |
| TC-PE-320005 _(skipped)_ | Edge Case - Some Spot Checks Incomplete | Medium | Edge Case |
| TC-PE-330001 _(skipped)_ | All Physical Counts Finalized Successfully | High | Happy Path |
| TC-PE-330002 _(skipped)_ | Validation Run with No Physical Counts | High | Edge Case |
| TC-PE-330003 _(skipped)_ | Run Validation with Unauthorized User | High | Negative |
| TC-PE-330004 _(skipped)_ | Physical Count Status Not Finalized | High | Negative |
| TC-PE-330005 _(skipped)_ | Period Date Range Without Physical Counts | High | Edge Case |
| TC-PE-340001 _(skipped)_ | Happy Path - Log Activity Entry | High | Happy Path |
| TC-PE-340002 _(skipped)_ | Negative - Invalid User Credentials | High | Negative |
| TC-PE-340003 _(skipped)_ | Negative - No Permissions | High | Negative |
| TC-PE-340004 _(skipped)_ | Edge Case - No Period ID Provided | High | Edge Case |
| TC-PE-340005 _(skipped)_ | Edge Case - Timestamp Overflow | Medium | Edge Case |

---

## TC-PE-010001 — Happy Path - View Current Period

> **As a** Purchase user, **I want** this Period End behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Happy Path

**Preconditions**

Login เป็น carmensoftware.dev+purchase@gmail.com และมี period view permission

**Steps**

1. ไปที่ /inventory-management/period-end
2. กด 'View Details'

**Expected**

ผู้ใช้ถูกนำทางไปยังหน้า period detail

---

## TC-PE-010002 — Negative - User Without Permission

> **As a** Purchase user, **I want** this Period End behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

Login เป็น carmensoftware.dev+requestor@gmail.com แต่ไม่มี period view permission

**Steps**

1. ไปที่ /inventory-management/period-end

**Expected**

แสดง Permission Denied ทับหน้า (ไม่ redirect) และไม่มีปุ่ม Start Period Close

---

## TC-PE-010003 — Edge Case - Empty Period History

> **As a** Purchase user, **I want** this Period End behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Edge Case

**Preconditions**

ผู้ใช้มี period view permission และไม่มี periods ใน history

**Steps**

1. จำลองหลังบ้านตอบรายการ period history ว่าง (page.route)
2. ไปที่ /inventory-management/period-end

**Expected**

ส่วน History แสดง 'No closed periods yet.' และ current period card ยังคง visible

---

## TC-PE-010004 — Negative - No Current Period

> **As a** Purchase user, **I want** this Period End behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

ผู้ใช้มี period view permission และไม่มี current period

**Steps**

1. จำลองหลังบ้านตอบ /period-ends/current เป็น 404 (page.route)
2. ไปที่ /inventory-management/period-end

**Expected**

แสดงข้อความ 'No current period end found.' ไม่มี current period card และไม่มีปุ่ม Start Period Close ส่วน History ยังแสดง

---

## TC-PE-010005 — Edge Case - Closed Current Period

> **As a** Purchase user, **I want** this Period End behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Edge Case

**Preconditions**

ผู้ใช้มี period view permission และ current period ถูกปิดแล้ว

**Steps**

1. จำลองหลังบ้านตอบ current period สถานะ closed (page.route)
2. ไปที่ /inventory-management/period-end

**Expected**

Current period card แสดงสถานะ Closed และปุ่ม Start Period Close ถูก disable

---

## TC-PE-020001 — View period detail for open period _(skipped)_

> **As a** Purchase user, **I want** this Period End behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Happy Path

**Preconditions**

ผู้ใช้มี permission ดู period detail และมี open period อยู่

**Steps**

1. ไปที่ /inventory-management/period-end/12345
2. กด 'Start Period Close'

**Expected**

ระบบแสดงหน้า period detail พร้อม validation overview, adjustments tab และปุ่ม 'Start Period Close'

---

## TC-PE-020003 — View period detail with no permission _(skipped)_

> **As a** Purchase user, **I want** this Period End behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

Login เป็น carmensoftware.dev+requestor@gmail.com แต่ไม่มี permission ดู period detail

**Steps**

1. ไปที่ /inventory-management/period-end/12345
2. ตรวจสอบว่าระบบ redirect ไปยัง login หรือหน้า permission denied

**Expected**

ระบบ redirect ผู้ใช้ไปยัง login page หรือแสดง permission denied message

---

## TC-PE-020004 — View period detail with invalid period ID _(skipped)_

> **As a** Purchase user, **I want** this Period End behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Negative

**Preconditions**

ผู้ใช้มี permission และ period ID ที่ให้มาไม่ถูกต้อง

**Steps**

1. ไปที่ /inventory-management/period-end/invalid_id
2. ตรวจสอบว่าระบบแสดง error message หรือ redirect ไปยัง home page

**Expected**

ระบบแสดง error message หรือ redirect ผู้ใช้ไปยัง home page

---

## TC-PE-020005 — View period detail for period with incomplete validation _(skipped)_

> **As a** Purchase user, **I want** this Period End behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Edge Case

**Preconditions**

ผู้ใช้มี permission และ period มี validation stages ที่ยังไม่สมบูรณ์

**Steps**

1. ไปที่ /inventory-management/period-end/67890
2. ตรวจสอบว่า validation overview แสดง stages ที่ยังไม่สมบูรณ์และ link 'View Full Validation Details'

**Expected**

ระบบแสดงหน้า period detail พร้อม validation overview ที่บ่งชี้ stages ที่ยังไม่สมบูรณ์และ link 'View Full Validation Details'

---

## TC-PE-030001 — Happy Path - Inventory Manager Completes Validation _(skipped)_

> **As a** Purchase user, **I want** this Period End behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Happy Path

**Preconditions**

ผู้ใช้มี close permission และ period อยู่ใน open หรือ in_progress

**Steps**

1. ไปที่ /inventory-management/period-end/close/[id]
2. ตรวจสอบว่า validation checklist sections แสดงขึ้นมา
3. กด 'Validate All'
4. ตรวจสอบว่า validations ทั้งหมดผ่าน
5. ตรวจสอบว่าปุ่ม 'Close Period' ถูก enable

**Expected**

validation sections ทั้งหมดผ่าน และปุ่ม 'Close Period' ถูก enable

---

## TC-PE-030003 — Edge Case - Period Already Closed _(skipped)_

> **As a** Purchase user, **I want** this Period End behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Edge Case

**Preconditions**

Login เป็น carmensoftware.dev+purchase@gmail.com และ period ถูกปิดแล้ว

**Steps**

1. ไปที่ /inventory-management/period-end/close/[id]
2. ตรวจสอบ error message สำหรับ period ที่ถูกปิดแล้ว

**Expected**

Error message แสดงว่า period ถูกปิดแล้ว

---

## TC-PE-030004 — Negative - Invalid Period ID _(skipped)_

> **As a** Purchase user, **I want** this Period End behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

ผู้ใช้มี close permission

**Steps**

1. ไปที่ /inventory-management/period-end/close/invalid_id
2. ตรวจสอบ error message สำหรับ period ID ที่ไม่ถูกต้อง

**Expected**

Error message แสดงว่า period ID ไม่ถูกต้อง

---

## TC-PE-030005 — Edge Case - All Sections Fail Validation _(skipped)_

> **As a** Purchase user, **I want** this Period End behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Edge Case

**Preconditions**

ผู้ใช้มี close permission และ period อยู่ใน open หรือ in_progress

**Steps**

1. ไปที่ /inventory-management/period-end/close/[id]
2. กด 'Validate All'
3. ตรวจสอบว่า sections ทั้งหมด validation ล้มเหลว
4. ตรวจสอบว่าปุ่ม 'Close Period' ถูก disable

**Expected**

sections ทั้งหมด validation ล้มเหลว และปุ่ม 'Close Period' ยังคง disable

---

## TC-PE-040001 — Close Period - Happy Path _(skipped)_

> **As a** Purchase user, **I want** this Period End behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Happy Path

**Preconditions**

ผู้ใช้มี close permission สถานะ period เป็น closing และ validation stages ทั้ง 3 ผ่าน

**Steps**

1. ไปที่ /procurement/close-workflow
2. กด 'Close Period' button
3. ยืนยัน 'Close Period' dialog
4. ตรวจสอบว่าสถานะ period อัปเดตเป็น 'closed'
5. ตรวจสอบว่า fields closedBy และ closedAt ถูกกรอก
6. ตรวจสอบว่า activity log entry ถูกบันทึก
7. ตรวจสอบว่า transactions สำหรับ period นี้ถูกบล็อก
8. ตรวจสอบว่า success message แสดง
9. ตรวจสอบว่า redirect ไปยัง period list page

**Expected**

Period ถูกปิดสำเร็จ validations ทั้งหมดผ่าน สถานะ period อัปเดต closedBy และ closedAt ถูกกรอก activity log entry ถูกบันทึก transactions ถูกบล็อก success message แสดง และผู้ใช้ถูก redirect ไปยัง period list page

---

## TC-PE-040002 — Close Period - Invalid Input _(skipped)_

> **As a** Purchase user, **I want** this Period End behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

ผู้ใช้มี close permission สถานะ period เป็น closing และ validation stages ทั้ง 3 ผ่าน

**Steps**

1. ไปที่ /procurement/close-workflow
2. กด 'Close Period' button
3. กรอก confirmation ที่ไม่ถูกต้อง
4. ตรวจสอบว่า error message แสดง

**Expected**

Error message แสดงสำหรับ input ที่ไม่ถูกต้อง

---

## TC-PE-040003 — Close Period - Permission Denied _(skipped)_

> **As a** Purchase user, **I want** this Period End behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

Login เป็น carmensoftware.dev+requestor@gmail.com สถานะ period เป็น closing และ validation stages ทั้ง 3 ผ่าน

**Steps**

1. ไปที่ /procurement/close-workflow
2. กด 'Close Period' button
3. ตรวจสอบ 403 Forbidden error

**Expected**

403 Forbidden error แสดงขึ้นมา

---

## TC-PE-040004 — Close Period - Database Error _(skipped)_

> **As a** Purchase user, **I want** this Period End behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Edge Case

**Preconditions**

ผู้ใช้มี close permission สถานะ period เป็น closing และ validation stages ทั้ง 3 ผ่าน

**Steps**

1. ไปที่ /procurement/close-workflow
2. Trigger database error
3. กด 'Close Period' button
4. ตรวจสอบว่า error message พร้อม retry option แสดง

**Expected**

Error message พร้อม retry option แสดงเนื่องจาก database error

---

## TC-PE-040005 — Close Period - Validation No Longer Passes _(skipped)_

> **As a** Purchase user, **I want** this Period End behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

ผู้ใช้มี close permission และสถานะ period เป็น closing

**Steps**

1. ไปที่ /procurement/close-workflow
2. ทำให้ validation stage หนึ่ง fail แบบ manual
3. กด 'Close Period' button
4. ตรวจสอบว่า error message แสดง

**Expected**

Error message แสดงบ่งชี้ว่า validation ล้มเหลว

---

## TC-PE-310001 — All transactions posted _(skipped)_

> **As a** Purchase user, **I want** this Period End behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Happy Path

**Preconditions**

ผู้ใช้มี permission ทำ validation และ transactions ทั้งหมดถูก post แล้ว

**Steps**

1. ไปที่ /period-close
2. กด 'Run Validation'
3. ตรวจสอบว่า transaction statuses ทั้งหมดเป็น 'Posted'

**Expected**

transactions ทั้งหมดถูกรายงานว่า posted และ transactionsCommitted เป็น true

---

## TC-PE-310002 — Missing GRN document _(skipped)_

> **As a** Purchase user, **I want** this Period End behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

ผู้ใช้มี permission ทำ validation และเอกสาร GRN หนึ่งรายการขาดสถานะ 'Posted'

**Steps**

1. ไปที่ /period-close
2. กด 'Run Validation'
3. ตรวจสอบว่าสถานะเอกสาร GRN ไม่ใช่ 'Posted'

**Expected**

เอกสาร GRN ถูก flag ว่า pending และ transactionsCommitted เป็น false

---

## TC-PE-310003 — User without permission _(skipped)_

> **As a** Purchase user, **I want** this Period End behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

ผู้ใช้ไม่มี permission ทำ validation

**Steps**

1. ไปที่ /period-close
2. กด 'Run Validation'

**Expected**

ระบบปฏิเสธสิทธิ์และไม่อนุญาตให้ validation ดำเนินต่อ

---

## TC-PE-310005 — Partial transaction types _(skipped)_

> **As a** Purchase user, **I want** this Period End behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Edge Case

**Preconditions**

ผู้ใช้มี permission ทำ validation และ transaction types บางรายการมีสถานะ pending

**Steps**

1. ไปที่ /period-close
2. กด 'Run Validation'
3. ตรวจสอบ pending statuses สำหรับแต่ละ transaction type

**Expected**

Pending statuses สำหรับแต่ละ transaction type ถูกรายงาน และ transactionsCommitted เป็น false

---

## TC-PE-320001 — Happy Path - Successful Spot Check Validation _(skipped)_

> **As a** Purchase user, **I want** this Period End behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Happy Path

**Preconditions**

Login เป็น carmensoftware.dev+purchase@gmail.com ด้วย credentials ที่ถูกต้องและมี permission ทำ validation

**Steps**

1. ไปที่ /period-close-checklist
2. กด 'Run Validation'
3. ระบบ query spot checks สำหรับ period date range
4. ตรวจสอบว่า spot checks ทั้งหมดมีสถานะ 'completed'
5. SpotChecksComplete ถูกตั้งเป็น true

**Expected**

spot checks ผ่านการตรวจสอบสำเร็จและถูกทำเครื่องหมายเป็น completed ทั้งหมด

---

## TC-PE-320004 — Edge Case - No Spot Checks for Period _(skipped)_

> **As a** Purchase user, **I want** this Period End behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Edge Case

**Preconditions**

ไม่มี spot checks ที่บันทึกไว้สำหรับ validation period

**Steps**

1. ไปที่ /period-close-checklist
2. กด 'Run Validation'
3. ตรวจสอบว่าระบบแสดง message ว่าไม่มี spot checks สำหรับ period

**Expected**

ระบบระบุและแสดงอย่างถูกต้องว่าไม่มี spot checks สำหรับ validation period

---

## TC-PE-320005 — Edge Case - Some Spot Checks Incomplete _(skipped)_

> **As a** Purchase user, **I want** this Period End behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Edge Case

**Preconditions**

spot checks บางรายการถูกทำเครื่องหมายเป็น 'incomplete' สำหรับ validation period

**Steps**

1. ไปที่ /period-close-checklist
2. กด 'Run Validation'
3. ตรวจสอบว่า list ของ spot checks ที่ไม่สมบูรณ์แสดงขึ้นมา
4. ตรวจสอบว่า SpotChecksComplete ถูกตั้งเป็น false

**Expected**

ระบบระบุและแสดง list ของ spot checks ที่ไม่สมบูรณ์อย่างถูกต้อง และตั้งค่า SpotChecksComplete เป็น false

---

## TC-PE-330001 — All Physical Counts Finalized Successfully _(skipped)_

> **As a** Purchase user, **I want** this Period End behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Happy Path

**Preconditions**

ผู้ใช้มี permission ทำ validation และ period date range ถูกกำหนดแล้ว

**Steps**

1. ไปที่ /procurement/validation
2. กด 'Run Validation'
3. ตรวจสอบว่า physical counts ทั้งหมดถูกทำเครื่องหมายเป็น 'finalized'
4. ตรวจสอบว่า GL adjustments สำหรับแต่ละ count ถูก post

**Expected**

physicalCountsFinalized เป็น true และ counts ทั้งหมดถูกทำเครื่องหมายเป็น finalized พร้อม GL adjustments ที่ถูก post

---

## TC-PE-330002 — Validation Run with No Physical Counts _(skipped)_

> **As a** Purchase user, **I want** this Period End behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Edge Case

**Preconditions**

ผู้ใช้มี permission ทำ validation และไม่มี physical counts สำหรับ period date range

**Steps**

1. ไปที่ /procurement/validation
2. กด 'Run Validation'
3. ตรวจสอบว่าไม่มี physical counts แสดงรายการและไม่มี errors

**Expected**

physicalCountsFinalized เป็น true และไม่มี non-finalized counts ในรายการ

---

## TC-PE-330003 — Run Validation with Unauthorized User _(skipped)_

> **As a** Purchase user, **I want** this Period End behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

ผู้ใช้ไม่มี permission ทำ validation

**Steps**

1. ไปที่ /procurement/validation
2. กด 'Run Validation'
3. ตรวจสอบว่าผู้ใช้ถูกแจ้งให้ login หรือถูกปฏิเสธสิทธิ์เข้าถึง

**Expected**

ไม่สามารถทำ validation ได้และผู้ใช้ถูกปฏิเสธสิทธิ์เข้าถึง

---

## TC-PE-330004 — Physical Count Status Not Finalized _(skipped)_

> **As a** Purchase user, **I want** this Period End behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

physical counts บางรายการสำหรับ period date range ยังไม่ finalized

**Steps**

1. ไปที่ /procurement/validation
2. กด 'Run Validation'
3. ตรวจสอบว่า non-finalized counts ถูกแสดงรายการและสถานะไม่ใช่ 'finalized'
4. ตรวจสอบว่า GL adjustments สำหรับ non-finalized counts ไม่ถูก post

**Expected**

physicalCountsFinalized เป็น false และ non-finalized counts ถูกแสดงรายการพร้อม GL adjustments ที่ไม่ถูก post

---

## TC-PE-330005 — Period Date Range Without Physical Counts _(skipped)_

> **As a** Purchase user, **I want** this Period End behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Edge Case

**Preconditions**

period date range ที่เลือกไม่มี physical counts

**Steps**

1. ไปที่ /procurement/validation
2. เลือก period date range
3. กด 'Run Validation'
4. ตรวจสอบว่าไม่มี physical counts แสดงรายการ

**Expected**

physicalCountsFinalized เป็น true และไม่มี non-finalized counts ในรายการ

---

## TC-PE-340001 — Happy Path - Log Activity Entry _(skipped)_

> **As a** Purchase user, **I want** this Period End behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Happy Path

**Preconditions**

Login เป็น carmensoftware.dev+purchase@gmail.com พร้อม permissions ทำ period actions

**Steps**

1. ไปที่ /period-closure/active-period
2. กด 'View' button
3. กรอก period ID
4. กด 'Validate' button
5. กรอก validation details ที่จำเป็น
6. กด 'Close Period' button

**Expected**

Activity log entry ถูกสร้างพร้อมรายละเอียดที่จำเป็นทั้งหมดและไม่สามารถเปลี่ยนแปลงได้

---

## TC-PE-340002 — Negative - Invalid User Credentials _(skipped)_

> **As a** Purchase user, **I want** this Period End behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

ผู้ใช้ login ด้วย credentials ที่ไม่ถูกต้อง

**Steps**

1. ไปที่ /period-closure/active-period
2. กด 'View' button
3. กรอก period ID
4. กด 'Validate' button

**Expected**

ผู้ใช้ถูก redirect ไปยัง login page หรือได้รับ error message

---

## TC-PE-340003 — Negative - No Permissions _(skipped)_

> **As a** Purchase user, **I want** this Period End behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

ผู้ใช้ login โดยไม่มี permissions ทำ period actions

**Steps**

1. ไปที่ /period-closure/active-period
2. กด 'View' button
3. กรอก period ID
4. กด 'Validate' button

**Expected**

ผู้ใช้ได้รับ permission denied error หรือถูก redirect ไปยังหน้าที่ถูกจำกัด

---

## TC-PE-340004 — Edge Case - No Period ID Provided _(skipped)_

> **As a** Purchase user, **I want** this Period End behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Edge Case

**Preconditions**

ผู้ใช้มี credentials ที่ถูกต้องและ permissions ทำ period actions

**Steps**

1. ไปที่ /period-closure/active-period
2. กด 'View' button
3. กด 'Validate' button โดยไม่กรอก period ID

**Expected**

ระบบแจ้งให้ผู้ใช้กรอก period ID

---

## TC-PE-340005 — Edge Case - Timestamp Overflow _(skipped)_

> **As a** Purchase user, **I want** this Period End behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Edge Case

**Preconditions**

ผู้ใช้มี credentials ที่ถูกต้องและ permissions ทำ period actions

**Steps**

1. ไปที่ /period-closure/active-period
2. กด 'View' button
3. กรอก period ID
4. กด 'Validate' button
5. กรอก timestamp value สูงสุดที่เป็นไปได้

**Expected**

ระบบจัดการ timestamp overflow อย่างเหมาะสม โดยอาจตัดค่าให้เป็น timestamp ที่ถูกต้อง

---


<sub>Last regenerated: 2026-11-22 · git bd94ede</sub>
