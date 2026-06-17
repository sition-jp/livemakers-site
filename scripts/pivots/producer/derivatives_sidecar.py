"""Historical derivatives sidecar for OI/funding daily closed buckets."""
from __future__ import annotations

import json
from collections import defaultdict
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import TypedDict

from producer.fetch_binance import BinanceFetcher, FundingPoint, OpenInterestPoint
from producer.types import ASSETS, AssetSymbol

SCHEMA_VERSION = "pivots_derivatives_history.v0.1"
PROVIDER = "binance_usdm"
DEFAULT_RETENTION_DAYS = 1825
_MS = 1000
_EXPECTED_OI_SAMPLES = 6
_EXPECTED_FUNDING_SAMPLES = 3
_SYMBOLS: dict[AssetSymbol, str] = {"BTC": "BTCUSDT", "ETH": "ETHUSDT"}


class OpenInterestDaily(TypedDict):
    sample_count: int
    first: float
    last: float
    min: float
    max: float
    avg: float
    last_usd: float
    avg_usd: float
    growth_pct: float


class FundingDaily(TypedDict):
    sample_count: int
    sum: float
    avg: float
    abs_avg: float
    max_abs: float
    last: float


class Completeness(TypedDict):
    open_interest: float
    funding: float
    overall: float


class SourceInfo(TypedDict):
    oi_period: str
    funding_granularity: str
    is_closed_bucket: bool


class DerivativesDailyPoint(TypedDict):
    bucket_start: str
    bucket_end: str
    open_interest: OpenInterestDaily
    funding: FundingDaily
    completeness: Completeness
    source: SourceInfo


class DerivativesAssetHistory(TypedDict):
    symbol: str
    history: list[DerivativesDailyPoint]


class DerivativesHistorySnapshot(TypedDict):
    schema_version: str
    generated_at: str
    provider: str
    assets: dict[str, DerivativesAssetHistory]


