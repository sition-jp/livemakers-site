import { describe, it, test, expect } from "vitest";
import {
  BacktestMetricsSchema,
  DirectionBiasSchema,
  HistoryEntrySchema,
  PivotAssetsSnapshotSchema,
  PivotBacktestSnapshotSchema,
  ScoreHistorySchema,
  scoreLevel,
  worstForwardReturn,
} from "@/lib/pivots/types";

describe("DirectionBiasSchema sum=100 invariant", () => {
  it("accepts a valid 100-sum bias", () => {
    const r = DirectionBiasSchema.safeParse({
      bullish: 46,
      bearish: 38,
      neutral: 16,
    });
    expect(r.success).toBe(true);
  });

  it("accepts decimal noise within ±0.5 tolerance", () => {
    const r = DirectionBiasSchema.safeParse({
      bullish: 33.3,
      bearish: 33.3,
      neutral: 33.3,
    });
    expect(r.success).toBe(true);
  });

  it("rejects 80/80/80 (sum=240) — Codex P2 case", () => {
    const r = DirectionBiasSchema.safeParse({
      bullish: 80,
      bearish: 80,
      neutral: 80,
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].message).toMatch(/must sum to 100/);
    }
  });

  it("rejects 50/30/10 (sum=90) — under-sum", () => {
    const r = DirectionBiasSchema.safeParse({
      bullish: 50,
      bearish: 30,
      neutral: 10,
    });
    expect(r.success).toBe(false);
  });

  it("rejects negative values via base 0-100 constraint before sum check", () => {
    const r = DirectionBiasSchema.safeParse({
      bullish: -5,
      bearish: 50,
      neutral: 55,
    });
    expect(r.success).toBe(false);
  });
});

describe("PivotAssetsSnapshotSchema rejects malformed direction_bias", () => {
  it("rejects a snapshot whose detail block has bias not summing to 100", () => {
    const malformed = {
      schema_version: "v0.1",
      generated_at: "2026-05-04T00:00:00Z",
      radar: [
        {
          symbol: "BTC",
          scores: {
            "7D": {
              overall: 70,
              price_pivot: 60,
              volatility_pivot: 80,
              confidence_grade: "B+",
              main_signal: "volatility",
            },
            "30D": {
              overall: 70,
              price_pivot: 60,
              volatility_pivot: 80,
              confidence_grade: "B+",
              main_signal: "volatility",
            },
            "90D": {
              overall: 70,
              price_pivot: 60,
              volatility_pivot: 80,
              confidence_grade: "B+",
              main_signal: "volatility",
            },
          },
        },
      ],
      detail: {
        BTC__30D: {
          asset: { symbol: "BTC", name: "Bitcoin" },
          horizon: "30D",
          timestamp: "2026-05-04T00:00:00Z",
          scores: {
            overall: 70,
            price_pivot: 60,
            volatility_pivot: 80,
            confidence: { grade: "B+", score: 70 },
          },
          // Sum = 240, intentionally malformed
          direction_bias: { bullish: 80, bearish: 80, neutral: 80 },
          evidence: [],
          summary: {
            level: "High",
            headline: "x",
            explanation: "y",
          },
        },
      },
    };
    const r = PivotAssetsSnapshotSchema.safeParse(malformed);
    expect(r.success).toBe(false);
  });
});

describe("scoreLevel boundaries (PRD §12)", () => {
  it.each([
    [0, "Low"],
    [39, "Low"],
    [40, "Medium"],
    [69, "Medium"],
    [70, "High"],
    [84, "High"],
    [85, "Extreme"],
    [100, "Extreme"],
  ])("score %d → %s", (score, level) => {
    expect(scoreLevel(score)).toBe(level);
  });
});

describe("BacktestMetricsSchema transition (D6)", () => {
  const base = {
    precision: 0.5,
    recall: 0.4,
    avg_lead_time_days: 3,
    false_positive_rate: 0.5,
    false_negative_rate: 0.6,
    average_move: 0.02,
    sample_size: 4,
  };

  it("accepts legacy max_drawdown", () => {
    expect(
      BacktestMetricsSchema.safeParse({ ...base, max_drawdown: -0.1 })
        .success,
    ).toBe(true);
  });

  it("accepts worst_forward_return", () => {
    expect(
      BacktestMetricsSchema.safeParse({
        ...base,
        worst_forward_return: -0.1,
      }).success,
    ).toBe(true);
  });

  it("rejects neither", () => {
    expect(BacktestMetricsSchema.safeParse(base).success).toBe(false);
  });

  it("worstForwardReturn reads either", () => {
    expect(worstForwardReturn({ ...base, max_drawdown: -0.1 })).toBe(-0.1);
    expect(worstForwardReturn({ ...base, worst_forward_return: -0.2 })).toBe(
      -0.2,
    );
  });
});

