# Section Landing Pages & 404 — Test Cases

_Test-case catalog (documentation only; no automated Playwright spec yet). Authored from the React app section landings (`routes/<section>/<section>.route.tsx` ที่ประกาศเป็น index route ใน `routes/router.tsx`), `components/dashboard-widget/dashboard-widget-grid.tsx`, `components/module-landing.tsx`, `routes/system-admin/system-admin-landing.tsx` และ `components/not-found-component.tsx`. Follows the TC-ID scheme in `docs/test-id-scheme.md`._

**Module:** Section landing / navigation shell pages + Not-Found (404)
**Frontend route:** `routes/<section>/<section>.route.tsx` (index route ของแต่ละหมวด), `routes/not-found`  •  **URL:** `/config` `/dashboard` `/inventory-management` `/operation-plan` `/procurement` `/product-management` `/store-operation` `/system-admin` `/vendor-management` `/*`
**Prefix:** `LAND`
**Default role:** Admin (`admin@blueledgers.com`, active BU = `BLAVG`) — ยกเว้นเคสที่ระบุ role อื่นไว้ในหัวข้อ Preconditions
**Total test cases:** 22

> หมายเหตุสำคัญสำหรับผู้รีวิว: หัวเอกสารเคยชี้ `routes/*/page.tsx` ซึ่งเป็นโครงของแอป Next.js เดิม แอปปัจจุบันประกาศ landing เป็น index route ใน `routes/router.tsx` จึง re-point เมื่อ 2026-09-20 และเพิ่มรายการ URL ที่เอกสารนี้ครอบจริงเพื่อให้ `bun audit:coverage` จับคู่ได้ เอกสารนี้**ไม่ครอบ** landing ของ `/report` และ `/general-ledger` (ยังไม่มีเคส)
>
> **สอบทานเนื้อเคสรอบแรก 2026-09-20** (ของเดิมยกมาจากรอบ 2026-06-17 โดยไม่เคยสอบทาน) — สิ่งที่ผู้รีวิวต้องรู้:
> 1. **Landing มี 3 ทรง ไม่ใช่ 2** — (ก) `DashboardWidgetGrid` ใช้ร่วมกันที่ `/procurement` `/vendor-management` `/inventory-management` `/product-management` (ผ่าน `dashboard-widget-grid-lazy.tsx`), (ข) กริดเขียนเองที่ `/config` (`config-dashboard.tsx`) และ `/operation-plan` (`operation-dashboard.tsx`) ซึ่งแบ่งเป็น section `Metrics` / `Comparison` / `Distribution` และใส่ `aria-busy` ไว้ที่บล็อก skeleton (มีเฉพาะตอนโหลด) ไม่ใช่ที่ตัวกริดถาวร, (ค) landing ที่ไม่ใช่กริดเลยคือ `/store-operation` (`ModuleLanding` = การ์ด sub-module) และ `/system-admin` (`SystemAdminLanding` = hero + 5 chapter + footer)
> 2. **`/dashboard` อยู่ในบรรทัด URL แต่ไม่มีเคสของตัวเองที่นี่** — dashboard ส่วนตัวมีแคตตาล็อกแยกที่ `docs/test-cases/1200-dashboard.md` เอกสารนี้แตะ `/dashboard` เฉพาะในฐานะ **ปลายทาง** ของ TC-LAND-010010 และ TC-LAND-900005 เท่านั้น เช่นเดียวกับ `/report` ที่มี `docs/test-cases/1202-report.md` อยู่แล้ว ส่วน `/general-ledger` ยังไม่เพิ่มเคสเพราะ `accounting.dashboard.tsx` **ฮาร์ดโค้ดข้อมูล widget ทั้ง 6 ใบไว้ใน source** (ไม่ยิง API) จึงไม่ใช่การทดสอบระบบจริง — บรรทัด URL จึงคงเดิม ไม่เพิ่ม `/report` `/general-ledger`
> 3. **หน้า 404 เป็น public** — `{ path: "*" }` ใน `routes/router.tsx` เป็น **พี่น้อง** ของ `ProtectedShell` ไม่ใช่ลูก ผู้ใช้ที่ไม่ได้ล็อกอินเปิด URL มั่วจึงเห็นหน้า 404 (ไม่ถูกเด้งไป `/login`) และหน้านี้เป็น full-screen ของตัวเอง ไม่มี navbar/sidebar ของแอป (ดู TC-LAND-100002)
> 4. **Auth guard ไม่ใช้ `?next=`** — `components/auth/require-auth.tsx` ทำ `<Navigate to="/login" replace state={{ from }} />` ปลายทางจึงเป็น `/login` เปล่า ๆ **ห้าม assert query string** (เคสเดิม TC-LAND-100001 ไม่ได้ระบุไว้ — เติมแล้ว)
> 5. **Section landing ไม่ถูก RouteGuard บล็อก** — `findRouteLeaf()` คืน node ที่ยาวที่สุดที่แมตช์ และ `/config` `/procurement` ฯลฯ เป็น **node แม่** ที่ไม่ประกาศ `permission`/`licenseFeature` ใน `constant/module-list.ts` → `RouteGuard` ปล่อยผ่าน landing ทุกหมวด สิทธิ์ไปมีผลที่ **หน้าลูก** และที่ **การ์ด/ไทล์** ที่ landing แสดงเท่านั้น
> 6. **Admin ไม่เห็นการ์ดสถานะ `denied` เลย** — `useVisibleModules()` เรียก `markAll()` เมื่อ `isAdmin` ซึ่งบังคับ `denied: false` ทุก node (`hooks/use-visible-modules.ts`) TC-LAND-400002 และ TC-LAND-100003 จึง **รันเป็น admin ไม่ได้** ต้องใช้ role ที่ไม่มีสิทธิ์จริง และใน `/store-operation` การ์ด **Store Requisition ไม่มี `permission` เลย** (มีแต่ `licenseFeature`) จะ denied ไม่ได้ — เคส denied ต้องเล็งไปที่ Stock Replenishment (`inventory_management.stock_in.view`) หรือ Wastage Reporting (`inventory_management.stock_out.view`) เท่านั้น
> 7. **`locked` (license) คนละเรื่องกับ `denied` (permission)** — การ์ด/ไทล์ที่ BU ไม่ได้ซื้อจะจาง `opacity-50` เหมือนกันแต่มีไอคอนกุญแจ และกดแล้ว dispatch เหตุผล `"license"` (ขึ้นกล่อง "Feature Not Licensed") · **admin ข้าม license ไม่ได้** · ในโหมดที่สวิตช์ `LICENSE_ENFORCEMENT` ปิดอยู่ `isLicensed()` คืน true เสมอ จึงจะไม่เห็นสถานะนี้เลย — เอกสารนี้ไม่เขียนเคส locked ไว้เพราะสร้างสถานะไม่ได้จาก BU `BLAVG` ที่ใช้ทดสอบ ถ้าภายหลังมี BU ที่ไม่ได้ซื้อ sub-module ค่อยเพิ่มในบล็อก 40
> 8. **การ์ด/ไทล์ที่กดไม่ได้เป็น `<button aria-disabled>` ไม่ใช่ `<a>`** (`components/module-landing.tsx`, `components/navbar/module-app.tsx`) — ตั้งใจให้ไม่มี anchor เพื่อไม่ให้ top-loader ทำงาน locator จึงต้องใช้ `getByRole("button")` ไม่ใช่ `getByRole("link")`
> 9. **`/system-admin` landing ไม่กรองตามสิทธิ์เลย** — `CHAPTERS` ใน `routes/system-admin/landing-types.ts` เป็นค่าคงที่ 5 chapter / 11 การ์ด ทุก role ที่เปิดหน้านี้เห็นครบเท่ากัน (ตรงกับข้อความ meta "5 chapters · 11 tools") การบล็อกไปเกิดตอนกด CTA "Open" แล้วชน `RouteGuard` ที่หน้าปลายทาง (TC-LAND-100003)
> 10. **ปุ่มสองปุ่มที่ footer ของ `/system-admin` ("Open handbook" / "Enter sandbox") ไม่มี `onClick`** (`routes/system-admin/landing-footer.tsx`) — เอกสารนี้จึงไม่มีเคสที่กดสองปุ่มนี้ ห้ามเพิ่มเคสที่ assert ว่ากดแล้วไม่เกิดอะไร
> 11. **ข้อมูล widget มาจาก backend จริง** — จำนวนและชนิดการ์ดของแต่ละ landing ขึ้นกับ dataset ที่ตั้งไว้ของ BU **ห้าม assert จำนวน widget ตายตัว** เคส smoke ทั้งหมดจึงยอมรับสองผล: มีการ์ดอย่างน้อย 1 ใบ **หรือ** ข้อความ "No widget data" · เคส empty/loadError (TC-LAND-900002/900003) บังคับจาก UI ไม่ได้ ต้อง `page.route()` ให้ endpoint ของ widget config คืนลิสต์ว่างหรือ 500
> 12. **มี aria-busy สองชั้น** — ชั้นนอกคือ Suspense fallback ของ `dashboard-widget-grid-lazy.tsx` (`div[aria-busy="true"]` ตอนโหลด chunk `recharts`) ชั้นในคือ `<section aria-busy={isLoading}>` ของตัวกริด (ค่าเปลี่ยน true→false ไม่ได้หายไป) ส่วน `/config` กับ `/operation-plan` มีเฉพาะบล็อก skeleton ที่ `aria-busy="true"` แล้วหายไปเมื่อโหลดจบ — assert ด้วย `[aria-busy="true"]` ครอบทั้งสามแบบได้
> 13. **ข้อความที่อ้างอิงในเอกสารนี้เป็น locale `en`** (`messages/en.json`) ถ้ารันด้วย locale อื่นต้องเทียบคีย์แทนข้อความ (`dashboardWidget.empty`, `dashboardWidget.loadError`, `notFound.*`, `modules.subModuleCount`)
> 14. **ไม่มีเคสไหนถูกลบในรอบนี้** — 16 เคสเดิมยังตรงกับแอป (แก้เฉพาะถ้อยคำ/เงื่อนไขให้ตรง source) และเพิ่มใหม่ 6 เคส: TC-LAND-010009, TC-LAND-010010, TC-LAND-100002, TC-LAND-100003, TC-LAND-400003, TC-LAND-400004

