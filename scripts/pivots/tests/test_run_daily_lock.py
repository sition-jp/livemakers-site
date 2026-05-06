"""Unit tests for ops.lock — fcntl-based non-blocking serialization."""
from __future__ import annotations

import multiprocessing
import os
from pathlib import Path

import pytest


def _hold_lock_subprocess(lock_path_str: str, ready_event, release_event):
    """Run inside a subprocess: hold the lock until release_event is set."""
    from ops.lock import acquire_lock
    with acquire_lock(Path(lock_path_str)):
        ready_event.set()
        release_event.wait(timeout=10)


def test_acquire_lock_in_clean_env_writes_pid(tmp_path):
    from ops.lock import acquire_lock

    lock_path = tmp_path / "test.lock"
    with acquire_lock(lock_path):
        contents = lock_path.read_text().strip()
        assert contents == str(os.getpid())


def test_acquire_lock_raises_lockbusy_when_held(tmp_path):
    from ops.lock import acquire_lock, LockBusy

    lock_path = tmp_path / "test.lock"
    ready = multiprocessing.Event()
    release = multiprocessing.Event()
    proc = multiprocessing.Process(
        target=_hold_lock_subprocess,
        args=(str(lock_path), ready, release),
    )
    proc.start()
    try:
        assert ready.wait(timeout=5), "subprocess never acquired the lock"
        with pytest.raises(LockBusy) as excinfo:
            with acquire_lock(lock_path):
                pytest.fail("should not have entered the context")
        assert excinfo.value.holder_pid_hint != "unknown"
    finally:
        release.set()
        proc.join(timeout=10)
        assert not proc.is_alive(), "subprocess did not exit cleanly"


def test_lock_releases_on_context_exit(tmp_path):
    from ops.lock import acquire_lock

    lock_path = tmp_path / "test.lock"
    with acquire_lock(lock_path):
        pass
    # Reacquire should succeed in the same process
    with acquire_lock(lock_path):
        pass


def test_run_daily_lockbusy_emits_failed_payload(tmp_path, monkeypatch):
    """When acquire_lock raises LockBusy, run_daily must emit
    status=FAILED, error_type=LockBusy, exit 0."""
    from ops import run_daily as rd
    from ops.lock import LockBusy

    captured: dict = {}

    def fake_dispatch(p, log_file, *, notify_ok=False):
        captured["p"] = p
        captured["log_file"] = log_file
        captured["notify_ok"] = notify_ok

    monkeypatch.setattr("ops.run_daily.dispatch", fake_dispatch)

    def fake_acquire_lock(_path):
        raise LockBusy(holder_pid_hint="98765")

    monkeypatch.setattr("ops.run_daily.acquire_lock", fake_acquire_lock)

    rc = rd.run_daily(
        assets_path=tmp_path / "assets.json",
        backtest_path=tmp_path / "backtest.json",
        history_dir=tmp_path / "hist",
        log_file=tmp_path / "log.jsonl",
        keep_history=7,
        notify_ok=True,
    )
    assert rc == 0
    p = captured["p"]
    assert p["status"] == "FAILED"
    assert p["error_type"] == "LockBusy"
    assert "skipped" in p["details"]
    assert "98765" in p["details"]
    assert captured["notify_ok"] is True
