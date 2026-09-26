"""One-time seed of the bulk derivatives cache (spec §5.4.2). Idempotent: reruns fetch only missing days.

    .venv/bin/python -m ops.backfill_bulk_history --start 2021-12-01
"""
from __future__ import annotations

import argparse
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from producer.bulk_history import default_http_get_status, refresh

DEFAULT_CACHE = Path(__file__).resolve().parents[1] / ".bulk_cache"
SYMBOLS = ("BTCUSDT", "ETHUSDT")


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--start", default="2021-12-01")
    p.add_argument("--end", default=(datetime.now(tz=timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d"))
    p.add_argument("--cache-dir", type=Path, default=DEFAULT_CACHE)
    a = p.parse_args()
    count = 0

    def progress(symbol: str, day: str) -> None:
        nonlocal count
        count += 1
        if count % 50 == 0:
            print(f"[backfill] {symbol} {day} ({count} days fetched)", flush=True)

    result = refresh(a.cache_dir, SYMBOLS, a.start, a.end, default_http_get_status, on_progress=progress)
    print(f"[backfill] fetched={result.fetched_days} missing={ {k: len(v) for k, v in result.missing_days.items()} } errors={len(result.errors)}")
    for e in result.errors[:20]:
        print(f"[backfill] error: {e}", file=sys.stderr)
    return 1 if result.errors else 0


if __name__ == "__main__":
    sys.exit(main())
