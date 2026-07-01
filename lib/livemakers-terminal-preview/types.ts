export type TerminalPreviewLocale = "en" | "ja";

export interface LocalizedText {
  en: string;
  ja: string;
}

export interface TerminalPreviewModuleContract {
  moduleId: string;
  displaySurface:
    | "market_state_header"
    | "live_data_strip"
    | "what_happened"
    | "leading_indicators"
    | "scenario_radar"
    | "featured_brief"
    | "source_ledger"
    | "boundary_note";
  dataFamily:
    | "market"
    | "crypto_onchain"
    | "macro_liquidity"
    | "policy_regulatory"
    | "ai_capital_cycle"
    | "editorial";
  sourceKind: "mock" | "fixture_only";
  sourceConfidence: "mock";
  contentKind:
    | "raw_data"
    | "reviewed_data"
    | "editorial_interpretation"
    | "scenario"
    | "watch_item";
  publicDisplaySafety: "mock_only";
  nullPolicy: "unavailable_not_zero";
  realDataConnection: false;
  prohibitedCouplingsChecked: {
    tradingSignal: true;
    orderInstruction: true;
    paperLive: true;
    atFeedback: true;
    secrets: true;
  };
}

export interface TerminalIndicator {
  id: string;
  label: string;
  value: string;
  note: LocalizedText;
  family: TerminalPreviewModuleContract["dataFamily"];
  freshness: "mock" | "fixture_only" | "unavailable";
}

export interface TerminalDevelopment {
  id: string;
  label: LocalizedText;
  summary: LocalizedText;
  confidence: "confirmed" | "reported" | "watch";
  sourceNote: LocalizedText;
}

export interface TerminalWatchItem {
  id: string;
  horizon: "24h" | "48-72h" | "weekly";
  title: LocalizedText;
  body: LocalizedText;
}

export interface TerminalScenario {
  id: "base" | "risk" | "alt";
  title: LocalizedText;
  body: LocalizedText;
  invalidation: LocalizedText;
}

export interface TerminalSourceLedgerItem {
  id: string;
  label: LocalizedText;
  confidence: "mock" | "fixture_only";
  limitation: LocalizedText;
}

export interface TerminalPreviewMock {
  routePolicy: {
    hidden: true;
    navLink: false;
    noindex: true;
  };
  terminalState: {
    posture: "mixed" | "transition" | "verification_pending" | "stale";
    asOfJst: string;
    label: LocalizedText;
    summary: LocalizedText;
  };
  indicators: TerminalIndicator[];
  developments: TerminalDevelopment[];
  watchItems: TerminalWatchItem[];
  scenarios: TerminalScenario[];
  featuredBrief: {
    title: LocalizedText;
    summary: LocalizedText;
    status: "mock_draft";
  };
  sourceLedger: TerminalSourceLedgerItem[];
  modules: TerminalPreviewModuleContract[];
  visibleCopy: unknown;
}
