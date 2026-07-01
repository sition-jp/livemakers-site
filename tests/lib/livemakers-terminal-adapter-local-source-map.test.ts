import { describe, expect, it } from "vitest";
import {
  getTerminalAdapterLocalSourceCandidate,
  terminalAdapterLocalSourceCandidates,
} from "@/lib/livemakers-terminal-adapter/local-source-map";

const expectedSourceIds = [
  "repo.pivot_assets",
  "repo.pivot_backtest",
  "repo.pivot_derivatives_history",
  "sition.terminal_live_snapshot",
  "sition.terminal_assets_snapshot",
  "sition.market_indicators",
  "sition.latest_terminal",
  "blocked.signals",
  "blocked.trade_intents",
];

describe("terminal adapter local source map", () => {
  it("declares the approved G10b candidate ids in a stable order", () => {
    expect(terminalAdapterLocalSourceCandidates.map((source) => source.sourceId)).toEqual(
      expectedSourceIds,
    );
  });

  it("keeps every candidate closed to direct display, UI producers, external fetch, and hidden-preview API routes", () => {
    for (const candidate of terminalAdapterLocalSourceCandidates) {
      expect(candidate.directDisplayAllowed).toBe(false);
      expect(candidate.producerRunAllowedFromUi).toBe(false);
      expect(candidate.externalFetchAllowedFromUi).toBe(false);
      expect(candidate.apiRouteRequiredForHiddenPreview).toBe(false);
    }
  });

  it("marks repo-local pivot artifacts as repo-local future candidates only", () => {
    const pivotAssets = getTerminalAdapterLocalSourceCandidate("repo.pivot_assets");

    expect(pivotAssets).toMatchObject({
      owner: "livemakers_repo",
      sourceFamily: "pivot_assets",
      sourceVisibility: "repo_local",
      relativePath: "data/pivot_assets.live.json",
      defaultPublicDisplaySafety: "needs_review",
      candidateDisplaySurfaces: ["leading_indicators", "scenario_radar"],
    });
  });

  it("marks 07_DATA sources as explicit-path internal candidates only", () => {
    const liveSnapshot = getTerminalAdapterLocalSourceCandidate(
      "sition.terminal_live_snapshot",
    );

    expect(liveSnapshot).toMatchObject({
      owner: "sition_07_data",
      sourceFamily: "terminal_live_snapshot",
      sourceVisibility: "internal_path",
      relativePath: "07_DATA/content/intelligence/terminal_assets.live.json",
      defaultPublicDisplaySafety: "internal_only",
      candidateDisplaySurfaces: ["live_data_strip"],
    });
  });

  it("explicitly blocks signals and trade intents from direct terminal display", () => {
    const signals = getTerminalAdapterLocalSourceCandidate("blocked.signals");
    const tradeIntents = getTerminalAdapterLocalSourceCandidate("blocked.trade_intents");

    for (const blocked of [signals, tradeIntents]) {
      expect(blocked.sourceVisibility).toBe("blocked");
      expect(blocked.defaultPublicDisplaySafety).toBe("blocked");
      expect(blocked.candidateDisplaySurfaces).toEqual([]);
      expect(blocked.directDisplayAllowed).toBe(false);
    }
  });
});
