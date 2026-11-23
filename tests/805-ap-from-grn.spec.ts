import { expect } from "@playwright/test";
import { createAuthTest } from "./fixtures/auth.fixture";
import { buConfigSend, buSend } from "./helpers/bu-api";
import { getApDoc } from "./helpers/ap-api";
import { assertAccountingReady, CREATOR, jvOfSource, listAllRows, withGlSetting, type JvLine } from "./helpers/gl-api";
import { commitGrn, createDraftGrn, deleteGrnsByPrefix, type GrnRecord } from "./helpers/grn-api";
import { expectBalanced, lineAmounts, round } from "./helpers/money";
import { uid } from "./helpers/test-data";

// ─────────────────────────────────────────────────────────────────────────
// GRN -> AP invoice auto-creation on the TEST BU (BU-GR2VYNKQ), switch `gl_setting.ap_auto_from_grn`.
//
// Every case clones the seeded draft GRN (2 lines x 3 @ 100.00, AP post type, no tax), saves and commits it. A commit moves
// stock, which is allowed here (TEST BU only; data:reset wipes it). With the switch on the BE raises and posts a `grn_auto`
// invoice in the commit's own transaction (mb ap-invoice.service.ts createAndPostFromGrnInTx); its debit accounts come from the
// product / item-group `inventory` account mapping, which data:reset does not seed - `beforeAll` maps the GRN products' item
// groups to 1140 when they are unmapped and `afterAll` takes that mapping out again. Expected amounts come from money.ts over
// the GRN inputs the spec created, expected accounts from the mapping API (configuration), never from the AP document under test.
// Each case runs inside `withGlSetting`, which restores the setting even when the case throws; the last case reads it back.
// Every GRN carries `E2E-T-805-<case>-<uid>` as its invoice number, so the spec re-runs without a reset.
// ─────────────────────────────────────────────────────────────────────────
const test = createAuthTest("carmensoftware.dev+admin@gmail.com");
test.describe.configure({ timeout: 120_000 });

const PREFIX = `E2E-T-805-`;
const tag = (key: string) => `${PREFIX}${key}-${uid}`;
const QTY = 3;
const INVENTORY = "1140";

/** Mappings this run added (to remove in afterAll); a mapping that already existed is left alone. */
const added: { groupId: string; mappingId: string }[] = [];

async function itemGroupOf(productId: string): Promise<string> {
  const r = await buConfigSend(CREATOR, "GET", `/products/${productId}`);
  const id = r.body?.data?.product_item_group?.id;
  if (r.status !== 200 || !id) throw new Error(`GET product ${productId} -> ${r.status}: no item group`);
  return String(id);
}

async function groupMapping(groupId: string) {
  const r = await buConfigSend(CREATOR, "GET", `/product-item-groups/${groupId}`);
  if (r.status !== 200) throw new Error(`GET product-item-groups/${groupId} -> ${r.status}`);
  const rows = (r.body?.data?.account_codes ?? []) as { id: string; account_type: string; account_code: string }[];
  return { version: Number(r.body.data.doc_version), inventory: rows.find((a) => a.account_type === "inventory") };
}

/** Make sure the item group of every GRN line has an inventory mapping. Data precondition, restored in afterAll. */
async function ensureMappings(grn: GrnRecord): Promise<void> {
  for (const l of grn.good_received_note_detail) {
    const groupId = await itemGroupOf(l.product.id);
    const cur = await groupMapping(groupId);
    if (cur.inventory) continue;
    const put = await buConfigSend(CREATOR, "PUT", `/product-item-groups/${groupId}`, {
      doc_version: cur.version,
      cascade_deviation: false,
      account_codes: { add: [{ account_type: "inventory", account_code: INVENTORY }] },
    });
    if (put.status !== 200) throw new Error(`precondition: no inventory account mapping on item group ${groupId} and mapping it to ${INVENTORY} failed (PUT -> ${put.status}) - GRN-auto invoices cannot be raised without it`);
    const after = await groupMapping(groupId);
    if (!after.inventory) throw new Error(`precondition: item group ${groupId} still has no inventory mapping after the PUT`);
    added.push({ groupId, mappingId: after.inventory.id });
  }
}

/** The inventory account code the mapping API gives each GRN line (configuration read, product mapping is absent on the seed). */
async function mappedAccounts(grn: GrnRecord): Promise<string[]> {
  const out: string[] = [];
  for (const l of grn.good_received_note_detail) {
    const m = (await groupMapping(await itemGroupOf(l.product.id))).inventory;
    if (!m) throw new Error(`no inventory mapping for ${l.product.code}`);
    out.push(m.account_code);
  }
  return out;
}

