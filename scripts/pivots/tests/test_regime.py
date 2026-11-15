"""regime.py の検証。参照実装 = 分析スクリプト (core.py / two_layer.py / long_layer.py /
rule_c_fix.py / shock_after.py) の関数をそのまま写したもの。producer の出力が一致すること。"""
import math
import statistics
from datetime import date, timedelta

import pytest

from producer import regime

# ---- 参照実装 (core.py の写し) ----
REF_STATES = ["UP", "DOWN", "RANGE", "CALM", "CRASH", "SURGE"]


def ref_rv30(closes):
    out = [None] * len(closes)
    lr = [None] + [math.log(closes[i] / closes[i - 1]) for i in range(1, len(closes))]
    for t in range(30, len(closes)):
        out[t] = statistics.stdev(lr[t - 29:t + 1]) * math.sqrt(365.0)
    return out


def ref_classify(closes, rv):
    trend_a, calm_c, shock_m, shock_h, shock_days, min_days, base_window, base_min = 0.75, 0.75, 3.5, (1, 3, 7), 7, 5, 365, 30
    n = len(closes)
    sig = [None] * n
    hist = []
    for t in range(n):
        if rv[t] is not None:
            hist.append(rv[t])
        if len(hist) >= base_min:
            sig[t] = statistics.median(hist[-base_window:])
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
        up = score >= trend_a and z30 > 0
        dn = score <= -trend_a and z30 < 0
        raw[t] = "UP" if up else "DOWN" if dn else "CALM" if ratio < calm_c else "RANGE"
        for h in shock_h:
            if t - h < 0:
                continue
            r = math.log(closes[t] / closes[t - h])
            lim = shock_m * sd * math.sqrt(h)
            if r <= -lim:
                shock[t] = "CRASH"
                break
            if r >= lim:
                shock[t] = "SURGE"
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
            if cnt >= min_days:
                cur, cnt = raw[t], 0
        base[t] = cur
    lab = list(base)
    active, until = None, -1
    for t in range(n):
        if shock[t] and (active is None or t > until or shock[t] == active):
            active, until = shock[t], t + shock_days - 1
        if active and t <= until and lab[t] is not None:
            lab[t] = active
        elif t > until:
            active = None
    return dict(label=lab, base=base, sig=sig, z30=z30s)


def ref_hyst(z30, Lin, Lout):  # two_layer.hyst の写し
    out, cur = [None] * len(z30), None
    for t, z in enumerate(z30):
        if z is None:
            continue
        if z >= Lin:
            cur = "UPS"
        elif z <= -Lin:
            cur = "DNS"
        elif cur == "UPS" and z < Lout:
            cur = "FLAT"
        elif cur == "DNS" and z > -Lout:
            cur = "FLAT"
        elif cur is None:
            cur = "FLAT"
        out[t] = cur
    return out


# ---- 合成の終値 ----
def noisy(n, drift, seed=1, start=100.0, amp=0.01):
    x = start
    out = []
    s = seed
    for _ in range(n):
        s = (s * 1103515245 + 12345) % (2 ** 31)
        e = (s / 2 ** 31 - 0.5) * 2 * amp
        x *= math.exp(drift + e)
        out.append(x)
    return out


def series_up():
    return noisy(200, 0.003)


def series_down():
    return noisy(200, -0.003)


def series_flat():
    return noisy(200, 0.0, amp=0.0005)


def series_crash():
    c = noisy(150, 0.0, amp=0.008)
    c[100:] = [x * 0.25 for x in c[100:]]  # 100 日目に 4 分の 1 (3.5 倍を超える急落)
    return c


def day_list(n, start=date(2017, 8, 17)):
    return [(start + timedelta(days=i)).isoformat() for i in range(n)]


ALL = {"up": series_up, "down": series_down, "flat": series_flat, "crash": series_crash}


@pytest.mark.parametrize("name", list(ALL))
def test_rv30_matches_reference(name):
    c = ALL[name]()
    assert regime.rv30_series(c) == ref_rv30(c)


