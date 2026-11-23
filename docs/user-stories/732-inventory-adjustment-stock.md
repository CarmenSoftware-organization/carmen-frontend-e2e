# Inventory Adjustment — Stock and Cost — User Stories

_Generated from `tests/732-inventory-adjustment-stock.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Inventory Adjustment — Stock and Cost
**Spec:** `tests/732-inventory-adjustment-stock.spec.ts`
**Default role:** Admin
**Total test cases:** 19 (8 High / 1 Medium / 0 Low / 10 unset)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-IADJ-800001 | FC Commit Stock In จากหน้าจอแล้วสต๊อกและมูลค่าเพิ่มตามที่ลง และใบอ่านอย่างเดียว | Critical | Functional |
| TC-IADJ-800002 | FC Stock In ลงวันที่ก่อนงวดเปิดแรกสุดถูกปฏิเสธและไม่มีอะไรถูก commit | High | Negative |
| TC-IADJ-800003 | FC Commit Stock In ซ้ำหลังสำเร็จแล้วถูกปฏิเสธและลงสต๊อกครั้งเดียว | Critical | Negative |
| TC-IADJ-800004 | FC Commit Stock In พร้อมกัน 2 คำขอลงสต๊อกครั้งเดียว (มี/ไม่มี doc_version) | Critical | Concurrency |
| TC-IADJ-800005 | FC Void Stock In ที่สต๊อกยังไม่ถูกแตะแล้ว on-hand และมูลค่ากลับเท่าก่อน commit | Critical | Functional |
| TC-IADJ-800006 | FC Void Stock In ที่ถูกจ่ายออกไปบางส่วนแล้วถูกปฏิเสธและสต๊อกไม่เปลี่ยน | Critical | Negative |
| TC-IADJ-800007 | FC Commit Stock In จำนวนติดลบต้องถูกปฏิเสธ | High | Negative |
| TC-IADJ-800008 | FC Commit Stock In ต้นทุนติดลบต้องถูกปฏิเสธ | High | Negative |
| TC-IADJ-800009 | FC Commit Stock In บรรทัดจำนวน 0 ต้องถูกปฏิเสธ | High | Negative |
| TC-IADJ-800010 | FC Stock In ลงวันแรกของงวดถัดไปที่สร้างล่วงหน้า (AVG: completed แต่ยังไม่ลงสต๊อก) | Medium | Functional |
| TC-IADJ-810001 | FC Commit Stock Out จากหน้าจอแล้ว on-hand ลดและมูลค่าลดตามต้นทุนที่วิธีคิดต้นทุนกำหนด | Critical | Functional |
| TC-IADJ-810002 | FC Commit Stock Out เกิน on-hand ถูกปฏิเสธ สต๊อกไม่เปลี่ยนและใบยังเป็น draft | Critical | Negative |
| TC-IADJ-810003 | FC Stock Out 2 บรรทัดสินค้าเดียวกันที่รวมกันเกิน on-hand ถูกปฏิเสธทั้งใบ | Critical | Negative |
| TC-IADJ-810004 | FC Stock Out ลงวันที่นอกงวดปัจจุบันถูกปฏิเสธและสต๊อกไม่เปลี่ยน | High | Negative |
| TC-IADJ-810005 | FC Commit Stock Out ซ้ำ (ต่อเนื่องและพร้อมกัน) ตัดสต๊อกครั้งเดียว | Critical | Concurrency |
| TC-IADJ-810006 | FC Void Stock Out ที่ commit แล้วคืนจำนวนและมูลค่ากลับเท่าก่อน commit | Critical | Functional |
| TC-IADJ-810007 | FC Stock Out ที่ completed แล้วแก้/ลบไม่ได้ และ void ซ้ำถูกปฏิเสธ | High | Negative |
| TC-IADJ-820001 | FC Stock In ที่ void แล้วยังต้องเห็นได้ในระบบ (อ่านได้ สถานะ voided อยู่ในตัวกรอง Voided) | High | Functional |
| TC-IADJ-820002 | FC Stock Out ที่ void แล้วยังต้องเห็นได้ในระบบ (อ่านได้ สถานะ voided อยู่ในตัวกรอง Voided) | High | Functional |

---

## TC-IADJ-800001 — FC Commit Stock In จากหน้าจอแล้วสต๊อกและมูลค่าเพิ่มตามที่ลง และใบอ่านอย่างเดียว

> **As a** FC user, **I want** this Inventory Adjustment — Stock and Cost interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Critical · **Test Type:** Functional

**Preconditions**

Login เป็น Admin; BU TEST; E2E-IA-A ผูกคลังเดียว; เหตุผล E2E-IA-IN; มีงวดเปิดครอบคลุมวันนี้; อ่านสต๊อก (on-hand และมูลค่า) ของ E2E-IA-A ก่อนกด Commit

**Steps**

1. เปิดหน้าสร้าง Stock In
2. Date = วันนี้, Reason E2E IA stock in, Location ของ E2E-IA-A
3. Add Item: E2E-IA-A จำนวน 10 ต้นทุน 12.50
4. ใส่คำอธิบาย E2E-IA 732 UI commit <uid>
5. กด Commit แล้วยืนยัน
6. อ่านสต๊อกและ stock-movements ของใบจาก API
7. เปิดใบนั้นอีกครั้งในหน้าจอ

**Expected**

ใบเป็น completed; on-hand เพิ่ม 10 และมูลค่าเพิ่ม 125.00; stock-movements มี 1 บรรทัดต้นทุน 12.50; เปิดใบซ้ำแล้วไม่มีปุ่ม Save และ Commit

> _Note: เทียบส่วนต่างของสต๊อกที่อ่านสดก่อน/หลัง ไม่ยึดค่าสัมบูรณ์ · มูลค่า = ผลรวม balance_qty × cost_per_unit ของ cost_layers (inventory-info ไม่มีมูลค่ารวม)_

---

## TC-IADJ-800002 — FC Stock In ลงวันที่ก่อนงวดเปิดแรกสุดถูกปฏิเสธและไม่มีอะไรถูก commit

> **As a** FC user, **I want** this Inventory Adjustment — Stock and Cost behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

Login เป็น Admin; BU TEST; อ่านรายการงวดจาก GET /inventory-periods แล้วหางวด open ที่เริ่มเร็วสุด; อ่านสต๊อก E2E-IA-A ก่อน

**Steps**

1. หาวันก่อนวันเริ่มของงวดเปิดแรกสุด 1 วัน
2. POST /stock-ins ลงวันนั้น (E2E-IA-A × 1 ต้นทุน 5)
3. ถ้าสร้างได้ PATCH commit

**Expected**

ขั้นสร้างหรือขั้น commit ตอบ 4xx ด้วย STOCK_IN_DATE_OUTSIDE_OPEN_PERIOD; ไม่มีใบ completed; on-hand ของ E2E-IA-A ไม่เปลี่ยน

> _Note: เส้นทาง API เท่านั้น (ฟอร์มไม่ให้เลือกวันนอกงวด) · ไม่รู้งวดเปิด = เคสล้มพร้อมเหตุผล ไม่ข้าม_

---

## TC-IADJ-800003 — FC Commit Stock In ซ้ำหลังสำเร็จแล้วถูกปฏิเสธและลงสต๊อกครั้งเดียว

> **As a** FC user, **I want** this Inventory Adjustment — Stock and Cost behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Critical · **Test Type:** Negative

**Preconditions**

Login เป็น Admin; BU TEST; สร้าง Stock In draft E2E-IA-A × 4 ต้นทุน 7 ทาง API; อ่านสต๊อกก่อน

**Steps**

1. PATCH commit ครั้งแรก
2. PATCH commit ซ้ำทันที (ส่ง doc_version ปัจจุบัน)
3. อ่านสต๊อกและ stock-movements

**Expected**

ครั้งแรกสำเร็จ; ครั้งสองตอบ 4xx STOCK_IN_ONLY_DRAFT_COMMITTABLE; จำนวน movement = จำนวนบรรทัด (1); on-hand เพิ่ม 4 ครั้งเดียว

> _Note: กันกดซ้ำแบบต่อเนื่อง (sequential)_

---

## TC-IADJ-800004 — FC Commit Stock In พร้อมกัน 2 คำขอลงสต๊อกครั้งเดียว (มี/ไม่มี doc_version)

> **As a** FC user, **I want** this Inventory Adjustment — Stock and Cost behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Critical · **Test Type:** Concurrency

**Preconditions**

Login เป็น Admin; BU TEST; สร้าง Stock In draft 2 ใบ (E2E-IA-A × 3 ต้นทุน 6) ทาง API; อ่านสต๊อกก่อนแต่ละใบ

**Steps**

(a) ใบที่ 1: ยิง PATCH commit 2 คำขอพร้อมกัน (Promise.all) ด้วย doc_version เดียวกัน
(b) ใบที่ 2: ยิง PATCH commit 2 คำขอพร้อมกันโดยไม่ส่ง doc_version แล้วค่อย commit ให้ถูกต้องอีกครั้ง
อ่านสต๊อกและ stock-movements หลังแต่ละขั้น

**Expected**

(a) ลงสต๊อกครั้งเดียว: on-hand เพิ่ม 3 และ movement = 1 บรรทัด
(b) คำขอที่ไม่มี doc_version ถูกปฏิเสธ 4xx ทั้งคู่ ไม่มี movement และ on-hand ไม่เปลี่ยน; commit ที่ถูกต้องหลังจากนั้นลงครั้งเดียว

> _Note: ผลตัดสิน R6: DTO ของ commit บังคับ doc_version เป็นจำนวนเต็ม จึงทดสอบ (b) เป็น 'ไม่มี doc_version ต้องไม่ลงอะไร'. ถ้า (b) ลงซ้ำ = บั๊ก (เช็คสถานะอยู่นอก transaction, stock-in.service.ts:706-710)_

---

## TC-IADJ-800005 — FC Void Stock In ที่สต๊อกยังไม่ถูกแตะแล้ว on-hand และมูลค่ากลับเท่าก่อน commit

> **As a** FC user, **I want** this Inventory Adjustment — Stock and Cost interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Critical · **Test Type:** Functional

**Preconditions**

Login เป็น Admin; BU TEST; อ่านสต๊อก (on-hand และมูลค่า) ของ E2E-IA-B ก่อน commit

**Steps**

1. สร้าง Stock In E2E-IA-B × 5 ต้นทุน 9 ทาง API แล้ว commit
2. อ่านสต๊อก
3. Void ใบ (void_reason + doc_version ปัจจุบัน)
4. อ่านสต๊อก

**Expected**

หลัง commit on-hand +5 มูลค่า +45.00; หลัง void ส่วนต่างเทียบก่อน commit เป็น 0 ทั้งจำนวนและมูลค่า

> _Note: การที่ใบที่ void แล้วหายจากรายการ (soft-delete) อยู่ในกลุ่ม 82_

---

## TC-IADJ-800006 — FC Void Stock In ที่ถูกจ่ายออกไปบางส่วนแล้วถูกปฏิเสธและสต๊อกไม่เปลี่ยน

> **As a** FC user, **I want** this Inventory Adjustment — Stock and Cost behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Critical · **Test Type:** Negative

**Preconditions**

Login เป็น Admin; BU TEST; เหตุผล E2E-IA-OUT; จำนวน Stock Out = 4 (มากกว่านี้ถ้า E2E-IA-B มีสต๊อกเดิมอยู่ เพื่อให้ยอดต่ำสุดหลังจ่ายต่ำกว่าที่ลงไว้)

**Steps**

1. Stock In E2E-IA-B × 10 วันนี้ commit
2. Stock Out E2E-IA-B × 4 วันนี้ commit
3. อ่านสต๊อก
4. Void Stock In
5. อ่านสต๊อก

**Expected**

void ตอบ 4xx STOCK_IN_VOID_INSUFFICIENT_STOCK; ใบ Stock In ยัง completed; on-hand ไม่เปลี่ยนจากก่อน void

> _Note: เช็คจากยอดคงเหลือต่ำสุดที่จ่ายได้ตั้งแต่ si_date เป็นต้นไป ไม่ใช่ on-hand ปัจจุบัน (stock-in.service.ts:1795-1817); cleanup void Stock Out ก่อน Stock In_

---

## TC-IADJ-800007 — FC Commit Stock In จำนวนติดลบต้องถูกปฏิเสธ

> **As a** FC user, **I want** this Inventory Adjustment — Stock and Cost behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

Login เป็น Admin; BU TEST; อ่านสต๊อก E2E-IA-A ก่อน

**Steps**

1. สร้าง Stock In draft ทาง API: E2E-IA-A × -1 ต้นทุน 5
2. PATCH commit

**Expected**

ถูกปฏิเสธ 4xx (สร้างไม่ได้ หรือ commit ไม่ผ่าน) และ on-hand ไม่เปลี่ยน

> _Note: ผู้ใช้ตัดสิน 23 พ.ย.: รับ qty ติดลบ = บั๊ก (DTO ไม่มี @Min/@IsPositive) — ปักหมุด test.fail_

---

## TC-IADJ-800008 — FC Commit Stock In ต้นทุนติดลบต้องถูกปฏิเสธ

> **As a** FC user, **I want** this Inventory Adjustment — Stock and Cost behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

Login เป็น Admin; BU TEST; อ่านสต๊อก E2E-IA-A ก่อน

**Steps**

1. สร้าง Stock In draft ทาง API: E2E-IA-A × 2 ต้นทุน -5
2. PATCH commit

**Expected**

ถูกปฏิเสธ 4xx และ on-hand ไม่เปลี่ยน

> _Note: ผู้ใช้ตัดสิน 23 พ.ย.: รับต้นทุนติดลบ = บั๊ก — ปักหมุด test.fail_

---

## TC-IADJ-800009 — FC Commit Stock In บรรทัดจำนวน 0 ต้องถูกปฏิเสธ

> **As a** FC user, **I want** this Inventory Adjustment — Stock and Cost behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

Login เป็น Admin; BU TEST; อ่านสต๊อก E2E-IA-A ก่อน

**Steps**

1. สร้าง Stock In draft ทาง API: E2E-IA-A × 0 ต้นทุน 5
2. PATCH commit

**Expected**

ถูกปฏิเสธ 4xx และไม่มี movement; on-hand ไม่เปลี่ยน

> _Note: ฟอร์มให้แถวใหม่เริ่มที่ 0 จึงไม่ขึ้น error แต่ commit ต้องไม่รับ · ผู้ใช้ตัดสิน 23 พ.ย.: รับ = บั๊ก — ปักหมุด test.fail_

---

## TC-IADJ-800010 — FC Stock In ลงวันแรกของงวดถัดไปที่สร้างล่วงหน้า (AVG: completed แต่ยังไม่ลงสต๊อก)

> **As a** FC user, **I want** this Inventory Adjustment — Stock and Cost interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

Login เป็น Admin; BU TEST; อ่านวิธีคิดต้นทุนของ BU จาก calculation-method; มีงวด open ที่เริ่มหลังงวดปัจจุบัน (สร้างล่วงหน้า) ใน GET /inventory-periods

**Steps**

1. หางวดที่เริ่มหลังงวดปัจจุบัน; ไม่พบ = ล้มพร้อมเหตุผล
2. อ่านสต๊อก E2E-IA-A ที่วันแรกของงวดนั้นและวันนี้
3. สร้าง Stock In E2E-IA-A × 2 ต้นทุน 11 ลงวันแรกของงวดนั้น แล้ว commit
4. อ่านสต๊อกอีกครั้ง

**Expected**

AVG: ใบ completed และ on-hand ที่วันนั้นและวันนี้ไม่เปลี่ยน (รอ bring-forward); FIFO: commit ลง movement จริง

> _Note: TEST BU ใช้วิธี average (อ่านสด) · เส้นทาง API เท่านั้น (ฟอร์มไม่ให้ลงวันอนาคต) · งวดที่สองต้องสร้างเตรียมไว้เอง — เคสนี้ไม่ปิดงวดและไม่สร้างงวด_

---

## TC-IADJ-810001 — FC Commit Stock Out จากหน้าจอแล้ว on-hand ลดและมูลค่าลดตามต้นทุนที่วิธีคิดต้นทุนกำหนด

> **As a** FC user, **I want** this Inventory Adjustment — Stock and Cost interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Critical · **Test Type:** Functional

**Preconditions**

Login เป็น Admin; BU TEST; เหตุผล E2E-IA-OUT; ลง Stock In E2E-IA-B 2 ชั้น (10 @ 10.00 แล้ว 10 @ 20.00) ทาง API; อ่านชั้นต้นทุน วิธีคิดต้นทุน และสต๊อก (on-hand, มูลค่า) สดก่อนกด Commit

**Steps**

1. เปิดหน้าสร้าง Stock Out
2. Date = วันนี้, Reason E2E IA stock out, Location ของ E2E-IA-B
3. Add Item: E2E-IA-B จำนวน 15
4. อ่านยอด Grand Total ของฟอร์ม (ต้นทุนประเมิน)
5. กด Commit แล้วยืนยัน
6. อ่านสต๊อกและ stock-movements ของใบจาก API

**Expected**

ยอด Grand Total ก่อน Commit = ต้นทุนที่คำนวณจากชั้นสด (±0.01); ใบเป็น completed; on-hand ลด 15; ต้นทุนใน movement = ต้นทุนที่คำนวณ; มูลค่าลดเท่ากับต้นทุนนั้น

> _Note: ค่าคาดหวังมาจาก expectedIssueCost(ชั้นต้นทุนสด, 15, วิธีคิดต้นทุนของ BU) ไม่ใช่ตัวเลขตายตัว · ส่วนต่างของค่าที่อ่านสดก่อน/หลัง_

---

## TC-IADJ-810002 — FC Commit Stock Out เกิน on-hand ถูกปฏิเสธ สต๊อกไม่เปลี่ยนและใบยังเป็น draft

> **As a** FC user, **I want** this Inventory Adjustment — Stock and Cost behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Critical · **Test Type:** Negative

**Preconditions**

Login เป็น Admin; BU TEST; ลง Stock In E2E-IA-B 2 ชั้นทาง API; อ่าน on-hand สดของ E2E-IA-B

**Steps**

1. API: สร้าง Stock Out E2E-IA-B จำนวน on-hand + 1 (หลังบ้านอาจปฏิเสธตั้งแต่สร้าง draft หรือตอน commit) แล้ว PATCH commit ถ้าสร้างได้
2. อ่านสต๊อกและสถานะใบ
3. หน้าจอ: สร้าง Stock Out จำนวน on-hand + 1 กด Commit แล้วยืนยัน

**Expected**

API: 4xx STOCK_OUT_INSUFFICIENT_STOCK และข้อความระบุ E2E-IA-B; on-hand ไม่เปลี่ยน; ถ้าสร้างใบได้ ใบยัง draft. หน้าจอ: แสดง error และยังอยู่ที่หน้าฟอร์มสร้าง

> _Note: ส่วนต่างสดก่อน/หลัง ไม่ใช้ค่าสัมบูรณ์_

---

## TC-IADJ-810003 — FC Stock Out 2 บรรทัดสินค้าเดียวกันที่รวมกันเกิน on-hand ถูกปฏิเสธทั้งใบ

> **As a** FC user, **I want** this Inventory Adjustment — Stock and Cost behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Critical · **Test Type:** Negative

**Preconditions**

Login เป็น Admin; BU TEST; ลง Stock In E2E-IA-B 2 ชั้นทาง API; อ่าน on-hand สด

**Steps**

1. สร้าง Stock Out draft ทาง API 2 บรรทัดของ E2E-IA-B บรรทัดละ ceil(on-hand/2)+1 (แต่ละบรรทัดพอจ่ายได้เดี่ยว ๆ แต่รวมกันเกิน)
2. PATCH commit
3. อ่านสต๊อก

**Expected**

ถูกปฏิเสธ 4xx STOCK_OUT_INSUFFICIENT_STOCK; ใบยัง draft; on-hand ไม่เปลี่ยน

> _Note: Review Focus 4: ตรวจรวมทั้งใบ ไม่ใช่ทีละบรรทัด_

---

## TC-IADJ-810004 — FC Stock Out ลงวันที่นอกงวดปัจจุบันถูกปฏิเสธและสต๊อกไม่เปลี่ยน

> **As a** FC user, **I want** this Inventory Adjustment — Stock and Cost behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

Login เป็น Admin; BU TEST; ลง Stock In E2E-IA-B ทาง API; อ่านงวดจาก GET /inventory-periods

**Steps**

1. เลือกวันในงวดเปิดอื่นที่ไม่ใช่งวดปัจจุบัน ถ้าไม่มีใช้วันก่อนวันเริ่มของงวดเปิดแรกสุด
2. สร้าง Stock Out E2E-IA-B × 1 ลงวันนั้นทาง API
3. ถ้าสร้างได้ PATCH commit
4. อ่านสต๊อก

**Expected**

ขั้นสร้างหรือ commit ตอบ 4xx STOCK_OUT_DATE_NOT_CURRENT_PERIOD หรือ STOCK_OUT_NO_OPEN_PERIOD; ไม่มีใบ completed; on-hand ไม่เปลี่ยน

> _Note: เส้นทาง API เท่านั้น · ไม่มีงวดเปิดเลย = ล้มพร้อมเหตุผล ไม่ข้าม · เคสนี้ไม่ปิดและไม่สร้างงวด_

---

## TC-IADJ-810005 — FC Commit Stock Out ซ้ำ (ต่อเนื่องและพร้อมกัน) ตัดสต๊อกครั้งเดียว

> **As a** FC user, **I want** this Inventory Adjustment — Stock and Cost behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Critical · **Test Type:** Concurrency

**Preconditions**

Login เป็น Admin; BU TEST; ลง Stock In E2E-IA-B 2 ชั้นทาง API; Stock Out draft 3 ใบ (E2E-IA-B × 2); อ่านสต๊อกก่อนแต่ละใบ

**Steps**

(ต่อเนื่อง) commit แล้ว commit ซ้ำ
(a) ยิง commit 2 คำขอพร้อมกันด้วย doc_version เดียวกัน
(b) ยิง commit 2 คำขอพร้อมกันโดยไม่ส่ง doc_version แล้ว commit ที่ถูกต้องอีกครั้ง

**Expected**

ต่อเนื่อง: ครั้งสอง 4xx STOCK_OUT_ONLY_DRAFT_COMMITTABLE; ทุกแบบ on-hand ลด 2 ครั้งเดียว และมี movement 1 บรรทัด
(b) คำขอที่ไม่มี doc_version ถูกปฏิเสธ 4xx และไม่มี movement

> _Note: R6: DTO บังคับ doc_version เป็นจำนวนเต็ม จึงทดสอบ (b) เป็น 'ไม่มี doc_version ต้องไม่ตัดอะไร'. ถ้า (b) ตัดซ้ำ = บั๊ก (ปักหมุด เหมือน 800004)_

---

## TC-IADJ-810006 — FC Void Stock Out ที่ commit แล้วคืนจำนวนและมูลค่ากลับเท่าก่อน commit

> **As a** FC user, **I want** this Inventory Adjustment — Stock and Cost interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Critical · **Test Type:** Functional

**Preconditions**

Login เป็น Admin; BU TEST; ลง Stock In E2E-IA-B 2 ชั้นทาง API; อ่านสต๊อก (on-hand และมูลค่า) ก่อน commit Stock Out

**Steps**

1. สร้าง Stock Out E2E-IA-B × 15 ทาง API แล้ว commit
2. อ่านสต๊อก
3. Void ใบ (void_reason + doc_version ปัจจุบัน)
4. อ่านสต๊อก

**Expected**

หลัง commit on-hand −15; หลัง void ส่วนต่างเทียบก่อน commit เป็น 0 ทั้งจำนวนและมูลค่า (คืนที่ต้นทุนที่ตัดไป)

> _Note: ส่วนต่างของค่าที่อ่านสด ไม่ใช้ค่าสัมบูรณ์_

---

## TC-IADJ-810007 — FC Stock Out ที่ completed แล้วแก้/ลบไม่ได้ และ void ซ้ำถูกปฏิเสธ

> **As a** FC user, **I want** this Inventory Adjustment — Stock and Cost behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

Login เป็น Admin; BU TEST; ลง Stock In E2E-IA-B 2 ชั้นทาง API; Stock Out E2E-IA-B × 1 commit แล้ว

**Steps**

1. PATCH save (เปลี่ยนคำอธิบาย) ใบที่ completed
2. DELETE ใบที่ completed
3. Void ใบ
4. Void ซ้ำ

**Expected**

save → 4xx STOCK_OUT_COMPLETED_NO_UPDATE; delete → 4xx STOCK_OUT_COMPLETED_NO_DELETE; void ครั้งแรกสำเร็จ; void ซ้ำ → 4xx

> _Note: เส้นทาง API เท่านั้น (หน้าจอไม่แสดงปุ่มแก้/ลบของใบ completed)_

---

## TC-IADJ-820001 — FC Stock In ที่ void แล้วยังต้องเห็นได้ในระบบ (อ่านได้ สถานะ voided อยู่ในตัวกรอง Voided)

> **As a** FC user, **I want** to filter the Inventory Adjustment — Stock and Cost list, **so that** I can narrow results to relevant records.

**Priority:** High · **Test Type:** Functional

**Preconditions**

Login เป็น Admin; BU TEST; Stock In E2E-IA-B × 5 ต้นทุน 9 ทาง API commit แล้ว และหน้ารายการเห็นใบในตัวกรอง Completed

**Steps**

1. Void ใบ
2. GET /stock-ins/:id
3. ดึงรายการ doc_status=voided ทาง API
4. เปิดหน้ารายการด้วยตัวกรอง Voided ค้นด้วยเลขที่ใบ

**Expected**

GET ตอบ 200 และ doc_status = voided; รายการ voided ทาง API มีใบนี้; หน้ารายการตัวกรอง Voided แสดงเลขที่ใบ

> _Note: ผู้ใช้ตัดสิน 23 พ.ย.: ใบที่ void แล้วหายไป = บั๊ก (void ทำ soft-delete, stock-in.service.ts:1889-1900) — ปักหมุด test.fail หลัง void สำเร็จ_

---

## TC-IADJ-820002 — FC Stock Out ที่ void แล้วยังต้องเห็นได้ในระบบ (อ่านได้ สถานะ voided อยู่ในตัวกรอง Voided)

> **As a** FC user, **I want** to filter the Inventory Adjustment — Stock and Cost list, **so that** I can narrow results to relevant records.

**Priority:** High · **Test Type:** Functional

**Preconditions**

Login เป็น Admin; BU TEST; ลง Stock In E2E-IA-B 2 ชั้นทาง API; Stock Out E2E-IA-B × 3 commit แล้ว และหน้ารายการเห็นใบในตัวกรอง Completed

**Steps**

1. Void ใบ
2. GET /stock-outs/:id
3. ดึงรายการ doc_status=voided ทาง API
4. เปิดหน้ารายการด้วยตัวกรอง Voided ค้นด้วยเลขที่ใบ

**Expected**

GET ตอบ 200 และ doc_status = voided; รายการ voided ทาง API มีใบนี้; หน้ารายการตัวกรอง Voided แสดงเลขที่ใบ

> _Note: ผู้ใช้ตัดสิน 23 พ.ย.: ใบที่ void แล้วหายไป = บั๊ก — ปักหมุด test.fail หลัง void สำเร็จ_

---


<sub>Last regenerated: 2026-11-23 · git 40f23c6</sub>
