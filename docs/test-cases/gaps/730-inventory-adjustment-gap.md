# Inventory Adjustment — Gap Report

_เคสที่ **สเปกอัตโนมัติยังไม่ครอบ** — โมดูลนี้มีสเปกแล้วคือ `tests/731-inventory-adjustment.spec.ts` (ชุดหลัก บน TEST BU ด้วยบัญชี Admin: section 70 = Stock In, 71 = Stock Out; ย้ายมาจาก 730 doc-flow เดิม) และ `tests/732-inventory-adjustment-stock.spec.ts` (section 80/81/82 สต๊อก ต้นทุน และผลของการ void) ซึ่งเดินวงจรเอกสาร draft → ดู → แก้ → ลบ → Commit และตรวจผลในหลังบ้าน แต่ยังไม่ครอบเคสด้านล่างนี้ (หน้า list, ตัวกรอง, validation, void, สิทธิ์ ฯลฯ) — แคตตาล็อกเดิม: สอบทานกับโค้ดจริงเมื่อ 2026-09-20 จากโมดูล `routes/inventory-management/inventory-adjustment` (`ia-component.tsx`, `use-ia-table.tsx`, `ia-card.tsx`, `ia-form.tsx`, `ia-form-hero.tsx`, `ia-doc-info.tsx`, `ia-item-fields.tsx`, `use-ia-item-table.tsx`, `ia-summary.tsx`, `ia-form-schema.ts`, `use-inventory-adjustment.ts`) + `constant/inventory-adjustment.ts`, `constant/module-list.ts`, `components/route-guard.tsx`, `components/list-filter/list-toolbar.tsx`, `messages/en.json`. Follows the TC-ID scheme in `docs/test-id-scheme.md`._

**Module:** Inventory Management — Inventory Adjustment
**Frontend route:** `routes/inventory-management/inventory-adjustment`  •  **URL:** `/inventory-management/inventory-adjustment` (และ `/inventory-management/inventory-adjustment/new`, `/inventory-management/inventory-adjustment/:id`)
**Prefix:** `IADJ` (ชุดเดียวกับสเปก — gap report ใช้ prefix ของสเปก)
**Spec ที่ครอบวงจรเอกสาร:** `tests/731-inventory-adjustment.spec.ts` (TC-IADJ-70xxxx / 71xxxx) · สต๊อก/ต้นทุน/void: `tests/732-inventory-adjustment-stock.spec.ts` (TC-IADJ-80xxxx / 81xxxx / 82xxxx)
**Default role:** Admin (admin@blueledgers.com, active BU = BLAVG)
**Total test cases:** 60

> หมายเหตุสำคัญสำหรับผู้รีวิว: แคตตาล็อกฉบับก่อน (2026-06-17) ล้าสมัยไปมาก เพราะโมดูลนี้ถูกแก้ 72 คอมมิตหลังจากนั้น จุดที่ **เปลี่ยนจริงและกระทบเทสเดิม** มีดังนี้
>
> 1. **ไม่มี sidebar สรุปข้างขวาแล้ว** — ของเดิมโชว์ Status / Date / Reason / Location / Lines / Total Qty / กล่อง posting ซ้ำกับ hero ถูกถอดทิ้งใน `198d83c1` เหลือเป็นแถบท้ายจอ `SummaryFooterBar` ที่มี **Grand Total อย่างเดียว** + ปุ่ม Void / Commit
> 2. **บันทึกแล้วไม่เด้งกลับหน้ารายการอีกต่อไป** (`128380f9`) — Save อยู่กับใบเดิมแล้วสลับกลับเป็นโหมด view ส่วน Create พาไปที่ `/{id}?type=...` ด้วย `replace` · เฉพาะ Delete / Void / Commit เท่านั้นที่พากลับหน้า list
> 3. **มีปุ่ม Commit** (`d8f45fcf`, `128380f9`) — ปิดเอกสารเข้าสต๊อกจริง ต้องยืนยันผ่าน ConfirmDialog ก่อน และ validate ให้ผ่านก่อนเปิดกล่องยืนยัน
> 4. **กติกา qty เปลี่ยน** (`e4b06e37`) — เดิม min = 1 ปัจจุบัน **min = 0 และใส่ทศนิยมได้** (แถวใหม่เริ่มที่ 0 จงใจ ไม่ให้ขึ้น error ทันทีที่กดเพิ่มรายการ) เทสเคสเดิม `TC-IADJ-200004` ที่ยืนยันว่า qty = 0 ต้องขึ้น error จึงถูก **ลบทิ้ง**
> 5. **ปุ่ม Add Item ไม่ถูก disable เมื่อยังไม่เลือก Location อีกต่อไป** (`1f0f1f1a`) — กดได้ แต่ขึ้น toast เตือน `"Choose a store before adding items"` แทน · และแถวใหม่ถูก **prepend ไว้บนสุด** พร้อมเปิดช่องเลือกสินค้าให้อัตโนมัติ
> 6. **cost auto-fill ใช้กับทั้ง stock-in และ stock-out** (`e246abaa`) — ไม่ใช่เฉพาะ stock-in เหมือนเดิม (คอลัมน์ Cost/Unit ยังถูกซ่อนในตารางของ stock-out อยู่ แต่ค่ายังถูกเติมเบื้องหลัง)
> 7. **ลบเอกสารไม่ต้องกด Edit ก่อน** (`ed37e6b0`) — ปุ่ม Delete แสดงในโหมด view ด้วย (เงื่อนไขคือ "มีใบอยู่จริง และยังไม่ read-only") ส่วน **Void ยังต้องเข้าโหมด Edit ก่อน** เพราะเงื่อนไขคือ `isEdit && !isReadOnly`
> 8. **ลำดับคอลัมน์ในตารางสลับ** — ปัจจุบันเป็น … Items → **Status → Total** (ของเดิมเขียน Total ก่อน Status) · Status เปลี่ยนจาก Badge เป็น `StatusIconLabel` (ไอคอน + ข้อความ) ตาม `0e6ea3fe` · เพิ่มคอลัมน์ Created / Updated ที่ **ซ่อนไว้เป็นค่าเริ่มต้น** (`c2c4ff3f`, `7e1b9178`)
> 9. **ปุ่มบนหัวหน้า list เปลี่ยนหน้าตาและข้อความ** (`f2842c3b`) — จากปุ่มทึบเขียว/แดง "Stock In"/"Stock Out" เป็นปุ่ม `outline` ข้อความ **"Add Stock In" / "Add Stock Out"** โดยสีเหลือไว้ที่ไอคอนจุดเดียว
> 10. **ตัวกรองแยกเป็นสอง URL param** — `filter` เก็บสถานะ, `adj_type` เก็บชนิด (ของเดิมปนกันใน `filter` ตัวเดียว) และลิงก์เก่าถูกแยกให้อัตโนมัติครั้งเดียวตอน mount · desktop เปลี่ยนจาก filter sheet เป็น **popover menu สองชั้น** (`251be8fc`) ส่วนมือถือยังเป็น bottom sheet
> 11. **ของใหม่บนแถบเครื่องมือ** — Saved View selector, เมนู Sort, เมนูเลือกคอลัมน์ (`3b12e568`), ปุ่ม Print, เมนู Activity ท้ายแถว (`cc37c779`) และแผง **Inventory Information** แบบ dialog เต็มตัวที่มีแท็บ Lots / Movements ในแถวรายการสินค้า (`fc074315`)
>
> **เรื่องสิทธิ์:** `constant/module-list.ts` ผูกหน้านี้ไว้กับ `PERMISSIONS.inventory_management.view` + license feature `inventory_management.inventory_adjustment` · `RouteGuard` **ไม่ redirect** เมื่อไม่มีสิทธิ์ แต่แสดงกล่อง `AccessDeniedBlock` (`role="alert"`) คาที่ URL เดิม · ส่วนคนที่ยังไม่ล็อกอินโดน `RequireAuth` เด้งไป `/login` · ไม่มี role ชื่อ "Inventory Controller" ใน `tests/test-users.ts` จึงเปลี่ยน default role ในหัวเอกสารเป็น Admin ตามมาตรฐานของ suite นี้
>
> **สิ่งที่เทสเคสในเอกสารนี้ยืนยัน** คือ UI ปรากฏและทำงานตามที่โค้ดปัจจุบันเขียนไว้ ไม่ได้ล็อกสภาพชั่วคราวใด ๆ ไว้เป็นข้อกำหนด

