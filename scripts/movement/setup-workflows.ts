/**
 * ใส่สินค้าให้ workflow บน CARMEN-AVG ที่ผู้ใช้จริงสร้างได้ — ไม่แตะรายชื่อคนใน stage
 *   bun run movement:setup-workflows            → สำรองค่าเดิม (ถ้ายังไม่มีไฟล์สำรอง) แล้วตั้งค่า
 *   bun run movement:setup-workflows restore    → คืนค่าเดิมจากไฟล์สำรอง แล้วลบไฟล์สำรอง
 *
 * ทำไมต้องตั้ง: lookup สินค้าของ PR/PO/SR = สินค้าของ workflow ∩ สินค้าของคลัง (products-location-workflow)
 * และ workflow ที่ไม่ได้เลือกสินค้าไว้ = เลือกไม่ได้สักตัว — ณ 2026-10-02 ทุก workflow ที่ requestor สร้างได้
 * มีสินค้า 0 ตัว ส่วนตัวเดียวที่มีสินค้า ("ทดสอบสร้าง PR" 84 ตัว) ไม่มีใครอยู่ใน stage Create Request
 * จึงยืมรายการสินค้าชุดนั้นมาใส่ (สภาพที่ workflow ใช้งานจริงควรเป็น)
 * หลังบ้านไม่ยอมให้แก้ workflow ที่มีเอกสาร in_progress — คืนค่าต้องเคลียร์เอกสารที่ส่งไปแล้วก่อน (bun run movement:cleanup --apply)
 *
 * ย้ายมาจาก _movement_play/eop_bf/e2e/fe/setup-workflows.ts — ไฟล์สำรองย้ายจาก evidence/fe-roles/ มาอยู่ runs/movement/
 * ต้องเข้าถึง backend ได้ (E2E_API_URL + E2E_X_APP_ID หรือ frontend ที่รันอยู่ / config ของ checkout)
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { apiSend } from "../../tests/helpers/movement/api";
import { srIssueWorkflowName } from "../../tests/helpers/movement/doc-flow";

const BU = "CARMEN-AVG";
const BACKUP = "runs/movement/workflows-backup.json";
const SOURCE = "ทดสอบสร้าง PR";
// The SR workflow (found by its stages — it was renamed on dev) is provisioned too, but is left alone once it has products.
const RESTORE = process.argv[2] === "restore";
// Resolved lazily: `restore` reads names from the backup file and must not depend on the SR lookup (it throws on two matches).
const TARGETS = RESTORE ? [] : ["general item", "PO inherit-sig test", await srIssueWorkflowName(BU)];

async function getWorkflow(id: string) {
  const r = await apiSend("GET", `/api/config/${BU}/workflows/${id}`);
  if (r.status !== 200) throw new Error(`GET workflow ${id} ${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
  return r.body.data;
}

async function findId(name: string) {
  const r = await apiSend("GET", `/api/config/${BU}/workflows?perpage=100`);
  const wf = (r.body.data ?? []).find((w: any) => w.name === name);
  if (!wf) throw new Error(`ไม่พบ workflow ${name}`);
  return wf.id as string;
}

async function put(wf: any, data: unknown) {
  const r = await apiSend("PUT", `/api/config/${BU}/workflows/${wf.id}`, { doc_version: wf.doc_version, data });
  if (r.status !== 200) throw new Error(`PUT ${wf.name} ${r.status} ${JSON.stringify(r.body).slice(0, 400)}`);
}

if (RESTORE) {
  if (!existsSync(BACKUP)) throw new Error(`ไม่มีไฟล์สำรอง ${BACKUP}`);
  const backup = JSON.parse(readFileSync(BACKUP, "utf8")) as Record<string, any>;
  for (const name of Object.keys(backup)) {
    await put(await getWorkflow(await findId(name)), backup[name].data);
    console.log("restored", name);
  }
  rmSync(BACKUP);
  process.exit(0);
}

const ids: Record<string, string> = {};
for (const name of [...TARGETS, SOURCE]) ids[name] = await findId(name);

const current: Record<string, any> = {};
for (const name of TARGETS) current[name] = await getWorkflow(ids[name]);
if (!existsSync(BACKUP)) {
  mkdirSync("runs/movement", { recursive: true });
  writeFileSync(BACKUP, JSON.stringify(current, null, 2));
  console.log("backup →", BACKUP);
}
const products: string[] = (await getWorkflow(ids[SOURCE])).data.products;
if (!products?.length) throw new Error(`${SOURCE} ไม่มีสินค้าให้ยืม`);

for (const name of TARGETS) {
  const wf = current[name];
  if (wf.data.products?.length) {
    console.log("unchanged", name, wf.data.products.length, "products");
    continue;
  }
  await put(wf, { ...wf.data, products });
  console.log("updated", name, `+${products.length} products`);
}
