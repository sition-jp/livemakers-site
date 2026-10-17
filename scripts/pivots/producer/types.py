"""Python mirror of lib/pivots/types.ts.

Source of truth is the TypeScript zod schema. This module exists so the
producer can construct payloads without re-parsing zod at runtime; the post-
write Vitest validator enforces the actual contract.

If lib/pivots/types.ts changes, this file MUST be updated to match. Tests here
assert the basic shape constants so a drift fails CI loudly.
"""
from __future__ import annotations

from typing import Literal, NotRequired, TypedDict

AssetSymbol = Literal["BTC", "ETH"]
Horizon = Literal["7D", "30D", "90D"]
ScoreType = Literal["overall", "price_pivot", "volatility_pivot"]
ConfidenceGrade = Literal["A", "B+", "B", "C"]
ScoreLevel = Literal["Low", "Medium", "High", "Extreme"]
EvidenceCategory = Literal[
    "price", "volatility", "volume", "oi", "funding", "confidence"
]
MainSignal = Literal["price", "volatility", "mixed"]

ASSETS: tuple[AssetSymbol, ...] = ("BTC", "ETH")
HORIZONS: tuple[Horizon, ...] = ("7D", "30D", "90D")
SCORE_TYPES: tuple[ScoreType, ...] = ("overall", "price_pivot", "volatility_pivot")
THRESHOLDS: tuple[int, ...] = (70, 80)


class EvidenceItem(TypedDict):
    """Mirror of EvidenceItemSchema in lib/pivots/types.ts.

    Only `raw_value` is optional in the zod schema; the other four fields
    are required. Use `NotRequired` rather than `total=False` so the type
    checker enforces the right contract.
    """
    category: EvidenceCategory
    direction: str  # "bullish" | "bearish" | "neutral" | "volatility"
    weight: float
    message: str
    raw_value: NotRequired[float]


class ConfidenceBlock(TypedDict):
    grade: ConfidenceGrade
    score: float


class DetailScores(TypedDict):
    overall: float
    price_pivot: float
    volatility_pivot: float
    confidence: ConfidenceBlock


class DirectionBiasDict(TypedDict):
    bullish: float
    bearish: float
    neutral: float


class Summary(TypedDict):
    level: ScoreLevel
    headline: str
    explanation: str


class PivotDetail(TypedDict):
    asset: dict
    horizon: Horizon
    timestamp: str
    scores: DetailScores
    direction_bias: DirectionBiasDict
    evidence: list[EvidenceItem]
    summary: Summary


class RadarScores(TypedDict):
    overall: float
    price_pivot: float
    volatility_pivot: float
    confidence_grade: ConfidenceGrade
    main_signal: MainSignal


class RadarAsset(TypedDict):
    symbol: AssetSymbol
    scores: dict  # {"7D": RadarScores, "30D": RadarScores, "90D": RadarScores}


class ForecastItem(TypedDict):
    """Mirror of ForecastItemSchema. Percent 0-100, one decimal."""
    event: Literal["turn", "move"]
    horizon: Horizon
    today_pct: float
    usual_pct: float
    prev_today_pct: NotRequired[float]


class ForecastMeta(TypedDict):
    iteration: str
    train_end: str


TurnStrength = Literal["small", "medium", "large", "cycle"]
TurnKind = Literal["top", "bottom"]
Outcome = Literal["hit", "miss", "pending"]


class TrendBlock(TypedDict, total=False):
    """Mirror of TrendSchema (per asset). % one decimal; a key is absent when history is too short."""
    ret_30d_pct: float
    ret_90d_pct: float


class TurnPoint(TypedDict):
    date: str
    kind: TurnKind
    close: float


class LadderRowJson(TypedDict):
    """Mirror of LadderRowSchema. decided=False -> candidate and confirm_at are None."""
    strength: TurnStrength
    decided: bool
    last_confirmed: TurnPoint | None
    candidate: TurnPoint | None
    confirm_at: float | None


class TurnEntry(TypedDict):
    """Mirror of TurnEntrySchema (confirmed turns: last 120 days + every cycle turn)."""
    date: str
    kind: TurnKind
    strength: TurnStrength
    close: float


