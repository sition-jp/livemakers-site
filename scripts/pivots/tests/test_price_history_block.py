"""長期の終値から作るブロック (producer.price_history_block) のテスト (it-2026-10 段 2 Task 9)。"""
from __future__ import annotations

import json
import math
import random
from datetime import date, timedelta

import pytest

from producer import daily_series
from producer.backtest import BacktestHitContext
from producer.forecast import forecast_items, load_frozen, today_pct
from producer.price_history_block import (
    FORECAST_HISTORY_DAYS,
    carryable_history,
    LONG_HISTORY_START,
    forecast_history,
    ladder_json,
    trend,
    turns_json,
)
from producer.turns import STRENGTH_REVERSAL, find_turns, strongest_label
from producer.types import HORIZONS


def _dates(n: int, start: date = date(2026, 1, 1)) -> list[str]:
    return [(start + timedelta(days=i)).isoformat() for i in range(n)]


def test_long_history_start():
    assert LONG_HISTORY_START == "2017-08-17"
    assert FORECAST_HISTORY_DAYS == 120


# --- trend --------------------------------------------------------------------


def test_trend_returns_vs_30_and_90_days_ago():
    closes = [50.0] + [70.0] * 59 + [80.0] + [90.0] * 29 + [100.0]
    assert len(closes) == 91
    assert trend(closes) == {"ret_30d_pct": 25.0, "ret_90d_pct": 100.0}


def test_trend_omits_keys_without_enough_history():
    assert trend([100.0] * 31 + [103.33]) == {"ret_30d_pct": 3.3}
    assert trend([100.0] * 30) == {}
    assert trend([]) == {}


def test_trend_rounds_to_one_decimal_and_allows_negative():
    closes = [200.0] * 60 + [150.0] * 30 + [133.0]
    out = trend(closes)
    assert out == {"ret_30d_pct": -11.3, "ret_90d_pct": -33.5}


# --- ladder -------------------------------------------------------------------


def test_ladder_json_decided_rows_have_candidate_and_confirm_price():
    dates = _dates(4)
    rows = ladder_json(dates, [60, 124.659, 58.625, 81.537])
    assert [r["strength"] for r in rows] == ["cycle", "large", "medium", "small"]
    cycle = rows[0]
    assert cycle["decided"] is True
    assert cycle["last_confirmed"] == {"date": dates[1], "kind": "top", "close": 124.659}
    assert cycle["candidate"] == {"date": dates[2], "kind": "bottom", "close": 58.625}
    assert cycle["confirm_at"] == pytest.approx(87.9375)
    json.dumps(rows)


def test_ladder_json_undecided_rows_have_no_candidate_or_price():
    rows = ladder_json(_dates(3), [100.0, 101.0, 102.0])
    assert len(rows) == 4
    for r in rows:
        assert r == {
            "strength": r["strength"],
            "decided": False,
            "last_confirmed": None,
            "candidate": None,
            "confirm_at": None,
        }


def test_ladder_json_empty_and_single():
    for dates, closes in (([], []), (_dates(1), [100.0])):
        rows = ladder_json(dates, closes)
        assert len(rows) == 4
        assert all(r["decided"] is False and r["candidate"] is None and r["confirm_at"] is None for r in rows)


# --- turns --------------------------------------------------------------------


def _waypoints(points: list[tuple[int, float]]) -> list[float]:
    out: list[float] = []
    for (i0, v0), (i1, v1) in zip(points, points[1:]):
        for i in range(i0, i1):
            out.append(v0 + (v1 - v0) * (i - i0) / (i1 - i0))
    out.append(points[-1][1])
    return out


def _turn_series() -> tuple[list[str], list[float]]:
    # サイクル級: 0→50 で 2 倍 (天井 50)、100 で 90 (底 100)、150 で 140 (底を確定)。
    pts = [(0, 100.0), (50, 200.0), (100, 90.0), (150, 140.0)]
    # その後は 140↔150 を 10 日ごとに往復 (小さな山と谷)
    i, hi = 150, True
    while i < 399:
        i += 10
        pts.append((min(i, 399), 150.0 if hi else 140.0))
        hi = not hi
    closes = _waypoints(pts)
    return _dates(len(closes), date(2025, 1, 1)), closes


