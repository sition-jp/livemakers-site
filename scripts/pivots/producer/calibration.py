"""較正表: スコア (0-100) を確率に読み替える (it-2026-10)。

区間ごとの hit 率を「ふだんの率」に縮めた値を確率とする。
事前登録済みの値 (区間・縮め強さ k・兆しの差) は評価前に固定したもので、変更しない。
"pending" は fit / Brier / lift のすべてから除く。
"""
from __future__ import annotations

from bisect import bisect_right
from dataclasses import dataclass
from typing import Sequence

from .outcomes import Outcome

BIN_EDGES: tuple[int, ...] = (0, 20, 40, 60, 80, 101)
# 各区間の `hi` は「その値は含まない上端」(例: 20-40 は 20 以上 40 未満)。
# ただし最後の区間だけは上端を含み、100 として保存する (80 以上 100 以下)。
SHRINK_K: float = 20.0
_EPS = 1e-9  # 0.5 - 0.4 >= 0.10 のような境界を浮動小数の誤差で落とさない


@dataclass(frozen=True)
class CalibrationTable:
    usual: float
    bins: tuple[tuple[int, int, float, int], ...]  # (lo, hi, prob, n)


def _resolved(
    values: Sequence, outcomes: Sequence[Outcome]
) -> list[tuple[object, bool]]:
    if len(values) != len(outcomes):
        raise ValueError(
            f"長さが一致しない: {len(values)} 件と {len(outcomes)} 件"
        )
    return [(v, o == "hit") for v, o in zip(values, outcomes) if o != "pending"]


def _bin_index(score: float) -> int:
    i = bisect_right(BIN_EDGES, score) - 1
    return max(0, min(i, len(BIN_EDGES) - 2))  # 範囲外は端の区間に寄せる


def fit(scores: Sequence[int], outcomes: Sequence[Outcome]) -> CalibrationTable:
    """pending を除いて較正表を作る。標本が 0 件なら ValueError。"""
    rows = _resolved(scores, outcomes)
    if not rows:
        raise ValueError("pending 以外の標本が 0 件のため較正表を作れない")
    usual = sum(h for _, h in rows) / len(rows)
    nbins = len(BIN_EDGES) - 1
    hits = [0] * nbins
    ns = [0] * nbins
    for s, h in rows:
        i = _bin_index(s)  # type: ignore[arg-type]
        ns[i] += 1
        hits[i] += h
    bins = tuple(
        (
            BIN_EDGES[i],
            BIN_EDGES[i + 1] - 1 if i == nbins - 1 else BIN_EDGES[i + 1],
            (hits[i] + SHRINK_K * usual) / (ns[i] + SHRINK_K),
            ns[i],
        )
        for i in range(nbins)
    )
    return CalibrationTable(usual=usual, bins=bins)


def predict(table: CalibrationTable, score: int) -> float:
    """スコアを確率に。0..100 の外は端の区間に寄せる。"""
    return table.bins[_bin_index(score)][2]


def brier(probs: Sequence[float], outcomes: Sequence[Outcome]) -> float:
    """Brier スコア (小さいほど良い)。pending を除き、0 件なら ValueError。"""
    rows = _resolved(probs, outcomes)
    if not rows:
        raise ValueError("pending 以外の標本が 0 件のため Brier を計算できない")
    return sum((p - h) ** 2 for p, h in rows) / len(rows)  # type: ignore[operator]


def brier_skill(
    probs: Sequence[float], outcomes: Sequence[Outcome], usual: float
) -> float | None:
    """1 - Brier / Brier(ふだんの率だけ)。ふだんのみの Brier が 0 なら None。"""
    b = brier(probs, outcomes)
    base = brier([usual] * len(probs), outcomes)
    if base <= 0:
        return None
    return 1.0 - b / base


def lift(
    probs: Sequence[float],
    outcomes: Sequence[Outcome],
    usual: float,
    gap: float = 0.10,
) -> float | None:
    """「今日 - ふだん >= gap」の日の発生率 - それ以外の日の発生率。

    どちらかが 0 件なら None。
    """
    rows = _resolved(probs, outcomes)
    sig = [h for p, h in rows if p - usual >= gap - _EPS]  # type: ignore[operator]
    rest = [h for p, h in rows if p - usual < gap - _EPS]  # type: ignore[operator]
    if not sig or not rest:
        return None
    return sum(sig) / len(sig) - sum(rest) / len(rest)


def to_json(table: CalibrationTable) -> dict:
    return {
        "usual": table.usual,
        "bins": [
            {"lo": lo, "hi": hi, "prob": prob, "n": n}
            for lo, hi, prob, n in table.bins
        ],
    }


def from_json(d: dict) -> CalibrationTable:
    return CalibrationTable(
        usual=float(d["usual"]),
        bins=tuple(
            (int(b["lo"]), int(b["hi"]), float(b["prob"]), int(b["n"]))
            for b in d["bins"]
        ),
    )
