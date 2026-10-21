# SPA Shell / Cross-cutting (เปลือกแอป) — Gap Report

_เคสที่ **สเปกอัตโนมัติยังไม่ครอบ** เท่านั้น ไม่ใช่แคตตาล็อกเต็มของเปลือกแอป — เคสที่ครอบแล้ว (redirect ไป `/login` เมื่อไม่มี session, dashboard render จริง, หน้า shell/config/procurement เปิดได้ไม่เป็น 404) ถูกทดสอบอยู่ใน `tests/002-spa-smoke.spec.ts` และมีเอกสารที่ generate ไว้ที่ `docs/user-stories/002-spa-smoke.md`_

**Module:** SPA Shell / Cross-cutting (navbar · เมนู Modules · sidebar · breadcrumb · route guard · สลับ BU · ธีม/ภาษา · 404 · error boundary · deep-link/refresh/back)
**Frontend route:** `routes/router.tsx` (route tree ทั้งหมด) → `routes/app-root.tsx` → `routes/root-layout.tsx`  •  **URL:** ทุกหน้าในแอป
**Prefix:** `SPA` (ชุดเดียวกับสเปก — gap report ใช้ prefix ของสเปกและไม่ต้องมีแถวของตัวเองใน `docs/test-id-scheme.md`)
**Spec ที่ครอบส่วนที่เหลือ:** `tests/002-spa-smoke.spec.ts`, `tests/001-login.spec.ts` (ฟอร์มล็อกอิน)
**Total test cases:** 47

