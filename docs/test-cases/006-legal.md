# Legal (Terms of Service / Privacy Policy) — Test Cases

_Test-case catalog (documentation only; no automated Playwright spec yet). Authored from the React app source at `routes/legal/` (`terms.route.tsx`, `privacy.route.tsx`, `legal-page.tsx`, `legal-content.ts`, `terms-content.ts`, `privacy-content.ts`), the route table in `routes/router.tsx`, and the entry points in `routes/login/login-form.tsx` / `routes/register/signup-email-form.tsx`. Follows the TC-ID scheme in `docs/test-id-scheme.md`._

**Module:** Auth (public) — เอกสารกฎหมาย
**Frontend route:** `routes/legal`  •  **URL:** `/terms` (และ `/privacy`)
**Prefix:** `LEGAL`
**Default role:** ผู้ใช้ที่ยังไม่ได้ล็อกอิน (หน้า public)
**Total test cases:** 15

> หมายเหตุสำคัญสำหรับผู้รีวิว:
> - **ทั้งสอง route เป็น public จริง** — `routes/router.tsx:37-39` วาง `/terms` และ `/privacy` ไว้ใน `children` ของ `AppRoot` ชั้นนอก ไม่ได้อยู่ใต้ `ProtectedShell` (`RequireAuth`) จึงไม่มี auth guard และ **ไม่ได้ครอบด้วย `RedirectIfAuthed`** ด้วย ต่างจาก `/login` และ `/register` — ผลคือทั้งคนที่ยังไม่ล็อกอินและคนที่ล็อกอินอยู่แล้วเปิดหน้าเหล่านี้ได้เหมือนกัน (เคส TC-LEGAL-100001 / TC-LEGAL-100002 ยืนยันตามพฤติกรรมที่ออกแบบไว้นี้ ไม่ใช่รายงานข้อบกพร่อง)
> - **วันที่มีผลบังคับใช้เป็นค่าคงที่ในโค้ด** — `const EFFECTIVE = "2026-08-04"` ประกาศซ้ำใน `terms-content.ts:7` และ `privacy-content.ts:7` เนื้อหากฎหมายจะถูกฝ่ายกฎหมายแก้เป็นระยะ เคสในเอกสารนี้จึงยืนยันแค่ว่า **มีบรรทัดวันมีผลบังคับใช้อยู่ใต้ h1** (`Effective …` / `มีผลตั้งแต่ …`) โดยไม่ผูกกับค่าวันที่ เพื่อไม่ให้เทสแตกทุกครั้งที่อัปเดตเอกสาร
> - **ห้ามผูก assertion กับข้อความย่อหน้า** — เนื้อหาเป็นข้อความกฎหมายยาวนับพันคำต่อฉบับต่อภาษา เคสยืนยันเฉพาะ "โครง" ที่ยืนยันได้จากโค้ด: eyebrow / h1 / บรรทัดวันมีผล / ย่อหน้า intro / จำนวนหัวข้อ `h2` = 12 หัวข้อ และ `id` ของแต่ละ `<section>` ซึ่งเป็น anchor ที่สารบัญใช้จริง (`legal-page.tsx` วาง `id={section.id}` และ TOC ลิงก์ `href="#${section.id}"`)
> - **`id` ของ section เสถียรกว่าข้อความหัวข้อ** ให้ใช้ anchor id เป็นหลักในการ assert
>   - `/terms` (12): `acceptance`, `service`, `accounts`, `acceptable-use`, `your-data`, `availability`, `ip`, `liability`, `suspension`, `law`, `changes`, `contact`
>   - `/privacy` (12): `roles`, `collected`, `why`, `browser`, `sharing`, `retention`, `rights`, `security`, `transfers`, `children`, `changes`, `contact`
> - **ภาษาเริ่มต้นคืออังกฤษ** — `i18n/config.ts` กำหนด `DEFAULT_LOCALE = "en"` และ `components/i18n-provider.tsx` อ่าน locale จาก `localStorage` คีย์ `carmen.locale` ดังนั้นการเปิดหน้าในเบราว์เซอร์ที่ยังไม่เคยสลับภาษาจะเห็นหัวข้อภาษาอังกฤษ (`Terms of Service` / `Privacy Policy`) แม้ชื่อเคสในเอกสารนี้จะเป็นภาษาไทย
> - **ที่อยู่อีเมลในหัวข้อ "ติดต่อเรา" มาจาก `LEGAL_ENTITY`** (`legal-content.ts:16-20`) และคอมเมนต์ในไฟล์นั้นระบุชัดว่า **ต้องให้ฝ่ายกฎหมายตรวจและแก้ `LEGAL_ENTITY` ให้ตรงนิติบุคคลจริงก่อนขึ้น production** — TC-LEGAL-400003 จึงยืนยันว่า "มีอีเมลติดต่อตามค่าที่ตั้งใน `LEGAL_ENTITY`" ไม่ได้ล็อกกับสตริง `carmensoftware.com` ถาวร
> - **สารบัญแสดงเฉพาะจอกว้าง** — `TableOfContents` ใช้คลาส `hidden lg:block` ต้องรัน TC-LEGAL-020003 บน viewport กว้าง ≥ 1024px ไม่งั้นจะหา nav ไม่เจอ
> - **หน้านี้ไม่มีปุ่ม "ยอมรับ" / checkbox / การบันทึก consent ใด ๆ** โครงหน้า (`legal-page.tsx`) มีแค่ header + สารบัญ + บทความ + cross-link การยอมรับเป็นแบบ implied ผ่านข้อความ `termsLine` / `registerTermsLine` ในหน้า login/register จึงไม่มีเคสเกี่ยวกับการกดยอมรับในเอกสารนี้
> - **จุดที่ลิงก์เข้ามา** — `routes/login/login-form.tsx:233,241` (คีย์ `auth.*.termsLine`), `routes/register/signup-email-form.tsx:153,161` (คีย์ `registerTermsLine`) และ cross-link ท้ายหน้าเอกสารแต่ละฉบับ ลิงก์ในสองหน้าแรกฝังอยู่ในข้อความ rich-text จึงต้องคลิกที่คำที่เป็นลิงก์ ไม่ใช่ทั้งย่อหน้า

