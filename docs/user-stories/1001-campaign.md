# Campaign — User Stories

_Generated from `tests/1001-campaign.spec.ts` annotations. Edit annotations, not this file. Regenerate with `bun docs:user-stories`._

**Module:** Campaign
**Spec:** `tests/1001-campaign.spec.ts`
**Default role:** Admin
**Total test cases:** 23 (12 High / 8 Medium / 3 Low)

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-CAM-010001 | View Campaign List - Happy Path | High | Happy Path |
| TC-CAM-010002 | View Campaign List - Invalid Permissions | High | Authorization |
| TC-CAM-010050 | active BU = BLAVG | High | Smoke |
| TC-CAM-010051 | หน้า list โหลดสำเร็จ (admin/BLAVG) + ปุ่ม Add แสดง | High | Smoke |
| TC-CAM-010052 | ค้นหาคำที่ไม่มี → empty state | Medium | Negative |
| TC-CAM-020001 | Happy Path - Create Campaign with All Valid Inputs | High | Happy Path |
| TC-CAM-020002 | Negative Path - Missing Required Fields | High | Negative |
| TC-CAM-030001 | View active campaign detail | High | Happy Path |
| TC-CAM-030002 | User with no permission to view campaign detail | High | Authorization |
| TC-CAM-030003 | Campaign detail with draft status | Medium | Alternate Flow |
| TC-CAM-030004 | View campaign detail with empty performance summary | Medium | Edge Case |
| TC-CAM-030005 | Campaign detail with future start date | Low | Edge Case |
| TC-CAM-040001 | Edit Existing Campaign with Valid Data | High | Happy Path |
| TC-CAM-040002 | Edit Campaign with Invalid Priority Value | Medium | Negative |
| TC-CAM-040003 | Edit Campaign with No Permission | High | Authorization |
| TC-CAM-040004 | Edit Campaign with No Data Changes | Low | Edge Case |
| TC-CAM-080001 | Happy Path - Delete Campaign | Medium | Happy Path |
| TC-CAM-080004 | Negative - No Permission | High | Authorization |
| TC-CAM-090001 | Export campaign data - happy path | Medium | Happy Path |
| TC-CAM-090002 | Export campaign data - no permission | Medium | Authorization |
| TC-CAM-090004 | Export campaign data - multiple exports | Low | Edge Case |
| TC-CAM-100002 | Search by Text - Valid Term | High | Functional |
| TC-CAM-100004 | Search by Text - No Matching Terms | Medium | Negative |

---

## TC-CAM-010001 — View Campaign List - Happy Path

> **As a** Admin user, **I want** this Campaign behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Happy Path

**Preconditions**

Login เป็น carmensoftware.dev+purchase@gmail.com; BU มี campaign STD ที่ data:reset สร้างไว้ 3 รายการ (draft / active / expired)

**Steps**

1. ไปที่ /vendor-management/request-price-list
2. ตรวจสอบตารางแสดง campaign ที่ seed ไว้
3. คลิกชื่อ 'STD campaign.active'

**Expected**

ตารางแสดงแถว STD campaign.draft / .active / .expired; คลิกชื่อแล้วไปหน้า /request-price-list/<id> ที่แสดงชื่อ campaign และสถานะรอบ 'days left'

---

## TC-CAM-010002 — View Campaign List - Invalid Permissions

> **As a** low-privilege user, **I should NOT** see Add/edit controls on Campaign, **so that** role separation is enforced.

**Priority:** High · **Test Type:** Authorization

**Preconditions**

Login เป็น carmensoftware.dev+requestor@gmail.com ซึ่งไม่ควรมีสิทธิ์ดู campaign list

**Steps**

1. ไปที่ /vendor-management/request-price-list
2. ตรวจสอบ error message หรือ redirect

**Expected**

ผู้ใช้ถูก redirect ออกจากหน้า list หรือเห็น permission denied (ไม่เห็นตาราง campaign)

---

## TC-CAM-010050 — active BU = BLAVG

> **As a** Admin user, **I want** core Campaign interactions to work, **so that** day-to-day usage stays smooth.

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