> หมายเหตุสำคัญสำหรับผู้รีวิว:
>
> **ช่วงเลขที่เลือก** — `SPA` ลงทะเบียนไว้แค่ section `01` (`docs/test-id-scheme.md:28`) และสเปกใช้ `TC-SPA-010001–010006` ไปแล้ว ไฟล์นี้จึงใช้ **`TC-SPA-0101xx` (010101–010147) ทั้งหมด ไม่เปิด section ใหม่** เคสที่ตามขนบควรอยู่ section อื่น (authorization → 90, edge case → 90) ถูกจัดเข้าบล็อกเดียวกันตามกติกาใน `gaps/README.md`
>
> **สเปกครอบอะไรไปแล้ว (ห้ามเขียนซ้ำ)** — `TC-SPA-010001` (ไม่ล็อกอินแล้วเปิด `/dashboard` → `/login`), `010002` (dashboard ไม่ใช่ placeholder), `010003` (`/report/list`, `/profile`, `/notifications` เปิดได้), `010004` (`/config/unit`, `/config/department`, `/config/department/new`, `/config`), `010005` (list ของ PRT/CN/GRN/PO/PR), `010006` (เปิด PR detail จาก list + `/procurement`, `/procurement/approval`) · ทั้งหกเคสเป็นการ "เปิดหน้าแล้วดูว่ามี `<table>`/`<heading>` และไม่มีคำว่า 404" — **ไม่มีเคสไหนแตะ navbar, sidebar, เมนู Modules, การสลับ BU, ธีม, ภาษา, กล่องปฏิเสธสิทธิ์ หรือหน้า 404 จริงเลย**
>
> **ข้อเท็จจริงจาก source ที่คนแปลงเป็นสเปกต้องรู้**
> 1. **เปลือกแอปซ้อนกันห้าชั้น** — `AppRoot` (`routes/app-root.tsx:7-23`: `I18nProvider` → `Providers` → skip link → `TopLoader` → `Outlet` → `Toaster`) → `ProtectedShell` (`routes/router.tsx:9-13` = `RequireAuth` + `RootLayout`) → `RootLayout` (`routes/root-layout.tsx:18-49`) → `ProfileGate` → `RouteGuard` → `Outlet` (`routes/root-layout.tsx:36-40`) ⇒ **หน้าใดก็ตามที่อยู่ใต้ shell จะถูกกรองสามด่านเสมอ**: token (`components/auth/require-auth.tsx:15-20`), โปรไฟล์/สัญญาโหลดเสร็จ (`components/share/profile-gate.tsx:38-50`), แล้วจึงสิทธิ์รายหน้า (`components/route-guard.tsx:56-74`)
> 2. **หน้า 404 อยู่ *นอก* `ProtectedShell`** — catch-all `{ path: "*" }` อยู่ระดับเดียวกับ `/login` ไม่ใช่ใต้ shell (`routes/router.tsx:853` เทียบกับ `:56-58`) ⇒ URL ที่ไม่รู้จัก render `NotFoundComponent` (`components/not-found-component.tsx:9-54`) **เต็มจอ ไม่มี navbar ไม่มี sidebar แม้จะล็อกอินอยู่** มีโลโก้ · เลข `404` (`aria-hidden`) · หัวเรื่อง "We can't find that page" · ปุ่ม "Back to Dashboard" ที่ลิงก์ไป `/dashboard` · footer ปีปัจจุบัน — สเปกปัจจุบัน assert แค่ `getByText(/404|not found/i)` มีจำนวน 0 จึงไม่เคยเห็นหน้านี้เลย
> 3. **โมดูลรากมี 11 ตัว** (`constant/module-list.ts` บรรทัด `130` dashboard, `136` procurement, `180` productManagement, `209` vendorManagement, `255` storeOperations, `284` inventoryManagement, `324` operationPlan, `366` report, `394` accounting, `462` config, `568` systemAdmin) และ **ทุกตัวมี index route จริง** (`routes/router.tsx:59, 84, 171, 282, 368, 443, 478, 553, 588, 739, 759`) · เมนู Modules · sidebar · หน้า landing ของโมดูล · command palette · และ `useLandingPath()` **ผ่านทาง `useVisibleModules()` ทางเดียวกันหมด** (`hooks/use-visible-modules.ts:106-110`)
> 4. **RBAC ไม่ได้ "ซ่อน" รายการ** — leaf ที่ `denied` (ไม่มีสิทธิ์) หรือ `locked` (BU ไม่ได้ซื้อ) ยัง render อยู่ แต่เป็น `<button aria-disabled>` ที่จางลงครึ่งหนึ่ง (`opacity-50`) และกดแล้ว `dispatchPermissionDenied()` เปิด `AlertDialog` แทนการนำทาง — ทั้งในเมนู Modules (`components/navbar/module-app.tsx:142-159`), sidebar (`components/sidebar/side-main.tsx:129-158`) และหน้า landing ของโมดูล (`components/module-landing.tsx:108-126`) · `locked` เพิ่มไอคอนกุญแจและ **ชนะ `denied` เสมอ** · สิ่งเดียวที่ถูก **ตัดออกจาก tree จริง** คือ feature ที่แพลตฟอร์มปลดระวาง (`hidden`) — `hooks/use-visible-modules.ts:42, 84` ⇒ **อย่าเขียนเคสที่คาดว่า "เมนูจะหายไปเพราะไม่มีสิทธิ์"**
> 5. **admin ข้าม permission ได้ แต่ข้าม license ไม่ได้** (`hooks/use-can.ts:28-32`, `hooks/use-visible-modules.ts:54-58, 122`) และ `isAdmin` ผูกกับ **BU ปัจจุบัน** (`defaultBu.system_level === "admin"`) ไม่ใช่ระดับแพลตฟอร์ม ⇒ เคสเรื่องสิทธิ์ทุกเคสในไฟล์นี้ **ต้องใช้บัญชีที่ไม่ใช่ admin** (ใช้ `requestor@blueledgers.com`)
> 6. **sidebar ผูกกับโมดูลของ URL ปัจจุบันเท่านั้น** — `SideMain` หาโมดูลด้วย `pathname.startsWith(mod.path)` (`components/sidebar/side-main.tsx:25`) แล้ว render หัวโมดูล (ลิงก์ไป landing) + เฉพาะ leaf ของโมดูลนั้น ⇒ `/profile` และ `/notifications` **ไม่แมตช์โมดูลไหนเลย** `SideMain` คืน `null` (`:28-30`) เหลือแค่โลโก้ในส่วนหัว (`components/sidebar/app-sidebar.tsx:17-38`) · `/dashboard` แมตช์แต่ไม่มี `subModules` จึงมีแต่หัวโมดูล ไม่มีรายการเมนู
> 7. **เมนูชั้นที่สามไม่ผ่าน `useVisibleModules`** — `side-main.tsx:164-201` วนเฉพาะ `sub.subModules` ตรง ๆ (คอมเมนต์ยืนยันที่ `constant/module-list.ts:611-613`) ชั้นนี้จึงไม่มี `denied`/`locked` และ **ถูกซ่อนเมื่อย่อ sidebar เป็นไอคอน** (`className="group-data-[collapsible=icon]:hidden"`) · ตัวอย่างเดียวในแอปคือ Workflow ใต้ System Administration ซึ่งมีลูกสี่ตัว (`module-list.ts:616-642`) และตัวที่สี่ (`notificationTemplate`) มี URL เป็น **พี่น้อง** ของ workflow ไม่ใช่ลูก (`/system-admin/notification-template`)
> 8. **สถานะย่อ/ขยาย sidebar ไม่ persist** — `SidebarProvider` เขียน cookie `sidebar_state` (`components/ui/sidebar.tsx:84`) แต่ไม่มีใครอ่านกลับ และ `SidebarShell` ตั้ง `useState(true)` ใหม่ทุกครั้งที่ mount (`components/sidebar/sidebar-shell.tsx:9-10`) ⇒ **ห้ามเขียนเคสว่าย่อแล้วยังย่ออยู่หลังรีเฟรช** · sidebar ยัง **ย่อเองอัตโนมัติ**ที่ความกว้างจอ 768–1023px (`:4-5, 12-26`) ⇒ viewport ของเทสต้องกว้างกว่า 1024px ทุกเคสที่แตะ sidebar
> 9. **`⌘K` / `Ctrl+K` ถูกผูกไว้สองที่พร้อมกัน** — เมนู Modules (`components/navbar/module-app.tsx:33-42`) และ command palette (`components/command-palette.tsx:59-69`) ต่างติด listener ที่ `window` คนละตัว กดครั้งเดียวจึงสลับทั้งคู่ โดย palette เป็น modal dialog ที่อยู่บนสุด บันทึกไว้เป็นข้อเท็จจริง — เคส `010147` assert เฉพาะ palette ซึ่งเป็นพฤติกรรมที่กล่องคีย์ลัดโฆษณาไว้ (`components/keyboard-shortcuts-dialog.tsx:20`)
> 10. **ธีม / ภาษา / ขนาดตัวอักษร เก็บคนละที่ และทั้งสามอยู่ในเมนูผู้ใช้หมวด Preferences** (`components/navbar/user-profile.tsx:243-248`) — ธีมใช้ `next-themes` แบบ `attribute="class"` `defaultTheme="system"` (`components/providers.tsx:58`) เขียน class ลง `<html>` และจำใน `localStorage` · ภาษาเก็บคีย์ `carmen.locale` และตั้ง `document.documentElement.lang` ทุกครั้ง (`components/i18n-provider.tsx:16, 61, 67-74`) รองรับสองภาษา `en` (ค่าเริ่มต้น) กับ `th` (`i18n/config.ts:1-3`) · ขนาดตัวอักษรเป็น class `font-scale-*` บน `<html>` ที่ apply ทั้งจาก inline script ใน `index.html` และซ้ำอีกครั้งที่ `main.tsx:15` (`components/navbar/font-scale-switch.tsx:49-57`)
> 11. **Session รอดการรีเฟรช** — access token อยู่ใน memory ล้วน (`lib/auth/token-store.ts:1-5`) แต่ refresh token อยู่ใน `localStorage` คีย์ `carmen.refresh_token` (`lib/auth/refresh-token-storage.ts:6`) และ `boot()` เรียก `refreshTokens()` **ก่อน** render router (`main.tsx:40-46`) ⇒ รีเฟรชกลางหน้าไหนก็ยังอยู่หน้านั้น ไม่มี flash ของหน้า login
> 12. **ปลายทางหลังล็อกอินอ่านจาก `?next=` ไม่ใช่จาก state ที่ guard ส่งมา** — `RequireAuth` ส่ง `state: { from: location.pathname }` (`components/auth/require-auth.tsx:19`) แต่ `login-form.tsx:104` อ่าน `resolveNextPath(searchParams.get("next"))` ซึ่ง fallback เป็น `/dashboard` (`lib/auth/resolve-next-path.ts:2-3`) ⇒ deep-link ที่โดนเด้งไป login แล้วล็อกอินสำเร็จจะไป `/dashboard` เสมอ บันทึกไว้เป็นข้อเท็จจริง — ไฟล์นี้จึงเขียนเฉพาะเส้นทาง `?next=` (`010141`) ที่ทำงานตามออกแบบ
> 13. **การสลับ BU เป็น side-effect ระดับบัญชี** — `useSwitchBu` ยิง `POST` แล้ว **ลบ query cache ทุกคีย์ที่ไม่ใช่ profile** (`hooks/use-switch-bu.ts:15-19, 78-80`) และกระจายข่าวข้าม tab ด้วย `BroadcastChannel` (`:82-88`) · ฝั่ง UI ขึ้น toast `Switched to <name>` แล้ว `navigate("/dashboard")` ทันที (`components/navbar/bu-switcher.tsx:147-149`) · BU ที่ใช้งานอยู่ถูก `disabled` ในรายการและมีแถบสีซ้าย + จุดสีขวา (`:136-138, 160-181`) · ระหว่างสลับ ทั้ง switcher และเมนูผู้ใช้กลายเป็น skeleton (`:88-100`, `user-profile.tsx:153-167`)
> 14. **ของที่ mount ครั้งเดียวที่ layout แล้วใช้ได้ทุกหน้า** — `CommandPalette`, `KeyboardShortcutsDialog`, `MissingDepartmentDialog`, `ActivitySheetHost` (`routes/root-layout.tsx:44-47`), `OfflineBanner` (`:25`), `LicenseExpiredBanner` (`:28`), `SeatQuotaBannerHost` (`:31`), `StatusBar` (`:42`) และ `PermissionDeniedDialog` + `ApiErrorToaster` ที่ระดับ `Providers` (`components/providers.tsx:61-62`) ⇒ เคสของสิ่งเหล่านี้ไม่มีสเปกโมดูลไหนเป็นเจ้าของ
> 15. **navbar ซ่อนตัวสลับ BU และเมนู Modules ที่จอเล็กกว่า `sm`** แล้วย้ายเข้า Sheet "Open menu" แทน (`components/navbar/navbar.tsx:38-75`) · ถ้าโหลดโปรไฟล์ไม่ผ่าน navbar จะเหลือแต่เมนูผู้ใช้เพื่อให้ยังออกจากระบบได้ (`:19-23, 36`)
> 16. **breadcrumb คำนวณจาก pathname ล้วน** — ตัด segment ที่เป็นตัวเลข/UUID/ObjectId ทิ้ง (`components/navbar/path-breadcrumb.tsx:15-28, 86`) แปลงชื่อ segment เป็นคำแปลจาก `moduleList` + ตารางคำเสริม (`:30-55`) · ชั้นสุดท้ายเป็น `BreadcrumbPage` (กดไม่ได้) เฉพาะตอน**ไม่ได้**อยู่หน้ารายละเอียด — อยู่หน้าที่ลงท้ายด้วย id ทุกชั้นเป็นลิงก์หมด (`:88-104`) · จอแคบซ่อนชั้นที่เก่ากว่าสองชั้นท้าย (`:107`)
> 17. **กล่องปฏิเสธสิทธิ์มีสองแบบคนละที่** — deep-link เข้าหน้าที่ไม่มีสิทธิ์ได้ `AccessDeniedBlock` ที่เป็น `role="alert"` **ในเนื้อหน้า** (navbar/sidebar ยังอยู่) พร้อมปุ่ม "Go to an available page" ที่ `navigate(landing, { replace: true })` (`components/route-guard.tsx:72, 98-147`) · ส่วนการกดเมนูที่จางได้ `AlertDialog` ลอยขึ้นมา (`components/permission-denied-dialog.tsx:50-107`) หัวเรื่องต่างกันตามเหตุผล: `Permission Denied` / `Feature Not Licensed` / `Subscription Expired` / `Seat Limit Exceeded`
> 18. **`/` ไม่ได้ hardcode ไป `/dashboard`** — index route render `LandingRedirect` ที่คำนวณ leaf แรกที่ผู้ใช้เปิดได้จริง และตกไป `/profile` เมื่อไม่มี leaf ไหนเปิดได้เลย (`routes/landing-redirect.tsx:17-19`, `hooks/use-landing-path.ts:16, 45-61`) · ในสถานะปัจจุบัน (license enforcement ปิด) ค่าที่ได้คือ `/dashboard` ตามคอมเมนต์ใน `use-landing-path.ts:56-58`
> 19. **error boundary มีสองชั้น** — ระดับ route ของแต่ละโมดูล (`RouteErrorBoundaryAdapter`, `routes/module-error-boundary-adapter.tsx:9-18`) กับ catch-all ที่ราก (`routes/root-error-boundary.tsx:16-45`) ทั้งคู่ reset ด้วย `navigate(0)` = โหลดหน้าใหม่ทั้งหน้า · ไฟล์นี้ **ไม่มี**เคสของ error boundary เพราะการทำให้ route พังจริงต้องแทรกแซง network/chunk ซึ่งเกินขอบเขตของชุดเทสนี้ (ดู "ไม่ครอบในไฟล์นี้" ด้านล่าง)
>
> **Role / ข้อมูลที่ต้องเตรียม**
> - **Default role ของไฟล์นี้คือ Admin (`admin@blueledgers.com`, BU = `BLAVG`)** — ชุดเดียวกับที่ `002-spa-smoke.spec.ts` ใช้ผ่าน `createAuthTest("admin@blueledgers.com")`
> - **เคสที่ต้องใช้บัญชีที่ไม่ใช่ admin** (เพราะ admin ข้าม permission หมด): `010106`, `010115`, `010136`, `010137` — ใช้ `requestor@blueledgers.com` (มีใน `tests/test-users.ts`) และเล็งไปที่หน้าในกลุ่ม System Administration ซึ่งทุก leaf ต้องการ `system_configuration.view` (`constant/module-list.ts:574-720`)
> - **เคสที่ต้องมีบัญชีที่สังกัดมากกว่าหนึ่ง BU**: `010122`, `010123` — อ่านรายการ BU จริงด้วย `getBusinessUnits(page)` (`tests/helpers/bu.ts`) แล้วข้ามเทสถ้ามี BU เดียว
> - **เคสที่ต้องมีข้อมูลในระบบอย่างน้อยหนึ่งรายการ** (เพื่อเปิดหน้ารายละเอียดจริง): `010110`, `010118`, `010119`, `010142`, `010143`
> - **เคสที่ต้องการบัญชีที่ไม่มีแจ้งเตือนค้าง**: `010134` (ถ้าบัญชีมีค้างอยู่ ให้กด Clear ก่อนหรือข้ามเทส)
> - **ทุกเคสที่แตะ sidebar ต้องตั้ง viewport กว้าง ≥ 1024px** (ข้อ 8 ด้านบน) ส่วนเคสที่แตะ navbar ต้องกว้าง ≥ 640px (`sm`) ไม่งั้นตัวสลับ BU กับเมนู Modules จะย้ายเข้า Sheet (ข้อ 15)
>
> **🚫 Blocker**
> - **`010122` / `010123` เปลี่ยน default BU ของบัญชีที่ backend แบบถาวรและเป็น account-global** — ภายใต้ `workers: 1` สเปกที่รันต่อจากนี้จะได้ BU ใหม่ไปด้วย ⇒ ต้องเรียก `ensureActiveBu(page, "BLAVG")` (`tests/helpers/bu.ts`) ปิดท้ายทุกกรณี ไม่ว่าเทสจะผ่านหรือไม่ และห้ามรันสองเคสนี้คู่ขนานกับเคสอื่น
> - **`010125`–`010129` เปลี่ยนค่าที่เก็บใน `localStorage` ของ browser context** (ธีม, `carmen.locale`, ขนาดตัวอักษร) — `.auth/<email>.json` ของ `setup` เก็บ storage state ไปด้วย ⇒ ต้องคืนค่าเดิมท้ายเทส หรือรันในบริบทที่แยกจากสเปกอื่น
> - **`010131` ต้องกด Cancel เท่านั้น** ห้ามยืนยันออกจากระบบ (จะล้าง session ที่สเปกอื่นในรอบเดียวกันใช้อยู่)
> - เคสที่เหลือทั้งหมด **อ่านอย่างเดียว** (นำทาง, เปิด/ปิดเมนู, deep link, refresh, back/forward) รันซ้ำได้ไม่จำกัด
>
> **ไม่ครอบในไฟล์นี้โดยตั้งใจ** — (ก) error boundary ระดับ route/ราก และแบนเนอร์ offline/license/seat: ทำให้เกิดสถานะจริงต้องแทรกแซง network หรือสถานะสัญญาฝั่ง backend · (ข) การล็อกด้วย license (`locked` + ไอคอนกุญแจ): ต้องมี BU ที่ไม่ได้ซื้อ feature ซึ่งไม่มีในชุดบัญชีทดสอบ · (ค) พฤติกรรมบนจอเล็ก (Sheet ของ navbar, sidebar แบบ offcanvas): ทั้งชุดรันที่ desktop viewport · (ง) เนื้อหารายโมดูล (ตาราง, ตัวกรอง, CRUD) ซึ่งมี gap report ของตัวเองอยู่แล้วในโฟลเดอร์นี้
>
> เมื่อเคสใดถูกเขียนเป็นสเปกแล้วให้ลบออกจากไฟล์นี้ และเมื่อหมดทุกเคสให้ลบไฟล์ทิ้ง

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-SPA-010101 | เมนู Modules เปิดจาก navbar และแสดงไทล์ของทุกโมดูลที่มองเห็นได้ | High | Functional |
| TC-SPA-010102 | คลิกไทล์ในเมนู Modules พาไปหน้า landing ของโมดูลและปิดเมนูเอง | High | Functional |
| TC-SPA-010103 | แถบคีย์ลัดใต้เมนู Modules บอกปุ่มที่ใช้เปิด | Low | Functional |
| TC-SPA-010104 | กด Escape ปิดเมนู Modules โดยไม่เปลี่ยนหน้า | Low | Functional |
| TC-SPA-010105 | เมนู Modules เปิดได้จากหน้าที่อยู่นอกทุกโมดูล | Medium | Functional |
| TC-SPA-010106 | ไทล์โมดูลที่ผู้ใช้ไม่มีสิทธิ์ยังแสดงอยู่แต่กดแล้วขึ้นกล่องแจ้งสิทธิ์ | High | Authorization |
| TC-SPA-010107 | sidebar แสดงเฉพาะเมนูของโมดูลที่กำลังเปิดอยู่ | High | Functional |
| TC-SPA-010108 | หัว sidebar เป็นลิงก์กลับหน้า landing ของโมดูล | Medium | Functional |
| TC-SPA-010109 | ย้ายข้ามโมดูลแล้วชุดเมนูใน sidebar เปลี่ยนตามทั้งชุด | High | Functional |
| TC-SPA-010110 | เมนูของหน้าปัจจุบันถูกไฮไลต์ และยังไฮไลต์เมื่อเข้าหน้ารายละเอียด | Medium | Functional |
| TC-SPA-010111 | หน้าที่อยู่นอกทุกโมดูลมี sidebar ที่ไม่มีรายการเมนูเลย | Medium | Edge Case |
| TC-SPA-010112 | ย่อ/ขยาย sidebar ด้วยปุ่มบน navbar | Medium | Functional |
| TC-SPA-010113 | ย่อ/ขยาย sidebar ด้วยคีย์ลัด | Low | Functional |
| TC-SPA-010114 | เมนูชั้นที่สามของ Workflow เยื้องเข้าและหายไปเมื่อย่อ sidebar | Low | Functional |
| TC-SPA-010115 | เมนูใน sidebar ที่ผู้ใช้ไม่มีสิทธิ์เป็นปุ่มแจ้งสิทธิ์ ไม่ใช่ลิงก์ | High | Authorization |
| TC-SPA-010116 | โลโก้ใน sidebar พากลับหน้าแรกของผู้ใช้ | Low | Functional |
| TC-SPA-010117 | breadcrumb สะท้อนเส้นทางปัจจุบันและชั้นสุดท้ายกดไม่ได้ | Medium | Functional |
| TC-SPA-010118 | breadcrumb ตัดรหัสเอกสารทิ้งและทุกชั้นกดได้เมื่ออยู่หน้ารายละเอียด | Medium | Functional |
| TC-SPA-010119 | กดชั้นก่อนหน้าบน breadcrumb กลับไปหน้ารายการ | Medium | Alternate Flow |
| TC-SPA-010120 | ตัวสลับหน่วยธุรกิจแสดงกิจการที่ใช้งานอยู่บน navbar | Medium | Functional |
| TC-SPA-010121 | รายการหน่วยธุรกิจทำเครื่องหมายกิจการปัจจุบันและกดซ้ำไม่ได้ | Medium | Functional |
| TC-SPA-010122 | สลับหน่วยธุรกิจแล้วขึ้นข้อความยืนยันและถูกพาไปหน้า dashboard | High | Functional |
| TC-SPA-010123 | สลับหน่วยธุรกิจแล้วรายการข้อมูลถูกดึงใหม่ตามกิจการใหม่ | High | Functional |
| TC-SPA-010124 | เมนูผู้ใช้แสดงชื่อ อีเมล แผนก และแบ่งเป็นสองหมวด | Medium | Functional |
| TC-SPA-010125 | เปลี่ยนธีมเป็นมืดแล้วทั้งแอปเปลี่ยนตาม | Medium | Functional |
| TC-SPA-010126 | ธีมที่เลือกยังอยู่หลังรีเฟรชหน้า | Medium | Functional |
| TC-SPA-010127 | เปลี่ยนภาษาแล้วเปลือกแอปและภาษาของเอกสารเปลี่ยนตาม | High | Functional |
| TC-SPA-010128 | ภาษาที่เลือกยังอยู่หลังรีเฟรชหน้า | Medium | Functional |
| TC-SPA-010129 | เปลี่ยนขนาดตัวอักษรแล้วมีผลกับทั้งแอป | Low | Functional |
| TC-SPA-010130 | เมนูผู้ใช้มีทางเข้าหน้าโปรไฟล์ | Low | Functional |
| TC-SPA-010131 | ออกจากระบบต้องยืนยันก่อน และกดยกเลิกแล้วยังอยู่ในระบบ | Medium | Functional |
| TC-SPA-010132 | กระดิ่งแจ้งเตือนเปิดกล่องพร้อมหัวข้อและทางไปหน้ารวม | Medium | Functional |
| TC-SPA-010133 | ปุ่มดูทั้งหมดในกล่องแจ้งเตือนพาไปหน้ารวมและปิดกล่อง | Medium | Functional |
| TC-SPA-010134 | ไม่มีแจ้งเตือนค้าง ไม่มีตัวเลขบนกระดิ่งและกล่องขึ้นสถานะว่าง | Low | Edge Case |
| TC-SPA-010135 | เปิดรากของเว็บแล้วถูกพาไปหน้าแรกที่ผู้ใช้เปิดได้ | High | Functional |
| TC-SPA-010136 | deep-link หน้าที่ไม่มีสิทธิ์ขึ้นกล่องปฏิเสธสิทธิ์ในเปลือกแอป | High | Authorization |
| TC-SPA-010137 | ปุ่มในกล่องปฏิเสธสิทธิ์พาไปหน้าที่ผู้ใช้เปิดได้ | Medium | Authorization |
| TC-SPA-010138 | URL ที่ไม่มีอยู่จริงขึ้นหน้า 404 เต็มจอโดยไม่มี navbar และ sidebar | High | Edge Case |
| TC-SPA-010139 | URL ที่ไม่มีอยู่จริงใต้โมดูลก็ได้หน้า 404 ชุดเดียวกัน | Medium | Edge Case |
| TC-SPA-010140 | ปุ่มบนหน้า 404 พากลับเข้าเปลือกแอป | Medium | Alternate Flow |
| TC-SPA-010141 | ล็อกอินจากลิงก์ที่ระบุปลายทางแล้วไปถึงปลายทางนั้น | Medium | Auth-guard |
| TC-SPA-010142 | รีเฟรชกลางหน้ารายละเอียดแล้วยังอยู่หน้าเดิมและยังล็อกอินอยู่ | High | Functional |
| TC-SPA-010143 | ปุ่มย้อนกลับและเดินหน้าของเบราว์เซอร์เดินตามเส้นทางที่ผ่านมา | Medium | Functional |
| TC-SPA-010144 | แถบสถานะด้านล่างบอกผู้ใช้ กิจการ รอบบัญชี และเวอร์ชัน | Low | Functional |
| TC-SPA-010145 | ปุ่มข้ามไปเนื้อหาหลักโฟกัสได้ด้วยแป้นพิมพ์ | Low | Functional |
| TC-SPA-010146 | กดเครื่องหมายคำถามเปิดกล่องรายการคีย์ลัด และ Esc ปิด | Low | Functional |
| TC-SPA-010147 | เปิด command palette ด้วยคีย์ลัดแล้วกระโดดไปหน้าที่ค้น | Medium | Functional |

