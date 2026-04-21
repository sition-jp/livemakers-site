import { describe, it, expect } from "vitest";
import { buildDraftInput } from "@/lib/proposer/field-mapper";
import type { Cluster } from "@/lib/proposer/cluster-detect";
import type { Signal } from "@/lib/signals";

function mkSignal(overrides: Partial<Signal>): Signal {
  return {
    id: "s1",
    trace_id: "t",
    root_trace_id: "rt",
    schema_version: "1.1-beta",
    created_at: "2026-04-21T12:00:00Z",
    type: "governance_shift",
    subtype: "drep",
    pillar: "governance_and_treasury",
    status: "active",
    idempotency_key: "idem-default",
    confidence: 0.78,
    impact: "high",
    urgency: 0.5,
    time_horizon: "2-4 weeks",
    direction: "positive",
    primary_asset: "ADA",
    related_assets: ["ADA"],
    related_protocols: [],
    tradable: true,
    position_hint: { stance: "accumulate", conviction: 0.7 },
    evidence: [],
    similar_cases: [],
    headline_en: "ADA governance momentum",
    headline_ja: "ADA ガバナンス活性化",
    summary_en: "Governance momentum here.",
    summary_ja: "ガバナンス活性化の兆候が出てきた。",
    source_ids: [],
    ...overrides,
  } as Signal;
}