> แต่ละหมวดของแอปมี **landing page** ที่ผู้ใช้เห็นเมื่อเปิดโมดูลจากตัวเปิดโมดูล (ปุ่ม "Modules" บน navbar) มี 3 รูปแบบ: (1) **Widget grid ตัวกลาง** — `/procurement`, `/vendor-management`, `/inventory-management`, `/product-management` ใช้ `DashboardWidgetGrid` (ผ่าน lazy wrapper) แสดง title + description + การ์ด widget พร้อมสถานะ loading (`aria-busy`), empty ("No widget data") และ error (`role="alert"` + "Failed to load widgets"). (2) **Widget grid ที่เขียนเอง** — `/config` และ `/operation-plan` มีโครงเดียวกันแต่แบ่งการ์ดเป็น section "Metrics" / "Comparison" / "Distribution" และแสดง skeleton `aria-busy` เฉพาะตอนโหลด. (3) **Landing ที่ไม่ใช่กริด** — `/store-operation` ใช้ `ModuleLanding` แสดงการ์ด sub-module ตามสิทธิ์/สัญญา (การ์ดที่ถูก deny หรือ lock จาง `opacity-50` และ render เป็น `<button aria-disabled>` ที่กดแล้วเด้ง dialog แทนการนำทาง) พร้อมบรรทัดนับจำนวน sub-module; `/system-admin` ใช้ `SystemAdminLanding` แบบ editorial — hero + 5 chapter + 11 การ์ดเครื่องมือที่มี CTA "Open" + footer. หน้า **404 Not-Found** (`routes/not-found`) แสดงเลข 404, eyebrow, title, description, ปุ่ม "Back to Dashboard" ที่ลิงก์ไป `/dashboard` และแถบท้ายหน้า. Landing ทุกหมวดอยู่ใต้ auth guard (`RequireAuth`) แต่ **หน้า 404 เป็น public**.

