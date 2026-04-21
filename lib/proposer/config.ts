// lib/proposer/config.ts
export const PROPOSER_CONFIG = {
  // Cluster 条件
  min_cluster_size: 2,
  min_avg_confidence: 0.60,
  time_window_hours: 72,

  // 対象 asset
  supported_assets: ["BTC", "ETH", "ADA", "NIGHT"] as const,

  // 除外 direction (Finding 4)
  excluded_cluster_directions: ["mixed"] as const,

  // Propose 数制限
  max_proposals_per_night: 3,

  // 重複検知
  dedupe_signal_overlap_jaccard: 0.5,
  dedupe_reject_lookback_hours: 72,

  // Invalidation threshold by horizon
  threshold_pct: {
    intraday: 0.03,
    swing: 0.08,
    position: 0.12,
    "multi-week": 0.18,
  } as const,

  // Expires_at offset by horizon (days)
  expires_offset_days: {
    intraday: 1,
    swing: 7,
    position: 28,
    "multi-week": 56,
  } as const,

  // 採用品質 default
  execution_confidence_default: 0.4,
  priority_default: 0.5,

  // Expire
  expire_after_hours: 24,

  // Impact weight (for cluster ranking)
  impact_weight: {
    critical: 1.0,
    high: 0.8,
    medium: 0.5,
    low: 0.3,
  } as const,

  // Proposer version
  version: "v0.2-alpha-rule" as const,
} as const;

export type ProposerConfig = typeof PROPOSER_CONFIG;
