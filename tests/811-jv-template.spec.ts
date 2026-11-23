import { expect } from "@playwright/test";
import { createAuthTest } from "./fixtures/auth.fixture";
import { buSend } from "./helpers/bu-api";
import { accountId, assertAccountingReady, CREATOR, listAllRows, today } from "./helpers/gl-api";
import { expectBalanced, round } from "./helpers/money";
import { expectSaved } from "./helpers/settle";
import { uid } from "./helpers/test-data";

// ─────────────────────────────────────────────────────────────────────────
// JV templates on the TEST BU (GR2VYNKQ): template / recurring / allocation lists, a JV generated from a template, and
// the allocation split.
//
// Read set (never mutated): E2E-JVT-1, an active recurring template (Dr 5300 250.00 / Cr 1110 250.00, period = the
// month of the reset). A template can generate once per period (GL_JV_TEMPLATE_ALREADY_RUN), so generating from
// E2E-JVT-1 would both change the read set and fail on a re-run: the generating cases create their own tagged template,
// clone E2E-JVT-1's lines for the recurring one, and delete the template in `finally` (the draft JV it made stays, tagged
// in its description).
//
// Scope note: `POST /gl-jv-templates/:id/generate` runs on demand and is covered. The scheduled path (recurring
// `post_at`, the BU-wide `generate-all-due`) is out of scope: `generate-all-due` would run every due template of the BU
// including the read set, and a scheduler cannot be driven on demand.
// Allocation: `allocation_ratio` is a fraction (0.3333 = 33.33%, 4 decimals); each debit/credit line = allocate_amount x ratio
// rounded half-up to the BU decimals (assumption: oracle general-ledger-journal-voucher-design.md does not cover the allocation
// template split).
// ─────────────────────────────────────────────────────────────────────────
const test = createAuthTest("carmensoftware.dev+admin@gmail.com");
test.describe.configure({ timeout: 120_000 });

const code = (key: string) => `E2E-T-811-${key}-${uid}`;
const SEED = "E2E-JVT-1";
const BUG_LIST = "docs/superpowers/specs/2026-11-23-e2e-phase-2a-bug-list.md";

type Row = Record<string, any>;

async function readSetTemplate(): Promise<Row> {
  const head = (await listAllRows(CREATOR, "/gl-jv-templates")).find((t) => t.code === SEED);
  if (!head) throw new Error(`no ${SEED} on the TEST BU - run \`bun run data:reset --yes\``);
  const r = await buSend(CREATOR, "GET", `/gl-jv-templates/${head.id}`);
  expect(r.status).toBe(200);
  return r.body.data as Row;
}

/** The GL period of the current month (the one E2E-JVT-1's range covers). */
async function currentPeriod(): Promise<Row> {
  const [y, m] = today().split("-").map(Number);
  const p = (await listAllRows(CREATOR, "/gl-periods", true)).find((x) => x.fiscal_year === y && x.period_no === m);
  if (!p) throw new Error(`no GL period ${y}/${m} on the TEST BU - run data:reset`);
  expect(p.status).toBe("open");
  return p;
}

async function prefixId(): Promise<string> {
  const p = (await listAllRows(CREATOR, "/gl-jv-prefixes", true)).find((x) => x.code === "JV");
  if (!p) throw new Error("no JV prefix on the TEST BU - run data:reset");
  return String(p.id);
}