## TC-CAM-010051 — หน้า list โหลดสำเร็จ (admin/BLAVG) + ปุ่ม Add แสดง

> **As a** Admin user, **I want** the Campaign list page to load successfully, **so that** I can manage Campaign records.

**Priority:** High · **Test Type:** Smoke

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG; มีสิทธิ์เข้าถึง Vendor Management

**Steps**

1. ไปที่ /vendor-management/request-price-list
2. ตรวจสอบ URL และ heading 'Request for Pricing'
3. ตรวจสอบว่าปุ่ม 'Add Request' แสดง

**Expected**

URL เป็น /vendor-management/request-price-list, heading 'Request for Pricing' แสดง, และปุ่ม Add แสดง (hard assert)

---

## TC-CAM-010052 — ค้นหาคำที่ไม่มี → empty state

> **As a** Admin user, **I want** this Campaign behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Negative

**Preconditions**

Login เป็น carmensoftware.dev+admin@gmail.com; active BU = BLAVG; มีสิทธิ์เข้าถึง Request for Pricing

**Steps**

1. ไปที่ /vendor-management/request-price-list
2. กรอกคำค้นหาที่ไม่มีอยู่จริงในช่อง Search แล้วกด Enter
3. ตรวจสอบว่าแสดง empty state

**Expected**

ตารางแสดง empty state ('No data found') สำหรับคำค้นที่ไม่ตรง (hard assert)

---

## TC-CAM-020001 — Happy Path - Create Campaign with All Valid Inputs

> **As a** Admin user, **I want** this Campaign behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Happy Path

**Preconditions**

Login เป็น carmensoftware.dev+purchase@gmail.com; มี template 'STD campaign template'

**Steps**

1. ไปที่ /vendor-management/request-price-list แล้วกด 'New Price Request'
2. กรอก Name
3. เลือก Template
4. เลือก Start Date (อีก 10 วัน) และ End Date (อีก 40 วัน)
5. กด 'Create'

**Expected**

แสดง toast 'created successfully'; campaign ใหม่ค้นเจอในตารางหน้า list พร้อมสถานะรอบ 'Upcoming'

---

## TC-CAM-020002 — Negative Path - Missing Required Fields

> **As a** Admin user, **I want** this Campaign behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Negative

**Preconditions**

Login เป็น carmensoftware.dev+purchase@gmail.com; อยู่ที่ /vendor-management/request-price-list/new

**Steps**

1. กรอกเฉพาะ Name
2. กด 'Create' โดยไม่เลือก Template / Start Date / End Date

**Expected**

ฟอร์มไม่ถูกบันทึก: ยังอยู่ที่ /new และ Template / Start Date / End Date แสดง error required

---

## TC-CAM-030001 — View active campaign detail

> **As a** Admin user, **I want** this Campaign behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Happy Path

**Preconditions**

Login เป็น carmensoftware.dev+purchase@gmail.com; มี campaign 'STD campaign.active' (รอบรับราคากำลังเปิด)

**Steps**

1. เปิดหน้า list แล้วคลิก 'STD campaign.active'

**Expected**

หน้ารายละเอียดแสดงชื่อ, template 'STD campaign template', ช่วง Request Period, ป้าย 'N days left', ตาราง Vendors มี 1 แถว และปุ่ม Edit / Delete

---

## TC-CAM-030002 — User with no permission to view campaign detail

> **As a** low-privilege user, **I should NOT** see Add/edit controls on Campaign, **so that** role separation is enforced.

**Priority:** High · **Test Type:** Authorization

**Preconditions**

Login เป็น carmensoftware.dev+requestor@gmail.com ซึ่งไม่ควรมีสิทธิ์ดู campaign

**Steps**

1. ไปที่ /vendor-management/request-price-list
2. เปิดรายละเอียด campaign

**Expected**

ไม่สามารถเปิดรายละเอียดได้ (permission denied / redirect)

---

## TC-CAM-030003 — Campaign detail with draft status

> **As a** Admin user, **I want** this Campaign behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Alternate Flow

**Preconditions**

Login เป็น carmensoftware.dev+purchase@gmail.com; มี campaign 'STD campaign.draft' (รอบยังไม่เริ่ม)

