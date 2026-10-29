"""Bounded retry on network failures (2026-10-27 DryRunFailed: DNS not ready at 08:00).

Two layers:
1. producer.fetch_binance: one request is retried a couple of times on transient errors.
2. ops.run_daily: a producer step that failed with a network-looking error is re-run
   after a wait (2 / 5 / 10 minutes). Anything else fails immediately as before.
"""
from __future__ import annotations

import json
import socket
import urllib.error
from pathlib import Path
from unittest.mock import patch

import pytest

from ops.run_daily import (
    NETWORK_RETRY_WAITS_SECONDS,
    ProducerInvocation,
    _looks_like_network_failure,
    run_daily,
)
from producer.fetch_binance import FETCH_RETRY_WAITS_SECONDS, get_with_retry, is_transient_network_error

OK = ProducerInvocation(returncode=0, sidecar_warnings=[], output="[pivots-producer] OK generated_at=x")
DNS_FAIL = ProducerInvocation(
    returncode=1,
    sidecar_warnings=[],
    output="[pivots-producer] compose failed: <urlopen error [Errno 8] nodename nor servname provided, or not known>",
)
DATA_FAIL = ProducerInvocation(returncode=1, sidecar_warnings=[], output="[pivots-producer] compose failed: KeyError: 'BTC'")


# --- layer 1: one request -------------------------------------------------------------


def _http_error(code: int) -> urllib.error.HTTPError:
    return urllib.error.HTTPError("https://api.binance.com/x", code, "err", hdrs=None, fp=None)  # type: ignore[arg-type]


@pytest.mark.parametrize(
    "exc",
    [
        urllib.error.URLError(socket.gaierror(8, "nodename nor servname provided, or not known")),
        urllib.error.URLError("timed out"),
        TimeoutError("timed out"),
        ConnectionResetError("reset"),
        _http_error(429),
        _http_error(500),
        _http_error(502),
        _http_error(503),
        _http_error(504),
    ],
)
def test_transient_errors_are_recognised(exc: Exception) -> None:
    assert is_transient_network_error(exc)


@pytest.mark.parametrize("exc", [_http_error(400), _http_error(404), ValueError("bad json"), KeyError("x")])
def test_non_transient_errors_are_not_retried(exc: Exception) -> None:
    assert not is_transient_network_error(exc)


def test_get_with_retry_recovers_after_transient_errors() -> None:
    calls: list[str] = []
    waits: list[float] = []
    errors = [urllib.error.URLError("dns"), _http_error(503)]

    def raw(url: str) -> bytes:
        calls.append(url)
        if errors:
            raise errors.pop(0)
        return b"[]"

    assert get_with_retry("u", raw, sleep=waits.append) == b"[]"
    assert len(calls) == 3
    assert waits == list(FETCH_RETRY_WAITS_SECONDS)


def test_get_with_retry_gives_up_after_bounded_attempts() -> None:
    waits: list[float] = []

    def raw(url: str) -> bytes:
        raise urllib.error.URLError("dns")

    with pytest.raises(urllib.error.URLError):
        get_with_retry("u", raw, sleep=waits.append)
    assert waits == list(FETCH_RETRY_WAITS_SECONDS)


def test_get_with_retry_does_not_retry_a_404() -> None:
    waits: list[float] = []

    def raw(url: str) -> bytes:
        raise _http_error(404)

    with pytest.raises(urllib.error.HTTPError):
        get_with_retry("u", raw, sleep=waits.append)
    assert waits == []


# --- layer 2: the daily run -----------------------------------------------------------


@pytest.mark.parametrize(
    "output",
    [
        DNS_FAIL.output,
        "compose failed: <urlopen error [Errno 61] Connection refused>",
        "compose failed: <urlopen error timed out>",
        "compose failed: The read operation timed out",
        "compose failed: [Errno 54] Connection reset by peer",
        "compose failed: <urlopen error [Errno -3] Temporary failure in name resolution>",
        "compose failed: <urlopen error [Errno 51] Network is unreachable>",
        "compose failed: HTTP Error 503: Service Unavailable",
        "compose failed: HTTP Error 429: Too Many Requests",
    ],
)
def test_network_failures_are_recognised(output: str) -> None:
    assert _looks_like_network_failure(output)


@pytest.mark.parametrize(
    "output",
    [DATA_FAIL.output, "compose failed: HTTP Error 404: Not Found", "zod validation failed", ""],
)
def test_other_failures_are_not_network(output: str) -> None:
    assert not _looks_like_network_failure(output)


@pytest.fixture
def fake_env(tmp_path: Path) -> dict:
    assets = tmp_path / "pivot_assets.live.json"
    backtest = tmp_path / "pivot_backtest.live.json"
    assets.write_text("{}")
    backtest.write_text("{}")
    return {
        "assets_path": assets,
        "backtest_path": backtest,
        "history_dir": tmp_path / "history",
        "log_file": tmp_path / "ops.log.jsonl",
    }


def _entries(log_file: Path) -> list[dict]:
    return [json.loads(line) for line in log_file.read_text().splitlines() if line.strip()]


def test_dry_run_dns_failure_is_retried_and_then_succeeds(fake_env: dict) -> None:
    waits: list[float] = []
    with patch("ops.run_daily._invoke_producer", side_effect=[DNS_FAIL, OK, OK]) as mock_run, \
         patch("ops.run_daily._sleep", side_effect=waits.append):
        rc = run_daily(**fake_env)
    assert rc == 0
    assert mock_run.call_count == 3  # dry fail, dry ok, live ok
    assert waits == [NETWORK_RETRY_WAITS_SECONDS[0]]
    last = _entries(fake_env["log_file"])[-1]
    assert last["status"] == "OK"
    assert "network retry" in last["details"]


def test_dry_run_network_failure_gives_up_after_bounded_retries(fake_env: dict) -> None:
    waits: list[float] = []
    attempts = 1 + len(NETWORK_RETRY_WAITS_SECONDS)
    with patch("ops.run_daily._invoke_producer", side_effect=[DNS_FAIL] * attempts) as mock_run, \
         patch("ops.run_daily._sleep", side_effect=waits.append):
        rc = run_daily(**fake_env)
    assert rc != 0
    assert mock_run.call_count == attempts
    assert waits == list(NETWORK_RETRY_WAITS_SECONDS)
    last = _entries(fake_env["log_file"])[-1]
    assert last["status"] == "FAILED"
    assert last["error_type"] == "DryRunFailed"
    assert f"{attempts} attempts" in last["details"]


def test_non_network_dry_run_failure_is_not_retried(fake_env: dict) -> None:
    waits: list[float] = []
    with patch("ops.run_daily._invoke_producer", side_effect=[DATA_FAIL]) as mock_run, \
         patch("ops.run_daily._sleep", side_effect=waits.append):
        rc = run_daily(**fake_env)
    assert rc != 0
    assert mock_run.call_count == 1
    assert waits == []
    assert _entries(fake_env["log_file"])[-1]["error_type"] == "DryRunFailed"


def test_live_write_network_failure_is_retried(fake_env: dict) -> None:
    waits: list[float] = []
    with patch("ops.run_daily._invoke_producer", side_effect=[OK, DNS_FAIL, OK]) as mock_run, \
         patch("ops.run_daily._sleep", side_effect=waits.append):
        rc = run_daily(**fake_env)
    assert rc == 0
    assert mock_run.call_count == 3
    assert waits == [NETWORK_RETRY_WAITS_SECONDS[0]]
    assert _entries(fake_env["log_file"])[-1]["status"] == "OK"