@pytest.mark.parametrize("name", list(ALL))
def test_classify_matches_core(name):
    c = ALL[name]()
    ref = ref_classify(c, ref_rv30(c))
    got = regime.classify_mid(c)
    assert got["label"] == [x.lower() if x else None for x in ref["label"]]
    assert got["base"] == [x.lower() if x else None for x in ref["base"]]
    assert got["z30"] == ref["z30"]
    assert got["sig"] == ref["sig"]


@pytest.mark.parametrize("name", list(ALL))
def test_near_matches_hyst(name):
    c = ALL[name]()
    z = ref_classify(c, ref_rv30(c))["z30"]
    m = {"UPS": "up", "DNS": "down", "FLAT": "flat", None: None}
    assert regime.near_states(z) == [m[x] for x in ref_hyst(z, 0.75, 0.25)]


def test_trend_up_and_down_labels():
    assert regime.classify_mid(series_up())["label"][-1] == "up"
    assert regime.classify_mid(series_down())["label"][-1] == "down"


def test_no_label_before_30_days():
    lab = regime.classify_mid(noisy(60, 0.003))["label"]
    assert all(x is None for x in lab[:59])  # 30 本の RV が出る 30 日目 + 基準 30 本 = 59 日目から
    assert lab[59] is not None
    assert regime.classify_mid(noisy(30, 0.0))["label"] == [None] * 30


def test_crash_shows_7_days_and_extends():
    c = series_crash()
    lab = regime.classify_mid(c)["label"]
    assert lab[99] != "crash"
    # 100 日目に急落。1・3・7 日のどれかの動きが線を超える間 (100〜106 日目) は毎日発火し、
    # 最後の発火 (106 日目) から 7 日 = 112 日目まで「暴落」を続ける (再発火で延長)
    assert all(lab[t] == "crash" for t in range(100, 113))
    assert lab[113] != "crash"


def test_crash_extends_on_refire():
    c = noisy(150, 0.0, amp=0.008)
    c[100:] = [x * 0.25 for x in c[100:]]
    c[104:] = [x * 0.25 for x in c[104:]]  # 104 日目にもう一度急落 → 発火が 110 日目まで延び、116 日目まで表示
    lab = regime.classify_mid(c)["label"]
    assert all(lab[t] == "crash" for t in range(100, 117))
    assert lab[117] != "crash"


def test_mid_switch_needs_5_days():
    # 基本の 4 状態は、別の状態が 5 日続くまで切り替わらない
    raw_c = noisy(100, 0.003) + noisy(100, -0.003, start=300.0)
    b2 = regime.classify_mid(raw_c)["base"]
    ref = ref_classify(raw_c, ref_rv30(raw_c))["base"]
    assert b2 == [x.lower() if x else None for x in ref]
    # 切り替えは必ず「違う日が 5 日続いた」あと: 連続する切替の間隔 ≥ 5
    sw = [t for t in range(1, len(b2)) if b2[t] and b2[t - 1] and b2[t] != b2[t - 1]]
    assert all(b - a >= 5 for a, b in zip(sw, sw[1:]))


def test_near_hysteresis():
    assert regime.near_states([0.8]) == ["up"]
    assert regime.near_states([0.8, 0.3]) == ["up", "up"]
    assert regime.near_states([0.8, 0.3, 0.2]) == ["up", "up", "flat"]
    assert regime.near_states([-0.8]) == ["down"]
    assert regime.near_states([-0.8, -0.3, -0.2]) == ["down", "down", "flat"]
    assert regime.near_states([None, 0.1]) == [None, "flat"]


def test_run_start():
    assert regime.run_start(["a", "a", "b", "b", "b"], 4) == 2
    assert regime.run_start(["a", "a", "b"], 1) == 0
    assert regime.run_start([None, "x", "x"], 2) == 1


# ================= Task 4: 長期の層 =================
# ---- 参照実装 (long_layer.py / rule_c_fix.py の写し) ----
def ref_weekly(days, closes):
    wd, wc = [], []
    for d, c in zip(days, closes):
        if date.fromisoformat(d).weekday() == 6:
            wd.append(d)
            wc.append(c)
    return wd, wc


