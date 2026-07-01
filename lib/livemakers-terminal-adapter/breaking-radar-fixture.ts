import type {
  TerminalAdapterModule,
  TerminalAdapterPacket,
  TerminalAdapterSafety,
  TerminalAdapterSource,
} from "./types";

const generatedAt = "2026-07-01T17:13:56+09:00";
const reviewedAt = "2026-07-01T17:13:56+09:00";
const asOfJst = "2026-07-01T13:55:53+09:00";

const breakingRadarSafety: TerminalAdapterSafety = {
  prohibited_couplings_checked: {
    trading_signal: true,
    order_instruction: true,
    paper_live: true,
    at_feedback: true,
    secrets: true,
  },
  public_display_safety: "needs_review",
  blocking_reason: null,
};

const sources: TerminalAdapterSource[] = [
  {
    source_id: "source.breaking_radar.xnews_fixture",
    source_name: "Breaking Radar X News fixture summary",
    source_kind: "fixture",
    source_url_or_path: null,
    source_visibility: "mock",
    source_confidence: "mock",
    generated_at: generatedAt,
    reviewed_at: reviewedAt,
    freshness_tier: "fresh",
    limitations_en: "Fixture summary only; service refresh is required before editorial wording.",
    limitations_ja: "フィクスチャ要約のみです。編集文言に使う前にサービス再確認が必要です。",
    public_display_allowed: true,
  },
  {
    source_id: "source.breaking_radar.personalized_trend_fixture",
    source_name: "Breaking Radar trend fixture summary",
    source_kind: "fixture",
    source_url_or_path: null,
    source_visibility: "mock",
    source_confidence: "mock",
    generated_at: generatedAt,
    reviewed_at: reviewedAt,
    freshness_tier: "fresh",
    limitations_en: "Sanitized trend fixture; raw personalized material is excluded from reader-facing output.",
    limitations_ja: "サニタイズ済みトレンドフィクスチャです。個別化素材の原文は読者向け出力から除外します。",
    public_display_allowed: true,
  },
  {
    source_id: "source.breaking_radar.scheduled_crosscheck",
    source_name: "Breaking Radar scheduled-session crosscheck",
    source_kind: "fixture",
    source_url_or_path: null,
    source_visibility: "mock",
    source_confidence: "mock",
    generated_at: generatedAt,
    reviewed_at: reviewedAt,
    freshness_tier: "fresh",
    limitations_en: "Fixture crosscheck only; no production data connection is attached.",
    limitations_ja: "フィクスチャ照合のみです。production data接続は付けません。",
    public_display_allowed: true,
  },
  {
    source_id: "source.breaking_radar.manual_snapshot_internal",
    source_name: "Breaking Radar manual snapshot internal fixture",
    source_kind: "fixture",
    source_url_or_path: null,
    source_visibility: "internal_path",
    source_confidence: "internal_only",
    generated_at: generatedAt,
    reviewed_at: reviewedAt,
    freshness_tier: "unknown",
    limitations_en: "Operator-only fixture provenance; screenshot context is excluded from reader-facing output.",
    limitations_ja: "operator専用フィクスチャ来歴です。スクリーンショット文脈は読者向け出力から除外します。",
    public_display_allowed: false,
  },
];

const unavailable = {
  display_label_en: "Unavailable",
  display_label_ja: "利用不可",
  reason: "not_reviewed" as const,
};

function moduleBase(
  overrides: Partial<TerminalAdapterModule>,
): TerminalAdapterModule {
  return {
    module_id: "breaking_radar.what_happened.bank_capital",
    display_surface: "what_happened",
    data_family: "macro_liquidity",
    content_kind: "editorial_interpretation",
    module_status: "degraded",
    public_display_safety: "needs_review",
    source_refs: ["source.breaking_radar.xnews_fixture"],
    generated_at: generatedAt,
    reviewed_at: reviewedAt,
    freshness_tier: "fresh",
    source_confidence: "mock",
    null_policy: "unavailable_not_zero",
    value_policy: {
      may_show_numeric_value: false,
      may_show_directional_language: false,
      may_show_advice_language: false,
    },
    unavailable,
    payload: {},
    ...overrides,
  };
}

const modules: TerminalAdapterModule[] = [
  moduleBase({
    module_id: "breaking_radar.what_happened.bank_capital",
    display_surface: "what_happened",
    data_family: "macro_liquidity",
    content_kind: "editorial_interpretation",
    source_refs: [
      "source.breaking_radar.xnews_fixture",
      "source.breaking_radar.scheduled_crosscheck",
    ],
    payload: {
      label_en: "Bank-capital commentary enters radar view",
      label_ja: "銀行資本コメントがRadar候補に入る",
      summary_en:
        "Macro-liquidity review candidate; direct source refresh is required before editorial wording.",
      summary_ja:
        "マクロ・流動性レビュー用の候補です。編集文言に使う前に直接ソース再確認が必要です。",
      source_candidate_id: "radar.candidate.fixture.breaking.001",
    },
  }),
  moduleBase({
    module_id: "breaking_radar.leading_indicators.ai_capacity",
    display_surface: "leading_indicators",
    data_family: "ai_capital_cycle",
    content_kind: "watch_item",
    source_refs: ["source.breaking_radar.personalized_trend_fixture"],
    payload: {
      label_en: "AI capacity repetition check",
      label_ja: "AI容量テーマ反復チェック",
      items: ["AI infrastructure capacity repeats across fixture notes"],
      items_ja: ["AIインフラ容量テーマがフィクスチャ内で反復"],
      source_candidate_ids: ["radar.candidate.fixture.trend.001"],
    },
  }),
  moduleBase({
    module_id: "breaking_radar.leading_indicators.protocol_status",
    display_surface: "leading_indicators",
    data_family: "crypto_onchain",
    content_kind: "watch_item",
    source_refs: ["source.breaking_radar.scheduled_crosscheck"],
    payload: {
      label_en: "Protocol wording check",
      label_ja: "プロトコル表現チェック",
      items: ["Protocol status wording needs primary-source check"],
      items_ja: ["プロトコル状態の表現は一次ソース確認が必要"],
      source_candidate_ids: ["radar.candidate.fixture.verify.001"],
    },
  }),
];

export const breakingRadarAdapterFixture: TerminalAdapterPacket = {
  schema_version: "livemakers_terminal_adapter_packet_v0.1",
  packet_id: "fixture.breaking_radar_adapter.2026_07_01.sample_g1",
  generated_at: generatedAt,
  reviewed_at: reviewedAt,
  as_of_jst: asOfJst,
  locale_ready: {
    en: true,
    ja: true,
  },
  packet_status: "degraded",
  modules,
  source_ledger: sources,
  safety: breakingRadarSafety,
};