## Test Cases at a Glance
| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-LAND-010001 | /config landing โหลดแสดง title/description + พื้นที่ widget | High | Smoke |
| TC-LAND-010002 | /vendor-management landing แสดง widget grid | Medium | Smoke |
| TC-LAND-010003 | /procurement landing แสดง widget grid | Medium | Smoke |
| TC-LAND-010004 | /inventory-management landing แสดง widget grid | Medium | Smoke |
| TC-LAND-010005 | /operation-plan landing แสดง widget grid | Medium | Smoke |
| TC-LAND-010006 | /product-management landing แสดง widget grid | Medium | Smoke |
| TC-LAND-010007 | /store-operation landing แสดงการ์ด sub-module + badge นับจำนวน | Medium | Smoke |
| TC-LAND-010008 | /system-admin landing แสดง hero + chapters ของระบบ | Medium | Smoke |
| TC-LAND-010009 | คลิกไทล์ในตัวเปิดโมดูล (Modules) ไปหน้า landing ของโมดูลนั้น | Medium | Functional |
| TC-LAND-010010 | เปิด `/` เด้งไป landing แรกที่ผู้ใช้เปิดได้ | Medium | Functional |
| TC-LAND-100001 | เข้า landing โดยไม่ login ถูก redirect ไป /login | High | Auth-guard |
| TC-LAND-100002 | ไม่ login เปิด URL ที่ไม่มีอยู่ ได้หน้า 404 ไม่ถูกเด้งไป /login | Medium | Auth-guard |
| TC-LAND-100003 | non-admin กด CTA ของการ์ด system-admin ที่ไม่มีสิทธิ์ ถูกบล็อกที่ปลายทาง | Medium | Authorization |
| TC-LAND-400001 | store-operation: คลิกการ์ด sub-module นำไป route ที่ถูกต้อง | Medium | Functional |
| TC-LAND-400002 | store-operation: การ์ด sub-module ที่ไม่มีสิทธิ์จางและไม่ออกนอกหน้า | Medium | Authorization |
| TC-LAND-400003 | system-admin: กด CTA "Open" ของการ์ดไปหน้าเครื่องมือนั้น | Medium | Functional |
| TC-LAND-400004 | system-admin: landing แสดงครบ 5 chapter / 11 การ์ดเสมอ | Low | Functional |
| TC-LAND-900001 | landing แสดงสถานะ loading (aria-busy) ระหว่างโหลด widget | Low | Functional |
| TC-LAND-900002 | landing แสดงข้อความ empty เมื่อไม่มี widget | Low | Edge Case |
| TC-LAND-900003 | landing แสดงข้อความ error เมื่อโหลด widget ล้มเหลว | Low | Negative |
| TC-LAND-900004 | เปิด URL ที่ไม่มีอยู่แสดงหน้า 404 พร้อมปุ่ม Back to Dashboard | Medium | Edge Case |
| TC-LAND-900005 | คลิก Back to Dashboard บนหน้า 404 กลับไป /dashboard | Medium | Functional |

