"""相場の状態 (1〜3 か月の 6 状態・足元の 3 状態・長期の 3 状態・暴落/急騰の後の回数)。

どれも承認済みの分析の写し (ルールは変えない)。出どころ:
  - 日足の 6 状態:  08_DOCS/reports/turning_point/2026-11-14-market-regime-classification/core.py
                    (rv30_series / Params / classify)
  - 足元の 3 状態:  同 two_layer.py hyst(z30, 0.75, 0.25)
  - 長期 3 状態:    08_DOCS/reports/turning_point/2026-11-15-market-regime-long-layer/
                    long_layer.py (weekly / sma / rule_dd / to_daily) +
                    rule_c_fix.py rule_c_sticky (承認された推奨 C) +
                    long_layer_binance.py state_detail (高値・底・線の出し方)
  - 暴落/急騰の後: 同 shock_after.py episodes
標準ライブラリのみ。状態キー: mid = up|down|range|calm|crash|surge / near = up|flat|down /
long = up|down|recovering (分析の MID = 戻りの途中)。
"""
from __future__ import annotations

import math
import statistics
from dataclasses import dataclass
from datetime import date


# ---------------------------------------------------------------- 日足 (core.py)
def rv30_series(closes):
    """core.rv30_series の写し: 30 本の log リターンの標本標準偏差 × √365。"""
    out = [None] * len(closes)
    lr = [None] + [math.log(closes[i] / closes[i - 1]) for i in range(1, len(closes))]
    for t in range(30, len(closes)):
        out[t] = statistics.stdev(lr[t - 29:t + 1]) * math.sqrt(365.0)
    return out


@dataclass(frozen=True)
class MidParams:
    trend_a: float = 0.75
    calm_c: float = 0.75
    shock_m: float = 3.5
    shock_h: tuple = (1, 3, 7)
    shock_days: int = 7
    min_days: int = 5
    base_window: int = 365
    base_min: int = 30


def classify_mid(closes, p: MidParams = MidParams()):
    """core.classify (trend_rule="avg") の写し。label は小文字キー。"""
    rv = rv30_series(closes)
    n = len(closes)
    sig = [None] * n
    hist = []
    for t in range(n):
        if rv[t] is not None:
            hist.append(rv[t])
        if len(hist) >= p.base_min:
            sig[t] = statistics.median(hist[-p.base_window:])
    raw = [None] * n
    z30s = [None] * n
    shock = [None] * n
    for t in range(n):
        if sig[t] is None:
            continue
        sd = sig[t] / math.sqrt(365.0)
        z30 = math.log(closes[t] / closes[t - 30]) / (sd * math.sqrt(30))
        z90 = (math.log(closes[t] / closes[t - 90]) / (sd * math.sqrt(90))) if t >= 90 else z30
        z30s[t] = z30
        score = (z30 + z90) / 2
        ratio = rv[t] / sig[t]
        if score >= p.trend_a and z30 > 0:
            raw[t] = "up"
        elif score <= -p.trend_a and z30 < 0:
            raw[t] = "down"
        elif ratio < p.calm_c:
            raw[t] = "calm"
        else:
            raw[t] = "range"
        for h in p.shock_h:
            if t - h < 0:
                continue
            r = math.log(closes[t] / closes[t - h])
            lim = p.shock_m * sd * math.sqrt(h)
            if r <= -lim:
                shock[t] = "crash"
                break
            if r >= lim:
                shock[t] = "surge"
                break
    base = [None] * n
    cur, cnt = None, 0
    for t in range(n):
        if raw[t] is None:
            continue
        if cur is None:
            cur = raw[t]
        elif raw[t] == cur:
            cnt = 0
        else:
            cnt += 1
            if cnt >= p.min_days:
                cur, cnt = raw[t], 0
        base[t] = cur
    lab = list(base)
    active, until = None, -1
    for t in range(n):
        if shock[t] and (active is None or t > until or shock[t] == active):
            active, until = shock[t], t + p.shock_days - 1
        if active and t <= until and lab[t] is not None:
            lab[t] = active
        elif t > until:
            active = None
    return {"label": lab, "base": base, "sig": sig, "z30": z30s}


