# E2E Tests

Playwright e2e test suite สำหรับ Carmen Blue Frontend
ทดสอบ UI flow จริงผ่าน browser พร้อม custom JSON reporter และ sync ผลลัพธ์เข้า Google Sheets

---

## Quick Start

```bash
# รันทั้งหมด (ใช้ทุก CPU core)
bun e2e --workers=100%

# รันแล้ว sync เข้า Google Sheets
bun e2e --workers=100% && bun e2e:sync

# UI mode (interactive)
bun e2e:ui
```

---

## โครงสร้างไฟล์

```text
e2e/
├── README.md                          # ไฟล์นี้
├── NNN-<module>.spec.ts               # test specs (เรียงตามลำดับรัน, 001-login มาก่อน)
├── test-users.ts                      # email/password ของ test users ทั้ง 6 role
├── fixtures/
│   └── auth.fixture.ts                # createAuthTest(email) → auto login ก่อนทุก test
├── pages/                             # Page Object Models
│   ├── login.page.ts
│   ├── dashboard.page.ts
│   ├── delivery-point.page.ts         # module-specific
│   ├── config-list.page.ts            # generic list page (ใช้ทุก /config/* module)
│   ├── dialog-crud.helper.ts          # helper สำหรับ dialog-based CRUD
│   └── page-form-crud.helper.ts       # helper สำหรับ page-form-based CRUD
├── helpers/
│   └── security-cases.ts              # 4 security test cases รวม (XSS/SQL/maxLen/auth)
├── reporters/
│   └── tc-json-reporter.ts             # custom reporter เขียน JSON ต่อ spec
└── results/                           # JSON output (gitignored ได้)
    ├── 001-login-results.json
    ├── 002-adjustment-type-results.json
    └── ... (NNN-<module>-results.json — matches the spec file prefix)
```

---

## การรัน Test

### รันทั้งหมด

```bash
bun e2e                          # ใช้ workers=1 จาก config
bun e2e --workers=100%           # ใช้ทุก CPU core
bun e2e --workers=4              # กำหนดจำนวน workers
```

### รันทีละ module

```bash
bun e2e tests/003-business-type.spec.ts                 # 1 ไฟล์
bun e2e tests/003-business-type.spec.ts tests/012-tax-profile.spec.ts   # หลายไฟล์
```

### กรองด้วยชื่อ test (regex)

```bash
bun e2e -g "TC-BT00106"             # เฉพาะ TC-BT00106
bun e2e -g "Business Type"       # ทุก test ใน describe นี้
bun e2e -g "TC-BT0[5-8]"         # TC-BT00105..08
bun e2e -g "TCS-.*09"            # security XSS ของทุก module (TCS- prefix)
```

### Flag ที่ใช้บ่อย

| Flag | คำอธิบาย |
|---|---|
| `--workers=100%` | ใช้ CPU core ทั้งหมด |
| `--headed` | เปิด browser ให้เห็น (debug) |
| `--debug` | Playwright Inspector |
| `--reporter=list` | progress รายตัว (อย่าใช้ตัวเดียว — จะ override custom reporter ที่เขียน JSON) |
| `--ui` | UI mode |
| `-g "<regex>"` | กรองด้วยชื่อ test |
| `--project=login` | รันเฉพาะ project login |
| `--project=chromium` | รันเฉพาะ project อื่นๆ (ไม่รวม login) |

> ⚠️ **อย่าใช้ `--reporter=list` เดี่ยวๆ** — Playwright จะใช้แทนที่ reporter ใน config (รวม custom JSON reporter) ผลลัพธ์จะไม่ถูกเขียนไฟล์ ให้เก็บ list ไว้ใน `playwright.config.ts` แทน

---

## โครงสร้าง Test Case

แต่ละ module มี test case 8-12 ตัว ตามรูปแบบ TC-{prefix}{number}

### Smoke (01-04) — ทุก module

| ID | คำอธิบาย |
|---|---|
| `XX01` | หน้า list โหลดสำเร็จ |
| `XX02` | ปุ่ม Add แสดง |
| `XX03` | ช่องค้นหาใช้งานได้ |
| `XX04` | ค้นหาคำที่ไม่มีต้องแสดง empty state |

### CRUD (05-08) — module ที่ทำ full CRUD

| ID | คำอธิบาย |
|---|---|
| `XX05` | บันทึกโดยไม่กรอกข้อมูล required ต้องแสดง error |
| `XX06` | สร้างรายการใหม่และปรากฏในตาราง |
| `XX07` | แก้ไขชื่อและบันทึก |
| `XX08` | ลบรายการ |

