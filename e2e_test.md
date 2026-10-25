# E2E Test — คู่มือรัน & Sync Google Sheets

คู่มือภาษาไทยสำหรับการรันและ sync ผล — ภาพรวม architecture ดู [`README.md`](./README.md) และ [`CLAUDE.md`](./CLAUDE.md)

## สารบัญ

1. [Prerequisites](#prerequisites)
2. [รันทีละ Module](#รันทีละ-module)
3. [รัน Login แยก](#รัน-login-แยก)
4. [รันทุก Module](#รันทุก-module)
5. [รันกับ environment อื่น](#รันกับ-environment-อื่น)
6. [Sync ผลขึ้น Google Sheets](#sync-ผลขึ้น-google-sheets)
7. [ตัวเลือกเพิ่มเติม](#ตัวเลือกเพิ่มเติม)
8. [Modules ทั้งหมด](#modules-ทั้งหมด)
9. [โครงสร้างผลลัพธ์](#โครงสร้างผลลัพธ์)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

```bash
# 1. ติดตั้ง dependencies
bun install

# 2. ติดตั้ง Playwright browsers (ครั้งเดียว)
bun run install-browsers

# 3. backend ต้องรันอยู่ที่ :4000 (Docker) — ถ้าไม่รัน project `setup` จะค้างเงียบ
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000

# 4. (ไม่บังคับ) ตั้งค่า Google Sheets sync ใน .env.local — ดูหัวข้อ Sync
```

frontend (`../carmen-frontend`, Vite `:3000`) ไม่ต้องสั่งเอง — Playwright `webServer` จะรัน `bun dev` ให้

> ใช้ `bun run test` ไม่ใช่ `bun test` — `bun test` เรียก test runner ของ Bun เอง ไม่ใช่ script `test`

---

## รันทีละ Module

### วิธีที่ 1: shell script (แนะนำ — รันเสร็จ sync อัตโนมัติ)

```bash
./tests/scripts/run-module.sh                   # ไม่ใส่ชื่อ → เมนูให้เลือก
./tests/scripts/run-module.sh department
./tests/scripts/run-module.sh currency --headed
./tests/scripts/run-module.sh vendor --debug
```

ชื่อ module = ชื่อไฟล์ spec ที่ตัดเลขนำหน้าออก (`010-department.spec.ts` → `department`) — ดูตาราง [Modules ทั้งหมด](#modules-ทั้งหมด)

### วิธีที่ 2: playwright โดยตรง (ไม่ auto-sync)

```bash
bun run test -- 010-department.spec.ts

# รัน test case เดียวด้วย -g
bun run test -- 010-department.spec.ts -g "TC-DEP-010001"

# รันหลาย TC
bun run test -- -g "TC-DEP-010001|TC-DEP-010002"

# ต้อง sync เอง
bun run e2e:sync
```

---

## รัน Login แยก

Login เป็น Playwright project แยก (`login`) ที่ไม่พึ่ง `setup` เพราะทดสอบการ login ผ่าน UI จริง:

```bash
bun run test:login
bun run test:login -- -g "TC-LOGIN-010001"
```

---

## รันทุก Module

```bash
# ทีละ module เรียงลำดับ (เห็น pass/fail แต่ละตัว + sync ทุก module)
./tests/scripts/run-all.sh

# รันพร้อมกันเป็น batch เดียว (เร็วกว่า แต่ log ปนกัน)
./tests/scripts/run-all.sh --workers=100%

# หรือผ่าน bun script (ไม่ auto-sync)
bun run test
bun run e2e:sync
```

---

## รันกับ environment อื่น

`scripts/run-env.ts` อ่าน `.env.<name>` แล้ว override ค่าจาก `.env` / `.env.local`:

```bash
bun run test:prod                         # ใช้ .env.prod
bun run test:uat -- --project=login       # ใช้ .env.uat
bun run scripts/run-env.ts <name>         # target อื่น ๆ
```

ไฟล์ `.env.*` ถูก gitignore — สร้างเองบนเครื่อง ตัวอย่างอยู่ท้าย `.env.example`

---

## Sync ผลขึ้น Google Sheets

```bash
bun run e2e:sync          # upsert ผล
bun run e2e:sync:reset    # ล้าง data rows ทุก tab ก่อน (header คงอยู่; Title/Note ที่แก้มือจะหาย)
```

### การทำงาน

1. reporter `tests/reporters/tc-json-reporter.ts` เขียน `tests/results/<spec>-results.json` หลังรันแต่ละ spec
2. `scripts/sync-test-results.ts` จับคู่ Test ID กับ row ในแต่ละ tab ตาม `SYNC_TARGETS`
3. **Row มีอยู่แล้ว** → เขียนทับ Status, Run Date, Duration, Error, Seq และ annotation (Preconditions, Steps, Expected Result, Priority, Test Type)
4. **Row ใหม่** → เพิ่มแถวท้าย tab
5. **Title / Note** → เขียนเฉพาะตอน cell ว่าง (ไม่ทับที่แก้ด้วยมือ)
6. tab ว่าง → สร้าง header ให้; header ขาดคอลัมน์ → เติมต่อท้าย

### ตั้งค่า (ครั้งเดียว)

1. Google Cloud Console → เปิด **Google Sheets API**
2. IAM → Service Accounts → สร้าง → ดาวน์โหลด JSON key
3. แชร์ Spreadsheet ให้ service-account email เป็น Editor
4. ใส่ใน `.env.local` (ห้าม commit):
   ```
   GOOGLE_SHEETS_SA_KEY_PATH=/absolute/path/to/service-account.json
   GOOGLE_SHEETS_SPREADSHEET_ID=<sheet id จาก URL>
   ```

Header มาตรฐาน (15 คอลัมน์):

```
Seq | Test ID | Title | Preconditions | Steps | Expected Result | Priority | Test Type | Status | Run Date | Duration (ms) | Error | Note | Screenshot | Video
```

spec ใหม่ต้องเพิ่ม entry ใน `SYNC_TARGETS` ไม่งั้นผลไม่ขึ้น Sheet

---

## ตัวเลือกเพิ่มเติม

```bash
bun run test:ui                                   # Playwright UI mode
bun run test:headed                               # เห็น browser
bun run test:debug                                # step-by-step
bun run test -- 040-currency.spec.ts --retries=2
bun run test -- 040-currency.spec.ts --trace on
bun run report                                    # เปิด HTML report
```

---

## Modules ทั้งหมด

<!-- AUTO-GENERATED: from tests/[0-9]*-*.spec.ts + SYNC_TARGETS in scripts/sync-test-results.ts — regenerate, don't hand-edit -->
| Module (`run-module.sh`) | Spec | TC prefix | Sheet tab |
|--------------------------|------|-----------|-----------|
| `login` | `001-login.spec.ts` | TC-LOGIN | `Login` |
| `spa-smoke` | `002-spa-smoke.spec.ts` | TC-SPA | `SPA_Smoke` |
| `department` | `010-department.spec.ts` | TC-DEP | `Department` |
| `unit` | `020-unit.spec.ts` | TC-UN | `Unit` |
| `business-type` | `029-business-type.spec.ts` | TC-BT | `Business_Type` |
| `extra-cost` | `030-extra-cost.spec.ts` | TC-EC | `Extra_Cost` |
| `adjustment-type` | `031-adjustment-type.spec.ts` | TC-AT | `Adjustment_Type` |
| `credit-term` | `032-credit-term.spec.ts` | TC-CT | `Credit_Term` |
| `currency` | `040-currency.spec.ts` | TC-CUR, TC-DEP | `Currency` |
| `exchange-rate` | `041-exchange-rate.spec.ts` | TC-ER | `Exchange_Rate` |
| `tax-profile` | `042-tax-profile.spec.ts` | TC-TP | `Tax_Profile` |
| `certification` | `043-certification.spec.ts` | TC-CERT | `Certification` |
| `eco` | `044-eco.spec.ts` | TC-ECO | `Eco` |
| `delivery-point` | `079-delivery-point.spec.ts` | TC-DP | `Delivery_Point` |
| `location` | `080-location.spec.ts` | TC-LOC | `Location` |
| `chart-of-account-mapping` | `081-chart-of-account-mapping.spec.ts` | TC-ACMAP | `Chart_Of_Account_Mapping` |
| `chart-of-accounts` | `082-chart-of-accounts.spec.ts` | TC-COA | `Chart_Of_Accounts` |
| `shelf` | `083-shelf.spec.ts` | TC-SHLF | `Shelf` |
| `product-category` | `101-product-category.spec.ts` | TC-CAT | `Product_Category` |
| `op-category` | `110-op-category.spec.ts` | TC-OPCAT | `OP_Category` |
| `cuisine` | `111-cuisine.spec.ts` | TC-CUIS | `Cuisine` |
| `recipe-equipment-category` | `121-recipe-equipment-category.spec.ts` | TC-RECC | `Recipe_Equipment_Category` |
| `equipment-category` | `131-equipment-category.spec.ts` | TC-EQPC | `Equipment_Category` |
| `vendor` | `150-vendor.spec.ts` | TC-VEN | `Vendor` |
| `pl` | `159-pl.spec.ts` | TC-PL | `PL` |
| `pl-template` | `160-pl-template.spec.ts` | TC-PT | `PL_Template` |
| `my-approvals` | `201-my-approvals.spec.ts` | TC-MA | `My_Approvals` |
| `pr` | `301-pr.spec.ts` | TC-PR | `PR` |
| `pr-creator-journey` | `302-pr-creator-journey.spec.ts` | TC-PR | `PR_Creator` |
| `pr-approver-journey` | `303-pr-approver-journey.spec.ts` | TC-PR | `PR_Approver` |
| `pr-purchaser-journey` | `304-pr-purchaser-journey.spec.ts` | TC-PR | `PR_Purchaser` |
| `pr-template` | `310-pr-template.spec.ts` | TC-PRT | `PR_Template` |
| `pr-returned-flow` | `311-pr-returned-flow.spec.ts` | TC-PR | `PR_Returned_Flow` |
| `po` | `401-po.spec.ts` | TC-PO | `PO` |
| `po-purchaser-journey` | `402-po-purchaser-journey.spec.ts` | TC-PO | `PO_Purchaser` |
| `po-approver-journey` | `403-po-approver-journey.spec.ts` | TC-PO | `PO_Approver` |
| `grn` | `501-grn.spec.ts` | TC-GRN | `GRN` |
| `cn` | `601-cn.spec.ts` | TC-CN | `CN` |
| `cn-reason` | `602-cn-reason.spec.ts` | TC-CNR | `CN_Reason` |
| `sr` | `701-sr.spec.ts` | TC-SR | `SR` |
| `wastage-reporting` | `710-wastage-reporting.spec.ts` | TC-WAST | `Wastage_Reporting` |
| `stock-replenishment` | `711-stock-replenishment.spec.ts` | TC-SRPL | `Stock_Replenishment` |
| `stock-issue` | `720-stock-issue.spec.ts` | TC-SI | `Stock_Issue` |
| `period-end` | `900-period-end.spec.ts` | TC-PE | `Period_End` |
| `campaign` | `1001-campaign.spec.ts` | TC-CAM | `Campaign` |
<!-- /AUTO-GENERATED -->

รายการ prefix และ section ที่ลงทะเบียนไว้: [`docs/test-id-scheme.md`](./docs/test-id-scheme.md)

### ชุด movement (ไม่อยู่ในรอบรันปกติ — ต้องสั่งเอง)

ย้ายมาจาก `_movement_play/eop_bf/e2e` — ทดสอบการเคลื่อนไหวสต๊อกบน CARMEN-AVG / CARMEN-FIFO ด้วยบัญชี `@carmen.com` (`tests/movement-users.ts`) และตรวจผลถึงหลังบ้าน/DB จึงไม่รวมใน `bun run test` และ `run-module.sh` / `run-all.sh`

| ชุด | Spec | TC | คำสั่ง |
|-----|------|----|--------|
| วงจรเอกสารตามบทบาท | `312-pr`, `404-po`, `502-grn`, `603-cn`, `702-sr`, `721-sr-issue`, `730-inventory-adjustment` (`*-doc-flow.spec.ts`) | section 70–71 ของ prefix โมดูล | `bun run test:movement` |
| ปิดงวด (ทีละ phase) | `910`–`924-period-close-*.spec.ts` | TC-PE section 40–54 | `E2E_PERIOD_SCENARIO=<scenario> bun run test:period-close -- tests/<phase>.spec.ts` หรือ `./tests/scripts/run-period-close.sh <scenario>` |

ต้องตั้ง `E2E_DB_URL` ใน `.env.local` ก่อน (ดู `.env.example`) · ครั้งแรกของแต่ละ environment รัน `bun run movement:setup-workflows` · ขั้นที่ย้อนไม่ได้ของปิดงวด (Start / ส่งใบนับ / Close) ต้องตั้ง `E2E_ALLOW_IRREVERSIBLE=<BU>:<งวด>` · ผลแต่ละ spec ขึ้นชีตของตัวเอง (`*_Doc_Flow`, `Period_Close_*`) ตาม `SYNC_TARGETS`

---

## โครงสร้างผลลัพธ์

```
tests/results/
├── 001-login-results.json
├── 010-department-results.json
└── ...                         # หนึ่งไฟล์ต่อ spec: <spec-basename>-results.json
```

แต่ละไฟล์เป็น array ของ row (`TCResultRow` ใน `tests/reporters/tc-json-reporter.ts`) — Test ID, title, annotation, status, run date, duration, error, screenshot/video

---

## Troubleshooting

### `setup` ค้างไม่มี output

backend ที่ `:4000` ไม่ได้รัน — `curl http://localhost:4000` แล้วเปิด Docker

### Dev server ไม่ start

```bash
lsof -i :3000            # port ถูกใช้อยู่?
```

หรือรัน frontend เองแล้วใช้ `E2E_NO_WEBSERVER=1`

### Login โดน 429

backend rate-limit หลังใส่รหัสผิด 3 ครั้งต่อ email — ใช้ `LoginPage.loginWithRetry` และรอให้ limit หมดอายุ

### Google Sheets sync ไม่ทำงาน

```bash
grep GOOGLE_SHEETS .env.local                  # มีครบ 2 ตัว?
test -f "$GOOGLE_SHEETS_SA_KEY_PATH" && echo ok # key file อยู่จริง?
```

แล้วตรวจว่า spec อยู่ใน `SYNC_TARGETS` (ดูคอลัมน์ Sheet tab ด้านบน)

### Test timeout

```bash
bun run test -- 010-department.spec.ts --timeout=60000
curl -s http://localhost:3000 | head -1
```
