# Import Pos — User Stories

_Generated from `tests/140-import-pos.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Import Pos
**Spec:** `tests/140-import-pos.spec.ts`
**Default role:** Admin
**Total test cases:** 8 (4 High / 3 Medium / 1 Low)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-IPOS-010001 | อัปโหลดไฟล์ Simphony ผ่านหน้าเว็บ: ประวัติขึ้น success, บรรทัดดิบครบ, ไม่มีปุ่ม mapping/confirm, ลิงก์ไป SC ของวันนั้น | High | Happy Path |
| TC-IPOS-010002 | แสดงปุ่มอัปโหลดเฉพาะแบรนด์ที่ BU เปิด: Simphony มี, Micros 3700 ไม่มี | Medium | Functional |
| TC-IPOS-020001 | อัปโหลดร้านและวันเดิมซ้ำ: API 201 สถานะ rejected_duplicate และมีแถวในประวัติ | High | Negative |
| TC-IPOS-020002 | ไฟล์ว่าง: 400 POS_SALE_UNSUPPORTED_FILE | Medium | Negative |
| TC-IPOS-020003 | ไฟล์ที่ GLID วันแรก ≠ วันสุดท้าย: สถานะ multi_day_glid_reject และขึ้นในประวัติ | Medium | Negative |
| TC-IPOS-020004 | Micros 3700 check ที่ส่งบรรทัดของไฟล์ Simphony: ไม่นำเข้า ตอบ rejected และบันทึกเป็น format_error | Low | Negative |
| TC-IPOS-030001 | ยกเลิก import เดียวของวันที่ยังไม่ post: import เป็น cancelled และวันนั้นไม่มี SC | High | Happy Path |
| TC-IPOS-030002 | ยกเลิก import ของวันที่ SC post แล้ว: ถูกปฏิเสธ import ยัง live | High | Negative |

---

## TC-IPOS-010001 — อัปโหลดไฟล์ Simphony ผ่านหน้าเว็บ: ประวัติขึ้น success, บรรทัดดิบครบ, ไม่มีปุ่ม mapping/confirm, ลิงก์ไป SC ของวันนั้น

> **As a** Admin user, **I want** this Import Pos behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Happy Path

**Preconditions**

Admin login บน TEST BU; data:reset แล้ว (เปิด Simphony); ยังไม่มี import live ของร้าน E2E-140 วันขายที่ 1 ของงวด

**Steps**

1. เปิด /operation-plan/import-pos
2. อัปโหลดไฟล์ Simphony ของวัน 1 (2 outlet x 2 สินค้า, 4 บรรทัด)
3. ดูแถวประวัติของไฟล์
4. กด View lines แล้วเทียบบรรทัดดิบกับไฟล์
5. ตรวจว่าไม่มีปุ่ม mapping / confirm
6. กดลิงก์ Sales Consumption ของแถว

**Expected**

แถวประวัติสถานะ Imported, 4 บรรทัด, ยอดขาย 475.00 (API: status success, line_count 4); ตาราง Raw transactions มี 4 บรรทัด ตรง outlet/item/qty/amount ของไฟล์ทุกบรรทัด; หน้าไม่มีปุ่ม Confirm / Map; ลิงก์ SC เปิดหน้า SC ของวัน 1 โดย id ใน URL = id ของ SC จาก scForDay

---

## TC-IPOS-010002 — แสดงปุ่มอัปโหลดเฉพาะแบรนด์ที่ BU เปิด: Simphony มี, Micros 3700 ไม่มี

> **As a** Admin user, **I want** a clear empty-state when no Import Pos records match my search, **so that** I know nothing was found.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

Admin login บน TEST BU; data:reset เปิดเฉพาะ Simphony (GET /pos-sales/status enabled_brands)

**Steps**

1. อ่าน GET /pos-sales/status
2. เปิด /operation-plan/import-pos
3. ดูปุ่ม Upload file และ Upload PDF

**Expected**

ปุ่มของแบรนด์ใน enabled_brands แสดง (Upload file ของ Simphony) และปุ่มของแบรนด์ที่ไม่อยู่ในรายการไม่อยู่ใน DOM (Upload PDF ของ Micros 3700) — ตรงกับ status ของ API

---

## TC-IPOS-020001 — อัปโหลดร้านและวันเดิมซ้ำ: API 201 สถานะ rejected_duplicate และมีแถวในประวัติ

> **As a** Admin user, **I want** this Import Pos behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

Admin login บน TEST BU; มี import live ของ E2E-140 วัน 2 (สร้างทาง API ก่อนเริ่ม)

**Steps**

1. อัปโหลดไฟล์วัน 2 ครั้งแรก (API)
2. อัปโหลดไฟล์วัน 2 ซ้ำอีกชื่อหนึ่ง (API)
3. เปิด /operation-plan/import-pos แล้วดูแถวของไฟล์ที่สอง

**Expected**

ครั้งที่สองตอบ 201 พร้อม data.status = rejected_duplicate (gateway docblock: ไฟล์ซ้ำบันทึกเป็นประวัติ ไม่ตอบ error); หน้าประวัติมีแถวของไฟล์นั้น สถานะ 'Already imported for this date' ไม่มีลิงก์ SC; import แรกยัง live

---

## TC-IPOS-020002 — ไฟล์ว่าง: 400 POS_SALE_UNSUPPORTED_FILE

> **As a** Admin user, **I want** this Import Pos behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Negative

**Preconditions**

Admin login บน TEST BU

**Steps**

1. POST /pos-sales/imports/simphony ด้วยไฟล์ว่าง

**Expected**

ตอบ 400 พร้อม error.code POS_SALE_UNSUPPORTED_FILE (gateway docblock: ตอบ 400 เฉพาะไฟล์ว่างหรือไบนารี); ไม่มีแถวใหม่ในประวัติของไฟล์นั้น

---

## TC-IPOS-020003 — ไฟล์ที่ GLID วันแรก ≠ วันสุดท้าย: สถานะ multi_day_glid_reject และขึ้นในประวัติ

> **As a** Admin user, **I want** this Import Pos behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Negative

**Preconditions**

Admin login บน TEST BU

**Steps**

1. สร้างไฟล์ที่หัว GLID ระบุวันที่ต่างกัน (วัน 5 ถึงวัน 6)
2. อัปโหลด (API)
3. เปิด /operation-plan/import-pos แล้วดูแถวของไฟล์

**Expected**

ตอบ 201 data.status = multi_day_glid_reject พร้อม error_message ว่าหลายวันทำการ; แถวประวัติแสดง 'File contains more than one business day'; ไม่มี SC ของวัน 5 ถูกสร้าง

---

## TC-IPOS-020004 — Micros 3700 check ที่ส่งบรรทัดของไฟล์ Simphony: ไม่นำเข้า ตอบ rejected และบันทึกเป็น format_error

> **As a** Admin user, **I want** this Import Pos behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Low · **Test Type:** Negative

**Preconditions**

Admin login บน TEST BU

**Steps**

1. แปลงไฟล์ Simphony เป็นบรรทัดข้อความ (แยกตามช่อง |)
2. POST /pos-sales/imports/micros3700/check ด้วยบรรทัดเหล่านั้น

**Expected**

ไม่นำเข้าอะไร: ตอบ 200 data.kind = rejected, import.status = format_error ('not an MI_R001.RPT ... report'), ไม่มี SC ถูกสร้าง. หมายเหตุ: brief คาดว่าไม่ใช่ 2xx แต่ gateway docblock ของ check ระบุว่าไฟล์ที่นำเข้าไม่ได้จะถูกบันทึกเป็นการนำเข้าที่ถูกปฏิเสธและตอบ kind: rejected — พฤติกรรมตรงตามเอกสาร

---

## TC-IPOS-030001 — ยกเลิก import เดียวของวันที่ยังไม่ post: import เป็น cancelled และวันนั้นไม่มี SC

> **As a** Admin user, **I want** this Import Pos behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Happy Path

**Preconditions**

Admin login บน TEST BU; มี import live เดียวของ E2E-140 วัน 4 (สร้างทาง API) ซึ่งสร้าง SC pending ของวันนั้น

**Steps**

1. เปิด /operation-plan/import-pos
2. กด Cancel import ที่แถวของไฟล์วัน 4
3. ยืนยันในกล่องโต้ตอบ

**Expected**

POST .../cancel ตอบ 2xx และขึ้นข้อความ Import cancelled; import มี cancelled_at, ปุ่ม Cancel import หายจากแถว; scForDay(วัน 4) = null (SC pending ที่เหลือแต่บรรทัดของ import นี้ถูกลบ — feature spec §4.2)

---

## TC-IPOS-030002 — ยกเลิก import ของวันที่ SC post แล้ว: ถูกปฏิเสธ import ยัง live

> **As a** Admin user, **I want** this Import Pos behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

Admin login บน TEST BU; วัน 3 ของ E2E-140 ผูก O1 -> location ที่มีสต็อก และ I1 -> E2E-POS-A แล้ว import 1 บรรทัด verify และ post SC ทาง API; afterAll void SC แล้วยกเลิก import

**Steps**

1. import วัน 3, ผูก mapping, verify on-hand และ post SC (API)
2. เปิด /operation-plan/import-pos ดูแถวของไฟล์
3. POST .../imports/:id/cancel

**Expected**

หน้าเว็บไม่มีปุ่ม Cancel import ที่แถวนั้น; API ปฏิเสธ 400 พร้อม error.code POS_SALE_IMPORT_HAS_CONFIRMED_LINES (cancel docblock: บรรทัดถูกตัดสต็อกใน SC ที่ post แล้ว ต้อง void SC ก่อน); import ยัง live (cancelled_at ว่าง) และ SC ยัง posted

---


<sub>Last regenerated: 2026-11-23 · git 33f065b</sub>
