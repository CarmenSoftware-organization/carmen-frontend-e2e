# เข้าสู่ระบบ / ออกจากระบบ (Login & Authentication) — Gap Report

_เคสที่ **สเปกอัตโนมัติยังไม่ครอบ** เท่านั้น ไม่ใช่แคตตาล็อกเต็มของหน้านี้ — เคสที่ครอบแล้ว (login/logout สำเร็จรายบทบาท 8 role, ฟอร์มว่าง/อีเมลผิดรูปแบบ/รหัสผิดแล้วยังอยู่ `/login`, email ไม่ case-sensitive แต่ password case-sensitive, trim ช่องว่าง, `type="password"`, กด Enter submit, auth-guard สองทาง, SQL injection / XSS / 401 / 429, open-redirect `?next=//evil`, `?next=/profile`, session คงอยู่หลัง reload, refresh token ปลอม, ปุ่ม show/hide password, ปุ่ม Sign In disable ระหว่าง in-flight, countdown หลัง 429, logout ลบ refresh token) ถูกทดสอบจริงอยู่ใน `tests/001-login.spec.ts` และมีเอกสารที่ generate ไว้ที่ `docs/user-stories/001-login.md`_

**Module:** Login & Authentication (รวมทางออกจากหน้า login: forgot-password / register / legal)
**Frontend route:** `routes/login/` (`login.route.tsx` → `RedirectIfAuthed` + `login-form.tsx`) ร่วมกับ `components/auth/auth-split-shell.tsx`, `components/auth/floating-field.tsx`, `components/auth/require-auth.tsx`, `components/auth/redirect-if-authed.tsx`, `lib/auth/auth-api.ts`, `lib/auth/token-store.ts`, `lib/auth/refresh-token-storage.ts`, `lib/auth/resolve-next-path.ts`, `main.tsx`  •  **URL:** `/login`
**Prefix:** `LOGIN` (ชุดเดียวกับสเปก — gap report ใช้ prefix ของสเปกและไม่ต้องมีแถวของตัวเองใน `docs/test-id-scheme.md`)
**Spec ที่ครอบส่วนที่เหลือ:** `tests/001-login.spec.ts`
**Total test cases:** 30

