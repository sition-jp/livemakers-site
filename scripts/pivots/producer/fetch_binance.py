"""Binance public REST clients for OHLCV / Open Interest / Funding.

All endpoints used here are documented public + free + auth-less:
- spot klines:    https://api.binance.com/api/v3/klines
- futures OI:     https://fapi.binance.com/futures/data/openInterestHist
- futures funding: https://fapi.binance.com/fapi/v1/fundingRate
- futures global long/short account ratio:
  https://fapi.binance.com/futures/data/globalLongShortAccountRatio
- futures top trader long/short position ratio:
  https://fapi.binance.com/futures/data/topLongShortPositionRatio

The fetcher takes an injectable http_get callable so tests can inject
recorded bytes; production passes the default urllib-based client.
"""
from __future__ import annotations

import http.client
import json
import ssl
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Callable, Literal

from producer.types import AssetSymbol

_SYMBOL_MAP: dict[str, str] = {"BTC": "BTCUSDT", "ETH": "ETHUSDT"}

# Binance's spot /api/v3/klines endpoint silently caps `limit` at 1000 rows
# even though the documented max used to read 1500 — a request for more than
# 1000 is honored but truncated to 1000 with no error, so a page_limit above
# this value makes fetch_klines_range's "short page" end-of-data check fire
# after the very first page and silently truncate the series.
BINANCE_KLINES_MAX_LIMIT = 1000

HttpGet = Callable[[str], bytes]


# Waits between attempts of one request on a transient network error (3 attempts in all).
# Longer outages (e.g. DNS not ready right after the Mac wakes at 08:00) are covered by
# the whole-run retry in ops.run_daily.
FETCH_RETRY_WAITS_SECONDS: tuple[float, ...] = (2.0, 5.0)
# Printed by run_producer when a run failed because of the network (ops.run_daily retries on it).
NETWORK_FAILURE_MARKER = "[pivots-producer] failure_class=network"
_TRANSIENT_HTTP_CODES = frozenset({429, 500, 502, 503, 504})


def is_transient_network_error(exc: BaseException) -> bool:
    """True for errors worth retrying: DNS / connection / timeout / dropped or cut-off
    responses / TLS read errors, HTTP 429 and 5xx.

    Any other URLError (e.g. a certificate error) also counts: right after the Mac wakes,
    an unsynced clock can make those temporary too.
    """
    if isinstance(exc, urllib.error.HTTPError):  # subclass of URLError — check first
        return exc.code in _TRANSIENT_HTTP_CODES
    return isinstance(
        exc,
        (urllib.error.URLError, TimeoutError, ConnectionError, http.client.HTTPException, ssl.SSLError),
    )


def is_network_failure(exc: BaseException) -> bool:
    """True if `exc` or anything in its cause / context chain is a transient network error."""
    seen: set[int] = set()
    cur: BaseException | None = exc
    while cur is not None and id(cur) not in seen:
        if is_transient_network_error(cur):
            return True
        seen.add(id(cur))
        cur = cur.__cause__ or cur.__context__
    return False


def get_with_retry(
    url: str,
    raw_get: HttpGet,
    *,
    sleep: Callable[[float], None] = time.sleep,
) -> bytes:
    for wait in (*FETCH_RETRY_WAITS_SECONDS, None):
        try:
            return raw_get(url)
        except Exception as exc:
            if wait is None or not is_transient_network_error(exc):
                raise
            sleep(wait)
    raise AssertionError("unreachable")


def _raw_http_get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "livemakers-pivots/0.1"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        return resp.read()


def _default_http_get(url: str) -> bytes:
    return get_with_retry(url, _raw_http_get)


def _optional_float(value: object) -> float | None:
    return None if value is None else float(value)


@dataclass(frozen=True)
class Candle:
    open_time: int  # ms epoch
    open: float
    high: float
    low: float
    close: float
    volume: float
    close_time: int


@dataclass(frozen=True)
class OpenInterestPoint:
    timestamp: int  # ms epoch
    open_interest: float
    open_interest_usd: float


@dataclass(frozen=True)
class FundingPoint:
    timestamp: int  # ms epoch
    funding_rate: float


@dataclass(frozen=True)
class LongShortRatioPoint:
    timestamp: int  # ms epoch
    long_short_ratio: float
    long_account: float | None
    short_account: float | None


@dataclass(frozen=True)
class TopTraderPositionRatioPoint:
    timestamp: int  # ms epoch
    long_short_ratio: float
    long_account: float | None
    short_account: float | None


