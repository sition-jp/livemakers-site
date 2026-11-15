"""「ふだんの揺れ幅の帯」: q-2026-11 の凍結ふだんの確率と、しきい値・帯の計算。

ふだんの確率は `frozen/q_2026_11.json` (台帳 questions.Q_2026_11.base_rates の写し) を毎回読む。
"""
from __future__ import annotations

import json
import math
from pathlib import Path

from producer import indicators

Q_2026_11_PATH = Path(__file__).resolve().parent / "frozen" / "q_2026_11.json"


def _split_key(key: str) -> tuple[str, int]:
    side, h = key.split("|")
    return side, int(h)


def _load(path: Path) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def load_usual(path: Path = Q_2026_11_PATH) -> dict[tuple[str, str, int], float]:
    try:
        rates = _load(path)["rates"]
        out: dict[tuple[str, str, int], float] = {}
        for asset, d in rates.items():
            for key, v in d.items():
                side, h = _split_key(key)
                v = float(v)
                if not (0.0 <= v <= 1.0):
                    raise ValueError(f"usual rate out of range: {asset} {key}={v}")
                out[(asset, side, h)] = v
    except (KeyError, TypeError, AttributeError) as e:
        raise ValueError(f"corrupt usual-rate file: {e!r}") from e
    if not out:
        raise ValueError("corrupt usual-rate file: no rates")
    return out


def load_k(path: Path = Q_2026_11_PATH) -> dict[tuple[str, int], float]:
    try:
        return {_split_key(k): float(v) for k, v in _load(path)["k"].items()}
    except (KeyError, TypeError, AttributeError) as e:
        raise ValueError(f"corrupt usual-rate file: {e!r}") from e


# ---- 帯の計算 (式は台帳 questions.threshold と同じ演算の順) ----
_ITEMS = (
    ("either7", "both", 7),
    ("either30", "both", 30),
    ("up7", "up", 7),
    ("down7", "down", 7),
    ("up30", "up", 30),
    ("down30", "down", 30),
)
_WINDOW = 365


def threshold(rv: float, k: float, horizon_days: int) -> float:
    return k * (rv / math.sqrt(365.0)) * math.sqrt(horizon_days)


def _position(value: float, lo: float, hi: float) -> str:
    if hi <= lo:
        return "mid"
    r = (value - lo) / (hi - lo)
    return "low" if r < 1 / 3 else ("high" if r >= 2 / 3 else "mid")


def _check_positive(items: list[dict], lo: float, hi: float) -> None:
    """zod (BandItemSchema / .positive()) が 1 つでも弾くと日次の公開ごと止まる。
    その前にここで ValueError にして、帯のブロックだけを省く (run_producer が range_band_degraded=)。"""
    for it in items:
        th = it["threshold"]
        if not math.isfinite(th) or th <= 0:
            raise ValueError(f"range_band: bad threshold {it['id']}={th}")
        if it["side"] in ("both", "down") and th >= 1:
            raise ValueError(f"range_band: lower side non-positive {it['id']} threshold={th}")
        for key in ("lo", "hi"):
            if key in it and not (math.isfinite(it[key]) and it[key] > 0):
                raise ValueError(f"range_band: bad {key} {it['id']}={it[key]}")
    if not (math.isfinite(lo) and lo > 0 and math.isfinite(hi) and hi > 0):
        raise ValueError(f"range_band: bad threshold_7d_365 min/max {lo}/{hi}")


def band_json(dates: list[str], closes: list[float], asset: str, usual: dict) -> dict:
    n = len(closes)
    if n != len(dates) or n < 31:
        raise ValueError(f"range_band needs >=31 aligned closes, got {n}")
    ks = load_k()
    meta = _load(Q_2026_11_PATH)
    rv = indicators.realized_volatility(closes, 30)
    close = closes[-1]
    items = []
    for id_, side, h in _ITEMS:
        k = ks[(side, h)]
        th = threshold(rv, k, h)
        it: dict = {"id": id_, "side": side, "horizon_days": h, "k": k, "threshold": th}
        if side in ("both", "down"):
            it["lo"] = round(close * (1 - th), 2)
        if side in ("both", "up"):
            it["hi"] = round(close * (1 + th), 2)
        it["usual_pct"] = round(usual[(asset, side, h)] * 100, 2)
        items.append(it)
    k7 = ks[("both", 7)]
    series = [
        threshold(indicators.realized_volatility(closes[: t + 1], 30), k7, 7)
        for t in range(max(30, n - _WINDOW), n)
    ]
    today = series[-1]
    lo, hi = min(series), max(series)
    _check_positive(items, lo, hi)
    return {
        "as_of": dates[-1],
        "close": close,
        "realized_vol_30d": rv,
        "items": items,
        "threshold_7d_365": {"min": lo, "max": hi, "position": _position(today, lo, hi)},
        "source": {"question_set": "q-2026-11", "version": "base-rate-q2026-11",
                   "usual_period": meta["usual_period"]},
    }
