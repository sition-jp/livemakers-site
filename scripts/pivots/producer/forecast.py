"""「今日の確率」: 凍結した較正表でスコアを確率に読み替える (it-2026-10)。

較正表と評価は `frozen/it_2026_10.json` の 1 ファイルだけを読む。毎日は作り直さない
(再観測の 2 週間は凍結)。スコアが無い件は 0 にせず出さない (Review Focus 4)。
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from producer import calibration
from producer.calibration import CalibrationTable
from producer.types import HORIZONS, Horizon

FROZEN_PATH = Path(__file__).resolve().parent / "frozen" / "it_2026_10.json"
EVENTS = ("turn", "move")


@dataclass(frozen=True)
class Frozen:
    iteration: str
    train_start: str
    train_end: str
    event_score_type: dict
    tables: dict  # tables[asset][event][horizon] -> CalibrationTable
    evaluation: dict  # evaluation[asset][event][horizon] -> dict
    raw: dict


def load_frozen(path: Path = FROZEN_PATH) -> Frozen:
    d = json.loads(Path(path).read_text(encoding="utf-8"))
    tables = {
        a: {e: {h: calibration.from_json(t) for h, t in hs.items()} for e, hs in es.items()}
        for a, es in d["tables"].items()
    }
    return Frozen(
        iteration=d["iteration"],
        train_start=d["train_start"],
        train_end=d["train_end"],
        event_score_type=dict(d["event_score_type"]),
        tables=tables,
        evaluation=d.get("evaluation", {}),
        raw=d,
    )


def today_pct(frozen: Frozen, asset: str, event: str, horizon: str, score: int) -> float:
    table = frozen.tables[asset][event][horizon]
    return round(calibration.predict(table, score) * 100, 1)


def forecast_items(
    frozen: Frozen,
    asset: str,
    scores: dict,  # {Horizon: (price_pivot, volatility_pivot)}
    previous: Optional[list],
) -> list:
    prev = {
        (p.get("event"), p.get("horizon")): p.get("today_pct")
        for p in (previous or [])
        if isinstance(p, dict) and isinstance(p.get("today_pct"), (int, float))
    }
    use_idx = {"price_pivot": 0, "volatility_pivot": 1}
    out = []
    for event in EVENTS:
        idx = use_idx[frozen.event_score_type[event]]
        for h in HORIZONS:
            pair = scores.get(h)
            if pair is None:
                continue
            item = {
                "event": event,
                "horizon": h,
                "today_pct": today_pct(frozen, asset, event, h, int(pair[idx])),
                "usual_pct": round(frozen.tables[asset][event][h].usual * 100, 1),
            }
            if (event, h) in prev:
                item["prev_today_pct"] = round(float(prev[(event, h)]), 1)
            out.append(item)
    return out