class BinanceFetcher:
    def __init__(self, http_get: HttpGet | None = None) -> None:
        self._http_get = http_get or _default_http_get

    def _resolve(self, asset: AssetSymbol) -> str:
        if asset not in _SYMBOL_MAP:
            raise ValueError(f"unsupported asset: {asset}")
        return _SYMBOL_MAP[asset]

    def fetch_klines(
        self,
        asset: AssetSymbol,
        interval: Literal["1d", "4h", "1h"] = "1d",
        limit: int = 1500,
    ) -> list[Candle]:
        symbol = self._resolve(asset)
        url = (
            f"https://api.binance.com/api/v3/klines"
            f"?symbol={symbol}&interval={interval}&limit={limit}"
        )
        raw = json.loads(self._http_get(url))
        out: list[Candle] = []
        for row in raw:
            out.append(
                Candle(
                    open_time=int(row[0]),
                    open=float(row[1]),
                    high=float(row[2]),
                    low=float(row[3]),
                    close=float(row[4]),
                    volume=float(row[5]),
                    close_time=int(row[6]),
                )
            )
        return out

    def fetch_klines_range(
        self,
        asset: AssetSymbol,
        *,
        start_ms: int,
        interval: Literal["1d", "4h", "1h"] = "1d",
        page_limit: int = BINANCE_KLINES_MAX_LIMIT,
    ) -> list[Candle]:
        """All candles from start_ms to now, paging forward by open_time.

        A page shorter than `page_limit` ends paging (treated as the last
        page), so `page_limit` must not exceed BINANCE_KLINES_MAX_LIMIT (the
        API's actual cap) — passing a larger value causes the first page to
        come back short (silently truncated by Binance) and paging to stop
        after just one page, truncating the series.
        """
        symbol = self._resolve(asset)
        out: list[Candle] = []
        cursor = start_ms
        while True:
            url = (
                f"https://api.binance.com/api/v3/klines"
                f"?symbol={symbol}&interval={interval}&startTime={cursor}&limit={page_limit}"
            )
            raw = json.loads(self._http_get(url))
            if not raw:
                break
            for row in raw:
                c = Candle(open_time=int(row[0]), open=float(row[1]), high=float(row[2]), low=float(row[3]), close=float(row[4]), volume=float(row[5]), close_time=int(row[6]))
                if not out or c.open_time > out[-1].open_time:
                    out.append(c)
            if len(raw) < page_limit:
                break
            cursor = int(raw[-1][0]) + 1
        return out

    def fetch_open_interest(
        self,
        asset: AssetSymbol,
        period: Literal["1d", "4h", "1h"] = "4h",
        limit: int = 180,
    ) -> list[OpenInterestPoint]:
        # Binance openInterestHist documents a 30-day lookback cap regardless of
        # `limit`. Default period=4h × limit=180 fully covers that window.
        symbol = self._resolve(asset)
        url = (
            f"https://fapi.binance.com/futures/data/openInterestHist"
            f"?symbol={symbol}&period={period}&limit={limit}"
        )
        raw = json.loads(self._http_get(url))
        return [
            OpenInterestPoint(
                timestamp=int(r["timestamp"]),
                open_interest=float(r["sumOpenInterest"]),
                open_interest_usd=float(r["sumOpenInterestValue"]),
            )
            for r in raw
        ]

    def fetch_funding(
        self, asset: AssetSymbol, limit: int = 1000
    ) -> list[FundingPoint]:
        symbol = self._resolve(asset)
        url = (
            f"https://fapi.binance.com/fapi/v1/fundingRate"
            f"?symbol={symbol}&limit={limit}"
        )
        raw = json.loads(self._http_get(url))
        return [
            FundingPoint(
                timestamp=int(r["fundingTime"]),
                funding_rate=float(r["fundingRate"]),
            )
            for r in raw
        ]

    def fetch_global_long_short_ratio(
        self,
        asset: AssetSymbol,
        period: Literal["1d", "4h", "1h"] = "1d",
        limit: int = 30,
    ) -> list[LongShortRatioPoint]:
        symbol = self._resolve(asset)
        url = (
            f"https://fapi.binance.com/futures/data/globalLongShortAccountRatio"
            f"?symbol={symbol}&period={period}&limit={limit}"
        )
        raw = json.loads(self._http_get(url))
        return [
            LongShortRatioPoint(
                timestamp=int(r["timestamp"]),
                long_short_ratio=float(r["longShortRatio"]),
                long_account=_optional_float(r.get("longAccount")),
                short_account=_optional_float(r.get("shortAccount")),
            )
            for r in raw
        ]

    def fetch_top_trader_long_short_position_ratio(
        self,
        asset: AssetSymbol,
        period: Literal["1d", "4h", "1h"] = "1d",
        limit: int = 30,
    ) -> list[TopTraderPositionRatioPoint]:
        symbol = self._resolve(asset)
        url = (
            f"https://fapi.binance.com/futures/data/topLongShortPositionRatio"
            f"?symbol={symbol}&period={period}&limit={limit}"
        )
        raw = json.loads(self._http_get(url))
        return [
            TopTraderPositionRatioPoint(
                timestamp=int(r["timestamp"]),
                long_short_ratio=float(r["longShortRatio"]),
                long_account=_optional_float(r.get("longAccount")),
                short_account=_optional_float(r.get("shortAccount")),
            )
            for r in raw
        ]
