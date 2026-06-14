"""Derive provisional confidence backtest-quality signals.

These values are produced from the current structural backtest smoke, not from a
calibrated benchmark. Small samples are intentionally omitted so the downstream
confidence scorer falls back to DEFAULT_BACKTEST_QUALITY instead of treating a
one-off hit as quality evidence.
"""
from __future__ import annotations

from typing import Iterable, TypeAlias

from producer.types import AssetSymbol, BacktestEntry, Horizon

BacktestQualityKey: TypeAlias = tuple[AssetSymbol, Horizon]
BacktestQualityMap: TypeAlias = dict[BacktestQualityKey, float]

DEFAULT_BACKTEST_QUALITY = 60.0
MIN_BACKTEST_QUALITY_SAMPLE_SIZE = 5
MIN_OVERALL_SAMPLE_SIZE = MIN_BACKTEST_QUALITY_SAMPLE_SIZE


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


def _has_quality_sample(entry: BacktestEntry) -> bool:
    return (
        entry["metrics"]["sample_size"]
        >= MIN_BACKTEST_QUALITY_SAMPLE_SIZE
    )


def _weighted_average_quality(entries: list[BacktestEntry]) -> float:
    total_sample_size = sum(entry["metrics"]["sample_size"] for entry in entries)
    return round(
        sum(
            quality_from_entry(entry) * entry["metrics"]["sample_size"]
            for entry in entries
        )
        / total_sample_size,
        4,
    )


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
            if _has_quality_sample(entry)
        ]
        if sufficient_overall:
            quality_map[key] = quality_from_entry(sufficient_overall[0])
            continue

        blend_entries = [
            entry
            for entry in key_entries
            if entry["score_type"] in ("price_pivot", "volatility_pivot")
            and entry["threshold"] == 70
            and _has_quality_sample(entry)
        ]
        if blend_entries:
            quality_map[key] = _weighted_average_quality(blend_entries)

    return quality_map
