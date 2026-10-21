# External Price List (Vendor Portal) — Test Cases

_Test-case catalog (documentation only; no automated Playwright spec yet). Authored from the React app module at `routes/external/pl`. Follows the TC-ID scheme in `docs/test-id-scheme.md`._

**Module:** External Price List — public vendor pricing portal (Request for Pricing)
**Frontend route:** `routes/external/pl`  •  **URL:** `/pl/:url_token` (public — ไม่ต้อง login)
**Prefix:** `EPL`
**Default role:** ไม่มี (เปิดผ่าน url token ที่ส่งให้ vendor ภายนอก ไม่ต้อง auth)
**Total test cases:** 42

> หมายเหตุสำคัญสำหรับผู้รีวิว: หัวเอกสารเคยระบุ URL ว่า `/external/pl/:url_token` ตามชื่อโฟลเดอร์ของ route module แต่ path ที่ router ประกาศจริงคือ `/pl/:url_token` (ดู `routes/router.tsx`) — แก้ให้ตรงเมื่อ 2026-09-20 เนื้อหาเทสเคสไม่เปลี่ยน

> **สอบทานรอบ 2026-09-20 (เนื้อหาเทสเคส):** แคตตาล็อกเดิมเขียนไว้ 2026-06-17 หลังจากนั้นโมดูลมี 42 คอมมิต และ UI เปลี่ยนไปมาก รอบนี้สอบทานทุกเคสกับซอร์สปัจจุบันทั้งโฟลเดอร์ (`price-list-external.route.tsx`, `price-list-external-component.tsx`, `-header`, `-product-table`, `-view-table`, `moq-tiers-sub-table`, `-import-dialog`, `-expired`, `-skeleton`, `-excel`, `use-price-list-external.ts`) — สรุปการเปลี่ยนแปลง:
> - **ลบ 7 เคสที่ทดสอบสิ่งที่ไม่มีแล้ว** — `TC-EPL-010005` (view mode เคย group หลาย MOQ ของสินค้าเดียวเป็นแถวเดียว ตอนนี้เป็น 1 แถว/detail และไม่โชว์ tier), `TC-EPL-010006` (view mode ไม่มี pagination/sorting แล้ว — เป็น `<table>` ธรรมดา ส่วน pagination เหลือเฉพาะโหมดกรอกราคา และทุกคอลัมน์ตั้ง `enableSorting: false`), `TC-EPL-200001` (toast "No changes to save" ถูกถอดออกในคอมมิต `48926d3b` — Save Draft กดได้ตลอด), `TC-EPL-200002` (toast "Please save all changes before submitting" ถูกแทนด้วย auto-save ก่อน submit ในคอมมิต `f136b00e`), `TC-EPL-200003` (กฎ disable ปุ่มแบบเดิมไม่มีแล้ว), `TC-EPL-300001`/`TC-EPL-300002` (เคส submit — ย้ายไปบล็อก 04 ตามผังบล็อกใหม่ ดูด้านล่าง)
> - **บล็อก 30 ถูกใช้ใหม่ทั้งบล็อกเป็น Excel integration** (download/import) ซึ่งเป็นฟีเจอร์ที่เพิ่มหลังเขียนแคตตาล็อก (คอมมิต `e7f1b661`) ส่วน submit ย้ายไปอยู่บล็อก 04 = "กรอก/ส่งราคา" · **ไม่ reuse `TC-EPL-300001`/`300002` กับเนื้อหาใหม่** — บล็อก 30 เริ่มที่ `300003` เพื่อไม่ให้ ID เดิมเปลี่ยนความหมาย
> - **เคสใหม่ 27 เคส** ครอบพฤติกรรมที่ยังไม่เคยมีเคส: Excel download/import, confirm dialog ก่อน submit, MOQ tier add/remove, Tax Profile picker, discard guard, skeleton, สถานะ `submitted`, 404 เมื่อไม่มี token
>
> **ข้อเท็จจริงที่พบระหว่างสอบทาน (ไม่ได้เขียนเป็นเคส — บันทึกไว้ให้คนรีวิว):**
> - `price-list-external-import-dialog.tsx` เขียนคำอธิบายว่า *"Rows are matched by the “No.” column"* แต่ `applyExcelRows()` ใน `price-list-external-excel.ts` จับคู่แถวด้วย **`Product Code`** ไม่ใช่ `No.` (คอมเมนต์ในโค้ดระบุชัดว่าเปลี่ยนมาใช้ product_code โดยตั้งใจ เพื่อให้ reorder ไม่พัง) — ข้อความบน dialog ยังไม่ได้ตามแก้ เคส `TC-EPL-300005` จึง assert แค่ว่า dialog แสดงตามที่โค้ดเขียนไว้ ส่วนการจับคู่จริงไป assert ที่ `TC-EPL-300006`/`300009`
> - คอมเมนต์ใน `price-list-external-component.test.tsx` ยังอ้าง guard "No changes" ที่ถูกถอดออกไปแล้ว — เป็นคอมเมนต์ค้าง ไม่ใช่พฤติกรรม
> - `ErrorState` และ dialog ต่าง ๆ ใช้ `useTranslations` (ข้อความมาจาก `messages/en.json`) ขณะที่ตัวหน้า portal hardcode ภาษาอังกฤษ — ข้อความที่อ้างในเคสจึงมาจากสองแหล่ง ระบุไว้ในแต่ละเคสแล้ว
>
> **เคสที่ automate ไม่ได้ถ้าไม่มี token จริงที่ระบบออกให้:** ทั้ง 42 เคสต้องมี `url_token` ที่ backend ออกให้ตอนส่ง RFQ ไปหา vendor — ยกเว้น `TC-EPL-100001` (ใช้ token มั่ว backend ตอบ 401 ได้เลย), `TC-EPL-100003`, `TC-EPL-100004` และ `TC-EPL-900002` ที่ตรวจได้จาก routing อย่างเดียว · ต้องมี fixture ที่ seed price list + สร้าง token ก่อน ไม่งั้นทั้งบล็อก 01/04/20/30/90 รันไม่ได้

