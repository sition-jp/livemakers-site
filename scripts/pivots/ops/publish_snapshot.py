"""Guarded zero-touch publisher for daily Turning Point snapshots."""
from __future__ import annotations

import json
import os
import re
import shutil
import stat
import subprocess
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal, Mapping, Sequence

from producer.derivatives_sidecar import load_derivatives_history_sidecar


DEFAULT_PUBLISHER_REPO = Path.home() / ".sition_runners" / "livemakers-pivots-publisher"
DEFAULT_TOKEN_FILE = Path.home() / ".sition_secrets" / "github_autopr.env"
DEFAULT_REPOSITORY = "sition-jp/livemakers-site"
DEFAULT_REMOTE_URL = f"https://github.com/{DEFAULT_REPOSITORY}.git"
DEFAULT_PRODUCTION_BASE_URL = "https://livemakers.com"

ASSETS_RELATIVE_PATH = Path("data/pivot_assets.live.json")
BACKTEST_RELATIVE_PATH = Path("data/pivot_backtest.live.json")
SIDECAR_RELATIVE_PATH = Path("data/pivot_derivatives_history.live.json")
ALLOWED_RELATIVE_PATHS = frozenset(
    {ASSETS_RELATIVE_PATH, BACKTEST_RELATIVE_PATH, SIDECAR_RELATIVE_PATH}
)

_TOKEN_PATTERN = re.compile(
    r"^\s*(?:export\s+)?GH_TOKEN\s*=\s*(?:\"([^\"\n]*)\"|'([^'\n]*)'|([^\s]+))\s*$"
)


class PublishError(RuntimeError):
    """A fail-closed publication error safe to surface in ops logs."""


@dataclass(frozen=True)
class PublishConfig:
    publisher_repo: Path = DEFAULT_PUBLISHER_REPO
    token_file: Path = DEFAULT_TOKEN_FILE
    repository: str = DEFAULT_REPOSITORY
    remote_url: str = DEFAULT_REMOTE_URL
    production_base_url: str = DEFAULT_PRODUCTION_BASE_URL
    check_timeout_seconds: int = 1200
    deploy_timeout_seconds: int = 900
    poll_interval_seconds: int = 15


@dataclass(frozen=True)
class PublishOutcome:
    state: Literal["published", "already_current"]
    generated_at: str
    pr_url: str | None = None
    merge_sha: str | None = None


@dataclass(frozen=True)
class SourceSnapshot:
    assets_path: Path
    backtest_path: Path
    sidecar_path: Path | None
    generated_at: str
    generated_at_utc: datetime


@dataclass(frozen=True)
class StagedSnapshot:
    state: Literal["staged", "already_current"]
    generated_at: str
    branch: str | None = None
    commit_sha: str | None = None
    committed_paths: frozenset[Path] = frozenset()


def _safe_command_output(
    stdout: str,
    stderr: str,
    env: Mapping[str, str] | None,
) -> str:
    output = (stderr.strip() or stdout.strip())[:2000]
    token = env.get("GH_TOKEN") if env is not None else None
    if token:
        output = output.replace(token, "[redacted]")
    return output