def ref_sma(v, n):
    out, s = [None] * len(v), 0.0
    for i, x in enumerate(v):
        s += x
        if i >= n:
            s -= v[i - n]
        if i >= n - 1:
            out[i] = s / n
    return out


def ref_rule_dd(wc, r_dn, r_up, start=104):
    out = [None] * len(wc)
    cur, peak, trough = "UP", wc[0], wc[0]
    for i, c in enumerate(wc):
        if cur == "UP":
            peak = max(peak, c)
            if c <= peak * (1 - r_dn):
                cur, trough = "DN", c
        else:
            trough = min(trough, c)
            if c >= trough * (1 + r_up):
                cur, peak = "UP", c
        if i >= start:
            out[i] = cur
    return out


def ref_rule_c_sticky(wc, n_weeks=100, r_dn=0.30, r_up=0.50):
    m = ref_sma(wc, n_weeks)
    dd = ref_rule_dd(wc, r_dn, r_up, start=0)
    out, prev = [None] * len(wc), None
    for i, x in enumerate(dd):
        if m[i] is None:
            continue
        if x == "DN":
            s = "DN"
        elif prev in ("DN", "MID") or prev is None:
            s = "UP" if wc[i] > m[i] else "MID"
        else:
            s = "UP"
        out[i], prev = s, s
    return out, m


LONG_MAP = {"UP": "up", "DN": "down", "MID": "recovering", None: None}


def week_path():
    """上げ (100 週・高値 598) → 3 割超の下げ (底 298) → 底から 5 割戻したが 100 週線の下 → 100 週線の上へ。"""
    wc = [400 + 2 * i for i in range(100)]
    wc += [598 - 20 * i for i in range(1, 16)]
    wc += [298 + 16 * i for i in range(1, 11)]
    wc += [458 + 8 * i for i in range(1, 40)]
    return wc


def daily_from_weekly(wc, start=date(2017, 8, 14)):  # 月曜始まり・7 日目 (日曜) に週の終値
    days, closes = [], []
    prev = wc[0]
    d = start
    for w in wc:
        for k in range(7):
            days.append((d + timedelta(days=k)).isoformat())
            closes.append(prev + (w - prev) * (k + 1) / 7)  # 日曜 (k=6) で w に着く
        prev = w
        d += timedelta(days=7)
    return days, closes


def test_weekly_takes_sundays_only():
    days = day_list(15, start=date(2017, 8, 14))  # 月曜始まり
    closes = list(range(1, 16))
    wd, wc = regime.weekly(days, closes)
    assert wd == ["2017-08-20", "2017-08-27"]
    assert wc == [7, 14]
    assert (wd, wc) == ref_weekly(days, closes)


def test_long_states_match_reference():
    wc = week_path()
    st, m = regime.long_states(wc)
    ref, rm = ref_rule_c_sticky(wc)
    assert st == [LONG_MAP[x] for x in ref]
    assert m == rm


def test_long_down_after_30pct():
    wc = week_path()
    st, _ = regime.long_states(wc)
    assert st[99] == "up"
    # 高値 598 の 7 掛け = 418.6 以下になった週 (198 へ向かう途中) から下げ相場
    first_down = next(i for i, s in enumerate(st) if s == "down")
    assert wc[first_down] <= 598 * 0.7 < wc[first_down - 1]


def test_long_recovering_needs_100w():
    wc = week_path()
    st, m = regime.long_states(wc)
    i = next(i for i in range(len(st)) if st[i] == "recovering")
    assert wc[i] >= 298 * 1.5 and wc[i] <= m[i]  # 底から 5 割戻したが 100 週線の下
    j = next(j for j in range(i, len(st)) if st[j] == "up")
    assert wc[j] > m[j]


