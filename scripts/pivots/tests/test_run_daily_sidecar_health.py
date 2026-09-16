"""Persistent sidecar failures must reach the real alert dispatcher, offline."""
import json
import subprocess
from contextlib import nullcontext
from pathlib import Path

import pytest

from ops import alert, run_daily as rd
from ops.publish_snapshot import PublishError, _load_source_snapshot


@pytest.fixture
def pipeline(tmp_path, monkeypatch):
    paths = {
        "assets_path": tmp_path / "assets.json",
        "backtest_path": tmp_path / "backtest.json",
        "derivatives_history_path": tmp_path / "sidecar.json",
        "history_dir": tmp_path / "history",
        "log_file": tmp_path / "ops.jsonl",
        "keep_history": 7,
    }
    for key in ("assets_path", "backtest_path"):
        paths[key].write_text('{"generated_at":"2026-09-15T23:00:00Z"}')
    paths["derivatives_history_path"].write_bytes(b"{damaged history")
    events = {"archives": [], "prunes": [], "macos": [], "telegram": [], "publisher": []}
    monkeypatch.setattr(rd, "REPO_ROOT", tmp_path)
    monkeypatch.setattr(rd, "acquire_lock", lambda _: nullcontext())
    monkeypatch.setattr(rd, "archive", lambda path, *_: events["archives"].append(path))
    monkeypatch.setattr(rd, "prune", lambda _, prefix, **kw: events["prunes"].append(prefix))
    monkeypatch.setattr(rd.subprocess, "run", lambda cmd, **kw: subprocess.CompletedProcess(
        cmd, 0, stdout="", stderr="",
    ))
    monkeypatch.setattr(alert, "_send_macos_notification", lambda **kw: events["macos"].append(kw))
    monkeypatch.setattr(alert, "_load_telegram_credentials", lambda: ("test-token", "test-chat"))

    def offline_send(request, **kwargs):
        events["telegram"].append(request.data)
        return nullcontext()

    monkeypatch.setattr(alert._urllib_request, "urlopen", offline_send)
    return paths, events


def _producer(monkeypatch, *, dry=(), live=()):
    def invoke(args):
        warnings = list(dry if "--dry-run" in args else live)
        output = "\n".join(f"sidecar_degraded={warning}" for warning in warnings)
        return rd.ProducerInvocation(0, rd._parse_sidecar_warnings(output), output)

    monkeypatch.setattr(rd, "_invoke_producer", invoke)


@pytest.mark.parametrize("warning", [
    "SidecarValidationError: assets.BTC.history[0]: invalid sample_count",
    "SidecarOrphanBak: sidecar.json.bak",
])
@pytest.mark.parametrize("notify_ok", [False, True])
@pytest.mark.parametrize("publication", [
    "disabled", "success", "already_current", "invalid-sidecar", "post-merge-failure",
])
def test_persistent_failure_notifies_without_ok_and_preserves_sidecar(
    pipeline, monkeypatch, warning, notify_ok, publication,
):
    paths, events = pipeline
    _producer(monkeypatch, live=[warning])
    sidecar = paths["derivatives_history_path"]
    if publication in ("success", "already_current"):
        sidecar.write_text(json.dumps({
            "schema_version": "pivots_derivatives_history.v0.1",
            "provider": "binance_usdm",
            "generated_at": "2026-09-15T23:00:00Z",
            "assets": {asset: {"symbol": asset + "USDT", "history": []}
                       for asset in ("BTC", "ETH")},
        }))
    original = sidecar.read_bytes()
    bak = Path(str(sidecar) + ".bak")
    if warning.startswith("SidecarOrphanBak:"):
        bak.write_bytes(b"preserved backup")

    def publisher(args):
        events["publisher"].append(args)
        assert args[args.index("--derivatives-history-path") + 1] == str(sidecar)
        if publication == "invalid-sidecar":
            with pytest.raises(PublishError, match="sidecar validation failed") as exc:
                _load_source_snapshot(paths["assets_path"], paths["backtest_path"], sidecar)
            return rd.PublisherInvocation(1, f"phase=pre_merge {exc.value}")
        if publication == "post-merge-failure":
            return rd.PublisherInvocation(1, "phase=post_merge production smoke failed")
        _load_source_snapshot(paths["assets_path"], paths["backtest_path"], sidecar)
        return rd.PublisherInvocation(0, json.dumps({
            "state": "published" if publication == "success" else "already_current",
            "generated_at": "2026-09-15T23:00:00Z",
            "pr_url": None, "merge_sha": None,
        }))

    monkeypatch.setattr(rd, "_invoke_publisher", publisher)
    rc = rd.run_daily(**paths, auto_commit=publication != "disabled",
                      auto_publish=publication != "disabled", notify_ok=notify_ok)
    records = [json.loads(line) for line in paths["log_file"].read_text().splitlines()]
    assert rc == 0
    assert len(records) == 1
    payload = records[0]
    assert payload["status"] == "FAILED"
    assert payload["error_type"] == (
        "AutoPublishFailed" if publication in ("invalid-sidecar", "post-merge-failure")
        else "SidecarHistoryBlocked"
    )
    assert warning in payload["details"]
    assert payload["orphan_bak_present"] is warning.startswith("SidecarOrphanBak:")
    assert payload["previous_snapshot_preserved"] is (
        publication in ("disabled", "already_current", "invalid-sidecar")
    )
    if publication in ("disabled", "success", "already_current"):
        assert "public pair" in payload["details"]
        assert "operator action required" in payload["details"]
    if publication == "success":
        assert '"state": "published"' in payload["details"]
    assert len(events["publisher"]) == (publication != "disabled")
    assert len(events["macos"]) == len(events["telegram"]) == 1
    assert "test-token" not in paths["log_file"].read_text()
    assert sidecar.read_bytes() == original
    assert not Path(str(sidecar) + ".tmp").exists()
    if bak.exists():
        assert bak.read_bytes() == b"preserved backup"
    assert events["archives"] == [paths["assets_path"], paths["backtest_path"]]
    assert events["prunes"] == ["pivot_assets.live", "pivot_backtest.live"]


