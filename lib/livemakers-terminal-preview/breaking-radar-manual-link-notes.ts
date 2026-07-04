import type { TerminalLiveRadarItem } from "./types";

const manualLinkNoteSourceLabel = {
  en: "Manual link-note",
  ja: "Manual link-note",
};

const manualLinkNoteFreshnessLabel = {
  en: "Manual note pending review",
  ja: "手動メモ確認待ち",
};

const manualLinkNoteBase = {
  sourceLane: "manual_operator_observation",
  sourceLabel: manualLinkNoteSourceLabel,
  status: "checking",
  freshnessLabel: manualLinkNoteFreshnessLabel,
  displayMode: "title_only",
  publishDecision: "not_authorized",
  href: null,
} satisfies Pick<
  TerminalLiveRadarItem,
  | "sourceLane"
  | "sourceLabel"
  | "status"
  | "freshnessLabel"
  | "displayMode"
  | "publishDecision"
  | "href"
>;

export const breakingRadarManualLinkNoteItems = [
  {
    ...manualLinkNoteBase,
    id: "br-manual-20260702-001",
    family: "Crypto / On-chain",
    title: {
      en: "Crypto card deposits cross $10B for the first time",
      ja: "Crypto card deposits cross $10B for the first time",
    },
  },
  {
    ...manualLinkNoteBase,
    id: "br-manual-20260702-002",
    family: "Macro / Liquidity",
    title: {
      en: "Fed rate-hike projection resurfaces for this year",
      ja: "Fed rate-hike projection resurfaces for this year",
    },
  },
  {
    ...manualLinkNoteBase,
    id: "br-manual-20260702-003",
    family: "Lifestyle / Mobility",
    title: {
      en: "BEV camper vans draw attention before the Tokyo show",
      ja: "BEVキャンピングカー、東京ショー前に注目",
    },
  },
  {
    ...manualLinkNoteBase,
    id: "br-manual-20260702-004",
    family: "Policy / Regulatory",
    title: {
      en: "EU battery passport requirements observed as a Cardano use case",
      ja: "EU電池パスポート要件、Cardano活用事例として観測",
    },
  },
  {
    ...manualLinkNoteBase,
    id: "br-manual-20260702-005",
    family: "Crypto / DeFi",
    title: {
      en: "Cardano observes OpenUSD launch-partner context",
      ja: "Cardano、OpenUSDローンチパートナー文脈を観測",
    },
  },
  {
    ...manualLinkNoteBase,
    id: "br-manual-20260702-006",
    family: "Macro / Liquidity",
    title: {
      en: "Oil drops below $67.5 for the first time in 125 days",
      ja: "原油、125日ぶり67.5ドル割れとの観測",
    },
  },
  {
    ...manualLinkNoteBase,
    id: "br-manual-20260702-007",
    family: "Macro / Liquidity",
    title: {
      en: "US M2 money supply observed at a record high in May",
      ja: "米M2、5月に過去最高との観測",
    },
  },
  {
    ...manualLinkNoteBase,
    id: "br-manual-20260702-008",
    family: "Macro / Liquidity",
    title: {
      en: "Crowded long-dollar trade observed as a liquidity signal",
      ja: "米ドルロング取引の混雑、流動性シグナルとして観測",
    },
  },
  {
    ...manualLinkNoteBase,
    id: "br-manual-20260702-009",
    family: "Macro / Liquidity",
    title: {
      en: "Weak 10-year auction lifts rates amid fiscal and inflation concerns",
      ja: "10年債入札弱めで金利上昇、財政・インフレ懸念も",
    },
  },
  {
    ...manualLinkNoteBase,
    id: "br-manual-20260702-010",
    family: "AI / Capital",
    title: {
      en: "Itochu moves to support physical AI adoption in logistics and factories",
      ja: "伊藤忠、物流・工場向けフィジカルAI導入支援へ",
    },
  },
  {
    ...manualLinkNoteBase,
    id: "br-manual-20260702-011",
    family: "Market / Semiconductors",
    title: {
      en: "Kioxia selloff linked to US semiconductor weakness",
      ja: "キオクシア急落、米半導体株安から連想売り",
    },
  },
  {
    ...manualLinkNoteBase,
    id: "br-manual-20260702-012",
    family: "Policy / Regulatory",
    title: {
      en: "US immigration detentions rise as policy-shift risk",
      ja: "米移民拘束増、政権方針転換リスクとして観測",
    },
  },
  {
    ...manualLinkNoteBase,
    id: "br-manual-20260702-013",
    family: "Macro / Liquidity",
    title: {
      en: "Historic yen weakness raises international-coordination debate",
      ja: "歴史的円安、国際協調と戦略対応の論点に",
    },
  },
  {
    ...manualLinkNoteBase,
    id: "br-manual-20260702-014",
    family: "Macro / Liquidity",
    title: {
      en: "Finance minister references decisive measures as yen weakens",
      ja: "円安進行に財務相が「断固たる措置」言及",
    },
  },
  {
    ...manualLinkNoteBase,
    id: "br-manual-20260702-015",
    family: "Policy / Regulatory",
    title: {
      en: "US Supreme Court maintains birthright citizenship, observed from note",
      ja: "米最高裁、出生地主義を維持との観測",
    },
  },
] satisfies TerminalLiveRadarItem[];
