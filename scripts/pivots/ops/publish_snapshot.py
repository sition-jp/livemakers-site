"""Guarded zero-touch publisher for daily Turning Point snapshots."""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import stat
import subprocess
import sys
import tempfile
import time
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal, Mapping, Sequence
from urllib import error as urllib_error
from urllib import request as urllib_request

from producer.derivatives_sidecar import load_derivatives_history_sidecar


DEFAULT_PUBLISHER_REPO = Path.home() / ".sition_runners" / "livemakers-pivots-publisher"
DEFAULT_TOKEN_FILE = Path.home() / ".sition_secrets" / "github_autopr.env"
DEFAULT_REPOSITORY = "sition-jp/livemakers-site"
DEFAULT_REMOTE_URL = f"https://github.com/{DEFAULT_REPOSITORY}.git"
DEFAULT_PRODUCTION_BASE_URL = "https://livemakers.com"
REPO_ROOT = Path(__file__).resolve().parents[3]

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

    def __init__(self, message: str, *, post_merge: bool = False):
        super().__init__(message)
        self.post_merge = post_merge


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


@dataclass(frozen=True)
class PullRequest:
    number: int
    url: str
    state: str
    is_draft: bool
    merge_sha: str | None


def _safe_command_output(
    stdout: str,
    stderr: str,
    env: Mapping[str, str] | None,
) -> str:
    output = stderr.strip() or stdout.strip()
    token = env.get("GH_TOKEN") if env is not None else None
    if token:
        output = output.replace(token, "[redacted]")
    return output[:2000]


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


def _git_auth_env(env: Mapping[str, str]) -> dict[str, str]:
    authenticated = dict(env)
    for key in tuple(authenticated):
        if key in {"GIT_CONFIG_COUNT", "GIT_CONFIG_PARAMETERS"} or re.fullmatch(
            r"GIT_CONFIG_(?:KEY|VALUE)_\d+", key
        ):
            authenticated.pop(key)
    authenticated["GIT_CONFIG_COUNT"] = "2"
    authenticated["GIT_CONFIG_KEY_0"] = "credential.https://github.com.helper"
    authenticated["GIT_CONFIG_VALUE_0"] = ""
    authenticated["GIT_CONFIG_KEY_1"] = "credential.https://github.com.helper"
    authenticated["GIT_CONFIG_VALUE_1"] = "!gh auth git-credential"
    return authenticated


def _prepare_publisher_repo(
    config: PublishConfig,
    *,
    env: Mapping[str, str],
) -> None:
    env = _git_auth_env(env)
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

    # Keep authentication scoped to the dedicated clone. The helper reads
    # GH_TOKEN from this process environment; no credential value is persisted.
    credential_key = "credential.https://github.com.helper"
    _run_command(
        ["git", "config", "--local", "--replace-all", credential_key, ""],
        cwd=repo,
        env=env,
    )
    _run_command(
        [
            "git",
            "config",
            "--local",
            "--add",
            credential_key,
            "!gh auth git-credential",
        ],
        cwd=repo,
        env=env,
    )

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


def _assert_snapshot_matches_revision(
    snapshot: SourceSnapshot,
    repo: Path,
    revision: str,
    *,
    env: Mapping[str, str],
    mismatch_message: str,
) -> None:
    comparisons = [
        (snapshot.assets_path, ASSETS_RELATIVE_PATH),
        (snapshot.backtest_path, BACKTEST_RELATIVE_PATH),
    ]
    if snapshot.sidecar_path is not None:
        comparisons.append((snapshot.sidecar_path, SIDECAR_RELATIVE_PATH))
    for source_path, relative_path in comparisons:
        source_oid = _source_blob_oid(repo, source_path, env=env)
        revision_oid = _blob_oid(
            repo,
            f"{revision}:{relative_path}",
            env=env,
        )
        if source_oid != revision_oid:
            raise PublishError(f"{mismatch_message}: {relative_path}")


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
    if snapshot.generated_at_utc < main_snapshot.generated_at_utc:
        return StagedSnapshot(
            state="already_current",
            generated_at=main_snapshot.generated_at,
        )
    if snapshot.generated_at_utc == main_snapshot.generated_at_utc:
        _assert_snapshot_matches_revision(
            snapshot,
            repo,
            "origin/main",
            env=env,
            mismatch_message="same timestamp differs from origin/main",
        )
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
        _run_command(
            ["git", "branch", "-D", branch],
            cwd=repo,
            env=env,
        )
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


