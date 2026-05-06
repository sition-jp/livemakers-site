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


# ============================================================================
# Telegram dispatcher (v0.1-live additions)
# ============================================================================

import os
import re
import stat
from urllib import request as _urllib_request
from urllib import parse as _urllib_parse


_SECRETS_PATH = Path.home() / ".sition" / "secrets.env"
_TELEGRAM_BOT_TOKEN_KEY = "TELEGRAM_LIVEMAKERS_BOT_TOKEN"
_TELEGRAM_CHAT_ID_KEY = "TELEGRAM_LIVEMAKERS_CHAT_ID"
_TELEGRAM_TIMEOUT_SECONDS = 10
_TELEGRAM_BYTE_BUDGET = 3500
_OK_DETAILS_CHAR_BUDGET = 500


_KV_PATTERN = re.compile(
    r'^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*"?([^"\n]*)"?\s*$'
)


def _load_telegram_credentials() -> tuple[str, str] | None:
    """Load (token, chat_id) from ~/.sition/secrets.env.

    Returns None on any of:
    - file missing
    - target is a symlink
    - not a regular file
    - perms != 0o600
    - owner uid != current uid
    - either required key is absent
    """
    try:
        st = os.lstat(_SECRETS_PATH)
    except OSError:
        return None
    if stat.S_ISLNK(st.st_mode):
        return None
    if not stat.S_ISREG(st.st_mode):
        return None
    if (st.st_mode & 0o777) != 0o600:
        return None
    if st.st_uid != os.getuid():
        return None

    token: str | None = None
    chat_id: str | None = None
    try:
        with open(_SECRETS_PATH, "r", encoding="utf-8") as fh:
            for raw in fh:
                line = raw.rstrip("\n")
                if not line.strip() or line.lstrip().startswith("#"):
                    continue
                m = _KV_PATTERN.match(line)
                if not m:
                    continue
                key, value = m.group(1), m.group(2)
                if key == _TELEGRAM_BOT_TOKEN_KEY:
                    token = value
                elif key == _TELEGRAM_CHAT_ID_KEY:
                    chat_id = value
    except OSError:
        return None

    if not token or not chat_id:
        return None
    return token, chat_id


def _format_telegram_ok(p: AlertPayload) -> str:
    details = p.get("details", "") or ""
    if len(details) > _OK_DETAILS_CHAR_BUDGET:
        details = details[:_OK_DETAILS_CHAR_BUDGET] + "…(truncated)"
    return f"✅ pivots-ops OK | {p['timestamp']} | {details}"


def _truncate_failed_details(details: str, byte_budget: int = _TELEGRAM_BYTE_BUDGET) -> str:
    """Truncate details so the encoded result fits within byte_budget bytes.

    Uses head/tail preserving truncation. Gates on UTF-8 byte length (not char
    count) so byte-heavy CJK / emoji details under 1500 characters but over the
    byte budget still get truncated.
    """
    # Byte-aware short-circuit: if details already fits, keep as-is.
    if len(details.encode("utf-8")) <= byte_budget:
        return details

    # Pick an initial head/tail that won't overlap. For typical ASCII details
    # this is ~1500 chars; for CJK we'll iteratively shrink below.
    head_tail = min(1500, len(details) // 2)
    truncated = details[:head_tail] + "\n--- truncated ---\n" + details[-head_tail:]

    # Iteratively shrink if bytes still overflow (CJK / emoji-heavy case)
    while len(truncated.encode("utf-8")) > byte_budget and head_tail > 100:
        head_tail = max(100, head_tail - 200)
        truncated = details[:head_tail] + "\n--- truncated ---\n" + details[-head_tail:]

    return truncated


def _format_telegram_failed(p: AlertPayload) -> str:
    bak_line = "ORPHAN .bak present" if p["orphan_bak_present"] else "clean"
    prev_line = "preserved" if p["previous_snapshot_preserved"] else "may be lost"
    details = _truncate_failed_details(p.get("details", "") or "")
    return (
        "🔴 pivots-ops FAILED\n"
        f"time: {p['timestamp']}\n"
        f"type: {p['error_type']}\n"
        f"cmd:  {p['command']}\n"
        f"bak:  {bak_line}\n"
        f"prev: {prev_line}\n"
        "---\n"
        f"{details}"
    )


def _send_telegram(p: AlertPayload, *, notify_ok: bool) -> None:
    """Best-effort Telegram POST. Silent on every failure path.

    Invariant: this function must never affect run_daily's exit code,
    JSONL log, or macOS notification. The token must never appear in
    any log line, exception trace, or stdout/stderr emission.
    """
    if p["status"] == "OK" and not notify_ok:
        return

    creds = _load_telegram_credentials()
    if creds is None:
        return
    token, chat_id = creds

    if p["status"] == "OK":
        text = _format_telegram_ok(p)
    else:
        text = _format_telegram_failed(p)

    try:
        url = f"https://api.telegram.org/bot{token}/sendMessage"
        body = _urllib_parse.urlencode({"chat_id": chat_id, "text": text}).encode("utf-8")
        req = _urllib_request.Request(
            url,
            data=body,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        with _urllib_request.urlopen(req, timeout=_TELEGRAM_TIMEOUT_SECONDS):
            pass
    except Exception:
        # Silent failure invariant: any exception here must not propagate.
        # JSONL log is the durable record; macOS already fired for FAILED.
        # Token must NEVER appear in any captured exception or log line —
        # we drop the exception object without re-raising or logging.
        return


def dispatch(p: AlertPayload, log_file: Path, *, notify_ok: bool = False) -> None:
    write_log(p, log_file)
    if p["status"] == "FAILED":
        _send_macos_notification(
            title="LiveMakersCom pivots producer FAILED",
            body=format_payload(p),
        )
    _send_telegram(p, notify_ok=notify_ok)
