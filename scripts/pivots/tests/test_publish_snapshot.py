from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Callable

import pytest

from ops.publish_snapshot import (
    GitHubClient,
    PullRequest,
    PublishConfig,
    PublishError,
    _classify_existing_pr,
    _evaluate_pr_checks,
    _evaluate_vercel_status,
    _load_github_env,
    _load_source_snapshot,
    _prepare_publisher_repo,
    _require_pr_files,
    _safe_command_output,
    _stage_snapshot_commit,
    publish_snapshot,
    verify_public_production,
    wait_for_public_production,
)


def _write_public_pair(
    root: Path,
    *,
    assets_generated_at: str = "2026-08-22T23:00:13Z",
    backtest_generated_at: str | None = None,
) -> tuple[Path, Path]:
    assets = root / "pivot_assets.live.json"
    backtest = root / "pivot_backtest.live.json"
    assets.write_text(
        json.dumps({"generated_at": assets_generated_at}),
        encoding="utf-8",
    )
    backtest.write_text(
        json.dumps(
            {
                "generated_at": backtest_generated_at or assets_generated_at,
            }
        ),
        encoding="utf-8",
    )
    return assets, backtest


def _write_valid_sidecar(root: Path) -> Path:
    sidecar = root / "pivot_derivatives_history.live.json"
    sidecar.write_text(
        json.dumps(
            {
                "schema_version": "pivots_derivatives_history.v0.1",
                "generated_at": "2026-08-22T23:00:13Z",
                "provider": "binance_usdm",
                "assets": {
                    "BTC": {"symbol": "BTC", "history": []},
                    "ETH": {"symbol": "ETH", "history": []},
                },
            }
        ),
        encoding="utf-8",
    )
    return sidecar


def _git(repo: Path, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", *args],
        cwd=repo,
        check=True,
        capture_output=True,
        text=True,
    )


def _init_remote(
    tmp_path: Path,
    *,
    generated_at: str = "2026-08-21T23:00:13Z",
) -> Path:
    remote = tmp_path / "remote.git"
    remote.mkdir()
    _git(remote, "init", "--bare", "--initial-branch=main")

    seed = tmp_path / "seed"
    seed.mkdir()
    _git(seed, "init", "--initial-branch=main")
    _git(seed, "config", "user.email", "publisher-test@example.com")
    _git(seed, "config", "user.name", "Publisher Test")
    data = seed / "data"
    data.mkdir()
    assets, backtest = _write_public_pair(
        data,
        assets_generated_at=generated_at,
    )
    sidecar = _write_valid_sidecar(data)
    sidecar_payload = json.loads(sidecar.read_text(encoding="utf-8"))
    sidecar_payload["generated_at"] = generated_at
    sidecar.write_text(json.dumps(sidecar_payload), encoding="utf-8")
    assert assets.exists() and backtest.exists()
    _git(seed, "add", "data")
    _git(seed, "commit", "-m", "seed snapshots")
    _git(seed, "remote", "add", "origin", str(remote))
    _git(seed, "push", "-u", "origin", "main")
    return remote


def _publisher_config(tmp_path: Path, remote: Path) -> PublishConfig:
    return PublishConfig(
        publisher_repo=tmp_path / "publisher",
        token_file=tmp_path / "unused.env",
        remote_url=str(remote),
    )


def test_source_pair_requires_matching_generated_at(tmp_path: Path) -> None:
    assets, backtest = _write_public_pair(
        tmp_path,
        backtest_generated_at="2026-08-21T23:00:13Z",
    )

    with pytest.raises(PublishError, match="generated_at mismatch"):
        _load_source_snapshot(assets, backtest, None)


@pytest.mark.parametrize(
    "generated_at",
    ["", "not-a-time", "2026-08-22T23:00:13+09:00"],
)
def test_source_pair_requires_utc_z_timestamp(
    tmp_path: Path, generated_at: str
) -> None:
    assets, backtest = _write_public_pair(
        tmp_path,
        assets_generated_at=generated_at,
    )

    with pytest.raises(PublishError, match="UTC generated_at"):
        _load_source_snapshot(assets, backtest, None)


def test_valid_sidecar_is_accepted(tmp_path: Path) -> None:
    assets, backtest = _write_public_pair(tmp_path)
    sidecar = _write_valid_sidecar(tmp_path)

    snapshot = _load_source_snapshot(assets, backtest, sidecar)

    assert snapshot.generated_at == "2026-08-22T23:00:13Z"
    assert snapshot.sidecar_path == sidecar


def test_invalid_sidecar_fails_closed(tmp_path: Path) -> None:
    assets, backtest = _write_public_pair(tmp_path)
    sidecar = tmp_path / "pivot_derivatives_history.live.json"
    sidecar.write_text('{"schema_version": "wrong"}', encoding="utf-8")

    with pytest.raises(PublishError, match="sidecar validation failed"):
        _load_source_snapshot(assets, backtest, sidecar)


def test_github_env_accepts_owned_0600_token_file(tmp_path: Path) -> None:
    token_file = tmp_path / "github.env"
    token_file.write_text('export GH_TOKEN="unit-secret"\n', encoding="utf-8")
    token_file.chmod(0o600)

    env = _load_github_env(token_file, base_env={"PATH": "/usr/bin"})

    assert env == {
        "PATH": "/usr/bin",
        "GH_TOKEN": "unit-secret",
        "GIT_TERMINAL_PROMPT": "0",
    }


