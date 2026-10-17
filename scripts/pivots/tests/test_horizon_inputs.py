import json
import random
from pathlib import Path

import pytest

from producer.compose_assets import (
    _AssetData,
    _build_market_context,
    _build_volatility_context,
)
from producer.compose_backtest import (
    _DerivAtT,
    _historical_scores,
    _precompute_asset_series,
)
from producer.horizon_inputs import (
    IT_2026_10_RULES,
    LEGACY_RULES,
    MA_DISTANCE_WINDOWS,
    RANGE_WINDOW_DAYS,
    RuleSet,
    near_range_boundary,
    range_compressed,
)
from producer.score_price_pivot import score_price_pivot
from producer.score_volatility_pivot import score_volatility_pivot

FIXTURE_DIR = Path(__file__).parent / "fixtures" / "binance"
HORIZONS = ("7D", "30D", "90D")


def _fixture_series():
    rows = json.loads((FIXTURE_DIR / "btcusdt_klines_1d_1500.json").read_text())
    closes = [float(r[4]) for r in rows]
    highs = [float(r[2]) for r in rows]
    lows = [float(r[3]) for r in rows]
    volumes = [float(r[5]) for r in rows]
    return closes, highs, lows, volumes


def _legacy_reference(closes, volumes, series, deriv, t, horizon):
    """Verbatim copy of the pre-it-2026-10 _historical_scores logic (MA20/MA50,
    30D window, absolute 5% compression)."""
    from producer.percentiles import LOOKBACK_DAYS

    rsi_t = series.rsi[t]
    macd_t = series.macd_hist_recent[t]
    if rsi_t is None or macd_t is None:
        return 0, 0, 0
    lookback = LOOKBACK_DAYS[horizon]

    def hist(s):
        return [x for x in s[max(0, t - lookback):t] if x is not None]

    d20h, d50h = hist(series.dist20), hist(series.dist50)
    rvh, bbh, atrh = hist(series.rv30), hist(series.bb), hist(series.atr14)
    if len(d20h) < 5 or len(rvh) < 5:
        return 0, 0, 0
    rv_t = series.rv30[t] or 0.5
    bb_t = series.bb[t] or 0.05
    atr_t = series.atr14[t] or 100.0
    if t >= 30:
        recent = closes[t - 29 : t + 1]
        near = closes[t] >= max(recent) * 0.98 or closes[t] <= min(recent) * 1.02
        rng = max(recent) - min(recent)
        avg = sum(recent) / 30
        comp = (rng / avg) < 0.05 if avg > 0 else False
    else:
        near, comp = False, False
    if t >= 31:
        va = sum(volumes[t - 30 : t]) / 30
        vr = volumes[t] / va if va > 0 else 1.0
    else:
        vr = 1.0
    d = deriv[t]
    pp, _ = score_price_pivot({
        "rsi_14": rsi_t,
        "distance_from_ma_20": series.dist20[t] or 0.0,
        "distance_from_ma_50": series.dist50[t] or 0.0,
        "distance_from_ma_20_history": d20h,
        "distance_from_ma_50_history": d50h,
        "macd_hist_recent": macd_t,
        "near_range_boundary": near,
    })
    vp, _ = score_volatility_pivot({
        "rv_30d": rv_t, "rv_30d_history": rvh, "bb_width": bb_t,
        "bb_width_history": bbh, "atr_now": atr_t,
        "atr_history": atrh if atrh else [atr_t],
        "oi_growth_pct": d.oi_growth_pct,
        "price_range_compression": comp,
        "abs_funding": d.abs_funding,
        "abs_funding_history": d.abs_funding_history,
        "volume_ratio_30d": vr,
    })
    return pp, vp, int(round(pp * 0.45 + vp * 0.45 + 60 * 0.10))


def _deriv_for(n, seed=1):
    rnd = random.Random(seed)
    return [
        _DerivAtT(
            oi_growth_pct=rnd.choice([0.0, 0.05, 0.15]),
            abs_funding=rnd.choice([0.0001, 0.001]),
            abs_funding_history=[0.0001 + 0.00001 * (i % 7) for i in range(180)],
        )
        for i in range(n)
    ]


def test_legacy_rules_reproduce_current_scores() -> None:
    closes, highs, lows, volumes = _fixture_series()
    series = _precompute_asset_series(closes, highs, lows)
    deriv = _deriv_for(len(closes))
    checked = 0
    for horizon in HORIZONS:
        for t in range(60, len(closes), 7):
            got = _historical_scores(closes, volumes, series, deriv, t, horizon, rules=LEGACY_RULES)
            assert got == _legacy_reference(closes, volumes, series, deriv, t, horizon), (horizon, t)
            checked += 1
    assert checked > 100


def test_ma_windows_differ_by_horizon() -> None:
    assert MA_DISTANCE_WINDOWS == {"7D": (10, 20), "30D": (20, 50), "90D": (50, 100)}
    closes, highs, lows, volumes = _fixture_series()
    series = _precompute_asset_series(closes, highs, lows)
    t = len(closes) // 2
    from producer.indicators import distance_from_ma

    assert series.dist10[t] == pytest.approx(distance_from_ma(closes[: t + 1], 10))
    assert series.dist100[t] == pytest.approx(distance_from_ma(closes[: t + 1], 100))
    assert series.dist10[8] is None and series.dist100[98] is None


