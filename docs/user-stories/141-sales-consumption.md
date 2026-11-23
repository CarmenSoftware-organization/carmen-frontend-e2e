# Sales Consumption — User Stories

_Generated from `tests/141-sales-consumption.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Sales Consumption
**Spec:** `tests/141-sales-consumption.spec.ts`
**Default role:** Admin
**Total test cases:** 21 (13 High / 3 Medium / 0 Low / 5 unset)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-SC-010001 | บรรทัดของ item ที่ยังไม่ผูก recipe: ปุ่ม Post ปิด และ API post ถูกปฏิเสธ SALES_CONSUMPTION_HAS_UNRESOLVED_LINES | High | Negative |
| TC-SC-010002 | บรรทัดของ outlet ที่ยังไม่มี location: ปุ่ม Post ปิด และ API post ถูกปฏิเสธ | High | Negative |
| TC-SC-010003 | ผูก I8 -> recipe และ O9 -> location ในแท็บ Mapping: Verify เปิดใช้ได้ แล้ว Post เปิดหลัง verify | High | Happy Path |
| TC-SC-010004 | ignore I9 ในแท็บ Mapping: วันถัดไปที่มี I9 ถูกข้ามเอง; บรรทัด ignored และ net qty 0 ไม่มีวัตถุดิบ | High | Functional |
| TC-SC-020001 | เปลี่ยน location ของบรรทัด O1/I1 เป็น location ที่สองบนหน้า SC: ตอน post วัตถุดิบของบรรทัดไปอยู่ Stock Out ของ location ที่สอง | High | Functional |
| TC-SC-020002 | เปลี่ยน master location ของ O1 ภายหลัง: บรรทัดที่ override คงที่ ส่วนบรรทัดที่ไม่ override เปลี่ยนตาม | High | Functional |
| TC-SC-020003 | เปลี่ยน recipe ที่บรรทัด: มีผลเฉพาะบรรทัดนั้น; ติ๊ก 'ตั้งเป็นค่าเริ่มต้น' แล้ว master เปลี่ยนและบรรทัดอื่นที่ไม่ override ตาม | High | Functional |
| TC-SC-020004 | SC ที่ post แล้วแก้บรรทัดไม่ได้: API ปฏิเสธ SALES_CONSUMPTION_NOT_PENDING และบรรทัดไม่เปลี่ยน | High | Negative |
| TC-SC-030001 | ยังไม่ verify: ปุ่ม Post ปิด และ API post ถูกปฏิเสธ SALES_CONSUMPTION_NOT_VERIFIED | High | Negative |
| TC-SC-030002 | verify: ทุกแถววัตถุดิบ OK ตาม location; แก้บรรทัดหลัง verify แล้วผลตรวจหาย post ถูกปฏิเสธจนกว่าจะ verify ใหม่ | High | Functional |
| TC-SC-040001 | post วันที่มีบรรทัดสอง location ผ่านหน้าเว็บ: Stock Out 2 ใบ (SALE, ใบละ location, วันที่ = วันขาย) ยอดตามสูตร และ on-hand ลดตามนั้น | Critical | Happy Path |
| TC-SC-040002 | สต็อก P4 ไม่พอที่ location ที่สอง: verify ขึ้นขาดเฉพาะ location นั้น, post ถูกปฏิเสธ, ไม่มี Stock Out และ on-hand ไม่เปลี่ยน | Critical | Negative |
| TC-SC-040003 | post ที่ถูกปฏิเสธเพราะสต็อกไม่พอ ต้องระบุสินค้าที่ขาดแยก location ในคำตอบ (spec §4.2) | Medium | Negative |
| TC-SC-050001 | post ซ้ำหลัง post สำเร็จ: ถูกปฏิเสธ จำนวน Stock Out และ on-hand ไม่เปลี่ยน | Critical | Negative |
| TC-SC-050002 | post พร้อมกันสองคำขอ (doc_version เดียวกัน): สำเร็จ 2xx เพียงหนึ่ง และเกิด Stock Out ชุดเดียว | Critical | Negative |
| TC-SC-060001 | void SC ที่ post แล้ว (งวดเปิด) ผ่านหน้าเว็บ: Stock Out ทุกใบถูก void, on-hand กลับเท่าก่อน post, SC เดิม voided และมี SC ใหม่ pending ของวันเดิมจำนวนบรรทัดเท่าเดิม | Critical | Happy Path |
| TC-SC-060002 | void Stock Out ของ SC ที่ post แล้วตรง ๆ: ถูกปฏิเสธ STOCK_OUT_VOID_VIA_SALES_CONSUMPTION และ Stock Out ยังใช้งานอยู่ | High | Negative |
| TC-SC-060003 | void SC ที่วันขายอยู่ในงวดคลังที่ปิดแล้ว ต้องถูกปฏิเสธ | Medium | Negative |
| TC-SC-060004 | ไฟล์ของอีกร้านเข้ามาหลังวันนั้น post แล้ว: SC ขึ้นคำเตือน late, บรรทัด late ไม่ผูก SC, void แล้ว SC ใหม่รับทั้งบรรทัดเดิมและ late | High | Functional |
| TC-SC-060005 | หน้า SC ที่ถูก void ต้องแสดง Stock Out ที่ถูก void ของมัน (voided = true) | Medium | Functional |
| TC-SC-070001 | ปฏิทินเดือนปัจจุบัน: วัน post = Posted, วันรอ post = Pending, วันที่ import แต่ยอดสุทธิ 0 = No sales, วันที่ไม่มีไฟล์ = No file และวันนี้ไม่ขึ้น No file | High | Functional |

---

## TC-SC-010001 — บรรทัดของ item ที่ยังไม่ผูก recipe: ปุ่ม Post ปิด และ API post ถูกปฏิเสธ SALES_CONSUMPTION_HAS_UNRESOLVED_LINES

> **As a** Admin user, **I want** this Sales Consumption behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

Admin login บน TEST BU; ร้าน E2E-141 วันขายที่ 1 import 2 บรรทัด O1/I1 (ผูก recipe A) และ O1/I8; master: O1 -> location แรก, I1 -> E2E-POS-A, I8 ไม่ผูก

**Steps**

1. เปิดหน้ารายละเอียด SC ของวันนั้น
2. ดูสถานะบรรทัด O1/I8 และปุ่ม Post & deduct stock
3. ยิง POST verify-onhand และ POST post ทาง API

**Expected**

บรรทัด O1/I8 state needs_recipe, ปุ่ม Post ปิด (disabled); verify และ post ถูกปฏิเสธ 422 SALES_CONSUMPTION_HAS_UNRESOLVED_LINES; ไม่มี Stock Out ถูกสร้าง SC ยัง pending

---

## TC-SC-010002 — บรรทัดของ outlet ที่ยังไม่มี location: ปุ่ม Post ปิด และ API post ถูกปฏิเสธ

> **As a** Admin user, **I want** this Sales Consumption behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

Admin login บน TEST BU; ร้าน E2E-141 วันขายที่ 1 import 2 บรรทัด O1/I1 และ O9/I1; master: O1 -> location แรก, O9 ไม่มี location, I1 -> E2E-POS-A

**Steps**

1. เปิดหน้ารายละเอียด SC ของวันนั้น
2. ดูสถานะบรรทัด O9/I1 และปุ่ม Post
3. ยิง POST post ทาง API

**Expected**

บรรทัด O9/I1 state needs_location, ปุ่ม Post ปิด; post ถูกปฏิเสธ 422 SALES_CONSUMPTION_HAS_UNRESOLVED_LINES; ไม่มี Stock Out ถูกสร้าง

---

## TC-SC-010003 — ผูก I8 -> recipe และ O9 -> location ในแท็บ Mapping: Verify เปิดใช้ได้ แล้ว Post เปิดหลัง verify

> **As a** Admin user, **I want** this Sales Consumption behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Happy Path

**Preconditions**

Admin login บน TEST BU; ร้าน E2E-141 วันขายที่ 1 import 3 บรรทัด O1/I1, O1/I8, O9/I1; master: I8 ไม่ผูก, O9 ไม่มี location (บล็อก post ทั้งสองจุด)

**Steps**

1. เปิดหน้า SC ของวันนั้น ตรวจว่า Verify และ Post ปิด
2. เปิด Sales Consumption > Mapping > POS items เลือกร้าน E2E 141 ผูก I8 -> E2E-POS-A
3. แท็บ Outlets ผูก O9 -> location แรก
4. กลับหน้า SC: ดู Verify แล้วกด Verify on-hand
5. ดูปุ่ม Post

**Expected**

ก่อนผูก Verify และ Post ปิด; หลังผูกครบทั้งสองจุดบรรทัดทุกบรรทัดเป็น ok, Verify เปิดใช้ได้ (Post ยังปิดจนกว่าจะ verify), หลังกด Verify แล้ว Post เปิดใช้ได้; ยังไม่ได้ post (ไม่มี Stock Out)

---

## TC-SC-010004 — ignore I9 ในแท็บ Mapping: วันถัดไปที่มี I9 ถูกข้ามเอง; บรรทัด ignored และ net qty 0 ไม่มีวัตถุดิบ

> **As a** Admin user, **I want** a clear empty-state when no Sales Consumption records match my search, **so that** I know nothing was found.

**Priority:** High · **Test Type:** Functional

**Preconditions**

Admin login บน TEST BU; ร้าน E2E-141 วัน 1 import O1/I1 และ O1/I9 (I9 ไม่ผูก); วัน 2 import O1/I1 qty 2, O1/I9, O1/I2 qty 3 และ O1/I2 qty -3 (คืนของ net 0)

**Steps**

1. วัน 1: ตรวจว่า O1/I9 บล็อก post
2. Mapping > POS items ร้าน E2E 141 กด Ignore ที่ I9
3. import วัน 2 แล้วเปิด SC ของวันนั้นโดยไม่ทำอะไรกับ I9
4. ดูสถานะบรรทัดและวัตถุดิบที่จะตัด; verify ผ่าน API

**Expected**

วัน 1 บรรทัด I9 บล็อก (needs_recipe); หลัง ignore บรรทัด I9 วัน 1 is_ignored และ state not_counted; วัน 2 บรรทัด I9 เป็น ignored/not_counted เอง ไม่ต้องทำอะไร, บรรทัด I2 สุทธิ <= 0 state not_counted ไม่บล็อก; วัตถุดิบมีเฉพาะ location แรก P1 = 4, P2 = 2 (จาก O1/I1 qty 2 ตาม recipe A) ไม่มี P3/P4 และไม่มีวัตถุดิบของ I9; verify ผ่าน

---

## TC-SC-020001 — เปลี่ยน location ของบรรทัด O1/I1 เป็น location ที่สองบนหน้า SC: ตอน post วัตถุดิบของบรรทัดไปอยู่ Stock Out ของ location ที่สอง

> **As a** Admin user, **I want** this Sales Consumption interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

Admin login บน TEST BU; ร้าน E2E-141 วัน 3 import O1/I1 qty 2 และ O1/I2 qty 1; master: O1 -> location แรก, I1 -> A, I2 -> B

**Steps**

1. เปิดหน้า SC แท็บ Sales lines
2. เปลี่ยน location ของบรรทัด O1/I1 เป็น location ที่สอง
3. verify แล้ว post (API)
4. อ่าน Stock Out ทั้งสองใบ

**Expected**

บรรทัด O1/I1 มี location = location ที่สอง (location_source line), O1/I2 ยังอยู่ location แรก; Stock Out 2 ใบ ชนิด SALE วันที่ = วันขาย: location ที่สองมี P1 = 4, P2 = 2 (I1 x2), location แรกมี P3 = 1, P4 = 3 (I2 x1); on-hand ลดตามยอดนี้เท่านั้น

---

## TC-SC-020002 — เปลี่ยน master location ของ O1 ภายหลัง: บรรทัดที่ override คงที่ ส่วนบรรทัดที่ไม่ override เปลี่ยนตาม

> **As a** Admin user, **I want** this Sales Consumption interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

Admin login บน TEST BU; ร้าน E2E-141 วัน 3 import O1/I1 และ O1/I2; บรรทัด O1/I1 ถูก override เป็น location ที่สอง (API) ส่วน O1/I2 ตาม master

**Steps**

1. เปลี่ยน master ของ outlet O1 เป็น location ที่สามของ BU (API)
2. อ่านรายละเอียด SC

**Expected**

บรรทัด O1/I1 ยัง location ที่สอง (override ไม่ถูกทับ); บรรทัด O1/I2 (ไม่ override) เปลี่ยนไปที่ location ที่สาม location_source master; master ของ O1 เป็นของใหม่

---

## TC-SC-020003 — เปลี่ยน recipe ที่บรรทัด: มีผลเฉพาะบรรทัดนั้น; ติ๊ก 'ตั้งเป็นค่าเริ่มต้น' แล้ว master เปลี่ยนและบรรทัดอื่นที่ไม่ override ตาม

> **As a** Admin user, **I want** this Sales Consumption interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

Admin login บน TEST BU; ร้าน E2E-141 วัน 3 import I1 สามบรรทัด O1/I1, O2/I1, O9/I1; master: O1 -> location แรก, O2 และ O9 -> location ที่สอง, I1 -> E2E-POS-A

**Steps**

1. แท็บ Sales lines: เปลี่ยน recipe ของ O1/I1 เป็น E2E-POS-B (ไม่ติ๊กค่าเริ่มต้น)
2. ตรวจบรรทัดอื่นและ master ของ I1
3. เปลี่ยน recipe ของ O2/I1 เป็น E2E-POS-B พร้อมติ๊ก Also set as item default
4. ตรวจ master ของ I1 และบรรทัด O9/I1

**Expected**

หลังข้อ 1: O1/I1 recipe B (recipe_source line), O2/I1 และ O9/I1 ยัง A, master I1 ยัง E2E-POS-A; หลังข้อ 3: master I1 = E2E-POS-B และ O9/I1 (ไม่ override) เปลี่ยนเป็น B ตาม master

---

## TC-SC-020004 — SC ที่ post แล้วแก้บรรทัดไม่ได้: API ปฏิเสธ SALES_CONSUMPTION_NOT_PENDING และบรรทัดไม่เปลี่ยน

> **As a** Admin user, **I want** this Sales Consumption behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

Admin login บน TEST BU; ร้าน E2E-141 วัน 3 import O1/I1 และ post แล้ว (verify + post ทาง API); afterAll void SC

**Steps**

1. PATCH sales-consumptions/:id/lines เปลี่ยน location ของบรรทัด O1/I1 เป็น location ที่สอง
2. PATCH เปลี่ยน recipe ของบรรทัดเดียวกัน
3. อ่านรายละเอียด SC

**Expected**

ทั้งสองคำขอถูกปฏิเสธ 409 SALES_CONSUMPTION_NOT_PENDING (brief เดาว่า SALES_CONSUMPTION_LINE_POSTED — BE จริงตอบ NOT_PENDING ซึ่งตรงกับ spec §4.2: posted แก้ไม่ได้ ต้อง void ก่อน); SC ยัง posted บรรทัด O1/I1 ยัง location แรก recipe A; Stock Out ยังชุดเดิม

---

## TC-SC-030001 — ยังไม่ verify: ปุ่ม Post ปิด และ API post ถูกปฏิเสธ SALES_CONSUMPTION_NOT_VERIFIED

> **As a** Admin user, **I want** this Sales Consumption behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

Admin login บน TEST BU; ร้าน E2E-141 วัน 4 import O1/I1 qty 2 ผูกครบ (ไม่มีบรรทัดค้าง) แต่ยังไม่กด Verify

**Steps**

1. เปิดหน้า SC ดูปุ่ม Verify และ Post
2. ยิง POST post ทาง API ตรง ๆ

**Expected**

Verify เปิดใช้ได้ แต่ Post ปิด; post ถูกปฏิเสธ 422 SALES_CONSUMPTION_NOT_VERIFIED; ไม่มี Stock Out; SC ยัง pending

---

## TC-SC-030002 — verify: ทุกแถววัตถุดิบ OK ตาม location; แก้บรรทัดหลัง verify แล้วผลตรวจหาย post ถูกปฏิเสธจนกว่าจะ verify ใหม่

> **As a** Admin user, **I want** this Sales Consumption interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

Admin login บน TEST BU; ร้าน E2E-141 วัน 4 import O1/I1 qty 2 และ O2/I2 qty 1 ผูกครบ

**Steps**

1. เปิดหน้า SC กด Verify on-hand
2. ดูแถววัตถุดิบแต่ละ location
3. แก้ location ของบรรทัด O1/I1 เป็น location ที่สอง (API)
4. ยิง post ด้วย doc_version ใหม่ (ผลตรวจหายไปแล้ว)
5. verify ใหม่แล้ว post

**Expected**

หลัง verify: location แรกมี P1, P2 ขึ้น Yes และ location ที่สองมี P3, P4 ขึ้น Yes, Post เปิด; หลังแก้บรรทัดผล verify หาย (verification = null) Post ปิด, post ถูกปฏิเสธ 422 SALES_CONSUMPTION_NOT_VERIFIED (brief เดาว่า VERIFY_STALE — BE จริงล้างผลตรวจตอนแก้บรรทัด ตรงกับ spec §4.2/§6 (แก้บรรทัดแล้วผลตรวจหาย) จึงเป็นรหัสนี้); verify ใหม่แล้ว post ผ่านและมี Stock Out 2 ใบตามกลุ่มใหม่ (location ที่สอง P1, P2, P3, P4 = 4, 2, 1, 3; location แรกไม่มีใบ)

---

## TC-SC-040001 — post วันที่มีบรรทัดสอง location ผ่านหน้าเว็บ: Stock Out 2 ใบ (SALE, ใบละ location, วันที่ = วันขาย) ยอดตามสูตร และ on-hand ลดตามนั้น

> **As a** Admin user, **I want** this Sales Consumption behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Critical · **Test Type:** Happy Path

**Preconditions**

Admin login บน TEST BU; ร้าน E2E-141 วัน 5 import O1/I1 x2, O1/I2 x3, O2/I1 x4, O2/I2 x1; master: O1 -> location แรก, O2 -> location ที่สอง, I1 -> A (P1 x2, P2 x1), I2 -> B (P3 x1, P4 x3); อ่าน on-hand P1-P4 ทั้งสอง location ณ วันขายก่อนเริ่ม

**Steps**

1. เปิดหน้า SC กด Verify on-hand
2. กด Post & deduct stock
3. อ่าน Stock Out ที่ SC สร้าง
4. อ่าน on-hand P1-P4 ทั้งสอง location ใหม่

**Expected**

SC posted; Stock Out ตรง 2 ใบ ชนิด SALE ใบละ location ลงวันที่ = วันขาย; location แรก: P1 = 4, P2 = 2, P3 = 3, P4 = 9; location ที่สอง: P1 = 8, P2 = 4, P3 = 1, P4 = 3; on-hand ของแต่ละสินค้าแต่ละ location ลดลงเท่ายอดนี้พอดี (ผลต่างของค่าจริง ไม่ใช่ค่าสัมบูรณ์)

---

## TC-SC-040002 — สต็อก P4 ไม่พอที่ location ที่สอง: verify ขึ้นขาดเฉพาะ location นั้น, post ถูกปฏิเสธ, ไม่มี Stock Out และ on-hand ไม่เปลี่ยน

> **As a** Admin user, **I want** this Sales Consumption behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Critical · **Test Type:** Negative

**Preconditions**

Admin login บน TEST BU; ร้าน E2E-141 วัน 5 import O1/I1 x1 และ O2/I2 x N โดย N = ceil((on-hand P4 ที่ location ที่สอง ณ วันขาย + 1) / 3) (P4 ต้องใช้ 3 ต่อหน่วย จึงขาด 1 หน่วยพอดีขึ้นไป); location แรกพอ

**Steps**

1. อ่าน on-hand ก่อน
2. เปิดหน้า SC กด Verify on-hand (UI)
3. ยิง post ทาง API
4. อ่าน Stock Out ของ SC และ on-hand ใหม่

**Expected**

verify: ที่ location ที่สองแถว P4 ขึ้น Short (ที่เหลือ Yes), location แรกทุกแถว Yes; verify (API) รายงานสินค้าที่ขาดแยก location มีเฉพาะ P4 ที่ location ที่สอง; post ถูกปฏิเสธ 422 SALES_CONSUMPTION_VERIFY_FAILED (spec §4.2: ขาดแม้ location เดียว = ไม่มีใบไหนออก; การที่คำตอบของ post ไม่ระบุสินค้าที่ขาดแยก location แยกเป็น TC-SC-040003); ไม่มี Stock Out สำหรับ SC นี้ SC ยัง pending; on-hand P1-P4 ทั้งสอง location เท่าเดิม

---

## TC-SC-040003 — post ที่ถูกปฏิเสธเพราะสต็อกไม่พอ ต้องระบุสินค้าที่ขาดแยก location ในคำตอบ (spec §4.2)

> **As a** Admin user, **I want** this Sales Consumption behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Negative

**Preconditions**

Admin login บน TEST BU; ร้าน E2E-141 วัน 7 import O1/I1 x1 และ O2/I2 x N โดย N = ceil((on-hand P4 ที่ location ที่สอง ณ วันขาย + 1) / 3); verify แล้วขึ้นขาด (API)

**Steps**

1. verify (API) ได้ผลขาด P4 ที่ location ที่สอง
2. ยิง POST post ทาง API
3. อ่านเนื้อหาคำตอบ

**Expected**

post ถูกปฏิเสธ 422 SALES_CONSUMPTION_VERIFY_FAILED และเนื้อหาคำตอบระบุ P4 ที่ location ที่สอง (feature spec §4.2: ขาดแม้ location เดียว = ไม่มีใบไหนออก คืนรายการสินค้าที่ขาดแยก location). BE จริงตอบเฉพาะข้อความ ไม่ระบุสินค้า จึง pin เป็น suspected bug (test.fail)

---

## TC-SC-050001 — post ซ้ำหลัง post สำเร็จ: ถูกปฏิเสธ จำนวน Stock Out และ on-hand ไม่เปลี่ยน

> **As a** Admin user, **I want** this Sales Consumption behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Critical · **Test Type:** Negative

**Preconditions**

Admin login บน TEST BU; ร้าน E2E-141 วัน 6 import O1/I1 x2 และ O2/I2 x1 แล้ว verify + post สำเร็จ (Stock Out 2 ใบ)

**Steps**

1. ยิง POST post ซ้ำด้วย doc_version เดิม
2. อ่าน Stock Out ของ SC และ on-hand

**Expected**

ครั้งที่สองถูกปฏิเสธ 409 SALES_CONSUMPTION_NOT_PENDING; SC ยังมี Stock Out ชุดเดิม 2 ใบ (id เดิม) ไม่มีชุดที่สอง; on-hand ลดเท่ายอดของ post แรกครั้งเดียว

---

## TC-SC-050002 — post พร้อมกันสองคำขอ (doc_version เดียวกัน): สำเร็จ 2xx เพียงหนึ่ง และเกิด Stock Out ชุดเดียว

> **As a** Admin user, **I want** this Sales Consumption behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Critical · **Test Type:** Negative

**Preconditions**

Admin login บน TEST BU; ร้าน E2E-141 วัน 6 import O1/I1 x2 และ O2/I2 x1 แล้ว verify ผ่าน (ยังไม่ post)

**Steps**

1. ยิง POST post สองคำขอพร้อมกัน (Promise.all) ด้วย doc_version เดียวกัน
2. อ่าน Stock Out ของ SC และ on-hand

**Expected**

ตอบ 2xx เพียงหนึ่งคำขอ อีกคำขอถูกปฏิเสธ 4xx (ไม่ใช่ 5xx); SC posted; Stock Out ที่ไม่ void ตรง 2 ใบ (หนึ่งใบต่อ location) ไม่มีชุดที่สอง; on-hand ลดเท่ายอดของ post ครั้งเดียว

---

## TC-SC-060001 — void SC ที่ post แล้ว (งวดเปิด) ผ่านหน้าเว็บ: Stock Out ทุกใบถูก void, on-hand กลับเท่าก่อน post, SC เดิม voided และมี SC ใหม่ pending ของวันเดิมจำนวนบรรทัดเท่าเดิม

> **As a** Admin user, **I want** this Sales Consumption behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Critical · **Test Type:** Happy Path

**Preconditions**

Admin login บน TEST BU; ร้าน E2E-141 วัน 11 import O1/I1 x2 และ O2/I2 x1 ผูกครบ; อ่าน on-hand P1-P4 ทั้งสอง location ณ วันขายก่อน post; verify แล้ว post (Stock Out 2 ใบ)

**Steps**

1. เปิดหน้า SC ที่ posted กด Void ใส่เหตุผลแล้วยืนยัน
2. อ่าน SC เดิม, Stock Out ของมัน และ SC ของวันนั้น
3. อ่าน on-hand P1-P4 ทั้งสอง location ใหม่

**Expected**

ขึ้นข้อความ Voided พร้อมเลข SC ใหม่; SC เดิมสถานะ voided และ Stock Out ทั้ง 2 ใบถูก void (ไม่เหลือใบที่ใช้งานอยู่ และ GET /stock-outs/:id ของแต่ละใบตอบ 404 เพราะ void = soft delete); on-hand ทุกสินค้าทุก location เท่าค่าก่อน post (ผลต่าง 0); SC ของวันเดียวกันที่ไม่ voided มีใบเดียว คนละ id กับใบเดิม สถานะ pending มี 2 บรรทัด (O1/I1 และ O2/I2) และไม่มี Stock Out

---

## TC-SC-060002 — void Stock Out ของ SC ที่ post แล้วตรง ๆ: ถูกปฏิเสธ STOCK_OUT_VOID_VIA_SALES_CONSUMPTION และ Stock Out ยังใช้งานอยู่

> **As a** Admin user, **I want** this Sales Consumption behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

Admin login บน TEST BU; ร้าน E2E-141 วัน 12 import O1/I1 x2 ผูกครบ แล้ว verify + post; อ่าน on-hand ก่อนเริ่ม

**Steps**

1. อ่านรายการ Stock Out ที่ SC สร้าง
2. ยิง DELETE /stock-outs/:id/void กับ Stock Out นั้นตรง ๆ
3. อ่าน SC, Stock Out และ on-hand ใหม่

**Expected**

ถูกปฏิเสธ 409 STOCK_OUT_VOID_VIA_SALES_CONSUMPTION (feature spec §4.2: void Stock Out ที่มาจาก SC ต้องทำที่ SC); SC ยัง posted, Stock Out ยังไม่ voided รายการเดิม, on-hand ยังลดตามสูตรเท่าเดิม

---

## TC-SC-060003 — void SC ที่วันขายอยู่ในงวดคลังที่ปิดแล้ว ต้องถูกปฏิเสธ

> **As a** Admin user, **I want** this Sales Consumption behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Negative

**Preconditions**

SC ที่ posted แล้วในงวดคลังที่ถูกปิด; e2e ไม่เคยปิดงวด (data:reset ได้งวดเปิดเท่านั้น) จึงสร้างเงื่อนไขนี้ไม่ได้

**Steps**

1. ปิดงวดคลังของวันขาย
2. void SC ของวันนั้น

**Expected**

void ถูกปฏิเสธด้วย SALES_CONSUMPTION_VOID_PERIOD_CLOSED (feature spec §4.2) และไม่มี Stock Out ถูก void

---

## TC-SC-060004 — ไฟล์ของอีกร้านเข้ามาหลังวันนั้น post แล้ว: SC ขึ้นคำเตือน late, บรรทัด late ไม่ผูก SC, void แล้ว SC ใหม่รับทั้งบรรทัดเดิมและ late

> **As a** Admin user, **I want** this Sales Consumption interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

Admin login บน TEST BU; ร้าน E2E-141 วัน 13 import O1/I1 x2 ผูกครบ verify + post แล้ว; อ่าน on-hand P1-P4 ณ วันขายก่อนเริ่ม; ร้านที่สอง E2E-141B (ไม่ผูก master)

**Steps**

1. import ไฟล์ของร้าน E2E-141B วัน 13 (O1/I2 x2) หลังวันนั้น post แล้ว
2. เปิดหน้า SC ที่ posted และอ่านรายละเอียด/ปฏิทินของวัน
3. void SC ผ่าน API
4. อ่าน SC ใหม่ของวัน และ on-hand

**Expected**

หน้า SC ขึ้นคำเตือน 'sale line arrived after this was posted' และ late_lines = 1 (ตรงกับปฏิทิน); SC ที่ posted ยังมีแค่ 1 บรรทัดเดิม (บรรทัด late ไม่มี SC id) และ Stock Out ชุดเดิมไม่เปลี่ยน; หลัง void SC เดิม voided, on-hand กลับเท่าก่อน post, มี SC ใหม่ pending ใบเดียวที่มี 2 บรรทัด (เดิม + late) และไม่ขึ้น late อีก

---

## TC-SC-060005 — หน้า SC ที่ถูก void ต้องแสดง Stock Out ที่ถูก void ของมัน (voided = true)

> **As a** Admin user, **I want** this Sales Consumption interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

Admin login บน TEST BU; ร้าน E2E-141 วัน 12 import O1/I1 x2 ผูกครบ verify + post (Stock Out 1 ใบ) แล้ว void SC ผ่าน API

**Steps**

1. void SC ที่ posted (API)
2. อ่านรายละเอียดของ SC เดิมที่ voided

**Expected**

stock_outs ของ SC ที่ voided ยังรายการ Stock Out ใบเดิมพร้อม voided = true (feature spec §4.2: หน้า SC ที่ voided แสดงข้อมูลจาก Stock Out ที่ออกจริง; โค้ด BE และป้าย 'voided' ใน FE เตรียมไว้). BE จริงตอบ stock_outs ว่าง จึง pin เป็น suspected bug (test.fail)

---

## TC-SC-070001 — ปฏิทินเดือนปัจจุบัน: วัน post = Posted, วันรอ post = Pending, วันที่ import แต่ยอดสุทธิ 0 = No sales, วันที่ไม่มีไฟล์ = No file และวันนี้ไม่ขึ้น No file

> **As a** Admin user, **I want** a clear empty-state when no Sales Consumption records match my search, **so that** I know nothing was found.

**Priority:** High · **Test Type:** Functional

**Preconditions**

Admin login บน TEST BU; ร้าน E2E-141: วัน 14 import + post, วัน 15 import (ผูกครบ ยังไม่ post), วันที่หนึ่งใน pastDays import เฉพาะรายการยอดสุทธิ 0 (ตั้งต้นปฏิทินของ BU); อีกสองวันใน pastDays ไม่มีไฟล์; ต้องมีวันในอดีตก่อนเมื่อวาน 3 วันที่ไม่ชนวันของสเปกอื่น

**Steps**

1. เปิด Sales Consumption > Calendar เดือนปัจจุบัน
2. อ่านข้อความสถานะของแต่ละวันที่กล่าวมา และของวันนี้
3. เทียบกับ GET calendar

**Expected**

วัน 14 ขึ้น Posted, วัน 15 ขึ้น Pending, วัน net-0 ขึ้น No sales, สองวันที่ไม่มี import (อยู่หลังวัน import แรกของ BU ก่อนวันนี้) ขึ้น No file, วันนี้ไม่ขึ้น No file (API = future); ค่าจาก API calendar ตรงกับหน้า (posted / pending / no_sales / no_file / future)

---


<sub>Last regenerated: 2026-11-23 · git c5d832e</sub>
