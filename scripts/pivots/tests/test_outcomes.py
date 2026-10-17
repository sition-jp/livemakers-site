import random

from producer.outcomes import move_outcome, turn_outcome
from producer.turns import STRENGTH_REVERSAL, find_turns


def _flat(n, v=100.0):
    return [v] * n


def test_turn_hit_when_top_inside_window_confirmed_after_window_end():
    # t=0, 30D: 25 日目に天井、45 日目に 15% 下げて確定 (窓 30 日の後・t+60 以内)
    closes = [100.0] * 91
    for i in range(1, 26):
        closes[i] = 100.0 + i * 1.0  # 125 まで上昇
    for i in range(26, 91):
        closes[i] = 125.0
    closes[45] = 125.0 * 0.85
    for i in range(46, 91):
        closes[i] = 125.0 * 0.85
    assert turn_outcome(closes, 0, "30D") == "hit"


def test_turn_pending_when_confirmation_grace_runs_past_data_end():
    closes = [100.0] * 41
    for i in range(1, 26):
        closes[i] = 100.0 + i
    for i in range(26, 41):
        closes[i] = 125.0  # 未確定のまま末尾 (t+60 より前)
    assert turn_outcome(closes, 0, "30D") == "pending"


def test_turn_miss_when_nothing_confirmed_by_t_plus_2h():
    closes = _flat(91)
    assert turn_outcome(closes, 0, "30D") == "miss"


def test_turn_small_does_not_count_for_30d():
    # 5% の天井・底だけ (15% 未満) が窓内にある
    closes = [100.0] * 91
    for i in range(1, 6):
        closes[i] = 100.0 + i  # 105
    for i in range(6, 91):
        closes[i] = 99.0  # 105 から約 5.7% 下げ (small のみ確定)
    assert find_turns(closes, STRENGTH_REVERSAL["small"])  # small なら確定する
    assert turn_outcome(closes, 0, "30D") == "miss"


def test_turn_already_confirmed_in_window_is_hit_even_if_data_short():
    closes = [100.0] * 20
    for i in range(1, 6):
        closes[i] = 100.0 + i
    for i in range(6, 20):
        closes[i] = 105.0 * 0.9  # 7D small 確定、データは t+14 より短い
    assert turn_outcome(closes, 0, "7D") == "hit"


def test_move_ignores_range_span_rule():
    # +6% と -6% の往復 (30D の move threshold 10% 未満)
    closes = [100.0] * 40
    closes[5] = 106.0
    closes[10] = 94.0
    assert move_outcome(closes, 0, "30D", None) == "miss"


def test_move_hit_and_pending():
    closes = [100.0] * 40
    closes[5] = 111.0
    assert move_outcome(closes, 0, "30D", None) == "hit"
    short = [100.0] * 20
    assert move_outcome(short, 0, "30D", None) == "pending"


def test_move_hit_downward():
    closes = [100.0] * 40
    closes[3] = 89.0
    assert move_outcome(closes, 0, "30D", None) == "hit"


def test_precomputed_turns_agree_with_prefix_path():
    rng = random.Random(7)
    closes = [100.0]
    for _ in range(400):
        closes.append(closes[-1] * (1 + rng.gauss(0, 0.04)))
    for horizon, strength in (("7D", "small"), ("30D", "medium"), ("90D", "large")):
        turns = find_turns(closes, STRENGTH_REVERSAL[strength])
        for t in range(0, len(closes) - 1):
            assert turn_outcome(closes, t, horizon) == turn_outcome(
                closes, t, horizon, turns=turns
            ), (horizon, t)
