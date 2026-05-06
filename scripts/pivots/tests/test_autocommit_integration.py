"""Integration tests for Step 3.5 auto-commit using real git invocations.

These tests are slower than the mocked branch tests in test_run_daily_autocommit.py,
but they catch behaviors mocking misses (real index.lock semantics, real exit
codes, real commit-hash format).
"""
from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path

import pytest


def _init_repo(repo: Path) -> None:
    subprocess.run(["git", "init", "-q"], cwd=repo, check=True)
    subprocess.run(["git", "config", "user.email", "test@example.com"], cwd=repo, check=True)
    subprocess.run(["git", "config", "user.name", "Test"], cwd=repo, check=True)
    # Initial commit so HEAD exists
    (repo / "README.md").write_text("init\n")
    subprocess.run(["git", "add", "README.md"], cwd=repo, check=True)
    subprocess.run(["git", "commit", "-q", "-m", "init"], cwd=repo, check=True)


def _make_data_files(repo: Path) -> tuple[Path, Path]:
    data_dir = repo / "data"
    data_dir.mkdir(exist_ok=True)
    assets = data_dir / "pivot_assets.live.json"
    backtest = data_dir / "pivot_backtest.live.json"
    assets.write_text(json.dumps({"v": 1}))
    backtest.write_text(json.dumps({"v": 1}))
    return assets, backtest


def _stub_run_daily_pipeline(monkeypatch):
    monkeypatch.setattr("ops.run_daily.acquire_lock",
                        lambda _p: _NoopCM())
    monkeypatch.setattr("ops.run_daily._invoke_producer", lambda args: 0)
    monkeypatch.setattr("ops.run_daily.archive", lambda *a, **kw: None)
    monkeypatch.setattr("ops.run_daily.prune", lambda *a, **kw: None)


class _NoopCM:
    def __enter__(self): return self
    def __exit__(self, *a): pass


def test_real_git_commit_creates_snapshot(tmp_path, monkeypatch):
    from ops import run_daily as rd

    repo = tmp_path / "repo"
    repo.mkdir()
    _init_repo(repo)
    assets, backtest = _make_data_files(repo)

    monkeypatch.setattr("ops.run_daily.REPO_ROOT", repo)
    captured: dict = {}
    monkeypatch.setattr("ops.run_daily.dispatch",
                        lambda p, log_file, *, notify_ok=False: captured.update(p=p))
    _stub_run_daily_pipeline(monkeypatch)

    rd.run_daily(
        assets_path=assets,
        backtest_path=backtest,
        history_dir=tmp_path / "hist",
        log_file=tmp_path / "log.jsonl",
        keep_history=7,
        auto_commit=True,
        notify_ok=False,
    )

    assert captured["p"]["status"] == "OK"
    log = subprocess.run(
        ["git", "log", "--oneline"], cwd=repo, capture_output=True, text=True, check=True
    )
    assert "daily snapshot" in log.stdout


def test_real_git_no_diff_does_not_commit(tmp_path, monkeypatch):
    from ops import run_daily as rd

    repo = tmp_path / "repo"
    repo.mkdir()
    _init_repo(repo)
    assets, backtest = _make_data_files(repo)
    # Pre-commit the data files so subsequent run sees no diff
    subprocess.run(["git", "add", "data"], cwd=repo, check=True)
    subprocess.run(["git", "commit", "-q", "-m", "seed"], cwd=repo, check=True)

    monkeypatch.setattr("ops.run_daily.REPO_ROOT", repo)
    captured: dict = {}
    monkeypatch.setattr("ops.run_daily.dispatch",
                        lambda p, log_file, *, notify_ok=False: captured.update(p=p))
    _stub_run_daily_pipeline(monkeypatch)

    rd.run_daily(
        assets_path=assets,
        backtest_path=backtest,
        history_dir=tmp_path / "hist",
        log_file=tmp_path / "log.jsonl",
        keep_history=7,
        auto_commit=True,
        notify_ok=False,
    )

    assert captured["p"]["status"] == "OK"
    assert "no diff" in captured["p"]["details"]
    # Only init + seed, no daily snapshot commit
    log = subprocess.run(
        ["git", "log", "--oneline"], cwd=repo, capture_output=True, text=True, check=True
    )
    assert "daily snapshot" not in log.stdout