---
## TC-LAND-010001 — /config landing โหลดแสดง title/description + พื้นที่ widget
**Priority:** High · **Test Type:** Smoke
**Preconditions**
ล็อกอินเป็น `admin@blueledgers.com` (BU = `BLAVG`) — `/config` เป็น node แม่ที่ไม่ผูก permission จึงเปิดได้ทุก role ที่ล็อกอินแล้ว
**Steps**
1. ไปที่ `/config`
2. รอให้บล็อก `[aria-busy="true"]` หายไป (โหลด widget เสร็จ)
**Expected**
URL ยังเป็น `/config` (ไม่ใช่หน้า 404 และไม่ถูกเด้ง); หัวเพจแสดง `h1` = "Configuration Overview" พร้อมคำอธิบาย "Master data status — locations, vendors, CN reasons, tax, and exchange rates"; พื้นที่ด้านล่างแสดงอย่างใดอย่างหนึ่ง: การ์ด widget ใต้หัวข้อ section ("Metrics" / "Comparison" / "Distribution") อย่างน้อย 1 ใบ **หรือ** ข้อความ "No widget data" เมื่อ BU ไม่มี widget ตั้งไว้

---
## TC-LAND-010002 — /vendor-management landing แสดง widget grid
**Priority:** Medium · **Test Type:** Smoke
**Preconditions**
ล็อกอินเป็น `admin@blueledgers.com` (BU = `BLAVG`)
**Steps**
1. ไปที่ `/vendor-management`
2. รอให้ `[aria-busy="true"]` หายไปหรือกลายเป็น `false`
**Expected**
URL ยังเป็น `/vendor-management`; `h1` = "Vendor Overview" พร้อมคำอธิบาย "Vendor, pricelist, and RFP status"; ภายใน `section` ของกริดมีการ์ด widget อย่างน้อย 1 ใบ **หรือ** ข้อความ "No widget data"; ไม่มีกล่อง `role="alert"` แจ้ง "Failed to load widgets"

