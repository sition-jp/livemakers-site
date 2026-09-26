import { describe, it, expect } from "vitest";
import {
  HistoryEntrySchema,
  PivotAssetsSnapshotSchema,
  ScoreHistorySchema,
} from "@/lib/pivots/types";

const validEntry = {
  date: "2026-09-20",
  close: 65000.5,
  overall: { "7D": 40, "30D": 55, "90D": 20 },
  lean: { "7D": 10, "30D": -15, "90D": 0 },
};

describe("HistoryEntrySchema", () => {
  it("accepts a well-formed entry", () => {
    expect(HistoryEntrySchema.safeParse(validEntry).success).toBe(true);
  });

  it("rejects a non-ISO date", () => {
    const r = HistoryEntrySchema.safeParse({ ...validEntry, date: "09/20/2026" });
    expect(r.success).toBe(false);
  });

  it("rejects a non-positive close", () => {
    const r = HistoryEntrySchema.safeParse({ ...validEntry, close: 0 });
    expect(r.success).toBe(false);
  });
});

describe("ScoreHistorySchema", () => {
  it("accepts a single entry per asset", () => {
    const r = ScoreHistorySchema.safeParse({ BTC: [validEntry] });
    expect(r.success).toBe(true);
  });

  it("rejects 121 entries (max 120)", () => {
    const many = Array.from({ length: 121 }, (_, i) => ({
      ...validEntry,
      date: `2026-01-${String((i % 28) + 1).padStart(2, "0")}`,
    }));
    const r = ScoreHistorySchema.safeParse({ BTC: many });
    expect(r.success).toBe(false);
  });

  it("accepts exactly 120 entries", () => {
    const many = Array.from({ length: 120 }, (_, i) => ({
      ...validEntry,
      date: `2026-01-${String((i % 28) + 1).padStart(2, "0")}`,
    }));
    const r = ScoreHistorySchema.safeParse({ BTC: many });
    expect(r.success).toBe(true);
  });
});

describe("PivotAssetsSnapshotSchema.history", () => {
  const base = {
    schema_version: "v0.1" as const,
    generated_at: "2026-09-26T00:00:00Z",
    radar: [
      {
        symbol: "BTC" as const,
        scores: {
          "7D": { overall: 40, price_pivot: 40, volatility_pivot: 40, confidence_grade: "B" as const, main_signal: "price" as const },
          "30D": { overall: 40, price_pivot: 40, volatility_pivot: 40, confidence_grade: "B" as const, main_signal: "price" as const },
          "90D": { overall: 40, price_pivot: 40, volatility_pivot: 40, confidence_grade: "B" as const, main_signal: "price" as const },
        },
      },
    ],
    detail: {},
  };

  it("is optional — absent history parses fine", () => {
    const r = PivotAssetsSnapshotSchema.safeParse(base);
    expect(r.success).toBe(true);
  });

  it("accepts a present history with one entry", () => {
    const r = PivotAssetsSnapshotSchema.safeParse({ ...base, history: { BTC: [validEntry] } });
    expect(r.success).toBe(true);
  });

  it("rejects a bad date inside history", () => {
    const r = PivotAssetsSnapshotSchema.safeParse({
      ...base,
      history: { BTC: [{ ...validEntry, date: "not-a-date" }] },
    });
    expect(r.success).toBe(false);
  });
});
