export type TerminalPreviewLocale = "en" | "ja";

export interface LocalizedText {
  en: string;
  ja: string;
}

export type TerminalLiveRadarLane =
  | "x_news_trends"
  | "sde_phase1_breaking_radar"
  | "manual_operator_observation";

export type TerminalLiveRadarStatus =
  | "breaking"
  | "checking"
  | "sde_review_pending";

export interface TerminalLiveRadarItem {
  id: string;
  sourceLane: TerminalLiveRadarLane;
  sourceLabel: LocalizedText;
  family: string;
  title: LocalizedText;
  status: TerminalLiveRadarStatus;
  freshnessLabel: LocalizedText;
  displayMode: "title_only";
  publishDecision: "not_authorized";
  href: null;
  body?: never;
}

export type TerminalArticleFamily =
  | "Signal"
  | "Deep Dive"
  | "Daily Intel"
  | "12 indicators"
  | "Next Era Map"
  | "Weekend 12 indicators";

export interface TerminalArticleNewsFeedItem {
  id: string;
  family: TerminalArticleFamily;
  title: LocalizedText;
  href: string;
  publishedAt: string;
  excerpt: LocalizedText;
}

export interface TerminalPreviewPublicTopology {
  scheduledSessionVisibility?: TerminalScheduledSessionVisibility;
  liveRadar: {
    title: LocalizedText;
    items: TerminalLiveRadarItem[];
  };
  articleNewsFeed: {
    title: LocalizedText;
    items: TerminalArticleNewsFeedItem[];
  };
}

export type TerminalScheduledSessionVisibilityStatus =
  | "detected"
  | "classified"
  | "surface_ready"
  | "hold_watch"
  | "verify_next"
  | "signal_seed"
  | "deepdive_seed"
  | "already_covered"
  | "excluded_with_reason";

export interface TerminalScheduledSessionVisibilityItem {
  id: string;
  status: TerminalScheduledSessionVisibilityStatus;
  family: string;
  title: LocalizedText;
  summary: LocalizedText;
  sourceItemId: string;
  reasonCode: string;
  detectedAtJst: string;
  href: null;
  publishDecision: "not_authorized";
}

export interface TerminalScheduledSessionVisibility {
  title: LocalizedText;
  sessionLabel: LocalizedText;
  sessionSlug: "asia_open" | "europe_bridge" | "ny_prep" | "ny_open_us_session";
  internalSlot: "morning" | "midday" | "evening" | "night";
  asOfJst: string;
  sourcePacketId: string;
  items: TerminalScheduledSessionVisibilityItem[];
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
  publicTopology: TerminalPreviewPublicTopology;
  sourceLedger: TerminalSourceLedgerItem[];
  modules: TerminalPreviewModuleContract[];
  visibleCopy: unknown;
}
