"""出来事の判定 (答え合わせ) (it-2026-10)。

未来の終値を見て「その日 t から H 日以内に何が起きたか」を決める。
答え合わせ専用で、確率の計算側には渡さない。
"""
from __future__ import annotations

from typing import Literal, Sequence

from .backtest import HIT_DEFINITIONS, BacktestHitContext, _thresholds
from .turns import STRENGTH_REVERSAL, Strength, Turn, find_turns
from .types import Horizon

Outcome = Literal["hit", "miss", "pending"]
EventKey = tuple[Literal["turn", "move"], Horizon]

TURN_MIN_STRENGTH: dict[Horizon, Strength] = {
    "7D": "small",
    "30D": "medium",
    "90D": "large",
}


def turn_outcome(
    closes: Sequence[float],
    t: int,
    horizon: Horizon,
    turns: Sequence[Turn] | None = None,
) -> Outcome:
    """窓 (t, t+H] に「その強さ以上」の天井・底の日があれば hit。

    確定は窓の後でもよいが t+2H まで。t+2H がデータ末尾を超え、まだ
    決まらなければ pending。`turns` に全期間で求めた Turn を渡すと再計算
    しない (ジグザグは因果的なので confirmed_index で絞れば接頭辞と同じ)。
    """
    h = HIT_DEFINITIONS[horizon].horizon_days
    deadline = t + 2 * h
    last = len(closes) - 1
    if turns is None:
        reversal = STRENGTH_REVERSAL[TURN_MIN_STRENGTH[horizon]]
        turns = find_turns(closes[: min(last, deadline) + 1], reversal)
    lo, hi = t, t + h
    for turn in turns:
        if lo < turn.index <= hi and turn.confirmed_index <= min(last, deadline):
            return "hit"
    return "pending" if deadline > last else "miss"


def move_outcome(
    closes: Sequence[float],
    t: int,
    horizon: Horizon,
    ctx: BacktestHitContext | None,
) -> Outcome:
    """窓 (t, t+H] で終値が t の終値から上下どちらかに move threshold 以上動けば hit。"""
    hd = HIT_DEFINITIONS[horizon]
    base = closes[t]
    threshold, _ = _thresholds(base, hd, ctx)
    end = t + hd.horizon_days
    last = len(closes) - 1
    for j in range(t + 1, min(end, last) + 1):
        if abs(closes[j] / base - 1.0) >= threshold:
            return "hit"
    return "pending" if end > last else "miss"