def test_long_up_is_sticky_below_100w():
    # 上げ相場のまま 100 週線を割っても、高値から 3 割下げるまで up のまま (§9.2 の直し)
    wc = [400 + 2 * i for i in range(100)]  # 高値 598・100 週線は約 499
    wc += [598 - 6 * i for i in range(1, 12)]
    wc += [532 - 4 * i for i in range(1, 12)]  # 488 = 100 週線の下・高値の 0.82 倍 (3 割下げには届かない)
    st, m = regime.long_states(wc)
    ref, _ = ref_rule_c_sticky(wc)
    assert st == [LONG_MAP[x] for x in ref]
    below = [i for i in range(len(wc)) if m[i] and wc[i] < m[i] and st[i] == "up"]
    assert below, "100 週線の下でも up のままの週がある"
    assert "recovering" not in st


def test_long_none_before_100_weeks():
    days, closes = daily_from_weekly([100 + i for i in range(99)])
    assert regime.long_detail(days, closes) is None
    days, closes = daily_from_weekly([100 + i for i in range(100)])
    assert regime.long_detail(days, closes) is not None


def test_long_detail_matches_state_detail_fields():
    wc = week_path()[:150]
    days, closes = daily_from_weekly(wc)
    d = regime.long_detail(days, closes)
    wd, wcs = regime.weekly(days, closes)
    ref, m = ref_rule_c_sticky(wcs)
    assert d["state"] == LONG_MAP[ref[-1]]
    assert d["last_week"] == wd[-1]
    assert d["w100"] == m[-1]
    assert d["last_close"] == wcs[-1]
    ath_i = max(range(len(closes)), key=lambda i: closes[i])
    assert d["ath"]["date"] == days[ath_i] and d["ath"]["close"] == closes[ath_i]
    assert d["ath"]["pct_from_ath"] == pytest.approx(100 * (closes[-1] / closes[ath_i] - 1))
    # 状態の始まりは、その状態が続く最初の週の日曜
    s = len(ref) - 1
    while ref[s - 1] == ref[-1]:
        s -= 1
    assert d["since_week"] == wd[s]


def test_long_detail_lines():
    wc = week_path()
    days, closes = daily_from_weekly(wc[:115])  # 底 298 の直後 = 下げ相場
    d = regime.long_detail(days, closes)
    assert d["state"] == "down"
    assert d["trough"]["close"] == 298 and d["line_to_leave_down"] == pytest.approx(447)
    assert d["line_to_down"] is None and d["peak"] is None
    days, closes = daily_from_weekly(wc[:125])  # 底から 5 割戻した直後 (100 週線の下)
    d = regime.long_detail(days, closes)
    assert d["state"] == "recovering"
    assert d["trough"]["close"] == 298  # 戻りの途中は「下げ相場の底」を見せる
    assert d["line_to_down"] == pytest.approx(0.7 * d["peak"]["close"])
    assert d["line_to_leave_down"] is None
    days, closes = daily_from_weekly(wc[:100])
    d = regime.long_detail(days, closes)
    assert d["state"] == "up" and d["peak"]["close"] == 598
    assert d["line_to_down"] == pytest.approx(598 * 0.7)


def test_to_daily_starts_day_after_sunday():
    days = day_list(10, start=date(2017, 8, 19))  # 土・日・月...
    out = regime.to_daily(days, ["2017-08-20"], ["up"])
    assert out[:2] == [None, None]  # 土・日(確定日当日)は まだ
    assert out[2] == "up"


# ================= Task 5: 暴落・急騰の後の過去の回数 =================
def ref_episodes(days, closes, lab, long_d, kind, today_index):
    """shock_after.episodes の写し (今日までに 30 日後が来た回だけ・長期の状態つき)。"""
    out = []
    for t in range(today_index + 1):
        if lab[t] != kind or (t > 0 and lab[t - 1] == kind):
            continue
        if t + 30 > today_index:
            continue
        fut = closes[t + 1:t + 31]
        past7 = closes[max(0, t - 6):t + 1]
        e = {"long": long_d[t], "higher_30d": closes[t + 30] > closes[t]}
        e["new_extreme_30d"] = (min(fut) < min(past7)) if kind == "crash" else (max(fut) > max(past7))
        out.append(e)
    return out


