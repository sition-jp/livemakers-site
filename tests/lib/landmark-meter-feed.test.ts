import { describe, expect, it } from "vitest";
import section from "../fixtures/landmark/section.json";
import section17 from "../fixtures/landmark/section-2026-10-17.json";
import { LANDMARK_ROW_KEYS, mapLandmarkMeter } from "@/lib/landmark/meter-feed";

// SDE livemakers_export.landmark_meter.project の 2026-10-16 19:45 JST の出力 (core spec 2026-10-16-lvm-landmark-meter-design)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const clone = (): any => structuredClone(section);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const clone17 = (): any => structuredClone(section17);

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
    expect(LANDMARK_ROW_KEYS).toHaveLength(8);
    expect(data?.items.map((item) => item.key)).toEqual([...LANDMARK_ROW_KEYS]);
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
