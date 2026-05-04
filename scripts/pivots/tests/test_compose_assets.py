import json
from pathlib import Path

import pytest

from producer.compose_assets import compose_pivot_assets_snapshot
from producer.fetch_binance import BinanceFetcher

FIXTURE_DIR = Path(__file__).parent / "fixtures" / "binance"
NOW_ISO = "2026-05-04T00:00:00Z"


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
