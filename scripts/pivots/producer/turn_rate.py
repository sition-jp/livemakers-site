"""天井・底が確定する頻度 (中・小)。画面の「ふつう年に何回くらい」に使う。

確定した転換点 (`turns.find_turns` · 中 = 15%・小 = 5% の折り返し) を、天井・底の日付で
since 以降に絞って数える。年あたり = 回数 ÷ (最後の日 − since) の年数 (365.25 日)・小数 1 桁。
直近 365 日 = 最後の日を含む 365 暦日のうち、天井・底の日付がそこにあるもの。
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Sequence

from producer.turns import STRENGTH_REVERSAL, find_turns

DEFAULT_SINCE = "2021-12-01"


def turn_rate_json(dates: Sequence[str], closes: Sequence[float], since: str = DEFAULT_SINCE) -> dict:
    out: dict = {}
    if not dates:
        return {s: {"per_year": 0.0, "last_365": 0} for s in ("medium", "small")}
    last = date.fromisoformat(dates[-1])
    years = max((last - date.fromisoformat(since)).days / 365.25, 1e-9)
    cutoff = (last - timedelta(days=364)).isoformat()
    for strength in ("medium", "small"):
        turns = find_turns(list(closes), STRENGTH_REVERSAL[strength])
        n_since = sum(1 for t in turns if dates[t.index] >= since)
        n_365 = sum(1 for t in turns if dates[t.index] >= cutoff)
        out[strength] = {"per_year": round(n_since / years, 1), "last_365": n_365}
    return out