def _check_state(item: dict) -> tuple[str | None, str]:
    if item.get("__typename") == "CheckRun":
        name = item.get("name")
        status = str(item.get("status") or "").upper()
        conclusion = str(item.get("conclusion") or "").upper()
        if status != "COMPLETED" or not conclusion:
            return str(name) if name else None, "pending"
        if conclusion == "SUCCESS":
            return str(name) if name else None, "success"
        return str(name) if name else None, "failed"
    if item.get("__typename") == "StatusContext":
        name = item.get("context")
        state = str(item.get("state") or "").upper()
        if state == "SUCCESS":
            return str(name) if name else None, "success"
        if state in {"ERROR", "FAILURE"}:
            return str(name) if name else None, "failed"
        return str(name) if name else None, "pending"
    return None, "pending"


def _evaluate_pr_checks(payload: dict) -> tuple[str, str]:
    if payload.get("state") != "OPEN":
        return "failed", "pull request is not open"
    if payload.get("isDraft") is True:
        return "failed", "pull request is draft"
    mergeable = str(payload.get("mergeable") or "UNKNOWN").upper()
    if mergeable == "CONFLICTING":
        return "failed", "pull request is conflicting"

    observed: dict[str, str] = {}
    rollup = payload.get("statusCheckRollup")
    if isinstance(rollup, list):
        for raw_item in rollup:
            if not isinstance(raw_item, dict):
                continue
            name, state = _check_state(raw_item)
            if name in {"guards", "Vercel"}:
                observed[name] = state

    for required in ("guards", "Vercel"):
        if observed.get(required) == "failed":
            return "failed", f"{required} failed"
    if mergeable != "MERGEABLE":
        return "pending", f"mergeable state is {mergeable.lower()}"
    if all(observed.get(required) == "success" for required in ("guards", "Vercel")):
        return "success", "guards and Vercel are green"
    missing = [
        required
        for required in ("guards", "Vercel")
        if observed.get(required) != "success"
    ]
    return "pending", f"waiting for {', '.join(missing)}"


def _classify_existing_pr(pr: PullRequest) -> Literal["open", "merged"]:
    state = pr.state.upper()
    if state == "OPEN":
        if pr.is_draft:
            raise PublishError("existing publication PR is unexpectedly draft")
        return "open"
    if state == "MERGED" or (state == "CLOSED" and pr.merge_sha):
        if not pr.merge_sha or not re.fullmatch(r"[0-9a-f]{40}", pr.merge_sha):
            raise PublishError("merged publication PR has no valid merge SHA")
        return "merged"
    raise PublishError("existing publication PR was closed without merge")


def _parse_pull_request(payload: dict) -> PullRequest:
    try:
        number = int(payload["number"])
        url = str(payload["url"])
        state = str(payload["state"])
        is_draft = bool(payload["isDraft"])
    except (KeyError, TypeError, ValueError) as exc:
        raise PublishError("GitHub returned an invalid pull request payload") from exc
    merge_commit = payload.get("mergeCommit")
    merge_sha: str | None = None
    if isinstance(merge_commit, dict):
        candidate = merge_commit.get("oid") or merge_commit.get("sha")
        if candidate:
            merge_sha = str(candidate)
    return PullRequest(
        number=number,
        url=url,
        state=state,
        is_draft=is_draft,
        merge_sha=merge_sha,
    )


def _validate_pr_identity(
    payload: dict,
    *,
    config: PublishConfig,
    branch: str,
) -> None:
    expected_owner = config.repository.split("/", maxsplit=1)[0]
    raw_owner = payload.get("headRepositoryOwner")
    owner = raw_owner.get("login") if isinstance(raw_owner, dict) else raw_owner
    if (
        payload.get("baseRefName") != "main"
        or payload.get("headRefName") != branch
        or owner != expected_owner
    ):
        raise PublishError("publication PR identity does not match main and owned branch")


