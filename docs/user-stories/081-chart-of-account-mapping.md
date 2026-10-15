# Chart Of Account Mapping — User Stories

_Generated from `tests/081-chart-of-account-mapping.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Chart Of Account Mapping
**Spec:** `tests/081-chart-of-account-mapping.spec.ts`
**Default role:** any authenticated
**Total test cases:** 13 (6 High / 7 Medium / 0 Low)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-ACMAP-010001 | แสดงหน้า Chart of Accounts Mapping พร้อมตารางของแท็บ AP | High | Smoke |
| TC-ACMAP-010002 | ตารางแสดงคอลัมน์ครบตามที่กำหนด | High | Functional |
| TC-ACMAP-010003 | ค้นหาด้วยชื่อ Location | High | Functional |
| TC-ACMAP-010007 | ค้นหาแล้วไม่พบข้อมูล แสดง empty state | Medium | Negative |
| TC-ACMAP-010008 | ล้างคำค้นด้วยปุ่มกากบาทแล้วรายการกลับมาครบ | Medium | Alternate Flow |
| TC-ACMAP-100001 | ผู้ใช้ที่ยังไม่ล็อกอินเปิด URL ตรงๆ | High | Auth-guard |
| TC-ACMAP-100002 | ผู้ใช้ที่ไม่มีสิทธิ์ configuration.chart_of_account_mapping เห็น Permission Denied | Medium | Authorization |
| TC-ACMAP-400001 | สลับแท็บ Post to AP ↔ Post to GL | High | Functional |
| TC-ACMAP-400002 | ตัวเลขข้างหัวข้อตรงกับจำนวนรวมในแถบ pagination | Medium | Functional |
| TC-ACMAP-400004 | กด chip สถานะ Incomplete แล้วตารางเหลือเฉพาะแถว Incomplete | High | Functional |
| TC-ACMAP-400006 | ปุ่ม Generate แสดงเสมอ ส่วน Edit / Mark as reviewed แสดงเมื่อเลือกแถว | Medium | Functional |
| TC-ACMAP-400007 | คลิกชื่อ Location ในแถวแล้วเปิดหน้าต่าง Edit mapping | Medium | Functional |
| TC-ACMAP-900001 | พิมพ์คำค้นแล้วยังไม่กด Enter ตารางไม่เปลี่ยน | Medium | Edge Case |

---

## TC-ACMAP-010001 — แสดงหน้า Chart of Accounts Mapping พร้อมตารางของแท็บ AP

> **As a** any authenticated user, **I want** core Chart Of Account Mapping interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; active BU = GR2VYNKQ; BU มีแถว account mapping อย่างน้อย 1 แถว

**Steps**

1. ไปที่ /config/chart-of-account-mapping
2. รอให้ตารางโหลดเสร็จ

**Expected**

เห็นหัวข้อ Chart of Accounts Mapping พร้อมแท็บ Post to AP / Post to GL โดยแท็บ Post to AP ถูกเลือกอยู่ และตารางมีข้อมูลอย่างน้อย 1 แถว

---

## TC-ACMAP-010002 — ตารางแสดงคอลัมน์ครบตามที่กำหนด

> **As a** any authenticated user, **I want** this Chart Of Account Mapping interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

อยู่ที่หน้า /config/chart-of-account-mapping แท็บ Post to AP และตารางโหลดข้อมูลแล้ว

**Steps**

1. ดูแถวหัวตาราง

**Expected**

หัวตารางมีคอลัมน์ Location, Location type, Category, Item Group, Movement, Cost center, Account และ Status

---

## TC-ACMAP-010003 — ค้นหาด้วยชื่อ Location

> **As a** any authenticated user, **I want** this Chart Of Account Mapping interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

อยู่ที่หน้า /config/chart-of-account-mapping แท็บ Post to AP และตารางมีข้อมูล

**Steps**

1. อ่านชื่อ Location ของแถวแรก
2. พิมพ์ชื่อนั้นในช่อง Search
3. กด Enter

**Expected**

จำนวนรวมในแถบ pagination ไม่เพิ่มขึ้น และทุกแถวในหน้าแรกเป็นของ Location นั้น

---

## TC-ACMAP-010007 — ค้นหาแล้วไม่พบข้อมูล แสดง empty state

> **As a** any authenticated user, **I want** this Chart Of Account Mapping behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Negative

**Preconditions**

อยู่ที่หน้า /config/chart-of-account-mapping

**Steps**

_(no steps documented)_

**Expected**

ตารางไม่มีแถวข้อมูล แสดง empty state แทน

---

## TC-ACMAP-010008 — ล้างคำค้นด้วยปุ่มกากบาทแล้วรายการกลับมาครบ

> **As a** any authenticated user, **I want** this Chart Of Account Mapping behavior verified, **so that** the feature works as expected.
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

ไม่มี session (browser context ใหม่ที่ล้าง storageState ทิ้ง)

**Steps**

1. เปิด URL /config/chart-of-account-mapping ตรงๆ โดยไม่มี session

**Expected**

ถูก redirect ไปหน้า /login และไม่เห็นข้อมูลผังการผูกบัญชี

---

## TC-ACMAP-100002 — ผู้ใช้ที่ไม่มีสิทธิ์ configuration.chart_of_account_mapping เห็น Permission Denied

> **As a** low-privilege user, **I should NOT** see Add/edit controls on Chart Of Account Mapping, **so that** role separation is enforced.

**Priority:** Medium · **Test Type:** Authorization

**Preconditions**

Login เป็น carmensoftware.dev+requestor@gmail.com ซึ่ง role ไม่มีสิทธิ์ configuration.chart_of_account_mapping

**Steps**

1. Login เป็น carmensoftware.dev+requestor@gmail.com
2. ไปที่ /config/chart-of-account-mapping

**Expected**

ยังอยู่ที่ URL /config/chart-of-account-mapping (ไม่ถูก redirect ไป /login) แต่หน้าขึ้น Permission Denied และไม่มีตารางผังการผูกบัญชี

---

## TC-ACMAP-400001 — สลับแท็บ Post to AP ↔ Post to GL

> **As a** any authenticated user, **I want** this Chart Of Account Mapping interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

อยู่ที่หน้า /config/chart-of-account-mapping และแท็บ Post to AP ถูกเลือกอยู่

**Steps**

1. คลิกแท็บ Post to GL
2. ดูสถานะแท็บ
3. คลิกแท็บ Post to AP กลับ

**Expected**

แท็บที่คลิกถูกเลือก (aria-selected) ทุกครั้ง และยังอยู่ที่หน้า /config/chart-of-account-mapping

---

## TC-ACMAP-400002 — ตัวเลขข้างหัวข้อตรงกับจำนวนรวมในแถบ pagination

> **As a** any authenticated user, **I want** to paginate through Chart Of Account Mapping records, **so that** I can browse large lists efficiently.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

อยู่ที่หน้า /config/chart-of-account-mapping โดยยังไม่ได้ค้นหาหรือกรอง

**Steps**

1. อ่านตัวเลขที่อยู่ข้างหัวข้อหน้า
2. อ่านจำนวนรวม (of N) ในแถบ pagination ใต้ตาราง

**Expected**

ตัวเลขทั้งสองเท่ากัน

---

## TC-ACMAP-400004 — กด chip สถานะ Incomplete แล้วตารางเหลือเฉพาะแถว Incomplete

> **As a** any authenticated user, **I want** this Chart Of Account Mapping interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

อยู่ที่หน้า /config/chart-of-account-mapping แท็บ Post to AP; ยังไม่ได้เลือก chip สถานะใด

**Steps**

1. คลิก chip Incomplete ในกลุ่ม Filter by status
2. ดูคอลัมน์ Status ของทุกแถวในหน้าแรก
3. คลิก chip Incomplete อีกครั้ง

**Expected**

chip Incomplete อยู่ในสถานะกด (aria-pressed=true) และทุกแถวที่เห็นมีป้าย Incomplete (หรือแสดง empty state ถ้าไม่มีแถว Incomplete); กดซ้ำแล้ว chip กลับเป็นไม่กด

---

## TC-ACMAP-400006 — ปุ่ม Generate แสดงเสมอ ส่วน Edit / Mark as reviewed แสดงเมื่อเลือกแถว

> **As a** any authenticated user, **I want** this Chart Of Account Mapping interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

อยู่ที่หน้า /config/chart-of-account-mapping และตารางมีข้อมูลอย่างน้อย 1 แถว

**Steps**

1. ดูปุ่มด้านขวาของหัวหน้า
2. ติ๊ก checkbox ของแถวแรก
3. ดูปุ่มด้านขวาอีกครั้ง
4. เอาติ๊กออก

**Expected**

ก่อนเลือกเห็นปุ่ม Generate mapping rows แต่ไม่เห็นปุ่ม Edit / Mark as reviewed; หลังเลือก 1 แถวเห็นปุ่ม Edit (1) และ Mark as reviewed (1); เอาติ๊กออกแล้วสองปุ่มนั้นหายไป

---

## TC-ACMAP-400007 — คลิกชื่อ Location ในแถวแล้วเปิดหน้าต่าง Edit mapping

> **As a** any authenticated user, **I want** this Chart Of Account Mapping interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

อยู่ที่หน้า /config/chart-of-account-mapping และตารางมีข้อมูลอย่างน้อย 1 แถว

**Steps**

1. คลิกชื่อ Location ของแถวแรก
2. ดูหน้าต่างที่เปิดขึ้น
3. กด Escape

**Expected**

เปิด sheet หัวข้อ Edit mapping และปิดได้ด้วย Escape โดยไม่บันทึกอะไร

---

## TC-ACMAP-900001 — พิมพ์คำค้นแล้วยังไม่กด Enter ตารางไม่เปลี่ยน

> **As a** any authenticated user, **I want** this Chart Of Account Mapping behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Edge Case

**Preconditions**

อยู่ที่หน้า /config/chart-of-account-mapping; ช่อง Search ว่างอยู่

**Steps**

1. พิมพ์คำค้นลงในช่อง Search โดยยังไม่กด Enter
2. คลิกพื้นที่ว่างนอกช่อง Search

**Expected**

จำนวนแถวในตารางและจำนวนรวมในแถบ pagination ยังเท่าเดิม (การค้นหาทำงานเมื่อกด Enter เท่านั้น)

---


<sub>Last regenerated: 2026-10-15 · git ebea90a</sub>
