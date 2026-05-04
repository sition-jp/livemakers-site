import math

import pytest

from producer.indicators import (
    rsi,
    macd,
    ema,
    atr,
    bollinger_band_width,
    moving_average,
    realized_volatility,
    distance_from_ma,
)


def test_rsi_constant_series_is_undefined_returns_50() -> None:
    # All deltas are zero → RS undefined; documented choice: return 50 (neutral).
    series = [100.0] * 30
    assert rsi(series, period=14) == pytest.approx(50.0)


def test_rsi_strong_uptrend_above_70() -> None:
    series = [100 + i for i in range(30)]
    assert rsi(series, period=14) > 70


def test_rsi_strong_downtrend_below_30() -> None:
    series = [100 - i for i in range(30)]
    assert rsi(series, period=14) < 30


def test_ema_smoke() -> None:
    series = [10.0] * 30
    out = ema(series, period=10)
    assert out[-1] == pytest.approx(10.0)


def test_macd_returns_three_aligned_series() -> None:
    series = [100 + i * 0.5 for i in range(60)]
    line, signal, hist = macd(series)
    assert len(line) == len(signal) == len(hist) == len(series)


def test_atr_positive_for_volatile_candles() -> None:
    highs = [101.0 + i * 0.5 for i in range(20)]
    lows = [99.0 + i * 0.5 for i in range(20)]
    closes = [100.0 + i * 0.5 for i in range(20)]
    val = atr(highs, lows, closes, period=14)
    assert val > 0


def test_bollinger_band_width_zero_for_flat_series() -> None:
    closes = [100.0] * 30
    assert bollinger_band_width(closes, period=20, stddev=2.0) == pytest.approx(0.0)


def test_moving_average_basic() -> None:
    closes = [1.0, 2.0, 3.0, 4.0, 5.0]
    assert moving_average(closes, period=5) == pytest.approx(3.0)


def test_realized_volatility_zero_for_flat() -> None:
    closes = [100.0] * 30
    assert realized_volatility(closes, period=30) == pytest.approx(0.0)


def test_distance_from_ma_signed_pct() -> None:
    closes = [10.0] * 19 + [11.0]
    # MA20 = (10*19 + 11) / 20 = 10.05; (11 - 10.05)/10.05 ≈ 0.0945
    d = distance_from_ma(closes, period=20)
    assert d == pytest.approx((11.0 - 10.05) / 10.05, rel=1e-6)


def test_indicator_short_series_raises() -> None:
    with pytest.raises(ValueError):
        rsi([1.0, 2.0], period=14)
