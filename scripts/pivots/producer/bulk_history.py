"""Backtest-only derivatives history from Binance public bulk data (spec 2026-09-26 §5.4).

Two sources, one cache:
  * OI: data.binance.vision daily "metrics" zip (5-minute sum_open_interest). We keep the
    six 4h-aligned samples (00/04/08/12/16/20 UTC) so the backtest sees exactly what the
    live producer sees from /futures/data/openInterestHist?period=4h.
  * Funding: /fapi/v1/fundingRate paged by startTime (history back to 2019).
Cache: <cache_dir>/<SYMBOL>/<YYYY-MM-DD>.json, one DayRecord per closed UTC day, atomic writes.
Never merged into the live sidecar (design choice: one series, one source).
stdlib only.
"""
from __future__ import annotations

import csv
import io
import json
import os
import urllib.error
import urllib.request
import zipfile
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Callable, Sequence

BULK_METRICS_BASE = "https://data.binance.vision/data/futures/um/daily/metrics"
FUNDING_URL = "https://fapi.binance.com/fapi/v1/fundingRate"
SAMPLE_HOURS = (0, 4, 8, 12, 16, 20)
SAMPLE_TOLERANCE_MIN = 10
OI_SAMPLES_PER_DAY = 6
FUNDING_EVENTS_PER_DAY = 3
OI_GROWTH_BUCKETS = 84            # = compose_assets.OI_BUCKETS_PER_14D
FUNDING_HISTORY_EVENTS = 180      # = compose_assets abs_funding_history window
FUNDING_PAGE_LIMIT = 1000
HttpGetStatus = Callable[[str], tuple[int, bytes]]   # (status, body); 404 → (404, b"")


@dataclass(frozen=True)
class DayRecord:
    day: str                                  # "YYYY-MM-DD" (UTC)
    oi: tuple[tuple[int, float, float], ...]  # (ts_ms, sum_open_interest, sum_open_interest_value) at SAMPLE_HOURS
    funding: tuple[tuple[int, float], ...]    # (funding_time_ms, funding_rate) within the UTC day


@dataclass(frozen=True)
class RefreshResult:
    fetched_days: int
    missing_days: dict[str, list[str]]
    errors: list[str]


