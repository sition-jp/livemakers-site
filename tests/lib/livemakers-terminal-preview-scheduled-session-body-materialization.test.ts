import { describe, expect, it } from "vitest";
import { scheduledSessionVisibilityAdapterFixture } from "@/lib/livemakers-terminal-adapter/scheduled-session-visibility-fixture";
import { buildTerminalPreviewMockFromAdapterFixture } from "@/lib/livemakers-terminal-preview/adapter-fixture-data";
import { terminalPreviewMock } from "@/lib/livemakers-terminal-preview/mock-data";

const scheduledPreview = buildTerminalPreviewMockFromAdapterFixture(
  scheduledSessionVisibilityAdapterFixture,
  terminalPreviewMock,
);

describe("scheduled-session preview body materialization", () => {
  it("materializes the current-state strip from the scheduled-session market state module", () => {
    expect(scheduledPreview.indicators).toEqual([
      expect.objectContaining({
        id: "scheduled.market_state_header",
        label: "Session",
        value: "review",
        freshness: "fixture_only",
        note: {
          en: "Cross-asset pressure is treated as session context, not an article decision.",
          ja: "クロスアセットの圧力は記事判断ではなくセッション文脈として扱います。",
        },
      }),
    ]);
  });

  it("materializes what-happened developments from scheduled-session modules", () => {
    expect(
      scheduledPreview.developments.map((item) => ({
        id: item.id,
        label: item.label.en,
        confidence: item.confidence,
      })),
    ).toEqual([
      {
        id: "scheduled.what_happened.macro",
        label: "Bank capital check",
        confidence: "watch",
      },
      {
        id: "scheduled.what_happened.ai_cost",
        label: "AI inference cost watch",
        confidence: "watch",
      },
    ]);
  });

  it("materializes leading-indicator watch items from scheduled-session payload items", () => {
    expect(
      scheduledPreview.watchItems.map((item) => ({
        id: item.id,
        horizon: item.horizon,
        title: item.title.en,
      })),
    ).toEqual([
      {
        id: "scheduled.leading_indicators.0",
        horizon: "24h",
        title: "Cardano status wording needs direct confirmation.",
      },
      {
        id: "scheduled.leading_indicators.1",
        horizon: "48-72h",
        title: "AI cost claims need exact source refresh.",
      },
      {
        id: "scheduled.leading_indicators.2",
        horizon: "weekly",
        title: "Cross-asset context stays terminal-only.",
      },
    ]);
  });

  it("materializes a source-discipline featured brief and excludes internal-only scenario copy", () => {
    expect(scheduledPreview.featuredBrief).toEqual({
      title: {
        en: "Source discipline",
        ja: "ソース規律",
      },
      summary: {
        en: "Public sources and fixture-only provenance stay separated.",
        ja: "公開ソースとフィクスチャ来歴を分けて扱います。",
      },
      status: "mock_draft",
    });

    expect(scheduledPreview.scenarios).toHaveLength(3);

    const visibleCopy = JSON.stringify(scheduledPreview.visibleCopy);
    expect(visibleCopy).toContain("Bank capital check");
    expect(visibleCopy).toContain("AI inference cost watch");
    expect(visibleCopy).toContain("Cardano status wording needs direct confirmation.");
    expect(visibleCopy).toContain("Source discipline");
    expect(visibleCopy).not.toContain("Policy hold watch");
    expect(visibleCopy).not.toContain("P2-TERMINAL-G6b Control Plane fixture");
  });
});
