# Interface — Test Cases

_Test-case catalog (documentation only; no automated Playwright spec yet). Authored from the React app module at `routes/system-admin/interface` (registry, list, detail route, page layout, shared fields and the four brand forms), the route table in `routes/router.tsx`, `hooks/use-interface-entitlement.ts`, `hooks/use-app-config.ts`, `components/route-guard.tsx` and the `systemAdmin.interface` block in `messages/en.json`. Follows the TC-ID scheme in `docs/test-id-scheme.md`._

**Module:** Platform / System Admin — Interface
**Frontend route:** `routes/system-admin/interface`  •  **URL:** `/system-admin/interface` และ `/system-admin/interface/:category/:brand`
**Prefix:** `INTF`
**Default role:** Platform Admin (admin@blueledgers.com, active BU = BLAVG)
**Total test cases:** 30

> หมายเหตุสำคัญสำหรับผู้รีวิว:
> 1. **โมดูลนี้เป็น "ที่เก็บค่าคอนฟิก" ล้วน ๆ — ไม่มีปุ่ม sync / test connection และไม่มีการสร้างหรือลบ** ทุก brand มีแถวเดียวใน `tb_application_config` และบันทึกด้วย upsert (`PUT /api/config/:buCode/app-config/interface_<category>_<brand>`) แคตตาล็อกนี้จึงไม่มี section 03 (create) และ 05 (delete)
> 2. **ไม่มี client-side validation ให้ทดสอบ** — zod schema ของทั้งสี่ฟอร์ม (`accountingSchema`, `carmenGlSchema`, `posSchema`, `pmsSchema`) ประกาศช่องข้อความทุกช่องเป็น `z.string()` เปล่า ๆ ไม่มี `.min(1)` / `.url()` และช่อง enum เลือกค่านอกชุดไม่ได้ ดังนั้นจึงไม่มีข้อความ error ใต้ field ที่เกิดขึ้นได้จริงจาก UI — section 20 (validation) จึงไม่ถูกใช้โดยตั้งใจ
> 3. **การมองเห็นทั้งหมดขึ้นกับ license (entitlement) ไม่ใช่ RBAC** — `useInterfaceEntitlement` ต้องพบคีย์ครบสาย `interface`, `interface.<category>`, `interface.<category>.<brand>` ใน license ของ BU ปัจจุบัน ถ้า BU ทดสอบไม่มีคีย์เหล่านี้ **หน้ารายการจะว่าง** และทุก URL รายละเอียดจะขึ้น "Interface not found" เคส 4000xx จึงต้องเตรียมด้วย license fixture ไม่ใช่การสลับ role
> 4. **การล็อกเมื่อสัญญาหมดอายุเป็น client-side เท่านั้น** — คอมเมนต์ใน `interface-page-layout.tsx` ระบุว่า backend ยังไม่มี per-brand gate สำหรับการเขียน (`PUT .../app-config/:key` ตรวจแค่ feature รวม `configuration.app_config`) ห้ามเขียนเคสที่อ้างว่า backend ปฏิเสธการเขียนของ brand ที่หมดอายุ
> 5. **ช่องความลับ (`api_key` / `authorize_token`) ถูก mask จาก backend** — ปล่อยไว้ไม่แตะแล้วกด Save คือการคงค่าเดิม และ environment ต้องตั้ง `SECRET_ENCRYPTION_KEY` ไว้ ไม่งั้นการบันทึกที่มีความลับจะได้ 400
> 6. **บันทึกสำเร็จแล้วหน้าจะเด้งกลับไปหน้ารายการทันที** (`navigate("/system-admin/interface")`) จึงไม่มีเคสที่ยืนยันค่าบนหน้าเดิมหลังกด Save

