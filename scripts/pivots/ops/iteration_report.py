"""it-2026-10 のオフライン評価 (学習・holdout)。本番には何も出さない。

    python -m ops.iteration_report --out-dir <dir> [--train-end 2025-10-16]
        [--bulk-cache <dir>] [--compare-baseline]

書くのは `<dir>` の中の 3 つだけ:
  * it-2026-10.json            問いごとの学習・holdout の指標、較正表、ふだんの確率、
                               RANGE_WINDOW_DAYS の選択結果、修正前の規則との比較
  * it-2026-10.md              上の日本語の表
  * calibration_it_2026_10.json  段 2 でそのまま配信する較正表 (学習期間だけで作ったもの)

データの揃え方:
  * 価格 (Binance 現物日足) は 2017-08-17 から取る。指標の系列もそこから計算するので、
    2021-12 時点でも指標のウォームアップは済んでいる (t までのデータしか使わない)。
  * 判定 (答え合わせ) は価格だけで決まるので全日で数え、「長期のふだん」として参考に出す。
  * スコアは OI・funding が要るので、bulk 履歴がその日の OI 増加率と funding を
    返せる日だけ計算する。それ以外の日・指標のウォームアップ中の日 (`_historical_scores`
    が (0,0,0) を返す日) は「スコアなし」(None) で、0 点として数えない (Review Focus 4)。
  * 較正表とその「ふだん」は、学習期間のスコアありの日で作る (Ruling R8)。
  * 学習期間の日のうち、答え合わせの窓が学習の終わりをまたぐ日は外す (Ruling R9):
    天井・底は t + 2H、大きく動くは t + H が学習の最終日を超える日。
  * holdout は train_end の翌日から。窓 (天井・底は + 確認の猶予 H 日) がデータ末尾までに
    閉じた日だけを数え、pending の日は数えない (Review Focus 1)。90D は合否を付けない。
"""
from __future__ import annotations

import argparse
import json
import sys
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator, Optional, Sequence

from producer import horizon_inputs
from producer.backtest import HIT_DEFINITIONS
from producer import daily_series
from producer.bulk_history import BulkHistory
from producer.calibration import (
    BIN_EDGES,
    SHRINK_K,
    _bin_index,
    brier,
    brier_skill,
    fit,
    lift,
    predict,
    to_json,
)
from producer.horizon_inputs import IT_2026_10_RULES, LEGACY_RULES, RuleSet
from producer.outcomes import Outcome
from producer.types import ASSETS, HORIZONS, Horizon

ITERATION = "it-2026-10"
TRAIN_END_DEFAULT = "2025-10-16"
PRICE_HISTORY_START_DAY = "2017-08-17"
DERIV_HISTORY_START_DAY = "2021-12-01"

EVENTS = ("turn", "move")
EVENT_SCORE_TYPE = {"turn": "price_pivot", "move": "volatility_pivot"}

# 事前登録 (sition-core status doc §3・Task 0)。変えない。
PRIMARY_MIN_SKILL = 0.0       # holdout の Brier skill > 0
SECONDARY_MIN_LIFT = 0.10     # 兆しありの日 − それ以外の日 ≥ +10 ポイント
SIGNAL_GAP = 0.10             # 兆し = 今日 − ふだん ≥ +10 ポイント
_EPS = 1e-9
GRADED_HORIZONS: tuple[Horizon, ...] = ("7D", "30D")

# RANGE_WINDOW_DAYS の候補 (計画書 Task 4) と、計画の初期値。学習期間の Brier だけで選ぶ。
RANGE_WINDOW_CANDIDATES: dict[Horizon, tuple[int, ...]] = {
    "7D": (10, 14, 20),
    "30D": (30, 45, 60),
    "90D": (60, 90, 120),
}
PLAN_INITIAL_RANGE_WINDOW_DAYS: dict[Horizon, int] = {"7D": 14, "30D": 30, "90D": 90}