def near_states(z30, lin=0.75, lout=0.25):
    """two_layer.hyst の写し: up|flat|down。±lin で入り、±lout の内側で横ばいへ戻る。"""
    out, cur = [None] * len(z30), None
    for t, z in enumerate(z30):
        if z is None:
            continue
        if z >= lin:
            cur = "up"
        elif z <= -lin:
            cur = "down"
        elif cur == "up" and z < lout:
            cur = "flat"
        elif cur == "down" and z > -lout:
            cur = "flat"
        elif cur is None:
            cur = "flat"
        out[t] = cur
    return out


def run_start(labels, t):
    """今日 (位置 t) の状態が始まった位置 (同じ label が続く最初の位置)。"""
    s = t
    while s > 0 and labels[s - 1] == labels[t]:
        s -= 1
    return s


# ---------------------------------------------------------------- 長期 (long_layer / rule_c_fix)
def weekly(dates, closes):
    """long_layer.weekly の写し: 日曜 (UTC) の終値だけ。"""
    wd, wc = [], []
    for d, c in zip(dates, closes):
        if date.fromisoformat(d).weekday() == 6:
            wd.append(d)
            wc.append(c)
    return wd, wc


def _sma(v, n):
    out, s = [None] * len(v), 0.0
    for i, x in enumerate(v):
        s += x
        if i >= n:
            s -= v[i - n]
        if i >= n - 1:
            out[i] = s / n
    return out


def _rule_dd(wc, r_dn, r_up):
    """long_layer.rule_dd (start=0) の写し。"""
    out = [None] * len(wc)
    cur, peak, trough = "up", wc[0], wc[0]
    for i, c in enumerate(wc):
        if cur == "up":
            peak = max(peak, c)
            if c <= peak * (1 - r_dn):
                cur, trough = "down", c
        else:
            trough = min(trough, c)
            if c >= trough * (1 + r_up):
                cur, peak = "up", c
        out[i] = cur
    return out


def long_states(week_closes, n_weeks=100, r_dn=0.30, r_up=0.50):
    """rule_c_fix.rule_c_sticky の写し。(状態 up|down|recovering, 100 週線)。"""
    wc = week_closes
    m = _sma(wc, n_weeks)
    dd = _rule_dd(wc, r_dn, r_up)
    out, prev = [None] * len(wc), None
    for i, x in enumerate(dd):
        if m[i] is None:
            continue
        if x == "down":
            s = "down"
        elif prev in ("down", "recovering") or prev is None:
            s = "up" if wc[i] > m[i] else "recovering"
        else:
            s = "up"
        out[i], prev = s, s
    return out, m


def long_detail(dates, closes):
    """long_layer_binance.state_detail の写し (+ 状態の始まり)。100 週線がそろわなければ None。"""
    wd, wc = weekly(dates, closes)
    if len(wc) < 100:
        return None
    lab, m = long_states(wc)
    if lab[-1] is None:
        return None
    cur, peak, trough = "up", wc[0], wc[0]
    peak_w, trough_w = wd[0], wd[0]
    last_trough = None  # 戻りの途中で見せる「下げ相場の底」
    for i, c in enumerate(wc):
        if cur == "up":
            if c > peak:
                peak, peak_w = c, wd[i]
            if c <= peak * 0.70:
                cur, trough, trough_w = "down", c, wd[i]
                last_trough = (trough_w, trough)
        else:
            if c < trough:
                trough, trough_w = c, wd[i]
                last_trough = (trough_w, trough)
            if c >= trough * 1.50:
                cur, peak, peak_w = "up", c, wd[i]
    s = len(lab) - 1
    while s > 0 and lab[s - 1] == lab[-1]:
        s -= 1
    ath_i = max(range(len(closes)), key=lambda i: closes[i])
    state = lab[-1]
    out = {
        "state": state, "since_week": wd[s], "last_week": wd[-1],
        "ath": {"date": dates[ath_i], "close": closes[ath_i],
                "pct_from_ath": 100 * (closes[-1] / closes[ath_i] - 1)},
        "w100": m[-1], "last_close": wc[-1], "trough": None, "peak": None,
        "line_to_down": None, "line_to_leave_down": None,
    }
    if state == "down":
        out["trough"] = {"week": trough_w, "close": trough}
        out["line_to_leave_down"] = trough * 1.5
    else:
        out["peak"] = {"week": peak_w, "close": peak}
        out["line_to_down"] = peak * 0.70
        if state == "recovering" and last_trough:
            out["trough"] = {"week": last_trough[0], "close": last_trough[1]}
    return out