/** Create a template for the current period, run `fn`, then delete the template (also when `fn` throws). */
async function withTemplate<T>(
  type: "recurring" | "allocation",
  key: string,
  lines: Row[],
  extra: Row,
  fn: (t: { id: string; code: string; period: Row }) => Promise<T>,
): Promise<T> {
  const period = await currentPeriod();
  const c = code(key);
  const r = await buSend(CREATOR, "POST", "/gl-jv-templates", {
    template_type: type,
    code: c,
    name: c,
    is_active: true,
    prefix_id: await prefixId(),
    from_fiscal_year: period.fiscal_year,
    from_period_no: period.period_no,
    to_fiscal_year: period.fiscal_year,
    to_period_no: period.period_no,
    ...(type === "recurring" ? { frequency_months: 1 } : {}),
    ...extra,
    details: { add: lines.map((l, i) => ({ sequence_no: i + 1, ...l })) },
  });
  expect(r.status, JSON.stringify(r.body?.message ?? r.body)).toBeLessThan(300);
  const id = String(r.body.data.id);
  let failed = false;
  let original: unknown;
  let result!: T;
  try {
    result = await fn({ id, code: c, period });
  } catch (e) {
    failed = true;
    original = e;
  }
  // The cleanup must succeed (a leftover template shows in the lists other cases count); it never hides the case's own failure.
  const del = await buSend(CREATOR, "DELETE", `/gl-jv-templates/${id}`);
  if (del.status >= 300) {
    const msg = `811 cleanup: DELETE /gl-jv-templates/${id} -> ${del.status}; template ${c} was NOT removed`;
    if (!failed) throw new Error(msg);
    console.error(msg);
  }
  if (failed) throw original;
  return result;
}

async function generate(templateId: string, periodId: string) {
  return buSend(CREATOR, "POST", `/gl-jv-templates/${templateId}/generate`, { gl_period_id: periodId });
}

async function jvLines(jvId: string): Promise<{ account: string; dr: number; cr: number }[]> {
  const r = await buSend(CREATOR, "GET", `/gl-jv/${jvId}`);
  expect(r.status).toBe(200);
  return (r.body.data.tb_gl_jv_detail as Row[]).map((l) => ({ account: String(l.account_code), dr: Number(l.debit), cr: Number(l.credit) }));
}

