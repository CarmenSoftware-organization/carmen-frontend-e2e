# Wastage Reporting — User Stories

_Generated from `tests/710-wastage-reporting.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Wastage Reporting
**Spec:** `tests/710-wastage-reporting.spec.ts`
**Default role:** Requestor
**Total test cases:** 18 (7 High / 6 Medium / 5 Low)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-WAST-010001 | หน้า list Wastage Reporting โหลดสำเร็จ | High | Smoke |
| TC-WAST-010002 | คอลัมน์ตาราง (วันหมดอายุ/สินค้า/สถานที่/lot/GRN/จำนวนคงเหลือ/ต้นทุน/มูลค่า) แสดงครบ | Medium | Functional |
| TC-WAST-010004 | ค้นหาด้วยการกด Enter ในช่อง Search ส่งคำค้นไปกรองที่ API | Medium | Functional |
| TC-WAST-010005 | ค้นหาคำที่ไม่มีต้องแสดง empty state | Medium | Functional |
| TC-WAST-010006 | ตัวกรองสถานะ (Expired / Expiring) แบบ segmented กรองรายการได้จริง | High | Functional |
| TC-WAST-010007 | pagination เปลี่ยนหน้าได้และ request ส่งหน้าใหม่ | Low | Functional |
| TC-WAST-010008 | summary bar แสดงจำนวน All/Expired/Expiring และมูลค่าที่เสี่ยง | High | Functional |
| TC-WAST-010009 | กดปุ่ม All ล้างตัวกรองสถานะที่เลือกไว้ | Medium | Functional |
| TC-WAST-010010 | ตารางเรียงตามวันหมดอายุตายตัว — ไม่มีปุ่ม sort และ API ไม่ได้รับ sort | Medium | Functional |
| TC-WAST-010012 | ปุ่ม Clear search ใน empty state คืนรายการทั้งหมด | Low | Alternate Flow |
| TC-WAST-010050 | request ของหน้านี้ไปที่ BU ที่ active (TEST BU) | High | Smoke |
| TC-WAST-020001 | กด GRN No. เปิดใบ GRN ต้นทาง | High | Smoke |
| TC-WAST-020003 | คลิกเซลล์อื่นหรือตัวแถวไม่นำทางออกจากหน้า | Low | Functional |
| TC-WAST-100001 | ผู้ใช้ไม่มีสิทธิ์ stock_out.view ต้องเห็นกล่องปฏิเสธสิทธิ์ | High | Authorization |
| TC-WAST-100002 | ผู้ที่ไม่ได้ login เข้าหน้าตรง ๆ ต้องถูก redirect ไป /login | High | Auth-guard |
| TC-WAST-100003 | BU ที่มี license wastage_reporting เข้าหน้าและโหลดข้อมูลได้ | Low | Authorization |
| TC-WAST-900001 | mobile: ตารางเป็นการ์ดเซลล์เดียว (สินค้า+GRN) และหน้าไม่ล้นแนวนอน | Low | Edge Case |
| TC-WAST-900002 | API ล้มเหลวต้องแสดง ErrorState พร้อมปุ่มลองใหม่ | Medium | Edge Case |

---

## TC-WAST-010001 — หน้า list Wastage Reporting โหลดสำเร็จ

> **As a** Requestor user, **I want** the Wastage Reporting list page to load successfully, **so that** I can manage Wastage Reporting records.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

เข้าสู่ระบบเป็น Admin; active BU = TEST BU (BU-GR2VYNKQ); BU มี license store_operations.wastage_reporting

**Steps**

1. ไปที่ /store-operation/wastage-reporting

**Expected**

URL ตรงกับ path; หัวข้อ 'Wastage Reporting' และคำอธิบาย 'within 30 days' แสดง; toolbar มีช่องค้นหา; มีกลุ่มปุ่มสถานะ All / Expired / Expiring; ไม่มีปุ่ม Filter/View/Add

---

## TC-WAST-010002 — คอลัมน์ตาราง (วันหมดอายุ/สินค้า/สถานที่/lot/GRN/จำนวนคงเหลือ/ต้นทุน/มูลค่า) แสดงครบ

> **As a** Requestor user, **I want** this Wastage Reporting interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

เข้าสู่ระบบเป็น Admin; active BU = TEST BU (BU-GR2VYNKQ); endpoint wastage-reporting ถูก mock ด้วย fixture (TEST BU ไม่มี lot ที่ใกล้หมดอายุหลัง data:reset); viewport 1920x1080 (ตารางแสดงครบทุกคอลัมน์)

**Steps**

1. ไปที่ /store-operation/wastage-reporting
2. ตรวจหัวตารางและเซลล์ของ lot ตัวอย่าง

**Expected**

หัวตารางมี Expiry Date, Product, Location, Lot No., GRN No., Remaining Qty, Cost/Unit, Remaining Value และแถวแสดงค่าของ lot

---

## TC-WAST-010004 — ค้นหาด้วยการกด Enter ในช่อง Search ส่งคำค้นไปกรองที่ API

> **As a** Requestor user, **I want** to filter the Wastage Reporting list, **so that** I can narrow results to relevant records.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

เข้าสู่ระบบเป็น Admin; active BU = TEST BU (BU-GR2VYNKQ); endpoint wastage-reporting ถูก mock ด้วย fixture (TEST BU ไม่มี lot ที่ใกล้หมดอายุหลัง data:reset)

**Steps**

1. ไปที่ /store-operation/wastage-reporting
2. พิมพ์ 'E2E Product 2' ลงช่อง Search
3. กด Enter

**Expected**

URL เพิ่ม search=<คำค้น>; ยิง request ใหม่พร้อม search=<คำค้น>

---

## TC-WAST-010005 — ค้นหาคำที่ไม่มีต้องแสดง empty state

> **As a** Requestor user, **I want** a clear empty-state when no Wastage Reporting records match my search, **so that** I know nothing was found.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

เข้าสู่ระบบเป็น Admin; active BU = TEST BU (BU-GR2VYNKQ); ใช้ API จริง

**Steps**

1. ไปที่ /store-operation/wastage-reporting
2. พิมพ์คำค้นที่ไม่มีในระบบแล้วกด Enter

**Expected**

ตารางไม่มีแถว lot และแสดง empty state 'Nothing matches “<คำค้น>”' พร้อมปุ่ม Clear search

---

## TC-WAST-010006 — ตัวกรองสถานะ (Expired / Expiring) แบบ segmented กรองรายการได้จริง

> **As a** Requestor user, **I want** to filter the Wastage Reporting list, **so that** I can narrow results to relevant records.

**Priority:** High · **Test Type:** Functional

**Preconditions**

เข้าสู่ระบบเป็น Admin; active BU = TEST BU (BU-GR2VYNKQ); endpoint wastage-reporting ถูก mock ด้วย fixture (TEST BU ไม่มี lot ที่ใกล้หมดอายุหลัง data:reset); fixture มี lot หมดอายุ 1 และใกล้หมด 1

**Steps**

1. ไปที่ /store-operation/wastage-reporting
2. กดปุ่ม Expired ในกลุ่มสถานะ

**Expected**

URL เป็น ?status=expired; ยิง request พร้อม status=expired; ปุ่ม Expired ถูกเลือก; ตารางเหลือเฉพาะ lot ที่หมดอายุ

---

## TC-WAST-010007 — pagination เปลี่ยนหน้าได้และ request ส่งหน้าใหม่

> **As a** Requestor user, **I want** to paginate through Wastage Reporting records, **so that** I can browse large lists efficiently.

**Priority:** Low · **Test Type:** Functional

**Preconditions**

เข้าสู่ระบบเป็น Admin; active BU = TEST BU (BU-GR2VYNKQ); endpoint wastage-reporting ถูก mock ด้วย fixture (TEST BU ไม่มี lot ที่ใกล้หมดอายุหลัง data:reset); fixture 12 lot (perpage 10 → 2 หน้า)

**Steps**

1. ไปที่ /store-operation/wastage-reporting
2. กดปุ่มหน้าถัดไป

**Expected**

URL เพิ่ม page=2; ยิง request page=2; ตารางแสดงเฉพาะ lot ลำดับที่ 11-12

---

## TC-WAST-010008 — summary bar แสดงจำนวน All/Expired/Expiring และมูลค่าที่เสี่ยง

> **As a** Requestor user, **I want** this Wastage Reporting interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

เข้าสู่ระบบเป็น Admin; active BU = TEST BU (BU-GR2VYNKQ); endpoint wastage-reporting ถูก mock ด้วย fixture (TEST BU ไม่มี lot ที่ใกล้หมดอายุหลัง data:reset); fixture หมดอายุ 1 ใกล้หมด 1 (มูลค่ารวม 200)

**Steps**

1. ไปที่ /store-operation/wastage-reporting
2. ตรวจแถบสถานะเหนือตาราง

**Expected**

ปุ่ม All=2, Expired=1, Expiring=1 และ Value at risk แสดง 200

---

## TC-WAST-010009 — กดปุ่ม All ล้างตัวกรองสถานะที่เลือกไว้

> **As a** Requestor user, **I want** to filter the Wastage Reporting list, **so that** I can narrow results to relevant records.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

เข้าสู่ระบบเป็น Admin; active BU = TEST BU (BU-GR2VYNKQ); endpoint wastage-reporting ถูก mock ด้วย fixture (TEST BU ไม่มี lot ที่ใกล้หมดอายุหลัง data:reset)

**Steps**

1. เปิดหน้าพร้อม ?status=expired
2. กดปุ่ม All

**Expected**

URL ไม่มี status; ตารางกลับมาแสดงทุกสถานะ; request ถัดมาไม่มี status

---

## TC-WAST-010010 — ตารางเรียงตามวันหมดอายุตายตัว — ไม่มีปุ่ม sort และ API ไม่ได้รับ sort

> **As a** Requestor user, **I want** a clear empty-state when no Wastage Reporting records match my search, **so that** I know nothing was found.

**Priority:** Medium · **Test Type:** Functional

**Preconditions**

เข้าสู่ระบบเป็น Admin; active BU = TEST BU (BU-GR2VYNKQ); endpoint wastage-reporting ถูก mock ด้วย fixture (TEST BU ไม่มี lot ที่ใกล้หมดอายุหลัง data:reset)

**Steps**

1. ไปที่ /store-operation/wastage-reporting?sort=expired_at:desc
2. ตรวจหัวตารางและ request

**Expected**

หัวคอลัมน์ไม่มีปุ่ม sort; request ไป API ไม่มีพารามิเตอร์ sort

---

## TC-WAST-010012 — ปุ่ม Clear search ใน empty state คืนรายการทั้งหมด

> **As a** Requestor user, **I want** this Wastage Reporting behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Low · **Test Type:** Alternate Flow

**Preconditions**

เข้าสู่ระบบเป็น Admin; active BU = TEST BU (BU-GR2VYNKQ); ใช้ API จริง

**Steps**

1. ไปที่ /store-operation/wastage-reporting?search=SAMPLE
2. กดปุ่ม Clear search

**Expected**

ช่องค้นหาว่าง และ search ถูกล้างจาก URL

---

## TC-WAST-010050 — request ของหน้านี้ไปที่ BU ที่ active (TEST BU)

> **As a** Requestor user, **I want** core Wastage Reporting interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

เข้าสู่ระบบเป็น Admin; active BU = TEST BU (BU-GR2VYNKQ); ผู้ใช้ผูกกับ TEST BU

**Steps**

1. ไปที่ /store-operation/wastage-reporting
2. ตรวจ URL ของ request รายการ lot

**Expected**

ยิง GET /api/BU-GR2VYNKQ/wastage-reporting สำเร็จ (200)

---

## TC-WAST-020001 — กด GRN No. เปิดใบ GRN ต้นทาง

> **As a** Requestor user, **I want** core Wastage Reporting interactions to work, **so that** day-to-day usage stays smooth.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

เข้าสู่ระบบเป็น Admin; active BU = TEST BU (BU-GR2VYNKQ); endpoint wastage-reporting ถูก mock ด้วย fixture (TEST BU ไม่มี lot ที่ใกล้หมดอายุหลัง data:reset)

**Steps**

1. ไปที่ /store-operation/wastage-reporting
2. กดที่ GRN No. ของ lot

**Expected**

นำทางไปยัง /procurement/goods-receive-note/{grn_id} ของ lot นั้น

---

## TC-WAST-020003 — คลิกเซลล์อื่นหรือตัวแถวไม่นำทางออกจากหน้า

> **As a** Requestor user, **I want** this Wastage Reporting interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** Low · **Test Type:** Functional

**Preconditions**

เข้าสู่ระบบเป็น Admin; active BU = TEST BU (BU-GR2VYNKQ); endpoint wastage-reporting ถูก mock ด้วย fixture (TEST BU ไม่มี lot ที่ใกล้หมดอายุหลัง data:reset)

**Steps**

1. คลิกที่เซลล์ Product และ Location
2. ตรวจสอบ URL

**Expected**

URL ยังคงเป็น /store-operation/wastage-reporting

---

## TC-WAST-100001 — ผู้ใช้ไม่มีสิทธิ์ stock_out.view ต้องเห็นกล่องปฏิเสธสิทธิ์

> **As a** low-privilege user, **I should NOT** see Add/edit controls on Wastage Reporting, **so that** role separation is enforced.

**Priority:** High · **Test Type:** Authorization

**Preconditions**

เข้าสู่ระบบเป็น Requestor (ไม่มี inventory_management.stock_out ใน /api/user/profile)

**Steps**

1. เปิด /store-operation/wastage-reporting โดยตรง

**Expected**

แสดงกล่อง Permission Denied และไม่แสดงตาราง lot

---

## TC-WAST-100002 — ผู้ที่ไม่ได้ login เข้าหน้าตรง ๆ ต้องถูก redirect ไป /login

> **As an** unauthenticated user hitting a protected route, **I want** to be redirected to /login, **so that** protected screens stay protected.

**Priority:** High · **Test Type:** Auth-guard

**Preconditions**

ไม่มี session (browser context ใหม่)

**Steps**

1. เปิด /store-operation/wastage-reporting ใน context ที่ไม่มี session

**Expected**

ถูก redirect ไปยัง /login และไม่มีข้อมูล lot บนจอ

---

## TC-WAST-100003 — BU ที่มี license wastage_reporting เข้าหน้าและโหลดข้อมูลได้

> **As a** low-privilege user, **I should NOT** see Add/edit controls on Wastage Reporting, **so that** role separation is enforced.

**Priority:** Low · **Test Type:** Authorization

**Preconditions**

เข้าสู่ระบบเป็น Admin; active BU = TEST BU (BU-GR2VYNKQ); license store_operations.wastage_reporting ของ TEST BU

**Steps**

1. เข้า /store-operation/wastage-reporting

**Expected**

หน้าเปิดตามปกติ (ไม่มีกล่องปฏิเสธ license) และ endpoint ตอบ 200

---

## TC-WAST-900001 — mobile: ตารางเป็นการ์ดเซลล์เดียว (สินค้า+GRN) และหน้าไม่ล้นแนวนอน

> **As a** Requestor user, **I want** this Wastage Reporting behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Low · **Test Type:** Edge Case

**Preconditions**

เข้าสู่ระบบเป็น Admin; active BU = TEST BU (BU-GR2VYNKQ); endpoint wastage-reporting ถูก mock ด้วย fixture (TEST BU ไม่มี lot ที่ใกล้หมดอายุหลัง data:reset); viewport 375x667

**Steps**

1. เปิด /store-operation/wastage-reporting ด้วย viewport 375x667

**Expected**

แถวแสดงสินค้า/คลัง/lot/GRN ในเซลล์เดียว; ไม่มีหัวตาราง Cost/Unit; scrollWidth ของหน้าไม่เกินความกว้างจอ

---

## TC-WAST-900002 — API ล้มเหลวต้องแสดง ErrorState พร้อมปุ่มลองใหม่

> **As a** Requestor user, **I want** this Wastage Reporting behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Edge Case

**Preconditions**

เข้าสู่ระบบเป็น Admin; active BU = TEST BU (BU-GR2VYNKQ)

**Steps**

1. ตั้ง route interception ให้ endpoint ตอบ 500
2. เปิด /store-operation/wastage-reporting
3. ปลด interception แล้วกดปุ่มลองใหม่

**Expected**

แสดง ErrorState พร้อมปุ่ม Try again และกดลองใหม่แล้วหัวข้อหน้า+ตารางกลับมา

---


<sub>Last regenerated: 2026-11-24 · git f462816</sub>
