"""Unit tests for the Telegram dispatcher additions to alert.py."""
from __future__ import annotations

import os
import stat
from pathlib import Path

import pytest


# ----------------------------- format functions -----------------------------

def _payload(**overrides):
    base = {
        "status": "OK",
        "timestamp": "2026-05-06T08:00:30Z",
        "error_type": "",
        "command": "python -m producer.run_producer",
        "target_paths": ["data/pivot_assets.live.json", "data/pivot_backtest.live.json"],
        "previous_snapshot_preserved": True,
        "orphan_bak_present": False,
        "details": "live write + archive + prune complete",
    }
    base.update(overrides)
    return base


def test_format_telegram_ok_single_line():
    from ops.alert import _format_telegram_ok
    msg = _format_telegram_ok(_payload())
    assert msg.startswith("✅ pivots-ops OK")
    assert "2026-05-06T08:00:30Z" in msg
    assert "live write + archive + prune complete" in msg
    assert "\n" not in msg


def test_format_telegram_ok_truncates_long_details():
    from ops.alert import _format_telegram_ok
    long_details = "x" * 800
    msg = _format_telegram_ok(_payload(details=long_details))
    assert "…(truncated)" in msg
    # Original details should not appear in full
    assert long_details not in msg


def test_format_telegram_failed_multiline():
    from ops.alert import _format_telegram_failed
    p = _payload(
        status="FAILED",
        error_type="DryRunFailed",
        details="producer dry-run returned 1",
        previous_snapshot_preserved=True,
        orphan_bak_present=False,
    )
    msg = _format_telegram_failed(p)
    assert msg.startswith("🔴 pivots-ops FAILED")
    assert "DryRunFailed" in msg
    assert "producer dry-run returned 1" in msg
    assert msg.count("\n") >= 5


def test_format_telegram_failed_prev_lost():
    from ops.alert import _format_telegram_failed
    p = _payload(status="FAILED", error_type="LiveWriteFailed", previous_snapshot_preserved=False)
    msg = _format_telegram_failed(p)
    assert "may be lost" in msg


def test_format_telegram_failed_orphan_bak():
    from ops.alert import _format_telegram_failed
    p = _payload(status="FAILED", error_type="LiveWriteFailed", orphan_bak_present=True)
    msg = _format_telegram_failed(p)
    assert "ORPHAN .bak present" in msg


def test_format_telegram_failed_truncates_long_utf8_details():
    from ops.alert import _format_telegram_failed
    # 4000 ASCII chars — within char limits but want to verify truncation kicks in by byte
    long_details = "X" * 4000
    p = _payload(status="FAILED", details=long_details)
    msg = _format_telegram_failed(p)
    assert "--- truncated ---" in msg
    # Encoded bytes should be under 3500 + small prefix headroom
    assert len(msg.encode("utf-8")) <= 3500 + 200


def test_format_telegram_failed_short_details_not_truncated():
    from ops.alert import _format_telegram_failed
    p = _payload(status="FAILED", details="short error")
    msg = _format_telegram_failed(p)
    assert "--- truncated ---" not in msg
    assert "short error" in msg


def test_format_telegram_failed_cjk_truncation_respects_byte_budget():
    """Pathological case: details is all 3-byte UTF-8 CJK characters."""
    from ops.alert import _format_telegram_failed
    long_cjk = "あ" * 4000  # 4000 chars × 3 bytes = 12000 bytes raw
    p = _payload(status="FAILED", details=long_cjk)
    msg = _format_telegram_failed(p)
    # Must fit within Telegram's wire limit even when CJK
    assert len(msg.encode("utf-8")) <= 4096
    # Should still mark truncation
    assert "--- truncated ---" in msg


# --------------------------- _load_telegram_credentials ---------------------------

def _write_secrets(tmp_path: Path, content: str, *, mode: int = 0o600) -> Path:
    p = tmp_path / "secrets.env"
    p.write_text(content)
    p.chmod(mode)
    return p


