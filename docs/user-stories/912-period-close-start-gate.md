# Period Close Start Gate — User Stories

_Generated from `tests/912-period-close-start-gate.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Period Close Start Gate
**Spec:** `tests/912-period-close-start-gate.spec.ts`
**Default role:** any authenticated
**Total test cases:** 7 (5 High / 1 Medium / 1 Low)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-PE-420001 | GRN ร่าง (เลข draft-…) ลงวันที่ในงวดขวาง Start Period Close แล้ว Void ได้ | High | Negative |
| TC-PE-420002 | GRN บันทึกแล้ว (saved) ของสินค้า P1 ลงวันที่ในงวดขวาง Start Period Close แล้ว Void ได้ | High | Negative |
| TC-PE-420003 | Stock In ร่างลงวันที่ในงวดขวาง Start Period Close แล้ว Void ได้ | High | Negative |
| TC-PE-420004 | Stock Out ร่างลงวันที่ในงวดขวาง Start Period Close แล้ว Void ได้ | High | Negative |
| TC-PE-420005 | GRN ร่าง + GRN saved + Stock In ร่าง + Stock Out ร่าง ค้างพร้อมกัน dialog ต้องลิสต์ครบแล้วเคลียร์ด้วย Delete/Void | High | Edge Case |
| TC-PE-420006 | เคสด่าน Start ที่ทำให้เกิดบนงวดของ scenario ไม่ได้ บันทึกเป็น N/A พร้อมเหตุผลและตรวจข้อเท็จจริงที่รองรับ | Low | Edge Case |
| TC-PE-420007 | ข้อค้นพบระหว่างเคลียร์เอกสาร: เลข SI/SO ต้องไม่ซ้ำหลัง void/delete และเหตุผล void ต้องถึง DB | Medium | Functional |

---

## TC-PE-420001 — GRN ร่าง (เลข draft-…) ลงวันที่ในงวดขวาง Start Period Close แล้ว Void ได้

> **As a** any authenticated user, **I want** this Period Close Start Gate behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

Login เป็น Admin (gmail); งวดปัจจุบันของ BU = งวดของ scenario; รอบนับยังไม่เริ่ม; ไม่มีเอกสารค้างอื่นในงวด (start_blocking.total = 0); 910 ผ่านแล้ว (admin ผูกกับคลัง L)

**Steps**

1. สร้าง GRN manual ลงวันที่ case1Date ของ scenario (E2E-PC-X qty 1 @10 ที่คลัง L) → Save Draft
2. GET period-ends/review
3. Period End → Start Period Close → ยืนยัน
4. อ่าน dialog "Finish these documents first" → Close
5. เปิด GRN → Void (กรอกเหตุผล)
6. GET period-ends/review

**Expected**

start_blocking.grn = 1 ก่อนกด; Start ถูกปฏิเสธ 422 และ dialog ลิสต์เลข draft-… ของใบนั้น; หลัง Void start_blocking.total = 0

> _Note: เดิม 1.1 (_movement_play specs/10-case1-start) · ทับซ้อน TC-PE-310002 (GRN ที่ยังไม่ post ขวางการปิด — ข้อนั้น skip เพราะเป็น backend only) · ผ่านแล้วในรอบก่อน → test.skip ไม่สร้างใบซ้ำ_

---

## TC-PE-420002 — GRN บันทึกแล้ว (saved) ของสินค้า P1 ลงวันที่ในงวดขวาง Start Period Close แล้ว Void ได้

> **As a** any authenticated user, **I want** this Period Close Start Gate behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

Login เป็น Admin (gmail); งวดปัจจุบันของ BU = งวดของ scenario; รอบนับยังไม่เริ่ม; ไม่มีเอกสารค้างอื่นในงวด (start_blocking.total = 0); 910 ผ่านแล้ว

**Steps**

1. สร้าง GRN manual ตาม voidTrap ของ scenario (E2E-PC-1 qty 10 ราคากับดัก วันที่ในงวด ที่คลัง L) → Create (saved)
2. GET period-ends/review
3. Period End → Start Period Close → ยืนยัน
4. อ่าน dialog "Finish these documents first" → Close
5. เปิด GRN → Void
6. GET period-ends/review

**Expected**

start_blocking.grn = 1 ก่อนกด; Start ถูกปฏิเสธ 422 และ dialog ลิสต์เลข GRN ของใบนั้น; หลัง Void สถานะใบ = voided และ start_blocking.total = 0

> _Note: เดิม 1.2 (_movement_play specs/10-case1-start) · ใบ void นี้ (state key = voidTrap.key) ใช้ต่อในข้อ 2.9 เป็นกับดักต้นทุน (GRN void ต้องไม่นับ) — ห้ามเปลี่ยน key · ทับซ้อน TC-PE-310002 · ผ่านแล้วในรอบก่อน → test.skip_

---

## TC-PE-420003 — Stock In ร่างลงวันที่ในงวดขวาง Start Period Close แล้ว Void ได้

> **As a** any authenticated user, **I want** this Period Close Start Gate behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

Login เป็น Admin (gmail); งวดปัจจุบันของ BU = งวดของ scenario; รอบนับยังไม่เริ่ม; ไม่มีเอกสารค้างอื่นในงวด (start_blocking.total = 0); 910 ผ่านแล้ว

**Steps**

1. Inventory Adjustment → Add Stock In · Date = case1Date ของ scenario · Reason Test stock_in · คลัง L · E2E-PC-X qty 1 @10 → Save (draft)
2. GET period-ends/review
3. Period End → Start Period Close → ยืนยัน
4. อ่าน dialog → Close
5. เปิดใบ → Edit → Void (กรอก Void Reason)
6. GET period-ends/review

**Expected**

start_blocking.stock_in = 1 ก่อนกด; Start ถูกปฏิเสธ 422 และ dialog ลิสต์เลข SI ของใบนั้น; หลัง Void start_blocking.total = 0; payload void ที่ FE ส่งถูกเก็บไว้ใช้ในข้อ 1.F2

> _Note: เดิม 1.3 (_movement_play specs/10-case1-start) · actual ต้องมีข้อความ "void payload={…}" — TC-PE-420007 (1.F2) อ่านจาก results.json · ผ่านแล้วในรอบก่อน → test.skip_

---

## TC-PE-420004 — Stock Out ร่างลงวันที่ในงวดขวาง Start Period Close แล้ว Void ได้

> **As a** any authenticated user, **I want** this Period Close Start Gate behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

Login เป็น Admin (gmail); งวดปัจจุบันของ BU = งวดของ scenario; รอบนับยังไม่เริ่ม; ไม่มีเอกสารค้างอื่นในงวด (start_blocking.total = 0); 910 ผ่านแล้ว (มีสต๊อก Shredded pork skin ที่คลัง L)

**Steps**

1. Inventory Adjustment → Add Stock Out · Date = case1Date ของ scenario · Reason Test stock_out · คลัง L · Shredded pork skin qty 1 → Save (draft)
2. GET period-ends/review
3. Period End → Start Period Close → ยืนยัน
4. อ่าน dialog → Close
5. เปิดใบ → Edit → Void (กรอก Void Reason)
6. GET period-ends/review

**Expected**

start_blocking.stock_out = 1 ก่อนกด; Start ถูกปฏิเสธ 422 และ dialog ลิสต์เลข SO ของใบนั้น; หลัง Void start_blocking.total = 0

> _Note: เดิม 1.4 (_movement_play specs/10-case1-start) · actual ต้องมีข้อความ "void payload={…}" — TC-PE-420007 (1.F2) อ่านจาก results.json · ผ่านแล้วในรอบก่อน → test.skip_

---

## TC-PE-420005 — GRN ร่าง + GRN saved + Stock In ร่าง + Stock Out ร่าง ค้างพร้อมกัน dialog ต้องลิสต์ครบแล้วเคลียร์ด้วย Delete/Void

> **As a** any authenticated user, **I want** this Period Close Start Gate behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Edge Case

**Preconditions**

Login เป็น Admin (gmail); งวดปัจจุบันของ BU = งวดของ scenario; รอบนับยังไม่เริ่ม; ไม่มีเอกสารค้างอื่นในงวด (start_blocking.total = 0); 910 ผ่านแล้ว

**Steps**

1. สร้างผ่าน UI ลงวันที่ในงวด: GRN ร่าง (Save Draft), GRN saved (E2E-PC-X qty 10 @20), Stock In ร่าง, Stock Out ร่าง
2. GET period-ends/review
3. Period End → Start Period Close → ยืนยัน
4. อ่าน dialog → Close
5. Delete GRN ร่าง · Void GRN saved (ใบ saved ลบไม่ได้) · Delete SI ร่าง · Delete SO ร่าง
6. GET period-ends/review

**Expected**

start_blocking ก่อนกด = grn 2 / stock_in 1 / stock_out 1; Start ถูกปฏิเสธ 422 และ dialog ลิสต์เลขทั้งสี่ใบ; หลังเคลียร์ start_blocking.total = 0

> _Note: เดิม 1.5 (_movement_play specs/10-case1-start) · ครอบเส้นทางลบ (Delete) ของ GRN/SI/SO ร่าง · SI/SO ใบใหม่ในข้อนี้เคยได้เลขซ้ำกับใบที่ void ในข้อ 1.3/1.4 (บั๊ก 1.F1 แก้แล้วใน PR #697) · ทับซ้อน TC-PE-310005 (pending หลายชนิด) · ผ่านแล้วในรอบก่อน → test.skip_

---

## TC-PE-420006 — เคสด่าน Start ที่ทำให้เกิดบนงวดของ scenario ไม่ได้ บันทึกเป็น N/A พร้อมเหตุผลและตรวจข้อเท็จจริงที่รองรับ

> **As a** any authenticated user, **I want** this Period Close Start Gate behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Low · **Test Type:** Edge Case

**Preconditions**

Login เป็น Admin (gmail); งวดปัจจุบันของ BU = งวดของ scenario; รอบนับยังไม่เริ่ม; E2E_DB_URL ตั้งไว้

**Steps**

1. DB: นับ SI / SO / CN ที่ doc_status = in_progress → บันทึก 1.N2 = N/A
2. GET period-ends/review: ดูชนิดเอกสารใน start_blocking → บันทึก 1.N3 = INFO

**Expected**

ไม่มี SI/SO/CN ที่สถานะ in_progress ใน BU; start_blocking ไม่มีชนิด cn / pr / po

> _Note: เดิม 1.N1 / 1.N2 / 1.N3 (_movement_play specs/10-case1-start ชื่อ "1.N เคสที่ทำให้เกิดบน BU ไม่ได้") · ต้นฉบับบันทึก N/A / INFO อย่างเดียวไม่ assert — พอร์ตเพิ่มการตรวจข้อเท็จจริงที่ทำให้เป็น N/A/INFO · 1.N1 ทดสอบของจริงใน TC-PE-410001 (911 สร้างใบค้างเองผ่าน API) จึงไม่มีแถว N/A ของ 1.N1 อีกแล้ว · 1.N3 ยืนยันด้วยการใช้งานจริงใน TC-PE-440006/440007_

---

## TC-PE-420007 — ข้อค้นพบระหว่างเคลียร์เอกสาร: เลข SI/SO ต้องไม่ซ้ำหลัง void/delete และเหตุผล void ต้องถึง DB

> **As a** any authenticated user, **I want** this Period Close Start Gate interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

TC-PE-420003 / 420004 / 420005 รันแล้วในงวดเดียวกัน (มี SI/SO ที่ถูก void และลบ และมี payload void ใน results.json); E2E_DB_URL ตั้งไว้

**Steps**

1. DB: หา si_no / so_no ของงวด (ขึ้นต้น SI<งวด> / SO<งวด>) ที่มีมากกว่า 1 แถว รวมแถวที่ถูกลบ
2. DB: อ่าน info.void_reason ของ SI/SO ที่ voided ในงวด
3. เทียบกับ payload void ที่ FE ส่งในข้อ 1.3/1.4

**Expected**

ไม่มีเลข SI/SO ซ้ำในงวด (ใบที่ void/ลบยังกันเลขไว้) และ SI/SO ที่ voided ทุกใบมี info.void_reason = ข้อความที่กรอก

> _Note: เดิม 1.F1 / 1.F2 (_movement_play specs/10-case1-start) · บั๊กทั้งสองแก้แล้วใน PR #697 (period03 = FIXED, รอบล่าสุด p11-r4 / avg2607-r4 = PASS 2026-10-02) จึงไม่ใช่ test.fail · ต้นฉบับบันทึก FAIL โดยไม่ล้มเทส — พอร์ต assert ทั้งสองข้อ · scenario p03 จะล้มเสมอเพราะแถวเลขซ้ำ/void_reason ว่างที่เกิดก่อนแก้ยังค้างใน DB (ดู TC-PE-430003)_

---


<sub>Last regenerated: 2026-11-24 · git 13584e4</sub>