# --------------------------------------------------------------------------
# 1 つの (資産, 出来事, 期間) の評価 (純関数)
# --------------------------------------------------------------------------


def _reach(event: str, horizon: Horizon) -> int:
    h = HIT_DEFINITIONS[horizon].horizon_days
    return 2 * h if event == "turn" else h


def _train_end_index(dates: Sequence[str], train_end: str) -> int:
    idx = -1
    for i, d in enumerate(dates):
        if d <= train_end:
            idx = i
        else:
            break
    return idx


def _rate(outcomes: Sequence[Outcome]) -> Optional[float]:
    return sum(o == "hit" for o in outcomes) / len(outcomes) if outcomes else None


def _bin_rows(table, scores: Sequence[int], outcomes: Sequence[Outcome]) -> list[dict]:
    nb = len(BIN_EDGES) - 1
    ns = [0] * nb
    hits = [0] * nb
    for s, o in zip(scores, outcomes):
        i = _bin_index(s)
        ns[i] += 1
        hits[i] += o == "hit"
    return [
        {
            "lo": table.bins[i][0],
            "hi": table.bins[i][1],
            "prob": table.bins[i][2],
            "n": ns[i],
            "n_hit": hits[i],
            "observed": hits[i] / ns[i] if ns[i] else None,
        }
        for i in range(nb)
    ]


def evaluate(
    closes: Sequence[float],
    scores_by_t: Sequence[Optional[int]],
    outcomes_by_t: Sequence[Outcome],
    dates: Sequence[str],
    train_end: str,
    *,
    event: str,
    horizon: Horizon,
) -> dict:
    """1 つの (資産, 出来事, 期間) の学習・holdout 評価。

    scores_by_t[t] が None の日 (ウォームアップ中・派生データなし) は確率を出さず数えない。
    pending の日はどこにも数えない。較正表は学習期間 (purge 後) のスコアありの日だけで作る。
    """
    n = len(dates)
    if not (len(closes) == len(scores_by_t) == len(outcomes_by_t) == n):
        raise ValueError(
            f"長さが一致しない: closes {len(closes)} / scores {len(scores_by_t)} / "
            f"outcomes {len(outcomes_by_t)} / dates {n}"
        )
    if event not in EVENTS:
        raise ValueError(f"unknown event: {event}")
    judged = horizon in GRADED_HORIZONS
    end_idx = _train_end_index(dates, train_end)
    reach = _reach(event, horizon)

    train_days = [t for t in range(n) if t + reach <= end_idx]
    long_days = [t for t in train_days if outcomes_by_t[t] != "pending"]
    scored_train = [t for t in long_days if scores_by_t[t] is not None]
    # 窓 (+ 天井・底は確認の猶予 H 日) がデータ末尾までに閉じた日だけ。hit は早めに
    # 確定しうるが miss は確定しないので、閉じていない日を数えると発生率が偏る (Review Focus 1)。
    holdout_days = [
        t
        for t in range(end_idx + 1, n)
        if t + reach <= n - 1
        and scores_by_t[t] is not None
        and outcomes_by_t[t] != "pending"
    ]

    long_run = {
        "start": dates[long_days[0]] if long_days else None,
        "end": dates[long_days[-1]] if long_days else None,
        "n": len(long_days),
        "usual": _rate([outcomes_by_t[t] for t in long_days]),
    }

    out: dict = {
        "event": event,
        "horizon": horizon,
        "judged": judged,
        "long_run": long_run,
    }

    tr_scores = [int(scores_by_t[t]) for t in scored_train]  # type: ignore[arg-type]
    tr_outcomes = [outcomes_by_t[t] for t in scored_train]
    train = {
        "start": dates[scored_train[0]] if scored_train else None,
        "end": dates[scored_train[-1]] if scored_train else None,
        "n": len(scored_train),
        "n_hit": sum(o == "hit" for o in tr_outcomes),
        "usual": None,
        "brier": None,
        "brier_skill": None,
    }
    ho_scores = [int(scores_by_t[t]) for t in holdout_days]  # type: ignore[arg-type]
    ho_outcomes = [outcomes_by_t[t] for t in holdout_days]
    holdout: dict = {
        "start": dates[holdout_days[0]] if holdout_days else None,
        "end": dates[holdout_days[-1]] if holdout_days else None,
        "n": len(holdout_days),
        "n_hit": sum(o == "hit" for o in ho_outcomes),
        "rate": _rate(ho_outcomes),
        "brier": None,
        "brier_usual": None,
        "brier_skill": None,
        "lift": None,
        "n_signal": 0,
        "signal_rate": None,
        "other_rate": None,
        "bins": [],
    }

    if not scored_train:
        out.update(calibration=None, train=train, holdout=holdout)
        out["verdict"] = _verdict(judged, holdout)
        return out

    table = fit(tr_scores, tr_outcomes)
    usual = table.usual
    tr_probs = [predict(table, s) for s in tr_scores]
    train["usual"] = usual
    train["brier"] = brier(tr_probs, tr_outcomes)
    train["brier_skill"] = brier_skill(tr_probs, tr_outcomes, usual)

    if holdout_days:
        probs = [predict(table, s) for s in ho_scores]
        holdout["brier"] = brier(probs, ho_outcomes)
        holdout["brier_usual"] = brier([usual] * len(probs), ho_outcomes)
        holdout["brier_skill"] = brier_skill(probs, ho_outcomes, usual)
        holdout["lift"] = lift(probs, ho_outcomes, usual, gap=SIGNAL_GAP)
        sig = [o for p, o in zip(probs, ho_outcomes) if p - usual >= SIGNAL_GAP - _EPS]
        rest = [o for p, o in zip(probs, ho_outcomes) if p - usual < SIGNAL_GAP - _EPS]
        holdout["n_signal"] = len(sig)
        holdout["signal_rate"] = _rate(sig)
        holdout["other_rate"] = _rate(rest)
        holdout["bins"] = _bin_rows(table, ho_scores, ho_outcomes)

    out.update(calibration=to_json(table), train=train, holdout=holdout)
    out["verdict"] = _verdict(judged, holdout)
    return out


