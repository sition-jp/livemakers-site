import json
import os
from pathlib import Path

import pytest

from ops.freeze_iteration import build_evaluation, freeze, main
from producer.forecast import load_frozen

SRC = Path(os.environ.get(
    "IT_2026_10_SOURCE_DIR",
    "/Users/sition/Documents/SITION/08_DOCS/reports/turning_point/it-2026-10",
))


def _cal() -> dict:
    bins = [{"lo": 0, "hi": 20, "prob": 0.4, "n": 5}, {"lo": 20, "hi": 40, "prob": 0.5, "n": 5},
            {"lo": 40, "hi": 60, "prob": 0.6, "n": 5}, {"lo": 60, "hi": 80, "prob": 0.7, "n": 5},
            {"lo": 80, "hi": 100, "prob": 0.8, "n": 5}]
    t = {"usual": 0.55, "bins": bins, "n": 25}
    return {"iteration": "it-2026-10", "train_start": "2021-12-28", "train_end": "2025-10-16",
            "bin_edges": [0, 20, 40, 60, 80, 101], "shrink_k": 20.0,
            "event_score_type": {"turn": "price_pivot", "move": "volatility_pivot"},
            "range_window_days": {"7D": 14, "30D": 60, "90D": 120},
            "ma_distance_windows": {"7D": [10, 20]},
            "tables": {a: {e: {h: t for h in ("7D", "30D", "90D")} for e in ("turn", "move")} for a in ("BTC", "ETH")}}


def _q(asset, event, horizon, judged, primary, secondary, lift=0.125, n_signal=4):
    return {"asset": asset, "event": event, "horizon": horizon, "judged": judged,
            "long_run": {"usual": 0.5429437521050859},
            "calibration": {"usual": 0.4727272727272727},
            "holdout": {"brier_skill": 0.0023617725248287202, "lift": lift, "n_signal": n_signal,
                        "signal_rate": 0.5, "other_rate": 0.3746397694524496, "rate": 0.37606837606837606, "n": 351},
            "verdict": {"primary_pass": primary, "secondary_pass": secondary}}


def test_build_evaluation_maps_fields_and_verdicts():
    ev = build_evaluation({"questions": [
        _q("BTC", "turn", "7D", True, True, True),
        _q("BTC", "turn", "30D", True, False, None, lift=None, n_signal=0),
        _q("BTC", "turn", "90D", False, None, None),
    ]})
    a = ev["BTC"]["turn"]["7D"]
    assert a == {"usual_pct": 47.3, "long_run_usual_pct": 54.3, "holdout_brier_skill": 0.0023617725248287202,
                 "holdout_lift_pts": 12.5, "holdout_n_signal": 4, "judged": True,
                 "signal_rate_pct": 50.0, "other_rate_pct": 37.5, "holdout_rate_pct": 37.6, "holdout_n": 351,
                 "primary": "pass", "secondary": "pass"}
    b = ev["BTC"]["turn"]["30D"]
    assert (b["primary"], b["secondary"], b["holdout_lift_pts"]) == ("fail", "undecidable", None)
    c = ev["BTC"]["turn"]["90D"]
    assert (c["judged"], c["primary"], c["secondary"]) == (False, None, None)


def test_freeze_roundtrip_with_load_frozen(tmp_path):
    cal, ev, out = tmp_path / "c.json", tmp_path / "e.json", tmp_path / "f.json"
    cal.write_text(json.dumps(_cal()))
    ev.write_text(json.dumps({"questions": [_q("BTC", "turn", "7D", True, True, True)]}))
    assert main(["--calibration", str(cal), "--evaluation", str(ev), "--out", str(out)]) == 0
    fr = load_frozen(out)
    assert fr.iteration == "it-2026-10" and fr.train_end == "2025-10-16"
    assert fr.tables["BTC"]["turn"]["7D"].bins[2][2] == 0.6
    assert fr.evaluation["BTC"]["turn"]["7D"]["primary"] == "pass"


def test_freeze_refuses_incomplete_calibration(tmp_path):
    cal = _cal()
    del cal["tables"]["ETH"]["move"]["90D"]
    c, e = tmp_path / "c.json", tmp_path / "e.json"
    c.write_text(json.dumps(cal)); e.write_text(json.dumps({"questions": []}))
    with pytest.raises(ValueError):
        freeze(c, e, tmp_path / "o.json")


def test_state_rates_keep_null():
    q = _q("BTC", "turn", "7D", True, True, True)
    q["holdout"].update({"signal_rate": None, "other_rate": None})
    a = build_evaluation({"questions": [q]})["BTC"]["turn"]["7D"]
    assert a["signal_rate_pct"] is None and a["other_rate_pct"] is None
    assert a["holdout_rate_pct"] == 37.6 and a["holdout_n"] == 351


@pytest.mark.skipif(
    not SRC.exists(),
    reason=f"it-2026-10 source reports not found at {SRC} (set IT_2026_10_SOURCE_DIR)",
)
def test_shipped_frozen_file_matches_it_2026_10_sources():
    from producer.forecast import FROZEN_PATH
    cal = json.loads((SRC / "calibration_it_2026_10.json").read_text())
    ev = json.loads((SRC / "it-2026-10.json").read_text())
    shipped = json.loads(FROZEN_PATH.read_text())
    for k, v in cal.items():
        assert shipped[k] == v
    assert shipped["evaluation"] == build_evaluation(ev)
    assert len(ev["questions"]) == 12
