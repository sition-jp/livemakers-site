"""Daily ops wrapper for the pivots producer.

Pipeline:
  1. dry-run (compose + tmp + zod validate, no promotion)
  2. if dry-run rc == 0: live write (compose + tmp + zod validate + bak-rollback promote)
  3. if live rc == 0: archive both targets to history_dir + prune to keep N
  3.5 if --auto-commit: git add + commit (Task 5)
  4. always log; alert on FAILED status

Operator runs this manually or via LaunchAgent / cron.
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Sequence

from ops.alert import AlertPayload, dispatch
from ops.lock import LockBusy, acquire_lock
from ops.retain import archive, prune

REPO_ROOT = Path(__file__).resolve().parents[3]  # livemakers-site repo root
DEFAULT_ASSETS = REPO_ROOT / "data" / "pivot_assets.live.json"
DEFAULT_BACKTEST = REPO_ROOT / "data" / "pivot_backtest.live.json"
DEFAULT_DERIVATIVES_HISTORY = REPO_ROOT / "data" / "pivot_derivatives_history.live.json"
DEFAULT_HISTORY = REPO_ROOT / "data" / "pivots-history"
DEFAULT_LOG = REPO_ROOT / "scripts" / "pivots" / "ops.log.jsonl"
DEFAULT_KEEP = 7
LOCK_PATH = REPO_ROOT / "scripts" / "pivots" / ".run_daily.lock"


@dataclass(frozen=True)
class ProducerInvocation:
    returncode: int
    sidecar_warnings: list[str]
    output: str


def _now_iso() -> str:
    return datetime.now(tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _parse_sidecar_warnings(output: str) -> list[str]:
    marker = "sidecar_degraded="
    warnings: list[str] = []
    for line in output.splitlines():
        if marker in line:
            warnings.append(line.split(marker, 1)[1].strip())
    return warnings


def _invoke_producer(args: Sequence[str]) -> ProducerInvocation:
    """Subprocess the producer CLI. Returns rc plus sidecar soft warnings."""
    proc = subprocess.run(
        [sys.executable, "-m", "producer.run_producer", *args],
        cwd=str(Path(__file__).resolve().parents[1]),  # scripts/pivots
        check=False,
        capture_output=True,
        text=True,
    )
    output = f"{proc.stdout}\n{proc.stderr}"
    return ProducerInvocation(
        returncode=proc.returncode,
        sidecar_warnings=_parse_sidecar_warnings(output),
        output=output,
    )


def _truncated_output(output: str, limit: int = 3000) -> str:
    output = output.strip()
    if len(output) <= limit:
        return output
    head = output[: limit // 2]
    tail = output[-limit // 2 :]
    return f"{head}\n--- truncated producer output ---\n{tail}"


def _producer_failure_details(label: str, result: ProducerInvocation) -> str:
    base = f"producer {label} returned {result.returncode}"
    output = _truncated_output(result.output)
    return f"{base}: {output}" if output else base


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
    *,
    notify_ok: bool,
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
    dispatch(payload, log_file=log_file, notify_ok=notify_ok)


def _run_inside_lock(
    *,
    assets_path: Path,
    backtest_path: Path,
    derivatives_history_path: Path,
    history_dir: Path,
    log_file: Path,
    keep_history: int,
    targets: list[str],
    cmd_dry: str,
    cmd_live: str,
    auto_commit: bool,
    notify_ok: bool,
) -> int:
    # Step 1: dry-run
    dry_args = [
        "--assets-path", str(assets_path),
        "--backtest-path", str(backtest_path),
        "--derivatives-history-path", str(derivatives_history_path),
        "--dry-run",
    ]
    result = _invoke_producer(dry_args)
    rc = result.returncode
    if rc != 0:
        _alert(
            log_file,
            status="FAILED",
            error_type="DryRunFailed",
            command=cmd_dry,
            target_paths=targets,
            previous_snapshot_preserved=True,
            orphan_bak_present=_orphan_bak_present(assets_path, backtest_path),
            details=_producer_failure_details("dry-run", result),
            notify_ok=notify_ok,
        )
        return rc

    # Step 2: live write
    live_args = [
        "--assets-path", str(assets_path),
        "--backtest-path", str(backtest_path),
        "--derivatives-history-path", str(derivatives_history_path),
    ]
    live_result = _invoke_producer(live_args)
    rc = live_result.returncode
    sidecar_warnings = list(live_result.sidecar_warnings)
    if rc != 0:
        _alert(
            log_file,
            status="FAILED",
            error_type="LiveWriteFailed",
            command=cmd_live,
            target_paths=targets,
            previous_snapshot_preserved=True,
            orphan_bak_present=_orphan_bak_present(assets_path, backtest_path),
            details=_producer_failure_details("live-write", live_result),
            notify_ok=notify_ok,
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
        if derivatives_history_path.exists() and not sidecar_warnings:
            archive(derivatives_history_path, history_dir)
            prune(history_dir, "pivot_derivatives_history.live", keep=keep_history)
    except Exception as exc:  # noqa: BLE001
        _alert(
            log_file,
            status="FAILED",
            error_type="RetentionFailed",
            command="ops.retain.archive/prune",
            target_paths=targets,
            previous_snapshot_preserved=True,
            orphan_bak_present=False,
            details=f"{type(exc).__name__}: {exc}",
            notify_ok=notify_ok,
        )
        return 0

    # Step 3.5: auto-commit (gated by auto_commit param)
    commit_detail = ""
    if auto_commit:
        # Repo-external path guard with canonical resolution
        try:
            repo_root_resolved = REPO_ROOT.resolve()
            assets_resolved = assets_path.resolve()
            backtest_resolved = backtest_path.resolve()
            derivatives_resolved = derivatives_history_path.resolve()
            rel_assets = assets_resolved.relative_to(repo_root_resolved)
            rel_backtest = backtest_resolved.relative_to(repo_root_resolved)
            rel_derivatives = derivatives_resolved.relative_to(repo_root_resolved)
        except (OSError, ValueError):
            _alert(
                log_file,
                status="FAILED",
                error_type="AutoCommitSkipped",
                command="git -C <repo> add",
                target_paths=targets,
                previous_snapshot_preserved=True,
                orphan_bak_present=False,
                details=(
                    "path outside REPO_ROOT (canonical) — auto-commit only "
                    "supports repo-internal data files"
                ),
                notify_ok=notify_ok,
            )
            return 0

        try:
            # 1. git status --porcelain (capture stderr)
            diff = subprocess.run(
                [
                    "git", "-C", str(REPO_ROOT), "status", "--porcelain",
                    str(assets_path), str(backtest_path), str(derivatives_history_path),
                ],
                check=False, capture_output=True, text=True,
            )
            if diff.returncode != 0:
                raise RuntimeError(
                    f"git status returned {diff.returncode}: {diff.stderr.strip()}"
                )

            if diff.stdout.strip() == "":
                commit_detail = "no diff to commit"
            else:
                # 2. git add (capture stderr)
                add_proc = subprocess.run(
                    ["git", "-C", str(REPO_ROOT), "add",
                     str(assets_path), str(backtest_path), str(derivatives_history_path)],
                    check=False, capture_output=True, text=True,
                )
                if add_proc.returncode != 0:
                    raise RuntimeError(
                        f"git add returned {add_proc.returncode}: "
                        f"{add_proc.stderr.strip() or add_proc.stdout.strip()}"
                    )

                # 3. git commit --only -- <pathspec>
                #
                # `--only` scopes the commit to ONLY the listed paths regardless
                # of what else is in the index. Without it, any unrelated
                # pre-staged change the operator left in the index would be
                # swept into the daily snapshot commit when the LaunchAgent
                # fires (Codex P2 review on PR #6). The leading `--` is
                # required to disambiguate paths from refs.
                commit_msg = (
                    f"chore(pivots): daily snapshot {_now_iso()}\n\n"
                    f"assets: {rel_assets}\n"
                    f"backtest: {rel_backtest}\n"
                    f"derivatives_history: {rel_derivatives}\n"
                    f"generated by ops.run_daily --auto-commit\n"
                )
                commit_proc = subprocess.run(
                    [
                        "git", "-C", str(REPO_ROOT), "commit",
                        "--only", "-m", commit_msg,
                        "--", str(assets_path), str(backtest_path), str(derivatives_history_path),
                    ],
                    check=False, capture_output=True, text=True,
                )
                if commit_proc.returncode != 0:
                    raise RuntimeError(
                        f"git commit returned {commit_proc.returncode}: "
                        f"{commit_proc.stderr.strip() or commit_proc.stdout.strip()}"
                    )

                # 4. rev-parse — failure is non-fatal
                hash_proc = subprocess.run(
                    ["git", "-C", str(REPO_ROOT), "rev-parse", "--short", "HEAD"],
                    check=False, capture_output=True, text=True,
                )
                short_hash = hash_proc.stdout.strip()
                if hash_proc.returncode != 0 or not short_hash:
                    commit_detail = "committed hash_unknown"
                else:
                    commit_detail = f"committed {short_hash}"
        except (OSError, RuntimeError, subprocess.CalledProcessError) as exc:
            _alert(
                log_file,
                status="FAILED",
                error_type="AutoCommitFailed",
                command="git -C <repo> ...",
                target_paths=targets,
                previous_snapshot_preserved=True,
                orphan_bak_present=False,
                details=f"{type(exc).__name__}: {exc}",
                notify_ok=notify_ok,
            )
            return 0

    # Step 4: success log
    warning_detail = ""
    if sidecar_warnings:
        joined = "; ".join(sidecar_warnings)
        warning_detail = f" | sidecar degraded: {joined}"

    success_details = f"live write + archive + prune complete{warning_detail}"
    if auto_commit and commit_detail:
        success_details = f"{success_details} | {commit_detail}"

    _alert(
        log_file,
        status="OK",
        error_type="",
        command=cmd_live,
        target_paths=targets,
        previous_snapshot_preserved=True,
        orphan_bak_present=False,
        details=success_details,
        notify_ok=notify_ok,
    )
    return 0


def run_daily(
    assets_path: Path = DEFAULT_ASSETS,
    backtest_path: Path = DEFAULT_BACKTEST,
    derivatives_history_path: Path = DEFAULT_DERIVATIVES_HISTORY,
    history_dir: Path = DEFAULT_HISTORY,
    log_file: Path = DEFAULT_LOG,
    keep_history: int = DEFAULT_KEEP,
    *,
    auto_commit: bool = False,
    notify_ok: bool = False,
) -> int:
    targets = [str(assets_path), str(backtest_path), str(derivatives_history_path)]
    cmd_dry = "python -m producer.run_producer --dry-run"
    cmd_live = "python -m producer.run_producer"

    try:
        with acquire_lock(LOCK_PATH):
            return _run_inside_lock(
                assets_path=assets_path,
                backtest_path=backtest_path,
                derivatives_history_path=derivatives_history_path,
                history_dir=history_dir,
                log_file=log_file,
                keep_history=keep_history,
                targets=targets,
                cmd_dry=cmd_dry,
                cmd_live=cmd_live,
                auto_commit=auto_commit,
                notify_ok=notify_ok,
            )
    except LockBusy as exc:
        _alert(
            log_file,
            status="FAILED",
            error_type="LockBusy",
            command="ops.lock.acquire_lock",
            target_paths=targets,
            previous_snapshot_preserved=True,
            orphan_bak_present=False,
            details=(
                f"skipped; another run is active; no producer/write attempted "
                f"(pid hint: {exc.holder_pid_hint})"
            ),
            notify_ok=notify_ok,
        )
        return 0


def main() -> int:
    p = argparse.ArgumentParser(description="LiveMakersCom pivots daily ops wrapper")
    p.add_argument("--assets-path", type=Path, default=DEFAULT_ASSETS)
    p.add_argument("--backtest-path", type=Path, default=DEFAULT_BACKTEST)
    p.add_argument("--derivatives-history-path", type=Path, default=DEFAULT_DERIVATIVES_HISTORY)
    p.add_argument("--history-dir", type=Path, default=DEFAULT_HISTORY)
    p.add_argument("--log-file", type=Path, default=DEFAULT_LOG)
    p.add_argument("--keep-history", type=int, default=DEFAULT_KEEP)
    p.add_argument("--auto-commit", action="store_true", default=False)
    p.add_argument("--notify-ok", action="store_true", default=False)
    args = p.parse_args()
    return run_daily(
        assets_path=args.assets_path,
        backtest_path=args.backtest_path,
        derivatives_history_path=args.derivatives_history_path,
        history_dir=args.history_dir,
        log_file=args.log_file,
        keep_history=args.keep_history,
        auto_commit=args.auto_commit,
        notify_ok=args.notify_ok,
    )


if __name__ == "__main__":
    sys.exit(main())