> หน้านี้คือฝั่ง **vendor ภายนอก** ของ flow ขอราคา (Request-for-Pricing / Campaign — ดู `1001-campaign`). Carmen Blue ส่งลิงก์พร้อม `url_token` ให้ vendor; vendor เปิดลิงก์ได้โดยไม่ต้อง login (route อยู่นอก `ProtectedShell` ใน `routes/router.tsx`). หน้าเรียก `POST .../check-pricelist/{token}` เพื่อ validate token + ดึงข้อมูล และเรียก tax profile จาก endpoint แยก (`.../tax-profiles`, กรองเฉพาะที่ `is_active`). โครงหน้า: **Header** (eyebrow `Request for Pricing · <pricelist_no>`, ชื่อโรงแรมเป็นหัวข้อใหญ่, ที่อยู่โรงแรม, status badge ตัวพิมพ์ใหญ่, และ meta 4 ช่อง Vendor / Currency / Effective period / Reference) → แถบเครื่องมือ (ปุ่ม **Excel**, **Import**, และปุ่มสลับโหมด **Enter Prices** ↔ **Preview**) → ตาราง. เริ่มต้นที่ **โหมดอ่าน** (read-only table 9 คอลัมน์) กดปุ่ม "Enter Prices" เข้า **โหมดกรอกราคา** (DataGrid แก้ไขได้ + expand ดู MOQ tiers + ปุ่ม **Save Draft** / **Submit**). vendor กรอก **Price แบบรวมภาษี (gross)** ระบบ derive `Price without Tax` และ `Tax Amount` ให้สดจาก tax rate ของ Tax Profile ที่เลือก. Save Draft กดได้ตลอด (ไม่ต้องมีการแก้ไข) สำเร็จขึ้น toast "Draft saved" แล้วกลับโหมดอ่าน; Submit เปิด dialog ยืนยันก่อน ถ้ายังมีการแก้ค้างระบบ save draft ให้เองแล้วค่อย finalize. เมื่อสถานะเป็น `submitted` ปุ่ม Import และปุ่มสลับโหมดจะหายไป เหลือแต่ปุ่ม Excel. token หมดอายุ/ไม่ถูกต้อง (HTTP 401) แสดงหน้า "This link has expired"; error อื่นแสดง `ErrorState` พร้อมปุ่ม Try again.

## Test Cases at a Glance
| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-EPL-010001 | เปิดลิงก์ด้วย url token ที่ถูกต้องโหลดหน้า RFQ | High | Smoke |
| TC-EPL-010002 | Header แสดง Request for Pricing / โรงแรม / สถานะ / meta 4 ช่อง | Medium | Functional |
| TC-EPL-010003 | Header แสดง Instructions และ Note เฉพาะเมื่อมีข้อมูล | Low | Functional |
| TC-EPL-010004 | โหมดเริ่มต้นเป็นโหมดอ่าน พร้อมปุ่ม Excel / Import / Enter Prices | High | Functional |
| TC-EPL-010007 | ตารางโหมดอ่านแสดง 9 คอลัมน์ และคำนวณ Price without Tax / Tax Amount จาก Price | Medium | Functional |
| TC-EPL-010008 | ระหว่างรอข้อมูลแสดง skeleton ของหน้า RFQ | Low | Functional |
| TC-EPL-010009 | price list ที่ submitted แล้วซ่อนปุ่ม Import และปุ่มเข้าโหมดกรอกราคา | High | Functional |
| TC-EPL-040001 | กด "Enter Prices" เข้าโหมดกรอกราคา | High | Functional |
| TC-EPL-040002 | แก้ค่า MOQ / Price / Lead Time ในแถว | High | CRUD |
| TC-EPL-040003 | เมื่อมีการแก้ไขแสดง badge "Unsaved changes" | Medium | Functional |
| TC-EPL-040004 | กด Save Draft สำเร็จแสดง toast "Draft saved" และกลับโหมดอ่าน | High | CRUD |
| TC-EPL-040005 | Save Draft ล้มเหลวแสดงข้อความจาก backend | Medium | Negative |
| TC-EPL-040006 | กาง chevron ดูและแก้ไข MOQ pricing tiers | Medium | Functional |
| TC-EPL-040007 | ปุ่ม + เพิ่ม pricing tier ว่างและกางแถวให้อัตโนมัติ | Medium | Functional |
| TC-EPL-040008 | ลบ pricing tier ต้องยืนยันใน dialog ก่อน | Medium | Functional |
| TC-EPL-040009 | เลือก Tax Profile แล้ว Price without Tax / Tax Amount คำนวณใหม่ | Medium | Functional |
| TC-EPL-040010 | กด Submit เปิด dialog ยืนยัน และกด Cancel แล้วไม่ส่ง | High | Functional |
| TC-EPL-040011 | ยืนยัน Submit สำเร็จแสดง toast และกลับโหมดอ่าน | High | Functional |
| TC-EPL-040012 | Submit ล้มเหลวแสดงข้อความจาก backend | Medium | Negative |
| TC-EPL-040013 | Submit ขณะยังมีการแก้ไขค้าง ระบบบันทึก draft ให้ก่อนแล้วจึงส่ง | High | Alternate Flow |
| TC-EPL-040014 | กด "Preview" กลับโหมดอ่านโดยค่าที่แก้ไว้ยังอยู่ | Medium | Functional |
| TC-EPL-040015 | ตารางโหมดกรอกราคาแบ่งหน้าครั้งละ 10 รายการ | Low | Functional |
| TC-EPL-100001 | เปิดด้วย token หมดอายุ/ไม่ถูกต้อง (401) แสดงหน้า "This link has expired" | High | Security |
| TC-EPL-100002 | error ที่ไม่ใช่ 401 แสดง ErrorState พร้อมปุ่ม Try again | Medium | Negative |
| TC-EPL-100003 | เข้าถึงได้โดยไม่ต้อง login ไม่ redirect ไป /login | High | Auth-guard |
| TC-EPL-100004 | หน้า portal ไม่มี shell ของแอป (ไม่มี sidebar / Modules / เมนูผู้ใช้) | Medium | Security |
| TC-EPL-200004 | ช่อง MOQ / Price / Lead Time เป็น number input ที่มี min = 0 | Low | Validation |
| TC-EPL-200005 | ปุ่ม Save Draft / Submit ถูก disable ขณะกำลังบันทึกหรือส่ง | Medium | Validation |
| TC-EPL-200006 | ออกจากหน้าขณะมีการแก้ไขค้างแสดง dialog "Discard changes?" | Medium | Validation |
| TC-EPL-300003 | กดปุ่ม Excel ดาวน์โหลดไฟล์ price list เป็น .xlsx | High | Functional |
| TC-EPL-300004 | ไฟล์ Excel มีหัวคอลัมน์ครบ 9 ช่อง และ Tax Profile เป็น dropdown | Medium | Functional |
| TC-EPL-300005 | กดปุ่ม Import เปิด dialog "Import from Excel" | Medium | Functional |
| TC-EPL-300006 | Import ไฟล์ที่กรอกแล้วสำเร็จ ค่าเข้าฟอร์มและบันทึกเป็น draft | High | Functional |
| TC-EPL-300007 | Import ไฟล์ที่มีบางแถวจับคู่ไม่ได้ รายงานจำนวนแถวที่ข้าม | Medium | Edge Case |
| TC-EPL-300008 | Import ไฟล์ที่ไม่ใช่ไฟล์ price list แสดง toast ให้ใช้ไฟล์ที่ดาวน์โหลด | Medium | Negative |
| TC-EPL-300009 | Import ไฟล์ของ price list อื่นแสดง toast ว่าไฟล์ไม่ตรงเอกสารนี้ | Medium | Negative |
| TC-EPL-300010 | Import ไฟล์ที่อ่านไม่ได้แสดง toast "Could not read the Excel file" | Low | Negative |
| TC-EPL-900001 | price list ที่ไม่มีรายการสินค้าแสดงตารางว่างโดยไม่ crash | Low | Edge Case |
| TC-EPL-900002 | เปิด `/pl/` โดยไม่มี url_token ได้หน้า 404 ไม่ crash | Low | Edge Case |
| TC-EPL-900003 | สินค้าที่ไม่มีหน่วย/ไม่มี Tax Profile แสดง "—" และคิด Tax Amount เป็น 0.00 | Low | Edge Case |
| TC-EPL-900004 | รายการที่ backend ส่ง moq_qty = 0 ถูกตั้งเป็น 1 ในฟอร์ม | Low | Edge Case |
| TC-EPL-900005 | รายการที่ยังไม่มี tier แสดงข้อความ "No pricing tiers yet." | Low | Edge Case |

