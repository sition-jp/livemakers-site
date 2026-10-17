"""長期の終値から作るブロック: トレンド・強さのはしご・天井底・毎日の確率の履歴 (it-2026-10 段 2)。

どれも資産ごと。日付・終値は Binance 現物の日足 (2017-08-17 から)。

日足の扱い:
  * live の日付 (`today`) = `generated_at` の UTC 日。その日付の足は取得時点ではまだ
    確定していない。今日の終値 (トレンドと、履歴の今日の分の `close`) はその足を使う
    (既存の `history` と同じ)。
  * 天井・底 (はしご・天井底の一覧) と答え合わせは確定した足 (日付 < today) だけで
    求める。確定した天井・底は後から動かない (未確定の足で一時的に確定・解除されない)。
  * 過去の日のスコアは `score_at` (backtest と同じ `_historical_scores`・bulk の派生データ・
    日付で揃える処理は `producer.daily_series` と共有) で出す。スコアが出せない日は
    `forecast` を省く (0 と書かない・Review Focus 4)。
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Callable, Optional, Sequence

from producer import daily_series
from producer.backtest import BacktestHitContext
from producer.forecast import EVENTS, Frozen, today_pct
from producer.turns import (
    STRENGTH_REVERSAL,
    Turn,
    find_turns,
    ladder,
    strongest_label,
)
from producer.types import HORIZONS, Horizon

LONG_HISTORY_START = "2017-08-17"
FORECAST_HISTORY_DAYS = 120
TURNS_RECENT_DAYS = 120

ScoreAt = Callable[[int, Horizon], Optional[tuple[int, int]]]


def _ret_pct(now: float, then: float) -> float:
    return round((now / then - 1.0) * 100, 1)


def trend(closes: Sequence[float]) -> dict:
    """今日の終値と、30 日前・90 日前の終値との比 (%・小数 1 桁)。足りなければそのキーを省く。"""
    out: dict = {}
    for days, key in ((30, "ret_30d_pct"), (90, "ret_90d_pct")):
        if len(closes) > days and closes[-1 - days] > 0:
            out[key] = _ret_pct(closes[-1], closes[-1 - days])
    return out


def _point(dates: Sequence[str], index: int, kind: str, close: float) -> dict:
    return {"date": dates[index], "kind": kind, "close": close}


def ladder_json(dates: Sequence[str], closes: Sequence[float]) -> list[dict]:
    """強さのはしご 4 行 (cycle → small)。向き未定の行は candidate・confirm_at が null。"""
    rows = []
    for r in ladder(closes):
        last = r.last_confirmed
        decided = (
            r.decided
            and r.candidate_index is not None
            and r.candidate_kind is not None
            and r.candidate_close is not None
            and r.confirm_at is not None
        )
        rows.append(
            {
                "strength": r.strength,
                "decided": bool(decided),
                "last_confirmed": None if last is None else _point(dates, last.index, last.kind, last.close),
                "candidate": _point(dates, r.candidate_index, r.candidate_kind, r.candidate_close)
                if decided
                else None,
                "confirm_at": r.confirm_at if decided else None,
            }
        )
    return rows


def _days_before(day: str, n: int) -> str:
    return (date.fromisoformat(day) - timedelta(days=n)).isoformat()


def turns_json(dates: Sequence[str], closes: Sequence[float], today: str) -> list[dict]:
    """確定した天井・底: 日付が今日を含む直近 120 日以内のもの + サイクル級すべて (日付順)。

    `strength` はその日が確定した一番大きい強さ (`strongest_label`)。
    """
    if not closes:
        return []
    by_strength = {s: find_turns(closes, r) for s, r in STRENGTH_REVERSAL.items()}
    labels = strongest_label(by_strength)
    kinds: dict[int, Turn] = {}
    for s in ("cycle", "large", "medium", "small"):  # 一番大きい強さの Turn を使う
        for t in by_strength[s]:
            kinds.setdefault(t.index, t)
    cutoff = _days_before(today, TURNS_RECENT_DAYS - 1)
    out = []
    for i in sorted(labels):
        if dates[i] >= cutoff or labels[i] == "cycle":
            t = kinds[i]
            out.append({"date": dates[i], "kind": t.kind, "strength": labels[i], "close": t.close})
    return out


def _today_forecast(today_items: Optional[list]) -> dict:
    fc: dict = {}
    for item in today_items or []:
        if not isinstance(item, dict):
            continue
        ev, h, pct = item.get("event"), item.get("horizon"), item.get("today_pct")
        if ev in EVENTS and h in HORIZONS and isinstance(pct, (int, float)):
            fc.setdefault(ev, {})[h] = round(float(pct), 1)
    return fc


def _recorded_forecast(raw) -> dict:
    """前回のスナップショットに記録した値 (形の崩れた部分は捨てる・値は変えない)。"""
    fc: dict = {}
    if not isinstance(raw, dict):
        return fc
    for ev in EVENTS:
        hs = raw.get(ev)
        if not isinstance(hs, dict):
            continue
        for h in HORIZONS:
            v = hs.get(h)
            if isinstance(v, (int, float)) and not isinstance(v, bool) and 0 <= v <= 100:
                fc.setdefault(ev, {})[h] = v
    return fc


def _backfill_forecast(frozen: Frozen, asset: str, t: int, score_at: ScoreAt) -> dict:
    use = {"price_pivot": 0, "volatility_pivot": 1}
    fc: dict = {}
    for h in HORIZONS:
        pair = score_at(t, h)
        if pair is None:
            continue
        for ev in EVENTS:
            fc.setdefault(ev, {})[h] = today_pct(
                frozen, asset, ev, h, int(pair[use[frozen.event_score_type[ev]]])
            )
    return fc


def forecast_history(
    dates: Sequence[str],
    closes: Sequence[float],
    frozen: Frozen,
    asset: str,
    today_items: Optional[list],
    existing: Optional[list],
    score_at: ScoreAt,
    *,
    today: Optional[str] = None,
    hit_context: Optional[Callable[[int], BacktestHitContext]] = None,
) -> list[dict]:
    """今日を含む直近 120 暦日の確率と答え合わせ (1 日 1 件・日付順・抜けなし)。

    * `dates`/`closes` は日付順の日足。`today` (既定 = `dates[-1]`) の足はまだ確定して
      いないものとして扱い、答え合わせには使わない (今日の `close` にだけ使う)。
    * 今日の `forecast` は `today_items` (= その run の「今日の確率」) の値そのもので
      `backfilled=False`。`today_items` が無ければ今日の `forecast` は省き `backfilled=True`
      (画面に出した値が無い・次の run でさかのぼり計算する)。
    * 過去の日: `existing` に `backfilled=False` の記録があればその `forecast` を残す
      (実際に画面に出した値)。無い・`backfilled=True` なら `score_at(t, h)` で計算し
      `backfilled=True`。スコアが出せない期間は省き、全部出せなければ `forecast` ごと省く。
    * `outcome` は毎回、確定した足で計算し直す (結果待ちが確定に変わるため)。今日は全部
      `pending`。日足の無い日は `close` と `outcome` を省く。
    * `hit_context(t)` は「大きく動く」の閾値に使う指標 (backtest と同じ。省くと固定の閾値)。
    """
    if today is None:
        if not dates:
            raise ValueError("dates must not be empty when today is not given")
        today = dates[-1]
    index = {d: i for i, d in enumerate(dates) if d <= today}
    if any(a >= b for a, b in zip(dates, dates[1:])):
        raise ValueError("dates must be strictly increasing")
    closed_n = sum(1 for d in dates if d < today)  # 日付順なので先頭からの本数
    closed = list(closes[:closed_n])
    turns = daily_series.turns_by_horizon(closed) if closed else {h: [] for h in HORIZONS}

    recorded: dict[str, dict] = {}
    for e in existing or []:
        if isinstance(e, dict) and isinstance(e.get("date"), str) and e.get("backfilled") is False:
            recorded[e["date"]] = e

    pending = {ev: {h: "pending" for h in HORIZONS} for ev in EVENTS}
    out: list[dict] = []
    for k in range(FORECAST_HISTORY_DAYS - 1, -1, -1):
        d = _days_before(today, k)
        t = index.get(d)
        entry: dict = {"date": d}
        if t is not None:
            entry["close"] = float(closes[t])

        if d == today:
            fc = _today_forecast(today_items)
            backfilled = not fc
        elif d in recorded:
            fc = _recorded_forecast(recorded[d].get("forecast"))
            backfilled = False
        else:
            fc = _backfill_forecast(frozen, asset, t, score_at) if t is not None else {}
            backfilled = True
        if fc:
            entry["forecast"] = fc

        if d == today:
            entry["outcome"] = {ev: dict(hs) for ev, hs in pending.items()}
        elif t is not None and t < closed_n:
            entry["outcome"] = {
                ev: {
                    h: daily_series.outcome_at(
                        closed, t, ev, h, turns=turns,
                        ctx=hit_context(t) if (ev == "move" and hit_context) else None,
                    )
                    for h in HORIZONS
                }
                for ev in EVENTS
            }
        entry["backfilled"] = backfilled
        out.append(entry)
    return out


def closed_and_today(
    candles: Sequence, today: str
) -> tuple[list, Optional[object]]:
    """日足を (確定した足 = 日付 < today, 今日の足 or None) に分ける。今日より後の足は捨てる。"""
    closed = [c for c in candles if daily_series.ms_day(c.open_time) < today]
    todays = [c for c in candles if daily_series.ms_day(c.open_time) == today]
    return closed, (todays[-1] if todays else None)


def series_start_for(n_closed: int) -> int:
    """直近 120 日のスコアが全期間で計算したときと同じになる、指標の計算開始位置。"""
    return max(0, n_closed - FORECAST_HISTORY_DAYS - daily_series.MAX_LOOKBACK_DAYS)