def _run_command(
    args: Sequence[str],
    *,
    cwd: Path | None = None,
    env: Mapping[str, str] | None = None,
    check: bool = True,
    timeout: int = 600,
) -> subprocess.CompletedProcess[str]:
    try:
        result = subprocess.run(
            list(args),
            cwd=str(cwd) if cwd is not None else None,
            env=dict(env) if env is not None else None,
            check=False,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        raise PublishError(f"command could not run: {args[0]}") from exc
    if check and result.returncode != 0:
        details = _safe_command_output(result.stdout, result.stderr, env)
        suffix = f": {details}" if details else ""
        raise PublishError(
            f"command failed ({args[0]}, rc={result.returncode}){suffix}"
        )
    return result


def _git_status_paths(repo: Path, *, env: Mapping[str, str]) -> set[Path]:
    result = _run_command(
        ["git", "status", "--porcelain=v1", "--untracked-files=all"],
        cwd=repo,
        env=env,
    )
    paths: set[Path] = set()
    for line in result.stdout.splitlines():
        if len(line) < 4 or " -> " in line:
            raise PublishError("publisher clone has an unsupported git status entry")
        raw_path = line[3:]
        if raw_path.startswith('"'):
            raise PublishError("publisher clone has a quoted git path")
        paths.add(Path(raw_path))
    return paths


def _require_clean_publisher_repo(
    repo: Path,
    *,
    env: Mapping[str, str],
) -> None:
    dirty_paths = _git_status_paths(repo, env=env)
    if dirty_paths:
        rendered = ", ".join(str(path) for path in sorted(dirty_paths))
        raise PublishError(f"publisher clone is dirty: {rendered}")


def _prepare_publisher_repo(
    config: PublishConfig,
    *,
    env: Mapping[str, str],
) -> None:
    repo = Path(config.publisher_repo)
    if not repo.exists():
        repo.parent.mkdir(parents=True, exist_ok=True)
        _run_command(
            [
                "git",
                "clone",
                "--origin",
                "origin",
                "--branch",
                "main",
                "--single-branch",
                config.remote_url,
                str(repo),
            ],
            env=env,
        )
    if not (repo / ".git").is_dir():
        raise PublishError("publisher path must be a standalone git clone")

    remote = _run_command(
        ["git", "remote", "get-url", "origin"],
        cwd=repo,
        env=env,
    ).stdout.strip()
    if remote != config.remote_url:
        raise PublishError("publisher clone origin does not match configured remote")

    _require_clean_publisher_repo(repo, env=env)
    _run_command(
        ["git", "fetch", "--prune", "origin", "main"],
        cwd=repo,
        env=env,
    )
    _run_command(
        ["git", "switch", "--detach", "origin/main"],
        cwd=repo,
        env=env,
    )
    _run_command(
        ["git", "config", "user.name", "SITION Automation"],
        cwd=repo,
        env=env,
    )
    _run_command(
        ["git", "config", "user.email", "37253985+sition-jp@users.noreply.github.com"],
        cwd=repo,
        env=env,
    )
    _require_clean_publisher_repo(repo, env=env)


def _publication_branch(generated_at_utc: datetime) -> str:
    suffix = generated_at_utc.astimezone(UTC).strftime("%Y%m%dT%H%M%SZ")
    return f"automation/pivots-daily-{suffix}"


def _stage_snapshot_commit(
    snapshot: SourceSnapshot,
    config: PublishConfig,
    *,
    env: Mapping[str, str],
) -> StagedSnapshot:
    repo = Path(config.publisher_repo)
    _require_clean_publisher_repo(repo, env=env)
    main_snapshot = _load_source_snapshot(
        repo / ASSETS_RELATIVE_PATH,
        repo / BACKTEST_RELATIVE_PATH,
        None,
    )
    if snapshot.generated_at_utc <= main_snapshot.generated_at_utc:
        return StagedSnapshot(
            state="already_current",
            generated_at=main_snapshot.generated_at,
        )

    branch = _publication_branch(snapshot.generated_at_utc)
    local_branch = _run_command(
        ["git", "show-ref", "--verify", "--quiet", f"refs/heads/{branch}"],
        cwd=repo,
        env=env,
        check=False,
    )
    if local_branch.returncode == 0:
        raise PublishError("deterministic publication branch already exists locally")
    if local_branch.returncode not in (0, 1):
        raise PublishError("could not inspect local publication branch")

    _run_command(
        ["git", "switch", "-c", branch, "origin/main"],
        cwd=repo,
        env=env,
    )
    shutil.copyfile(snapshot.assets_path, repo / ASSETS_RELATIVE_PATH)
    shutil.copyfile(snapshot.backtest_path, repo / BACKTEST_RELATIVE_PATH)
    if snapshot.sidecar_path is not None:
        shutil.copyfile(snapshot.sidecar_path, repo / SIDECAR_RELATIVE_PATH)

    changed_paths = _git_status_paths(repo, env=env)
    if not changed_paths.issubset(ALLOWED_RELATIVE_PATHS):
        unexpected = changed_paths - ALLOWED_RELATIVE_PATHS
        rendered = ", ".join(str(path) for path in sorted(unexpected))
        raise PublishError(f"publication diff contains unrelated paths: {rendered}")
    required = {ASSETS_RELATIVE_PATH, BACKTEST_RELATIVE_PATH}
    if not required.issubset(changed_paths):
        raise PublishError("publication diff must change both public snapshot files")

    pathspecs = [str(path) for path in sorted(changed_paths)]
    _run_command(["git", "add", "--", *pathspecs], cwd=repo, env=env)
    commit_message = (
        f"chore(pivots): publish daily snapshot {snapshot.generated_at}\n\n"
        "Generated by the guarded Turning Point zero-touch publisher."
    )
    _run_command(
        [
            "git",
            "commit",
            "--only",
            "-m",
            commit_message,
            "--",
            *pathspecs,
        ],
        cwd=repo,
        env=env,
    )
    committed = _run_command(
        [
            "git",
            "diff-tree",
            "--no-commit-id",
            "--name-only",
            "-r",
            "HEAD",
        ],
        cwd=repo,
        env=env,
    )
    committed_paths = frozenset(
        Path(line) for line in committed.stdout.splitlines() if line
    )
    if committed_paths != frozenset(changed_paths):
        raise PublishError("committed snapshot path set differs from validated diff")
    if not committed_paths.issubset(ALLOWED_RELATIVE_PATHS):
        raise PublishError("committed snapshot contains a non-allowlisted path")

    commit_sha = _run_command(
        ["git", "rev-parse", "HEAD"],
        cwd=repo,
        env=env,
    ).stdout.strip()
    if not re.fullmatch(r"[0-9a-f]{40}", commit_sha):
        raise PublishError("publication commit SHA is invalid")
    return StagedSnapshot(
        state="staged",
        generated_at=snapshot.generated_at,
        branch=branch,
        commit_sha=commit_sha,
        committed_paths=committed_paths,
    )


def _read_json_object(path: Path, *, label: str) -> dict:
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise PublishError(f"{label} JSON unavailable or invalid") from exc
    if not isinstance(raw, dict):
        raise PublishError(f"{label} JSON must be an object")
    return raw


def _parse_generated_at(value: object, *, label: str) -> datetime:
    if not isinstance(value, str) or not value.endswith("Z"):
        raise PublishError(f"{label} requires a UTC generated_at ending in Z")
    try:
        parsed = datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=UTC)
    except ValueError as exc:
        raise PublishError(f"{label} requires a valid UTC generated_at") from exc
    return parsed