---
## TC-LAND-010003 — /procurement landing แสดง widget grid
**Priority:** Medium · **Test Type:** Smoke
**Preconditions**
ล็อกอินเป็น `admin@blueledgers.com` (BU = `BLAVG`)
**Steps**
1. ไปที่ `/procurement`
2. รอให้ `[aria-busy="true"]` หายไปหรือกลายเป็น `false`
**Expected**
URL ยังเป็น `/procurement`; `h1` = "Procurement Overview" พร้อมคำอธิบาย "Document status and approvals across the procurement flow"; มีการ์ด widget อย่างน้อย 1 ใบ **หรือ** ข้อความ "No widget data"; ไม่มีกล่อง `role="alert"`

---
## TC-LAND-010004 — /inventory-management landing แสดง widget grid
**Priority:** Medium · **Test Type:** Smoke
**Preconditions**
ล็อกอินเป็น `admin@blueledgers.com` (BU = `BLAVG`)
**Steps**
1. ไปที่ `/inventory-management`
2. รอให้ `[aria-busy="true"]` หายไปหรือกลายเป็น `false`
**Expected**
URL ยังเป็น `/inventory-management`; `h1` = "Inventory Overview" พร้อมคำอธิบาย "Document and counting status across inventory operations"; มีการ์ด widget อย่างน้อย 1 ใบ **หรือ** ข้อความ "No widget data"; ไม่มีกล่อง `role="alert"`

---
## TC-LAND-010005 — /operation-plan landing แสดง widget grid
**Priority:** Medium · **Test Type:** Smoke
**Preconditions**
ล็อกอินเป็น `admin@blueledgers.com` (BU = `BLAVG`) — หน้านี้ใช้กริดที่เขียนเอง (`operation-dashboard.tsx`) ไม่ใช่ `DashboardWidgetGrid` ตัวกลาง
**Steps**
1. ไปที่ `/operation-plan`
2. รอให้บล็อก skeleton `[aria-busy="true"]` หายไป
**Expected**
URL ยังเป็น `/operation-plan`; `h1` = "Operations Overview" พร้อมคำอธิบาย "Recipe, cuisine, and equipment status across the operation plan"; แสดงการ์ด widget ใต้หัวข้อ section ("Metrics" / "Comparison" / "Distribution") อย่างน้อย 1 ใบ **หรือ** ข้อความ "No widget data"

---
## TC-LAND-010006 — /product-management landing แสดง widget grid
**Priority:** Medium · **Test Type:** Smoke
**Preconditions**
ล็อกอินเป็น `admin@blueledgers.com` (BU = `BLAVG`)
**Steps**
1. ไปที่ `/product-management`
2. รอให้ `[aria-busy="true"]` หายไปหรือกลายเป็น `false`
**Expected**
URL ยังเป็น `/product-management`; `h1` = "Product Overview" พร้อมคำอธิบาย "Category, item, and movement status across the product catalog"; มีการ์ด widget อย่างน้อย 1 ใบ **หรือ** ข้อความ "No widget data"; ไม่มีกล่อง `role="alert"`

---
## TC-LAND-010007 — /store-operation landing แสดงการ์ด sub-module + badge นับจำนวน
**Priority:** Medium · **Test Type:** Smoke
**Preconditions**
ล็อกอินเป็น `admin@blueledgers.com` (BU = `BLAVG`) — admin เห็นการ์ดครบทุกใบเพราะข้าม permission ได้ (จำนวนการ์ดของ role อื่นขึ้นกับสิทธิ์ ดูหมายเหตุข้อ 6)
**Steps**
1. ไปที่ `/store-operation`
**Expected**
`h1` = "Store Operations" พร้อมคำอธิบาย "Requisitions, replenishment, and wastage reporting"; บรรทัดนับจำนวนแสดง "3 sub-modules" (รูปแบบจาก `modules.subModuleCount` = จำนวนการ์ดที่มองเห็นจริง); มีการ์ด 3 ใบชื่อ "Store Requisition", "Stock Replenishment", "Wastage Reporting" และทั้งสามใบเป็นลิงก์ (`<a>`) ไม่ใช่ปุ่มที่ถูกปิด