class GitHubClient:
    def __init__(self, config: PublishConfig, *, env: Mapping[str, str]):
        self.config = config
        self.env = dict(env)

    def _json_command(self, args: Sequence[str]) -> object:
        result = _run_command(args, env=self.env)
        try:
            return json.loads(result.stdout)
        except json.JSONDecodeError as exc:
            raise PublishError("GitHub CLI returned invalid JSON") from exc

    def find_pr(self, branch: str) -> PullRequest | None:
        payload = self._json_command(
            [
                "gh",
                "pr",
                "list",
                "--repo",
                self.config.repository,
                "--head",
                branch,
                "--state",
                "all",
                "--limit",
                "10",
                "--json",
                (
                    "number,url,state,isDraft,mergeCommit,baseRefName,"
                    "headRefName,headRepositoryOwner"
                ),
            ]
        )
        if not isinstance(payload, list):
            raise PublishError("GitHub PR lookup returned a non-list payload")
        if len(payload) > 1:
            raise PublishError("multiple publication PRs exist for one branch")
        if not payload:
            return None
        if not isinstance(payload[0], dict):
            raise PublishError("GitHub PR lookup returned an invalid item")
        _validate_pr_identity(payload[0], config=self.config, branch=branch)
        return _parse_pull_request(payload[0])

    def create_pr(
        self,
        branch: str,
        generated_at: str,
        committed_paths: frozenset[Path],
    ) -> PullRequest:
        paths = "\n".join(f"- `{path}`" for path in sorted(committed_paths))
        title = f"chore(pivots): publish daily snapshot {generated_at}"
        body = (
            "Automated data-only publication from the guarded Turning Point "
            "daily runner.\n\n"
            f"Snapshot timestamp: `{generated_at}`\n\n"
            f"Changed paths:\n{paths}\n\n"
            "Merge is permitted only after `guards` and Vercel preview succeed."
        )
        created = _run_command(
            [
                "gh",
                "pr",
                "create",
                "--repo",
                self.config.repository,
                "--base",
                "main",
                "--head",
                branch,
                "--title",
                title,
                "--body",
                body,
            ],
            env=self.env,
        )
        url = created.stdout.strip().splitlines()[-1] if created.stdout.strip() else ""
        if not url.startswith("https://github.com/"):
            raise PublishError("GitHub PR creation returned no canonical URL")
        payload = self._json_command(
            [
                "gh",
                "pr",
                "view",
                url,
                "--repo",
                self.config.repository,
                "--json",
                (
                    "number,url,state,isDraft,mergeCommit,baseRefName,"
                    "headRefName,headRepositoryOwner"
                ),
            ]
        )
        if not isinstance(payload, dict):
            raise PublishError("GitHub PR view returned an invalid payload")
        _validate_pr_identity(payload, config=self.config, branch=branch)
        return _parse_pull_request(payload)

    def _view_pr(self, number: int) -> dict:
        payload = self._json_command(
            [
                "gh",
                "pr",
                "view",
                str(number),
                "--repo",
                self.config.repository,
                "--json",
                "state,isDraft,mergeable,statusCheckRollup,headRefOid",
            ]
        )
        if not isinstance(payload, dict):
            raise PublishError("GitHub check view returned an invalid payload")
        return payload

    def wait_for_green(
        self,
        number: int,
        *,
        timeout_seconds: int,
        poll_interval_seconds: int,
        sleep: Callable[[float], None] = time.sleep,
        monotonic: Callable[[], float] = time.monotonic,
    ) -> dict:
        deadline = monotonic() + timeout_seconds
        while True:
            payload = self._view_pr(number)
            state, details = _evaluate_pr_checks(payload)
            if state == "success":
                return payload
            if state == "failed":
                raise PublishError(f"publication PR checks failed: {details}")
            if monotonic() >= deadline:
                raise PublishError(f"publication PR checks timed out: {details}")
            sleep(poll_interval_seconds)

    def squash_merge(
        self,
        number: int,
        generated_at: str,
        expected_head: str,
    ) -> str:
        payload = self._json_command(
            [
                "gh",
                "api",
                "--method",
                "PUT",
                f"repos/{self.config.repository}/pulls/{number}/merge",
                "-f",
                "merge_method=squash",
                "-f",
                f"commit_title=chore(pivots): publish daily snapshot {generated_at}",
                "-f",
                f"sha={expected_head}",
            ]
        )
        if not isinstance(payload, dict):
            raise PublishError("GitHub merge API returned an invalid payload")
        sha = payload.get("sha")
        if payload.get("merged") is not True or not isinstance(sha, str):
            raise PublishError("GitHub merge API rejected publication")
        if not re.fullmatch(r"[0-9a-f]{40}", sha):
            raise PublishError("GitHub merge API returned an invalid SHA")
        return sha

    def pr_files(self, number: int) -> frozenset[Path]:
        payload = self._json_command(
            [
                "gh",
                "pr",
                "view",
                str(number),
                "--repo",
                self.config.repository,
                "--json",
                "files",
            ]
        )
        if not isinstance(payload, dict) or not isinstance(payload.get("files"), list):
            raise PublishError("GitHub PR files returned an invalid payload")
        files: set[Path] = set()
        for item in payload["files"]:
            if not isinstance(item, dict) or not isinstance(item.get("path"), str):
                raise PublishError("GitHub PR files contained an invalid item")
            files.add(Path(item["path"]))
        return frozenset(files)

    def _commit_status(self, merge_sha: str) -> dict:
        payload = self._json_command(
            [
                "gh",
                "api",
                f"repos/{self.config.repository}/commits/{merge_sha}/status",
            ]
        )
        if not isinstance(payload, dict):
            raise PublishError("GitHub commit status returned an invalid payload")
        return payload

    def wait_for_vercel_production(
        self,
        merge_sha: str,
        *,
        timeout_seconds: int,
        poll_interval_seconds: int,
        sleep: Callable[[float], None] = time.sleep,
        monotonic: Callable[[], float] = time.monotonic,
    ) -> None:
        deadline = monotonic() + timeout_seconds
        while True:
            state, details = _evaluate_vercel_status(self._commit_status(merge_sha))
            if state == "success":
                return
            if state == "failed":
                raise PublishError(f"Vercel production failed: {details}")
            if monotonic() >= deadline:
                raise PublishError(f"Vercel production timed out: {details}")
            sleep(poll_interval_seconds)

