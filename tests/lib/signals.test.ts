import { describe, it, expect } from "vitest";
import { SignalSchema, type Signal } from "@/lib/signals";

function minimalSignal(): Signal {
  return {
    id: "sig_001",
    trace_id: "trace_001",
    root_trace_id: "trace_001",
    schema_version: "1.1-beta",
    created_at: "2026-04-18T00:00:00Z",
    type: "governance_event",
    subtype: "drep_vote",
    pillar: "governance_and_treasury",
    status: "active",
    idempotency_key: "idem_001",
    confidence: 0.8,
    impact: "high",
    urgency: 0.7,
    time_horizon: "days",
    direction: "positive",
    evidence: [],
    similar_cases: [],
    related_assets: ["ADA"],
    related_protocols: [],
    tradable: false,
    headline_en: "Test",
    headline_ja: "テスト",
    summary_en: "Test summary",
    summary_ja: "テスト要約",
    source_ids: ["src_001"],
  };
}

describe("lib/signals — SignalSchema", () => {
  it("parses a minimal valid signal", () => {
    const parsed = SignalSchema.parse(minimalSignal());
    expect(parsed.id).toBe("sig_001");
    expect(parsed.schema_version).toBe("1.1-beta");
  });

  it("rejects schema_version other than 1.1-beta", () => {
    for (const bad of ["1.0-alpha", "1.0-beta", "2.0-beta", "1.1-alpha"]) {
      const s = minimalSignal() as Record<string, unknown>;
      s.schema_version = bad;
      expect(() => SignalSchema.parse(s)).toThrow();
    }
  });

  it.each([
    ["confidence", -0.01],
    ["confidence", 1.01],
    ["urgency", -0.01],
    ["urgency", 1.01],
  ])("rejects out-of-range %s=%s", (field, value) => {
    const s = minimalSignal() as Record<string, unknown>;
    s[field] = value;
    expect(() => SignalSchema.parse(s)).toThrow();
  });

  it.each(["status", "impact", "direction", "time_horizon", "pillar"])(
    "rejects unknown %s enum value",
    (field) => {
      const s = minimalSignal() as Record<string, unknown>;
      s[field] = "nonsense_value";
      expect(() => SignalSchema.parse(s)).toThrow();
    },
  );

  it("accepts valid position_hint", () => {
    const s = minimalSignal();
    s.position_hint = { stance: "accumulate", conviction: 0.65 };
    const parsed = SignalSchema.parse(s);
    expect(parsed.position_hint?.conviction).toBe(0.65);
  });

  it("rejects position_hint with unknown stance", () => {
    const s = minimalSignal() as Record<string, unknown>;
    s.position_hint = { stance: "yolo", conviction: 0.5 };
    expect(() => SignalSchema.parse(s)).toThrow();
  });

  it("rejects position_hint with out-of-bounds conviction", () => {
    const s = minimalSignal() as Record<string, unknown>;
    s.position_hint = { stance: "long", conviction: 1.5 };
    expect(() => SignalSchema.parse(s)).toThrow();
  });

  it("rejects unknown top-level fields (strict contract)", () => {
    const s = minimalSignal() as Record<string, unknown>;
    s.mystery_field = "should be rejected";
    expect(() => SignalSchema.parse(s)).toThrow();
  });

  it("rejects legacy v1.0-beta `dedupe_key` field (renamed to event_key)", () => {
    const s = minimalSignal() as Record<string, unknown>;
    s.dedupe_key = "cardano|hf|20260418";
    expect(() => SignalSchema.parse(s)).toThrow();
  });

  it("accepts audit_note and locked_fields", () => {
    const s = minimalSignal();
    s.audit_note = "morning audit: noise";
    s.locked_fields = { direction: "manual_audit_2026-04-18" };
    const parsed = SignalSchema.parse(s);
    expect(parsed.audit_note).toBe("morning audit: noise");
    expect(parsed.locked_fields).toEqual({ direction: "manual_audit_2026-04-18" });
  });

  it("validates nested Evidence items (weight bounds)", () => {
    const s = minimalSignal();
    s.evidence = [
      {
        source_url: "https://example.com",
        source_type: "rss",
        timestamp: "2026-04-18T00:00:00Z",
        snippet: "foo",
        weight: 1.5,
      },
    ];
    expect(() => SignalSchema.parse(s)).toThrow();
  });

  it("round-trips through JSON losslessly", () => {
    const s = minimalSignal();
    s.position_hint = { stance: "accumulate", conviction: 0.7 };
    s.event_key = "cardano|hf,hard_fork,roadmap";
    s.expires_at = "2026-04-25T00:00:00Z";
    s.evidence = [
      {
        source_url: "https://x.com/a/status/1",
        source_type: "x_home_timeline",
        timestamp: "2026-04-18T00:00:00Z",
        snippet: "HF activated",
        weight: 0.8,
      },
    ];

    const json = JSON.stringify(s);
    const restored = SignalSchema.parse(JSON.parse(json));
    expect(restored).toEqual(s);
    expect(restored.position_hint?.conviction).toBe(0.7);
  });

  it("serialized form is single line (JSONL compat)", () => {
    const s = minimalSignal();
    expect(JSON.stringify(s)).not.toContain("\n");
  });
});
