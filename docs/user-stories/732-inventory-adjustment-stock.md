# Inventory Adjustment — Stock and Cost — User Stories

_Generated from `tests/732-inventory-adjustment-stock.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Inventory Adjustment — Stock and Cost
**Spec:** `tests/732-inventory-adjustment-stock.spec.ts`
**Default role:** Admin
**Total test cases:** 10 (4 High / 1 Medium / 0 Low / 5 unset)

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


<sub>Last regenerated: 2026-11-23 · git dd0b200</sub>
