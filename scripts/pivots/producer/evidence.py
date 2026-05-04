"""Compose human-readable summary copy from numeric scores + evidence."""
from __future__ import annotations

from typing import Iterable

from producer.types import (
    AssetSymbol,
    DirectionBiasDict,
    EvidenceItem,
    Horizon,
    score_level,
)


def _dominant_direction(bias: DirectionBiasDict) -> str:
    items = [
        ("Bullish", bias["bullish"]),
        ("Bearish", bias["bearish"]),
        ("Neutral", bias["neutral"]),
    ]
    items.sort(key=lambda kv: kv[1], reverse=True)
    return items[0][0]


def collect_summary(
    asset: AssetSymbol,
    horizon: Horizon,
    pp_score: int,
    vp_score: int,
    bias: DirectionBiasDict,
    evidence: Iterable[EvidenceItem],
) -> tuple[str, str]:
    overall = int(round(pp_score * 0.45 + vp_score * 0.45 + 60 * 0.10))
    level = score_level(overall)
    direction = _dominant_direction(bias)
    main_driver = "volatility" if vp_score >= pp_score else "price reversal"
    headline = f"{level} turning point conditions in {asset} {horizon}"
    explanation = (
        f"Direction bias leans {direction.lower()}; main driver appears to be "
        f"{main_driver}. Evidence count: {sum(1 for _ in evidence)}."
    )
    return headline, explanation
