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
