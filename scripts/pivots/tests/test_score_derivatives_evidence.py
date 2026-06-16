from producer.score_derivatives_evidence import score_derivatives_evidence


def base_context(**overrides):
    ctx = {
        "oi_growth_pct": 0.0,
        "oi_growth_history": [0.0, 0.02, 0.03, 0.04],
        "abs_funding": 0.0001,
        "abs_funding_history": [0.0001, 0.0002, 0.0003, 0.0004],
        "global_long_short_ratio": None,
        "global_long_short_ratio_history": [],
        "top_trader_position_ratio": None,
        "top_trader_position_ratio_history": [],
        "price_range_compression": False,
        "data_completeness": 100.0,
    }
    ctx.update(overrides)
    return ctx


def test_score_derivatives_evidence_emits_oi_crowding_evidence() -> None:
    score, evidence = score_derivatives_evidence(
        base_context(oi_growth_pct=0.18, price_range_compression=True)
    )
    assert score > 0
    assert evidence == [{
        "category": "oi",
        "direction": "volatility",
        "weight": 0.25,
        "message": "Open Interest expanded while price stayed range-bound",
        "raw_value": 0.18,
    }]


def test_score_derivatives_evidence_emits_funding_skew_evidence() -> None:
    score, evidence = score_derivatives_evidence(
        base_context(abs_funding=0.0010, abs_funding_history=[0.0001, 0.0002, 0.0003, 0.0004, 0.0010])
    )
    assert score > 0
    assert evidence[0]["category"] == "funding"
    assert evidence[0]["message"] == "Funding is skewed versus recent history"
    assert evidence[0]["raw_value"] == 0.0010


def test_score_derivatives_evidence_emits_crowded_long_short_evidence() -> None:
    score, evidence = score_derivatives_evidence(
        base_context(global_long_short_ratio=2.4, global_long_short_ratio_history=[0.9, 1.0, 1.1, 1.2, 2.4])
    )
    assert score > 0
    assert evidence[0]["category"] == "volatility"
    assert evidence[0]["message"] == "Long/short positioning is crowded, increasing squeeze sensitivity"
    assert evidence[0]["raw_value"] == 2.4


def test_score_derivatives_evidence_emits_top_trader_divergence_evidence() -> None:
    score, evidence = score_derivatives_evidence(
        base_context(
            global_long_short_ratio=2.2,
            global_long_short_ratio_history=[1.0, 1.2, 1.4, 1.6, 2.2],
            top_trader_position_ratio=1.2,
            top_trader_position_ratio_history=[1.1, 1.1, 1.2, 1.2, 1.2],
        )
    )
    messages = {item["message"] for item in evidence}
    assert score > 0
    assert "Top trader positioning diverges from broader account positioning" in messages


def test_score_derivatives_evidence_omits_low_signal_normal_readings() -> None:
    score, evidence = score_derivatives_evidence(
        base_context(
            oi_growth_pct=0.03,
            price_range_compression=True,
            abs_funding=0.0002,
            abs_funding_history=[0.0001, 0.0002, 0.0003, 0.0004],
            global_long_short_ratio=1.1,
            global_long_short_ratio_history=[1.0, 1.1, 1.2, 1.3],
            top_trader_position_ratio=1.15,
            top_trader_position_ratio_history=[1.1, 1.15, 1.2],
        )
    )
    assert score == 0
    assert evidence == []
