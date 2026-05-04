import pytest
from pathlib import Path

from producer.compose_backtest import compose_pivot_backtest_snapshot
from producer.fetch_binance import BinanceFetcher

FIXTURE_DIR = Path(__file__).parent / "fixtures" / "binance"
NOW_ISO = "2026-05-04T00:00:00Z"


@pytest.fixture
def fetcher() -> BinanceFetcher:
    canned = {
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


def test_backtest_emits_36_entries(fetcher: BinanceFetcher) -> None:
    snap = compose_pivot_backtest_snapshot(fetcher, generated_at=NOW_ISO)
    assert snap["schema_version"] == "v0.1"
    assert snap["generated_at"] == NOW_ISO
    # 2 assets × 3 horizons × 3 score_types × 2 thresholds = 36
    assert len(snap["entries"]) == 36
    keys = {
        (e["asset"], e["horizon"], e["score_type"], e["threshold"])
        for e in snap["entries"]
    }
    expected = {
        (a, h, st, t)
        for a in ("BTC", "ETH")
        for h in ("7D", "30D", "90D")
        for st in ("overall", "price_pivot", "volatility_pivot")
        for t in (70, 80)
    }
    assert keys == expected


def test_backtest_metrics_shape(fetcher: BinanceFetcher) -> None:
    snap = compose_pivot_backtest_snapshot(fetcher, generated_at=NOW_ISO)
    for e in snap["entries"]:
        m = e["metrics"]
        assert 0.0 <= m["precision"] <= 1.0
        assert 0.0 <= m["recall"] <= 1.0
        assert m["sample_size"] >= 0
        assert e["period"]["start"] != ""
        assert e["period"]["end"] != ""
