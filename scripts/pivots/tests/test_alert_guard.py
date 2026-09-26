"""The autouse conftest guard must keep every test away from real alert side effects."""
from pathlib import Path

import pytest

import ops.alert as alert


def _failed_payload() -> alert.AlertPayload:
    return {
        "status": "FAILED",
        "timestamp": "2026-09-26T00:00:00Z",
        "error_type": "GuardCheck",
        "command": "pytest",
        "target_paths": [],
        "previous_snapshot_preserved": True,
        "orphan_bak_present": False,
        "details": "guard check",
        "pid": 0,
    }


def test_guard_points_secrets_at_absent_file() -> None:
    assert not alert._SECRETS_PATH.exists()
    assert alert._load_telegram_credentials() is None


def test_guard_blocks_telegram_and_macos_on_failed_dispatch(tmp_path: Path, monkeypatch) -> None:
    def _forbidden(*args, **kwargs):
        raise AssertionError("network call attempted during tests")

    monkeypatch.setattr(alert._urllib_request, "urlopen", _forbidden)
    alert.dispatch(_failed_payload(), log_file=tmp_path / "ops.log.jsonl", notify_ok=False)
    assert (tmp_path / "ops.log.jsonl").exists()


def test_resolve_secrets_path_honours_env_override(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv(alert._SECRETS_PATH_ENV, str(tmp_path / "elsewhere.env"))
    assert alert._resolve_secrets_path() == tmp_path / "elsewhere.env"
    monkeypatch.delenv(alert._SECRETS_PATH_ENV)
    assert alert._resolve_secrets_path() == Path.home() / ".sition" / "secrets.env"
