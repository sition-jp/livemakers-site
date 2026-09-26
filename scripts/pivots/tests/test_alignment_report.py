from datetime import datetime, timezone

from ops.alignment_report import AVG_TOL, PASS_RATIO, compare, gate, render_markdown
from producer.bulk_history import BulkHistory, DayRecord


def _ms(day: str, hh: int) -> int:
    return int(datetime.strptime(f"{day} {hh:02d}", "%Y-%m-%d %H").replace(tzinfo=timezone.utc).timestamp() * 1000)


def _bulk(days: dict[str, float]) -> BulkHistory:
    return BulkHistory("BTCUSDT", [DayRecord(day=d, oi=tuple((_ms(d, h), v, v) for h in (0, 4, 8, 12, 16, 20)), funding=()) for d, v in days.items()])


def _live(days: dict[str, float]) -> dict[str, dict]:
    return {d: {"sample_count": 6, "avg": v, "min": v, "max": v, "first": v, "last": v} for d, v in days.items()}


def test_compare_only_overlapping_full_days() -> None:
    live = _live({"2026-09-01": 100.0, "2026-09-02": 100.0})
    live["2026-09-03"] = {"sample_count": 0, "avg": 0, "min": 0, "max": 0, "first": 0, "last": 0}
    stats = compare(live, _bulk({"2026-09-01": 100.0, "2026-09-02": 100.4, "2026-09-04": 100.0}))
    assert stats.days == 2
    assert stats.avg_within == 2 and stats.extreme_within == 2


def test_gate_fails_when_too_many_days_deviate() -> None:
    live = _live({f"2026-09-{d:02d}": 100.0 for d in range(1, 21)})
    bulk = _bulk({f"2026-09-{d:02d}": (100.0 if d <= 18 else 102.0) for d in range(1, 21)})
    stats = compare(live, bulk)
    assert stats.days == 20 and stats.avg_within == 18
    assert gate(stats) is False          # 18/20 = 0.90 < PASS_RATIO


def test_gate_passes_at_ratio() -> None:
    live = _live({f"2026-09-{d:02d}": 100.0 for d in range(1, 21)})
    bulk = _bulk({f"2026-09-{d:02d}": (100.0 if d <= 19 else 102.0) for d in range(1, 21)})
    assert gate(compare(live, bulk)) is True   # 19/20 = 0.95


def test_render_markdown_mentions_tolerances() -> None:
    md = render_markdown(compare(_live({"2026-09-01": 100.0}), _bulk({"2026-09-01": 100.0})))
    assert f"{AVG_TOL * 100:.1f}%" in md and f"{PASS_RATIO * 100:.0f}%" in md
