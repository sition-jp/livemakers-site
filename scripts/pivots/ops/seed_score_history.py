"""One-time seed for the rolling per-asset score history (spec §5.8 T-P1).

The timeline chart needs, per asset, up to HISTORY_MAX_DAYS days of
{date, close, overall per horizon, lean per horizon}. From day one onward the
producer self-accumulates this (see producer.run_producer._carry_history),
but on day one there is nothing to accumulate from — this CLI backfills the
initial block once, from the site repo's own git history of daily
`data/pivot_assets.live.json` snapshots (same git-log/git-show approach as
ops/observation_digest.py), joined against Binance daily closes.

Unlike ops/observation_digest.py (which buckets by *JST publication day* for
a human-facing weekly report), the score history uses the *UTC calendar day*
of each snapshot's `generated_at` — the same day key the producer writes at
runtime (`generated_at[:10]`) — so a seeded entry and a producer-written entry
for the same day are the same entry.

Usage:
    .venv/bin/python -m ops.seed_score_history --repo <site checkout> \\
        --assets-path <runner assets json> [--ref origin/main] [--write]

Without --write this only reports counts and the first/last entry per asset
and leaves --assets-path untouched (dry-run, the default). With --write it
copies the existing target to `<target>.seed.bak` (if the target exists),
then writes atomically (tmp + os.replace), touching only the `history` key —
every other top-level key in the existing file is preserved unchanged.
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

from producer.atomic_write import atomic_write_json
from producer.fetch_binance import BinanceFetcher
from producer.run_producer import HISTORY_MAX_DAYS, _lean, _read_json_or_none

SNAPSHOT_PATH = "data/pivot_assets.live.json"

RunGit = Callable[[list[str]], str]


def collect_commits(run_git: RunGit, ref: str) -> list[dict]:
    """Return one parsed snapshot payload per UTC calendar day, oldest first.

    Reads every commit that touched SNAPSHOT_PATH on `ref`; when a day has
    more than one commit (e.g. a kickstart rerun) the latest `generated_at`
    for that day wins, mirroring producer._carry_history's same-day replace.
    """
    log = run_git(["log", "--format=%H %cI", ref, "--", SNAPSHOT_PATH])
    by_day: dict[str, dict] = {}
    for line in log.splitlines():
        line = line.strip()
        if not line:
            continue
        sha = line.split()[0]
        raw = json.loads(run_git(["show", f"{sha}:{SNAPSHOT_PATH}"]))
        generated_at = raw.get("generated_at")
        if not isinstance(generated_at, str) or len(generated_at) < 10:
            continue
        day = generated_at[:10]
        existing = by_day.get(day)
        if existing is None or generated_at > existing["generated_at"]:
            by_day[day] = raw
    return [by_day[day] for day in sorted(by_day)]


def _closes_by_utc_date(fetcher: BinanceFetcher, asset: str) -> dict[str, float]:
    """UTC calendar day (candle open date) -> close, from the last 200 daily candles."""
    return {
        datetime.fromtimestamp(c.open_time / 1000, tz=timezone.utc).strftime("%Y-%m-%d"): c.close
        for c in fetcher.fetch_klines(asset, interval="1d", limit=200)
    }


def build_history(commits: list[dict], fetcher: BinanceFetcher) -> dict[str, list[dict]]:
    """Join each day's snapshot against that day's Binance close per asset.

    A commit-day with no matching close (outside the 200-day klines window,
    or a gap) is dropped for that asset rather than emitted with a null
    close — the schema requires `close` to be a positive number. Entries are
    sorted ascending by date and capped to the most recent HISTORY_MAX_DAYS.
    """
    out: dict[str, list[dict]] = {}
    for asset in ("BTC", "ETH"):
        closes = _closes_by_utc_date(fetcher, asset)
        entries: list[dict] = []
        for raw in commits:
            day = raw["generated_at"][:10]
            close = closes.get(day)
            if close is None:
                continue
            entries.append(
                {
                    "date": day,
                    "close": float(close),
                    "overall": {
                        h: float(raw["detail"][f"{asset}__{h}"]["scores"]["overall"])
                        for h in ("7D", "30D", "90D")
                    },
                    "lean": {
                        h: _lean(raw["detail"][f"{asset}__{h}"])
                        for h in ("7D", "30D", "90D")
                    },
                }
            )
        entries.sort(key=lambda e: e["date"])
        out[asset] = entries[-HISTORY_MAX_DAYS:]
    return out


def _print_report(history: dict[str, list[dict]]) -> None:
    for asset in ("BTC", "ETH"):
        entries = history.get(asset, [])
        print(f"[seed-score-history] {asset}: {len(entries)} entries")
        if entries:
            print(f"[seed-score-history] {asset} first={entries[0]}")
            print(f"[seed-score-history] {asset} last={entries[-1]}")


def run(
    run_git: RunGit,
    fetcher: BinanceFetcher,
    assets_path: Path,
    ref: str,
    write: bool,
) -> int:
    commits = collect_commits(run_git, ref)
    history = build_history(commits, fetcher)
    _print_report(history)

    if not write:
        print("[seed-score-history] dry-run — pass --write to persist (no files touched)")
        return 0

    existing = _read_json_or_none(assets_path) or {}
    if assets_path.exists():
        bak_path = assets_path.with_name(assets_path.name + ".seed.bak")
        shutil.copy2(assets_path, bak_path)
        print(f"[seed-score-history] backed up existing file to {bak_path}")

    merged = dict(existing)
    merged["history"] = history
    atomic_write_json(assets_path, merged)
    print(f"[seed-score-history] wrote history to {assets_path}")
    return 0


def main() -> int:
    p = argparse.ArgumentParser(
        description="One-time seed of rolling per-asset score history from git history of daily snapshots"
    )
    p.add_argument("--repo", required=True, help="path to the site repo checkout")
    p.add_argument("--ref", default="origin/main")
    p.add_argument("--assets-path", required=True, type=Path)
    p.add_argument(
        "--write", action="store_true",
        help="persist the seeded history (default is dry-run: report only, no files touched)",
    )
    args = p.parse_args()

    def run_git(git_args: list[str]) -> str:
        return subprocess.run(
            ["git", "-C", args.repo, *git_args], check=True, capture_output=True, text=True
        ).stdout

    return run(
        run_git=run_git,
        fetcher=BinanceFetcher(),
        assets_path=args.assets_path,
        ref=args.ref,
        write=args.write,
    )


if __name__ == "__main__":
    sys.exit(main())
