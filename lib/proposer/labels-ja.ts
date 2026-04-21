// lib/proposer/labels-ja.ts
import type {
  IntentSide,
  PreferredHorizon,
  PortfolioBucket,
} from "@/lib/intents";
import type { RejectReason } from "@/lib/intents-reject";

export const SIDE_JA: Record<IntentSide, string> = {
  accumulate: "買い増し",
  reduce: "縮小",
  enter_long: "新規ロング",
  enter_short: "新規ショート",
  hold: "保有継続",
  avoid: "回避",
  rotate: "ローテーション",
};

export const HORIZON_JA: Record<PreferredHorizon, string> = {
  intraday: "当日",
  swing: "スイング (数日)",
  position: "中期 (2-4週)",
  "multi-week": "長期 (1ヶ月以上)",
};

export const BUCKET_JA: Record<PortfolioBucket, string> = {
  core: "core (中核)",
  tactical: "tactical (機動)",
  experimental: "experimental (実験)",
  hedge: "hedge (ヘッジ)",
};

export const REJECT_REASON_JA: Record<RejectReason, string> = {
  weak_invalidation: "無効化条件が曖昧",
  low_conviction: "cluster 全体が弱い",
  duplicate_of_approved: "既存 Intent と重複",
  wrong_direction: "方向性 / side が違う",
  stale_signals: "ネタが古い",
  out_of_scope: "アカウントスコープ違い",
  thesis_disagree: "仮説そのものに不同意",
  other: "その他",
};

// Signal type → 無効化条件テンプレ用の短い日本語 outcome
export const SIGNAL_TYPE_OUTCOME_JA: Record<string, string> = {
  governance_shift: "提案可決 / 委任量拡大",
  defi_momentum: "TVL 継続増",
  risk_escalation: "リスクイベント発生",
  risk_deescalation: "リスク要因解消",
  midnight_milestone: "マイルストーン達成",
  market_regime_change: "regime 遷移",
  catalyst_event: "カタリスト実現",
  network_health: "ネットワーク健全性改善",
  cross_chain_impact: "他チェーン波及効果",
  ai_economy_signal: "AI エージェント経済シグナル実現",
};

// Signal type → 日本語 (Review UI / thesis テンプレ用)
export const SIGNAL_TYPE_JA: Record<string, string> = {
  governance_shift: "ガバナンス変化",
  defi_momentum: "DeFi 動向",
  risk_escalation: "リスク上昇",
  risk_deescalation: "リスク低下",
  midnight_milestone: "Midnight 進捗",
  market_regime_change: "市場 regime 変化",
  catalyst_event: "カタリストイベント",
  network_health: "ネットワーク健全性",
  cross_chain_impact: "クロスチェーン波及",
  ai_economy_signal: "AI 経済シグナル",
};