def test_turns_json_recent_120_days_plus_every_cycle_turn():
    dates, closes = _turn_series()
    today = dates[-1]
    out = turns_json(dates, closes, today)
    by_strength = {s: find_turns(closes, r) for s, r in STRENGTH_REVERSAL.items()}
    labels = strongest_label(by_strength)
    cutoff = (date.fromisoformat(today) - timedelta(days=FORECAST_HISTORY_DAYS - 1)).isoformat()
    expected = sorted(i for i, s in labels.items() if dates[i] >= cutoff or s == "cycle")
    assert [e["date"] for e in out] == [dates[i] for i in expected]
    got = {e["date"]: e for e in out}
    # 古いサイクル級は残る
    assert got[dates[50]] == {"date": dates[50], "kind": "top", "strength": "cycle", "close": 200.0}
    assert got[dates[100]]["kind"] == "bottom" and got[dates[100]]["strength"] == "cycle"
    # 古い小さな山 (120 日より前) は出さない
    assert dates[160] not in got
    # 直近の小さな山・谷は出す
    recent = [e for e in out if e["date"] >= cutoff]
    assert recent and all(e["strength"] == "small" for e in recent)
    assert all(e["close"] == closes[dates.index(e["date"])] for e in out)
    json.dumps(out)


def test_turns_json_empty():
    assert turns_json([], [], "2026-10-17") == []


# --- forecast_history ---------------------------------------------------------


@pytest.fixture(scope="module")
def frozen():
    return load_frozen()


def _walk(n: int, seed: int = 7) -> list[float]:
    rng = random.Random(seed)
    p, out = 100.0, []
    for _ in range(n):
        p *= math.exp(rng.gauss(0, 0.03))
        out.append(p)
    return out


def _today_items(frozen):
    return forecast_items(frozen, "BTC", {"7D": (45, 5), "30D": (65, 25), "90D": (85, 45)}, None)


class _Scores:
    def __init__(self):
        self.calls: list[tuple[int, str]] = []

    def __call__(self, t, h):
        self.calls.append((t, h))
        if t % 7 == 0:
            return None
        return (40 + t % 50, 10 + t % 30)


def _ctx(closes):
    return lambda t: BacktestHitContext(atr_14=closes[t] * 0.02, realized_vol_30d=0.5)


def _run_fh(frozen, dates, closes, existing=None, today_items="default", **kw):
    items = _today_items(frozen) if today_items == "default" else today_items
    sc = _Scores()
    out = forecast_history(dates, closes, frozen, "BTC", items, existing, sc, **kw)
    return out, sc


def test_forecast_history_is_120_continuous_days_ending_today(frozen):
    dates, closes = _dates(300), _walk(300)
    out, _ = _run_fh(frozen, dates, closes, hit_context=_ctx(closes))
    assert len(out) == FORECAST_HISTORY_DAYS
    assert [e["date"] for e in out] == dates[-FORECAST_HISTORY_DAYS:]
    # backfilled=True ⇒ forecast はさかのぼり計算 / forecast なし ⇒ 空き (backfilled=False)
    assert all(e["backfilled"] is False for e in out if "forecast" not in e)
    json.dumps(out)


def test_forecast_history_today_uses_today_items(frozen):
    dates, closes = _dates(300), _walk(300)
    out, sc = _run_fh(frozen, dates, closes, hit_context=_ctx(closes))
    today = out[-1]
    assert today["date"] == dates[-1] and today["backfilled"] is False
    assert today["close"] == closes[-1]
    for item in _today_items(frozen):
        assert today["forecast"][item["event"]][item["horizon"]] == item["today_pct"]
    assert today["outcome"] == {ev: {h: "pending" for h in HORIZONS} for ev in ("turn", "move")}
    assert all(t != len(dates) - 1 for t, _ in sc.calls)  # 今日は score_at で計算しない


