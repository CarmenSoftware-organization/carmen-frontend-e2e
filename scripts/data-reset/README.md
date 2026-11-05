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
4. ผูก user: ทุกบัญชีอยู่แผนกแรก (เรียงตาม code) โดย hod เป็นหัวหน้า, owner อยู่แผนกที่สอง, ทุกบัญชีได้ทุก location
5. workflow จาก `fixtures/workflows.json` — PR: Create → HOD → Purchase → GM (ทุกใบผ่าน GM),
   General PO: purchase → FC → GM, SR: Create → Store Approval (purchase) → Issue — ทุก workflow ได้รายการสินค้า
   ทั้งหมดที่ seed ไว้ (`data.products`) ไม่งั้นช่องเลือกสินค้าจะว่าง
   ทำไมทุก PR ผ่าน GM: ราคาของ PR ใส่ได้ตอนขั้น Purchase เท่านั้น และหน้าแก้ workflow ตั้งกฎ "ข้าม GM แล้วจบ" หลัง
   Purchase ไม่ได้ จึงคัด PR มูลค่าสูงด้วยกฎไม่ได้ (ผู้ใช้เลือกเมื่อ 2026-11-05)
   vendor ตัวแรก (เรียงตาม code) ที่ไม่มีอีเมลจะถูกเติม `carmensoftware.dev+vendor@gmail.com` ให้ (flow ส่ง PO ให้ vendor)
6. งวดสินค้าคงคลังของเดือนนี้ (เวลาไทย) ถ้ายังไม่มีงวดเปิดที่ครอบวันนี้

7. เอกสารและสต๊อก (`docs/`) ตามตารางของ spec ทุกขั้นทำโดย role ที่ทำจริง และทุกใบขึ้นต้นคำอธิบายด้วย `STD <แถว>`:
   - สต๊อก: ใบรับเข้าที่ commit แล้ว ได้ระดับ Critical / Warning / Low ที่ 711 (par 100, คงเหลือ 20 / 40 / 80)
     มีคงเหลือ 2 location และ lot ที่หมดอายุแล้ว (−30 วัน) กับใกล้หมดอายุ (+7 วัน)
   - PR 41 ใบ: draft 3, รอ HOD 18 (+1 ใบจากแผนกที่สอง), รอ Purchase 8, รอ GM 2, approved 5, ส่งกลับ 1, reject 2
     และ completed 1 (ทำเป็น PO ผ่าน confirm-pr) — PO อื่นทั้งหมดเป็นแบบ manual เพื่อไม่ดึง PR ที่ approved ไปใช้
   - PO draft / voided / approved / sent / partial / completed, GRN draft / saved / committed, CN draft / completed
   - SR draft 2, รออนุมัติ 2, รอจ่าย 1, ยกเลิก 1 (ใช้ reject เพราะไม่มี endpoint ยกเลิก), completed 1
   - price list 3 ใบที่ใช้ได้วันนี้, campaign 3 ใบ: เปิดอยู่ / ยังไม่เริ่ม / ปิดแล้ว (หน้าจอคำนวณสถานะจากวันที่)
8. ตรวจนับทั้ง BU เทียบตาราง (`verify-dataset.ts`) — แถวที่ขาดจะบอกชื่อพร้อมเลขเอกสารที่ seed ไว้ แล้วจบด้วย exit 1

## ถ้า reset ตอบ 504 / timeout

**ไม่ได้แปลว่าไม่มีอะไรเกิดขึ้น** — gateway เลิกรอที่ `RPC_TIMEOUT_MS` แต่ micro-business ทำต่อจนจบ ดูใน app ว่า BU
ว่างแล้วหรือยัง แล้วรัน `--skip-reset` อย่าสั่ง reset ซ้ำทันที

## แก้ workflow

แก้ `fixtures/workflows.json` (อ้าง user ด้วยอีเมล) — `validateFixture` ปฏิเสธกฎที่ชี้ไปขั้นก่อนหน้า หรืออีเมลที่ไม่ใช่บัญชีเทส
