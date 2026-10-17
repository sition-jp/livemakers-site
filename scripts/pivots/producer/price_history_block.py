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

import re
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
_ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_OUTCOMES = ("hit", "miss", "pending")


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
    * `backfilled=True` ⇔ `forecast` がさかのぼり計算。`forecast` が無い日は「空き」で
      `backfilled=False` (何もさかのぼっていない・R12 c)。
    * 今日の `forecast` は `today_items` (= その run の「今日の確率」) の値そのもので
      `backfilled=False`。`today_items` が無ければ、`existing` の同じ日の記録
      (`backfilled=False` で forecast あり) を残す (R12 b)。それも無ければ空き。
    * 過去の日: `existing` に `backfilled=False` で forecast のある記録があればそれを残す
      (実際に画面に出した値)。無い・空き・`backfilled=True` なら `score_at(t, h)` で計算し
      `backfilled=True`。スコアが出せない期間は省き、全部出せなければ `forecast` ごと省く (空き)。
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

    # 実際に画面に出した値 = backfilled=False で forecast があるもの。forecast の無い記録は
    # 「空き」なので守らない (さかのぼり計算で埋めてよい)。
    recorded: dict[str, dict] = {}
    for e in existing or []:
        if isinstance(e, dict) and isinstance(e.get("date"), str) and e.get("backfilled") is False:
            fc = _recorded_forecast(e.get("forecast"))
            if fc:
                recorded[e["date"]] = fc

    pending = {ev: {h: "pending" for h in HORIZONS} for ev in EVENTS}
    out: list[dict] = []
    for k in range(FORECAST_HISTORY_DAYS - 1, -1, -1):
        d = _days_before(today, k)
        t = index.get(d)
        entry: dict = {"date": d}
        if t is not None:
            entry["close"] = float(closes[t])

        if d == today:
            # 今日の確率が無い (その run で失敗) ときは、同じ日に先に出した値を残す (R12 b)
            fc = _today_forecast(today_items) or recorded.get(d, {})
            backfilled = False
        elif d in recorded:
            fc = recorded[d]
            backfilled = False
        else:
            fc = _backfill_forecast(frozen, asset, t, score_at) if t is not None else {}
            backfilled = bool(fc)  # forecast なし = 空き (何もさかのぼっていない・R12 c)
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


def with_todays_forecast(
    entries: Sequence[dict], today: str, forecast_items: Optional[list], close: Optional[float]
) -> list[dict]:
    """引き継いだ履歴に、今日サイトに出した確率の記録を足す (同じ日があれば置き換え・直近 120 件)。

    確率が無ければ (今日は何も出していない) 何も足さない。結果は今日の分だけ全問 `pending`。
    """
    fc = _today_forecast(forecast_items)
    out = [dict(e) for e in entries]
    if not fc:
        return out
    entry: dict = {"date": today}
    if close is None:  # 同じ日の記録に終値があれば残す
        close = next((e.get("close") for e in out if e.get("date") == today), None)
    if isinstance(close, (int, float)) and not isinstance(close, bool) and close > 0:
        entry["close"] = float(close)
    entry["forecast"] = fc
    entry["outcome"] = {ev: {h: "pending" for h in HORIZONS} for ev in EVENTS}
    entry["backfilled"] = False
    out = [e for e in out if e.get("date") != today] + [entry]
    out.sort(key=lambda e: e["date"])
    return out[-FORECAST_HISTORY_DAYS:]


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


def _sanitize_outcome(raw) -> dict:
    out: dict = {}
    if not isinstance(raw, dict):
        return out
    for ev in EVENTS:
        hs = raw.get(ev)
        if not isinstance(hs, dict):
            continue
        for h in HORIZONS:
            if hs.get(h) in _OUTCOMES:
                out.setdefault(ev, {})[h] = hs[h]
    return out


def carryable_history(existing_raw) -> dict[str, list]:
    """前回のスナップショットの `forecast_history` を、そのまま引き継げる形で返す (R12 a)。

    スキーマ (zod) に通る記録は変えずに残す。形の崩れた件・値は落とし、forecast の無い件は
    `backfilled=False` にする (引き継いだ block が検証で run を止めないため)。
    """
    if not isinstance(existing_raw, dict):
        return {}
    block = existing_raw.get("forecast_history")
    if not isinstance(block, dict):
        return {}
    out: dict[str, list] = {}
    for asset in ("BTC", "ETH"):
        entries = block.get(asset)
        if not isinstance(entries, list):
            continue
        kept: list = []
        for e in entries:
            if not isinstance(e, dict) or not isinstance(e.get("date"), str) or not _ISO_DATE.match(e["date"]):
                continue
            if not isinstance(e.get("backfilled"), bool):
                continue
            entry: dict = {"date": e["date"]}
            c = e.get("close")
            if isinstance(c, (int, float)) and not isinstance(c, bool) and c > 0:
                entry["close"] = c
            fc = _recorded_forecast(e.get("forecast"))
            if fc:
                entry["forecast"] = fc
            oc = _sanitize_outcome(e.get("outcome"))
            if oc:
                entry["outcome"] = oc
            entry["backfilled"] = bool(e["backfilled"]) and bool(fc)
            kept.append(entry)
        if kept:
            out[asset] = kept[-FORECAST_HISTORY_DAYS:]
    return out
