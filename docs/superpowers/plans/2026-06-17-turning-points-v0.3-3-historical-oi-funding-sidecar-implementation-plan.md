# Turning Points v0.3-3 Historical OI/Funding Sidecar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a durable internal sidecar at `data/pivot_derivatives_history.live.json` that accumulates closed UTC-day BTC/ETH Open Interest and funding history without changing public Turning Point schemas, scores, UI, APIs, or the AI Auto Trader gate.

**Architecture:** Add a focused `producer.derivatives_sidecar` module that aggregates existing Binance `OpenInterestPoint` and `FundingPoint` dataclasses into daily closed-bucket records, merges them with an existing sidecar, and prunes retention. `producer.run_producer` keeps `pivot_assets.live.json` and `pivot_backtest.live.json` as one atomic public pair, then promotes the sidecar as a separate best-effort transaction. `ops.run_daily` treats the sidecar as a third scoped target while parsing sidecar degradation as an OK-with-warning condition.

**Tech Stack:** Python 3.12 stdlib, pytest, existing `livemakers-pivots-producer`, existing Next.js/Vitest public zod validation. No new runtime dependency, no new secret, no new scheduler.

## Global Constraints

- Implementation repo: `/Users/sition/Documents/SITION/DEV/livemakers-site`.
- Work in an isolated worktree; do not move the main checkout away from `main`.
- Preserve public `pivot_assets.live.json` schema version `v0.1`.
- Preserve public `pivot_backtest.live.json` schema version `v0.1`.
- Do not edit Turning Point UI, nav, public API routes, or TypeScript zod schemas.
- Do not wire sidecar data into scores, confidence, backtest metrics, or AI Auto Trader.
- Use existing `producer.fetch_binance.OpenInterestPoint` and `producer.fetch_binance.FundingPoint`; do not add new provider fetch methods for v0.3-3.
- Store only closed UTC-day buckets. Eligible bucket date is strictly before `generated_at.date()` in UTC.
- Public assets/backtest promotion remains atomic as a pair.
- Sidecar promotion is a separate best-effort transaction after the public pair succeeds.
- Sidecar degradation is communicated by stdout marker `[pivots-producer] sidecar_degraded=<reason>` and exit code `0` when public assets/backtest succeeded.
- `run_daily` maps sidecar degradation to OK log details, not FAILED.
- Keep `git commit --only` path scope protection. Never use `git add .`.

---

## File Structure

Create:

- `scripts/pivots/producer/derivatives_sidecar.py`
  - Owns sidecar schema constants, daily aggregation, merge/upsert/prune, load, and compose.
- `scripts/pivots/tests/test_derivatives_sidecar.py`
  - Focused unit tests for closed-bucket aggregation, merge, retention, and load behavior.

Modify:

- `scripts/pivots/producer/run_producer.py`
  - Add `DEFAULT_DERIVATIVES_HISTORY`.
  - Add `--derivatives-history-path`.
  - Compose sidecar best-effort.
  - Keep public pair promotion atomic.
  - Add separate sidecar promotion and degradation marker.
- `scripts/pivots/ops/run_daily.py`
  - Add `DEFAULT_DERIVATIVES_HISTORY`.
  - Pass sidecar target to producer dry-run/live invocations.
  - Capture producer output and parse `sidecar_degraded=`.
  - Archive/prune sidecar when present.
  - Include sidecar in auto-commit path scope and commit message.
- `scripts/pivots/tests/test_run_producer.py`
  - Add sidecar dry-run/live/best-effort/orphan-bak tests.
- `scripts/pivots/tests/test_run_daily_autocommit.py`
  - Update invocation stubs for structured producer results.
  - Add auto-commit sidecar path and degradation-log tests.
- `scripts/pivots/tests/test_run_daily.py`
  - Update `_invoke_producer` mocks from integer return values to `ProducerInvocation`.
- `scripts/pivots/tests/test_autocommit_integration.py`
  - Update real-git integration helpers to create/pass the sidecar path and expect the scoped commit to include it.
- `scripts/pivots/RUNBOOK.md`
  - Document the sidecar file, degraded warning semantics, and manual recovery from sidecar `.bak`.

Do not modify:

- `lib/pivots/types.ts`
- `app/**`
- `components/**`
- `tests/pivots/output-snapshot-zod.validate.test.ts`
- `scripts/pivots/producer/compose_assets.py`
- `scripts/pivots/producer/compose_backtest.py`
- `scripts/pivots/producer/backtest.py`
- `scripts/pivots/producer/backtest_quality.py`

## Task 1: Sidecar Aggregation Module

**Files:**
- Create: `scripts/pivots/producer/derivatives_sidecar.py`
- Create: `scripts/pivots/tests/test_derivatives_sidecar.py`

**Interfaces:**
- Consumes:
  - `producer.fetch_binance.BinanceFetcher`
  - `producer.fetch_binance.OpenInterestPoint(timestamp: int, open_interest: float, open_interest_usd: float)`
  - `producer.fetch_binance.FundingPoint(timestamp: int, funding_rate: float)`
  - `producer.types.ASSETS`
- Produces:
  - `SCHEMA_VERSION = "pivots_derivatives_history.v0.1"`
  - `DEFAULT_RETENTION_DAYS = 1825`
  - `load_derivatives_history_sidecar(path: Path) -> DerivativesHistorySnapshot | None`
  - `compose_derivatives_history_sidecar(fetcher: BinanceFetcher, generated_at: str, existing: DerivativesHistorySnapshot | None = None, retention_days: int = DEFAULT_RETENTION_DAYS) -> DerivativesHistorySnapshot`

- [ ] **Step 1: Add failing sidecar tests**