---
## TC-EPL-010001 — เปิดลิงก์ด้วย url token ที่ถูกต้องโหลดหน้า RFQ
**Priority:** High · **Test Type:** Smoke
**Preconditions**
มี price list external ที่ใช้งานได้ พร้อม `url_token` ที่ backend ออกให้และยังไม่หมดอายุ
**Steps**
1. เปิด `/pl/<url_token>` ใน browser context ที่ไม่มี session
2. รอจน skeleton หายไป
**Expected**
หน้าโหลดสำเร็จ แสดง Header ของ RFQ (eyebrow `Request for Pricing · <pricelist_no>`) และตารางรายการสินค้าในโหมดอ่าน — ไม่เป็น 404 และไม่ redirect ไป `/login`

---
## TC-EPL-010002 — Header แสดง Request for Pricing / โรงแรม / สถานะ / meta 4 ช่อง
**Priority:** Medium · **Test Type:** Functional
**Preconditions**
เปิดหน้า `/pl/<url_token>` ด้วย token ที่ถูกต้องแล้ว และ price list มีข้อมูลโรงแรม vendor และช่วงวันที่ครบ
**Steps**
1. ดูส่วน Header ด้านบนของการ์ด
**Expected**
- บรรทัดบนสุดเป็น `Request for Pricing · <pricelist_no>`
- หัวข้อใหญ่คือ **ชื่อโรงแรม** (`hotel.name`) ถ้าไม่มีแสดง `—` และถ้ามี `hotel.address` จะแสดงใต้ชื่อ
- มุมขวาบนเป็น status badge ข้อความตัวพิมพ์ใหญ่ทั้งหมด (เช่น `DRAFT`)
- กล่อง meta แสดง 4 ช่อง: **Vendor** (ชื่อ vendor หรือ `—`), **Currency** (`currency_code`), **Effective period** (`yyyy-MM-dd – yyyy-MM-dd`), **Reference** (ชื่อ price list)

---
## TC-EPL-010003 — Header แสดง Instructions และ Note เฉพาะเมื่อมีข้อมูล
**Priority:** Low · **Test Type:** Functional
**Preconditions**
มี price list สองใบเทียบกัน: ใบหนึ่งมีทั้ง `description` และ `note`, อีกใบไม่มีทั้งคู่
**Steps**
1. เปิดใบที่มีค่า แล้วดูส่วนใต้กล่อง meta
2. เปิดใบที่ไม่มีค่า แล้วดูตำแหน่งเดียวกัน
**Expected**
ใบที่มีค่าแสดงบล็อกเพิ่มใต้เส้นคั่น โดย `description` ใช้ป้าย **Instructions** และ `note` ใช้ป้าย **Note**; ใบที่ไม่มีค่าทั้งคู่จะไม่มีบล็อกนี้เลย (ไม่ใช่บล็อกว่าง)

---
## TC-EPL-010004 — โหมดเริ่มต้นเป็นโหมดอ่าน พร้อมปุ่ม Excel / Import / Enter Prices
**Priority:** High · **Test Type:** Functional
**Preconditions**
price list มีรายการสินค้าอย่างน้อย 1 รายการ และสถานะยังไม่ใช่ `submitted`
**Steps**
1. เปิดหน้า `/pl/<url_token>`
2. ดูแถบเครื่องมือเหนือตารางและตัวตาราง
**Expected**
- ข้อความช่วยด้านซ้ายคือ "Items requested for pricing."
- ปุ่มด้านขวาเรียงเป็น **Excel**, **Import**, **Enter Prices**
- ตารางเป็นแบบอ่านอย่างเดียว ไม่มีช่อง input ไม่มีปุ่ม Save Draft / Submit

