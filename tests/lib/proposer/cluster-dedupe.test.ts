import { describe, it, expect } from "vitest";
import { filterDuplicateClusters } from "@/lib/proposer/cluster-dedupe";
import type { Cluster } from "@/lib/proposer/cluster-detect";
import type { TradeIntent } from "@/lib/intents";
import type { IntentRejectEntry } from "@/lib/intents-reject";
import type { Signal } from "@/lib/signals";

function mkCluster(overrides: Partial<Cluster>): Cluster {
  return {
    signals: [],
    primary_asset: "ADA",
    direction: "positive",
    fingerprint: "cluster_fp_1",
    score: 0.7,
    ...overrides,
  };
}

// Minimal Signal-like stub for cluster.signals test cases — only id matters for dedupe
function mkSigStub(id: string): Signal {
  return { id } as Signal;
}

function mkIntent(overrides: Partial<TradeIntent>): TradeIntent {
  return {
    intent_id: "int_existing00000",
    trace_id: "550e8400-e29b-41d4-a716-446655440000",
    schema_version: "0.1-alpha",
    created_at: "2026-04-20T00:00:00Z",
    updated_at: "2026-04-20T00:00:00Z",
    status: "approved",
    source_signal_ids: ["sig_1", "sig_2"],
    title: "test",
    description: "test description",
    side: "accumulate",
    target_assets: ["ADA"],
    thesis: "test thesis content that is long enough",
    why_now: "test why now content that is long enough",
    invalidation_thesis: "test invalidation content that is long enough",
    thesis_conviction: 0.7,
    execution_confidence: 0.5,
    priority: 0.5,
    preferred_horizon: "position",
    portfolio_context: { bucket: "core" },
    human_review: { required: true },
    display: {
      headline_en: "headline",
      headline_ja: "見出し",
      summary_en: "summary text long enough",
      summary_ja: "サマリテキスト長さ十分",
    },
    authored_via: "claude_code_dialogue",
    visibility: "public",
    ...overrides,
  } as TradeIntent;
}

function mkReject(fingerprint: string, rejected_at: string): IntentRejectEntry {
  return {
    intent_id: "int_rejected00000",
    source_signal_ids: [],
    cluster_fingerprint: fingerprint,
    proposer_version: "v0.2-alpha-rule",
    rejected_at,
    reason: "duplicate_of_approved",
  };
}

describe("filterDuplicateClusters", () => {
  it("keeps non-overlapping clusters", () => {
    const clusters = [
      mkCluster({
        signals: [mkSigStub("sig_new_1"), mkSigStub("sig_new_2")],
      }),
    ];
    const result = filterDuplicateClusters({
      candidates: clusters,
      activeIntents: [],
      rejectLog: [],
      jaccardThreshold: 0.5,
    });
    expect(result).toHaveLength(1);
  });

  it("filters clusters overlapping active Intent (Jaccard >= 0.5)", () => {
    const clusters = [
      mkCluster({
        signals: [mkSigStub("sig_1"), mkSigStub("sig_2")],
      }),
    ];
    const intents = [mkIntent({ source_signal_ids: ["sig_1", "sig_2"] })];
    const result = filterDuplicateClusters({
      candidates: clusters,
      activeIntents: intents,
      rejectLog: [],
      jaccardThreshold: 0.5,
    });
    expect(result).toHaveLength(0);
  });

  it("keeps when Jaccard < threshold", () => {
    const clusters = [
      mkCluster({
        signals: [
          mkSigStub("sig_1"),
          mkSigStub("sig_2"),
          mkSigStub("sig_3"),
          mkSigStub("sig_4"),
        ],
      }),
    ];
    const intents = [mkIntent({ source_signal_ids: ["sig_1"] })]; // 1/4 = 0.25
    const result = filterDuplicateClusters({
      candidates: clusters,
      activeIntents: intents,
      rejectLog: [],
      jaccardThreshold: 0.5,
    });
    expect(result).toHaveLength(1);
  });

  it("filters clusters with matching rejected fingerprint", () => {
    const clusters = [mkCluster({ fingerprint: "fp_recent_reject" })];
    const result = filterDuplicateClusters({
      candidates: clusters,
      activeIntents: [],
      rejectLog: [mkReject("fp_recent_reject", "2026-04-21T10:00:00Z")],
      jaccardThreshold: 0.5,
    });
    expect(result).toHaveLength(0);
  });

  it("filters clusters duplicating another pending proposed", () => {
    const clusters = [mkCluster({ fingerprint: "fp_pending" })];
    const intents = [
      mkIntent({
        status: "proposed",
        visibility: "private",
        authored_via: "sde_auto_proposal",
        proposer_metadata: {
          version: "v0.2-alpha-rule",
          cluster_fingerprint: "fp_pending",
          generated_at: "2026-04-21T00:00:00Z",
        },
      }),
    ];
    const result = filterDuplicateClusters({
      candidates: clusters,
      activeIntents: intents,
      rejectLog: [],
      jaccardThreshold: 0.5,
    });
    expect(result).toHaveLength(0);
  });

  it("ignores intents with status=cancelled or expired", () => {
    const clusters = [
      mkCluster({
        signals: [mkSigStub("sig_1"), mkSigStub("sig_2")],
      }),
    ];
    const intents = [
      mkIntent({ status: "cancelled", source_signal_ids: ["sig_1", "sig_2"] }),
      mkIntent({
        status: "expired",
        source_signal_ids: ["sig_1", "sig_2"],
        intent_id: "int_existing00001",
      }),
    ];
    const result = filterDuplicateClusters({
      candidates: clusters,
      activeIntents: intents,
      rejectLog: [],
      jaccardThreshold: 0.5,
    });
    expect(result).toHaveLength(1); // not filtered
  });
});