Create `scripts/pivots/tests/test_derivatives_sidecar.py`:

```python
from pathlib import Path

from producer.derivatives_sidecar import (
    SCHEMA_VERSION,
    compose_derivatives_history_sidecar,
    load_derivatives_history_sidecar,
)
from producer.fetch_binance import FundingPoint, OpenInterestPoint


class _Fetcher:
    def __init__(
        self,
        oi: dict[str, list[OpenInterestPoint]],
        funding: dict[str, list[FundingPoint]],
    ) -> None:
        self.oi = oi
        self.funding = funding

    def fetch_open_interest(self, asset, period="4h", limit=180):
        assert period == "4h"
        assert limit == 180
        return self.oi[asset]

    def fetch_funding(self, asset, limit=1000):
        assert limit == 1000
        return self.funding[asset]


def ms(day: int, hour: int) -> int:
    return 1_766_016_000_000 + (day * 86_400_000) + (hour * 3_600_000)


def test_sidecar_aggregates_closed_utc_days_only() -> None:
    generated_at = "2025-12-20T23:00:00Z"
    fetcher = _Fetcher(
        oi={
            "BTC": [
                OpenInterestPoint(ms(0, 0), 100.0, 1000.0),
                OpenInterestPoint(ms(0, 4), 110.0, 1100.0),
                OpenInterestPoint(ms(0, 8), 120.0, 1200.0),
                OpenInterestPoint(ms(2, 0), 999.0, 9990.0),
            ],
            "ETH": [
                OpenInterestPoint(ms(0, 0), 50.0, 500.0),
            ],
        },
        funding={
            "BTC": [
                FundingPoint(ms(0, 0), 0.0001),
                FundingPoint(ms(0, 8), -0.0002),
                FundingPoint(ms(0, 16), 0.0003),
                FundingPoint(ms(2, 0), 0.0999),
            ],
            "ETH": [
                FundingPoint(ms(0, 0), -0.0003),
            ],
        },
    )

    snap = compose_derivatives_history_sidecar(fetcher, generated_at)

    assert snap["schema_version"] == SCHEMA_VERSION
    assert snap["generated_at"] == generated_at
    assert snap["provider"] == "binance_usdm"
    btc_history = snap["assets"]["BTC"]["history"]
    assert [row["bucket_start"] for row in btc_history] == ["2025-12-18T00:00:00Z"]
    row = btc_history[0]
    assert row["bucket_end"] == "2025-12-19T00:00:00Z"
    assert row["open_interest"]["sample_count"] == 3
    assert row["open_interest"]["first"] == 100.0
    assert row["open_interest"]["last"] == 120.0
    assert row["open_interest"]["avg"] == 110.0
    assert row["open_interest"]["last_usd"] == 1200.0
    assert row["open_interest"]["avg_usd"] == 1100.0
    assert row["open_interest"]["growth_pct"] == 0.2
    assert row["funding"]["sample_count"] == 3
    assert row["funding"]["sum"] == 0.0002
    assert round(row["funding"]["avg"], 10) == round(0.0002 / 3, 10)
    assert row["funding"]["abs_avg"] == 0.0002
    assert row["funding"]["max_abs"] == 0.0003
    assert row["funding"]["last"] == 0.0003
    assert row["completeness"] == {
        "open_interest": 0.5,
        "funding": 1.0,
        "overall": 0.75,
    }
    assert row["source"]["is_closed_bucket"] is True


def test_sidecar_merges_existing_history_and_prunes_retention() -> None:
    generated_at = "2026-01-03T23:00:00Z"
    existing = {
        "schema_version": SCHEMA_VERSION,
        "generated_at": "2026-01-02T23:00:00Z",
        "provider": "binance_usdm",
        "assets": {
            "BTC": {
                "symbol": "BTCUSDT",
                "history": [
                    {
                        "bucket_start": "2025-12-17T00:00:00Z",
                        "bucket_end": "2025-12-18T00:00:00Z",
                        "open_interest": {
                            "sample_count": 6,
                            "first": 1.0,
                            "last": 1.0,
                            "min": 1.0,
                            "max": 1.0,
                            "avg": 1.0,
                            "last_usd": 1.0,
                            "avg_usd": 1.0,
                            "growth_pct": 0.0,
                        },
                        "funding": {
                            "sample_count": 3,
                            "sum": 0.0,
                            "avg": 0.0,
                            "abs_avg": 0.0,
                            "max_abs": 0.0,
                            "last": 0.0,
                        },
                        "completeness": {
                            "open_interest": 1.0,
                            "funding": 1.0,
                            "overall": 1.0,
                        },
                        "source": {
                            "oi_period": "4h",
                            "funding_granularity": "8h",
                            "is_closed_bucket": True,
                        },
                    }
                ],
            },
            "ETH": {"symbol": "ETHUSDT", "history": []},
        },
    }
    fetcher = _Fetcher(
        oi={
            "BTC": [OpenInterestPoint(ms(0, 0), 10.0, 100.0)],
            "ETH": [OpenInterestPoint(ms(0, 0), 20.0, 200.0)],
        },
        funding={
            "BTC": [FundingPoint(ms(0, 0), 0.0001)],
            "ETH": [FundingPoint(ms(0, 0), 0.0002)],
        },
    )

    snap = compose_derivatives_history_sidecar(
        fetcher,
        generated_at,
        existing=existing,
        retention_days=1,
    )

    assert [r["bucket_start"] for r in snap["assets"]["BTC"]["history"]] == [
        "2025-12-18T00:00:00Z"
    ]
    assert [r["bucket_start"] for r in snap["assets"]["ETH"]["history"]] == [
        "2025-12-18T00:00:00Z"
    ]


def test_load_sidecar_missing_invalid_and_valid(tmp_path: Path) -> None:
    missing = tmp_path / "missing.json"
    assert load_derivatives_history_sidecar(missing) is None

    invalid = tmp_path / "invalid.json"
    invalid.write_text('{"schema_version": "wrong"}')
    assert load_derivatives_history_sidecar(invalid) is None

    valid = tmp_path / "valid.json"
    valid.write_text(
        '{"schema_version":"pivots_derivatives_history.v0.1",'
        '"generated_at":"2026-01-03T23:00:00Z",'
        '"provider":"binance_usdm",'
        '"assets":{"BTC":{"symbol":"BTCUSDT","history":[]},'
        '"ETH":{"symbol":"ETHUSDT","history":[]}}}'
    )
    loaded = load_derivatives_history_sidecar(valid)
    assert loaded is not None
    assert loaded["assets"]["BTC"]["history"] == []
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
cd /Users/sition/Documents/SITION/DEV/livemakers-site/scripts/pivots
.venv/bin/python -m pytest tests/test_derivatives_sidecar.py -q
```