---

## TC-SPA-010101 — เมนู Modules เปิดจาก navbar และแสดงไทล์ของทุกโมดูลที่มองเห็นได้
**Priority:** High · **Test Type:** Functional
**Preconditions**
Login เป็น admin (`admin@blueledgers.com`, BU = `BLAVG`) ผ่าน auth fixture; viewport กว้างอย่างน้อย 1280px; อยู่ที่ `/dashboard`
**Steps**
1. กดปุ่มบน navbar ที่มีชื่อเข้าถึงว่า "Modules"
2. รอให้ป็อปโอเวอร์เปิด
3. อ่านป้ายกำกับของไทล์ทุกใบในตาราง
**Expected**
ป็อปโอเวอร์เปิดเป็นตารางสามคอลัมน์ · สำหรับ admin ที่ BU มีสัญญาครบ มีไทล์ 11 ใบ ป้ายกำกับตรงกับชื่อโมดูลราก ได้แก่ Dashboard, Procurement, Product Management, Vendor Management, Store Operations, Inventory Management, Operational Planning, Report, Accounting, Config, System Administration · ทุกไทล์ที่ไม่ถูกล็อกเป็นลิงก์ (`<a href>`) ที่ชี้ไป path ของโมดูลนั้น · ถ้า BU ของรอบทดสอบถูกปลดระวาง feature ใดไว้ ไทล์นั้นจะไม่อยู่ในรายการเลย เคสจึง assert ว่าป้ายทุกใบที่พบอยู่ในรายชื่อข้างต้น และอย่างน้อย Dashboard, Procurement, Config, System Administration ต้องมีครบ