## Test Cases at a Glance
| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-IADJ-010001 | หน้า list Inventory Adjustment โหลดสำเร็จ | High | Smoke |
| TC-IADJ-010002 | ปุ่ม Add Stock In / Add Stock Out บนหัวหน้ารายการ | High | Smoke |
| TC-IADJ-010003 | คอลัมน์ตารางแสดงครบและเรียงตามที่กำหนด | Medium | Functional |
| TC-IADJ-010004 | ค้นหาด้วยเลขที่เอกสาร | Medium | Functional |
| TC-IADJ-010005 | ค้นหาคำที่ไม่มีต้องแสดง empty state | Medium | Negative |
| TC-IADJ-010006 | ตัวกรอง Type (Stock In / Stock Out) | Medium | Functional |
| TC-IADJ-010007 | ตัวกรอง Status (Draft / In Progress / Completed / Voided) | Medium | Functional |
| TC-IADJ-010008 | แถบ chip ของตัวกรองและปุ่ม Clear All | Medium | Functional |
| TC-IADJ-010009 | สลับ List View / Grid View บน desktop | Low | Functional |
| TC-IADJ-010010 | เมนู ⋯ บนมือถือมี Export และ Print | Low | Functional |
| TC-IADJ-010011 | ปุ่ม Print บนหัวหน้ารายการ | Low | Functional |
| TC-IADJ-010012 | เมนู Sort บนแถบเครื่องมือ | Low | Functional |
| TC-IADJ-010013 | เมนูเลือกคอลัมน์ และคอลัมน์ Created/Updated ที่ซ่อนไว้ | Medium | Functional |
| TC-IADJ-010014 | ลบเอกสารจากเมนูท้ายแถวในหน้า list | High | CRUD |
| TC-IADJ-010015 | เมนู Activity ท้ายแถวเปิดแผงประวัติ | Low | Functional |
| TC-IADJ-010016 | บันทึกและเรียกใช้ Saved View ของหน้ารายการ | Low | Functional |
| TC-IADJ-010050 | active BU = BLAVG | High | Smoke |
| TC-IADJ-020001 | คลิกเลขที่เอกสารเปิดหน้า detail ในโหมด view | High | Smoke |
| TC-IADJ-020002 | หน้า detail แสดง Document Information และแถบ Grand Total | Medium | Functional |
| TC-IADJ-020003 | เปิด detail โดยไม่มี `?type` ต้องแจ้ง invalid type | Medium | Negative |
| TC-IADJ-020004 | เปิด id ที่ไม่มีอยู่จริงต้องแจ้ง not found พร้อมทางกลับ | Medium | Negative |
| TC-IADJ-020005 | เอกสารสถานะ Completed / Voided เป็น read-only | High | Functional |
| TC-IADJ-020006 | ปุ่ม Print ของเอกสารแสดงเฉพาะโหมด view | Low | Functional |
| TC-IADJ-020007 | ปุ่ม Activity บนหัวเอกสารเปิดแผงประวัติ | Low | Functional |
| TC-IADJ-020008 | ปุ่มย้อนกลับพากลับหน้า list เสมอ | Medium | Functional |
| TC-IADJ-020009 | ตารางรายการในโหมด view แสดงค่าอย่างเดียว ไม่มีช่องกรอก | Medium | Functional |
| TC-IADJ-030001 | เปิดหน้า new Stock In สำเร็จ | High | Smoke |
| TC-IADJ-030002 | สร้าง Stock In (date/reason/location + 1 รายการ) สำเร็จ — ครอบแล้วโดย 731 (TC-IADJ-700002, 2 รายการ) | High | CRUD |
| TC-IADJ-030003 | สร้าง Stock Out สำเร็จ และตารางไม่มีคอลัมน์ Cost/Unit — สร้างครอบแล้วโดย 731 (TC-IADJ-710002); ส่วนคอลัมน์ Cost/Unit ยังไม่ตรวจ | High | CRUD |
| TC-IADJ-030004 | เพิ่มรายการได้หลายแถว และสินค้าที่เลือกแล้วไม่ซ้ำ | Medium | Functional |
| TC-IADJ-030005 | ลบรายการผ่านกล่อง Remove Item | Medium | Functional |
| TC-IADJ-030006 | เลือกสินค้าแล้ว Cost/Unit กับ Total Cost ถูกเติมอัตโนมัติ | Medium | Functional |
| TC-IADJ-030007 | กด Add Item ก่อนเลือก Location ต้องขึ้น toast เตือน | Medium | Negative |
| TC-IADJ-030008 | เปิด `/new` โดยไม่มี `?type` ต้องแจ้ง invalid type | Medium | Negative |
| TC-IADJ-030009 | ออกจากฟอร์มที่ยังไม่บันทึกต้องถามยืนยันก่อน | Medium | Alternate Flow |
| TC-IADJ-030050 | สร้าง Inventory Adjustment ภายใต้ BU BLAVG สำเร็จ | High | CRUD |
| TC-IADJ-040001 | แก้ Description ของเอกสาร Draft แล้วบันทึกสำเร็จ — ครอบแล้วโดย 731 (TC-IADJ-700004 / 710004) | High | CRUD |
| TC-IADJ-040050 | ค่าที่แก้ยังอยู่หลังโหลดหน้าใหม่ | High | CRUD |
| TC-IADJ-050001 | ลบเอกสาร Draft จากหน้า detail — ครอบแล้วโดย 731 (TC-IADJ-700005 / 710005) | High | CRUD |
| TC-IADJ-060001 | Void เอกสารพร้อมระบุเหตุผล | High | Functional |
| TC-IADJ-060002 | Commit เอกสารเพื่อปิดเข้าสต๊อก — ครอบบางส่วนโดย 731 (TC-IADJ-700006 / 710006 commit จากหน้า new) และ 732 (สต๊อก/ต้นทุน) | High | Functional |
| TC-IADJ-060003 | กด Commit ขณะฟอร์มยังไม่ผ่าน validation | Medium | Negative |
| TC-IADJ-100001 | ผู้ใช้ที่ไม่มีสิทธิ์เปิด URL ตรง ๆ ต้องเจอกล่องไม่มีสิทธิ์ | High | Authorization |
| TC-IADJ-100002 | ผู้ที่ยังไม่ล็อกอินเปิด URL ตรง ๆ ต้องถูกพาไป /login | High | Auth-guard |
| TC-IADJ-200001 | บันทึกโดยไม่เลือก Location | High | Validation |
| TC-IADJ-200002 | บันทึกโดยไม่เลือก Reason | High | Validation |
| TC-IADJ-200003 | บันทึกโดยไม่มีรายการสินค้า | High | Validation |
| TC-IADJ-200005 | ช่องวันที่ถูกจำกัดอยู่ในช่วง period ปัจจุบัน | Medium | Validation |
| TC-IADJ-200006 | qty ติดลบต้องแสดง error | Medium | Validation |
| TC-IADJ-200007 | Description พิมพ์ได้ไม่เกิน 256 ตัวอักษร | Low | Validation |
| TC-IADJ-200008 | Cost/Unit ติดลบต้องแสดง error | Medium | Validation |
| TC-IADJ-200009 | แถวที่ยังไม่เลือกสินค้าต้องแสดง error | Medium | Validation |
| TC-IADJ-300001 | Export รายการเป็นไฟล์ xlsx | Medium | Functional |
| TC-IADJ-300002 | Export ขณะไม่มีข้อมูลต้องเตือนแทนการดาวน์โหลด | Low | Negative |
| TC-IADJ-300003 | แผง Inventory Information ของรายการสินค้า (Lots / Movements) | Medium | Functional |
| TC-IADJ-900001 | มือถือแสดงเป็นการ์ดและโหลดเพิ่มแบบ infinite scroll | Low | Edge Case |
| TC-IADJ-900002 | Grid View บน desktop ก็ใช้ infinite scroll ไม่มี pagination | Low | Edge Case |
| TC-IADJ-900003 | ลิงก์เก่าที่รวม type กับ status ไว้ใน `filter` ถูกแยกให้อัตโนมัติ | Medium | Edge Case |
| TC-IADJ-900004 | พิมพ์คำค้นแล้วยังไม่กด Enter รายการต้องไม่เปลี่ยน | Low | Edge Case |
| TC-IADJ-900005 | ออกจากฟอร์มผ่านเมนู sidebar ขณะยังไม่บันทึก | Medium | Edge Case |

---
## TC-IADJ-010001 — หน้า list Inventory Adjustment โหลดสำเร็จ
**Priority:** High · **Test Type:** Smoke
**Preconditions**
เข้าสู่ระบบเป็น Admin (admin@blueledgers.com); active BU = BLAVG; BU มี license `inventory_management.inventory_adjustment`
**Steps**
1. ไปที่ `/inventory-management/inventory-adjustment`
**Expected**
URL คงเป็น `/inventory-management/inventory-adjustment`; หัวหน้ารายการแสดงไอคอนโมดูล + หัวข้อ "Inventory Adjustment" + คำอธิบาย "Stock added or taken out without a purchase or a sale — breakage, found stock, staff use."; มี badge จำนวนรวมต่อท้ายหัวข้อเมื่อจำนวน > 0; แถบเครื่องมือ (ช่องค้นหา / Saved View / Filter) และตารางแสดงภายใน 10 วินาที

