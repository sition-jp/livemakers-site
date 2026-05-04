"""Volatility Pivot scorer — PRD §14 rule-based."""
from __future__ import annotations

from typing import TypedDict

from producer.percentiles import is_in_bottom_pct, is_in_top_pct, pct_rank
from producer.types import EvidenceItem


class VolatilityContext(TypedDict):
    rv_30d: float
    rv_30d_history: list[float]
    bb_width: float
    bb_width_history: list[float]
    atr_now: float
    atr_history: list[float]
    oi_growth_pct: float  # decimal pct over last 30 windows, e.g. 0.20 = +20%
    price_range_compression: bool
    abs_funding: float
    abs_funding_history: list[float]
    volume_ratio_30d: float  # current daily volume / 30d MA


def score_volatility_pivot(
    ctx: VolatilityContext,
) -> tuple[int, list[EvidenceItem]]:
    score = 0
    evidence: list[EvidenceItem] = []

    if is_in_bottom_pct(ctx["rv_30d_history"], ctx["rv_30d"], 0.20):
        score += 25
        evidence.append({
            "category": "volatility",
            "direction": "volatility",
            "weight": 0.25,
            "message": "30D realized volatility is compressed (bottom 20% of lookback)",
            "raw_value": ctx["rv_30d"],
        })

    if is_in_bottom_pct(ctx["bb_width_history"], ctx["bb_width"], 0.20):
        score += 20
        evidence.append({
            "category": "volatility",
            "direction": "volatility",
            "weight": 0.20,
            "message": "Bollinger Band width is compressed (bottom 20% of lookback)",
            "raw_value": ctx["bb_width"],
        })

    # ATR rising from a low percentile: previous-window low + now meaningfully higher.
    prev_window = ctx["atr_history"][-10:]
    if prev_window and pct_rank(ctx["atr_history"][:-1], prev_window[-1]) <= 0.30:
        if ctx["atr_now"] > prev_window[-1] * 1.10:
            score += 15
            evidence.append({
                "category": "volatility",
                "direction": "volatility",
                "weight": 0.15,
                "message": "ATR is rising from a low-volatility area",
                "raw_value": ctx["atr_now"],
            })

    if ctx["oi_growth_pct"] >= 0.10 and ctx["price_range_compression"]:
        score += 25
        evidence.append({
            "category": "oi",
            "direction": "volatility",
            "weight": 0.25,
            "message": "Open Interest increased while price stayed range-bound",
            "raw_value": ctx["oi_growth_pct"],
        })

    if is_in_top_pct(ctx["abs_funding_history"], ctx["abs_funding"], 0.20):
        score += 15
        evidence.append({
            "category": "funding",
            "direction": "volatility",
            "weight": 0.15,
            "message": "Funding is skewed to one side (top 20% of lookback)",
            "raw_value": ctx["abs_funding"],
        })

    if ctx["volume_ratio_30d"] >= 1.5:
        score += 15
        evidence.append({
            "category": "volume",
            "direction": "volatility",
            "weight": 0.15,
            "message": "Volume expanded sharply versus the 30D average",
            "raw_value": ctx["volume_ratio_30d"],
        })

    return min(score, 100), evidence
