/**
 * field-mapper — Cluster → CreateProposedIntentInput.
 *
 * Spec: 08_DOCS/knowledge/specs/2026-04-20-lm-task-2-2-auto-intent-proposer-design.md
 *       §4.2 (field mapping) / §4.3 (SIDE_MAP / BUCKET_MAP)
 *
 * Final Phase D module. Integrates every Phase A-D module to emit a complete
 * `CreateProposedIntentInput` from a `Cluster`. Task F1 (propose-intents CLI)
 * owns the pipeline: Cluster → buildDraftInput() → createProposedIntent() (E1).
 *
 * Horizon translation (Phase C discovery):
 *   Signal.time_horizon  (hours | days | 1-2 weeks | 2-4 weeks | months)
 *   → Intent.preferred_horizon  (intraday | swing | position | multi-week)
 */
import type { Cluster } from "@/lib/proposer/cluster-detect";
import type {
  IntentSide,
  PreferredHorizon,
  PortfolioBucket,
} from "@/lib/intents";
import type { CreateProposedIntentInput } from "@/lib/intent-authoring";
import type { Signal } from "@/lib/signals";
import { PROPOSER_CONFIG } from "@/lib/proposer/config";
import { SIGNAL_TYPE_OUTCOME_JA } from "@/lib/proposer/labels-ja";
import { buildInvalidation } from "@/lib/proposer/template-invalidation";
import {
  buildTitle,
  buildThesis,
  buildWhyNow,
  buildDescription,
  buildDisplayHeadline,
  buildDisplaySummary,
} from "@/lib/proposer/template-text";

/**
 * Signal.time_horizon (hours / days / 1-2 weeks / 2-4 weeks / months)
 *   → Intent.preferred_horizon (intraday / swing / position / multi-week).
 */
const HORIZON_MAP: Record<Signal["time_horizon"], PreferredHorizon> = {
  hours: "intraday",
  days: "swing",
  "1-2 weeks": "swing",
  "2-4 weeks": "position",
  months: "multi-week",
};

/**
 * Composite direction + stance → IntentSide. Fallback: "hold".
 *
 * Note: Signal.PositionStance is {long, short, neutral, avoid, accumulate,
 * reduce}. Keys like "positive+hold" / "positive+long" are kept for spec
 * parity; in practice only the PositionStance-compatible keys will fire.
 */
const SIDE_MAP: Record<string, IntentSide> = {
  "positive+accumulate": "accumulate",
  "positive+long": "enter_long",
  "positive+hold": "hold",
  "negative+reduce": "reduce",
  "negative+short": "enter_short",
  "negative+avoid": "avoid",
  "neutral+rotate": "rotate",
};

/**
 * Pillar → PortfolioBucket. Fallback: "tactical".
 */
const BUCKET_MAP: Record<string, PortfolioBucket> = {
  governance_and_treasury: "core",
  market_and_capital_flows: "tactical",
  ecosystem_health: "tactical",
  risk_and_compliance: "tactical",
  midnight_and_privacy: "experimental",
  project_research: "experimental",
};

function deriveSide(cluster: Cluster): IntentSide {
  const stances: string[] = [];
  for (const s of cluster.signals) {
    const stance = s.position_hint?.stance;
    if (stance !== undefined) stances.push(stance);
  }
  if (stances.length === 0) return "hold";
  const dominant = modeString(stances);
  if (dominant === undefined) return "hold";
  const key = `${cluster.direction}+${dominant}`;
  return SIDE_MAP[key] ?? "hold";
}

function deriveBucket(cluster: Cluster): PortfolioBucket {
  const pillar = cluster.signals[0]?.pillar ?? "unknown";
  return BUCKET_MAP[pillar] ?? "tactical";
}

