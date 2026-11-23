import { buConfigSend, buSend, type ApiResult, type Role } from "./bu-api";

/**
 * GL access for the accounting specs on the TEST BU (the only BU these helpers may post, void or reverse on).
 * Created documents carry a tag (`E2E-T-<spec>-<ts>`) in their description so a stray one is findable.
 * Independent of `scripts/data-reset` on purpose - the helpers must not import the seed.
 */

export interface GlSetting {
  fiscal_year_start_month: number;
  ap_control_account_id: string;
  input_vat_account_id: string;
  wht_payable_account_id: string;
  advance_deposit_account_id: string;
  realized_fx_gain_account_id: string;
  realized_fx_loss_account_id: string;
  ap_jv_prefix_id: string;
  auto_jv_prefix_id: string;
  reversal_prefix_id: string;
  ap_auto_from_grn: boolean;
}

export interface JvLine {
  jvId: string;
  jvNo: string;
  jvStatus: string;
  /** Set on the JV that reverses another one. */
  reversalOfJvId: string | null;
  account: string;
  dr: number;
  cr: number;
  description: string | null;
}

/** The roles that post: Admin creates / submits / voids, Budget is the approver the seeded workflows name. */
export const CREATOR: Role = "Admin";
export const APPROVER: Role = "Budget";

type Row = Record<string, any>;

const ok = (r: ApiResult, what: string) => {
  if (r.status < 200 || r.status >= 300) {
    throw new Error(`${what} -> ${r.status} ${JSON.stringify(r.body?.message ?? r.body).slice(0, 300)}`);
  }
  return r;
};

/** ISO instant for a `YYYY-MM-DD` day (the JV date fields reject a bare date). */
export const isoDay = (day: string): string => `${day}T05:00:00.000Z`;

/** `YYYY-MM-DD` of today in the BU's timezone (Asia/Bangkok), the basis the GL period dates are read on. */
export function today(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

/** `YYYY-MM-DD` of an ISO instant in the BU's timezone (a date picked in the UI is local midnight, i.e. 17:00Z the day before). */
export function bangkokDay(instant: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(instant));
}

const MAX_PAGES = 50;

/**
 * Every row of a BU list. The page size comes from the response's `paginate` metadata when present (the BE may cap
 * `perpage` below 100); a listing cut short by the page cap throws, so a truncated list never reads as "not there".
 */
export async function listAllRows(role: Role, path: string, config = false): Promise<Row[]> {
  const send = config ? buConfigSend : buSend;
  const rows: Row[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const r = await send(role, "GET", `${path}${path.includes("?") ? "&" : "?"}perpage=100&page=${page}`);
    if (r.status !== 200) throw new Error(`GET ${path} -> ${r.status}`);
    const got: Row[] = Array.isArray(r.body?.data) ? r.body.data : [];
    rows.push(...got);
    const meta = r.body?.paginate as { perpage?: number; pages?: number } | undefined;
    if (meta?.pages !== undefined ? page >= Number(meta.pages) : got.length < Number(meta?.perpage ?? 100)) return rows;
  }
  throw new Error(`GET ${path}: more than ${MAX_PAGES} pages, listing would be truncated`);
}

/** Workflow action on a document: reads `doc_version` right before (a stale one is refused), then POSTs. Returns the raw result. */
export async function postAction(
  role: Role,
  docPath: string,
  action: string,
  extra: Record<string, unknown> = {},
): Promise<ApiResult> {
  let last: ApiResult = { status: 0, body: null };
  for (let attempt = 0; attempt < 2; attempt++) {
    const cur = await buSend(role, "GET", docPath);
    if (cur.status !== 200) return cur;
    last = await buSend(role, "POST", `${docPath}/${action}`, { doc_version: Number(cur.body?.data?.doc_version ?? 0), ...extra });
    const stale = last.status === 409 || (last.status >= 400 && last.status < 500 && /version/i.test(JSON.stringify(last.body ?? "")));
    if (!stale) return last;
  }
  return last;
}

let coaByCode: Promise<Map<string, string>> | null = null;
/** COA id of an account code (`5300`, `2100` ...). */
export async function accountId(code: string): Promise<string> {
  coaByCode ??= listAllRows(CREATOR, "/chart-of-accounts", true).then((rows) => new Map(rows.map((a) => [String(a.code), String(a.id)])));
  const id = (await coaByCode).get(code);
  if (!id) throw new Error(`no COA account ${code} on the TEST BU — run data:reset`);
  return id;
}

