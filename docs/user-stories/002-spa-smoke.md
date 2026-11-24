# Spa Smoke — User Stories

_Generated from `tests/002-spa-smoke.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Spa Smoke
**Spec:** `tests/002-spa-smoke.spec.ts`
**Default role:** Admin
**Total test cases:** 6 (4 High / 2 Medium / 0 Low)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-SPA-010001 | ผู้ใช้ที่ยังไม่ login ถูก redirect ไปหน้า login | High | Smoke |
| TC-SPA-010002 | dashboard จริง render (ไม่ใช่ placeholder) | High | Smoke |
| TC-SPA-010003 | หน้า shell (report/profile/notifications) เปิดได้ ไม่เป็น 404 | Medium | Smoke |
| TC-SPA-010004 | config lists render (dialog-based + page-based) | High | Smoke |
| TC-SPA-010005 | procurement lists render ครบทุกโมดูล | High | Smoke |
| TC-SPA-010006 | PR detail เปิดจาก list All Documents ได้ + landing/approval ไม่เป็น 404 | Medium | Smoke |

---

## TC-SPA-010001 — ผู้ใช้ที่ยังไม่ login ถูก redirect ไปหน้า login

> **As a** Admin user, **I want** core Spa Smoke interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

ไม่มี session (browser context สะอาด)

**Steps**

1. เปิด /dashboard ตรงๆ โดยไม่ login

**Expected**

ถูก redirect ไป /login?next=%2Fdashboard และฟอร์ม login แสดง (email field + ปุ่ม Sign In)

---

## TC-SPA-010002 — dashboard จริง render (ไม่ใช่ placeholder)

> **As a** Admin user, **I want** core Spa Smoke interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

Login เป็น admin ผ่าน auth fixture

**Steps**

1. ไปที่ /dashboard

**Expected**

ไม่มีข้อความ placeholder 'lands in a later phase'; heading ของ dashboard แสดง

---

## TC-SPA-010003 — หน้า shell (report/profile/notifications) เปิดได้ ไม่เป็น 404

> **As a** Admin user, **I want** core Spa Smoke interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** Medium · **Test Type:** Smoke

**Preconditions**

Login เป็น admin ผ่าน auth fixture

**Steps**

1. ไปที่ /report/list 2. /profile 3. /notifications

**Expected**

ทุกหน้าแสดง UI จริง ไม่พบข้อความ 404/not found

---

## TC-SPA-010004 — config lists render (dialog-based + page-based)

> **As a** Admin user, **I want** core Spa Smoke interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

Login เป็น admin ผ่าน auth fixture

**Steps**

1. /config/unit 2. /config/department 3. /config/department/new 4. /config

**Expected**

ตาราง list แสดง (unit, department); ฟอร์ม department/new แสดง; landing ไม่เป็น 404

---

## TC-SPA-010005 — procurement lists render ครบทุกโมดูล

> **As a** Admin user, **I want** core Spa Smoke interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

Login เป็น admin ผ่าน auth fixture

**Steps**

1. เปิด list ของ PRT, CN, GRN, PO, PR ตามลำดับ

**Expected**

ทุก list แสดงตาราง (header แสดงเสมอแม้ไม่มีข้อมูล)

---

## TC-SPA-010006 — PR detail เปิดจาก list All Documents ได้ + landing/approval ไม่เป็น 404

> **As a** Admin user, **I want** the Spa Smoke list page to load successfully, **so that** I can manage Spa Smoke records.

**Priority:** Medium · **Test Type:** Smoke

**Preconditions**

Login เป็น admin ผ่าน auth fixture

**Steps**

1. /procurement/purchase-request?view=all-document คลิกเลขที่เอกสารของแถวแรก 2. /procurement 3. /procurement/my-approval

**Expected**

คลิกแล้ว URL เป็น /purchase-request/<id> (ชุดข้อมูลมาตรฐานมี PR อยู่แล้ว list จึงต้องไม่ว่าง); landing + approval ไม่เป็น 404

---


<sub>Last regenerated: 2026-11-24 · git f462816</sub>
