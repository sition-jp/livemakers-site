import { describe, expect, it } from "vitest";
import section from "../fixtures/landmark/section.json";
import section17 from "../fixtures/landmark/section-2026-10-17.json";
import sectionEve from "../fixtures/landmark/section-2026-10-17-evening.json";
import sectionSeries from "../fixtures/landmark/section-2026-10-17-series.json";
import { LANDMARK_ROW_KEYS, mapLandmarkMeter } from "@/lib/landmark/meter-feed";

// SDE livemakers_export.landmark_meter.project の 2026-10-16 19:45 JST の出力 (core spec 2026-10-16-lvm-landmark-meter-design)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const clone = (): any => structuredClone(section);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const clone17 = (): any => structuredClone(section17);
// SDE の 2026-10-17 19:45 JST の出力 (ETH 現物 ETF の行が初めて入った回・core spec 2026-10-17-lvm-landmark-meter-eth-etf-row-design)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cloneEve = (): any => structuredClone(sectionEve);

describe("mapLandmarkMeter", () => {
  it("maps the six rows of the real 2026-10-16 section (the feed before the stablecoin rows)", () => {
    const data = mapLandmarkMeter(clone());
    expect(data?.items.map((item) => item.key)).toEqual([...LANDMARK_ROW_KEYS.slice(0, 6)]);
    expect(data?.items[2].dead).toBeUndefined();
    expect(data?.generatedAtJst).toBe("2026-10-16T19:45:00+09:00");
    expect(data?.items[0]).toMatchObject({ state: "cooldown", eligibleFrom: "2027-08-22", sinceYear: 2014 });
    expect(data?.items[0].values.gapPct).toBe("+25.8%");
    expect(data?.items[3].recover).toEqual({ state: "waiting_premise", lastEvent: "2023-01-26", count: 5 });
    expect(data?.items[5].values.peakDate).toBe("2025-10-09");
  });

  const cases: [string, (s: ReturnType<typeof clone>) => void][] = [
    ["a unit word inside a number", (s) => { s.items[0].values.close = "83,637 ドル"; }],
    ["a missing value", (s) => { delete s.items[0].values.ma; }],
    ["an extra value", (s) => { s.items[4].values.extra = "1"; }],
    ["a state the row cannot take", (s) => { s.items[0].state = "after_cross"; }],
    ["cooldown without eligibleFrom", (s) => { s.items[0].eligibleFrom = null; }],
    ["eligibleFrom outside cooldown", (s) => { s.items[1].eligibleFrom = "2027-01-01"; }],
    ["recover on a non-MVRV row", (s) => { s.items[0].recover = { state: "armed", lastEvent: null, count: 0 }; }],
    ["MVRV without recover", (s) => { delete s.items[3].recover; }],
    ["a bad recover state", (s) => { s.items[3].recover.state = "cooldown"; }],
    ["a duplicate key", (s) => { s.items[1] = structuredClone(s.items[0]); }],
    ["an unknown schemaVersion", (s) => { s.schemaVersion = "livemakers_landmark_v9"; }],
    ["an extra top-level key", (s) => { s.extra = 1; }],
    ["a non-JST checkedAt", (s) => { s.items[0].checkedAtJst = "2026-10-16T10:15:04+00:00"; }],
    ["a boolean count", (s) => { s.items[0].count = true; }],
    ["a slashed date", (s) => { s.items[0].barDate = "2026/10/11"; }],
    ["no items", (s) => { s.items = []; }],
  ];

  it.each(cases)("returns null on %s", (_name, mutate) => {
    const bad = clone();
    mutate(bad);
    expect(mapLandmarkMeter(bad)).toBeNull();
  });

  it("maps the eight rows of the real 2026-10-17 section (core spec 2026-10-17 stablecoin rows)", () => {
    const data = mapLandmarkMeter(clone17());
    // 10/17 朝の feed には ETH 現物 ETF の行がまだ無い
    expect(data?.items.map((item) => item.key)).toEqual(LANDMARK_ROW_KEYS.filter((key) => key !== "eth_etf_cum_high"));
    expect(data?.items[2].dead).toEqual({ state: "after_cross", lastEvent: "2025-11-30", count: 6 });
    expect(data?.items[6]).toMatchObject({
      key: "stablecoin_supply_yoy_flip",
      lastDirection: "positive",
      values: { yoyPct: "+0.30%", supply: "3,052" },
    });
    expect(data?.items[7].values).toEqual({ supply: "3,052", peak: "3,155", toPeak: "103", peakDate: "2026-05-17" });
  });

  it("drops rows with keys it does not know and keeps the rest", () => {
    const retired = clone();
    retired.items[0].key = "btc_macd_1m_golden_below_zero";
    expect(mapLandmarkMeter(retired)?.items.map((item) => item.key)).toEqual([...LANDMARK_ROW_KEYS.slice(1, 6)]);
    const added = clone17();
    added.items.push({ key: "something_new", whatever: 1 }, "x", null);
    expect(mapLandmarkMeter(added)?.items).toHaveLength(8);
    const onlyUnknown = clone();
    onlyUnknown.items = [{ key: "something_new" }];
    expect(mapLandmarkMeter(onlyUnknown)).toBeNull();
    const huge = clone();
    huge.items = [...huge.items, ...Array.from({ length: 27 }, () => ({ key: "something_new" }))]; // 33 件
    expect(mapLandmarkMeter(huge)).toBeNull();
  });

  const cases17: [string, (s: ReturnType<typeof clone17>) => void][] = [
    ["a yoy row without lastDirection", (s) => { delete s.items[6].lastDirection; }],
    ["a bad lastDirection", (s) => { s.items[6].lastDirection = "up"; }],
    ["lastDirection on another row", (s) => { s.items[7].lastDirection = "positive"; }],
    ["dead on the 2-week row", (s) => { s.items[1].dead = { state: "armed", lastEvent: null, count: 0 }; }],
    ["a bad dead state", (s) => { s.items[2].dead.state = "cooldown"; }],
    ["an extra key in dead", (s) => { s.items[2].dead.extra = 1; }],
    ["a unit word in the supply", (s) => { s.items[7].values.supply = "3,052 億"; }],
    ["a missing stablecoin value", (s) => { delete s.items[6].values.supply; }],
    ["a duplicate stablecoin row", (s) => { s.items.push(structuredClone(s.items[6])); }],
  ];

  it.each(cases17)("returns null on %s", (_name, mutate) => {
    const bad = clone17();
    mutate(bad);
    expect(mapLandmarkMeter(bad)).toBeNull();
  });

  it("returns null for non-objects", () => {
    expect(mapLandmarkMeter(undefined)).toBeNull();
    expect(mapLandmarkMeter("x")).toBeNull();
  });
});

