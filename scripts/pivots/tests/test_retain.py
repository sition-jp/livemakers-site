"""Snapshot retention: keep last N successful snapshots, gitignored.

Behaviour pinned by these tests:
- After a successful live-write, retain.archive(target) copies the file to
  history_dir with name `<basename>.YYYYMMDDTHHMMSSZ.json`.
- After archive, retain.prune(history_dir, basename, keep=N) deletes the
  oldest archived files for that basename so only N remain.
- Files NOT matching the basename pattern are never touched (so other
  snapshots in the same dir are safe).
- prune() is idempotent — running it on a dir with fewer than N keeps
  nothing changed.
"""
from __future__ import annotations

import json
import time
from pathlib import Path

import pytest

from ops.retain import archive, prune


@pytest.fixture
def history(tmp_path: Path) -> Path:
    h = tmp_path / "history"
    h.mkdir()
    return h


def test_archive_copies_with_iso_compact_timestamp(
    tmp_path: Path, history: Path
) -> None:
    target = tmp_path / "pivot_assets.live.json"
    target.write_text(json.dumps({"hello": "world"}))
    archived = archive(target, history, now_utc_seconds=1_715_000_000)
    assert archived.exists()
    assert archived.parent == history
    # 1715000000 ≈ 2024-05-06T12:53:20Z
    assert archived.name == "pivot_assets.live.20240506T125320Z.json"
    assert json.loads(archived.read_text()) == {"hello": "world"}
    # Source untouched.
    assert json.loads(target.read_text()) == {"hello": "world"}


def test_prune_keeps_only_last_n_for_basename(history: Path) -> None:
    base = "pivot_assets.live"
    for i, ts in enumerate(["20240501T000000Z", "20240502T000000Z", "20240503T000000Z", "20240504T000000Z"]):
        (history / f"{base}.{ts}.json").write_text(str(i))
    other = history / "pivot_backtest.live.20240501T000000Z.json"
    other.write_text("other")

    prune(history, base, keep=2)

    remaining = sorted(p.name for p in history.iterdir())
    assert remaining == [
        "pivot_assets.live.20240503T000000Z.json",
        "pivot_assets.live.20240504T000000Z.json",
        "pivot_backtest.live.20240501T000000Z.json",
    ]
    assert other.exists()


def test_prune_below_keep_is_noop(history: Path) -> None:
    base = "pivot_assets.live"
    f = history / f"{base}.20240501T000000Z.json"
    f.write_text("only one")
    prune(history, base, keep=7)
    assert f.exists()


def test_prune_unknown_basename_does_nothing(history: Path) -> None:
    f = history / "pivot_backtest.live.20240501T000000Z.json"
    f.write_text("data")
    prune(history, "pivot_assets.live", keep=0)
    assert f.exists()
