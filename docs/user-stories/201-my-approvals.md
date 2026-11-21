# My Approvals — User Stories

_Generated from `tests/201-my-approvals.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** My Approvals
**Spec:** `tests/201-my-approvals.spec.ts`
**Default role:** HOD
**Total test cases:** 20 (17 High / 3 Medium / 0 Low)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-MA-010001 | Happy Path - View Unified Approval Queue | High | Happy Path |
| TC-MA-010002 | Negative - No Pending Approvals | Medium | Negative |
| TC-MA-010003 _(skipped)_ | Edge Case - Large Number of Documents | High | Edge Case |
| TC-MA-010004 | Negative - Insufficient Permission | High | Negative |
| TC-MA-010050 | active BU = BLAVG | High | Smoke |
| TC-MA-020001 _(skipped)_ | Happy Path: Approve Document with Valid Credentials | High | Happy Path |
| TC-MA-020002 _(skipped)_ | Negative: Insufficient Approval Authority | High | Negative |
| TC-MA-020003 _(skipped)_ | Edge Case: Multiple Approvals in Queue | Medium | Edge Case |
| TC-MA-030001 | Happy Path - Valid Reason | High | Happy Path |
| TC-MA-030002 | Negative - Empty Reason | High | Negative |
| TC-MA-030003 | Edge Case - Custom Reason | High | Edge Case |
| TC-MA-030004 | Negative - No Permission | High | Negative |
| TC-MA-040001 _(skipped)_ | Happy Path - Request More Information | High | Happy Path |
| TC-MA-040002 _(skipped)_ | Negative - Empty Information Request | High | Negative |
| TC-MA-040004 _(skipped)_ | Edge Case - Maximum Length Input | Medium | Edge Case |
| TC-MA-050001 _(skipped)_ | Happy Path - Approve 20 Routine F&B PRs | High | Happy Path |
| TC-MA-050003 _(skipped)_ | Edge Case - Approve Maximum 50 Documents | High | Edge Case |
| TC-MA-060001 _(skipped)_ | Happy Path - Delegate Approval Authority | High | Happy Path |
| TC-MA-060002 _(skipped)_ | Negative - Delegate User with Lower Approval Authority | High | Negative |
| TC-MA-060003 _(skipped)_ | Edge Case - Self Delegation | High | Negative |

---

## TC-MA-010001 — Happy Path - View Unified Approval Queue

> **As a** HOD user, **I want** this My Approvals behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Happy Path

**Preconditions**

Login เป็นผู้ใช้ที่มีสิทธิ์ approver และมีการตั้งค่า approval authority ใน approval matrix แล้ว

**Steps**

1. ไปที่ /procurement/my-approval
2. ตรวจสอบว่า document count badges แสดงผลถูกต้อง
3. ตรวจสอบว่า total pending count แสดงเด่นชัด
4. ตรวจสอบว่าเอกสารเรียงตามวันที่ส่ง (เก่าสุดก่อน)
5. ตรวจสอบว่า visual urgency indicators แสดงผลถูกต้อง

**Expected**

ผู้ใช้เห็น unified approval queue ที่มีเอกสาร pending ทั้งหมด เรียงลำดับและกรองถูกต้อง พร้อม urgency indicators

---

## TC-MA-010002 — Negative - No Pending Approvals

> **As a** HOD user, **I want** this My Approvals behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Negative

**Preconditions**

ผู้ใช้มีสิทธิ์ approver แต่ไม่มีเอกสาร pending

**Steps**

1. ไปที่ /procurement/my-approval
2. ค้นหาเอกสารที่ไม่มีอยู่ (STD dataset มี PR รออนุมัติของ HOD เสมอ)
3. ตรวจสอบว่า queue ว่างพร้อมข้อความ 'No pending approvals'

**Expected**

ผู้ใช้เห็น queue ว่างเปล่าพร้อมข้อความแจ้งว่าไม่มี pending approvals

---

## TC-MA-010003 — Edge Case - Large Number of Documents _(skipped)_

> **As a** HOD user, **I want** this My Approvals behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Edge Case

**Preconditions**

ผู้ใช้มีสิทธิ์ approver และมีเอกสาร pending มากกว่า 500 รายการ

**Steps**

1. ไปที่ /procurement/my-approval
2. รอให้ queue โหลด
3. ตรวจสอบว่า queue โหลดเสร็จภายใน 2 วินาที

**Expected**

Queue โหลดเสร็จภายใน 2 วินาทีพร้อมเอกสาร pending ทั้งหมด

---

## TC-MA-010004 — Negative - Insufficient Permission

> **As a** HOD user, **I want** this My Approvals behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

Login เข้าระบบแล้วแต่ไม่มีการตั้งค่า approval authority ใน approval matrix

**Steps**

1. ไปที่ /procurement/my-approval
2. ตรวจสอบว่าระบบแสดงข้อความ error หรือ redirect ไปยังหน้า permission denied

**Expected**

ผู้ใช้เห็นข้อความ error หรือถูก redirect ไปยังหน้า permission denied

---

## TC-MA-010050 — active BU = BLAVG

> **As a** HOD user, **I want** core My Approvals interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

Login เป็น carmensoftware.dev+hod@gmail.com ผ่าน auth fixture; beforeEach เรียก ensureActiveBu(BLAVG) แล้ว

**Steps**

1. อ่าน profile API (/api/proxy/api/user/profile)
2. หา business unit ที่ is_default
3. เปิดหน้าที่มี navbar แล้วอ่าน label ของ BU switcher

**Expected**

default business unit มี code === 'BLAVG'; trigger ของ BU switcher ใน navbar แสดง label ของ BU นั้น

---

## TC-MA-020001 — Happy Path: Approve Document with Valid Credentials _(skipped)_

> **As a** HOD user, **I want** this My Approvals behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Happy Path

**Preconditions**

ผู้ใช้เปิด approval queue แล้วและเอกสารมีสถานะ Pending Approval

**Steps**

1. ไปที่ /approval-queue
2. คลิกเอกสารใน queue เพื่อตรวจสอบ
3. ตรวจสอบรายละเอียดเอกสารในแท็บ Overview, Line Items, Attachments, Approval History และ Related Documents
4. ตรวจสอบผลกระทบด้านงบประมาณและประวัติการ approve
5. ตรวจสอบว่า approval recommendation เป็นสีเขียว
6. กดปุ่ม 'Approve'
7. กรอก approval comments: 'Approved. Necessary for Q4 menu launch. Budget available.'
8. กดปุ่ม 'Confirm Approval'

**Expected**

เอกสารอัปเดตเป็นสถานะ Approved และถูกลบออกจาก approval queue ของผู้ใช้

---

## TC-MA-020002 — Negative: Insufficient Approval Authority _(skipped)_

> **As a** HOD user, **I want** this My Approvals behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

เอกสารมีสถานะ Pending Approval; ผู้ใช้ไม่มี approval authority เพียงพอสำหรับจำนวนเงินของเอกสาร

**Steps**

1. ไปที่ /approval-queue
2. คลิกเอกสารใน queue เพื่อตรวจสอบ
3. ตรวจสอบรายละเอียดเอกสารในแท็บ Overview, Line Items, Attachments, Approval History และ Related Documents
4. พยายามกดปุ่ม 'Approve'
5. ตรวจสอบข้อความ error: 'Insufficient approval authority'

**Expected**

ผู้ใช้ไม่สามารถ approve เอกสารได้และเห็นข้อความ error ที่เหมาะสม

---

## TC-MA-020003 — Edge Case: Multiple Approvals in Queue _(skipped)_

> **As a** HOD user, **I want** this My Approvals behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Edge Case

**Preconditions**

มีเอกสาร Pending Approval หลายรายการในระดับการ approve ที่แตกต่างกัน; ผู้ใช้มี authority เพียงพอในการ approve

**Steps**

1. ไปที่ /approval-queue
2. ตรวจสอบเอกสารแรกใน queue
3. ตรวจสอบรายละเอียดเอกสารและระดับการ approve
4. กดปุ่ม 'Approve'
5. กรอก approval comments: 'Approved. Necessary for Q4 menu launch. Budget available.'
6. กดปุ่ม 'Confirm Approval'
7. ตรวจสอบว่าเอกสารอัปเดตเป็นสถานะ Approved
8. ตรวจสอบเอกสารถัดไปใน queue
9. ทำซ้ำขั้นตอน 4-7 สำหรับแต่ละเอกสารใน queue

**Expected**

เอกสารถูก approve และลบออกจาก approval queue ของผู้ใช้ตามลำดับที่ปรากฏ

---

## TC-MA-030001 — Happy Path - Valid Reason

> **As a** HOD user, **I want** this My Approvals behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Happy Path

**Preconditions**

เอกสารมีสถานะ Pending Approval; ผู้ใช้ตรวจสอบเอกสารแล้วและพบปัญหาที่ขัดขวางการ approve; ผู้ใช้มี session ที่ active

**Steps**

1. ไปที่ /procurement/purchase-request
2. กดปุ่ม 'Reject'
3. เลือก 'Budget not available' จาก quick-select options
4. กรอกคำอธิบายโดยละเอียด: 'Rejected. Budget not available for this purchase.'
5. กดปุ่ม 'Confirm Rejection'

**Expected**

สถานะเอกสารอัปเดตเป็น Rejected, บันทึกเหตุผลการ reject, แจ้งผู้ใช้ว่า reject สำเร็จ, ลบเอกสารออกจาก approval queue

---

## TC-MA-030002 — Negative - Empty Reason

> **As a** HOD user, **I want** this My Approvals behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

เอกสารมีสถานะ Pending Approval; ผู้ใช้มี session ที่ active

**Steps**

1. ไปที่ /procurement/purchase-request
2. กดปุ่ม 'Reject'
3. เลือก 'Budget not available' จาก quick-select options
4. ไม่กรอกคำอธิบายโดยละเอียด
5. กดปุ่ม 'Confirm Rejection'

**Expected**

การ validate ของระบบล้มเหลว, เหตุผลการ reject เป็นข้อมูลบังคับ, ไม่ประมวลผลการ reject

---

## TC-MA-030003 — Edge Case - Custom Reason

> **As a** HOD user, **I want** this My Approvals behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Edge Case

**Preconditions**

เอกสารมีสถานะ Pending Approval; ผู้ใช้มี session ที่ active

**Steps**

1. ไปที่ /procurement/purchase-request
2. กดปุ่ม 'Reject'
3. เลือก 'Other (custom reason)' จาก quick-select options
4. กรอกเหตุผลแบบกำหนดเอง: 'Incorrect PO number'
5. กรอกคำอธิบายโดยละเอียด: 'Rejected. Incorrect PO number - please check PO-123456789.'
6. กดปุ่ม 'Confirm Rejection'

**Expected**

สถานะเอกสารอัปเดตเป็น Rejected, บันทึกเหตุผลการ reject แบบกำหนดเอง, แจ้งผู้ใช้ว่า reject สำเร็จ, ลบเอกสารออกจาก approval queue

---

## TC-MA-030004 — Negative - No Permission

> **As a** HOD user, **I want** this My Approvals behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

เอกสารมีสถานะ Pending Approval; ผู้ใช้ไม่มีสิทธิ์ในการ reject

**Steps**

1. ไปที่ /procurement/purchase-request
2. กดปุ่ม 'Reject'
3. เลือก 'Budget not available' จาก quick-select options
4. กรอกคำอธิบายโดยละเอียด: 'Rejected. Budget not available for this purchase.'
5. กดปุ่ม 'Confirm Rejection'

**Expected**

การ validate ของระบบล้มเหลว, ผู้ใช้ไม่มีสิทธิ์ในการ reject, ไม่ประมวลผลการ reject

---

## TC-MA-040001 — Happy Path - Request More Information _(skipped)_

> **As a** HOD user, **I want** this My Approvals behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Happy Path

**Preconditions**

ผู้ใช้ตรวจสอบเอกสารแล้ว; เอกสารมีสถานะ Pending Approval; ผู้ใช้พบข้อมูลที่ขาดหายหรือไม่ชัดเจนซึ่งจำเป็นสำหรับการตัดสินใจ approve

**Steps**

1. ไปที่ /procurement/purchase-request
2. กดปุ่ม 'Request More Info'
3. เลือก template 'Please provide 2 additional quotes from alternate vendors'
4. กรอก 'Please provide: 1) Specifications for the equipment model requested, 2) Quote from at least one alternate vendor for comparison, 3) Explanation for urgent delivery requirement.' ใน information request textarea
5. ตั้ง response deadline เป็น 48 business hours
6. กดปุ่ม 'Send Request'
7. ตรวจสอบข้อความยืนยันความสำเร็จ: 'Information request sent to requestor. SLA timer paused until response received.'
8. ตรวจสอบว่าสถานะเอกสารอัปเดตเป็น 'Awaiting Information'

**Expected**

ระบบประมวลผล information request, อัปเดตสถานะเอกสาร, แจ้ง requestor, หยุด SLA timer, และตั้งเวลาแจ้งเตือน

---

## TC-MA-040002 — Negative - Empty Information Request _(skipped)_

> **As a** HOD user, **I want** this My Approvals behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

ผู้ใช้ตรวจสอบเอกสารแล้ว; เอกสารมีสถานะ Pending Approval

**Steps**

1. ไปที่ /procurement/purchase-request
2. กดปุ่ม 'Request More Info'
3. เลือก template 'Other (custom request)'
4. ไม่กรอกข้อความใน information request textarea
5. กดปุ่ม 'Send Request'
6. ตรวจสอบข้อความ error: 'Information request cannot be empty.'

**Expected**

ระบบป้องกันการส่ง information request ที่ว่างเปล่า

---

## TC-MA-040004 — Edge Case - Maximum Length Input _(skipped)_

> **As a** HOD user, **I want** this My Approvals behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Edge Case

**Preconditions**

ผู้ใช้ตรวจสอบเอกสารแล้ว; เอกสารมีสถานะ Pending Approval

**Steps**

1. ไปที่ /procurement/purchase-request
2. กดปุ่ม 'Request More Info'
3. เลือก template 'Please provide 2 additional quotes from alternate vendors'
4. กรอก information request textarea ด้วยความยาวสูงสุดที่อนุญาต: 200 ตัวอักษร
5. กดปุ่ม 'Send Request'
6. ตรวจสอบว่า information request ถูกประมวลผลสำเร็จ

**Expected**

ระบบประมวลผล information request ที่มีความยาวสูงสุดโดยไม่มี error

---

## TC-MA-050001 — Happy Path - Approve 20 Routine F&B PRs _(skipped)_

> **As a** HOD user, **I want** this My Approvals behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Happy Path

**Preconditions**

ผู้ใช้เปิด approval queue ที่มี pending routine F&B PRs จำนวน 20 รายการ

**Steps**

1. ไปที่ /approval-queue
2. กดปุ่ม 'Select Multiple'
3. คลิก checkboxes ของเอกสารที่เลือก 20 รายการ
4. ตรวจสอบว่า bulk action toolbar แสดง '15 documents selected', 'Total: $12,450', 'All Purchase Requests'
5. กดปุ่ม 'Bulk Approve'
6. กรอก comments 'Bulk approved. Routine F&B inventory replenishment within normal spend levels.'
7. กดปุ่ม 'Confirm Bulk Approval'
8. รอ progress bar ให้ approve ครบ 15 รายการ
9. ตรวจสอบข้อความยืนยัน: '15 documents approved successfully'
10. ตรวจสอบว่าจำนวน queue ลดลง 15 รายการ

**Expected**

เอกสาร 20 รายการถูก approve และลบออกจาก queue

---

## TC-MA-050003 — Edge Case - Approve Maximum 50 Documents _(skipped)_

> **As a** HOD user, **I want** this My Approvals behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Edge Case

**Preconditions**

ผู้ใช้เปิด approval queue ที่มีเอกสาร pending ประเภทเดียวกัน 50 รายการ

**Steps**

1. ไปที่ /approval-queue
2. กดปุ่ม 'Select Multiple'
3. คลิก checkboxes ของเอกสารทั้ง 50 รายการ
4. ตรวจสอบว่า bulk action toolbar แสดง '50 documents selected', 'Total: [total amount]', 'All [document type]'
5. กดปุ่ม 'Bulk Approve'
6. กรอก comments 'Bulk approved. Routine F&B inventory replenishment within normal spend levels.'
7. กดปุ่ม 'Confirm Bulk Approval'
8. รอ progress bar ให้ approve ครบ 50 รายการ
9. ตรวจสอบข้อความยืนยัน: '50 documents approved successfully'

**Expected**

เอกสารทั้ง 50 รายการถูก approve และลบออกจาก queue

---

## TC-MA-060001 — Happy Path - Delegate Approval Authority _(skipped)_

> **As a** HOD user, **I want** this My Approvals behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Happy Path

**Preconditions**

ผู้ใช้มีสิทธิ์ approver; คาดว่าจะไม่อยู่; มีผู้แทนที่มี approval authority เท่าหรือสูงกว่า

**Steps**

1. ไปที่ /my-approvals
2. กด 'Manage Delegations'
3. กด 'New Delegation'
4. กรอก Delegate User เป็น Sarah Johnson
5. ตั้ง Start Date: 2025-12-15, Start Time: 00:00
6. ตั้ง End Date: 2025-12-22, End Time: 23:59
7. ตั้ง Delegation Scope: All Documents
8. ตั้ง Maximum Amount Limit: $50,000
9. กรอก Delegation Reason: Annual leave - will be out of office
10. เพิ่ม Notes: Contact me via email only for emergencies
11. กด 'Create Delegation'

**Expected**

สร้าง delegation สำเร็จ, ผู้ใช้ถูกนำทางไปยังหน้ารายละเอียด delegation

---

## TC-MA-060002 — Negative - Delegate User with Lower Approval Authority _(skipped)_

> **As a** HOD user, **I want** this My Approvals behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

ผู้ใช้มีสิทธิ์ approver; มีผู้แทนที่มี approval authority ต่ำกว่า

**Steps**

1. ไปที่ /my-approvals
2. กด 'Manage Delegations'
3. กด 'New Delegation'
4. กรอก Delegate User เป็น Sarah Johnson
5. ตั้ง Start Date: 2025-12-15, Start Time: 00:00
6. ตั้ง End Date: 2025-12-22, End Time: 23:59
7. ตั้ง Delegation Scope: All Documents
8. ตั้ง Maximum Amount Limit: $50,000
9. กรอก Delegation Reason: Annual leave - will be out of office
10. กด 'Create Delegation'

**Expected**

การ validate ของระบบล้มเหลว, ไม่อนุญาตให้สร้าง delegation

---

## TC-MA-060003 — Edge Case - Self Delegation _(skipped)_

> **As a** HOD user, **I want** this My Approvals behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

ผู้ใช้มีสิทธิ์ approver; คาดว่าจะไม่อยู่

**Steps**

1. ไปที่ /my-approvals
2. กด 'Manage Delegations'
3. กด 'New Delegation'
4. กรอก Delegate User เป็น John Smith (ชื่อผู้ใช้เอง)
5. ตั้ง Start Date: 2025-12-15, Start Time: 00:00
6. ตั้ง End Date: 2025-12-22, End Time: 23:59
7. ตั้ง Delegation Scope: All Documents
8. ตั้ง Maximum Amount Limit: $50,000
9. กรอก Delegation Reason: Annual leave - will be out of office
10. กด 'Create Delegation'

**Expected**

การ validate ของระบบล้มเหลว, ไม่อนุญาตให้ delegate ให้ตัวเอง

---


<sub>Last regenerated: 2026-11-21 · git 30cfbd8</sub>