@pytest.mark.parametrize("mode", [0o644, 0o400, 0o660])
def test_github_env_rejects_non_0600_file(tmp_path: Path, mode: int) -> None:
    token_file = tmp_path / "github.env"
    token_file.write_text("GH_TOKEN=unit-secret\n", encoding="utf-8")
    token_file.chmod(mode)

    with pytest.raises(PublishError, match="mode 0600"):
        _load_github_env(token_file)


def test_github_env_rejects_symlink(tmp_path: Path) -> None:
    target = tmp_path / "target.env"
    target.write_text("GH_TOKEN=unit-secret\n", encoding="utf-8")
    target.chmod(0o600)
    token_file = tmp_path / "github.env"
    token_file.symlink_to(target)

    with pytest.raises(PublishError, match="regular non-symlink"):
        _load_github_env(token_file)


def test_github_env_rejects_unexpected_content_without_leaking_token(
    tmp_path: Path,
) -> None:
    token_file = tmp_path / "github.env"
    secret = "unit-secret-never-log"
    token_file.write_text(
        f"GH_TOKEN={secret}\nOTHER_KEY=not-allowed\n",
        encoding="utf-8",
    )
    token_file.chmod(0o600)

    with pytest.raises(PublishError) as caught:
        _load_github_env(token_file)

    assert secret not in str(caught.value)
    assert "unexpected token file entry" in str(caught.value)


def test_github_env_rejects_duplicate_key_without_leaking_token(
    tmp_path: Path,
) -> None:
    token_file = tmp_path / "github.env"
    secret = "unit-secret-never-log"
    token_file.write_text(
        f"GH_TOKEN={secret}\nGH_TOKEN={secret}\n",
        encoding="utf-8",
    )
    token_file.chmod(0o600)

    with pytest.raises(PublishError) as caught:
        _load_github_env(token_file)

    assert secret not in str(caught.value)
    assert "exactly one GH_TOKEN" in str(caught.value)


def test_command_output_redacts_token_before_truncation() -> None:
    secret = "unit-secret-never-log"
    output = "x" * 1990 + secret + "tail"

    rendered = _safe_command_output("", output, {"GH_TOKEN": secret})

    assert secret not in rendered
    assert secret[:10] not in rendered
    assert len(rendered) <= 2000


def test_github_env_rejects_wrong_owner(tmp_path: Path, monkeypatch) -> None:
    token_file = tmp_path / "github.env"
    token_file.write_text("GH_TOKEN=unit-secret\n", encoding="utf-8")
    token_file.chmod(0o600)
    real_fstat = os.fstat

    class _StatWithWrongOwner:
        def __init__(self, descriptor: int):
            stat_result = real_fstat(descriptor)
            self.st_mode = stat_result.st_mode
            self.st_uid = stat_result.st_uid + 1

    monkeypatch.setattr(
        "ops.publish_snapshot.os.fstat",
        lambda descriptor: _StatWithWrongOwner(descriptor),
    )

    with pytest.raises(PublishError, match="current user"):
        _load_github_env(token_file)


def test_publisher_repo_commit_contains_only_snapshot_allowlist(
    tmp_path: Path,
) -> None:
    remote = _init_remote(tmp_path)
    config = _publisher_config(tmp_path, remote)
    source = tmp_path / "source"
    source.mkdir()
    assets, backtest = _write_public_pair(source)
    sidecar = _write_valid_sidecar(source)
    snapshot = _load_source_snapshot(assets, backtest, sidecar)

    _prepare_publisher_repo(config, env={})
    staged = _stage_snapshot_commit(snapshot, config, env={})

    assert staged.state == "staged"
    assert staged.branch == "automation/pivots-daily-20260822T230013Z"
    show = _git(
        config.publisher_repo,
        "show",
        "--name-only",
        "--pretty=format:",
        "HEAD",
    )
    assert {line for line in show.stdout.splitlines() if line} == {
        "data/pivot_assets.live.json",
        "data/pivot_backtest.live.json",
        "data/pivot_derivatives_history.live.json",
    }


def test_prepare_rejects_unrelated_dirty_publisher_clone(tmp_path: Path) -> None:
    remote = _init_remote(tmp_path)
    config = _publisher_config(tmp_path, remote)
    _prepare_publisher_repo(config, env={})
    (config.publisher_repo / "UNRELATED.txt").write_text("dirty\n", encoding="utf-8")

    with pytest.raises(PublishError, match="publisher clone is dirty"):
        _prepare_publisher_repo(config, env={})


def test_prepare_configures_gh_token_git_credential_helper(tmp_path: Path) -> None:
    remote = _init_remote(tmp_path)
    config = _publisher_config(tmp_path, remote)

    _prepare_publisher_repo(config, env={"GH_TOKEN": "unit-secret"})

    helpers = _git(
        config.publisher_repo,
        "config",
        "--local",
        "--get-all",
        "credential.https://github.com.helper",
    ).stdout.splitlines()
    assert helpers == ["", "!gh auth git-credential"]


