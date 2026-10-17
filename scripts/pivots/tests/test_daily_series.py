"""日次の系列 (producer.daily_series) のテスト。オフライン評価と live が共有する (Ruling R11)。"""
from __future__ import annotations

import pytest

from producer import daily_series
from producer.daily_series import MAX_LOOKBACK_DAYS
from producer.types import HORIZONS
from tests.test_iteration_report import _synthetic_asset


@pytest.fixture(scope="module")
def inp():
    return _synthetic_asset(700, seed=3, deriv_from=150)


def test_series_start_gives_same_scores_from_valid_from(inp):
    full = daily_series.prepare(inp)
    start = 200
    part = daily_series.prepare(inp, series_start=start)
    assert part.valid_from == start + MAX_LOOKBACK_DAYS
    n = len(inp.dates)
    seen = 0
    for h in HORIZONS:
        for t in range(part.valid_from, n):
            a = daily_series.score_at(full, t, h)
            assert daily_series.score_at(part, t, h) == a
            seen += a is not None
        for t in range(start, n):
            assert daily_series.hit_context(part, t) == daily_series.hit_context(full, t)
    assert seen > 0  # 実際にスコアが出る日を比べている


def test_score_at_refuses_days_before_valid_from(inp):
    part = daily_series.prepare(inp, series_start=200)
    with pytest.raises(ValueError):
        daily_series.score_at(part, part.valid_from - 1, "7D")
    with pytest.raises(ValueError):
        daily_series.hit_context(part, 199)


def test_no_score_without_derivatives_or_during_warmup(inp):
    p = daily_series.prepare(inp)
    # 派生データは 150 日目から: それより前はスコアなし (0 点にしない)
    assert all(daily_series.score_at(p, t, "7D") is None for t in range(150))
    pp, vp = daily_series.scores(p, "7D")
    assert pp[:150] == [None] * 150 and vp[:150] == [None] * 150
    assert any(x is not None for x in pp[150:])


def test_outcomes_match_outcome_at(inp):
    p = daily_series.prepare(inp)
    turns = daily_series.turns_by_horizon(inp.closes)
    for ev in ("turn", "move"):
        for h in HORIZONS:
            outs = daily_series.outcomes(p, ev, h)
            for t in (0, 300, len(inp.dates) - 5):
                ctx = daily_series.hit_context(p, t) if ev == "move" else None
                assert outs[t] == daily_series.outcome_at(inp.closes, t, ev, h, turns=turns, ctx=ctx)
