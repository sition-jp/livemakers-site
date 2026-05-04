"""Binance public REST clients for OHLCV / Open Interest / Funding.

All endpoints used here are documented public + free + auth-less:
- spot klines:    https://api.binance.com/api/v3/klines
- futures OI:     https://fapi.binance.com/futures/data/openInterestHist
- futures funding: https://fapi.binance.com/fapi/v1/fundingRate

The fetcher takes an injectable http_get callable so tests can inject
recorded bytes; production passes the default urllib-based client.
"""
from __future__ import annotations

import json
import urllib.request
from dataclasses import dataclass
from typing import Callable, Literal

from producer.types import AssetSymbol

_SYMBOL_MAP: dict[str, str] = {"BTC": "BTCUSDT", "ETH": "ETHUSDT"}

HttpGet = Callable[[str], bytes]


def _default_http_get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "livemakers-pivots/0.1"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        return resp.read()


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
