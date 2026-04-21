/**
 * intent-authoring — Claude Code-facing helper for creating TradeIntents.
 *
 * Spec: 08_DOCS/knowledge/specs/2026-04-20-lm-task-2-1-tradeintent-design.md
 *       §2.3 (authoring flow) / §7.3 (3-tier heuristic) / §7.4 (concurrent write)
 *
 * Not exposed via HTTP. createIntent() is invoked by Claude Code sessions to
 * persist a new Intent into tradeintents.jsonl with full validation.
 */
import fs from "fs";
import crypto from "crypto";
import {
  TradeIntentSchema,
  type TradeIntent,
  type PreferredHorizon,
  type PortfolioBucket,
  type IntentSide,
} from "./intents";

export type InvalidationTier = "hard_reject" | "soft_warning" | "pass";

const TAUTOLOGIES = [
  /if\s+wrong\s+i\s+exit/i,
  /もし間違えたら抜け/,
  /if\s+it\s+fails\s+i\s+will\s+exit/i,
];

const VAGUE_PATTERNS: RegExp[] = [
  /\b(?:if\s+(?:sentiment|conditions|momentum|the thesis|the market)\s+(?:changes|worsens|fades|weakens|turns))/i,
  /\b(?:if this no longer looks good|if it falls apart|if the story breaks)\b/i,
  /\b(?:doesn't work|not as expected|underperforms)\b/i,
  /(状況が変わっ|悪材料が出|雰囲気が悪くな|弱くなっ|伸びなけれ|だめそう|期待外れ|状況が悪化)/,
  /(うまく行かな|失敗したら|思ったように行かな|市場が悪化|ファンダが変わ)/,
];

const SPECIFICITY_PATTERNS: RegExp[] = [
  /\$[\d,]+(?:\.\d+)?[kKmM]?/,
  /¥[\d,]+/,
  /\d+(?:\.\d+)?\s*(?:%|percent|パーセント)/,
  /\b(?:20\d\d-\d\d-\d\d|20\d\d年\d+月)\b/,
  /\b(?:EOD|EOM|weekly close|daily close|epoch\s*\d+)\b/i,
  /\b(?:ETF|IPO|halving|fork|hardfork|listing|launch)\b/i,
  /\b(?:RSI|MACD|SMA|EMA|ATR|funding rate|OI)\b/i,
  /(?:>=?|<=?|超え|下回|を下に|を上に)/,
  /\b(?:on|before|after|by|until|以前|以降|まで|までに)\b/i,
];

export function evaluateInvalidation(text: string): InvalidationTier {
  const trimmed = text.trim();
  if (trimmed.length < 20) return "hard_reject";
  if (TAUTOLOGIES.some((re) => re.test(trimmed))) return "hard_reject";
  const specScore = SPECIFICITY_PATTERNS.reduce(
    (acc, re) => acc + (re.test(trimmed) ? 1 : 0),
    0,
  );
  const vagueScore = VAGUE_PATTERNS.reduce(
    (acc, re) => acc + (re.test(trimmed) ? 1 : 0),
    0,
  );
  const score = specScore - vagueScore;
  if (score >= 1) return "pass";
  return "soft_warning";
}

export function generateIntentId(): string {
  const hex = crypto.randomBytes(8).toString("hex"); // 16 hex chars, 64 bits entropy
  return `int_${hex}`;
}

export interface CreateIntentInput {
  source_signal_ids: string[];
  title: string;
  description: string;
  side: IntentSide;
  target_assets: string[];
  target_protocols?: string[];
  thesis: string;
  why_now: string;
  invalidation_thesis: string;
  thesis_conviction: number;
  execution_confidence: number;
  priority?: number;
  preferred_horizon: PreferredHorizon;
  portfolio_context: { bucket: PortfolioBucket };
  expires_at?: string;
  display: TradeIntent["display"];
}

export interface CreateIntentOptions {
  jsonlPath: string;
  knownSignalIds: Set<string>;
  allowSoftOverride?: boolean;
  overrideAuditPath?: string;
  beforeAppendHook?: () => void;
}

export interface CreateIntentResult {
  intent: TradeIntent;
  warnings: {
    invalidationTier: InvalidationTier;
    softOverride: boolean;
    concurrentWriteSuspected: boolean;
  };
}

export async function createIntent(
  input: CreateIntentInput,
  options: CreateIntentOptions,
): Promise<CreateIntentResult> {
  for (const sid of input.source_signal_ids) {
    if (!options.knownSignalIds.has(sid)) {
      throw new Error(`unknown signal id: ${sid}`);
    }
  }
  const tier = evaluateInvalidation(input.invalidation_thesis);
  if (tier === "hard_reject") {
    throw new Error(
      `invalidation_thesis rejected (hard_reject): be specific with price / deadline / indicator / observable event`,
    );
  }
  let softOverride = false;
  if (tier === "soft_warning") {
    if (!options.allowSoftOverride) {
      throw new Error(
        `invalidation_thesis soft_warning: propose a specific trigger or pass allowSoftOverride to bypass`,
      );
    }
    softOverride = true;
  }

  const now = new Date().toISOString();
  const intent_id = generateIntentId();
  if (input.expires_at && input.expires_at <= now) {
    throw new Error(`expires_at must be after created_at (now=${now})`);
  }

  const intentRaw = {
    intent_id,
    trace_id: crypto.randomUUID(),
    schema_version: "0.1-alpha" as const,
    created_at: now,
    updated_at: now,
    status: "approved" as const,
    ...(input.expires_at ? { expires_at: input.expires_at } : {}),
    source_signal_ids: input.source_signal_ids,
    title: input.title,
    description: input.description,
    side: input.side,
    target_assets: input.target_assets,
    ...(input.target_protocols
      ? { target_protocols: input.target_protocols }
      : {}),
    thesis: input.thesis,
    why_now: input.why_now,
    invalidation_thesis: input.invalidation_thesis,
    thesis_conviction: input.thesis_conviction,
    execution_confidence: input.execution_confidence,
    priority: input.priority ?? 0.5,
    preferred_horizon: input.preferred_horizon,
    portfolio_context: input.portfolio_context,
    human_review: {
      required: true as const,
      approved_by: "LiveMakers Terminal",
      approved_at: now,
    },
    display: input.display,
    visibility: "public" as const,
    authored_via: "claude_code_dialogue" as const,
  };
  const intent = TradeIntentSchema.parse(intentRaw);

  // Concurrent write detection: compare size before/after append.
  const sizeBefore = fs.existsSync(options.jsonlPath)
    ? fs.statSync(options.jsonlPath).size
    : 0;
  options.beforeAppendHook?.();
  const line = JSON.stringify(intent) + "\n";
  fs.appendFileSync(options.jsonlPath, line);
  const sizeAfter = fs.statSync(options.jsonlPath).size;
  const expectedDelta = Buffer.byteLength(line, "utf-8");
  const concurrentWriteSuspected =
    sizeAfter - sizeBefore !== expectedDelta;

  if (softOverride && options.overrideAuditPath) {
    const auditLine =
      JSON.stringify({
        intent_id: intent.intent_id,
        at: now,
        tier,
        invalidation_thesis: input.invalidation_thesis,
      }) + "\n";
    fs.appendFileSync(options.overrideAuditPath, auditLine);
  }

  return {
    intent,
    warnings: {
      invalidationTier: tier,
      softOverride,
      concurrentWriteSuspected,
    },
  };
}

// -- v0.2-α auto-proposal types (full impl in Task E1) --
/**
 * Input for `createProposedIntent()` — produced by the v0.2-α auto-proposer
 * (see lib/proposer/field-mapper.ts). Extends `CreateIntentInput` with
 * the auto-proposal–specific fields that the Task E1 function will persist.
 *
 * - `display` is required (not optional) because the proposer always fills
 *   Japanese headline/summary (EN left empty for human reviewer at approve).
 * - `expires_at` is required (computed from horizon offset at proposal time).
 * - `proposer_metadata` is required so the reject log + audit trail can
 *   trace which proposer version/cluster generated the draft.
 *
 * Schema alignment: TradeIntentSchema.proposer_metadata (lib/intents.ts) is
 * optional on the persisted intent. When a proposer authors an Intent, this
 * object is always present; when a human authors via dialogue, it is absent.
 */
export interface CreateProposedIntentInput
  extends Omit<CreateIntentInput, "display"> {
  display: TradeIntent["display"];
  expires_at: string;
  proposer_metadata: {
    version: string;
    cluster_fingerprint: string;
    generated_at: string;
  };
}
