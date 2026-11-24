# Ap From Grn — User Stories

_Generated from `tests/805-ap-from-grn.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Ap From Grn
**Spec:** `tests/805-ap-from-grn.spec.ts`
**Default role:** Admin
**Total test cases:** 4 (4 High / 0 Medium / 0 Low)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-APGRN-010001 | สวิตช์เปิด: Commit GRN แล้วได้ AP invoice grn_auto ยอดเท่าบรรทัด GRN และ JV Dr ตามบัญชีของหมวดสินค้า | High | Happy Path |
| TC-APGRN-020001 | สวิตช์ปิด (ค่า default): Commit GRN แล้วไม่มี AP invoice เกิดขึ้น | High | Alternate Flow |
| TC-APGRN-030001 | แก้เลขใบแจ้งหนี้ของ GRN ที่ Commit แล้ว: ใบ grn_auto เดิมถูก void กลับรายการ และออกใบใหม่ยอดเท่าเดิม | High | Alternate Flow |
| TC-APGRN-040001 | หลังเคสทั้งหมด gl_setting.ap_auto_from_grn กลับเป็น false และบัญชีอื่นของ gl_setting ไม่เสียหาย | High | Functional |

---

## TC-APGRN-010001 — สวิตช์เปิด: Commit GRN แล้วได้ AP invoice grn_auto ยอดเท่าบรรทัด GRN และ JV Dr ตามบัญชีของหมวดสินค้า

> **As a** Admin user, **I want** this Ap From Grn behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Happy Path

**Preconditions**

Admin login; TEST BU; GL period และ inventory period เปิดครอบวันนี้; gl_setting.ap_auto_from_grn เปิดเฉพาะในเคสนี้; กลุ่มสินค้าของสินค้าใน GRN มี mapping บัญชี inventory (ตั้ง 1140 ใน beforeAll ถ้ายังไม่มี)

**Steps**

1. สร้าง GRN draft 2 บรรทัด x 3 @ 100.00 (AP, ไม่มีภาษี)
2. เปิดสวิตช์ ap_auto_from_grn
3. Save แล้ว Commit GRN
4. อ่าน AP invoice ของ GRN และ JV ของมัน

**Expected**

GRN เป็น committed; มี AP invoice 1 ใบ doc_source grn_auto, doc_type invoice, สถานะ posted, net = total = 600.00 VAT 0.00 ค้าง 600.00 (3 x 100.00 สองบรรทัด จาก money.ts); JV สมดุล posted; Dr แต่ละบัญชี = ยอดบรรทัดที่ผูกกับบัญชี inventory ของหมวดสินค้าตาม mapping API (300.00 ต่อบรรทัด); Cr 2100 เจ้าหนี้ = 600.00. assumption: ยอด AP = ยอดบรรทัด GRN ที่ไม่มีภาษีและส่วนลด ปัดครึ่งขึ้นที่ 2 ตำแหน่ง

---

## TC-APGRN-020001 — สวิตช์ปิด (ค่า default): Commit GRN แล้วไม่มี AP invoice เกิดขึ้น

> **As a** Admin user, **I want** this Ap From Grn behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Alternate Flow

**Preconditions**

Admin login; TEST BU; gl_setting.ap_auto_from_grn = false (ตั้งในเคสนี้ แล้วคืนค่าเดิม); กลุ่มสินค้ามี mapping inventory

**Steps**

1. สร้าง GRN draft 2 บรรทัด x 3 @ 100.00 (AP)
2. ตั้งสวิตช์ ap_auto_from_grn เป็น false
3. Save แล้ว Commit GRN
4. ค้น AP invoice ของ GRN และค้นด้วยเลข Vendor Invoice

**Expected**

Commit สำเร็จ GRN เป็น committed; ไม่มี AP invoice ผูกกับ GRN (ap_invoices ว่าง, ap_invoices_voided ว่าง) และค้นด้วยเลข invoice ของ GRN ไม่เจอใบ AP. assumption: ไม่มีค่าหรือ false = ปิด (BE facts: mb ap-invoice.service.ts:305)

---

## TC-APGRN-030001 — แก้เลขใบแจ้งหนี้ของ GRN ที่ Commit แล้ว: ใบ grn_auto เดิมถูก void กลับรายการ และออกใบใหม่ยอดเท่าเดิม

> **As a** Admin user, **I want** this Ap From Grn behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Alternate Flow

**Preconditions**

Admin login; TEST BU; ap_auto_from_grn เปิดในเคสนี้; GRN ที่ Commit แล้วมี AP invoice grn_auto 1 ใบ ยังไม่มีการจ่าย

**Steps**

1. สร้าง GRN draft 2 บรรทัด x 3 @ 100.00 เปิดสวิตช์ Save และ Commit
2. แก้ invoice_no ของ GRN (PATCH)
3. อ่านใบ AP ของ GRN (ใช้งานอยู่และที่ void แล้ว) และ JV ของใบเดิม

**Expected**

ใบ grn_auto เดิมเป็น void มี JV กลับรายการ (ผลรวม Dr = Cr ต่อบัญชีหักล้างของเดิมเป็น 0 ทุกบัญชี) และอยู่ใน ap_invoices_voided; มีใบ grn_auto ใบใหม่ 1 ใบ posted ยอด 600.00 ใช้เลข Vendor Invoice ใหม่ของ GRN; ใบ void ไม่นับเป็นใบที่ใช้งานอยู่. อ้างอิง mb ap-invoice.service.ts:393-430 (void จากฝั่ง GRN) และ good-received-note.ap-link.ts (ค่าหัวใบที่ทำให้ออกใหม่). assumption: การ void ของ AP คืนยอดด้วย JV กลับรายการ ไม่แก้ JV เดิม

---

## TC-APGRN-040001 — หลังเคสทั้งหมด gl_setting.ap_auto_from_grn กลับเป็น false และบัญชีอื่นของ gl_setting ไม่เสียหาย

> **As a** Admin user, **I want** this Ap From Grn interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

รันหลังเคส 010001-030001 ของไฟล์นี้ (workers 1 รันตามลำดับไฟล์); Admin login; TEST BU

**Steps**

1. GET /app-config/gl_setting
2. ตรวจ ap_auto_from_grn และบัญชีหลักของ setting

**Expected**

ap_auto_from_grn เป็น false (ค่า default ของ data:reset); ap_control_account_id และ advance_deposit_account_id ยังตั้งอยู่ — withGlSetting คืนค่าเดิมครบแม้เคสก่อนหน้าจะ throw

---


<sub>Last regenerated: 2026-11-24 · git f462816</sub>