## Test Cases at a Glance
| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-INTF-010001 | แสดงหน้ารายการ Interface | High | Smoke |
| TC-INTF-010002 | จัดกลุ่มตาม category พร้อมไอคอนและหัวข้อ | High | Functional |
| TC-INTF-010003 | แสดงการ์ด brand ครบตาม registry | Medium | Functional |
| TC-INTF-010004 | badge สถานะ Enabled / Disabled ของแต่ละ brand | High | Functional |
| TC-INTF-010005 | คลิกการ์ด brand แล้วไปหน้ารายละเอียด | High | Happy Path |
| TC-INTF-010006 | โหลดรายการไม่สำเร็จแสดง error state พร้อมปุ่มลองใหม่ | Medium | Negative |
| TC-INTF-020001 | เปิดหน้ารายละเอียดเป็นโหมดอ่านอย่างเดียว | High | Smoke |
| TC-INTF-020002 | หัวข้อและคำอธิบายของหน้าเป็นของ brand ที่เปิด | Medium | Functional |
| TC-INTF-020003 | ฟอร์ม Carmen GL แสดงครบทั้งสี่ section | High | Functional |
| TC-INTF-020004 | ฟอร์ม Accounting ทั่วไปแสดงครบสาม section | Medium | Functional |
| TC-INTF-020005 | ฟอร์ม POS แสดงครบสอง section | Medium | Functional |
| TC-INTF-020006 | ฟอร์ม PMS แสดงครบสอง section | Medium | Functional |
| TC-INTF-020007 | Carmen GL ที่ยังไม่เคยตั้งค่าแสดงค่าตั้งต้น | Medium | Edge Case |
| TC-INTF-040001 | กด Edit เปิดโหมดแก้ไขและปุ่มเปลี่ยนเป็น Cancel / Save | High | CRUD |
| TC-INTF-040002 | บันทึกค่า POS สำเร็จแล้วกลับหน้ารายการ | High | CRUD |
| TC-INTF-040003 | เปิดสวิตช์ Enabled แล้วบันทึก badge ในรายการเปลี่ยน | High | CRUD |
| TC-INTF-040004 | กด Cancel คืนค่าที่บันทึกไว้และออกจากโหมดแก้ไข | Medium | Alternate Flow |
| TC-INTF-040005 | แก้ค้างแล้วคลิกลิงก์ออกจากหน้าเจอ Discard dialog | Medium | Alternate Flow |
| TC-INTF-040006 | Discard dialog กด Keep editing แล้วอยู่หน้าเดิม | Medium | Alternate Flow |
| TC-INTF-040007 | บันทึกนโยบาย sync ผังบัญชีของ Carmen GL | Medium | CRUD |
| TC-INTF-040008 | บันทึกสวิตช์การ post ของ PMS | Medium | CRUD |
| TC-INTF-100001 | ผู้ใช้ที่ไม่มีสิทธิ์ system configuration เข้า URL ตรงไม่ได้ | High | Authorization |
| TC-INTF-100002 | ช่องความลับถูกปิดบังและสลับแสดง / ซ่อนได้ | High | Security |
| TC-INTF-100003 | ไม่แตะช่อง API key แล้วบันทึก ค่าลับเดิมยังอยู่ | Medium | Security |
| TC-INTF-400001 | brand ที่สัญญาหมดอายุมี badge Expired ในรายการ | Medium | Functional |
| TC-INTF-400002 | หน้ารายละเอียดของ brand ที่หมดอายุขึ้นแถบเตือนและปิดปุ่ม Edit | High | Authorization |
| TC-INTF-400003 | brand ที่ BU ไม่ได้ซื้อไม่ปรากฏในรายการ | Medium | Authorization |
| TC-INTF-400004 | BU ที่ไม่มี interface ใดเลยแสดงข้อความว่าง | Medium | Edge Case |
| TC-INTF-900001 | URL category / brand ที่ไม่รู้จักแสดง Interface not found | Medium | Edge Case |
| TC-INTF-900002 | เปิด URL หน้ารายละเอียดตรง ๆ (deep link) ได้ | Low | Edge Case |

