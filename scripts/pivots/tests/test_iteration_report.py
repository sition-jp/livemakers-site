"""it-2026-10 オフライン評価 (ops.iteration_report) のテスト。

`evaluate` は 1 つの (資産, 出来事, 期間) の系列を受け取る純関数 (Ruling R1)。
合成データだけを使い、ネットワークには出ない。
"""
from __future__ import annotations

import json
import math
import random
from datetime import date, datetime, timedelta, timezone

import pytest

from ops.iteration_report import (
    AssetInput,
    build_report,
    evaluate,
    render_markdown,
)
from producer.bulk_history import BulkHistory
from producer.calibration import fit

TRAIN_END_IDX = 119


def _dates(n: int, start: date = date(2025, 1, 1)) -> list[str]:
    return [(start + timedelta(days=i)).isoformat() for i in range(n)]


def _series(n: int = 200):
    """高いスコアの日は hit、低いスコアの日は miss が多い系列。"""
    dates = _dates(n)
    closes = [100.0 + i for i in range(n)]
    scores: list[int | None] = []
    outcomes: list[str] = []
    for t in range(n):
        s = 90 if t % 2 == 0 else 10
        scores.append(s)
        if s == 90:
            outcomes.append("hit" if t % 6 else "miss")
        else:
            outcomes.append("miss" if t % 5 else "hit")
    return closes, scores, outcomes, dates


def _run(closes, scores, outcomes, dates, horizon="7D", event="turn"):
    return evaluate(
        closes, scores, outcomes, dates, dates[TRAIN_END_IDX], event=event, horizon=horizon
    )


# (a) 較正表は学習期間の日だけで作る -------------------------------------------


def test_holdout_outcomes_do_not_change_calibration():
    closes, scores, outcomes, dates = _series()
    base = _run(closes, scores, outcomes, dates)
    flipped = list(outcomes)
    for t in range(TRAIN_END_IDX + 1, len(flipped)):
        flipped[t] = "miss" if flipped[t] == "hit" else "hit"
    other = _run(closes, scores, flipped, dates)
    assert base["calibration"] == other["calibration"]
    assert base["train"] == other["train"]
    # holdout の数字は変わる (holdout を見ていることの確認)
    assert base["holdout"]["n_hit"] != other["holdout"]["n_hit"]


def test_training_days_whose_window_crosses_train_end_are_purged():
    """turn 7D: t + 2H > train_end の日は学習に入れない (Ruling R9)。"""
    closes, scores, outcomes, dates = _series()
    base = _run(closes, scores, outcomes, dates)
    changed = list(outcomes)
    for t in range(TRAIN_END_IDX - 13, TRAIN_END_IDX + 1):  # t + 14 > 119
        changed[t] = "hit" if changed[t] == "miss" else "miss"
    other = _run(closes, scores, changed, dates)
    assert base["calibration"] == other["calibration"]
    assert base["train"]["end"] == dates[TRAIN_END_IDX - 14]


def test_move_purge_uses_one_horizon():
    closes, scores, outcomes, dates = _series()
    res = _run(closes, scores, outcomes, dates, event="move")
    assert res["train"]["end"] == dates[TRAIN_END_IDX - 7]


def test_calibration_matches_fit_on_training_days_only():
    closes, scores, outcomes, dates = _series()
    res = _run(closes, scores, outcomes, dates)
    last = TRAIN_END_IDX - 14
    expected = fit(scores[: last + 1], outcomes[: last + 1])
    assert res["calibration"]["usual"] == pytest.approx(expected.usual)
    assert res["train"]["usual"] == pytest.approx(expected.usual)
    assert [b["prob"] for b in res["calibration"]["bins"]] == pytest.approx(
        [b[2] for b in expected.bins]
    )


# (b) pending の日は数えない ------------------------------------------------------


def test_pending_days_are_not_counted():
    closes, scores, outcomes, dates = _series()
    base = _run(closes, scores, outcomes, dates)
    with_pending = list(outcomes)
    for t in (10, 11, 12):  # 学習期間の途中
        with_pending[t] = "pending"
    for t in range(150, 160):  # holdout の途中
        with_pending[t] = "pending"
    res = _run(closes, scores, with_pending, dates)
    assert res["train"]["n"] == base["train"]["n"] - 3
    assert res["holdout"]["n"] == base["holdout"]["n"] - 10
    assert res["long_run"]["n"] == base["long_run"]["n"] - 3


def test_holdout_days_whose_window_is_not_closed_are_excluded():
    """Review Focus 1: データ末尾の 2H 日 (天井・底) は早めに hit と出ても数えない。
    hit だけが先に確定するので、数えると holdout の発生率が高い方へ偏る。"""
    closes, scores, outcomes, dates = _series()
    last = len(dates) - 1
    res = _run(closes, scores, outcomes, dates)
    assert res["holdout"]["end"] == dates[last - 14]
    assert res["holdout"]["n"] == (last - 14) - TRAIN_END_IDX
    all_hit = list(outcomes)
    for t in range(last - 13, last + 1):
        all_hit[t] = "hit"
    assert _run(closes, scores, all_hit, dates)["holdout"] == res["holdout"]
    move = _run(closes, scores, outcomes, dates, event="move")
    assert move["holdout"]["end"] == dates[last - 7]


# (c) ウォームアップ前 (スコア None) の日は確率を出さず数えない ------------------------