def test_prepare_passes_gh_helper_to_initial_clone(tmp_path: Path) -> None:
    remote = _init_remote(tmp_path)
    config = _publisher_config(tmp_path, remote)
    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()
    capture = tmp_path / "clone-env"
    real_git = shutil.which("git")
    assert real_git is not None
    fake_git = fake_bin / "git"
    fake_git.write_text(
        "#!/bin/sh\n"
        "if [ \"$1\" = clone ]; then\n"
        "  printf '%s\\n' \"$GIT_CONFIG_COUNT\" \"$GIT_CONFIG_KEY_0\" "
        "\"$GIT_CONFIG_VALUE_0\" \"$GIT_CONFIG_KEY_1\" "
        "\"$GIT_CONFIG_VALUE_1\" \"${GIT_CONFIG_PARAMETERS-unset}\" "
        "> \"$PIVOTS_CLONE_ENV\"\n"
        "fi\n"
        f"exec {real_git} \"$@\"\n",
        encoding="utf-8",
    )
    fake_git.chmod(0o755)
    env = dict(os.environ)
    env["PATH"] = f"{fake_bin}:{env['PATH']}"
    env["PIVOTS_CLONE_ENV"] = str(capture)
    env["GIT_CONFIG_PARAMETERS"] = "'credential.helper=!malicious-helper'"

    _prepare_publisher_repo(config, env=env)

    assert capture.read_text(encoding="utf-8").splitlines() == [
        "2",
        "credential.https://github.com.helper",
        "",
        "credential.https://github.com.helper",
        "!gh auth git-credential",
        "unset",
    ]


def test_git_credential_helper_consumes_child_process_gh_token(tmp_path: Path) -> None:
    remote = _init_remote(tmp_path)
    config = _publisher_config(tmp_path, remote)
    _prepare_publisher_repo(config, env={"GH_TOKEN": "unit-secret"})
    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()
    fake_gh = fake_bin / "gh"
    fake_gh.write_text(
        "#!/bin/sh\n"
        "test \"$1\" = auth\n"
        "test \"$2\" = git-credential\n"
        "test \"$3\" = get\n"
        "printf 'username=x-access-token\\npassword=%s\\n' \"$GH_TOKEN\"\n",
        encoding="utf-8",
    )
    fake_gh.chmod(0o755)
    env = dict(os.environ)
    env["GH_TOKEN"] = "unit-secret"
    env["PATH"] = f"{fake_bin}:{env['PATH']}"

    result = subprocess.run(
        ["git", "credential", "fill"],
        cwd=config.publisher_repo,
        env=env,
        input="protocol=https\nhost=github.com\n\n",
        check=True,
        capture_output=True,
        text=True,
    )

    assert "username=x-access-token" in result.stdout
    assert "password=unit-secret" in result.stdout


def test_missing_source_sidecar_preserves_main_sidecar(tmp_path: Path) -> None:
    remote = _init_remote(tmp_path)
    config = _publisher_config(tmp_path, remote)
    source = tmp_path / "source"
    source.mkdir()
    assets, backtest = _write_public_pair(source)
    snapshot = _load_source_snapshot(assets, backtest, None)

    _prepare_publisher_repo(config, env={})
    sidecar_before = (
        config.publisher_repo / "data" / "pivot_derivatives_history.live.json"
    ).read_bytes()
    _stage_snapshot_commit(snapshot, config, env={})

    assert (
        config.publisher_repo / "data" / "pivot_derivatives_history.live.json"
    ).read_bytes() == sidecar_before
    show = _git(
        config.publisher_repo,
        "show",
        "--name-only",
        "--pretty=format:",
        "HEAD",
    )
    assert {line for line in show.stdout.splitlines() if line} == {
        "data/pivot_assets.live.json",
        "data/pivot_backtest.live.json",
    }


@pytest.mark.parametrize(
    "source_generated_at",
    ["2026-08-21T23:00:13Z", "2026-08-20T23:00:13Z"],
)
def test_equal_or_newer_main_is_idempotent_noop(
    tmp_path: Path, source_generated_at: str
) -> None:
    remote = _init_remote(tmp_path)
    config = _publisher_config(tmp_path, remote)
    source = tmp_path / "source"
    source.mkdir()
    assets, backtest = _write_public_pair(
        source,
        assets_generated_at=source_generated_at,
    )
    snapshot = _load_source_snapshot(assets, backtest, None)

    _prepare_publisher_repo(config, env={})
    staged = _stage_snapshot_commit(snapshot, config, env={})

    assert staged.state == "already_current"
    assert staged.generated_at == "2026-08-21T23:00:13Z"
    assert staged.branch is None
    assert _git(config.publisher_repo, "rev-parse", "--abbrev-ref", "HEAD").stdout.strip() == "HEAD"


def test_stage_rejects_unrelated_change_after_prepare(tmp_path: Path) -> None:
    remote = _init_remote(tmp_path)
    config = _publisher_config(tmp_path, remote)
    source = tmp_path / "source"
    source.mkdir()
    assets, backtest = _write_public_pair(source)
    snapshot = _load_source_snapshot(assets, backtest, None)
    _prepare_publisher_repo(config, env={})
    tracked = config.publisher_repo / "README.md"
    tracked.write_text("unrelated\n", encoding="utf-8")

    with pytest.raises(PublishError, match="publisher clone is dirty"):
        _stage_snapshot_commit(snapshot, config, env={})


def test_stage_rebuilds_clean_local_branch_left_by_failed_push(tmp_path: Path) -> None:
    remote = _init_remote(tmp_path)
    config = _publisher_config(tmp_path, remote)
    source = tmp_path / "source"
    source.mkdir()
    assets, backtest = _write_public_pair(source)
    snapshot = _load_source_snapshot(assets, backtest, None)

    _prepare_publisher_repo(config, env={})
    first = _stage_snapshot_commit(snapshot, config, env={})
    first_tree = _git(
        config.publisher_repo,
        "rev-parse",
        "HEAD^{tree}",
    ).stdout.strip()
    _prepare_publisher_repo(config, env={})
    second = _stage_snapshot_commit(snapshot, config, env={})
    second_tree = _git(
        config.publisher_repo,
        "rev-parse",
        "HEAD^{tree}",
    ).stdout.strip()

    assert first.branch == second.branch
    assert first.committed_paths == second.committed_paths
    assert first_tree == second_tree


