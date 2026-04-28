/**
 * Terminal v2 Asset Contract — TypeScript zod schema.
 *
 * Spec: 08_DOCS/knowledge/specs/2026-04-27-livemakers-terminal-asset-contract-v0.md
 *
 * Mirrors the JSON shape produced by SDE `terminal_assets_builder.py`
 * (v0: builder pending; reader currently consumes a fixture). LM API routes
 * read this contract; UI layer consumes the inferred TypeScript types.
 *
 * Default `z.object()` silently strips unknown keys — this is intentional so
 * documentation-only fields like `_fixture_note` / `_dashboard_note` flow
 * through without erroring. Required-field absence and type-mismatches still
 * fail (contract test catches schema drift).
 */
import { z } from "zod";

// ── Enums ────────────────────────────────────────────────────────────
export const TerminalAsset = z.enum(["BTC", "ETH", "ADA", "NIGHT"]);
export type TerminalAssetT = z.infer<typeof TerminalAsset>;

export const Pillar = z.enum([
  "market_and_capital_flows",
  "ecosystem_health",
  "governance_and_treasury",
  "midnight_and_privacy",
  "risk_and_compliance",
  "project_research",
]);

export const SignalImpact = z.enum(["low", "medium", "high", "critical"]);
export const SignalDirection = z.enum(["positive", "negative", "neutral", "mixed"]);
export const PositionStance = z.enum([
  "long",
  "short",
  "neutral",
  "avoid",
  "accumulate",
  "reduce",
]);
export const SITIONAccount = z.enum(["SITIONjp", "SIPO_Tokyo", "LifeMakersCom"]);

const GovernanceActionType = z.enum([
  "info_action",
  "treasury_withdrawal",
  "no_confidence",
  "update_committee",
  "new_constitution",
  "hard_fork",
  "parameter_change",
]);

const GovernanceActionStatus = z.enum([
  "voting",
  "ratified",
  "expired",
  "enacted",
  "withdrawn",
]);

const SipoStanceDecision = z.enum(["yes", "no", "abstain", "pending"]);

const PriceSource = z.enum(["coingecko", "dexscreener"]);

// ── Building blocks ───────────────────────────────────────────────────
export const PositionHintSchema = z.object({
  stance: PositionStance,
  conviction: z.number().min(0).max(1),
});

export const AssetSignalRefSchema = z.object({
  id: z.string().min(1),
  headline_ja: z.string(),
  headline_en: z.string(),
  pillar: Pillar,
  confidence: z.number().min(0).max(1),
  impact: SignalImpact,
  direction: SignalDirection,
  position_hint: PositionHintSchema.nullable(),
  created_at: z.string(),
  href: z.string(),
});
export type AssetSignalRef = z.infer<typeof AssetSignalRefSchema>;

export const AssetNewsRefSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  summary: z.string(),
  source_url: z.string(),
  source_handle: z.string().nullable(),
  published_at: z.string(),
  account_tag: SITIONAccount.nullable(),
  href_internal: z.string().nullable(),
});
export type AssetNewsRef = z.infer<typeof AssetNewsRefSchema>;

export const PriceSchema = z.object({
  usd: z.number(),
  change_24h_pct: z.number(),
  market_cap_usd: z.number().nullable(), // NIGHT (DexScreener) returns null
  volume_24h_usd: z.number().nullable(), // ditto
  updated_at: z.string(),
  source: PriceSource,
});
export type Price = z.infer<typeof PriceSchema>;

// signals block: refine items.length <= total_active (per spec §5.1 + Step 3 fixture review)
const SignalsBlockSchema = z
  .object({
    total_active: z.number().int().min(0),
    items: z.array(AssetSignalRefSchema),
  })
  .superRefine((value, ctx) => {
    if (value.items.length > value.total_active) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `signals.items.length (${value.items.length}) cannot exceed total_active (${value.total_active})`,
        path: ["items"],
      });
    }
  });

const NewsBlockSchema = z.object({
  total: z.number().int().min(0),
  items: z.array(AssetNewsRefSchema),
});

// ── Governance Pulse (ADA) ───────────────────────────────────────────
const EvidenceItem = z.object({
  source_url: z.string(),
  snippet: z.string(),
});

const GovernanceTallySchema = z.object({
  drep_yes_pct: z.number(),
  drep_no_pct: z.number(),
  drep_abstain_pct: z.number(),
  spo_yes_pct: z.number().nullable(),
  cc_yes_pct: z.number().nullable(),
  snapshot_at: z.string(),
});

const SipoStanceSchema = z.object({
  decision: SipoStanceDecision,
  rationale_ja: z.string(),
  evidence: z.array(EvidenceItem),
  risk_assessment: z.string(),
  treasury_impact_ada: z.number().nullable(),
  decided_at: z.string().nullable(),
});

const GovernanceLinksSchema = z.object({
  gov_tools_url: z.string(),
  cardano_forum_url: z.string().nullable(),
  intersect_url: z.string().nullable(),
});

export const GovernanceActionSchema = z.object({
  action_id: z.string().min(1),
  action_type: GovernanceActionType,
  title_en: z.string(),
  title_ja: z.string(),
  proposer: z.string(),
  submitted_at: z.string(),
  expires_at: z.string().nullable(),
  status: GovernanceActionStatus,
  current_tally: GovernanceTallySchema,
  sipo_stance: SipoStanceSchema.nullable(),
  related_signal_ids: z.array(z.string()),
  links: GovernanceLinksSchema,
});
export type GovernanceAction = z.infer<typeof GovernanceActionSchema>;

