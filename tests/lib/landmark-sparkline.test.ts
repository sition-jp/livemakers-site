import { describe, expect, it } from "vitest";
import sectionSeries from "../fixtures/landmark/section-2026-10-17-series.json";
import { mapLandmarkMeter, type LandmarkSeries } from "@/lib/landmark/meter-feed";
import { SPARK_HEIGHT, SPARK_WIDTH, buildSparkline } from "@/lib/landmark/sparkline";

// 計器盤の推移グラフ (core spec 2026-10-17-lvm-landmark-meter-sparkline-design §6)
const data = mapLandmarkMeter(structuredClone(sectionSeries))!;
const seriesOf = (key: string): LandmarkSeries => data.items.find((item) => item.key === key)!.series!;

const base: LandmarkSeries = {
  from: "2024-10-17",
  to: "2026-10-17",
  points: [["2024-10-17", 2], ["2025-10-17", 0.5], ["2026-10-17", 1.5]],
  events: ["2025-10-17"],
  ref: 1,
};

describe("buildSparkline", () => {
  it("picks bars for MACD rows, a running high for ETF and supply rows, and a line otherwise", () => {
    const kinds = Object.fromEntries(data.items.map((item) => [item.key, buildSparkline(item.key, item.series!).kind]));
    expect(kinds).toEqual({
      btc_below_200wma: "line",
      btc_macd_2w_golden_below_zero: "bars",
      btc_macd_1m_golden_cross: "bars",
      btc_mvrv_1: "line",
      btc_funding_30d_negative: "line",
      btc_etf_cum_high: "peak",
      eth_etf_cum_high: "peak",
      stablecoin_supply_yoy_flip: "line",
      stablecoin_supply_ath: "peak",
    });
  });

  it("places dates on x across the window and values on y with the reference inside", () => {
    const g = buildSparkline("btc_mvrv_1", base);
    const xy = g.line!.split(" ").map((pair) => pair.split(",").map(Number));
    expect(xy[0][0]).toBe(0);
    expect(xy[2][0]).toBe(SPARK_WIDTH);
    expect(xy[1][0]).toBeCloseTo((365 / 730) * SPARK_WIDTH, 1);
    // 大きい値ほど上 (y が小さい)。上下に余白を取り、枠の中に収める
    expect(xy[0][1]).toBeLessThan(xy[2][1]);
    expect(xy[2][1]).toBeLessThan(xy[1][1]);
    for (const [, y] of xy) {
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(SPARK_HEIGHT);
    }
    expect(g.refY).toBeGreaterThan(xy[2][1]);
    expect(g.refY).toBeLessThan(xy[1][1]);
    expect(g.events).toEqual([expect.closeTo(150, 1)]);
    expect(g.now).toEqual({ leftPct: 100, top: xy[2][1] });
    expect(g.bars).toEqual([]);
    expect(g.peak).toBeNull();
  });

  it("keeps a reference line that is outside the values inside the frame", () => {
    const g = buildSparkline("stablecoin_supply_yoy_flip", {
      ...base,
      points: [["2025-01-01", 40], ["2026-10-16", 30]],
      events: [],
      ref: 0,
    });
    expect(g.refY).toBeGreaterThan(0);
    expect(g.refY).toBeLessThan(SPARK_HEIGHT);
  });

  it("does not divide by zero on a flat series", () => {
    const g = buildSparkline("btc_mvrv_1", { ...base, points: [["2026-10-16", 1], ["2026-10-17", 1]], events: [] });
    expect(g.line).not.toMatch(/NaN|Infinity/);
    expect(g.refY).not.toBeNaN();
  });

  it("marks the year boundaries inside the window", () => {
    expect(buildSparkline("btc_mvrv_1", base).ticks.map((tick) => tick.label)).toEqual(["2025", "2026"]);
    const tick = buildSparkline("btc_mvrv_1", base).ticks[0];
    expect(tick.leftPct).toBeCloseTo((76 / 730) * 100, 1);
  });

  it("draws MACD as bars from the zero line with the latest bar and the above-zero bars told apart", () => {
    const g = buildSparkline("btc_macd_2w_golden_below_zero", seriesOf("btc_macd_2w_golden_below_zero"));
    const series = seriesOf("btc_macd_2w_golden_below_zero");
    expect(g.bars).toHaveLength(series.points.length);
    expect(g.bars.at(-1)!.tone).toBe("now");
    expect(g.bars.filter((bar) => bar.tone === "outside")).toHaveLength(series.aboveZero!.length);
    expect(g.line).toBeNull();
    expect(g.now).toBeNull();
    // 正の棒は 0 の線の上に、負の棒は下に
    for (const [index, [, value]] of series.points.entries()) {
      const bar = g.bars[index];
      if (value > 0) expect(bar.y + bar.height).toBeCloseTo(g.refY!, 5);
      if (value < 0) expect(bar.y).toBeCloseTo(g.refY!, 5);
      expect(bar.width).toBeGreaterThan(0);
      expect(bar.width).toBeLessThanOrEqual(10);
    }
    expect(buildSparkline("btc_macd_1m_golden_cross", seriesOf("btc_macd_1m_golden_cross")).bars
      .filter((bar) => bar.tone === "outside")).toEqual([]);
  });

  it("draws the running high as a step line on top of the cumulative line", () => {
    const g = buildSparkline("btc_etf_cum_high", seriesOf("btc_etf_cum_high"));
    expect(g.peak).not.toBeNull();
    expect(g.refY).toBeNull();
    const step = g.peak!.split(" ").map((pair) => pair.split(",").map(Number));
    // 階段: 同じ x で高さが変わる角を持つ
    expect(step.length).toBeGreaterThan(seriesOf("btc_etf_cum_high").peak!.length);
    for (let i = 1; i < step.length; i += 1) expect(step[i][0]).toBeGreaterThanOrEqual(step[i - 1][0]);
  });

  it("gives every real row coordinates inside the frame", () => {
    for (const item of data.items) {
      const g = buildSparkline(item.key, item.series!);
      const numbers = [
        ...(g.line ?? "").split(/[ ,]/).filter(Boolean).map(Number),
        ...(g.peak ?? "").split(/[ ,]/).filter(Boolean).map(Number),
        ...g.bars.flatMap((bar) => [bar.x, bar.y, bar.x + bar.width, bar.y + bar.height]),
        ...g.events,
      ];
      for (const n of numbers) {
        expect(n, item.key).toBeGreaterThanOrEqual(-6);
        expect(n, item.key).toBeLessThanOrEqual(SPARK_WIDTH + 6);
      }
    }
  });
});