def _evaluate_vercel_status(payload: dict) -> tuple[str, str]:
    statuses = payload.get("statuses")
    if not isinstance(statuses, list):
        return "pending", "Vercel status is absent"
    for raw in statuses:
        if not isinstance(raw, dict) or raw.get("context") != "Vercel":
            continue
        state = str(raw.get("state") or "").lower()
        if state == "success":
            return "success", "Vercel production is green"
        if state in {"failure", "error"}:
            return "failed", f"Vercel status is {state}"
        return "pending", f"Vercel status is {state or 'pending'}"
    return "pending", "Vercel status is absent"


def _default_http_get(url: str, timeout: int) -> tuple[int, bytes]:
    req = urllib_request.Request(
        url,
        headers={"User-Agent": "sition-turning-points-publisher/1.0"},
    )
    try:
        with urllib_request.urlopen(req, timeout=timeout) as response:
            return int(response.status), response.read()
    except urllib_error.HTTPError as exc:
        return int(exc.code), exc.read()
    except (OSError, urllib_error.URLError) as exc:
        raise PublishError("production smoke request failed") from exc


def _decode_json_response(body: bytes, *, label: str) -> dict:
    try:
        payload = json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise PublishError(f"{label} returned invalid JSON") from exc
    if not isinstance(payload, dict):
        raise PublishError(f"{label} returned a non-object payload")
    return payload


def verify_public_production(
    production_base_url: str,
    expected_generated_at: str,
    *,
    http_get: Callable[[str, int], tuple[int, bytes]] = _default_http_get,
) -> None:
    base = production_base_url.rstrip("/")
    radar_url = f"{base}/api/pivot-radar"
    backtest_url = (
        f"{base}/api/backtests?asset=BTC&horizon=7D&score_type=overall&threshold=70"
    )
    page_url = f"{base}/ja/turning-points"

    radar_status, radar_body = http_get(radar_url, 20)
    if radar_status != 200:
        raise PublishError(f"production radar returned HTTP {radar_status}")
    radar = _decode_json_response(radar_body, label="production radar")
    if radar.get("timestamp") != expected_generated_at:
        raise PublishError("production radar timestamp does not match publication")
    if not isinstance(radar.get("assets"), list) or not radar["assets"]:
        raise PublishError("production radar returned no assets")

    backtest_status, backtest_body = http_get(backtest_url, 20)
    if backtest_status != 200:
        raise PublishError(f"production backtest returned HTTP {backtest_status}")
    backtest = _decode_json_response(backtest_body, label="production backtest")
    metrics = backtest.get("metrics")
    if (
        backtest.get("asset") != "BTC"
        or backtest.get("horizon") != "7D"
        or backtest.get("score_type") != "overall"
        or backtest.get("threshold") != 70
        or not isinstance(metrics, dict)
        or not metrics
        or not isinstance(metrics.get("sample_size"), int)
        or isinstance(metrics.get("sample_size"), bool)
    ):
        raise PublishError("production backtest response is incomplete")

    page_status, page_body = http_get(page_url, 20)
    if page_status != 200 or not page_body:
        raise PublishError(f"production Turning Point page returned HTTP {page_status}")
    try:
        page_text = page_body.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise PublishError("production Turning Point page marker is invalid") from exc
    if "AI ターニングポイント検出ダッシュボード" not in page_text:
        raise PublishError("production Turning Point page marker is absent")