describe("mapLandmarkMeter — ETH spot ETF row (2026-10-17 evening)", () => {
  it("maps the nine rows of the real 2026-10-17 evening section", () => {
    const data = mapLandmarkMeter(cloneEve());
    expect(LANDMARK_ROW_KEYS).toHaveLength(9);
    expect(LANDMARK_ROW_KEYS.slice(5, 7)).toEqual(["btc_etf_cum_high", "eth_etf_cum_high"]);
    expect(data?.items.map((item) => item.key)).toEqual([...LANDMARK_ROW_KEYS]);
    expect(data?.items[6]).toEqual({
      key: "eth_etf_cum_high",
      checkedAtJst: "2026-10-17T19:15:08+09:00",
      barDate: "2026-10-16",
      nextCheck: null,
      state: "armed",
      eligibleFrom: null,
      lastEvent: "2025-06-03",
      count: 2,
      sinceYear: 2024,
      values: { cum: "129.7", peak: "151.1", toPeak: "21.4", peakDate: "2025-10-08" },
    });
    expect(data?.items[5].values.toPeak).toBe("58.1");
  });

  const casesEve: [string, (s: ReturnType<typeof cloneEve>) => void][] = [
    ["a unit word in the ETH total", (s) => { s.items[6].values.cum = "129.7 億"; }],
    ["a missing ETH value", (s) => { delete s.items[6].values.toPeak; }],
    ["stablecoin values on the ETH row", (s) => { s.items[6].values = { supply: "129.7", peak: "151.1", toPeak: "21.4", peakDate: "2025-10-08" }; }],
    ["a state the ETH row cannot take", (s) => { s.items[6].state = "after_cross"; }],
    ["lastDirection on the ETH row", (s) => { s.items[6].lastDirection = "positive"; }],
    ["dead on the ETH row", (s) => { s.items[6].dead = { state: "armed", lastEvent: null, count: 0 }; }],
    ["a duplicate ETH row", (s) => { s.items.push(structuredClone(s.items[6])); }],
  ];

  it.each(casesEve)("returns null on %s", (_name, mutate) => {
    const bad = cloneEve();
    mutate(bad);
    expect(mapLandmarkMeter(bad)).toBeNull();
  });
});

