"""「ふだんの揺れ幅の帯」: q-2026-11 の凍結ふだんの確率と、しきい値・帯の計算。

ふだんの確率は `frozen/q_2026_11.json` (台帳 questions.Q_2026_11.base_rates の写し) を毎回読む。
"""
from __future__ import annotations

import json
from pathlib import Path

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
