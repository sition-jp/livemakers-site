"""turn_rate.py: 確定した天井・底の回数 (年あたり・直近 365 日)。"""
from datetime import date, timedelta

from producer import turn_rate
from producer.turns import STRENGTH_REVERSAL, find_turns


def _days(n, start=date(2021, 1, 1)):
    return [(start + timedelta(days=i)).isoformat() for i in range(n)]


def _zigzag(n_legs, leg_days, move):
    """leg_days ごとに ±move (例 0.4) の往復。"""
    out, x, up = [100.0], 100.0, True
    for _ in range(n_legs):
        step = (1 + move) ** (1 / leg_days) if up else (1 / (1 + move)) ** (1 / leg_days)
        for _ in range(leg_days):
            x *= step
            out.append(x)
        up = not up
    return out


def test_turn_rate_counts_confirmed_turns_since_start():
    closes = _zigzag(40, 20, 0.40)  # 20 日ごとに 40% の往復
    dates = _days(len(closes))
    out = turn_rate.turn_rate_json(dates, closes, since="2021-01-01")
    for strength in ("medium", "small"):
        turns = find_turns(closes, STRENGTH_REVERSAL[strength])
        assert len(turns) >= 30
        years = (date.fromisoformat(dates[-1]) - date(2021, 1, 1)).days / 365.25
        assert out[strength]["per_year"] == round(len(turns) / years, 1)
        cutoff = (date.fromisoformat(dates[-1]) - timedelta(days=364)).isoformat()
        assert out[strength]["last_365"] == sum(1 for t in turns if dates[t.index] >= cutoff)


def test_turn_rate_since_excludes_earlier_turns():
    closes = _zigzag(40, 20, 0.40)
    dates = _days(len(closes))
    all_ = turn_rate.turn_rate_json(dates, closes, since="2021-01-01")
    late = turn_rate.turn_rate_json(dates, closes, since="2022-06-01")
    turns = find_turns(closes, STRENGTH_REVERSAL["medium"])
    n_late = sum(1 for t in turns if dates[t.index] >= "2022-06-01")
    years = (date.fromisoformat(dates[-1]) - date(2022, 6, 1)).days / 365.25
    assert late["medium"]["per_year"] == round(n_late / years, 1)
    assert late["medium"]["per_year"] != all_["medium"]["per_year"] or n_late == len(turns)


def test_turn_rate_empty_series_is_zero():
    out = turn_rate.turn_rate_json(_days(10), [100.0] * 10)
    assert out == {"medium": {"per_year": 0.0, "last_365": 0},
                   "small": {"per_year": 0.0, "last_365": 0}}