/** The lines of every JV that has `(sourceType, sourceId)` as its source (e.g. `ap_invoice`, the invoice id), oldest first - a void adds its reversing JV to the list. */
export async function jvOfSource(sourceType: string, sourceId: string): Promise<JvLine[]> {
  const heads = (await listAllRows(CREATOR, "/gl-jv"))
    .filter((j) => j.source_ref_type === sourceType && j.source_ref_id === sourceId)
    .sort((a, b) => String(a.created_at ?? a.audit?.created?.at ?? "").localeCompare(String(b.created_at ?? b.audit?.created?.at ?? "")));
  const lines: JvLine[] = [];
  for (const h of heads) {
    const d = ok(await buSend(CREATOR, "GET", `/gl-jv/${h.id}`), `GET gl-jv ${h.id}`).body.data;
    for (const l of d.tb_gl_jv_detail ?? []) {
      lines.push({
        jvId: d.id,
        jvNo: d.jv_no,
        jvStatus: d.jv_status,
        reversalOfJvId: d.reversal_of_jv_id ?? null,
        account: String(l.account_code),
        dr: Number(l.debit),
        cr: Number(l.credit),
        description: l.description ?? null,
      });
    }
  }
  return lines;
}

async function jvPrefixId(): Promise<string> {
  const rows = await listAllRows(CREATOR, "/gl-jv-prefixes", true);
  const hit = rows.find((p) => p.is_default) ?? rows.find((p) => p.code === "JV");
  if (!hit) throw new Error("no GL JV prefix on the TEST BU - run data:reset");
  return String(hit.id);
}

/** A draft manual JV. `lines` name accounts by code; the tag goes in the description. */
export async function createManualJv(
  lines: { account: string; dr?: number; cr?: number }[],
  tag: string,
): Promise<{ id: string; no: string }> {
  const add = [];
  for (const [i, l] of lines.entries()) {
    add.push({
      sequence_no: i + 1,
      chart_of_accounts_id: await accountId(l.account),
      ...(l.dr ? { debit: l.dr } : {}),
      ...(l.cr ? { credit: l.cr } : {}),
      description: `${tag} ${l.dr ? "Dr" : "Cr"} ${l.account}`,
    });
  }
  const r = ok(
    await buSend(CREATOR, "POST", "/gl-jv", { prefix_id: await jvPrefixId(), jv_date: isoDay(today()), description: tag, details: { add } }),
    "POST gl-jv",
  );
  const id = String(r.body.data.id);
  const doc = ok(await buSend(CREATOR, "GET", `/gl-jv/${id}`), "GET gl-jv").body.data;
  return { id, no: String(doc.jv_no) };
}

/** Submit a JV (the workflow routes it to the approver unless it is off for the source). */
export const submitJv = (id: string, role: Role = CREATOR) => postAction(role, `/gl-jv/${id}`, "submit");
/** Approve a JV as the stage user - the final approval posts it. */
export const approveJv = (id: string, role: Role = APPROVER) => postAction(role, `/gl-jv/${id}`, "approve");
/** Void a JV that is not posted yet (`reason` is required). */
export const voidJv = (id: string, reason = "e2e", role: Role = CREATOR) =>
  buSend(role, "POST", `/gl-posting/${id}/void`, { reason });
/** Reverse a posted manual JV; the reversing JV is dated `jvDate` (default today), inside an open period. */
export const reverseJv = (id: string, jvDate = isoDay(today()), role: Role = CREATOR) =>
  buSend(role, "POST", `/gl-posting/${id}/reverse`, { jv_date: jvDate });

const GL_SETTING = "/app-config/gl_setting";

async function readGlSetting(): Promise<ApiResult> {
  return buConfigSend(CREATOR, "GET", GL_SETTING);
}

/** The current `gl_setting` value of the TEST BU (throws when the row is missing). */
export async function getGlSettingValue(role: Role = CREATOR): Promise<Record<string, unknown>> {
  const r = await buConfigSend(role, "GET", GL_SETTING);
  const v = ok(r, `GET ${GL_SETTING}`).body?.data?.value;
  if (!v) throw new Error("gl_setting has no value on the TEST BU - run data:reset");
  return v as Record<string, unknown>;
}

