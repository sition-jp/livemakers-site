from producer.score_volatility_pivot import (
    score_volatility_pivot,
    VolatilityContext,
)


def _ctx(**kwargs) -> VolatilityContext:
    base: VolatilityContext = {
        "rv_30d": 0.5,
        "rv_30d_history": [0.5] * 50,
        "bb_width": 0.05,
        "bb_width_history": [0.05] * 50,
        "atr_now": 100.0,
        "atr_history": [100.0] * 50,
        "oi_growth_pct": 0.0,
        "price_range_compression": False,
        "abs_funding": 0.0001,
        "abs_funding_history": [0.0001] * 50,
        "volume_ratio_30d": 1.0,
    }
    base.update(kwargs)
    return base


def test_neutral_inputs_zero() -> None:
    s, ev = score_volatility_pivot(_ctx())
    assert s == 0


def test_rv_compressed_adds_25() -> None:
    s, _ = score_volatility_pivot(
        _ctx(rv_30d=0.05, rv_30d_history=[0.5] * 50)
    )
    assert s == 25


def test_bb_compressed_adds_20() -> None:
    s, _ = score_volatility_pivot(
        _ctx(bb_width=0.005, bb_width_history=[0.05] * 50)
    )
    assert s == 20


def test_atr_rising_from_low_adds_15() -> None:
    history = [50.0] * 49 + [40.0]  # very low recent percentile
    s, _ = score_volatility_pivot(
        _ctx(atr_now=80.0, atr_history=history)
    )
    assert s >= 15


def test_oi_buildup_with_compressed_range_adds_25() -> None:
    s, _ = score_volatility_pivot(
        _ctx(oi_growth_pct=0.20, price_range_compression=True)
    )
    assert s == 25


def test_funding_extreme_adds_15() -> None:
    history = [0.0001] * 50
    s, _ = score_volatility_pivot(
        _ctx(abs_funding=0.005, abs_funding_history=history)
    )
    assert s >= 15


def test_volume_spike_adds_15() -> None:
    s, _ = score_volatility_pivot(_ctx(volume_ratio_30d=2.0))
    assert s == 15


def test_max_clamped() -> None:
    s, _ = score_volatility_pivot(
        _ctx(
            rv_30d=0.05, rv_30d_history=[0.5] * 50,
            bb_width=0.005, bb_width_history=[0.05] * 50,
            atr_now=80.0, atr_history=[50.0] * 49 + [40.0],
            oi_growth_pct=0.20, price_range_compression=True,
            abs_funding=0.005, abs_funding_history=[0.0001] * 50,
            volume_ratio_30d=2.0,
        )
    )
    assert s == 100  # 25+20+15+25+15+15 = 115 → clamp 100