> หมายเหตุสำคัญสำหรับผู้รีวิว:
>
> **ช่วงเลขที่เลือก** — `LOGIN` ลงทะเบียน section `01` และ `10–19` ไว้แล้ว ไฟล์นี้จึงใช้เฉพาะ section ที่ลงทะเบียนแล้ว **ไม่ต้องแก้ `docs/test-id-scheme.md`**: `TC-LOGIN-0101xx` (UI / ฟอร์ม / validation / i18n / a11y / ลิงก์ออกจากหน้า login — สเปกใช้ `010001–010044` ไปแล้ว) และ `TC-LOGIN-1001xx` (security / auth-guard / authorization — สเปกใช้ `100001–100010` ไปแล้ว) ยืนยันว่าเลขว่างจริงด้วย `grep -rhoE 'TC-LOGIN-[0-9]{6}' tests/ docs/ | sort -u` — ไม่มี `0101xx` และ `1001xx` ปรากฏที่ใดเลย
>
> **สเปกครอบอะไรไปแล้ว (ห้ามเขียนซ้ำ)** — ดูย่อหน้าหัวไฟล์ ประเด็นที่ต้องระวังเป็นพิเศษคือ สเปกครอบ "รูปแบบอีเมลผิด" (`TC-LOGIN-010017`), "ไม่กรอกรหัสผ่าน/อีเมล/ทั้งสองช่อง" (`010014–010016`) และ "credentials ผิด" (`010018/010019`) ไว้แล้ว **แต่ทุกเคสยืนยันแค่ว่า URL ยังเป็น `/login`** (หรือ "มี `p.text-destructive` สักตัว") ไม่เคยยืนยัน *ข้อความ* ที่แสดง เคสในไฟล์นี้ที่อยู่กลุ่ม validation จึงตั้งใจยืนยัน **ข้อความจริงตาม `messages/en.json`** และยืนยัน **ว่าไม่มี request ออกจากเบราว์เซอร์** ซึ่งเป็นสองสิ่งที่สเปกเดิมไม่แตะเลย
>
> **ข้อเท็จจริงจาก source ที่คนแปลงเป็นสเปกต้องรู้**
> 1. **ฟอร์มปิด HTML5 validation ทิ้ง** — `<form ... noValidate>` (`routes/login/login-form.tsx:145`) ตัวที่บล็อก submit จริงคือ zod ผ่าน `zodResolver` (`login-form.tsx:54-72`) คำอธิบายใน `TC-LOGIN-010017` ที่เขียนว่า "HTML5/Zod validation" จึงคลาดเคลื่อนครึ่งหนึ่ง — เป็น zod ล้วน
> 2. **มีกฎ validation ที่สเปกไม่เคยแตะเลย: รหัสผ่านต้องยาว ≥ 6 ตัว** — `PASSWORD_MIN = 6` (`login-form.tsx:22`) และ schema `.min(PASSWORD_MIN, …)` (`login-form.tsx:62-65`) ⇒ รหัสสั้นกว่า 6 ตัวไม่มีวันถูกส่งไป backend เลย `mode: "onTouched"` (`login-form.tsx:71`) แปลว่า error โผล่หลังออกจากช่อง (blur) หรือหลังกด submit ไม่ใช่ระหว่างพิมพ์ครั้งแรก
> 3. **ข้อความ error ทุกชิ้นมาจาก `messages/<locale>.json` namespace `auth`** — `validation.emailRequired` = "Email is required", `validation.emailInvalid` = "Please enter a valid email address", `validation.passwordMinChars` = "Password must be at least 6 characters", `errors.invalidCredentials` = "Email or password is incorrect", `errors.tooManyAttempts` = "Too many login attempts. Try again in {seconds}s.", `errors.networkUnavailable` = "Could not reach the server. Check your connection and try again."
> 4. **🐞 สเปกกับ source ไม่ตรงกันสองจุดใน `tests/pages/login.page.ts`** (ข้อเท็จจริง ไม่ใช่เคส — ต้องแก้ page object ไม่ใช่เขียนเคสใหม่)
>    - `rateLimitMessage()` หา `"Too many requests"` แต่ UI ไม่เคยเรนเดอร์สตริงนี้ — ข้อความจริงคือ `errors.tooManyAttempts` / `errors.tooManyAttemptsFallback` ("Too many login attempts. …", `login-form.tsx:86-93, 192-196`)
>    - `serverUnavailableMessage()` หา `/auth server unavailable|server.*unavailable/i` แต่สตริง `"Auth server unavailable"` ถูกใช้เป็น `message` ภายในของ `ApiError` เท่านั้น (`lib/auth/auth-api.ts:30-36`) และถูก **แทนที่** ด้วยข้อความที่แปลแล้วก่อนถึงจอเสมอ (`login-form.tsx:95-97`) ⇒ สิ่งที่ผู้ใช้เห็นคือ "Could not reach the server. Check your connection and try again." ซึ่งไม่แมตช์ regex นี้
>    - ผลรวม: ตัวตรวจ "ล้มเหลวชั่วคราว" ทั้งสองตัวใน `loginWithRetry()` (`login.page.ts:48-54`) ไม่เคยเป็นจริง ⇒ **logic retry ของ helper เป็น dead code** และ `TC-LOGIN-010040` ที่ assert `serverUnavailableMessage()` ตรง ๆ จะไม่ผ่านกับ frontend ชุดนี้ · แก้ที่ page object ก่อน แล้วเคสเดิมจะกลับมาใช้ได้ทันที
> 5. **`?next=` ไม่เคยถูกใส่ให้อัตโนมัติเวลาโดนเด้ง** — `RequireAuth` ส่งปลายทางเดิมไปเป็น **router state** (`state={{ from: location.pathname }}`, `components/auth/require-auth.tsx:19`) แต่ `LoginForm` อ่านเฉพาะ query string (`searchParams.get("next")`, `login-form.tsx:104`) ⇒ deep link ไปหน้าที่ต้องล็อกอินแล้วโดนเด้ง เมื่อ login เสร็จจะไป `/dashboard` **ไม่ใช่หน้าเดิม** · จุดเดียวในแอปที่ผลิต `?next=` คือหน้ารับคำเชิญ (`routes/invitation/invitation.route.tsx:282`) — ไฟล์นี้จึง **ไม่มี**เคส "เด้งไป login แล้วกลับมาที่เดิม" เพราะแอปไม่ได้ออกแบบให้ทำแบบนั้น (ถ้าต้องการพฤติกรรมนั้น ให้เปิดเป็นคำถามเชิงผลิตภัณฑ์ ไม่ใช่เคสเทส)
> 6. **`resolveNextPath` ปฏิเสธสามแบบ** (`lib/auth/resolve-next-path.ts:1-7`): ค่าว่าง/ไม่มี, ไม่ขึ้นต้นด้วย `/`, และขึ้นต้นด้วย `//` หรือ `/\` — ทุกกรณีคืน `/dashboard` · ฟังก์ชันเดียวกันนี้ถูกใช้ **ทั้งสองทาง**: หลัง login สำเร็จ (`login-form.tsx:104`) และตอน `RedirectIfAuthed` เด้ง user ที่มี token อยู่แล้ว (`components/auth/redirect-if-authed.tsx:20`) สเปกครอบเฉพาะทางแรกและเฉพาะรูปแบบ `//` เท่านั้น
> 7. **`RedirectIfAuthed` ครอบ 3 หน้า ไม่ใช่แค่ `/login`** — `/login` (`routes/login/login.route.tsx:10`), `/register` (`routes/register/register.route.tsx:19`) และ `/forgot-password` (`routes/forgot-password/forgot-password.route.tsx:21`) สเปกครอบแค่ `/login`
> 8. **โมเดล token: access token อยู่ใน memory เท่านั้น** (`lib/auth/token-store.ts:8` — ตัวแปรโมดูล ไม่แตะ storage) ส่วน refresh token อยู่ใน `localStorage` คีย์ `carmen.refresh_token` (`lib/auth/refresh-token-storage.ts:6`) · ทุกครั้งที่บูต `main.tsx:45-46` เรียก `refreshTokens()` **ก่อน** render ⇒ reload หรือ **เปิดแท็บใหม่** จะ authenticate ตัวเองใหม่จาก refresh token โดยไม่ผ่านฟอร์ม
> 9. **Session หมดอายุกลางทางเด้งเองอัตโนมัติ** — API ตอบ 401 → `http-client` ลอง `refreshTokens()` หนึ่งรอบ ถ้ายังไม่ผ่านจะ `tokenStore.clear()` (`lib/http-client.ts:186-222`) → `RequireAuth` subscribe อยู่ด้วย `useSyncExternalStore` จึง `<Navigate to="/login">` ทันทีโดยไม่ต้องรอ user กดอะไร (`components/auth/require-auth.tsx:15-20`)
> 10. **บูตล้ม = หน้าแทนที่ทั้งหน้าด้วยข้อความเดียว** — ถ้า `/config.json` โหลดไม่ได้ (`lib/runtime-config.ts:51-53`) boot จะ catch แล้วเขียน `innerHTML` ของ `#root` เป็น "Failed to load application configuration. Please try again or contact support." (`main.tsx:87-88`) — ไม่มี React ขึ้นเลย
> 11. **หน้า `/login` ไม่มีปุ่มสลับภาษา** — ภาษาถูกอ่านจาก `localStorage["carmen.locale"]` ตอน mount และ fallback เป็น `en` (`components/i18n-provider.tsx:16-32`, `i18n/config.ts:3`) พร้อมตั้ง `document.documentElement.lang` (`i18n-provider.tsx:61`) · ปุ่ม EN/ไทย มีเฉพาะบนหน้าเอกสารกฎหมาย (`routes/legal/legal-page.tsx:120-145`)
> 12. **ลิงก์ออกจากหน้า login มี 4 เส้น** — "Forgot password?" → `/forgot-password` (`login-form.tsx:179-188`), "Create account" → `/register` (`login-form.tsx:221-226`), และบรรทัดข้อตกลงที่มีลิงก์ `/terms` กับ `/privacy` (`login-form.tsx:229-248`) ทั้ง 4 ปลายทางเป็น public route จริงใน `routes/router.tsx:20-39`
> 13. **ปุ่มตา (show/hide password) ถูกถอดออกจากลำดับ Tab โดยตั้งใจ** — `tabIndex={-1}` (`components/auth/floating-field.tsx:154`) ⇒ กด Tab จากช่องรหัสผ่านต้องไปโผล่ที่ลิงก์ "Forgot password?" ไม่ใช่ปุ่มตา
> 14. **ป้ายกำกับเป็น floating label** — ลอยขึ้นเมื่อ focus หรือมีค่า (`floating-field.tsx:48-66`) และเปลี่ยนเป็นสี destructive เมื่อ field มี error (`floating-field.tsx:42-46`) · ช่อง input ได้ `aria-invalid` (`floating-field.tsx:95, 140`) และข้อความ error เป็น `<p role="alert">` (`floating-field.tsx:181`) ส่วน error ระดับฟอร์มเป็น `<div role="alert" aria-live="polite">` (`floating-field.tsx:187-201`)
> 15. **ล็อกอินพลาดแล้วช่องรหัสผ่านถูกล้างทิ้งเสมอ** — `form.setValue("password", "")` ใน `onError` (`login-form.tsx:134-135`) ส่วนช่องอีเมลไม่ถูกแตะ
> 16. **หน้า `/login` มีแบนเนอร์เขียวสองแบบที่เข้าถึงจาก URL ตรง ๆ ไม่ได้** — `justRegistered` และ `passwordReset` อ่านจาก **router state** (`login-form.tsx:41-50`) ที่ตั้งโดย `/register/verify` และ `/reset-password` เท่านั้น ⇒ ทดสอบได้ก็ต่อเมื่อเดินทั้งเส้นทางอีเมลจริง ไฟล์นี้จึงไม่มีเคสของสองแบนเนอร์นี้
> 17. **ผู้ใช้ที่ยังไม่ถูกผูกกับหน่วยธุรกิจไม่ได้เจอ dialog** — `ProfileGate` เรนเดอร์แผงเต็มหน้า `NoBusinessUnit` เมื่อ `data.business_unit.length === 0` (`components/share/profile-gate.tsx:46-48, 75-128`) ข้อความคือ eyebrow "Access pending" / หัวข้อ "Your account is not linked to a property yet" พร้อมปุ่ม "Check again" และ "Sign out" ⇒ **ความคาดหวังของ `TC-LOGIN-100001` (dialog ข้อความ "No department assigned") ไม่ตรงกับ source** และ `tt@blueledgers.com` ก็ไม่อยู่ใน `tests/test-users.ts` แล้ว · `TC-LOGIN-010122` ในไฟล์นี้เขียนตามออกแบบจริงและควรถือเป็นตัวแทนเมื่อสะสาง `100001` ทิ้ง
> 18. **ออกจากระบบมีขั้นยืนยัน** — เมนูผู้ใช้เปิด `AlertDialog` หัวข้อ "Log out of your account?" คำอธิบาย "Your session will end. You'll need to sign in again to continue." ปุ่ม Cancel / Log out (`components/navbar/user-profile.tsx:277-329`) · เส้นทางกด Cancel ยังไม่มีใครทดสอบ
> 19. **`admin@blueledgers.com` ไม่ถูกครอบโดย `001-login.spec.ts`** — ลูป login/logout ข้าม role ที่ไม่มีใน `LOGIN_TC` / `LOGOUT_TC` (`tests/001-login.spec.ts:57, 683`) และ `Admin` ไม่อยู่ในสองตารางนั้น · บัญชีนี้ล็อกอินผ่าน UI จริงอยู่แล้วทุกรอบใน `tests/auth.setup.ts` จึงบันทึกไว้เป็นข้อเท็จจริง **ไม่เขียนเป็นเคสซ้ำ**
>
> **Role / ข้อมูลที่ต้องเตรียม**
> - **Default role ของไฟล์นี้คือ Requestor (`requestor@blueledgers.com` / `12345678`)** — บัญชีเดียวกับที่สเปกเดิมใช้เป็นตัวแทนในเคสที่ไม่ผูกกับบทบาท (ทุกบัญชีที่อ้างถึงมีอยู่จริงใน `tests/test-users.ts`)
> - **เคสที่ไม่ต้องล็อกอินเลย (เปิด `/login` แล้วดูอย่างเดียว)**: `010101`, `010102`, `010103`, `010104`, `010105`, `010106`, `010107`, `010108`, `010109`, `010113`, `010114`, `010115`, `010116`, `010117`, `010118`, `010120`, `100101`, `100102`, `100105`
> - **เคสที่ต้องล็อกอินจริง**: `010110`, `010111`, `010112`, `010119`, `010121`, `100103`, `100104`, `100106`, `100107`, `100108`
> - **⚠️ เคสที่ยิง login ผิดจริงต้องใช้อีเมลที่ไม่มีอยู่จริงและ unique ต่อรอบรัน** (`` `gap-${Date.now()}@nonexistent.com` `` แบบเดียวกับ `TC-LOGIN-100007`) — backend ตอบ 429 หลังผิด 3 ครั้งด้วยอีเมลเดียวกัน การใช้ `requestor@` ยิงรหัสผิดซ้ำจะทำให้บัญชีนั้นติด rate-limit แล้วพังเคสอื่นทั้งไฟล์ · หมายเหตุ: repo นี้ส่ง `x-rate-limit-bypass: true` ผ่าน `playwright.config.ts` อยู่แล้ว แต่อย่าพึ่งมันเป็นข้ออ้างให้ยิงผิดใส่บัญชีจริง
> - **เคสที่ต้องมีบัญชีที่ยังไม่ถูกผูกกับ business unit ใด ๆ (`business_unit: []`)**: `010122` — เดิมคือ `tt@blueledgers.com` ซึ่งถูกถอดออกจาก `tests/test-users.ts` แล้ว **ต้องยืนยันกับทีม backend ว่ามีบัญชีไหนอยู่ในสถานะนี้ก่อนเขียนเคส** ถ้าไม่มีให้ `test.skip` พร้อมเหตุผล
>
> **🚫 Blocker / เคสที่ย้อนกลับไม่ได้**
> - **ไม่มีเคสใดในไฟล์นี้เปลี่ยนข้อมูลถาวรฝั่ง backend** — ทุกเคสเป็นการอ่าน/นำทาง/ตรวจข้อความ รันซ้ำได้ไม่จำกัด
> - สิ่งเดียวที่ "สกปรก" ได้คือ **rate-limit counter รายอีเมล** (ดูย่อหน้าก่อนหน้า) กับ `localStorage` ของ browser context (`carmen.refresh_token`, `carmen.locale`) ซึ่ง Playwright ล้างให้เองเมื่อปิด context — `010117` ที่เขียน `carmen.locale` ต้องอยู่ใน context ของตัวเองหรือคืนค่าท้ายเทส ไม่งั้นเคสถัดไปจะเจอ UI ภาษาไทยแล้วหา "Sign In" ไม่เจอ
>
> เมื่อเคสใดถูกเขียนเป็นสเปกแล้วให้ลบออกจากไฟล์นี้ และเมื่อหมดทุกเคสให้ลบไฟล์ทิ้ง