// 2026-10-18: 推移グラフの系列 (行に任意の series・core spec 2026-10-17-lvm-landmark-meter-sparkline-design §5-4)。
// fixture = SDE の 10/17 19:45 JST の出力そのもの (状態ファイルの写し + 実データの系列ファイル)
describe("mapLandmarkMeter — sparkline series", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cloneSeries = (): any => structuredClone(sectionSeries);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const index = (s: any, key: string): number => s.items.findIndex((item: { key: string }) => item.key === key);

  it("maps the series of all nine rows of the real SDE output", () => {
    const data = mapLandmarkMeter(cloneSeries());
    expect(data?.items).toHaveLength(9);
    for (const item of data!.items) {
      expect(item.series, item.key).toBeDefined();
      expect([item.series!.from, item.series!.to]).toEqual(["2024-10-17", "2026-10-17"]);
      expect(item.series!.points.at(-1)![0]).toBe(item.barDate);
    }
    const wma = data!.items[0].series!;
    expect(wma.ref).toBe(1);
    expect(wma.events).toEqual(["2026-06-28"]);
    expect(wma.points.at(-1)).toEqual(["2026-10-11", 1.2576]);
    const etf = data!.items[5].series!;
    expect(etf.ref).toBeUndefined();
    expect(etf.peak).toHaveLength(etf.points.length);
    expect(data!.items[1].series!.aboveZero!.length).toBeGreaterThan(0);
  });

  it("keeps the items unchanged when the feed has no series", () => {
    const data = mapLandmarkMeter(cloneEve());
    expect(data?.items).toHaveLength(9);
    expect(data!.items.every((item) => !("series" in item))).toBe(true);
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const broken: [string, string, (series: any) => void][] = [
    ["an extra key", "btc_below_200wma", (s) => { s.extra = 1; }],
    ["no ref on a ref row", "btc_below_200wma", (s) => { delete s.ref; }],
    ["peak on a ref row", "btc_below_200wma", (s) => { s.peak = s.points; }],
    ["ref on a peak row", "btc_etf_cum_high", (s) => { s.ref = 0; }],
    ["no peak on a peak row", "eth_etf_cum_high", (s) => { delete s.peak; }],
    ["aboveZero outside the 2-week row", "btc_macd_1m_golden_cross", (s) => { s.aboveZero = []; }],
    ["a window that is not 730 days", "btc_mvrv_1", (s) => { s.from = "2024-10-18"; }],
    ["points out of order", "btc_funding_30d_negative", (s) => { s.points.reverse(); }],
    ["a repeated date", "btc_funding_30d_negative", (s) => { s.points.push(s.points.at(-1)); }],
    ["a last point that is not the bar", "btc_below_200wma", (s) => { s.points.pop(); }],
    ["a point outside the window", "btc_mvrv_1", (s) => { s.points.unshift(["2024-10-01", 2]); }],
    ["no points", "btc_mvrv_1", (s) => { s.points = []; }],
    ["too many points", "btc_mvrv_1", (s) => { s.points = [...s.points, ...s.points]; }],
    ["a string value", "stablecoin_supply_yoy_flip", (s) => { s.points[0][1] = "0.30"; }],
    ["a boolean value", "stablecoin_supply_yoy_flip", (s) => { s.points[0][1] = true; }],
    ["a three-element point", "stablecoin_supply_yoy_flip", (s) => { s.points[0].push(1); }],
    ["repeated events", "btc_below_200wma", (s) => { s.events = ["2026-06-28", "2026-06-28"]; }],
    ["an event outside the window", "btc_below_200wma", (s) => { s.events = ["2023-06-28"]; }],
    ["too many events", "btc_below_200wma", (s) => {
      s.events = Array.from({ length: 13 }, (_, i) => `2026-06-${String(i + 1).padStart(2, "0")}`);
    }],
    ["a shorter peak", "btc_etf_cum_high", (s) => { s.peak.pop(); }],
    ["a peak below the value", "btc_etf_cum_high", (s) => { s.peak.at(-1)[1] = 0; }],
    ["a falling peak", "stablecoin_supply_ath", (s) => { s.peak[0][1] = 99999; }],
    ["aboveZero dates that are not bars", "btc_macd_2w_golden_below_zero", (s) => { s.aboveZero = ["2019-01-01"]; }],
  ];

  it.each(broken)("drops only the series on %s", (_, key, mutate) => {
    const raw = cloneSeries();
    mutate(raw.items[index(raw, key)].series);
    const data = mapLandmarkMeter(raw);
    expect(data?.items).toHaveLength(9);
    const item = data!.items.find((candidate) => candidate.key === key)!;
    expect(item.series).toBeUndefined();
    expect(item.values).toEqual(sectionSeries.items[index(sectionSeries, key)].values);
    expect(data!.items.filter((candidate) => candidate.series).length).toBe(8);
  });

  it("drops only the series when it is not an object at all", () => {
    const raw = cloneSeries();
    raw.items[0].series = "1.2576";
    const data = mapLandmarkMeter(raw);
    expect(data?.items[0].series).toBeUndefined();
    expect(data?.items[0].values.gapPct).toBe("+25.8%");
  });
});
