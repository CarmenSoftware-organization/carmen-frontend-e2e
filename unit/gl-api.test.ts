import { beforeEach, describe, expect, it, vi } from "vitest";

import { assertAccountingReady, listAllRows, today, withGlSetting } from "../tests/helpers/gl-api";

const { buConfigSend, buSend } = vi.hoisted(() => ({ buConfigSend: vi.fn(), buSend: vi.fn() }));
vi.mock("../tests/helpers/bu-api", () => ({ buConfigSend, buSend }));

const FULL = {
  fiscal_year_start_month: 1,
  ap_control_account_id: "a",
  input_vat_account_id: "b",
  wht_payable_account_id: "c",
  advance_deposit_account_id: "d",
  ap_jv_prefix_id: "p1",
  auto_jv_prefix_id: "p1",
  reversal_prefix_id: "p2",
  ap_auto_from_grn: false,
};

beforeEach(() => {
  buConfigSend.mockReset();
  buSend.mockReset();
});

describe("withGlSetting", () => {
  it("merges the patch, then restores the exact previous value", async () => {
    const puts: unknown[] = [];
    buConfigSend.mockImplementation(async (_r: string, method: string, _p: string, body?: any) => {
      if (method === "GET") return { status: 200, body: { data: { value: FULL } } };
      puts.push(body.value);
      return { status: 200, body: {} };
    });
    const out = await withGlSetting({ ap_auto_from_grn: true }, async () => "done");
    expect(out).toBe("done");
    expect(puts).toEqual([{ ...FULL, ap_auto_from_grn: true }, FULL]);
  });

  it("restores when fn throws, and rethrows its error", async () => {
    const puts: any[] = [];
    buConfigSend.mockImplementation(async (_r: string, method: string, _p: string, body?: any) => {
      if (method === "GET") return { status: 200, body: { data: { value: FULL } } };
      puts.push(body.value);
      return { status: 200, body: {} };
    });
    await expect(
      withGlSetting({ ap_auto_from_grn: true }, async () => {
        throw new Error("spec failed");
      }),
    ).rejects.toThrow("spec failed");
    expect(puts).toHaveLength(2);
    expect(puts[1]).toEqual(FULL);
  });
});

describe("withGlSetting restore failure", () => {
  it("keeps the spec's own error when the restore also fails", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    let puts = 0;
    buConfigSend.mockImplementation(async (_r: string, method: string) => {
      if (method === "GET") return { status: 200, body: { data: { value: FULL } } };
      puts += 1;
      return { status: puts === 1 ? 200 : 500, body: {} };
    });
    await expect(
      withGlSetting({ ap_auto_from_grn: true }, async () => {
        throw new Error("spec failed");
      }),
    ).rejects.toThrow("spec failed");
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("throws the restore error when fn succeeded", async () => {
    let puts = 0;
    buConfigSend.mockImplementation(async (_r: string, method: string) => {
      if (method === "GET") return { status: 200, body: { data: { value: FULL } } };
      puts += 1;
      return { status: puts === 1 ? 200 : 500, body: {} };
    });
    await expect(withGlSetting({ ap_auto_from_grn: true }, async () => 1)).rejects.toThrow(/restore/);
  });
});

describe("listAllRows", () => {
  it("throws instead of returning a truncated list", async () => {
    buSend.mockImplementation(async () => ({ status: 200, body: { data: Array.from({ length: 100 }, (_, i) => ({ id: i })), paginate: { perpage: 100, pages: 999 } } }));
    await expect(listAllRows("Admin", "/gl-jv")).rejects.toThrow(/truncated/);
  });
  it("follows paginate.pages when the BE caps the page size", async () => {
    buSend.mockImplementation(async (_r: string, _m: string, path: string) => {
      const page = Number(/page=(\d+)/.exec(path)![1]);
      return { status: 200, body: { data: [{ id: page }, { id: page + 100 }], paginate: { perpage: 2, pages: 3 } } };
    });
    expect(await listAllRows("Admin", "/gl-jv")).toHaveLength(6);
  });
});

describe("assertAccountingReady", () => {
  const year = Number(today().slice(0, 4));
  const periodOpen = { status: "open", start_at: `${year}-01-01T00:00:00.000Z`, end_at: `${year + 1}-01-01T23:59:59.999Z` };
  const mock = (setting: { status: number; value?: unknown }, periods: unknown[]) =>
    buConfigSend.mockImplementation(async (_r: string, _m: string, path: string) =>
      path.startsWith("/gl-periods")
        ? { status: 200, body: { data: periods } }
        : { status: setting.status, body: { data: { value: setting.value } } },
    );

  it("passes when settings and an open period are in place", async () => {
    mock({ status: 200, value: FULL }, [periodOpen]);
    await expect(assertAccountingReady()).resolves.toBeUndefined();
  });

  it("names a missing gl_setting key and a missing period", async () => {
    mock({ status: 200, value: { ...FULL, wht_payable_account_id: "" } }, []);
    await expect(assertAccountingReady()).rejects.toThrow(/gl_setting\.wht_payable_account_id.*open GL period covering/);
  });

  it("names a missing prefix", async () => {
    mock({ status: 200, value: { ...FULL, reversal_prefix_id: undefined } }, [periodOpen]);
    await expect(assertAccountingReady()).rejects.toThrow(/reversal_prefix_id \(prefix\).*run data:reset/);
  });

  it("names a gl_setting that does not exist", async () => {
    mock({ status: 404 }, [periodOpen]);
    await expect(assertAccountingReady()).rejects.toThrow(/gl_setting \(not created\)/);
  });
});
