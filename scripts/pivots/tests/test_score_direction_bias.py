import math

import pytest

from producer.score_direction_bias import (
    DirectionContext,
    score_direction_bias,
    DIRECTION_BIAS_TOLERANCE,
)


def _ctx(**kwargs) -> DirectionContext:
    base: DirectionContext = {
        "rsi_14": 50.0,
        "near_support": False,
        "near_resistance": False,
        "funding": 0.0,
        "macd_hist_recent": [0.0] * 5,
        "volatility_pivot_score": 0,
    }
    base.update(kwargs)
    return base


def _sum_within_tolerance(d) -> bool:
    s = d["bullish"] + d["bearish"] + d["neutral"]
    return abs(s - 100.0) <= DIRECTION_BIAS_TOLERANCE


def test_neutral_inputs_default_to_full_neutral() -> None:
    d = score_direction_bias(_ctx())
    assert _sum_within_tolerance(d)
    assert d["neutral"] == pytest.approx(100.0)


def test_strong_bullish_signals() -> None:
    d = score_direction_bias(
        _ctx(
            rsi_14=25.0,
            near_support=True,
            funding=-0.005,
            macd_hist_recent=[-0.5, -0.4, -0.3, -0.1, 0.05],
        )
    )
    assert _sum_within_tolerance(d)
    assert d["bullish"] > d["bearish"]


def test_strong_bearish_signals() -> None:
    d = score_direction_bias(
        _ctx(
            rsi_14=75.0,
            near_resistance=True,
            funding=0.005,
            macd_hist_recent=[0.5, 0.4, 0.3, 0.1, -0.05],
        )
    )
    assert _sum_within_tolerance(d)
    assert d["bearish"] > d["bullish"]


def test_high_volatility_with_balanced_directional_signals_pushes_neutral() -> None:
    d = score_direction_bias(
        _ctx(
            rsi_14=25.0,         # +bullish 15
            near_resistance=True, # +bearish 15
            volatility_pivot_score=80,
        )
    )
    assert _sum_within_tolerance(d)
    assert d["neutral"] >= 30.0


@pytest.mark.parametrize(
    "ctx_kwargs",
    [
        {"rsi_14": 28.0},
        {"rsi_14": 72.0},
        {"funding": 0.01},
        {"funding": -0.01},
        {"near_support": True},
        {"near_resistance": True},
        {"macd_hist_recent": [-0.5, -0.4, -0.3, -0.1, 0.05]},
        {"macd_hist_recent": [0.5, 0.4, 0.3, 0.1, -0.05]},
        {"volatility_pivot_score": 90},
        {"volatility_pivot_score": 50, "rsi_14": 25.0, "near_resistance": True},
    ],
)
def test_sum_invariant_across_combinations(ctx_kwargs) -> None:
    d = score_direction_bias(_ctx(**ctx_kwargs))
    s = d["bullish"] + d["bearish"] + d["neutral"]
    assert abs(s - 100.0) <= DIRECTION_BIAS_TOLERANCE, (
        f"sum invariant violated: bullish={d['bullish']} bearish={d['bearish']} "
        f"neutral={d['neutral']} sum={s}"
    )
    assert 0 <= d["bullish"] <= 100
    assert 0 <= d["bearish"] <= 100
    assert 0 <= d["neutral"] <= 100