def _verdict(judged: bool, holdout: dict) -> dict:
    if not judged:
        return {"primary_pass": None, "secondary_pass": None}
    skill = holdout["brier_skill"]
    lf = holdout["lift"]
    return {
        "primary_pass": None if skill is None else bool(skill > PRIMARY_MIN_SKILL),
        "secondary_pass": None if lf is None else bool(lf >= SECONDARY_MIN_LIFT - _EPS),
    }


# --------------------------------------------------------------------------
# 資産ごとの系列 (スコア・判定)
# --------------------------------------------------------------------------


# 揃え方・スコア・判定は live の「毎日の確率の履歴」と共有する (Ruling R11)。
AssetInput = daily_series.AssetInput
_Prepared = daily_series.Prepared


def _prepare(inp: AssetInput) -> _Prepared:
    return daily_series.prepare(inp)


def _scores(
    p: _Prepared, horizon: Horizon, rules: RuleSet
) -> tuple[list[Optional[int]], list[Optional[int]]]:
    """(price_pivot, volatility_pivot)。スコアなしの日は None。"""
    return daily_series.scores(p, horizon, rules)


def _outcomes(p: _Prepared, event: str, horizon: Horizon) -> list[Outcome]:
    return daily_series.outcomes(p, event, horizon)


@contextmanager
def _range_window(horizon: Horizon, window: int) -> Iterator[None]:
    """候補を試す間だけ RANGE_WINDOW_DAYS[horizon] を差し替える (終わったら戻す)。"""
    old = horizon_inputs.RANGE_WINDOW_DAYS[horizon]
    horizon_inputs.RANGE_WINDOW_DAYS[horizon] = window
    try:
        yield
    finally:
        horizon_inputs.RANGE_WINDOW_DAYS[horizon] = old


