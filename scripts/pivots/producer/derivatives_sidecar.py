"""Historical derivatives sidecar for OI/funding daily closed buckets."""
from __future__ import annotations

import json
import math
from collections import defaultdict
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import TypeVar, TypedDict

from producer.fetch_binance import BinanceFetcher, FundingPoint, OpenInterestPoint
from producer.types import ASSETS, AssetSymbol

SCHEMA_VERSION = "pivots_derivatives_history.v0.1"
PROVIDER = "binance_usdm"
DEFAULT_RETENTION_DAYS = 1825
_MS = 1000
_EXPECTED_OI_SAMPLES = 6
_EXPECTED_FUNDING_SAMPLES = 3
_SYMBOLS: dict[AssetSymbol, str] = {"BTC": "BTCUSDT", "ETH": "ETHUSDT"}
_Point = TypeVar("_Point", OpenInterestPoint, FundingPoint)


class SidecarValidationError(ValueError):
    """History must be preserved for operator inspection, not bootstrapped."""


def _require(condition: bool, reason: str) -> None:
    if not condition:
        raise SidecarValidationError(reason)


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


def _closed_buckets(
    points: list[_Point], latest_day: datetime, maximum: int, family: str,
) -> dict[datetime, list[_Point]]:
    buckets: dict[datetime, dict[int, _Point]] = defaultdict(dict)
    for point in points:
        _require(type(point.timestamp) is int, f"{family}: invalid sample timestamp")
        day = _day_start_from_ms(point.timestamp)
        if day > latest_day:
            continue
        rows = buckets[day]
        # Identical repeats carry no additional evidence. Conflicting repeats
        # have no trustworthy first/last winner, so preserve the saved sidecar.
        _require(
            point.timestamp not in rows or rows[point.timestamp] == point,
            f"{family}: conflicting samples at the same timestamp",
        )
        rows[point.timestamp] = point
        _require(len(rows) <= maximum, f"{family}: too many samples in a daily bucket")
    return {day: list(rows.values()) for day, rows in buckets.items()}


def _aggregate_oi(
    points: list[OpenInterestPoint], latest_day: datetime
) -> dict[str, OpenInterestDaily]:
    buckets = _closed_buckets(points, latest_day, _EXPECTED_OI_SAMPLES, "open_interest")

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
    buckets = _closed_buckets(points, latest_day, _EXPECTED_FUNDING_SAMPLES, "funding")

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
        previous = by_day.get(row["bucket_start"])
        if previous is not None:
            # Endpoint windows differ. Never replace retained observations with
            # an empty or truncated aggregate from the edge of a later fetch.
            oi = row["open_interest"]
            funding = row["funding"]
            if previous["open_interest"]["sample_count"] > oi["sample_count"]:
                oi = previous["open_interest"]
            if previous["funding"]["sample_count"] > funding["sample_count"]:
                funding = previous["funding"]
            row = _daily_point(row["bucket_start"], oi, funding)
        by_day[row["bucket_start"]] = row
    rows = [by_day[key] for key in sorted(by_day)]
    if retention_days > 0:
        # retention_days is enforced here as the maximum number of retained
        # closed daily bucket rows, not as a sparse calendar-day cutoff.
        rows = rows[-retention_days:]
    return rows


def _object_shape(value: object, keys: frozenset[str], context: str) -> dict:
    _require(isinstance(value, dict) and set(value) == keys, f"{context}: invalid shape")
    return value


def _utc_timestamp(value: object, context: str) -> datetime:
    _require(isinstance(value, str) and value.endswith("Z"), f"{context}: UTC timestamp required")
    try:
        return _parse_iso(value)
    except (ValueError, OverflowError) as exc:
        raise SidecarValidationError(f"{context}: invalid timestamp") from exc


def _finite_number(value: object) -> bool:
    if type(value) not in (int, float):
        return False
    try:
        return math.isfinite(value)
    except OverflowError:
        return False


def _validate_aggregate(value: object, keys: frozenset[str], maximum: int, context: str) -> int:
    aggregate = _object_shape(value, keys, context)
    count = aggregate["sample_count"]
    _require(type(count) is int and 0 <= count <= maximum, f"{context}: invalid sample_count")
    for key in keys - {"sample_count"}:
        number = aggregate[key]
        _require(_finite_number(number), f"{context}.{key}: finite number required")
        _require(count != 0 or number == 0, f"{context}: empty aggregate must contain zeros")
    return count


def _within_bounds(value: float, lower: float, upper: float) -> bool:
    # Allow only decimal serialization and a few ULPs of aggregate rounding.
    return (value >= lower or math.isclose(value, lower, rel_tol=0,
                                          abs_tol=max(1e-10, 4 * math.ulp(lower)))) and (
        value <= upper or math.isclose(value, upper, rel_tol=0,
                                      abs_tol=max(1e-10, 4 * math.ulp(upper))))


