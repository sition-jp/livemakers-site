"""Tests for --auto-commit and --notify-ok flag wiring on run_daily.

Step-3.5 auto-commit branches are exercised in detail by Task 5;
this file starts with the wiring-only tests.
"""
from __future__ import annotations

from pathlib import Path

import pytest


def _make_paths(tmp_path: Path):
    return {
        "assets_path": tmp_path / "assets.json",
        "backtest_path": tmp_path / "backtest.json",
        "derivatives_history_path": tmp_path / "pivot_derivatives_history.live.json",
        "history_dir": tmp_path / "hist",
        "log_file": tmp_path / "log.jsonl",
        "keep_history": 7,
    }


class _NoopCM:
    def __enter__(self): return self
    def __exit__(self, *a): pass


def test_run_daily_signature_accepts_kw_only_flags(tmp_path, monkeypatch):
    from ops import run_daily as rd

    monkeypatch.setattr("ops.run_daily.acquire_lock", lambda _p: _NoopCM())
    monkeypatch.setattr(
        "ops.run_daily._invoke_producer",
        lambda args: rd.ProducerInvocation(returncode=0, sidecar_warnings=[], output=""),
    )
    monkeypatch.setattr("ops.run_daily.archive", lambda *a, **kw: None)
    monkeypatch.setattr("ops.run_daily.prune", lambda *a, **kw: None)
    monkeypatch.setattr("ops.run_daily.dispatch", lambda *a, **kw: None)

    rc = rd.run_daily(**_make_paths(tmp_path), auto_commit=False, notify_ok=False)
    assert rc == 0


def test_main_parses_auto_commit_and_notify_ok(monkeypatch):
    from ops import run_daily as rd

    captured: dict = {}

    def fake_run_daily(**kwargs):
        captured.update(kwargs)
        return 0

    monkeypatch.setattr("ops.run_daily.run_daily", fake_run_daily)
    monkeypatch.setattr("sys.argv", [
        "run_daily", "--auto-commit", "--notify-ok",
    ])
    rc = rd.main()
    assert rc == 0
    assert captured["auto_commit"] is True
    assert captured["notify_ok"] is True


def test_main_defaults_both_flags_off(monkeypatch):
    from ops import run_daily as rd

    captured: dict = {}

    def fake_run_daily(**kwargs):
        captured.update(kwargs)
        return 0

    monkeypatch.setattr("ops.run_daily.run_daily", fake_run_daily)
    monkeypatch.setattr("sys.argv", ["run_daily"])
    rd.main()
    assert captured["auto_commit"] is False
    assert captured["notify_ok"] is False


import subprocess


class _MockProducerAndGit:
    """Helper: queues subprocess.run responses by command pattern."""

    def __init__(self):
        self.responses: list[tuple[str, dict]] = []
        self.calls: list[tuple] = []

    def respond(self, cmd_keyword: str, *, returncode: int = 0, stdout: str = "", stderr: str = ""):
        self.responses.append((cmd_keyword, {
            "returncode": returncode, "stdout": stdout, "stderr": stderr,
        }))

    def __call__(self, cmd, *args, **kwargs):
        self.calls.append((cmd, kwargs))
        for keyword, resp in self.responses:
            if keyword in " ".join(cmd):
                return subprocess.CompletedProcess(
                    args=cmd,
                    returncode=resp["returncode"],
                    stdout=resp["stdout"],
                    stderr=resp["stderr"],
                )
        # Default: success with empty output
        return subprocess.CompletedProcess(args=cmd, returncode=0, stdout="", stderr="")


def _captured_dispatch(monkeypatch):
    """Install a fake dispatch that records the last payload."""
    captured: dict = {}

    def fake_dispatch(p, log_file, *, notify_ok=False):
        captured["p"] = p
        captured["notify_ok"] = notify_ok

    monkeypatch.setattr("ops.run_daily.dispatch", fake_dispatch)
    return captured


def _stub_pipeline_success(monkeypatch, mocker):
    """Stub the lock + producer + retention to simulate a successful run."""
    from ops import run_daily as rd

    monkeypatch.setattr("ops.run_daily.acquire_lock", lambda _p: _NoopCM())
    monkeypatch.setattr(
        "ops.run_daily._invoke_producer",
        lambda args: rd.ProducerInvocation(returncode=0, sidecar_warnings=[], output=""),
    )
    monkeypatch.setattr("ops.run_daily.archive", lambda *a, **kw: None)
    monkeypatch.setattr("ops.run_daily.prune", lambda *a, **kw: None)
    monkeypatch.setattr("ops.run_daily.subprocess.run", mocker)