describe("BacktestMetricsSchema direction hit rate (Task 31)", () => {
  const base = {
    precision: 0.5,
    recall: 0.4,
    avg_lead_time_days: 3,
    false_positive_rate: 0.5,
    false_negative_rate: 0.6,
    average_move: 0.02,
    worst_forward_return: -0.1,
    sample_size: 4,
  };

  it("accepts metrics with direction fields absent", () => {
    expect(BacktestMetricsSchema.safeParse(base).success).toBe(true);
  });

  it("accepts metrics with direction fields present", () => {
    const r = BacktestMetricsSchema.safeParse({
      ...base,
      direction_samples: 2,
      direction_hit_rate: 0.5,
    });
    expect(r.success).toBe(true);
  });

  it("rejects direction_hit_rate outside 0..1", () => {
    expect(
      BacktestMetricsSchema.safeParse({
        ...base,
        direction_samples: 2,
        direction_hit_rate: 1.5,
      }).success,
    ).toBe(false);
  });

  it("rejects a negative direction_samples", () => {
    expect(
      BacktestMetricsSchema.safeParse({
        ...base,
        direction_samples: -1,
        direction_hit_rate: 0.5,
      }).success,
    ).toBe(false);
  });
});

describe("PivotBacktestSnapshotSchema.data_provenance", () => {
  it("optional and validated when present", () => {
    const entry = {
      asset: "BTC",
      horizon: "7D",
      score_type: "overall",
      threshold: 70,
      period: { start: "2022-01-01", end: "2026-10-01" },
      metrics: {
        precision: 0,
        recall: 0,
        avg_lead_time_days: 0,
        false_positive_rate: 0,
        false_negative_rate: 0,
        average_move: 0,
        worst_forward_return: 0,
        sample_size: 0,
      },
    };
    const ok = {
      schema_version: "v0.1",
      generated_at: "x",
      entries: [entry],
      data_provenance: {
        source: "binance_public_bulk_metrics+fapi_funding",
        start: "2021-12-01",
        end: "2026-10-01",
        coverage_pct: 99.4,
      },
    };
    expect(PivotBacktestSnapshotSchema.safeParse(ok).success).toBe(true);
    expect(
      PivotBacktestSnapshotSchema.safeParse({
        ...ok,
        data_provenance: { source: "" },
      }).success,
    ).toBe(false);
  });
});

describe("PivotAssetsSnapshotSchema.previous (R4)", () => {
  const scores = { overall: 16, price_pivot: 16, volatility_pivot: 0, confidence_grade: "A", main_signal: "price" } as const;
  const radar = [{ symbol: "BTC", scores: { "7D": scores, "30D": scores, "90D": scores } }];
  const base = { schema_version: "v0.1", generated_at: "2026-10-02T23:00:00Z", radar, detail: {} };

  test("accepts a snapshot without previous", () => {
    expect(PivotAssetsSnapshotSchema.safeParse(base).success).toBe(true);
  });
  test("accepts a well-formed previous block", () => {
    const withPrev = { ...base, previous: { generated_at: "2026-10-01T23:00:00Z", radar } };
    expect(PivotAssetsSnapshotSchema.safeParse(withPrev).success).toBe(true);
  });
  test("rejects previous with an empty radar", () => {
    const bad = { ...base, previous: { generated_at: "2026-10-01T23:00:00Z", radar: [] } };
    expect(PivotAssetsSnapshotSchema.safeParse(bad).success).toBe(false);
  });
});