def _check_run(name: str, conclusion: str, status: str = "COMPLETED") -> dict:
    return {
        "__typename": "CheckRun",
        "name": name,
        "status": status,
        "conclusion": conclusion,
    }


def _status_context(context: str, state: str) -> dict:
    return {
        "__typename": "StatusContext",
        "context": context,
        "state": state,
    }


def _pr_check_payload(*checks: dict, **overrides) -> dict:
    payload = {
        "state": "OPEN",
        "isDraft": False,
        "mergeable": "MERGEABLE",
        "statusCheckRollup": list(checks),
    }
    payload.update(overrides)
    return payload


def test_pr_checks_require_guards_and_vercel_success() -> None:
    assert _evaluate_pr_checks(
        _pr_check_payload(
            _check_run("guards", "SUCCESS"),
            _status_context("Vercel", "PENDING"),
        )
    )[0] == "pending"
    assert _evaluate_pr_checks(
        _pr_check_payload(
            _status_context("Vercel", "SUCCESS"),
        )
    )[0] == "pending"
    assert _evaluate_pr_checks(
        _pr_check_payload(
            _check_run("guards", "SUCCESS"),
            _status_context("Vercel", "SUCCESS"),
        )
    ) == ("success", "guards and Vercel are green")


@pytest.mark.parametrize(
    "payload,reason",
    [
        (
            _pr_check_payload(
                _check_run("guards", "FAILURE"),
                _status_context("Vercel", "SUCCESS"),
            ),
            "guards failed",
        ),
        (
            _pr_check_payload(
                _check_run("guards", "SUCCESS"),
                _status_context("Vercel", "FAILURE"),
            ),
            "Vercel failed",
        ),
        (
            _pr_check_payload(
                _check_run("guards", "SUCCESS"),
                _status_context("Vercel", "SUCCESS"),
                isDraft=True,
            ),
            "draft",
        ),
        (
            _pr_check_payload(
                _check_run("guards", "SUCCESS"),
                _status_context("Vercel", "SUCCESS"),
                mergeable="CONFLICTING",
            ),
            "conflicting",
        ),
    ],
)
def test_failed_or_unmergeable_pr_never_becomes_green(
    payload: dict, reason: str
) -> None:
    state, details = _evaluate_pr_checks(payload)
    assert state == "failed"
    assert reason in details


def test_closed_unmerged_existing_pr_fails() -> None:
    pr = PullRequest(
        number=42,
        url="https://github.test/pr/42",
        state="CLOSED",
        is_draft=False,
        merge_sha=None,
    )

    with pytest.raises(PublishError, match="closed without merge"):
        _classify_existing_pr(pr)


def test_merged_existing_pr_can_resume_production_verification() -> None:
    pr = PullRequest(
        number=42,
        url="https://github.test/pr/42",
        state="MERGED",
        is_draft=False,
        merge_sha="a" * 40,
    )

    assert _classify_existing_pr(pr) == "merged"


@pytest.mark.parametrize(
    "overrides",
    [
        {"baseRefName": "release"},
        {"headRefName": "automation/pivots-daily-other"},
        {"headRepositoryOwner": {"login": "untrusted-fork"}},
    ],
)
def test_find_pr_rejects_wrong_base_head_or_owner(monkeypatch, overrides: dict) -> None:
    config = PublishConfig(
        publisher_repo=Path("/unused"),
        token_file=Path("/unused"),
    )
    client = GitHubClient(config, env={})
    branch = "automation/pivots-daily-20260822T230013Z"
    payload = {
        "number": 42,
        "url": "https://github.com/sition-jp/livemakers-site/pull/42",
        "state": "OPEN",
        "isDraft": False,
        "mergeCommit": None,
        "baseRefName": "main",
        "headRefName": branch,
        "headRepositoryOwner": {"login": "sition-jp"},
    }
    payload.update(overrides)
    calls: list[list[str]] = []

    def fake_json_command(args):
        calls.append(list(args))
        return [payload]

    monkeypatch.setattr(client, "_json_command", fake_json_command)

    with pytest.raises(PublishError, match="identity"):
        client.find_pr(branch)

    head_index = calls[0].index("--head")
    assert calls[0][head_index + 1] == branch


def test_wait_for_green_times_out_without_merge(monkeypatch) -> None:
    config = PublishConfig(
        publisher_repo=Path("/unused"),
        token_file=Path("/unused"),
    )
    client = GitHubClient(config, env={})
    pending = _pr_check_payload(
        _check_run("guards", "", status="IN_PROGRESS"),
        _status_context("Vercel", "PENDING"),
    )
    monkeypatch.setattr(client, "_view_pr", lambda _number: pending)
    ticks = iter([0.0, 0.5, 1.1])

    with pytest.raises(PublishError, match="timed out"):
        client.wait_for_green(
            42,
            timeout_seconds=1,
            poll_interval_seconds=0,
            sleep=lambda _seconds: None,
            monotonic=lambda: next(ticks),
        )


def test_wait_for_green_returns_after_pending_then_success(monkeypatch) -> None:
    config = PublishConfig(
        publisher_repo=Path("/unused"),
        token_file=Path("/unused"),
    )
    client = GitHubClient(config, env={})
    responses = iter(
        [
            _pr_check_payload(
                _check_run("guards", "", status="IN_PROGRESS"),
                _status_context("Vercel", "PENDING"),
            ),
            _pr_check_payload(
                _check_run("guards", "SUCCESS"),
                _status_context("Vercel", "SUCCESS"),
            ),
        ]
    )
    monkeypatch.setattr(client, "_view_pr", lambda _number: next(responses))
    ticks = iter([0.0, 0.1, 0.2])

    payload = client.wait_for_green(
        42,
        timeout_seconds=1,
        poll_interval_seconds=0,
        sleep=lambda _seconds: None,
        monotonic=lambda: next(ticks),
    )

    assert _evaluate_pr_checks(payload)[0] == "success"