def shock_series():
    """100 日目 (その後も下げ続ける)・300 日目 (その後は戻す)・380 日目 (今日の暴落) に急落。"""
    c = noisy(400, 0.0, amp=0.004)
    f = 1.0
    for t in range(400):
        if t == 100 or t == 300 or t == 380:
            f *= 0.25
        if 100 < t <= 130:
            f *= 0.99  # 1 回目の後はさらに下がる = 30 日以内に新安値
        if 300 < t <= 330:
            f *= 1.012  # 2 回目の後は戻す
        c[t] *= f
    return c


def test_shock_history_counts_only_finished_30_days():
    c = shock_series()
    days = day_list(400)
    lab = regime.classify_mid(c)["label"]
    assert lab[100] == "crash" and lab[300] == "crash" and lab[380] == "crash"
    long_d = ["up"] * 400
    today = 384
    got = regime.shock_history(days, c, lab, long_d, "crash", "up", today)
    ref = ref_episodes(days, c, lab, long_d, "crash", today)
    assert got["n"] == len(ref) == 2  # 380 日目の回 (起点 + 30 日 > 今日) は数えない
    assert got["new_extreme_30d"] == sum(e["new_extreme_30d"] for e in ref) == 1
    assert got["higher_30d"] == sum(e["higher_30d"] for e in ref) == 1
    assert got["kind"] == "crash" and got["long_state"] == "up"


def test_shock_history_filters_by_long_state():
    c = shock_series()
    days = day_list(400)
    lab = regime.classify_mid(c)["label"]
    long_d = ["up"] * 200 + ["down"] * 200  # 1 回目 = up・2 回目 = down
    up = regime.shock_history(days, c, lab, long_d, "crash", "up", 384)
    down = regime.shock_history(days, c, lab, long_d, "crash", "down", 384)
    none = regime.shock_history(days, c, lab, long_d, "crash", "recovering", 384)
    assert (up["n"], up["new_extreme_30d"], up["higher_30d"]) == (1, 1, 0)
    assert (down["n"], down["new_extreme_30d"], down["higher_30d"]) == (1, 0, 1)
    assert none["n"] == 0 and none["new_extreme_30d"] == 0 and none["higher_30d"] == 0


def test_shock_history_start_day_is_first_day_of_run():
    c = shock_series()
    days = day_list(400)
    lab = regime.classify_mid(c)["label"]
    long_d = ["up"] * 400
    for today in (380, 382, 385):  # 暴落の 1・3・6 日目
        got = regime.shock_history(days, c, lab, long_d, "crash", "up", today)
        assert got["start_day"] == days[380]


def test_shock_history_surge_side():
    c = noisy(400, 0.0, amp=0.004)
    f = 1.0
    for t in range(400):
        if t == 100:
            f *= 4.0
        if 100 < t <= 130:
            f *= 1.01  # さらに上がる = 30 日以内に新高値
        c[t] *= f
    days = day_list(400)
    lab = regime.classify_mid(c)["label"]
    assert lab[100] == "surge"
    long_d = ["up"] * 400
    got = regime.shock_history(days, c, lab, long_d, "surge", "up", 399)
    ref = ref_episodes(days, c, lab, long_d, "surge", 399)
    assert got["n"] == len(ref) >= 1
    assert got["new_extreme_30d"] == sum(e["new_extreme_30d"] for e in ref) >= 1
    assert got["higher_30d"] == sum(e["higher_30d"] for e in ref)


# ---- regime_json (Task 6) ----
def _split_today(days, c):
    return days[:-1], c[:-1], days, c


def test_regime_json_keys_and_types():
    c = noisy(900, 0.0004, amp=0.01)
    days = day_list(900)
    out = regime.regime_json(*_split_today(days, c))
    assert out["as_of"] == days[-1]
    assert set(out) >= {"as_of", "long", "mid", "near"}
    assert out["mid"]["state"] in ("up", "down", "range", "calm", "crash", "surge")
    assert out["mid"]["days"] >= 1
    assert out["mid"]["since"] <= days[-1]
    assert out["near"]["state"] in ("up", "flat", "down")
    assert out["long"] is not None
    assert out["long"]["state"] in ("up", "down", "recovering")