---
## TC-LAND-010008 — /system-admin landing แสดง hero + chapters ของระบบ
**Priority:** Medium · **Test Type:** Smoke
**Preconditions**
ล็อกอินเป็น `admin@blueledgers.com` (BU = `BLAVG`)
**Steps**
1. ไปที่ `/system-admin`
**Expected**
URL ยังเป็น `/system-admin` (ไม่ใช่ 404); hero แสดง eyebrow "The control room" และ `h1` = "System Admin" พร้อมย่อหน้า lede; ถัดลงไปมีหัวข้อ chapter ครบ 5 หัวข้อ ("Who can do what", "How work moves", "What's happening", "Wiring it together", "Data, ready for use") และมีการ์ดเครื่องมือพร้อมปุ่ม "Open"

---
## TC-LAND-010009 — คลิกไทล์ในตัวเปิดโมดูล (Modules) ไปหน้า landing ของโมดูลนั้น
**Priority:** Medium · **Test Type:** Functional
**Preconditions**
ล็อกอินเป็น `admin@blueledgers.com` (BU = `BLAVG`) และอยู่ที่หน้าใดก็ได้ในเชลล์ของแอป (เช่น `/dashboard`)
**Steps**
1. คลิกปุ่มบน navbar ที่มี `aria-label` = "Modules"
2. ใน popover ที่เปิดขึ้น คลิกไทล์ "Procurement"
**Expected**
popover ปิดลงและ URL เปลี่ยนเป็น `/procurement` แสดง landing ของ procurement (`h1` = "Procurement Overview"); ไทล์ที่กดได้ต้อง render เป็นลิงก์ ส่วนไทล์ที่จาง `opacity-50` เป็น `<button aria-disabled>` (ดูหมายเหตุข้อ 8)

---
## TC-LAND-010010 — เปิด `/` เด้งไป landing แรกที่ผู้ใช้เปิดได้
**Priority:** Medium · **Test Type:** Functional
**Preconditions**
ล็อกอินเป็น `admin@blueledgers.com` (BU = `BLAVG`); index route ของเชลล์คือ `LandingRedirect` ซึ่งคำนวณปลายทางจาก `useLandingPath()`
**Steps**
1. เปิด `/` ตรง ๆ
**Expected**
ถูก redirect (แบบ `replace`) ไปยัง path แรกใน `moduleList` ที่ผู้ใช้เปิดได้ — ปกติคือ `/dashboard` เมื่อการบังคับ license ยังไม่เปิด — และหน้าปลายทาง render จริง ไม่ค้างที่ `/` และไม่ใช่หน้า 404

---
## TC-LAND-100001 — เข้า landing โดยไม่ login ถูก redirect ไป /login
**Priority:** High · **Test Type:** Auth-guard
**Preconditions**
ไม่มี session (browser context สะอาด ไม่โหลด `.auth/*.json`)
**Steps**
1. เปิด `/vendor-management` (หรือ section landing อื่น) ตรง ๆ โดยไม่ login
**Expected**
ถูก redirect ไป `/login` และฟอร์ม login แสดง; URL เป็น `/login` **เปล่า ๆ ไม่มี query string** (`RequireAuth` ส่ง path เดิมไปทาง `state.from` ไม่ใช่ `?next=`)

---
## TC-LAND-100002 — ไม่ login เปิด URL ที่ไม่มีอยู่ ได้หน้า 404 ไม่ถูกเด้งไป /login
**Priority:** Medium · **Test Type:** Auth-guard
**Preconditions**
ไม่มี session (browser context สะอาด)
**Steps**
1. เปิด `/this-route-does-not-exist` ตรง ๆ
**Expected**
URL ยังเป็น `/this-route-does-not-exist` และแสดงหน้า 404 (เลข "404" + ปุ่ม "Back to Dashboard") — **ไม่** ถูกเด้งไป `/login` เพราะ route `*` อยู่นอก `ProtectedShell`; หน้านี้ไม่มี navbar/sidebar ของแอป