@pytest.mark.parametrize(
    "payload,expected",
    [
        ({"state": "pending", "statuses": []}, "pending"),
        (
            {
                "state": "success",
                "statuses": [{"context": "Vercel", "state": "success"}],
            },
            "success",
        ),
        (
            {
                "state": "failure",
                "statuses": [{"context": "Vercel", "state": "failure"}],
            },
            "failed",
        ),
    ],
)
def test_vercel_production_status_evaluation(payload: dict, expected: str) -> None:
    assert _evaluate_vercel_status(payload)[0] == expected


def test_merge_requires_merged_true_and_sha(monkeypatch) -> None:
    config = PublishConfig(
        publisher_repo=Path("/unused"),
        token_file=Path("/unused"),
    )
    client = GitHubClient(config, env={})

    def fake_run(*_args, **_kwargs):
        return subprocess.CompletedProcess(
            args=[],
            returncode=0,
            stdout=json.dumps({"merged": False, "message": "rejected"}),
            stderr="",
        )

    monkeypatch.setattr("ops.publish_snapshot._run_command", fake_run)

    with pytest.raises(PublishError, match="merge API rejected"):
        client.squash_merge(42, "2026-08-22T23:00:13Z", "a" * 40)


def test_merge_returns_verified_sha(monkeypatch) -> None:
    config = PublishConfig(
        publisher_repo=Path("/unused"),
        token_file=Path("/unused"),
    )
    client = GitHubClient(config, env={})
    sha = "b" * 40

    calls: list[list[str]] = []

    def fake_run(args, **_kwargs):
        calls.append(list(args))
        return subprocess.CompletedProcess(
            args=[],
            returncode=0,
            stdout=json.dumps({"merged": True, "sha": sha}),
            stderr="",
        )

    monkeypatch.setattr("ops.publish_snapshot._run_command", fake_run)

    head_sha = "a" * 40
    assert client.squash_merge(42, "2026-08-22T23:00:13Z", head_sha) == sha
    assert f"sha={head_sha}" in calls[0]


def _fake_http_getter(responses: dict[str, tuple[int, bytes]]) -> Callable:
    def fake_get(url: str, _timeout: int) -> tuple[int, bytes]:
        return responses[url]

    return fake_get


def test_public_smoke_requires_expected_radar_timestamp() -> None:
    base = "https://livemakers.test"
    responses = {
        f"{base}/api/pivot-radar": (
            200,
            json.dumps(
                {"timestamp": "2026-08-21T23:00:13Z", "assets": [{"symbol": "BTC"}]}
            ).encode(),
        ),
        f"{base}/api/backtests?asset=BTC&horizon=7D&score_type=overall&threshold=70": (
            200,
            json.dumps({"metrics": {"event_count": 1}}).encode(),
        ),
        f"{base}/ja/turning-points": (200, b"page"),
    }

    with pytest.raises(PublishError, match="radar timestamp"):
        verify_public_production(
            base,
            "2026-08-22T23:00:13Z",
            http_get=_fake_http_getter(responses),
        )


def test_public_smoke_accepts_radar_backtest_and_page() -> None:
    base = "https://livemakers.test"
    expected = "2026-08-22T23:00:13Z"
    responses = {
        f"{base}/api/pivot-radar": (
            200,
            json.dumps(
                {"timestamp": expected, "assets": [{"symbol": "BTC"}]}
            ).encode(),
        ),
        f"{base}/api/backtests?asset=BTC&horizon=7D&score_type=overall&threshold=70": (
            200,
            json.dumps(
                {
                    "asset": "BTC",
                    "horizon": "7D",
                    "score_type": "overall",
                    "threshold": 70,
                    "metrics": {"sample_size": 1},
                }
            ).encode(),
        ),
        f"{base}/ja/turning-points": (
            200,
            "<!doctype html><title>AI ターニングポイント検出ダッシュボード</title>".encode(),
        ),
    }

    verify_public_production(
        base,
        expected,
        http_get=_fake_http_getter(responses),
    )


@pytest.mark.parametrize(
    "backtest,page,reason",
    [
        ({"metrics": {}}, "AI ターニングポイント検出ダッシュボード", "backtest"),
        (
            {
                "asset": "BTC",
                "horizon": "7D",
                "score_type": "overall",
                "threshold": 70,
                "metrics": {"sample_size": 1},
            },
            "generic page",
            "page marker",
        ),
    ],
)
def test_public_smoke_rejects_incomplete_backtest_or_wrong_page(
    backtest: dict, page: str, reason: str
) -> None:
    base = "https://livemakers.test"
    expected = "2026-08-22T23:00:13Z"
    responses = {
        f"{base}/api/pivot-radar": (
            200,
            json.dumps(
                {"timestamp": expected, "assets": [{"symbol": "BTC"}]}
            ).encode(),
        ),
        f"{base}/api/backtests?asset=BTC&horizon=7D&score_type=overall&threshold=70": (
            200,
            json.dumps(backtest).encode(),
        ),
        f"{base}/ja/turning-points": (200, page.encode()),
    }

    with pytest.raises(PublishError, match=reason):
        verify_public_production(
            base,
            expected,
            http_get=_fake_http_getter(responses),
        )


