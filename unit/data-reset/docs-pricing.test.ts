import { describe, it, expect } from "vitest";
import { planCampaignDates, seedPricing } from "../../scripts/data-reset/docs/pricing";
import { RowLedger } from "../../scripts/data-reset/docs/row-ledger";
import { createSessions } from "../../scripts/data-reset/sessions";
import { fakeBackend } from "./fake-backend";
import { cfg, ctx, docStore, email } from "./docs-fixtures";

describe("planCampaignDates", () => {
  it("gives one open, one upcoming and one closed window (the list derives state from dates)", () => {
    expect(planCampaignDates("2026-11-05")).toEqual({
      active: { start_date: "2026-11-04", end_date: "2026-12-05" },
      draft: { start_date: "2026-11-20", end_date: "2026-12-20" },
      expired: { start_date: "2026-10-01", end_date: "2026-10-31" },
    });
  });
});

describe("seedPricing", () => {
  it("creates 3 active price lists, one template and 3 campaigns with the vendor attached, as purchase", async () => {
    const store = docStore("pricelist_detail", "no");
    const backend = fakeBackend({}, store.fallback);
    const ledger = new RowLedger();
    const result = await seedPricing(createSessions(cfg, backend.fetchFn), cfg, ctx, ledger);
    expect(result.failed).toEqual([]);
    const w = backend.writesBy();
    expect(w.every((x) => x.caller === email("purchase"))).toBe(true);
    const lists = w.filter((x) => x.path === "/api/GR2VYNKQ/pricelists").map((x) => x.body as any);
    expect(lists).toHaveLength(3);
    expect(lists.every((b) => b.status === "active" && b.effective_from_date <= "2026-11-05" && b.effective_to_date >= "2026-11-05")).toBe(true);
    expect(lists[0].pricelist_detail.add).toHaveLength(5);
    expect(w.filter((x) => x.path === "/api/GR2VYNKQ/pricelist-templates")).toHaveLength(1);
    const rfps = w.filter((x) => x.path === "/api/GR2VYNKQ/request-for-pricings").map((x) => x.body as any);
    expect(rfps).toHaveLength(3);
    expect(rfps.every((b) => b.vendors.add.length === 1 && b.vendors.add[0].contact_email === ctx.vendor.email)).toBe(true);
    expect(Object.keys(ledger.rows()).sort()).toEqual(["campaign.active", "campaign.draft", "campaign.expired", "pricelist.active"]);
  });
});
