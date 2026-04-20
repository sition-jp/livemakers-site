// tests/lib/intents.test.ts
import { describe, it, expect } from "vitest";
import {
  TradeIntentSchema,
  IntentStatus,
  IntentSide,
  PreferredHorizon,
  PortfolioBucket,
  Visibility,
  RealizedOutcome,
  type TradeIntent,
} from "@/lib/intents";

function baseIntent(overrides: Partial<TradeIntent> = {}): TradeIntent {
  const base: TradeIntent = {
    intent_id: "int_01k8xq2n3p4r5s6t",
    trace_id: "550e8400-e29b-41d4-a716-446655440000",
    schema_version: "0.1-alpha",
    created_at: "2026-04-20T09:30:00Z",
    updated_at: "2026-04-20T09:30:00Z",
    status: "approved",
    source_signal_ids: ["sig_001"],
    title: "ADA accumulation — epoch 622",
    description: "Short description.",
    side: "accumulate",
    target_assets: ["ADA"],
    thesis:
      "Cardano epoch 622 transition coincides with Treasury Fit endorsement.",
    why_now: "Bonus window opens for 5 days starting epoch 622 boundary.",
    invalidation_thesis: "Cancel if BTC weekly close < $55k.",
    thesis_conviction: 0.72,
    execution_confidence: 0.45,
    priority: 0.6,
    preferred_horizon: "swing",
    portfolio_context: { bucket: "tactical" },
    human_review: {
      required: true,
      approved_by: "LiveMakers Terminal",
      approved_at: "2026-04-20T09:30:00Z",
    },
    display: {
      headline_en: "ADA accumulation — Epoch 622",
      headline_ja: "ADA 段階買い — エポック 622",
      summary_en: "Stakers receive bonus for 5 days; size conservative.",
      summary_ja:
        "ステーキング報酬ボーナスが 5 日間開放。ポジションは保守的に。",
    },
    visibility: "public",
    authored_via: "claude_code_dialogue",
  };
  return { ...base, ...overrides } as TradeIntent;
}

describe("lib/intents — TradeIntentSchema", () => {
  it("S-1: accepts a valid baseline intent", () => {
    expect(() => TradeIntentSchema.parse(baseIntent())).not.toThrow();
  });

  it("S-2: rejects intent_id not matching ^int_[a-z0-9]{16}$", () => {
    expect(() =>
      TradeIntentSchema.parse(baseIntent({ intent_id: "bad_id" }))
    ).toThrow();
    expect(() =>
      TradeIntentSchema.parse(baseIntent({ intent_id: "int_UPPERCASE1234567" }))
    ).toThrow();
  });

  it("S-3: rejects non-uuid trace_id", () => {
    expect(() =>
      TradeIntentSchema.parse(baseIntent({ trace_id: "not-a-uuid" }))
    ).toThrow();
  });

  it("S-4: rejects schema_version other than 0.1-alpha", () => {
    expect(() =>
      TradeIntentSchema.parse(baseIntent({ schema_version: "1.0" } as any))
    ).toThrow();
  });

  it("S-5: status enum includes archived (future-compat)", () => {
    expect(() =>
      TradeIntentSchema.parse(baseIntent({ status: "archived" }))
    ).not.toThrow();
  });

  it("S-6: rejects empty source_signal_ids", () => {
    expect(() =>
      TradeIntentSchema.parse(baseIntent({ source_signal_ids: [] }))
    ).toThrow();
  });

  it("S-7: enforces thesis min 20 chars", () => {
    expect(() =>
      TradeIntentSchema.parse(baseIntent({ thesis: "too short" }))
    ).toThrow();
  });

  it("S-8: enforces why_now / invalidation_thesis min 20 chars", () => {
    expect(() =>
      TradeIntentSchema.parse(baseIntent({ why_now: "short" }))
    ).toThrow();
    expect(() =>
      TradeIntentSchema.parse(
        baseIntent({ invalidation_thesis: "short" })
      )
    ).toThrow();
  });

  it("S-9: enforces 0.0-1.0 for conviction / confidence / priority", () => {
    expect(() =>
      TradeIntentSchema.parse(baseIntent({ thesis_conviction: 1.5 }))
    ).toThrow();
    expect(() =>
      TradeIntentSchema.parse(baseIntent({ execution_confidence: -0.1 }))
    ).toThrow();
    expect(() =>
      TradeIntentSchema.parse(baseIntent({ priority: 2.0 }))
    ).toThrow();
  });

  it("S-10: side enum lock (7 values)", () => {
    expect(() =>
      TradeIntentSchema.parse(baseIntent({ side: "enter_long" }))
    ).not.toThrow();
    expect(() =>
      TradeIntentSchema.parse(baseIntent({ side: "buy" } as any))
    ).toThrow();
  });

  it("S-11: preferred_horizon enum lock", () => {
    expect(() =>
      TradeIntentSchema.parse(baseIntent({ preferred_horizon: "position" }))
    ).not.toThrow();
    expect(() =>
      TradeIntentSchema.parse(
        baseIntent({ preferred_horizon: "forever" } as any)
      )
    ).toThrow();
  });

  it("S-12: portfolio_context.bucket enum lock", () => {
    expect(() =>
      TradeIntentSchema.parse(
        baseIntent({ portfolio_context: { bucket: "core" } })
      )
    ).not.toThrow();
    expect(() =>
      TradeIntentSchema.parse(
        baseIntent({ portfolio_context: { bucket: "casino" } } as any)
      )
    ).toThrow();
  });

  it("S-13: human_review.required must be literal true", () => {
    expect(() =>
      TradeIntentSchema.parse(
        baseIntent({
          human_review: {
            required: false as any,
            approved_by: "LiveMakers Terminal",
            approved_at: "2026-04-20T09:30:00Z",
          },
        })
      )
    ).toThrow();
  });

  it("S-14: display headline max 80 / summary 20-240 char bounds", () => {
    const h81 = "x".repeat(81);
    expect(() =>
      TradeIntentSchema.parse(
        baseIntent({
          display: {
            headline_en: h81,
            headline_ja: "OK",
            summary_en: "x".repeat(30),
            summary_ja: "x".repeat(30),
          },
        })
      )
    ).toThrow();
  });

  it("S-15: visibility defaults to public when omitted", () => {
    const raw = baseIntent();
    delete (raw as any).visibility;
    const parsed = TradeIntentSchema.parse(raw);
    expect(parsed.visibility).toBe("public");
  });

  it("S-16: authored_via defaults to claude_code_dialogue when omitted", () => {
    const raw = baseIntent();
    delete (raw as any).authored_via;
    const parsed = TradeIntentSchema.parse(raw);
    expect(parsed.authored_via).toBe("claude_code_dialogue");
  });

  it("S-17: outcome object accepted when optional fields absent", () => {
    expect(() =>
      TradeIntentSchema.parse(baseIntent({ outcome: {} }))
    ).not.toThrow();
    expect(() =>
      TradeIntentSchema.parse(
        baseIntent({
          outcome: {
            realized_outcome: "thesis_confirmed",
            outcome_notes: "confirmed",
            outcome_recorded_at: "2026-05-01T00:00:00Z",
          },
        })
      )
    ).not.toThrow();
  });
});
