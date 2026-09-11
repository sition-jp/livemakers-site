import json
import hashlib
import os
import subprocess
from copy import deepcopy
from pathlib import Path

import pytest

from ops.recover_oi_history import RecoveryError, build_recovery_candidate, main


def _snapshot(generated_at="2026-09-10T23:00:00Z", count=0):
    oi = {
        "sample_count": count, "first": 100.0, "last": 110.0,
        "min": 100.0, "max": 110.0, "avg": 105.0,
        "last_usd": 1100.0, "avg_usd": 1050.0, "growth_pct": 0.1,
    }
    if count == 0:
        oi = {key: 0 if key == "sample_count" else 0.0 for key in oi}
    row = {
        "bucket_start": "2026-08-10T00:00:00Z",
        "bucket_end": "2026-08-11T00:00:00Z",
        "open_interest": oi,
        "funding": {
            "sample_count": 3, "sum": 0.0003, "avg": 0.0001,
            "abs_avg": 0.0001, "max_abs": 0.0001, "last": 0.0001,
        },
        "completeness": {"open_interest": count / 6, "funding": 1.0,
                         "overall": (count / 6 + 1) / 2},
        "source": {"oi_period": "4h", "funding_granularity": "8h",
                   "is_closed_bucket": True},
    }
    return {
        "schema_version": "pivots_derivatives_history.v0.1",
        "generated_at": generated_at, "provider": "binance_usdm",
        "assets": {
            asset: {"symbol": asset + "USDT", "history": [deepcopy(row)]}
            for asset in ("BTC", "ETH")
        },
    }


def _git(repo, *args, env=None):
    return subprocess.check_output(
        ["git", "-C", str(repo), *args], text=True, stderr=subprocess.PIPE,
        env=env,
    ).strip()


@pytest.fixture
def repo(tmp_path):
    root = tmp_path / "repo"
    root.mkdir()
    _git(root, "init", "-q")
    _git(root, "config", "user.name", "Recovery Test")
    _git(root, "config", "user.email", "recovery@example.invalid")
    _git(root, "-c", "commit.gpgsign=false", "commit", "--allow-empty", "-qm", "init")
    (root / "data").mkdir()
    return root


def _commit(repo, snapshot, *, message=None, pair_timestamp=None):
    generated = snapshot["generated_at"]
    paths = []
    for name in ("assets", "backtest", "derivatives_history"):
        path = repo / "data" / f"pivot_{name}.live.json"
        payload = snapshot if name == "derivatives_history" else {
            "generated_at": pair_timestamp or generated,
        }
        path.write_text(json.dumps(payload), encoding="utf-8")
        paths.append(str(path.relative_to(repo)))
    _git(repo, "add", "--", *paths)
    _git(repo, "-c", "commit.gpgsign=false", "commit", "-qm",
         message or f"chore(pivots): daily snapshot {generated}",
         env={**os.environ, "GIT_AUTHOR_DATE": generated, "GIT_COMMITTER_DATE": generated})
    return _git(repo, "rev-parse", "HEAD")


def test_recovery_fills_only_missing_oi_and_keeps_provenance(repo):
    donor = _commit(repo, _snapshot("2026-08-12T23:00:00Z", 6))
    baseline = _snapshot()
    head = _commit(repo, baseline)
    before = _git(repo, "status", "--porcelain")
    candidate, audit = build_recovery_candidate(repo, head)
    assert audit["source_ref"] == head
    assert len(audit["restored"]) == 2
    assert audit["restored"][0]["source_commits"] == [donor]
    for asset in ("BTC", "ETH"):
        row = candidate["assets"][asset]["history"][0]
        assert row["open_interest"]["sample_count"] == 6
        assert row["open_interest"]["avg"] == 105.0
        assert row["funding"] == baseline["assets"][asset]["history"][0]["funding"]
        assert row["completeness"]["overall"] == 1.0
    assert candidate["generated_at"] == baseline["generated_at"]
    assert _git(repo, "rev-parse", "HEAD") == head
    assert _git(repo, "status", "--porcelain") == before
    assert json.loads((repo / "data/pivot_derivatives_history.live.json").read_text()) == baseline
    assert build_recovery_candidate(repo, head) == (candidate, audit)


@pytest.mark.parametrize("kind", ["non_daily", "pair_mismatch", "fixture_age", "extra_path"])
def test_unqualified_sources_do_not_restore_oi(repo, kind):
    donor = _snapshot("2026-08-12T23:00:00Z", 6)
    if kind == "fixture_age":
        donor["generated_at"] = "2026-09-09T23:00:00Z"
    if kind == "extra_path":
        (repo / "unrelated.txt").write_text("not a data-only commit")
        _git(repo, "add", "unrelated.txt")
    _commit(
        repo, donor,
        message="test: fixture write" if kind == "non_daily" else None,
        pair_timestamp="2026-08-11T23:00:00Z" if kind == "pair_mismatch" else None,
    )
    baseline = _snapshot()
    head = _commit(repo, baseline)
    candidate, audit = build_recovery_candidate(repo, head)
    assert candidate == baseline
    assert audit["restored"] == []