## Test Cases at a Glance
| TC | Title | Priority | Test Type |
| --- | --- | --- | --- |
| TC-LEGAL-010001 | เปิดหน้าข้อกำหนดการใช้งานจาก URL ตรง | High | Smoke |
| TC-LEGAL-010002 | เปิดหน้านโยบายความเป็นส่วนตัวจาก URL ตรง | High | Smoke |
| TC-LEGAL-010003 | เข้าเอกสารกฎหมายจากลิงก์ท้ายฟอร์มเข้าสู่ระบบ | High | Functional |
| TC-LEGAL-010004 | เข้าเอกสารกฎหมายจากลิงก์ท้ายฟอร์มสมัครใช้งาน | High | Functional |
| TC-LEGAL-010005 | สลับไปมาระหว่างสองเอกสารด้วยลิงก์ท้ายหน้า | High | Functional |
| TC-LEGAL-010006 | กลับหน้าเข้าสู่ระบบจาก header ของหน้าเอกสาร | Medium | Functional |
| TC-LEGAL-020001 | โครงหน้าข้อกำหนดการใช้งานครบตามออกแบบ | High | Functional |
| TC-LEGAL-020002 | โครงหน้านโยบายความเป็นส่วนตัวครบตามออกแบบ | High | Functional |
| TC-LEGAL-020003 | สารบัญด้านข้างพาไปยังหัวข้อที่เลือก | Medium | Functional |
| TC-LEGAL-100001 | เข้าทั้งสองหน้าได้โดยไม่ต้องล็อกอิน | High | Auth-guard |
| TC-LEGAL-100002 | ผู้ใช้ที่ล็อกอินอยู่แล้วยังเปิดหน้าเอกสารได้ | Medium | Auth-guard |
| TC-LEGAL-400001 | สลับภาษาไทย/อังกฤษบนหน้าเอกสาร | High | Functional |
| TC-LEGAL-400002 | ภาษาที่เลือกคงอยู่หลังรีโหลดและข้ามไปอีกเอกสาร | Medium | Functional |
| TC-LEGAL-400003 | หัวข้อติดต่อเราแสดงช่องทางอีเมล | Medium | Functional |
| TC-LEGAL-900001 | เปิดลิงก์ลึกพร้อม anchor ของหัวข้อ | Low | Edge Case |