def _pooled_train_brier(results: Sequence[dict]) -> Optional[float]:
    num = 0.0
    den = 0
    for r in results:
        if r["train"]["brier"] is not None:
            num += r["train"]["brier"] * r["train"]["n"]
            den += r["train"]["n"]
    return num / den if den else None


def _select_range_windows(
    prepared: dict[str, _Prepared],
    outcomes: dict[tuple[str, str, Horizon], list[Outcome]],
    train_end: str,
    current_pp: dict[tuple[str, Horizon], list[Optional[int]]],
) -> dict:
    """天井・底 (price_pivot) の学習期間 Brier (BTC+ETH をまとめた n 加重) で選ぶ。holdout は見ない。"""
    train_brier: dict[str, dict[str, Optional[float]]] = {}
    selected: dict[str, int] = {}
    current = dict(horizon_inputs.RANGE_WINDOW_DAYS)
    for h in HORIZONS:
        train_brier[h] = {}
        for w in RANGE_WINDOW_CANDIDATES[h]:
            results = []
            for a, p in prepared.items():
                if w == current[h]:
                    pp = current_pp[(a, h)]
                else:
                    with _range_window(h, w):
                        pp, _ = _scores(p, h, IT_2026_10_RULES)
                results.append(
                    evaluate(p.inp.closes, pp, outcomes[(a, "turn", h)], p.inp.dates,
                             train_end, event="turn", horizon=h)
                )
            train_brier[h][str(w)] = _pooled_train_brier(results)
        valid = {int(w): b for w, b in train_brier[h].items() if b is not None}
        if not valid:
            selected[h] = current[h]
            continue
        best = min(valid.values())
        ties = [w for w, b in valid.items() if b <= best + 1e-12]
        selected[h] = current[h] if current[h] in ties else min(ties)
    return {
        "candidates": {h: list(v) for h, v in RANGE_WINDOW_CANDIDATES.items()},
        "initial": dict(PLAN_INITIAL_RANGE_WINDOW_DAYS),
        "current": current,
        "selected": selected,
        "train_brier": train_brier,
        "matches_current": selected == current,
    }


def _compare_row(new: dict, legacy: dict) -> dict:
    def pick(r: dict) -> dict:
        return {
            "train_brier": r["train"]["brier"],
            "train_usual": r["train"]["usual"],
            "holdout_brier_skill": r["holdout"]["brier_skill"],
            "holdout_lift": r["holdout"]["lift"],
            "n_train": r["train"]["n"],
            "n_holdout": r["holdout"]["n"],
            "verdict": r["verdict"],
        }

    return {"new": pick(new), "legacy": pick(legacy)}


def _both_scored(a: Sequence[Optional[int]], b: Sequence[Optional[int]]):
    """両方の規則でスコアがある日だけに揃える (比較を同じ日で行う)。"""
    return (
        [x if (x is not None and y is not None) else None for x, y in zip(a, b)],
        [y if (x is not None and y is not None) else None for x, y in zip(a, b)],
    )


