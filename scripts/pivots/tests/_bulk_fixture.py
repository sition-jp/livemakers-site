"""Shared synthetic bulk-derivatives-history fixture builder for tests.

Generates one `DayRecord` per candle day in a klines fixture file, using the
same OI-ramp generation rule as `test_compose_backtest.py::_synthetic_history`
(six OI samples at 00/04/08/12/16/20 UTC, OI ramping 14-day-wise; three
funding events at 00/08/16 UTC), and writes them to an on-disk cache via
`producer.bulk_history.save_day` so `producer.bulk_history.refresh()` sees a
complete cache and makes no HTTP calls.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

from producer.bulk_history import DayRecord, save_day


def write_synthetic_bulk_cache(cache_dir: Path, symbol: str, klines_path: Path) -> None:
    rows = json.loads(klines_path.read_text())
    for i, row in enumerate(rows):
        day = datetime.fromtimestamp(row[0] / 1000, tz=timezone.utc)
        d = day.strftime("%Y-%m-%d")
        base = 1000.0 * (1.0 + 0.15 * ((i // 14) % 2))
        oi = tuple(
            (int((day + timedelta(hours=h)).timestamp() * 1000), base, base * 2)
            for h in (0, 4, 8, 12, 16, 20)
        )
        funding = tuple(
            (int((day + timedelta(hours=h)).timestamp() * 1000), 0.0001)
            for h in (0, 8, 16)
        )
        save_day(cache_dir, symbol, DayRecord(day=d, oi=oi, funding=funding))