---

## TC-SPA-010102 — คลิกไทล์ในเมนู Modules พาไปหน้า landing ของโมดูลและปิดเมนูเอง
**Priority:** High · **Test Type:** Functional
**Preconditions**
Login เป็น admin; อยู่ที่ `/dashboard`; เมนู Modules ยังไม่เปิด
**Steps**
1. เปิดเมนู Modules
2. คลิกไทล์ "Store Operations"
3. รอให้หน้าใหม่โหลด
**Expected**
URL เปลี่ยนเป็น `/store-operation` · ป็อปโอเวอร์ปิดเอง (ไทล์ใบอื่นไม่ปรากฏบนจออีก) · หน้าที่ได้คือหน้า landing ของโมดูล: หัวเรื่องระดับ 1 อ่านว่า "Store Operations" มีบรรทัดคำอธิบายใต้หัวเรื่อง มีบรรทัดนับจำนวนเมนูย่อย และมีการ์ดของเมนูย่อยเรียงเป็นตาราง

---

## TC-SPA-010103 — แถบคีย์ลัดใต้เมนู Modules บอกปุ่มที่ใช้เปิด
**Priority:** Low · **Test Type:** Functional
**Preconditions**
Login เป็น admin; รันบนเครื่อง/เบราว์เซอร์ที่ระบุ platform ได้ (Chromium บน macOS หรือ Linux)
**Steps**
1. เปิดเมนู Modules
2. อ่านแถบล่างสุดของป็อปโอเวอร์
**Expected**
แถบล่างมีข้อความนำ "Open with" ตามด้วยปุ่มสองปุ่มในรูปแบบ `<kbd>` · ปุ่มแรกเป็น `⌘` เมื่อรันบน macOS และเป็น `Ctrl` บนแพลตฟอร์มอื่น ปุ่มที่สองเป็น `K` เสมอ

---

## TC-SPA-010104 — กด Escape ปิดเมนู Modules โดยไม่เปลี่ยนหน้า
**Priority:** Low · **Test Type:** Functional
**Preconditions**
Login เป็น admin; อยู่ที่ `/dashboard`; เมนู Modules เปิดอยู่
**Steps**
1. กดปุ่ม Escape
2. ตรวจ URL ปัจจุบัน
**Expected**
ป็อปโอเวอร์ปิด ไทล์ทั้งหมดหายจากจอ · URL ยังเป็น `/dashboard` ไม่มีการนำทางเกิดขึ้น · โฟกัสกลับไปที่ปุ่ม "Modules"

---

## TC-SPA-010105 — เมนู Modules เปิดได้จากหน้าที่อยู่นอกทุกโมดูล
**Priority:** Medium · **Test Type:** Functional
**Preconditions**
Login เป็น admin; เปิด `/profile` (หน้าที่ไม่อยู่ใน `moduleList`)
**Steps**
1. ยืนยันว่าอยู่ที่ `/profile`
2. เปิดเมนู Modules จาก navbar
3. คลิกไทล์ "Procurement"
**Expected**
ปุ่ม "Modules" ยังอยู่บน navbar ของหน้านี้และเปิดป็อปโอเวอร์ได้ตามปกติ (navbar อยู่เหนือ `RouteGuard` จึงไม่ขึ้นกับหน้า) · คลิกแล้ว URL เปลี่ยนเป็น `/procurement`

---

## TC-SPA-010106 — ไทล์โมดูลที่ผู้ใช้ไม่มีสิทธิ์ยังแสดงอยู่แต่กดแล้วขึ้นกล่องแจ้งสิทธิ์
**Priority:** High · **Test Type:** Authorization
**Preconditions**
Login เป็น `requestor@blueledgers.com` (ไม่ใช่ admin ของ BU `BLAVG` จึงไม่ได้ข้ามการตรวจสิทธิ์); ผู้ใช้ไม่มีสิทธิ์ `system_configuration.view`
**Steps**
1. เปิดเมนู Modules
2. หาไทล์ "System Administration"
3. คลิกไทล์นั้น
**Expected**
ไทล์ "System Administration" **ยังอยู่ในเมนู** (ไม่ถูกซ่อน) แต่เป็น `<button>` ที่มี `aria-disabled` และแสดงจางลง ไม่ใช่ลิงก์ · คลิกแล้ว **ไม่มีการนำทาง** URL คงเดิม · มีกล่องแจ้งเตือนขึ้นมาแทน หัวเรื่อง "Permission Denied" คำอธิบาย "You don't have permission to perform this action." และบรรทัด "Contact your administrator to request access."

---

## TC-SPA-010107 — sidebar แสดงเฉพาะเมนูของโมดูลที่กำลังเปิดอยู่
**Priority:** High · **Test Type:** Functional
**Preconditions**
Login เป็น admin; viewport กว้างอย่างน้อย 1280px (แคบกว่า 1024px sidebar จะย่อเอง)
**Steps**
1. เปิด `/procurement/purchase-request`
2. อ่านรายการเมนูทั้งหมดใน sidebar
**Expected**
sidebar แสดงหัวโมดูล "Procurement" แล้วตามด้วยเมนูของโมดูลนี้เท่านั้น: My Approval, Purchase Request, Purchase Request Template, Purchase Order, Goods Receive Note, Credit Note · **ไม่มี**เมนูของโมดูลอื่น (เช่น Config, Vendor Management) ปนอยู่ — ทางไปโมดูลอื่นอยู่ในเมนู Modules บน navbar เท่านั้น

---

## TC-SPA-010108 — หัว sidebar เป็นลิงก์กลับหน้า landing ของโมดูล
**Priority:** Medium · **Test Type:** Functional
**Preconditions**
Login เป็น admin; อยู่ที่ `/procurement/purchase-request`
**Steps**
1. คลิกหัวโมดูลที่อยู่บนสุดของ sidebar (ชื่อเข้าถึงว่า "Procurement")
2. รอให้หน้าโหลด
**Expected**
URL เปลี่ยนเป็น `/procurement` (หน้า landing ของโมดูล) · sidebar ยังเป็นชุดเมนูของ Procurement เหมือนเดิม

---

## TC-SPA-010109 — ย้ายข้ามโมดูลแล้วชุดเมนูใน sidebar เปลี่ยนตามทั้งชุด
**Priority:** High · **Test Type:** Functional
**Preconditions**
Login เป็น admin; viewport กว้างอย่างน้อย 1280px; เริ่มที่ `/procurement/purchase-request`
**Steps**
1. บันทึกรายชื่อเมนูใน sidebar ของหน้า Procurement
2. เปิดเมนู Modules แล้วคลิกไทล์ "Config"
3. อ่านรายชื่อเมนูใน sidebar อีกครั้ง
**Expected**
หัว sidebar เปลี่ยนเป็น "Config" และรายการเมนูเปลี่ยนเป็นชุดของ Config (มี Unit, Department, Currency, Tax Profile, Credit Term ฯลฯ) · ไม่มีเมนูของ Procurement เหลืออยู่แม้แต่รายการเดียว

---

## TC-SPA-010110 — เมนูของหน้าปัจจุบันถูกไฮไลต์ และยังไฮไลต์เมื่อเข้าหน้ารายละเอียด
**Priority:** Medium · **Test Type:** Functional
**Preconditions**
Login เป็น admin; มีใบขอซื้ออย่างน้อย 1 ใบใน BU `BLAVG`
**Steps**
1. เปิด `/procurement/purchase-request`
2. ตรวจสถานะไฮไลต์ของเมนู "Purchase Request" และของเมนูอื่นใน sidebar
3. คลิกเปิดใบแรกในรายการเพื่อเข้าหน้ารายละเอียด (URL กลายเป็น `/procurement/purchase-request/<uuid>`)
4. ตรวจสถานะไฮไลต์อีกครั้ง
**Expected**
ที่หน้ารายการ เมนู "Purchase Request" อยู่ในสถานะ active (`data-active="true"` บนปุ่มเมนู) ส่วนเมนูอื่นเป็น `false` ทั้งหมด · หลังเข้าหน้ารายละเอียด เมนู "Purchase Request" **ยังคง** active เพราะการจับคู่ใช้ `pathname.startsWith(sub.path + "/")` และยังมีเมนู active เพียงรายการเดียว

