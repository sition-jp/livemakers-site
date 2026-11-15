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


# ---- Task 2: band ----
import math


def _series(n, amp_fn, start=100.0):
    closes, c = [], start
    for i in range(n):
        c *= math.exp(amp_fn(i) * (1 if i % 2 == 0 else -1))
        closes.append(c)
    dates = [f"d{i:04d}" for i in range(n)]
    return dates, closes


def test_threshold_formula():
    assert range_band.threshold(0.3845, 1.25, 7) == pytest.approx(0.0666, abs=1e-4)
    assert range_band.threshold(0.3845, 1.5, 30) == pytest.approx(0.1653, abs=1e-4)


def _band(n=400, amp=lambda i: 0.02):
    d, c = _series(n, amp)
    return d, c, range_band.band_json(d, c, "BTC", range_band.load_usual())


def test_band_is_symmetric_around_close():
    _, c, b = _band()
    for it in b["items"]:
        if it["side"] == "both":
            assert (it["lo"] + it["hi"]) / 2 == pytest.approx(c[-1], abs=0.01)


def test_band_uses_today_close():
    d, c, b = _band()
    assert b["close"] == c[-1] and b["as_of"] == d[-1]
    it = b["items"][0]
    assert it["hi"] == round(c[-1] * (1 + it["threshold"]), 2)
    assert it["lo"] == round(c[-1] * (1 - it["threshold"]), 2)


def test_items_ids_and_k():
    _, _, b = _band()
    got = [(i["id"], i["side"], i["horizon_days"], i["k"]) for i in b["items"]]
    assert got == [("either7", "both", 7, 1.25), ("either30", "both", 30, 1.5),
                   ("up7", "up", 7, 1.0), ("down7", "down", 7, 1.0),
                   ("up30", "up", 30, 1.0), ("down30", "down", 30, 1.0)]
    by = {i["id"]: i for i in b["items"]}
    assert "lo" not in by["up7"] and "hi" in by["up7"]
    assert "hi" not in by["down30"] and "lo" in by["down30"]
    assert by["either7"]["usual_pct"] == 26.87
    assert by["down7"]["usual_pct"] == 17.58
    assert b["source"]["question_set"] == "q-2026-11"
    assert b["source"]["version"] == "base-rate-q2026-11"


def test_threshold_365_position():
    # 低: 最後が一番静か / 高: 最後が一番荒い / 中: 途中の荒さ
    d, c = _series(400, lambda i: 0.05 if i < 360 else 0.005)
    assert range_band.band_json(d, c, "BTC", range_band.load_usual())["threshold_7d_365"]["position"] == "low"
    d, c = _series(400, lambda i: 0.005 if i < 360 else 0.05)
    assert range_band.band_json(d, c, "BTC", range_band.load_usual())["threshold_7d_365"]["position"] == "high"
    d, c = _series(400, lambda i: 0.005 if i < 200 else (0.05 if i < 330 else 0.02))
    t = range_band.band_json(d, c, "BTC", range_band.load_usual())["threshold_7d_365"]
    assert t["min"] < t["max"] and t["position"] == "mid"


def test_short_history_raises():
    d, c = _series(30, lambda i: 0.02)
    with pytest.raises(ValueError):
        range_band.band_json(d, c, "BTC", range_band.load_usual())


def test_band_matches_ledger_pinned():
    c = [100.0]
    for i in range(1, 400):
        c.append(c[-1] * math.exp(0.02 * math.sin(i * 0.7) + 0.01 * (1 if i % 3 else -1)))
    dates = [f"d{i:04d}" for i in range(400)]
    b = range_band.band_json(dates, c, "BTC", range_band.load_usual())
    ap = lambda x: pytest.approx(x, abs=1e-9)
    assert b["close"] == ap(400.0920196009345)
    assert b["realized_vol_30d"] == ap(0.33745977571198243)
    by = {i["id"]: i for i in b["items"]}
    assert by["either7"]["threshold"] == ap(0.05841637644977396)
    assert by["either30"]["threshold"] == ap(0.14512006616244047)
    assert by["up7"]["threshold"] == ap(0.04673310115981917)
    assert by["down30"]["threshold"] == ap(0.0967467107749603)
    assert range_band.threshold(b["realized_vol_30d"], 1.25, 7) == ap(0.05841637644977396)
    t = b["threshold_7d_365"]
    assert t["min"] == ap(0.05452568546474109)
    assert t["max"] == ap(0.05841869942630356)
    assert t["position"] == "high"


def test_negative_lower_band_raises():
    # 荒れが大きく either30 の下限が 0 以下になる
    d, c = _series(400, lambda i: 0.4)
    with pytest.raises(ValueError):
        range_band.band_json(d, c, "BTC", range_band.load_usual())


def test_flat_prices_raise():
    d = [f"d{i:04d}" for i in range(400)]
    with pytest.raises(ValueError):
        range_band.band_json(d, [100.0] * 400, "BTC", range_band.load_usual())


def test_usual_period_read_from_frozen_file():
    _, _, b = _band()
    assert b["source"]["usual_period"] == json.loads(
        range_band.Q_2026_11_PATH.read_text(encoding="utf-8"))["usual_period"]
