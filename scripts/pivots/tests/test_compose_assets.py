import json
from pathlib import Path

import pytest

from producer.compose_assets import compose_pivot_assets_snapshot
from producer.fetch_binance import BinanceFetcher

FIXTURE_DIR = Path(__file__).parent / "fixtures" / "binance"
NOW_ISO = "2026-05-04T00:00:00Z"
LONG_SHORT_CROWDED_MESSAGE = (
    "Long/short positioning is crowded, increasing squeeze sensitivity"
)
TOP_TRADER_DIVERGENCE_MESSAGE = (
    "Top trader positioning diverges from broader account positioning"
)
DERIVATIVES_OI_MESSAGE = "Open Interest expanded while price stayed range-bound"
DERIVATIVES_FUNDING_MESSAGE = "Funding is skewed versus recent history"


@pytest.fixture
def fetcher() -> BinanceFetcher:
    canned: dict[str, bytes] = {
        "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=1500": (
            FIXTURE_DIR / "btcusdt_klines_1d_1500.json"
        ).read_bytes(),
        "https://api.binance.com/api/v3/klines?symbol=ETHUSDT&interval=1d&limit=1500": (
            FIXTURE_DIR / "ethusdt_klines_1d_1500.json"
        ).read_bytes(),
        "https://fapi.binance.com/futures/data/openInterestHist?symbol=BTCUSDT&period=4h&limit=180": (
            FIXTURE_DIR / "btcusdt_oi_4h_180.json"
        ).read_bytes(),
        "https://fapi.binance.com/futures/data/openInterestHist?symbol=ETHUSDT&period=4h&limit=180": (
            FIXTURE_DIR / "ethusdt_oi_4h_180.json"
        ).read_bytes(),
        "https://fapi.binance.com/fapi/v1/fundingRate?symbol=BTCUSDT&limit=1000": (
            FIXTURE_DIR / "btcusdt_funding_1000.json"
        ).read_bytes(),
        "https://fapi.binance.com/fapi/v1/fundingRate?symbol=ETHUSDT&limit=1000": (
            FIXTURE_DIR / "ethusdt_funding_1000.json"
        ).read_bytes(),
    }
    return BinanceFetcher(http_get=lambda url: canned[url])


def test_snapshot_top_level_shape(fetcher: BinanceFetcher) -> None:
    snap = compose_pivot_assets_snapshot(fetcher, generated_at=NOW_ISO)
    assert snap["schema_version"] == "v0.1"
    assert snap["generated_at"] == NOW_ISO
    radar_symbols = {a["symbol"] for a in snap["radar"]}
    assert radar_symbols == {"BTC", "ETH"}


def test_snapshot_detail_keys_complete(fetcher: BinanceFetcher) -> None:
    snap = compose_pivot_assets_snapshot(fetcher, generated_at=NOW_ISO)
    expected = {f"{a}__{h}" for a in ("BTC", "ETH") for h in ("7D", "30D", "90D")}
    assert set(snap["detail"].keys()) == expected


def test_snapshot_direction_bias_sum_invariant(fetcher: BinanceFetcher) -> None:
    snap = compose_pivot_assets_snapshot(fetcher, generated_at=NOW_ISO)
    for key, detail in snap["detail"].items():
        bias = detail["direction_bias"]
        s = bias["bullish"] + bias["bearish"] + bias["neutral"]
        assert abs(s - 100.0) <= 0.5, f"{key}: sum={s}"


def test_snapshot_score_ranges(fetcher: BinanceFetcher) -> None:
    snap = compose_pivot_assets_snapshot(fetcher, generated_at=NOW_ISO)
    for detail in snap["detail"].values():
        s = detail["scores"]
        assert 0 <= s["overall"] <= 100
        assert 0 <= s["price_pivot"] <= 100
        assert 0 <= s["volatility_pivot"] <= 100
        assert s["confidence"]["grade"] in ("A", "B+", "B", "C")
        assert 0 <= s["confidence"]["score"] <= 100