**Steps**

1. เปิดหน้า list แล้วคลิก 'STD campaign.draft'

**Expected**

ป้ายสถานะรอบเป็น 'Upcoming' (ไม่ใช่ 'days left' หรือ 'Closed')

---

## TC-CAM-030004 — View campaign detail with empty performance summary

> **As a** Admin user, **I want** this Campaign behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Edge Case

**Preconditions**

Login เป็น carmensoftware.dev+purchase@gmail.com; campaign STD ยังไม่มี vendor ตอบราคา

**Steps**

1. เปิดรายละเอียด 'STD campaign.active'
2. ดูสรุปส่วน Vendors

**Expected**

สรุปแสดง '0 of 1 vendor has submitted prices' และคอลัมน์ Price List ของ vendor เป็น '—'

---

## TC-CAM-030005 — Campaign detail with future start date

> **As a** Admin user, **I want** this Campaign behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Low · **Test Type:** Edge Case

**Preconditions**

Login เป็น carmensoftware.dev+purchase@gmail.com; 'STD campaign.draft' เริ่มในอนาคต

**Steps**

1. เปิดรายละเอียด 'STD campaign.draft'
2. อ่านช่วง Request Period

**Expected**

วันเริ่มต้นของ Request Period อยู่หลังวันนี้

---

## TC-CAM-040001 — Edit Existing Campaign with Valid Data

> **As a** Admin user, **I want** this Campaign behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** High · **Test Type:** Happy Path

**Preconditions**

Login เป็น carmensoftware.dev+purchase@gmail.com; มี campaign E2E ที่ TC-CAM-020001 สร้าง (สร้างให้ถ้ายังไม่มี)

**Steps**

1. เปิดรายละเอียด campaign E2E
2. กด 'Edit'
3. เปลี่ยน Name
4. กด 'Save'

**Expected**

แสดง toast 'updated successfully' และชื่อใหม่ปรากฏในตารางหน้า list

---

## TC-CAM-040002 — Edit Campaign with Invalid Priority Value

> **As a** Admin user, **I want** this Campaign behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Negative

**Preconditions**

Login เป็น carmensoftware.dev+purchase@gmail.com; อยู่ที่ฟอร์มสร้าง campaign (ไม่มีช่อง priority แล้ว — ใช้วันที่สิ้นสุดก่อนวันเริ่มแทน)

**Steps**

1. ไปที่ /vendor-management/request-price-list/new
2. กรอก Name และเลือก Template
3. เลือก Start Date อีก 40 วัน แล้วเลือก End Date ก่อนหน้านั้น
4. กด 'Create'

**Expected**

ไม่บันทึก: ยังอยู่ที่ /new และช่อง End Date ถูกเลือกไม่ได้ย้อนก่อนวันเริ่ม (ปฏิทินปิดวันก่อน Start Date)

---

## TC-CAM-040003 — Edit Campaign with No Permission

> **As a** low-privilege user, **I should NOT** see Add/edit controls on Campaign, **so that** role separation is enforced.

**Priority:** High · **Test Type:** Authorization

**Preconditions**

Login เป็น carmensoftware.dev+requestor@gmail.com ซึ่งไม่ควรมีสิทธิ์แก้ไข campaign

**Steps**

1. เปิดรายละเอียด 'STD campaign.active'

**Expected**

ไม่มีปุ่ม Edit (หรือปุ่มถูก disable)

---

## TC-CAM-040004 — Edit Campaign with No Data Changes

> **As a** Admin user, **I want** this Campaign behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Low · **Test Type:** Edge Case

**Preconditions**

Login เป็น carmensoftware.dev+purchase@gmail.com; เปิดรายละเอียด 'STD campaign.active'

**Steps**

1. กด 'Edit'
2. ไม่แก้ไขอะไร
3. กด 'Cancel'

**Expected**

กลับสู่โหมดดู (มีปุ่ม Edit) โดยไม่มี dialog ยืนยันทิ้งการแก้ไข และไม่มี toast บันทึก

---

## TC-CAM-080001 — Happy Path - Delete Campaign

> **As a** Admin user, **I want** this Campaign behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Happy Path