---

## TC-SPA-010111 — หน้าที่อยู่นอกทุกโมดูลมี sidebar ที่ไม่มีรายการเมนูเลย
**Priority:** Medium · **Test Type:** Edge Case
**Preconditions**
Login เป็น admin; viewport กว้างอย่างน้อย 1280px
**Steps**
1. เปิด `/profile`
2. ตรวจเนื้อหาใน sidebar
3. เปิด `/notifications` แล้วตรวจซ้ำ
**Expected**
ทั้งสองหน้า sidebar ยังอยู่ (มี `data-slot="sidebar"` และโลโก้ Carmen Blue ในส่วนหัว) แต่ **ไม่มีหัวโมดูลและไม่มีรายการเมนูเลยสักรายการ** — สองหน้านี้ไม่แมตช์โมดูลใดใน `moduleList` · การนำทางออกจากสองหน้านี้ทำได้ผ่านเมนู Modules, breadcrumb และโลโก้เท่านั้น

---

## TC-SPA-010112 — ย่อ/ขยาย sidebar ด้วยปุ่มบน navbar
**Priority:** Medium · **Test Type:** Functional
**Preconditions**
Login เป็น admin; viewport กว้างอย่างน้อย 1280px; อยู่ที่ `/procurement/purchase-request`; sidebar เริ่มต้นในสถานะขยาย
**Steps**
1. อ่านค่า `data-state` ของ sidebar (ต้องเป็น `expanded`)
2. กดปุ่มซ้ายสุดบน navbar (ชื่อเข้าถึงว่า "Toggle Sidebar")
3. อ่าน `data-state` และตรวจว่าข้อความของเมนูยังมองเห็นไหม
4. กดปุ่มเดิมอีกครั้ง
**Expected**
หลังกดครั้งแรก sidebar มี `data-state="collapsed"` และ `data-collapsible="icon"` เหลือเฉพาะไอคอนของแต่ละเมนู ข้อความชื่อเมนูถูกซ่อน · หลังกดครั้งที่สองกลับเป็น `expanded` และข้อความกลับมาครบ · เนื้อหาของหน้าไม่ถูกนำทางไปไหน URL คงเดิม

---

## TC-SPA-010113 — ย่อ/ขยาย sidebar ด้วยคีย์ลัด
**Priority:** Low · **Test Type:** Functional
**Preconditions**
Login เป็น admin; viewport กว้างอย่างน้อย 1280px; โฟกัสไม่ได้อยู่ในช่องกรอกข้อความใด ๆ
**Steps**
1. กด `Meta+B` (macOS) หรือ `Control+B` (แพลตฟอร์มอื่น)
2. อ่าน `data-state` ของ sidebar
3. กดคีย์ลัดเดิมอีกครั้ง
**Expected**
กดครั้งแรก sidebar ย่อเป็น `data-state="collapsed"` · กดซ้ำกลับเป็น `expanded` · ไม่มีการนำทางและไม่มีกล่องใดเปิดขึ้น

---

## TC-SPA-010114 — เมนูชั้นที่สามของ Workflow เยื้องเข้าและหายไปเมื่อย่อ sidebar
**Priority:** Low · **Test Type:** Functional
**Preconditions**
Login เป็น admin (ต้องมีสิทธิ์ System Administration); viewport กว้างอย่างน้อย 1280px; เปิด `/system-admin/workflow`
**Steps**
1. อ่านรายการใต้เมนู "Workflows" ใน sidebar
2. คลิกรายการ "Purchase Request" ที่อยู่ใต้ Workflows
3. ย่อ sidebar ด้วยปุ่ม Toggle Sidebar
4. ตรวจว่ารายการชั้นที่สามยังอยู่ไหม
**Expected**
ใต้เมนู "Workflows" มีรายการย่อยเยื้องเข้าไปหนึ่งระดับสี่รายการ: Purchase Request, Purchase Order, Store Requisition และ Notification Template · คลิกรายการแรกแล้ว URL เป็น `/system-admin/workflow/purchase-request` และรายการนั้น active · เมื่อ sidebar ถูกย่อเป็นโหมดไอคอน รายการชั้นที่สามทั้งสี่ **ถูกซ่อนทั้งหมด** เหลือเฉพาะไอคอนของเมนูชั้นสอง

---

## TC-SPA-010115 — เมนูใน sidebar ที่ผู้ใช้ไม่มีสิทธิ์เป็นปุ่มแจ้งสิทธิ์ ไม่ใช่ลิงก์
**Priority:** High · **Test Type:** Authorization
**Preconditions**
Login เป็น `requestor@blueledgers.com`; viewport กว้างอย่างน้อย 1280px; ผู้ใช้เปิดหน้าในกลุ่ม System Administration ไม่ได้
**Steps**
1. เปิดหน้า landing ของโมดูลที่ผู้ใช้เข้าถึงได้ แล้วเปิดเมนู Modules คลิกไทล์ "System Administration" เพื่อให้กล่องแจ้งสิทธิ์ขึ้น จากนั้นปิดกล่อง
2. เปิด `/procurement` (โมดูลที่ผู้ใช้เข้าได้) และตรวจว่ามีเมนูใดใน sidebar ที่อยู่ในสถานะจาง
3. คลิกเมนูที่จางนั้น
**Expected**
เมนูที่ผู้ใช้ไม่มีสิทธิ์ถูก render เป็น `<button>` ที่มีคลาส `opacity-50` (จาง) แทนที่จะเป็น `<a href>` — **ไม่ได้หายไปจากเมนู** · คลิกแล้ว URL ไม่เปลี่ยน และมีกล่อง "Permission Denied" ขึ้นมา · เมนูที่ผู้ใช้มีสิทธิ์ในโมดูลเดียวกันยังเป็นลิงก์ปกติและกดไปได้

---

## TC-SPA-010116 — โลโก้ใน sidebar พากลับหน้าแรกของผู้ใช้
**Priority:** Low · **Test Type:** Functional
**Preconditions**
Login เป็น admin; อยู่ที่ `/config/unit`
**Steps**
1. คลิกโลโก้ Carmen Blue ที่ส่วนหัวของ sidebar
2. รอให้หน้าโหลด
**Expected**
ลิงก์ชี้ไป `/` และถูกส่งต่อไปยังหน้าแรกที่ผู้ใช้เปิดได้ทันที — สำหรับ admin คือ `/dashboard` · ระหว่างทางไม่มีหน้า 404 และไม่มีกล่องปฏิเสธสิทธิ์

---

## TC-SPA-010117 — breadcrumb สะท้อนเส้นทางปัจจุบันและชั้นสุดท้ายกดไม่ได้
**Priority:** Medium · **Test Type:** Functional
**Preconditions**
Login เป็น admin; เปิด `/config/department`
**Steps**
1. อ่านชั้นทั้งหมดของ breadcrumb บน navbar
2. ตรวจว่าชั้นใดเป็นลิงก์และชั้นใดไม่ใช่
**Expected**
breadcrumb มีสองชั้นตามลำดับ "Config" แล้ว "Department" · ชั้น "Config" เป็นลิงก์ไป `/config` · ชั้น "Department" ซึ่งเป็นหน้าปัจจุบัน **ไม่ใช่ลิงก์** (render เป็น `BreadcrumbPage`) · ชื่อที่แสดงเป็นคำแปลตามภาษาที่เลือก ไม่ใช่ชื่อ segment ดิบ

---

## TC-SPA-010118 — breadcrumb ตัดรหัสเอกสารทิ้งและทุกชั้นกดได้เมื่ออยู่หน้ารายละเอียด
**Priority:** Medium · **Test Type:** Functional
**Preconditions**
Login เป็น admin; มีใบขอซื้ออย่างน้อย 1 ใบ; เปิดใบนั้นจนได้ URL รูปแบบ `/procurement/purchase-request/<uuid>`
**Steps**
1. อ่านชั้นทั้งหมดของ breadcrumb
2. ตรวจว่ามีชั้นใดที่เป็น UUID หรือไม่
3. ตรวจว่าชั้นสุดท้ายเป็นลิงก์หรือไม่
**Expected**
breadcrumb มีสองชั้น "Procurement" และ "Purchase Request" เท่านั้น — **ไม่มีชั้นที่เป็น UUID** เพราะ segment ที่เป็นรหัสถูกกรองออก · เนื่องจากหน้าปัจจุบันลงท้ายด้วยรหัส จึง **ไม่มีชั้นไหนที่เป็น `BreadcrumbPage`** ทั้งสองชั้นเป็นลิงก์ที่กดได้

---

## TC-SPA-010119 — กดชั้นก่อนหน้าบน breadcrumb กลับไปหน้ารายการ
**Priority:** Medium · **Test Type:** Alternate Flow
**Preconditions**
Login เป็น admin; อยู่ที่หน้ารายละเอียดใบขอซื้อ (`/procurement/purchase-request/<uuid>`)
**Steps**
1. คลิกชั้น "Purchase Request" บน breadcrumb
2. รอให้หน้าโหลด
**Expected**
URL เปลี่ยนเป็น `/procurement/purchase-request` และตารางรายการแสดงขึ้น · breadcrumb กลับมาเหลือสองชั้นโดยชั้นสุดท้ายกดไม่ได้อีกแล้ว

---

