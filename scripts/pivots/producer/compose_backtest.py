"""Compose PivotBacktestSnapshot — 36 entries (2×3×3×2).

Provisional v0.1: the historical scoring path uses simplified contexts
(neutral defaults for distance histories, OI growth, funding percentiles,
etc.). Only RSI- and MACD-driven contributions exercise the scorers in this
pass. Consequently the entries are structurally complete (all 36 tuples
present, schema valid) but the precision/recall numbers are biased and
should be treated as a shape-and-pipeline smoke test rather than a tunable
performance benchmark. v0.2 will rebuild proper sliding-window contexts.
"""
from __future__ import annotations

from datetime import datetime, timezone

from producer.backtest import (
    HIT_DEFINITIONS,
    Signal,
    compute_metrics,
    detect_hit,
    forward_move,
)
from producer.fetch_binance import BinanceFetcher
from producer.indicators import macd, rsi
from producer.score_price_pivot import score_price_pivot
from producer.score_volatility_pivot import score_volatility_pivot
from producer.types import (
    ASSETS,
    HORIZONS,
    SCORE_TYPES,
    THRESHOLDS,
    AssetSymbol,
    BacktestEntry,
    Horizon,
    PivotBacktestSnapshot,
    ScoreType,
)

# Backtest window: last 5 years of daily candles (sufficient for v0.1 or as
# many as the fixture provides).
BACKTEST_LOOKBACK_DAYS = 365 * 5


def _historical_score(
    closes: list[float],
    highs: list[float],
    lows: list[float],
    volumes: list[float],
    funding: list[float],
    oi: list[float],
    t: int,
    score_type: ScoreType,
) -> int:
    """Compute scores using only data available at time t (no look-ahead).

    Provisional v0.1: simplified contexts. See module docstring.
    """
    if t < 60:
        return 0
    sub_closes = closes[: t + 1]
    try:
        rsi_val = rsi(sub_closes, 14)
        _, _, hist = macd(sub_closes)
    except ValueError:
        return 0
    pp, _ = score_price_pivot({
        "rsi_14": rsi_val,
        "distance_from_ma_20": 0.0,
        "distance_from_ma_50": 0.0,
        "distance_from_ma_20_history": [0.0] * 50,
        "distance_from_ma_50_history": [0.0] * 50,
        "macd_hist_recent": hist[-5:],
        "near_range_boundary": False,
    })
    vp, _ = score_volatility_pivot({
        "rv_30d": 0.5,
        "rv_30d_history": [0.5] * 50,
        "bb_width": 0.05,
        "bb_width_history": [0.05] * 50,
        "atr_now": 100.0,
        "atr_history": [100.0] * 50,
        "oi_growth_pct": 0.0,
        "price_range_compression": False,
        "abs_funding": 0.0001,
        "abs_funding_history": [0.0001] * 50,
        "volume_ratio_30d": 1.0,
    })
    overall = int(round(pp * 0.45 + vp * 0.45 + 60 * 0.10))
    if score_type == "price_pivot":
        return pp
    if score_type == "volatility_pivot":
        return vp
    return overall


def _walk_backtest(
    asset_data, horizon: Horizon, score_type: ScoreType, threshold: int
) -> tuple[list[Signal], int]:
    closes = asset_data["closes"]
    hd = HIT_DEFINITIONS[horizon]
    start_idx = max(60, len(closes) - BACKTEST_LOOKBACK_DAYS)
    signals: list[Signal] = []
    in_signal = False
    total_reversals = 0
    for t in range(start_idx, len(closes) - hd.horizon_days):
        score = _historical_score(
            closes, asset_data["highs"], asset_data["lows"],
            asset_data["volumes"], asset_data["funding"], asset_data["oi"],
            t, score_type,
        )
        if score >= threshold and not in_signal:
            in_signal = True
            hit = detect_hit(closes, t, hd)
            signals.append(Signal(
                index=t, score=score, hit=hit,
                forward_move=forward_move(closes, t, hd),
            ))
        elif score < threshold:
            in_signal = False
        # Count any window where a true reversal happened (for recall denom).
        if detect_hit(closes, t, hd):
            total_reversals += 1
    return signals, total_reversals


def _isoformat_from_ms(ms: int) -> str:
    return datetime.fromtimestamp(ms / 1000.0, tz=timezone.utc).date().isoformat()


def compose_pivot_backtest_snapshot(
    fetcher: BinanceFetcher, generated_at: str
) -> PivotBacktestSnapshot:
    asset_payloads = {}
    for a in ASSETS:
        klines = fetcher.fetch_klines(a, interval="1d", limit=1500)
        oi = fetcher.fetch_open_interest(a, period="4h", limit=180)
        funding = fetcher.fetch_funding(a, limit=1000)
        asset_payloads[a] = {
            "closes": [c.close for c in klines],
            "highs": [c.high for c in klines],
            "lows": [c.low for c in klines],
            "volumes": [c.volume for c in klines],
            "oi": [p.open_interest for p in oi],
            "funding": [p.funding_rate for p in funding],
            "first_open_time": klines[0].open_time,
            "last_close_time": klines[-1].close_time,
        }

    entries: list[BacktestEntry] = []
    for a in ASSETS:
        data = asset_payloads[a]
        for h in HORIZONS:
            for st in SCORE_TYPES:
                for thr in THRESHOLDS:
                    signals, total_reversals = _walk_backtest(data, h, st, thr)
                    metrics = compute_metrics(signals, total_reversals)
                    entries.append({
                        "asset": a,
                        "horizon": h,
                        "score_type": st,
                        "threshold": thr,
                        "period": {
                            "start": _isoformat_from_ms(data["first_open_time"]),
                            "end": _isoformat_from_ms(data["last_close_time"]),
                        },
                        "metrics": metrics,
                    })
    return {
        "schema_version": "v0.1",
        "generated_at": generated_at,
        "entries": entries,
    }
