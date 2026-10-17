"""較正表 (スコア → 確率) と評価指標のテスト (it-2026-10)。"""
from __future__ import annotations

import pytest

from producer.calibration import (
    BIN_EDGES,
    SHRINK_K,
    CalibrationTable,
    brier,
    brier_skill,
    fit,
    from_json,
    lift,
    predict,
    to_json,
)


def test_preregistered_constants():
    assert BIN_EDGES == (0, 20, 40, 60, 80, 101)
    assert SHRINK_K == 20.0


def test_fit_excludes_pending():
    scores = [10, 10, 10, 10]
    outcomes = ["hit", "miss", "pending", "pending"]
    t = fit(scores, outcomes)
    assert t.usual == 0.5
    assert t.bins[0][3] == 2  # pending は n に数えない


def test_empty_bin_falls_back_to_usual():
    t = fit([10, 10, 10, 10, 10], ["hit", "hit", "miss", "miss", "miss"])
    assert t.usual == pytest.approx(0.4)
    assert t.bins[3][3] == 0
    assert t.bins[3][2] == pytest.approx(t.usual)
    assert predict(t, 70) == pytest.approx(t.usual)


def test_shrink_toward_usual():
    # usual 0.4 (15 件中 6 hit)、区間 [80,100] は n=5 全 hit → (5 + 8) / 25 = 0.52
    scores = [90] * 5 + [10] * 10
    outcomes = ["hit"] * 5 + ["miss"] * 9 + ["hit"]
    t = fit(scores, outcomes)
    assert t.usual == pytest.approx(0.4)
    assert predict(t, 95) == pytest.approx(0.52)


def test_predict_clamps_out_of_range():
    t = fit([5, 95], ["miss", "hit"])
    assert predict(t, -10) == predict(t, 0)
    assert predict(t, 250) == predict(t, 100)
    assert predict(t, 100) == predict(t, 80)
    assert predict(t, 19) == predict(t, 0)
    assert predict(t, 20) != predict(t, 19) or t.bins[1][3] == 0


def test_fit_no_samples_raises():
    with pytest.raises(ValueError):
        fit([], [])
    with pytest.raises(ValueError):
        fit([10, 20], ["pending", "pending"])


def test_fit_length_mismatch_raises():
    with pytest.raises(ValueError):
        fit([1, 2], ["hit"])


def test_brier_basic_and_excludes_pending():
    assert brier([1.0, 0.0], ["hit", "miss"]) == 0.0
    assert brier([0.5, 0.5, 0.9], ["hit", "miss", "pending"]) == pytest.approx(0.25)
    with pytest.raises(ValueError):
        brier([0.5], ["pending"])


def test_brier_skill_zero_for_constant_usual():
    outcomes = ["hit", "miss", "miss", "hit", "miss"]
    probs = [0.4] * 5
    assert brier_skill(probs, outcomes, 0.4) == pytest.approx(0.0)


def test_brier_skill_positive_for_better_model():
    outcomes = ["hit", "miss", "hit", "miss"]
    assert brier_skill([0.9, 0.1, 0.9, 0.1], outcomes, 0.5) > 0.5


def test_brier_skill_none_when_baseline_perfect():
    # usual=1.0 で全部 hit → ふだんのみの Brier が 0 で、割れない
    assert brier_skill([1.0, 1.0], ["hit", "hit"], 1.0) is None


def test_lift_basic():
    usual = 0.4
    probs = [0.6, 0.6, 0.3, 0.3]  # 0.6-0.4=0.2 >= 0.10 が兆し日
    outcomes = ["hit", "hit", "miss", "hit"]
    assert lift(probs, outcomes, usual) == pytest.approx(1.0 - 0.5)


def test_lift_none_when_no_signal_days():
    assert lift([0.3, 0.3], ["hit", "miss"], 0.4) is None


def test_lift_none_when_no_other_days():
    assert lift([0.9, 0.9], ["hit", "miss"], 0.4) is None


def test_lift_excludes_pending_and_boundary_inclusive():
    probs = [0.5, 0.5, 0.2, 0.9]
    outcomes = ["hit", "pending", "miss", "pending"]
    # 0.5 - 0.4 = 0.1 (浮動小数の誤差に注意) は兆しあり扱い
    assert lift(probs, outcomes, 0.4) == pytest.approx(1.0)


def test_json_roundtrip():
    t = fit([10, 30, 50, 70, 90, 90], ["hit", "miss", "miss", "hit", "hit", "miss"])
    d = to_json(t)
    assert from_json(d) == t
    import json

    assert from_json(json.loads(json.dumps(d))) == t
    assert isinstance(t, CalibrationTable)