def wait_for_public_production(
    production_base_url: str,
    expected_generated_at: str,
    *,
    timeout_seconds: int,
    poll_interval_seconds: int,
    http_get: Callable[[str, int], tuple[int, bytes]] = _default_http_get,
    sleep: Callable[[float], None] = time.sleep,
    monotonic: Callable[[], float] = time.monotonic,
) -> None:
    deadline = monotonic() + timeout_seconds
    while True:
        try:
            verify_public_production(
                production_base_url,
                expected_generated_at,
                http_get=http_get,
            )
            return
        except PublishError as exc:
            if monotonic() >= deadline:
                raise exc
            sleep(poll_interval_seconds)


def _require_pr_files(
    files: frozenset[Path],
    *,
    sidecar_present: bool,
) -> None:
    allowed = {ASSETS_RELATIVE_PATH, BACKTEST_RELATIVE_PATH}
    if sidecar_present:
        allowed.add(SIDECAR_RELATIVE_PATH)
    if not files.issubset(allowed):
        unexpected = files - allowed
        rendered = ", ".join(str(path) for path in sorted(unexpected))
        if SIDECAR_RELATIVE_PATH in unexpected:
            raise PublishError("publication PR contains sidecar without source evidence")
        raise PublishError(f"publication PR contains unrelated paths: {rendered}")
    public_pair = {ASSETS_RELATIVE_PATH, BACKTEST_RELATIVE_PATH}
    if not public_pair.issubset(files):
        raise PublishError("publication PR must contain both public snapshot files")


def _remote_branch_exists(
    repo: Path,
    branch: str,
    *,
    env: Mapping[str, str],
) -> bool:
    result = _run_command(
        ["git", "ls-remote", "--exit-code", "--heads", "origin", branch],
        cwd=repo,
        env=env,
        check=False,
    )
    if result.returncode == 0:
        return True
    if result.returncode == 2:
        return False
    details = _safe_command_output(result.stdout, result.stderr, env)
    suffix = f": {details}" if details else ""
    raise PublishError(f"remote publication branch lookup failed{suffix}")


def _push_publication_branch(
    repo: Path,
    branch: str,
    *,
    env: Mapping[str, str],
) -> None:
    _run_command(
        ["git", "push", "-u", "origin", branch],
        cwd=repo,
        env=env,
    )


def _blob_oid(
    repo: Path,
    revision_and_path: str,
    *,
    env: Mapping[str, str],
) -> str:
    oid = _run_command(
        ["git", "rev-parse", revision_and_path],
        cwd=repo,
        env=env,
    ).stdout.strip()
    if not re.fullmatch(r"[0-9a-f]{40}", oid):
        raise PublishError("remote publication blob SHA is invalid")
    return oid


def _source_blob_oid(
    repo: Path,
    source_path: Path,
    *,
    env: Mapping[str, str],
) -> str:
    oid = _run_command(
        ["git", "hash-object", str(source_path)],
        cwd=repo,
        env=env,
    ).stdout.strip()
    if not re.fullmatch(r"[0-9a-f]{40}", oid):
        raise PublishError("source publication blob SHA is invalid")
    return oid