---
## TC-EPL-010007 — ตารางโหมดอ่านแสดง 9 คอลัมน์ และคำนวณ Price without Tax / Tax Amount จาก Price
**Priority:** Medium · **Test Type:** Functional
**Preconditions**
อยู่ในโหมดอ่าน และมีสินค้าอย่างน้อย 1 รายการที่มี Tax Profile อัตราภาษี > 0
**Steps**
1. ดูหัวตาราง
2. ดูแถวของสินค้าที่มีอัตราภาษี > 0
**Expected**
- หัวตารางเรียงเป็น `#`, `Product`, `Unit`, `MOQ`, `Price`, `Tax Profile`, `Price without Tax`, `Tax Amount`, `Lead Time`
- 1 แถวต่อ 1 รายการ (`tb_pricelist_detail`) — MOQ tiers ไม่ถูกกางในโหมดนี้
- ช่อง Product แสดงชื่อสินค้า และแสดงรหัสสินค้าเป็นบรรทัดรองเมื่อมี
- `Price without Tax` = `Price / (1 + tax_rate/100)` และ `Tax Amount` = `Price − Price without Tax` ปัดทศนิยม 2 ตำแหน่ง แสดงแบบมี 2 ตำแหน่งเสมอ

---
## TC-EPL-010008 — ระหว่างรอข้อมูลแสดง skeleton ของหน้า RFQ
**Priority:** Low · **Test Type:** Functional
**Preconditions**
หน่วง response ของ `check-pricelist/<token>` ให้ช้าพอที่จะสังเกตสถานะกำลังโหลด
**Steps**
1. เปิด `/pl/<url_token>`
2. ดูหน้าจอก่อนข้อมูลกลับมา
**Expected**
แสดง skeleton (คอนเทนเนอร์ `aria-busy="true"` และ `aria-label="Loading request for pricing"`) ประกอบด้วยโครง header, แถบ toggle และ 3 แถวตาราง — ไม่แสดงตารางจริงและไม่แสดง error

---
## TC-EPL-010009 — price list ที่ submitted แล้วซ่อนปุ่ม Import และปุ่มเข้าโหมดกรอกราคา
**Priority:** High · **Test Type:** Functional
**Preconditions**
price list ที่ถูก submit ไปแล้ว (`status = "submitted"`) พร้อม token ที่ยังใช้ได้
**Steps**
1. เปิด `/pl/<url_token>` ของใบที่ submit แล้ว
2. ดูแถบเครื่องมือเหนือตาราง
**Expected**
เหลือเฉพาะปุ่ม **Excel** — ปุ่ม **Import** และปุ่ม **Enter Prices** ไม่ปรากฏ และหน้าค้างอยู่ในโหมดอ่าน (vendor แก้ไขต่อไม่ได้)

---
## TC-EPL-040001 — กด "Enter Prices" เข้าโหมดกรอกราคา
**Priority:** High · **Test Type:** Functional
**Preconditions**
อยู่ในโหมดอ่านของ price list ที่สถานะยังไม่ใช่ `submitted`
**Steps**
1. กดปุ่ม **Enter Prices**
**Expected**
- ข้อความช่วยเปลี่ยนเป็น "Enter your price and tax for each item, then submit."
- ตารางเปลี่ยนเป็น DataGrid แก้ไขได้ คอลัมน์เรียง: ปุ่ม chevron (ไม่มีหัวคอลัมน์), `#`, `Product`, `Unit`, `MOQ`, `Price`, `Tax Profile`, `Price without Tax`, `Tax Amount`, `Lead Time`, `Tiers`
- ใต้ตารางมีปุ่ม **Save Draft** และ **Submit**
- ปุ่มสลับโหมดเปลี่ยนข้อความเป็น **Preview**

---
## TC-EPL-040002 — แก้ค่า MOQ / Price / Lead Time ในแถว
**Priority:** High · **Test Type:** CRUD
**Preconditions**
อยู่ในโหมดกรอกราคา มีสินค้าอย่างน้อย 1 รายการ
**Steps**
1. แก้ค่าในช่อง **Price** ของแถวแรก
2. แก้ค่าในช่อง **MOQ** และ **Lead Time** ของแถวเดียวกัน
**Expected**
ค่าที่พิมพ์ปรากฏในช่องทันทีโดย focus ไม่หลุดระหว่างพิมพ์ ช่อง `Price without Tax` และ `Tax Amount` ของแถวนั้นอัปเดตตาม Price ใหม่ และฟอร์มเปลี่ยนเป็นสถานะ dirty

---
## TC-EPL-040003 — เมื่อมีการแก้ไขแสดง badge "Unsaved changes"
**Priority:** Medium · **Test Type:** Functional
**Preconditions**
อยู่ในโหมดกรอกราคา และยังไม่ได้แก้ค่าใด ๆ
**Steps**
1. ตรวจว่ายังไม่มี badge ใดอยู่ข้างปุ่ม Save Draft
2. แก้ค่าในแถวใดแถวหนึ่ง
**Expected**
ก่อนแก้ไขไม่มี badge; หลังแก้ไขแสดง badge ข้อความ **Unsaved changes** (variant warning) อยู่ซ้ายปุ่ม Save Draft

---
## TC-EPL-040004 — กด Save Draft สำเร็จแสดง toast "Draft saved" และกลับโหมดอ่าน
**Priority:** High · **Test Type:** CRUD
**Preconditions**
อยู่ในโหมดกรอกราคา มีการแก้ไขค้างอยู่ และ backend ตอบ PATCH สำเร็จ
**Steps**
1. แก้ค่าในแถวหนึ่ง
2. กดปุ่ม **Save Draft**
**Expected**
แสดง toast success "Draft saved", badge "Unsaved changes" หายไป, หน้ากลับไปอยู่ **โหมดอ่าน** โดยอัตโนมัติ และค่าที่บันทึกแสดงในตารางโหมดอ่าน

---
## TC-EPL-040005 — Save Draft ล้มเหลวแสดงข้อความจาก backend
**Priority:** Medium · **Test Type:** Negative
**Preconditions**
อยู่ในโหมดกรอกราคา มีการแก้ไขค้าง และบังคับให้ PATCH คืน error (เช่น 400 พร้อม `message`)
**Steps**
1. แก้ค่าแล้วกดปุ่ม **Save Draft**
**Expected**
แสดง toast error ด้วย **ข้อความจาก backend** (ถ้า response ไม่มี `message` ใช้ข้อความสำรอง "Failed to save changes") ขึ้นเพียงใบเดียว, หน้ายังอยู่ในโหมดกรอกราคา และ badge "Unsaved changes" ยังอยู่