---
## TC-IADJ-010002 — ปุ่ม Add Stock In / Add Stock Out บนหัวหน้ารายการ
**Priority:** High · **Test Type:** Smoke
**Preconditions**
เข้าสู่ระบบเป็น Admin; อยู่ที่หน้า list บนจอ desktop
**Steps**
1. ไปที่ `/inventory-management/inventory-adjustment`
2. ตรวจปุ่มฝั่งขวาของหัวหน้ารายการ
3. กดปุ่ม "Add Stock In"
4. ย้อนกลับมาหน้า list แล้วกดปุ่ม "Add Stock Out"
**Expected**
ปุ่ม "Add Stock In" และ "Add Stock Out" เป็นปุ่มแบบ outline (ไม่ใช่ปุ่มทึบสี) โดยมีสีอยู่ที่ไอคอนเท่านั้น — Add Stock In ใช้ไอคอน PackagePlus สีเขียว, Add Stock Out ใช้ไอคอน PackageMinus สีแดง; กด Add Stock In ไปที่ `/inventory-management/inventory-adjustment/new?type=stock-in` และ Add Stock Out ไปที่ `.../new?type=stock-out`

---
## TC-IADJ-010003 — คอลัมน์ตารางแสดงครบและเรียงตามที่กำหนด
**Priority:** Medium · **Test Type:** Functional
**Preconditions**
เข้าสู่ระบบเป็น Admin; มีเอกสารอย่างน้อย 1 ใบ; อยู่ใน List View บน desktop
**Steps**
1. ไปที่ `/inventory-management/inventory-adjustment`
2. ตรวจหัวคอลัมน์ของตารางจากซ้ายไปขวา
**Expected**
ตารางแสดงคอลัมน์ตามลำดับ: checkbox เลือกแถว, `#`, Adjustment, Date, Type, Location, Reason, Items, **Status**, **Total**, และคอลัมน์ปุ่ม ⋯ ท้ายแถว; คอลัมน์ Type แสดงเป็น badge ข้อความ "STOCK IN" / "STOCK OUT" พร้อมไอคอนทิศทาง; คอลัมน์ Status แสดงเป็นไอคอน + ข้อความ (Draft / In Progress / Completed / Voided); คอลัมน์ Total แสดงจำนวนเงินตามด้วยรหัสสกุลเงินตั้งต้นของ BU

---
## TC-IADJ-010004 — ค้นหาด้วยเลขที่เอกสาร
**Priority:** Medium · **Test Type:** Functional
**Preconditions**
เข้าสู่ระบบเป็น Admin; มีเอกสารอย่างน้อย 1 ใบ
**Steps**
1. ไปที่ `/inventory-management/inventory-adjustment`
2. พิมพ์เลขที่เอกสารลงในช่องค้นหา แล้วกด Enter (หรือกดปุ่มแว่นขยายท้ายช่อง)
**Expected**
รายการถูกกรองให้เหลือเฉพาะที่ตรงกับคำค้น; ปุ่มท้ายช่องเปลี่ยนเป็นกากบาทสำหรับล้างคำค้น และกดแล้วรายการกลับมาครบ

---
## TC-IADJ-010005 — ค้นหาคำที่ไม่มีต้องแสดง empty state
**Priority:** Medium · **Test Type:** Negative
**Preconditions**
เข้าสู่ระบบเป็น Admin; อยู่ที่หน้า list
**Steps**
1. ไปที่ `/inventory-management/inventory-adjustment`
2. พิมพ์คำค้นที่ไม่มีอยู่จริง เช่น `zzzzz999` แล้วกด Enter
**Expected**
ตารางไม่มีแถวข้อมูล และแสดง empty state แทน

---
## TC-IADJ-010006 — ตัวกรอง Type (Stock In / Stock Out)
**Priority:** Medium · **Test Type:** Functional
**Preconditions**
เข้าสู่ระบบเป็น Admin; มีเอกสารทั้ง stock-in และ stock-out; ใช้งานบน desktop
**Steps**
1. ไปที่ `/inventory-management/inventory-adjustment`
2. กดปุ่ม Filter แล้วเลื่อนไปที่ field "Type" ในหมวดเอกสาร
3. เลือกค่า "Stock In"
**Expected**
เมนู filter บน desktop เปิดเป็น popover สองชั้น (รายชื่อ field ชั้นแรก ตัวเลือกเด้งเป็น submenu); เลือกแล้วมีผลทันทีโดยไม่ต้องกดยืนยัน; URL มี query `adj_type` (แยกจาก `filter` ที่เก็บสถานะ); ตารางเหลือเฉพาะแถวที่มี badge "STOCK IN" และมี chip ของตัวกรองปรากฏในแถบด้านล่างแถบเครื่องมือ

---
## TC-IADJ-010007 — ตัวกรอง Status (Draft / In Progress / Completed / Voided)
**Priority:** Medium · **Test Type:** Functional
**Preconditions**
เข้าสู่ระบบเป็น Admin; มีเอกสารหลายสถานะ
**Steps**
1. ไปที่ `/inventory-management/inventory-adjustment`
2. กดปุ่ม Filter แล้วเปิด field "Status"
3. เลือก "Completed"
**Expected**
ตัวเลือกที่เปิดให้เลือกมีครบสี่ค่า: In Progress, Completed, Draft, Voided; เลือก Completed แล้วตารางเหลือเฉพาะแถวสถานะ Completed; URL มี query `filter` ที่เก็บ clause ของ `doc_status`

---
## TC-IADJ-010008 — แถบ chip ของตัวกรองและปุ่ม Clear All
**Priority:** Medium · **Test Type:** Functional
**Preconditions**
เข้าสู่ระบบเป็น Admin; อยู่ที่หน้า list
**Steps**
1. ตั้งตัวกรอง Type และ Status อย่างละหนึ่งค่า
2. กดที่ตัว chip ของ Type ในแถบตัวกรองที่ใช้งานอยู่
3. กดปุ่มกากบาทบน chip ของ Status
4. กด Clear All
**Expected**
แถบตัวกรองแสดง chip ของแต่ละ field ที่ตั้งไว้ พร้อมปุ่มกากบาทแยกต่างหาก; กดที่ตัว chip เปิด popover ตัวเลือกของ field นั้นให้แก้ค่าได้ทันที; กดกากบาทลบเฉพาะ chip นั้น; กด Clear All ล้างตัวกรองทั้งหมดและแถบ chip หายไป รายการกลับมาแสดงครบ

---
## TC-IADJ-010009 — สลับ List View / Grid View บน desktop
**Priority:** Low · **Test Type:** Functional
**Preconditions**
เข้าสู่ระบบเป็น Admin; ใช้งานบนหน้าจอ desktop
**Steps**
1. ไปที่ `/inventory-management/inventory-adjustment`
2. กดปุ่มสลับเป็น Grid View (ไอคอนตาราง) ท้ายแถบเครื่องมือ
3. กดกลับเป็น List View (ไอคอนรายการ)
**Expected**
Grid View แสดงเป็นการ์ดเรียงเป็นกริด (1 / 2 / 3 คอลัมน์ตามความกว้างจอ) แต่ละการ์ดมีเลขที่เอกสารเป็นหัวการ์ด และแถว Status / Date / Type / Reason / Location / Items / Total พร้อมแถวข้อมูล audit ท้ายการ์ด; List View กลับมาเป็นตารางเดิมโดยข้อมูลชุดเดียวกันยังแสดงอยู่

---
## TC-IADJ-010010 — เมนู ⋯ บนมือถือมี Export และ Print
**Priority:** Low · **Test Type:** Functional
**Preconditions**
เข้าสู่ระบบเป็น Admin; ใช้งานบน viewport ขนาด mobile
**Steps**
1. เปิด `/inventory-management/inventory-adjustment` บนมือถือ
2. กดปุ่มไอคอน ⋯ (aria-label ของเมนูการกระทำเพิ่มเติม) ที่หัวหน้ารายการ
**Expected**
ปุ่ม Export และ Print แบบเต็มไม่แสดงบนมือถือ แต่ย้ายเข้าไปอยู่ในเมนู ⋯ แทน โดยมีรายการ Export และ Print; ปุ่ม Add Stock In / Add Stock Out ยังแสดงบนหัวหน้ารายการตามปกติ