def _verify_remote_branch_snapshot(
    snapshot: SourceSnapshot,
    repo: Path,
    branch: str,
    *,
    env: Mapping[str, str],
) -> str:
    _run_command(
        ["git", "fetch", "origin", branch],
        cwd=repo,
        env=env,
    )
    commit_sha = _run_command(
        ["git", "rev-parse", "FETCH_HEAD"],
        cwd=repo,
        env=env,
    ).stdout.strip()
    if not re.fullmatch(r"[0-9a-f]{40}", commit_sha):
        raise PublishError("remote publication branch SHA is invalid")

    comparisons = [
        (snapshot.assets_path, ASSETS_RELATIVE_PATH),
        (snapshot.backtest_path, BACKTEST_RELATIVE_PATH),
    ]
    if snapshot.sidecar_path is not None:
        comparisons.append((snapshot.sidecar_path, SIDECAR_RELATIVE_PATH))
    for source_path, relative_path in comparisons:
        source_oid = _source_blob_oid(repo, source_path, env=env)
        remote_oid = _blob_oid(repo, f"FETCH_HEAD:{relative_path}", env=env)
        if source_oid != remote_oid:
            raise PublishError(f"remote publication branch differs at {relative_path}")
    return commit_sha


def _run_zod_validation(snapshot: SourceSnapshot, source_repo: Path) -> None:
    vitest = source_repo / "node_modules" / ".bin" / "vitest"
    if not vitest.is_file() or not os.access(vitest, os.X_OK):
        raise PublishError("source repo Vitest binary is unavailable")
    env = dict(os.environ)
    env["PIVOTS_ASSETS_PATH"] = str(snapshot.assets_path)
    env["PIVOTS_BACKTEST_PATH"] = str(snapshot.backtest_path)
    _run_command(
        [
            str(vitest),
            "run",
            "tests/pivots/output-snapshot-zod.validate.test.ts",
        ],
        cwd=source_repo,
        env=env,
        timeout=600,
    )


def _cleanup_publication_branch(
    repo: Path,
    branch: str,
    *,
    env: Mapping[str, str],
) -> None:
    _run_command(
        ["git", "push", "origin", "--delete", branch],
        cwd=repo,
        env=env,
    )
    _run_command(
        ["git", "fetch", "origin", "main"],
        cwd=repo,
        env=env,
    )
    _run_command(
        ["git", "switch", "--detach", "origin/main"],
        cwd=repo,
        env=env,
    )
    result = _run_command(
        ["git", "show-ref", "--verify", "--quiet", f"refs/heads/{branch}"],
        cwd=repo,
        env=env,
        check=False,
    )
    if result.returncode == 0:
        _run_command(["git", "branch", "-D", branch], cwd=repo, env=env)
    elif result.returncode != 1:
        raise PublishError("could not inspect local publication branch for cleanup")


def _production_finish(
    client: GitHubClient,
    config: PublishConfig,
    merge_sha: str,
    generated_at: str,
    *,
    http_get: Callable[[str, int], tuple[int, bytes]],
    sleep: Callable[[float], None],
) -> None:
    client.wait_for_vercel_production(
        merge_sha,
        timeout_seconds=config.deploy_timeout_seconds,
        poll_interval_seconds=config.poll_interval_seconds,
        sleep=sleep,
    )
    wait_for_public_production(
        config.production_base_url,
        generated_at,
        timeout_seconds=config.deploy_timeout_seconds,
        poll_interval_seconds=config.poll_interval_seconds,
        http_get=http_get,
        sleep=sleep,
    )


def _freeze_source_snapshot(
    assets_path: Path,
    backtest_path: Path,
    sidecar_path: Path | None,
    frozen_root: Path,
) -> SourceSnapshot:
    frozen_assets = frozen_root / ASSETS_RELATIVE_PATH.name
    frozen_backtest = frozen_root / BACKTEST_RELATIVE_PATH.name
    shutil.copyfile(assets_path, frozen_assets)
    shutil.copyfile(backtest_path, frozen_backtest)
    frozen_sidecar: Path | None = None
    if sidecar_path is not None:
        frozen_sidecar = frozen_root / SIDECAR_RELATIVE_PATH.name
        shutil.copyfile(sidecar_path, frozen_sidecar)
    return _load_source_snapshot(
        frozen_assets,
        frozen_backtest,
        frozen_sidecar,
    )


def publish_snapshot(
    assets_path: Path,
    backtest_path: Path,
    sidecar_path: Path | None,
    *,
    source_repo: Path = REPO_ROOT,
    config: PublishConfig = PublishConfig(),
    github_client: GitHubClient | None = None,
    github_env: Mapping[str, str] | None = None,
    zod_validator: Callable[[SourceSnapshot, Path], None] = _run_zod_validation,
    http_get: Callable[[str, int], tuple[int, bytes]] = _default_http_get,
    sleep: Callable[[float], None] = time.sleep,
) -> PublishOutcome:
    with tempfile.TemporaryDirectory(prefix="pivots-publish-") as directory:
        snapshot = _freeze_source_snapshot(
            Path(assets_path),
            Path(backtest_path),
            Path(sidecar_path) if sidecar_path is not None else None,
            Path(directory),
        )
        return _publish_frozen_snapshot(
            snapshot,
            source_repo=source_repo,
            config=config,
            github_client=github_client,
            github_env=github_env,
            zod_validator=zod_validator,
            http_get=http_get,
            sleep=sleep,
        )


