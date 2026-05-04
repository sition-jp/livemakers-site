import pytest

from producer.percentiles import (
    LOOKBACK_DAYS,
    pct_rank,
    is_in_top_pct,
    is_in_bottom_pct,
)


def test_lookback_per_horizon() -> None:
    assert LOOKBACK_DAYS["7D"] == 30
    assert LOOKBACK_DAYS["30D"] == 180
    assert LOOKBACK_DAYS["90D"] == 365


def test_pct_rank_smallest_is_zero() -> None:
    series = [1.0, 2.0, 3.0, 4.0, 5.0]
    assert pct_rank(series, 1.0) == pytest.approx(0.0)


def test_pct_rank_largest_is_one() -> None:
    series = [1.0, 2.0, 3.0, 4.0, 5.0]
    assert pct_rank(series, 5.0) == pytest.approx(1.0)


def test_is_in_top_pct_threshold() -> None:
    series = list(range(100))
    assert is_in_top_pct(series, 95, top_pct=0.10) is True
    assert is_in_top_pct(series, 50, top_pct=0.10) is False


def test_is_in_bottom_pct_threshold() -> None:
    series = list(range(100))
    assert is_in_bottom_pct(series, 5, bottom_pct=0.20) is True
    assert is_in_bottom_pct(series, 50, bottom_pct=0.20) is False


def test_pct_rank_short_series_raises() -> None:
    with pytest.raises(ValueError):
        pct_rank([1.0], 0.5)


def test_pct_rank_clamps_above_max() -> None:
    """Codex review 1, must-fix #5: pct_rank must never exceed 1.0 even when
    the value lies strictly above every element of the series."""
    series = [1.0, 2.0, 3.0, 4.0, 5.0]
    assert pct_rank(series, 100.0) == pytest.approx(1.0)


def test_pct_rank_clamps_below_min() -> None:
    series = [1.0, 2.0, 3.0, 4.0, 5.0]
    assert pct_rank(series, -100.0) == pytest.approx(0.0)