def test_public_smoke_retries_until_alias_serves_expected_timestamp() -> None:
    base = "https://livemakers.test"
    expected = "2026-08-22T23:00:13Z"
    stale = _successful_smoke_responses(base, "2026-08-21T23:00:13Z")
    fresh = _successful_smoke_responses(base, expected)
    attempts = iter([stale, fresh])
    active = {"responses": next(attempts)}

    def http_get(url: str, _timeout: int) -> tuple[int, bytes]:
        response = active["responses"][url]
        if url.endswith("/api/pivot-radar") and active["responses"] is stale:
            active["responses"] = next(attempts)
        return response

    ticks = iter([0.0, 0.1])
    wait_for_public_production(
        base,
        expected,
        timeout_seconds=1,
        poll_interval_seconds=0,
        http_get=http_get,
        sleep=lambda _seconds: None,
        monotonic=lambda: next(ticks),
    )


def test_public_smoke_timeout_preserves_last_error() -> None:
    base = "https://livemakers.test"
    expected = "2026-08-22T23:00:13Z"
    stale = _successful_smoke_responses(base, "2026-08-21T23:00:13Z")
    ticks = iter([0.0, 0.5, 1.1])

    with pytest.raises(PublishError, match="radar timestamp"):
        wait_for_public_production(
            base,
            expected,
            timeout_seconds=1,
            poll_interval_seconds=0,
            http_get=_fake_http_getter(stale),
            sleep=lambda _seconds: None,
            monotonic=lambda: next(ticks),
        )


def test_pr_files_must_be_allowlisted_and_include_public_pair() -> None:
    valid = frozenset(
        {
            Path("data/pivot_assets.live.json"),
            Path("data/pivot_backtest.live.json"),
        }
    )
    _require_pr_files(valid, sidecar_present=False)

    with pytest.raises(PublishError, match="unrelated paths"):
        _require_pr_files(
            valid | {Path("app/page.tsx")},
            sidecar_present=False,
        )
    with pytest.raises(PublishError, match="both public snapshot"):
        _require_pr_files(
            frozenset({Path("data/pivot_assets.live.json")}),
            sidecar_present=False,
        )
    with pytest.raises(PublishError, match="sidecar"):
        _require_pr_files(
            valid | {Path("data/pivot_derivatives_history.live.json")},
            sidecar_present=False,
        )


class _FakeGitHub:
    def __init__(
        self,
        publisher_repo: Path,
        *,
        mismatched_head: bool = False,
        existing_pr: PullRequest | None = None,
    ):
        self.publisher_repo = publisher_repo
        self.mismatched_head = mismatched_head
        self.existing_pr = existing_pr
        self.merge_called = False
        self.create_calls = 0
        self.created: PullRequest | None = None
        self.production_sha: str | None = None
        self.files = frozenset(
            {
                Path("data/pivot_assets.live.json"),
                Path("data/pivot_backtest.live.json"),
                Path("data/pivot_derivatives_history.live.json"),
            }
        )

    def find_pr(self, _branch: str) -> PullRequest | None:
        return self.existing_pr

    def create_pr(
        self,
        _branch: str,
        _generated_at: str,
        _committed_paths: frozenset[Path],
    ) -> PullRequest:
        self.create_calls += 1
        self.files = _committed_paths
        self.created = PullRequest(
            number=42,
            url="https://github.com/sition-jp/livemakers-site/pull/42",
            state="OPEN",
            is_draft=False,
            merge_sha=None,
        )
        return self.created

    def pr_files(self, _number: int) -> frozenset[Path]:
        return self.files

    def wait_for_green(self, _number: int, **_kwargs) -> dict:
        revision = "FETCH_HEAD" if self.existing_pr is not None else "HEAD"
        head = _git(self.publisher_repo, "rev-parse", revision).stdout.strip()
        if self.mismatched_head:
            head = "c" * 40
        return {"headRefOid": head}

    def squash_merge(
        self, _number: int, _generated_at: str, _expected_head: str
    ) -> str:
        self.merge_called = True
        return "b" * 40

    def wait_for_vercel_production(self, merge_sha: str, **_kwargs) -> None:
        self.production_sha = merge_sha

def _successful_smoke_responses(base: str, expected: str) -> dict[str, tuple[int, bytes]]:
    return {
        f"{base}/api/pivot-radar": (
            200,
            json.dumps(
                {"timestamp": expected, "assets": [{"symbol": "BTC"}]}
            ).encode(),
        ),
        f"{base}/api/backtests?asset=BTC&horizon=7D&score_type=overall&threshold=70": (
            200,
            json.dumps(
                {
                    "asset": "BTC",
                    "horizon": "7D",
                    "score_type": "overall",
                    "threshold": 70,
                    "metrics": {"sample_size": 1},
                }
            ).encode(),
        ),
        f"{base}/ja/turning-points": (
            200,
            "<!doctype html><title>AI ターニングポイント検出ダッシュボード</title>".encode(),
        ),
    }


