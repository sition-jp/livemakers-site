import io
import json
import zipfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from producer.bulk_history import (
    FUNDING_URL,
    BulkHistory,
    DayRecord,
    RefreshResult,
    day_range,
    fetch_funding_range,
    fetch_metrics_day,
    load_day,
    metrics_url,
    parse_metrics_csv,
    refresh,
    save_day,
)

HEADER = "create_time,symbol,sum_open_interest,sum_open_interest_value,count_toptrader_long_short_ratio,sum_toptrader_long_short_ratio,count_long_short_ratio,sum_taker_long_short_vol_ratio\n"


def _ms(day: str, hh: int, mm: int = 0) -> int:
    return int(datetime.strptime(f"{day} {hh:02d}:{mm:02d}", "%Y-%m-%d %H:%M").replace(tzinfo=timezone.utc).timestamp() * 1000)


def _csv(day: str, oi_by_hour: dict[int, float], *, minute_offset: int = 0) -> str:
    rows = [HEADER]
    for hh, oi in sorted(oi_by_hour.items()):
        rows.append(f"{day} {hh:02d}:{minute_offset:02d}:00,BTCUSDT,{oi},{oi * 60000},2.1,1.5,2.1,1.6\n")
    return "".join(rows)


def _zip(csv_text: str, name: str = "BTCUSDT-metrics-2026-09-20.csv") -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr(name, csv_text)
    return buf.getvalue()


def test_metrics_url() -> None:
    assert metrics_url("BTCUSDT", "2026-09-20") == "https://data.binance.vision/data/futures/um/daily/metrics/BTCUSDT/BTCUSDT-metrics-2026-09-20.zip"


def test_parse_metrics_csv_takes_the_six_aligned_samples() -> None:
    full = {h: 100.0 + h for h in range(0, 24)}   # every hour present
    samples = parse_metrics_csv(_csv("2026-09-20", full))
    assert [s[0] for s in samples] == [_ms("2026-09-20", h) for h in (0, 4, 8, 12, 16, 20)]
    assert [s[1] for s in samples] == [100.0, 104.0, 108.0, 112.0, 116.0, 120.0]
    assert samples[0][2] == 100.0 * 60000


def test_parse_metrics_csv_tolerates_a_late_sample_within_ten_minutes() -> None:
    samples = parse_metrics_csv(_csv("2026-09-20", {0: 1.0, 4: 2.0, 8: 3.0, 12: 4.0, 16: 5.0, 20: 6.0}, minute_offset=5))
    assert len(samples) == 6 and samples[0][1] == 1.0


def test_parse_metrics_csv_reports_missing_samples() -> None:
    samples = parse_metrics_csv(_csv("2026-09-20", {0: 1.0, 4: 2.0, 12: 4.0}))
    assert len(samples) == 3


def test_fetch_metrics_day_returns_none_on_404() -> None:
    assert fetch_metrics_day(lambda url: (404, b""), "BTCUSDT", "2026-09-27") is None


def test_fetch_metrics_day_unzips_and_parses() -> None:
    body = _zip(_csv("2026-09-20", {h: 1.0 for h in (0, 4, 8, 12, 16, 20)}))
    samples = fetch_metrics_day(lambda url: (200, body), "BTCUSDT", "2026-09-20")
    assert samples is not None and len(samples) == 6


def test_fetch_metrics_day_raises_on_other_http_errors() -> None:
    with pytest.raises(RuntimeError, match="503"):
        fetch_metrics_day(lambda url: (503, b"x"), "BTCUSDT", "2026-09-20")


def test_fetch_funding_range_pages_until_short_page() -> None:
    pages = {
        0: [{"fundingTime": _ms("2026-09-20", 0), "fundingRate": "0.0001"}] * 1000,
        1: [{"fundingTime": _ms("2026-09-21", 8), "fundingRate": "-0.0002"}],
    }
    calls: list[str] = []

    def http_get(url: str):
        calls.append(url)
        idx = len(calls) - 1
        return 200, json.dumps(pages[idx]).encode()

    events = fetch_funding_range(http_get, "BTCUSDT", _ms("2026-09-20", 0), _ms("2026-09-22", 0))
    assert len(calls) == 2 and calls[0].startswith(FUNDING_URL)
    assert "startTime=" in calls[1] and events[-1] == (_ms("2026-09-21", 8), -0.0002)


def test_save_and_load_day_roundtrip(tmp_path: Path) -> None:
    rec = DayRecord(day="2026-09-20", oi=((_ms("2026-09-20", 0), 1.0, 60000.0),), funding=((_ms("2026-09-20", 0), 0.0001),))
    save_day(tmp_path, "BTCUSDT", rec)
    assert load_day(tmp_path, "BTCUSDT", "2026-09-20") == rec
    assert load_day(tmp_path, "BTCUSDT", "2026-09-21") is None


def test_day_range_inclusive() -> None:
    assert day_range("2026-09-28", "2026-10-01") == ["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01"]