describe("HistoryEntrySchema / ScoreHistorySchema (spec §5.8 T-P1)", () => {
  const validEntry = {
    date: "2026-10-01",
    close: 84000.5,
    overall: { "7D": 16, "30D": 20, "90D": 24 },
    lean: { "7D": 10, "30D": -5, "90D": 0 },
  };

  it("accepts a valid entry", () => {
    expect(HistoryEntrySchema.safeParse(validEntry).success).toBe(true);
  });

  it("rejects a malformed date (not YYYY-MM-DD)", () => {
    const r = HistoryEntrySchema.safeParse({ ...validEntry, date: "2026/10/01" });
    expect(r.success).toBe(false);
  });

  it("ScoreHistorySchema accepts an empty per-asset array", () => {
    const r = ScoreHistorySchema.safeParse({ BTC: [], ETH: [] });
    expect(r.success).toBe(true);
  });

  it("ScoreHistorySchema accepts a single entry per asset", () => {
    const r = ScoreHistorySchema.safeParse({ BTC: [validEntry], ETH: [] });
    expect(r.success).toBe(true);
  });

  it("ScoreHistorySchema rejects 121 entries for one asset (cap is 120)", () => {
    const many = Array.from({ length: 121 }, (_, i) => ({
      ...validEntry,
      date: `2026-01-${String((i % 28) + 1).padStart(2, "0")}`,
    }));
    const r = ScoreHistorySchema.safeParse({ BTC: many, ETH: [] });
    expect(r.success).toBe(false);
  });

  it("PivotAssetsSnapshotSchema treats history as optional and validates when present", () => {
    const base = {
      schema_version: "v0.1",
      generated_at: "2026-05-04T00:00:00Z",
      radar: [
        {
          symbol: "BTC",
          scores: {
            "7D": { overall: 70, price_pivot: 60, volatility_pivot: 80, confidence_grade: "B+", main_signal: "volatility" },
            "30D": { overall: 70, price_pivot: 60, volatility_pivot: 80, confidence_grade: "B+", main_signal: "volatility" },
            "90D": { overall: 70, price_pivot: 60, volatility_pivot: 80, confidence_grade: "B+", main_signal: "volatility" },
          },
        },
      ],
      detail: {},
    };
    expect(PivotAssetsSnapshotSchema.safeParse(base).success).toBe(true);
    expect(
      PivotAssetsSnapshotSchema.safeParse({ ...base, history: { BTC: [validEntry], ETH: [] } })
        .success,
    ).toBe(true);
    expect(
      PivotAssetsSnapshotSchema.safeParse({ ...base, history: { BTC: [{ ...validEntry, date: "bad" }] } })
        .success,
    ).toBe(false);
  });
});

describe("forecast / forecast_meta (it-2026-10 stage 2)", () => {
  const sc = { overall: 16, price_pivot: 16, volatility_pivot: 0, confidence_grade: "A", main_signal: "price" } as const;
  const base = {
    schema_version: "v0.1",
    generated_at: "2026-10-17T23:00:00Z",
    radar: [{ symbol: "BTC", scores: { "7D": sc, "30D": sc, "90D": sc } }],
    detail: {},
  };
  const item = { event: "turn", horizon: "7D", today_pct: 47.3, usual_pct: 54.3 };
  const example = {
    ...base,
    forecast: {
      BTC: [item, { ...item, event: "move", horizon: "30D", prev_today_pct: 50.1 }],
      ETH: [],
    },
    forecast_meta: { iteration: "it-2026-10", train_end: "2025-10-16" },
  };

  it("is optional (old snapshots stay valid)", () => {
    expect(PivotAssetsSnapshotSchema.safeParse(base).success).toBe(true);
  });
  it("accepts a well-formed example with prev_today_pct", () => {
    expect(PivotAssetsSnapshotSchema.safeParse(example).success).toBe(true);
  });
  it("rejects percent outside 0-100, unknown event, bad train_end", () => {
    expect(PivotAssetsSnapshotSchema.safeParse({ ...example, forecast: { BTC: [{ ...item, today_pct: 101 }] } }).success).toBe(false);
    expect(PivotAssetsSnapshotSchema.safeParse({ ...example, forecast: { BTC: [{ ...item, event: "bounce" }] } }).success).toBe(false);
    expect(PivotAssetsSnapshotSchema.safeParse({ ...example, forecast_meta: { iteration: "x", train_end: "bad" } }).success).toBe(false);
  });
});