---
## TC-IADJ-010011 — ปุ่ม Print บนหัวหน้ารายการ
**Priority:** Low · **Test Type:** Functional
**Preconditions**
เข้าสู่ระบบเป็น Admin; อยู่ที่หน้า list บน desktop
**Steps**
1. ไปที่ `/inventory-management/inventory-adjustment`
2. ตรวจว่ามีปุ่ม "Print" พร้อมไอคอนเครื่องพิมพ์ถัดจากปุ่ม Export
**Expected**
ปุ่ม Print แสดงบน desktop (ซ่อนบนมือถือ) และกดแล้วเรียกหน้าต่างพิมพ์ของเบราว์เซอร์ โดยคอลัมน์ checkbox และคอลัมน์ปุ่มท้ายแถวถูกซ่อนในผลลัพธ์การพิมพ์

---
## TC-IADJ-010012 — เมนู Sort บนแถบเครื่องมือ
**Priority:** Low · **Test Type:** Functional
**Preconditions**
เข้าสู่ระบบเป็น Admin; อยู่ที่หน้า list บน desktop; มีเอกสารมากกว่า 1 ใบ
**Steps**
1. ไปที่ `/inventory-management/inventory-adjustment`
2. กดปุ่ม Sort ฝั่งขวาของแถบเครื่องมือ
3. เลือกคอลัมน์ที่เรียงได้ เช่น Adjustment แล้วกดซ้ำอีกครั้ง
4. เลือกแถว Default
**Expected**
เมนูแสดงเฉพาะคอลัมน์ที่เรียงได้ (Adjustment, Date, Items, Total, Created, Updated — Location / Reason / Status ปิดการเรียงไว้); กดคอลัมน์ซ้ำสลับทิศขึ้น/ลง และค่าที่เลือกถูกเขียนลง URL; แถว Default ล้างการเรียงกลับเป็นค่าตั้งต้นของหน้า

---
## TC-IADJ-010013 — เมนูเลือกคอลัมน์ และคอลัมน์ Created/Updated ที่ซ่อนไว้
**Priority:** Medium · **Test Type:** Functional
**Preconditions**
เข้าสู่ระบบเป็น Admin; อยู่ที่หน้า list บน desktop
**Steps**
1. ไปที่ `/inventory-management/inventory-adjustment`
2. ตรวจว่าตารางไม่มีคอลัมน์ Created และ Updated
3. กดปุ่มเลือกคอลัมน์ (ไอคอนสามคอลัมน์) ฝั่งขวาของแถบเครื่องมือ
4. ติ๊กเปิด Created และ Updated
**Expected**
ค่าเริ่มต้นของตารางซ่อนคอลัมน์ Created และ Updated ไว้; เมนูเลือกคอลัมน์แสดงรายชื่อคอลัมน์พร้อมเครื่องหมายถูกที่ตรงกับสถานะจริง; ติ๊กเปิดแล้วคอลัมน์ Created / Updated ปรากฏในตารางพร้อมวันที่-เวลาและชื่อผู้ดำเนินการ

---
## TC-IADJ-010014 — ลบเอกสารจากเมนูท้ายแถวในหน้า list
**Priority:** High · **Test Type:** CRUD
**Preconditions**
เข้าสู่ระบบเป็น Admin; มีเอกสารสถานะ Draft อย่างน้อย 1 ใบ; สัญญาของ BU ยังไม่หมดอายุ (เขียนข้อมูลได้)
**Steps**
1. ไปที่ `/inventory-management/inventory-adjustment`
2. กดปุ่ม ⋯ ท้ายแถวของเอกสาร Draft
3. เลือก Delete
4. ยืนยันในกล่อง Delete Inventory Adjustment
**Expected**
กล่องยืนยันหัวข้อ "Delete Inventory Adjustment" พร้อมข้อความอ้างเลขที่เอกสารนั้น; ยืนยันแล้วขึ้น toast "Inventory Adjustment deleted successfully" และแถวหายไปจากรายการโดยไม่ต้องเปิดหน้า detail

---
## TC-IADJ-010015 — เมนู Activity ท้ายแถวเปิดแผงประวัติ
**Priority:** Low · **Test Type:** Functional
**Preconditions**
เข้าสู่ระบบเป็น Admin; มีเอกสารอย่างน้อย 1 ใบ
**Steps**
1. ไปที่ `/inventory-management/inventory-adjustment`
2. กดปุ่ม ⋯ ท้ายแถว
3. เลือกเมนู Activity
**Expected**
แผงประวัติ (activity sheet) เปิดขึ้นโดยอ้างถึงเลขที่เอกสารของแถวนั้น; ปิดแผงแล้วกลับมาที่รายการเดิมโดยตัวกรอง/คำค้นไม่ถูกล้าง

---
## TC-IADJ-010016 — บันทึกและเรียกใช้ Saved View ของหน้ารายการ
**Priority:** Low · **Test Type:** Functional
**Preconditions**
เข้าสู่ระบบเป็น Admin; อยู่ที่หน้า list บน desktop
**Steps**
1. ตั้งตัวกรอง Type = Stock In และเรียงตาม Date
2. เปิดเมนู Filter แล้วกด "Save Current View" (หรือปุ่มบันทึกมุมมองในเมนู view)
3. ตั้งชื่อ view แล้วบันทึก
4. ล้างตัวกรองทั้งหมด แล้วเลือก view ที่เพิ่งบันทึกจากปุ่มเลือก view
**Expected**
กล่องบันทึกมุมมองเปิดขึ้นและรับชื่อได้; หลังบันทึก ชื่อ view ปรากฏบนปุ่มเลือก view; เลือก view ที่บันทึกไว้แล้วตัวกรองและการเรียงกลับมาตามที่บันทึก

---
## TC-IADJ-010050 — active BU = BLAVG
**Priority:** High · **Test Type:** Smoke
**Preconditions**
เข้าสู่ระบบเป็น Admin; active BU ถูกตั้งเป็น BLAVG
**Steps**
1. ไปที่ `/inventory-management/inventory-adjustment`
2. ตรวจตัวบ่งชี้ business unit ที่ active บนแถบด้านบน/โปรไฟล์
**Expected**
Active business unit คือ BLAVG; รายการที่แสดงเป็นข้อมูลของ BU BLAVG เท่านั้น (query ถูกยิงด้วย buCode ของ BU ที่ active และจะไม่ยิงเลยถ้ายังไม่มี buCode)

---
## TC-IADJ-020001 — คลิกเลขที่เอกสารเปิดหน้า detail ในโหมด view
**Priority:** High · **Test Type:** Smoke
**Preconditions**
เข้าสู่ระบบเป็น Admin; มีเอกสารสถานะ Draft อย่างน้อย 1 ใบ
**Steps**
1. ไปที่ `/inventory-management/inventory-adjustment`
2. คลิกเลขที่เอกสารในคอลัมน์ Adjustment
**Expected**
ไปที่ `/inventory-management/inventory-adjustment/{id}?type=stock-in` (หรือ `stock-out` ตามชนิดของใบ); หน้าเปิดในโหมด view — หัวเอกสารแสดงไอคอนชนิดใบ, เลขที่เอกสารเป็นหัวข้อ, ไอคอน+ข้อความสถานะ และปุ่ม Edit / Delete / Activity / Print; ไม่มีช่องกรอกที่แก้ไขได้

---
## TC-IADJ-020002 — หน้า detail แสดง Document Information และแถบ Grand Total
**Priority:** Medium · **Test Type:** Functional
**Preconditions**
เข้าสู่ระบบเป็น Admin; เปิดเอกสารที่มีรายการสินค้าอย่างน้อย 1 แถวในโหมด view
**Steps**
1. เปิดหน้า detail ของเอกสาร
2. ตรวจ section "Document Information"
3. ตรวจแถบสรุปท้ายจอ
**Expected**
section "Document Information" (คำอธิบาย "Date, reason, location and a note for this adjustment.") แสดงค่า Date, Reason, Location และ Description เป็นข้อความอ่านอย่างเดียว; **ไม่มี sidebar สรุปข้างขวาแล้ว** — ท้ายจอเป็นแถบสรุปที่มีเฉพาะ "Grand Total" (ผลรวม Total Cost ของทุกแถว ทศนิยม 2 ตำแหน่ง) พร้อมรหัสสกุลเงินตั้งต้น

