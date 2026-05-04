"""Price Pivot scorer — PRD §13 rule-based.

Pure function over a MarketContext dict. Returns (score 0..100, evidence list).
The caller is responsible for building MarketContext from indicators.py +
percentiles.py.
"""
from __future__ import annotations

from typing import TypedDict

from producer.percentiles import pct_rank
from producer.types import EvidenceItem


class MarketContext(TypedDict):
    rsi_14: float
    distance_from_ma_20: float
    distance_from_ma_50: float
    distance_from_ma_20_history: list[float]
    distance_from_ma_50_history: list[float]
    macd_hist_recent: list[float]  # at least last 5 hist values
    near_range_boundary: bool


def _macd_improving(hist: list[float]) -> bool:
    if len(hist) < 5:
        return False
    earlier = hist[:-2]
    later = hist[-2:]
    if not earlier:
        return False
    return all(x < 0 for x in earlier) and later[-1] > later[0]


def _macd_weakening(hist: list[float]) -> bool:
    if len(hist) < 5:
        return False
    earlier = hist[:-2]
    later = hist[-2:]
    if not earlier:
        return False
    return all(x > 0 for x in earlier) and later[-1] < later[0]


def score_price_pivot(ctx: MarketContext) -> tuple[int, list[EvidenceItem]]:
    score = 0
    evidence: list[EvidenceItem] = []

    if ctx["rsi_14"] < 30:
        score += 20
        evidence.append({
            "category": "price",
            "direction": "bullish",
            "weight": 0.20,
            "message": f"RSI is in oversold territory ({ctx['rsi_14']:.1f})",
            "raw_value": ctx["rsi_14"],
        })
    elif ctx["rsi_14"] > 70:
        score += 20
        evidence.append({
            "category": "price",
            "direction": "bearish",
            "weight": 0.20,
            "message": f"RSI is in overheated territory ({ctx['rsi_14']:.1f})",
            "raw_value": ctx["rsi_14"],
        })

    abs20 = abs(ctx["distance_from_ma_20"])
    if abs20 > 0:
        rank = pct_rank(
            [abs(x) for x in ctx["distance_from_ma_20_history"]], abs20
        )
        if rank >= 0.80:
            score += 15
            evidence.append({
                "category": "price",
                "direction": "neutral",
                "weight": 0.15,
                "message": "Price is far from MA20 (top 20% of recent range)",
                "raw_value": abs20,
            })

    abs50 = abs(ctx["distance_from_ma_50"])
    if abs50 > 0:
        rank = pct_rank(
            [abs(x) for x in ctx["distance_from_ma_50_history"]], abs50
        )
        if rank >= 0.80:
            score += 15
            evidence.append({
                "category": "price",
                "direction": "neutral",
                "weight": 0.15,
                "message": "Price is far from MA50 (top 20% of recent range)",
                "raw_value": abs50,
            })

    if _macd_improving(ctx["macd_hist_recent"]):
        score += 15
        evidence.append({
            "category": "price",
            "direction": "bullish",
            "weight": 0.15,
            "message": "MACD momentum is improving",
        })
    elif _macd_weakening(ctx["macd_hist_recent"]):
        score += 15
        evidence.append({
            "category": "price",
            "direction": "bearish",
            "weight": 0.15,
            "message": "MACD momentum is weakening",
        })

    if ctx["near_range_boundary"]:
        score += 20
        evidence.append({
            "category": "price",
            "direction": "neutral",
            "weight": 0.20,
            "message": "Price is near a recent range boundary",
        })

    return min(score, 100), evidence
