import { describe, it, expect } from "vitest";
import { detectClusters } from "@/lib/proposer/cluster-detect";
import { PROPOSER_CONFIG } from "@/lib/proposer/config";
import type { Signal } from "@/lib/signals";

function mkSignal(overrides: Partial<Signal>): Signal {
  return {
    id: "sig_default",
    trace_id: "t",
    root_trace_id: "rt",
    schema_version: "1.1-beta",
    created_at: "2026-04-21T12:00:00Z",
    type: "governance_shift",
    subtype: "drep",
    pillar: "governance_and_treasury",
    status: "active",
    idempotency_key: "idem-1",
    confidence: 0.7,
    impact: "medium",
    urgency: 0.5,
    time_horizon: "months",
    direction: "positive",
    primary_asset: "ADA",
    related_assets: ["ADA"],
    related_protocols: [],
    tradable: true,
    position_hint: { stance: "accumulate", conviction: 0.65 },
    evidence: [],
    similar_cases: [],
    headline_en: "h",
    headline_ja: "h",
    summary_en: "s",
    summary_ja: "s",
    source_ids: [],
    ...overrides,
  } as Signal;
}

describe("detectClusters", () => {
  it("groups by primary_asset", () => {
    const signals = [
      mkSignal({ id: "s1", primary_asset: "ADA", idempotency_key: "i1" }),
      mkSignal({ id: "s2", primary_asset: "ADA", idempotency_key: "i2" }),
      mkSignal({ id: "s3", primary_asset: "BTC", idempotency_key: "i3" }),
      mkSignal({ id: "s4", primary_asset: "BTC", idempotency_key: "i4" }),
    ];
    const { clusters } = detectClusters(signals, PROPOSER_CONFIG);
    const assets = clusters.map((c) => c.primary_asset).sort();
    expect(assets).toEqual(["ADA", "BTC"]);
  });

  it("splits groups by direction", () => {
    const signals = [
      mkSignal({ id: "s1", direction: "positive", idempotency_key: "i1" }),
      mkSignal({ id: "s2", direction: "positive", idempotency_key: "i2" }),
      mkSignal({ id: "s3", direction: "negative", idempotency_key: "i3" }),
      mkSignal({ id: "s4", direction: "negative", idempotency_key: "i4" }),
    ];
    const { clusters } = detectClusters(signals, PROPOSER_CONFIG);
    const directions = clusters.map((c) => c.direction).sort();
    expect(directions).toEqual(["negative", "positive"]);
  });

  it("excludes mixed direction, reports mixed_skipped", () => {
    const signals = [
      mkSignal({ id: "s1", direction: "mixed", idempotency_key: "i1" }),
      mkSignal({ id: "s2", direction: "mixed", idempotency_key: "i2" }),
    ];
    const { clusters, mixed_skipped } = detectClusters(signals, PROPOSER_CONFIG);
    expect(clusters).toHaveLength(0);
    expect(mixed_skipped).toBe(2);
  });

  it("drops clusters smaller than min_cluster_size", () => {
    const signals = [
      mkSignal({ id: "s1", primary_asset: "ADA", direction: "positive" }),
    ];
    const { clusters } = detectClusters(signals, PROPOSER_CONFIG);
    expect(clusters).toHaveLength(0);
  });

  it("drops clusters below min_avg_confidence", () => {
    const signals = [
      mkSignal({ id: "s1", confidence: 0.4, idempotency_key: "i1" }),
      mkSignal({ id: "s2", confidence: 0.45, idempotency_key: "i2" }),
    ];
    const { clusters } = detectClusters(signals, PROPOSER_CONFIG);
    expect(clusters).toHaveLength(0);
  });

  it("excludes assets not in supported_assets", () => {
    const signals = [
      mkSignal({ id: "s1", primary_asset: "XRP", idempotency_key: "i1" }),
      mkSignal({ id: "s2", primary_asset: "XRP", idempotency_key: "i2" }),
    ];
    const { clusters } = detectClusters(signals, PROPOSER_CONFIG);
    expect(clusters).toHaveLength(0);
  });

  it("ranks clusters by score = avg(confidence × impact_weight)", () => {
    const signals = [
      // ADA positive: high impact, high conf → high score
      mkSignal({
        id: "a1",
        primary_asset: "ADA",
        direction: "positive",
        confidence: 0.9,
        impact: "high",
        idempotency_key: "ia1",
      }),
      mkSignal({
        id: "a2",
        primary_asset: "ADA",
        direction: "positive",
        confidence: 0.9,
        impact: "high",
        idempotency_key: "ia2",
      }),
      // BTC positive: medium impact, medium conf → lower score
      mkSignal({
        id: "b1",
        primary_asset: "BTC",
        direction: "positive",
        confidence: 0.7,
        impact: "medium",
        idempotency_key: "ib1",
      }),
      mkSignal({
        id: "b2",
        primary_asset: "BTC",
        direction: "positive",
        confidence: 0.7,
        impact: "medium",
        idempotency_key: "ib2",
      }),
    ];
    const { clusters } = detectClusters(signals, PROPOSER_CONFIG);
    expect(clusters[0].primary_asset).toBe("ADA"); // higher score ranks first
  });

  it("computes cluster fingerprint", () => {
    const signals = [
      mkSignal({ id: "s1", idempotency_key: "i1" }),
      mkSignal({ id: "s2", idempotency_key: "i2" }),
    ];
    const { clusters } = detectClusters(signals, PROPOSER_CONFIG);
    expect(clusters[0].fingerprint).toMatch(/^[0-9a-f]{16}$/);
  });

  it("treats neutral direction same as positive/negative (min_cluster_size applies)", () => {
    // Spec §4.1 Step 2 ambiguously mentions 'neutral 群 → single-signal cluster のみ扱う'.
    // Current interpretation: neutral follows the same min_cluster_size rule.
    // A single neutral signal does NOT create a cluster (dropped like single positive).
    // If spec intent is different, adjust here + implementation together.
    const signals = [
      mkSignal({ id: "n1", primary_asset: "ADA", direction: "neutral" }),
    ];
    const { clusters } = detectClusters(signals, PROPOSER_CONFIG);
    expect(clusters).toHaveLength(0);
  });

  it("allows multi-signal neutral clusters when size threshold is met", () => {
    const signals = [
      mkSignal({ id: "n1", primary_asset: "ADA", direction: "neutral", confidence: 0.75 }),
      mkSignal({ id: "n2", primary_asset: "ADA", direction: "neutral", confidence: 0.75, idempotency_key: "i2" }),
    ];
    const { clusters } = detectClusters(signals, PROPOSER_CONFIG);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].direction).toBe("neutral");
  });
});