---
## TC-IADJ-020003 — เปิด detail โดยไม่มี `?type` ต้องแจ้ง invalid type
**Priority:** Medium · **Test Type:** Negative
**Preconditions**
เข้าสู่ระบบเป็น Admin; มี id ของเอกสารที่มีอยู่จริง
**Steps**
1. เปิด `/inventory-management/inventory-adjustment/{id}` โดยไม่ใส่ `?type=`
2. ทำซ้ำด้วย `?type=foo`
**Expected**
ทั้งสองกรณีแสดงหน้าแจ้งข้อผิดพลาดข้อความ "Invalid adjustment type. Use ?type=stock-in or ?type=stock-out"; ไม่มีการยิง request ดึงเอกสาร

---
## TC-IADJ-020004 — เปิด id ที่ไม่มีอยู่จริงต้องแจ้ง not found พร้อมทางกลับ
**Priority:** Medium · **Test Type:** Negative
**Preconditions**
เข้าสู่ระบบเป็น Admin
**Steps**
1. เปิด `/inventory-management/inventory-adjustment/00000000-0000-0000-0000-000000000000?type=stock-in`
**Expected**
แสดงหน้าข้อผิดพลาดข้อความ "Inventory adjustment not found" พร้อมปุ่มลองใหม่ และปุ่มกลับไปที่ `/inventory-management/inventory-adjustment` (ไม่เป็นทางตัน)

---
## TC-IADJ-020005 — เอกสารสถานะ Completed / Voided เป็น read-only
**Priority:** High · **Test Type:** Functional
**Preconditions**
เข้าสู่ระบบเป็น Admin; มีเอกสารสถานะ Completed หรือ Voided อย่างน้อย 1 ใบ
**Steps**
1. เปิดหน้า detail ของเอกสารสถานะ Completed (หรือ Voided)
2. ตรวจปุ่มบนหัวเอกสารและแถบสรุปท้ายจอ
**Expected**
ไม่มีปุ่ม Edit และไม่มีปุ่ม Delete บนหัวเอกสาร; ไม่มีปุ่ม Void ในแถบสรุป (Void ต้องอยู่ในโหมด edit และเอกสารต้องยังไม่ read-only); ปุ่ม Activity และ Print ยังใช้งานได้; ข้อมูลทั้งหมดแสดงเป็นข้อความอ่านอย่างเดียว

---
## TC-IADJ-020006 — ปุ่ม Print ของเอกสารแสดงเฉพาะโหมด view
**Priority:** Low · **Test Type:** Functional
**Preconditions**
เข้าสู่ระบบเป็น Admin; เปิดเอกสาร Draft ในโหมด view
**Steps**
1. ตรวจว่ามีปุ่ม Print บนหัวเอกสารในโหมด view
2. กดปุ่ม Edit
3. ตรวจปุ่มบนหัวเอกสารอีกครั้ง
**Expected**
โหมด view มีปุ่ม Print (พิมพ์เอกสารชนิด SI สำหรับ stock-in และ SO สำหรับ stock-out); เข้าโหมด edit แล้วปุ่ม Print หายไป เหลือ Cancel / Save / Delete / Activity

---
## TC-IADJ-020007 — ปุ่ม Activity บนหัวเอกสารเปิดแผงประวัติ
**Priority:** Low · **Test Type:** Functional
**Preconditions**
เข้าสู่ระบบเป็น Admin; เปิดเอกสารที่มีอยู่จริง
**Steps**
1. เปิดหน้า detail ของเอกสาร
2. กดปุ่ม Activity บนหัวเอกสาร
3. กด Edit แล้วตรวจว่าปุ่ม Activity ยังอยู่
**Expected**
แผงประวัติเปิดขึ้นโดยอ้างถึงเลขที่เอกสารใบนั้น; ปุ่ม Activity แสดงทุกโหมด (view และ edit) เพราะเป็นการดู ไม่ใช่การแก้; หน้า `/new` ที่ยังไม่มีเอกสารจริงไม่มีปุ่มนี้

---
## TC-IADJ-020008 — ปุ่มย้อนกลับพากลับหน้า list เสมอ
**Priority:** Medium · **Test Type:** Functional
**Preconditions**
เข้าสู่ระบบเป็น Admin; เปิดหน้า detail ของเอกสารโดยเดินผ่านหลายหน้ามาก่อน (เช่น dashboard → list → detail)
**Steps**
1. เปิดหน้า detail ของเอกสาร
2. กดปุ่มลูกศรย้อนกลับซ้ายของเลขที่เอกสาร (aria-label "Go back")
**Expected**
กลับไปที่ `/inventory-management/inventory-adjustment` ในครั้งเดียว ไม่ใช่ถอย history ทีละหน้า

---
## TC-IADJ-020009 — ตารางรายการในโหมด view แสดงค่าอย่างเดียว ไม่มีช่องกรอก
**Priority:** Medium · **Test Type:** Functional
**Preconditions**
เข้าสู่ระบบเป็น Admin; เปิดเอกสารที่มีรายการสินค้าอย่างน้อย 1 แถวในโหมด view
**Steps**
1. เปิดหน้า detail ของเอกสารในโหมด view
2. ตรวจ section "Items" และตารางรายการ
**Expected**
หัวข้อ section เป็น "Items" พร้อมจำนวนแถว; ไม่มีปุ่ม "Add Item" และไม่มีคอลัมน์ปุ่มถังขยะท้ายแถว; ช่อง Qty / Cost/Unit แสดงเป็นข้อความ (ไม่ใช่ input); ชื่อสินค้าแสดงชื่อหลักพร้อมชื่อท้องถิ่นบรรทัดล่าง; ยังมีปุ่มเปิดแผง Inventory Information ในแต่ละแถว

---
## TC-IADJ-030001 — เปิดหน้า new Stock In สำเร็จ
**Priority:** High · **Test Type:** Smoke
**Preconditions**
เข้าสู่ระบบเป็น Admin; active BU = BLAVG
**Steps**
1. ไปที่ `/inventory-management/inventory-adjustment`
2. กดปุ่ม "Add Stock In"
**Expected**
URL เป็น `.../new?type=stock-in`; หัวเอกสารแสดงข้อความ "Stock In" แทนเลขที่เอกสาร (ยังไม่มีเลข) และยังไม่มีปุ่ม Delete / Activity / Print; ฟอร์มแสดง section "Document Information" (Date / Reason / Location / Description) และ section "Items" ที่ว่างเปล่าพร้อมข้อความ "No Items Yet" และปุ่ม "Add Item"; ช่อง Date ถูกเติมค่าตั้งต้นให้อัตโนมัติ

---
## TC-IADJ-030002 — สร้าง Stock In (date/reason/location + 1 รายการ) สำเร็จ
**Priority:** High · **Test Type:** CRUD
**Preconditions**
เข้าสู่ระบบเป็น Admin; active BU = BLAVG; มี location ชนิด inventory/consignment และมี adjustment type ชนิด stock-in ที่ is_active
**Steps**
1. เปิดหน้า `.../new?type=stock-in`
2. เลือก Location
3. เลือก Reason จากรายการ adjustment type
4. กด "Add Item" แล้วเลือกสินค้าและกรอก Qty
5. กดปุ่ม Save
**Expected**
ขึ้น toast "Inventory Adjustment created successfully"; **ระบบพาไปยังหน้าเอกสารที่เพิ่งสร้าง** `.../{newId}?type=stock-in` แบบ replace (ไม่เด้งกลับหน้า list) และหน้าอยู่ในโหมด view; เอกสารมีสถานะ Draft

---
## TC-IADJ-030003 — สร้าง Stock Out สำเร็จ และตารางไม่มีคอลัมน์ Cost/Unit
**Priority:** High · **Test Type:** CRUD
**Preconditions**
เข้าสู่ระบบเป็น Admin; active BU = BLAVG; มี adjustment type ชนิด stock-out ที่ is_active และมีสต็อกเพียงพอ
**Steps**
1. เปิดหน้า `.../new?type=stock-out`
2. เลือก Location และ Reason
3. กด "Add Item" เลือกสินค้าและกรอก Qty
4. ตรวจหัวคอลัมน์ของตารางรายการ
5. กดปุ่ม Save
**Expected**
ตารางรายการของ stock-out มีคอลัมน์ `#`, Product, Unit, Qty, Total Cost และปุ่มลบ — **ไม่มีคอลัมน์ Cost/Unit**; บันทึกแล้วขึ้น toast "Inventory Adjustment created successfully" และไปยังหน้าเอกสารที่เพิ่งสร้าง สถานะ Draft; เมื่อกลับไปหน้า list เอกสารใบนี้แสดง badge "STOCK OUT"