@pytest.mark.parametrize("output", [
    "", "published: fixture success", "phase=pre_merge",
    '{"state": "already_current"', '[]', 'null', '{"state": "unknown"}',
    '{"state": "already_current"}\nunstructured warning',
])
def test_blocked_history_does_not_claim_preservation_for_unknown_publish_success(
    pipeline, monkeypatch, output,
):
    paths, events = pipeline
    _producer(monkeypatch, live=["SidecarOrphanBak: pending backup"])
    monkeypatch.setattr(rd, "_invoke_publisher", lambda _: rd.PublisherInvocation(0, output))

    assert rd.run_daily(**paths, auto_commit=True, auto_publish=True, notify_ok=False) == 0
    payload = json.loads(paths["log_file"].read_text())
    assert payload["status"] == "FAILED"
    assert payload["error_type"] == "SidecarHistoryBlocked"
    assert payload["previous_snapshot_preserved"] is False
    assert "production publish:" in payload["details"]
    assert len(events["macos"]) == len(events["telegram"]) == 1


@pytest.mark.parametrize("live_warning", [
    "RuntimeError: provider down", "RuntimeError: SidecarValidationError in provider message",
])
def test_transient_warning_keeps_existing_ok_behavior(pipeline, monkeypatch, live_warning):
    paths, events = pipeline
    _producer(monkeypatch, live=[live_warning])
    assert rd.run_daily(**paths, notify_ok=False) == 0
    payload = json.loads(paths["log_file"].read_text())
    assert payload["status"] == "OK"
    assert live_warning in payload["details"]
    assert events["macos"] == events["telegram"] == []


@pytest.mark.parametrize("dry_warning", ["SidecarValidationError: precheck", "SidecarOrphanBak: precheck"])
def test_recovered_live_run_does_not_escalate_dry_warning(pipeline, monkeypatch, dry_warning):
    paths, events = pipeline
    _producer(monkeypatch, dry=[dry_warning])
    assert rd.run_daily(**paths, notify_ok=False) == 0
    payload = json.loads(paths["log_file"].read_text())
    assert payload["status"] == "OK"
    assert dry_warning not in payload["details"]
    assert paths["derivatives_history_path"] in events["archives"]
    assert events["macos"] == events["telegram"] == []


@pytest.mark.parametrize("warning", ["SidecarValidationError: damaged", "SidecarOrphanBak: backup"])
@pytest.mark.parametrize("failure,error_type", [
    ("archive", "RetentionFailed"),
    ("git", "AutoCommitFailed"),
    ("path", "AutoCommitSkipped"),
])
def test_later_pipeline_failure_retains_history_block_reason(
    pipeline, monkeypatch, warning, failure, error_type,
):
    paths, events = pipeline
    _producer(monkeypatch, live=[warning])
    before = paths["derivatives_history_path"].read_bytes()
    if failure == "archive":
        def fail_archive(*args):
            raise OSError("fixture archive failure")
        monkeypatch.setattr(rd, "archive", fail_archive)
    elif failure == "git":
        monkeypatch.setattr(rd.subprocess, "run", lambda cmd, **kw: subprocess.CompletedProcess(
            cmd, 1, stdout="", stderr="fixture git failure",
        ))
    else:
        monkeypatch.setattr(rd, "REPO_ROOT", paths["history_dir"])

    assert rd.run_daily(**paths, auto_commit=True, notify_ok=False) == 0
    payload = json.loads(paths["log_file"].read_text())
    assert payload["status"] == "FAILED"
    assert payload["error_type"] == error_type
    assert warning in payload["details"]
    assert "operator action required" in payload["details"]
    assert payload["orphan_bak_present"] is warning.startswith("SidecarOrphanBak:")
    assert len(events["macos"]) == len(events["telegram"]) == 1
    assert paths["derivatives_history_path"].read_bytes() == before
