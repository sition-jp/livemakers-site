"""Tests for the one-time rolling-score-history seed CLI (spec §5.8 T-P1)."""
from __future__ import annotations

import datetime as dt
import json
from pathlib import Path

import pytest

from ops.seed_score_history import HISTORY_MAX_DAYS, build_history, collect_commits, run
from producer.fetch_binance import BinanceFetcher


def _det(overall: float, lean: float) -> dict:
    bullish = 50.0 + lean / 2
    bearish = 50.0 - lean / 2
    return {
        "scores": {
            "overall": overall,
            "price_pivot": overall,
            "volatility_pivot": 0.0,
            "confidence": {"grade": "A", "score": 80.0},
        },
        "direction_bias": {"bullish": bullish, "bearish": bearish, "neutral": 0.0},
    }


def _payload(generated_at: str, btc_overall: float, btc_lean: float = 0.0) -> dict:
    detail = {}
    for a, overall in (("BTC", btc_overall), ("ETH", btc_overall / 2)):
        for h in ("7D", "30D", "90D"):
            detail[f"{a}__{h}"] = _det(overall, btc_lean if a == "BTC" else 0.0)
    return {
        "schema_version": "v0.1",
        "generated_at": generated_at,
        "radar": [],
        "detail": detail,
    }


def _klines_bytes(rows: list[tuple[str, float]]) -> bytes:
    out = []
    for date_str, close in rows:
        open_dt = dt.datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=dt.timezone.utc)
        open_ms = int(open_dt.timestamp() * 1000)
        close_ms = open_ms + 86_399_999
        out.append(
            [
                open_ms,
                str(close),
                str(close),
                str(close),
                str(close),
                "1.0",
                close_ms,
                "0",
                0,
                "0",
                "0",
                "0",
            ]
        )
    return json.dumps(out).encode()


def _fake_fetcher(btc_rows: list[tuple[str, float]], eth_rows: list[tuple[str, float]]) -> BinanceFetcher:
    canned = {
        "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=200": _klines_bytes(btc_rows),
        "https://api.binance.com/api/v3/klines?symbol=ETHUSDT&interval=1d&limit=200": _klines_bytes(eth_rows),
    }
    return BinanceFetcher(http_get=lambda url: canned[url])


def _fake_run_git(log: str, shows: dict[str, str]):
    def run_git(args: list[str]) -> str:
        if args[0] == "log":
            return log
        if args[0] == "show":
            sha = args[1].split(":")[0]
            return shows[sha]
        raise AssertionError(args)

    return run_git


# --- collect_commits ---

def test_collect_commits_keeps_latest_per_utc_date() -> None:
    log = (
        "aaa 2026-10-01T23:30:00+00:00\n"
        "bbb 2026-10-01T10:00:00+00:00\n"
        "ccc 2026-09-30T23:00:00+00:00\n"
    )
    shows = {
        "aaa": json.dumps(_payload("2026-10-01T23:30:00Z", 20.0)),
        "bbb": json.dumps(_payload("2026-10-01T10:00:00Z", 15.0)),
        "ccc": json.dumps(_payload("2026-09-30T23:00:00Z", 10.0)),
    }
    commits = collect_commits(_fake_run_git(log, shows), "origin/main")
    assert [c["generated_at"][:10] for c in commits] == ["2026-09-30", "2026-10-01"]
    # Later same-day commit (aaa, 23:30) wins over the earlier one (bbb, 10:00).
    assert commits[-1]["detail"]["BTC__7D"]["scores"]["overall"] == 20.0


def test_collect_commits_skips_blank_lines_and_sorts_by_date() -> None:
    log = "\naaa 2026-10-02T00:00:00+00:00\n\nbbb 2026-10-01T00:00:00+00:00\n"
    shows = {
        "aaa": json.dumps(_payload("2026-10-02T00:00:00Z", 5.0)),
        "bbb": json.dumps(_payload("2026-10-01T00:00:00Z", 5.0)),
    }
    commits = collect_commits(_fake_run_git(log, shows), "origin/main")
    assert [c["generated_at"][:10] for c in commits] == ["2026-10-01", "2026-10-02"]


# --- build_history ---

def test_build_history_uses_utc_open_date_and_computes_lean() -> None:
    commits = [_payload("2026-10-01T23:00:00Z", 16.0, 10.0)]
    fetcher = _fake_fetcher([("2026-10-01", 84000.0)], [("2026-10-01", 2700.0)])
    hist = build_history(commits, fetcher)
    assert set(hist) == {"BTC", "ETH"}
    assert hist["BTC"] == [
        {
            "date": "2026-10-01",
            "close": 84000.0,
            "overall": {"7D": 16.0, "30D": 16.0, "90D": 16.0},
            "lean": {"7D": 10.0, "30D": 10.0, "90D": 10.0},
        }
    ]


