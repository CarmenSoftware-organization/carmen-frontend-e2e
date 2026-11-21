# Delivery Point — User Stories

_Generated from `tests/079-delivery-point.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Delivery Point
**Spec:** `tests/079-delivery-point.spec.ts`
**Default role:** Admin
**Total test cases:** 50 (11 High / 38 Medium / 1 Low)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-DP-010001 | อ่านค่า table ของ delivery point ได้ | High | Smoke |
| TC-DP-010002 | แสดงข้อมูล default 10 รายการต่อหน้า | Medium | Functional |
| TC-DP-010003 | เปลี่ยน per page เป็น 25 / 50 / 100 ได้ | Medium | Functional |
| TC-DP-010004 | per page เกิน 100 ไม่ได้ | Medium | Validation |
| TC-DP-010005 | กด next/prev page แล้วข้อมูลเปลี่ยน | Medium | Functional |
| TC-DP-010006 | search ชื่อ delivery point แล้วกรองได้ถูก | Medium | Smoke |
| TC-DP-010007 | search ด้วยคำที่ไม่มีในระบบ แสดง empty state | Medium | Functional |
| TC-DP-010008 | search ด้วย special char เช่น %, ' ไม่พัง | Medium | Validation |
| TC-DP-010009 | filter ตาม field ที่กำหนด แล้วผลตรง | Medium | Functional |
| TC-DP-010010 | กด sort column แล้วเรียงจาก A→Z ได้ | Medium | Functional |
| TC-DP-010011 | กด sort ซ้ำแล้วเรียงกลับ Z→A ได้ | Medium | Functional |
| TC-DP-010012 | filter + search + sort พร้อมกันไม่พัง | Medium | Functional |
| TC-DP-010013 | กด toggle เปลี่ยนจาก table → card view ได้ | Medium | Functional |
| TC-DP-010014 | กด toggle เปลี่ยนจาก card → table view ได้ | Medium | Functional |
| TC-DP-010015 | ข้อมูลที่แสดงใน card กับ table ตรงกัน | Medium | Functional |
| TC-DP-010016 | เปลี่ยน view mode แล้ว filter/search/sort ยังทำงานอยู่ | Medium | Functional |
| TC-DP-010017 | เปลี่ยน view mode แล้ว pagination ยังทำงานอยู่ | Medium | Functional |
| TC-DP-010018 | refresh หน้าแล้ว view mode กลับมาเป็น default | Medium | Functional |
| TC-DP-010019 | กด toggle column แล้ว panel แสดงรายการ column ได้ | Medium | Functional |
| TC-DP-010020 | ซ่อน column แล้ว column หายออกจาก table | Medium | Functional |
| TC-DP-010021 | แสดง column กลับแล้ว column โผล่ใน table | Medium | Functional |
| TC-DP-010022 | ซ่อนทุก column ไม่ได้ ต้องเหลืออย่างน้อย 1 column | Medium | Validation |
| TC-DP-010023 | column ที่ซ่อนอยู่ยังค้นหาและ filter ได้ปกติ | Medium | Functional |
| TC-DP-010024 | เปลี่ยน view mode แล้ว column visibility ยังคงอยู่ | Medium | Functional |
| TC-DP-010025 | refresh หน้าแล้ว column ที่ซ่อนไว้กลับมาเป็น default | Medium | Functional |
| TC-DP-010026 | card view ไม่มี column toggle เพราะไม่มี column | Medium | Functional |
| TC-DP-010050 | active BU = BLAVG | High | Smoke |
| TC-DP-030001 | กด Add แล้ว dialog เปิดขึ้นมา | High | Smoke |
| TC-DP-030002 | dialog เปิดมา field name เป็น empty string | Medium | Functional |
| TC-DP-030003 | dialog เปิดมา is active default เป็น true | Medium | Functional |
| TC-DP-030004 | กรอก name แล้ว save ได้ ข้อมูลขึ้น table | High | CRUD |
| TC-DP-030005 | กด cancel แล้ว dialog ปิด ไม่มีข้อมูลขึ้น table | Medium | Functional |
| TC-DP-030006 | สร้างด้วย is active = false แล้วค่าบันทึกถูก | High | CRUD |
| TC-DP-040001 | กดที่ column name แล้ว dialog เปิดขึ้นมา | High | CRUD |
| TC-DP-040002 | dialog เปิดมา field name แสดงค่าเดิมถูกต้อง | Medium | Functional |
| TC-DP-040003 | dialog เปิดมา is active แสดงค่าเดิมถูกต้อง | Medium | Functional |
| TC-DP-040004 | แก้ name แล้ว save ข้อมูลใน table อัพเดท | High | CRUD |
| TC-DP-040005 | แก้ name เป็นค่าเดิมแล้ว save ได้ปกติ | Medium | CRUD |
| TC-DP-040006 | กด cancel ระหว่าง edit ข้อมูลเดิมไม่เปลี่ยน | Medium | Functional |
| TC-DP-040007 | toggle is active แล้ว save ค่าเปลี่ยนถูก | High | CRUD |
| TC-DP-050001 | กด trash icon แล้ว confirm dialog เปิดขึ้นมา | High | CRUD |
| TC-DP-050002 | กด confirm แล้วข้อมูลหายออกจาก table | High | CRUD |
| TC-DP-050003 | กด cancel ใน confirm dialog ข้อมูลยังอยู่ | Medium | Functional |
| TC-DP-050004 | ลบแล้ว total count ใน table ลดลง 1 | Medium | CRUD |
| TC-DP-050005 | ลบรายการสุดท้ายในหน้า ระบบ paginate กลับหน้าก่อนหน้า | Low | Functional |
| TC-DP-200001 | กด save โดยไม่กรอก name ระบบต้องด่า | High | Validation |
| TC-DP-200002 | กรอก name ซ้ำกับที่มีอยู่แล้ว ระบบต้องห้าม | Medium | Validation |
| TC-DP-200003 | กรอก name ยาวเกิน limit ระบบต้องห้าม | Medium | Validation |
| TC-DP-200004 | กรอก name เป็น space ล้วน ระบบต้องด่า | Medium | Validation |
| TC-DP-200005 | ลบ name ออกทั้งหมดแล้ว save ระบบต้องด่า | Medium | Validation |

---

## TC-DP-010001 — อ่านค่า table ของ delivery point ได้

> **As a** Admin user, **I want** core Delivery Point interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

ผู้ใช้ carmensoftware.dev+admin@gmail.com (จาก createAuthTest) login แล้ว และมี delivery point ในระบบอย่างน้อย 1 รายการ

**Steps**

1. เปิดหน้า /config/delivery-point
2. รอ table โหลด
3. ตรวจสอบปุ่ม Add

**Expected**

URL ลงท้ายด้วย config/delivery-point, table แสดงผล และปุ่ม Add visible

---

## TC-DP-010002 — แสดงข้อมูล default 10 รายการต่อหน้า

> **As a** Admin user, **I want** this Delivery Point interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

ผู้ใช้ login แล้ว มีข้อมูล delivery point ในระบบ

**Steps**

1. เปิดหน้า /config/delivery-point
2. นับจำนวน rows ใน table

**Expected**

จำนวน row > 0 และ <= 10 (ค่า default per page)

---

## TC-DP-010003 — เปลี่ยน per page เป็น 25 / 50 / 100 ได้

> **As a** Admin user, **I want** this Delivery Point interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

ผู้ใช้ login แล้ว และตัวเลือก per page visible

**Steps**

1. เปิดหน้า list
2. เลือก per page = 25
3. เลือก 50
4. เลือก 100
5. นับ rows หลังจากแต่ละค่า

**Expected**

จำนวน rows ที่แสดงไม่เกินค่า per page ที่เลือกในแต่ละครั้ง

---

## TC-DP-010004 — per page เกิน 100 ไม่ได้

> **As a** Admin user, **I want** the system to block invalid Delivery Point submissions, **so that** data quality is preserved.

**Priority:** Medium · **Test Type:** Validation

**Preconditions**

ผู้ใช้ login แล้ว และตัวเลือก per page visible

**Steps**

1. เปิดหน้า list
2. กด dropdown per page
3. ตรวจสอบว่ามีตัวเลือก 200 หรือไม่

**Expected**

ตัวเลือก 200 ไม่อยู่ใน dropdown (per page สูงสุดคือ 100)

---

## TC-DP-010005 — กด next/prev page แล้วข้อมูลเปลี่ยน

> **As a** Admin user, **I want** this Delivery Point interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

ผู้ใช้ login แล้ว และมีข้อมูลมากกว่า 1 page

**Steps**

1. เปิดหน้า list
2. จด row แรก
3. กด next page
4. ตรวจสอบ row แรกใหม่
5. กด prev page

**Expected**

row แรกหลังกด next ไม่เท่ากับ row แรกก่อนกด

---

## TC-DP-010006 — search ชื่อ delivery point แล้วกรองได้ถูก

> **As a** Admin user, **I want** to type into the Delivery Point search field, **so that** I can quickly locate existing records.

**Priority:** Medium · **Test Type:** Smoke

**Preconditions**

ผู้ใช้ login แล้ว และมี delivery point อย่างน้อย 1 รายการ

**Steps**

1. เปิดหน้า list
2. ใช้คำค้นจาก row แรกที่มีอยู่
3. ใส่ search
4. นับ rows

**Expected**

ผลลัพธ์มี row > 0 (กรองตรงตามคำค้น)

---

## TC-DP-010007 — search ด้วยคำที่ไม่มีในระบบ แสดง empty state

> **As a** Admin user, **I want** a clear empty-state when no Delivery Point records match my search, **so that** I know nothing was found.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

ผู้ใช้ login แล้ว

**Steps**

1. เปิดหน้า list
2. search ด้วยคำที่ไม่มีจริง เช่น __NOPE__<UID>

**Expected**

table แสดง empty state เมื่อไม่มีผลลัพธ์ตรงกับคำค้น

---

## TC-DP-010008 — search ด้วย special char เช่น %, ' ไม่พัง

> **As a** Admin user, **I want** the system to block invalid Delivery Point submissions, **so that** data quality is preserved.

**Priority:** Medium · **Test Type:** Validation

**Preconditions**

ผู้ใช้ login แล้ว

**Steps**

1. เปิดหน้า list
2. search ด้วย special char %, '

**Expected**

ระบบไม่ crash, ปุ่ม Add ยัง visible อยู่

---

## TC-DP-010009 — filter ตาม field ที่กำหนด แล้วผลตรง

> **As a** Admin user, **I want** to filter the Delivery Point list, **so that** I can narrow results to relevant records.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

ผู้ใช้ login แล้ว และมีตัวเลือก filter

**Steps**

1. เปิดหน้า list
2. กดปุ่ม filter
3. เลือก option active
4. รอผล

**Expected**

table แสดงเฉพาะ delivery point ที่ Status = Active (ทุกแถวมีสถานะ Active และไม่มีแถว Inactive)

---

## TC-DP-010010 — กด sort column แล้วเรียงจาก A→Z ได้

> **As a** Admin user, **I want** to sort the Delivery Point list, **so that** I can find records in a useful order.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

ผู้ใช้ login แล้ว และ column name สามารถ sort ได้

**Steps**

1. เปิดหน้า list
2. กดปุ่ม sort ที่ column name
3. รอผล

**Expected**

ปุ่ม sort ทำงาน, table มีข้อมูล > 0 row หลังเรียง A→Z

---

## TC-DP-010011 — กด sort ซ้ำแล้วเรียงกลับ Z→A ได้

> **As a** Admin user, **I want** to sort the Delivery Point list, **so that** I can find records in a useful order.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

ผู้ใช้ login แล้ว และ column name สามารถ sort ได้

**Steps**

1. เปิดหน้า list
2. กด sort ครั้งแรก (A→Z)
3. เก็บ rows
4. กด sort อีกครั้ง (Z→A)
5. เปรียบเทียบ

**Expected**

ลำดับ rows หลังกดสองครั้งแตกต่างจากครั้งแรก (เรียงกลับ Z→A)

---

## TC-DP-010012 — filter + search + sort พร้อมกันไม่พัง

> **As a** Admin user, **I want** to sort the Delivery Point list, **so that** I can find records in a useful order.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

ผู้ใช้ login แล้ว และมีข้อมูลในระบบ

**Steps**

1. เปิดหน้า list
2. search ด้วยคำจาก row
3. กด sort
4. ตรวจสอบหน้ายังใช้งานได้

**Expected**

ปุ่ม Add ยัง visible — ระบบไม่ crash เมื่อใช้ filter+search+sort พร้อมกัน

---

## TC-DP-010013 — กด toggle เปลี่ยนจาก table → card view ได้

> **As a** Admin user, **I want** this Delivery Point interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

ผู้ใช้ login แล้ว และมี view toggle (table/card)

**Steps**

1. เปิดหน้า list
2. กดปุ่ม toggle card view
3. รอ render

**Expected**

หน้าเปลี่ยนเป็น card view, ปุ่ม Add ยัง visible

---

## TC-DP-010014 — กด toggle เปลี่ยนจาก card → table view ได้

> **As a** Admin user, **I want** this Delivery Point interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

ผู้ใช้ login แล้ว และอยู่ที่ card view

**Steps**

1. เปิดหน้า list
2. กด toggle card
3. กด toggle table

**Expected**

หน้ากลับมาเป็น table view ที่แสดงผลปกติ

---

## TC-DP-010015 — ข้อมูลที่แสดงใน card กับ table ตรงกัน

> **As a** Admin user, **I want** this Delivery Point interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

ผู้ใช้ login แล้ว และมีข้อมูลใน table

**Steps**

1. เปิดหน้า list
2. จดข้อความ row แรกใน table
3. switch เป็น card view
4. ตรวจสอบ data ปรากฏใน card

**Expected**

ข้อมูลที่ปรากฏใน card ตรงกับข้อมูลใน table

---

## TC-DP-010016 — เปลี่ยน view mode แล้ว filter/search/sort ยังทำงานอยู่

> **As a** Admin user, **I want** to sort the Delivery Point list, **so that** I can find records in a useful order.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

ผู้ใช้ login แล้ว และมี view toggle

**Steps**

1. เปิดหน้า list
2. search ด้วยคำจาก row
3. switch เป็น card view
4. switch กลับมา table

**Expected**

หน้ายังใช้งานได้ ปุ่ม Add visible — search ไม่หายเมื่อสลับ view

---

## TC-DP-010017 — เปลี่ยน view mode แล้ว pagination ยังทำงานอยู่

> **As a** Admin user, **I want** to paginate through Delivery Point records, **so that** I can browse large lists efficiently.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

ผู้ใช้ login แล้ว และมี view toggle

**Steps**

1. เปิดหน้า list
2. switch เป็น card view
3. switch กลับมา table
4. ตรวจสอบ pagination

**Expected**

ปุ่ม Add ยัง visible — controls pagination ไม่หายเมื่อสลับ view

---

## TC-DP-010018 — refresh หน้าแล้ว view mode กลับมาเป็น default

> **As a** Admin user, **I want** this Delivery Point interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

ผู้ใช้ login แล้ว

**Steps**

1. เปิดหน้า list
2. switch เป็น card view
3. reload หน้า

**Expected**

หลัง reload กลับมาที่ table view (default)

---

## TC-DP-010019 — กด toggle column แล้ว panel แสดงรายการ column ได้

> **As a** Admin user, **I want** this Delivery Point interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

ผู้ใช้ login แล้ว และปุ่ม column visibility visible

**Steps**

1. เปิดหน้า list
2. กดปุ่ม column visibility
3. ตรวจสอบ menu items

**Expected**

panel เปิดและแสดง menuitemcheckbox ของ column

---

## TC-DP-010020 — ซ่อน column แล้ว column หายออกจาก table

> **As a** Admin user, **I want** this Delivery Point interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

ผู้ใช้ login แล้ว และมีปุ่ม column visibility

**Steps**

1. เปิดหน้า list
2. กด column visibility
3. uncheck column name
4. ตรวจสอบ header
5. restore

**Expected**

header ของ column name หายไปจาก table หลัง uncheck

---

## TC-DP-010021 — แสดง column กลับแล้ว column โผล่ใน table

> **As a** Admin user, **I want** this Delivery Point interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

ผู้ใช้ login แล้ว และมีปุ่ม column visibility

**Steps**

1. เปิดหน้า list
2. ซ่อน column name
3. show กลับ
4. ตรวจสอบ header

**Expected**

header ของ column name กลับมา visible หลัง check

---

## TC-DP-010022 — ซ่อนทุก column ไม่ได้ ต้องเหลืออย่างน้อย 1 column

> **As a** Admin user, **I want** the system to block invalid Delivery Point submissions, **so that** data quality is preserved.

**Priority:** Medium · **Test Type:** Validation

**Preconditions**

ผู้ใช้ login แล้ว และมีปุ่ม column visibility

**Steps**

1. เปิดหน้า list
2. กด column visibility
3. uncheck ทุก column
4. ตรวจสอบ table

**Expected**

ระบบยังเหลือ header อย่างน้อย 1 column ใน table — ซ่อนทุก column ไม่ได้

---

## TC-DP-010023 — column ที่ซ่อนอยู่ยังค้นหาและ filter ได้ปกติ

> **As a** Admin user, **I want** to filter the Delivery Point list, **so that** I can narrow results to relevant records.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

ผู้ใช้ login แล้ว และมีปุ่ม column visibility

**Steps**

1. เปิดหน้า list
2. ซ่อน column name
3. search ด้วยคำที่อยู่ในข้อมูล
4. ตรวจสอบ rows

**Expected**

search ยังกรองข้อมูลตาม column ที่ซ่อนได้ (rows >= 0)

---

## TC-DP-010024 — เปลี่ยน view mode แล้ว column visibility ยังคงอยู่

> **As a** Admin user, **I want** this Delivery Point interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

ผู้ใช้ login แล้ว และมี view toggle + column visibility

**Steps**

1. เปิดหน้า list
2. ซ่อน column name
3. switch เป็น card
4. switch กลับมา table
5. restore

**Expected**

column name ยังถูกซ่อนเมื่อกลับมา table view

---

## TC-DP-010025 — refresh หน้าแล้ว column ที่ซ่อนไว้กลับมาเป็น default

> **As a** Admin user, **I want** this Delivery Point interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

ผู้ใช้ login แล้ว และมีปุ่ม column visibility

**Steps**

1. เปิดหน้า list
2. ซ่อน column name
3. reload หน้า

**Expected**

หลัง reload column name visible อีกครั้ง (default state)

---

## TC-DP-010026 — card view ไม่มี column toggle เพราะไม่มี column

> **As a** Admin user, **I want** a clear empty-state when no Delivery Point records match my search, **so that** I know nothing was found.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

ผู้ใช้ login แล้ว และมี view toggle

**Steps**

1. เปิดหน้า list
2. switch เป็น card view
3. ตรวจสอบปุ่ม column visibility

**Expected**

ปุ่ม column visibility ไม่ visible ใน card view (เพราะไม่มี column)

---

## TC-DP-010050 — active BU = BLAVG

> **As a** Admin user, **I want** core Delivery Point interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com ผ่าน auth fixture; beforeEach เรียก ensureActiveBu(BLAVG) แล้ว

**Steps**

1. อ่าน profile API (/api/proxy/api/user/profile)
2. หา business unit ที่ is_default
3. เปิดหน้าที่มี navbar แล้วอ่าน label ของ BU switcher

**Expected**

default business unit มี code === 'BLAVG'; trigger ของ BU switcher ใน navbar แสดง label ของ BU นั้น

---

## TC-DP-030001 — กด Add แล้ว dialog เปิดขึ้นมา

> **As a** Admin user, **I want** to see the Add button on the Delivery Point list, **so that** I can create new records.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

ผู้ใช้ login แล้ว และอยู่ที่หน้า list

**Steps**

1. เปิดหน้า list
2. กดปุ่ม Add
3. ตรวจสอบ dialog
4. กด cancel

**Expected**

dialog เปิดและ visible เมื่อกด Add

---

## TC-DP-030002 — dialog เปิดมา field name เป็น empty string

> **As a** Admin user, **I want** a clear empty-state when no Delivery Point records match my search, **so that** I know nothing was found.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

ผู้ใช้ login แล้ว

**Steps**

1. เปิดหน้า list
2. กด Add
3. ตรวจสอบ value ของ name input

**Expected**

field name มี value = '' (empty string) เมื่อ dialog เปิด

---

## TC-DP-030003 — dialog เปิดมา is active default เป็น true

> **As a** Admin user, **I want** this Delivery Point interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

ผู้ใช้ login แล้ว

**Steps**

1. เปิดหน้า list
2. กด Add
3. ตรวจสอบ data-state ของ active switch

**Expected**

active switch มี data-state = 'checked' (default true)

---

## TC-DP-030004 — กรอก name แล้ว save ได้ ข้อมูลขึ้น table

> **As a** Admin user, **I want** to manage Delivery Point records via CRUD, **so that** the data stays correct over time.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

ผู้ใช้ login แล้ว และยังไม่มี delivery point ชื่อ DP_NAME

**Steps**

1. เปิดหน้า list
2. กด Add
3. กรอก name = DP_NAME
4. กด Save
5. search หาชื่อ

**Expected**

แสดง toast success และข้อมูลปรากฏใน table

---

## TC-DP-030005 — กด cancel แล้ว dialog ปิด ไม่มีข้อมูลขึ้น table

> **As a** Admin user, **I want** a clear empty-state when no Delivery Point records match my search, **so that** I know nothing was found.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

ผู้ใช้ login แล้ว

**Steps**

1. เปิดหน้า list
2. กด Add
3. กรอก name
4. กด Cancel
5. search หาชื่อ

**Expected**

dialog ปิด และข้อมูลไม่ถูกบันทึก (table แสดง empty state)

---

## TC-DP-030006 — สร้างด้วย is active = false แล้วค่าบันทึกถูก

> **As a** Admin user, **I want** to create a new Delivery Point record, **so that** it becomes available for downstream operations.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

ผู้ใช้ login แล้ว และยังไม่มี DP_NAME_INACTIVE

**Steps**

1. เปิดหน้า list
2. กด Add
3. กรอก name = DP_NAME_INACTIVE
4. toggle active = unchecked
5. กด Save

**Expected**

บันทึกสำเร็จ (toast success) และค่า is_active = false ถูกบันทึก

---

## TC-DP-040001 — กดที่ column name แล้ว dialog เปิดขึ้นมา

> **As a** Admin user, **I want** to manage Delivery Point records via CRUD, **so that** the data stays correct over time.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

ผู้ใช้ login แล้ว และมี DP_NAME ใน table (จาก TC-DP-030004)

**Steps**

1. เปิดหน้า list
2. search DP_NAME
3. คลิกที่ row name
4. ตรวจสอบ dialog

**Expected**

dialog edit เปิดและ visible เมื่อคลิกที่ name

---

## TC-DP-040002 — dialog เปิดมา field name แสดงค่าเดิมถูกต้อง

> **As a** Admin user, **I want** this Delivery Point interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

ผู้ใช้ login แล้ว และมี DP_NAME ใน table

**Steps**

1. เปิดหน้า list
2. search DP_NAME
3. คลิก row
4. ตรวจ value ของ name input

**Expected**

field name มี value ตรงกับ DP_NAME (ค่าเดิม)

---

## TC-DP-040003 — dialog เปิดมา is active แสดงค่าเดิมถูกต้อง

> **As a** Admin user, **I want** this Delivery Point interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

ผู้ใช้ login แล้ว และ DP_NAME มี is_active = true

**Steps**

1. เปิดหน้า list
2. search DP_NAME
3. คลิก row
4. ตรวจ data-state ของ active switch

**Expected**

active switch มี data-state = 'checked' (ตรงกับค่าเดิม)

---

## TC-DP-040004 — แก้ name แล้ว save ข้อมูลใน table อัพเดท

> **As a** Admin user, **I want** to manage Delivery Point records via CRUD, **so that** the data stays correct over time.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

ผู้ใช้ login แล้ว และมี DP_NAME ใน table

**Steps**

1. เปิดหน้า list
2. search DP_NAME
3. คลิก row
4. clear แล้วกรอก DP_NAME_UPDATED
5. Save

**Expected**

แสดง toast updated/success และ table แสดง DP_NAME_UPDATED

---

## TC-DP-040005 — แก้ name เป็นค่าเดิมแล้ว save ได้ปกติ

> **As a** Admin user, **I want** to manage Delivery Point records via CRUD, **so that** the data stays correct over time.

**Priority:** Medium · **Test Type:** CRUD

**Preconditions**

ผู้ใช้ login แล้ว และมี DP_NAME_UPDATED ใน table

**Steps**

1. เปิดหน้า list
2. search
3. คลิก row
4. clear แล้วกรอกค่าเดิม
5. Save

**Expected**

บันทึกสำเร็จ (toast updated/success) แม้ name ไม่เปลี่ยน

---

## TC-DP-040006 — กด cancel ระหว่าง edit ข้อมูลเดิมไม่เปลี่ยน

> **As a** Admin user, **I want** this Delivery Point interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

ผู้ใช้ login แล้ว และมี DP_NAME_UPDATED ใน table

**Steps**

1. เปิดหน้า list
2. search
3. คลิก row
4. clear แล้วกรอก DISCARDED
5. Cancel
6. ตรวจสอบ table

**Expected**

table ยังคงแสดง DP_NAME_UPDATED (ค่าใหม่ไม่ถูกบันทึก)

---

## TC-DP-040007 — toggle is active แล้ว save ค่าเปลี่ยนถูก

> **As a** Admin user, **I want** to manage Delivery Point records via CRUD, **so that** the data stays correct over time.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

ผู้ใช้ login แล้ว และมี DP_NAME_UPDATED ใน table

**Steps**

1. เปิดหน้า list
2. search
3. คลิก row
4. toggle active
5. Save
6. เปิด row อีกครั้งเพื่อตรวจสอบ

**Expected**

ค่า active สลับสถานะและถูก persist ในระบบหลัง reload

---

## TC-DP-050001 — กด trash icon แล้ว confirm dialog เปิดขึ้นมา

> **As a** Admin user, **I want** to manage Delivery Point records via CRUD, **so that** the data stays correct over time.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

ผู้ใช้ login แล้ว และมี DP_NAME_UPDATED ใน table

**Steps**

1. เปิดหน้า list
2. search DP_NAME_UPDATED
3. กด trash icon
4. ตรวจสอบ confirm dialog
5. Cancel

**Expected**

confirm dialog เปิดและ visible เมื่อกด trash

---

## TC-DP-050002 — กด confirm แล้วข้อมูลหายออกจาก table

> **As a** Admin user, **I want** to manage Delivery Point records via CRUD, **so that** the data stays correct over time.

**Priority:** High · **Test Type:** CRUD

**Preconditions**

ผู้ใช้ login แล้ว และมี DP_NAME_UPDATED ใน table

**Steps**

1. เปิดหน้า list
2. search DP_NAME_UPDATED
3. delete row
4. กด Confirm
5. search อีกครั้ง

**Expected**

แสดง toast deleted และ row หายไปจาก table

---

## TC-DP-050003 — กด cancel ใน confirm dialog ข้อมูลยังอยู่

> **As a** Admin user, **I want** this Delivery Point interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

ผู้ใช้ login แล้ว และมี DP_NAME_INACTIVE ใน table

**Steps**

1. เปิดหน้า list
2. search DP_NAME_INACTIVE
3. delete row
4. กด Cancel
5. ตรวจสอบ row

**Expected**

row ยังคงอยู่ใน table (ไม่ถูกลบเมื่อ cancel)

---

## TC-DP-050004 — ลบแล้ว total count ใน table ลดลง 1

> **As a** Admin user, **I want** to delete a Delivery Point record, **so that** the list reflects only valid entries.

**Priority:** Medium · **Test Type:** CRUD

**Preconditions**

ผู้ใช้ login แล้ว และมี DP_NAME_INACTIVE ใน table

**Steps**

1. เปิดหน้า list
2. search DP_NAME_INACTIVE
3. count rows
4. delete + confirm
5. count rows อีกครั้ง

**Expected**

จำนวน rows หลังลบน้อยกว่าก่อนลบ (ลดลงอย่างน้อย 1)

---

## TC-DP-050005 — ลบรายการสุดท้ายในหน้า ระบบ paginate กลับหน้าก่อนหน้า

> **As a** Admin user, **I want** this Delivery Point interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Low · **Test Type:** Functional

**Preconditions**

ผู้ใช้ login แล้ว และมีข้อมูลมากกว่า 1 page โดย page สุดท้ายเหลือเพียง 1 row

**Steps**

1. เปิดหน้า list
2. ไปยัง last page
3. ถ้าเหลือ 1 row ให้ลบ
4. ตรวจสอบ paginate

**Expected**

หลังลบ row สุดท้าย ระบบ paginate กลับหน้าก่อนหน้า (currentRows > 0)

---

## TC-DP-200001 — กด save โดยไม่กรอก name ระบบต้องด่า

> **As a** Admin user, **I want** the system to block invalid Delivery Point submissions, **so that** data quality is preserved.

**Priority:** High · **Test Type:** Validation

**Preconditions**

ผู้ใช้ login แล้ว

**Steps**

1. เปิดหน้า list
2. กด Add
3. กด Save โดยไม่กรอกอะไร

**Expected**

แสดง error message สำหรับ field ที่ require ว่าง

---

## TC-DP-200002 — กรอก name ซ้ำกับที่มีอยู่แล้ว ระบบต้องห้าม

> **As a** Admin user, **I want** the system to block invalid Delivery Point submissions, **so that** data quality is preserved.

**Priority:** Medium · **Test Type:** Validation

**Preconditions**

ผู้ใช้ login แล้ว และมี delivery point DP_NAME อยู่แล้ว (จาก TC-DP-030004)

**Steps**

1. เปิดหน้า list
2. กด Add
3. กรอก name ซ้ำ
4. Save

**Expected**

ระบบแสดง error duplicate/exists/already และไม่บันทึก (ปัจจุบันแอปแสดงข้อความ concurrency แทน — บั๊ก frontend)

---

## TC-DP-200003 — กรอก name ยาวเกิน limit ระบบต้องห้าม

> **As a** Admin user, **I want** the system to block invalid Delivery Point submissions, **so that** data quality is preserved.

**Priority:** Medium · **Test Type:** Validation

**Preconditions**

ผู้ใช้ login แล้ว

**Steps**

1. เปิดหน้า list
2. กด Add
3. กรอก name ยาว 150 ตัวอักษร
4. ตรวจสอบ value

**Expected**

name input ตัดข้อความให้ยาวไม่เกิน 100 ตัวอักษร

---

## TC-DP-200004 — กรอก name เป็น space ล้วน ระบบต้องด่า

> **As a** Admin user, **I want** the system to block invalid Delivery Point submissions, **so that** data quality is preserved.

**Priority:** Medium · **Test Type:** Validation

**Preconditions**

ผู้ใช้ login แล้ว

**Steps**

1. เปิดหน้า list
2. กด Add
3. กรอก name = '    ' (space ล้วน)
4. กด Save

**Expected**

แสดง error message และ dialog ยังเปิดอยู่ (ไม่บันทึก space ล้วน)

---

## TC-DP-200005 — ลบ name ออกทั้งหมดแล้ว save ระบบต้องด่า

> **As a** Admin user, **I want** the system to block invalid Delivery Point submissions, **so that** data quality is preserved.

**Priority:** Medium · **Test Type:** Validation

**Preconditions**

ผู้ใช้ login แล้ว และมี DP_NAME_UPDATED ใน table

**Steps**

1. เปิดหน้า list
2. search DP_NAME_UPDATED
3. คลิก row
4. clear name
5. Save

**Expected**

แสดง error message field require — ไม่อนุญาตให้ save name ว่าง

---


<sub>Last regenerated: 2026-11-21 · git a4a6565</sub>