class ForecastHistoryEntry(TypedDict):
    """Mirror of ForecastHistoryEntrySchema. forecast/outcome are {event: {horizon: value}}.

    backfilled=True => forecast is a backfill calculation; backfilled=False => the value shown
    live; no forecast => a gap (always backfilled=False). Carried forward unchanged when the
    block degrades (Ruling R12).
    """
    date: str
    close: NotRequired[float]
    forecast: NotRequired[dict]  # {"turn": {"7D": pct, ...}, "move": {...}} — omitted when no score
    outcome: NotRequired[dict]   # {"turn": {"7D": Outcome, ...}, "move": {...}}
    backfilled: bool


class PivotAssetsSnapshot(TypedDict):
    schema_version: Literal["v0.1"]
    generated_at: str
    radar: list[RadarAsset]
    detail: dict  # Record<detailKey, PivotDetail>
    previous: NotRequired[dict]  # {"generated_at": str, "radar": list[RadarAsset]}
    forecast: NotRequired[dict]  # {"BTC": [ForecastItem], "ETH": [...]} — it-2026-10 stage 2
    forecast_meta: NotRequired[ForecastMeta]
    trend: NotRequired[dict]  # {"BTC": TrendBlock, "ETH": ...} — it-2026-10 stage 2 Task 9
    ladder: NotRequired[dict]  # {"BTC": [LadderRowJson x4], ...}
    turns: NotRequired[dict]  # {"BTC": [TurnEntry], ...}
    forecast_history: NotRequired[dict]  # {"BTC": [ForecastHistoryEntry x120], ...}
    history: NotRequired[dict]  # {"BTC": [HistoryEntry], "ETH": [...]} — spec §5.8 T-P1


class BacktestMetrics(TypedDict):
    precision: float
    recall: float
    avg_lead_time_days: float
    false_positive_rate: float
    false_negative_rate: float
    average_move: float
    worst_forward_return: float
    sample_size: int
    # Optional — spec 2026-09-26 §5.4.7. Always present in producer output
    # (never omitted), but optional in the zod contract (lib/pivots/types.ts)
    # since older snapshots on disk won't carry them.
    direction_samples: NotRequired[int]
    direction_hit_rate: NotRequired[float]


class BacktestEntry(TypedDict):
    asset: AssetSymbol
    horizon: Horizon
    score_type: ScoreType
    threshold: int
    period: dict  # {"start": str, "end": str}
    metrics: BacktestMetrics


class CalibrationBinOut(TypedDict):
    lo: int
    hi: int
    prob_pct: float  # 0-100, one decimal
    n: int


class HoldoutOut(TypedDict):
    brier_skill: float | None
    lift_pts: float | None
    n_signal: int | None
    # 状態ごとの当たり率 (%・小数 1 桁・出せなければ null)。旧スナップショットには無い
    signal_rate_pct: NotRequired[float | None]
    other_rate_pct: NotRequired[float | None]
    holdout_rate_pct: NotRequired[float | None]
    holdout_n: NotRequired[int | None]
    judged: bool | None
    primary: str | None  # "pass" | "fail" | "undecidable" | None
    secondary: str | None


class BacktestEvent(TypedDict):
    asset: AssetSymbol
    event: str  # "turn" | "move"
    horizon: Horizon
    usual_pct: float
    long_run_usual_pct: float | None
    calibration: list[CalibrationBinOut]
    holdout: HoldoutOut


class PivotBacktestSnapshot(TypedDict):
    schema_version: Literal["v0.1"]
    generated_at: str
    entries: list[BacktestEntry]
    data_provenance: NotRequired[dict]
    events: NotRequired[list[BacktestEvent]]  # it-2026-10 stage 2 Task 10 (frozen copy)


def detail_key(asset: AssetSymbol, horizon: Horizon) -> str:
    return f"{asset}__{horizon}"


def score_level(score: float) -> ScoreLevel:
    if score >= 85:
        return "Extreme"
    if score >= 70:
        return "High"
    if score >= 40:
        return "Medium"
    return "Low"