## TC-SPA-010120 — ตัวสลับหน่วยธุรกิจแสดงกิจการที่ใช้งานอยู่บน navbar
**Priority:** Medium · **Test Type:** Functional
**Preconditions**
Login เป็น admin; BU ที่ใช้งานอยู่คือ `BLAVG`; viewport กว้างอย่างน้อย 1280px; โปรไฟล์โหลดสำเร็จ
**Steps**
1. รอให้ปุ่มสลับหน่วยธุรกิจบน navbar เลิกเป็นโครงร่างสีเทา
2. อ่านข้อความบนปุ่ม
**Expected**
ปุ่มแสดงรูปโปรไฟล์ของกิจการ + ชื่อกิจการที่ใช้งานอยู่ (รูปแบบ `<alias> - <name>` เมื่อมีชื่อย่อ มิฉะนั้นเป็นชื่อเต็ม) ตรงกับ BU ที่ `is_default` ในโปรไฟล์ · มีไอคอนลูกศรขึ้น-ลงบอกว่ากดเพื่อเปลี่ยนได้

---

## TC-SPA-010121 — รายการหน่วยธุรกิจทำเครื่องหมายกิจการปัจจุบันและกดซ้ำไม่ได้
**Priority:** Medium · **Test Type:** Functional
**Preconditions**
Login เป็น admin; บัญชีสังกัดอย่างน้อย 1 BU
**Steps**
1. กดปุ่มสลับหน่วยธุรกิจ
2. อ่านหัวข้อและรายการทั้งหมดในเมนู
3. ตรวจสถานะของรายการที่ตรงกับกิจการปัจจุบัน
**Expected**
เมนูเปิดขึ้นพร้อมหัวข้อ "Business Unit" · รายการครบตามจำนวน BU ที่บัญชีสังกัด แต่ละรายการแสดงชื่อกิจการและชื่อโรงแรมใต้ชื่อ · รายการของกิจการที่ใช้งานอยู่อยู่ในสถานะ disabled (กดไม่ได้) และมีเครื่องหมายบอกว่ากำลังใช้งาน (แถบสีทางซ้ายและจุดทางขวา)

---

## TC-SPA-010122 — สลับหน่วยธุรกิจแล้วขึ้นข้อความยืนยันและถูกพาไปหน้า dashboard
**Priority:** High · **Test Type:** Functional
**Preconditions**
Login เป็น admin; **บัญชีสังกัดอย่างน้อย 2 BU** (อ่านด้วย `getBusinessUnits(page)` แล้วข้ามเทสถ้ามีแค่ BU เดียว); เริ่มต้นอยู่ที่หน้าที่ไม่ใช่ dashboard เช่น `/config/unit`
**Steps**
1. เปิดเมนูสลับหน่วยธุรกิจ
2. คลิกกิจการที่ยังไม่ได้ใช้งาน
3. รอให้ toast ขึ้นและหน้าเปลี่ยน
4. **คืนสถานะ:** เรียก `ensureActiveBu(page, "BLAVG")` เพื่อสลับกลับ
**Expected**
ระหว่างสลับ ปุ่มสลับหน่วยธุรกิจและเมนูผู้ใช้กลายเป็นโครงร่างสีเทา · เมื่อสำเร็จมี toast ข้อความ `Switched to <ชื่อกิจการ>` · URL เปลี่ยนเป็น `/dashboard` โดยอัตโนมัติ (ไม่ใช่ค้างอยู่หน้าเดิม) · ปุ่มบน navbar แสดงชื่อกิจการใหม่ · แถบสถานะด้านล่างแสดงรหัสกิจการใหม่

---

## TC-SPA-010123 — สลับหน่วยธุรกิจแล้วรายการข้อมูลถูกดึงใหม่ตามกิจการใหม่
**Priority:** High · **Test Type:** Functional
**Preconditions**
Login เป็น admin; บัญชีสังกัดอย่างน้อย 2 BU และทั้งสอง BU มีข้อมูลแผนกที่ต่างกัน; เริ่มที่ BU `BLAVG`
**Steps**
1. เปิด `/config/department` แล้วบันทึกจำนวนแถวและรหัสของแถวแรก
2. สลับไปอีกกิจการหนึ่งผ่านตัวสลับบน navbar
3. เปิด `/config/department` อีกครั้ง
4. เทียบรายการที่ได้กับที่บันทึกไว้
5. **คืนสถานะ:** `ensureActiveBu(page, "BLAVG")`
**Expected**
รายการแผนกหลังสลับเป็นชุดข้อมูลของกิจการใหม่ (ตารางถูกดึงใหม่ ไม่ใช่ค่าที่ค้างจาก cache ของกิจการเดิม — การสลับล้าง query cache ทุกคีย์ที่ไม่ใช่โปรไฟล์) · รายการอย่างน้อยหนึ่งอย่างต่างจากเดิม: จำนวนแถว หรือรหัสของแถวแรก

---

## TC-SPA-010124 — เมนูผู้ใช้แสดงชื่อ อีเมล แผนก และแบ่งเป็นสองหมวด
**Priority:** Medium · **Test Type:** Functional
**Preconditions**
Login เป็น admin; โปรไฟล์โหลดสำเร็จ; viewport กว้างอย่างน้อย 1280px
**Steps**
1. กดรูปโปรไฟล์ที่มุมขวาของ navbar
2. อ่านส่วนหัวของเมนูและรายการทั้งหมด
**Expected**
เมนูเปิดขึ้นโดยส่วนบนแสดงรูปโปรไฟล์ขนาดใหญ่ ชื่อ-นามสกุล อีเมลที่ใช้ล็อกอิน และชื่อแผนก (ถ้าไม่มีแผนกจะแสดง "No department" เป็นสีเตือน) · ถัดมามีหัวข้อหมวด "Account" ที่มีรายการ Profile และ Change Password · แล้วหัวข้อหมวด "Preferences" ที่มีเมนูย่อย Language, Theme และขนาดตัวอักษร · ล่างสุดคั่นเส้นแล้วเป็น "Log out" สีแดง

---

## TC-SPA-010125 — เปลี่ยนธีมเป็นมืดแล้วทั้งแอปเปลี่ยนตาม
**Priority:** Medium · **Test Type:** Functional
**Preconditions**
Login เป็น admin; ธีมเริ่มต้นไม่ใช่ Dark; บันทึกค่าธีมเดิมไว้เพื่อคืนค่าท้ายเทส
**Steps**
1. เปิดเมนูผู้ใช้
2. ชี้/กดที่เมนูย่อย "Theme"
3. เลือก "Dark"
4. ปิดเมนูแล้วตรวจสถานะของหน้า
5. **คืนสถานะ:** เลือกธีมเดิมกลับ
**Expected**
เมนูย่อยแสดงสามตัวเลือก Light, Dark, System พร้อมภาพตัวอย่างของแต่ละแบบ · หลังเลือก Dark องค์ประกอบ `<html>` ได้คลาส `dark` และพื้นหลังของหน้าเปลี่ยนเป็นโทนมืดทันทีโดยไม่ต้องโหลดหน้าใหม่ · เปิดเมนูซ้ำ ตัวเลือก "Dark" มีเครื่องหมายถูกกำกับ ส่วนอีกสองตัวไม่มี

---

## TC-SPA-010126 — ธีมที่เลือกยังอยู่หลังรีเฟรชหน้า
**Priority:** Medium · **Test Type:** Functional
**Preconditions**
Login เป็น admin; เพิ่งเลือกธีม Dark จากเมนูผู้ใช้; บันทึกค่าเดิมไว้เพื่อคืนค่า
**Steps**
1. รีเฟรชหน้าปัจจุบัน
2. รอให้แอป boot เสร็จ
3. ตรวจคลาสของ `<html>` และเครื่องหมายถูกในเมนู Theme
4. **คืนสถานะ:** เลือกธีมเดิมกลับ
**Expected**
หลังรีเฟรช `<html>` ยังมีคลาส `dark` และหน้ายังเป็นโทนมืด · เมนู Theme ยังติ๊กที่ "Dark"

---

## TC-SPA-010127 — เปลี่ยนภาษาแล้วเปลือกแอปและภาษาของเอกสารเปลี่ยนตาม
**Priority:** High · **Test Type:** Functional
**Preconditions**
Login เป็น admin; ภาษาปัจจุบันเป็น English (ค่าเริ่มต้นของแอป); อยู่ที่ `/procurement/purchase-request`; บันทึกค่าภาษาเดิมไว้เพื่อคืนค่า
**Steps**
1. เปิดเมนูผู้ใช้ → เมนูย่อย "Language"
2. เลือก "ไทย"
3. ตรวจ sidebar, breadcrumb และแอตทริบิวต์ `lang` ของ `<html>`
4. **คืนสถานะ:** เลือก "English" กลับ
**Expected**
เมนูย่อยมีสองตัวเลือกคือ English และ ไทย · หลังเลือกไทย แอตทริบิวต์ `lang` ของ `<html>` กลายเป็น `th` · ชื่อเมนูใน sidebar และชั้นต่าง ๆ ของ breadcrumb เปลี่ยนเป็นคำแปลภาษาไทย โดยไม่ต้องโหลดหน้าใหม่และไม่มีช่วงที่โชว์คีย์ดิบของข้อความ · เปิดเมนูซ้ำ ตัวเลือก "ไทย" มีเครื่องหมายถูก

---

## TC-SPA-010128 — ภาษาที่เลือกยังอยู่หลังรีเฟรชหน้า
**Priority:** Medium · **Test Type:** Functional
**Preconditions**
Login เป็น admin; เพิ่งเปลี่ยนภาษาเป็นไทย; บันทึกค่าเดิมไว้เพื่อคืนค่า
**Steps**
1. รีเฟรชหน้าปัจจุบัน
2. รอให้แอป boot เสร็จ
3. ตรวจ `lang` ของ `<html>` และชื่อเมนูใน sidebar
4. **คืนสถานะ:** เปลี่ยนภาษากลับเป็น English
**Expected**
หลังรีเฟรช `<html lang="th">` และชื่อเมนูยังเป็นภาษาไทย (ค่าถูกเก็บไว้ใน `localStorage` คีย์ `carmen.locale`)

