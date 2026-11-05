// scripts/data-reset/docs/context.ts
// Every id the document payloads need, read once after master data, mappings and workflows exist.
// id ทุกตัวที่ payload ของเอกสารต้องใช้ อ่านครั้งเดียวหลังมี master, mapping และ workflow แล้ว
import type { ResetConfig } from "../config";
import type { Sessions } from "../sessions";
import { rowsOf } from "../step-result";
import type { TestUserInfo } from "../verify-env";
import { localDate } from "../period";
import { vendorEmail } from "../mappings";
import { refId } from "./refs";

export interface Id {
  id: string;
  name: string;
}

export interface SeedContext {
  today: string;
  users: Record<string, TestUserInfo>;
  departments: { first: Id; second: Id };
  locations: { first: Id; second: Id };
  products: Array<{ id: string; code: string; unitId: string }>;
  vendor: { id: string; email: string };
  currencyId: string;
  deliveryPointId: string;
  taxProfileId: string;
  workflows: { pr: string; po: string; sr: string };
  adjustmentTypeId: string;
}

type Row = Record<string, any>;
const byCode = (rows: Row[]) => [...rows].sort((a, b) => String(a.code).localeCompare(String(b.code)));

function need<T>(value: T | undefined | null, what: string): T {
  if (value === undefined || value === null) throw new Error(what);
  return value;
}

export async function resolveSeedContext(
  sessions: Sessions,
  cfg: ResetConfig,
  users: Record<string, TestUserInfo>,
  now: Date,
): Promise<SeedContext> {
  const admin = await sessions.client(cfg.adminEmail);
  const bu = cfg.buCode;
  const list = async (name: string) => rowsOf<Row>((await admin.get(`/api/config/${bu}/${name}?perpage=100`)).body);

  const [d1, d2] = byCode(await list("departments"));
  const inventory = byCode((await list("locations")).filter((l) => (l.location_type ?? "inventory") === "inventory"));
  const products = byCode(await list("products")).slice(0, 10);
  if (products.length < 10) throw new Error(`need 10 products in ${bu}, found ${products.length}`);
  const [vendorRow] = byCode(await list("vendors"));
  const vendor = need(vendorRow, `no vendor in ${bu}`);
  const email = need(vendorEmail((await admin.get(`/api/config/${bu}/vendors/${vendor.id}`)).body), `first vendor ${vendor.code} has no email`);
  const workflows = await list("workflows");
  const wf = (type: string, label: string) =>
    need(workflows.find((w) => w.workflow_type === type)?.id, `no ${label} workflow in ${bu}`);
  const adjustments = await list("adjustment-types");
  const stockIn = adjustments.find((a) => Object.values(a).some((v) => typeof v === "string" && /stock[_ -]?in/i.test(v)));

  return {
    today: localDate(now).day,
    users,
    departments: {
      first: { id: need(d1, `need 2 departments in ${bu}`).id, name: d1.name },
      second: { id: need(d2, `need 2 departments in ${bu}`).id, name: d2.name },
    },
    locations: {
      first: { id: need(inventory[0], `need 2 inventory locations in ${bu}`).id, name: inventory[0].name },
      second: { id: need(inventory[1], `need 2 inventory locations in ${bu}`).id, name: inventory[1].name },
    },
    products: products.map((p) => ({ id: p.id, code: p.code, unitId: refId(p, "inventory_unit") ?? "" })),
    vendor: { id: vendor.id, email },
    currencyId: need((await list("currencies")).find((c) => c.code === "THB")?.id, `no THB currency in ${bu}`),
    deliveryPointId: need((await list("delivery-points"))[0]?.id, `no delivery point in ${bu}`),
    taxProfileId: need((await list("tax-profiles")).find((t) => t.name === "None")?.id, `no "None" tax profile in ${bu}`),
    workflows: {
      pr: wf("purchase_request", "Purchase Request"),
      po: wf("purchase_order", "General PO"),
      sr: wf("store_requisition", "Store Requisition"),
    },
    adjustmentTypeId: need((stockIn ?? adjustments[0])?.id, `no adjustment type in ${bu}`),
  };
}