---
## TC-EPL-040006 — กาง chevron ดูและแก้ไข MOQ pricing tiers
**Priority:** Medium · **Test Type:** Functional
**Preconditions**
อยู่ในโหมดกรอกราคา และมีสินค้าที่มี MOQ tier อยู่แล้วอย่างน้อย 1 tier
**Steps**
1. กดปุ่ม chevron คอลัมน์แรกของแถวนั้น (`aria-label="Toggle pricing tiers"`)
2. แก้ค่าในช่อง Price ของ tier แรก
**Expected**
แถวกางออกเป็น sub-table ที่มีหัว **MOQ / Price / Lead Time** และปุ่มลบท้ายแต่ละ tier; ไอคอน chevron หมุน 90°; แก้ค่าใน tier ได้โดย focus ไม่หลุด และทำให้ฟอร์มเป็น dirty

---
## TC-EPL-040007 — ปุ่ม + เพิ่ม pricing tier ว่างและกางแถวให้อัตโนมัติ
**Priority:** Medium · **Test Type:** Functional
**Preconditions**
อยู่ในโหมดกรอกราคา และแถวเป้าหมายยังพับอยู่
**Steps**
1. กดปุ่ม `+` ในคอลัมน์ **Tiers** ของแถวนั้น (`aria-label="Add pricing tier"`)
**Expected**
แถวถูกกางออกทันทีและมี tier ใหม่ต่อท้าย โดยค่าเริ่มต้น MOQ = 0, Price = 0, Lead Time = 0 พร้อมให้กรอก และฟอร์มเปลี่ยนเป็น dirty · hover ปุ่มแสดง tooltip "Add pricing tier"

---
## TC-EPL-040008 — ลบ pricing tier ต้องยืนยันใน dialog ก่อน
**Priority:** Medium · **Test Type:** Functional
**Preconditions**
อยู่ในโหมดกรอกราคา แถวถูกกางและมี tier อย่างน้อย 1 รายการ
**Steps**
1. กดปุ่มถังขยะท้าย tier (`aria-label="Remove tier"`)
2. กด Cancel ใน dialog แล้วตรวจว่า tier ยังอยู่
3. กดปุ่มถังขยะอีกครั้งแล้วยืนยันการลบ
**Expected**
เปิด dialog หัวข้อ **"Remove pricing tier"** ข้อความ "Are you sure you want to remove this pricing tier? This can't be undone."; กด Cancel แล้ว tier ยังอยู่ครบ; ยืนยันแล้ว tier นั้นหายไปจาก sub-table และฟอร์มเป็น dirty

---
## TC-EPL-040009 — เลือก Tax Profile แล้ว Price without Tax / Tax Amount คำนวณใหม่
**Priority:** Medium · **Test Type:** Functional
**Preconditions**
อยู่ในโหมดกรอกราคา, แถวมี Price > 0 และ backend มี tax profile ที่ `is_active` อย่างน้อย 2 รายการที่อัตราภาษีต่างกัน
**Steps**
1. เปิด dropdown คอลัมน์ **Tax Profile** ของแถวแรก
2. เลือก tax profile ที่มีอัตราภาษีต่างจากเดิม
**Expected**
dropdown แสดงเฉพาะ tax profile ที่ active; หลังเลือก ชื่อ profile ปรากฏในช่อง และค่า `Price without Tax` / `Tax Amount` ของแถวนั้นคำนวณใหม่ตามอัตราใหม่ทันที (Price ที่ vendor กรอกไม่เปลี่ยน) และฟอร์มเป็น dirty

---
## TC-EPL-040010 — กด Submit เปิด dialog ยืนยัน และกด Cancel แล้วไม่ส่ง
**Priority:** High · **Test Type:** Functional
**Preconditions**
อยู่ในโหมดกรอกราคา
**Steps**
1. กดปุ่ม **Submit** ใต้ตาราง
2. อ่าน dialog แล้วกด **Cancel**
**Expected**
เปิด alert dialog หัวข้อ **"Submit price list?"** ข้อความ "Once submitted, you won’t be able to edit this price list anymore. Any unsaved changes will be saved first." พร้อมปุ่ม Cancel / Submit; กด Cancel แล้ว dialog ปิด ไม่มีการเรียก submit และหน้ายังอยู่ในโหมดกรอกราคา

---
## TC-EPL-040011 — ยืนยัน Submit สำเร็จแสดง toast และกลับโหมดอ่าน
**Priority:** High · **Test Type:** Functional
**Preconditions**
อยู่ในโหมดกรอกราคา ไม่มีการแก้ไขค้าง และ backend ตอบ submit สำเร็จ
**Steps**
1. กดปุ่ม **Submit**
2. กดปุ่ม **Submit** ในกล่องยืนยัน
**Expected**
แสดง toast success "Price list submitted successfully", dialog ปิด และหน้ากลับไปอยู่โหมดอ่าน

---
## TC-EPL-040012 — Submit ล้มเหลวแสดงข้อความจาก backend
**Priority:** Medium · **Test Type:** Negative
**Preconditions**
อยู่ในโหมดกรอกราคา และบังคับให้ endpoint `submit` คืน error (เช่น 401 พร้อม `message`)
**Steps**
1. กด **Submit** แล้วยืนยันใน dialog
**Expected**
แสดง toast error ด้วยข้อความจาก backend (ถ้าไม่มี `message` ใช้ "Failed to submit price list") ขึ้นใบเดียว, หน้าไม่ crash และยังอยู่ในโหมดกรอกราคา

---
## TC-EPL-040013 — Submit ขณะยังมีการแก้ไขค้าง ระบบบันทึก draft ให้ก่อนแล้วจึงส่ง
**Priority:** High · **Test Type:** Alternate Flow
**Preconditions**
อยู่ในโหมดกรอกราคา และมีการแก้ไขที่ยังไม่ได้บันทึก (badge "Unsaved changes" แสดงอยู่)
**Steps**
1. แก้ค่าในแถวใดแถวหนึ่ง
2. กด **Submit** แล้วยืนยันใน dialog
**Expected**
ระบบยิง PATCH บันทึก draft ก่อน 1 ครั้งแล้วจึงเรียก submit (ไม่มี toast เตือนให้ไป Save ก่อน); สำเร็จแล้วแสดง toast "Price list submitted successfully" และกลับโหมดอ่าน — ค่าที่แก้ไว้ถูกบันทึกไปด้วย