def test_regime_json_days_count_from_since_inclusive():
    c = noisy(900, 0.0004, amp=0.01)
    days = day_list(900)
    out = regime.regime_json(*_split_today(days, c))
    for key in ("mid", "near"):
        d0 = date.fromisoformat(out[key]["since"])
        assert out[key]["days"] == (date.fromisoformat(days[-1]) - d0).days + 1


def test_regime_json_near_fields_and_rounding():
    c = noisy(400, 0.001, amp=0.01)
    days = day_list(400)
    out = regime.regime_json(*_split_today(days, c))
    near = out["near"]
    assert near["close"] == c[-1]
    assert near["close_30d_ago"] == c[-31]
    assert near["ret_30d_pct"] == round((c[-1] / c[-31] - 1) * 100, 1)


def test_regime_json_long_none_on_short_series():
    c = noisy(300, 0.001, amp=0.01)  # 週足 100 本に満たない
    days = day_list(300)
    out = regime.regime_json(*_split_today(days, c))
    assert out["long"] is None
    assert out["mid"] is not None
    assert "shock" not in out or out["shock"] is None


def test_regime_json_short_series_has_no_states():
    c = noisy(20, 0.001)
    days = day_list(20)
    out = regime.regime_json(*_split_today(days, c))
    assert out["mid"] is None and out["near"] is None and out["long"] is None


def test_regime_json_long_uses_closed_bars_but_ath_pct_uses_today():
    c = noisy(900, 0.0004, amp=0.01)
    days = day_list(900)
    c[-1] = c[-2] * 0.9  # 今日の仮の価格だけ大きく下げる
    closed_only = regime.long_detail(days[:-1], c[:-1])
    out = regime.regime_json(*_split_today(days, c))
    lg = out["long"]
    assert lg["state"] == closed_only["state"]
    assert lg["since_week"] == closed_only["since_week"]
    assert lg["last_week"] == closed_only["last_week"]
    assert lg["ath"]["close"] == closed_only["ath"]["close"]
    assert lg["ath"]["pct_from_ath"] == pytest.approx(100 * (c[-1] / lg["ath"]["close"] - 1))
    assert lg["ath"]["pct_from_ath"] != pytest.approx(closed_only["ath"]["pct_from_ath"])


def _long_crash_series():
    """1000 日・500 日目と 980 日目 (今日の 3 日前) に急落。"""
    c = noisy(1000, 0.0005, amp=0.004)
    f = 1.0
    for t in range(1000):
        if t in (500, 980):
            f *= 0.25
        c[t] *= f
    return c


def test_regime_json_shock_only_on_crash_or_surge_day():
    c = _long_crash_series()[:983]  # 今日 = 急落の 4 日目
    days = day_list(983)
    out = regime.regime_json(*_split_today(days, c))
    assert out["long"] is not None
    assert out["mid"]["state"] == "crash"
    assert out["shock"]["kind"] == "crash"
    assert out["shock"]["start_day"] == days[980]
    assert out["shock"]["long_state"] in ("up", "down", "recovering")
    quiet = noisy(900, 0.0004, amp=0.01)
    q = regime.regime_json(*_split_today(day_list(900), quiet))
    assert q["mid"]["state"] not in ("crash", "surge")
    assert "shock" not in q


def test_regime_json_no_shock_when_long_state_unavailable():
    c = shock_series()[:383]  # 週足が 100 本ない
    out = regime.regime_json(*_split_today(day_list(383), c))
    assert out["mid"]["state"] == "crash"
    assert out["long"] is None
    assert "shock" not in out


def test_regime_json_is_json_serialisable():
    import json
    c = noisy(900, 0.0004, amp=0.01)
    json.dumps(regime.regime_json(*_split_today(day_list(900), c)))