def test_run_daily_passes_sidecar_path_to_producer(tmp_path, monkeypatch):
    from ops import run_daily as rd

    calls = []

    def fake_invoke(args):
        calls.append(args)
        return rd.ProducerInvocation(returncode=0, sidecar_warnings=[], output="")

    monkeypatch.setattr("ops.run_daily.acquire_lock", lambda _p: _NoopCM())
    monkeypatch.setattr("ops.run_daily._invoke_producer", fake_invoke)
    monkeypatch.setattr("ops.run_daily.archive", lambda *a, **kw: None)
    monkeypatch.setattr("ops.run_daily.prune", lambda *a, **kw: None)
    monkeypatch.setattr("ops.run_daily.dispatch", lambda *a, **kw: None)

    paths = _make_paths(tmp_path)
    sidecar = tmp_path / "derivatives.json"
    paths["derivatives_history_path"] = sidecar
    rc = rd.run_daily(**paths, auto_commit=False, notify_ok=False)

    assert rc == 0
    assert "--derivatives-history-path" in calls[0]
    assert str(sidecar) in calls[0]
    assert "--derivatives-history-path" in calls[1]
    assert str(sidecar) in calls[1]


def test_run_daily_sidecar_degraded_logs_ok_warning(tmp_path, monkeypatch):
    from ops import run_daily as rd

    captured = _captured_dispatch(monkeypatch)
    archive_calls: list[Path] = []
    prune_calls: list[str] = []

    def fake_invoke(args):
        if "--dry-run" in args:
            return rd.ProducerInvocation(returncode=0, sidecar_warnings=[], output="")
        return rd.ProducerInvocation(
            returncode=0,
            sidecar_warnings=["RuntimeError: sidecar provider down"],
            output="[pivots-producer] sidecar_degraded=RuntimeError: sidecar provider down",
        )

    monkeypatch.setattr("ops.run_daily.acquire_lock", lambda _p: _NoopCM())
    monkeypatch.setattr("ops.run_daily._invoke_producer", fake_invoke)
    monkeypatch.setattr("ops.run_daily.archive", lambda path, *_a, **_kw: archive_calls.append(path))
    monkeypatch.setattr(
        "ops.run_daily.prune",
        lambda _history_dir, prefix, **_kw: prune_calls.append(prefix),
    )
    paths = _make_paths(tmp_path)
    paths["assets_path"].write_text("{}")
    paths["backtest_path"].write_text("{}")
    paths["derivatives_history_path"].write_text("{}")

    rc = rd.run_daily(**paths, auto_commit=False, notify_ok=False)

    assert rc == 0
    assert captured["p"]["status"] == "OK"
    assert "sidecar degraded" in captured["p"]["details"]
    assert "sidecar provider down" in captured["p"]["details"]
    assert archive_calls == [paths["assets_path"], paths["backtest_path"]]
    assert prune_calls == ["pivot_assets.live", "pivot_backtest.live"]


@pytest.mark.parametrize(
    ("dry_result", "live_result", "expect_warning", "expect_sidecar_retention"),
    [
        pytest.param(
            lambda rd: rd.ProducerInvocation(
                returncode=0,
                sidecar_warnings=["RuntimeError: dry warning only"],
                output="[pivots-producer] sidecar_degraded=RuntimeError: dry warning only",
            ),
            lambda rd: rd.ProducerInvocation(returncode=0, sidecar_warnings=[], output=""),
            False,
            True,
            id="dry-warning-live-clean",
        ),
        pytest.param(
            lambda rd: rd.ProducerInvocation(returncode=0, sidecar_warnings=[], output=""),
            lambda rd: rd.ProducerInvocation(
                returncode=0,
                sidecar_warnings=["RuntimeError: live warning only"],
                output="[pivots-producer] sidecar_degraded=RuntimeError: live warning only",
            ),
            True,
            False,
            id="live-warning-authoritative",
        ),
    ],
)
def test_run_daily_uses_live_sidecar_warnings_for_ok_details_and_retention(
    tmp_path,
    monkeypatch,
    dry_result,
    live_result,
    expect_warning,
    expect_sidecar_retention,
):
    from ops import run_daily as rd

    captured = _captured_dispatch(monkeypatch)
    archive_calls: list[Path] = []
    prune_calls: list[str] = []
    results = [dry_result(rd), live_result(rd)]

    def fake_invoke(_args):
        return results.pop(0)

    monkeypatch.setattr("ops.run_daily.acquire_lock", lambda _p: _NoopCM())
    monkeypatch.setattr("ops.run_daily._invoke_producer", fake_invoke)
    monkeypatch.setattr("ops.run_daily.archive", lambda path, *_a, **_kw: archive_calls.append(path))
    monkeypatch.setattr(
        "ops.run_daily.prune",
        lambda _history_dir, prefix, **_kw: prune_calls.append(prefix),
    )
    paths = _make_paths(tmp_path)
    paths["assets_path"].write_text("{}")
    paths["backtest_path"].write_text("{}")
    paths["derivatives_history_path"].write_text("{}")

    rc = rd.run_daily(**paths, auto_commit=False, notify_ok=False)

    assert rc == 0
    assert captured["p"]["status"] == "OK"
    assert ("sidecar degraded" in captured["p"]["details"]) is expect_warning
    assert ("dry warning only" in captured["p"]["details"]) is False
    assert ("live warning only" in captured["p"]["details"]) is expect_warning
    assert archive_calls[:2] == [paths["assets_path"], paths["backtest_path"]]
    assert prune_calls[:2] == ["pivot_assets.live", "pivot_backtest.live"]
    if expect_sidecar_retention:
        assert archive_calls[2:] == [paths["derivatives_history_path"]]
        assert prune_calls[2:] == ["pivot_derivatives_history.live"]
    else:
        assert archive_calls[2:] == []
        assert prune_calls[2:] == []


