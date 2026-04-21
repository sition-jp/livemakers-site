/**
 * TradeIntent schema v0.1-alpha — TypeScript zod source of truth.
 *
 * Spec: 08_DOCS/knowledge/specs/2026-04-20-lm-task-2-1-tradeintent-design.md §5
 * Parent: 08_DOCS/knowledge/specs/2026-04-13-signal-tradeintent-executionpolicy-spec.md §4
 *
 * v0.1-alpha allows breaking changes (Phase 1 flexible period per parent spec §5.1).
 * Backward-compatible additions only from v0.1-beta; locked at v1.0-stable.
 *
 * Schema invariants not enforced by zod (intents-reader.ts / intent-authoring.ts):
 * - updated_at >= created_at
 * - human_review.approved_at >= created_at
 * - expires_at > created_at when present
 * - source_signal_ids each resolves in signals.jsonl
 * - append-only jsonl, latest-row-wins per intent_id
 */
import { z } from "zod";

export const IntentStatus = z.enum([
  "proposed",
  "approved",
  "active",
  "paused",
  "cancelled",
  "completed",
  "expired",
  "archived",
]);

export const IntentSide = z.enum([
  "accumulate",
  "reduce",
  "enter_long",
  "enter_short",
  "hold",
  "avoid",
  "rotate",
]);

export const PreferredHorizon = z.enum([
  "intraday",
  "swing",
  "position",
  "multi-week",
]);

export const PortfolioBucket = z.enum([
  "core",
  "tactical",
  "experimental",
  "hedge",
]);

export const Visibility = z.enum(["public", "subscribers_only", "private"]);

export const RealizedOutcome = z.enum([
  "thesis_confirmed",
  "thesis_invalidated",
  "partial",
  "unclear",
]);

export const ProposerMetadataSchema = z.object({
  version: z.string(),
  cluster_fingerprint: z.string(),
  generated_at: z.string().datetime(),
});

export const TradeIntentSchema = z.object({
  intent_id: z.string().regex(/^int_(proposed_)?[a-z0-9]{16}$/),
  trace_id: z.string().uuid(),
  schema_version: z.literal("0.1-alpha"),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  status: IntentStatus,
  expires_at: z.string().datetime().optional(),

  source_signal_ids: z.array(z.string()).min(1),

  title: z.string().min(1).max(120),
  description: z.string().min(1).max(500),
  side: IntentSide,
  target_assets: z.array(z.string()).min(1),
  target_protocols: z.array(z.string()).optional(),

  thesis: z.string().min(20).max(1000),
  why_now: z.string().min(20).max(500),
  invalidation_thesis: z.string().min(20).max(500),

  thesis_conviction: z.number().min(0).max(1),
  execution_confidence: z.number().min(0).max(1),
  priority: z.number().min(0).max(1),

  preferred_horizon: PreferredHorizon,

  portfolio_context: z.object({
    bucket: PortfolioBucket,
  }),

  human_review: z.object({
    required: z.literal(true),
    approved_by: z.string().optional(),
    approved_at: z.string().datetime().optional(),
  }),

  display: z.object({
    headline_en: z.string().max(80),
    headline_ja: z.string().min(1).max(80),
    summary_en: z.string().max(240),
    summary_ja: z.string().min(20).max(240),
  }),

  outcome: z
    .object({
      realized_outcome: RealizedOutcome.optional(),
      outcome_notes: z.string().optional(),
      outcome_recorded_at: z.string().datetime().optional(),
    })
    .optional(),

  visibility: Visibility.default("public"),

  // authoring provenance: 3-role separation planned.
  //   authored_via (channel) — v0.1 固定 "claude_code_dialogue"
  //   authored_by  (identity) — RESERVED for v0.2+
  //   approved_by  (publisher) — lives under human_review.approved_by
  authored_via: z
    .enum(["claude_code_dialogue", "sde_auto_proposal"])
    .default("claude_code_dialogue"),

  proposer_metadata: ProposerMetadataSchema.optional(),
});

export type TradeIntent = z.infer<typeof TradeIntentSchema>;

// Inferred types for each enum schema above. Enables downstream modules to
// import `type IntentSide` etc. without re-deriving via z.infer.
export type IntentStatus = z.infer<typeof IntentStatus>;
export type IntentSide = z.infer<typeof IntentSide>;
export type PreferredHorizon = z.infer<typeof PreferredHorizon>;
export type PortfolioBucket = z.infer<typeof PortfolioBucket>;
export type Visibility = z.infer<typeof Visibility>;
export type RealizedOutcome = z.infer<typeof RealizedOutcome>;
export type ProposerMetadata = z.infer<typeof ProposerMetadataSchema>;
