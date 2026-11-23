# data:reset

ล้าง TEST BU (`GR2VYNKQ`) บน dev แล้วสร้างชุดข้อมูลมาตรฐานใหม่ — สั่งเองก่อนรันเทส ไม่ผูกกับ `bun run test`

```bash
bun run data:reset --dry-run   # อ่านอย่างเดียว: ตรวจขั้น 0 แล้วพิมพ์สิ่งที่จะเขียน
bun run data:reset --yes       # ของจริง (backend ไม่ใช่ localhost ต้องมี --yes)
bun run data:reset --yes --skip-reset   # seed ลง BU ที่ reset แล้ว — ปฏิเสธถ้ายังมี PR อยู่
```

## ต้องมี

- backend dev ที่ deploy endpoint `POST /api-system/tenant/resets/:bu_id` แล้ว (backend PR #1004) และตั้ง
  `TENANT_RESET_ALLOWED_BU_CODES=GR2VYNKQ`, `TENANT_MIGRATION_API_ENABLED=true`
- `.env.local`: `DATA_RESET_DEPLOY_TOKEN` (= `TENANT_DEPLOY_TOKEN` ของ gateway) และ `SEED_BACKEND_URL` /
  `SEED_X_APP_ID` หรือ `SEED_CONFIG_PATH` ชี้ `config.json` ของ frontend
- สิทธิ์ของ role purchase ใน TEST BU: `vendor_management.vendor.view`, `product_management.category.view`,
  `vendor_management.request_price_list.view` — ให้ครั้งเดียว (อยู่ schema กลาง reset ไม่ลบ) คำสั่งนี้แค่ตรวจ

## ลำดับ

1. ขั้น 0 — ทั้ง 9 บัญชีอยู่ใน TEST BU (BU อื่นต้องไม่เป็น default) และสิทธิ์ purchase ครบ ไม่ผ่าน = ไม่แตะอะไร
2. reset (deploy token เท่านั้น ไม่ใช้ token ของ user)
3. master data — ชุด sample ของ `seed:master` (`sample_seed_data/Preconfig_CARMEN_AVG.xlsx`, 50 แถวต่อชนิด)
3b. ตั้งค่าตัว BU: `default_currency_id` ชี้แถว THB ที่เพิ่งสร้าง (reset สร้างสกุลเงินใหม่ id ใหม่ แต่แถว BU ยังถือ id เก่า → ทุกหน้าขึ้นแถบ "default currency ... no longer exists")
   และผังบัญชี 18 บัญชีจาก `fixtures/chart-of-accounts.json` (workbook ไม่มี COA และ reset ล้างตารางนี้) — `verify-dataset` เช็คทั้งสองอย่าง
3c. ฐานบัญชี AP + GL (`accounting.ts`, ขั้น `accounting` — ล้มแล้วหยุดก่อน mappings): ไม่มีขั้นนี้ AP / JV post ไม่ได้
   (`GL_PERIOD_NOT_OPEN` / `GL_SETTING_ACCOUNT_MISSING`) — เขียน `gl_setting` (บัญชีเจ้าหนี้ / VAT ซื้อ / WHT / เงินมัดจำ /
   FX กำไร-ขาดทุน, `ap_auto_from_grn: false`, `fiscal_year_start_month: 1`) ผ่าน `PUT /app-config/gl_setting`,
   สร้างปี GL 13 งวด (`POST /gl-periods/years`) ถ้ายังไม่มีงวดเปิดที่ครอบวันนี้, บัญชีธนาคาร `E2E-BANK` ผูก COA 1110,
   tax profile `Vat 7%` ผูก 1170 (แก้เฉพาะบัญชี ไม่แตะชื่อ/อัตรา) กับ `WHT 3%` (wht, ภ.ง.ด.53) ผูก 2150,
   และ `ap_chart_of_accounts_id` = 2100 ให้ทุก vendor — ทุกอย่างข้ามถ้าค่าตรงอยู่แล้ว (reset ล้างทั้งหมด จึงสร้างใหม่ทุกรอบ)
   role / workflow ของ AP + JV อยู่ที่ขั้น 4b / 5 ด้านล่าง
4. ผูก user: ทุกบัญชีอยู่แผนกแรก (เรียงตาม code) โดย hod เป็นหัวหน้า, owner อยู่แผนกที่สอง (hod เป็นหัวหน้าด้วย —
   PR ของแผนกที่ไม่มี HOD ส่งไม่ได้ backend ตอบ 503), ทุกบัญชีได้ทุก location
   สิทธิ์ (`access.ts`): ให้ application role ที่ยังไม่มี — requestor → Requestor, hod → HOD, purchase → Purchase,
   fc / gm / owner / storemanager → Approval, budget → Accounting (admin เป็น BU admin อยู่แล้ว) ใช้
   `POST /api/config/:bu/user-application-roles` แบบเดียวกับ movement suite และเพิ่มอย่างเดียว ไม่ถอด role ที่มีอยู่
   และตั้ง THB เป็นสกุลเงินหลักของ BU ถ้ายังไม่ได้ตั้ง (`PATCH /api/business-units` เขียน BU default ของ admin
   จึงปฏิเสธถ้า BU นั้นไม่ใช่ TEST BU) — 2026-11-11 มีแต่ purchase ที่ถือ role (บัญชีอื่นเจอ Permission Denied ทั้งชุด
   PR) และ BU ไม่มีสกุลเงินหลัก (แบนเนอร์เตือนทุกหน้า)
4b. role บัญชี (`seedAccountingRoles` ใน `access.ts`, ขั้น `accounting-roles`): catalog สิทธิ์ไม่มีคีย์ สร้าง / อนุมัติ / จ่าย ของ AP หรือ JV
   (คุมด้วย stage ของ workflow) มีแค่ view / void / post / reverse จึงสร้าง "Accounting Approver" (budget: `accounting.ap.void`,
   `accounting.gl.void` / `post` / `reverse` + view) กับ "Accounting Viewer" (requestor: view อย่างเดียว) โดยอ่าน permission id
   จาก role "Accounting" ของ BU และปฏิเสธชื่อคีย์ที่ไม่มีใน catalog แทนการให้สิทธิ์ผี — เพิ่มทับ role หลัก ไม่ถอดของเดิม
5. workflow จาก `fixtures/workflows.json` — PR: Create → HOD → Purchase → GM (ทุกใบผ่าน GM),
   General PO: purchase → FC → GM, SR: Create → Store Approval (purchase) → Issue,
   AP Payment (`ap_payment`) และ Journal Voucher (`gl_jv`, เฉพาะใบ manual): Create (admin, budget) → Accounting Approval (budget) —
   ใบแจ้งหนี้ AP ไม่มี workflow (submit แล้ว post เลย) — ทุก workflow ได้รายการสินค้า
   ทั้งหมดที่ seed ไว้ (`data.products`) ไม่งั้นช่องเลือกสินค้าจะว่าง
   ทุก workflow จบด้วยขั้น `Completed` (ไม่มีคน ไม่มี action) — backend ปิดเอกสารตอนอนุมัติที่ "เข้า" ขั้นสุดท้าย
   ถ้าขั้นสุดท้ายเป็นผู้อนุมัติจริง (เช่น GM) เอกสารจะ approved ข้ามคนนั้นไป `validateFixture` จึงปฏิเสธ workflow แบบนั้น
   ทำไมทุก PR ผ่าน GM: ราคาของ PR ใส่ได้ตอนขั้น Purchase เท่านั้น และหน้าแก้ workflow ตั้งกฎ "ข้าม GM แล้วจบ" หลัง
   Purchase ไม่ได้ จึงคัด PR มูลค่าสูงด้วยกฎไม่ได้ (ผู้ใช้เลือกเมื่อ 2026-11-05)
   vendor ตัวแรก (เรียงตาม code) ที่ไม่มีอีเมลจะถูกเติม `carmensoftware.dev+vendor@gmail.com` ให้ (flow ส่ง PO ให้ vendor)
6. งวดสินค้าคงคลังของเดือนนี้ (เวลาไทย) ถ้ายังไม่มีงวดเปิดที่ครอบวันนี้ + งวด**เดือนถัดไป** (ธ.ค. → ม.ค. ปีหน้า) สร้างล่วงหน้าผ่าน
   `POST /inventory-periods/next` (สถานะ open แบบเดียวกับที่การปิดงวดเติมให้ — งวดปัจจุบันของ BE คืองวดเปิดที่เก่าสุด จึงยังเป็นเดือนนี้) ซ้ำได้ ถ้ามีอยู่แล้วข้าม · verify แถว `period.next` · ใช้กับเคส Stock In ลงงวดล่วงหน้า (TC-IADJ-800010)

7. เอกสารและสต๊อก (`docs/`) ตามตารางของ spec ทุกขั้นทำโดย role ที่ทำจริง และทุกใบขึ้นต้นคำอธิบายด้วย `STD <แถว>`:
   - สต๊อก: ใบรับเข้าที่ commit แล้ว ได้ระดับ Critical / Warning / Low ที่ 711 (par 100, คงเหลือ 20 / 40 / 80)
     มีคงเหลือ 2 location และ lot ที่หมดอายุแล้ว (−30 วัน) กับใกล้หมดอายุ (+7 วัน)
   - PR 41 ใบ: draft 3, รอ HOD 18 (+1 ใบจากแผนกที่สอง), รอ Purchase 8, รอ GM 2, approved 5, ส่งกลับ 1, reject 2
     และ completed 1 (ทำเป็น PO ผ่าน confirm-pr) — PO อื่นทั้งหมดเป็นแบบ manual เพื่อไม่ดึง PR ที่ approved ไปใช้
   - PO draft / voided / approved / sent / partial / completed, GRN draft / saved / committed, CN draft / completed
   - SR draft 2, รออนุมัติ 2, รอจ่าย 1, ยกเลิก 1 (ใช้ reject เพราะไม่มี endpoint ยกเลิก), completed 1
   - price list 3 ใบที่ใช้ได้วันนี้, campaign 3 ใบ: เปิดอยู่ / ยังไม่เริ่ม / ปิดแล้ว (หน้าจอคำนวณสถานะจากวันที่)
   - ชุดเอกสารบัญชีอ่านอย่างเดียว (`docs/accounting.ts`, ขั้น `accounting-docs`) ค้นเจอด้วย key ใน `vendor_invoice_no` / คำอธิบาย
     / code: `E2E-AP-POSTED` (1 บรรทัด 3 × 333.33 = 999.99 + VAT 70.00 = 1,069.99), `E2E-AP-INCVAT` (1,070.00 รวม VAT), `E2E-AP-PARTIAL` (1,000 + VAT,
     จ่าย 400.00 ไม่มี WHT → ค้าง 670.00), `E2E-AP-PAID` (535.00 จ่ายครบ), `E2E-AP-DRAFT`, `E2E-AP-DEPOSIT`, `E2E-AP-DN`, `E2E-AP-CN`,
     `E2E-JV-POSTED` (Dr 5300 / Cr 1110 250.00), `E2E-JVT-1` (template) — ใบจ่ายเงินสร้างโดย admin อนุมัติโดย budget,
     ต้องมี Payment Type (`E2E-PT`) ซึ่ง reset ล้างทิ้ง จึงสร้างให้ · ยอดรวมและยอดค้างเทียบกับที่คำนวณจากบรรทัดของตัวเอง
     ไม่ใช่ค่าที่ backend ตอบ — ถ้า dev ปฏิเสธ deposit / debit note / credit note จะแจ้งสถานะ+body แล้วข้ามแถวนั้น ไม่ปลอม
7b. ฐาน POS / Sales Consumption (`docs/pos.ts`, ขั้น `pos` ต่อจาก `stock`):
   - เปิด Simphony: app-config `interface_pos_simphony` = `{ enabled: true }` (อ่านค่าเดิมก่อน คงฟิลด์อื่นไว้)
   - recipe `E2E-POS-A` (P1 × 2, P2 × 1) และ `E2E-POS-B` (P3 × 1, P4 × 3) โดย P1–P4 = สินค้า 4 ตัวสุดท้ายของ context (p7–p10)
     หน่วย = หน่วยคลังของสินค้า · dataset หลักไม่มี recipe category / cuisine จึงสร้าง `E2E-POS` / `E2E POS` ให้ (ถ้ายังไม่มี)
   - ใบรับเข้าที่ commit แล้ว `STD pos.stock.l1` / `STD pos.stock.l2`: P1–P4 จำนวน 500 ต้นทุน 10 ที่ location แรก / ที่สอง
     ลงวันที่ **วันแรกของงวดที่เปิดอยู่** (อ่านจาก `inventory-periods/current`) ไม่ใช่วันนี้
   - p7–p8 ซ้อนกับ `stock.on-hand.*` และ p9 ซ้อนกับ lot หมดอายุของ `stock.*` (ไม่มีสินค้าว่าง 4 ตัวติดกัน) — spec ที่อ่านยอดต้องดูเป็นส่วนต่างเสมอ
7c. ฐาน Inventory Adjustment (`docs/ia.ts`, ขั้น `ia` ต่อจาก `pos`):
   - สินค้า `E2E-IA-A` / `E2E-IA-B` (สร้างถ้ายังไม่มี — ซ้ำได้ ใช้ code เป็นกุญแจ) คัดลอก item group / หน่วยคลังจากสินค้าตัวแรกของ context
   - ผูกกับ location แรก (1AG01) **ที่เดียว** และ **ไม่สร้างใบรับเข้า** — สต๊อกเริ่มที่ 0 ให้ spec ทดสอบต้นทุนของ adjustment
   - ประเภทปรับปรุง active 2 ตัว (ซ้ำได้ ใช้ code เป็นกุญแจ): `E2E-IA-IN` (stock_in) / `E2E-IA-OUT` (stock_out) — spec เลือกด้วย code ไม่พึ่ง EOP-* / SALE
   - verify: `ia.adjustment-types` (มีทั้งสองตัวและ active) · `ia.products` (มีทั้งสองรหัส) · `ia.no-stock` (`inventory-info` on-hand ของทั้งสองที่ location นั้น = 0)
8. ตรวจนับทั้ง BU เทียบตาราง (`verify-dataset.ts`) — แถวที่ขาดจะบอกชื่อพร้อมเลขเอกสารที่ seed ไว้ แล้วจบด้วย exit 1

## ถ้า reset ตอบ 504 / timeout

**ไม่ได้แปลว่าไม่มีอะไรเกิดขึ้น** — gateway เลิกรอที่ `RPC_TIMEOUT_MS` แต่ micro-business ทำต่อจนจบ ดูใน app ว่า BU
ว่างแล้วหรือยัง แล้วรัน `--skip-reset` อย่าสั่ง reset ซ้ำทันที

## แก้ workflow

แก้ `fixtures/workflows.json` (อ้าง user ด้วยอีเมล) — `validateFixture` ปฏิเสธกฎที่ชี้ไปขั้นก่อนหน้า หรืออีเมลที่ไม่ใช่บัญชีเทส
