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


@pytest.fixture(autouse=True)
def _no_real_bulk_http(monkeypatch):
    """Never let a test reach the real Binance bulk-history endpoints.

    run_producer's `bulk_http_get` parameter used to default-bind
    `default_http_get_status` at *function definition* time, so any test on
    another branch/PR calling `run_producer(...)` without an explicit
    `bulk_http_get=` kwarg would silently hit the real network and self-seed
    the on-disk bulk cache (cross-PR hazard — see I3 in the tp-bulk-history
    final review). The parameter now resolves its default at *call* time
    (`bulk_http_get or default_http_get_status`), so patching the name here
    is sufficient to catch every caller, present and future, that forgets to
    inject a fake. Two patch targets are required: `producer.bulk_history`
    (where the function is defined) and `producer.run_producer` (which did
    `from producer.bulk_history import default_http_get_status`, binding its
    own module-local name to the same function object at import time).
    """
    import producer.bulk_history as bulk_history
    import producer.run_producer as run_producer_module

    def _forbidden(*args, **kwargs):
        raise AssertionError("real bulk HTTP attempted during tests")

    monkeypatch.setattr(bulk_history, "default_http_get_status", _forbidden)
    monkeypatch.setattr(run_producer_module, "default_http_get_status", _forbidden)
