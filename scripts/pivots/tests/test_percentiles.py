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


def test_pct_rank_smallest_returns_low_rank() -> None:
    # Mid-rank: smallest distinct value gives (0 + 0.5*1) / 5 = 0.1
    series = [1.0, 2.0, 3.0, 4.0, 5.0]
    assert pct_rank(series, 1.0) == pytest.approx(0.1)


def test_pct_rank_largest_returns_high_rank() -> None:
    # Mid-rank: largest distinct value gives (4 + 0.5*1) / 5 = 0.9
    series = [1.0, 2.0, 3.0, 4.0, 5.0]
    assert pct_rank(series, 5.0) == pytest.approx(0.9)


def test_pct_rank_constant_series_value_in_set_returns_half() -> None:
    """Mid-rank: a value tied with all history elements is neither bottom
    nor top — it's mid by symmetry. This prevents constant history fixtures
    from falsely triggering bottom-pct / top-pct rules in the scorers."""
    series = [0.5] * 50
    assert pct_rank(series, 0.5) == pytest.approx(0.5)


def test_is_in_top_pct_threshold() -> None:
    series = list(range(100))
    # value=95: (95 + 0.5) / 100 = 0.955 ≥ 0.90 → True
    assert is_in_top_pct(series, 95, top_pct=0.10) is True
    # value=50: 0.505 ≥ 0.90 → False
    assert is_in_top_pct(series, 50, top_pct=0.10) is False


def test_is_in_bottom_pct_threshold() -> None:
    series = list(range(100))
    # value=5: (5 + 0.5) / 100 = 0.055 ≤ 0.20 → True
    assert is_in_bottom_pct(series, 5, bottom_pct=0.20) is True
    # value=50: 0.505 ≤ 0.20 → False
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
