import { describe, expect, it } from "vitest";
import section from "../fixtures/landmark/section.json";
import { LANDMARK_ROW_KEYS, mapLandmarkMeter } from "@/lib/landmark/meter-feed";

// SDE livemakers_export.landmark_meter.project の 2026-10-16 19:45 JST の出力 (core spec 2026-10-16-lvm-landmark-meter-design)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const clone = (): any => structuredClone(section);

describe("mapLandmarkMeter", () => {
  it("maps the six rows of the real 2026-10-16 section", () => {
    const data = mapLandmarkMeter(clone());
    expect(data?.items.map((item) => item.key)).toEqual([...LANDMARK_ROW_KEYS]);
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
    ["an unknown key", (s) => { s.items[0].key = "btc_macd_1m_golden_below_zero"; }],
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

  it("returns null for non-objects", () => {
    expect(mapLandmarkMeter(undefined)).toBeNull();
    expect(mapLandmarkMeter("x")).toBeNull();
  });
});