---
## TC-IADJ-030004 — เพิ่มรายการได้หลายแถว และสินค้าที่เลือกแล้วไม่ซ้ำ
**Priority:** Medium · **Test Type:** Functional
**Preconditions**
เข้าสู่ระบบเป็น Admin; อยู่ในหน้า `.../new?type=stock-in` และเลือก Location แล้ว
**Steps**
1. กด "Add Item" ครั้งที่หนึ่ง แล้วเลือกสินค้า A
2. กด "Add Item" ครั้งที่สอง แล้วเปิดรายการสินค้า
**Expected**
แต่ละครั้งที่กด "Add Item" มีแถวใหม่เพิ่มขึ้น **ที่บนสุดของตาราง** และช่องเลือกสินค้าของแถวนั้นถูกเปิดให้อัตโนมัติ; จำนวนบนหัวข้อ section "Items" เพิ่มตาม; รายการสินค้าของแถวที่สองไม่มีสินค้า A ให้เลือกซ้ำ

---
## TC-IADJ-030005 — ลบรายการผ่านกล่อง Remove Item
**Priority:** Medium · **Test Type:** Functional
**Preconditions**
เข้าสู่ระบบเป็น Admin; ในฟอร์ม (โหมด add หรือ edit) มีรายการอย่างน้อย 2 แถว
**Steps**
1. กดปุ่มถังขยะ (aria-label "Remove") ท้ายแถวหนึ่ง
2. ยืนยันในกล่องที่เด้งขึ้น
**Expected**
กล่องยืนยันหัวข้อ "Remove Item" พร้อมคำอธิบายที่อ้างถึงรายการนั้น; ยืนยันแล้วแถวหายไปจากตาราง จำนวนบนหัวข้อ section ลดลง และยอด Grand Total ถูกคำนวณใหม่

---
## TC-IADJ-030006 — เลือกสินค้าแล้ว Cost/Unit กับ Total Cost ถูกเติมอัตโนมัติ
**Priority:** Medium · **Test Type:** Functional
**Preconditions**
เข้าสู่ระบบเป็น Admin; อยู่ในฟอร์มโหมด add/edit และเลือก Location แล้ว; สินค้าที่จะเลือกมีต้นทุนในคลังนั้น
**Steps**
1. กด "Add Item" แล้วเลือกสินค้าที่มีต้นทุนในระบบ
2. กรอก Qty
**Expected**
คอลัมน์ Unit ถูกเติมด้วยหน่วยนับของสินค้า; Cost/Unit ถูกเติมด้วยต้นทุนเฉลี่ยของสินค้าในคลังนั้น และ Total Cost = Qty × Cost/Unit; การเติมค่านี้ทำงานทั้งใน stock-in และ stock-out (ใน stock-out ค่าถูกเติมเบื้องหลังแม้คอลัมน์ Cost/Unit จะถูกซ่อน); แก้ Qty หรือ Cost/Unit เองแล้ว Total Cost คำนวณใหม่ทันที

---
## TC-IADJ-030007 — กด Add Item ก่อนเลือก Location ต้องขึ้น toast เตือน
**Priority:** Medium · **Test Type:** Negative
**Preconditions**
เข้าสู่ระบบเป็น Admin; เปิดหน้า `.../new?type=stock-in` และยังไม่เลือก Location
**Steps**
1. กดปุ่ม "Add Item" ทันทีโดยยังไม่เลือก Location
**Expected**
ปุ่ม "Add Item" **กดได้ (ไม่ถูก disable)** แต่ขึ้น toast เตือนข้อความ "Choose a store before adding items" และไม่มีแถวใหม่ถูกเพิ่มลงตาราง

---
## TC-IADJ-030008 — เปิด `/new` โดยไม่มี `?type` ต้องแจ้ง invalid type
**Priority:** Medium · **Test Type:** Negative
**Preconditions**
เข้าสู่ระบบเป็น Admin
**Steps**
1. เปิด `/inventory-management/inventory-adjustment/new` โดยไม่ใส่ `?type=`
2. ทำซ้ำด้วย `?type=stockin`
**Expected**
ทั้งสองกรณีแสดงหน้าแจ้งข้อผิดพลาดข้อความ "Invalid adjustment type. Use ?type=stock-in or ?type=stock-out" แทนฟอร์ม

---
## TC-IADJ-030009 — ออกจากฟอร์มที่ยังไม่บันทึกต้องถามยืนยันก่อน
**Priority:** Medium · **Test Type:** Alternate Flow
**Preconditions**
เข้าสู่ระบบเป็น Admin; เปิดหน้า `.../new?type=stock-in` และแก้ค่าในฟอร์มแล้ว (เช่น เลือก Location)
**Steps**
1. กดปุ่มย้อนกลับ (หรือปุ่ม Cancel)
2. เลือกยกเลิกในกล่องที่เด้งขึ้น
3. กดปุ่มย้อนกลับอีกครั้ง แล้วยืนยันการทิ้งข้อมูล
**Expected**
ขึ้นกล่องเตือนว่ายังไม่ได้บันทึกก่อนออกจากหน้า; เลือกยกเลิกแล้วยังอยู่ในฟอร์มพร้อมข้อมูลเดิม; ยืนยันแล้วกลับไปที่ `/inventory-management/inventory-adjustment`; หากยังไม่ได้แก้อะไรเลย กดย้อนกลับต้องออกได้ทันทีโดยไม่ถาม

---
## TC-IADJ-030050 — สร้าง Inventory Adjustment ภายใต้ BU BLAVG สำเร็จ
**Priority:** High · **Test Type:** CRUD
**Preconditions**
เข้าสู่ระบบเป็น Admin; active BU = BLAVG
**Steps**
1. เปิดหน้า `.../new?type=stock-in`
2. กรอก Date / Reason / Location และเพิ่ม 1 รายการพร้อม Qty
3. กด Save
4. กลับไปหน้า list
**Expected**
เอกสารถูกสร้างภายใต้ BU BLAVG (request ยิงไปที่ endpoint ของ buCode ที่ active); ขึ้น toast "Inventory Adjustment created successfully" และเอกสารใบใหม่ปรากฏในหน้า list ของ BU นี้

---
## TC-IADJ-040001 — แก้ Description ของเอกสาร Draft แล้วบันทึกสำเร็จ
**Priority:** High · **Test Type:** CRUD
**Preconditions**
เข้าสู่ระบบเป็น Admin; มีเอกสารสถานะ Draft
**Steps**
1. เปิดหน้า detail ของเอกสาร Draft
2. กด Edit
3. แก้ข้อความในช่อง Description
4. กด Save
**Expected**
ขึ้น toast "Inventory Adjustment updated successfully"; **ระบบอยู่ที่หน้าเอกสารเดิม** และสลับกลับเป็นโหมด view (ไม่เด้งกลับหน้า list); ค่า Description ใหม่แสดงอยู่ และออกจากหน้าได้โดยไม่ถูกถามว่ายังไม่บันทึก

---
## TC-IADJ-040050 — ค่าที่แก้ยังอยู่หลังโหลดหน้าใหม่
**Priority:** High · **Test Type:** CRUD
**Preconditions**
เข้าสู่ระบบเป็น Admin; active BU = BLAVG; ทำ TC-IADJ-040001 สำเร็จแล้ว
**Steps**
1. แก้ Description ของเอกสารแล้วกด Save
2. โหลดหน้าเดิมใหม่ (reload) หรือกลับไปหน้า list แล้วเปิดเอกสารเดิมอีกครั้ง
**Expected**
ค่า Description ที่แก้ยังคงอยู่หลังเปิดใหม่

---
## TC-IADJ-050001 — ลบเอกสาร Draft จากหน้า detail
**Priority:** High · **Test Type:** CRUD
**Preconditions**
เข้าสู่ระบบเป็น Admin; มีเอกสารสถานะ Draft (ไม่ใช่ Completed/Voided)
**Steps**
1. เปิดหน้า detail ของเอกสาร Draft (โหมด view)
2. กดปุ่ม Delete บนหัวเอกสารได้ทันที **โดยไม่ต้องกด Edit ก่อน**
3. ยืนยันในกล่อง Delete Inventory Adjustment
**Expected**
ปุ่ม Delete แสดงในโหมด view; ยืนยันแล้วขึ้น toast "Inventory Adjustment deleted successfully" และระบบพากลับไปที่ `/inventory-management/inventory-adjustment` โดยเอกสารหายไปจากรายการ

