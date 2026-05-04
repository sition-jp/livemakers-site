from producer.score_price_pivot import score_price_pivot, MarketContext


def _ctx(**kwargs) -> MarketContext:
    base: MarketContext = {
        "rsi_14": 50.0,
        "distance_from_ma_20": 0.0,
        "distance_from_ma_50": 0.0,
        "distance_from_ma_20_history": [0.0] * 50,
        "distance_from_ma_50_history": [0.0] * 50,
        "macd_hist_recent": [0.0] * 5,
        "near_range_boundary": False,
    }
    base.update(kwargs)
    return base


def test_neutral_inputs_score_zero() -> None:
    score, ev = score_price_pivot(_ctx())
    assert score == 0
    assert ev == []


def test_rsi_oversold_adds_20() -> None:
    score, ev = score_price_pivot(_ctx(rsi_14=25.0))
    assert score == 20
    assert any("oversold" in e["message"].lower() for e in ev)


def test_rsi_overheated_adds_20() -> None:
    score, _ = score_price_pivot(_ctx(rsi_14=75.0))
    assert score == 20


def test_far_from_ma20_adds_15() -> None:
    history = [0.01] * 50
    score, _ = score_price_pivot(
        _ctx(distance_from_ma_20=0.1, distance_from_ma_20_history=history)
    )
    assert score >= 15


def test_macd_improving_adds_15() -> None:
    score, _ = score_price_pivot(
        _ctx(macd_hist_recent=[-0.5, -0.4, -0.3, -0.1, 0.05])
    )
    assert score == 15


def test_near_boundary_adds_20() -> None:
    score, _ = score_price_pivot(_ctx(near_range_boundary=True))
    assert score == 20


def test_clamped_at_100() -> None:
    score, _ = score_price_pivot(
        _ctx(
            rsi_14=10.0,
            distance_from_ma_20=0.5,
            distance_from_ma_20_history=[0.01] * 50,
            distance_from_ma_50=0.5,
            distance_from_ma_50_history=[0.01] * 50,
            macd_hist_recent=[-0.5, -0.4, -0.3, -0.1, 0.05],
            near_range_boundary=True,
        )
    )
    assert 0 <= score <= 100
    assert score >= 70
