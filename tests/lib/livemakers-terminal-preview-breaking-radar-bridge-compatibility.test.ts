import { describe, expect, it } from "vitest";
import { breakingRadarAdapterFixture } from "@/lib/livemakers-terminal-adapter/breaking-radar-fixture";
import { buildTerminalPreviewMockFromAdapterFixture } from "@/lib/livemakers-terminal-preview/adapter-fixture-data";
import { terminalPreviewMock } from "@/lib/livemakers-terminal-preview/mock-data";

describe("breaking radar preview bridge compatibility", () => {
  const breakingRadarPreview = buildTerminalPreviewMockFromAdapterFixture(
    breakingRadarAdapterFixture,
    terminalPreviewMock,
  );

  it("builds hidden preview state from the Breaking Radar adapter fixture after the default fixture switch", () => {
    expect(breakingRadarAdapterFixture.packet_id).toBe(
      "fixture.breaking_radar_adapter.2026_07_01.sample_g1",
    );
    expect(breakingRadarPreview.routePolicy).toEqual({
      hidden: true,
      navLink: false,
      noindex: true,
    });
    expect(breakingRadarPreview.terminalState.asOfJst).toBe(
      "2026-07-01T13:55:53+09:00",
    );
    expect(breakingRadarPreview.terminalState.label).toEqual({
      en: "Breaking Radar review queue",
      ja: "Breaking Radar確認キュー",
    });
  });

  it("maps only displayable Breaking Radar sources and modules", () => {
    expect(breakingRadarPreview.sourceLedger.map((source) => source.id)).toEqual([
      "source.breaking_radar.xnews_fixture",
      "source.breaking_radar.personalized_trend_fixture",
      "source.breaking_radar.scheduled_crosscheck",
    ]);
    expect(breakingRadarPreview.modules.map((module) => module.moduleId)).toEqual([
      "breaking_radar.what_happened.bank_capital",
      "breaking_radar.leading_indicators.ai_capacity",
      "breaking_radar.leading_indicators.protocol_status",
    ]);
  });

  it("uses Breaking Radar bridge copy instead of scheduled-session bridge copy", () => {
    expect(breakingRadarPreview.developments[0]?.sourceNote).toEqual({
      en: "Fixture-only Breaking Radar source note",
      ja: "フィクスチャ専用Breaking Radarソース注記",
    });
    expect(breakingRadarPreview.watchItems.map((item) => item.body.en)).toEqual([
      "Fixture-only Breaking Radar review item; not ready for publication.",
      "Fixture-only Breaking Radar review item; not ready for publication.",
    ]);
    expect(breakingRadarPreview.featuredBrief.title).toEqual({
      en: "Radar source discipline",
      ja: "Radarソース規律",
    });

    const visibleCopy = JSON.stringify(breakingRadarPreview.visibleCopy);
    expect(visibleCopy).not.toContain("Fixture-only scheduled-session source note");
    expect(visibleCopy).not.toContain("フィクスチャ専用scheduled-sessionソース注記");
    expect(visibleCopy).not.toContain("Fixture-only scheduled-session review item");
    expect(visibleCopy).not.toContain("フィクスチャ専用のscheduled-session確認項目です");
    expect(visibleCopy).not.toContain("scheduled-session review continues");
    expect(visibleCopy).not.toContain("scheduled-session確認中");
  });

  it("keeps internal manual snapshot and operator-only candidate copy out of preview output", () => {
    const visibleCopy = JSON.stringify(breakingRadarPreview.visibleCopy);

    expect(visibleCopy).not.toContain("source.breaking_radar.manual_snapshot_internal");
    expect(visibleCopy).not.toContain("Breaking Radar manual snapshot internal fixture");
    expect(visibleCopy).not.toContain("Duplicate macro item already exists in scheduled session");
    expect(visibleCopy).not.toContain("Account-personalized raw capture is blocked");
    expect(visibleCopy).not.toContain("source.manual_snapshot.fixture.001");
    expect(visibleCopy).not.toContain("account-specific context");
    expect(visibleCopy).not.toContain("credentials");
    expect(visibleCopy).not.toContain("DMs");
  });
});
