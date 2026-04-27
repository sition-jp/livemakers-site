/**
 * Signal schema v1.3-beta — TypeScript mirror of SDE `signals/schema.py`.
 *
 * Parent spec:   08_DOCS/knowledge/specs/2026-04-13-signal-tradeintent-executionpolicy-spec.md
 * Design spec:   08_DOCS/knowledge/specs/2026-04-18-signal-generator-v0.1-design.md
 * Terminal spec: 08_DOCS/knowledge/specs/2026-04-27-livemakers-terminal-asset-contract-v0.md
 * Python source of truth: DEV/sition-intelligence-terminal/signals/schema.py
 *
 * v1.3-beta changes (2026-04-27):
 * - Added `target_terminal: TerminalAsset[] | null` — Terminal display gate.
 *   INDEPENDENT from `article_candidate_accounts` (publish gate). target_terminal
 *   controls which 4-asset Terminal pages (BTC/ETH/ADA/NIGHT) surface this
 *   signal. Spec §3.
 * - SchemaVersion enum extended with "1.3-beta" (v1.1/v1.2 rows still load).
 *
 * v1.2-beta changes (2026-04-22):
 * - Added `article_candidate_accounts: ArticleCandidateAccount[] | null`
 *
 * v1.1-beta changes (2026-04-18):
 * - Renamed `dedupe_key` → `event_key`
 * - Added `audit_note: string | null`
 * - Added `locked_fields: Record<string, string> | null`
 *
 * Reader contract: this reader MUST respect `locked_fields` when materializing
 * Signals; downstream consumers that ignore locks will silently drop manual overrides.
 *
 * When modifying this schema, update both sides and bump `SchemaVersion` in lockstep.
 */
import { z } from "zod";

export const SchemaVersion = z.enum(["1.1-beta", "1.2-beta", "1.3-beta"]);

export const ArticleCandidateAccount = z.enum([
  "SITIONjp",
  "SIPO_Tokyo",
  "LifeMakersCom",
]);

// v1.3-beta: Terminal display gate (independent from article_candidate_accounts)
export const TerminalAssetEnum = z.enum(["BTC", "ETH", "ADA", "NIGHT"]);

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
    target_terminal: z.array(TerminalAssetEnum).nullable().optional(),
  })
  .strict()
  .superRefine((sig, ctx) => {
    // v1.3-beta target_terminal invariants — mirror of Python validator.
    const targets = sig.target_terminal;
    if (targets == null) return;

    // Length 1-4
    if (targets.length < 1 || targets.length > 4) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `target_terminal must have 1-4 entries, got ${targets.length}`,
        path: ["target_terminal"],
      });
    }
    // No duplicates
    if (new Set(targets).size !== targets.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `target_terminal must be unique, got ${JSON.stringify(targets)}`,
        path: ["target_terminal"],
      });
    }
    // Requires locked_fields entry (rule-外からの書込み禁止)
    const locks = sig.locked_fields;
    if (!locks || !("target_terminal" in locks)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "target_terminal set without locked_fields entry (rule-外からの書込みは禁止)",
        path: ["target_terminal"],
      });
    }
  });

export type Evidence = z.infer<typeof EvidenceSchema>;
export type HistoricalCase = z.infer<typeof HistoricalCaseSchema>;
export type PositionHint = z.infer<typeof PositionHintSchema>;
export type SIPOAction = z.infer<typeof SIPOActionSchema>;
export type Signal = z.infer<typeof SignalSchema>;