---

## TC-SPA-010129 — เปลี่ยนขนาดตัวอักษรแล้วมีผลกับทั้งแอป
**Priority:** Low · **Test Type:** Functional
**Preconditions**
Login เป็น admin; ขนาดตัวอักษรปัจจุบันเป็นค่าปกติ; บันทึกค่าเดิมไว้เพื่อคืนค่า
**Steps**
1. เปิดเมนูผู้ใช้ → เมนูย่อยขนาดตัวอักษร
2. เลือกระดับที่ใหญ่กว่าปกติ
3. ตรวจคลาสของ `<html>`
4. **คืนสถานะ:** เลือกระดับปกติกลับ
**Expected**
เมนูย่อยแสดงตัวเลือกห้าระดับพร้อมตัวอย่างตัวอักษร "Aa" ที่ขนาดต่างกันจริง · หลังเลือก `<html>` ได้คลาส `font-scale-<ระดับที่เลือก>` และขนาดตัวอักษรของเปลือกแอปใหญ่ขึ้นทันที · เปิดเมนูซ้ำ ระดับที่เลือกมีเครื่องหมายถูก

---

## TC-SPA-010130 — เมนูผู้ใช้มีทางเข้าหน้าโปรไฟล์
**Priority:** Low · **Test Type:** Functional
**Preconditions**
Login เป็น admin; อยู่ที่หน้าใดก็ได้ที่ไม่ใช่ `/profile`
**Steps**
1. เปิดเมนูผู้ใช้
2. คลิกรายการ "Profile" ในหมวด Account
**Expected**
URL เปลี่ยนเป็น `/profile` และหน้าโปรไฟล์แสดงขึ้น · เมนูผู้ใช้ปิดลง · ไม่มีหน้า 404 และไม่มีกล่องปฏิเสธสิทธิ์ (หน้านี้อยู่นอก `moduleList` จึงเปิดได้เสมอ)

---

## TC-SPA-010131 — ออกจากระบบต้องยืนยันก่อน และกดยกเลิกแล้วยังอยู่ในระบบ
**Priority:** Medium · **Test Type:** Functional
**Preconditions**
Login เป็น admin; อยู่ที่ `/dashboard`
**Steps**
1. เปิดเมนูผู้ใช้
2. คลิก "Log out"
3. อ่านกล่องที่ขึ้นมา
4. กดปุ่มยกเลิก
**Expected**
มีกล่องยืนยันชนิด alertdialog ขึ้นมา หัวเรื่อง "Log out of your account?" และคำอธิบายว่าจะต้องเข้าสู่ระบบใหม่ พร้อมปุ่มยกเลิกและปุ่ม Log out สีแดง · การคลิกในเมนู **ยังไม่ทำให้ออกจากระบบ** · หลังกดยกเลิก กล่องปิด ยังอยู่ที่ `/dashboard` และ navbar ยังแสดงข้อมูลผู้ใช้ตามปกติ

---

## TC-SPA-010132 — กระดิ่งแจ้งเตือนเปิดกล่องพร้อมหัวข้อและทางไปหน้ารวม
**Priority:** Medium · **Test Type:** Functional
**Preconditions**
Login เป็น admin; โปรไฟล์โหลดสำเร็จ; viewport กว้างอย่างน้อย 1280px
**Steps**
1. กดปุ่มกระดิ่งบน navbar (ชื่อเข้าถึงว่า "Notifications")
2. อ่านส่วนหัวของป็อปโอเวอร์
**Expected**
ป็อปโอเวอร์เปิดขึ้น ส่วนหัวมีไอคอนกระดิ่งและคำว่า "Notifications" · ถ้ามีรายการที่ยังไม่อ่าน จะมีตัวเลขจำนวนอยู่ข้างหัวข้อและมีปุ่ม "Clear" สำหรับทำเครื่องหมายอ่านทั้งหมด · มุมขวาของส่วนหัวมีปุ่มลิงก์ไปหน้ารวมแจ้งเตือนพร้อมคำอธิบาย "View all notifications"

---

## TC-SPA-010133 — ปุ่มดูทั้งหมดในกล่องแจ้งเตือนพาไปหน้ารวมและปิดกล่อง
**Priority:** Medium · **Test Type:** Functional
**Preconditions**
Login เป็น admin; ป็อปโอเวอร์แจ้งเตือนเปิดอยู่; อยู่ที่หน้าที่ไม่ใช่ `/notifications`
**Steps**
1. คลิกปุ่มลิงก์ "View all notifications" ที่มุมขวาของส่วนหัว
2. รอให้หน้าโหลด
**Expected**
URL เปลี่ยนเป็น `/notifications` และหน้ารวมแจ้งเตือนแสดงขึ้น · ป็อปโอเวอร์ปิดเอง · ปุ่มกระดิ่งยังอยู่บน navbar และกดเปิดซ้ำได้

---

## TC-SPA-010134 — ไม่มีแจ้งเตือนค้าง ไม่มีตัวเลขบนกระดิ่งและกล่องขึ้นสถานะว่าง
**Priority:** Low · **Test Type:** Edge Case
**Preconditions**
Login เป็นบัญชีที่ไม่มีแจ้งเตือนค้างอยู่ (ถ้ามีค้าง ให้กด "Clear" ก่อนหรือข้ามเทส)
**Steps**
1. ตรวจว่าปุ่มกระดิ่งมีป้ายตัวเลขหรือไม่
2. เปิดป็อปโอเวอร์แจ้งเตือน
3. อ่านเนื้อหาในกล่อง
**Expected**
ปุ่มกระดิ่ง **ไม่มี**ป้ายตัวเลขสีแดง · ในกล่องไม่มีปุ่ม "Clear" (โผล่เฉพาะเมื่อมีรายการค้าง) · เนื้อในกล่องเป็นสถานะว่างที่มีไอคอนกระดิ่งขีดฆ่า หัวข้อ "No Notifications Yet" และคำอธิบาย "You don't have any notifications yet."

---

## TC-SPA-010135 — เปิดรากของเว็บแล้วถูกพาไปหน้าแรกที่ผู้ใช้เปิดได้
**Priority:** High · **Test Type:** Functional
**Preconditions**
Login เป็น admin ผ่าน auth fixture
**Steps**
1. เปิด `/` ตรง ๆ
2. รอให้การส่งต่อเสร็จ
**Expected**
ถูกพาไป `/dashboard` (leaf แรกที่ผู้ใช้เปิดได้ตามลำดับใน `moduleList`) โดยการส่งต่อเป็นแบบ `replace` — กดปุ่มย้อนกลับของเบราว์เซอร์แล้ว **ไม่**วนกลับมาที่ `/` อีก · ไม่มีหน้า 404 และไม่มีกล่องปฏิเสธสิทธิ์ระหว่างทาง

---

## TC-SPA-010136 — deep-link หน้าที่ไม่มีสิทธิ์ขึ้นกล่องปฏิเสธสิทธิ์ในเปลือกแอป
**Priority:** High · **Test Type:** Authorization
**Preconditions**
Login เป็น `requestor@blueledgers.com` (ไม่ใช่ admin); ผู้ใช้ไม่มีสิทธิ์ `system_configuration.view`
**Steps**
1. เปิด `/system-admin/user` ตรง ๆ ด้วย URL
2. รอให้หน้าโหลดเสร็จ
3. ตรวจ navbar และ sidebar
**Expected**
URL **ยังเป็น** `/system-admin/user` (ไม่ถูกส่งต่อไปที่อื่น) · เนื้อหาในหน้าเป็นกล่อง `role="alert"` ที่มีคำกำกับ "Restricted" หัวเรื่อง "Permission Denied" คำอธิบาย "You don't have permission to view this page." และบรรทัด "Contact your administrator to request access." · ปุ่มในกล่องอ่านว่า "Go to an available page" · navbar และ sidebar **ยังอยู่** (ต่างจากหน้า 404 ที่ไม่มีเปลือกแอป)

---

## TC-SPA-010137 — ปุ่มในกล่องปฏิเสธสิทธิ์พาไปหน้าที่ผู้ใช้เปิดได้
**Priority:** Medium · **Test Type:** Authorization
**Preconditions**
Login เป็น `requestor@blueledgers.com`; อยู่ที่หน้าที่ขึ้นกล่องปฏิเสธสิทธิ์จาก `010136`
**Steps**
1. กดปุ่ม "Go to an available page"
2. รอให้หน้าโหลด
**Expected**
ถูกพาไปหน้าแรกที่ผู้ใช้คนนี้เปิดได้จริง (ไม่ใช่การถอย history และไม่ใช่ `/login`) และหน้านั้นแสดงเนื้อหาจริง ไม่ใช่กล่องปฏิเสธสิทธิ์อีกใบ · การนำทางเป็นแบบ `replace` จึงกดย้อนกลับแล้วไม่วนกลับเข้าหน้าที่ไม่มีสิทธิ์

---

## TC-SPA-010138 — URL ที่ไม่มีอยู่จริงขึ้นหน้า 404 เต็มจอโดยไม่มี navbar และ sidebar
**Priority:** High · **Test Type:** Edge Case
**Preconditions**
Login เป็น admin ผ่าน auth fixture (ล็อกอินอยู่ — เคสนี้พิสูจน์ว่า 404 ไม่ได้อยู่ใต้เปลือกแอป)
**Steps**
1. เปิด `/ไม่มีเส้นทางนี้` (เช่น `/no-such-page`) ตรง ๆ
2. อ่านเนื้อหาบนหน้า
3. ตรวจว่ามี navbar หรือ sidebar หรือไม่
**Expected**
หน้าแสดงเลข `404` ขนาดใหญ่ คำกำกับ "Page not found" หัวเรื่อง "We can't find that page" คำอธิบายว่าหน้านี้ไม่มีอยู่หรือถูกย้าย ปุ่ม "Back to Dashboard" และแถบท้ายที่มีปีปัจจุบันกับชื่อผลิตภัณฑ์ · **ไม่มี navbar (`data-slot="navbar"`) และไม่มี sidebar (`data-slot="sidebar"`) บนหน้านี้** เพราะ catch-all อยู่นอก shell · ไม่ถูกส่งต่อไป `/login`

