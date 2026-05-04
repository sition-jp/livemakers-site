"""Percentile utilities with horizon-parameterized lookback windows.

Phase 2 v0.1 maps each PRD horizon to a lookback window for percentile
baselines. This is what gives different scores across 7D / 30D / 90D when the
underlying indicator math is the same.
"""
from __future__ import annotations

from typing import Sequence

from producer.types import Horizon

LOOKBACK_DAYS: dict[Horizon, int] = {"7D": 30, "30D": 180, "90D": 365}


def pct_rank(series: Sequence[float], value: float) -> float:
    """Fraction of `series` strictly less than `value`, clamped to [0, 1].

    Uses (count_below) / (N - 1) so that the smallest element returns 0.0 and
    the largest returns 1.0. The clamp guards against values strictly above
    the maximum of the series, which would otherwise produce N / (N - 1) > 1.0
    (Codex review 1, must-fix #5).
    """
    if len(series) < 2:
        raise ValueError("pct_rank needs at least 2 points")
    below = sum(1 for x in series if x < value)
    rank = below / (len(series) - 1)
    return max(0.0, min(1.0, rank))


def is_in_top_pct(series: Sequence[float], value: float, top_pct: float) -> bool:
    """True if value is in the top `top_pct` of series (e.g. top 10% → top_pct=0.10)."""
    return pct_rank(series, value) >= (1.0 - top_pct)


def is_in_bottom_pct(
    series: Sequence[float], value: float, bottom_pct: float
) -> bool:
    """True if value is in the bottom `bottom_pct` of series."""
    return pct_rank(series, value) <= bottom_pct
