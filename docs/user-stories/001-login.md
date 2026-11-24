# Login & Logout — User Stories

_Generated from `tests/001-login.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Login & Logout
**Spec:** `tests/001-login.spec.ts`
**Default role:** any authenticated
**Total test cases:** 43 (27 High / 12 Medium / 4 Low)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-LOGIN-010001 | Requestor เข้าสู่ระบบสำเร็จ | High | Smoke |
| TC-LOGIN-010002 | HOD เข้าสู่ระบบสำเร็จ | High | Smoke |
| TC-LOGIN-010003 | Purchase เข้าสู่ระบบสำเร็จ | High | Smoke |
| TC-LOGIN-010004 | FC เข้าสู่ระบบสำเร็จ | High | Smoke |
| TC-LOGIN-010005 | GM เข้าสู่ระบบสำเร็จ | High | Smoke |
| TC-LOGIN-010006 | Owner เข้าสู่ระบบสำเร็จ | High | Smoke |
| TC-LOGIN-010008 | Requestor ออกจากระบบสำเร็จ | High | Smoke |
| TC-LOGIN-010009 | HOD ออกจากระบบสำเร็จ | High | Smoke |
| TC-LOGIN-010010 | Purchase ออกจากระบบสำเร็จ | High | Smoke |
| TC-LOGIN-010011 | FC ออกจากระบบสำเร็จ | High | Smoke |
| TC-LOGIN-010012 | GM ออกจากระบบสำเร็จ | High | Smoke |
| TC-LOGIN-010013 | Owner ออกจากระบบสำเร็จ | High | Smoke |
| TC-LOGIN-010014 | แสดง error เมื่อไม่กรอกรหัสผ่าน | Medium | Validation |
| TC-LOGIN-010015 | แสดง error เมื่อไม่กรอกอีเมล | Medium | Validation |
| TC-LOGIN-010016 | แสดง error เมื่อไม่กรอกข้อมูลทั้งสองช่อง | Low | Validation |
| TC-LOGIN-010017 | แสดง error เมื่อรูปแบบอีเมลไม่ถูกต้อง | Medium | Validation |
| TC-LOGIN-010018 | แสดง error เมื่อ credentials ไม่ถูกต้อง | Medium | Validation |
| TC-LOGIN-010019 | แสดง error เมื่ออีเมลถูกแต่รหัสผ่านผิด | Medium | Validation |
| TC-LOGIN-010020 | อีเมลไม่สนใจตัวพิมพ์ใหญ่-เล็ก | Medium | Functional |
| TC-LOGIN-010021 | รหัสผ่านแยกตัวพิมพ์ใหญ่-เล็ก (พิมพ์ผิดเคสต้อง fail) | Medium | Validation |
| TC-LOGIN-010022 | รองรับช่องว่างหน้า/หลังอีเมล | Low | Functional |
| TC-LOGIN-010023 | ช่องรหัสผ่านถูก mask | Low | Functional |
| TC-LOGIN-010024 | กด Enter เพื่อ submit form ได้ | Medium | Functional |
| TC-LOGIN-010031 | StoreManager เข้าสู่ระบบสำเร็จ | High | Smoke |
| TC-LOGIN-010032 | Budget เข้าสู่ระบบสำเร็จ | High | Smoke |
| TC-LOGIN-010033 | StoreManager ออกจากระบบสำเร็จ | High | Smoke |
| TC-LOGIN-010034 | Budget ออกจากระบบสำเร็จ | High | Smoke |
| TC-LOGIN-010035 | login พร้อม ?next= ที่ valid ต้อง redirect ไปปลายทางนั้น | High | Functional |
| TC-LOGIN-010037 | session คงอยู่หลัง reload (refresh-token boot) | High | Functional |
| TC-LOGIN-010039 | ปุ่ม Sign In ถูก disable ระหว่าง request กำลังทำงาน (กัน double-submit) | Medium | Functional |
| TC-LOGIN-010040 | backend ล่มต้องแสดง error อย่างนุ่มนวลและคงอยู่ /login | Medium | Validation |
| TC-LOGIN-010041 | ปุ่ม show/hide password สลับการแสดงรหัสผ่านได้ | Low | Functional |
| TC-LOGIN-010042 | หลังผิดซ้ำจนโดน rate-limit ต้องแสดง countdown และ disable ปุ่ม | Medium | Functional |
| TC-LOGIN-100001 _(skipped)_ | TT (user ไม่มี department) login ต้องแสดง dialog แจ้งยังไม่กำหนด department | High | Auth-guard |
| TC-LOGIN-100002 | เข้า route ที่ต้อง login โดยไม่ login ต้อง redirect ไปหน้า login | High | Auth-guard |
| TC-LOGIN-100003 | user ที่ login แล้วเข้า /login ต้อง redirect ไป dashboard | Medium | Auth-guard |
| TC-LOGIN-100004 | อีเมลแบบ SQL injection ต้องถูก reject อย่างปลอดภัย | High | Security |
| TC-LOGIN-100005 | อีเมลแบบ XSS ต้องถูก reject อย่างปลอดภัย | High | Security |
| TC-LOGIN-100006 | login username ผิดต้องได้รับ HTTP 401 | High | Security |
| TC-LOGIN-100007 | login ชื่อเดิมผิด 3 ครั้ง ต้องได้รับ HTTP 429 | High | Security |
| TC-LOGIN-100008 | next param แบบ external URL ต้องไม่ redirect ออกนอกเว็บ (open-redirect guard) | High | Security |
| TC-LOGIN-100009 | refresh token ปลอม/เสีย เข้า /dashboard ต้องเด้งไป login | High | Security |
| TC-LOGIN-100010 | logout ต้องลบ refresh token และเข้าถึง dashboard ไม่ได้ | High | Security |

---

## TC-LOGIN-010001 — Requestor เข้าสู่ระบบสำเร็จ

> **As a** Requestor user, **I want** core Login & Logout interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

User carmensoftware.dev+requestor@gmail.com มีอยู่จริงและ active; browser logged out

**Steps**

1. เปิด /login
2. กรอก email + password
3. กด Sign In
4. กด logout จาก user menu

**Expected**

หลัง Sign In ไปที่ /dashboard และหลัง logout กลับมา /login

---

## TC-LOGIN-010002 — HOD เข้าสู่ระบบสำเร็จ

> **As a** HOD user, **I want** core Login & Logout interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

User carmensoftware.dev+hod@gmail.com มีอยู่จริงและ active; browser logged out

**Steps**

1. เปิด /login
2. กรอก email + password
3. กด Sign In
4. กด logout จาก user menu

**Expected**

หลัง Sign In ไปที่ /dashboard และหลัง logout กลับมา /login

---

## TC-LOGIN-010003 — Purchase เข้าสู่ระบบสำเร็จ

> **As a** Purchase user, **I want** core Login & Logout interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

User carmensoftware.dev+purchase@gmail.com มีอยู่จริงและ active; browser logged out

**Steps**

1. เปิด /login
2. กรอก email + password
3. กด Sign In
4. กด logout จาก user menu

**Expected**

หลัง Sign In ไปที่ /dashboard และหลัง logout กลับมา /login

---

## TC-LOGIN-010004 — FC เข้าสู่ระบบสำเร็จ

> **As a** FC user, **I want** core Login & Logout interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

User carmensoftware.dev+fc@gmail.com มีอยู่จริงและ active; browser logged out

**Steps**

1. เปิด /login
2. กรอก email + password
3. กด Sign In
4. กด logout จาก user menu

**Expected**

หลัง Sign In ไปที่ /dashboard และหลัง logout กลับมา /login

---

## TC-LOGIN-010005 — GM เข้าสู่ระบบสำเร็จ

> **As a** GM user, **I want** core Login & Logout interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

User carmensoftware.dev+gm@gmail.com มีอยู่จริงและ active; browser logged out

**Steps**

1. เปิด /login
2. กรอก email + password
3. กด Sign In
4. กด logout จาก user menu

**Expected**

หลัง Sign In ไปที่ /dashboard และหลัง logout กลับมา /login

---

## TC-LOGIN-010006 — Owner เข้าสู่ระบบสำเร็จ

> **As a** Owner user, **I want** core Login & Logout interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

User carmensoftware.dev+owner@gmail.com มีอยู่จริงและ active; browser logged out

**Steps**

1. เปิด /login
2. กรอก email + password
3. กด Sign In
4. กด logout จาก user menu

**Expected**

หลัง Sign In ไปที่ /dashboard และหลัง logout กลับมา /login

---

## TC-LOGIN-010008 — Requestor ออกจากระบบสำเร็จ

> **As a** Requestor user, **I want** core Login & Logout interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

User carmensoftware.dev+requestor@gmail.com (Requestor) มีอยู่จริงและ active; browser logged out ก่อนเริ่ม test

**Steps**

1. เปิด /login และ login ด้วย credentials ของ role นี้
2. รอให้ไปที่ /dashboard
3. เปิด user menu จาก avatar
4. กด Logout

**Expected**

Session ถูกล้างและ redirect กลับมาที่ /login

---

## TC-LOGIN-010009 — HOD ออกจากระบบสำเร็จ

> **As a** HOD user, **I want** core Login & Logout interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

User carmensoftware.dev+hod@gmail.com (HOD) มีอยู่จริงและ active; browser logged out ก่อนเริ่ม test

**Steps**

1. เปิด /login และ login ด้วย credentials ของ role นี้
2. รอให้ไปที่ /dashboard
3. เปิด user menu จาก avatar
4. กด Logout

**Expected**

Session ถูกล้างและ redirect กลับมาที่ /login

---

## TC-LOGIN-010010 — Purchase ออกจากระบบสำเร็จ

> **As a** Purchase user, **I want** core Login & Logout interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

User carmensoftware.dev+purchase@gmail.com (Purchase) มีอยู่จริงและ active; browser logged out ก่อนเริ่ม test

**Steps**

1. เปิด /login และ login ด้วย credentials ของ role นี้
2. รอให้ไปที่ /dashboard
3. เปิด user menu จาก avatar
4. กด Logout

**Expected**

Session ถูกล้างและ redirect กลับมาที่ /login

---

## TC-LOGIN-010011 — FC ออกจากระบบสำเร็จ

> **As a** FC user, **I want** core Login & Logout interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

User carmensoftware.dev+fc@gmail.com (FC) มีอยู่จริงและ active; browser logged out ก่อนเริ่ม test

**Steps**

1. เปิด /login และ login ด้วย credentials ของ role นี้
2. รอให้ไปที่ /dashboard
3. เปิด user menu จาก avatar
4. กด Logout

**Expected**

Session ถูกล้างและ redirect กลับมาที่ /login

---

## TC-LOGIN-010012 — GM ออกจากระบบสำเร็จ

> **As a** GM user, **I want** core Login & Logout interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

User carmensoftware.dev+gm@gmail.com (GM) มีอยู่จริงและ active; browser logged out ก่อนเริ่ม test

**Steps**

1. เปิด /login และ login ด้วย credentials ของ role นี้
2. รอให้ไปที่ /dashboard
3. เปิด user menu จาก avatar
4. กด Logout

**Expected**

Session ถูกล้างและ redirect กลับมาที่ /login

---

## TC-LOGIN-010013 — Owner ออกจากระบบสำเร็จ

> **As a** Owner user, **I want** core Login & Logout interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

User carmensoftware.dev+owner@gmail.com (Owner) มีอยู่จริงและ active; browser logged out ก่อนเริ่ม test

**Steps**

1. เปิด /login และ login ด้วย credentials ของ role นี้
2. รอให้ไปที่ /dashboard
3. เปิด user menu จาก avatar
4. กด Logout

**Expected**

Session ถูกล้างและ redirect กลับมาที่ /login

---

## TC-LOGIN-010014 — แสดง error เมื่อไม่กรอกรหัสผ่าน

> **As a** any authenticated user, **I want** the system to block invalid Login & Logout submissions, **so that** data quality is preserved.

**Priority:** Medium · **Test Type:** Validation

**Preconditions**

browser logged out; อยู่ที่ /login

**Steps**

1. เปิด /login
2. กรอกเฉพาะ email
3. กด Sign In

**Expected**

คงอยู่ที่ /login; ไม่ redirect ไป dashboard

---

## TC-LOGIN-010015 — แสดง error เมื่อไม่กรอกอีเมล

> **As a** any authenticated user, **I want** the system to block invalid Login & Logout submissions, **so that** data quality is preserved.

**Priority:** Medium · **Test Type:** Validation

**Preconditions**

browser logged out; อยู่ที่ /login

**Steps**

1. เปิด /login
2. กรอกเฉพาะ password
3. กด Sign In

**Expected**

คงอยู่ที่ /login; ไม่ redirect ไป dashboard

---

## TC-LOGIN-010016 — แสดง error เมื่อไม่กรอกข้อมูลทั้งสองช่อง

> **As a** any authenticated user, **I want** the system to block invalid Login & Logout submissions, **so that** data quality is preserved.

**Priority:** Low · **Test Type:** Validation

**Preconditions**

browser logged out; อยู่ที่ /login

**Steps**

1. เปิด /login
2. ปล่อย form ว่าง
3. กด Sign In

**Expected**

คงอยู่ที่ /login

---

## TC-LOGIN-010017 — แสดง error เมื่อรูปแบบอีเมลไม่ถูกต้อง

> **As a** any authenticated user, **I want** the system to block invalid Login & Logout submissions, **so that** data quality is preserved.

**Priority:** Medium · **Test Type:** Validation

**Preconditions**

browser logged out; อยู่ที่ /login

**Steps**

1. กรอก email = 'not-an-email'
2. กรอก password
3. กด Sign In

**Expected**

คงอยู่ที่ /login; HTML5/Zod validation บล็อกการ submit

---

## TC-LOGIN-010018 — แสดง error เมื่อ credentials ไม่ถูกต้อง

> **As a** any authenticated user, **I want** the system to block invalid Login & Logout submissions, **so that** data quality is preserved.

**Priority:** Medium · **Test Type:** Validation

**Preconditions**

browser logged out; อยู่ที่ /login; ไม่มี user 'invalid@test.com' ในระบบ

**Steps**

1. เปิด /login
2. กรอก email = 'invalid@test.com', password = 'wrongpassword'
3. กด Sign In

**Expected**

แสดงข้อความ error (form หรือ alertdialog) และคงอยู่ที่ /login

---

## TC-LOGIN-010019 — แสดง error เมื่ออีเมลถูกแต่รหัสผ่านผิด

> **As a** any authenticated user, **I want** the system to block invalid Login & Logout submissions, **so that** data quality is preserved.

**Priority:** Medium · **Test Type:** Validation

**Preconditions**

User carmensoftware.dev+requestor@gmail.com มีอยู่จริงและ active; browser logged out

**Steps**

1. เปิด /login
2. กรอก email = carmensoftware.dev+requestor@gmail.com, password = 'wrong-password-xyz'
3. กด Sign In

**Expected**

แสดงข้อความ error (form หรือ alertdialog) และคงอยู่ที่ /login

---

## TC-LOGIN-010020 — อีเมลไม่สนใจตัวพิมพ์ใหญ่-เล็ก

> **As a** any authenticated user, **I want** this Login & Logout interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

User carmensoftware.dev+requestor@gmail.com มีอยู่จริงและ active; browser logged out

**Steps**

1. เปิด /login
2. กรอก email = 'CARMENSOFTWARE.DEV+REQUESTOR@GMAIL.COM' (ตัวพิมพ์ใหญ่ทั้งหมด) + password ที่ถูกต้อง
3. กด Sign In

**Expected**

Login สำเร็จและ redirect ไปที่ /dashboard (อีเมลไม่ case-sensitive)

---

## TC-LOGIN-010021 — รหัสผ่านแยกตัวพิมพ์ใหญ่-เล็ก (พิมพ์ผิดเคสต้อง fail)

> **As a** any authenticated user, **I want** the system to block invalid Login & Logout submissions, **so that** data quality is preserved.

**Priority:** Medium · **Test Type:** Validation

**Preconditions**

User tt@blueledgers.com มีอยู่จริง รหัสผ่านที่ถูกต้องคือ 'Qaz123!@#'; browser logged out

**Steps**

1. เปิด /login
2. กรอก email = tt@blueledgers.com, password = 'qaz123!@#' (ตัวพิมพ์เล็กทั้งหมด)
3. กด Sign In

**Expected**

Login fail และคงอยู่ที่ /login (password เป็น case-sensitive)

---

## TC-LOGIN-010022 — รองรับช่องว่างหน้า/หลังอีเมล

> **As a** any authenticated user, **I want** this Login & Logout interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Low · **Test Type:** Functional

**Preconditions**

User carmensoftware.dev+requestor@gmail.com มีอยู่จริงและ active; browser logged out

**Steps**

1. เปิด /login
2. กรอก email = '  carmensoftware.dev+requestor@gmail.com  ' (มีช่องว่างหน้า/หลัง) + password
3. กด Sign In

**Expected**

ระบบ trim ช่องว่างและ login สำเร็จ ไปที่ /dashboard (หรือคงอยู่ที่ /login หากเลือก reject — accept ทั้งสองแบบ)

---

## TC-LOGIN-010023 — ช่องรหัสผ่านถูก mask

> **As a** any authenticated user, **I want** this Login & Logout interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Low · **Test Type:** Functional

**Preconditions**

browser logged out; อยู่ที่ /login

**Steps**

1. เปิด /login
2. ตรวจสอบ attribute ของ password input

**Expected**

Password input มี attribute type='password' (ตัวอักษรถูก mask ไม่แสดง plain text)

---

## TC-LOGIN-010024 — กด Enter เพื่อ submit form ได้

> **As a** any authenticated user, **I want** this Login & Logout interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

User carmensoftware.dev+requestor@gmail.com มีอยู่จริงและ active; browser logged out

**Steps**

1. เปิด /login
2. กรอก email + password
3. กด Enter ในช่อง password (แทนการคลิกปุ่ม Sign In)

**Expected**

Form submit และ redirect ไปที่ /dashboard เหมือนกับการคลิกปุ่ม Sign In

---

## TC-LOGIN-010031 — StoreManager เข้าสู่ระบบสำเร็จ

> **As a** any authenticated user, **I want** core Login & Logout interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

User carmensoftware.dev+storemanager@gmail.com มีอยู่จริงและ active; browser logged out

**Steps**

1. เปิด /login
2. กรอก email + password
3. กด Sign In
4. กด logout จาก user menu

**Expected**

หลัง Sign In ไปที่ /dashboard และหลัง logout กลับมา /login

---

## TC-LOGIN-010032 — Budget เข้าสู่ระบบสำเร็จ

> **As a** any authenticated user, **I want** core Login & Logout interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

User carmensoftware.dev+budget@gmail.com มีอยู่จริงและ active; browser logged out

**Steps**

1. เปิด /login
2. กรอก email + password
3. กด Sign In
4. กด logout จาก user menu

**Expected**

หลัง Sign In ไปที่ /dashboard และหลัง logout กลับมา /login

---

## TC-LOGIN-010033 — StoreManager ออกจากระบบสำเร็จ

> **As a** any authenticated user, **I want** core Login & Logout interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

User carmensoftware.dev+storemanager@gmail.com (StoreManager) มีอยู่จริงและ active; browser logged out ก่อนเริ่ม test

**Steps**

1. เปิด /login และ login ด้วย credentials ของ role นี้
2. รอให้ไปที่ /dashboard
3. เปิด user menu จาก avatar
4. กด Logout

**Expected**

Session ถูกล้างและ redirect กลับมาที่ /login

---

## TC-LOGIN-010034 — Budget ออกจากระบบสำเร็จ

> **As a** any authenticated user, **I want** core Login & Logout interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

User carmensoftware.dev+budget@gmail.com (Budget) มีอยู่จริงและ active; browser logged out ก่อนเริ่ม test

**Steps**

1. เปิด /login และ login ด้วย credentials ของ role นี้
2. รอให้ไปที่ /dashboard
3. เปิด user menu จาก avatar
4. กด Logout

**Expected**

Session ถูกล้างและ redirect กลับมาที่ /login

---

## TC-LOGIN-010035 — login พร้อม ?next= ที่ valid ต้อง redirect ไปปลายทางนั้น

> **As a** any authenticated user, **I want** this Login & Logout interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

User carmensoftware.dev+requestor@gmail.com มีอยู่จริงและ active; browser logged out; /profile เป็น shell route ที่ requestor เข้าได้

**Steps**

1. เปิด /login?next=/profile
2. login ด้วย carmensoftware.dev+requestor@gmail.com
3. ตรวจสอบ URL ปลายทาง

**Expected**

หลัง login redirect ไป /profile (เคารพ ?next= ที่ปลอดภัย) ไม่ใช่ /dashboard

---

## TC-LOGIN-010037 — session คงอยู่หลัง reload (refresh-token boot)

> **As a** any authenticated user, **I want** this Login & Logout interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

User carmensoftware.dev+requestor@gmail.com login สำเร็จและอยู่ที่ /dashboard; refresh token ถูกเก็บใน localStorage

**Steps**

1. login ด้วย carmensoftware.dev+requestor@gmail.com
2. รอ /dashboard
3. reload หน้า
4. ตรวจสอบว่ายัง authenticated

**Expected**

หลัง reload boot ใช้ refresh token ออก access token ใหม่ → ยังอยู่ที่ /dashboard และ user menu ปรากฏ (ไม่เด้งไป /login)

---

## TC-LOGIN-010039 — ปุ่ม Sign In ถูก disable ระหว่าง request กำลังทำงาน (กัน double-submit)

> **As a** any authenticated user, **I want** this Login & Logout interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

User carmensoftware.dev+requestor@gmail.com มีอยู่จริงและ active; browser logged out

**Steps**

1. เปิด /login
2. กรอก credentials
3. กด Sign In
4. ตรวจสถานะปุ่มทันทีระหว่าง request

**Expected**

ปุ่ม disabled ระหว่าง in-flight; ถ้า backend ตอบเร็วจน redirect ไป /dashboard ก่อนสังเกตได้ ถือว่าผ่าน (ไม่เปิดช่อง double-submit) — best-effort

---

## TC-LOGIN-010040 — backend ล่มต้องแสดง error อย่างนุ่มนวลและคงอยู่ /login

> **As a** any authenticated user, **I want** the system to block invalid Login & Logout submissions, **so that** data quality is preserved.

**Priority:** Medium · **Test Type:** Validation

**Preconditions**

browser logged out; อยู่ที่ /login; mock /api/auth/login ให้ fail (network error)

**Steps**

1. intercept POST **/api/auth/login แล้ว abort
2. เปิด /login
3. กรอก carmensoftware.dev+requestor@gmail.com + password
4. กด Sign In

**Expected**

แสดง alert ข้อความ 'Could not reach the server' (ไม่ crash / ไม่โชว์ raw stack) และคงอยู่ที่ /login

---

## TC-LOGIN-010041 — ปุ่ม show/hide password สลับการแสดงรหัสผ่านได้

> **As a** any authenticated user, **I want** this Login & Logout interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Low · **Test Type:** Functional

**Preconditions**

browser logged out; อยู่ที่ /login

**Steps**

1. เปิด /login
2. กรอกรหัสผ่าน
3. กดปุ่ม Show password
4. กดปุ่ม Hide password

**Expected**

เริ่มต้น type=password; กด Show → type=text; กด Hide → type=password อีกครั้ง

---

## TC-LOGIN-010042 — หลังผิดซ้ำจนโดน rate-limit ต้องแสดง countdown และ disable ปุ่ม

> **As a** any authenticated user, **I want** this Login & Logout interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

browser logged out; backend rate-limiter เปิด (429 + retry_after หลังผิด 3 ครั้งด้วย email เดียวกัน)

**Steps**

1. สร้าง email ปลอม unique ต่อ run
2. login ด้วยรหัสผิดซ้ำ 3 ครั้ง
3. ตรวจ UI หลังโดน 429

**Expected**

แสดงข้อความ countdown 'Too many login attempts. Try again in Ns.' และปุ่ม Sign In ถูก disable — best-effort (พึ่ง retry_after จาก backend)

---

## TC-LOGIN-100001 — TT (user ไม่มี department) login ต้องแสดง dialog แจ้งยังไม่กำหนด department _(skipped)_

> **As an** unauthenticated user hitting a protected route, **I want** to be redirected to /login, **so that** protected screens stay protected.

**Priority:** High · **Test Type:** Auth-guard

**Preconditions**

User tt@blueledgers.com มีอยู่จริงและ active แต่ยังไม่ถูกกำหนด department ในระบบ; browser logged out

**Steps**

1. เปิด /login
2. กรอก email = tt@blueledgers.com, password = Qaz123!@#
3. กด Sign In

**Expected**

แสดง alertdialog/modal ข้อความ 'No department assigned' (หรือคำแปลไทยที่สื่อความเดียวกัน)

---

## TC-LOGIN-100002 — เข้า route ที่ต้อง login โดยไม่ login ต้อง redirect ไปหน้า login

> **As an** unauthenticated user hitting a protected route, **I want** to be redirected to /login, **so that** protected screens stay protected.

**Priority:** High · **Test Type:** Auth-guard

**Preconditions**

Browser ไม่มี session/cookies (logged out)

**Steps**

1. clear cookies
2. navigate ตรงไปที่ /dashboard โดยไม่ผ่าน /login

**Expected**

Auth-guard redirect กลับไปที่ /login (ไม่อนุญาตให้เข้า /dashboard เมื่อยังไม่ได้ login)

---

## TC-LOGIN-100003 — user ที่ login แล้วเข้า /login ต้อง redirect ไป dashboard

> **As an** unauthenticated user hitting a protected route, **I want** to be redirected to /login, **so that** protected screens stay protected.

**Priority:** Medium · **Test Type:** Auth-guard

**Preconditions**

User carmensoftware.dev+requestor@gmail.com login สำเร็จและมี active session อยู่แล้วที่ /dashboard

**Steps**

1. login ด้วย carmensoftware.dev+requestor@gmail.com
2. รอ /dashboard โหลดเสร็จ
3. navigate ไปที่ /login อีกครั้ง

**Expected**

Auth-guard redirect กลับไปที่ /dashboard (ไม่ให้ user ที่ login แล้วเห็นหน้า /login ซ้ำ)

---

## TC-LOGIN-100004 — อีเมลแบบ SQL injection ต้องถูก reject อย่างปลอดภัย

> **As the** system, **I want** SQL-injection payloads in Login & Logout fields to be safely handled, **so that** the database remains intact.

**Priority:** High · **Test Type:** Security

**Preconditions**

browser logged out; อยู่ที่ /login

**Steps**

1. เปิด /login
2. กรอก email = "admin' OR '1'='1", password = 'anything'
3. กด Sign In

**Expected**

Login fail และคงอยู่ที่ /login; SQL injection payload ไม่ถูก execute (ไม่มีข้อมูลรั่วไหล / ไม่ได้ session)

---

## TC-LOGIN-100005 — อีเมลแบบ XSS ต้องถูก reject อย่างปลอดภัย

> **As the** system, **I want** XSS payloads in Login & Logout inputs to be neutralized, **so that** no script executes in users' browsers.

**Priority:** High · **Test Type:** Security

**Preconditions**

browser logged out; อยู่ที่ /login

**Steps**

1. เปิด /login
2. ติด listener สำหรับ browser dialog (ห้ามเปิด)
3. กรอก email = '<script>alert(1)</script>@x.com', password = 'anything'
4. กด Sign In

**Expected**

ไม่มี alert dialog เด้งจาก XSS payload และคงอยู่ที่ /login (input ถูก sanitize/escape)

---

## TC-LOGIN-100006 — login username ผิดต้องได้รับ HTTP 401

> **As the** system, **I want** Login & Logout inputs hardened against common attacks, **so that** the application stays safe.

**Priority:** High · **Test Type:** Security

**Preconditions**

browser logged out; อยู่ที่ /login; ไม่มี user 'wrong-user@nonexistent.com' ในระบบ

**Steps**

1. เปิด /login
2. ดัก response จาก POST /auth
3. กรอก email = 'wrong-user@nonexistent.com', password = 'anypassword'
4. กด Sign In

**Expected**

Backend ตอบกลับ HTTP 401 Unauthorized และ user คงอยู่ที่ /login

---

## TC-LOGIN-100007 — login ชื่อเดิมผิด 3 ครั้ง ต้องได้รับ HTTP 429

> **As the** system, **I want** abusive Login & Logout inputs/requests bounded, **so that** safety and stability are preserved.

**Priority:** High · **Test Type:** Security

**Preconditions**

browser logged out; อยู่ที่ /login; backend rate-limiter เปิดใช้งานอยู่ (429 หลัง 3 ครั้งที่ผิดด้วย email เดียวกัน)

**Steps**

1. สร้าง email ที่ไม่มีจริง (unique per run)
2. login ด้วย email + รหัสผิด ซ้ำ 3 ครั้ง
3. ตรวจสอบ HTTP status ของ response สุดท้าย

**Expected**

Response สุดท้ายเป็น HTTP 429 Too Many Requests และคงอยู่ที่ /login (rate-limit ทำงาน)

---

## TC-LOGIN-100008 — next param แบบ external URL ต้องไม่ redirect ออกนอกเว็บ (open-redirect guard)

> **As the** system, **I want** Login & Logout inputs hardened against common attacks, **so that** the application stays safe.

**Priority:** High · **Test Type:** Security

**Preconditions**

User carmensoftware.dev+requestor@gmail.com มีอยู่จริงและ active; browser logged out

**Steps**

1. เปิด /login?next=//evil.example.com
2. login ด้วย carmensoftware.dev+requestor@gmail.com
3. ตรวจสอบ origin/path ปลายทางหลัง login

**Expected**

resolveNextPath ปฏิเสธ next ที่เป็น external URL → redirect ไป /dashboard บน origin เดิม (ไม่หลุดไป evil.example.com)

---

## TC-LOGIN-100009 — refresh token ปลอม/เสีย เข้า /dashboard ต้องเด้งไป login

> **As the** system, **I want** Login & Logout inputs hardened against common attacks, **so that** the application stays safe.

**Priority:** High · **Test Type:** Security

**Preconditions**

browser logged out; localStorage มี refresh token ที่ไม่ valid (ปลอม)

**Steps**

1. เปิด /login เพื่อ set origin
2. set localStorage carmen.refresh_token เป็นค่าปลอม
3. navigate ไป /dashboard

**Expected**

boot ใช้ refresh token ปลอม → backend ปฏิเสธ → token store ว่าง → RequireAuth เด้งไป /login

---

## TC-LOGIN-100010 — logout ต้องลบ refresh token และเข้าถึง dashboard ไม่ได้

> **As the** system, **I want** Login & Logout inputs hardened against common attacks, **so that** the application stays safe.

**Priority:** High · **Test Type:** Security

**Preconditions**

User carmensoftware.dev+requestor@gmail.com login สำเร็จและมี refresh token ใน localStorage

**Steps**

1. login ด้วย carmensoftware.dev+requestor@gmail.com
2. ตรวจว่ามี refresh token
3. logout
4. ตรวจว่า refresh token ถูกลบ
5. navigate ไป /dashboard

**Expected**

หลัง logout: refresh token ถูกลบจาก localStorage และเข้า /dashboard ไม่ได้ (เด้งกลับ /login)

---


<sub>Last regenerated: 2026-11-24 · git f462816</sub>
