import json
from pathlib import Path

import pytest

from producer.fetch_binance import (
    BinanceFetcher,
    Candle,
    FundingPoint,
    LongShortRatioPoint,
    OpenInterestPoint,
    TopTraderPositionRatioPoint,
)

FIXTURE_DIR = Path(__file__).parent / "fixtures" / "binance"


def _load(name: str) -> bytes:
    return (FIXTURE_DIR / name).read_bytes()


@pytest.fixture
def fetcher() -> BinanceFetcher:
    canned: dict[str, bytes] = {
        "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=1500": _load(
            "btcusdt_klines_1d_1500.json"
        ),
        "https://fapi.binance.com/futures/data/openInterestHist?symbol=BTCUSDT&period=4h&limit=180": _load(
            "btcusdt_oi_4h_180.json"
        ),
        "https://fapi.binance.com/fapi/v1/fundingRate?symbol=BTCUSDT&limit=1000": _load(
            "btcusdt_funding_1000.json"
        ),
    }

    def _http_get(url: str) -> bytes:
        return canned[url]

    return BinanceFetcher(http_get=_http_get)


def test_fetch_klines_returns_typed_candles(fetcher: BinanceFetcher) -> None:
    candles = fetcher.fetch_klines("BTC", interval="1d", limit=1500)
    assert len(candles) > 100
    c0 = candles[0]
    assert isinstance(c0, Candle)
    assert c0.open > 0
    assert c0.close > 0
    assert c0.volume >= 0
    # Monotonically increasing timestamps (Binance returns oldest-first).
    assert all(
        candles[i].open_time < candles[i + 1].open_time
        for i in range(len(candles) - 1)
    )


def test_fetch_open_interest_returns_typed_points(
    fetcher: BinanceFetcher,
) -> None:
    # Binance documents a 30-day lookback cap on openInterestHist, so we ask
    # for 4h granularity with limit=180 (covers the full 30-day window).
    pts = fetcher.fetch_open_interest("BTC", period="4h", limit=180)
    assert len(pts) >= 100  # 30 days × 6 buckets/day = 180 expected; allow venue jitter
    p0 = pts[0]
    assert isinstance(p0, OpenInterestPoint)
    assert p0.open_interest > 0


def test_fetch_funding_returns_typed_points(fetcher: BinanceFetcher) -> None:
    pts = fetcher.fetch_funding("BTC", limit=1000)
    assert len(pts) > 50
    p0 = pts[0]
    assert isinstance(p0, FundingPoint)
    assert -1.0 < p0.funding_rate < 1.0  # sanity, never out of range


def test_fetch_global_long_short_ratio_returns_typed_points() -> None:
    captured: list[str] = []
    payload = json.dumps(
        [
            {
                "symbol": "BTCUSDT",
                "longAccount": "0.6250",
                "longShortRatio": "1.6667",
                "shortAccount": "0.3750",
                "timestamp": "1717200000000",
            }
        ]
    ).encode()

    def _http_get(url: str) -> bytes:
        captured.append(url)
        return payload

    pts = BinanceFetcher(http_get=_http_get).fetch_global_long_short_ratio(
        "BTC", period="1d", limit=30
    )

    assert captured == [
        "https://fapi.binance.com/futures/data/globalLongShortAccountRatio"
        "?symbol=BTCUSDT&period=1d&limit=30"
    ]
    assert pts == [
        LongShortRatioPoint(
            timestamp=1717200000000,
            long_short_ratio=1.6667,
            long_account=0.6250,
            short_account=0.3750,
        )
    ]


def test_fetch_top_trader_position_ratio_returns_typed_points() -> None:
    captured: list[str] = []
    payload = json.dumps(
        [
            {
                "symbol": "ETHUSDT",
                "longAccount": "0.7000",
                "longShortRatio": "2.3333",
                "shortAccount": "0.3000",
                "timestamp": "1717200000000",
            }
        ]
    ).encode()

    def _http_get(url: str) -> bytes:
        captured.append(url)
        return payload

    pts = BinanceFetcher(
        http_get=_http_get
    ).fetch_top_trader_long_short_position_ratio("ETH", period="1d", limit=30)

    assert captured == [
        "https://fapi.binance.com/futures/data/topLongShortPositionRatio"
        "?symbol=ETHUSDT&period=1d&limit=30"
    ]
    assert pts == [
        TopTraderPositionRatioPoint(
            timestamp=1717200000000,
            long_short_ratio=2.3333,
            long_account=0.7000,
            short_account=0.3000,
        )
    ]


def test_unknown_symbol_raises() -> None:
    f = BinanceFetcher(http_get=lambda _: b"[]")
    with pytest.raises(ValueError, match="unsupported asset"):
        f.fetch_klines("DOGE")  # type: ignore[arg-type]


def test_http_failure_propagates() -> None:
    def _broken(_url: str) -> bytes:
        raise OSError("network down")

    f = BinanceFetcher(http_get=_broken)
    with pytest.raises(OSError, match="network down"):
        f.fetch_klines("BTC")


def test_fetch_klines_range_pages_from_start_time() -> None:
    def row(t: int):
        return [t, "1", "2", "0.5", "1.5", "10", t + 86_399_999, "0", 1, "0", "0", "0"]

    page1 = [row(1_700_000_000_000 + i * 86_400_000) for i in range(1500)]
    page2 = [row(1_700_000_000_000 + i * 86_400_000) for i in range(1500, 1650)]
    calls: list[str] = []

    def http_get(url: str) -> bytes:
        calls.append(url)
        return json.dumps(page1 if "startTime=1700000000000" in url else page2).encode()

    fetcher = BinanceFetcher(http_get=http_get)
    candles = fetcher.fetch_klines_range("BTC", start_ms=1_700_000_000_000, page_limit=1500)
    assert len(calls) == 2 and "limit=1500" in calls[0]
    assert len(candles) == 1650
    assert candles[0].open_time == 1_700_000_000_000
    assert all(candles[i].open_time < candles[i + 1].open_time for i in range(len(candles) - 1))


def test_fetch_klines_range_default_limit_is_api_max() -> None:
    def row(t: int):
        return [t, "1", "2", "0.5", "1.5", "10", t + 86_399_999, "0", 1, "0", "0", "0"]

    page1 = [row(1_700_000_000_000 + i * 86_400_000) for i in range(1000)]
    page2 = [row(1_700_000_000_000 + i * 86_400_000) for i in range(1000, 1500)]
    calls: list[str] = []

    def http_get(url: str) -> bytes:
        calls.append(url)
        return json.dumps(page1 if "startTime=1700000000000" in url else page2).encode()

    fetcher = BinanceFetcher(http_get=http_get)
    candles = fetcher.fetch_klines_range("BTC", start_ms=1_700_000_000_000)
    assert len(calls) == 2 and "limit=1000" in calls[0]
    assert len(candles) == 1500
    assert candles[0].open_time == 1_700_000_000_000
    assert all(candles[i].open_time < candles[i + 1].open_time for i in range(len(candles) - 1))
