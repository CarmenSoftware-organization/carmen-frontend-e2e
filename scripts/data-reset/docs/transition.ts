// scripts/data-reset/docs/transition.ts
// Every PR/PO/SR/GRN/CN state change carries the current doc_version — read it right before.
// การเปลี่ยนสถานะทุกครั้งต้องส่ง doc_version ล่าสุด จึงอ่านก่อนส่งทุกครั้ง
import type { ApiClient } from "../../seed-master/api-client";

export interface TransitionResult {
  ok: boolean;
  status: number;
  doc?: any;
  body?: any;
}

const docOf = (body: any) => body?.data ?? body;

export async function transition(
  client: ApiClient,
  docPath: string,
  action: string,
  body: (docVersion: number, doc: any) => unknown,
  method: "patch" | "post" = "patch",
): Promise<TransitionResult> {
  let last: TransitionResult = { ok: false, status: 0 };
  for (let attempt = 0; attempt < 2; attempt++) {
    const current = await client.get(docPath);
    if (!current.ok) return { ok: false, status: current.status, body: current.body };
    const doc = docOf(current.body);
    const res = await client[method](`${docPath}/${action}`, body(Number(doc?.doc_version ?? 0), doc));
    last = { ok: res.ok, status: res.status, doc, body: res.body };
    if (res.status !== 409) return last;
  }
  return last;
}

export async function createDoc(
  client: ApiClient,
  listPath: string,
  body: unknown,
): Promise<{ ok: boolean; status: number; id?: string; no?: string; body?: any }> {
  const res = await client.post(listPath, body);
  const data = docOf(res.body) ?? {};
  const noKey = Object.keys(data).find((k) => k.endsWith("_no") && typeof data[k] === "string");
  return {
    ok: res.ok,
    status: res.status,
    ...(data.id ? { id: String(data.id) } : {}),
    ...(noKey ? { no: data[noKey] } : {}),
    ...(res.ok ? {} : { body: res.body }),
  };
}

/** One-line reason for a failed call. / เหตุผลสั้น ๆ ของคำขอที่ล้ม */
export const why = (what: string, res: { status: number; body?: any }) =>
  `${what} → ${res.status}${res.body?.message ? ` ${JSON.stringify(res.body.message)}` : ""}`;
