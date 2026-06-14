"""Derive confidence backtest-quality signals from backtest entries."""
from __future__ import annotations

from typing import Iterable, TypeAlias

from producer.types import AssetSymbol, BacktestEntry, Horizon

BacktestQualityKey: TypeAlias = tuple[AssetSymbol, Horizon]
BacktestQualityMap: TypeAlias = dict[BacktestQualityKey, float]

DEFAULT_BACKTEST_QUALITY = 60.0
MIN_OVERALL_SAMPLE_SIZE = 5


def _clamp_quality(value: float) -> float:
    return max(0.0, min(value, 100.0))


def quality_from_entry(entry: BacktestEntry) -> float:
    metrics = entry["metrics"]
    sample_size = metrics["sample_size"]
    precision = metrics["precision"]
    recall = metrics["recall"]
    avg_lead_time_days = metrics["avg_lead_time_days"]

    sample_score = min(sample_size / 20.0, 1.0) * 35.0
    precision_score = precision * 35.0
    recall_score = min(recall / 0.10, 1.0) * 20.0
    lead_time_score = 10.0 if avg_lead_time_days > 0 else 0.0

    quality = (
        sample_score
        + precision_score
        + recall_score
        + lead_time_score
    )
    return round(_clamp_quality(quality), 4)


def build_backtest_quality_map(
    entries: Iterable[BacktestEntry],
) -> BacktestQualityMap:
    grouped: dict[BacktestQualityKey, list[BacktestEntry]] = {}
    for entry in entries:
        key = (entry["asset"], entry["horizon"])
        grouped.setdefault(key, []).append(entry)

    quality_map: BacktestQualityMap = {}
    for key, key_entries in grouped.items():
        overall_entries = [
            entry
            for entry in key_entries
            if entry["score_type"] == "overall"
            and entry["threshold"] == 70
        ]
        sufficient_overall = [
            entry
            for entry in overall_entries
            if entry["metrics"]["sample_size"] >= MIN_OVERALL_SAMPLE_SIZE
        ]
        if sufficient_overall:
            quality_map[key] = quality_from_entry(sufficient_overall[0])
            continue

        blend_entries = [
            entry
            for entry in key_entries
            if entry["score_type"] in ("price_pivot", "volatility_pivot")
            and entry["threshold"] == 70
            and entry["metrics"]["sample_size"] > 0
        ]
        if blend_entries:
            quality_map[key] = round(
                sum(quality_from_entry(entry) for entry in blend_entries)
                / len(blend_entries),
                4,
            )
            continue

        if overall_entries:
            quality_map[key] = quality_from_entry(overall_entries[0])

    return quality_map
