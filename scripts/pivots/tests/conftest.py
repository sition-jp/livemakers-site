"""Shared pytest fixtures for the pivots producer tests."""
from __future__ import annotations

import pytest


@pytest.fixture(autouse=True)
def _no_real_alert_side_effects(monkeypatch, tmp_path):
    """Never reach the real Telegram bot or the macOS notifier from a test.

    ops.alert reads the operator's ~/.sition/secrets.env through a module global.
    On an operator machine that file is real, so any test that drives run_daily /
    dispatch down a FAILED path posted "pivots-ops FAILED" to the LMK Ops chat
    (incident 2026-09-26). This fixture points the secrets path at a file that does
    not exist (both the module global and the PIVOTS_SECRETS_ENV override, so child
    processes inherit it) and no-ops the osascript notifier for every test. Tests that
    need credentials build their own tmp file and monkeypatch ops.alert._SECRETS_PATH
    explicitly, which overrides this fixture.
    """
    import ops.alert as alert

    absent = tmp_path / "no-secrets.env"
    monkeypatch.setenv(alert._SECRETS_PATH_ENV, str(absent))
    monkeypatch.setattr(alert, "_SECRETS_PATH", absent)
    monkeypatch.setattr(alert, "_send_macos_notification", lambda *args, **kwargs: None)