def test_range_window_differs_by_horizon() -> None:
    assert RANGE_WINDOW_DAYS == {"7D": 14, "30D": 60, "90D": 120}  # it-2026-10 Task 6
    # 130 days: high 200 long ago, then a rise from 100 to 150 over the last 20 days.
    closes = [100.0] * 70 + [200.0] + [100.0] * 39 + [100.0 + 2.5 * i for i in range(1, 21)]
    t = len(closes) - 1  # 150: top of the 14D window, far below the 120D high of 200 (day 70)
    assert t >= RANGE_WINDOW_DAYS["90D"]  # False below comes from the high, not from t < window
    assert near_range_boundary(closes, t, "7D") is True
    assert near_range_boundary(closes, t, "90D") is False


def test_range_compressed_is_relative() -> None:
    rnd = random.Random(7)
    # A year of ordinary noise (30D range ~ 20-40% of mean), then a quiet 30 days (~8%).
    base = [100.0 + 15.0 * rnd.uniform(-1, 1) for _ in range(400)]
    quiet = [100.0 + 4.0 * rnd.uniform(-1, 1) for _ in range(30)]
    closes = base + quiet
    t = len(closes) - 1
    rng = max(quiet) - min(quiet)
    assert 0.05 < rng / (sum(quiet) / 30) < 0.12  # above the old fixed 5%
    assert range_compressed(closes, t) is True
    # The same quiet level is NOT compressed when the past year was just as quiet.
    calm = [100.0 + 4.0 * rnd.uniform(-1, 1) for _ in range(430)]
    assert range_compressed(calm, len(calm) - 1) is False


def test_range_compressed_false_without_history() -> None:
    closes = [100.0 + (i % 3) * 0.1 for i in range(40)]
    assert range_compressed(closes, len(closes) - 1) is False


def _asset_data(closes, volumes=None):
    n = len(closes)
    return _AssetData(
        closes=closes,
        highs=[c * 1.01 for c in closes],
        lows=[c * 0.99 for c in closes],
        volumes=volumes or [1.0] * n,
        oi=[], funding=[0.0001] * 200,
        global_long_short_ratio=[], top_trader_position_ratio=[], last_close_time=0,
    )


@pytest.mark.parametrize("horizon", HORIZONS)
def test_live_and_backtest_agree_on_boundary_and_compression(horizon) -> None:
    rnd = random.Random(11)
    closes = [100.0 + 15.0 * rnd.uniform(-1, 1) for _ in range(500)]
    closes += [100.0 + 3.0 * rnd.uniform(-1, 1) for _ in range(30)]
    data = _asset_data(closes)
    n = len(closes)
    live_mkt = _build_market_context(data, horizon)
    live_vol = _build_volatility_context(data, horizon)
    t = n - 1
    assert live_mkt["near_range_boundary"] == near_range_boundary(closes, t, horizon)
    assert live_vol["price_range_compression"] == range_compressed(closes, t)
    assert live_vol["price_range_compression"] is True

    # Backtest path: capture what _historical_scores feeds the scorers.
    import producer.compose_backtest as cb

    seen = {}
    real_pp, real_vp = cb.score_price_pivot, cb.score_volatility_pivot
    cb.score_price_pivot = lambda c: (seen.setdefault("m", c), real_pp(c))[1]
    cb.score_volatility_pivot = lambda c: (seen.setdefault("v", c), real_vp(c))[1]
    try:
        series = _precompute_asset_series(closes, data.highs, data.lows)
        _historical_scores(closes, data.volumes, series, _deriv_for(n), t, horizon)
    finally:
        cb.score_price_pivot, cb.score_volatility_pivot = real_pp, real_vp
    assert seen["m"]["near_range_boundary"] == live_mkt["near_range_boundary"]
    assert seen["v"]["price_range_compression"] == live_vol["price_range_compression"]
    # Horizon-specific MA distances agree as well.
    assert seen["m"]["distance_from_ma_20"] == pytest.approx(live_mkt["distance_from_ma_20"])
    assert seen["m"]["distance_from_ma_50"] == pytest.approx(live_mkt["distance_from_ma_50"])


def test_live_ma_distance_uses_horizon_windows() -> None:
    from producer.indicators import distance_from_ma

    rnd = random.Random(3)
    closes = [100.0 + 10.0 * rnd.uniform(-1, 1) for _ in range(600)]
    data = _asset_data(closes)
    for horizon, (short, long_) in MA_DISTANCE_WINDOWS.items():
        ctx = _build_market_context(data, horizon)
        assert ctx["distance_from_ma_20"] == pytest.approx(distance_from_ma(closes, short))
        assert ctx["distance_from_ma_50"] == pytest.approx(distance_from_ma(closes, long_))


def test_ruleset_presets() -> None:
    assert LEGACY_RULES == RuleSet(False, False, False)
    assert IT_2026_10_RULES == RuleSet(True, True, True)
