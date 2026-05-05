"""Snapshot retention for the pivots producer.

- archive(target, history_dir, now_utc_seconds=None) copies a successfully-
  promoted snapshot file to history_dir with a UTC-compact-ISO suffix.
- prune(history_dir, basename, keep=N) deletes the oldest archived files
  matching basename so only N remain.

The history dir is gitignored (see Task 1). Retention is filesystem-only
and never touches the live target.
"""
from __future__ import annotations

import re
import shutil
import time
from datetime import datetime, timezone
from pathlib import Path

# Matches "<basename>.YYYYMMDDTHHMMSSZ.json"
_TIMESTAMP_RE = re.compile(r"\.(\d{8}T\d{6}Z)\.json$")


def _utc_compact(seconds: float) -> str:
    return datetime.fromtimestamp(seconds, tz=timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def archive(
    target: Path, history_dir: Path, now_utc_seconds: float | None = None
) -> Path:
    target = Path(target)
    history_dir = Path(history_dir)
    history_dir.mkdir(parents=True, exist_ok=True)
    if not target.exists():
        raise FileNotFoundError(f"archive target missing: {target}")
    seconds = now_utc_seconds if now_utc_seconds is not None else time.time()
    stamp = _utc_compact(seconds)
    # target.stem strips the final .json; we want "pivot_assets.live"
    base = target.name.removesuffix(".json")
    archived = history_dir / f"{base}.{stamp}.json"
    shutil.copy2(target, archived)
    return archived


def _archived_files(history_dir: Path, basename: str) -> list[Path]:
    prefix = f"{basename}."
    candidates = []
    for p in history_dir.iterdir():
        if not p.is_file() or not p.name.startswith(prefix):
            continue
        # Strict: only count files where the suffix matches the timestamp pattern.
        suffix_part = p.name[len(prefix):]
        if not _TIMESTAMP_RE.search(f".{suffix_part}"):
            continue
        candidates.append(p)
    return sorted(candidates, key=lambda p: p.name)


def prune(history_dir: Path, basename: str, keep: int) -> None:
    history_dir = Path(history_dir)
    if not history_dir.exists():
        return
    archived = _archived_files(history_dir, basename)
    if len(archived) <= keep:
        return
    to_delete = archived[: len(archived) - keep]
    for p in to_delete:
        try:
            p.unlink()
        except OSError:
            pass
