"""Shared synthetic bulk-derivatives-history fixture builder for tests.

Generates one `DayRecord` per candle day in a klines fixture (six OI samples
at 00/04/08/12/16/20 UTC, OI ramping 14-day-wise so the OI-growth rule can
fire; three funding events at 00/08/16 UTC). This single generation rule is
shared by `test_compose_backtest.py::_synthetic_history` (which wraps the
records in a `BulkHistory` for direct use in `compose_pivot_backtest_snapshot`
tests) and the `bulk_cache` fixture in `test_run_producer.py` (which writes
the records to an on-disk cache via `producer.bulk_history.save_day` so
`producer.bulk_history.refresh()` sees a complete cache and makes no HTTP
calls) — keeping both test files' synthetic derivatives-history data
identical.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

from producer.bulk_history import DayRecord, save_day


def synthetic_day_records(
    klines_rows: list, *, drop_every: int | None = None
) -> list[DayRecord]:
    """Six OI samples and three funding events per candle day; OI ramps
    14-day-wise so the OI-growth rule can fire. `drop_every` skips every
    Nth day entirely (used to synthesize thin/incomplete coverage)."""
    records: list[DayRecord] = []
    for i, row in enumerate(klines_rows):
        day = datetime.fromtimestamp(row[0] / 1000, tz=timezone.utc)
        d = day.strftime("%Y-%m-%d")
        if drop_every and i % drop_every == 0:
            continue
        base = 1000.0 * (1.0 + 0.15 * ((i // 14) % 2))
        oi = tuple(
            (int((day + timedelta(hours=h)).timestamp() * 1000), base, base * 2)
            for h in (0, 4, 8, 12, 16, 20)
        )
        funding = tuple(
            (int((day + timedelta(hours=h)).timestamp() * 1000), 0.0001 if i % 40 else 0.001)
            for h in (0, 8, 16)
        )
        records.append(DayRecord(day=d, oi=oi, funding=funding))
    return records


def write_synthetic_bulk_cache(cache_dir: Path, symbol: str, klines_path: Path) -> None:
    rows = json.loads(klines_path.read_text())
    for record in synthetic_day_records(rows):
        save_day(cache_dir, symbol, record)
