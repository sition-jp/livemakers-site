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
