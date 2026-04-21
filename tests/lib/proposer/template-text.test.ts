import { describe, it, expect } from "vitest";
import {
  buildThesis,
  buildWhyNow,
  buildTitle,
  buildDescription,
  buildDisplayHeadline,
  buildDisplaySummary,
} from "@/lib/proposer/template-text";
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
    idempotency_key: "idem-default",
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
    headline_en: "Top signal headline EN",
    headline_ja: "トップ Signal 見出し",
    summary_en: "Top signal summary.",
    summary_ja: "トップ Signal サマリ。",
    source_ids: [],
    ...overrides,
  } as Signal;
}

describe("buildTitle", () => {
  it("formats side + asset + top signal headline in JA", () => {
    const signal = mkSignal({ headline_ja: "DRep 1010 突破" });
    const title = buildTitle({
      side: "accumulate",
      primaryAsset: "ADA",
      topSignal: signal,
      lang: "ja",
    });
    expect(title).toContain("買い増し");
    expect(title).toContain("ADA");
    expect(title).toContain("DRep 1010 突破");
  });
  it("truncates to 120 chars", () => {
    const signal = mkSignal({ headline_ja: "x".repeat(200) });
    const title = buildTitle({
      side: "accumulate",
      primaryAsset: "ADA",
      topSignal: signal,
      lang: "ja",
    });
    expect(title.length).toBeLessThanOrEqual(120);
  });
});

describe("buildThesis", () => {
  it("concatenates top + second signal summaries with direction modifier", () => {
    const signals = [
      mkSignal({
        id: "s1",
        idempotency_key: "i1",
        summary_ja: "ガバナンス活性化で ADA 底堅さ示唆。",
        direction: "positive",
      }),
      mkSignal({
        id: "s2",
        idempotency_key: "i2",
        headline_ja: "Cardano DeFi TVL 増",
      }),
    ];
    const thesis = buildThesis({
      signals,
      primaryAsset: "ADA",
      side: "accumulate",
      horizon: "position",
      direction: "positive",
      lang: "ja",
    });
    expect(thesis).toContain("ガバナンス活性化");
    expect(thesis).toContain("Cardano DeFi TVL 増");
    expect(thesis).toContain("ADA");
    expect(thesis).toContain("買い増し");
  });
  it("handles single-signal cluster (no second signal)", () => {
    const signals = [mkSignal({ summary_ja: "Only signal summary." })];
    const thesis = buildThesis({
      signals,
      primaryAsset: "ADA",
      side: "hold",
      horizon: "swing",
      direction: "neutral",
      lang: "ja",
    });
    expect(thesis).toContain("Only signal summary");
    expect(thesis.length).toBeGreaterThan(20);
  });
  it("truncates to 500 chars", () => {
    const signals = [
      mkSignal({ id: "s1", idempotency_key: "i1", summary_ja: "x".repeat(400) }),
      mkSignal({ id: "s2", idempotency_key: "i2", headline_ja: "y".repeat(400) }),
    ];
    const thesis = buildThesis({
      signals,
      primaryAsset: "ADA",
      side: "accumulate",
      horizon: "position",
      direction: "positive",
      lang: "ja",
    });
    expect(thesis.length).toBeLessThanOrEqual(500);
  });
});

describe("buildWhyNow", () => {
  it("formats date + signal_type_ja + supporting count", () => {
    const signals = [
      mkSignal({ id: "s1", idempotency_key: "i1", created_at: "2026-04-21T15:00:00Z", type: "governance_shift" }),
      mkSignal({ id: "s2", idempotency_key: "i2", created_at: "2026-04-20T10:00:00Z" }),
      mkSignal({ id: "s3", idempotency_key: "i3", created_at: "2026-04-21T18:00:00Z", type: "defi_momentum" }),
    ];
    const whyNow = buildWhyNow({ signals, lang: "ja" });
    expect(whyNow).toContain("2026-04-21"); // freshest date (s3 at 18:00)
    expect(whyNow).toMatch(/DeFi|ガバナンス/);
    expect(whyNow).toContain("3"); // 3 signals
  });
});

describe("buildDescription + buildDisplaySummary", () => {
  it("concatenates summaries, truncates description to 500 chars", () => {
    const signals = Array.from({ length: 5 }, (_, i) =>
      mkSignal({
        id: `s${i}`,
        idempotency_key: `i${i}`,
        summary_ja: "x".repeat(200),
      })
    );
    const desc = buildDescription({ signals, lang: "ja" });
    expect(desc.length).toBeLessThanOrEqual(500);
  });
  it("truncates summary to 240 chars", () => {
    const signals = Array.from({ length: 3 }, (_, i) =>
      mkSignal({
        id: `s${i}`,
        idempotency_key: `i${i}`,
        summary_ja: "y".repeat(200),
      })
    );
    const sum = buildDisplaySummary({ signals, lang: "ja" });
    expect(sum.length).toBeLessThanOrEqual(240);
  });
});

describe("buildDisplayHeadline", () => {
  it("uses top signal headline, truncates to 80 chars", () => {
    const sig = mkSignal({ headline_ja: "z".repeat(200) });
    const out = buildDisplayHeadline({ topSignal: sig, lang: "ja" });
    expect(out.length).toBeLessThanOrEqual(80);
  });
});
