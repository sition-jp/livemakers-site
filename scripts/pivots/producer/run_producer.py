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
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterable

from producer.atomic_write import atomic_write_json
from producer.backtest_quality import build_backtest_quality_map
from producer.bulk_history import BulkHistory, default_http_get_status, refresh
from producer.compose_assets import compose_pivot_assets_snapshot
from producer.compose_backtest import (
    BACKTEST_HISTORY_START_DAY,
    compose_pivot_backtest_snapshot,
)
from producer.derivatives_sidecar import (
    compose_derivatives_history_sidecar,
    load_derivatives_history_sidecar,
)
from producer.fetch_binance import BinanceFetcher

REPO_ROOT = Path(__file__).resolve().parents[3]  # livemakers-site repo root
DEFAULT_ASSETS = REPO_ROOT / "data" / "pivot_assets.live.json"
DEFAULT_BACKTEST = REPO_ROOT / "data" / "pivot_backtest.live.json"
DEFAULT_DERIVATIVES_HISTORY = REPO_ROOT / "data" / "pivot_derivatives_history.live.json"
DEFAULT_BULK_CACHE = Path(__file__).resolve().parents[1] / ".bulk_cache"
_BULK_SYMBOLS = {"BTC": "BTCUSDT", "ETH": "ETHUSDT"}
HISTORY_MAX_DAYS = 120


