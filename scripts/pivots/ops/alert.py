"""Alert dispatcher for the daily ops wrapper.

v0.1-ops surfaces:
- log:  JSONL append to scripts/pivots/ops.log.jsonl (or env-overridable path)
- macOS desktop notification via osascript on FAILED status only

Telegram is deliberately omitted from v0.1-ops to avoid coupling
livemakers-site to SITION-cross-repo Telegram credentials. v0.1-live can
add it as a new dispatcher with the same AlertPayload contract.
"""
from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Literal, TypedDict


class AlertPayload(TypedDict):
    status: Literal["OK", "FAILED"]
    timestamp: str  # ISO 8601 UTC
    error_type: str
    command: str
    target_paths: list[str]
    previous_snapshot_preserved: bool
    orphan_bak_present: bool
    details: str


def format_payload(p: AlertPayload) -> str:
    bak_line = (
        " | orphan .bak present (operator must resolve before next run)"
        if p["orphan_bak_present"]
        else ""
    )
    preserved = (
        "previous snapshot preserved"
        if p["previous_snapshot_preserved"]
        else "previous snapshot may have been overwritten"
    )
    return (
        f"[pivots-ops] {p['status']} {p['timestamp']} "
        f"{p['error_type']} during `{p['command']}` "
        f"targets={p['target_paths']} | {preserved}{bak_line} "
        f"| {p['details']}"
    )


def write_log(p: AlertPayload, log_file: Path) -> None:
    log_file = Path(log_file)
    log_file.parent.mkdir(parents=True, exist_ok=True)
    with open(log_file, "a", encoding="utf-8") as fh:
        fh.write(json.dumps(p, ensure_ascii=False) + "\n")


def _send_macos_notification(title: str, body: str) -> None:
    """Best-effort macOS desktop notification. Silent failure — the log file
    is the durable record."""
    safe_body = body.replace('"', '\\"')
    safe_title = title.replace('"', '\\"')
    script = f'display notification "{safe_body}" with title "{safe_title}"'
    try:
        subprocess.run(
            ["osascript", "-e", script], check=False, capture_output=True, timeout=10
        )
    except (OSError, subprocess.SubprocessError):
        pass


def dispatch(p: AlertPayload, log_file: Path) -> None:
    write_log(p, log_file)
    if p["status"] == "FAILED":
        _send_macos_notification(
            title="LiveMakersCom pivots producer FAILED",
            body=format_payload(p),
        )