def default_http_get_status(url: str, timeout: int = 30) -> tuple[int, bytes]:
    req = urllib.request.Request(url, headers={"User-Agent": "livemakers-pivots/bulk-history"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, resp.read()
    except urllib.error.HTTPError as exc:
        return exc.code, b""


def metrics_url(symbol: str, day: str) -> str:
    return f"{BULK_METRICS_BASE}/{symbol}/{symbol}-metrics-{day}.zip"


def _day_start(day: str) -> datetime:
    return datetime.strptime(day, "%Y-%m-%d").replace(tzinfo=timezone.utc)


def _to_ms(dt: datetime) -> int:
    return int(dt.timestamp() * 1000)


def day_range(start_day: str, end_day: str) -> list[str]:
    cur, end = _day_start(start_day), _day_start(end_day)
    out = []
    while cur <= end:
        out.append(cur.strftime("%Y-%m-%d"))
        cur += timedelta(days=1)
    return out


def parse_metrics_csv(text: str) -> tuple[tuple[int, float, float], ...]:
    """Pick the first row at or after each SAMPLE_HOURS:00 within SAMPLE_TOLERANCE_MIN.

    Samples are keyed by the row's own `create_time` column (not by the source
    filename), so a CSV mislabeled relative to its file name is still parsed
    correctly.
    """
    rows = list(csv.DictReader(io.StringIO(text)))
    parsed = []
    for r in rows:
        ts = datetime.strptime(r["create_time"], "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
        parsed.append((ts, float(r["sum_open_interest"]), float(r["sum_open_interest_value"])))
    parsed.sort(key=lambda x: x[0])
    out = []
    for hh in SAMPLE_HOURS:
        for ts, oi, usd in parsed:
            if ts.hour == hh and ts.minute < SAMPLE_TOLERANCE_MIN:
                out.append((_to_ms(ts.replace(minute=0, second=0)), oi, usd))
                break
    return tuple(out)


def fetch_metrics_day(http_get: HttpGetStatus, symbol: str, day: str) -> tuple[tuple[int, float, float], ...] | None:
    status, body = http_get(metrics_url(symbol, day))
    if status == 404:
        return None
    if status != 200:
        raise RuntimeError(f"bulk metrics {symbol} {day}: HTTP {status}")
    with zipfile.ZipFile(io.BytesIO(body)) as zf:
        name = next(n for n in zf.namelist() if n.endswith(".csv"))
        return parse_metrics_csv(zf.read(name).decode("utf-8"))


def fetch_funding_range(http_get: HttpGetStatus, symbol: str, start_ms: int, end_ms: int) -> list[tuple[int, float]]:
    events: list[tuple[int, float]] = []
    cursor = start_ms
    while cursor < end_ms:
        url = f"{FUNDING_URL}?symbol={symbol}&startTime={cursor}&endTime={end_ms}&limit={FUNDING_PAGE_LIMIT}"
        status, body = http_get(url)
        if status != 200:
            raise RuntimeError(f"funding {symbol}: HTTP {status}")
        page = json.loads(body)
        if not page:
            break
        events.extend((int(r["fundingTime"]), float(r["fundingRate"])) for r in page)
        if len(page) < FUNDING_PAGE_LIMIT:
            break
        cursor = int(page[-1]["fundingTime"]) + 1
    return sorted(set(events))


def cache_path(cache_dir: Path, symbol: str, day: str) -> Path:
    return cache_dir / symbol / f"{day}.json"


def load_day(cache_dir: Path, symbol: str, day: str) -> DayRecord | None:
    p = cache_path(cache_dir, symbol, day)
    if not p.exists():
        return None
    raw = json.loads(p.read_text(encoding="utf-8"))
    return DayRecord(day=raw["day"], oi=tuple(tuple(x) for x in raw["oi"]), funding=tuple(tuple(x) for x in raw["funding"]))


def save_day(cache_dir: Path, record_symbol: str, record: DayRecord) -> None:
    p = cache_path(cache_dir, record_symbol, record.day)
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(".json.tmp")
    tmp.write_text(json.dumps({"day": record.day, "oi": record.oi, "funding": record.funding}), encoding="utf-8")
    os.replace(tmp, p)


def refresh(
    cache_dir: Path,
    symbols: Sequence[str],
    start_day: str,
    end_day: str,
    http_get: HttpGetStatus,
    *,
    on_progress: Callable[[str, str], None] | None = None,
) -> RefreshResult:
    fetched = 0
    missing: dict[str, list[str]] = {}
    errors: list[str] = []
    for symbol in symbols:
        days = [d for d in day_range(start_day, end_day) if load_day(cache_dir, symbol, d) is None]
        if not days:
            continue
        try:
            funding = fetch_funding_range(
                http_get,
                symbol,
                _to_ms(_day_start(days[0])),
                _to_ms(_day_start(days[-1]) + timedelta(days=1)),
            )
        except Exception as exc:  # noqa: BLE001 - record and move on to the next symbol
            # Do not proceed to the metrics loop below: saving a day's OI now with an
            # empty funding tuple would permanently cache it as "complete" (load_day
            # would short-circuit any later refresh from ever retrying the funding
            # fetch for this span). Leave every day of this symbol's span missing so
            # the next refresh() call retries both metrics and funding together.
            errors.append(f"{symbol} funding: {exc}")
            continue
        by_day: dict[str, list[tuple[int, float]]] = {}
        for ts, rate in funding:
            by_day.setdefault(datetime.fromtimestamp(ts / 1000, tz=timezone.utc).strftime("%Y-%m-%d"), []).append((ts, rate))
        for d in days:
            try:
                oi = fetch_metrics_day(http_get, symbol, d)
            except Exception as exc:  # noqa: BLE001 - record and continue with other days
                errors.append(f"{symbol} {d}: {exc}")
                continue
            if oi is None:
                missing.setdefault(symbol, []).append(d)
                continue
            save_day(cache_dir, symbol, DayRecord(day=d, oi=oi, funding=tuple(sorted(by_day.get(d, [])))))
            fetched += 1
            if on_progress:
                on_progress(symbol, d)
    return RefreshResult(fetched_days=fetched, missing_days=missing, errors=errors)


class BulkHistory:
    def __init__(self, symbol: str, records: Sequence[DayRecord]) -> None:
        self.symbol = symbol
        self._records = sorted(records, key=lambda r: r.day)
        self._by_day = {r.day: r for r in self._records}
        self._oi_flat = [s for r in self._records for s in r.oi]
        self._oi_index_end: dict[str, int] = {}
        n = 0
        for r in self._records:
            n += len(r.oi)
            self._oi_index_end[r.day] = n
        self._funding_flat = [e for r in self._records for e in r.funding]
        self._funding_index_end: dict[str, int] = {}
        n = 0
        for r in self._records:
            n += len(r.funding)
            self._funding_index_end[r.day] = n

    @classmethod
    def load(cls, cache_dir: Path, symbol: str, start_day: str, end_day: str) -> "BulkHistory":
        recs = [rec for d in day_range(start_day, end_day) if (rec := load_day(cache_dir, symbol, d)) is not None]
        return cls(symbol, recs)

    def first_day(self) -> str | None:
        return self._records[0].day if self._records else None

    def last_day(self) -> str | None:
        return self._records[-1].day if self._records else None

    def record(self, day: str) -> DayRecord | None:
        return self._by_day.get(day)

    def has_full_oi(self, day: str) -> bool:
        r = self._by_day.get(day)
        return r is not None and len(r.oi) == OI_SAMPLES_PER_DAY

    def coverage(self, start_day: str, end_day: str) -> float:
        days = day_range(start_day, end_day)
        return sum(1 for d in days if self.has_full_oi(d)) / len(days) if days else 0.0

    def oi_growth_pct(self, day: str) -> float | None:
        end = self._oi_index_end.get(day)
        if end is None or end < OI_GROWTH_BUCKETS * 2:
            return None
        recent = self._oi_flat[end - OI_GROWTH_BUCKETS:end]
        prior = self._oi_flat[end - 2 * OI_GROWTH_BUCKETS:end - OI_GROWTH_BUCKETS]
        s_prior = sum(s[1] for s in prior)
        return (sum(s[1] for s in recent) - s_prior) / s_prior if s_prior > 0 else 0.0

    def abs_funding(self, day: str) -> float | None:
        r = self._by_day.get(day)
        return abs(r.funding[-1][1]) if r and r.funding else None

    def funding_last(self, day: str) -> float | None:
        """Signed last funding event of the day (unlike abs_funding, which
        drops the sign). Used by the backtest's direction-bias recompute
        (spec 2026-09-26 §5.4.7) — the live producer's funding rule in
        score_direction_bias depends on the sign, not just the magnitude."""
        r = self._by_day.get(day)
        return r.funding[-1][1] if r and r.funding else None

    def abs_funding_history(self, day: str) -> list[float]:
        end = self._funding_index_end.get(day)
        if end is None:
            return []
        return [abs(e[1]) for e in self._funding_flat[max(0, end - FUNDING_HISTORY_EVENTS):end]]
