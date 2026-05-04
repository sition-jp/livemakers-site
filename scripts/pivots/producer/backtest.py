"""Backtest hit detection + metrics — PRD §18–19.

v0.1 uses fixed pct thresholds. Future v0.2 may swap in ATR/RV-relative
thresholds (see PRD §18 last paragraph).
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence

from producer.types import BacktestMetrics, Horizon


@dataclass(frozen=True)
class HitDefinition:
    horizon_days: int
    pct_move: float
    reversal_pct: float


HIT_DEFINITIONS: dict[Horizon, HitDefinition] = {
    "7D":  HitDefinition(horizon_days=7,  pct_move=0.05, reversal_pct=0.03),
    "30D": HitDefinition(horizon_days=30, pct_move=0.10, reversal_pct=0.08),
    "90D": HitDefinition(horizon_days=90, pct_move=0.20, reversal_pct=0.15),
}


@dataclass(frozen=True)
class Signal:
    index: int        # position in closes[] when score crossed threshold
    score: int        # the score that triggered the signal
    hit: bool
    forward_move: float  # signed pct move at horizon


def detect_hit(
    closes: Sequence[float], signal_index: int, hd: HitDefinition
) -> bool:
    end = min(signal_index + hd.horizon_days, len(closes) - 1)
    if signal_index >= end:
        return False
    base = closes[signal_index]
    if base <= 0:
        return False
    window = closes[signal_index : end + 1]
    high = max(window)
    low = min(window)
    if abs(high - base) / base >= hd.pct_move:
        return True
    if abs(low - base) / base >= hd.pct_move:
        return True
    # reversal-from-extreme check
    if (high - low) / base >= hd.pct_move + hd.reversal_pct:
        return True
    return False


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
    return {
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "avg_lead_time_days": 0.0,  # v0.1 placeholder; lead-time analysis lands in v0.2
        "false_positive_rate": round(fp_rate, 4),
        "false_negative_rate": round(fn_rate, 4),
        "average_move": round(avg_move, 4),
        "max_drawdown": round(max_dd, 4),
        "sample_size": n,
    }
