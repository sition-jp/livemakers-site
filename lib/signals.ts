/**
 * Signal schema v1.1-beta — TypeScript mirror of SDE `signals/schema.py`.
 *
 * Parent spec:  08_DOCS/knowledge/specs/2026-04-13-signal-tradeintent-executionpolicy-spec.md
 * Design spec:  08_DOCS/knowledge/specs/2026-04-18-signal-generator-v0.1-design.md
 * Python source of truth: DEV/sition-intelligence-terminal/signals/schema.py
 *
 * v1.1-beta changes (2026-04-18):
 * - Renamed `dedupe_key` → `event_key` (same semantics: date-independent event identity)
 * - Added `audit_note: string | null`
 * - Added `locked_fields: Record<string, string> | null` (manual override protection)
 *
 * Reader contract: this reader MUST respect `locked_fields` when materializing
 * Signals; downstream consumers that ignore locks will silently drop manual overrides.
 *
 * When modifying this schema, update both sides and bump `SchemaVersion` in lockstep.
 */
import { z } from "zod";

export const SchemaVersion = z.enum(["1.1-beta", "1.2-beta"]);

export const ArticleCandidateAccount = z.enum([
  "SITIONjp",
  "SIPO_Tokyo",
  "LifeMakersCom",
]);

export const SignalStatus = z.enum([
  "active",
  "expired",
  "invalidated",
  "superseded",
]);

export const SignalImpact = z.enum(["low", "medium", "high", "critical"]);

export const SignalDirection = z.enum([
  "positive",
  "negative",
  "neutral",
  "mixed",
]);

export const TimeHorizon = z.enum([
  "hours",
  "days",
  "1-2 weeks",
  "2-4 weeks",
  "months",
]);

export const Pillar = z.enum([
  "market_and_capital_flows",
  "ecosystem_health",
  "governance_and_treasury",
  "midnight_and_privacy",
  "risk_and_compliance",
  "project_research",
]);

export const PositionStance = z.enum([
  "long",
  "short",
  "neutral",
  "avoid",
  "accumulate",
  "reduce",
]);

export const SIPOActionType = z.enum([
  "vote",
  "stake_change",
  "publish",
  "monitor",
  "none",
]);

export const EvidenceSchema = z
  .object({
    source_url: z.string(),
    source_type: z.string(),
    timestamp: z.string(),
    snippet: z.string(),
    weight: z.number().min(0).max(1).default(1.0),
  })
  .strict();

export const HistoricalCaseSchema = z
  .object({
    case_id: z.string(),
    similarity_score: z.number().min(0).max(1),
    description: z.string(),
    outcome: z.string().nullable().optional(),
  })
  .strict();

export const PositionHintSchema = z
  .object({
    stance: PositionStance,
    conviction: z.number().min(0).max(1),
  })
  .strict();

export const SIPOActionSchema = z
  .object({
    action_type: SIPOActionType,
    detail: z.string(),
    rationale: z.string(),
  })
  .strict();

export const SignalSchema = z
  .object({
    id: z.string(),
    trace_id: z.string(),
    root_trace_id: z.string(),
    schema_version: SchemaVersion,
    created_at: z.string(),
    updated_at: z.string().optional(),
    type: z.string(),
    subtype: z.string(),
    pillar: Pillar,
    status: SignalStatus,
    expires_at: z.string().optional(),
    supersedes_signal_id: z.string().optional(),
    conflict_group: z.string().optional(),
    idempotency_key: z.string(),
    event_key: z.string().optional(),
    confidence: z.number().min(0).max(1),
    impact: SignalImpact,
    urgency: z.number().min(0).max(1),
    time_horizon: TimeHorizon,
    direction: SignalDirection,
    position_hint: PositionHintSchema.optional(),
    evidence: z.array(EvidenceSchema),
    similar_cases: z.array(HistoricalCaseSchema),
    related_assets: z.array(z.string()),
    related_protocols: z.array(z.string()),
    primary_asset: z.string().optional(),
    tradable: z.boolean(),
    sipo_action: SIPOActionSchema.optional(),
    headline_en: z.string(),
    headline_ja: z.string(),
    summary_en: z.string(),
    summary_ja: z.string(),
    source_ids: z.array(z.string()),
    audit_note: z.string().nullable().optional(),
    locked_fields: z.record(z.string(), z.string()).nullable().optional(),
    article_candidate_accounts: z
      .array(ArticleCandidateAccount)
      .nullable()
      .optional(),
  })
  .strict();

export type Evidence = z.infer<typeof EvidenceSchema>;
export type HistoricalCase = z.infer<typeof HistoricalCaseSchema>;
export type PositionHint = z.infer<typeof PositionHintSchema>;
export type SIPOAction = z.infer<typeof SIPOActionSchema>;
export type Signal = z.infer<typeof SignalSchema>;