def to_daily(dates, week_dates, week_states):
    """long_layer.to_daily の写し: 週足の判定はその日曜の翌日から。"""
    out, j = [None] * len(dates), -1
    for i, d in enumerate(dates):
        while j + 1 < len(week_dates) and week_dates[j + 1] < d:
            j += 1
        out[i] = week_states[j] if j >= 0 else None
    return out


# ---------------------------------------------------------------- 暴落・急騰の後 (shock_after.episodes)
SHOCK_H = 30


def shock_history(dates, closes, mid_labels, long_daily, kind, long_state, today_index):
    """過去の同じ種類の回のうち、起点 + 30 日 ≤ today_index で、起点の日の長期の状態が
    long_state と同じ回だけを数える。今日の回を明示的に除いてはいない — 今日の回の起点は
    今日から 30 日以内なので、起点 + 30 ≤ today_index の条件で自然に外れる。"""
    lab = mid_labels
    n = 0
    new_extreme = higher = 0
    for t in range(today_index + 1):
        if lab[t] != kind or (t > 0 and lab[t - 1] == kind):
            continue
        if t + SHOCK_H > today_index or long_daily[t] != long_state:
            continue
        fut = closes[t + 1:t + SHOCK_H + 1]
        past7 = closes[max(0, t - 6):t + 1]
        n += 1
        higher += closes[t + SHOCK_H] > closes[t]
        if kind == "crash":
            new_extreme += min(fut) < min(past7)
        else:
            new_extreme += max(fut) > max(past7)
    start_day = None
    if lab[today_index] == kind:
        start_day = dates[run_start(lab, today_index)]
    return {"kind": kind, "long_state": long_state, "n": n,
            "new_extreme_30d": new_extreme, "higher_30d": higher, "start_day": start_day}


# ---------------------------------------------------------------- 画面用のブロック
def regime_json(closed_dates, closed_closes, dates, closes):
    """画面用の regime ブロック。

    closed_* = 確定した日足だけ (長期の週足はこれだけで作る)。dates/closes = 今日の価格を
    末尾に足した系列 (1〜3 か月・足元・今日の長期の状態の引き当てに使う)。
    長期が出せない (週足 100 本未満など) ときは long = None。shock は mid が crash|surge の日だけ。
    """
    n = len(closes)
    t = n - 1
    out = {"as_of": dates[-1], "long": None, "mid": None, "near": None}

    mid = classify_mid(closes)
    labels = mid["label"]
    near_lab = near_states(mid["z30"])

    def _run(lab):
        s = run_start(lab, t)
        since = dates[s]
        return {"state": lab[t], "since": since,
                "days": (date.fromisoformat(dates[t]) - date.fromisoformat(since)).days + 1}

    if labels[t] is not None:
        out["mid"] = _run(labels)
    if near_lab[t] is not None:
        near = _run(near_lab)
        if t >= 30:
            near["ret_30d_pct"] = round((closes[t] / closes[t - 30] - 1) * 100, 1)
            near["close_30d_ago"] = closes[t - 30]
        near["close"] = closes[t]
        out["near"] = near

    detail = long_detail(closed_dates, closed_closes)
    if detail is not None:
        # 画面の数字は全部同じ「今日」の価格で測る (最高値からの % も今日の価格)
        detail["ath"]["pct_from_ath"] = 100 * (closes[t] / detail["ath"]["close"] - 1)
        out["long"] = detail

    if labels[t] in ("crash", "surge"):
        wd, wc = weekly(closed_dates, closed_closes)
        if len(wc) >= 100:
            lab, _ = long_states(wc)
            long_daily = to_daily(dates, wd, lab)
            if long_daily[t] is not None:
                out["shock"] = shock_history(
                    dates, closes, labels, long_daily, labels[t], long_daily[t], t)
    return out