function modeString<T extends string>(xs: T[]): T | undefined {
  if (xs.length === 0) return undefined;
  const counts: Record<string, number> = {};
  for (const x of xs) counts[x] = (counts[x] ?? 0) + 1;
  // Sorted descending by count. Ties resolve by insertion order (V8 stable sort).
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return top[0] as T;
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

function addDaysIso(isoDate: string, days: number): string {
  const d = new Date(Date.parse(isoDate));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

export interface BuildDraftCtx {
  /** Map of asset ticker → current price (USD). Missing → placeholder invalidation. */
  currentPrices: Record<string, number>;
  /** Proposal-time ISO timestamp (also used for `proposer_metadata.generated_at`). */
  nowIso: string;
}

/**
 * Build a complete `CreateProposedIntentInput` from a Cluster + market context.
 *
 * Wiring overview:
 *  - `side` = SIDE_MAP[direction + majority(position_hint.stance)]; fallback "hold"
 *  - `portfolio_context.bucket` = BUCKET_MAP[pillar(first signal)]; fallback "tactical"
 *  - `preferred_horizon` = HORIZON_MAP[mode(time_horizon across cluster)]
 *  - `thesis_conviction` = round2(avg(confidence)*0.7 + avg(position_hint.conviction)*0.3)
 *  - `execution_confidence` = config.execution_confidence_default (0.40)
 *  - `priority` = config.priority_default (0.50)
 *  - `expires_at` = nowIso + config.expires_offset_days[horizon]
 *  - `invalidation_thesis` = buildInvalidation(D1) with market price injection
 *  - text fields (title/thesis/why_now/description/display) delegate to D2 templates
 *  - `display.headline_en` / `summary_en` = "" (filled at approve time — Finding 5)
 *  - `proposer_metadata` = version / cluster.fingerprint / nowIso
 *
 * Spec §4.2 / §4.3. Task 2-2 v0.2-alpha (final Phase D task).
 */
export function buildDraftInput(
  cluster: Cluster,
  ctx: BuildDraftCtx,
): CreateProposedIntentInput {
  const side = deriveSide(cluster);
  const bucket = deriveBucket(cluster);

  // preferred_horizon: mode of cluster's Signal time_horizons → Intent horizon
  const signalHorizons = cluster.signals.map((s) => s.time_horizon);
  const modeHorizon = modeString(signalHorizons) ?? "2-4 weeks";
  const horizon: PreferredHorizon = HORIZON_MAP[modeHorizon] ?? "position";

  // thesis_conviction: weighted average of confidence + position_hint.conviction
  const avgConf =
    cluster.signals.reduce((acc, s) => acc + s.confidence, 0) /
    cluster.signals.length;
  const avgConv =
    cluster.signals.reduce(
      (acc, s) => acc + (s.position_hint?.conviction ?? 0.5),
      0,
    ) / cluster.signals.length;
  const thesisConv = round2(avgConf * 0.7 + avgConv * 0.3);

  // expires_at: nowIso + horizon offset days
  const offset = PROPOSER_CONFIG.expires_offset_days[horizon];
  const expiresAt = addDaysIso(ctx.nowIso, offset);

  // invalidation_thesis: D1 template (market price injection or placeholder)
  const topSignal = cluster.signals[0];
  const firstType = topSignal?.type ?? "";
  const outcomeSummary = SIGNAL_TYPE_OUTCOME_JA[firstType] ?? firstType;
  const invalidation = buildInvalidation({
    primaryAsset: cluster.primary_asset,
    direction: cluster.direction,
    horizon,
    outcomeSummary,
    currentPrice: ctx.currentPrices[cluster.primary_asset],
    expiresAt,
  });

  // target_assets: union of primary_asset + related_assets across cluster
  const targetAssets = Array.from(
    new Set(
      cluster.signals.flatMap((s) => [
        s.primary_asset,
        ...(s.related_assets ?? []),
      ]),
    ),
  ).filter((a): a is string => typeof a === "string" && a.length > 0);

  // target_protocols: union across cluster (optional field)
  const targetProtocols = Array.from(
    new Set(cluster.signals.flatMap((s) => s.related_protocols ?? [])),
  );

  return {
    source_signal_ids: cluster.signals.map((s) => s.id),
    title: buildTitle({
      side,
      primaryAsset: cluster.primary_asset,
      topSignal,
      lang: "ja",
    }),
    description: buildDescription({ signals: cluster.signals, lang: "ja" }),
    side,
    target_assets: targetAssets,
    ...(targetProtocols.length > 0
      ? { target_protocols: targetProtocols }
      : {}),
    thesis: buildThesis({
      signals: cluster.signals,
      primaryAsset: cluster.primary_asset,
      side,
      horizon,
      direction: cluster.direction,
      lang: "ja",
    }),
    why_now: buildWhyNow({ signals: cluster.signals, lang: "ja" }),
    invalidation_thesis: invalidation.text,
    thesis_conviction: thesisConv,
    execution_confidence: PROPOSER_CONFIG.execution_confidence_default,
    priority: PROPOSER_CONFIG.priority_default,
    preferred_horizon: horizon,
    portfolio_context: { bucket },
    expires_at: expiresAt,
    display: {
      // Finding 5: EN headline/summary stay empty at proposal time;
      // human reviewer supplies them during approve.
      headline_en: "",
      headline_ja: buildDisplayHeadline({ topSignal, lang: "ja" }),
      summary_en: "",
      summary_ja: buildDisplaySummary({ signals: cluster.signals, lang: "ja" }),
    },
    proposer_metadata: {
      version: PROPOSER_CONFIG.version,
      cluster_fingerprint: cluster.fingerprint,
      generated_at: ctx.nowIso,
    },
  };
}
