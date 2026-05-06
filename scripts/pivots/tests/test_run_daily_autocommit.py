"""Tests for --auto-commit and --notify-ok flag wiring on run_daily.

Step-3.5 auto-commit branches are exercised in detail by Task 5;
this file starts with the wiring-only tests.
"""
from __future__ import annotations

from pathlib import Path

import pytest


def _make_paths(tmp_path: Path):
    return {
        "assets_path": tmp_path / "assets.json",
        "backtest_path": tmp_path / "backtest.json",
        "history_dir": tmp_path / "hist",
        "log_file": tmp_path / "log.jsonl",
        "keep_history": 7,
    }


class _NoopCM:
    def __enter__(self): return self
    def __exit__(self, *a): pass


def test_run_daily_signature_accepts_kw_only_flags(tmp_path, monkeypatch):
    from ops import run_daily as rd

    monkeypatch.setattr("ops.run_daily.acquire_lock", lambda _p: _NoopCM())
    monkeypatch.setattr("ops.run_daily._invoke_producer", lambda args: 0)
    monkeypatch.setattr("ops.run_daily.archive", lambda *a, **kw: None)
    monkeypatch.setattr("ops.run_daily.prune", lambda *a, **kw: None)
    monkeypatch.setattr("ops.run_daily.dispatch", lambda *a, **kw: None)

    rc = rd.run_daily(**_make_paths(tmp_path), auto_commit=False, notify_ok=False)
    assert rc == 0


def test_main_parses_auto_commit_and_notify_ok(monkeypatch):
    from ops import run_daily as rd

    captured: dict = {}

    def fake_run_daily(**kwargs):
        captured.update(kwargs)
        return 0

    monkeypatch.setattr("ops.run_daily.run_daily", fake_run_daily)
    monkeypatch.setattr("sys.argv", [
        "run_daily", "--auto-commit", "--notify-ok",
    ])
    rc = rd.main()
    assert rc == 0
    assert captured["auto_commit"] is True
    assert captured["notify_ok"] is True


def test_main_defaults_both_flags_off(monkeypatch):
    from ops import run_daily as rd

    captured: dict = {}

    def fake_run_daily(**kwargs):
        captured.update(kwargs)
        return 0

    monkeypatch.setattr("ops.run_daily.run_daily", fake_run_daily)
    monkeypatch.setattr("sys.argv", ["run_daily"])
    rd.main()
    assert captured["auto_commit"] is False
    assert captured["notify_ok"] is False
