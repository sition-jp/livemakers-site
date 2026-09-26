"""Alignment gate: live sidecar (openInterestHist 4h) vs bulk history (metrics 5-min, 4h-aligned).

PASS when, over all overlapping days with 6 samples on both sides,
  |avg_bulk - avg_live| / avg_live <= AVG_TOL      for >= PASS_RATIO of days, and
  max(|min diff|, |max diff|) / avg_live <= EXTREME_TOL for >= PASS_RATIO of days.
first/last are reported but not gated (they depend on sample timing). Spec §5.4.3.
"""
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, field
from pathlib import Path

from producer.bulk_history import BulkHistory, OI_SAMPLES_PER_DAY

AVG_TOL = 0.005
EXTREME_TOL = 0.02
PASS_RATIO = 0.95


@dataclass
class AlignmentStats:
    days: int = 0
    avg_within: int = 0
    extreme_within: int = 0
    worst_avg_rel: float = 0.0
    worst_extreme_rel: float = 0.0
    first_last_rel: list[float] = field(default_factory=list)
    offenders: list[tuple[str, float, float]] = field(default_factory=list)   # (day, avg_rel, extreme_rel)


def _bulk_stats(history: BulkHistory, day: str) -> dict | None:
    rec = history.record(day)
    if rec is None or len(rec.oi) != OI_SAMPLES_PER_DAY:
        return None
    vals = [s[1] for s in rec.oi]
    return {"avg": sum(vals) / len(vals), "min": min(vals), "max": max(vals), "first": vals[0], "last": vals[-1]}


def compare(live_rows: dict[str, dict], history: BulkHistory) -> AlignmentStats:
    st = AlignmentStats()
    for day, live in sorted(live_rows.items()):
        if live.get("sample_count") != OI_SAMPLES_PER_DAY or live["avg"] <= 0:
            continue
        bulk = _bulk_stats(history, day)
        if bulk is None:
            continue
        st.days += 1
        avg_rel = abs(bulk["avg"] - live["avg"]) / live["avg"]
        extreme_rel = max(abs(bulk["min"] - live["min"]), abs(bulk["max"] - live["max"])) / live["avg"]
        st.first_last_rel.append(max(abs(bulk["first"] - live["first"]), abs(bulk["last"] - live["last"])) / live["avg"])
        st.worst_avg_rel = max(st.worst_avg_rel, avg_rel)
        st.worst_extreme_rel = max(st.worst_extreme_rel, extreme_rel)
        if avg_rel <= AVG_TOL:
            st.avg_within += 1
        if extreme_rel <= EXTREME_TOL:
            st.extreme_within += 1
        if avg_rel > AVG_TOL or extreme_rel > EXTREME_TOL:
            st.offenders.append((day, avg_rel, extreme_rel))
    return st


def gate(st: AlignmentStats) -> bool:
    if st.days == 0:
        return False
    return st.avg_within / st.days >= PASS_RATIO and st.extreme_within / st.days >= PASS_RATIO


def render_markdown(st: AlignmentStats) -> str:
    verdict = "PASS" if gate(st) else "FAIL"
    lines = [
        f"# Alignment gate: {verdict}",
        "",
        f"- overlapping full days: {st.days}",
        f"- avg within {AVG_TOL * 100:.1f}%: {st.avg_within}/{st.days} (need >= {PASS_RATIO * 100:.0f}%)",
        f"- min/max within {EXTREME_TOL * 100:.1f}%: {st.extreme_within}/{st.days}",
        f"- worst avg deviation: {st.worst_avg_rel * 100:.3f}% / worst min-max deviation: {st.worst_extreme_rel * 100:.3f}%",
        f"- first/last deviation (informational, not gated): worst {max(st.first_last_rel, default=0.0) * 100:.3f}%",
    ]
    if st.offenders:
        lines += ["", "| day | avg rel | min/max rel |", "|---|---|---|"]
        lines += [f"| {d} | {a * 100:.3f}% | {e * 100:.3f}% |" for d, a, e in st.offenders]
    return "\n".join(lines) + "\n"


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--sidecar", type=Path, required=True)
    p.add_argument("--cache-dir", type=Path, required=True)
    p.add_argument("--json", type=Path)
    a = p.parse_args()
    sidecar = json.loads(a.sidecar.read_text(encoding="utf-8"))
    all_pass = True
    out: dict[str, dict] = {}
    for symbol, node in sidecar["assets"].items():
        live = {row["bucket_start"][:10]: row["open_interest"] for row in node["history"]}
        pair = f"{symbol}USDT"
        days = sorted(live)
        history = BulkHistory.load(a.cache_dir, pair, days[0], days[-1])
        st = compare(live, history)
        sys.stdout.write(f"\n## {symbol}\n\n" + render_markdown(st))
        all_pass &= gate(st)
        out[symbol] = {"days": st.days, "avg_within": st.avg_within, "extreme_within": st.extreme_within, "pass": gate(st)}
    if a.json:
        a.json.write_text(json.dumps(out, indent=2), encoding="utf-8")
    return 0 if all_pass else 2


if __name__ == "__main__":
    sys.exit(main())