## Test Cases at a Glance

| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-LOGIN-010101 | หัวเรื่อง คำบรรยาย และท้ายหน้าของหน้าเข้าสู่ระบบ | Low | Functional |
| TC-LOGIN-010102 | แผงโฆษณาด้านขวาแสดงบนจอกว้างและถูกซ่อนบนจอแคบ | Low | Functional |
| TC-LOGIN-010103 | ป้ายกำกับลอยขึ้นเมื่อโฟกัสหรือมีค่าในช่อง | Low | Functional |
| TC-LOGIN-010104 | ช่องกรอกประกาศ autocomplete ให้ตัวจัดการรหัสผ่านเติมค่าได้ | Low | Functional |
| TC-LOGIN-010105 | ออกจากช่องอีเมลโดยไม่กรอก แสดงข้อความ "Email is required" ใต้ช่อง | Medium | Validation |
| TC-LOGIN-010106 | อีเมลผิดรูปแบบแสดงข้อความ "Please enter a valid email address" | Medium | Validation |
| TC-LOGIN-010107 | รหัสผ่านสั้นกว่า 6 ตัวถูกบล็อกที่เบราว์เซอร์ ไม่ยิงไปเซิร์ฟเวอร์ | High | Validation |
| TC-LOGIN-010108 | กดเข้าสู่ระบบด้วยฟอร์มว่าง แสดง error ทั้งสองช่องพร้อมกันและไม่ยิง request | Medium | Validation |
| TC-LOGIN-010109 | แก้ค่าที่ผิดแล้วข้อความ error หายไป | Low | Validation |
| TC-LOGIN-010110 | ล็อกอินไม่ผ่านแล้วช่องรหัสผ่านถูกล้าง แต่อีเมลยังอยู่ | Medium | Functional |
| TC-LOGIN-010111 | ระหว่างกำลังเข้าสู่ระบบ ปุ่มเปลี่ยนเป็น "Signing in..." พร้อมตัวหมุน | Medium | Functional |
| TC-LOGIN-010112 | ข้อความเมื่อรหัสผ่านผิดคือ "Email or password is incorrect" ในกล่อง role=alert | Medium | Validation |
| TC-LOGIN-010113 | ปุ่มแสดงรหัสผ่านอยู่นอกลำดับ Tab | Low | Functional |
| TC-LOGIN-010114 | ลิงก์ "Forgot password?" พาไปหน้าขอตั้งรหัสผ่านใหม่ | Medium | Functional |
| TC-LOGIN-010115 | ลิงก์ "Create account" พาไปหน้าสมัครใช้งาน | Medium | Functional |
| TC-LOGIN-010116 | ลิงก์ข้อตกลงและนโยบายความเป็นส่วนตัวเปิดเอกสารได้และกลับมาหน้าเข้าสู่ระบบได้ | Low | Functional |
| TC-LOGIN-010117 | ตั้งภาษาเป็นไทยแล้วหน้าเข้าสู่ระบบแสดงข้อความไทยทั้งหน้า | Medium | Functional |
| TC-LOGIN-010118 | หน้าเอกสารกฎหมายเปิดได้โดยไม่ต้องล็อกอินและมีปุ่มสลับภาษาในตัว | Low | Functional |
| TC-LOGIN-010119 | เปิดแท็บที่สองแล้วเข้าใช้งานได้ทันทีโดยไม่ต้องล็อกอินซ้ำ | High | Functional |
| TC-LOGIN-010120 | โหลดค่าตั้งต้นของระบบไม่สำเร็จ แสดงข้อความแจ้งแทนหน้าจอว่าง | Medium | Edge Case |
| TC-LOGIN-010121 | กด Cancel ในกล่องยืนยันออกจากระบบแล้วยังอยู่ในระบบเหมือนเดิม | Medium | Alternate Flow |
| TC-LOGIN-010122 | บัญชีที่ยังไม่ถูกผูกกับสาขาเห็นแผง "Access pending" หลังเข้าสู่ระบบ | High | Functional |
| TC-LOGIN-100101 | next ที่เป็น URL เต็มถูกปฏิเสธ กลับไป /dashboard | High | Security |
| TC-LOGIN-100102 | next ที่ขึ้นต้นด้วยแบ็กสแลชถูกปฏิเสธ กลับไป /dashboard | Medium | Security |
| TC-LOGIN-100103 | ผู้ที่ล็อกอินแล้วเปิด /login?next=/profile ถูกพาไปปลายทางทันทีโดยไม่เห็นฟอร์ม | Medium | Auth-guard |
| TC-LOGIN-100104 | ผู้ที่ล็อกอินแล้วเปิด /register หรือ /forgot-password ถูกเด้งกลับ /dashboard | Medium | Auth-guard |
| TC-LOGIN-100105 | Deep link ไปหน้าโมดูลที่ต้องล็อกอินขณะยังไม่ล็อกอิน ถูกเด้งไป /login | High | Auth-guard |
| TC-LOGIN-100106 | Session หมดอายุกลางทางแล้วถูกเด้งกลับหน้าเข้าสู่ระบบอัตโนมัติ | High | Security |
| TC-LOGIN-100107 | Access token ไม่ถูกเก็บลง storage ของเบราว์เซอร์ | High | Security |
| TC-LOGIN-100108 | ผู้ที่ล็อกอินแล้วเปิด /login พร้อม next ภายนอก ต้องไม่หลุดออกนอกเว็บ | High | Security |