---
## TC-INTF-010001 — แสดงหน้ารายการ Interface
**Priority:** High · **Test Type:** Smoke
**Preconditions**
Login เป็น admin@blueledgers.com; active BU = BLAVG; license ของ BU มีคีย์ `interface` และ feature `configuration.app_config`
**Steps**
1. ไปที่ `/system-admin/interface`
2. รอให้หน้าโหลดเสร็จ (skeleton หายไป)
**Expected**
หน้าแสดงหัวข้อ "Interfaces" และคำอธิบาย "Connections between Carmen and your accounting, POS and property systems." โดยไม่มี error state

---
## TC-INTF-010002 — จัดกลุ่มตาม category พร้อมไอคอนและหัวข้อ
**Priority:** High · **Test Type:** Functional
**Preconditions**
อยู่ที่หน้า `/system-admin/interface`; license ของ BU ให้สิทธิ์ครบทั้งสี่ category (accounting / pos / pms / export)
**Steps**
1. รอให้รายการโหลดเสร็จ
2. อ่านหัวข้อของแต่ละกลุ่มบนหน้า
**Expected**
มีสี่กลุ่มเรียงตาม registry คือ "Accounting Interface", "POS Interface", "PMS Interface" และ "Export tools" แต่ละกลุ่มมีไอคอนนำหน้าหัวข้อ

---
## TC-INTF-010003 — แสดงการ์ด brand ครบตาม registry
**Priority:** Medium · **Test Type:** Functional
**Preconditions**
อยู่ที่หน้า `/system-admin/interface`; license ของ BU ให้สิทธิ์ทุก brand ในทั้งสี่ category
**Steps**
1. รอให้รายการโหลดเสร็จ
2. ไล่อ่านชื่อการ์ดในแต่ละกลุ่ม
**Expected**
กลุ่ม Accounting มี "Carmen GL", "BlueLedgers"; กลุ่ม POS มี "Oracle Micros", "Infrasys", "Square"; กลุ่ม PMS มี "Oracle Opera", "Protel"; กลุ่ม Export tools มี "External system" รวม 8 การ์ดใน 4 กลุ่ม

---
## TC-INTF-010004 — badge สถานะ Enabled / Disabled ของแต่ละ brand
**Priority:** High · **Test Type:** Functional
**Preconditions**
อยู่ที่หน้า `/system-admin/interface`; มี brand อย่างน้อยหนึ่งตัวที่เคยบันทึก config ด้วยสวิตช์ Enabled เปิดไว้ และอีกหนึ่งตัวที่ยังไม่เคยตั้งค่า
**Steps**
1. รอให้รายการโหลดเสร็จ
2. ดู badge ทางขวาของการ์ดที่เคยเปิด Enabled ไว้
3. ดู badge ทางขวาของการ์ดที่ยังไม่เคยตั้งค่า
**Expected**
การ์ดที่เปิดไว้แสดง badge "Enabled"; การ์ดที่ยังไม่เคยตั้งค่าหรือปิดไว้แสดง badge "Disabled" (brand ที่ยังไม่มีแถวใน app config ถือเป็น Disabled ไม่ใช่ error)

---
## TC-INTF-010005 — คลิกการ์ด brand แล้วไปหน้ารายละเอียด
**Priority:** High · **Test Type:** Happy Path
**Preconditions**
อยู่ที่หน้า `/system-admin/interface`; เห็นการ์ด "Oracle Micros" ในกลุ่ม POS
**Steps**
1. คลิกการ์ด "Oracle Micros"
**Expected**
นำทางไปที่ `/system-admin/interface/pos/micros` และหน้าแสดงฟอร์มของ POS โดยมีหัวข้อ "Oracle Micros"

---
## TC-INTF-010006 — โหลดรายการไม่สำเร็จแสดง error state พร้อมปุ่มลองใหม่
**Priority:** Medium · **Test Type:** Negative
**Preconditions**
Login เป็น admin@blueledgers.com; สามารถทำให้คำขอ `GET` app config ของ BU ล้มเหลวได้ (เช่น intercept ให้ตอบ 500)
**Steps**
1. ทำให้คำขอรายการ app config ตอบ 500
2. ไปที่ `/system-admin/interface`
3. ดูเนื้อหาบนหน้า
**Expected**
หน้าแสดง error state ข้อความ "Could not load interface settings" พร้อมปุ่ม "Try again" และไม่มีการ์ด brand ใดปรากฏ

