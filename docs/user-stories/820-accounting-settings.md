# Accounting Settings — User Stories

_Generated from `tests/820-accounting-settings.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Accounting Settings
**Spec:** `tests/820-accounting-settings.spec.ts`
**Default role:** Requestor
**Total test cases:** 4 (2 High / 2 Medium / 0 Low)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-ACCT-010001 | หน้าตั้งค่า Accounting แสดงบัญชี gl_setting ที่ seed ไว้ด้วยรหัสบัญชี | High | Smoke |
| TC-ACCT-020001 | Requestor (view-only) เปิดหน้าตั้งค่า Accounting: ไม่มีปุ่ม Edit และ PUT gl_setting ผ่าน API ถูกปฏิเสธ | High | Authorization |
| TC-ACCT-030001 | (mock) แดชบอร์ด AP (/accounting/accounts-payable) โหลดและแสดงตัวเลข AP outstanding ไม่ใช่ 0 | Medium | Smoke |
| TC-ACCT-030002 | (mock) แดชบอร์ด GL (/accounting) โหลดและแสดงตัวเลข Unposted JV ไม่ใช่ 0 | Medium | Smoke |

---

## TC-ACCT-010001 — หน้าตั้งค่า Accounting แสดงบัญชี gl_setting ที่ seed ไว้ด้วยรหัสบัญชี

> **As a** Requestor user, **I want** core Accounting Settings interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

Admin login บน TEST BU; gl_setting มีบัญชี AP control / Input VAT / WHT payable / Advance deposit (data:reset)

**Steps**

1. อ่าน gl_setting ผ่าน API และแปลง id บัญชีเป็นรหัส
2. เปิด /accounting/settings
3. อ่านช่องบัญชีทั้ง 4 ช่อง

**Expected**

แต่ละช่อง (AP control account, Input VAT account, WHT payable account, Advance deposit account) แสดงรหัสบัญชีตรงกับ gl_setting; Admin เห็นปุ่ม Edit (มีสิทธิ์เขียน). assumption: oracle ไม่ได้กำหนดหน้านี้ เป็นการยืนยันว่าหน้าอ่านค่าตั้งต้นที่ spec AP / JV พึ่งพา

---

## TC-ACCT-020001 — Requestor (view-only) เปิดหน้าตั้งค่า Accounting: ไม่มีปุ่ม Edit และ PUT gl_setting ผ่าน API ถูกปฏิเสธ

> **As a** low-privilege user, **I should NOT** see Add/edit controls on Accounting Settings, **so that** role separation is enforced.

**Priority:** High · **Test Type:** Authorization

**Preconditions**

Requestor login (ไม่มี configuration.app_config.update); gl_setting มีค่าอยู่แล้ว

**Steps**

1. เปิด /accounting/settings
2. หาปุ่ม Edit
3. Requestor เรียก PUT app-config/gl_setting ด้วยค่าเดิมผ่าน API
4. อ่านค่า gl_setting อีกครั้ง

**Expected**

หน้าแสดง Permission Denied (Requestor ไม่มี configuration.app_config.view จึงเปิดหน้าไม่ได้ด้วยซ้ำ) และไม่มีปุ่ม Edit/Save; PUT ตอบ 403 และค่า gl_setting ไม่เปลี่ยน. rule: หน้าอ่านต้องมี configuration.app_config.view และเขียนต้องมี configuration.app_config.update (FE module-list + writable, gateway PUT permission). assumption: oracle ไม่ได้กำหนดสิทธิ์ของหน้านี้

---

## TC-ACCT-030001 — (mock) แดชบอร์ด AP (/accounting/accounts-payable) โหลดและแสดงตัวเลข AP outstanding ไม่ใช่ 0

> **As a** Requestor user, **I want** core Accounting Settings interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** Medium · **Test Type:** Smoke

**Preconditions**

Admin login บน TEST BU; license accounting.ap

**Steps**

1. เปิด /accounting/accounts-payable
2. อ่านแผง Key metrics

**Expected**

หัวเรื่อง Accounts Payable Dashboard; แผง Key metrics มีการ์ด 'AP outstanding' ที่แสดงจำนวนเงินที่ไม่ใช่ 0. assumption: FE ใช้ข้อมูลตัวอย่าง (mock) ของแดชบอร์ดตรง ๆ ตัวเลขจึงไม่ได้มาจาก read set ของ BU; เคสนี้ยืนยันว่าหน้าแสดงตัวเลข ไม่ใช่ความถูกต้องของยอดบัญชี

---

## TC-ACCT-030002 — (mock) แดชบอร์ด GL (/accounting) โหลดและแสดงตัวเลข Unposted JV ไม่ใช่ 0

> **As a** Requestor user, **I want** core Accounting Settings interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** Medium · **Test Type:** Smoke

**Preconditions**

Admin login บน TEST BU; license accounting.gl

**Steps**

1. เปิด /accounting
2. อ่านแผง Key metrics

**Expected**

หัวเรื่อง General Ledger Dashboard; แผง Key metrics มีการ์ด 'Unposted JV' ที่แสดงตัวเลขไม่ใช่ 0. assumption: FE ใช้ข้อมูลตัวอย่าง (mock) ตรง ๆ ตัวเลขไม่ได้มาจาก read set ของ BU

---


<sub>Last regenerated: 2026-11-24 · git f462816</sub>
