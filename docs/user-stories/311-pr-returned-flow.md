# Pr Returned Flow — User Stories

_Generated from `tests/311-pr-returned-flow.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Pr Returned Flow
**Spec:** `tests/311-pr-returned-flow.spec.ts`
**Default role:** Requestor
**Total test cases:** 12 (10 High / 2 Medium / 0 Low)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-PR-080701 | Returned PR appears in Creator's list with RETURNED status badge | High | Smoke |
| TC-PR-080702 | Open Returned PR detail loads with status In progress | High | Smoke |
| TC-PR-080703 | Workflow History shows the send-back transition made by HOD | High | Functional |
| TC-PR-080704 | Edit button visible on Returned PR (Creator can re-edit) | High | Smoke |
| TC-PR-080705 | Modify line item quantity → Save → URL stays on detail | High | Functional |
| TC-PR-080706 | Add new line item to Returned PR → Save | High | Functional |
| TC-PR-080707 | Submit confirmation dialog appears for Returned PR | High | Functional |
| TC-PR-080708 | Confirm submit → PR goes back to the approver | High | Functional |
| TC-PR-080709 | Cancel submit on Returned PR → URL stays on detail (still Returned) | Medium | Edge Case |
| TC-PR-080710 | Delete is not offered on a Returned PR | Medium | Negative |
| TC-PR-080750 | active BU = BLAVG | High | Smoke |
| TC-PR-080902 | Full returned-flow: HOD returns → Creator views history → resubmits → PR back at HOD | High | Happy Path |

---

## TC-PR-080701 — Returned PR appears in Creator's list with RETURNED status badge

> **As a** Requestor user, **I want** the Pr Returned Flow list page to load successfully, **so that** I can manage Pr Returned Flow records.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

Login เป็น Requestor; PR ที่ HOD ส่งกลับ (seed ผ่าน submitPRAsRequestor + sendForReviewAsHOD)

**Steps**

1. เปิด PR list มุมมอง All Documents
2. หาแถวของ PR ที่ seed
3. ดูสถานะ/สเตจและ hover ป้ายส่งกลับ

**Expected**

แถวแสดงสถานะ 'In progress' ที่สเตจ 'Create Request' (ไม่มีสถานะ Returned) และป้ายส่งกลับแสดงเหตุผล 'Please revise' เมื่อ hover

---

## TC-PR-080702 — Open Returned PR detail loads with status In progress

> **As a** Requestor user, **I want** core Pr Returned Flow interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

มี PR ที่ HOD ส่งกลับ

**Steps**

1. เปิดหน้า detail ของ PR ที่ถูกส่งกลับ
2. ตรวจ URL และ status chip

**Expected**

URL คือ /procurement/purchase-request/<id>; status chip เป็น 'In progress' (ไม่ใช่ Returned); stepper อยู่ที่สเตจ 'Create Request'

---

## TC-PR-080703 — Workflow History shows the send-back transition made by HOD

> **As a** HOD user, **I want** this Pr Returned Flow interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

หน้า detail ของ PR ที่ถูกส่งกลับ

**Steps**

1. คลิก stepper (See who has handled this document) เพื่อเปิด Workflow History
2. ดูรายการเปลี่ยนสเตจ

**Expected**

แผง Workflow History แสดงรายการ 'HOD Approval → Create Request' โดย hod และ 'Create Request → HOD Approval' โดย requestor (timeline แสดงเฉพาะการย้ายสเตจ ไม่มีเหตุผล — เหตุผลอยู่ที่ hint ของแถวใน list, ดู TC-PR-080701)

---

## TC-PR-080704 — Edit button visible on Returned PR (Creator can re-edit)

> **As a** Requestor user, **I want** core Pr Returned Flow interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

หน้า detail ของ PR ที่ถูกส่งกลับ (Requestor เป็นเจ้าของ)

**Steps**

1. ดู action toolbar

**Expected**

ปุ่ม Edit แสดงและกดได้ (Creator เข้า Edit Mode เพื่อแก้ไขได้); กดแล้วมีปุ่ม Save

---

## TC-PR-080705 — Modify line item quantity → Save → URL stays on detail

> **As a** Requestor user, **I want** this Pr Returned Flow interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

หน้า detail ของ PR ที่ถูกส่งกลับพร้อม 1 รายการ

**Steps**

1. คลิก Edit
2. แก้ Qty แถวแรกเป็น 7
3. คลิก Save

**Expected**

บันทึกสำเร็จ (toast updated) URL ยังอยู่ที่ /procurement/purchase-request/<id>; หน้า detail แสดง Requested 7.00

---

## TC-PR-080706 — Add new line item to Returned PR → Save

> **As a** Requestor user, **I want** this Pr Returned Flow interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

หน้า detail ของ PR ที่ถูกส่งกลับพร้อม 1 รายการ

**Steps**

1. คลิก Edit
2. คลิก Add Item แล้วเลือก Product/Unit กรอก Qty
3. คลิก Save

**Expected**

บันทึกสำเร็จ; URL ยังอยู่ที่หน้า detail; ตารางมี 2 รายการ

---

## TC-PR-080707 — Submit confirmation dialog appears for Returned PR

> **As a** Requestor user, **I want** this Pr Returned Flow interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

หน้า detail ของ PR ที่ถูกส่งกลับ

**Steps**

1. คลิก Submit

**Expected**

dialog ยืนยัน (alertdialog) ปรากฏขึ้นพร้อมปุ่มยืนยัน

---

## TC-PR-080708 — Confirm submit → PR goes back to the approver

> **As a** Requestor user, **I want** this Pr Returned Flow interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

dialog ยืนยัน Submit เปิดอยู่บน PR ที่ถูกส่งกลับ

**Steps**

1. คลิก Submit
2. กด confirm ใน dialog
3. รอผล

**Expected**

backend รับ submit (2xx); PR ออกจากสเตจ Create Request — creator ไม่มีปุ่ม Submit/Edit อีก; status ยังเป็น In progress ที่สเตจ HOD Approval

---

## TC-PR-080709 — Cancel submit on Returned PR → URL stays on detail (still Returned)

> **As a** Requestor user, **I want** this Pr Returned Flow behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Edge Case

**Preconditions**

dialog ยืนยัน Submit เปิดอยู่บน PR ที่ถูกส่งกลับ

**Steps**

1. คลิก Submit
2. คลิก Cancel ใน dialog

**Expected**

dialog ปิด; URL ยังอยู่ที่หน้า detail; ปุ่ม Submit ยังอยู่ (PR ยังอยู่ที่สเตจ Create Request)

---

## TC-PR-080710 — Delete is not offered on a Returned PR

> **As a** Requestor user, **I want** this Pr Returned Flow behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Negative

**Preconditions**

หน้า detail ของ PR ที่ถูกส่งกลับ (In progress ไม่ใช่ Draft)

**Steps**

1. ดู action toolbar ของ Creator

**Expected**

ไม่มีปุ่ม Delete — FE ให้ลบได้เฉพาะเอกสาร Draft (pr-header.tsx: onDelete เมื่อ pr_status = draft); PR ที่เข้า workflow แล้วลบไม่ได้

---

## TC-PR-080750 — active BU = BLAVG

> **As a** Requestor user, **I want** core Pr Returned Flow interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

Login เป็น carmensoftware.dev+requestor@gmail.com ผ่าน auth fixture

**Steps**

1. เรียก ensureActiveBu(BLAVG)
2. อ่าน profile API
3. หา business unit ที่ is_default
4. อ่าน label ของ BU switcher

**Expected**

default business unit มี code === 'BLAVG'; trigger ของ BU switcher แสดง label ของ BU นั้น

---

## TC-PR-080902 — Full returned-flow: HOD returns → Creator views history → resubmits → PR back at HOD

> **As a** HOD user, **I want** this Pr Returned Flow behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Happy Path

**Preconditions**

Login เป็น Requestor; PR ใหม่ถูก seed และ HOD ส่งกลับ

**Steps**

1. เปิดหน้า detail ของ PR ที่ถูกส่งกลับ
2. เปิด Workflow History ตรวจการส่งกลับ
3. Submit + confirm

**Expected**

เห็นการส่งกลับ HOD Approval → Create Request ใน Workflow History; หลัง resubmit PR ยังเป็น In progress ที่สเตจ HOD Approval และ Creator ไม่มี Submit/Edit (การแก้ Qty ก่อนส่งใหม่ทดสอบที่ 080705 ซึ่งติด BE 400)

---


<sub>Last regenerated: 2026-11-24 · git f462816</sub>
