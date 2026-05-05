"""Alert dispatcher: structured payload + log file + macOS notification.

Telegram is intentionally NOT tested here — v0.1-ops uses log + osascript
only. A clean adapter boundary lets v0.1-live add Telegram without
changing run_daily.py.
"""
from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import patch

import pytest

from ops.alert import AlertPayload, dispatch, format_payload, write_log


def _payload(**overrides) -> AlertPayload:
    base: AlertPayload = {
        "status": "FAILED",
        "timestamp": "2026-05-05T08:00:00Z",
        "error_type": "BinanceFetchError",
        "command": "python -m producer.run_producer",
        "target_paths": ["data/pivot_assets.live.json", "data/pivot_backtest.live.json"],
        "previous_snapshot_preserved": True,
        "orphan_bak_present": False,
        "details": "HTTP 503 from api.binance.com",
    }
    base.update(overrides)
    return base


def test_format_payload_includes_all_required_fields() -> None:
    p = _payload()
    text = format_payload(p)
    assert "FAILED" in text
    assert "BinanceFetchError" in text
    assert "data/pivot_assets.live.json" in text
    assert "previous snapshot preserved" in text.lower()


def test_format_payload_flags_orphan_bak() -> None:
    p = _payload(orphan_bak_present=True, details="Found pivot_assets.live.json.bak")
    text = format_payload(p)
    assert "orphan" in text.lower()


def test_write_log_appends_jsonl(tmp_path: Path) -> None:
    log_file = tmp_path / "ops.log.jsonl"
    write_log(_payload(), log_file)
    write_log(_payload(status="OK"), log_file)
    lines = log_file.read_text().strip().split("\n")
    assert len(lines) == 2
    assert json.loads(lines[0])["status"] == "FAILED"
    assert json.loads(lines[1])["status"] == "OK"


def test_dispatch_writes_log_and_calls_macos_notification(tmp_path: Path) -> None:
    log_file = tmp_path / "ops.log.jsonl"
    with patch("ops.alert._send_macos_notification") as mock_notify:
        dispatch(_payload(), log_file=log_file)
    assert log_file.exists()
    mock_notify.assert_called_once()


def test_dispatch_skips_macos_notification_for_ok_status(tmp_path: Path) -> None:
    """OK runs are logged but should not raise a desktop notification —
    the operator only wants visible alerts on FAILED."""
    log_file = tmp_path / "ops.log.jsonl"
    with patch("ops.alert._send_macos_notification") as mock_notify:
        dispatch(_payload(status="OK"), log_file=log_file)
    mock_notify.assert_not_called()