def _publish_frozen_snapshot(
    snapshot: SourceSnapshot,
    *,
    source_repo: Path,
    config: PublishConfig,
    github_client: GitHubClient | None,
    github_env: Mapping[str, str] | None,
    zod_validator: Callable[[SourceSnapshot, Path], None],
    http_get: Callable[[str, int], tuple[int, bytes]],
    sleep: Callable[[float], None],
) -> PublishOutcome:
    source_repo = Path(source_repo)
    zod_validator(snapshot, source_repo)

    env = (
        dict(github_env)
        if github_env is not None
        else _load_github_env(config.token_file)
    )
    env = _git_auth_env(env)
    _prepare_publisher_repo(config, env=env)
    repo = Path(config.publisher_repo)
    main_snapshot = _load_source_snapshot(
        repo / ASSETS_RELATIVE_PATH,
        repo / BACKTEST_RELATIVE_PATH,
        None,
    )
    client = github_client or GitHubClient(config, env=env)

    if snapshot.generated_at_utc < main_snapshot.generated_at_utc:
        main_sha = _run_command(
            ["git", "rev-parse", "origin/main"],
            cwd=repo,
            env=env,
        ).stdout.strip()
        if not re.fullmatch(r"[0-9a-f]{40}", main_sha):
            raise PublishError("origin/main SHA is invalid")
        _production_finish(
            client,
            config,
            main_sha,
            main_snapshot.generated_at,
            http_get=http_get,
            sleep=sleep,
        )
        return PublishOutcome(
            state="already_current",
            generated_at=main_snapshot.generated_at,
            merge_sha=main_sha,
        )
    if snapshot.generated_at_utc == main_snapshot.generated_at_utc:
        _assert_snapshot_matches_revision(
            snapshot,
            repo,
            "origin/main",
            env=env,
            mismatch_message="same timestamp differs from origin/main",
        )
        main_sha = _run_command(
            ["git", "rev-parse", "origin/main"],
            cwd=repo,
            env=env,
        ).stdout.strip()
        if not re.fullmatch(r"[0-9a-f]{40}", main_sha):
            raise PublishError("origin/main SHA is invalid")
        _production_finish(
            client,
            config,
            main_sha,
            main_snapshot.generated_at,
            http_get=http_get,
            sleep=sleep,
        )
        return PublishOutcome(
            state="already_current",
            generated_at=main_snapshot.generated_at,
            merge_sha=main_sha,
        )

    branch = _publication_branch(snapshot.generated_at_utc)
    existing_pr = client.find_pr(branch)
    expected_head: str
    if existing_pr is None:
        if _remote_branch_exists(repo, branch, env=env):
            raise PublishError("remote publication branch exists without a PR")
        staged = _stage_snapshot_commit(snapshot, config, env=env)
        if staged.state != "staged" or not staged.branch or not staged.commit_sha:
            raise PublishError("publisher did not create the expected data commit")
        _push_publication_branch(repo, staged.branch, env=env)
        expected_head = staged.commit_sha
        pr = client.create_pr(
            staged.branch,
            staged.generated_at,
            staged.committed_paths,
        )
    else:
        classification = _classify_existing_pr(existing_pr)
        if classification == "merged":
            raise PublishError(
                "merged publication PR is not reflected on fetched origin/main",
                post_merge=True,
            )
        expected_head = _verify_remote_branch_snapshot(
            snapshot,
            repo,
            branch,
            env=env,
        )
        pr = existing_pr

    _require_pr_files(
        client.pr_files(pr.number),
        sidecar_present=snapshot.sidecar_path is not None,
    )
    green_payload = client.wait_for_green(
        pr.number,
        timeout_seconds=config.check_timeout_seconds,
        poll_interval_seconds=config.poll_interval_seconds,
        sleep=sleep,
    )
    head_oid = green_payload.get("headRefOid")
    if head_oid != expected_head:
        raise PublishError("publication PR head SHA changed after validation")
    _require_pr_files(
        client.pr_files(pr.number),
        sidecar_present=snapshot.sidecar_path is not None,
    )
    try:
        merge_sha = client.squash_merge(
            pr.number,
            snapshot.generated_at,
            expected_head,
        )
    except PublishError as exc:
        raise PublishError(
            f"merge outcome requires reconciliation: {exc}",
            post_merge=True,
        ) from exc
    try:
        _production_finish(
            client,
            config,
            merge_sha,
            snapshot.generated_at,
            http_get=http_get,
            sleep=sleep,
        )
    except PublishError as exc:
        raise PublishError(
            f"post-merge production verification failed for {merge_sha}: {exc}",
            post_merge=True,
        ) from exc

    try:
        _cleanup_publication_branch(repo, branch, env=env)
    except PublishError:
        print(
            "[pivots-publisher] WARN publication completed; branch cleanup pending",
            file=sys.stderr,
        )
    return PublishOutcome(
        state="published",
        generated_at=snapshot.generated_at,
        pr_url=pr.url,
        merge_sha=merge_sha,
    )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Publish a guarded Turning Point daily snapshot to production"
    )
    parser.add_argument(
        "--assets-path",
        type=Path,
        default=REPO_ROOT / ASSETS_RELATIVE_PATH,
    )
    parser.add_argument(
        "--backtest-path",
        type=Path,
        default=REPO_ROOT / BACKTEST_RELATIVE_PATH,
    )
    parser.add_argument(
        "--derivatives-history-path",
        type=Path,
        default=REPO_ROOT / SIDECAR_RELATIVE_PATH,
    )
    parser.add_argument("--source-repo", type=Path, default=REPO_ROOT)
    parser.add_argument("--publisher-repo", type=Path, default=DEFAULT_PUBLISHER_REPO)
    parser.add_argument("--token-file", type=Path, default=DEFAULT_TOKEN_FILE)
    parser.add_argument("--repository", default=DEFAULT_REPOSITORY)
    parser.add_argument("--production-base-url", default=DEFAULT_PRODUCTION_BASE_URL)
    args = parser.parse_args()

    sidecar_path = (
        args.derivatives_history_path
        if args.derivatives_history_path.exists()
        else None
    )
    config = PublishConfig(
        publisher_repo=args.publisher_repo,
        token_file=args.token_file,
        repository=args.repository,
        remote_url=f"https://github.com/{args.repository}.git",
        production_base_url=args.production_base_url,
    )
    try:
        outcome = publish_snapshot(
            args.assets_path,
            args.backtest_path,
            sidecar_path,
            source_repo=args.source_repo,
            config=config,
        )
    except PublishError as exc:
        phase = "post_merge" if exc.post_merge else "pre_merge"
        print(f"[pivots-publisher] FAILED phase={phase} {exc}", file=sys.stderr)
        return 1
    print(
        json.dumps(
            {
                "state": outcome.state,
                "generated_at": outcome.generated_at,
                "pr_url": outcome.pr_url,
                "merge_sha": outcome.merge_sha,
            },
            sort_keys=True,
        )
    )
    return 0


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
    flags = os.O_RDONLY | getattr(os, "O_CLOEXEC", 0) | getattr(os, "O_NOFOLLOW", 0)
    try:
        descriptor = os.open(token_file, flags)
    except FileNotFoundError as exc:
        raise PublishError("GitHub token file is missing") from exc
    except OSError as exc:
        raise PublishError("GitHub token file must be a regular non-symlink file") from exc

    try:
        with os.fdopen(descriptor, "r", encoding="utf-8") as handle:
            metadata = os.fstat(handle.fileno())
            if not stat.S_ISREG(metadata.st_mode):
                raise PublishError(
                    "GitHub token file must be a regular non-symlink file"
                )
            if stat.S_IMODE(metadata.st_mode) != 0o600:
                raise PublishError("GitHub token file must use mode 0600")
            if metadata.st_uid != os.getuid():
                raise PublishError(
                    "GitHub token file must be owned by the current user"
                )
            lines = handle.read().splitlines()
    except UnicodeDecodeError as exc:
        raise PublishError("GitHub token file must be valid UTF-8") from exc

    values: list[str] = []
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


if __name__ == "__main__":
    sys.exit(main())
