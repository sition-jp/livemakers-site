import { describe, expect, test } from "vitest";

import { describeState, scoreDelta, DIRECTION_GAP, DRIVER_TIE } from "@/lib/pivots/describe";

describe("describeState", () => {
  test("live BTC 30D 2026-09-26: low, price-driven, direction hidden", () => {
    const s = describeState({ overall: 16, price_pivot: 15, volatility_pivot: 0, direction_bias: { bullish: 0, bearish: 100, neutral: 0 } });
    expect(s).toEqual({ level: "Low", driver: "price", direction: "down", showDirection: false });
  });
  test("medium + volatility-driven + flat bias", () => {
    const s = describeState({ overall: 45, price_pivot: 20, volatility_pivot: 60, direction_bias: { bullish: 40, bearish: 35, neutral: 25 } });
    expect(s.level).toBe("Medium");
    expect(s.driver).toBe("volatility");
    expect(s.direction).toBe("flat");
    expect(s.showDirection).toBe(true);
  });
  test(`driver is mixed when |vp - pp| <= ${DRIVER_TIE}`, () => {
    expect(describeState({ overall: 70, price_pivot: 60, volatility_pivot: 70 }).driver).toBe("mixed");
    expect(describeState({ overall: 70, price_pivot: 60, volatility_pivot: 71 }).driver).toBe("volatility");
  });
  test(`direction needs a gap of ${DIRECTION_GAP} points`, () => {
    expect(describeState({ overall: 75, price_pivot: 75, volatility_pivot: 0, direction_bias: { bullish: 62, bearish: 38, neutral: 0 } }).direction).toBe("flat");
    expect(describeState({ overall: 75, price_pivot: 75, volatility_pivot: 0, direction_bias: { bullish: 63, bearish: 38, neutral: -1 } }).direction).toBe("up");
  });
  test("main_signal from the radar row overrides the pp/vp inference", () => {
    expect(describeState({ overall: 30, price_pivot: 0, volatility_pivot: 30, main_signal: "mixed" }).driver).toBe("mixed");
  });
  test("Extreme keeps direction visible", () => {
    expect(describeState({ overall: 90, price_pivot: 90, volatility_pivot: 90 }).showDirection).toBe(true);
  });
});

describe("scoreDelta", () => {
  test("rounds both sides before subtracting", () => {
    expect(scoreDelta(16.4, 15.6)).toBe(0);
    expect(scoreDelta(27, 16)).toBe(11);
    expect(scoreDelta(15, 16.6)).toBe(-2);
  });
  test("null when there is no previous", () => {
    expect(scoreDelta(16, null)).toBeNull();
    expect(scoreDelta(16, undefined)).toBeNull();
  });
});