---
## TC-INTF-020001 — เปิดหน้ารายละเอียดเป็นโหมดอ่านอย่างเดียว
**Priority:** High · **Test Type:** Smoke
**Preconditions**
Login เป็น admin@blueledgers.com; license ให้สิทธิ์ brand `pos/micros`
**Steps**
1. ไปที่ `/system-admin/interface/pos/micros`
2. รอให้ฟอร์มโหลดเสร็จ
3. ลองพิมพ์ลงในช่อง "Endpoint"
**Expected**
มีปุ่ม "Edit" ปุ่มเดียวที่มุมขวาบน (ไม่มี Save / Cancel) และช่องกรอกทุกช่องถูกปิดใช้งาน พิมพ์ลงไปไม่ได้

---
## TC-INTF-020002 — หัวข้อและคำอธิบายของหน้าเป็นของ brand ที่เปิด
**Priority:** Medium · **Test Type:** Functional
**Preconditions**
Login เป็น admin@blueledgers.com; license ให้สิทธิ์ brand `pms/opera` และ `pos/square`
**Steps**
1. ไปที่ `/system-admin/interface/pms/opera` แล้วอ่านหัวข้อกับคำอธิบายใต้หัวข้อ
2. ไปที่ `/system-admin/interface/pos/square` แล้วอ่านหัวข้อกับคำอธิบายใต้หัวข้อ
**Expected**
หน้าแรกแสดงหัวข้อ "Oracle Opera" กับคำอธิบาย "How city ledger and credit card postings reach receivables from your property system."; หน้าที่สองแสดงหัวข้อ "Square" กับคำอธิบาย "How sales and consumption from your point-of-sale system reach inventory."

---
## TC-INTF-020003 — ฟอร์ม Carmen GL แสดงครบทั้งสี่ section
**Priority:** High · **Test Type:** Functional
**Preconditions**
Login เป็น admin@blueledgers.com; license ให้สิทธิ์ brand `accounting/carmen_gl`
**Steps**
1. ไปที่ `/system-admin/interface/accounting/carmen_gl`
2. รอให้ฟอร์มโหลดเสร็จ แล้วเลื่อนอ่านทั้งหน้า
**Expected**
เห็นสี่ section ตามลำดับ — "Connection" (สวิตช์ Enabled, API server, Authorize token), "Data endpoints" (Account code path, Department path, Vendor path), "Options" (Set account mapping for all items, Allow posting the transfer to GL) และ "Chart of accounts sync" (When a code exists on both sides, Codes that exist only here)

---
## TC-INTF-020004 — ฟอร์ม Accounting ทั่วไปแสดงครบสาม section
**Priority:** Medium · **Test Type:** Functional
**Preconditions**
Login เป็น admin@blueledgers.com; license ให้สิทธิ์ brand `accounting/blueledgers`
**Steps**
1. ไปที่ `/system-admin/interface/accounting/blueledgers`
2. รอให้ฟอร์มโหลดเสร็จ แล้วเลื่อนอ่านทั้งหน้า
**Expected**
เห็นสาม section — "Connection" (สวิตช์ Enabled, Endpoint), "Vendor fallbacks" (Default account code, Default department code, Default invoice value) และ "Posting" (Export format, Posting frequency) โดยไม่มี section ของ Carmen GL ปะปน

---
## TC-INTF-020005 — ฟอร์ม POS แสดงครบสอง section
**Priority:** Medium · **Test Type:** Functional
**Preconditions**
Login เป็น admin@blueledgers.com; license ให้สิทธิ์ brand `pos/infrasys`
**Steps**
1. ไปที่ `/system-admin/interface/pos/infrasys`
2. รอให้ฟอร์มโหลดเสร็จ
3. เปิดตัวเลือกของช่อง "Consumption posting"
**Expected**
เห็น section "Connection" (Enabled, Endpoint, API key) และ "Sync" (Sync frequency, Default location code, Consumption posting); ตัวเลือกของ Consumption posting มีสองค่าคือ "By recipe" และ "Direct to item"

