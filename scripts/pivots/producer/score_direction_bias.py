"""Direction Bias scorer — PRD §15 + sum=100±0.5 invariant.

Phase 1 zod schema refuses any direction_bias whose three fields don't sum
to 100 ±0.5. This module guarantees the invariant **before** the producer
attempts to write. The post-write Vitest validator is a defence-in-depth
check; this is the primary enforcement.
"""
from __future__ import annotations

from typing import TypedDict

from producer.types import DirectionBiasDict

DIRECTION_BIAS_TOLERANCE = 0.5


class DirectionContext(TypedDict):
    rsi_14: float
    near_support: bool
    near_resistance: bool
    funding: float
    macd_hist_recent: list[float]
    volatility_pivot_score: int


def _macd_improving(hist: list[float]) -> bool:
    if len(hist) < 5:
        return False
    return all(x < 0 for x in hist[:-2]) and hist[-1] > hist[-2]


def _macd_weakening(hist: list[float]) -> bool:
    if len(hist) < 5:
        return False
    return all(x > 0 for x in hist[:-2]) and hist[-1] < hist[-2]


def _normalize(bullish: float, bearish: float, neutral: float) -> DirectionBiasDict:
    """Force sum to 100.0 within ±0.5 tolerance.

    Strategy:
    1. If everything is zero → return full neutral (defensive default).
    2. Otherwise scale to 100, then round to one decimal place.
    3. Distribute any rounding drift to the largest bucket so the final sum
       is exactly 100.0.
    """
    total = bullish + bearish + neutral
    if total <= 0:
        return {"bullish": 0.0, "bearish": 0.0, "neutral": 100.0}

    factor = 100.0 / total
    b = round(bullish * factor, 1)
    bs = round(bearish * factor, 1)
    n = round(neutral * factor, 1)

    drift = round(100.0 - (b + bs + n), 1)
    if abs(drift) > 0.0:
        # Add drift to the largest bucket.
        biggest = max(("bullish", b), ("bearish", bs), ("neutral", n), key=lambda kv: kv[1])[0]
        if biggest == "bullish":
            b = round(b + drift, 1)
        elif biggest == "bearish":
            bs = round(bs + drift, 1)
        else:
            n = round(n + drift, 1)

    # Final clamp to [0, 100] in case of floating-point edge cases.
    b = max(0.0, min(100.0, b))
    bs = max(0.0, min(100.0, bs))
    n = max(0.0, min(100.0, n))

    final_sum = b + bs + n
    if abs(final_sum - 100.0) > DIRECTION_BIAS_TOLERANCE:
        raise AssertionError(
            f"direction_bias sum invariant violated after normalize: "
            f"bullish={b} bearish={bs} neutral={n} sum={final_sum}"
        )
    return {"bullish": b, "bearish": bs, "neutral": n}


def score_direction_bias(ctx: DirectionContext) -> DirectionBiasDict:
    bull = 0.0
    bear = 0.0
    neut = 0.0

    if ctx["rsi_14"] < 30:
        bull += 15
    elif ctx["rsi_14"] > 70:
        bear += 15

    if ctx["near_support"]:
        bull += 15
    if ctx["near_resistance"]:
        bear += 15

    if ctx["funding"] < -0.003:
        bull += 10
    elif ctx["funding"] > 0.003:
        bear += 10

    if _macd_improving(ctx["macd_hist_recent"]):
        bull += 10
    elif _macd_weakening(ctx["macd_hist_recent"]):
        bear += 10

    if ctx["volatility_pivot_score"] >= 70 and abs(bull - bear) < 10:
        neut += 20

    return _normalize(bull, bear, neut)
