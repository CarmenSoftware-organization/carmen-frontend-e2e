# Period Close Prestep — User Stories

_Generated from `tests/910-period-close-prestep.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Period Close Prestep
**Spec:** `tests/910-period-close-prestep.spec.ts`
**Default role:** any authenticated
**Total test cases:** 4 (4 High / 0 Medium / 0 Low)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-PE-400001 | เคลียร์ GRN saved/draft ที่ค้างจากงวดก่อนและขวางการเริ่มนับของงวดนี้ | High | Functional |
| TC-PE-400002 | ผูก admin กับคลัง L ของ scenario ผ่านหน้า System Admin → Users | High | Functional |
| TC-PE-400003 | สร้างเอกสารรับเข้าของ scenario (GRN / Stock In) ผ่าน UI แล้วได้ cost layer ตามราคาที่กรอก | High | Functional |
| TC-PE-400004 | ตั้ง Default price for added items (si.cost-from) ของ BU ตามที่ scenario กำหนด | High | Functional |

---

## TC-PE-400001 — เคลียร์ GRN saved/draft ที่ค้างจากงวดก่อนและขวางการเริ่มนับของงวดนี้

> **As a** any authenticated user, **I want** this Period Close Prestep interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

Login เป็น Admin (gmail, project setup); BU และงวดของ scenario (E2E_PERIOD_BU) เป็นงวดปัจจุบัน; scenario มีรายการ preClean หรือเปิด preCleanAuto (TEST BU ว่างจากเอกสาร ทั้งสองค่าจึงปิดไว้ = เคสนี้ skip); E2E_DB_URL ตั้งไว้

**Steps**

1. หา GRN ที่ต้องเคลียร์: รายการ preClean ของ scenario + (preCleanAuto) GRN saved/draft ที่ลงวันที่ในงวดของ scenario จาก DB
2. GRN saved → เปิดใบ → Commit → ยืนยัน
3. GRN draft → เปิดใบ → Edit → Delete → ยืนยัน
4. DB: ค้นหา GRN saved/draft ที่ลงวันที่ในงวดนี้อีกครั้ง

**Expected**

ใบที่สั่ง commit มีสถานะ committed; ใบร่างถูกลบ; ไม่เหลือ GRN saved/draft ที่ลงวันที่ในงวดของ scenario

> _Note: เดิม 0.0 (_movement_play specs/00-prestep) · ต้นฉบับบันทึก PASS เสมอและไม่ assert — พอร์ตเพิ่มการตรวจสถานะหลัง commit และตรวจซ้ำว่าไม่มี GRN ค้างในงวด (บันทึก FAIL ถ้ายังค้าง) · สร้างผลกระทบจริง: commit ใบ saved ลงสต๊อก_

---

## TC-PE-400002 — ผูก admin กับคลัง L ของ scenario ผ่านหน้า System Admin → Users

> **As a** any authenticated user, **I want** this Period Close Prestep interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

Login เป็น Admin (gmail, project setup); BU ของ scenario; คลัง L (คลัง inventory แรกของ BU ที่ data:reset ผูก E2E-PC-* ไว้) มีอยู่ใน BU

**Steps**

1. เปิด /system-admin/user → กดชื่อ Admin (gmail)
2. ถ้ายังไม่ผูกคลัง L: Edit → ติ๊กแถวคลัง L → Save
3. GET /user-locations ของ BU
4. เปิดผู้ใช้อีกครั้ง ดูส่วน Locations (โหมด view)

**Expected**

GET /api/<BU>/user-locations มีรหัสคลัง L และหน้า view ของผู้ใช้แสดงแถวคลัง L

> _Note: ผูกคลังเป็นการตั้งค่าเริ่มต้นของ suite โดยตั้งใจ ไม่ถูกย้อนคืนหลังรัน · เดิม 0.1 (_movement_play specs/00-prestep) · idempotent: ผูกไว้แล้วจะไม่กด Edit/Save ซ้ำ_

---

## TC-PE-400003 — สร้างเอกสารรับเข้าของ scenario (GRN / Stock In) ผ่าน UI แล้วได้ cost layer ตามราคาที่กรอก

> **As a** any authenticated user, **I want** this Period Close Prestep interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

TC-PE-400002 ผ่านแล้ว (admin ผูกกับคลัง L ของ scenario); งวดปัจจุบันของ BU = งวดของ scenario; E2E_DB_URL ตั้งไว้

**Steps**

1. วนเอกสารรับเข้าทุกใบของ scenario (SCN.receipts: 0.2, 0.2b, 0.3, 0.3a, 0.3b, 0.3c ตามที่ scenario มี) — แต่ละใบเป็น test.step ของตัวเอง
2. GRN: Goods Receive Note → New (Manual) · Vendor C010 · GRN Date ตาม scenario · คลัง L · สินค้า/จำนวน/ราคาตาม scenario → Create → Commit
3. Stock In: Inventory Adjustment → Add Stock In · Date ตาม scenario · Reason E2E IA stock in · คลัง L → Commit
4. เปิดใบ ตรวจว่าแสดงเลขเอกสาร
5. DB: อ่าน cost layer ของสินค้าแต่ละบรรทัดที่คลัง L

**Expected**

GRN มีสถานะ committed / Stock In มีสถานะ completed และทุกบรรทัดมี cost layer at_period = งวดของ scenario ที่ in_qty และ cost_per_unit ตรงกับที่กรอก

> _Note: เดิม 0.2 / 0.2b / 0.3 / 0.3a / 0.3b / 0.3c (_movement_play specs/00-prestep — เดิมเป็นหนึ่ง test ต่อใบ ชื่อเปลี่ยนตาม scenario) · ต้นฉบับ assert แค่สถานะใบ แต่บันทึก FAIL เมื่อ layer ไม่ตรงด้วย — พอร์ต assert ทั้งสองอย่าง (expect.soft ให้ใบถัดไปยังถูกสร้าง) · idempotent: จำเลขใบใน state.json · ราคาเหล่านี้เป็นฐานของการตรวจต้นทุนในข้อ 2.9_

---

## TC-PE-400004 — ตั้ง Default price for added items (si.cost-from) ของ BU ตามที่ scenario กำหนด

> **As a** any authenticated user, **I want** this Period Close Prestep interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

Login เป็น Admin (gmail, project setup); ถ้าต้องเปลี่ยนค่า BU ตั้งต้นของบัญชี admin ต้องเป็น BU ของ scenario (PATCH api/business-units ไม่มี bu_code — เขียนลง BU ตั้งต้นของบัญชี)

**Steps**

1. อ่าน si.cost-from ของ BU จาก /api/user/profile
2. ถ้ายังไม่ตรง: เปิด /system-admin/default-setting → Edit → Default price for added items = ค่าของ scenario (Last receiving / Last cost / Average) → Save
3. รอจน profile ของ BU คืนค่าใหม่
4. (ถ้า BU ตั้งต้นของบัญชีคือ BU ของ scenario) reload หน้า ดูค่าที่แสดงในโหมด view

**Expected**

bu_config si.cost-from ของ BU ของ scenario = ค่าที่ scenario กำหนด (เช่น last_cost); request บันทึกตอบ 2xx; หน้า view แสดง label ของค่านั้น

> _Note: เดิม 0.4 (_movement_play specs/00-prestep) · เคยเขียนผิด BU (period04 ข้อ 0.4-F: PATCH 200 แต่ค่าไปลง BU ตั้งต้นของบัญชีแทน) จึงมีด่านเช็ค BU ตั้งต้นก่อนกด Save · พอร์ตเพิ่ม assert ว่า request บันทึกตอบ ok และอ่าน toast แบบไม่รอ (เดิม lastToast().catch)_

---


<sub>Last regenerated: 2026-11-24 · git 60aa365</sub>
