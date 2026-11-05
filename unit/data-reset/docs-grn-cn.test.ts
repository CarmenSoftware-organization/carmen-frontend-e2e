import { describe, it, expect } from "vitest";
import { seedReceiving } from "../../scripts/data-reset/docs/receiving";
import { RowLedger } from "../../scripts/data-reset/docs/row-ledger";
import { createSessions } from "../../scripts/data-reset/sessions";
import { fakeBackend } from "./fake-backend";
import { cfg, ctx, docStore, email } from "./docs-fixtures";

const poLines = (po: string) => ({
  data: {
    id: po, doc_version: 0,
    purchase_order_detail: [
      { id: `${po}-a`, product_id: "p1", location_id: "l1", order_qty: 10, order_unit_id: "u-ea", price: 100 },
      { id: `${po}-b`, product_id: "p2", location_id: "l1", order_qty: 10, order_unit_id: "u-ea", price: 100 },
    ],
  },
});

async function run() {
  const store = docStore("good_received_note_detail", "grn_no");
  const backend = fakeBackend(
    { "GET /api/GR2VYNKQ/purchase-orders/poF": poLines("poF"), "GET /api/GR2VYNKQ/purchase-orders/poP": poLines("poP") },
    store.fallback,
  );
  const ledger = new RowLedger();
  const result = await seedReceiving(createSessions(cfg, backend.fetchFn), cfg, ctx, ledger, { full: "poF", partial: "poP" });
  return { backend, ledger, result };
}

const grnCreates = (w: any[]) => w.filter((x) => x.path === "/api/GR2VYNKQ/good-received-notes");
const actionsOn = (w: any[], id: string) => w.filter((x) => x.path.startsWith(`/api/GR2VYNKQ/good-received-notes/${id}/`)).map((x) => x.path.split("/").pop());

describe("seedReceiving", () => {
  it("receives the full PO in full and the partial PO by half of line 1, then commits both", async () => {
    const { backend } = await run();
    const w = backend.writesBy();
    const [full, partial] = grnCreates(w).map((x) => x.body as any);
    expect(full).toMatchObject({ doc_type: "purchase_order" });
    expect(full.good_received_note_detail.add.map((l: any) => [l.purchase_order_detail_id, l.received_qty])).toEqual([["poF-a", 10], ["poF-b", 10]]);
    expect(partial.good_received_note_detail.add.map((l: any) => [l.purchase_order_detail_id, l.received_qty])).toEqual([["poP-a", 5]]);
    expect(actionsOn(w, "d1")).toEqual(["save", "commit"]);
    expect(actionsOn(w, "d2")).toEqual(["save", "commit"]);
  });

  it("leaves a manual GRN saved and another as draft", async () => {
    const { backend } = await run();
    const w = backend.writesBy();
    const manual = grnCreates(w).slice(2).map((x) => x.body as any);
    expect(manual.map((b) => [b.doc_type, b.good_received_note_detail.add.length])).toEqual([["manual", 2], ["manual", 2]]);
    expect(actionsOn(w, "d3")).toEqual(["save"]);
    expect(actionsOn(w, "d4")).toEqual([]);
  });

  it("puts both credit notes on the committed GRN and submits only the second", async () => {
    const { backend, ledger, result } = await run();
    const w = backend.writesBy();
    const cns = w.filter((x) => x.path === "/api/GR2VYNKQ/credit-notes");
    expect(cns.map((x) => (x.body as any).grn_id)).toEqual(["d1", "d1"]);
    // The backend credits each product on a GRN once (422 otherwise), so the two CNs take different lines.
    expect(cns.map((x) => (x.body as any).credit_note_detail.add[0].product_id)).toEqual(["p1", "p2"]);
    expect((cns[0].body as any)).toMatchObject({ credit_note_type: "quantity_return", vendor_id: "v1" });
    expect(w.filter((x) => /credit-notes\/d\d+\/submit$/.test(x.path))).toHaveLength(1);
    expect(w.every((x) => x.caller === email("purchase"))).toBe(true);
    expect(result.failed).toEqual([]);
    expect(Object.keys(ledger.rows()).sort()).toEqual(
      ["cn.committed", "cn.draft", "grn.committed", "grn.draft", "grn.partial", "grn.received", "po.completed", "po.partial"],
    );
  });
});
