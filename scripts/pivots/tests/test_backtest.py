import pytest

from producer.backtest import (
    DIRECTION_LEAN_GAP,
    BacktestHitContext,
    HitDefinition,
    HIT_DEFINITIONS,
    detect_hit,
    first_hit_day,
    compute_metrics,
    Signal,
)


def test_hit_definitions_match_prd() -> None:
    assert HIT_DEFINITIONS["7D"].pct_move == 0.05
    assert HIT_DEFINITIONS["7D"].reversal_pct == 0.03
    assert HIT_DEFINITIONS["30D"].pct_move == 0.10
    assert HIT_DEFINITIONS["30D"].reversal_pct == 0.08
    assert HIT_DEFINITIONS["90D"].pct_move == 0.20
    assert HIT_DEFINITIONS["90D"].reversal_pct == 0.15


def test_detect_hit_5pct_move_in_7d() -> None:
    closes = [100.0, 101, 102, 103, 104, 106, 107, 108]  # +8% in 7d → hit
    assert detect_hit(closes, signal_index=0, hd=HIT_DEFINITIONS["7D"])


def test_detect_no_hit_flat() -> None:
    closes = [100.0] * 10
    assert not detect_hit(closes, signal_index=0, hd=HIT_DEFINITIONS["7D"])


def test_detect_hit_falls_back_to_fixed_threshold_without_context() -> None:
    closes = [100.0, 101.0, 102.0, 103.0, 104.0]
    assert not detect_hit(closes, signal_index=0, hd=HIT_DEFINITIONS["7D"])


def test_detect_hit_uses_adaptive_atr_rv_threshold_when_context_present() -> None:
    closes = [100.0, 101.0, 102.0, 103.2, 104.0]
    ctx = BacktestHitContext(atr_14=2.0, realized_vol_30d=0.20)
    assert detect_hit(closes, signal_index=0, hd=HIT_DEFINITIONS["7D"], ctx=ctx)


def test_first_hit_day_returns_first_forward_day_that_crosses_threshold() -> None:
    closes = [100.0, 100.5, 101.0, 103.5, 104.0]
    ctx = BacktestHitContext(atr_14=2.0, realized_vol_30d=0.20)
    assert first_hit_day(closes, signal_index=0, hd=HIT_DEFINITIONS["7D"], ctx=ctx) == 3


def test_compute_metrics_basic() -> None:
    signals = [
        Signal(index=0, score=80, hit=True,  forward_move=0.10),
        Signal(index=1, score=72, hit=False, forward_move=0.02),
        Signal(index=2, score=85, hit=True,  forward_move=0.15),
    ]
    total_reversals = 5
    m = compute_metrics(signals, total_reversals)
    assert m["sample_size"] == 3
    assert m["precision"] == pytest.approx(2 / 3, abs=0.001)
    assert m["recall"] == pytest.approx(2 / 5, abs=0.001)
    assert m["false_positive_rate"] == pytest.approx(1 / 3, abs=0.001)
    assert m["average_move"] == pytest.approx((0.10 + 0.02 + 0.15) / 3, abs=0.001)


def test_compute_metrics_averages_hit_lead_times_only() -> None:
    signals = [
        Signal(index=0, score=80, hit=True, forward_move=0.10, lead_time_days=2),
        Signal(index=1, score=72, hit=False, forward_move=0.02, lead_time_days=None),
        Signal(index=2, score=85, hit=True, forward_move=0.15, lead_time_days=4),
    ]
    m = compute_metrics(signals, total_reversals=5)
    assert m["avg_lead_time_days"] == pytest.approx(3.0, abs=0.001)


def test_compute_metrics_empty() -> None:
    m = compute_metrics([], total_reversals=10)
    assert m["sample_size"] == 0
    assert m["precision"] == 0.0
    assert m["recall"] == 0.0


def test_direction_lean_gap_is_25() -> None:
    """Task 31: single source of truth for the |lean| gate, shared by
    compute_metrics and the UI's DIRECTION_GAP (spec 2026-09-26 §5.4.7)."""
    assert DIRECTION_LEAN_GAP == 25


def test_compute_metrics_direction_hit_rate() -> None:
    """Task 31: direction_samples counts signals with |lean| >= gap; a hit is
    sign(forward_move) == sign(lean) (forward_move == 0 counts as a miss)."""
    signals = [
        Signal(index=0, score=80, hit=True, forward_move=0.05, lean=30.0),   # |lean|>=25, sign matches -> hit
        Signal(index=1, score=75, hit=False, forward_move=0.02, lean=-30.0),  # |lean|>=25, sign mismatch -> miss
        Signal(index=2, score=70, hit=False, forward_move=0.01, lean=10.0),   # |lean|<25 -> excluded
        Signal(index=3, score=72, hit=False, forward_move=0.03, lean=None),   # no lean -> excluded
    ]
    m = compute_metrics(signals, total_reversals=5)
    assert m["direction_samples"] == 2
    assert m["direction_hit_rate"] == pytest.approx(0.5)


def test_compute_metrics_direction_hit_rate_zero_forward_move_is_a_miss() -> None:
    signals = [
        Signal(index=0, score=80, hit=False, forward_move=0.0, lean=30.0),
    ]
    m = compute_metrics(signals, total_reversals=1)
    assert m["direction_samples"] == 1
    assert m["direction_hit_rate"] == 0.0


def test_compute_metrics_direction_hit_rate_zero_when_no_samples() -> None:
    m = compute_metrics([], total_reversals=10)
    assert m["direction_samples"] == 0
    assert m["direction_hit_rate"] == 0.0


def test_signal_lean_defaults_to_none() -> None:
    s = Signal(index=0, score=80, hit=True, forward_move=0.10)
    assert s.lean is None
