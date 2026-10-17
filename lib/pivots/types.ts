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

export const PreviousRadarSchema = z.object({
  generated_at: z.string().min(1),
  radar: z.array(RadarAssetSchema).min(1),
});
export type PreviousRadar = z.infer<typeof PreviousRadarSchema>;

// Rolling per-asset score history (spec §5.8 T-P1): last HISTORY_MAX_DAYS
// days of {date, close, overall per horizon, lean per horizon}, fed by the
// timeline chart. The producer self-accumulates this the same way it already
// carries `previous` — read the snapshot about to be replaced, append today,
// cap, replace same-day entries.
export const HistoryEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  close: z.number().positive(),
  overall: z.object({ "7D": Score0to100, "30D": Score0to100, "90D": Score0to100 }),
  lean: z.object({
    "7D": z.number().min(-100).max(100),
    "30D": z.number().min(-100).max(100),
    "90D": z.number().min(-100).max(100),
  }),
});
export type HistoryEntry = z.infer<typeof HistoryEntrySchema>;

export const ScoreHistorySchema = z.record(
  AssetSymbolSchema,
  z.array(HistoryEntrySchema).max(120),
);

// 「今日の確率」(it-2026-10 段 2): 資産 x 出来事 x 期間の、今日の確率とふだんの確率。
// 単位は % (0-100・小数 1 桁)。凍結した較正表から作る。
export const ForecastItemSchema = z.object({
  event: z.enum(["turn", "move"]),
  horizon: HorizonSchema,
  today_pct: z.number().min(0).max(100),
  usual_pct: z.number().min(0).max(100),
  prev_today_pct: z.number().min(0).max(100).optional(),
});
export type ForecastItem = z.infer<typeof ForecastItemSchema>;

export const ForecastSchema = z.record(AssetSymbolSchema, z.array(ForecastItemSchema).max(6));
export const ForecastMetaSchema = z.object({
  iteration: z.string().min(1),
  train_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// 長期の終値から作るブロック (it-2026-10 段 2 Task 9)。どれも資産ごと・optional。
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Pct0to100 = z.number().min(0).max(100);

// 30 日前・90 日前の終値との比 (%・小数 1 桁)。履歴が足りなければそのキーが無い。
export const TrendSchema = z.record(
  AssetSymbolSchema,
  z.object({ ret_30d_pct: z.number().optional(), ret_90d_pct: z.number().optional() }),
);

export const TurnStrengthSchema = z.enum(["small", "medium", "large", "cycle"]);
export const TurnKindSchema = z.enum(["top", "bottom"]);
const TurnPointSchema = z.object({
  date: IsoDate,
  kind: TurnKindSchema,
  close: z.number().positive(),
});

// 強さのはしご: 4 行 (cycle → small)。decided=false (向きがまだ決まっていない) の行は
// candidate と confirm_at が null — 画面は「まだ確定なし」を出し、確定条件の価格を出さない。
export const LadderRowSchema = z
  .object({
    strength: TurnStrengthSchema,
    decided: z.boolean(),
    last_confirmed: TurnPointSchema.nullable(),
    candidate: TurnPointSchema.nullable(),
    confirm_at: z.number().positive().nullable(),
  })
  .refine(
    (r) =>
      r.decided
        ? r.candidate !== null && r.confirm_at !== null
        : r.candidate === null && r.confirm_at === null,
    { message: "decided=false rows must have null candidate/confirm_at (and decided rows both set)" },
  );
export type LadderRow = z.infer<typeof LadderRowSchema>;
export const LadderSchema = z.record(AssetSymbolSchema, z.array(LadderRowSchema).max(4));

// 確定した天井・底: 直近 120 日以内 + サイクル級すべて。strength = その日が確定した一番大きい強さ。
export const TurnEntrySchema = TurnPointSchema.extend({ strength: TurnStrengthSchema });
export type TurnEntry = z.infer<typeof TurnEntrySchema>;
export const TurnsSchema = z.record(AssetSymbolSchema, z.array(TurnEntrySchema));

const PerHorizon = <T extends z.ZodTypeAny>(v: T) =>
  z.object({ "7D": v.optional(), "30D": v.optional(), "90D": v.optional() });
const PerEvent = <T extends z.ZodTypeAny>(v: T) =>
  z.object({ turn: PerHorizon(v).optional(), move: PerHorizon(v).optional() });
export const OutcomeSchema = z.enum(["hit", "miss", "pending"]);

// 毎日の確率の履歴: 今日を含む直近 120 暦日 (1 日 1 件)。
//   backfilled=true  ⇒ forecast はさかのぼり計算 (当時の画面ではない)
//   backfilled=false ⇒ forecast は実際に画面に出した値
//   forecast なし    ⇒ 空き (スコアが出せない・値が無い日。0 と書かない)。必ず backfilled=false
// producer の forecast_history が失敗した日は前回の記録をそのまま引き継ぐ (Ruling R12)。
export const ForecastHistoryEntrySchema = z
  .object({
    date: IsoDate,
    close: z.number().positive().optional(),
    forecast: PerEvent(Pct0to100).optional(),
    outcome: PerEvent(OutcomeSchema).optional(),
    backfilled: z.boolean(),
  })
  .refine((e) => !e.backfilled || e.forecast !== undefined, {
    message: "backfilled=true requires a forecast (an entry without forecast is a gap: backfilled=false)",
  });
export type ForecastHistoryEntry = z.infer<typeof ForecastHistoryEntrySchema>;
export const ForecastHistorySchema = z.record(
  AssetSymbolSchema,
  z.array(ForecastHistoryEntrySchema).max(120),
);

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
  previous: PreviousRadarSchema.optional(),
  history: ScoreHistorySchema.optional(),
  forecast: ForecastSchema.optional(),
  forecast_meta: ForecastMetaSchema.optional(),
  trend: TrendSchema.optional(),
  ladder: LadderSchema.optional(),
  turns: TurnsSchema.optional(),
  forecast_history: ForecastHistorySchema.optional(),
});
export type PivotAssetsSnapshot = z.infer<typeof PivotAssetsSnapshotSchema>;

