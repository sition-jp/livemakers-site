import { describe, expect, it } from "vitest";
import { breakingRadarAdapterFixture } from "@/lib/livemakers-terminal-adapter/breaking-radar-fixture";
import { buildTerminalPreviewMockFromAdapterFixture } from "@/lib/livemakers-terminal-preview/adapter-fixture-data";
import { terminalPreviewMock } from "@/lib/livemakers-terminal-preview/mock-data";

const nonScheduledPreview = buildTerminalPreviewMockFromAdapterFixture(
  breakingRadarAdapterFixture,
  terminalPreviewMock,
);

describe("non-scheduled adapter packet body materialization", () => {
  it("materializes body sections from an explicit non-scheduled fixture packet", () => {
    expect(nonScheduledPreview.routePolicy).toEqual({
      hidden: true,
      navLink: false,
      noindex: true,
    });
    expect(nonScheduledPreview.indicators).toEqual([
      expect.objectContaining({
        id: "breaking_radar.review_state",
        label: "Radar",
        value: "review",
        freshness: "fixture_only",
      }),
    ]);
    expect(
      nonScheduledPreview.developments.map((item) => ({
        id: item.id,
        label: item.label.en,
        confidence: item.confidence,
        sourceNote: item.sourceNote.en,
      })),
    ).toEqual([
      {
        id: "breaking_radar.what_happened.bank_capital",
        label: "Bank-capital commentary enters radar view",
        confidence: "watch",
        sourceNote: "Fixture-only Breaking Radar source note",
      },
    ]);
    expect(
      nonScheduledPreview.watchItems.map((item) => ({
        id: item.id,
        horizon: item.horizon,
        title: item.title.en,
        body: item.body.en,
      })),
    ).toEqual([
      {
        id: "breaking_radar.leading_indicators.ai_capacity.0",
        horizon: "24h",
        title: "AI infrastructure capacity repeats across fixture notes",
        body: "Fixture-only Breaking Radar review item; not ready for publication.",
      },
      {
        id: "breaking_radar.leading_indicators.protocol_status.0",
        horizon: "24h",
        title: "Protocol status wording needs primary-source check",
        body: "Fixture-only Breaking Radar review item; not ready for publication.",
      },
    ]);
    expect(nonScheduledPreview.featuredBrief).toEqual({
      title: {
        en: "Radar source discipline",
        ja: "Radarソース規律",
      },
      summary: {
        en: "Displayable fixture sources stay separated from internal snapshot provenance.",
        ja: "表示可能なフィクスチャソースと内部snapshot来歴を分けて扱います。",
      },
      status: "mock_draft",
    });
  });

  it("keeps non-scheduled body copy family-specific and excludes internal provenance", () => {
    const visibleCopy = JSON.stringify(nonScheduledPreview.visibleCopy);

    expect(visibleCopy).toContain("Fixture-only Breaking Radar source note");
    expect(visibleCopy).toContain(
      "Fixture-only Breaking Radar review item; not ready for publication.",
    );
    expect(visibleCopy).toContain("Radar source discipline");
    expect(visibleCopy).not.toContain("Fixture-only scheduled-session source note");
    expect(visibleCopy).not.toContain("Fixture-only scheduled-session review item");
    expect(visibleCopy).not.toContain("scheduled-session review continues");
    expect(visibleCopy).not.toContain("source.breaking_radar.manual_snapshot_internal");
    expect(visibleCopy).not.toContain("Breaking Radar manual snapshot internal fixture");
    expect(visibleCopy).not.toContain("Duplicate macro item already exists in scheduled session");
    expect(visibleCopy).not.toContain("Account-personalized raw capture is blocked");
    expect(visibleCopy).not.toContain("source.manual_snapshot.fixture.001");
    expect(visibleCopy).not.toContain("account-specific context");
    expect(visibleCopy).not.toContain("credentials");
    expect(visibleCopy).not.toContain("DMs");
  });

  it("keeps non-scheduled preview modules synthetic and disconnected", () => {
    expect(nonScheduledPreview.sourceLedger.map((source) => source.id)).toEqual([
      "source.breaking_radar.xnews_fixture",
      "source.breaking_radar.personalized_trend_fixture",
      "source.breaking_radar.scheduled_crosscheck",
    ]);
    expect(nonScheduledPreview.modules.map((module) => module.moduleId)).toEqual([
      "breaking_radar.what_happened.bank_capital",
      "breaking_radar.leading_indicators.ai_capacity",
      "breaking_radar.leading_indicators.protocol_status",
    ]);

    for (const module of nonScheduledPreview.modules) {
      expect(module.sourceKind).toBe("fixture_only");
      expect(module.sourceConfidence).toBe("mock");
      expect(module.publicDisplaySafety).toBe("mock_only");
      expect(module.realDataConnection).toBe(false);
      expect(module.prohibitedCouplingsChecked).toEqual({
        tradingSignal: true,
        orderInstruction: true,
        paperLive: true,
        atFeedback: true,
        secrets: true,
      });
    }
  });
});
