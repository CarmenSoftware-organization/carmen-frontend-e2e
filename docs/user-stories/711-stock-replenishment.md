# Stock Replenishment — User Stories

_Generated from `tests/711-stock-replenishment.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Stock Replenishment
**Spec:** `tests/711-stock-replenishment.spec.ts`
**Default role:** Requestor
**Total test cases:** 36 (14 High / 17 Medium / 5 Low)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-SRPL-010001 | หน้า Stock Replenishment โหลดสำเร็จ | High | Smoke |
| TC-SRPL-010002 | แถบสรุป (locations / items to reorder / critical / warning / low) ตรงกับข้อมูลจาก API | High | Functional |
| TC-SRPL-010003 | แถบหัว location แสดง checkbox + รหัส/ชื่อคลัง + badge จำนวนสินค้า | Medium | Functional |
| TC-SRPL-010004 | ขยาย/ยุบ location เดี่ยวได้ | Medium | Functional |
| TC-SRPL-010005 | ปุ่มสลับ Expand all / Collapse all ทำงาน | Medium | Functional |
| TC-SRPL-010006 | คอลัมน์ตารางสินค้า (select/#/Product/Stock level/Reorder/Status) แสดงครบ | Medium | Functional |
| TC-SRPL-010007 | ค้นหาด้วยชื่อ/รหัส/ชื่อท้องถิ่น/หมวด/กลุ่มสินค้า กรอง location และสินค้าที่ตรง | Medium | Functional |
| TC-SRPL-010008 | ค้นหาคำที่ไม่มีต้องไม่แสดง location ใด ๆ | Medium | Functional |
| TC-SRPL-010009 | ปุ่ม Refresh ยิง request โหลดข้อมูลใหม่ | Low | Functional |
| TC-SRPL-010010 | ล้างคำค้นด้วยปุ่ม Clear search แล้วรายการกลับมาครบ | Low | Functional |
| TC-SRPL-010050 | request ของหน้านี้ไปที่ BU ที่ active (TEST BU) | High | Smoke |
| TC-SRPL-020001 | สถานะสินค้า (Critical/Warning/Low) ในแถวตรงกับ status จาก API | Medium | Functional |
| TC-SRPL-020002 | คอลัมน์ Reorder แสดง reorder_qty ของสินค้าตรงกับ API | Medium | Functional |
| TC-SRPL-020003 | คอลัมน์ Product แสดงชื่อท้องถิ่นเป็นบรรทัดรอง | Low | Functional |
| TC-SRPL-060001 | เลือกสินค้าในแถวเดียวด้วย checkbox ได้ | High | Functional |
| TC-SRPL-060002 | เลือกทั้งหมดใน location ด้วย checkbox บนแถบหัว location | Medium | Functional |
| TC-SRPL-060003 | checkbox แถบหัว location แสดงสถานะ indeterminate เมื่อเลือกบางส่วน | Medium | Functional |
| TC-SRPL-060004 | เลือกข้ามหลาย location แล้วตัวนับรวมถูกต้อง | Medium | Functional |
| TC-SRPL-060005 | แถบ action ล่างแสดงปุ่ม Create PR / Create SR และจำนวนที่เลือกเมื่อมีการเลือก | High | Functional |
| TC-SRPL-060006 | ยกเลิกการเลือกทั้งหมดแล้วปุ่ม Create PR/SR หายไป | Medium | Functional |
| TC-SRPL-060007 | กด Create PR เปิด wizard พร้อมตารางรายการที่ติ๊ก | High | Functional |
| TC-SRPL-060008 | ปุ่ม Create ใน PR wizard ปิดจนกว่าจะเลือก workflow | High | Validation |
| TC-SRPL-060009 | ตัดแถวออกจาก PR wizard ด้วยปุ่มถังขยะ | Medium | Functional |
| TC-SRPL-060010 | กด Create SR (ติ๊กคลังเดียว) เปิด wizard พร้อม Workflow / Request From / Deliver To | High | Functional |
| TC-SRPL-060011 | ช่อง Request From ของ SR wizard ไม่มีคลังปลายทางให้เลือก | Medium | Functional |
| TC-SRPL-060012 | ปิด wizard ด้วย Cancel แล้วไม่มีเอกสารเกิดขึ้นและรายการที่ติ๊กยังอยู่ | Medium | Functional |
| TC-SRPL-100001 | ผู้ใช้ที่ไม่มีสิทธิ์ stock_in.view เปิด URL ตรง ๆ ต้องเจอ Permission Denied | High | Authorization |
| TC-SRPL-100002 | ผู้ที่ไม่ได้ login เข้าหน้าตรง ๆ ต้องถูก redirect ไป /login | High | Auth-guard |
| TC-SRPL-100003 | Admin เข้าหน้าได้ (Admin ผ่านการเช็ก permission) | Medium | Authorization |
| TC-SRPL-300001 | Create PR สร้างใบขอซื้อจากรายการที่เลือกได้สำเร็จ | High | Integration |
| TC-SRPL-300002 | Create SR สร้างใบเบิกจากรายการที่เลือกได้สำเร็จ | High | Integration |
| TC-SRPL-300003 | ติ๊กข้ามหลายคลังแล้ว Create PR ได้ใบขอซื้อคลังละใบ | High | Integration |
| TC-SRPL-900001 | กรณีไม่มีสินค้าต้องเติม แสดง empty state | Low | Edge Case |
| TC-SRPL-900002 | กด Create SR ขณะติ๊กข้าม 2 คลังขึ้นไป ต้องเตือนว่าใบเบิกทำได้ทีละคลัง | High | Edge Case |
| TC-SRPL-900003 | บัญชีที่เริ่ม workflow PR/SR ไม่ได้ กด Create PR/SR แล้วเด้ง Permission Denied | Medium | Edge Case |
| TC-SRPL-900004 | โหลดข้อมูลล้มเหลวต้องแสดง error state พร้อมปุ่ม Try again | Low | Edge Case |

---

## TC-SRPL-010001 — หน้า Stock Replenishment โหลดสำเร็จ

> **As a** Requestor user, **I want** core Stock Replenishment interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (BU-GR2VYNKQ); license store_operations.stock_replenishment

**Steps**

1. ไปที่ /store-operation/stock-replenishment

**Expected**

URL ตรงกับ path; หัวข้อและคำอธิบายหน้าแสดง; มีปุ่ม Refresh และช่องค้นหา; แถบสรุปแสดง

---

## TC-SRPL-010002 — แถบสรุป (locations / items to reorder / critical / warning / low) ตรงกับข้อมูลจาก API

> **As a** Requestor user, **I want** this Stock Replenishment interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (BU-GR2VYNKQ); license store_operations.stock_replenishment; GET /stock-replenishments ของ TEST BU มีข้อมูล

**Steps**

1. ไปที่ /store-operation/stock-replenishment
2. ตรวจแถบสรุปเหนือรายการ

**Expected**

จำนวน locations, items to reorder และ badge critical/warning/low เท่ากับที่คำนวณจาก API; badge ที่เป็น 0 ไม่แสดง

---

## TC-SRPL-010003 — แถบหัว location แสดง checkbox + รหัส/ชื่อคลัง + badge จำนวนสินค้า

> **As a** Requestor user, **I want** this Stock Replenishment interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (BU-GR2VYNKQ); license store_operations.stock_replenishment; GET /stock-replenishments ของ TEST BU มีข้อมูล

**Steps**

1. ไปที่ /store-operation/stock-replenishment
2. ตรวจแถบหัวของ location แรก

**Expected**

มี checkbox 'Select all products in <ชื่อคลัง>', รหัสและชื่อคลัง และ badge '<n> items' ตรงกับ API

---

## TC-SRPL-010004 — ขยาย/ยุบ location เดี่ยวได้

> **As a** Requestor user, **I want** this Stock Replenishment interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (BU-GR2VYNKQ); license store_operations.stock_replenishment; GET /stock-replenishments ของ TEST BU มีข้อมูล

**Steps**

1. กดที่หัว location
2. กดซ้ำ

**Expected**

ครั้งแรกสถานะ expanded สลับ และตารางสินค้าของ location แสดง/ซ่อน; ครั้งที่สองกลับสภาพเดิม

---

## TC-SRPL-010005 — ปุ่มสลับ Expand all / Collapse all ทำงาน

> **As a** Requestor user, **I want** this Stock Replenishment interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (BU-GR2VYNKQ); license store_operations.stock_replenishment; GET /stock-replenishments ของ TEST BU มีข้อมูล

**Steps**

1. กดปุ่ม Expand all
2. กดปุ่มเดิมอีกครั้ง (Collapse all)

**Expected**

หลัง Expand all ทุก location ขยายและปุ่มกลายเป็น Collapse all; หลังกด Collapse all ทุก location ยุบและปุ่มกลับเป็น Expand all

---

## TC-SRPL-010006 — คอลัมน์ตารางสินค้า (select/#/Product/Stock level/Reorder/Status) แสดงครบ

> **As a** Requestor user, **I want** this Stock Replenishment interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (BU-GR2VYNKQ); license store_operations.stock_replenishment; GET /stock-replenishments ของ TEST BU มีข้อมูล; viewport 1920x1080

**Steps**

1. ไปที่ /store-operation/stock-replenishment
2. กด Expand all
3. ตรวจหัวตารางของ location แรก

**Expected**

หัวตารางมีคอลัมน์ #, Product, Stock level, Reorder Qty, Status และแถวแสดงชื่อสินค้า

---

## TC-SRPL-010007 — ค้นหาด้วยชื่อ/รหัส/ชื่อท้องถิ่น/หมวด/กลุ่มสินค้า กรอง location และสินค้าที่ตรง

> **As a** Requestor user, **I want** to filter the Stock Replenishment list, **so that** I can narrow results to relevant records.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (BU-GR2VYNKQ); license store_operations.stock_replenishment; GET /stock-replenishments ของ TEST BU มีข้อมูล

**Steps**

1. พิมพ์รหัสสินค้าชิ้นแรกในช่อง Search
2. กด Enter

**Expected**

แสดงเฉพาะ location ที่มีสินค้าตรงรหัสนั้น และสินค้าอื่นหายไป; ตัวนับ locations ตรงกับ API

---

## TC-SRPL-010008 — ค้นหาคำที่ไม่มีต้องไม่แสดง location ใด ๆ

> **As a** Requestor user, **I want** a clear empty-state when no Stock Replenishment records match my search, **so that** I know nothing was found.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (BU-GR2VYNKQ); license store_operations.stock_replenishment; GET /stock-replenishments ของ TEST BU มีข้อมูล

**Steps**

1. พิมพ์คำค้นที่ไม่มีในระบบแล้วกด Enter

**Expected**

ไม่แสดง location ใด ๆ; แสดง empty state 'No products match' พร้อมปุ่ม Clear search

---

## TC-SRPL-010009 — ปุ่ม Refresh ยิง request โหลดข้อมูลใหม่

> **As a** Requestor user, **I want** this Stock Replenishment interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Low · **Test Type:** Functional

**Preconditions**

เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (BU-GR2VYNKQ); license store_operations.stock_replenishment

**Steps**

1. กดปุ่ม Refresh บน toolbar

**Expected**

ยิง GET /stock-replenishments ซ้ำอีกหนึ่งครั้ง และหน้ายังแสดงข้อมูลเดิม

---

## TC-SRPL-010010 — ล้างคำค้นด้วยปุ่ม Clear search แล้วรายการกลับมาครบ

> **As a** Requestor user, **I want** this Stock Replenishment interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Low · **Test Type:** Functional

**Preconditions**

เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (BU-GR2VYNKQ); license store_operations.stock_replenishment; GET /stock-replenishments ของ TEST BU มีข้อมูล

**Steps**

1. ค้นคำที่ไม่มีในระบบ
2. กดปุ่ม Clear search

**Expected**

ช่องค้นว่างและจำนวน locations กลับมาเท่ากับ API

---

## TC-SRPL-010050 — request ของหน้านี้ไปที่ BU ที่ active (TEST BU)

> **As a** Requestor user, **I want** core Stock Replenishment interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (BU-GR2VYNKQ); license store_operations.stock_replenishment

**Steps**

1. ไปที่ /store-operation/stock-replenishment
2. ตรวจ URL ของ request

**Expected**

ยิง GET /api/BU-GR2VYNKQ/stock-replenishments สำเร็จ (200)

---

## TC-SRPL-020001 — สถานะสินค้า (Critical/Warning/Low) ในแถวตรงกับ status จาก API

> **As a** Requestor user, **I want** this Stock Replenishment interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (BU-GR2VYNKQ); license store_operations.stock_replenishment; GET /stock-replenishments ของ TEST BU มีข้อมูล; viewport 1920x1080

**Steps**

1. ไปที่หน้า และกด Expand all
2. ตรวจคอลัมน์ Status ของสินค้าแต่ละสถานะ

**Expected**

แถวของสินค้า status=critical/warning/low แสดงป้ายสถานะ Critical/Warning/Low ตามลำดับ

---

## TC-SRPL-020002 — คอลัมน์ Reorder แสดง reorder_qty ของสินค้าตรงกับ API

> **As a** Requestor user, **I want** this Stock Replenishment interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (BU-GR2VYNKQ); license store_operations.stock_replenishment; GET /stock-replenishments ของ TEST BU มีข้อมูล; viewport 1920x1080

**Steps**

1. ไปที่หน้า และกด Expand all
2. ตรวจคอลัมน์ Reorder Qty ของสินค้าแรก

**Expected**

เซลล์ Reorder ของสินค้าแสดงค่า reorder_qty เดียวกับ API

---

## TC-SRPL-020003 — คอลัมน์ Product แสดงชื่อท้องถิ่นเป็นบรรทัดรอง

> **As a** Requestor user, **I want** this Stock Replenishment interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Low · **Test Type:** Functional

**Preconditions**

เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (BU-GR2VYNKQ); license store_operations.stock_replenishment; GET /stock-replenishments ของ TEST BU มีข้อมูล; มีสินค้าที่มี local_name

**Steps**

1. ไปที่หน้า และกด Expand all
2. ตรวจเซลล์สินค้าที่มีชื่อท้องถิ่น

**Expected**

เซลล์สินค้าแสดงชื่อหลักและชื่อท้องถิ่นในเซลล์เดียวกัน

---

## TC-SRPL-060001 — เลือกสินค้าในแถวเดียวด้วย checkbox ได้

> **As a** Requestor user, **I want** this Stock Replenishment interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (BU-GR2VYNKQ); license store_operations.stock_replenishment; GET /stock-replenishments ของ TEST BU มีข้อมูล

**Steps**

1. กด Expand all
2. ติ๊ก checkbox ของสินค้าแรก

**Expected**

checkbox ถูกเลือก; แถบล่างแสดง '1 item selected' พร้อมปุ่ม Create SR และ Create PR

---

## TC-SRPL-060002 — เลือกทั้งหมดใน location ด้วย checkbox บนแถบหัว location

> **As a** Requestor user, **I want** this Stock Replenishment interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (BU-GR2VYNKQ); license store_operations.stock_replenishment; GET /stock-replenishments ของ TEST BU มีข้อมูล

**Steps**

1. ติ๊ก checkbox บนแถบหัว location แรก

**Expected**

สินค้าทุกชิ้นใน location ถูกเลือก; ตัวนับเท่ากับจำนวนสินค้าของ location

---

## TC-SRPL-060003 — checkbox แถบหัว location แสดงสถานะ indeterminate เมื่อเลือกบางส่วน

> **As a** Requestor user, **I want** this Stock Replenishment interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (BU-GR2VYNKQ); license store_operations.stock_replenishment; GET /stock-replenishments ของ TEST BU มีข้อมูล; location แรกมีสินค้า >= 2

**Steps**

1. กด Expand all
2. ติ๊กสินค้าเพียงชิ้นเดียวใน location

**Expected**

checkbox บนแถบหัว location เป็น mixed (aria-checked='mixed')

---

## TC-SRPL-060004 — เลือกข้ามหลาย location แล้วตัวนับรวมถูกต้อง

> **As a** Requestor user, **I want** this Stock Replenishment interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (BU-GR2VYNKQ); license store_operations.stock_replenishment; GET /stock-replenishments ของ TEST BU มีข้อมูล; มีอย่างน้อย 2 location

**Steps**

1. ติ๊ก checkbox หัว location ที่ 1 และที่ 2

**Expected**

ตัวนับรวมเท่ากับจำนวนสินค้าของสอง location รวมกัน

---

## TC-SRPL-060005 — แถบ action ล่างแสดงปุ่ม Create PR / Create SR และจำนวนที่เลือกเมื่อมีการเลือก

> **As a** Requestor user, **I want** this Stock Replenishment interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (BU-GR2VYNKQ); license store_operations.stock_replenishment; GET /stock-replenishments ของ TEST BU มีข้อมูล

**Steps**

1. ยังไม่เลือกอะไร ตรวจแถบ
2. ติ๊กเลือกสินค้า 1 รายการ

**Expected**

ก่อนเลือกไม่มีปุ่ม Create PR/SR; หลังเลือกมีปุ่มทั้งสองและข้อความ '1 item selected'

---

## TC-SRPL-060006 — ยกเลิกการเลือกทั้งหมดแล้วปุ่ม Create PR/SR หายไป

> **As a** Requestor user, **I want** this Stock Replenishment interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (BU-GR2VYNKQ); license store_operations.stock_replenishment; GET /stock-replenishments ของ TEST BU มีข้อมูล

**Steps**

1. ติ๊กสินค้า
2. ติ๊กออกอีกครั้ง

**Expected**

แถบ action และปุ่ม Create PR/SR หายไป

---

## TC-SRPL-060007 — กด Create PR เปิด wizard พร้อมตารางรายการที่ติ๊ก

> **As a** Requestor user, **I want** this Stock Replenishment interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (BU-GR2VYNKQ); license store_operations.stock_replenishment; GET /stock-replenishments ของ TEST BU มีข้อมูล; role Purchase เริ่ม workflow PR ได้

**Steps**

1. ติ๊กสินค้า
2. กดปุ่ม Create PR

**Expected**

เปิด dialog 'Create Purchase Request' ที่มีแถวของสินค้าที่ติ๊กและช่อง Workflow

---

## TC-SRPL-060008 — ปุ่ม Create ใน PR wizard ปิดจนกว่าจะเลือก workflow

> **As a** Requestor user, **I want** the system to block invalid Stock Replenishment submissions, **so that** data quality is preserved.

**Priority:** High · **Test Type:** Validation

**Preconditions**

เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (BU-GR2VYNKQ); license store_operations.stock_replenishment; GET /stock-replenishments ของ TEST BU มีข้อมูล

**Steps**

1. เปิด PR wizard โดยยังไม่เลือก workflow
2. เลือก workflow

**Expected**

ก่อนเลือก workflow ปุ่ม Create ถูก disable; หลังเลือกปุ่ม Create enable

---

## TC-SRPL-060009 — ตัดแถวออกจาก PR wizard ด้วยปุ่มถังขยะ

> **As a** Requestor user, **I want** this Stock Replenishment interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (BU-GR2VYNKQ); license store_operations.stock_replenishment; GET /stock-replenishments ของ TEST BU มีข้อมูล; location แรกมีสินค้า >= 2

**Steps**

1. ติ๊กสินค้า 2 ชิ้นใน location
2. เปิด PR wizard
3. กดถังขยะของแถวแรก

**Expected**

dialog แสดง '2 items' ก่อนลบ; หลังลบเหลือ '1 item' และสินค้าที่ลบหายจาก dialog

---

## TC-SRPL-060010 — กด Create SR (ติ๊กคลังเดียว) เปิด wizard พร้อม Workflow / Request From / Deliver To

> **As a** Requestor user, **I want** this Stock Replenishment interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (BU-GR2VYNKQ); license store_operations.stock_replenishment; GET /stock-replenishments ของ TEST BU มีข้อมูล; role Purchase เริ่ม workflow SR ได้

**Steps**

1. ติ๊กสินค้าจาก location เดียว
2. กดปุ่ม Create SR

**Expected**

เปิด dialog 'Create Store Requisition' มีฟิลด์ Workflow, Request From, Deliver To และแถวสินค้าที่ติ๊ก

---

## TC-SRPL-060011 — ช่อง Request From ของ SR wizard ไม่มีคลังปลายทางให้เลือก

> **As a** Requestor user, **I want** a clear empty-state when no Stock Replenishment records match my search, **so that** I know nothing was found.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (BU-GR2VYNKQ); license store_operations.stock_replenishment; GET /stock-replenishments ของ TEST BU มีข้อมูล; มีอย่างน้อย 2 location

**Steps**

1. ติ๊กสินค้าของ location ที่ 1
2. เปิด SR wizard
3. เปิด dropdown Request From

**Expected**

ตัวเลือกใน Request From ไม่มีชื่อ location ที่ 1 (ปลายทาง)

---

## TC-SRPL-060012 — ปิด wizard ด้วย Cancel แล้วไม่มีเอกสารเกิดขึ้นและรายการที่ติ๊กยังอยู่

> **As a** Requestor user, **I want** a clear empty-state when no Stock Replenishment records match my search, **so that** I know nothing was found.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (BU-GR2VYNKQ); license store_operations.stock_replenishment; GET /stock-replenishments ของ TEST BU มีข้อมูล

**Steps**

1. ติ๊กสินค้า
2. กด Create PR แล้วกด Cancel

**Expected**

dialog ปิด; จำนวน PR ใน BU ไม่เปลี่ยน (API); ตัวนับยังเป็น '1 item selected'

---

## TC-SRPL-100001 — ผู้ใช้ที่ไม่มีสิทธิ์ stock_in.view เปิด URL ตรง ๆ ต้องเจอ Permission Denied

> **As a** low-privilege user, **I should NOT** see Add/edit controls on Stock Replenishment, **so that** role separation is enforced.

**Priority:** High · **Test Type:** Authorization

**Preconditions**

เข้าสู่ระบบเป็น Requestor (ไม่มี inventory_management.stock_in ใน /api/user/profile)

**Steps**

1. เปิด /store-operation/stock-replenishment โดยตรง

**Expected**

แสดง Permission Denied และไม่แสดงรายการ location

---

## TC-SRPL-100002 — ผู้ที่ไม่ได้ login เข้าหน้าตรง ๆ ต้องถูก redirect ไป /login

> **As an** unauthenticated user hitting a protected route, **I want** to be redirected to /login, **so that** protected screens stay protected.

**Priority:** High · **Test Type:** Auth-guard

**Preconditions**

ไม่มี session

**Steps**

1. เปิด /store-operation/stock-replenishment ใน browser context ใหม่

**Expected**

ถูก redirect ไปยัง /login และไม่มีรายการ location บนจอ

---

## TC-SRPL-100003 — Admin เข้าหน้าได้ (Admin ผ่านการเช็ก permission)

> **As a** low-privilege user, **I should NOT** see Add/edit controls on Stock Replenishment, **so that** role separation is enforced.

**Priority:** Medium · **Test Type:** Authorization

**Preconditions**

เข้าสู่ระบบเป็น Admin (ผ่านการเช็ก permission); active BU = TEST BU

**Steps**

1. ไปที่ /store-operation/stock-replenishment

**Expected**

เข้าหน้าสำเร็จ: หัวข้อ, ปุ่ม Refresh และข้อมูล location แสดง ไม่มี Permission Denied

---

## TC-SRPL-300001 — Create PR สร้างใบขอซื้อจากรายการที่เลือกได้สำเร็จ

> **As a** Requestor user, **I want** this Stock Replenishment behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Integration

**Preconditions**

เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (BU-GR2VYNKQ); license store_operations.stock_replenishment; GET /stock-replenishments ของ TEST BU มีข้อมูล; Purchase เริ่ม workflow PR ได้ (สร้าง PR จริงใน TEST BU)

**Steps**

1. ติ๊กสินค้า 1 ชิ้น
2. เปิด PR wizard เลือก workflow
3. กด Create

**Expected**

toast 'Created 1 purchase request(s)'; dialog ปิด; จำนวน PR ใน BU เพิ่มขึ้น 1 (API); ตัวนับที่เลือกถูกล้าง

---

## TC-SRPL-300002 — Create SR สร้างใบเบิกจากรายการที่เลือกได้สำเร็จ

> **As a** Requestor user, **I want** this Stock Replenishment behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Integration

**Preconditions**

เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (BU-GR2VYNKQ); license store_operations.stock_replenishment; GET /stock-replenishments ของ TEST BU มีข้อมูล; มีอย่างน้อย 2 location (ต้นทาง/ปลายทาง); Purchase เริ่ม workflow SR ได้ (สร้าง SR จริงใน TEST BU)

**Steps**

1. ติ๊กสินค้า 1 ชิ้น
2. เปิด SR wizard เลือก workflow และ Request From
3. กด Create

**Expected**

toast สร้างสำเร็จ; dialog ปิด; จำนวน SR ใน BU เพิ่มขึ้น 1 (API)

---

## TC-SRPL-300003 — ติ๊กข้ามหลายคลังแล้ว Create PR ได้ใบขอซื้อคลังละใบ

> **As a** Requestor user, **I want** this Stock Replenishment behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Integration

**Preconditions**

เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (BU-GR2VYNKQ); license store_operations.stock_replenishment; GET /stock-replenishments ของ TEST BU มีข้อมูล; มีอย่างน้อย 2 location; Purchase เริ่ม workflow PR ได้ (สร้าง PR จริงใน TEST BU)

**Steps**

1. ติ๊กสินค้า 1 ชิ้นจากแต่ละ location (2 คลัง)
2. เปิด PR wizard เลือก workflow
3. กด Create

**Expected**

wizard บอก '2 purchase requests will be created'; หลังกด Create จำนวน PR ใน BU เพิ่มขึ้น 2 (API)

---

## TC-SRPL-900001 — กรณีไม่มีสินค้าต้องเติม แสดง empty state

> **As a** Requestor user, **I want** this Stock Replenishment behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Low · **Test Type:** Edge Case

**Preconditions**

เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (BU-GR2VYNKQ); license store_operations.stock_replenishment; endpoint ถูก mock ให้ตอบ data=[]

**Steps**

1. ไปที่ /store-operation/stock-replenishment

**Expected**

แสดง 'Every location is within its stock levels' และไม่มีแถบสรุป/ตาราง

---

## TC-SRPL-900002 — กด Create SR ขณะติ๊กข้าม 2 คลังขึ้นไป ต้องเตือนว่าใบเบิกทำได้ทีละคลัง

> **As a** Requestor user, **I want** this Stock Replenishment behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Edge Case

**Preconditions**

เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (BU-GR2VYNKQ); license store_operations.stock_replenishment; GET /stock-replenishments ของ TEST BU มีข้อมูล; มีอย่างน้อย 2 location

**Steps**

1. ติ๊กหัว location ที่ 1 และที่ 2
2. กดปุ่ม Create SR

**Expected**

แสดง dialog 'One location per requisition' และไม่เปิด SR wizard

---

## TC-SRPL-900003 — บัญชีที่เริ่ม workflow PR/SR ไม่ได้ กด Create PR/SR แล้วเด้ง Permission Denied

> **As a** Requestor user, **I want** this Stock Replenishment behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Edge Case

**Preconditions**

เข้าสู่ระบบเป็น Admin (GET /workflows/type/purchase_request และ store_requisition ตอบ can_create=false); TEST BU มีสินค้าในรายการ

**Steps**

1. ติ๊กสินค้า 1 ชิ้น
2. กดปุ่ม Create PR (ปุ่มจางแต่ยังกดได้)
3. ปิด dialog แล้วกด Create SR

**Expected**

ทั้งสองปุ่มแสดง dialog Permission Denied และไม่เปิด wizard

---

## TC-SRPL-900004 — โหลดข้อมูลล้มเหลวต้องแสดง error state พร้อมปุ่ม Try again

> **As a** Requestor user, **I want** this Stock Replenishment behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Low · **Test Type:** Edge Case

**Preconditions**

เข้าสู่ระบบเป็น Purchase (inventory_management.stock_in + เริ่ม workflow PR/SR ได้); active BU = TEST BU (BU-GR2VYNKQ); license store_operations.stock_replenishment

**Steps**

1. ตั้ง route intercept ตอบ 500 สำหรับ endpoint stock-replenishments
2. ไปที่หน้านี้
3. ปลด intercept แล้วกด Try again

**Expected**

แสดง ErrorState พร้อมปุ่ม Try again; กดลองใหม่แล้วข้อมูลกลับมา

---


<sub>Last regenerated: 2026-11-21 · git 2b5d5dd</sub>