def _parse_iso(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(UTC)


def _iso(dt: datetime) -> str:
    return dt.astimezone(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _day_start_from_ms(timestamp: int) -> datetime:
    dt = datetime.fromtimestamp(timestamp / _MS, tz=UTC)
    return datetime(dt.year, dt.month, dt.day, tzinfo=UTC)


def _latest_allowed_day(generated_at: str) -> datetime:
    dt = _parse_iso(generated_at)
    return datetime(dt.year, dt.month, dt.day, tzinfo=UTC) - timedelta(days=1)


def _round(value: float) -> float:
    return round(value, 10)


def _aggregate_oi(
    points: list[OpenInterestPoint], latest_day: datetime
) -> dict[str, OpenInterestDaily]:
    buckets: dict[datetime, list[OpenInterestPoint]] = defaultdict(list)
    for point in points:
        day = _day_start_from_ms(point.timestamp)
        if day <= latest_day:
            buckets[day].append(point)

    out: dict[str, OpenInterestDaily] = {}
    for day, rows in buckets.items():
        rows = sorted(rows, key=lambda p: p.timestamp)
        values = [p.open_interest for p in rows]
        usd_values = [p.open_interest_usd for p in rows]
        first = values[0]
        last = values[-1]
        growth = ((last - first) / first) if first > 0 else 0.0
        out[_iso(day)] = {
            "sample_count": len(rows),
            "first": _round(first),
            "last": _round(last),
            "min": _round(min(values)),
            "max": _round(max(values)),
            "avg": _round(sum(values) / len(values)),
            "last_usd": _round(usd_values[-1]),
            "avg_usd": _round(sum(usd_values) / len(usd_values)),
            "growth_pct": _round(growth),
        }
    return out


def _aggregate_funding(
    points: list[FundingPoint], latest_day: datetime
) -> dict[str, FundingDaily]:
    buckets: dict[datetime, list[FundingPoint]] = defaultdict(list)
    for point in points:
        day = _day_start_from_ms(point.timestamp)
        if day <= latest_day:
            buckets[day].append(point)

    out: dict[str, FundingDaily] = {}
    for day, rows in buckets.items():
        rows = sorted(rows, key=lambda p: p.timestamp)
        values = [p.funding_rate for p in rows]
        abs_values = [abs(v) for v in values]
        out[_iso(day)] = {
            "sample_count": len(rows),
            "sum": _round(sum(values)),
            "avg": _round(sum(values) / len(values)),
            "abs_avg": _round(sum(abs_values) / len(abs_values)),
            "max_abs": _round(max(abs_values)),
            "last": _round(values[-1]),
        }
    return out


def _empty_oi() -> OpenInterestDaily:
    return {
        "sample_count": 0,
        "first": 0.0,
        "last": 0.0,
        "min": 0.0,
        "max": 0.0,
        "avg": 0.0,
        "last_usd": 0.0,
        "avg_usd": 0.0,
        "growth_pct": 0.0,
    }


def _empty_funding() -> FundingDaily:
    return {
        "sample_count": 0,
        "sum": 0.0,
        "avg": 0.0,
        "abs_avg": 0.0,
        "max_abs": 0.0,
        "last": 0.0,
    }


def _daily_point(
    day_iso: str,
    oi: OpenInterestDaily | None,
    funding: FundingDaily | None,
) -> DerivativesDailyPoint:
    day = _parse_iso(day_iso)
    oi_payload = oi or _empty_oi()
    funding_payload = funding or _empty_funding()
    oi_complete = min(oi_payload["sample_count"] / _EXPECTED_OI_SAMPLES, 1.0)
    funding_complete = min(
        funding_payload["sample_count"] / _EXPECTED_FUNDING_SAMPLES, 1.0
    )
    return {
        "bucket_start": day_iso,
        "bucket_end": _iso(day + timedelta(days=1)),
        "open_interest": oi_payload,
        "funding": funding_payload,
        "completeness": {
            "open_interest": _round(oi_complete),
            "funding": _round(funding_complete),
            "overall": _round((oi_complete + funding_complete) / 2.0),
        },
        "source": {
            "oi_period": "4h",
            "funding_granularity": "8h",
            "is_closed_bucket": True,
        },
    }


def _merge_asset_history(
    existing_rows: list[DerivativesDailyPoint],
    generated_rows: list[DerivativesDailyPoint],
    retention_days: int,
) -> list[DerivativesDailyPoint]:
    by_day = {row["bucket_start"]: row for row in existing_rows}
    for row in generated_rows:
        by_day[row["bucket_start"]] = row
    rows = [by_day[key] for key in sorted(by_day)]
    if retention_days > 0:
        rows = rows[-retention_days:]
    return rows


def load_derivatives_history_sidecar(path: Path) -> DerivativesHistorySnapshot | None:
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if not isinstance(raw, dict):
        return None
    if raw.get("schema_version") != SCHEMA_VERSION:
        return None
    assets = raw.get("assets")
    if not isinstance(assets, dict):
        return None
    for asset in ASSETS:
        block = assets.get(asset)
        if not isinstance(block, dict) or not isinstance(block.get("history"), list):
            return None
    return raw


def _existing_rows(
    existing: DerivativesHistorySnapshot | None,
    asset: AssetSymbol,
) -> list[DerivativesDailyPoint]:
    if existing is None:
        return []
    block = existing.get("assets", {}).get(asset)
    if not block:
        return []
    return list(block.get("history", []))


def compose_derivatives_history_sidecar(
    fetcher: BinanceFetcher,
    generated_at: str,
    existing: DerivativesHistorySnapshot | None = None,
    retention_days: int = DEFAULT_RETENTION_DAYS,
) -> DerivativesHistorySnapshot:
    latest_day = _latest_allowed_day(generated_at)
    assets: dict[str, DerivativesAssetHistory] = {}
    for asset in ASSETS:
        oi = _aggregate_oi(
            fetcher.fetch_open_interest(asset, period="4h", limit=180), latest_day
        )
        funding = _aggregate_funding(
            fetcher.fetch_funding(asset, limit=1000), latest_day
        )
        days = sorted(set(oi) | set(funding))
        generated_rows = [_daily_point(day, oi.get(day), funding.get(day)) for day in days]
        assets[asset] = {
            "symbol": _SYMBOLS[asset],
            "history": _merge_asset_history(
                _existing_rows(existing, asset),
                generated_rows,
                retention_days,
            ),
        }
    return {
        "schema_version": SCHEMA_VERSION,
        "generated_at": generated_at,
        "provider": PROVIDER,
        "assets": assets,
    }