def test_no_score_days_get_no_probability_and_are_not_counted():
    closes, scores, outcomes, dates = _series()
    base = _run(closes, scores, outcomes, dates)
    warm = list(scores)
    for t in range(30):
        warm[t] = None
    for t in range(150, 160):
        warm[t] = None
    res = _run(closes, warm, outcomes, dates)
    assert res["train"]["n"] == base["train"]["n"] - 30
    assert res["train"]["start"] == dates[30]
    assert res["holdout"]["n"] == base["holdout"]["n"] - 10
    expected = fit(scores[30 : TRAIN_END_IDX - 13], outcomes[30 : TRAIN_END_IDX - 13])
    assert res["calibration"]["usual"] == pytest.approx(expected.usual)
    # スコアの無い日は 0 点として扱わない: 0 点の区間 [0,20) の標本数は増えない
    assert res["calibration"]["bins"][0]["n"] == expected.bins[0][3]
    # 長期のふだん (価格だけ) はスコアの有無に関係なく全日で数える
    assert res["long_run"]["n"] == base["long_run"]["n"]


def test_all_none_scores_gives_no_table_and_no_crash():
    closes, scores, outcomes, dates = _series()
    res = _run(closes, [None] * len(scores), outcomes, dates)
    assert res["calibration"] is None
    assert res["train"]["n"] == 0
    assert res["holdout"]["brier_skill"] is None
    assert res["verdict"]["primary_pass"] is None


# (d) 90D は合否を付けない --------------------------------------------------------


def test_90d_is_not_judged():
    closes, scores, outcomes, dates = _series(800)
    train_end = dates[500]
    res90 = evaluate(closes, scores, outcomes, dates, train_end, event="turn", horizon="90D")
    res7 = evaluate(closes, scores, outcomes, dates, train_end, event="turn", horizon="7D")
    assert res90["judged"] is False
    assert res90["verdict"]["primary_pass"] is None
    assert res90["verdict"]["secondary_pass"] is None
    assert res7["judged"] is True
    assert res7["verdict"]["primary_pass"] in (True, False)


def test_holdout_metrics_use_training_usual():
    closes, scores, outcomes, dates = _series()
    res = _run(closes, scores, outcomes, dates)
    h = res["holdout"]
    assert h["start"] == dates[TRAIN_END_IDX + 1]
    assert h["brier_skill"] == pytest.approx(1.0 - h["brier"] / h["brier_usual"])
    # 高スコアの日に hit が多いので、ふだんだけより良い
    assert h["brier_skill"] > 0
    assert res["verdict"]["primary_pass"] is True
    assert h["lift"] is not None and h["lift"] > 0.10
    assert res["verdict"]["secondary_pass"] is True
    assert sum(b["n"] for b in h["bins"]) == h["n"]


def test_length_mismatch_raises():
    closes, scores, outcomes, dates = _series()
    with pytest.raises(ValueError):
        evaluate(closes, scores[:-1], outcomes, dates, dates[TRAIN_END_IDX], event="turn", horizon="7D")


# 全体の組み立て (ネットワークなし・合成の日足と派生データ) -------------------------------


def _synthetic_asset(n: int, seed: int, deriv_from: int) -> AssetInput:
    rng = random.Random(seed)
    start = datetime(2023, 1, 1, tzinfo=timezone.utc)
    dates, closes, highs, lows, vols = [], [], [], [], []
    p = 100.0
    for i in range(n):
        p *= math.exp(rng.gauss(0, 0.035))
        dates.append((start + timedelta(days=i)).strftime("%Y-%m-%d"))
        closes.append(p)
        highs.append(p * 1.02)
        lows.append(p * 0.98)
        vols.append(1000.0 + rng.random() * 500)
    from tests._bulk_fixture import synthetic_day_records

    rows = [[int((start + timedelta(days=i)).timestamp() * 1000)] for i in range(deriv_from, n)]
    hist = BulkHistory("X", synthetic_day_records(rows))
    return AssetInput(dates=dates, closes=closes, highs=highs, lows=lows, volumes=vols, history=hist)


@pytest.fixture(scope="module")
def small_report():
    inputs = {
        "BTC": _synthetic_asset(700, seed=1, deriv_from=150),
        "ETH": _synthetic_asset(700, seed=2, deriv_from=150),
    }
    train_end = inputs["BTC"].dates[520]
    return build_report(inputs, train_end=train_end, compare_baseline=True)


def test_build_report_covers_every_question(small_report):
    qs = small_report["questions"]
    keys = {(q["asset"], q["event"], q["horizon"]) for q in qs}
    assert len(keys) == 12
    for q in qs:
        assert q["score_type"] == ("price_pivot" if q["event"] == "turn" else "volatility_pivot")
        # 派生データの無い日 (deriv_from より前) はスコアなし → 学習の始まりはそれ以降
        if q["train"]["n"]:
            assert q["train"]["start"] >= "2023-05-31"
    sel = small_report["range_window_selection"]
    assert set(sel["train_brier"]) == {"7D", "30D", "90D"}
    assert set(sel["train_brier"]["7D"]) == {"10", "14", "20"}
    assert len(small_report["baseline_comparison"]) == 12
    json.dumps(small_report)  # JSON にできる


def test_report_and_calibration_file_shape(small_report):
    cal = small_report["calibration_file"]
    assert cal["iteration"] == "it-2026-10"
    assert set(cal["tables"]) == {"BTC", "ETH"}
    assert set(cal["tables"]["BTC"]) == {"turn", "move"}
    assert set(cal["tables"]["BTC"]["turn"]) == {"7D", "30D", "90D"}


def test_markdown_avoids_forbidden_words(small_report):
    md = render_markdown(small_report)
    for word in ("予測", "上がる", "下がる", "反転幅"):
        assert word not in md
    assert "Brier skill" in md
    assert "判定材料不足" in md