def test_snapshot_confidence_uses_backtest_quality_override(
    fetcher: BinanceFetcher,
) -> None:
    low = compose_pivot_assets_snapshot(
        fetcher,
        generated_at=NOW_ISO,
        backtest_quality_by_key={("BTC", "7D"): 0.0},
    )
    high = compose_pivot_assets_snapshot(
        fetcher,
        generated_at=NOW_ISO,
        backtest_quality_by_key={("BTC", "7D"): 100.0},
    )
    low_score = low["detail"]["BTC__7D"]["scores"]["confidence"]["score"]
    high_score = high["detail"]["BTC__7D"]["scores"]["confidence"]["score"]
    assert high_score > low_score


def _core_canned() -> dict[str, bytes]:
    return {
        "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=1500": (
            FIXTURE_DIR / "btcusdt_klines_1d_1500.json"
        ).read_bytes(),
        "https://api.binance.com/api/v3/klines?symbol=ETHUSDT&interval=1d&limit=1500": (
            FIXTURE_DIR / "ethusdt_klines_1d_1500.json"
        ).read_bytes(),
        "https://fapi.binance.com/futures/data/openInterestHist?symbol=BTCUSDT&period=4h&limit=180": (
            FIXTURE_DIR / "btcusdt_oi_4h_180.json"
        ).read_bytes(),
        "https://fapi.binance.com/futures/data/openInterestHist?symbol=ETHUSDT&period=4h&limit=180": (
            FIXTURE_DIR / "ethusdt_oi_4h_180.json"
        ).read_bytes(),
        "https://fapi.binance.com/fapi/v1/fundingRate?symbol=BTCUSDT&limit=1000": (
            FIXTURE_DIR / "btcusdt_funding_1000.json"
        ).read_bytes(),
        "https://fapi.binance.com/fapi/v1/fundingRate?symbol=ETHUSDT&limit=1000": (
            FIXTURE_DIR / "ethusdt_funding_1000.json"
        ).read_bytes(),
    }


def _ratio_payload(values: list[float]) -> bytes:
    rows = [
        {
            "symbol": "BTCUSDT",
            "longAccount": "0.7000",
            "shortAccount": "0.3000",
            "longShortRatio": f"{value:.4f}",
            "timestamp": str(1717200000000 + i * 86_400_000),
        }
        for i, value in enumerate(values)
    ]
    return json.dumps(rows).encode()


def test_snapshot_appends_derivatives_evidence_without_changing_scores() -> None:
    core = _core_canned()
    base = compose_pivot_assets_snapshot(
        BinanceFetcher(http_get=lambda url: core[url]),
        generated_at=NOW_ISO,
    )

    rich_canned = dict(core)
    for symbol in ("BTCUSDT", "ETHUSDT"):
        rich_canned[
            "https://fapi.binance.com/futures/data/globalLongShortAccountRatio"
            f"?symbol={symbol}&period=1d&limit=30"
        ] = _ratio_payload([1.0, 1.1, 1.2, 2.4, 2.4])
        rich_canned[
            "https://fapi.binance.com/futures/data/topLongShortPositionRatio"
            f"?symbol={symbol}&period=1d&limit=30"
        ] = _ratio_payload([1.0, 1.1, 1.2, 1.2, 1.2])

    rich = compose_pivot_assets_snapshot(
        BinanceFetcher(http_get=lambda url: rich_canned[url]),
        generated_at=NOW_ISO,
    )

    for key in base["detail"]:
        assert rich["detail"][key]["scores"] == base["detail"][key]["scores"]

    btc_7d_messages = {
        item["message"] for item in rich["detail"]["BTC__7D"]["evidence"]
    }
    btc_7d_all_messages = [
        item["message"] for item in rich["detail"]["BTC__7D"]["evidence"]
    ]
    assert len(btc_7d_all_messages) == len(set(btc_7d_all_messages))
    assert LONG_SHORT_CROWDED_MESSAGE in btc_7d_messages
    assert TOP_TRADER_DIVERGENCE_MESSAGE in btc_7d_messages

    for detail in rich["detail"].values():
        messages = {item["message"] for item in detail["evidence"]}
        assert DERIVATIVES_OI_MESSAGE not in messages
        assert DERIVATIVES_FUNDING_MESSAGE not in messages


