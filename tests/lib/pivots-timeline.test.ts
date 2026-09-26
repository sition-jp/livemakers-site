import { describe, it, expect } from "vitest";
import { buildTimelineModel, TIMELINE_LAYOUT } from "@/lib/pivots/timeline";
import type { BacktestEntry, DirectionBias, HistoryEntry, Horizon, RadarScores } from "@/lib/pivots/types";

const TODAY = "2026-09-26";

function scores(overall: number, pp = overall, vp = overall): RadarScores {
  return {
    overall,
    price_pivot: pp,
    volatility_pivot: vp,
    confidence_grade: "B",
    main_signal: "mixed",
  };
}

/** Same RadarScores reused for all three horizons — for tests that don't exercise T2 per-horizon variance. */
function uniformCurrent(overall: number, pp = overall, vp = overall): Record<Horizon, RadarScores> {
  const s = scores(overall, pp, vp);
  return { "7D": s, "30D": s, "90D": s };
}

/** Same DirectionBias (or null) reused for all three horizons. */
function uniformBias(bias: DirectionBias | null): Partial<Record<Horizon, DirectionBias | null>> {
  return { "7D": bias, "30D": bias, "90D": bias };
}

function bias(bullish: number, bearish: number): DirectionBias {
  return { bullish, bearish, neutral: 100 - bullish - bearish };
}

function entry(date: string, close: number, overall30: number, extra: Partial<HistoryEntry["overall"]> = {}): HistoryEntry {
  return {
    date,
    close,
    overall: { "7D": overall30, "30D": overall30, "90D": overall30, ...extra },
    lean: { "7D": 0, "30D": 0, "90D": 0 },
  };
}

function backtestEntry(overrides: Partial<BacktestEntry> = {}): BacktestEntry {
  return {
    asset: "BTC",
    horizon: "30D",
    score_type: "price_pivot",
    threshold: 70,
    period: { start: "2021-12-01", end: "2026-09-25" },
    metrics: {
      precision: 0.5,
      recall: 0.4,
      avg_lead_time_days: 12,
      false_positive_rate: 0.2,
      false_negative_rate: 0.3,
      average_move: 0.03,
      max_drawdown: -0.05,
      sample_size: 8,
    },
    ...overrides,
  };
}

describe("buildTimelineModel — no history (T5)", () => {
  it("past is null and all three windows are still produced", () => {
    const model = buildTimelineModel({
      asset: "BTC",
      today: TODAY,
      horizon: "30D",
      currentByHorizon: uniformCurrent(10),
      biasByHorizon: uniformBias(null),
      history: null,
      backtest: [],
    });
    expect(model.past).toBeNull();
    expect(model.windows.map((w) => w.horizon)).toEqual(["7D", "30D", "90D"]);
    expect(model.windows).toHaveLength(3);
  });

  it("also treats an empty history array as no past", () => {
    const model = buildTimelineModel({
      asset: "BTC",
      today: TODAY,
      horizon: "30D",
      currentByHorizon: uniformCurrent(10),
      biasByHorizon: uniformBias(null),
      history: [],
      backtest: [],
    });
    expect(model.past).toBeNull();
  });
});