def test_auto_commit_message_and_pathspec_include_sidecar(tmp_path, monkeypatch):
    from ops import run_daily as rd

    captured_commit_msg: list[str] = []
    captured_commit_cmd: list[list[str]] = []

    def trace(cmd, *a, **kw):
        joined = " ".join(cmd)
        if "status --porcelain" in joined:
            return subprocess.CompletedProcess(
                args=cmd,
                returncode=0,
                stdout=" M data/pivot_derivatives_history.live.json\n",
            )
        if cmd[0] == "git" and "commit" in cmd:
            captured_commit_cmd.append(cmd)
            captured_commit_msg.append(cmd[cmd.index("-m") + 1])
        if "rev-parse" in joined:
            return subprocess.CompletedProcess(args=cmd, returncode=0, stdout="abc1234\n")
        return subprocess.CompletedProcess(args=cmd, returncode=0, stdout="", stderr="")

    _stub_pipeline_success(monkeypatch, trace)
    paths = _make_paths(tmp_path)
    paths["assets_path"].write_text("{}")
    paths["backtest_path"].write_text("{}")
    sidecar = tmp_path / "derivatives.json"
    sidecar.write_text("{}")
    paths["derivatives_history_path"] = sidecar
    monkeypatch.setattr("ops.run_daily.REPO_ROOT", tmp_path)

    rd.run_daily(**paths, auto_commit=True, notify_ok=False)

    assert captured_commit_msg
    assert "derivatives_history:" in captured_commit_msg[0]
    assert str(sidecar) in captured_commit_cmd[0]


def test_auto_commit_omits_missing_degraded_sidecar_pathspec(
    tmp_path, monkeypatch
):
    from ops import run_daily as rd

    captured = _captured_dispatch(monkeypatch)
    paths = _make_paths(tmp_path)
    paths["assets_path"].write_text("{}")
    paths["backtest_path"].write_text("{}")
    sidecar = paths["derivatives_history_path"]
    assert not sidecar.exists()

    dry_ok = rd.ProducerInvocation(returncode=0, sidecar_warnings=[], output="")
    live_degraded = rd.ProducerInvocation(
        returncode=0,
        sidecar_warnings=["RuntimeError: sidecar provider down"],
        output="[pivots-producer] sidecar_degraded=RuntimeError: sidecar provider down",
    )
    monkeypatch.setattr("ops.run_daily.acquire_lock", lambda _p: _NoopCM())
    monkeypatch.setattr(
        "ops.run_daily._invoke_producer",
        lambda args: dry_ok if "--dry-run" in args else live_degraded,
    )
    monkeypatch.setattr("ops.run_daily.archive", lambda *a, **kw: None)
    monkeypatch.setattr("ops.run_daily.prune", lambda *a, **kw: None)
    monkeypatch.setattr("ops.run_daily.REPO_ROOT", tmp_path)

    git_pathspecs: list[list[str]] = []

    def trace(cmd, *a, **kw):
        joined = " ".join(cmd)
        if "status --porcelain" in joined:
            git_pathspecs.append(cmd)
            assert str(sidecar) not in cmd
            return subprocess.CompletedProcess(
                args=cmd,
                returncode=0,
                stdout=" M assets.json\n M backtest.json\n",
            )
        if cmd[0] == "git" and ("add" in cmd or "commit" in cmd):
            git_pathspecs.append(cmd)
            assert str(sidecar) not in cmd
        if "rev-parse" in joined:
            return subprocess.CompletedProcess(args=cmd, returncode=0, stdout="abc1234\n")
        return subprocess.CompletedProcess(args=cmd, returncode=0, stdout="", stderr="")

    monkeypatch.setattr("ops.run_daily.subprocess.run", trace)

    rd.run_daily(**paths, auto_commit=True, notify_ok=False)

    assert captured["p"]["status"] == "OK"
    assert "sidecar degraded" in captured["p"]["details"]
    assert "committed abc1234" in captured["p"]["details"]
    assert any("status --porcelain" in " ".join(cmd) for cmd in git_pathspecs)
    assert any(cmd[0] == "git" and "commit" in cmd for cmd in git_pathspecs)