def test_conflicting_complete_observations_fail_closed(repo):
    _commit(repo, _snapshot("2026-08-12T23:00:00Z", 6))
    changed = _snapshot("2026-08-13T23:00:00Z", 6)
    changed["assets"]["BTC"]["history"][0]["open_interest"]["avg"] = 106.0
    _commit(repo, changed)
    head = _commit(repo, _snapshot())
    with pytest.raises(RecoveryError, match="conflict"):
        build_recovery_candidate(repo, head)


def test_existing_nonzero_oi_is_never_replaced_by_recovery(repo):
    _commit(repo, _snapshot("2026-08-12T23:00:00Z", 6))
    baseline = _snapshot(count=3)
    head = _commit(repo, baseline)
    candidate, audit = build_recovery_candidate(repo, head)
    assert candidate == baseline
    assert audit["restored"] == []


@pytest.mark.parametrize("kind", ["nan", "duplicate", "future", "bad_growth", "bad_completeness"])
def test_invalid_baseline_fails_closed(repo, kind):
    baseline = _snapshot(count=6)
    row = baseline["assets"]["BTC"]["history"][0]
    if kind == "nan":
        row["open_interest"]["avg"] = float("nan")
    elif kind == "duplicate":
        baseline["assets"]["BTC"]["history"].append(deepcopy(row))
    elif kind == "future":
        row["bucket_start"] = "2026-09-10T00:00:00Z"
        row["bucket_end"] = "2026-09-11T00:00:00Z"
    elif kind == "bad_growth":
        row["open_interest"]["growth_pct"] = 0.99
    else:
        row["completeness"]["overall"] = 0.2
    head = _commit(repo, baseline)
    with pytest.raises(RecoveryError):
        build_recovery_candidate(repo, head)


def test_ref_must_be_pinned(repo):
    _commit(repo, _snapshot())
    with pytest.raises(RecoveryError, match="full commit SHA"):
        build_recovery_candidate(repo, "HEAD")


def test_cli_only_writes_new_external_candidate_directory(repo, tmp_path):
    _commit(repo, _snapshot("2026-08-12T23:00:00Z", 6))
    head = _commit(repo, _snapshot())
    output = tmp_path / "recovery"
    args = ["--repo", str(repo), "--source-ref", head, "--output-dir", str(output)]
    assert main(args) == 0
    assert set(p.name for p in output.iterdir()) == {
        "pivot_derivatives_history.candidate.json", "recovery-audit.json",
    }
    before = (output / "recovery-audit.json").read_bytes()
    assert main(args) == 1
    assert (output / "recovery-audit.json").read_bytes() == before
    assert main([*args[:-1], str(repo / "recovery")]) == 1
    assert not (repo / "recovery").exists()


def test_repo_subdirectory_uses_git_root_for_reads_and_write_guard(repo):
    _commit(repo, _snapshot("2026-08-12T23:00:00Z", 6))
    head = _commit(repo, _snapshot())
    candidate, audit = build_recovery_candidate(repo / "data", head)
    assert candidate["assets"]["BTC"]["history"][0]["open_interest"]["sample_count"] == 6
    assert len(audit["restored"]) == 2
    assert main(["--repo", str(repo / "data"), "--source-ref", head,
                 "--output-dir", str(repo / "recovery")]) == 1
    assert not (repo / "recovery").exists()


def test_replacement_refs_cannot_change_pinned_snapshot(repo):
    head = _commit(repo, _snapshot())
    original_bytes = subprocess.check_output(
        ["git", "-C", str(repo), "show", f"{head}:data/pivot_derivatives_history.live.json"]
    )
    replacement = _commit(repo, _snapshot("2026-09-11T23:00:00Z", 6))
    _git(repo, "replace", head, replacement)
    candidate, audit = build_recovery_candidate(repo, head)
    assert candidate == json.loads(original_bytes)
    assert audit["baseline_sha256"] == hashlib.sha256(original_bytes).hexdigest()


@pytest.mark.parametrize("average", [100.0, 110.0])
def test_infeasible_complete_oi_source_is_rejected(repo, average):
    donor = _snapshot("2026-08-12T23:00:00Z", 6)
    donor["assets"]["BTC"]["history"][0]["open_interest"]["avg"] = average
    bad_sha = _commit(repo, donor)
    baseline = _snapshot()
    head = _commit(repo, baseline)
    candidate, audit = build_recovery_candidate(repo, head)
    assert candidate == baseline
    assert any(r["commit"] == bad_sha and "infeasible OI" in r["reason"]
               for r in audit["rejected_commits"])
