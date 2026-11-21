import { buConfigSend } from "./bu-api";

/**
 * Temporarily change `hide_fields` of one stage of the TEST BU purchase-request workflow (config API, Admin role).
 * The workflow is shared by every PR spec, so the original `data` is always written back in `finally`.
 */
export async function withStageHiddenPrices<T>(stageName: string, fn: () => Promise<T>): Promise<T> {
  const list = await buConfigSend("Admin", "GET", "/workflows?perpage=100");
  const summary = (list.body?.data ?? []).find((w: any) => w.workflow_type === "purchase_request");
  if (!summary) throw new Error("withStageHiddenPrices: no purchase_request workflow - run `bun run data:reset --yes`");
  const detail = async () => (await buConfigSend("Admin", "GET", `/workflows/${summary.id}`)).body.data;
  const original = await detail();
  const put = async (data: unknown) => {
    const cur = await detail();
    const res = await buConfigSend("Admin", "PUT", `/workflows/${summary.id}`, {
      name: cur.name,
      workflow_type: cur.workflow_type,
      description: cur.description,
      is_active: cur.is_active,
      doc_version: cur.doc_version,
      data,
    });
    return res;
  };
  const hidden = structuredClone(original.data);
  const stage = hidden.stages.find((s: any) => s.name === stageName);
  if (!stage) throw new Error(`withStageHiddenPrices: no stage "${stageName}"`);
  stage.hide_fields = { price_per_unit: true, total_price: true };
  try {
    const res = await put(hidden);
    if (res.status >= 300) throw new Error(`PUT workflow hide_fields -> ${res.status} ${JSON.stringify(res.body).slice(0, 300)}`);
    return await fn();
  } finally {
    const res = await put(original.data);
    if (res.status >= 300) throw new Error(`RESTORE workflow failed -> ${res.status} ${JSON.stringify(res.body).slice(0, 300)}`);
  }
}
