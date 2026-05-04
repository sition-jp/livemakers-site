"""Technical indicators in pure Python stdlib.

All functions accept plain lists/floats and return floats (or list[float] for
EMA/MACD series). Inputs are validated; series too short for the requested
period raise ValueError so the producer can downgrade Confidence rather than
emit garbage.
"""
from __future__ import annotations

import math
import statistics
from typing import Sequence


def _validate(series: Sequence[float], min_len: int, name: str) -> None:
    if len(series) < min_len:
        raise ValueError(
            f"{name} requires at least {min_len} points, got {len(series)}"
        )


def ema(series: Sequence[float], period: int) -> list[float]:
    _validate(series, period, "ema")
    k = 2.0 / (period + 1.0)
    out: list[float] = [series[0]]
    for x in series[1:]:
        out.append(out[-1] + k * (x - out[-1]))
    return out


def rsi(series: Sequence[float], period: int = 14) -> float:
    _validate(series, period + 1, "rsi")
    gains: list[float] = []
    losses: list[float] = []
    for i in range(1, len(series)):
        delta = series[i] - series[i - 1]
        gains.append(max(delta, 0.0))
        losses.append(max(-delta, 0.0))
    # Wilder's smoothing
    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period
    for i in range(period, len(gains)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period
    if avg_loss == 0.0 and avg_gain == 0.0:
        return 50.0
    if avg_loss == 0.0:
        return 100.0
    rs = avg_gain / avg_loss
    return 100.0 - 100.0 / (1.0 + rs)


def macd(
    series: Sequence[float],
    fast: int = 12,
    slow: int = 26,
    signal_period: int = 9,
) -> tuple[list[float], list[float], list[float]]:
    _validate(series, slow + signal_period, "macd")
    fast_ema = ema(series, fast)
    slow_ema = ema(series, slow)
    macd_line = [f - s for f, s in zip(fast_ema, slow_ema)]
    signal_line = ema(macd_line, signal_period)
    hist = [m - s for m, s in zip(macd_line, signal_line)]
    return macd_line, signal_line, hist


def atr(
    highs: Sequence[float],
    lows: Sequence[float],
    closes: Sequence[float],
    period: int = 14,
) -> float:
    _validate(closes, period + 1, "atr")
    trs: list[float] = []
    for i in range(1, len(closes)):
        tr = max(
            highs[i] - lows[i],
            abs(highs[i] - closes[i - 1]),
            abs(lows[i] - closes[i - 1]),
        )
        trs.append(tr)
    return sum(trs[-period:]) / period


def bollinger_band_width(
    closes: Sequence[float], period: int = 20, stddev: float = 2.0
) -> float:
    _validate(closes, period, "bollinger_band_width")
    window = closes[-period:]
    mean = sum(window) / period
    if period < 2:
        return 0.0
    variance = sum((x - mean) ** 2 for x in window) / (period - 1)
    sd = math.sqrt(variance)
    if mean == 0:
        return 0.0
    return (2.0 * stddev * sd) / mean


def moving_average(closes: Sequence[float], period: int) -> float:
    _validate(closes, period, "moving_average")
    return sum(closes[-period:]) / period


def realized_volatility(closes: Sequence[float], period: int = 30) -> float:
    _validate(closes, period + 1, "realized_volatility")
    rets: list[float] = []
    for i in range(len(closes) - period, len(closes)):
        if i == 0 or closes[i - 1] == 0:
            continue
        rets.append(math.log(closes[i] / closes[i - 1]))
    if len(rets) < 2:
        return 0.0
    return statistics.stdev(rets) * math.sqrt(365.0)


def distance_from_ma(closes: Sequence[float], period: int) -> float:
    _validate(closes, period, "distance_from_ma")
    ma = moving_average(closes, period)
    if ma == 0:
        return 0.0
    return (closes[-1] - ma) / ma