---

## TC-LOGIN-010101 — หัวเรื่อง คำบรรยาย และท้ายหน้าของหน้าเข้าสู่ระบบ
**Priority:** Low · **Test Type:** Functional
**Preconditions**
Browser ไม่มี session (logged out); ภาษาเป็นค่าเริ่มต้น `en`
**Steps**
1. เปิด `/login`
2. อ่านหัวเรื่องระดับหนึ่ง บรรทัดคำบรรยายใต้หัวเรื่อง และข้อความท้ายหน้า
**Expected**
หัวเรื่อง (heading ระดับ 1) อ่านว่า "Welcome back" · ใต้หัวเรื่องมีบรรทัด "Sign in to your hotel inventory workspace." · ท้ายหน้ามีข้อความ "CARMEN BLUE · Hotel ERP Platform" · ปุ่มส่งฟอร์มมีชื่อว่า "Sign In"

---

## TC-LOGIN-010102 — แผงโฆษณาด้านขวาแสดงบนจอกว้างและถูกซ่อนบนจอแคบ
**Priority:** Low · **Test Type:** Functional
**Preconditions**
Browser logged out; อยู่ที่ `/login`
**Steps**
1. ตั้งขนาด viewport เป็น 1440×900 แล้วเปิด `/login`
2. ตรวจว่าเห็นพาดหัวของแผงขวา "Hospitality inventory" และการ์ดคุณสมบัติสี่ใบ (Live stock / Role-aware / Multi-property / Hospitality-first)
3. เปลี่ยน viewport เป็น 390×844 (จอมือถือ) แล้วดูหน้าเดิม
**Expected**
บนจอกว้าง: เห็นพาดหัวแผงขวาและการ์ดครบสี่ใบ · บนจอมือถือ: แผงขวาถูกซ่อนทั้งหมด (พาดหัวและการ์ดไม่ปรากฏ) แต่โลโก้ Carmen Blue ของฝั่งฟอร์มยังเห็นอยู่ และฟอร์มยังใช้งานได้เต็มรูปแบบโดยไม่มี horizontal scroll

---

## TC-LOGIN-010103 — ป้ายกำกับลอยขึ้นเมื่อโฟกัสหรือมีค่าในช่อง
**Priority:** Low · **Test Type:** Functional
**Preconditions**
Browser logged out; อยู่ที่ `/login`; ทั้งสองช่องว่าง
**Steps**
1. เปิด `/login` แล้วอ่านตำแหน่ง/ขนาดของป้าย "Email address" ขณะยังไม่โฟกัส
2. คลิกเข้าไปในช่องอีเมล แล้วอ่านป้ายอีกครั้ง
3. พิมพ์อีเมล แล้วคลิกออกจากช่อง (blur)
**Expected**
ป้าย "Email address" ผูกกับ input ด้วย `for="email"` และอ่านได้ตลอดทั้งสามสถานะ · เมื่อโฟกัสป้ายลอยขึ้นไปอยู่ส่วนบนของช่อง (ขนาดเล็กลง ตัวพิมพ์ใหญ่) · เมื่อ blur ทั้งที่ยังมีค่าอยู่ในช่อง ป้ายยังคงลอยอยู่ด้านบน ไม่กลับลงมาทับข้อความที่พิมพ์

---

## TC-LOGIN-010104 — ช่องกรอกประกาศ autocomplete ให้ตัวจัดการรหัสผ่านเติมค่าได้
**Priority:** Low · **Test Type:** Functional
**Preconditions**
Browser logged out; อยู่ที่ `/login`
**Steps**
1. เปิด `/login`
2. อ่าน attribute ของ input `#email` และ `#password`
**Expected**
`#email` มี `type="email"` และ `autocomplete="email"` · `#password` มี `autocomplete="current-password"` (ค่าที่ password manager ใช้แยก "เข้าสู่ระบบ" ออกจาก "ตั้งรหัสใหม่")

---