### Security (09-12) — ทุก module

| ID | คำอธิบาย |
|---|---|
| `XX09` | XSS payload `<script>alert(...)</script>` ในชื่อหรือช่องค้นหา → ต้องไม่ trigger browser dialog |
| `XX10` | SQL injection `'; DROP TABLE users; --` → list ต้องไม่ crash |
| `XX11` | Max length boundary (200 chars) → ต้องถูก truncate ที่ ≤ 100 |
| `XX12` | Authorization: user สิทธิ์ต่ำ (Requestor) → ต้องไม่เห็น Add หรือถูก redirect |

---

## Test ID Prefix ต่อ Module

| Prefix | Module | Path |
|---|---|---|
| `TC-DP` | Delivery Point | `/config/delivery-point` |
| `TC-L` | Login / Logout | `/login`, `/dashboard` |
| `TC-AT` | Adjustment Type | `/config/adjustment-type` |
| `TC-BT` | Business Type | `/config/business-type` |
| `TC-CNR` | Credit Note Reason | `/config/credit-note-reason` |
| `TC-CT` | Credit Term | `/config/credit-term` |
| `TC-CUR` | Currency | `/config/currency` |
| `TC-DEP` | Department | `/config/department` |
| `TC-ER` | Exchange Rate | `/config/exchange-rate` |
| `TC-EC` | Extra Cost | `/config/extra-cost` |
| `TC-LOC` | Location | `/config/location` |
| `TC-TP` | Tax Profile | `/config/tax-profile` |
| `TC-UN` | Unit | `/config/unit` |

---

## Test Coverage Status

| Module | Smoke | CRUD | Security | หมายเหตุ |
|---|:---:|:---:|:---:|---|
| delivery-point | ✅ | ✅ | — | TC-DP00101..DP49 |
| login | — | ✅ | ✅ | TC-L00101..32 มี XSS/SQL อยู่แล้ว |
| business-type | ✅ | ✅ | ✅ | dialog-based |
| credit-note-reason | ✅ | ✅ | ✅ | dialog (ไม่มี is_active) |
| credit-term | ✅ | ✅ | ✅ | dialog-based |
| currency | ✅ | ✅ | ✅ | dialog-based |
| extra-cost | ✅ | ✅ | ✅ | dialog-based |
| tax-profile | ✅ | ✅ | ✅ | dialog-based |
| adjustment-type | ✅ | ✅ | ✅ | page-form (code+name+is_active) |
| department | ✅ | ✅ | ✅ | page-form |
| location | ✅ | ✅ | ✅ | page-form |
| exchange-rate | ✅ | — | list-only | dialog ซับซ้อน (currency lookup + date) |
| unit | ✅ | — | list-only | UOM groups ซับซ้อน |

---

## เพิ่ม Test Case ใหม่

### 1. Module ใหม่ (dialog-based — name + is_active)

ใช้ `DialogCrudHelper` เป็น template (ดู `e2e/business-type.spec.ts`):

```ts
import { expect } from "@playwright/test";
import { createAuthTest } from "./fixtures/auth.fixture";
import { DialogCrudHelper } from "./pages/dialog-crud.helper";
import { addDialogSecurityCases } from "./helpers/security-cases";
import { buildEntity } from "./helpers/test-data";

const test = createAuthTest("carmensoftware.dev+purchase@gmail.com");
const PATH = "/config/my-module";
const { name: NAME } = buildEntity({ tag: "MM" });

const opts = {
  listPath: PATH,
  nameInputId: "my-module-name",        // อ่านจาก dialog component
  activeSwitchId: "my-module-is-active",
};

test.describe("My Module — Smoke & CRUD", () => {
  test("TC-MM00101 ...", async ({ page }) => { /* ... */ });
  // ... TC-MM00102..08

  addDialogSecurityCases(test, {
    prefix: "MM",
    listPath: PATH,
    makeHelper: (page) => new DialogCrudHelper(page, opts),
  });
});
```

### 2. Module ใหม่ (page-form-based)

ใช้ `PageFormCrudHelper` (ดู `e2e/department.spec.ts`):

```ts
const opts = {
  listPath: PATH,
  codeInputId: "my-module-code",
  nameInputId: "my-module-name",
  activeSwitchId: "my-module-is-active",
};
// แล้วใช้ addPageFormSecurityCases แทน addDialogSecurityCases
```

### 3. เพิ่ม sync target

แก้ `scripts/sync-test-results.ts` เพิ่ม entry ใน `SYNC_TARGETS`:

```ts
{ jsonFile: "NNN-my-module-results.json", sheetTab: "My Module" },
```

(`NNN` คือลำดับ 3 หลักของ spec file เช่น `015-my-module-results.json`)

แล้วสร้าง tab ใน Google Sheet ที่มี header:

```
Seq, Test ID, Title, Preconditions, Steps, Expected Result,
Priority, Test Type, Status, Run Date, Duration (ms), Error, Note
```

Reporter จะเขียนทั้ง 13 คอลัมน์ทุกครั้งที่รัน: `Seq, Test ID, Title, Status, Run Date, Duration (ms), Error` มาจาก runner อัตโนมัติ; `Preconditions, Steps, Expected Result, Priority, Test Type, Note` มาจาก Playwright `annotation` ในไฟล์ spec (ถ้ามี) Sync จะ always-overwrite คอลัมน์ที่มาจาก annotation และ write-once สำหรับ Title/Note

---

## JSON Reporter

Custom reporter อยู่ที่ `tests/reporters/tc-json-reporter.ts` — เขียน 1 ไฟล์ JSON ต่อ spec (array ของ row objects):

- Input: test title ที่มี Test ID เช่น `"TC-BT00106 สร้างรายการใหม่"`
- Regex: `/\b(TC-[A-Z]{0,4}\d{2,})\b/g` — รองรับ prefix 0-4 ตัวอักษร
- Output: `tests/results/{specName}-results.json` (specName includes the NNN- prefix)
- Each file is a JSON array; one object per test case. Row fields:
  `seq, testId, title, preconditions, steps, expected, priority, testType, status, runDate, duration, error, note`
  - Reporter-populated automatically: `seq, testId, title, status, runDate, duration, error`
  - Populated from Playwright `annotation` if present: `preconditions, steps, expected, priority, testType, note`
  - Left blank (`""`) otherwise — sync script fills the Google Sheet cell if the code has a value, preserves manual edits on `note` and `title`.

### Annotating test-case metadata in spec files

Use Playwright's native `annotation` option (3rd arg of `test()`):

```ts
test(
  "TC-L00114 แสดง error เมื่อไม่กรอกรหัสผ่าน",
  {
    annotation: [
      { type: "preconditions", description: "Logged out; on /login" },
      { type: "steps", description: "1. เปิด /login\n2. กรอกเฉพาะ email\n3. กด Sign In" },
      { type: "expected", description: "Stay on /login; no dashboard redirect" },
      { type: "priority", description: "Medium" },
      { type: "testType", description: "Validation" },
      // { type: "note", description: "..." },   // optional
    ],
  },
  async ({ page }) => { /* test body */ },
);
```

Accepted annotation `type` values (case-insensitive): `preconditions`, `steps`, `expected` (or `expectedResult`), `priority`, `testType`, `note`. Multiple annotations of the same type are joined with newlines. Unannotated tests leave the cells blank — the sync script preserves whatever is manually entered in the sheet.

ตั้งใน `playwright.config.ts`:
```ts
reporter: [
  ["list"],
  ["html"],
  ["./tests/reporters/tc-json-reporter.ts", { outputDir: "tests/results" }],
],
```

---

## Google Sheets Sync

Script: `scripts/sync-test-results.ts` รันด้วย `bun e2e:sync`

### Setup (ครั้งเดียว)

1. **Google Cloud Console** → สร้าง project → enable **Google Sheets API**
2. **IAM → Service Accounts** → สร้าง service account → download JSON key
3. **Open Spreadsheet** → Share → เพิ่ม service account email (`xxx@xxx.iam.gserviceaccount.com`) ด้วยสิทธิ์ **Editor**
4. ตั้ง env vars ใน `.env.local`:
   ```env
   GOOGLE_SHEETS_SA_KEY_PATH=/Users/you/secrets/sa-key.json
   GOOGLE_SHEETS_SPREADSHEET_ID=1eLuXtc-UxkgCCgImw2SI2XAX32LlPT3UHfxIpzmFoLc
   ```
5. สร้าง tab ในสเปรดชีตสำหรับแต่ละ module พร้อม header row

### Behavior

