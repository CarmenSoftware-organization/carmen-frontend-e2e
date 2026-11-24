# Exchange Rate — User Stories

_Generated from `tests/041-exchange-rate.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Exchange Rate
**Spec:** `tests/041-exchange-rate.spec.ts`
**Default role:** Admin
**Total test cases:** 7 (5 High / 2 Medium / 0 Low)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-ER-010001 | หน้า list โหลดสำเร็จ | High | Smoke |
| TC-ER-010002 | ปุ่ม Add แสดง | Medium | Smoke |
| TC-ER-010005 | active BU = BLAVG | High | Smoke |
| TC-ER-100001 | XSS payload ในชื่อต้องไม่รัน script | High | Security |
| TC-ER-100002 | SQL injection payload ในช่องค้นหาต้องไม่ crash | High | Security |
| TC-ER-100003 | ค้นหาด้วย string ยาวมากต้องไม่ crash | Medium | Validation |
| TC-ER-100004 | user สิทธิ์ต่ำเข้าหน้านี้ต้องไม่เห็นปุ่ม Add หรือถูก redirect | High | Authorization |

---

## TC-ER-010001 — หน้า list โหลดสำเร็จ

> **As a** Admin user, **I want** the Exchange Rate list page to load successfully, **so that** I can manage Exchange Rate records.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com ผ่าน createAuthTest แล้ว

**Steps**

_(no steps documented)_

**Expected**

หน้า list โหลดสำเร็จและ URL ตรงกับ /config/exchange-rate

---

## TC-ER-010002 — ปุ่ม Add แสดง

> **As a** Admin user, **I want** to see the Add button on the Exchange Rate list, **so that** I can create new records.

**Priority:** Medium · **Test Type:** Smoke

**Preconditions**

อยู่ที่หน้า list ของ exchange rate และมีสิทธิ์เพิ่มข้อมูล

**Steps**

_(no steps documented)_

**Expected**

ปุ่ม Add แสดงบนหน้า list

---

## TC-ER-010005 — active BU = BLAVG

> **As a** Admin user, **I want** core Exchange Rate interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com ผ่าน auth fixture; beforeEach เรียก ensureActiveBu(BLAVG) แล้ว

**Steps**

1. อ่าน profile API (/api/proxy/api/user/profile)
2. หา business unit ที่ is_default
3. เปิดหน้าที่มี navbar แล้วอ่าน label ของ BU switcher

**Expected**

default business unit มี code === 'BLAVG'; trigger ของ BU switcher ใน navbar แสดง label ของ BU นั้น

---

## TC-ER-100001 — XSS payload ในชื่อต้องไม่รัน script

> **As the** system, **I want** XSS payloads in Exchange Rate inputs to be neutralized, **so that** no script executes in users' browsers.

**Priority:** High · **Test Type:** Security

**Preconditions**

Logged in user with permission to access /config/exchange-rate; XSS dialog guard attached

**Steps**

1. เปิด list /config/exchange-rate
2. พิมพ์ XSS payload "<script>alert('xss-e2e')</script>" ลงในช่องค้นหา

**Expected**

ไม่มี browser alert/dialog จาก payload; ปุ่ม Add ยังคง visible (list ทำงานปกติ)

---

## TC-ER-100002 — SQL injection payload ในช่องค้นหาต้องไม่ crash

> **As the** system, **I want** SQL-injection payloads in Exchange Rate fields to be safely handled, **so that** the database remains intact.

**Priority:** High · **Test Type:** Security

**Preconditions**

Logged in user with permission to access /config/exchange-rate

**Steps**

1. เปิด list /config/exchange-rate
2. พิมพ์ SQL injection payload "'; DROP TABLE users; --" ลงในช่องค้นหา

**Expected**

หน้าไม่ crash; ปุ่ม Add ยังคง visible (list ทำงานปกติ)

---

## TC-ER-100003 — ค้นหาด้วย string ยาวมากต้องไม่ crash

> **As a** Admin user, **I want** the system to block invalid Exchange Rate submissions, **so that** data quality is preserved.

**Priority:** Medium · **Test Type:** Validation

**Preconditions**

Logged in user with permission to access /config/exchange-rate

**Steps**

1. เปิด list /config/exchange-rate
2. พิมพ์ string ยาว 200 ตัวอักษร ('a' x 200) ลงในช่องค้นหา

**Expected**

หน้าไม่ crash; ปุ่ม Add ยังคง visible (list ทำงานปกติ)

---

## TC-ER-100004 — user สิทธิ์ต่ำเข้าหน้านี้ต้องไม่เห็นปุ่ม Add หรือถูก redirect

> **As a** low-privilege user, **I should NOT** see Add/edit controls on Exchange Rate, **so that** role separation is enforced.

**Priority:** High · **Test Type:** Authorization

**Preconditions**

Test user requestor@blueledgers.com (low-privilege role) มีอยู่จริง; module list path = /config/exchange-rate

**Steps**

1. เปิด browser context ใหม่
2. login เป็น requestor@blueledgers.com
3. ไปที่ /config/exchange-rate

**Expected**

User ถูก redirect ออกจาก /config/exchange-rate หรือ ปุ่ม Add ไม่ปรากฏ (count = 0)

---


<sub>Last regenerated: 2026-11-24 · git f462816</sub>