describe("buildDraftInput", () => {
  const cluster: Cluster = {
    signals: [
      mkSignal({
        id: "s1",
        idempotency_key: "i1",
        confidence: 0.78,
        position_hint: { stance: "accumulate", conviction: 0.7 },
      }),
      mkSignal({
        id: "s2",
        idempotency_key: "i2",
        confidence: 0.65,
        position_hint: { stance: "accumulate", conviction: 0.6 },
      }),
    ],
    primary_asset: "ADA",
    direction: "positive",
    fingerprint: "fp_abcdef0123456789",
    score: 0.5,
  };

  it("maps source_signal_ids from cluster signals", () => {
    const input = buildDraftInput(cluster, {
      currentPrices: { ADA: 0.251 },
      nowIso: "2026-04-21T23:03:00Z",
    });
    expect(input.source_signal_ids).toEqual(["s1", "s2"]);
  });

  it("side: positive + accumulate → accumulate", () => {
    const input = buildDraftInput(cluster, {
      currentPrices: { ADA: 0.251 },
      nowIso: "2026-04-21T23:03:00Z",
    });
    expect(input.side).toBe("accumulate");
  });

  it("side: fallback to hold when mapping missing (undefined position_hint)", () => {
    const weirdCluster: Cluster = {
      ...cluster,
      signals: [mkSignal({ position_hint: undefined })],
    };
    const input = buildDraftInput(weirdCluster, {
      currentPrices: { ADA: 0.251 },
      nowIso: "2026-04-21T23:03:00Z",
    });
    expect(input.side).toBe("hold");
  });

  it("bucket from pillar: governance_and_treasury → core", () => {
    const input = buildDraftInput(cluster, {
      currentPrices: { ADA: 0.251 },
      nowIso: "2026-04-21T23:03:00Z",
    });
    expect(input.portfolio_context.bucket).toBe("core");
  });

  it("bucket fallback to tactical for unknown pillar", () => {
    const unknownCluster: Cluster = {
      ...cluster,
      signals: [mkSignal({ pillar: "unknown_pillar" as any })],
    };
    const input = buildDraftInput(unknownCluster, {
      currentPrices: { ADA: 0.251 },
      nowIso: "2026-04-21T23:03:00Z",
    });
    expect(input.portfolio_context.bucket).toBe("tactical");
  });

  it("thesis_conviction: weighted avg", () => {
    const input = buildDraftInput(cluster, {
      currentPrices: { ADA: 0.251 },
      nowIso: "2026-04-21T23:03:00Z",
    });
    // avgConf=(0.78+0.65)/2=0.715, avgConv=(0.7+0.6)/2=0.65
    // 0.715*0.7 + 0.65*0.3 = 0.5005 + 0.195 = 0.6955 → round to 0.70
    expect(input.thesis_conviction).toBeCloseTo(0.7, 2);
  });

  it("execution_confidence: 0.40 default", () => {
    const input = buildDraftInput(cluster, {
      currentPrices: { ADA: 0.251 },
      nowIso: "2026-04-21T23:03:00Z",
    });
    expect(input.execution_confidence).toBe(0.4);
  });

  it("preferred_horizon: maps Signal time_horizon to Intent PreferredHorizon", () => {
    // All signals use "2-4 weeks" → maps to "position"
    const input = buildDraftInput(cluster, {
      currentPrices: { ADA: 0.251 },
      nowIso: "2026-04-21T23:03:00Z",
    });
    expect(input.preferred_horizon).toBe("position");
  });

  it("horizon mapping covers all Signal time_horizon values", () => {
    const mappings = [
      { sh: "hours", ih: "intraday" },
      { sh: "days", ih: "swing" },
      { sh: "1-2 weeks", ih: "swing" },
      { sh: "2-4 weeks", ih: "position" },
      { sh: "months", ih: "multi-week" },
    ] as const;
    for (const { sh, ih } of mappings) {
      const c: Cluster = {
        ...cluster,
        signals: [
          mkSignal({ id: "h1", idempotency_key: "h1", time_horizon: sh }),
          mkSignal({ id: "h2", idempotency_key: "h2", time_horizon: sh }),
        ],
      };
      const input = buildDraftInput(c, {
        currentPrices: { ADA: 0.251 },
        nowIso: "2026-04-21T23:03:00Z",
      });
      expect(input.preferred_horizon).toBe(ih);
    }
  });

  it("preferred_horizon uses mode when signals have mixed horizons", () => {
    const c: Cluster = {
      ...cluster,
      signals: [
        mkSignal({
          id: "a1",
          idempotency_key: "a1",
          time_horizon: "2-4 weeks",
        }),
        mkSignal({
          id: "a2",
          idempotency_key: "a2",
          time_horizon: "2-4 weeks",
        }),
        mkSignal({ id: "a3", idempotency_key: "a3", time_horizon: "days" }),
      ],
    };
    const input = buildDraftInput(c, {
      currentPrices: { ADA: 0.251 },
      nowIso: "2026-04-21T23:03:00Z",
    });
    // mode is "2-4 weeks" → "position"
    expect(input.preferred_horizon).toBe("position");
  });

  it("expires_at: created_at + horizon offset days", () => {
    const input = buildDraftInput(cluster, {
      currentPrices: { ADA: 0.251 },
      nowIso: "2026-04-21T23:03:00Z",
    });
    // position = +28 days → 2026-05-19
    expect(input.expires_at).toMatch(/^2026-05-19/);
  });

  it("invalidation uses market price when available", () => {
    const input = buildDraftInput(cluster, {
      currentPrices: { ADA: 0.251 },
      nowIso: "2026-04-21T23:03:00Z",
    });
    expect(input.invalidation_thesis).toMatch(/\$0\.22/);
    expect(input.invalidation_thesis).not.toContain("<<MANUAL:");
  });

  it("invalidation uses placeholder when price missing", () => {
    const input = buildDraftInput(cluster, {
      currentPrices: {},
      nowIso: "2026-04-21T23:03:00Z",
    });
    expect(input.invalidation_thesis).toContain("<<MANUAL:");
  });

  it("display.headline_ja populated, headline_en empty (v0.2-α)", () => {
    const input = buildDraftInput(cluster, {
      currentPrices: { ADA: 0.251 },
      nowIso: "2026-04-21T23:03:00Z",
    });
    expect(input.display.headline_ja.length).toBeGreaterThan(0);
    expect(input.display.headline_en).toBe("");
  });

  it("target_assets: union of primary + related", () => {
    const c: Cluster = {
      ...cluster,
      signals: [
        mkSignal({
          id: "t1",
          idempotency_key: "t1",
          primary_asset: "ADA",
          related_assets: ["ADA", "MIN"],
        }),
        mkSignal({
          id: "t2",
          idempotency_key: "t2",
          primary_asset: "ADA",
          related_assets: ["ADA", "LQ"],
        }),
      ],
    };
    const input = buildDraftInput(c, {
      currentPrices: { ADA: 0.251 },
      nowIso: "2026-04-21T23:03:00Z",
    });
    expect(input.target_assets.sort()).toEqual(["ADA", "LQ", "MIN"]);
  });

  it("proposer_metadata populated with version/fingerprint/generated_at", () => {
    const input = buildDraftInput(cluster, {
      currentPrices: { ADA: 0.251 },
      nowIso: "2026-04-21T23:03:00Z",
    });
    expect(input.proposer_metadata.version).toBe("v0.2-alpha-rule");
    expect(input.proposer_metadata.cluster_fingerprint).toBe(
      "fp_abcdef0123456789",
    );
    expect(input.proposer_metadata.generated_at).toBe("2026-04-21T23:03:00Z");
  });
});