def test_refresh_fetches_only_missing_days_and_records_404(tmp_path: Path) -> None:
    save_day(tmp_path, "BTCUSDT", DayRecord(day="2026-09-20", oi=tuple((_ms("2026-09-20", h), 1.0, 1.0) for h in (0, 4, 8, 12, 16, 20)), funding=((_ms("2026-09-20", 0), 0.0001),)))
    fetched: list[str] = []

    def http_get(url: str):
        fetched.append(url)
        if "metrics" in url and "2026-09-22" in url:
            return 404, b""
        if "metrics" in url:
            return 200, _zip(_csv("2026-09-21", {h: 2.0 for h in (0, 4, 8, 12, 16, 20)}), "BTCUSDT-metrics-2026-09-21.csv")
        return 200, json.dumps([{"fundingTime": _ms("2026-09-21", 0), "fundingRate": "0.0001"}]).encode()

    result = refresh(tmp_path, ["BTCUSDT"], "2026-09-20", "2026-09-22", http_get)
    assert isinstance(result, RefreshResult)
    assert not any("2026-09-20" in u for u in fetched)          # cached day not refetched
    assert result.missing_days == {"BTCUSDT": ["2026-09-22"]}   # not yet published on the bulk host
    assert load_day(tmp_path, "BTCUSDT", "2026-09-21") is not None


def test_refresh_does_not_cache_days_when_funding_fetch_fails(tmp_path: Path) -> None:
    def http_get(url: str):
        if "fundingRate" in url:
            return 503, b""
        return 200, _zip(_csv("2026-09-21", {h: 2.0 for h in (0, 4, 8, 12, 16, 20)}), "BTCUSDT-metrics-2026-09-21.csv")

    result = refresh(tmp_path, ["BTCUSDT"], "2026-09-21", "2026-09-21", http_get)
    assert result.fetched_days == 0
    assert load_day(tmp_path, "BTCUSDT", "2026-09-21") is None
    assert any("funding" in e for e in result.errors)


def _history(days: int, oi_value=lambda i: 100.0, funding_value=lambda i: 0.0001) -> BulkHistory:
    records = []
    start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    for i in range(days):
        d = (start + timedelta(days=i)).strftime("%Y-%m-%d")
        oi = tuple((_ms(d, h), oi_value(i), oi_value(i) * 2) for h in (0, 4, 8, 12, 16, 20))
        fu = tuple((_ms(d, h), funding_value(i)) for h in (0, 8, 16))
        records.append(DayRecord(day=d, oi=oi, funding=fu))
    return BulkHistory("BTCUSDT", records)


def test_oi_growth_matches_live_definition() -> None:
    # first 14 days OI=100, next 14 days OI=110 → growth = (110*84 - 100*84) / (100*84) = 0.10
    h = _history(28, oi_value=lambda i: 100.0 if i < 14 else 110.0)
    assert h.oi_growth_pct("2026-01-28") == pytest.approx(0.10)
    assert h.oi_growth_pct("2026-01-27") is None   # fewer than 168 samples available


def test_abs_funding_and_history_windows() -> None:
    h = _history(70, funding_value=lambda i: -0.0003 if i == 69 else 0.0001)
    assert h.abs_funding("2026-03-11") == pytest.approx(0.0003)
    hist = h.abs_funding_history("2026-03-11")
    assert len(hist) == 180 and hist[-1] == pytest.approx(0.0003)


def test_funding_last_returns_signed_last_event() -> None:
    """Task 31: funding_last is signed (unlike abs_funding), so the direction
    bias scorer can tell shorts-paying-longs (negative) from
    longs-paying-shorts (positive) — score_direction_bias's funding rule
    depends on the sign, not just the magnitude."""
    h = _history(70, funding_value=lambda i: -0.0003 if i == 69 else 0.0001)
    assert h.funding_last("2026-03-11") == pytest.approx(-0.0003)
    assert h.funding_last("2026-03-10") == pytest.approx(0.0001)


def test_funding_last_none_when_no_record_or_no_events() -> None:
    h = _history(5)
    assert h.funding_last("2099-01-01") is None  # no cached day at all
    no_events = BulkHistory(
        "BTCUSDT",
        [DayRecord(day="2026-01-01", oi=h._records[0].oi, funding=())],
    )
    assert no_events.funding_last("2026-01-01") is None


def test_coverage_counts_only_full_oi_days() -> None:
    h = _history(10)
    partial = BulkHistory("BTCUSDT", list(h._records)[:-1] + [DayRecord(day="2026-01-10", oi=h._records[-1].oi[:3], funding=h._records[-1].funding)])
    assert h.coverage("2026-01-01", "2026-01-10") == 1.0
    assert partial.coverage("2026-01-01", "2026-01-10") == pytest.approx(0.9)
    assert partial.coverage("2026-01-01", "2026-01-20") == pytest.approx(9 / 20)