---
## TC-IADJ-060001 — Void เอกสารพร้อมระบุเหตุผล
**Priority:** High · **Test Type:** Functional
**Preconditions**
เข้าสู่ระบบเป็น Admin; มีเอกสารที่ยังไม่ Completed/Voided
**Steps**
1. เปิดหน้า detail ของเอกสาร
2. กด Edit เพื่อเข้าโหมดแก้ไข (ปุ่ม Void แสดงเฉพาะโหมดนี้)
3. กดปุ่ม Void ในแถบสรุปท้ายจอ
4. กรอกเหตุผลในกล่องยืนยันแล้วยืนยัน
**Expected**
ในโหมด view ไม่มีปุ่ม Void — ต้องเข้าโหมด edit ก่อน; กล่องยืนยันหัวข้อ "Void Inventory Adjustment" อ้างเลขที่เอกสารและบังคับกรอกเหตุผล; ยืนยันแล้วขึ้น toast "Inventory Adjustment voided successfully" และพากลับหน้า list; เปิดเอกสารเดิมอีกครั้งสถานะเป็น Voided และเป็น read-only

---
## TC-IADJ-060002 — Commit เอกสารเพื่อปิดเข้าสต๊อก
**Priority:** High · **Test Type:** Functional
**Preconditions**
เข้าสู่ระบบเป็น Admin; มีเอกสาร Draft ที่กรอก Date / Reason / Location และมีรายการครบถ้วน
**Steps**
1. เปิดหน้า detail ของเอกสาร Draft แล้วกด Edit
2. กดปุ่ม "Commit" ในแถบสรุปท้ายจอ
3. อ่านกล่องยืนยันแล้วกดยืนยัน
**Expected**
กล่องยืนยันหัวข้อ "Commit Inventory Adjustment" ข้อความ "Once committed this adjustment posts to stock and can no longer be edited. Continue?" ปุ่มยืนยันชื่อ "Commit"; ยืนยันแล้วระบบบันทึกของที่ค้างให้ก่อน (ถ้ามี) แล้วจึงปิดเอกสาร; ขึ้น toast แจ้งสำเร็จและพากลับหน้า list; เอกสารเปลี่ยนเป็นสถานะที่แก้ไม่ได้อีก (ไม่มีปุ่ม Edit/Delete เมื่อเปิดซ้ำ)

---
## TC-IADJ-060003 — กด Commit ขณะฟอร์มยังไม่ผ่าน validation
**Priority:** Medium · **Test Type:** Negative
**Preconditions**
เข้าสู่ระบบเป็น Admin; อยู่ในฟอร์ม `.../new?type=stock-in` ที่ยังไม่เลือก Location/Reason และยังไม่มีรายการ
**Steps**
1. กดปุ่ม "Commit" ในแถบสรุปท้ายจอ
**Expected**
**กล่องยืนยัน Commit ไม่ถูกเปิด**; ระบบแสดงข้อความ error ใต้ช่องที่ยังไม่ผ่าน และเลื่อนจอไปยังช่องแรกที่ผิด; ไม่มี request ปิดเอกสารถูกยิง

---
## TC-IADJ-100001 — ผู้ใช้ที่ไม่มีสิทธิ์เปิด URL ตรง ๆ ต้องเจอกล่องไม่มีสิทธิ์
**Priority:** High · **Test Type:** Authorization
**Preconditions**
เข้าสู่ระบบด้วยผู้ใช้ที่ไม่ใช่ admin และไม่มีสิทธิ์ `inventory_management.view` (หรือ BU ไม่มี license `inventory_management.inventory_adjustment`)
**Steps**
1. เปิด `/inventory-management/inventory-adjustment` โดยตรง
**Expected**
ระบบ **ไม่ redirect** แต่แสดงกล่องแจ้งไม่มีสิทธิ์ (`role="alert"`) คาที่ URL เดิม พร้อมปุ่มพาไปหน้าที่ผู้ใช้เข้าได้; ไม่มีรายการ adjustment แสดง

---
## TC-IADJ-100002 — ผู้ที่ยังไม่ล็อกอินเปิด URL ตรง ๆ ต้องถูกพาไป /login
**Priority:** High · **Test Type:** Auth-guard
**Preconditions**
ยังไม่ได้เข้าสู่ระบบ (ไม่มี token ใน store)
**Steps**
1. เปิด `/inventory-management/inventory-adjustment` โดยตรง
2. ทำซ้ำกับ `.../new?type=stock-in`
**Expected**
ถูกพาไปที่ `/login` แบบ replace ทั้งสองกรณี โดยระบบจำ path ต้นทางไว้ใน state ของการ navigate

---
## TC-IADJ-200001 — บันทึกโดยไม่เลือก Location
**Priority:** High · **Test Type:** Validation
**Preconditions**
เข้าสู่ระบบเป็น Admin; อยู่ในหน้า `.../new?type=stock-in`
**Steps**
1. ปล่อยช่อง Location ว่าง
2. กด Save
**Expected**
แสดง error ที่ช่อง Location ข้อความ "Location is required"; จอเลื่อนไปยังช่องแรกที่ผิด และไม่มีการบันทึก

---
## TC-IADJ-200002 — บันทึกโดยไม่เลือก Reason
**Priority:** High · **Test Type:** Validation
**Preconditions**
เข้าสู่ระบบเป็น Admin; อยู่ในหน้า `.../new?type=stock-in`
**Steps**
1. ปล่อยช่อง Reason ว่าง (placeholder "Select adjustment type")
2. กด Save
**Expected**
แสดง error ข้อความ "Adjustment Type is required" ที่ช่อง Reason และไม่มีการบันทึก

---
## TC-IADJ-200003 — บันทึกโดยไม่มีรายการสินค้า
**Priority:** High · **Test Type:** Validation
**Preconditions**
เข้าสู่ระบบเป็น Admin; อยู่ในหน้า `.../new?type=stock-in`
**Steps**
1. กรอก Date / Reason / Location ให้ครบ
2. ไม่เพิ่มรายการใด ๆ
3. กด Save
**Expected**
แสดงข้อความ error เหนือตารางรายการว่า "At least one Product is required" (element มี `role="alert"`) และไม่มีการบันทึก

---
## TC-IADJ-200005 — ช่องวันที่ถูกจำกัดอยู่ในช่วง period ปัจจุบัน
**Priority:** Medium · **Test Type:** Validation
**Preconditions**
เข้าสู่ระบบเป็น Admin; โปรไฟล์ของ BU มี period ปัจจุบันที่กำหนด start/end
**Steps**
1. เปิดหน้า `.../new?type=stock-in`
2. ตรวจค่าตั้งต้นของช่อง Date
3. เปิดปฏิทินของช่อง Date แล้วดูวันที่นอกช่วง period
**Expected**
ค่าตั้งต้นของ Date คือวันที่น้อยกว่าระหว่าง "วันนี้" กับ "วันสิ้นสุด period"; ปฏิทินเลือกได้เฉพาะช่วง start–end ของ period ปัจจุบัน (วันที่นอกช่วงถูกปิด); หากค่าวันที่หลุดออกนอกช่วงแล้วกด Save จะขึ้น error "Date must be within the current period" และไม่บันทึก

---
## TC-IADJ-200006 — qty ติดลบต้องแสดง error
**Priority:** Medium · **Test Type:** Validation
**Preconditions**
เข้าสู่ระบบเป็น Admin; ในฟอร์มมีรายการ 1 แถวที่เลือกสินค้าแล้ว
**Steps**
1. กรอก Qty เป็นค่าติดลบ เช่น `-1`
2. กด Save
**Expected**
แสดง error ที่ช่อง Qty ข้อความ "Qty must be at least 0" และไม่บันทึก; **Qty = 0 ถือว่าผ่าน** (แถวที่เพิ่งเพิ่มเริ่มที่ 0 โดยตั้งใจ) และช่องรับทศนิยมได้ (input เป็น `type=number` `step=any` `min=0`)

---
## TC-IADJ-200007 — Description พิมพ์ได้ไม่เกิน 256 ตัวอักษร
**Priority:** Low · **Test Type:** Validation
**Preconditions**
เข้าสู่ระบบเป็น Admin; อยู่ในฟอร์มโหมด add หรือ edit
**Steps**
1. พิมพ์ข้อความยาวกว่า 256 ตัวอักษรลงช่อง Description ของเอกสาร
**Expected**
ช่อง Description ตัดการพิมพ์ที่ 256 ตัวอักษร (`maxLength=256`); หากค่าหลุดเกินมาได้ schema จะแจ้ง "Description must be at most 256 characters" ตอนบันทึก

---
## TC-IADJ-200008 — Cost/Unit ติดลบต้องแสดง error
**Priority:** Medium · **Test Type:** Validation
**Preconditions**
เข้าสู่ระบบเป็น Admin; อยู่ในฟอร์ม `.../new?type=stock-in` ที่มีรายการ 1 แถวและเลือกสินค้าแล้ว
**Steps**
1. แก้ค่าในช่อง Cost/Unit ให้ติดลบ
2. กด Save
**Expected**
แสดง error ที่ช่อง Cost/Unit ข้อความ "Cost/Unit must be 0 or more" และไม่บันทึก