export const DRepCardSchema = z.object({
  drep_id: z.string().min(1),
  display_name: z.string(),
  rank: z.number().int().nullable(),
  delegators: z.number().int().min(0),
  delegated_ada: z.number().min(0),
  recent_votes_count: z.number().int().min(0),
  voting_power_pct: z.number().nullable(),
  profile_url: z.string(),
  sition_profile_url: z.string(),
});
export type DRepCard = z.infer<typeof DRepCardSchema>;

export const GovernancePulseSchema = z.object({
  active_actions: z.array(GovernanceActionSchema),
  recently_resolved: z.array(GovernanceActionSchema),
  drep_card: DRepCardSchema,
  updated_at: z.string(),
});
export type GovernancePulse = z.infer<typeof GovernancePulseSchema>;

// ── Asset-specific extensions ────────────────────────────────────────
const ADADefiSchema = z.object({
  tvl_usd: z.number(),
  tvl_change_7d_pct: z.number(),
  top_protocols: z.array(
    z.object({ name: z.string(), tvl_usd: z.number() }),
  ),
  source: z.literal("defillama"),
  updated_at: z.string(),
});

const ADAEpochSchema = z.object({
  current: z.number().int(),
  progress_pct: z.number(),
  boundary_eta: z.string().nullable(),
});

const ADAStakingSchema = z.object({
  active_pct: z.number(),
  nakamoto_coefficient: z.number().int(),
});

export const ADAExtensionSchema = z.object({
  // governance optional so the Python builder can produce a snapshot with
  // ADA defi/epoch/staking populated even when the Koios fetcher pipeline
  // (governance_actions.jsonl + drep_card.json) is not yet wired.
  // UI checks `data.ada.governance` before rendering the Governance Pulse panel.
  governance: GovernancePulseSchema.nullable(),
  defi: ADADefiSchema,
  epoch: ADAEpochSchema,
  staking: ADAStakingSchema,
});
export type ADAExtension = z.infer<typeof ADAExtensionSchema>;

const NIGHTDappLaunchSchema = z.object({
  name: z.string(),
  launched_at: z.string(),
  url: z.string(),
});

export const NIGHTExtensionSchema = z.object({
  dapps: z.object({
    total_listed: z.number().int().min(0),
    recent_launches: z.array(NIGHTDappLaunchSchema),
  }),
  network: z.object({
    block_height: z.number().int().nullable(),
    last_block_at: z.string().nullable(),
  }),
  source: z.enum(["midnight_explorer", "dexscreener"]),
  updated_at: z.string(),
});
export type NIGHTExtension = z.infer<typeof NIGHTExtensionSchema>;

export const BTCExtensionSchema = z.object({
  etf: z.object({
    aum_usd: z.number(),
    weekly_flow_usd: z.number(),
    supply_pct_held: z.number(),
  }),
  source: z.literal("dune"),
  updated_at: z.string(),
});
export type BTCExtension = z.infer<typeof BTCExtensionSchema>;

export const ETHExtensionSchema = z.object({
  etf: z.object({
    aum_usd: z.number(),
    weekly_flow_usd: z.number(),
  }),
  staking_ratio_pct: z.number(),
  source: z.literal("dune"),
  updated_at: z.string(),
});
export type ETHExtension = z.infer<typeof ETHExtensionSchema>;

// ── AssetSummary (per-asset) ──────────────────────────────────────────
export const AssetSummarySchema = z.object({
  asset: TerminalAsset,
  display_name: z.string(),
  ticker_symbol: z.string(),
  price: PriceSchema.nullable(),
  signals: SignalsBlockSchema,
  news: NewsBlockSchema,
  ada: ADAExtensionSchema.optional(),
  night: NIGHTExtensionSchema.optional(),
  btc: BTCExtensionSchema.optional(),
  eth: ETHExtensionSchema.optional(),
  updated_at: z.string(),
});
export type AssetSummary = z.infer<typeof AssetSummarySchema>;

// ── Top-level snapshots ──────────────────────────────────────────────
const FreshnessSchema = z.union([
  z.number(), // v0 single value
  z.object({
    signals_sec: z.number(),
    news_sec: z.number(),
    price_sec: z.number(),
    governance_sec: z.number(),
  }), // Phase 1.1 structured form (forward-compat)
]);

export const AssetsRecordSchema = z.object({
  BTC: AssetSummarySchema,
  ETH: AssetSummarySchema,
  ADA: AssetSummarySchema,
  NIGHT: AssetSummarySchema,
});
export type AssetsRecord = z.infer<typeof AssetsRecordSchema>;

export const TerminalAssetsSnapshotSchema = z.object({
  schema_version: z.literal("0.1"),
  generated_at: z.string(),
  source_freshness_sec: FreshnessSchema,
  assets: AssetsRecordSchema,
});
export type TerminalAssetsSnapshot = z.infer<typeof TerminalAssetsSnapshotSchema>;

export const DashboardMetaSchema = z.object({
  generated_at: z.string(),
  source_freshness_sec: FreshnessSchema,
  schema_version: z.literal("0.1"),
});
export type DashboardMeta = z.infer<typeof DashboardMetaSchema>;

export const DashboardResponseSchema = z.object({
  assets: AssetsRecordSchema,
  meta: DashboardMetaSchema,
});
export type DashboardResponse = z.infer<typeof DashboardResponseSchema>;