---
## TC-INTF-020006 — ฟอร์ม PMS แสดงครบสอง section
**Priority:** Medium · **Test Type:** Functional
**Preconditions**
Login เป็น admin@blueledgers.com; license ให้สิทธิ์ brand `pms/protel`
**Steps**
1. ไปที่ `/system-admin/interface/pms/protel`
2. รอให้ฟอร์มโหลดเสร็จ แล้วเลื่อนอ่านทั้งหน้า
**Expected**
เห็น section "Connection" (Enabled, Property code, Endpoint, API key) และ "Posting" (สวิตช์ "Post city ledger" และ "Post credit card")

---
## TC-INTF-020007 — Carmen GL ที่ยังไม่เคยตั้งค่าแสดงค่าตั้งต้น
**Priority:** Medium · **Test Type:** Edge Case
**Preconditions**
Login เป็น admin@blueledgers.com; license ให้สิทธิ์ brand `accounting/carmen_gl`; BU ยังไม่เคยบันทึก config คีย์ `interface_accounting_carmen_gl` (หรือ backend คืนค่า default)
**Steps**
1. ไปที่ `/system-admin/interface/accounting/carmen_gl`
2. รอให้ฟอร์มโหลดเสร็จ
3. อ่านค่าที่อยู่ในช่อง Account code path, Department path, Vendor path และสถานะของสวิตช์ทั้งสอง
**Expected**
หน้าไม่ขึ้น error; ค่าตั้งต้นคือ `api/interface/accountCode`, `api/interface/department`, `api/interface/vendor`, สวิตช์ "Set account mapping for all items" เปิดอยู่ และ "Allow posting the transfer to GL" ปิดอยู่

---
## TC-INTF-040001 — กด Edit เปิดโหมดแก้ไขและปุ่มเปลี่ยนเป็น Cancel / Save
**Priority:** High · **Test Type:** CRUD
**Preconditions**
อยู่ที่ `/system-admin/interface/pos/micros` ในโหมดอ่าน; license ของ brand นี้ไม่ใช่สถานะหมดอายุ
**Steps**
1. คลิกปุ่ม "Edit"
2. คลิกที่ช่อง "Endpoint" แล้วพิมพ์ค่า
**Expected**
ปุ่ม "Edit" หายไปและแทนที่ด้วยปุ่ม "Cancel" กับ "Save"; ช่องกรอกทุกช่องใช้งานได้และค่าที่พิมพ์ปรากฏในช่อง

---
## TC-INTF-040002 — บันทึกค่า POS สำเร็จแล้วกลับหน้ารายการ
**Priority:** High · **Test Type:** CRUD
**Preconditions**
Login เป็น admin@blueledgers.com; อยู่ที่ `/system-admin/interface/pos/micros`; environment ตั้ง `SECRET_ENCRYPTION_KEY` ไว้แล้ว
**Steps**
1. คลิก "Edit"
2. กรอก Endpoint เป็น `https://pos.example.com`
3. กรอก "Default location code" เป็น `L1`
4. คลิก "Save"
**Expected**
แสดง toast "Interface settings saved" และหน้าเด้งกลับไปที่ `/system-admin/interface`

---
## TC-INTF-040003 — เปิดสวิตช์ Enabled แล้วบันทึก badge ในรายการเปลี่ยน
**Priority:** High · **Test Type:** CRUD
**Preconditions**
Login เป็น admin@blueledgers.com; brand `pms/opera` ปัจจุบันแสดง badge "Disabled" ในหน้ารายการ
**Steps**
1. เปิด `/system-admin/interface/pms/opera`
2. คลิก "Edit"
3. เปิดสวิตช์ "Enabled"
4. คลิก "Save"
5. รอให้กลับมาที่หน้ารายการ
**Expected**
toast "Interface settings saved" ปรากฏ และเมื่อกลับมาที่หน้ารายการ การ์ด "Oracle Opera" แสดง badge "Enabled"

