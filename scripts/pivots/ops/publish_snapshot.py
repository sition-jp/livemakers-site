"""Guarded zero-touch publisher for daily Turning Point snapshots."""
from __future__ import annotations

import json
import os
import re
import stat
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal, Mapping

from producer.derivatives_sidecar import load_derivatives_history_sidecar


DEFAULT_PUBLISHER_REPO = Path.home() / ".sition_runners" / "livemakers-pivots-publisher"
DEFAULT_TOKEN_FILE = Path.home() / ".sition_secrets" / "github_autopr.env"
DEFAULT_REPOSITORY = "sition-jp/livemakers-site"
DEFAULT_PRODUCTION_BASE_URL = "https://livemakers.com"

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
