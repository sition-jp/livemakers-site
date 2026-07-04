import type {
  TerminalAdapterModule,
  TerminalAdapterPacket,
  TerminalAdapterSafety,
  TerminalAdapterSource,
} from "./types";

const generatedAt = "2026-06-30T21:36:32+09:00";
const reviewedAt = "2026-06-30T21:40:00+09:00";

const safeSafety: TerminalAdapterSafety = {
  prohibited_couplings_checked: {
    trading_signal: true,
    order_instruction: true,
    paper_live: true,
    at_feedback: true,
    secrets: true,
  },
  public_display_safety: "approved",
  blocking_reason: null,
};

const fixtureSource: TerminalAdapterSource = {
  source_id: "fixture.market_state",
  source_name: "Synthetic terminal adapter fixture",
  source_kind: "fixture",
  source_url_or_path: null,
  source_visibility: "mock",
  source_confidence: "mock",
  generated_at: generatedAt,
  reviewed_at: reviewedAt,
  freshness_tier: "fresh",
  limitations_en: "Synthetic fixture for schema validation only.",
  limitations_ja: "スキーマ検証専用の合成フィクスチャです。",
  public_display_allowed: true,
};

function moduleBase(
  overrides: Partial<TerminalAdapterModule>,
): TerminalAdapterModule {
  return {
    module_id: "market_state_header",
    display_surface: "market_state_header",
    data_family: "editorial",
    content_kind: "editorial_interpretation",
    module_status: "ready",
    public_display_safety: "approved",
    source_refs: [fixtureSource.source_id],
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
    unavailable: {
      display_label_en: "Unavailable",
      display_label_ja: "利用不可",
      reason: "missing_source",
    },
    payload: {
      label_en: "Market State",
      label_ja: "マーケット状態",
      summary_en: "Synthetic market state for adapter contract validation.",
      summary_ja: "adapter契約検証用の合成マーケット状態です。",
    },
    ...overrides,
  };
}

function packetBase(
  overrides: Partial<TerminalAdapterPacket>,
): TerminalAdapterPacket {
  return {
    schema_version: "livemakers_terminal_adapter_packet_v0.1",
    packet_id: "fixture.ready",
    generated_at: generatedAt,
    reviewed_at: reviewedAt,
    as_of_jst: generatedAt,
    locale_ready: {
      en: true,
      ja: true,
    },
    packet_status: "ready",
    modules: [moduleBase({})],
    source_ledger: [fixtureSource],
    safety: safeSafety,
    ...overrides,
  };
}

export const readyTerminalAdapterFixture: TerminalAdapterPacket = packetBase({});

export const degradedTerminalAdapterFixture: TerminalAdapterPacket = packetBase({
  packet_id: "fixture.degraded",
  packet_status: "degraded",
  modules: [
    moduleBase({
      module_id: "live_data_strip.market",
      display_surface: "live_data_strip",
      data_family: "market",
      content_kind: "raw_data",
      module_status: "degraded",
      freshness_tier: "stale",
      payload: {
        label_en: "Market indicators",
        label_ja: "市場指標",
        status_en: "Stale fixture",
        status_ja: "古いフィクスチャ",
      },
    }),
  ],
});

export const unavailableTerminalAdapterFixture: TerminalAdapterPacket = packetBase({
  packet_id: "fixture.unavailable",
  packet_status: "unavailable",
  modules: [
    moduleBase({
      module_id: "live_data_strip.market",
      display_surface: "live_data_strip",
      data_family: "market",
      content_kind: "raw_data",
      module_status: "unavailable",
      freshness_tier: "unavailable",
      public_display_safety: "needs_review",
      reviewed_at: null,
      value_policy: {
        may_show_numeric_value: false,
        may_show_directional_language: false,
        may_show_advice_language: false,
      },
      unavailable: {
        display_label_en: "Unavailable",
        display_label_ja: "利用不可",
        reason: "missing_source",
      },
      payload: {
        label_en: "Market indicators",
        label_ja: "市場指標",
        status_en: "Unavailable",
        status_ja: "利用不可",
      },
    }),
  ],
});

export const blockedTerminalAdapterFixture: TerminalAdapterPacket = packetBase({
  packet_id: "fixture.blocked",
  packet_status: "blocked",
  modules: [
    moduleBase({
      module_id: "boundary_note",
      display_surface: "boundary_note",
      content_kind: "editorial_interpretation",
      module_status: "blocked",
      public_display_safety: "blocked",
      freshness_tier: "unknown",
      source_confidence: "internal_only",
      payload: {},
      unavailable: {
        display_label_en: "Blocked",
        display_label_ja: "ブロック",
        reason: "safety_block",
      },
    }),
  ],
  safety: {
    ...safeSafety,
    public_display_safety: "blocked",
    blocking_reason: "Synthetic blocked packet fixture.",
  },
});
