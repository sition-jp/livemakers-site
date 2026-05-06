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
