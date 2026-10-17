"""日次の系列: 長期の日足 (2017〜) と bulk の派生データを日付で揃え、スコアと答え合わせを出す。

オフライン評価 (`ops.iteration_report`) と live の「毎日の確率の履歴」
(`producer.price_history_block`) が同じ揃え方・同じスコア・同じ判定を使うための
共有モジュール (Ruling R11)。揃え方:

  * 日足 (Binance 現物) の日付をそのまま軸にする。派生データ (OI・funding) は
    同じ日付で bulk 履歴から引く (`_deriv_series`)。
  * bulk 履歴がその日の OI 増加率と funding を返せない日、指標のウォームアップ中の日
    (`_historical_scores` が (0,0,0) を返す日) はスコアなし (None)。0 点にはしない
    (Review Focus 4)。
  * 判定 (答え合わせ) は価格だけで決まる。天井・底は期間ごとの最小の強さの Turn を
    全期間で 1 回だけ求めて使い回す。
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional, Sequence

from producer.backtest import BacktestHitContext
from producer.bulk_history import BulkHistory
from producer.compose_backtest import (
    _deriv_series,
    _hit_context,
    _historical_scores,
    _precompute_asset_series,
)
from producer.horizon_inputs import IT_2026_10_RULES, RuleSet
from producer.outcomes import TURN_MIN_STRENGTH, Outcome, move_outcome, turn_outcome
from producer.percentiles import LOOKBACK_DAYS
from producer.turns import STRENGTH_REVERSAL, Turn, find_turns
from producer.types import HORIZONS, Horizon

# 百分位の履歴が遡る最大の日数。series_start からこの日数より後の日だけ、
# 全期間で計算したときと同じスコアになる。
MAX_LOOKBACK_DAYS = max(LOOKBACK_DAYS.values())


def day_ms(day: str) -> int:
    return int(datetime.strptime(day, "%Y-%m-%d").replace(tzinfo=timezone.utc).timestamp() * 1000)


def ms_day(ms: int) -> str:
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).strftime("%Y-%m-%d")


@dataclass
class AssetInput:
    dates: list[str]
    closes: list[float]
    highs: list[float]
    lows: list[float]
    volumes: list[float]
    history: BulkHistory


@dataclass
class Prepared:
    inp: AssetInput
    series: object
    deriv: list
    has_deriv: list[bool]
    series_start: int = 0

    @property
    def valid_from(self) -> int:
        """これより前の t のスコアは、全期間で計算したときと違いうる (series_start > 0 のとき)。"""
        return 0 if self.series_start == 0 else self.series_start + MAX_LOOKBACK_DAYS


def input_from_candles(candles: Sequence, history: BulkHistory) -> AssetInput:
    """日足 (`fetch_binance.Candle`) の列を AssetInput にする (日付 = open_time の UTC 日)。"""
    return AssetInput(
        dates=[ms_day(c.open_time) for c in candles],
        closes=[c.close for c in candles],
        highs=[c.high for c in candles],
        lows=[c.low for c in candles],
        volumes=[c.volume for c in candles],
        history=history,
    )


def prepare(inp: AssetInput, *, series_start: int = 0) -> Prepared:
    """指標の系列と派生データを 1 回だけ用意する。

    `series_start` > 0 なら指標をその位置から計算する (各位置の値は全期間で計算した
    ときと同じ。計算量を減らすだけ)。スコアが全期間と一致するのは `valid_from` 以降。
    """
    series = _precompute_asset_series(inp.closes, inp.highs, inp.lows, start=series_start)
    deriv = _deriv_series([day_ms(d) for d in inp.dates], inp.history)
    has = [
        inp.history.oi_growth_pct(d) is not None and inp.history.abs_funding(d) is not None
        for d in inp.dates
    ]
    return Prepared(inp=inp, series=series, deriv=deriv, has_deriv=has, series_start=series_start)


def score_at(
    p: Prepared, t: int, horizon: Horizon, rules: RuleSet = IT_2026_10_RULES
) -> Optional[tuple[int, int]]:
    """(price_pivot, volatility_pivot)。スコアなしの日は None。"""
    if t < p.valid_from:
        raise ValueError(f"t={t} is before valid_from={p.valid_from} (series_start={p.series_start})")
    if not p.has_deriv[t]:
        return None
    a, b, overall = _historical_scores(
        p.inp.closes, p.inp.volumes, p.series, p.deriv, t, horizon, rules
    )
    if (a, b, overall) == (0, 0, 0):  # ウォームアップ中 (実スコアなら overall ≥ 6)
        return None
    return a, b


def scores(
    p: Prepared, horizon: Horizon, rules: RuleSet = IT_2026_10_RULES
) -> tuple[list[Optional[int]], list[Optional[int]]]:
    """全日の (price_pivot, volatility_pivot)。スコアなしの日は None。"""
    n = len(p.inp.dates)
    pp: list[Optional[int]] = [None] * n
    vp: list[Optional[int]] = [None] * n
    for t in range(p.valid_from, n):
        s = score_at(p, t, horizon, rules)
        if s is not None:
            pp[t], vp[t] = s
    return pp, vp


def hit_context(p: Prepared, t: int) -> BacktestHitContext:
    if t < p.series_start:
        raise ValueError(f"t={t} is before series_start={p.series_start}")
    return _hit_context(p.series, t)


def turns_by_horizon(closes: Sequence[float]) -> dict[Horizon, list[Turn]]:
    """期間ごとの最小の強さで、全期間の天井・底を 1 回だけ求める。"""
    by_strength: dict[str, list[Turn]] = {}
    out: dict[Horizon, list[Turn]] = {}
    for h in HORIZONS:
        s = TURN_MIN_STRENGTH[h]
        if s not in by_strength:
            by_strength[s] = find_turns(closes, STRENGTH_REVERSAL[s])
        out[h] = by_strength[s]
    return out


def outcome_at(
    closes: Sequence[float],
    t: int,
    event: str,
    horizon: Horizon,
    *,
    turns: dict[Horizon, list[Turn]],
    ctx: Optional[BacktestHitContext],
) -> Outcome:
    if event == "turn":
        return turn_outcome(closes, t, horizon, turns=turns[horizon])
    if event == "move":
        return move_outcome(closes, t, horizon, ctx)
    raise ValueError(f"unknown event: {event}")


def outcomes(p: Prepared, event: str, horizon: Horizon) -> list[Outcome]:
    """全日の判定。大きく動くの閾値に指標を使うので series_start = 0 で用意したものに使う。"""
    closes = p.inp.closes
    turns = turns_by_horizon(closes) if event == "turn" else {}
    return [
        outcome_at(
            closes, t, event, horizon, turns=turns,
            ctx=None if event == "turn" else hit_context(p, t),
        )
        for t in range(len(closes))
    ]