---
## TC-IADJ-200009 — แถวที่ยังไม่เลือกสินค้าต้องแสดง error
**Priority:** Medium · **Test Type:** Validation
**Preconditions**
เข้าสู่ระบบเป็น Admin; อยู่ในหน้า `.../new?type=stock-in` และเลือก Location แล้ว
**Steps**
1. กด "Add Item" เพื่อเพิ่มแถวใหม่
2. ปิดช่องเลือกสินค้าโดยยังไม่เลือกอะไร
3. กรอก Date / Reason ให้ครบ แล้วกด Save
**Expected**
แสดง error ที่ช่องเลือกสินค้าของแถวนั้น ข้อความ "Product is required" และไม่บันทึก

---
## TC-IADJ-300001 — Export รายการเป็นไฟล์ xlsx
**Priority:** Medium · **Test Type:** Functional
**Preconditions**
เข้าสู่ระบบเป็น Admin; มีเอกสารอย่างน้อย 1 ใบ; อยู่ที่หน้า list บน desktop
**Steps**
1. ตั้งตัวกรองหรือคำค้นที่ยังเหลือข้อมูล
2. กดปุ่ม "Export"
**Expected**
ระหว่างทำงานปุ่มเปลี่ยนเป็น "Exporting..." พร้อมสปินเนอร์และกดซ้ำไม่ได้; ได้ไฟล์ `.xlsx` ชื่อขึ้นต้นด้วย `inventory-adjustment` ชีทชื่อ "Inventory Adjustments" คอลัมน์เรียงเป็น Adjustment, Date, Type, Location, Reason, Items, Total, Status, Description; ข้อมูลที่ export เคารพตัวกรอง/คำค้นที่ตั้งไว้; ขึ้น toast "Exported {n} records"

---
## TC-IADJ-300002 — Export ขณะไม่มีข้อมูลต้องเตือนแทนการดาวน์โหลด
**Priority:** Low · **Test Type:** Negative
**Preconditions**
เข้าสู่ระบบเป็น Admin; ตั้งคำค้น/ตัวกรองจนไม่มีรายการเหลือ
**Steps**
1. ค้นหาคำที่ไม่มีอยู่จริงจนตารางว่าง
2. กดปุ่ม "Export"
**Expected**
ไม่มีไฟล์ถูกดาวน์โหลด; ขึ้น toast แบบเตือนข้อความ "No data to export"

---
## TC-IADJ-300003 — แผง Inventory Information ของรายการสินค้า (Lots / Movements)
**Priority:** Medium · **Test Type:** Functional
**Preconditions**
เข้าสู่ระบบเป็น Admin; เปิดเอกสารที่มีรายการสินค้าซึ่งเลือก Location และสินค้าแล้ว
**Steps**
1. กดปุ่มไอคอนกล่อง (aria-label "Inventory Information") ท้ายช่องสินค้าในแถวหนึ่ง
2. สลับระหว่างแท็บ Lots และ Movements
3. ปิดแผง
**Expected**
แผงเปิดเป็น **dialog** (ไม่ใช่ tooltip แบบ hover) หัวข้อ "Inventory Information" พร้อมต้นทุนเฉลี่ยมุมขวา; ด้านบนแสดงตัวเลข On Hand / On Order / Re-order / Re-stock พร้อมแถบระดับสต็อกและข้อความ "Stock Level: {pct}%" (ขึ้น "Needs Reorder" เมื่อ on-hand ต่ำกว่าจุดสั่งซื้อ); มีแท็บ Lots และ Movements พร้อมตัวเลขจำนวนแถวต่อท้ายชื่อแท็บ และสลับแท็บแล้วเห็นตารางล็อต/ความเคลื่อนไหวตามลำดับ; ถ้าแถวยังไม่เลือกสินค้า แผงแสดงข้อความ "Select a product to view inventory" แทน; ปิดแผงแล้วฟอร์มไม่ถูกแก้ไขใด ๆ

---
## TC-IADJ-900001 — มือถือแสดงเป็นการ์ดและโหลดเพิ่มแบบ infinite scroll
**Priority:** Low · **Test Type:** Edge Case
**Preconditions**
เข้าสู่ระบบเป็น Admin; ใช้งานบน viewport ขนาด mobile; มีเอกสารมากกว่าหนึ่งหน้า
**Steps**
1. เปิด `/inventory-management/inventory-adjustment` บนมือถือ
2. เลื่อนลงจนสุดรายการ
**Expected**
บนมือถือระบบบังคับเป็นมุมมองการ์ดเสมอ (ไม่มีปุ่มสลับ list/grid ให้กด); เลื่อนถึงท้ายรายการแล้วมีสปินเนอร์และโหลดข้อมูลชุดถัดไปต่อเนื่อง ไม่มีแถบเลขหน้า

---
## TC-IADJ-900002 — Grid View บน desktop ก็ใช้ infinite scroll ไม่มี pagination
**Priority:** Low · **Test Type:** Edge Case
**Preconditions**
เข้าสู่ระบบเป็น Admin; ใช้งานบน desktop; มีเอกสารมากกว่าหนึ่งหน้า
**Steps**
1. เปิด `/inventory-management/inventory-adjustment`
2. สลับเป็น Grid View
3. เลื่อนลงจนสุดรายการ
**Expected**
Grid View บน desktop ไม่มีแถบเลขหน้า แต่โหลดเพิ่มแบบ infinite scroll เหมือนมือถือ; สลับกลับเป็น List View แล้วแถบเลขหน้ากลับมาแสดง

---
## TC-IADJ-900003 — ลิงก์เก่าที่รวม type กับ status ไว้ใน `filter` ถูกแยกให้อัตโนมัติ
**Priority:** Medium · **Test Type:** Edge Case
**Preconditions**
เข้าสู่ระบบเป็น Admin; มีลิงก์ bookmark รูปแบบเก่าที่ `filter` เก็บทั้ง `doc_status|string:completed` และ `type|string:stock-in` รวมกัน
**Steps**
1. เปิดลิงก์เก่านั้นโดยตรง
2. ตรวจ URL หลังหน้าโหลดเสร็จ
3. เปิดเมนู Filter
**Expected**
ระบบแยก clause ให้อัตโนมัติครั้งเดียวตอนเข้าหน้า — `filter` เหลือเฉพาะ `doc_status` และ `type` ย้ายไปอยู่ที่ `adj_type` พร้อมรีเซ็ตเลขหน้า; เมนู Filter แสดงค่าที่เลือกไว้ถูกต้องทั้งสอง field โดยไม่ต้องกดเลือกใหม่ และผลการกรองตรงกับทั้งสองเงื่อนไข

---
## TC-IADJ-900004 — พิมพ์คำค้นแล้วยังไม่กด Enter รายการต้องไม่เปลี่ยน
**Priority:** Low · **Test Type:** Edge Case
**Preconditions**
เข้าสู่ระบบเป็น Admin; อยู่ที่หน้า list ที่มีข้อมูล
**Steps**
1. พิมพ์คำค้นลงในช่องค้นหาโดยยังไม่กด Enter และไม่กดปุ่มท้ายช่อง
2. ตรวจรายการในตาราง
**Expected**
รายการในตารางยังคงเดิม (ช่องค้นหายิง query เมื่อกด Enter หรือกดปุ่มท้ายช่องเท่านั้น); กด Enter แล้วรายการจึงถูกกรอง

---
## TC-IADJ-900005 — ออกจากฟอร์มผ่านเมนู sidebar ขณะยังไม่บันทึก
**Priority:** Medium · **Test Type:** Edge Case
**Preconditions**
เข้าสู่ระบบเป็น Admin; อยู่ในฟอร์มโหมด add หรือ edit และมีการแก้ข้อมูลค้างอยู่
**Steps**
1. แก้ค่าในฟอร์มโดยยังไม่กด Save
2. กดลิงก์เมนูใน sidebar เพื่อไปหน้าอื่น
3. เลือกยกเลิก แล้วลองใหม่และเลือกยืนยัน
**Expected**
ระบบดักการออกผ่านลิงก์ภายนอกฟอร์มด้วย แล้วขึ้นกล่องเตือนว่ายังไม่ได้บันทึก (ไม่หลุดออกไปเงียบ ๆ); เลือกยกเลิกแล้วยังอยู่ในฟอร์มพร้อมข้อมูลเดิม; ยืนยันแล้วจึงไปหน้าที่กด; หลังกด Save สำเร็จแล้วกดเมนู sidebar ต้องออกได้ทันทีโดยไม่ถามซ้ำ