## TC-LOGIN-010105 — ออกจากช่องอีเมลโดยไม่กรอก แสดงข้อความ "Email is required" ใต้ช่อง
**Priority:** Medium · **Test Type:** Validation
**Preconditions**
Browser logged out; อยู่ที่ `/login`
**Steps**
1. เปิด `/login`
2. คลิกเข้าไปในช่องอีเมลโดยไม่พิมพ์อะไร
3. คลิกออกไปที่ช่องรหัสผ่าน (blur ช่องอีเมล) โดยยังไม่กด Sign In
**Expected**
ใต้ช่องอีเมลปรากฏข้อความ "Email is required" ในองค์ประกอบที่มี `role="alert"` · input `#email` มี `aria-invalid="true"` · ยังไม่มี request ไปที่ `**/api/auth/login` เลย และยังอยู่ที่ `/login`

---

## TC-LOGIN-010106 — อีเมลผิดรูปแบบแสดงข้อความ "Please enter a valid email address"
**Priority:** Medium · **Test Type:** Validation
**Preconditions**
Browser logged out; อยู่ที่ `/login`
**Steps**
1. เปิด `/login`
2. กรอกช่องอีเมลเป็น `not-an-email` แล้ว blur
3. กรอกรหัสผ่านที่ยาวพอ (เช่น `12345678`) แล้วกด Sign In
**Expected**
ใต้ช่องอีเมลแสดง "Please enter a valid email address" (ไม่ใช่ "Email is required") · ฟอร์มไม่ถูกส่ง ไม่มี POST ไปที่ `**/api/auth/login` และยังอยู่ที่ `/login` — ฟอร์มตั้ง `noValidate` ไว้ ตัวที่บล็อกคือ zod ไม่ใช่ browser bubble ของ HTML5

---

## TC-LOGIN-010107 — รหัสผ่านสั้นกว่า 6 ตัวถูกบล็อกที่เบราว์เซอร์ ไม่ยิงไปเซิร์ฟเวอร์
**Priority:** High · **Test Type:** Validation
**Preconditions**
Browser logged out; อยู่ที่ `/login`
**Steps**
1. ดักทุก request ที่ยิงไป `**/api/auth/login` ไว้นับจำนวน
2. เปิด `/login` แล้วกรอกอีเมลที่ถูกรูปแบบ (`requestor@blueledgers.com`) และรหัสผ่าน `12345` (5 ตัวอักษร)
3. กด Sign In
**Expected**
ใต้ช่องรหัสผ่านแสดง "Password must be at least 6 characters" · จำนวน request ที่ยิงไป `**/api/auth/login` เท่ากับ 0 (รหัสสั้นไม่เคยหลุดออกจากเบราว์เซอร์) · ยังอยู่ที่ `/login`

---

## TC-LOGIN-010108 — กดเข้าสู่ระบบด้วยฟอร์มว่าง แสดง error ทั้งสองช่องพร้อมกันและไม่ยิง request
**Priority:** Medium · **Test Type:** Validation
**Preconditions**
Browser logged out; อยู่ที่ `/login`; ทั้งสองช่องว่าง
**Steps**
1. ดักทุก request ที่ยิงไป `**/api/auth/login` ไว้นับจำนวน
2. เปิด `/login` แล้วกด Sign In ทันทีโดยไม่กรอกอะไร
**Expected**
แสดงข้อความ error สองชิ้นพร้อมกัน: "Email is required" ใต้ช่องอีเมล และ "Password is required" ใต้ช่องรหัสผ่าน · input ทั้งสองช่องมี `aria-invalid="true"` · จำนวน request ที่ยิงไป `**/api/auth/login` เท่ากับ 0 · ยังอยู่ที่ `/login` (สเปกเดิม `TC-LOGIN-010016` ยืนยันแค่ URL เท่านั้น)

---

## TC-LOGIN-010109 — แก้ค่าที่ผิดแล้วข้อความ error หายไป
**Priority:** Low · **Test Type:** Validation
**Preconditions**
Browser logged out; อยู่ที่ `/login`
**Steps**
1. เปิด `/login` กรอกอีเมลเป็น `not-an-email` แล้ว blur จนเห็นข้อความ error
2. ลบค่าเดิมแล้วพิมพ์ `requestor@blueledgers.com`
3. blur ออกจากช่องอีเมลอีกครั้ง
**Expected**
ข้อความ "Please enter a valid email address" หายไปจากใต้ช่องอีเมล และ `aria-invalid` ของ `#email` กลับเป็น `false` (หรือไม่มี attribute) · ป้ายกำกับกลับจากสี destructive เป็นสีปกติ · ยังไม่มี request ไปที่ `**/api/auth/login`

---

## TC-LOGIN-010110 — ล็อกอินไม่ผ่านแล้วช่องรหัสผ่านถูกล้าง แต่อีเมลยังอยู่
**Priority:** Medium · **Test Type:** Functional
**Preconditions**
Browser logged out; เตรียมอีเมลที่ไม่มีอยู่จริงและ unique ต่อรอบรัน (`` `gap-${Date.now()}@nonexistent.com` ``) เพื่อไม่ให้บัญชีจริงติด rate-limit
**Steps**
1. เปิด `/login` กรอกอีเมล unique ข้างต้นและรหัสผ่าน `wrong-password-xyz`
2. กด Sign In แล้วรอจนกล่องข้อความผิดพลาดปรากฏ
3. อ่านค่าปัจจุบันของ `#email` และ `#password`
**Expected**
`#password` มีค่าเป็นสตริงว่าง (ระบบล้างรหัสผ่านทิ้งหลังล็อกอินไม่ผ่าน) · `#email` ยังคงเป็นอีเมลที่กรอกไว้ ไม่ถูกล้าง · ยังอยู่ที่ `/login`

---

## TC-LOGIN-010111 — ระหว่างกำลังเข้าสู่ระบบ ปุ่มเปลี่ยนเป็น "Signing in..." พร้อมตัวหมุน
**Priority:** Medium · **Test Type:** Functional
**Preconditions**
Browser logged out; `requestor@blueledgers.com` ใช้งานได้; หน่วงคำตอบของ `**/api/auth/login` ด้วย route interception ประมาณ 3 วินาทีเพื่อให้สถานะ pending สังเกตได้แน่นอน (ไม่ใช่ best-effort แบบ `TC-LOGIN-010039`)
**Steps**
1. ติดตั้ง route ที่หน่วง `**/api/auth/login` ไว้ ~3 วินาทีแล้วค่อยปล่อยไปหา backend จริง
2. เปิด `/login` กรอก credentials ที่ถูกต้อง แล้วกด Sign In
3. อ่านชื่อและสถานะของปุ่มระหว่างที่ request ยังค้างอยู่
**Expected**
ระหว่าง request ค้าง ปุ่มอ่านว่า "Signing in..." (ไม่ใช่ "Sign In") มีตัวหมุนอยู่ในปุ่ม และปุ่มอยู่ในสถานะ disabled · เมื่อ request จบ ระบบพาไป `/dashboard`

---

