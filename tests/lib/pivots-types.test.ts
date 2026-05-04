import { describe, it, expect } from "vitest";
import {
  DirectionBiasSchema,
  PivotAssetsSnapshotSchema,
  scoreLevel,
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
