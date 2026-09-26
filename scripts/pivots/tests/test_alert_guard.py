"""The autouse conftest guard must keep every test away from real alert side effects."""
from pathlib import Path

import pytest

import ops.alert as alert
import producer.run_producer as run_producer_module
from producer.run_producer import run_producer
from tests.test_run_producer import canned_fetcher  # noqa: F401 -- reused as a fixture


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


class _DummyResponse:
    """Minimal stand-in for the `with urlopen(...) as resp:` context manager."""

    def __enter__(self):
        return self

    def __exit__(self, *exc_info):
        return False


def test_guard_blocks_telegram_and_macos_on_failed_dispatch(tmp_path: Path, monkeypatch) -> None:
    """M7 regression: the previous version of this test stubbed `urlopen` to
    *raise* AssertionError on call, but `_send_telegram`'s own
    `except Exception: return` swallows any exception raised from inside its
    try block -- so even if the credentials guard failed and urlopen really
    was called, the raised AssertionError would be silently absorbed and
    this test could never fail. A recording stub makes "urlopen was never
    called" an explicit, unswallowable assertion: the conftest
    `_no_real_alert_side_effects` fixture points secrets at an absent file,
    so `_load_telegram_credentials()` must return None and `_send_telegram`
    must return before ever reaching `urlopen`."""
    calls = []

    def _record(*args, **kwargs):
        calls.append(args)
        return _DummyResponse()

    monkeypatch.setattr(alert._urllib_request, "urlopen", _record)
    alert.dispatch(_failed_payload(), log_file=tmp_path / "ops.log.jsonl", notify_ok=False)
    assert (tmp_path / "ops.log.jsonl").exists()
    assert calls == []


def test_resolve_secrets_path_honours_env_override(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv(alert._SECRETS_PATH_ENV, str(tmp_path / "elsewhere.env"))
    assert alert._resolve_secrets_path() == tmp_path / "elsewhere.env"
    monkeypatch.delenv(alert._SECRETS_PATH_ENV)
    assert alert._resolve_secrets_path() == Path.home() / ".sition" / "secrets.env"


def test_bulk_http_guard_blocks_default_fetcher(
    tmp_path: Path, canned_fetcher, monkeypatch
) -> None:
    """I3 regression: `run_producer`'s `bulk_http_get` parameter used to
    default-bind `default_http_get_status` at *function definition* time
    (`bulk_http_get=default_http_get_status`), so any test on another
    branch/PR that calls `run_producer(...)` without an explicit
    `bulk_http_get=` kwarg would silently hit the real Binance bulk-history
    endpoints and self-seed the on-disk cache. The parameter now resolves
    its default at *call* time (`bulk_http_get or default_http_get_status`
    inside the function body), so the conftest.py `_no_real_bulk_http`
    autouse fixture -- which patches `default_http_get_status` in both
    `producer.bulk_history` (where it is defined) and `producer.run_producer`
    (which imported the name into its own module namespace) -- catches every
    caller that forgets to inject a fake, present and future.

    This test proves two things: (1) the patched name really does raise when
    called directly, and (2) *omitting* `bulk_http_get` from `run_producer`
    does not crash -- it degrades to the same fail-closed path already
    covered by `test_run_producer_fails_closed_without_bulk_cache` (empty
    bulk cache -> 0% coverage -> `BacktestHistoryError` -> rc=1), because
    `producer.bulk_history.refresh()` catches the guard's AssertionError
    internally and records it as a soft `bulk_history_degraded` marker
    rather than propagating it.
    """
    with pytest.raises(AssertionError, match="real bulk HTTP attempted"):
        run_producer_module.default_http_get_status("https://example")

    # Pin the clock so rc=1 is unambiguously the coverage fail-closed path
    # (empty bulk cache -> 0% coverage), not an unrelated klines-staleness
    # fail-closed path racing against "today". test_run_producer.py pins
    # this at module scope via its own autouse fixture, which does not
    # apply to this file.
    monkeypatch.setattr(run_producer_module, "_now_iso", lambda: "2026-05-04T00:00:00Z")

    rc = run_producer(
        fetcher=canned_fetcher,
        assets_path=tmp_path / "a.json",
        backtest_path=tmp_path / "b.json",
        derivatives_history_path=tmp_path / "s.json",
        dry_run=True,
        skip_zod_validate=True,
        bulk_cache_dir=tmp_path / "empty",
    )
    assert rc == 1
