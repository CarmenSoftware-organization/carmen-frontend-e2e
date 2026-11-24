# Period Close New Rules — User Stories

_Generated from `tests/917-period-close-new-rules.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Period Close New Rules
**Spec:** `tests/917-period-close-new-rules.spec.ts`
**Default role:** any authenticated
**Total test cases:** 4 (4 High / 0 Medium / 0 Low)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-PE-470001 | ใบรับลงวันที่งวดหน้าที่บันทึกแล้วยังไม่ลงสต๊อก (#719 · AVG) | High | Functional |
| TC-PE-470002 | Stock In ลงวันที่งวดหน้าที่ยืนยันแล้วยังไม่ลงสต๊อก (#719 · AVG) | High | Functional |
| TC-PE-470003 | ใบรับที่บันทึกแล้วแก้ได้แค่หัวใบ (#715) | High | Validation |
| TC-PE-470004 | ใบเบิกลงวันที่งวดหลังอนุมัติถึงขั้นจ่ายได้แต่จ่ายไม่ได้จนกว่างวดนั้นเป็นงวดปัจจุบัน (#718) | High | Negative |

---

## TC-PE-470001 — ใบรับลงวันที่งวดหน้าที่บันทึกแล้วยังไม่ลงสต๊อก (#719 · AVG)

> **As a** any authenticated user, **I want** this Period Close New Rules interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

E2E_PERIOD_SCENARIO เป็น scenario ของ BU แบบ average (CARMEN-AVG); งวดปัจจุบันของ BU = งวดของ scenario; phase 914 (เดิม 20-case2) TC-PE-440001 (ข้อ 2.1) สร้างใบรับงวดหน้า (saved) ไว้ใน state.json แล้ว

**Steps**

1. อ่านใบรับงวดหน้าจาก state.json (key nextGrn ของ scenario)
2. อ่าน doc_status ของใบจาก tb_good_received_note
3. นับ cost layer ที่ยังไม่ถูกลบของใบนี้

**Expected**

ใบเป็น saved แต่มีรายการเคลื่อนไหว 0 แถว — จะไปลงตอนปิดงวดปัจจุบันหลังยกยอดเข้างวดหน้า (ตรวจในข้อ 5.5 ของ phase ปิดงวด)

> _Note: เดิม 5.1 (_movement_play specs/24-new-rules) · พิสูจน์ backend PR #719 · ข้ามบน FIFO (FIFO ลงสต๊อกตอน commit อยู่แล้ว) · ผลล่าสุด avg2607-r4 2026-10-02 PASS · เดิมยืนยันแค่จำนวน layer — เพิ่มการยืนยันสถานะ saved ให้ตรงกับ verdict_

---

## TC-PE-470002 — Stock In ลงวันที่งวดหน้าที่ยืนยันแล้วยังไม่ลงสต๊อก (#719 · AVG)

> **As a** any authenticated user, **I want** this Period Close New Rules interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

E2E_PERIOD_SCENARIO เป็น scenario ของ BU แบบ average (CARMEN-AVG); งวดปัจจุบันของ BU = งวดของ scenario; มีงวดหน้าเปิดไว้แล้ว; ประเภทปรับปรุง "Test stock_in" และคลัง 1AG01 มีอยู่

**Steps**

1. ถ้ายังไม่มี siNextHeld ใน state: POST /stock-ins ลงวันที่วันที่ 11 ของงวดหน้า ที่ 1AG01: Chicken frame 2 หน่วย @20 (หน้าจอเลือกวันนอกงวดปัจจุบันไม่ได้)
2. GET ใบเพื่ออ่าน doc_version แล้ว PATCH /stock-ins/:id/commit
3. อ่าน doc_status ของใบจาก tb_stock_in
4. นับ cost layer ที่ยังไม่ถูกลบของใบนี้

**Expected**

สร้างและ commit ได้ (HTTP < 300); ใบเป็น completed แต่มีรายการเคลื่อนไหว 0 แถว — จะไปลงตอนปิดงวดปัจจุบันหลังยกยอด (ตรวจในข้อ 5.5)

> _Note: เดิม 5.2 (_movement_play specs/24-new-rules) · พิสูจน์ backend PR #719 · ยิง API เพราะปฏิทินของฟอร์มล็อกไว้ที่งวดปัจจุบัน · ข้ามบน FIFO · ใบที่ commit แล้วย้อนไม่ได้ (ลงสต๊อกตอนปิดงวด) · ผลล่าสุด avg2607-r4 2026-10-02 PASS · เดิมยืนยันแค่จำนวน layer — เพิ่มการยืนยันสถานะ completed ให้ตรงกับ verdict_

---

## TC-PE-470003 — ใบรับที่บันทึกแล้วแก้ได้แค่หัวใบ (#715)

> **As a** any authenticated user, **I want** the system to block invalid Period Close New Rules submissions, **so that** data quality is preserved.

**Priority:** High · **Test Type:** Validation

**Preconditions**

E2E_PERIOD_SCENARIO=<scenario> (AVG หรือ FIFO); งวดปัจจุบันของ BU = งวดของ scenario; phase 914 (เดิม 20-case2) TC-PE-440001 (ข้อ 2.1) สร้างใบรับงวดหน้า (saved) ไว้ใน state.json แล้ว

**Steps**

1. PATCH /good-received-notes/:id แก้ received_qty ของบรรทัดแรกเป็น 99
2. PATCH แก้ grn_date เป็นวันที่ 20 ของงวดหน้า (ตัวกำหนดงวด)
3. PATCH เปลี่ยน doc_status กลับเป็น draft
4. PATCH แก้ note และ invoice_no (หัวใบ)
5. อ่าน note, invoice_no, doc_status จาก tb_good_received_note

**Expected**

แก้บรรทัดและแก้วันที่ → 400 GRN_SAVED_HEADER_ONLY; เปลี่ยนสถานะ → 400 GRN_STATUS_CHANGE_NOT_ALLOWED; แก้ note/invoice_no → สำเร็จ (HTTP < 300) ค่าใหม่ถูกเก็บ และใบยังเป็น saved

> _Note: เดิม 5.3 (_movement_play specs/24-new-rules) · พิสูจน์ backend PR #715 · ยิง API เพราะหน้าจอไม่ส่งการแก้บรรทัด/สถานะของใบ saved · ผลล่าสุด PASS ทั้ง avg2607-r4 และ p11-r4 (2026-10-02)_

---

## TC-PE-470004 — ใบเบิกลงวันที่งวดหลังอนุมัติถึงขั้นจ่ายได้แต่จ่ายไม่ได้จนกว่างวดนั้นเป็นงวดปัจจุบัน (#718)

> **As a** any authenticated user, **I want** this Period Close New Rules behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

E2E_PERIOD_SCENARIO=<scenario>; งวดปัจจุบันของ BU = งวดของ scenario และวันนี้อยู่ในงวด open/locked อื่นที่ใหม่กว่า (ไม่งั้นข้าม); workflow SR ที่ขั้น create>approve>issue>approve (หาจาก stage ด้วย srIssueWorkflowName — เดิมชื่อ 'SR Test Flow v2 (with Issue)' แต่ถูกเปลี่ยนชื่อบน dev); คลัง TEST-MOVE / TEST-CONSUME ผูกสินค้า T-01-A (AVG) หรือ T-01-F (FIFO); บัญชี requestor@carmen.com และ hod@carmen.com มีอยู่

**Steps**

1. admin POST /store-requisitions (requestor = requestor@carmen.com): T-01-A/T-01-F 1 หน่วย จาก TEST-MOVE ไป TEST-CONSUME
2. admin PATCH …/submit พร้อม sr_date_pattern = today (ผู้ใช้เลือกลงวันที่วันนี้)
3. hod@carmen.com PATCH …/approve ขั้น HOD (approved_qty 1)
4. admin PATCH …/approve stage_role = issue (issued_qty 1)
5. อ่านใบและนับ cost layer ของใบ
6. เก็บกวาด: reject ใบที่ค้างขั้น Issue

**Expected**

ใบลงวันที่วันนี้ ส่งและอนุมัติได้ ไปรอที่ขั้น Issue; การจ่ายถูกปฏิเสธ 422 SR_ISSUE_PERIOD_NOT_CURRENT; ใบยังไม่ completed ยังอยู่ขั้น Issue และไม่มีรายการเคลื่อนไหว (0 แถว)

> _Note: เดิม 5.4 (_movement_play specs/24-new-rules) · พิสูจน์ backend PR #718 · ยิง API เพราะต้องใช้ผู้อนุมัติอีกบัญชี (HOD) · ข้อที่ระบบต้องถามวันที่เมื่อไม่เลือก อยู่ใน 721-sr-issue-doc-flow · ใกล้เคียง TC-PE-490002 (เดิม A4 ใน 26-active-period) ซึ่งเป็นตัวควบคุมเดียวกัน · ผลล่าสุด avg2607-r4 2026-10-02 PASS (p11-r4 ข้ามเพราะวันนี้อยู่ในงวดปัจจุบัน)_

---


<sub>Last regenerated: 2026-11-24 · git f462816</sub>
