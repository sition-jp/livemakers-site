import type {
  TerminalPreviewMock,
  TerminalPreviewModuleContract,
} from "./types";

const checked: TerminalPreviewModuleContract["prohibitedCouplingsChecked"] = {
  tradingSignal: true,
  orderInstruction: true,
  paperLive: true,
  atFeedback: true,
  secrets: true,
};

const moduleContract = (
  moduleId: TerminalPreviewModuleContract["moduleId"],
  displaySurface: TerminalPreviewModuleContract["displaySurface"],
  dataFamily: TerminalPreviewModuleContract["dataFamily"],
  contentKind: TerminalPreviewModuleContract["contentKind"],
): TerminalPreviewModuleContract => ({
  moduleId,
  displaySurface,
  dataFamily,
  sourceKind: "mock",
  sourceConfidence: "mock",
  contentKind,
  publicDisplaySafety: "mock_only",
  nullPolicy: "unavailable_not_zero",
  realDataConnection: false,
  prohibitedCouplingsChecked: checked,
});

export const terminalPreviewMock: TerminalPreviewMock = {
  routePolicy: {
    hidden: true,
    navLink: false,
    noindex: true,
  },
  terminalState: {
    posture: "mixed",
    asOfJst: "2026-06-30T18:35:20+09:00",
    label: {
      en: "Market State",
      ja: "マーケット状態",
    },
    summary: {
      en: "Mixed transition: policy windows, liquidity pressure, and AI infrastructure demand are all in review.",
      ja: "混合的な移行局面。政策窓、流動性圧力、AI インフラ需要を同時に確認する状態です。",
    },
  },
  indicators: [
    {
      id: "btc",
      label: "BTC",
      value: "mock +1.8%",
      family: "market",
      freshness: "mock",
      note: {
        en: "Fixture price posture",
        ja: "フィクスチャ価格姿勢",
      },
    },
    {
      id: "eth",
      label: "ETH",
      value: "mock +0.6%",
      family: "market",
      freshness: "mock",
      note: {
        en: "Fixture market breadth",
        ja: "フィクスチャ市場広がり",
      },
    },
    {
      id: "dxy",
      label: "DXY",
      value: "mock flat",
      family: "macro_liquidity",
      freshness: "mock",
      note: {
        en: "Dollar pressure marker",
        ja: "ドル圧力マーカー",
      },
    },
    {
      id: "policy-window",
      label: "Policy",
      value: "mock watch",
      family: "policy_regulatory",
      freshness: "mock",
      note: {
        en: "Regulatory window marker",
        ja: "規制イベント窓",
      },
    },
    {
      id: "ai-capex",
      label: "AI Capex",
      value: "mock rising",
      family: "ai_capital_cycle",
      freshness: "mock",
      note: {
        en: "Infrastructure demand marker",
        ja: "インフラ需要マーカー",
      },
    },
  ],
  developments: [
    {
      id: "crypto-compliance-window",
      confidence: "reported",
      label: {
        en: "Crypto venues adjust compliance windows",
        ja: "暗号資産取引所が規制対応期間を再整理",
      },
      summary: {
        en: "The terminal would separate confirmed facts from reported operational changes before linking to a full brief.",
        ja: "ターミナルでは、確定事実と報道ベースの運用変更を分けてから、詳細ブリーフへ接続します。",
      },
      sourceNote: {
        en: "Mock source ledger entry",
        ja: "モック source ledger 項目",
      },
    },
    {
      id: "ai-power-constraint",
      confidence: "watch",
      label: {
        en: "AI infrastructure demand keeps power capacity in focus",
        ja: "AI インフラ需要で電力容量が焦点化",
      },
      summary: {
        en: "This item illustrates how an AI capital-cycle item can sit beside market and policy context.",
        ja: "AI capital cycle の項目を、市場・政策文脈と同じ面に置く例です。",
      },
      sourceNote: {
        en: "Mock source ledger entry",
        ja: "モック source ledger 項目",
      },
    },
  ],
  watchItems: [
    {
      id: "liquidity-next-day",
      horizon: "24h",
      title: {
        en: "Liquidity handoff",
        ja: "流動性の引き継ぎ",
      },
      body: {
        en: "Watch whether the next session confirms or fades the current risk mix.",
        ja: "次のセッションで現在のリスク混合が確認されるか、弱まるかを見ます。",
      },
    },
    {
      id: "policy-window",
      horizon: "48-72h",
      title: {
        en: "Policy window",
        ja: "政策イベント窓",
      },
      body: {
        en: "Track deadlines, official language, and market interpretation separately.",
        ja: "期限、公式文言、市場解釈を分けて追跡します。",
      },
    },
    {
      id: "ai-infra-week",
      horizon: "weekly",
      title: {
        en: "AI infrastructure map",
        ja: "AI インフラ地図",
      },
      body: {
        en: "Compare compute, power, and capital spending headlines for continuity.",
        ja: "計算資源、電力、資本支出の見出しを連続性で比較します。",
      },
    },
  ],
  scenarios: [
    {
      id: "base",
      title: {
        en: "Base",
        ja: "Base",
      },
      body: {
        en: "Mixed conditions persist while verified developments arrive gradually.",
        ja: "確認済み材料が段階的に増える間、混合状態が続く。",
      },
      invalidation: {
        en: "Invalidated if source quality or freshness degrades.",
        ja: "ソース品質または鮮度が低下した場合は無効化。",
      },
    },
    {
      id: "risk",
      title: {
        en: "Risk",
        ja: "Risk",
      },
      body: {
        en: "Policy language or liquidity stress shifts the map toward caution.",
        ja: "政策文言または流動性ストレスにより、地図が警戒方向へ傾く。",
      },
      invalidation: {
        en: "Invalidated if official context resolves the uncertainty.",
        ja: "公式文脈が不確実性を解消した場合は無効化。",
      },
    },
    {
      id: "alt",
      title: {
        en: "Alt",
        ja: "Alt",
      },
      body: {
        en: "AI infrastructure and market breadth improve together.",
        ja: "AI インフラと市場の広がりが同時に改善する。",
      },
      invalidation: {
        en: "Invalidated if breadth narrows while headlines remain strong.",
        ja: "見出しが強くても市場の広がりが狭まる場合は無効化。",
      },
    },
  ],
  featuredBrief: {
    status: "mock_draft",
    title: {
      en: "Daily Intelligence Terminal Brief draft",
      ja: "Daily Intelligence Terminal Brief 草案",
    },
    summary: {
      en: "A future brief would connect this preview state to a durable article after source review.",
      ja: "将来のブリーフでは、ソース確認後にこの preview 状態を永続記事へ接続します。",
    },
  },
  sourceLedger: [
    {
      id: "market-fixture",
      confidence: "fixture_only",
      label: {
        en: "Market indicators fixture",
        ja: "市場指標フィクスチャ",
      },
      limitation: {
        en: "No current data connection in this preview.",
        ja: "この preview では現在データ接続なし。",
      },
    },
    {
      id: "macro-policy-fixture",
      confidence: "fixture_only",
      label: {
        en: "Macro and policy fixture",
        ja: "マクロ・政策フィクスチャ",
      },
      limitation: {
        en: "Used only to test information hierarchy.",
        ja: "情報階層の確認だけに使用。",
      },
    },
  ],
  modules: [
    moduleContract("market_state_header", "market_state_header", "editorial", "editorial_interpretation"),
    moduleContract("current_state_strip", "live_data_strip", "market", "raw_data"),
    moduleContract("what_happened", "what_happened", "policy_regulatory", "reviewed_data"),
    moduleContract("leading_indicators", "leading_indicators", "macro_liquidity", "watch_item"),
    moduleContract("scenario_radar", "scenario_radar", "editorial", "scenario"),
    moduleContract("featured_brief", "featured_brief", "editorial", "editorial_interpretation"),
    moduleContract("source_ledger", "source_ledger", "editorial", "reviewed_data"),
    moduleContract("boundary_note", "boundary_note", "editorial", "editorial_interpretation"),
  ],
  visibleCopy: {
    terminalState: {
      label: "Market State",
      summary:
        "Mixed transition: policy windows, liquidity pressure, and AI infrastructure demand are all in review.",
    },
    sections: [
      "Current-state strip",
      "What happened",
      "Leading indicators",
      "Scenario radar",
      "Featured brief",
      "Source ledger",
    ],
  },
};