---
## TC-EPL-040014 — กด "Preview" กลับโหมดอ่านโดยค่าที่แก้ไว้ยังอยู่
**Priority:** Medium · **Test Type:** Functional
**Preconditions**
อยู่ในโหมดกรอกราคาและเพิ่งแก้ค่า Price ของแถวแรก โดยยังไม่ได้กด Save Draft
**Steps**
1. กดปุ่ม **Preview**
2. ดูค่าในตารางโหมดอ่าน แล้วกด **Enter Prices** กลับมา
**Expected**
ตารางโหมดอ่านแสดงค่าที่เพิ่งแก้ (ยังไม่ได้บันทึกลง backend), กลับเข้าโหมดกรอกราคาแล้วค่ายังอยู่ และ badge "Unsaved changes" ยังแสดงอยู่

---
## TC-EPL-040015 — ตารางโหมดกรอกราคาแบ่งหน้าครั้งละ 10 รายการ
**Priority:** Low · **Test Type:** Functional
**Preconditions**
price list มีรายการสินค้ามากกว่า 10 รายการ และอยู่ในโหมดกรอกราคา
**Steps**
1. ดูแถบ pagination ใต้ตาราง
2. กดไปหน้าถัดไป
3. เปลี่ยนจำนวนแถวต่อหน้าเป็นค่าอื่นจากตัวเลือก
**Expected**
ตารางแสดงครั้งละ 10 แถวเป็นค่าเริ่มต้น, แถบ pagination บอกช่วงแถวและจำนวนรวม, กดเปลี่ยนหน้าได้ และเลือกจำนวนแถวต่อหน้าจากตัวเลือก 5 / 10 / 25 / 50 / 100 ได้ (โหมดอ่านไม่มีแถบนี้)

---
## TC-EPL-100001 — เปิดด้วย token หมดอายุ/ไม่ถูกต้อง (401) แสดงหน้า "This link has expired"
**Priority:** High · **Test Type:** Security
**Preconditions**
มี `url_token` ที่หมดอายุ ถูกใช้ไปแล้ว หรือไม่มีอยู่จริง (backend คืน HTTP 401)
**Steps**
1. เปิด `/pl/<expired_token>`
**Expected**
แสดงหน้าเฉพาะ: ไอคอนลิงก์ขาดในวงกลม, หัวข้อ **"This link has expired"**, ข้อความ "It may have expired or already been used. Contact the hotel that sent it for a new link." · ไม่แสดงข้อมูล price list, ไม่มีปุ่ม retry และระบบไม่ retry คำขอซ้ำเมื่อเจอ 401

---
## TC-EPL-100002 — error ที่ไม่ใช่ 401 แสดง ErrorState พร้อมปุ่ม Try again
**Priority:** Medium · **Test Type:** Negative
**Preconditions**
บังคับให้ `check-pricelist/<token>` คืน error ที่ไม่ใช่ 401 (เช่น 500 หรือ network error)
**Steps**
1. เปิด `/pl/<url_token>`
2. รอจน retry ครบแล้วดูหน้าจอ
3. กดปุ่ม **Try again**
**Expected**
แสดง `ErrorState` หัวข้อ "Something went wrong" พร้อมข้อความ error ที่ได้รับและปุ่ม **Try again**; กดแล้วระบบ refetch ข้อมูลใหม่

---
## TC-EPL-100003 — เข้าถึงได้โดยไม่ต้อง login ไม่ redirect ไป /login
**Priority:** High · **Test Type:** Auth-guard
**Preconditions**
browser context สะอาด ไม่มี session; มี `url_token` ที่ถูกต้อง
**Steps**
1. เปิด `/pl/<url_token>` โดยไม่ login
**Expected**
หน้าแสดง price list ตามปกติ URL ยังเป็น `/pl/<url_token>` และ **ไม่** ถูก redirect ไป `/login` (route ประกาศไว้นอก `ProtectedShell`)

---
## TC-EPL-100004 — หน้า portal ไม่มี shell ของแอป (ไม่มี sidebar / Modules / เมนูผู้ใช้)
**Priority:** Medium · **Test Type:** Security
**Preconditions**
เปิด `/pl/<url_token>` ด้วย token ที่ถูกต้องใน context ที่ไม่มี session
**Steps**
1. สำรวจทั้งหน้า มองหา sidebar, ปุ่ม Modules, ตัวเลือก business unit และเมนูผู้ใช้/avatar
**Expected**
ไม่พบองค์ประกอบของ shell ภายในเลย — หน้ามีเฉพาะการ์ด RFQ (header + แถบเครื่องมือ + ตาราง) บนพื้นหลังเต็มจอ vendor ภายนอกจึงไม่มีทางเข้าถึงเมนูของระบบจากหน้านี้

---
## TC-EPL-200004 — ช่อง MOQ / Price / Lead Time เป็น number input ที่มี min = 0
**Priority:** Low · **Test Type:** Validation
**Preconditions**
อยู่ในโหมดกรอกราคา มีสินค้าอย่างน้อย 1 รายการ
**Steps**
1. ตรวจ attribute ของช่อง MOQ, Price, Lead Time ในแถวแรก
2. ตรวจ attribute ของช่อง MOQ, Price, Lead Time ใน MOQ tier sub-table ของแถวที่กางไว้
**Expected**
ทุกช่องเป็น `type="number"` และมี `min="0"`; ช่อง MOQ/Price ใช้ `inputMode="decimal"` ส่วน Lead Time ใช้ `inputMode="numeric"`; placeholder เป็น `0` สำหรับ MOQ/Lead Time และ `0.00` สำหรับ Price

---
## TC-EPL-200005 — ปุ่ม Save Draft / Submit ถูก disable ขณะกำลังบันทึกหรือส่ง
**Priority:** Medium · **Test Type:** Validation
**Preconditions**
อยู่ในโหมดกรอกราคา และหน่วง response ของ PATCH / submit ให้ช้าพอสังเกตได้
**Steps**
1. กด **Save Draft** แล้วดูสถานะปุ่มทั้งสองระหว่างรอ response
2. หลังบันทึกเสร็จ กลับเข้าโหมดกรอกราคาแล้วกด **Submit** และยืนยัน จากนั้นดูปุ่มในกล่องยืนยัน
**Expected**
- ระหว่างบันทึก: ปุ่ม Save Draft เปลี่ยนข้อความเป็น "Saving..." และถูก disable, ปุ่ม Submit ถูก disable ด้วย
- ระหว่างส่ง: ปุ่ม Submit ใต้ตารางแสดง "Submitting..." และถูก disable, ปุ่มในกล่องยืนยันแสดง "Submitting…" พร้อม disable ทั้ง Cancel และ Submit (ปิด dialog ระหว่างนี้ไม่ได้)
- เมื่อไม่ได้อยู่ระหว่างทำงาน ปุ่ม Save Draft กดได้เสมอแม้ยังไม่มีการแก้ไข