def test_build_history_drops_dates_without_a_matching_close() -> None:
    commits = [
        _payload("2026-09-30T23:00:00Z", 10.0),
        _payload("2026-10-01T23:00:00Z", 20.0),
    ]
    # Only 2026-10-01 has a close in the canned klines -- 2026-09-30 must be dropped.
    fetcher = _fake_fetcher([("2026-10-01", 84000.0)], [("2026-10-01", 2700.0)])
    hist = build_history(commits, fetcher)
    assert [e["date"] for e in hist["BTC"]] == ["2026-10-01"]
    assert [e["date"] for e in hist["ETH"]] == ["2026-10-01"]


def test_build_history_caps_at_120_most_recent_days() -> None:
    # 150 distinct calendar days, each with a matching close, so the cap
    # (not the dedup-by-date path) is what's exercised here.
    base = dt.date(2026, 1, 1)
    rows = [((base + dt.timedelta(days=i)).isoformat(), 1.0) for i in range(150)]
    commits = [_payload(f"{day}T00:00:00Z", float(i)) for i, (day, _) in enumerate(rows)]
    fetcher = _fake_fetcher(rows, rows)
    hist = build_history(commits, fetcher)
    assert len(hist["BTC"]) == HISTORY_MAX_DAYS
    assert hist["BTC"][-1]["date"] == rows[-1][0]
    assert [e["date"] for e in hist["BTC"]] == sorted(e["date"] for e in hist["BTC"])


# --- run() : dry-run vs --write ---

def test_run_dry_run_leaves_assets_file_unchanged(tmp_path: Path, capsys) -> None:
    assets_path = tmp_path / "pivot_assets.live.json"
    original = {"schema_version": "v0.1", "generated_at": "old", "radar": [{"symbol": "BTC"}], "detail": {"x": 1}}
    assets_path.write_text(json.dumps(original))
    log = "aaa 2026-10-01T23:00:00+00:00\n"
    shows = {"aaa": json.dumps(_payload("2026-10-01T23:00:00Z", 20.0))}
    fetcher = _fake_fetcher([("2026-10-01", 84000.0)], [("2026-10-01", 2700.0)])

    rc = run(
        run_git=_fake_run_git(log, shows),
        fetcher=fetcher,
        assets_path=assets_path,
        ref="origin/main",
        write=False,
    )

    assert rc == 0
    assert json.loads(assets_path.read_text()) == original
    assert not assets_path.with_name(assets_path.name + ".seed.bak").exists()
    out = capsys.readouterr().out
    assert "BTC" in out and "ETH" in out


def test_run_write_adds_history_and_preserves_other_keys(tmp_path: Path) -> None:
    assets_path = tmp_path / "pivot_assets.live.json"
    original = {
        "schema_version": "v0.1",
        "generated_at": "old",
        "radar": [{"symbol": "BTC"}],
        "detail": {"x": 1},
    }
    assets_path.write_text(json.dumps(original))
    log = "aaa 2026-10-01T23:00:00+00:00\n"
    shows = {"aaa": json.dumps(_payload("2026-10-01T23:00:00Z", 20.0))}
    fetcher = _fake_fetcher([("2026-10-01", 84000.0)], [("2026-10-01", 2700.0)])

    rc = run(
        run_git=_fake_run_git(log, shows),
        fetcher=fetcher,
        assets_path=assets_path,
        ref="origin/main",
        write=True,
    )

    assert rc == 0
    written = json.loads(assets_path.read_text())
    assert written["history"]["BTC"][0]["date"] == "2026-10-01"
    for key in ("schema_version", "generated_at", "radar", "detail"):
        assert written[key] == original[key]

    bak_path = assets_path.with_name(assets_path.name + ".seed.bak")
    assert json.loads(bak_path.read_text()) == original


def test_run_write_without_existing_assets_file_creates_history_only(tmp_path: Path) -> None:
    assets_path = tmp_path / "pivot_assets.live.json"
    assert not assets_path.exists()
    log = "aaa 2026-10-01T23:00:00+00:00\n"
    shows = {"aaa": json.dumps(_payload("2026-10-01T23:00:00Z", 20.0))}
    fetcher = _fake_fetcher([("2026-10-01", 84000.0)], [("2026-10-01", 2700.0)])

    rc = run(
        run_git=_fake_run_git(log, shows),
        fetcher=fetcher,
        assets_path=assets_path,
        ref="origin/main",
        write=True,
    )

    assert rc == 0
    written = json.loads(assets_path.read_text())
    assert written["history"]["BTC"][0]["date"] == "2026-10-01"
    assert not assets_path.with_name(assets_path.name + ".seed.bak").exists()