## TC-LOGIN-010112 — ข้อความเมื่อรหัสผ่านผิดคือ "Email or password is incorrect" ในกล่อง role=alert
**Priority:** Medium · **Test Type:** Validation
**Preconditions**
Browser logged out; เตรียมอีเมลที่ไม่มีอยู่จริงและ unique ต่อรอบรัน (backend ตอบ 401 เหมือนกันทั้งกรณีอีเมลไม่มีจริงและรหัสผิด — ดู `TC-LOGIN-100006`)
**Steps**
1. เปิด `/login` กรอกอีเมล unique ข้างต้นและรหัสผ่าน `wrong-password-xyz`
2. กด Sign In
3. อ่านข้อความในกล่องแจ้งเตือนเหนือปุ่ม
**Expected**
กล่องแจ้งเตือนเหนือปุ่มมี `role="alert"` และ `aria-live="polite"` และข้อความ **ตรงตัว** ว่า "Email or password is incorrect" — ไม่ใช่ข้อความดิบจาก backend และไม่บอกใบ้ว่าอีเมลนั้นมีบัญชีอยู่จริงหรือไม่ · ยังอยู่ที่ `/login`

---

## TC-LOGIN-010113 — ปุ่มแสดงรหัสผ่านอยู่นอกลำดับ Tab
**Priority:** Low · **Test Type:** Functional
**Preconditions**
Browser logged out; อยู่ที่ `/login`
**Steps**
1. เปิด `/login` แล้วคลิกเข้าไปในช่องรหัสผ่าน
2. กด Tab หนึ่งครั้ง
3. อ่านว่าโฟกัสไปอยู่ที่องค์ประกอบใด
**Expected**
โฟกัสข้ามปุ่มตา (Show password) ไปอยู่ที่ลิงก์ "Forgot password?" โดยตรง · ปุ่มตายังใช้งานได้ด้วยเมาส์และมี `aria-label` ว่า "Show password" / "Hide password" ตามสถานะ (พฤติกรรมตั้งใจ: ปุ่มถูกถอดออกจากลำดับ Tab เพื่อให้คีย์บอร์ดเดินจากรหัสผ่านไปยังทางออกที่คนพิมพ์รหัสผิดต้องการ)

---

## TC-LOGIN-010114 — ลิงก์ "Forgot password?" พาไปหน้าขอตั้งรหัสผ่านใหม่
**Priority:** Medium · **Test Type:** Functional
**Preconditions**
Browser logged out; อยู่ที่ `/login`
**Steps**
1. เปิด `/login` แล้วกดลิงก์ "Forgot password?"
2. อ่านหัวเรื่องของหน้าใหม่
3. กดลิงก์ "Sign In" ที่ท้ายฟอร์มเพื่อกลับ
**Expected**
URL เปลี่ยนเป็น `/forgot-password` หัวเรื่องอ่านว่า "Forgot your password?" และมีช่องอีเมลกับปุ่ม "Send reset link" · กดลิงก์กลับแล้ว URL กลับมาเป็น `/login` และเห็นฟอร์มเข้าสู่ระบบอีกครั้ง

---

## TC-LOGIN-010115 — ลิงก์ "Create account" พาไปหน้าสมัครใช้งาน
**Priority:** Medium · **Test Type:** Functional
**Preconditions**
Browser logged out; อยู่ที่ `/login`
**Steps**
1. เปิด `/login` แล้วอ่านบรรทัดท้ายฟอร์ม
2. กดลิงก์ "Create account"
3. อ่านหัวเรื่องของหน้าใหม่
**Expected**
บรรทัดท้ายฟอร์มอ่านว่า "New here? Create account" · หลังกด URL เป็น `/register` และหัวเรื่องอ่านว่า "Create your account" พร้อมช่องอีเมลขั้นที่หนึ่ง (ยังไม่มีการสร้างบัญชีที่ขั้นนี้)

---

## TC-LOGIN-010116 — ลิงก์ข้อตกลงและนโยบายความเป็นส่วนตัวเปิดเอกสารได้และกลับมาหน้าเข้าสู่ระบบได้
**Priority:** Low · **Test Type:** Functional
**Preconditions**
Browser logged out; อยู่ที่ `/login`
**Steps**
1. เปิด `/login` แล้วอ่านบรรทัดข้อตกลงใต้ลิงก์สมัคร
2. กดลิงก์ "terms" แล้วตรวจ URL และหัวเรื่องของหน้าเอกสาร
3. กดลิงก์กลับ (โลโก้ Carmen Blue หรือ CARMEN BLUE มุมขวาบน) เพื่อกลับหน้าเข้าสู่ระบบ
4. ทำซ้ำข้อ 2–3 กับลิงก์ "privacy policy"
**Expected**
บรรทัดอ่านว่า "By signing in you agree to our terms and privacy policy." โดย "terms" และ "privacy policy" เป็นลิงก์จริง · กด terms → URL `/terms` และแสดงเอกสารพร้อมสารบัญ · กด privacy policy → URL `/privacy` · ทั้งสองหน้ามีทางกลับที่พา URL กลับมาเป็น `/login`

---

## TC-LOGIN-010117 — ตั้งภาษาเป็นไทยแล้วหน้าเข้าสู่ระบบแสดงข้อความไทยทั้งหน้า
**Priority:** Medium · **Test Type:** Functional
**Preconditions**
Browser logged out; ใช้ browser context เฉพาะของเคสนี้ (หรือคืนค่า `carmen.locale` ท้ายเทส) เพราะค่านี้ค้างข้ามเทสและจะทำให้เคสอื่นหาปุ่ม "Sign In" ไม่เจอ
**Steps**
1. เปิด `/login` หนึ่งครั้งเพื่อให้ได้ origin แล้วเขียน `localStorage["carmen.locale"] = "th"`
2. reload หน้า `/login`
3. อ่านหัวเรื่อง ป้ายกำกับช่อง ปุ่มส่งฟอร์ม และค่า `lang` ของ `<html>`
4. กด Sign In ด้วยฟอร์มว่างเพื่อดูข้อความ validation
**Expected**
หัวเรื่องเป็น "ยินดีต้อนรับกลับ" คำบรรยายเป็น "เข้าสู่พื้นที่ทำงานระบบสินค้าคงคลังของโรงแรมคุณ" ปุ่มอ่านว่า "เข้าสู่ระบบ" ลิงก์อ่านว่า "ลืมรหัสผ่าน?" · `document.documentElement.lang` เท่ากับ `"th"` · ข้อความ validation เป็นภาษาไทย ("กรุณากรอกอีเมล" / "กรุณากรอกรหัสผ่าน") ไม่ใช่ key ดิบและไม่ปนภาษาอังกฤษ

---

## TC-LOGIN-010118 — หน้าเอกสารกฎหมายเปิดได้โดยไม่ต้องล็อกอินและมีปุ่มสลับภาษาในตัว
**Priority:** Low · **Test Type:** Functional
**Preconditions**
Browser ไม่มี session เลย (clear cookies + localStorage) — หน้าเหล่านี้ต้องอ่านได้ก่อนตัดสินใจสมัคร
**Steps**
1. เปิด `/terms` ตรง ๆ โดยไม่ผ่าน `/login`
2. ตรวจว่าไม่ถูกเด้งไปหน้าเข้าสู่ระบบ และเห็นสารบัญกับเนื้อหา
3. กดปุ่ม "ไทย" ที่มุมขวาบน แล้วกดปุ่ม "EN" กลับ
4. กดลิงก์ท้ายเอกสารเพื่อข้ามไปอีกฉบับ
**Expected**
URL ยังเป็น `/terms` (ไม่มี auth-guard บนหน้านี้) · ปุ่มภาษาที่เลือกอยู่มี `aria-pressed="true"` และเนื้อหาสลับภาษาตามที่กด · ลิงก์ท้ายเอกสารพาไป `/privacy` และหน้านั้นมีทางกลับมา `/terms` เช่นกัน