export const BacktestMetricsSchema = z
  .object({
    precision: z.number().min(0).max(1),
    recall: z.number().min(0).max(1),
    avg_lead_time_days: z.number(),
    false_positive_rate: z.number().min(0).max(1),
    false_negative_rate: z.number().min(0).max(1),
    average_move: z.number(),
    /** Legacy name (pre 2026-10). Producer now emits worst_forward_return. */
    max_drawdown: z.number().optional(),
    worst_forward_return: z.number().optional(),
    sample_size: z.number().int().nonnegative(),
    /** Spec 2026-09-26 §5.4.7 — optional so older snapshots on disk still validate. */
    direction_samples: z.number().int().nonnegative().optional(),
    direction_hit_rate: z.number().min(0).max(1).optional(),
  })
  .superRefine((m, ctx) => {
    if (m.max_drawdown === undefined && m.worst_forward_return === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "worst_forward_return (or legacy max_drawdown) is required",
      });
    }
  });
export type BacktestMetrics = z.infer<typeof BacktestMetricsSchema>;

export function worstForwardReturn(m: BacktestMetrics): number {
  return m.worst_forward_return ?? m.max_drawdown ?? 0;
}

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

export const DataProvenanceSchema = z.object({
  source: z.string().min(1),
  start: z.string().min(1),
  end: z.string().min(1),
  coverage_pct: z.number().min(0).max(100),
});
export type DataProvenance = z.infer<typeof DataProvenanceSchema>;

const VerdictSchema = z.enum(["pass", "fail", "undecidable"]).nullable();

export const BacktestEventSchema = z.object({
  asset: z.enum(["BTC", "ETH"]),
  event: z.enum(["turn", "move"]),
  horizon: z.enum(["7D", "30D", "90D"]),
  usual_pct: z.number().min(0).max(100),
  long_run_usual_pct: z.number().min(0).max(100).nullable(),
  calibration: z.array(
    z.object({
      lo: z.number(),
      hi: z.number(),
      prob_pct: z.number().min(0).max(100),
      n: z.number().int().min(0),
    }),
  ),
  holdout: z.object({
    brier_skill: z.number().nullable(),
    lift_pts: z.number().nullable(),
    n_signal: z.number().int().nullable(),
    // 状態ごとの当たり率 (%)。旧スナップショットには無い
    signal_rate_pct: z.number().min(0).max(100).nullable().optional(),
    other_rate_pct: z.number().min(0).max(100).nullable().optional(),
    holdout_rate_pct: z.number().min(0).max(100).nullable().optional(),
    holdout_n: z.number().int().min(0).nullable().optional(),
    judged: z.boolean().nullable(),
    primary: VerdictSchema,
    secondary: VerdictSchema,
  }),
});
export type BacktestEvent = z.infer<typeof BacktestEventSchema>;

export const PivotBacktestSnapshotSchema = z.object({
  schema_version: z.literal("v0.1"),
  generated_at: z.string().min(1),
  entries: z.array(BacktestEntrySchema).min(1),
  data_provenance: DataProvenanceSchema.optional(),
  events: z.array(BacktestEventSchema).optional(),
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