describe("buildTimelineModel — past strip and markers", () => {
  const history: HistoryEntry[] = [
    entry("2026-09-17", 60000, 10),
    entry("2026-09-18", 60500, 20),
    entry("2026-09-19", 61000, 39),
    entry("2026-09-20", 61500, 40), // marker, not strong
    entry("2026-09-21", 62000, 55),
    entry("2026-09-22", 62500, 69),
    entry("2026-09-23", 63000, 70), // marker, strong
    entry("2026-09-24", 63500, 85), // marker, strong
    entry("2026-09-25", 64000, 30),
    entry("2026-09-26", 64500, 15),
  ];

  it("produces one strip cell per history day", () => {
    const model = buildTimelineModel({
      asset: "BTC",
      today: TODAY,
      horizon: "30D",
      currentByHorizon: uniformCurrent(10),
      biasByHorizon: uniformBias(null),
      history,
      backtest: [],
    });
    expect(model.past).not.toBeNull();
    expect(model.past!.strip).toHaveLength(10);
  });

  it("marks only days with overall >= 40, and strong only at >= 70", () => {
    const model = buildTimelineModel({
      asset: "BTC",
      today: TODAY,
      horizon: "30D",
      currentByHorizon: uniformCurrent(10),
      biasByHorizon: uniformBias(null),
      history,
      backtest: [],
    });
    const markers = model.past!.markers;
    expect(markers.map((m) => m.date)).toEqual([
      "2026-09-20",
      "2026-09-21",
      "2026-09-22",
      "2026-09-23",
      "2026-09-24",
    ]);
    expect(markers.find((m) => m.date === "2026-09-20")!.strong).toBe(false);
    expect(markers.find((m) => m.date === "2026-09-22")!.strong).toBe(false);
    expect(markers.find((m) => m.date === "2026-09-23")!.strong).toBe(true);
    expect(markers.find((m) => m.date === "2026-09-24")!.strong).toBe(true);
  });

  it("caps at the most recent 120 days when history is longer", () => {
    const long: HistoryEntry[] = Array.from({ length: 130 }, (_, i) => {
      const d = new Date("2026-01-01T00:00:00Z");
      d.setUTCDate(d.getUTCDate() + i);
      return entry(d.toISOString().slice(0, 10), 100 + i, 10);
    });
    const model = buildTimelineModel({
      asset: "BTC",
      today: long[long.length - 1].date,
      horizon: "30D",
      currentByHorizon: uniformCurrent(10),
      biasByHorizon: uniformBias(null),
      history: long,
      backtest: [],
    });
    expect(model.past!.strip).toHaveLength(120);
    expect(model.past!.points[0].x).toBeCloseTo(TIMELINE_LAYOUT.pastXStart);
  });
});

describe("buildTimelineModel — lean and opacity are per-horizon (T2)", () => {
  it("shades and leans each window by ITS OWN horizon: 7D quiet/no-lean, 30D up, 90D down", () => {
    const model = buildTimelineModel({
      asset: "BTC",
      today: TODAY,
      horizon: "30D",
      currentByHorizon: {
        "7D": scores(10), // Low
        "30D": scores(55), // Medium
        "90D": scores(78), // High
      },
      biasByHorizon: {
        "7D": bias(90, 5), // wide gap, but Low blocks lean regardless of bias
        "30D": bias(70, 30), // gap 40 >= 25 -> up
        "90D": bias(10, 80), // gap -70 -> down
      },
      history: null,
      backtest: [],
    });

    const w7 = model.windows.find((w) => w.horizon === "7D")!;
    const w30 = model.windows.find((w) => w.horizon === "30D")!;
    const w90 = model.windows.find((w) => w.horizon === "90D")!;

    expect(w7.level).toBe("Low");
    expect(w7.lean).toBeNull();
    expect(w30.level).toBe("Medium");
    expect(w30.lean).toBe("up");
    expect(w90.level).toBe("High");
    expect(w90.lean).toBe("down");

    // opacity tracks each window's OWN horizon score — not a single shared value.
    expect(w7.opacity).toBeCloseTo(0.12, 5); // max(0.12, 10/100)
    expect(w30.opacity).toBeCloseTo(0.55, 5);
    expect(w90.opacity).toBeCloseTo(0.78, 5);
    expect(w7.opacity).not.toBeCloseTo(w30.opacity, 2);
    expect(w30.opacity).not.toBeCloseTo(w90.opacity, 2);
    expect(w7.opacity).not.toBeCloseTo(w90.opacity, 2);
  });

  it("keeps the gap-threshold rule independently per horizon (< 25 stays null even at Medium+)", () => {
    const model = buildTimelineModel({
      asset: "BTC",
      today: TODAY,
      horizon: "30D",
      currentByHorizon: uniformCurrent(55), // Medium on every horizon
      biasByHorizon: {
        "7D": bias(45, 35), // gap 10 < 25 -> null
        "30D": bias(60, 20), // gap 40 -> up
        "90D": bias(20, 60), // gap -40 -> down
      },
      history: null,
      backtest: [],
    });
    expect(model.windows.find((w) => w.horizon === "7D")!.lean).toBeNull();
    expect(model.windows.find((w) => w.horizon === "30D")!.lean).toBe("up");
    expect(model.windows.find((w) => w.horizon === "90D")!.lean).toBe("down");
  });

  it("is null when a horizon has no entry at all in biasByHorizon", () => {
    const model = buildTimelineModel({
      asset: "BTC",
      today: TODAY,
      horizon: "30D",
      currentByHorizon: uniformCurrent(55),
      biasByHorizon: {}, // no keys for any horizon
      history: null,
      backtest: [],
    });
    expect(model.windows.every((w) => w.lean === null)).toBe(true);
  });
});