def test_load_credentials_missing_file(monkeypatch, tmp_path):
    from ops.alert import _load_telegram_credentials
    monkeypatch.setattr("ops.alert._SECRETS_PATH", tmp_path / "absent.env")
    assert _load_telegram_credentials() is None


def test_load_credentials_valid(monkeypatch, tmp_path):
    from ops.alert import _load_telegram_credentials
    secrets = _write_secrets(
        tmp_path,
        'TELEGRAM_LIVEMAKERS_BOT_TOKEN="abc123"\n'
        'TELEGRAM_LIVEMAKERS_CHAT_ID="-100456"\n',
    )
    monkeypatch.setattr("ops.alert._SECRETS_PATH", secrets)
    result = _load_telegram_credentials()
    assert result == ("abc123", "-100456")


def test_load_credentials_perm_too_loose(monkeypatch, tmp_path):
    from ops.alert import _load_telegram_credentials
    secrets = _write_secrets(
        tmp_path,
        'TELEGRAM_LIVEMAKERS_BOT_TOKEN="abc"\nTELEGRAM_LIVEMAKERS_CHAT_ID="-1"\n',
        mode=0o640,
    )
    monkeypatch.setattr("ops.alert._SECRETS_PATH", secrets)
    assert _load_telegram_credentials() is None


def test_load_credentials_symlink_rejected(monkeypatch, tmp_path):
    from ops.alert import _load_telegram_credentials
    real = _write_secrets(
        tmp_path,
        'TELEGRAM_LIVEMAKERS_BOT_TOKEN="abc"\nTELEGRAM_LIVEMAKERS_CHAT_ID="-1"\n',
    )
    link = tmp_path / "link.env"
    link.symlink_to(real)
    monkeypatch.setattr("ops.alert._SECRETS_PATH", link)
    assert _load_telegram_credentials() is None


def test_load_credentials_missing_one_key(monkeypatch, tmp_path):
    from ops.alert import _load_telegram_credentials
    secrets = _write_secrets(tmp_path, 'TELEGRAM_LIVEMAKERS_BOT_TOKEN="abc"\n')
    monkeypatch.setattr("ops.alert._SECRETS_PATH", secrets)
    assert _load_telegram_credentials() is None


def test_load_credentials_export_form(monkeypatch, tmp_path):
    from ops.alert import _load_telegram_credentials
    secrets = _write_secrets(
        tmp_path,
        'export TELEGRAM_LIVEMAKERS_BOT_TOKEN="exp123"\n'
        'export TELEGRAM_LIVEMAKERS_CHAT_ID=-100789\n',
    )
    monkeypatch.setattr("ops.alert._SECRETS_PATH", secrets)
    assert _load_telegram_credentials() == ("exp123", "-100789")


def test_load_credentials_skips_comments_and_blanks(monkeypatch, tmp_path):
    from ops.alert import _load_telegram_credentials
    secrets = _write_secrets(
        tmp_path,
        '# header\n'
        '\n'
        'TELEGRAM_LIVEMAKERS_BOT_TOKEN="abc"\n'
        '# another comment\n'
        'TELEGRAM_LIVEMAKERS_CHAT_ID="-1"\n'
        '\n',
    )
    monkeypatch.setattr("ops.alert._SECRETS_PATH", secrets)
    assert _load_telegram_credentials() == ("abc", "-1")


# --------------------------- _send_telegram + dispatch ---------------------------

class _FakeURLOpen:
    def __init__(self):
        self.calls: list[tuple[str, bytes]] = []

    def __call__(self, request_or_url, data=None, timeout=None):
        url = getattr(request_or_url, "full_url", request_or_url)
        body = data
        if hasattr(request_or_url, "data") and request_or_url.data is not None:
            body = request_or_url.data
        self.calls.append((url, body))

        class _Resp:
            def __enter__(self_inner): return self_inner
            def __exit__(self_inner, *a): pass
            def read(self_inner): return b""
        return _Resp()