def _load_source_snapshot(
    assets_path: Path,
    backtest_path: Path,
    sidecar_path: Path | None,
) -> SourceSnapshot:
    assets_path = Path(assets_path)
    backtest_path = Path(backtest_path)
    sidecar_path = Path(sidecar_path) if sidecar_path is not None else None

    assets = _read_json_object(assets_path, label="assets snapshot")
    backtest = _read_json_object(backtest_path, label="backtest snapshot")
    assets_generated_at = assets.get("generated_at")
    backtest_generated_at = backtest.get("generated_at")
    assets_dt = _parse_generated_at(assets_generated_at, label="assets snapshot")
    backtest_dt = _parse_generated_at(backtest_generated_at, label="backtest snapshot")
    if assets_generated_at != backtest_generated_at or assets_dt != backtest_dt:
        raise PublishError("public snapshot generated_at mismatch")

    if sidecar_path is not None:
        if load_derivatives_history_sidecar(sidecar_path) is None:
            raise PublishError("derivatives sidecar validation failed")

    return SourceSnapshot(
        assets_path=assets_path,
        backtest_path=backtest_path,
        sidecar_path=sidecar_path,
        generated_at=str(assets_generated_at),
        generated_at_utc=assets_dt,
    )


def _load_github_env(
    token_file: Path,
    *,
    base_env: Mapping[str, str] | None = None,
) -> dict[str, str]:
    token_file = Path(token_file)
    try:
        metadata = os.lstat(token_file)
    except OSError as exc:
        raise PublishError("GitHub token file is missing") from exc

    if not stat.S_ISREG(metadata.st_mode) or stat.S_ISLNK(metadata.st_mode):
        raise PublishError("GitHub token file must be a regular non-symlink file")
    if stat.S_IMODE(metadata.st_mode) != 0o600:
        raise PublishError("GitHub token file must use mode 0600")
    if metadata.st_uid != os.getuid():
        raise PublishError("GitHub token file must be owned by the current user")

    values: list[str] = []
    try:
        lines = token_file.read_text(encoding="utf-8").splitlines()
    except OSError as exc:
        raise PublishError("GitHub token file could not be read") from exc

    for line_number, raw_line in enumerate(lines, start=1):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        match = _TOKEN_PATTERN.fullmatch(raw_line)
        if match is None:
            raise PublishError(
                f"unexpected token file entry on line {line_number}"
            )
        value = next((item for item in match.groups() if item is not None), "")
        values.append(value)

    if len(values) != 1 or not values[0]:
        raise PublishError("token file must contain exactly one GH_TOKEN entry")

    env = dict(os.environ if base_env is None else base_env)
    env["GH_TOKEN"] = values[0]
    env["GIT_TERMINAL_PROMPT"] = "0"
    return env
