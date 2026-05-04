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


class PivotAssetsSnapshot(TypedDict):
    schema_version: Literal["v0.1"]
    generated_at: str
    radar: list[RadarAsset]
    detail: dict  # Record<detailKey, PivotDetail>


class BacktestMetrics(TypedDict):
    precision: float
    recall: float
    avg_lead_time_days: float
    false_positive_rate: float
    false_negative_rate: float
    average_move: float
    max_drawdown: float
    sample_size: int


class BacktestEntry(TypedDict):
    asset: AssetSymbol
    horizon: Horizon
    score_type: ScoreType
    threshold: int
    period: dict  # {"start": str, "end": str}
    metrics: BacktestMetrics


class PivotBacktestSnapshot(TypedDict):
    schema_version: Literal["v0.1"]
    generated_at: str
    entries: list[BacktestEntry]


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
