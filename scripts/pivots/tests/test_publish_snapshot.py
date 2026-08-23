from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path

import pytest

from ops.publish_snapshot import (
    PublishConfig,
    PublishError,
    _load_github_env,
    _load_source_snapshot,
    _prepare_publisher_repo,
    _stage_snapshot_commit,
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


def test_github_env_rejects_wrong_owner(tmp_path: Path, monkeypatch) -> None:
    token_file = tmp_path / "github.env"
    token_file.write_text("GH_TOKEN=unit-secret\n", encoding="utf-8")
    token_file.chmod(0o600)
    real_lstat = os.lstat

    class _StatWithWrongOwner:
        def __init__(self, path: Path):
            stat_result = real_lstat(path)
            self.st_mode = stat_result.st_mode
            self.st_uid = stat_result.st_uid + 1

    monkeypatch.setattr(
        "ops.publish_snapshot.os.lstat",
        lambda path: _StatWithWrongOwner(Path(path)),
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
