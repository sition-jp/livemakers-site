import pytest

from producer.backtest_quality import (
    DEFAULT_BACKTEST_QUALITY,
    MIN_OVERALL_SAMPLE_SIZE,
    build_backtest_quality_map,
    quality_from_entry,
)
from producer.types import AssetSymbol, BacktestEntry, Horizon, ScoreType


def make_entry(
    *,
    asset: AssetSymbol = "BTC",
    horizon: Horizon = "7D",
    score_type: ScoreType = "overall",
    threshold: int = 70,
    sample_size: int = 0,
    precision: float = 0.0,
    recall: float = 0.0,
    avg_lead_time_days: float = 0.0,
) -> BacktestEntry:
    return {
        "asset": asset,
        "horizon": horizon,
        "score_type": score_type,
        "threshold": threshold,
        "period": {"start": "2026-01-01", "end": "2026-02-01"},
        "metrics": {
            "precision": precision,
            "recall": recall,
            "avg_lead_time_days": avg_lead_time_days,
            "false_positive_rate": 0.0,
            "false_negative_rate": 0.0,
            "average_move": 0.0,
            "max_drawdown": 0.0,
            "sample_size": sample_size,
        },
    }


def test_quality_from_entry_rewards_sample_precision_recall_and_lead_time() -> None:
    baseline = make_entry()
    higher_sample = make_entry(sample_size=10)
    higher_precision = make_entry(precision=0.8)
    higher_recall = make_entry(recall=0.05)
    positive_lead_time = make_entry(avg_lead_time_days=1.0)
    combined = make_entry(
        sample_size=10,
        precision=0.8,
        recall=0.05,
        avg_lead_time_days=1.0,
    )

    assert quality_from_entry(higher_sample) > quality_from_entry(baseline)
    assert quality_from_entry(higher_precision) > quality_from_entry(baseline)
    assert quality_from_entry(higher_recall) > quality_from_entry(baseline)
    assert quality_from_entry(positive_lead_time) > quality_from_entry(baseline)
    assert quality_from_entry(combined) == pytest.approx(65.5)


def test_build_backtest_quality_map_prefers_overall_threshold_70_when_sample_is_large() -> None:
    entries = [
        make_entry(
            score_type="overall",
            threshold=80,
            sample_size=20,
            precision=1.0,
            recall=0.10,
        ),
        make_entry(
            score_type="price_pivot",
            threshold=70,
            sample_size=20,
            precision=1.0,
            recall=0.10,
        ),
        make_entry(
            score_type="volatility_pivot",
            threshold=70,
            sample_size=20,
            precision=1.0,
            recall=0.10,
        ),
        make_entry(
            score_type="overall",
            threshold=70,
            sample_size=MIN_OVERALL_SAMPLE_SIZE,
            precision=0.5,
            recall=0.05,
            avg_lead_time_days=1.0,
        ),
    ]

    quality = build_backtest_quality_map(entries)

    assert quality[("BTC", "7D")] == quality_from_entry(entries[-1])


def test_build_backtest_quality_map_blends_sufficient_price_and_volatility_by_sample_size_when_overall_sample_is_tiny() -> None:
    entries = [
        make_entry(
            score_type="overall",
            threshold=70,
            sample_size=1,
            precision=1.0,
            recall=0.10,
        ),
        make_entry(
            score_type="price_pivot",
            threshold=70,
            sample_size=10,
            precision=0.4,
            recall=0.04,
        ),
        make_entry(
            score_type="volatility_pivot",
            threshold=70,
            sample_size=20,
            precision=0.8,
            recall=0.08,
        ),
        make_entry(
            score_type="price_pivot",
            threshold=80,
            sample_size=20,
            precision=1.0,
            recall=0.10,
        ),
    ]
    expected = (
        quality_from_entry(entries[1]) * entries[1]["metrics"]["sample_size"]
        + quality_from_entry(entries[2]) * entries[2]["metrics"]["sample_size"]
    ) / (
        entries[1]["metrics"]["sample_size"]
        + entries[2]["metrics"]["sample_size"]
    )

    quality = build_backtest_quality_map(entries)

    assert quality[("BTC", "7D")] == pytest.approx(round(expected, 4))


def test_build_backtest_quality_map_omits_tiny_overall_when_no_sufficient_blended_entries_exist() -> None:
    overall = make_entry(
        score_type="overall",
        threshold=70,
        sample_size=1,
        precision=0.25,
        recall=0.02,
    )

    quality = build_backtest_quality_map([overall])

    assert ("BTC", "7D") not in quality


def test_build_backtest_quality_map_omits_blend_when_samples_are_tiny() -> None:
    entries = [
        make_entry(
            score_type="overall",
            threshold=70,
            sample_size=0,
            precision=1.0,
            recall=0.10,
        ),
        make_entry(
            score_type="price_pivot",
            threshold=70,
            sample_size=1,
            precision=1.0,
            recall=0.10,
        ),
        make_entry(
            score_type="volatility_pivot",
            threshold=70,
            sample_size=3,
            precision=1.0,
            recall=0.10,
        ),
    ]

    quality = build_backtest_quality_map(entries)

    assert ("BTC", "7D") not in quality


def test_empty_entries_produce_empty_map_and_default_is_60() -> None:
    assert build_backtest_quality_map([]) == {}
    assert DEFAULT_BACKTEST_QUALITY == 60.0
