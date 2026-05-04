from producer.score_confidence import (
    score_confidence,
    grade_for,
    ConfidenceInput,
)


def test_grade_thresholds() -> None:
    assert grade_for(90) == "A"
    assert grade_for(85) == "A"
    assert grade_for(84) == "B+"
    assert grade_for(75) == "B+"
    assert grade_for(74) == "B"
    assert grade_for(65) == "B"
    assert grade_for(64) == "C"
    assert grade_for(0) == "C"


def test_score_uses_weighted_formula() -> None:
    inp: ConfidenceInput = {
        "data_completeness": 100.0,
        "signal_agreement": 80.0,
        "backtest_quality": 60.0,
    }
    # 100*0.40 + 80*0.40 + 60*0.20 = 40 + 32 + 12 = 84
    score, grade = score_confidence(inp)
    assert score == 84
    assert grade == "B+"


def test_low_data_completeness_drops_grade() -> None:
    inp: ConfidenceInput = {
        "data_completeness": 40.0,
        "signal_agreement": 60.0,
        "backtest_quality": 50.0,
    }
    score, grade = score_confidence(inp)
    assert grade == "C"