def _validate_snapshot(raw: object) -> None:
    snapshot = _object_shape(raw, DerivativesHistorySnapshot.__required_keys__, "snapshot")
    _require(snapshot["schema_version"] == SCHEMA_VERSION, "snapshot: unsupported schema; migration required")
    _require(snapshot["provider"] == PROVIDER, "snapshot: wrong provider")
    generated = _utc_timestamp(snapshot["generated_at"], "generated_at")
    latest_end = generated.replace(hour=0, minute=0, second=0, microsecond=0)
    assets = _object_shape(snapshot["assets"], frozenset(ASSETS), "assets (migration required)")
    for asset in ASSETS:
        context = f"assets.{asset}"
        block = _object_shape(assets[asset], DerivativesAssetHistory.__required_keys__, context)
        _require(block["symbol"] == _SYMBOLS[asset], f"{context}: wrong symbol")
        _require(isinstance(block["history"], list), f"{context}: history must be a list")
        previous = None
        for index, row in enumerate(block["history"]):
            context = f"assets.{asset}.history[{index}]"
            _object_shape(row, DerivativesDailyPoint.__required_keys__, context)
            start = _utc_timestamp(row["bucket_start"], f"{context}.bucket_start")
            end = _utc_timestamp(row["bucket_end"], f"{context}.bucket_end")
            _require(start == start.replace(hour=0, minute=0, second=0, microsecond=0)
                     and row["bucket_start"] == _iso(start), f"{context}: invalid UTC day")
            _require(end - start == timedelta(days=1) and end <= latest_end,
                     f"{context}: unclosed or invalid bucket")
            _require(previous is None or start > previous, f"{context}: duplicate or unsorted bucket")
            previous = start
            oi, funding = row["open_interest"], row["funding"]
            oi_count = _validate_aggregate(oi, OpenInterestDaily.__required_keys__,
                                           _EXPECTED_OI_SAMPLES, f"{context}.open_interest")
            funding_count = _validate_aggregate(funding, FundingDaily.__required_keys__,
                                                _EXPECTED_FUNDING_SAMPLES, f"{context}.funding")
            expected = _daily_point(row["bucket_start"], oi, funding)
            _require(row["source"] == expected["source"]
                     and row["source"]["is_closed_bucket"] is True,
                     f"{context}: invalid source metadata")
            completeness = _object_shape(row["completeness"], Completeness.__required_keys__,
                                         f"{context}.completeness")
            for key, value in expected["completeness"].items():
                _require(_finite_number(completeness[key])
                         and math.isclose(completeness[key], value, rel_tol=1e-8, abs_tol=1e-9),
                         f"{context}.completeness: inconsistent {key}")
            if oi_count:
                _require(0 < oi["min"] <= oi["max"] and oi["last_usd"] > 0 and oi["avg_usd"] > 0
                         and all(oi[key] > 0 and _within_bounds(oi[key], oi["min"], oi["max"])
                                 for key in ("first", "last", "avg")),
                         f"{context}.open_interest: inconsistent bounds")
            if funding_count:
                _require(funding["max_abs"] + 1e-9 >= funding["abs_avg"] >= 0
                         and funding["max_abs"] + 1e-9 >= abs(funding["last"])
                         and funding["abs_avg"] + 1e-9 >= abs(funding["avg"]),
                         f"{context}.funding: inconsistent bounds")


def _unique_json_object(pairs: list[tuple[str, object]]) -> dict:
    result = {}
    for key, value in pairs:
        _require(key not in result, "snapshot: duplicate JSON key")
        result[key] = value
    return result


def load_derivatives_history_sidecar(path: Path) -> DerivativesHistorySnapshot | None:
    """Only absence permits bootstrap; invalid existing history is never discarded."""
    try:
        raw_bytes = path.read_bytes()
    except FileNotFoundError as exc:
        if path.is_symlink():
            raise SidecarValidationError("cannot read sidecar: dangling symlink") from exc
        return None
    except OSError as exc:
        raise SidecarValidationError("cannot read existing sidecar") from exc
    try:
        raw = json.loads(raw_bytes.decode("utf-8"), object_pairs_hook=_unique_json_object)
    except SidecarValidationError:
        raise
    except (ValueError, RecursionError) as exc:
        raise SidecarValidationError("cannot parse existing sidecar JSON") from exc
    _validate_snapshot(raw)
    return raw


def _existing_rows(
    existing: DerivativesHistorySnapshot | None,
    asset: AssetSymbol,
) -> list[DerivativesDailyPoint]:
    if existing is None:
        return []
    return list(existing["assets"][asset]["history"])


def compose_derivatives_history_sidecar(
    fetcher: BinanceFetcher,
    generated_at: str,
    existing: DerivativesHistorySnapshot | None = None,
    retention_days: int = DEFAULT_RETENTION_DAYS,
) -> DerivativesHistorySnapshot:
    if existing is not None:
        _validate_snapshot(existing)
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
    snapshot: DerivativesHistorySnapshot = {
        "schema_version": SCHEMA_VERSION,
        "generated_at": generated_at,
        "provider": PROVIDER,
        "assets": assets,
    }
    _validate_snapshot(snapshot)
    return snapshot
