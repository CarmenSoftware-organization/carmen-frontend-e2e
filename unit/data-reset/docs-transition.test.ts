import { describe, it, expect } from "vitest";
import { createDoc, transition } from "../../scripts/data-reset/docs/transition";
import { RowLedger } from "../../scripts/data-reset/docs/row-ledger";
import { createSessions } from "../../scripts/data-reset/sessions";
import { fakeBackend } from "./fake-backend";
import { cfg } from "./docs-fixtures";

const doc = "/api/GR2VYNKQ/purchase-requests/pr1";

async function admin(routes: Record<string, unknown>) {
  const backend = fakeBackend(routes);
  return { backend, client: await createSessions(cfg, backend.fetchFn).client(cfg.adminEmail) };
}

describe("transition", () => {
  it("sends the doc_version it just read", async () => {
    const { backend, client } = await admin({ [`GET ${doc}`]: { data: { id: "pr1", doc_version: 4 } } });
    const res = await transition(client, doc, "submit", (v) => ({ doc_version: v }));
    expect(res.ok).toBe(true);
    expect(backend.writes()).toEqual([{ method: "PATCH", path: `${doc}/submit`, body: { doc_version: 4 } }]);
  });

  it("re-reads and retries once on 409", async () => {
    let patches = 0;
    const { backend, client } = await admin({
      [`GET ${doc}`]: { data: { id: "pr1", doc_version: 4 } },
      [`PATCH ${doc}/submit`]: () => (++patches === 1 ? { __status: 409 } : { data: {} }),
    });
    expect((await transition(client, doc, "submit", (v) => ({ doc_version: v }))).ok).toBe(true);
    expect(backend.writes()).toHaveLength(2);
  });

  it("gives up after a second 409", async () => {
    const { backend, client } = await admin({
      [`GET ${doc}`]: { data: { doc_version: 1 } },
      [`PATCH ${doc}/submit`]: { __status: 409 },
    });
    expect(await transition(client, doc, "submit", (v) => ({ doc_version: v }))).toMatchObject({ ok: false, status: 409 });
    expect(backend.writes()).toHaveLength(2);
  });

  it("does not retry other errors", async () => {
    const { backend, client } = await admin({
      [`GET ${doc}`]: { data: { doc_version: 1 } },
      [`PATCH ${doc}/submit`]: { __status: 400 },
    });
    expect(await transition(client, doc, "submit", (v) => ({ doc_version: v }))).toMatchObject({ ok: false, status: 400 });
    expect(backend.writes()).toHaveLength(1);
  });

  it("can POST an action that takes no version", async () => {
    const { backend, client } = await admin({ [`GET ${doc}`]: { data: { doc_version: 1 } } });
    await transition(client, doc, "mark-sent", () => undefined, "post");
    expect(backend.writes()).toEqual([{ method: "POST", path: `${doc}/mark-sent`, body: undefined }]);
  });
});

describe("createDoc", () => {
  it("returns the new id and document number", async () => {
    const { client } = await admin({ "POST /api/GR2VYNKQ/purchase-requests": { data: { id: "pr9", pr_no: "PR2611001" } } });
    expect(await createDoc(client, "/api/GR2VYNKQ/purchase-requests", {})).toEqual({
      ok: true, status: 200, id: "pr9", no: "PR2611001",
    });
  });
});

describe("RowLedger", () => {
  it("groups doc numbers and failures per row", () => {
    const ledger = new RowLedger();
    ledger.record("pr.hod", "PR1", true);
    ledger.record("pr.hod", null, false, "approve → 400");
    ledger.record("po.draft", "PO1", true);
    expect(ledger.rows()).toEqual({
      "pr.hod": { docNos: ["PR1"], failures: ["approve → 400"] },
      "po.draft": { docNos: ["PO1"], failures: [] },
    });
  });
});