---
## TC-EPL-200006 — ออกจากหน้าขณะมีการแก้ไขค้างแสดง dialog "Discard changes?"
**Priority:** Medium · **Test Type:** Validation
**Preconditions**
อยู่ในโหมดกรอกราคาและมีการแก้ไขที่ยังไม่ได้บันทึก
**Steps**
1. แก้ค่าในแถวหนึ่ง
2. กดปุ่ม Back ของเบราว์เซอร์
3. กด **Keep editing**
4. กด Back อีกครั้งแล้วกด **Discard**
**Expected**
กด Back แล้วเปิด dialog เตือนหัวข้อ **"Discard changes?"** ข้อความ "You have unsaved changes that will be lost." พร้อมปุ่ม **Keep editing** / **Discard**; เลือก Keep editing แล้วยังอยู่หน้าเดิมและค่าที่แก้ยังอยู่; เลือก Discard แล้วจึงออกจากหน้าไป

---
## TC-EPL-300003 — กดปุ่ม Excel ดาวน์โหลดไฟล์ price list เป็น .xlsx
**Priority:** High · **Test Type:** Functional
**Preconditions**
เปิดหน้า `/pl/<url_token>` ด้วย token ที่ถูกต้อง และมีรายการสินค้าอย่างน้อย 1 รายการ
**Steps**
1. กดปุ่ม **Excel** บนแถบเครื่องมือ
**Expected**
เบราว์เซอร์ดาวน์โหลดไฟล์ชื่อ `<pricelist_no>_<YYYY-MM-DD>.xlsx` (ถ้าไม่มี `pricelist_no` ใช้ `price-list`) · ปุ่มนี้ใช้ได้ทั้งโหมดอ่านและโหมดกรอกราคา และทุกสถานะรวมถึง `submitted`

---
## TC-EPL-300004 — ไฟล์ Excel มีหัวคอลัมน์ครบ 9 ช่อง และ Tax Profile เป็น dropdown
**Priority:** Medium · **Test Type:** Functional
**Preconditions**
ดาวน์โหลดไฟล์จาก TC-EPL-300003 แล้ว และ backend มี tax profile ที่ active อย่างน้อย 1 รายการ
**Steps**
1. เปิดไฟล์ที่ดาวน์โหลด
2. ตรวจชื่อ sheet และแถวหัวตาราง
3. คลิกเซลล์คอลัมน์ Tax Profile ของแถวข้อมูล
**Expected**
- sheet ชื่อ **Price List**, แถวแรกเป็นหัวตารางตัวหนาเรียง: `No.`, `Product Code`, `Product Name`, `Unit`, `MOQ Qty`, `Price`, `Tax Profile`, `Lead Time (days)`, `Note`
- 1 แถวต่อ 1 รายการสินค้า และค่าที่ส่งออกเป็นค่าปัจจุบันในฟอร์ม (รวมที่แก้แล้วยังไม่บันทึก)
- เซลล์คอลัมน์ Tax Profile มี data validation แบบ list ให้เลือกจากรายชื่อ tax profile จริง และเตือนเมื่อพิมพ์ค่านอกรายการ

---
## TC-EPL-300005 — กดปุ่ม Import เปิด dialog "Import from Excel"
**Priority:** Medium · **Test Type:** Functional
**Preconditions**
เปิดหน้าด้วย token ที่ถูกต้อง และสถานะยังไม่ใช่ `submitted`
**Steps**
1. กดปุ่ม **Import**
**Expected**
เปิด dialog หัวข้อ **"Import from Excel"** พร้อมคำอธิบาย "Drag & drop your filled file here, or click to browse. Rows are matched by the “No.” column and saved as a draft." และ dropzone ข้อความ "Drop Excel file or click to browse" กำกับด้วย ".xlsx, .xls" · ช่องเลือกไฟล์รับเฉพาะ `.xlsx,.xls`
_(หมายเหตุ: คำอธิบายบน dialog บอกว่าจับคู่ด้วยคอลัมน์ "No." แต่โค้ดจับคู่ด้วย `Product Code` — ดูคำเตือนหัวเอกสาร เคสนี้ตรวจเฉพาะว่า dialog แสดงตามที่ออกแบบไว้)_

---
## TC-EPL-300006 — Import ไฟล์ที่กรอกแล้วสำเร็จ ค่าเข้าฟอร์มและบันทึกเป็น draft
**Priority:** High · **Test Type:** Functional
**Preconditions**
มีไฟล์ที่ดาวน์โหลดจากหน้านี้แล้วแก้ค่า Price / MOQ Qty / Lead Time / Tax Profile ของสินค้าบางรายการ โดย `Product Code` ยังตรงกับรายการในเอกสาร และ backend ตอบ PATCH สำเร็จ
**Steps**
1. กด **Import** แล้วเลือกไฟล์ (หรือลากไฟล์มาวางบน dropzone)
**Expected**
dialog ปิดทันทีที่เลือกไฟล์, แสดง toast success "Imported N item(s) ... and saved as draft" ตามจำนวนแถวที่จับคู่ได้, หน้ากลับไปโหมดอ่าน และตารางแสดงค่าที่ import มา (`Price without Tax` / `Tax Amount` คำนวณใหม่ตาม Tax Profile ที่ระบุในไฟล์) · ช่องที่เว้นว่างในไฟล์คงค่าเดิมไว้

---
## TC-EPL-300007 — Import ไฟล์ที่มีบางแถวจับคู่ไม่ได้ รายงานจำนวนแถวที่ข้าม
**Priority:** Medium · **Test Type:** Edge Case
**Preconditions**
มีไฟล์ที่ดาวน์โหลดจากหน้านี้ แล้วเพิ่มแถวที่ `Product Code` ไม่มีอยู่ในเอกสาร 1–2 แถว โดยยังมีแถวที่จับคู่ได้อย่างน้อย 1 แถว
**Steps**
1. กด **Import** แล้วเลือกไฟล์นั้น
**Expected**
แสดง toast success ที่ระบุทั้งจำนวนที่ import สำเร็จและจำนวนแถวที่ถูกข้าม (รูปแบบ "Imported N items, M row(s) skipped and saved as draft"), แถวที่จับคู่ได้อัปเดตค่า ส่วนแถวที่จับคู่ไม่ได้ไม่ถูกเพิ่มเข้าเอกสาร