describe("buildTimelineModel — lead-time ticks (T3)", () => {
  it("includes only entries with sample_size > 0, marks weak when n < 5", () => {
    const backtest: BacktestEntry[] = [
      backtestEntry({ horizon: "7D", score_type: "price_pivot", metrics: { ...backtestEntry().metrics, sample_size: 12, avg_lead_time_days: 3 } }),
      backtestEntry({ horizon: "7D", score_type: "volatility_pivot", metrics: { ...backtestEntry().metrics, sample_size: 0, avg_lead_time_days: 4 } }),
      backtestEntry({ horizon: "30D", score_type: "price_pivot", metrics: { ...backtestEntry().metrics, sample_size: 3, avg_lead_time_days: 14 } }),
      backtestEntry({ horizon: "90D", score_type: "volatility_pivot", metrics: { ...backtestEntry().metrics, sample_size: 9, avg_lead_time_days: 40 } }),
      // wrong threshold — ignored
      backtestEntry({ horizon: "90D", score_type: "price_pivot", threshold: 80, metrics: { ...backtestEntry().metrics, sample_size: 20, avg_lead_time_days: 20 } }),
    ];
    const model = buildTimelineModel({
      asset: "BTC",
      today: TODAY,
      horizon: "30D",
      currentByHorizon: uniformCurrent(10),
      biasByHorizon: uniformBias(null),
      history: null,
      backtest,
    });
    const w7 = model.windows.find((w) => w.horizon === "7D")!;
    expect(w7.ticks).toHaveLength(1);
    expect(w7.ticks[0]).toMatchObject({ scoreType: "price_pivot", days: 3, n: 12, weak: false });

    const w30 = model.windows.find((w) => w.horizon === "30D")!;
    expect(w30.ticks).toHaveLength(1);
    expect(w30.ticks[0]).toMatchObject({ scoreType: "price_pivot", days: 14, n: 3, weak: true });

    const w90 = model.windows.find((w) => w.horizon === "90D")!;
    expect(w90.ticks).toHaveLength(1);
    expect(w90.ticks[0]).toMatchObject({ scoreType: "volatility_pivot", days: 40, n: 9, weak: false });
  });

  it("filters by asset — another asset's entries never leak in", () => {
    const backtest: BacktestEntry[] = [
      backtestEntry({ asset: "ETH", horizon: "30D", score_type: "price_pivot" }),
    ];
    const model = buildTimelineModel({
      asset: "BTC",
      today: TODAY,
      horizon: "30D",
      currentByHorizon: uniformCurrent(10),
      biasByHorizon: uniformBias(null),
      history: null,
      backtest,
    });
    expect(model.windows.find((w) => w.horizon === "30D")!.ticks).toHaveLength(0);
  });
});

