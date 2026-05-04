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


def test_at_least_some_entries_have_nonzero_sample_size(
    fetcher: BinanceFetcher,
) -> None:
    """Codex review 3 blocking-issue regression: real sliding-window context
    in _historical_score() must let scores actually cross thresholds 70/80
    at SOME (asset, horizon, score_type, threshold) tuples. A return where
    every entry has sample_size=0 means the backtest pipeline is
    structurally inert and the Backtest UI is functionally empty.

    On the test fixture (~400 daily candles per asset) we expect:
    - price_pivot to fire on all 12 tuples
    - volatility_pivot to fire on most tuples (11+/12)
    - overall to be structurally capped (pp/vp anticorrelation prevents
      pp+vp ≥ 143 on this fixture; documented v0.1 known limit)

    Total expectation: ≥ 18 of 36 entries with sample_size > 0.
    """
    snap = compose_pivot_backtest_snapshot(fetcher, generated_at=NOW_ISO)
    nonzero = [e for e in snap["entries"] if e["metrics"]["sample_size"] > 0]
    assert len(nonzero) >= 18, (
        f"only {len(nonzero)}/36 entries have sample_size > 0 — "
        f"backtest pipeline appears structurally inert"
    )

    # Per-score-type expectations.
    by_st: dict[str, list[int]] = {}
    for e in snap["entries"]:
        by_st.setdefault(e["score_type"], []).append(e["metrics"]["sample_size"])
    nz_pp = sum(1 for s in by_st["price_pivot"] if s > 0)
    nz_vp = sum(1 for s in by_st["volatility_pivot"] if s > 0)
    assert nz_pp >= 8, (
        f"price_pivot fires on only {nz_pp}/12 tuples — pp scoring path looks broken"
    )
    assert nz_vp >= 6, (
        f"volatility_pivot fires on only {nz_vp}/12 tuples — vp scoring path looks broken"
    )
