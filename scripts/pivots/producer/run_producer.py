"""Producer CLI entrypoint with failure-safe two-file promotion.

Pipeline:
1. Refuse to run if orphan ``*.bak`` files exist (recovery from a previous
   crash mid-promotion is a human decision — operator must decide whether
   the current target or the .bak is canonical, then delete one).
2. Fetch all market data for BTC and ETH.
3. Compose pivot_assets.live.json + pivot_backtest.live.json payloads.
4. Atomic-write each to ``<target>.tmp``.
5. Run the Vitest zod validator against the ``*.tmp`` files
   (also runs in --dry-run; only --skip-zod-validate disables it).
6. Dry-run path: discard tmps, report sizes, exit 0.
7. Backup-and-promote path:
   a. Copy each existing target to ``<target>.bak`` (shutil.copy2).
   b. ``os.replace`` assets_tmp → assets_target.
   c. ``os.replace`` backtest_tmp → backtest_target.
   d. On success: unlink both ``*.bak``.
   e. On failure mid-promotion: rollback by ``os.replace``-ing ``*.bak``
      back over the target (or unlink the just-promoted target if no .bak
      existed because the target was absent pre-run), unlink any leftover
      ``*.tmp``, exit 1. Any rollback failure leaves the .bak in place
      and screams to stderr — manual intervention is required.

Usage:
    .venv/bin/python -m producer.run_producer
    .venv/bin/python -m producer.run_producer --dry-run
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

from producer.atomic_write import atomic_write_json
from producer.compose_assets import compose_pivot_assets_snapshot
from producer.compose_backtest import compose_pivot_backtest_snapshot
from producer.fetch_binance import BinanceFetcher

REPO_ROOT = Path(__file__).resolve().parents[3]  # livemakers-site repo root
DEFAULT_ASSETS = REPO_ROOT / "data" / "pivot_assets.live.json"
DEFAULT_BACKTEST = REPO_ROOT / "data" / "pivot_backtest.live.json"


def _now_iso() -> str:
    return datetime.now(tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _bak_path(target: Path) -> Path:
    return target.with_suffix(target.suffix + ".bak")


def _tmp_path(target: Path) -> Path:
    return target.with_suffix(target.suffix + ".tmp")


def _unlink_quiet(path: Path) -> None:
    if path.exists():
        try:
            path.unlink()
        except OSError:
            pass


def _refuse_if_orphan_baks(targets: Iterable[Path]) -> bool:
    """Return True if any target has a leftover .bak; print + return True."""
    orphans = [_bak_path(t) for t in targets if _bak_path(t).exists()]
    if not orphans:
        return False
    msg = (
        f"[pivots-producer] orphan .bak file(s) found: {orphans}. "
        "A previous run likely crashed mid-promotion. Inspect the .bak vs the "
        "current target and delete one before re-running."
    )
    print(msg, file=sys.stderr)
    return True


def _run_vitest_validator(
    repo_root: Path, assets_tmp: Path, backtest_tmp: Path
) -> bool:
    env = os.environ.copy()
    env["PIVOTS_ASSETS_PATH"] = str(assets_tmp)
    env["PIVOTS_BACKTEST_PATH"] = str(backtest_tmp)
    result = subprocess.run(
        [
            "npx",
            "vitest",
            "run",
            "tests/pivots/output-snapshot-zod.validate.test.ts",
        ],
        cwd=str(repo_root),
        env=env,
        check=False,
    )
    return result.returncode == 0


def _promote_pair(
    assets_tmp: Path,
    assets_target: Path,
    backtest_tmp: Path,
    backtest_target: Path,
) -> None:
    """Two-file promotion with .bak rollback.

    Sequence:
      backup phase (no os.replace — uses shutil.copy2):
        - copy existing assets_target → assets_bak (only if assets_target exists)
        - copy existing backtest_target → backtest_bak (only if exists)
      promotion phase (os.replace — exactly 2 calls in happy path):
        - call 1: os.replace(assets_tmp, assets_target)
        - call 2: os.replace(backtest_tmp, backtest_target)
      rollback phase (only on failure of call 2):
        - if backed_up_assets: os.replace(assets_bak, assets_target)  [call 3]
        - else (target was absent before): unlink assets_target

    The absent-target rollback branch (Codex review 2, fix #3) is what makes
    a fresh-install partial failure leave the filesystem in its pre-run
    state rather than half-promoted.
    """
    assets_bak = _bak_path(assets_target)
    backtest_bak = _bak_path(backtest_target)
    backed_up_assets = False
    backed_up_backtest = False
    promoted_assets = False
    try:
        if assets_target.exists():
            shutil.copy2(assets_target, assets_bak)
            backed_up_assets = True
        if backtest_target.exists():
            shutil.copy2(backtest_target, backtest_bak)
            backed_up_backtest = True
        os.replace(assets_tmp, assets_target)
        promoted_assets = True
        os.replace(backtest_tmp, backtest_target)
    except Exception:
        # Rollback assets if it was already promoted.
        if promoted_assets:
            if backed_up_assets:
                try:
                    os.replace(assets_bak, assets_target)
                except OSError as roll_exc:
                    print(
                        f"[pivots-producer] CRITICAL: assets rollback failed: {roll_exc}; "
                        f"manual intervention required (.bak preserved at {assets_bak})",
                        file=sys.stderr,
                    )
                    raise
            else:
                # Target was absent before this run — delete the just-promoted
                # file to restore the original absent state. This is what makes
                # the rollback complete on a fresh install.
                _unlink_quiet(assets_target)
        # Clean any leftover tmps.
        _unlink_quiet(assets_tmp)
        _unlink_quiet(backtest_tmp)
        # Clean baks: assets_bak was either moved-back via os.replace
        # (in which case it no longer exists) or unused; backtest_bak was
        # never the target of a successful promotion so it is always safe
        # to remove if we created one.
        if backed_up_assets and not promoted_assets:
            _unlink_quiet(assets_bak)
        if backed_up_backtest:
            _unlink_quiet(backtest_bak)
        raise
    # Both promotions succeeded — clean .bak files.
    _unlink_quiet(assets_bak)
    _unlink_quiet(backtest_bak)


def run_producer(
    fetcher: BinanceFetcher,
    assets_path: Path,
    backtest_path: Path,
    dry_run: bool = False,
    skip_zod_validate: bool = False,
    repo_root: Path = REPO_ROOT,
) -> int:
    if _refuse_if_orphan_baks((assets_path, backtest_path)):
        return 1

    generated_at = _now_iso()
    assets_tmp = _tmp_path(assets_path)
    backtest_tmp = _tmp_path(backtest_path)

    try:
        assets_payload = compose_pivot_assets_snapshot(fetcher, generated_at)
        backtest_payload = compose_pivot_backtest_snapshot(fetcher, generated_at)
    except Exception as exc:  # noqa: BLE001
        print(f"[pivots-producer] compose failed: {exc}", file=sys.stderr)
        return 1

    try:
        atomic_write_json(assets_tmp, assets_payload)
        atomic_write_json(backtest_tmp, backtest_payload)
    except Exception as exc:  # noqa: BLE001
        print(f"[pivots-producer] tmp write failed: {exc}", file=sys.stderr)
        _unlink_quiet(assets_tmp)
        _unlink_quiet(backtest_tmp)
        return 1

    if not skip_zod_validate:
        ok = _run_vitest_validator(repo_root, assets_tmp, backtest_tmp)
        if not ok:
            print(
                "[pivots-producer] zod validation failed; existing snapshots preserved",
                file=sys.stderr,
            )
            _unlink_quiet(assets_tmp)
            _unlink_quiet(backtest_tmp)
            return 1

    if dry_run:
        for tmp in (assets_tmp, backtest_tmp):
            if tmp.exists():
                size = tmp.stat().st_size
                print(f"[pivots-producer] dry-run wrote {tmp.name} ({size} bytes)")
                tmp.unlink()
        return 0

    try:
        _promote_pair(assets_tmp, assets_path, backtest_tmp, backtest_path)
    except Exception as exc:  # noqa: BLE001
        print(f"[pivots-producer] promotion failed: {exc}", file=sys.stderr)
        return 1

    print(f"[pivots-producer] OK generated_at={generated_at}")
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description="LiveMakersCom AI Turning Point Detector v0.1 producer")
    p.add_argument("--assets-path", type=Path, default=DEFAULT_ASSETS)
    p.add_argument("--backtest-path", type=Path, default=DEFAULT_BACKTEST)
    p.add_argument("--dry-run", action="store_true", help="compose+write+validate but don't promote over targets")
    p.add_argument(
        "--skip-zod-validate", action="store_true",
        help="skip the post-write Vitest zod validator (NOT RECOMMENDED outside tests)",
    )
    args = p.parse_args()
    return run_producer(
        fetcher=BinanceFetcher(),
        assets_path=args.assets_path,
        backtest_path=args.backtest_path,
        dry_run=args.dry_run,
        skip_zod_validate=args.skip_zod_validate,
    )


if __name__ == "__main__":
    sys.exit(main())
