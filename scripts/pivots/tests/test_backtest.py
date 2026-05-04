import pytest

from producer.backtest import (
    HitDefinition,
    HIT_DEFINITIONS,
    detect_hit,
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


def test_compute_metrics_empty() -> None:
    m = compute_metrics([], total_reversals=10)
    assert m["sample_size"] == 0
    assert m["precision"] == 0.0
    assert m["recall"] == 0.0