def _now_iso() -> str:
    return datetime.now(tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _bak_path(target: Path) -> Path:
    return target.with_suffix(target.suffix + ".bak")


def _tmp_path(target: Path) -> Path:
    return target.with_suffix(target.suffix + ".tmp")


def _read_json_or_none(path: Path) -> dict | None:
    """Best-effort read of an existing JSON object; None on any read/parse failure.

    Used by the rolling score history step (_carry_history) to read the
    pre-existing assets file it is about to replace. Factored out on its own
    (rather than inlined) so a future second reader of the same file — e.g. a
    `previous`-style carry-forward — can share this one read.
    """
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    return raw if isinstance(raw, dict) else None


def _lean(detail: dict) -> float:
    bias = detail.get("direction_bias") or {}
    return round(float(bias.get("bullish", 0.0)) - float(bias.get("bearish", 0.0)), 1)


def _carry_history(existing_raw: dict | None, new_payload: dict, closes_by_asset: dict[str, float]) -> dict[str, list]:
    """Rolling per-asset score history (spec §5.8 T-P1): previous entries + today, capped, same-day replaced."""
    day = new_payload["generated_at"][:10]
    out: dict[str, list] = {}
    for a in ("BTC", "ETH"):
        prior: list = []
        if isinstance(existing_raw, dict) and isinstance(existing_raw.get("history"), dict):
            cand = existing_raw["history"].get(a)
            if isinstance(cand, list):
                prior = [e for e in cand if isinstance(e, dict) and isinstance(e.get("date"), str) and e["date"] != day]
        by_date = {e["date"]: e for e in prior}
        entry = {"date": day, "close": float(closes_by_asset[a]),
                 "overall": {h: float(new_payload["detail"][f"{a}__{h}"]["scores"]["overall"]) for h in ("7D", "30D", "90D")},
                 "lean": {h: _lean(new_payload["detail"][f"{a}__{h}"]) for h in ("7D", "30D", "90D")}}
        by_date[day] = entry
        out[a] = [by_date[d] for d in sorted(by_date)][-HISTORY_MAX_DAYS:]
    return out


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


def _sidecar_warning(exc: Exception) -> str:
    return f"{type(exc).__name__}: {exc}"


def _emit_sidecar_degraded(reason: str) -> None:
    print(f"[pivots-producer] sidecar_degraded={reason}")


def _emit_bulk_degraded(reason: str) -> None:
    print(f"[pivots-producer] bulk_history_degraded={reason}")


def _load_bulk_history(cache_dir: Path, start_day: str, http_get) -> dict:
    """Refresh the on-disk bulk OI/funding cache, then load it for the backtest.

    Soft-degrades (prints a marker, keeps going) on fetch errors or a stale
    tail lag; never raises. The caller (compose_pivot_backtest_snapshot, via
    its own coverage check) is what fails closed if the loaded history is too
    thin — this function's job is only to keep the cache as fresh as
    possible and to surface fetch problems as a marker for run_daily to pick
    up, not to gate the run itself.
    """
    yesterday = (datetime.now(tz=timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
    try:
        result = refresh(cache_dir, list(_BULK_SYMBOLS.values()), start_day, yesterday, http_get)
        if result.errors:
            _emit_bulk_degraded("; ".join(result.errors[:3]))
        lag = max((len(v) for v in result.missing_days.values()), default=0)
        if lag > 2:
            _emit_bulk_degraded(f"bulk_history_lag_days={lag}")
    except Exception as exc:  # noqa: BLE001
        _emit_bulk_degraded(f"{type(exc).__name__}: {exc}")
    return {
        asset: BulkHistory.load(cache_dir, symbol, start_day, yesterday)
        for asset, symbol in _BULK_SYMBOLS.items()
    }


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


def _promote_one_best_effort(tmp_path: Path, target_path: Path) -> None:
    bak = _bak_path(target_path)
    backed_up = False
    try:
        if target_path.exists():
            shutil.copy2(target_path, bak)
            backed_up = True
        os.replace(tmp_path, target_path)
    except Exception:
        if backed_up and bak.exists():
            try:
                os.replace(bak, target_path)
            except OSError:
                pass
        _unlink_quiet(tmp_path)
        raise
    _unlink_quiet(bak)


def run_producer(
    fetcher: BinanceFetcher,
    assets_path: Path,
    backtest_path: Path,
    derivatives_history_path: Path | None = None,
    dry_run: bool = False,
    skip_zod_validate: bool = False,
    repo_root: Path = REPO_ROOT,
    bulk_cache_dir: Path | None = None,
    bulk_start_day: str = BACKTEST_HISTORY_START_DAY,
    bulk_http_get=None,
) -> int:
    if derivatives_history_path is None:
        derivatives_history_path = assets_path.with_name(
            DEFAULT_DERIVATIVES_HISTORY.name
        )

    if _refuse_if_orphan_baks((assets_path, backtest_path)):
        return 1

    generated_at = _now_iso()
    assets_tmp = _tmp_path(assets_path)
    backtest_tmp = _tmp_path(backtest_path)
    derivatives_tmp = _tmp_path(derivatives_history_path)

    http_get = bulk_http_get or default_http_get_status

    try:
        history = _load_bulk_history(
            bulk_cache_dir or DEFAULT_BULK_CACHE, bulk_start_day, http_get
        )
        backtest_payload = compose_pivot_backtest_snapshot(
            fetcher, generated_at, history=history
        )
        backtest_quality = build_backtest_quality_map(backtest_payload["entries"])
        assets_payload = compose_pivot_assets_snapshot(
            fetcher,
            generated_at,
            backtest_quality_by_key=backtest_quality,
        )
    except Exception as exc:  # noqa: BLE001
        print(f"[pivots-producer] compose failed: {exc}", file=sys.stderr)
        return 1

    existing_assets_raw = _read_json_or_none(assets_path)
    try:
        closes = {
            a: fetcher.fetch_klines(a, interval="1d", limit=2)[-1].close
            for a in ("BTC", "ETH")
        }
        assets_payload["history"] = _carry_history(
            existing_assets_raw, assets_payload, closes
        )
    except Exception as exc:  # noqa: BLE001
        # Soft-degrade: the rolling history block feeds a chart, not the core
        # radar/detail contract, so a fetch/shape problem here must not block
        # an otherwise-good run (same posture as sidecar/bulk-history above).
        print(f"[pivots-producer] history_degraded={type(exc).__name__}: {exc}")

    sidecar_payload = None
    sidecar_warning: str | None = None
    sidecar_bak = _bak_path(derivatives_history_path)
    if sidecar_bak.exists():
        sidecar_warning = f"SidecarOrphanBak: {sidecar_bak}"
    else:
        try:
            existing_sidecar = load_derivatives_history_sidecar(derivatives_history_path)
            sidecar_payload = compose_derivatives_history_sidecar(
                fetcher,
                generated_at,
                existing=existing_sidecar,
            )
        except Exception as exc:  # noqa: BLE001
            sidecar_warning = _sidecar_warning(exc)

    try:
        atomic_write_json(assets_tmp, assets_payload)
        atomic_write_json(backtest_tmp, backtest_payload)
    except Exception as exc:  # noqa: BLE001
        print(f"[pivots-producer] tmp write failed: {exc}", file=sys.stderr)
        _unlink_quiet(assets_tmp)
        _unlink_quiet(backtest_tmp)
        _unlink_quiet(derivatives_tmp)
        return 1

    if sidecar_payload is not None:
        try:
            atomic_write_json(derivatives_tmp, sidecar_payload)
        except Exception as exc:  # noqa: BLE001
            sidecar_warning = _sidecar_warning(exc)
            _unlink_quiet(derivatives_tmp)

    if not skip_zod_validate:
        ok = _run_vitest_validator(repo_root, assets_tmp, backtest_tmp)
        if not ok:
            print(
                "[pivots-producer] zod validation failed; existing snapshots preserved",
                file=sys.stderr,
            )
            _unlink_quiet(assets_tmp)
            _unlink_quiet(backtest_tmp)
            _unlink_quiet(derivatives_tmp)
            return 1

    if dry_run:
        for tmp in (assets_tmp, backtest_tmp, derivatives_tmp):
            if tmp.exists():
                size = tmp.stat().st_size
                print(f"[pivots-producer] dry-run wrote {tmp.name} ({size} bytes)")
                tmp.unlink()
        if sidecar_warning:
            _emit_sidecar_degraded(sidecar_warning)
        return 0

    try:
        _promote_pair(assets_tmp, assets_path, backtest_tmp, backtest_path)
    except Exception as exc:  # noqa: BLE001
        print(f"[pivots-producer] promotion failed: {exc}", file=sys.stderr)
        _unlink_quiet(derivatives_tmp)
        return 1

    if sidecar_payload is not None and derivatives_tmp.exists():
        try:
            _promote_one_best_effort(derivatives_tmp, derivatives_history_path)
        except Exception as exc:  # noqa: BLE001
            sidecar_warning = _sidecar_warning(exc)

    if sidecar_warning:
        _emit_sidecar_degraded(sidecar_warning)

    print(f"[pivots-producer] OK generated_at={generated_at}")
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description="LiveMakersCom AI Turning Point Detector v0.1 producer")
    p.add_argument("--assets-path", type=Path, default=DEFAULT_ASSETS)
    p.add_argument("--backtest-path", type=Path, default=DEFAULT_BACKTEST)
    p.add_argument(
        "--derivatives-history-path",
        type=Path,
        default=DEFAULT_DERIVATIVES_HISTORY,
    )
    p.add_argument("--dry-run", action="store_true", help="compose+write+validate but don't promote over targets")
    p.add_argument(
        "--skip-zod-validate", action="store_true",
        help="skip the post-write Vitest zod validator (NOT RECOMMENDED outside tests)",
    )
    p.add_argument("--bulk-cache-dir", type=Path, default=DEFAULT_BULK_CACHE)
    p.add_argument("--bulk-start-day", type=str, default=BACKTEST_HISTORY_START_DAY)
    args = p.parse_args()
    return run_producer(
        fetcher=BinanceFetcher(),
        assets_path=args.assets_path,
        backtest_path=args.backtest_path,
        derivatives_history_path=args.derivatives_history_path,
        dry_run=args.dry_run,
        skip_zod_validate=args.skip_zod_validate,
        bulk_cache_dir=args.bulk_cache_dir,
        bulk_start_day=args.bulk_start_day,
    )


if __name__ == "__main__":
    sys.exit(main())