/** COA code of an account id (the reverse of {@link accountId}). */
export async function accountCode(id: string): Promise<string> {
  const rows = await listAllRows(CREATOR, "/chart-of-accounts", true);
  const hit = rows.find((a) => String(a.id) === id);
  if (!hit) throw new Error(`no COA account with id ${id} on the TEST BU`);
  return String(hit.code);
}

/**
 * Run `fn` with `patch` merged into `gl_setting`, then put back the exact previous value - also when `fn` throws.
 * The merge keeps every key the patch does not name, so a spec flipping one flag cannot wipe the accounts.
 */
export async function withGlSetting<T>(patch: Partial<GlSetting>, fn: () => Promise<T>): Promise<T> {
  const before = ok(await readGlSetting(), `GET ${GL_SETTING}`).body?.data?.value as Record<string, unknown> | undefined;
  if (!before) throw new Error("gl_setting has no value on the TEST BU - run data:reset");
  const previous = structuredClone(before);
  ok(await buConfigSend(CREATOR, "PUT", GL_SETTING, { value: { ...before, ...patch } }), `PUT ${GL_SETTING}`);
  let failed = false;
  let original: unknown;
  let result!: T;
  try {
    result = await fn();
  } catch (e) {
    failed = true;
    original = e;
  }
  try {
    ok(await buConfigSend(CREATOR, "PUT", GL_SETTING, { value: previous }), `restore ${GL_SETTING}`);
  } catch (restoreError) {
    // A failed restore must not hide the spec's own failure: log it and rethrow the original.
    if (!failed) throw restoreError;
    console.error(`withGlSetting: ${String(restoreError)} - gl_setting was NOT restored`);
  }
  if (failed) throw original;
  return result;
}

const REQUIRED_SETTING_KEYS = [
  "ap_control_account_id",
  "input_vat_account_id",
  "wht_payable_account_id",
  "advance_deposit_account_id",
  "ap_jv_prefix_id",
  "auto_jv_prefix_id",
  "reversal_prefix_id",
] as const;

/** True when an open GL period contains `day` (`YYYY-MM-DD`). */
export async function openPeriodCovers(day: string): Promise<boolean> {
  const p = await buConfigSend(CREATOR, "GET", "/gl-periods?perpage=100");
  if (p.status !== 200) throw new Error(`accounting setup check: GET gl-periods -> ${p.status}`);
  const periods: Row[] = Array.isArray(p.body?.data) ? p.body.data : [];
  return periods.some((x) => x.status === "open" && String(x.start_at).slice(0, 10) <= day && day <= String(x.end_at).slice(0, 10));
}

/** Throws, naming the missing period, unless an open GL period covers `day` (e.g. the day after today on a period-end date). */
export async function assertOpenPeriodCovers(day: string, why: string): Promise<void> {
  if (!(await openPeriodCovers(day))) throw new Error(`accounting setup missing on TEST BU: open GL period covering ${day} (${why}) - open the next period or run data:reset`);
}

/** Throws, naming what is missing, unless AP / GL can post on the TEST BU. */
export async function assertAccountingReady(): Promise<void> {
  const missing: string[] = [];
  const s = await readGlSetting();
  if (s.status === 404) missing.push("gl_setting (not created)");
  else if (s.status !== 200) throw new Error(`accounting setup check: GET ${GL_SETTING} -> ${s.status}`);
  else {
    const value = (s.body?.data?.value ?? {}) as Record<string, unknown>;
    for (const k of REQUIRED_SETTING_KEYS) {
      if (!value[k]) missing.push(`gl_setting.${k}${k.endsWith("prefix_id") ? " (prefix)" : ""}`);
    }
  }
  if (!(await openPeriodCovers(today()))) missing.push(`open GL period covering ${today()}`);
  if (missing.length > 0) throw new Error(`accounting setup missing on TEST BU: ${missing.join(", ")} — run data:reset`);
}

let decimals: Promise<number> | null = null;
/** The BU's money decimals: the base currency's `decimal_places` when the API carries one, else 2 (no BU decimal setting exists on dev). */
export function buDecimals(): Promise<number> {
  decimals ??= (async () => {
    const r = await buConfigSend(CREATOR, "GET", "/currencies?perpage=100");
    const rows: Row[] = Array.isArray(r.body?.data) ? r.body.data : [];
    const c = rows.find((x) => x.code === "THB") ?? rows[0];
    const n = Number(c?.decimal_places);
    return Number.isInteger(n) && n >= 0 ? n : 2;
  })();
  return decimals;
}
