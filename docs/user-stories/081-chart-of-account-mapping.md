# Chart Of Account Mapping — User Stories

_Generated from `tests/081-chart-of-account-mapping.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Chart Of Account Mapping
**Spec:** `tests/081-chart-of-account-mapping.spec.ts`
**Default role:** Admin
**Total test cases:** 13 (6 High / 7 Medium / 0 Low)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-ACMAP-010001 | แสดงหน้า Chart of Accounts Mapping พร้อมตารางของแท็บ AP | High | Smoke |
| TC-ACMAP-010002 | ตารางแสดงคอลัมน์ครบตามที่กำหนด | High | Functional |
| TC-ACMAP-010003 | ค้นหาด้วยรหัสบัญชี (Account Code) | High | Functional |
| TC-ACMAP-010007 | ค้นหาแล้วไม่พบข้อมูล แสดง empty state | Medium | Negative |
| TC-ACMAP-010008 | ล้างคำค้นด้วยปุ่มกากบาทแล้วรายการกลับมาครบ | Medium | Alternate Flow |
| TC-ACMAP-100001 | ผู้ใช้ที่ยังไม่ล็อกอินเปิด URL ตรงๆ | High | Auth-guard |
| TC-ACMAP-100002 | ผู้ใช้ที่ล็อกอินแล้วทุก role เข้าหน้านี้ได้ (ยังไม่ผูก permission/license) | Medium | Authorization |
| TC-ACMAP-400001 | สลับแท็บ Posting to AP ↔ Posting to GL | High | Functional |
| TC-ACMAP-400002 | ตัวเลขบนหัวแท็บตรงกับจำนวนแถวในตารางของแท็บนั้น | Medium | Functional |
| TC-ACMAP-400004 | คอลัมน์ Mapped แสดงเครื่องหมายถูก/กากบาทตามสถานะ | High | Functional |
| TC-ACMAP-400006 | แถบเครื่องมือแสดงปุ่มครบทั้ง 5 ปุ่ม | Medium | Functional |
| TC-ACMAP-400007 | แต่ละแถวมีเฉพาะปุ่มดินสอในคอลัมน์ท้ายสุด | Medium | Functional |
| TC-ACMAP-900001 | พิมพ์คำค้นแล้วยังไม่กด Enter ตารางไม่เปลี่ยน | Medium | Edge Case |

---

## TC-ACMAP-010001 — แสดงหน้า Chart of Accounts Mapping พร้อมตารางของแท็บ AP

> **As a** Admin user, **I want** core Chart Of Account Mapping interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG; ข้อมูลหน้านี้มาจาก mock coam-mock.ts (12 แถว — AP 8 / GL 4)

**Steps**

1. ไปที่ /config/chart-of-account-mapping
2. รอให้ DataGrid โหลดเสร็จ

**Expected**

เห็นหัวข้อ Chart of Accounts Mapping พร้อมแถบแท็บ Posting to AP / Posting to GL โดยแท็บ Posting to AP ถูกเลือกอยู่ และตารางแสดงแถวของ mapping type AP

---

## TC-ACMAP-010002 — ตารางแสดงคอลัมน์ครบตามที่กำหนด

> **As a** Admin user, **I want** this Chart Of Account Mapping interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

อยู่ที่หน้า /config/chart-of-account-mapping และตารางโหลดข้อมูลแล้ว

**Steps**

1. ดูแถวหัวตาราง

**Expected**

หัวตารางมีคอลัมน์ Location, Category, Account Code, Mapped และคอลัมน์ action ท้ายสุด

---

## TC-ACMAP-010003 — ค้นหาด้วยรหัสบัญชี (Account Code)

> **As a** Admin user, **I want** this Chart Of Account Mapping interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

อยู่ที่หน้า /config/chart-of-account-mapping; แท็บ Posting to AP ถูกเลือกอยู่

**Steps**

1. คลิกช่อง Search
2. พิมพ์รหัสบัญชีที่มีอยู่ เช่น '1106002'
3. กด Enter

**Expected**

ตารางแสดงเฉพาะแถวที่มีรหัสบัญชีนั้น

---

## TC-ACMAP-010007 — ค้นหาแล้วไม่พบข้อมูล แสดง empty state

> **As a** Admin user, **I want** this Chart Of Account Mapping behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Negative

**Preconditions**

อยู่ที่หน้า /config/chart-of-account-mapping

**Steps**

_(no steps documented)_

**Expected**

ตารางของทั้งสองแท็บไม่มีแถวข้อมูล แสดง empty state แทน และตัวเลขบนหัวแท็บทั้ง AP และ GL เป็น 0

---

## TC-ACMAP-010008 — ล้างคำค้นด้วยปุ่มกากบาทแล้วรายการกลับมาครบ

> **As a** Admin user, **I want** this Chart Of Account Mapping behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Alternate Flow

**Preconditions**

อยู่ที่หน้า /config/chart-of-account-mapping และค้นหาไว้แล้วจนรายการถูกกรอง

**Steps**

1. ค้นหาจนรายการถูกกรอง
2. คลิกปุ่มกากบาท (Clear search) ที่อยู่ท้ายช่อง Search

**Expected**

ช่อง Search ว่าง และตารางกลับมาแสดงรายการทั้งหมดของแท็บที่เปิดอยู่

---

## TC-ACMAP-100001 — ผู้ใช้ที่ยังไม่ล็อกอินเปิด URL ตรงๆ

> **As an** unauthenticated user hitting a protected route, **I want** to be redirected to /login, **so that** protected screens stay protected.

**Priority:** High · **Test Type:** Auth-guard

**Preconditions**

ไม่มี session (browser context ที่ยังไม่ได้ล็อกอิน)

**Steps**

1. เปิด URL /config/chart-of-account-mapping ตรงๆ โดยไม่มี session

**Expected**

ถูก redirect ไปหน้า /login และไม่เห็นข้อมูลผังการผูกบัญชี

---

## TC-ACMAP-100002 — ผู้ใช้ที่ล็อกอินแล้วทุก role เข้าหน้านี้ได้ (ยังไม่ผูก permission/license)

> **As a** low-privilege user, **I should NOT** see Add/edit controls on Chart Of Account Mapping, **so that** role separation is enforced.

**Priority:** Medium · **Test Type:** Authorization

**Preconditions**

Login เป็นผู้ใช้ที่ไม่ใช่ admin เช่น carmensoftware.dev+requestor@gmail.com; leaf ของหน้านี้ใน constant/module-list.ts ยังไม่ประกาศ permission

**Steps**

1. Login เป็น carmensoftware.dev+requestor@gmail.com
2. ไปที่ /config/chart-of-account-mapping

**Expected**

หน้าแสดงได้ตามปกติ ไม่มีกล่อง Access Denied และไม่ถูก redirect (RouteGuard ปล่อยผ่าน leaf ที่ไม่ประกาศ permission)

---

## TC-ACMAP-400001 — สลับแท็บ Posting to AP ↔ Posting to GL

> **As a** Admin user, **I want** this Chart Of Account Mapping interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

อยู่ที่หน้า /config/chart-of-account-mapping และแท็บ Posting to AP ถูกเลือกอยู่

**Steps**

1. คลิกแท็บ Posting to GL
2. ดูข้อมูลในตาราง
3. คลิกแท็บ Posting to AP กลับ

**Expected**

เนื้อหาตารางเปลี่ยนเป็นชุดของแท็บที่เลือกทุกครั้ง โดยไม่มีการเปลี่ยน URL

---

## TC-ACMAP-400002 — ตัวเลขบนหัวแท็บตรงกับจำนวนแถวในตารางของแท็บนั้น

> **As a** Admin user, **I want** this Chart Of Account Mapping interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

อยู่ที่หน้า /config/chart-of-account-mapping โดยยังไม่ได้ค้นหา

**Steps**

1. อ่านตัวเลขที่ต่อท้ายชื่อแท็บ Posting to AP แล้วนับจำนวนแถวในตาราง
2. คลิกแท็บ Posting to GL แล้วทำแบบเดียวกัน

**Expected**

ตัวเลขบนหัวแท็บแต่ละอันเท่ากับจำนวนแถวในตารางของแท็บนั้น

---

## TC-ACMAP-400004 — คอลัมน์ Mapped แสดงเครื่องหมายถูก/กากบาทตามสถานะ

> **As a** Admin user, **I want** this Chart Of Account Mapping interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

อยู่ที่หน้า /config/chart-of-account-mapping; ข้อมูลมีทั้งแถวที่ผูกแล้วและยังไม่ผูก

**Steps**

1. ดูคอลัมน์ Mapped ของแถวต่างๆ

**Expected**

แถวที่ผูกแล้วแสดงไอคอนเครื่องหมายถูก (Mapped) ส่วนแถวที่ยังไม่ผูกแสดงไอคอนกากบาท (Not mapped)

---

## TC-ACMAP-400006 — แถบเครื่องมือแสดงปุ่มครบทั้ง 5 ปุ่ม

> **As a** Admin user, **I want** this Chart Of Account Mapping interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

อยู่ที่หน้า /config/chart-of-account-mapping

**Steps**

1. ดูปุ่มด้านขวาของแถบเครื่องมือ

**Expected**

เห็นปุ่มครบทั้ง 5 ปุ่มและกดได้: Import, Export, Scan for New Code, Bulk Map, Edit

---

## TC-ACMAP-400007 — แต่ละแถวมีเฉพาะปุ่มดินสอในคอลัมน์ท้ายสุด

> **As a** Admin user, **I want** this Chart Of Account Mapping interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

อยู่ที่หน้า /config/chart-of-account-mapping และตารางมีข้อมูลอย่างน้อย 1 แถว

**Steps**

1. ดูคอลัมน์ท้ายสุดของแถวแรก

**Expected**

แถวมีปุ่มดินสอ (aria-label Edit) ในคอลัมน์ท้ายสุด

---

## TC-ACMAP-900001 — พิมพ์คำค้นแล้วยังไม่กด Enter ตารางไม่เปลี่ยน

> **As a** Admin user, **I want** this Chart Of Account Mapping behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Edge Case

**Preconditions**

อยู่ที่หน้า /config/chart-of-account-mapping; ช่อง Search ว่างอยู่

**Steps**

1. พิมพ์คำค้นลงในช่อง Search โดยยังไม่กด Enter
2. คลิกพื้นที่ว่างนอกช่อง Search

**Expected**

จำนวนแถวในตารางและตัวเลขบนหัวแท็บยังเท่าเดิม (การค้นหาทำงานเมื่อกด Enter เท่านั้น)

---


<sub>Last regenerated: 2026-10-15 · git 3cc3d88</sub>
