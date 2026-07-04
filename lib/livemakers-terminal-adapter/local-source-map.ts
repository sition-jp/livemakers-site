import type { TerminalAdapterModule } from "./types";

export type TerminalAdapterLocalSourceFamily =
  | "pivot_assets"
  | "pivot_backtest"
  | "pivot_derivatives_history"
  | "terminal_live_snapshot"
  | "terminal_assets_snapshot"
  | "market_indicators"
  | "latest_terminal"
  | "signals"
  | "trade_intents";

export type TerminalAdapterLocalSourceOwner =
  | "livemakers_repo"
  | "sition_07_data";

export type TerminalAdapterLocalSourceVisibility =
  | "repo_local"
  | "internal_path"
  | "blocked";

export type TerminalAdapterLocalSourcePublicDisplaySafety =
  | "needs_review"
  | "internal_only"
  | "blocked";

export type TerminalAdapterLocalSourceDisplaySurface =
  TerminalAdapterModule["display_surface"];

export interface TerminalAdapterLocalSourceCandidate {
  sourceId: string;
  sourceFamily: TerminalAdapterLocalSourceFamily;
  relativePath: string;
  owner: TerminalAdapterLocalSourceOwner;
  sourceVisibility: TerminalAdapterLocalSourceVisibility;
  candidateDisplaySurfaces: readonly TerminalAdapterLocalSourceDisplaySurface[];
  defaultPublicDisplaySafety: TerminalAdapterLocalSourcePublicDisplaySafety;
  directDisplayAllowed: false;
  producerRunAllowedFromUi: false;
  externalFetchAllowedFromUi: false;
  apiRouteRequiredForHiddenPreview: false;
  notesEn: string;
  notesJa: string;
}