def test_send_telegram_ok_skipped_without_notify_ok(monkeypatch, tmp_path):
    from ops.alert import _send_telegram
    fake = _FakeURLOpen()
    monkeypatch.setattr("ops.alert._urllib_request.urlopen", fake)
    monkeypatch.setattr(
        "ops.alert._load_telegram_credentials", lambda: ("tok", "cid")
    )
    payload = _payload(status="OK")
    _send_telegram(payload, notify_ok=False)
    assert fake.calls == []


def test_send_telegram_ok_posts_when_notify_ok(monkeypatch, tmp_path):
    from ops.alert import _send_telegram
    fake = _FakeURLOpen()
    monkeypatch.setattr("ops.alert._urllib_request.urlopen", fake)
    monkeypatch.setattr(
        "ops.alert._load_telegram_credentials", lambda: ("tok", "cid")
    )
    _send_telegram(_payload(status="OK"), notify_ok=True)
    assert len(fake.calls) == 1
    url, body = fake.calls[0]
    assert "bottok/sendMessage" in url


def test_send_telegram_failed_posts_regardless(monkeypatch, tmp_path):
    from ops.alert import _send_telegram
    fake = _FakeURLOpen()
    monkeypatch.setattr("ops.alert._urllib_request.urlopen", fake)
    monkeypatch.setattr(
        "ops.alert._load_telegram_credentials", lambda: ("tok", "cid")
    )
    _send_telegram(_payload(status="FAILED", error_type="X"), notify_ok=False)
    assert len(fake.calls) == 1


def test_send_telegram_no_credentials_skips(monkeypatch):
    from ops.alert import _send_telegram
    fake = _FakeURLOpen()
    monkeypatch.setattr("ops.alert._urllib_request.urlopen", fake)
    monkeypatch.setattr("ops.alert._load_telegram_credentials", lambda: None)
    _send_telegram(_payload(status="FAILED", error_type="X"), notify_ok=True)
    assert fake.calls == []


def test_send_telegram_swallows_urlopen_exception(monkeypatch):
    from ops.alert import _send_telegram

    def _raise(*a, **kw):
        raise RuntimeError("boom")

    monkeypatch.setattr("ops.alert._urllib_request.urlopen", _raise)
    monkeypatch.setattr(
        "ops.alert._load_telegram_credentials", lambda: ("tok", "cid")
    )
    # Must not raise
    _send_telegram(_payload(status="FAILED", error_type="X"), notify_ok=True)


def test_dispatch_ok_no_macos_yes_telegram(monkeypatch, tmp_path):
    from ops import alert
    fake = _FakeURLOpen()
    macos_calls: list[tuple[str, str]] = []
    monkeypatch.setattr(alert._urllib_request, "urlopen", fake)
    monkeypatch.setattr(
        alert,
        "_load_telegram_credentials",
        lambda: ("tok", "cid"),
    )
    monkeypatch.setattr(
        alert,
        "_send_macos_notification",
        lambda title, body: macos_calls.append((title, body)),
    )
    log = tmp_path / "ops.log.jsonl"
    alert.dispatch(_payload(status="OK"), log_file=log, notify_ok=True)
    assert log.exists()
    assert macos_calls == []
    assert len(fake.calls) == 1


def test_dispatch_failed_yes_macos_yes_telegram(monkeypatch, tmp_path):
    from ops import alert
    fake = _FakeURLOpen()
    macos_calls: list[tuple[str, str]] = []
    monkeypatch.setattr(alert._urllib_request, "urlopen", fake)
    monkeypatch.setattr(
        alert,
        "_load_telegram_credentials",
        lambda: ("tok", "cid"),
    )
    monkeypatch.setattr(
        alert,
        "_send_macos_notification",
        lambda title, body: macos_calls.append((title, body)),
    )
    log = tmp_path / "ops.log.jsonl"
    p = _payload(status="FAILED", error_type="DryRunFailed", details="boom")
    alert.dispatch(p, log_file=log, notify_ok=False)
    assert log.exists()
    assert len(macos_calls) == 1
    assert len(fake.calls) == 1
