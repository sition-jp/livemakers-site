"""Horizon-specific scoring inputs shared by the live producer and the backtest.

it-2026-10 (P3/P5): the 7D / 30D / 90D scores used to differ only by their
percentile lookback; the range-edge test always used a 30-day window, the MA
distances always used MA20/MA50, and "range compression" was a fixed 5%. These
helpers give each horizon its own inputs, and ``compose_assets`` (live) and
``compose_backtest`` call ONLY these functions, so the two paths cannot drift.

``RuleSet`` switches the new behaviour per feature so Task 6 can score the same
history with ``LEGACY_RULES`` (pre-it-2026-10 behaviour) and ``IT_2026_10_RULES``.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Sequence

from producer.percentiles import is_in_bottom_pct
from producer.types import Horizon

# Window for the "near range boundary" test (within 2% of the window high/low).
# it-2026-10 Task 6 chose these from the candidates 7D (10, 14, 20) / 30D (30, 45, 60) /
# 90D (60, 90, 120) by training-period Brier score only (train end 2025-10-16; holdout
# not consulted). Initial values were 14 / 30 / 90 (see ops/iteration_report.py).
RANGE_WINDOW_DAYS: dict[Horizon, int] = {"7D": 14, "30D": 60, "90D": 120}
LEGACY_RANGE_WINDOW_DAYS = 30

# (short, long) moving-average windows for the price-vs-MA distance rules.
MA_DISTANCE_WINDOWS: dict[Horizon, tuple[int, int]] = {
    "7D": (10, 20),
    "30D": (20, 50),
    "90D": (50, 100),
}
LEGACY_MA_WINDOWS = (20, 50)

COMPRESSION_WINDOW_DAYS = 30
LEGACY_COMPRESSION_MAX = 0.05  # absolute (max-min)/mean threshold used before it-2026-10
COMPRESSION_BOTTOM_PCT = 0.20
# Fewest past 30D range ratios needed to rank today's against; below this, False.
MIN_COMPRESSION_HISTORY = 60


@dataclass(frozen=True)
class RuleSet:
    horizon_ranges: bool
    relative_compression: bool
    horizon_ma: bool


LEGACY_RULES = RuleSet(False, False, False)
IT_2026_10_RULES = RuleSet(True, True, True)


def ma_windows(horizon: Horizon, rules: RuleSet = IT_2026_10_RULES) -> tuple[int, int]:
    return MA_DISTANCE_WINDOWS[horizon] if rules.horizon_ma else LEGACY_MA_WINDOWS


def near_range_boundary(
    closes: Sequence[float],
    t: int,
    horizon: Horizon,
    *,
    window: Optional[int] = None,
) -> bool:
    """True when closes[t] is within 2% of the window high or low (window ends at t)."""
    w = window if window is not None else RANGE_WINDOW_DAYS[horizon]
    if t < w:
        return False
    recent = closes[t - w + 1 : t + 1]
    return closes[t] >= max(recent) * 0.98 or closes[t] <= min(recent) * 1.02


def _range_ratio(closes: Sequence[float], t: int) -> Optional[float]:
    """30-day (max - min) / mean ending at t; None when undefined."""
    w = COMPRESSION_WINDOW_DAYS
    if t < w - 1:
        return None
    recent = closes[t - w + 1 : t + 1]
    avg = sum(recent) / w
    if avg <= 0:
        return None
    return (max(recent) - min(recent)) / avg


_ratio_cache: dict = {"obj": None, "n": -1, "last": None, "ratios": None}


def _ratios(closes: Sequence[float]) -> list[Optional[float]]:
    """Whole-series ratio list, memoised for the last list passed in (the backtest
    calls this once per day on the same list)."""
    c = _ratio_cache
    n = len(closes)
    if c["obj"] is closes and c["n"] == n and c["last"] == closes[-1]:
        return c["ratios"]
    ratios = [_range_ratio(closes, i) for i in range(n)]
    c.update(obj=closes, n=n, last=closes[-1], ratios=ratios)
    return ratios


def range_compressed(
    closes: Sequence[float], t: int, history_days: int = 365
) -> bool:
    """True when the 30D range ratio at t is in the bottom 20% of the same ratio
    over the previous ``history_days`` days (t excluded). False with too little history."""
    now = _range_ratio(closes, t)
    if now is None:
        return False
    ratios = _ratios(closes)
    past = [r for r in ratios[max(0, t - history_days) : t] if r is not None]
    if len(past) < MIN_COMPRESSION_HISTORY:
        return False
    return is_in_bottom_pct(past, now, COMPRESSION_BOTTOM_PCT)


def boundary_flag(
    closes: Sequence[float], t: int, horizon: Horizon, rules: RuleSet = IT_2026_10_RULES
) -> bool:
    """near_range_boundary under ``rules`` (legacy: 30-day window, needs t >= 30)."""
    if rules.horizon_ranges:
        return near_range_boundary(closes, t, horizon)
    return near_range_boundary(closes, t, horizon, window=LEGACY_RANGE_WINDOW_DAYS)


def compression_flag(
    closes: Sequence[float], t: int, rules: RuleSet = IT_2026_10_RULES
) -> bool:
    """price_range_compression under ``rules`` (legacy: absolute 5%, needs t >= 30)."""
    if rules.relative_compression:
        return range_compressed(closes, t)
    if t < COMPRESSION_WINDOW_DAYS:
        return False
    ratio = _range_ratio(closes, t)
    return ratio is not None and ratio < LEGACY_COMPRESSION_MAX