def test_forecast_history_backfills_past_days_with_score_at(frozen):
    dates, closes = _dates(300), _walk(300)
    out, _ = _run_fh(frozen, dates, closes, hit_context=_ctx(closes))
    for e in out[:-1]:
        t = dates.index(e["date"])
        assert e["close"] == closes[t]
        if t % 7 == 0:
            assert "forecast" not in e  # スコアなし: 0 と書かない
            assert e["backfilled"] is False  # 何もさかのぼっていない (空き) — R12 (c)
            continue
        assert e["backfilled"] is True
        pp, vp = 40 + t % 50, 10 + t % 30
        for h in HORIZONS:
            assert e["forecast"]["turn"][h] == today_pct(frozen, "BTC", "turn", h, pp)
            assert e["forecast"]["move"][h] == today_pct(frozen, "BTC", "move", h, vp)


def test_forecast_history_keeps_recorded_live_values(frozen):
    dates, closes = _dates(300), _walk(300)
    d_live, d_back = dates[-10], dates[-21]  # t = 290, 279 (どちらもスコアあり)
    recorded = {"turn": {"7D": 12.3, "30D": 45.6}, "move": {"7D": 7.8}}
    existing = [
        {"date": dates[0], "close": 1.0, "forecast": recorded, "backfilled": False},  # 窓の外
        {"date": d_live, "close": 1.0, "forecast": recorded,
         "outcome": {"turn": {"7D": "pending"}}, "backfilled": False},
        {"date": d_back, "close": 1.0, "forecast": {"turn": {"7D": 99.9}}, "backfilled": True},
        {"date": dates[-1], "forecast": {"turn": {"7D": 1.0}}, "backfilled": False},  # 同じ日の再実行
        "garbage",
    ]
    out, sc = _run_fh(frozen, dates, closes, existing=existing, hit_context=_ctx(closes))
    by = {e["date"]: e for e in out}
    assert dates[0] not in by
    live = by[d_live]
    assert live["backfilled"] is False and live["forecast"] == recorded
    assert live["close"] == closes[-10]  # 終値は確定した足から
    t_live = len(dates) - 10
    assert all(t != t_live for t, _ in sc.calls)
    back = by[d_back]
    assert back["backfilled"] is True and back["forecast"]["turn"]["7D"] != 99.9
    assert by[dates[-1]]["forecast"]["turn"]["7D"] == _today_items(frozen)[0]["today_pct"]


def test_forecast_history_recomputes_outcomes_on_closed_candles(frozen):
    dates, closes = _dates(300), _walk(300)
    ctx = _ctx(closes)
    existing = [
        {"date": e, "outcome": {"turn": {h: "pending" for h in HORIZONS}, "move": {h: "pending" for h in HORIZONS}},
         "forecast": {"turn": {"7D": 50.0}}, "backfilled": False}
        for e in dates[-FORECAST_HISTORY_DAYS:-1]
    ]
    out, _ = _run_fh(frozen, dates, closes, existing=existing, hit_context=ctx)
    closed = closes[:-1]
    turns = daily_series.turns_by_horizon(closed)
    seen = set()
    for e in out[:-1]:
        t = dates.index(e["date"])
        for ev in ("turn", "move"):
            for h in HORIZONS:
                want = daily_series.outcome_at(
                    closed, t, ev, h, turns=turns, ctx=ctx(t) if ev == "move" else None
                )
                assert e["outcome"][ev][h] == want
                seen.add(want)
    assert {"hit", "pending"} <= seen  # 結果待ちだった日が確定に変わっている


def test_forecast_history_ignores_in_progress_candle_for_outcomes(frozen):
    # 確定した足は横ばい、今日の (未確定の) 足だけ 2 倍: 昨日の「大きく動く」は hit にしない
    dates = _dates(200)
    closes = [100.0] * 199 + [200.0]
    out, _ = _run_fh(frozen, dates, closes)
    yday = out[-2]
    assert yday["outcome"]["move"]["7D"] == "pending"
    assert yday["outcome"]["turn"]["7D"] == "pending"
    assert out[-1]["close"] == 200.0


def test_forecast_history_without_today_items_is_a_gap(frozen):
    dates, closes = _dates(200), _walk(200)
    out, _ = _run_fh(frozen, dates, closes, today_items=None)
    assert "forecast" not in out[-1]
    assert out[-1]["backfilled"] is False  # 空き: 何もさかのぼっていない — R12 (c)


