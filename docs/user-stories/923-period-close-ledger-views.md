# Period Close Ledger Views — User Stories

_Generated from `tests/923-period-close-ledger-views.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Period Close Ledger Views
**Spec:** `tests/923-period-close-ledger-views.spec.ts`
**Default role:** any authenticated
**Total test cases:** 3 (0 High / 3 Medium / 0 Low)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-PE-530001 | ราคาที่ฟอร์ม Stock In และ Stock Out เติมให้ (CostProbe) ตรงกับราคาที่การโพสต์ใบจ่ายจะคิด | Medium | Functional |
| TC-PE-530002 | หน้า Inventory Transaction แสดงยกเข้า (open) ในช่อง Qty In และปิดงวด (close) ในช่อง Qty Out เป็นเลขบวก | Medium | Functional |
| TC-PE-530003 | รายการเคลื่อนไหวของสินค้าที่คลัง (inventory-info) ไม่มีแถวของใบที่ void | Medium | Edge Case |

---

## TC-PE-530001 — ราคาที่ฟอร์ม Stock In และ Stock Out เติมให้ (CostProbe) ตรงกับราคาที่การโพสต์ใบจ่ายจะคิด

> **As a** any authenticated user, **I want** this Period Close Ledger Views interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

Login เป็น Admin (gmail) บน BU ของ scenario; E2E_PERIOD_BU และ E2E_DB_URL ตั้งไว้; คลัง L มีล็อตของ P1–P4 จาก pre-step (บางสินค้ามีล็อตของ GRN ที่ void เป็นตัวหลอก)

**Steps**

1. เปิดฟอร์ม Stock In ใหม่ ลงวันที่สิ้นงวดปัจจุบัน คลัง L เพิ่ม P1–P4 อย่างละ 3 หน่วย อ่านราคาต่อหน่วยที่ฟอร์มเติมให้ (ไม่บันทึก)
2. ทำแบบเดียวกันกับฟอร์ม Stock Out อ่านช่อง Total Cost (ไม่บันทึก)
3. คิดราคาที่คาดจาก cost layer: FIFO ตัดล็อตเก่าก่อนจากงวดที่หยิบได้ · AVG ค่าเฉลี่ยสุทธิ · ของไม่พอ = ไม่เติมราคา

**Expected**

ทุกสินค้า: ราคาต่อหน่วยบน SI = ราคาเฉลี่ยที่คาด และ Total Cost บน SO = ยอดรวมที่คาด ทศนิยมไม่เกิน 2 ตำแหน่ง ไม่ใช่ราคาล็อตของ GRN ที่ void · ถ้าของไม่พอ ช่องราคาต้องว่างหรือ 0

> _Note: เดิม 3.1-P1..P4 (_movement_play specs/47-ledger-views) · ต้นฉบับไม่มี expect เลย (บันทึก FAIL ลง results.json แต่ test เขียว) — port assert ทุกสินค้าตาม verdict · ฟอร์ม dry-run ไม่สร้างเอกสาร · ข้อค้นพบเดิม AVG 2601–2603 แก้ด้วย PR #708 · รอบล่าสุด p11-r4 / avg2607-r4 (2026-10-02) PASS ทุกตัว_

---

## TC-PE-530002 — หน้า Inventory Transaction แสดงยกเข้า (open) ในช่อง Qty In และปิดงวด (close) ในช่อง Qty Out เป็นเลขบวก

> **As a** any authenticated user, **I want** this Period Close Ledger Views interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

Login เป็น Admin (gmail) บน BU ของ scenario; E2E_DB_URL ตั้งไว้; มีงวดที่ปิดแล้วอย่างน้อยหนึ่งงวดจึงจะมีแถว open/close ให้ตรวจ (งวดแรกหลังรีเซ็ตบันทึก N/A)

**Steps**

1. เปิด /inventory-management/transaction?inventory_doc_type=open,close รอคำขอรายการที่มีตัวกรองชนิด
2. นับแถว open/close ในบัญชี (tb_inventory_transaction) — ถ้าไม่มี บันทึก N/A
3. อ่านช่อง Qty In / Qty Out ทุกแถวในหน้าแรก เทียบผลรวม qty บวก/ลบของรายการนั้นในบัญชี

**Expected**

มีแถวในบัญชี: หน้าจอมีแถว และมีคอลัมน์ Qty In / Qty Out · open: Qty In = ยอดยกเข้า, Qty Out = - · close: Qty Out = ยอดที่ตัดเป็นเลขบวก, Qty In = - · ตัวเลขตรงบัญชีทุกแถว · ไม่มีแถวในบัญชี: รายการที่หน้าจอได้ต้องว่างด้วย

> _Note: เดิม 3.2 (_movement_play specs/47-ledger-views) · ต้นฉบับ assert แค่ว่ามีแถว — port assert ทิศและจำนวนทุกแถวตาม verdict · กรณีไม่มีแถว open/close ในบัญชี ต้นฉบับบันทึก N/A แล้ว return เงียบ — port assert ว่าหน้าจอก็ไม่ได้แถวมาเช่นกัน (รอบ p10-r3 / avg2606-r3 เป็นแบบนี้: 0 แถว) · รอบล่าสุด p11-r4 / avg2607-r4 (2026-10-02) PASS · อ่านอย่างเดียว_

---

## TC-PE-530003 — รายการเคลื่อนไหวของสินค้าที่คลัง (inventory-info) ไม่มีแถวของใบที่ void

> **As a** any authenticated user, **I want** this Period Close Ledger Views behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Edge Case

**Preconditions**

BU ของ scenario; E2E_DB_URL ตั้งไว้; P1 (11110001) ที่คลัง L มีรายการเคลื่อนไหวจาก pre-step (บางรอบมี GRN ที่ void ของ P1 เป็นตัวหลอก)

**Steps**

1. GET /api/<BU>/inventory-info/<P1>/<คลัง L> ในนาม admin (ไม่มีหน้าจอ FE แสดงรายการนี้)
2. อ่านล็อตของรายการที่ยังไม่ void และล็อตของใบที่ void ของ P1 ที่คลัง L จากฐานข้อมูล
3. เทียบรายการที่ API คืนกับทั้งสองชุด

**Expected**

HTTP 200 · ไม่มีแถวที่ lot_no ตรงกับล็อตของใบที่ void · จำนวนแถวที่ API คืน = จำนวนรายการของใบที่ยังไม่ void

> _Note: เดิม 3.3 (_movement_play specs/47-ledger-views) · ต้นฉบับไม่มี expect เลย (บันทึก FAIL ลง results.json แต่ test เขียว) — port assert ตาม verdict · ตรวจที่ API เพราะ FE ไม่มีหน้าแสดงรายการนี้ · รอบล่าสุด p11-r4 / avg2607-r4 (2026-10-02) PASS · อ่านอย่างเดียว_

---


<sub>Last regenerated: 2026-11-24 · git 13584e4</sub>