def build_report(
    inputs: dict[str, AssetInput],
    *,
    train_end: str = TRAIN_END_DEFAULT,
    compare_baseline: bool = False,
) -> dict:
    prepared = {a: _prepare(inp) for a, inp in inputs.items()}
    outcomes: dict[tuple[str, str, Horizon], list[Outcome]] = {}
    for a, p in prepared.items():
        for ev in EVENTS:
            for h in HORIZONS:
                outcomes[(a, ev, h)] = _outcomes(p, ev, h)

    new_scores: dict[tuple[str, Horizon], tuple[list, list]] = {}
    for a, p in prepared.items():
        for h in HORIZONS:
            new_scores[(a, h)] = _scores(p, h, IT_2026_10_RULES)

    selection = _select_range_windows(
        prepared, outcomes, train_end, {k: v[0] for k, v in new_scores.items()}
    )

    questions: list[dict] = []
    tables: dict[str, dict[str, dict[str, Optional[dict]]]] = {}
    comparison: list[dict] = []
    for a, p in prepared.items():
        tables[a] = {ev: {} for ev in EVENTS}
        legacy = {h: _scores(p, h, LEGACY_RULES) for h in HORIZONS} if compare_baseline else {}
        for ev in EVENTS:
            for h in HORIZONS:
                k = 0 if ev == "turn" else 1
                sc = new_scores[(a, h)][k]
                res = evaluate(p.inp.closes, sc, outcomes[(a, ev, h)], p.inp.dates,
                               train_end, event=ev, horizon=h)
                res = {"asset": a, "score_type": EVENT_SCORE_TYPE[ev], **res}
                questions.append(res)
                tables[a][ev][h] = (
                    None if res["calibration"] is None
                    else {**res["calibration"], "n": res["train"]["n"]}
                )
                if compare_baseline:
                    new_sc, old_sc = _both_scored(sc, legacy[h][k])
                    r_new = evaluate(p.inp.closes, new_sc, outcomes[(a, ev, h)], p.inp.dates,
                                     train_end, event=ev, horizon=h)
                    r_old = evaluate(p.inp.closes, old_sc, outcomes[(a, ev, h)], p.inp.dates,
                                     train_end, event=ev, horizon=h)
                    comparison.append({"asset": a, "event": ev, "horizon": h,
                                       **_compare_row(r_new, r_old)})

    data = {}
    for a, p in prepared.items():
        d = p.inp.dates
        scored = [i for i in range(len(d)) if p.has_deriv[i]]
        gaps = sum(
            1 for i in range(1, len(d))
            if (datetime.strptime(d[i], "%Y-%m-%d") - datetime.strptime(d[i - 1], "%Y-%m-%d")).days != 1
        )
        data[a] = {
            "klines_first": d[0],
            "klines_last": d[-1],
            "n_days": len(d),
            "calendar_gaps": gaps,
            "deriv_first": p.inp.history.first_day(),
            "deriv_last": p.inp.history.last_day(),
            "deriv_scorable_first": d[scored[0]] if scored else None,
        }

    train_starts = [q["train"]["start"] for q in questions if q["train"]["start"]]
    calibration_file = {
        "iteration": ITERATION,
        "train_start": min(train_starts) if train_starts else None,
        "train_end": train_end,
        "bin_edges": list(BIN_EDGES),
        "shrink_k": SHRINK_K,
        "event_score_type": dict(EVENT_SCORE_TYPE),
        "range_window_days": dict(horizon_inputs.RANGE_WINDOW_DAYS),
        "ma_distance_windows": {h: list(v) for h, v in horizon_inputs.MA_DISTANCE_WINDOWS.items()},
        "tables": tables,
    }
    report = {
        "iteration": ITERATION,
        "train_end": train_end,
        "price_history_start": min(d["klines_first"] for d in data.values()) if data else None,
        "pass_lines": {
            "primary": f"holdout Brier skill > {PRIMARY_MIN_SKILL}",
            "secondary": f"lift >= +{SECONDARY_MIN_LIFT:.2f}",
            "signal_gap": SIGNAL_GAP,
            "graded": [f"{ev} {h}" for ev in EVENTS for h in GRADED_HORIZONS],
        },
        "data": data,
        "range_window_selection": selection,
        "questions": questions,
        "calibration_file": calibration_file,
    }
    if compare_baseline:
        report["baseline_comparison"] = comparison
    return report


# --------------------------------------------------------------------------
# Markdown (日本語)
# --------------------------------------------------------------------------

_QUESTION_JA = {
    ("turn", "7D"): "7 日以内に小さな山か谷",
    ("turn", "30D"): "30 日以内に中以上の天井か底",
    ("turn", "90D"): "90 日以内に大以上の天井か底",
    ("move", "7D"): "7 日以内に大きく動く",
    ("move", "30D"): "30 日以内に大きく動く",
    ("move", "90D"): "90 日以内に大きく動く",
}