def test_auto_commit_off_no_git_invocation(tmp_path, monkeypatch):
    from ops import run_daily as rd

    captured = _captured_dispatch(monkeypatch)
    git_calls: list = []

    def trace_run(cmd, *a, **kw):
        if "git" in (cmd[0] if cmd else ""):
            git_calls.append(cmd)
        return subprocess.CompletedProcess(args=cmd, returncode=0, stdout="", stderr="")

    _stub_pipeline_success(monkeypatch, trace_run)
    paths = _make_paths(tmp_path)
    paths["assets_path"].write_text("{}")
    paths["backtest_path"].write_text("{}")

    rd.run_daily(**paths, auto_commit=False, notify_ok=False)
    assert git_calls == []
    assert captured["p"]["status"] == "OK"


def test_auto_commit_no_diff_skips_commit(tmp_path, monkeypatch):
    from ops import run_daily as rd

    captured = _captured_dispatch(monkeypatch)
    mock = _MockProducerAndGit()
    mock.respond("status --porcelain", returncode=0, stdout="")
    _stub_pipeline_success(monkeypatch, mock)
    paths = _make_paths(tmp_path)
    paths["assets_path"].write_text("{}")
    paths["backtest_path"].write_text("{}")

    monkeypatch.setattr("ops.run_daily.REPO_ROOT", tmp_path)

    rd.run_daily(**paths, auto_commit=True, notify_ok=False)
    assert captured["p"]["status"] == "OK"
    assert "no diff" in captured["p"]["details"]
    cmds = [" ".join(c[0]) for c in mock.calls]
    assert not any("git add" in c for c in cmds)
    assert not any("git commit" in c for c in cmds)


def test_auto_commit_success_appends_commit_hash(tmp_path, monkeypatch):
    from ops import run_daily as rd

    captured = _captured_dispatch(monkeypatch)
    mock = _MockProducerAndGit()
    mock.respond("status --porcelain", returncode=0, stdout=" M data/pivot_assets.live.json\n")
    mock.respond("rev-parse", returncode=0, stdout="a1b2c3d\n")  # MOVED before "git -C"
    mock.respond("git -C", returncode=0)  # add + commit
    _stub_pipeline_success(monkeypatch, mock)
    paths = _make_paths(tmp_path)
    paths["assets_path"].write_text("{}")
    paths["backtest_path"].write_text("{}")
    monkeypatch.setattr("ops.run_daily.REPO_ROOT", tmp_path)

    rd.run_daily(**paths, auto_commit=True, notify_ok=False)
    assert captured["p"]["status"] == "OK"
    assert "a1b2c3d" in captured["p"]["details"]


def test_auto_commit_revparse_fail_yields_hash_unknown(tmp_path, monkeypatch):
    from ops import run_daily as rd

    captured = _captured_dispatch(monkeypatch)
    mock = _MockProducerAndGit()
    mock.respond("status --porcelain", returncode=0, stdout=" M data/pivot_assets.live.json\n")
    mock.respond("rev-parse", returncode=1, stderr="fatal")  # MOVED before "git -C"
    mock.respond("git -C", returncode=0)
    _stub_pipeline_success(monkeypatch, mock)
    paths = _make_paths(tmp_path)
    paths["assets_path"].write_text("{}")
    paths["backtest_path"].write_text("{}")
    monkeypatch.setattr("ops.run_daily.REPO_ROOT", tmp_path)

    rd.run_daily(**paths, auto_commit=True, notify_ok=False)
    assert captured["p"]["status"] == "OK"
    assert "hash_unknown" in captured["p"]["details"]