---
## TC-LEGAL-010001 — เปิดหน้าข้อกำหนดการใช้งานจาก URL ตรง
**Priority:** High · **Test Type:** Smoke
**Preconditions**
เบราว์เซอร์ไม่มี session (ยังไม่ได้ล็อกอิน); ภาษาเป็นค่าเริ่มต้น `en` (ยังไม่เคยสลับภาษา จึงไม่มีคีย์ `carmen.locale` ใน localStorage)
**Steps**
1. เปิด `/terms` โดยตรงจากแถบที่อยู่
2. รอให้ lazy chunk ของ route โหลดเสร็จ
**Expected**
URL ยังเป็น `/terms` (ไม่ถูก redirect); แสดง eyebrow `Legal`, หัวข้อ `h1` ว่า `Terms of Service` และบรรทัดวันมีผลบังคับใช้ที่ขึ้นต้นด้วย `Effective` อยู่ใต้ h1

---
## TC-LEGAL-010002 — เปิดหน้านโยบายความเป็นส่วนตัวจาก URL ตรง
**Priority:** High · **Test Type:** Smoke
**Preconditions**
เบราว์เซอร์ไม่มี session; ภาษาเป็นค่าเริ่มต้น `en`
**Steps**
1. เปิด `/privacy` โดยตรงจากแถบที่อยู่
2. รอให้ lazy chunk ของ route โหลดเสร็จ
**Expected**
URL ยังเป็น `/privacy`; แสดง eyebrow `Legal`, หัวข้อ `h1` ว่า `Privacy Policy` และบรรทัดวันมีผลบังคับใช้ที่ขึ้นต้นด้วย `Effective` อยู่ใต้ h1

---
## TC-LEGAL-010003 — เข้าเอกสารกฎหมายจากลิงก์ท้ายฟอร์มเข้าสู่ระบบ
**Priority:** High · **Test Type:** Functional
**Preconditions**
ยังไม่ได้ล็อกอิน; อยู่ที่หน้า `/login` ซึ่งแสดงข้อความ `termsLine` ใต้ฟอร์ม
**Steps**
1. ไปที่ `/login`
2. คลิกลิงก์คำว่าข้อกำหนด/`terms` ในข้อความบรรทัดล่างสุดของฟอร์ม
3. กด Back กลับมาที่ `/login`
4. คลิกลิงก์คำว่านโยบายความเป็นส่วนตัว/`privacy policy` ในข้อความเดียวกัน
**Expected**
ขั้นที่ 2 นำทางไปที่ `/terms` และเห็น `h1` ของเอกสารข้อกำหนด; ขั้นที่ 4 นำทางไปที่ `/privacy` และเห็น `h1` ของนโยบายความเป็นส่วนตัว; ทั้งสองครั้งไม่ต้องล็อกอินก่อน

---
## TC-LEGAL-010004 — เข้าเอกสารกฎหมายจากลิงก์ท้ายฟอร์มสมัครใช้งาน
**Priority:** High · **Test Type:** Functional
**Preconditions**
ยังไม่ได้ล็อกอิน; อยู่ที่หน้า `/register` ขั้นกรอกอีเมล (ยังไม่กดส่ง) ซึ่งแสดงข้อความ `registerTermsLine` ใต้ฟอร์ม
**Steps**
1. ไปที่ `/register`
2. คลิกลิงก์คำว่าข้อตกลงการใช้บริการ/`terms of service` ในข้อความบรรทัดล่างสุด
3. กด Back กลับมาที่ `/register`
4. คลิกลิงก์คำว่านโยบายความเป็นส่วนตัว/`privacy policy` ในข้อความเดียวกัน
**Expected**
ขั้นที่ 2 นำทางไปที่ `/terms`, ขั้นที่ 4 นำทางไปที่ `/privacy`; ผู้ใช้อ่านเอกสารทั้งสองได้ก่อนกดสมัคร โดยไม่ต้องสร้างบัญชีหรือกรอกอีเมลก่อน