describe("trend / ladder / turns / forecast_history (it-2026-10 stage 2 Task 9)", () => {
  const sc = { overall: 16, price_pivot: 16, volatility_pivot: 0, confidence_grade: "A", main_signal: "price" } as const;
  const base = {
    schema_version: "v0.1",
    generated_at: "2026-10-17T23:00:00Z",
    radar: [{ symbol: "BTC", scores: { "7D": sc, "30D": sc, "90D": sc } }],
    detail: {},
  };
  const decided = {
    strength: "cycle",
    decided: true,
    last_confirmed: { date: "2025-10-06", kind: "top", close: 124659 },
    candidate: { date: "2026-02-05", kind: "bottom", close: 62700 },
    confirm_at: 94050,
  };
  const undecided = { strength: "small", decided: false, last_confirmed: null, candidate: null, confirm_at: null };
  const example = {
    ...base,
    trend: { BTC: { ret_30d_pct: -4.2, ret_90d_pct: 12.5 }, ETH: {} },
    ladder: { BTC: [decided, undecided] },
    turns: { BTC: [{ date: "2025-10-06", kind: "top", strength: "cycle", close: 124659 }] },
    forecast_history: {
      BTC: [
        {
          date: "2026-10-16",
          close: 67000,
          forecast: { turn: { "7D": 47.3, "30D": 50 }, move: { "90D": 61.2 } },
          outcome: { turn: { "7D": "pending" }, move: { "90D": "hit" } },
          backfilled: true,
        },
        { date: "2026-10-17", close: 67100, outcome: { turn: { "7D": "pending" } }, backfilled: false },
        { date: "2026-10-15", backfilled: false },
      ],
    },
  };

  it("is optional (old snapshots stay valid)", () => {
    expect(PivotAssetsSnapshotSchema.safeParse(base).success).toBe(true);
  });
  it("accepts a well-formed example", () => {
    expect(PivotAssetsSnapshotSchema.safeParse(example).success).toBe(true);
  });
  it("undecided ladder rows must not carry a candidate or trigger price", () => {
    const bad1 = { ...undecided, confirm_at: 100 };
    const bad2 = { ...undecided, candidate: decided.candidate };
    const bad3 = { ...decided, confirm_at: null };
    for (const row of [bad1, bad2, bad3]) {
      expect(PivotAssetsSnapshotSchema.safeParse({ ...example, ladder: { BTC: [row] } }).success).toBe(false);
    }
  });
  it("rejects unknown strength / outcome / out-of-range percent / bad date", () => {
    const fh = example.forecast_history.BTC[0];
    const cases = [
      { ...example, turns: { BTC: [{ date: "2025-10-06", kind: "top", strength: "huge", close: 1 }] } },
      { ...example, forecast_history: { BTC: [{ ...fh, outcome: { turn: { "7D": "maybe" } } }] } },
      { ...example, forecast_history: { BTC: [{ ...fh, forecast: { turn: { "7D": 101 } } }] } },
      { ...example, forecast_history: { BTC: [{ ...fh, date: "bad" }] } },
      { ...example, forecast_history: { BTC: [{ ...fh, backfilled: undefined }] } },
      { ...example, forecast_history: { BTC: [{ date: "2026-10-16", backfilled: true }] } },
      { ...example, ladder: { BTC: [decided, decided, decided, decided, decided] } },
    ];
    for (const c of cases) expect(PivotAssetsSnapshotSchema.safeParse(c).success).toBe(false);
  });
});

describe("PivotBacktestSnapshotSchema.events (it-2026-10 stage 2)", () => {
  const entry = {
    asset: "BTC",
    horizon: "7D",
    score_type: "overall",
    threshold: 70,
    period: { start: "2022-01-01", end: "2026-10-01" },
    metrics: {
      precision: 0,
      recall: 0,
      avg_lead_time_days: 0,
      false_positive_rate: 0,
      false_negative_rate: 0,
      average_move: 0,
      worst_forward_return: 0,
      sample_size: 0,
    },
  };
  const event = {
    asset: "BTC",
    event: "turn",
    horizon: "7D",
    usual_pct: 47.3,
    long_run_usual_pct: 54.3,
    calibration: [{ lo: 0, hi: 20, prob_pct: 53.3, n: 437 }],
    holdout: {
      brier_skill: 0.002,
      lift_pts: 12.5,
      n_signal: 4,
      signal_rate_pct: 50,
      other_rate_pct: 37.5,
      holdout_rate_pct: 37.6,
      holdout_n: 351,
      judged: true,
      primary: "pass",
      secondary: null,
    },
  };
  const base = { schema_version: "v0.1", generated_at: "x", entries: [entry] };

  it("accepts a valid events block and its absence", () => {
    expect(PivotBacktestSnapshotSchema.safeParse(base).success).toBe(true);
    expect(
      PivotBacktestSnapshotSchema.safeParse({ ...base, events: [event] }).success,
    ).toBe(true);
  });

  it("rejects prob_pct > 100", () => {
    const bad = { ...event, calibration: [{ lo: 0, hi: 20, prob_pct: 100.1, n: 1 }] };
    expect(
      PivotBacktestSnapshotSchema.safeParse({ ...base, events: [bad] }).success,
    ).toBe(false);
  });

  it("rejects an unknown verdict", () => {
    const nullRates = { ...event, holdout: { ...event.holdout, signal_rate_pct: null, other_rate_pct: null } };
    expect(PivotBacktestSnapshotSchema.safeParse({ ...base, events: [nullRates] }).success).toBe(true);
    const { signal_rate_pct: _a, other_rate_pct: _b, holdout_rate_pct: _c, holdout_n: _d, ...legacy } = event.holdout;
    expect(PivotBacktestSnapshotSchema.safeParse({ ...base, events: [{ ...event, holdout: legacy }] }).success).toBe(true);
    const bad = { ...event, holdout: { ...event.holdout, primary: "maybe" } };
    expect(
      PivotBacktestSnapshotSchema.safeParse({ ...base, events: [bad] }).success,
    ).toBe(false);
  });
});