---

## TC-LOGIN-010119 — เปิดแท็บที่สองแล้วเข้าใช้งานได้ทันทีโดยไม่ต้องล็อกอินซ้ำ
**Priority:** High · **Test Type:** Functional
**Preconditions**
ล็อกอินเป็น `requestor@blueledgers.com` สำเร็จและอยู่ที่ `/dashboard` ในแท็บแรก; แท็บที่สองต้องอยู่ใน browser context เดียวกัน (แชร์ `localStorage`)
**Steps**
1. ล็อกอินในแท็บแรกจนถึง `/dashboard`
2. เปิดแท็บใหม่ใน context เดียวกันแล้ว navigate ไป `/dashboard` โดยตรง
3. รอให้แท็บที่สองบูตเสร็จ แล้วตรวจ URL และเมนูผู้ใช้
4. กลับไปตรวจแท็บแรกว่ายังใช้งานได้ปกติ
**Expected**
แท็บที่สองอยู่ที่ `/dashboard` ไม่แวะ `/login` เลย และเห็นเมนูผู้ใช้ (avatar) — เพราะบูตของแท็บใหม่ขอ access token ใหม่จาก refresh token ที่แชร์กันใน `localStorage` ก่อน render · แท็บแรกยังอยู่ที่ `/dashboard` ใช้งานได้ตามปกติ ไม่ถูกเตะออก

---

## TC-LOGIN-010120 — โหลดค่าตั้งต้นของระบบไม่สำเร็จ แสดงข้อความแจ้งแทนหน้าจอว่าง
**Priority:** Medium · **Test Type:** Edge Case
**Preconditions**
Browser logged out; ติดตั้ง route interception ให้ `**/config.json` ล้มเหลว (abort หรือตอบ 500) **ก่อน** navigate
**Steps**
1. ติดตั้ง route ที่ทำให้ `**/config.json` ล้มเหลว
2. เปิด `/login`
3. อ่านเนื้อหาที่ปรากฏบนหน้าจอ
**Expected**
หน้าจอแสดงข้อความ "Failed to load application configuration. Please try again or contact support." แทนที่จะเป็นหน้าขาวเปล่า ๆ · ไม่มีฟอร์มเข้าสู่ระบบและไม่มี stack trace ดิบโผล่ให้ผู้ใช้เห็น

---

## TC-LOGIN-010121 — กด Cancel ในกล่องยืนยันออกจากระบบแล้วยังอยู่ในระบบเหมือนเดิม
**Priority:** Medium · **Test Type:** Alternate Flow
**Preconditions**
ล็อกอินเป็น `requestor@blueledgers.com` สำเร็จและอยู่ที่ `/dashboard`
**Steps**
1. เปิดเมนูผู้ใช้จาก avatar มุมขวาบน
2. กดรายการ "Log out"
3. อ่านหัวข้อและคำอธิบายของกล่องยืนยัน
4. กดปุ่ม "Cancel"
5. ตรวจ URL และค่า `localStorage["carmen.refresh_token"]`
**Expected**
กล่องยืนยันเป็น alertdialog หัวข้อ "Log out of your account?" คำอธิบาย "Your session will end. You'll need to sign in again to continue." มีปุ่ม Cancel และ Log out · หลังกด Cancel กล่องปิดลง ยังอยู่ที่ `/dashboard` เมนูผู้ใช้ยังใช้งานได้ และ `carmen.refresh_token` ยังอยู่ใน `localStorage` (ไม่มีการล้าง session)

---

## TC-LOGIN-010122 — บัญชีที่ยังไม่ถูกผูกกับสาขาเห็นแผง "Access pending" หลังเข้าสู่ระบบ
**Priority:** High · **Test Type:** Functional
**Preconditions**
มีบัญชีที่ active แต่ยังไม่ถูกผูกกับ business unit ใด ๆ (`business_unit` ว่าง) — ต้องยืนยันกับทีม backend ว่าบัญชีใดอยู่ในสถานะนี้ก่อนเขียนเคส ถ้าไม่มีให้ `test.skip` พร้อมเหตุผล; browser logged out
**Steps**
1. เปิด `/login` แล้วเข้าสู่ระบบด้วยบัญชีที่ยังไม่มีสาขา
2. รอจนโหลดโปรไฟล์เสร็จ (ไม่ใช่ตัวหมุน)
3. อ่านแผงที่แสดงแทนเนื้อหาแอป
4. กดปุ่ม "Sign out" บนแผงนั้น
**Expected**
เข้าสู่ระบบผ่าน (ไม่ค้างที่ `/login`) แต่แทนที่จะเห็นแดชบอร์ด ระบบแสดงแผงเต็มหน้าที่มีคำว่า "Access pending" หัวข้อ "Your account is not linked to a property yet" คำอธิบายให้ติดต่อผู้ดูแล พร้อมบรรทัด "Signed in as …" และปุ่มสองปุ่ม "Check again" / "Sign out" · กด "Sign out" แล้วกลับมาที่ `/login` และ `carmen.refresh_token` ถูกลบ (**หมายเหตุ**: นี่คือพฤติกรรมจริงตามออกแบบ ต่างจากที่ `TC-LOGIN-100001` ซึ่ง skip อยู่คาดไว้ว่าเป็น dialog ข้อความ "No department assigned" — เคสนี้ควรใช้แทน)

---

## TC-LOGIN-100101 — next ที่เป็น URL เต็มถูกปฏิเสธ กลับไป /dashboard
**Priority:** High · **Test Type:** Security
**Preconditions**
Browser logged out; `requestor@blueledgers.com` ใช้งานได้
**Steps**
1. เปิด `/login?next=https://evil.example.com/steal` แล้วจำ origin ปัจจุบันไว้
2. เข้าสู่ระบบด้วย `requestor@blueledgers.com`
3. ตรวจ origin และ path ปลายทาง
**Expected**
หลังเข้าสู่ระบบไปที่ `/dashboard` บน origin เดิม — ค่า `next` ที่ไม่ได้ขึ้นต้นด้วย `/` ถูกปฏิเสธและ fallback เป็น `/dashboard` · เบราว์เซอร์ไม่เคย navigate ออกไป `evil.example.com` (ต่างจาก `TC-LOGIN-100008` ที่ทดสอบรูปแบบ `//host` — เคสนี้ทดสอบรูปแบบ scheme เต็ม)

---

## TC-LOGIN-100102 — next ที่ขึ้นต้นด้วยแบ็กสแลชถูกปฏิเสธ กลับไป /dashboard
**Priority:** Medium · **Test Type:** Security
**Preconditions**
Browser logged out; `requestor@blueledgers.com` ใช้งานได้
**Steps**
1. เปิด `/login?next=/\evil.example.com` (เข้ารหัสเป็น `%2F%5Cevil.example.com`) แล้วจำ origin ไว้
2. เข้าสู่ระบบด้วย `requestor@blueledgers.com`
3. ตรวจ origin และ path ปลายทาง
**Expected**
หลังเข้าสู่ระบบไปที่ `/dashboard` บน origin เดิม — รูปแบบ `/\host` ซึ่งบางเบราว์เซอร์ตีความเท่ากับ `//host` ถูกปฏิเสธเช่นเดียวกับ `//` · ไม่มีการ navigate ออกนอก origin

