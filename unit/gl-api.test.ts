import { beforeEach, describe, expect, it, vi } from "vitest";

import { assertAccountingReady, withGlSetting } from "../tests/helpers/gl-api";

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

describe("assertAccountingReady", () => {
  const today = new Date();
  const periodOpen = {
    status: "open",
    start_at: new Date(today.getFullYear(), 0, 1).toISOString(),
    end_at: new Date(today.getFullYear() + 1, 0, 1).toISOString(),
  };
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
