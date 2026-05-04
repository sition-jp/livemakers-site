from producer.types import (
    AssetSymbol,
    Horizon,
    ConfidenceGrade,
    EvidenceCategory,
    HORIZONS,
    ASSETS,
    detail_key,
    score_level,
)


def test_constants_match_zod_sot() -> None:
    assert ASSETS == ("BTC", "ETH")
    assert HORIZONS == ("7D", "30D", "90D")


def test_detail_key_matches_zod_helper() -> None:
    assert detail_key("BTC", "30D") == "BTC__30D"
    assert detail_key("ETH", "7D") == "ETH__7D"


def test_score_level_thresholds() -> None:
    assert score_level(0) == "Low"
    assert score_level(39) == "Low"
    assert score_level(40) == "Medium"
    assert score_level(69) == "Medium"
    assert score_level(70) == "High"
    assert score_level(84) == "High"
    assert score_level(85) == "Extreme"
    assert score_level(100) == "Extreme"