---
## TC-LAND-100003 — non-admin กด CTA ของการ์ด system-admin ที่ไม่มีสิทธิ์ ถูกบล็อกที่ปลายทาง
**Priority:** Medium · **Test Type:** Authorization
**Preconditions**
ล็อกอินเป็น role ที่**ไม่ใช่ admin** และไม่มีสิทธิ์ดูหน้า Roles (เช่น `requestor@blueledgers.com` — ต้องยืนยันสิทธิ์จริงของบัญชีนั้นก่อนรัน) — landing ของ system-admin ไม่กรองการ์ดตามสิทธิ์ (หมายเหตุข้อ 9)
**Steps**
1. ไปที่ `/system-admin`
2. กดปุ่ม "Open" ของการ์ด "Roles"
**Expected**
การ์ด "Roles" มองเห็นและกดได้ตามปกติ แต่เมื่อไปถึง `/system-admin/role` แล้ว `RouteGuard` แสดงกล่อง `role="alert"` หัวข้อ "Permission Denied" พร้อมปุ่มออกไปหน้าที่เปิดได้ ("Go to an available page") แทนเนื้อหาหน้า Roles

---
## TC-LAND-400001 — store-operation: คลิกการ์ด sub-module นำไป route ที่ถูกต้อง
**Priority:** Medium · **Test Type:** Functional
**Preconditions**
ล็อกอินเป็น `admin@blueledgers.com` (BU = `BLAVG`) และอยู่ที่ `/store-operation` โดยการ์ด "Store Requisition" ไม่ถูกล็อกด้วย license
**Steps**
1. คลิกการ์ด "Store Requisition"
**Expected**
นำทางไป `/store-operation/store-requisition` และหน้า list ของ store requisition แสดง (ไม่ใช่ 404 และไม่ใช่กล่อง Permission Denied)

---
## TC-LAND-400002 — store-operation: การ์ด sub-module ที่ไม่มีสิทธิ์จางและไม่ออกนอกหน้า
**Priority:** Medium · **Test Type:** Authorization
**Preconditions**
ล็อกอินเป็น role ที่**ไม่ใช่ admin** และไม่มีสิทธิ์ `inventory_management.stock_out.view` (การ์ด "Wastage Reporting") หรือ `inventory_management.stock_in.view` (การ์ด "Stock Replenishment") — admin รันเคสนี้ไม่ได้ ดูหมายเหตุข้อ 6
**Steps**
1. ไปที่ `/store-operation`
2. คลิกการ์ดของ sub-module ที่ถูก deny (การ์ดจาง `opacity-50`)
**Expected**
การ์ดนั้น render เป็น `<button aria-disabled>` ไม่ใช่ลิงก์ และมี `opacity-50`; หลังคลิก URL **ยังเป็น `/store-operation`** (ไม่นำทางออก) และแอปเด้ง dialog แจ้งสิทธิ์ (`dispatchPermissionDenied` → หัวข้อ "Permission Denied")

---
## TC-LAND-400003 — system-admin: กด CTA "Open" ของการ์ดไปหน้าเครื่องมือนั้น
**Priority:** Medium · **Test Type:** Functional
**Preconditions**
ล็อกอินเป็น `admin@blueledgers.com` (BU = `BLAVG`) และอยู่ที่ `/system-admin`
**Steps**
1. ในการ์ด "Roles" (chapter 01 — "Who can do what") กดปุ่ม "Open"
**Expected**
นำทางไป `/system-admin/role` และหน้า list ของ role แสดง; ปุ่ม "Open" เป็นลิงก์ (`<a href="/system-admin/role">`) ไม่ใช่ปุ่มที่ต้องมี JS

---
## TC-LAND-400004 — system-admin: landing แสดงครบ 5 chapter / 11 การ์ดเสมอ
**Priority:** Low · **Test Type:** Functional
**Preconditions**
ล็อกอินเป็นผู้ใช้ใดก็ได้ที่เปิด `/system-admin` ได้ (รันซ้ำได้กับทุก role — รายการ chapter/การ์ดเป็นค่าคงที่ ไม่ขึ้นกับสิทธิ์)
**Steps**
1. ไปที่ `/system-admin`
2. นับหัวข้อ chapter และการ์ดเครื่องมือทั้งหน้า
**Expected**
มี chapter 5 บล็อก (หมายเลข 01–05) และการ์ดเครื่องมือรวม 11 ใบ (Roles, Assign Users, Inventory Period, Workflows, Document Management, User Activity, Activity Monitor, Interfaces, Notification Templates, Running Code, Dashboard Dataset) ตรงกับข้อความ meta มุมขวาบน "5 chapters · 11 tools" — จำนวนเท่ากันทั้ง admin และ non-admin

