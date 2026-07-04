import { breakingRadarAdapterFixture } from "./breaking-radar-fixture";
import type {
  TerminalAdapterModule,
  TerminalAdapterPacket,
  TerminalAdapterSource,
} from "./types";

const generatedAt = "2026-07-01T21:30:00+09:00";
const reviewedAt = "2026-07-01T21:30:00+09:00";

const onchainSource: TerminalAdapterSource = {
  source_id: "source.reader_terminal.onchain_fixture",
  source_name: "Reader Terminal on-chain fixture state",
  source_kind: "fixture",
  source_url_or_path: null,
  source_visibility: "mock",
  source_confidence: "mock",
  generated_at: generatedAt,
  reviewed_at: reviewedAt,
  freshness_tier: "fresh",
  limitations_en:
    "Fixture current-state marker only; adapter lineage and freshness are required before public current values.",
  limitations_ja:
    "フィクスチャの現在状態マーカーのみです。公開値にする前にadapter来歴と鮮度確認が必要です。",
  public_display_allowed: true,
};

const onchainLiveDataModule: TerminalAdapterModule = {
  module_id: "reader_terminal.live_data_strip.onchain_state",
  display_surface: "live_data_strip",
  data_family: "crypto_onchain",
  content_kind: "raw_data",
  module_status: "degraded",
  public_display_safety: "needs_review",
  source_refs: [onchainSource.source_id],
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
    reason: "not_reviewed",
  },
  payload: {
    label_en: "On-chain",
    label_ja: "オンチェーン",
    value_display: "review",
    note_en:
      "Current-state fixture only; values stay unavailable until adapter lineage is reviewed.",
    note_ja:
      "現在状態のフィクスチャのみです。adapter来歴確認まで数値は利用不可です。",
  },
};

export const readerTerminalPublicAdapterFixture: TerminalAdapterPacket = {
  ...breakingRadarAdapterFixture,
  packet_id: "fixture.reader_terminal_public_topology.2026_07_01.g31",
  generated_at: generatedAt,
  reviewed_at: reviewedAt,
  packet_status: "degraded",
  modules: [onchainLiveDataModule, ...breakingRadarAdapterFixture.modules],
  source_ledger: [onchainSource, ...breakingRadarAdapterFixture.source_ledger],
};