/** What the GRN lines the spec created must invoice, per the BU's money rule (no tax on the seeded lines). */
function expectedLines(grn: GrnRecord) {
  return grn.good_received_note_detail.map((l) => lineAmounts({ qty: l.items[0].received_qty, price: l.items[0].received_price, vat: false }));
}

const sumBy = (lines: JvLine[], account: string, side: "dr" | "cr") => round(lines.filter((l) => l.account === account).reduce((s, l) => s + l[side], 0), 4);

async function apControlAccount(): Promise<string> {
  const s = await buConfigSend(CREATOR, "GET", "/app-config/gl_setting");
  const id = String(s.body?.data?.value?.ap_control_account_id ?? "");
  const hit = (await listAllRows(CREATOR, "/chart-of-accounts", true)).find((a) => String(a.id) === id);
  if (!hit) throw new Error(`gl_setting.ap_control_account_id (${id}) is not a COA account - run data:reset`);
  return String(hit.code);
}

async function switchValue(): Promise<unknown> {
  const r = await buConfigSend(CREATOR, "GET", "/app-config/gl_setting");
  if (r.status !== 200) throw new Error(`GET gl_setting -> ${r.status}`);
  return r.body?.data?.value?.ap_auto_from_grn;
}

/** The GRN detail with the invoices raised for it (live and voided). */
async function grnInvoices(id: string) {
  const r = await buSend("Purchase", "GET", `/good-received-notes/${id}`);
  if (r.status !== 200) throw new Error(`GET GRN ${id} -> ${r.status}`);
  return {
    status: String(r.body.data.doc_status),
    version: Number(r.body.data.doc_version),
    live: (r.body.data.ap_invoices ?? []) as { id: string; doc_status: string; doc_source: string; void_gl_jv_id: string | null }[],
    voided: (r.body.data.ap_invoices_voided ?? []) as { id: string; doc_status: string; doc_source: string; void_gl_jv_id: string | null }[],
  };
}

async function rawInvoice(id: string) {
  const r = await buSend(CREATOR, "GET", `/ap-invoice/${id}`);
  if (r.status !== 200) throw new Error(`GET ap-invoice ${id} -> ${r.status}`);
  return r.body.data as { doc_source: string; doc_status: string; vendor_invoice_no: string; doc_type: string };
}

/** A fresh saved-and-committed GRN, the inputs the spec set, and its mapped accounts. */
async function newGrn(key: string) {
  const grn = await createDraftGrn(tag(key), { qty: QTY });
  await ensureMappings(grn);
  return grn;
}