def test_publish_snapshot_runs_push_merge_and_production_smoke(
    tmp_path: Path,
) -> None:
    remote = _init_remote(tmp_path)
    base = "https://livemakers.test"
    config = PublishConfig(
        publisher_repo=tmp_path / "publisher",
        token_file=tmp_path / "unused.env",
        remote_url=str(remote),
        production_base_url=base,
        poll_interval_seconds=0,
    )
    source = tmp_path / "source"
    source.mkdir()
    assets, backtest = _write_public_pair(source)
    sidecar = _write_valid_sidecar(source)
    github = _FakeGitHub(config.publisher_repo)

    outcome = publish_snapshot(
        assets,
        backtest,
        sidecar,
        source_repo=tmp_path,
        config=config,
        github_client=github,
        github_env={},
        zod_validator=lambda *_args: None,
        http_get=_fake_http_getter(_successful_smoke_responses(base, "2026-08-22T23:00:13Z")),
        sleep=lambda _seconds: None,
    )

    assert outcome.state == "published"
    assert outcome.generated_at == "2026-08-22T23:00:13Z"
    assert outcome.pr_url == "https://github.com/sition-jp/livemakers-site/pull/42"
    assert outcome.merge_sha == "b" * 40
    assert github.merge_called is True
    assert github.production_sha == "b" * 40
    branch = "automation/pivots-daily-20260822T230013Z"
    assert _git(
        config.publisher_repo,
        "ls-remote",
        "--heads",
        "origin",
        branch,
    ).stdout == ""


def test_head_sha_change_after_green_prevents_merge(tmp_path: Path) -> None:
    remote = _init_remote(tmp_path)
    base = "https://livemakers.test"
    config = PublishConfig(
        publisher_repo=tmp_path / "publisher",
        token_file=tmp_path / "unused.env",
        remote_url=str(remote),
        production_base_url=base,
        poll_interval_seconds=0,
    )
    source = tmp_path / "source"
    source.mkdir()
    assets, backtest = _write_public_pair(source)
    sidecar = _write_valid_sidecar(source)
    github = _FakeGitHub(config.publisher_repo, mismatched_head=True)

    with pytest.raises(PublishError, match="head SHA changed"):
        publish_snapshot(
            assets,
            backtest,
            sidecar,
            source_repo=tmp_path,
            config=config,
            github_client=github,
            github_env={},
            zod_validator=lambda *_args: None,
            http_get=_fake_http_getter(
                _successful_smoke_responses(base, "2026-08-22T23:00:13Z")
            ),
            sleep=lambda _seconds: None,
        )

    assert github.merge_called is False


def test_publish_snapshot_equal_main_does_not_create_pr(tmp_path: Path) -> None:
    generated_at = "2026-08-21T23:00:13Z"
    remote = _init_remote(tmp_path, generated_at=generated_at)
    base = "https://livemakers.test"
    config = PublishConfig(
        publisher_repo=tmp_path / "publisher",
        token_file=tmp_path / "unused.env",
        remote_url=str(remote),
        production_base_url=base,
        poll_interval_seconds=0,
    )
    source = tmp_path / "source"
    source.mkdir()
    assets, backtest = _write_public_pair(
        source,
        assets_generated_at=generated_at,
    )
    github = _FakeGitHub(config.publisher_repo)

    outcome = publish_snapshot(
        assets,
        backtest,
        None,
        source_repo=tmp_path,
        config=config,
        github_client=github,
        github_env={},
        zod_validator=lambda *_args: None,
        http_get=_fake_http_getter(_successful_smoke_responses(base, generated_at)),
        sleep=lambda _seconds: None,
    )

    assert outcome.state == "already_current"
    assert outcome.generated_at == generated_at
    assert github.create_calls == 0
    assert github.merge_called is False
    assert github.production_sha == outcome.merge_sha


def test_publish_snapshot_equal_timestamp_rejects_different_content(
    tmp_path: Path,
) -> None:
    generated_at = "2026-08-21T23:00:13Z"
    remote = _init_remote(tmp_path, generated_at=generated_at)
    config = _publisher_config(tmp_path, remote)
    source = tmp_path / "source"
    source.mkdir()
    assets, backtest = _write_public_pair(
        source,
        assets_generated_at=generated_at,
    )
    assets.write_text(
        json.dumps({"generated_at": generated_at, "corrected": True}),
        encoding="utf-8",
    )

    with pytest.raises(PublishError, match="same timestamp"):
        publish_snapshot(
            assets,
            backtest,
            None,
            source_repo=tmp_path,
            config=config,
            github_client=_FakeGitHub(config.publisher_repo),
            github_env={},
            zod_validator=lambda *_args: None,
            http_get=lambda *_args: pytest.fail("smoke must not run"),
            sleep=lambda _seconds: None,
        )


def test_publish_snapshot_commits_the_exact_validated_bytes(tmp_path: Path) -> None:
    remote = _init_remote(tmp_path)
    base = "https://livemakers.test"
    config = PublishConfig(
        publisher_repo=tmp_path / "publisher",
        token_file=tmp_path / "unused.env",
        remote_url=str(remote),
        production_base_url=base,
        poll_interval_seconds=0,
    )
    source = tmp_path / "source"
    source.mkdir()
    assets, backtest = _write_public_pair(source)
    original_assets = assets.read_bytes()
    github = _FakeGitHub(config.publisher_repo)
    committed: dict[str, bytes] = {}

    def mutate_original_after_validation(*_args) -> None:
        assets.write_text(
            json.dumps(
                {
                    "generated_at": "2026-08-22T23:00:13Z",
                    "unvalidated": True,
                }
            ),
            encoding="utf-8",
        )

    def capture_merge(_number: int, _generated_at: str, _head: str) -> str:
        committed["assets"] = _git(
            config.publisher_repo,
            "show",
            "HEAD:data/pivot_assets.live.json",
        ).stdout.encode()
        github.merge_called = True
        return "b" * 40

    github.squash_merge = capture_merge  # type: ignore[method-assign]

    publish_snapshot(
        assets,
        backtest,
        None,
        source_repo=tmp_path,
        config=config,
        github_client=github,
        github_env={},
        zod_validator=mutate_original_after_validation,
        http_get=_fake_http_getter(
            _successful_smoke_responses(base, "2026-08-22T23:00:13Z")
        ),
        sleep=lambda _seconds: None,
    )

    assert committed["assets"] == original_assets


