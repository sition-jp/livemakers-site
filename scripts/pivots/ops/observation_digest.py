"""Weekly observation digest for the October usefulness judgment (spec §5.3).

Reads daily snapshots from the site repo's git history (data/pivot_assets.live.json
on origin/main), prints per-day scores per asset/horizon, and the realized 7-day
close-to-close move after each day so score and outcome sit side by side.
Reporting tool only: never touches producer data.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Callable

from producer.fetch_binance import BinanceFetcher
from producer.types import score_level

SNAPSHOT_PATH = "data/pivot_assets.live.json"
LEVEL_JA = {"Low": "静か", "Medium": "兆候あり", "High": "条件が揃いつつある", "Extreme": "条件が強い"}
JST = timezone(timedelta(hours=9))


@dataclass(frozen=True)
class SnapshotPoint:
    day: date                      # JST publication day
    generated_at: str
    scores: dict                   # symbol -> horizon -> {overall, price_pivot, volatility_pivot}


def _jst_day(generated_at: str) -> date:
    return datetime.strptime(generated_at, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc).astimezone(JST).date()


def collect_snapshots(run_git: Callable[[list[str]], str], ref: str, since: date, until: date) -> list[SnapshotPoint]:
    log = run_git(["log", "--format=%H %cI", f"--since={since.isoformat()}T00:00:00+09:00", f"--until={(until + timedelta(days=1)).isoformat()}T00:00:00+09:00", ref, "--", SNAPSHOT_PATH])
    points: dict[date, SnapshotPoint] = {}
    for line in log.splitlines():
        sha = line.split()[0]
        raw = json.loads(run_git(["show", f"{sha}:{SNAPSHOT_PATH}"]))
        day = _jst_day(raw["generated_at"])
        scores = {a["symbol"]: {h: {k: a["scores"][h][k] for k in ("overall", "price_pivot", "volatility_pivot")} for h in ("7D", "30D", "90D")} for a in raw["radar"]}
        point = SnapshotPoint(day=day, generated_at=raw["generated_at"], scores=scores)
        if day not in points or point.generated_at > points[day].generated_at:
            points[day] = point            # keep the latest snapshot of the day (kickstart reruns)
    return [points[d] for d in sorted(points)]


def realized_moves(closes_by_date: dict[date, float], days: list[date], horizon_days: int = 7) -> dict[date, float | None]:
    out: dict[date, float | None] = {}
    for d in days:
        base = closes_by_date.get(d)
        later = closes_by_date.get(d + timedelta(days=horizon_days))
        out[d] = None if base is None or later is None or base <= 0 else (later - base) / base
    return out


def render_markdown(points: list[SnapshotPoint], moves: dict[str, dict[date, float | None]]) -> str:
    lines = ["| 日付 | 資産 | 7D | 状態 | 30D | 90D | 7 日後の実現変動 |", "|---|---|---|---|---|---|---|"]
    for p in points:
        for symbol in sorted(p.scores):
            s = p.scores[symbol]
            o7 = round(s["7D"]["overall"])
            o30 = round(s["30D"]["overall"]) if "30D" in s else ""
            o90 = round(s["90D"]["overall"]) if "90D" in s else ""
            mv = moves.get(symbol, {}).get(p.day)
            mv_txt = "n/a" if mv is None else f"{mv * 100:+.1f}%"
            lines.append(f"| {p.day.isoformat()} | {symbol} | {o7} | {LEVEL_JA[score_level(o7)]} | {o30} | {o90} | {mv_txt} |")
    return "\n".join(lines) + "\n"


def _closes_by_date(fetcher: BinanceFetcher, asset: str) -> dict[date, float]:
    # Binance daily klines are keyed by UTC open day. A snapshot published at
    # JST day D was generated from data as of UTC day D-1's close, so shift
    # each candle's key forward by one day to align with the JST point days
    # that collect_snapshots() and realized_moves() use.
    return {
        datetime.fromtimestamp(c.open_time / 1000, tz=timezone.utc).date() + timedelta(days=1): c.close
        for c in fetcher.fetch_klines(asset, interval="1d", limit=120)
    }


def main() -> int:
    p = argparse.ArgumentParser(description="Turning Point weekly observation digest")
    p.add_argument("--repo", required=True)
    p.add_argument("--since", required=True, type=date.fromisoformat)
    p.add_argument("--until", required=True, type=date.fromisoformat)
    p.add_argument("--ref", default="origin/main")
    args = p.parse_args()

    def run_git(git_args: list[str]) -> str:
        return subprocess.run(["git", "-C", args.repo, *git_args], check=True, capture_output=True, text=True).stdout

    points = collect_snapshots(run_git, args.ref, args.since, args.until)
    fetcher = BinanceFetcher()
    moves = {sym: realized_moves(_closes_by_date(fetcher, sym), [pt.day for pt in points]) for sym in ("BTC", "ETH")}
    sys.stdout.write(render_markdown(points, moves))
    return 0


if __name__ == "__main__":
    sys.exit(main())