Expected:

```text
ModuleNotFoundError: No module named 'producer.derivatives_sidecar'
```

- [ ] **Step 3: Implement `producer.derivatives_sidecar`**

Create `scripts/pivots/producer/derivatives_sidecar.py` with these public names and behavior:

```python
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
```

Then implement:

```python
def _aggregate_oi(points: list[OpenInterestPoint], latest_day: datetime) -> dict[str, OpenInterestDaily]:
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


def _aggregate_funding(points: list[FundingPoint], latest_day: datetime) -> dict[str, FundingDaily]:
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
```

Then implement:

```python
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


def _daily_point(day_iso: str, oi: OpenInterestDaily | None, funding: FundingDaily | None) -> DerivativesDailyPoint:
    day = _parse_iso(day_iso)
    oi_payload = oi or _empty_oi()
    funding_payload = funding or _empty_funding()
    oi_complete = min(oi_payload["sample_count"] / _EXPECTED_OI_SAMPLES, 1.0)
    funding_complete = min(funding_payload["sample_count"] / _EXPECTED_FUNDING_SAMPLES, 1.0)
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
    rows = [by_day[k] for k in sorted(by_day)]
    if retention_days > 0:
        rows = rows[-retention_days:]
    return rows
```

Then implement:

```python
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
        oi = _aggregate_oi(fetcher.fetch_open_interest(asset, period="4h", limit=180), latest_day)
        funding = _aggregate_funding(fetcher.fetch_funding(asset, limit=1000), latest_day)
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
```

- [ ] **Step 4: Run sidecar tests**

Run:

```bash
cd /Users/sition/Documents/SITION/DEV/livemakers-site/scripts/pivots
.venv/bin/python -m pytest tests/test_derivatives_sidecar.py -q
```

Expected:

```text
3 passed
```

- [ ] **Step 5: Commit Task 1**

Run:

```bash
cd /Users/sition/Documents/SITION/DEV/livemakers-site
git add scripts/pivots/producer/derivatives_sidecar.py scripts/pivots/tests/test_derivatives_sidecar.py
git commit -m "feat(pivots): add derivatives history sidecar"
```

## Task 2: Producer Integration And Sidecar Best-Effort Promotion

**Files:**
- Modify: `scripts/pivots/producer/run_producer.py`
- Modify: `scripts/pivots/tests/test_run_producer.py`

**Interfaces:**
- Consumes:
  - `compose_derivatives_history_sidecar`
  - `load_derivatives_history_sidecar`
  - existing `atomic_write_json`
- Produces:
  - `DEFAULT_DERIVATIVES_HISTORY`
  - CLI argument `--derivatives-history-path`
  - stdout marker `[pivots-producer] sidecar_degraded=<reason>`
  - return code `0` when public snapshots succeeded even if sidecar degraded

- [ ] **Step 1: Add failing producer tests**

Append to `scripts/pivots/tests/test_run_producer.py`:

```python
def test_dry_run_writes_and_removes_sidecar_tmp(
    tmp_path: Path, canned_fetcher: BinanceFetcher
) -> None:
    assets_target = tmp_path / "pivot_assets.live.json"
    backtest_target = tmp_path / "pivot_backtest.live.json"
    sidecar_target = tmp_path / "pivot_derivatives_history.live.json"
    assets_target.write_text('{"sentinel": "old"}')
    backtest_target.write_text('{"sentinel": "old"}')
    rc = run_producer(
        fetcher=canned_fetcher,
        assets_path=assets_target,
        backtest_path=backtest_target,
        derivatives_history_path=sidecar_target,
        dry_run=True,
        skip_zod_validate=True,
    )
    assert rc == 0
    assert not sidecar_target.exists()
    assert not (tmp_path / "pivot_derivatives_history.live.json.tmp").exists()
    assert not (tmp_path / "pivot_derivatives_history.live.json.bak").exists()


def test_live_write_promotes_sidecar_after_public_pair(
    tmp_path: Path, canned_fetcher: BinanceFetcher
) -> None:
    assets_target = tmp_path / "pivot_assets.live.json"
    backtest_target = tmp_path / "pivot_backtest.live.json"
    sidecar_target = tmp_path / "pivot_derivatives_history.live.json"
    rc = run_producer(
        fetcher=canned_fetcher,
        assets_path=assets_target,
        backtest_path=backtest_target,
        derivatives_history_path=sidecar_target,
        dry_run=False,
        skip_zod_validate=True,
    )
    assert rc == 0
    sidecar = json.loads(sidecar_target.read_text())
    assert sidecar["schema_version"] == "pivots_derivatives_history.v0.1"
    assert set(sidecar["assets"]) == {"BTC", "ETH"}


def test_sidecar_compose_failure_keeps_public_success_and_preserves_old_sidecar(
    tmp_path: Path, canned_fetcher: BinanceFetcher, capsys
) -> None:
    assets_target = tmp_path / "pivot_assets.live.json"
    backtest_target = tmp_path / "pivot_backtest.live.json"
    sidecar_target = tmp_path / "pivot_derivatives_history.live.json"
    sidecar_target.write_text('{"sentinel": "old_sidecar"}')
    with patch(
        "producer.run_producer.compose_derivatives_history_sidecar",
        side_effect=RuntimeError("sidecar provider down"),
    ):
        rc = run_producer(
            fetcher=canned_fetcher,
            assets_path=assets_target,
            backtest_path=backtest_target,
            derivatives_history_path=sidecar_target,
            dry_run=False,
            skip_zod_validate=True,
        )
    assert rc == 0
    assert json.loads(assets_target.read_text())["schema_version"] == "v0.1"
    assert json.loads(backtest_target.read_text())["schema_version"] == "v0.1"
    assert json.loads(sidecar_target.read_text()) == {"sentinel": "old_sidecar"}
    captured = capsys.readouterr()
    assert "sidecar_degraded=RuntimeError: sidecar provider down" in captured.out


def test_sidecar_promotion_failure_does_not_rollback_public_pair(
    tmp_path: Path, canned_fetcher: BinanceFetcher, capsys
) -> None:
    assets_target = tmp_path / "pivot_assets.live.json"
    backtest_target = tmp_path / "pivot_backtest.live.json"
    sidecar_target = tmp_path / "pivot_derivatives_history.live.json"
    sidecar_target.write_text('{"sentinel": "old_sidecar"}')
    real_replace = os.replace

    def _flaky_replace(src, dst):
        if str(dst).endswith("pivot_derivatives_history.live.json"):
            raise OSError("sidecar rename failed")
        return real_replace(src, dst)

    with patch("producer.run_producer.os.replace", side_effect=_flaky_replace):
        rc = run_producer(
            fetcher=canned_fetcher,
            assets_path=assets_target,
            backtest_path=backtest_target,
            derivatives_history_path=sidecar_target,
            dry_run=False,
            skip_zod_validate=True,
        )
    assert rc == 0
    assert json.loads(assets_target.read_text())["schema_version"] == "v0.1"
    assert json.loads(backtest_target.read_text())["schema_version"] == "v0.1"
    assert json.loads(sidecar_target.read_text()) == {"sentinel": "old_sidecar"}
    assert "sidecar_degraded=OSError: sidecar rename failed" in capsys.readouterr().out


def test_sidecar_orphan_bak_does_not_block_public_pair(
    tmp_path: Path, canned_fetcher: BinanceFetcher, capsys
) -> None:
    assets_target = tmp_path / "pivot_assets.live.json"
    backtest_target = tmp_path / "pivot_backtest.live.json"
    sidecar_target = tmp_path / "pivot_derivatives_history.live.json"
    sidecar_target.write_text('{"sentinel": "current_sidecar"}')
    (tmp_path / "pivot_derivatives_history.live.json.bak").write_text(
        '{"sentinel": "sidecar_bak"}'
    )

    rc = run_producer(
        fetcher=canned_fetcher,
        assets_path=assets_target,
        backtest_path=backtest_target,
        derivatives_history_path=sidecar_target,
        dry_run=False,
        skip_zod_validate=True,
    )

    assert rc == 0
    assert json.loads(assets_target.read_text())["schema_version"] == "v0.1"
    assert json.loads(backtest_target.read_text())["schema_version"] == "v0.1"
    assert json.loads(sidecar_target.read_text()) == {"sentinel": "current_sidecar"}
    assert (tmp_path / "pivot_derivatives_history.live.json.bak").exists()
    assert "sidecar_degraded=SidecarOrphanBak:" in capsys.readouterr().out
```

- [ ] **Step 2: Run producer tests and verify failure**

Run:

```bash
cd /Users/sition/Documents/SITION/DEV/livemakers-site/scripts/pivots
.venv/bin/python -m pytest tests/test_run_producer.py -q
```

Expected:

```text
TypeError: run_producer() got an unexpected keyword argument 'derivatives_history_path'
```

- [ ] **Step 3: Update `run_producer.py` imports and defaults**

Add imports:

```python
from producer.derivatives_sidecar import (
    compose_derivatives_history_sidecar,
    load_derivatives_history_sidecar,
)
```

Add default:

```python
DEFAULT_DERIVATIVES_HISTORY = REPO_ROOT / "data" / "pivot_derivatives_history.live.json"
```

- [ ] **Step 4: Add sidecar helpers**

Add:

```python
def _sidecar_warning(exc: Exception) -> str:
    return f"{type(exc).__name__}: {exc}"


def _emit_sidecar_degraded(reason: str) -> None:
    print(f"[pivots-producer] sidecar_degraded={reason}")


def _promote_one_best_effort(tmp_path: Path, target_path: Path) -> None:
    bak = _bak_path(target_path)
    backed_up = False
    try:
        if target_path.exists():
            shutil.copy2(target_path, bak)
            backed_up = True
        os.replace(tmp_path, target_path)
    except Exception:
        if backed_up and bak.exists():
            try:
                os.replace(bak, target_path)
            except OSError:
                pass
        _unlink_quiet(tmp_path)
        raise
    _unlink_quiet(bak)
```

- [ ] **Step 5: Extend `run_producer` signature and sidecar compose**