---
## TC-LEGAL-010005 — สลับไปมาระหว่างสองเอกสารด้วยลิงก์ท้ายหน้า
**Priority:** High · **Test Type:** Functional
**Preconditions**
ยังไม่ได้ล็อกอิน; อยู่ที่หน้า `/terms`
**Steps**
1. เลื่อนลงไปท้ายบทความจนเห็นลิงก์ใต้เส้นคั่น
2. คลิกลิงก์ `Read the Privacy Policy`
3. ที่หน้าปลายทาง เลื่อนลงท้ายบทความแล้วคลิกลิงก์ `Read the Terms of Service`
**Expected**
ขั้นที่ 2 นำทางไปที่ `/privacy` และแสดง `h1` ว่า `Privacy Policy`; ขั้นที่ 3 นำทางกลับมาที่ `/terms` และแสดง `h1` ว่า `Terms of Service`

---
## TC-LEGAL-010006 — กลับหน้าเข้าสู่ระบบจาก header ของหน้าเอกสาร
**Priority:** Medium · **Test Type:** Functional
**Preconditions**
ยังไม่ได้ล็อกอิน; อยู่ที่หน้า `/terms`; viewport กว้างพอให้ข้อความ `CARMEN BLUE` ในลิงก์มุมขวาแสดง (≥ breakpoint `sm`)
**Steps**
1. คลิกลิงก์ `CARMEN BLUE` ที่มุมขวาบนของ header
2. กลับมาที่ `/terms` อีกครั้ง
3. คลิกโลโก้ Carmen Blue (รูปที่มี alt ว่า `Carmen Blue`) ที่มุมซ้ายบนของ header
**Expected**
ทั้งขั้นที่ 1 และขั้นที่ 3 นำทางไปที่ `/login` และแสดงฟอร์มเข้าสู่ระบบ

---
## TC-LEGAL-020001 — โครงหน้าข้อกำหนดการใช้งานครบตามออกแบบ
**Priority:** High · **Test Type:** Functional
**Preconditions**
อยู่ที่หน้า `/terms`; ภาษาเป็น `en`
**Steps**
1. ตรวจส่วนหัวบทความ: eyebrow, `h1`, บรรทัดวันมีผลบังคับใช้ และย่อหน้า intro
2. นับจำนวนหัวข้อ `h2` ในบทความ
3. ตรวจว่า `<section>` แต่ละอันมี `id` ตามรายการ anchor ของหน้า terms
**Expected**
มี `h1` หนึ่งอันคือ `Terms of Service`; มีบรรทัดวันมีผลบังคับใช้ขึ้นต้นด้วย `Effective` (ไม่ผูกกับค่าวันที่); มีย่อหน้า intro ต่อท้าย; มีหัวข้อ `h2` 12 หัวข้อ และมี `<section>` ที่ `id` ครบทั้ง `acceptance`, `service`, `accounts`, `acceptable-use`, `your-data`, `availability`, `ip`, `liability`, `suspension`, `law`, `changes`, `contact`

