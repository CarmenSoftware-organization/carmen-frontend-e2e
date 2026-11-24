# Period Close Active Period — User Stories

_Generated from `tests/919-period-close-active-period.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Period Close Active Period
**Spec:** `tests/919-period-close-active-period.spec.ts`
**Default role:** any authenticated
**Total test cases:** 11 (3 High / 7 Medium / 1 Low)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-PE-490001 | ยอดคงเหลือที่หลังบ้านคืนต้องเป็นยอดของงวด active | High | Functional |
| TC-PE-490002 | ใบเบิกที่เลือกลงวันที่วันนี้ (งวดหลัง) ต้องรอจนงวดของมันเป็นงวด active | Medium | Negative |
| TC-PE-490003 | ใบลดหนี้ลงวันที่วันนี้ (นอกงวด active) ต้องถูกปฏิเสธไม่ลงบัญชี | High | Negative |
| TC-PE-490004 | ใบลดหนี้ลงวันที่ในงวด active ยังสร้างและลงบัญชีได้ตามปกติ | High | Happy Path |
| TC-PE-490005 | ใบลดหนี้ลงวันที่วันแรกของงวด active (เวลาไทย) ต้องสร้างได้ | Medium | Edge Case |
| TC-PE-490006 | สร้างรอบนับ (physical count period) ได้เฉพาะงวด active | Medium | Negative |
| TC-PE-490007 | ตัดของเสียไม่ส่งวันที่ ใบจ่ายออกต้องลงวันที่และลงบัญชีในงวด active | Medium | Functional |
| TC-PE-490008 | สร้าง Stock Out / Stock In ไม่ส่งวันที่ ค่าเริ่มต้นต้องอยู่ในงวด active | Low | Edge Case |
| TC-PE-490009 | รายงาน lookup current-period / previous-period ต้องอิงงวด active | Medium | Functional |
| TC-PE-490010 | รายงาน lookup ตัวเลือกงวดต้องเป็นงวดที่ปิดแล้วกับงวด active | Medium | Functional |
| TC-PE-490011 | หัวงวดของรายงาน EOP Checklist ต้องเป็นงวด active | Medium | Functional |

---

## TC-PE-490001 — ยอดคงเหลือที่หลังบ้านคืนต้องเป็นยอดของงวด active

> **As a** any authenticated user, **I want** this Period Close Active Period interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

E2E_PERIOD_SCENARIO เป็น scenario ของ CARMEN-AVG (งวด active ตามหลังวันนี้) หรือ CARMEN-FIFO (ตัวควบคุม: งวด active = เดือนนี้); AVG: LCX013 มี 11020001 ในงวด active · FIFO: TEST-MOVE มี T-01-F

**Steps**

1. หางวด active (open/locked ที่เก่าที่สุด) จาก tb_inventory_period
2. รวม in_qty − out_qty ของ cost layer สินค้า/คลังนั้นเฉพาะงวด active ใน DB
3. GET /products/:id/on-hand?location_id=…
4. GET /inventory-info/:product/:location

**Expected**

ยอดในงวด active มากกว่า 0 และทั้ง total_on_hand กับ on_hand_qty เท่ากับยอดของงวด active ใน DB

> _Note: เดิม A1 (_movement_play specs/26-active-period) · id ใน results.json = A1-AVG / A1-FIFO ตาม BU · พิสูจน์ backend PR #724 · active-r3-avg FAIL (โค้ดเดิมคืน 0) → active-r4-avg PASS, active-r4-fifo PASS (2026-10-02)_

---

## TC-PE-490002 — ใบเบิกที่เลือกลงวันที่วันนี้ (งวดหลัง) ต้องรอจนงวดของมันเป็นงวด active

> **As a** any authenticated user, **I want** this Period Close Active Period behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Negative

**Preconditions**

E2E_PERIOD_SCENARIO เป็น scenario ของ CARMEN-AVG และวันนี้อยู่ในงวดที่สร้างล่วงหน้า (นอกงวด active) — FIFO ข้าม; workflow SR ที่ขั้น create>approve>issue>approve (srIssueWorkflowName — ชื่อเดิม 'SR Test Flow v2 (with Issue)' ถูกเปลี่ยนบน dev); คลัง TEST-MOVE / TEST-CONSUME ผูก T-01-A; บัญชี requestor@carmen.com และ hod@carmen.com

**Steps**

1. admin POST /store-requisitions (requestor = requestor@carmen.com): T-01-A 1 หน่วย TEST-MOVE → TEST-CONSUME
2. admin PATCH …/submit พร้อม sr_date_pattern = today
3. hod@carmen.com PATCH …/approve ขั้น HOD
4. admin PATCH …/approve stage_role = issue
5. เก็บกวาด: reject ใบที่ค้าง

**Expected**

submit และ approve ได้ (HTTP < 300) ใบลงวันที่วันนี้; การจ่ายถูกปฏิเสธ 422 SR_ISSUE_PERIOD_NOT_CURRENT (งวดของใบไม่ใช่งวด active) และใบยังไม่ completed

> _Note: เดิม A4 (_movement_play specs/26-active-period) · ตัวควบคุม — เกือบซ้ำกับ TC-PE-470004 (เดิม 5.4 ใน 24-new-rules) ตั้งใจคงไว้: ข้อนี้เป็นของชุดงวด active ส่วน 5.4 เป็นของรอบปิดงวด · ผลล่าสุด active-r4-avg 2026-10-02 PASS_

---

## TC-PE-490003 — ใบลดหนี้ลงวันที่วันนี้ (นอกงวด active) ต้องถูกปฏิเสธไม่ลงบัญชี

> **As a** any authenticated user, **I want** this Period Close Active Period behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

E2E_PERIOD_SCENARIO เป็น scenario ของ CARMEN-AVG และวันนี้อยู่นอกงวด active — FIFO ข้าม; Login เป็น admin@carmen.com (movement-setup); มีใบรับ committed ของ C010 ที่มี 11020001 (ใบรับ "E2E A7 expiring …" ของ TC-PE-490007 จากรอบก่อน หรือ GRN260600001)

**Steps**

1. เปิด Credit Note → New ผ่านหน้าจอ อ้างใบรับนั้น คืน 11020001 1 หน่วย
2. Doc Date และ Tax Invoice Date = วันนี้ (เวลาไทย)
3. กด Create แล้ว Submit
4. ถ้ามีใบ: อ่านสถานะ, cn_date และงวดที่ cost layer ลง

**Expected**

หลังบ้านปฏิเสธด้วย CREDIT_NOTE_DATE_NOT_CURRENT_PERIOD (ตอนสร้างหรือตอน submit) และไม่มีใบ completed ที่ลงวันที่นอกงวด active — วันที่บนเอกสารกับงวดบัญชีต้องตรงกันเสมอ

> _Note: เดิม A5 (_movement_play specs/26-active-period) · พิสูจน์ backend PR #724 · เกือบซ้ำกับ TC-PE-440005 (เดิม 2.4 ใน 20-case2: CN ลงวันที่งวดหน้าต้องถูกปฏิเสธ) ตั้งใจคงไว้: ข้อนี้ใช้วันนี้ซึ่งอยู่ในงวดที่สร้างล่วงหน้า · ล้มด้วยเหตุอื่นที่ไม่ใช่เรื่องงวด = FAIL · active-r3-avg FAIL → active-r4-avg PASS (2026-10-02)_

---

## TC-PE-490004 — ใบลดหนี้ลงวันที่ในงวด active ยังสร้างและลงบัญชีได้ตามปกติ

> **As a** any authenticated user, **I want** this Period Close Active Period behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Happy Path

**Preconditions**

E2E_PERIOD_SCENARIO เป็น scenario ของ CARMEN-AVG — FIFO ข้าม; Login เป็น admin@carmen.com (movement-setup); มีใบรับ committed ของ C010 ที่มี 11020001 และยังคืนได้

**Steps**

1. เปิด Credit Note → New ผ่านหน้าจอ อ้างใบรับเดียวกับ TC-PE-490003 คืน 11020001 1 หน่วย
2. Doc Date และ Tax Invoice Date = วันที่ 20 ของงวด active
3. กด Create แล้ว Submit
4. อ่านสถานะ, cn_date และงวดที่ cost layer ลง

**Expected**

ใบเป็น completed, cn_date อยู่ในงวด active และ cost layer ทุกแถวลงงวด active — ด่านใหม่ต้องไม่กันเกิน

> _Note: เดิม A5b (_movement_play specs/26-active-period) · ตัวคุมฝั่งบวกของด่าน #724 · ผลล่าสุด active-r4-avg 2026-10-02 PASS_

---

## TC-PE-490005 — ใบลดหนี้ลงวันที่วันแรกของงวด active (เวลาไทย) ต้องสร้างได้

> **As a** any authenticated user, **I want** this Period Close Active Period behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Edge Case

**Preconditions**

E2E_PERIOD_SCENARIO เป็น scenario ของ CARMEN-AVG — FIFO ข้าม; Login เป็น admin@carmen.com (movement-setup); มีใบรับ saved/committed ที่มี Australian Sirloin (11110003) และยังไม่เคยถูกคืนสินค้านี้

**Steps**

1. หาใบรับล่าสุดที่มี 11110003 และยังไม่มีใบลดหนี้ของสินค้านี้
2. เปิด Credit Note → New ผ่านหน้าจอ อ้างใบรับนั้น คืน Australian Sirloin 1
3. Doc Date และ Tax Invoice Date = วันที่ 1 ของงวด active (เลือกจากปฏิทิน)
4. กด Create แล้ว Submit
5. อ่านสถานะและงวดที่ cost layer ลง

**Expected**

ใบเป็น completed และ cost layer ทุกแถวลงงวด active — วันที่ 1 ตามปฏิทินไทยอยู่ในงวดนี้ (งวดเก็บ start_at เป็น 17:00Z ของวันก่อน)

> _Note: เดิม A5c (_movement_play specs/26-active-period) · บั๊กที่รู้อยู่ (test.fail): ผลล่าสุด active-r4-avg 2026-10-02T15:31Z FAIL — ด่านใหม่ของ #724 ตอบ 422 CREDIT_NOTE_DATE_NOT_CURRENT_PERIOD กับวันที่ 1 ของงวด (ขอบ start_at 17:00Z ของวันก่อน) · ถ้าขึ้น "unexpectedly passed" ให้เอา test.fail ออก_

---

## TC-PE-490006 — สร้างรอบนับ (physical count period) ได้เฉพาะงวด active

> **As a** any authenticated user, **I want** this Period Close Active Period behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Negative

**Preconditions**

E2E_PERIOD_SCENARIO เป็น scenario ของ CARMEN-AVG ที่มีงวดเปิดล่วงหน้าครอบวันนี้ (ไม่ใช่งวด active) — FIFO ข้าม

**Steps**

1. หางวดที่วันนี้ตกอยู่ (ไม่ใช่งวด active)
2. POST /physical-count-periods { period_id: งวดนั้น } — หน้าจอไม่ได้เรียก endpoint นี้
3. ถ้าสร้างได้: DELETE รอบนับนั้นทิ้ง (เก็บกวาด)

**Expected**

ถูกปฏิเสธ HTTP ≥ 400 ("Period is not the active period") — รอบนับเป็นของงวดที่กำลังทำงานเท่านั้น

> _Note: เดิม A6 (_movement_play specs/26-active-period) · พิสูจน์ backend PR #724 · ยิง API อย่างเดียว · active-r3-avg FAIL (สร้างได้) → active-r4-avg PASS 400 (2026-10-02)_

---

## TC-PE-490007 — ตัดของเสียไม่ส่งวันที่ ใบจ่ายออกต้องลงวันที่และลงบัญชีในงวด active

> **As a** any authenticated user, **I want** this Period Close Active Period interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

E2E_PERIOD_SCENARIO เป็น scenario ของ CARMEN-AVG และวันนี้อยู่นอกงวด active — FIFO ข้าม; ผู้ขาย C010, สกุลเงิน THB, ประเภทปรับปรุง "Test stock_out" และคลัง LCX013 มีอยู่

**Steps**

1. ตั้งต้น (ครั้งแรกของงวด active): POST /good-received-notes ลงวันที่ 20 ของงวด active ที่ LCX013: 11020001 3 หน่วย @10 มีวันหมดอายุ (หน้าจอใส่วันหมดอายุไม่ได้) → save → commit
2. POST /wastage-reporting ตัด 1 หน่วยจากบรรทัดของใบรับนั้น โดยไม่ส่ง so_date — ไม่มีหน้าจอเรียก
3. อ่าน Stock Out ที่เกิดขึ้น (so_date, สถานะ) และงวดที่ cost layer ลง

**Expected**

POST สำเร็จ (HTTP < 300) มี Stock Out เกิดขึ้น ลงวันที่ในงวด active และ cost layer ทุกแถวลงงวด active — วันที่บนเอกสารกับงวดบัญชีตรงกัน

> _Note: เดิม A7 (_movement_play specs/26-active-period) · พิสูจน์ backend PR #724 · ยิง API อย่างเดียว · ใบรับที่ตั้งต้นไว้ถูกใช้ต่อใน TC-PE-490003/490004 (รอบถัดไป) · active-r3-avg FAIL (ลงวันนี้แต่ลงบัญชีงวด active) → active-r4-avg PASS (2026-10-02)_

---

## TC-PE-490008 — สร้าง Stock Out / Stock In ไม่ส่งวันที่ ค่าเริ่มต้นต้องอยู่ในงวด active

> **As a** any authenticated user, **I want** this Period Close Active Period behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Low · **Test Type:** Edge Case

**Preconditions**

E2E_PERIOD_SCENARIO เป็น scenario ของ CARMEN-AVG และวันนี้อยู่นอกงวด active — FIFO ข้าม; ประเภทปรับปรุง "Test stock_out" / "Test stock_in" และคลัง LCX013 มีอยู่

**Steps**

1. POST /stock-outs ที่ LCX013: 11020001 1 หน่วย โดยไม่ส่ง so_date
2. POST /stock-ins ที่ LCX013: 11020001 1 หน่วย @10 โดยไม่ส่ง si_date
3. อ่าน so_date / si_date ที่เก็บจาก DB
4. ลบทั้งสองใบทิ้ง (เก็บกวาด)

**Expected**

สร้างได้ทั้งสองใบ (HTTP < 300) และวันที่ที่ระบบเติมให้อยู่ในงวด active

> _Note: เดิม A8 (_movement_play specs/26-active-period) · id ใน results.json = A8-SO / A8-SI · หน้าจอส่งวันที่เสมอ — เคสนี้ API อย่างเดียว · บั๊กที่รู้อยู่ (test.fail): ผลล่าสุด active-r4-avg 2026-10-02T15:30Z FAIL ทั้งคู่ — สร้างได้ 201 แต่ไม่มีวันที่เลย (r3 ก่อน #724: SO 422 / SI commit ไม่ได้) · ถ้าขึ้น "unexpectedly passed" ให้เอา test.fail ออก_

---

## TC-PE-490009 — รายงาน lookup current-period / previous-period ต้องอิงงวด active

> **As a** any authenticated user, **I want** this Period Close Active Period interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

E2E_PERIOD_SCENARIO เป็น scenario ของ CARMEN-AVG หรือ CARMEN-FIFO (ตัวควบคุม); มีงวดที่สร้างล่วงหน้าใหม่กว่างวด active

**Steps**

1. หางวด active และงวดก่อนหน้างวด active จาก tb_inventory_period
2. GET /reports/lookups?types=current-period,previous-period,period (ตัวที่หน้า dialog รายงานเรียก)
3. เทียบ current-period และ previous-period กับกติกา

**Expected**

current-period = งวด active และ previous-period = งวดที่อยู่ก่อนงวด active (ไม่มี = null) — ไม่ใช่งวดใหม่สุดที่สร้างล่วงหน้า

> _Note: เดิม A9 (_movement_play specs/26-active-period) แถว A9a / A9b (id ต่อท้าย -AVG / -FIFO) · แยก A9c ไปเป็น TC-PE-490010 เพื่อไม่ให้ test.fail กลบผลของ A9c ที่ผ่านอยู่ · บั๊กที่รู้อยู่ (test.fail) micro-report#19: ผลล่าสุด 2026-10-02 r4 FAIL ทั้ง AVG (ได้ 2612 / 2611 แทน 2607 / 2606) และ FIFO (ได้ 2612 / 2611 แทน 2611 / 2610) · ถ้าขึ้น "unexpectedly passed" ให้เอา test.fail ออก_

---

## TC-PE-490010 — รายงาน lookup ตัวเลือกงวดต้องเป็นงวดที่ปิดแล้วกับงวด active

> **As a** any authenticated user, **I want** this Period Close Active Period interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

E2E_PERIOD_SCENARIO เป็น scenario ของ CARMEN-AVG หรือ CARMEN-FIFO (ตัวควบคุม); มีงวดที่สร้างล่วงหน้าใหม่กว่างวด active

**Steps**

1. หางวด active และงวดที่ปิดแล้วทั้งหมดจาก tb_inventory_period
2. GET /reports/lookups?types=current-period,previous-period,period
3. เทียบรายการ period (code) กับงวดที่ปิดแล้ว + งวด active เรียงใหม่ไปเก่า

**Expected**

รายการตัวเลือกงวด = งวดที่ปิดแล้วรวมงวด active เรียงจากใหม่ไปเก่า — ไม่มีงวดที่สร้างล่วงหน้า

> _Note: เดิม A9 (_movement_play specs/26-active-period) แถว A9c (id ต่อท้าย -AVG / -FIFO) · แยกจาก TC-PE-490009 (เดิมรวมอยู่ในเคสเดียวและไม่ได้ assert) · ผลล่าสุด 2026-10-02 r4 PASS ทั้ง AVG และ FIFO_

---

## TC-PE-490011 — หัวงวดของรายงาน EOP Checklist ต้องเป็นงวด active

> **As a** any authenticated user, **I want** this Period Close Active Period interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

E2E_PERIOD_SCENARIO เป็น scenario ของ CARMEN-AVG หรือ CARMEN-FIFO (ตัวควบคุม); มีงวดที่สร้างล่วงหน้าใหม่กว่างวด active

**Steps**

1. หางวด active จาก tb_inventory_period
2. SELECT DISTINCT period FROM v_inventory_eop_checklist (view ที่รายงาน EOP Checklist อ่าน)

**Expected**

view คืนอย่างน้อย 1 แถว และทุกแถวมี period = งวด active

> _Note: เดิม A10 (_movement_play specs/26-active-period) · id ใน results.json = A10-AVG / A10-FIFO · บั๊กที่รู้อยู่ (test.fail) แก้ใน SQL PR #723: ผลล่าสุด 2026-10-02 r4 FAIL ทั้ง AVG (ได้ 2612 แทน 2607) และ FIFO (ได้ 2612 แทน 2611) · ถ้าขึ้น "unexpectedly passed" ให้เอา test.fail ออก_

---


<sub>Last regenerated: 2026-11-24 · git f462816</sub>