export const terminalAdapterLocalSourceCandidates = [
  {
    sourceId: "repo.pivot_assets",
    sourceFamily: "pivot_assets",
    relativePath: "data/pivot_assets.live.json",
    owner: "livemakers_repo",
    sourceVisibility: "repo_local",
    candidateDisplaySurfaces: ["leading_indicators", "scenario_radar"],
    defaultPublicDisplaySafety: "needs_review",
    directDisplayAllowed: false,
    producerRunAllowedFromUi: false,
    externalFetchAllowedFromUi: false,
    apiRouteRequiredForHiddenPreview: false,
    notesEn:
      "Repo-local pivot snapshot candidate for a later adapter packet builder; not direct terminal display.",
    notesJa:
      "後続のadapter packet builder候補となるrepo-local pivot snapshotです。terminalへ直接表示しません。",
  },
  {
    sourceId: "repo.pivot_backtest",
    sourceFamily: "pivot_backtest",
    relativePath: "data/pivot_backtest.live.json",
    owner: "livemakers_repo",
    sourceVisibility: "repo_local",
    candidateDisplaySurfaces: ["source_ledger", "boundary_note"],
    defaultPublicDisplaySafety: "needs_review",
    directDisplayAllowed: false,
    producerRunAllowedFromUi: false,
    externalFetchAllowedFromUi: false,
    apiRouteRequiredForHiddenPreview: false,
    notesEn:
      "Repo-local backtest snapshot may support provenance and limitations, not primary terminal values.",
    notesJa:
      "repo-local backtest snapshotは出典・制約の補助候補です。主要なterminal値として直接表示しません。",
  },
  {
    sourceId: "repo.pivot_derivatives_history",
    sourceFamily: "pivot_derivatives_history",
    relativePath: "data/pivot_derivatives_history.live.json",
    owner: "livemakers_repo",
    sourceVisibility: "repo_local",
    candidateDisplaySurfaces: ["source_ledger", "boundary_note"],
    defaultPublicDisplaySafety: "internal_only",
    directDisplayAllowed: false,
    producerRunAllowedFromUi: false,
    externalFetchAllowedFromUi: false,
    apiRouteRequiredForHiddenPreview: false,
    notesEn:
      "Derivatives history is internal evidence behind pivot scores; visible wording requires a later review gate.",
    notesJa:
      "derivatives historyはpivot scoreの内部根拠です。表示文言には後続レビューが必要です。",
  },
  {
    sourceId: "sition.terminal_live_snapshot",
    sourceFamily: "terminal_live_snapshot",
    relativePath: "07_DATA/content/intelligence/terminal_assets.live.json",
    owner: "sition_07_data",
    sourceVisibility: "internal_path",
    candidateDisplaySurfaces: ["live_data_strip"],
    defaultPublicDisplaySafety: "internal_only",
    directDisplayAllowed: false,
    producerRunAllowedFromUi: false,
    externalFetchAllowedFromUi: false,
    apiRouteRequiredForHiddenPreview: false,
    notesEn:
      "Future explicit-path read-only candidate for live terminal state; not opened by G10b.",
    notesJa:
      "将来のexplicit-path read-only候補です。G10bでは接続を開きません。",
  },
  {
    sourceId: "sition.terminal_assets_snapshot",
    sourceFamily: "terminal_assets_snapshot",
    relativePath: "07_DATA/content/intelligence/terminal_assets.json",
    owner: "sition_07_data",
    sourceVisibility: "internal_path",
    candidateDisplaySurfaces: ["live_data_strip", "source_ledger"],
    defaultPublicDisplaySafety: "internal_only",
    directDisplayAllowed: false,
    producerRunAllowedFromUi: false,
    externalFetchAllowedFromUi: false,
    apiRouteRequiredForHiddenPreview: false,
    notesEn:
      "Future explicit-path asset snapshot candidate after freshness and null-policy review.",
    notesJa:
      "freshnessとnull policyの確認後に扱う将来のexplicit-path asset snapshot候補です。",
  },
  {
    sourceId: "sition.market_indicators",
    sourceFamily: "market_indicators",
    relativePath: "07_DATA/content/intelligence/market_indicators.jsonl",
    owner: "sition_07_data",
    sourceVisibility: "internal_path",
    candidateDisplaySurfaces: ["what_happened", "leading_indicators"],
    defaultPublicDisplaySafety: "internal_only",
    directDisplayAllowed: false,
    producerRunAllowedFromUi: false,
    externalFetchAllowedFromUi: false,
    apiRouteRequiredForHiddenPreview: false,
    notesEn:
      "Market indicators need a reviewed distillation sidecar before any UI-facing adapter packet.",
    notesJa:
      "market indicatorsはUI向けadapter packet化の前にreviewed distillation sidecarが必要です。",
  },
  {
    sourceId: "sition.latest_terminal",
    sourceFamily: "latest_terminal",
    relativePath: "07_DATA/content/intelligence/latest_terminal.md",
    owner: "sition_07_data",
    sourceVisibility: "internal_path",
    candidateDisplaySurfaces: ["featured_brief", "boundary_note"],
    defaultPublicDisplaySafety: "internal_only",
    directDisplayAllowed: false,
    producerRunAllowedFromUi: false,
    externalFetchAllowedFromUi: false,
    apiRouteRequiredForHiddenPreview: false,
    notesEn:
      "Latest terminal is internal editorial context until curated into public-safe module copy.",
    notesJa:
      "latest terminalはpublic-safe module copyへ整理されるまで内部editorial contextです。",
  },
  {
    sourceId: "blocked.signals",
    sourceFamily: "signals",
    relativePath: "07_DATA/content/intelligence/signals.jsonl",
    owner: "sition_07_data",
    sourceVisibility: "blocked",
    candidateDisplaySurfaces: [],
    defaultPublicDisplaySafety: "blocked",
    directDisplayAllowed: false,
    producerRunAllowedFromUi: false,
    externalFetchAllowedFromUi: false,
    apiRouteRequiredForHiddenPreview: false,
    notesEn:
      "Signals remain blocked from direct terminal display and require a later non-advice transformation gate.",
    notesJa:
      "signalsのterminal直接表示は閉じたままです。後続の非助言変換ゲートが必要です。",
  },
  {
    sourceId: "blocked.trade_intents",
    sourceFamily: "trade_intents",
    relativePath: "07_DATA/content/intelligence/tradeintents.jsonl",
    owner: "sition_07_data",
    sourceVisibility: "blocked",
    candidateDisplaySurfaces: [],
    defaultPublicDisplaySafety: "blocked",
    directDisplayAllowed: false,
    producerRunAllowedFromUi: false,
    externalFetchAllowedFromUi: false,
    apiRouteRequiredForHiddenPreview: false,
    notesEn:
      "Trade intents remain blocked from terminal display because they carry trading semantics.",
    notesJa:
      "trade intentsはtrading semanticsを含むためterminal表示は閉じたままです。",
  },
] as const satisfies readonly TerminalAdapterLocalSourceCandidate[];

export type TerminalAdapterLocalSourceId =
  (typeof terminalAdapterLocalSourceCandidates)[number]["sourceId"];

export function getTerminalAdapterLocalSourceCandidate(
  sourceId: TerminalAdapterLocalSourceId,
): TerminalAdapterLocalSourceCandidate {
  const candidate = terminalAdapterLocalSourceCandidates.find(
    (source) => source.sourceId === sourceId,
  );

  if (candidate == null) {
    throw new Error(`Unknown terminal adapter local source: ${sourceId}`);
  }

  return candidate;
}