def _push_existing_publication_branch(
    source: Path,
    config: PublishConfig,
) -> str:
    assets = source / "pivot_assets.live.json"
    backtest = source / "pivot_backtest.live.json"
    sidecar = source / "pivot_derivatives_history.live.json"
    snapshot = _load_source_snapshot(assets, backtest, sidecar)
    _prepare_publisher_repo(config, env={})
    staged = _stage_snapshot_commit(snapshot, config, env={})
    assert staged.branch is not None
    _git(config.publisher_repo, "push", "-u", "origin", staged.branch)
    return staged.branch


def test_publish_snapshot_resumes_existing_open_pr(tmp_path: Path) -> None:
    remote = _init_remote(tmp_path)
    base = "https://livemakers.test"
    config = PublishConfig(
        publisher_repo=tmp_path / "publisher",
        token_file=tmp_path / "unused.env",
        remote_url=str(remote),
        production_base_url=base,
        poll_interval_seconds=0,
    )
    source = tmp_path / "source"
    source.mkdir()
    assets, backtest = _write_public_pair(source)
    sidecar = _write_valid_sidecar(source)
    branch = _push_existing_publication_branch(source, config)
    existing = PullRequest(
        number=77,
        url="https://github.com/sition-jp/livemakers-site/pull/77",
        state="OPEN",
        is_draft=False,
        merge_sha=None,
    )
    github = _FakeGitHub(config.publisher_repo, existing_pr=existing)

    outcome = publish_snapshot(
        assets,
        backtest,
        sidecar,
        source_repo=tmp_path,
        config=config,
        github_client=github,
        github_env={},
        zod_validator=lambda *_args: None,
        http_get=_fake_http_getter(
            _successful_smoke_responses(base, "2026-08-22T23:00:13Z")
        ),
        sleep=lambda _seconds: None,
    )

    assert outcome.state == "published"
    assert outcome.pr_url == existing.url
    assert github.create_calls == 0
    assert github.merge_called is True
    assert _git(
        config.publisher_repo,
        "ls-remote",
        "--heads",
        "origin",
        branch,
    ).stdout == ""


def test_merged_pr_not_reflected_on_main_fails_closed(tmp_path: Path) -> None:
    remote = _init_remote(tmp_path)
    config = _publisher_config(tmp_path, remote)
    source = tmp_path / "source"
    source.mkdir()
    assets, backtest = _write_public_pair(source)
    sidecar = _write_valid_sidecar(source)
    existing = PullRequest(
        number=77,
        url="https://github.com/sition-jp/livemakers-site/pull/77",
        state="MERGED",
        is_draft=False,
        merge_sha="a" * 40,
    )

    with pytest.raises(PublishError, match="not reflected") as caught:
        publish_snapshot(
            assets,
            backtest,
            sidecar,
            source_repo=tmp_path,
            config=config,
            github_client=_FakeGitHub(
                config.publisher_repo,
                existing_pr=existing,
            ),
            github_env={},
            zod_validator=lambda *_args: None,
            http_get=lambda *_args: pytest.fail("smoke must not run"),
            sleep=lambda _seconds: None,
        )
    assert caught.value.post_merge is True


def test_remote_branch_without_pr_fails_closed(tmp_path: Path) -> None:
    remote = _init_remote(tmp_path)
    base = "https://livemakers.test"
    config = PublishConfig(
        publisher_repo=tmp_path / "publisher",
        token_file=tmp_path / "unused.env",
        remote_url=str(remote),
        production_base_url=base,
        poll_interval_seconds=0,
    )
    source = tmp_path / "source"
    source.mkdir()
    assets, backtest = _write_public_pair(source)
    sidecar = _write_valid_sidecar(source)
    _push_existing_publication_branch(source, config)
    github = _FakeGitHub(config.publisher_repo)

    with pytest.raises(PublishError, match="exists without a PR"):
        publish_snapshot(
            assets,
            backtest,
            sidecar,
            source_repo=tmp_path,
            config=config,
            github_client=github,
            github_env={},
            zod_validator=lambda *_args: None,
            http_get=_fake_http_getter(
                _successful_smoke_responses(base, "2026-08-22T23:00:13Z")
            ),
            sleep=lambda _seconds: None,
        )


def test_publish_snapshot_module_cli_loads_all_helpers() -> None:
    pivots_root = Path(__file__).resolve().parents[1]

    result = subprocess.run(
        [sys.executable, "-m", "ops.publish_snapshot", "--help"],
        cwd=pivots_root,
        check=False,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0
    assert "--publisher-repo" in result.stdout
    assert "--production-base-url" in result.stdout


def test_publisher_cli_marks_post_merge_failure(tmp_path: Path, monkeypatch, capsys) -> None:
    from ops import publish_snapshot as publisher_module

    def fail_after_merge(*_args, **_kwargs):
        raise PublishError("production smoke failed", post_merge=True)

    monkeypatch.setattr(publisher_module, "publish_snapshot", fail_after_merge)
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "publish_snapshot",
            "--assets-path",
            str(tmp_path / "assets.json"),
            "--backtest-path",
            str(tmp_path / "backtest.json"),
            "--derivatives-history-path",
            str(tmp_path / "absent-sidecar.json"),
        ],
    )

    assert publisher_module.main() == 1
    captured = capsys.readouterr()
    assert "phase=post_merge" in captured.err
    assert "production smoke failed" in captured.err