---
## TC-LEGAL-020002 — โครงหน้านโยบายความเป็นส่วนตัวครบตามออกแบบ
**Priority:** High · **Test Type:** Functional
**Preconditions**
อยู่ที่หน้า `/privacy`; ภาษาเป็น `en`
**Steps**
1. ตรวจส่วนหัวบทความ: eyebrow, `h1`, บรรทัดวันมีผลบังคับใช้ และย่อหน้า intro
2. นับจำนวนหัวข้อ `h2` ในบทความ
3. ตรวจว่า `<section>` แต่ละอันมี `id` ตามรายการ anchor ของหน้า privacy
**Expected**
มี `h1` หนึ่งอันคือ `Privacy Policy`; มีบรรทัดวันมีผลบังคับใช้ขึ้นต้นด้วย `Effective`; มีย่อหน้า intro ต่อท้าย; มีหัวข้อ `h2` 12 หัวข้อ และมี `<section>` ที่ `id` ครบทั้ง `roles`, `collected`, `why`, `browser`, `sharing`, `retention`, `rights`, `security`, `transfers`, `children`, `changes`, `contact`

---
## TC-LEGAL-020003 — สารบัญด้านข้างพาไปยังหัวข้อที่เลือก
**Priority:** Medium · **Test Type:** Functional
**Preconditions**
อยู่ที่หน้า `/terms`; viewport กว้าง ≥ 1024px (สารบัญใช้คลาส `hidden lg:block` จึงซ่อนบนจอแคบ)
**Steps**
1. ตรวจว่ามี `nav` ที่มี aria-label ตรงกับป้ายสารบัญของเอกสาร (`On this page` เมื่อภาษาเป็น `en`)
2. นับจำนวนลิงก์ในสารบัญ
3. คลิกลิงก์สารบัญของหัวข้อ `8. Limits of liability`
**Expected**
สารบัญแสดงลิงก์ 12 รายการ ซึ่งมีจำนวนเท่ากับหัวข้อ `h2` ในบทความ; หลังคลิก URL ลงท้ายด้วย `#liability` และ `<section id="liability">` เลื่อนเข้ามาอยู่ในหน้าจอ

---
## TC-LEGAL-100001 — เข้าทั้งสองหน้าได้โดยไม่ต้องล็อกอิน
**Priority:** High · **Test Type:** Auth-guard
**Preconditions**
browser context ใหม่ที่ไม่มี storageState / ไม่มี refresh token ใน localStorage
**Steps**
1. เปิด `/terms`
2. รอให้หน้าโหลดเสร็จแล้วตรวจ URL ปัจจุบัน
3. เปิด `/privacy` แล้วตรวจ URL ปัจจุบันอีกครั้ง
**Expected**
ทั้งสองครั้งยังอยู่ที่ URL เดิม ไม่ถูก redirect ไป `/login`; เนื้อหาบทความแสดงครบ ยืนยันว่า route ทั้งคู่อยู่นอก `RequireAuth` ตามที่ประกาศใน `routes/router.tsx`

---
## TC-LEGAL-100002 — ผู้ใช้ที่ล็อกอินอยู่แล้วยังเปิดหน้าเอกสารได้
**Priority:** Medium · **Test Type:** Auth-guard
**Preconditions**
ล็อกอินเป็น admin@blueledgers.com และอยู่ที่ `/dashboard`
**Steps**
1. ไปที่ `/terms` โดยตรง
2. ตรวจ URL และหัวข้อ `h1`
3. ไปที่ `/privacy` โดยตรงแล้วตรวจซ้ำ
**Expected**
ทั้งสองหน้าแสดงเนื้อหาตามปกติและไม่ถูก redirect กลับ `/dashboard` (ต่างจาก `/login` และ `/register` ที่ครอบด้วย `RedirectIfAuthed`); header ของหน้าเอกสารยังมีลิงก์กลับไป `/login` ตามโครงเดิม

