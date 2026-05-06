"""Process-level non-blocking lock for ops.run_daily.

Serializes manual / kickstart / scheduled fires so auto-commit doesn't race
on .git/index.lock and producer doesn't double-fetch Binance.
"""
from __future__ import annotations

import fcntl
import os
from contextlib import contextmanager
from pathlib import Path


class LockBusy(Exception):
    def __init__(self, holder_pid_hint: str = "unknown") -> None:
        super().__init__(
            f"another run_daily is in progress (pid hint: {holder_pid_hint})"
        )
        self.holder_pid_hint = holder_pid_hint


@contextmanager
def acquire_lock(lock_path: Path):
    """Acquire an exclusive non-blocking lock on lock_path.

    On success, writes the current pid into the file (best-effort diagnostic).
    On contention, raises LockBusy with a best-effort pid hint read from the
    file before the flock attempt.
    """
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    fh = open(lock_path, "a+")
    try:
        # Best-effort holder hint (no atomicity required — purely diagnostic)
        fh.seek(0)
        existing = fh.read().strip() or "unknown"
        try:
            fcntl.flock(fh.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except (BlockingIOError, OSError):
            fh.close()
            raise LockBusy(holder_pid_hint=existing)
        # Own the lock — overwrite with our pid
        fh.seek(0)
        fh.truncate()
        fh.write(f"{os.getpid()}\n")
        fh.flush()
        try:
            yield
        finally:
            try:
                fcntl.flock(fh.fileno(), fcntl.LOCK_UN)
            except OSError:
                pass
    finally:
        try:
            fh.close()
        except OSError:
            pass