Change signature:

```python
def run_producer(
    fetcher: BinanceFetcher,
    assets_path: Path,
    backtest_path: Path,
    derivatives_history_path: Path = DEFAULT_DERIVATIVES_HISTORY,
    dry_run: bool = False,
    skip_zod_validate: bool = False,
    repo_root: Path = REPO_ROOT,
) -> int:
```

Keep orphan-bak refusal for the public pair only:

```python
if _refuse_if_orphan_baks((assets_path, backtest_path)):
    return 1
```

After public payload composition succeeds, compose sidecar best-effort. A
sidecar orphan `.bak` degrades the sidecar only and must not block public
snapshot generation:

```python
sidecar_payload = None
sidecar_warning: str | None = None
sidecar_bak = _bak_path(derivatives_history_path)
if sidecar_bak.exists():
    sidecar_warning = f"SidecarOrphanBak: {sidecar_bak}"
else:
    try:
        existing_sidecar = load_derivatives_history_sidecar(derivatives_history_path)
        sidecar_payload = compose_derivatives_history_sidecar(
            fetcher,
            generated_at,
            existing=existing_sidecar,
        )
    except Exception as exc:
        sidecar_warning = _sidecar_warning(exc)
```

Write public tmp files in the existing public-failure path:

```python
derivatives_tmp = _tmp_path(derivatives_history_path)
try:
    atomic_write_json(assets_tmp, assets_payload)
    atomic_write_json(backtest_tmp, backtest_payload)
except Exception as exc:
    print(f"[pivots-producer] tmp write failed: {exc}", file=sys.stderr)
    _unlink_quiet(assets_tmp)
    _unlink_quiet(backtest_tmp)
    _unlink_quiet(derivatives_tmp)
    return 1
```

Then write sidecar tmp in a separate best-effort block:

```python
if sidecar_payload is not None:
    try:
        atomic_write_json(derivatives_tmp, sidecar_payload)
    except Exception as exc:
        sidecar_warning = _sidecar_warning(exc)
        _unlink_quiet(derivatives_tmp)
```

On zod failure and dry-run cleanup, include sidecar tmp:

```python
_unlink_quiet(derivatives_tmp)
```

Before a dry-run returns `0`, emit the sidecar warning if one exists:

```python
if dry_run:
    for tmp in (assets_tmp, backtest_tmp, derivatives_tmp):
        if tmp.exists():
            size = tmp.stat().st_size
            print(f"[pivots-producer] dry-run wrote {tmp.name} ({size} bytes)")
            tmp.unlink()
    if sidecar_warning:
        _emit_sidecar_degraded(sidecar_warning)
    return 0
```

After public pair promotion succeeds, promote sidecar best-effort:

```python
if sidecar_payload is not None and derivatives_tmp.exists():
    try:
        _promote_one_best_effort(derivatives_tmp, derivatives_history_path)
    except Exception as exc:
        sidecar_warning = _sidecar_warning(exc)

if sidecar_warning:
    _emit_sidecar_degraded(sidecar_warning)
```

- [ ] **Step 6: Extend CLI**

Add parser argument:

```python
p.add_argument(
    "--derivatives-history-path",
    type=Path,
    default=DEFAULT_DERIVATIVES_HISTORY,
)
```

Pass it:

```python
derivatives_history_path=args.derivatives_history_path,
```

- [ ] **Step 7: Run producer tests**

Run:

```bash
cd /Users/sition/Documents/SITION/DEV/livemakers-site/scripts/pivots
.venv/bin/python -m pytest tests/test_run_producer.py tests/test_derivatives_sidecar.py -q
```

Expected:

```text
all tests passed
```

- [ ] **Step 8: Commit Task 2**

Run:

```bash
cd /Users/sition/Documents/SITION/DEV/livemakers-site
git add scripts/pivots/producer/run_producer.py scripts/pivots/tests/test_run_producer.py
git commit -m "feat(pivots): write derivatives sidecar best-effort"
```

## Task 3: Daily Ops Integration

**Files:**
- Modify: `scripts/pivots/ops/run_daily.py`
- Modify: `scripts/pivots/tests/test_run_daily_autocommit.py`
- Modify: `scripts/pivots/tests/test_run_daily.py`
- Modify: `scripts/pivots/tests/test_autocommit_integration.py`

**Interfaces:**
- Consumes:
  - producer CLI `--derivatives-history-path`
  - stdout marker `sidecar_degraded=`
- Produces:
  - `ProducerInvocation(returncode: int, sidecar_warnings: list[str], output: str)`
  - run_daily sidecar path defaults and scoped auto-commit

- [ ] **Step 1: Add failing ops tests**

Append to `scripts/pivots/tests/test_run_daily_autocommit.py`:

```python
def test_run_daily_passes_sidecar_path_to_producer(tmp_path, monkeypatch):
    from ops import run_daily as rd

    calls = []

    def fake_invoke(args):
        calls.append(args)
        return rd.ProducerInvocation(returncode=0, sidecar_warnings=[], output="")

    monkeypatch.setattr("ops.run_daily.acquire_lock", lambda _p: _NoopCM())
    monkeypatch.setattr("ops.run_daily._invoke_producer", fake_invoke)
    monkeypatch.setattr("ops.run_daily.archive", lambda *a, **kw: None)
    monkeypatch.setattr("ops.run_daily.prune", lambda *a, **kw: None)
    monkeypatch.setattr("ops.run_daily.dispatch", lambda *a, **kw: None)

    paths = _make_paths(tmp_path)
    sidecar = tmp_path / "derivatives.json"
    rc = rd.run_daily(
        **paths,
        derivatives_history_path=sidecar,
        auto_commit=False,
        notify_ok=False,
    )

    assert rc == 0
    assert "--derivatives-history-path" in calls[0]
    assert str(sidecar) in calls[0]
    assert "--derivatives-history-path" in calls[1]
    assert str(sidecar) in calls[1]


def test_run_daily_sidecar_degraded_logs_ok_warning(tmp_path, monkeypatch):
    from ops import run_daily as rd

    captured = _captured_dispatch(monkeypatch)

    def fake_invoke(args):
        return rd.ProducerInvocation(
            returncode=0,
            sidecar_warnings=["RuntimeError: sidecar provider down"],
            output="[pivots-producer] sidecar_degraded=RuntimeError: sidecar provider down",
        )

    monkeypatch.setattr("ops.run_daily.acquire_lock", lambda _p: _NoopCM())
    monkeypatch.setattr("ops.run_daily._invoke_producer", fake_invoke)
    monkeypatch.setattr("ops.run_daily.archive", lambda *a, **kw: None)
    monkeypatch.setattr("ops.run_daily.prune", lambda *a, **kw: None)
    paths = _make_paths(tmp_path)

    rc = rd.run_daily(**paths, auto_commit=False, notify_ok=False)

    assert rc == 0
    assert captured["p"]["status"] == "OK"
    assert "sidecar degraded" in captured["p"]["details"]
    assert "sidecar provider down" in captured["p"]["details"]


def test_auto_commit_message_and_pathspec_include_sidecar(tmp_path, monkeypatch):
    from ops import run_daily as rd

    captured_commit_msg: list[str] = []
    captured_commit_cmd: list[list[str]] = []

    def trace(cmd, *a, **kw):
        joined = " ".join(cmd)
        if "status --porcelain" in joined:
            return subprocess.CompletedProcess(
                args=cmd,
                returncode=0,
                stdout=" M data/pivot_derivatives_history.live.json\n",
            )
        if cmd[0] == "git" and "commit" in cmd:
            captured_commit_cmd.append(cmd)
            captured_commit_msg.append(cmd[cmd.index("-m") + 1])
        if "rev-parse" in joined:
            return subprocess.CompletedProcess(args=cmd, returncode=0, stdout="abc1234\n")
        return subprocess.CompletedProcess(args=cmd, returncode=0, stdout="", stderr="")

    _stub_pipeline_success(monkeypatch, trace)
    paths = _make_paths(tmp_path)
    paths["assets_path"].write_text("{}")
    paths["backtest_path"].write_text("{}")
    sidecar = tmp_path / "derivatives.json"
    sidecar.write_text("{}")
    monkeypatch.setattr("ops.run_daily.REPO_ROOT", tmp_path)

    rd.run_daily(
        **paths,
        derivatives_history_path=sidecar,
        auto_commit=True,
        notify_ok=False,
    )

    assert captured_commit_msg
    assert "derivatives_history:" in captured_commit_msg[0]
    assert str(sidecar) in captured_commit_cmd[0]
```

- [ ] **Step 2: Run ops tests and verify failure**

Run:

```bash
cd /Users/sition/Documents/SITION/DEV/livemakers-site/scripts/pivots
.venv/bin/python -m pytest tests/test_run_daily_autocommit.py -q
```

Expected:

```text
AttributeError: module 'ops.run_daily' has no attribute 'ProducerInvocation'
```

- [ ] **Step 3: Add `ProducerInvocation` and output parsing**

In `scripts/pivots/ops/run_daily.py`, add:

```python
from dataclasses import dataclass
```

Add:

```python
@dataclass(frozen=True)
class ProducerInvocation:
    returncode: int
    sidecar_warnings: list[str]
    output: str
```

Replace `_invoke_producer` with:

```python
def _parse_sidecar_warnings(output: str) -> list[str]:
    marker = "sidecar_degraded="
    warnings: list[str] = []
    for line in output.splitlines():
        if marker in line:
            warnings.append(line.split(marker, 1)[1].strip())
    return warnings


def _invoke_producer(args: Sequence[str]) -> ProducerInvocation:
    """Subprocess the producer CLI. Returns rc plus sidecar soft warnings."""
    proc = subprocess.run(
        [sys.executable, "-m", "producer.run_producer", *args],
        cwd=str(Path(__file__).resolve().parents[1]),
        check=False,
        capture_output=True,
        text=True,
    )
    output = f"{proc.stdout}\n{proc.stderr}"
    return ProducerInvocation(
        returncode=proc.returncode,
        sidecar_warnings=_parse_sidecar_warnings(output),
        output=output,
    )
```

Add a bounded failure-details helper so captured producer output still reaches
ops alerts after switching to `capture_output=True`:

```python
def _truncated_output(output: str, limit: int = 3000) -> str:
    output = output.strip()
    if len(output) <= limit:
        return output
    head = output[: limit // 2]
    tail = output[-limit // 2 :]
    return f"{head}\n--- truncated producer output ---\n{tail}"


def _producer_failure_details(label: str, result: ProducerInvocation) -> str:
    base = f"producer {label} returned {result.returncode}"
    output = _truncated_output(result.output)
    return f"{base}: {output}" if output else base
```

Update existing tests that monkeypatch `_invoke_producer` from `lambda args: 0`
to:

```python
lambda args: rd.ProducerInvocation(returncode=0, sidecar_warnings=[], output="")
```

Update `_stub_pipeline_success` in `tests/test_run_daily_autocommit.py` so it
sets that same `ProducerInvocation` object when stubbing producer success.

Update `scripts/pivots/tests/test_run_daily.py` import and mocks:

