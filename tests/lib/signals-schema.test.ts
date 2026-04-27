import { describe, it, expect } from "vitest";
import { SignalSchema } from "@/lib/signals";

const baseSignal = (overrides: Record<string, unknown> = {}) => ({
  id: "sig_1",
  trace_id: "t",
  root_trace_id: "t",
  schema_version: "1.2-beta",
  created_at: "2026-04-22T00:00:00Z",
  type: "news",
  subtype: "x",
  pillar: "ecosystem_health",
  status: "active",
  idempotency_key: "k",
  confidence: 0.5,
  impact: "medium",
  urgency: 0.5,
  time_horizon: "days",
  direction: "neutral",
  evidence: [],
  similar_cases: [],
  related_assets: ["ADA"],
  related_protocols: [],
  primary_asset: "ADA",
  tradable: false,
  headline_en: "x",
  headline_ja: "x",
  summary_en: "x",
  summary_ja: "x",
  source_ids: [],
  ...overrides,
});

describe("SignalSchema v1.2-beta article_candidate_accounts", () => {
  it("accepts null / missing article_candidate_accounts", () => {
    const r = SignalSchema.safeParse(baseSignal());
    expect(r.success).toBe(true);
  });

  it("accepts valid account list", () => {
    const r = SignalSchema.safeParse(
      baseSignal({
        article_candidate_accounts: ["SIPO_Tokyo", "SITIONjp"],
      }),
    );
    expect(r.success).toBe(true);
  });

  it("rejects invalid account name", () => {
    const r = SignalSchema.safeParse(
      baseSignal({
        article_candidate_accounts: ["BAD_ACCOUNT"],
      }),
    );
    expect(r.success).toBe(false);
  });

  it("accepts schema_version 1.1-beta for forward-compat reads", () => {
    const r = SignalSchema.safeParse(
      baseSignal({
        schema_version: "1.1-beta",
      }),
    );
    expect(r.success).toBe(true);
  });

  it("accepts schema_version 1.2-beta", () => {
    const r = SignalSchema.safeParse(
      baseSignal({
        schema_version: "1.2-beta",
      }),
    );
    expect(r.success).toBe(true);
  });
});

describe("SignalSchema v1.3-beta target_terminal", () => {
  /**
   * target_terminal is the Terminal *display* gate, independent from
   * article_candidate_accounts (publish gate). Spec:
   * 08_DOCS/knowledge/specs/2026-04-27-livemakers-terminal-asset-contract-v0.md §3
   */

  it("accepts schema_version 1.3-beta", () => {
    const r = SignalSchema.safeParse(
      baseSignal({ schema_version: "1.3-beta" }),
    );
    expect(r.success).toBe(true);
  });

  it("defaults to undefined / null when target_terminal not set", () => {
    const r = SignalSchema.safeParse(baseSignal());
    expect(r.success).toBe(true);
  });

  it("accepts target_terminal=['ADA'] with locked_fields entry", () => {
    const r = SignalSchema.safeParse(
      baseSignal({
        schema_version: "1.3-beta",
        target_terminal: ["ADA"],
        locked_fields: { target_terminal: "terminal_targeting@2026-04-27" },
      }),
    );
    expect(r.success).toBe(true);
  });

  it("accepts full 4-asset set", () => {
    const r = SignalSchema.safeParse(
      baseSignal({
        schema_version: "1.3-beta",
        target_terminal: ["BTC", "ETH", "ADA", "NIGHT"],
        locked_fields: { target_terminal: "macro@2026-04-27" },
      }),
    );
    expect(r.success).toBe(true);
  });

  it("rejects unknown asset (DOGE)", () => {
    const r = SignalSchema.safeParse(
      baseSignal({
        schema_version: "1.3-beta",
        target_terminal: ["DOGE"],
        locked_fields: { target_terminal: "x" },
      }),
    );
    expect(r.success).toBe(false);
  });

  it("rejects empty list (use null/undefined for 'no targeting')", () => {
    const r = SignalSchema.safeParse(
      baseSignal({
        schema_version: "1.3-beta",
        target_terminal: [],
        locked_fields: { target_terminal: "x" },
      }),
    );
    expect(r.success).toBe(false);
  });

  it("rejects duplicates", () => {
    const r = SignalSchema.safeParse(
      baseSignal({
        schema_version: "1.3-beta",
        target_terminal: ["ADA", "ADA"],
        locked_fields: { target_terminal: "x" },
      }),
    );
    expect(r.success).toBe(false);
  });

  it("rejects target_terminal set without locked_fields entry", () => {
    const r = SignalSchema.safeParse(
      baseSignal({
        schema_version: "1.3-beta",
        target_terminal: ["ADA"],
        // locked_fields missing target_terminal key
      }),
    );
    expect(r.success).toBe(false);
  });

  it("is independent from primary_asset (BTC primary OK with target_terminal=['BTC'])", () => {
    // Key difference from article_candidate_accounts which requires
    // primary_asset ∈ {ADA, NIGHT, DUST}
    const r = SignalSchema.safeParse(
      baseSignal({
        schema_version: "1.3-beta",
        primary_asset: "BTC",
        target_terminal: ["BTC"],
        locked_fields: { target_terminal: "x" },
      }),
    );
    expect(r.success).toBe(true);
  });

  it("can coexist with article_candidate_accounts (independent gates)", () => {
    const r = SignalSchema.safeParse(
      baseSignal({
        schema_version: "1.3-beta",
        primary_asset: "ADA",
        article_candidate_accounts: ["SIPO_Tokyo"],
        target_terminal: ["ADA", "NIGHT"],
        locked_fields: {
          article_candidate_accounts: "external_boost@2026-04-22",
          target_terminal: "terminal_targeting@2026-04-27",
        },
      }),
    );
    expect(r.success).toBe(true);
  });
});
