// tests/lib/intents-v0.2-schema.test.ts
//
// Task 2-2 v0.2-alpha schema relaxations for SDE auto-proposal flow.
// Validates the 5 backward-compatible relaxations applied to lib/intents.ts:
//   1. authored_via enum += "sde_auto_proposal"
//   2. intent_id regex allows optional "int_proposed_" prefix
//   3. human_review.approved_by / approved_at now optional (set at approve time)
//   4. display.headline_en / summary_en allow empty string (generated at approve time)
//   5. proposer_metadata optional field (version / cluster_fingerprint / generated_at)
//
// Backward-compat: all changes are strict relaxations — v0.1 intents still validate.
//
// Spec refs: §3.1 (sde_auto_proposal channel), §2.4 + §5.1 (approve-time fill invariants)
import { describe, it, expect } from "vitest";
import {
  TradeIntentSchema,
  ProposerMetadataSchema,
  type TradeIntent,
  type ProposerMetadata,
} from "@/lib/intents";

/**
 * Builder for a proposer-flow baseline intent — mirrors what the
 * SDE auto-proposer will emit BEFORE human approval:
 *   - authored_via = "sde_auto_proposal"
 *   - intent_id uses "int_proposed_" prefix
 *   - human_review has only `required: true` (no approver yet)
 *   - EN display fields empty (generated at approve time)
 *   - proposer_metadata populated
 */
function proposedIntent(overrides: Partial<TradeIntent> = {}): TradeIntent {
  const base: TradeIntent = {
    intent_id: "int_proposed_01k8xq2n3p4r5s6t",
    trace_id: "550e8400-e29b-41d4-a716-446655440001",
    schema_version: "0.1-alpha",
    created_at: "2026-04-21T06:00:00Z",
    updated_at: "2026-04-21T06:00:00Z",
    status: "proposed",
    source_signal_ids: ["sig_auto_001"],
    title: "ADA accumulation — auto-proposed from cluster",
    description: "Auto-proposed from SDE cluster of 3 signals.",
    side: "accumulate",
    target_assets: ["ADA"],
    thesis:
      "Cluster of governance + TVL + macro signals aligns for ADA accumulation.",
    why_now: "All three signals fired within a 6-hour window on the same day.",
    invalidation_thesis: "Cancel if any signal's invalidation condition triggers.",
    thesis_conviction: 0.65,
    execution_confidence: 0.4,
    priority: 0.55,
    preferred_horizon: "swing",
    portfolio_context: { bucket: "tactical" },
    human_review: {
      required: true,
      // approved_by / approved_at omitted — filled at approve time
    },
    display: {
      headline_en: "",
      headline_ja: "ADA 段階買い — 自動提案",
      summary_en: "",
      summary_ja:
        "3 シグナルのクラスターが ADA 段階買いを支持。エポック遷移も重なる。",
    },
    visibility: "private",
    authored_via: "sde_auto_proposal",
    proposer_metadata: {
      version: "v0.2.0",
      cluster_fingerprint: "fp_3sig_gov_tvl_macro_20260421",
      generated_at: "2026-04-21T06:00:00Z",
    },
  };
  return { ...base, ...overrides } as TradeIntent;
}

