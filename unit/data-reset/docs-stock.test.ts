import { describe, it, expect } from "vitest";
import { planStock, seedStock } from "../../scripts/data-reset/docs/stock";
import { RowLedger } from "../../scripts/data-reset/docs/row-ledger";
import { addDays } from "../../scripts/data-reset/docs/dates";
import { createSessions } from "../../scripts/data-reset/sessions";
import { fakeBackend } from "./fake-backend";
import { cfg, ctx } from "./docs-fixtures";

const current = "/api/GR2VYNKQ/inventory-periods/current";
const open = { data: { status: "open", start_at: "2026-11-01T00:00:00Z", end_at: "2026-11-30T23:59:59Z" } };

describe("addDays", () => {
  it("moves across month ends", () => {
    expect(addDays("2026-11-05", -30)).toBe("2026-10-06");
    expect(addDays("2026-11-05", 7)).toBe("2026-11-12");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("planStock", () => {
  const plan = planStock(ctx);

  it("links every product to both locations and puts products 1–3 at par 100 on location 1", () => {
    expect(plan.productLocations).toHaveLength(10);
    expect(plan.productLocations[0].entries).toEqual([{ location_id: "l1", par_qty: 100, min_qty: 10, max_qty: 150 }, { location_id: "l2" }]);
    expect(plan.productLocations[3].entries).toEqual([{ location_id: "l1" }, { location_id: "l2" }]);
  });

  it("stocks the tier products so on-hand / par is 0.2, 0.4 and 0.8", () => {
    const tiers = plan.stockIns.find((s) => s.row === "stock.tiers")!;
    expect(tiers.locationId).toBe("l1");
    expect(tiers.lines.map((l) => [l.productId, l.qty / 100])).toEqual([["p1", 0.2], ["p2", 0.4], ["p3", 0.8]]);
  });

  it("has on-hand at both locations and an expired plus a near-expiry lot", () => {
    const rows = Object.fromEntries(plan.stockIns.map((s) => [s.row, s]));
    expect(rows["stock.on-hand.l1"].lines.map((l) => [l.productId, l.qty])).toEqual(
      ["p4", "p5", "p6", "p7", "p8"].map((p) => [p, 200]),
    );
    expect(rows["stock.on-hand.l2"]).toMatchObject({ locationId: "l2" });
    expect(rows["stock.on-hand.l2"].lines.every((l) => l.qty === 100)).toBe(true);
    expect(rows["stock.expired"].lines).toEqual([{ productId: "p9", qty: 10, cost: 10, expiredAt: "2026-10-06" }]);
    expect(rows["stock.near-expiry"].lines).toEqual([{ productId: "p9", qty: 10, cost: 10, expiredAt: "2026-11-12" }]);
  });
});

describe("seedStock", () => {
  it("refuses to post when no open period covers today", async () => {
    const backend = fakeBackend({ [`GET ${current}`]: { data: { status: "open", start_at: "2026-10-01T00:00:00Z", end_at: "2026-10-31T00:00:00Z" } } });
    const result = await seedStock(createSessions(cfg, backend.fetchFn), cfg, ctx, new RowLedger());
    expect(result.failed).toEqual(["no open period covers 2026-11-05 — stock not posted"]);
    expect(backend.writes()).toEqual([]);
  });

  it("sets par levels as admin, then posts and commits each stock-in as storemanager", async () => {
    let n = 0;
    const backend = fakeBackend(
      {
        [`GET ${current}`]: open,
        "POST /api/GR2VYNKQ/stock-ins": () => ({ data: { id: `si${++n}`, doc_version: 0 } }),
        ...Object.fromEntries([1, 2, 3, 4, 5].map((i) => [`GET /api/GR2VYNKQ/stock-ins/si${i}`, { data: { doc_version: 0, si_no: `SI00${i}` } }])),
      },
      (method) => (method === "GET" ? { data: { doc_version: 3, locations: [] } } : undefined),
    );
    const ledger = new RowLedger();
    const result = await seedStock(createSessions(cfg, backend.fetchFn), cfg, ctx, ledger);
    expect(result.failed).toEqual([]);
    const writes = backend.writes().map((c) => `${c.method} ${c.path}`);
    expect(writes.filter((w) => w.startsWith("PATCH /api/config/GR2VYNKQ/products/"))).toHaveLength(10);
    expect(writes.filter((w) => w === "POST /api/GR2VYNKQ/stock-ins")).toHaveLength(5);
    expect(writes.filter((w) => /stock-ins\/si\d\/commit$/.test(w))).toHaveLength(5);
    expect(Object.keys(ledger.rows()).sort()).toEqual(
      ["stock.expired", "stock.near-expiry", "stock.on-hand.l1", "stock.on-hand.l2", "stock.tiers"],
    );
    const first = backend.writes().find((c) => c.path === "/api/GR2VYNKQ/stock-ins")!.body as any;
    expect(first).toMatchObject({ adjustment_type_id: "adj-in", si_date: "2026-11-05T05:00:00.000Z" });
    expect(ledger.rows()["stock.tiers"].docNos).toEqual(["SI001"]);
    expect(first.note).toMatch(/^STD stock\./);
  });
});