def test_real_auto_commit_excludes_unrelated_pre_staged_changes(tmp_path, monkeypatch):
    """Regression for Codex P2 review on PR #6: a pre-staged unrelated change
    must NOT be swept into the daily snapshot commit. Step 3.5 must commit
    only the two snapshot data files and leave operator's unrelated stages
    alone in the index."""
    from ops import run_daily as rd

    repo = tmp_path / "repo"
    repo.mkdir()
    _init_repo(repo)
    assets, backtest = _make_data_files(repo)

    # Operator's unrelated WIP — pre-staged in the index before the LaunchAgent fires
    unrelated = repo / "OPERATOR_WIP.md"
    unrelated.write_text("operator WIP — must not be committed by auto-commit\n")
    subprocess.run(["git", "add", "OPERATOR_WIP.md"], cwd=repo, check=True)

    monkeypatch.setattr("ops.run_daily.REPO_ROOT", repo)
    captured: dict = {}
    monkeypatch.setattr("ops.run_daily.dispatch",
                        lambda p, log_file, *, notify_ok=False: captured.update(p=p))
    _stub_run_daily_pipeline(monkeypatch)

    rd.run_daily(
        assets_path=assets,
        backtest_path=backtest,
        history_dir=tmp_path / "hist",
        log_file=tmp_path / "log.jsonl",
        keep_history=7,
        auto_commit=True,
        notify_ok=False,
    )

    assert captured["p"]["status"] == "OK"

    # Assertion 1: HEAD commit touched ONLY the data files
    show = subprocess.run(
        ["git", "show", "--name-only", "--pretty=format:", "HEAD"],
        cwd=repo, capture_output=True, text=True, check=True,
    )
    committed_files = {line for line in show.stdout.splitlines() if line.strip()}
    assert committed_files == {
        "data/pivot_assets.live.json",
        "data/pivot_backtest.live.json",
    }, f"unexpected files in commit: {committed_files}"

    # Assertion 2: OPERATOR_WIP.md remains staged but uncommitted
    diff_cached = subprocess.run(
        ["git", "diff", "--cached", "--name-only"],
        cwd=repo, capture_output=True, text=True, check=True,
    )
    cached_files = set(diff_cached.stdout.splitlines())
    assert "OPERATOR_WIP.md" in cached_files, (
        f"OPERATOR_WIP.md should still be staged after auto-commit, got: {cached_files}"
    )


def test_real_repo_external_path_yields_skipped(tmp_path, monkeypatch):
    from ops import run_daily as rd

    repo = tmp_path / "repo"
    repo.mkdir()
    _init_repo(repo)

    external = tmp_path / "external" / "assets.json"
    external.parent.mkdir()
    external.write_text(json.dumps({"v": 1}))
    backtest = repo / "data" / "backtest.json"
    backtest.parent.mkdir()
    backtest.write_text(json.dumps({"v": 1}))

    monkeypatch.setattr("ops.run_daily.REPO_ROOT", repo)
    captured: dict = {}
    monkeypatch.setattr("ops.run_daily.dispatch",
                        lambda p, log_file, *, notify_ok=False: captured.update(p=p))
    _stub_run_daily_pipeline(monkeypatch)

    rd.run_daily(
        assets_path=external,
        backtest_path=backtest,
        history_dir=tmp_path / "hist",
        log_file=tmp_path / "log.jsonl",
        keep_history=7,
        auto_commit=True,
        notify_ok=False,
    )

    assert captured["p"]["status"] == "FAILED"
    assert captured["p"]["error_type"] == "AutoCommitSkipped"