describe("lib/intents — v0.2-alpha auto-proposal schema relaxations", () => {
  it("V2-1: accepts a fully proposer-shaped intent (all 5 relaxations combined)", () => {
    expect(() => TradeIntentSchema.parse(proposedIntent())).not.toThrow();
  });

  it("V2-2: authored_via accepts 'sde_auto_proposal' (new enum value)", () => {
    expect(() =>
      TradeIntentSchema.parse(
        proposedIntent({ authored_via: "sde_auto_proposal" })
      )
    ).not.toThrow();
    // Negative: unknown value still rejected
    expect(() =>
      TradeIntentSchema.parse(
        proposedIntent({ authored_via: "grok_runner" as any })
      )
    ).toThrow();
  });

  it("V2-3: intent_id regex accepts 'int_proposed_' prefix AND legacy 'int_' form", () => {
    // New proposed form
    expect(() =>
      TradeIntentSchema.parse(
        proposedIntent({ intent_id: "int_proposed_abcd1234efgh5678" })
      )
    ).not.toThrow();
    // Legacy v0.1 form still accepted
    expect(() =>
      TradeIntentSchema.parse(
        proposedIntent({ intent_id: "int_abcd1234efgh5678" })
      )
    ).not.toThrow();
    // Negative: uppercase / wrong length still rejected
    expect(() =>
      TradeIntentSchema.parse(
        proposedIntent({ intent_id: "int_proposed_UPPERCASE1234567" })
      )
    ).toThrow();
    expect(() =>
      TradeIntentSchema.parse(proposedIntent({ intent_id: "int_tooShort" }))
    ).toThrow();
  });

  it("V2-4: human_review.approved_by / approved_at are now optional", () => {
    // Proposer omits both
    expect(() =>
      TradeIntentSchema.parse(
        proposedIntent({
          human_review: { required: true },
        })
      )
    ).not.toThrow();
    // Approve-time fills both (still valid)
    expect(() =>
      TradeIntentSchema.parse(
        proposedIntent({
          human_review: {
            required: true,
            approved_by: "LiveMakers Terminal",
            approved_at: "2026-04-21T07:00:00Z",
          },
        })
      )
    ).not.toThrow();
    // Negative: required: false still rejected (literal true enforced)
    expect(() =>
      TradeIntentSchema.parse(
        proposedIntent({
          human_review: { required: false as any },
        })
      )
    ).toThrow();
  });

  it("V2-5: display.headline_en / summary_en accept empty string; JA still min-required", () => {
    // EN empty OK (proposer shape)
    expect(() =>
      TradeIntentSchema.parse(
        proposedIntent({
          display: {
            headline_en: "",
            headline_ja: "ADA 段階買い",
            summary_en: "",
            summary_ja:
              "3 シグナルのクラスターが ADA 段階買いを支持。エポック遷移も重なる。",
          },
        })
      )
    ).not.toThrow();
    // JA empty still rejected (headline_ja min(1))
    expect(() =>
      TradeIntentSchema.parse(
        proposedIntent({
          display: {
            headline_en: "",
            headline_ja: "",
            summary_en: "",
            summary_ja:
              "3 シグナルのクラスターが ADA 段階買いを支持。エポック遷移も重なる。",
          },
        })
      )
    ).toThrow();
    // JA summary too short still rejected (summary_ja min(20))
    expect(() =>
      TradeIntentSchema.parse(
        proposedIntent({
          display: {
            headline_en: "",
            headline_ja: "OK",
            summary_en: "",
            summary_ja: "短い",
          },
        })
      )
    ).toThrow();
    // EN max(80) / max(240) still enforced
    expect(() =>
      TradeIntentSchema.parse(
        proposedIntent({
          display: {
            headline_en: "x".repeat(81),
            headline_ja: "OK",
            summary_en: "",
            summary_ja:
              "3 シグナルのクラスターが ADA 段階買いを支持。エポック遷移も重なる。",
          },
        })
      )
    ).toThrow();
  });

  it("V2-6: proposer_metadata optional; ProposerMetadataSchema enforces shape when present", () => {
    // Omitted entirely (v0.1-compat path)
    const raw = proposedIntent();
    delete (raw as any).proposer_metadata;
    expect(() => TradeIntentSchema.parse(raw)).not.toThrow();

    // Valid ProposerMetadata direct-parse
    const meta: ProposerMetadata = {
      version: "v0.2.0",
      cluster_fingerprint: "fp_abc",
      generated_at: "2026-04-21T06:00:00Z",
    };
    expect(() => ProposerMetadataSchema.parse(meta)).not.toThrow();

    // Invalid generated_at rejected
    expect(() =>
      ProposerMetadataSchema.parse({
        version: "v0.2.0",
        cluster_fingerprint: "fp_abc",
        generated_at: "not-a-datetime",
      })
    ).toThrow();

    // Missing required field rejected
    expect(() =>
      ProposerMetadataSchema.parse({
        version: "v0.2.0",
        cluster_fingerprint: "fp_abc",
      } as any)
    ).toThrow();

    // Invalid proposer_metadata inside full intent also rejected
    expect(() =>
      TradeIntentSchema.parse(
        proposedIntent({
          proposer_metadata: {
            version: "v0.2.0",
            cluster_fingerprint: "fp_abc",
            generated_at: "not-a-datetime",
          } as any,
        })
      )
    ).toThrow();
  });
});