def test_auto_commit_commit_failure_emits_failed_status(tmp_path, monkeypatch):
    from ops import run_daily as rd

    captured = _captured_dispatch(monkeypatch)
    mock = _MockProducerAndGit()
    mock.respond("status --porcelain", returncode=0, stdout=" M data/pivot_assets.live.json\n")
    mock.respond("git -C", returncode=128, stderr="fatal: index.lock exists\n")
    _stub_pipeline_success(monkeypatch, mock)
    paths = _make_paths(tmp_path)
    paths["assets_path"].write_text("{}")
    paths["backtest_path"].write_text("{}")
    monkeypatch.setattr("ops.run_daily.REPO_ROOT", tmp_path)

    rd.run_daily(**paths, auto_commit=True, notify_ok=False)
    assert captured["p"]["status"] == "FAILED"
    assert captured["p"]["error_type"] == "AutoCommitFailed"
    assert "index.lock" in captured["p"]["details"]


def test_auto_commit_git_binary_missing(tmp_path, monkeypatch):
    from ops import run_daily as rd

    captured = _captured_dispatch(monkeypatch)

    def raise_fnf(*a, **kw):
        raise FileNotFoundError("git: not found")

    _stub_pipeline_success(monkeypatch, raise_fnf)
    paths = _make_paths(tmp_path)
    paths["assets_path"].write_text("{}")
    paths["backtest_path"].write_text("{}")
    monkeypatch.setattr("ops.run_daily.REPO_ROOT", tmp_path)

    rd.run_daily(**paths, auto_commit=True, notify_ok=False)
    assert captured["p"]["status"] == "FAILED"
    assert captured["p"]["error_type"] == "AutoCommitFailed"


def test_auto_commit_permission_error_caught(tmp_path, monkeypatch):
    from ops import run_daily as rd

    captured = _captured_dispatch(monkeypatch)

    def raise_perm(*a, **kw):
        raise PermissionError("no access to .git")

    _stub_pipeline_success(monkeypatch, raise_perm)
    paths = _make_paths(tmp_path)
    paths["assets_path"].write_text("{}")
    paths["backtest_path"].write_text("{}")
    monkeypatch.setattr("ops.run_daily.REPO_ROOT", tmp_path)

    rd.run_daily(**paths, auto_commit=True, notify_ok=False)
    assert captured["p"]["status"] == "FAILED"
    assert captured["p"]["error_type"] == "AutoCommitFailed"


def test_auto_commit_repo_external_path_skipped(tmp_path, monkeypatch):
    from ops import run_daily as rd

    captured = _captured_dispatch(monkeypatch)
    _stub_pipeline_success(monkeypatch, lambda *a, **kw: subprocess.CompletedProcess(args=[], returncode=0))

    repo_root = tmp_path / "repo"
    repo_root.mkdir()
    monkeypatch.setattr("ops.run_daily.REPO_ROOT", repo_root)

    external = tmp_path / "external" / "assets.json"
    external.parent.mkdir()
    external.write_text("{}")
    backtest_in = repo_root / "data" / "pivot_backtest.live.json"
    backtest_in.parent.mkdir(parents=True)
    backtest_in.write_text("{}")

    rd.run_daily(
        assets_path=external,
        backtest_path=backtest_in,
        history_dir=tmp_path / "hist",
        log_file=tmp_path / "log.jsonl",
        keep_history=7,
        auto_commit=True,
        notify_ok=False,
    )
    assert captured["p"]["status"] == "FAILED"
    assert captured["p"]["error_type"] == "AutoCommitSkipped"


def test_auto_commit_message_contains_required_tokens(tmp_path, monkeypatch):
    from ops import run_daily as rd

    captured = _captured_dispatch(monkeypatch)
    captured_commit_msg: list[str] = []

    def trace(cmd, *a, **kw):
        if cmd[0] == "git" and "commit" in cmd:
            i = cmd.index("-m")
            captured_commit_msg.append(cmd[i + 1])
        if "status --porcelain" in " ".join(cmd):
            return subprocess.CompletedProcess(args=cmd, returncode=0, stdout=" M data/pivot_assets.live.json\n")
        if "rev-parse" in " ".join(cmd):
            return subprocess.CompletedProcess(args=cmd, returncode=0, stdout="abc1234\n")
        return subprocess.CompletedProcess(args=cmd, returncode=0)

    _stub_pipeline_success(monkeypatch, trace)
    paths = _make_paths(tmp_path)
    paths["assets_path"].write_text("{}")
    paths["backtest_path"].write_text("{}")
    monkeypatch.setattr("ops.run_daily.REPO_ROOT", tmp_path)

    rd.run_daily(**paths, auto_commit=True, notify_ok=False)
    assert captured_commit_msg, "git commit -m never invoked"
    msg = captured_commit_msg[0]
    assert "chore(pivots): daily snapshot" in msg
    assert "assets:" in msg
    assert "backtest:" in msg