---
## TC-LAND-900001 — landing แสดงสถานะ loading (aria-busy) ระหว่างโหลด widget
**Priority:** Low · **Test Type:** Functional
**Preconditions**
ล็อกอินเป็น `admin@blueledgers.com` (BU = `BLAVG`); เพื่อให้จังหวะโหลดยาวพอสังเกต ควรหน่วง response ของ endpoint widget config ด้วย `page.route()`
**Steps**
1. ไปที่ `/procurement` (หรือ landing แบบกริดอื่น)
2. สังเกตช่วงก่อนข้อมูล widget มาถึง
**Expected**
ระหว่างโหลดมี element ที่ `aria-busy="true"` พร้อม skeleton/placeholder (ชั้น Suspense ของ chunk หรือ `<section aria-busy>` ของกริด) แล้วเปลี่ยนเป็น `aria-busy="false"` หรือหายไปเมื่อโหลดเสร็จ

---
## TC-LAND-900002 — landing แสดงข้อความ empty เมื่อไม่มี widget
**Priority:** Low · **Test Type:** Edge Case
**Preconditions**
ล็อกอินเป็น `admin@blueledgers.com` (BU = `BLAVG`); ใช้ `page.route()` ให้ endpoint widget config คืนลิสต์ว่าง (`items: []`) เพราะสถานะนี้สร้างจาก UI ไม่ได้
**Steps**
1. ตั้ง route intercept ให้คืนลิสต์ว่าง
2. ไปที่ `/procurement`
3. รอโหลดเสร็จ (`aria-busy` = false)
**Expected**
แสดงข้อความ "No widget data" (คีย์ `dashboardWidget.empty`) ในกรอบเส้นประกลางพื้นที่กริด แทนที่จะเป็นพื้นที่ว่างเปล่าหรือข้อความ error; หัวเพจ (title/description) ยังแสดงตามปกติ

---
## TC-LAND-900003 — landing แสดงข้อความ error เมื่อโหลด widget ล้มเหลว
**Priority:** Low · **Test Type:** Negative
**Preconditions**
ล็อกอินเป็น `admin@blueledgers.com` (BU = `BLAVG`); ใช้ `page.route()` ให้ endpoint widget config คืน HTTP 500
**Steps**
1. ตั้ง route intercept ให้คืน 500
2. ไปที่ `/procurement`
**Expected**
แสดงกล่อง `role="alert"` ข้อความขึ้นต้นด้วย "Failed to load widgets:" ตามด้วยรายละเอียดข้อผิดพลาด (คีย์ `dashboardWidget.loadError`); หน้าไม่ crash — หัวเพจยังอยู่ และไม่มีข้อความ "No widget data" ปนขึ้นมาพร้อมกัน

---
## TC-LAND-900004 — เปิด URL ที่ไม่มีอยู่แสดงหน้า 404 พร้อมปุ่ม Back to Dashboard
**Priority:** Medium · **Test Type:** Edge Case
**Preconditions**
ล็อกอินเป็น `admin@blueledgers.com` (BU = `BLAVG`) — หน้า 404 ไม่บังคับ session จึงรันซ้ำแบบไม่ล็อกอินก็ได้ (ดู TC-LAND-100002)
**Steps**
1. เปิด URL ที่ไม่ตรงกับ route ใด ๆ เช่น `/this-route-does-not-exist`
**Expected**
แสดงหน้า Not-Found: เลข "404" ตัวใหญ่, eyebrow "Page not found", `h1` = "We can't find that page", คำอธิบาย, ปุ่มลิงก์ "Back to Dashboard" ที่ `href` = `/dashboard` และแถบท้ายหน้า "© <ปีปัจจุบัน> CARMEN BLUE · ERP for Hospitality"

---
## TC-LAND-900005 — คลิก Back to Dashboard บนหน้า 404 กลับไป /dashboard
**Priority:** Medium · **Test Type:** Functional
**Preconditions**
ล็อกอินเป็น `admin@blueledgers.com` (BU = `BLAVG`) และอยู่ที่หน้า 404 (มาจาก TC-LAND-900004)
**Steps**
1. คลิกปุ่ม "Back to Dashboard"
**Expected**
นำทางไป `/dashboard` และหน้า dashboard แสดง (ถ้าผู้ใช้/BU เปิด `/dashboard` ไม่ได้ จะเห็นกล่องของ `RouteGuard` แทน — ปุ่มนี้ลิงก์ตรงไป `/dashboard` เสมอ ไม่ได้คำนวณ landing ตามสิทธิ์)