---

## TC-LOGIN-100103 — ผู้ที่ล็อกอินแล้วเปิด /login?next=/profile ถูกพาไปปลายทางทันทีโดยไม่เห็นฟอร์ม
**Priority:** Medium · **Test Type:** Auth-guard
**Preconditions**
ล็อกอินเป็น `requestor@blueledgers.com` สำเร็จและอยู่ที่ `/dashboard`
**Steps**
1. ล็อกอินจนถึง `/dashboard`
2. navigate ไป `/login?next=/profile`
3. ตรวจ URL ปลายทางและตรวจว่าเคยเห็นฟอร์มเข้าสู่ระบบระหว่างทางหรือไม่
**Expected**
ถูกพาไป `/profile` ทันที (ไม่ใช่ `/dashboard`) — ตัวเด้งฝั่ง "ล็อกอินอยู่แล้ว" ใช้กฎ `next` ชุดเดียวกับหลังล็อกอิน · ปุ่ม "Sign In" ไม่เคยปรากฏ (ไม่มีการเรนเดอร์ฟอร์มซ้ำ) · สเปกเดิม `TC-LOGIN-010035` ทดสอบเฉพาะทางหลังล็อกอิน และ `TC-LOGIN-100003` ทดสอบเฉพาะกรณีไม่มี `next`

---

## TC-LOGIN-100104 — ผู้ที่ล็อกอินแล้วเปิด /register หรือ /forgot-password ถูกเด้งกลับ /dashboard
**Priority:** Medium · **Test Type:** Auth-guard
**Preconditions**
ล็อกอินเป็น `requestor@blueledgers.com` สำเร็จและอยู่ที่ `/dashboard`
**Steps**
1. ล็อกอินจนถึง `/dashboard`
2. navigate ไป `/register` แล้วตรวจ URL
3. navigate ไป `/forgot-password` แล้วตรวจ URL
**Expected**
ทั้งสองหน้าเด้งกลับ `/dashboard` โดยไม่แสดงฟอร์มสมัครหรือฟอร์มขอลิงก์ตั้งรหัสใหม่ — ผู้ที่มี session อยู่แล้วต้องเปลี่ยนรหัสผ่านจากหน้าโปรไฟล์ ไม่ใช่ผ่านอีเมล · หัวเรื่อง "Create your account" และ "Forgot your password?" ไม่ปรากฏเลย

---

## TC-LOGIN-100105 — Deep link ไปหน้าโมดูลที่ต้องล็อกอินขณะยังไม่ล็อกอิน ถูกเด้งไป /login
**Priority:** High · **Test Type:** Auth-guard
**Preconditions**
Browser ไม่มี session เลย (clear cookies + `localStorage`)
**Steps**
1. ล้าง cookies และ `localStorage` ให้แน่ใจว่าไม่มี `carmen.refresh_token`
2. navigate ตรงไปที่ `/procurement/purchase-request` (หน้าโมดูลลึก ไม่ใช่ `/dashboard`)
3. ตรวจ URL ที่ได้และ query string ของมัน
**Expected**
ถูกเด้งไป `/login` และเห็นฟอร์มเข้าสู่ระบบ · URL ปลายทางไม่มี query `next` (ตัว guard ส่งปลายทางเดิมไปทาง router state ไม่ใช่ query string) ⇒ เมื่อล็อกอินเสร็จจะไป `/dashboard` ตามค่า fallback ซึ่งเป็นพฤติกรรมที่ออกแบบไว้ · เคสนี้ต่างจาก `TC-LOGIN-100002` ที่ทดสอบเฉพาะ `/dashboard` ซึ่งเป็นปลายทาง fallback อยู่แล้ว

---

## TC-LOGIN-100106 — Session หมดอายุกลางทางแล้วถูกเด้งกลับหน้าเข้าสู่ระบบอัตโนมัติ
**Priority:** High · **Test Type:** Security
**Preconditions**
ล็อกอินเป็น `requestor@blueledgers.com` สำเร็จและอยู่ที่ `/dashboard`; เตรียม route interception ไว้จำลอง token หมดอายุ
**Steps**
1. ล็อกอินจนถึง `/dashboard`
2. ติดตั้ง route ให้ `**/api/auth/refresh-token` ตอบ 401 และให้ API ของแอป (เช่น `**/api/user/profile`) ตอบ 401 ด้วย
3. navigate ไปหน้าโมดูลอื่นเพื่อบังคับให้เกิด request ใหม่
4. รอผลโดยไม่กดอะไรเพิ่ม
**Expected**
ระบบพากลับมาที่ `/login` เองโดยที่ผู้ใช้ไม่ต้องกดอะไร (401 → ลอง refresh หนึ่งรอบ → ล้มเหลว → ล้าง token → guard เด้งออก) · ไม่มีหน้าจอค้างเป็นโครงร่างสีเทาและไม่มี error ดิบโผล่ · เปิด `/dashboard` ซ้ำก็ยังกลับมา `/login`

---

## TC-LOGIN-100107 — Access token ไม่ถูกเก็บลง storage ของเบราว์เซอร์
**Priority:** High · **Test Type:** Security
**Preconditions**
ล็อกอินเป็น `requestor@blueledgers.com` สำเร็จและอยู่ที่ `/dashboard`
**Steps**
1. ดัก response ของ `**/api/auth/login` เพื่ออ่านค่า `access_token` ที่ backend ส่งกลับมา
2. ล็อกอินจนถึง `/dashboard`
3. อ่านทุกคีย์ใน `localStorage` และ `sessionStorage`
4. ตรวจว่ามีคีย์ใดเก็บค่าเดียวกับ `access_token` หรือไม่
**Expected**
ไม่มีคีย์ใดใน `localStorage` หรือ `sessionStorage` ที่มีค่าเท่ากับ `access_token` (เก็บไว้ใน memory เท่านั้น) · คีย์ที่เกี่ยวกับ session มีเพียง `carmen.refresh_token` · access token ถูกส่งไปกับ API ผ่าน header `Authorization: Bearer …` ไม่ใช่ผ่าน query string หรือ cookie

---

## TC-LOGIN-100108 — ผู้ที่ล็อกอินแล้วเปิด /login พร้อม next ภายนอก ต้องไม่หลุดออกนอกเว็บ
**Priority:** High · **Test Type:** Security
**Preconditions**
ล็อกอินเป็น `requestor@blueledgers.com` สำเร็จและอยู่ที่ `/dashboard`
**Steps**
1. ล็อกอินจนถึง `/dashboard` แล้วจำ origin ไว้
2. navigate ไป `/login?next=//evil.example.com`
3. ตรวจ origin และ path ปลายทาง
**Expected**
ถูกเด้งไป `/dashboard` บน origin เดิมทันที ไม่ออกไป `evil.example.com` — เส้นทาง "ล็อกอินอยู่แล้ว" ใช้ตัวกรอง `next` ตัวเดียวกับเส้นทางหลังล็อกอิน · `TC-LOGIN-100008` ครอบเฉพาะเส้นทางหลังล็อกอิน เส้นทางนี้ยังไม่มีใครทดสอบ

---
