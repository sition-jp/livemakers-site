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


@pytest.mark.parametrize("funding_count, expected_overall", [
    (0, 0.5), (1, 0.6666666667), (2, 0.8333333333), (3, 1.0),
])
def test_recovered_completeness_uses_unrounded_counts(repo, funding_count, expected_overall):
    _commit(repo, _snapshot("2026-08-12T23:00:00Z", 6))
    baseline = _snapshot()
    for block in baseline["assets"].values():
        row = block["history"][0]
        funding = row["funding"]
        funding["sample_count"] = funding_count
        funding["sum"] = round(funding_count * 0.0001, 10)
        if funding_count == 0:
            funding.update({key: 0.0 for key in funding if key != "sample_count"})
        row["completeness"]["funding"] = round(funding_count / 3, 10)
        row["completeness"]["overall"] = round(funding_count / 6, 10)
    head = _commit(repo, baseline)

    candidate, audit = build_recovery_candidate(repo, head)

    assert len(audit["restored"]) == 2
    for asset in ("BTC", "ETH"):
        row = candidate["assets"][asset]["history"][0]
        assert row["completeness"]["overall"] == expected_overall
        assert row["funding"] == baseline["assets"][asset]["history"][0]["funding"]


@pytest.mark.parametrize("kind, reason", [
    ("root", "not a single-parent snapshot commit"),
    ("empty_subject", "not a daily snapshot commit"),
])
def test_blank_commit_fields_are_rejected_without_aborting_history(repo, kind, reason):
    donor = _commit(repo, _snapshot("2026-08-12T23:00:00Z", 6))
    source_tree = donor
    parents = []
    if kind == "empty_subject":
        source_tree = _commit(repo, _snapshot("2026-08-13T23:00:00Z"))
        parents = ["-p", donor]
    bad_sha = _git(repo, "-c", "commit.gpgsign=false", "commit-tree", f"{source_tree}^{{tree}}",
                   *parents, "-m", "root snapshot" if kind == "root" else "")
    baseline = _snapshot()
    baseline_sha = _commit(repo, baseline)
    generated = baseline["generated_at"]
    head = _git(repo, "-c", "commit.gpgsign=false", "commit-tree", f"{baseline_sha}^{{tree}}",
                "-p", bad_sha, "-m", f"chore(pivots): daily snapshot {generated}",
                env={**os.environ, "GIT_AUTHOR_DATE": generated, "GIT_COMMITTER_DATE": generated})

    candidate, audit = build_recovery_candidate(repo, head)

    assert candidate == (baseline if kind == "root" else _snapshot(count=6))
    assert audit["accepted_commits"] == ([head] if kind == "root" else [head, donor])
    assert audit["rejected_commits"] == [{"commit": bad_sha, "reason": reason}]


@pytest.mark.parametrize("kind", [
    "repository", "objects", "config_count", "config_parameters", "home_config", "trace",
])
def test_recovery_ignores_inherited_git_environment(repo, tmp_path, monkeypatch, kind):
    _commit(repo, _snapshot("2026-08-12T23:00:00Z", 6))
    head = _commit(repo, _snapshot())
    other = tmp_path / "other"
    other.mkdir()
    _git(other, "init", "-q")
    trace = tmp_path / "git-trace.log"
    overrides = {
        "repository": {"GIT_DIR": str(other / ".git"), "GIT_WORK_TREE": str(other),
                       "GIT_COMMON_DIR": str(other / ".git")},
        "objects": {"GIT_OBJECT_DIRECTORY": str(other / ".git/objects")},
        "config_count": {"GIT_CONFIG_COUNT": "invalid"},
        "config_parameters": {"GIT_CONFIG_PARAMETERS": "invalid"},
        "home_config": {"HOME": str(other)},
        "trace": {"GIT_TRACE": str(trace)},
    }
    if kind == "home_config":
        (other / ".gitconfig").write_text("[invalid config\n", encoding="utf-8")
        monkeypatch.delenv("GIT_CONFIG_GLOBAL", raising=False)
    for key, value in overrides[kind].items():
        monkeypatch.setenv(key, value)

    candidate, audit = build_recovery_candidate(repo, head)

    assert audit["source_ref"] == head
    assert len(audit["restored"]) == 2
    assert candidate["assets"]["BTC"]["history"][0]["open_interest"]["sample_count"] == 6
    assert not trace.exists()


def test_recovery_disables_repository_signature_verification(repo, tmp_path):
    _commit(repo, _snapshot("2026-08-12T23:00:00Z", 6))
    head = _commit(repo, _snapshot())
    raw = subprocess.check_output(["git", "-C", str(repo), "cat-file", "commit", head])
    metadata, message = raw.split(b"\n\n", 1)
    signed = (metadata + b"\ngpgsig -----BEGIN PGP SIGNATURE-----\n invalid\n"
              b" -----END PGP SIGNATURE-----\n\n" + message)
    signed_head = subprocess.check_output(
        ["git", "-C", str(repo), "hash-object", "-t", "commit", "-w", "--stdin"], input=signed,
    ).decode().strip()
    marker = tmp_path / "gpg-invoked"
    verifier = tmp_path / "fake-gpg"
    verifier.write_text(f'#!/bin/sh\nprintf invoked > "{marker}"\nexit 1\n', encoding="utf-8")
    verifier.chmod(0o700)
    _git(repo, "config", "log.showSignature", "true")
    _git(repo, "config", "gpg.program", str(verifier))

    candidate, audit = build_recovery_candidate(repo, signed_head)

    assert len(audit["restored"]) == 2
    assert candidate["assets"]["BTC"]["history"][0]["open_interest"]["sample_count"] == 6
    assert not marker.exists()


def test_cli_zero_accepted_sources_fails_without_output(repo, tmp_path, capsys):
    head = _commit(repo, _snapshot(), message="test: unqualified baseline")
    output = tmp_path / "recovery"

    assert main(["--repo", str(repo), "--source-ref", head, "--output-dir", str(output)]) == 1

    assert not output.exists()
    assert "no eligible daily snapshot commits" in capsys.readouterr().out


def test_cli_zero_restored_days_with_eligible_source_succeeds(repo, tmp_path):
    baseline = _snapshot()
    head = _commit(repo, baseline)
    output = tmp_path / "recovery"

    assert main(["--repo", str(repo), "--source-ref", head, "--output-dir", str(output)]) == 0

    audit = json.loads((output / "recovery-audit.json").read_text())
    assert audit["accepted_commits"] == [head]
    assert audit["restored"] == []
    assert json.loads((output / "pivot_derivatives_history.candidate.json").read_text()) == baseline