def _pct(x: Optional[float]) -> str:
    return "—" if x is None else f"{x * 100:.1f}%"


def _skill(x: Optional[float]) -> str:
    return "—" if x is None else f"{x:+.3f}"


def _pt(x: Optional[float]) -> str:
    return "—" if x is None else f"{x * 100:+.1f} ポイント"


def _verdict_ja(q: dict) -> str:
    if not q["judged"]:
        return "判定材料不足 (90D は合否を付けない)"
    v = q["verdict"]

    def one(name: str, flag: Optional[bool]) -> str:
        return f"{name} 判定不能" if flag is None else f"{name} {'合格' if flag else '不合格'}"

    return f"{one('主指標', v['primary_pass'])}・{one('副指標', v['secondary_pass'])}"


def render_markdown(report: dict) -> str:
    L: list[str] = []
    L.append(f"# {report['iteration']} オフライン評価 (学習・holdout)")
    L.append("")
    L.append(f"- 学習期間の終わり: {report['train_end']} / holdout はその翌日から、答えが確定した日まで")
    L.append("- 主指標: holdout の Brier skill (ふだんの確率だけを毎日言い続けた場合と比べる) > 0")
    L.append("- 副指標 (lift): 兆しあり (今日 − ふだん ≥ +10 ポイント) の日の発生率 − それ以外の日の発生率 ≥ +10 ポイント")
    L.append("- 合否を付ける問い: 天井・底 7D・30D、大きく動く 7D・30D。90D は数字だけ出し「判定材料不足」とする")
    L.append("- ふだんの確率 = 学習期間のスコアありの日 (OI・funding が揃う日) の発生率。長期のふだん = 2017 年からの価格だけで数えた発生率 (参考)")
    L.append("")
    for a, d in report["data"].items():
        L.append(
            f"- {a}: 日足 {d['klines_first']}〜{d['klines_last']} ({d['n_days']} 日・日付の抜け {d['calendar_gaps']} か所) / "
            f"派生データ {d['deriv_first']}〜{d['deriv_last']} / スコアを出せる最初の日 {d['deriv_scorable_first']}"
        )
    L.append("")

    qs = report["questions"]
    graded = [q for q in qs if q["judged"]]
    def _tally(key: str) -> tuple[int, int, int]:
        flags = [q["verdict"][key] for q in graded]
        return (sum(1 for f in flags if f is True), sum(1 for f in flags if f is False),
                sum(1 for f in flags if f is None))

    p_ok, p_ng, p_na = _tally("primary_pass")
    s_ok, s_ng, s_na = _tally("secondary_pass")
    L.append("## まとめ")
    L.append("")
    L.append(f"- 合否を付ける {len(graded)} 問のうち、主指標は 合格 {p_ok} 問・不合格 {p_ng} 問・判定不能 {p_na} 問、"
             f"副指標は 合格 {s_ok} 問・不合格 {s_ng} 問・判定不能 {s_na} 問")
    weak = [f"{q['asset']} {_QUESTION_JA[(q['event'], q['horizon'])]}" for q in graded
            if q["verdict"]["primary_pass"] is False]
    if weak:
        L.append(f"- 主指標を満たさなかった問い: {' / '.join(weak)}")
    L.append("")

    for a in report["data"]:
        L.append(f"## {a}")
        L.append("")
        L.append("| 問い | ふだんの確率 (学習・スコアあり) | 長期のふだん (2017〜) | holdout の Brier skill | 副指標 (lift) | 合否 | n (学習 / holdout) |")
        L.append("|---|---|---|---|---|---|---|")
        for q in qs:
            if q["asset"] != a:
                continue
            L.append(
                f"| {_QUESTION_JA[(q['event'], q['horizon'])]} | {_pct(q['train']['usual'])} | "
                f"{_pct(q['long_run']['usual'])} | {_skill(q['holdout']['brier_skill'])} | "
                f"{_pt(q['holdout']['lift'])} | {_verdict_ja(q)} | {q['train']['n']} / {q['holdout']['n']} |"
            )
        L.append("")
        L.append("副指標の「—」= holdout に兆しありの日 (今日 − ふだん ≥ +10 ポイント) が 1 日も無い (またはそれ以外の日が無い) ため、差を計算できない。")
        L.append("")
        L.append("holdout の兆しありの日:")
        L.append("")
        L.append("| 問い | 兆しありの日数 | 兆しありの日の発生率 | それ以外の日の発生率 | holdout 全体の発生率 | holdout の期間 |")
        L.append("|---|---|---|---|---|---|")
        for q in qs:
            if q["asset"] != a:
                continue
            h = q["holdout"]
            L.append(
                f"| {_QUESTION_JA[(q['event'], q['horizon'])]} | {h['n_signal']} | {_pct(h['signal_rate'])} | "
                f"{_pct(h['other_rate'])} | {_pct(h['rate'])} | {h['start'] or '—'}〜{h['end'] or '—'} |"
            )
        L.append("")

    L.append("## holdout の区間ごとの当たり具合 (表の確率と実際の発生率)")
    L.append("")
    L.append("| 資産 | 問い | スコア区間 | 表の確率 | 実際の発生率 | n |")
    L.append("|---|---|---|---|---|---|")
    for q in qs:
        for b in q["holdout"]["bins"]:
            L.append(
                f"| {q['asset']} | {_QUESTION_JA[(q['event'], q['horizon'])]} | {b['lo']}〜{b['hi']} | "
                f"{_pct(b['prob'])} | {_pct(b['observed'])} | {b['n']} |"
            )
    L.append("")

    if "baseline_comparison" in report:
        L.append("## 修正後と修正前の規則の比較 (同じ判定・同じ較正方法・両方にスコアがある日)")
        L.append("")
        L.append("| 資産 | 問い | holdout Brier skill (修正後) | (修正前) | lift (修正後) | (修正前) | 学習 Brier (修正後) | (修正前) | n (学習 / holdout) |")
        L.append("|---|---|---|---|---|---|---|---|---|")
        for c in report["baseline_comparison"]:
            nw, od = c["new"], c["legacy"]
            tb = lambda x: "—" if x is None else f"{x:.4f}"  # noqa: E731
            L.append(
                f"| {c['asset']} | {_QUESTION_JA[(c['event'], c['horizon'])]} | {_skill(nw['holdout_brier_skill'])} | "
                f"{_skill(od['holdout_brier_skill'])} | {_pt(nw['holdout_lift'])} | {_pt(od['holdout_lift'])} | "
                f"{tb(nw['train_brier'])} | {tb(od['train_brier'])} | {nw['n_train']} / {nw['n_holdout']} |"
            )
        L.append("")
        L.append("修正前 = レンジ端 30 日固定・OI の圧縮条件 5% 固定・移動平均 MA20/MA50 固定 (LEGACY_RULES)。live だけの修正 (Task 1) は backtest のスコアを変えないので比較に入れていない。")
        L.append("")

    sel = report["range_window_selection"]
    L.append("## レンジ端の判定期間 (RANGE_WINDOW_DAYS) の選択")
    L.append("")
    L.append("天井・底の問いの学習期間 Brier (BTC と ETH をまとめた値・小さいほど良い) だけで選んだ。holdout は見ていない。")
    L.append("")
    L.append("| 期間 | 候補ごとの学習 Brier | 計画の初期値 | 選んだ値 | いまの定数 | 選んだ値 − 初期値 (学習 Brier) |")
    L.append("|---|---|---|---|---|---|")
    for h in HORIZONS:
        tb = sel["train_brier"][h]
        cands = " / ".join(f"{w} 日: {'—' if b is None else f'{b:.5f}'}" for w, b in tb.items())
        b_sel, b_ini = tb.get(str(sel["selected"][h])), tb.get(str(sel["initial"][h]))
        diff = "—" if b_sel is None or b_ini is None else f"{b_sel - b_ini:+.5f}"
        L.append(f"| {h} | {cands} | {sel['initial'][h]} 日 | {sel['selected'][h]} 日 | {sel['current'][h]} 日 | {diff} |")
    L.append("")
    if not sel["matches_current"]:
        L.append("⚠️ 選んだ値といまの定数が食い違う。horizon_inputs.RANGE_WINDOW_DAYS を選んだ値に直して再実行すること。")
    else:
        changed = [h for h in HORIZONS if sel["initial"][h] != sel["current"][h]]
        if changed:
            L.append("計画の初期値から変えた期間: " + " / ".join(
                f"{h} {sel['initial'][h]} 日 → {sel['current'][h]} 日" for h in changed))
        else:
            L.append("計画の初期値のまま (変更なし)。")
    L.append("")
    return "\n".join(L)


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------


