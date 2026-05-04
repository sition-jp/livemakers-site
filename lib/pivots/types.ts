/**
 * LiveMakersCom AI Turning Point Detector — shared zod schemas.
 *
 * Spec: docs/ai_turning_point_detector_prd.md (PRD §12, §15-17, §19, §21)
 *
 * Source of truth for both:
 *   - the materialised mock JSON files (data/pivot_*.live.json)
 *   - the API response shapes served by /api/pivot-radar,
 *     /api/pivot-scores, /api/backtests
 *
 * Phase 1 keeps this strict so a future Phase 2 SDE producer (Python) can
 * write the same JSON shape and the Next.js consumer needs no changes.
 */
import { z } from "zod";

export const AssetSymbolSchema = z.enum(["BTC", "ETH"]);
export type AssetSymbol = z.infer<typeof AssetSymbolSchema>;

export const HorizonSchema = z.enum(["7D", "30D", "90D"]);
export type Horizon = z.infer<typeof HorizonSchema>;

export const ScoreTypeSchema = z.enum([
  "overall",
  "price_pivot",
  "volatility_pivot",
]);
export type ScoreType = z.infer<typeof ScoreTypeSchema>;

export const ConfidenceGradeSchema = z.enum(["A", "B+", "B", "C"]);
export type ConfidenceGrade = z.infer<typeof ConfidenceGradeSchema>;

export const ScoreLevelSchema = z.enum(["Low", "Medium", "High", "Extreme"]);
export type ScoreLevel = z.infer<typeof ScoreLevelSchema>;

export const EvidenceCategorySchema = z.enum([
  "price",
  "volatility",
  "volume",
  "oi",
  "funding",
  "confidence",
]);
export type EvidenceCategory = z.infer<typeof EvidenceCategorySchema>;

const Score0to100 = z.number().min(0).max(100);

export const RadarScoresSchema = z.object({
  overall: Score0to100,
  price_pivot: Score0to100,
  volatility_pivot: Score0to100,
  confidence_grade: ConfidenceGradeSchema,
  main_signal: z.enum(["price", "volatility", "mixed"]),
});
export type RadarScores = z.infer<typeof RadarScoresSchema>;

export const RadarAssetSchema = z.object({
  symbol: AssetSymbolSchema,
  scores: z.object({
    "7D": RadarScoresSchema,
    "30D": RadarScoresSchema,
    "90D": RadarScoresSchema,
  }),
});
export type RadarAsset = z.infer<typeof RadarAssetSchema>;

export const EvidenceItemSchema = z.object({
  category: EvidenceCategorySchema,
  direction: z.string(), // "bullish" | "bearish" | "neutral" | "volatility" — kept open for v0.2
  weight: z.number().min(0).max(1),
  message: z.string().min(1),
  raw_value: z.number().optional(),
});
export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;

/**
 * Direction bias must sum to 100 at the materialized JSON boundary so the
 * UI bar and the dl percentages tell the same story. Tolerance ±0.5 covers
 * decimal noise from the producer (rounding to integers gives ±0.5 at most
 * across three buckets); anything further is malformed.
 */
const DIRECTION_BIAS_TOLERANCE = 0.5;
export const DirectionBiasSchema = z
  .object({
    bullish: Score0to100,
    bearish: Score0to100,
    neutral: Score0to100,
  })
  .superRefine((val, ctx) => {
    const sum = val.bullish + val.bearish + val.neutral;
    if (Math.abs(sum - 100) > DIRECTION_BIAS_TOLERANCE) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `direction_bias must sum to 100 (±${DIRECTION_BIAS_TOLERANCE}); got ${sum}`,
      });
    }
  });
export type DirectionBias = z.infer<typeof DirectionBiasSchema>;

export const ConfidenceBlockSchema = z.object({
  grade: ConfidenceGradeSchema,
  score: Score0to100,
});

export const DetailScoresSchema = z.object({
  overall: Score0to100,
  price_pivot: Score0to100,
  volatility_pivot: Score0to100,
  confidence: ConfidenceBlockSchema,
});

export const SummarySchema = z.object({
  level: ScoreLevelSchema,
  headline: z.string().min(1),
  explanation: z.string().min(1),
});

export const PivotDetailSchema = z.object({
  asset: z.object({
    symbol: AssetSymbolSchema,
    name: z.string().min(1),
  }),
  horizon: HorizonSchema,
  timestamp: z.string().min(1),
  scores: DetailScoresSchema,
  direction_bias: DirectionBiasSchema,
  evidence: z.array(EvidenceItemSchema),
  summary: SummarySchema,
});
export type PivotDetail = z.infer<typeof PivotDetailSchema>;

/**
 * The materialised file `data/pivot_assets.live.json` shape.
 *
 * Phase 1: committed mock. Phase 2: SDE producer overwrites the same path
 * with the same shape, so reader/route can stay unchanged.
 */
export const PivotAssetsSnapshotSchema = z.object({
  schema_version: z.literal("v0.1"),
  generated_at: z.string().min(1),
  radar: z.array(RadarAssetSchema).min(1),
  // detail keyed by `${symbol}__${horizon}` — flat string key keeps the JSON
  // round-trippable through Python `json.dumps` without nested transforms.
  detail: z.record(z.string(), PivotDetailSchema),
});
export type PivotAssetsSnapshot = z.infer<typeof PivotAssetsSnapshotSchema>;

export const BacktestMetricsSchema = z.object({
  precision: z.number().min(0).max(1),
  recall: z.number().min(0).max(1),
  avg_lead_time_days: z.number(),
  false_positive_rate: z.number().min(0).max(1),
  false_negative_rate: z.number().min(0).max(1),
  average_move: z.number(),
  max_drawdown: z.number(),
  sample_size: z.number().int().nonnegative(),
});
export type BacktestMetrics = z.infer<typeof BacktestMetricsSchema>;

export const BacktestEntrySchema = z.object({
  asset: AssetSymbolSchema,
  horizon: HorizonSchema,
  score_type: ScoreTypeSchema,
  threshold: z.number().min(0).max(100),
  period: z.object({
    start: z.string().min(1),
    end: z.string().min(1),
  }),
  metrics: BacktestMetricsSchema,
});
export type BacktestEntry = z.infer<typeof BacktestEntrySchema>;

export const PivotBacktestSnapshotSchema = z.object({
  schema_version: z.literal("v0.1"),
  generated_at: z.string().min(1),
  entries: z.array(BacktestEntrySchema).min(1),
});
export type PivotBacktestSnapshot = z.infer<
  typeof PivotBacktestSnapshotSchema
>;

/** Map a 0-100 score to its display level (PRD §12). */
export function scoreLevel(score: number): ScoreLevel {
  if (score >= 85) return "Extreme";
  if (score >= 70) return "High";
  if (score >= 40) return "Medium";
  return "Low";
}

/** Build the detail-map key used in PivotAssetsSnapshot.detail. */
export function detailKey(asset: AssetSymbol, horizon: Horizon): string {
  return `${asset}__${horizon}`;
}