---

## TC-SPA-010139 — URL ที่ไม่มีอยู่จริงใต้โมดูลก็ได้หน้า 404 ชุดเดียวกัน
**Priority:** Medium · **Test Type:** Edge Case
**Preconditions**
Login เป็น admin
**Steps**
1. เปิด `/procurement/no-such-child` ตรง ๆ
2. อ่านเนื้อหาบนหน้า
3. ทำซ้ำกับ `/config/no-such-child`
**Expected**
ทั้งสอง URL ได้หน้า 404 หน้าเดียวกันกับ `010138` (เลข 404 + ปุ่ม "Back to Dashboard") ไม่ใช่หน้า landing ของโมดูล ไม่ใช่กล่องปฏิเสธสิทธิ์ และไม่ใช่หน้าว่าง · navbar และ sidebar ไม่ปรากฏ

---

## TC-SPA-010140 — ปุ่มบนหน้า 404 พากลับเข้าเปลือกแอป
**Priority:** Medium · **Test Type:** Alternate Flow
**Preconditions**
Login เป็น admin; อยู่ที่หน้า 404 จาก `010138`
**Steps**
1. คลิกปุ่ม "Back to Dashboard"
2. รอให้หน้าโหลด
**Expected**
URL เปลี่ยนเป็น `/dashboard` · navbar และ sidebar กลับมาแสดง · หน้า dashboard แสดงเนื้อหาจริง ไม่ต้องล็อกอินใหม่

---

## TC-SPA-010141 — ล็อกอินจากลิงก์ที่ระบุปลายทางแล้วไปถึงปลายทางนั้น
**Priority:** Medium · **Test Type:** Auth-guard
**Preconditions**
Browser context สะอาด (ไม่มี session) — ใช้ base test ไม่ใช่ auth fixture; ใช้ `loginWithRetry` ตาม convention ของโปรเจกต์
**Steps**
1. เปิด `/login?next=/config/unit`
2. กรอกอีเมลและรหัสผ่านของ admin แล้วกด Sign In
3. รอให้การล็อกอินเสร็จ
**Expected**
หลังล็อกอินสำเร็จถูกพาไป `/config/unit` ตามที่ระบุใน `next` (ไม่ใช่ `/dashboard`) และตารางหน่วยนับแสดงขึ้น · ทดสอบซ้ำด้วยค่า `next` ที่เป็น URL ภายนอกหรือเริ่มด้วย `//` ต้องตกไปที่ `/dashboard` แทน (กัน open-redirect)

---

## TC-SPA-010142 — รีเฟรชกลางหน้ารายละเอียดแล้วยังอยู่หน้าเดิมและยังล็อกอินอยู่
**Priority:** High · **Test Type:** Functional
**Preconditions**
Login เป็น admin; มีใบขอซื้ออย่างน้อย 1 ใบ; เปิดหน้ารายละเอียดจนได้ URL `/procurement/purchase-request/<uuid>`
**Steps**
1. บันทึก URL ปัจจุบัน
2. รีเฟรชหน้า
3. รอให้แอป boot เสร็จ (โปรไฟล์โหลดจบ ไม่ใช่โครงร่างสีเทา)
4. ตรวจ URL, navbar และเนื้อหาหน้า
**Expected**
URL เหมือนเดิมทุกตัวอักษร · **ไม่ถูกเด้งไป `/login`** และไม่มีจังหวะที่หน้า login โผล่แวบหนึ่ง (แอป refresh token ให้ก่อน render router) · navbar, sidebar และเนื้อหาของใบเดิมกลับมาแสดงครบ · เมนู "Purchase Request" ใน sidebar ยัง active

---

## TC-SPA-010143 — ปุ่มย้อนกลับและเดินหน้าของเบราว์เซอร์เดินตามเส้นทางที่ผ่านมา
**Priority:** Medium · **Test Type:** Functional
**Preconditions**
Login เป็น admin; มีใบขอซื้ออย่างน้อย 1 ใบ
**Steps**
1. เปิด `/dashboard`
2. ไปที่ `/procurement/purchase-request` ผ่านเมนู Modules + sidebar
3. คลิกเปิดใบแรกเข้าหน้ารายละเอียด
4. กดปุ่มย้อนกลับของเบราว์เซอร์สองครั้ง
5. กดปุ่มเดินหน้าของเบราว์เซอร์หนึ่งครั้ง
**Expected**
ย้อนครั้งแรกกลับมาที่ `/procurement/purchase-request` พร้อมตารางรายการ · ย้อนครั้งที่สองกลับมาที่ `/dashboard` · เดินหน้าหนึ่งครั้งกลับไปที่ `/procurement/purchase-request` · ทุกก้าว sidebar และ breadcrumb อัปเดตให้ตรงกับหน้าที่ยืนอยู่ และไม่มีหน้าใดกลายเป็น 404 หรือหน้าว่าง

---

## TC-SPA-010144 — แถบสถานะด้านล่างบอกผู้ใช้ กิจการ รอบบัญชี และเวอร์ชัน
**Priority:** Low · **Test Type:** Functional
**Preconditions**
Login เป็น admin; โปรไฟล์โหลดสำเร็จ; viewport กว้างอย่างน้อย 1280px
**Steps**
1. เปิด `/dashboard`
2. อ่านแถบล่างสุดของหน้าจอ (`role="contentinfo"`)
**Expected**
แถบสถานะแสดงสองกลุ่ม — ฝั่งซ้ายเป็นบริบทที่กำลังทำงานอยู่ (ชื่อผู้ใช้ · รหัสกิจการปัจจุบัน `BLAVG` · รอบบัญชีรูปแบบ `YYYY-MM` พร้อมจุดสีสถานะ) ฝั่งขวาเป็นข้อมูลระบบ (เวลาจากเซิร์ฟเวอร์ · เวอร์ชันแอปและเวอร์ชัน backend แบบย่อ) · แถบนี้ปรากฏบนทุกหน้าใต้เปลือกแอป ไม่ใช่เฉพาะ dashboard

---

## TC-SPA-010145 — ปุ่มข้ามไปเนื้อหาหลักโฟกัสได้ด้วยแป้นพิมพ์
**Priority:** Low · **Test Type:** Functional
**Preconditions**
Login เป็น admin; อยู่ที่ `/dashboard`; ยังไม่มีองค์ประกอบใดถูกโฟกัส
**Steps**
1. กด Tab หนึ่งครั้ง
2. อ่านองค์ประกอบที่ได้โฟกัส
3. กด Enter
**Expected**
องค์ประกอบแรกที่ได้โฟกัสคือลิงก์ "Skip to content" ซึ่งมองไม่เห็นจนกว่าจะได้โฟกัส · ลิงก์ชี้ไป `#main-content` · กด Enter แล้วโฟกัส/ตำแหน่งเลื่อนไปที่บริเวณเนื้อหาหลัก (`id="main-content"`) ซึ่งเป็นกล่องเดียวกับที่หุ้ม `Outlet` ของทุกหน้า

---

## TC-SPA-010146 — กดเครื่องหมายคำถามเปิดกล่องรายการคีย์ลัด และ Esc ปิด
**Priority:** Low · **Test Type:** Functional
**Preconditions**
Login เป็น admin; อยู่ที่ `/dashboard`; โฟกัสไม่ได้อยู่ในช่องกรอกข้อความใด ๆ (กล่องนี้จงใจไม่ทำงานขณะพิมพ์)
**Steps**
1. กดแป้น `?`
2. อ่านรายการในกล่องที่เปิดขึ้น
3. กด Escape
**Expected**
กล่อง "Keyboard Shortcuts" เปิดขึ้นพร้อมคำอธิบายว่ากด `?` เพื่อสลับกล่องนี้ และรายการสี่บรรทัด: เปิด command palette (`⌘K / Ctrl+K`), แสดงกล่องนี้ (`?`), โฟกัสช่องค้นหาของหน้าปัจจุบัน (`/`), ปิดกล่อง/ล้างโฟกัส (`Esc`) · กด Escape แล้วกล่องปิด และยังอยู่หน้าเดิม

---

## TC-SPA-010147 — เปิด command palette ด้วยคีย์ลัดแล้วกระโดดไปหน้าที่ค้น
**Priority:** Medium · **Test Type:** Functional
**Preconditions**
Login เป็น admin; อยู่ที่ `/dashboard`
**Steps**
1. กด `Meta+K` (macOS) หรือ `Control+K`
2. พิมพ์ "unit" ในช่องค้นหาของ palette
3. เลือกผลลัพธ์ที่เป็นหน้า Unit ของกลุ่ม Config
**Expected**
กล่องค้นหาแบบ spotlight เปิดขึ้นพร้อมช่องกรอกที่โฟกัสอยู่แล้ว · ผลลัพธ์จัดกลุ่มตามโมดูล และมีเฉพาะหน้าที่ผู้ใช้เปิดได้จริง · เลือกแล้ว palette ปิดและ URL เปลี่ยนเป็น `/config/unit` พร้อมตารางหน่วยนับ · หมายเหตุสำหรับผู้เขียนสเปก: คีย์ลัดนี้ผูกไว้สองที่ ป็อปโอเวอร์ Modules อาจสลับสถานะไปพร้อมกัน — เคสนี้ assert เฉพาะ palette เท่านั้น