describe("buildTimelineModel — example arrow (T4)", () => {
  it("builds a label-worthy example from the latest strong marker when the +H close exists", () => {
    // Use a 7D horizon so the target date (2026-09-04) can exist within a short history.
    const withTarget: HistoryEntry[] = [
      entry("2026-08-28", 59000, 75, {}),
      entry("2026-08-29", 59200, 10),
      entry("2026-08-30", 59400, 10),
      entry("2026-08-31", 59600, 10),
      entry("2026-09-01", 59800, 10),
      entry("2026-09-02", 60000, 10),
      entry("2026-09-03", 60200, 10),
      entry("2026-09-04", 61890, 10), // 2026-08-28 + 7D
    ];
    const model = buildTimelineModel({
      asset: "BTC",
      today: "2026-09-04",
      horizon: "7D",
      currentByHorizon: uniformCurrent(10),
      biasByHorizon: uniformBias(null),
      history: withTarget,
      backtest: [],
    });
    expect(model.past!.example).not.toBeNull();
    const ex = model.past!.example!;
    expect(ex.date).toBe("2026-08-28");
    expect(ex.score).toBe(75);
    expect(ex.days).toBe(7);
    expect(ex.movePct).toBeCloseTo(((61890 - 59000) / 59000) * 100, 5);
    expect(ex.fromX).toBeLessThan(ex.toX);
  });

  it("falls back to the first (earliest) marker when no strong marker exists", () => {
    const history: HistoryEntry[] = [
      entry("2026-08-28", 59000, 45), // first marker, not strong
      entry("2026-08-29", 59200, 50),
      entry("2026-08-30", 59400, 42),
      entry("2026-08-31", 59600, 10),
      entry("2026-09-01", 59800, 10),
      entry("2026-09-02", 60000, 10),
      entry("2026-09-03", 60200, 10),
      entry("2026-09-04", 60500, 10), // 2026-08-28 + 7D
    ];
    const model = buildTimelineModel({
      asset: "BTC",
      today: "2026-09-04",
      horizon: "7D",
      currentByHorizon: uniformCurrent(10),
      biasByHorizon: uniformBias(null),
      history,
      backtest: [],
    });
    expect(model.past!.example).not.toBeNull();
    expect(model.past!.example!.date).toBe("2026-08-28");
  });

  it("is null when there is no marker at all", () => {
    const history: HistoryEntry[] = [
      entry("2026-09-01", 60000, 10),
      entry("2026-09-02", 60100, 10),
    ];
    const model = buildTimelineModel({
      asset: "BTC",
      today: "2026-09-02",
      horizon: "7D",
      currentByHorizon: uniformCurrent(10),
      biasByHorizon: uniformBias(null),
      history,
      backtest: [],
    });
    expect(model.past!.example).toBeNull();
  });

  it("is null when the +H close does not exist in history", () => {
    const history: HistoryEntry[] = [
      entry("2026-09-01", 60000, 80), // strong marker but no +7D entry
      entry("2026-09-02", 60100, 10),
    ];
    const model = buildTimelineModel({
      asset: "BTC",
      today: "2026-09-02",
      horizon: "7D",
      currentByHorizon: uniformCurrent(10),
      biasByHorizon: uniformBias(null),
      history,
      backtest: [],
    });
    expect(model.past!.example).toBeNull();
  });
});

describe("buildTimelineModel — width scaling", () => {
  it("scales x coordinates proportionally to a non-default width", () => {
    const model = buildTimelineModel({
      asset: "BTC",
      today: TODAY,
      horizon: "30D",
      currentByHorizon: uniformCurrent(10),
      biasByHorizon: uniformBias(null),
      history: null,
      backtest: [],
      width: 340, // half of 680
    });
    expect(model.today).toBeCloseTo(TIMELINE_LAYOUT.todayX / 2, 5);
    expect(model.windows[0].x).toBeCloseTo(TIMELINE_LAYOUT.todayX / 2, 5);
  });
});
