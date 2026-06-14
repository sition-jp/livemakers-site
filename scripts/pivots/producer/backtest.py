"""Backtest hit detection + metrics — PRD §18–19.

v0.1 uses fixed pct thresholds. Future v0.2 may swap in ATR/RV-relative
thresholds (see PRD §18 last paragraph).
"""
from __future__ import annotations

from dataclasses import dataclass
from math import sqrt
from typing import Sequence

from producer.types import BacktestMetrics, Horizon


@dataclass(frozen=True)
class HitDefinition:
    horizon_days: int
    pct_move: float
    reversal_pct: float
    min_floor_pct: float
    atr_multiplier: float
    rv_multiplier: float


HIT_DEFINITIONS: dict[Horizon, HitDefinition] = {
    "7D": HitDefinition(
        horizon_days=7,
        pct_move=0.05,
        reversal_pct=0.03,
        min_floor_pct=0.03,
        atr_multiplier=1.5,
        rv_multiplier=0.80,
    ),
    "30D": HitDefinition(
        horizon_days=30,
        pct_move=0.10,
        reversal_pct=0.08,
        min_floor_pct=0.06,
        atr_multiplier=2.5,
        rv_multiplier=0.90,
    ),
    "90D": HitDefinition(
        horizon_days=90,
        pct_move=0.20,
        reversal_pct=0.15,
        min_floor_pct=0.10,
        atr_multiplier=4.0,
        rv_multiplier=1.00,
    ),
}


@dataclass(frozen=True)
class BacktestHitContext:
    atr_14: float | None
    realized_vol_30d: float | None


@dataclass(frozen=True)
class Signal:
    index: int        # position in closes[] when score crossed threshold
    score: int        # the score that triggered the signal
    hit: bool
    forward_move: float  # signed pct move at horizon
    lead_time_days: int | None = None


def _thresholds(
    base: float, hd: HitDefinition, ctx: BacktestHitContext | None
) -> tuple[float, float]:
    if (
        base <= 0
        or ctx is None
        or ctx.atr_14 is None
        or ctx.realized_vol_30d is None
        or ctx.atr_14 <= 0
        or ctx.realized_vol_30d <= 0
    ):
        return hd.pct_move, hd.reversal_pct

    atr_pct = ctx.atr_14 / base
    rv_horizon_pct = ctx.realized_vol_30d * sqrt(hd.horizon_days / 365.0)
    adaptive = max(
        hd.atr_multiplier * atr_pct,
        hd.rv_multiplier * rv_horizon_pct,
    )
    move_threshold = max(hd.min_floor_pct, min(hd.pct_move, adaptive))
    reversal_threshold = max(hd.reversal_pct * 0.5, move_threshold * 0.60)
    return move_threshold, reversal_threshold


def first_hit_day(
    closes: Sequence[float],
    signal_index: int,
    hd: HitDefinition,
    ctx: BacktestHitContext | None = None,
) -> int | None:
    end = min(signal_index + hd.horizon_days, len(closes) - 1)
    if signal_index >= end:
        return None
    base = closes[signal_index]
    if base <= 0:
        return None
    move_threshold, reversal_threshold = _thresholds(base, hd, ctx)
    high = base
    low = base
    for i in range(signal_index + 1, end + 1):
        close = closes[i]
        high = max(high, close)
        low = min(low, close)
        if abs(high - base) / base >= move_threshold:
            return i - signal_index
        if abs(low - base) / base >= move_threshold:
            return i - signal_index
        # reversal-from-extreme check
        if (high - low) / base >= move_threshold + reversal_threshold:
            return i - signal_index
    return None


def detect_hit(
    closes: Sequence[float],
    signal_index: int,
    hd: HitDefinition,
    ctx: BacktestHitContext | None = None,
) -> bool:
    return first_hit_day(closes, signal_index, hd, ctx) is not None


def forward_move(
    closes: Sequence[float], signal_index: int, hd: HitDefinition
) -> float:
    end = min(signal_index + hd.horizon_days, len(closes) - 1)
    if signal_index >= end or closes[signal_index] <= 0:
        return 0.0
    return (closes[end] - closes[signal_index]) / closes[signal_index]


def compute_metrics(
    signals: list[Signal], total_reversals: int
) -> BacktestMetrics:
    n = len(signals)
    if n == 0:
        return {
            "precision": 0.0,
            "recall": 0.0,
            "avg_lead_time_days": 0.0,
            "false_positive_rate": 0.0,
            "false_negative_rate": 0.0,
            "average_move": 0.0,
            "max_drawdown": 0.0,
            "sample_size": 0,
        }
    hits = [s for s in signals if s.hit]
    misses = [s for s in signals if not s.hit]
    precision = len(hits) / n
    recall = (len(hits) / total_reversals) if total_reversals > 0 else 0.0
    fp_rate = len(misses) / n
    fn_rate = (
        max(0, total_reversals - len(hits)) / total_reversals
        if total_reversals > 0 else 0.0
    )
    avg_move = sum(s.forward_move for s in signals) / n
    max_dd = min((s.forward_move for s in signals), default=0.0)
    hit_lead_times = [
        s.lead_time_days for s in hits if s.lead_time_days is not None
    ]
    avg_lead_time_days = (
        sum(hit_lead_times) / len(hit_lead_times) if hit_lead_times else 0.0
    )
    return {
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "avg_lead_time_days": round(avg_lead_time_days, 4),
        "false_positive_rate": round(fp_rate, 4),
        "false_negative_rate": round(fn_rate, 4),
        "average_move": round(avg_move, 4),
        "max_drawdown": round(max_dd, 4),
        "sample_size": n,
    }