test.describe("JV templates (811)", () => {
  test.beforeAll(async () => {
    await assertAccountingReady();
  });

  // ── 01 lists ───────────────────────────────────────────────────────────
  test(
    "TC-JVT-010001 รายการ Template Voucher แสดง read-set E2E-JVT-1: ชนิด Recurring และ Active",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; read-set E2E-JVT-1 (recurring, active) บน TEST BU" },
        { type: "steps", description: "1. เปิดหน้า Template Voucher (/accounting/template-voucher)\n2. ค้นหา E2E-JVT-1\n3. อ่านแถว" },
        { type: "expected", description: "พบแถว E2E-JVT-1 เพียงแถวเดียว ชนิด Recurring สถานะ Active" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      await page.goto("/accounting/template-voucher");
      await expect(page.getByRole("heading", { name: "JV Templates", level: 1 })).toBeVisible();
      await page.getByPlaceholder("Search...").fill(SEED);
      await page.getByPlaceholder("Search...").press("Enter");
      const row = page.getByRole("row").filter({ hasText: SEED });
      await expect(row).toHaveCount(1);
      await expect(row).toContainText("Recurring");
      await expect(row).toContainText(/active/i);
    },
  );

  test(
    "TC-JVT-010002 รายการ Recurring Voucher แสดง E2E-JVT-1 และหน้ารายละเอียดแสดงบรรทัด Dr 5300 250.00 / Cr 1110 250.00",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; read-set E2E-JVT-1" },
        { type: "steps", description: "1. เปิดหน้า Recurring Voucher ค้นหา E2E-JVT-1\n2. เปิดรายละเอียด\n3. อ่านบรรทัดผ่าน API (ยอดเทียบ oracle ที่ seed)" },
        {
          type: "expected",
          description: "พบแถว E2E-JVT-1; หน้ารายละเอียดแสดงรหัส E2E-JVT-1; API: 2 บรรทัด Dr 250.00 และ Cr 250.00 สมดุล คนละบัญชี (5300 / 1110)",
        },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const t = await readSetTemplate();
      expect(t.template_type).toBe("recurring");
      expect(t.is_active).toBe(true);
      const lines = (t.tb_gl_jv_template_detail as Row[]).map((l) => ({ dr: Number(l.debit ?? 0), cr: Number(l.credit ?? 0) }));
      expect(lines).toEqual([{ dr: 250, cr: 0 }, { dr: 0, cr: 250 }]);
      expectBalanced(lines);
      await page.goto("/accounting/recurring-voucher");
      await page.getByPlaceholder("Search...").fill(SEED);
      await page.getByPlaceholder("Search...").press("Enter");
      const row = page.getByRole("row").filter({ hasText: SEED });
      await expect(row).toHaveCount(1);
      await row.getByRole("button", { name: SEED }).click();
      await expect(page).toHaveURL(new RegExp(`/recurring-voucher/${t.id}$`));
      await expect(page.getByText(SEED).first()).toBeVisible();
    },
  );

  test(
    "TC-JVT-010003 รายการ Allocation Voucher โหลดได้ แสดง allocation template ของเทสต์เอง และไม่แสดง E2E-JVT-1 (recurring)",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; allocation template ของเทสต์เอง 1 รายการ (50% / 50% ของ 100.00); read-set E2E-JVT-1 เป็น recurring" },
        { type: "steps", description: "1. เปิดหน้า Allocation Voucher ค้นหา tag ของ template\n2. ค้นหา E2E-JVT-1" },
        { type: "expected", description: "พบแถว template ของเทสต์เอง (ยอดแบ่ง 100.00); ค้นหา E2E-JVT-1 ไม่พบแถว (ชนิดไม่ตรงกับหน้านี้)" },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const lines = [
        { chart_of_accounts_id: await accountId("5300"), side: "debit", allocation_ratio: 0.5, description: "a" },
        { chart_of_accounts_id: await accountId("5100"), side: "debit", allocation_ratio: 0.5, description: "b" },
        { chart_of_accounts_id: await accountId("1110"), side: "credit", allocation_ratio: 1, description: "c" },
      ];
      await withTemplate("allocation", "list", lines, { allocate_amount: 100 }, async (t) => {
        await page.goto("/accounting/allocation-voucher");
        await expect(page.getByRole("heading", { name: "Allocation Vouchers", level: 1 })).toBeVisible();
        const search = page.getByPlaceholder("Search...");
        await search.fill(t.code);
        await search.press("Enter");
        const row = page.getByRole("row").filter({ hasText: t.code });
        await expect(row).toHaveCount(1);
        await expect(row).toContainText("100.00");
        await search.fill(SEED);
        await search.press("Enter");
        await expect(page.getByRole("row").filter({ hasText: SEED })).toHaveCount(0);
      });
    },
  );

  // ── 02 generate a JV from a recurring template ─────────────────────────
  test(
    "TC-JVT-020001 สร้าง JV จาก recurring template (บรรทัดคัดลอกจาก E2E-JVT-1) ผ่านหน้า UI: ได้ JV draft ที่คัดลอกบรรทัดครบและสมดุล",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; template ของเทสต์เอง recurring ช่วงงวดปัจจุบัน บรรทัดคัดลอกจาก E2E-JVT-1 (Dr 5300 250.00 / Cr 1110 250.00); งวดปัจจุบันเปิด" },
        { type: "steps", description: "1. เปิดหน้ารายละเอียด template กด Generate JV\n2. เลือกงวดปัจจุบัน กด Run\n3. อ่าน JV ที่สร้างผ่าน API" },
        {
          type: "expected",
          description:
            "toast 'Created draft <jv_no>'; JV สถานะ draft และผลตอบ generate ระบุงวดปัจจุบัน บรรทัดเท่ากับบรรทัดของ E2E-JVT-1 ทุกบรรทัด (5300 Dr 250.00 / 1110 Cr 250.00) และสมดุล; read-set E2E-JVT-1 ไม่ถูกแก้ (ยังไม่เคยถูก generate โดยเทสต์นี้)",
        },
        { type: "priority", description: "Critical" },
        { type: "testType", description: "Functional" },
      ],
    },
    async ({ page }) => {
      const seed = await readSetTemplate();
      const seedLines = (seed.tb_gl_jv_template_detail as Row[]).map((l) => ({
        chart_of_accounts_id: String(l.chart_of_accounts_id),
        debit: Number(l.debit ?? 0),
        credit: Number(l.credit ?? 0),
        description: `${code("clone")} ${l.sequence_no}`,
      }));
      expect(seedLines).toHaveLength(2);
      await withTemplate("recurring", "gen", seedLines, {}, async (t) => {
        await page.goto(`/accounting/recurring-voucher/${t.id}`);
        await page.getByRole("button", { name: "Generate JV" }).click();
        const dlg = page.getByRole("dialog", { name: "Generate JV" });
        await expect(dlg).toBeVisible();
        await dlg.getByRole("combobox").click();
        await page.getByRole("option", { name: `${t.period.fiscal_year}/${String(t.period.period_no).padStart(2, "0")}` }).click();
        const res = await expectSaved(page, /\/generate$/, () => dlg.getByRole("button", { name: "Run" }).click(), page.locator("[data-sonner-toast]").filter({ hasText: /created draft/i }));
        const out = (await res.json()).data as Row;
        const jv = (await buSend(CREATOR, "GET", `/gl-jv/${out.jv_id}`)).body.data as Row;
        expect(jv.jv_status).toBe("draft");
        expect(out.gl_period_id).toBe(t.period.id);
        const lines = await jvLines(String(out.jv_id));
        expect(lines).toEqual([
          { account: "5300", dr: 250, cr: 0 },
          { account: "1110", dr: 0, cr: 250 },
        ]);
        expectBalanced(lines);
        expect(Number(out.amount_total)).toBe(250);
      });
      // the read-set template is untouched and still active
      const after = await readSetTemplate();
      expect(after.is_active).toBe(true);
      expect(after.doc_version).toBe(seed.doc_version);
    },
  );

  test(
    "TC-JVT-020002 Generate template เดิมซ้ำในงวดเดียวกัน: ถูกปฏิเสธ 409 GL_JV_TEMPLATE_ALREADY_RUN และไม่มี JV ใบที่สอง",
    {
      annotation: [
        { type: "preconditions", description: "template recurring ของเทสต์เอง ที่ generate แล้ว 1 ครั้งในงวดปัจจุบัน" },
        { type: "steps", description: "1. Generate ครั้งแรก\n2. Generate อีกครั้งในงวดเดียวกัน\n3. นับ JV ที่มี tag ของ template" },
        {
          type: "expected",
          description: "ครั้งที่สองได้ 409 รหัส GL_JV_TEMPLATE_ALREADY_RUN; มี JV เพียงใบเดียวที่คำอธิบายตรงกับ template. assumption: oracle ไม่ระบุ; ยืนยันพฤติกรรม idempotent ต่องวดของ BE",
        },
        { type: "priority", description: "Medium" },
        { type: "testType", description: "Negative" },
      ],
    },
    async () => {
      const lines = [
        { chart_of_accounts_id: await accountId("5300"), debit: 80, credit: 0, description: "x" },
        { chart_of_accounts_id: await accountId("1110"), debit: 0, credit: 80, description: "y" },
      ];
      await withTemplate("recurring", "twice", lines, {}, async (t) => {
        const first = await generate(t.id, String(t.period.id));
        expect(first.status).toBeLessThan(300);
        const again = await generate(t.id, String(t.period.id));
        expect(again.status).toBe(409);
        expect(again.body?.error?.code).toBe("GL_JV_TEMPLATE_ALREADY_RUN");
        const mine = (await listAllRows(CREATOR, `/gl-jv?search=${encodeURIComponent(t.code)}`)).filter((j) => String(j.description).includes(t.code));
        expect(mine).toHaveLength(1);
      });
    },
  );

  // ── 03 allocation split ────────────────────────────────────────────────
  test(
    "TC-JVT-030001 Allocation template แบ่ง 1,000.00 ตามสัดส่วน 25% / 75%: บรรทัด Dr เท่า allocate x ratio และ Cr เท่ายอดรวม",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; allocation template ของเทสต์เอง allocate_amount 1,000.00, Dr 5300 ratio 0.25, Dr 5100 ratio 0.75, Cr 1110 ratio 1.0" },
        { type: "steps", description: "1. Generate JV งวดปัจจุบัน\n2. อ่านบรรทัดของ JV ที่สร้าง" },
        {
          type: "expected",
          description:
            "ค่าที่คาดคำนวณด้วย money.round จากสัดส่วน (ไม่ใช้ค่าที่ BE ตอบ): Dr 5300 = 250.00, Dr 5100 = 750.00, Cr 1110 = 1,000.00; ผลรวม Dr = Cr สมดุล JV เป็น draft. assumption: oracle ไม่ครอบคลุมการแบ่งของ allocation template; ใช้ allocate x ratio ปัดครึ่งขึ้นที่ 2 ตำแหน่งของ BU",
        },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async () => {
      const amount = 1000;
      const exp1 = round(amount * 0.25, 2);
      const exp2 = round(amount * 0.75, 2);
      expect([exp1, exp2]).toEqual([250, 750]);
      const lines = [
        { chart_of_accounts_id: await accountId("5300"), side: "debit", allocation_ratio: 0.25, description: "alloc a" },
        { chart_of_accounts_id: await accountId("5100"), side: "debit", allocation_ratio: 0.75, description: "alloc b" },
        { chart_of_accounts_id: await accountId("1110"), side: "credit", allocation_ratio: 1, description: "alloc c" },
      ];
      await withTemplate("allocation", "split", lines, { allocate_amount: amount }, async (t) => {
        const g = await generate(t.id, String(t.period.id));
        expect(g.status, JSON.stringify(g.body)).toBeLessThan(300);
        const jvId = String(g.body.data.jv_id);
        expect(Number(g.body.data.amount_total)).toBe(amount);
        const got = await jvLines(jvId);
        expect(got).toEqual([
          { account: "5300", dr: exp1, cr: 0 },
          { account: "5100", dr: exp2, cr: 0 },
          { account: "1110", dr: 0, cr: amount },
        ]);
        expectBalanced(got);
        expect(((await buSend(CREATOR, "GET", `/gl-jv/${jvId}`)).body.data as Row).jv_status).toBe("draft");
      });
    },
  );

  test(
    "TC-JVT-030002 Allocation template แบ่ง 1,000.01 ตามสัดส่วน 33.33% / 66.67%: แต่ละบรรทัดต้องปัดครึ่งขึ้นที่ 2 ตำแหน่ง (BE เก็บ 5 ตำแหน่ง)",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; allocation template ของเทสต์เอง allocate_amount 1,000.01, Dr 5300 ratio 0.3333, Dr 5100 ratio 0.6667, Cr 1110 ratio 1.0" },
        { type: "steps", description: "1. Generate JV งวดปัจจุบัน\n2. อ่านบรรทัดของ JV ที่สร้าง" },
        {
          type: "expected",
          description:
            "ค่าที่คาดคำนวณด้วย money.round: Dr 5300 = round(1000.01 x 0.3333, 2) = 333.30, Dr 5100 = round(1000.01 x 0.6667, 2) = 666.71, Cr 1110 = 1,000.01; Dr = Cr สมดุล. rule: HALF_UP ต่อบรรทัด journal ที่ decimal_places ของสกุลเงินหลัก (accounting-foundation.md:103,120). pinned: BE เก็บ 333.30333 และ 666.70667 (ไม่ปัด)",
        },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async () => {
      const amount = 1000.01;
      const exp1 = round(amount * 0.3333, 2);
      const exp2 = round(amount * 0.6667, 2);
      expect([exp1, exp2]).toEqual([333.3, 666.71]);
      const lines = [
        { chart_of_accounts_id: await accountId("5300"), side: "debit", allocation_ratio: 0.3333, description: "alloc a" },
        { chart_of_accounts_id: await accountId("5100"), side: "debit", allocation_ratio: 0.6667, description: "alloc b" },
        { chart_of_accounts_id: await accountId("1110"), side: "credit", allocation_ratio: 1, description: "alloc c" },
      ];
      await withTemplate("allocation", "round", lines, { allocate_amount: amount }, async (t) => {
        const g = await generate(t.id, String(t.period.id));
        expect(g.status, JSON.stringify(g.body)).toBeLessThan(300);
        const got = await jvLines(String(g.body.data.jv_id));
        expect(got, "generated JV lines were not read back from the BE").toHaveLength(3);
        test.fail(true, `suspected bug: the allocation split is stored unrounded (333.30333 / 666.70667), the foundation rule is HALF_UP per line at 2 decimals. See ${BUG_LIST}`);
        expect(got).toEqual([
          { account: "5300", dr: exp1, cr: 0 },
          { account: "5100", dr: exp2, cr: 0 },
          { account: "1110", dr: 0, cr: amount },
        ]);
      });
    },
  );
});
