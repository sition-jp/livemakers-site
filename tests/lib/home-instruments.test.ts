import { describe, expect, it } from "vitest";

import {
  CHARTABLE_INSTRUMENTS,
  CORE_12_INSTRUMENTS,
  INSTRUMENT_DISPLAY_NAMES_JA,
  LANE_ROWS,
  assertLaneRowsExcludeCore12,
} from "@/lib/home/instruments";
import {
  SnapshotSchema,
  loadMarketSnapshot,
} from "@/lib/home/market-snapshot";

describe("instrument registry + exclusion guard", () => {
  it("fixes the 12 core instruments (STN_MKT canon)", () => {
    expect(CORE_12_INSTRUMENTS).toEqual([
      "btc_usd",
      "eth_usd",
      "ada_usd",
      "night_usdt",
      "spx",
      "nikkei_futures",
      "dxy",
      "usd_jpy",
      "gold",
      "wti",
      "us10y",
      "vix",
    ]);
  });

  it("keeps every lane complement row disjoint from the core 12", () => {
    expect(() => assertLaneRowsExcludeCore12(LANE_ROWS)).not.toThrow();
    expect(LANE_ROWS.macro.map((row) => row.instrumentId)).toEqual([
      "nasdaq",
      "dow",
      "brent",
    ]);
    expect(LANE_ROWS.crypto.map((row) => row.instrumentId)).toEqual([
      "xrp_usd",
      "sol_usd",
      "coin_stock",
    ]);
    expect(LANE_ROWS.rwa.map((row) => row.instrumentId)).toEqual([
      "rwa_tvl",
      "tokenized_treasuries",
      "tokenized_mmf",
    ]);
  });

  it("throws when a core instrument leaks into a lane", () => {
    expect(() =>
      assertLaneRowsExcludeCore12({
        ...LANE_ROWS,
        macro: [
          ...LANE_ROWS.macro,
          { instrumentId: "vix", nameJa: "VIX" },
        ],
      }),
    ).toThrow(/duplicates core-12 instrument: vix/);
  });

  it("defines the chartable set as core 12 + market complements only", () => {
    expect(CHARTABLE_INSTRUMENTS).toEqual([
      ...CORE_12_INSTRUMENTS,
      "nasdaq",
      "dow",
      "brent",
      "xrp_usd",
      "sol_usd",
      "coin_stock",
    ]);
  });

  it("provides reader-facing labels for every chartable instrument", () => {
    expect(
      CHARTABLE_INSTRUMENTS.every(
        (instrumentId) => INSTRUMENT_DISPLAY_NAMES_JA[instrumentId],
      ),
    ).toBe(true);
    expect(INSTRUMENT_DISPLAY_NAMES_JA.nikkei_futures).toBe("日経平均先物");
    expect(INSTRUMENT_DISPLAY_NAMES_JA.usd_jpy).toBe("USD/JPY");
    expect(INSTRUMENT_DISPLAY_NAMES_JA.btc_usd).toBe("BTC/USD");
  });

  it("loads the market snapshot fixture with full as-of ISO and complete cells", () => {
    const snapshot = loadMarketSnapshot();
    expect(snapshot.packetId).toBe("mkt12_20260710_am");
    expect(snapshot.asOfJst).toBe("2026-07-10T07:58:00+09:00");
    expect(snapshot.asOfLabel).toBe("07:58 JST");
    expect(
      CORE_12_INSTRUMENTS.every((instrumentId) =>
        snapshot.cells.some((cell) => cell.instrumentId === instrumentId),
      ),
    ).toBe(true);
    const btc = snapshot.cells.find(
      (cell) => cell.instrumentId === "btc_usd",
    );
    expect(btc?.value).toBe("$63,299");
    expect(btc?.changeLabel).toBe("+1.72%");
  });

  it("rejects half-null cells, duplicate ids, and as-of mismatch", () => {
    const snapshot = loadMarketSnapshot();
    const broken = {
      ...snapshot,
      cells: snapshot.cells.map((cell, index) =>
        index === 0 ? { ...cell, value: null } : cell,
      ),
    };
    expect(() => SnapshotSchema.parse(broken)).toThrow(
      /all-null or all-present/,
    );
    expect(() =>
      SnapshotSchema.parse({ ...snapshot, asOfLabel: "09:00 JST" }),
    ).toThrow(/asOfLabel must equal/);
    expect(() =>
      SnapshotSchema.parse({ ...snapshot, asOfLabel: "07:58 invalid" }),
    ).toThrow(/asOfLabel must equal/);
    expect(() =>
      SnapshotSchema.parse({
        ...snapshot,
        cells: [...snapshot.cells, snapshot.cells[0]],
      }),
    ).toThrow(/duplicate instrumentId/);
  });
});