---
## TC-INTF-040004 — กด Cancel คืนค่าที่บันทึกไว้และออกจากโหมดแก้ไข
**Priority:** Medium · **Test Type:** Alternate Flow
**Preconditions**
อยู่ที่ `/system-admin/interface/pos/micros` และ brand นี้เคยบันทึกค่า "Default location code" ไว้แล้ว
**Steps**
1. จดค่าเดิมของ "Default location code"
2. คลิก "Edit"
3. แก้ "Default location code" เป็นค่าใหม่ที่ต่างออกไป
4. คลิก "Cancel"
**Expected**
กลับเป็นโหมดอ่าน (เหลือปุ่ม "Edit" ปุ่มเดียว) และ "Default location code" กลับไปเป็นค่าเดิมที่จดไว้ ไม่ใช่ค่าว่าง

---
## TC-INTF-040005 — แก้ค้างแล้วคลิกลิงก์ออกจากหน้าเจอ Discard dialog
**Priority:** Medium · **Test Type:** Alternate Flow
**Preconditions**
อยู่ที่ `/system-admin/interface/pos/micros`; มีลิงก์ในเมนู/sidebar ให้คลิกออกจากหน้านี้ได้
**Steps**
1. คลิก "Edit"
2. แก้ค่าในช่อง "Endpoint" ให้ฟอร์มเป็น dirty
3. คลิกลิงก์ไปหน้าอื่น
4. กดปุ่ม "Discard" ใน dialog
**Expected**
ขั้นที่ 3 แสดง dialog หัวข้อ "Discard changes?" พร้อมข้อความ "You have unsaved changes that will be lost." และปุ่ม "Keep editing" / "Discard"; หลังกด "Discard" ออกจากหน้าไปยังปลายทางที่คลิกไว้

---
## TC-INTF-040006 — Discard dialog กด Keep editing แล้วอยู่หน้าเดิม
**Priority:** Medium · **Test Type:** Alternate Flow
**Preconditions**
อยู่ที่ `/system-admin/interface/pos/micros` ในโหมดแก้ไขและแก้ค่าค้างไว้จน dialog "Discard changes?" เปิดขึ้น (ต่อจาก TC-INTF-040005 ขั้นที่ 3)
**Steps**
1. กดปุ่ม "Keep editing"
**Expected**
dialog ปิดลง ยังอยู่ที่ `/system-admin/interface/pos/micros` ในโหมดแก้ไข และค่าที่แก้ค้างไว้ยังอยู่ในช่องเดิม

---
## TC-INTF-040007 — บันทึกนโยบาย sync ผังบัญชีของ Carmen GL
**Priority:** Medium · **Test Type:** CRUD
**Preconditions**
Login เป็น admin@blueledgers.com; license ให้สิทธิ์ brand `accounting/carmen_gl`
**Steps**
1. เปิด `/system-admin/interface/accounting/carmen_gl`
2. คลิก "Edit"
3. ที่ช่อง "When a code exists on both sides" เลือก "Overwrite with Carmen 4"
4. ที่ช่อง "Codes that exist only here" เลือก "Delete them"
5. คลิก "Save"
6. เปิดหน้า `/system-admin/interface/accounting/carmen_gl` อีกครั้ง
**Expected**
toast "Interface settings saved" ปรากฏและเด้งกลับหน้ารายการ; เมื่อเปิดหน้าเดิมซ้ำ ทั้งสองช่องยังคงค่า "Overwrite with Carmen 4" และ "Delete them"

---
## TC-INTF-040008 — บันทึกสวิตช์การ post ของ PMS
**Priority:** Medium · **Test Type:** CRUD
**Preconditions**
Login เป็น admin@blueledgers.com; license ให้สิทธิ์ brand `pms/opera`
**Steps**
1. เปิด `/system-admin/interface/pms/opera`
2. คลิก "Edit"
3. เปิดสวิตช์ "Post city ledger" และ "Post credit card"
4. กรอก "Property code" เป็น `P1`
5. คลิก "Save"
6. เปิดหน้า `/system-admin/interface/pms/opera` อีกครั้ง
**Expected**
toast "Interface settings saved" ปรากฏ; เมื่อเปิดหน้าเดิมซ้ำ สวิตช์ทั้งสองยังเปิดอยู่และ Property code เป็น `P1`