```python
from ops.run_daily import ProducerInvocation, run_daily

OK = ProducerInvocation(returncode=0, sidecar_warnings=[], output="")
DRY_FAIL = ProducerInvocation(returncode=1, sidecar_warnings=[], output="dry failed")
LIVE_FAIL = ProducerInvocation(returncode=1, sidecar_warnings=[], output="live failed")
```

Then replace:

```python
mock_run.return_value = 1
mock_run.side_effect = [0, 1]
mock_run.side_effect = [0, 0]
patch("ops.run_daily._invoke_producer", side_effect=[0, 0])
```

with:

```python
mock_run.return_value = DRY_FAIL
mock_run.side_effect = [OK, LIVE_FAIL]
mock_run.side_effect = [OK, OK]
patch("ops.run_daily._invoke_producer", side_effect=[OK, OK])
```

Update `scripts/pivots/tests/test_autocommit_integration.py` helper:

```python
def _make_data_files(repo: Path) -> tuple[Path, Path, Path]:
    data_dir = repo / "data"
    data_dir.mkdir(exist_ok=True)
    assets = data_dir / "pivot_assets.live.json"
    backtest = data_dir / "pivot_backtest.live.json"
    sidecar = data_dir / "pivot_derivatives_history.live.json"
    assets.write_text(json.dumps({"v": 1}))
    backtest.write_text(json.dumps({"v": 1}))
    sidecar.write_text(json.dumps({"v": 1}))
    return assets, backtest, sidecar


def _stub_run_daily_pipeline(monkeypatch):
    from ops.run_daily import ProducerInvocation

    monkeypatch.setattr("ops.run_daily.acquire_lock", lambda _p: _NoopCM())
    monkeypatch.setattr(
        "ops.run_daily._invoke_producer",
        lambda args: ProducerInvocation(returncode=0, sidecar_warnings=[], output=""),
    )
    monkeypatch.setattr("ops.run_daily.archive", lambda *a, **kw: None)
    monkeypatch.setattr("ops.run_daily.prune", lambda *a, **kw: None)
```

Every call to `rd.run_daily` in that file should pass:

```python
derivatives_history_path=sidecar,
```

In `test_real_auto_commit_excludes_unrelated_pre_staged_changes`, update the
expected HEAD files to include:

```python
"data/pivot_derivatives_history.live.json",
```

- [ ] **Step 4: Update run_daily targets and producer args**

Add default:

```python
DEFAULT_DERIVATIVES_HISTORY = REPO_ROOT / "data" / "pivot_derivatives_history.live.json"
```

Update `run_daily` signature:

```python
def run_daily(
    assets_path: Path = DEFAULT_ASSETS,
    backtest_path: Path = DEFAULT_BACKTEST,
    derivatives_history_path: Path = DEFAULT_DERIVATIVES_HISTORY,
    history_dir: Path = DEFAULT_HISTORY,
    log_file: Path = DEFAULT_LOG,
    keep_history: int = DEFAULT_KEEP,
    *,
    auto_commit: bool = False,
    notify_ok: bool = False,
) -> int:
```

Set targets:

```python
targets = [str(assets_path), str(backtest_path), str(derivatives_history_path)]
```

Thread `derivatives_history_path` through `_run_inside_lock` as an explicit
parameter. `_run_inside_lock` owns the dry/live producer args, archive/prune,
auto-commit, and OK details, so the sidecar path must be available there rather
than only in `run_daily`.

Add sidecar path to dry/live args:

```python
"--derivatives-history-path", str(derivatives_history_path),
```

Update dry/live rc checks:

```python
result = _invoke_producer(dry_args)
rc = result.returncode
```

After live:

```python
live_result = _invoke_producer(live_args)
rc = live_result.returncode
sidecar_warnings = list(live_result.sidecar_warnings)
```

Use live warnings as the authoritative OK details. Dry-run sidecar warnings are
pre-check noise if the live sidecar update later succeeds.

Update dry/live failure alerts to include captured producer output:

```python
details=_producer_failure_details("dry-run", result)
details=_producer_failure_details("live-write", live_result)
```

- [ ] **Step 5: Archive/prune sidecar**

In retention block, add:

```python
if derivatives_history_path.exists() and not sidecar_warnings:
    archive(derivatives_history_path, history_dir)
    prune(history_dir, "pivot_derivatives_history.live", keep=keep_history)
```

Skipping sidecar archive on degraded runs avoids archiving duplicate stale
sidecar content as if it were a fresh successful history update.

- [ ] **Step 6: Extend auto-commit scope**

Resolve sidecar path:

```python
derivatives_resolved = derivatives_history_path.resolve()
rel_derivatives = derivatives_resolved.relative_to(repo_root_resolved)
```

Update `git status`, `git add`, and `git commit --only` path lists to include
`str(derivatives_history_path)`.

Update commit message:

```python
commit_msg = (
    f"chore(pivots): daily snapshot {_now_iso()}\n\n"
    f"assets: {rel_assets}\n"
    f"backtest: {rel_backtest}\n"
    f"derivatives_history: {rel_derivatives}\n"
    f"generated by ops.run_daily --auto-commit\n"
)
```

- [ ] **Step 7: Include sidecar warning in OK details**

Before success alert:

```python
warning_detail = ""
if sidecar_warnings:
    joined = "; ".join(sidecar_warnings)
    warning_detail = f" | sidecar degraded: {joined}"

success_details = f"live write + archive + prune complete{warning_detail}"
```

Keep existing commit detail append after this string.

- [ ] **Step 8: Run ops tests**

Run:

```bash
cd /Users/sition/Documents/SITION/DEV/livemakers-site/scripts/pivots
.venv/bin/python -m pytest tests/test_run_daily.py tests/test_run_daily_autocommit.py tests/test_autocommit_integration.py -q
```

