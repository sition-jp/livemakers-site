import { describe, expect, it } from "vitest";
import { scheduledSessionVisibilityAdapterFixture } from "@/lib/livemakers-terminal-adapter/scheduled-session-visibility-fixture";
import { buildTerminalPreviewMockFromAdapterFixture } from "@/lib/livemakers-terminal-preview/adapter-fixture-data";
import { terminalPreviewMock } from "@/lib/livemakers-terminal-preview/mock-data";

describe("scheduled-session preview bridge filter", () => {
  const scheduledPreview = buildTerminalPreviewMockFromAdapterFixture(
    scheduledSessionVisibilityAdapterFixture,
    terminalPreviewMock,
  );

  it("filters internal fixture provenance from the preview source ledger and visible copy", () => {
    expect(scheduledPreview.sourceLedger.map((source) => source.id)).toEqual([
      "source.fed_stress_test",
      "source.cardano_hardfork_status",
      "source.ai_inference_cost_fixture",
      "source.market_snapshot_fixture",
    ]);

    const visibleCopy = JSON.stringify(scheduledPreview.visibleCopy);
    expect(visibleCopy).not.toContain("source.g6b_control_plane_fixture");
    expect(visibleCopy).not.toContain("P2-TERMINAL-G6b Control Plane fixture");
    expect(visibleCopy).not.toContain("Internal fixture provenance only");
    expect(visibleCopy).not.toContain("内部フィクスチャ来歴");
  });

  it("filters blocked, internal-only, and boundary-note modules from preview modules", () => {
    expect(scheduledPreview.modules.map((module) => module.moduleId)).toEqual([
      "scheduled.market_state_header",
      "scheduled.what_happened.macro",
      "scheduled.what_happened.ai_cost",
      "scheduled.leading_indicators",
      "scheduled.source_ledger",
    ]);
  });

  it("keeps the scheduled-session terminal state hidden, synthetic, and disconnected", () => {
    expect(scheduledPreview.routePolicy).toEqual({
      hidden: true,
      navLink: false,
      noindex: true,
    });
    expect(scheduledPreview.terminalState.asOfJst).toBe(
      "2026-06-25T07:18:02+09:00",
    );
    expect(scheduledPreview.terminalState.label).toEqual({
      en: "Asia Open market state",
      ja: "Asia Open市場状態",
    });

    for (const module of scheduledPreview.modules) {
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