---
## TC-INTF-100001 — ผู้ใช้ที่ไม่มีสิทธิ์ system configuration เข้า URL ตรงไม่ได้
**Priority:** High · **Test Type:** Authorization
**Preconditions**
Login ด้วยผู้ใช้ที่ไม่ใช่ admin และไม่มี permission `system_configuration.view` (เช่น requestor@blueledgers.com) ที่ BU BLAVG
**Steps**
1. พิมพ์ URL `/system-admin/interface` เข้าไปตรง ๆ
**Expected**
`RouteGuard` บล็อกและแสดงกล่อง Permission Denied ("Restricted" / "Permission Denied" / "You don't have permission to view this page." / "Contact your administrator to request access.") พร้อมปุ่มพาไปหน้าที่เข้าได้ โดยไม่แสดงรายการ interface

---
## TC-INTF-100002 — ช่องความลับถูกปิดบังและสลับแสดง / ซ่อนได้
**Priority:** High · **Test Type:** Security
**Preconditions**
อยู่ที่ `/system-admin/interface/pos/micros` ในโหมดแก้ไข (กด "Edit" แล้ว)
**Steps**
1. ดูชนิดของช่อง "API key" และคำอธิบายใต้ช่อง
2. คลิกปุ่มรูปตาที่ชิดขอบขวาในช่อง (aria-label "Show")
3. คลิกปุ่มเดิมอีกครั้ง (aria-label "Hide")
**Expected**
ช่อง "API key" เป็นชนิด password (ค่าถูกปิดบัง) และมี hint "Leave untouched to keep the stored key."; คลิกครั้งแรกเปลี่ยนเป็นข้อความอ่านได้ คลิกซ้ำกลับไปถูกปิดบังเหมือนเดิม

---
## TC-INTF-100003 — ไม่แตะช่อง API key แล้วบันทึก ค่าลับเดิมยังอยู่
**Priority:** Medium · **Test Type:** Security
**Preconditions**
brand `pos/micros` เคยบันทึก API key ไว้แล้ว (backend ส่งค่ากลับมาเป็น mask); environment ตั้ง `SECRET_ENCRYPTION_KEY` ไว้
**Steps**
1. เปิด `/system-admin/interface/pos/micros`
2. คลิก "Edit"
3. แก้เฉพาะช่อง "Default location code" โดยไม่แตะช่อง "API key"
4. คลิก "Save"
5. เปิดหน้าเดิมอีกครั้ง
**Expected**
บันทึกสำเร็จ (toast "Interface settings saved"); เมื่อเปิดหน้าเดิมซ้ำ ช่อง "API key" ยังคงมีค่า mask อยู่ ไม่กลายเป็นช่องว่าง และไม่มีค่าลับตัวจริงปรากฏบนหน้า

---
## TC-INTF-400001 — brand ที่สัญญาหมดอายุมี badge Expired ในรายการ
**Priority:** Medium · **Test Type:** Functional
**Preconditions**
Login เป็น admin@blueledgers.com; license ของ BU ทำให้ brand หนึ่งมี entitlement เป็น `expired` (คีย์ของ brand อยู่ใน `expired_features` หรือ license state เป็น expired/inactive)
**Steps**
1. ไปที่ `/system-admin/interface`
2. ดูการ์ดของ brand ที่สัญญาหมดอายุ
**Expected**
การ์ดนั้นยังปรากฏในรายการ (ไม่ถูกซ่อน) และมี badge "Expired" แสดงอยู่ข้างหน้า badge Enabled/Disabled