Expected:

```text
all tests passed
```

- [ ] **Step 9: Commit Task 3**

Run:

```bash
cd /Users/sition/Documents/SITION/DEV/livemakers-site
git add scripts/pivots/ops/run_daily.py scripts/pivots/tests/test_run_daily.py scripts/pivots/tests/test_run_daily_autocommit.py scripts/pivots/tests/test_autocommit_integration.py
git commit -m "feat(pivots): include derivatives sidecar in daily ops"
```

## Task 4: Runbook And Contract Documentation

**Files:**
- Modify: `scripts/pivots/RUNBOOK.md`

**Interfaces:**
- Consumes:
  - sidecar path `data/pivot_derivatives_history.live.json`
  - degraded marker `sidecar_degraded=`
- Produces:
  - operator-facing recovery and interpretation notes

- [ ] **Step 1: Add runbook section**

Append a short section to `scripts/pivots/RUNBOOK.md`:

````markdown
## Derivatives History Sidecar

The daily producer also maintains:

```text
data/pivot_derivatives_history.live.json
```

This is an internal historical OI/funding cache for future backtest calibration.
It is not a public API contract and does not change current scores, confidence,
or AI Auto Trader gating.

The public snapshots remain:

```text
data/pivot_assets.live.json
data/pivot_backtest.live.json
```

`pivot_assets.live.json` and `pivot_backtest.live.json` are promoted as an
atomic pair. The derivatives sidecar is promoted after that pair as a separate
best-effort transaction.

If logs contain:

```text
sidecar degraded: <reason>
```

the public snapshots succeeded but the sidecar was preserved from the previous
run or skipped for that run. Treat this as an ops note, not a public snapshot
failure. If a sidecar `.bak` remains, inspect the current sidecar and `.bak`,
choose the canonical copy, and remove the stale file before the next run.
````

- [ ] **Step 2: Check markdown diff**

Run:

```bash
cd /Users/sition/Documents/SITION/DEV/livemakers-site
git diff -- scripts/pivots/RUNBOOK.md
```

Expected:

```text
Only the Derivatives History Sidecar section is changed.
```

- [ ] **Step 3: Commit Task 4**

Run:

```bash
cd /Users/sition/Documents/SITION/DEV/livemakers-site
git add scripts/pivots/RUNBOOK.md
git commit -m "docs(pivots): document derivatives history sidecar ops"
```

## Task 5: Full Verification And PR Preparation

**Files:**
- Read only unless verification reveals a real issue.

**Interfaces:**
- Consumes all previous tasks.
- Produces a branch ready for review as a Draft PR.

- [ ] **Step 1: Run focused tests**

Run:

```bash
cd /Users/sition/Documents/SITION/DEV/livemakers-site/scripts/pivots
.venv/bin/python -m pytest tests/test_derivatives_sidecar.py tests/test_run_producer.py tests/test_run_daily.py tests/test_run_daily_autocommit.py tests/test_autocommit_integration.py -q
```

Expected:

```text
all tests passed
```

- [ ] **Step 2: Run full Python suite**

Run:

```bash
cd /Users/sition/Documents/SITION/DEV/livemakers-site/scripts/pivots
.venv/bin/python -m pytest -q
```

Expected:

```text
all tests passed
```

- [ ] **Step 3: Run dry-run producer**

Run:

```bash
cd /Users/sition/Documents/SITION/DEV/livemakers-site/scripts/pivots
.venv/bin/python -m producer.run_producer --dry-run
```

Expected:

```text
stdout contains a line starting with:
[pivots-producer] dry-run wrote pivot_assets.live.json.tmp

stdout contains a line starting with:
[pivots-producer] dry-run wrote pivot_backtest.live.json.tmp
```

Sidecar tmp may also be reported if the implementation prints tmp sizes for all
three files. No `.tmp` or `.bak` files should remain after dry-run.

- [ ] **Step 4: Run zod validation**

Run:

```bash
cd /Users/sition/Documents/SITION/DEV/livemakers-site
npx vitest run tests/pivots/output-snapshot-zod.validate.test.ts
```

Expected:

```text
2 passed
```

- [ ] **Step 5: Check git diff hygiene**

Run:

```bash
cd /Users/sition/Documents/SITION/DEV/livemakers-site
git diff --check
git status --short --branch
```

Expected:

```text
git diff --check exits 0
working tree clean after final commit
```

- [ ] **Step 6: Push implementation branch and create Draft PR**

Run:

```bash
cd /Users/sition/Documents/SITION/DEV/livemakers-site
git push -u origin codex/turning-points-v0.3-3-sidecar
gh pr create --draft --base main --head codex/turning-points-v0.3-3-sidecar \
  --title "[codex] feat(pivots): add v0.3-3 derivatives sidecar" \
  --body "Implements the v0.3-3 historical OI/funding sidecar from the reviewed design. Public Turning Point schemas, UI, APIs, scores, confidence, and AT gate remain unchanged."
```

Expected:

```text
Pull request URL printed by gh
```

## Self-Review Checklist

- Every design acceptance criterion maps to a task:
  - sidecar artifact and closed UTC-day buckets: Task 1.
  - public schema unchanged: Tasks 2 and 5.
  - sidecar best-effort failure: Tasks 2 and 3.
  - scoped auto-commit: Task 3.
  - ops documentation: Task 4.
  - verification: Task 5.
- No new secret, scheduler, UI/API, zod, score, confidence, backtest, or AT wiring appears in the plan.
- The public pair and sidecar transaction split from the revised design is preserved.
- Fetcher scope stays bounded to existing OI/funding dataclasses.
