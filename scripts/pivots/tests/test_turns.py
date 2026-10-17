"""天井・底 (ジグザグ) と強さのはしごのテスト。"""
from __future__ import annotations

import pytest

from producer.turns import (
    STRENGTH_REVERSAL,
    Turn,
    find_turns,
    ladder,
    strongest_label,
)


def test_confirms_top_after_reversal():
    turns = find_turns([100, 110, 120, 113, 101], 0.15)
    assert turns == [Turn(index=2, kind="top", close=120, confirmed_index=4)]


def test_unconfirmed_extreme_is_not_a_turn():
    assert find_turns([100, 110, 120, 113], 0.15) == []


def test_confirmed_bottom_is_not_moved_by_lower_low_below_reversal():
    # 150→100 (−33%) は向き決めだけ (起点は転換点にならない)。
    # 130 (+30%) で 100 を底として確定。95 は 130 から −26.9% で何も確定しない。
    turns = find_turns([150, 100, 130, 95], 0.30)
    assert turns == [Turn(index=1, kind="bottom", close=100, confirmed_index=2)]


def test_start_point_is_never_a_turn():
    # 起点 100 から +20% で上向きが決まる。起点 (index 0) は天井・底にならない。
    turns = find_turns([100, 120, 100], 0.15)
    assert turns == [Turn(index=1, kind="top", close=120, confirmed_index=2)]


def test_strongest_label_prefers_cycle():
    t = Turn(index=5, kind="top", close=100.0, confirmed_index=9)
    labels = strongest_label(
        {"small": [t], "medium": [], "large": [t], "cycle": [t]}
    )
    assert labels == {5: "cycle"}
    labels2 = strongest_label({"small": [t], "large": [t]})
    assert labels2 == {5: "large"}


def test_ladder_reports_candidate_and_confirm_price():
    rows = ladder([60, 124.659, 58.625, 81.537])
    assert [r.strength for r in rows] == ["cycle", "large", "medium", "small"]
    cycle = rows[0]
    assert cycle.decided is True
    assert cycle.last_confirmed is not None
    assert cycle.last_confirmed.kind == "top"
    assert cycle.last_confirmed.close == 124.659
    assert cycle.candidate_kind == "bottom"
    assert cycle.candidate_close == 58.625
    assert cycle.candidate_index == 2
    assert cycle.confirm_at == pytest.approx(87.9375)


def test_ladder_without_any_confirmed_turn():
    rows = ladder([100, 101, 102, 101, 103])
    cycle = rows[0]
    assert cycle.strength == "cycle"
    assert cycle.last_confirmed is None
    # 向き未定 (起点から ±50% の動きがまだ無い): 候補も確定条件の価格も出さない
    assert cycle.decided is False
    assert cycle.candidate_kind is None
    assert cycle.candidate_index is None
    assert cycle.candidate_close is None
    assert cycle.confirm_at is None


def test_ladder_decided_without_confirmed_turn_has_candidate():
    # 起点 100 から +6% で small の向き (上昇中) は決まったが、まだ何も確定していない
    rows = {r.strength: r for r in ladder([100, 103, 106, 104])}
    small = rows["small"]
    assert small.decided is True
    assert small.last_confirmed is None
    assert small.candidate_kind == "top"
    assert small.candidate_index == 2
    assert small.confirm_at == pytest.approx(106 * (1 - STRENGTH_REVERSAL["small"]))
    assert rows["medium"].decided is False and rows["medium"].confirm_at is None


def test_ladder_empty_input():
    rows = ladder([])
    assert [r.strength for r in rows] == ["cycle", "large", "medium", "small"]
    for r in rows:
        assert r.decided is False
        assert r.last_confirmed is None
        assert r.candidate_index is None and r.candidate_kind is None
        assert r.candidate_close is None and r.confirm_at is None


def test_ladder_single_close():
    rows = ladder([100.0])
    assert len(rows) == 4
    for r in rows:
        assert r.decided is False
        assert r.last_confirmed is None
        assert r.candidate_index is None and r.confirm_at is None
