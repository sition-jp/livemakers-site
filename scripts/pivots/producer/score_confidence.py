"""Confidence scorer — PRD §16."""
from __future__ import annotations

from typing import TypedDict

from producer.types import ConfidenceGrade


class ConfidenceInput(TypedDict):
    data_completeness: float  # 0..100
    signal_agreement: float   # 0..100
    backtest_quality: float   # 0..100


def grade_for(score: float) -> ConfidenceGrade:
    if score >= 85:
        return "A"
    if score >= 75:
        return "B+"
    if score >= 65:
        return "B"
    return "C"


def score_confidence(inp: ConfidenceInput) -> tuple[int, ConfidenceGrade]:
    raw = (
        inp["data_completeness"] * 0.40
        + inp["signal_agreement"] * 0.40
        + inp["backtest_quality"] * 0.20
    )
    score = max(0, min(100, int(round(raw))))
    return score, grade_for(score)
