import json
from datetime import date

from ops.observation_digest import SnapshotPoint, collect_snapshots, realized_moves, render_markdown


def _snap(generated_at: str, btc7: float, eth7: float) -> str:
    sc = lambda o: {"overall": o, "price_pivot": o, "volatility_pivot": 0, "confidence_grade": "A", "main_signal": "price"}
    return json.dumps({
        "schema_version": "v0.1", "generated_at": generated_at,
        "radar": [
            {"symbol": "BTC", "scores": {"7D": sc(btc7), "30D": sc(10), "90D": sc(10)}},
            {"symbol": "ETH", "scores": {"7D": sc(eth7), "30D": sc(10), "90D": sc(10)}},
        ],
        "detail": {},
    })


def test_collect_snapshots_reads_one_point_per_commit() -> None:
    log = "aaa 2026-10-02T23:00:20+00:00\nbbb 2026-10-01T23:00:15+00:00\n"
    shows = {"aaa": _snap("2026-10-02T23:00:17Z", 30, 20), "bbb": _snap("2026-10-01T23:00:15Z", 16, 27)}

    def run_git(args):
        if args[0] == "log":
            return log
        if args[0] == "show":
            return shows[args[1].split(":")[0]]
        raise AssertionError(args)

    points = collect_snapshots(run_git, "origin/main", date(2026, 10, 1), date(2026, 10, 7))
    assert [p.day for p in points] == [date(2026, 10, 2), date(2026, 10, 3)]   # generated 23:00Z → JST 翌日
    assert points[0].scores["BTC"]["7D"]["overall"] == 16


def test_realized_moves_uses_close_7_days_later() -> None:
    closes = {date(2026, 10, d): 100.0 + d for d in range(1, 15)}
    moves = realized_moves(closes, [date(2026, 10, 2), date(2026, 10, 12)], horizon_days=7)
    assert round(moves[date(2026, 10, 2)], 4) == round((109 - 102) / 102, 4)
    assert moves[date(2026, 10, 12)] is None   # 7 日後がまだ無い


def test_render_markdown_has_one_row_per_day_and_asset() -> None:
    p = SnapshotPoint(day=date(2026, 10, 2), generated_at="2026-10-01T23:00:15Z", scores={"BTC": {"7D": {"overall": 16, "price_pivot": 16, "volatility_pivot": 0}}, "ETH": {"7D": {"overall": 27, "price_pivot": 27, "volatility_pivot": 0}}})
    md = render_markdown([p], {"BTC": {date(2026, 10, 2): 0.031}, "ETH": {date(2026, 10, 2): None}})
    assert "| 2026-10-02 | BTC | 16 | 静か |" in md
    assert "+3.1%" in md and "n/a" in md