- อ่านทุก `NNN-<module>-results.json` ใน `tests/results/` ตาม `SYNC_TARGETS`
- จับคู่ `testId` กับแถวในแต่ละ tab → always-overwrite สำหรับ `Status`, `Run Date`, `Duration (ms)`, `Error`, `Seq`, และคอลัมน์ metadata ที่มาจาก annotation (`Preconditions`, `Steps`, `Expected Result`, `Priority`, `Test Type`)
- **Title / Note**: write-once — เขียนเฉพาะเมื่อ cell เดิมว่างเปล่า (ป้องกันทับคำอธิบายที่เขียนเอง)
- ถ้าไม่เจอ `testId` ในชีต → **append row ใหม่** อัตโนมัติพร้อมข้อมูลครบทั้ง 13 คอลัมน์
- ถ้า tab ว่างเปล่า → bootstrap header canonical
- ถ้า tab มี header แต่ขาดบางคอลัมน์ → append คอลัมน์ที่ขาดต่อท้าย header (ไม่ย้าย/ลบ column เดิม)
- ถ้าไม่มี tab → ข้าม + แจ้งใน console (ไม่ crash)

### Output ตัวอย่าง

```
[Login] updated 32 rows
[Delivery Point] updated 37 rows, appended 12 new rows
[Adjustment Type] skipped — Unable to parse range: Adjustment Type!A1:Z
Done.
```

---

## Test Users

จาก `e2e/test-users.ts`:

| Role | Email | Password |
|---|---|---|
| Requestor | `carmensoftware.dev+requestor@gmail.com` | `12345678` |
| HOD | `carmensoftware.dev+hod@gmail.com` | `12345678` |
| Purchase | `carmensoftware.dev+purchase@gmail.com` | `12345678` |
| FC | `carmensoftware.dev+fc@gmail.com` | `12345678` |
| GM | `carmensoftware.dev+gm@gmail.com` | `12345678` |
| Owner | `carmensoftware.dev+owner@gmail.com` | `12345678` |

- **Default ของ config tests:** `carmensoftware.dev+purchase@gmail.com` (มีสิทธิ์ admin config)
- **Authorization tests (TC-XX00112):** `carmensoftware.dev+requestor@gmail.com` (สิทธิ์ต่ำ)

---

## Reports

```bash
bun e2e:report                  # เปิด HTML report ของรอบล่าสุด
```

HTML report อยู่ที่ `playwright-report/` (เปิดผ่าน `bun e2e:report` หรือเปิด `index.html` ตรงๆ)

---

## Troubleshooting

### Test ทั้งหมดถูก skip / รันไม่ครบ
- เช็ค `playwright.config.ts` ว่ามี `dependencies: ["login"]` หรือไม่ — ถ้า login project fail ตัวใดตัวหนึ่งจะ skip downstream ทั้งหมด ให้เอา dependency ออก

### JSON ไม่ถูกเขียน
- เช็คว่าใช้ `--reporter=list` บน CLI หรือไม่ → จะ override reporter ใน config ลบ flag ออก หรือใส่ reporter ครบ: `--reporter=list,html,./tests/reporters/tc-json-reporter.ts`

### Sync error: `Unable to parse range: <Tab>!A1:Z`
- Tab ไม่มีในสเปรดชีต — สร้างเองพร้อม header row

### Test ID ไม่ถูกจับโดย reporter
- เช็คว่า test title ขึ้นต้นด้วย `TC-` ตามด้วยตัวอักษร 0-4 ตัวและตัวเลข ≥ 2 หลัก เช่น `TC-L00101`, `TC-DP00101`, `TC-CNR00112`

### Authorization test (XX12) fail
- บาง module อาจเปิดให้ Requestor เข้าได้ → ปรับ assertion ใน `e2e/helpers/security-cases.ts` ตามจริง

### Form field id ไม่ตรง
- เปิดไฟล์ `app/(root)/config/{module}/_components/{module}-{dialog|form}.tsx` แล้ว grep `id="..."` เพื่อหา id จริง

---

## Best Practices

- **ใช้ unique name ต่อ test:** สร้างข้อมูลผ่าน `tests/helpers/test-data.ts` (`buildEntity` / `fakeCode` / `fakeName` / `fakeDescription`) — ห่อ faker + UID suffix (`Date.now().toString(36)`) ให้ได้ชื่อสมจริงและ unique ข้ามรอบรันในที่เดียว
- **ตั้ง timeout เผื่อ network:** `{ timeout: 10_000 }` ใน `expect().toBeVisible()`
- **อย่า mock backend:** e2e เรียก API จริง — ถ้าต้อง isolate ใช้ unit test แทน
- **Cleanup test data:** สร้าง fixture cleanup ที่ลบรายการที่สร้างไว้ตอน teardown
- **อย่าใช้ `test.describe.configure({ mode: "serial" })`** — ถ้า test ใด fail ตัวที่เหลือจะ skip ทั้งหมด