**Preconditions**

Login เป็น carmensoftware.dev+purchase@gmail.com; มี campaign E2E ที่สร้างเองโดยสเปคนี้ (สร้างให้ถ้ายังไม่มี) — ไม่แตะ campaign STD

**Steps**

1. เปิดรายละเอียด campaign E2E
2. กด 'Delete'
3. ยืนยัน 'Delete' ใน dialog

**Expected**

แสดง toast 'deleted successfully'; กลับหน้า list และ campaign E2E ไม่อยู่ในตารางอีก

---

## TC-CAM-080004 — Negative - No Permission

> **As a** low-privilege user, **I should NOT** see Add/edit controls on Campaign, **so that** role separation is enforced.

**Priority:** High · **Test Type:** Authorization

**Preconditions**

Login เป็น carmensoftware.dev+requestor@gmail.com ซึ่งไม่ควรมีสิทธิ์ลบ campaign

**Steps**

1. เปิดรายละเอียด 'STD campaign.active'

**Expected**

ไม่มีปุ่ม Delete (หรือปุ่มถูก disable)

---

## TC-CAM-090001 — Export campaign data - happy path

> **As a** Admin user, **I want** this Campaign behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Happy Path

**Preconditions**

Login เป็น carmensoftware.dev+purchase@gmail.com; มี campaign อย่างน้อย 1 รายการ

**Steps**

1. ไปที่ /vendor-management/request-price-list
2. กด 'Export'

**Expected**

เบราว์เซอร์ดาวน์โหลดไฟล์ .xlsx และแสดง toast ส่งออกสำเร็จ

---

## TC-CAM-090002 — Export campaign data - no permission

> **As a** low-privilege user, **I should NOT** see Add/edit controls on Campaign, **so that** role separation is enforced.

**Priority:** Medium · **Test Type:** Authorization

**Preconditions**

Login เป็น carmensoftware.dev+requestor@gmail.com ซึ่งไม่ควรมีสิทธิ์ export ข้อมูล campaign

**Steps**

1. ไปที่ /vendor-management/request-price-list

**Expected**

ไม่มีปุ่ม Export หรือปุ่มถูก disable

---

## TC-CAM-090004 — Export campaign data - multiple exports

> **As a** Admin user, **I want** this Campaign behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Low · **Test Type:** Edge Case

**Preconditions**

Login เป็น carmensoftware.dev+purchase@gmail.com; มี campaign อย่างน้อย 1 รายการ

**Steps**

1. ไปที่ /vendor-management/request-price-list
2. กด 'Export' 3 ครั้งติดกัน รอดาวน์โหลดทุกครั้ง

**Expected**

ทุกครั้งดาวน์โหลดไฟล์ .xlsx สำเร็จ (ปุ่ม Export กลับมากดได้อีกหลังแต่ละครั้ง)

---

## TC-CAM-100002 — Search by Text - Valid Term

> **As a** Admin user, **I want** this Campaign interaction to behave as expected, **so that** the workflow stays predictable.

**Priority:** High · **Test Type:** Functional

**Preconditions**

Login เป็น carmensoftware.dev+purchase@gmail.com; มี campaign STD 3 รายการ

**Steps**

1. ไปที่ /vendor-management/request-price-list
2. พิมพ์ 'STD campaign.active' ในช่อง Search แล้วกด Enter

**Expected**

ตารางเหลือ 'STD campaign.active' และไม่แสดง .draft / .expired

---

## TC-CAM-100004 — Search by Text - No Matching Terms

> **As a** Admin user, **I want** this Campaign behavior verified, **so that** the feature works as expected.
<!-- TODO: refine narrative -->

**Priority:** Medium · **Test Type:** Negative

**Preconditions**

Login เป็น carmensoftware.dev+purchase@gmail.com และอยู่ที่หน้า Campaigns

**Steps**

1. พิมพ์ 'NonexistentTerm' ใน search input แล้วกด Enter
2. ตรวจสอบว่าไม่มี campaign แสดง

**Expected**

ไม่มี campaign แสดงและเห็น empty state

---


<sub>Last regenerated: 2026-11-21 · git a4a6565</sub>