def test_snapshot_ignores_still_forming_long_short_bucket() -> None:
    core = _core_canned()
    canned = dict(core)
    for symbol in ("BTCUSDT", "ETHUSDT"):
        canned[
            "https://fapi.binance.com/futures/data/globalLongShortAccountRatio"
            f"?symbol={symbol}&period=1d&limit=30"
        ] = _ratio_payload([1.0, 1.1, 1.2, 1.4, 2.4])
        canned[
            "https://fapi.binance.com/futures/data/topLongShortPositionRatio"
            f"?symbol={symbol}&period=1d&limit=30"
        ] = _ratio_payload([1.0, 1.1, 1.2, 1.2, 1.2])

    snap = compose_pivot_assets_snapshot(
        BinanceFetcher(http_get=lambda url: canned[url]), generated_at=NOW_ISO
    )

    messages = {
        item["message"] for item in snap["detail"]["BTC__7D"]["evidence"]
    }
    assert LONG_SHORT_CROWDED_MESSAGE not in messages
    assert TOP_TRADER_DIVERGENCE_MESSAGE not in messages


def test_optional_long_short_failure_does_not_fail_snapshot() -> None:
    core = _core_canned()
    base = compose_pivot_assets_snapshot(
        BinanceFetcher(http_get=lambda url: core[url]), generated_at=NOW_ISO
    )

    def _http_get(url: str) -> bytes:
        if "LongShort" in url or "topLongShort" in url:
            raise OSError("optional endpoint down")
        return core[url]

    snap = compose_pivot_assets_snapshot(
        BinanceFetcher(http_get=_http_get), generated_at=NOW_ISO
    )

    assert snap["schema_version"] == "v0.1"
    assert set(snap["detail"]) == {
        "BTC__7D",
        "BTC__30D",
        "BTC__90D",
        "ETH__7D",
        "ETH__30D",
        "ETH__90D",
    }
    assert snap["radar"] == base["radar"]
    for key, detail in snap["detail"].items():
        assert detail["scores"] == base["detail"][key]["scores"]
        assert detail["direction_bias"] == base["detail"][key]["direction_bias"]
        messages = {item["message"] for item in detail["evidence"]}
        assert LONG_SHORT_CROWDED_MESSAGE not in messages
        assert TOP_TRADER_DIVERGENCE_MESSAGE not in messages


# --- it-2026-10 Task 1: live volatility histories must exclude the current bar ---

def _vol_series(last_high_bump: float = 6.0):
    """400 daily bars: wide ranges early (high ATR), narrow later, spike on the last bar."""
    from producer.compose_assets import _AssetData

    n = 400
    closes = [100.0 + (i % 7) * 0.3 for i in range(n)]
    half = [5.0 if i < 300 else 1.0 for i in range(n)]
    highs = [c + h for c, h in zip(closes, half)]
    lows = [c - h for c, h in zip(closes, half)]
    highs[-1] = closes[-1] + last_high_bump
    lows[-1] = closes[-1] - 0.0
    return _AssetData(
        closes=closes, highs=highs, lows=lows, volumes=[1.0] * n,
        oi=[], funding=[0.0001 + 0.00001 * (i % 5) for i in range(200)],
        global_long_short_ratio=[],
        top_trader_position_ratio=[], last_close_time=0,
    )