---
## TC-LEGAL-400001 — สลับภาษาไทย/อังกฤษบนหน้าเอกสาร
**Priority:** High · **Test Type:** Functional
**Preconditions**
อยู่ที่หน้า `/terms`; ภาษาปัจจุบันเป็น `en` (ปุ่ม `EN` มี `aria-pressed="true"`)
**Steps**
1. คลิกปุ่ม `ไทย` ในตัวสลับภาษาที่ header
2. ตรวจหัวข้อ `h1` ป้ายสารบัญ และลิงก์ท้ายหน้า
3. คลิกปุ่ม `EN` กลับ
**Expected**
หลังขั้นที่ 1 `h1` เปลี่ยนเป็น `ข้อตกลงการใช้บริการ` บรรทัดวันมีผลขึ้นต้นด้วย `มีผลตั้งแต่` ป้ายสารบัญเป็น `หัวข้อในหน้านี้` และลิงก์ท้ายหน้าเป็น `อ่านนโยบายความเป็นส่วนตัว` โดยปุ่ม `ไทย` มี `aria-pressed="true"`; หลังขั้นที่ 3 ทุกอย่างกลับเป็นภาษาอังกฤษ และจำนวนหัวข้อยังเป็น 12 เท่าเดิมทั้งสองภาษา

---
## TC-LEGAL-400002 — ภาษาที่เลือกคงอยู่หลังรีโหลดและข้ามไปอีกเอกสาร
**Priority:** Medium · **Test Type:** Functional
**Preconditions**
อยู่ที่หน้า `/terms`; เบราว์เซอร์อนุญาตให้เขียน localStorage
**Steps**
1. คลิกปุ่ม `ไทย` ในตัวสลับภาษา
2. รีโหลดหน้า `/terms`
3. คลิกลิงก์ท้ายหน้า `อ่านนโยบายความเป็นส่วนตัว`
**Expected**
หลังรีโหลดยังเป็นภาษาไทย (`h1` = `ข้อตกลงการใช้บริการ`) และค่าในคีย์ `carmen.locale` ของ localStorage เป็น `th`; หน้า `/privacy` ที่เปิดต่อแสดง `h1` ว่า `นโยบายความเป็นส่วนตัว` โดยไม่ต้องสลับภาษาซ้ำ

---
## TC-LEGAL-400003 — หัวข้อติดต่อเราแสดงช่องทางอีเมล
**Priority:** Medium · **Test Type:** Functional
**Preconditions**
อยู่ที่หน้า `/privacy`
**Steps**
1. คลิกลิงก์หัวข้อสุดท้ายในสารบัญ (`12. Contact`) หรือเลื่อนลงไปที่ `<section id="contact">`
2. อ่านย่อหน้าในหัวข้อนั้น
3. ไปที่ `/terms` แล้วเปิด `<section id="contact">` ซ้ำแบบเดียวกัน
**Expected**
ทั้งสองหน้ามี `<section id="contact">` ที่มีหัวข้อ `h2` ลำดับที่ 12 และย่อหน้าที่มีอีเมลติดต่อสองช่องทางตามค่าที่ตั้งไว้ใน `LEGAL_ENTITY` (ปัจจุบันคือ privacy@carmensoftware.com สำหรับเรื่องข้อมูลส่วนบุคคล และ support@carmensoftware.com สำหรับเรื่องทั่วไป) — assert ที่การมีอยู่ของอีเมลทั้งสอง ไม่ใช่ข้อความเต็มย่อหน้า

---
## TC-LEGAL-900001 — เปิดลิงก์ลึกพร้อม anchor ของหัวข้อ
**Priority:** Low · **Test Type:** Edge Case
**Preconditions**
ยังไม่ได้ล็อกอิน; browser context ใหม่ (route โหลดแบบ lazy จึงเป็นการทดสอบว่า anchor ยังทำงานเมื่อเนื้อหามาหลัง URL)
**Steps**
1. เปิด `/terms#liability` โดยตรงจากแถบที่อยู่
2. รอให้บทความ render เสร็จ
3. เปิด `/privacy#retention` โดยตรงแบบเดียวกัน
**Expected**
ทั้งสองครั้งหน้าโหลดสำเร็จโดยไม่ถูก redirect และ `<section>` ที่ `id` ตรงกับ anchor มีอยู่ในหน้า; หัวข้อ `h2` ของ section นั้นมองเห็นได้ (ไม่ถูก header บัง เพราะ section ตั้ง `scroll-mt-24` ไว้)
