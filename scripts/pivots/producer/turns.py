"""天井・底 (ジグザグ) と強さのはしご (it-2026-10)。

日次終値から、確定済みの天井・底を 4 つの強さで求める。強さは固定で、
BTC と ETH で同じ値を使う (ATR などでの調整はしない)。

ジグザグの規則:
- 最初は向き未定。最初の終値から ±R 動いた時点で向きだけを決める。
  起点そのものは天井・底にならない。
- 上昇中は高値を更新し続け、その高値から R 下げた日にその高値を天井として確定する
  (`confirmed_index` = 下げた日)。下降中も対称。
- 確定済みの天井・底は後から動かさない。確定していない極値は Turn に含めない。
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Sequence

Strength = Literal["small", "medium", "large", "cycle"]
Kind = Literal["top", "bottom"]

STRENGTH_REVERSAL: dict[Strength, float] = {
    "small": 0.05,
    "medium": 0.15,
    "large": 0.30,
    "cycle": 0.50,
}

# はしごの並び順 (大きい強さから)
_LADDER_ORDER: tuple[Strength, ...] = ("cycle", "large", "medium", "small")


@dataclass(frozen=True)
class Turn:
    index: int
    kind: Kind
    close: float
    confirmed_index: int


@dataclass(frozen=True)
class LadderRow:
    """強さのはしごの 1 行。

    `decided=False` = 向きがまだ決まっていない (起点から ±R の動きがまだ無い)。
    そのとき候補と確定条件の価格は None (画面は「まだ確定なし」を出し、価格を出さない)。
    """
    strength: Strength
    decided: bool
    last_confirmed: Turn | None
    candidate_index: int | None
    candidate_kind: Kind | None
    candidate_close: float | None
    confirm_at: float | None


def _scan(
    closes: Sequence[float], reversal: float
) -> tuple[list[Turn], int, Kind, float, bool]:
    """確定した Turn と、現在追跡中の候補 (index, kind, close)、向きが決まったか を返す。

    向き未定 (±R の動きがまだ無い) の間の候補は、起点の終値から最も離れた
    (相対変化が最大の) 終値とする。同距離なら天井側。
    """
    if not closes:
        raise ValueError("closes must not be empty")

    turns: list[Turn] = []
    first = closes[0]
    hi_i = lo_i = 0
    direction: Kind | None = None  # "top" = 上昇中 (天井を追跡) / "bottom" = 下降中
    ext_i = 0

    for i in range(1, len(closes)):
        c = closes[i]
        if direction is None:
            if c > closes[hi_i]:
                hi_i = i
            if c < closes[lo_i]:
                lo_i = i
            if c >= first * (1 + reversal):
                direction, ext_i = "top", hi_i
            elif c <= first * (1 - reversal):
                direction, ext_i = "bottom", lo_i
        elif direction == "top":
            if c > closes[ext_i]:
                ext_i = i
            elif c <= closes[ext_i] * (1 - reversal):
                turns.append(Turn(ext_i, "top", closes[ext_i], i))
                direction, ext_i = "bottom", i
        else:
            if c < closes[ext_i]:
                ext_i = i
            elif c >= closes[ext_i] * (1 + reversal):
                turns.append(Turn(ext_i, "bottom", closes[ext_i], i))
                direction, ext_i = "top", i

    if direction is None:
        up = closes[hi_i] / first - 1.0
        down = 1.0 - closes[lo_i] / first
        if up >= down:
            return turns, hi_i, "top", closes[hi_i], False
        return turns, lo_i, "bottom", closes[lo_i], False
    return turns, ext_i, direction, closes[ext_i], True


def find_turns(closes: Sequence[float], reversal: float) -> list[Turn]:
    """確定した天井・底だけを index 昇順で返す。"""
    if not closes:
        return []
    return _scan(closes, reversal)[0]


def strongest_label(
    turns_by_strength: dict[Strength, list[Turn]],
) -> dict[int, Strength]:
    """index -> その日が確定した一番大きい強さ。"""
    labels: dict[int, Strength] = {}
    for strength in _LADDER_ORDER:  # 大きい順に先着
        for t in turns_by_strength.get(strength, []):
            labels.setdefault(t.index, strength)
    return labels


def ladder(closes: Sequence[float]) -> list[LadderRow]:
    """強さのはしご。4 行 (cycle → small)。

    各行は直近に確定した転換点 (無ければ None)、いま追跡中の候補、
    候補が確定する価格 (`confirm_at`) を持つ。向きがまだ決まっていない行
    (空・1 本だけの入力を含む) は `decided=False` で、候補と `confirm_at` は None。
    """
    rows: list[LadderRow] = []
    for strength in _LADDER_ORDER:
        r = STRENGTH_REVERSAL[strength]
        if not closes:
            rows.append(LadderRow(strength, False, None, None, None, None, None))
            continue
        turns, idx, kind, close, decided = _scan(closes, r)
        last = turns[-1] if turns else None
        if not decided:
            rows.append(LadderRow(strength, False, last, None, None, None, None))
            continue
        confirm_at = close * (1 - r) if kind == "top" else close * (1 + r)
        rows.append(
            LadderRow(
                strength=strength,
                decided=True,
                last_confirmed=last,
                candidate_index=idx,
                candidate_kind=kind,
                candidate_close=close,
                confirm_at=confirm_at,
            )
        )
    return rows
