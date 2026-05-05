"""Daily ops wrapper integration:
1. Run dry-run (zod validator + compose)
2. If dry-run succeeds, run live write
3. If live write succeeds, archive + prune to retention dir
4. Always log; alert on FAILED
"""
from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import patch

import pytest

from ops.run_daily import run_daily


@pytest.fixture
def fake_env(tmp_path: Path) -> dict:
    assets = tmp_path / "data" / "pivot_assets.live.json"
    backtest = tmp_path / "data" / "pivot_backtest.live.json"
    history = tmp_path / "data" / "pivots-history"
    log = tmp_path / "scripts" / "pivots" / "ops.log.jsonl"
    return {
        "assets_path": assets,
        "backtest_path": backtest,
        "history_dir": history,
        "log_file": log,
    }


def test_dry_run_failure_alerts_and_skips_live(fake_env: dict) -> None:
    with patch("ops.run_daily._invoke_producer") as mock_run:
        # Simulate dry-run returning non-zero
        mock_run.return_value = 1
        rc = run_daily(
            assets_path=fake_env["assets_path"],
            backtest_path=fake_env["backtest_path"],
            history_dir=fake_env["history_dir"],
            log_file=fake_env["log_file"],
            keep_history=7,
        )
    assert rc != 0
    # Producer was invoked exactly once (dry-run only — live write skipped).
    assert mock_run.call_count == 1
    # Log written.
    assert fake_env["log_file"].exists()
    entries = [
        json.loads(line) for line in fake_env["log_file"].read_text().splitlines()
    ]
    assert entries[-1]["status"] == "FAILED"
    assert entries[-1]["error_type"] == "DryRunFailed"


def test_live_write_failure_after_dry_run_success_alerts(fake_env: dict) -> None:
    with patch("ops.run_daily._invoke_producer") as mock_run:
        # Dry-run succeeds (0), live write fails (1)
        mock_run.side_effect = [0, 1]
        rc = run_daily(**{
            **fake_env, "keep_history": 7,
        })
    assert rc != 0
    assert mock_run.call_count == 2
    entries = [
        json.loads(line) for line in fake_env["log_file"].read_text().splitlines()
    ]
    assert entries[-1]["error_type"] == "LiveWriteFailed"


def test_full_success_archives_and_prunes(fake_env: dict, tmp_path: Path) -> None:
    # Pre-create the data dir + a bogus existing target so archive() has something to copy.
    fake_env["assets_path"].parent.mkdir(parents=True, exist_ok=True)
    fake_env["assets_path"].write_text('{"schema_version": "v0.1"}')
    fake_env["backtest_path"].write_text('{"schema_version": "v0.1"}')
    with patch("ops.run_daily._invoke_producer") as mock_run:
        mock_run.side_effect = [0, 0]  # both succeed
        rc = run_daily(**{**fake_env, "keep_history": 7})
    assert rc == 0
    # Both targets archived.
    archived = sorted(fake_env["history_dir"].iterdir())
    archived_names = [p.name for p in archived]
    assert any(name.startswith("pivot_assets.live.") for name in archived_names)
    assert any(name.startswith("pivot_backtest.live.") for name in archived_names)


def test_no_macos_notification_on_success(fake_env: dict) -> None:
    fake_env["assets_path"].parent.mkdir(parents=True, exist_ok=True)
    fake_env["assets_path"].write_text('{"schema_version": "v0.1"}')
    fake_env["backtest_path"].write_text('{"schema_version": "v0.1"}')
    with patch("ops.run_daily._invoke_producer", side_effect=[0, 0]), \
         patch("ops.alert._send_macos_notification") as mock_notify:
        rc = run_daily(**{**fake_env, "keep_history": 7})
    assert rc == 0
    mock_notify.assert_not_called()
