import json
from pathlib import Path

import pytest

from producer.forecast import FROZEN_PATH, forecast_items, load_frozen, today_pct
from tests.test_freeze_iteration import _cal


@pytest.fixture
def frozen(tmp_path):
    p = tmp_path / "f.json"
    d = _cal(); d["evaluation"] = {}
    p.write_text(json.dumps(d))
    return load_frozen(p)


def test_today_pct_is_bin_prob_times_100(frozen):
    assert today_pct(frozen, "BTC", "turn", "7D", 45) == 60.0
    assert today_pct(frozen, "BTC", "move", "30D", 0) == 40.0
    assert today_pct(frozen, "ETH", "turn", "90D", 100) == 80.0


def test_forecast_items_six_with_score_types(frozen):
    scores = {"7D": (45, 5), "30D": (65, 25), "90D": (85, 45)}
    items = forecast_items(frozen, "BTC", scores, None)
    assert len(items) == 6
    got = {(i["event"], i["horizon"]): i for i in items}
    assert got[("turn", "7D")]["today_pct"] == 60.0       # price_pivot 45
    assert got[("move", "7D")]["today_pct"] == 40.0       # volatility_pivot 5
    assert got[("turn", "90D")]["today_pct"] == 80.0
    assert got[("move", "30D")]["usual_pct"] == 55.0
    assert all("prev_today_pct" not in i for i in items)


def test_prev_today_pct_from_previous(frozen):
    scores = {"7D": (45, 5), "30D": (45, 5), "90D": (45, 5)}
    prev = [{"event": "turn", "horizon": "7D", "today_pct": 51.5, "usual_pct": 55.0}]
    got = {(i["event"], i["horizon"]): i for i in forecast_items(frozen, "BTC", scores, prev)}
    assert got[("turn", "7D")]["prev_today_pct"] == 51.5
    assert "prev_today_pct" not in got[("move", "7D")]


def test_missing_horizon_score_is_omitted_not_zero(frozen):
    items = forecast_items(frozen, "BTC", {"7D": (45, 5)}, None)
    assert len(items) == 2


def test_shipped_frozen_file_loads():
    fr = load_frozen(FROZEN_PATH)
    assert fr.iteration == "it-2026-10"
    assert len(forecast_items(fr, "ETH", {h: (50, 50) for h in ("7D", "30D", "90D")}, None)) == 6


def test_corrupt_frozen_raises(tmp_path):
    p = tmp_path / "f.json"; p.write_text("{not json")
    with pytest.raises(Exception):
        load_frozen(p)
