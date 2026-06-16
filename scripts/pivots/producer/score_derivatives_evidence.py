"""REST-only derivatives evidence scorer.

v0.3-1 evidence-only; score is internal and not wired into overall/confidence/backtest.
"""
from __future__ import annotations

import math
from typing import TypedDict

from producer.percentiles import is_in_bottom_pct, is_in_top_pct
from producer.types import EvidenceItem

OI_GROWTH_THRESHOLD = 0.10
LONG_SHORT_CROWDING_RATIO = 1.8
TOP_TRADER_DIVERGENCE_RATIO = 1.35


class DerivativesEvidenceContext(TypedDict):
    oi_growth_pct: float
    oi_growth_history: list[float]
    abs_funding: float
    abs_funding_history: list[float]
    global_long_short_ratio: float | None
    global_long_short_ratio_history: list[float]
    top_trader_position_ratio: float | None
    top_trader_position_ratio_history: list[float]
    price_range_compression: bool
    data_completeness: float


def _has_percentile_history(series: list[float]) -> bool:
    return len(series) >= 2


def _is_crowded_ratio(ratio: float | None, history: list[float]) -> bool:
    if ratio is None or ratio <= 0 or not _has_percentile_history(history):
        return False

    if ratio >= LONG_SHORT_CROWDING_RATIO:
        return is_in_top_pct(history, ratio, 0.20)

    if ratio <= 1 / LONG_SHORT_CROWDING_RATIO:
        return is_in_bottom_pct(history, ratio, 0.20)

    return False


def _is_top_trader_divergent(
    global_ratio: float | None,
    top_trader_ratio: float | None,
) -> bool:
    if (
        global_ratio is None
        or top_trader_ratio is None
        or global_ratio <= 0
        or top_trader_ratio <= 0
    ):
        return False

    return abs(math.log(top_trader_ratio / global_ratio)) >= math.log(
        TOP_TRADER_DIVERGENCE_RATIO
    )


def score_derivatives_evidence(
    ctx: DerivativesEvidenceContext,
) -> tuple[int, list[EvidenceItem]]:
    score = 0
    evidence: list[EvidenceItem] = []

    if (
        ctx["oi_growth_pct"] >= OI_GROWTH_THRESHOLD
        and ctx["price_range_compression"]
    ):
        score += 30
        evidence.append({
            "category": "oi",
            "direction": "volatility",
            "weight": 0.25,
            "message": "Open Interest expanded while price stayed range-bound",
            "raw_value": ctx["oi_growth_pct"],
        })

    if (
        _has_percentile_history(ctx["abs_funding_history"])
        and is_in_top_pct(ctx["abs_funding_history"], ctx["abs_funding"], 0.20)
    ):
        score += 20
        evidence.append({
            "category": "funding",
            "direction": "volatility",
            "weight": 0.15,
            "message": "Funding is skewed versus recent history",
            "raw_value": ctx["abs_funding"],
        })

    global_ratio = ctx["global_long_short_ratio"]
    if _is_crowded_ratio(global_ratio, ctx["global_long_short_ratio_history"]):
        score += 25
        evidence.append({
            "category": "volatility",
            "direction": "volatility",
            "weight": 0.20,
            "message": "Long/short positioning is crowded, increasing squeeze sensitivity",
            "raw_value": global_ratio,
        })

    top_ratio = ctx["top_trader_position_ratio"]
    if _is_top_trader_divergent(global_ratio, top_ratio):
        score += 25
        evidence.append({
            "category": "volatility",
            "direction": "volatility",
            "weight": 0.20,
            "message": "Top trader positioning diverges from broader account positioning",
            "raw_value": top_ratio,
        })

    return min(score, 100), evidence
