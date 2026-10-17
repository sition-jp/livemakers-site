"""it-2026-10 の較正表と評価を 1 つの凍結ファイルにまとめる。

    python -m ops.freeze_iteration --calibration <calibration_it_2026_10.json> \
        --evaluation <it-2026-10.json> --out producer/frozen/it_2026_10.json

較正表 (tables ほか) はそのまま写し、問いごとの評価を `evaluation` に足す。
判定: judged でない問いは primary/secondary とも null、judged で None は "undecidable"。
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from producer.types import ASSETS, HORIZONS

EVENTS = ("turn", "move")


def _verdict(judged: bool, v):
    if not judged:
        return None
    return "undecidable" if v is None else ("pass" if v else "fail")


def _pct(x):
    return None if x is None else round(x * 100, 1)


def build_evaluation(report: dict) -> dict:
    out: dict = {}
    for q in report["questions"]:
        judged = bool(q["judged"])
        h = q["holdout"]
        out.setdefault(q["asset"], {}).setdefault(q["event"], {})[q["horizon"]] = {
            "usual_pct": _pct(q["calibration"]["usual"]),
            "long_run_usual_pct": _pct(q["long_run"]["usual"]),
            "holdout_brier_skill": h.get("brier_skill"),
            "holdout_lift_pts": _pct(h.get("lift")),
            "holdout_n_signal": h.get("n_signal"),
            "judged": judged,
            "primary": _verdict(judged, q["verdict"]["primary_pass"]),
            "secondary": _verdict(judged, q["verdict"]["secondary_pass"]),
        }
    return out


def freeze(calibration_path: Path, evaluation_path: Path, out_path: Path) -> dict:
    cal = json.loads(Path(calibration_path).read_text(encoding="utf-8"))
    report = json.loads(Path(evaluation_path).read_text(encoding="utf-8"))
    for a in ASSETS:
        for e in EVENTS:
            for h in HORIZONS:
                try:
                    cal["tables"][a][e][h]
                except KeyError as exc:
                    raise ValueError(f"較正表が不足: {a}/{e}/{h}") from exc
    frozen = dict(cal)
    frozen["evaluation"] = build_evaluation(report)
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(
        json.dumps(frozen, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return frozen


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--calibration", required=True, type=Path)
    ap.add_argument("--evaluation", required=True, type=Path)
    ap.add_argument("--out", required=True, type=Path)
    a = ap.parse_args(argv)
    freeze(a.calibration, a.evaluation, a.out)
    print(f"wrote {a.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