---
## TC-EPL-300008 — Import ไฟล์ที่ไม่ใช่ไฟล์ price list แสดง toast ให้ใช้ไฟล์ที่ดาวน์โหลด
**Priority:** Medium · **Test Type:** Negative
**Preconditions**
มีไฟล์ .xlsx ที่เปิดอ่านได้แต่ไม่มีหัวคอลัมน์ `Product Code` หรือ `Price`
**Steps**
1. กด **Import** แล้วเลือกไฟล์นั้น
**Expected**
แสดง toast error "This doesn’t look like a price list file. Please use the downloaded Excel." และไม่มีการเรียก PATCH — ค่าปัจจุบันในเอกสารไม่เปลี่ยน

---
## TC-EPL-300009 — Import ไฟล์ของ price list อื่นแสดง toast ว่าไฟล์ไม่ตรงเอกสารนี้
**Priority:** Medium · **Test Type:** Negative
**Preconditions**
มีไฟล์ที่ดาวน์โหลดจาก price list **ใบอื่น** ซึ่งมีหัวคอลัมน์ครบแต่ `Product Code` ทุกแถวไม่ตรงกับสินค้าในเอกสารปัจจุบันเลย
**Steps**
1. กด **Import** แล้วเลือกไฟล์นั้น
**Expected**
แสดง toast error "This file doesn’t match this price list." และไม่มีการเรียก PATCH — ค่าปัจจุบันในเอกสารไม่เปลี่ยน

---
## TC-EPL-300010 — Import ไฟล์ที่อ่านไม่ได้แสดง toast "Could not read the Excel file"
**Priority:** Low · **Test Type:** Negative
**Preconditions**
มีไฟล์ที่เปลี่ยนนามสกุลเป็น .xlsx แต่เนื้อในไม่ใช่ workbook (เช่น ไฟล์ข้อความหรือรูป)
**Steps**
1. กด **Import** แล้วเลือกไฟล์นั้น
**Expected**
แสดง toast error "Could not read the Excel file", หน้าไม่ crash, ไม่มีการเรียก PATCH และหน้ายังอยู่ในโหมดเดิม

---
## TC-EPL-900001 — price list ที่ไม่มีรายการสินค้าแสดงตารางว่างโดยไม่ crash
**Priority:** Low · **Test Type:** Edge Case
**Preconditions**
price list ที่เปิดมี `tb_pricelist_detail` เป็น array ว่าง
**Steps**
1. เปิดหน้า `/pl/<url_token>`
2. กด **Enter Prices** เข้าโหมดกรอกราคา
**Expected**
Header แสดงตามปกติ; โหมดอ่านแสดงเฉพาะหัวตาราง 9 คอลัมน์โดยไม่มีแถวข้อมูล; โหมดกรอกราคาแสดง empty state ของ DataGrid และ **ไม่แสดงแถบ pagination** (record count = 0) — หน้าไม่ crash

---
## TC-EPL-900002 — เปิด `/pl/` โดยไม่มี url_token ได้หน้า 404 ไม่ crash
**Priority:** Low · **Test Type:** Edge Case
**Preconditions**
ไม่มี
**Steps**
1. เปิด `/pl/` (ไม่มีค่า segment ของ `:url_token`)
**Expected**
route `/pl/:url_token` ไม่แมตช์ จึงตกไปที่ route `*` และแสดงหน้า 404 (ตัวเลข 404 ขนาดใหญ่ + ปุ่มกลับ dashboard) — ไม่มี error ระดับ runtime และไม่มีการเรียก `check-pricelist`

---
## TC-EPL-900003 — สินค้าที่ไม่มีหน่วย/ไม่มี Tax Profile แสดง "—" และคิด Tax Amount เป็น 0.00
**Priority:** Low · **Test Type:** Edge Case
**Preconditions**
price list มีสินค้าที่ `unit_name` ว่างและยังไม่ได้กำหนด Tax Profile (`tax_rate` = 0)
**Steps**
1. ดูแถวนั้นในโหมดอ่าน
2. กด **Enter Prices** แล้วดูแถวเดียวกัน
**Expected**
- โหมดอ่าน: คอลัมน์ Unit และ Tax Profile แสดง `—`, `Price without Tax` เท่ากับ `Price` และ `Tax Amount` เป็น `0.00`
- โหมดกรอกราคา: ช่อง Unit แสดง `—`, dropdown Tax Profile แสดง placeholder `—` และค่า PWT / Tax Amount เป็นค่าเดียวกับโหมดอ่าน

---
## TC-EPL-900004 — รายการที่ backend ส่ง moq_qty = 0 ถูกตั้งเป็น 1 ในฟอร์ม
**Priority:** Low · **Test Type:** Edge Case
**Preconditions**
price list มีรายการที่ backend ส่ง `moq_qty` เป็น 0 (หรือค่าว่าง)
**Steps**
1. เปิดหน้า แล้วกด **Enter Prices**
2. ดูช่อง MOQ ของแถวนั้น
**Expected**
ช่อง MOQ แสดงค่า **1** (ฟอร์ม normalize ค่า 0 เป็น 1 ตอน reset ข้อมูล) และค่านี้จะถูกส่งไปพร้อม payload เมื่อกด Save Draft

---
## TC-EPL-900005 — รายการที่ยังไม่มี tier แสดงข้อความ "No pricing tiers yet."
**Priority:** Low · **Test Type:** Edge Case
**Preconditions**
อยู่ในโหมดกรอกราคา และมีสินค้าที่ยังไม่มี MOQ tier เลย
**Steps**
1. กด chevron ของแถวนั้นเพื่อกางดู
**Expected**
sub-table แสดงหัวคอลัมน์ MOQ / Price / Lead Time และข้อความ **"No pricing tiers yet."** แทนแถว tier; ฟอร์มยังไม่เป็น dirty จากการกางแถวเพียงอย่างเดียว
