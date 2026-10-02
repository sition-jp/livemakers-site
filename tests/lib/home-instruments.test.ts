import { describe, expect, it } from "vitest";
import {
  CHARTABLE_INSTRUMENTS,
  CORE_INSTRUMENTS,
  INSTRUMENT_DISPLAY_NAMES_JA,
  LANE_ROWS,
  assertLaneRowsExcludeCore,
} from "@/lib/home/instruments";

describe("home instrument registry (spec 2026-10-02 §4-1)", () => {
  it("chartable registry is the 15 instruments in SDE order", () => {
    expect(CHARTABLE_INSTRUMENTS).toEqual([
      "btc_usd", "eth_usd", "spx", "nikkei_futures", "eur_usd",
      "usd_jpy", "gold", "wti", "us10y", "btc_vol",
      "nasdaq", "brent", "xrp_usd", "sol_usd", "coin_stock",
    ]);
  });

  it("core is the first ten and excludes ADA / NIGHT (D3)", () => {
    expect(CORE_INSTRUMENTS).toEqual(CHARTABLE_INSTRUMENTS.slice(0, 10));
    expect(CORE_INSTRUMENTS as readonly string[]).not.toContain("ada_usd");
    expect(CORE_INSTRUMENTS as readonly string[]).not.toContain("night_usd");
  });

  it("display names match the SDE registry exactly", () => {
    expect(INSTRUMENT_DISPLAY_NAMES_JA).toEqual({
      btc_usd: "BTC/USD",
      eth_usd: "ETH/USD",
      spx: "S&P 500（perp）",
      nikkei_futures: "日経225（perp）",
      eur_usd: "EUR/USD（perp）",
      usd_jpy: "USD/JPY（perp）",
      gold: "Gold（perp）",
      wti: "WTI（perp）",
      us10y: "米10年金利",
      btc_vol: "BTCボラティリティ（BVIV）",
      nasdaq: "米テック100（perp）",
      brent: "Brent（perp）",
      xrp_usd: "XRP/USD",
      sol_usd: "SOL/USD",
      coin_stock: "COIN（perp）",
      rwa_tvl: "RWA TVL",
    });
  });

  it("lanes: macro = nasdaq/brent, crypto = xrp/sol/coin, rwa = rwa_tvl", () => {
    expect(LANE_ROWS.macro.map((row) => row.instrumentId)).toEqual(["nasdaq", "brent"]);
    expect(LANE_ROWS.crypto.map((row) => row.instrumentId)).toEqual(["xrp_usd", "sol_usd", "coin_stock"]);
    expect(LANE_ROWS.rwa.map((row) => row.instrumentId)).toEqual(["rwa_tvl"]);
    expect(() => assertLaneRowsExcludeCore(LANE_ROWS)).not.toThrow();
  });

  it("assertLaneRowsExcludeCore throws when a lane duplicates a core instrument", () => {
    const rows = {
      ...LANE_ROWS,
      macro: [...LANE_ROWS.macro, { instrumentId: "btc_vol" as const, nameJa: "x" }],
    };
    expect(() => assertLaneRowsExcludeCore(rows)).toThrow(/duplicates core instrument: btc_vol/);
  });
});