def test_volatility_history_excludes_current_bar() -> None:
    from producer.compose_assets import _build_volatility_context
    from producer.indicators import atr, bollinger_band_width, realized_volatility
    from producer.percentiles import LOOKBACK_DAYS

    data = _vol_series()
    horizon = next(iter(LOOKBACK_DAYS))
    ctx = _build_volatility_context(data, horizon)
    c, h, l = data.closes, data.highs, data.lows
    # Last element == previous bar's value, NOT the current one.
    assert ctx["atr_history"][-1] == pytest.approx(atr(h[:-1], l[:-1], c[:-1], 14))
    assert ctx["atr_history"][-1] != pytest.approx(ctx["atr_now"])
    assert ctx["rv_30d_history"][-1] == pytest.approx(realized_volatility(c[:-1], 30))
    assert ctx["bb_width_history"][-1] == pytest.approx(bollinger_band_width(c[:-1], 20))
    assert len(ctx["atr_history"]) == LOOKBACK_DAYS[horizon]


def test_atr_rising_rule_can_fire_live() -> None:
    from producer.compose_assets import _build_volatility_context
    from producer.score_volatility_pivot import score_volatility_pivot

    data = _vol_series()
    horizon = "90D"  # long lookback so yesterday's ATR ranks low vs the wide-range era
    ctx = _build_volatility_context(data, horizon)
    assert ctx["atr_now"] > ctx["atr_history"][-1] * 1.10
    _score, evidence = score_volatility_pivot(ctx)
    messages = [e["message"] for e in evidence]
    assert "ATR is rising from a low-volatility area" in messages


# --- it-2026-10 final review A1: live MA-distance history excludes current bar ---

def _price_series():
    import math

    from producer.compose_assets import _AssetData

    n = 500
    closes = [100.0 + 20 * math.sin(i / 17.0) + i * 0.05 + (i % 5) * 0.4 for i in range(n)]
    return _AssetData(
        closes=closes, highs=[c + 1 for c in closes], lows=[c - 1 for c in closes],
        volumes=[1.0] * n, oi=[], funding=[], global_long_short_ratio=[],
        top_trader_position_ratio=[], last_close_time=0,
    )


@pytest.mark.parametrize("horizon", ["7D", "30D", "90D"])
def test_ma_distance_history_matches_backtest_slice(horizon: str) -> None:
    from producer.compose_assets import _build_market_context
    from producer.compose_backtest import _precompute_asset_series, _slice_history
    from producer.percentiles import LOOKBACK_DAYS
    from producer.horizon_inputs import IT_2026_10_RULES, ma_windows

    data = _price_series()
    ctx = _build_market_context(data, horizon)
    series = _precompute_asset_series(data.closes, data.highs, data.lows)
    by_window = {10: series.dist10, 20: series.dist20, 50: series.dist50, 100: series.dist100}
    short_w, long_w = ma_windows(horizon, IT_2026_10_RULES)
    t = len(data.closes) - 1
    lb = LOOKBACK_DAYS[horizon]
    for key, w in (("distance_from_ma_20_history", short_w), ("distance_from_ma_50_history", long_w)):
        expected = _slice_history(by_window[w], t, lb)
        assert len(ctx[key]) == lb
        assert ctx[key][-1] == pytest.approx(expected[-1])
        assert ctx[key] == pytest.approx(expected)


@pytest.mark.parametrize("horizon", ["7D", "30D", "90D"])
def test_live_and_backtest_price_pivot_agree_on_final_day(horizon: str) -> None:
    from producer.compose_assets import _build_market_context
    from producer.compose_backtest import _DerivAtT, _historical_scores, _precompute_asset_series
    from producer.score_price_pivot import score_price_pivot

    data = _price_series()
    live_pp, _ = score_price_pivot(_build_market_context(data, horizon))
    series = _precompute_asset_series(data.closes, data.highs, data.lows)
    deriv = [_DerivAtT(0.0, 0.0, [0.0, 0.1, 0.2])] * len(data.closes)
    t = len(data.closes) - 1
    bt_pp, _vp, _ov = _historical_scores(
        data.closes, data.volumes, series, deriv, t, horizon
    )
    assert live_pp == bt_pp