test.describe("AP invoice from GRN (805)", () => {
  test.beforeAll(async () => {
    await assertAccountingReady();
    await deleteGrnsByPrefix(PREFIX);
  });

  test.afterAll(async () => {
    // a draft / saved GRN a failed case left behind is removed, the mapping this run added is taken out (every removal is
    // attempted; a failed one is reported at the end so the mapping never stays on the TEST BU silently)
    await deleteGrnsByPrefix(PREFIX);
    const failures: string[] = [];
    for (const m of added.splice(0)) {
      const cur = await groupMapping(m.groupId);
      const del = await buConfigSend(CREATOR, "PUT", `/product-item-groups/${m.groupId}`, {
        doc_version: cur.version,
        cascade_deviation: false,
        account_codes: { remove: [{ id: m.mappingId }] },
      });
      if (del.status < 200 || del.status >= 300) failures.push(`item group ${m.groupId} mapping ${m.mappingId} -> PUT ${del.status}`);
    }
    if (failures.length) throw new Error(`805 cleanup: inventory mapping NOT removed: ${failures.join("; ")}`);
  });

  test(
    "TC-APGRN-010001 สวิตช์เปิด: Commit GRN แล้วได้ AP invoice grn_auto ยอดเท่าบรรทัด GRN และ JV Dr ตามบัญชีของหมวดสินค้า",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; TEST BU; GL period และ inventory period เปิดครอบวันนี้; gl_setting.ap_auto_from_grn เปิดเฉพาะในเคสนี้; กลุ่มสินค้าของสินค้าใน GRN มี mapping บัญชี inventory (ตั้ง 1140 ใน beforeAll ถ้ายังไม่มี)" },
        { type: "steps", description: "1. สร้าง GRN draft 2 บรรทัด x 3 @ 100.00 (AP, ไม่มีภาษี)\n2. เปิดสวิตช์ ap_auto_from_grn\n3. Save แล้ว Commit GRN\n4. อ่าน AP invoice ของ GRN และ JV ของมัน" },
        {
          type: "expected",
          description:
            "GRN เป็น committed; มี AP invoice 1 ใบ doc_source grn_auto, doc_type invoice, สถานะ posted, net = total = 600.00 VAT 0.00 ค้าง 600.00 (3 x 100.00 สองบรรทัด จาก money.ts); JV สมดุล posted; Dr แต่ละบัญชี = ยอดบรรทัดที่ผูกกับบัญชี inventory ของหมวดสินค้าตาม mapping API (300.00 ต่อบรรทัด); Cr 2100 เจ้าหนี้ = 600.00. assumption: ยอด AP = ยอดบรรทัด GRN ที่ไม่มีภาษีและส่วนลด ปัดครึ่งขึ้นที่ 2 ตำแหน่ง",
        },
        { type: "priority", description: "High" },
        { type: "testType", description: "Happy Path" },
      ],
    },
    async () => {
      const grn = await newGrn("on");
      const lines = expectedLines(grn);
      const total = round(lines.reduce((s, l) => s + l.total, 0), 2);
      expect(lines.map((l) => l.total)).toEqual([300, 300]);
      expect(total).toBe(600);
      const accounts = await mappedAccounts(grn);
      const control = await apControlAccount();

      await withGlSetting({ ap_auto_from_grn: true }, async () => {
        const res = await commitGrn(grn.id);
        expect(res.status).toBe(200);
      });

      const seen = await grnInvoices(grn.id);
      expect(seen.status).toBe("committed");
      expect(seen.live).toHaveLength(1);
      const inv = seen.live[0];
      const raw = await rawInvoice(inv.id);
      expect(raw.doc_source).toBe("grn_auto");
      expect(raw.doc_type).toBe("invoice");
      expect(raw.vendor_invoice_no).toBe(tag("on"));
      const doc = await getApDoc(inv.id);
      expect(doc.status).toBe("posted");
      expect({ net: doc.net, vat: doc.vat, total: doc.total, open: doc.open }).toEqual({ net: total, vat: 0, total, open: total });

      const jv = await jvOfSource("ap_invoice", inv.id);
      expectBalanced(jv);
      expect(jv.every((l) => l.jvStatus === "posted")).toBe(true);
      const expectedDr = new Map<string, number>();
      accounts.forEach((a, i) => expectedDr.set(a, round((expectedDr.get(a) ?? 0) + lines[i].net, 4)));
      for (const [account, amount] of expectedDr) expect(sumBy(jv, account, "dr")).toBe(amount);
      expect(sumBy(jv, control, "cr")).toBe(total);
      // nothing else is posted: every JV line is one of the mapped debit accounts or the AP control account
      expect(jv.every((l) => expectedDr.has(l.account) || l.account === control)).toBe(true);
    },
  );

  test(
    "TC-APGRN-020001 สวิตช์ปิด (ค่า default): Commit GRN แล้วไม่มี AP invoice เกิดขึ้น",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; TEST BU; gl_setting.ap_auto_from_grn = false (ตั้งในเคสนี้ แล้วคืนค่าเดิม); กลุ่มสินค้ามี mapping inventory" },
        { type: "steps", description: "1. สร้าง GRN draft 2 บรรทัด x 3 @ 100.00 (AP)\n2. ตั้งสวิตช์ ap_auto_from_grn เป็น false\n3. Save แล้ว Commit GRN\n4. ค้น AP invoice ของ GRN และค้นด้วยเลข Vendor Invoice" },
        {
          type: "expected",
          description: "Commit สำเร็จ GRN เป็น committed; ไม่มี AP invoice ผูกกับ GRN (ap_invoices ว่าง, ap_invoices_voided ว่าง) และค้นด้วยเลข invoice ของ GRN ไม่เจอใบ AP. assumption: ไม่มีค่าหรือ false = ปิด (BE facts: mb ap-invoice.service.ts:305)",
        },
        { type: "priority", description: "High" },
        { type: "testType", description: "Alternate Flow" },
      ],
    },
    async () => {
      const grn = await newGrn("off");
      await withGlSetting({ ap_auto_from_grn: false }, async () => {
        expect((await commitGrn(grn.id)).status).toBe(200);
      });
      const seen = await grnInvoices(grn.id);
      expect(seen.status).toBe("committed");
      expect(seen.live).toHaveLength(0);
      expect(seen.voided).toHaveLength(0);
      const hits = (await listAllRows(CREATOR, `/ap-invoice?search=${encodeURIComponent(tag("off"))}`)).filter((d) => d.vendor_invoice_no === tag("off"));
      expect(hits).toHaveLength(0);
    },
  );

  test(
    "TC-APGRN-030001 แก้เลขใบแจ้งหนี้ของ GRN ที่ Commit แล้ว: ใบ grn_auto เดิมถูก void กลับรายการ และออกใบใหม่ยอดเท่าเดิม",
    {
      annotation: [
        { type: "preconditions", description: "Admin login; TEST BU; ap_auto_from_grn เปิดในเคสนี้; GRN ที่ Commit แล้วมี AP invoice grn_auto 1 ใบ ยังไม่มีการจ่าย" },
        { type: "steps", description: "1. สร้าง GRN draft 2 บรรทัด x 3 @ 100.00 เปิดสวิตช์ Save และ Commit\n2. แก้ invoice_no ของ GRN (PATCH)\n3. อ่านใบ AP ของ GRN (ใช้งานอยู่และที่ void แล้ว) และ JV ของใบเดิม" },
        {
          type: "expected",
          description:
            "ใบ grn_auto เดิมเป็น void มี JV กลับรายการ (ผลรวม Dr = Cr ต่อบัญชีหักล้างของเดิมเป็น 0 ทุกบัญชี) และอยู่ใน ap_invoices_voided; มีใบ grn_auto ใบใหม่ 1 ใบ posted ยอด 600.00 ใช้เลข Vendor Invoice ใหม่ของ GRN; ใบ void ไม่นับเป็นใบที่ใช้งานอยู่. อ้างอิง mb ap-invoice.service.ts:393-430 (void จากฝั่ง GRN) และ good-received-note.ap-link.ts (ค่าหัวใบที่ทำให้ออกใหม่). assumption: การ void ของ AP คืนยอดด้วย JV กลับรายการ ไม่แก้ JV เดิม",
        },
        { type: "priority", description: "High" },
        { type: "testType", description: "Alternate Flow" },
      ],
    },
    async () => {
      const grn = await newGrn("reissue");
      const total = round(expectedLines(grn).reduce((s, l) => s + l.total, 0), 2);
      const newNo = tag("reissue-b");
      let firstId = "";
      await withGlSetting({ ap_auto_from_grn: true }, async () => {
        expect((await commitGrn(grn.id)).status).toBe(200);
        const first = await grnInvoices(grn.id);
        expect(first.live).toHaveLength(1);
        firstId = first.live[0].id;
        const upd = await buSend("Purchase", "PATCH", `/good-received-notes/${grn.id}`, { doc_version: first.version, invoice_no: newNo });
        expect(upd.status).toBe(200);
      });

      const seen = await grnInvoices(grn.id);
      expect(seen.status).toBe("committed");
      expect(seen.voided.map((v) => v.id)).toEqual([firstId]);
      expect(seen.voided[0].doc_status).toBe("void");
      expect(seen.voided[0].void_gl_jv_id).not.toBeNull();
      const old = await getApDoc(firstId);
      expect(old.status).toBe("void");
      expect(old.voidGlJvId).not.toBeNull();

      const jv = await jvOfSource("ap_invoice", firstId);
      expectBalanced(jv);
      for (const account of new Set(jv.map((l) => l.account))) {
        expect(round(sumBy(jv, account, "dr") - sumBy(jv, account, "cr"), 4)).toBe(0);
      }

      expect(seen.live).toHaveLength(1);
      expect(seen.live[0].id).not.toBe(firstId);
      const next = await rawInvoice(seen.live[0].id);
      expect(next.doc_source).toBe("grn_auto");
      expect(next.vendor_invoice_no).toBe(newNo);
      const nextDoc = await getApDoc(seen.live[0].id);
      expect(nextDoc.status).toBe("posted");
      expect({ net: nextDoc.net, total: nextDoc.total, open: nextDoc.open }).toEqual({ net: total, total, open: total });
    },
  );

  test(
    "TC-APGRN-040001 หลังเคสทั้งหมด gl_setting.ap_auto_from_grn กลับเป็น false และบัญชีอื่นของ gl_setting ไม่เสียหาย",
    {
      annotation: [
        { type: "preconditions", description: "รันหลังเคส 010001-030001 ของไฟล์นี้ (workers 1 รันตามลำดับไฟล์); Admin login; TEST BU" },
        { type: "steps", description: "1. GET /app-config/gl_setting\n2. ตรวจ ap_auto_from_grn และบัญชีหลักของ setting" },
        { type: "expected", description: "ap_auto_from_grn เป็น false (ค่า default ของ data:reset); ap_control_account_id และ advance_deposit_account_id ยังตั้งอยู่ — withGlSetting คืนค่าเดิมครบแม้เคสก่อนหน้าจะ throw" },
        { type: "priority", description: "High" },
        { type: "testType", description: "Functional" },
      ],
    },
    async () => {
      expect(await switchValue()).toBe(false);
      const r = await buConfigSend(CREATOR, "GET", "/app-config/gl_setting");
      expect(r.body?.data?.value?.ap_control_account_id).toBeTruthy();
      expect(r.body?.data?.value?.advance_deposit_account_id).toBeTruthy();
    },
  );
});