_day_ms = daily_series.day_ms


def _load_inputs(bulk_cache: Path, fetcher=None) -> dict[str, AssetInput]:
    from producer.fetch_binance import BinanceFetcher

    fetcher = fetcher or BinanceFetcher()
    now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    end_day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    out: dict[str, AssetInput] = {}
    for a in ASSETS:
        klines = [
            c for c in fetcher.fetch_klines_range(a, start_ms=_day_ms(PRICE_HISTORY_START_DAY))
            if c.close_time < now_ms  # 確定した日足だけ
        ]
        hist = BulkHistory.load(bulk_cache, f"{a}USDT", DERIV_HISTORY_START_DAY, end_day)
        if hist.first_day() is None:
            raise SystemExit(f"{a}: bulk cache に派生データが無い: {bulk_cache}")
        out[a] = daily_series.input_from_candles(klines, hist)
    return out


def main(argv: Optional[Sequence[str]] = None) -> int:
    p = argparse.ArgumentParser(description="it-2026-10 のオフライン評価 (学習・holdout)")
    p.add_argument("--out-dir", type=Path, required=True)
    p.add_argument("--train-end", default=TRAIN_END_DEFAULT)
    p.add_argument("--bulk-cache", type=Path, required=True,
                   help="派生データの bulk cache (読むだけ・既定なし: runner の checkout を誤って指さないため)")
    p.add_argument("--compare-baseline", action="store_true",
                   help="修正前の規則 (LEGACY_RULES) でのスコアの指標も並べる")
    a = p.parse_args(argv)

    inputs = _load_inputs(a.bulk_cache)
    report = build_report(inputs, train_end=a.train_end, compare_baseline=a.compare_baseline)
    report["generated_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    report["bulk_cache"] = str(a.bulk_cache)

    a.out_dir.mkdir(parents=True, exist_ok=True)
    (a.out_dir / "it-2026-10.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    (a.out_dir / "it-2026-10.md").write_text(render_markdown(report), encoding="utf-8")
    sel = report["range_window_selection"]
    if not sel["matches_current"]:
        # 段 2 でそのまま配信する較正表は、いまの定数と同じ設定で作ったものだけ。
        # 報告 (json / md) は診断のために残すが、較正表は書かない。
        sys.stdout.write(
            f"wrote {a.out_dir}/it-2026-10.json, it-2026-10.md (calibration_it_2026_10.json は書かない)\n"
            f"RANGE_WINDOW_DAYS: selected {sel['selected']} != current {sel['current']} — "
            "horizon_inputs.RANGE_WINDOW_DAYS を直して再実行すること\n")
        return 1
    (a.out_dir / "calibration_it_2026_10.json").write_text(
        json.dumps(report["calibration_file"], ensure_ascii=False, indent=2), encoding="utf-8")
    sys.stdout.write(f"wrote {a.out_dir}/it-2026-10.json, it-2026-10.md, calibration_it_2026_10.json\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
