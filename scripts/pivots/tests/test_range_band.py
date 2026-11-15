import json

import pytest

from producer import range_band

PINNED = {
    "BTC": {("both", 7): 0.2687, ("both", 30): 0.2700, ("both", 90): 0.2264, ("up", 7): 0.2062,
            ("down", 7): 0.1758, ("up", 30): 0.2688, ("down", 30): 0.2135},
    "ETH": {("both", 7): 0.2823, ("both", 30): 0.2951, ("both", 90): 0.2258, ("up", 7): 0.2118,
            ("down", 7): 0.1921, ("up", 30): 0.2785, ("down", 30): 0.2289},
}


def test_shipped_usual_loads():
    u = range_band.load_usual()
    assert len(u) == 14
    assert u[("BTC", "both", 7)] == 0.2687
    assert u[("ETH", "down", 30)] == 0.2289


def test_usual_matches_ledger_pinned_values():
    u = range_band.load_usual()
    for asset, d in PINNED.items():
        for (side, h), v in d.items():
            assert u[(asset, side, h)] == v


def test_k_values():
    k = range_band.load_k()
    assert k[("both", 7)] == 1.25
    assert k[("both", 30)] == 1.5
    for key in (("up", 7), ("down", 7), ("up", 30), ("down", 30)):
        assert k[key] == 1.0


def _write(tmp_path, d):
    p = tmp_path / "q.json"
    p.write_text(json.dumps(d), encoding="utf-8")
    return p


def test_corrupt_usual_raises(tmp_path):
    with pytest.raises(ValueError):
        range_band.load_usual(_write(tmp_path, {"question_set": "x"}))
    with pytest.raises(ValueError):
        range_band.load_usual(_write(tmp_path, {"rates": {"BTC": {"both|7": 1.5}}}))