---
## TC-INTF-400002 — หน้ารายละเอียดของ brand ที่หมดอายุขึ้นแถบเตือนและปิดปุ่ม Edit
**Priority:** High · **Test Type:** Authorization
**Preconditions**
license ของ BU ทำให้ brand ที่จะเปิดมี entitlement เป็น `expired` (เตรียมด้วย license fixture ตามหมายเหตุข้อ 3)
**Steps**
1. เปิดหน้ารายละเอียดของ brand นั้นจากหน้ารายการ
2. อ่านแถบข้อความด้านบนของหน้า
3. ดูสถานะปุ่ม "Edit"
**Expected**
ด้านบนหน้ามีแถบเตือนข้อความ "The contract granting this interface has expired — read-only until it is renewed" และปุ่ม "Edit" ถูกปิดใช้งาน กดไม่ได้ จึงเข้าโหมดแก้ไขไม่ได้

---
## TC-INTF-400003 — brand ที่ BU ไม่ได้ซื้อไม่ปรากฏในรายการ
**Priority:** Medium · **Test Type:** Authorization
**Preconditions**
Login เป็น admin@blueledgers.com; license ของ BU ไม่มีคีย์ของ brand หนึ่ง (entitlement = `none`) แต่ยังมี brand อื่นใน category เดียวกัน
**Steps**
1. ไปที่ `/system-admin/interface`
2. ไล่ดูการ์ดในกลุ่มของ category นั้น
3. พิมพ์ URL ของ brand ที่ไม่มีสิทธิ์เข้าไปตรง ๆ
**Expected**
brand นั้นไม่ปรากฏเป็นการ์ดเลย (ไม่มี badge บอกเหตุผล) ขณะที่ brand อื่นในกลุ่มยังอยู่; การเปิด URL ตรงแสดงข้อความ "Interface not found"

---
## TC-INTF-400004 — BU ที่ไม่มี interface ใดเลยแสดงข้อความว่าง
**Priority:** Medium · **Test Type:** Edge Case
**Preconditions**
Login เป็นผู้ใช้ที่มี permission `system_configuration.view` แต่ license ของ BU ที่เลือกไม่มีคีย์ `interface` เลย (ทุก brand เป็น `none`) และ feature `configuration.app_config` ยังอยู่ (ไม่งั้นจะถูกบล็อกที่ RouteGuard)
**Steps**
1. ไปที่ `/system-admin/interface`
2. รอให้หน้าโหลดเสร็จ
**Expected**
ไม่มีกลุ่ม category หรือการ์ด brand ใดเลย และหน้าแสดงข้อความ "No interfaces are available for this business unit." โดยไม่ใช่ error state

---
## TC-INTF-900001 — URL category / brand ที่ไม่รู้จักแสดง Interface not found
**Priority:** Medium · **Test Type:** Edge Case
**Preconditions**
Login เป็น admin@blueledgers.com; มีสิทธิ์เข้าหน้า system admin
**Steps**
1. ไปที่ `/system-admin/interface/accounting/not-a-brand`
2. ไปที่ `/system-admin/interface/not-a-category/micros`
**Expected**
ทั้งสอง URL แสดง error state ข้อความ "Interface not found" แบบ inline (ยังมี sidebar/navbar ของแอปอยู่) พร้อมปุ่ม "Back to list" ที่พากลับไป `/system-admin/interface` และปุ่ม "Go to dashboard"

---
## TC-INTF-900002 — เปิด URL หน้ารายละเอียดตรง ๆ (deep link) ได้
**Priority:** Low · **Test Type:** Edge Case
**Preconditions**
Login เป็น admin@blueledgers.com; license ให้สิทธิ์ brand `accounting/carmen_gl`; ยังไม่เคยเปิดหน้ารายการในเซสชันนี้
**Steps**
1. พิมพ์ URL `/system-admin/interface/accounting/carmen_gl` เข้าไปตรง ๆ
2. รอให้ฟอร์มโหลดเสร็จ
**Expected**
หน้าโหลดฟอร์ม Carmen GL ได้โดยไม่ต้องผ่านหน้ารายการ แสดงหัวข้อ "Carmen GL" และอยู่ในโหมดอ่านพร้อมปุ่ม "Edit"
