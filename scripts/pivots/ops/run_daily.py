"""Daily ops wrapper for the pivots producer.

Pipeline:
  1. dry-run (compose + tmp + zod validate, no promotion)
  2. if dry-run rc == 0: live write (compose + tmp + zod validate + bak-rollback promote)
  3. if live rc == 0: archive both targets to history_dir + prune to keep N
  4. always log; alert on FAILED status

Operator runs this manually or via LaunchAgent / cron. Auto-commit is
deferred to v0.1-live — operator inspects the log + git diff and commits
themselves.
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Sequence

from ops.alert import AlertPayload, dispatch
from ops.retain import archive, prune

REPO_ROOT = Path(__file__).resolve().parents[3]  # livemakers-site repo root
DEFAULT_ASSETS = REPO_ROOT / "data" / "pivot_assets.live.json"
DEFAULT_BACKTEST = REPO_ROOT / "data" / "pivot_backtest.live.json"
DEFAULT_HISTORY = REPO_ROOT / "data" / "pivots-history"
DEFAULT_LOG = REPO_ROOT / "scripts" / "pivots" / "ops.log.jsonl"
DEFAULT_KEEP = 7


def _now_iso() -> str:
    return datetime.now(tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _invoke_producer(args: Sequence[str]) -> int:
    """Subprocess the producer CLI. Returns its exit code."""
    proc = subprocess.run(
        [sys.executable, "-m", "producer.run_producer", *args],
        cwd=str(Path(__file__).resolve().parents[1]),  # scripts/pivots
        check=False,
    )
    return proc.returncode


def _orphan_bak_present(*paths: Path) -> bool:
    return any(Path(str(p) + ".bak").exists() for p in paths)


def _alert(
    log_file: Path,
    status: str,
    error_type: str,
    command: str,
    target_paths: list[str],
    previous_snapshot_preserved: bool,
    orphan_bak_present: bool,
    details: str = "",
) -> None:
    payload: AlertPayload = {
        "status": status,  # type: ignore[typeddict-item]
        "timestamp": _now_iso(),
        "error_type": error_type,
        "command": command,
        "target_paths": target_paths,
        "previous_snapshot_preserved": previous_snapshot_preserved,
        "orphan_bak_present": orphan_bak_present,
        "details": details,
    }
    dispatch(payload, log_file=log_file)


def run_daily(
    assets_path: Path = DEFAULT_ASSETS,
    backtest_path: Path = DEFAULT_BACKTEST,
    history_dir: Path = DEFAULT_HISTORY,
    log_file: Path = DEFAULT_LOG,
    keep_history: int = DEFAULT_KEEP,
) -> int:
    targets = [str(assets_path), str(backtest_path)]
    cmd_dry = "python -m producer.run_producer --dry-run"
    cmd_live = "python -m producer.run_producer"

    # Step 1: dry-run
    dry_args = [
        "--assets-path", str(assets_path),
        "--backtest-path", str(backtest_path),
        "--dry-run",
    ]
    rc = _invoke_producer(dry_args)
    if rc != 0:
        _alert(
            log_file,
            status="FAILED",
            error_type="DryRunFailed",
            command=cmd_dry,
            target_paths=targets,
            previous_snapshot_preserved=True,  # dry-run doesn't touch targets
            orphan_bak_present=_orphan_bak_present(assets_path, backtest_path),
            details=f"producer dry-run returned {rc}",
        )
        return rc

    # Step 2: live write
    live_args = [
        "--assets-path", str(assets_path),
        "--backtest-path", str(backtest_path),
    ]
    rc = _invoke_producer(live_args)
    if rc != 0:
        _alert(
            log_file,
            status="FAILED",
            error_type="LiveWriteFailed",
            command=cmd_live,
            target_paths=targets,
            previous_snapshot_preserved=True,  # producer's bak-rollback preserves prior on failure
            orphan_bak_present=_orphan_bak_present(assets_path, backtest_path),
            details=f"producer live-write returned {rc}",
        )
        return rc

    # Step 3: archive + prune
    try:
        if assets_path.exists():
            archive(assets_path, history_dir)
            prune(history_dir, "pivot_assets.live", keep=keep_history)
        if backtest_path.exists():
            archive(backtest_path, history_dir)
            prune(history_dir, "pivot_backtest.live", keep=keep_history)
    except Exception as exc:  # noqa: BLE001
        _alert(
            log_file,
            status="FAILED",
            error_type="RetentionFailed",
            command="ops.retain.archive/prune",
            target_paths=targets,
            previous_snapshot_preserved=True,  # live write already succeeded
            orphan_bak_present=False,
            details=f"{type(exc).__name__}: {exc}",
        )
        # Live write succeeded — retention failure shouldn't fail the wrapper.
        return 0

    # Step 4: success log (no macOS notification)
    _alert(
        log_file,
        status="OK",
        error_type="",
        command=cmd_live,
        target_paths=targets,
        previous_snapshot_preserved=True,
        orphan_bak_present=False,
        details="live write + archive + prune complete",
    )
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description="LiveMakersCom pivots daily ops wrapper")
    p.add_argument("--assets-path", type=Path, default=DEFAULT_ASSETS)
    p.add_argument("--backtest-path", type=Path, default=DEFAULT_BACKTEST)
    p.add_argument("--history-dir", type=Path, default=DEFAULT_HISTORY)
    p.add_argument("--log-file", type=Path, default=DEFAULT_LOG)
    p.add_argument("--keep-history", type=int, default=DEFAULT_KEEP)
    args = p.parse_args()
    return run_daily(
        assets_path=args.assets_path,
        backtest_path=args.backtest_path,
        history_dir=args.history_dir,
        log_file=args.log_file,
        keep_history=args.keep_history,
    )


if __name__ == "__main__":
    sys.exit(main())
