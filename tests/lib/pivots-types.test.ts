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