def test_forecast_history_same_day_rerun_without_today_items_keeps_recorded(frozen):
    # R12 (b): 同じ日の再実行で「今日の確率」が失敗しても、先に出した今日の値を残す
    dates, closes = _dates(200), _walk(200)
    shown = {"turn": {"7D": 44.6}, "move": {"30D": 77.2}}
    existing = [{"date": dates[-1], "close": 1.0, "forecast": shown, "backfilled": False}]
    out, _ = _run_fh(frozen, dates, closes, existing=existing, today_items=None)
    assert out[-1]["forecast"] == shown and out[-1]["backfilled"] is False
    assert out[-1]["close"] == closes[-1]


def test_forecast_history_gap_entries_are_recomputed(frozen):
    # forecast の無い記録 (空き) は守る値ではない: 次の run で score_at から埋める
    dates, closes = _dates(300), _walk(300)
    gap = dates[-21]  # t = 279 (スコアあり)
    existing = [{"date": gap, "close": 1.0, "backfilled": False}]
    out, sc = _run_fh(frozen, dates, closes, existing=existing)
    e = next(x for x in out if x["date"] == gap)
    assert e["backfilled"] is True and "forecast" in e
    assert (279, "7D") in sc.calls


def test_carryable_history_keeps_valid_entries_unchanged():
    good = [
        {"date": "2026-10-16", "close": 67000.0, "forecast": {"turn": {"7D": 47.3}},
         "outcome": {"turn": {"7D": "pending"}}, "backfilled": False},
        {"date": "2026-10-17", "backfilled": False},
    ]
    raw = {"forecast_history": {"BTC": good, "ETH": "nope"}}
    got = carryable_history(raw)
    assert got == {"BTC": good}
    assert carryable_history(None) == {}
    assert carryable_history({"forecast_history": []}) == {}


def test_carryable_history_drops_entries_that_would_fail_the_schema():
    raw = {"forecast_history": {"BTC": [
        {"date": "bad", "backfilled": False},
        {"date": "2026-10-15", "forecast": {"turn": {"7D": 101}}, "backfilled": True},
        {"date": "2026-10-16", "backfilled": True},  # forecast なしで backfilled=True は矛盾
        {"date": "2026-10-17", "outcome": {"turn": {"7D": "maybe"}}, "backfilled": False},
        {"date": "2026-10-18", "close": -1, "backfilled": False},
        "garbage",
    ]}}
    got = carryable_history(raw)["BTC"]
    assert got == [
        {"date": "2026-10-15", "backfilled": False},
        {"date": "2026-10-16", "backfilled": False},
        {"date": "2026-10-17", "backfilled": False},
        {"date": "2026-10-18", "backfilled": False},
    ]


def test_forecast_history_missing_kline_day(frozen):
    # 日足が 1 日抜けた日: 終値・答え合わせは出さない。記録済みの値はそのまま残す
    dates, closes = _dates(200), _walk(200)
    gap = dates[-5]
    keep = [i for i, d in enumerate(dates) if d != gap]
    d2, c2 = [dates[i] for i in keep], [closes[i] for i in keep]
    existing = [{"date": gap, "forecast": {"turn": {"7D": 33.3}}, "backfilled": False}]
    out, _ = _run_fh(frozen, d2, c2, existing=existing)
    assert [e["date"] for e in out] == dates[-FORECAST_HISTORY_DAYS:]
    e = next(x for x in out if x["date"] == gap)
    assert "close" not in e and "outcome" not in e
    assert e["forecast"] == {"turn": {"7D": 33.3}} and e["backfilled"] is False


def test_forecast_history_explicit_today_without_candle(frozen):
    dates, closes = _dates(200), _walk(200)
    today = (date.fromisoformat(dates[-1]) + timedelta(days=1)).isoformat()
    out, _ = _run_fh(frozen, dates, closes, today=today)
    assert out[-1]["date"] == today and "close" not in out[-1]
    assert out[-1]["backfilled"] is False
    assert out[-1]["forecast"]["turn"]["7D"] == _today_items(frozen)[0]["today_pct"]
    assert out[-1]["outcome"]["turn"]["7D"] == "pending"
    # 日付が today の足が無いので、最後の足 (昨日) は確定した足として扱う
    assert out[-2]["close"] == closes[-1]
